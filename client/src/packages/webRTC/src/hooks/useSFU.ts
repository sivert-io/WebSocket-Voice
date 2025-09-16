import { useCallback,useEffect, useMemo, useRef, useState } from "react";
import toast from "react-hot-toast";
import { singletonHook } from "react-singleton-hook";
import { Socket } from "socket.io-client";
import useSound from "use-sound";

import { useMicrophone, useSpeakers } from "@/audio";
import connectMp3 from "@/audio/src/assets/connect.mp3";
import disconnectMp3 from "@/audio/src/assets/disconnect.mp3";
import { useSettings } from "@/settings";
import { useSockets, useServerManagement } from "@/socket";
import { handleRateLimitError } from "@/socket/src/utils/rateLimitHandler";

import { SFUConnectionState,SFUInterface, Streams, StreamSources } from "../types/SFU";

// Connection states for better state management
// enum ConnectionState {
//   DISCONNECTED = 'disconnected',
//   REQUESTING_ACCESS = 'requesting_access',
//   CONNECTING = 'connecting',
//   CONNECTED = 'connected',
//   FAILED = 'failed',
// }

interface SFUConnectionStateInternal {
  state: SFUConnectionState;
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
  const isConnectingRef = useRef<boolean>(false);

  // State management
  const [connectionState, setConnectionState] = useState<SFUConnectionStateInternal>({
    state: SFUConnectionState.DISCONNECTED,
    roomId: null,
    serverId: null,
    error: null,
  });

  const [streams, setStreams] = useState<Streams>({});
  const [streamSources, setStreamSources] = useState<StreamSources>({});

  // Enhanced logging for state changes
  useEffect(() => {
    console.log("🔗 SFU CONNECTION STATE CHANGE:", {
      state: connectionState.state,
      roomId: connectionState.roomId,
      serverId: connectionState.serverId,
      error: connectionState.error,
      timestamp: Date.now(),
      isConnected: connectionState.state === SFUConnectionState.CONNECTED,
      isConnecting: connectionState.state === SFUConnectionState.CONNECTING || connectionState.state === SFUConnectionState.REQUESTING_ACCESS,
    });
  }, [connectionState]);

  useEffect(() => {
    console.log("📺 STREAMS STATE CHANGE:", {
      totalStreams: Object.keys(streams).length,
      localStreams: Object.entries(streams).filter(([_, stream]) => stream.isLocal).length,
      remoteStreams: Object.entries(streams).filter(([_, stream]) => !stream.isLocal).length,
      streamIds: Object.keys(streams),
      streamDetails: Object.entries(streams).map(([id, stream]) => ({
        id,
        isLocal: stream.isLocal,
        hasAudioTracks: stream.stream.getAudioTracks().length,
        trackIds: stream.stream.getTracks().map(t => t.id)
      })),
      timestamp: Date.now()
    });
  }, [streams]);

  // Dependencies
  const { 
    outputVolume,
    connectSoundEnabled,
    disconnectSoundEnabled,
    connectSoundVolume,
    disconnectSoundVolume,
    customConnectSoundFile,
    customDisconnectSoundFile,
    isDeafened,
    micID,
  } = useSettings();
  
  const { 
    currentlyViewingServer, 
    servers,
  } = useServerManagement();
  
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
    return connectionState.state === SFUConnectionState.CONNECTED &&
           !!sfuWebSocketRef.current &&
           !!peerConnectionRef.current;
  }, [connectionState.state]);

  const isConnecting = useMemo(() => {
    return connectionState.state === SFUConnectionState.CONNECTING ||
           connectionState.state === SFUConnectionState.REQUESTING_ACCESS;
  }, [connectionState.state]);

  // Access shared microphone buffer without creating our own handle
  // ServerView manages the microphone access, we just use the shared singleton buffer
  const { microphoneBuffer } = useMicrophone(false);
  // Use a ref to always read the freshest microphone buffer inside async flows
  const microphoneBufferRef = useRef(microphoneBuffer);
  useEffect(() => {
    microphoneBufferRef.current = microphoneBuffer;
  }, [microphoneBuffer]);
  const { mediaDestination, audioContext } = useSpeakers();

  // Enhanced cleanup function
  const performCleanup = useCallback(async (skipServerUpdate = false) => {
    console.log("🧹 Performing SFU cleanup");
    
    // Prevent multiple cleanup attempts
    if (isDisconnectingRef.current) {
      console.log("🧹 Cleanup already in progress, skipping");
      return;
    }
    
    isDisconnectingRef.current = true;

    // If connecting is in progress, cancel it gracefully
    if (isConnectingRef.current) {
      console.log("🧹 Canceling connection in progress");
      isConnectingRef.current = false;
    }

    // Clear all timeouts first
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

    // Enhanced track removal with better error handling
    const tracksToRemove = [...registeredTracksRef.current];
    registeredTracksRef.current = [];
    
    for (const sender of tracksToRemove) {
      try {
        if (peerConnectionRef.current && sender.track) {
          // Don't stop local tracks - they're managed by the microphone hook
          // Just remove them from the peer connection
          peerConnectionRef.current.removeTrack(sender);
        }
      } catch (error) {
        console.error("❌ Error removing track:", error);
      }
    }

    // Enhanced peer connection cleanup
    if (peerConnectionRef.current) {
      try {
        // Remove all event listeners to prevent memory leaks
        peerConnectionRef.current.onicecandidate = null;
        peerConnectionRef.current.oniceconnectionstatechange = null;
        peerConnectionRef.current.onicegatheringstatechange = null;
        peerConnectionRef.current.onsignalingstatechange = null;
        peerConnectionRef.current.ontrack = null;
        peerConnectionRef.current.onconnectionstatechange = null;
        peerConnectionRef.current.ondatachannel = null;
        
        // Close peer connection if not already closed
        if (peerConnectionRef.current.connectionState !== 'closed') {
          peerConnectionRef.current.close();
        }
        peerConnectionRef.current = null;
      } catch (error) {
        console.error("❌ Error closing peer connection:", error);
        peerConnectionRef.current = null;
      }
    }

    // Enhanced WebSocket cleanup with proper close codes and event handler removal
    if (sfuWebSocketRef.current) {
      try {
        // Store reference to current WebSocket for cleanup
        const wsToClean = sfuWebSocketRef.current;
        
        // Clear the reference immediately to prevent new operations
        sfuWebSocketRef.current = null;
        
        // Remove all event listeners to prevent memory leaks and unwanted callbacks
        wsToClean.onopen = null;
        wsToClean.onmessage = null;
        wsToClean.onclose = null;
        wsToClean.onerror = null;
        
        // Close with proper code if still open
        if (wsToClean.readyState === WebSocket.OPEN || 
            wsToClean.readyState === WebSocket.CONNECTING) {
          wsToClean.close(1000, "Client disconnecting gracefully");
        }
        
        console.log("🧹 WebSocket cleaned up and closed");
      } catch (error) {
        console.error("❌ Error closing SFU WebSocket:", error);
        // Ensure reference is cleared even if cleanup fails
        sfuWebSocketRef.current = null;
      }
    }

    // Update server state with proper error handling (non-blocking)
    if (!skipServerUpdate && connectionState.serverId && sockets[connectionState.serverId]) {
      try {
        const socket = sockets[connectionState.serverId];
        // Send disconnect signals in proper sequence to prevent race conditions
        socket.emit("joinedChannel", false);
        // Wait briefly to ensure joinedChannel is processed before streamID
        await new Promise(resolve => setTimeout(resolve, 10));
        socket.emit("streamID", "");
        socket.emit("leaveRoom"); // Explicit leave room signal
      } catch (error) {
        console.error("❌ Error updating server state:", error);
      }
    }

    // Enhanced audio processing cleanup
    setStreamSources(prev => {
      Object.values(prev).forEach(({ gain, analyser, stream }) => {
        try {
          // Disconnect in reverse order of connection
          if (gain) gain.disconnect();
          if (analyser) analyser.disconnect();
          if (stream) stream.disconnect();
        } catch (error) {
          console.error("❌ Error disconnecting audio nodes:", error);
        }
      });
      return {};
    });

    // Clear streams with better separation
    setStreams(prev => {
      const localStreams: Streams = {};
      Object.entries(prev).forEach(([id, stream]) => {
        if (stream.isLocal) {
          localStreams[id] = stream;
        } else {
          // Stop remote stream tracks to free resources
          try {
            stream.stream.getTracks().forEach(track => {
              if (track.readyState !== 'ended') {
                track.stop();
              }
            });
          } catch (error) {
            console.error("❌ Error stopping remote stream tracks:", error);
          }
        }
      });
      return localStreams;
    });

    // Minimal delay for cleanup completion
    await new Promise(resolve => setTimeout(resolve, 50));
    
    isDisconnectingRef.current = false;
    console.log("🧹 SFU cleanup completed");
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

    // Handle peer changes (no sounds - sounds are only for your own connection)
    if (newPeers.length > 0) {
      // Emit voice connection status to server for each new peer
      if (connectionState.serverId && sockets[connectionState.serverId]) {
        const socket = sockets[connectionState.serverId];
        newPeers.forEach(streamId => {
          socket.emit("peerVoiceConnected", streamId);
        });
      }
    }

    if (disconnectedPeers.length > 0) {
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

        } catch (error) {
          console.error("❌ Error cleaning up stream:", id, error);
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

        // Apply global output volume (same scaling as microphone: 50% = 1.0 gain)
        // When deafened, mute all incoming audio
        const baseOutputGain = outputVolume / 50; // 50% = 1.0, 100% = 2.0
        const outputGain = isDeafened ? 0 : baseOutputGain;
        gainNode.gain.value = outputGain;

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
      } catch (error) {
        console.error("❌ Failed to setup audio processing for stream:", streamID, error);
      }
    });

    // Only update state if there are actual changes
    if (hasChanges) {
      setStreamSources(newStreamSources);
    }
  }, [streams, audioContext, mediaDestination, outputVolume, isDeafened]);

  // Update output volume for all streams when setting changes
  useEffect(() => {
    const baseOutputGain = outputVolume / 50; // 50% = 1.0, 100% = 2.0
    const outputGain = isDeafened ? 0 : baseOutputGain;
    
    Object.values(streamSources).forEach(({ gain }) => {
      if (gain) {
        gain.gain.setValueAtTime(outputGain, audioContext?.currentTime || 0);
      }
    });
  }, [outputVolume, isDeafened, streamSources, audioContext]);

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

  // Cleanup effect for component unmount and server changes
  useEffect(() => {
    return () => {
      console.log("🧹 SFU hook cleanup on unmount/change");
      
      // Immediate cleanup of all connections
      if (sfuWebSocketRef.current) {
        const ws = sfuWebSocketRef.current;
        sfuWebSocketRef.current = null;
        
        try {
          ws.onopen = null;
          ws.onmessage = null;
          ws.onclose = null;
          ws.onerror = null;
          
          if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
            ws.close(1000, "Component cleanup");
          }
        } catch (error) {
          console.error("❌ Error cleaning up WebSocket on unmount:", error);
        }
      }
      
      if (peerConnectionRef.current) {
        const pc = peerConnectionRef.current;
        peerConnectionRef.current = null;
        
        try {
          pc.onicecandidate = null;
          pc.oniceconnectionstatechange = null;
          pc.onicegatheringstatechange = null;
          pc.onsignalingstatechange = null;
          pc.ontrack = null;
          pc.onconnectionstatechange = null;
          pc.ondatachannel = null;
          
          if (pc.connectionState !== 'closed') {
            pc.close();
          }
        } catch (error) {
          console.error("❌ Error cleaning up peer connection on unmount:", error);
        }
      }
      
      // Clear all timeouts
      if (reconnectAttemptRef.current) {
        clearTimeout(reconnectAttemptRef.current);
        reconnectAttemptRef.current = null;
      }
      
      if (connectionTimeoutRef.current) {
        clearTimeout(connectionTimeoutRef.current);
        connectionTimeoutRef.current = null;
      }
      
      // Clear registered tracks
      registeredTracksRef.current = [];
      
      // Clear peer tracking
      previousRemoteStreamsRef.current.clear();
    };
  }, []);

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

      const onRoomError = (error: string | { error: string; message?: string; retryAfterMs?: number; currentScore?: number; maxScore?: number }) => {
        cleanup();
        console.error("❌ Room access denied:", error);
        
        // Handle rate limiting with user-friendly message
        if (typeof error === 'object' && error.error === 'rate_limited' && error.message) {
          handleRateLimitError(error, "Voice connection");
          reject(new Error(error.message));
          return;
        }
        
        const errorMessage = typeof error === 'string' ? error : error.error || 'Unknown error';
        reject(new Error(`Room access denied: ${errorMessage}`));
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
        } catch (error) {
          console.error("❌ Error sending ICE candidate:", error);
        }
      }
    };

    // Enhanced ICE connection state monitoring
    pc.oniceconnectionstatechange = () => {
      switch (pc.iceConnectionState) {
        case 'failed':
          console.error("❌ ICE connection failed - may need TURN server");
          break;
        case 'disconnected':
          console.warn("⚠️ ICE connection disconnected - attempting to reconnect");
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
      const remoteStream = event.streams[0];
      
      if (remoteStream) {
        setStreams(prev => ({
          ...prev,
          [remoteStream.id]: { stream: remoteStream, isLocal: false },
        }));
      } else {
        console.warn("⚠️ Received ontrack event but no remote stream");
      }
    };

    pc.onconnectionstatechange = () => {
      switch (pc.connectionState) {
        case 'connected':
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
          console.error("❌ WebRTC peer connection failed/closed");
          if (!isDisconnectingRef.current) {
            setConnectionState(prev => ({ 
              ...prev, 
              state: SFUConnectionState.FAILED, 
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

  // Setup SFU WebSocket connection with enhanced error handling and monitoring
  const setupSFUWebSocket = useCallback(async (sfuUrl: string, joinToken: any): Promise<WebSocket> => {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(sfuUrl);
      let isResolved = false;
      let offerProcessingInProgress = false;
      let connectionMonitor: NodeJS.Timeout | null = null;
      let reconnectAttempt = 0;
      const maxReconnectAttempts = 3;
      
      // Store connection ID to prevent operations on old connections
      const connectionId = Date.now() + Math.random();
      console.log("🔌 Creating SFU WebSocket connection:", connectionId);

      const timeout = setTimeout(() => {
        if (!isResolved) {
          cleanup();
          ws.close();
          reject(new Error("SFU WebSocket connection timeout"));
        }
      }, 15000); // Increased timeout

      // Enhanced cleanup function that stops all monitoring and reconnection
      const cleanup = () => {
        console.log("🧹 Cleaning up SFU WebSocket connection:", connectionId);
        
        if (connectionMonitor) {
          clearInterval(connectionMonitor);
          connectionMonitor = null;
        }
        
        // Reset reconnect attempts to prevent further attempts
        reconnectAttempt = maxReconnectAttempts;
        
        // Remove event listeners to prevent callbacks on old connections
        try {
          ws.onopen = null;
          ws.onmessage = null;
          ws.onclose = null;
          ws.onerror = null;
        } catch (error) {
          console.error("❌ Error removing WebSocket event listeners:", error);
        }
      };

      // Monitor connection health and attempt recovery
      const startConnectionMonitor = () => {
        connectionMonitor = setInterval(() => {
          // Only stop monitoring if we're disconnecting or the WebSocket is clearly old
          if (isDisconnectingRef.current) {
            console.log("🔄 Connection monitor stopping - disconnecting:", connectionId);
            cleanup();
            return;
          }
          
          // Check if this WebSocket is still the current one (but only after it should be set)
          if (isResolved && sfuWebSocketRef.current && sfuWebSocketRef.current !== ws) {
            console.log("🔄 Connection monitor stopping - not active connection:", connectionId);
            cleanup();
            return;
          }
          
          if (ws.readyState !== WebSocket.OPEN) {
            console.warn("⚠️ SFU WebSocket connection lost:", connectionId);
            cleanup();
            
            // Only attempt to recover if this is still the active connection and we haven't exceeded attempts
            if ((!sfuWebSocketRef.current || sfuWebSocketRef.current === ws) && 
                peerConnectionRef.current && 
                peerConnectionRef.current.connectionState === 'connected' &&
                reconnectAttempt < maxReconnectAttempts &&
                !isDisconnectingRef.current) {
              attemptReconnection();
            }
          } else {
            // Send keep-alive message to prevent network timeouts
            try {
              ws.send(JSON.stringify({
                event: "keep_alive",
                data: JSON.stringify({ timestamp: Date.now() }),
              }));
            } catch (error) {
              console.warn("⚠️ Failed to send keep-alive:", error);
            }
          }
        }, 15000); // Check every 15 seconds
      };

      const attemptReconnection = () => {
        // Double-check we should still be reconnecting
        if (isDisconnectingRef.current) {
          console.log("🔄 Skipping reconnection - disconnecting:", connectionId);
          return;
        }
        
        // Only check WebSocket reference if it should be set and is different
        if (sfuWebSocketRef.current && sfuWebSocketRef.current !== ws) {
          console.log("🔄 Skipping reconnection - connection no longer active:", connectionId);
          return;
        }
        
        reconnectAttempt++;
        console.log(`🔄 SFU reconnection attempt ${reconnectAttempt}/${maxReconnectAttempts} for connection:`, connectionId);
        
        setTimeout(() => {
          // Final check before attempting reconnection
          if ((!sfuWebSocketRef.current || sfuWebSocketRef.current === ws) && 
              peerConnectionRef.current && 
              peerConnectionRef.current.connectionState === 'connected' &&
              !isDisconnectingRef.current) {
            // Note: This would require a more complex reconnection strategy
            // For now, we'll just log and let the existing reconnection handle it
            console.log("🔄 Would attempt WebSocket reconnection, but letting existing logic handle it");
          } else {
            console.log("🔄 Skipping reconnection - conditions no longer met:", connectionId);
          }
        }, 1000 * reconnectAttempt); // Exponential backoff
      };

      ws.onopen = () => {
        // Check if this connection is still wanted
        if (isDisconnectingRef.current) {
          console.log("🔄 Connection opened but disconnecting in progress, closing:", connectionId);
          cleanup();
          ws.close();
          return;
        }
        
        reconnectAttempt = 0; // Reset reconnect attempts on successful connection
        console.log("✅ SFU WebSocket opened:", connectionId);
        
        // Send join message immediately
        const joinMessage = {
          event: "client_join",
          data: JSON.stringify(joinToken),
        };
        
        try {
          ws.send(JSON.stringify(joinMessage));
        } catch (error) {
          console.error("❌ Error sending join message:", error);
          if (!isResolved) {
            clearTimeout(timeout);
            isResolved = true;
            cleanup();
            reject(new Error("Failed to send join message"));
          }
        }
      };

      ws.onmessage = (event) => {
        // Only ignore messages if we're disconnecting or if this is clearly an old connection
        // Don't check sfuWebSocketRef.current here as it might not be set yet during initial connection
        if (isDisconnectingRef.current) {
          console.log("🔄 Ignoring message - disconnecting in progress:", connectionId);
          return;
        }
        
        try {
          const message = JSON.parse(event.data);

          switch (message.event) {
            case "room_joined":
              if (!isResolved) {
                clearTimeout(timeout);
                isResolved = true;
                console.log("✅ Successfully joined SFU room:", connectionId);
                // Start monitoring connection health
                startConnectionMonitor();
                resolve(ws);
              }
              break;

            case "room_error":
              if (!isResolved) {
                clearTimeout(timeout);
                isResolved = true;
                cleanup();
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
                      return peerConnectionRef.current.createAnswer({
                        offerToReceiveAudio: true,
                        offerToReceiveVideo: false,
                      });
                    }
                    throw new Error("Peer connection closed during offer processing");
                  })
                  .then((answer) => {
                    if (peerConnectionRef.current && peerConnectionRef.current.connectionState !== 'closed') {
                      return peerConnectionRef.current.setLocalDescription(answer);
                    }
                    throw new Error("Peer connection closed during answer creation");
                  })
                  .then(() => {
                    // Check if this WebSocket is still open and we're not disconnecting
                    if (ws.readyState === WebSocket.OPEN && 
                        peerConnectionRef.current && 
                        !isDisconnectingRef.current) {
                      const answer = peerConnectionRef.current.localDescription;
                      if (answer) {
                        ws.send(JSON.stringify({
                          event: "answer",
                          data: JSON.stringify(answer),
                        }));
                      } else {
                        throw new Error("No local description available");
                      }
                    } else {
                      console.log("🔄 Skipping answer send - WebSocket no longer active or disconnecting:", connectionId);
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
                  .catch((error) => {
                    // Don't log errors for candidates that can't be added during early negotiation
                    if (error.name !== 'InvalidStateError') {
                      console.error("❌ Error adding ICE candidate:", error);
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
        console.log("🔌 SFU WebSocket closed:", connectionId, event.code, event.reason);
        cleanup();
        
        // Enhanced logging for 1006 closures
        if (event.code === 1006) {
          console.warn("⚠️ SFU WebSocket closed abnormally - network connection interrupted:", connectionId);
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
        console.error("❌ SFU WebSocket error:", connectionId, error);
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
      // Prevent multiple simultaneous connection attempts
      if (isConnectingRef.current) {
        console.warn("⚠️ Connection already in progress, ignoring duplicate request");
        return;
      }

      // If cleanup is happening in background, wait briefly but don't block too long
      if (isDisconnectingRef.current) {
        console.log("🔄 Background cleanup in progress, waiting briefly...");
        // Wait a short time for cleanup, but don't block indefinitely
        for (let i = 0; i < 5; i++) { // Max 500ms wait
          if (!isDisconnectingRef.current) break;
          await new Promise(resolve => setTimeout(resolve, 100));
        }
        // Continue even if cleanup is still running - it won't interfere
      }

      isConnectingRef.current = true;

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

      // If already connected to the same room and server, just return success
      if (
        connectionState.state === SFUConnectionState.CONNECTED &&
        connectionState.roomId === channelID &&
        connectionState.serverId === currentlyViewingServer.host
      ) {
        console.log("✅ Already connected to the same room, skipping connection");
        return;
      }

      // Check if already connecting to the same room
      if (connectionState.state === SFUConnectionState.CONNECTING && connectionState.roomId === channelID) {
        console.log("⏳ Already connecting to the same room, waiting...");
        return;
      }

      // For room switching, perform quick cleanup without waiting
      if (isConnected && (connectionState.roomId !== channelID || connectionState.serverId !== currentlyViewingServer.host)) {
        console.log("🔄 Switching rooms, performing immediate cleanup");
        
        // CRITICAL: Notify the OLD server that we're leaving BEFORE cleanup
        if (connectionState.serverId && sockets[connectionState.serverId]) {
          try {
            const oldSocket = sockets[connectionState.serverId];
            console.log("📤 Notifying old server about leaving:", connectionState.serverId);
            // Send disconnect signals to old server in proper sequence
            oldSocket.emit("joinedChannel", false);
            // Brief pause to ensure proper processing order
            await new Promise(resolve => setTimeout(resolve, 10));
            oldSocket.emit("streamID", "");
            oldSocket.emit("leaveRoom"); // Explicit leave room signal
          } catch (error) {
            console.error("❌ Error notifying old server:", error);
          }
        }
        
        // IMMEDIATE: Clear the old WebSocket reference to stop all operations
        if (sfuWebSocketRef.current) {
          const oldWs = sfuWebSocketRef.current;
          sfuWebSocketRef.current = null; // Clear reference immediately
          
          // Clean up old WebSocket without waiting
          try {
            oldWs.onopen = null;
            oldWs.onmessage = null;
            oldWs.onclose = null;
            oldWs.onerror = null;
            
            if (oldWs.readyState === WebSocket.OPEN || oldWs.readyState === WebSocket.CONNECTING) {
              oldWs.close(1000, "Switching rooms");
            }
          } catch (error) {
            console.error("❌ Error cleaning up old WebSocket:", error);
          }
        }
        
        // IMMEDIATE: Clear old peer connection reference
        if (peerConnectionRef.current) {
          const oldPc = peerConnectionRef.current;
          peerConnectionRef.current = null; // Clear reference immediately
          
          // Clean up old peer connection without waiting
          try {
            oldPc.onicecandidate = null;
            oldPc.oniceconnectionstatechange = null;
            oldPc.onicegatheringstatechange = null;
            oldPc.onsignalingstatechange = null;
            oldPc.ontrack = null;
            oldPc.onconnectionstatechange = null;
            oldPc.ondatachannel = null;
            
            if (oldPc.connectionState !== 'closed') {
              oldPc.close();
            }
          } catch (error) {
            console.error("❌ Error cleaning up old peer connection:", error);
          }
        }
        
        // Clear registered tracks
        registeredTracksRef.current = [];
        
        // Brief pause to let immediate cleanup complete
        await new Promise(resolve => setTimeout(resolve, 50));
      }

      // STEP 1: Set connecting state early to prevent UI issues
      setConnectionState({
        state: SFUConnectionState.CONNECTING,
        roomId: channelID, // Temporary - will be updated with unique room ID from server
        serverId: currentlyViewingServer.host,
        error: null,
      });

      // Enhanced microphone availability check with better retry logic
      // If no mic selected yet, request devices and auto-select before waiting
      let streamToUse = microphoneBufferRef.current.processedStream || microphoneBufferRef.current.mediaStream;
      
      // Check if we have a stream and if its tracks are actually live
      if (streamToUse) {
        const audioTracks = streamToUse.getAudioTracks();
        const hasLiveTracks = audioTracks.length > 0 && audioTracks.some(track => track.readyState === 'live');
        
        if (!hasLiveTracks) {
          console.warn("🔄 Stream exists but has no live tracks, waiting for reinitialization...");
          streamToUse = undefined; // Force reinitialization
        }
      }
      
      if (!streamToUse) {
        console.warn("🔄 Waiting for microphone initialization...");
        console.log("🎤 Microphone buffer state:", {
          hasProcessedStream: !!microphoneBufferRef.current.processedStream,
          hasMediaStream: !!microphoneBufferRef.current.mediaStream,
          micID: micID
        });
        
        // Wait for microphone to be ready with shorter intervals
        for (let attempt = 0; attempt < 30; attempt++) { // Increased attempts
          await new Promise(resolve => setTimeout(resolve, 200)); // Longer intervals for better reliability
          streamToUse = microphoneBufferRef.current.processedStream || microphoneBufferRef.current.mediaStream;
          
          if (streamToUse) {
            // Double-check that tracks are live
            const audioTracks = streamToUse.getAudioTracks();
            const hasLiveTracks = audioTracks.length > 0 && audioTracks.some(track => track.readyState === 'live');
            
            if (hasLiveTracks) {
              console.log("✅ Microphone ready after", (attempt + 1) * 200, "ms");
              break;
            } else {
              console.log("⏳ Stream found but tracks not live yet, attempt", attempt + 1, "of 30");
              streamToUse = undefined; // Keep waiting
            }
          } else {
            console.log("⏳ No stream yet, attempt", attempt + 1, "of 30");
          }
        }
        
        if (!streamToUse) {
          console.error("❌ Microphone initialization failed after 30 attempts");
          console.error("🎤 Final microphone buffer state:", {
            hasProcessedStream: !!microphoneBufferRef.current.processedStream,
            hasMediaStream: !!microphoneBufferRef.current.mediaStream,
            micID: micID
          });
          throw new Error("Microphone not available - please check microphone settings");
        }
      }

      // Check if the stream has active audio tracks
      const audioTracks = streamToUse.getAudioTracks();

      if (audioTracks.length === 0 || !audioTracks.some(track => track.readyState === 'live')) {
        console.error("❌ Stream has no active audio tracks");
        
        // Give audio tracks time to become live with shorter intervals
        console.warn("🔄 Waiting for audio tracks to become active...");
        for (let attempt = 0; attempt < 10; attempt++) {
          await new Promise(resolve => setTimeout(resolve, 150));
          const currentTracks = streamToUse.getAudioTracks();
          
          if (currentTracks.length > 0 && currentTracks.some(track => track.readyState === 'live')) {
            console.log("✅ Audio tracks ready after", (attempt + 1) * 150, "ms");
            break;
          }
        }
        
        // Final check
        const finalTracks = streamToUse.getAudioTracks();
        if (finalTracks.length === 0 || !finalTracks.some(track => track.readyState === 'live')) {
          throw new Error("Microphone not ready - please wait a moment and try again");
        }
      }

      const socket = sockets[currentlyViewingServer.host];
      if (!socket) {
        throw new Error("Socket connection not available");
      }

      // Step 2: Request room access
      const roomData = await requestRoomAccess(channelID, socket);

      // Step 3: Setup WebRTC with enhanced configuration
      const peerConnection = setupPeerConnection(stunHosts);
      peerConnectionRef.current = peerConnection;

      // Set connection timeout with shorter duration
      connectionTimeoutRef.current = setTimeout(() => {
        if (connectionState.state === SFUConnectionState.CONNECTING) {
          console.error("❌ Connection timeout - WebRTC failed to establish");
          toast.error("Connection timed out. Please try again.");
          disconnect(false).catch(console.error);
        }
      }, 20000); // Reduced from 30s to 20s

      // Step 4: Add local tracks (using processed stream with mute/noise suppression)
      const localStream = streamToUse;
      const tracks: RTCRtpSender[] = [];
      
      localStream.getTracks().forEach((track) => {
        const sender = peerConnection.addTrack(track, localStream);
        tracks.push(sender);
      });
      
      registeredTracksRef.current = tracks;

      // Step 5: Replace any existing local streams with the current local stream
      setStreams(prev => {
        const nonLocalEntries = Object.entries(prev).filter(([, s]) => !s.isLocal);
        const nonLocal = Object.fromEntries(nonLocalEntries);
        return {
          ...nonLocal,
          [localStream.id]: { stream: localStream, isLocal: true },
        };
      });

      // Step 6: Connect to SFU with retry logic
      let sfuWebSocket: WebSocket;
      try {
        sfuWebSocket = await setupSFUWebSocket(roomData.sfu_url, roomData.join_token);
        sfuWebSocketRef.current = sfuWebSocket;
      } catch (error) {
        console.error("❌ SFU WebSocket connection failed:", error);
        throw new Error("Failed to connect to SFU server");
      }

      // Step 7: Update server socket state (consolidated to prevent race conditions)
      socket.emit("streamID", localStream.id);
      // Wait briefly to ensure streamID is processed before joinedChannel
      await new Promise(resolve => setTimeout(resolve, 10));
      socket.emit("joinedChannel", true);

      setConnectionState({
        state: SFUConnectionState.CONNECTED,
        roomId: roomData.room_id,
        serverId: currentlyViewingServer.host,
        error: null,
      });

      // Play connect sound if enabled
      if (connectSoundEnabled) {
        try {
          connectSound();
        } catch (error) {
          console.error("❌ Error playing connect sound:", error);
        }
      }
      
      console.log("✅ Successfully connected to SFU room:", roomData.room_id, "(original channel:", channelID, ")");

    } catch (error) {
      console.error("❌ SFU connection failed:", error);
      
      const errorMessage = error instanceof Error ? error.message : "Connection failed";
      toast.error(errorMessage || "Failed to connect to voice server");
      
      // Cleanup on failure (non-blocking)
      performCleanup(false).catch(console.error);
      
      // Set failed state with error
      setConnectionState({
        state: SFUConnectionState.FAILED,
        roomId: null,
        serverId: null,
        error: errorMessage,
      });

      throw error;
    } finally {
      isConnectingRef.current = false;
    }
  }, [
    currentlyViewingServer,
    sfuHost,
    stunHosts,
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

  // Enhanced disconnect function - optimistic with background cleanup
  const disconnect = useCallback(async (playSound?: boolean, onDisconnect?: () => void): Promise<void> => {
    const shouldPlaySound = playSound !== false && disconnectSoundEnabled; // Respect settings

    // IMMEDIATE: Update UI state optimistically for instant feedback
    setConnectionState({
      state: SFUConnectionState.DISCONNECTED,
      roomId: null,
      serverId: null,
      error: null,
    });

    // IMMEDIATE: Play disconnect sound if enabled (don't wait)
    if (shouldPlaySound) {
      try {
        disconnectSound();
      } catch (error) {
        console.error("❌ Error playing disconnect sound:", error);
      }
    }

    console.log("✅ Disconnected (UI updated immediately)");

    // Call the disconnect callback if provided (e.g., to switch to text channel)
    if (onDisconnect) {
      onDisconnect();
    }

    // BACKGROUND: Perform cleanup asynchronously without blocking
    performCleanup(false).catch((error) => {
      console.error("❌ Background cleanup error:", error);
      // Even if cleanup fails, we've already updated the UI
      // Clear stream sources as fallback
      setStreamSources({});
    });

    // Return immediately - don't wait for cleanup
  }, [disconnectSound, disconnectSoundEnabled, performCleanup]);

  // Listen for server-initiated disconnects (device switching)
  useEffect(() => {
    const handleServerDisconnect = (event: CustomEvent) => {
      const { host, reason } = event.detail;
      console.log(`🔄 Server initiated disconnect for ${host}, reason: ${reason}`);
      
      // Trigger disconnect without playing sound (since it's server-initiated)
      disconnect(false).catch(error => {
        console.error('❌ Error during server-initiated disconnect:', error);
      });
      
      // Also trigger text channel switch for server-initiated disconnects
      window.dispatchEvent(new CustomEvent('voice_disconnect_text_switch', {
        detail: { host, reason }
      }));
    };

    window.addEventListener('server_voice_disconnect', handleServerDisconnect as EventListener);
    
    return () => {
      window.removeEventListener('server_voice_disconnect', handleServerDisconnect as EventListener);
    };
  }, [disconnect]);

  // Monitor processedStream changes and update WebRTC tracks
  useEffect(() => {
    if (!isConnected || !peerConnectionRef.current || !registeredTracksRef.current) {
      return;
    }

    const newStream = microphoneBuffer.processedStream || microphoneBuffer.mediaStream;
    
    if (!newStream) {
      console.warn("⚠️ No stream available during connection");
      return;
    }

    // Check if the stream has changed by comparing stream IDs
    const currentLocalStreamEntry = Object.entries(streams).find(([, stream]) => stream.isLocal);
    const currentStreamId = currentLocalStreamEntry?.[1].stream.id;
    
    if (currentStreamId === newStream.id) {
      // Stream hasn't changed, no need to update
      return;
    }

    // Also check if we actually have audio tracks that are different
    const currentTracks = currentLocalStreamEntry?.[1].stream.getAudioTracks() || [];
    const newTracks = newStream.getAudioTracks();
    
    // Compare track IDs to see if they're actually different
    const tracksChanged = currentTracks.length !== newTracks.length || 
                         currentTracks.some((track, index) => track.id !== newTracks[index]?.id);
    
    if (!tracksChanged) {
      console.log("🔄 Stream ID changed but tracks are the same, skipping update");
      return;
    }

    console.log("🔄 Processed stream changed during connection, updating WebRTC tracks...");
    console.log("🔄 Old stream ID:", currentStreamId, "New stream ID:", newStream.id);
    console.log("🔄 Track IDs changed:", currentTracks.map(t => t.id), "->", newTracks.map(t => t.id));

    if (newTracks.length === 0) {
      console.warn("⚠️ New stream has no audio tracks");
      return;
    }

    // Replace tracks in peer connection (using registeredTracksRef.current directly)
    const registeredTracks = registeredTracksRef.current;

    try {
      // Remove old tracks and add new ones
      const updatePromises = registeredTracks.map(async (sender, index) => {
        const newTrack = newTracks[index];
        if (newTrack && sender.track) {
          await sender.replaceTrack(newTrack);
          console.log(`✅ Replaced WebRTC track ${index}: ${sender.track.id} -> ${newTrack.id}`);
        }
      });

      Promise.all(updatePromises).then(() => {
        // Replace local stream in state (remove all existing locals, keep non-locals)
        setStreams(prev => {
          const nonLocalEntries = Object.entries(prev).filter(([, s]) => !s.isLocal);
          const nonLocal = Object.fromEntries(nonLocalEntries);
          return {
            ...nonLocal,
            [newStream.id]: { stream: newStream, isLocal: true },
          };
        });

        console.log("✅ Successfully updated WebRTC tracks for new processed stream");
      }).catch(error => {
        console.error("❌ Error updating WebRTC tracks:", error);
      });

    } catch (error) {
      console.error("❌ Error replacing WebRTC tracks:", error);
    }
  }, [microphoneBuffer.processedStream, microphoneBuffer.mediaStream, isConnected, streams]);

  return {
    streams,
    error: connectionState.error,
    streamSources,
    connect,
    disconnect,
    currentServerConnected: connectionState.serverId || "",
    isConnected,
    currentChannelConnected: connectionState.roomId || "",
    connectionState: connectionState.state,
    isConnecting,
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
  connectionState: SFUConnectionState.DISCONNECTED,
  isConnecting: false,
};

const SFUHook = singletonHook(init, useSfuHook);

export const useSFU = () => {
  return SFUHook();
};
