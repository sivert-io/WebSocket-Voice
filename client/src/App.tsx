import { useState, useEffect } from "react";
import { Button, Card, Flex, Text, TextField } from "@radix-ui/themes";
import { useWebSocket } from "./hooks/useWebsocket";
import { User } from "./components/user";
import { Controls } from "./components/controls";
import { useSettings } from "./hooks/useSettings";
import { useMicrophone } from "./hooks/useMicrophone";
import { isSpeaking } from "./utils/speaking";

export function App() {
  const { clients, sendMessage, id, readyState } = useWebSocket(
    import.meta.env.VITE_WS_HOST || "ws://localhost:5000"
  );
  const [submitted, setSubmitted] = useState<boolean>(
    !!localStorage.getItem("nickname") || false
  );
  const [amISpeaking, setAmISpeaking] = useState(false);
  const { microphoneBuffer } = useMicrophone();
  const { nickname, setNickname, noiseGate } = useSettings();
  const [localNickname, setLocalNickname] = useState(nickname);

  useEffect(() => {
    //Implementing the setInterval method
    const interval = setInterval(() => {
      if (microphoneBuffer.analyser) {
        setAmISpeaking(isSpeaking(microphoneBuffer.analyser, noiseGate));
      }
    }, 10);

    //Clearing the interval
    return () => clearInterval(interval);
  }, [microphoneBuffer.analyser, noiseGate]);

  useEffect(() => {
    if (
      readyState === WebSocket.OPEN &&
      localNickname.length > 2 &&
      localNickname.length < 12
    )
      sendMessage({
        message: "updateNickname",
        value: localNickname,
      });
  }, [readyState]);

  const handleSubmit = (e: any) => {
    e.preventDefault();

    if (localNickname.length > 2 && localNickname.length < 12) {
      sendMessage({
        message: "updateNickname",
        value: localNickname,
      });

      setSubmitted(true);
      setNickname(localNickname);
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
                  placeholder="Bulleberg"
                  value={localNickname}
                  onChange={(e) => setLocalNickname(e.target.value)}
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
            color={id.length > 0 ? clients[id]?.color : "gray"}
            nickname={nickname}
          />
          <div
            className="rt-r-gap-2"
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(3, minmax(128px, 1fr))",
              width: "100%",
            }}
          >
            {Object.keys(clients).map((clientID) => {
              const client = clients[clientID];
              return (
                <User
                  nickname={client.nickname}
                  isSpeaking={clientID === id ? amISpeaking : false}
                  color={client.color}
                  key={clientID}
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
