import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { singletonHook } from "react-singleton-hook";
import { Socket } from "socket.io-client";
import useSound from "use-sound";

import { useMicrophone, useSpeakers } from "@/audio";
import connectMp3 from "@/audio/src/assets/connect.mp3";
import disconnectMp3 from "@/audio/src/assets/disconnect.mp3";
import { useSettings } from "@/settings";
import { useSockets } from "@/socket";

import { SFUInterface, Streams, StreamSources } from "../types/SFU";

// Connection states for better state management
enum ConnectionState {
  DISCONNECTED = 'disconnected',
  REQUESTING_ACCESS = 'requesting_access',
  CONNECTING = 'connecting',
  CONNECTED = 'connected',
  FAILED = 'failed',
}

interface SFUConnectionState {
  state: ConnectionState;
  roomId: string | null;
  serverId: string | null;
  error: string | null;
}

interface RoomAccessData {
  room_id: string;
  join_token: any;
  sfu_url: string;
  timestamp: number;
}

function useSfuHook(): SFUInterface {
  // Core WebRTC references
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const sfuWebSocketRef = useRef<WebSocket | null>(null);
  const registeredTracksRef = useRef<RTCRtpSender[]>([]);
  const reconnectAttemptRef = useRef<NodeJS.Timeout | null>(null);
  const previousRemoteStreamsRef = useRef<Set<string>>(new Set());
  const connectionTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isDisconnectingRef = useRef<boolean>(false);

  // State management
  const [connectionState, setConnectionState] = useState<SFUConnectionState>({
    state: ConnectionState.DISCONNECTED,
    roomId: null,
    serverId: null,
    error: null,
  });

  const [streams, setStreams] = useState<Streams>({});
  const [streamSources, setStreamSources] = useState<StreamSources>({});

  // Dependencies
  const { 
    currentlyViewingServer, 
    servers,
    connectSoundEnabled,
    disconnectSoundEnabled,
    connectSoundVolume,
    disconnectSoundVolume,
    customConnectSoundFile,
    customDisconnectSoundFile,
  } = useSettings();
  const { sockets, serverDetailsList } = useSockets();
  
  // Sound hooks with dynamic settings
  const [connectSound] = useSound(
    customConnectSoundFile || connectMp3, 
    { 
      volume: connectSoundVolume / 100,
      soundEnabled: connectSoundEnabled 
    }
  );
  const [disconnectSound] = useSound(
    customDisconnectSoundFile || disconnectMp3, 
    { 
      volume: disconnectSoundVolume / 100,
      soundEnabled: disconnectSoundEnabled 
    }
  );

  // Computed values
  const sfuHost = useMemo(() => {
    return currentlyViewingServer?.host && serverDetailsList[currentlyViewingServer.host]?.sfu_host;
  }, [serverDetailsList, currentlyViewingServer]);

  const stunHosts = useMemo(() => {
    return currentlyViewingServer?.host && serverDetailsList[currentlyViewingServer.host]?.stun_hosts;
  }, [serverDetailsList, currentlyViewingServer]);

  const isConnected = useMemo(() => {
    return connectionState.state === ConnectionState.CONNECTED &&
           !!sfuWebSocketRef.current &&
           !!peerConnectionRef.current;
  }, [connectionState.state]);

  // Only access microphone when connecting or connected
  const shouldAccessMicrophone = useMemo(() => {
    return connectionState.state === ConnectionState.CONNECTING || 
           connectionState.state === ConnectionState.CONNECTED ||
           connectionState.state === ConnectionState.REQUESTING_ACCESS;
  }, [connectionState.state]);

  const { microphoneBuffer } = useMicrophone(shouldAccessMicrophone);
  const { mediaDestination, audioContext } = useSpeakers();

  // Enhanced cleanup function
  const performCleanup = useCallback(async (skipServerUpdate = false) => {
    console.log("🧹 Performing comprehensive cleanup");
    
    isDisconnectingRef.current = true;

    // Clear all timeouts
    if (reconnectAttemptRef.current) {
      clearTimeout(reconnectAttemptRef.current);
      reconnectAttemptRef.current = null;
    }
    
    if (connectionTimeoutRef.current) {
      clearTimeout(connectionTimeoutRef.current);
      connectionTimeoutRef.current = null;
    }

    // Clear peer tracking
    previousRemoteStreamsRef.current.clear();

    // Remove tracks with proper error handling
    const tracksToRemove = [...registeredTracksRef.current];
    registeredTracksRef.current = [];
    
    for (const sender of tracksToRemove) {
      try {
        if (peerConnectionRef.current && sender.track) {
          peerConnectionRef.current.removeTrack(sender);
          console.log("🗑️ Removed track:", sender.track.id);
        }
      } catch (error) {
        console.error("Error removing track:", error);
      }
    }

    // Close peer connection with proper state checking
    if (peerConnectionRef.current) {
      try {
        if (peerConnectionRef.current.connectionState !== 'closed') {
          peerConnectionRef.current.close();
        }
        peerConnectionRef.current = null;
        console.log("🔌 Peer connection closed");
      } catch (error) {
        console.error("Error closing peer connection:", error);
        peerConnectionRef.current = null;
      }
    }

    // Close WebSocket with proper state checking and keep-alive cleanup
    if (sfuWebSocketRef.current) {
      try {
        if (sfuWebSocketRef.current.readyState === WebSocket.OPEN || 
            sfuWebSocketRef.current.readyState === WebSocket.CONNECTING) {
          sfuWebSocketRef.current.close(1000, "Client disconnecting");
        }
        sfuWebSocketRef.current = null;
        console.log("🔌 SFU WebSocket closed");
      } catch (error) {
        console.error("Error closing SFU WebSocket:", error);
        sfuWebSocketRef.current = null;
      }
    }

    // Update server state if not skipping
    if (!skipServerUpdate && connectionState.serverId && sockets[connectionState.serverId]) {
      try {
        const socket = sockets[connectionState.serverId];
        socket.emit("streamID", "");
        socket.emit("joinedChannel", false);
        console.log("📤 Updated server state: disconnected");
      } catch (error) {
        console.error("Error updating server state:", error);
      }
    }

    // Aggressively clean up all audio processing
    setStreamSources(prev => {
      Object.values(prev).forEach(({ gain, analyser, stream }) => {
        try {
          stream.disconnect();
          analyser.disconnect();
          gain.disconnect();
        } catch (error) {
          console.error("Error disconnecting audio nodes:", error);
        }
      });
      return {};
    });

    // Clear only remote streams, preserve local streams for UI
    setStreams(prev => {
      const localStreams: Streams = {};
      Object.entries(prev).forEach(([id, stream]) => {
        if (stream.isLocal) {
          localStreams[id] = stream;
        }
      });
      return localStreams;
    });

    // Add a small delay to ensure cleanup completes
    await new Promise(resolve => setTimeout(resolve, 100));
    
    isDisconnectingRef.current = false;
    console.log("✅ Cleanup completed");
  }, [connectionState.serverId, sockets]);

  // Track peer connections and play sounds when peers join/leave
  useEffect(() => {
    // Only track peer sounds when we're connected to a room
    if (!isConnected) {
      previousRemoteStreamsRef.current.clear();
      return;
    }

    // Get current remote stream IDs
    const currentRemoteStreams = new Set<string>();
    Object.entries(streams).forEach(([streamId, streamData]) => {
      if (!streamData.isLocal) {
        currentRemoteStreams.add(streamId);
      }
    });

    const previousRemoteStreams = previousRemoteStreamsRef.current;

    // Check for new peers (streams that are in current but not in previous)
    const newPeers = [...currentRemoteStreams].filter(streamId => !previousRemoteStreams.has(streamId));
    
    // Check for disconnected peers (streams that were in previous but not in current)
    const disconnectedPeers = [...previousRemoteStreams].filter(streamId => !currentRemoteStreams.has(streamId));

    // Play sounds for peer changes
    if (newPeers.length > 0) {
      console.log("🔊 Peer(s) connected to WebRTC:", newPeers);
      
      // Play connect sound if enabled
      if (connectSoundEnabled) {
        try {
          connectSound();
        } catch (error) {
          console.error("Error playing peer connect sound:", error);
        }
      }
      
      // Emit voice connection status to server for each new peer
      if (connectionState.serverId && sockets[connectionState.serverId]) {
        const socket = sockets[connectionState.serverId];
        newPeers.forEach(streamId => {
          socket.emit("peerVoiceConnected", streamId);
        });
      }
    }

    if (disconnectedPeers.length > 0) {
      console.log("🔇 Peer(s) disconnected from WebRTC:", disconnectedPeers);
      
      // Play disconnect sound if enabled
      if (disconnectSoundEnabled) {
        try {
          disconnectSound();
        } catch (error) {
          console.error("Error playing peer disconnect sound:", error);
        }
      }

      // Emit voice disconnection status to server
      if (connectionState.serverId && sockets[connectionState.serverId]) {
        const socket = sockets[connectionState.serverId];
        disconnectedPeers.forEach(streamId => {
          socket.emit("peerVoiceDisconnected", streamId);
          });
      }
    }

    // Update the reference for next comparison
    previousRemoteStreamsRef.current = currentRemoteStreams;
  }, [streams, isConnected, connectSound, disconnectSound, connectSoundEnabled, disconnectSoundEnabled, connectionState.serverId, sockets]);

  // Cleanup disconnected streams
  useEffect(() => {
    Object.keys(streamSources).forEach((id) => {
      if (streams[id] === undefined) {
        try {
        const { gain, analyser, stream } = streamSources[id];
        stream.disconnect();
        analyser.disconnect();
        gain.disconnect();

          setStreamSources(prev => {
            const newSources = { ...prev };
            delete newSources[id];
            return newSources;
          });

          console.log("🧹 Stream disconnected and removed:", id);
        } catch (error) {
          console.error("Error cleaning up stream:", id, error);
          // Remove from state even if cleanup fails
          setStreamSources(prev => {
            const newSources = { ...prev };
            delete newSources[id];
            return newSources;
          });
        }
      }
    });
  }, [streams, streamSources]);

  // Setup audio processing for remote streams
  useEffect(() => {
    if (!audioContext || !mediaDestination) return;

      const newStreamSources: StreamSources = { ...streamSources };
    let hasChanges = false;

      Object.keys(streams).forEach((streamID) => {
        const stream = streams[streamID];

      // Skip local streams or already processed streams
      if (stream.isLocal || streamSources[streamID] || !stream.stream.getAudioTracks().length) {
        return;
      }

      try {
        // Create audio processing chain
        const audio = new Audio();
        audio.srcObject = stream.stream;
        
        const sourceNode = audioContext.createMediaStreamSource(stream.stream);
        const analyserNode = audioContext.createAnalyser();
        const gainNode = audioContext.createGain();

        // Connect: source → analyser → gain → destination
        sourceNode.connect(analyserNode);
        analyserNode.connect(gainNode);
        gainNode.connect(mediaDestination);

        newStreamSources[streamID] = {
          gain: gainNode,
          analyser: analyserNode,
          stream: sourceNode,
        };

        hasChanges = true;
        console.log("🎵 Audio processing setup for stream:", streamID);
      } catch (error) {
        console.error("❌ Failed to setup audio processing for stream:", streamID, error);
      }
    });

    // Only update state if there are actual changes
    if (hasChanges) {
      setStreamSources(newStreamSources);
    }
  }, [streams, audioContext, mediaDestination]);

  // Auto-disconnect when server is removed (only if the current server is actually removed)
  useEffect(() => {
    if (isConnected && connectionState.serverId && currentlyViewingServer?.host !== connectionState.serverId) {
      // Only disconnect if we're viewing a different server, not when UI state changes
      const serverStillExists = servers[connectionState.serverId];
      if (!serverStillExists) {
        console.log("🚪 Connected server was removed, disconnecting from SFU");
        disconnect().catch(console.error);
      }
    }
  }, [servers, connectionState.serverId, isConnected, currentlyViewingServer?.host]);

  // Request room access from server
  const requestRoomAccess = useCallback(async (roomId: string, socket: Socket): Promise<RoomAccessData> => {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error("Room access request timeout"));
      }, 15000);

      const cleanup = () => {
        clearTimeout(timeout);
        socket.off("room_access_granted", onAccessGranted);
        socket.off("room_error", onRoomError);
      };

      const onAccessGranted = (roomData: RoomAccessData) => {
        cleanup();
        console.log("✅ Room access granted:", roomData);
        resolve(roomData);
      };

      const onRoomError = (error: string) => {
        cleanup();
        console.error("❌ Room access denied:", error);
        reject(new Error(`Room access denied: ${error}`));
      };

      socket.once("room_access_granted", onAccessGranted);
      socket.once("room_error", onRoomError);
      
      console.log("🔑 Requesting room access for:", roomId);
      socket.emit("requestRoomAccess", roomId);
    });
  }, []);

  // Setup WebRTC peer connection with enhanced error handling
  const setupPeerConnection = useCallback((stunServers: string[]): RTCPeerConnection => {
    const config: RTCConfiguration = {
      iceServers: [{ urls: stunServers }],
      iceCandidatePoolSize: 10,
      iceTransportPolicy: 'all',
      bundlePolicy: 'balanced',
      rtcpMuxPolicy: 'require',
      // Add DTLS fingerprint verification
      certificates: undefined, // Let browser generate
    };

    const pc = new RTCPeerConnection(config);

    // Enhanced ICE candidate handling
    pc.onicecandidate = (event) => {
      if (event.candidate && sfuWebSocketRef.current?.readyState === WebSocket.OPEN) {
        try {
          sfuWebSocketRef.current.send(JSON.stringify({
            event: "candidate",
            data: JSON.stringify(event.candidate),
          }));
          console.log("📤 Sent ICE candidate:", event.candidate.type);
        } catch (error) {
          console.error("❌ Error sending ICE candidate:", error);
        }
      } else if (event.candidate === null) {
        console.log("🧊 ICE gathering completed");
      }
    };

    // Enhanced ICE connection state monitoring
    pc.oniceconnectionstatechange = () => {
      console.log("🧊 ICE connection state:", pc.iceConnectionState);
      
      switch (pc.iceConnectionState) {
        case 'checking':
          console.log("🔍 ICE connectivity checks in progress");
          break;
        case 'connected':
        case 'completed':
          console.log("✅ ICE connection established");
          break;
        case 'failed':
          console.error("❌ ICE connection failed - may need TURN server");
          console.log("💡 Consider adding TURN servers for better connectivity");
          break;
        case 'disconnected':
          console.warn("⚠️ ICE connection disconnected - attempting to reconnect");
          break;
        case 'closed':
          console.log("🔌 ICE connection closed");
          break;
      }
    };

    // Enhanced ICE gathering state monitoring
    pc.onicegatheringstatechange = () => {
      console.log("🧊 ICE gathering state:", pc.iceGatheringState);
    };

    // Enhanced signaling state monitoring
    pc.onsignalingstatechange = () => {
      console.log("📡 Signaling state:", pc.signalingState);
      
      switch (pc.signalingState) {
        case 'stable':
          console.log("✅ Signaling state is stable");
          break;
        case 'have-local-offer':
          console.log("📤 Local offer created, waiting for answer");
          break;
        case 'have-remote-offer':
          console.log("📨 Remote offer received, creating answer");
          break;
        case 'have-local-pranswer':
          console.log("📤 Local provisional answer created");
          break;
        case 'have-remote-pranswer':
          console.log("📨 Remote provisional answer received");
          break;
        case 'closed':
          console.log("🔌 Signaling closed");
          break;
      }
    };

    pc.ontrack = (event) => {
      console.log("🎵 New incoming stream:", event.streams);
            const remoteStream = event.streams[0];
      
      if (remoteStream) {
        console.log("🎵 Adding remote stream:", {
          id: remoteStream.id,
          audioTracks: remoteStream.getAudioTracks().length,
          videoTracks: remoteStream.getVideoTracks().length,
          tracks: remoteStream.getTracks().map(t => ({ kind: t.kind, id: t.id, enabled: t.enabled }))
        });
        
        setStreams(prev => ({
          ...prev,
          [remoteStream.id]: { stream: remoteStream, isLocal: false },
        }));
      } else {
        console.warn("⚠️ Received ontrack event but no remote stream");
      }
    };

    pc.onconnectionstatechange = () => {
      console.log("🔗 Peer connection state:", pc.connectionState);
      
      switch (pc.connectionState) {
        case 'new':
          console.log("🆕 New peer connection created");
          break;
        case 'connecting':
          console.log("🔄 Peer connection connecting");
          break;
        case 'connected':
          console.log("✅ WebRTC peer connection established");
          // Clear any connection timeout
          if (connectionTimeoutRef.current) {
            clearTimeout(connectionTimeoutRef.current);
            connectionTimeoutRef.current = null;
          }
          break;
        case 'disconnected':
          console.warn("⚠️ WebRTC peer connection disconnected");
          break;
        case 'failed':
        case 'closed':
          console.log("❌ WebRTC peer connection failed/closed");
          if (!isDisconnectingRef.current) {
            setConnectionState(prev => ({ 
              ...prev, 
              state: ConnectionState.FAILED, 
              error: "WebRTC connection failed" 
            }));
          }
          break;
      }
    };

    // Add data channel for connection health monitoring
    try {
      const dataChannel = pc.createDataChannel("health", {
        ordered: true,
        maxRetransmits: 3,
      });
      
      dataChannel.onopen = () => {
        console.log("📡 Data channel opened for health monitoring");
      };
      
      dataChannel.onclose = () => {
        console.log("📡 Data channel closed");
      };
      
      dataChannel.onerror = (error) => {
        console.error("❌ Data channel error:", error);
      };
    } catch (error) {
      console.warn("⚠️ Could not create data channel:", error);
    }

    return pc;
  }, []);

  // Enhanced SFU WebSocket setup with better error handling
  const setupSFUWebSocket = useCallback((sfuUrl: string, joinToken: any): Promise<WebSocket> => {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(sfuUrl);
      let isResolved = false;
      let offerProcessingInProgress = false;
      let connectionMonitor: NodeJS.Timeout | null = null;
      let reconnectAttempt = 0;
      const maxReconnectAttempts = 3;

      const timeout = setTimeout(() => {
        if (!isResolved) {
          ws.close();
          reject(new Error("SFU WebSocket connection timeout"));
        }
      }, 15000); // Increased timeout

      // Monitor connection health and attempt recovery
      const startConnectionMonitor = () => {
        connectionMonitor = setInterval(() => {
          if (ws.readyState !== WebSocket.OPEN) {
            console.warn("⚠️ SFU WebSocket connection lost, readyState:", ws.readyState);
            if (connectionMonitor) {
              clearInterval(connectionMonitor);
              connectionMonitor = null;
            }
            
            // Attempt to recover connection if WebRTC is still healthy
            if (peerConnectionRef.current && 
                peerConnectionRef.current.connectionState === 'connected' &&
                reconnectAttempt < maxReconnectAttempts) {
              console.log("🔄 Attempting to recover SFU WebSocket connection...");
              attemptReconnection();
            }
          } else {
            console.log("📡 SFU WebSocket connection healthy");
            
            // Send keep-alive message to prevent network timeouts
            try {
              ws.send(JSON.stringify({
                event: "keep_alive",
                data: JSON.stringify({ timestamp: Date.now() }),
              }));
              console.log("💓 Sent keep-alive to SFU");
            } catch (error) {
              console.warn("⚠️ Failed to send keep-alive:", error);
            }
          }
        }, 15000); // Check every 15 seconds
      };

      const attemptReconnection = () => {
        reconnectAttempt++;
        console.log(`🔄 SFU reconnection attempt ${reconnectAttempt}/${maxReconnectAttempts}`);
        
        setTimeout(() => {
          if (peerConnectionRef.current && 
              peerConnectionRef.current.connectionState === 'connected') {
            console.log("🔄 WebRTC still healthy, attempting SFU reconnection...");
            // Note: This would require a more complex reconnection strategy
            // For now, we'll just log and let the existing reconnection handle it
          }
        }, 1000 * reconnectAttempt); // Exponential backoff
      };

      const cleanup = () => {
        if (connectionMonitor) {
          clearInterval(connectionMonitor);
          connectionMonitor = null;
        }
      };

      ws.onopen = () => {
        console.log("🔌 SFU WebSocket connected");
        reconnectAttempt = 0; // Reset reconnect attempts on successful connection
        
        // Send join message immediately
        const joinMessage = {
          event: "client_join",
          data: JSON.stringify(joinToken),
        };
        
        console.log("📤 Sending client_join message");
        try {
          ws.send(JSON.stringify(joinMessage));
        } catch (error) {
          console.error("❌ Error sending join message:", error);
          if (!isResolved) {
            clearTimeout(timeout);
            isResolved = true;
            reject(new Error("Failed to send join message"));
          }
        }
      };

      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          console.log("📨 SFU message:", message.event);

          switch (message.event) {
            case "room_joined":
              if (!isResolved) {
                clearTimeout(timeout);
                isResolved = true;
                console.log("✅ Successfully joined SFU room");
                // Start monitoring connection health
                startConnectionMonitor();
                resolve(ws);
              }
              break;

            case "room_error":
              if (!isResolved) {
                clearTimeout(timeout);
                isResolved = true;
                reject(new Error(`SFU room error: ${message.data}`));
              }
              break;

            case "offer":
              // Prevent concurrent offer processing
              if (offerProcessingInProgress) {
                console.warn("⚠️ Offer processing already in progress, skipping");
                break;
              }
              
              const offer = JSON.parse(message.data);
              if (peerConnectionRef.current && peerConnectionRef.current.connectionState !== 'closed') {
                offerProcessingInProgress = true;
                console.log("📨 Processing SFU offer, signaling state:", peerConnectionRef.current.signalingState);
                
                // Check if we're in a valid state to process the offer
                if (peerConnectionRef.current.signalingState !== 'stable' && 
                    peerConnectionRef.current.signalingState !== 'have-remote-offer') {
                  console.warn("⚠️ Invalid signaling state for offer:", peerConnectionRef.current.signalingState);
                  offerProcessingInProgress = false;
                  break;
                }
                
                peerConnectionRef.current.setRemoteDescription(new RTCSessionDescription(offer))
                  .then(() => {
                    if (peerConnectionRef.current && peerConnectionRef.current.connectionState !== 'closed') {
                      console.log("✅ Set remote description, creating answer");
                      return peerConnectionRef.current.createAnswer({
                        offerToReceiveAudio: true,
                        offerToReceiveVideo: false,
                      });
                    }
                    throw new Error("Peer connection closed during offer processing");
                  })
                  .then((answer) => {
                    if (peerConnectionRef.current && peerConnectionRef.current.connectionState !== 'closed') {
                      console.log("✅ Created answer, setting local description");
                      return peerConnectionRef.current.setLocalDescription(answer);
                    }
                    throw new Error("Peer connection closed during answer creation");
                  })
                  .then(() => {
                    if (ws.readyState === WebSocket.OPEN && peerConnectionRef.current) {
                      const answer = peerConnectionRef.current.localDescription;
                      if (answer) {
                        ws.send(JSON.stringify({
                          event: "answer",
                          data: JSON.stringify(answer),
                        }));
                        console.log("📤 Sent answer to SFU, signaling state:", peerConnectionRef.current.signalingState);
                        
                        // Log WebSocket state after sending answer to debug 1006 closures
                        setTimeout(() => {
                          console.log("🔍 WebSocket state 1s after answer:", ws.readyState);
                          if (ws.readyState !== WebSocket.OPEN) {
                            console.warn("⚠️ WebSocket closed shortly after sending answer!");
                          }
                        }, 1000);
                        
                        setTimeout(() => {
                          console.log("🔍 WebSocket state 5s after answer:", ws.readyState);
                          if (ws.readyState !== WebSocket.OPEN) {
                            console.warn("⚠️ WebSocket closed within 5 seconds of sending answer!");
                          }
                        }, 5000);
                      } else {
                        throw new Error("No local description available");
                      }
                    }
                  })
                  .catch((error) => {
                    console.error("❌ Error processing offer:", error);
                  })
                  .finally(() => {
                    offerProcessingInProgress = false;
                  });
              } else {
                console.warn("⚠️ Cannot process offer - peer connection not available or closed");
              }
              break;

            case "candidate":
              const candidate = JSON.parse(message.data);
              if (peerConnectionRef.current && 
                  peerConnectionRef.current.connectionState !== 'closed' &&
                  peerConnectionRef.current.connectionState !== 'failed') {
                // Add candidate regardless of remote description state for better connectivity
                peerConnectionRef.current.addIceCandidate(new RTCIceCandidate(candidate))
                  .then(() => {
                    console.log("✅ Added ICE candidate:", candidate.type || 'unknown');
                  })
                  .catch((error) => {
                    // Don't log errors for candidates that can't be added during early negotiation
                    if (error.name !== 'InvalidStateError') {
                      console.error("❌ Error adding ICE candidate:", error);
                    } else {
                      console.log("⏳ ICE candidate queued (will be processed when ready)");
                    }
                  });
              } else {
                console.warn("⚠️ Cannot add ICE candidate - peer connection not available");
              }
              break;
          }
        } catch (error) {
          console.error("❌ Error handling SFU message:", error);
        }
      };

      ws.onclose = (event) => {
        console.log("🔌 SFU WebSocket closed:", event.code, event.reason);
        cleanup();
        
        // Enhanced logging for 1006 closures
        if (event.code === 1006) {
          console.warn("⚠️ SFU WebSocket closed abnormally - network connection interrupted");
          console.log("🔍 Connection details at close:");
          console.log("  - Peer connection state:", peerConnectionRef.current?.connectionState);
          console.log("  - ICE connection state:", peerConnectionRef.current?.iceConnectionState);
          console.log("  - Signaling state:", peerConnectionRef.current?.signalingState);
          console.log("  - Reconnect attempts:", reconnectAttempt);
          
          // If WebRTC is still healthy, this suggests a server-side issue
          if (peerConnectionRef.current?.connectionState === 'connected') {
            console.warn("🚨 WebRTC is healthy but SFU WebSocket closed - likely server-side timeout");
          }
        }
        
        if (!isResolved) {
          clearTimeout(timeout);
          isResolved = true;
          reject(new Error(`SFU WebSocket closed: ${event.code}`));
        }
      };

      ws.onerror = (error) => {
        console.error("❌ SFU WebSocket error:", error);
        cleanup();
        if (!isResolved) {
          clearTimeout(timeout);
          isResolved = true;
          reject(new Error("SFU WebSocket connection failed"));
        }
      };
    });
  }, []);

  // Enhanced connect function with better state management
  const connect = useCallback(async (channelID: string): Promise<void> => {
    try {
      // Validation
      if (!currentlyViewingServer) {
        throw new Error("No server selected");
      }

      if (!channelID) {
        throw new Error("Invalid channel ID");
      }

      if (!sfuHost || !stunHosts) {
        throw new Error("SFU configuration not available");
      }

      if (!microphoneBuffer.output) {
        throw new Error("Microphone not available");
      }

      // If already connected to the same room and server, just return success
      if (
        connectionState.state === ConnectionState.CONNECTED &&
        connectionState.roomId === channelID &&
        connectionState.serverId === currentlyViewingServer.host
      ) {
        console.log("✅ Already connected to this room");
        return;
      }

      // Check if already connecting to the same room
      if (connectionState.state === ConnectionState.CONNECTING && connectionState.roomId === channelID) {
        console.log("⏳ Already connecting to this room");
        return;
      }

      // Disconnect if connected to different room/server with proper cleanup
      if (isConnected && (connectionState.roomId !== channelID || connectionState.serverId !== currentlyViewingServer.host)) {
        console.log("🔄 Switching rooms, disconnecting first");
        await performCleanup(false);
        // Add delay to ensure cleanup completes
        await new Promise(resolve => setTimeout(resolve, 500));
      }

      const socket = sockets[currentlyViewingServer.host];
      if (!socket) {
        throw new Error("Socket connection not available");
      }

      setConnectionState({
        state: ConnectionState.REQUESTING_ACCESS,
        roomId: channelID,
        serverId: currentlyViewingServer.host,
        error: null,
      });

      // Step 1: Request room access
      const roomData = await requestRoomAccess(channelID, socket);

      setConnectionState(prev => ({ ...prev, state: ConnectionState.CONNECTING }));

      // Step 2: Setup WebRTC with enhanced configuration
      const peerConnection = setupPeerConnection(stunHosts);
      peerConnectionRef.current = peerConnection;

      // Set connection timeout
      connectionTimeoutRef.current = setTimeout(() => {
        if (connectionState.state === ConnectionState.CONNECTING) {
          console.error("❌ Connection timeout - WebRTC failed to establish");
          disconnect(false).catch(console.error);
        }
      }, 30000);

      // Step 3: Add local tracks
      const localStream = microphoneBuffer.output.mediaStream;
      const tracks: RTCRtpSender[] = [];
      
      localStream.getTracks().forEach((track) => {
        const sender = peerConnection.addTrack(track, localStream);
        tracks.push(sender);
        console.log("🎤 Added local track:", track.kind, track.id);
      });
      
      registeredTracksRef.current = tracks;

      // Step 4: Add local stream to state
      setStreams(prev => ({
        ...prev,
        [localStream.id]: { stream: localStream, isLocal: true },
      }));

      // Step 5: Connect to SFU with retry logic
      let sfuWebSocket: WebSocket;
      try {
        sfuWebSocket = await setupSFUWebSocket(roomData.sfu_url, roomData.join_token);
        sfuWebSocketRef.current = sfuWebSocket;
      } catch (error) {
        console.error("❌ SFU WebSocket connection failed:", error);
        throw new Error("Failed to connect to SFU server");
      }

      // Step 6: Update server socket state
      socket.emit("streamID", localStream.id);
      socket.emit("joinedChannel", true);

      setConnectionState({
        state: ConnectionState.CONNECTED,
        roomId: channelID,
        serverId: currentlyViewingServer.host,
        error: null,
      });

      // Play connect sound if enabled
      if (connectSoundEnabled) {
        try {
          connectSound();
        } catch (error) {
          console.error("Error playing connect sound:", error);
        }
      }
      
      console.log("🎉 Successfully connected to SFU room:", channelID);

    } catch (error) {
      console.error("❌ SFU connection failed:", error);
      
      const errorMessage = error instanceof Error ? error.message : "Connection failed";
      
      // Cleanup on failure
      await performCleanup(false);
      
      // If voice service is temporarily unavailable, add delay before allowing retry
      if (errorMessage.includes("Voice service temporarily unavailable")) {
        console.log("⏳ Voice service unavailable, waiting 10 seconds before allowing retry");
        
        setConnectionState({
          state: ConnectionState.FAILED,
          roomId: null,
          serverId: null,
          error: "Voice service temporarily unavailable - please wait a moment and try again",
        });

        // Set a timeout to allow retry after 10 seconds
        reconnectAttemptRef.current = setTimeout(() => {
          setConnectionState(prev => ({
            ...prev,
            error: null,
          }));
        }, 10000);
      } else {
        setConnectionState({
          state: ConnectionState.FAILED,
          roomId: null,
          serverId: null,
          error: errorMessage,
        });
      }

      throw error;
    }
  }, [
    currentlyViewingServer,
    sfuHost,
    stunHosts,
    microphoneBuffer.output,
    connectionState,
    isConnected,
    sockets,
    requestRoomAccess,
    setupPeerConnection,
    setupSFUWebSocket,
    connectSound,
    connectSoundEnabled,
    performCleanup,
  ]);

  // Enhanced disconnect function
  const disconnect = useCallback(async (playSound?: boolean): Promise<void> => {
    try {
      console.log("🚪 Disconnecting from SFU");
      
      const shouldPlaySound = playSound !== false && disconnectSoundEnabled; // Respect settings

      // Perform comprehensive cleanup
      await performCleanup(false);

      setConnectionState({
        state: ConnectionState.DISCONNECTED,
        roomId: null,
        serverId: null,
        error: null,
      });

      if (shouldPlaySound) {
        try {
          disconnectSound();
        } catch (error) {
          console.error("Error playing disconnect sound:", error);
        }
      }

      console.log("✅ Successfully disconnected from SFU");

    } catch (error) {
      console.error("❌ Error during SFU disconnect:", error);
      // Reset state even if disconnect fails
      setConnectionState({
        state: ConnectionState.DISCONNECTED,
        roomId: null,
        serverId: null,
        error: null,
      });
      // Also clear stream sources on error
      setStreamSources({});
    }
  }, [performCleanup, disconnectSound, disconnectSoundEnabled]);

  return {
    streams,
    error: connectionState.error,
    streamSources,
    connect,
    disconnect,
    currentServerConnected: connectionState.serverId || "",
    isConnected,
    currentChannelConnected: connectionState.roomId || "",
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

const SFUHook = singletonHook(init, useSfuHook);

export const useSFU = () => {
  return SFUHook();
};
