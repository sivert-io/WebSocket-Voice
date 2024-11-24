import consola from "consola";
import { Socket } from "socket.io";
import { Clients } from "../../types";

const sfu_host = process.env.SFU_WS_HOST;
const stun_hosts = process.env.STUN_SERVERS?.split(",") || [];

if (!sfu_host) {
  consola.error("Missing SFU WebSocket Host! No voice activity will work.");
}
if (stun_hosts.length === 0) {
  consola.error("Missing STUN servers! SFU can't reach all clients.");
}

export function sendInfo(socket: Socket) {
  console.log("Sending info");

  socket.emit("info", {
    name: process.env.SERVER_NAME || "Unknown",
    members: "23",
  });
}

export function sendServerDetails(socket: Socket, clientsInfo: Clients) {
  socket.emit("details", {
    sfu_host,
    stun_hosts,
    clients: clientsInfo,
    channels: [
      {
        name: "General",
        type: "text",
        id: "general",
      },
      {
        name: "Voice Chat",
        type: "voice",
        id: "voice",
      },
    ],
  });
}
