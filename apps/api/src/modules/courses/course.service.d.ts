import { Course } from './course.model';
export declare class CourseService {
    getAll(options?: {
        page?: number;
        limit?: number;
        search?: string;
        level?: string;
        language?: string;
        status?: string;
        instructorId?: string;
    }): Promise<{
        courses: any;
        pagination: {
            page: number;
            limit: number;
            total: any;
            pages: number;
        };
    }>;
    getById(id: string): Promise<Course>;
    getBySlug(slug: string): Promise<Course>;
    create(data: Partial<Course>, instructorId: string): Promise<Course>;
    update(id: string, data: Partial<Course>, userId: string): Promise<Course>;
    delete(id: string, userId: string): Promise<void>;
    publish(id: string, userId: string): Promise<Course>;
}
//# sourceMappingURL=course.service.d.ts.map