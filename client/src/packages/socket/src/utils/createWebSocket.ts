import { io } from "socket.io-client";

export function createWebSocket(host: string) {
  const socket = io(`wss://${host}`);
  let stunHosts = ["stun:stun.l.google.com:19302"];
  let sfuHost: string | undefined;

  socket.on("connect_error", (error) => {
    console.error("Error:", error);
  });

  socket.on("server_info", (value) => {
    sfuHost = value.sfu_host;
    stunHosts = value.stun_hosts;
  });

  return {
    socket,
    close: () => socket.close(),
    sendMessage: (message: string, value: any) => {
      if (socket.connected) {
        socket.emit(message, { message, value });
      }
    },
    getSfuHost: () => sfuHost,
    getStunHosts: () => stunHosts,
  };
}
