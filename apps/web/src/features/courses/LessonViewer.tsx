import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useAuth } from '../auth/useAuth';
import { apiClient } from '../../lib/apiClient';
import { ChevronLeft, CheckCircle2, Play } from 'lucide-react';
import { CourseVideoPlayer } from './CourseVideoPlayer';

interface LessonData {
  id: string;
  title: string;
  description?: string;
  videoUrl?: string;
  duration?: number;
  isFree: boolean;
}

export function LessonViewer() {
  const { courseId, sectionId, lessonId } = useParams<{
    courseId: string;
    sectionId: string;
    lessonId: string;
  }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const { data: lesson, isLoading } = useQuery({
    queryKey: ['lesson', lessonId],
    queryFn: async () => {
      const response = await apiClient.get(
        `/api/courses/${courseId}/sections/${sectionId}/lessons/${lessonId}`
      );
      const raw = response?.data ?? response;
      return (raw?.data ?? raw) as LessonData;
    },
    enabled: !!lessonId && !!courseId && !!sectionId,
  });

  const completeMutation = useMutation({
    mutationFn: async () => {
      const response = await apiClient.post(
        `/api/courses/${courseId}/lessons/${lessonId}/complete`
      );
      const raw = response?.data ?? response;
      return raw?.data ?? raw;
    },
  });

  if (isLoading) {
    return (
      <section className="panel">
        <p className="muted">Loading lesson...</p>
      </section>
    );
  }

  if (!lesson) {
    return (
      <section className="panel accent-panel" style={{ borderColor: '#fca5a5', backgroundColor: '#fef2f2' }}>
        <button
          onClick={() => navigate(`/courses/${courseId}`)}
          className="wide-button"
          style={{ width: 'auto', background: 'transparent', color: '#24675d', border: '1px solid #24675d', marginBottom: '20px' }}
        >
          <ChevronLeft size={16} />
          Back to Course
        </button>
        <h2 style={{ color: '#991b1b', margin: '0 0 10px' }}>Lesson not found</h2>
        <p className="muted">The lesson you are looking for does not exist or failed to load.</p>
      </section>
    );
  }

  return (
    <div style={{ display: 'grid', gap: '20px' }}>
      {/* Video Player Section */}
      <section className="panel" style={{ padding: 0, overflow: 'hidden', background: '#0a0a0a' }}>
        <div style={{ maxWidth: '1000px', margin: '0 auto', width: '100%' }}>
          {lesson.videoUrl ? (
            <CourseVideoPlayer videoUrl={lesson.videoUrl} title={lesson.title} />
          ) : (
            <div className="video-frame" style={{ borderRadius: 0, minHeight: '500px' }}>
              <Play aria-hidden />
              <span>{lesson.title}</span>
            </div>
          )}
        </div>
      </section>

      {/* Content Section */}
      <section className="panel" style={{ maxWidth: '1000px', margin: '0 auto', width: '100%' }}>
        {/* Back Button */}
        <button
          onClick={() => navigate(`/courses/${courseId}`)}
          style={{ 
            display: 'inline-flex', alignItems: 'center', gap: '8px', 
            background: 'transparent', border: 'none', color: '#24675d', 
            fontWeight: 600, padding: 0, marginBottom: '24px', cursor: 'pointer' 
          }}
        >
          <ChevronLeft size={16} />
          Back to Course
        </button>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '20px' }}>
          <div style={{ flex: '1 1 500px' }}>
            <h1 style={{ margin: '0 0 16px', fontSize: '2rem', color: '#16322f' }}>
              {lesson.title}
            </h1>
            
            <div style={{ display: 'flex', gap: '16px', marginBottom: '24px' }}>
              {lesson.isFree && (
                <span style={{ background: '#eefaf6', color: '#10b981', padding: '4px 12px', borderRadius: '16px', fontSize: '12px', fontWeight: 'bold' }}>
                  Free Preview
                </span>
              )}
              {lesson.duration && (
                <span style={{ color: '#66756f', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  ⏱ {Math.round(lesson.duration / 60)} mins
                </span>
              )}
            </div>

            <div style={{ color: '#3f4f4b', lineHeight: 1.6, fontSize: '1.05rem' }}>
              {lesson.description ? (
                <p>{lesson.description}</p>
              ) : (
                <p className="muted">No description provided for this lesson.</p>
              )}
            </div>
          </div>

          <div style={{ background: '#fbfdfc', border: '1px solid #dce5e1', borderRadius: '12px', padding: '24px', width: '300px' }}>
            <h3 style={{ margin: '0 0 16px', fontSize: '1.1rem', color: '#16322f' }}>Lesson Progress</h3>
            
            {user?.role === 'STUDENT' ? (
              <button
                onClick={() => completeMutation.mutate()}
                disabled={completeMutation.isPending}
                className="wide-button"
                style={{ 
                  background: completeMutation.isSuccess ? '#10b981' : '#24675d',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px'
                }}
              >
                <CheckCircle2 size={18} />
                {completeMutation.isPending
                  ? 'Marking...'
                  : completeMutation.isSuccess
                  ? 'Completed!'
                  : 'Mark as Complete'}
              </button>
            ) : (
              <p className="muted" style={{ fontSize: '13px' }}>
                Progress tracking is only available for enrolled students.
              </p>
            )}
            
            <div style={{ marginTop: '20px', paddingTop: '20px', borderTop: '1px solid #e4ebe8' }}>
              <button 
                onClick={() => navigate(`/courses/${courseId}/discussion`)}
                className="wide-button" 
                style={{ background: '#fff', color: '#24675d', border: '1px solid #24675d' }}
              >
                Join Discussion
              </button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
