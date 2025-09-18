import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { singletonHook } from "react-singleton-hook";
import { io, Socket } from "socket.io-client";
import useSound from "use-sound";

// Import sound files
import connectMp3 from "@/audio/src/assets/connect.mp3";
import disconnectMp3 from "@/audio/src/assets/disconnect.mp3";
import { useSettings } from "@/settings";
import { useServerSettings } from "@/settings/src/hooks/useServerSettings";
import { checkAuthenticationOnLaunch, canUseServer, forceSignOutWithAccount } from "@/common";
import { useAccount } from "@/common";
import { handleRateLimitError } from "../utils/rateLimitHandler";
// import { useUserId } from "@/common"; // No longer needed with JWT system
import {
  Server,
  serverDetails,
  serverDetailsList,
} from "@/settings/src/types/server";

import { Clients } from "../types/clients";
import { MemberInfo } from "../components/MemberSidebar";

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
  
  const { 
    servers, 
    setServers,
    currentlyViewingServer,
    setCurrentlyViewingServer,
  } = useServerSettings();
  const [newServerInfo, setNewServerInfo] = useState<Server[]>([]);
  const [serverDetailsList, setServerDetailsList] = useState<serverDetailsList>(
    {}
  );
  const [failedServerDetails, setFailedServerDetails] = useState<Record<string, { error: string; message: string; timestamp: number }>>({});
  const [clients, setClients] = useState<{ [host: string]: Clients }>({});
  const [memberLists, setMemberLists] = useState<{ [host: string]: MemberInfo[] }>({});
  const [serverConnectionStatus, setServerConnectionStatus] = useState<Record<string, 'connected' | 'disconnected' | 'connecting'>>({});
  // const [reconnectAttempts, setReconnectAttempts] = useState<Record<string, number>>({});

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

  function requestMemberList(host: string) {
    const socket = sockets[host];
    if (socket && socket.connected) {
      console.log(`📤 CLIENT REQUESTING member list from [${host}]`);
      socket.emit('members:fetch');
    } else {
      console.warn(`⚠️ Cannot request member list from [${host}] - socket not connected`);
    }
  }

  // Send complete client state whenever any state changes
  useEffect(() => {
    Object.keys(sockets).forEach((host) => {
      const clientState = {
        isMuted,
        isDeafened,
        isAFK,
        nickname
      };
      console.log("Sending client state:", clientState);
      sockets[host]?.emit("updateClientState", clientState);
    });
  }, [isMuted, isDeafened, isAFK, nickname, sockets]);

  // Add new or update servers to the list
  useEffect(() => {
    if (newServerInfo.length > 0) {
      console.log("🔄 PROCESSING new server info:", newServerInfo);
      console.log("🔄 Current servers before processing:", servers);
      
      newServerInfo.forEach((server, index) => {
        console.log(`🔄 Processing server ${index + 1}/${newServerInfo.length}:`, server);
        
        // Check if server already exists and is the same
        const existingServer = servers[server.host];
        if (existingServer && existingServer.name === server.name) {
          console.log("🔄 Server already exists with same name, skipping add:", server.host);
          return;
        }
        
        // Add the server directly
        const newServers = { ...servers, [server.host]: server };
        console.log("🔄 Adding server directly:", server.host);
        setServers(newServers);
        
        // Auto-focus the first newly added server if no server is currently being viewed
        // Use setTimeout to ensure the server is added to state before focusing
        if (!currentlyViewingServer && index === 0) {
          console.log("🎯 SCHEDULING AUTO-FOCUS for first newly added server:", server.name, "host:", server.host);
          setTimeout(() => {
            console.log("🎯 EXECUTING DELAYED AUTO-FOCUS for server:", server.host);
            setCurrentlyViewingServer(server.host);
          }, 100); // Small delay to ensure state is updated
        }
      });
      
      console.log("🔄 Clearing newServerInfo queue...");
      // Clear the processed server info
      setNewServerInfo([]);
    }
  }, [newServerInfo, servers, setServers, currentlyViewingServer, setCurrentlyViewingServer]);

  // Create sockets for all servers
  useEffect(() => {
    const newSockets = { ...sockets };
    let changed = false;

    Object.keys(servers).forEach((host) => {
      if (!newSockets[host]) {
        // Get access token for this server if available
        const accessToken = localStorage.getItem(`accessToken_${host}`);
        
        const socket = io(`wss://${host}`, {
          auth: {
            token: servers[host].token,
            accessToken: accessToken || undefined,
          },
        });
        
        // Log all WebSocket events for this socket
        console.log(`🔌 CREATING SOCKET for ${host}:`, {
          url: `wss://${host}`,
          auth: {
            token: servers[host].token ? "***" : "none",
            accessToken: accessToken ? "***" : "none"
          }
        });

        // Log all outgoing events (client to server)
        const originalEmit = socket.emit;
        socket.emit = function(event: string, ...args: any[]) {
          console.log(`📤 CLIENT EMITTING to [${host}]:`, event, args.length > 0 ? args : '');
          return originalEmit.call(this, event, ...args);
        };

        // Log all incoming events (server to client)
        socket.onAny((event: string, ...args: any[]) => {
          console.log(`📥 CLIENT RECEIVED from [${host}]:`, event, args.length > 0 ? args : '');
        });
        
        newSockets[host] = socket;
        changed = true;
        
        // Set initial connecting status
        setServerConnectionStatus(prev => ({ ...prev, [host]: 'connecting' }));
        
        socket.on("connect", () => {
          console.log(`✅ Connected to server ${host}`);
          setServerConnectionStatus(prev => ({ ...prev, [host]: 'connected' }));
          // setReconnectAttempts(prev => ({ ...prev, [host]: 0 })); // Reset reconnect attempts on successful connection
          
          // Request server info immediately after connection
          console.log(`📤 CLIENT REQUESTING server info from [${host}]`);
          console.log(`📤 Socket ID: ${socket.id}, Socket connected: ${socket.connected}`);
          socket.emit("info");
          console.log(`📤 Info request emitted to [${host}]`);
        });
        
        socket.on("connect_error", (error) => {
          console.error(`❌ Connection error to server ${host}:`, error);
          setServerConnectionStatus(prev => ({ ...prev, [host]: 'disconnected' }));
          
          // Auto-reconnect with exponential backoff (max 3 attempts)
          // setReconnectAttempts(prev => {
          //   const currentAttempts = prev[host] || 0;
          //   if (currentAttempts < 3) {
          //     const delay = Math.min(1000 * Math.pow(2, currentAttempts), 10000); // 1s, 2s, 4s, max 10s
          //     console.log(`🔄 Auto-reconnecting to ${host} in ${delay}ms (attempt ${currentAttempts + 1}/3)`);
          //     setTimeout(() => {
          //       socket.connect();
          //     }, delay);
          //     return { ...prev, [host]: currentAttempts + 1 };
          //   }
          //   return prev;
          // });
        });

        socket.on("voice_error", (error: { type: string; message: string; existingConnection?: any }) => {
          console.error(`🚫 Voice error from server ${host}:`, error);
          
          if (error.type === 'duplicate_connection') {
            // Handle duplicate connection error
            console.warn(`🚫 Duplicate voice connection detected:`, error.message);
            if (error.existingConnection) {
              console.warn(`   - Existing connection: ${error.existingConnection.nickname} (${error.existingConnection.clientId})`);
            }
            
            // You could show a toast notification here
            // toast.error(error.message);
          }
        });

        socket.on("device_switch_disconnect", (data: { type: string; message: string; newDevice?: any }) => {
          console.warn(`🔄 Device switch disconnect from server ${host}:`, data);
          
          if (data.type === 'device_switch') {
            // Handle device switch disconnect
            console.warn(`🔄 Disconnected due to device switch:`, data.message);
            if (data.newDevice) {
              console.warn(`   - Connected from: ${data.newDevice.nickname} (${data.newDevice.clientId})`);
            }
            
            // Trigger device switch modal
            window.dispatchEvent(new CustomEvent('device_switch_disconnect', {
              detail: {
                message: data.message,
                newDevice: data.newDevice
              }
            }));
          }
        });

        // Handle server-initiated voice disconnects (for device switching)
        socket.on("joinedChannel", (hasJoined: boolean) => {
          console.log(`📡 Server set joinedChannel to ${hasJoined} for ${host}`);
          
          if (!hasJoined) {
            // Server is forcing us to leave voice - trigger disconnect
            console.log(`🔄 Server initiated voice disconnect for ${host}`);
            window.dispatchEvent(new CustomEvent('server_voice_disconnect', {
              detail: { host, reason: 'server_initiated' }
            }));
          }
        });

        socket.on("streamID", (streamID: string) => {
          console.log(`📡 Server set streamID to "${streamID}" for ${host}`);
          
          if (!streamID) {
            // Server cleared our streamID - trigger disconnect
            console.log(`🔄 Server cleared streamID for ${host}`);
            window.dispatchEvent(new CustomEvent('server_voice_disconnect', {
              detail: { host, reason: 'stream_cleared' }
            }));
          }
        });

        socket.on("leaveRoom", () => {
          console.log(`📡 Server sent leaveRoom for ${host}`);
          
          // Server is forcing us to leave room - trigger disconnect
          console.log(`🔄 Server initiated room leave for ${host}`);
          window.dispatchEvent(new CustomEvent('server_voice_disconnect', {
            detail: { host, reason: 'room_leave' }
          }));
        });

        socket.on("info", (data: any) => {
          console.log(`📥 CLIENT RECEIVED server info from [${host}]:`, data);
          console.log(`📥 Current servers[${host}]:`, servers[host]);
          
          const updatedServer = {
            ...servers[host],
            name: data.name || servers[host]?.name || host,
          };
          
          console.log(`📥 Updated server object:`, updatedServer);
          
          // Check if the server name has actually changed
          const currentServer = servers[host];
          if (currentServer && currentServer.name === updatedServer.name) {
            console.log(`📥 Server ${host} name unchanged (${updatedServer.name}), skipping processing`);
            return;
          }
          
          console.log(`📥 Adding to newServerInfo queue...`);
          
          setNewServerInfo((old) => {
            // Check if this server is already in the queue to prevent duplicates
            const alreadyExists = old.some(server => server.host === updatedServer.host);
            if (alreadyExists) {
              console.log(`📥 Server ${updatedServer.host} already in queue, skipping duplicate`);
              return old;
            }
            
            const newInfo = [
              ...old,
              updatedServer,
            ];
            console.log(`📥 newServerInfo updated:`, newInfo);
            return newInfo;
          });
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
          // Request server details since we should be authenticated
          setTimeout(() => {
            console.log(`📤 Requesting server details for ${host} (reconnected)`);
            socket.emit("server:details");
          }, 1000); // Small delay to ensure server is ready
        } else {
          // No access token - join server with password (if required)
          console.log(`👤 Joining server ${host} with password`);
          
          // For now, try joining without password (server will allow if no password set)
          // TODO: Add password input UI
          socket.emit("server:join", {
            password: "", // Empty password - server will allow if no password set
            nickname
          });
        }

        socket.on("details", (data: serverDetails) => {
          
          // Check if server details were denied due to not joining
          if (data.error === "join_required") {
            console.log(`🔑 Server ${host} requires joining, attempting to re-join...`);
            
            // Add a delay to prevent rate limiting
            setTimeout(() => {
              console.log(`🔄 Re-joining server ${host}`);
              socket.emit("server:join", {
                joinToken: grytToken,
                nickname
              });
            }, 500); // 0.5 second delay
          }
          
          if (data.error && data.message) {
            console.error(`🚫 Server details denied for ${host}:`, data.error, data.message);
            
            // Track failed server details request
            setFailedServerDetails(prev => ({
              ...prev,
              [host]: {
                error: data.error || 'unknown_error',
                message: data.message || 'Unknown error occurred',
                timestamp: Date.now()
              }
            }));
            
            // Handle rate limiting specifically
            if (data.error === 'rate_limited') {
              handleRateLimitError({
                error: data.error,
                message: data.message
              }, "Server details");
            } else {
              toast.error(`Access denied: ${data.message}`);
            }
            return;
          }
          
          setServerDetailsList((old) => {
            const updated = {
              ...old,
              [host]: data,
            };
            return updated;
          });
          
          // Clear any previous failure for this server
          setFailedServerDetails(prev => {
            const updated = { ...prev };
            delete updated[host];
            return updated;
          });
        });

        // Handle server join response
        socket.on("server:joined", (joinInfo: { accessToken: string; nickname: string }) => {
          console.log(`✅ Joined server ${host}:`, { nickname: joinInfo.nickname, hasToken: !!joinInfo.accessToken });
          // Store the access token in localStorage for this server
          localStorage.setItem(`accessToken_${host}`, joinInfo.accessToken);
          
          // Request server details now that we've joined
          console.log(`📤 Requesting server details for ${host}`);
          socket.emit("server:details");
        });

        // Handle token refresh
        socket.on("token:refreshed", (refreshInfo: { accessToken: string }) => {
          console.log(`🔄 Token refreshed for server ${host}`);
          localStorage.setItem(`accessToken_${host}`, refreshInfo.accessToken);
        });

        // Handle server join errors - don't force sign out, just show error
        socket.on("server:error", (errorInfo: { error: string; message?: string; retryAfterMs?: number; currentScore?: number; maxScore?: number; canReapply?: boolean }) => {
          console.error(`❌ Server join failed for ${host}:`, errorInfo);
          
          // Handle rate limiting with user-friendly message
          if (errorInfo.error === 'rate_limited' && errorInfo.message) {
            handleRateLimitError(errorInfo, "Server connection");
            return;
          }
          
          // Handle password errors
          if (errorInfo.error === 'invalid_password') {
            console.log(`🚫 Invalid password for server ${host}:`, errorInfo);
            
            // Show user-friendly error message
            const message = errorInfo.message || 'Invalid server password.';
            toast.error(message, { duration: 6000 });
            
            // TODO: Show password input dialog
            setTimeout(() => {
              toast(
                `Please check with the server administrator for the correct password.`,
                { duration: 8000 }
              );
            }, 2000);
            return;
          }
          
          // Handle user authorization errors (legacy)
          if (errorInfo.error === 'user_not_authorized' || errorInfo.error === 'join_token_invalid' || errorInfo.error === 'join_verification_failed') {
            console.log(`🚫 User authorization failed for server ${host}:`, errorInfo);
            
            // Show user-friendly error message
            const message = errorInfo.message || 'You are not authorized to join this server.';
            toast.error(message, { duration: 6000 });
            
            // Show follow-up action message after a delay
            setTimeout(() => {
              if (errorInfo.canReapply) {
                toast(
                  `You can re-apply to join this server or remove it from your list. Check the server settings for more options.`,
                  { 
                    duration: 8000,
                    icon: 'ℹ️'
                  }
                );
              } else {
                toast(
                  `You can remove this server from your list if you no longer need access.`,
                  { 
                    duration: 6000,
                    icon: 'ℹ️'
                  }
                );
              }
            }, 2000);
            return;
          }
          
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
          setServerConnectionStatus(prev => ({ ...prev, [host]: 'disconnected' }));
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

        // Handle member list updates
        socket.on("members:list", (data: MemberInfo[]) => {
          console.log(`📥 CLIENT RECEIVED members:list from [${host}]:`, {
            totalMembers: data.length,
            memberSummary: data.map(member => ({
              serverUserId: member.serverUserId,
              nickname: member.nickname,
              status: member.status,
              isConnectedToVoice: member.isConnectedToVoice,
              hasJoinedChannel: member.hasJoinedChannel,
            })),
            timestamp: Date.now(),
            host
          });
          
          // Override all member colors to gray for consistency
          const membersWithGrayColor = data.map(member => ({
            ...member,
            color: "var(--gray-6)" // Use a consistent gray color
          }));
          
          setMemberLists((old) => ({
            ...old,
            [host]: membersWithGrayColor,
          }));
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

  // Function to leave a server
  const leaveServer = (host: string) => {
    const socket = sockets[host];
    if (socket) {
      console.log(`📤 Leaving server: ${host}`);
      socket.emit('server:leave');
      
      // Listen for server:left confirmation
      socket.once('server:left', (data: { message: string }) => {
        console.log(`✅ Successfully left server ${host}:`, data.message);
        toast.success(`Left server ${host}`);
      });
      
      // Listen for server:error
      socket.once('server:error', (error: string) => {
        console.error(`❌ Failed to leave server ${host}:`, error);
        toast.error(`Failed to leave server: ${error}`);
      });
    } else {
      console.warn(`⚠️ No socket found for server: ${host}`);
      toast.error(`Not connected to server ${host}`);
    }
  };

  return { sockets, serverDetailsList, clients, memberLists, getChannelDetails, requestMemberList, failedServerDetails, serverConnectionStatus, leaveServer };
}

export const useSockets = singletonHook(
  {
    sockets: {},
    serverDetailsList: {},
    clients: {},
    memberLists: {},
    getChannelDetails: () => undefined,
    requestMemberList: () => {},
    failedServerDetails: {},
    serverConnectionStatus: {},
    leaveServer: () => {},
  },
  useSocketsHook
);
