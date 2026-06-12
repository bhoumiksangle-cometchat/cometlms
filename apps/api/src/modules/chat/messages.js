import { prisma } from '../../server';
import { moderateMessage } from './moderation';
export async function sendChatMessage(input) {
    const moderation = moderateMessage(input.content);
    const message = await prisma.$transaction(async (tx) => {
        const created = await tx.chatMessage.create({
            data: {
                roomId: input.roomId,
                senderId: input.senderId,
                content: input.content,
                parentMessageId: input.parentMessageId,
                metadata: input.metadata ?? {},
            },
            include: { sender: { select: { id: true, name: true, avatarUrl: true, role: true } } },
        });
        await tx.activityEventLog.create({
            data: {
                eventType: 'message:sent',
                payload: { roomId: input.roomId, senderId: input.senderId, messageId: created.id },
                status: 'PROCESSED',
                processedAt: new Date(),
            },
        });
        if (moderation.flagged) {
            await tx.chatModerationLog.create({
                data: {
                    messageId: created.id,
                    senderId: input.senderId,
                    roomId: input.roomId,
                    messagePreview: input.content.slice(0, 180),
                    flagReason: moderation.reason,
                },
            });
            await tx.activityEventLog.create({
                data: {
                    eventType: 'moderation:flagged',
                    payload: { roomId: input.roomId, senderId: input.senderId, messageId: created.id, reason: moderation.reason },
                    status: 'PROCESSED',
                    processedAt: new Date(),
                },
            });
        }
        return created;
    });
    return { message, moderation };
}
export function listRoomMessages(roomId, take = 50) {
    return prisma.chatMessage.findMany({
        where: { roomId, isDeleted: false },
        include: { sender: { select: { id: true, name: true, avatarUrl: true, role: true } }, replies: true },
        orderBy: { createdAt: 'asc' },
        take,
    });
}
//# sourceMappingURL=messages.js.map