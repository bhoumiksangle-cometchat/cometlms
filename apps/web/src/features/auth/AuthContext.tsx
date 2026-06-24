import React, { createContext, ReactNode, useCallback, useEffect, useState } from 'react';
import { apiClient } from '../../lib/apiClient';
import { requestPermissionAndRegisterToken, removeDeviceToken, onForegroundMessage } from '../../lib/firebase-messaging';

export interface User {
  id: string;
  email: string;
  name: string;
  role: 'STUDENT' | 'INSTRUCTOR' | 'ADMIN' | 'SUPER_ADMIN';
  avatarUrl?: string;
  isActive: boolean;
  isVerified: boolean;
  pushNotificationsEnabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  error: string | null;
  pushNotificationStatus: 'granted' | 'denied' | 'pending' | null;

  // Methods
  register: (email: string, password: string, name: string, role?: 'STUDENT' | 'INSTRUCTOR') => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  clearError: () => void;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pushNotificationStatus, setPushNotificationStatus] = useState<'granted' | 'denied' | 'pending' | null>(null);

  // Request push notification permission and register FCM token
  const initializePushNotifications = useCallback(async () => {
    setPushNotificationStatus('pending');
    const result = await requestPermissionAndRegisterToken();
    setPushNotificationStatus(result);
    if (result === 'denied') {
      console.warn('[Push Notifications] Push notifications are unavailable — permission denied.');
    }
    if (result === 'granted') {
      // Subscribe to foreground messages so push notifications show up even
      // when the tab is active. Chrome doesn't auto-show notifications when
      // the page is focused — we must explicitly call showNotification.
      onForegroundMessage(async ({ title, body }) => {
        try {
          // navigator.serviceWorker.ready resolves only when a SW is active
          const reg = await navigator.serviceWorker.ready;
          await reg.showNotification(title, {
            body,
            icon: '/logo.png',
            badge: '/logo.png',
          });
        } catch (err) {
          console.error('[Push] Failed to show foreground notification:', err);
        }
      });
    }
  }, []);

  // Check if user is already logged in on mount
  useEffect(() => {
    const initAuth = async () => {
      try {
        const token = localStorage.getItem('accessToken');
        const refreshToken = localStorage.getItem('refreshToken');

        if (token) {
          apiClient.setToken(token);
          let response;
          try {
            response = await apiClient.getMe();
          } catch {
            if (refreshToken) {
              const refreshed = await apiClient.refreshToken(refreshToken);
              if (refreshed.success && refreshed.data) {
                localStorage.setItem('accessToken', refreshed.data.accessToken);
                localStorage.setItem('refreshToken', refreshed.data.refreshToken);
                if (refreshed.data.cometchatAuthToken) {
                  localStorage.setItem('cometchatAuthToken', refreshed.data.cometchatAuthToken);
                }
                apiClient.setToken(refreshed.data.accessToken);
                response = await apiClient.getMe();
              }
            }
          }

          if (response && response.success && response.data) {
            setUser(response.data);
            // Initialize push notifications after restoring auth session
            initializePushNotifications();
          } else {
            localStorage.removeItem('accessToken');
          }
        }
      } catch (err) {
        console.error('Failed to restore auth:', err);
        localStorage.removeItem('accessToken');
        apiClient.setToken(null);
      } finally {
        setIsLoading(false);
      }
    };

    initAuth();
  }, [initializePushNotifications]);

  const register = useCallback(async (email: string, password: string, name: string, role?: 'STUDENT' | 'INSTRUCTOR') => {
    setError(null);
    setIsLoading(true);

    try {
      const response = await apiClient.register(email, password, name, role);

      if (!response.success || !response.data) {
        throw new Error(response.error || 'Registration failed');
      }

      const { user: newUser, tokens } = response.data;
      apiClient.setToken(tokens.accessToken);
      localStorage.setItem('accessToken', tokens.accessToken);
      localStorage.setItem('refreshToken', tokens.refreshToken);
      if (response.data.cometchatAuthToken) {
        localStorage.setItem('cometchatAuthToken', response.data.cometchatAuthToken);
      }
      setUser(newUser);

      // Initialize push notifications after successful registration
      initializePushNotifications();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Registration failed';
      setError(message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [initializePushNotifications]);

  const login = useCallback(async (email: string, password: string) => {
    setError(null);
    setIsLoading(true);

    try {
      const response = await apiClient.login(email, password);

      if (!response.success || !response.data) {
        throw new Error(response.error || 'Login failed');
      }

      const { user: loggedInUser, tokens } = response.data;
      apiClient.setToken(tokens.accessToken);
      localStorage.setItem('accessToken', tokens.accessToken);
      localStorage.setItem('refreshToken', tokens.refreshToken);
      if (response.data.cometchatAuthToken) {
        localStorage.setItem('cometchatAuthToken', response.data.cometchatAuthToken);
      }
      setUser(loggedInUser);

      // Initialize push notifications after successful login
      initializePushNotifications();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Login failed';
      setError(message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [initializePushNotifications]);

  const logout = useCallback(async () => {
    setError(null);
    setIsLoading(true);

    try {
      // Remove device token before logging out
      await removeDeviceToken();
      await apiClient.logout();
    } catch (err) {
      console.error('Logout error:', err);
    } finally {
      // Clear auth state
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
      localStorage.removeItem('cometchatAuthToken');
      apiClient.setToken(null);
      setUser(null);
      setPushNotificationStatus(null);
      setIsLoading(false);
    }
  }, []);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const value: AuthContextType = {
    user,
    isLoading,
    isAuthenticated: !!user,
    error,
    pushNotificationStatus,
    register,
    login,
    logout,
    clearError,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

