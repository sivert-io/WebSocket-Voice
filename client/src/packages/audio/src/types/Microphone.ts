export type MicrophoneBufferType = {
  input?: GainNode;
  output?: MediaStreamAudioSourceNode;
  rawOutput?: GainNode; // Raw audio output for monitoring (before noise gate)
  analyser?: AnalyserNode; // Raw audio analyser (for noise gate threshold detection)
  finalAnalyser?: AnalyserNode; // Final processed audio analyser (for UI and loopback)
  mediaStream?: MediaStream; // Raw microphone stream
  processedStream?: MediaStream; // Processed stream (after noise suppression, mute, etc.)
  muteGain?: GainNode; // Dedicated gain node for muting
  volumeGain?: GainNode; // Dedicated gain node for volume control
  noiseGate?: GainNode; // Dedicated gain node for noise gate functionality
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
  // Visualizer support
  getVisualizerData: () => Uint8Array | null;
}
