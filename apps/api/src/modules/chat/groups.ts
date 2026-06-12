import { prisma } from '../../server';

export function createChatRoom(input: { roomId: string; name: string; ownerId: string; type?: 'GROUP' | 'DM' }) {
  console.log(`Creating chat room: ${input.roomId} for owner: ${input.ownerId}`);
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

export function addRoomMember(input: { roomId: string; userId: string; role?: string }) {
  console.log(`Adding member: ${input.userId} to room: ${input.roomId}`);
  return prisma.chatRoomMember.upsert({
    where: { roomId_userId: { roomId: input.roomId, userId: input.userId } },
    update: { removedAt: null, role: input.role ?? 'member' },
    create: { roomId: input.roomId, userId: input.userId, role: input.role ?? 'member' },
  });
}

export function removeRoomMember(input: { roomId: string; userId: string }) {
  console.log(`Removing member: ${input.userId} from room: ${input.roomId}`);
  return prisma.chatRoomMember.update({
    where: { roomId_userId: { roomId: input.roomId, userId: input.userId } },
    data: { removedAt: new Date() },
  });
}
