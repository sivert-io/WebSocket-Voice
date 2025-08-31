import { Avatar, Flex, Spinner, Text } from "@radix-ui/themes";
import { AnimatePresence, motion } from "motion/react";
import { useRef } from "react";
import { BsVolumeOffFill } from "react-icons/bs";
import { MdMicOff } from "react-icons/md";
import { Controls } from "@/webRTC";

export const VoiceView = ({
  showVoiceView,
  voiceWidth,
  serverHost,
  currentServerConnected,
  clientsForHost,
  clientsSpeaking,
  isConnecting,
  currentConnectionId,
}: {
  showVoiceView: boolean;
  voiceWidth: string;
  serverHost: string;
  currentServerConnected: string | null;
  clientsForHost: Record<string, any>;
  clientsSpeaking: Record<string, boolean>;
  isConnecting: boolean;
  currentConnectionId?: string;
}) => {
  const prevPeerStatesRef = useRef<Record<string, boolean>>({});

  return (
    <motion.div
      transition={{ type: "spring", stiffness: 300, damping: 30 }}
      animate={{
        width: showVoiceView ? voiceWidth : 0,
        paddingRight: !showVoiceView || voiceWidth === "0px" ? 0 : 16 * 1.15 + "px",
      }}
      style={{
        overflow: "hidden",
      }}
    >
      <Flex
        style={{
          background: "var(--color-panel)",
          borderRadius: "12px",
        }}
        height="100%"
        width="100%"
        direction="column"
        p="3"
      >
        <Flex
          direction="column"
          gap="4"
          justify="center"
          align="center"
          flexGrow="1"
          position="relative"
        >
          <AnimatePresence>
            {currentServerConnected === serverHost &&
              Object.keys(clientsForHost)?.map((id) => {
                const client = clientsForHost[id];
                const isUserConnecting = id === currentConnectionId && isConnecting;
                const shouldShow = client.hasJoinedChannel || isUserConnecting;

                if (prevPeerStatesRef.current[id] !== shouldShow) {
                  // eslint-disable-next-line no-console
                  console.log(
                    `🎭 VOICE VIEW PEER [${id}] ${client.nickname}: shouldShow ${prevPeerStatesRef.current[id]} -> ${shouldShow} (hasJoinedChannel: ${client.hasJoinedChannel}, isConnecting: ${isUserConnecting})`
                  );
                  prevPeerStatesRef.current[id] = shouldShow;
                }

                return (
                  shouldShow && (
                    <motion.div
                      layout
                      transition={{ duration: 0.25, ease: "easeInOut" }}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      key={id}
                      onAnimationStart={() => {
                        // eslint-disable-next-line no-console
                        console.log(`🎬 VOICE PEER ANIMATION START [${id}]:`, client.nickname);
                      }}
                      onAnimationComplete={() => {
                        // eslint-disable-next-line no-console
                        console.log(`🎬 VOICE PEER ANIMATION COMPLETE [${id}]:`, client.nickname);
                      }}
                      style={{
                        background: clientsSpeaking[id]
                          ? "var(--accent-3)"
                          : "var(--color-panel)",
                        borderRadius: "12px",
                        opacity: client.isConnectedToVoice ?? true ? 1 : 0.5,
                        transition: "opacity 0.3s ease, background-color 0.1s ease",
                        border: clientsSpeaking[id]
                          ? "1px solid var(--accent-6)"
                          : "1px solid transparent",
                      }}
                    >
                      <Flex align="center" justify="center" direction="column" gap="1" px="8" py="4">
                        <Flex align="center" justify="center" position="relative">
                          <Avatar
                            fallback={client.nickname[0]}
                            style={{
                              outline: clientsSpeaking[id] ? "3px solid" : "2px solid",
                              outlineColor: clientsSpeaking[id] ? "var(--accent-9)" : "transparent",
                              transition: "outline-color 0.1s ease, outline-width 0.1s ease",
                              boxShadow: clientsSpeaking[id] ? "0 0 12px var(--accent-7)" : "none",
                            }}
                          />
                          {isUserConnecting && (
                            <Flex
                              position="absolute"
                              align="center"
                              justify="center"
                              style={{
                                top: 0,
                                left: 0,
                                right: 0,
                                bottom: 0,
                                background: "var(--color-panel-translucent)",
                                borderRadius: "50%",
                              }}
                            >
                              <Spinner size="2" />
                            </Flex>
                          )}
                          {(client.isMuted || client.isDeafened || client.isAFK) && (
                            <Flex
                              position="absolute"
                              bottom="-4px"
                              right="-4px"
                              gap="1"
                              style={{
                                background: "var(--color-panel)",
                                borderRadius: "8px",
                                padding: "2px 4px",
                                border: "1px solid var(--gray-6)",
                              }}
                            >
                              {client.isDeafened ? (
                                <BsVolumeOffFill size={10} color="var(--red-9)" />
                              ) : client.isMuted ? (
                                <MdMicOff size={12} color="var(--red-9)" />
                              ) : null}
                              {client.isAFK && (
                                <Text size="1" weight="bold" color="orange">
                                  AFK
                                </Text>
                              )}
                            </Flex>
                          )}
                        </Flex>
                        <Flex direction="column" align="center" gap="1">
                          <Text
                            weight={clientsSpeaking[id] ? "bold" : "regular"}
                            style={{
                              color: clientsSpeaking[id] ? "var(--accent-11)" : "inherit",
                              transition: "color 0.1s ease",
                            }}
                          >
                            {client.nickname}
                          </Text>
                        </Flex>
                      </Flex>
                    </motion.div>
                  )
                );
              })}
          </AnimatePresence>

          <AnimatePresence>
            {currentServerConnected && (
              <motion.div
                style={{
                  width: "100%",
                  position: "absolute",
                  bottom: "0",
                  display: "flex",
                  justifyContent: "center",
                  padding: "24px",
                }}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                <Controls />
              </motion.div>
            )}
          </AnimatePresence>
        </Flex>
      </Flex>
    </motion.div>
  );
}; 