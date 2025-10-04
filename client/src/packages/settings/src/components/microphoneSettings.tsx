import { ExclamationTriangleIcon, ReloadIcon } from "@radix-ui/react-icons";
import {
  Callout,
  Flex,
  Heading,
  IconButton,
  Select,
  Slider,
  Text,
  Tooltip,
} from "@radix-ui/themes";
import { useCallback, useEffect, useMemo,useRef, useState } from "react";

import { useMicrophone } from "@/audio";
import { useSettings } from "@/settings";
import { SettingsContainer, SliderSetting, ToggleSetting } from "./settingsComponents";

export function MicrophoneSettings() {
  const {
    micID,
    setMicID,
    micVolume,
    setMicVolume,
    outputVolume,
    setOutputVolume,
    noiseGate,
    setNoiseGate,
    setLoopbackEnabled,
    loopbackEnabled,
    afkTimeoutMinutes,
    setAfkTimeoutMinutes,
    rnnoiseEnabled,
    setRnnoiseEnabled,
  } = useSettings();

  // Always create a microphone handle to ensure audio processing works
  // The microphone needs to be active both for testing and for voice chat transmission
  const { devices, microphoneBuffer, getDevices, audioContext } = useMicrophone(true);

  // Get raw audio data for visualizer (before any processing)
  const getRawVisualizerData = useCallback((): Uint8Array | null => {
    if (!microphoneBuffer.analyser) {
      return null;
    }

    const bufferLength = microphoneBuffer.analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    microphoneBuffer.analyser.getByteFrequencyData(dataArray);
    return dataArray;
  }, [microphoneBuffer.analyser]);

  const [micLiveVolume, setMicLiveVolume] = useState(0); // Final processed volume for general display
  const [micRawVolume, setMicRawVolume] = useState(0); // Raw input volume for noise gate visualization
  const [isMicLive, setIsMicLive] = useState(false);
  const [visualizerData, setVisualizerData] = useState<Uint8Array | null>(null);
  const devicesLoadedRef = useRef(false);

  // console.log("MicrophoneSettings: Current micID =", micID, "isMuted =", isMuted);

  // Fetch devices when component mounts (only once)
  useEffect(() => {
    if (!devicesLoadedRef.current) {
      devicesLoadedRef.current = true;
      getDevices();
    }
  }, []); // Empty dependency array - only run once on mount

  // Auto-select first device when devices are loaded and no mic is selected
  useEffect(() => {
    if (devices.length > 0 && !micID) {
      const firstDevice = devices[0];
      // console.log("Auto-selecting first microphone device:", firstDevice.label, firstDevice.deviceId);
      setMicID(firstDevice.deviceId);
    }
  }, [devices, micID, setMicID]);

  // Enhanced audio monitoring - always monitor when microphone is available
  useEffect(() => {
    const interval = setInterval(() => {
      // Use RAW audio (analyser) for noise gate threshold detection
      if (microphoneBuffer.analyser) {
        const bufferLength = microphoneBuffer.analyser.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);
        microphoneBuffer.analyser.getByteFrequencyData(dataArray);
        
        // Calculate RMS for noise gate threshold (raw audio)
        let sum = 0;
        for (let i = 0; i < bufferLength; i++) {
          sum += dataArray[i] * dataArray[i];
        }
        const rms = Math.sqrt(sum / bufferLength);
        const rawVolume = (rms / 255) * 100;
        
        setMicRawVolume(rawVolume); // Store raw volume for noise gate slider
        const speaking = rawVolume > noiseGate; // Speaking if raw audio above noise gate threshold
        setIsMicLive(speaking);
      }

      // Use FINAL processed audio (finalAnalyser) for volume display and spectrum
      if (microphoneBuffer.finalAnalyser) {
        const bufferLength = microphoneBuffer.finalAnalyser.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);
        microphoneBuffer.finalAnalyser.getByteFrequencyData(dataArray);
        
        // Calculate RMS for volume display (final processed audio)
        let sum = 0;
        for (let i = 0; i < bufferLength; i++) {
          sum += dataArray[i] * dataArray[i];
        }
        const rms = Math.sqrt(sum / bufferLength);
        const finalVolume = (rms / 255) * 100;
        
        setMicLiveVolume(finalVolume); // Show final processed volume for general display
        
        // Get visualizer data from raw audio (before any processing)
        const vizData = getRawVisualizerData();
        setVisualizerData(vizData);
      }
    }, 16);

    return () => {
      clearInterval(interval);
      // Clear visualizer data on cleanup
      setVisualizerData(null);
    };
  }, [microphoneBuffer.analyser, microphoneBuffer.finalAnalyser, noiseGate, getRawVisualizerData]);

  // Simple visualizer component - memoized to prevent unnecessary re-renders
  const AudioVisualizer = useMemo(() => {
    return () => {
      if (!visualizerData) return null;

      // Create frequency bars using raw mic input - always show raw audio
      const bars = Array.from(visualizerData.slice(0, 32)).map((value, index) => {
        const height = Math.max(2, (value / 255) * 40); // Scale to 40px max height
        // Change color based on noise gate threshold - green if above threshold, gray if below
        const isAboveThreshold = micRawVolume > noiseGate;
        return (
          <div
            key={index}
            style={{
              width: '3px',
              height: `${height}px`,
              backgroundColor: isAboveThreshold ? '#10b981' : '#6b7280',
              marginRight: '1px',
              borderRadius: '1px',
              transition: 'height 0.1s ease-out, background-color 0.1s ease-out',
            }}
          />
        );
      });

      return (
        <Flex align="end" gap="0" style={{ height: '40px', padding: '4px' }}>
          {bars}
        </Flex>
      );
    };
  }, [visualizerData, micRawVolume, noiseGate]);

  return (
    <SettingsContainer>
      <Heading size="4">Microphone Settings</Heading>

        {!audioContext && (
          <Callout.Root color="orange">
            <Callout.Icon>
              <ExclamationTriangleIcon />
            </Callout.Icon>
            <Callout.Text>
              Microphone is initializing. Audio levels and noise gate will be visible once ready.
            </Callout.Text>
          </Callout.Root>
        )}

        {/* Device Selection */}
        <Flex direction="column" gap="2">
          <Flex align="center" justify="between">
            <Text weight="medium" size="2">
              Microphone Device
            </Text>
            <Tooltip content="Refresh device list">
              <IconButton variant="soft" size="1" onClick={getDevices}>
                <ReloadIcon />
              </IconButton>
            </Tooltip>
          </Flex>
          
          <Select.Root value={micID || ""} onValueChange={setMicID}>
            <Select.Trigger placeholder="Select microphone device" />
            <Select.Content>
              {devices.map((device) => (
                <Select.Item key={device.deviceId} value={device.deviceId}>
                  {device.label || `Microphone ${device.deviceId.slice(0, 8)}`}
                </Select.Item>
              ))}
            </Select.Content>
          </Select.Root>
        </Flex>

        {/* Audio Level Indicator - Always visible when microphone is active */}
        {audioContext && (
          <Flex direction="column" gap="2">
            <Text weight="medium" size="2">
              Audio Levels
            </Text>
            
            {/* Frequency Visualizer */}
            <Flex direction="column" gap="1">
              <Text size="1" color="gray">Audio Spectrum (Raw Input)</Text>
              <div style={{ 
                border: '1px solid var(--gray-6)', 
                borderRadius: '4px', 
                padding: '4px',
                backgroundColor: 'var(--gray-3)',
                minHeight: '48px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <AudioVisualizer />
              </div>
            </Flex>

            {/* Status Information */}
            <Flex direction="column" gap="1">
              <Text size="1" color="gray">
                Status: {audioContext ? "✅ Active" : "❌ Inactive"}
                {loopbackEnabled && " • 🔊 PLAYBACK ON"}
              </Text>
              {microphoneBuffer.processedStream && (
                <Text size="1" color="green">
                  ✅ Enhanced audio processing enabled
                </Text>
              )}
            </Flex>
          </Flex>
        )}

        {/* Enhanced Noise Gate with Real-time Audio Level */}
        <Flex direction="column" gap="2">
          <Text weight="medium" size="2">
            Noise Gate: {noiseGate}%
          </Text>
          <Text size="1" color="gray">
            Audio below this level will be muted. The indicator shows your raw microphone input level.
          </Text>
          
          {/* Noise Gate Slider with Audio Level Overlay */}
          <div style={{ position: 'relative' }}>
            <Slider
              value={[noiseGate]}
              onValueChange={(value) => setNoiseGate(value[0])}
              max={100}
              min={0}
              step={1}
              style={{ position: 'relative', zIndex: 2 }}
            />
            
            {/* Real-time RAW audio level indicator for noise gate */}
            {audioContext && (
              <div
                style={{
                  position: 'absolute',
                  top: '50%',
                  left: `${micRawVolume}%`,
                  transform: 'translate(-50%, -50%)',
                  width: '3px',
                  height: '20px',
                  backgroundColor: isMicLive ? '#10b981' : '#6b7280',
                  borderRadius: '2px',
                  zIndex: 3,
                  pointerEvents: 'none',
                  transition: 'left 0.1s ease-out, background-color 0.1s ease-out',
                }}
              />
            )}
            
            {/* RAW audio level background bar for noise gate visualization */}
            {audioContext && (
              <div
                style={{
                  position: 'absolute',
                  top: '50%',
                  left: '0',
                  transform: 'translateY(-50%)',
                  width: `${micRawVolume}%`,
                  height: '8px',
                  backgroundColor: isMicLive ? 'rgba(16, 185, 129, 0.2)' : 'rgba(107, 114, 128, 0.2)',
                  borderRadius: '4px',
                  zIndex: 1,
                  pointerEvents: 'none',
                  transition: 'width 0.1s ease-out, background-color 0.1s ease-out',
                }}
              />
            )}
          </div>
          
          {/* Status indicators */}
          <Flex align="center" justify="between">
            <Text size="1" color="gray">
              Raw Input: {Math.round(micRawVolume)}% | Processed: {Math.round(micLiveVolume)}%
            </Text>
            <Text 
              size="1" 
              color={micRawVolume < noiseGate ? "red" : isMicLive ? "green" : "gray"}
              weight="medium"
            >
              {micRawVolume < noiseGate ? "🚫 GATED" : isMicLive ? "🎤 OPEN" : "🔇 QUIET"}
            </Text>
          </Flex>
        </Flex>

        {/* Volume Controls */}
        <SliderSetting
          title={`Microphone Volume: ${micVolume}%`}
          description="Your microphone input level (50% = normal volume, 100% = 2x boost)"
          value={micVolume}
          onChange={setMicVolume}
        />

        <SliderSetting
          title={`Output Volume: ${outputVolume}%`}
          description="Controls volume of all incoming audio (50% = normal, 100% = 2x boost)"
          value={outputVolume}
          onChange={setOutputVolume}
        />

        {/* RNNoise Noise Reduction */}
        <ToggleSetting
          title="Noise Reduction (RNNoise)"
          description="Advanced AI-powered noise reduction using RNNoise WebAssembly. Reduces background noise while preserving speech quality."
          checked={rnnoiseEnabled}
          onCheckedChange={setRnnoiseEnabled}
          statusText={rnnoiseEnabled 
            ? "✅ RNNoise is processing your audio to reduce background noise"
            : "❌ RNNoise is disabled - background noise will not be filtered"
          }
        />

        {/* Test Microphone */}
        <ToggleSetting
          title="Test Microphone (Playback)"
          description="Enable to hear yourself through speakers/headphones. Audio levels and noise gate are always visible above."
          checked={loopbackEnabled}
          onCheckedChange={setLoopbackEnabled}
        />

        {/* AFK Timeout Setting */}
        <SliderSetting
          title={`AFK Timeout: ${afkTimeoutMinutes} minutes`}
          description="You'll be marked as AFK after this many minutes of silence. Only applies when connected to voice channels."
          value={afkTimeoutMinutes}
          onChange={setAfkTimeoutMinutes}
          min={1}
          max={30}
        />
    </SettingsContainer>
  );
}
