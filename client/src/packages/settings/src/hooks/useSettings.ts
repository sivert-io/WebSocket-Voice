import { useEffect, useState } from "react";
import { singletonHook } from "react-singleton-hook";


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

  // AFK settings
  isAFK: boolean;
  setIsAFK: (value: boolean) => void;
  afkTimeoutMinutes: number;
  setAfkTimeoutMinutes: (value: number) => void;

  showSettings: boolean;
  setShowSettings: (value: boolean) => void;

  showNickname: boolean;
  setShowNickname: (value: boolean) => void;

  hasSeenWelcome: boolean;
  updateHasSeenWelcome: () => void;

  showVoiceView: boolean;
  setShowVoiceView: (value: boolean) => void;

  settingsTab: string;
  setSettingsTab: (value: string) => void;
  openSettings: (tab?: string) => void;

  // Debug overlay settings
  showDebugOverlay: boolean;
  setShowDebugOverlay: (value: boolean) => void;
}

function updateStorage(key: string, value: string, state: (d: any) => void) {
  state(value);
  localStorage.setItem(key, value);
}


function useSettingsHook() {
  const [showSettings, setShowSettings] = useState(false);
  const [settingsTab, setSettingsTab] = useState("appearance");
  const [showNickname, setShowNickname] = useState(false);
  const [hasSeenWelcome, setHasSeenWelcome] = useState(true);
  const [loopbackEnabled, setLoopbackEnabled] = useState(false);
  const [isMuted, setIsMutedState] = useState(false);
  const [isDeafened, setIsDeafenedState] = useState(false);
  const [preDeafenMuteState, setPreDeafenMuteState] = useState(false);

  // Debug overlay settings
  const [showDebugOverlay, setShowDebugOverlay] = useState(
    localStorage.getItem("showDebugOverlay") === "true" // Default to false
  );

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


  const [showVoiceView, setShowVoiceView] = useState(true);

  // AFK settings
  const [isAFK, setIsAFK] = useState(false);
  const [afkTimeoutMinutes, setAfkTimeoutMinutes] = useState(
    Number(localStorage.getItem("afkTimeoutMinutes")) || 5
  );

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

  function updateAfkTimeoutMinutes(newTimeout: number) {
    setAfkTimeoutMinutes(newTimeout);
    localStorage.setItem("afkTimeoutMinutes", newTimeout.toString());
  }

  function updateShowDebugOverlay(show: boolean) {
    setShowDebugOverlay(show);
    localStorage.setItem("showDebugOverlay", show.toString());
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


  function updateHasSeenWelcome() {
    updateStorage("hasSeenWelcome", "true", setHasSeenWelcome);

    if (!localStorage.getItem("nickname")) {
      setShowNickname(true);
    }
  }

  // Convenience function to open settings and optionally select a tab
  function openSettings(tab: string = "appearance") {
    setSettingsTab(tab);
    setShowSettings(true);
  }


  // Enhanced mute/deafen logic with state coordination
  function setIsMuted(muted: boolean) {
    console.log(`🔇 setIsMuted called: ${muted}, currently deafened: ${isDeafened}`);
    
    if (muted) {
      // Muting: just mute, don't affect deafen state
      setIsMutedState(true);
    } else {
      // Unmuting: if we're deafened, also undeafen
      setIsMutedState(false);
      if (isDeafened) {
        console.log("🔇 Unmuting while deafened - also undeafening");
        setIsDeafenedState(false);
      }
    }
  }

  function setIsDeafened(deafened: boolean) {
    console.log(`🔇 setIsDeafened called: ${deafened}, currently muted: ${isMuted}`);
    
    if (deafened) {
      // Deafening: store current mute state and mute
      setPreDeafenMuteState(isMuted);
      setIsDeafenedState(true);
      setIsMutedState(true);
      console.log(`🔇 Deafening - stored pre-deafen mute state: ${isMuted}, now muted: true`);
    } else {
      // Undeafening: restore previous mute state
      setIsDeafenedState(false);
      setIsMutedState(preDeafenMuteState);
      console.log(`🔇 Undeafening - restored mute state to: ${preDeafenMuteState}`);
    }
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
    openSettings,
    showNickname,
    setShowNickname,
    hasSeenWelcome,
    updateHasSeenWelcome,
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
    // AFK settings
    isAFK,
    setIsAFK,
    afkTimeoutMinutes,
    setAfkTimeoutMinutes: updateAfkTimeoutMinutes,
    // Debug overlay settings
    showDebugOverlay,
    setShowDebugOverlay: updateShowDebugOverlay,
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


  hasSeenWelcome: !!localStorage.getItem("hasSeenWelcome"),
  updateHasSeenWelcome: () => {},


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

  settingsTab: "appearance",
  setSettingsTab: () => {},
  openSettings: () => {},

  // AFK settings
  isAFK: false,
  setIsAFK: () => {},
  afkTimeoutMinutes: 5,
  setAfkTimeoutMinutes: () => {},

  // Debug overlay settings
  showDebugOverlay: localStorage.getItem("showDebugOverlay") === "true",
  setShowDebugOverlay: () => {},
};

export const useSettings = singletonHook(init, useSettingsHook);
