import React, { useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../../lib/apiClient';
import ChatWindow from '../chat/ChatWindow';
import { useChatContext } from '../chat/useChatContext';
import { MessageSquare } from 'lucide-react';

interface CourseData {
  id: string;
  title: string;
  chatRoomId: string | null;
}

export function CourseDiscussion() {
  const { id } = useParams<{ id: string }>();
  const { socket } = useChatContext();

  const { data: course, isLoading, error } = useQuery({
    queryKey: ['course', id],
    queryFn: async () => {
      const response = await apiClient.get(`/api/courses/${id}`);
      const raw = response?.data ?? response;
      return (raw?.data ?? raw) as CourseData;
    },
    enabled: !!id,
  });

  // Construct the roomId for the course chat
  const roomId = course?.chatRoomId || `course-${id}`;

  if (isLoading) {
    return (
      <div style={{ minHeight: '100vh', background: 'linear-gradient(to bottom, #eff6ff, #f9fafb)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ 
            width: 48, 
            height: 48, 
            border: '3px solid #e5e7eb', 
            borderTopColor: '#10b981', 
            borderRadius: '50%', 
            animation: 'spin 1s linear infinite',
            margin: '0 auto 16px'
          }}></div>
          <p style={{ color: '#6b7280' }}>Loading discussion...</p>
        </div>
      </div>
    );
  }

  if (error || !course) {
    return (
      <div style={{ minHeight: '100vh', background: 'linear-gradient(to bottom, #eff6ff, #f9fafb)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ maxWidth: 448, width: '100%', margin: '0 auto', padding: '0 16px' }}>
          <div style={{ background: '#fef2f2', border: '2px solid #fecaca', borderRadius: 12, padding: 32, textAlign: 'center' }}>
            <div style={{ fontSize: 32, marginBottom: 16 }}>⚠️</div>
            <h2 style={{ fontSize: 20, fontWeight: 700, color: '#991b1b', marginBottom: 8 }}>Unable to load discussion</h2>
            <p style={{ color: '#dc2626', margin: 0 }}>The course discussion is temporarily unavailable.</p>
          </div>
        </div>
      </div>
    );
  }

  if (!socket) {
    return (
      <div style={{ minHeight: '100vh', background: 'linear-gradient(to bottom, #eff6ff, #f9fafb)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ maxWidth: 448, width: '100%', margin: '0 auto', padding: '0 16px' }}>
          <div style={{ background: '#fffbeb', border: '2px solid #fcd34d', borderRadius: 12, padding: 32, textAlign: 'center' }}>
            <MessageSquare style={{ width: 64, height: 64, margin: '0 auto 16px', color: '#d97706' }} />
            <h2 style={{ fontSize: 20, fontWeight: 700, color: '#92400e', marginBottom: 8 }}>Connection Required</h2>
            <p style={{ color: '#b45309', margin: 0 }}>Please log in to join the course discussion.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: '#f9fafb' }}>
      <div style={{ maxWidth: 1152, margin: '0 auto', padding: '32px 16px' }}>
        {/* Page Header */}
        <div style={{ marginBottom: 32 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
            <MessageSquare style={{ width: 32, height: 32, color: '#10b981' }} />
            <h1 style={{ margin: 0, fontSize: 30, fontWeight: 700, color: '#111827' }}>Course Discussion</h1>
          </div>
          <p style={{ color: '#6b7280', margin: 0 }}>
            Discuss <span style={{ fontWeight: 600 }}>{course.title}</span> with instructors and fellow students
          </p>
        </div>

        {/* Chat Window Container */}
        <div style={{ background: '#fff', borderRadius: 16, boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)', overflow: 'hidden', height: 'calc(100vh - 250px)', minHeight: 500 }}>
          <ChatWindow 
            roomId={roomId}
            roomName={`${course.title} - Discussion`}
          />
        </div>

        {/* Discussion Guidelines */}
        <div style={{ marginTop: 24, background: '#ecfdf5', border: '1px solid #a7f3d0', borderRadius: 12, padding: 24 }}>
          <h3 style={{ fontWeight: 600, color: '#047857', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8, fontSize: 16 }}>
            <span style={{ fontSize: 20 }}>💡</span>
            Discussion Guidelines
          </h3>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0, fontSize: 14, color: '#065f46' }}>
            <li style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 8 }}>
              <span style={{ color: '#10b981', marginTop: 2 }}>•</span>
              <span>Be respectful and professional in all communications</span>
            </li>
            <li style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 8 }}>
              <span style={{ color: '#10b981', marginTop: 2 }}>•</span>
              <span>Use <span style={{ fontFamily: 'monospace', background: '#d1fae5', padding: '2px 4px', borderRadius: 4 }}>@username</span> to mention specific users</span>
            </li>
            <li style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 8 }}>
              <span style={{ color: '#10b981', marginTop: 2 }}>•</span>
              <span>Stay on topic and keep discussions relevant to the course</span>
            </li>
            <li style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
              <span style={{ color: '#10b981', marginTop: 2 }}>•</span>
              <span>Search for existing questions before posting</span>
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}
