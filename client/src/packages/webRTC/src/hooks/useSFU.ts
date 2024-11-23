import { useMicrophone, useSpeakers } from "@/audio";
import { useEffect, useState, useRef, useMemo } from "react";
import { singletonHook } from "react-singleton-hook";
import { SFUInterface, StreamData, StreamSources, Streams } from "../types/SFU";
import { useSettings } from "@/settings";
import { useSockets } from "@/socket";
import { Socket } from "socket.io-client";
import useSound from "use-sound";
import connectMp3 from "@/audio/src/assets/connect.mp3";
import disconnectMp3 from "@/audio/src/assets/disconnect.mp3";

function sfuHook(): SFUInterface {
  // Using refs to store the RTCPeerConnection and WebSocket instances
  const RTCpeerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const SFUwsRef = useRef<WebSocket | null>(null);

  const [streams, setStreams] = useState<Streams>({});
  const [error, setError] = useState<string | null>(null);
  const [registeredTracks, setRegisteredTracks] = useState<RTCRtpSender[]>([]);
  const [rtcActive, setRtcActive] = useState(false);
  const [streamSources, setStreamSources] = useState<StreamSources>({});
  const [currentServerConnected, setCurrentServerConnected] = useState("");
  const [currentSocket, setCurrentSocket] = useState<Socket | null>(null);
  const [currentChannel, setCurrentChannel] = useState("");
  const [channelToConnectTo, setChannelToConnectTo] = useState<string | null>(
    null
  );

  const { currentlyViewingServer, servers } = useSettings();
  const { microphoneBuffer } = useMicrophone();
  const { mediaDestination, audioContext } = useSpeakers();
  const { sockets, serverDetailsList } = useSockets();
  const [connectSound] = useSound(connectMp3, { volume: 0.1 });
  const [disconnectSound] = useSound(disconnectMp3, { volume: 0.1 });

  const sfu_host = useMemo(() => {
    return (
      currentlyViewingServer &&
      serverDetailsList[currentlyViewingServer.host]?.sfu_host
    );
  }, [serverDetailsList, currentlyViewingServer]);

  const stun_hosts = useMemo(() => {
    return (
      currentlyViewingServer &&
      serverDetailsList[currentlyViewingServer.host]?.stun_hosts
    );
  }, [serverDetailsList, currentlyViewingServer]);

  const isConnectedToChannel = useMemo(() => {
    return !!SFUwsRef.current && !!RTCpeerConnectionRef.current;
  }, [SFUwsRef.current, RTCpeerConnectionRef.current]);

  useEffect(() => {
    if (channelToConnectTo) {
      connect(channelToConnectTo)
        .then(() => {
          console.log("Connected to channel");
        })
        .catch((err) => {
          console.error("Failed to connect to channel:", err);
        });
      setChannelToConnectTo(null);
    }
  }, [channelToConnectTo]);

  useEffect(() => {
    if (isConnectedToChannel) {
      if (!servers[currentServerConnected]) {
        console.log("We are not part of this server anymore");
        disconnect()
          .then(() => {
            console.log("Disconnected from previous server");
          })
          .catch((err) => {
            console.error("Failed to disconnect from previous server:", err);
          });
      }
    }
  }, [servers, currentServerConnected, isConnectedToChannel]);

  useEffect(() => {
    // Iterate over all keys (IDs) in the streamSources object
    Object.keys(streamSources).forEach((id) => {
      // Check if the current ID exists in the streams array
      // If no stream in the streams array matches the current ID, it means it's no longer in use
      if (streams[id] === undefined) {
        // Destructure relevant objects for cleanup
        const { gain, analyser, stream } = streamSources[id];

        // Disconnect the stream, analyser, and gain nodes
        stream.disconnect();
        analyser.disconnect();
        gain.disconnect();

        // Make a copy of the streams object
        const newStreamSources = { ...streamSources };

        // Remove the stream
        delete newStreamSources[id];

        // Update the state
        setStreamSources(newStreamSources);

        console.log("Stream disconnected and removed:", id);
      }
    });
    // The effect runs whenever the `streams` or `streamSources` dependencies change
  }, [streams, streamSources]);

  useEffect(() => {
    // Check if audioContext and mediaDestination are initialized before proceeding
    if (!!audioContext && !!mediaDestination) {
      // Create a copy of the current streamSources to avoid directly mutating state
      const newStreamSources: StreamSources = { ...streamSources };

      // Iterate through each stream in the streams object
      Object.keys(streams).forEach((streamID) => {
        const stream = streams[streamID];
        console.log("checking stream", stream);

        // Skip processing if the stream is local
        if (stream.isLocal) return;

        // Skip if the stream is already in streamSources (already being processed)
        if (streamSources[streamID]) return;

        // Skip if the stream has no audio tracks (no audio to process)
        if (!stream.stream.getAudioTracks().length) return;

        // Chrome-specific fix: Ensure audio.srcObject is set to the stream
        const audio = (new Audio().srcObject = stream.stream);

        // Create an audio node for the stream
        const nStream = audioContext.createMediaStreamSource(audio);

        // Create an analyser node to visualize or process the audio frequencies
        const nAnalyser = audioContext.createAnalyser();

        // Create a gain node to control the audio volume
        const nGain = audioContext.createGain();

        // Connect the audio nodes: stream → analyser → gain → mediaDestination
        nStream.connect(nAnalyser);
        nAnalyser.connect(nGain);
        nGain.connect(mediaDestination);

        // Add the stream with its audio nodes to the newStreamSources object
        newStreamSources[streamID] = {
          gain: nGain,
          analyser: nAnalyser,
          stream: nStream,
        };
      });

      // Update the state with the new stream sources
      setStreamSources(newStreamSources);
    }
  }, [streams, audioContext, mediaDestination]); // Re-run effect when streams, audioContext, or mediaDestination change

  function connect(channelID: string) {
    return new Promise<void>(async (resolve, reject) => {
      try {
        if (!currentlyViewingServer) {
          return reject(new Error("Invalid server or socket state."));
        }

        if (channelID.length === 0) {
          return reject(new Error("Invalid channel ID."));
        }

        console.log(
          isConnectedToChannel,
          currentServerConnected !== currentlyViewingServer.host,
          currentChannel !== channelID
        );

        if (
          isConnectedToChannel &&
          (currentServerConnected !== currentlyViewingServer.host ||
            currentChannel !== channelID)
        ) {
          console.log("Disconnecting from current channel");
          await disconnect();
          setChannelToConnectTo(channelID);
          return resolve();
        }

        if (!!!sfu_host) {
          return reject(new Error("sfu_host is not defined"));
        }
        if (!!RTCpeerConnectionRef.current) {
          return reject(new Error("Already connected to SFU"));
        }
        if (!!!stun_hosts) {
          return reject(new Error("stun_hosts is not defined"));
        }
        if (!!SFUwsRef.current) {
          return reject(new Error("SFUref already exists"));
        }
        if (rtcActive) {
          return reject(new Error("RTC already active"));
        }

        const _currentsocket = sockets[currentlyViewingServer.host];
        console.log("Connecting to SFU");

        if (!!microphoneBuffer.output) {
          setRtcActive(true);
          const localStream = microphoneBuffer.output.mediaStream;

          const streamData: StreamData = {
            stream: localStream,
            isLocal: true,
          };

          setCurrentSocket(_currentsocket);
          _currentsocket.emit("streamID", localStream.id);

          const newStreams = { ...streams, [localStream.id]: streamData };
          setStreams(newStreams);

          const configuration: RTCConfiguration = {
            iceServers: [
              {
                urls: stun_hosts,
              },
            ],
          };

          connectSound();

          const pc = new RTCPeerConnection(configuration);
          const sfu_ws = new WebSocket(sfu_host);

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
            const newStream = { stream: remoteStream, isLocal: false };

            const updatedStreams = {
              ...streams,
              [remoteStream.id]: newStream,
            };
            setStreams(updatedStreams);
          };

          pc.onicecandidate = (e) => {
            if (e.candidate) {
              sfu_ws.send(
                JSON.stringify({
                  event: "candidate",
                  data: JSON.stringify(e.candidate),
                })
              );
            }
          };

          sfu_ws.onopen = () => {
            console.log("SFU connection opened");
          };

          sfu_ws.onclose = (event) => {
            console.log("SFU connection closed", event);
          };

          sfu_ws.onerror = (evt) => {
            console.log("WebSocket error:", evt);
            reject(new Error("WebSocket connection failed."));
          };

          sfu_ws.onmessage = (evt) => {
            try {
              const msg = JSON.parse(evt.data);
              if (!msg) {
                console.log("Failed to parse message");
                return;
              }

              switch (msg.event) {
                case "offer":
                  const offer = JSON.parse(msg.data);
                  if (!offer) {
                    console.log("Failed to parse offer");
                    return;
                  }
                  pc.setRemoteDescription(new RTCSessionDescription(offer));
                  pc.createAnswer().then((answer) => {
                    pc.setLocalDescription(answer);
                    sfu_ws.send(
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
                    console.log("Failed to parse candidate");
                    return;
                  }
                  pc.addIceCandidate(new RTCIceCandidate(candidate));
                  break;

                case "disconnect":
                  const disconnectedStreamId = msg.streamId;
                  streams[disconnectedStreamId]?.stream
                    .getTracks()
                    .forEach((track) => track.stop());
                  const updatedStreams = { ...streams };
                  delete updatedStreams[disconnectedStreamId];
                  setStreams(updatedStreams);
                  break;

                default:
                  console.log("Unknown message event:", msg.event);
                  break;
              }
            } catch (err) {
              console.error("Error handling message:", err);
            }
          };

          RTCpeerConnectionRef.current = pc;
          SFUwsRef.current = sfu_ws;

          console.log("Peer connection and WebSocket initialized");

          setCurrentServerConnected(currentlyViewingServer.host);
          setCurrentChannel(channelID);

          _currentsocket.emit("joinedChannel", true);

          // Resolve the promise when the connection is successfully established
          resolve();
        } else {
          reject(new Error("Couldn't find microphone buffer"));
        }
      } catch (err: any) {
        console.error(err);
        setError(err.message);
        setRtcActive(false);
        reject(err);
      }
    });
  }

  function disconnect(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        if (
          !currentlyViewingServer ||
          !currentSocket ||
          !currentServerConnected
        ) {
          setRtcActive(false); // Explicitly reset rtcActive on invalid state
          return reject(new Error("No server or socket to disconnect from."));
        }

        if (RTCpeerConnectionRef.current && SFUwsRef.current) {
          try {
            registeredTracks.forEach((track) => {
              console.log("Removed track from peer", track.track?.id);
              RTCpeerConnectionRef.current?.removeTrack(track);
            });

            console.log("Cleaning up");
            RTCpeerConnectionRef.current.close();
            SFUwsRef.current.close();

            SFUwsRef.current = null;
            RTCpeerConnectionRef.current = null;

            currentSocket.emit("streamID", "");
            setRtcActive(false); // Ensure rtcActive is updated here
            currentSocket.emit("joinedChannel", false);
            setCurrentSocket(null);
            disconnectSound();
            setCurrentServerConnected("");
            setCurrentChannel("");

            console.log("Disconnection successful");
            resolve();
          } catch (cleanupError) {
            setRtcActive(false); // Reset rtcActive even if cleanup fails
            console.error("Error during cleanup:", cleanupError);
            reject(cleanupError);
          }
        } else {
          console.log("No active peer connection or SFU reference");
          setRtcActive(false); // Handle cases with no active connections
          resolve();
        }
      } catch (err: any) {
        setRtcActive(false); // Ensure rtcActive is reset on errors
        console.error("Error in disconnect:", err);
        reject(err);
      }
    });
  }

  return {
    streams,
    error,
    streamSources,
    connect,
    disconnect,
    currentServerConnected,
    isConnected: isConnectedToChannel,
    currentChannelConnected: currentChannel,
  };
}

const init: SFUInterface = {
  error: null,
  streams: {},
  streamSources: {},
  connect: () => Promise.resolve(),
  disconnect: () => Promise.resolve(),
  currentChannelConnected: "",
  currentServerConnected: "",
  isConnected: false,
};

const SFUHook = singletonHook(init, sfuHook);

export const useSFU = () => {
  const sfu = SFUHook();

  return sfu;
};
