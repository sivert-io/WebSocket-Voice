import { Box, Button, Card, Flex, Text, TextField } from "@radix-ui/themes";
import { useEffect,useMemo, useRef, useState } from "react";

export type Reaction = {
  src: string; // Image source/URL for the reaction
  amount: number; // Count of users who reacted with this image
  users: string[]; // Array of server_user_ids who reacted with this image
};

export type ChatMessage = {
  conversation_id: string;
  message_id: string;
  sender_server_id: string;
  sender_nickname: string;
  text: string | null;
  attachments: string[] | null;
  created_at: string | Date;
  reactions: Reaction[] | null;
  pending?: boolean;
};

// Context menu component
const MessageContextMenu = ({ 
  position, 
  onClose, 
  onReaction, 
  onReply, 
  onReport 
}: {
  position: { x: number; y: number };
  onClose: () => void;
  onReaction: (reactionSrc: string) => void;
  onReply: () => void;
  onReport: () => void;
}) => {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [onClose]);

  const quickReactions = ['😀', '❤️', '👍', '👎', '😂', '😮', '😢', '😡'];

  // Smart positioning to keep menu within viewport
  const [adjustedPosition, setAdjustedPosition] = useState(position);
  
  useEffect(() => {
    if (!menuRef.current) return;
    
    const menu = menuRef.current;
    const rect = menu.getBoundingClientRect();
    const viewport = {
      width: window.innerWidth,
      height: window.innerHeight
    };
    
    let newX = position.x;
    let newY = position.y;
    
    // Adjust horizontal position if menu would go off-screen
    if (position.x + rect.width > viewport.width) {
      newX = viewport.width - rect.width - 10; // 10px margin
    }
    if (newX < 10) newX = 10; // Minimum margin
    
    // Adjust vertical position if menu would go off-screen
    if (position.y + rect.height > viewport.height) {
      newY = position.y - rect.height - 5; // Show above cursor
    }
    if (newY < 10) newY = 10; // Minimum margin
    
    setAdjustedPosition({ x: newX, y: newY });
  }, [position]);

  return (
    <div
      ref={menuRef}
      style={{
        position: 'fixed',
        left: adjustedPosition.x,
        top: adjustedPosition.y,
        zIndex: 9999, // Higher z-index to appear above other elements
        background: 'var(--color-panel-solid)', // Use solid background
        border: '1px solid var(--gray-7)',
        borderRadius: '12px',
        boxShadow: '0 12px 32px rgba(0, 0, 0, 0.3), 0 4px 8px rgba(0, 0, 0, 0.1)', // Multiple shadows for depth
        padding: '12px',
        minWidth: '220px',
        backdropFilter: 'blur(12px)', // Stronger blur effect
        opacity: 1, // Ensure it's not transparent
        transform: 'translateY(-2px)', // Slight lift effect
      }}
    >
      {/* Quick reactions row */}
      <div style={{ marginBottom: '8px' }}>
        <Text size="1" color="gray" style={{ marginBottom: '4px', display: 'block' }}>
          React
        </Text>
        <Flex gap="2" wrap="wrap">
          {quickReactions.map((emoji) => (
            <Button
              key={emoji}
              variant="ghost"
              size="1"
              onClick={() => {
                onReaction(emoji);
                onClose();
              }}
              style={{
                padding: '6px 10px',
                minWidth: 'auto',
                fontSize: '18px',
                borderRadius: '8px',
                transition: 'all 0.2s ease',
              }}
            >
              {emoji}
            </Button>
          ))}
          <Button
            variant="ghost"
            size="1"
            onClick={() => {
              // TODO: Open emoji picker
              onClose();
            }}
            style={{
              padding: '6px 10px',
              minWidth: 'auto',
              borderRadius: '8px',
              transition: 'all 0.2s ease',
            }}
          >
            +
          </Button>
        </Flex>
      </div>

      {/* Divider */}
      <div style={{ height: '1px', background: 'var(--gray-6)', margin: '8px 0' }} />

      {/* Action buttons */}
      <Flex direction="column" gap="1">
        <Button
          variant="ghost"
          size="1"
          onClick={() => {
            onReply();
            onClose();
          }}
          style={{ justifyContent: 'flex-start' }}
        >
          Reply
        </Button>
        <Button
          variant="ghost"
          size="1"
          onClick={() => {
            onReport();
            onClose();
          }}
          style={{ justifyContent: 'flex-start', color: 'var(--red-11)' }}
        >
          Report
        </Button>
      </Flex>
    </div>
  );
};

export const ChatView = ({
  chatMessages,
  chatText,
  setChatText,
  canSend,
  sendChat,
  currentUserId,
  placeholder,
  currentUserNickname,
  socketConnection,
}: {
  chatMessages: ChatMessage[];
  chatText: string;
  setChatText: (value: string) => void;
  canSend: boolean;
  sendChat: () => void;
  currentUserId?: string;
  placeholder?: string;
  currentUserNickname?: string;
  socketConnection?: unknown; // Socket.IO connection
}) => {
  // Context menu state
  const [contextMenu, setContextMenu] = useState<{
    message: ChatMessage;
    position: { x: number; y: number };
  } | null>(null);

  // Handle right-click on message
  const handleMessageRightClick = (event: React.MouseEvent, message: ChatMessage) => {
    event.preventDefault();
    setContextMenu({
      message,
      position: { x: event.clientX, y: event.clientY }
    });
  };

  // Close context menu
  const closeContextMenu = () => {
    setContextMenu(null);
  };

  // Handle reaction (add or remove)
  const handleReaction = (reactionSrc: string, message?: ChatMessage) => {
    const targetMessage = message || contextMenu?.message;
    if (!targetMessage || !socketConnection || !currentUserId) return;
    
    // Check if user already reacted with this emoji
    const existingReaction = targetMessage.reactions?.find(r => r.src === reactionSrc);
    const hasUserReacted = existingReaction?.users.includes(currentUserId);
    
    console.log(hasUserReacted ? 'Removing reaction:' : 'Adding reaction:', {
      messageId: targetMessage.message_id,
      conversationId: targetMessage.conversation_id,
      reactionSrc,
      currentUserId,
      hasUserReacted
    });
    
    // Emit reaction event to server (server will handle add/remove logic)
    (socketConnection as { emit: (event: string, data: unknown) => void; host?: string }).emit("chat:react", {
      conversationId: targetMessage.conversation_id,
      messageId: targetMessage.message_id,
      reactionSrc: reactionSrc,
      accessToken: localStorage.getItem(`accessToken_${(socketConnection as { host?: string }).host}`) || localStorage.getItem(`accessToken_${window.location.hostname}`)
    });
  };

  // Handle reply
  const handleReply = () => {
    if (!contextMenu) return;
    
    console.log('Replying to message:', contextMenu.message.message_id);
    
    // TODO: Implement reply functionality
    // This could set a reply state or focus the input with a mention
  };

  // Handle report
  const handleReport = () => {
    if (!contextMenu) return;
    
    console.log('Reporting message:', contextMenu.message.message_id);
    
    // TODO: Implement report functionality
    // This could open a report dialog or send a report to the server
  };
  const groups = useMemo(() => {
    const result: Array<{ senderId: string; messages: ChatMessage[] }> = [];
    for (const m of chatMessages) {
      const last = result[result.length - 1];
      if (!last || last.senderId !== m.sender_server_id) {
        result.push({ senderId: m.sender_server_id, messages: [m] });
      } else {
        last.messages.push(m);
      }
    }
    return result;
  }, [chatMessages]);

  return (
    <>
      {/* Context Menu */}
      {contextMenu && (
        <MessageContextMenu
          position={contextMenu.position}
          onClose={closeContextMenu}
          onReaction={handleReaction}
          onReply={handleReply}
          onReport={handleReport}
        />
      )}

      <Box
        overflow="hidden"
        flexGrow="1"
        style={{
          background: "var(--color-panel)",
          borderRadius: "12px",
        }}
      >
      <Flex height="100%" width="100%" direction="column" p="3">
        <Flex direction="column" justify="end" flexGrow="1" style={{ gap: 12, overflowY: "auto", paddingBottom: "16px" }}>
          {groups.length === 0 ? (
              <Text size="2">No messages yet</Text>
          ) : (
            groups.map((group, idx) => {
              const isSelf = !!currentUserId && group.senderId === currentUserId;
              return (
                <Flex key={`${group.senderId}-${idx}`} direction="column" style={{ width: "100%" }} align={isSelf ? "end" : "start"}>
                  <Text size="1" color="gray" style={{ marginBottom: 6 }}>
                    {isSelf ? (currentUserNickname || group.messages[0].sender_nickname || "You") : group.messages[0].sender_nickname}
                  </Text>
                  <Flex direction="column" style={{ gap: 6, width: "100%" }}>
                    {group.messages.map((m) => (
                      <Flex key={m.message_id} direction="column" style={{ width: "100%" }} align={isSelf ? "end" : "start"}>
                        <Card
                          onContextMenu={(e) => handleMessageRightClick(e, m)}
                          style={{
                            alignSelf: isSelf ? "flex-end" : "flex-start",
                            maxWidth: "80%",
                            borderRadius: 16,
                            padding: "8px 12px",
                            background: isSelf ? "var(--accent-4)" : "var(--gray-4)",
                            color: isSelf ? "var(--accent-12)" : "inherit",
                            opacity: m.pending ? 0.6 : 1,
                            cursor: 'context-menu',
                          }}
                        >
                          <Text size="2">{m.text}</Text>
                        </Card>
                        
                        {/* Display existing reactions below the message */}
                        {m.reactions && m.reactions.length > 0 && (
                          <Flex gap="1" wrap="wrap" style={{ marginTop: '2px', maxWidth: "80%" }} align={isSelf ? "end" : "start"}>
                            {m.reactions.map((reaction, idx) => {
                              // Log reaction rendering for debugging
                              console.log(`🎨 Rendering reaction ${reaction.src} for message ${m.message_id}:`, reaction);
                              return (
                              <Button
                                key={`${reaction.src}-${idx}`}
                                variant="ghost"
                                size="1"
                                onClick={() => handleReaction(reaction.src, m)}
                                style={{
                                  padding: '2px 6px',
                                  minWidth: 'auto',
                                  fontSize: '12px',
                                  height: 'auto',
                                  background: 'var(--gray-3)',
                                  borderRadius: '12px',
                                  transition: 'all 0.2s ease',
                                }}
                                onMouseEnter={(e) => {
                                  e.currentTarget.style.background = 'var(--gray-4)';
                                }}
                                onMouseLeave={(e) => {
                                  e.currentTarget.style.background = 'var(--gray-3)';
                                }}
                              >
                                {reaction.src} {reaction.amount}
                              </Button>
                              );
                            })}
                          </Flex>
                        )}
                      </Flex>
                    ))}
                  </Flex>
                </Flex>
              );
            })
          )}
        </Flex>

        <Flex gap="2">
          <TextField.Root
            radius="full"
            style={{flexGrow: 1}}
            placeholder={placeholder || "Chat with your friends!"}
            value={chatText}
            onChange={(e) => setChatText(e.target.value)}
            onKeyDown={(e) => {
              console.log("🔑 Key pressed:", e.key, "canSend:", canSend);
              if (e.key === "Enter" && canSend) {
                console.log("✉️ Sending chat message");
                sendChat();
              }
            }}
          />
          <Button
            onClick={() => {
              console.log("🔘 Send button clicked", { canSend, chatText: chatText.trim() });
              sendChat();
            }}
            style={{
              borderRadius: 9999,
              opacity: canSend ? 1 : 0.5,
              pointerEvents: canSend ? "auto" : "none",
              transition: "opacity 160ms ease",
            }}
          >
            Send
          </Button>
        </Flex>
      </Flex>
    </Box>
    </>
  );
}; 