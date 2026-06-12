export declare class Notification {
    id: string;
    userId: string;
    type: string;
    title: string;
    message: string;
    data?: Record<string, any>;
    isRead: boolean;
    channel: string;
    createdAt: Date;
    updatedAt: Date;
    constructor(data: Partial<Notification> & {
        userId: string;
        type: string;
        title: string;
        message: string;
        channel: string;
    });
    save(): Promise<Notification>;
    static findById(id: string): Promise<Notification | null>;
    static findByUser(userId: string, options?: {
        skip?: number;
        take?: number;
        unreadOnly?: boolean;
    }): Promise<Notification[]>;
    static countUnread(userId: string): Promise<number>;
    toJSON(): Omit<this, "save" | "toJSON">;
}
//# sourceMappingURL=notification.model.d.ts.map