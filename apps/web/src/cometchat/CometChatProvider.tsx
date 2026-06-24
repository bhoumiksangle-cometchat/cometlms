import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { useAuth } from '../features/auth/useAuth';
import { isCometChatConfigured } from './config';
import {
  initCometChat,
  loginToCometChat,
  logoutFromCometChat,
} from './init';
import { formatCometChatError, logCometChatError } from './errors';

interface CometChatContextValue {
  /** CometChat SDK init completed. */
  isReady: boolean;
  /** The current LMS user is logged into CometChat. */
  isChatLoggedIn: boolean;
  error: string | null;
}

const CometChatContext = createContext<CometChatContextValue>({
  isReady: false,
  isChatLoggedIn: false,
  error: null,
});

export const useCometChat = () => useContext(CometChatContext);

// LocalStorage key for the server-minted CometChat auth token (Task 2).
export const COMETCHAT_TOKEN_KEY = 'cometchatAuthToken';

/**
 * Initializes CometChat once on app load and keeps the CometChat session in
 * sync with the LMS auth session. It does NOT block the LMS app tree on chat
 * login — the LMS has its own auth/public routes — so children always render.
 * Chat surfaces consume `useCometChat()` to know when chat is ready.
 */
export function CometChatProvider({ children }: { children: ReactNode }) {
  const { user, isAuthenticated } = useAuth();
  const [isReady, setIsReady] = useState(false);
  const [isChatLoggedIn, setIsChatLoggedIn] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const loggedInUidRef = useRef<string | null>(null);

  // Initialize the SDK once on mount.
  useEffect(() => {
    if (!isCometChatConfigured()) {
      console.warn(
        '[CometChat] Skipping init — VITE_COMETCHAT_APP_ID / VITE_COMETCHAT_REGION not set.',
      );
      return;
    }
    let cancelled = false;
    initCometChat()
      .then(() => {
        if (!cancelled) setIsReady(true);
      })
      .catch((e) => {
        logCometChatError(e);
        if (!cancelled) setError(formatCometChatError(e));
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Sync CometChat login with the LMS session.
  useEffect(() => {
    if (!isReady) return;

    let cancelled = false;

    async function sync() {
      try {
        if (isAuthenticated && user) {
          if (loggedInUidRef.current === user.id) return;
          const authToken = localStorage.getItem(COMETCHAT_TOKEN_KEY) ?? undefined;
          await loginToCometChat(user.id, authToken);
          if (cancelled) return;
          loggedInUidRef.current = user.id;
          setIsChatLoggedIn(true);
        } else if (loggedInUidRef.current) {
          await logoutFromCometChat();
          if (cancelled) return;
          loggedInUidRef.current = null;
          setIsChatLoggedIn(false);
        }
      } catch (e) {
        logCometChatError(e);
        if (!cancelled) setError(formatCometChatError(e));
      }
    }

    sync();
    return () => {
      cancelled = true;
    };
  }, [isReady, isAuthenticated, user]);

  return (
    <CometChatContext.Provider value={{ isReady, isChatLoggedIn, error }}>
      {children}
    </CometChatContext.Provider>
  );
}
