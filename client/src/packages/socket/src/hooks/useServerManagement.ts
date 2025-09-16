import { useState, useCallback } from "react";
import { useServerSettings } from "@/settings/src/hooks/useServerSettings";
import { Server } from "@/settings/src/types/server";

export function useServerManagement() {
  const { servers, setServers, currentlyViewingServer, setCurrentlyViewingServer } = useServerSettings();
  const [showAddServer, setShowAddServer] = useState(false);
  const [showRemoveServer, setShowRemoveServer] = useState<string | null>(null);

  // Add a new server and optionally focus it
  const addServer = useCallback((server: Server, focusNewServer: boolean = true) => {
    console.log("🔄 Adding server:", server);
    
    const newServers = { ...servers, [server.host]: server };
    setServers(newServers);
    
    // Auto-focus the newly added server if requested
    if (focusNewServer) {
      console.log("🎯 Auto-focusing newly added server:", server.host);
      setCurrentlyViewingServer(server.host);
    }
    
    // Close the add server modal
    setShowAddServer(false);
  }, [servers, setServers, setCurrentlyViewingServer]);

  // Remove a server
  const removeServer = useCallback((host: string) => {
    console.log("🗑️ Removing server:", host);
    
    const newServers = { ...servers };
    delete newServers[host];
    setServers(newServers);
    
    // If we're currently viewing the removed server, switch to the first available server
    if (currentlyViewingServer?.host === host) {
      const remainingServers = Object.values(newServers);
      if (remainingServers.length > 0) {
        console.log("🔄 Switching to first available server:", remainingServers[0].host);
        setCurrentlyViewingServer(remainingServers[0].host);
      } else {
        console.log("📭 No servers remaining, clearing current view");
        setCurrentlyViewingServer(null);
      }
    }
    
    // Close the remove server modal
    setShowRemoveServer(null);
  }, [servers, setServers, currentlyViewingServer, setCurrentlyViewingServer]);

  // Switch to a specific server
  const switchToServer = useCallback((host: string) => {
    console.log("🔄 Switching to server:", host);
    setCurrentlyViewingServer(host);
  }, [setCurrentlyViewingServer]);

  // Get server by host
  const getServer = useCallback((host: string): Server | undefined => {
    return servers[host];
  }, [servers]);

  // Get all servers
  const getAllServers = useCallback((): Server[] => {
    return Object.values(servers);
  }, [servers]);

  // Check if a server exists
  const hasServer = useCallback((host: string): boolean => {
    return host in servers;
  }, [servers]);

  // Get server count
  const getServerCount = useCallback((): number => {
    return Object.keys(servers).length;
  }, [servers]);

  return {
    // State
    servers,
    currentlyViewingServer,
    showAddServer,
    showRemoveServer,
    
    // Actions
    addServer,
    removeServer,
    switchToServer,
    setShowAddServer,
    setShowRemoveServer,
    
    // Utilities
    getServer,
    getAllServers,
    hasServer,
    getServerCount,
  };
}
