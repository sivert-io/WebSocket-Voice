import { useEffect, useMemo, useState } from "react";
import { singletonHook } from "react-singleton-hook";
import { useSettings } from "./useSettings";

interface MicrophoneInterface {
  microphoneBuffer: {
    input?: GainNode;
    output?: MediaStreamAudioSourceNode;
    analyser?: AnalyserNode;
  };
  isBrowserSupported: boolean | undefined;
  devices: InputDeviceInfo[];
  loopbackEnabled: boolean;
  setLoopbackEnabled: (value: boolean) => any;
  audioContext?: AudioContext;
}

function createMicrophoneHook() {
  // TODO: Add handles to automatically open and close audio context
  // Each consumer should open a handle when they need microphone output (put themselves in a list), and close this handle when they don't need it anymore
  // When this list is empty, close the audio context
  // When the list is not empty, open the audio context if not already open
  const [audioContext] = useState<AudioContext>(new AudioContext());
  const [isBrowserSupported, setSupported] = useState<boolean | undefined>(
    undefined
  );
  const [devices, setDevices] = useState<InputDeviceInfo[]>([]);
  const [_, setStream] = useState<MediaStream | undefined>(undefined);
  const [loopbackEnabled, setLoopbackEnabled] = useState(false);
  const { micID, micVolume } = useSettings();

  // Create microphonebuffer based on audioContext
  const microphoneBuffer = useMemo<{
    input: GainNode;
    output: MediaStreamAudioSourceNode;
    analyser: AnalyserNode;
  }>(() => {
    const input = audioContext.createGain(); // Microphone Input
    const analyser = audioContext.createAnalyser(); // Analyser Node (Passthrough)
    const inputDestination = audioContext.createMediaStreamDestination(); // Buffer
    const streamSource = audioContext.createMediaStreamSource(
      // useMicrophone Output
      inputDestination.stream
    );

    input.connect(analyser);
    analyser.connect(inputDestination);

    return {
      input: input,
      output: streamSource,
      analyser,
    };
  }, [audioContext]);

  // Get browser support
  useEffect(() => {
    if (navigator.mediaDevices && AudioContext) {
      setSupported(true);
    } else {
      setSupported(false);
    }
  }, [navigator.mediaDevices, AudioContext]);

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

        const mediaStream = audioContext.createMediaStreamSource(_stream);
        mediaStream.connect(microphoneBuffer.input);
        setStream(_stream);
      } catch (error) {
        console.error("Error accessing microphone:", error);
      }
    }

    changeDevice(micID);
  }, [micID, audioContext]);

  useEffect(() => {
    microphoneBuffer.input.gain.value = micVolume / 50;
  }, [micVolume]);

  // If loopback changed, lets enable live feedback
  useEffect(() => {
    try {
      if (loopbackEnabled) {
        microphoneBuffer.output.connect(audioContext.destination);
      } else if (!loopbackEnabled) {
        microphoneBuffer.output.disconnect(audioContext.destination);
      }
    } catch (e) {
      // do nothing
    }
  }, [loopbackEnabled]);

  return {
    microphoneBuffer,
    isBrowserSupported,
    devices,
    loopbackEnabled,
    setLoopbackEnabled,
    audioContext,
  };
}

const init: MicrophoneInterface = {
  devices: [],
  isBrowserSupported: undefined,
  loopbackEnabled: false,
  setLoopbackEnabled: () => {},
  microphoneBuffer: {
    input: undefined,
    output: undefined,
    analyser: undefined,
  },
  audioContext: undefined,
};

export const useMicrophone = singletonHook(init, createMicrophoneHook);
