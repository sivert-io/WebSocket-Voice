import { Box,Dialog, Flex, IconButton, Tabs } from "@radix-ui/themes";
import { FiX } from "react-icons/fi";
import { MdMic, MdVolumeUp } from "react-icons/md";

import { useSettings } from "@/settings";

import { MicrophoneSettings } from "./microphoneSettings";
import { VoiceCallSettings } from "./voiceCallSettings";

export function Settings() {
  const { 
    setLoopbackEnabled, 
    setShowSettings, 
    showSettings, 
    settingsTab, 
    setSettingsTab 
  } = useSettings();

  function handleDialogChange(isOpen: boolean) {
    setShowSettings(isOpen);
    setLoopbackEnabled(false);
  }

  return (
    <Dialog.Root open={showSettings} onOpenChange={handleDialogChange}>
      <Dialog.Content maxWidth="800px" style={{ height: "600px" }}>
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
        
        <Flex direction="column" gap="4" height="100%">
          <Dialog.Title as="h1" weight="bold" size="6">
            Settings
          </Dialog.Title>

          {showSettings && (
            <Tabs.Root value={settingsTab} onValueChange={setSettingsTab} orientation="vertical" style={{ flex: 1 }}>
              <Flex gap="4" height="100%">
                {/* Vertical Tab List */}
                <Box style={{ minWidth: "200px" }}>
                  <Tabs.List 
                    style={{ 
                      flexDirection: "column", 
                      alignItems: "stretch",
                      height: "fit-content",
                      gap: "4px"
                    }}
                  >
                    <Tabs.Trigger 
                      value="microphone" 
                      style={{ 
                        justifyContent: "flex-start",
                        padding: "12px 16px",
                        gap: "8px"
                      }}
                    >
                      <MdMic size={16} />
                      Microphone
                    </Tabs.Trigger>
                    <Tabs.Trigger 
                      value="voice-calls" 
                      style={{ 
                        justifyContent: "flex-start",
                        padding: "12px 16px",
                        gap: "8px"
                      }}
                    >
                      <MdVolumeUp size={16} />
                      Voice Calls
                    </Tabs.Trigger>
                  </Tabs.List>
                </Box>

                {/* Tab Content */}
                <Box style={{ flex: 1, overflow: "auto" }}>
                  <Tabs.Content value="microphone">
                    <MicrophoneSettings />
                  </Tabs.Content>
                  <Tabs.Content value="voice-calls">
                    <VoiceCallSettings />
                  </Tabs.Content>
                </Box>
              </Flex>
            </Tabs.Root>
          )}
        </Flex>
      </Dialog.Content>
    </Dialog.Root>
  );
}
