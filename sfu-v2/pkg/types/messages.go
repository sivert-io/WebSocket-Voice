package types

// WebSocketMessage represents the structure for WebSocket messages
type WebSocketMessage struct {
	Event string `json:"event"`
	Data  string `json:"data"`
}

// ServerRegistrationData represents server registration information
type ServerRegistrationData struct {
	ServerID    string `json:"server_id"`
	ServerToken string `json:"server_token"`
	RoomID      string `json:"room_id"`
}

// ClientJoinData represents client join information
type ClientJoinData struct {
	RoomID      string `json:"room_id"`
	ServerID    string `json:"server_id"`
	ServerToken string `json:"server_token"`
	UserToken   string `json:"user_token"`
}

// Supported WebSocket message events
const (
	EventOffer          = "offer"
	EventAnswer         = "answer"
	EventCandidate      = "candidate"
	EventServerRegister = "server_register"
	EventClientJoin     = "client_join"
	EventRoomJoined     = "room_joined"
	EventRoomError      = "room_error"
	EventKeepAlive      = "keep_alive"
)
