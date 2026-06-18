import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import { io as ioClient, Socket } from 'socket.io-client';
import jwt from 'jsonwebtoken';

describe('Socket.IO Real-Time Chat', () => {
  let server: ReturnType<typeof createServer>;
  let io: SocketIOServer;
  let clientSocket: Socket;
  const JWT_SECRET = 'test-secret-key';
  const TEST_PORT = 3099;

  const createTestToken = (userId: string, role = 'STUDENT') =>
    jwt.sign({ sub: userId, role }, JWT_SECRET);

  // ── Setup: promise-based, no done() callback ──────────────────────────────
  beforeAll(
    () =>
      new Promise<void>((resolve) => {
        server = createServer();
        io = new SocketIOServer(server, {
          cors: { origin: `http://localhost:${TEST_PORT}`, credentials: true },
        });

        // Auth middleware
        io.use((socket, next) => {
          const token = socket.handshake.auth.token as string;
          if (!token) { next(new Error('Authentication required')); return; }
          try {
            const payload = jwt.verify(token, JWT_SECRET) as jwt.JwtPayload & { role: string };
            socket.data.user = { id: payload.sub as string, role: payload.role };
            next();
          } catch {
            next(new Error('Invalid socket token'));
          }
        });

        // Event handlers
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
              messageId, emoji, userId: socket.data.user.id,
            });
          });

          socket.on('room:join', ({ roomId }) => {
            socket.join(roomId);
            socket.emit('room:joined', { roomId });
          });
        });

        server.listen(TEST_PORT, () => {
          clientSocket = ioClient(`http://localhost:${TEST_PORT}`, {
            auth: { token: createTestToken('user-123') },
            transports: ['websocket'],
          });
          clientSocket.once('connect', resolve);
        });
      }),
  );

  // ── Teardown ──────────────────────────────────────────────────────────────
  afterAll(
    () =>
      new Promise<void>((resolve) => {
        clientSocket.disconnect();
        io.close(() => server.close(() => resolve()));
      }),
  );

  // ── Tests ─────────────────────────────────────────────────────────────────

  it('should connect to Socket.IO server with JWT auth', () => {
    expect(clientSocket.connected).toBe(true);
  });

  it('should send and receive messages', () =>
    new Promise<void>((resolve) => {
      clientSocket.once('message:sent', (message) => {
        expect(message.content).toBe('Hello World');
        expect(message.senderId).toBe('user-123');
        resolve();
      });
      clientSocket.emit('message:send', { roomId: 'test-room-1', content: 'Hello World' });
    }));

  it('should broadcast typing indicators to room members', () =>
    new Promise<void>((resolve) => {
      const roomId = 'test-room-typing';
      const secondClient = ioClient(`http://localhost:${TEST_PORT}`, {
        auth: { token: createTestToken('user-456') },
        transports: ['websocket'],
      });

      secondClient.once('connect', () => {
        // Both clients join the room; only then emit typing
        let joined = 0;
        const onJoined = () => {
          if (++joined === 2) clientSocket.emit('typing:start', { roomId });
        };
        secondClient.emit('room:join', { roomId });
        secondClient.once('room:joined', onJoined);
        clientSocket.emit('room:join', { roomId });
        clientSocket.once('room:joined', onJoined);

        secondClient.once('typing:start', ({ userId }) => {
          expect(userId).toBe('user-123');
          secondClient.disconnect();
          resolve();
        });
      });
    }));

  it('should handle message reactions', () =>
    new Promise<void>((resolve) => {
      const roomId = 'test-room-reactions';
      // Join the room first so io.to(roomId) delivers back to this client
      clientSocket.emit('room:join', { roomId });
      clientSocket.once('room:joined', () => {
        clientSocket.once('message:reaction_added', ({ emoji, userId }) => {
          expect(emoji).toBe('👍');
          expect(userId).toBe('user-123');
          resolve();
        });
        clientSocket.emit('message:reaction_added', {
          messageId: 'msg-test-1', emoji: '👍', roomId,
        });
      });
    }));

  it('should join rooms and confirm join event', () =>
    new Promise<void>((resolve) => {
      const roomId = 'test-room-join-confirm';
      clientSocket.once('room:joined', ({ roomId: joined }) => {
        expect(joined).toBe(roomId);
        resolve();
      });
      clientSocket.emit('room:join', { roomId });
    }));

  it('should reject connection with invalid JWT', () =>
    new Promise<void>((resolve) => {
      const failClient = ioClient(`http://localhost:${TEST_PORT}`, {
        auth: { token: 'not-a-valid-jwt' },
        transports: ['websocket'],
      });
      failClient.once('connect_error', (error) => {
        expect(error.message).toContain('Invalid socket token');
        failClient.disconnect();
        resolve();
      });
    }));

  it('should reject connection with no token', () =>
    new Promise<void>((resolve) => {
      const noAuthClient = ioClient(`http://localhost:${TEST_PORT}`, {
        transports: ['websocket'],
      });
      noAuthClient.once('connect_error', (error) => {
        expect(error.message).toContain('Authentication required');
        noAuthClient.disconnect();
        resolve();
      });
    }));
});
