// sfu-ws is a many-to-many websocket based SFU (Selective Forwarding Unit)
package main

import (
	"encoding/json"
	"flag"
	"log"
	"net/http"
	"sync"
	"time"
	"strings"
	"os"

	"github.com/joho/godotenv"
	"github.com/gorilla/websocket"
	"github.com/pion/rtcp"
	"github.com/pion/webrtc/v3"
)

// nolint
var (
	upgrader = websocket.Upgrader{
		// Allow all origins to connect. In a production app, you should limit this to your allowed origins.
		CheckOrigin: func(r *http.Request) bool { return true },
	}

	// Mutex to safely access shared data structures from multiple goroutines
	listLock        sync.RWMutex
	peerConnections []peerConnectionState
	trackLocals     map[string]*webrtc.TrackLocalStaticRTP
)

// Structure for WebSocket messages
type websocketMessage struct {
	Event string `json:"event"`
	Data  string `json:"data"`
}

// Structure to hold peer connection and WebSocket connection
type peerConnectionState struct {
	peerConnection *webrtc.PeerConnection
	websocket      *threadSafeWriter
}

func main() {
	err := godotenv.Load()
	if err != nil {
	  log.Fatal("Error loading .env file")
	}

	// Parse command-line flags
	flag.Parse()

	// Set logging options
	log.SetFlags(log.LstdFlags | log.Lshortfile)

	// Initialize map for track locals
	trackLocals = make(map[string]*webrtc.TrackLocalStaticRTP)

	// Handle WebSocket connections at the root URL
	http.HandleFunc("/", websocketHandler)

	// Periodically request keyframes to ensure good video quality
	go func() {
		for range time.NewTicker(time.Second * 3).C {
			dispatchKeyFrame()
		}
	}()

	port := os.Getenv("PORT")
	if port == "" {
		port = "5005"
	}

	// Start the HTTP server
	log.Fatal(http.ListenAndServe(":" + port, nil)) // nolint:gosec
}

// addTrack adds a new media track to the list of local tracks and triggers a renegotiation
// e.g. A user starts streaming their video or audio
func addTrack(t *webrtc.TrackRemote) *webrtc.TrackLocalStaticRTP {
	listLock.Lock()
	defer func() {
		listLock.Unlock()
		signalPeerConnections()
	}()

	// Create a new local track with the same codec as the incoming remote track
	trackLocal, err := webrtc.NewTrackLocalStaticRTP(t.Codec().RTPCodecCapability, t.ID(), t.StreamID())
	if err != nil {
		log.Printf("Error creating local track: %v", err)
		return nil
	}

	// Store the local track in the map
	trackLocals[t.ID()] = trackLocal
	log.Printf("Added track: ID=%s, StreamID=%s", t.ID(), t.StreamID())
	return trackLocal
}

// removeTrack removes a media track from the list of local tracks and triggers a renegotiation
// e.g. A user stops streaming their video or audio
func removeTrack(t *webrtc.TrackLocalStaticRTP) {
	listLock.Lock()
	defer func() {
		listLock.Unlock()
		signalPeerConnections()
	}()

	// Check if the track exists in trackLocals map
	if t == nil || trackLocals[t.ID()] == nil {
		log.Printf("Error: track or track ID not found")
		return
	}

	// Remove the track from the map
	delete(trackLocals, t.ID())
	log.Printf("Removed track: ID=%s", t.ID())
}

// signalPeerConnections updates each peer connection so that it sends/receives the correct media tracks
// e.g. When a new track is added or removed, update all peer connections to reflect this change
func signalPeerConnections() {
	listLock.Lock()
	defer func() {
		listLock.Unlock()
		dispatchKeyFrame()
	}()

	// Attempt to synchronize peer connections
	attemptSync := func() (tryAgain bool) {
		for i := range peerConnections {
			// Remove closed peer connections
			log.Printf("Peer connection state: %v", peerConnections[i].peerConnection.ConnectionState())
			if peerConnections[i].peerConnection.ConnectionState() == webrtc.PeerConnectionStateClosed {
				log.Printf("Removing closed peer connection")
				peerConnections = append(peerConnections[:i], peerConnections[i+1:]...)
				return true // Restart the loop since we modified the slice
			}

			// Map of senders we are already using to avoid duplicates
			existingSenders := map[string]bool{}

			// Check existing senders
			for _, sender := range peerConnections[i].peerConnection.GetSenders() {
				if sender.Track() == nil {
					continue
				}

				existingSenders[sender.Track().ID()] = true

				// If a sender's track is not in our list of local tracks, remove it
				if _, ok := trackLocals[sender.Track().ID()]; !ok {
					if err := peerConnections[i].peerConnection.RemoveTrack(sender); err != nil {
						log.Printf("Error removing sender track: %v", err)
						return true
					}
					// log.Printf("Removed sender track: ID=%s", sender.Track().ID())
				}
			}

			// Avoid receiving tracks we are sending to prevent loopback
			for _, receiver := range peerConnections[i].peerConnection.GetReceivers() {
				if receiver.Track() == nil {
					continue
				}

				existingSenders[receiver.Track().ID()] = true
			}

			// Add any missing local tracks to the peer connection
			for trackID := range trackLocals {
				if _, ok := existingSenders[trackID]; !ok {
					if _, err := peerConnections[i].peerConnection.AddTrack(trackLocals[trackID]); err != nil {
						log.Printf("Error adding track to peer connection: %v", err)
						return true
					}
					log.Printf("Added track to peer connection: ID=%s", trackID)
				}
			}

			// Check if the signaling state allows for creating a new offer
			if peerConnections[i].peerConnection.SignalingState() != webrtc.SignalingStateStable {
				log.Printf("Cannot create offer, signaling state: %v", peerConnections[i].peerConnection.SignalingState())
				continue
			}


			// Create and send an offer to the peer to update the connection state
			offer, err := peerConnections[i].peerConnection.CreateOffer(nil)
			if err != nil {
				log.Printf("Error creating offer: %v", err)
				return true
			}

			if err = peerConnections[i].peerConnection.SetLocalDescription(offer); err != nil {
				log.Printf("Error setting local description: %v", err)
				return true
			}

			offerString, err := json.Marshal(offer)
			if err != nil {
				log.Printf("Error marshalling offer: %v", err)
				return true
			}

			if err = peerConnections[i].websocket.WriteJSON(&websocketMessage{
				Event: "offer",
				Data:  string(offerString),
			}); err != nil {
				log.Printf("Error sending offer JSON: %v", err)
				return true
			}
		}

		return
	}

	// Attempt synchronization up to 25 times
	for syncAttempt := 0; ; syncAttempt++ {
		if syncAttempt == 25 {
			// If we've tried 25 times, release the lock and try again in 3 seconds
			go func() {
				time.Sleep(time.Second * 3)
				signalPeerConnections()
			}()
			return
		}

		if !attemptSync() {
			break
		}
	}
}

// dispatchKeyFrame sends a keyframe request to all peer connections
// e.g. When a new user joins, request keyframes to quickly establish video quality
func dispatchKeyFrame() {
	listLock.Lock()
	defer listLock.Unlock()

	// Loop through all peer connections
	for i := range peerConnections {
		for _, receiver := range peerConnections[i].peerConnection.GetReceivers() {
			if receiver.Track() == nil {
				continue
			}

			// Send a Picture Loss Indication (PLI) to request a keyframe
			_ = peerConnections[i].peerConnection.WriteRTCP([]rtcp.Packet{
				&rtcp.PictureLossIndication{
					MediaSSRC: uint32(receiver.Track().SSRC()),
				},
			})
			// log.Printf("Dispatched keyframe for SSRC=%d", receiver.Track().SSRC())
		}
	}
}

// websocketHandler handles incoming WebSocket connections
func websocketHandler(w http.ResponseWriter, r *http.Request) {
	// TODO: Validate JWT and check that it has access to the room

	// Upgrade the HTTP request to a WebSocket connection
	unsafeConn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Printf("WebSocket upgrade error: %v", err)
		return
	}

	safeConn := &threadSafeWriter{unsafeConn, sync.Mutex{}}

	// When this function exits, close the WebSocket
	defer safeConn.Close()

	stunServers := strings.Split(os.Getenv("STUN_SERVERS"), ",")

	// Define STUN and TURN servers
	iceServers := []webrtc.ICEServer{
		{
			URLs: stunServers,
		},
	}

	// Create a new peer connection configuration with the ICE servers
	config := webrtc.Configuration{
		ICEServers: iceServers,
	}

	// Create a new WebRTC peer connection
	peerConnection, err := webrtc.NewPeerConnection(config)
	if err != nil {
		log.Printf("Error creating WebRTC peer connection: %v", err)
		return
	}

	// When this function exits, close the peer connection
	defer peerConnection.Close()

	// Prepare to receive both audio and video tracks from clients
	for _, typ := range []webrtc.RTPCodecType{webrtc.RTPCodecTypeVideo, webrtc.RTPCodecTypeAudio} {
		if _, err := peerConnection.AddTransceiverFromKind(typ, webrtc.RTPTransceiverInit{
			Direction: webrtc.RTPTransceiverDirectionRecvonly,
		}); err != nil {
			log.Printf("Error adding transceiver: %v", err)
			return
		}
	}

	// Add this new client connection to the list of peer connections
	listLock.Lock()
	peerConnections = append(peerConnections, peerConnectionState{peerConnection, safeConn})
	listLock.Unlock()

	// Trickle ICE. Emit server candidate to client
	peerConnection.OnICECandidate(func(i *webrtc.ICECandidate) {
		if i == nil {
			return
		}

		candidateString, err := json.Marshal(i.ToJSON())
		if err != nil {
			log.Printf("Error marshalling ICE candidate: %v", err)
			return
		}

		if writeErr := safeConn.WriteJSON(&websocketMessage{
			Event: "candidate",
			Data:  string(candidateString),
		}); writeErr != nil {
			log.Printf("Error sending candidate JSON: %v", writeErr)
		}
	})

	// If the peer connection state changes, handle it
	peerConnection.OnConnectionStateChange(func(p webrtc.PeerConnectionState) {
		switch p {
		case webrtc.PeerConnectionStateFailed:
			if err := peerConnection.Close(); err != nil {
				log.Printf("Peer connection failed to close: %v", err)
			}
		case webrtc.PeerConnectionStateClosed:
			signalPeerConnections()
		default:
		}
	})

	// When a new track is received, add it to the list and start forwarding data
	peerConnection.OnTrack(func(t *webrtc.TrackRemote, _ *webrtc.RTPReceiver) {
		// Create a local track to forward the incoming track
		trackLocal := addTrack(t)
		defer removeTrack(trackLocal)

		buf := make([]byte, 1500)
		for {
			// Continuously read data from the remote track and send it to the local track
			i, _, err := t.Read(buf)
			if err != nil {
				return
			}

			if _, err = trackLocal.Write(buf[:i]); err != nil {
				return
			}
		}
	})

	// Signal the new peer connection to start the negotiation process
	signalPeerConnections()

	// Handle incoming WebSocket messages from the client
	message := &websocketMessage{}
	for {
		_, raw, err := safeConn.ReadMessage()
		if err != nil {
			if websocket.IsCloseError(err, websocket.CloseGoingAway, websocket.CloseNormalClosure) {
				log.Printf("WebSocket closed: %v", err)
				break
			}

			log.Printf("Error reading WebSocket message: %v", err)
			return
		} else if err := json.Unmarshal(raw, &message); err != nil {
			log.Printf("Error unmarshalling WebSocket message: %v", err)
			return
		}

		// log.Printf("Event ID: %v", message.Event)
		// log.Printf("Event Data: %v", message.Data)

		switch message.Event {
		case "candidate":
			candidate := webrtc.ICECandidateInit{}
			if err := json.Unmarshal([]byte(message.Data), &candidate); err != nil {
				log.Printf("Error unmarshalling ICE candidate: %v", err)
				return
			}

			if err := peerConnection.AddICECandidate(candidate); err != nil {
				log.Printf("Error adding ICE candidate: %v", err)
				return
			}
		case "answer":
			answer := webrtc.SessionDescription{}
			if err := json.Unmarshal([]byte(message.Data), &answer); err != nil {
				log.Printf("Error unmarshalling answer: %v", err)
				return
			}

			if err := peerConnection.SetRemoteDescription(answer); err != nil {
				log.Printf("Error setting remote description: %v", err)
				return
			}
		}
	}
}

// threadSafeWriter wraps a WebSocket connection with a mutex to ensure safe concurrent access
type threadSafeWriter struct {
	*websocket.Conn
	sync.Mutex
}

// WriteJSON writes a JSON message to the WebSocket connection in a thread-safe manner
func (t *threadSafeWriter) WriteJSON(v interface{}) error {
	t.Lock()
	defer t.Unlock()
	return t.Conn.WriteJSON(v)
}
