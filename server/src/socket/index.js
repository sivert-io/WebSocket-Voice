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
exports.socketHandler = socketHandler;
const colors_1 = require("../utils/colors");
const consola_1 = __importDefault(require("consola"));
const clients_1 = require("./utils/clients");
const server_1 = require("./utils/server");
const clientsInfo = {};
function socketHandler(io, socket, sfuClient) {
    var _a;
    const clientId = socket.id;
    consola_1.default.info(`Client connected: ${clientId}`);
    // Enhanced event handlers with better error handling and validation
    const eventHandlers = {
        updateNickname: (newNickName) => {
            if (!clientsInfo[clientId])
                return;
            if (typeof newNickName !== 'string' || newNickName.length > 50) {
                socket.emit('error', 'Invalid nickname');
                return;
            }
            clientsInfo[clientId].nickname = newNickName.trim();
            (0, clients_1.syncAllClients)(io, clientsInfo);
            consola_1.default.info(`Client ${clientId} updated nickname to: ${newNickName}`);
        },
        updateMute: (isMuted) => {
            if (!clientsInfo[clientId])
                return;
            clientsInfo[clientId].isMuted = Boolean(isMuted);
            (0, clients_1.syncAllClients)(io, clientsInfo);
            consola_1.default.info(`Client ${clientId} ${isMuted ? 'muted' : 'unmuted'}`);
        },
        streamID: (streamID) => {
            if (!clientsInfo[clientId])
                return;
            const wasInChannel = clientsInfo[clientId].hasJoinedChannel;
            clientsInfo[clientId].streamID = streamID;
            clientsInfo[clientId].hasJoinedChannel = streamID.length > 0;
            if (!wasInChannel && streamID.length > 0) {
                consola_1.default.info(`Client ${clientId} joined voice channel`);
            }
            else if (wasInChannel && streamID.length === 0) {
                consola_1.default.info(`Client ${clientId} left voice channel`);
            }
            (0, clients_1.syncAllClients)(io, clientsInfo);
        },
        requestRoomAccess: (roomId) => __awaiter(this, void 0, void 0, function* () {
            var _a;
            try {
                // Validate input
                if (!roomId || typeof roomId !== 'string' || roomId.length === 0) {
                    socket.emit('room_error', 'Invalid room ID');
                    return;
                }
                // Check SFU availability
                if (!sfuClient) {
                    consola_1.default.error(`SFU client not available for room access request from ${clientId}`);
                    socket.emit('room_error', 'Voice service unavailable');
                    return;
                }
                if (!sfuClient.isConnected()) {
                    consola_1.default.error(`SFU not connected for room access request from ${clientId}`);
                    socket.emit('room_error', 'Voice service temporarily unavailable');
                    return;
                }
                consola_1.default.info(`Processing room access request: ${clientId} -> ${roomId}`);
                // Create unique room ID by prefixing with server ID
                const serverId = ((_a = process.env.SERVER_NAME) === null || _a === void 0 ? void 0 : _a.replace(/\s+/g, '_').toLowerCase()) || 'unknown_server';
                const uniqueRoomId = `${serverId}_${roomId}`;
                // Register room with SFU using unique room ID
                yield sfuClient.registerRoom(uniqueRoomId);
                // Generate secure join token with unique room ID
                const joinToken = sfuClient.generateClientJoinToken(uniqueRoomId, clientId);
                // Send structured response to client with unique room ID
                socket.emit('room_access_granted', {
                    room_id: uniqueRoomId,
                    join_token: joinToken,
                    sfu_url: process.env.SFU_WS_HOST,
                    timestamp: Date.now(),
                });
                consola_1.default.success(`Room access granted: ${clientId} -> ${uniqueRoomId} (original: ${roomId})`);
            }
            catch (error) {
                consola_1.default.error(`Room access error for ${clientId}:`, error);
                const errorMessage = error instanceof Error ? error.message : 'Failed to grant room access';
                socket.emit('room_error', errorMessage);
            }
        }),
        joinedChannel: (hasJoined) => {
            if (!clientsInfo[clientId])
                return;
            const wasInChannel = clientsInfo[clientId].hasJoinedChannel;
            clientsInfo[clientId].hasJoinedChannel = Boolean(hasJoined);
            // Reset voice connection status when leaving channel
            if (!hasJoined) {
                clientsInfo[clientId].isConnectedToVoice = false;
            }
            (0, clients_1.syncAllClients)(io, clientsInfo);
            consola_1.default.info(`Client ${clientId} channel status: ${hasJoined ? 'joined' : 'left'}`);
            // Emit peer join/leave events to other clients for sound notifications
            if (hasJoined && !wasInChannel) {
                socket.broadcast.emit('peerJoinedRoom', { clientId, nickname: clientsInfo[clientId].nickname });
            }
            else if (!hasJoined && wasInChannel) {
                socket.broadcast.emit('peerLeftRoom', { clientId, nickname: clientsInfo[clientId].nickname });
            }
        },
        peerVoiceConnected: (streamId) => {
            // Find the client with this stream ID and mark them as voice connected
            const clientWithStream = Object.keys(clientsInfo).find(id => clientsInfo[id].streamID === streamId);
            if (clientWithStream && clientsInfo[clientWithStream]) {
                clientsInfo[clientWithStream].isConnectedToVoice = true;
                (0, clients_1.syncAllClients)(io, clientsInfo);
                consola_1.default.info(`Client ${clientWithStream} voice connection established`);
            }
        },
        peerVoiceDisconnected: (streamId) => {
            // Find the client with this stream ID and mark them as voice disconnected
            const clientWithStream = Object.keys(clientsInfo).find(id => clientsInfo[id].streamID === streamId);
            if (clientWithStream && clientsInfo[clientWithStream]) {
                clientsInfo[clientWithStream].isConnectedToVoice = false;
                (0, clients_1.syncAllClients)(io, clientsInfo);
                consola_1.default.info(`Client ${clientWithStream} voice connection lost`);
            }
        },
    };
    // Set up base socket event handlers
    socket.on("error", (error) => {
        consola_1.default.error(`Socket error from ${clientId}:`, error);
    });
    socket.on("info", () => {
        (0, server_1.sendInfo)(socket);
    });
    socket.on("disconnect", (reason) => {
        consola_1.default.info(`Client disconnected: ${clientId} (${reason})`);
        delete clientsInfo[clientId];
        (0, clients_1.syncAllClients)(io, clientsInfo);
    });
    // Send initial info
    (0, server_1.sendInfo)(socket);
    // Authenticate client
    const clientToken = (_a = socket.handshake.auth) === null || _a === void 0 ? void 0 : _a.token;
    const expectedToken = process.env.SERVER_TOKEN;
    if (!expectedToken) {
        consola_1.default.error("SERVER_TOKEN not configured!");
        socket.disconnect(true);
        return;
    }
    if (clientToken !== expectedToken) {
        consola_1.default.warn(`Authentication failed for ${clientId}`);
        socket.emit('auth_error', 'Invalid authentication token');
        socket.disconnect(true);
        return;
    }
    // Client authenticated successfully
    consola_1.default.success(`Client authenticated: ${clientId}`);
    // Initialize client info
    clientsInfo[clientId] = {
        nickname: "User",
        isMuted: false,
        color: colors_1.colors[Math.floor(Math.random() * colors_1.colors.length)],
        streamID: "",
        hasJoinedChannel: false,
        isConnectedToVoice: false,
    };
    // Send client verification and details
    (0, clients_1.verifyClient)(socket);
    (0, server_1.sendServerDetails)(socket, clientsInfo);
    (0, clients_1.syncAllClients)(io, clientsInfo);
    // Register all event handlers
    Object.entries(eventHandlers).forEach(([event, handler]) => {
        socket.on(event, handler);
    });
    consola_1.default.info(`Client ${clientId} fully initialized`);
}
