import { useState, useEffect } from "react";
import { Button, Card, Flex, Text, TextField } from "@radix-ui/themes";
import { useWebSocket } from "./hooks/useWebsocket";
import { User } from "./components/user";
import { Controls } from "./components/controls";

export function App() {
  const { clients, sendMessage, id, readyState } = useWebSocket(
    import.meta.env.VITE_WS_HOST || "ws://localhost:5000"
  );
  const [nickname, setNickname] = useState<string>(
    localStorage.getItem("nickname") || ""
  );
  const [submitted, setSubmitted] = useState<boolean>(
    !!localStorage.getItem("nickname") || false
  );

  useEffect(() => {
    if (
      readyState === WebSocket.OPEN &&
      nickname.length > 2 &&
      nickname.length < 12
    )
      sendMessage({
        message: "updateNickname",
        value: nickname,
      });
  }, [readyState]);

  const handleSubmit = (e: any) => {
    e.preventDefault();

    if (nickname.length > 2 && nickname.length < 12) {
      sendMessage({
        message: "updateNickname",
        value: nickname,
      });

      setSubmitted(true);
      localStorage.setItem("nickname", nickname);
    }
  };

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
      {!submitted && (
        <Card>
          <Flex direction="column" gap="2">
            <Text weight="medium" size="4">
              Choose a nickname
            </Text>
            <form onSubmit={handleSubmit}>
              <Flex gap="2">
                <TextField.Root
                  minLength={3}
                  maxLength={12}
                  title="Nickname"
                  placeholder="BerPer"
                  value={nickname}
                  onChange={(e) => setNickname(e.target.value)}
                />
                <Button type="submit">Submit</Button>
              </Flex>
            </form>
          </Flex>
        </Card>
      )}

      {submitted && (
        <Flex direction="column" gap="2" overflow="scroll">
          <Controls
            color={id.length > 0 ? clients[id].color : "gray"}
            nickname={nickname}
          />

          <div
            className="rt-r-gap-2"
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(4, minmax(128px, 1fr))",
              width: "100%",
            }}
          >
            {Object.keys(clients).map((clientID) => {
              const client = clients[clientID];
              return (
                <User
                  nickname={client.nickname}
                  isSpeaking={client.isSpeaking}
                  color={client.color}
                  key={clientID}
                  isMe={clientID === id}
                  isMuted={client.isMuted}
                />
              );
            })}
          </div>
        </Flex>
      )}
    </Flex>
  );
}
