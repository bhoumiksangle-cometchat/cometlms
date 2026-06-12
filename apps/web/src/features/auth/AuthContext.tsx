import React, { createContext, ReactNode, useCallback, useEffect, useState } from 'react';
import { apiClient } from '../../lib/apiClient';
import { connectSocket } from '../../lib/socket';

export interface User {
  id: string;
  email: string;
  name: string;
  role: 'STUDENT' | 'INSTRUCTOR' | 'ADMIN' | 'SUPER_ADMIN';
  avatarUrl?: string;
  isActive: boolean;
  isVerified: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  error: string | null;

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
                apiClient.setToken(refreshed.data.accessToken);
                response = await apiClient.getMe();
              }
            }
          }

          if (response && response.success && response.data) {
            setUser(response.data);
            connectSocket(token);
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
  }, []);

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
      setUser(newUser);

      // Connect to Socket.IO
      connectSocket(tokens.accessToken);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Registration failed';
      setError(message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

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
      setUser(loggedInUser);

      // Connect to Socket.IO
      connectSocket(tokens.accessToken);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Login failed';
      setError(message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const logout = useCallback(async () => {
    setError(null);
    setIsLoading(true);

    try {
      await apiClient.logout();
    } catch (err) {
      console.error('Logout error:', err);
    } finally {
      // Clear auth state
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
      apiClient.setToken(null);
      setUser(null);
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
    register,
    login,
    logout,
    clearError,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

