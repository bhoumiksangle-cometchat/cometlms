import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../../lib/apiClient';
import { TrendingUp } from 'lucide-react';

interface CourseProgressProps {
  courseId: string;
}

interface ProgressData {
  totalLessons: number;
  completedLessons: number;
  progressPercentage: number;
}

export function CourseProgress({ courseId }: CourseProgressProps) {
  const { data: progress } = useQuery({
    queryKey: ['courseProgress', courseId],
    queryFn: async () => {
      const response = await apiClient.get(`/api/courses/${courseId}/progress`);
      const raw = response?.data ?? response;
      return (raw?.data ?? raw) as ProgressData;
    },
    enabled: !!courseId,
  });

  if (!progress) {
    return null;
  }

  return (
    <section className="panel" style={{ background: '#f5f9f8', border: '1px solid #c8d6d0' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyItems: 'center', width: '36px', height: '36px', borderRadius: '50%', background: '#24675d', color: '#fff', justifyContent: 'center' }}>
            <TrendingUp size={18} />
          </div>
          <div>
            <p className="muted" style={{ margin: '0 0 2px', fontSize: '12px', fontWeight: 600 }}>Course Progress</p>
            <p style={{ margin: 0, fontSize: '14px', fontWeight: 'bold', color: '#16322f' }}>
              {progress.completedLessons} / {progress.totalLessons} lessons
            </p>
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <p style={{ margin: 0, fontSize: '1.5rem', fontWeight: 'bold', color: '#24675d' }}>{progress.progressPercentage}%</p>
        </div>
      </div>

      {/* Progress Bar */}
      <div style={{ position: 'relative', height: '8px', background: '#dce5e1', borderRadius: '999px', overflow: 'hidden' }}>
        <div
          style={{ position: 'absolute', top: 0, left: 0, height: '100%', background: 'linear-gradient(90deg, #3d8b7d, #24675d)', borderRadius: '999px', transition: 'width 0.5s ease-out', width: `${progress.progressPercentage}%` }}
        />
      </div>

      {/* Progress Info */}
      <div style={{ marginTop: '16px', fontSize: '12px', color: '#66756f' }}>
        <p style={{ margin: 0 }}>
          {progress.completedLessons > 0
            ? `Great progress! You're ${progress.progressPercentage}% through this course.`
            : 'Start watching lessons to track your progress.'}
        </p>
      </div>

      {/* Completion Status */}
      {progress.progressPercentage === 100 && (
        <div style={{ marginTop: '16px', padding: '10px', background: '#eefaf6', border: '1px solid #a8d9ce', borderRadius: '8px', textAlign: 'center' }}>
          <p style={{ margin: 0, fontSize: '13px', fontWeight: 'bold', color: '#27564e' }}>🎉 Course Complete!</p>
        </div>
      )}
    </section>
  );
}
