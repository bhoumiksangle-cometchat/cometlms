import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../auth/useAuth';
import { apiClient } from '../../lib/apiClient';
import { EnrollmentButton } from './EnrollmentButton';
import { CourseProgress } from './CourseProgress';
import {
  Clock,
  Play,
  MessageSquare,
  BookOpen,
  Globe,
  Lock,
  Unlock,
  Settings,
  CheckCircle2,
  Users,
  ChevronDown,
  ChevronRight,
  GraduationCap
} from 'lucide-react';

export function CourseDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [openSections, setOpenSections] = useState<Set<number>>(new Set([0]));

  const isInstructor = user?.role === 'INSTRUCTOR';
  const isAdmin = user?.role === 'ADMIN' || user?.role === 'SUPER_ADMIN';
  const isStaff = isInstructor || isAdmin;

  const {
    data: course,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['course', id],
    queryFn: async () => {
      const response = await apiClient.get(`/api/courses/${id}`);
      const raw = response?.data ?? response;
      return (raw?.data ?? raw) as any;
    },
    enabled: !!id,
  });

  function toggleSection(idx: number) {
    setOpenSections((prev) => {
      const next = new Set(prev);
      next.has(idx) ? next.delete(idx) : next.add(idx);
      return next;
    });
  }

  if (isLoading) {
    return (
      <section className="panel">
        <p className="muted">Loading course details...</p>
      </section>
    );
  }

  if (error || !course) {
    return (
      <section className="panel accent-panel" style={{ borderColor: '#fca5a5', backgroundColor: '#fef2f2' }}>
        <h2 style={{ color: '#991b1b', margin: '0 0 10px' }}>Course not found</h2>
        <p className="muted">The course you are looking for does not exist or failed to load.</p>
        <button className="wide-button" style={{ width: 'auto' }} onClick={() => navigate('/courses')}>
          Back to Courses
        </button>
      </section>
    );
  }

  const totalLessons = course.sections?.reduce((sum: number, s: any) => sum + s.lessons.length, 0) || 0;
  const isOwner = course.instructor?.id === user?.id;
  const showManagement = isStaff && (isOwner || isAdmin);

  return (
    <div style={{ display: 'grid', gap: '20px' }}>
      {/* Header Panel */}
      <section className="panel" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ height: '220px', background: 'linear-gradient(135deg, #16322f 0%, #24675d 100%)', position: 'relative' }}>
          {course.thumbnailUrl ? (
            <img src={course.thumbnailUrl} alt={course.title} style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: 0.6 }} />
          ) : (
            <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,0.1)' }}>
              <GraduationCap size={100} />
            </div>
          )}
          <div style={{ position: 'absolute', bottom: '24px', left: '24px', right: '24px', color: '#fff' }}>
            <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
              <span style={{ background: 'rgba(255,255,255,0.2)', padding: '4px 10px', borderRadius: '12px', fontSize: '11px', fontWeight: 'bold' }}>
                {course.level}
              </span>
              <span style={{ background: 'rgba(255,255,255,0.2)', padding: '4px 10px', borderRadius: '12px', fontSize: '11px', fontWeight: 'bold' }}>
                {course.category?.name}
              </span>
            </div>
            <h1 style={{ margin: 0, fontSize: '2rem', textShadow: '0 2px 4px rgba(0,0,0,0.3)' }}>{course.title}</h1>
          </div>
        </div>
        
        <div style={{ padding: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '24px' }}>
          <div style={{ flex: '1 1 500px' }}>
            <p style={{ margin: '0 0 20px', fontSize: '1.05rem', color: '#66756f', lineHeight: 1.6 }}>
              {course.description}
            </p>
            
            <div style={{ display: 'flex', gap: '24px', color: '#27564e', fontSize: '13px', fontWeight: 600 }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><Globe size={16} /> {course.language}</span>
              <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><BookOpen size={16} /> {totalLessons} lessons</span>
              <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><Users size={16} /> {course.instructor?.name}</span>
            </div>
          </div>
          
          <div style={{ background: '#f7faf8', border: '1px solid #c8d6d0', borderRadius: '12px', padding: '20px', width: '300px', textAlign: 'center' }}>
            <strong style={{ display: 'block', fontSize: '2rem', color: course.price === 0 ? '#10b981' : '#16322f', marginBottom: '16px' }}>
              {course.price === 0 ? 'Free' : `$${(course.price / 100).toFixed(2)}`}
            </strong>
            
            {!isStaff ? (
              <>
                <EnrollmentButton courseId={course.id} />
                <button 
                  onClick={() => navigate(`/courses/${course.id}/discussion`)}
                  className="wide-button" 
                  style={{ background: '#fff', color: '#24675d', border: '1px solid #24675d', marginTop: '10px' }}
                >
                  <MessageSquare size={16} /> Course Discussion
                </button>
              </>
            ) : (
              showManagement ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <button className="wide-button" onClick={() => navigate(`/courses/${course.id}/edit`)}><Settings size={16} /> Edit Course</button>
                  <button 
                    onClick={() => navigate(`/courses/${course.id}/discussion`)}
                    className="wide-button" 
                    style={{ background: '#fff', color: '#24675d', border: '1px solid #24675d' }}
                  >
                    <MessageSquare size={16} /> View Discussion
                  </button>
                </div>
              ) : (
                <p className="muted" style={{ fontSize: '13px' }}>Instructor view mode (Read-only)</p>
              )
            )}
          </div>
        </div>
      </section>

      <div className="content-grid" style={{ gridTemplateColumns: 'minmax(0, 1fr) 300px' }}>
        {/* Curriculum */}
        <section className="primary-panel">
          <div className="panel" style={{ padding: '24px' }}>
            <div className="panel-title">
              <BookOpen aria-hidden />
              <h2>Curriculum</h2>
            </div>
            
            {course.sections?.length === 0 ? (
              <p className="muted">No content has been added to this course yet.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {course.sections?.map((section: any, idx: number) => {
                  const isOpen = openSections.has(idx);
                  return (
                    <div key={section.id} style={{ border: '1px solid #c8d6d0', borderRadius: '8px', overflow: 'hidden' }}>
                      <button 
                        onClick={() => toggleSection(idx)}
                        style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px', background: isOpen ? '#eefaf6' : '#fbfdfc', border: 'none', textAlign: 'left', borderRadius: 0 }}
                      >
                        <div>
                          <strong style={{ display: 'block', color: '#16322f', fontSize: '15px' }}>Section {idx + 1}: {section.title}</strong>
                          <span style={{ fontSize: '12px', color: '#66756f', marginTop: '4px', display: 'block' }}>{section.lessons.length} lessons</span>
                        </div>
                        {isOpen ? <ChevronDown size={20} color="#24675d" /> : <ChevronRight size={20} color="#66756f" />}
                      </button>
                      
                      {isOpen && (
                        <div style={{ borderTop: '1px solid #c8d6d0', background: '#fff' }}>
                          {section.lessons.map((lesson: any, lIdx: number) => (
                            <div 
                              key={lesson.id} 
                              style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 16px', borderBottom: lIdx < section.lessons.length - 1 ? '1px solid #e4ebe8' : 'none' }}
                            >
                              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: '#eefaf6', color: '#24675d', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: 'bold' }}>
                                  {lIdx + 1}
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column' }}>
                                  <span style={{ fontSize: '14px', color: '#16322f', fontWeight: 500 }}>{lesson.title}</span>
                                  {lesson.duration && (
                                    <span style={{ fontSize: '11px', color: '#66756f', display: 'flex', alignItems: 'center', gap: '4px', marginTop: '2px' }}>
                                      <Clock size={10} /> {Math.round(lesson.duration / 60)} mins
                                    </span>
                                  )}
                                </div>
                              </div>
                              <button 
                                onClick={() => navigate(`/courses/${course.id}/sections/${section.id}/lessons/${lesson.id}`)}
                                style={{ background: 'transparent', border: '1px solid #24675d', color: '#24675d', padding: '6px 12px', borderRadius: '6px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px', minHeight: 'auto' }}
                              >
                                {lesson.isFree ? <Unlock size={12} /> : <Play size={12} />}
                                {lesson.isFree ? 'Preview' : 'View'}
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </section>

        {/* Sidebar */}
        <aside className="stack">
          {!isStaff && <CourseProgress courseId={course.id} />}
          <div className="panel">
            <div className="panel-title">
              <CheckCircle2 aria-hidden />
              <h2>What you'll learn</h2>
            </div>
            <ul style={{ margin: 0, paddingLeft: '20px', color: '#66756f', fontSize: '14px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <li>Master the core concepts of this subject</li>
              <li>Build real-world projects from scratch</li>
              <li>Learn best practices and industry standards</li>
              <li>Prepare for technical interviews</li>
            </ul>
          </div>
        </aside>
      </div>
    </div>
  );
}
