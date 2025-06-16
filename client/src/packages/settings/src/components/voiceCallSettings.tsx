import { ReloadIcon } from "@radix-ui/react-icons";
import {
  AlertDialog,
  Button,
  Flex,
  Heading,
  IconButton,
  Slider,
  Switch,
  Text,
  Tooltip,
} from "@radix-ui/themes";
import { useEffect, useRef, useState } from "react";
import { FiPlay, FiSquare } from "react-icons/fi";
import useSound from "use-sound";

import connectMp3 from "@/audio/src/assets/connect.mp3";
import disconnectMp3 from "@/audio/src/assets/disconnect.mp3";
import { useSettings } from "@/settings";

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

  // State to track if sounds are currently playing
  const [isConnectSoundPlaying, setIsConnectSoundPlaying] = useState(false);
  const [isDisconnectSoundPlaying, setIsDisconnectSoundPlaying] = useState(false);

  // Alert dialog state
  const [alertDialog, setAlertDialog] = useState<{
    open: boolean;
    type: 'success' | 'error';
    title: string;
    message: string;
  }>({
    open: false,
    type: 'success',
    title: '',
    message: ''
  });

  const showAlert = (type: 'success' | 'error', title: string, message: string) => {
    setAlertDialog({
      open: true,
      type,
      title,
      message
    });
  };

  // Sound hooks for testing with stop controls
  const [playConnectSound, { stop: stopConnectSound }] = useSound(
    customConnectSoundFile || connectMp3,
    {
      volume: connectSoundVolume / 100,
      soundEnabled: true, // Always enabled for testing
      interrupt: false, // Allow multiple sounds to play simultaneously
      onplay: () => {
        console.log("Connect sound started playing", {
          file: customConnectSoundFile || "default connect.mp3",
          volume: connectSoundVolume / 100,
          isCustomFile: !!customConnectSoundFile
        });
        setIsConnectSoundPlaying(true);
      },
      onend: () => {
        console.log("Connect sound finished playing");
        setIsConnectSoundPlaying(false);
      },
      onstop: () => {
        console.log("Connect sound stopped");
        setIsConnectSoundPlaying(false);
      },
      onloaderror: (error: unknown) => {
        console.error("Error loading connect sound:", error, {
          file: customConnectSoundFile || "default connect.mp3",
          isCustomFile: !!customConnectSoundFile
        });
        setIsConnectSoundPlaying(false);
      },
      onplayerror: (error: unknown) => {
        console.error("Error playing connect sound:", error, {
          file: customConnectSoundFile || "default connect.mp3",
          isCustomFile: !!customConnectSoundFile
        });
        setIsConnectSoundPlaying(false);
      },
    }
  );

  const [playDisconnectSound, { stop: stopDisconnectSound }] = useSound(
    customDisconnectSoundFile || disconnectMp3,
    {
      volume: disconnectSoundVolume / 100,
      soundEnabled: true, // Always enabled for testing
      interrupt: false, // Allow multiple sounds to play simultaneously
      onplay: () => {
        console.log("Disconnect sound started playing", {
          file: customDisconnectSoundFile || "default disconnect.mp3",
          volume: disconnectSoundVolume / 100,
          isCustomFile: !!customDisconnectSoundFile
        });
        setIsDisconnectSoundPlaying(true);
      },
      onend: () => {
        console.log("Disconnect sound finished playing");
        setIsDisconnectSoundPlaying(false);
      },
      onstop: () => {
        console.log("Disconnect sound stopped");
        setIsDisconnectSoundPlaying(false);
      },
      onloaderror: (error: unknown) => {
        console.error("Error loading disconnect sound:", error, {
          file: customDisconnectSoundFile || "default disconnect.mp3",
          isCustomFile: !!customDisconnectSoundFile
        });
        setIsDisconnectSoundPlaying(false);
      },
      onplayerror: (error: unknown) => {
        console.error("Error playing disconnect sound:", error, {
          file: customDisconnectSoundFile || "default disconnect.mp3",
          isCustomFile: !!customDisconnectSoundFile
        });
        setIsDisconnectSoundPlaying(false);
      },
    }
  );

  // Cleanup when component unmounts (settings panel closes)
  useEffect(() => {
    return () => {
      console.log("VoiceCallSettings unmounting, stopping all sounds");
      
      // Stop connect sound if playing
      try {
        console.log("Stopping connect sound on unmount");
        stopConnectSound();
      } catch (error) {
        console.error("Error stopping connect sound on unmount:", error);
      }
      
      // Stop disconnect sound if playing
      try {
        console.log("Stopping disconnect sound on unmount");
        stopDisconnectSound();
      } catch (error) {
        console.error("Error stopping disconnect sound on unmount:", error);
      }
    };
  }, [stopConnectSound, stopDisconnectSound]); // Removed playing state from dependencies

  // Validate custom sound files on component mount
  useEffect(() => {
    const isBlobUrl = (url: string): boolean => {
      return url.startsWith('blob:');
    };

    const isDataUrl = (url: string): boolean => {
      return url.startsWith('data:');
    };

    const validateSoundFile = (fileUrl: string, soundType: 'connect' | 'disconnect'): Promise<boolean> => {
      return new Promise((resolve) => {
        // First check if it's a blob URL - these should be cleared immediately
        if (isBlobUrl(fileUrl)) {
          console.warn(`${soundType} sound is a blob URL (${fileUrl.substring(0, 50)}...), clearing from storage`);
          resolve(false);
          return;
        }

        // Only validate data URLs and file paths
        if (!isDataUrl(fileUrl) && !fileUrl.startsWith('/') && !fileUrl.startsWith('./')) {
          console.warn(`${soundType} sound has invalid URL format (${fileUrl.substring(0, 50)}...), clearing from storage`);
          resolve(false);
          return;
        }

        console.log(`Validating ${soundType} sound (${isDataUrl(fileUrl) ? 'data URL' : 'file path'})...`);

        const audio = new Audio();
        const timeoutId = setTimeout(() => {
          console.warn(`${soundType} sound validation timed out after 5 seconds`);
          resolve(false);
        }, 5000);

        audio.oncanplaythrough = () => {
          clearTimeout(timeoutId);
          console.log(`${soundType} sound validated successfully`);
          resolve(true);
        };

        audio.onerror = (error) => {
          clearTimeout(timeoutId);
          console.error(`${soundType} sound validation failed:`, error);
          resolve(false);
        };

        audio.onabort = () => {
          clearTimeout(timeoutId);
          console.warn(`${soundType} sound validation aborted`);
          resolve(false);
        };

        try {
          audio.src = fileUrl;
          audio.load();
        } catch (error) {
          clearTimeout(timeoutId);
          console.error(`Error setting ${soundType} sound src:`, error);
          resolve(false);
        }
      });
    };

    const validateCustomSounds = async () => {
      console.log("Validating custom sound files...");

      // Validate connect sound
      if (customConnectSoundFile) {
        console.log(`Checking custom connect sound: ${customConnectSoundFile.substring(0, 50)}...`);
        const isConnectValid = await validateSoundFile(customConnectSoundFile, 'connect');
        if (!isConnectValid) {
          console.warn("Custom connect sound file is invalid, removing from storage and using default");
          setCustomConnectSoundFile(null);
        }
      }

      // Validate disconnect sound
      if (customDisconnectSoundFile) {
        console.log(`Checking custom disconnect sound: ${customDisconnectSoundFile.substring(0, 50)}...`);
        const isDisconnectValid = await validateSoundFile(customDisconnectSoundFile, 'disconnect');
        if (!isDisconnectValid) {
          console.warn("Custom disconnect sound file is invalid, removing from storage and using default");
          setCustomDisconnectSoundFile(null);
        }
      }

      console.log("Sound file validation complete");
    };

    // Only validate if there are custom sound files to validate
    if (customConnectSoundFile || customDisconnectSoundFile) {
      validateCustomSounds();
    }
  }, []); // Empty dependency array - only run on mount

  const handleConnectFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      console.log("Uploading connect sound file:", {
        name: file.name,
        size: file.size,
        type: file.type
      });

      // Check file size (limit to 1MB to prevent localStorage quota issues)
      const maxSizeBytes = 1024 * 1024; // 1MB
      if (file.size > maxSizeBytes) {
        console.error(`Connect sound file too large: ${(file.size / 1024 / 1024).toFixed(2)}MB (max: 1MB)`);
        showAlert('error', 'File Too Large!', `Please choose a file smaller than 1MB.\nYour file: ${(file.size / 1024 / 1024).toFixed(2)}MB`);
        // Clear the input
        if (connectFileInputRef.current) {
          connectFileInputRef.current.value = '';
        }
        return;
      }
      
      const reader = new FileReader();
      reader.onload = (e) => {
        const dataUrl = e.target?.result as string;
        if (dataUrl) {
          console.log("Connect sound file converted to data URL, length:", dataUrl.length);
          try {
            setCustomConnectSoundFile(dataUrl);
            console.log("Connect sound file saved successfully");
            showAlert('success', 'Sound File Saved', 'Connect sound file saved successfully');
          } catch (error) {
            console.error("Error saving connect sound file (likely localStorage quota exceeded):", error);
            showAlert('error', 'Error Saving Sound File', 'Error saving sound file. Please try a smaller file.');
          }
        } else {
          console.error("Failed to convert connect sound file to data URL");
        }
      };
      reader.onerror = (e) => {
        console.error("Error reading connect sound file:", e);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleDisconnectFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      console.log("Uploading disconnect sound file:", {
        name: file.name,
        size: file.size,
        type: file.type
      });

      // Check file size (limit to 1MB to prevent localStorage quota issues)
      const maxSizeBytes = 1024 * 1024; // 1MB
      if (file.size > maxSizeBytes) {
        console.error(`Disconnect sound file too large: ${(file.size / 1024 / 1024).toFixed(2)}MB (max: 1MB)`);
        showAlert('error', 'File Too Large', `File too large! Please choose a file smaller than 1MB.\nYour file: ${(file.size / 1024 / 1024).toFixed(2)}MB`);
        // Clear the input
        if (disconnectFileInputRef.current) {
          disconnectFileInputRef.current.value = '';
        }
        return;
      }
      
      const reader = new FileReader();
      reader.onload = (e) => {
        const dataUrl = e.target?.result as string;
        if (dataUrl) {
          console.log("Disconnect sound file converted to data URL, length:", dataUrl.length);
          try {
            setCustomDisconnectSoundFile(dataUrl);
            console.log("Disconnect sound file saved successfully");
            showAlert('success', 'Sound File Saved', 'Disconnect sound file saved successfully');
          } catch (error) {
            console.error("Error saving disconnect sound file (likely localStorage quota exceeded):", error);
            showAlert('error', 'Error Saving Sound File', 'Error saving sound file. Please try a smaller file.');
          }
        } else {
          console.error("Failed to convert disconnect sound file to data URL");
        }
      };
      reader.onerror = (e) => {
        console.error("Error reading disconnect sound file:", e);
      };
      reader.readAsDataURL(file);
    }
  };

  const resetConnectSound = () => {
    console.log("Resetting connect sound to default");
    if (isConnectSoundPlaying) {
      stopConnectSound();
    }
    setCustomConnectSoundFile(null);
    if (connectFileInputRef.current) {
      connectFileInputRef.current.value = '';
    }
  };

  const resetDisconnectSound = () => {
    console.log("Resetting disconnect sound to default");
    if (isDisconnectSoundPlaying) {
      stopDisconnectSound();
    }
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
      console.log("Testing connect sound", {
        file: customConnectSoundFile || "default connect.mp3",
        volume: connectSoundVolume / 100,
        isCustomFile: !!customConnectSoundFile,
        isCurrentlyPlaying: isConnectSoundPlaying
      });
      playConnectSound();
    } catch (error) {
      console.error("Error playing connect sound:", error);
      setIsConnectSoundPlaying(false);
    }
  };

  const testDisconnectSound = () => {
    try {
      console.log("Testing disconnect sound", {
        file: customDisconnectSoundFile || "default disconnect.mp3",
        volume: disconnectSoundVolume / 100,
        isCustomFile: !!customDisconnectSoundFile,
        isCurrentlyPlaying: isDisconnectSoundPlaying
      });
      playDisconnectSound();
    } catch (error) {
      console.error("Error playing disconnect sound:", error);
      setIsDisconnectSoundPlaying(false);
    }
  };

  const stopConnectSoundTest = () => {
    console.log("Stopping connect sound test");
    try {
      stopConnectSound();
    } catch (error) {
      console.error("Error stopping connect sound:", error);
      // Force update state in case the stop failed
      setIsConnectSoundPlaying(false);
    }
  };

  const stopDisconnectSoundTest = () => {
    console.log("Stopping disconnect sound test");
    try {
      stopDisconnectSound();
    } catch (error) {
      console.error("Error stopping disconnect sound:", error);
      // Force update state in case the stop failed
      setIsDisconnectSoundPlaying(false);
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
                    {isConnectSoundPlaying ? (
                      <Button
                        variant="ghost"
                        size="2"
                        onClick={stopConnectSoundTest}
                        color="red"
                      >
                        <FiSquare />
                      </Button>
                    ) : (
                      <Button
                        variant="ghost"
                        size="2"
                        onClick={testConnectSound}
                      >
                        <FiPlay />
                      </Button>
                    )}
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
                    {isDisconnectSoundPlaying ? (
                      <Button
                        variant="ghost"
                        size="2"
                        onClick={stopDisconnectSoundTest}
                        color="red"
                      >
                        <FiSquare />
                      </Button>
                    ) : (
                      <Button
                        variant="ghost"
                        size="2"
                        onClick={testDisconnectSound}
                      >
                        <FiPlay />
                      </Button>
                    )}
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
      {alertDialog.open && (
        <AlertDialog.Root open={alertDialog.open} onOpenChange={() => setAlertDialog({ ...alertDialog, open: false })}>
          <AlertDialog.Content maxWidth="450px">
            <AlertDialog.Title>
              {alertDialog.title}
            </AlertDialog.Title>
            <AlertDialog.Description size="2">
              {alertDialog.message}
            </AlertDialog.Description>

            <Flex gap="3" mt="4" justify="end">
              <AlertDialog.Action>
                <Button 
                  variant="soft" 
                  color={alertDialog.type === 'error' ? 'red' : 'green'}
                  onClick={() => setAlertDialog({ ...alertDialog, open: false })}
                >
                  OK
                </Button>
              </AlertDialog.Action>
            </Flex>
          </AlertDialog.Content>
        </AlertDialog.Root>
      )}
    </Flex>
  );
} 