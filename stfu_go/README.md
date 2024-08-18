# 🌐 STFU Go

This is the Go implementation of the Selective Forwarding Unit (SFU) for our WebRTC project. It is responsible for managing and forwarding media streams between clients.

## ✨ Features

- **Media Stream Management**: Manages the media streams from multiple clients.
- **Selective Forwarding**: Forwards the media streams selectively based on network conditions and client capabilities.

## 🚀 Getting Started

1. Navigate to the `stfu_go` directory.
2. Install the dependencies with `go get`.
3. Start the SFU with `go run main.go`.
4. The SFU will now wait for clients to connect and start forwarding media streams.

## 🛠️ Configuration

You can configure the SFU by editing the `.env` file in the `stfu_go` directory. Here you can set the media stream options and other settings.

## 🤝 Contributing

We welcome contributions and feedback! If you encounter any issues or have suggestions, please open an issue on GitHub. We're excited to improve this project together!

## 📄 License

This project is licensed under the [MIT License](LICENSE).
