package room

import (
	"fmt"
	"log"
	"sync"
	"time"

	"github.com/gorilla/websocket"
	"github.com/pion/webrtc/v3"

	"sfu-v2/internal/recovery"
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
	return recovery.SafeExecuteWithContext("ROOM_MANAGER", "REGISTER_SERVER", "", roomID, fmt.Sprintf("Server: %s", serverID), func() error {
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

		// Create new room with recovery protection
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
	})
}

// ValidateClientJoin validates that a client can join a room and creates the room if it doesn't exist
func (m *Manager) ValidateClientJoin(roomID, serverID, serverToken string) error {
	return recovery.SafeExecuteWithContext("ROOM_MANAGER", "VALIDATE_CLIENT_JOIN", "", roomID, fmt.Sprintf("Server: %s", serverID), func() error {
		m.mutex.Lock() // Use Lock instead of RLock since we might need to create a room
		defer m.mutex.Unlock()

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

		// Check if room exists - if not, create it automatically
		room, exists := m.rooms[roomID]
		if !exists {
			m.debugLog("🏠 Room '%s' does not exist, creating it automatically for server '%s'", roomID, serverID)

			// Create new room automatically
			room = &Room{
				ID:              roomID,
				ServerID:        serverID,
				PeerConnections: make(map[string]*webrtc.PeerConnection),
				Connections:     make(map[string]*websocket.Conn),
				CreatedAt:       time.Now(),
				LastActivity:    time.Now(),
			}

			m.rooms[roomID] = room
			m.serverToRooms[serverID] = append(m.serverToRooms[serverID], roomID)

			m.debugLog("✅ Auto-created room '%s' for server '%s' (Total rooms: %d)", roomID, serverID, len(m.rooms))
			m.logRoomStats()
		} else {
			// Check if room belongs to the server
			if room.ServerID != serverID {
				m.debugLog("❌ Validation failed: room '%s' belongs to server '%s', not '%s'", roomID, room.ServerID, serverID)
				return fmt.Errorf("room %s does not belong to server %s", roomID, serverID)
			}
		}

		m.debugLog("✅ Client join validation passed for room '%s'", roomID)
		return nil
	})
}

// GetRoom returns a room by ID
func (m *Manager) GetRoom(roomID string) (*Room, bool) {
	var room *Room
	var exists bool

	recovery.SafeExecuteWithContext("ROOM_MANAGER", "GET_ROOM", "", roomID, "Retrieving room", func() error {
		m.mutex.RLock()
		defer m.mutex.RUnlock()
		room, exists = m.rooms[roomID]

		if m.debug {
			if exists {
				m.debugLog("Retrieved room '%s' (Server: %s, Peers: %d)", roomID, room.ServerID, len(room.PeerConnections))
			} else {
				m.debugLog("Room '%s' not found", roomID)
			}
		}
		return nil
	})

	return room, exists
}

// AddPeerToRoom adds a peer connection to a room
func (m *Manager) AddPeerToRoom(roomID, clientID string, pc *webrtc.PeerConnection, conn *websocket.Conn) error {
	return recovery.SafeExecuteWithContext("ROOM_MANAGER", "ADD_PEER", clientID, roomID, "Adding peer to room", func() error {
		m.mutex.Lock()
		defer m.mutex.Unlock()

		room, exists := m.rooms[roomID]
		if !exists {
			m.debugLog("❌ Cannot add peer '%s': room '%s' does not exist", clientID, roomID)
			return fmt.Errorf("room %s does not exist", roomID)
		}

		// Validate inputs
		if pc == nil {
			m.debugLog("❌ Cannot add peer '%s': peer connection is nil", clientID)
			return fmt.Errorf("peer connection is nil for client %s", clientID)
		}

		if conn == nil {
			m.debugLog("❌ Cannot add peer '%s': websocket connection is nil", clientID)
			return fmt.Errorf("websocket connection is nil for client %s", clientID)
		}

		// Safe room modification
		return recovery.SafeExecuteWithContext("ROOM_MANAGER", "MODIFY_ROOM", clientID, roomID, "Modifying room state", func() error {
			room.mutex.Lock()
			defer room.mutex.Unlock()

			room.PeerConnections[clientID] = pc
			room.Connections[clientID] = conn
			room.LastActivity = time.Now()

			m.debugLog("👤 Added peer '%s' to room '%s' (Total peers in room: %d)", clientID, roomID, len(room.PeerConnections))
			m.logRoomDetails(room)

			return nil
		})
	})
}

// RemovePeerFromRoom removes a peer connection from a room
func (m *Manager) RemovePeerFromRoom(roomID, clientID string) error {
	return recovery.SafeExecuteWithContext("ROOM_MANAGER", "REMOVE_PEER", clientID, roomID, "Removing peer from room", func() error {
		m.mutex.Lock()
		defer m.mutex.Unlock()

		room, exists := m.rooms[roomID]
		if !exists {
			m.debugLog("❌ Cannot remove peer '%s': room '%s' does not exist", clientID, roomID)
			return fmt.Errorf("room %s does not exist", roomID)
		}

		// Safe room modification
		return recovery.SafeExecuteWithContext("ROOM_MANAGER", "MODIFY_ROOM", clientID, roomID, "Modifying room state", func() error {
			room.mutex.Lock()
			defer room.mutex.Unlock()

			delete(room.PeerConnections, clientID)
			delete(room.Connections, clientID)
			room.LastActivity = time.Now()

			m.debugLog("👤 Removed peer '%s' from room '%s' (Remaining peers: %d)", clientID, roomID, len(room.PeerConnections))
			m.logRoomDetails(room)

			return nil
		})
	})
}

// GetPeersInRoom returns all peer connections in a room
func (m *Manager) GetPeersInRoom(roomID string) (map[string]*webrtc.PeerConnection, error) {
	var result map[string]*webrtc.PeerConnection

	err := recovery.SafeExecuteWithContext("ROOM_MANAGER", "GET_PEERS", "", roomID, "Getting peers in room", func() error {
		m.mutex.RLock()
		defer m.mutex.RUnlock()

		room, exists := m.rooms[roomID]
		if !exists {
			m.debugLog("❌ Cannot get peers: room '%s' does not exist", roomID)
			return fmt.Errorf("room %s does not exist", roomID)
		}

		// Safe room access
		return recovery.SafeExecuteWithContext("ROOM_MANAGER", "ACCESS_ROOM", "", roomID, "Accessing room state", func() error {
			room.mutex.RLock()
			defer room.mutex.RUnlock()

			// Create a copy to avoid concurrent map access
			result = make(map[string]*webrtc.PeerConnection)
			for clientID, pc := range room.PeerConnections {
				if pc != nil { // Only include non-nil peer connections
					result[clientID] = pc
				}
			}

			m.debugLog("Retrieved %d peers from room '%s'", len(result), roomID)
			return nil
		})
	})

	if err != nil {
		return nil, err
	}
	return result, nil
}

// GetConnectionsInRoom returns all WebSocket connections in a room
func (m *Manager) GetConnectionsInRoom(roomID string) (map[string]*websocket.Conn, error) {
	var result map[string]*websocket.Conn

	err := recovery.SafeExecuteWithContext("ROOM_MANAGER", "GET_CONNECTIONS", "", roomID, "Getting connections in room", func() error {
		m.mutex.RLock()
		defer m.mutex.RUnlock()

		room, exists := m.rooms[roomID]
		if !exists {
			m.debugLog("❌ Cannot get connections: room '%s' does not exist", roomID)
			return fmt.Errorf("room %s does not exist", roomID)
		}

		// Safe room access
		return recovery.SafeExecuteWithContext("ROOM_MANAGER", "ACCESS_ROOM", "", roomID, "Accessing room state", func() error {
			room.mutex.RLock()
			defer room.mutex.RUnlock()

			// Create a copy to avoid concurrent map access
			result = make(map[string]*websocket.Conn)
			for clientID, conn := range room.Connections {
				if conn != nil { // Only include non-nil connections
					result[clientID] = conn
				}
			}

			m.debugLog("Retrieved %d connections from room '%s'", len(result), roomID)
			return nil
		})
	})

	if err != nil {
		return nil, err
	}
	return result, nil
}

// CleanupEmptyRooms removes rooms that have been empty for longer than maxIdleTime
func (m *Manager) CleanupEmptyRooms(maxIdleTime time.Duration) {
	recovery.SafeExecuteWithContext("ROOM_MANAGER", "CLEANUP_ROOMS", "", "", fmt.Sprintf("Max idle: %v", maxIdleTime), func() error {
		m.mutex.Lock()
		defer m.mutex.Unlock()

		now := time.Now()
		roomsToDelete := []string{}
		serversToUpdate := map[string][]string{}

		// Find rooms to delete
		for roomID, room := range m.rooms {
			recovery.SafeExecuteWithContext("ROOM_MANAGER", "CHECK_ROOM", "", roomID, "Checking room for cleanup", func() error {
				room.mutex.RLock()
				defer room.mutex.RUnlock()

				isEmpty := len(room.PeerConnections) == 0
				isIdle := now.Sub(room.LastActivity) > maxIdleTime

				if isEmpty && isIdle {
					roomsToDelete = append(roomsToDelete, roomID)
					m.debugLog("🗑️  Room '%s' marked for deletion (empty for %v)", roomID, now.Sub(room.LastActivity))
				} else if m.debug {
					m.debugLog("🏠 Room '%s' kept (peers: %d, idle: %v)", roomID, len(room.PeerConnections), now.Sub(room.LastActivity))
				}
				return nil
			})
		}

		// Delete marked rooms
		for _, roomID := range roomsToDelete {
			recovery.SafeExecuteWithContext("ROOM_MANAGER", "DELETE_ROOM", "", roomID, "Deleting empty room", func() error {
				room := m.rooms[roomID]
				serverID := room.ServerID

				delete(m.rooms, roomID)

				// Update server-to-rooms mapping
				if rooms, exists := m.serverToRooms[serverID]; exists {
					newRooms := []string{}
					for _, rid := range rooms {
						if rid != roomID {
							newRooms = append(newRooms, rid)
						}
					}
					if len(newRooms) == 0 {
						delete(m.serverToRooms, serverID)
					} else {
						m.serverToRooms[serverID] = newRooms
					}
					serversToUpdate[serverID] = newRooms
				}

				m.debugLog("🗑️  Deleted empty room '%s' from server '%s'", roomID, serverID)
				return nil
			})
		}

		if len(roomsToDelete) > 0 {
			m.debugLog("🧹 Cleanup completed: deleted %d rooms, %d total rooms remaining", len(roomsToDelete), len(m.rooms))
			m.logRoomStats()
		}

		return nil
	})
}

// logRoomStats logs current room statistics
func (m *Manager) logRoomStats() {
	recovery.SafeExecute("ROOM_MANAGER", "LOG_STATS", func() error {
		if !m.debug {
			return nil
		}

		totalPeers := 0
		for _, room := range m.rooms {
			room.mutex.RLock()
			totalPeers += len(room.PeerConnections)
			room.mutex.RUnlock()
		}

		m.debugLog("📊 Room Stats: %d rooms, %d servers, %d total peers",
			len(m.rooms), len(m.registeredServers), totalPeers)
		return nil
	})
}

// logRoomDetails logs detailed information about a specific room
func (m *Manager) logRoomDetails(room *Room) {
	recovery.SafeExecuteWithContext("ROOM_MANAGER", "LOG_ROOM_DETAILS", "", room.ID, "Logging room details", func() error {
		if !m.debug {
			return nil
		}

		// Note: room.mutex should already be locked by caller
		m.debugLog("🏠 Room '%s' details: Server=%s, Peers=%d, Connections=%d, Created=%v, LastActivity=%v",
			room.ID, room.ServerID, len(room.PeerConnections), len(room.Connections),
			room.CreatedAt.Format("15:04:05"), room.LastActivity.Format("15:04:05"))
		return nil
	})
}
