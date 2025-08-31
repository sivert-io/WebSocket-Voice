import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { singletonHook } from "react-singleton-hook";
import { io, Socket } from "socket.io-client";
import useSound from "use-sound";

// Import sound files
import connectMp3 from "@/audio/src/assets/connect.mp3";
import disconnectMp3 from "@/audio/src/assets/disconnect.mp3";
import { useSettings } from "@/settings";
import {
  Server,
  serverDetails,
  serverDetailsList,
} from "@/settings/src/types/server";

import { Clients } from "../types/clients";

type Sockets = { [host: string]: Socket };

function useSocketsHook() {
  const [sockets, setSockets] = useState<Sockets>({});
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
        const socket = io(`wss://${host}`, {
          auth: {
            token: servers[host].token,
          },
        });
        newSockets[host] = socket;
        changed = true;

        socket.on("info", (data: Server) => {
          setNewServerInfo((old) => [
            ...old,
            {
              ...servers[host],
              name: data.name,
            },
          ]);
        });

        socket.on("details", (data: serverDetails) => {
          setServerDetailsList((old) => ({
            ...old,
            [host]: data,
          }));
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
        socket.on("error", (msg: any) => {
          const text = typeof msg === "string" ? msg : (msg?.message || "Unknown socket error");
          toast.error(`[${host}] ${text}`);
        });
          if (disconnectSoundEnabled) {
            try {
              disconnectSound();
            } catch (error) {
              console.error("Error playing peer leave sound:", error);
            }
          }
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
