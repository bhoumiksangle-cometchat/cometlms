import React from 'react';
import ReactDOM from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';
import { AuthProvider } from './features/auth/AuthContext';
import { CometChatProvider } from './cometchat/CometChatProvider';
import { CometChatCallOverlay } from './features/chat/CometChatCallOverlay';
import { App } from './pages/index';
import '@cometchat/chat-uikit-react/css-variables.css';
import './cometchat/cometchat-overrides.css';
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
          <CometChatProvider>
            <CometChatCallOverlay />
            <App />
          </CometChatProvider>
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  </React.StrictMode>,
);
