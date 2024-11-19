import { useState } from "react";
import { singletonHook } from "react-singleton-hook";

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
}

function updateStorage(key: string, value: string, useState: (d: any) => any) {
  useState(value);
  localStorage.setItem(key, value);
}

function settingsHook() {
  const [showSettings, setShowSettings] = useState(false);
  const [showNickname, setShowNickname] = useState(
    !!!localStorage.getItem("nickname")
  );
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
};

export const useSettings = singletonHook(init, settingsHook);
