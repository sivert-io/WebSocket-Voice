import { useEffect, useState } from "react";
import { useWebSocket } from "../hooks/useWebsocket";
import { useMicrophone } from "../hooks/useMicrophone";
import { useStream } from "../hooks/useStream";
import { isSpeaking } from "../utils/speaking";
import { useSettings } from "../hooks/useSettings";
import { User } from "./user";

export function UsersMap() {
  const [amISpeaking, setAmISpeaking] = useState(false);
  const { clients, id } = useWebSocket();
  const { microphoneBuffer } = useMicrophone();
  const { isMuted } = useStream();
  const { noiseGate } = useSettings();

  // Check if I am speaking right now
  useEffect(() => {
    //Implementing the setInterval method
    const interval = setInterval(() => {
      if (microphoneBuffer.analyser) {
        setAmISpeaking(
          isMuted ? false : isSpeaking(microphoneBuffer.analyser, noiseGate)
        );
      }
    }, 5);

    //Clearing the interval
    return () => clearInterval(interval);
  }, [microphoneBuffer.analyser, noiseGate]);

  return (
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
            isMuted={clientID === id ? isMuted : client.isMuted}
          />
        );
      })}
    </div>
  );
}
