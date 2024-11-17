import { Badge, Card, Flex, Text } from "@radix-ui/themes";
import { useSFU } from "../hooks/useSFU";
import { Visualizer, useMicrophone } from "@/audio";

export const TestRTC = () => {
  const { streams, error, streamSources } = useSFU();
  const { microphoneBuffer } = useMicrophone();

  if (error) {
    return <div>Error: {error}</div>;
  }

  return (
    <Flex direction="column" gap="4" justify="start" align="center">
      <Text size="4" weight="bold">
        Media Streams
      </Text>

      <Card>
        {microphoneBuffer.analyser && (
          <Visualizer
            analyser={microphoneBuffer.analyser}
            visualSetting="frequencybars"
            width={482}
            height={64}
            barsColor="var(--accent-a11)"
          />
        )}
      </Card>

      {Object.keys(streams).map(
        (streamID, index) =>
          streams[streamID].stream.active && (
            <Flex
              direction="column"
              gap="2"
              justify="start"
              align="center"
              key={streamID + index}
            >
              <Text size="2" weight="medium">
                {streamID}
              </Text>
              <Flex gap="2" justify="center" align="center">
                <Badge highContrast color="orange">
                  Position: {index}
                </Badge>
                {streams[streamID].isLocal ? (
                  <Badge highContrast color="green">
                    local
                  </Badge>
                ) : (
                  <Badge highContrast color="red">
                    remote
                  </Badge>
                )}
                {streams[streamID].stream.active ? (
                  <Badge highContrast color="green">
                    active
                  </Badge>
                ) : (
                  <Badge highContrast color="red">
                    inactive
                  </Badge>
                )}
              </Flex>
              <Card>
                {streamSources[streamID] && (
                  <Visualizer
                    analyser={streamSources[streamID].analyser}
                    visualSetting="frequencybars"
                    width={482}
                    height={64}
                    barsColor="var(--accent-a11)"
                  />
                )}
              </Card>
            </Flex>
          )
      )}
    </Flex>
  );
};
