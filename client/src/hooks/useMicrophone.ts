import { useEffect, useMemo, useState } from "react";
import { singletonHook } from "react-singleton-hook";

interface MicrophoneInterface {
  microphoneBuffer: {
    input?: MediaStreamAudioDestinationNode;
    output?: MediaStreamAudioSourceNode;
  };
  micId: string | undefined;
  setMicId: (id: string) => any;
  isBrowserSupported: boolean | undefined;
  devices: InputDeviceInfo[];
  loopbackEnabled: boolean;
  setLoopbackEnabled: (value: boolean) => any;
}

function createMicrophoneHook() {
  const [audioContext] = useState(new AudioContext());
  const [isBrowserSupported, setSupported] = useState<boolean | undefined>(
    undefined
  );
  const [devices, setDevices] = useState<InputDeviceInfo[]>([]);
  const [micId, setMicId] = useState<string | undefined>(
    localStorage.getItem("micID") || undefined
  );
  const [_, setStream] = useState<MediaStream | undefined>(undefined);
  const [loopbackEnabled, setLoopbackEnabled] = useState(false);

  // Create microphonebuffer based on audioContext
  const microphoneBuffer = useMemo<{
    input: MediaStreamAudioDestinationNode;
    output: MediaStreamAudioSourceNode;
  }>(() => {
    const streamDestination = audioContext.createMediaStreamDestination();
    const _stream = audioContext.createMediaStreamSource(
      streamDestination.stream
    );

    return { input: streamDestination, output: _stream };
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

        console.log("yellooo");

        const mediaStream = audioContext.createMediaStreamSource(_stream);
        mediaStream.connect(microphoneBuffer.input);
        setStream(_stream);
      } catch (error) {
        console.error("Error accessing microphone:", error);
      }
    }

    changeDevice(micId);
  }, [micId, audioContext]);

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

  function updateMicID(newID: string) {
    setMicId(newID);
    localStorage.setItem("micID", newID);
  }

  return {
    microphoneBuffer,
    micId,
    setMicId: updateMicID,
    isBrowserSupported,
    devices,
    loopbackEnabled,
    setLoopbackEnabled,
  };
}

const init: MicrophoneInterface = {
  devices: [],
  isBrowserSupported: undefined,
  loopbackEnabled: false,
  setLoopbackEnabled: () => {},
  micId: "",
  microphoneBuffer: {
    input: undefined,
    output: undefined,
  },
  setMicId: () => {},
};

export const useMicrophone = singletonHook(init, createMicrophoneHook);
