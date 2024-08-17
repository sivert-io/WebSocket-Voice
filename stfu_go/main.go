package main

import (
	"log"
	"net/http"
	"os"
	"sfu/handlers"
	"sfu/signaling"

	"github.com/joho/godotenv"
)

func main() {
	log.Println("Starting STFU server...")
	err := godotenv.Load()
	if err != nil {
		log.Fatal("Error loading .env file")
	}

	log.Println("Loaded environment variables...")

	// Set up HTTP routes
	http.HandleFunc("/", handlers.WebsocketHandler)

	log.Println("Set up HTTP routes...")

	// Start the keyframe dispatcher
	go signaling.StartKeyFrameDispatcher()

	log.Println("Started keyframe dispatcher...")

	// Determine port and start server
	port := os.Getenv("PORT")
	if port == "" {
		port = "5005"
	}

	log.Println("Starting server on port " + port + "...")
	log.Fatal(http.ListenAndServe(":"+port, nil))
}
