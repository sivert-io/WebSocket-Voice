export type UserStatus = 'online' | 'in_voice' | 'afk' | 'offline';

export type Client = {
  nickname: string;
  isMuted: boolean;
  isDeafened: boolean;
  color: string;
  streamID: string;
  hasJoinedChannel: boolean;
  isConnectedToVoice?: boolean;
  isAFK: boolean;
  status?: UserStatus;
  lastSeen?: Date;
};

export type Clients = { [id: string]: Client };
