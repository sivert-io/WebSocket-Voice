import { useSettings } from "@/settings";
import { useState, useEffect } from "react";
import { singletonHook } from "react-singleton-hook";

type Message = {
  message: string;
  value: any;
};

type MessageEventType = (value: any) => any;

type MessageEventsType = {
  [key: string]: MessageEventType;
};

export interface Clients {
  [id: string]: {
    nickname: string;
    color: string;
    isMuted: boolean;
    streamID: string;
    hasJoinedChannel: boolean;
  };
}

interface SocketInterface {
  socket?: WebSocket;
  sendMessage: (message: string, value: any) => any;
  clients: Clients;
  id: string;
  addOnMessage: (message: string, newEvent: MessageEventType) => any;
  stun_hosts?: string[];
  sfu_host?: string;
  turn_host?: string;
  turn_username?: string;
  turn_password?: string;
}

function webSocketHook(): SocketInterface {
  const [socket, setSocket] = useState<WebSocket | undefined>(undefined);
  const [clients, setClients] = useState<Clients>({});
  const [id, setId] = useState("");
  const [onMessageEvents, setOnMessageEvents] = useState<MessageEventsType>({});
  const [sfu_host, setSfu_host] = useState<string | undefined>(undefined);
  const [stunHosts, setStunHosts] = useState<string[]>([
    "stun:stun1.l.google.com:19302",
  ]);

  const { nickname } = useSettings();

  // Update nickname on server when it changes
  useEffect(() => {
    if (socket?.OPEN && nickname) {
      sendMessage("updateNickname", nickname);
    }
  }, [id, nickname]);

  function addOnMessage(message: string, newEvent: MessageEventType) {
    setOnMessageEvents((old) => ({ ...old, [message]: newEvent }));
  }

  function sendMessage(message: string, value: any) {
    if (socket?.OPEN) {
      try {
        const msg: Message = {
          message,
          value,
        };
        socket.send(JSON.stringify(msg));
      } catch (error) {
        console.log("Failed to send message", error);
      }
    }
  }

  // Register socket and onMessageEvents
  useEffect(() => {
    addOnMessage("yourID", setId);
    addOnMessage("peers", setClients);
    addOnMessage("sfu_host", setSfu_host);
    addOnMessage("stun_hosts", (value: string) => {
      const urlS = value.split(",");
      setStunHosts(urlS);
    });

    const _socket = new WebSocket(
      import.meta.env.VITE_WS_HOST || "ws://localhost:5000"
    );

    setSocket(_socket);

    return () => {
      _socket.close();
    };
  }, []);

  // connect onMessageEvents to socket
  useEffect(() => {
    function messageReceived(event: MessageEvent) {
      try {
        const json: Message = JSON.parse(event.data);
        console.log(json);

        if (onMessageEvents[json.message])
          onMessageEvents[json.message](json.value);
      } catch (error) {
        console.error("Failed to parse WebSocket message", error);
      }
    }

    if (socket) socket.addEventListener("message", messageReceived);

    return () => {
      if (socket) socket.removeEventListener("message", () => {});
    };
  }, [onMessageEvents, socket]);

  return {
    socket,
    sendMessage,
    clients,
    id,
    addOnMessage,
    sfu_host,
    stun_hosts: stunHosts,
  };
}

const init: SocketInterface = {
  sendMessage: () => {},
  clients: {},
  id: "",
  addOnMessage: () => {},
};

export const useSocket = singletonHook(init, webSocketHook);
