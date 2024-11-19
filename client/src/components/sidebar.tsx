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
import { Server } from "./mainApp";
import { useAccount } from "@/common";
import { useSettings } from "@/settings";
import { MdAdd } from "react-icons/md";

type SidebarProps = {
  servers?: Server[];
};

export function Sidebar({ servers }: SidebarProps) {
  const { logout } = useAccount();
  const { nickname, setShowNickname } = useSettings();
  const [selectedServer, setSelectedServer] = useState("1");
  return (
    <Flex
      direction="column"
      height="100%"
      gap="4"
      align="center"
      justify="between"
    >
      <Flex direction="column" gap="4" pt="3">
        {servers?.map((server) => (
          <HoverCard.Root openDelay={100} closeDelay={0} key={server.host}>
            <HoverCard.Trigger>
              <Button
                style={{
                  height: "32px",
                  width: "32px",
                  padding: "0",
                }}
                color="gray"
                variant={selectedServer === server.host ? "solid" : "soft"}
                onClick={() => setSelectedServer(server.host)}
              ></Button>
            </HoverCard.Trigger>
            <HoverCard.Content
              maxWidth="300px"
              side="right"
              size="1"
              align="center"
            >
              <Box>
                <Heading size="1">Server name</Heading>
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
            onClick={() => {}}
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