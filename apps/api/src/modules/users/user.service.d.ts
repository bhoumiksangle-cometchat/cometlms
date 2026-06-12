export declare class UserService {
    getProfile(userId: string): Promise<any>;
    updateProfile(userId: string, data: Partial<{
        name: string;
        avatarUrl: string;
        bio: string;
    }>): Promise<any>;
    getAll(options?: {
        page?: number;
        limit?: number;
        role?: string;
        isActive?: boolean;
    }): Promise<{
        users: any;
        pagination: {
            page: number;
            limit: number;
            total: any;
            pages: number;
        };
    }>;
    getById(id: string): Promise<any>;
    deactivate(id: string): Promise<any>;
}
//# sourceMappingURL=user.service.d.ts.map