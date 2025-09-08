import { Box, Flex } from "@radix-ui/themes";
import { useEffect, useMemo, useState, useRef } from "react";
import toast from "react-hot-toast";
import { v4 as uuidv4 } from "uuid";

import { isSpeaking, useMicrophone } from "@/audio";
import { useIsMobile } from "@/mobile";
import { useSettings } from "@/settings";
import { Channel } from "@/settings/src/types/server";
import { useSFU } from "@/webRTC";

import { useSockets } from "../hooks/useSockets";
import { useUserId, isUserAuthenticated } from "@/common";
import { shouldRefreshToken } from "../utils/tokenManager";
import { ServerHeader } from "./ServerHeader";
import { ChannelList } from "./ChannelList";
import { VoiceView } from "./VoiceView";
import { ChatMessage, ChatView } from "./ChatView";

export const ServerView = () => {
  const [clientsSpeaking, setClientsSpeaking] = useState<{
    [id: string]: boolean;
  }>({});
  const [voiceWidth, setVoiceWidth] = useState("0px");
  const [pendingChannelId, setPendingChannelId] = useState<string | null>(null);
  const [selectedChannelId, setSelectedChannelId] = useState<string | null>(null);

  const isMobile = useIsMobile();

  const {
    currentlyViewingServer,
    setShowRemoveServer,
    showVoiceView,
    setShowVoiceView,
    micID,
    setShowSettings,
    setSettingsTab,
    isAFK,
    setIsAFK,
    afkTimeoutMinutes,
    noiseGate,
  } = useSettings();

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
    const serverName = serverId.split('.')[0];
    const expectedPrefix = `${serverName}_`;
    if (roomId.startsWith(expectedPrefix)) {
      return roomId.substring(expectedPrefix.length);
    }
    return roomId;
  };

  const currentChannelId = extractChannelIdFromRoomId(currentChannelConnected, currentServerConnected);

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

  const { sockets, serverDetailsList, clients } = useSockets();
  const userId = useUserId();

  // When viewing a server, default to the first text channel if none selected
  useEffect(() => {
    if (!currentlyViewingServer) return;
    if (selectedChannelId) return;

    const channels = serverDetailsList[currentlyViewingServer.host]?.channels || [];
    const firstText = channels.find((c) => c.type === "text");
    if (firstText) {
      setSelectedChannelId(firstText.id);
    }
  }, [currentlyViewingServer, serverDetailsList, selectedChannelId]);

  const currentConnection = useMemo(
    () =>
      currentlyViewingServer ? sockets[currentlyViewingServer.host] : null,
    [currentlyViewingServer, sockets]
  );

  const [chatText, setChatText] = useState("");
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  // Active conversation derives from selected channel first, then SFU-derived channel
  const activeConversationId = selectedChannelId || currentChannelId || "";

  useEffect(() => {
    if (!currentConnection) return;
    

    
    const onNew = (msg: any) => {
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
          // Remove matching pending optimistic message (same sender and text)
          const filtered = prev.filter(
            (m) => !(m.pending && m.sender_server_id === msg.sender_server_id && m.text === msg.text && m.conversation_id === msg.conversation_id)
          );
          const newMessages = [...filtered, msg];
          console.log(`✅ Updated chat messages:`, { 
            previous_count: prev.length, 
            new_count: newMessages.length,
            message_id: msg.message_id 
          });
          return newMessages;
        });
      } else {
        console.log(`⏭️ Message not for current conversation, skipping`);
      }
    };
    const onHistory = (payload: { conversation_id: string; items: any[] }) => {
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
    };
    console.log(`🎧 Setting up event listeners for connection:`, currentConnection.id);
    currentConnection.on("chat:new", onNew);
    currentConnection.on("chat:history", onHistory);
    return () => {
      currentConnection.off("chat:new", onNew);
      currentConnection.off("chat:history", onHistory);
    };
  }, [currentConnection, activeConversationId]);

  // Reset chat list when conversation changes and load history
  useEffect(() => {
    console.log(`🔄 Conversation changed, resetting chat:`, {
      activeConversationId,
      hasConnection: !!currentConnection
    });
    setChatMessages([]);
    if (!currentConnection || !activeConversationId) return;
    
    // Load chat history for the selected conversation
    const fetchPayload = {
      conversationId: activeConversationId,
      limit: 50
    };
    console.log(`📥 Fetching chat history:`, fetchPayload);
    currentConnection.emit("chat:fetch", fetchPayload);
  }, [activeConversationId, currentConnection]);

  const canSend = chatText.trim().length > 0 && !!currentConnection && !!activeConversationId && !!localStorage.getItem(`accessToken_${currentlyViewingServer?.host}`) && isUserAuthenticated();
  
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
      canSend: canSend
    });
  }, [chatText, currentConnection, activeConversationId, canSend, currentlyViewingServer]);

  const sendChat = () => {
    const body = chatText.trim();
    if (!canSend) return;
    
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
      sender_nickname: "You", // Will be replaced with actual nickname when server responds
      text: body,
      attachments: null,
      created_at: new Date(),
      pending: true,
    };
    setChatMessages((prev) => [...prev, optimistic]);
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

  const logDataRef = useRef<any>(null);
  
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
  }, [microphoneBuffer.finalAnalyser, streamSources, clients, currentlyViewingServer, currentConnection?.id, currentServerConnected]);

  useEffect(() => {
    let lastActivityTime = Date.now();
    let afkCheckInterval: NodeJS.Timeout;

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

    afkCheckInterval = setInterval(checkAFK, 5000);
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

  if (!currentlyViewingServer) return null;

  const handleChannelClick = async (channel: Channel) => {
    // Always select the channel for chat view
    setSelectedChannelId(channel.id);

    switch (channel.type) {
      case "voice":
        const isAlreadyConnectedToThisChannel = 
          isConnected &&
          channel.id === currentChannelId &&
          currentlyViewingServer.host === currentServerConnected;

        if (isAlreadyConnectedToThisChannel) {
          setShowVoiceView(!showVoiceView);
          return;
        }

        setPendingChannelId(null);
        setShowVoiceView(true);
        console.log("Attempting to connect with micID:", micID);
        
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

      case "text":
        break;
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
            />

            <ChatView
              chatMessages={chatMessages}
              chatText={chatText}
              setChatText={setChatText}
              canSend={canSend}
              sendChat={sendChat}
              currentUserId={userId || undefined}
            />
          </Flex>
        )}
      </Flex>
    </>
  );
};
