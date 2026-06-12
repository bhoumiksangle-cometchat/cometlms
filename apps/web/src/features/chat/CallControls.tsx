import { useState } from 'react';
import { getSocket } from '../../lib/socket';

export default function CallControls({ targetUserId }: { targetUserId: string }) {
  const [incoming, setIncoming] = useState(false);

  const startCall = (type: 'voice' | 'video') => {
    getSocket()?.emit('call:invite', { targetUserId, callType: type });
  };

  const answer = () => setIncoming(false);
  const reject = () => {
    setIncoming(false);
    getSocket()?.emit('call:rejected', { targetUserId });
  };

  return (
    <div className="flex gap-2">
      <button onClick={() => startCall('voice')}>Voice</button>
      <button onClick={() => startCall('video')}>Video</button>
      {incoming && (
        <>
          <button onClick={answer}>Answer</button>
          <button onClick={reject}>Reject</button>
          <button>End</button>
        </>
      )}
    </div>
  );
}
