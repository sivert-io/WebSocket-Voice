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
  Spinner,
} from "@radix-ui/themes";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useMemo, useState } from "react";

import { isSpeaking, useMicrophone } from "@/audio";
import { useIsMobile } from "@/mobile";
import { useSettings } from "@/settings";
import { Channel } from "@/settings/src/types/server";
import { Controls, useSFU } from "@/webRTC";

import { useSockets } from "../hooks/useSockets";
import { ConnectedUser } from "./connectedUser";

export const ServerView = () => {
  const [clientsSpeaking, setClientsSpeaking] = useState<{
    [id: string]: boolean;
  }>({});
  const [voiceWidth, setVoiceWidth] = useState("0px");
  const [pendingChannelId, setPendingChannelId] = useState<string | null>(null);

  const isMobile = useIsMobile();

  const {
    currentlyViewingServer,
    setShowRemoveServer,
    showVoiceView,
    setShowVoiceView,
    micID,
    setShowSettings,
    setSettingsTab,
  } = useSettings();

  const {
    connect,
    currentServerConnected,
    streamSources,
    currentChannelConnected,
    isConnected,
    isConnecting,
  } = useSFU();

  // Helper function to extract original channel ID from unique room ID
  // Server creates unique room IDs like "techial_voice" from original "voice"
  const extractChannelIdFromRoomId = (roomId: string, serverId: string): string => {
    if (!roomId || !serverId) return "";
    
    // Convert server host to server name format (e.g., "techial.sivert.io" -> "techial")
    const serverName = serverId.split('.')[0];
    const expectedPrefix = `${serverName}_`;
    
    if (roomId.startsWith(expectedPrefix)) {
      return roomId.substring(expectedPrefix.length);
    }
    
    // Fallback: return the room ID as-is if it doesn't match expected format
    return roomId;
  };

  // Get the current channel ID from the connected room
  const currentChannelId = extractChannelIdFromRoomId(currentChannelConnected, currentServerConnected);

  // Debug logging for room ID handling
  useEffect(() => {
    if (currentChannelConnected && currentServerConnected) {
      console.log("🏠 Room ID mapping:", {
        uniqueRoomId: currentChannelConnected,
        serverId: currentServerConnected,
        extractedChannelId: currentChannelId,
      });
    }
  }, [currentChannelConnected, currentServerConnected, currentChannelId]);

  // Stable microphone access - when we have a microphone selected and viewing a server
  // This ensures microphone is ready BEFORE attempting to connect
  const shouldAccessMic = useMemo(() => {
    return !!micID && !!currentlyViewingServer;
  }, [micID, currentlyViewingServer]);

  const { microphoneBuffer } = useMicrophone(shouldAccessMic);

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

  // Auto-connect to pending channel when microphone becomes available
  useEffect(() => {
    if (micID && pendingChannelId) {
      console.log("Microphone selected, connecting to pending channel:", pendingChannelId);
      setShowVoiceView(true);
      connect(pendingChannelId)
        .then(() => {
          setPendingChannelId(null); // Clear pending state on success
        })
        .catch((error) => {
          console.error("❌ Failed to connect to pending channel:", error);
          setPendingChannelId(null); // Clear pending state on failure
          // Don't show settings again if connection fails for other reasons
        });
    }
  }, [micID, pendingChannelId, connect, setShowVoiceView]);

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
        if (clientID === currentConnection.id && microphoneBuffer.finalAnalyser) {
          setClientsSpeaking((old) => ({
            ...old,
            [clientID]: isSpeaking(microphoneBuffer.finalAnalyser!, 1),
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
  }, [microphoneBuffer.finalAnalyser, streamSources]);

  if (!currentlyViewingServer) return null;

  const handleChannelClick = async (channel: Channel) => {
    switch (channel.type) {
      case "voice":
        // Check if microphone is selected before connecting
        if (!micID) {
          console.log("No micID, opening settings", "micID:", micID);
          setPendingChannelId(channel.id);
          setSettingsTab("microphone"); // Set to microphone tab
          setShowSettings(true); // Open settings dialog
          return;
        }

        // Check if we're already connected to this exact channel
        const isAlreadyConnectedToThisChannel = 
          isConnected &&
          channel.id === currentChannelId &&
          currentlyViewingServer.host === currentServerConnected;

        if (isAlreadyConnectedToThisChannel) {
          // Just toggle the voice view, don't reconnect
          setShowVoiceView(!showVoiceView);
          return;
        }

        // Clear any pending channel since we're manually connecting
        setPendingChannelId(null);

        // We're connecting to a different channel or not connected at all
        setShowVoiceView(true);
        console.log("Attempting to connect with micID:", micID);
        
        // Connect to voice channel - the SFU hook now handles microphone initialization properly
        try {
          await connect(channel.id);
        } catch (error) {
          console.error("❌ SFU connection failed:", error);
          // Only show settings if it's specifically a microphone issue
          if (error instanceof Error && error.message.includes("Microphone not available")) {
            setPendingChannelId(channel.id);
            setSettingsTab("microphone");
            setShowSettings(true);
          }
          // For other errors, just log them - don't force settings open
        }
        break;

      case "text":
        // Show selected channels chat history
        break;
    }
  };

  return (
    <>
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
                          channel.id === currentChannelId &&
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
                        {/* Show spinner when connecting to this specific channel */}
                        {channel.type === "voice" && 
                         isConnecting && 
                         channel.id === currentChannelId &&
                         currentlyViewingServer.host === currentServerConnected && (
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
                                    isConnectedToVoice={
                                      clients[currentlyViewingServer.host][id]
                                        .isConnectedToVoice ?? true
                                    }
                                    isConnectingToVoice={
                                      // Show connecting state if this is our connection and we're connecting
                                      id === currentConnection?.id && 
                                      isConnecting &&
                                      currentlyViewingServer.host === currentServerConnected &&
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
                                background: clientsSpeaking[id] 
                                  ? "var(--accent-3)" 
                                  : "var(--color-panel-translucent)",
                                borderRadius: "12px",
                                opacity: clients[currentlyViewingServer.host][id].isConnectedToVoice ?? true ? 1 : 0.5,
                                transition: "opacity 0.3s ease, background-color 0.1s ease",
                                border: clientsSpeaking[id] 
                                  ? "1px solid var(--accent-6)" 
                                  : "1px solid transparent",
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
                                <Flex align="center" justify="center" position="relative">
                                  <Avatar
                                    fallback={
                                      clients[currentlyViewingServer.host][id]
                                        .nickname[0]
                                    }
                                    style={{
                                      outline: clientsSpeaking[id] ? "3px solid" : "2px solid",
                                      outlineColor: clientsSpeaking[id]
                                        ? "var(--accent-9)"
                                        : "transparent",
                                      transition: "outline-color 0.1s ease, outline-width 0.1s ease",
                                      boxShadow: clientsSpeaking[id] 
                                        ? "0 0 12px var(--accent-7)" 
                                        : "none",
                                    }}
                                  />
                                  {/* Show spinner overlay for connecting users */}
                                  {id === currentConnection?.id && isConnecting && (
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
                                </Flex>
                                <Text
                                  weight={clientsSpeaking[id] ? "bold" : "regular"}
                                  style={{
                                    color: clientsSpeaking[id] 
                                      ? "var(--accent-11)" 
                                      : "inherit",
                                    transition: "color 0.1s ease",
                                  }}
                                >
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
    </>
  );
};
