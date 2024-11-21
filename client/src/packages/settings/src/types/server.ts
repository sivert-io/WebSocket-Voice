export type Channel = {
  name: string;
  type: "text" | "voice";
  id: string;
  clients?: string[];
};

export type serverDetails = {
  channels: Channel[];
  sfu_host: string;
  stun_hosts: string[];
};

export type serverDetailsList = {
  [host: string]: serverDetails;
};

export type Server = {
  host: string;
  name: string;
  icon: string;
  token: string;
};

export type Servers = {
  [host: string]: Server;
};
