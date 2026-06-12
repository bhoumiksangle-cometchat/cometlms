import { prisma } from '../../server';
export function createChatRoom(input) {
    return prisma.chatRoom.create({
        data: {
            roomId: input.roomId,
            name: input.name,
            ownerId: input.ownerId,
            type: input.type ?? 'GROUP',
            members: { create: { userId: input.ownerId, role: 'owner' } },
        },
    });
}
export function addRoomMember(input) {
    return prisma.chatRoomMember.upsert({
        where: { roomId_userId: { roomId: input.roomId, userId: input.userId } },
        update: { removedAt: null, role: input.role ?? 'member' },
        create: { roomId: input.roomId, userId: input.userId, role: input.role ?? 'member' },
    });
}
export function removeRoomMember(input) {
    return prisma.chatRoomMember.update({
        where: { roomId_userId: { roomId: input.roomId, userId: input.userId } },
        data: { removedAt: new Date() },
    });
}
//# sourceMappingURL=groups.js.map