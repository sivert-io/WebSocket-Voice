package utils

import (
	"encoding/json"
	"sync"

	"github.com/gorilla/websocket"
	"github.com/pion/webrtc/v3"
)

type WebsocketMessage struct {
	Event string `json:"event"`
	Data  string `json:"data"`
}

type ThreadSafeWriter struct {
	Conn *websocket.Conn
	mu   sync.Mutex
}

func (t *ThreadSafeWriter) WriteJSON(v interface{}) error {
	t.mu.Lock()
	defer t.mu.Unlock()
	return t.Conn.WriteJSON(v)
}

func (t *ThreadSafeWriter) ReadMessage() (messageType int, p []byte, err error) {
	t.mu.Lock()
	defer t.mu.Unlock()
	return t.Conn.ReadMessage()
}

func (t *ThreadSafeWriter) WriteMessage(messageType int, data []byte) error {
	t.mu.Lock()
	defer t.mu.Unlock()
	return t.Conn.WriteMessage(messageType, data)
}

func (t *ThreadSafeWriter) Close() error {
	t.mu.Lock()
	defer t.mu.Unlock()
	return t.Conn.Close()
}

type PeerConnectionState struct {
	PeerConnection *webrtc.PeerConnection
	WebSocket      *ThreadSafeWriter
}

func MarshalJSON(v interface{}) ([]byte, error) {
	return json.Marshal(v)
}
