import { Box, Flex, Button, Text } from "@radix-ui/themes";
import { useEffect, useMemo, useRef,useState } from "react";
import toast from "react-hot-toast";
import { v4 as uuidv4 } from "uuid";
import { IoMdRefresh } from "react-icons/io";

import { isSpeaking, useMicrophone } from "@/audio";
import { isUserAuthenticated,useUserId } from "@/common";
import { useIsMobile } from "@/mobile";
import { useSettings } from "@/settings";
import { Channel } from "@/settings/src/types/server";
import { useSFU } from "@/webRTC";

import { useSockets } from "../hooks/useSockets";
import { useServerManagement } from "../hooks/useServerManagement";
import { shouldRefreshToken } from "../utils/tokenManager";
import { handleRateLimitError } from "../utils/rateLimitHandler";
import { ChannelList } from "./ChannelList";
import { ChatMessage, ChatView } from "./ChatView";
import { ServerHeader } from "./ServerHeader";
import { VoiceView } from "./VoiceView";
import { MemberSidebar } from "./MemberSidebar";
import { ServerDetailsSkeleton } from "./skeletons";

export const ServerView = () => {
  const [clientsSpeaking, setClientsSpeaking] = useState<{
    [id: string]: boolean;
  }>({});
  const [serverLoadingTimeouts, setServerLoadingTimeouts] = useState<Record<string, number>>({});
  const [voiceWidth, setVoiceWidth] = useState("0px");
  const [pendingChannelId, setPendingChannelId] = useState<string | null>(null);
  const [selectedChannelId, setSelectedChannelId] = useState<string | null>(null);

  const isMobile = useIsMobile();

  const {
    showVoiceView,
    setShowVoiceView,
    nickname,
    micID,
    setShowSettings,
    setSettingsTab,
    isAFK,
    setIsAFK,
    afkTimeoutMinutes,
    noiseGate,
  } = useSettings();
  
  const {
    currentlyViewingServer,
    showRemoveServer,
    setShowRemoveServer,
    removeServer,
    getLastSelectedChannel,
    setLastSelectedChannelForServer,
  } = useServerManagement();

  // Debug currentlyViewingServer changes
  useEffect(() => {
    console.log("🔍 currentlyViewingServer changed:", currentlyViewingServer?.name || "null");
  }, [currentlyViewingServer]);


  const {
    connect,
    currentServerConnected,
    streamSources,
    currentChannelConnected,
    isConnected,
    isConnecting,
  } = useSFU();

  const extractChannelIdFromRoomId = (roomId: string, serverId: string): string => {
    if (!roomId || !serverId) return "";
    
    // Try multiple server name formats to extract channel ID
    const serverName = serverId.split('.')[0];
    const possiblePrefixes = [
      `${serverName}_`,
      `${serverId}_`,
      `${serverName.toLowerCase()}_`,
      `${serverName.replace(/\s+/g, '_').toLowerCase()}_`
    ];
    
    for (const prefix of possiblePrefixes) {
      if (roomId.startsWith(prefix)) {
        return roomId.substring(prefix.length);
      }
    }
    
    // If no prefix matches, return the roomId as-is (fallback)
    return roomId;
  };

  const currentChannelId = extractChannelIdFromRoomId(currentChannelConnected, currentServerConnected);
  
  // Debug logging for channel ID extraction
  useEffect(() => {
    if (currentChannelConnected && currentServerConnected) {
      console.log("🔍 CHANNEL ID EXTRACTION DEBUG:", {
        roomId: currentChannelConnected,
        serverId: currentServerConnected,
        extractedChannelId: currentChannelId,
        isConnected,
        isConnecting
      });
    }
  }, [currentChannelConnected, currentServerConnected, currentChannelId, isConnected, isConnecting]);

  // Keep selectedChannelId in sync with SFU connection when it changes
  useEffect(() => {
    if (currentChannelId) {
      setSelectedChannelId((prev) => prev ?? currentChannelId);
    }
  }, [currentChannelId]);

  const shouldAccessMic = useMemo(() => {
    // Only request mic when actively connecting or connected to a voice channel
    return isConnecting || isConnected;
  }, [isConnecting, isConnected]);

  const { microphoneBuffer } = useMicrophone(shouldAccessMic);

  const { sockets, serverDetailsList, clients, memberLists, requestMemberList, failedServerDetails } = useSockets();
  const userId = useUserId();

    // Request member list when server is connected
  useEffect(() => {
    if (isConnected && currentlyViewingServer?.host) {
      // Only log once per connection to reduce spam
      console.log(`📤 Requesting member list for server: ${currentlyViewingServer.host}`);
      requestMemberList(currentlyViewingServer.host);
    }
  }, [isConnected, currentlyViewingServer?.host, requestMemberList]);



  // Set up timeout for server details loading
  useEffect(() => {
    if (!currentlyViewingServer) return;

    const host = currentlyViewingServer.host;
    const hasDetails = !!serverDetailsList[host];
    const hasFailed = !!failedServerDetails[host];
    const hasTimeout = !!serverLoadingTimeouts[host];

    // If we don't have details, haven't failed, and don't have a timeout set, start one
    if (!hasDetails && !hasFailed && !hasTimeout) {
      const timeoutId = window.setTimeout(() => {
        setServerLoadingTimeouts(prev => {
          const updated = { ...prev };
          delete updated[host];
          return updated;
        });
      }, 10000); // 10 second timeout

      setServerLoadingTimeouts(prev => ({
        ...prev,
        [host]: timeoutId
      }));
    }

    // Clean up timeout if we get details or fail
    if ((hasDetails || hasFailed) && hasTimeout) {
      clearTimeout(serverLoadingTimeouts[host]);
      setServerLoadingTimeouts(prev => {
        const updated = { ...prev };
        delete updated[host];
        return updated;
      });
    } 
  }, [currentlyViewingServer, serverDetailsList, failedServerDetails, serverLoadingTimeouts]);

  // Clear selected channel when switching servers to allow restoration
  useEffect(() => {
    setSelectedChannelId(null);
  }, [currentlyViewingServer?.host]);

  // When viewing a server, default to the last selected channel or first text channel
  useEffect(() => {
    if (!currentlyViewingServer) return;
    if (selectedChannelId) return;

    const channels = serverDetailsList[currentlyViewingServer.host]?.channels || [];
    
    // First, try to restore the last selected channel for this server
    const lastSelectedChannelId = getLastSelectedChannel(currentlyViewingServer.host);
    if (lastSelectedChannelId) {
      const lastChannel = channels.find(c => c.id === lastSelectedChannelId);
      if (lastChannel) {
        console.log("🔄 Restoring last selected channel:", lastChannel.name, "for server:", currentlyViewingServer.host);
        setSelectedChannelId(lastSelectedChannelId);
        return;
      }
    }
    
    // Fallback to first text channel if no last selected channel or it doesn't exist
    const firstText = channels.find((c) => c.type === "text");
    if (firstText) {
      console.log("🔄 Defaulting to first text channel:", firstText.name, "for server:", currentlyViewingServer.host);
      setSelectedChannelId(firstText.id);
    }
  }, [currentlyViewingServer, serverDetailsList, selectedChannelId, getLastSelectedChannel]);

  const currentConnection = useMemo(
    () =>
      currentlyViewingServer ? sockets[currentlyViewingServer.host] : null,
    [currentlyViewingServer, sockets]
  );

  // Handle chat errors (including rate limiting)
  useEffect(() => {
    if (!currentConnection) return;

    const handleChatError = (error: string | { error: string; message?: string; retryAfterMs?: number; currentScore?: number; maxScore?: number }) => {
      // Handle rate limiting specifically
      if (typeof error === 'object' && error.error === 'rate_limited') {
        console.log(`🚫 Chat rate limited:`, error);
        setIsRateLimited(true);
        
        // Remove any pending messages and restore text to input
        setChatMessages((prev) => {
          const pendingMessages = prev.filter(msg => msg.pending);
          if (pendingMessages.length > 0) {
            // Get the most recent pending message text
            const latestPending = pendingMessages[pendingMessages.length - 1];
            if (latestPending.text) {
              setChatText(latestPending.text);
              console.log(`📝 Restored text to input: "${latestPending.text}"`);
            }
          }
          // Return only non-pending messages
          return prev.filter(msg => !msg.pending);
        });
        
        // Show user-friendly message
        handleRateLimitError(error, "Chat");
        
        // Clear any existing interval
        if (rateLimitIntervalRef.current) {
          clearInterval(rateLimitIntervalRef.current);
          rateLimitIntervalRef.current = null;
        }
        
        // Start countdown timer
        if (error.retryAfterMs && error.retryAfterMs > 0) {
          const totalSeconds = Math.ceil(error.retryAfterMs / 1000);
          setRateLimitCountdown(totalSeconds);
          
          // Update countdown every second
          rateLimitIntervalRef.current = setInterval(() => {
            setRateLimitCountdown((prev) => {
              if (prev <= 1) {
                if (rateLimitIntervalRef.current) {
                  clearInterval(rateLimitIntervalRef.current);
                  rateLimitIntervalRef.current = null;
                }
                setIsRateLimited(false);
                console.log(`✅ Rate limit cleared for chat`);
                return 0;
              }
              return prev - 1;
            });
          }, 1000);
        } else {
          // Fallback: 5 second countdown if no retry time provided
          setRateLimitCountdown(5);
          rateLimitIntervalRef.current = setInterval(() => {
            setRateLimitCountdown((prev) => {
              if (prev <= 1) {
                if (rateLimitIntervalRef.current) {
                  clearInterval(rateLimitIntervalRef.current);
                  rateLimitIntervalRef.current = null;
                }
                setIsRateLimited(false);
                console.log(`✅ Rate limit cleared for chat (fallback)`);
                return 0;
              }
              return prev - 1;
            });
          }, 1000);
        }
      } else {
        // Handle other chat errors normally
        handleRateLimitError(error, "Chat");
      }
    };

    currentConnection.on("chat:error", handleChatError);

    return () => {
      currentConnection.off("chat:error", handleChatError);
      // Clean up rate limit interval
      if (rateLimitIntervalRef.current) {
        clearInterval(rateLimitIntervalRef.current);
        rateLimitIntervalRef.current = null;
      }
    };
  }, [currentConnection]);

  const [chatText, setChatText] = useState("");
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [messageCache, setMessageCache] = useState<{ [conversationId: string]: ChatMessage[] }>({});
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [isRateLimited, setIsRateLimited] = useState(false);
  const [rateLimitCountdown, setRateLimitCountdown] = useState(0);
  const rateLimitIntervalRef = useRef<NodeJS.Timeout | null>(null);
  
  // Active conversation derives from selected channel first, then SFU-derived channel
  const activeConversationId = selectedChannelId || currentChannelId || "";


  // Function to get cached messages for a conversation
  const getCachedMessages = (conversationId: string): ChatMessage[] => {
    return messageCache[conversationId] || [];
  };

  // Cache empty arrays for channels that have been checked and are empty
  useEffect(() => {
    if (!isLoadingMessages && chatMessages.length === 0 && activeConversationId) {
      // If we're not loading and have no messages, cache this as empty
      setMessageCache(prev => ({
        ...prev,
        [activeConversationId]: []
      }));
    }
  }, [isLoadingMessages, chatMessages.length, activeConversationId]);

  // Clear rate limiting state when switching servers (but not channels)
  useEffect(() => {
    // Clear rate limiting state when server changes
    setIsRateLimited(false);
    setRateLimitCountdown(0);
    setChatText(""); // Clear chat text when switching servers
    
    // Clear any existing rate limit interval
    if (rateLimitIntervalRef.current) {
      clearInterval(rateLimitIntervalRef.current);
      rateLimitIntervalRef.current = null;
    }
    
    console.log(`🔄 Cleared rate limiting state for server: ${currentlyViewingServer?.host}`);
  }, [currentlyViewingServer?.host]);

  // Clear chat text when switching channels (but keep rate limiting state)
  useEffect(() => {
    setChatText(""); // Clear chat text when switching channels
    console.log(`🔄 Cleared chat text for channel: ${activeConversationId}`);
  }, [activeConversationId]);
  const activeChannelName = useMemo(() => {
    if (!currentlyViewingServer) return "";
    const channels = serverDetailsList[currentlyViewingServer.host]?.channels || [];
    const found = channels.find((c) => c.id === activeConversationId);
    return found?.name || "";
  }, [currentlyViewingServer, serverDetailsList, activeConversationId]);

  useEffect(() => {
    if (!currentConnection) return;
    

    
    const onNew = (msg: ChatMessage) => {
      console.log(`📨 Received chat:new message:`, msg);
      if (!msg || !msg.conversation_id) {
        console.log(`❌ Invalid message received:`, msg);
        return;
      }
      console.log(`🔍 Checking if message belongs to active conversation:`, {
        message_conversation_id: msg.conversation_id,
        active_conversation_id: activeConversationId,
        matches: msg.conversation_id === activeConversationId
      });
      if (msg.conversation_id === activeConversationId) {
        setChatMessages((prev) => {
          // Remove matching pending optimistic message (same text in same conversation)
          const filtered = prev.filter(
            (m) => !(m.pending && m.text === msg.text && m.conversation_id === msg.conversation_id)
          );
          const newMessages = [...filtered, msg];
          console.log(`✅ Updated chat messages:`, { 
            previous_count: prev.length, 
            new_count: newMessages.length,
            message_id: msg.message_id 
          });
          return newMessages;
        });
        
        // Also update the cache for this conversation
        setMessageCache(prev => {
          const existingMessages = prev[msg.conversation_id] || [];
          const filtered = existingMessages.filter(
            (m) => !(m.pending && m.text === msg.text && m.conversation_id === msg.conversation_id)
          );
          return {
            ...prev,
            [msg.conversation_id]: [...filtered, msg]
          };
        });
      } else {
        console.log(`⏭️ Message not for current conversation, skipping`);
      }
    };
    const onHistory = (payload: { conversation_id: string; items: ChatMessage[] }) => {
      console.log(`📚 Received chat:history:`, payload);
      if (!payload || payload.conversation_id !== activeConversationId) {
        console.log(`⏭️ History not for current conversation, skipping`);
        return;
      }
      setChatMessages((prev) => {
        const existingIds = new Set(prev.map((m) => m.message_id));
        const merged = [...prev];
        for (const it of payload.items) {
          if (!existingIds.has(it.message_id)) merged.push(it);
        }
        console.log(`✅ Loaded chat history:`, { 
          previous_count: prev.length, 
          history_count: payload.items.length,
          final_count: merged.length 
        });
        return merged;
      });
      
      // Set loading to false when history is loaded
      setIsLoadingMessages(false);
      
      // Also update the cache with the history (even if empty)
      setMessageCache(prev => {
        const existingMessages = prev[payload.conversation_id] || [];
        const existingIds = new Set(existingMessages.map((m) => m.message_id));
        const merged = [...existingMessages];
        for (const it of payload.items) {
          if (!existingIds.has(it.message_id)) {
            merged.push(it);
          }
        }
        return {
          ...prev,
          [payload.conversation_id]: merged // This will be empty array if no messages
        };
      });
    };
    // Handle reaction updates
    const onReactionUpdate = (updatedMessage: ChatMessage) => {
      console.log(`👍 Received reaction update:`, updatedMessage);
      console.log(`🔍 Reaction update details:`, {
        messageId: updatedMessage?.message_id,
        conversationId: updatedMessage?.conversation_id,
        reactions: updatedMessage?.reactions,
        activeConversationId,
        matches: updatedMessage?.conversation_id === activeConversationId
      });
      if (!updatedMessage || !updatedMessage.conversation_id) {
        console.log(`❌ Invalid reaction update received:`, updatedMessage);
        return;
      }
      
      if (updatedMessage.conversation_id === activeConversationId) {
        setChatMessages((prev) => {
          const updated = prev.map((msg) => 
            msg.message_id === updatedMessage.message_id 
              ? { ...msg, reactions: updatedMessage.reactions }
              : msg
          );
          console.log(`✅ Updated message reactions:`, { 
            messageId: updatedMessage.message_id,
            reactions: updatedMessage.reactions 
          });
          return updated;
        });
        
        // Also update the cache
        setMessageCache(prev => {
          const existingMessages = prev[updatedMessage.conversation_id] || [];
          const updated = existingMessages.map((msg) => 
            msg.message_id === updatedMessage.message_id 
              ? { ...msg, reactions: updatedMessage.reactions }
              : msg
          );
          return {
            ...prev,
            [updatedMessage.conversation_id]: updated
          };
        });
      } else {
        console.log(`⏭️ Reaction update not for current conversation, skipping`);
      }
    };

    console.log(`🎧 Setting up event listeners for connection:`, currentConnection.id);
    currentConnection.on("chat:new", onNew);
    currentConnection.on("chat:history", onHistory);
    currentConnection.on("chat:reaction", onReactionUpdate);
    return () => {
      currentConnection.off("chat:new", onNew);
      currentConnection.off("chat:history", onHistory);
      currentConnection.off("chat:reaction", onReactionUpdate);
    };
  }, [currentConnection, activeConversationId]);

  // Reset chat list when conversation changes and load history
  useEffect(() => {
    console.log(`🔄 Conversation changed, resetting chat:`, {
      activeConversationId,
      hasConnection: !!currentConnection
    });
    
    // First, load cached messages instantly to prevent flash
    const cachedMessages = getCachedMessages(activeConversationId);
    if (cachedMessages.length > 0) {
      console.log(`📦 Loading ${cachedMessages.length} cached messages for conversation ${activeConversationId}`);
      setChatMessages(cachedMessages);
      setIsLoadingMessages(false); // We have cached messages, no loading needed
    } else if (cachedMessages.length === 0 && messageCache[activeConversationId]) {
      // We have cached empty array, no loading needed
      console.log(`📦 Loading empty cached messages for conversation ${activeConversationId}`);
      setChatMessages([]);
      setIsLoadingMessages(false);
    } else {
      setChatMessages([]);
      setIsLoadingMessages(true); // No cached messages, show loading state
    }
    
    if (!currentConnection || !activeConversationId) return;
    
    // Check if we're trying to fetch from a voice channel's text chat
    const isVoiceChannelTextChat = activeConversationId === currentChannelId;
    const canViewVoiceChannelText = !isVoiceChannelTextChat || isConnected;
    
    if (isVoiceChannelTextChat && !canViewVoiceChannelText) {
      console.log(`🚫 Blocking chat:fetch for voice channel ${activeConversationId} - user not connected`);
      
      // Automatically switch to the first available text channel
      if (currentlyViewingServer) {
        const channels = serverDetailsList[currentlyViewingServer.host]?.channels || [];
        const textChannels = channels.filter(channel => channel.type === 'text');
        if (textChannels.length > 0) {
          console.log(`🔄 Auto-switching from voice channel to first text channel: ${textChannels[0].id}`);
          setSelectedChannelId(textChannels[0].id);
          return;
        } else {
          console.log(`⚠️ No text channels available, clearing selection`);
          setSelectedChannelId(null);
          return;
        }
      }
    }
    
    // Load chat history for the selected conversation
    const fetchPayload = {
      conversationId: activeConversationId,
      limit: 50
    };
    console.log(`📥 Fetching chat history:`, fetchPayload);
    currentConnection.emit("chat:fetch", fetchPayload);
  }, [activeConversationId, currentConnection, currentChannelId, isConnected, currentlyViewingServer, serverDetailsList]);

  // Check if we're trying to send to a voice channel's text chat
  const isVoiceChannelTextChat = activeConversationId === currentChannelId;
  const canSendToVoiceChannel = !isVoiceChannelTextChat || isConnected; // Allow if not voice channel text chat, or if connected to voice
  const canViewVoiceChannelText = !isVoiceChannelTextChat || isConnected; // Same logic for viewing
  
  const canSend = chatText.trim().length > 0 && 
                  !!currentConnection && 
                  !!activeConversationId && 
                  !!localStorage.getItem(`accessToken_${currentlyViewingServer?.host}`) && 
                  isUserAuthenticated() &&
                  canSendToVoiceChannel &&
                  !isRateLimited;
  
  // Debug canSend conditions
  useEffect(() => {
    const hasAccessToken = !!localStorage.getItem(`accessToken_${currentlyViewingServer?.host}`);
    const isAuthenticated = isUserAuthenticated();
    console.log("🔍 canSend Debug:", {
      chatTextLength: chatText.trim().length,
      hasCurrentConnection: !!currentConnection,
      hasActiveConversationId: !!activeConversationId,
      hasAccessToken: hasAccessToken,
      isAuthenticated: isAuthenticated,
      activeConversationId: activeConversationId,
      currentChannelId: currentChannelId,
      isVoiceChannelTextChat: isVoiceChannelTextChat,
      isConnected: isConnected,
      canSendToVoiceChannel: canSendToVoiceChannel,
      canSend: canSend
    });
  }, [chatText, currentConnection, activeConversationId, canSend, currentlyViewingServer, currentChannelId, isVoiceChannelTextChat, isConnected, canSendToVoiceChannel]);

  const sendChat = () => {
    const body = chatText.trim();
    console.log(`📤 sendChat called:`, {
      body,
      canSend,
      isRateLimited,
      hasConnection: !!currentConnection,
      hasConversationId: !!activeConversationId,
      hasAccessToken: !!localStorage.getItem(`accessToken_${currentlyViewingServer?.host}`),
      isAuthenticated: isUserAuthenticated()
    });
    
    if (!canSend) {
      console.log(`❌ Cannot send: canSend is false`);
      if (isRateLimited) {
        console.log(`🚫 Rate limited - not sending message`);
        return;
      }
      if (isVoiceChannelTextChat && !isConnected) {
        toast.error("You must be connected to this voice channel to send messages");
      }
      return;
    }
    
    console.log(`📤 Sending chat message:`, {
      conversationId: activeConversationId,
      text: body,
      canSend
    });
    
    // Add optimistic pending message
    const pendingId = `pending-${uuidv4()}`;
    const optimistic: ChatMessage = {
      conversation_id: activeConversationId,
      message_id: pendingId,
      sender_server_id: "temp", // Will be replaced with actual server ID when server responds
      text: body,
      attachments: null,
      created_at: new Date(),
      reactions: null,
      pending: true,
    };
    setChatMessages((prev) => [...prev, optimistic]);
    
    // Also add to cache
    setMessageCache(prev => ({
      ...prev,
      [activeConversationId]: [...(prev[activeConversationId] || []), optimistic]
    }));
    
    setChatText("");
    
    // Send message with access token
    let accessToken = localStorage.getItem(`accessToken_${currentlyViewingServer?.host}`);
    
    if (!accessToken) {
      toast.error("Not authenticated for this server - please try joining again");
      return;
    }
    
    // Check if token needs refresh
    if (shouldRefreshToken(accessToken)) {
      console.log("🔄 Token needs refresh, requesting new token...");
      currentConnection!.emit("token:refresh", { accessToken });
      // Wait a bit for the refresh response
      setTimeout(() => {
        accessToken = localStorage.getItem(`accessToken_${currentlyViewingServer?.host}`);
        if (accessToken) {
          sendMessageWithToken(accessToken, body);
        }
      }, 100);
      return;
    }
    
    sendMessageWithToken(accessToken, body);
  };

  const sendMessageWithToken = (accessToken: string, messageText: string) => {
    const payload = {
      conversationId: activeConversationId,
      accessToken,
      text: messageText
    };
    
    console.log(`🚀 Emitting chat:send with payload:`, payload);
    currentConnection!.emit("chat:send", payload);
  };

  const logDataRef = useRef<{
    server: string;
    totalClients: number;
    currentConnection?: string;
    isConnected: boolean;
    isConnecting: boolean;
    currentChannelId: string;
    selectedChannelId: string | null;
    activeConversationId: string;
    clients: unknown;
  } | null>(null);
  
  useEffect(() => {
    if (currentlyViewingServer && clients[currentlyViewingServer.host]) {
      const clientList = clients[currentlyViewingServer.host];
      const newLogData = {
        server: currentlyViewingServer.host,
        totalClients: Object.keys(clientList).length,
        currentConnection: currentConnection?.id,
        isConnected,
        isConnecting,
        currentChannelId,
        selectedChannelId,
        activeConversationId,
        showVoiceView,
        clients: Object.keys(clientList).map(id => ({
          id,
          nickname: clientList[id].nickname,
          hasJoinedChannel: clientList[id].hasJoinedChannel,
          isConnectedToVoice: clientList[id].isConnectedToVoice,
          streamID: clientList[id].streamID,
          isMuted: clientList[id].isMuted,
          isDeafened: clientList[id].isDeafened,
          isCurrentUser: id === currentConnection?.id,
          shouldShowInVoice: currentlyViewingServer.host === currentServerConnected && clientList[id].hasJoinedChannel,
        }))
      };
      
      const prevData = logDataRef.current;
      if (!prevData || 
          prevData.totalClients !== newLogData.totalClients ||
          prevData.isConnected !== newLogData.isConnected ||
          prevData.isConnecting !== newLogData.isConnecting ||
          prevData.currentChannelId !== newLogData.currentChannelId ||
          prevData.selectedChannelId !== newLogData.selectedChannelId ||
          prevData.activeConversationId !== newLogData.activeConversationId ||
          JSON.stringify(prevData.clients) !== JSON.stringify(newLogData.clients)) {
        console.log("🔍 PEER/CHAT STATE AUDIT:", newLogData);
        logDataRef.current = newLogData;
      }
    }
  }, [clients, currentlyViewingServer, currentConnection?.id, isConnected, isConnecting, currentChannelId, selectedChannelId, activeConversationId, showVoiceView, currentServerConnected]);

  useEffect(() => {
    setVoiceWidth(
      currentServerConnected === currentlyViewingServer?.host ? "400px" : "0px"
    );
  }, [currentServerConnected, currentlyViewingServer]);

  useEffect(() => {
    if (micID && pendingChannelId) {
      console.log("Microphone selected, connecting to pending channel:", pendingChannelId);
      setShowVoiceView(true);
      connect(pendingChannelId)
        .then(() => {
          setPendingChannelId(null);
        })
        .catch((error) => {
          console.error("❌ Failed to connect to pending channel:", error);
          setPendingChannelId(null);
        });
    }
  }, [micID, pendingChannelId, connect, setShowVoiceView]);

  useEffect(() => {
    const interval = setInterval(() => {
      if (
        !currentServerConnected ||
        !currentlyViewingServer ||
        !currentConnection
      )
        return;
      Object.keys(clients[currentlyViewingServer.host]).forEach((clientID) => {
        const client = clients[currentlyViewingServer.host][clientID];

        if (clientID === currentConnection.id && microphoneBuffer.finalAnalyser) {
          setClientsSpeaking((old) => ({
            ...old,
            [clientID]: isSpeaking(microphoneBuffer.finalAnalyser!, 1),
          }));
        } else {
          if (!client.streamID || !streamSources[client.streamID]) {
            return;
          }

          const stream = streamSources[client.streamID];
          setClientsSpeaking((old) => ({
            ...old,
            [clientID]: isSpeaking(stream.analyser, 1),
          }));
        }
      });
    }, 100);

    return () => clearInterval(interval);
  }, [microphoneBuffer.finalAnalyser, streamSources, clients, currentlyViewingServer, currentConnection, currentServerConnected]);

  useEffect(() => {
    let lastActivityTime = Date.now();

    if (
      !currentServerConnected ||
      !currentlyViewingServer ||
      !currentConnection ||
      !microphoneBuffer.analyser
    ) {
      return;
    }

    const checkAFK = () => {
      if (!microphoneBuffer.analyser) return;
      const bufferLength = microphoneBuffer.analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);
      microphoneBuffer.analyser.getByteFrequencyData(dataArray);

      let sum = 0;
      for (let i = 0; i < bufferLength; i++) {
        sum += dataArray[i] * dataArray[i];
      }
      const rms = Math.sqrt(sum / bufferLength);
      const rawVolume = (rms / 255) * 100;

      if (rawVolume > noiseGate) {
        lastActivityTime = Date.now();
        if (isAFK) {
          setIsAFK(false);
        }
      }

      const timeSinceActivity = Date.now() - lastActivityTime;
      const timeoutMs = afkTimeoutMinutes * 60 * 1000;
      if (timeSinceActivity >= timeoutMs && !isAFK) {
        setIsAFK(true);
      }
    };

    const afkCheckInterval: NodeJS.Timeout = setInterval(checkAFK, 5000);
    checkAFK();

    return () => {
      if (afkCheckInterval) {
        clearInterval(afkCheckInterval);
      }
    };
  }, [
    currentServerConnected,
    currentlyViewingServer,
    currentConnection,
    microphoneBuffer.analyser,
    isAFK,
    setIsAFK,
    afkTimeoutMinutes,
    noiseGate,
  ]);

  // Listen for server-initiated voice disconnects to trigger text channel switch
  useEffect(() => {
    const handleServerVoiceDisconnect = (event: CustomEvent) => {
      const { host, reason } = event.detail;
      console.log(`🔄 Server-initiated voice disconnect detected for ${host}, reason: ${reason}`);
      
      // Only handle if it's for the currently viewing server
      if (currentlyViewingServer && currentlyViewingServer.host === host) {
        handleVoiceDisconnect();
      }
    };

    window.addEventListener('voice_disconnect_text_switch', handleServerVoiceDisconnect as EventListener);
    
    return () => {
      window.removeEventListener('voice_disconnect_text_switch', handleServerVoiceDisconnect as EventListener);
    };
  }, [currentlyViewingServer, serverDetailsList]);

  if (!currentlyViewingServer) return null;

  // Check if server details are still loading
  const serverDetails = serverDetailsList[currentlyViewingServer.host];
  const serverFailure = failedServerDetails[currentlyViewingServer.host];
  const hasTimeout = !!serverLoadingTimeouts[currentlyViewingServer.host];
  
  
  if (!serverDetails) {
    // Show error state if server details failed to load
    if (serverFailure) {
      console.log("❌ Server details failed for:", currentlyViewingServer.host, serverFailure);
      return (
        <Flex width="100%" height="100%" gap="4" align="center" justify="center">
          <Box style={{ textAlign: "center", maxWidth: "400px" }}>
            <Text size="4" weight="bold" color="red" mb="3">
              Failed to load server details
            </Text>
            <Text size="2" color="gray" mb="4">
              {serverFailure.error === 'rate_limited' 
                ? "You're being rate limited. Please wait a moment and try again."
                : serverFailure.message || "An error occurred while loading server details."
              }
            </Text>
            <Button 
              onClick={() => {
                // Clear the failure and retry
                window.location.reload();
              }}
              variant="solid"
            >
              <IoMdRefresh size={16} />
              Retry
            </Button>
          </Box>
        </Flex>
      );
    }
    
    // Show timeout state if loading takes too long
    if (!hasTimeout) {
      return (
        <Flex width="100%" height="100%" gap="4" align="center" justify="center">
          <Box style={{ textAlign: "center", maxWidth: "400px" }}>
            <Text size="4" weight="bold" color="orange" mb="3">
              Loading timeout
            </Text>
            <Text size="2" color="gray" mb="4">
              Server details are taking longer than expected to load. This might be due to network issues or server problems.
            </Text>
            <Button 
              onClick={() => {
                // Clear the timeout and retry
                window.location.reload();
              }}
              variant="solid"
            >
              <IoMdRefresh size={16} />
              Retry
            </Button>
          </Box>
        </Flex>
      );
    }
    
    // Show loading skeleton for normal loading state
    return (
      <Flex width="100%" height="100%" gap="4">
        <Box width={{ sm: "240px", initial: "100%" }}>
          <ServerDetailsSkeleton />
        </Box>
      </Flex>
    );
  }

  const handleChannelClick = async (channel: Channel) => {
    switch (channel.type) {
      case "voice": {
        // Check if we're already focusing this voice channel's text chat
        const isAlreadyFocusingThisChannel = selectedChannelId === channel.id;
        
        // Check if we're already connected to any voice channel on this server
        const isAlreadyConnectedToVoice = 
          isConnected &&
          currentlyViewingServer.host === currentServerConnected;

        console.log("🎤 VOICE CHANNEL CLICK DEBUG:", {
          channelId: channel.id,
          selectedChannelId,
          currentChannelId,
          isConnected,
          currentServerConnected,
          currentlyViewingServerHost: currentlyViewingServer.host,
          isAlreadyFocusingThisChannel,
          isAlreadyConnectedToVoice,
          showVoiceView
        });

        // If already focusing this voice channel's text chat, toggle VoiceView
        if (isAlreadyFocusingThisChannel) {
          console.log("💬 Already focusing this voice channel's text chat, toggling voice view");
          setShowVoiceView(!showVoiceView);
          console.log("✅ Early return - no connection attempt");
          return;
        }

        // If already connected to voice on this server, just focus the text chat
        if (isAlreadyConnectedToVoice) {
          console.log("🔄 Already connected to voice on this server, focusing text chat");
          setSelectedChannelId(channel.id);
          // Save this as the last selected channel for this server
          if (currentlyViewingServer) {
            setLastSelectedChannelForServer(currentlyViewingServer.host, channel.id);
          }
          console.log("✅ Early return - no connection attempt");
          return;
        }

        // Only proceed with connection if we're not already connected
        setSelectedChannelId(channel.id); // Focus the text chat
        // Save this as the last selected channel for this server
        if (currentlyViewingServer) {
          setLastSelectedChannelForServer(currentlyViewingServer.host, channel.id);
        }
        setPendingChannelId(null);
        setShowVoiceView(true);
        console.log("🔌 Proceeding with new connection attempt");
        console.log("Attempting to connect with micID:", micID || "undefined");
        
        try {
          await connect(channel.id);
        } catch (error) {
          console.error("❌ SFU connection failed:", error);
          if (error instanceof Error && error.message.includes("Microphone not available")) {
            setPendingChannelId(channel.id);
            setSettingsTab("microphone");
            setShowSettings(true);
            toast.error("No microphone selected. Please choose a device in Settings → Microphone.");
          } else if (error instanceof Error) {
            toast.error(error.message);
          } else {
            toast.error("Failed to connect to voice channel");
          }
        }
        break;
      }

      case "text":
        // For text channels, just focus the chat
        setSelectedChannelId(channel.id);
        // Save this as the last selected channel for this server
        if (currentlyViewingServer) {
          setLastSelectedChannelForServer(currentlyViewingServer.host, channel.id);
        }
        break;
    }
  };

  const handleVoiceDisconnect = () => {
    // When disconnecting from voice, automatically select the first text channel
    if (currentlyViewingServer) {
      const channels = serverDetailsList[currentlyViewingServer.host]?.channels || [];
      const firstTextChannel = channels.find((c) => c.type === "text");
      
      if (firstTextChannel) {
        console.log("🔄 Auto-selecting first text channel after voice disconnect:", firstTextChannel.name);
        setSelectedChannelId(firstTextChannel.id);
      } else {
        console.log("⚠️ No text channels found, clearing selected channel");
        setSelectedChannelId(null);
      }
      
      // Also clear any pending channel selection to ensure clean state
      console.log("🔄 Voice disconnect - ensuring clean channel state");
    }
  };

  return (
    <>
      <Flex width="100%" height="100%" gap="4">
        <Box width={{ sm: "240px", initial: "100%" }}>
          <Flex
            direction="column"
            height="100%"
            width="100%"
            align="center"
            justify="between"
          >
            <Flex direction="column" gap="4" align="center" width="100%">
              <ServerHeader
                serverName={currentlyViewingServer?.name}
                onLeave={() =>
                  currentlyViewingServer &&
                  setShowRemoveServer(currentlyViewingServer.host)
                }
              />

              <ChannelList
                channels={serverDetailsList[currentlyViewingServer.host]?.channels || []}
                serverHost={currentlyViewingServer.host}
                clients={clients[currentlyViewingServer.host] || {}}
                currentChannelId={currentChannelId}
                currentServerConnected={currentServerConnected}
                showVoiceView={showVoiceView}
                isConnecting={isConnecting}
                currentConnectionId={currentConnection?.id}
                selectedChannelId={selectedChannelId}
                onChannelClick={handleChannelClick}
                clientsSpeaking={clientsSpeaking}
              />
            </Flex>
          </Flex>
        </Box>
        {!isMobile && (
          <Flex flexGrow="1">
            <VoiceView
              showVoiceView={showVoiceView}
              voiceWidth={voiceWidth}
              serverHost={currentlyViewingServer.host}
              currentServerConnected={currentServerConnected}
              clientsForHost={clients[currentlyViewingServer.host] || {}}
              clientsSpeaking={clientsSpeaking}
              isConnecting={isConnecting}
              currentConnectionId={currentConnection?.id}
              onDisconnect={handleVoiceDisconnect}
            />

            <ChatView
              chatMessages={chatMessages}
              chatText={chatText}
              setChatText={setChatText}
              canSend={canSend}
              sendChat={sendChat}
              currentUserId={userId || undefined}
              channelName={activeChannelName}
              currentUserNickname={nickname}
              socketConnection={currentConnection}
              memberList={memberLists[currentlyViewingServer.host]?.reduce((acc, member) => {
                acc[member.serverUserId] = {
                  ...member
                };
                return acc;
              }, {} as Record<string, any>) || {}}
              isRateLimited={isRateLimited}
              rateLimitCountdown={rateLimitCountdown}
              canViewVoiceChannelText={canViewVoiceChannelText}
              isVoiceChannelTextChat={isVoiceChannelTextChat}
              {...(isLoadingMessages !== undefined && { isLoadingMessages })}
            />
          </Flex>
        )}

        {/* Member Sidebar - Hidden on mobile */}
        {!isMobile && (
          <MemberSidebar
            members={memberLists[currentlyViewingServer.host] || []}
            currentConnectionId={currentConnection?.id}
            clientsSpeaking={clientsSpeaking}
            currentServerConnected={currentServerConnected}
            serverHost={currentlyViewingServer.host}
          />
        )}
      </Flex>

    </>
  );
};
