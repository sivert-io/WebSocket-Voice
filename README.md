# 🌩️ Gryt - Modern WebRTC Voice Chat Platform

Welcome to **Gryt**, a cutting-edge WebRTC-based voice chat platform featuring real-time communication, advanced audio processing, and a beautiful modern interface. Built with TypeScript, React, and Go, Gryt provides a Discord-like experience with enterprise-grade voice quality and reliability.

<div align="center">

![Preview](/.github/preview_client.png)

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-20232A?logo=react&logoColor=61DAFB)](https://reactjs.org/)
[![Go](https://img.shields.io/badge/Go-00ADD8?logo=go&logoColor=white)](https://golang.org/)

</div>

## ✨ Features

### 🎙️ **Advanced Voice Communication**
- **High-Quality Audio**: Crystal-clear voice with noise suppression and echo cancellation
- **Real-time Voice Activity Detection**: Visual indicators showing who's speaking
- **Smart Noise Gate**: Automatic background noise filtering with customizable thresholds
- **Volume Controls**: Independent microphone and output volume with 2x boost capability
- **Mute & Deafen**: Full voice controls with server synchronization

### 🎛️ **Professional Audio Processing**
- **Enhanced Audio Pipeline**: Multi-stage processing (noise gate → volume → mute → output)
- **Real-time Audio Visualization**: Frequency spectrum and level meters
- **Loopback Monitoring**: Hear yourself to test audio setup
- **Device Management**: Hot-swappable microphone and speaker selection
- **Audio Quality Optimization**: Automatic gain control and dynamic range compression

### 🌐 **Multi-Server Architecture**
- **Server Discovery**: Automatic server detection and connection
- **Seamless Server Switching**: Switch between voice servers without disconnection
- **Room Isolation**: Unique room IDs prevent cross-server interference
- **Connection State Management**: Robust handling of network changes and reconnections

### 🎨 **Modern User Interface**
- **Beautiful Design**: Clean, modern interface built with Radix UI
- **Responsive Layout**: Works perfectly on desktop and mobile
- **Real-time Animations**: Smooth transitions and visual feedback
- **Dark/Light Themes**: Adaptive theming with system preference detection
- **Accessibility**: Full keyboard navigation and screen reader support

### 🔧 **Developer Experience**
- **TypeScript**: Full type safety across the entire stack
- **Modular Architecture**: Clean separation of concerns with package-based structure
- **Hot Reload**: Instant development feedback with Vite and Bun
- **Comprehensive Logging**: Detailed debugging and monitoring capabilities

## 🏗️ Architecture

Gryt consists of three main components working together, with authentication provided as a centrally hosted service:

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Web Client    │    │  Gryt Servers   │    │   SFU Server    │
│   (React/TS)    │◄──►│   (Node.js)     │◄──►│     (Go)        │
│                 │    │                 │    │                 │
│ • Voice UI      │    │ • Signaling     │    │ • Media Relay   │
│ • Audio Proc.   │    │ • User Mgmt     │    │ • WebRTC        │
│ • Server Mgmt   │    │ • Room Mgmt     │    │ • Track Mgmt    │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                                │
                       ┌─────────────────┐
                       │  Auth Service   │
                       │ (Hosted by Gryt)│
                       │                 │
                       │ • Authentication│
                       │ • User Sessions │
                       │ • Security      │
                       └─────────────────┘
```

### Component Overview

| Component | Technology | Purpose | Setup Required |
|-----------|------------|---------|----------------|
| **[Web Client](client/)** | React + TypeScript | User interface and audio processing | ✅ Self-hosted |
| **[Gryt Server](server/)** | Node.js + TypeScript | Signaling and room management | ✅ Self-hosted |
| **[SFU Server](sfu-v2/)** | Go + Pion WebRTC | Media forwarding and WebRTC | ✅ Self-hosted |
| **Auth Service** | Hosted by Gryt Team | Authentication and security | 🌐 Centrally hosted |

> **Note**: Authentication is provided as a centrally hosted service by the Gryt team. You don't need to set up your own authentication server - just configure your servers to use the official Gryt Auth API.

## 🚀 Quick Start

### Prerequisites
- **Node.js** 18+ and **Bun** (for client/server)
- **Go** 1.21+ (for SFU)
- **STUN/TURN Server** (for production)

### Development Setup

1. **Clone the repository**
   ```bash
   git clone https://github.com/your-org/gryt.git
   cd gryt
   ```

2. **Start all services** (uses tmux for multi-service development)
   ```bash
   chmod +x start.sh
   ./start.sh
   ```

   This starts:
   - SFU Server (Go) on port 5005
   - Web Client (React) on port 5173
   - Gryt Server 1 "Gryta Krutt" on port 5000
   - Gryt Server 2 "Techial" on port 5001

3. **Access the application**
   - Open http://localhost:5173 in your browser
   - Create an account or use community access (via centrally hosted auth)
   - Join a voice channel and start chatting!

### Manual Setup

If you prefer to start services individually:

```bash
# Terminal 1: SFU Server
cd webrtc/sfu-v2
./start.sh

# Terminal 2: Web Client
cd webrtc/client
bun install && bun dev

# Terminal 3: Gryt Server
cd webrtc/server
bun install && bun dev
```

## 🛠️ Production Deployment

### Requirements
- **Domain with SSL/TLS**: Required for WebRTC in production
- **STUN/TURN Server**: We recommend [coturn](https://github.com/coturn/coturn)
- **Load Balancer**: For multiple Gryt server instances

### Environment Configuration

Each component includes an `example.env` file that you can copy and customize:

**SFU Server** (copy `env.example` to `.env`):
```env
PORT=5005
STUN_SERVERS=stun:stun.l.google.com:19302,stun:stun1.l.google.com:19302
```

**Gryt Server** (copy `example.env` to `.env`):
```env
# Port clients connect to
PORT=5000

# Your secure SFU host
SFU_WS_HOST="wss://sfu_host.com"

# Comma separated list of URLs
STUN_SERVERS="stun:stun.l.google.com:19302"

# Name of the server
SERVER_NAME="My Brand New Server"

# Icon of the server (filename in the public folder)
SERVER_ICON="example.png"

# Clients need invite to join
SERVER_INVITE_ONLY="false"

# Websocket allowed origins
CORS_ORIGIN="https://gryt.chat"

# Websocket secret token (also used for SFU authentication)
SERVER_TOKEN="123"

# Authentication endpoint (add this to your .env)
GRYT_AUTH_API=https://auth.gryt.chat
```

**Web Client** (copy `example.env` to `.env`):
```env
# Your websocket host url (must be secure)
VITE_WS_HOST="wss://your-secure-websocket-host"

# Authentication endpoint (add this to your .env)
VITE_GRYT_AUTH_API=https://auth.gryt.chat
```

> **Quick Setup**: Copy the example files and add the auth configuration:
> ```bash
> # Server
> cd webrtc/server
> cp example.env .env
> echo "GRYT_AUTH_API=https://auth.gryt.chat" >> .env
> 
> # Client  
> cd webrtc/client
> cp example.env .env
> echo "VITE_GRYT_AUTH_API=https://auth.gryt.chat" >> .env
> ```

### Authentication Configuration

Authentication is provided by the centrally hosted Gryt Auth service. Add this to your `.env` files:
- **Server**: `GRYT_AUTH_API=https://auth.gryt.chat`
- **Client**: `VITE_GRYT_AUTH_API=https://auth.gryt.chat`

## 🎯 Key Features Deep Dive

### Voice Controls
- **Mute**: Prevents your microphone from transmitting (visual feedback to others)
- **Deafen**: Mutes all incoming audio (local only, others still see you as connected)
- **Push-to-Talk**: Coming soon
- **Voice Activation**: Automatic transmission based on voice activity

### Audio Processing Pipeline
```
Microphone → Noise Gate → Volume Control → Mute → SFU → Other Users
                ↓
            Visual Feedback (accurate representation of transmitted audio)
```

### Server Management
- **Multi-server Support**: Connect to multiple Gryt servers simultaneously
- **Seamless Switching**: Change servers without losing voice connection
- **Room Isolation**: Unique room IDs prevent conflicts between servers
- **Connection Recovery**: Automatic reconnection with state preservation

## 🤝 Contributing

We welcome contributions! Here's how to get started:

1. **Fork the repository**
2. **Create a feature branch**: `git checkout -b feature/amazing-feature`
3. **Make your changes** with proper TypeScript types
4. **Add tests** for new functionality
5. **Commit your changes**: `git commit -m 'Add amazing feature'`
6. **Push to the branch**: `git push origin feature/amazing-feature`
7. **Open a Pull Request**

### Development Guidelines
- Follow TypeScript best practices
- Use proper error handling and logging
- Write comprehensive tests
- Update documentation for new features
- Ensure accessibility compliance

## 📚 Documentation

- **[Client Documentation](client/README.md)** - React app, audio processing, UI components
- **[Server Documentation](server/README.md)** - Signaling server, room management
- **[SFU Documentation](sfu-v2/README.md)** - Media forwarding, WebRTC implementation

## 🐛 Troubleshooting

### Common Issues

**Audio not working?**
- Check microphone permissions in browser
- Verify STUN/TURN server configuration
- Ensure HTTPS/WSS in production

**Connection issues?**
- Check firewall settings for WebRTC ports
- Verify server URLs and SSL certificates
- Check browser console for detailed errors

**Performance issues?**
- Monitor CPU usage during audio processing
- Check network bandwidth and latency
- Verify browser WebRTC support

## 📄 License

This project is licensed under the [MIT License](LICENSE) - see the LICENSE file for details.

## ✍️ Authors

<div align="center">
  
| <img src='https://avatars.githubusercontent.com/u/6785315?s=64&v=4'>  | <img src='https://avatars.githubusercontent.com/u/74724224?s=64&v=4'>  |
| ------------- | ------------- |
| [Sivert Gullberg Hansen](https://github.com/sivert-io)  | [Ola Hulleberg](https://github.com/OlaHulleberg)  |
| Lead Developer & Architecture | Authentication & Backend |

</div>

---

<div align="center">

**Built with ❤️ for the future of voice communication**

[Report Bug](https://github.com/your-org/gryt/issues) • [Request Feature](https://github.com/your-org/gryt/issues) • [Documentation](https://docs.gryt.chat)

</div>
