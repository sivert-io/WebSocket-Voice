import { useEffect, useMemo, useState } from "react";
import {
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

export const ServerView = () => {
  const { connect, isConnected, streamSources } = useSFU();
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

  //  Check if I am speaking right now
  useEffect(() => {
    const interval = setInterval(() => {
      if (!isConnected || !currentServer || !currentConnection) return;
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
    <Flex gap="4" width="100%" height="100%">
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
                      variant={isConnected ? "solid" : "soft"}
                      radius="large"
                      style={{
                        width: "100%",
                        justifyContent: "start",
                      }}
                      onClick={connect}
                    >
                      {channel.type === "voice" ? (
                        <SpeakerLoudIcon />
                      ) : (
                        <ChatBubbleIcon />
                      )}
                      {channel.name}
                    </Button>

                    <Box
                      position="absolute"
                      top="0"
                      pt="6"
                      style={{
                        background: "var(--color-panel-translucent)",
                        borderRadius: "0 0 12px 12px",
                        zIndex: -1,
                      }}
                      width="100%"
                    >
                      {Object.keys(clients[currentServer.host])?.map(
                        (id) =>
                          clients[currentServer.host][id].hasJoinedChannel && (
                            <ConnectedUser
                              isSpeaking={clientsSpeaking[id] || false}
                              isMuted={clients[currentServer.host][id].isMuted}
                              nickname={
                                clients[currentServer.host][id].nickname
                              }
                              key={id}
                            />
                          )
                      )}
                    </Box>
                  </Flex>
                )
              )}
            </Flex>
          </Flex>
          <Controls />
        </Flex>
      </Box>
      {!isMobile && (
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
      )}
    </Flex>
  );
};
