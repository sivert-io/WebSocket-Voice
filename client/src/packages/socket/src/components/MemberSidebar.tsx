import { useEffect } from "react";
import { Avatar, Flex, Text, Box } from "@radix-ui/themes";
import { BsVolumeOffFill } from "react-icons/bs";
import { MdMicOff } from "react-icons/md";
import { HiSpeakerWave } from "react-icons/hi2";
import { UserStatus } from "../types/clients";

export interface MemberInfo {
  serverUserId: string;
  nickname: string;
  status: UserStatus;
  lastSeen?: Date;
  isMuted: boolean;
  isDeafened: boolean;
  color: string;
  isConnectedToVoice: boolean;
  hasJoinedChannel: boolean;
  streamID: string;
}

interface MemberSidebarProps {
  members: MemberInfo[];
  currentConnectionId?: string;
  clientsSpeaking: Record<string, boolean>;
  currentServerConnected: string | null;
  serverHost: string;
}

export const MemberSidebar = ({
  members,
  clientsSpeaking,
}: MemberSidebarProps) => {
  // Sort members by status priority and then alphabetically
  const memberList = [...members].sort((a, b) => {
    // Current user first (if we can identify them by serverUserId)
    // Note: We'll need to pass current user's serverUserId to identify them
    
    // Then by status priority: in_voice > online > afk > offline
    const statusPriority = { 'in_voice': 0, 'online': 1, 'afk': 2, 'offline': 3 };
    const aPriority = statusPriority[a.status] || 3;
    const bPriority = statusPriority[b.status] || 3;
    
    if (aPriority !== bPriority) {
      return aPriority - bPriority;
    }
    
    // Finally alphabetically by nickname
    return a.nickname.localeCompare(b.nickname);
  });

  // Debug member filtering (only log when members count changes)
  useEffect(() => {
    console.log("👥 MemberSidebar - Total members received:", members.length);
    console.log("✅ MemberSidebar - Members shown:", memberList.length);
  }, [members.length, memberList.length]);

  const getStatusColor = (member: MemberInfo) => {
    switch (member.status) {
      case 'in_voice':
        return "var(--green-9)";
      case 'online':
        return "var(--blue-9)";
      case 'afk':
        return "var(--orange-9)";
      case 'offline':
        return "var(--gray-9)";
      default:
        return "var(--gray-9)";
    }
  };

  const getStatusText = (member: MemberInfo) => {
    switch (member.status) {
      case 'in_voice':
        return "In Voice";
      case 'online':
        return "Online";
      case 'afk':
        return "AFK";
      case 'offline':
        return "Offline";
      default:
        return "Unknown";
    }
  };

  return (
    <Box
      width="240px"
      style={{
        background: "var(--gray-3)",
        borderRadius: "12px",
        height: "100%",
        overflow: "hidden",
      }}
    >
      <Flex
        direction="column"
        height="100%"
        p="3"
        gap="3"
      >
        {/* Header */}
        <Box>
          <Text size="2" weight="bold" color="gray">
            Members — {memberList.length}
          </Text>
        </Box>

        {/* Member List */}
        <Flex direction="column" gap="2" style={{ overflow: "auto", flex: 1 }}>
          {memberList.map((member) => {
            const isSpeaking = clientsSpeaking[member.serverUserId] || false;
            const statusColor = getStatusColor(member);
            const statusText = getStatusText(member);

            return (
              <div
                key={member.serverUserId}
                style={{
                  background: isSpeaking ? "var(--accent-4)" : "var(--gray-4)",
                  borderRadius: "16px",
                  padding: "8px 12px",
                  border: isSpeaking ? "1px solid var(--accent-6)" : "1px solid transparent",
                  cursor: 'default',
                  opacity: member.status === 'offline' ? 0.6 : 1,
                }}
              >
                <Flex align="center" gap="2" width="100%">
                  {/* Avatar */}
                  <Flex position="relative">
                    <Avatar
                      size="2"
                      fallback={member.nickname[0]}
                      style={{
                        outline: isSpeaking ? "2px solid var(--accent-9)" : "2px solid transparent",
                        backgroundColor: member.color,
                      }}
                    />
                    {/* Status indicator dot */}
                    <Box
                      style={{
                        position: "absolute",
                        bottom: "-2px",
                        right: "-2px",
                        width: "8px",
                        height: "8px",
                        borderRadius: "50%",
                        background: statusColor,
                        border: "2px solid var(--gray-3)",
                      }}
                    />
                  </Flex>

                  {/* Member info */}
                  <Flex direction="column" gap="1" style={{ flex: 1, minWidth: 0 }}>
                    <Flex align="center" gap="1">
                      <Text
                        size="2"
                        weight={isSpeaking ? "bold" : "regular"}
                        style={{
                          color: isSpeaking ? "var(--accent-12)" : "inherit",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {member.nickname}
                      </Text>
                      {isSpeaking && (
                        <HiSpeakerWave 
                          size={12} 
                          color="var(--accent-9)" 
                          style={{ flexShrink: 0 }}
                        />
                      )}
                    </Flex>
                    
                    <Flex align="center" gap="1">
                      <Text size="1" color="gray">
                        {statusText}
                      </Text>
                      
                      {/* Status icons */}
                      <Flex gap="1" align="center">
                        {member.isDeafened && (
                          <BsVolumeOffFill size={10} color="var(--red-9)" />
                        )}
                        {member.isMuted && !member.isDeafened && (
                          <MdMicOff size={10} color="var(--red-9)" />
                        )}
                      </Flex>
                    </Flex>
                  </Flex>
                </Flex>
              </div>
            );
          })}
        </Flex>
      </Flex>
    </Box>
  );
};
