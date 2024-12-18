import { Pencil2Icon, PinTopIcon } from "@radix-ui/react-icons";
import {
  Avatar,
  Box,
  Button,
  ContextMenu,
  DropdownMenu,
  Flex,
  Heading,
  HoverCard,
  IconButton,
  Tooltip,
} from "@radix-ui/themes";
import { MdAdd } from "react-icons/md";

import { useAccount } from "@/common";
import { useSettings } from "@/settings";
import { MiniControls } from "@/webRTC/src/components/miniControls";

export function Sidebar() {
  const { logout } = useAccount();
  const {
    nickname,
    setShowNickname,
    servers,
    setShowAddServer,
    setShowRemoveServer,
    setCurrentlyViewingServer,
    currentlyViewingServer,
  } = useSettings();

  return (
    <Flex
      direction="column"
      height="100%"
      gap="4"
      align="center"
      justify="between"
    >
      <Flex direction="column" gap="4" pt="2">
        {Object.keys(servers).map((host, index) => (
          <HoverCard.Root openDelay={500} closeDelay={0} key={host}>
            <ContextMenu.Root>
              <ContextMenu.Trigger>
                <HoverCard.Trigger>
                  <Avatar
                    size="2"
                    color="gray"
                    asChild
                    fallback={servers[host].name[0]}
                    style={{
                      opacity: currentlyViewingServer?.host === host ? 1 : 0.5,
                    }}
                    src={`https://${host}/icon`}
                  >
                    <Button
                      style={{
                        padding: "0",
                      }}
                      onClick={() => setCurrentlyViewingServer(host)}
                    ></Button>
                  </Avatar>
                </HoverCard.Trigger>
              </ContextMenu.Trigger>
              <ContextMenu.Content>
                <ContextMenu.Label style={{ fontWeight: "bold" }}>
                  {servers[host].name}
                </ContextMenu.Label>
                {index !== 0 && (
                  <ContextMenu.Item>
                    <PinTopIcon />
                    Pin to top
                  </ContextMenu.Item>
                )}
                <ContextMenu.Item>Edit</ContextMenu.Item>
                <ContextMenu.Item>Share</ContextMenu.Item>
                <ContextMenu.Item>Add to new group</ContextMenu.Item>
                <ContextMenu.Separator />
                <ContextMenu.Item
                  color="red"
                  onClick={() => setShowRemoveServer(host)}
                >
                  Leave
                </ContextMenu.Item>
              </ContextMenu.Content>
            </ContextMenu.Root>
            <HoverCard.Content
              maxWidth="300px"
              side="right"
              size="1"
              align="center"
            >
              <Box>
                <Heading size="1">{servers[host].name}</Heading>
              </Box>
            </HoverCard.Content>
          </HoverCard.Root>
        ))}
        <Tooltip content="Add new server" delayDuration={100} side="right">
          <IconButton
            variant="soft"
            color="gray"
            onClick={() => setShowAddServer(true)}
          >
            <MdAdd />
          </IconButton>
        </Tooltip>
      </Flex>

      <Flex justify="center" align="center" direction="column" gap="3" pb="3">
        {/* Voice chat controls */}
        <MiniControls direction="column" />
        <DropdownMenu.Root>
          <DropdownMenu.Trigger>
            <IconButton>
              <Avatar fallback={nickname[0]} />
            </IconButton>
          </DropdownMenu.Trigger>
          <DropdownMenu.Content>
            <DropdownMenu.Item onClick={() => setShowNickname(true)}>
              <Flex gap="1" align="center">
                <Pencil2Icon />
                {nickname}
              </Flex>
            </DropdownMenu.Item>
            <DropdownMenu.Separator />
            <DropdownMenu.Item color="red" onClick={logout}>
              Sign out
            </DropdownMenu.Item>
          </DropdownMenu.Content>
        </DropdownMenu.Root>
      </Flex>
    </Flex>
  );
}
