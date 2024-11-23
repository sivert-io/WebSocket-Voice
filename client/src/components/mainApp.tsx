import { Flex } from "@radix-ui/themes";

import { useSettings } from "@/settings";
import { ServerView } from "@/socket/src/components/serverView";

import { Sidebar } from "./sidebar";

export function MainApp() {
  const { servers } = useSettings();

  return (
    <Flex
      style={{ position: "fixed", inset: 0 }}
      gap="4"
      overflow="hidden"
      p="4"
    >
      <Sidebar />

      {Object.keys(servers).length > 0 ? (
        <ServerView />
      ) : (
        <Flex height="56px" align="center">
          👈 Add a server using this button
        </Flex>
      )}
    </Flex>
  );
}
