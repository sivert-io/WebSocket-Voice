import { useEffect, useMemo, useState } from "react";

let singletonInstance: any = null;

export function useMicrophone() {
  if (!singletonInstance) {
    singletonInstance = createMicrophoneHook();
  }

  return singletonInstance;
}

function createMicrophoneHook() {
  const audioContext = new AudioContext();
  const [isBrowserSupported, setSupported] = useState<boolean | undefined>(
    undefined
  );
  const [devices, setDevices] = useState<InputDeviceInfo[]>([]);
  const [micId, setMicId] = useState<string | undefined>();
  const [_, setStream] = useState<MediaStream | undefined>(undefined);
  const [loopbackEnabled, setLoopbackEnabled] = useState(false);

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

  useEffect(() => {
    if (navigator.mediaDevices && AudioContext) {
      setSupported(true);
    } else {
      setSupported(false);
    }
  }, []);

  useEffect(() => {
    if (isBrowserSupported) {
      navigator.mediaDevices.enumerateDevices().then((devices) => {
        devices = devices.filter((d) => d.kind === "audioinput");
        setDevices(devices as InputDeviceInfo[]);
      });
    }
  }, [isBrowserSupported]);

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

    changeDevice(micId);
  }, [micId, audioContext, microphoneBuffer.input]);

  useEffect(() => {
    if (loopbackEnabled) {
      microphoneBuffer.output.connect(audioContext.destination);
    } else {
      microphoneBuffer.output.disconnect(audioContext.destination);
    }
  }, [loopbackEnabled, audioContext, microphoneBuffer.output]);

  return {
    microphoneBuffer,
    micId,
    setMicId,
    isBrowserSupported,
    devices,
    loopbackEnabled,
    setLoopbackEnabled,
  };
}
