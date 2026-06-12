import React, { useState, useRef, useEffect } from 'react';
import { useChatContext } from './useChatContext';

interface MessageInputProps {
  roomId: string;
}

const MessageInput: React.FC<MessageInputProps> = ({ roomId }) => {
  const [content, setContent] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const typingTimeoutRef = useRef<NodeJS.Timeout>();
  const { sendMessage, startTyping, stopTyping } = useChatContext();

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const text = e.target.value;
    setContent(text);

    // Emit typing indicator
    if (!isTyping) {
      setIsTyping(true);
      startTyping(roomId);
    }

    // Reset typing timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    // Stop typing after 1 second of no input
    typingTimeoutRef.current = setTimeout(() => {
      setIsTyping(false);
      stopTyping(roomId);
    }, 1000);

    // Show mentions suggestions
    const lastAtIndex = text.lastIndexOf('@');
    if (lastAtIndex !== -1) {
      const afterAt = text.substring(lastAtIndex + 1);
      if (afterAt && !afterAt.includes(' ')) {
        // TODO: Fetch user suggestions from backend
        setSuggestions(['alice', 'bob', 'charlie'].filter((s) => s.includes(afterAt)));
      }
    } else {
      setSuggestions([]);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (content.trim()) {
      sendMessage(roomId, content);
      setContent('');
      setSuggestions([]);
      stopTyping(roomId);
      setIsTyping(false);
    }
  };

  const handleMentionSelect = (username: string) => {
    const lastAtIndex = content.lastIndexOf('@');
    const beforeAt = content.substring(0, lastAtIndex);
    const afterLastSpace = content.substring(lastAtIndex).split(' ')[0].length;
    const newContent = beforeAt + `@${username} `;
    setContent(newContent);
    setSuggestions([]);
  };

  return (
    <div style={{ borderTop: '1px solid #e5e7eb', padding: 16, background: '#fff' }}>
      {/* Mentions Suggestions */}
      {suggestions.length > 0 && (
        <div style={{ marginBottom: 8, background: '#f3f4f6', border: '1px solid #e5e7eb', borderRadius: 6, padding: 8 }}>
          {suggestions.map((suggestion) => (
            <button
              key={suggestion}
              style={{
                display: 'block',
                width: '100%',
                textAlign: 'left',
                padding: '4px 8px',
                background: 'none',
                border: 'none',
                borderRadius: 4,
                cursor: 'pointer',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = '#e5e7eb')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'none')}
              onClick={() => handleMentionSelect(suggestion)}
            >
              @{suggestion}
            </button>
          ))}
        </div>
      )}

      <form onSubmit={handleSubmit} style={{ display: 'flex', gap: 8 }}>
        <textarea
          value={content}
          onChange={handleChange}
          placeholder="Type your message... (use @name to mention)"
          style={{
            flex: 1,
            padding: 8,
            border: '1px solid #d1d5db',
            borderRadius: 6,
            resize: 'none',
            outline: 'none',
            fontSize: 14,
            fontFamily: 'inherit',
          }}
          rows={3}
          onFocus={(e) => (e.target.style.borderColor = '#10b981')}
          onBlur={(e) => (e.target.style.borderColor = '#d1d5db')}
        />
        <button
          type="submit"
          disabled={!content.trim()}
          style={{
            padding: '8px 16px',
            background: content.trim() ? '#10b981' : '#d1d5db',
            color: '#fff',
            border: 'none',
            borderRadius: 6,
            cursor: content.trim() ? 'pointer' : 'not-allowed',
            alignSelf: 'flex-end',
            fontSize: 14,
            fontWeight: 600,
            opacity: content.trim() ? 1 : 0.6,
          }}
        >
          Send
        </button>
      </form>
    </div>
  );
};

export default MessageInput;
