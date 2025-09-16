import { useEffect } from "react";
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
import { FiSettings } from "react-icons/fi";
import { MdAdd, MdMic } from "react-icons/md";

import { useAccount } from "@/common";
import { useSettings } from "@/settings";
import { useServerManagement, useSockets } from "@/socket";
import { useSFU } from "@/webRTC";
import { MiniControls } from "@/webRTC/src/components/miniControls";
import { RemoveServerModal } from "@/socket/src/components/RemoveServerModal";

interface SidebarProps {
  setShowAddServer: (show: boolean) => void;
}

export function Sidebar({ setShowAddServer }: SidebarProps) {
  const { logout } = useAccount();
  const {
    nickname,
    setShowNickname,
    setShowSettings,
  } = useSettings();
  
  const {
    servers,
    currentlyViewingServer,
    showRemoveServer,
    setShowRemoveServer,
    removeServer,
    switchToServer,
  } = useServerManagement();
  

  const { currentServerConnected, isConnected } = useSFU();
  const { serverConnectionStatus } = useSockets();

  // Debug modal state (only log when modal state changes)
  useEffect(() => {
    if (showRemoveServer) {
      console.log("🔄 Remove server modal opened for:", showRemoveServer);
    } else {
      console.log("🔄 Remove server modal closed");
    }
  }, [showRemoveServer]);


  return (
    <Flex
      direction="column"
      height="100%"
      gap="4"
      align="center"
      justify="between"
    >
      <Flex direction="column" gap="4" pt="2">
        {Object.keys(servers).map((host, index) => {
          const connectionStatus = serverConnectionStatus[host] || 'disconnected';
          const isOffline = connectionStatus === 'disconnected';
          const isConnecting = connectionStatus === 'connecting';
          
          return (
            <HoverCard.Root openDelay={500} closeDelay={0} key={host}>
              <ContextMenu.Root>
                <ContextMenu.Trigger>
                  <HoverCard.Trigger>
                    <Box position="relative">
                      <Avatar
                        size="2"
                        color="gray"
                        asChild
                        fallback={servers[host].name[0]}
                        style={{
                          opacity: currentlyViewingServer?.host === host ? 1 : (isOffline ? 0.3 : 0.5),
                          filter: isOffline ? 'grayscale(100%)' : 'none',
                        }}
                        src={`https://${host}/icon`}
                      >
                        <Button
                          style={{
                            padding: "0",
                            cursor: isOffline ? "not-allowed" : "pointer",
                          }}
                          onClick={() => {
                            console.log("🖱️ Sidebar server clicked:", host, "isOffline:", isOffline);
                            if (!isOffline) {
                              console.log("🖱️ Calling switchToServer for:", host);
                              switchToServer(host);
                            } else {
                              console.log("🖱️ Server is offline, not switching");
                            }
                          }}
                        ></Button>
                      </Avatar>
                    
                    {/* Connection badge */}
                    {isConnected && currentServerConnected === host && (
                      <Box
                        position="absolute"
                        top="-2px"
                        right="-2px"
                        style={{
                          width: "16px",
                          height: "16px",
                          borderRadius: "50%",
                          backgroundColor: "var(--accent-9)",
                          border: "2px solid var(--color-background)",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          zIndex: 1,
                        }}
                      >
                        <MdMic size={8} color="white" />
                      </Box>
                    )}
                  </Box>
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
                  onClick={() => {
                    console.log("🖱️ Context menu Leave clicked for:", host);
                    setShowRemoveServer(host);
                    console.log("🖱️ setShowRemoveServer called with:", host);
                  }}
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
                <Heading size="1">
                  {servers[host].name}
                  {isConnected && currentServerConnected === host && (
                    <span style={{ color: "var(--accent-9)", marginLeft: "8px" }}>
                      • Connected to voice
                    </span>
                  )}
                  {isOffline && (
                    <span style={{ color: "var(--red-9)", marginLeft: "8px" }}>
                      • OFFLINE
                    </span>
                  )}
                  {isConnecting && (
                    <span style={{ color: "var(--orange-9)", marginLeft: "8px" }}>
                      • Connecting...
                    </span>
                  )}
                </Heading>
              </Box>
            </HoverCard.Content>
          </HoverCard.Root>
          );
        })}
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
            <DropdownMenu.Item onClick={() => setShowSettings(true)}>
              <Flex gap="1" align="center">
                <FiSettings size={14} />
                Settings
              </Flex>
            </DropdownMenu.Item>
            <DropdownMenu.Separator />
            <DropdownMenu.Item color="red" onClick={logout}>
              Sign out
            </DropdownMenu.Item>
          </DropdownMenu.Content>
        </DropdownMenu.Root>
      </Flex>

      {/* Remove Server Modal */}
      <RemoveServerModal
        isOpen={!!showRemoveServer}
        onClose={() => {
          console.log("🔄 Sidebar modal onClose called");
          setShowRemoveServer(null);
        }}
        onConfirm={() => {
          if (showRemoveServer) {
            console.log("🗑️ Confirming server removal from sidebar:", showRemoveServer);
            removeServer(showRemoveServer);
          }
        }}
        serverName={showRemoveServer ? servers[showRemoveServer]?.name : undefined}
        serverHost={showRemoveServer || undefined}
      />
    </Flex>
  );
}
