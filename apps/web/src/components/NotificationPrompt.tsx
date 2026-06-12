import React, { useEffect, useState } from 'react';
import { Bell, X } from 'lucide-react';
import { notificationService } from '../lib/notifications';

export function NotificationPrompt() {
  const [show, setShow] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission>('default');

  useEffect(() => {
    // Check if we should show the prompt
    const shouldShow = notificationService.isSupported() && 
                      notificationService.getPermissionStatus() === 'default' &&
                      !localStorage.getItem('notification-prompt-dismissed');
    
    setShow(shouldShow);
    setPermission(notificationService.getPermissionStatus());
  }, []);

  const handleEnable = async () => {
    const result = await notificationService.requestPermission();
    setPermission(result);
    
    if (result === 'granted') {
      // Show a test notification
      notificationService.show({
        title: 'Notifications Enabled! 🎉',
        body: 'You will now receive notifications for messages and mentions',
      });
      setShow(false);
    } else if (result === 'denied') {
      setShow(false);
      localStorage.setItem('notification-prompt-dismissed', 'true');
    }
  };

  const handleDismiss = () => {
    setShow(false);
    localStorage.setItem('notification-prompt-dismissed', 'true');
  };

  if (!show) return null;

  return (
    <div style={{
      position: 'fixed',
      top: 20,
      right: 20,
      maxWidth: 400,
      background: '#fff',
      border: '2px solid #10b981',
      borderRadius: 12,
      boxShadow: '0 10px 25px rgba(0,0,0,0.15)',
      padding: 20,
      zIndex: 9999,
      animation: 'slideIn 0.3s ease-out'
    }}>
      <button
        onClick={handleDismiss}
        style={{
          position: 'absolute',
          top: 12,
          right: 12,
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          color: '#9ca3af',
          padding: 4
        }}
        aria-label="Dismiss"
      >
        <X size={18} />
      </button>

      <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
        <div style={{
          width: 48,
          height: 48,
          borderRadius: '50%',
          background: 'linear-gradient(135deg, #10b981, #059669)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0
        }}>
          <Bell size={24} color="#fff" />
        </div>

        <div style={{ flex: 1 }}>
          <h3 style={{ margin: '0 0 8px 0', fontSize: 16, fontWeight: 700, color: '#111827' }}>
            Enable Notifications
          </h3>
          <p style={{ margin: '0 0 16px 0', fontSize: 14, color: '#4b5563', lineHeight: 1.5 }}>
            Get notified when you receive new messages, mentions, or calls. Stay connected even when you're on another tab.
          </p>

          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={handleEnable}
              style={{
                flex: 1,
                padding: '10px 16px',
                background: '#10b981',
                color: '#fff',
                border: 'none',
                borderRadius: 8,
                fontSize: 14,
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'background 0.2s'
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = '#059669'}
              onMouseLeave={(e) => e.currentTarget.style.background = '#10b981'}
            >
              Enable
            </button>
            <button
              onClick={handleDismiss}
              style={{
                flex: 1,
                padding: '10px 16px',
                background: '#f3f4f6',
                color: '#4b5563',
                border: 'none',
                borderRadius: 8,
                fontSize: 14,
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'background 0.2s'
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = '#e5e7eb'}
              onMouseLeave={(e) => e.currentTarget.style.background = '#f3f4f6'}
            >
              Not Now
            </button>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes slideIn {
          from {
            transform: translateX(100%);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }
      `}</style>
    </div>
  );
}
