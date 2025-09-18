# 🚀 Gryt Quick Start

Get Gryt voice chat running in seconds with these one-liners!

## 🐳 Docker (Easiest)

### Development Setup
```bash
git clone https://github.com/sivert-io/WebSocket-Voice.git && cd webrtc && docker-compose up -d
```
**That's it!** Open http://localhost:5173

### Production Setup
```bash
git clone https://github.com/sivert-io/WebSocket-Voice.git && cd webrtc && docker-compose -f docker-compose.prod.yml up -d
```
**That's it!** Open http://localhost

## ☸️ Kubernetes with Helm

### Quick Deploy
```bash
git clone https://github.com/sivert-io/WebSocket-Voice.git && cd webrtc && helm install gryt ./helm/gryt
```

### Production Deploy
```bash
git clone https://github.com/sivert-io/WebSocket-Voice.git && cd webrtc && helm install gryt ./helm/gryt -f helm/gryt/examples/production-values.yaml --set gryt.domain=yourdomain.com --set server.secrets.serverPassword=your-secure-password
```

## 🎯 What You Get

- **Voice Chat**: Crystal clear WebRTC audio with noise suppression
- **Multiple Servers**: Connect to different communities with auto-focus
- **Real-time**: Instant voice activity indicators and smooth animations
- **Modern UI**: Beautiful, responsive interface with dark/light themes
- **Smart Rate Limiting**: User-friendly rate limiting with clear feedback
- **Production Ready**: Health checks, scaling, monitoring, and security

## 🔧 Configuration (Optional)

All services work out-of-the-box, but you can customize:

### Environment Files
- `server/example.env` → `server/.env` - Server configuration
- `sfu-v2/env.example` → `sfu-v2/.env` - SFU configuration  
- `client/example.env` → `client/.env` - Client configuration

### Key Settings
```env
# Server
SERVER_NAME="My Gryt Server"
SERVER_PASSWORD="your-secure-password"
SFU_WS_HOST="wss://your-sfu-server.com"
STUN_SERVERS="stun:stun.l.google.com:19302"

# Database & Storage
SCYLLA_CONTACT_POINTS=your-scylla-host.com
S3_ENDPOINT=https://your-s3-endpoint.com

# SFU  
STUN_SERVERS="stun:stun.l.google.com:19302"

# Client
# No configuration required - servers added via UI
```

## 🆘 Troubleshooting

**Can't connect?** Check if ports are available:
```bash
docker-compose logs
```

**Audio not working?** Ensure HTTPS in production (WebRTC requirement)

**Need help?** Check the full [DEPLOYMENT.md](DEPLOYMENT.md) guide

---

**🎉 Happy voice chatting!** 