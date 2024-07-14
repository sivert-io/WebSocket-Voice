import { useSettings } from "../hooks/useSettings";
import { Flex, Dialog } from "@radix-ui/themes";
import { MicrophoneSettings } from "./microphoneSettings";

export function Settings({
  show,
  setShow,
}: {
  show: boolean;
  setShow: (n: boolean) => any;
}) {
  const { micID, setLoopbackEnabled } = useSettings();

  function handleDialogChange(isOpen: boolean) {
    if (micID) {
      setShow(isOpen);
      setLoopbackEnabled(false);
    }
  }

  return (
    <Dialog.Root open={show} onOpenChange={handleDialogChange}>
      <Dialog.Content>
        <Flex direction="column" gap="2">
          <Dialog.Title as="h1" weight="bold" size="6">
            Settings
          </Dialog.Title>

          {show && <MicrophoneSettings />}
        </Flex>
      </Dialog.Content>
    </Dialog.Root>
  );
}
