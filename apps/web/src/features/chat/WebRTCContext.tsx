import React, { createContext, useContext, useRef, useState } from 'react';
import { getSocket } from '../../lib/socket';

const Ctx = createContext<any>(null);

export function WebRTCProvider({ children }: { children: React.ReactNode }) {
  const peers = useRef<Record<string, RTCPeerConnection>>({});
  const [remoteStreams, setRemoteStreams] = useState<Record<string, MediaStream>>({});
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);

  React.useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    const handler = async ({ fromUserId, signal }: any) => {
      let pc = peers.current[fromUserId];
      if (!pc) {
        const stream = localStream ?? await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        setLocalStream(stream);
        pc = new RTCPeerConnection({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] });
        stream.getTracks().forEach(t => pc!.addTrack(t, stream));
        peers.current[fromUserId] = pc;
      }

      if (signal.type === 'offer') {
        await pc.setRemoteDescription(signal.sdp);
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        socket.emit('call:signal', { targetUserId: fromUserId, callId: fromUserId, signal: { type: 'answer', sdp: answer } });
      } else if (signal.type === 'answer') {
        await pc.setRemoteDescription(signal.sdp);
      } else if (signal.type === 'ice' && signal.candidate) {
        await pc.addIceCandidate(signal.candidate);
      }
    };

    socket.on('call:signal', handler);
    return () => { socket.off('call:signal', handler); };
  }, [localStream]);

  const startCall = async (targetUserId: string) => {
    const socket = getSocket();
    const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    setLocalStream(stream);
    const pc = new RTCPeerConnection({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] });
    peers.current[targetUserId] = pc;

    stream.getTracks().forEach(t => pc.addTrack(t, stream));

    pc.ontrack = (e) => setRemoteStreams(s => ({ ...s, [targetUserId]: e.streams[0] }));
    pc.onicecandidate = (e) => {
      if (e.candidate) socket?.emit('call:signal', { targetUserId, callId: targetUserId, signal: { type: 'ice', candidate: e.candidate } });
    };

    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    socket?.emit('call:signal', { targetUserId, callId: targetUserId, signal: { type: 'offer', sdp: offer } });
  };

  return <Ctx.Provider value={{ startCall, localStream, remoteStreams }}>{children}</Ctx.Provider>;
}

export const useWebRTC = () => useContext(Ctx);
