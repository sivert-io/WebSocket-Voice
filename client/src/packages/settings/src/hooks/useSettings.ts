import { useEffect, useState } from "react";
import { singletonHook } from "react-singleton-hook";

import { Server, Servers } from "../types/server";

interface Settings {
  micID?: string;
  setMicID: (id: string) => void;
  micVolume: number;
  setMicVolume: (num: number) => void;
  outputVolume: number;
  setOutputVolume: (num: number) => void;
  noiseGate: number;
  setNoiseGate: (num: number) => void;
  setLoopbackEnabled: (value: boolean) => void;
  loopbackEnabled: boolean;

  // Voice call settings
  connectSoundEnabled: boolean;
  setConnectSoundEnabled: (value: boolean) => void;
  disconnectSoundEnabled: boolean;
  setDisconnectSoundEnabled: (value: boolean) => void;
  connectSoundVolume: number;
  setConnectSoundVolume: (value: number) => void;
  disconnectSoundVolume: number;
  setDisconnectSoundVolume: (value: number) => void;
  customConnectSoundFile: string | null;
  setCustomConnectSoundFile: (value: string | null) => void;
  customDisconnectSoundFile: string | null;
  setCustomDisconnectSoundFile: (value: string | null) => void;

  setNickname: (name: string) => void;

  nickname: string;

  isMuted: boolean;
  setIsMuted: (value: boolean) => void;

  isDeafened: boolean;
  setIsDeafened: (value: boolean) => void;

  showSettings: boolean;
  setShowSettings: (value: boolean) => void;

  showNickname: boolean;
  setShowNickname: (value: boolean) => void;

  showAddServer: boolean;
  setShowAddServer: (value: boolean) => void;

  servers: Servers;
  addServer: (oldServers: Servers, server: Server) => void;

  showRemoveServer: string | null;
  setShowRemoveServer: (value: string | null) => void;
  removeServer: (host: string) => void;

  hasSeenWelcome: boolean;
  updateHasSeenWelcome: () => void;

  currentlyViewingServer: Server | null;
  setCurrentlyViewingServer: (value: string) => void;

  showVoiceView: boolean;
  setShowVoiceView: (value: boolean) => void;

  settingsTab: string;
  setSettingsTab: (value: string) => void;
}

function updateStorage(key: string, value: string, state: (d: any) => void) {
  state(value);
  localStorage.setItem(key, value);
}

function updateStorageJson(
  key: string,
  value: object,
  state: (d: any) => void
) {
  state(value);
  localStorage.setItem(key, JSON.stringify(value));
}

function useSettingsHook() {
  const [showSettings, setShowSettings] = useState(false);
  const [settingsTab, setSettingsTab] = useState("microphone");
  const [showNickname, setShowNickname] = useState(false);
  const [showAddServer, setShowAddServer] = useState(false);
  const [hasSeenWelcome, setHasSeenWelcome] = useState(true);
  const [loopbackEnabled, setLoopbackEnabled] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isDeafened, setIsDeafened] = useState(false);

  // Voice call settings
  const [connectSoundEnabled, setConnectSoundEnabled] = useState(
    localStorage.getItem("connectSoundEnabled") !== "false" // Default to true
  );
  const [disconnectSoundEnabled, setDisconnectSoundEnabled] = useState(
    localStorage.getItem("disconnectSoundEnabled") !== "false" // Default to true
  );
  const [connectSoundVolume, setConnectSoundVolume] = useState(
    Number(localStorage.getItem("connectSoundVolume")) || 10
  );
  const [disconnectSoundVolume, setDisconnectSoundVolume] = useState(
    Number(localStorage.getItem("disconnectSoundVolume")) || 10
  );
  const [customConnectSoundFile, setCustomConnectSoundFile] = useState<string | null>(
    localStorage.getItem("customConnectSoundFile") || null
  );
  const [customDisconnectSoundFile, setCustomDisconnectSoundFile] = useState<string | null>(
    localStorage.getItem("customDisconnectSoundFile") || null
  );

  const [micID, setMicID] = useState<string | undefined>(() => {
    const stored = localStorage.getItem("micID");
    console.log("Initializing micID from localStorage:", stored, "type:", typeof stored);
    // Return undefined if null, empty string, or "undefined" string
    return (stored && stored !== "undefined" && stored.trim() !== "") ? stored : undefined;
  });
  const [nickname, setNickname] = useState(
    localStorage.getItem("nickname") || "Unknown"
  );
  const [micVolume, setMicVolume] = useState(() => {
    const stored = localStorage.getItem("micVolume");
    const value = stored ? Number(stored) : 50;
    
    // One-time migration: if volume is 100%, reset to 50%
    if (value === 100) {
      localStorage.setItem("micVolume", "50");
      return 50;
    }
    
    return value;
  });
  const [outputVolume, setOutputVolume] = useState(
    Number(localStorage.getItem("outputVolume")) || 50
  );
  const [noiseGate, setNoiseGate] = useState(
    Number(localStorage.getItem("noiseGate")) || 10
  );

  const [servers, setServers] = useState<Servers>(
    JSON.parse(localStorage.getItem("servers") || "{}")
  );

  const [serverViewIndex, setServerViewIndex] = useState(0);

  const [showRemoveServer, setShowRemoveServer] = useState<string | null>(null);

  const [currentlyViewingServer, setCurrentlyViewingServer] =
    useState<Server | null>(null);

  const [showVoiceView, setShowVoiceView] = useState(true);

  function updateMicID(newID: string) {
    console.log("updateMicID called with:", newID, "type:", typeof newID, "length:", newID?.length);
    
    // Validate the newID is not empty or whitespace
    if (!newID || newID.trim() === "") {
      console.warn("updateMicID: Invalid micID provided:", newID);
      return;
    }
    
    updateStorage("micID", newID, setMicID);
    console.log("updateMicID completed, localStorage value:", localStorage.getItem("micID"));
    console.log("updateMicID completed, state should be:", newID);
  }

  function updateNickname(newName: string) {
    updateStorage("nickname", newName, setNickname);
  }

  function updateMicVolume(newVol: number) {
    setMicVolume(newVol);
    localStorage.setItem("micVolume", newVol.toString());
  }

  function updateOutputVolume(newVol: number) {
    setOutputVolume(newVol);
    localStorage.setItem("outputVolume", newVol.toString());
  }

  function updateNoiseGate(newGate: number) {
    setNoiseGate(newGate);
    localStorage.setItem("noiseGate", newGate.toString());
  }

  // Voice call settings update functions
  function updateConnectSoundEnabled(enabled: boolean) {
    setConnectSoundEnabled(enabled);
    localStorage.setItem("connectSoundEnabled", enabled.toString());
  }

  function updateDisconnectSoundEnabled(enabled: boolean) {
    setDisconnectSoundEnabled(enabled);
    localStorage.setItem("disconnectSoundEnabled", enabled.toString());
  }

  function updateConnectSoundVolume(volume: number) {
    setConnectSoundVolume(volume);
    localStorage.setItem("connectSoundVolume", volume.toString());
  }

  function updateDisconnectSoundVolume(volume: number) {
    setDisconnectSoundVolume(volume);
    localStorage.setItem("disconnectSoundVolume", volume.toString());
  }

  function updateCustomConnectSoundFile(file: string | null) {
    if (file) {
      updateStorage("customConnectSoundFile", file, setCustomConnectSoundFile);
    } else {
      localStorage.removeItem("customConnectSoundFile");
      setCustomConnectSoundFile(null);
    }
  }

  function updateCustomDisconnectSoundFile(file: string | null) {
    if (file) {
      updateStorage("customDisconnectSoundFile", file, setCustomDisconnectSoundFile);
    } else {
      localStorage.removeItem("customDisconnectSoundFile");
      setCustomDisconnectSoundFile(null);
    }
  }

  function updateServers(newServers: Servers) {
    updateStorageJson("servers", newServers, setServers);
  }

  function addServer(oldServers: Servers, server: Server) {
    console.log("adding server", server);

    const newServers = { ...oldServers, [server.host]: server };
    setServerViewIndex(Object.keys(newServers).length - 1);
    updateServers(newServers);
  }

  function removeServer(host: string) {
    const newServers = { ...servers };
    delete newServers[host];
    setServerViewIndex(Object.keys(newServers).length - 1);
    updateServers(newServers);
  }

  function updateHasSeenWelcome() {
    updateStorage("hasSeenWelcome", "true", setHasSeenWelcome);

    if (!localStorage.getItem("nickname")) {
      setShowNickname(true);
    }
  }

  function updateCurrentServer(host: string) {
    setCurrentlyViewingServer(servers[host]);
  }

  useEffect(() => {
    // If the user has seen the welcome screen, show the nickname prompt
    if (localStorage.getItem("hasSeenWelcome")) {
      setHasSeenWelcome(true);
      setShowNickname(!localStorage.getItem("nickname"));
    }
    // If the user has not seen the welcome screen, show the welcome screen
    else {
      setHasSeenWelcome(false);
    }
  }, []);

  // Update the currently viewing server when the server view index changes
  useEffect(() => {
    if (Object.keys(servers).length > 0) {
      updateCurrentServer(Object.keys(servers)[serverViewIndex]);
    }
  }, [serverViewIndex, servers]);

  return {
    micID,
    setMicID: updateMicID,
    nickname,
    setNickname: updateNickname,
    micVolume,
    setMicVolume: updateMicVolume,
    outputVolume,
    setOutputVolume: updateOutputVolume,
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
    settingsTab,
    setSettingsTab,
    showNickname,
    setShowNickname,
    servers,
    hasSeenWelcome,
    updateHasSeenWelcome,
    showAddServer,
    setShowAddServer,
    currentlyViewingServer,
    setCurrentlyViewingServer: updateCurrentServer,
    addServer,
    removeServer,
    showRemoveServer,
    setShowRemoveServer,
    showVoiceView,
    setShowVoiceView,
    // Voice call settings
    connectSoundEnabled,
    setConnectSoundEnabled: updateConnectSoundEnabled,
    disconnectSoundEnabled,
    setDisconnectSoundEnabled: updateDisconnectSoundEnabled,
    connectSoundVolume,
    setConnectSoundVolume: updateConnectSoundVolume,
    disconnectSoundVolume,
    setDisconnectSoundVolume: updateDisconnectSoundVolume,
    customConnectSoundFile,
    setCustomConnectSoundFile: updateCustomConnectSoundFile,
    customDisconnectSoundFile,
    setCustomDisconnectSoundFile: updateCustomDisconnectSoundFile,
  };
}

const init: Settings = {
  micID: (() => {
    const stored = localStorage.getItem("micID");
    return (stored && stored !== "undefined" && stored.trim() !== "") ? stored : undefined;
  })(),
  setMicID: () => {},
  micVolume: Number(localStorage.getItem("micVolume")) || 50,
  setMicVolume: () => {},
  outputVolume: Number(localStorage.getItem("outputVolume")) || 50,
  setOutputVolume: () => {},
  noiseGate: Number(localStorage.getItem("noiseGate")) || 10,
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

  showRemoveServer: null,
  setShowRemoveServer: () => {},
  removeServer: () => {},

  currentlyViewingServer: null,
  setCurrentlyViewingServer: () => {},

  showVoiceView: true,
  setShowVoiceView: () => {},

  // Voice call settings
  connectSoundEnabled: localStorage.getItem("connectSoundEnabled") !== "false",
  setConnectSoundEnabled: () => {},
  disconnectSoundEnabled: localStorage.getItem("disconnectSoundEnabled") !== "false",
  setDisconnectSoundEnabled: () => {},
  connectSoundVolume: Number(localStorage.getItem("connectSoundVolume")) || 10,
  setConnectSoundVolume: () => {},
  disconnectSoundVolume: Number(localStorage.getItem("disconnectSoundVolume")) || 10,
  setDisconnectSoundVolume: () => {},
  customConnectSoundFile: localStorage.getItem("customConnectSoundFile") || null,
  setCustomConnectSoundFile: () => {},
  customDisconnectSoundFile: localStorage.getItem("customDisconnectSoundFile") || null,
  setCustomDisconnectSoundFile: () => {},

  settingsTab: "microphone",
  setSettingsTab: () => {},
};

export const useSettings = singletonHook(init, useSettingsHook);
