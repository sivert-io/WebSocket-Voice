import { Rnnoise } from '@shiguredo/rnnoise-wasm';

export interface RNNoiseProcessorConfig {
  enabled: boolean;
  sampleRate: number;
  frameSize: number;
}

export class RNNoiseProcessor {
  private rnnoise: any = null;
  private denoiseState: any = null;
  private config: RNNoiseProcessorConfig;
  private isInitialized = false;
  private frameBuffer: Float32Array | null = null;

  constructor(config: RNNoiseProcessorConfig) {
    this.config = config;
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    try {
      console.log('🎤 Initializing RNNoise processor...');
      
      // Load the RNNoise WebAssembly module
      this.rnnoise = await Rnnoise.load();
      
      // Create denoise state for processing
      this.denoiseState = this.rnnoise.createDenoiseState();
      
      // Initialize processing buffer for the frame size (480 samples for RNNoise)
      this.frameBuffer = new Float32Array(480); // RNNoise requires 480 samples
      
      this.isInitialized = true;
      console.log('✅ RNNoise processor initialized successfully');
    } catch (error) {
      console.error('❌ Failed to initialize RNNoise processor:', error);
      this.isInitialized = false;
      throw error;
    }
  }

  async processAudio(inputBuffer: Float32Array): Promise<Float32Array> {
    if (!this.config.enabled || !this.isInitialized || !this.denoiseState) {
      return inputBuffer; // Return original buffer if disabled or not initialized
    }

    try {
      const outputBuffer = new Float32Array(inputBuffer.length);
      let outputIndex = 0;

      // Process audio in frames of 480 samples (RNNoise requirement)
      for (let i = 0; i < inputBuffer.length; i += 480) {
        const frameEnd = Math.min(i + 480, inputBuffer.length);
        const frameLength = frameEnd - i;

        // Copy frame data to processing buffer
        if (this.frameBuffer) {
          this.frameBuffer.fill(0); // Clear buffer
          this.frameBuffer.set(inputBuffer.subarray(i, frameEnd));
        }

        // Process frame through RNNoise
        if (this.frameBuffer && this.denoiseState) {
          // Create a copy for processing (RNNoise modifies the input)
          const processingFrame = new Float32Array(this.frameBuffer);
          
          // Apply RNNoise denoising
          this.denoiseState.processFrame(processingFrame);
          
          // Copy processed frame to output
          const copyLength = Math.min(processingFrame.length, frameLength);
          outputBuffer.set(processingFrame.subarray(0, copyLength), outputIndex);
          outputIndex += copyLength;
        }
      }

      return outputBuffer;
    } catch (error) {
      console.error('❌ RNNoise processing error:', error);
      return inputBuffer; // Return original buffer on error
    }
  }

  setEnabled(enabled: boolean): void {
    this.config.enabled = enabled;
    console.log(`🎤 RNNoise ${enabled ? 'enabled' : 'disabled'}`);
  }

  isEnabled(): boolean {
    return this.config.enabled;
  }

  async destroy(): Promise<void> {
    try {
      if (this.denoiseState) {
        this.denoiseState.destroy();
        this.denoiseState = null;
      }
      this.rnnoise = null;
      this.isInitialized = false;
      console.log('✅ RNNoise processor destroyed');
    } catch (error) {
      console.error('❌ Error destroying RNNoise processor:', error);
    }
  }

  getStatus(): { initialized: boolean; enabled: boolean } {
    return {
      initialized: this.isInitialized,
      enabled: this.config.enabled
    };
  }
}

// Factory function to create RNNoise processor
export function createRNNoiseProcessor(sampleRate: number = 48000): RNNoiseProcessor {
  return new RNNoiseProcessor({
    enabled: false, // Will be set by settings
    sampleRate,
    frameSize: 480 // 480 samples for RNNoise
  });
}
