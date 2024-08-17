import { useEffect, useMemo, useState } from "react";
import { singletonHook } from "react-singleton-hook";
import { useSettings } from "./useSettings";
import { useHandles } from "./useHandles";
import { getIsBrowserSupported } from "../utils/mediaDevices";

type MicrophoneBufferType = {
  input?: GainNode;
  output?: MediaStreamAudioSourceNode;
  analyser?: AnalyserNode;
};

interface MicrophoneInterface {
  addHandle: (id: string) => void;
  removeHandle: (id: string) => void;
  microphoneBuffer: MicrophoneBufferType;
  isBrowserSupported: boolean | undefined;
  devices: InputDeviceInfo[];
  audioContext?: AudioContext;
  isLoaded: boolean;
}

function createMicrophoneHook() {
  const { handles, addHandle, removeHandle, isLoaded } = useHandles();
  const { loopbackEnabled } = useSettings();
  const [audioContext, setAudioContext] = useState<AudioContext | undefined>(
    undefined,
  );

  const [isBrowserSupported] = useState(getIsBrowserSupported());
  const [devices, setDevices] = useState<InputDeviceInfo[]>([]);
  const [micStream, setStream] = useState<MediaStream | undefined>(undefined);
  const { micID, micVolume } = useSettings();

  useEffect(() => {
    if (handles.length > 0) {
      const context = audioContext || new AudioContext();
      setAudioContext(context);
    } else {
      // Turn off audio context if no streams to play
      audioContext?.close();
      setAudioContext(undefined);
    }
  }, [handles]);

  // Create microphonebuffer based on audioContext
  const microphoneBuffer = useMemo<MicrophoneBufferType>(() => {
    if (audioContext) {
      const input = audioContext.createGain(); // Microphone Input
      const analyser = audioContext.createAnalyser(); // Analyser Node (Passthrough)
      const inputDestination = audioContext.createMediaStreamDestination(); // Buffer
      const streamSource = audioContext.createMediaStreamSource(
        // useMicrophone Output
        inputDestination.stream,
      );

      input.connect(analyser);
      analyser.connect(inputDestination);

      return {
        input: input,
        output: streamSource,
        analyser,
      };
    }

    return {};
  }, [audioContext]);

  // Get available devices
  useEffect(() => {
    if (isBrowserSupported) {
      navigator.mediaDevices
        .getUserMedia({
          audio: {
            autoGainControl: false,
            echoCancellation: false,
            noiseSuppression: false,
          },
        })
        .then((_stream) => {
          navigator.mediaDevices.enumerateDevices().then((devices) => {
            devices = devices.filter((d) => d.kind === "audioinput");
            setDevices(devices as InputDeviceInfo[]);
          });
        });
    }
  }, [isBrowserSupported]);

  // When mic changes, update stream
  useEffect(() => {
    async function changeDevice(id: string | undefined) {
      if (!id) {
        console.log("missing capture device id");
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

        if (audioContext && microphoneBuffer.input) {
          const mediaStream = audioContext.createMediaStreamSource(_stream);
          const splitter = audioContext.createChannelSplitter(2);
          const merger = audioContext.createChannelMerger(1);

          mediaStream.connect(splitter);
          splitter.connect(merger, 0, 0);
          splitter.connect(merger, 1, 0);

          merger.connect(microphoneBuffer.input);
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
        micStream.getTracks().forEach((track) => track.stop());
        setStream(undefined);
      }
    }
  }, [micID, audioContext, handles]);

  useEffect(() => {
    if (microphoneBuffer.input)
      microphoneBuffer.input.gain.value = micVolume / 50;
  }, [micVolume]);

  // If loopback changed, lets enable live feedback
  useEffect(() => {
    try {
      if (microphoneBuffer.output && audioContext)
        if (loopbackEnabled) {
          microphoneBuffer.output.connect(audioContext.destination);
        } else if (!loopbackEnabled) {
          microphoneBuffer.output.disconnect(audioContext.destination);
        }
    } catch (e) {
      // do nothing
    }
  }, [loopbackEnabled, audioContext]);

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

const singletonMicrophone = singletonHook(init, createMicrophoneHook);

export const useMicrophone = () => {
  const mic = singletonMicrophone();

  useEffect(() => {
    const id = self.crypto.randomUUID();
    mic.addHandle(id);

    return () => {
      mic.removeHandle(id);
    };
  }, [mic.isLoaded]);

  return mic;
};
