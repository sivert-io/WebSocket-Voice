import { singletonHook } from "react-singleton-hook";
import { useStream } from "./useStream";
import { useEffect, useState } from "react";

interface Playback {
  streamSources: { [userID: string]: GainNode };
}

function playbackHook() {
  const { streams } = useStream();
  const [audioContext, setAudioContext] = useState<AudioContext | null>(null);
  const [mediaDestination, setMediaDestination] =
    useState<MediaStreamAudioDestinationNode | null>(null);
  const [streamSources, setStreamSources] = useState<{
    [userID: string]: GainNode;
  }>({});

  useEffect(() => {
    if (streams.length > 0) {
      const context = audioContext || new AudioContext();
      const dest = mediaDestination || context.createMediaStreamDestination();
      // Add streams to audioContext

      streams.forEach((stream) => {
        const nStream = context.createMediaStreamSource(stream);
        const nGain = context.createGain();
        nStream.connect(nGain);
        nGain.connect(dest);

        setStreamSources((old) => ({ ...old, [stream.id]: nGain }));
      });

      // Update context
      setAudioContext(context);

      // Update Destination
      setMediaDestination(dest);
    } else {
      // Turn off audio context if no streams to play
      setAudioContext(null);
    }

    return () => {};
  }, [streams]);

  return { streamSources };
}

const init: Playback = {
  streamSources: {},
};

export const usePlayback = singletonHook(init, playbackHook);
