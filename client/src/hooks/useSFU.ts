import { useEffect, useState, useRef } from "react";
import { singletonHook } from "react-singleton-hook";
import { useSocket } from "./useSocket";
import { useMicrophone } from "./useMicrophone";
import { useSpeakers } from "./useSpeakers";

interface StreamData {
  stream: MediaStream;
  id: string; // Unique identifier for the stream
  isLocal: boolean; // Flag indicating if it's a local stream
}

type StreamSources = {
  [id: string]: {
    gain: GainNode;
    analyser: AnalyserNode;
    stream: MediaStreamAudioSourceNode;
  };
};

interface SFUInterface {
  streams: StreamData[];
  error: string | null;
  streamSources: StreamSources;
}

function sfuHook(): SFUInterface {
  const [streams, setStreams] = useState<StreamData[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [registeredTracks, setRegisteredTracks] = useState<RTCRtpSender[]>([]);
  const [rtcActive, setRtcActive] = useState(false);
  const [streamSources, setStreamSources] = useState<StreamSources>({});

  const { sfu_host, stun_hosts, sendMessage } = useSocket();
  const { microphoneBuffer } = useMicrophone();
  const { mediaDestination, audioContext } = useSpeakers();

  // Using refs to store the RTCPeerConnection and WebSocket instances
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    Object.keys(streamSources).forEach((id) => {
      if (!streams.find((streamData) => streamData.id === id)) {
        const { gain, analyser, stream } = streamSources[id];
        stream.disconnect();
        analyser.disconnect();
        gain.disconnect();
        delete streamSources[id];
      }
    });
  }, [streams, streamSources]);

  useEffect(() => {
    console.log(streams.length, audioContext, mediaDestination);

    if (streams.length > 0 && audioContext && mediaDestination) {
      const newSources: StreamSources = {};

      streams.forEach((stream) => {
        if (stream.isLocal) return;
        if (!stream.stream.getAudioTracks().length) return;
        if (streamSources[stream.id]) return;

        // Fix for Chrome 😒
        const audio = (new Audio().srcObject = stream.stream);

        const nStream = audioContext.createMediaStreamSource(audio);
        const nAnalyser = audioContext.createAnalyser();
        const nGain = audioContext.createGain();
        nStream.connect(nAnalyser);
        nAnalyser.connect(nGain);
        nGain.connect(mediaDestination);

        newSources[stream.id] = {
          gain: nGain,
          analyser: nAnalyser,
          stream: nStream,
        };
      });

      setStreamSources(newSources);
    }

    return () => {};
  }, [streams, audioContext, mediaDestination]);

  useEffect(() => {
    if (
      sfu_host &&
      stun_hosts &&
      !pcRef.current &&
      !wsRef.current &&
      !rtcActive
    ) {
      try {
        if (microphoneBuffer.output) {
          setRtcActive(true);
          const localStream = microphoneBuffer.output.mediaStream;

          // Create a reference object to track streams
          const streamData = {
            stream: localStream,
            id: localStream.id,
            isLocal: true,
          };

          sendMessage("streamID", streamData.id);

          // Add the reference object to your streams state or array
          setStreams([...streams, streamData]);

          const configuration: RTCConfiguration = {
            iceServers: [
              {
                urls: stun_hosts,
              },
            ],
          };

          const pc = new RTCPeerConnection(configuration);
          pcRef.current = pc;

          const ws = new WebSocket(sfu_host);
          wsRef.current = ws;

          const trcks: RTCRtpSender[] = [];
          localStream.getTracks().forEach((track, index) => {
            console.log(index, "added track to stream", track.id);

            const trck = pc.addTrack(track, localStream);
            trcks.push(trck);
          });
          setRegisteredTracks(trcks);

          pc.ontrack = (event: RTCTrackEvent) => {
            console.log("New incoming stream:", event.streams);

            const remoteStream = event.streams[0];

            const streamId = remoteStream.id;

            setStreams((prevStreams) => {
              if (
                !prevStreams.some((_streamData) => _streamData.id === streamId)
              ) {
                return [
                  ...prevStreams,
                  { stream: remoteStream, id: streamId, isLocal: false },
                ];
              }
              return prevStreams;
            });
          };

          pc.onicecandidate = (e) => {
            if (e.candidate) {
              ws.send(
                JSON.stringify({
                  event: "candidate",
                  data: JSON.stringify(e.candidate),
                }),
              );
            }
          };

          ws.onopen = () => {
            console.log("WebSocket opened");
          };

          ws.onclose = (event) => {
            console.log("WebSocket closed", event);
          };

          ws.onmessage = (evt) => {
            const msg = JSON.parse(evt.data);
            if (!msg) {
              return console.log("Failed to parse message");
            }

            switch (msg.event) {
              case "offer":
                const offer = JSON.parse(msg.data);
                if (!offer) {
                  return console.log("Failed to parse offer");
                }
                pc.setRemoteDescription(new RTCSessionDescription(offer));
                pc.createAnswer().then((answer) => {
                  pc.setLocalDescription(answer);
                  ws.send(
                    JSON.stringify({
                      event: "answer",
                      data: JSON.stringify(answer),
                    }),
                  );
                });
                break;

              case "candidate":
                const candidate = JSON.parse(msg.data);
                if (!candidate) {
                  return console.log("Failed to parse candidate");
                }
                pc.addIceCandidate(new RTCIceCandidate(candidate));
                break;

              case "disconnect":
                const disconnectedStreamId = msg.streamId;
                setStreams((prevStreams) =>
                  prevStreams.filter(
                    (streamData) => streamData.id !== disconnectedStreamId,
                  ),
                );
                break;

              default:
                console.log("Unknown message event:", msg.event);
                break;
            }
          };

          ws.onerror = (evt) => {
            console.log("WebSocket error:", evt);
          };
        } else {
          console.log("Couldn't find microphone buffer");
        }
      } catch (err: any) {
        setError(err.message);
      }
    }

    // Cleanup on unmount or when webSocketUrl changes
    return () => {
      setRtcActive(false);

      if (pcRef.current) {
        registeredTracks.forEach((track) => {
          console.log("removed track from peer", track.track?.id);

          pcRef.current?.removeTrack(track);
        });
        console.log("cleaning up");

        //wsRef.current?.send(JSON.stringify({ event: "disconnect" }));

        pcRef.current?.close();
        wsRef.current?.close();
      }
    };
  }, [sfu_host, stun_hosts, microphoneBuffer]);

  return { streams, error, streamSources };
}

const init: SFUInterface = {
  error: null,
  streams: [],
  streamSources: {},
};

const SFUHook = singletonHook(init, sfuHook);

export const useSFU = () => {
  const sfu = SFUHook();

  return sfu;
};
