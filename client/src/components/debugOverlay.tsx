import { useEffect, useState, useRef } from "react";
import { motion, useDragControls } from "motion/react";
import { useMicrophone } from "@/audio";
import { useSettings } from "@/settings";

interface DebugOverlayProps {
  isVisible: boolean;
}

export function DebugOverlay({ isVisible }: DebugOverlayProps) {
  const { 
    devices, 
    microphoneBuffer, 
    audioContext
  } = useMicrophone(true);
  
  const { micID, micVolume, noiseGate, isMuted, isDeafened } = useSettings();
  
  const [currentDevice, setCurrentDevice] = useState<InputDeviceInfo | null>(null);
  const [rawVolume, setRawVolume] = useState(0);
  const [processedVolume, setProcessedVolume] = useState(0);
  const [isTransmitting, setIsTransmitting] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0);
  
  // Drag functionality
  const dragControls = useDragControls();
  const constraintsRef = useRef<HTMLDivElement>(null);

  // Find current device info
  useEffect(() => {
    if (micID && devices.length > 0) {
      const device = devices.find(d => d.deviceId === micID);
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

  if (!isVisible) return null;

  return (
    <div ref={constraintsRef} style={{ position: "fixed", inset: 0, pointerEvents: "none" }}>
      <motion.div
        drag
        dragControls={dragControls}
        dragConstraints={constraintsRef}
        dragElastic={0.1}
        dragMomentum={false}
        initial={{ 
          x: window.innerWidth - 340, 
          y: 10,
          scale: 0.8,
          opacity: 0
        }}
        animate={{ 
          x: window.innerWidth - 340, 
          y: 10,
          scale: 1,
          opacity: 1
        }}
        exit={{ 
          scale: 0.8,
          opacity: 0
        }}
        transition={{ 
          type: "spring", 
          stiffness: 300, 
          damping: 30,
          opacity: { duration: 0.3 }
        }}
        whileDrag={{ 
          scale: 1.05,
          boxShadow: "0 8px 24px rgba(0, 0, 0, 0.4)"
        }}
        whileHover={{
          scale: 1.02,
          boxShadow: "0 6px 16px rgba(0, 0, 0, 0.35)"
        }}
        style={{
          position: "absolute",
          width: "320px",
          backgroundColor: "rgba(0, 0, 0, 0.85)",
          color: "#ffffff",
          fontFamily: "monospace",
          fontSize: "12px",
          padding: "12px",
          borderRadius: "6px",
          border: "1px solid #333",
          zIndex: 9999,
          backdropFilter: "blur(4px)",
          boxShadow: "0 4px 12px rgba(0, 0, 0, 0.3)",
          cursor: "grab",
          pointerEvents: "auto",
        }}
      >
      <div 
        style={{ 
          display: "flex", 
          justifyContent: "space-between", 
          alignItems: "center",
          marginBottom: "8px",
          borderBottom: "1px solid #333",
          paddingBottom: "6px",
          cursor: "grab",
          userSelect: "none"
        }}
        onPointerDown={(e) => dragControls.start(e)}
      >
        <h3 style={{ margin: 0, color: "#4ade80" }}>🎤 Audio Debug</h3>
        <div style={{ fontSize: "10px", color: "#888", display: "flex", alignItems: "center", gap: "4px" }}>
          <span>⋮⋮</span>
          {audioContext ? "🟢 Active" : "🔴 Inactive"}
        </div>
      </div>

      {/* Device Information */}
      <div style={{ marginBottom: "8px" }}>
        <div style={{ color: "#60a5fa", fontWeight: "bold" }}>Device:</div>
        <div style={{ marginLeft: "8px", fontSize: "11px" }}>
          <div>ID: {micID ? micID.slice(0, 8) + "..." : "None"}</div>
          <div>Name: {currentDevice?.label || "Unknown"}</div>
          <div>Available: {devices.length} devices</div>
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
      </motion.div>
    </div>
  );
}
