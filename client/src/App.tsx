import { useState, useEffect } from "react";
import { Flex } from "@radix-ui/themes";
import { useWebSocket } from "./hooks/useWebsocket";
import { Controls } from "./components/controls";
import { useSettings } from "./hooks/useSettings";
import { Intro } from "./components/intro";
import { UsersMap } from "./components/usersMap";

export function App() {
  const { clients, sendMessage, id, readyState } = useWebSocket();
  const [submitted, setSubmitted] = useState<boolean>(false);
  const { nickname, setNickname } = useSettings();

  function handleSubmit(_nick: string) {
    if (_nick.length > 2 && _nick.length < 12) {
      sendMessage({
        message: "updateNickname",
        value: _nick,
      });

      setSubmitted(true);
      setNickname(_nick); // Update nickname. Is also used in @/components/intro.tsx
    }
  }

  // If nickname already exists from localstorage
  useEffect(() => {
    if (readyState === WebSocket.OPEN) {
      handleSubmit(nickname);
    }
  }, [readyState]);

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
      {!submitted && <Intro submit={handleSubmit} />}

      {submitted && (
        <Flex direction="column" gap="2">
          <Controls
            color={id.length > 0 ? clients[id]?.color : "gray"}
            nickname={nickname}
          />
          <UsersMap />
        </Flex>
      )}
    </Flex>
  );
}
