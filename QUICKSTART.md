# Learning Management System - Quick Start Guide

## 🚀 Getting Started

This is a full-stack Learning Management System with real-time chat, AI tutoring, and video calling.

### Prerequisites

- Node.js 20+ LTS
- npm or yarn
- macOS, Linux, or Windows with WSL2

### Installation

1. **Install dependencies**

```bash
npm install
```

2. **Start development servers**

```bash
npm run dev
```

This will start:
- **Backend API**: http://localhost:3000
- **Frontend**: http://localhost:5173

HTTP Deployment Note:
- Configure all public URLs using `http://` values.
- Keep `CLIENT_URL`, `WEB_URL`, `FRONTEND_URL`, and `VITE_API_URL` protocol-consistent.

### Architecture

```
Frontend (React + Vite)    ←→    Backend (Express + Socket.IO)
- Zustand state             ←→    - Real-time chat
- TanStack Query            ←→    - JWT authentication
- Socket.IO client          ←→    - PostgreSQL (optional)
- Tailwind CSS              ←→    - AI agent integration
```

## 🔐 Authentication

The system supports two authentication modes:

### Development Mode (No Database Required)

When `DATABASE_URL` is not set, the app uses an in-memory auth store for quick testing:

```bash
# Auth is enabled by default - no setup needed!
npm run dev
```

**Test Credentials:**

Register or login with any email/password combination:

```
Email: student@example.com
Password: Password123
```

### Production Mode (PostgreSQL Required)

To use PostgreSQL:

1. **Set DATABASE_URL** in `.env`

```env
DATABASE_URL=postgresql://user:password@localhost:5432/lms_db
```

2. **Run migrations**

```bash
cd apps/api
npx prisma migrate dev
```

## 🎯 Testing the Full Stack

### 1. Start the servers

```bash
npm run dev
```

Wait for both servers to be ready (typically 5-10 seconds).

### 2. Test Registration

```bash
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "Password123",
    "name": "Test User"
  }'
```

Expected response:

```json
{
  "success": true,
  "data": {
    "user": {
      "id": "uuid",
      "email": "test@example.com",
      "name": "Test User",
      "role": "STUDENT"
    },
    "tokens": {
      "accessToken": "eyJhbG...",
      "refreshToken": "eyJhbG..."
    }
  }
}
```

### 3. Test Authentication

Use the token from registration to access protected routes:

```bash
curl http://localhost:3000/api/auth/me \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

### 4. Test Chat (Socket.IO)

Open your browser developer console and run:

```javascript
// This is automatically connected in the frontend when you log in
// You can also test manually:

const token = 'YOUR_ACCESS_TOKEN';
const socket = io('http://localhost:3000', {
  auth: { token },
  transports: ['websocket']
});

socket.on('connect', () => {
  console.log('Connected to Socket.IO');
  
  // Join a room
  socket.emit('room:join', { roomId: 'test-room' });
  
  // Send a message
  socket.emit('message:send', {
    roomId: 'test-room',
    content: 'Hello everyone!'
  });
  
  // Listen for new messages
  socket.on('message:sent', (message) => {
    console.log('New message:', message);
  });
});
```

## 📁 Project Structure

```
lms/
├── apps/
│   ├── api/                    # Express backend
│   │   ├── src/
│   │   │   ├── modules/        # Feature modules
│   │   │   │   ├── auth/       # Authentication (JWT, register, login)
│   │   │   │   ├── chat/       # Real-time chat (Socket.IO)
│   │   │   │   ├── courses/    # Course management
│   │   │   │   └── ...
│   │   │   ├── middleware/     # Auth, error handling, logging
│   │   │   └── server.ts       # Express app setup
│   │   ├── prisma/
│   │   │   └── schema.prisma   # Database schema
│   │   └── .env                # Backend environment variables
│   │
│   └── web/                    # React frontend
│       ├── src/
│       │   ├── features/       # Feature modules
│       │   │   ├── auth/       # Auth context, hooks
│       │   │   ├── chat/       # Chat components, Socket.IO integration
│       │   │   └── ...
│       │   ├── lib/            # Utilities (API client, Socket.IO)
│       │   ├── pages/          # Page components
│       │   └── main.tsx        # React entry point
│       └── .env                # Frontend environment variables
│
└── packages/
    ├── shared-types/           # Shared TypeScript types
    └── shared-utils/           # Shared utilities
```

## 🔧 Configuration

### Backend (.env)

```env
# Server
PORT=3000
NODE_ENV=development
CLIENT_URL=http://localhost:5173

# JWT
JWT_SECRET=your-secret-key
JWT_REFRESH_SECRET=your-refresh-secret

# Database (optional - uses in-memory auth if not set)
DATABASE_URL=postgresql://user:password@localhost:5432/lms_db

# Redis (optional)
REDIS_URL=redis://localhost:6379

# AI Integration (optional)
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4o
```

### Frontend (.env)

```env
VITE_API_URL=http://localhost:3000
VITE_APP_NAME=LMS Platform
VITE_APP_ENVIRONMENT=development
```

## 📊 Features Implemented

### Real-Time Chat (Socket.IO)

- ✅ Message sending & receiving
- ✅ Typing indicators
- ✅ Read receipts
- ✅ Message reactions (emoji)
- ✅ @mention notifications
- ✅ Message threading (parent/child)
- ✅ Message editing & deletion
- ✅ User presence (online/offline)

### Authentication

- ✅ User registration (email/password)
- ✅ User login with JWT
- ✅ Access token & refresh tokens
- ✅ Session persistence
- ✅ Role-based access control

### Voice & Video Calls

- ✅ Call signaling events
- ✅ Call start/end logging
- ✅ Recording URL tracking
- ✅ Participant tracking

### AI Integration

- ✅ @mention bot responses
- ✅ AI agent configuration
- ✅ Activity event logging
- ✅ Engagement metrics tracking

### Moderation

- ✅ Profanity filtering
- ✅ Spam detection
- ✅ Rate limiting
- ✅ Message flagging

## 🧪 Testing

### Run Unit Tests

```bash
npm run test
```

### Run E2E Tests

```bash
npm run test:e2e
```

### Socket.IO Integration Tests

Tests for message sending, reactions, typing indicators, and more are in:

```
tests/socket.integration.test.ts
```

Run with:

```bash
npm run test
```

## 🐛 Common Issues

### Port Already in Use

If port 3000 or 5173 is already in use:

```bash
# Change port in .env
PORT=3001
VITE_DEV_SERVER_PORT=5174
```

### CORS Issues

Make sure `CLIENT_URL` in backend `.env` matches your frontend URL:

```env
CLIENT_URL=http://localhost:5173
```

### WebSocket Connection Failed

1. Check that backend is running: http://localhost:3000/api/health
2. Check browser console for errors
3. Verify `VITE_API_URL` points to correct backend

### Database Connection Failed

Either:
1. Remove `DATABASE_URL` to use in-memory auth, or
2. Set up PostgreSQL and provide connection string

## 📚 API Endpoints

### Authentication

- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login user
- `GET /api/auth/me` - Get current user
- `POST /api/auth/logout` - Logout
- `POST /api/auth/refresh` - Refresh tokens

### Chat

- `GET /api/chat/rooms/:roomId/messages` - Get message history
- `POST /api/chat/rooms/:roomId/messages` - Send message
- `POST /api/chat/rooms` - Create chat room
- `POST /api/chat/rooms/:roomId/members` - Add member
- `DELETE /api/chat/rooms/:roomId/members/:uid` - Remove member

### Courses

- `GET /api/courses` - List courses
- `GET /api/courses/:id` - Get course details
- `POST /api/courses` - Create course
- `PATCH /api/courses/:id` - Update course

## 🤝 Contributing

1. Create a feature branch
2. Make your changes
3. Run tests: `npm run test`
4. Build: `npm run build`
5. Submit a pull request

## 📝 License

MIT

## 🆘 Support

For issues and questions, visit: https://github.com/anomalyco/opencode

---

**Happy Learning! 🎓**
