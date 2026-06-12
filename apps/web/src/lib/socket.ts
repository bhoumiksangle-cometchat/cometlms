import { io, type Socket } from 'socket.io-client';

let socket: Socket | null = null;

export function connectSocket(token: string) {
  if (socket?.connected) {
    console.log('[Socket Client] Already connected');
    return socket;
  }

  const apiUrl = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_URL) || process.env.VITE_API_URL || 'http://localhost:3000';
  console.log('[Socket Client] Connecting to:', apiUrl);
  console.log('[Socket Client] Using token:', token ? 'Token present' : 'No token');
  
  socket = io(apiUrl, {
    auth: { token },
    transports: ['websocket', 'polling'], // Try both transports
  });

  socket.on('connect', () => {
    console.log('[Socket Client] Connected successfully! Socket ID:', socket?.id);
  });

  socket.on('connect_error', (error) => {
    console.error('[Socket Client] Connection error:', error.message);
  });

  socket.on('disconnect', (reason) => {
    console.log('[Socket Client] Disconnected. Reason:', reason);
  });

  return socket;
}

export function getSocket() {
  return socket;
}

export function disconnectSocket() {
  socket?.disconnect();
    console.log('Socket disconnected');
  socket = null;
}
