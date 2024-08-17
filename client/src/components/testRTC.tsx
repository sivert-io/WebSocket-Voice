import { Badge, Card, Flex, Text } from "@radix-ui/themes";
import { useSFU } from "../hooks/useSFU";
import { Visualizer } from "./visualizer";

export const TestRTC = () => {
  const { streams, error, streamSources } = useSFU();

  if (error) {
    return <div>Error: {error}</div>;
  }

  return (
    <Flex direction="column" gap="4" justify="start" align="center">
      <Text size="4" weight="bold">
        Media Streams
      </Text>
      {streams.map(
        (streamData, index) =>
          streamData.stream.active && (
            <Flex
              direction="column"
              gap="2"
              justify="start"
              align="center"
              key={streamData.id}
            >
              <Text size="2" weight="medium">
                {streamData.id}
              </Text>
              <Flex gap="2" justify="center" align="center">
                <Badge highContrast color="orange">
                  Position: {index}
                </Badge>
                {streamData.isLocal ? (
                  <Badge highContrast color="green">
                    local
                  </Badge>
                ) : (
                  <Badge highContrast color="red">
                    remote
                  </Badge>
                )}
                {streamData.stream.active ? (
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
                {streamSources[streamData.id] && (
                  <Visualizer
                    analyser={streamSources[streamData.id].analyser}
                    visualSetting="frequencybars"
                    width={482}
                    height={64}
                    barsColor="#6e56cf"
                  />
                )}
              </Card>
            </Flex>
          ),
      )}
    </Flex>
  );
};
