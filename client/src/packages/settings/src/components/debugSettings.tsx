import { Box, Flex, Heading, Text, Switch } from "@radix-ui/themes";
import { useSettings } from "@/settings";

export function DebugSettings() {
  const { 
    showDebugOverlay,
    setShowDebugOverlay
  } = useSettings();

  return (
    <Box>
      <Flex direction="column" gap="4">
        <Heading size="4">Debug Settings</Heading>
        
        {/* Debug Overlay Toggle */}
        <Box>
          <Flex align="center" gap="3">
            <Text size="2" weight="medium">Show Debug Overlay</Text>
            <Switch 
              checked={showDebugOverlay} 
              onCheckedChange={setShowDebugOverlay}
            />
          </Flex>
          <Text size="1" color="gray" mt="1">
            Display a floating debug overlay with real-time audio information
          </Text>
        </Box>
      </Flex>
    </Box>
  );
}
