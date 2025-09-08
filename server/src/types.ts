export interface Clients {
  [id: string]: {
    grytUserId?: string; // Internal Gryt Auth user ID (never exposed to clients)
    serverUserId: string; // Secret server user ID (never exposed to clients)
    nickname: string;
    color: string;
    isMuted: boolean;
    isDeafened: boolean;
    streamID: string;
    hasJoinedChannel: boolean;
    isConnectedToVoice?: boolean;
    isAFK: boolean;
    accessToken?: string; // JWT access token for this server
    serverToken?: string; // Server token for access control
  };
}
