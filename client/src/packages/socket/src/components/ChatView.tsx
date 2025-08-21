import { Box, Button, Card, Flex, Text, TextField } from "@radix-ui/themes";
import { useMemo } from "react";

export type ChatMessage = {
  conversation_id: string;
  message_id: string;
  sender_id: string;
  text: string | null;
  attachments: string[] | null;
  created_at: string | Date;
  pending?: boolean;
};

export const ChatView = ({
  chatMessages,
  chatText,
  setChatText,
  canSend,
  sendChat,
  currentUserId,
}: {
  chatMessages: ChatMessage[];
  chatText: string;
  setChatText: (value: string) => void;
  canSend: boolean;
  sendChat: () => void;
  currentUserId?: string;
}) => {
  const groups = useMemo(() => {
    const result: Array<{ senderId: string; messages: ChatMessage[] }> = [];
    for (const m of chatMessages) {
      const last = result[result.length - 1];
      if (!last || last.senderId !== m.sender_id) {
        result.push({ senderId: m.sender_id, messages: [m] });
      } else {
        last.messages.push(m);
      }
    }
    return result;
  }, [chatMessages]);

  return (
    <Box
      overflow="hidden"
      flexGrow="1"
      style={{
        background: "var(--color-panel-translucent)",
        borderRadius: "12px",
      }}
    >
      <Flex height="100%" width="100%" direction="column" p="3">
        <Flex direction="column" justify="start" align="start" flexGrow="1" style={{ gap: 12, overflowY: "auto" }}>
          {groups.length === 0 ? (
            <Flex direction="column" justify="center" align="center" style={{ opacity: 0.6, width: "100%", height: "100%" }}>
              <Text size="2">No messages yet</Text>
            </Flex>
          ) : (
            groups.map((group, idx) => {
              const isSelf = !!currentUserId && group.senderId === currentUserId;
              return (
                <Flex key={`${group.senderId}-${idx}`} direction="column" style={{ width: "100%" }} align={isSelf ? "end" : "start"}>
                  <Text size="1" color="gray" style={{ marginBottom: 6 }}>
                    {isSelf ? "You" : "Them"}
                  </Text>
                  <Flex direction="column" style={{ gap: 6, width: "100%" }}>
                    {group.messages.map((m) => (
                      <Card
                        key={m.message_id}
                        style={{
                          alignSelf: isSelf ? "flex-end" : "flex-start",
                          maxWidth: "80%",
                          borderRadius: 16,
                          padding: "8px 12px",
                          background: isSelf ? "var(--accent-4)" : "var(--gray-4)",
                          color: isSelf ? "var(--accent-12)" : "inherit",
                          opacity: m.pending ? 0.6 : 1,
                        }}
                      >
                        <Text size="2">{m.text}</Text>
                      </Card>
                    ))}
                  </Flex>
                </Flex>
              );
            })
          )}
        </Flex>

        <Box style={{ position: "relative" }}>
          <TextField.Root
            radius="full"
            placeholder="Chat with your friends!"
            value={chatText}
            onChange={(e) => setChatText(e.target.value)}
            onKeyDown={(e) => {
              console.log("🔑 Key pressed:", (e as any).key, "canSend:", canSend);
              if ((e as any).key === "Enter" && canSend) {
                console.log("✉️ Sending chat message");
                sendChat();
              }
            }}
            style={{ paddingRight: 96 }}
          />
          <Button
            onClick={sendChat}
            disabled={!canSend}
            style={{
              position: "absolute",
              right: 8,
              top: "50%",
              transform: "translateY(-50%)",
              borderRadius: 9999,
              opacity: canSend ? 1 : 0,
              pointerEvents: canSend ? "auto" : "none",
              transition: "opacity 160ms ease",
            }}
          >
            Send
          </Button>
        </Box>
      </Flex>
    </Box>
  );
}; 