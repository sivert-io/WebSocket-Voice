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
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const SFUref = useRef<WebSocket | null>(null);

  const [streams, setStreams] = useState<Streams>({});
  const [error, setError] = useState<string | null>(null);
  const [registeredTracks, setRegisteredTracks] = useState<RTCRtpSender[]>([]);
  const [rtcActive, setRtcActive] = useState(false);
  const [streamSources, setStreamSources] = useState<StreamSources>({});
  const [isConnected, setIsConnected] = useState("");
  const [currentSocket, setCurrentSocket] = useState<Socket | null>(null);
  const [currentChannel, setCurrentChannel] = useState("");

  const { currentServer } = useSettings();
  const { microphoneBuffer } = useMicrophone();
  const { mediaDestination, audioContext } = useSpeakers();
  const { sockets, serverDetailsList } = useSockets();

  const sfu_host = useMemo(() => {
    return currentServer && serverDetailsList[currentServer.host]?.sfu_host;
  }, [serverDetailsList, currentServer]);

  const stun_hosts = useMemo(() => {
    return currentServer && serverDetailsList[currentServer.host]?.stun_hosts;
  }, [serverDetailsList, currentServer]);

  const [connectSound] = useSound(connectMp3, { volume: 0.1 });
  const [disconnectSound] = useSound(disconnectMp3, { volume: 0.1 });

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

  function connect(channelID: string): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        console.log(
          !!sfu_host &&
            !peerConnectionRef.current &&
            !!stun_hosts &&
            !SFUref.current &&
            !rtcActive &&
            isConnected.length === 0
        );

        if (!currentServer || currentSocket) {
          return reject(new Error("Invalid server or socket state."));
        }

        const _currentsocket = sockets[currentServer.host];
        if (
          !!sfu_host &&
          !peerConnectionRef.current &&
          !!stun_hosts &&
          !SFUref.current &&
          !rtcActive &&
          isConnected.length === 0
        ) {
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

            peerConnectionRef.current = pc;
            SFUref.current = sfu_ws;

            console.log("Peer connection and WebSocket initialized");

            setIsConnected(currentServer.host);
            setCurrentChannel(channelID);

            _currentsocket.emit("joinedChannel", true);

            // Resolve the promise when the connection is successfully established
            resolve();
          } else {
            reject(new Error("Couldn't find microphone buffer"));
          }
        } else {
          reject(new Error("Preconditions for connecting are not met."));
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
        if (!currentServer || !currentSocket || !isConnected) {
          return reject(new Error("No server or socket to disconnect from."));
        }

        if (peerConnectionRef.current && SFUref.current) {
          try {
            registeredTracks.forEach((track) => {
              console.log("Removed track from peer", track.track?.id);
              peerConnectionRef.current?.removeTrack(track);
            });

            console.log("Cleaning up");

            peerConnectionRef.current.close();
            SFUref.current.close();

            SFUref.current = null;
            peerConnectionRef.current = null;

            currentSocket.emit("streamID", "");
            setRtcActive(false);
            currentSocket.emit("joinedChannel", false);
            setCurrentSocket(null);
            disconnectSound();
            setIsConnected("");
            setCurrentChannel("");

            console.log("Disconnection successful");
            resolve(); // Resolve the promise when cleanup is complete
          } catch (cleanupError) {
            console.error("Error during cleanup:", cleanupError);
            reject(cleanupError);
          }
        } else {
          console.log("No active peer connection or SFU reference");
          resolve(); // Nothing to disconnect, resolve immediately
        }
      } catch (err: any) {
        console.error("Error in disconnect:", err);
        reject(err); // Reject the promise if an error occurs
      }
    });
  }

  return {
    streams,
    error,
    streamSources,
    connect,
    disconnect,
    isConnected,
    currentChannel,
  };
}

const init: SFUInterface = {
  error: null,
  streams: {},
  streamSources: {},
  connect: () => Promise.resolve(),
  disconnect: () => Promise.resolve(),
  isConnected: "",
  currentChannel: "",
};

const SFUHook = singletonHook(init, sfuHook);

export const useSFU = () => {
  const sfu = SFUHook();

  return sfu;
};
