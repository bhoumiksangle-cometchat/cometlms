/**
 * CallManager — Global WebRTC calling overlay
 *
 * Wraps the existing WebRTCContext to provide:
 *  - Incoming call notification (ringing)
 *  - Outgoing call (dialling state)
 *  - Full video / voice call UI with controls
 *  - Screen-share (optional)
 *
 * Mount this ONCE near the root of the tree.
 * It listens to the global socket for call signalling events.
 */
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import {
  Camera,
  CameraOff,
  Mic,
  MicOff,
  PhoneCall,
  PhoneIncoming,
  PhoneMissed,
  PhoneOff,
  Video,
  VideoOff,
  Minimize2,
  Maximize2,
  Volume2,
} from 'lucide-react';
import { getSocket } from '../../lib/socket';
import { useAuth } from '../auth/useAuth';

// ─────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────
type CallType = 'video' | 'voice';
type CallState = 'idle' | 'ringing' | 'calling' | 'active';

interface CallInfo {
  callId: string;
  targetUserId: string;
  targetUserName: string;
  callType: CallType;
}

interface CallContextValue {
  callState: CallState;
  callInfo: CallInfo | null;
  startCall: (targetUserId: string, targetUserName: string, callType?: CallType) => void;
}

// ─────────────────────────────────────────────────────────────────
// Context
// ─────────────────────────────────────────────────────────────────
const CallCtx = createContext<CallContextValue>({
  callState: 'idle',
  callInfo: null,
  startCall: () => {},
});

export const useCallManager = () => useContext(CallCtx);

// ─────────────────────────────────────────────────────────────────
// ICE / STUN configuration
// ─────────────────────────────────────────────────────────────────
const RTC_CONFIG: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ],
};

// ─────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────
async function getMedia(video: boolean): Promise<MediaStream> {
  return navigator.mediaDevices.getUserMedia({ audio: true, video });
}

// ─────────────────────────────────────────────────────────────────
// Provider
// ─────────────────────────────────────────────────────────────────
export function CallManagerProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();

  const [callState, setCallState] = useState<CallState>('idle');
  const [callInfo, setCallInfo] = useState<CallInfo | null>(null);
  const [minimised, setMinimised] = useState(false);
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);
  const [callTimer, setCallTimer] = useState(0);
  const [hasPermError, setHasPermError] = useState(false);

  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── cleanup ───────────────────────────────────────────────────
  const teardown = useCallback(() => {
    pcRef.current?.close();
    pcRef.current = null;
    localStreamRef.current?.getTracks().forEach((t) => t.stop());
    localStreamRef.current = null;
    if (localVideoRef.current) localVideoRef.current.srcObject = null;
    if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null;
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
    setCallTimer(0);
    setCallState('idle');
    setCallInfo(null);
    setMinimised(false);
    setHasPermError(false);
    setMicOn(true);
    setCamOn(true);
  }, []);

  // ── create peer connection ─────────────────────────────────────
  const createPC = useCallback((targetUserId: string, callId: string) => {
    const socket = getSocket();
    const pc = new RTCPeerConnection(RTC_CONFIG);
    pcRef.current = pc;

    // Local tracks → peer
    localStreamRef.current?.getTracks().forEach((t) => {
      pc.addTrack(t, localStreamRef.current!);
    });

    // Remote tracks → video element
    pc.ontrack = (e) => {
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = e.streams[0];
      }
    };

    // ICE candidates → signalling
    pc.onicecandidate = (e) => {
      if (e.candidate && socket) {
        socket.emit('call:signal', {
          targetUserId,
          callId,
          signal: { type: 'ice', candidate: e.candidate },
        });
      }
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'connected') {
        setCallState('active');
        timerRef.current = setInterval(() => setCallTimer((t) => t + 1), 1000);
      }
      if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') {
        teardown();
      }
    };

    return pc;
  }, [teardown]);

  // ── start outgoing call ────────────────────────────────────────
  const startCall = useCallback(async (
    targetUserId: string,
    targetUserName: string,
    callType: CallType = 'video',
  ) => {
    const socket = getSocket();
    if (!socket || callState !== 'idle') return;

    const callId = `${user?.id}-${targetUserId}-${Date.now()}`;
    setCallInfo({ callId, targetUserId, targetUserName, callType });
    setCallState('calling');

    try {
      const stream = await getMedia(callType === 'video');
      localStreamRef.current = stream;
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }

      const pc = createPC(targetUserId, callId);
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      socket.emit('call:invite', { targetUserId, callType });
      socket.emit('call:signal', {
        targetUserId,
        callId,
        signal: { type: 'offer', sdp: offer },
      });
    } catch (err) {
      console.error('Could not start call:', err);
      setHasPermError(true);
      setTimeout(teardown, 3000);
    }
  }, [callState, user?.id, createPC, teardown]);

  // ── hang up ───────────────────────────────────────────────────
  const hangUp = useCallback(() => {
    const socket = getSocket();
    if (callInfo && socket) {
      socket.emit('call:ended', {
        roomId: callInfo.callId,
        callId: callInfo.callId,
        duration: callTimer,
      });
    }
    teardown();
  }, [callInfo, callTimer, teardown]);

  // ── reject incoming call ──────────────────────────────────────
  const rejectCall = useCallback(() => {
    const socket = getSocket();
    if (callInfo && socket) {
      socket.emit('call:rejected', { targetUserId: callInfo.targetUserId });
    }
    teardown();
  }, [callInfo, teardown]);

  // ── accept incoming call ──────────────────────────────────────
  const acceptCall = useCallback(async () => {
    if (!callInfo) return;
    const socket = getSocket();

    try {
      const stream = await getMedia(callInfo.callType === 'video');
      localStreamRef.current = stream;
      if (localVideoRef.current) localVideoRef.current.srcObject = stream;

      createPC(callInfo.targetUserId, callInfo.callId);
      socket?.emit('call:accepted', { targetUserId: callInfo.targetUserId });
      setCallState('active');
      timerRef.current = setInterval(() => setCallTimer((t) => t + 1), 1000);
    } catch {
      setHasPermError(true);
      setTimeout(teardown, 3000);
    }
  }, [callInfo, createPC, teardown]);

  // ── toggle mic / cam ─────────────────────────────────────────
  const toggleMic = () => {
    localStreamRef.current?.getAudioTracks().forEach((t) => {
      t.enabled = !t.enabled;
    });
    setMicOn((v) => !v);
  };

  const toggleCam = () => {
    localStreamRef.current?.getVideoTracks().forEach((t) => {
      t.enabled = !t.enabled;
    });
    setCamOn((v) => !v);
  };

  // ── socket listeners ──────────────────────────────────────────
  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    // Someone is calling us
    const onRinging = ({ fromUserId, callType }: { fromUserId: string; callType: CallType }) => {
      if (callState !== 'idle') return; // Already in a call
      setCallInfo({
        callId: `${fromUserId}-${user?.id}`,
        targetUserId: fromUserId,
        targetUserName: fromUserId, // Will be replaced by real name when we have contacts
        callType,
      });
      setCallState('ringing');
    };

    // They accepted our outgoing call — nothing extra needed, SDP answer comes via call:signal
    const onAccepted = () => {
      // State transitions happen via connectionstatechange
    };

    const onRejected = () => {
      teardown();
    };

    // SDP / ICE signalling
    const onSignal = async ({ fromUserId, signal, callId }: {
      fromUserId: string;
      signal: any;
      callId: string;
    }) => {
      let pc = pcRef.current;

      if (!pc) {
        // We are the answerer and haven't created a PC yet
        const stream = localStreamRef.current;
        if (stream) {
          pc = createPC(fromUserId, callId);
        } else {
          return;
        }
      }

      try {
        if (signal.type === 'offer') {
          await pc.setRemoteDescription(new RTCSessionDescription(signal.sdp));
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          const socket = getSocket();
          socket?.emit('call:signal', {
            targetUserId: fromUserId,
            callId,
            signal: { type: 'answer', sdp: answer },
          });
        } else if (signal.type === 'answer') {
          await pc.setRemoteDescription(new RTCSessionDescription(signal.sdp));
        } else if (signal.type === 'ice' && signal.candidate) {
          await pc.addIceCandidate(new RTCIceCandidate(signal.candidate));
        }
      } catch (err) {
        console.warn('WebRTC signal error:', err);
      }
    };

    socket.on('call:ringing', onRinging);
    socket.on('call:accepted', onAccepted);
    socket.on('call:rejected', onRejected);
    socket.on('call:signal', onSignal);

    return () => {
      socket.off('call:ringing', onRinging);
      socket.off('call:accepted', onAccepted);
      socket.off('call:rejected', onRejected);
      socket.off('call:signal', onSignal);
    };
  }, [callState, user?.id, createPC, teardown]);

  // ── format timer ─────────────────────────────────────────────
  const formatTime = (s: number) =>
    `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

  return (
    <CallCtx.Provider value={{ callState, callInfo, startCall }}>
      {children}

      {/* ── INCOMING CALL OVERLAY ── */}
      {callState === 'ringing' && callInfo && (
        <div className="call-manager-overlay call-ringing">
          <div className="call-avatar-ring">
            <div className="call-avatar">{callInfo.targetUserName?.[0] ?? '?'}</div>
          </div>
          <div className="call-info-text">
            <p className="call-label">Incoming {callInfo.callType} call</p>
            <h3 className="call-name">{callInfo.targetUserName}</h3>
          </div>
          <div className="call-actions">
            <button className="call-btn call-reject" onClick={rejectCall} title="Decline">
              <PhoneMissed />
            </button>
            <button className="call-btn call-accept" onClick={acceptCall} title="Accept">
              {callInfo.callType === 'video' ? <Video /> : <PhoneCall />}
            </button>
          </div>
        </div>
      )}

      {/* ── OUTGOING CALL (DIALLING) ── */}
      {callState === 'calling' && callInfo && (
        <div className="call-manager-overlay call-calling">
          <div className="call-avatar-ring pulse">
            <div className="call-avatar">{callInfo.targetUserName?.[0] ?? '?'}</div>
          </div>
          <p className="call-label">Calling…</p>
          <h3 className="call-name">{callInfo.targetUserName}</h3>
          {hasPermError && <p className="call-error">Camera / microphone access denied</p>}
          <button className="call-btn call-reject" onClick={hangUp} title="Cancel">
            <PhoneOff />
          </button>
        </div>
      )}

      {/* ── ACTIVE CALL ── */}
      {callState === 'active' && callInfo && (
        <div className={`call-active-container ${minimised ? 'call-minimised' : ''}`}>
          {/* Remote video (full) */}
          <video
            ref={remoteVideoRef}
            autoPlay
            playsInline
            className="call-remote-video"
          />

          {/* Local video (PiP) */}
          {callInfo.callType === 'video' && (
            <video
              ref={localVideoRef}
              autoPlay
              muted
              playsInline
              className="call-local-pip"
            />
          )}

          {/* Top bar */}
          <div className="call-topbar">
            <span className="call-timer">{formatTime(callTimer)}</span>
            <div className="flex items-center gap-1.5">
              {callInfo.callType === 'voice' && (
                <Volume2 className="w-4 h-4 text-white/70" />
              )}
              <span className="text-sm text-white/90">{callInfo.targetUserName}</span>
            </div>
            <button
              className="call-minimise-btn"
              onClick={() => setMinimised((v) => !v)}
              title={minimised ? 'Expand' : 'Minimise'}
            >
              {minimised ? <Maximize2 /> : <Minimize2 />}
            </button>
          </div>

          {/* Controls */}
          {!minimised && (
            <div className="call-controls-bar">
              <button
                className={`call-ctrl-btn ${micOn ? '' : 'call-ctrl-off'}`}
                onClick={toggleMic}
                title={micOn ? 'Mute' : 'Unmute'}
              >
                {micOn ? <Mic /> : <MicOff />}
              </button>
              {callInfo.callType === 'video' && (
                <button
                  className={`call-ctrl-btn ${camOn ? '' : 'call-ctrl-off'}`}
                  onClick={toggleCam}
                  title={camOn ? 'Stop camera' : 'Start camera'}
                >
                  {camOn ? <Camera /> : <CameraOff />}
                </button>
              )}
              <button
                className="call-ctrl-btn call-ctrl-hangup"
                onClick={hangUp}
                title="End call"
              >
                <PhoneOff />
              </button>
            </div>
          )}

          {/* No remote video yet */}
          {!minimised && (
            <div className="call-no-video-bg">
              <div className="call-avatar call-avatar-lg">{callInfo.targetUserName?.[0] ?? '?'}</div>
            </div>
          )}
        </div>
      )}
    </CallCtx.Provider>
  );
}
