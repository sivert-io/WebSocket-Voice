import { WebSocketServer } from "ws";
import { consola } from "consola";
import { config } from "dotenv";
import { socketHandler } from "./utils/socket";
config();

consola.start("Starting signaling server...");
var PORT = 5000;

if (process.env.PORT) PORT = Number(process.env.PORT);
else consola.warn("Missing Environment Variable PORT!");

if (!process.env.SFU_WS_HOST)
  consola.error(
    "No SFU host defined! Server will not send or retrieve streams.",
  );
else {
  consola.success("SFU host set to " + process.env.SFU_WS_HOST);
}

const wss = new WebSocketServer({ port: PORT });

wss.on("connection", (ws) => socketHandler(wss, ws));

consola.success("Signaling server started at port", PORT);
