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
  Users,
  X,
} from 'lucide-react';
import { getSocket } from '../../lib/socket';
import apiClient from '../../lib/apiClient';
import { useAuth } from '../auth/useAuth';
import { useChatContext } from './useChatContext';

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
  startGroupCall: (roomId: string, callType: CallType) => void;
  endGroupCall: (roomId: string) => void;
}

// ─────────────────────────────────────────────────────────────────
// Context
// ─────────────────────────────────────────────────────────────────
const CallCtx = createContext<CallContextValue>({
  callState: 'idle',
  callInfo: null,
  startCall: () => {},
  startGroupCall: () => {},
  endGroupCall: () => {},
});

export const useCallManager = () => useContext(CallCtx);

// ─────────────────────────────────────────────────────────────────
// ICE / STUN configuration
// ─────────────────────────────────────────────────────────────────
// ICE servers are loaded from the backend (STUN + optional TURN) so connectivity
// config lives in one place. We keep a sensible STUN-only fallback so calls on
// the same network still work even if the fetch fails.
const FALLBACK_ICE_SERVERS: RTCIceServer[] = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
];

let cachedIceServers: RTCIceServer[] = FALLBACK_ICE_SERVERS;

async function loadIceServers(): Promise<void> {
  try {
    const res = await apiClient.get<{ success: boolean; data: { iceServers: RTCIceServer[] } }>(
      '/api/calls/ice-servers',
    );
    if (res?.data?.iceServers?.length) {
      cachedIceServers = res.data.iceServers;
    }
  } catch (err) {
    console.warn('[CallManager] Failed to load ICE servers, using STUN fallback:', err);
  }
}

function getRtcConfig(): RTCConfiguration {
  return { iceServers: cachedIceServers };
}

// SDP interop helper. A remote `signal.sdp` may arrive as a raw SDP string
// (mobile / normalized web) OR as a full {type, sdp} descriptor object (legacy
// web). Normalize both into a valid RTCSessionDescription.
function toRTCSessionDescription(signal: any): RTCSessionDescription {
  if (signal?.sdp && typeof signal.sdp === 'object') {
    return new RTCSessionDescription(signal.sdp);
  }
  return new RTCSessionDescription({ type: signal.type, sdp: signal.sdp });
}

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
  const { activeGroupCall, startGroupCall, endGroupCall } = useChatContext();

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
  // Store the pending offer received before the user has accepted the call
  const pendingOfferRef = useRef<{ fromUserId: string; signal: any; callId: string } | null>(null);
  // Buffer ICE candidates that arrive before the remote description is set
  const pendingCandidatesRef = useRef<RTCIceCandidateInit[]>([]);
  // Keep a ref to callInfo so async handlers always see the latest value
  const callInfoRef = useRef<CallInfo | null>(null);

  // Keep callInfoRef in sync with state for use in async socket handlers
  useEffect(() => {
    callInfoRef.current = callInfo;
  }, [callInfo]);

  // Load ICE servers (STUN + TURN) from the backend once on mount
  useEffect(() => {
    loadIceServers();
  }, []);

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
    pendingOfferRef.current = null;
    pendingCandidatesRef.current = [];
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
    const pc = new RTCPeerConnection(getRtcConfig());
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

      // Send the invite — the SDP offer will be created and sent after
      // the callee accepts (in the onAccepted handler below).
      socket.emit('call:invite', { targetUserId, callType, callId });
    } catch (err) {
      console.error('Could not start call:', err);
      setHasPermError(true);
      setTimeout(teardown, 3000);
    }
  }, [callState, user?.id, teardown]);

  // ── hang up ───────────────────────────────────────────────────
  const hangUp = useCallback(() => {
    const socket = getSocket();
    if (callInfo && socket) {
      socket.emit('call:ended', {
        roomId: callInfo.callId,
        callId: callInfo.callId,
        duration: callTimer,
        targetUserId: callInfo.targetUserId,
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

      const pc = createPC(callInfo.targetUserId, callInfo.callId);

      // Process any SDP offer that arrived before the user hit Accept
      const pending = pendingOfferRef.current;
      if (pending && pending.signal.type === 'offer') {
        await pc.setRemoteDescription(toRTCSessionDescription(pending.signal));
        // Flush ICE candidates buffered before the remote description was ready
        for (const c of pendingCandidatesRef.current) {
          await pc.addIceCandidate(new RTCIceCandidate(c)).catch((e) => console.warn('ICE flush error:', e));
        }
        pendingCandidatesRef.current = [];
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        socket?.emit('call:signal', {
          targetUserId: pending.fromUserId,
          callId: pending.callId,
          signal: { type: 'answer', sdp: answer.sdp },
        });
        pendingOfferRef.current = null;
      }

      socket?.emit('call:accepted', { targetUserId: callInfo.targetUserId, callId: callInfo.callId });
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
    const onRinging = ({ fromUserId, callType, callId }: { fromUserId: string; callType: CallType; callId?: string }) => {
      if (callState !== 'idle') return; // Already in a call
      // Use the callId from the caller if provided, otherwise derive one
      const resolvedCallId = callId ?? `${fromUserId}-${user?.id}-incoming`;
      setCallInfo({
        callId: resolvedCallId,
        targetUserId: fromUserId,
        targetUserName: fromUserId, // Will be replaced by real name when we have contacts
        callType,
      });
      setCallState('ringing');
    };

    // They accepted our outgoing call — now create the PC and send the SDP offer
    const onAccepted = async ({ fromUserId }: { fromUserId: string }) => {
      const info = callInfoRef.current;
      if (!info) return;
      const socket = getSocket();

      try {
        const pc = createPC(info.targetUserId, info.callId);
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);

        socket?.emit('call:signal', {
          targetUserId: info.targetUserId,
          callId: info.callId,
          signal: { type: 'offer', sdp: offer.sdp },
        });
      } catch (err) {
        console.error('Failed to create offer after acceptance:', err);
        teardown();
      }
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
        if (signal.type === 'offer') {
          // Offer arrived before acceptCall was invoked — store it for when the user accepts
          pendingOfferRef.current = { fromUserId, signal, callId };
          return;
        }
        // No PC and not an offer — nothing to do
        return;
      }

      try {
        if (signal.type === 'offer') {
          await pc.setRemoteDescription(toRTCSessionDescription(signal));
          // Flush any ICE candidates that arrived before the remote description
          for (const c of pendingCandidatesRef.current) {
            await pc.addIceCandidate(new RTCIceCandidate(c)).catch((e) => console.warn('ICE flush error:', e));
          }
          pendingCandidatesRef.current = [];
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          const socket = getSocket();
          socket?.emit('call:signal', {
            targetUserId: fromUserId,
            callId,
            signal: { type: 'answer', sdp: answer.sdp },
          });
        } else if (signal.type === 'answer') {
          await pc.setRemoteDescription(toRTCSessionDescription(signal));
          for (const c of pendingCandidatesRef.current) {
            await pc.addIceCandidate(new RTCIceCandidate(c)).catch((e) => console.warn('ICE flush error:', e));
          }
          pendingCandidatesRef.current = [];
        } else if (signal.type === 'ice' && signal.candidate) {
          // If the remote description isn't set yet, buffer the candidate
          if (pc.remoteDescription && pc.remoteDescription.type) {
            await pc.addIceCandidate(new RTCIceCandidate(signal.candidate));
          } else {
            pendingCandidatesRef.current.push(signal.candidate);
          }
        }
      } catch (err) {
        console.warn('WebRTC signal error:', err);
      }
    };

    socket.on('call:ringing', onRinging);
    socket.on('call:accepted', onAccepted);
    socket.on('call:rejected', onRejected);
    socket.on('call:signal', onSignal);
    socket.on('call:ended', onRejected); // remote hung up → tear down locally

    return () => {
      socket.off('call:ringing', onRinging);
      socket.off('call:accepted', onAccepted);
      socket.off('call:rejected', onRejected);
      socket.off('call:signal', onSignal);
      socket.off('call:ended', onRejected);
    };
  }, [callState, user?.id, createPC, teardown]);

  // ── format timer ─────────────────────────────────────────────
  const formatTime = (s: number) =>
    `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

  return (
    <CallCtx.Provider value={{ callState, callInfo, startCall, startGroupCall, endGroupCall }}>
      {children}

      {/* ── GROUP CALL BANNER ── */}
      {activeGroupCall && callState === 'idle' && (
        <div className="call-group-banner">
          <Users className="w-4 h-4 flex-shrink-0" />
          <span className="call-group-banner-text">
            Group {activeGroupCall.callType} call in progress
          </span>
          <div className="call-group-banner-actions">
            <button
              className="call-btn call-accept call-btn-sm"
              onClick={() => {
                // Join by navigating to the meeting URL if external, or starting own call
                if (activeGroupCall.meetingUrl) {
                  window.open(activeGroupCall.meetingUrl, '_blank');
                }
              }}
              title="Join call"
            >
              {activeGroupCall.callType === 'video' ? <Video className="w-4 h-4" /> : <PhoneCall className="w-4 h-4" />}
              <span style={{ marginLeft: 4 }}>Join</span>
            </button>
            <button
              className="call-group-banner-dismiss"
              onClick={() => endGroupCall(activeGroupCall.roomId)}
              title="Dismiss"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        </div>
      )}

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
