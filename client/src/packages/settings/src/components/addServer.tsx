import {
  Avatar,
  Box,
  Button,
  Callout,
  Card,
  Dialog,
  Flex,
  IconButton,
  Spinner,
  Text,
  TextField,
} from "@radix-ui/themes";
import { useSettings } from "../hooks/useSettings";
import { FiWifi, FiX } from "react-icons/fi";
import { useEffect, useState } from "react";
import { Socket, io } from "socket.io-client";
import { ExclamationTriangleIcon } from "@radix-ui/react-icons";
import { AnimatePresence, motion } from "motion/react";

export type FetchInfo = {
  name: string;
  members: string;
  icon: string;
};

export function AddNewServer() {
  const { showAddServer, setShowAddServer, addServer, servers } = useSettings();
  const [serverHost, setServerHost] = useState("");
  const [serverInfo, setServerInfo] = useState<FetchInfo | null>(null);
  const [hasError, setHasError] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [socket, setSocket] = useState<Socket | null>(null);

  function closeDialog() {
    if (!isSearching) {
      setServerInfo(null);
      setHasError("");
      setIsSearching(false);
      socket?.close();
      setSocket(null);
      setShowAddServer(false);
    }
  }

  function joinServer() {
    if (serverInfo) {
      addServer(servers, {
        name: serverInfo.name,
        host: serverHost,
        icon: serverInfo.icon,
        token: "123",
      });

      closeDialog();

      setServerHost("");
    }
  }

  useEffect(() => {
    setHasError("");
  }, [serverHost]);

  function getServerInfo() {
    setIsSearching(true);
    setHasError("");
    setServerInfo(null);

    const new_socket = io(`wss://${serverHost}`, {
      reconnectionAttempts: 0,
    });

    new_socket.on("connect_error", (error) => {
      setHasError(error.message);
      setIsSearching(false);
      new_socket.close();
    });

    new_socket.on("connect", () => {
      setSocket(new_socket);
    });

    new_socket.on("info", (info: FetchInfo) => {
      setIsSearching(false);
      setServerInfo(info);
    });
  }

  const handleEnterKey = (event: { key: string }) => {
    if (event.key === "Enter") {
      getServerInfo();
    }
  };

  return (
    <Dialog.Root open={showAddServer} onOpenChange={closeDialog}>
      <Dialog.Content maxWidth="600px" style={{ overflow: "hidden" }}>
        <Dialog.Close
          style={{
            position: "absolute",
            top: "8px",
            right: "8px",
          }}
        >
          <IconButton variant="soft" color="gray">
            <FiX size={16} />
          </IconButton>
        </Dialog.Close>
        <Flex direction="column" gap="2">
          <Dialog.Title as="h1" weight="bold" size="6">
            New server
          </Dialog.Title>

          <Dialog.Description size="2" mb="4">
            To add a new server, enter the server's address below to fetch its
            information.
          </Dialog.Description>

          <Flex direction="column" gap="4">
            <Flex gap="2" align="center">
              <TextField.Root
                type="url"
                disabled={isSearching}
                onKeyDown={handleEnterKey}
                radius="full"
                placeholder="gryt.chat"
                value={serverHost}
                onChange={(e) =>
                  setServerHost(e.target.value.replace(/ /g, ""))
                }
                style={{ width: "100%" }}
              >
                <TextField.Slot>wss://</TextField.Slot>
              </TextField.Root>

              <Button
                onClick={getServerInfo}
                disabled={isSearching || serverHost.length === 0}
              >
                <Spinner loading={isSearching}>
                  <FiWifi />
                </Spinner>
                {isSearching ? "Connecting" : "Connect"}
              </Button>
            </Flex>

            <AnimatePresence>
              {hasError.length > 0 && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                >
                  <Callout.Root color="red" role="alert">
                    <Callout.Icon>
                      <ExclamationTriangleIcon />
                    </Callout.Icon>
                    <Callout.Text>
                      Could not connect to the server. Please check the address
                      and try again. <br />(
                      {hasError === "xhr poll error"
                        ? "Server is not responding"
                        : hasError}
                      )
                    </Callout.Text>
                  </Callout.Root>
                </motion.div>
              )}
            </AnimatePresence>

            <AnimatePresence>
              {serverInfo && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  style={{
                    overflow: "hidden",
                    display: "flex",
                    flexDirection: "column",
                    gap: "12px",
                  }}
                >
                  <Box maxWidth="100%">
                    <Card>
                      <Flex direction="column" gap="3" align="center">
                        <Avatar
                          size="8"
                          src={serverInfo.icon}
                          radius="full"
                          fallback={serverInfo.name[0]}
                        />
                        <Flex gap="1" direction="column" align="center">
                          <Text size="4" weight="bold">
                            {serverInfo.name}
                          </Text>
                          <Text size="2" color="gray">
                            Members: {serverInfo.members}
                          </Text>
                        </Flex>
                      </Flex>
                    </Card>
                  </Box>

                  <Button disabled={!!servers[serverHost]} onClick={joinServer}>
                    {!!servers[serverHost] ? (
                      "You are already a member"
                    ) : (
                      <>Join {serverInfo.name}</>
                    )}
                  </Button>
                </motion.div>
              )}
            </AnimatePresence>
          </Flex>
        </Flex>
      </Dialog.Content>
    </Dialog.Root>
  );
}
