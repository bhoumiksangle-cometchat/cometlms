export type UserRole = 'STUDENT' | 'INSTRUCTOR' | 'ADMIN' | 'SUPER_ADMIN' | 'AI_AGENT';
export interface User {
    id: string;
    email: string;
    name: string;
    avatarUrl?: string;
    bio?: string;
    role: UserRole;
    isActive: boolean;
    isVerified: boolean;
    createdAt: string;
    updatedAt: string;
}
export type ChatRoomType = 'group' | 'dm';
export type MessageContentType = 'text' | 'image' | 'file' | 'voice';
export type ModerationStatus = 'PENDING' | 'DISMISSED' | 'DELETED' | 'ESCALATED';
export interface ChatRoom {
    id: string;
    roomId: string;
    name: string;
    type: ChatRoomType;
    ownerId: string;
    isActive: boolean;
    createdAt: string;
    updatedAt: string;
}
export interface ChatRoomMember {
    id: string;
    roomId: string;
    userId: string;
    role: 'owner' | 'member' | 'bot';
    joinedAt: string;
    removedAt?: string;
}
export interface ChatMessage {
    id: string;
    roomId: string;
    senderId: string;
    parentMessageId?: string;
    content: string;
    contentType: MessageContentType;
    isEdited: boolean;
    isDeleted: boolean;
    metadata?: Record<string, unknown>;
    createdAt: string;
    updatedAt: string;
}
export interface ChatModerationLog {
    id: string;
    messageId: string;
    courseId?: string;
    senderId: string;
    roomId: string;
    messagePreview: string;
    flagReason: string;
    status: ModerationStatus;
    actionedBy?: string;
    actionedAt?: string;
    createdAt: string;
}
export type CourseStatus = 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
export type CourseLevel = 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED';
export interface Course {
    id: string;
    instructorId: string;
    title: string;
    slug: string;
    description: string;
    thumbnailUrl?: string;
    categoryId: string;
    price: number;
    currency: string;
    level: CourseLevel;
    language: string;
    status: CourseStatus;
    chatRoomId?: string;
    createdAt: string;
    updatedAt: string;
    publishedAt?: string;
}
export interface Enrollment {
    id: string;
    userId: string;
    courseId: string;
    enrolledAt: string;
}
export type InternalEventType = 'message:sent' | 'message:edited' | 'message:deleted' | 'message:reaction_added' | 'message:reaction_removed' | 'user:mentioned' | 'user:presence_changed' | 'user:blocked' | 'group:member_banned' | 'group:member_joined' | 'call:ended' | 'call:meeting_ended' | 'moderation:flagged' | 'moderation:approved' | 'message:read_by_all';
export type EventStatus = 'RECEIVED' | 'PROCESSED' | 'FAILED';
export interface ActivityEventLog {
    id: string;
    eventType: InternalEventType;
    payload: Record<string, unknown>;
    status: EventStatus;
    errorMessage?: string;
    processedAt?: string;
    createdAt: string;
}
export type AgentType = 'STUDY_ASSISTANT' | 'FAQ_BOT' | 'INSTRUCTOR_COPILOT';
export type LLMProvider = 'OPENAI' | 'LANGCHAIN';
export interface AiAgentConfig {
    id: string;
    courseId?: string;
    agentType: AgentType;
    botUserId: string;
    provider: LLMProvider;
    systemPrompt: string;
    modelName: string;
    isEnabled: boolean;
    createdAt: string;
    updatedAt: string;
}
export interface ApiResponse<T> {
    success: boolean;
    data?: T;
    error?: string;
    pagination?: {
        page: number;
        limit: number;
        total: number;
    };
}
export interface AuthTokens {
    accessToken: string;
    refreshToken: string;
}
export interface LoginRequest {
    email: string;
    password: string;
}
export interface RegisterRequest {
    email: string;
    password: string;
    name: string;
    role?: UserRole;
}
//# sourceMappingURL=index.d.ts.map