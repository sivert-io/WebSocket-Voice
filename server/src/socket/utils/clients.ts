import { Server, Socket } from "socket.io";
import { Clients } from "../../types";
import { getAllRegisteredUsers } from "../../db/scylla";

export function verifyClient(socket: Socket) {
  socket.join("verifiedClients");
}

export function unverifyClient(socket: Socket) {
  socket.leave("verifiedClients");
}

// Simple debounce map per io instance
const lastEmitAtByIO = new WeakMap<Server, number>();
const EMIT_MIN_INTERVAL_MS = 50; // coalesce bursts within 50ms

export function syncAllClients(io: Server, clientsInfo: Clients) {
  const now = Date.now();
  const last = lastEmitAtByIO.get(io) || 0;
  if (now - last < EMIT_MIN_INTERVAL_MS) {
    return; // skip burst
  }
  lastEmitAtByIO.set(io, now);

  // Filter to only include registered users (those with real serverUserId, not temp IDs)
  const registeredClients: Clients = {};
  Object.entries(clientsInfo).forEach(([clientId, client]) => {
    // Only include clients who have been properly registered in the database
    // (i.e., have a real serverUserId that doesn't start with "temp_")
    if (client.serverUserId && !client.serverUserId.startsWith('temp_')) {
      registeredClients[clientId] = client;
    }
  });

  console.log(`📡 SYNC ALL CLIENTS - Broadcasting registered users to verifiedClients:`, {
    totalClients: Object.keys(clientsInfo).length,
    registeredClients: Object.keys(registeredClients).length,
    clientSummary: Object.entries(registeredClients).map(([id, client]) => ({
      id,
      serverUserId: client.serverUserId,
      nickname: client.nickname,
      hasJoinedChannel: client.hasJoinedChannel,
      isConnectedToVoice: client.isConnectedToVoice,
      streamID: client.streamID,
      isMuted: client.isMuted,
      isDeafened: client.isDeafened,
    })),
    timestamp: now
  });
  
  io.to("verifiedClients").emit("clients", registeredClients);
}

export async function broadcastMemberList(io: Server, clientsInfo: Clients) {
  try {
    // Get all registered users from database
    const registeredUsers = await getAllRegisteredUsers();
    
    // Create a map of online users by serverUserId
    const onlineUsers = new Map<string, any>();
    Object.values(clientsInfo).forEach(client => {
      if (client.serverUserId && !client.serverUserId.startsWith('temp_')) {
        onlineUsers.set(client.serverUserId, client);
      }
    });
    
    // Combine registered users with online status, filtering out inactive users
    const members = registeredUsers
      .filter(user => user.is_active) // Only include active users
      .map(user => {
        const onlineClient = onlineUsers.get(user.server_user_id);
        
        let status: 'online' | 'in_voice' | 'afk' | 'offline' = 'offline';
        if (onlineClient) {
          if (onlineClient.isAFK) {
            status = 'afk';
          } else if (onlineClient.isConnectedToVoice && onlineClient.hasJoinedChannel) {
            status = 'in_voice';
          } else {
            status = 'online';
          }
        }
        
        return {
          serverUserId: user.server_user_id,
          nickname: user.nickname,
          status,
          lastSeen: user.last_seen,
          isMuted: onlineClient?.isMuted || false,
          isDeafened: onlineClient?.isDeafened || false,
          color: onlineClient?.color || '#666666',
          isConnectedToVoice: onlineClient?.isConnectedToVoice || false,
          hasJoinedChannel: onlineClient?.hasJoinedChannel || false,
          streamID: onlineClient?.streamID || '',
        };
      });
    
    console.log(`📡 Broadcasting member list with ${members.length} registered users to verifiedClients`);
    io.to("verifiedClients").emit("members:list", members);
  } catch (error) {
    console.error('Failed to broadcast member list:', error);
  }
}
