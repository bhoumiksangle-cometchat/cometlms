// Firebase Messaging Service Worker
// Handles push messages when the app tab is not focused or closed

// Import Firebase compat scripts (required for service workers)
importScripts('https://www.gstatic.com/firebasejs/10.14.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.14.0/firebase-messaging-compat.js');

// Initialize Firebase in the service worker
// The messaging SDK only needs these fields for receiving push messages
firebase.initializeApp({
  apiKey: 'AIzaSyB8Sw6FQYs1mO5bKNIjd5ZIcYwtwrzXLhI',
  authDomain: 'cometlms.firebaseapp.com',
  projectId: 'cometlms',
  messagingSenderId: '475640851640',
  appId: '1:475640851640:web:1b698726d699fd0297d84d',
});

const messaging = firebase.messaging();

// Handle background messages (when app is not in focus)
// Also handles foreground messages for display since Chrome suppresses
// auto-display when the tab is active.
messaging.onBackgroundMessage((payload) => {
  const title = payload.notification?.title || payload.data?.title || 'New Notification';
  const body = payload.notification?.body || payload.data?.body || '';

  return self.registration.showNotification(title, {
    body,
    icon: '/logo.png',
    badge: '/logo.png',
    data: payload.data,
  });
});

// Handle notification click — focus or open window to home screen
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      // If there's already a window open at our origin, focus it
      for (const client of windowClients) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          return client.focus();
        }
      }
      // Otherwise, open a new window to the home screen
      return clients.openWindow('/');
    })
  );
});
