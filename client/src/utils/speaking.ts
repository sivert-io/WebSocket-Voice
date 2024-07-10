export const isSpeaking = (audioContext: AudioContext, threshold: number) => {
  // Create an AnalyserNode
  const analyser = audioContext.createAnalyser();
  analyser.fftSize = 256;

  const bufferLength = analyser.frequencyBinCount;
  const dataArray = new Uint8Array(bufferLength);

  // Function to get the current volume
  const getCurrentVolume = (analyser: AnalyserNode): number => {
    analyser.getByteTimeDomainData(dataArray);

    let sum = 0;
    for (let i = 0; i < bufferLength; i++) {
      sum += (dataArray[i] - 128) * (dataArray[i] - 128);
    }

    const rms = Math.sqrt(sum / bufferLength);
    return rms;
  };

  // Calculate the current volume and check against the threshold
  const currentVolume = getCurrentVolume(analyser);
  console.log("current volume is", currentVolume);

  return currentVolume > threshold;
};
