package main

import (
	"flag"
	"log"
	"net/http"
	"time"

	"sfu-v2/internal/config"
	"sfu-v2/internal/recovery"
	"sfu-v2/internal/room"
	"sfu-v2/internal/signaling"
	"sfu-v2/internal/track"
	"sfu-v2/internal/webrtc"
	"sfu-v2/internal/websocket"
)

func main() {
	// Set up global panic recovery
	defer func() {
		if r := recover(); r != nil {
			log.Printf("🚨 FATAL PANIC in main(): %v", r)
			recovery.GetLogger().DumpRecentActions()
			log.Fatalf("🚨 Server crashed with panic: %v", r)
		}
	}()

	// Parse command-line flags
	flag.Parse()

	// Set logging options
	log.SetFlags(log.LstdFlags | log.Lshortfile)

	// Initialize recovery system
	logger := recovery.GetLogger()
	logger.LogAction("MAIN", "STARTUP", "", "", "SFU Server starting")

	// Load configuration
	cfg, err := config.Load()
	if err != nil {
		logger.LogAction("MAIN", "CONFIG_ERROR", "", "", err.Error())
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

	// Start system monitoring
	recovery.StartSystemMonitor(30 * time.Second) // Monitor every 30 seconds
	logger.LogAction("MAIN", "MONITOR_STARTED", "", "", "System monitoring active")

	// Initialize managers with crash protection
	log.Printf("🏗️  Initializing components...")

	var trackManager *track.Manager
	var webrtcManager *webrtc.Manager
	var roomManager *room.Manager
	var coordinator *signaling.Coordinator

	// Initialize track manager with recovery
	err = recovery.SafeExecute("MAIN", "INIT_TRACK_MANAGER", func() error {
		trackManager = track.NewManager(cfg.Debug)
		log.Printf("✅ Track manager initialized (debug: %t)", cfg.Debug)
		return nil
	})
	if err != nil {
		log.Fatalf("❌ Failed to initialize track manager: %v", err)
	}

	// Initialize WebRTC manager with recovery
	err = recovery.SafeExecute("MAIN", "INIT_WEBRTC_MANAGER", func() error {
		webrtcManager = webrtc.NewManager(cfg.Debug)
		log.Printf("✅ WebRTC manager initialized (debug: %t)", cfg.Debug)
		return nil
	})
	if err != nil {
		log.Fatalf("❌ Failed to initialize WebRTC manager: %v", err)
	}

	// Initialize room manager with recovery
	err = recovery.SafeExecute("MAIN", "INIT_ROOM_MANAGER", func() error {
		roomManager = room.NewManager(cfg.Debug)
		log.Printf("✅ Room manager initialized (debug: %t)", cfg.Debug)
		return nil
	})
	if err != nil {
		log.Fatalf("❌ Failed to initialize room manager: %v", err)
	}

	// Initialize signaling coordinator with recovery
	err = recovery.SafeExecute("MAIN", "INIT_COORDINATOR", func() error {
		coordinator = signaling.NewCoordinator(trackManager, webrtcManager, roomManager, cfg.Debug)
		log.Printf("✅ Signaling coordinator initialized (debug: %t)", cfg.Debug)
		return nil
	})
	if err != nil {
		log.Fatalf("❌ Failed to initialize signaling coordinator: %v", err)
	}

	// Initialize WebSocket handler with recovery
	var wsHandler *websocket.Handler
	err = recovery.SafeExecute("MAIN", "INIT_WEBSOCKET_HANDLER", func() error {
		wsHandler = websocket.NewHandler(cfg, trackManager, webrtcManager, roomManager, coordinator)
		log.Printf("✅ WebSocket handler initialized")
		return nil
	})
	if err != nil {
		log.Fatalf("❌ Failed to initialize WebSocket handler: %v", err)
	}

	// Start keyframe dispatcher with recovery
	err = recovery.SafeExecute("MAIN", "START_KEYFRAME_DISPATCHER", func() error {
		webrtcManager.StartKeyFrameDispatcher()
		log.Printf("✅ Keyframe dispatcher started")
		return nil
	})
	if err != nil {
		log.Fatalf("❌ Failed to start keyframe dispatcher: %v", err)
	}

	// Start room cleanup routine with recovery
	recovery.SafeGoroutine("MAIN", "ROOM_CLEANUP", func() {
		ticker := time.NewTicker(5 * time.Minute) // Check every 5 minutes
		defer ticker.Stop()

		log.Printf("🧹 Room cleanup routine started (check interval: 5m, cleanup threshold: 30m)")

		for range ticker.C {
			recovery.SafeExecute("ROOM_CLEANUP", "CLEANUP_CYCLE", func() error {
				if cfg.Debug {
					log.Printf("🧹 Running scheduled room cleanup...")
				}
				roomManager.CleanupEmptyRooms(30 * time.Minute) // Remove rooms empty for 30+ minutes
				return nil
			})
		}
	})

	// Handle WebSocket connections with recovery wrapper
	http.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		recovery.SafeExecuteWithContext("WEBSOCKET", "HANDLE_CONNECTION", "", "", r.RemoteAddr, func() error {
			wsHandler.HandleWebSocket(w, r)
			return nil
		})
	})

	log.Printf("✅ WebSocket endpoints configured:")
	log.Printf("   📡 / (default client endpoint)")
	log.Printf("   📡 /client (explicit client endpoint)")
	log.Printf("   📡 /server (server registration endpoint)")

	// Log initial system stats
	recovery.LogSystemStats()

	// Start the HTTP server with recovery
	log.Printf("🌐 Starting HTTP server on port %s", cfg.Port)
	log.Printf("🎯 SFU Server ready!")
	log.Printf("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")

	logger.LogAction("MAIN", "SERVER_READY", "", "", "HTTP server starting on port "+cfg.Port)

	if err := http.ListenAndServe(":"+cfg.Port, nil); err != nil {
		logger.LogAction("MAIN", "SERVER_ERROR", "", "", err.Error())
		log.Fatalf("❌ HTTP server failed: %v", err)
	}
}
