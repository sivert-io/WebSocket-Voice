import React, { useEffect, useMemo, useState } from "react";
import { useConnections } from "../context/connectionsProvider";
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

export const ServerView = () => {
  const { connect, isConnected, streamSources } = useSFU();
  const { microphoneBuffer } = useMicrophone();
  const [clientsSpeaking, setClientsSpeaking] = useState<{
    [id: string]: boolean;
  }>({});

  const isMobile = useIsMobile();

  // Check if I am speaking right now
  //   useEffect(() => {
  //     const interval = setInterval(() => {
  //       if (!isConnected) return;
  //       Object.keys(clients).forEach((key) => {
  //         const client = clients[key];

  //         // is ourselves
  //         if (key === id && microphoneBuffer.analyser) {
  //           setClientsSpeaking((old) => ({
  //             ...old,
  //             [key]: isSpeaking(microphoneBuffer.analyser!, 1),
  //           }));
  //         }

  //         // is not ourselves
  //         else {
  //           if (!client.streamID || !streamSources[client.streamID]) {
  //             return;
  //           }

  //           const stream = streamSources[client.streamID];
  //           setClientsSpeaking((old) => ({
  //             ...old,
  //             [key]: isSpeaking(stream.analyser, 1),
  //           }));
  //         }
  //       });
  //     }, 100);

  //     //Clearing the interval
  //     return () => clearInterval(interval);
  //   }, [microphoneBuffer.analyser, streamSources]);

  const { connections } = useConnections();
  const { currentServer, removeServer, servers, setCurrentServer } =
    useSettings();

  const currentConnection = useMemo(
    () => (currentServer ? connections[currentServer.host] : null),
    [currentServer, connections]
  );

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
                    <DropdownMenu.Item>Edit server</DropdownMenu.Item>

                    <DropdownMenu.Separator />
                    <DropdownMenu.Item>Add to favorites</DropdownMenu.Item>
                    <DropdownMenu.Item>Share</DropdownMenu.Item>
                    <DropdownMenu.Separator />
                    <DropdownMenu.Item
                      color="red"
                      onClick={() =>
                        currentServer && removeServer(currentServer)
                      }
                    >
                      Leave server
                    </DropdownMenu.Item>
                  </DropdownMenu.Content>
                </DropdownMenu.Root>
              </Flex>
            </Card>

            <Flex direction="column" gap="3" align="center" width="100%">
              <Flex direction="column" align="start" width="100%">
                <Button
                  variant={isConnected ? "solid" : "soft"}
                  radius="small"
                  style={{
                    width: "100%",
                  }}
                  onClick={connect}
                >
                  Channel #1
                </Button>

                <Box
                  style={{
                    background: "var(--color-panel-translucent)",
                    borderRadius: "0 0 12px 12px",
                  }}
                  width="100%"
                >
                  {/* {Object.keys(clients).map(
                    (id) =>
                      clients[id].hasJoinedChannel && (
                        <ConnectedUser
                          isSpeaking={clientsSpeaking[id] || false}
                          isMuted={clients[id].isMuted}
                          nickname={clients[id].nickname}
                          key={id}
                        />
                      )
                  )} */}
                </Box>
              </Flex>
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
