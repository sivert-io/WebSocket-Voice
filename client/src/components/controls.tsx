import { Card, Flex, Text, IconButton } from "@radix-ui/themes";
import { useEffect, useState } from "react";
import { useSettings } from "@/settings";
import { useSocket } from "@/socket";
import { getIsBrowserSupported } from "@/audio";
import { FiSettings } from "react-icons/fi";
import { MdMic, MdMicOff } from "react-icons/md";
import { BsVolumeOffFill, BsVolumeUpFill } from "react-icons/bs";

export function Controls() {
  const [isBrowserSupported] = useState(getIsBrowserSupported());

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
          <IconButton onClick={handleMute} disabled={!micID}>
            {isMuted ? <MdMicOff size={16} /> : <MdMic size={16} />}
          </IconButton>

          <IconButton onClick={handleDeafen}>
            {isDeafened ? (
              <BsVolumeOffFill size={16} />
            ) : (
              <BsVolumeUpFill size={16} />
            )}
          </IconButton>

          <IconButton onClick={() => setShowSettings(true)}>
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
