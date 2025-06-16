"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.verifyClient = verifyClient;
exports.unverifyClient = unverifyClient;
exports.syncAllClients = syncAllClients;
function verifyClient(socket) {
    socket.join("verifiedClients");
}
function unverifyClient(socket) {
    socket.leave("verifiedClients");
}
function syncAllClients(io, clientsInfo) {
    var _a, _b;
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
        callStack: (_b = (_a = new Error().stack) === null || _a === void 0 ? void 0 : _a.split('\n')[2]) === null || _b === void 0 ? void 0 : _b.trim() // Show where this was called from
    });
    io.to("verifiedClients").emit("clients", clientsInfo);
}
