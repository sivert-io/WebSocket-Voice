export interface Clients {
  [id: string]: {
    nickname: string;
    color: string;
    isMuted: boolean;
    streamID: string;
  };
}
