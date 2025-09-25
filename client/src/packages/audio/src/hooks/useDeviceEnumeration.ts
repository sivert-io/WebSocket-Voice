import { useCallback, useEffect, useState } from "react";
import { getIsBrowserSupported } from "@/audio";

export function useDeviceEnumeration() {
  const [devices, setDevices] = useState<InputDeviceInfo[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const isBrowserSupported = getIsBrowserSupported();

  const enumerateDevices = useCallback(async () => {
    if (!isBrowserSupported) {
      setError("Browser not supported for device enumeration");
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      console.log("🎤 Enumerating audio devices (without stream)...");
      
      // First, try to get devices without requesting permission
      let allDevices = await navigator.mediaDevices.enumerateDevices();
      let audioDevices = allDevices.filter((d) => d.kind === "audioinput") as InputDeviceInfo[];
      
      // If we don't have device labels (permission not granted), request permission
      if (audioDevices.length > 0 && audioDevices[0].label === "") {
        console.log("🎤 No device labels available, requesting permission...");
        
        try {
          // Request permission with minimal constraints
          const permissionStream = await navigator.mediaDevices.getUserMedia({
            audio: {
              autoGainControl: false,
              echoCancellation: false,
              noiseSuppression: false,
            },
          });

          // Immediately stop the temporary permission stream
          permissionStream.getTracks().forEach(track => track.stop());
          console.log("🎤 Stopped temporary permission stream after enumeration");

          // Re-enumerate to get device labels
          allDevices = await navigator.mediaDevices.enumerateDevices();
          audioDevices = allDevices.filter((d) => d.kind === "audioinput") as InputDeviceInfo[];
        } catch (permissionError) {
          console.warn("🎤 Permission denied, but continuing with device enumeration:", permissionError);
          // Continue with devices without labels
        }
      }
      
      console.log("🎤 Found audio devices:", audioDevices.length);
      setDevices(audioDevices);
    } catch (error) {
      console.error("🎤 Error enumerating devices:", error);
      setError(error instanceof Error ? error.message : "Failed to enumerate devices");
    } finally {
      setIsLoading(false);
    }
  }, [isBrowserSupported]);

  // Auto-enumerate devices on mount
  useEffect(() => {
    enumerateDevices();
  }, [enumerateDevices]);

  // Listen for device changes
  useEffect(() => {
    if (!isBrowserSupported) return;

    const handleDeviceChange = () => {
      console.log("🎤 Device change detected, re-enumerating...");
      enumerateDevices();
    };

    navigator.mediaDevices.addEventListener('devicechange', handleDeviceChange);
    
    return () => {
      navigator.mediaDevices.removeEventListener('devicechange', handleDeviceChange);
    };
  }, [enumerateDevices, isBrowserSupported]);

  return {
    devices,
    isLoading,
    error,
    isBrowserSupported,
    refreshDevices: enumerateDevices,
  };
}
