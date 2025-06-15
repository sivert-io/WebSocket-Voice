export type MicrophoneBufferType = {
  input?: GainNode;
  output?: MediaStreamAudioSourceNode;
  analyser?: AnalyserNode;
};

export interface MicrophoneInterface {
  addHandle: (id: string) => void;
  removeHandle: (id: string) => void;
  microphoneBuffer: MicrophoneBufferType;
  isBrowserSupported: boolean | undefined;
  devices: InputDeviceInfo[];
  audioContext?: AudioContext;
  isLoaded: boolean;
  getDevices: () => Promise<void>;
}
