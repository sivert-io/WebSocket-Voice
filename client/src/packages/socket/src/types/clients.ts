export type Client = {
  nickname: string;
  isMuted: boolean;
  color: string;
  streamID: string;
  hasJoinedChannel: boolean;
  isConnectedToVoice?: boolean;
};

export type Clients = { [id: string]: Client };
