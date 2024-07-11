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
  const [audioContext, setAudioContext] = useState<AudioContext>(
    new AudioContext()
  );
  const [isBrowserSupported, setSupported] = useState<boolean | undefined>(
    undefined
  );
  const [devices, setDevices] = useState<InputDeviceInfo[]>([]);
  const [_, setStream] = useState<MediaStream | undefined>(undefined);
  const [loopbackEnabled, setLoopbackEnabled] = useState(false);
  const { micID, setMicID, micVolume } = useSettings();

  // Create microphonebuffer based on audioContext
  const microphoneBuffer = useMemo<{
    input: GainNode;
    output: MediaStreamAudioSourceNode;
    analyser: AnalyserNode;
  }>(() => {
    const input = audioContext.createGain();
    const inputDestination = audioContext.createMediaStreamDestination();
    input.connect(inputDestination);

    const streamSource = audioContext.createMediaStreamSource(
      inputDestination.stream
    );

    const analyser = audioContext.createAnalyser();
    streamSource.connect(analyser);

    return { input: input, output: streamSource, analyser };
  }, [audioContext]);

  // Get browser support
  useEffect(() => {
    console.log("stuff", navigator.mediaDevices, AudioContext);

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
            if (devices.length > 0) setMicID(devices[0].deviceId);
            setAudioContext(new AudioContext());
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
