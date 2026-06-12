import { useEffect, useRef } from 'react';
import { WebRTCClient } from './webrtc';

export function CallPanel() {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const rtc = new WebRTCClient();
    rtc.start(true).then((stream) => {
      if (videoRef.current) videoRef.current.srcObject = stream;
    });
  }, []);

  return <video ref={videoRef} autoPlay muted playsInline style={{ width: '100%' }} />;
}
