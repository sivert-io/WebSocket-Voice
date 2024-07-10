import { useEffect, useState } from "react";
import { Button, Flex, Select, Text } from "@radix-ui/themes";
import RecordRTC from "recordrtc";

function joinAudioBuffers(
  audioContext: AudioContext,
  buffers: AudioBuffer[]
): AudioBuffer {
  if (buffers.length === 0) {
    throw new Error("The buffers array is empty.");
  }

  // Calculate the total length of the combined AudioBuffer
  const numberOfChannels = buffers[0].numberOfChannels;
  const sampleRate = buffers[0].sampleRate;
  const totalLength = buffers.reduce((acc, buffer) => acc + buffer.length, 0);

  // Create a new AudioBuffer with the total length
  const combinedBuffer = audioContext.createBuffer(
    numberOfChannels,
    totalLength,
    sampleRate
  );

  // Copy each AudioBuffer into the combined buffer
  let offset = 0;
  buffers.forEach((buffer) => {
    for (let channel = 0; channel < numberOfChannels; channel++) {
      combinedBuffer.copyToChannel(
        buffer.getChannelData(channel),
        channel,
        offset
      );
    }
    offset += buffer.length;
  });

  return combinedBuffer;
}

const AudioContext = window.AudioContext;

const queue: AudioBuffer[] = [];
const audioContext = new AudioContext();
let lastPlayTimeEnd = 0;
const minBufferSize = 2;
async function handleQueue() {
  if (queue.length >= minBufferSize) {
    const buffer = queue.splice(0);

    // Checks if the audioContext time is ahead of the last play time, if yes, use the audioContext time, else use the last play time
    const timeToPlay =
      audioContext.currentTime > lastPlayTimeEnd
        ? audioContext.currentTime
        : lastPlayTimeEnd;

    const sourceBuffer = audioContext.createBufferSource();
    sourceBuffer.connect(audioContext.destination);

    const combinedAudioBuffer = joinAudioBuffers(audioContext, buffer);

    console.log(
      "Playing audio at",
      timeToPlay,
      "with duration",
      combinedAudioBuffer.duration,
      "and chunks",
      buffer.length
    );

    sourceBuffer.buffer = combinedAudioBuffer;
    sourceBuffer.start(timeToPlay);
    const audioDuration = combinedAudioBuffer.duration || 50;
    lastPlayTimeEnd = timeToPlay + audioDuration;
  }
}

export function Microphone() {
  const [supported, setSupported] = useState<boolean | undefined>(undefined);
  const [devices, setDevices] = useState<InputDeviceInfo[]>([]);
  const [micId, setMicId] = useState<string | undefined>();
  const [stream, setStream] = useState<MediaStream | undefined>();

  const checkSupported = () => {
    if (navigator.mediaDevices && AudioContext) {
      setSupported(true);
    } else {
      setSupported(false);
    }
  };
  useEffect(checkSupported, []);

  const getMicrophones = async () => {
    // First get permission:
    await navigator.mediaDevices
      .getUserMedia({ audio: true, video: false })
      .then(() => console.log("success"));

    navigator.mediaDevices.enumerateDevices().then((devices) => {
      devices = devices.filter((d) => d.kind === "audioinput");
      console.log("found devices: ", devices);
      setDevices(devices as InputDeviceInfo[]);
    });
  };

  const start = async () => {
    if (!micId) {
      throw new Error("missing capture device id");
    }
    const stream: MediaStream = await navigator.mediaDevices.getUserMedia({
      // audio: true // constraints - only audio needed for this app
      audio: {
        deviceId: micId,
        autoGainControl: false,
        echoCancellation: false,
        noiseSuppression: false,
      },
    });
    setStream(stream);

    const recorder = new RecordRTC(stream, {
      type: "audio",
      mimeType: "audio/webm",
      timeSlice: 0,
      bufferSize: 256,
      recorderType: RecordRTC.StereoAudioRecorder,
      ondataavailable: async function (blob) {
        try {
          const arrayBuffer = await blob.arrayBuffer();
          const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
          queue.push(audioBuffer);
          handleQueue();
        } catch (error) {
          console.error("Error decoding audio data:", error);
        }
      },
    });

    recorder.startRecording();
  };

  const turnOffStream = () => {
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      queue.splice(0);
    }
    setStream(undefined);
  };

  const switchMic = (deviceId: string) => {
    turnOffStream();
    setMicId(deviceId);
  };

  return (
    <div className="App">
      <header className="App-header">
        {supported === undefined && (
          <>
            <p>Checking browser for Audio APIs</p>
          </>
        )}
        {supported === true && (
          <>
            <div>
              <div>
                {devices.length === 0 && (
                  <Button onClick={getMicrophones}>
                    Detect available devices
                  </Button>
                )}
              </div>
            </div>
            {devices.length > 0 && (
              <Flex gap="2" direction="column">
                <Select.Root onValueChange={switchMic}>
                  <Select.Trigger placeholder="Select input device" />
                  <Select.Content position="popper">
                    {devices.map((inputDevice) => (
                      <Select.Item
                        key={inputDevice.deviceId}
                        value={inputDevice.deviceId}
                      >
                        {inputDevice.label}
                      </Select.Item>
                    ))}
                  </Select.Content>
                </Select.Root>

                {stream ? (
                  <div>
                    {stream && <Button onClick={turnOffStream}>Stop</Button>}
                  </div>
                ) : (
                  <div>
                    <Button onClick={start} disabled={micId === undefined}>
                      Record
                    </Button>
                  </div>
                )}
                <Button onClick={getMicrophones}>Refresh devices</Button>
              </Flex>
            )}
          </>
        )}
        {supported === false && <Text>Unsupported</Text>}
      </header>
    </div>
  );
}
