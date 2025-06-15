import { Avatar, Flex, Text, Spinner } from "@radix-ui/themes";
import { motion } from "motion/react";
import { MdMicOff } from "react-icons/md";
import { BsVolumeOffFill } from "react-icons/bs";

export function ConnectedUser({
  isSpeaking,
  isMuted,
  isDeafened,
  nickname,
  isConnectedToVoice = true, // Default to true for backward compatibility
  isConnectingToVoice = false, // New prop for showing loading state
}: {
  isSpeaking: boolean;
  isMuted: boolean;
  isDeafened: boolean;
  nickname: string;
  isConnectedToVoice?: boolean;
  isConnectingToVoice?: boolean;
}) {
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
          opacity: isConnectedToVoice ? 1 : 0.5,
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
          {isMuted && <MdMicOff color="var(--red-8)" />}
          {isDeafened && <BsVolumeOffFill color="var(--red-8)" />}
        </Flex>
      </Flex>
    </motion.div>
  );
}
