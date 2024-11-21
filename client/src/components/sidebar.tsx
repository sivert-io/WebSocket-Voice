import { Pencil2Icon } from "@radix-ui/react-icons";
import {
  Avatar,
  Box,
  Button,
  DropdownMenu,
  Flex,
  Heading,
  HoverCard,
  IconButton,
  Tooltip,
} from "@radix-ui/themes";
import { useState } from "react";
import { useAccount } from "@/common";
import { useSettings } from "@/settings";
import { MdAdd } from "react-icons/md";

export function Sidebar() {
  const { logout } = useAccount();
  const { nickname, setShowNickname, servers, setShowAddServer } =
    useSettings();
  const [selectedServer, setSelectedServer] = useState("1");

  return (
    <Flex
      direction="column"
      height="100%"
      gap="4"
      align="center"
      justify="between"
    >
      <Flex direction="column" gap="4" pt="2">
        {Object.keys(servers).map((host) => (
          <HoverCard.Root openDelay={100} closeDelay={0} key={host}>
            <HoverCard.Trigger>
              <Avatar
                asChild
                fallback={servers[host].name[0]}
                src={servers[host].icon}
              >
                <Button
                  style={{
                    height: "32px",
                    width: "32px",
                    padding: "0",
                  }}
                  color="gray"
                  variant={selectedServer === host ? "solid" : "soft"}
                  onClick={() => setSelectedServer(host)}
                ></Button>
              </Avatar>
            </HoverCard.Trigger>
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
          <Button
            style={{
              height: "32px",
              width: "32px",
              padding: "0",
            }}
            variant="soft"
            color="gray"
            onClick={() => setShowAddServer(true)}
          >
            <MdAdd />
          </Button>
        </Tooltip>
      </Flex>

      <Flex direction="column" gap="2" pb="3">
        <DropdownMenu.Root>
          <DropdownMenu.Trigger>
            <IconButton>
              <Avatar fallback={nickname[0]} />
            </IconButton>
          </DropdownMenu.Trigger>
          <DropdownMenu.Content>
            <DropdownMenu.Item onClick={() => setShowNickname(true)}>
              <Flex gap="1" align="center">
                {nickname}
                <Pencil2Icon />
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
