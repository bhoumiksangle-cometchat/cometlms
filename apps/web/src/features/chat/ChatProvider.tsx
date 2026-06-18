import React, { createContext, useEffect, useState, ReactNode, useCallback } from 'react';
import { getSocket, connectSocket, disconnectSocket } from '../../lib/socket';
import { apiClient } from '../../lib/apiClient';
import type { Socket } from 'socket.io-client';
import { useAuth } from '../auth/useAuth';
import { notificationService } from '../../lib/notifications';

export interface ChatMessage {
  id: string;
  roomId: string;
  senderId: string;
  sender: {
    id: string;
    name: string;
    avatarUrl?: string;
    role: string;
  };
  content: string;
  parentMessageId?: string;
  contentType: 'TEXT' | 'IMAGE' | 'FILE' | 'VOICE';
  isEdited: boolean;
  isDeleted: boolean;
  metadata?: {
    reactions?: Record<string, string[]>;
    readBy?: string[];
    mentions?: Array<{ id: string; name: string }>;
  };
  createdAt: string;
  updatedAt: string;
  replies?: ChatMessage[];
}

export interface ChatRoom {
  id: string;
  roomId: string;
  name: string;
  type: 'GROUP' | 'DM';
  ownerId: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface TypingUser {
  userId: string;
  roomId: string;
}

export interface UserPresence {
  userId: string;
  status: 'online' | 'offline';
  lastSeenAt?: string;
}

export interface ChatContextType {
  socket: Socket | null;
  messages: ChatMessage[];
  currentRoom: ChatRoom | null;
  typingUsers: TypingUser[];
  userPresence: Map<string, UserPresence>;
  activeGroupCall: { roomId: string; startedBy: string; callType: string; meetingUrl: string; startedAt: string } | null;
  
  // Methods
  disconnectFromChat: () => void;
  joinRoom: (roomId: string) => void;
  sendMessage: (roomId: string, content: string, parentMessageId?: string) => void;
  addReaction: (messageId: string, emoji: string, roomId: string) => void;
  removeReaction: (messageId: string, emoji: string, roomId: string) => void;
  markAsRead: (messageId: string, roomId: string) => void;
  editMessage: (messageId: string, content: string, roomId: string) => void;
  deleteMessage: (messageId: string, roomId: string) => void;
  startTyping: (roomId: string) => void;
  stopTyping: (roomId: string) => void;
  startGroupCall: (roomId: string, callType: 'voice' | 'video') => void;
  endGroupCall: (roomId: string) => void;
}

const ChatContext = createContext<ChatContextType | undefined>(undefined);

export const ChatProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [currentRoom, setCurrentRoom] = useState<ChatRoom | null>(null);
  const [typingUsers, setTypingUsers] = useState<TypingUser[]>([]);
  const [userPresence, setUserPresence] = useState<Map<string, UserPresence>>(new Map());
  const [activeGroupCall, setActiveGroupCall] = useState<{ roomId: string; startedBy: string; callType: string; meetingUrl: string; startedAt: string } | null>(null);
  const { user } = useAuth();

  useEffect(() => {
    if (!user) return;

    // We use an interval to check if socket is connected because AuthContext
    // connects the socket asynchronously after fetching me.
    const interval = setInterval(() => {
      const currentSocket = getSocket();
      if (currentSocket && !socket) {
        setSocket(currentSocket);
        clearInterval(interval);
      }
    }, 100);

    return () => clearInterval(interval);
  }, [user, socket]);

  useEffect(() => {
    if (!socket) return;

    console.log('[ChatProvider] Setting up socket event listeners');

    // Listen for incoming messages
    socket.on('message:sent', (message: ChatMessage) => {
      console.log('[ChatProvider] Received message:sent event:', message.id, 'from', message.sender.name);
      setMessages((prev) => [...prev, message]);
      
      // Show push notification if message is from someone else and window is not focused
      if (message.senderId !== user?.id && document.hidden) {
        notificationService.showMessageNotification(
          message.sender.name,
          message.content,
          message.roomId,
          'Course Discussion'
        );
      }
    });
    
    // Listen for DM messages (when fetching DM history)
    socket.on('dm:messages', ({ roomId, messages }: { roomId: string; messages: ChatMessage[] }) => {
      console.log('[ChatProvider] Received dm:messages event:', messages.length, 'messages for room', roomId);
      setMessages((prev) => {
        const existingIds = new Set(prev.map((m) => m.id));
        const merged = [...prev];
        messages.forEach((msg: ChatMessage) => {
          if (!existingIds.has(msg.id)) merged.push(msg);
        });
        return merged;
      });
    });
    
    // Listen for message errors
    socket.on('message:error', (error: any) => {
      console.error('[ChatProvider] Message error:', error);
      alert(`Error: ${error.error || 'Failed to send message'}`);
    });

    // Listen for typing indicators
    socket.on('typing:start', ({ userId, roomId }: { userId: string; roomId: string }) => {
      setTypingUsers((prev) => {
        const exists = prev.some((t) => t.userId === userId && t.roomId === roomId);
        return exists ? prev : [...prev, { userId, roomId }];
      });
    });

    socket.on('typing:stop', ({ userId, roomId }: { userId: string; roomId: string }) => {
      setTypingUsers((prev) => prev.filter((t) => !(t.userId === userId && t.roomId === roomId)));
    });

    // Listen for presence changes
    socket.on('user:presence_changed', ({ userId, status, lastSeenAt }: UserPresence) => {
      setUserPresence((prev) => {
        const newMap = new Map(prev);
        newMap.set(userId, { userId, status, lastSeenAt });
        return newMap;
      });
    });

    // Listen for message reactions
    socket.on('message:reaction_added', ({ messageId, emoji, reactions }: { messageId: string; emoji: string; reactions: Record<string, string[]> }) => {
      setMessages((prev) =>
        prev.map((msg) => (msg.id === messageId ? { ...msg, metadata: { ...msg.metadata, reactions } } : msg)),
      );
    });

    socket.on('message:reaction_removed', ({ messageId, reactions }: { messageId: string; reactions: Record<string, string[]> }) => {
      setMessages((prev) =>
        prev.map((msg) => (msg.id === messageId ? { ...msg, metadata: { ...msg.metadata, reactions } } : msg)),
      );
    });

    // Listen for read receipts
    socket.on('message:read', ({ messageId, readBy }: { messageId: string; readBy: string[] }) => {
      setMessages((prev) =>
        prev.map((msg) => (msg.id === messageId ? { ...msg, metadata: { ...msg.metadata, readBy } } : msg)),
      );
    });

    // Listen for message edits
    socket.on('message:edited', ({ messageId, content, isEdited }: { messageId: string; content: string; isEdited: boolean }) => {
      setMessages((prev) =>
        prev.map((msg) => (msg.id === messageId ? { ...msg, content, isEdited } : msg)),
      );
    });

    // Listen for message deletion
    socket.on('message:deleted', ({ messageId }: { messageId: string }) => {
      setMessages((prev) =>
        prev.map((msg) => (msg.id === messageId ? { ...msg, isDeleted: true } : msg)),
      );
    });

    // Listen for mentions
    socket.on('user:mentioned', ({ messageId, senderName, roomId, preview }: { messageId: string; senderName: string; roomId: string; preview: string }) => {
      console.log(`You were mentioned by ${senderName}: ${preview}`);
      
      // Show push notification for mention (always show, even if window is focused)
      notificationService.showMentionNotification(
        senderName,
        preview,
        roomId,
        'Course Discussion'
      );
    });

    // Listen for call events
    socket.on('call:started', ({ roomId, startedBy, callType, meetingUrl, startedAt }: { roomId: string; startedBy: string; callType: string; meetingUrl: string; startedAt: string }) => {
      console.log(`Call started in ${roomId} by ${startedBy}`);
      setActiveGroupCall({ roomId, startedBy, callType, meetingUrl, startedAt });
    });

    socket.on('call:user_joined', ({ roomId, userId }: { roomId: string; userId: string }) => {
      console.log(`User ${userId} joined call in ${roomId}`);
    });

    socket.on('call:user_left', ({ roomId, userId }: { roomId: string; userId: string }) => {
      console.log(`User ${userId} left call in ${roomId}`);
    });

    socket.on('call:ended', ({ roomId, endedBy, duration, recordingUrl }: { roomId: string; endedBy: string; duration: number; recordingUrl?: string }) => {
      console.log(`Call in ${roomId} ended by ${endedBy}, duration: ${duration}s`);
      setActiveGroupCall((prev) => (prev?.roomId === roomId ? null : prev));
    });

    // Cleanup listeners when socket changes or component unmounts
    return () => {
      socket.off('message:sent');
      socket.off('dm:messages');
      socket.off('message:error');
      socket.off('typing:start');
      socket.off('typing:stop');
      socket.off('user:presence_changed');
      socket.off('message:reaction_added');
      socket.off('message:reaction_removed');
      socket.off('message:read');
      socket.off('message:edited');
      socket.off('message:deleted');
      socket.off('user:mentioned');
      socket.off('call:started');
      socket.off('call:user_joined');
      socket.off('call:user_left');
      socket.off('call:ended');
    };
  }, [socket]);

  const disconnectFromChat = useCallback(() => {
    disconnectSocket();
    setSocket(null);
    setMessages([]);
    setCurrentRoom(null);
  }, []);

  const joinRoom = useCallback((roomId: string) => {
    console.log('[ChatProvider] Joining room:', roomId);
    const currentSocket = getSocket();
    console.log('[ChatProvider] Socket for joinRoom:', currentSocket ? 'Available' : 'NULL');
    
    if (currentSocket) {
      console.log('[ChatProvider] Emitting room:join event');
      currentSocket.emit('room:join', { roomId });
      setCurrentRoom({ id: '', roomId, name: '', type: 'GROUP', ownerId: '', isActive: true, createdAt: '', updatedAt: '' });

      apiClient.getRoomMessages(roomId).then((response: any) => {
        console.log('[ChatProvider] Loaded message history:', response?.data?.length || 0, 'messages');
        const history = response?.data || [];
        setMessages((prev) => {
          const existingIds = new Set(prev.map((m) => m.id));
          const merged = [...prev];
          history.forEach((msg: ChatMessage) => {
            if (!existingIds.has(msg.id)) merged.push(msg);
          });
          console.log('[ChatProvider] Total messages after merge:', merged.length);
          return merged;
        });
      }).catch((err) => {
        console.error('[ChatProvider] Failed to load message history:', err);
      });
    } else {
      console.error('[ChatProvider] Cannot join room - socket not available');
    }
  // socket in deps: when socket reconnects, ChatWindow's useEffect re-runs and re-joins the room
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [socket]);

  const sendMessage = useCallback((roomId: string, content: string, parentMessageId?: string) => {
    console.log('[ChatProvider] Attempting to send message:', { roomId, content: content.substring(0, 20) + '...' });
    const currentSocket = getSocket();
    console.log('[ChatProvider] Socket instance:', currentSocket ? 'Available' : 'NULL');
    
    if (currentSocket) {
      console.log('[ChatProvider] Emitting message:send event');
      currentSocket.emit('message:send', { roomId, content, parentMessageId });
    } else {
      console.error('[ChatProvider] Cannot send message - socket not available');
    }
  }, []);

  const addReaction = useCallback((messageId: string, emoji: string, roomId: string) => {
    const currentSocket = getSocket();
    if (currentSocket) {
      currentSocket.emit('message:reaction_added', { messageId, emoji, roomId });
    }
  }, []);

  const removeReaction = useCallback((messageId: string, emoji: string, roomId: string) => {
    const currentSocket = getSocket();
    if (currentSocket) {
      currentSocket.emit('message:reaction_removed', { messageId, emoji, roomId });
    }
  }, []);

  const markAsRead = useCallback((messageId: string, roomId: string) => {
    const currentSocket = getSocket();
    if (currentSocket) {
      currentSocket.emit('message:read', { messageId, roomId });
    }
  }, []);

  const editMessage = useCallback((messageId: string, content: string, roomId: string) => {
    const currentSocket = getSocket();
    if (currentSocket) {
      currentSocket.emit('message:edit', { messageId, content, roomId });
    }
  }, []);

  const deleteMessage = useCallback((messageId: string, roomId: string) => {
    const currentSocket = getSocket();
    if (currentSocket) {
      currentSocket.emit('message:delete', { messageId, roomId });
    }
  }, []);

  const startTyping = useCallback((roomId: string) => {
    const currentSocket = getSocket();
    if (currentSocket) {
      currentSocket.emit('typing:start', { roomId });
    }
  }, []);

  const stopTyping = useCallback((roomId: string) => {
    const currentSocket = getSocket();
    if (currentSocket) {
      currentSocket.emit('typing:stop', { roomId });
    }
  }, []);

  const startGroupCall = useCallback((roomId: string, callType: 'voice' | 'video') => {
    const currentSocket = getSocket();
    if (currentSocket) {
      const meetingUrl = `${window.location.origin}/call/${roomId}`;
      currentSocket.emit('call:started', { roomId, callType, meetingUrl });
    }
  }, []);

  const endGroupCall = useCallback((roomId: string) => {
    const currentSocket = getSocket();
    if (currentSocket) {
      currentSocket.emit('call:ended', {
        roomId,
        callId: roomId,
        duration: 0,
      });
    }
  }, []);

  return (
    <ChatContext.Provider
      value={{
        socket,
        messages,
        currentRoom,
        typingUsers,
        userPresence,
        activeGroupCall,
        disconnectFromChat,
        joinRoom,
        sendMessage,
        addReaction,
        removeReaction,
        markAsRead,
        editMessage,
        deleteMessage,
        startTyping,
        stopTyping,
        startGroupCall,
        endGroupCall,
      }}
    >
      {children}
    </ChatContext.Provider>
  );
};

export default ChatContext;
