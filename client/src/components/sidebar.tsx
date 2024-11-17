import { Pencil1Icon, Pencil2Icon, PersonIcon } from "@radix-ui/react-icons";
import { Button, DropdownMenu, Flex, IconButton } from "@radix-ui/themes";
import { useState } from "react";
import { Server } from "./mainApp";
import { useAccount } from "@/common";
import { useSettings } from "@/settings";

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
          <Button
            style={{
              height: "32px",
              width: "32px",
              padding: "0",
            }}
            variant={selectedServer === server.id ? "solid" : "soft"}
            key={server.id}
            onClick={() => setSelectedServer(server.id)}
          ></Button>
        ))}
      </Flex>

      <Flex direction="column" gap="2" pb="3">
        <DropdownMenu.Root>
          <DropdownMenu.Trigger>
            <IconButton>
              <PersonIcon />
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
            <DropdownMenu.Item color="crimson" onClick={logout}>
              Sign out
            </DropdownMenu.Item>
          </DropdownMenu.Content>
        </DropdownMenu.Root>
      </Flex>
    </Flex>
  );
}
