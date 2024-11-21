export function getChannels() {
  // get channels from database
  return [
    {
      id: "1",
      name: "General",
      description: "General chat",
      permissions: {
        canStream: true,
        canChat: true,
        canJoin: "*",
      },
    },
    {
      id: "2",
      name: "Music",
      description: "Music chat",
    },
  ];
}

export function getChannelPermissions(channelID: string) {
  // get channel permissions from database
  return {
    canStream: true,
    canChat: true,
    canJoin: true,
  };
}
