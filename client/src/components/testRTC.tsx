import { Badge, Card, Flex, Text } from "@radix-ui/themes";
import { useSFU } from "../hooks/useSFU";
import { Visualizer } from "./visualizer";

export const TestRTC = () => {
  const { streams, error } = useSFU();

  if (error) {
    return <div>Error: {error}</div>;
  }

  streams.forEach((stream, index) => {
    console.log(index, stream.stream.getAudioTracks());
  });

  return (
    <Flex direction="column" gap="4" justify="start" align="center">
      <Text size="4" weight="bold">
        Media Streams
      </Text>
      {streams.map((streamData, index) => (
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
          {!streamData.isLocal && (
            <audio
              controls
              autoPlay
              ref={(audio) => {
                if (audio) {
                  audio.srcObject = streamData.stream;
                }
              }}
            />
          )}
          {/* <LiveAudioVisualizer
                mediaRecorder={streamData.stream}
                smoothingTimeConstant={0.9}
                fftSize={4096}
                maxDecibels={10}
                height="64px"
                width="482px"
                barColor="#6e56cf"
                barWidth={2}
              /> */}
          <Card>
            <Visualizer
              stream={streamData.stream}
              visualSetting="frequencybars"
              width={482}
              height={64}
              barsColor="#6e56cf"
            />
          </Card>
        </Flex>
      ))}
    </Flex>
  );
};
