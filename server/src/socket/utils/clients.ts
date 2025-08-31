import { Server, Socket } from "socket.io";
import { Clients } from "../../types";

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
    timestamp: now,
    callStack: new Error().stack?.split('\n')[2]?.trim()
  });
  
  io.to("verifiedClients").emit("clients", clientsInfo);
}
