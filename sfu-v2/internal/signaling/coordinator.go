package signaling

import (
	"fmt"
	"log"

	"github.com/pion/webrtc/v3"

	"sfu-v2/internal/recovery"
	"sfu-v2/internal/room"
	"sfu-v2/internal/track"
	peerManager "sfu-v2/internal/webrtc"
	"sfu-v2/pkg/types"
)

// Coordinator manages the signaling process between peers and tracks
type Coordinator struct {
	trackManager  *track.Manager
	webrtcManager *peerManager.Manager
	roomManager   *room.Manager
	debug         bool
}

// NewCoordinator creates a new signaling coordinator
func NewCoordinator(trackManager *track.Manager, webrtcManager *peerManager.Manager, roomManager *room.Manager, debug bool) *Coordinator {
	return &Coordinator{
		trackManager:  trackManager,
		webrtcManager: webrtcManager,
		roomManager:   roomManager,
		debug:         debug,
	}
}

// debugLog logs debug messages if debug mode is enabled
func (c *Coordinator) debugLog(format string, args ...interface{}) {
	if c.debug {
		log.Printf("[SIGNALING] "+format, args...)
	}
}

// SignalPeerConnectionsInRoom updates each peer connection in a specific room
func (c *Coordinator) SignalPeerConnectionsInRoom(roomID string) {
	recovery.SafeExecuteWithContext("SIGNALING", "SIGNAL_PEERS", "", roomID, "Starting peer signaling", func() error {
		c.debugLog("🔄 Starting peer connection signaling for room '%s'", roomID)

		// Get all peer connections in the room from room manager
		peerMap, err := c.roomManager.GetPeersInRoom(roomID)
		if err != nil {
			c.debugLog("❌ Error getting peers in room %s: %v", roomID, err)
			return err
		}

		connectionMap, err := c.roomManager.GetConnectionsInRoom(roomID)
		if err != nil {
			c.debugLog("❌ Error getting connections in room %s: %v", roomID, err)
			return err
		}

		c.debugLog("🔄 Room '%s' has %d peers and %d connections", roomID, len(peerMap), len(connectionMap))

		// If no peers, nothing to signal
		if len(peerMap) == 0 {
			c.debugLog("📭 No peers in room '%s', skipping signaling", roomID)
			return nil
		}

		// Attempt to synchronize peer connections with recovery
		attemptSync := func() (tryAgain bool) {
			return recovery.SafeExecuteWithContext("SIGNALING", "SYNC_ATTEMPT", "", roomID, "Synchronizing peers", func() error {
				// Get room-specific tracks instead of global tracks
				tracks := c.trackManager.GetTracksInRoom(roomID)
				c.debugLog("🎵 Available tracks for room '%s': %d", roomID, len(tracks))

				syncSuccess := 0
				syncErrors := 0

				for clientID, peerConnection := range peerMap {
					// Validate peer connection with nil check
					if peerConnection == nil {
						c.debugLog("⚠️ Nil peer connection for client %s, skipping", clientID)
						syncErrors++
						continue
					}

					// Check if peer connection is still valid before processing
					connectionState := peerConnection.ConnectionState()
					if connectionState == webrtc.PeerConnectionStateClosed ||
						connectionState == webrtc.PeerConnectionStateFailed {
						c.debugLog("⚠️ Skipping closed/failed peer connection for %s (state: %s)", clientID, connectionState.String())
						continue
					}

					c.debugLog("🔄 Synchronizing peer %s in room '%s' (state: %s)", clientID, roomID, connectionState.String())

					// Get the corresponding WebSocket connection with nil check
					wsConn, exists := connectionMap[clientID]
					if !exists || wsConn == nil {
						c.debugLog("❌ No WebSocket connection found for client %s", clientID)
						syncErrors++
						continue
					}

					// Process peer connection with individual recovery
					peerErr := recovery.SafeExecuteWithContext("SIGNALING", "PROCESS_PEER", clientID, roomID, "Processing individual peer", func() error {
						return c.processPeerConnection(clientID, peerConnection, wsConn, tracks, roomID)
					})

					if peerErr != nil {
						c.debugLog("❌ Error processing peer %s: %v", clientID, peerErr)
						syncErrors++
					} else {
						syncSuccess++
					}
				}

				c.debugLog("🔄 Sync attempt complete: %d successful, %d errors", syncSuccess, syncErrors)

				if syncErrors > 0 {
					return recovery.SafeExecute("SIGNALING", "SYNC_ERROR_HANDLING", func() error {
						// Return error to indicate retry needed, but don't panic
						return fmt.Errorf("sync had %d errors out of %d peers", syncErrors, len(peerMap))
					})
				}

				return nil
			}) != nil // Convert error to boolean for tryAgain
		}

		// Reduced retry attempts to prevent excessive load during rapid connect/disconnect
		c.debugLog("🔄 Starting synchronization attempts for room '%s'", roomID)
		for syncAttempt := 0; syncAttempt < 10; syncAttempt++ { // Reduced from 25 to 10
			c.debugLog("🔄 Sync attempt %d/10 for room '%s'", syncAttempt+1, roomID)
			if !attemptSync() {
				c.debugLog("✅ Synchronization successful for room '%s' after %d attempts", roomID, syncAttempt+1)
				break
			}
			if syncAttempt == 9 { // Reduced from 24 to 9
				c.debugLog("⚠️  Max sync attempts reached for room '%s', giving up to prevent server overload", roomID)
				// Don't schedule retry to prevent cascading failures during rapid connect/disconnect
				return nil
			}
		}

		// Dispatch keyframe after successful sync - now room-specific with recovery
		recovery.SafeExecuteWithContext("SIGNALING", "DISPATCH_KEYFRAME", "", roomID, "Dispatching keyframe", func() error {
			c.debugLog("🔑 Dispatching keyframe for room '%s'", roomID)
			c.webrtcManager.DispatchKeyFrameToRoom(roomID)
			return nil
		})

		c.debugLog("✅ Peer connection signaling completed for room '%s'", roomID)
		return nil
	})
}

// processPeerConnection handles the signaling for a single peer connection
func (c *Coordinator) processPeerConnection(clientID string, peerConnection *webrtc.PeerConnection, wsConn interface{}, tracks map[string]*webrtc.TrackLocalStaticRTP, roomID string) error {
	// Map of senders we are already using to avoid duplicates
	existingSenders := map[string]bool{}
	senderCount := 0

	// Check existing senders with nil protection
	senders := peerConnection.GetSenders()
	if senders != nil {
		for _, sender := range senders {
			if sender == nil || sender.Track() == nil {
				continue
			}

			senderCount++
			existingSenders[sender.Track().ID()] = true

			// If a sender's track is not in our list of room tracks, remove it
			if _, ok := tracks[sender.Track().ID()]; !ok {
				c.debugLog("🗑️  Removing obsolete sender track %s from peer %s", sender.Track().ID(), clientID)
				if err := peerConnection.RemoveTrack(sender); err != nil {
					c.debugLog("❌ Error removing sender track: %v", err)
					return err
				}
			}
		}
	}

	// Avoid receiving tracks we are sending to prevent loopback
	receiverCount := 0
	receivers := peerConnection.GetReceivers()
	if receivers != nil {
		for _, receiver := range receivers {
			if receiver == nil || receiver.Track() == nil {
				continue
			}
			receiverCount++
			existingSenders[receiver.Track().ID()] = true
		}
	}

	c.debugLog("🔗 Peer %s has %d senders, %d receivers", clientID, senderCount, receiverCount)

	// Add any missing local tracks to the peer connection
	tracksAdded := 0
	for trackID, localTrack := range tracks {
		if localTrack == nil {
			c.debugLog("⚠️ Nil track found for ID %s, skipping", trackID)
			continue
		}

		if _, ok := existingSenders[trackID]; !ok {
			c.debugLog("➕ Adding track %s to peer %s", trackID, clientID)
			if _, err := peerConnection.AddTrack(localTrack); err != nil {
				c.debugLog("❌ Error adding track to peer connection: %v", err)
				return err
			}
			tracksAdded++
			c.debugLog("✅ Added track to peer connection in room %s: ID=%s", roomID, trackID)
		}
	}

	if tracksAdded > 0 {
		c.debugLog("➕ Added %d tracks to peer %s", tracksAdded, clientID)
	}

	// Check if the signaling state allows for creating a new offer
	signalingState := peerConnection.SignalingState()
	c.debugLog("🔗 Peer %s signaling state: %s", clientID, signalingState.String())

	if signalingState != webrtc.SignalingStateStable {
		c.debugLog("⏳ Cannot create offer for %s, signaling state: %v", clientID, signalingState)
		return nil // Not an error, just can't create offer right now
	}

	// Create and send an offer to the peer to update the connection state
	c.debugLog("📤 Creating offer for peer %s", clientID)
	offer, err := peerConnection.CreateOffer(nil)
	if err != nil {
		c.debugLog("❌ Error creating offer for %s: %v", clientID, err)
		return err
	}

	if err = peerConnection.SetLocalDescription(offer); err != nil {
		c.debugLog("❌ Error setting local description for %s: %v", clientID, err)
		return err
	}

	// Safe JSON marshaling
	offerString, err := recovery.SafeJSONMarshal(offer)
	if err != nil {
		c.debugLog("❌ Error marshalling offer for %s: %v", clientID, err)
		return err
	}

	c.debugLog("📤 Sending offer to peer %s (%d bytes)", clientID, len(offerString))

	// Send message with type assertion and nil check
	return recovery.SafeExecuteWithContext("SIGNALING", "SEND_OFFER", clientID, roomID, "Sending WebRTC offer", func() error {
		// Type assert the WebSocket connection
		if conn, ok := wsConn.(interface{ WriteJSON(interface{}) error }); ok && conn != nil {
			return conn.WriteJSON(&types.WebSocketMessage{
				Event: types.EventOffer,
				Data:  string(offerString),
			})
		}
		return fmt.Errorf("invalid WebSocket connection type for client %s", clientID)
	})
}

// OnTrackAddedToRoom should be called when a new track is added to a room
func (c *Coordinator) OnTrackAddedToRoom(roomID string) {
	recovery.SafeExecuteWithContext("SIGNALING", "TRACK_ADDED", "", roomID, "Track added to room", func() error {
		c.debugLog("🎵 Track added to room '%s', triggering signaling", roomID)
		c.SignalPeerConnectionsInRoom(roomID)
		return nil
	})
}

// OnTrackRemovedFromRoom should be called when a track is removed from a room
func (c *Coordinator) OnTrackRemovedFromRoom(roomID string) {
	recovery.SafeExecuteWithContext("SIGNALING", "TRACK_REMOVED", "", roomID, "Track removed from room", func() error {
		c.debugLog("🎵 Track removed from room '%s', triggering signaling", roomID)
		c.SignalPeerConnectionsInRoom(roomID)
		return nil
	})
}

// Legacy methods for backward compatibility (deprecated)
func (c *Coordinator) SignalPeerConnections() {
	recovery.SafeExecute("SIGNALING", "LEGACY_SIGNAL", func() error {
		c.debugLog("⚠️  Warning: SignalPeerConnections() is deprecated, use SignalPeerConnectionsInRoom() instead")
		return nil
	})
}

func (c *Coordinator) OnTrackAdded() {
	recovery.SafeExecute("SIGNALING", "LEGACY_TRACK_ADDED", func() error {
		c.debugLog("⚠️  Warning: OnTrackAdded() is deprecated, use OnTrackAddedToRoom() instead")
		return nil
	})
}

func (c *Coordinator) OnTrackRemoved() {
	recovery.SafeExecute("SIGNALING", "LEGACY_TRACK_REMOVED", func() error {
		c.debugLog("⚠️  Warning: OnTrackRemoved() is deprecated, use OnTrackRemovedFromRoom() instead")
		return nil
	})
}
