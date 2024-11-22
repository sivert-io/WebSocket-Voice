import { Card, Flex, Text, IconButton } from "@radix-ui/themes";
import { useState } from "react";
import { useSettings } from "@/settings";
import { getIsBrowserSupported } from "@/audio";
import { FiSettings } from "react-icons/fi";
import { MdMic, MdMicOff } from "react-icons/md";
import { BsVolumeOffFill, BsVolumeUpFill } from "react-icons/bs";
import { useSFU } from "@/webRTC";
import { ImPhoneHangUp } from "react-icons/im";

export function Controls() {
  const [isBrowserSupported] = useState(getIsBrowserSupported());
  const { isConnected, disconnect } = useSFU();

  const {
    micID,
    currentServer,
    setIsMuted,
    isMuted,
    setShowSettings,
    isDeafened,
    setIsDeafened,
  } = useSettings();

  function handleMute() {
    if (micID && currentServer) {
      setIsMuted(!isMuted);
    }
  }

  function handleDeafen() {
    if (micID && currentServer) {
      setIsDeafened(!isDeafened);
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
        <Flex align="center" justify="between">
          <IconButton
            color={isMuted ? "red" : "gray"}
            variant="soft"
            onClick={handleMute}
            disabled={!micID || !isConnected}
          >
            {isMuted ? <MdMicOff size={16} /> : <MdMic size={16} />}
          </IconButton>

          <IconButton
            color={isDeafened ? "red" : "gray"}
            variant="soft"
            onClick={handleDeafen}
            disabled={!isConnected}
          >
            {isDeafened ? (
              <BsVolumeOffFill size={16} />
            ) : (
              <BsVolumeUpFill size={16} />
            )}
          </IconButton>

          <IconButton
            variant="soft"
            color="red"
            onClick={disconnect}
            disabled={!isConnected}
          >
            <ImPhoneHangUp />
          </IconButton>

          <IconButton variant="soft" onClick={() => setShowSettings(true)}>
            <FiSettings size={16} />
          </IconButton>
        </Flex>
      )}

      {isBrowserSupported === false && (
        <Text weight="bold" size="4">
          Browser is not supported. Sorry!
        </Text>
      )}
    </Card>
  );
}
