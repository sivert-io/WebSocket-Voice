import { singletonHook } from "react-singleton-hook";
import { useEffect, useState } from "react";
import { useHandles } from "./useHandles";

interface Speakers {
  devices: MediaDeviceInfo[];
  addHandle: (id: string) => void;
  removeHandle: (id: string) => void;
  mediaDestination?: MediaStreamAudioDestinationNode;
  audioContext?: AudioContext;
  isLoaded: boolean;
}

function speakersHook() {
  const { handles, addHandle, removeHandle, isLoaded } = useHandles();
  const [audioContext, setAudioContext] = useState<AudioContext | undefined>(
    undefined,
  );
  const [mediaDestination, setMediaDestination] = useState<
    MediaStreamAudioDestinationNode | undefined
  >(undefined);
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);

  useEffect(() => {
    navigator.mediaDevices
      .enumerateDevices()
      .then((devices) => {
        const speakers = devices.filter(
          (device) => device.kind === "audiooutput",
        );
        setDevices(speakers);
      })
      .catch((err) => {
        console.error("Error enumerating devices:", err);
      });
  }, []);

  // Create audioContext and destination only if exists
  useEffect(() => {
    console.log("handles", handles.length);

    if (handles.length > 0 && !audioContext) {
      const context = new AudioContext();
      const inputBuffer = context.createMediaStreamDestination();
      const output = context.createMediaStreamSource(inputBuffer.stream);
      output.connect(context.destination);

      // Update context
      setAudioContext(context);
      setMediaDestination(inputBuffer);
    } else {
      // Turn off audio context if no streams to play
      audioContext?.close();
      mediaDestination?.stream.getAudioTracks().forEach((track) => {
        track.stop();
      });
      setAudioContext(undefined);
      setMediaDestination(undefined);
    }
  }, [handles]);

  return {
    addHandle,
    removeHandle,
    audioContext,
    mediaDestination,
    devices,
    isLoaded,
  };
}

const init: Speakers = {
  devices: [],
  addHandle: () => {},
  removeHandle: () => {},
  mediaDestination: undefined,
  audioContext: undefined,
  isLoaded: false,
};

const SpeakerHook = singletonHook(init, speakersHook);

export const useSpeakers = () => {
  const speakers = SpeakerHook();

  useEffect(() => {
    const id = self.crypto.randomUUID();
    speakers.addHandle(id);

    return () => {
      speakers.removeHandle(id);
    };
  }, [speakers.isLoaded]);

  return speakers;
};
