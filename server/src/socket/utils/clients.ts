import { Server, Socket } from "socket.io";
import { Clients } from "../../types";

export function verifyClient(socket: Socket) {
  socket.join("verifiedClients");
}

export function unverifyClient(socket: Socket) {
  socket.leave("verifiedClients");
}

export function syncAllClients(io: Server, clientsInfo: Clients) {
  console.log(`📡 SYNC ALL CLIENTS - Broadcasting to verifiedClients:`, {
    totalClients: Object.keys(clientsInfo).length,
    clientSummary: Object.entries(clientsInfo).map(([id, client]) => ({
      id,
      nickname: client.nickname,
      hasJoinedChannel: client.hasJoinedChannel,
      isConnectedToVoice: client.isConnectedToVoice,
      streamID: client.streamID,
      isMuted: client.isMuted,
      isDeafened: client.isDeafened,
    })),
    timestamp: Date.now(),
    callStack: new Error().stack?.split('\n')[2]?.trim() // Show where this was called from
  });
  
  io.to("verifiedClients").emit("clients", clientsInfo);
}
