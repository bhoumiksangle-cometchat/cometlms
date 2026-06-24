import React, { useEffect, useState } from 'react';
import { CometChat } from '@cometchat/chat-sdk-javascript';
import {
  CometChatMessageHeader,
  CometChatMessageList,
  CometChatMessageComposer,
} from '@cometchat/chat-uikit-react';
import { useCometChat } from '../../cometchat/CometChatProvider';
import './CourseDiscussion.css';

interface CourseDiscussionProps {
  groupId: string;
}

/**
 * CometChat-powered course discussion panel.
 * Resolves the CometChat group by guid and renders the message header, list,
 * and composer in a flex column layout.
 */
export function CourseDiscussion({ groupId }: CourseDiscussionProps) {
  const { isChatLoggedIn } = useCometChat();
  const [group, setGroup] = useState<CometChat.Group | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isChatLoggedIn) {
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    // Try to get the group; if it doesn't exist, try to create it (dev mode)
    // or join it (already exists but user not a member)
    CometChat.getGroup(groupId)
      .then((g) => {
        if (!cancelled) {
          setGroup(g);
          setLoading(false);
        }
      })
      .catch((err) => {
        // If group not found, try to create it (dev mode — groups are created
        // on course publish, but in dev mode there's no publish action)
        if (err?.code === 'ERR_GUID_NOT_FOUND' || err?.message?.includes('not found')) {
          const group = new CometChat.Group(
            groupId,
            `Course Discussion`,
            'public' as any,
            ''
          );
          CometChat.createGroup(group)
            .then((g) => {
              if (!cancelled) { setGroup(g); setLoading(false); }
            })
            .catch((createErr) => {
              // Maybe another user already created it — try joining
              if (createErr?.code === 'ERR_GUID_ALREADY_EXISTS') {
                CometChat.joinGroup(groupId, 'public' as any, '')
                  .then((g) => {
                    if (!cancelled) { setGroup(g); setLoading(false); }
                  })
                  .catch(() => {
                    if (!cancelled) {
                      setError('Unable to load or create the discussion group.');
                      setLoading(false);
                    }
                  });
              } else {
                if (!cancelled) {
                  console.error('[CourseDiscussion] Failed to create group', groupId, createErr);
                  setError('Unable to load the discussion group. Please try again later.');
                  setLoading(false);
                }
              }
            });
        } else {
          if (!cancelled) {
            console.error('[CourseDiscussion] Failed to resolve group', groupId, err);
            setError('Unable to load the discussion group. Please try again later.');
            setLoading(false);
          }
        }
      });

    return () => {
      cancelled = true;
    };
  }, [groupId, isChatLoggedIn]);

  // Chat not yet connected
  if (!isChatLoggedIn) {
    return (
      <div style={centeredContainer}>
        <div style={spinner} />
        <p style={{ color: '#6b7280', marginTop: 12, fontSize: 14 }}>
          Connecting to chat…
        </p>
      </div>
    );
  }

  // Loading the group object
  if (loading) {
    return (
      <div style={centeredContainer}>
        <div style={spinner} />
        <p style={{ color: '#6b7280', marginTop: 12, fontSize: 14 }}>
          Loading discussion…
        </p>
      </div>
    );
  }

  // Error state
  if (error || !group) {
    return (
      <div style={centeredContainer}>
        <p style={{ color: '#dc2626', fontSize: 14, textAlign: 'center', maxWidth: 360 }}>
          {error ?? 'Discussion group not found.'}
        </p>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <CometChatMessageHeader group={group} />
      <div
        className="cc-msg-list"
        style={{ flex: '1 1 0', minHeight: 0, overflow: 'hidden' }}
      >
        <CometChatMessageList group={group} />
      </div>
      <CometChatMessageComposer
        group={group}
        /* Rich text formatting (bold, italic, code) is auto-enabled by the
         * UI Kit when the Rich Media extension is active in the CometChat
         * dashboard. No additional props or component swap required.
         * See: apps/web/src/cometchat/FEATURES_SETUP.md §1.4 */
      />
    </div>
  );
}

// ── Style helpers ──────────────────────────────────────────────────────────────

const centeredContainer: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  height: '100%',
};

const spinner: React.CSSProperties = {
  width: 32,
  height: 32,
  border: '3px solid #e5e7eb',
  borderTopColor: '#10b981',
  borderRadius: '50%',
  animation: 'spin 0.9s linear infinite',
};
