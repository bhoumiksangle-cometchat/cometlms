import React, { useRef, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../../lib/apiClient';
import { CourseDiscussion as CourseDiscussionChat } from '../chat/CourseDiscussion';
import { CourseQnA } from './CourseQnA';
import { MessageSquare, HelpCircle, FileText } from 'lucide-react';

interface CourseData {
  id: string;
  title: string;
  cometchatGroupId: string | null;
}

type TabId = 'discussion' | 'qna' | 'notes';

export function CourseDiscussion() {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  // Allow ?tab=qna (or ?tab=discussion) to pre-select a tab on navigation
  const initialTab = (searchParams.get('tab') as TabId | null) ?? 'discussion';
  const [activeTab, setActiveTab] = useState<TabId>(initialTab);

  // ── Notes (localStorage per course) — hooks must be before any early returns ──
  const NOTES_KEY = `lms_notes_${id}`;
  const [notes, setNotes] = useState<string>(() => {
    try { return localStorage.getItem(NOTES_KEY) ?? ''; } catch { return ''; }
  });
  const [notesSaved, setNotesSaved] = useState(true);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleNotesChange = (val: string) => {
    setNotes(val);
    setNotesSaved(false);
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      try { localStorage.setItem(NOTES_KEY, val); } catch { /* quota exceeded */ }
      setNotesSaved(true);
    }, 600);
  };

  const { data: course, isLoading, error } = useQuery({
    queryKey: ['course', id],
    queryFn: async () => {
      const response = await apiClient.get(`/api/courses/${id}`);
      const raw = response?.data ?? response;
      return (raw?.data ?? raw) as CourseData;
    },
    enabled: !!id,
  });

  // Use the cometchatGroupId stored on the course if available, otherwise fall back to
  // the well-known "course-<id>" convention.
  const roomId = course?.cometchatGroupId || `course-${id}`;

  // ── Loading course data ──────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div style={centeredPage}>
        <div style={spinner} />
        <p style={{ color: '#6b7280', marginTop: 16 }}>Loading discussion…</p>
      </div>
    );
  }

  // ── Course fetch failed ──────────────────────────────────────────────────────
  if (error || !course) {
    return (
      <div style={centeredPage}>
        <div style={{ background: '#fef2f2', border: '2px solid #fecaca', borderRadius: 12, padding: 32, textAlign: 'center', maxWidth: 440 }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>⚠️</div>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: '#991b1b', margin: '0 0 8px' }}>Unable to load discussion</h2>
          <p style={{ color: '#dc2626', margin: 0, fontSize: 14 }}>The course could not be found. Please go back and try again.</p>
        </div>
      </div>
    );
  }

  // ── Tabs ─────────────────────────────────────────────────────────────────────
  const tabs: { id: TabId; label: string; icon: React.ReactNode }[] = [
    { id: 'discussion', label: 'Live Discussion', icon: <MessageSquare size={15} /> },
    { id: 'qna',        label: 'Q&A',             icon: <HelpCircle size={15} /> },
    { id: 'notes',      label: 'My Notes',        icon: <FileText size={15} /> },
  ];

  return (
    <div style={{ flex: 1, minHeight: 0, overflow: 'auto', background: '#f9fafb' }}>
      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '28px 16px' }}>

        {/* ── Page header ── */}
        <div style={{ marginBottom: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
            <MessageSquare size={28} color="#10b981" />
            <h1 style={{ margin: 0, fontSize: 26, fontWeight: 700, color: '#111827' }}>
              Course Discussion
            </h1>
          </div>
          <p style={{ color: '#6b7280', margin: 0, fontSize: 14 }}>
            <span style={{ fontWeight: 600, color: '#374151' }}>{course.title}</span>
            {' '}— chat with instructors and fellow students
          </p>
        </div>

        {/* ── Tab bar ── */}
        <div style={{ display: 'flex', borderBottom: '2px solid #e5e7eb', marginBottom: 0 }}>
          {tabs.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 7,
                  padding: '10px 20px',
                  background: 'none',
                  border: 'none',
                  borderBottom: isActive ? '2px solid #10b981' : '2px solid transparent',
                  marginBottom: -2,
                  cursor: 'pointer',
                  fontSize: 14,
                  fontWeight: isActive ? 700 : 400,
                  color: isActive ? '#10b981' : '#6b7280',
                  transition: 'color 0.15s',
                }}
              >
                {tab.icon}
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* ── Tab content container ── */}
        <div
          style={{
            background: '#fff',
            borderRadius: '0 0 16px 16px',
            boxShadow: '0 4px 20px rgba(0,0,0,0.07)',
            overflow: 'hidden',
            height: 'min(calc(100vh - 300px), 600px)',
            minHeight: 400,
          }}
        >
          {/* ── Discussion tab ── */}
          {activeTab === 'discussion' && (
            <CourseDiscussionChat groupId={roomId} />
          )}

          {/* ── Q&A tab ── */}
          {activeTab === 'qna' && (
            <CourseQnA roomId={roomId} />
          )}

          {/* ── Notes tab ── */}
          {activeTab === 'notes' && (
            <div style={{ display: 'flex', flexDirection: 'column', height: '100%', padding: 24, gap: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#111827' }}>Personal Notes</h3>
                  <p style={{ margin: '4px 0 0', fontSize: 12, color: '#6b7280' }}>
                    Notes are saved locally in your browser — only you can see them.
                  </p>
                </div>
                <span style={{
                  fontSize: 12, fontWeight: 600,
                  color: notesSaved ? '#10b981' : '#f59e0b',
                  display: 'flex', alignItems: 'center', gap: 4,
                }}>
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: notesSaved ? '#10b981' : '#f59e0b', display: 'inline-block' }} />
                  {notesSaved ? 'Saved' : 'Saving…'}
                </span>
              </div>

              <textarea
                value={notes}
                onChange={(e) => handleNotesChange((e.target as HTMLTextAreaElement).value)}
                placeholder={'Take notes as you watch the lessons…\n\nMarkdown-friendly — use # headings, - bullet points, and **bold** text.'}
                style={{
                  flex: 1,
                  resize: 'none',
                  border: '1px solid #d1d5db',
                  borderRadius: 8,
                  padding: '14px 16px',
                  fontSize: 14,
                  fontFamily: "'Fira Code', 'Courier New', monospace",
                  lineHeight: 1.7,
                  color: '#111827',
                  outline: 'none',
                  background: '#fafafa',
                }}
                onFocus={(e) => ((e.target as HTMLTextAreaElement).style.borderColor = '#10b981')}
                onBlur={(e)  => ((e.target as HTMLTextAreaElement).style.borderColor = '#d1d5db')}
              />

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12, color: '#9ca3af' }}>
                <span>{notes.length} characters</span>
                <button
                  onClick={() => { if (window.confirm('Clear all notes for this course?')) { handleNotesChange(''); } }}
                  style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: 12, padding: 0 }}
                >
                  Clear notes
                </button>
              </div>
            </div>
          )}
        </div>

        {/* ── Guidelines footer ── */}
        <div style={{ marginTop: 20, background: '#ecfdf5', border: '1px solid #a7f3d0', borderRadius: 12, padding: '16px 20px' }}>
          <h3 style={{ margin: '0 0 10px', fontWeight: 600, color: '#047857', fontSize: 14, display: 'flex', alignItems: 'center', gap: 6 }}>
            💡 Community Guidelines
          </h3>
          <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexWrap: 'wrap', gap: '6px 32px', fontSize: 13, color: '#065f46' }}>
            {[
              'Be respectful and constructive',
              'Use @username to mention someone in chat',
              'Post questions in the Q&A tab for better visibility',
              'Stay on topic and relevant to the course',
            ].map((rule) => (
              <li key={rule} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ color: '#10b981' }}>•</span> {rule}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

// ── Shared style helpers ────────────────────────────────────────────────────

const centeredPage: React.CSSProperties = {
  flex: 1,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  flexDirection: 'column',
  background: '#f9fafb',
};

const spinner: React.CSSProperties = {
  width: 36,
  height: 36,
  border: '3px solid #e5e7eb',
  borderTopColor: '#10b981',
  borderRadius: '50%',
  animation: 'spin 0.9s linear infinite',
};
