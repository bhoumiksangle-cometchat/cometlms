import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../auth/useAuth';
import { apiClient } from '../../lib/apiClient';
import { HelpCircle, ChevronDown, ChevronUp, Send, MessageCircle, RefreshCw } from 'lucide-react';

interface Sender {
  id: string;
  name: string;
  avatarUrl?: string;
  role: string;
}

interface Answer {
  id: string;
  content: string;
  senderId: string;
  sender: Sender;
  createdAt: string;
  roomId: string;
}

interface Question {
  id: string;
  content: string;
  senderId: string;
  sender: Sender;
  createdAt: string;
  roomId: string;
  replies: Answer[];
}

interface CourseQnAProps {
  roomId: string;
}

function getRoleColor(role: string): string {
  if (role === 'INSTRUCTOR') return '#2563eb';
  if (role === 'ADMIN' || role === 'SUPER_ADMIN') return '#dc2626';
  if (role === 'AI_AGENT') return '#7c3aed';
  return '#374151';
}

function getRoleBadge(role: string): string | null {
  if (role === 'INSTRUCTOR') return 'Instructor';
  if (role === 'ADMIN' || role === 'SUPER_ADMIN') return 'Admin';
  if (role === 'AI_AGENT') return 'AI';
  return null;
}

function formatRelativeTime(isoString: string): string {
  const diffMs = Date.now() - new Date(isoString).getTime();
  const mins = Math.floor(diffMs / 60000);
  const hours = Math.floor(mins / 60);
  const days = Math.floor(hours / 24);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  return new Date(isoString).toLocaleDateString();
}

function Avatar({ name, role, size = 32 }: { name: string; role: string; size?: number }) {
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        background: getRoleColor(role),
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#fff',
        fontWeight: 700,
        fontSize: Math.floor(size * 0.4),
        flexShrink: 0,
      }}
    >
      {name?.[0]?.toUpperCase() || '?'}
    </div>
  );
}

export function CourseQnA({ roomId }: CourseQnAProps) {
  const { user } = useAuth();
  const [questions, setQuestions] = useState<Question[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [questionText, setQuestionText] = useState('');
  const [isSubmittingQuestion, setIsSubmittingQuestion] = useState(false);
  const [questionError, setQuestionError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [answerTexts, setAnswerTexts] = useState<Record<string, string>>({});
  const [isSubmittingAnswer, setIsSubmittingAnswer] = useState<Record<string, boolean>>({});
  const [answerErrors, setAnswerErrors] = useState<Record<string, string>>({});

  const loadQuestions = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const response = await apiClient.getQuestions(roomId);
      const data = response?.data ?? response;
      setQuestions(Array.isArray(data) ? data : []);
    } catch (err: any) {
      console.error('[CourseQnA] Failed to load questions:', err);
      setLoadError('Could not load questions. The discussion room may not be set up yet.');
      setQuestions([]);
    } finally {
      setIsLoading(false);
    }
  }, [roomId]);

  useEffect(() => {
    loadQuestions();
  }, [loadQuestions]);

  const handlePostQuestion = async () => {
    const content = questionText.trim();
    if (!content) return;
    setIsSubmittingQuestion(true);
    setQuestionError(null);
    try {
      const response = await apiClient.postQuestion(roomId, content);
      const newQuestion: Question = { ...(response?.data ?? response), replies: [] };
      setQuestions((prev) => [newQuestion, ...prev]);
      setQuestionText('');
    } catch (err: any) {
      setQuestionError(err?.response?.data?.error || 'Failed to post your question. Please try again.');
    } finally {
      setIsSubmittingQuestion(false);
    }
  };

  const handlePostAnswer = async (questionId: string) => {
    const content = (answerTexts[questionId] || '').trim();
    if (!content) return;
    setIsSubmittingAnswer((prev) => ({ ...prev, [questionId]: true }));
    setAnswerErrors((prev) => ({ ...prev, [questionId]: '' }));
    try {
      const response = await apiClient.postAnswer(roomId, questionId, content);
      const newAnswer: Answer = response?.data ?? response;
      setQuestions((prev) =>
        prev.map((q) =>
          q.id === questionId ? { ...q, replies: [...q.replies, newAnswer] } : q,
        ),
      );
      setAnswerTexts((prev) => ({ ...prev, [questionId]: '' }));
    } catch (err: any) {
      setAnswerErrors((prev) => ({
        ...prev,
        [questionId]: err?.response?.data?.error || 'Failed to post answer.',
      }));
    } finally {
      setIsSubmittingAnswer((prev) => ({ ...prev, [questionId]: false }));
    }
  };

  const toggleExpand = (id: string) => {
    setExpandedId((prev) => (prev === id ? null : id));
  };

  // ─── Render ─────────────────────────────────────────────────────────────────

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden', background: '#fff' }}>

      {/* ── Ask a question ── */}
      <div style={{ padding: '20px 20px 16px', borderBottom: '1px solid #e5e7eb', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
          <Avatar name={user?.name || '?'} role={user?.role || 'STUDENT'} size={36} />
          <div style={{ flex: 1 }}>
            <textarea
              value={questionText}
              onChange={(e) => setQuestionText(e.target.value)}
              placeholder="Ask a question about this course… (Ctrl+Enter to post)"
              rows={3}
              style={{
                width: '100%',
                padding: '10px 12px',
                border: '1px solid #d1d5db',
                borderRadius: 8,
                resize: 'none',
                outline: 'none',
                fontSize: 14,
                fontFamily: 'inherit',
                background: '#fff',
                boxSizing: 'border-box',
                transition: 'border-color 0.15s',
              }}
              onFocus={(e) => (e.target.style.borderColor = '#10b981')}
              onBlur={(e) => (e.target.style.borderColor = '#d1d5db')}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handlePostQuestion();
              }}
            />
            {questionError && (
              <p style={{ margin: '4px 0 0', fontSize: 12, color: '#dc2626' }}>{questionError}</p>
            )}
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>
              <button
                onClick={handlePostQuestion}
                disabled={!questionText.trim() || isSubmittingQuestion}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '8px 16px',
                  background: questionText.trim() ? '#10b981' : '#d1d5db',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 6,
                  cursor: questionText.trim() ? 'pointer' : 'not-allowed',
                  fontSize: 13,
                  fontWeight: 600,
                  transition: 'background 0.15s',
                }}
              >
                <HelpCircle size={14} />
                {isSubmittingQuestion ? 'Posting…' : 'Post Question'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ── Questions list ── */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '12px 20px 20px' }}>

        {/* Header row */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: '#374151' }}>
            {isLoading ? 'Loading…' : `${questions.length} question${questions.length !== 1 ? 's' : ''}`}
          </span>
          <button
            onClick={loadQuestions}
            disabled={isLoading}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              padding: '4px 10px',
              background: 'none',
              border: '1px solid #e5e7eb',
              borderRadius: 6,
              cursor: 'pointer',
              fontSize: 12,
              color: '#6b7280',
            }}
          >
            <RefreshCw size={12} style={{ animation: isLoading ? 'spin 1s linear infinite' : 'none' }} />
            Refresh
          </button>
        </div>

        {/* Loading state */}
        {isLoading && (
          <div style={{ textAlign: 'center', color: '#9ca3af', paddingTop: 48 }}>
            <div
              style={{
                width: 28,
                height: 28,
                border: '2px solid #e5e7eb',
                borderTopColor: '#10b981',
                borderRadius: '50%',
                animation: 'spin 1s linear infinite',
                margin: '0 auto 12px',
              }}
            />
            Loading questions…
          </div>
        )}

        {/* Error state */}
        {!isLoading && loadError && (
          <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: 16, textAlign: 'center' }}>
            <p style={{ margin: '0 0 8px', color: '#dc2626', fontSize: 14 }}>{loadError}</p>
            <button
              onClick={loadQuestions}
              style={{ fontSize: 13, color: '#2563eb', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}
            >
              Try again
            </button>
          </div>
        )}

        {/* Empty state */}
        {!isLoading && !loadError && questions.length === 0 && (
          <div style={{ textAlign: 'center', color: '#9ca3af', paddingTop: 60 }}>
            <HelpCircle size={44} style={{ margin: '0 auto 14px', opacity: 0.35 }} />
            <p style={{ margin: '0 0 4px', fontSize: 15, fontWeight: 500, color: '#6b7280' }}>No questions yet</p>
            <p style={{ margin: 0, fontSize: 13 }}>Be the first to ask something above!</p>
          </div>
        )}

        {/* Question cards */}
        {!isLoading && questions.map((question) => {
          const isExpanded = expandedId === question.id;
          const badge = getRoleBadge(question.sender.role);
          const answerCount = question.replies.length;

          return (
            <div
              key={question.id}
              style={{
                marginBottom: 10,
                background: '#fff',
                border: `1px solid ${isExpanded ? '#a7f3d0' : '#e5e7eb'}`,
                borderRadius: 10,
                overflow: 'hidden',
                transition: 'border-color 0.15s, box-shadow 0.15s',
                boxShadow: isExpanded ? '0 2px 8px rgba(16,185,129,0.1)' : 'none',
              }}
            >
              {/* Question row — click to expand */}
              <button
                onClick={() => toggleExpand(question.id)}
                style={{
                  display: 'flex',
                  width: '100%',
                  textAlign: 'left',
                  gap: 12,
                  padding: '14px 16px',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  alignItems: 'flex-start',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = '#f9fafb')}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'none')}
              >
                <Avatar name={question.sender.name} role={question.sender.role} size={32} />

                <div style={{ flex: 1, minWidth: 0 }}>
                  {/* Author + badge + time */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 5, flexWrap: 'wrap' }}>
                    <span style={{ fontWeight: 600, fontSize: 13, color: '#111827' }}>
                      {question.sender.name}
                    </span>
                    {badge && (
                      <span
                        style={{
                          fontSize: 10,
                          fontWeight: 700,
                          padding: '1px 6px',
                          borderRadius: 10,
                          background: getRoleColor(question.sender.role),
                          color: '#fff',
                          letterSpacing: '0.02em',
                        }}
                      >
                        {badge}
                      </span>
                    )}
                    <span style={{ fontSize: 12, color: '#9ca3af', marginLeft: 'auto' }}>
                      {formatRelativeTime(question.createdAt)}
                    </span>
                  </div>

                  {/* Question text */}
                  <p style={{ margin: '0 0 8px', fontSize: 14, color: '#1f2937', lineHeight: 1.55, wordBreak: 'break-word' }}>
                    {question.content}
                  </p>

                  {/* Answer count + toggle label */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 12 }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#6b7280' }}>
                      <MessageCircle size={12} />
                      {answerCount} {answerCount === 1 ? 'answer' : 'answers'}
                    </span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#10b981', fontWeight: 500 }}>
                      {isExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                      {isExpanded ? 'Hide answers' : 'View & answer'}
                    </span>
                  </div>
                </div>
              </button>

              {/* Expanded: answers + answer input */}
              {isExpanded && (
                <div style={{ borderTop: '1px solid #f3f4f6' }}>

                  {/* Existing answers */}
                  {answerCount === 0 ? (
                    <p style={{ margin: 0, padding: '14px 20px', color: '#9ca3af', fontSize: 13, textAlign: 'center' }}>
                      No answers yet — be the first to help!
                    </p>
                  ) : (
                    <div style={{ padding: '12px 20px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                      {question.replies.map((answer) => {
                        const aBadge = getRoleBadge(answer.sender.role);
                        const isInstructor = answer.sender.role === 'INSTRUCTOR';
                        return (
                          <div
                            key={answer.id}
                            style={{
                              display: 'flex',
                              gap: 10,
                              padding: '10px 12px',
                              borderRadius: 8,
                              background: isInstructor ? '#ecfdf5' : '#f9fafb',
                              border: `1px solid ${isInstructor ? '#a7f3d0' : '#e5e7eb'}`,
                            }}
                          >
                            <Avatar name={answer.sender.name} role={answer.sender.role} size={28} />
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4, flexWrap: 'wrap' }}>
                                <span style={{ fontWeight: 600, fontSize: 12, color: '#111827' }}>
                                  {answer.sender.name}
                                </span>
                                {aBadge && (
                                  <span
                                    style={{
                                      fontSize: 9,
                                      fontWeight: 700,
                                      padding: '1px 5px',
                                      borderRadius: 8,
                                      background: getRoleColor(answer.sender.role),
                                      color: '#fff',
                                    }}
                                  >
                                    {aBadge}
                                  </span>
                                )}
                                {isInstructor && (
                                  <span
                                    style={{
                                      fontSize: 9,
                                      fontWeight: 700,
                                      padding: '1px 6px',
                                      borderRadius: 8,
                                      background: '#10b981',
                                      color: '#fff',
                                    }}
                                  >
                                    ✓ Instructor Answer
                                  </span>
                                )}
                                <span style={{ fontSize: 11, color: '#9ca3af', marginLeft: 'auto' }}>
                                  {formatRelativeTime(answer.createdAt)}
                                </span>
                              </div>
                              <p style={{ margin: 0, fontSize: 13, color: '#374151', lineHeight: 1.5, wordBreak: 'break-word' }}>
                                {answer.content}
                              </p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Post answer input */}
                  <div style={{ padding: '0 20px 16px', display: 'flex', gap: 10, alignItems: 'flex-end' }}>
                    <Avatar name={user?.name || '?'} role={user?.role || 'STUDENT'} size={28} />
                    <div style={{ flex: 1 }}>
                      <textarea
                        value={answerTexts[question.id] || ''}
                        onChange={(e) =>
                          setAnswerTexts((prev) => ({ ...prev, [question.id]: e.target.value }))
                        }
                        placeholder="Write your answer… (Ctrl+Enter to post)"
                        rows={2}
                        style={{
                          width: '100%',
                          padding: '8px 10px',
                          border: '1px solid #d1d5db',
                          borderRadius: 6,
                          resize: 'none',
                          outline: 'none',
                          fontSize: 13,
                          fontFamily: 'inherit',
                          background: '#fff',
                          boxSizing: 'border-box',
                        }}
                        onFocus={(e) => (e.target.style.borderColor = '#10b981')}
                        onBlur={(e) => (e.target.style.borderColor = '#d1d5db')}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handlePostAnswer(question.id);
                        }}
                      />
                      {answerErrors[question.id] && (
                        <p style={{ margin: '3px 0 0', fontSize: 11, color: '#dc2626' }}>
                          {answerErrors[question.id]}
                        </p>
                      )}
                    </div>
                    <button
                      onClick={() => handlePostAnswer(question.id)}
                      disabled={!answerTexts[question.id]?.trim() || isSubmittingAnswer[question.id]}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 5,
                        padding: '8px 12px',
                        background: answerTexts[question.id]?.trim() ? '#10b981' : '#d1d5db',
                        color: '#fff',
                        border: 'none',
                        borderRadius: 6,
                        cursor: answerTexts[question.id]?.trim() ? 'pointer' : 'not-allowed',
                        fontSize: 12,
                        fontWeight: 600,
                        flexShrink: 0,
                        alignSelf: 'flex-end',
                        marginBottom: answerErrors[question.id] ? 18 : 0,
                      }}
                    >
                      <Send size={12} />
                      {isSubmittingAnswer[question.id] ? '…' : 'Answer'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
