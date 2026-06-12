import React, { useState, useEffect, useRef } from 'react';
import { getSocket } from '../../lib/socket';

interface ChatMessage {
  id: string;
  roomId: string;
  content: string;
  senderId: string;
  sender: {
    id: string;
    name: string;
    avatarUrl?: string;
    role: string;
  };
  createdAt: string;
}

interface TypingUser {
  userId: string;
  roomId: string;
}

interface Props {
  otherUserId?: string;
  instructorId?: string;
}

const DirectMessages: React.FC<Props> = ({ otherUserId, instructorId }) => {
  const targetUserId = otherUserId || instructorId;
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [roomId, setRoomId] = useState<string | null>(null);
  const [isTyping, setIsTyping] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!targetUserId) return;

    const socket = getSocket();
    if (!socket) {
      setError('Socket connection not available');
      return;
    }

    setError(null);
    setRoomId(null);
    setMessages([]);

    // Fetch message history for this DM
    socket.emit('dm:fetch', { otherUserId: targetUserId });

    // Handle initial messages list and room assignment
    const handleDmMessages = (data: { roomId: string; messages: ChatMessage[] }) => {
      setRoomId(data.roomId);
      setMessages(data.messages);
    };

    // Handle new message arrival
    const handleMessageSent = (message: ChatMessage) => {
      if (roomId && message.roomId === roomId) {
        setMessages((prev) => {
          if (prev.some((m) => m.id === message.id)) return prev;
          return [...prev, message];
        });
      }
    };

    // Handle errors
    const handleDmError = (err: { error: string }) => {
      setError(err.error);
    };

    // Listen for typing events
    const handleTypingStart = ({ userId, roomId: typingRoomId }: { userId: string; roomId: string }) => {
      if (typingRoomId === roomId && userId === targetUserId) {
        setIsTyping(true);
      }
    };

    const handleTypingStop = ({ userId, roomId: typingRoomId }: { userId: string; roomId: string }) => {
      if (typingRoomId === roomId && userId === targetUserId) {
        setIsTyping(false);
      }
    };

    socket.on('dm:messages', handleDmMessages);
    socket.on('message:sent', handleMessageSent);
    socket.on('dm:error', handleDmError);
    socket.on('typing:start', handleTypingStart);
    socket.on('typing:stop', handleTypingStop);

    return () => {
      socket.off('dm:messages', handleDmMessages);
      socket.off('message:sent', handleMessageSent);
      socket.off('dm:error', handleDmError);
      socket.off('typing:start', handleTypingStart);
      socket.off('typing:stop', handleTypingStop);
    };
  }, [targetUserId, roomId]);

  // Scroll to bottom when messages list updates
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setNewMessage(e.target.value);
    
    const socket = getSocket();
    if (!socket || !roomId) return;

    // Send typing start indicator
    socket.emit('typing:start', { roomId });

    // Debounce typing stop indicator
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      socket.emit('typing:stop', { roomId });
    }, 2000);
  };

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !targetUserId) return;

    const socket = getSocket();
    if (!socket) {
      setError('Socket connection not available');
      return;
    }

    socket.emit('dm:send', { otherUserId: targetUserId, content: newMessage });
    
    // Stop typing indicator on message send
    if (roomId) {
      socket.emit('typing:stop', { roomId });
    }
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);

    setNewMessage('');
  };

  if (!targetUserId) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', padding: 24, color: '#6b7280' }}>
        Select a conversation to start direct messaging
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: '#fff', borderRadius: 8, border: '1px solid #e5e7eb' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 16, borderBottom: '1px solid #f3f4f6', background: '#f9fafb' }}>
        <div>
          <h3 style={{ margin: 0, fontWeight: 600, color: '#1f2937', fontSize: 15 }}>Direct Message</h3>
          <p style={{ margin: '4px 0 0', fontSize: 12, color: '#6b7280' }}>Secure end-to-end conversation</p>
        </div>
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>
        {error && (
          <div style={{ padding: 12, fontSize: 13, color: '#dc2626', background: '#fef2f2', borderRadius: 8, border: '1px solid #fecaca', marginBottom: 16 }}>
            {error}
          </div>
        )}
        
        {messages.length === 0 ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#9ca3af', fontSize: 14 }}>
            No messages yet. Say hello!
          </div>
        ) : (
          messages.map((msg) => (
            <div
              key={msg.id}
              style={{
                display: 'flex',
                flexDirection: 'column',
                maxWidth: '70%',
                marginLeft: msg.senderId !== targetUserId ? 'auto' : 0,
                marginRight: msg.senderId !== targetUserId ? 0 : 'auto',
                alignItems: msg.senderId !== targetUserId ? 'flex-end' : 'flex-start',
                marginBottom: 16,
              }}
            >
              <span style={{ fontSize: 11, color: '#9ca3af', marginBottom: 4, padding: '0 4px' }}>
                {msg.sender?.name} • {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
              <div
                style={{
                  padding: 12,
                  borderRadius: 16,
                  fontSize: 14,
                  background: msg.senderId !== targetUserId ? '#10b981' : '#f3f4f6',
                  color: msg.senderId !== targetUserId ? '#fff' : '#1f2937',
                  borderTopRightRadius: msg.senderId !== targetUserId ? 4 : 16,
                  borderTopLeftRadius: msg.senderId !== targetUserId ? 16 : 4,
                }}
              >
                {msg.content}
              </div>
            </div>
          ))
        )}

        {isTyping && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#9ca3af', fontSize: 12, padding: '4px 0' }}>
            <span style={{ animation: 'bounce 1s infinite' }}>•</span>
            <span style={{ animation: 'bounce 1s infinite 0.1s' }}>•</span>
            <span style={{ animation: 'bounce 1s infinite 0.2s' }}>•</span>
            <span style={{ marginLeft: 4 }}>typing...</span>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Form */}
      <form onSubmit={handleSend} style={{ padding: 16, borderTop: '1px solid #f3f4f6', display: 'flex', gap: 8 }}>
        <input
          type="text"
          value={newMessage}
          onChange={handleInputChange}
          placeholder="Type your message..."
          style={{
            flex: 1,
            minHeight: 40,
            padding: '8px 12px',
            border: '1px solid #e5e7eb',
            borderRadius: 8,
            outline: 'none',
            fontSize: 14,
          }}
          onFocus={(e) => (e.target.style.borderColor = '#10b981')}
          onBlur={(e) => (e.target.style.borderColor = '#e5e7eb')}
        />
        <button
          type="submit"
          disabled={!newMessage.trim()}
          style={{
            padding: '8px 16px',
            background: newMessage.trim() ? '#10b981' : '#d1d5db',
            color: '#fff',
            fontWeight: 600,
            borderRadius: 8,
            fontSize: 14,
            border: 'none',
            cursor: newMessage.trim() ? 'pointer' : 'not-allowed',
            transition: 'background 0.2s',
          }}
        >
          Send
        </button>
      </form>
    </div>
  );
};

export default DirectMessages;