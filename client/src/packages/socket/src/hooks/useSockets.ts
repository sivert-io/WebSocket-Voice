import { singletonHook } from "react-singleton-hook";
import { useEffect, useState } from "react";
import { useSettings } from "@/settings";
import { Socket, io } from "socket.io-client";
import {
  Server,
  serverDetails,
  serverDetailsList,
} from "@/settings/src/types/server";
import { Clients } from "../types/clients";

type Sockets = { [host: string]: Socket };

function sockets() {
  const [sockets, setSockets] = useState<Sockets>({});
  const { servers, addServer, nickname } = useSettings();
  const [newServerInfo, setNewServerInfo] = useState<Server[]>([]);
  const [serverDetailsList, setServerDetailsList] = useState<serverDetailsList>(
    {}
  );
  const [clients, setClients] = useState<{ [host: string]: Clients }>({});

  function getChannelDetails(host: string, channel: string) {
    return serverDetailsList[host]?.channels.find((c) => c.id === channel);
  }

  useEffect(() => {
    Object.keys(servers).forEach((host) => {
      console.log("Sending nickname");

      sockets[host]?.emit("updateNickname", nickname);
    });
  }, [nickname, servers]);

  useEffect(() => {
    const info = [...newServerInfo];
    newServerInfo.forEach((server) => {
      addServer(servers, server);
      info.splice(info.indexOf(server), 1);
    });
    if (info.length !== newServerInfo.length) setNewServerInfo(info);
  }, [servers, newServerInfo]);

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
      }
    });
    setSockets(newSockets);
  }, [servers]);

  return { sockets, serverDetailsList, clients, getChannelDetails };
}

export const useSockets = singletonHook(
  {
    sockets: {},
    serverDetailsList: {},
    clients: {},
    getChannelDetails: () => undefined,
  },
  sockets
);
