import { Button, Card, Flex, Text, IconButton } from "@radix-ui/themes";
import { useEffect, useState } from "react";
import { Settings as SettingsIcon } from "react-feather";
import { useMicrophone } from "../hooks/useMicrophone";
import { useSettings } from "../hooks/useSettings";
import { Settings } from "./settings";
import { useStream } from "../hooks/useStream";
import { useSocket } from "../hooks/useSocket";

interface Props {
  nickname: string;
  color: string;
}

export function Controls({ color, nickname }: Props) {
  const [showSettings, setShowSettings] = useState(false);
  const { socket, sendMessage } = useSocket();
  const { isBrowserSupported } = useMicrophone();
  const { isMuted, setIsMuted } = useStream();
  const { micID } = useSettings();

  function handleMute() {
    if (micID) {
      sendMessage("updateMuted", !isMuted);

      setIsMuted(!isMuted);
    }
  }

  // show settings if no mic is set
  useEffect(() => {
    if (!micID) {
      setShowSettings(true);
    }
  }, [micID]);

  return (
    <Card
      style={{
        width: "100%",
        flexShrink: 0,
      }}
    >
      {isBrowserSupported && (
        <Flex direction="column" gap="2" align="center" position="relative">
          <IconButton
            style={{
              position: "absolute",
              top: 0,
              right: 0,
            }}
            onClick={() => setShowSettings(true)}
          >
            <SettingsIcon size={16} />
          </IconButton>

          <Settings show={showSettings} setShow={setShowSettings} />

          {socket?.readyState === WebSocket.OPEN ? (
            <Flex gap="1" align="center">
              <Text>Connected as</Text>
              <Text weight="bold" highContrast color={color as any}>
                {nickname}
              </Text>
            </Flex>
          ) : (
            <Text>Disconnected</Text>
          )}
          <Button onClick={handleMute} disabled={!micID}>
            {isMuted ? <Text>Unmute</Text> : <Text>Mute</Text>}
          </Button>
        </Flex>
      )}

      {isBrowserSupported === false && (
        <Text weight="bold" size="4">
          Browser is not supported. Sorry!
        </Text>
      )}

      {isBrowserSupported === undefined && (
        <Text weight="bold" size="4">
          Checking support...
        </Text>
      )}
    </Card>
  );
}
