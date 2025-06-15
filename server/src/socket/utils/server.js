"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
var _a;
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendInfo = sendInfo;
exports.sendServerDetails = sendServerDetails;
const consola_1 = __importDefault(require("consola"));
const sfuHost = process.env.SFU_WS_HOST;
const stunHosts = ((_a = process.env.STUN_SERVERS) === null || _a === void 0 ? void 0 : _a.split(",")) || [];
// Validate configuration
if (!sfuHost) {
    consola_1.default.error("Missing SFU WebSocket Host! Voice functionality will not work.");
}
if (stunHosts.length === 0) {
    consola_1.default.error("Missing STUN servers! SFU may not reach all clients.");
}
function sendInfo(socket) {
    console.log("Sending server info to client:", socket.id);
    socket.emit("info", {
        name: process.env.SERVER_NAME || "Unknown Server",
        members: Object.keys({}).length.toString(), // You might want to pass actual client count
        version: process.env.SERVER_VERSION || "1.0.0",
    });
}
function sendServerDetails(socket, clientsInfo) {
    const channels = [
        {
            name: "General",
            type: "text",
            id: "general",
            description: "General text chat",
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
        }
        catch (error) {
            consola_1.default.warn("Failed to parse ADDITIONAL_CHANNELS environment variable:", error);
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
    consola_1.default.info(`Sent server details to client ${socket.id}:`, {
        channels: channels.length,
        voice_enabled: !!sfuHost,
        stun_servers: stunHosts.length,
    });
}
