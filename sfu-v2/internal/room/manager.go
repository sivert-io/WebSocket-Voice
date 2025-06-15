package room

import (
	"fmt"
	"log"
	"sync"
	"time"

	"github.com/gorilla/websocket"
	"github.com/pion/webrtc/v3"
)

// Room represents a voice chat room
type Room struct {
	ID              string
	ServerID        string
	PeerConnections map[string]*webrtc.PeerConnection
	Connections     map[string]*websocket.Conn
	CreatedAt       time.Time
	LastActivity    time.Time
	mutex           sync.RWMutex
}

// Manager handles room creation and management
type Manager struct {
	rooms             map[string]*Room
	serverToRooms     map[string][]string
	registeredServers map[string]string // serverID -> serverToken
	mutex             sync.RWMutex
	debug             bool
}

// NewManager creates a new room manager
func NewManager(debug bool) *Manager {
	return &Manager{
		rooms:             make(map[string]*Room),
		serverToRooms:     make(map[string][]string),
		registeredServers: make(map[string]string),
		debug:             debug,
	}
}

// debugLog logs debug messages if debug mode is enabled
func (m *Manager) debugLog(format string, args ...interface{}) {
	if m.debug {
		log.Printf("[ROOM-MANAGER] "+format, args...)
	}
}

// RegisterServer registers a server and creates a room for it
func (m *Manager) RegisterServer(serverID, serverToken, roomID string) error {
	m.mutex.Lock()
	defer m.mutex.Unlock()

	m.debugLog("Attempting to register server '%s' with room '%s'", serverID, roomID)

	// Check if server is already registered
	if existingToken, exists := m.registeredServers[serverID]; exists {
		if existingToken != serverToken {
			m.debugLog("❌ Server '%s' registration failed: token mismatch", serverID)
			return fmt.Errorf("server %s already registered with different token", serverID)
		}
		m.debugLog("✅ Server '%s' already registered with matching token", serverID)
	} else {
		m.registeredServers[serverID] = serverToken
		m.debugLog("✅ Server '%s' registered successfully", serverID)
	}

	// Check if room already exists
	if room, exists := m.rooms[roomID]; exists {
		if room.ServerID != serverID {
			m.debugLog("❌ Room '%s' already exists for different server '%s' (requested by '%s')", roomID, room.ServerID, serverID)
			return fmt.Errorf("room %s already exists for different server", roomID)
		}
		m.debugLog("✅ Room '%s' already exists for server '%s'", roomID, serverID)
		return nil // Room already exists for this server
	}

	// Create new room
	room := &Room{
		ID:              roomID,
		ServerID:        serverID,
		PeerConnections: make(map[string]*webrtc.PeerConnection),
		Connections:     make(map[string]*websocket.Conn),
		CreatedAt:       time.Now(),
		LastActivity:    time.Now(),
	}

	m.rooms[roomID] = room
	m.serverToRooms[serverID] = append(m.serverToRooms[serverID], roomID)

	m.debugLog("🏠 Created new room '%s' for server '%s' (Total rooms: %d)", roomID, serverID, len(m.rooms))
	m.logRoomStats()

	return nil
}

// ValidateClientJoin validates that a client can join a room
func (m *Manager) ValidateClientJoin(roomID, serverID, serverToken string) error {
	m.mutex.RLock()
	defer m.mutex.RUnlock()

	m.debugLog("Validating client join: room='%s', server='%s'", roomID, serverID)

	// Check if server is registered
	registeredToken, exists := m.registeredServers[serverID]
	if !exists {
		m.debugLog("❌ Validation failed: server '%s' not registered", serverID)
		return fmt.Errorf("server %s not registered", serverID)
	}

	if registeredToken != serverToken {
		m.debugLog("❌ Validation failed: invalid token for server '%s'", serverID)
		return fmt.Errorf("invalid server token for server %s", serverID)
	}

	// Check if room exists
	room, exists := m.rooms[roomID]
	if !exists {
		m.debugLog("❌ Validation failed: room '%s' does not exist", roomID)
		return fmt.Errorf("room %s does not exist", roomID)
	}

	// Check if room belongs to the server
	if room.ServerID != serverID {
		m.debugLog("❌ Validation failed: room '%s' belongs to server '%s', not '%s'", roomID, room.ServerID, serverID)
		return fmt.Errorf("room %s does not belong to server %s", roomID, serverID)
	}

	m.debugLog("✅ Client join validation passed for room '%s'", roomID)
	return nil
}

// GetRoom returns a room by ID
func (m *Manager) GetRoom(roomID string) (*Room, bool) {
	m.mutex.RLock()
	defer m.mutex.RUnlock()
	room, exists := m.rooms[roomID]

	if m.debug {
		if exists {
			m.debugLog("Retrieved room '%s' (Server: %s, Peers: %d)", roomID, room.ServerID, len(room.PeerConnections))
		} else {
			m.debugLog("Room '%s' not found", roomID)
		}
	}

	return room, exists
}

// AddPeerToRoom adds a peer connection to a room
func (m *Manager) AddPeerToRoom(roomID, clientID string, pc *webrtc.PeerConnection, conn *websocket.Conn) error {
	m.mutex.Lock()
	defer m.mutex.Unlock()

	room, exists := m.rooms[roomID]
	if !exists {
		m.debugLog("❌ Cannot add peer '%s': room '%s' does not exist", clientID, roomID)
		return fmt.Errorf("room %s does not exist", roomID)
	}

	room.mutex.Lock()
	defer room.mutex.Unlock()

	room.PeerConnections[clientID] = pc
	room.Connections[clientID] = conn
	room.LastActivity = time.Now()

	m.debugLog("👤 Added peer '%s' to room '%s' (Total peers in room: %d)", clientID, roomID, len(room.PeerConnections))
	m.logRoomDetails(room)

	return nil
}

// RemovePeerFromRoom removes a peer connection from a room
func (m *Manager) RemovePeerFromRoom(roomID, clientID string) error {
	m.mutex.Lock()
	defer m.mutex.Unlock()

	room, exists := m.rooms[roomID]
	if !exists {
		m.debugLog("❌ Cannot remove peer '%s': room '%s' does not exist", clientID, roomID)
		return fmt.Errorf("room %s does not exist", roomID)
	}

	room.mutex.Lock()
	defer room.mutex.Unlock()

	delete(room.PeerConnections, clientID)
	delete(room.Connections, clientID)
	room.LastActivity = time.Now()

	m.debugLog("👤 Removed peer '%s' from room '%s' (Remaining peers: %d)", clientID, roomID, len(room.PeerConnections))
	m.logRoomDetails(room)

	return nil
}

// GetPeersInRoom returns all peer connections in a room
func (m *Manager) GetPeersInRoom(roomID string) (map[string]*webrtc.PeerConnection, error) {
	m.mutex.RLock()
	defer m.mutex.RUnlock()

	room, exists := m.rooms[roomID]
	if !exists {
		return nil, fmt.Errorf("room %s does not exist", roomID)
	}

	room.mutex.RLock()
	defer room.mutex.RUnlock()

	// Create a copy to avoid race conditions
	peers := make(map[string]*webrtc.PeerConnection)
	for clientID, pc := range room.PeerConnections {
		peers[clientID] = pc
	}

	m.debugLog("Retrieved %d peers from room '%s'", len(peers), roomID)

	return peers, nil
}

// GetConnectionsInRoom returns all websocket connections in a room
func (m *Manager) GetConnectionsInRoom(roomID string) (map[string]*websocket.Conn, error) {
	m.mutex.RLock()
	defer m.mutex.RUnlock()

	room, exists := m.rooms[roomID]
	if !exists {
		return nil, fmt.Errorf("room %s does not exist", roomID)
	}

	room.mutex.RLock()
	defer room.mutex.RUnlock()

	// Create a copy to avoid race conditions
	connections := make(map[string]*websocket.Conn)
	for clientID, conn := range room.Connections {
		connections[clientID] = conn
	}

	m.debugLog("Retrieved %d connections from room '%s'", len(connections), roomID)

	return connections, nil
}

// CleanupEmptyRooms removes rooms that have been empty for too long
func (m *Manager) CleanupEmptyRooms(maxIdleTime time.Duration) {
	m.mutex.Lock()
	defer m.mutex.Unlock()

	m.debugLog("🧹 Starting room cleanup (max idle time: %v)", maxIdleTime)

	now := time.Now()
	cleanupCount := 0
	for roomID, room := range m.rooms {
		room.mutex.RLock()
		isEmpty := len(room.PeerConnections) == 0
		idleTooLong := now.Sub(room.LastActivity) > maxIdleTime
		idleTime := now.Sub(room.LastActivity)
		room.mutex.RUnlock()

		if isEmpty && idleTooLong {
			m.debugLog("🧹 Cleaning up empty room '%s' (Server: %s, Idle for: %v)", roomID, room.ServerID, idleTime)

			// Remove room from server mapping
			serverRooms := m.serverToRooms[room.ServerID]
			for i, id := range serverRooms {
				if id == roomID {
					m.serverToRooms[room.ServerID] = append(serverRooms[:i], serverRooms[i+1:]...)
					break
				}
			}

			delete(m.rooms, roomID)
			cleanupCount++
		} else if isEmpty {
			m.debugLog("🏠 Empty room '%s' idle for %v (threshold: %v)", roomID, idleTime, maxIdleTime)
		}
	}

	if cleanupCount > 0 {
		m.debugLog("🧹 Cleaned up %d rooms (Total remaining: %d)", cleanupCount, len(m.rooms))
		m.logRoomStats()
	} else {
		m.debugLog("🧹 No rooms needed cleanup")
	}
}

// logRoomStats logs general room statistics
func (m *Manager) logRoomStats() {
	if !m.debug {
		return
	}

	serverCount := len(m.registeredServers)
	roomCount := len(m.rooms)

	totalPeers := 0
	for _, room := range m.rooms {
		room.mutex.RLock()
		totalPeers += len(room.PeerConnections)
		room.mutex.RUnlock()
	}

	m.debugLog("📊 STATS: %d servers, %d rooms, %d total peers", serverCount, roomCount, totalPeers)
}

// logRoomDetails logs detailed information about a specific room
func (m *Manager) logRoomDetails(room *Room) {
	if !m.debug {
		return
	}

	age := time.Since(room.CreatedAt)
	idleTime := time.Since(room.LastActivity)

	m.debugLog("🏠 Room '%s': Server=%s, Peers=%d, Age=%v, LastActivity=%v ago",
		room.ID, room.ServerID, len(room.PeerConnections), age.Truncate(time.Second), idleTime.Truncate(time.Second))
}
