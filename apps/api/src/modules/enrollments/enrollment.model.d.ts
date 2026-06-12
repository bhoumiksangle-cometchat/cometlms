export declare class Enrollment {
    id: string;
    userId: string;
    courseId: string;
    enrolledAt: Date;
    completedAt?: Date;
    progress: number;
    constructor(data: Partial<Enrollment> & {
        userId: string;
        courseId: string;
    });
    save(): Promise<Enrollment>;
    static findById(id: string): Promise<Enrollment | null>;
    static findByUserAndCourse(userId: string, courseId: string): Promise<Enrollment | null>;
    static findMany(options?: {
        skip?: number;
        take?: number;
        where?: any;
        orderBy?: any;
    }): Promise<Enrollment[]>;
    static count(options?: {
        where?: any;
    }): Promise<number>;
    static delete(id: string): Promise<boolean>;
    toJSON(): Omit<this, "save" | "toJSON">;
}
//# sourceMappingURL=enrollment.model.d.ts.map