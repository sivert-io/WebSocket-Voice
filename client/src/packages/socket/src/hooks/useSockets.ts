import { useEffect, useState } from "react";
import { singletonHook } from "react-singleton-hook";
import { io, Socket } from "socket.io-client";
import useSound from "use-sound";

import { useSettings } from "@/settings";
import {
  Server,
  serverDetails,
  serverDetailsList,
} from "@/settings/src/types/server";

// Import sound files
import connectMp3 from "@/audio/src/assets/connect.mp3";
import disconnectMp3 from "@/audio/src/assets/disconnect.mp3";

import { Clients } from "../types/clients";

type Sockets = { [host: string]: Socket };

function useSocketsHook() {
  const [sockets, setSockets] = useState<Sockets>({});
  const { 
    servers, 
    addServer, 
    nickname,
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

  // Update nickname on all servers
  useEffect(() => {
    Object.keys(servers).forEach((host) => {
      console.log("Sending nickname");

      sockets[host]?.emit("updateNickname", nickname);
    });
  }, [nickname, servers]);

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

    Object.keys(servers).forEach((host) => {
      if (!newSockets[host]) {
        const socket = io(`wss://${host}`, {
          auth: {
            token: servers[host].token,
          },
        });
        newSockets[host] = socket;

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
        });

        socket.on("clients", (data: any) => {
          setClients((old) => ({
            ...old,
            [host]: data,
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
      }
    });

    setSockets(newSockets);
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
