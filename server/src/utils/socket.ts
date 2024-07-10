import { getUniqueID } from "./clientUtils";
import { Clients } from "../types";
import { colors } from "./colors";
import consola from "consola";
import WebSocket from "ws";
import { IncomingMessage } from "http";

const clients: Clients = {};

export function socketHandler(
  wss: WebSocket.Server<typeof WebSocket, typeof IncomingMessage>,
  ws: WebSocket
) {
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
  }

  function sendJson(obj: any) {
    ws.send(JSON.stringify(obj));
  }

  const id = getUniqueID();
  clients[id] = {
    nickname: "Unknown",
    isSpeaking: false,
    isMuted: true,
    color: colors[Math.floor(Math.random() * colors.length)],
  };
  consola.info("Peer connected", id);

  ws.on("error", consola.error);

  ws.on("message", (data: string) => {
    consola.info("received: %s", data);
    const json: { message: string; value: any } = JSON.parse(data);
    messageHandler(json);
  });

  ws.on("close", (code, reason) => {
    consola.fail("Peer disconnected", id);
    delete clients[id];
    sendNewClientInfo();
  });

  sendJson({
    message: "yourID",
    value: id,
  });

  sendNewClientInfo();
}
