import { Button, Card, Flex, Text } from "@radix-ui/themes";
import { useState } from "react";
import { Mic, MicOff } from "react-feather";
import { useWebSocket } from "../hooks/useWebsocket";

interface Props {
  nickname: string;
  color: string;
}

export function Controls({ color, nickname }: Props) {
  const { readyState, sendMessage } = useWebSocket("ws://192.168.10.168:5000");
  const [isMuted, setIsMuted] = useState(true);

  function handleMute() {
    sendMessage({
      message: "updateMuted",
      value: !isMuted,
    });
    setIsMuted(!isMuted);
  }

  return (
    <Card
      style={{
        width: "100%",
        flexShrink: 0,
      }}
    >
      <Flex direction="column" gap="4" align="center">
        {readyState === WebSocket.OPEN ? (
          <Flex gap="1" align="center">
            <Text>Connected as</Text>
            <Text weight="bold" highContrast color={color as any}>
              {nickname}
            </Text>
          </Flex>
        ) : (
          <Text>Disconnected</Text>
        )}
        {isMuted ? (
          <MicOff size={16} color="var(--red-11)" />
        ) : (
          <Mic size={16} color="var(--green-11)" />
        )}
        <Button onClick={handleMute}>
          {isMuted ? <Text>Unmute</Text> : <Text>Mute</Text>}
        </Button>
      </Flex>
    </Card>
  );
}
