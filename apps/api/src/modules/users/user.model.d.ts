export declare class User {
    id: string;
    email: string;
    passwordHash: string;
    name: string;
    avatarUrl?: string;
    bio?: string;
    role: string;
    isActive: boolean;
    isVerified: boolean;
    createdAt: Date;
    updatedAt: Date;
    constructor(data: Partial<User> & {
        email: string;
        passwordHash: string;
        name: string;
    });
    comparePassword(password: string): Promise<boolean>;
    save(): Promise<User>;
    static findById(id: string): Promise<User | null>;
    static findByEmail(email: string): Promise<User | null>;
    static findMany(options?: {
        skip?: number;
        take?: number;
        where?: any;
        orderBy?: any;
    }): Promise<User[]>;
    static delete(id: string): Promise<boolean>;
    toJSON(): Omit<this, "save" | "toJSON" | "passwordHash" | "comparePassword">;
}
//# sourceMappingURL=user.model.d.ts.map