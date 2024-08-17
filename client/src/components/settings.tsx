import { useSettings } from "../hooks/useSettings";
import { Flex, Dialog, IconButton } from "@radix-ui/themes";
import { MicrophoneSettings } from "./microphoneSettings";

import { FiX } from "react-icons/fi";
export function Settings() {
  const { micID, setLoopbackEnabled, setShowSettings, showSettings } =
    useSettings();

  function handleDialogChange(isOpen: boolean) {
    if (micID) {
      setShowSettings(isOpen);
      setLoopbackEnabled(false);
    }
  }

  return (
    <Dialog.Root open={showSettings} onOpenChange={handleDialogChange}>
      <Dialog.Content>
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
