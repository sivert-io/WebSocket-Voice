# 🌐 Gryt Web Client

The Gryt Web Client is a sophisticated React application that provides a modern, Discord-like interface for voice communication. Built with TypeScript, Vite, and cutting-edge web technologies, it delivers professional-grade audio processing and an intuitive user experience.

## ✨ Features

### 🎙️ **Advanced Audio Processing**
- **Multi-stage Audio Pipeline**: Noise gate → Volume control → Mute → SFU transmission
- **Real-time Voice Activity Detection**: Accurate visual feedback using final processed audio
- **Smart Noise Gate**: Configurable threshold with smooth attack/release curves
- **Professional Volume Controls**: Independent mic/output with 2x boost capability
- **Audio Visualization**: Real-time frequency spectrum and level meters
- **Loopback Monitoring**: Hear your processed audio for setup verification

### 🎛️ **Voice Controls**
- **Mute/Unmute**: Server-synchronized microphone control with visual feedback
- **Deafen**: Local audio output control (mutes incoming audio)
- **Device Management**: Hot-swappable microphone and speaker selection
- **Connection States**: Visual indicators for connecting, connected, and speaking states

### 🌐 **Multi-Server Management**
- **Seamless Server Switching**: Change servers without losing voice connection
- **Room Isolation**: Unique room IDs prevent cross-server interference
- **Connection Recovery**: Robust reconnection with state preservation
- **Server Discovery**: Automatic detection and connection to available servers

### 🎨 **Modern User Interface**
- **Radix UI Components**: Professional, accessible component library
- **Responsive Design**: Optimized for desktop and mobile devices
- **Real-time Animations**: Smooth transitions using Framer Motion
- **Visual Feedback**: Speaking indicators, connection states, and loading spinners
- **Adaptive Theming**: Dark/light mode with system preference detection

## 🏗️ Architecture

The client is built with a modular package-based architecture:

```
client/
├── src/
│   ├── packages/
│   │   ├── audio/          # Audio processing and device management
│   │   ├── webRTC/         # SFU connection and WebRTC handling
│   │   ├── socket/         # Server communication and UI components
│   │   ├── settings/       # Configuration and preferences
│   │   └── mobile/         # Mobile-specific utilities
│   ├── components/         # Shared UI components
│   ├── hooks/             # Custom React hooks
│   └── utils/             # Utility functions
├── public/                # Static assets
└── package.json          # Dependencies and scripts
```

### Package Overview

| Package | Purpose | Key Features |
|---------|---------|--------------|
| **`@/audio`** | Audio processing and device management | Noise gate, volume control, device selection, visualization |
| **`@/webRTC`** | SFU connection and WebRTC handling | Peer connections, track management, connection states |
| **`@/socket`** | Server communication and UI | WebSocket management, server views, user components |
| **`@/settings`** | Configuration and preferences | Audio settings, server management, user preferences |
| **`@/mobile`** | Mobile-specific utilities | Responsive design helpers, touch interactions |

## 🚀 Getting Started

### Prerequisites
- **Node.js** 18+ 
- **Bun** (recommended) or npm
- Modern browser with WebRTC support

### Installation

1. **Navigate to client directory**
   ```bash
   cd webrtc/client
   ```

2. **Install dependencies**
   ```bash
   bun install
   # or
   npm install
   ```

3. **Start development server**
   ```bash
   bun dev
   # or
   npm run dev
   ```

4. **Open in browser**
   ```
   http://localhost:5173
   ```

### Build for Production

```bash
# Build optimized production bundle
bun run build

# Preview production build locally
bun run preview

# Type checking
bun run type-check

# Linting
bun run lint
```

## 🎯 Key Components

### Audio Processing (`@/audio`)

**`useMicrophone` Hook**
```typescript
const { microphoneBuffer, isRecording } = useMicrophone(shouldAccess);
// Provides: raw analyser, final analyser, gain nodes, device management
```

**Features:**
- Real-time audio processing with Web Audio API
- Configurable noise gate with attack/release curves
- Volume control with 2x boost capability
- Device hot-swapping without connection loss
- Audio visualization data for UI components

### WebRTC Management (`@/webRTC`)

**`useSFU` Hook**
```typescript
const { 
  connect, 
  disconnect, 
  isConnected, 
  isConnecting,
  streamSources,
  connectionState 
} = useSFU();
```

**Features:**
- Robust SFU connection management
- Automatic reconnection with exponential backoff
- Track lifecycle management
- Connection state synchronization
- Server switching without audio interruption

### Server Communication (`@/socket`)

**`useSockets` Hook**
```typescript
const { 
  sockets, 
  clients, 
  serverDetailsList,
  currentConnection 
} = useSockets();
```

**Features:**
- Multi-server WebSocket management
- Real-time user state synchronization
- Room and channel management
- Automatic reconnection handling

## 🎛️ Audio Pipeline

The client implements a sophisticated audio processing pipeline:

```
┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│ Microphone  │───►│ Noise Gate  │───►│   Volume    │───►│    Mute     │
│   Input     │    │  Filtering  │    │  Control    │    │   Control   │
└─────────────┘    └─────────────┘    └─────────────┘    └─────────────┘
                                                                  │
┌─────────────┐    ┌─────────────┐    ┌─────────────┐           │
│   Visual    │◄───│   Final     │◄───│     SFU     │◄──────────┘
│  Feedback   │    │  Analyser   │    │Transmission │
└─────────────┘    └─────────────┘    └─────────────┘
```

### Noise Gate Configuration
- **Threshold**: -50dB to -10dB (configurable)
- **Attack Time**: 10ms (fast response)
- **Release Time**: 100ms (smooth fade)
- **Ratio**: ∞:1 (hard gate)

### Volume Control
- **Range**: 0% to 200% (2x boost)
- **Scaling**: Logarithmic for natural perception
- **Real-time**: Instant response without audio glitches

## 🎨 UI Components

### Voice Controls
- **Mute Button**: Red when muted, with server synchronization
- **Deafen Button**: Orange when deafened, local audio control
- **Disconnect Button**: Clean disconnection with state cleanup

### Visual Feedback
- **Speaking Indicators**: Real-time voice activity detection
- **Connection States**: Loading spinners, connected indicators
- **Audio Levels**: Visual representation of audio processing

### Responsive Design
- **Desktop**: Full-featured interface with voice view and chat
- **Mobile**: Optimized layout with touch-friendly controls
- **Adaptive**: Automatic layout adjustments based on screen size

## 🔧 Configuration

### Environment Variables

Create a `.env` file based on `example.env`:

```env
# Your websocket host url (must be secure)
VITE_WS_HOST="wss://your-secure-websocket-host"

# Authentication endpoint (add this to your .env)
VITE_GRYT_AUTH_API=https://auth.gryt.chat

# Optional: Audio Configuration
VITE_AUDIO_SAMPLE_RATE=48000
VITE_AUDIO_BUFFER_SIZE=256
```

### Audio Settings
- **Microphone Volume**: 0-200% with real-time adjustment
- **Output Volume**: 0-200% with deafen control
- **Noise Gate**: Configurable threshold and timing
- **Device Selection**: Automatic detection and manual override

## 🐛 Troubleshooting

### Common Issues

**Microphone not working?**
```bash
# Check browser permissions
# Verify HTTPS in production
# Test with different browsers
```

**Audio quality issues?**
```bash
# Adjust noise gate threshold
# Check microphone input levels
# Verify sample rate compatibility
```

**Connection problems?**
```bash
# Check WebSocket connections
# Verify SFU server status
# Test network connectivity
```

### Debug Mode

Enable detailed logging:
```typescript
// In browser console
localStorage.setItem('debug', 'gryt:*');
```

## 🧪 Testing

```bash
# Run all tests
bun test

# Run specific test suite
bun test audio
bun test webrtc
bun test components

# Coverage report
bun test --coverage
```

## 📦 Dependencies

### Core Dependencies
- **React 18**: Modern React with concurrent features
- **TypeScript**: Full type safety and developer experience
- **Vite**: Fast build tool with HMR
- **Radix UI**: Professional component library
- **Framer Motion**: Smooth animations and transitions

### Audio Dependencies
- **Web Audio API**: Native browser audio processing
- **MediaDevices API**: Device enumeration and selection
- **WebRTC API**: Peer-to-peer communication

### Development Dependencies
- **ESLint**: Code linting and style enforcement
- **Prettier**: Code formatting
- **Vitest**: Fast unit testing framework
- **TypeScript**: Type checking and compilation

## 🤝 Contributing

### Development Workflow

1. **Create feature branch**
   ```bash
   git checkout -b feature/audio-enhancement
   ```

2. **Make changes with types**
   ```typescript
   // Always include proper TypeScript types
   interface AudioSettings {
     microphoneVolume: number;
     outputVolume: number;
     noiseGateThreshold: number;
   }
   ```

3. **Test thoroughly**
   ```bash
   bun test
   bun run type-check
   bun run lint
   ```

4. **Update documentation**
   - Add JSDoc comments for new functions
   - Update README for new features
   - Include usage examples

### Code Style
- Use TypeScript strict mode
- Follow React best practices
- Implement proper error boundaries
- Add comprehensive logging
- Write accessible components

## 📄 License

This project is licensed under the [MIT License](../../LICENSE).

---

**Part of the [Gryt Voice Chat Platform](../README.md)**