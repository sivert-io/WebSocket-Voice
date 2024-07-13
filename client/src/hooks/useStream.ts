import { useEffect, useState } from "react";
import { singletonHook } from "react-singleton-hook";
import { useMicrophone } from "./useMicrophone";
import { useSocket } from "./useSocket";

interface Stream {
  isMuted: boolean;
  setIsMuted: (v: boolean) => any;
  streams: readonly MediaStream[];
}

function getStunServers() {
  const stunServers = [];
  if (import.meta.env.VITE_STUN_SERVERS) {
    const urls: string[] = import.meta.env.VITE_STUN_SERVERS.split(",");
    urls.forEach((url) => {
      stunServers.push(`stun:${url}`);
    });
  } else {
    stunServers.push("stun.l.google.com:19302");
  }
  return stunServers;
}

const configuration: RTCConfiguration = {
  iceServers: [
    { urls: getStunServers() }, // Example of a public STUN server provided by Google
  ],
};

import.meta.env.VITE_TURN_HOST &&
  configuration.iceServers?.push({
    urls: import.meta.env.VITE_TURN_HOST,
    username: import.meta.env.VITE_TURN_USERNAME,
    credential: import.meta.env.VITE_TURN_PASSWORD,
  });

// Handles how client interacts with SFU server via signaling server
function streamHook() {
  const [isMuted, setIsMuted] = useState(false);
  const { microphoneBuffer } = useMicrophone(); // Step 1: Initialize local media stream
  const [peerConnection] = useState(new RTCPeerConnection(configuration)); // Step 2: Create RTCPeerConnection object
  const [streams, setStreams] = useState<readonly MediaStream[]>([]);

  const { sendMessage, addOnMessage } = useSocket();

  // Add tracks to peerConnection (these are streamed to SFU)
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
      setStreams(event.streams); // Update list of streams. We use this list of streams to play audio on client
    };

    async function createSDPoffer() {
      try {
        // Step 5: Create SDP offer to send to the SFU (through signaling server)
        const offer = await peerConnection.createOffer();
        await peerConnection.setLocalDescription(offer);

        // Send the offer to the SFU via signaling server
        sendMessage("offer", peerConnection.localDescription);
      } catch (error) {
        console.log("Failed to create SDP offer", error);
      }
    }

    createSDPoffer();
  }, [peerConnection]);

  // Respond to SFU SDP offer
  useEffect(() => {
    // Step 6: Handle SDP offer from the SFU (received via signaling server)
    async function respondToSDPoffer(value: any) {
      try {
        await peerConnection.setRemoteDescription(
          new RTCSessionDescription(value)
        );
        // Create SDP answer and send it back to the SFU
        const answer = await peerConnection.createAnswer();
        await peerConnection.setLocalDescription(answer);

        // Send the answer to the SFU via signaling server
        sendMessage("answer", peerConnection.localDescription);
      } catch (error) {
        console.log("Failed to create SDP response from SFU", error);
      }
    }

    addOnMessage("offer", respondToSDPoffer);
  }, []);

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
