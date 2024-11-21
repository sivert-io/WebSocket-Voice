import { MdMicOff } from "react-icons/md";
import { Avatar, Flex, Text } from "@radix-ui/themes";
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
  );
}
