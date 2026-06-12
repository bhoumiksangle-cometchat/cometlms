import React from 'react';
import { useChatContext } from './useChatContext';

interface TypingIndicatorProps {
  roomId: string;
}

const TypingIndicator: React.FC<TypingIndicatorProps> = ({ roomId }) => {
  const { typingUsers } = useChatContext();

  const typingInRoom = typingUsers.filter((t) => t.roomId === roomId);

  if (typingInRoom.length === 0) {
    return null;
  }

  return (
    <div style={{ padding: '8px 16px', fontSize: 13, color: '#6b7280', display: 'flex', alignItems: 'center', gap: 4 }}>
      <span>
        {typingInRoom.length === 1
          ? `Someone is typing`
          : `${typingInRoom.length} people are typing`}
      </span>
      <span style={{ display: 'flex', gap: 2 }}>
        <span style={{ width: 4, height: 4, background: '#6b7280', borderRadius: '50%', animation: 'bounce 1s infinite' }}></span>
        <span style={{ width: 4, height: 4, background: '#6b7280', borderRadius: '50%', animation: 'bounce 1s infinite 0.1s' }}></span>
        <span style={{ width: 4, height: 4, background: '#6b7280', borderRadius: '50%', animation: 'bounce 1s infinite 0.2s' }}></span>
      </span>
    </div>
  );
};

export default TypingIndicator;
