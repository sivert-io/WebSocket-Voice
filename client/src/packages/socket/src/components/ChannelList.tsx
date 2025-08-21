import { Button, Flex, Spinner } from "@radix-ui/themes";
import { AnimatePresence } from "motion/react";
import { ChatBubbleIcon, SpeakerLoudIcon } from "@radix-ui/react-icons";
import { Channel } from "@/settings/src/types/server";
import { ConnectedUser } from "./connectedUser";

export const ChannelList = ({
  channels,
  serverHost,
  clients,
  currentChannelId,
  currentServerConnected,
  showVoiceView,
  isConnecting,
  currentConnectionId,
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
              channel.id === currentChannelId &&
              serverHost === currentServerConnected &&
              showVoiceView
                ? "solid"
                : "soft"
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
                <Spinner size="1" style={{ marginLeft: "auto" }} />
              )}
          </Button>

          {channel.type === "voice" && (
            <Flex
              position="absolute"
              top="0"
              width="100%"
              pt="6"
              direction="column"
              style={{
                background: "var(--color-panel-translucent)",
                borderRadius: "0 0 12px 12px",
                zIndex: -1,
              }}
            >
              <AnimatePresence initial={false}>
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
              </AnimatePresence>
            </Flex>
          )}
        </Flex>
      ))}
    </Flex>
  );
}; 