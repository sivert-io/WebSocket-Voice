import { useState, useEffect } from "react";
import { Socket, io } from "socket.io-client";

interface SocketInterface {
  sendMessage: (message: string, value: any) => void;
  close: () => void;
  sfu_host?: string;
  stun_hosts: string[];
}

export function useWebSocket(host: string): SocketInterface {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [sfu_host, setSfu_host] = useState<string | undefined>(undefined);
  const [stun_hosts, setStunHosts] = useState<string[]>([
    "stun:stun.l.google.com:19302",
  ]);

  useEffect(() => {
    const ws = io(`wss://${host}`);
    setSocket(ws);

    ws.on("connect_error", (error) => {
      console.error("Error:", error);
    });

    ws.on("server_info", (value) => {
      setSfu_host(value.sfu_host);
      setStunHosts(value.stun_hosts);
    });

    return () => {
      ws.close();
    };
  }, [host]);

  function sendMessage(message: string, value: any) {
    if (socket?.connected) {
      socket.emit(message, { message, value });
    }
  }

  function close() {
    socket?.close();
  }

  return { sendMessage, close, sfu_host, stun_hosts };
}
