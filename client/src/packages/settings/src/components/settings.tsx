import { Box,Dialog, Flex, IconButton, Tabs } from "@radix-ui/themes";
import { FiX } from "react-icons/fi";
import { MdMic, MdVolumeUp } from "react-icons/md";
import { MdPalette } from "react-icons/md";

import { useSettings } from "@/settings";

import { MicrophoneSettings } from "./microphoneSettings";
import { VoiceCallSettings } from "./voiceCallSettings";
import { AppearanceSettings } from "./theme/appearanceSettings";

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
      <Dialog.Content maxWidth="900px" style={{ height: "700px", minWidth: "600px" }}>
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
                <Box style={{ minWidth: "200px", flexShrink: 0 }}>
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
                    <Tabs.Trigger 
                      value="appearance" 
                      style={{ 
                        justifyContent: "flex-start",
                        padding: "12px 16px",
                        gap: "8px"
                      }}
                    >
                      <MdPalette size={16} />
                      Appearance
                    </Tabs.Trigger>
                  </Tabs.List>
                </Box>

                {/* Tab Content */}
                <Box style={{ flex: 1, overflow: "auto", minWidth: 0 }}>
                  <Tabs.Content value="microphone">
                    <MicrophoneSettings />
                  </Tabs.Content>
                  <Tabs.Content value="voice-calls">
                    <VoiceCallSettings />
                  </Tabs.Content>
                  <Tabs.Content value="appearance">
                    <AppearanceSettings />
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
