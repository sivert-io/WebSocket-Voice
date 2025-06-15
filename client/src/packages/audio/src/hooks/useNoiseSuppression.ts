import { useEffect, useRef, useState, useCallback } from 'react';

// Use our own worklet name since we're using a custom implementation
const NoiseSuppressorWorklet_Name = "NoiseSuppressorWorklet";

interface NoiseSuppressionState {
  isInitialized: boolean;
  isProcessing: boolean;
  error: string | null;
}

interface NoiseSuppressionOutput {
  processAudio: (inputNode: AudioNode, audioContext: AudioContext) => Promise<AudioNode>;
  state: NoiseSuppressionState;
  cleanup: () => void;
}

export function useNoiseSuppression(): NoiseSuppressionOutput {
  const [state, setState] = useState<NoiseSuppressionState>({
    isInitialized: false,
    isProcessing: false,
    error: null,
  });

  const processorRef = useRef<AudioWorkletNode | null>(null);
  const isInitializingRef = useRef<boolean>(false);
  const workletLoadedRef = useRef<boolean>(false);

  // Initialize the noise suppression worklet
  const initializeWorklet = useCallback(async (audioContext: AudioContext): Promise<void> => {
    if (isInitializingRef.current || workletLoadedRef.current) {
      return;
    }

    isInitializingRef.current = true;
    
    try {
      console.log('🎵 Initializing RNNoise worklet...');
      setState(prev => ({ ...prev, error: null }));
      
      // Load the bundled NoiseSuppressorWorklet that doesn't use ES6 imports
      await audioContext.audioWorklet.addModule('/rnnoise/BundledNoiseSuppressorWorklet.js');
      
      // Add a small delay to ensure the worklet is fully registered
      await new Promise(resolve => setTimeout(resolve, 100));
      
      workletLoadedRef.current = true;
      
      setState(prev => ({ 
        ...prev, 
        isInitialized: true,
        error: null 
      }));
      
      console.log('✅ RNNoise worklet initialized successfully');
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to initialize RNNoise worklet';
      console.error('❌ RNNoise worklet initialization failed:', error);
      
      workletLoadedRef.current = false;
      
      setState(prev => ({ 
        ...prev, 
        isInitialized: false,
        error: errorMessage 
      }));
      
      throw error;
    } finally {
      isInitializingRef.current = false;
    }
  }, []);

  // Process audio through RNNoise
  const processAudio = useCallback(async (inputNode: AudioNode, audioContext: AudioContext): Promise<AudioNode> => {
    try {
      setState(prev => ({ ...prev, isProcessing: true, error: null }));

      // Initialize worklet if not already done
      if (!workletLoadedRef.current) {
        await initializeWorklet(audioContext);
      }

      // Double-check that worklet is loaded before creating node
      if (!workletLoadedRef.current) {
        throw new Error('Worklet failed to load');
      }

      // Create the noise suppression node
      const noiseSuppressionNode = new AudioWorkletNode(audioContext, NoiseSuppressorWorklet_Name, {
        numberOfInputs: 1,
        numberOfOutputs: 1,
        channelCount: 1,
        channelCountMode: 'explicit',
        channelInterpretation: 'speakers',
      });

      processorRef.current = noiseSuppressionNode;

      // Set up error handling for the worklet
      noiseSuppressionNode.port.onmessage = (event) => {
        const { type, error } = event.data;
        if (type === 'error') {
          console.error('❌ RNNoise worklet error:', error);
          setState(prev => ({ ...prev, error: error }));
        }
      };

      noiseSuppressionNode.onprocessorerror = (event) => {
        console.error('❌ RNNoise processor error:', event);
        setState(prev => ({ ...prev, error: 'Audio processor error' }));
      };

      // Connect input to noise suppression node
      inputNode.connect(noiseSuppressionNode);

      console.log('✅ Noise suppression processor connected');
      return noiseSuppressionNode;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to process audio';
      console.error('❌ Audio processing failed:', error);
      
      setState(prev => ({ 
        ...prev, 
        isProcessing: false,
        error: errorMessage 
      }));
      
      // Return original input node on error
      return inputNode;
    } finally {
      setState(prev => ({ ...prev, isProcessing: false }));
    }
  }, [initializeWorklet]);

  // Cleanup function
  const cleanup = useCallback(() => {
    console.log('🧹 Cleaning up noise suppression...');
    
    if (processorRef.current) {
      try {
        processorRef.current.disconnect();
        processorRef.current = null;
      } catch (error) {
        console.error('Error disconnecting processor:', error);
      }
    }

    workletLoadedRef.current = false;
    isInitializingRef.current = false;

    setState({
      isInitialized: false,
      isProcessing: false,
      error: null,
    });
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return cleanup;
  }, [cleanup]);

  return {
    processAudio,
    state,
    cleanup,
  };
} 