import { Clients } from "../types";
import { colors } from "../utils/colors";
import consola from "consola";
import { Server, Socket } from "socket.io";
import { syncAllClients, verifyClient } from "./utils/clients";
import { sendInfo, sendServerDetails } from "./utils/server";
import { SFUClient } from "../sfu/client";

const clientsInfo: Clients = {};

export function socketHandler(io: Server, socket: Socket, sfuClient: SFUClient | null) {
  const clientId = socket.id;
  consola.info(`Client connected: ${clientId}`);

  // Enhanced event handlers with better error handling and validation
  const eventHandlers: { [event: string]: (...args: any[]) => void } = {
    updateNickname: (newNickName: string) => {
      if (!clientsInfo[clientId]) return;
      if (typeof newNickName !== 'string' || newNickName.length > 50) {
        socket.emit('error', 'Invalid nickname');
        return;
      }
      
      clientsInfo[clientId].nickname = newNickName.trim();
      syncAllClients(io, clientsInfo);
      consola.info(`Client ${clientId} updated nickname to: ${newNickName}`);
    },

    updateMute: (isMuted: boolean) => {
      if (!clientsInfo[clientId]) return;
      
      clientsInfo[clientId].isMuted = Boolean(isMuted);
      syncAllClients(io, clientsInfo);
      consola.info(`Client ${clientId} ${isMuted ? 'muted' : 'unmuted'}`);
    },

    updateDeafen: (isDeafened: boolean) => {
      if (!clientsInfo[clientId]) return;
      
      clientsInfo[clientId].isDeafened = Boolean(isDeafened);
      syncAllClients(io, clientsInfo);
      consola.info(`Client ${clientId} ${isDeafened ? 'deafened' : 'undeafened'}`);
    },

    streamID: (streamID: string) => {
      if (!clientsInfo[clientId]) return;
      
      const wasInChannel = clientsInfo[clientId].hasJoinedChannel;
      clientsInfo[clientId].streamID = streamID;
      clientsInfo[clientId].hasJoinedChannel = streamID.length > 0;
      
      if (!wasInChannel && streamID.length > 0) {
        consola.info(`Client ${clientId} joined voice channel`);
      } else if (wasInChannel && streamID.length === 0) {
        consola.info(`Client ${clientId} left voice channel`);
      }
      
      syncAllClients(io, clientsInfo);
    },

    requestRoomAccess: async (roomId: string) => {
      try {
        // Validate input
        if (!roomId || typeof roomId !== 'string' || roomId.length === 0) {
          socket.emit('room_error', 'Invalid room ID');
          return;
        }

        // Check SFU availability
        if (!sfuClient) {
          consola.error(`SFU client not available for room access request from ${clientId}`);
          socket.emit('room_error', 'Voice service unavailable');
          return;
        }

        if (!sfuClient.isConnected()) {
          consola.error(`SFU not connected for room access request from ${clientId}`);
          socket.emit('room_error', 'Voice service temporarily unavailable');
          return;
        }

        consola.info(`Processing room access request: ${clientId} -> ${roomId}`);

        // Create unique room ID by prefixing with server ID
        const serverId = process.env.SERVER_NAME?.replace(/\s+/g, '_').toLowerCase() || 'unknown_server';
        const uniqueRoomId = `${serverId}_${roomId}`;

        // Register room with SFU using unique room ID
        await sfuClient.registerRoom(uniqueRoomId);
        
        // Generate secure join token with unique room ID
        const joinToken = sfuClient.generateClientJoinToken(uniqueRoomId, clientId);
        
        // Send structured response to client with unique room ID
        socket.emit('room_access_granted', {
          room_id: uniqueRoomId,
          join_token: joinToken,
          sfu_url: process.env.SFU_WS_HOST,
          timestamp: Date.now(),
        });
        
        consola.success(`Room access granted: ${clientId} -> ${uniqueRoomId} (original: ${roomId})`);
        
      } catch (error) {
        consola.error(`Room access error for ${clientId}:`, error);
        const errorMessage = error instanceof Error ? error.message : 'Failed to grant room access';
        socket.emit('room_error', errorMessage);
      }
    },

    joinedChannel: (hasJoined: boolean) => {
      if (!clientsInfo[clientId]) return;
      
      const wasInChannel = clientsInfo[clientId].hasJoinedChannel;
      clientsInfo[clientId].hasJoinedChannel = Boolean(hasJoined);
      
      // Reset voice connection status when leaving channel
      if (!hasJoined) {
        clientsInfo[clientId].isConnectedToVoice = false;
      }
      
      syncAllClients(io, clientsInfo);
      consola.info(`Client ${clientId} channel status: ${hasJoined ? 'joined' : 'left'}`);
      
      // Emit peer join/leave events to other clients for sound notifications
      if (hasJoined && !wasInChannel) {
        socket.broadcast.emit('peerJoinedRoom', { clientId, nickname: clientsInfo[clientId].nickname });
      } else if (!hasJoined && wasInChannel) {
        socket.broadcast.emit('peerLeftRoom', { clientId, nickname: clientsInfo[clientId].nickname });
      }
    },

    peerVoiceConnected: (streamId: string) => {
      // Find the client with this stream ID and mark them as voice connected
      const clientWithStream = Object.keys(clientsInfo).find(id => 
        clientsInfo[id].streamID === streamId
      );
      
      if (clientWithStream && clientsInfo[clientWithStream]) {
        clientsInfo[clientWithStream].isConnectedToVoice = true;
        syncAllClients(io, clientsInfo);
        consola.info(`Client ${clientWithStream} voice connection established`);
      }
    },

    peerVoiceDisconnected: (streamId: string) => {
      // Find the client with this stream ID and mark them as voice disconnected
      const clientWithStream = Object.keys(clientsInfo).find(id => 
        clientsInfo[id].streamID === streamId
      );
      
      if (clientWithStream && clientsInfo[clientWithStream]) {
        clientsInfo[clientWithStream].isConnectedToVoice = false;
        syncAllClients(io, clientsInfo);
        consola.info(`Client ${clientWithStream} voice connection lost`);
      }
    },
  };

  // Set up base socket event handlers
  socket.on("error", (error) => {
    consola.error(`Socket error from ${clientId}:`, error);
  });

  socket.on("info", () => {
    sendInfo(socket);
  });

  socket.on("disconnect", (reason) => {
    consola.info(`Client disconnected: ${clientId} (${reason})`);
    delete clientsInfo[clientId];
    syncAllClients(io, clientsInfo);
  });

  // Send initial info
  sendInfo(socket);

  // Authenticate client
  const clientToken = socket.handshake.auth?.token;
  const expectedToken = process.env.SERVER_TOKEN;

  if (!expectedToken) {
    consola.error("SERVER_TOKEN not configured!");
    socket.disconnect(true);
    return;
  }

  if (clientToken !== expectedToken) {
    consola.warn(`Authentication failed for ${clientId}`);
    socket.emit('auth_error', 'Invalid authentication token');
    socket.disconnect(true);
    return;
  }

  // Client authenticated successfully
  consola.success(`Client authenticated: ${clientId}`);

  // Initialize client info
  clientsInfo[clientId] = {
    nickname: "User",
    isMuted: false,
    isDeafened: false,
    color: colors[Math.floor(Math.random() * colors.length)],
    streamID: "",
    hasJoinedChannel: false,
    isConnectedToVoice: false,
  };

  // Send client verification and details
  verifyClient(socket);
  sendServerDetails(socket, clientsInfo);
  syncAllClients(io, clientsInfo);

  // Register all event handlers
  Object.entries(eventHandlers).forEach(([event, handler]) => {
    socket.on(event, handler);
  });

  consola.info(`Client ${clientId} fully initialized`);
}
