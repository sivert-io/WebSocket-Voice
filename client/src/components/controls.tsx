import { Button, Card, Flex, Select, Text, Dialog } from "@radix-ui/themes";
import { useState } from "react";
import { Mic, MicOff } from "react-feather";
import { useWebSocket } from "../hooks/useWebsocket";
import { useMicrophone } from "../hooks/useMicrophone";

interface Props {
  nickname: string;
  color: string;
}

export function Controls({ color, nickname }: Props) {
  const { readyState, sendMessage } = useWebSocket("ws://192.168.10.168:5000");
  const [isMuted, setIsMuted] = useState(true);

  const {
    isBrowserSupported,
    devices,
    setMicId,
    micId,
    setLoopbackEnabled,
    loopbackEnabled,
  } = useMicrophone();

  function handleMute() {
    if (micId) {
      sendMessage({
        message: "updateMuted",
        value: !isMuted,
      });

      setIsMuted(!isMuted);
    }
  }

  return (
    <Card
      style={{
        width: "100%",
        flexShrink: 0,
      }}
    >
      {isBrowserSupported && (
        <Flex direction="column" gap="4" align="center">
          <Dialog.Root onOpenChange={() => setLoopbackEnabled(false)}>
            <Dialog.Trigger>
              <Button>Settings</Button>
            </Dialog.Trigger>

            <Dialog.Content>
              <Flex direction="column">
                <Dialog.Title>Settings</Dialog.Title>

                {devices.length > 0 && (
                  <Flex gap="4" direction="column">
                    <Select.Root onValueChange={setMicId} value={micId}>
                      <Select.Trigger placeholder="Select input device" />
                      <Select.Content position="popper">
                        {devices.map((inputDevice) => (
                          <Select.Item
                            key={inputDevice.deviceId}
                            value={inputDevice.deviceId}
                          >
                            {inputDevice.label}
                          </Select.Item>
                        ))}
                      </Select.Content>
                    </Select.Root>

                    {loopbackEnabled ? (
                      <Button onClick={() => setLoopbackEnabled(false)}>
                        Stop testing
                      </Button>
                    ) : (
                      <Button
                        onClick={() => setLoopbackEnabled(true)}
                        disabled={micId === undefined}
                      >
                        Test microphone
                      </Button>
                    )}
                  </Flex>
                )}
              </Flex>
            </Dialog.Content>
          </Dialog.Root>

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
