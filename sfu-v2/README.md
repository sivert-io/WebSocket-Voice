# SFU v2 - Refactored WebRTC Selective Forwarding Unit

This is a refactored version of the original monolithic SFU, now organized into multiple packages for better maintainability and extensibility.

## Project Structure

```
sfu-v2/
├── cmd/sfu/                    # Main application entry point
│   └── main.go
├── internal/                   # Private application packages
│   ├── config/                 # Configuration management
│   │   └── config.go
│   ├── websocket/              # WebSocket connection handling
│   │   ├── connection.go       # Thread-safe WebSocket wrapper
│   │   └── handler.go          # WebSocket message handling
│   ├── webrtc/                 # WebRTC peer connection management
│   │   └── peer.go
│   ├── track/                  # Media track lifecycle management
│   │   └── manager.go
│   └── signaling/              # WebRTC signaling coordination
│       └── coordinator.go
├── pkg/types/                  # Public shared types
│   └── messages.go             # WebSocket message structures
├── go.mod                      # Go module definition
├── env.example                 # Example environment variables
└── README.md
```

## Package Responsibilities

### `cmd/sfu`
- Main application entry point
- Coordinates all components
- Sets up HTTP server and routing

### `internal/config`
- Loads environment variables
- Manages STUN/TURN server configuration
- Provides configuration to other packages

### `internal/websocket`
- Handles WebSocket upgrades and connections
- Provides thread-safe WebSocket operations
- Processes incoming WebSocket messages
- Manages connection lifecycle

### `internal/webrtc`
- Manages WebRTC peer connections
- Handles ICE candidate exchange
- Coordinates keyframe requests
- Tracks connection states

### `internal/track`
- Manages media track lifecycle
- Handles track addition/removal
- Provides thread-safe track access
- Coordinates track forwarding between peers

### `internal/signaling`
- Coordinates WebRTC signaling between peers
- Manages offer/answer exchange
- Synchronizes tracks across peer connections
- Handles renegotiation logic

### `pkg/types`
- Defines shared message structures
- Provides constants for WebSocket events
- Can be imported by external packages

## How to Run

1. Copy the example environment file:
   ```bash
   cp env.example .env
   ```

2. Edit `.env` with your configuration:
   ```
   PORT=5005
   STUN_SERVERS=stun:stun.l.google.com:19302,stun:stun1.l.google.com:19302
   ```

3. Build and run:
   ```bash
   go build ./cmd/sfu
   ./sfu
   ```

   Or run directly:
   ```bash
   go run ./cmd/sfu
   ```

## Adding New Features

The modular structure makes it easy to add new features:

### Adding Authentication
- Create `internal/auth/` package
- Modify `websocket.Handler.HandleWebSocket()` to validate tokens
- Update `cmd/sfu/main.go` to initialize auth components

### Adding Room Management
- Create `internal/room/` package for multi-room support
- Update signaling coordinator to be room-aware
- Modify track manager to isolate tracks by room

### Adding Recording
- Create `internal/recording/` package
- Hook into track manager to capture media streams
- Add recording controls via WebSocket messages

### Adding Metrics
- Create `internal/metrics/` package
- Add metrics collection throughout the application
- Expose metrics endpoint in main.go

## Key Improvements Over Original

1. **Separation of Concerns**: Each package has a single responsibility
2. **Testability**: Components can be tested in isolation
3. **Maintainability**: Changes are localized to specific packages
4. **Extensibility**: New features can be added without touching core logic
5. **Type Safety**: Interfaces prevent circular dependencies
6. **Documentation**: Clear package structure and responsibilities

## Configuration Options

- `PORT`: HTTP server port (default: 5005)
- `STUN_SERVERS`: Comma-separated list of STUN servers

The server will automatically load a `.env` file if present, or use environment variables directly. 