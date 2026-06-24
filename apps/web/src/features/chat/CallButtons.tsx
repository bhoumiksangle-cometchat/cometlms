import { CometChatCallButtons } from '@cometchat/chat-uikit-react';
import { CometChat } from '@cometchat/chat-sdk-javascript';
import { useCometChat } from '../../cometchat/CometChatProvider';

interface CallButtonsProps {
  user?: CometChat.User;
  group?: CometChat.Group;
}

export function CallButtons({ user, group }: CallButtonsProps) {
  const { isChatLoggedIn } = useCometChat();
  if (!isChatLoggedIn) return null;
  if (user) return <CometChatCallButtons user={user} />;
  if (group) return <CometChatCallButtons group={group} />;
  return null;
}
