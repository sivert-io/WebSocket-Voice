import { ChatBubbleIcon, SpeakerLoudIcon } from "@radix-ui/react-icons";
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
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useMemo, useState } from "react";

import { isSpeaking, useMicrophone } from "@/audio";
import { useIsMobile } from "@/mobile";
import { useSettings } from "@/settings";
import { Controls, useSFU } from "@/webRTC";

import { useSockets } from "../hooks/useSockets";
import { ConnectedUser } from "./connectedUser";
import { Channel } from "@/settings/src/types/server";

export const ServerView = () => {
  const [clientsSpeaking, setClientsSpeaking] = useState<{
    [id: string]: boolean;
  }>({});
  const [voiceWidth, setVoiceWidth] = useState("0px");

  const isMobile = useIsMobile();

  const {
    currentlyViewingServer,
    setShowRemoveServer,
    showVoiceView,
    setShowVoiceView,
  } = useSettings();

  const {
    connect,
    currentServerConnected,
    streamSources,
    currentChannelConnected,
    isConnected,
  } = useSFU();

  const { microphoneBuffer } = useMicrophone();

  const { sockets, serverDetailsList, clients } = useSockets();

  const currentConnection = useMemo(
    () =>
      currentlyViewingServer ? sockets[currentlyViewingServer.host] : null,
    [currentlyViewingServer, sockets]
  );

  useEffect(() => {
    setVoiceWidth(
      currentServerConnected === currentlyViewingServer?.host ? "400px" : "0px"
    );
  }, [currentServerConnected, currentlyViewingServer]);

  //  Check if I am speaking right now
  useEffect(() => {
    const interval = setInterval(() => {
      if (
        !currentServerConnected ||
        !currentlyViewingServer ||
        !currentConnection
      )
        return;
      Object.keys(clients[currentlyViewingServer.host]).forEach((clientID) => {
        const client = clients[currentlyViewingServer.host][clientID];

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

  if (!currentlyViewingServer) return null;

  const handleChannelClick = (channel: Channel) => {
    switch (channel.type) {
      case "voice":
        if (
          isConnected &&
          channel.id === currentChannelConnected &&
          currentlyViewingServer.host === currentServerConnected
        )
          setShowVoiceView(!showVoiceView);
        else setShowVoiceView(true);

        connect(channel.id);
        break;

      case "text":
        // Show selected channels chat history
        break;
    }
  };

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
                <Text>{currentlyViewingServer?.name}</Text>
                <DropdownMenu.Root>
                  <DropdownMenu.Trigger>
                    <Button variant="soft" size="1" color="gray">
                      <DropdownMenu.TriggerIcon />
                    </Button>
                  </DropdownMenu.Trigger>
                  <DropdownMenu.Content>
                    <DropdownMenu.Item>Share</DropdownMenu.Item>
                    <DropdownMenu.Separator />
                    <DropdownMenu.Item
                      color="red"
                      onClick={() =>
                        currentlyViewingServer &&
                        setShowRemoveServer(currentlyViewingServer.host)
                      }
                    >
                      Leave
                    </DropdownMenu.Item>
                  </DropdownMenu.Content>
                </DropdownMenu.Root>
              </Flex>
            </Card>

            <Flex direction="column" gap="3" align="center" width="100%">
              {serverDetailsList[currentlyViewingServer.host]?.channels.map(
                (channel) => (
                  <Flex
                    direction="column"
                    align="start"
                    width="100%"
                    key={currentlyViewingServer.host + channel.id}
                    position="relative"
                  >
                    <Button
                      variant={
                        channel.id === currentChannelConnected &&
                        currentlyViewingServer.host ===
                          currentServerConnected &&
                        showVoiceView
                          ? "solid"
                          : "soft"
                      }
                      radius="large"
                      style={{
                        width: "100%",
                        justifyContent: "start",
                      }}
                      onClick={() => handleChannelClick(channel)}
                    >
                      {channel.type === "voice" ? (
                        <SpeakerLoudIcon />
                      ) : (
                        <ChatBubbleIcon />
                      )}
                      {channel.name}
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
                          {Object.keys(
                            clients[currentlyViewingServer.host]
                          )?.map(
                            (id) =>
                              clients[currentlyViewingServer.host][id]
                                .hasJoinedChannel && (
                                <ConnectedUser
                                  isSpeaking={clientsSpeaking[id] || false}
                                  isMuted={
                                    clients[currentlyViewingServer.host][id]
                                      .isMuted
                                  }
                                  nickname={
                                    clients[currentlyViewingServer.host][id]
                                      .nickname
                                  }
                                  key={id}
                                />
                              )
                          )}
                        </AnimatePresence>
                      </Flex>
                    )}
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
              width: showVoiceView ? voiceWidth : 0,
              paddingRight:
                !showVoiceView || voiceWidth === "0px" ? 0 : 16 * 1.15 + "px",
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
                  {currentServerConnected === currentlyViewingServer.host &&
                    Object.keys(clients[currentlyViewingServer.host])?.map(
                      (id, index) =>
                        clients[currentlyViewingServer.host][id]
                          .hasJoinedChannel && (
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
                                  clients[currentlyViewingServer.host][id]
                                    .nickname[0]
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
                                {
                                  clients[currentlyViewingServer.host][id]
                                    .nickname
                                }
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
