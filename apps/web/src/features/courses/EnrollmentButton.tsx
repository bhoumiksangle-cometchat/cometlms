import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useAuth } from '../auth/useAuth';
import { apiClient } from '../../lib/apiClient';
import { Check, AlertCircle, Loader } from 'lucide-react';

import { useAppStore } from '../../stores';

interface EnrollmentButtonProps {
  courseId: string;
}

export function EnrollmentButton({ courseId }: EnrollmentButtonProps) {
  const { user } = useAuth();
  const [showMessage, setShowMessage] = useState(false);
  const { bypassEnrollments } = useAppStore();

  const { data: enrollments = [] } = useQuery({
    queryKey: ['enrollments', user?.id],
    queryFn: async () => {
      if (!user) return [];
      const response = await apiClient.get('/api/enrollments/me');
      const raw = response?.data ?? response;
      return Array.isArray(raw) ? raw : raw?.data ?? [];
    },
    enabled: !!user,
  });

  const isEnrolled = bypassEnrollments || enrollments.some(
    (enrollment: { courseId: string }) => enrollment.courseId === courseId
  );

  const enrollMutation = useMutation({
    mutationFn: async () => {
      const response = await apiClient.post('/api/enrollments', { courseId });
      const raw = response?.data ?? response;
      return raw?.data ?? raw;
    },
    onSuccess: () => {
      setShowMessage(true);
      setTimeout(() => setShowMessage(false), 3000);
      // Invalidate enrollments query to refetch
      window.location.reload(); // Simple reload to refresh enrollment status
    },
  });

  if (!user) {
    return (
      <button
        disabled
        className="wide-button"
        style={{ background: '#dce5e1', color: '#66756f', cursor: 'not-allowed' }}
        title="Sign in to enroll"
      >
        Sign in to Enroll
      </button>
    );
  }

  if (isEnrolled) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <button
          disabled
          className="wide-button"
          style={{ background: '#10b981', color: '#fff', cursor: 'default', opacity: 1 }}
        >
          <Check size={18} />
          Enrolled
        </button>
        <p style={{ margin: 0, fontSize: '11px', color: '#047857', textAlign: 'center' }}>You're enrolled in this course</p>
      </div>
    );
  }

  return (
    <div>
      <button
        onClick={() => enrollMutation.mutate()}
        disabled={enrollMutation.isPending}
        className="wide-button"
        style={{ opacity: enrollMutation.isPending ? 0.7 : 1, cursor: enrollMutation.isPending ? 'not-allowed' : 'pointer' }}
      >
        {enrollMutation.isPending ? (
          <>
            <Loader size={18} className="spin" />
            Enrolling...
          </>
        ) : (
          'Enroll Now'
        )}
      </button>

      {enrollMutation.isError && (
        <div style={{ marginTop: '12px', padding: '12px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
          <AlertCircle size={16} color="#dc2626" style={{ flexShrink: 0, marginTop: '2px' }} />
          <p style={{ margin: 0, fontSize: '13px', color: '#b91c1c' }}>Failed to enroll. Please try again.</p>
        </div>
      )}

      {showMessage && enrollMutation.isSuccess && (
        <div style={{ marginTop: '12px', padding: '12px', background: '#ecfdf5', border: '1px solid #a7f3d0', borderRadius: '8px', display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
          <Check size={16} color="#059669" style={{ flexShrink: 0, marginTop: '2px' }} />
          <p style={{ margin: 0, fontSize: '13px', color: '#047857' }}>Successfully enrolled! You can now access the course.</p>
        </div>
      )}
    </div>
  );
}
