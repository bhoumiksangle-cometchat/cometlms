import type { Server } from 'socket.io';
import jwt from 'jsonwebtoken';
import { prisma } from '../../server';
import { sendChatMessage } from './messages';
import { handleBotMention } from './agents';
import { addNotificationJob } from '../../lib/queue';

type SocketUser = {
  id: string;
  role: string;
  name?: string;
};

// Track read receipts in memory (can be migrated to Redis for scalability)
const readReceipts = new Map<string, Set<string>>(); // messageId -> Set of userIds

export function setupSocketServer(io: Server) {
  const isDevMode = !process.env.DATABASE_URL;
  
  io.use(async (socket, next) => {
    console.log('[Socket] Middleware triggered for:', socket.id);
    try {
      const token = socket.handshake.auth.token as string | undefined;

      if (!token) {
        console.log('[Socket] No token provided');
        next(new Error('Authentication required'));
        return;
      }

      const payload = jwt.verify(token, process.env.JWT_SECRET ?? 'dev-secret') as jwt.JwtPayload & { role: string };
      console.log('[Socket] JWT verified for user:', payload.sub);
      
      if (isDevMode) {
        // In dev mode, trust the JWT without checking database
        socket.data.user = { 
          id: payload.sub, 
          role: payload.role,
          name: payload.name || 'Dev User',
        } satisfies SocketUser & { name: string };
        console.log('[Socket] Dev mode - authenticated user:', payload.sub);
        next();
        return;
      }
      
      const user = await prisma.user.findUnique({ where: { id: payload.sub }, select: { id: true, role: true, isActive: true, name: true } });

      if (!user?.isActive) {
        console.log('[Socket] User not active');
        next(new Error('User is not active'));
        return;
      }

      socket.data.user = { id: user.id, role: user.role, name: user.name } satisfies SocketUser & { name: string };
      console.log('[Socket] Authenticated user:', user.id);
      next();
    } catch (error) {
      console.error('[Socket] Auth error:', error);
      next(new Error('Invalid socket token'));
    }
  });

  io.on('connection', (socket) => {
    console.log('[Socket] New connection established:', socket.id);
    const user = socket.data.user as SocketUser;
    console.log('[Socket] User connected:', user.id, 'Role:', user.role);
    
    socket.join(`user-${user.id}`);
    socket.join(`user:${user.id}`); // Alternative format for notifications
    
    if (user.role === 'ADMIN' || user.role === 'SUPER_ADMIN') {
      socket.join('admins');
    }
    
    socket.broadcast.emit('user:presence_changed', { userId: user.id, status: 'online' });

    // Ping/pong for connection testing
    socket.on('ping', () => {
      console.log(`[Socket] Ping received from user ${user.id}`);
      socket.emit('pong');
    });

    socket.on('room:join', async ({ roomId }: { roomId: string }) => {
      console.log(`[Socket] User ${user.id} attempting to join room ${roomId}`);
      
      const isDevMode = !process.env.DATABASE_URL;
      const isStaff = user.role === 'ADMIN' || user.role === 'SUPER_ADMIN' || user.role === 'INSTRUCTOR';

      // For course rooms (format: course-*), allow anyone to join if they're enrolled or it's dev mode
      const isCourseRoom = roomId.startsWith('course-');

      if (!isDevMode && isCourseRoom && user.role === 'INSTRUCTOR') {
        try {
          const chatRoom = await prisma.chatRoom.findUnique({
            where: { roomId },
            select: { id: true, ownerId: true },
          });

          if (chatRoom && chatRoom.ownerId === user.id) {
            await prisma.chatRoomMember.upsert({
              where: {
                roomId_userId: {
                  roomId: chatRoom.id,
                  userId: user.id,
                },
              },
              update: { removedAt: null, role: 'owner' },
              create: {
                roomId: chatRoom.id,
                userId: user.id,
                role: 'owner',
              },
            });
          }
        } catch (err) {
          console.error('[Socket] Failed to repair instructor room membership:', err);
        }
      }
      
      if (!isDevMode && !isStaff && !isCourseRoom) {
        // For non-course rooms, check membership
        // First find the chat room by its roomId string to get the UUID
        try {
          const chatRoom = await prisma.chatRoom.findUnique({ 
            where: { roomId },
            select: { id: true }
          });
          
          if (!chatRoom) {
            socket.emit('room:error', { roomId, error: 'Room not found' });
            return;
          }
          
          const member = await prisma.chatRoomMember.findUnique({ 
            where: { roomId_userId: { roomId: chatRoom.id, userId: user.id } } 
          });
          
          if (!member || member.removedAt) {
            socket.emit('room:error', { roomId, error: 'Not a room member' });
            return;
          }
        } catch (err) {
          console.error('[Socket] Database error on room:join validation:', err);
          socket.emit('room:error', { roomId, error: 'Failed to verify room membership' });
          return;
        }
      }

      console.log(`[Socket] User ${user.id} successfully joined room ${roomId}`);
      socket.join(roomId);
      socket.to(roomId).emit('group:member_joined', { roomId, userId: user.id });
    });

    // Direct Message handlers
    socket.on('dm:fetch', async ({ otherUserId }: { otherUserId: string }) => {
      console.log(`[Socket] DM fetch requested: ${user.id} <-> ${otherUserId}`);
      
      try {
        // Find or create DM room for the user pair
        const existingRoom = await prisma.chatRoom.findFirst({
          where: {
            type: 'DM',
            AND: [
              {
                members: {
                  some: {
                    userId: user.id,
                  },
                },
              },
              {
                members: {
                  some: {
                    userId: otherUserId,
                  },
                },
              },
            ],
          },
          include: {
            members: true,
            messages: {
              include: {
                sender: { select: { id: true, name: true, avatarUrl: true, role: true } },
              },
              orderBy: { createdAt: 'asc' },
              take: 50,
            },
          },
        });

        let room = existingRoom;

        if (!room) {
          const otherUser = await prisma.user.findUnique({
            where: { id: otherUserId },
            select: { name: true },
          });

          // Create a new DM room
          const roomKey = [user.id, otherUserId].sort().join('-');

          room = await prisma.chatRoom.create({
            data: {
              roomId: `dm-${roomKey}`,
              name: otherUser?.name || 'Direct Message',
              type: 'DM',
              ownerId: user.id,
              isActive: true,
              members: {
                create: [
                  { userId: user.id, role: 'owner' },
                  { userId: otherUserId, role: 'member' },
                ],
              },
            },
            include: {
              members: true,
              messages: {
                include: {
                  sender: { select: { id: true, name: true, avatarUrl: true, role: true } },
                },
                orderBy: { createdAt: 'asc' },
                take: 50,
              },
            },
          });
        }

        // Join the room for this socket
        socket.join(room.roomId);

        // Transform messages to use string roomId instead of UUID
        const transformedMessages = room.messages.map(msg => ({
          ...msg,
          roomId: room.roomId
        }));

        // Emit the messages to the requesting user
        socket.emit('dm:messages', {
          roomId: room.roomId,
          messages: transformedMessages,
        });

        // Also emit to the other user (if they're online)
        socket.to(`user-${otherUserId}`).emit('dm:notification', {
          roomId: room.roomId,
          otherUserId: user.id,
        });
      } catch (error) {
        socket.emit('dm:error', { error: error instanceof Error ? error.message : 'Failed to fetch DM' });
      }
    });

    socket.on('dm:send', async ({ otherUserId, content }: { otherUserId: string; content: string }) => {
      console.log(`[Socket] DM send requested from ${user.id} to ${otherUserId}`);
      
      try {
        // Find or create DM room for the user pair
        const room = await prisma.chatRoom.findFirst({
          where: {
            type: 'DM',
            AND: [
              {
                members: {
                  some: {
                    userId: user.id,
                  },
                },
              },
              {
                members: {
                  some: {
                    userId: otherUserId,
                  },
                },
              },
            ],
          },
        });

        if (!room) {
          socket.emit('dm:error', { error: 'DM room not found. Please fetch DMs first.' });
          return;
        }

        // Send the message using the existing sendChatMessage function
        const result = await sendChatMessage({
          roomId: room.roomId,
          senderId: user.id,
          content,
        });

        // Emit to both users (in the DM room)
        io.to(room.roomId).emit('message:sent', result.message);

        // Send mention notifications to mentioned users
        if (result.mentionedUsers.length > 0) {
          result.mentionedUsers.forEach((mentionedUser) => {
            io.to(`user-${mentionedUser.id}`).emit('user:mentioned', {
              messageId: result.message.id,
              senderName: result.message.sender.name,
              roomId: room.roomId,
              preview: content.slice(0, 100),
            });
          });

          // Check if any mentioned users are bots
          for (const mentionedUser of result.mentionedUsers) {
            const botUser = await prisma.user.findUnique({ where: { id: mentionedUser.id } });
            if (botUser?.role === 'AI_AGENT') {
              let agentType: 'STUDY_ASSISTANT' | 'FAQ_BOT' | 'INSTRUCTOR_COPILOT' = 'FAQ_BOT';
              if (botUser.name.includes('Study') || botUser.name.includes('Tutor')) {
                agentType = 'STUDY_ASSISTANT';
              } else if (botUser.name.includes('Copilot')) {
                agentType = 'INSTRUCTOR_COPILOT';
              }

              handleBotMention({
                messageId: result.message.id,
                roomId: room.roomId,
                senderId: user.id,
                content,
                agentType,
              })
                .then((botMessage) => {
                  io.to(room.roomId).emit('message:sent', botMessage);
                })
                .catch((error) => {
                  console.error('Error handling bot mention:', error);
                });
            }
          }
        }

        // Emit to both users for DM notifications
        io.to(`user-${user.id}`).emit('dm:message_sent', {
          roomId: room.roomId,
          messageId: result.message.id,
        });
        io.to(`user-${otherUserId}`).emit('dm:message_sent', {
          roomId: room.roomId,
          messageId: result.message.id,
        });

        // Queue a push notification to the recipient so they're alerted even
        // when the app/tab is not focused. The worker gates on the recipient's
        // toggle + registered device token, so this is safe to always enqueue.
        addNotificationJob({
          userId: otherUserId,
          type: 'push',
          title: `New message from ${result.message.sender.name}`,
          message: content.slice(0, 150),
          data: {
            type: 'dm',
            roomId: room.roomId,
            messageId: result.message.id,
            senderId: user.id,
          },
        }).catch((err) => console.error('Failed to queue DM push:', err));

        if (result.moderation.flagged) {
          io.to(room.roomId).emit('moderation:flagged', {
            messageId: result.message.id,
            reason: result.moderation.reason,
          });
          io.to('admins').emit('moderation:flagged', {
            messageId: result.message.id,
            roomId: room.roomId,
            reason: result.moderation.reason,
            senderName: result.message.sender.name,
            messagePreview: content.slice(0, 100),
          });
        }
      } catch (error) {
        socket.emit('dm:error', { error: error instanceof Error ? error.message : 'Failed to send DM' });
      }
    });


    socket.on('message:send', async (payload: { roomId: string; content: string; parentMessageId?: string }) => {
      console.log(`[Socket] User ${user.id} sending message to room ${payload.roomId}`);
      try {
        const result = await sendChatMessage({ ...payload, senderId: user.id });
        
        // In dev mode, populate sender info from socket user data
        if (result.message && user.name) {
          result.message.sender = {
            id: user.id,
            name: user.name,
            avatarUrl: null,
            role: user.role,
          };
        }
        
        console.log(`[Socket] Broadcasting message ${result.message.id} to room ${payload.roomId}`);
        io.to(payload.roomId).emit('message:sent', result.message);

        // For DM rooms, send a push notification to the other party so they
        // get alerted even if the app/tab is backgrounded. For group rooms we
        // skip push (too noisy) — only mentions trigger push in groups.
        if (payload.roomId.startsWith('dm-')) {
          // Find the other user in this DM room
          const dmRoom = await prisma.chatRoom.findUnique({
            where: { roomId: payload.roomId },
            include: { members: { select: { userId: true } } },
          });
          if (dmRoom) {
            const otherMembers = dmRoom.members.filter((m) => m.userId !== user.id);
            for (const member of otherMembers) {
              addNotificationJob({
                userId: member.userId,
                type: 'push',
                title: `New message from ${result.message.sender?.name || 'Someone'}`,
                message: payload.content.slice(0, 150),
                data: {
                  type: 'dm',
                  roomId: payload.roomId,
                  messageId: result.message.id,
                  senderId: user.id,
                },
              }).catch((err) => console.error('Failed to queue DM push (message:send):', err));
            }
          }
        }

        // Send mention notifications to mentioned users
        if (result.mentionedUsers.length > 0) {
          result.mentionedUsers.forEach((mentionedUser) => {
            io.to(`user-${mentionedUser.id}`).emit('user:mentioned', {
              messageId: result.message.id,
              senderName: result.message.sender.name,
              roomId: payload.roomId,
              preview: payload.content.slice(0, 100),
            });
          });

          // Check if any mentioned users are bots
          for (const mentionedUser of result.mentionedUsers) {
            const botUser = await prisma.user.findUnique({ where: { id: mentionedUser.id } });
            if (botUser?.role === 'AI_AGENT') {
              // Determine agent type from bot name
              let agentType: 'STUDY_ASSISTANT' | 'FAQ_BOT' | 'INSTRUCTOR_COPILOT' = 'FAQ_BOT';
              if (botUser.name.includes('Study') || botUser.name.includes('Tutor')) {
                agentType = 'STUDY_ASSISTANT';
              } else if (botUser.name.includes('Copilot')) {
                agentType = 'INSTRUCTOR_COPILOT';
              }

              // Handle the bot mention asynchronously
              handleBotMention({
                messageId: result.message.id,
                roomId: payload.roomId,
                senderId: user.id,
                content: payload.content,
                agentType,
              })
                .then((botMessage) => {
                  io.to(payload.roomId).emit('message:sent', botMessage);
                })
                .catch((error) => {
                  console.error('Error handling bot mention:', error);
                });
            }
          }
        }

        if (result.moderation.flagged) {
          io.to(payload.roomId).emit('moderation:flagged', {
            messageId: result.message.id,
            reason: result.moderation.reason,
          });
          io.to('admins').emit('moderation:flagged', {
            messageId: result.message.id,
            roomId: payload.roomId,
            reason: result.moderation.reason,
            senderName: result.message.sender.name,
            messagePreview: payload.content.slice(0, 100),
          });
        }
      } catch (error) {
        socket.emit('message:error', { error: error instanceof Error ? error.message : 'Failed to send message' });
      }
    });

    socket.on('typing:start', ({ roomId }: { roomId: string }) => {
      socket.to(roomId).emit('typing:start', { roomId, userId: user.id });
    });

    socket.on('typing:stop', ({ roomId }: { roomId: string }) => {
      socket.to(roomId).emit('typing:stop', { roomId, userId: user.id });
    });

    // Message reactions
    socket.on('message:reaction_added', async ({ messageId, emoji, roomId }: { messageId: string; emoji: string; roomId: string }) => {
      try {
        const message = await prisma.chatMessage.findUnique({ where: { id: messageId } });
        if (!message) {
          socket.emit('message:error', { error: 'Message not found' });
          return;
        }

        const reactions = (message.metadata?.reactions as Record<string, string[]>) || {};
        if (!reactions[emoji]) {
          reactions[emoji] = [];
        }
        if (!reactions[emoji].includes(user.id)) {
          reactions[emoji].push(user.id);
        }

        await prisma.chatMessage.update({
          where: { id: messageId },
          data: { metadata: { ...message.metadata, reactions } },
        });

        io.to(roomId).emit('message:reaction_added', { messageId, emoji, userId: user.id, reactions });

        // Log event
        await prisma.activityEventLog.create({
          data: {
            eventType: 'message:reaction_added',
            payload: { messageId, emoji, userId: user.id, roomId },
            status: 'PROCESSED',
            processedAt: new Date(),
          },
        });
      } catch (error) {
        socket.emit('message:error', { error: error instanceof Error ? error.message : 'Failed to add reaction' });
      }
    });

    socket.on('message:reaction_removed', async ({ messageId, emoji, roomId }: { messageId: string; emoji: string; roomId: string }) => {
      try {
        const message = await prisma.chatMessage.findUnique({ where: { id: messageId } });
        if (!message) {
          socket.emit('message:error', { error: 'Message not found' });
          return;
        }

        const reactions = (message.metadata?.reactions as Record<string, string[]>) || {};
        if (reactions[emoji]) {
          reactions[emoji] = reactions[emoji].filter((id) => id !== user.id);
          if (reactions[emoji].length === 0) {
            delete reactions[emoji];
          }
        }

        await prisma.chatMessage.update({
          where: { id: messageId },
          data: { metadata: { ...message.metadata, reactions } },
        });

        io.to(roomId).emit('message:reaction_removed', { messageId, emoji, userId: user.id, reactions });

        // Log event
        await prisma.activityEventLog.create({
          data: {
            eventType: 'message:reaction_removed',
            payload: { messageId, emoji, userId: user.id, roomId },
            status: 'PROCESSED',
            processedAt: new Date(),
          },
        });
      } catch (error) {
        socket.emit('message:error', { error: error instanceof Error ? error.message : 'Failed to remove reaction' });
      }
    });

    // Message read receipts
    socket.on('message:read', async ({ messageId, roomId }: { messageId: string; roomId: string }) => {
      try {
        const message = await prisma.chatMessage.findUnique({ where: { id: messageId } });
        if (!message) {
          socket.emit('message:error', { error: 'Message not found' });
          return;
        }

        // Track read receipt
        if (!readReceipts.has(messageId)) {
          readReceipts.set(messageId, new Set());
        }
        readReceipts.get(messageId)!.add(user.id);

        // Update message metadata with read status
        const readBy = Array.from(readReceipts.get(messageId) || []);
        await prisma.chatMessage.update({
          where: { id: messageId },
          data: { metadata: { ...message.metadata, readBy } },
        });

        io.to(roomId).emit('message:read', { messageId, userId: user.id, readBy });

        // Log event
        await prisma.activityEventLog.create({
          data: {
            eventType: 'message:read_by',
            payload: { messageId, userId: user.id, roomId },
            status: 'PROCESSED',
            processedAt: new Date(),
          },
        });
      } catch (error) {
        socket.emit('message:error', { error: error instanceof Error ? error.message : 'Failed to mark message as read' });
      }
    });

    // Voice/Video Call Events
    socket.on('call:started', async ({ roomId, callType, meetingUrl }: { roomId: string; callType: 'voice' | 'video'; meetingUrl: string }) => {
      try {
        io.to(roomId).emit('call:started', { roomId, startedBy: user.id, callType, meetingUrl, startedAt: new Date().toISOString() });

        // Log event
        await prisma.activityEventLog.create({
          data: {
            eventType: 'call:started',
            payload: { roomId, userId: user.id, callType, meetingUrl },
            status: 'PROCESSED',
            processedAt: new Date(),
          },
        });
      } catch (error) {
        socket.emit('message:error', { error: error instanceof Error ? error.message : 'Failed to start call' });
      }
    });

    socket.on('call:user_joined', async ({ roomId, callId }: { roomId: string; callId: string }) => {
      try {
        io.to(roomId).emit('call:user_joined', { roomId, userId: user.id, callId });

        await prisma.activityEventLog.create({
          data: {
            eventType: 'call:user_joined',
            payload: { roomId, userId: user.id, callId },
            status: 'PROCESSED',
            processedAt: new Date(),
          },
        });
      } catch (error) {
        socket.emit('message:error', { error: error instanceof Error ? error.message : 'Failed to join call' });
      }
    });

    socket.on('call:user_left', async ({ roomId, callId }: { roomId: string; callId: string }) => {
      try {
        io.to(roomId).emit('call:user_left', { roomId, userId: user.id, callId });

        await prisma.activityEventLog.create({
          data: {
            eventType: 'call:user_left',
            payload: { roomId, userId: user.id, callId },
            status: 'PROCESSED',
            processedAt: new Date(),
          },
        });
      } catch (error) {
        socket.emit('message:error', { error: error instanceof Error ? error.message : 'Failed to leave call' });
      }
    });

    socket.on('call:ended', async ({ roomId, callId, duration, recordingUrl, targetUserId }: { roomId: string; callId: string; duration: number; recordingUrl?: string; targetUserId?: string }) => {
      try {
        // Group/room calls: notify everyone in the room.
        if (roomId) {
          io.to(roomId).emit('call:ended', { roomId, callId, endedBy: user.id, duration, recordingUrl, endedAt: new Date().toISOString() });
        }

        // 1:1 peer-to-peer calls: relay end signal to the remote peer's user
        // channel ONLY when there's no room broadcast — otherwise the peer is
        // already in the room and would receive call:ended twice. Clients can
        // still de-dupe by callId, but skipping the duplicate avoids a UX
        // flicker on clients that don't.
        if (targetUserId && !roomId) {
          io.to(`user-${targetUserId}`).emit('call:ended', { callId, endedBy: user.id, duration, endedAt: new Date().toISOString() });
        }

        // Log event
        await prisma.activityEventLog.create({
          data: {
            eventType: 'call:ended',
            payload: { roomId, userId: user.id, callId, duration, recordingUrl },
            status: 'PROCESSED',
            processedAt: new Date(),
          },
        });
      } catch (error) {
        socket.emit('message:error', { error: error instanceof Error ? error.message : 'Failed to end call' });
      }
    });

    // WebRTC signaling events (for peer-to-peer call setup)
    socket.on('call:invite', ({ targetUserId, callType, callId }: { targetUserId: string; callType: 'voice' | 'video'; callId?: string }) => {
      io.to(`user-${targetUserId}`).emit('call:ringing', {
        fromUserId: user.id,
        callType,
        callId,
      });

      // Push so the recipient gets an alert even when the app/tab is backgrounded.
      // Priority 1 (highest) so it jumps ahead of lower-priority notification jobs.
      addNotificationJob({
        userId: targetUserId,
        type: 'push',
        title: `Incoming ${callType === 'video' ? '📹 video' : '📞 voice'} call`,
        message: `${user.name} is calling you`,
        data: {
          type: 'incoming_call',
          callType,
          callId: callId ?? '',
          callerId: user.id,
          callerName: user.name,
        },
      }, { priority: 1 }).catch((err) =>
        console.error('[Push] Failed to queue call-invite push:', err)
      );
    });

    socket.on('call:accepted', ({ targetUserId, callId }: { targetUserId: string; callId?: string }) => {
      io.to(`user-${targetUserId}`).emit('call:accepted', { fromUserId: user.id, callId });
    });

    socket.on('call:rejected', ({ targetUserId }: { targetUserId: string }) => {
      io.to(`user-${targetUserId}`).emit('call:rejected', { fromUserId: user.id });
    });

    socket.on('call:signal', ({ targetUserId, signal, callId }: { targetUserId: string; signal: Record<string, unknown>; callId: string }) => {
      io.to(`user-${targetUserId}`).emit('call:signal', { fromUserId: user.id, signal, callId });
    });

    // Message editing
    socket.on('message:edit', async ({ messageId, content, roomId }: { messageId: string; content: string; roomId: string }) => {
      try {
        const message = await prisma.chatMessage.findUnique({ where: { id: messageId } });
        if (!message) {
          socket.emit('message:error', { error: 'Message not found' });
          return;
        }

        // Only the sender can edit their own message
        if (message.senderId !== user.id) {
          socket.emit('message:error', { error: 'You can only edit your own messages' });
          return;
        }

        const updated = await prisma.chatMessage.update({
          where: { id: messageId },
          data: { content, isEdited: true },
          include: { sender: { select: { id: true, name: true, avatarUrl: true, role: true } } },
        });

        io.to(roomId).emit('message:edited', { messageId, content: updated.content, isEdited: true, editedAt: updated.updatedAt });

        // Log event
        await prisma.activityEventLog.create({
          data: {
            eventType: 'message:edited',
            payload: { messageId, userId: user.id, roomId, newContent: content },
            status: 'PROCESSED',
            processedAt: new Date(),
          },
        });
      } catch (error) {
        socket.emit('message:error', { error: error instanceof Error ? error.message : 'Failed to edit message' });
      }
    });

    // Message deletion
    socket.on('message:delete', async ({ messageId, roomId }: { messageId: string; roomId: string }) => {
      try {
        const message = await prisma.chatMessage.findUnique({ where: { id: messageId } });
        if (!message) {
          socket.emit('message:error', { error: 'Message not found' });
          return;
        }

        // Only the sender or admin can delete a message
        const isAdmin = user.role === 'ADMIN' || user.role === 'SUPER_ADMIN';
        if (message.senderId !== user.id && !isAdmin) {
          socket.emit('message:error', { error: 'You can only delete your own messages' });
          return;
        }

        await prisma.chatMessage.update({
          where: { id: messageId },
          data: { isDeleted: true },
        });

        io.to(roomId).emit('message:deleted', { messageId, deletedBy: user.id });

        // Log event
        await prisma.activityEventLog.create({
          data: {
            eventType: 'message:deleted',
            payload: { messageId, userId: user.id, roomId, originalSenderId: message.senderId },
            status: 'PROCESSED',
            processedAt: new Date(),
          },
        });
      } catch (error) {
        socket.emit('message:error', { error: error instanceof Error ? error.message : 'Failed to delete message' });
      }
    });

    socket.on('disconnect', () => {
      socket.broadcast.emit('user:presence_changed', { userId: user.id, status: 'offline', lastSeenAt: new Date().toISOString() });
    });
  });
}
