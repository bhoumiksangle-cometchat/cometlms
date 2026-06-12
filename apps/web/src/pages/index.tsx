import { FormEvent, useEffect, useMemo, useState, useCallback } from 'react';
import { Routes, Route, useNavigate, Navigate } from 'react-router-dom';
import { LoginPage, RegisterPage } from '../features/auth/AuthPages';
import { useAuth } from '../features/auth/useAuth';
import {
  Bell,
  Bot,
  CheckCircle2,
  Clock3,
  GraduationCap,
  LayoutDashboard,
  MessageSquare,
  Mic,
  MonitorUp,
  Phone,
  PhoneCall,
  PlayCircle,
  Search,
  ShieldAlert,
  Sparkles,
  Users,
  Video,
} from 'lucide-react';
import { useAppStore, type WorkspaceView } from '../stores';
import { CourseList, CourseDetail, LessonViewer, CourseDiscussion as CourseDiscussionPage } from '../features/courses';
import CreateCourse from '../features/courses/CreateCourse';
import DirectMessagesPage from '../features/chat/DirectMessagesPage';
import { DiagnosticPage } from './DiagnosticPage';
import ChatWindow from '../features/chat/ChatWindow';
import { apiClient } from '../lib/apiClient';
import { DevBypass } from '../components/DevBypass';
import { useCallManager } from '../features/chat/CallManager';
import { NotificationPrompt } from '../components/NotificationPrompt';

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';

const courses = [
  {
    id: 'course-react-foundations',
    title: 'React Foundations for Product Teams',
    instructor: 'Maya Chen',
    progress: 64,
    students: 1824,
    unread: 7,
    engagement: 92,
    live: true,
  },
  {
    id: 'course-node-api',
    title: 'Production Node.js APIs',
    instructor: 'Arjun Mehta',
    progress: 38,
    students: 1402,
    unread: 3,
    engagement: 86,
    live: false,
  },
];

const messages = [
  { sender: 'Maya Chen', role: 'Instructor', body: 'I pinned a new thread for lesson 4 debugging questions.', time: '09:24' },
  { sender: 'Iris', role: 'Student', body: '@FAQBot can you compare controlled and uncontrolled forms?', time: '09:31' },
  { sender: 'FAQ Bot', role: 'AI Agent', body: 'Controlled forms keep state in React, while uncontrolled forms read from the DOM when needed.', time: '09:31' },
];

const flags = [
  { reason: 'External link policy', sender: 'Guest learner', room: 'React Foundations', status: 'Pending' },
  { reason: 'Spam pattern', sender: 'Trial account', room: 'Node APIs', status: 'Pending' },
];

export function App() {
  const { isAuthenticated } = useAuth();

  return (
    <>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/" element={<RoleGuard roles={['STUDENT', 'INSTRUCTOR', 'ADMIN', 'SUPER_ADMIN']}><AppLayout><DashboardSwitcher /></AppLayout></RoleGuard>} />
        <Route path="/student" element={<RoleGuard roles={['STUDENT']}><AppLayout><StudentDashboard onNotice={() => {}} /></AppLayout></RoleGuard>} />
        <Route path="/instructor" element={<RoleGuard roles={['INSTRUCTOR']}><AppLayout><InstructorDashboard onNotice={() => {}} /></AppLayout></RoleGuard>} />
        <Route path="/admin" element={<RoleGuard roles={['ADMIN','SUPER_ADMIN']}><AppLayout><AdminDashboard onNotice={() => {}} /></AppLayout></RoleGuard>} />
        <Route path="/courses" element={isAuthenticated ? <AppLayout><CourseList /></AppLayout> : <Navigate to='/login' replace />} />
        <Route path="/courses/create" element={isAuthenticated ? <AppLayout><CreateCourse /></AppLayout> : <Navigate to='/login' replace />} />
        <Route path="/messages" element={isAuthenticated ? <AppLayout><DirectMessagesPage /></AppLayout> : <Navigate to='/login' replace />} />
        <Route path="/courses/:id" element={isAuthenticated ? <AppLayout><CourseDetail /></AppLayout> : <Navigate to='/login' replace />} />
        <Route path="/courses/:id/discussion" element={isAuthenticated ? <AppLayout><CourseDiscussionPage /></AppLayout> : <Navigate to='/login' replace />} />
        <Route path="/courses/:courseId/sections/:sectionId/lessons/:lessonId" element={isAuthenticated ? <AppLayout><LessonViewer /></AppLayout> : <Navigate to='/login' replace />} />
        <Route path="/diagnostic" element={<DiagnosticPage />} />
      </Routes>
      <DevBypass />
      {isAuthenticated && <NotificationPrompt />}
    </>
  );
}

function RoleGuard({ roles, children }: { roles: string[]; children: React.ReactElement }) {
  const { user, isAuthenticated } = useAuth();

  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (!user || !roles.includes(user.role)) return <Navigate to="/" replace />;

  return children;
}

function DashboardSwitcher() {
  const { user } = useAuth();
  const [notice, setNotice] = useState('Backend not checked yet');

  if (user?.role === 'STUDENT') return <StudentDashboard onNotice={setNotice} />;
  if (user?.role === 'INSTRUCTOR') return <InstructorDashboard onNotice={setNotice} />;
  if (user?.role === 'ADMIN' || user?.role === 'SUPER_ADMIN') return <AdminDashboard onNotice={setNotice} />;
  return null;
}

function AppLayout({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const activeCourse = courses[0];
  const [notice, setNotice] = useState('Backend not checked yet');
  const [showNotificationStatus, setShowNotificationStatus] = useState(false);
  const { startCall } = useCallManager();

  const handleNotificationClick = async () => {
    const permission = notificationService.getPermissionStatus();
    
    if (permission === 'granted') {
      // Show a test notification
      notificationService.show({
        title: 'Test Notification',
        body: 'Notifications are working! You\'ll receive alerts for new messages.',
      });
      setNotice('Test notification sent');
    } else if (permission === 'default') {
      // Request permission
      const result = await notificationService.requestPermission();
      if (result === 'granted') {
        notificationService.show({
          title: 'Notifications Enabled! 🎉',
          body: 'You will now receive notifications for messages and mentions',
        });
        setNotice('Notifications enabled');
      } else {
        setNotice('Notification permission denied');
      }
    } else {
      setNotice('Notifications are blocked. Please enable them in your browser settings.');
    }
  };

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <div className="brand cursor-pointer" onClick={() => navigate('/')}>
          <GraduationCap aria-hidden />
          <span>LearnLoop</span>
        </div>
        <nav className="nav-list" aria-label="Workspace">
          <button className="nav-button" onClick={() => navigate('/courses')}>
            <GraduationCap />
            <span>Courses</span>
          </button>
          <button className="nav-button" onClick={() => navigate('/messages')}>
            <MessageSquare />
            <span>Messages</span>
          </button>
        </nav>
        <div className="sidebar-card">
          <span className="eyebrow">Live office hours</span>
          <strong>React Foundations</strong>
          <p>23 students waiting, recording enabled.</p>
          <button className="icon-button" aria-label="Join live session" title="Join live session">
            <Video aria-hidden />
          </button>
        </div>
      </aside>

      <section className="workspace">
        <header className="topbar">
          <div>
            <span className="eyebrow">{user?.role?.toLowerCase()} workspace</span>
            <h1>{user?.role === 'ADMIN' ? 'Moderation Command Center' : activeCourse.title}</h1>
          </div>
          <div className="topbar-actions">
            <div className="search">
              <Search aria-hidden />
              <input aria-label="Search" placeholder="Search courses, learners, messages" />
            </div>
            <button 
              className="icon-button" 
              aria-label="Notifications" 
              title="Manage notifications"
              onClick={handleNotificationClick}
              onMouseEnter={() => setShowNotificationStatus(true)}
              onMouseLeave={() => setShowNotificationStatus(false)}
              style={{ position: 'relative' }}
            >
              <Bell aria-hidden />
              {showNotificationStatus && notificationService.getPermissionStatus() === 'granted' && (
                <span style={{
                  position: 'absolute',
                  top: -4,
                  right: -4,
                  width: 12,
                  height: 12,
                  background: '#10b981',
                  borderRadius: '50%',
                  border: '2px solid #fff'
                }} />
              )}
            </button>
          </div>
        </header>
        <div className="notice-bar" role="status">{notice}</div>
        
        {children}
      </section>
    </main>
  );
}

function NavButton(props: { icon: React.ReactNode; label: WorkspaceView | 'Student' | 'Instructor' | 'Admin'; active: boolean; onClick: () => void }) {
  return (
    <button className={`nav-button ${props.active ? 'active' : ''}`} onClick={props.onClick}>
      {props.icon}
      <span>{props.label}</span>
    </button>
  );
}

function StudentDashboard({ onNotice }: { onNotice: (message: string) => void }) {
  return (
    <div className="content-grid">
      <section className="primary-panel">
        <LiveBanner onNotice={onNotice} />
        <CoursePlayer />
      </section>
      <aside className="stack">
        <AiStudyAssistant onNotice={onNotice} />
        <DirectMessages />
      </aside>
    </div>
  );
}

function InstructorDashboard({ onNotice }: { onNotice: (message: string) => void }) {
  return (
    <div className="content-grid">
      <section className="primary-panel">
        <KpiRow />
        <QAManager />
        <DiscussionManager onNotice={onNotice} />
      </section>
      <aside className="stack">
        <OfficeHours onNotice={onNotice} />
        <InstructorCopilot onNotice={onNotice} />
        <DirectMessages />
      </aside>
    </div>
  );
}

function AdminDashboard({ onNotice }: { onNotice: (message: string) => void }) {
  return (
    <div className="content-grid">
      <section className="primary-panel">
        <KpiRow />
        <ModerationQueue onNotice={onNotice} />
        <ActivityLog />
      </section>
      <aside className="stack">
        <AgentConfig onNotice={onNotice} />
        <CourseProgress />
      </aside>
    </div>
  );
}

function AuthPanel({ onNotice }: { onNotice: (message: string) => void }) {
  const [email, setEmail] = useState(`student-${Date.now()}@learnloop.test`);
  const [password, setPassword] = useState('Password1');
  const [token, setToken] = useState('');

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const response = await fetch(`${API_URL}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, name: 'Demo Learner' }),
    });
    const result = await response.json();

    if (!response.ok) {
      onNotice(`Register failed: ${result.error ?? 'unknown error'}`);
      return;
    }

    setToken(result.data.tokens.accessToken);
    onNotice(`Registered ${result.data.user.email}`);
  }

  async function verifyMe() {
    if (!token) {
      onNotice('Register first, then verify /me');
      return;
    }

    const response = await fetch(`${API_URL}/api/auth/me`, { headers: { Authorization: `Bearer ${token}` } });
    const result = await response.json();
    onNotice(response.ok ? `/me verified as ${result.data.email}` : `/me failed: ${result.error}`);
  }

  return (
    <form className="auth-panel" onSubmit={submit}>
      <input aria-label="Auth email" value={email} onChange={(event) => setEmail(event.target.value)} />
      <input aria-label="Auth password" value={password} onChange={(event) => setPassword(event.target.value)} />
      <button type="submit">Register</button>
      <button type="button" onClick={verifyMe}>Verify /me</button>
    </form>
  );
}

function LiveBanner({ onNotice }: { onNotice: (message: string) => void }) {
  return (
    <div className="live-banner">
      <div>
        <span className="eyebrow">Instructor is live</span>
        <strong>Office hours are open for lesson 4 questions.</strong>
      </div>
      <div className="button-row">
        <button className="icon-button" aria-label="Join video" title="Join video" onClick={() => onNotice('Joined video office hours')}>
          <Video aria-hidden />
        </button>
        <button className="icon-button" aria-label="Join audio" title="Join audio" onClick={() => onNotice('Joined audio office hours')}>
          <Mic aria-hidden />
        </button>
      </div>
    </div>
  );
}

function CoursePlayer() {
  const [tab, setTab] = useState<'video' | 'discussion' | 'qa'>('video');
  const [currentLesson, setCurrentLesson] = useState(0);

  // Sample lessons with YouTube video IDs
  const lessons = [
    {
      id: 1,
      title: 'Introduction to React',
      videoId: 'Tn6-PIqc4UM', // React in 100 Seconds
      duration: '2:10',
      description: 'Learn the fundamentals of React and component-based architecture'
    },
    {
      id: 2,
      title: 'React Hooks Deep Dive',
      videoId: 'TNhaISOUy6Q', // React Hooks
      duration: '14:27',
      description: 'Master useState, useEffect, and custom hooks'
    },
    {
      id: 3,
      title: 'State Management',
      videoId: 'O6P86uwfdR0', // State Management
      duration: '8:53',
      description: 'Understand state management patterns in React'
    },
    {
      id: 4,
      title: 'Forms and Validation',
      videoId: 'IkMND33x0qQ', // React Forms
      duration: '12:35',
      description: 'Build forms with validation and error handling'
    }
  ];

  const lesson = lessons[currentLesson];

  return (
    <section className="panel">
      {/* Video Player */}
      <div style={{ position: 'relative', paddingBottom: '56.25%', height: 0, overflow: 'hidden', background: '#000', borderRadius: '8px 8px 0 0' }}>
        <iframe
          src={`https://www.youtube.com/embed/${lesson.videoId}?rel=0&modestbranding=1`}
          title={lesson.title}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            border: 'none'
          }}
        />
      </div>

      {/* Lesson Info */}
      <div style={{ padding: '16px', borderBottom: '1px solid #e5e7eb' }}>
        <h3 style={{ margin: '0 0 8px 0', fontSize: '18px', fontWeight: 700, color: '#111827' }}>
          Lesson {lesson.id}. {lesson.title}
        </h3>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, fontSize: '14px', color: '#6b7280' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Clock3 size={16} />
            {lesson.duration}
          </span>
          <span>{lesson.description}</span>
        </div>
      </div>

      {/* Lesson Selector */}
      <div style={{ padding: '12px 16px', background: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
        <div style={{ fontSize: '12px', fontWeight: 600, color: '#6b7280', marginBottom: 8 }}>COURSE CONTENT</div>
        <div style={{ display: 'flex', gap: 8, overflowX: 'auto' }}>
          {lessons.map((l, idx) => (
            <button
              key={l.id}
              onClick={() => setCurrentLesson(idx)}
              style={{
                padding: '8px 16px',
                borderRadius: 8,
                border: 'none',
                background: currentLesson === idx ? '#10b981' : '#fff',
                color: currentLesson === idx ? '#fff' : '#374151',
                fontSize: 13,
                fontWeight: 600,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                boxShadow: currentLesson === idx ? 'none' : '0 1px 3px rgba(0,0,0,0.1)',
                transition: 'all 0.2s'
              }}
              onMouseEnter={(e) => {
                if (currentLesson !== idx) {
                  e.currentTarget.style.background = '#f3f4f6';
                }
              }}
              onMouseLeave={(e) => {
                if (currentLesson !== idx) {
                  e.currentTarget.style.background = '#fff';
                }
              }}
            >
              Lesson {l.id}
            </button>
          ))}
        </div>
      </div>

      {/* Tabs */}
      <div className="tabs" role="tablist">
        {(['video', 'discussion', 'qa'] as const).map((item) => (
          <button key={item} className={tab === item ? 'selected' : ''} onClick={() => setTab(item)}>
            {item === 'video' ? 'Notes' : item}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {tab === 'video' && (
        <div style={{ padding: 16 }}>
          <h4 style={{ margin: '0 0 12px 0', fontSize: 16, fontWeight: 600, color: '#111827' }}>Lesson Notes</h4>
          <div style={{ fontSize: 14, color: '#4b5563', lineHeight: 1.6 }}>
            <p style={{ marginBottom: 12 }}>
              <strong>Key Concepts:</strong>
            </p>
            <ul style={{ marginLeft: 20, marginBottom: 16 }}>
              <li>Component-based architecture</li>
              <li>JSX syntax and rendering</li>
              <li>Props and state management</li>
              <li>Event handling in React</li>
            </ul>
            <p style={{ marginBottom: 12 }}>
              <strong>Practice Exercise:</strong>
            </p>
            <p style={{ padding: 12, background: '#f0fdf4', borderLeft: '3px solid #10b981', borderRadius: 4, fontSize: 13 }}>
              Build a simple counter component that increments and decrements a value. Use the useState hook to manage the counter state.
            </p>
          </div>
        </div>
      )}
      {tab === 'discussion' && <CourseDiscussion />}
      {tab === 'qa' && <QAManager compact />}
    </section>
  );
}

function CourseDiscussion() {
  const { activeCourseId } = useAppStore();
  const roomId = `course-${activeCourseId}`;
  
  return (
    <div style={{ height: '450px' }}>
      <ChatWindow roomId={roomId} roomName="Course Discussion Group" />
    </div>
  );
}

function CourseProgress() {
  return (
    <section className="panel">
      <div className="panel-title">
        <CheckCircle2 aria-hidden />
        <h2>My Courses</h2>
      </div>
      {courses.map((course) => (
        <article className="course-row" key={course.id}>
          <div>
            <strong>{course.title}</strong>
            <span>{course.instructor}</span>
          </div>
          <meter value={course.progress} min="0" max="100" />
        </article>
      ))}
    </section>
  );
}

function AiStudyAssistant({ onNotice }: { onNotice: (message: string) => void }) {
  const [messages, setMessages] = useState<Array<{ sender: 'user' | 'assistant'; text: string }>>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [typingText, setTypingText] = useState('');

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userText = input.trim();
    setInput('');
    setMessages((prev) => [...prev, { sender: 'user', text: userText }]);
    setIsLoading(true);

    try {
      const response = await apiClient.post('/api/chat/agents/message', {
        prompt: userText,
        courseName: 'React Foundations',
      });

      if (response.success && response.data) {
        const replyText = response.data.content;
        
        let currentText = '';
        setTypingText('');
        
        for (let i = 0; i < replyText.length; i++) {
          await new Promise((resolve) => setTimeout(resolve, 10));
          currentText += replyText[i];
          setTypingText(currentText);
        }
        
        setMessages((prev) => [...prev, { sender: 'assistant', text: replyText }]);
        setTypingText('');
      } else {
        throw new Error(response.error || 'Failed to get AI response');
      }
    } catch (err: any) {
      onNotice(`AI Tutor error: ${err.message || 'Server error'}`);
      setMessages((prev) => [...prev, { sender: 'assistant', text: 'Sorry, I encountered an error. Please try again later.' }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <section className="panel accent-panel">
      <div className="panel-title">
        <Bot aria-hidden />
        <h2>AI Study Assistant</h2>
      </div>
      <p>Ask questions about course material, code, and concepts.</p>
      
      {messages.length > 0 && (
        <div className="chat-history space-y-2 mb-4 max-h-[250px] overflow-y-auto border-t border-b py-2 text-sm">
          {messages.map((m, idx) => (
            <div key={idx} style={{ margin: '8px 0', padding: '8px', borderRadius: '8px', backgroundColor: m.sender === 'user' ? '#e8f5e9' : '#f5f5f5', textAlign: m.sender === 'user' ? 'right' : 'left' }}>
              <strong>{m.sender === 'user' ? 'You' : 'Assistant'}:</strong> {m.text}
            </div>
          ))}
          {typingText && (
            <div style={{ margin: '8px 0', padding: '8px', borderRadius: '8px', backgroundColor: '#f5f5f5', textAlign: 'left' }}>
              <strong>Assistant:</strong> {typingText}
            </div>
          )}
        </div>
      )}

      <form onSubmit={handleSend} className="composer flex gap-2">
        <input 
          aria-label="Ask AI Study Assistant" 
          value={input} 
          onChange={(event) => setInput(event.target.value)} 
          placeholder="Ask a question..."
          className="flex-1 border rounded p-2 text-sm"
          disabled={isLoading}
        />
        <button type="submit" className="send-button text-sm" disabled={isLoading || !input.trim()}>
          {isLoading ? 'Thinking...' : 'Ask'}
        </button>
      </form>
    </section>
  );
}

function DirectMessages() {
  const [conversations, setConversations] = useState<any[]>([]);
  const { user: currentUser } = useAuth();
  const navigate = useNavigate();
  const { startCall } = useCallManager();

  useEffect(() => {
    apiClient.getConversations()
      .then((response) => {
        if (response.success && response.data) {
          setConversations(response.data);
        }
      })
      .catch(() => {});
  }, []);

  return (
    <section className="panel">
      <div className="panel-title">
        <MessageSquare aria-hidden />
        <h2>Direct Messages</h2>
      </div>
      {conversations.length === 0 ? (
        <p className="muted">No direct message conversations yet.</p>
      ) : (
        conversations.map((conversation) => {
          const other = conversation.members?.find((m: any) => m.user?.id !== currentUser?.id)?.user;
          return (
            <article 
              className="dm-row" 
              key={conversation.id}
              style={{ cursor: 'pointer', justifyContent: 'space-between' }}
            >
              <div
                style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, cursor: 'pointer' }}
                onClick={() => {
                  localStorage.setItem('dm:selected-room', conversation.roomId);
                  navigate('/messages');
                }}
              >
                <div className="avatar">{other?.name?.[0] ?? 'D'}</div>
                <div style={{ marginLeft: 4 }}>
                  <strong>{other?.name ?? conversation.name}</strong>
                  <span style={{ display: 'block', fontSize: '12px' }}>Direct message</span>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                <button
                  className="icon-button"
                  title="Voice call"
                  onClick={() => other && startCall(other.id, other.name, 'voice')}
                  style={{ width: 32, height: 32 }}
                >
                  <Phone aria-hidden style={{ width: 14, height: 14 }} />
                </button>
                <button
                  className="icon-button"
                  title="Video call"
                  onClick={() => other && startCall(other.id, other.name, 'video')}
                  style={{ width: 32, height: 32 }}
                >
                  <Video aria-hidden style={{ width: 14, height: 14 }} />
                </button>
              </div>
            </article>
          );
        })
      )}
      <button
        className="wide-button"
        style={{ marginTop: 10 }}
        onClick={() => navigate('/messages')}
      >
        <MessageSquare aria-hidden />
        Open Messages
      </button>
    </section>
  );
}

function KpiRow() {
  const [stats, setStats] = useState<any>(null);

  useEffect(() => {
    apiClient.get('/api/admin/stats')
      .then((res) => {
        if (res.success && res.data) {
          setStats(res.data);
        }
      })
      .catch(() => {});
  }, []);

  const items = useMemo(() => {
    if (!stats) {
      return [
        ['Active learners', '...'],
        ['Messages today', '...'],
        ['Open flags', '...'],
        ['Engagement', '...'],
      ];
    }
    return [
      ['Active learners', stats.activeUsers?.toString() || '0'],
      ['Messages today', stats.messagesToday?.toString() || '0'],
      ['Open flags', stats.pendingFlags?.toString() || '0'],
      ['Engagement', `${stats.engagementScore || 0}%`],
    ];
  }, [stats]);

  return (
    <div className="kpi-grid">
      {items.map(([label, value]) => (
        <article className="kpi" key={label}>
          <span>{label}</span>
          <strong>{value}</strong>
        </article>
      ))}
    </div>
  );
}

function QAManager({ compact = false }: { compact?: boolean }) {
  return (
    <section className="panel">
      <div className="panel-title">
        <MessageSquare aria-hidden />
        <h2>Q&A Manager</h2>
      </div>
      <article className="question-card">
        <span className="status-pill">Needs instructor</span>
        <strong>When should I use React Hook Form with Zod?</strong>
        {!compact && <p>AI smart reply suggests validating at the form boundary and reusing schemas with API requests.</p>}
      </article>
    </section>
  );
}

function DiscussionManager({ onNotice }: { onNotice: (message: string) => void }) {
  return (
    <section className="panel">
      <div className="panel-title">
        <Users aria-hidden />
        <h2>Discussion Manager</h2>
      </div>
      <div className="split-row">
        <span>Pin announcement</span>
        <button onClick={() => onNotice('Announcement pinned to course discussion')}>Publish</button>
      </div>
      <div className="split-row">
        <span>Mention enrolled learners</span>
        <button onClick={() => onNotice('@all mention queued for enrolled learners')}>@all</button>
      </div>
    </section>
  );
}

function OfficeHours({ onNotice }: { onNotice: (message: string) => void }) {
  return (
    <section className="panel">
      <div className="panel-title">
        <Video aria-hidden />
        <h2>Office Hours</h2>
      </div>
      <p>Start a room, notify enrolled students, and attach the recording after the session.</p>
      <button className="wide-button" onClick={() => onNotice('Office hours session started and students notified')}>Start session</button>
    </section>
  );
}

function InstructorCopilot({ onNotice }: { onNotice: (message: string) => void }) {
  const [summary, setSummary] = useState('');
  const [suggestion, setSuggestion] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { activeCourseId } = useAppStore();

  const handleSummarize = async () => {
    setIsLoading(true);
    setSummary('');
    setSuggestion('');
    
    try {
      const roomId = `course-${activeCourseId}`;
      const response = await apiClient.post('/api/chat/agents/summarize', {
        roomId,
      });

      if (response.success && response.data) {
        setSummary(response.data.summary);
        onNotice('Thread summary generated');
        
        // Draft reply suggestion
        const replyResponse = await apiClient.post('/api/chat/agents/message', {
          prompt: `Draft a friendly instructor response to the issues raised in this summary: ${response.data.summary}`,
          courseName: 'React Foundations',
        });
        
        if (replyResponse.success && replyResponse.data) {
          setSuggestion(replyResponse.data.content);
        }
      } else {
        throw new Error(response.error || 'Failed to summarize');
      }
    } catch (err: any) {
      onNotice(`Copilot error: ${err.message || 'Server error'}`);
      setSummary('Summary could not be generated. Please make sure the backend is active.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <section className="panel">
      <div className="panel-title">
        <Sparkles aria-hidden />
        <h2>Instructor AI Copilot</h2>
      </div>
      <p>Summarize long threads and draft replies for review before posting.</p>
      
      {summary && (
        <div style={{ marginTop: '12px', padding: '12px', backgroundColor: '#f9f9f9', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '13px' }}>
          <div style={{ marginBottom: '8px' }}>
            <strong>Discussion Summary:</strong>
            <p style={{ color: '#4a5568', marginTop: '4px' }}>{summary}</p>
          </div>
          {suggestion && (
            <div style={{ paddingTop: '8px', borderTop: '1px solid #e2e8f0' }}>
              <strong>Suggested Instructor Reply:</strong>
              <p style={{ color: '#047857', fontStyle: 'italic', marginTop: '4px' }}>{suggestion}</p>
            </div>
          )}
        </div>
      )}
      
      <button 
        className="wide-button" 
        style={{ marginTop: '12px' }}
        onClick={handleSummarize}
        disabled={isLoading}
      >
        <Sparkles aria-hidden />
        {isLoading ? 'Processing thread...' : 'Summarize discussion'}
      </button>
    </section>
  );
}

function ModerationQueue({ onNotice }: { onNotice: (message: string) => void }) {
  const [items, setItems] = useState(flags);
  return (
    <section className="panel">
      <div className="panel-title">
        <ShieldAlert aria-hidden />
        <h2>Moderation Queue</h2>
      </div>
      {items.map((flag) => (
        <article className="flag-row" key={`${flag.sender}-${flag.reason}`}>
          <div>
            <strong>{flag.reason}</strong>
            <span>{flag.sender} in {flag.room}</span>
          </div>
          <div className="button-row">
            <button onClick={() => {
              setItems((current) => current.filter((item) => item !== flag));
              onNotice(`Dismissed ${flag.reason}`);
            }}>Dismiss</button>
            <button onClick={() => {
              setItems((current) => current.filter((item) => item !== flag));
              onNotice(`Banned ${flag.sender}`);
            }}>Ban</button>
          </div>
        </article>
      ))}
    </section>
  );
}

function ActivityLog() {
  return (
    <section className="panel">
      <div className="panel-title">
        <Clock3 aria-hidden />
        <h2>Activity Event Log</h2>
      </div>
      {['message:sent processed', 'moderation:flagged queued', 'group:member_joined processed'].map((event) => (
        <div className="event-row" key={event}>{event}</div>
      ))}
    </section>
  );
}

function AgentConfig({ onNotice }: { onNotice: (message: string) => void }) {
  const [agents, setAgents] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchAgents = useCallback(async () => {
    try {
      const response = await apiClient.get('/api/admin/agents');
      if (response.success && response.data) {
        const uniqueAgents = response.data.filter((agent: any, index: number, arr: any[]) => index === arr.findIndex((a) => (a.agentType === agent.agentType && (a.courseId || 'global') === (agent.courseId || 'global'))));
        setAgents(uniqueAgents);
      }
    } catch (err: any) {
      onNotice(`Failed to load agents: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  }, [onNotice]);

  useEffect(() => {
    fetchAgents();
  }, [fetchAgents]);

  const handleUpdate = async (id: string, updates: any) => {
    try {
      const response = await apiClient.patch(`/api/admin/agents/${id}`, updates);
      if (response.success) {
        onNotice('AI agent configuration updated successfully');
        setAgents((prev) => prev.map((agent) => (agent.id === id ? { ...agent, ...updates } : agent)));
      } else {
        throw new Error(response.error);
      }
    } catch (err: any) {
      onNotice(`Update failed: ${err.message}`);
    }
  };

  if (isLoading) {
    return (
      <section className="panel">
        <p>Loading agent configs...</p>
      </section>
    );
  }

  return (
    <section className="panel">
      <div className="panel-title">
        <Bot aria-hidden />
        <h2>AI Agent Configuration</h2>
      </div>
      <p className="muted" style={{ marginBottom: '16px' }}>Manage LLM parameters, model providers, and prompts for course bots.</p>
      
      {agents.length === 0 ? (
        <p className="muted">No agents configured in database. Run seed script first.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {agents.map((agent) => (
            <div key={agent.id} style={{ borderBottom: '1px solid #e4ebe8', paddingBottom: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'between', alignItems: 'center', marginBottom: '8px' }}>
                <div>
                  <strong style={{ fontSize: '14px', color: '#1a202c' }}>{agent.botUser?.name || agent.agentType}</strong>
                  <span style={{ display: 'block', fontSize: '11px', color: '#718096' }}>Course: {agent.course?.title || 'Global'}</span>
                </div>
                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', marginLeft: 'auto', cursor: 'pointer' }}>
                  <span>{agent.isEnabled ? 'Enabled' : 'Disabled'}</span>
                  <input
                    type="checkbox"
                    checked={agent.isEnabled}
                    onChange={(e) => handleUpdate(agent.id, { isEnabled: e.target.checked })}
                    aria-label={`${agent.botUser?.name} enabled`}
                  />
                </label>
              </div>

              {agent.isEnabled && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', backgroundColor: '#f7faf8', padding: '12px', borderRadius: '8px', border: '1px solid #dce5e1', fontSize: '12px', marginTop: '6px' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                    <div>
                      <label style={{ display: 'block', color: '#4a5568', fontWeight: 'bold', marginBottom: '2px' }}>Provider</label>
                      <select
                        value={agent.provider}
                        onChange={(e) => handleUpdate(agent.id, { provider: e.target.value })}
                        style={{ width: '100%', border: '1px solid #c8d6d0', borderRadius: '6px', padding: '4px' }}
                      >
                        <option value="OPENAI">OpenAI</option>
                        <option value="LANGCHAIN">Groq</option>
                      </select>
                    </div>
                    <div>
                      <label style={{ display: 'block', color: '#4a5568', fontWeight: 'bold', marginBottom: '2px' }}>Model Name</label>
                      <select
                        value={agent.modelName}
                        onChange={(e) => handleUpdate(agent.id, { modelName: e.target.value })}
                        style={{ width: '100%', border: '1px solid #c8d6d0', borderRadius: '6px', padding: '4px' }}
                      >
                        <option value="gpt-4o">gpt-4o</option>
                        <option value="gpt-4-turbo">gpt-4-turbo</option>
                        <option value="gpt-3.5-turbo">gpt-3.5-turbo</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label style={{ display: 'block', color: '#4a5568', fontWeight: 'bold', marginBottom: '2px' }}>System Prompt</label>
                    <textarea
                      value={agent.systemPrompt}
                      onChange={(e) => {
                        const val = e.target.value;
                        setAgents((prev) => prev.map((a) => (a.id === agent.id ? { ...a, systemPrompt: val } : a)));
                      }}
                      onBlur={(e) => handleUpdate(agent.id, { systemPrompt: e.target.value })}
                      style={{ width: '100%', border: '1px solid #c8d6d0', borderRadius: '6px', padding: '6px', fontFamily: 'monospace', fontSize: '11px', height: '60px', resize: 'vertical' }}
                    />
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
