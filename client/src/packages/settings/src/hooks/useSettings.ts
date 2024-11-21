import { useEffect, useState } from "react";
import { singletonHook } from "react-singleton-hook";
import { Server, Servers } from "../types/server";

interface Settings {
  micID?: string;
  setMicID: (id: string) => any;
  micVolume: number;
  setMicVolume: (num: number) => any;
  noiseGate: number;
  setNoiseGate: (num: number) => any;
  setLoopbackEnabled: (value: boolean) => any;
  loopbackEnabled: boolean;

  setNickname: (name: string) => any;

  nickname: string;

  isMuted: boolean;
  setIsMuted: (value: boolean) => any;

  isDeafened: boolean;
  setIsDeafened: (value: boolean) => any;

  showSettings: boolean;
  setShowSettings: (value: boolean) => any;

  showNickname: boolean;
  setShowNickname: (value: boolean) => any;

  showAddServer: boolean;
  setShowAddServer: (value: boolean) => any;

  servers: Servers;
  addServer: (oldServers: Servers, server: Server) => any;
  removeServer: (server: Server) => any;

  hasSeenWelcome: boolean;
  updateHasSeenWelcome: () => any;

  currentServer: Server | null;
  setCurrentServer: (value: string) => any;
}

function updateStorage(key: string, value: string, useState: (d: any) => any) {
  useState(value);
  localStorage.setItem(key, value);
}

function updateStorageJson(key: string, value: any, useState: (d: any) => any) {
  useState(value);
  localStorage.setItem(key, JSON.stringify(value));
}

function settingsHook() {
  const [showSettings, setShowSettings] = useState(false);
  const [showNickname, setShowNickname] = useState(false);
  const [showAddServer, setShowAddServer] = useState(false);
  const [hasSeenWelcome, setHasSeenWelcome] = useState(true);
  const [loopbackEnabled, setLoopbackEnabled] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isDeafened, setIsDeafened] = useState(false);
  const [micID, setMicID] = useState(
    localStorage.getItem("micID") || undefined
  );
  const [nickname, setNickname] = useState(
    localStorage.getItem("nickname") || "Unknown"
  );
  const [micVolume, setMicVolume] = useState(
    Number(localStorage.getItem("micVolume")) || 50
  );
  const [noiseGate, setNoiseGate] = useState(
    Number(localStorage.getItem("noiseGate")) || 10
  );

  const [servers, setServers] = useState<Servers>(
    JSON.parse(localStorage.getItem("servers") || "{}")
  );

  const [currentServer, setCurrentServer] = useState<Server | null>(null);

  function updateMicID(newID: string) {
    updateStorage("micID", newID, setMicID);
  }

  function updateNickname(newName: string) {
    updateStorage("nickname", newName, setNickname);
  }

  function updateMicVolume(newVol: number) {
    updateStorage("micVolume", newVol.toString(), setMicVolume);
  }

  function updateNoiseGate(newGate: number) {
    updateStorage("noiseGate", newGate.toString(), setNoiseGate);
  }

  function updateServers(newServers: Servers) {
    updateStorageJson("servers", newServers, setServers);
  }

  function addServer(oldServers: Servers, server: Server) {
    const newServers = { ...oldServers, [server.host]: server };
    updateServers(newServers);
  }

  function removeServer(server: Server) {
    const newServers = { ...servers };
    delete newServers[server.host];
    updateServers(newServers);
  }

  function updateHasSeenWelcome() {
    updateStorage("hasSeenWelcome", "true", setHasSeenWelcome);

    if (!!!localStorage.getItem("nickname")) {
      setShowNickname(true);
    }
  }

  function updateCurrentServer(host: string) {
    setCurrentServer(servers[host]);
  }

  useEffect(() => {
    // If the user has seen the welcome screen, show the nickname prompt
    if (!!localStorage.getItem("hasSeenWelcome")) {
      setHasSeenWelcome(true);
      setShowNickname(!!!localStorage.getItem("nickname"));
    }
    // If the user has not seen the welcome screen, show the welcome screen
    else {
      setHasSeenWelcome(false);
    }
  }, []);

  return {
    micID,
    setMicID: updateMicID,
    nickname,
    setNickname: updateNickname,
    micVolume,
    setMicVolume: updateMicVolume,
    noiseGate,
    setNoiseGate: updateNoiseGate,
    loopbackEnabled,
    setLoopbackEnabled,
    isMuted,
    setIsMuted,
    isDeafened,
    setIsDeafened,
    showSettings,
    setShowSettings,
    showNickname,
    setShowNickname,
    servers,
    hasSeenWelcome,
    updateHasSeenWelcome,
    showAddServer,
    setShowAddServer,
    currentServer,
    setCurrentServer: updateCurrentServer,
    addServer,
    removeServer,
  };
}

const init: Settings = {
  micID: localStorage.getItem("micID") || undefined,
  setMicID: () => {},
  micVolume: Number(localStorage.getItem("micVolume")) || 50,
  setMicVolume: () => {},
  noiseGate: Number(localStorage.getItem("noiseGate") || 10),
  setNoiseGate: () => {},
  loopbackEnabled: false,
  setLoopbackEnabled: () => {},
  isMuted: false,
  setIsMuted: () => {},
  isDeafened: false,
  setIsDeafened: () => {},
  showSettings: false,
  setShowSettings: () => {},
  showNickname: false,
  setShowNickname: () => {},
  nickname: localStorage.getItem("nickname") || "Unknown",
  setNickname: () => {},

  servers: JSON.parse(localStorage.getItem("servers") || "{}"),

  hasSeenWelcome: !!localStorage.getItem("hasSeenWelcome"),
  updateHasSeenWelcome: () => {},

  showAddServer: false,
  setShowAddServer: () => {},
  addServer: () => {},
  removeServer: () => {},

  currentServer: null,
  setCurrentServer: () => {},
};

export const useSettings = singletonHook(init, settingsHook);
