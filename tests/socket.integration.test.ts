import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import { io as ioClient, Socket } from 'socket.io-client';
import jwt from 'jsonwebtoken';

// Mock test setup
describe('Socket.IO Real-Time Chat', () => {
  let server: any;
  let io: SocketIOServer;
  let clientSocket: Socket;
  const JWT_SECRET = 'test-secret-key';

  const createTestToken = (userId: string, role: string = 'STUDENT') => {
    return jwt.sign({ sub: userId, role }, JWT_SECRET);
  };

  beforeAll((done) => {
    // Create HTTP server with Socket.IO
    server = createServer();
    io = new SocketIOServer(server, {
      cors: {
        origin: 'http://localhost:3001',
        credentials: true,
      },
    });

    // Mock auth middleware
    io.use((socket, next) => {
      const token = socket.handshake.auth.token as string;
      if (!token) {
        next(new Error('Authentication required'));
        return;
      }

      try {
        const payload = jwt.verify(token, JWT_SECRET) as jwt.JwtPayload & { role: string };
        socket.data.user = { id: payload.sub as string, role: payload.role };
        next();
      } catch {
        next(new Error('Invalid socket token'));
      }
    });

    // Mock connection handler
    io.on('connection', (socket) => {
      socket.on('message:send', (payload) => {
        io.to(payload.roomId).emit('message:sent', {
          id: 'msg-1',
          ...payload,
          senderId: socket.data.user.id,
          sender: { id: socket.data.user.id, name: 'Test User' },
          createdAt: new Date().toISOString(),
        });
      });

      socket.on('typing:start', ({ roomId }) => {
        socket.to(roomId).emit('typing:start', { roomId, userId: socket.data.user.id });
      });

      socket.on('message:reaction_added', ({ messageId, emoji, roomId }) => {
        io.to(roomId).emit('message:reaction_added', {
          messageId,
          emoji,
          userId: socket.data.user.id,
        });
      });

      socket.on('room:join', ({ roomId }) => {
        socket.join(roomId);
        socket.emit('room:joined', { roomId });
      });
    });

    server.listen(3001, () => {
      const token = createTestToken('user-123');
      clientSocket = ioClient('http://localhost:3001', {
        auth: { token },
        transports: ['websocket'],
      });

      clientSocket.on('connect', () => {
        done();
      });
    });
  });

  afterAll(() => {
    clientSocket.disconnect();
    io.close();
    server.close();
  });

  it('should connect to Socket.IO server with JWT auth', (done) => {
    expect(clientSocket.connected).toBe(true);
    done();
  });

  it('should send and receive messages', (done) => {
    const roomId = 'test-room-1';

    clientSocket.on('message:sent', (message) => {
      expect(message.content).toBe('Hello World');
      expect(message.senderId).toBe('user-123');
      done();
    });

    clientSocket.emit('message:send', {
      roomId,
      content: 'Hello World',
    });
  });

  it('should handle typing indicators', (done) => {
    const roomId = 'test-room-2';

    // Create a second client to receive typing event
    const token = createTestToken('user-456');
    const secondClient = ioClient('http://localhost:3001', {
      auth: { token },
      transports: ['websocket'],
    });

    secondClient.on('connect', () => {
      secondClient.on('typing:start', ({ userId }) => {
        expect(userId).toBe('user-123');
        secondClient.disconnect();
        done();
      });

      // First client joins room
      clientSocket.emit('room:join', { roomId });
      clientSocket.on('room:joined', () => {
        // First client emits typing
        clientSocket.emit('typing:start', { roomId });
      });
    });
  });

  it('should handle message reactions', (done) => {
    const roomId = 'test-room-3';
    const messageId = 'msg-test-1';

    clientSocket.on('message:reaction_added', ({ emoji, userId }) => {
      expect(emoji).toBe('👍');
      expect(userId).toBe('user-123');
      done();
    });

    clientSocket.emit('message:reaction_added', {
      messageId,
      emoji: '👍',
      roomId,
    });
  });

  it('should join rooms', (done) => {
    const roomId = 'test-room-4';

    clientSocket.on('room:joined', ({ roomId: joinedRoomId }) => {
      expect(joinedRoomId).toBe(roomId);
      done();
    });

    clientSocket.emit('room:join', { roomId });
  });

  it('should handle authentication failure', (done) => {
    const badToken = 'invalid-token';
    const failClient = ioClient('http://localhost:3001', {
      auth: { token: badToken },
      transports: ['websocket'],
    });

    failClient.on('connect_error', (error) => {
      expect(error.message).toContain('Invalid socket token');
      done();
    });
  });
});
