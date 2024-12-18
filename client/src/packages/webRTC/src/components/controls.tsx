import { Flex, IconButton } from "@radix-ui/themes";
import { useState } from "react";
import { BsVolumeOffFill, BsVolumeUpFill } from "react-icons/bs";
import { FiSettings } from "react-icons/fi";
import { ImPhoneHangUp } from "react-icons/im";
import { MdMic, MdMicOff } from "react-icons/md";

import { getIsBrowserSupported } from "@/audio";
import { useSettings } from "@/settings";
import { useSFU } from "@/webRTC";

export function Controls() {
  const [isBrowserSupported] = useState(getIsBrowserSupported());
  const { disconnect } = useSFU();

  const { setIsMuted, isMuted, setShowSettings, isDeafened, setIsDeafened } =
    useSettings();

  function handleMute() {
    setIsMuted(!isMuted);
  }

  function handleDeafen() {
    setIsDeafened(!isDeafened);
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
