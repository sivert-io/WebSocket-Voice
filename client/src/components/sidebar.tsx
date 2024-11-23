import { Pencil2Icon, SpeakerLoudIcon } from "@radix-ui/react-icons";
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
import { useMemo, useState } from "react";
import { useAccount } from "@/common";
import { useSettings } from "@/settings";
import { MdAdd, MdMic, MdMicOff } from "react-icons/md";
import { useSFU } from "@/webRTC";
import { useSockets } from "@/socket";
import { BsVolumeOffFill, BsVolumeUpFill } from "react-icons/bs";
import { AnimatePresence, motion } from "motion/react";

export function Sidebar() {
  const { logout } = useAccount();
  const {
    nickname,
    setShowNickname,
    servers,
    setShowAddServer,
    setShowRemoveServer,
    setCurrentServer,
    currentServer,
    isMuted,
    setIsMuted,
    isDeafened,
    setIsDeafened,
  } = useSettings();
  const { isConnected, disconnect, currentChannel } = useSFU();
  const { serverDetailsList } = useSockets();

  const currentChannelName = useMemo<string>(() => {
    if (currentChannel.length > 0) {
      return (
        serverDetailsList[isConnected].channels.find(
          (channel) => channel.id === currentChannel
        )?.name || ""
      );
    }
    return "";
  }, [currentChannel, serverDetailsList]);

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
            <ContextMenu.Root>
              <ContextMenu.Trigger>
                <HoverCard.Trigger>
                  <Avatar
                    asChild
                    fallback={servers[host].name[0]}
                    src={`https://${host}/icon`}
                  >
                    <Button
                      style={{
                        height: "32px",
                        width: "32px",
                        padding: "0",
                      }}
                      color="gray"
                      variant={currentServer?.host === host ? "solid" : "soft"}
                      onClick={() => setCurrentServer(host)}
                    ></Button>
                  </Avatar>
                </HoverCard.Trigger>
              </ContextMenu.Trigger>
              <ContextMenu.Content>
                <ContextMenu.Label style={{ fontWeight: "bold" }}>
                  {servers[host].name}
                </ContextMenu.Label>
                <ContextMenu.Separator />
                <ContextMenu.Item>Edit</ContextMenu.Item>
                <ContextMenu.Item>Share</ContextMenu.Item>
                <ContextMenu.Item>Pin server</ContextMenu.Item>
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

      <Flex justify="center" align="center" direction="column" gap="3" pb="3">
        <AnimatePresence>
          {isConnected.length > 0 && currentServer?.host !== isConnected && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.25 }}
            >
              <HoverCard.Root openDelay={100} closeDelay={0} key={isConnected}>
                <ContextMenu.Root>
                  <ContextMenu.Trigger>
                    <HoverCard.Trigger>
                      <Button
                        style={{
                          height: "32px",
                          width: "32px",
                          padding: "0",
                        }}
                        color="gray"
                        onClick={() => setCurrentServer(isConnected)}
                      >
                        <SpeakerLoudIcon />
                      </Button>
                    </HoverCard.Trigger>
                  </ContextMenu.Trigger>
                  <ContextMenu.Content>
                    <ContextMenu.Item
                      color={isMuted ? "crimson" : "gray"}
                      onClick={() => setIsMuted(!isMuted)}
                    >
                      {isMuted ? <MdMicOff size={16} /> : <MdMic size={16} />}
                      {isMuted ? "Unmute" : "Mute"}
                    </ContextMenu.Item>
                    <ContextMenu.Item
                      color={isDeafened ? "crimson" : "gray"}
                      onClick={() => setIsDeafened(!isDeafened)}
                    >
                      {isDeafened ? (
                        <BsVolumeOffFill size={16} />
                      ) : (
                        <BsVolumeUpFill size={16} />
                      )}
                      {isDeafened ? "Undeafen" : "Deafen"}
                    </ContextMenu.Item>
                    <ContextMenu.Item color="red" onClick={disconnect}>
                      Leave {currentChannelName}
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
                    <Heading size="1">Go to {currentChannelName}</Heading>
                  </Box>
                </HoverCard.Content>
              </HoverCard.Root>
            </motion.div>
          )}
        </AnimatePresence>
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
