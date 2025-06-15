import { ReloadIcon } from "@radix-ui/react-icons";
import {
  Button,
  Flex,
  Heading,
  IconButton,
  Slider,
  Switch,
  Text,
  Tooltip,
} from "@radix-ui/themes";
import { useRef } from "react";
import useSound from "use-sound";
import { FiPlay } from "react-icons/fi";

import { useSettings } from "@/settings";
import connectMp3 from "@/audio/src/assets/connect.mp3";
import disconnectMp3 from "@/audio/src/assets/disconnect.mp3";

export function VoiceCallSettings() {
  const {
    connectSoundEnabled,
    setConnectSoundEnabled,
    disconnectSoundEnabled,
    setDisconnectSoundEnabled,
    connectSoundVolume,
    setConnectSoundVolume,
    disconnectSoundVolume,
    setDisconnectSoundVolume,
    customConnectSoundFile,
    setCustomConnectSoundFile,
    customDisconnectSoundFile,
    setCustomDisconnectSoundFile,
  } = useSettings();

  const connectFileInputRef = useRef<HTMLInputElement>(null);
  const disconnectFileInputRef = useRef<HTMLInputElement>(null);

  // Sound hooks for testing
  const [playConnectSound] = useSound(
    customConnectSoundFile || connectMp3,
    {
      volume: connectSoundVolume / 100,
      soundEnabled: true, // Always enabled for testing
    }
  );

  const [playDisconnectSound] = useSound(
    customDisconnectSoundFile || disconnectMp3,
    {
      volume: disconnectSoundVolume / 100,
      soundEnabled: true, // Always enabled for testing
    }
  );

  const handleConnectFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const url = URL.createObjectURL(file);
      setCustomConnectSoundFile(url);
    }
  };

  const handleDisconnectFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const url = URL.createObjectURL(file);
      setCustomDisconnectSoundFile(url);
    }
  };

  const resetConnectSound = () => {
    setCustomConnectSoundFile(null);
    if (connectFileInputRef.current) {
      connectFileInputRef.current.value = '';
    }
  };

  const resetDisconnectSound = () => {
    setCustomDisconnectSoundFile(null);
    if (disconnectFileInputRef.current) {
      disconnectFileInputRef.current.value = '';
    }
  };

  const resetConnectVolume = () => {
    setConnectSoundVolume(10);
  };

  const resetDisconnectVolume = () => {
    setDisconnectSoundVolume(10);
  };

  const testConnectSound = () => {
    try {
      playConnectSound();
    } catch (error) {
      console.error("Error playing connect sound:", error);
    }
  };

  const testDisconnectSound = () => {
    try {
      playDisconnectSound();
    } catch (error) {
      console.error("Error playing disconnect sound:", error);
    }
  };

  return (
    <Flex
      direction="column"
      gap="2"
      style={{
        paddingBottom: "16px",
      }}
    >
      <Heading as="h2" size="4">
        Voice Call Sounds
      </Heading>
      <Flex direction="column" gap="4">
        {/* Connect Sound Settings */}
        <Flex direction="column" gap="3">
          <Text weight="medium" size="3">
            Connect Sound
          </Text>
          
          {/* Enable/Disable Connect Sound */}
          <Flex align="center" justify="between">
            <Text size="2" color="gray">
              Play sound when connecting to voice
            </Text>
            <Switch
              checked={connectSoundEnabled}
              onCheckedChange={setConnectSoundEnabled}
            />
          </Flex>

          {connectSoundEnabled && (
            <>
              {/* Connect Sound Volume */}
              <Flex direction="column" gap="2">
                <Flex align="center" justify="between">
                  <Text weight="medium" size="2">
                    Volume
                  </Text>
                  <Flex gap="1">
                    <Tooltip content="Reset to default (10%)" side="top">
                      <IconButton
                        size="1"
                        variant="ghost"
                        color={connectSoundVolume !== 10 ? "red" : "gray"}
                        onClick={resetConnectVolume}
                        disabled={connectSoundVolume === 10}
                      >
                        <ReloadIcon />
                      </IconButton>
                    </Tooltip>
                  </Flex>
                </Flex>
                <Flex align="center" gap="2">
                  <Slider
                    min={0}
                    max={100}
                    value={[connectSoundVolume]}
                    onValueChange={(value) => {
                      if (!Number.isNaN(value[0])) {
                        setConnectSoundVolume(Math.min(100, Math.max(0, value[0])));
                      }
                    }}
                  />
                  <Text
                    style={{
                      minWidth: "36px",
                    }}
                    size="2"
                  >
                    {connectSoundVolume}%
                  </Text>
                </Flex>
              </Flex>

              {/* Custom Connect Sound File */}
              <Flex direction="column" gap="2">
                <Flex align="center" justify="between">
                  <Text weight="medium" size="2">
                    Custom Sound File
                  </Text>
                  <Tooltip content="Reset to default sound" side="top">
                    <IconButton
                      size="1"
                      variant="ghost"
                      color={customConnectSoundFile ? "red" : "gray"}
                      onClick={resetConnectSound}
                      disabled={!customConnectSoundFile}
                    >
                      <ReloadIcon />
                    </IconButton>
                  </Tooltip>
                </Flex>
                <Flex align="center" gap="2">
                  <input
                    ref={connectFileInputRef}
                    type="file"
                    accept="audio/*"
                    onChange={handleConnectFileUpload}
                    style={{ display: 'none' }}
                  />
                  <Button
                    variant="soft"
                    onClick={() => connectFileInputRef.current?.click()}
                    style={{ flexGrow: 1 }}
                  >
                    {customConnectSoundFile ? 'Change File' : 'Choose File'}
                  </Button>
                  <Tooltip content="Test sound" side="top">
                    <Button
                      variant="ghost"
                      size="2"
                      onClick={testConnectSound}
                    >
                      <FiPlay />
                    </Button>
                  </Tooltip>
                </Flex>
                {customConnectSoundFile && (
                  <Text size="1" color="green">
                    ✓ Custom sound file loaded
                  </Text>
                )}
              </Flex>
            </>
          )}
        </Flex>

        {/* Disconnect Sound Settings */}
        <Flex direction="column" gap="3">
          <Text weight="medium" size="3">
            Disconnect Sound
          </Text>
          
          {/* Enable/Disable Disconnect Sound */}
          <Flex align="center" justify="between">
            <Text size="2" color="gray">
              Play sound when disconnecting from voice
            </Text>
            <Switch
              checked={disconnectSoundEnabled}
              onCheckedChange={setDisconnectSoundEnabled}
            />
          </Flex>

          {disconnectSoundEnabled && (
            <>
              {/* Disconnect Sound Volume */}
              <Flex direction="column" gap="2">
                <Flex align="center" justify="between">
                  <Text weight="medium" size="2">
                    Volume
                  </Text>
                  <Flex gap="1">
                    <Tooltip content="Reset to default (10%)" side="top">
                      <IconButton
                        size="1"
                        variant="ghost"
                        color={disconnectSoundVolume !== 10 ? "red" : "gray"}
                        onClick={resetDisconnectVolume}
                        disabled={disconnectSoundVolume === 10}
                      >
                        <ReloadIcon />
                      </IconButton>
                    </Tooltip>
                  </Flex>
                </Flex>
                <Flex align="center" gap="2">
                  <Slider
                    min={0}
                    max={100}
                    value={[disconnectSoundVolume]}
                    onValueChange={(value) => {
                      if (!Number.isNaN(value[0])) {
                        setDisconnectSoundVolume(Math.min(100, Math.max(0, value[0])));
                      }
                    }}
                  />
                  <Text
                    style={{
                      minWidth: "36px",
                    }}
                    size="2"
                  >
                    {disconnectSoundVolume}%
                  </Text>
                </Flex>
              </Flex>

              {/* Custom Disconnect Sound File */}
              <Flex direction="column" gap="2">
                <Flex align="center" justify="between">
                  <Text weight="medium" size="2">
                    Custom Sound File
                  </Text>
                  <Tooltip content="Reset to default sound" side="top">
                    <IconButton
                      size="1"
                      variant="ghost"
                      color={customDisconnectSoundFile ? "red" : "gray"}
                      onClick={resetDisconnectSound}
                      disabled={!customDisconnectSoundFile}
                    >
                      <ReloadIcon />
                    </IconButton>
                  </Tooltip>
                </Flex>
                <Flex align="center" gap="2">
                  <input
                    ref={disconnectFileInputRef}
                    type="file"
                    accept="audio/*"
                    onChange={handleDisconnectFileUpload}
                    style={{ display: 'none' }}
                  />
                  <Button
                    variant="soft"
                    onClick={() => disconnectFileInputRef.current?.click()}
                    style={{ flexGrow: 1 }}
                  >
                    {customDisconnectSoundFile ? 'Change File' : 'Choose File'}
                  </Button>
                  <Tooltip content="Test sound" side="top">
                    <Button
                      variant="ghost"
                      size="2"
                      onClick={testDisconnectSound}
                    >
                      <FiPlay />
                    </Button>
                  </Tooltip>
                </Flex>
                {customDisconnectSoundFile && (
                  <Text size="1" color="green">
                    ✓ Custom sound file loaded
                  </Text>
                )}
              </Flex>
            </>
          )}
        </Flex>
      </Flex>
    </Flex>
  );
} 