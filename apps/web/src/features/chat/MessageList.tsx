import React, { useEffect, useRef } from 'react';
import { useChatContext } from './useChatContext';
import type { ChatMessage } from './ChatProvider';

interface MessageListProps {
  roomId: string;
}

const MessageList: React.FC<MessageListProps> = ({ roomId }) => {
  const { messages } = useChatContext();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const roomMessages = messages.filter((msg) => msg.roomId === roomId && !msg.isDeleted);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflowY: 'auto', background: '#fff' }}>
      {roomMessages.length === 0 ? (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#9ca3af', fontSize: 14 }}>
          No messages yet. Start the conversation!
        </div>
      ) : (
        <div style={{ padding: 16 }}>
          {roomMessages.map((message) => (
            <div key={message.id} style={{ marginBottom: 16 }}>
              <MessageItem message={message} />
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>
      )}
    </div>
  );
};

interface MessageItemProps {
  message: ChatMessage;
}

const MessageItem: React.FC<MessageItemProps> = ({ message }) => {
  const { addReaction, editMessage, deleteMessage } = useChatContext();
  const [showActions, setShowActions] = React.useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = React.useState(false);

  const reactions = message.metadata?.reactions || {};
  const readBy = message.metadata?.readBy || [];
  const mentions = message.metadata?.mentions || [];

  const COMMON_REACTIONS = ['👍', '❤️', '😂', '🔥', '😢'];

  return (
    <div 
      style={{ display: 'flex', gap: 12, padding: 8, borderRadius: 6, position: 'relative' }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = '#f9fafb';
        setShowActions(true);
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = 'transparent';
        setShowActions(false);
      }}
    >
      {/* Avatar */}
      <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#10b981', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 600, flexShrink: 0 }}>
        {message.sender?.name?.[0]?.toUpperCase() || '?'}
      </div>

      {/* Message Content */}
      <div style={{ flex: 1 }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontWeight: 600, fontSize: 14, color: '#111827' }}>{message.sender?.name || 'Unknown'}</span>
          <span style={{ fontSize: 12, color: '#9ca3af' }}>{new Date(message.createdAt).toLocaleTimeString()}</span>
          {message.isEdited && <span style={{ fontSize: 12, color: '#d1d5db' }}>(edited)</span>}
        </div>

        {/* Message text */}
        <p style={{ fontSize: 14, color: '#374151', margin: '4px 0 0', lineHeight: 1.5 }}>
          {mentions.length > 0 ? (
            <>
              {mentions.map((mention) => (
                <span key={mention.id} style={{ fontWeight: 600, color: '#10b981' }}>
                  @{mention.name}{' '}
                </span>
              ))}
              {message.content}
            </>
          ) : (
            message.content
          )}
        </p>

        {/* Reactions */}
        {Object.keys(reactions).length > 0 && (
          <div style={{ display: 'flex', gap: 4, marginTop: 8, flexWrap: 'wrap' }}>
            {Object.entries(reactions).map(([emoji, users]) => (
              <button
                key={emoji}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                  background: '#f3f4f6',
                  border: 'none',
                  borderRadius: 16,
                  padding: '4px 8px',
                  fontSize: 12,
                  cursor: 'pointer',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = '#e5e7eb')}
                onMouseLeave={(e) => (e.currentTarget.style.background = '#f3f4f6')}
                onClick={() => addReaction(message.id, emoji, message.roomId)}
              >
                {emoji}
                <span style={{ color: '#6b7280' }}>{users.length}</span>
              </button>
            ))}
          </div>
        )}

        {/* Read receipts */}
        {readBy.length > 0 && (
          <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 8 }}>
            Read by {readBy.length} {readBy.length === 1 ? 'person' : 'people'}
          </div>
        )}
      </div>

      {/* Message Actions */}
      {showActions && (
        <div style={{ display: 'flex', gap: 4, alignItems: 'flex-start' }}>
          {/* Emoji Picker Toggle */}
          <button
            style={{
              padding: 4,
              background: 'none',
              border: 'none',
              borderRadius: 4,
              cursor: 'pointer',
              fontSize: 14,
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = '#e5e7eb')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'none')}
            onClick={() => setShowEmojiPicker(!showEmojiPicker)}
            title="Add reaction"
          >
            😊
          </button>

          {/* Edit Button */}
          <button
            style={{
              padding: 4,
              background: 'none',
              border: 'none',
              borderRadius: 4,
              cursor: 'pointer',
              fontSize: 12,
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = '#e5e7eb')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'none')}
            onClick={() => {
              const newContent = prompt('Edit message:', message.content);
              if (newContent) editMessage(message.id, newContent, message.roomId);
            }}
            title="Edit message"
          >
            ✏️
          </button>

          {/* Delete Button */}
          <button
            style={{
              padding: 4,
              background: 'none',
              border: 'none',
              borderRadius: 4,
              cursor: 'pointer',
              fontSize: 12,
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = '#e5e7eb')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'none')}
            onClick={() => {
              if (confirm('Delete this message?')) deleteMessage(message.id, message.roomId);
            }}
            title="Delete message"
          >
            🗑️
          </button>
        </div>
      )}

      {/* Emoji Picker */}
      {showEmojiPicker && (
        <div style={{ 
          position: 'absolute', 
          top: '100%', 
          right: 0, 
          background: '#fff', 
          border: '1px solid #e5e7eb', 
          borderRadius: 8, 
          boxShadow: '0 4px 6px rgba(0,0,0,0.1)', 
          padding: 8, 
          display: 'flex', 
          gap: 4,
          zIndex: 10,
        }}>
          {COMMON_REACTIONS.map((emoji) => (
            <button
              key={emoji}
              style={{
                fontSize: 20,
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: 4,
                borderRadius: 4,
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'scale(1.25)';
                e.currentTarget.style.background = '#f3f4f6';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'scale(1)';
                e.currentTarget.style.background = 'none';
              }}
              onClick={() => {
                addReaction(message.id, emoji, message.roomId);
                setShowEmojiPicker(false);
              }}
            >
              {emoji}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default MessageList;
