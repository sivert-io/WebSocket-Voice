import { Box, Button, Heading, HoverCard, IconButton } from "@radix-ui/themes";
import { BsVolumeOffFill, BsVolumeUpFill } from "react-icons/bs";
import { AnimatePresence, Variants, motion } from "motion/react";
import { ImPhoneHangUp } from "react-icons/im";
import { SpeakerLoudIcon } from "@radix-ui/react-icons";
import { MdMic, MdMicOff } from "react-icons/md";
import { useSettings } from "@/settings";
import { useSFU } from "../hooks/useSFU";

const buttonAnimations: Variants = {
  hidden: { opacity: 0, x: -15, transition: { duration: 0.1 } },
  visible: {
    opacity: 1,
    x: 0,
    transition: {
      duration: 0.2,
      staggerChildren: 0.075,
      staggerDirection: 0,
      ease: "backOut",
    },
  },
};

export function MiniControls({
  direction = "row",
}: {
  direction: "row" | "column";
}) {
  const {
    setCurrentlyViewingServer,
    currentlyViewingServer,
    isMuted,
    setIsMuted,
    isDeafened,
    setIsDeafened,
  } = useSettings();
  const {
    currentServerConnected,
    disconnect,
    currentChannelConnected,
    isConnected,
  } = useSFU();

  return (
    <AnimatePresence>
      {isConnected &&
        currentlyViewingServer?.host !== currentServerConnected && (
          <motion.div
            variants={buttonAnimations}
            initial="hidden"
            animate="visible"
            exit="hidden"
            style={{
              display: "flex",
              flexDirection: direction === "column" ? "column" : "row-reverse",
              alignItems: "center",
              gap: "8px",
            }}
          >
            <motion.div variants={buttonAnimations}>
              <IconButton
                size="1"
                color={isMuted ? "red" : "gray"}
                variant="soft"
                onClick={() => setIsMuted(!isMuted)}
              >
                {isMuted ? <MdMicOff size={12} /> : <MdMic size={12} />}
              </IconButton>
            </motion.div>

            <motion.div variants={buttonAnimations}>
              <IconButton
                size="1"
                color={isDeafened ? "red" : "gray"}
                variant="soft"
                onClick={() => setIsDeafened(!isDeafened)}
              >
                {isDeafened ? (
                  <BsVolumeOffFill size={12} />
                ) : (
                  <BsVolumeUpFill size={12} />
                )}
              </IconButton>
            </motion.div>

            <motion.div variants={buttonAnimations}>
              <IconButton
                size="1"
                variant="soft"
                color="red"
                onClick={disconnect}
              >
                <ImPhoneHangUp size={12} />
              </IconButton>
            </motion.div>
            <motion.div variants={buttonAnimations}>
              <HoverCard.Root
                openDelay={100}
                closeDelay={0}
                key={currentServerConnected}
              >
                <HoverCard.Trigger>
                  <Button
                    style={{
                      height: "32px",
                      width: "32px",
                      padding: "0",
                    }}
                    color="gray"
                    onClick={() =>
                      setCurrentlyViewingServer(currentServerConnected)
                    }
                  >
                    <SpeakerLoudIcon />
                  </Button>
                </HoverCard.Trigger>
                <HoverCard.Content
                  maxWidth="300px"
                  side="right"
                  size="1"
                  align="center"
                >
                  <Box>
                    <Heading size="1">Go to {currentChannelConnected}</Heading>
                  </Box>
                </HoverCard.Content>
              </HoverCard.Root>
            </motion.div>
          </motion.div>
        )}
    </AnimatePresence>
  );
}
