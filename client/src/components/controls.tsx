import {
  Button,
  Card,
  Flex,
  Select,
  Text,
  Dialog,
  IconButton,
  Slider,
  Progress,
} from "@radix-ui/themes";
import { useEffect, useState } from "react";
import { Settings } from "react-feather";
import { useWebSocket } from "../hooks/useWebsocket";
import { useMicrophone } from "../hooks/useMicrophone";
import { useSettings } from "../hooks/useSettings";
import { getCurrentVolume, isSpeaking } from "../utils/speaking";

interface Props {
  nickname: string;
  color: string;
}

export function Controls({ color, nickname }: Props) {
  const { readyState, sendMessage } = useWebSocket("ws://192.168.10.168:5000");
  const [isMuted, setIsMuted] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [micLiveVolume, setMicLiveVolume] = useState(0);
  const [isMicLive, setIsMicLive] = useState(false);

  const {
    isBrowserSupported,
    devices,
    setLoopbackEnabled,
    loopbackEnabled,
    microphoneBuffer,
  } = useMicrophone();

  const { micID, setMicID, micVolume, setMicVolume, noiseGate, setNoiseGate } =
    useSettings();

  function handleMute() {
    if (micID) {
      sendMessage({
        message: "updateMuted",
        value: !isMuted,
      });

      setIsMuted(!isMuted);
    }
  }

  function handleDialogChange(isOpen: boolean) {
    if (micID) {
      setShowSettings(isOpen);
      setLoopbackEnabled(false);
    }
  }

  // show settings if no mic is set
  useEffect(() => {
    if (!micID) {
      setShowSettings(true);
    }
  }, [micID]);

  // Get microphone volume and return if over noise gate
  useEffect(() => {
    //Implementing the setInterval method
    const interval = setInterval(() => {
      if (microphoneBuffer.analyser) {
        setMicLiveVolume(getCurrentVolume(microphoneBuffer.analyser));
        setIsMicLive(isSpeaking(microphoneBuffer.analyser, noiseGate));
      }
    }, 1);

    //Clearing the interval
    return () => clearInterval(interval);
  }, [microphoneBuffer.analyser, noiseGate]);

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
            <Settings size={16} />
          </IconButton>
          <Dialog.Root open={showSettings} onOpenChange={handleDialogChange}>
            <Dialog.Content>
              <Flex direction="column" gap="2">
                <Dialog.Title weight="bold" size="6">
                  Settings
                </Dialog.Title>

                {/* Microphone */}
                <Flex
                  direction="column"
                  gap="2"
                  style={{
                    paddingBottom: "16px",
                  }}
                >
                  <Text weight="bold" size="4">
                    Microphone
                  </Text>
                  <Flex direction="column" gap="4">
                    {/* Devices */}
                    {devices.length > 0 && (
                      <Flex direction="column" gap="2">
                        <Text weight="medium" size="2">
                          Device
                        </Text>
                        <Flex align="center" gap="2">
                          <Select.Root onValueChange={setMicID} value={micID}>
                            <Select.Trigger
                              style={{
                                flexGrow: 1,
                              }}
                              placeholder="Select input device"
                            />
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
                          <Button
                            onClick={() => setLoopbackEnabled(!loopbackEnabled)}
                          >
                            {loopbackEnabled ? "Stop testing" : "Start testing"}
                          </Button>
                        </Flex>
                      </Flex>
                    )}

                    {/* Gain */}
                    <Flex direction="column">
                      <Text weight="medium" size="2">
                        Gain
                      </Text>
                      <Flex align="center" gap="2">
                        <Slider
                          min={0}
                          max={200}
                          value={[micVolume]}
                          onValueChange={(value) => {
                            setMicVolume(value[0]);
                          }}
                        />
                        <Text
                          style={{
                            width: "36px",
                          }}
                          weight="bold"
                        >
                          {micVolume}
                        </Text>
                      </Flex>
                    </Flex>

                    {/* Noise Gate */}
                    <Flex direction="column">
                      <Text weight="medium" size="2">
                        Noise Gate
                      </Text>
                      <Flex align="center" gap="2">
                        <Slider
                          min={0}
                          max={50}
                          value={[noiseGate]}
                          onValueChange={(value) => {
                            setNoiseGate(value[0]);
                          }}
                        />
                        <Text
                          style={{
                            width: "36px",
                          }}
                          weight="bold"
                        >
                          {noiseGate}
                        </Text>
                      </Flex>
                      <Flex align="center" gap="2">
                        <Progress
                          value={micLiveVolume}
                          color={isMicLive ? "green" : "gray"}
                        />
                        <Text
                          style={{
                            width: "36px",
                          }}
                          weight="bold"
                        >
                          {Math.floor(micLiveVolume / 5) * 5}
                        </Text>
                      </Flex>
                    </Flex>
                  </Flex>
                </Flex>
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
