export interface Streams {
  [id: string]: StreamData;
}

export interface StreamData {
  stream: MediaStream;
  isLocal: boolean; // Flag indicating if it's a local stream
}

export type StreamSources = {
  [id: string]: {
    gain: GainNode;
    analyser: AnalyserNode;
    stream: MediaStreamAudioSourceNode;
  };
};

export interface SFUInterface {
  streams: Streams;
  error: string | null;
  streamSources: StreamSources;
  connect: (channelID: string) => Promise<void>;
  disconnect: () => Promise<void>;
  isConnected: string;
  currentChannel: string;
}
