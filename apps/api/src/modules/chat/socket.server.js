import jwt from 'jsonwebtoken';
import { prisma } from '../../server';
import { sendChatMessage } from './messages';
export function setupSocketServer(io) {
    io.use(async (socket, next) => {
        try {
            const token = socket.handshake.auth.token;
            if (!token) {
                next(new Error('Authentication required'));
                return;
            }
            const payload = jwt.verify(token, process.env.JWT_SECRET ?? 'dev-secret');
            const user = await prisma.user.findUnique({ where: { id: payload.sub }, select: { id: true, role: true, isActive: true } });
            if (!user?.isActive) {
                next(new Error('User is not active'));
                return;
            }
            socket.data.user = { id: user.id, role: user.role };
            next();
        }
        catch {
            next(new Error('Invalid socket token'));
        }
    });
    io.on('connection', (socket) => {
        const user = socket.data.user;
        socket.join(`user-${user.id}`);
        socket.broadcast.emit('user:presence_changed', { userId: user.id, status: 'online' });
        socket.on('room:join', async ({ roomId }) => {
            const member = await prisma.chatRoomMember.findUnique({ where: { roomId_userId: { roomId, userId: user.id } } });
            if (!member || member.removedAt) {
                socket.emit('room:error', { roomId, error: 'Not a room member' });
                return;
            }
            socket.join(roomId);
            socket.to(roomId).emit('group:member_joined', { roomId, userId: user.id });
        });
        socket.on('message:send', async (payload) => {
            try {
                const result = await sendChatMessage({ ...payload, senderId: user.id });
                io.to(payload.roomId).emit('message:sent', result.message);
                if (result.moderation.flagged) {
                    io.to(payload.roomId).emit('moderation:flagged', {
                        messageId: result.message.id,
                        reason: result.moderation.reason,
                    });
                }
            }
            catch (error) {
                socket.emit('message:error', { error: error instanceof Error ? error.message : 'Failed to send message' });
            }
        });
        socket.on('typing:start', ({ roomId }) => {
            socket.to(roomId).emit('typing:start', { roomId, userId: user.id });
        });
        socket.on('typing:stop', ({ roomId }) => {
            socket.to(roomId).emit('typing:stop', { roomId, userId: user.id });
        });
        socket.on('disconnect', () => {
            socket.broadcast.emit('user:presence_changed', { userId: user.id, status: 'offline', lastSeenAt: new Date().toISOString() });
        });
    });
}
//# sourceMappingURL=socket.server.js.map