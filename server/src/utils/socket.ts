import { getUniqueID } from "./clientUtils";
import { Clients } from "../types";
import { colors } from "./colors";
import consola from "consola";
import WebSocket from "ws";
import { IncomingMessage } from "http";
import { config } from "dotenv";
config();

const clients: Clients = {};

export function socketHandler(
  wss: WebSocket.Server<typeof WebSocket, typeof IncomingMessage>,
  ws: WebSocket
) {
  const id = getUniqueID();

  if (!process.env.SFU_WS_HOST) {
    consola.error("Missing SFU WebSocket Host! No streams will be forwarded");
    ws.send(
      JSON.stringify({
        message: "sfu_host",
        value: null,
      })
    );
  } else {
    ws.send(
      JSON.stringify({
        message: "sfu_host",
        value: process.env.SFU_WS_HOST,
      })
    );
  }

  if (!process.env.STUN_SERVERS) {
    consola.error("Missing STUN servers! SFU may be unable to reach clients");
  } else {
    ws.send(
      JSON.stringify({
        message: "stun_hosts",
        value: process.env.STUN_SERVERS,
      })
    );
  }

  function sendNewClientInfo() {
    wss.clients.forEach((client) => {
      client.send(
        JSON.stringify({
          message: "peers",
          value: clients,
        })
      );
    });
  }

  function messageHandler(json: { message: string; value: any }) {
    console.log("User attempted to send message: ", json);

    if (json.message === "updateNickname") {
      clients[id] = {
        ...clients[id],
        nickname: json.value,
      };
      sendNewClientInfo();
    }

    if (json.message === "updateMuted") {
      clients[id] = {
        ...clients[id],
        isMuted: json.value,
      };
      sendNewClientInfo();
    }

    if (json.message === "streamID") {
      // communicate with SFU and bind user ID to stream ID, then update all users
      clients[id] = {
        ...clients[id],
        streamID: json.value,
      };
      sendNewClientInfo();
    }
  }

  function sendJson(obj: any) {
    ws.send(JSON.stringify(obj));
  }

  clients[id] = {
    nickname: "Unknown",
    isMuted: false,
    color: colors[Math.floor(Math.random() * colors.length)],
    streamID: "",
  };

  consola.info("Peer connected", id);

  ws.on("error", consola.error);

  ws.on("message", (data: string) => {
    consola.info("received: %s", data);
    const json: { message: string; value: any } = JSON.parse(data);
    messageHandler(json);
  });

  ws.on("close", (code, reason) => {
    consola.fail("Peer disconnected", id, code, reason);
    delete clients[id];
    sendNewClientInfo();
  });

  sendJson({
    message: "yourID",
    value: id,
  });

  sendNewClientInfo();
}
