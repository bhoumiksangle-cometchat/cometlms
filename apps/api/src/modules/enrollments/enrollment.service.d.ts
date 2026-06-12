import { Enrollment } from './enrollment.model';
export declare class EnrollmentService {
    enroll(userId: string, courseId: string): Promise<Enrollment>;
    getMyEnrollments(userId: string, page?: number, limit?: number): Promise<{
        enrollments: any;
        pagination: {
            page: number;
            limit: number;
            total: any;
            pages: number;
        };
    }>;
    getById(id: string): Promise<Enrollment>;
    updateProgress(id: string, progress: number, userId: string): Promise<Enrollment>;
    completeLesson(id: string, lessonId: string, userId: string): Promise<Enrollment>;
    getCourseEnrollments(courseId: string, page?: number, limit?: number): Promise<{
        enrollments: any;
        pagination: {
            page: number;
            limit: number;
            total: any;
            pages: number;
        };
    }>;
}
//# sourceMappingURL=enrollment.service.d.ts.map