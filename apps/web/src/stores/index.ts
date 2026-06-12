import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type WorkspaceView = 'student' | 'instructor' | 'admin';

type AppState = {
  view: WorkspaceView;
  activeCourseId: string;
  bypassEnrollments: boolean;
  setView: (view: WorkspaceView) => void;
  setActiveCourseId: (courseId: string) => void;
  setBypassEnrollments: (bypass: boolean) => void;
};

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      view: 'student',
      activeCourseId: 'course-react-foundations',
      bypassEnrollments: false,
      setView: (view) => set({ view }),
      setActiveCourseId: (activeCourseId) => set({ activeCourseId }),
      setBypassEnrollments: (bypassEnrollments) => set({ bypassEnrollments }),
    }),
    { name: 'learnloop-app' }
  )
);
