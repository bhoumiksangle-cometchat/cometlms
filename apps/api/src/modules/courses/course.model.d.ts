export declare class Course {
    id: string;
    instructorId: string;
    title: string;
    slug: string;
    description: string;
    thumbnailUrl?: string;
    categoryId: string;
    price: number;
    currency: string;
    level: string;
    language: string;
    status: string;
    chatRoomId?: string;
    createdAt: Date;
    updatedAt: Date;
    publishedAt?: Date;
    constructor(data: Partial<Course> & {
        instructorId: string;
        title: string;
        slug: string;
        description: string;
        categoryId: string;
        price: number;
        currency: string;
        level: string;
        language: string;
    });
    save(): Promise<Course>;
    static findById(id: string): Promise<Course | null>;
    static findBySlug(slug: string): Promise<Course | null>;
    static findMany(options?: {
        skip?: number;
        take?: number;
        where?: any;
        orderBy?: any;
        search?: string;
    }): Promise<Course[]>;
    static count(options?: {
        where?: any;
        search?: string;
    }): Promise<number>;
    static delete(id: string): Promise<boolean>;
    toJSON(): Omit<this, "save" | "toJSON">;
}
//# sourceMappingURL=course.model.d.ts.map