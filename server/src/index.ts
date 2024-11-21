import { consola } from "consola";
import { config } from "dotenv";
import { socketHandler } from "./socket";
import { createServer } from "http";
import { Server } from "socket.io";
config();

if (!process.env.SFU_WS_HOST)
  consola.error(
    "No SFU host defined! Server will not send or retrieve streams."
  );
else {
  consola.success("SFU host set to " + process.env.SFU_WS_HOST);
}

const httpServer = createServer();
const io = new Server(httpServer, {
  cors: {
    origin: process.env.CORS_ORIGIN || "https://app.gryt.chat",
  },
});

io.on("connection", (socket) => {
  socketHandler(io, socket);
});

const PORT = process.env.PORT || 5000;

httpServer.listen(PORT);

consola.start("Starting signaling server...");

consola.success("Signaling server started at port", PORT);
