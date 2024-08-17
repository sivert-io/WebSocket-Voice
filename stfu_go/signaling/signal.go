package signaling

import (
	"log"
	"sync"
	"time"

	"github.com/pion/rtcp"
	"github.com/pion/webrtc/v3"
	"sfu/media"
	"sfu/utils"
)

var (
	ListLock        sync.RWMutex
	peerConnections []utils.PeerConnectionState
)

func StartKeyFrameDispatcher() {
	go func() {
		for range time.NewTicker(time.Second * 3).C {
			dispatchKeyFrame()
		}
	}()
}

func dispatchKeyFrame() {
	ListLock.Lock()
	defer ListLock.Unlock()

	for i := range peerConnections {
		for _, receiver := range peerConnections[i].PeerConnection.GetReceivers() {
			if receiver.Track() == nil {
				continue
			}

			_ = peerConnections[i].PeerConnection.WriteRTCP([]rtcp.Packet{
				&rtcp.PictureLossIndication{
					MediaSSRC: uint32(receiver.Track().SSRC()),
				},
			})
		}
	}
}

func SignalPeerConnections() {
	ListLock.Lock()
	defer ListLock.Unlock()
	dispatchKeyFrame()

	for i := range peerConnections {
		if peerConnections[i].PeerConnection.ConnectionState() == webrtc.PeerConnectionStateClosed {
			log.Printf("Removing closed peer connection")
			peerConnections = append(peerConnections[:i], peerConnections[i+1:]...)
			i--
			continue
		}

		existingSenders := map[string]bool{}
		for _, sender := range peerConnections[i].PeerConnection.GetSenders() {
			if sender.Track() == nil {
				continue
			}

			existingSenders[sender.Track().ID()] = true

			if _, ok := media.TrackLocals[sender.Track().ID()]; !ok {
				if err := peerConnections[i].PeerConnection.RemoveTrack(sender); err != nil {
					log.Printf("Error removing sender track: %v", err)
				}
			}
		}

		for _, receiver := range peerConnections[i].PeerConnection.GetReceivers() {
			if receiver.Track() == nil {
				continue
			}

			existingSenders[receiver.Track().ID()] = true
		}

		for trackID := range media.TrackLocals {
			if _, ok := existingSenders[trackID]; !ok {
				if _, err := peerConnections[i].PeerConnection.AddTrack(media.TrackLocals[trackID]); err != nil {
					log.Printf("Error adding track to peer connection: %v", err)
				}
			}
		}

		if peerConnections[i].PeerConnection.SignalingState() != webrtc.SignalingStateStable {
			log.Printf("Cannot create offer, signaling state: %v", peerConnections[i].PeerConnection.SignalingState())
			continue
		}

		offer, err := peerConnections[i].PeerConnection.CreateOffer(nil)
		if err != nil {
			log.Printf("Error creating offer: %v", err)
			continue
		}

		if err = peerConnections[i].PeerConnection.SetLocalDescription(offer); err != nil {
			log.Printf("Error setting local description: %v", err)
			continue
		}

		offerString, err := utils.MarshalJSON(offer)
		if err != nil {
			log.Printf("Error marshalling offer: %v", err)
			continue
		}

		if err = peerConnections[i].WebSocket.WriteJSON(&utils.WebsocketMessage{
			Event: "offer",
			Data:  string(offerString),
		}); err != nil {
			log.Printf("Error sending offer JSON: %v", err)
		}
	}
}

func AddPeerConnection(pc *webrtc.PeerConnection, ws *utils.ThreadSafeWriter) {
	ListLock.Lock()
	defer ListLock.Unlock()
	peerConnections = append(peerConnections, utils.PeerConnectionState{PeerConnection: pc, WebSocket: ws})
}
