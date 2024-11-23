import { config } from "dotenv";
config({ override: false }); // Load environment variables from .env file
import { consola } from "consola";
import { socketHandler } from "./socket";
import { createServer } from "http";
import { Server } from "socket.io";
import express from "express"; // Import express

const app = express(); // Create an Express app

if (!process.env.SFU_WS_HOST) {
  consola.error(
    "No SFU host defined! Server will not send or retrieve streams."
  );
}

// Serve static files from the "public" directory
const publicFolderPath = "public"; // Adjust the path if necessary

// Serve the file specified by the SERVER_ICON environment variable at the /icon route
const serverIconPath = process.env.SERVER_ICON || "default-icon.png"; // Default icon if not set
app.get("/icon", (req, res) => {
  res.sendFile(serverIconPath, { root: publicFolderPath }, (err) => {
    if (err) {
      console.error("Error serving the icon:", err.message);
      res.status(404).send("Icon not found");
    }
  });
});

const httpServer = createServer(app); // Pass the Express app to createServer
const io = new Server(httpServer, {
  cors: {
    origin: process.env.CORS_ORIGIN || "https://app.gryt.chat",
  },
});

io.on("connection", (socket) => {
  socketHandler(io, socket);
});

const PORT = process.env.PORT || 5000;

httpServer.listen(PORT, () => {
  consola.start(`Starting ${process.env.SERVER_NAME}...`);
  consola.info("Using icon", serverIconPath);
  process.env.SFU_WS_HOST &&
    consola.info("SFU host set to " + process.env.SFU_WS_HOST);
  consola.success("Signaling server started at port", PORT);
});
