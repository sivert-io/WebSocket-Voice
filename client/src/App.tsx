import { useState } from "react";
import { Button, Flex } from "@radix-ui/themes";
import { Controls } from "./components/controls";
import { UsersMap } from "./components/usersMap";
import { useSocket } from "./hooks/useSocket";
import { TestRTC } from "./components/testRTC";
import { useAccount } from "@/common";
import { SignUpModal } from "@/signUp";

export function App() {
  const [joined, setJoined] = useState(false);

  const { clients, id } = useSocket();
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
        <Flex direction="column" gap="4" minWidth="482px" align="center">
          <Button onClick={logout}>Logout</Button>
          <Controls color={id.length > 0 ? clients[id]?.color : "gray"} />
          {joined ? (
            <Button
              onClick={() => {
                setJoined(false);
              }}
            >
              Leave
            </Button>
          ) : (
            <Button
              onClick={() => {
                setJoined(true);
              }}
            >
              Connect
            </Button>
          )}
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
