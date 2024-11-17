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
import { Controls } from "../components/controls";
import { useSFU } from "@/webRTC";
import { useEffect, useState } from "react";
import { useSocket } from "@/socket";
import { Sidebar } from "./sidebar";
import { isSpeaking, useMicrophone } from "@/audio";
import { MdMicOff } from "react-icons/md";
import { useIsMobile } from "@/mobile";

export type Server = {
  id: string;
  name: string;
  image: string;
};

export const servers: Server[] = [
  {
    id: "1",
    name: "S1",
    image: "",
  },
  {
    id: "2",
    name: "S2",
    image: "",
  },
  {
    id: "3",
    name: "S3",
    image: "",
  },
  {
    id: "4",
    name: "S4",
    image: "",
  },
] as const;

function ConnectedUser({
  isSpeaking,
  isMuted,
  nickname,
}: {
  isSpeaking: boolean;
  isMuted: boolean;
  nickname: string;
}) {
  return (
    <Flex gap="2" align="center" px="3" py="2" width="100%" justify="between">
      <Flex gap="2" align="center">
        <Avatar
          radius="full"
          size="1"
          fallback={nickname[0]}
          style={{
            outline: "2px solid",
            outlineColor: isSpeaking ? "var(--accent-9)" : "transparent",
            transition: "outline-color 0.1s ease",
          }}
        />
        <Text size="2">{nickname}</Text>
      </Flex>

      <div>{isMuted && <MdMicOff color="var(--red-8)" />}</div>
    </Flex>
  );
}

export function MainApp() {
  const { connect, isConnected } = useSFU();
  const { clients, id } = useSocket();
  const { streamSources } = useSFU();
  const { microphoneBuffer } = useMicrophone();
  const [clientsSpeaking, setClientsSpeaking] = useState<{
    [id: string]: boolean;
  }>({});

  const isMobile = useIsMobile();

  // Check if I am speaking right now
  useEffect(() => {
    const interval = setInterval(() => {
      Object.keys(clients).forEach((key) => {
        const client = clients[key];

        // is ourselves
        if (key === id && microphoneBuffer.analyser) {
          setClientsSpeaking((old) => ({
            ...old,
            [key]: isSpeaking(microphoneBuffer.analyser!, 1),
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
            [key]: isSpeaking(stream.analyser, 1),
          }));
        }
      });
    }, 100);

    //Clearing the interval
    return () => clearInterval(interval);
  }, [microphoneBuffer.analyser, streamSources]);

  return (
    <Flex
      style={{ position: "fixed", inset: 0 }}
      gap="4"
      overflow="hidden"
      p="4"
    >
      <Sidebar servers={servers} />

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
                  <Text>Gryta Krutt</Text>
                  <DropdownMenu.Root>
                    <DropdownMenu.Trigger>
                      <Button variant="soft" size="1">
                        <DropdownMenu.TriggerIcon />
                      </Button>
                    </DropdownMenu.Trigger>
                    <DropdownMenu.Content>
                      <DropdownMenu.Item>Edit server</DropdownMenu.Item>

                      <DropdownMenu.Separator />
                      <DropdownMenu.Item>Share</DropdownMenu.Item>
                      <DropdownMenu.Item>Add to favorites</DropdownMenu.Item>
                      <DropdownMenu.Separator />
                      <DropdownMenu.Item color="crimson">
                        Leave server
                      </DropdownMenu.Item>
                    </DropdownMenu.Content>
                  </DropdownMenu.Root>
                </Flex>
              </Card>

              <Flex direction="column" gap="2" align="center" width="100%">
                <Box
                  style={{
                    background: "var(--color-panel-translucent)",
                    borderRadius: "12px",
                  }}
                  width="100%"
                >
                  <Flex direction="column" gap="1" align="start" width="100%">
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
                    {Object.keys(clients).map(
                      (id) =>
                        clients[id].hasJoinedChannel && (
                          <ConnectedUser
                            isSpeaking={clientsSpeaking[id] || false}
                            isMuted={clients[id].isMuted}
                            nickname={clients[id].nickname}
                            key={id}
                          />
                        )
                    )}
                  </Flex>
                </Box>
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
                size="3"
                radius="full"
                placeholder="Chat with your friends!"
              />
            </Flex>
          </Box>
        )}
      </Flex>
    </Flex>
  );
}
