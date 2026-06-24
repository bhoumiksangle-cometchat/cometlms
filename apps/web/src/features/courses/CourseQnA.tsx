import React from 'react';
import { CourseDiscussion } from '../chat/CourseDiscussion';
import { HelpCircle } from 'lucide-react';

interface CourseQnAProps {
  roomId: string;
}

/**
 * Course Q&A tab — now powered by CometChat threaded messages.
 * Uses the same course discussion group; students can use "Reply in Thread"
 * to keep Q&A organized within the group conversation.
 */
export function CourseQnA({ roomId }: CourseQnAProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Info banner */}
      <div
        style={{
          padding: '12px 20px',
          background: '#f0f9ff',
          borderBottom: '1px solid #bae6fd',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          fontSize: 13,
          color: '#0369a1',
        }}
      >
        <HelpCircle size={16} />
        <span>
          Ask questions in the discussion below. Use <strong>Reply in Thread</strong> to keep Q&A organized.
        </span>
      </div>

      {/* CometChat discussion (same group, threaded replies enabled) */}
      <div style={{ flex: 1, minHeight: 0 }}>
        <CourseDiscussion groupId={roomId} />
      </div>
    </div>
  );
}
