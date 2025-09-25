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

export function sendInfo(socket: Socket, clientsInfo?: any) {
  // Count active registered users
  const activeMembers = clientsInfo ? Object.values(clientsInfo).filter((client: any) => 
    client.serverUserId && !client.serverUserId.startsWith('temp_')
  ).length : 0;
  
  const serverInfo = {
    name: process.env.SERVER_NAME || "Unknown Server",
    members: activeMembers.toString(),
    version: process.env.SERVER_VERSION || "1.0.0",
  };
  
  console.log(`📡 SENDING SERVER INFO to client ${socket.id}:`, serverInfo);
  console.log(`📡 Environment variables:`, {
    SERVER_NAME: process.env.SERVER_NAME,
    SERVER_VERSION: process.env.SERVER_VERSION,
    NODE_ENV: process.env.NODE_ENV
  });

  socket.emit("info", serverInfo);
  console.log(`✅ Server info sent to client ${socket.id}`);
}

export function sendServerDetails(socket: Socket, clientsInfo: Clients) {
  // Only send server details to registered users
  const clientId = socket.id;
  const client = clientsInfo[clientId];
  
  // Check if client has joined the server (is a registered user)
  if (!client || !client.grytUserId) {
    consola.warn(`🚫 Client ${clientId} requested server details without joining`);
    socket.emit("details", {
      error: "join_required",
      message: "Please join the server first"
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

  // Filter to only include registered users (those with real serverUserId, not temp IDs)
  const registeredClients: Clients = {};
  Object.entries(clientsInfo).forEach(([clientId, client]) => {
    // Only include clients who have been properly registered in the database
    // (i.e., have a real serverUserId that doesn't start with "temp_")
    if (client.serverUserId && !client.serverUserId.startsWith('temp_')) {
      registeredClients[clientId] = client;
    }
  });

  const serverDetails = {
    sfu_host: sfuHost,
    stun_hosts: stunHosts,
    clients: registeredClients, // Only send registered users, not temporary connections
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
