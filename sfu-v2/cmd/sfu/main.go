package main

import (
	"flag"
	"log"
	"net/http"
	"time"

	"sfu-v2/internal/config"
	"sfu-v2/internal/room"
	"sfu-v2/internal/signaling"
	"sfu-v2/internal/track"
	"sfu-v2/internal/webrtc"
	"sfu-v2/internal/websocket"
)

func main() {
	// Parse command-line flags
	flag.Parse()

	// Set logging options
	log.SetFlags(log.LstdFlags | log.Lshortfile)

	// Load configuration
	cfg, err := config.Load()
	if err != nil {
		log.Fatalf("Failed to load configuration: %v", err)
	}

	// Log startup information
	log.Printf("🚀 Starting SFU Server")
	log.Printf("📊 Configuration: Port=%s, Debug=%t, VerboseLog=%t", cfg.Port, cfg.Debug, cfg.VerboseLog)
	log.Printf("🧊 ICE Servers: %v", cfg.STUNServers)

	if cfg.Debug {
		log.Printf("🔍 Debug mode enabled - detailed logging active")
	}

	if cfg.VerboseLog {
		log.Printf("📝 Verbose logging enabled - RTP packet logging active")
	}

	// Initialize managers
	log.Printf("🏗️  Initializing components...")

	trackManager := track.NewManager(cfg.Debug)
	log.Printf("✅ Track manager initialized (debug: %t)", cfg.Debug)

	webrtcManager := webrtc.NewManager(cfg.Debug)
	log.Printf("✅ WebRTC manager initialized (debug: %t)", cfg.Debug)

	roomManager := room.NewManager(cfg.Debug)
	log.Printf("✅ Room manager initialized (debug: %t)", cfg.Debug)

	coordinator := signaling.NewCoordinator(trackManager, webrtcManager, roomManager, cfg.Debug)
	log.Printf("✅ Signaling coordinator initialized (debug: %t)", cfg.Debug)

	// Initialize WebSocket handler
	wsHandler := websocket.NewHandler(cfg, trackManager, webrtcManager, roomManager, coordinator)
	log.Printf("✅ WebSocket handler initialized")

	// Start keyframe dispatcher
	webrtcManager.StartKeyFrameDispatcher()
	log.Printf("✅ Keyframe dispatcher started")

	// Start room cleanup routine (clean empty rooms after 10 minutes of inactivity)
	go func() {
		ticker := time.NewTicker(5 * time.Minute) // Check every 5 minutes
		defer ticker.Stop()

		log.Printf("🧹 Room cleanup routine started (check interval: 5m, cleanup threshold: 10m)")

		for range ticker.C {
			if cfg.Debug {
				log.Printf("🧹 Running scheduled room cleanup...")
			}
			roomManager.CleanupEmptyRooms(10 * time.Minute) // Remove rooms empty for 10+ minutes
		}
	}()

	// Handle WebSocket connections
	http.HandleFunc("/", wsHandler.HandleWebSocket)
	log.Printf("✅ WebSocket endpoints configured:")
	log.Printf("   📡 / (default client endpoint)")
	log.Printf("   📡 /client (explicit client endpoint)")
	log.Printf("   📡 /server (server registration endpoint)")

	// Start the HTTP server
	log.Printf("🌐 Starting HTTP server on port %s", cfg.Port)
	log.Printf("🎯 SFU Server ready!")
	log.Printf("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")

	if err := http.ListenAndServe(":"+cfg.Port, nil); err != nil {
		log.Fatalf("❌ HTTP server failed: %v", err)
	}
}
