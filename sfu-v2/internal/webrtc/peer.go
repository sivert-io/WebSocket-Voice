package webrtc

import (
	"log"
	"sync"
	"time"

	"github.com/pion/rtcp"
	"github.com/pion/webrtc/v3"
)

// WebSocketWriter interface to avoid circular imports
type WebSocketWriter interface {
	WriteJSON(v interface{}) error
}

// PeerConnection represents a WebRTC peer connection with its associated WebSocket
type PeerConnection struct {
	PC        *webrtc.PeerConnection
	WebSocket WebSocketWriter
}

// Manager handles multiple peer connections per room
type Manager struct {
	mu sync.RWMutex
	// Map of roomID -> clientID -> PeerConnection
	roomPeers map[string]map[string]PeerConnection
	debug     bool
}

// NewManager creates a new WebRTC peer connection manager
func NewManager(debug bool) *Manager {
	return &Manager{
		roomPeers: make(map[string]map[string]PeerConnection),
		debug:     debug,
	}
}

// debugLog logs debug messages if debug mode is enabled
func (m *Manager) debugLog(format string, args ...interface{}) {
	if m.debug {
		log.Printf("[WEBRTC-MANAGER] "+format, args...)
	}
}

// AddPeerToRoom adds a new peer connection to a specific room
func (m *Manager) AddPeerToRoom(roomID, clientID string, pc *webrtc.PeerConnection, ws WebSocketWriter) {
	m.mu.Lock()
	defer m.mu.Unlock()

	// Initialize room if it doesn't exist
	if m.roomPeers[roomID] == nil {
		m.roomPeers[roomID] = make(map[string]PeerConnection)
		m.debugLog("🏠 Initialized peer storage for room '%s'", roomID)
	}

	// Add peer to room
	m.roomPeers[roomID][clientID] = PeerConnection{
		PC:        pc,
		WebSocket: ws,
	}

	roomPeerCount := len(m.roomPeers[roomID])
	m.debugLog("🔗 Added peer '%s' to room '%s' (Room peers: %d)", clientID, roomID, roomPeerCount)
}

// RemovePeerFromRoom removes a peer connection from a specific room
func (m *Manager) RemovePeerFromRoom(roomID, clientID string) {
	m.mu.Lock()
	defer m.mu.Unlock()

	roomPeers, roomExists := m.roomPeers[roomID]
	if !roomExists {
		m.debugLog("❌ Cannot remove peer: room '%s' does not exist", roomID)
		return
	}

	if _, peerExists := roomPeers[clientID]; !peerExists {
		m.debugLog("❌ Peer '%s' not found in room '%s'", clientID, roomID)
		return
	}

	delete(roomPeers, clientID)
	m.debugLog("🗑️  Removed peer '%s' from room '%s' (Remaining peers: %d)", clientID, roomID, len(roomPeers))

	// Clean up empty room
	if len(roomPeers) == 0 {
		delete(m.roomPeers, roomID)
		m.debugLog("🧹 Cleaned up empty peer storage for room '%s'", roomID)
	}
}

// GetPeersInRoom returns a copy of all peer connections in a specific room
func (m *Manager) GetPeersInRoom(roomID string) []PeerConnection {
	m.mu.RLock()
	defer m.mu.RUnlock()

	roomPeers, exists := m.roomPeers[roomID]
	if !exists {
		m.debugLog("📭 No peers found for room '%s'", roomID)
		return []PeerConnection{}
	}

	peers := make([]PeerConnection, 0, len(roomPeers))
	for _, peer := range roomPeers {
		peers = append(peers, peer)
	}

	m.debugLog("📦 Retrieved %d peers from room '%s'", len(peers), roomID)
	return peers
}

// RemoveClosedPeersInRoom removes peer connections that are closed from a specific room
func (m *Manager) RemoveClosedPeersInRoom(roomID string) {
	m.mu.Lock()
	defer m.mu.Unlock()

	roomPeers, exists := m.roomPeers[roomID]
	if !exists {
		return
	}

	removedCount := 0
	for clientID, peer := range roomPeers {
		if peer.PC.ConnectionState() == webrtc.PeerConnectionStateClosed {
			delete(roomPeers, clientID)
			removedCount++
			m.debugLog("🗑️  Removed closed peer '%s' from room '%s'", clientID, roomID)
		}
	}

	if removedCount > 0 {
		m.debugLog("🧹 Removed %d closed peers from room '%s'", removedCount, roomID)
	}

	// Clean up empty room
	if len(roomPeers) == 0 {
		delete(m.roomPeers, roomID)
		m.debugLog("🧹 Cleaned up empty peer storage for room '%s'", roomID)
	}
}

// DispatchKeyFrameToRoom sends a keyframe request to all peer connections in a specific room
func (m *Manager) DispatchKeyFrameToRoom(roomID string) {
	m.mu.RLock()
	defer m.mu.RUnlock()

	roomPeers, exists := m.roomPeers[roomID]
	if !exists {
		return
	}

	keyframesSent := 0
	for clientID, peer := range roomPeers {
		for _, receiver := range peer.PC.GetReceivers() {
			if receiver.Track() == nil {
				continue
			}

			// Send a Picture Loss Indication (PLI) to request a keyframe
			if err := peer.PC.WriteRTCP([]rtcp.Packet{
				&rtcp.PictureLossIndication{
					MediaSSRC: uint32(receiver.Track().SSRC()),
				},
			}); err != nil {
				m.debugLog("❌ Error sending keyframe to peer '%s' in room '%s': %v", clientID, roomID, err)
			} else {
				keyframesSent++
			}
		}
	}

	if keyframesSent > 0 {
		m.debugLog("🔑 Sent %d keyframes to room '%s'", keyframesSent, roomID)
	}
}

// GetRoomStats returns statistics about peers per room
func (m *Manager) GetRoomStats() map[string]int {
	m.mu.RLock()
	defer m.mu.RUnlock()

	stats := make(map[string]int)
	for roomID, peers := range m.roomPeers {
		stats[roomID] = len(peers)
	}
	return stats
}

// StartKeyFrameDispatcher starts a goroutine that periodically requests keyframes for all rooms
func (m *Manager) StartKeyFrameDispatcher() {
	go func() {
		ticker := time.NewTicker(time.Second * 3)
		defer ticker.Stop()

		m.debugLog("🔑 Keyframe dispatcher started (interval: 3s)")

		for range ticker.C {
			m.mu.RLock()
			rooms := make([]string, 0, len(m.roomPeers))
			for roomID := range m.roomPeers {
				rooms = append(rooms, roomID)
			}
			m.mu.RUnlock()

			for _, roomID := range rooms {
				m.DispatchKeyFrameToRoom(roomID)
			}
		}
	}()
}

// CreatePeerConnection creates a new WebRTC peer connection with the given configuration
func CreatePeerConnection(config webrtc.Configuration) (*webrtc.PeerConnection, error) {
	peerConnection, err := webrtc.NewPeerConnection(config)
	if err != nil {
		return nil, err
	}

	// Prepare to receive both audio and video tracks from clients
	for _, typ := range []webrtc.RTPCodecType{webrtc.RTPCodecTypeVideo, webrtc.RTPCodecTypeAudio} {
		if _, err := peerConnection.AddTransceiverFromKind(typ, webrtc.RTPTransceiverInit{
			Direction: webrtc.RTPTransceiverDirectionRecvonly,
		}); err != nil {
			return nil, err
		}
	}

	return peerConnection, nil
}

// Legacy methods for backward compatibility (deprecated)
func (m *Manager) AddPeer(pc *webrtc.PeerConnection, ws WebSocketWriter) {
	m.debugLog("⚠️  Warning: AddPeer() is deprecated, use AddPeerToRoom() instead")
}

func (m *Manager) GetPeers() []PeerConnection {
	m.debugLog("⚠️  Warning: GetPeers() is deprecated, use GetPeersInRoom() instead")
	return []PeerConnection{}
}

func (m *Manager) RemoveClosedPeers() {
	m.debugLog("⚠️  Warning: RemoveClosedPeers() is deprecated, use RemoveClosedPeersInRoom() instead")
}

func (m *Manager) DispatchKeyFrame() {
	m.debugLog("⚠️  Warning: DispatchKeyFrame() is deprecated, use DispatchKeyFrameToRoom() instead")
}
