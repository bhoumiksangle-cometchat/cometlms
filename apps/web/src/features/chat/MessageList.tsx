import React, { useEffect, useRef } from 'react';
import { useChatContext } from './useChatContext';
import { useAuth } from '../auth/useAuth';
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
  const { user } = useAuth();
  const [showActions, setShowActions] = React.useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = React.useState(false);

  const reactions = message.metadata?.reactions || {};
  const readBy = message.metadata?.readBy || [];
  const mentions = message.metadata?.mentions || [];

  const COMMON_REACTIONS = ['👍', '❤️', '😂', '🔥', '😢'];

  const isOwn = message.senderId === user?.id;
  const avatarBg = isOwn ? '#10b981' : '#6b7280';

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: isOwn ? 'row-reverse' : 'row',
        gap: 8,
        alignItems: 'flex-end',
        position: 'relative',
      }}
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => setShowActions(false)}
    >
      {/* Avatar */}
      <div style={{
        width: 30,
        height: 30,
        borderRadius: '50%',
        background: avatarBg,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#fff',
        fontWeight: 600,
        fontSize: 13,
        flexShrink: 0,
        alignSelf: 'flex-end',
        marginBottom: 2,
      }}>
        {message.sender?.name?.[0]?.toUpperCase() || '?'}
      </div>

      {/* Bubble + meta */}
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: isOwn ? 'flex-end' : 'flex-start',
        maxWidth: '70%',
      }}>
        {/* Sender name (only for others in group chat) */}
        {!isOwn && (
          <span style={{ fontSize: 12, fontWeight: 600, color: '#6b7280', marginBottom: 2, paddingLeft: 4 }}>
            {message.sender?.name || 'Unknown'}
          </span>
        )}

        {/* Bubble */}
        <div style={{
          padding: '8px 12px',
          borderRadius: 18,
          borderBottomRightRadius: isOwn ? 4 : 18,
          borderBottomLeftRadius: isOwn ? 18 : 4,
          background: isOwn ? '#10b981' : '#f3f4f6',
          color: isOwn ? '#fff' : '#1f2937',
          fontSize: 14,
          lineHeight: 1.5,
          wordBreak: 'break-word',
          boxShadow: '0 1px 2px rgba(0,0,0,0.08)',
        }}>
          {/* Message text */}
          {mentions.length > 0 ? (
            <>
              {mentions.map((mention) => (
                <span key={mention.id} style={{ fontWeight: 700, color: isOwn ? '#d1fae5' : '#10b981' }}>
                  @{mention.name}{' '}
                </span>
              ))}
              {message.content}
            </>
          ) : (
            message.content
          )}

          {/* Timestamp inside bubble */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            gap: 4,
            marginTop: 4,
          }}>
            {message.isEdited && (
              <span style={{ fontSize: 10, opacity: 0.7 }}>(edited)</span>
            )}
            <span style={{ fontSize: 10, opacity: 0.7, whiteSpace: 'nowrap' }}>
              {new Date(message.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>
        </div>

        {/* Reactions */}
        {Object.keys(reactions).length > 0 && (
          <div style={{ display: 'flex', gap: 4, marginTop: 4, flexWrap: 'wrap' }}>
            {Object.entries(reactions).map(([emoji, users]) => (
              <button
                key={emoji}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                  background: '#fff',
                  border: '1px solid #e5e7eb',
                  borderRadius: 12,
                  padding: '2px 6px',
                  fontSize: 12,
                  cursor: 'pointer',
                  boxShadow: '0 1px 2px rgba(0,0,0,0.06)',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = '#f3f4f6')}
                onMouseLeave={(e) => (e.currentTarget.style.background = '#fff')}
                onClick={() => addReaction(message.id, emoji, message.roomId)}
              >
                {emoji}
                <span style={{ color: '#6b7280' }}>{users.length}</span>
              </button>
            ))}
          </div>
        )}

        {/* Read receipts */}
        {isOwn && readBy.length > 0 && (
          <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 2, paddingRight: 4 }}>
            ✓✓ {readBy.length}
          </div>
        )}
      </div>

      {/* Message Actions (shown on hover) */}
      {showActions && (
        <div style={{
          display: 'flex',
          gap: 2,
          alignItems: 'center',
          alignSelf: 'center',
        }}>
          <button
            style={{ padding: 4, background: 'none', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 14 }}
            onMouseEnter={(e) => (e.currentTarget.style.background = '#e5e7eb')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'none')}
            onClick={() => setShowEmojiPicker(!showEmojiPicker)}
            title="Add reaction"
          >
            😊
          </button>
          <button
            style={{ padding: 4, background: 'none', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 12 }}
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
          <button
            style={{ padding: 4, background: 'none', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 12 }}
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
          bottom: '100%',
          [isOwn ? 'right' : 'left']: 0,
          background: '#fff',
          border: '1px solid #e5e7eb',
          borderRadius: 8,
          boxShadow: '0 4px 12px rgba(0,0,0,0.12)',
          padding: 8,
          display: 'flex',
          gap: 4,
          zIndex: 10,
        }}>
          {COMMON_REACTIONS.map((emoji) => (
            <button
              key={emoji}
              style={{ fontSize: 20, background: 'none', border: 'none', cursor: 'pointer', padding: 4, borderRadius: 4 }}
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
