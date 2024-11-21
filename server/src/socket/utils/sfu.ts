import { Socket } from "socket.io";
import { getChannelPermissions } from "./server";

export function connectToChannel(socket: Socket, channelID: string) {
  const permissions = getChannelPermissions(channelID);
}
