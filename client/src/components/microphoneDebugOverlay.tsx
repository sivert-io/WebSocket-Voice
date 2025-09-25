import { useEffect, useState } from "react";
import { useMicrophone } from "@/audio";
import { useDeviceEnumeration } from "../packages/audio/src/hooks/useDeviceEnumeration";
import { useSettings } from "@/settings";
import { DebugOverlay } from "./debugOverlay";

interface MicrophoneDebugOverlayProps {
  isVisible: boolean;
}

export function MicrophoneDebugOverlay({ isVisible }: MicrophoneDebugOverlayProps) {
  const { 
    microphoneBuffer, 
    audioContext
  } = useMicrophone(true);
  
  const { devices, isLoading: devicesLoading, error: devicesError } = useDeviceEnumeration();
  const { micID, micVolume, noiseGate, isMuted, isDeafened } = useSettings();
  
  const [currentDevice, setCurrentDevice] = useState<InputDeviceInfo | null>(null);
  const [rawVolume, setRawVolume] = useState(0);
  const [processedVolume, setProcessedVolume] = useState(0);
  const [isTransmitting, setIsTransmitting] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0);

  // Find current device info
  useEffect(() => {
    if (micID && devices.length > 0) {
      const device = devices.find((d: InputDeviceInfo) => d.deviceId === micID);
      setCurrentDevice(device || null);
    } else {
      setCurrentDevice(null);
    }
  }, [micID, devices]);

  // Monitor audio levels and transmission status
  useEffect(() => {
    if (!microphoneBuffer.analyser || !microphoneBuffer.finalAnalyser) {
      return;
    }

    const interval = setInterval(() => {
      // Raw audio level (for noise gate detection)
      if (microphoneBuffer.analyser) {
        const bufferLength = microphoneBuffer.analyser.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);
        microphoneBuffer.analyser.getByteFrequencyData(dataArray);
        
        let sum = 0;
        for (let i = 0; i < bufferLength; i++) {
          sum += dataArray[i] * dataArray[i];
        }
        const rms = Math.sqrt(sum / bufferLength);
        const rawVol = (rms / 255) * 100;
        setRawVolume(rawVol);
        
        // Check if transmitting (above noise gate)
        setIsTransmitting(rawVol > noiseGate && !isMuted && !isDeafened);
      }

      // Processed audio level (final output)
      if (microphoneBuffer.finalAnalyser) {
        const bufferLength = microphoneBuffer.finalAnalyser.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);
        microphoneBuffer.finalAnalyser.getByteFrequencyData(dataArray);
        
        let sum = 0;
        for (let i = 0; i < bufferLength; i++) {
          sum += dataArray[i] * dataArray[i];
        }
        const rms = Math.sqrt(sum / bufferLength);
        const processedVol = (rms / 255) * 100;
        setProcessedVolume(processedVol);
        
        // Calculate dB level
        const dbLevel = processedVol > 0 ? 20 * Math.log10(processedVol / 100) : -Infinity;
        setAudioLevel(dbLevel);
      }
    }, 50); // Update 20 times per second

    return () => clearInterval(interval);
  }, [microphoneBuffer.analyser, microphoneBuffer.finalAnalyser, noiseGate, isMuted, isDeafened]);

  return (
    <DebugOverlay
      isVisible={isVisible}
      title="Microphone Debug"
      icon="🎤"
      status={{
        active: !!audioContext,
        label: audioContext?.state || "None"
      }}
    >
      {/* Device Information */}
      <div style={{ marginBottom: "8px" }}>
        <div style={{ color: "#60a5fa", fontWeight: "bold" }}>Device:</div>
        <div style={{ marginLeft: "8px", fontSize: "11px" }}>
          <div>ID: {micID ? micID.slice(0, 8) + "..." : "None"}</div>
          <div>Name: {currentDevice?.label || "Unknown"}</div>
          <div>Available: {devicesLoading ? "Loading..." : devicesError ? "Error" : `${devices.length} devices`}</div>
          {devicesError && (
            <div style={{ color: "#ef4444", fontSize: "10px" }}>
              {devicesError}
            </div>
          )}
        </div>
      </div>

      {/* Audio Levels */}
      <div style={{ marginBottom: "8px" }}>
        <div style={{ color: "#60a5fa", fontWeight: "bold" }}>Audio Levels:</div>
        <div style={{ marginLeft: "8px", fontSize: "11px" }}>
          <div>Raw: {rawVolume.toFixed(1)}%</div>
          <div>Processed: {processedVolume.toFixed(1)}%</div>
          <div>dB: {audioLevel === -Infinity ? "-∞" : audioLevel.toFixed(1)} dB</div>
        </div>
      </div>

      {/* Settings */}
      <div style={{ marginBottom: "8px" }}>
        <div style={{ color: "#60a5fa", fontWeight: "bold" }}>Settings:</div>
        <div style={{ marginLeft: "8px", fontSize: "11px" }}>
          <div>Volume: {micVolume}%</div>
          <div>Noise Gate: {noiseGate}%</div>
          <div>Muted: {isMuted ? "🔇 Yes" : "🔊 No"}</div>
          <div>Deafened: {isDeafened ? "🔇 Yes" : "🔊 No"}</div>
        </div>
      </div>

      {/* Status */}
      <div style={{ marginBottom: "8px" }}>
        <div style={{ color: "#60a5fa", fontWeight: "bold" }}>Status:</div>
        <div style={{ marginLeft: "8px", fontSize: "11px" }}>
          <div>Transmitting: {isTransmitting ? "🟢 Yes" : "🔴 No"}</div>
          <div>Stream Active: {microphoneBuffer.mediaStream?.active ? "🟢 Yes" : "🔴 No"}</div>
          <div>Context State: {audioContext?.state || "None"}</div>
        </div>
      </div>

      {/* Visual Audio Level Bar */}
      <div style={{ marginTop: "8px" }}>
        <div style={{ color: "#60a5fa", fontWeight: "bold", marginBottom: "4px" }}>Level:</div>
        <div style={{ 
          width: "100%", 
          height: "8px", 
          backgroundColor: "#333", 
          borderRadius: "4px",
          overflow: "hidden"
        }}>
          <div style={{
            width: `${Math.min(processedVolume, 100)}%`,
            height: "100%",
            backgroundColor: processedVolume > 80 ? "#ef4444" : 
                           processedVolume > 50 ? "#f59e0b" : "#4ade80",
            transition: "width 0.1s ease-out"
          }} />
        </div>
        <div style={{ 
          fontSize: "10px", 
          color: "#888", 
          marginTop: "2px",
          textAlign: "right" 
        }}>
          {processedVolume.toFixed(1)}%
        </div>
      </div>
    </DebugOverlay>
  );
}
