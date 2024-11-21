import { useMicrophone, useSpeakers } from "@/audio";
import { useEffect, useState, useRef, useMemo } from "react";
import { singletonHook } from "react-singleton-hook";
import { SFUInterface, StreamData, StreamSources, Streams } from "../types/SFU";
import { useSettings } from "@/settings";
import { useConnections } from "@/socket/src/context/connectionsProvider";

function sfuHook(): SFUInterface {
  // Using refs to store the RTCPeerConnection and WebSocket instances
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const SFUref = useRef<WebSocket | null>(null);
  const [streams, setStreams] = useState<Streams>({});
  const [error, setError] = useState<string | null>(null);
  const [registeredTracks, setRegisteredTracks] = useState<RTCRtpSender[]>([]);
  const [rtcActive, setRtcActive] = useState(false);
  const [streamSources, setStreamSources] = useState<StreamSources>({});
  const { currentServer } = useSettings();
  const { microphoneBuffer } = useMicrophone();
  const { mediaDestination, audioContext } = useSpeakers();
  const isConnected = useMemo(
    () => !!SFUref.current && !!peerConnectionRef.current,
    [SFUref.current, peerConnectionRef.current]
  );

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

  function connect() {
    if (!currentServer) return;
    const { connections } = useConnections();
    const stun_hosts = connections[currentServer.host].getStunHosts();
    const sfu_host = connections[currentServer.host].getSfuHost();
    const { sendMessage } = connections[currentServer.host];
    if (
      sfu_host &&
      !peerConnectionRef.current &&
      stun_hosts &&
      !SFUref.current &&
      !rtcActive &&
      !isConnected
    ) {
      try {
        console.log("Connecting to SFU");
        if (microphoneBuffer.output) {
          setRtcActive(true);
          const localStream = microphoneBuffer.output.mediaStream;

          // Create a reference object to track streams
          const streamData: StreamData = {
            stream: localStream,
            isLocal: true,
          };

          sendMessage("streamID", localStream.id);

          // Create a new copy of the streams object
          const newStreams = { ...streams, [localStream.id]: streamData };

          // Update the streams state with the new object
          setStreams(newStreams);

          const configuration: RTCConfiguration = {
            iceServers: [
              {
                urls: stun_hosts,
              },
            ],
          };

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
            // Log the incoming media stream(s) for debugging purposes
            console.log("New incoming stream:", event.streams);

            // Access the first media stream from the event
            const remoteStream = event.streams[0];

            const newStream = {
              stream: remoteStream,
              isLocal: false,
            };

            // Create a new copy of the streams object
            const newStreams = { ...streams, [remoteStream.id]: newStream };

            // Update the streams state with the new object
            setStreams(newStreams);
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
          };

          sfu_ws.onmessage = (evt) => {
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
                  return console.log("Failed to parse candidate");
                }
                pc.addIceCandidate(new RTCIceCandidate(candidate));
                break;

              case "disconnect":
                const disconnectedStreamId = msg.streamId;

                // Close the stream and remove it from the streams object
                streams[disconnectedStreamId].stream
                  .getTracks()
                  .forEach((track) => {
                    track.stop();
                  });

                // Make a copy of the streams object
                const newStreams = { ...streams };

                // Remove the stream
                delete newStreams[disconnectedStreamId];

                // Update the state
                setStreams(newStreams);
                break;

              default:
                console.log("Unknown message event:", msg.event);
                break;
            }
          };

          peerConnectionRef.current = pc;
          SFUref.current = sfu_ws;

          console.log("Peer connection and WebSocket initialized");

          sendMessage("joinedChannel", true);
        } else {
          console.log("Couldn't find microphone buffer");
        }
      } catch (err: any) {
        setError(err.message);
        setRtcActive(false);
      }
    }
  }

  function disconnect() {
    if (!currentServer) return;
    const { connections } = useConnections();
    const { sendMessage } = connections[currentServer.host];
    if (peerConnectionRef.current && SFUref.current) {
      registeredTracks.forEach((track) => {
        console.log("removed track from peer", track.track?.id);

        peerConnectionRef.current?.removeTrack(track);
      });
      console.log("cleaning up");

      peerConnectionRef.current.close();
      SFUref.current.close();

      SFUref.current = null;
      peerConnectionRef.current = null;

      sendMessage("streamID", "");
      setRtcActive(false);
      sendMessage("joinedChannel", false);
    }
  }

  return {
    streams,
    error,
    streamSources,
    connect,
    disconnect,
    isConnected,
  };
}

const init: SFUInterface = {
  error: null,
  streams: {},
  streamSources: {},
  connect: () => {},
  disconnect: () => {},
  isConnected: false,
};

const SFUHook = singletonHook(init, sfuHook);

export const useSFU = () => {
  const sfu = SFUHook();

  return sfu;
};
