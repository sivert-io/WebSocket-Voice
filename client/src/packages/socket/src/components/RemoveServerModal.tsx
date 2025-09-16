import { Button, Dialog, Flex, IconButton } from '@radix-ui/themes';
import { Cross2Icon } from '@radix-ui/react-icons';

interface RemoveServerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  serverName?: string;
  serverHost?: string;
}

export function RemoveServerModal({ 
  isOpen, 
  onClose, 
  onConfirm, 
  serverName, 
  serverHost 
}: RemoveServerModalProps) {
  const handleConfirm = () => {
    onConfirm();
    onClose();
  };
  
  return (
    <Dialog.Root open={isOpen} onOpenChange={onClose}>
      <Dialog.Content maxWidth="450px">
        <Dialog.Close>
          <IconButton
            variant="ghost"
            color="gray"
            style={{ position: 'absolute', top: '12px', right: '12px' }}
          >
            <Cross2Icon />
          </IconButton>
        </Dialog.Close>
        
        <Dialog.Title>
          Leave Server
        </Dialog.Title>
        
        <Dialog.Description>
          Are you sure you want to leave <strong>{serverName || serverHost}</strong>? 
          You'll need to rejoin with the server token to connect again.
        </Dialog.Description>

        <Flex gap="3" justify="end" mt="4">
          <Dialog.Close>
            <Button variant="soft" color="gray">
              Cancel
            </Button>
          </Dialog.Close>
          <Button 
            variant="solid" 
            color="red"
            onClick={handleConfirm}
          >
            Leave Server
          </Button>
        </Flex>
      </Dialog.Content>
    </Dialog.Root>
  );
}
