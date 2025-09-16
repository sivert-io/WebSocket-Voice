import WebSocket from 'ws';
import { consola } from 'consola';
import { randomBytes } from 'crypto';

interface ServerRegistrationData {
  server_id: string;
  server_token: string;
  room_id: string;
}

interface ClientJoinData {
  room_id: string;
  server_id: string;
  server_token: string;
  user_token: string;
}

interface AudioControlData {
  room_id: string;
  user_id: string;
  server_id: string;
  server_token: string;
  is_muted: boolean;
  is_deafened: boolean;
}

interface WebSocketMessage {
  event: string;
  data: string;
}

export class SFUClient {
  private ws: WebSocket | null = null;
  private serverId: string;
  private serverToken: string;
  private sfuHost: string;
  private reconnectAttempts = 0;
  // Fixed 10s reconnect delay as requested
  private reconnectDelay = 10000;
  // Track scheduled reconnect to avoid duplicates
  private reconnectTimer: NodeJS.Timeout | null = null;
  // Allow opting out on manual shutdown
  private shouldReconnect = true;
  private registeredRooms = new Set<string>();
  private roomsToReregister = new Set<string>();
  private activeUsers = new Map<string, { roomId: string; userId: string; connectedAt: number }>();
  private connectionHealth = {
    lastPing: 0,
    isHealthy: true,
  };

  constructor(serverId: string, serverToken: string, sfuHost: string) {
    this.serverId = serverId;
    this.serverToken = serverToken;
    this.sfuHost = sfuHost;
    
    // Validate configuration
    if (!serverId || !serverToken || !sfuHost) {
      throw new Error('SFU client requires serverId, serverToken, and sfuHost');
    }
  }

  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        // Build WebSocket URL for server endpoint
        const wsUrl = this.buildWebSocketUrl();
        consola.info(`Connecting to SFU server at ${wsUrl}`);
        
        this.ws = new WebSocket(wsUrl);
        // ensure future reconnects are allowed when connect is called
        this.shouldReconnect = true;

        // Set connection timeout
        const connectionTimeout = setTimeout(() => {
          if (this.ws && this.ws.readyState === WebSocket.CONNECTING) {
            this.ws.terminate();
            reject(new Error('SFU connection timeout'));
          }
        }, 10000);

        this.ws.on('open', () => {
          clearTimeout(connectionTimeout);
          consola.success(`Connected to SFU server at ${wsUrl}`);
          this.reconnectAttempts = 0;
          this.connectionHealth.isHealthy = true;
          this.startHealthCheck();
          // Clear any pending reconnect timer on successful open
          if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer);
            this.reconnectTimer = null;
          }
          
          // Re-register rooms after successful reconnection
          this.reregisterRooms().catch(error => {
            consola.error('Failed to re-register rooms after reconnection:', error);
          });
          
          resolve();
        });

        this.ws.on('message', (data: WebSocket.Data) => {
          try {
            const message: WebSocketMessage = JSON.parse(data.toString());
            this.handleMessage(message);
          } catch (error) {
            consola.error('Error parsing SFU message:', error);
          }
        });

        this.ws.on('close', (code, reason) => {
          clearTimeout(connectionTimeout);
          consola.warn(`SFU connection closed: ${code} - ${reason}`);
          this.ws = null;
          this.connectionHealth.isHealthy = false;
          // Don't clear registered rooms, instead move them to re-registration queue
          this.roomsToReregister = new Set([...this.roomsToReregister, ...this.registeredRooms]);
          this.registeredRooms.clear();
          consola.info(`Marked ${this.roomsToReregister.size} rooms for re-registration on reconnect`);
          this.scheduleReconnect();
        });

        this.ws.on('error', (error) => {
          clearTimeout(connectionTimeout);
          consola.error('SFU connection error:', error);
          this.connectionHealth.isHealthy = false;
          
          if (this.reconnectAttempts === 0) {
            reject(error);
          }
          // Also schedule reconnects on error in case 'close' is not emitted
          this.scheduleReconnect();
        });

      } catch (error) {
        consola.error('Failed to create SFU connection:', error);
        reject(error);
      }
    });
  }

  private buildWebSocketUrl(): string {
    // Normalize URL and ensure it uses WebSocket protocol
    let url = this.sfuHost;
    
    if (url.startsWith('https://')) {
      url = url.replace('https://', 'wss://');
    } else if (url.startsWith('http://')) {
      url = url.replace('http://', 'ws://');
    } else if (!url.startsWith('wss://') && !url.startsWith('ws://')) {
      url = `wss://${url}`;
    }
    
    // Add server endpoint path
    if (!url.endsWith('/server')) {
      url = url.replace(/\/$/, '') + '/server';
    }
    
    return url;
  }

  private startHealthCheck(): void {
    // Initialize lastPing to current time to prevent immediate "unhealthy" status
    this.connectionHealth.lastPing = Date.now();
    
    // Check connection health periodically and send keep-alive messages
    const healthInterval = setInterval(() => {
      if (this.ws) {
        // If WebSocket is open, send keep-alive and consider it healthy
        if (this.ws.readyState === WebSocket.OPEN) {
          this.connectionHealth.isHealthy = true;
          
          // Send keep-alive message to prevent network timeouts
          try {
            const keepAliveMessage: WebSocketMessage = {
              event: 'keep_alive',
              data: JSON.stringify({ timestamp: Date.now(), server_id: this.serverId }),
            };
            
            this.ws.send(JSON.stringify(keepAliveMessage));
            consola.debug('💓 Sent keep-alive to SFU server');
          } catch (error) {
            consola.warn('⚠️ Failed to send keep-alive to SFU:', error);
            this.connectionHealth.isHealthy = false;
            clearInterval(healthInterval);
          }
        } else {
          consola.warn('SFU connection appears unhealthy - WebSocket not in OPEN state');
          this.connectionHealth.isHealthy = false;
          clearInterval(healthInterval);
        }
      } else {
        // No WebSocket connection at all
        this.connectionHealth.isHealthy = false;
        clearInterval(healthInterval);
      }
    }, 15000); // Check health and send keep-alive every 15 seconds
  }

  private scheduleReconnect(): void {
    if (!this.shouldReconnect) {
      consola.info('Reconnect disabled (manual shutdown). Skipping reconnect scheduling.');
      return;
    }

    // Avoid stacking multiple timers
    if (this.reconnectTimer) {
      return;
    }

    this.reconnectAttempts++;
    const delay = this.reconnectDelay; // fixed 10s
    consola.info(`Reconnecting to SFU in ${delay}ms (attempt ${this.reconnectAttempts})`);

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect().catch((error) => {
        consola.error('SFU reconnection failed:', error);
        // schedule again; connect() error path will call scheduleReconnect via error/close, but defensively reschedule
        this.scheduleReconnect();
      });
    }, delay);
  }

  private handleMessage(message: WebSocketMessage): void {
    this.connectionHealth.lastPing = Date.now();
    
    switch (message.event) {
      case 'room_joined':
        consola.success('SFU Room Registration Success:', message.data);
        break;
        
      case 'room_error':
        consola.error('SFU Room Error:', message.data);
        break;
        
      default:
        consola.debug('SFU Message:', message.event, message.data);
    }
  }

  private async reregisterRooms(): Promise<void> {
    if (this.roomsToReregister.size === 0) {
      return;
    }

    consola.info(`Re-registering ${this.roomsToReregister.size} rooms after reconnection...`);
    
    // Create a copy to avoid modifying the set while iterating
    const roomsToProcess = Array.from(this.roomsToReregister);
    this.roomsToReregister.clear();
    
    for (const roomId of roomsToProcess) {
      try {
        await this.internalRegisterRoom(roomId);
        consola.success(`Re-registered room: ${roomId}`);
      } catch (error) {
        consola.error(`Failed to re-register room ${roomId}:`, error);
        // If re-registration fails, add it back to the queue for next attempt
        this.roomsToReregister.add(roomId);
      }
    }
    
    consola.success('Room re-registration completed');
  }

  private async internalRegisterRoom(roomId: string): Promise<void> {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error('SFU connection not available');
    }

    if (!roomId || typeof roomId !== 'string') {
      throw new Error('Invalid room ID');
    }

    // Skip if already registered (idempotent)
    if (this.registeredRooms.has(roomId)) {
      consola.debug(`Room ${roomId} already registered`);
      return;
    }

    const registrationData: ServerRegistrationData = {
      server_id: this.serverId,
      server_token: this.serverToken,
      room_id: roomId,
    };

    const message: WebSocketMessage = {
      event: 'server_register',
      data: JSON.stringify(registrationData),
    };

    this.ws.send(JSON.stringify(message));
    this.registeredRooms.add(roomId);
    
    consola.info(`Registered room ${roomId} with SFU`);
  }

  async registerRoom(roomId: string): Promise<void> {
    // Add to persistent storage first
    this.roomsToReregister.add(roomId);
    // Then perform the actual registration
    await this.internalRegisterRoom(roomId);
  }

  async unregisterRoom(roomId: string): Promise<void> {
    // Remove from both current and persistent storage
    this.registeredRooms.delete(roomId);
    this.roomsToReregister.delete(roomId);
    consola.info(`Unregistered room ${roomId} from SFU client`);
  }

  generateClientJoinToken(roomId: string, userId: string): ClientJoinData {
    if (!roomId || !userId) {
      throw new Error('Room ID and User ID are required for token generation');
    }

    // Generate a secure user token (in production, use proper JWT)
    const userToken = this.generateSecureToken(userId, roomId);

    return {
      room_id: roomId,
      server_id: this.serverId,
      server_token: this.serverToken,
      user_token: userToken,
    };
  }

  private generateSecureToken(userId: string, roomId: string): string {
    // Generate a cryptographically secure token
    // In production, this should be a proper JWT with expiration
    const timestamp = Date.now();
    const randomData = randomBytes(16).toString('hex');
    const payload = `${userId}:${roomId}:${timestamp}:${randomData}`;
    
    // Simple encoding for now - in production use proper JWT signing
    return Buffer.from(payload).toString('base64');
  }

  async updateUserAudioState(roomId: string, userId: string, isMuted: boolean, isDeafened: boolean): Promise<void> {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      consola.warn('SFU connection not available for audio state update');
      return;
    }

    if (!roomId || !userId) {
      throw new Error('Room ID and User ID are required for audio state update');
    }

    const audioControlData: AudioControlData = {
      room_id: roomId,
      user_id: userId,
      server_id: this.serverId,
      server_token: this.serverToken,
      is_muted: isMuted,
      is_deafened: isDeafened,
    };

    const message: WebSocketMessage = {
      event: 'user_audio_control',
      data: JSON.stringify(audioControlData),
    };

    this.ws.send(JSON.stringify(message));
    consola.info(`Updated audio state for user ${userId} in room ${roomId}: muted=${isMuted}, deafened=${isDeafened}`);
  }

  // Track user connections for duplicate prevention
  trackUserConnection(roomId: string, userId: string): boolean {
    // Check if user is already connected to any room
    const existingConnection = this.activeUsers.get(userId);
    if (existingConnection) {
      consola.warn(`🚫 SFU: User ${userId} already connected to room ${existingConnection.roomId}`);
      return false; // Connection denied
    }

    // Track the new connection
    this.activeUsers.set(userId, {
      roomId,
      userId,
      connectedAt: Date.now()
    });
    
    consola.info(`✅ SFU: User ${userId} connected to room ${roomId}`);
    return true; // Connection allowed
  }

  // Remove user connection tracking
  untrackUserConnection(userId: string): void {
    const connection = this.activeUsers.get(userId);
    if (connection) {
      this.activeUsers.delete(userId);
      consola.info(`✅ SFU: User ${userId} disconnected from room ${connection.roomId}`);
    }
  }

  // Get active user connections (for debugging/monitoring)
  getActiveUsers(): Map<string, { roomId: string; userId: string; connectedAt: number }> {
    return new Map(this.activeUsers);
  }

  isConnected(): boolean {
    return this.ws !== null && 
           this.ws.readyState === WebSocket.OPEN && 
           this.connectionHealth.isHealthy;
  }

  getConnectionStatus(): {
    connected: boolean;
    healthy: boolean;
    registeredRooms: number;
    roomsToReregister: number;
    reconnectAttempts: number;
  } {
    return {
      connected: this.ws?.readyState === WebSocket.OPEN || false,
      healthy: this.connectionHealth.isHealthy,
      registeredRooms: this.registeredRooms.size,
      roomsToReregister: this.roomsToReregister.size,
      reconnectAttempts: this.reconnectAttempts,
    };
  }

  disconnect(): void {
    if (this.ws) {
      consola.info('Disconnecting from SFU server');
      this.ws.close(1000, 'Server shutdown');
      this.ws = null;
    }
    // Prevent further reconnect attempts and clear any pending timer
    this.shouldReconnect = false;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.registeredRooms.clear();
    this.roomsToReregister.clear();
    this.connectionHealth.isHealthy = false;
  }
} 