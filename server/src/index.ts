import { WebSocketServer } from "ws";
import { consola } from "consola";
import { config } from "dotenv";
import { socketHandler } from "./utils/socket";
config();

consola.start("Starting server...");
var PORT = 5000;

if (process.env.PORT) PORT = Number(process.env.PORT);
else consola.warn("Missing Environment Variable PORT!");

if (!process.env.SFU_HOST)
  consola.error(
    "No SFU host defined! Server will not send or retrieve streams."
  );

const wss = new WebSocketServer({ port: PORT });

wss.on("connection", (ws) => socketHandler(wss, ws));

consola.success("Server started at port", PORT);
