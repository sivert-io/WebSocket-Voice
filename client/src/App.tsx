import { useEffect, useState } from "react";
import { Button, Flex } from "@radix-ui/themes";
import { Controls } from "./components/controls";
import { UsersMap } from "./components/usersMap";
import { TestRTC } from "./packages/webRTC/src/components/testRTC";
import { Logo, useAccount } from "@/common";
import { SignUpModal } from "@/signUp";
import { useSocket } from "@/socket";
import { useSettings } from "@/settings";

export function App() {
  const [joined, setJoined] = useState(false);
  const { sendMessage } = useSocket();

  const { isSignedIn } = useAccount();

  const { nickname } = useSettings();

  useEffect(() => {
    sendMessage("updateNickname", nickname);
  }, [joined, nickname]);

  return (
    <Flex
      direction="column"
      gap="2"
      style={{
        padding: "64px",
      }}
      justify="center"
      align="center"
      width="100%"
      height="100%"
    >
      {!isSignedIn && <SignUpModal />}

      {isSignedIn && (
        <Flex direction="column" gap="4" align="center">
          <Flex
            justify="center"
            style={{
              position: "fixed",
              bottom: "0",
              width: "100%",
            }}
            p="6"
          >
            <Logo />
          </Flex>
          <Controls />
          <Flex align="center" justify="center" gap="2">
            <Button
              onClick={() => {
                setJoined(!joined);
              }}
            >
              {joined ? "Disconnect" : "Connect"}
            </Button>
          </Flex>
          {joined && (
            <>
              <UsersMap />
              <TestRTC />
            </>
          )}
        </Flex>
      )}
    </Flex>
  );
}
