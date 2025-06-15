import { useEffect, useMemo, useState, useRef, useCallback } from "react";
import { singletonHook } from "react-singleton-hook";

import { getIsBrowserSupported } from "@/audio";
import { useSettings } from "@/settings";

import { MicrophoneBufferType, MicrophoneInterface } from "../types/Microphone";
import { useHandles } from "./useHandles";
import { useNoiseSuppression } from "./useNoiseSuppression";

function useCreateMicrophoneHook() {
  const { handles, addHandle, removeHandle, isLoaded } = useHandles();
  const { 
    loopbackEnabled, 
    noiseSuppressionEnabled, 
    micID, 
    micVolume, 
    isMuted: globalMuted, 
    setIsMuted: setGlobalMuted,
    noiseGate
  } = useSettings();
  
  const [audioContext, setAudioContext] = useState<AudioContext | undefined>(undefined);
  const [devices, setDevices] = useState<InputDeviceInfo[]>([]);
  const [micStream, setMicStream] = useState<MediaStream | undefined>(undefined);
  const [isLocalMuted, setIsLocalMuted] = useState(false);
  const [currentDeviceId, setCurrentDeviceId] = useState<string | undefined>(micID);
  
  // Store the current source node to prevent multiple connections
  const sourceNodeRef = useRef<MediaStreamAudioSourceNode | null>(null);
  
  // Store the loopback gain node to prevent multiple connections
  const loopbackGainRef = useRef<GainNode | null>(null);
  
  const isBrowserSupported = useMemo(() => getIsBrowserSupported(), []);
  const noiseSuppression = useNoiseSuppression();
  
  // Combined mute state (local mute OR global mute)
  const isMuted = useMemo(() => isLocalMuted || globalMuted, [isLocalMuted, globalMuted]);

  // Manage shared AudioContext lifecycle
  useEffect(() => {
    console.log("🎤 AudioContext lifecycle - handles:", handles.length, "context exists:", !!audioContext);
    
    if (handles.length > 0 && !audioContext) {
      console.log("🎤 Creating shared AudioContext");
      const context = new AudioContext();
      setAudioContext(context);
    } else if (handles.length === 0 && audioContext) {
      console.log("🎤 Closing shared AudioContext");
      audioContext.close().catch(console.error);
      setAudioContext(undefined);
    }
  }, [handles.length, audioContext]);

  // Enhanced microphone buffer with full audio processing chain
  const microphoneBuffer = useMemo<MicrophoneBufferType>(() => {
    if (!audioContext) {
      console.log("🎤 No AudioContext - returning empty buffer");
      return {};
    }

    console.log("🎤 Creating enhanced microphone buffer with processing chain");
    
    // Core audio nodes
    const input = audioContext.createGain();
    const volumeGain = audioContext.createGain();
    const rawOutput = audioContext.createGain(); // For raw audio monitoring
    const noiseGate = audioContext.createGain();
    const muteGain = audioContext.createGain();
    const analyser = audioContext.createAnalyser(); // Raw audio analyser for noise gate
    const finalAnalyser = audioContext.createAnalyser(); // Final processed audio analyser
    const outputDestination = audioContext.createMediaStreamDestination();
    const output = audioContext.createMediaStreamSource(outputDestination.stream);

    // Configure analysers for better visualization
    analyser.fftSize = 256;
    analyser.smoothingTimeConstant = 0.8;
    finalAnalyser.fftSize = 256;
    finalAnalyser.smoothingTimeConstant = 0.8;

    // Set default gain values (will be updated by useEffects)
    volumeGain.gain.value = 2.0; // Default to 100% (2.0 gain), will be updated by volume effect
    rawOutput.gain.value = 1; // Raw monitoring output
    noiseGate.gain.value = 1; // Default to open, will be controlled by noise gate logic
    muteGain.gain.value = 1; // Default to 1, will be updated by mute effect

    // Build the audio processing chain
    let processingChain = input;
    
    // Step 1: Volume control
    processingChain.connect(volumeGain);
    processingChain = volumeGain;

    // Step 2: Connect raw analyser and raw output for noise gate monitoring
    processingChain.connect(analyser); // Raw audio for noise gate threshold
    processingChain.connect(rawOutput); // Raw audio backup (not used for loopback anymore)

    // Step 3: Noise suppression (if enabled and we have active handles)
    let noiseSuppressionNode: AudioWorkletNode | undefined;
    if (noiseSuppressionEnabled && handles.length > 0) {
      console.log("🎤 Setting up RNNoise processing");
      noiseSuppression.processAudio(processingChain, audioContext)
        .then((processedNode) => {
          console.log("✅ RNNoise connected successfully");
          noiseSuppressionNode = processedNode as AudioWorkletNode;
          processedNode.connect(noiseGate);
        })
        .catch((error) => {
          console.warn("⚠️ RNNoise failed, using direct connection:", error);
          processingChain.connect(noiseGate);
        });
    } else {
      console.log("🎤 Using direct audio connection (no noise suppression)");
      processingChain.connect(noiseGate);
    }

    // Step 4: Noise gate control (applied to output stream only)
    noiseGate.connect(muteGain);

    // Step 5: Mute control and final output with final analyser
    muteGain.connect(finalAnalyser); // Final processed audio for UI and loopback
    finalAnalyser.connect(outputDestination);

    const buffer: MicrophoneBufferType = {
      input,
      output,
      rawOutput,
      analyser, // Raw audio analyser (for noise gate only)
      finalAnalyser, // Final processed audio analyser (for UI and loopback)
      mediaStream: micStream || new MediaStream(), // Raw microphone stream
      processedStream: outputDestination.stream, // Processed stream for SFU
      muteGain,
      volumeGain,
      noiseGate,
      noiseSuppressionNode
    };

    console.log("🎤 Enhanced microphone buffer created:", {
      hasInput: !!buffer.input,
      hasOutput: !!buffer.output,
      hasRawOutput: !!buffer.rawOutput,
      hasAnalyser: !!buffer.analyser,
      hasFinalAnalyser: !!buffer.finalAnalyser,
      hasMediaStream: !!buffer.mediaStream,
      hasProcessedStream: !!buffer.processedStream,
      hasMuteGain: !!buffer.muteGain,
      hasVolumeGain: !!buffer.volumeGain,
      hasNoiseSuppression: !!buffer.noiseSuppressionNode,
      rawStreamActive: buffer.mediaStream?.active,
      processedStreamActive: buffer.processedStream?.active
    });

    return buffer;
  }, [audioContext, noiseSuppressionEnabled, handles.length]);

  // Device enumeration with permission handling
  const getDevices = useCallback(async () => {
    if (!isBrowserSupported) {
      console.warn("🎤 Browser not supported for device enumeration");
      return;
    }

    try {
      console.log("🎤 Enumerating audio devices...");
      
      // Request permission first - using truly raw audio constraints
      await navigator.mediaDevices.getUserMedia({
        audio: {
          // Disable all WebRTC audio processing
          autoGainControl: false,
          echoCancellation: false,
          noiseSuppression: false,
        },
      });

      const allDevices = await navigator.mediaDevices.enumerateDevices();
      const audioDevices = allDevices.filter((d) => d.kind === "audioinput") as InputDeviceInfo[];
      
      console.log("🎤 Found audio devices:", audioDevices.length);
      setDevices(audioDevices);

      // Auto-select device from localStorage or first available
      if (audioDevices.length > 0) {
        let selectedDeviceId = currentDeviceId;
        
        // Check if stored device is still available
        if (selectedDeviceId && !audioDevices.find(d => d.deviceId === selectedDeviceId)) {
          console.log("🎤 Stored device not found, selecting first available");
          selectedDeviceId = audioDevices[0].deviceId;
        } else if (!selectedDeviceId) {
          console.log("🎤 No stored device, selecting first available");
          selectedDeviceId = audioDevices[0].deviceId;
        }

        if (selectedDeviceId !== currentDeviceId) {
          setCurrentDeviceId(selectedDeviceId);
        }
      }
    } catch (error) {
      console.error("🎤 Error enumerating devices:", error);
    }
  }, [isBrowserSupported, currentDeviceId]);

  // Enhanced device management with localStorage integration
  useEffect(() => {
    console.log("🎤 Device management effect:", {
      handlesLength: handles.length,
      currentDeviceId,
      hasAudioContext: !!audioContext,
      hasStream: !!micStream
    });

    async function initializeDevice(deviceId: string | undefined) {
      if (!deviceId) {
        console.log("🎤 No device ID provided");
        return;
      }

      try {
        console.log("🎤 Initializing device:", deviceId);
        
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            deviceId: { exact: deviceId },
            // Disable all WebRTC audio processing for truly raw audio
            autoGainControl: false,
            echoCancellation: false,
            noiseSuppression: false,
            // High quality raw capture settings
            channelCount: 1,
            sampleRate: 48000,
            sampleSize: 16,
          },
        });

        console.log("🎤 Device stream acquired:", {
          id: stream.id,
          active: stream.active,
          audioTracks: stream.getAudioTracks().length,
          settings: stream.getAudioTracks()[0]?.getSettings()
        });

        // Stop previous stream
        if (micStream) {
          console.log("🎤 Stopping previous stream");
          micStream.getTracks().forEach(track => track.stop());
        }

        setMicStream(stream);
        
        // Update localStorage
        if (deviceId !== micID) {
          console.log("🎤 Updating stored device ID");
          localStorage.setItem("micID", deviceId);
        }

      } catch (error) {
        console.error("🎤 Failed to initialize device:", error);
        
        // Try fallback to any available device
        try {
          const fallbackStream = await navigator.mediaDevices.getUserMedia({
            audio: {
              // Disable all WebRTC audio processing for truly raw audio
              autoGainControl: false,
              echoCancellation: false,
              noiseSuppression: false,
              // High quality raw capture settings
              channelCount: 1,
              sampleRate: 48000,
              sampleSize: 16,
            },
          });
          
          console.log("🎤 Fallback stream acquired");
          if (micStream) {
            micStream.getTracks().forEach(track => track.stop());
          }
          setMicStream(fallbackStream);
          
        } catch (fallbackError) {
          console.error("🎤 Fallback device access failed:", fallbackError);
        }
      }
    }

    if (handles.length > 0) {
      initializeDevice(currentDeviceId);
    } else {
      // Clean up when no handles
      if (micStream) {
        console.log("🎤 Cleaning up stream - no active handles");
        micStream.getTracks().forEach(track => track.stop());
        setMicStream(undefined);
      }
    }
  }, [handles.length, currentDeviceId]);

  // Connect microphone stream to processing chain - with proper cleanup
  useEffect(() => {
    // Cleanup previous connection
    if (sourceNodeRef.current) {
      console.log("🎤 Disconnecting previous source node");
      try {
        sourceNodeRef.current.disconnect();
      } catch (error) {
        // Ignore disconnect errors
      }
      sourceNodeRef.current = null;
    }

    if (micStream && audioContext && microphoneBuffer.input) {
      console.log("🎤 Connecting microphone stream to processing chain");
      
      try {
        const sourceNode = audioContext.createMediaStreamSource(micStream);
        sourceNode.connect(microphoneBuffer.input);
        sourceNodeRef.current = sourceNode; // Store reference for cleanup
        console.log("✅ Microphone connected to processing chain");
      } catch (error) {
        console.error("❌ Failed to connect microphone to processing chain:", error);
      }
    }

    // Cleanup function
    return () => {
      if (sourceNodeRef.current) {
        console.log("🎤 Cleanup - disconnecting source node");
        try {
          sourceNodeRef.current.disconnect();
        } catch (error) {
          // Ignore disconnect errors
        }
        sourceNodeRef.current = null;
      }
    };
  }, [micStream, audioContext, microphoneBuffer.input]);

  // Volume control updates
  useEffect(() => {
    if (microphoneBuffer.volumeGain) {
      const gainValue = micVolume / 50; // Convert 0-100 to 0-2 range
      microphoneBuffer.volumeGain.gain.setValueAtTime(gainValue, audioContext?.currentTime || 0);
      console.log("🔊 Volume updated:", gainValue);
    }
  }, [micVolume, microphoneBuffer.volumeGain, audioContext]);

  // Mute control updates
  useEffect(() => {
    if (microphoneBuffer.muteGain) {
      const gainValue = isMuted ? 0 : 1;
      microphoneBuffer.muteGain.gain.setValueAtTime(gainValue, audioContext?.currentTime || 0);
      console.log("🔇 Mute updated:", isMuted);
    }
  }, [isMuted, microphoneBuffer.muteGain, audioContext]);

  // Noise gate control - monitors audio level and gates below threshold
  useEffect(() => {
    if (!microphoneBuffer.analyser || !microphoneBuffer.noiseGate || !audioContext) {
      return;
    }

    let animationFrame: number;
    const bufferLength = microphoneBuffer.analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    const checkNoiseGate = () => {
      microphoneBuffer.analyser!.getByteFrequencyData(dataArray);
      
      // Calculate RMS (Root Mean Square) for more accurate volume detection
      let sum = 0;
      for (let i = 0; i < bufferLength; i++) {
        sum += dataArray[i] * dataArray[i];
      }
      const rms = Math.sqrt(sum / bufferLength);
      const volume = (rms / 255) * 100; // Convert to 0-100 scale

      // Apply noise gate
      const shouldGate = volume < noiseGate;
      const gateValue = shouldGate ? 0 : 1;
      
      microphoneBuffer.noiseGate!.gain.setValueAtTime(
        gateValue, 
        audioContext!.currentTime
      );

      animationFrame = requestAnimationFrame(checkNoiseGate);
    };

    checkNoiseGate();

    return () => {
      if (animationFrame) {
        cancelAnimationFrame(animationFrame);
      }
    };
  }, [microphoneBuffer.analyser, microphoneBuffer.noiseGate, audioContext, noiseGate]);

  // Loopback (monitoring) control - uses FINAL processed audio so users hear what others hear
  useEffect(() => {
    if (microphoneBuffer.finalAnalyser && audioContext) {
      try {
        // Clean up previous loopback connection
        if (loopbackGainRef.current) {
          loopbackGainRef.current.disconnect();
          loopbackGainRef.current = null;
        }

        // Create new loopback gain node
        const loopbackGain = audioContext.createGain();
        loopbackGain.gain.value = 1;
        loopbackGainRef.current = loopbackGain;
        
        // Connect finalAnalyser to loopback gain
        microphoneBuffer.finalAnalyser.connect(loopbackGain);
        
        if (loopbackEnabled) {
          loopbackGain.connect(audioContext.destination);
          console.log("🔊 Loopback enabled (final processed audio)");
        } else {
          console.log("🔇 Loopback disabled");
        }
      } catch (error) {
        console.error("❌ Loopback control error:", error);
      }
    }

    // Cleanup function
    return () => {
      if (loopbackGainRef.current) {
        try {
          loopbackGainRef.current.disconnect();
        } catch (error) {
          // Ignore disconnect errors
        }
        loopbackGainRef.current = null;
      }
    };
  }, [loopbackEnabled, microphoneBuffer.finalAnalyser, audioContext]);

  // Visualizer data extraction - now returns FINAL processed audio
  const getVisualizerData = useCallback((): Uint8Array | null => {
    if (!microphoneBuffer.finalAnalyser) {
      return null;
    }

    const bufferLength = microphoneBuffer.finalAnalyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    microphoneBuffer.finalAnalyser.getByteFrequencyData(dataArray);
    return dataArray;
  }, [microphoneBuffer.finalAnalyser]);

  // Mute control functions
  const setMuted = useCallback((muted: boolean) => {
    console.log("🔇 Local mute changed:", muted);
    setIsLocalMuted(muted);
  }, []);

  return {
    addHandle,
    removeHandle,
    microphoneBuffer,
    isBrowserSupported,
    devices,
    audioContext,
    isLoaded,
    getDevices,
    isMuted,
    setMuted,
    getVisualizerData,
  };
}

// Enhanced initialization with mute support
const init: MicrophoneInterface = {
  devices: [],
  isBrowserSupported: undefined,
  microphoneBuffer: {
    input: undefined,
    output: undefined,
    rawOutput: undefined,
    analyser: undefined,
    finalAnalyser: undefined,
    mediaStream: undefined,
    processedStream: undefined,
    muteGain: undefined,
    volumeGain: undefined,
    noiseGate: undefined,
    noiseSuppressionNode: undefined,
  },
  audioContext: undefined,
  addHandle: () => {},
  removeHandle: () => {},
  isLoaded: false,
  getDevices: async () => {},
  isMuted: false,
  setMuted: () => {},
  getVisualizerData: () => null,
};

// Singleton hook instance
const singletonMicrophone = singletonHook(init, useCreateMicrophoneHook);

// Enhanced consumer hook with automatic handle management
export const useMicrophone = (shouldAccess: boolean = false) => {
  const mic = singletonMicrophone();
  const handleIdRef = useRef<string | null>(null);

  // console.log("🎤 useMicrophone called - shouldAccess:", shouldAccess, "handleId:", handleIdRef.current);

  useEffect(() => {
    if (!shouldAccess) {
      if (handleIdRef.current) {
        console.log("🎤 Releasing microphone handle:", handleIdRef.current);
        mic.removeHandle(handleIdRef.current);
        handleIdRef.current = null;
      }
      return;
    }

    if (!handleIdRef.current) {
      const id = self.crypto.randomUUID();
      handleIdRef.current = id;
      console.log("🎤 Acquiring microphone handle:", id);
      mic.addHandle(id);
    }

    return () => {
      if (handleIdRef.current) {
        console.log("🎤 Cleanup - releasing handle:", handleIdRef.current);
        mic.removeHandle(handleIdRef.current);
        handleIdRef.current = null;
      }
    };
  }, [shouldAccess]);

  return mic;
};
