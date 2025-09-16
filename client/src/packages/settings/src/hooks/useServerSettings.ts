import { useState, useCallback, useEffect } from "react";
import { Server, Servers } from "../types/server";

export function useServerSettings() {
  const [servers, setServers] = useState<Servers>(
    JSON.parse(localStorage.getItem("servers") || "{}")
  );
  const [currentlyViewingServer, setCurrentlyViewingServer] = useState<Server | null>(null);

  // Update servers in both state and localStorage
  const updateServers = useCallback((newServers: Servers) => {
    setServers(newServers);
    localStorage.setItem("servers", JSON.stringify(newServers));
  }, []);

  // Update currently viewing server
  const updateCurrentlyViewingServer = useCallback((host: string | null) => {
    if (host === null) {
      setCurrentlyViewingServer(null);
    } else {
      const server = servers[host];
      if (server) {
        setCurrentlyViewingServer(server);
      }
    }
  }, [servers]);

  // Auto-focus the first server when servers are loaded or changed
  useEffect(() => {
    const serverKeys = Object.keys(servers);
    if (serverKeys.length > 0 && !currentlyViewingServer) {
      console.log("🎯 Auto-focusing first available server:", serverKeys[0]);
      updateCurrentlyViewingServer(serverKeys[0]);
    }
  }, [servers, currentlyViewingServer, updateCurrentlyViewingServer]);

  return {
    servers,
    setServers: updateServers,
    currentlyViewingServer,
    setCurrentlyViewingServer: updateCurrentlyViewingServer,
  };
}
