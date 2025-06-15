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
    io.to("verifiedClients").emit("clients", clientsInfo);
}
