import { useEffect, useState, useRef } from "react";
import { singletonHook } from "react-singleton-hook";
import { useSocket } from "./useSocket";

interface StreamData {
  stream: MediaStream;
  id: string; // Unique identifier for the stream
  isLocal: boolean; // Flag indicating if it's a local stream
}

interface SFUInterface {
  streams: StreamData[];
  error: string | null;
}

function sfuHook(): SFUInterface {
  const [streams, setStreams] = useState<StreamData[]>([]);
  const [error, setError] = useState<string | null>(null);
  const { sfu_host, turn_host, turn_username, turn_password, stun_hosts } =
    useSocket();

  // Using refs to store the RTCPeerConnection and WebSocket instances
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    if (sfu_host && turn_host && turn_username && turn_password && stun_hosts) {
      const init = async () => {
        try {
          const localStream = await navigator.mediaDevices.getUserMedia({
            audio: {
              autoGainControl: false,
              echoCancellation: false,
              noiseSuppression: false,
            },
          });

          // Create a reference object to track streams
          const streamData = {
            stream: localStream,
            id: localStream.id,
            isLocal: true,
          };

          // Add the reference object to your streams state or array
          setStreams([...streams, streamData]);

          const configuration: RTCConfiguration = {
            iceServers: [
              {
                urls: stun_hosts,
              },
              {
                urls: turn_host,
                username: turn_username,
                credential: turn_password,
              },
            ],
          };

          const pc = new RTCPeerConnection(configuration);
          pcRef.current = pc;

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

          localStream
            .getTracks()
            .forEach((track) => pc.addTrack(track, localStream));

          const ws = new WebSocket(sfu_host);
          wsRef.current = ws;

          pc.onicecandidate = (e) => {
            if (e.candidate) {
              ws.send(
                JSON.stringify({
                  event: "candidate",
                  data: JSON.stringify(e.candidate),
                })
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
                    })
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
                    (streamData) => streamData.id !== disconnectedStreamId
                  )
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
        } catch (err: any) {
          setError(err.message);
        }
      };

      init();
    }

    // Cleanup on unmount or when webSocketUrl changes
    return () => {
      pcRef.current?.close();
      wsRef.current?.close();
    };
  }, [sfu_host, turn_host, turn_password, turn_username, stun_hosts]);

  return { streams, error };
}

const init: SFUInterface = {
  error: null,
  streams: [],
};

export const useSFU = singletonHook(init, sfuHook);
