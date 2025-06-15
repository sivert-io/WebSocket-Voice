"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
var _a;
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv_1 = require("dotenv");
(0, dotenv_1.config)({ override: false }); // Load environment variables from .env file
const consola_1 = require("consola");
const socket_1 = require("./socket");
const http_1 = require("http");
const socket_io_1 = require("socket.io");
const express_1 = __importDefault(require("express")); // Import express
const client_1 = require("./sfu/client"); // Import SFU client
const app = (0, express_1.default)(); // Create an Express app
// Initialize SFU client if host is configured
let sfuClient = null;
if (process.env.SFU_WS_HOST) {
    const serverId = ((_a = process.env.SERVER_NAME) === null || _a === void 0 ? void 0 : _a.replace(/\s+/g, '_').toLowerCase()) || 'unknown_server';
    const serverToken = process.env.SERVER_TOKEN || 'default_token';
    sfuClient = new client_1.SFUClient(serverId, serverToken, process.env.SFU_WS_HOST);
    // Connect to SFU server
    sfuClient.connect().catch((error) => {
        consola_1.consola.error('Failed to connect to SFU:', error);
    });
}
else {
    consola_1.consola.error("No SFU host defined! Server will not send or retrieve streams.");
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
const httpServer = (0, http_1.createServer)(app); // Pass the Express app to createServer
const io = new socket_io_1.Server(httpServer, {
    cors: {
        origin: process.env.CORS_ORIGIN || "https://app.gryt.chat",
    },
});
io.on("connection", (socket) => {
    (0, socket_1.socketHandler)(io, socket, sfuClient);
});
const PORT = process.env.PORT || 5000;
httpServer.listen(PORT, () => {
    consola_1.consola.start(`Starting ${process.env.SERVER_NAME}...`);
    consola_1.consola.info("Using icon", serverIconPath);
    if (process.env.SFU_WS_HOST)
        consola_1.consola.info("SFU host set to " + process.env.SFU_WS_HOST);
    consola_1.consola.success("Signaling server started at port", PORT);
});
