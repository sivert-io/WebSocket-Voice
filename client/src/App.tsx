import { useState } from "react";
import { Button, Flex } from "@radix-ui/themes";
import { Controls } from "./components/controls";
import { UsersMap } from "./components/usersMap";
import { TestRTC } from "./components/testRTC";
import { useAccount } from "@/common";
import { SignUpModal } from "@/signUp";

export function App() {
  const [joined, setJoined] = useState(false);

  const { isSignedIn, logout } = useAccount();

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
