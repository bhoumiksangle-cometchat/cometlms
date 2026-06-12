/**
 * DirectMessagesPage — Full messaging + calling hub
 *
 * Layout:
 *  ┌─────────────────┬─────────────────────────────────────┐
 *  │ Sidebar         │  Chat Window                        │
 *  │  • Search users │  • Message thread                   │
 *  │  • Conversations│  • Call buttons in header           │
 *  └─────────────────┴─────────────────────────────────────┘
 */
import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  MessageSquare,
  Search,
  Phone,
  Video,
  ChevronLeft,
  UserPlus,
  Circle,
  X,
} from 'lucide-react';
import { apiClient } from '../../lib/apiClient';
import { useAuth } from '../auth/useAuth';
import ChatWindow from './ChatWindow';
import { useCallManager } from './CallManager';
import { getSocket } from '../../lib/socket';

// Dev-mode stub users so the page is always usable without a DB
const DEV_USERS: AppUser[] = [];

interface Conversation {
  roomId: string;
  name: string;
  otherUser?: { id: string; name: string; role: string; avatarUrl?: string | null };
  lastMessage?: string;
  unread?: number;
}

interface AppUser {
  id: string;
  name: string;
  role: string;
  avatarUrl?: string | null;
}

function RoleBadge({ role }: { role: string }) {
  const colors: Record<string, string> = {
    INSTRUCTOR: 'bg-purple-100 text-purple-700',
    ADMIN: 'bg-red-100 text-red-700',
    SUPER_ADMIN: 'bg-red-100 text-red-700',
    STUDENT: 'bg-blue-100 text-blue-700',
    AI_AGENT: 'bg-amber-100 text-amber-700',
  };
  return (
    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${colors[role] ?? 'bg-gray-100 text-gray-600'}`}>
      {role}
    </span>
  );
}

function Avatar({ name, size = 'md' }: { name: string; size?: 'sm' | 'md' | 'lg' }) {
  const sizes = { sm: 'w-8 h-8 text-xs', md: 'w-10 h-10 text-sm', lg: 'w-14 h-14 text-xl' };
  const colors = [
    'bg-indigo-500', 'bg-purple-500', 'bg-pink-500', 'bg-cyan-500',
    'bg-emerald-500', 'bg-amber-500', 'bg-rose-500',
  ];
  const color = colors[name.charCodeAt(0) % colors.length];
  return (
    <div className={`${sizes[size]} ${color} rounded-full flex items-center justify-center text-white font-bold flex-shrink-0`}>
      {name[0]?.toUpperCase()}
    </div>
  );
}

export default function DirectMessagesPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { startCall } = useCallManager();

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConv, setSelectedConv] = useState<Conversation | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<AppUser[]>([]);
  const [suggestedUsers, setSuggestedUsers] = useState<AppUser[]>([]);
  const [showSearch, setShowSearch] = useState(false);
  const [onlineUsers, setOnlineUsers] = useState<Set<string>>(new Set());

  // ── Load conversations ─────────────────────────────────────────
  const loadConversations = useCallback(async () => {
    try {
      const res = await apiClient.get('/api/chat/conversations');
      const raw = res?.data ?? res;
      const rooms: any[] = Array.isArray(raw) ? raw : raw?.data ?? [];

      const convs: Conversation[] = rooms.map((r) => {
        const other = r.members?.find((m: any) => m.user?.id !== user?.id)?.user;
        return {
          roomId: r.roomId ?? r.id,
          name: other?.name ?? r.name ?? r.roomId,
          otherUser: other,
          lastMessage: r.messages?.[0]?.content,
          unread: 0,
        };
      });
      setConversations(convs);

      // Also load selected from localStorage
      const storedRoom = localStorage.getItem('dm:selected-room');
      if (storedRoom) {
        const found = convs.find((c) => c.roomId === storedRoom);
        if (found) setSelectedConv(found);
      }
    } catch {
      // In dev mode without DB, just show empty state
    }
  }, [user?.id]);

  useEffect(() => { loadConversations(); }, [loadConversations]);

  // Load suggested users from database
  useEffect(() => {
    apiClient.get('/api/users?limit=10')
      .then((res) => {
        const raw = res?.data ?? res;
        const users: AppUser[] = Array.isArray(raw) ? raw : raw?.data ?? [];
        // Filter out current user and set as suggested
        setSuggestedUsers(users.filter((u) => u.id !== user?.id).slice(0, 4));
      })
      .catch(() => {
        // If API fails, just show empty suggestions
        setSuggestedUsers([]);
      });
  }, [user?.id]);

  // ── Presence & Messaging tracking ──────────────────────────────────────────
  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;
    
    const handlePresence = ({ userId, status }: { userId: string; status: string }) => {
      setOnlineUsers((prev) => {
        const next = new Set(prev);
        status === 'online' ? next.add(userId) : next.delete(userId);
        return next;
      });
    };
    
    const handleMessageSent = (message: any) => {
      setConversations((prev) => prev.map(c => {
        if (c.roomId === message.roomId) {
          return {
            ...c,
            lastMessage: message.content,
            unread: selectedConv?.roomId !== message.roomId && message.senderId !== user?.id ? c.unread + 1 : c.unread
          };
        }
        return c;
      }));
    };

    const handleDmNotification = ({ roomId, otherUserId }: { roomId: string, otherUserId: string }) => {
      // Reload conversations to fetch the new DM room
      loadConversations();
    };

    socket.on('user:presence_changed', handlePresence);
    socket.on('message:sent', handleMessageSent);
    socket.on('dm:notification', handleDmNotification);
    
    return () => { 
      socket.off('user:presence_changed', handlePresence); 
      socket.off('message:sent', handleMessageSent);
      socket.off('dm:notification', handleDmNotification);
    };
  }, [selectedConv?.roomId, user?.id, loadConversations]);

  // ── User search ────────────────────────────────────────────────
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }
    
    // Search real users via API
    apiClient.get(`/api/users?search=${encodeURIComponent(searchQuery)}&limit=10`)
      .then((res) => {
        const raw = res?.data ?? res;
        const users: AppUser[] = Array.isArray(raw) ? raw : raw?.data ?? [];
        if (users.length > 0) {
          setSearchResults(users.filter((u) => u.id !== user?.id));
        } else {
          setSearchResults([]);
        }
      })
      .catch(() => {
        setSearchResults([]);
      });
  }, [searchQuery, user?.id]);

  // ── Open DM with a user (create room via socket DM fetch) ──────
  const openDMWith = useCallback((target: AppUser) => {
    console.log('=== Opening DM ===');
    console.log('Target user:', target);
    console.log('Current conversations:', conversations);
    
    const socket = getSocket();
    console.log('Socket instance:', socket ? 'Connected' : 'Not available');
    
    if (!socket) {
      console.error('No socket connection available');
      alert('Socket connection not available. Please refresh the page.');
      return;
    }

    const existing = conversations.find((c) => c.otherUser?.id === target.id);
    if (existing) {
      console.log('Found existing conversation:', existing);
      setSelectedConv(existing);
      setShowSearch(false);
      setSearchQuery('');
      return;
    }

    console.log('Creating new DM room via socket...');
    console.log('Emitting dm:fetch with otherUserId:', target.id);
    
    // Create / fetch the DM room via socket
    socket.emit('dm:fetch', { otherUserId: target.id });
    
    // Set a timeout to show if no response
    const timeout = setTimeout(() => {
      console.error('No response from server after 5 seconds');
      alert('No response from server. Please check if the API server is running.');
    }, 5000);
    
    socket.once('dm:messages', ({ roomId }: { roomId: string }) => {
      clearTimeout(timeout);
      console.log('Received DM room:', roomId);
      const newConv: Conversation = {
        roomId,
        name: target.name,
        otherUser: target,
      };
      setConversations((prev) => {
        const exists = prev.find((c) => c.roomId === roomId);
        return exists ? prev : [newConv, ...prev];
      });
      setSelectedConv(newConv);
      localStorage.setItem('dm:selected-room', roomId);
    });
    
    // Also listen for errors
    socket.once('dm:error', (error: any) => {
      clearTimeout(timeout);
      console.error('DM error from server:', error);
      alert(`Error creating DM: ${error.error || 'Unknown error'}`);
    });

    setShowSearch(false);
    setSearchQuery('');
  }, [conversations]);

  const selectConv = (conv: Conversation) => {
    setSelectedConv(conv);
    localStorage.setItem('dm:selected-room', conv.roomId);
  };

  return (
    <div style={{ display: 'flex', height: 'calc(100vh - 150px)', background: '#f3f4f6', overflow: 'hidden', borderRadius: '12px', border: '1px solid #e5e7eb' }}>
      {/* ── SIDEBAR ── */}
      <aside style={{
        width: 300,
        minWidth: 260,
        display: 'flex',
        flexDirection: 'column',
        background: '#fff',
        borderRight: '1px solid #e5e7eb',
      }}>
        {/* Header */}
        <div style={{ padding: '16px 16px 12px', borderBottom: '1px solid #f3f4f6' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <button
                onClick={() => navigate('/')}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6b7280', display: 'flex', padding: 4 }}
                title="Back to dashboard"
              >
                <ChevronLeft size={20} />
              </button>
              <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#111827' }}>Messages</h2>
            </div>
            <button
              onClick={() => setShowSearch((v) => !v)}
              style={{
                background: showSearch ? '#d1fae5' : '#f3f4f6',
                border: 'none',
                borderRadius: 8,
                cursor: 'pointer',
                padding: '6px 10px',
                color: showSearch ? '#10b981' : '#6b7280',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                fontSize: 13,
                fontWeight: 600,
              }}
              title="New message"
            >
              <UserPlus size={15} />
              New
            </button>
          </div>

          {/* Search input */}
          {showSearch ? (
            <div style={{ position: 'relative' }}>
              <Search size={14} style={{ position: 'absolute', left: 10, top: 10, color: '#9ca3af' }} />
              <input
                autoFocus
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search people..."
                style={{
                  width: '100%',
                  padding: '8px 8px 8px 32px',
                  border: '1px solid #e5e7eb',
                  borderRadius: 8,
                  fontSize: 13,
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  style={{ position: 'absolute', right: 8, top: 8, background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af' }}
                >
                  <X size={14} />
                </button>
              )}
            </div>
          ) : (
            <div style={{ position: 'relative' }}>
              <Search size={14} style={{ position: 'absolute', left: 10, top: 10, color: '#9ca3af' }} />
              <input
                value=""
                onChange={(e) => { setShowSearch(true); setSearchQuery(e.target.value); }}
                placeholder="Search conversations..."
                style={{
                  width: '100%',
                  padding: '8px 8px 8px 32px',
                  border: '1px solid #e5e7eb',
                  borderRadius: 8,
                  fontSize: 13,
                  outline: 'none',
                  boxSizing: 'border-box',
                  background: '#f9fafb',
                }}
              />
            </div>
          )}
        </div>

        {/* Search results */}
        {showSearch && (
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {searchResults.length === 0 && searchQuery && (
              <p style={{ padding: '12px 16px', fontSize: 13, color: '#9ca3af' }}>No users found</p>
            )}
            {searchResults.length === 0 && !searchQuery && (
              <div style={{ padding: '12px 16px' }}>
                <p style={{ fontSize: 12, fontWeight: 600, color: '#6b7280', marginBottom: 8 }}>SUGGESTED</p>
                {suggestedUsers.length === 0 ? (
                  <p style={{ fontSize: 13, color: '#9ca3af' }}>Loading users...</p>
                ) : (
                  suggestedUsers.map((u) => (
                    <button
                      key={u.id}
                      onClick={() => openDMWith(u as AppUser)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 10,
                        width: '100%', padding: '8px 0', background: 'none', border: 'none',
                        cursor: 'pointer', borderRadius: 8, textAlign: 'left',
                      }}
                    >
                      <Avatar name={u.name} size="sm" />
                      <div>
                        <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: '#111827' }}>{u.name}</p>
                        <RoleBadge role={u.role} />
                      </div>
                    </button>
                  ))
                )}
              </div>
            )}
            {searchResults.map((u) => (
              <button
                key={u.id}
                onClick={() => openDMWith(u)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  width: '100%', padding: '10px 16px', background: 'none', border: 'none',
                  cursor: 'pointer', textAlign: 'left', borderBottom: '1px solid #f3f4f6',
                }}
                className="dm-search-row"
              >
                <Avatar name={u.name} size="sm" />
                <div>
                  <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: '#111827' }}>{u.name}</p>
                  <RoleBadge role={u.role} />
                </div>
              </button>
            ))}
          </div>
        )}

        {/* Conversation list */}
        {!showSearch && (
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {conversations.length === 0 ? (
              <div style={{ padding: '24px 16px', textAlign: 'center' }}>
                <MessageSquare size={32} style={{ margin: '0 auto 8px', color: '#d1d5db' }} />
                <p style={{ color: '#9ca3af', fontSize: 13, lineHeight: 1.5 }}>
                  No conversations yet.<br />Click <strong>New</strong> to start a DM.
                </p>
              </div>
            ) : (
              conversations.map((conv) => {
                const isSelected = selectedConv?.roomId === conv.roomId;
                const isOnline = conv.otherUser ? onlineUsers.has(conv.otherUser.id) : false;
                return (
                  <button
                    key={conv.roomId}
                    onClick={() => selectConv(conv)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 10,
                      width: '100%', padding: '12px 16px',
                      background: isSelected ? '#d1fae5' : 'none',
                      border: 'none', borderBottom: '1px solid #f9fafb',
                      cursor: 'pointer', textAlign: 'left', transition: 'background 0.15s',
                    }}
                  >
                    <div style={{ position: 'relative' }}>
                      <Avatar name={conv.name} size="md" />
                      {isOnline && (
                        <Circle
                          size={10}
                          fill="#22c55e"
                          color="#22c55e"
                          style={{ position: 'absolute', bottom: 0, right: 0, background: '#fff', borderRadius: '50%' }}
                        />
                      )}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ margin: 0, fontSize: 14, fontWeight: isSelected ? 700 : 600, color: '#111827', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {conv.name}
                      </p>
                      {conv.lastMessage && (
                        <p style={{ margin: 0, fontSize: 12, color: '#6b7280', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {conv.lastMessage}
                        </p>
                      )}
                    </div>
                    {conv.unread ? (
                      <span style={{ background: '#10b981', color: '#fff', borderRadius: 99, fontSize: 11, fontWeight: 700, padding: '1px 7px' }}>
                        {conv.unread}
                      </span>
                    ) : null}
                  </button>
                );
              })
            )}
          </div>
        )}
      </aside>

      {/* ── MAIN CHAT AREA ── */}
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {selectedConv ? (
          <>
            {/* Chat header with call buttons */}
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '12px 20px', background: '#fff', borderBottom: '1px solid #e5e7eb',
              flexShrink: 0,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <Avatar name={selectedConv.name} size="md" />
                <div>
                  <p style={{ margin: 0, fontWeight: 700, color: '#111827', fontSize: 15 }}>{selectedConv.name}</p>
                  <p style={{ margin: 0, fontSize: 12, color: '#6b7280' }}>
                    {selectedConv.otherUser ? (
                      <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <Circle
                          size={8}
                          fill={onlineUsers.has(selectedConv.otherUser.id) ? '#22c55e' : '#d1d5db'}
                          color={onlineUsers.has(selectedConv.otherUser.id) ? '#22c55e' : '#d1d5db'}
                        />
                        {onlineUsers.has(selectedConv.otherUser.id) ? 'Online' : 'Offline'}
                      </span>
                    ) : 'Direct Message'}
                  </p>
                </div>
              </div>

              {/* Call action buttons */}
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  onClick={() => selectedConv.otherUser && startCall(selectedConv.otherUser.id, selectedConv.name, 'voice')}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    padding: '8px 14px', background: '#f3f4f6',
                    border: 'none', borderRadius: 8, cursor: 'pointer',
                    color: '#374151', fontSize: 13, fontWeight: 600,
                    transition: 'background 0.15s',
                  }}
                  title="Voice call"
                >
                  <Phone size={16} />
                  Voice
                </button>
                <button
                  onClick={() => selectedConv.otherUser && startCall(selectedConv.otherUser.id, selectedConv.name, 'video')}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    padding: '8px 14px', background: '#10b981',
                    border: 'none', borderRadius: 8, cursor: 'pointer',
                    color: '#fff', fontSize: 13, fontWeight: 600,
                    transition: 'background 0.15s',
                  }}
                  title="Video call"
                >
                  <Video size={16} />
                  Video
                </button>
              </div>
            </div>

            {/* Chat window */}
            <div style={{ flex: 1, overflow: 'hidden' }}>
              <ChatWindow roomId={selectedConv.roomId} roomName={selectedConv.name} />
            </div>
          </>
        ) : (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#9ca3af' }}>
            <MessageSquare size={52} style={{ marginBottom: 16, color: '#e5e7eb' }} />
            <h3 style={{ margin: '0 0 8px', color: '#374151', fontSize: 18, fontWeight: 700 }}>Your Messages</h3>
            <p style={{ margin: 0, fontSize: 14, textAlign: 'center', maxWidth: 300, lineHeight: 1.6 }}>
              Send private messages and make voice or video calls with instructors and classmates.
            </p>
            <button
              onClick={() => setShowSearch(true)}
              style={{
                marginTop: 20, padding: '10px 20px',
                background: '#10b981', color: '#fff',
                border: 'none', borderRadius: 10, cursor: 'pointer',
                fontSize: 14, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8,
              }}
            >
              <UserPlus size={16} />
              Start a conversation
            </button>
          </div>
        )}
      </main>
    </div>
  );
}
