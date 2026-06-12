type SendMessageInput = {
    roomId: string;
    senderId: string;
    content: string;
    parentMessageId?: string;
    metadata?: Record<string, unknown>;
};
export declare function sendChatMessage(input: SendMessageInput): Promise<{
    message: any;
    moderation: {
        flagged: false;
        reason?: undefined;
    } | {
        flagged: true;
        reason: string;
    };
}>;
export declare function listRoomMessages(roomId: string, take?: number): any;
export {};
//# sourceMappingURL=messages.d.ts.map