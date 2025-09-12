import { Clients } from "../types";
import { colors } from "../utils/colors";
import consola from "consola";
import { Server, Socket } from "socket.io";
import { syncAllClients, verifyClient } from "./utils/clients";
import { sendInfo, sendServerDetails } from "./utils/server";
import { SFUClient } from "../sfu/client";
import { insertMessage, listMessages, MessageRecord, upsertUser, getUserByGrytId, getUserByServerId } from "../db/scylla";
import { generateAccessToken, verifyAccessToken, refreshToken, TokenPayload } from "../utils/jwt";
import { verifyJoinToken } from "../services/grytAuth";

import { randomUUID } from "crypto";

const clientsInfo: Clients = {};

// Simple in-memory message cache with TTL
const MESSAGE_CACHE_TTL_MS = parseInt(process.env.MESSAGE_CACHE_TTL_MS || "30000");
const messageCache: { [conversationId: string]: { items: MessageRecord[]; fetchedAt: number } } = {};

async function getMessagesCached(conversationId: string, limit = 50): Promise<MessageRecord[]> {
  const now = Date.now();
  const cached = messageCache[conversationId];
  if (cached && now - cached.fetchedAt < MESSAGE_CACHE_TTL_MS) {
    return cached.items.slice(0, limit);
  }
  const items = await listMessages(conversationId, limit);
  messageCache[conversationId] = { items, fetchedAt: now };
  return items;
}

export function socketHandler(io: Server, socket: Socket, sfuClient: SFUClient | null) {
  const clientId = socket.id;
  consola.info(`Client connected: ${clientId}`);

  // Enhanced event handlers with better error handling and validation
  const eventHandlers: { [event: string]: (...args: any[]) => void } = {
    // Join server with join token
    'server:join': async (payload: { joinToken: string; nickname?: string; serverToken?: string }) => {
      try {
        consola.info(`📥 Received server:join from client ${clientId}:`, {
          hasJoinToken: !!payload?.joinToken,
          hasNickname: !!payload?.nickname,
          hasServerToken: !!payload?.serverToken
        });
        
        if (!payload || typeof payload.joinToken !== 'string') {
          socket.emit('server:error', 'Invalid join payload - joinToken required');
          return;
        }
        
        // Validate server token if provided
        const expectedServerToken = process.env.SERVER_TOKEN;
        if (expectedServerToken && (!payload.serverToken || payload.serverToken !== expectedServerToken)) {
          consola.warn(`❌ Invalid server token from client ${clientId}`);
          socket.emit('server:error', 'token_invalid');
          return;
        }
        
        // Verify the join token with Gryt Auth
        const verification = await verifyJoinToken(payload.joinToken, socket.handshake.headers.host);
        
        if (!verification.valid || !verification.user) {
          consola.warn(`❌ Invalid join token from client ${clientId}`);
          socket.emit('server:error', verification.error || 'Invalid join token');
          return;
        }
        
        const grytUserId = verification.user.userId;
        const nickname = payload.nickname || verification.user.nickname || 'Anonymous';
        
        if (nickname.length > 50) {
          socket.emit('server:error', 'Nickname too long (max 50 characters)');
          return;
        }
        
        // Register or update user in database
        const user = await upsertUser(grytUserId, nickname.trim());
        consola.success(`👤 User joined: ${user.gryt_user_id} as "${user.nickname}" with server ID ${user.server_user_id}`);
        
        // Generate access token for this server
        const tokenPayload: TokenPayload = {
          grytUserId: user.gryt_user_id,
          serverUserId: user.server_user_id,
          nickname: user.nickname,
          serverHost: socket.handshake.headers.host || 'unknown'
        };
        
        const accessToken = generateAccessToken(tokenPayload);
        
        // Update client info
        if (clientsInfo[clientId]) {
          clientsInfo[clientId].grytUserId = user.gryt_user_id;
          clientsInfo[clientId].serverUserId = user.server_user_id;
          clientsInfo[clientId].nickname = user.nickname;
          clientsInfo[clientId].accessToken = accessToken;
          clientsInfo[clientId].serverToken = payload.serverToken; // Store server token
        }
        
        // Send back access token and user info
        const joinResponse = {
          accessToken,
          nickname: user.nickname
        };
        
        consola.info(`📤 Emitting server:joined to client ${clientId}`);
        socket.emit('server:joined', joinResponse);
        // After successful join, send server details (channels, config) now that token is present
        try {
          sendServerDetails(socket, clientsInfo);
        } catch (detailsErr) {
          consola.error('Failed to send server details after join:', detailsErr);
        }
        syncAllClients(io, clientsInfo);
      } catch (err) {
        consola.error('server:join failed', err);
        socket.emit('server:error', 'Failed to join server');
      }
    },

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

    updateAFK: (isAFK: boolean) => {
      if (!clientsInfo[clientId]) return;
      
      clientsInfo[clientId].isAFK = Boolean(isAFK);
      syncAllClients(io, clientsInfo);
      consola.info(`Client ${clientId} ${isAFK ? 'went AFK' : 'returned from AFK'}`);
    },

    streamID: (streamID: string) => {
      if (!clientsInfo[clientId]) return;
      
      const wasInChannel = clientsInfo[clientId].hasJoinedChannel;
      const newJoinedState = streamID.length > 0;
      
      console.log(`🎪 SERVER streamID [${clientId}]:`, {
        nickname: clientsInfo[clientId].nickname,
        oldStreamID: clientsInfo[clientId].streamID,
        newStreamID: streamID,
        wasInChannel,
        newJoinedState,
        stateWillChange: wasInChannel !== newJoinedState,
        timestamp: Date.now()
      });
      
      const prevStreamID = clientsInfo[clientId].streamID;
      const prevJoinedState = wasInChannel;

      // No-op guard: if neither streamID nor join state changed, skip sync
      if (prevStreamID === streamID && prevJoinedState === newJoinedState) {
        consola.debug(`streamID handler no-op for ${clientId} (unchanged)`);
        return;
      }

      clientsInfo[clientId].streamID = streamID;
      clientsInfo[clientId].hasJoinedChannel = newJoinedState;
      
      // Only sync and log if the channel join state actually changed
      const stateChanged = wasInChannel !== newJoinedState;
      if (stateChanged) {
        if (!wasInChannel && newJoinedState) {
          consola.info(`Client ${clientId} joined voice channel`);
        } else if (wasInChannel && !newJoinedState) {
          consola.info(`Client ${clientId} left voice channel`);
        }
        console.log(`📡 SERVER syncAllClients triggered by streamID [${clientId}] - STATE CHANGED`);
        syncAllClients(io, clientsInfo);
      } else {
        // Only streamID changed; avoid spamming by not broadcasting if identical
        console.log(`📡 SERVER streamID changed only [${clientId}] - broadcasting`);
        syncAllClients(io, clientsInfo);
      }
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
      const newJoinedState = Boolean(hasJoined);
      
      console.log(`🎪 SERVER joinedChannel [${clientId}]:`, {
        nickname: clientsInfo[clientId].nickname,
        hasJoined,
        wasInChannel,
        newJoinedState,
        stateWillChange: wasInChannel !== newJoinedState,
        currentStreamID: clientsInfo[clientId].streamID,
        timestamp: Date.now()
      });
      
      // Only update if state actually changed
      if (wasInChannel === newJoinedState) {
        console.log(`🎪 SERVER joinedChannel [${clientId}] - NO CHANGE, SKIPPING`);
        consola.debug(`Client ${clientId} joinedChannel: no state change (${newJoinedState})`);
        return;
      }
      
      clientsInfo[clientId].hasJoinedChannel = newJoinedState;
      
      // Reset voice connection status when leaving channel
      if (!newJoinedState) {
        clientsInfo[clientId].isConnectedToVoice = false;
      }
      
      console.log(`📡 SERVER syncAllClients triggered by joinedChannel [${clientId}] - STATE CHANGED`);
      syncAllClients(io, clientsInfo);
      consola.info(`Client ${clientId} channel status: ${newJoinedState ? 'joined' : 'left'}`);
      
      // Emit peer join/leave events to other clients for sound notifications
      if (newJoinedState && !wasInChannel) {
        socket.broadcast.emit('peerJoinedRoom', { clientId, nickname: clientsInfo[clientId].nickname });
      } else if (!newJoinedState && wasInChannel) {
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

    // Real-time chat: persist and broadcast
    'chat:send': async (payload: { conversationId: string; accessToken: string; text?: string; attachments?: string[] }) => {
      try {
        consola.info(`💬 chat:send from ${clientId}`, {
          conversationId: payload?.conversationId,
          textLen: typeof payload?.text === 'string' ? payload.text.length : 0,
          hasAttachments: Array.isArray(payload?.attachments) && payload.attachments.length > 0,
          hasToken: !!payload?.accessToken,
        });
        
        if (!payload || typeof payload.conversationId !== 'string' || typeof payload.accessToken !== 'string') {
          socket.emit('chat:error', 'Invalid payload - accessToken required');
          return;
        }
        
        // Verify the access token
        const tokenPayload = verifyAccessToken(payload.accessToken);
        if (!tokenPayload) {
          consola.warn(`❌ Invalid access token from client ${clientId}`);
          socket.emit('chat:error', 'Invalid access token');
          return;
        }
        
        // Check if token is for this server
        if (tokenPayload.serverHost !== socket.handshake.headers.host) {
          consola.warn(`❌ Token server mismatch: ${tokenPayload.serverHost} vs ${socket.handshake.headers.host}`);
          socket.emit('chat:error', 'Invalid access token for this server');
          return;
        }
        
        const text = typeof payload.text === 'string' ? payload.text.trim() : '';
        const attachments = Array.isArray(payload.attachments) ? payload.attachments : null;
        if (!text && (!attachments || attachments.length === 0)) {
          socket.emit('chat:error', 'Message is empty');
          return;
        }
        
        // Get user info for the sender
        const user = await getUserByServerId(tokenPayload.serverUserId);
        if (!user) {
          socket.emit('chat:error', 'User not found. Please rejoin the server.');
          return;
        }
        
        consola.info(`✅ Message from user ${user.nickname} (verified via JWT)`);
        
        const created = await insertMessage({
          conversation_id: payload.conversationId,
          sender_server_id: tokenPayload.serverUserId,
          sender_nickname: user.nickname,
          text: text || null,
          attachments: attachments && attachments.length > 0 ? attachments : null,
        });
        consola.success(`💾 chat:send persisted`, { conversation_id: created.conversation_id, message_id: created.message_id });
        // Update cache with new message (front-append; DB returns asc, but cache order isn't strict)
        const existing = messageCache[created.conversation_id];
        const items = existing?.items ? [...existing.items, created] : [created];
        messageCache[created.conversation_id] = { items, fetchedAt: Date.now() };
        // Broadcast to all clients for now; clients can filter by conversationId
        consola.info(`📢 Broadcasting chat:new to all clients`, { 
          message_id: created.message_id, 
          conversation_id: created.conversation_id,
          totalClients: io.engine.clientsCount 
        });
        io.emit('chat:new', created);
      } catch (err) {
        consola.error('chat:send failed (DB issue?)', err);
        // Fallback: still broadcast an ephemeral message so chat remains responsive
        try {
          const now = new Date();
          const fallback = {
            conversation_id: payload?.conversationId || 'unknown',
            sender_server_id: clientId, // Use client ID as fallback
            text: (payload?.text || '').toString(),
            attachments: Array.isArray(payload?.attachments) && payload!.attachments!.length > 0 ? payload!.attachments! : null,
            message_id: randomUUID(),
            created_at: now,
            ephemeral: true,
          } as any;
          io.emit('chat:new', fallback);
          socket.emit('chat:error', 'Message not persisted (temporary server storage issue)');
        } catch (emitErr) {
          consola.error('chat:send fallback emit failed', emitErr);
          socket.emit('chat:error', 'Failed to send message');
        }
      }
    },

    // Fetch recent messages for a conversation (served from cache when fresh)
    'chat:fetch': async (payload: { conversationId: string; limit?: number }) => {
      try {
        if (!payload || typeof payload.conversationId !== 'string') {
          socket.emit('chat:error', 'Invalid fetch payload');
          return;
        }
        const limit = typeof payload.limit === 'number' ? payload.limit : 50;
        const items = await getMessagesCached(payload.conversationId, limit);
        socket.emit('chat:history', { conversation_id: payload.conversationId, items });
      } catch (err) {
        consola.error('chat:fetch failed', err);
        socket.emit('chat:error', 'Failed to fetch messages');
      }
    },

    // Refresh access token
    'token:refresh': async (payload: { accessToken: string }) => {
      try {
        if (!payload || typeof payload.accessToken !== 'string') {
          socket.emit('token:error', 'Invalid refresh payload');
          return;
        }
        
        const newToken = refreshToken(payload.accessToken);
        if (!newToken) {
          socket.emit('token:error', 'Invalid access token');
          return;
        }
        
        // Update client info with new token
        if (clientsInfo[clientId]) {
          clientsInfo[clientId].accessToken = newToken;
        }
        
        consola.info(`🔄 Token refreshed for client ${clientId}`);
        socket.emit('token:refreshed', { accessToken: newToken });
      } catch (err) {
        consola.error('token:refresh failed', err);
        socket.emit('token:error', 'Failed to refresh token');
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
  
  consola.info(`🔐 Auth check for ${clientId}:`, {
    clientToken: clientToken ? 'present' : 'missing',
    expectedToken: expectedToken ? 'configured' : 'missing',
    authObject: socket.handshake.auth
  });

  if (!expectedToken) {
    consola.error("SERVER_TOKEN not configured!");
    socket.disconnect(true);
    return;
  }

  if (clientToken !== expectedToken) {
    consola.warn(`❌ Authentication failed for ${clientId}:`, {
      clientToken,
      expectedToken,
      match: clientToken === expectedToken
    });
    socket.emit('auth_error', 'Invalid authentication token');
    socket.disconnect(true);
    return;
  }

  // Client authenticated successfully
  consola.success(`Client authenticated: ${clientId}`);

  // Initialize client info
  clientsInfo[clientId] = {
    serverUserId: `temp_${clientId}`, // Temporary ID until user registers
    nickname: "User",
    isMuted: false,
    isDeafened: false,
    color: colors[Math.floor(Math.random() * colors.length)],
    streamID: "",
    hasJoinedChannel: false,
    isConnectedToVoice: false,
    isAFK: false,
  };

  // Check if client has a valid access token
  const clientAccessToken = socket.handshake.auth?.accessToken;
  if (clientAccessToken) {
    const tokenPayload = verifyAccessToken(clientAccessToken);
    if (tokenPayload && tokenPayload.serverHost === socket.handshake.headers.host) {
      consola.info(`✅ Client ${clientId} has valid access token`);
      // Update client info with token data
      clientsInfo[clientId].accessToken = clientAccessToken;
      // We could also update nickname from token if needed
    } else {
      consola.warn(`⚠️ Client ${clientId} has invalid access token - will need to rejoin`);
    }
  } else {
    consola.info(`ℹ️ Client ${clientId} has no access token - will need to join server`);
  }

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
