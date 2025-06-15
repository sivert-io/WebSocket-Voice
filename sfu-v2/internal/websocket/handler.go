package websocket

import (
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"log"
	"net/http"
	"net/url"

	"github.com/gorilla/websocket"
	"github.com/pion/webrtc/v3"

	"sfu-v2/internal/config"
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
	// Upgrade the HTTP request to a WebSocket connection
	unsafeConn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		h.debugLog("❌ WebSocket upgrade error: %v", err)
		return
	}

	safeConn := NewThreadSafeWriter(unsafeConn)
	defer safeConn.Close()

	// Generate unique client ID
	clientID := generateClientID()

	// Handle different connection types based on URL path
	parsedURL, _ := url.Parse(r.RequestURI)

	h.debugLog("🔌 New WebSocket connection: %s (Path: %s, RemoteAddr: %s)", clientID, parsedURL.Path, r.RemoteAddr)

	switch parsedURL.Path {
	case "/server":
		h.debugLog("🖥️  Handling server connection: %s", clientID)
		h.handleServerConnection(safeConn, clientID)
	case "/client":
		h.debugLog("👤 Handling client connection: %s", clientID)
		h.handleClientConnection(safeConn, clientID, r)
	default:
		// Default to client connection for backward compatibility
		h.debugLog("👤 Handling default client connection: %s", clientID)
		h.handleClientConnection(safeConn, clientID, r)
	}

	h.debugLog("🔌 WebSocket connection closed: %s", clientID)
}

// handleServerConnection handles server registration connections
func (h *Handler) handleServerConnection(conn *ThreadSafeWriter, clientID string) {
	h.debugLog("🖥️  Server connection established: %s", clientID)

	// Handle server registration messages
	for {
		_, raw, err := conn.ReadMessage()
		if err != nil {
			h.debugLog("❌ Error reading server message from %s: %v", clientID, err)
			return
		}

		message := &types.WebSocketMessage{}
		if err := json.Unmarshal(raw, &message); err != nil {
			h.debugLog("❌ Error unmarshalling server message from %s: %v", clientID, err)
			continue
		}

		h.debugLog("📨 Server message from %s: event=%s", clientID, message.Event)

		switch message.Event {
		case types.EventServerRegister:
			var regData types.ServerRegistrationData
			if err := json.Unmarshal([]byte(message.Data), &regData); err != nil {
				h.debugLog("❌ Error unmarshalling server registration data from %s: %v", clientID, err)
				h.sendErrorToConnection(conn, "Invalid registration data")
				continue
			}

			h.debugLog("🖥️  Server registration attempt: ServerID=%s, RoomID=%s", regData.ServerID, regData.RoomID)

			if err := h.roomManager.RegisterServer(regData.ServerID, regData.ServerToken, regData.RoomID); err != nil {
				h.debugLog("❌ Server registration failed for %s: %v", regData.ServerID, err)
				h.sendErrorToConnection(conn, "Registration failed: "+err.Error())
				continue
			}

			h.debugLog("✅ Server %s registered room %s successfully", regData.ServerID, regData.RoomID)
			h.sendSuccessToConnection(conn, "Server registered successfully")
		case types.EventKeepAlive:
			// Keep-alive message from server to prevent connection timeouts - no action needed
			// Only log in debug mode to avoid spam
			if h.config.Debug {
				h.debugLog("💓 Keep-alive received from server %s", clientID)
			}
		default:
			h.debugLog("❓ Unknown server event from %s: %s", clientID, message.Event)
		}
	}
}

// handleClientConnection handles client WebRTC connections
func (h *Handler) handleClientConnection(conn *ThreadSafeWriter, clientID string, r *http.Request) {
	h.debugLog("👤 Client connection established: %s", clientID)

	// Wait for client join message with room information
	_, raw, err := conn.ReadMessage()
	if err != nil {
		h.debugLog("❌ Error reading initial client message from %s: %v", clientID, err)
		return
	}

	message := &types.WebSocketMessage{}
	if err := json.Unmarshal(raw, &message); err != nil {
		h.debugLog("❌ Error unmarshalling initial client message from %s: %v", clientID, err)
		return
	}

	h.debugLog("📨 Client initial message from %s: event=%s", clientID, message.Event)

	if message.Event != types.EventClientJoin {
		h.debugLog("❌ Expected client_join event from %s, got: %s", clientID, message.Event)
		h.sendErrorToConnection(conn, "Expected client_join event")
		return
	}

	var joinData types.ClientJoinData
	if err := json.Unmarshal([]byte(message.Data), &joinData); err != nil {
		h.debugLog("❌ Error unmarshalling client join data from %s: %v", clientID, err)
		h.sendErrorToConnection(conn, "Invalid join data")
		return
	}

	h.debugLog("👤 Client %s attempting to join room '%s' (Server: %s)", clientID, joinData.RoomID, joinData.ServerID)

	// Validate client can join the room
	if err := h.roomManager.ValidateClientJoin(joinData.RoomID, joinData.ServerID, joinData.ServerToken); err != nil {
		h.debugLog("❌ Client join validation failed for %s: %v", clientID, err)
		h.sendErrorToConnection(conn, "Join validation failed: "+err.Error())
		return
	}

	h.debugLog("✅ Client %s validated for room '%s'", clientID, joinData.RoomID)

	// Create WebRTC configuration
	config := webrtc.Configuration{
		ICEServers: h.config.ICEServers,
	}

	// Create a new WebRTC peer connection
	peerConnection, err := peerManager.CreatePeerConnection(config)
	if err != nil {
		h.debugLog("❌ Error creating WebRTC peer connection for %s: %v", clientID, err)
		h.sendErrorToConnection(conn, "Failed to create peer connection")
		return
	}
	defer peerConnection.Close()

	h.debugLog("🔗 Created WebRTC peer connection for client %s", clientID)

	// Add peer to room
	if err := h.roomManager.AddPeerToRoom(joinData.RoomID, clientID, peerConnection, conn.Conn); err != nil {
		h.debugLog("❌ Error adding peer %s to room %s: %v", clientID, joinData.RoomID, err)
		h.sendErrorToConnection(conn, "Failed to join room")
		return
	}

	// Also add to WebRTC manager for keyframe dispatch
	h.webrtcManager.AddPeerToRoom(joinData.RoomID, clientID, peerConnection, conn)

	// Remove peer from both managers on disconnect
	defer func() {
		h.debugLog("🚪 Client %s leaving room '%s'", clientID, joinData.RoomID)
		h.roomManager.RemovePeerFromRoom(joinData.RoomID, clientID)
		h.webrtcManager.RemovePeerFromRoom(joinData.RoomID, clientID)
		h.coordinator.SignalPeerConnectionsInRoom(joinData.RoomID)
	}()

	// Send success message
	h.debugLog("✅ Client %s successfully joined room '%s'", clientID, joinData.RoomID)
	h.sendSuccessToConnection(conn, "Successfully joined room")

	// Set up ICE candidate handling
	peerConnection.OnICECandidate(func(i *webrtc.ICECandidate) {
		if i == nil {
			return
		}

		h.debugLog("🔧 Sending ICE candidate to client %s in room '%s'", clientID, joinData.RoomID)

		candidateString, err := json.Marshal(i.ToJSON())
		if err != nil {
			h.debugLog("❌ Error marshalling ICE candidate for %s: %v", clientID, err)
			return
		}

		if writeErr := conn.WriteJSON(&types.WebSocketMessage{
			Event: types.EventCandidate,
			Data:  string(candidateString),
		}); writeErr != nil {
			h.debugLog("❌ Error sending candidate JSON to %s: %v", clientID, writeErr)
		}
	})

	// Handle connection state changes
	peerConnection.OnConnectionStateChange(func(p webrtc.PeerConnectionState) {
		h.debugLog("🔗 Peer connection state change for %s in room '%s': %s", clientID, joinData.RoomID, p.String())
		switch p {
		case webrtc.PeerConnectionStateFailed:
			h.debugLog("❌ Peer connection failed for %s", clientID)
			if err := peerConnection.Close(); err != nil {
				h.debugLog("❌ Peer connection failed to close for %s: %v", clientID, err)
			}
		case webrtc.PeerConnectionStateClosed:
			h.debugLog("🔌 Peer connection closed for %s", clientID)
			h.coordinator.SignalPeerConnectionsInRoom(joinData.RoomID)
		case webrtc.PeerConnectionStateConnected:
			h.debugLog("✅ Peer connection established for %s in room '%s'", clientID, joinData.RoomID)
		default:
		}
	})

	// Handle incoming tracks
	peerConnection.OnTrack(func(t *webrtc.TrackRemote, _ *webrtc.RTPReceiver) {
		h.debugLog("🎵 Incoming track from %s in room '%s': %s (SSRC: %d)", clientID, joinData.RoomID, t.Kind().String(), t.SSRC())

		// Create a local track to forward the incoming track - now room-specific
		trackLocal := h.trackManager.AddTrackToRoom(joinData.RoomID, t)
		if trackLocal == nil {
			h.debugLog("❌ Failed to create local track for %s", clientID)
			return
		}
		defer h.trackManager.RemoveTrackFromRoom(joinData.RoomID, trackLocal)
		defer h.coordinator.OnTrackRemovedFromRoom(joinData.RoomID)

		h.debugLog("🎵 Created local track for forwarding from %s", clientID)

		// Signal that a new track was added
		h.coordinator.OnTrackAddedToRoom(joinData.RoomID)

		buf := make([]byte, 1500)
		rtpPacketCount := 0
		for {
			// Continuously read data from the remote track and send it to the local track
			i, _, err := t.Read(buf)
			if err != nil {
				h.debugLog("🎵 Track read ended for %s: %v", clientID, err)
				return
			}

			if _, err = trackLocal.Write(buf[:i]); err != nil {
				h.debugLog("❌ Track write error for %s: %v", clientID, err)
				return
			}

			rtpPacketCount++
			if h.config.VerboseLog && rtpPacketCount%1000 == 0 {
				h.debugLog("🎵 Forwarded %d RTP packets from %s", rtpPacketCount, clientID)
			}
		}
	})

	// Signal the new peer connection to start the negotiation process
	h.debugLog("🔄 Starting peer connection signaling for %s in room '%s'", clientID, joinData.RoomID)
	h.coordinator.SignalPeerConnectionsInRoom(joinData.RoomID)

	// Handle incoming WebSocket messages from the client
	h.handleClientMessages(conn, peerConnection, joinData.RoomID, clientID)
}

// handleClientMessages processes incoming WebSocket messages from clients
func (h *Handler) handleClientMessages(conn *ThreadSafeWriter, peerConnection *webrtc.PeerConnection, roomID, clientID string) {
	h.debugLog("📨 Starting message handling for client %s in room '%s'", clientID, roomID)

	message := &types.WebSocketMessage{}
	messageCount := 0
	for {
		_, raw, err := conn.ReadMessage()
		if err != nil {
			if websocket.IsCloseError(err, websocket.CloseGoingAway, websocket.CloseNormalClosure) {
				h.debugLog("🔌 WebSocket closed normally for %s: %v", clientID, err)
				break
			}

			h.debugLog("❌ Error reading WebSocket message from %s: %v", clientID, err)
			return
		}

		messageCount++

		if err := json.Unmarshal(raw, &message); err != nil {
			h.debugLog("❌ Error unmarshalling WebSocket message from %s: %v", clientID, err)
			return
		}

		h.debugLog("📨 Message #%d from %s in room '%s': event=%s", messageCount, clientID, roomID, message.Event)

		switch message.Event {
		case types.EventCandidate:
			candidate := webrtc.ICECandidateInit{}
			if err := json.Unmarshal([]byte(message.Data), &candidate); err != nil {
				h.debugLog("❌ Error unmarshalling ICE candidate from %s: %v", clientID, err)
				return
			}

			h.debugLog("🔧 Adding ICE candidate from %s", clientID)
			if err := peerConnection.AddICECandidate(candidate); err != nil {
				h.debugLog("❌ Error adding ICE candidate from %s: %v", clientID, err)
				return
			}

		case types.EventAnswer:
			answer := webrtc.SessionDescription{}
			if err := json.Unmarshal([]byte(message.Data), &answer); err != nil {
				h.debugLog("❌ Error unmarshalling answer from %s: %v", clientID, err)
				return
			}

			h.debugLog("🔄 Setting remote description (answer) from %s", clientID)
			if err := peerConnection.SetRemoteDescription(answer); err != nil {
				h.debugLog("❌ Error setting remote description from %s: %v", clientID, err)
				return
			}
		case types.EventKeepAlive:
			// Keep-alive message to prevent connection timeouts - no action needed
			// Only log in debug mode to avoid spam
			if h.config.Debug {
				h.debugLog("💓 Keep-alive received from %s", clientID)
			}
		default:
			h.debugLog("❓ Unknown message event from %s: %s", clientID, message.Event)
		}
	}

	h.debugLog("📨 Message handling ended for client %s (Total messages: %d)", clientID, messageCount)
}

// sendErrorToConnection sends an error message to a WebSocket connection
func (h *Handler) sendErrorToConnection(conn *ThreadSafeWriter, errorMsg string) {
	h.debugLog("❌ Sending error: %s", errorMsg)
	conn.WriteJSON(&types.WebSocketMessage{
		Event: types.EventRoomError,
		Data:  errorMsg,
	})
}

// sendSuccessToConnection sends a success message to a WebSocket connection
func (h *Handler) sendSuccessToConnection(conn *ThreadSafeWriter, successMsg string) {
	h.debugLog("✅ Sending success: %s", successMsg)
	conn.WriteJSON(&types.WebSocketMessage{
		Event: types.EventRoomJoined,
		Data:  successMsg,
	})
}
