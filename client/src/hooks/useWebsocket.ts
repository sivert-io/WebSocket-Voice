import { useState, useEffect, useCallback } from "react";

type UseWebSocketOptions = {
  onOpen?: (event: Event) => void;
  onClose?: (event: CloseEvent) => void;
  onMessage?: (event: MessageEvent) => void;
  onError?: (event: Event) => void;
};

export interface Clients {
  [id: string]: {
    nickname: string;
    isSpeaking: boolean;
    color: string;
    isMuted: boolean;
  };
}

type UseWebSocketReturn = {
  sendMessage: (message: any) => void;
  readyState: number;
  close: () => void;
  id: string;
  clients: Clients;
};

const createSingletonWebSocket = (() => {
  let socket: WebSocket | null = null;
  let readyState: number = WebSocket.CLOSED;
  let id: string = "";
  let listeners: Array<() => void> = [];
  let clients: Clients = {};
  let reconnectTimeout: ReturnType<typeof setTimeout> | null = null;

  const connect = (url: string, options: UseWebSocketOptions) => {
    if (reconnectTimeout) {
      clearTimeout(reconnectTimeout);
      reconnectTimeout = null;
    }

    socket = new WebSocket(url);

    socket.onopen = (event) => {
      readyState = socket!.readyState;
      options.onOpen?.(event);
      listeners.forEach((listener) => listener());
    };

    socket.onclose = (event) => {
      readyState = socket!.readyState;
      options.onClose?.(event);
      listeners.forEach((listener) => listener());
      attemptReconnect(url, options);
    };

    socket.onmessage = (event: MessageEvent) => {
      console.log(event);

      try {
        const json = JSON.parse(event.data);
        options.onMessage?.(json);

        if (json.message === "yourID") {
          id = json.value;
          listeners.forEach((listener) => listener());
        }

        if (json.message === "peers") {
          clients = json.value;
          listeners.forEach((listener) => listener());
        }
      } catch (error) {
        console.error("Failed to parse WebSocket message", error);
      }
    };

    socket.onerror = (event) => {
      options.onError?.(event);
      attemptReconnect(url, options);
    };
  };

  const attemptReconnect = (url: string, options: UseWebSocketOptions) => {
    reconnectTimeout = setTimeout(() => connect(url, options), 1000);
  };

  return (url: string, options: UseWebSocketOptions) => {
    if (!socket || socket.readyState === WebSocket.CLOSED) {
      connect(url, options);
    }

    return {
      getSocket: () => socket,
      getReadyState: () => readyState,
      getId: () => id,
      getClients: () => clients,
      addListener: (listener: () => void) => {
        listeners.push(listener);
      },
      removeListener: (listener: () => void) => {
        listeners = listeners.filter((l) => l !== listener);
      },
    };
  };
})();

export const useWebSocket = (
  url: string,
  options: UseWebSocketOptions = {}
): UseWebSocketReturn => {
  const [readyState, setReadyState] = useState<number>(WebSocket.CLOSED);
  const [id, setId] = useState("");
  const [clients, setClients] = useState<Clients>({});

  const singletonWebSocket = createSingletonWebSocket(url, options);

  useEffect(() => {
    const updateState = () => {
      setReadyState(singletonWebSocket.getReadyState());
      setId(singletonWebSocket.getId());
      setClients(singletonWebSocket.getClients());
    };

    singletonWebSocket.addListener(updateState);
    updateState();

    return () => {
      singletonWebSocket.removeListener(updateState);
    };
  }, [singletonWebSocket]);

  const sendMessage = useCallback(
    (message: any) => {
      const socket = singletonWebSocket.getSocket();
      if (socket && socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify(message));
      } else {
        console.error("WebSocket is not open. Ready state:", readyState);
      }
    },
    [readyState, singletonWebSocket]
  );

  const close = useCallback(() => {
    const socket = singletonWebSocket.getSocket();
    if (socket) {
      socket.close();
    }
  }, [singletonWebSocket]);

  return {
    sendMessage,
    readyState,
    close,
    id,
    clients,
  };
};
