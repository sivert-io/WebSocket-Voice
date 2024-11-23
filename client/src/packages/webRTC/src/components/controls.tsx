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
    <>
      {isBrowserSupported && (
        <Flex align="center" justify="center" gap="4">
          <IconButton
            color={isMuted ? "red" : "gray"}
            variant="soft"
            onClick={handleMute}
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

          <IconButton variant="soft" color="red" onClick={disconnect}>
            <ImPhoneHangUp />
          </IconButton>

          <IconButton variant="soft" onClick={() => setShowSettings(true)}>
            <FiSettings size={16} />
          </IconButton>
        </Flex>
      )}
    </>
  );
}
