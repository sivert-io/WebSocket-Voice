import { singletonHook } from "react-singleton-hook";
import { useEffect, useState } from "react";
import { FetchInfo, useSettings } from "@/settings";
import { Socket, io } from "socket.io-client";
import { Server } from "@/settings/src/types/server";

type Sockets = { [host: string]: Socket };

function sockets() {
  const [sockets, setSockets] = useState<Sockets>({});
  const { servers, addServer } = useSettings();
  const [newServerInfo, setNewServerInfo] = useState<Server[]>([]);

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
        const socket = io(`wss://${host}`);
        newSockets[host] = socket;

        socket.on("info", (data: FetchInfo) => {
          setNewServerInfo((old) => [
            ...old,
            { host, name: data.name, icon: data.icon },
          ]);
        });
      }
    });
    setSockets(newSockets);
  }, [servers]);

  return sockets;
}

export const useSockets = singletonHook({}, sockets);
