import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { CometChat } from '@cometchat/chat-sdk-javascript';
import {
  CometChatConversations,
  CometChatMessageHeader,
  CometChatMessageList,
  CometChatMessageComposer,
  CometChatCallLogs,
  CometChatUsers,
} from '@cometchat/chat-uikit-react';
import { useCometChat } from '../../cometchat/CometChatProvider';
import './MessagesPage.css';

interface MessagesPageProps {
  preselectedUser?: string;
}

type SidebarTab = 'conversations' | 'contacts' | 'call-logs';

// Role filters map to the CometChat `role:*` user tags set by the server on
// sync (see apps/api/src/services/cometchat.service.ts → buildUserTags). They
// let a user discover people by role through CometChat's native tag filtering.
const ROLE_FILTERS = [
  { value: 'all', label: 'All' },
  { value: 'instructor', label: 'Instructors' },
  { value: 'student', label: 'Students' },
  { value: 'admin', label: 'Admins' },
] as const;
type RoleFilter = (typeof ROLE_FILTERS)[number]['value'];

export default function MessagesPage({ preselectedUser }: MessagesPageProps) {
  const { isChatLoggedIn } = useCometChat();
  const [searchParams] = useSearchParams();
  const [activeConversation, setActiveConversation] = useState<CometChat.Conversation | undefined>(undefined);
  const [selectedUser, setSelectedUser] = useState<CometChat.User | undefined>(undefined);
  const [selectedGroup, setSelectedGroup] = useState<CometChat.Group | undefined>(undefined);
  const [sidebarTab, setSidebarTab] = useState<SidebarTab>('contacts');
  const [roleFilter, setRoleFilter] = useState<RoleFilter>('all');

  // Build a UsersRequestBuilder that filters by the selected role tag. `all`
  // returns everyone; any other value filters to users carrying `role:<value>`.
  const usersRequestBuilder = useMemo(() => {
    const builder = new CometChat.UsersRequestBuilder().setLimit(30).withTags(true);
    if (roleFilter !== 'all') builder.setTags([`role:${roleFilter}`]);
    return builder;
  }, [roleFilter]);

  // Determine the UID to preselect (prop takes priority over URL param)
  const preselectedUid = preselectedUser || searchParams.get('user') || undefined;

  // Auto-select a user conversation on mount when a preselected UID is provided
  useEffect(() => {
    if (!isChatLoggedIn || !preselectedUid) return;

    let cancelled = false;

    CometChat.getUser(preselectedUid).then((user) => {
      if (cancelled) return;
      setSelectedUser(user);
      setSelectedGroup(undefined);
    }).catch((err) => {
      console.warn('[MessagesPage] Could not fetch preselected user:', err);
    });

    return () => { cancelled = true; };
  }, [isChatLoggedIn, preselectedUid]);

  if (!isChatLoggedIn) {
    return (
      <div className="messages-page">
        <div className="messages-placeholder">
          Connecting to chat…
        </div>
      </div>
    );
  }

  function handleConversationClick(conversation: CometChat.Conversation) {
    setActiveConversation(conversation);

    const conversationWith = conversation.getConversationWith();
    const type = conversation.getConversationType();

    if (type === 'user') {
      setSelectedUser(conversationWith as CometChat.User);
      setSelectedGroup(undefined);
    } else {
      setSelectedGroup(conversationWith as CometChat.Group);
      setSelectedUser(undefined);
    }
  }

  function handleUserClick(user: CometChat.User) {
    setSelectedUser(user);
    setSelectedGroup(undefined);
    setActiveConversation(undefined);
  }

  return (
    <div className="messages-page">
      {/* Left pane — conversation list / contacts / call logs */}
      <div className="messages-sidebar">
        <div className="sidebar-tabs">
          <button
            className={`sidebar-tab ${sidebarTab === 'contacts' ? 'sidebar-tab--active' : ''}`}
            onClick={() => setSidebarTab('contacts')}
          >
            Users
          </button>
          <button
            className={`sidebar-tab ${sidebarTab === 'conversations' ? 'sidebar-tab--active' : ''}`}
            onClick={() => setSidebarTab('conversations')}
          >
            Chats
          </button>
          <button
            className={`sidebar-tab ${sidebarTab === 'call-logs' ? 'sidebar-tab--active' : ''}`}
            onClick={() => setSidebarTab('call-logs')}
          >
            Calls
          </button>
        </div>

        {sidebarTab === 'conversations' ? (
          <CometChatConversations
            onItemClick={handleConversationClick}
            activeConversation={activeConversation}
          />
        ) : sidebarTab === 'contacts' ? (
          <div className="users-pane">
            <div className="users-filter" role="group" aria-label="Filter users by role">
              {ROLE_FILTERS.map((f) => (
                <button
                  key={f.value}
                  type="button"
                  className={`users-filter-chip ${roleFilter === f.value ? 'users-filter-chip--active' : ''}`}
                  onClick={() => setRoleFilter(f.value)}
                >
                  {f.label}
                </button>
              ))}
            </div>
            <CometChatUsers
              key={roleFilter}
              usersRequestBuilder={usersRequestBuilder}
              onItemClick={handleUserClick}
            />
          </div>
        ) : (
          <CometChatCallLogs />
        )}
      </div>

      {/* Right pane — message thread */}
      <div className="messages-content">
        {selectedUser || selectedGroup ? (
          <>
            {selectedUser ? (
              <CometChatMessageHeader user={selectedUser} />
            ) : (
              <CometChatMessageHeader group={selectedGroup} />
            )}
            <div className="cc-msg-list">
              {selectedUser ? (
                <CometChatMessageList user={selectedUser} />
              ) : (
                <CometChatMessageList group={selectedGroup} />
              )}
            </div>
            {selectedUser ? (
              <CometChatMessageComposer user={selectedUser} />
            ) : (
              <CometChatMessageComposer group={selectedGroup} />
            )}
          </>
        ) : (
          <div className="messages-placeholder">
            Select a user to start messaging
          </div>
        )}
      </div>
    </div>
  );
}
