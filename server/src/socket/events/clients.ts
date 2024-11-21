import { Server } from "socket.io";
import { syncAllClients } from "../utils/clients";

export const updateNickname = (io: Server, nickname: string) => {
  clientsInfo[id] = {
    ...clientsInfo[id],
    nickname: json.value,
  };
  syncAllClients(io, clientsInfo);
};
