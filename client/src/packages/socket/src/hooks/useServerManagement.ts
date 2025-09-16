import { useState, useCallback, useEffect } from "react";
import { singletonHook } from "react-singleton-hook";
import { useServerSettings } from "@/settings/src/hooks/useServerSettings";
import { Server } from "@/settings/src/types/server";

interface ServerManagement {
  // State
  servers: any;
  currentlyViewingServer: Server | null;
  showAddServer: boolean;
  showRemoveServer: string | null;
  
  // Actions
  addServer: (server: Server, focusNewServer?: boolean) => void;
  removeServer: (host: string) => void;
  switchToServer: (host: string) => void;
  reconnectServer: (host: string) => void;
  setShowAddServer: (show: boolean) => void;
  setShowRemoveServer: (host: string | null) => void;
  
  // Utilities
  getServer: (host: string) => Server | undefined;
  getAllServers: () => Server[];
  hasServer: (host: string) => boolean;
  getServerCount: () => number;
  getLastSelectedChannel: (host: string) => string | null;
  setLastSelectedChannelForServer: (host: string, channelId: string) => void;
}

function useServerManagementHook(): ServerManagement {
  const { servers, setServers, currentlyViewingServer, setCurrentlyViewingServer, lastSelectedChannels, setLastSelectedChannel } = useServerSettings();
  
  const [showAddServer, setShowAddServer] = useState(false);
  const [showRemoveServer, setShowRemoveServer] = useState<string | null>(null);

  // Add a new server and optionally focus it
  const addServer = useCallback((server: Server, focusNewServer: boolean = true) => {
    console.log("🔄 ADDING SERVER:", server);
    console.log("🔄 Server details:", {
      host: server.host,
      name: server.name,
      token: server.token ? "***" : "none",
      focusNewServer
    });
    console.log("🔄 Current servers before adding:", Object.keys(servers));
    
    // Check if server already exists and is the same
    const existingServer = servers[server.host];
    if (existingServer && existingServer.name === server.name) {
      console.log("🔄 Server already exists with same name, skipping add:", server.host);
      if (focusNewServer) {
        console.log("🎯 AUTO-FOCUSING existing server:", server.name, "host:", server.host);
        setCurrentlyViewingServer(server.host);
      }
      return;
    }
    
    const newServers = { ...servers, [server.host]: server };
    console.log("🔄 New servers object:", Object.keys(newServers));
    setServers(newServers);
    
    // Auto-focus the newly added server if requested
    if (focusNewServer) {
      console.log("🎯 AUTO-FOCUSING newly added server:", server.name, "host:", server.host);
      console.log("🎯 Current currentlyViewingServer before focus:", currentlyViewingServer?.host);
      setCurrentlyViewingServer(server.host);
      console.log("🎯 setCurrentlyViewingServer called with:", server.host);
    }
    
    // Close the add server modal
    setShowAddServer(false);
  }, [servers, setServers, setCurrentlyViewingServer, currentlyViewingServer]);

  // Remove a server
  const removeServer = useCallback((host: string) => {
    console.log("🗑️ REMOVING SERVER:", host);
    console.log("🗑️ Current servers before removal:", Object.keys(servers));
    console.log("🗑️ Currently viewing server:", currentlyViewingServer?.host);
    
    const newServers = { ...servers };
    delete newServers[host];
    console.log("🗑️ Servers after removal:", Object.keys(newServers));
    setServers(newServers);
    
    // If we're currently viewing the removed server, switch to the first available server
    if (currentlyViewingServer?.host === host) {
      const remainingServers = Object.values(newServers) as Server[];
      console.log("🗑️ Remaining servers:", remainingServers.map(s => s.host));
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
    console.log("🗑️ Server removal completed");
  }, [servers, setServers, currentlyViewingServer, setCurrentlyViewingServer]);

  // Switch to a specific server
  const switchToServer = useCallback((host: string) => {
    console.log("🔄 SWITCHING TO SERVER:", host);
    console.log("🔄 Available servers:", Object.keys(servers));
    console.log("🔄 Current server:", currentlyViewingServer?.host);
    
    if (!servers[host]) {
      console.error("❌ Cannot switch to server - server not found:", host);
      return;
    }
    
    console.log("🔄 Switching from", currentlyViewingServer?.host, "to", host);
    setCurrentlyViewingServer(host);
    console.log("🔄 setCurrentlyViewingServer called with:", host);
    
    // Don't clear the remove server modal when switching - let the user decide
    // The modal should only be cleared when explicitly closed or confirmed
  }, [setCurrentlyViewingServer, servers, currentlyViewingServer]);

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

  // Get last selected channel for a server
  const getLastSelectedChannel = useCallback((host: string): string | null => {
    return lastSelectedChannels[host] || null;
  }, [lastSelectedChannels]);

  // Set last selected channel for a server
  const setLastSelectedChannelForServer = useCallback((host: string, channelId: string) => {
    setLastSelectedChannel(host, channelId);
  }, [setLastSelectedChannel]);

  // Reconnect to a specific server
  const reconnectServer = useCallback((host: string) => {
    if (!servers[host]) {
      console.error("❌ Cannot reconnect to server - server not found:", host);
      return;
    }
    
    console.log(`🔄 Manual reconnection requested for server: ${host}`);
    // The socket will automatically attempt to reconnect when we call connect()
    // This is handled by the useSockets hook
  }, [servers]);

  // Debug the returned state (only log when state actually changes)
  useEffect(() => {
    console.log("🔄 useServerManagement state changed:", {
      currentlyViewingServer: currentlyViewingServer?.host,
      showRemoveServer,
      showAddServer,
      serversCount: Object.keys(servers).length
    });
  }, [currentlyViewingServer?.host, showRemoveServer, showAddServer, servers]);

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
    reconnectServer,
    setShowAddServer,
    setShowRemoveServer,
    
    // Utilities
    getServer,
    getAllServers,
    hasServer,
    getServerCount,
    getLastSelectedChannel,
    setLastSelectedChannelForServer,
  };
}

const init: ServerManagement = {
  // State
  servers: {},
  currentlyViewingServer: null,
  showAddServer: false,
  showRemoveServer: null,
  
  // Actions
  addServer: () => {},
  removeServer: () => {},
  switchToServer: () => {},
  reconnectServer: () => {},
  setShowAddServer: () => {},
  setShowRemoveServer: () => {},
  
  // Utilities
  getServer: () => undefined,
  getAllServers: () => [],
  hasServer: () => false,
  getServerCount: () => 0,
  getLastSelectedChannel: () => null,
  setLastSelectedChannelForServer: () => {},
};

export const useServerManagement = singletonHook(init, useServerManagementHook);
