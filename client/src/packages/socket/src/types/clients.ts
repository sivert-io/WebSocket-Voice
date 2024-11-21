export type Client = {
  nickname: string;
  isMuted: boolean;
  color: string;
  streamID: string;
  hasJoinedChannel: boolean;
};

export type Clients = { [id: string]: Client };
