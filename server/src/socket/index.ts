import { Clients } from "../types";
import { colors } from "../utils/colors";
import consola from "consola";
import { Server, Socket } from "socket.io";
import { syncAllClients, verifyClient } from "./utils/clients";
import { sendInfo, sendServerDetails } from "./utils/server";

const clientsInfo: Clients = {};

export function socketHandler(io: Server, socket: Socket) {
  const events: { [id: string]: (...args: any) => any } = {
    updateNickname: (newNickName: string) => {
      clientsInfo[socket.id].nickname = newNickName;
      syncAllClients(io, clientsInfo);
    },
    updateMute: (isMuted: boolean) => {
      clientsInfo[socket.id].isMuted = isMuted;
      syncAllClients(io, clientsInfo);
    },
    streamID: (streamID: string) => {
      clientsInfo[socket.id].streamID = streamID;
      clientsInfo[socket.id].hasJoinedChannel = streamID.length > 0;
      syncAllClients(io, clientsInfo);
    },
  };

  const id = socket.id;
  consola.info("Peer connected", id);
  socket.on("error", consola.error);
  socket.on("info", () => sendInfo(socket));
  socket.on("disconnect", (code, reason) => {
    consola.fail("Peer disconnected", id, code, reason);
    delete clientsInfo[id];
    syncAllClients(io, clientsInfo);
  });

  sendInfo(socket);

  if (socket.handshake.auth.token === process.env.SERVER_TOKEN) {
    consola.success("Client verified", id);
    clientsInfo[id] = {
      nickname: "Unknown",
      isMuted: false,
      color: colors[Math.floor(Math.random() * colors.length)],
      streamID: "",
      hasJoinedChannel: false,
    };

    verifyClient(socket);
    sendServerDetails(socket, clientsInfo);
    sendInfo(socket);
    syncAllClients(io, clientsInfo);

    Object.keys(events).forEach((event) => {
      socket.on(event, events[event]);
    });
  }
}
