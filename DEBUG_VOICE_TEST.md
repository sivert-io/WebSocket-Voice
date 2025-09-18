# 🎙️ Voice Debugging Test Steps

## Step 1: Test Voice Channel Click

1. **Open browser dev tools** (F12)
2. **Go to Console tab**
3. **Click on a voice channel** in your app
4. **Look for these console messages**:

### Expected Console Messages:
```
🎤 VOICE CHANNEL CLICK DEBUG: { channelId: "voice-channel-id", ... }
🔌 Proceeding with new connection attempt
Attempting to connect with micID: [device-id]
✅ Room access granted: { room_id: "...", join_token: "...", sfu_url: "..." }
```

### If you DON'T see these messages:
- The voice channel click handler isn't working
- Check if the channel type is correctly set to "voice"

## Step 2: Check Server Logs

After clicking voice channel, check server logs for:

### Expected Server Messages:
```
Processing room access request: [client-id] -> [room-id]
🏠 Creating unique room ID: [unique-room-id]
✅ Room access granted: [client-id] -> [unique-room-id]
```

### If you DON'T see these messages:
- The `requestRoomAccess` event isn't reaching the server
- Check network connectivity

## Step 3: Test SFU Connection

1. **Check if SFU is running**:
   ```bash
   curl -I http://localhost:5005/health
   ```

2. **Check SFU logs** (if running locally):
   ```bash
   # Look for client connection attempts
   ```

## Step 4: Test Microphone Permissions

1. **In browser console, run**:
   ```javascript
   navigator.mediaDevices.getUserMedia({audio: true})
     .then(stream => {
       console.log('✅ Microphone access granted:', stream);
       console.log('Audio tracks:', stream.getAudioTracks());
       stream.getTracks().forEach(track => track.stop());
     })
     .catch(err => console.error('❌ Microphone error:', err));
   ```

## Step 5: Check WebRTC Configuration

1. **In browser console, run**:
   ```javascript
   // Check if WebRTC is supported
   console.log('RTCPeerConnection supported:', !!window.RTCPeerConnection);
   
   // Check STUN servers
   const pc = new RTCPeerConnection({
     iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
   });
   console.log('✅ WebRTC configuration test passed');
   pc.close();
   ```

## Step 6: Manual Test

If the above steps work, try this manual test:

1. **Open browser console**
2. **Run this code** (replace with your actual values):
   ```javascript
   // Get the socket connection
   const socket = window.sockets?.['your-server-host'] || 
                  Object.values(window.sockets || {})[0];
   
   if (!socket) {
     console.error('❌ No socket connection found');
     return;
   }
   
   console.log('✅ Socket found:', socket);
   
   // Listen for room access response
   socket.on('room_access_granted', (data) => {
     console.log('✅ Room access granted:', data);
   });
   
   socket.on('room_error', (error) => {
     console.error('❌ Room access error:', error);
   });
   
   // Request room access
   console.log('📤 Requesting room access...');
   socket.emit('requestRoomAccess', 'general'); // Replace with your channel ID
   ```

## Common Issues & Solutions

### Issue 1: No Console Messages on Click
**Solution**: Check if the channel type is set to "voice" in your server configuration

### Issue 2: "Microphone not available" Error
**Solution**: 
1. Check browser permissions
2. Select a microphone in Settings → Microphone
3. Try refreshing the page

### Issue 3: "SFU not connected" Error
**Solution**:
1. Check if SFU server is running
2. Verify SFU_WS_HOST in .env file
3. Check network connectivity to SFU

### Issue 4: "Connection timeout" Error
**Solution**:
1. Check STUN server configuration
2. Try different STUN servers
3. Check firewall settings

## What to Report

When asking for help, include:
1. **Console output** from Step 1
2. **Server logs** from Step 2  
3. **Results** from Steps 4-6
4. **Error messages** (if any)
5. **Browser and OS** information
