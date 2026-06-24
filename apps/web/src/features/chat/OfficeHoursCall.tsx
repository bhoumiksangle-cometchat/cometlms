import { useEffect, useState, useCallback } from 'react';
import { CometChat } from '@cometchat/chat-sdk-javascript';
import {
  CometChatOngoingCall,
  CometChatUIKitCalls,
} from '@cometchat/chat-uikit-react';
import { useCometChat } from '../../cometchat/CometChatProvider';
import { Video, PhoneOff, Users, Loader } from 'lucide-react';

// Well-known group ID for office hours — one per instructor in the future,
// but for now a single shared room.
const OFFICE_HOURS_GROUP_ID = 'office-hours-room';
const OFFICE_HOURS_GROUP_NAME = 'Office Hours';

interface OfficeHoursCallProps {
  /** Instructor mode: shows start/end session controls */
  isInstructor?: boolean;
  onNotice?: (message: string) => void;
}

/**
 * Office Hours component using CometChat group video calls.
 * - Instructors can start/end a group video session.
 * - Students can join an active session.
 */
export function OfficeHoursCall({ isInstructor = false, onNotice }: OfficeHoursCallProps) {
  const { isChatLoggedIn } = useCometChat();
  const [group, setGroup] = useState<CometChat.Group | null>(null);
  const [sessionActive, setSessionActive] = useState(false);
  const [inCall, setInCall] = useState(false);
  const [callSessionId, setCallSessionId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Ensure the office hours group exists (create or fetch)
  useEffect(() => {
    if (!isChatLoggedIn) return;
    let cancelled = false;

    const ensureGroup = async () => {
      try {
        const g = await CometChat.getGroup(OFFICE_HOURS_GROUP_ID);
        if (!cancelled) setGroup(g);
      } catch (err: any) {
        // Group doesn't exist — create it (open group so students can join)
        if (err?.code === 'ERR_GUID_NOT_FOUND' || err?.message?.includes('not found')) {
          try {
            const newGroup = new CometChat.Group(
              OFFICE_HOURS_GROUP_ID,
              OFFICE_HOURS_GROUP_NAME,
              CometChat.GROUP_TYPE.PUBLIC,
              ''
            );
            const created = await CometChat.createGroup(newGroup);
            if (!cancelled) setGroup(created);
          } catch (createErr: any) {
            if (createErr?.code === 'ERR_GUID_ALREADY_EXISTS') {
              // Race condition — re-fetch
              try {
                const g = await CometChat.getGroup(OFFICE_HOURS_GROUP_ID);
                if (!cancelled) setGroup(g);
              } catch {
                if (!cancelled) setError('Unable to access office hours room');
              }
            } else {
              // Try to join if we can't create
              try {
                const g = await CometChat.joinGroup(
                  OFFICE_HOURS_GROUP_ID,
                  CometChat.GROUP_TYPE.PUBLIC as unknown as CometChat.GroupType,
                  ''
                );
                if (!cancelled) setGroup(g);
              } catch {
                if (!cancelled) setError('Unable to join office hours room');
              }
            }
          }
        } else {
          if (!cancelled) setError('Unable to load office hours room');
        }
      }
    };

    ensureGroup();
    return () => { cancelled = true; };
  }, [isChatLoggedIn]);

  // Check if there's an active call in the group (for students joining)
  const checkActiveSession = useCallback(async () => {
    if (!group) return;
    try {
      const activeCall = await CometChat.getActiveCall();
      if (activeCall && activeCall.getSessionId()) {
        setSessionActive(true);
        setCallSessionId(activeCall.getSessionId());
      }
    } catch {
      // No active call — that's fine
    }
  }, [group]);

  useEffect(() => {
    if (!isChatLoggedIn || !group) return;
    checkActiveSession();
    // Poll for active session every 10s (for students)
    if (!isInstructor) {
      const interval = setInterval(checkActiveSession, 10000);
      return () => clearInterval(interval);
    }
  }, [isChatLoggedIn, group, isInstructor, checkActiveSession]);

  // Listen for incoming group calls
  useEffect(() => {
    if (!isChatLoggedIn) return;

    const listenerId = 'office-hours-call-listener';
    CometChat.addCallListener(
      listenerId,
      new CometChat.CallListener({
        onIncomingCallReceived: (call: CometChat.Call) => {
          const receiverId = (call as any).getReceiverId?.() || '';
          if (receiverId === OFFICE_HOURS_GROUP_ID) {
            setSessionActive(true);
            setCallSessionId(call.getSessionId());
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

  // Instructor: Start a group video call
  const startSession = async () => {
    if (!group) return;
    setLoading(true);
    setError(null);

    try {
      const call = new CometChat.Call(
        OFFICE_HOURS_GROUP_ID,
        CometChat.CALL_TYPE.VIDEO,
        CometChat.RECEIVER_TYPE.GROUP
      );

      const outgoingCall = await CometChat.initiateCall(call);
      setSessionActive(true);
      setCallSessionId(outgoingCall.getSessionId());
      setInCall(true);
      onNotice?.('Office hours session started — students have been notified');
    } catch (err: any) {
      console.error('[OfficeHours] Failed to start session:', err);
      setError(err?.message || 'Failed to start office hours session');
    } finally {
      setLoading(false);
    }
  };

  // End the current session
  const endSession = async () => {
    if (!callSessionId) return;
    setLoading(true);
    try {
      await CometChat.endCall(callSessionId);
      setSessionActive(false);
      setInCall(false);
      setCallSessionId(null);
      onNotice?.('Office hours session ended');
    } catch (err: any) {
      console.error('[OfficeHours] Failed to end session:', err);
      // Force-reset UI state anyway
      setSessionActive(false);
      setInCall(false);
      setCallSessionId(null);
    } finally {
      setLoading(false);
    }
  };

  // Student/Instructor: Join the active session
  const joinSession = async () => {
    if (!callSessionId) return;
    setLoading(true);
    setError(null);

    try {
      await CometChat.acceptCall(callSessionId);
      setInCall(true);
    } catch (err: any) {
      // If "accept" fails (already accepted), try to start the call directly
      console.warn('[OfficeHours] Accept failed, joining directly:', err);
      setInCall(true);
    } finally {
      setLoading(false);
    }
  };

  // Not connected to chat
  if (!isChatLoggedIn) {
    return (
      <section className="panel">
        <div className="panel-title">
          <Video aria-hidden />
          <h2>Office Hours</h2>
        </div>
        <p style={{ color: '#6b7280', fontSize: 13 }}>Connecting to chat...</p>
      </section>
    );
  }

  // Show the ongoing call full-screen overlay when in call
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
            onClick={endSession}
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
            {isInstructor ? 'End Session' : 'Leave'}
          </button>
        </div>
        <div style={{ flex: 1 }}>
          <CometChatOngoingCall sessionID={callSessionId} />
        </div>
      </div>
    );
  }

  // ── Panel view (not in call) ──
  return (
    <section className="panel">
      <div className="panel-title">
        <Video aria-hidden />
        <h2>Office Hours</h2>
      </div>

      {error && (
        <p style={{ color: '#dc2626', fontSize: 13, margin: '0 0 10px' }}>{error}</p>
      )}

      {isInstructor ? (
        // Instructor controls
        <>
          <p style={{ margin: '0 0 12px', fontSize: 13, color: '#6b7280' }}>
            Start a live video session. All enrolled students will be able to join.
          </p>
          {sessionActive ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '8px 12px',
                background: '#ecfdf5',
                border: '1px solid #a7f3d0',
                borderRadius: 8,
                fontSize: 13,
                color: '#047857',
                fontWeight: 600,
              }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#10b981', animation: 'pulse 2s infinite' }} />
                Session is live
              </div>
              <button
                className="wide-button"
                onClick={joinSession}
                disabled={loading}
                style={{ background: '#10b981', color: '#fff' }}
              >
                {loading ? <Loader size={16} className="spin" /> : <Video size={16} />}
                Rejoin Session
              </button>
              <button
                className="wide-button"
                onClick={endSession}
                disabled={loading}
                style={{ background: '#fff', color: '#ef4444', border: '1px solid #fecaca' }}
              >
                <PhoneOff size={16} />
                End Session
              </button>
            </div>
          ) : (
            <button
              className="wide-button"
              onClick={startSession}
              disabled={loading || !group}
            >
              {loading ? <Loader size={16} className="spin" /> : <Video size={16} />}
              Start Session
            </button>
          )}
        </>
      ) : (
        // Student view
        <>
          {sessionActive ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '10px 14px',
                background: '#ecfdf5',
                border: '1px solid #a7f3d0',
                borderRadius: 8,
                fontSize: 13,
                color: '#047857',
                fontWeight: 600,
              }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#10b981', animation: 'pulse 2s infinite' }} />
                Office hours are live!
              </div>
              <button
                className="wide-button"
                onClick={joinSession}
                disabled={loading}
                style={{ background: '#10b981', color: '#fff' }}
              >
                {loading ? <Loader size={16} className="spin" /> : <Users size={16} />}
                Join Session
              </button>
            </div>
          ) : (
            <p style={{ margin: 0, fontSize: 13, color: '#6b7280' }}>
              No active session right now. The instructor will start office hours soon.
            </p>
          )}
        </>
      )}
    </section>
  );
}

export { OFFICE_HOURS_GROUP_ID };
