import { Avatar, Flex, Spinner,Text } from "@radix-ui/themes";
import { motion } from "motion/react";
import { useEffect } from "react";
import { BsVolumeOffFill } from "react-icons/bs";
import { MdMicOff } from "react-icons/md";

export function ConnectedUser({
  isSpeaking,
  isMuted,
  isDeafened,
  isAFK,
  nickname,
  isConnectedToVoice = true, // Default to true for backward compatibility
  isConnectingToVoice = false, // New prop for showing loading state
}: {
  isSpeaking: boolean;
  isMuted: boolean;
  isDeafened: boolean;
  isAFK: boolean;
  nickname: string;
  isConnectedToVoice?: boolean;
  isConnectingToVoice?: boolean;
}) {
  // Log component lifecycle (mount/unmount only to reduce noise)
  useEffect(() => {
    console.log(`👤 CONNECTED USER [${nickname}] MOUNTED`);
    return () => {
      console.log(`👤 CONNECTED USER [${nickname}] UNMOUNTED`);
    };
  }, [nickname]);

  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: "auto" }}
      exit={{ opacity: 0, height: 0 }}
      transition={{ duration: 0.25 }}
      style={{ width: "100%", overflow: "hidden" }}
    >
      <Flex 
        gap="2" 
        align="center" 
        px="3" 
        py="2" 
        width="100%" 
        justify="between"
        style={{
          opacity: 1, // Always show at full opacity when user has joined channel
          transition: "opacity 0.3s ease",
        }}
      >
        <Flex gap="2" align="center">
          <Avatar
            radius="full"
            size="1"
            fallback={nickname[0]}
            style={{
              outline: "2px solid",
              outlineColor: isSpeaking ? "var(--accent-9)" : "transparent",
              transition: "outline-color 0.1s ease",
            }}
          />
          <Text size="2">{nickname}</Text>
        </Flex>

        <Flex gap="1" align="center">
          {isConnectingToVoice && (
            <Spinner size="1" />
          )}
          {isDeafened ? (
            <BsVolumeOffFill color="var(--red-8)" />
          ) : isMuted ? (
            <MdMicOff color="var(--red-8)" />
          ) : null}
          {isAFK && (
            <Text size="1" weight="bold" color="orange">
              AFK
            </Text>
          )}
        </Flex>
      </Flex>
    </motion.div>
  );
}
