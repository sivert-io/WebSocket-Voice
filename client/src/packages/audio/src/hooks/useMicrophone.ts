import { useEffect, useMemo, useState, useRef, useCallback } from "react";
import { singletonHook } from "react-singleton-hook";

import { getIsBrowserSupported } from "@/audio";
import { useSettings } from "@/settings";

import { MicrophoneBufferType, MicrophoneInterface } from "../types/Microphone";
import { useHandles } from "./useHandles";
import { useNoiseSuppression } from "./useNoiseSuppression";

function useCreateMicrophoneHook() {
  const { handles, addHandle, removeHandle, isLoaded } = useHandles(); // Custom hook for managing handles
  const { loopbackEnabled, noiseSuppressionEnabled } = useSettings(); // Settings for audio loopback and noise suppression
  const [audioContext, setAudioContext] = useState<AudioContext | undefined>(
    undefined
  );

  const isBrowserSupported = useMemo(() => getIsBrowserSupported(), []); // Check browser compatibility
  const [devices, setDevices] = useState<InputDeviceInfo[]>([]); // Stores available input devices
  const [micStream, setStream] = useState<MediaStream | undefined>(undefined); // Stores microphone stream
  const { micID, micVolume } = useSettings(); // Fetch microphone ID and volume settings
  
  // Initialize noise suppression
  const noiseSuppression = useNoiseSuppression();

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

      // Create audio processing chain with optional noise suppression
      if (noiseSuppressionEnabled) {
        // Chain: input → noise suppression → analyser → destination
        noiseSuppression.processAudio(input, audioContext)
          .then((processedNode) => {
            processedNode.connect(analyser);
            analyser.connect(inputDestination);
          })
          .catch((error) => {
            console.error("Failed to setup noise suppression, using direct connection:", error);
            // Fallback to direct connection
            input.connect(analyser);
            analyser.connect(inputDestination);
          });
      } else {
        // Direct chain: input → analyser → destination
        input.connect(analyser);
        analyser.connect(inputDestination);
      }

      return { input, output: streamSource, analyser };
    }

    return {};
  }, [audioContext, noiseSuppressionEnabled, noiseSuppression]);

  // Retrieve available audio input devices (only when needed)
  const getDevices = useCallback(async () => {
    if (!isBrowserSupported) return;

    try {
      // Request permission to enumerate devices
      await navigator.mediaDevices.getUserMedia({
        audio: {
          autoGainControl: false,
          echoCancellation: false,
          noiseSuppression: false,
        },
      });

      const allDevices = await navigator.mediaDevices.enumerateDevices();
      const audioDevices = allDevices.filter((d) => d.kind === "audioinput");
      setDevices(audioDevices as InputDeviceInfo[]);
      console.log("Audio input devices fetched: ", audioDevices);
    } catch (error) {
      console.error("Error getting audio devices:", error);
    }
  }, [isBrowserSupported]); // Only depend on isBrowserSupported which is stable

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
  }, [micID, audioContext, handles, microphoneBuffer.input, micStream]);

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
    getDevices, // Expose device fetching function
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
  getDevices: async () => {},
};

// Singleton hook instance for microphone access
const singletonMicrophone = singletonHook(init, useCreateMicrophoneHook);

// Hook for managing microphone access and ensuring it follows component lifecycle
export const useMicrophone = (shouldAccess: boolean = false) => {
  const mic = singletonMicrophone();
  const handleIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!shouldAccess) {
      // If we shouldn't access but have a handle, remove it
      if (handleIdRef.current) {
        console.log("useMicrophone: Removing handle with ID:", handleIdRef.current);
        mic.removeHandle(handleIdRef.current);
        handleIdRef.current = null;
      }
      return;
    }

    // If we should access but don't have a handle, add one
    if (!handleIdRef.current) {
      const id = self.crypto.randomUUID();
      handleIdRef.current = id;
      console.log("useMicrophone: Adding handle with ID:", id);
      mic.addHandle(id);
    }

    return () => {
      // Cleanup on component unmount
      if (handleIdRef.current) {
        console.log("useMicrophone: Removing handle with ID:", handleIdRef.current);
        mic.removeHandle(handleIdRef.current);
        handleIdRef.current = null;
      }
    };
  }, [shouldAccess]); // Only depend on shouldAccess

  return mic;
};
