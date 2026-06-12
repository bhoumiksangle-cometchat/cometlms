import React, { useEffect } from 'react';
import { useChatContext } from './useChatContext';
import MessageList from './MessageList';
import MessageInput from './MessageInput';
import TypingIndicator from './TypingIndicator';

interface ChatWindowProps {
  roomId: string;
  roomName?: string;
}

const ChatWindow: React.FC<ChatWindowProps> = ({ roomId, roomName = 'Chat Room' }) => {
  const { joinRoom } = useChatContext();

  useEffect(() => {
    joinRoom(roomId);
  }, [roomId, joinRoom]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: '#fff', borderRadius: 8, border: '1px solid #e5e7eb' }}>
      {/* Header */}
      <div style={{ borderBottom: '1px solid #e5e7eb', padding: 16, background: '#f9fafb' }}>
        <h2 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: '#111827' }}>{roomName}</h2>
      </div>

      {/* Messages Area */}
      <div style={{ flex: 1, overflow: 'hidden' }}>
        <MessageList roomId={roomId} />
      </div>

      {/* Typing Indicator */}
      <TypingIndicator roomId={roomId} />

      {/* Input Area */}
      <MessageInput roomId={roomId} />
    </div>
  );
};

export default ChatWindow;
