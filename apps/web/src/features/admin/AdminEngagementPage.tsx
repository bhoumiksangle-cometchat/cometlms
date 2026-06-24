import { useEffect, useState, useCallback } from 'react';
import { BarChart3, RefreshCw } from 'lucide-react';
import { apiClient } from '../../lib/apiClient';

interface EngagementRow {
  courseId: string;
  courseTitle: string;
  totalMessages: number;
  totalReactions: number;
  callMinutes: number;
  flaggedMessages: number;
}

export function AdminEngagementPage() {
  const [rows, setRows] = useState<EngagementRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [days, setDays] = useState(30);

  const fetchEngagement = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiClient.get('/api/admin/engagement', { params: { days } });
      if (res.success) {
        setRows(res.data ?? []);
      } else {
        setError(res.error ?? 'Failed to load engagement data');
      }
    } catch {
      setError('Could not reach the server');
    } finally {
      setLoading(false);
    }
  }, [days]);

  useEffect(() => {
    fetchEngagement();
  }, [fetchEngagement]);

  const totals = rows.reduce(
    (acc, r) => ({
      messages: acc.messages + r.totalMessages,
      reactions: acc.reactions + r.totalReactions,
      calls: acc.calls + r.callMinutes,
      flags: acc.flags + r.flaggedMessages,
    }),
    { messages: 0, reactions: 0, calls: 0, flags: 0 },
  );

  return (
    <div className="primary-panel" style={{ gridColumn: '1 / -1' }}>
      <section className="panel">
        <div className="panel-title" style={{ justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
            <BarChart3 aria-hidden />
            <h2 style={{ margin: 0 }}>Engagement Analytics</h2>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {/* Days selector */}
            <select
              aria-label="Time range"
              value={days}
              onChange={(e) => setDays(Number((e.target as HTMLSelectElement).value))}
              style={{
                minHeight: 36,
                padding: '0 12px',
                border: '1px solid #c8d6d0',
                borderRadius: 8,
                background: '#fff',
                font: 'inherit',
                fontSize: '0.85rem',
                cursor: 'pointer',
              }}
            >
              <option value={7}>Last 7 days</option>
              <option value={14}>Last 14 days</option>
              <option value={30}>Last 30 days</option>
              <option value={90}>Last 90 days</option>
            </select>
            <button
              className="icon-button"
              aria-label="Refresh"
              title="Refresh"
              onClick={fetchEngagement}
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

        {/* Summary cards */}
        {!loading && !error && rows.length > 0 && (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
              gap: 12,
              marginBottom: 20,
            }}
          >
            {[
              { label: 'Total Messages', value: totals.messages.toLocaleString() },
              { label: 'Total Reactions', value: totals.reactions.toLocaleString() },
              { label: 'Call Minutes', value: totals.calls.toLocaleString() },
              { label: 'Flagged', value: totals.flags.toLocaleString() },
            ].map((card) => (
              <div
                key={card.label}
                style={{
                  padding: '14px 16px',
                  borderRadius: 10,
                  border: '1px solid #dce5e1',
                  background: '#f7faf8',
                  textAlign: 'center',
                }}
              >
                <div style={{ fontSize: '0.78rem', color: '#697873', marginBottom: 4, fontWeight: 600 }}>
                  {card.label}
                </div>
                <div style={{ fontSize: '1.4rem', fontWeight: 700, color: '#1d3531' }}>
                  {card.value}
                </div>
              </div>
            ))}
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

        {/* Loading state */}
        {loading && (
          <p className="muted" style={{ textAlign: 'center', padding: '24px 0' }}>
            Loading engagement data…
          </p>
        )}

        {/* Empty state */}
        {!loading && !error && rows.length === 0 && (
          <p className="muted" style={{ textAlign: 'center', padding: '32px 0' }}>
            No engagement data yet. Metrics are populated by CometChat webhooks.
          </p>
        )}

        {/* Data table */}
        {!loading && !error && rows.length > 0 && (
          <div style={{ overflowX: 'auto' }}>
            <table
              style={{
                width: '100%',
                borderCollapse: 'collapse',
                fontSize: '0.88rem',
              }}
            >
              <thead>
                <tr
                  style={{
                    borderBottom: '2px solid #dce5e1',
                    textAlign: 'left',
                  }}
                >
                  <th style={{ padding: '10px 12px', color: '#697873', fontWeight: 700 }}>Course</th>
                  <th style={{ padding: '10px 12px', color: '#697873', fontWeight: 700, textAlign: 'right' }}>Messages</th>
                  <th style={{ padding: '10px 12px', color: '#697873', fontWeight: 700, textAlign: 'right' }}>Reactions</th>
                  <th style={{ padding: '10px 12px', color: '#697873', fontWeight: 700, textAlign: 'right' }}>Call Min</th>
                  <th style={{ padding: '10px 12px', color: '#697873', fontWeight: 700, textAlign: 'right' }}>Flagged</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr
                    key={row.courseId}
                    style={{ borderBottom: '1px solid #eef2f0' }}
                  >
                    <td style={{ padding: '10px 12px', fontWeight: 600, color: '#1d3531' }}>
                      {row.courseTitle}
                    </td>
                    <td style={{ padding: '10px 12px', textAlign: 'right', color: '#374151' }}>
                      {row.totalMessages.toLocaleString()}
                    </td>
                    <td style={{ padding: '10px 12px', textAlign: 'right', color: '#374151' }}>
                      {row.totalReactions.toLocaleString()}
                    </td>
                    <td style={{ padding: '10px 12px', textAlign: 'right', color: '#374151' }}>
                      {row.callMinutes.toLocaleString()}
                    </td>
                    <td style={{ padding: '10px 12px', textAlign: 'right' }}>
                      {row.flaggedMessages > 0 ? (
                        <span
                          style={{
                            padding: '2px 8px',
                            borderRadius: 999,
                            fontSize: '0.75rem',
                            fontWeight: 700,
                            background: '#ffe4e4',
                            color: '#991b1b',
                          }}
                        >
                          {row.flaggedMessages}
                        </span>
                      ) : (
                        <span style={{ color: '#9ca3af' }}>0</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Spinner keyframe */}
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
