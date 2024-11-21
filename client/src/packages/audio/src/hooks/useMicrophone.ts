import { useEffect, useMemo, useState } from "react";
import { singletonHook } from "react-singleton-hook";
import { useSettings } from "@/settings";
import { useHandles } from "./useHandles";
import { getIsBrowserSupported } from "@/audio";
import { MicrophoneBufferType, MicrophoneInterface } from "../types/Microphone";

function createMicrophoneHook() {
  const { handles, addHandle, removeHandle, isLoaded } = useHandles(); // Custom hook for managing handles
  const { loopbackEnabled } = useSettings(); // Settings for audio loopback (live feedback)
  const [audioContext, setAudioContext] = useState<AudioContext | undefined>(
    undefined
  );

  const isBrowserSupported = useMemo(() => getIsBrowserSupported(), []); // Check browser compatibility
  const [devices, setDevices] = useState<InputDeviceInfo[]>([]); // Stores available input devices
  const [micStream, setStream] = useState<MediaStream | undefined>(undefined); // Stores microphone stream
  const { micID, micVolume } = useSettings(); // Fetch microphone ID and volume settings

  // Manage audio context based on handle count
  useEffect(() => {
    // console.log("useEffect: handles length = ", handles.length);

    if (handles.length > 0 && !audioContext) {
      const context = new AudioContext();
      setAudioContext(context);
      // console.log("New AudioContext created.");
    } else if (handles.length === 0 && audioContext) {
      // Close audio context when no handles are active
      audioContext.close();
      setAudioContext(undefined);
      // console.log("AudioContext closed.");
    }
  }, [handles, audioContext]);

  // Create and return a microphone buffer using the current audio context
  const microphoneBuffer = useMemo<MicrophoneBufferType>(() => {
    // console.log(
    //   "useMemo: Creating microphone buffer with audioContext",
    //   audioContext
    // );

    if (audioContext) {
      const input = audioContext.createGain(); // Gain node for adjusting volume
      const analyser = audioContext.createAnalyser(); // Analyser for audio data
      const inputDestination = audioContext.createMediaStreamDestination(); // Creates an output stream
      const streamSource = audioContext.createMediaStreamSource(
        inputDestination.stream
      );

      input.connect(analyser); // Connects gain to analyser
      analyser.connect(inputDestination); // Pass-through to destination

      return { input, output: streamSource, analyser };
    }

    return {};
  }, [audioContext]);

  // Retrieve available audio input devices
  useEffect(() => {
    // console.log("useEffect: Checking browser support and fetching devices");

    if (isBrowserSupported) {
      navigator.mediaDevices
        .getUserMedia({
          audio: {
            autoGainControl: false,
            echoCancellation: false,
            noiseSuppression: false,
          },
        })
        .then(() => {
          navigator.mediaDevices.enumerateDevices().then((devices) => {
            const audioDevices = devices.filter((d) => d.kind === "audioinput");
            setDevices(audioDevices as InputDeviceInfo[]);
            // console.log("Audio input devices fetched: ", audioDevices);
          });
        });
    }
  }, [isBrowserSupported]);

  // Update microphone stream when mic ID or handles change
  useEffect(() => {
    // console.log("useEffect: micID or handles changed. micID:", micID);

    async function changeDevice(id: string | undefined) {
      if (!id) {
        console.log("Missing capture device ID.");
        return;
      }

      try {
        const _stream: MediaStream = await navigator.mediaDevices.getUserMedia({
          audio: {
            deviceId: id,
            autoGainControl: false,
            echoCancellation: false,
            noiseSuppression: false,
          },
        });

        // console.log("New media stream created for device ID:", id);

        // Stop any previous stream before applying the new one
        if (micStream) {
          micStream.getTracks().forEach((track) => track.stop());
          // console.log("Previous stream tracks stopped.");
        }

        if (audioContext && microphoneBuffer.input) {
          const mediaStream = audioContext.createMediaStreamSource(_stream);
          const splitter = audioContext.createChannelSplitter(2); // Splits audio into separate channels
          const merger = audioContext.createChannelMerger(1); // Merges channels back into one output

          mediaStream.connect(splitter);
          splitter.connect(merger, 0, 0); // Connect left channel to merged output
          splitter.connect(merger, 1, 0); // Connect right channel to merged output

          merger.connect(microphoneBuffer.input); // Connect merged audio to input
          // console.log("Media stream connected to microphone buffer.");
        }
        setStream(_stream);
      } catch (error) {
        console.error("Error accessing microphone:", error);
      }
    }

    if (handles.length > 0) {
      changeDevice(micID);
    } else {
      if (micStream) {
        micStream.getTracks().forEach((track) => track.stop()); // Stop microphone stream if no handles
        setStream(undefined);
        console.log("No handles, stopping microphone stream.");
      }
    }
  }, [micID, audioContext, handles]);

  // Adjust input gain based on volume setting
  useEffect(() => {
    if (microphoneBuffer.input) {
      microphoneBuffer.input.gain.value = micVolume / 50;
    }
  }, [micVolume, microphoneBuffer]);

  // Toggle audio loopback based on settings
  useEffect(() => {
    try {
      if (microphoneBuffer.output && audioContext) {
        if (loopbackEnabled) {
          microphoneBuffer.output.connect(audioContext.destination); // Connect output for playback
          console.log("Loopback enabled, connected to audio context.");
        } else if (audioContext.destination.numberOfOutputs > 0) {
          microphoneBuffer.output.disconnect(audioContext.destination); // Disconnect playback output
          console.log("Loopback disabled, disconnected from audio context.");
        }
      }
    } catch (e) {
      console.error("Error toggling loopback:", e);
    }
  }, [loopbackEnabled, audioContext, microphoneBuffer.output]);

  return {
    addHandle,
    removeHandle,
    microphoneBuffer,
    isBrowserSupported,
    devices,
    audioContext,
    isLoaded,
  };
}

// Default initialization for the microphone hook singleton
const init: MicrophoneInterface = {
  devices: [],
  isBrowserSupported: undefined,
  microphoneBuffer: {
    input: undefined,
    output: undefined,
    analyser: undefined,
  },
  audioContext: undefined,
  addHandle: () => {},
  removeHandle: () => {},
  isLoaded: false,
};

// Singleton hook instance for microphone access
const singletonMicrophone = singletonHook(init, createMicrophoneHook);

// Hook for managing microphone access and ensuring it follows component lifecycle
export const useMicrophone = () => {
  const mic = singletonMicrophone();

  useEffect(() => {
    const id = self.crypto.randomUUID();
    // console.log("useMicrophone: Adding handle with ID:", id);
    mic.addHandle(id);

    return () => {
      // console.log("useMicrophone: Removing handle with ID:", id);
      mic.removeHandle(id); // Cleanup on component unmount
    };
  }, [mic.isLoaded]);

  return mic;
};
