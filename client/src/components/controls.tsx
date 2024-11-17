import { Card, Flex, Text, IconButton } from "@radix-ui/themes";
import { useEffect, useState } from "react";
import { useSettings } from "@/settings";
import { useSocket } from "@/socket";
import { getIsBrowserSupported } from "@/audio";
import { FiSettings } from "react-icons/fi";
import { MdMic, MdMicOff } from "react-icons/md";
import { BsVolumeOffFill, BsVolumeUpFill } from "react-icons/bs";
import { useSFU } from "@/webRTC";
import { ImPhoneHangUp } from "react-icons/im";

export function Controls() {
  const [isBrowserSupported] = useState(getIsBrowserSupported());
  const { isConnected, disconnect } = useSFU();

  const { sendMessage } = useSocket();
  const {
    micID,
    setIsMuted,
    isMuted,
    setShowSettings,
    isDeafened,
    setIsDeafened,
  } = useSettings();

  function handleMute() {
    if (micID) {
      sendMessage("updateMuted", !isMuted);
      setIsMuted(!isMuted);
    }
  }

  function handleDeafen() {
    if (micID) {
      sendMessage("updateDeafened", !isDeafened);
      setIsDeafened(!isDeafened);
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
        <Flex gap="4" align="center" justify="center">
          <IconButton
            color={isMuted ? "red" : "gray"}
            variant="soft"
            onClick={handleMute}
            disabled={!micID}
          >
            {isMuted ? <MdMicOff size={16} /> : <MdMic size={16} />}
          </IconButton>

          <IconButton
            color={isDeafened ? "red" : "gray"}
            variant="soft"
            onClick={handleDeafen}
          >
            {isDeafened ? (
              <BsVolumeOffFill size={16} />
            ) : (
              <BsVolumeUpFill size={16} />
            )}
          </IconButton>

          <IconButton
            color="gray"
            variant="soft"
            onClick={() => setShowSettings(true)}
          >
            <FiSettings size={16} />
          </IconButton>

          {isConnected && (
            <IconButton variant="soft" color="red" onClick={disconnect}>
              <ImPhoneHangUp />
            </IconButton>
          )}
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
