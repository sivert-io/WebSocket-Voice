export type Channel = {
  id: string;
  name: string;
  description: string;
  permissions?: {
    canStream: boolean;
    canJoinRole: "*";
  };
};
