export interface Clients {
  [id: string]: {
    nickname: string;
    color: string;
    isMuted: boolean;
    isDeafened: boolean;
    streamID: string;
    hasJoinedChannel: boolean;
    isConnectedToVoice?: boolean;
    isAFK: boolean;
  };
}
