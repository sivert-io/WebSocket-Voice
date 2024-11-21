export type Server = {
  host: string;
  name: string;
  icon: string;
};

export type Servers = {
  [host: string]: Server;
};
