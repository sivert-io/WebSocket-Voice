import { Server, Socket } from "socket.io";
import { Clients } from "../../types";

export function verifyClient(socket: Socket) {
  socket.join("verifiedClients");
}

export function unverifyClient(socket: Socket) {
  socket.leave("verifiedClients");
}

export function syncAllClients(io: Server, clientsInfo: Clients) {
  io.to("verifiedClients").emit("clients", clientsInfo);
}
