import { Box, Dialog, Flex, IconButton, Tabs } from "@radix-ui/themes";
import { FiX } from "react-icons/fi";
import { MdMic, MdVolumeUp, MdPalette, MdBugReport } from "react-icons/md";

import { useSettings } from "@/settings";

import { MicrophoneSettings } from "./microphoneSettings";
import { VoiceCallSettings } from "./voiceCallSettings";
import { AppearanceSettings } from "./theme/appearanceSettings";
import { DebugSettings } from "./debugSettings";

const TAB_CONFIG = [
  {
    value: "appearance",
    label: "Appearance",
    icon: MdPalette,
    content: <AppearanceSettings />,
  },
  {
    value: "voice-calls",
    label: "Voice Calls",
    icon: MdVolumeUp,
    content: <VoiceCallSettings />,
  },
  {
    value: "microphone",
    label: "Microphone",
    icon: MdMic,
    content: <MicrophoneSettings />,
    conditional: true, // Only render if selected
  },
  {
    value: "debug",
    label: "Debug",
    icon: MdBugReport,
    content: <DebugSettings />,
  },
];

export function Settings() {
  const {
    setLoopbackEnabled,
    setShowSettings,
    showSettings,
    settingsTab,
    setSettingsTab,
  } = useSettings();

  function handleDialogChange(isOpen: boolean) {
    setShowSettings(isOpen);
    setLoopbackEnabled(false);
  }

  function handleTabChange(value: string) {
    setLoopbackEnabled(false);
    setSettingsTab(value);
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
            <Tabs.Root
              value={settingsTab}
              onValueChange={handleTabChange}
              orientation="vertical"
              style={{ flex: 1 }}
            >
              <Flex gap="4" height="100%">
                {/* Vertical Tab List */}
                <Box style={{ minWidth: "200px", flexShrink: 0 }}>
                  <Tabs.List
                    style={{
                      flexDirection: "column",
                      alignItems: "stretch",
                      height: "fit-content",
                      gap: "4px",
                    }}
                  >
                    {TAB_CONFIG.map(({ value, label, icon: Icon }) => (
                      <Tabs.Trigger
                        key={value}
                        value={value}
                        style={{
                          justifyContent: "flex-start",
                          padding: "12px 16px",
                          gap: "8px",
                        }}
                      >
                        <Icon size={16} />
                        {label}
                      </Tabs.Trigger>
                    ))}
                  </Tabs.List>
                </Box>

                {/* Tab Content */}
                <Box style={{ flex: 1, overflow: "auto", minWidth: 0 }}>
                  {TAB_CONFIG.map(({ value, content, conditional }) => (
                    <Tabs.Content key={value} value={value}>
                      {conditional
                        ? settingsTab === value && showSettings && content
                        : content}
                    </Tabs.Content>
                  ))}
                </Box>
              </Flex>
            </Tabs.Root>
          )}
        </Flex>
      </Dialog.Content>
    </Dialog.Root>
  );
}
