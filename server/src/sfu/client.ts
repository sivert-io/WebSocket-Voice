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
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;
  private registeredRooms = new Set<string>();
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
          this.registeredRooms.clear();
          this.scheduleReconnect();
        });

        this.ws.on('error', (error) => {
          clearTimeout(connectionTimeout);
          consola.error('SFU connection error:', error);
          this.connectionHealth.isHealthy = false;
          
          if (this.reconnectAttempts === 0) {
            reject(error);
          }
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
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      const delay = Math.min(this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1), 30000);
      
      consola.info(`Reconnecting to SFU in ${delay}ms (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
      
      setTimeout(() => {
        this.connect().catch((error) => {
          consola.error('SFU reconnection failed:', error);
        });
      }, delay);
    } else {
      consola.error('Max SFU reconnection attempts reached. Connection lost.');
      this.connectionHealth.isHealthy = false;
    }
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

  async registerRoom(roomId: string): Promise<void> {
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

  isConnected(): boolean {
    return this.ws !== null && 
           this.ws.readyState === WebSocket.OPEN && 
           this.connectionHealth.isHealthy;
  }

  getConnectionStatus(): {
    connected: boolean;
    healthy: boolean;
    registeredRooms: number;
    reconnectAttempts: number;
  } {
    return {
      connected: this.ws?.readyState === WebSocket.OPEN || false,
      healthy: this.connectionHealth.isHealthy,
      registeredRooms: this.registeredRooms.size,
      reconnectAttempts: this.reconnectAttempts,
    };
  }

  disconnect(): void {
    if (this.ws) {
      consola.info('Disconnecting from SFU server');
      this.ws.close(1000, 'Server shutdown');
      this.ws = null;
    }
    this.registeredRooms.clear();
    this.connectionHealth.isHealthy = false;
  }
} 