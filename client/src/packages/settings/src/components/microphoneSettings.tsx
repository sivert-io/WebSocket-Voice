import { ExclamationTriangleIcon } from "@radix-ui/react-icons";
import {
  Button,
  Callout,
  Flex,
  Heading,
  Progress,
  Select,
  Slider,
  Text,
} from "@radix-ui/themes";
import { useEffect, useState } from "react";

import { getCurrentVolume, isSpeaking, useMicrophone } from "@/audio";
import { useSettings } from "@/settings";

export function MicrophoneSettings() {
  const { devices, microphoneBuffer } = useMicrophone();
  const {
    micID,
    setMicID,
    micVolume,
    setMicVolume,
    noiseGate,
    setNoiseGate,
    setLoopbackEnabled,
    loopbackEnabled,
  } = useSettings();

  const [micLiveVolume, setMicLiveVolume] = useState(0);
  const [isMicLive, setIsMicLive] = useState(false);

  // Get microphone volume and return if over noise gate
  useEffect(() => {
    const interval = setInterval(() => {
      if (microphoneBuffer.analyser) {
        setMicLiveVolume(getCurrentVolume(microphoneBuffer.analyser));
        setIsMicLive(isSpeaking(microphoneBuffer.analyser, noiseGate));
      }
    }, 1);

    return () => clearInterval(interval);
  }, [microphoneBuffer.analyser, noiseGate]);

  // Cleanup on component unmount
  useEffect(() => {
    return () => {
      if (loopbackEnabled) {
        setLoopbackEnabled(false);
        console.log("Loopback stream cleaned up on component unmount");
      }
    };
  }, [loopbackEnabled, setLoopbackEnabled]);

  return (
    <>
      {devices.length === 0 && (
        <Callout.Root color="red">
          <Callout.Icon>
            <ExclamationTriangleIcon />
          </Callout.Icon>
          <Callout.Text>
            <span style={{ textDecoration: "underline" }}>
              No input devices can be found
            </span>{" "}
            (check permissions next to URL)
          </Callout.Text>
        </Callout.Root>
      )}

      {/* Microphone */}
      <Flex
        direction="column"
        gap="2"
        style={{
          paddingBottom: "16px",
        }}
      >
        <Heading as="h2" size="4">
          Microphone
        </Heading>
        <Flex direction="column" gap="4">
          {/* Devices */}
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
                  {devices.length > 0 ? (
                    devices.map((inputDevice) => (
                      <Select.Item
                        key={inputDevice.deviceId}
                        value={inputDevice.deviceId}
                      >
                        {inputDevice.label}
                      </Select.Item>
                    ))
                  ) : (
                    <Select.Item disabled value={"no_device"}>
                      No devices found
                    </Select.Item>
                  )}
                </Select.Content>
              </Select.Root>
              <Button
                onClick={() => {
                  if (!loopbackEnabled) {
                    setLoopbackEnabled(true);
                    console.log("Starting a new loopback stream");
                  } else {
                    setLoopbackEnabled(false);
                    console.log("Stopping loopback stream");
                  }
                }}
              >
                {loopbackEnabled ? "Stop testing" : "Start testing"}
              </Button>
            </Flex>
          </Flex>

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
                  if (Number.isNaN(value[0])) return;

                  // Clamp number between 0 and 200
                  setMicVolume(Math.min(200, Math.max(0, value[0])));
                }}
              />
              <Text
                style={{
                  minWidth: "36px",
                }}
                size="2"
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
                max={100}
                value={[noiseGate]}
                onValueChange={(value) => {
                  if (Number.isNaN(value[0])) return;

                  // Clamp number between 0 and 100
                  setNoiseGate(Math.min(100, Math.max(0, value[0])));
                }}
              />
              <Text
                style={{
                  minWidth: "36px",
                }}
                size="2"
              >
                {noiseGate}
              </Text>
            </Flex>
            <Flex align="center" gap="2">
              <Progress
                value={micLiveVolume}
                color={isMicLive ? "green" : "gray"}
              />
              <div style={{ minWidth: "36px" }} />
            </Flex>
          </Flex>
        </Flex>
      </Flex>
    </>
  );
}
