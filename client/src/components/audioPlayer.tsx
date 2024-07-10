import { useRef, useEffect } from "react";

interface AudioPlayerProps {
  stream: MediaStream | null;
}

export function AudioPlayer({ stream }: AudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    const audioElement = audioRef.current;
    if (audioElement && stream) {
      audioElement.srcObject = stream;
      audioElement.play().catch((error) => {
        console.error("Error playing audio:", error);
      });
    }
    return () => {
      if (audioElement) {
        audioElement.pause();
        audioElement.srcObject = null;
      }
    };
  }, [stream]);

  return (
    <div>
      <audio ref={audioRef} controls />
    </div>
  );
}
