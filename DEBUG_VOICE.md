# 🎙️ Voice Transmission Debugging Guide

## Issue: Voice works locally but other peers don't hear anything

This suggests the issue is in the WebRTC peer-to-peer connection or SFU forwarding.

## 🔍 Debugging Steps

### 1. Check SFU Server Logs
```bash
# Check if SFU server is running and receiving connections
docker logs <sfu-container-name> -f

# Look for:
# - Server registration messages
# - Client join messages  
# - RTP packet forwarding logs
# - WebRTC connection state changes
```

### 2. Check WebSocket Server Logs
```bash
# Check the main server logs
cd /home/sivert/dev/websocket/webrtc/server
npm run dev

# Look for:
# - SFU client connection status
# - Room registration messages
# - Voice connection events
```

### 3. Check Browser Console
Open browser dev tools and look for:
- WebRTC connection errors
- SFU WebSocket connection issues
- Audio track errors
- ICE connection failures

### 4. Check Network Connectivity
```bash
# Test SFU server connectivity
curl -I http://localhost:5005/health

# Check if SFU is accessible from client
# (Replace with your actual SFU host)
```

### 5. Verify STUN/TURN Configuration
Check your `.env` file:
```bash
STUN_SERVERS="stun:stun.l.google.com:19302,stun:stun1.l.google.com:19302"
SFU_WS_HOST="ws://localhost:5005"  # or your SFU host
```

## 🎯 Common Issues & Solutions

### Issue 1: SFU Server Not Running
**Symptoms**: No SFU logs, connection timeouts
**Solution**: Start SFU server
```bash
cd /home/sivert/dev/websocket/webrtc/sfu-v2
go run main.go
```

### Issue 2: WebRTC ICE Connection Failed
**Symptoms**: Browser console shows ICE connection errors
**Solution**: Check STUN servers and network configuration

### Issue 3: Audio Tracks Not Being Added
**Symptoms**: Local voice works but no tracks in WebRTC connection
**Solution**: Check microphone permissions and track addition logic

### Issue 4: SFU Not Forwarding RTP Packets
**Symptoms**: SFU receives packets but doesn't forward them
**Solution**: Check SFU room registration and client join logic

## 🔧 Debugging Commands

### Check SFU Server Status
```bash
# If using Docker
docker ps | grep sfu

# If running directly
ps aux | grep sfu
```

### Test WebRTC Connection
```bash
# Check if WebRTC is working in browser
# Open browser console and run:
navigator.mediaDevices.getUserMedia({audio: true})
  .then(stream => console.log('Microphone access:', stream))
  .catch(err => console.error('Microphone error:', err))
```

### Check Network Ports
```bash
# Check if SFU port is open
netstat -tlnp | grep 5005

# Check if STUN servers are reachable
nc -u -v stun.l.google.com 19302
```

## 📊 Key Log Messages to Look For

### SFU Server (Good):
```
✅ Server registered with SFU
🎵 Forwarded X RTP packets from client
👤 Client joined room successfully
```

### SFU Server (Bad):
```
❌ Failed to register server
❌ Client join validation failed
❌ Track write error
```

### WebSocket Server (Good):
```
✅ SFU Client initialized
📡 Broadcasting member updates
🎙️ Voice connection established
```

### WebSocket Server (Bad):
```
❌ SFU client connection failed
❌ Failed to register room with SFU
❌ Voice connection error
```

## 🚨 Emergency Debugging

If nothing works, try this minimal test:

1. **Start SFU server**:
   ```bash
   cd /home/sivert/dev/websocket/webrtc/sfu-v2
   go run main.go
   ```

2. **Start WebSocket server**:
   ```bash
   cd /home/sivert/dev/websocket/webrtc/server
   npm run dev
   ```

3. **Open browser** and check console for errors

4. **Join voice channel** and watch all logs simultaneously

## 📝 What to Report

When asking for help, include:
1. SFU server logs (last 50 lines)
2. WebSocket server logs (last 50 lines)  
3. Browser console errors
4. Network configuration (STUN servers, SFU host)
5. Steps to reproduce the issue
