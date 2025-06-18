export type Client = {
  nickname: string;
  isMuted: boolean;
  isDeafened: boolean;
  color: string;
  streamID: string;
  hasJoinedChannel: boolean;
  isConnectedToVoice?: boolean;
  isAFK: boolean;
};

export type Clients = { [id: string]: Client };
