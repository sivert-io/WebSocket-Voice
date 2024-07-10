import { WebSocketServer } from "ws";
import { consola } from "consola";
import { config } from "dotenv";
import { socketHandler } from "./utils/socket";
config();

consola.start("Starting server...");
var PORT = 8080;
if (process.env.PORT) PORT = Number(process.env.PORT);
else consola.warn("Missing Environment Variable PORT!");
const wss = new WebSocketServer({ port: PORT });

wss.on("connection", (ws) => socketHandler(wss, ws));

consola.success("Server started at port", PORT);
