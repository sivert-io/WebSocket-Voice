import { Avatar, Card, Flex, Skeleton, Text } from "@radix-ui/themes";
import { MicOff } from "react-feather";

interface Props {
  nickname: string;
  isSpeaking: boolean;
  isMuted: boolean;
  color: string;
}

export function User({ nickname, isSpeaking, color, isMuted }: Props) {
  return (
    <Card
      data-accent-color={color}
      style={{
        border: "2px solid",
        borderColor: isSpeaking ? "var(--accent-9)" : "var(--accent-surface)",
        width: "100%",
        transition: "all 0.1s ease-out",
      }}
    >
      <Flex
        minWidth="128px"
        width="100%"
        height="128px"
        direction="column"
        gap="1"
        align={"center"}
        justify={"center"}
      >
        <span style={{ position: "relative" }}>
          <Skeleton loading={nickname === "Unknown"}>
            <Avatar
              variant="solid"
              highContrast
              color={color as any}
              fallback={nickname[0]}
              radius="full"
              size="3"
            />
          </Skeleton>

          {nickname !== "Unknown" && isMuted && (
            <span
              style={{
                position: "absolute",
                bottom: "-6px",
                right: "-6px",
                backgroundColor: "var(--accent-2)",
                borderRadius: "9999px",
                width: "24px",
                height: "24px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <MicOff size={12} color="var(--red-11)" />
            </span>
          )}
        </span>
        <Skeleton loading={nickname === "Unknown"}>
          <Text highContrast color={color as any}>
            {nickname}
          </Text>
        </Skeleton>
      </Flex>
    </Card>
  );
}
