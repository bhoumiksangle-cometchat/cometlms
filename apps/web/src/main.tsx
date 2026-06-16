import React from 'react';
import ReactDOM from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';
import { AuthProvider } from './features/auth/AuthContext';
import { ChatProvider } from './features/chat/ChatProvider';
import { CallManagerProvider } from './features/chat/CallManager';
import { App } from './pages/index';
import './styles.css';

// Register Firebase Messaging service worker on app load
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/firebase-messaging-sw.js')
    .then((registration) => console.log('[SW] Registered:', registration.scope))
    .catch((error) => console.error('[SW] Registration failed:', error));
}

const queryClient = new QueryClient();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthProvider>
          <ChatProvider>
            <CallManagerProvider>
              <App />
            </CallManagerProvider>
          </ChatProvider>
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  </React.StrictMode>,
);
