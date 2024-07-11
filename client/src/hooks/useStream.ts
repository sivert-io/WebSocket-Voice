import { useState } from "react";
import { singletonHook } from "react-singleton-hook";

interface Stream {
  isMuted: boolean;
  setIsMuted: (v: boolean) => any;
}

function streamHook() {
  const [isMuted, setIsMuted] = useState(false);

  return {
    isMuted,
    setIsMuted,
  };
}

const init: Stream = {
  isMuted: false,
  setIsMuted: () => {},
};

export const useStream = singletonHook(init, streamHook);
