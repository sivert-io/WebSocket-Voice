import { useEffect, useMemo, useState } from "react";
import {
  Avatar,
  Box,
  Button,
  Card,
  DropdownMenu,
  Flex,
  Text,
  TextField,
} from "@radix-ui/themes";
import { Controls, useSFU } from "@/webRTC";
import { isSpeaking, useMicrophone } from "@/audio";
import { useIsMobile } from "@/mobile";
import { ConnectedUser } from "./connectedUser";
import { useSettings } from "@/settings";
import { useSockets } from "../hooks/useSockets";
import { ChatBubbleIcon, SpeakerLoudIcon } from "@radix-ui/react-icons";
import { AnimatePresence, motion } from "motion/react";

export const ServerView = () => {
  const {
    connect,
    disconnect,
    currentServerConnected,
    streamSources,
    currentChannelConnected,
  } = useSFU();
  const { microphoneBuffer } = useMicrophone();
  const [clientsSpeaking, setClientsSpeaking] = useState<{
    [id: string]: boolean;
  }>({});
  const isMobile = useIsMobile();
  const { currentServer, setShowRemoveServer, servers, setCurrentServer } =
    useSettings();

  const { sockets, serverDetailsList, clients } = useSockets();

  const currentConnection = useMemo(
    () => (currentServer ? sockets[currentServer.host] : null),
    [currentServer, sockets]
  );

  const [voiceWidth, setVoiceWidth] = useState("0px");

  useEffect(() => {
    setVoiceWidth(
      currentServerConnected === currentServer?.host ? "400px" : "0px"
    );
  }, [currentServerConnected, currentServer]);

  //  Check if I am speaking right now
  useEffect(() => {
    const interval = setInterval(() => {
      if (!currentServerConnected || !currentServer || !currentConnection)
        return;
      Object.keys(clients[currentServer.host]).forEach((clientID) => {
        const client = clients[currentServer.host][clientID];

        // is ourselves
        if (clientID === currentConnection.id && microphoneBuffer.analyser) {
          setClientsSpeaking((old) => ({
            ...old,
            [clientID]: isSpeaking(microphoneBuffer.analyser!, 1),
          }));
        }

        // is not ourselves
        else {
          if (!client.streamID || !streamSources[client.streamID]) {
            return;
          }

          const stream = streamSources[client.streamID];
          setClientsSpeaking((old) => ({
            ...old,
            [clientID]: isSpeaking(stream.analyser, 1),
          }));
        }
      });
    }, 100);

    //Clearing the interval
    return () => clearInterval(interval);
  }, [microphoneBuffer.analyser, streamSources]);

  useEffect(() => {
    if (!currentServer && Object.keys(servers).length > 0) {
      setCurrentServer(Object.keys(servers)[0]);
    }
  }, [servers]);

  if (!currentServer) return null;

  return (
    <Flex width="100%" height="100%" gap="4">
      <Box width={{ sm: "240px", initial: "100%" }}>
        <Flex
          direction="column"
          height="100%"
          width="100%"
          align="center"
          justify="between"
        >
          <Flex direction="column" gap="4" align="center" width="100%">
            <Card
              style={{
                width: "100%",
                flexShrink: 0,
              }}
            >
              <Flex justify="between" align="center">
                <Text>{currentServer?.name}</Text>
                <DropdownMenu.Root>
                  <DropdownMenu.Trigger>
                    <Button variant="soft" size="1" color="gray">
                      <DropdownMenu.TriggerIcon />
                    </Button>
                  </DropdownMenu.Trigger>
                  <DropdownMenu.Content>
                    <DropdownMenu.Item>Edit</DropdownMenu.Item>
                    <DropdownMenu.Item>Share</DropdownMenu.Item>
                    <DropdownMenu.Item>Pin server</DropdownMenu.Item>
                    <DropdownMenu.Separator />
                    <DropdownMenu.Item
                      color="red"
                      onClick={() =>
                        currentServer && setShowRemoveServer(currentServer.host)
                      }
                    >
                      Leave
                    </DropdownMenu.Item>
                  </DropdownMenu.Content>
                </DropdownMenu.Root>
              </Flex>
            </Card>

            <Flex direction="column" gap="3" align="center" width="100%">
              {serverDetailsList[currentServer.host]?.channels.map(
                (channel) => (
                  <Flex
                    direction="column"
                    align="start"
                    width="100%"
                    key={channel.id}
                    position="relative"
                  >
                    <Button
                      variant={
                        channel.id === currentChannelConnected &&
                        currentServer.host === currentServerConnected
                          ? "solid"
                          : "soft"
                      }
                      radius="large"
                      style={{
                        width: "100%",
                        justifyContent: "start",
                      }}
                      onClick={() => connect(channel.id)}
                    >
                      {channel.type === "voice" ? (
                        <SpeakerLoudIcon />
                      ) : (
                        <ChatBubbleIcon />
                      )}
                      {channel.name}
                    </Button>

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
                      <AnimatePresence>
                        {Object.keys(clients[currentServer.host])?.map(
                          (id) =>
                            clients[currentServer.host][id]
                              .hasJoinedChannel && (
                              <ConnectedUser
                                isSpeaking={clientsSpeaking[id] || false}
                                isMuted={
                                  clients[currentServer.host][id].isMuted
                                }
                                nickname={
                                  clients[currentServer.host][id].nickname
                                }
                                key={id}
                              />
                            )
                        )}
                      </AnimatePresence>
                    </Flex>
                  </Flex>
                )
              )}
            </Flex>
          </Flex>
        </Flex>
      </Box>
      {!isMobile && (
        <Flex flexGrow="1">
          {/* Voice view */}
          <motion.div
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            animate={{
              width: voiceWidth,
              paddingRight: voiceWidth === "0px" ? 0 : 16 * 1.15 + "px",
            }}
            style={{
              overflow: "hidden",
            }}
          >
            <Flex
              style={{
                background: "var(--color-panel-translucent)",
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
                  {currentServerConnected === currentServer.host &&
                    Object.keys(clients[currentServer.host])?.map(
                      (id, index) =>
                        clients[currentServer.host][id].hasJoinedChannel && (
                          <motion.div
                            layout
                            transition={{
                              duration: 0.25,
                              ease: "easeInOut",
                            }}
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            key={id + index}
                            style={{
                              background: "var(--color-panel-translucent)",
                              borderRadius: "12px",
                            }}
                          >
                            <Flex
                              align="center"
                              justify="center"
                              direction="column"
                              gap="1"
                              px="8"
                              py="4"
                            >
                              <Avatar
                                fallback={
                                  clients[currentServer.host][id].nickname[0]
                                }
                                style={{
                                  outline: "2px solid",
                                  outlineColor: clientsSpeaking[id]
                                    ? "var(--accent-9)"
                                    : "transparent",
                                  transition: "outline-color 0.1s ease",
                                }}
                              />
                              <Text>
                                {clients[currentServer.host][id].nickname}
                              </Text>
                            </Flex>
                          </motion.div>
                        )
                    )}
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

          {/* Chat view */}
          <Box
            overflow="hidden"
            flexGrow="1"
            style={{
              background: "var(--color-panel-translucent)",
              borderRadius: "12px",
            }}
          >
            <Flex height="100%" width="100%" direction="column" p="3">
              <Flex
                direction="column"
                justify="center"
                align="center"
                flexGrow="1"
              >
                Chat
              </Flex>

              <TextField.Root
                radius="full"
                placeholder="Chat with your friends!"
              />
            </Flex>
          </Box>
        </Flex>
      )}
    </Flex>
  );
};
