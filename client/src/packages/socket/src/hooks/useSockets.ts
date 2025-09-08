import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { singletonHook } from "react-singleton-hook";
import { io, Socket } from "socket.io-client";
import useSound from "use-sound";

// Import sound files
import connectMp3 from "@/audio/src/assets/connect.mp3";
import disconnectMp3 from "@/audio/src/assets/disconnect.mp3";
import { useSettings } from "@/settings";
import { checkAuthenticationOnLaunch, canUseServer, forceSignOutWithAccount } from "@/common";
import { useAccount } from "@/common";
// import { useUserId } from "@/common"; // No longer needed with JWT system
import {
  Server,
  serverDetails,
  serverDetailsList,
} from "@/settings/src/types/server";

import { Clients } from "../types/clients";

type Sockets = { [host: string]: Socket };

function useSocketsHook() {
  const [sockets, setSockets] = useState<Sockets>({});
  const { logout } = useAccount();
  
  // Check authentication on app launch
  useEffect(() => {
    checkAuthenticationOnLaunch();
  }, []);
  // const userId = useUserId(); // No longer needed with JWT system
  const { 
    servers, 
    addServer, 
    nickname,
    isMuted,
    isDeafened,
    isAFK,
    connectSoundEnabled,
    disconnectSoundEnabled,
    connectSoundVolume,
    disconnectSoundVolume,
    customConnectSoundFile,
    customDisconnectSoundFile,
  } = useSettings();
  const [newServerInfo, setNewServerInfo] = useState<Server[]>([]);
  const [serverDetailsList, setServerDetailsList] = useState<serverDetailsList>(
    {}
  );
  const [clients, setClients] = useState<{ [host: string]: Clients }>({});

  // Sound hooks for peer notifications with dynamic settings
  const [connectSound] = useSound(
    customConnectSoundFile || connectMp3, 
    { 
      volume: connectSoundVolume / 100,
      soundEnabled: connectSoundEnabled 
    }
  );
  const [disconnectSound] = useSound(
    customDisconnectSoundFile || disconnectMp3, 
    { 
      volume: disconnectSoundVolume / 100,
      soundEnabled: disconnectSoundEnabled 
    }
  );

  function getChannelDetails(host: string, channel: string) {
    return serverDetailsList[host]?.channels.find((c) => c.id === channel);
  }

  // Update nickname on connected sockets only
  useEffect(() => {
    Object.keys(sockets).forEach((host) => {
      console.log("Sending nickname");
      sockets[host]?.emit("updateNickname", nickname);
    });
  }, [nickname, sockets]);

  // Update mute state on connected sockets only
  useEffect(() => {
    Object.keys(sockets).forEach((host) => {
      console.log("Sending mute state:", isMuted);
      sockets[host]?.emit("updateMute", isMuted);
    });
  }, [isMuted, sockets]);

  // Update deafen state on connected sockets only
  useEffect(() => {
    Object.keys(sockets).forEach((host) => {
      console.log("Sending deafen state:", isDeafened);
      sockets[host]?.emit("updateDeafen", isDeafened);
    });
  }, [isDeafened, sockets]);

  // Update AFK state on connected sockets only
  useEffect(() => {
    Object.keys(sockets).forEach((host) => {
      console.log("Sending AFK state:", isAFK);
      sockets[host]?.emit("updateAFK", isAFK);
    });
  }, [isAFK, sockets]);

  // Add new or update servers to the list
  useEffect(() => {
    const info = [...newServerInfo];
    newServerInfo.forEach((server) => {
      addServer(servers, server);
      info.splice(info.indexOf(server), 1);
    });
    if (info.length !== newServerInfo.length) setNewServerInfo(info);
  }, [servers, newServerInfo]);

  // Create sockets for all servers
  useEffect(() => {
    const newSockets = { ...sockets };
    let changed = false;

    Object.keys(servers).forEach((host) => {
      if (!newSockets[host]) {
        // Get access token for this server if available
        const accessToken = localStorage.getItem(`accessToken_${host}`);
        
        console.log(`🔌 Connecting to server ${host} with token:`, servers[host].token);
        
        const socket = io(`wss://${host}`, {
          auth: {
            token: servers[host].token,
            accessToken: accessToken || undefined,
          },
        });
        newSockets[host] = socket;
        changed = true;
        
        socket.on("connect", () => {
          console.log(`✅ Connected to server ${host}`);
        });
        
        socket.on("connect_error", (error) => {
          console.error(`❌ Connection error to server ${host}:`, error);
        });

        socket.on("info", (data: Server) => {
          setNewServerInfo((old) => [
            ...old,
            {
              ...servers[host],
              name: data.name,
            },
          ]);
        });

        // Check if user can use this server - but don't force sign out yet
        // Let them connect and try to join the server first
        if (!canUseServer(host)) {
          console.log(`⚠️ User not authenticated for server ${host} - will try to join`);
        }
        
        // Check if we have a valid access token for this server
        const existingAccessToken = localStorage.getItem(`accessToken_${host}`);
        const grytToken = localStorage.getItem('token'); // useAccount uses 'token'
        
        if (existingAccessToken && nickname) {
          // We have a token, try to use it
          console.log(`🔑 Using existing access token for server ${host}`);
          // The server will validate the token and refresh if needed
        } else if (grytToken && nickname) {
          // No access token, but we have Gryt token - get join token and join the server
          console.log(`👤 Getting join token for server ${host}`);
          
          // Use a simple approach for now - just emit the join event with the Gryt token
          // The server will handle getting the join token
          socket.emit("server:join", {
            joinToken: grytToken, // For now, use the Gryt token as the join token
            nickname,
            serverToken: servers[host].token // Send server token for access control
          });
        } else {
          forceSignOutWithAccount(logout, `No authentication tokens available for server ${host}`);
          toast.error('Please sign in to Gryt Auth to continue');
        }

        socket.on("details", (data: serverDetails) => {
          console.log(`📥 Received details from server ${host}:`, data);
          
          // Check if server details were denied due to missing token
          if (data.error === "token_required") {
            console.log(`🔑 Server ${host} requires token, attempting to re-join...`);
            
            // Get the stored server token and re-attempt to join
            const storedToken = servers[host]?.token;
            if (storedToken) {
              console.log(`🔄 Re-joining server ${host} with stored token`);
              socket.emit("server:join", {
                joinToken: grytToken,
                nickname,
                serverToken: storedToken
              });
            } else {
              console.error(`❌ No stored token for server ${host}`);
              toast.error(`No access token for server ${host}. Please re-add the server.`);
              // Remove the server from the list since we can't access it
              // This would need to be implemented in the settings store
            }
            return;
          }
          
          if (data.error && data.message) {
            console.error(`🚫 Server details denied for ${host}:`, data.error, data.message);
            toast.error(`Access denied: ${data.message}`);
            return;
          }
          
          console.log(`✅ Setting server details for ${host}:`, {
            channels: data.channels?.length || 0,
            sfu_host: data.sfu_host,
            stun_hosts: data.stun_hosts?.length || 0
          });
          
          setServerDetailsList((old) => ({
            ...old,
            [host]: data,
          }));
        });

        // Handle server join response
        socket.on("server:joined", (joinInfo: { accessToken: string; nickname: string }) => {
          console.log(`✅ Joined server ${host}:`, { nickname: joinInfo.nickname, hasToken: !!joinInfo.accessToken });
          // Store the access token in localStorage for this server
          localStorage.setItem(`accessToken_${host}`, joinInfo.accessToken);
        });

        // Handle token refresh
        socket.on("token:refreshed", (refreshInfo: { accessToken: string }) => {
          console.log(`🔄 Token refreshed for server ${host}`);
          localStorage.setItem(`accessToken_${host}`, refreshInfo.accessToken);
        });

        // Handle server join errors - don't force sign out, just show error
        socket.on("server:error", (errorInfo: { error: string }) => {
          console.error(`❌ Server join failed for ${host}:`, errorInfo);
          
          // Handle specific token errors
          if (errorInfo.error === 'token_invalid') {
            console.log(`🔑 Invalid token for server ${host}, checking if we should retry...`);
            
            // Check if we have a stored token that might be different
            const storedToken = servers[host]?.token;
            if (storedToken && storedToken !== '123') { // Don't retry with hardcoded token
              console.log(`🔄 Token changed for server ${host}, updating and retrying...`);
              // The token might have changed, so we should update it
              // For now, just show a helpful message
              toast.error(`Server access token has changed. Please re-add the server with the new token.`);
            } else {
              toast.error(`Invalid server token. Please check the token and try again.`);
            }
          } else {
            toast.error(`Failed to join server ${host}: ${errorInfo.error}`);
          }
          // Don't force sign out - user can still use other servers
        });

        // Handle token errors - don't force sign out, just show error for this server
        socket.on("token:error", (errorInfo: { error: string }) => {
          console.error(`❌ Token error for server ${host}:`, errorInfo);
          toast.error(`Authentication failed for server ${host}: ${errorInfo.error}`);
          // Clear the access token for this server only
          localStorage.removeItem(`accessToken_${host}`);
          // Don't force sign out - user can still use other servers
        });

        socket.on("disconnect", () => {
          delete newSockets[host];
          toast.error(`Disconnected from ${host}`);
        });

        socket.on("clients", (data: any) => {
          console.log(`📥 CLIENT RECEIVED clients update from [${host}]:`, {
            totalClients: Object.keys(data).length,
            clientSummary: Object.entries(data).map(([id, client]: [string, any]) => ({
              id,
              nickname: client.nickname,
              hasJoinedChannel: client.hasJoinedChannel,
              isConnectedToVoice: client.isConnectedToVoice,
              streamID: client.streamID,
              isMuted: client.isMuted,
              isDeafened: client.isDeafened,
              isAFK: client.isAFK,
            })),
            timestamp: Date.now(),
            host
          });
          
          setClients((old) => {
            const newClients = {
              ...old,
              [host]: data,
            };
            
            // Log changes in client states
            if (old[host]) {
              const oldClientIds = Object.keys(old[host]);
              const newClientIds = Object.keys(data);
              
              // Check for new clients
              const addedClients = newClientIds.filter(id => !oldClientIds.includes(id));
              const removedClients = oldClientIds.filter(id => !newClientIds.includes(id));
              
              if (addedClients.length > 0) {
                console.log(`➕ CLIENTS ADDED [${host}]:`, addedClients.map(id => ({
                  id,
                  nickname: data[id].nickname,
                  hasJoinedChannel: data[id].hasJoinedChannel
                })));
              }
              
              if (removedClients.length > 0) {
                console.log(`➖ CLIENTS REMOVED [${host}]:`, removedClients.map(id => ({
                  id,
                  nickname: old[host][id]?.nickname,
                  hasJoinedChannel: old[host][id]?.hasJoinedChannel
                })));
              }
              
              // Check for state changes in existing clients
              oldClientIds.forEach(id => {
                if (data[id] && old[host][id]) {
                  const oldClient = old[host][id];
                  const newClient = data[id];
                  
                  const stateChanges: string[] = [];
                  if (oldClient.hasJoinedChannel !== newClient.hasJoinedChannel) {
                    stateChanges.push(`hasJoinedChannel: ${oldClient.hasJoinedChannel} -> ${newClient.hasJoinedChannel}`);
                  }
                  if (oldClient.isConnectedToVoice !== newClient.isConnectedToVoice) {
                    stateChanges.push(`isConnectedToVoice: ${oldClient.isConnectedToVoice} -> ${newClient.isConnectedToVoice}`);
                  }
                  if (oldClient.streamID !== newClient.streamID) {
                    stateChanges.push(`streamID: "${oldClient.streamID}" -> "${newClient.streamID}"`);
                  }
                  if (oldClient.isMuted !== newClient.isMuted) {
                    stateChanges.push(`isMuted: ${oldClient.isMuted} -> ${newClient.isMuted}`);
                  }
                  if (oldClient.isDeafened !== newClient.isDeafened) {
                    stateChanges.push(`isDeafened: ${oldClient.isDeafened} -> ${newClient.isDeafened}`);
                  }
                  if (oldClient.isAFK !== newClient.isAFK) {
                    stateChanges.push(`isAFK: ${oldClient.isAFK} -> ${newClient.isAFK}`);
                  }
                  
                  if (stateChanges.length > 0) {
                    console.log(`🔄 CLIENT STATE CHANGE [${host}][${id}] ${newClient.nickname}:`, stateChanges);
                  }
                }
              });
            }
            
            return newClients;
          });
        });

        // Add peer join/leave room event handlers for sound notifications
        socket.on("peerJoinedRoom", (data: { clientId: string; nickname: string }) => {
          console.log("🔊 Peer joined room:", data.nickname);
          if (connectSoundEnabled) {
            try {
              connectSound();
            } catch (error) {
              console.error("Error playing peer join sound:", error);
            }
          }
        });

        socket.on("peerLeftRoom", (data: { clientId: string; nickname: string }) => {
          console.log("🔇 Peer left room:", data.nickname);
          if (disconnectSoundEnabled) {
            try {
              disconnectSound();
            } catch (error) {
              console.error("Error playing peer leave sound:", error);
            }
          }
        });

        socket.on("error", (msg: any) => {
          const text = typeof msg === "string" ? msg : (msg?.message || "Unknown socket error");
          toast.error(`[${host}] ${text}`);
        });
      }
    });

    if (changed) {
      setSockets(newSockets);
    }
  }, [servers, connectSound, disconnectSound, connectSoundEnabled, disconnectSoundEnabled]);

  return { sockets, serverDetailsList, clients, getChannelDetails };
}

export const useSockets = singletonHook(
  {
    sockets: {},
    serverDetailsList: {},
    clients: {},
    getChannelDetails: () => undefined,
  },
  useSocketsHook
);
