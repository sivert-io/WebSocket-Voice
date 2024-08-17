import { Card, Flex, Text, IconButton } from "@radix-ui/themes";
import { useEffect, useState } from "react";
import { useSettings } from "../hooks/useSettings";
import { useSocket } from "../hooks/useSocket";
import { getIsBrowserSupported } from "../utils/mediaDevices";
import { FiMic, FiMicOff, FiSettings, FiWifi, FiWifiOff } from "react-icons/fi";
import { TbHeadphones, TbHeadphonesOff } from "react-icons/tb";
import { GiSpeaker, GiSpeakerOff } from "react-icons/gi";
import { MdHeadset, MdHeadsetOff, MdMic, MdMicOff } from "react-icons/md";
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
