import { getUniqueID } from "./clientUtils";
import { Clients } from "../types";
import { colors } from "./colors";
import consola from "consola";
import { config } from "dotenv";
import { DefaultEventsMap, Server, Socket } from "socket.io";
config();

const clientsInfo: Clients = {};

const sfu_host = process.env.SFU_WS_HOST;
const stun_hosts = process.env.STUN_SERVERS?.split(",") || [];

if (!sfu_host) {
  consola.error("Missing SFU WebSocket Host! No voice activity will work.");
}

if (stun_hosts.length === 0) {
  consola.error("Missing STUN servers! SFU can't reach all clients.");
}

export function socketHandler(io: Server, socket: Socket) {
  const id = getUniqueID();

  function syncAllClients() {
    io.to("verifiedClients").emit("message", {
      message: "clients",
      value: clientsInfo,
    });
  }

  function verifyClient() {
    socket.join("verifiedClients");
  }

  function unverifyClient() {
    socket.leave("verifiedClients");
  }

  // function messageHandler(json: { message: string; value: any }) {
  //   console.log("User attempted to send message: ", json);

  //   if (json.message === "updateNickname") {
  //     clientsInfo[id] = {
  //       ...clientsInfo[id],
  //       nickname: json.value,
  //     };
  //     syncAllClients();
  //   }

  //   if (json.message === "updateMuted") {
  //     clientsInfo[id] = {
  //       ...clientsInfo[id],
  //       isMuted: json.value,
  //     };
  //     syncAllClients();
  //   }

  //   if (json.message === "streamID") {
  //     // communicate with SFU and bind user ID to stream ID, then update all users
  //     clientsInfo[id] = {
  //       ...clientsInfo[id],
  //       streamID: json.value,
  //     };
  //     syncAllClients();
  //   }

  //   if (json.message === "joinedChannel") {
  //     clientsInfo[id] = {
  //       ...clientsInfo[id],
  //       hasJoinedChannel: json.value,
  //     };
  //     syncAllClients();
  //   }
  // }

  function sendJson(obj: any) {
    socket.send(JSON.stringify(obj));
  }

  clientsInfo[id] = {
    nickname: "Unknown",
    isMuted: false,
    color: colors[Math.floor(Math.random() * colors.length)],
    streamID: "",
    hasJoinedChannel: false,
  };

  consola.info("Peer connected", id);

  socket.on("error", consola.error);

  function sendInfo() {
    console.log("Sending info");

    socket.emit("info", {
      name: process.env.SERVER_NAME || "Unknown",
      members: "23",
      icon: process.env.SERVER_ICON || "",
    });
  }
  sendInfo();
  socket.on("info", sendInfo);

  socket.on("close", (code, reason) => {
    consola.fail("Peer disconnected", id, code, reason);
    delete clientsInfo[id];
    syncAllClients();
  });

  sendJson({
    message: "yourID",
    value: id,
  });

  syncAllClients();
}
