export declare class AuthService {
    register(data: {
        email: string;
        password: string;
        name: string;
        role?: string;
    }): Promise<{
        user: any;
        accessToken: string;
        refreshToken: string;
    }>;
    login(data: {
        email: string;
        password: string;
    }): Promise<{
        user: {
            id: any;
            email: any;
            name: any;
            role: any;
            avatarUrl: any;
        };
        accessToken: string;
        refreshToken: string;
    }>;
    logout(_userId: string): Promise<void>;
    refresh(refreshToken: string): Promise<{
        accessToken: string;
        refreshToken: string;
    }>;
    getProfile(userId: string): Promise<any>;
}
//# sourceMappingURL=auth.service.d.ts.map