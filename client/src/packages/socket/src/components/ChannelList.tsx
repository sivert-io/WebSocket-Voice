import { Button, Flex } from "@radix-ui/themes";
import { AnimatePresence, motion } from "motion/react";
import { ChatBubbleIcon, SpeakerLoudIcon } from "@radix-ui/react-icons";
import { Channel } from "@/settings/src/types/server";
import { ConnectedUser } from "./connectedUser";
import { SkeletonBase } from "./skeletons";

export const ChannelList = ({
  channels,
  serverHost,
  clients,
  currentChannelId,
  currentServerConnected,
  showVoiceView,
  isConnecting,
  currentConnectionId,
  selectedChannelId,
  onChannelClick,
  clientsSpeaking,
}: {
  channels: Channel[];
  serverHost: string;
  clients: Record<string, any>;
  currentChannelId: string;
  currentServerConnected: string | null;
  showVoiceView: boolean;
  isConnecting: boolean;
  currentConnectionId?: string;
  selectedChannelId: string | null;
  onChannelClick: (channel: Channel) => void;
  clientsSpeaking: Record<string, boolean>;
}) => {
  return (
    <Flex direction="column" gap="3" align="center" width="100%">
      {channels.map((channel) => (
        <Flex
          direction="column"
          align="start"
          width="100%"
          key={serverHost + channel.id}
          position="relative"
        >
          <Button
            variant={
              channel.type === "voice"
                ? (channel.id === currentChannelId &&
                   serverHost === currentServerConnected
                    ? "solid"
                    : channel.id === selectedChannelId
                    ? "solid"
                    : "soft")
                : (channel.id === selectedChannelId ? "solid" : "soft")
            }
            radius="large"
            style={{
              width: "100%",
              justifyContent: "start",
            }}
            onClick={() => onChannelClick(channel)}
          >
            {channel.type === "voice" ? <SpeakerLoudIcon /> : <ChatBubbleIcon />}
            {channel.name}
            {channel.type === "voice" &&
              isConnecting &&
              channel.id === currentChannelId &&
              serverHost === currentServerConnected && (
                <SkeletonBase 
                  width="16px" 
                  height="16px" 
                  borderRadius="50%" 
                  style={{ marginLeft: "auto" }} 
                />
              )}
          </Button>

          {channel.type === "voice" && (
            <AnimatePresence initial={false}>
              {Object.values(clients).some((c: any) => c.hasJoinedChannel) && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.25 }}
                  style={{ overflow: "hidden", width: "100%" }}
                >
                  <Flex
                    width="100%"
                    pt="2"
                    direction="column"
                    style={{
                      background: "var(--color-panel)",
                      borderRadius: "0 0 12px 12px",
                    }}
                  >
                    {Object.keys(clients)?.map(
                      (id) =>
                        clients[id].hasJoinedChannel && (
                          <ConnectedUser
                            isSpeaking={clientsSpeaking[id] || false}
                            isMuted={clients[id].isMuted}
                            isDeafened={clients[id].isDeafened}
                            isAFK={clients[id].isAFK}
                            nickname={clients[id].nickname}
                            isConnectedToVoice={clients[id].isConnectedToVoice ?? true}
                            isConnectingToVoice={
                              id === currentConnectionId &&
                              isConnecting &&
                              serverHost === currentServerConnected &&
                              channel.id === currentChannelId
                            }
                            key={id}
                          />
                        )
                    )}
                  </Flex>
                </motion.div>
              )}
            </AnimatePresence>
          )}
        </Flex>
      ))}
    </Flex>
  );
}; 