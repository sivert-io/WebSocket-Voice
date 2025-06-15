package signaling

import (
	"encoding/json"
	"log"
	"time"

	"github.com/pion/webrtc/v3"

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
	c.debugLog("🔄 Starting peer connection signaling for room '%s'", roomID)

	// Get all peer connections in the room from room manager
	peerMap, err := c.roomManager.GetPeersInRoom(roomID)
	if err != nil {
		c.debugLog("❌ Error getting peers in room %s: %v", roomID, err)
		return
	}

	connectionMap, err := c.roomManager.GetConnectionsInRoom(roomID)
	if err != nil {
		c.debugLog("❌ Error getting connections in room %s: %v", roomID, err)
		return
	}

	c.debugLog("🔄 Room '%s' has %d peers and %d connections", roomID, len(peerMap), len(connectionMap))

	// Attempt to synchronize peer connections
	attemptSync := func() (tryAgain bool) {
		// Get room-specific tracks instead of global tracks
		tracks := c.trackManager.GetTracksInRoom(roomID)
		c.debugLog("🎵 Available tracks for room '%s': %d", roomID, len(tracks))

		syncSuccess := 0
		syncErrors := 0

		for clientID, peerConnection := range peerMap {
			c.debugLog("🔄 Synchronizing peer %s in room '%s'", clientID, roomID)

			// Get the corresponding WebSocket connection
			wsConn, exists := connectionMap[clientID]
			if !exists {
				c.debugLog("❌ No WebSocket connection found for client %s", clientID)
				syncErrors++
				continue
			}

			// Map of senders we are already using to avoid duplicates
			existingSenders := map[string]bool{}
			senderCount := 0

			// Check existing senders
			for _, sender := range peerConnection.GetSenders() {
				if sender.Track() == nil {
					continue
				}

				senderCount++
				existingSenders[sender.Track().ID()] = true

				// If a sender's track is not in our list of room tracks, remove it
				if _, ok := tracks[sender.Track().ID()]; !ok {
					c.debugLog("🗑️  Removing obsolete sender track %s from peer %s", sender.Track().ID(), clientID)
					if err := peerConnection.RemoveTrack(sender); err != nil {
						c.debugLog("❌ Error removing sender track: %v", err)
						syncErrors++
						return true
					}
				}
			}

			// Avoid receiving tracks we are sending to prevent loopback
			receiverCount := 0
			for _, receiver := range peerConnection.GetReceivers() {
				if receiver.Track() == nil {
					continue
				}
				receiverCount++
				existingSenders[receiver.Track().ID()] = true
			}

			c.debugLog("🔗 Peer %s has %d senders, %d receivers", clientID, senderCount, receiverCount)

			// Add any missing local tracks to the peer connection
			tracksAdded := 0
			for trackID, localTrack := range tracks {
				if _, ok := existingSenders[trackID]; !ok {
					c.debugLog("➕ Adding track %s to peer %s", trackID, clientID)
					if _, err := peerConnection.AddTrack(localTrack); err != nil {
						c.debugLog("❌ Error adding track to peer connection: %v", err)
						syncErrors++
						return true
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
				continue
			}

			// Create and send an offer to the peer to update the connection state
			c.debugLog("📤 Creating offer for peer %s", clientID)
			offer, err := peerConnection.CreateOffer(nil)
			if err != nil {
				c.debugLog("❌ Error creating offer for %s: %v", clientID, err)
				syncErrors++
				return true
			}

			if err = peerConnection.SetLocalDescription(offer); err != nil {
				c.debugLog("❌ Error setting local description for %s: %v", clientID, err)
				syncErrors++
				return true
			}

			offerString, err := json.Marshal(offer)
			if err != nil {
				c.debugLog("❌ Error marshalling offer for %s: %v", clientID, err)
				syncErrors++
				return true
			}

			c.debugLog("📤 Sending offer to peer %s (%d bytes)", clientID, len(offerString))
			if err = wsConn.WriteJSON(&types.WebSocketMessage{
				Event: types.EventOffer,
				Data:  string(offerString),
			}); err != nil {
				c.debugLog("❌ Error sending offer JSON to %s: %v", clientID, err)
				syncErrors++
				return true
			}

			syncSuccess++
		}

		c.debugLog("🔄 Sync attempt complete: %d successful, %d errors", syncSuccess, syncErrors)
		return syncErrors > 0
	}

	// Attempt synchronization up to 25 times
	c.debugLog("🔄 Starting synchronization attempts for room '%s'", roomID)
	for syncAttempt := 0; syncAttempt < 25; syncAttempt++ {
		c.debugLog("🔄 Sync attempt %d/25 for room '%s'", syncAttempt+1, roomID)
		if !attemptSync() {
			c.debugLog("✅ Synchronization successful for room '%s' after %d attempts", roomID, syncAttempt+1)
			break
		}
		if syncAttempt == 24 {
			c.debugLog("⚠️  Max sync attempts reached for room '%s', scheduling retry in 3 seconds", roomID)
			// If we've tried 25 times, retry in 3 seconds
			go func() {
				time.Sleep(time.Second * 3)
				c.debugLog("🔄 Retrying synchronization for room '%s' after delay", roomID)
				c.SignalPeerConnectionsInRoom(roomID)
			}()
			return
		}
	}

	// Dispatch keyframe after successful sync - now room-specific
	c.debugLog("🔑 Dispatching keyframe for room '%s'", roomID)
	c.webrtcManager.DispatchKeyFrameToRoom(roomID)

	c.debugLog("✅ Peer connection signaling completed for room '%s'", roomID)
}

// OnTrackAddedToRoom should be called when a new track is added to a room
func (c *Coordinator) OnTrackAddedToRoom(roomID string) {
	c.debugLog("🎵 Track added to room '%s', triggering signaling", roomID)
	c.SignalPeerConnectionsInRoom(roomID)
}

// OnTrackRemovedFromRoom should be called when a track is removed from a room
func (c *Coordinator) OnTrackRemovedFromRoom(roomID string) {
	c.debugLog("🎵 Track removed from room '%s', triggering signaling", roomID)
	c.SignalPeerConnectionsInRoom(roomID)
}

// Legacy methods for backward compatibility (deprecated)
func (c *Coordinator) SignalPeerConnections() {
	c.debugLog("⚠️  Warning: SignalPeerConnections() is deprecated, use SignalPeerConnectionsInRoom() instead")
}

func (c *Coordinator) OnTrackAdded() {
	c.debugLog("⚠️  Warning: OnTrackAdded() is deprecated, use OnTrackAddedToRoom() instead")
}

func (c *Coordinator) OnTrackRemoved() {
	c.debugLog("⚠️  Warning: OnTrackRemoved() is deprecated, use OnTrackRemovedFromRoom() instead")
}
