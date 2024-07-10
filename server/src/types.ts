export interface Clients {
  [id: string]: {
    nickname: string;
    isSpeaking: boolean;
    color: string;
    isMuted: boolean;
  };
}
