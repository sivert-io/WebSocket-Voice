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
  } = useSFU();

  // Stable microphone access - only when actually needed for speaking detection
  // Don't tie it to micID to prevent constant adding/removing of handles
  const shouldAccessMic = useMemo(() => {
    return !!currentServerConnected && !!currentlyViewingServer;
  }, [currentServerConnected, currentlyViewingServer]);

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

  // Auto-connect when microphone is selected and we have a pending channel
  useEffect(() => {
    if (micID && pendingChannelId) {
      console.log("Microphone selected, connecting to pending channel:", pendingChannelId);
      setShowVoiceView(true);
      connect(pendingChannelId);
      setPendingChannelId(null);
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

        if (
          isConnected &&
          channel.id === currentChannelConnected &&
          currentlyViewingServer.host === currentServerConnected
        )
          setShowVoiceView(!showVoiceView);
        else setShowVoiceView(true);

        console.log("Attempting to connect with micID:", micID);
        
        // STEP 1: Proactively ensure microphone is initialized
        console.log("🎤 Step 1: Proactively initializing microphone...");
        
        // Use the appropriate microphone buffer (forced or normal)
        const activeMicBuffer = microphoneBuffer;
        
        console.log("🎤 Current microphone state:", {
          micID: !!micID,
          normalBuffer: {
            exists: !!microphoneBuffer,
            mediaStream: !!microphoneBuffer.mediaStream,
            input: !!microphoneBuffer.input,
          },
          activeBuffer: {
            mediaStream: !!activeMicBuffer.mediaStream,
            input: !!activeMicBuffer.input,
          }
        });
        
        // If microphone buffer doesn't have the necessary components, we need to wait
        if (!activeMicBuffer.mediaStream || !activeMicBuffer.input) {
          console.log("🎤 Microphone not fully initialized, waiting for initialization...");
          
          // Set up a more aggressive retry mechanism
          let retryCount = 0;
          const maxRetries = 50; // 10 seconds total
          
          const checkMicrophoneReady = () => {
            retryCount++;
            console.log(`🎤 Checking microphone readiness (attempt ${retryCount}/${maxRetries})...`);
            console.log("🎤 Current state:", {
              mediaStream: !!activeMicBuffer.mediaStream,
              input: !!activeMicBuffer.input,
            });
            
            // Check if microphone is ready
            if (activeMicBuffer.mediaStream && activeMicBuffer.input) {
              console.log("✅ Microphone is ready! Proceeding with SFU connection...");
              connect(channel.id).catch(error => {
                console.error("❌ SFU connection failed:", error);
                if (error instanceof Error && error.message.includes("Microphone")) {
                  setSettingsTab("microphone");
                  setShowSettings(true);
                }
              });
              return;
            }
            
            // If we've reached max retries, give up and open settings
            if (retryCount >= maxRetries) {
              console.error("❌ Microphone initialization timed out after", maxRetries * 200, "ms");
              console.log("Opening microphone settings for user to reconfigure");
              setSettingsTab("microphone");
              setShowSettings(true);
              return;
            }
            
            // Continue checking
            console.log("⏳ Microphone not ready yet, checking again in 200ms...");
            setTimeout(checkMicrophoneReady, 200);
          };
          
          // Start checking immediately
          setTimeout(checkMicrophoneReady, 100);
          return;
        }
        
        // STEP 2: Microphone is ready, proceed with SFU connection
        console.log("✅ Microphone is ready, proceeding with SFU connection");
        try {
          await connect(channel.id);
        } catch (error) {
          console.error("❌ SFU connection failed:", error);
          if (error instanceof Error && error.message.includes("Microphone")) {
            setSettingsTab("microphone");
            setShowSettings(true);
          }
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
                                    isConnectedToVoice={
                                      clients[currentlyViewingServer.host][id]
                                        .isConnectedToVoice ?? true
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
                                opacity: clients[currentlyViewingServer.host][id].isConnectedToVoice ?? true ? 1 : 0.5,
                                transition: "opacity 0.3s ease",
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
    </>
  );
};
