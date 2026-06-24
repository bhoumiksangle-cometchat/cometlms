import { useEffect, useState, useCallback } from 'react';
import { CometChat } from '@cometchat/chat-sdk-javascript';
import { CometChatOngoingCall } from '@cometchat/chat-uikit-react';
import { useCometChat } from '../../cometchat/CometChatProvider';
import { Video, PhoneOff, X } from 'lucide-react';
import { OFFICE_HOURS_GROUP_ID } from './OfficeHoursCall';

/**
 * Floating button that appears in the bottom-right corner for students
 * when an office hours session is active. Clicking it joins the group call.
 */
export function JoinOfficeHoursButton() {
  const { isChatLoggedIn } = useCometChat();
  const [sessionActive, setSessionActive] = useState(false);
  const [callSessionId, setCallSessionId] = useState<string | null>(null);
  const [inCall, setInCall] = useState(false);
  const [loading, setLoading] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  // Listen for group calls on the office hours group
  useEffect(() => {
    if (!isChatLoggedIn) return;

    const listenerId = 'student-office-hours-fab-listener';
    CometChat.addCallListener(
      listenerId,
      new CometChat.CallListener({
        onIncomingCallReceived: (call: CometChat.Call) => {
          const receiverId = (call as any).getReceiverId?.() || '';
          if (receiverId === OFFICE_HOURS_GROUP_ID) {
            setSessionActive(true);
            setCallSessionId(call.getSessionId());
            setDismissed(false);
          }
        },
        onOutgoingCallAccepted: (call: CometChat.Call) => {
          setInCall(true);
          setCallSessionId(call.getSessionId());
        },
        onIncomingCallCancelled: () => {
          setSessionActive(false);
          setInCall(false);
          setCallSessionId(null);
        },
        onCallEndedMessageReceived: () => {
          setSessionActive(false);
          setInCall(false);
          setCallSessionId(null);
        },
      })
    );

    return () => {
      CometChat.removeCallListener(listenerId);
    };
  }, [isChatLoggedIn]);

  // Poll for active session in the office hours group
  const checkActiveSession = useCallback(async () => {
    if (!isChatLoggedIn) return;
    try {
      const activeCall = await CometChat.getActiveCall();
      if (activeCall && activeCall.getSessionId()) {
        const receiverId = (activeCall as any).getReceiverId?.() || '';
        if (receiverId === OFFICE_HOURS_GROUP_ID || !receiverId) {
          setSessionActive(true);
          setCallSessionId(activeCall.getSessionId());
        }
      }
    } catch {
      // No active call
    }
  }, [isChatLoggedIn]);

  useEffect(() => {
    if (!isChatLoggedIn) return;
    checkActiveSession();
    const interval = setInterval(checkActiveSession, 15000);
    return () => clearInterval(interval);
  }, [isChatLoggedIn, checkActiveSession]);

  // Join the active session
  const joinSession = async () => {
    if (!callSessionId) return;
    setLoading(true);

    try {
      await CometChat.acceptCall(callSessionId);
      setInCall(true);
    } catch {
      // Might already be accepted — just show call UI
      setInCall(true);
    } finally {
      setLoading(false);
    }
  };

  // Leave the call
  const leaveCall = async () => {
    if (!callSessionId) return;
    try {
      await CometChat.endCall(callSessionId);
    } catch {
      // Force-reset
    }
    setInCall(false);
    setCallSessionId(null);
    setSessionActive(false);
  };

  // Show the ongoing call full-screen
  if (inCall && callSessionId) {
    return (
      <div style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        background: '#000',
        display: 'flex',
        flexDirection: 'column',
      }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '12px 20px',
          background: 'rgba(0,0,0,0.8)',
          color: '#fff',
          zIndex: 10000,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Video size={18} color="#10b981" />
            <span style={{ fontWeight: 700, fontSize: 14 }}>Office Hours — Live</span>
          </div>
          <button
            onClick={leaveCall}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '8px 16px',
              background: '#ef4444',
              color: '#fff',
              border: 'none',
              borderRadius: 8,
              cursor: 'pointer',
              fontSize: 13,
              fontWeight: 600,
            }}
          >
            <PhoneOff size={14} />
            Leave
          </button>
        </div>
        <div style={{ flex: 1 }}>
          <CometChatOngoingCall sessionID={callSessionId} />
        </div>
      </div>
    );
  }

  // Don't show button if no session, not logged in, or dismissed
  if (!isChatLoggedIn || !sessionActive || dismissed) {
    return null;
  }

  // Floating action button
  return (
    <div
      style={{
        position: 'fixed',
        bottom: 24,
        right: 24,
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        gap: 10,
      }}
    >
      {/* Dismiss button */}
      <button
        onClick={() => setDismissed(true)}
        aria-label="Dismiss"
        style={{
          width: 28,
          height: 28,
          borderRadius: '50%',
          border: 'none',
          background: 'rgba(0,0,0,0.4)',
          color: '#fff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          fontSize: 12,
        }}
      >
        <X size={14} />
      </button>

      {/* Join button */}
      <button
        onClick={joinSession}
        disabled={loading}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: '14px 22px',
          background: 'linear-gradient(135deg, #10b981, #059669)',
          color: '#fff',
          border: 'none',
          borderRadius: 50,
          cursor: loading ? 'not-allowed' : 'pointer',
          fontSize: 14,
          fontWeight: 700,
          boxShadow: '0 6px 24px rgba(16, 185, 129, 0.4)',
          animation: 'fab-pulse 2s ease-in-out infinite',
          transition: 'transform 0.15s',
        }}
        onMouseEnter={(e) => (e.currentTarget.style.transform = 'scale(1.05)')}
        onMouseLeave={(e) => (e.currentTarget.style.transform = 'scale(1)')}
      >
        <Video size={18} />
        <span>Join Office Hours</span>
        <span style={{
          width: 10,
          height: 10,
          borderRadius: '50%',
          background: '#fff',
          animation: 'pulse 1.5s infinite',
        }} />
      </button>

      <style>{`
        @keyframes fab-pulse {
          0%, 100% { box-shadow: 0 6px 24px rgba(16, 185, 129, 0.4); }
          50% { box-shadow: 0 8px 32px rgba(16, 185, 129, 0.6); }
        }
      `}</style>
    </div>
  );
}
