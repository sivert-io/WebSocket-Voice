import { Button, Card, DropdownMenu, Flex, Text } from "@radix-ui/themes";

export const ServerHeader = ({
  serverName,
  onLeave,
}: {
  serverName?: string;
  onLeave: () => void;
}) => {
  return (
    <Card
      style={{
        width: "100%",
        flexShrink: 0,
      }}
    >
      <Flex justify="between" align="center">
        <Text>{serverName}</Text>
        <DropdownMenu.Root>
          <DropdownMenu.Trigger>
            <Button variant="soft" size="1" color="gray">
              <DropdownMenu.TriggerIcon />
            </Button>
          </DropdownMenu.Trigger>
          <DropdownMenu.Content>
            <DropdownMenu.Item>Share</DropdownMenu.Item>
            <DropdownMenu.Separator />
            <DropdownMenu.Item color="red" onClick={onLeave}>
              Leave
            </DropdownMenu.Item>
          </DropdownMenu.Content>
        </DropdownMenu.Root>
      </Flex>
    </Card>
  );
}; 