import { FormEvent, useEffect, useMemo, useState, useCallback } from 'react';
import { Routes, Route, Link, useNavigate, Navigate } from 'react-router-dom';
import { LoginPage, RegisterPage } from '../features/auth/AuthPages';
import { useAuth } from '../features/auth/useAuth';
import {
  Bell,
  Bot,
  CheckCircle2,
  Clock3,
  GraduationCap,
  HelpCircle,
  LayoutDashboard,
  MessageSquare,
  MonitorUp,
  Phone,
  PhoneCall,
  PlayCircle,
  RefreshCw,
  Search,
  Send,
  ShieldAlert,
  Smartphone,
  Sparkles,
  Users,
  Video,
} from 'lucide-react';
import { useAppStore, type WorkspaceView } from '../stores';
import { CourseList, CourseDetail, LessonViewer, CourseDiscussion as CourseDiscussionPage, CourseQnA } from '../features/courses';
import CreateCourse from '../features/courses/CreateCourse';
import { AdminUsersPage } from '../features/admin';
import DirectMessagesPage from '../features/chat/DirectMessagesPage';
import { DiagnosticPage } from './DiagnosticPage';
import { DownloadPage } from './DownloadPage';
import ChatWindow from '../features/chat/ChatWindow';
import { apiClient } from '../lib/apiClient';
import { DevBypass } from '../components/DevBypass';
import { useCallManager } from '../features/chat/CallManager';
import { NotificationPrompt } from '../components/NotificationPrompt';
import { notificationService } from '../lib/notifications';

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
        <Route path="/admin/users" element={<RoleGuard roles={['ADMIN','SUPER_ADMIN']}><AppLayout><AdminUsersPage /></AppLayout></RoleGuard>} />
        <Route path="/courses" element={isAuthenticated ? <AppLayout><CourseList /></AppLayout> : <Navigate to='/login' replace />} />
        <Route path="/courses/create" element={isAuthenticated ? <AppLayout><CreateCourse /></AppLayout> : <Navigate to='/login' replace />} />
        <Route path="/messages" element={isAuthenticated ? <AppLayout><DirectMessagesPage /></AppLayout> : <Navigate to='/login' replace />} />
        <Route path="/courses/:id" element={isAuthenticated ? <AppLayout><CourseDetail /></AppLayout> : <Navigate to='/login' replace />} />
        <Route path="/courses/:id/discussion" element={isAuthenticated ? <AppLayout><CourseDiscussionPage /></AppLayout> : <Navigate to='/login' replace />} />
        <Route path="/courses/:courseId/sections/:sectionId/lessons/:lessonId" element={isAuthenticated ? <AppLayout><LessonViewer /></AppLayout> : <Navigate to='/login' replace />} />
        <Route path="/diagnostic" element={<DiagnosticPage />} />
        <Route path="/download" element={<DownloadPage />} />
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
  const [notice, setNotice] = useState('');

  if (user?.role === 'STUDENT') return <StudentDashboard onNotice={setNotice} />;
  if (user?.role === 'INSTRUCTOR') return <InstructorDashboard onNotice={setNotice} />;
  if (user?.role === 'ADMIN' || user?.role === 'SUPER_ADMIN') return <AdminDashboard onNotice={setNotice} />;
  return null;
}

function AppLayout({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const activeCourse = courses[0];
  const [notice, setNotice] = useState('');
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
          <button className="nav-button" onClick={() => navigate('/download')}>
            <Smartphone />
            <span>Mobile App</span>
          </button>
          {(user?.role === 'ADMIN' || user?.role === 'SUPER_ADMIN') && (
            <button className="nav-button" onClick={() => navigate('/admin/users')}>
              <Users />
              <span>Users</span>
            </button>
          )}
        </nav>

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
        {notice && <div className="notice-bar" role="status">{notice}</div>}
        
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
  const { activeCourseId, setActiveCourseId } = useAppStore();
  const navigate = useNavigate();
  const [enrolledCourses, setEnrolledCourses] = useState<any[]>([]);
  const [activeCourse, setActiveCourse] = useState<any>(null);

  // Load real enrolled (or published) courses on mount so Discussion / Q&A
  // use the correct chatRoomId from the database rather than a hardcoded mock.
  useEffect(() => {
    const load = async () => {
      try {
        // 1. Try the user's own enrollments first
        const enrollRes = await apiClient.get('/api/enrollments/me');
        const enrollRaw = enrollRes?.data ?? enrollRes;
        const enrollData = enrollRaw?.data ?? enrollRaw;
        let courses: any[] = Array.isArray(enrollData)
          ? enrollData
              .map((e: any) => {
                // Enrollment API returns { course: {...}, courseId, ... }
                // Normalise to just the course object
                const c = e?.course ?? e;
                return c?.id ? c : null;
              })
              .filter(Boolean)
          : [];

        // 2. Fall back to all published courses (dev mode / no enrollments yet)
        if (courses.length === 0) {
          const cRes = await apiClient.getCourses();
          const cRaw = cRes?.data ?? cRes;
          const cData = (cRaw as any)?.data ?? cRaw;
          courses = Array.isArray(cData) ? cData : [];
        }

        if (courses.length > 0) {
          setEnrolledCourses(courses);
          // Keep the previously selected course if it's still in the list
          const kept = courses.find((c: any) => c.id === activeCourseId) ?? courses[0];
          setActiveCourse(kept);
          setActiveCourseId(kept.id);
        }
      } catch {
        // Silently fall through — CoursePlayer still works with the store default
      }
    };
    load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSelectCourse = (course: any) => {
    setActiveCourse(course);
    setActiveCourseId(course.id);
  };

  return (
    <div className="content-grid">
      <section className="primary-panel">
        {/* ── Course switcher (only when enrolled in > 1 course) ── */}
        {enrolledCourses.length > 1 && (
          <div style={{ display: 'flex', gap: 8, overflowX: 'auto', marginBottom: 14, paddingBottom: 2 }}>
            {enrolledCourses.map((item: any) => {
              const c: any = item?.course ?? item;
              const cId: string = c?.id ?? item?.courseId ?? '';
              const cTitle: string = c?.title ?? cId;
              if (!cId) return null;
              return (
                <button
                  key={cId}
                  onClick={() => {
                    const course = item?.course ?? item;
                    course.id = cId; // ensure id is set
                    handleSelectCourse({ ...course, id: cId, title: cTitle });
                  }}
                  style={{
                    padding: '6px 16px',
                    borderRadius: 20,
                    border: 'none',
                    background: cId === activeCourse?.id ? '#10b981' : '#e5e7eb',
                    color: cId === activeCourse?.id ? '#fff' : '#374151',
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                    flexShrink: 0,
                    transition: 'background 0.15s',
                  }}
                >
                  {cTitle}
                </button>
              );
            })}
          </div>
        )}

        <CoursePlayer
          activeCourse={activeCourse}
          onOpenDiscussion={(courseId) => navigate(`/courses/${courseId}/discussion`)}
          onOpenQnA={(courseId) => navigate(`/courses/${courseId}/discussion?tab=qna`)}
        />
      </section>

      <aside className="stack">
        <AiStudyAssistant onNotice={onNotice} />

        {/* ── Course Community quick-links ── */}
        {enrolledCourses.length > 0 && (
          <section className="panel">
            <div className="panel-title">
              <MessageSquare aria-hidden />
              <h2>Course Community</h2>
            </div>
            <p style={{ margin: '0 0 12px', fontSize: 13, color: '#6b7280' }}>
              Jump into the live chat or ask a question in any of your courses.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {enrolledCourses.slice(0, 4).map((item: any) => {
                // item can be a course object or an enrollment wrapping a course —
                // normalise to a course object and extract a reliable course ID.
                const course: any = item?.course ?? item;
                const courseId: string = course?.id ?? item?.courseId ?? '';
                const courseTitle: string = course?.title ?? courseId;
                if (!courseId) return null;
                return (
                  <div
                    key={courseId}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 8,
                      padding: '8px 0',
                      borderBottom: '1px solid #f3f4f6',
                    }}
                  >
                    <span
                      style={{
                        fontSize: 13,
                        fontWeight: 600,
                        color: '#111827',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        flex: 1,
                      }}
                      title={courseTitle}
                    >
                      {courseTitle}
                    </span>
                    <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                      <Link
                        to={`/courses/${courseId}/discussion`}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 4,
                          padding: '5px 10px',
                          background: '#ecfdf5',
                          border: '1px solid #a7f3d0',
                          color: '#047857',
                          borderRadius: 6,
                          cursor: 'pointer',
                          fontSize: 12,
                          fontWeight: 600,
                          textDecoration: 'none',
                        }}
                        title="Live Discussion"
                      >
                        <MessageSquare size={12} />
                        Chat
                      </Link>
                      <Link
                        to={`/courses/${courseId}/discussion?tab=qna`}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 4,
                          padding: '5px 10px',
                          background: '#eff6ff',
                          border: '1px solid #bfdbfe',
                          color: '#1d4ed8',
                          borderRadius: 6,
                          cursor: 'pointer',
                          fontSize: 12,
                          fontWeight: 600,
                          textDecoration: 'none',
                        }}
                        title="Q&A"
                      >
                        <HelpCircle size={12} />
                        Q&amp;A
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

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
        <QAManager onNotice={onNotice} />
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

// ── Per-course fallback YouTube video IDs (used when lesson.videoUrl is null in dev mode) ──
const COURSE_FALLBACK_VIDEOS: Record<string, string[]> = {
  'course-react-foundations': ['Tn6-PIqc4UM', 'TNhaISOUy6Q', 'O6P86uwfdR0', 'IkMND33x0qQ', 'dpw9EHDh2bM'],
  'course-node-api':          ['fBNz5xF-Kx4', 'ENrzD9HAZK4', 'Oe421EPjeBE', 'qwfE7fSVaZM', 'TlB_eWDSMt4'],
  'course-design-systems':    ['RGKi6LSPDLU', 'NJJ-xFMPgrQ', 'EK-pHkc5EL4', 'ByUq6SzB98g', 'YiLBFBGnZvo'],
};

function youTubeIdFromUrl(url: string): string | null {
  const m = url?.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([A-Za-z0-9_-]{11})/);
  return m?.[1] ?? null;
}

function videoIdForLesson(lesson: any, courseId: string, idx: number): string {
  if (lesson?.videoUrl) {
    const id = youTubeIdFromUrl(lesson.videoUrl);
    if (id) return id;
  }
  const pool = COURSE_FALLBACK_VIDEOS[courseId] ?? COURSE_FALLBACK_VIDEOS['course-react-foundations'];
  return pool[idx % pool.length];
}

function fmtDuration(secs: number): string {
  const m = Math.floor((secs || 0) / 60);
  const s = (secs || 0) % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function CoursePlayer({
  activeCourse,
  onOpenDiscussion,
  onOpenQnA,
}: {
  activeCourse?: any;
  onOpenDiscussion?: (courseId: string) => void;
  onOpenQnA?: (courseId: string) => void;
}) {
  const [tab,            setTab]            = useState<'video' | 'discussion' | 'qa'>('video');
  const [lessons,        setLessons]        = useState<any[]>([]);
  const [currentLesson,  setCurrentLesson]  = useState(0);
  const [loadingLessons, setLoadingLessons] = useState(false);

  // Whenever the active course changes, fetch its sections/lessons and reset view
  useEffect(() => {
    if (!activeCourse?.id) return;
    setCurrentLesson(0);
    setTab('video');
    setLoadingLessons(true);

    apiClient
      .get(`/api/courses/${activeCourse.id}`)
      .then((res) => {
        const raw    = res?.data ?? res;
        const course = (raw?.data ?? raw) as any;
        const flat: any[] = (course?.sections ?? []).flatMap((s: any) =>
          (s.lessons ?? [])
            .sort((a: any, b: any) => a.order - b.order)
            .map((l: any) => ({ ...l, sectionTitle: s.title })),
        );
        setLessons(flat);
      })
      .catch(() => setLessons([]))
      .finally(() => setLoadingLessons(false));
  }, [activeCourse?.id]);

  const lesson  = lessons[currentLesson] ?? null;
  const videoId = lesson ? videoIdForLesson(lesson, activeCourse?.id ?? '', currentLesson) : null;
  const roomId  = activeCourse?.chatRoomId || `course-${activeCourse?.id || 'react-foundations'}`;

  return (
    <section className="panel">
      {/* Course title bar */}
      {activeCourse && (
        <div style={{ padding: '14px 18px', borderBottom: '1px solid #e5e7eb' }}>
          <h3 style={{ margin: '0 0 2px', fontSize: 17, fontWeight: 700, color: '#111827' }}>
            {activeCourse.title}
          </h3>
          {activeCourse.instructor?.name && (
            <span style={{ fontSize: 13, color: '#6b7280' }}>by {activeCourse.instructor.name}</span>
          )}
        </div>
      )}

      {/* Loading */}
      {loadingLessons && (
        <div style={{ padding: 40, textAlign: 'center', color: '#9ca3af' }}>
          <div style={{ width: 26, height: 26, border: '2px solid #e5e7eb', borderTopColor: '#10b981', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto 10px' }} />
          Loading lessons…
        </div>
      )}

      {/* Video player */}
      {!loadingLessons && videoId && (
        <div style={{ position: 'relative', paddingBottom: '56.25%', height: 0, overflow: 'hidden', background: '#000' }}>
          <iframe
            key={videoId}
            src={`https://www.youtube.com/embed/${videoId}?rel=0&modestbranding=1`}
            title={lesson?.title ?? 'Lesson'}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', border: 'none' }}
          />
        </div>
      )}

      {/* Lesson meta */}
      {!loadingLessons && lesson && (
        <div style={{ padding: '14px 18px', borderBottom: '1px solid #e5e7eb' }}>
          <h4 style={{ margin: '0 0 6px', fontSize: 16, fontWeight: 700, color: '#111827' }}>
            {lesson.title}
          </h4>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, fontSize: 13, color: '#6b7280', flexWrap: 'wrap' }}>
            {lesson.duration > 0 && (
              <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <Clock3 size={14} aria-hidden /> {fmtDuration(lesson.duration)}
              </span>
            )}
            {lesson.sectionTitle && <span>{lesson.sectionTitle}</span>}
            {lesson.isFree === false && (
              <span style={{ padding: '2px 8px', borderRadius: 999, background: '#fef9c3', color: '#92400e', fontSize: 11, fontWeight: 700 }}>
                Premium
              </span>
            )}
          </div>
        </div>
      )}

      {/* Lesson selector */}
      {!loadingLessons && lessons.length > 0 && (
        <div style={{ padding: '10px 16px', background: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#9ca3af', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 8 }}>
            Course Content · {lessons.length} lesson{lessons.length !== 1 ? 's' : ''}
          </div>
          <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 2 }}>
            {lessons.map((l, idx) => (
              <button
                key={l.id}
                onClick={() => setCurrentLesson(idx)}
                title={l.title}
                style={{
                  padding: '7px 13px',
                  borderRadius: 8,
                  border: 'none',
                  background: currentLesson === idx ? '#10b981' : '#fff',
                  color:      currentLesson === idx ? '#fff'     : '#374151',
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  maxWidth: 180,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  flexShrink: 0,
                  boxShadow: currentLesson === idx ? 'none' : '0 1px 3px rgba(0,0,0,0.08)',
                  transition: 'background 0.15s, color 0.15s',
                }}
                onMouseEnter={(e) => { if (currentLesson !== idx) e.currentTarget.style.background = '#f3f4f6'; }}
                onMouseLeave={(e) => { if (currentLesson !== idx) e.currentTarget.style.background = '#fff'; }}
              >
                {idx + 1}. {l.title}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* No lessons yet */}
      {!loadingLessons && lessons.length === 0 && activeCourse && (
        <div style={{ padding: '28px 18px', textAlign: 'center', color: '#9ca3af', fontSize: 14 }}>
          No lessons published yet for this course.
        </div>
      )}

      {/* Tabs */}
      <div className="tabs" role="tablist">
        {(['video', 'discussion', 'qa'] as const).map((item) => (
          <button key={item} className={tab === item ? 'selected' : ''} onClick={() => setTab(item)}>
            {item === 'video' ? 'Notes' : item === 'qa' ? 'Q&A' : 'Discussion'}
          </button>
        ))}
      </div>

      {/* Notes tab */}
      {tab === 'video' && (
        <div style={{ padding: 16 }}>
          {lesson ? (
            <>
              <h4 style={{ margin: '0 0 10px', fontSize: 15, fontWeight: 700, color: '#111827' }}>
                Lesson Notes
              </h4>
              <div style={{ fontSize: 14, color: '#4b5563', lineHeight: 1.7 }}>
                {lesson.description
                  ? <p style={{ margin: 0 }}>{lesson.description}</p>
                  : <p style={{ margin: 0, color: '#9ca3af' }}>No notes available for this lesson.</p>
                }
                {lesson.sectionTitle && (
                  <p style={{ marginTop: 14, padding: '10px 14px', background: '#f0fdf4', borderLeft: '3px solid #10b981', borderRadius: 4, fontSize: 13 }}>
                    <strong>Section:</strong> {lesson.sectionTitle}
                  </p>
                )}
              </div>
            </>
          ) : (
            <p style={{ color: '#9ca3af', fontSize: 14 }}>
              {loadingLessons ? 'Loading…' : 'Select a lesson above to view notes.'}
            </p>
          )}
        </div>
      )}

      {/* Discussion tab */}
      {tab === 'discussion' && (
        <CourseDiscussionWidget
          roomId={roomId}
          courseName={activeCourse?.title}
          onOpenFull={onOpenDiscussion && activeCourse ? () => onOpenDiscussion(activeCourse.id) : undefined}
        />
      )}

      {/* Q&A tab */}
      {tab === 'qa' && (
        <StudentQnAWidget
          roomId={roomId}
          onOpenFull={onOpenQnA && activeCourse ? () => onOpenQnA(activeCourse.id) : undefined}
        />
      )}
    </section>
  );
}

// ── Inline Discussion widget (used inside CoursePlayer on the student home page) ───────
function CourseDiscussionWidget({
  roomId,
  courseName,
  onOpenFull,
}: {
  roomId: string;
  courseName?: string;
  onOpenFull?: () => void;
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 480 }}>
      {/* "Open full page" bar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '6px 14px',
          borderBottom: '1px solid #e5e7eb',
          background: '#f9fafb',
          flexShrink: 0,
        }}
      >
        <span style={{ fontSize: 12, color: '#6b7280', fontWeight: 500, display: 'flex', alignItems: 'center', gap: 5 }}>
          <MessageSquare size={13} /> Live Discussion
        </span>
        {onOpenFull && (
          <button
            onClick={onOpenFull}
            style={{
              fontSize: 12,
              color: '#10b981',
              fontWeight: 600,
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              textDecoration: 'underline',
            }}
          >
            Open full page →
          </button>
        )}
      </div>
      <div style={{ flex: 1, overflow: 'hidden' }}>
        <ChatWindow roomId={roomId} roomName={`${courseName || 'Course'} — Discussion`} />
      </div>
    </div>
  );
}

// ── Inline Q&A widget (used inside CoursePlayer on the student home page) ────────────
function StudentQnAWidget({
  roomId,
  onOpenFull,
}: {
  roomId: string;
  onOpenFull?: () => void;
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 480 }}>
      {/* "Open full page" bar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '6px 14px',
          borderBottom: '1px solid #e5e7eb',
          background: '#f9fafb',
          flexShrink: 0,
        }}
      >
        <span style={{ fontSize: 12, color: '#6b7280', fontWeight: 500, display: 'flex', alignItems: 'center', gap: 5 }}>
          <HelpCircle size={13} /> Questions &amp; Answers
        </span>
        {onOpenFull && (
          <button
            onClick={onOpenFull}
            style={{
              fontSize: 12,
              color: '#10b981',
              fontWeight: 600,
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              textDecoration: 'underline',
            }}
          >
            Open full page →
          </button>
        )}
      </div>
      <div style={{ flex: 1, overflow: 'auto' }}>
        <CourseQnA roomId={roomId} />
      </div>
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

function QAManager({ compact = false, onNotice }: { compact?: boolean; onNotice?: (msg: string) => void }) {
  const { activeCourseId } = useAppStore();
  const { user } = useAuth();
  const roomId = `course-${activeCourseId}`;

  const [questions,   setQuestions]   = useState<any[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [expandedId,  setExpandedId]  = useState<string | null>(null);
  const [answerTexts, setAnswerTexts] = useState<Record<string, string>>({});
  const [submitting,  setSubmitting]  = useState<Record<string, boolean>>({});

  const isStaffReply = (r: any) =>
    ['INSTRUCTOR', 'ADMIN', 'SUPER_ADMIN'].includes(r.sender?.role);

  const needsResponse = (q: any) => !q.replies?.some(isStaffReply);

  const relTime = (iso: string) => {
    const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
    if (m < 1)  return 'just now';
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h ago`;
    return `${Math.floor(h / 24)}d ago`;
  };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res  = await apiClient.getQuestions(roomId);
      const data = res?.data ?? res;
      setQuestions(Array.isArray(data) ? data : []);
    } catch {
      setQuestions([]);
    } finally {
      setLoading(false);
    }
  }, [roomId]);

  useEffect(() => { load(); }, [load]);

  const handleAnswer = async (questionId: string) => {
    const content = (answerTexts[questionId] ?? '').trim();
    if (!content) return;
    setSubmitting((p) => ({ ...p, [questionId]: true }));
    try {
      const res       = await apiClient.postAnswer(roomId, questionId, content);
      const newAnswer = res?.data ?? res;
      setQuestions((prev) =>
        prev.map((q) =>
          q.id === questionId
            ? { ...q, replies: [...(q.replies ?? []), { ...newAnswer, sender: user }] }
            : q,
        ),
      );
      setAnswerTexts((p) => ({ ...p, [questionId]: '' }));
      setExpandedId(null);
      onNotice?.('Answer posted successfully');
    } catch {
      onNotice?.('Failed to post answer — please try again');
    } finally {
      setSubmitting((p) => ({ ...p, [questionId]: false }));
    }
  };

  const unanswered = questions.filter(needsResponse);
  const displayed  = compact ? unanswered.slice(0, 1) : unanswered.slice(0, 5);

  return (
    <section className="panel">
      <div className="panel-title" style={{ justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
          <HelpCircle aria-hidden />
          <h2>Q&amp;A Manager</h2>
        </div>
        {!compact && (
          <button
            className="icon-button"
            style={{ width: 30, height: 30 }}
            title="Refresh questions"
            aria-label="Refresh questions"
            onClick={load}
            disabled={loading}
          >
            <RefreshCw
              aria-hidden
              style={{ width: 14, height: 14, animation: loading ? 'spin 1s linear infinite' : 'none' }}
            />
          </button>
        )}
      </div>

      {loading ? (
        <p className="muted">Loading questions…</p>
      ) : unanswered.length === 0 ? (
        <p className="muted" style={{ margin: '4px 0' }}>
          {questions.length === 0
            ? 'No questions yet — students can ask in the Q&A tab.'
            : '✓ All questions answered — nothing pending.'}
        </p>
      ) : (
        <>
          {!compact && (
            <p style={{ margin: '0 0 12px', fontSize: '0.85rem', color: '#66756f' }}>
              {unanswered.length} question{unanswered.length !== 1 ? 's' : ''} awaiting your response
              {questions.length > unanswered.length && (
                <span style={{ marginLeft: 8, color: '#24675d', fontWeight: 600 }}>
                  · {questions.length - unanswered.length} already answered
                </span>
              )}
            </p>
          )}

          {displayed.map((q) => (
            <article key={q.id} className="question-card" style={{ marginBottom: 10 }}>
              {/* Question header */}
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <span className="status-pill">Needs instructor</span>
                  <strong style={{ display: 'block', marginTop: 6, fontSize: '0.92rem' }}>
                    {q.content}
                  </strong>
                  <span style={{ fontSize: '0.78rem', color: '#66756f' }}>
                    {q.sender?.name ?? 'Student'} · {relTime(q.createdAt)}
                    {q.replies?.length > 0 && (
                      <span style={{ marginLeft: 8 }}>
                        · {q.replies.length} student repl{q.replies.length === 1 ? 'y' : 'ies'}
                      </span>
                    )}
                  </span>
                </div>

                {!compact && (
                  <button
                    onClick={() => setExpandedId(expandedId === q.id ? null : q.id)}
                    style={{
                      flexShrink: 0,
                      minHeight: 30,
                      padding: '0 12px',
                      border: '1px solid #c8d6d0',
                      borderRadius: 8,
                      background: expandedId === q.id ? '#24675d' : '#f7faf8',
                      color:      expandedId === q.id ? '#fff'     : '#1d3531',
                      fontSize: '0.82rem',
                      cursor: 'pointer',
                      transition: 'background 0.15s, color 0.15s',
                    }}
                  >
                    {expandedId === q.id ? 'Cancel' : 'Answer'}
                  </button>
                )}
              </div>

              {/* Inline answer form */}
              {expandedId === q.id && (
                <div style={{ marginTop: 10 }}>
                  <textarea
                    value={answerTexts[q.id] ?? ''}
                    onChange={(e) => setAnswerTexts((p) => ({ ...p, [q.id]: e.target.value }))}
                    onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleAnswer(q.id); }}
                    placeholder="Type your answer… (Ctrl+Enter to post)"
                    rows={3}
                    style={{
                      width: '100%',
                      padding: '8px 10px',
                      border: '1px solid #c8d6d0',
                      borderRadius: 8,
                      resize: 'vertical',
                      font: 'inherit',
                      fontSize: '0.9rem',
                      boxSizing: 'border-box',
                    }}
                  />
                  <button
                    className="wide-button"
                    style={{ marginTop: 6 }}
                    disabled={!answerTexts[q.id]?.trim() || submitting[q.id]}
                    onClick={() => handleAnswer(q.id)}
                  >
                    <Send aria-hidden style={{ width: 15, height: 15 }} />
                    {submitting[q.id] ? 'Posting…' : 'Post Answer'}
                  </button>
                </div>
              )}
            </article>
          ))}

          {!compact && unanswered.length > 5 && (
            <p style={{ fontSize: '0.82rem', color: '#66756f', textAlign: 'center', marginTop: 4 }}>
              +{unanswered.length - 5} more — open the course Q&amp;A page to see all
            </p>
          )}
        </>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </section>
  );
}

function DiscussionManager({ onNotice }: { onNotice: (message: string) => void }) {
  const { activeCourseId } = useAppStore();
  const roomId = `course-${activeCourseId}`;

  const [text,       setText]       = useState('');
  const [publishing, setPublishing] = useState(false);
  const [mentioning, setMentioning] = useState(false);
  const [feedback,   setFeedback]   = useState<{ ok: boolean; msg: string } | null>(null);

  const flash = (ok: boolean, msg: string) => {
    setFeedback({ ok, msg });
    setTimeout(() => setFeedback(null), 4000);
  };

  const post = async (mentionAll: boolean) => {
    const content = text.trim() || (mentionAll ? 'A new announcement from your instructor.' : '');
    if (!content) return;

    mentionAll ? setMentioning(true) : setPublishing(true);
    try {
      await apiClient.post(`/api/chat/rooms/${roomId}/announce`, { content, mentionAll });
      setText('');
      const msg = mentionAll
        ? '@all message sent to enrolled learners'
        : 'Announcement posted to course discussion';
      flash(true, msg);
      onNotice(msg);
    } catch (err: any) {
      const errMsg = err?.response?.data?.error ?? 'Failed to post — please try again.';
      flash(false, errMsg);
    } finally {
      mentionAll ? setMentioning(false) : setPublishing(false);
    }
  };

  const canPublish = text.trim().length > 0 && !publishing;

  return (
    <section className="panel">
      <div className="panel-title">
        <Users aria-hidden />
        <h2>Discussion Manager</h2>
      </div>

      {/* Inline feedback */}
      {feedback && (
        <div
          role="status"
          style={{
            marginBottom: 12,
            padding: '8px 12px',
            borderRadius: 8,
            fontSize: '0.85rem',
            fontWeight: 600,
            background: feedback.ok ? '#eefaf6' : '#ffe4e4',
            border:     `1px solid ${feedback.ok ? '#a8d9ce' : '#fca5a5'}`,
            color:      feedback.ok ? '#1a4f47'  : '#991b1b',
          }}
        >
          {feedback.msg}
        </div>
      )}

      {/* Announcement textarea */}
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Type an announcement for your students…"
        rows={3}
        aria-label="Announcement text"
        style={{
          width: '100%',
          padding: '10px 12px',
          border: '1px solid #c8d6d0',
          borderRadius: 8,
          resize: 'vertical',
          font: 'inherit',
          fontSize: '0.9rem',
          boxSizing: 'border-box',
          marginBottom: 10,
          outline: 'none',
          transition: 'border-color 0.15s',
        }}
        onFocus={(e)  => (e.target.style.borderColor = '#24675d')}
        onBlur={(e)   => (e.target.style.borderColor = '#c8d6d0')}
      />

      {/* Publish row */}
      <div className="split-row" style={{ borderTop: 'none', paddingTop: 0 }}>
        <span style={{ color: '#66756f', fontSize: '0.88rem' }}>Pin to course discussion</span>
        <button
          disabled={!canPublish}
          onClick={() => post(false)}
          style={{
            minHeight: 34,
            padding: '0 14px',
            border: '1px solid #c8d6d0',
            borderRadius: 8,
            background:  canPublish ? '#24675d' : '#f7faf8',
            color:       canPublish ? '#fff'    : '#9ca3af',
            cursor:      canPublish ? 'pointer' : 'not-allowed',
            fontSize: '0.88rem',
            fontWeight: 600,
            transition: 'background 0.15s, color 0.15s',
          }}
        >
          {publishing ? 'Posting…' : 'Publish'}
        </button>
      </div>

      {/* @all row */}
      <div className="split-row">
        <div style={{ display: 'grid', gap: 2 }}>
          <span style={{ color: '#66756f', fontSize: '0.88rem' }}>Notify all enrolled learners</span>
          {!text.trim() && (
            <span style={{ color: '#9ca3af', fontSize: '0.78rem' }}>
              Uses default message if textarea is empty
            </span>
          )}
        </div>
        <button
          disabled={mentioning}
          onClick={() => post(true)}
          style={{
            minHeight: 34,
            padding: '0 14px',
            border: '1px solid #c8d6d0',
            borderRadius: 8,
            background: '#f7faf8',
            color:  mentioning ? '#9ca3af' : '#1d3531',
            cursor: mentioning ? 'not-allowed' : 'pointer',
            fontSize: '0.88rem',
            fontWeight: 600,
            flexShrink: 0,
          }}
        >
          {mentioning ? 'Sending…' : '@all'}
        </button>
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
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const res = await apiClient.get('/api/admin/events/log?limit=20');
      if (res.success && res.data) {
        setEvents(res.data);
      }
    } catch {
      // Silently fail – the admin can retry manually
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    // Poll every 15 seconds so the log stays live without WebSocket overhead.
    const id = setInterval(load, 15000);
    return () => clearInterval(id);
  }, [load]);

  const relTime = (iso: string) => {
    const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
    if (m < 1) return 'just now';
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h ago`;
    return `${Math.floor(h / 24)}d ago`;
  };

  return (
    <section className="panel">
      <div className="panel-title" style={{ justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
          <Clock3 aria-hidden />
          <h2>Activity Event Log</h2>
        </div>
        <button
          className="icon-button"
          style={{ width: 30, height: 30 }}
          title="Refresh"
          aria-label="Refresh event log"
          onClick={load}
          disabled={loading}
        >
          <RefreshCw aria-hidden style={{ width: 14, height: 14, animation: loading ? 'spin 1s linear infinite' : 'none' }} />
        </button>
      </div>
      {loading && events.length === 0 && (
        <p className="muted">Loading events…</p>
      )}
      {!loading && events.length === 0 && (
        <p className="muted">No activity events recorded yet.</p>
      )}
      {events.map((ev) => (
        <div className="event-row" key={ev.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
            <span style={{
              display: 'inline-block',
              width: 8,
              height: 8,
              borderRadius: '50%',
              background: ev.status === 'PROCESSED' ? '#10b981' : ev.status === 'FAILED' ? '#ef4444' : '#f59e0b',
              flexShrink: 0,
            }} />
            <strong style={{ fontWeight: 600 }}>{ev.eventType}</strong>
            <span style={{ color: '#6b7280' }}>{ev.status?.toLowerCase()}</span>
          </span>
          <span style={{ fontSize: 12, color: '#9ca3af', whiteSpace: 'nowrap' }}>
            {ev.createdAt ? relTime(ev.createdAt) : ''}
          </span>
        </div>
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
