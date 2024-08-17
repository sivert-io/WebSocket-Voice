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
	err := godotenv.Load()
	if err != nil {
		log.Fatal("Error loading .env file")
	}

	// Set up HTTP routes
	http.HandleFunc("/", handlers.WebsocketHandler)

	// Start the keyframe dispatcher
	go signaling.StartKeyFrameDispatcher()

	// Determine port and start server
	port := os.Getenv("PORT")
	if port == "" {
		port = "5005"
	}
	log.Fatal(http.ListenAndServe(":"+port, nil))
}
