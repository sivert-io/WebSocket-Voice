import { Dialog, Flex, IconButton } from "@radix-ui/themes";
import { FiX } from "react-icons/fi";

import { useSettings } from "@/settings";

import { MicrophoneSettings } from "./microphoneSettings";
export function Settings() {
  const { setLoopbackEnabled, setShowSettings, showSettings } = useSettings();

  function handleDialogChange(isOpen: boolean) {
    setShowSettings(isOpen);
    setLoopbackEnabled(false);
  }

  return (
    <Dialog.Root open={showSettings} onOpenChange={handleDialogChange}>
      <Dialog.Content maxWidth="650px">
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
            Settings
          </Dialog.Title>

          {showSettings && <MicrophoneSettings />}
        </Flex>
      </Dialog.Content>
    </Dialog.Root>
  );
}
