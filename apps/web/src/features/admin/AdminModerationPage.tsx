import { useEffect, useState, useCallback } from 'react';
import { ShieldAlert, Check, Ban, RefreshCw } from 'lucide-react';
import { apiClient } from '../../lib/apiClient';

interface FlaggedMessage {
  id: string;
  message?: {
    id?: string;
    text?: string;
    sender?: {
      uid?: string;
      name?: string;
    };
    sentAt?: number;
  };
  reason?: string;
  reportedAt?: string;
  reportedBy?: string;
}

export function AdminModerationPage() {
  const [items, setItems] = useState<FlaggedMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const fetchFlagged = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiClient.get('/api/admin/moderation');
      if (res.success) {
        const data = res.data ?? [];
        setItems(Array.isArray(data) ? data : []);
      } else {
        setError(res.error ?? 'Failed to load flagged messages');
      }
    } catch {
      setError('Could not reach the server');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchFlagged();
  }, [fetchFlagged]);

  async function handleDismiss(item: FlaggedMessage) {
    setBusyId(item.id);
    setNotice(null);
    try {
      const res = await apiClient.post(`/api/admin/moderation/${item.id}/dismiss`);
      if (res.success) {
        setItems((prev) => prev.filter((i) => i.id !== item.id));
        setNotice('Message dismissed successfully.');
      } else {
        setNotice(`Error: ${res.error ?? 'Unknown error'}`);
      }
    } catch {
      setNotice('Request failed — please try again.');
    } finally {
      setBusyId(null);
    }
  }

  async function handleBan(item: FlaggedMessage) {
    const senderUid = item.message?.sender?.uid;
    const senderName = item.message?.sender?.name ?? senderUid ?? 'this user';
    if (!senderUid) {
      setNotice('Cannot ban: sender UID is missing.');
      return;
    }
    if (!confirm(`Ban ${senderName}? They will be deactivated in CometChat.`)) return;

    setBusyId(item.id);
    setNotice(null);
    try {
      const res = await apiClient.post(`/api/admin/moderation/${item.id}/ban`, { uid: senderUid });
      if (res.success) {
        setItems((prev) => prev.filter((i) => i.id !== item.id));
        setNotice(`${senderName} has been banned.`);
      } else {
        setNotice(`Error: ${res.error ?? 'Unknown error'}`);
      }
    } catch {
      setNotice('Request failed — please try again.');
    } finally {
      setBusyId(null);
    }
  }

  const formatTime = (timestamp?: number | string) => {
    if (!timestamp) return '';
    const date = typeof timestamp === 'number'
      ? new Date(timestamp * 1000)
      : new Date(timestamp);
    return date.toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="primary-panel" style={{ gridColumn: '1 / -1' }}>
      <section className="panel">
        <div className="panel-title" style={{ justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
            <ShieldAlert aria-hidden />
            <h2 style={{ margin: 0 }}>Moderation Queue</h2>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ color: '#697873', fontSize: '0.86rem' }}>
              {loading ? 'Loading…' : `${items.length} flagged message${items.length !== 1 ? 's' : ''}`}
            </span>
            <button
              className="icon-button"
              aria-label="Refresh"
              title="Refresh"
              onClick={fetchFlagged}
              disabled={loading}
            >
              <RefreshCw
                aria-hidden
                style={{
                  width: 18,
                  height: 18,
                  animation: loading ? 'spin 1s linear infinite' : 'none',
                }}
              />
            </button>
          </div>
        </div>

        {/* Notice bar */}
        {notice && (
          <div
            role="status"
            style={{
              marginBottom: 12,
              padding: '8px 14px',
              borderRadius: 8,
              background: '#eefaf6',
              border: '1px solid #a8d9ce',
              color: '#1a4f47',
              fontSize: '0.9rem',
              fontWeight: 600,
            }}
          >
            {notice}
          </div>
        )}

        {/* Error state */}
        {error && (
          <div
            role="alert"
            style={{
              marginBottom: 12,
              padding: '10px 14px',
              borderRadius: 8,
              background: '#ffe4e4',
              border: '1px solid #fca5a5',
              color: '#991b1b',
              fontSize: '0.9rem',
            }}
          >
            {error}
          </div>
        )}

        {/* Empty state */}
        {!loading && !error && items.length === 0 && (
          <p className="muted" style={{ textAlign: 'center', padding: '32px 0' }}>
            No flagged messages — the moderation queue is clear.
          </p>
        )}

        {/* Flagged message rows */}
        {items.length > 0 && (
          <div role="list" aria-label="Flagged messages" style={{ display: 'grid', gap: 10 }}>
            {items.map((item) => (
              <div
                key={item.id}
                role="listitem"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 14,
                  padding: '12px 14px',
                  border: '1px solid #dce5e1',
                  borderRadius: 8,
                  background: '#fbfdfc',
                  flexWrap: 'wrap',
                }}
              >
                {/* Flag icon */}
                <div
                  style={{
                    flexShrink: 0,
                    width: 36,
                    height: 36,
                    borderRadius: 8,
                    background: '#ffe4e4',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <ShieldAlert style={{ width: 18, height: 18, color: '#991b1b' }} aria-hidden />
                </div>

                {/* Content */}
                <div style={{ flex: '1 1 200px', minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <strong style={{ fontSize: '0.92rem' }}>
                      {item.message?.sender?.name ?? item.message?.sender?.uid ?? 'Unknown'}
                    </strong>
                    {item.reason && (
                      <span
                        style={{
                          padding: '2px 8px',
                          borderRadius: 999,
                          fontSize: '0.72rem',
                          fontWeight: 700,
                          background: '#fff0c6',
                          color: '#704c00',
                        }}
                      >
                        {item.reason}
                      </span>
                    )}
                  </div>
                  <span
                    style={{
                      display: 'block',
                      color: '#374151',
                      fontSize: '0.88rem',
                      marginTop: 4,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      maxWidth: '100%',
                    }}
                  >
                    {item.message?.text ?? '(no message content)'}
                  </span>
                  {item.message?.sentAt && (
                    <span style={{ fontSize: '0.78rem', color: '#697873', marginTop: 2, display: 'block' }}>
                      {formatTime(item.message.sentAt)}
                    </span>
                  )}
                </div>

                {/* Actions */}
                <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                  <button
                    onClick={() => handleDismiss(item)}
                    disabled={busyId === item.id}
                    aria-label="Dismiss flag"
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                      minHeight: 36,
                      padding: '0 14px',
                      border: '1px solid #a8d9ce',
                      borderRadius: 8,
                      background: '#eefaf6',
                      color: '#1a4f47',
                      fontWeight: 600,
                      fontSize: '0.85rem',
                      cursor: busyId === item.id ? 'not-allowed' : 'pointer',
                      opacity: busyId === item.id ? 0.6 : 1,
                      transition: 'opacity 0.15s',
                    }}
                  >
                    <Check aria-hidden style={{ width: 15, height: 15 }} />
                    {busyId === item.id ? '…' : 'Dismiss'}
                  </button>
                  <button
                    onClick={() => handleBan(item)}
                    disabled={busyId === item.id}
                    aria-label="Ban user"
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                      minHeight: 36,
                      padding: '0 14px',
                      border: '1px solid #fca5a5',
                      borderRadius: 8,
                      background: '#ffe4e4',
                      color: '#991b1b',
                      fontWeight: 600,
                      fontSize: '0.85rem',
                      cursor: busyId === item.id ? 'not-allowed' : 'pointer',
                      opacity: busyId === item.id ? 0.6 : 1,
                      transition: 'opacity 0.15s',
                    }}
                  >
                    <Ban aria-hidden style={{ width: 15, height: 15 }} />
                    {busyId === item.id ? '…' : 'Ban User'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Spinner keyframe */}
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
