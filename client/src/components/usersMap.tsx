import { useEffect, useState } from "react";
import { useMicrophone } from "../hooks/useMicrophone";
import { isSpeaking } from "../utils/speaking";
import { useSettings } from "../hooks/useSettings";
import { User } from "./user";
import { useSocket } from "../hooks/useSocket";
import { useSFU } from "../hooks/useSFU";

export function UsersMap() {
  const [clientsSpeaking, setClientsSpeaking] = useState<{
    [id: string]: boolean;
  }>({});
  const [amISpeaking, setAmISpeaking] = useState(false);
  const { clients, id } = useSocket();
  const { microphoneBuffer } = useMicrophone(); // HANDLE OPENED
  const { isMuted } = useSettings();
  const { streamSources } = useSFU();

  // Check if I am speaking right now
  useEffect(() => {
    const interval = setInterval(() => {
      Object.keys(clients).forEach((key) => {
        const client = clients[key];

        // is ourselves
        if (key === id && microphoneBuffer.analyser) {
          setAmISpeaking(isSpeaking(microphoneBuffer.analyser, 1));
        }

        // is not ourselves
        else {
          if (!client.streamID || !streamSources[client.streamID]) {
            console.log("No stream source for client", client.streamID);
            return;
          }

          const stream = streamSources[client.streamID];
          setClientsSpeaking((old) => ({
            ...old,
            [key]: isSpeaking(stream.analyser, 1),
          }));
        }
      });
    }, 100);

    //Clearing the interval
    return () => clearInterval(interval);
  }, [microphoneBuffer.analyser, streamSources]);

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
            isSpeaking={
              clientID === id ? amISpeaking : clientsSpeaking[clientID] || false
            }
            color={client.color}
            key={clientID}
            isMuted={clientID === id ? isMuted : client.isMuted}
          />
        );
      })}
    </div>
  );
}
