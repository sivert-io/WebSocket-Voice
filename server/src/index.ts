import { config } from "dotenv";
config({ override: false }); // Load environment variables from .env file
import { consola } from "consola";
import { socketHandler } from "./socket";
import { createServer } from "http";
import { Server } from "socket.io";
import express from "express"; // Import express
import { SFUClient } from "./sfu/client"; // Import SFU client
import { initScylla } from "./db/scylla";
import { initS3 } from "./storage/s3";
import { messagesRouter } from "./routes/messages";
import { uploadsRouter } from "./routes/uploads";
import { usersRouter } from "./routes/users";

const app = express(); // Create an Express app

// Parse JSON bodies
app.use(express.json({ limit: "2mb" }));

// Initialize storage and database
try {
	initS3();
	consola.success("S3 client initialized");
} catch (e) {
	consola.error("S3 initialization failed", e);
}

initScylla()
	.then(() => consola.success("ScyllaDB initialized"))
	.catch((e) => consola.error("ScyllaDB initialization failed", e));

// Initialize SFU client if host is configured
let sfuClient: SFUClient | null = null;

if (process.env.SFU_WS_HOST) {
	const serverId = process.env.SERVER_NAME?.replace(/\s+/g, '_').toLowerCase() || 'unknown_server';
	const serverToken = process.env.SERVER_TOKEN || 'default_token';
	
	sfuClient = new SFUClient(serverId, serverToken, process.env.SFU_WS_HOST);
	
	// Connect to SFU server
	sfuClient.connect().catch((error) => {
		consola.error('Failed to connect to SFU:', error);
	});
} else {
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

// API routes
app.use("/api/messages", messagesRouter);
app.use("/api/uploads", uploadsRouter);
app.use("/api/users", usersRouter);

// Basic error handler
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
	consola.error(err);
	res.status(500).json({ error: err?.message || "Internal Server Error" });
});

const httpServer = createServer(app); // Pass the Express app to createServer
const io = new Server(httpServer, {
	cors: {
		origin: process.env.CORS_ORIGIN || "https://app.gryt.chat",
	},
});

io.on("connection", (socket) => {
	console.log(`🔌 MAIN SERVER: New WebSocket connection established`);
	console.log(`🔌 Connection details:`, {
		id: socket.id,
		address: socket.handshake.address,
		userAgent: socket.handshake.headers['user-agent'],
		origin: socket.handshake.headers.origin
	});
	socketHandler(io, socket, sfuClient);
});

const PORT = process.env.PORT || 5000;

httpServer.listen(PORT, () => {
	consola.start(`Starting ${process.env.SERVER_NAME}...`);
	consola.info("Using icon", serverIconPath);
	if (process.env.SFU_WS_HOST)
		consola.info("SFU host set to " + process.env.SFU_WS_HOST);
	consola.success("Signaling server started at port", PORT);
	console.log(`🔌 WEBSOCKET SERVER READY:`, {
		port: PORT,
		serverName: process.env.SERVER_NAME || "Unknown Server",
		corsOrigin: process.env.CORS_ORIGIN || "https://app.gryt.chat",
		ready: true
	});
});
