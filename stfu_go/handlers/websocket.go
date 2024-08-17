package handlers

import (
	"encoding/json"
	"log"
	"net/http"
	"os"
	"strings"

	"github.com/gorilla/websocket"
	"github.com/pion/webrtc/v3"
	"sfu/media"
	"sfu/signaling"
	"sfu/utils"
)

var upgrader = websocket.Upgrader{
	CheckOrigin: func(r *http.Request) bool { return true },
}

func WebsocketHandler(w http.ResponseWriter, r *http.Request) {
	unsafeConn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Printf("WebSocket upgrade error: %v", err)
		return
	}

	safeConn := &utils.ThreadSafeWriter{Conn: unsafeConn}

	defer safeConn.Close()

	stunServers := strings.Split(os.Getenv("STUN_SERVERS"), ",")

	iceServers := []webrtc.ICEServer{
		{
			URLs: stunServers,
		},
	}

	config := webrtc.Configuration{
		ICEServers: iceServers,
	}

	peerConnection, err := webrtc.NewPeerConnection(config)
	if err != nil {
		log.Printf("Error creating WebRTC peer connection: %v", err)
		return
	}

	defer peerConnection.Close()

	for _, typ := range []webrtc.RTPCodecType{webrtc.RTPCodecTypeVideo, webrtc.RTPCodecTypeAudio} {
		if _, err := peerConnection.AddTransceiverFromKind(typ, webrtc.RTPTransceiverInit{
			Direction: webrtc.RTPTransceiverDirectionRecvonly,
		}); err != nil {
			log.Printf("Error adding transceiver: %v", err)
			return
		}
	}

	signaling.AddPeerConnection(peerConnection, safeConn)

	peerConnection.OnICECandidate(func(i *webrtc.ICECandidate) {
		if i == nil {
			return
		}

		candidateString, err := json.Marshal(i.ToJSON())
		if err != nil {
			log.Printf("Error marshalling ICE candidate: %v", err)
			return
		}

		if writeErr := safeConn.WriteJSON(&utils.WebsocketMessage{
			Event: "candidate",
			Data:  string(candidateString),
		}); writeErr != nil {
			log.Printf("Error sending candidate JSON: %v", writeErr)
		}
	})

	peerConnection.OnConnectionStateChange(func(p webrtc.PeerConnectionState) {
		if p == webrtc.PeerConnectionStateFailed || p == webrtc.PeerConnectionStateClosed {
			_ = peerConnection.Close()
			signaling.SignalPeerConnections()
		}
	})

	peerConnection.OnTrack(func(t *webrtc.TrackRemote, _ *webrtc.RTPReceiver) {
		trackLocal := media.AddTrack(t)
		defer media.RemoveTrack(trackLocal)

		buf := make([]byte, 1500)
		for {
			i, _, err := t.Read(buf)
			if err != nil {
				return
			}

			if _, err = trackLocal.Write(buf[:i]); err != nil {
				return
			}
		}
	})

	signaling.SignalPeerConnections()

	message := &utils.WebsocketMessage{}
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
