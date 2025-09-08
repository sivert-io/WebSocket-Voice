import consola from "consola";
import { Socket } from "socket.io";
import { Clients } from "../../types";

const sfuHost = process.env.SFU_WS_HOST;
const stunHosts = process.env.STUN_SERVERS?.split(",") || [];

// Validate configuration
if (!sfuHost) {
  consola.error("Missing SFU WebSocket Host! Voice functionality will not work.");
}
if (stunHosts.length === 0) {
  consola.error("Missing STUN servers! SFU may not reach all clients.");
}

export function sendInfo(socket: Socket) {
  console.log("Sending server info to client:", socket.id);

  socket.emit("info", {
    name: process.env.SERVER_NAME || "Unknown Server",
    members: Object.keys({}).length.toString(), // You might want to pass actual client count
    version: process.env.SERVER_VERSION || "1.0.0",
  });
}

export function sendServerDetails(socket: Socket, clientsInfo: Clients) {
  // Check if client has valid server token
  const clientId = socket.id;
  const client = clientsInfo[clientId];
  const expectedServerToken = process.env.SERVER_TOKEN;
  
  // Only check token if the client has already attempted to join
  // This allows initial connection and server info to be sent
  if (expectedServerToken && client && (!client.serverToken || client.serverToken !== expectedServerToken)) {
    consola.warn(`🚫 Client ${clientId} requested server details without valid token`);
    socket.emit("details", {
      error: "token_required",
      message: "Server token required to access details"
    });
    return;
  }

  const channels = [
    {
      name: "General",
      type: "text",
      id: "general",
      description: "General text chat",
    },
    {
      name: "Random",
      type: "text",
      id: "random",
      description: "Random discussions and off-topic chat",
    },
    {
      name: process.env.VOICE_CHANNEL_NAME || "Voice Chat",
      type: "voice",
      id: process.env.VOICE_CHANNEL_ID || "voice",
      description: "Voice communication channel",
    },
  ];

  // Add additional channels if configured
  if (process.env.ADDITIONAL_CHANNELS) {
    try {
      const additionalChannels = JSON.parse(process.env.ADDITIONAL_CHANNELS);
      channels.push(...additionalChannels);
    } catch (error) {
      consola.warn("Failed to parse ADDITIONAL_CHANNELS environment variable:", error);
    }
  }

  const serverDetails = {
    sfu_host: sfuHost,
    stun_hosts: stunHosts,
    clients: clientsInfo,
    channels,
    server_info: {
      name: process.env.SERVER_NAME || "Unknown Server",
      description: process.env.SERVER_DESCRIPTION || "A Gryt server",
      max_members: parseInt(process.env.MAX_MEMBERS || "100"),
      voice_enabled: !!sfuHost,
    },
  };

  socket.emit("details", serverDetails);
  consola.info(`Sent server details to client ${socket.id}:`, {
    channels: channels.length,
    voice_enabled: !!sfuHost,
    stun_servers: stunHosts.length,
  });
}
