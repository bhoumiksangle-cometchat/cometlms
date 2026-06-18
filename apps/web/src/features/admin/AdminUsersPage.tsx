import { useEffect, useState, useCallback } from 'react';
import { Search, Users, ShieldOff, ShieldCheck, RefreshCw } from 'lucide-react';
import { apiClient } from '../../lib/apiClient';

interface AdminUser {
  id: string;
  name: string;
  email: string;
  role: 'STUDENT' | 'INSTRUCTOR' | 'ADMIN' | 'SUPER_ADMIN' | 'AI_AGENT';
  isActive: boolean;
  isVerified: boolean;
  createdAt: string;
}

const ROLE_LABELS: Record<AdminUser['role'], string> = {
  STUDENT: 'Student',
  INSTRUCTOR: 'Instructor',
  ADMIN: 'Admin',
  SUPER_ADMIN: 'Super Admin',
  AI_AGENT: 'AI Agent',
};

const ROLE_COLORS: Record<AdminUser['role'], { bg: string; color: string }> = {
  STUDENT:    { bg: '#eef2f0', color: '#3a5a52' },
  INSTRUCTOR: { bg: '#e8f0ff', color: '#2d4ab0' },
  ADMIN:      { bg: '#fff0c6', color: '#704c00' },
  SUPER_ADMIN:{ bg: '#ffe4e4', color: '#991b1b' },
  AI_AGENT:   { bg: '#f3e8ff', color: '#6b21a8' },
};

function RolePill({ role }: { role: AdminUser['role'] }) {
  const { bg, color } = ROLE_COLORS[role] ?? ROLE_COLORS.STUDENT;
  return (
    <span
      style={{
        display: 'inline-block',
        padding: '3px 10px',
        borderRadius: 999,
        fontSize: '0.75rem',
        fontWeight: 700,
        background: bg,
        color,
        whiteSpace: 'nowrap',
      }}
    >
      {ROLE_LABELS[role] ?? role}
    </span>
  );
}

export function AdminUsersPage() {
  const [users, setUsers]           = useState<AdminUser[]>([]);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState<string | null>(null);
  const [search, setSearch]         = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [busyId, setBusyId]         = useState<string | null>(null);
  const [notice, setNotice]         = useState<string | null>(null);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiClient.get('/api/admin/users', {
        params: {
          ...(search     ? { search }     : {}),
          ...(roleFilter ? { role: roleFilter } : {}),
        },
      });
      if (res.success) {
        setUsers(res.data ?? []);
      } else {
        setError(res.error ?? 'Failed to load users');
      }
    } catch {
      setError('Could not reach the server');
    } finally {
      setLoading(false);
    }
  }, [search, roleFilter]);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(fetchUsers, 300);
    return () => clearTimeout(timer);
  }, [fetchUsers]);

  async function handleBan(user: AdminUser) {
    const action = user.isActive ? 'ban' : 'unban';
    const confirmMsg = user.isActive
      ? `Ban ${user.name}? They will lose access immediately.`
      : `Unban ${user.name}? They will regain access.`;
    if (!window.confirm(confirmMsg)) return;

    setBusyId(user.id);
    setNotice(null);
    try {
      const res = await apiClient.patch(`/api/admin/users/${user.id}/${action}`);
      if (res.success) {
        setUsers((prev) =>
          prev.map((u) => (u.id === user.id ? { ...u, isActive: !u.isActive } : u)),
        );
        setNotice(`${user.name} has been ${action === 'ban' ? 'banned' : 'unbanned'}.`);
      } else {
        setNotice(`Error: ${res.error ?? 'Unknown error'}`);
      }
    } catch {
      setNotice('Request failed — please try again.');
    } finally {
      setBusyId(null);
    }
  }

  const joinDate = (iso: string) =>
    new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });

  return (
    <div className="primary-panel" style={{ gridColumn: '1 / -1' }}>
      {/* Header */}
      <section className="panel">
        <div className="panel-title" style={{ justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
            <Users aria-hidden />
            <h2 style={{ margin: 0 }}>User Management</h2>
          </div>
          <span style={{ color: '#697873', fontSize: '0.86rem' }}>
            {loading ? 'Loading…' : `${users.length} user${users.length !== 1 ? 's' : ''}`}
          </span>
        </div>

        {/* Filters */}
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 10,
            marginBottom: 16,
            alignItems: 'center',
          }}
        >
          {/* Search */}
          <div
            className="search"
            style={{ width: 'min(100%, 320px)', minWidth: 200 }}
          >
            <Search aria-hidden />
            <input
              aria-label="Search users"
              placeholder="Name or email…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          {/* Role filter */}
          <select
            aria-label="Filter by role"
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            style={{
              minHeight: 42,
              padding: '0 12px',
              border: '1px solid #c8d6d0',
              borderRadius: 8,
              background: '#fff',
              font: 'inherit',
              cursor: 'pointer',
            }}
          >
            <option value="">All roles</option>
            {(Object.keys(ROLE_LABELS) as AdminUser['role'][]).map((r) => (
              <option key={r} value={r}>{ROLE_LABELS[r]}</option>
            ))}
          </select>

          {/* Refresh */}
          <button
            className="icon-button"
            aria-label="Refresh"
            title="Refresh"
            onClick={fetchUsers}
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
        {!loading && !error && users.length === 0 && (
          <p className="muted" style={{ textAlign: 'center', padding: '32px 0' }}>
            No users found{search || roleFilter ? ' — try adjusting filters' : ''}.
          </p>
        )}

        {/* User rows */}
        {users.length > 0 && (
          <div
            role="list"
            aria-label="Users"
            style={{ display: 'grid', gap: 10 }}
          >
            {users.map((user) => (
              <div
                key={user.id}
                role="listitem"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 14,
                  padding: '12px 14px',
                  border: '1px solid #dce5e1',
                  borderRadius: 8,
                  background: user.isActive ? '#fbfdfc' : '#fdf6f6',
                  opacity: user.isActive ? 1 : 0.8,
                  flexWrap: 'wrap',
                }}
              >
                {/* Avatar */}
                <div
                  className="avatar"
                  aria-hidden
                  style={{
                    flexShrink: 0,
                    background: user.isActive ? '#24675d' : '#9ca3af',
                  }}
                >
                  {user.name.charAt(0).toUpperCase()}
                </div>

                {/* Name + email */}
                <div style={{ flex: '1 1 160px', minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <strong style={{ fontSize: '0.95rem' }}>{user.name}</strong>
                    {!user.isActive && (
                      <span
                        style={{
                          padding: '2px 8px',
                          borderRadius: 999,
                          fontSize: '0.72rem',
                          fontWeight: 700,
                          background: '#ffe4e4',
                          color: '#991b1b',
                        }}
                      >
                        Banned
                      </span>
                    )}
                  </div>
                  <span
                    style={{
                      display: 'block',
                      color: '#66756f',
                      fontSize: '0.85rem',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      maxWidth: '100%',
                    }}
                  >
                    {user.email}
                  </span>
                </div>

                {/* Role */}
                <div style={{ flexShrink: 0 }}>
                  <RolePill role={user.role} />
                </div>

                {/* Joined */}
                <div
                  style={{
                    flexShrink: 0,
                    color: '#697873',
                    fontSize: '0.82rem',
                    whiteSpace: 'nowrap',
                  }}
                >
                  Joined {joinDate(user.createdAt)}
                </div>

                {/* Ban / Unban button */}
                <button
                  onClick={() => handleBan(user)}
                  disabled={busyId === user.id}
                  aria-label={user.isActive ? `Ban ${user.name}` : `Unban ${user.name}`}
                  style={{
                    flexShrink: 0,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    minHeight: 36,
                    padding: '0 14px',
                    border: '1px solid',
                    borderRadius: 8,
                    borderColor: user.isActive ? '#fca5a5' : '#a8d9ce',
                    background:  user.isActive ? '#ffe4e4' : '#eefaf6',
                    color:       user.isActive ? '#991b1b' : '#1a4f47',
                    fontWeight: 600,
                    fontSize: '0.85rem',
                    cursor: busyId === user.id ? 'not-allowed' : 'pointer',
                    opacity: busyId === user.id ? 0.6 : 1,
                    transition: 'opacity 0.15s',
                  }}
                >
                  {user.isActive ? (
                    <ShieldOff aria-hidden style={{ width: 15, height: 15 }} />
                  ) : (
                    <ShieldCheck aria-hidden style={{ width: 15, height: 15 }} />
                  )}
                  {busyId === user.id ? '…' : user.isActive ? 'Ban' : 'Unban'}
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Spinner keyframe (injected once) */}
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
