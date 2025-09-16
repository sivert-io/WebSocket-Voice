package websocket

import (
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"log"
	"net/http"
	"net/url"

	"github.com/gorilla/websocket"
	"github.com/pion/webrtc/v3"

	"sfu-v2/internal/config"
	"sfu-v2/internal/recovery"
	"sfu-v2/internal/room"
	"sfu-v2/internal/track"
	peerManager "sfu-v2/internal/webrtc"
	"sfu-v2/pkg/types"
)

var upgrader = websocket.Upgrader{
	// Allow all origins to connect. In a production app, you should limit this to your allowed origins.
	CheckOrigin: func(r *http.Request) bool { return true },
}

// Coordinator interface to avoid circular imports
type Coordinator interface {
	SignalPeerConnectionsInRoom(roomID string)
	OnTrackAddedToRoom(roomID string)
	OnTrackRemovedFromRoom(roomID string)
}

// Handler manages WebSocket connections and integrates with other components
type Handler struct {
	config        *config.Config
	trackManager  *track.Manager
	webrtcManager *peerManager.Manager
	roomManager   *room.Manager
	coordinator   Coordinator
}

// NewHandler creates a new WebSocket handler
func NewHandler(cfg *config.Config, trackManager *track.Manager, webrtcManager *peerManager.Manager, roomManager *room.Manager, coordinator Coordinator) *Handler {
	return &Handler{
		config:        cfg,
		trackManager:  trackManager,
		webrtcManager: webrtcManager,
		roomManager:   roomManager,
		coordinator:   coordinator,
	}
}

// debugLog logs debug messages if debug mode is enabled
func (h *Handler) debugLog(format string, args ...interface{}) {
	if h.config.Debug {
		log.Printf("[WEBSOCKET] "+format, args...)
	}
}

// generateClientID generates a unique client ID
func generateClientID() string {
	bytes := make([]byte, 16)
	rand.Read(bytes)
	return hex.EncodeToString(bytes)
}

// HandleWebSocket handles incoming WebSocket connections
func (h *Handler) HandleWebSocket(w http.ResponseWriter, r *http.Request) {
	recovery.SafeExecuteWithContext("WEBSOCKET", "HANDLE_CONNECTION", "", "", r.RemoteAddr, func() error {
		// Upgrade the HTTP request to a WebSocket connection
		unsafeConn, err := upgrader.Upgrade(w, r, nil)
		if err != nil {
			// Only log WebSocket upgrade errors in debug mode to reduce noise
			if h.config.Debug {
				h.debugLog("❌ WebSocket upgrade error: %v", err)
			}
			return err
		}

		safeConn := NewThreadSafeWriter(unsafeConn)
		defer func() {
			recovery.SafeExecute("WEBSOCKET", "CLOSE_CONNECTION", func() error {
				safeConn.Close()
				return nil
			})
		}()

		// Generate unique client ID
		clientID := generateClientID()

		// Handle different connection types based on URL path
		parsedURL, _ := url.Parse(r.RequestURI)

		h.debugLog("🔌 New WebSocket connection: %s (Path: %s, RemoteAddr: %s)", clientID, parsedURL.Path, r.RemoteAddr)

		switch parsedURL.Path {
		case "/server":
			h.debugLog("🖥️  Handling server connection: %s", clientID)
			return h.handleServerConnection(safeConn, clientID)
		case "/client":
			h.debugLog("👤 Handling client connection: %s", clientID)
			return h.handleClientConnection(safeConn, clientID, r)
		default:
			// Default to client connection for backward compatibility
			h.debugLog("👤 Handling default client connection: %s", clientID)
			return h.handleClientConnection(safeConn, clientID, r)
		}
	})
}

// handleServerConnection handles server registration connections
func (h *Handler) handleServerConnection(conn *ThreadSafeWriter, clientID string) error {
	return recovery.SafeExecuteWithContext("WEBSOCKET", "HANDLE_SERVER", clientID, "", "Server connection handling", func() error {
		h.debugLog("🖥️  Server connection established: %s", clientID)

		// Handle server registration messages
		for {
			var raw []byte
			var err error

			// Safe message reading
			err = recovery.SafeExecuteWithContext("WEBSOCKET", "READ_SERVER_MESSAGE", clientID, "", "Reading server message", func() error {
				_, raw, err = conn.ReadMessage()
				return err
			})

			if err != nil {
				h.debugLog("❌ Error reading server message from %s: %v", clientID, err)
				return err
			}

			message := &types.WebSocketMessage{}
			if err := recovery.SafeJSONUnmarshal(raw, &message); err != nil {
				h.debugLog("❌ Error unmarshalling server message from %s: %v", clientID, err)
				continue
			}

			h.debugLog("📨 Server message from %s: event=%s", clientID, message.Event)

			// Process server message with recovery
			err = recovery.SafeExecuteWithContext("WEBSOCKET", "PROCESS_SERVER_MESSAGE", clientID, "", message.Event, func() error {
				switch message.Event {
				case types.EventServerRegister:
					return h.handleServerRegistration(conn, clientID, message.Data)
				case types.EventKeepAlive:
					// Keep-alive message from server to prevent connection timeouts - no action needed
					// Only log in debug mode to avoid spam
					if h.config.Debug {
						h.debugLog("💓 Keep-alive received from server %s", clientID)
					}
					return nil
				default:
					h.debugLog("❓ Unknown server event from %s: %s", clientID, message.Event)
					return nil
				}
			})

			if err != nil {
				h.debugLog("❌ Error processing server message from %s: %v", clientID, err)
				// Continue processing other messages instead of breaking
			}
		}
	})
}

// handleServerRegistration processes server registration
func (h *Handler) handleServerRegistration(conn *ThreadSafeWriter, clientID, data string) error {
	var regData types.ServerRegistrationData
	if err := recovery.SafeJSONUnmarshal([]byte(data), &regData); err != nil {
		h.debugLog("❌ Error unmarshalling server registration data from %s: %v", clientID, err)
		h.sendErrorToConnection(conn, "Invalid registration data")
		return err
	}

	h.debugLog("🖥️  Server registration attempt: ServerID=%s, RoomID=%s", regData.ServerID, regData.RoomID)

	if err := h.roomManager.RegisterServer(regData.ServerID, regData.ServerToken, regData.RoomID); err != nil {
		h.debugLog("❌ Server registration failed for %s: %v", regData.ServerID, err)
		h.sendErrorToConnection(conn, "Registration failed: "+err.Error())
		return err
	}

	h.debugLog("✅ Server %s registered room %s successfully", regData.ServerID, regData.RoomID)
	h.sendSuccessToConnection(conn, "Server registered successfully")
	return nil
}

// handleClientConnection handles client WebRTC connections
func (h *Handler) handleClientConnection(conn *ThreadSafeWriter, clientID string, r *http.Request) error {
	return recovery.SafeExecuteWithContext("WEBSOCKET", "HANDLE_CLIENT", clientID, "", "Client connection handling", func() error {
		h.debugLog("👤 Client connection established: %s", clientID)

		// Wait for client join message with room information
		var raw []byte
		var err error

		err = recovery.SafeExecuteWithContext("WEBSOCKET", "READ_CLIENT_JOIN", clientID, "", "Reading initial client message", func() error {
			_, raw, err = conn.ReadMessage()
			return err
		})

		if err != nil {
			h.debugLog("❌ Error reading initial client message from %s: %v", clientID, err)
			return err
		}

		message := &types.WebSocketMessage{}
		if err := recovery.SafeJSONUnmarshal(raw, &message); err != nil {
			h.debugLog("❌ Error unmarshalling initial client message from %s: %v", clientID, err)
			return err
		}

		h.debugLog("📨 Client initial message from %s: event=%s", clientID, message.Event)

		if message.Event != types.EventClientJoin {
			h.debugLog("❌ Expected client_join event from %s, got: %s", clientID, message.Event)
			h.sendErrorToConnection(conn, "Expected client_join event")
			return fmt.Errorf("expected client_join event, got: %s", message.Event)
		}

		var joinData types.ClientJoinData
		if err := recovery.SafeJSONUnmarshal([]byte(message.Data), &joinData); err != nil {
			h.debugLog("❌ Error unmarshalling client join data from %s: %v", clientID, err)
			h.sendErrorToConnection(conn, "Invalid join data")
			return err
		}

		h.debugLog("👤 Client %s attempting to join room '%s' (Server: %s)", clientID, joinData.RoomID, joinData.ServerID)

		// Validate client can join the room
		if err := h.roomManager.ValidateClientJoin(joinData.RoomID, joinData.ServerID, joinData.ServerToken); err != nil {
			h.debugLog("❌ Client join validation failed for %s: %v", clientID, err)
			h.sendErrorToConnection(conn, "Join validation failed: "+err.Error())
			return err
		}

		h.debugLog("✅ Client %s validated for room '%s'", clientID, joinData.RoomID)

		// Create WebRTC peer connection with recovery
		var peerConnection *webrtc.PeerConnection
		err = recovery.SafeExecuteWithContext("WEBSOCKET", "CREATE_PEER_CONNECTION", clientID, joinData.RoomID, "Creating WebRTC peer connection", func() error {
			// Create WebRTC configuration
			config := webrtc.Configuration{
				ICEServers: h.config.ICEServers,
			}

			var createErr error
			peerConnection, createErr = peerManager.CreatePeerConnection(config)
			if createErr != nil {
				h.debugLog("❌ Error creating WebRTC peer connection for %s: %v", clientID, createErr)
				h.sendErrorToConnection(conn, "Failed to create peer connection")
				return createErr
			}

			h.debugLog("🔗 Created WebRTC peer connection for client %s", clientID)
			return nil
		})

		if err != nil {
			return err
		}

		// Ensure peer connection cleanup
		defer func() {
			recovery.SafeExecuteWithContext("WEBSOCKET", "CLEANUP_PEER_CONNECTION", clientID, joinData.RoomID, "Cleaning up peer connection", func() error {
				if peerConnection != nil {
					peerConnection.Close()
				}
				return nil
			})
		}()

		// Add peer to room managers with recovery
		err = recovery.SafeExecuteWithContext("WEBSOCKET", "ADD_PEER_TO_ROOM", clientID, joinData.RoomID, "Adding peer to room", func() error {
			if err := h.roomManager.AddPeerToRoom(joinData.RoomID, clientID, peerConnection, conn.Conn); err != nil {
				h.debugLog("❌ Error adding peer %s to room %s: %v", clientID, joinData.RoomID, err)
				h.sendErrorToConnection(conn, "Failed to join room")
				return err
			}

			// Also add to WebRTC manager for keyframe dispatch
			h.webrtcManager.AddPeerToRoom(joinData.RoomID, clientID, peerConnection, conn)
			return nil
		})

		if err != nil {
			return err
		}

		// Remove peer from both managers on disconnect
		defer func() {
			recovery.SafeExecuteWithContext("WEBSOCKET", "REMOVE_PEER_FROM_ROOM", clientID, joinData.RoomID, "Removing peer from room", func() error {
				h.debugLog("🚪 Client %s leaving room '%s'", clientID, joinData.RoomID)
				h.roomManager.RemovePeerFromRoom(joinData.RoomID, clientID)
				h.webrtcManager.RemovePeerFromRoom(joinData.RoomID, clientID)
				h.coordinator.SignalPeerConnectionsInRoom(joinData.RoomID)
				return nil
			})
		}()

		// Send success message
		h.debugLog("✅ Client %s successfully joined room '%s'", clientID, joinData.RoomID)
		h.sendSuccessToConnection(conn, "Successfully joined room")

		// Set up WebRTC event handlers with recovery
		h.setupWebRTCHandlers(peerConnection, conn, clientID, joinData.RoomID)

		// Signal the new peer connection to start the negotiation process
		recovery.SafeExecuteWithContext("WEBSOCKET", "SIGNAL_PEER_CONNECTIONS", clientID, joinData.RoomID, "Starting peer signaling", func() error {
			h.debugLog("🔄 Starting peer connection signaling for %s in room '%s'", clientID, joinData.RoomID)
			h.coordinator.SignalPeerConnectionsInRoom(joinData.RoomID)
			return nil
		})

		// Handle incoming WebSocket messages from the client
		return h.handleClientMessages(conn, peerConnection, joinData.RoomID, clientID)
	})
}

// setupWebRTCHandlers sets up WebRTC event handlers with crash protection
func (h *Handler) setupWebRTCHandlers(peerConnection *webrtc.PeerConnection, conn *ThreadSafeWriter, clientID, roomID string) {
	// Set up ICE candidate handling with recovery
	peerConnection.OnICECandidate(func(i *webrtc.ICECandidate) {
		recovery.SafeExecuteWithContext("WEBRTC", "ICE_CANDIDATE", clientID, roomID, "Handling ICE candidate", func() error {
			if i == nil {
				return nil
			}

			h.debugLog("🔧 Sending ICE candidate to client %s in room '%s'", clientID, roomID)

			candidateString, err := recovery.SafeJSONMarshal(i.ToJSON())
			if err != nil {
				h.debugLog("❌ Error marshalling ICE candidate for %s: %v", clientID, err)
				return err
			}

			if writeErr := conn.WriteJSON(&types.WebSocketMessage{
				Event: types.EventCandidate,
				Data:  string(candidateString),
			}); writeErr != nil {
				h.debugLog("❌ Error sending candidate JSON to %s: %v", clientID, writeErr)
				return writeErr
			}
			return nil
		})
	})

	// Handle connection state changes with recovery
	peerConnection.OnConnectionStateChange(func(p webrtc.PeerConnectionState) {
		recovery.SafeExecuteWithContext("WEBRTC", "CONNECTION_STATE_CHANGE", clientID, roomID, p.String(), func() error {
			h.debugLog("🔗 Peer connection state change for %s in room '%s': %s", clientID, roomID, p.String())
			switch p {
			case webrtc.PeerConnectionStateFailed:
				h.debugLog("❌ Peer connection failed for %s", clientID)
				if err := peerConnection.Close(); err != nil {
					h.debugLog("❌ Peer connection failed to close for %s: %v", clientID, err)
				}
			case webrtc.PeerConnectionStateClosed:
				h.debugLog("🔌 Peer connection closed for %s", clientID)
				h.coordinator.SignalPeerConnectionsInRoom(roomID)
			case webrtc.PeerConnectionStateConnected:
				h.debugLog("✅ Peer connection established for %s in room '%s'", clientID, roomID)
			}
			return nil
		})
	})

	// Handle incoming tracks with recovery
	peerConnection.OnTrack(func(t *webrtc.TrackRemote, _ *webrtc.RTPReceiver) {
		recovery.SafeExecuteWithContext("WEBRTC", "TRACK_RECEIVED", clientID, roomID, fmt.Sprintf("Track: %s", t.Kind().String()), func() error {
			h.debugLog("🎵 Incoming track from %s in room '%s': %s (SSRC: %d)", clientID, roomID, t.Kind().String(), t.SSRC())

			// Create a local track to forward the incoming track - now room-specific
			trackLocal := h.trackManager.AddTrackToRoom(roomID, t)
			if trackLocal == nil {
				h.debugLog("❌ Failed to create local track for %s", clientID)
				return fmt.Errorf("failed to create local track")
			}

			defer func() {
				recovery.SafeExecuteWithContext("WEBRTC", "CLEANUP_TRACK", clientID, roomID, "Cleaning up track", func() error {
					h.trackManager.RemoveTrackFromRoom(roomID, trackLocal)
					h.coordinator.OnTrackRemovedFromRoom(roomID)
					return nil
				})
			}()

			h.debugLog("🎵 Created local track for forwarding from %s", clientID)

			// Signal that a new track was added
			h.coordinator.OnTrackAddedToRoom(roomID)

			// Forward RTP packets with recovery
			return h.forwardRTPPackets(t, trackLocal, clientID)
		})
	})
}

// forwardRTPPackets forwards RTP packets from remote track to local track
func (h *Handler) forwardRTPPackets(remoteTrack *webrtc.TrackRemote, localTrack *webrtc.TrackLocalStaticRTP, clientID string) error {
	buf := make([]byte, 1500)
	rtpPacketCount := 0

	for {
		// Read with recovery protection
		var i int
		var readErr error

		err := recovery.SafeExecuteWithContext("WEBRTC", "READ_RTP_PACKET", clientID, "", "Reading RTP packet", func() error {
			i, _, readErr = remoteTrack.Read(buf)
			return readErr
		})

		if err != nil {
			h.debugLog("🎵 Track read ended for %s: %v", clientID, err)
			return err
		}

		// Write with recovery protection
		err = recovery.SafeExecuteWithContext("WEBRTC", "WRITE_RTP_PACKET", clientID, "", "Writing RTP packet", func() error {
			_, writeErr := localTrack.Write(buf[:i])
			return writeErr
		})

		if err != nil {
			h.debugLog("❌ Track write error for %s: %v", clientID, err)
			return err
		}

		rtpPacketCount++
		if h.config.VerboseLog && rtpPacketCount%1000 == 0 {
			h.debugLog("🎵 Forwarded %d RTP packets from %s", rtpPacketCount, clientID)
		}
	}
}

// handleClientMessages processes incoming WebSocket messages from clients
func (h *Handler) handleClientMessages(conn *ThreadSafeWriter, peerConnection *webrtc.PeerConnection, roomID, clientID string) error {
	return recovery.SafeExecuteWithContext("WEBSOCKET", "HANDLE_CLIENT_MESSAGES", clientID, roomID, "Processing client messages", func() error {
		h.debugLog("📨 Starting message handling for client %s in room '%s'", clientID, roomID)

		message := &types.WebSocketMessage{}
		messageCount := 0

		for {
			var raw []byte
			var err error

			// Safe message reading
			err = recovery.SafeExecuteWithContext("WEBSOCKET", "READ_CLIENT_MESSAGE", clientID, roomID, "Reading client message", func() error {
				_, raw, err = conn.ReadMessage()
				return err
			})

			if err != nil {
				if websocket.IsCloseError(err, websocket.CloseGoingAway, websocket.CloseNormalClosure) {
					h.debugLog("🔌 WebSocket closed normally for %s: %v", clientID, err)
					break
				}

				h.debugLog("❌ Error reading WebSocket message from %s: %v", clientID, err)
				return err
			}

			messageCount++

			if err := recovery.SafeJSONUnmarshal(raw, &message); err != nil {
				h.debugLog("❌ Error unmarshalling WebSocket message from %s: %v", clientID, err)
				continue // Continue processing other messages
			}

			h.debugLog("📨 Message #%d from %s in room '%s': event=%s", messageCount, clientID, roomID, message.Event)

			// Process message with recovery
			err = recovery.SafeExecuteWithContext("WEBSOCKET", "PROCESS_CLIENT_MESSAGE", clientID, roomID, message.Event, func() error {
				switch message.Event {
				case types.EventCandidate:
					return h.handleICECandidate(peerConnection, message.Data, clientID)
				case types.EventAnswer:
					return h.handleAnswer(peerConnection, message.Data, clientID)
				case types.EventKeepAlive:
					// Keep-alive message to prevent connection timeouts - no action needed
					// Only log in debug mode to avoid spam
					if h.config.Debug {
						h.debugLog("💓 Keep-alive received from %s", clientID)
					}
					return nil
				default:
					h.debugLog("❓ Unknown message event from %s: %s", clientID, message.Event)
					return nil
				}
			})

			if err != nil {
				h.debugLog("❌ Error processing message from %s: %v", clientID, err)
				// Continue processing other messages instead of breaking
			}
		}

		h.debugLog("📨 Message handling ended for client %s (Total messages: %d)", clientID, messageCount)
		return nil
	})
}

// handleICECandidate processes ICE candidate messages
func (h *Handler) handleICECandidate(peerConnection *webrtc.PeerConnection, data, clientID string) error {
	candidate := webrtc.ICECandidateInit{}
	if err := recovery.SafeJSONUnmarshal([]byte(data), &candidate); err != nil {
		h.debugLog("❌ Error unmarshalling ICE candidate from %s: %v", clientID, err)
		return err
	}

	h.debugLog("🔧 Adding ICE candidate from %s", clientID)
	if err := peerConnection.AddICECandidate(candidate); err != nil {
		h.debugLog("❌ Error adding ICE candidate from %s: %v", clientID, err)
		return err
	}
	return nil
}

// handleAnswer processes answer messages
func (h *Handler) handleAnswer(peerConnection *webrtc.PeerConnection, data, clientID string) error {
	answer := webrtc.SessionDescription{}
	if err := recovery.SafeJSONUnmarshal([]byte(data), &answer); err != nil {
		h.debugLog("❌ Error unmarshalling answer from %s: %v", clientID, err)
		return err
	}

	h.debugLog("🔄 Setting remote description (answer) from %s", clientID)
	if err := peerConnection.SetRemoteDescription(answer); err != nil {
		h.debugLog("❌ Error setting remote description from %s: %v", clientID, err)
		return err
	}
	return nil
}

// sendErrorToConnection sends an error message to a WebSocket connection
func (h *Handler) sendErrorToConnection(conn *ThreadSafeWriter, errorMsg string) {
	recovery.SafeExecute("WEBSOCKET", "SEND_ERROR", func() error {
		h.debugLog("❌ Sending error: %s", errorMsg)
		return conn.WriteJSON(&types.WebSocketMessage{
			Event: types.EventRoomError,
			Data:  errorMsg,
		})
	})
}

// sendSuccessToConnection sends a success message to a WebSocket connection
func (h *Handler) sendSuccessToConnection(conn *ThreadSafeWriter, successMsg string) {
	recovery.SafeExecute("WEBSOCKET", "SEND_SUCCESS", func() error {
		h.debugLog("✅ Sending success: %s", successMsg)
		return conn.WriteJSON(&types.WebSocketMessage{
			Event: types.EventRoomJoined,
			Data:  successMsg,
		})
	})
}
