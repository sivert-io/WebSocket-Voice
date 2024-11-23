import { Avatar, Flex, Text } from "@radix-ui/themes";
import { motion } from "motion/react";
import { MdMicOff } from "react-icons/md";

export function ConnectedUser({
  isSpeaking,
  isMuted,
  nickname,
}: {
  isSpeaking: boolean;
  isMuted: boolean;
  nickname: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: "auto" }}
      exit={{ opacity: 0, height: 0 }}
      transition={{ duration: 0.25 }}
      style={{ width: "100%", overflow: "hidden" }}
    >
      <Flex gap="2" align="center" px="3" py="2" width="100%" justify="between">
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

        <div>{isMuted && <MdMicOff color="var(--red-8)" />}</div>
      </Flex>
    </motion.div>
  );
}
