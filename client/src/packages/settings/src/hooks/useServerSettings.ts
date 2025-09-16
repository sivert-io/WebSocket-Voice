import { useState, useCallback, useEffect, useRef } from "react";
import { singletonHook } from "react-singleton-hook";
import { Server, Servers } from "../types/server";

interface ServerSettings {
  servers: Servers;
  setServers: (newServers: Servers) => void;
  currentlyViewingServer: Server | null;
  setCurrentlyViewingServer: (host: string | null) => void;
  lastSelectedChannels: Record<string, string>; // host -> channelId
  setLastSelectedChannel: (host: string, channelId: string) => void;
}

function useServerSettingsHook(): ServerSettings {
  const [servers, setServers] = useState<Servers>(
    JSON.parse(localStorage.getItem("servers") || "{}")
  );
  const [currentlyViewingServer, setCurrentlyViewingServer] = useState<Server | null>(null);
  const [lastSelectedChannels, setLastSelectedChannels] = useState<Record<string, string>>(
    JSON.parse(localStorage.getItem("lastSelectedChannels") || "{}")
  );
  const hasAutoFocused = useRef(false);

  // Update servers in both state and localStorage
  const updateServers = useCallback((newServers: Servers) => {
    console.log("🔄 updateServers called with:", Object.keys(newServers));
    setServers(newServers);
    localStorage.setItem("servers", JSON.stringify(newServers));
    console.log("🔄 Servers updated and saved to localStorage");
  }, []);

  // Update currently viewing server
  const updateCurrentlyViewingServer = useCallback((host: string | null) => {
    console.log("🔄 updateCurrentlyViewingServer called with:", host);
    if (host === null) {
      console.log("🔄 Setting currentlyViewingServer to null");
      setCurrentlyViewingServer(null);
    } else {
      setCurrentlyViewingServer((currentServer) => {
        console.log("🔄 Current server before update:", currentServer?.host);
        const server = servers[host];
        console.log("🔄 Looking for server:", host, "Found:", !!server);
        console.log("🔄 Available servers:", Object.keys(servers));
        if (server) {
          console.log("🔄 Setting currentlyViewingServer to:", server);
          return server;
        } else {
          console.error("❌ Server not found:", host, "Available servers:", Object.keys(servers));
          return currentServer;
        }
      });
    }
  }, [servers]);

  // Update last selected channel for a server
  const updateLastSelectedChannel = useCallback((host: string, channelId: string) => {
    console.log("🔄 updateLastSelectedChannel called with:", host, channelId);
    setLastSelectedChannels(prev => {
      const newChannels = { ...prev, [host]: channelId };
      localStorage.setItem("lastSelectedChannels", JSON.stringify(newChannels));
      console.log("🔄 Last selected channels updated:", newChannels);
      return newChannels;
    });
  }, []);

  // Auto-focus the first server when servers are loaded (only on initial load)
  useEffect(() => {
    const serverKeys = Object.keys(servers);
    if (serverKeys.length > 0 && !hasAutoFocused.current) {
      console.log("🎯 Auto-focusing first available server:", serverKeys[0]);
      const currentServers = JSON.parse(localStorage.getItem("servers") || "{}");
      const server = currentServers[serverKeys[0]];
      if (server) {
        setCurrentlyViewingServer(server);
        hasAutoFocused.current = true;
      }
    }
  }, [servers]);

  // Debug the returned state
  useEffect(() => {
    console.log("🔄 useServerSettings state changed:", {
      currentlyViewingServer: currentlyViewingServer?.host,
      serversCount: Object.keys(servers).length
    });
  }, [currentlyViewingServer?.host, servers]);

  return {
    servers,
    setServers: updateServers,
    currentlyViewingServer,
    setCurrentlyViewingServer: updateCurrentlyViewingServer,
    lastSelectedChannels,
    setLastSelectedChannel: updateLastSelectedChannel,
  };
}

const init: ServerSettings = {
  servers: JSON.parse(localStorage.getItem("servers") || "{}"),
  setServers: () => {},
  currentlyViewingServer: null,
  setCurrentlyViewingServer: () => {},
  lastSelectedChannels: JSON.parse(localStorage.getItem("lastSelectedChannels") || "{}"),
  setLastSelectedChannel: () => {},
};

export const useServerSettings = singletonHook(init, useServerSettingsHook);
