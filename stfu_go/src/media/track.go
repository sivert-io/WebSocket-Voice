package media

import (
	"log"
	"sync"

	"github.com/pion/webrtc/v3"
)

var (
	ListLock   sync.RWMutex
	TrackLocals = map[string]*webrtc.TrackLocalStaticRTP{}
)

func AddTrack(remoteTrack *webrtc.TrackRemote) *webrtc.TrackLocalStaticRTP {
	trackLocal, err := webrtc.NewTrackLocalStaticRTP(remoteTrack.Codec().RTPCodecCapability, remoteTrack.ID(), remoteTrack.StreamID())
	if err != nil {
		log.Printf("Error creating new track: %v", err)
		return nil
	}

	ListLock.Lock()
	TrackLocals[remoteTrack.ID()] = trackLocal
	ListLock.Unlock()

	return trackLocal
}

func RemoveTrack(track *webrtc.TrackLocalStaticRTP) {
	ListLock.Lock()
	defer ListLock.Unlock()

	if _, ok := TrackLocals[track.ID()]; ok {
		delete(TrackLocals, track.ID())
	}
}
