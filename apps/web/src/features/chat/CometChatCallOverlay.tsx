import { CometChatIncomingCall } from '@cometchat/chat-uikit-react';
import { useCometChat } from '../../cometchat/CometChatProvider';

export function CometChatCallOverlay() {
  const { isChatLoggedIn } = useCometChat();
  if (!isChatLoggedIn) return null;
  return <CometChatIncomingCall />;
}
