import { useState } from "react";
import { singletonHook } from "react-singleton-hook";

interface Settings {
  micID?: string;
  nickname: string;
  setMicID: (id: string) => any;
  setNickname: (name: string) => any;
  micVolume: number;
  setMicVolume: (num: number) => any;
  noiseGate: number;
  setNoiseGate: (num: number) => any;
}

function updateStorage(key: string, value: string, useState: (d: any) => any) {
  useState(value);
  localStorage.setItem(key, value);
}

function settingsHook() {
  const [micID, setMicID] = useState(
    localStorage.getItem("micID") || undefined
  );
  const [nickname, setNickname] = useState(
    localStorage.getItem("nickname") || ""
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
  };
}

const init: Settings = {
  micID: localStorage.getItem("micID") || undefined,
  nickname: localStorage.getItem("nickname") || "",
  setMicID: () => {},
  setNickname: () => {},
  micVolume: Number(localStorage.getItem("micVolume")) || 50,
  setMicVolume: () => {},
  noiseGate: Number(localStorage.getItem("noiseGate") || 10),
  setNoiseGate: () => {},
};

export const useSettings = singletonHook(init, settingsHook);
