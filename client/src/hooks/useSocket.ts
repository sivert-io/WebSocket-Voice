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
    isSpeaking: boolean;
    color: string;
    isMuted: boolean;
  };
}

interface SocketInterface {
  socket?: WebSocket;
  sendMessage: (message: string, value: any) => any;
  clients: Clients;
  id: string;
  addOnMessage: (message: string, newEvent: MessageEventType) => any;
}

function webSocketHook() {
  const [socket, setSocket] = useState<WebSocket | undefined>(undefined);
  const [clients, setClients] = useState<Clients>({});
  const [id, setId] = useState("");
  const [onMessageEvents, setOnMessageEvents] = useState<MessageEventsType>({});

  function addOnMessage(message: string, newEvent: MessageEventType) {
    setOnMessageEvents((old) => ({ ...old, [message]: newEvent }));
  }

  function sendMessage(message: string, value: any) {
    if (socket) {
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

    const socket = new WebSocket(
      import.meta.env.VITE_WS_HOST || "ws://localhost:5000"
    );

    setSocket(socket);

    return () => {
      socket.close();
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
  };
}

const init: SocketInterface = {
  socket: undefined,
  sendMessage: () => {},
  clients: {},
  id: "",
  addOnMessage: () => {},
};

export const useSocket = singletonHook(init, webSocketHook);
