import React, { createContext, useContext, useEffect, useState } from "react";
import { useSettings } from "@/settings";
import { createWebSocket } from "../utils/createWebSocket";

interface Connection {
  [host: string]: ReturnType<typeof createWebSocket>;
}

interface ConnectionsContextType {
  connections: Connection;
  addConnection: (host: string) => void;
  removeConnection: (host: string) => void;
}

const ConnectionsContext = createContext<ConnectionsContextType | null>(null);

export const ConnectionsProvider = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  const [connections, setConnections] = useState<Connection>({});
  const { servers } = useSettings();

  function addConnection(host: string) {
    if (!connections[host]) {
      const newConnection = createWebSocket(host);
      const newConnections = { ...connections, [host]: newConnection };
      setConnections(newConnections);
    }
  }

  function removeConnection(host: string) {
    const newConnections = { ...connections };
    delete newConnections[host];
    setConnections(newConnections);
  }

  useEffect(() => {
    Object.keys(servers).forEach((host) => {
      addConnection(host);
    });

    return () => {
      Object.values(connections).forEach((conn) => conn.socket.close());
    };
  }, [servers]);

  return (
    <ConnectionsContext.Provider
      value={{ connections, addConnection, removeConnection }}
    >
      {children}
    </ConnectionsContext.Provider>
  );
};

export function useConnections() {
  const context = useContext(ConnectionsContext);
  if (!context) {
    throw new Error("useConnections must be used within a ConnectionsProvider");
  }
  return context;
}
