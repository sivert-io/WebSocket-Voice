import { useEffect, useState } from "react";
import { singletonHook } from "react-singleton-hook";
import { useMicrophone } from "./useMicrophone";
import { useSocket } from "./useSocket";

interface Stream {
  isMuted: boolean;
  setIsMuted: (v: boolean) => any;
  streams: readonly MediaStream[];
}

// iceServers as empty array to force no ICE used
const peerConfig: RTCConfiguration = {
  iceServers: [],
};

function streamHook() {
  const [isMuted, setIsMuted] = useState(false);
  const [peerConnection] = useState(new RTCPeerConnection(peerConfig)); // Step 2: Create RTCPeerConnection object
  const [streams, setStreams] = useState<readonly MediaStream[]>([]);

  const { microphoneBuffer } = useMicrophone(); // Step 1: Initialize local media stream
  const { sendMessage } = useSocket();

  // Add tracks to SFU
  useEffect(() => {
    // Step 3: Add tracks we will send to SFU
    microphoneBuffer.output?.mediaStream.getTracks().forEach((track) => {
      peerConnection.addTrack(track);
    });
  }, [peerConnection, microphoneBuffer.output]);

  // SFU communication
  useEffect(() => {
    // Step 4: Handle incoming stream from SFU
    peerConnection.ontrack = function (event) {
      setStreams(event.streams);
    };

    async function createSDPoffer() {
      try {
        // Step 5: Create SDP offer to send to the SFU (through signaling server)
        const offer = await peerConnection.createOffer();
        peerConnection.setLocalDescription(offer);
        sendMessage({
          message: "offer",
          value: peerConnection.localDescription,
        });
      } catch (error) {
        console.log("Failed to create SDP offer", error);
      }
    }

    createSDPoffer();
  }, [peerConnection]);

  return {
    isMuted,
    setIsMuted,
    streams,
  };
}

const init: Stream = {
  isMuted: false,
  setIsMuted: () => {},
  streams: [],
};

export const useStream = singletonHook(init, streamHook);
