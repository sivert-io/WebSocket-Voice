import { singletonHook } from "react-singleton-hook";
import { useEffect, useState } from "react";
import { useSettings } from "@/settings";
import { Socket, io } from "socket.io-client";
import {
  Server,
  serverDetails,
  serverDetailsList,
} from "@/settings/src/types/server";

type Sockets = { [host: string]: Socket };

function sockets() {
  const [sockets, setSockets] = useState<Sockets>({});
  const { servers, addServer } = useSettings();
  const [newServerInfo, setNewServerInfo] = useState<Server[]>([]);
  const [serverDetailsList, setServerDetailsList] = useState<serverDetailsList>(
    {}
  );

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
              icon: data.icon,
            },
          ]);
        });

        socket.on("details", (data: serverDetails) => {
          setServerDetailsList((old) => ({
            ...old,
            [host]: data,
          }));
        });
      }
    });
    setSockets(newSockets);
  }, [servers]);

  return { sockets, serverDetailsList };
}

export const useSockets = singletonHook(
  {
    sockets: {},
    serverDetailsList: {},
  },
  sockets
);
