"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SFUClient = void 0;
const ws_1 = __importDefault(require("ws"));
const consola_1 = require("consola");
const crypto_1 = require("crypto");
class SFUClient {
    constructor(serverId, serverToken, sfuHost) {
        this.ws = null;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;
        this.reconnectDelay = 1000;
        this.registeredRooms = new Set();
        this.connectionHealth = {
            lastPing: 0,
            isHealthy: true,
        };
        this.serverId = serverId;
        this.serverToken = serverToken;
        this.sfuHost = sfuHost;
        // Validate configuration
        if (!serverId || !serverToken || !sfuHost) {
            throw new Error('SFU client requires serverId, serverToken, and sfuHost');
        }
    }
    connect() {
        return __awaiter(this, void 0, void 0, function* () {
            return new Promise((resolve, reject) => {
                try {
                    // Build WebSocket URL for server endpoint
                    const wsUrl = this.buildWebSocketUrl();
                    consola_1.consola.info(`Connecting to SFU server at ${wsUrl}`);
                    this.ws = new ws_1.default(wsUrl);
                    // Set connection timeout
                    const connectionTimeout = setTimeout(() => {
                        if (this.ws && this.ws.readyState === ws_1.default.CONNECTING) {
                            this.ws.terminate();
                            reject(new Error('SFU connection timeout'));
                        }
                    }, 10000);
                    this.ws.on('open', () => {
                        clearTimeout(connectionTimeout);
                        consola_1.consola.success(`Connected to SFU server at ${wsUrl}`);
                        this.reconnectAttempts = 0;
                        this.connectionHealth.isHealthy = true;
                        this.startHealthCheck();
                        resolve();
                    });
                    this.ws.on('message', (data) => {
                        try {
                            const message = JSON.parse(data.toString());
                            this.handleMessage(message);
                        }
                        catch (error) {
                            consola_1.consola.error('Error parsing SFU message:', error);
                        }
                    });
                    this.ws.on('close', (code, reason) => {
                        clearTimeout(connectionTimeout);
                        consola_1.consola.warn(`SFU connection closed: ${code} - ${reason}`);
                        this.ws = null;
                        this.connectionHealth.isHealthy = false;
                        this.registeredRooms.clear();
                        this.scheduleReconnect();
                    });
                    this.ws.on('error', (error) => {
                        clearTimeout(connectionTimeout);
                        consola_1.consola.error('SFU connection error:', error);
                        this.connectionHealth.isHealthy = false;
                        if (this.reconnectAttempts === 0) {
                            reject(error);
                        }
                    });
                }
                catch (error) {
                    consola_1.consola.error('Failed to create SFU connection:', error);
                    reject(error);
                }
            });
        });
    }
    buildWebSocketUrl() {
        // Normalize URL and ensure it uses WebSocket protocol
        let url = this.sfuHost;
        if (url.startsWith('https://')) {
            url = url.replace('https://', 'wss://');
        }
        else if (url.startsWith('http://')) {
            url = url.replace('http://', 'ws://');
        }
        else if (!url.startsWith('wss://') && !url.startsWith('ws://')) {
            url = `wss://${url}`;
        }
        // Add server endpoint path
        if (!url.endsWith('/server')) {
            url = url.replace(/\/$/, '') + '/server';
        }
        return url;
    }
    startHealthCheck() {
        // Initialize lastPing to current time to prevent immediate "unhealthy" status
        this.connectionHealth.lastPing = Date.now();
        // Check connection health periodically and send keep-alive messages
        const healthInterval = setInterval(() => {
            if (this.ws) {
                // If WebSocket is open, send keep-alive and consider it healthy
                if (this.ws.readyState === ws_1.default.OPEN) {
                    this.connectionHealth.isHealthy = true;
                    // Send keep-alive message to prevent network timeouts
                    try {
                        const keepAliveMessage = {
                            event: 'keep_alive',
                            data: JSON.stringify({ timestamp: Date.now(), server_id: this.serverId }),
                        };
                        this.ws.send(JSON.stringify(keepAliveMessage));
                        consola_1.consola.debug('💓 Sent keep-alive to SFU server');
                    }
                    catch (error) {
                        consola_1.consola.warn('⚠️ Failed to send keep-alive to SFU:', error);
                        this.connectionHealth.isHealthy = false;
                        clearInterval(healthInterval);
                    }
                }
                else {
                    consola_1.consola.warn('SFU connection appears unhealthy - WebSocket not in OPEN state');
                    this.connectionHealth.isHealthy = false;
                    clearInterval(healthInterval);
                }
            }
            else {
                // No WebSocket connection at all
                this.connectionHealth.isHealthy = false;
                clearInterval(healthInterval);
            }
        }, 15000); // Check health and send keep-alive every 15 seconds
    }
    scheduleReconnect() {
        if (this.reconnectAttempts < this.maxReconnectAttempts) {
            this.reconnectAttempts++;
            const delay = Math.min(this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1), 30000);
            consola_1.consola.info(`Reconnecting to SFU in ${delay}ms (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
            setTimeout(() => {
                this.connect().catch((error) => {
                    consola_1.consola.error('SFU reconnection failed:', error);
                });
            }, delay);
        }
        else {
            consola_1.consola.error('Max SFU reconnection attempts reached. Connection lost.');
            this.connectionHealth.isHealthy = false;
        }
    }
    handleMessage(message) {
        this.connectionHealth.lastPing = Date.now();
        switch (message.event) {
            case 'room_joined':
                consola_1.consola.success('SFU Room Registration Success:', message.data);
                break;
            case 'room_error':
                consola_1.consola.error('SFU Room Error:', message.data);
                break;
            default:
                consola_1.consola.debug('SFU Message:', message.event, message.data);
        }
    }
    registerRoom(roomId) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!this.ws || this.ws.readyState !== ws_1.default.OPEN) {
                throw new Error('SFU connection not available');
            }
            if (!roomId || typeof roomId !== 'string') {
                throw new Error('Invalid room ID');
            }
            // Skip if already registered (idempotent)
            if (this.registeredRooms.has(roomId)) {
                consola_1.consola.debug(`Room ${roomId} already registered`);
                return;
            }
            const registrationData = {
                server_id: this.serverId,
                server_token: this.serverToken,
                room_id: roomId,
            };
            const message = {
                event: 'server_register',
                data: JSON.stringify(registrationData),
            };
            this.ws.send(JSON.stringify(message));
            this.registeredRooms.add(roomId);
            consola_1.consola.info(`Registered room ${roomId} with SFU`);
        });
    }
    generateClientJoinToken(roomId, userId) {
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
    generateSecureToken(userId, roomId) {
        // Generate a cryptographically secure token
        // In production, this should be a proper JWT with expiration
        const timestamp = Date.now();
        const randomData = (0, crypto_1.randomBytes)(16).toString('hex');
        const payload = `${userId}:${roomId}:${timestamp}:${randomData}`;
        // Simple encoding for now - in production use proper JWT signing
        return Buffer.from(payload).toString('base64');
    }
    isConnected() {
        return this.ws !== null &&
            this.ws.readyState === ws_1.default.OPEN &&
            this.connectionHealth.isHealthy;
    }
    getConnectionStatus() {
        var _a;
        return {
            connected: ((_a = this.ws) === null || _a === void 0 ? void 0 : _a.readyState) === ws_1.default.OPEN || false,
            healthy: this.connectionHealth.isHealthy,
            registeredRooms: this.registeredRooms.size,
            reconnectAttempts: this.reconnectAttempts,
        };
    }
    disconnect() {
        if (this.ws) {
            consola_1.consola.info('Disconnecting from SFU server');
            this.ws.close(1000, 'Server shutdown');
            this.ws = null;
        }
        this.registeredRooms.clear();
        this.connectionHealth.isHealthy = false;
    }
}
exports.SFUClient = SFUClient;
