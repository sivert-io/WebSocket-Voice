import { useState, useEffect, useCallback } from "react";

const useMicrophone = () => {
  const [audioContext, setAudioContext] = useState<AudioContext | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [source, setSource] = useState<MediaStreamAudioSourceNode | null>(null);

  const getMicrophoneStream = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      setStream(stream);
      return stream;
    } catch (error) {
      console.error("Error accessing the microphone", error);
      throw error;
    }
  }, []);

  const createAudioContext = useCallback(async () => {
    const audioContext = new (window.AudioContext ||
      window.webkitAudioContext)();
    setAudioContext(audioContext);
    const stream = await getMicrophoneStream();
    const source = audioContext.createMediaStreamSource(stream);
    setSource(source);
    return { audioContext, source };
  }, [getMicrophoneStream]);

  const startMicrophone = useCallback(async () => {
    const { audioContext, source } = await createAudioContext();
    source.connect(audioContext.destination);
  }, [createAudioContext]);

  const stopMicrophone = useCallback(() => {
    if (audioContext) {
      audioContext.close();
    }
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
    }
    setAudioContext(null);
    setStream(null);
    setSource(null);
  }, [audioContext, stream]);

  useEffect(() => {
    return () => {
      stopMicrophone();
    };
  }, [stopMicrophone]);

  return { startMicrophone, stopMicrophone, stream };
};

export default useMicrophone;
