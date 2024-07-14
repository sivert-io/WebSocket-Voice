import React, { useRef, useEffect } from "react";

type VisualizerProps = {
  stream: MediaStream;
  visualSetting: "sinewave" | "frequencybars";
  width?: number;
  height?: number;
  barsColor?: string;
};

export const Visualizer: React.FC<VisualizerProps> = ({
  stream,
  visualSetting,
  width = 482,
  height = 64,
  barsColor = "#323232",
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawVisualRef = useRef<number>();
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);

  const visualize = () => {
    const canvas = canvasRef.current;
    const canvasCtx = canvas?.getContext("2d");
    if (!canvas || !canvasCtx) return;

    const WIDTH = canvas.width;
    const HEIGHT = canvas.height;

    const analyser = analyserRef.current;
    if (!analyser) return;
    analyser.fftSize = 256;
    const bufferLengthAlt = analyser.frequencyBinCount;
    const dataArrayAlt = new Uint8Array(bufferLengthAlt);

    const drawAlt = () => {
      drawVisualRef.current = requestAnimationFrame(drawAlt);

      analyser.getByteFrequencyData(dataArrayAlt);

      canvasCtx.clearRect(0, 0, WIDTH, HEIGHT);

      const barWidth = WIDTH / bufferLengthAlt;
      let x = 0;

      for (let i = 0; i < bufferLengthAlt; i++) {
        const barHeight = dataArrayAlt[i];

        canvasCtx.fillStyle = barsColor;
        canvasCtx.fillRect(x, HEIGHT - barHeight / 2, barWidth, barHeight / 2);

        x += barWidth + 1;
      }
    };

    drawAlt();
  };

  useEffect(() => {
    const audioContext = new (window.AudioContext ||
      (window as any).webkitAudioContext)();
    const analyser = audioContext.createAnalyser();
    const source = audioContext.createMediaStreamSource(stream);

    source.connect(analyser);
    audioContextRef.current = audioContext;
    analyserRef.current = analyser;

    visualize();

    return () => {
      if (drawVisualRef.current) {
        cancelAnimationFrame(drawVisualRef.current);
      }
      audioContext.close();
    };
  }, [stream]);

  useEffect(() => {
    if (drawVisualRef.current) {
      cancelAnimationFrame(drawVisualRef.current);
    }
    visualize();
  }, [visualSetting, barsColor]);

  return <canvas ref={canvasRef} width={width} height={height} />;
};
