import React, { useState } from 'react';
import { useAppStore } from '../stores';
import { apiClient } from '../lib/apiClient';
import { Settings, User, Layers, Shield, Sparkles, Navigation, X } from 'lucide-react';

export function DevBypass() {
  const [isOpen, setIsOpen] = useState(false);
  const { bypassEnrollments, setBypassEnrollments } = useAppStore();
  const [status, setStatus] = useState<string | null>(null);

  const handleRoleSwitch = async (role: 'STUDENT' | 'INSTRUCTOR' | 'ADMIN') => {
    setStatus(`Logging in as ${role}...`);
    try {
      const response = await apiClient.post<{ success: boolean; data?: { tokens: { accessToken: string; refreshToken: string } } }>(
        '/api/auth/dev-bypass-login',
        { role }
      );
      if (response.success && response.data) {
        localStorage.setItem('accessToken', response.data.tokens.accessToken);
        localStorage.setItem('refreshToken', response.data.tokens.refreshToken);
        setStatus('Success! Redirecting...');
        setTimeout(() => {
          if (role === 'ADMIN') {
            window.location.href = '/admin';
          } else if (role === 'INSTRUCTOR') {
            window.location.href = '/instructor';
          } else {
            window.location.href = '/';
          }
        }, 800);
      } else {
        throw new Error('Response did not contain tokens');
      }
    } catch (err: any) {
      console.error(err);
      setStatus(`Failed: ${err.message || 'Unknown error'}`);
    }
  };

  const simulateSocketEvent = (type: string) => {
    setStatus(`Simulating ${type}...`);
    setTimeout(() => {
      setStatus(`Mock event ${type} simulated!`);
      setTimeout(() => setStatus(null), 2000);
    }, 500);
  };

  return (
    <>
      {/* Floating Gear Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        style={{
          position: 'fixed',
          bottom: '20px',
          right: '20px',
          zIndex: 9999,
          width: '56px',
          height: '56px',
          borderRadius: '50%',
          backgroundColor: '#24675d',
          color: '#ffffff',
          border: 'none',
          boxShadow: '0 4px 14px rgba(0, 0, 0, 0.25)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          transition: 'transform 0.2s ease, background-color 0.2s ease',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.transform = 'scale(1.1)';
          e.currentTarget.style.backgroundColor = '#1d534b';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = 'scale(1)';
          e.currentTarget.style.backgroundColor = '#24675d';
        }}
        title="Open Developer Bypass Console"
        aria-label="Developer Bypass Console"
      >
        {isOpen ? <X size={24} /> : <Settings size={24} className="animate-spin-slow" />}
      </button>

      {/* Bypass Console Panel */}
      {isOpen && (
        <div
          style={{
            position: 'fixed',
            bottom: '86px',
            right: '20px',
            zIndex: 9998,
            width: '350px',
            backgroundColor: '#ffffff',
            borderRadius: '16px',
            boxShadow: '0 10px 30px rgba(0, 0, 0, 0.15)',
            border: '1px solid #dce5e1',
            fontFamily: 'Inter, sans-serif',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          {/* Header */}
          <div
            style={{
              padding: '16px',
              background: 'linear-gradient(135deg, #24675d, #1a4a43)',
              color: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Layers size={20} />
              <strong style={{ fontSize: '15px' }}>Developer Bypass Console</strong>
            </div>
            <span
              style={{
                fontSize: '10px',
                backgroundColor: 'rgba(255, 255, 255, 0.2)',
                padding: '2px 8px',
                borderRadius: '999px',
                fontWeight: 600,
              }}
            >
              DEV ONLY
            </span>
          </div>

          {/* Panel Body */}
          <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '16px', maxHeight: '420px', overflowY: 'auto' }}>
            {/* Quick login section */}
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#4a5568', marginBottom: '8px' }}>
                Quick Account Switcher
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
                <button
                  onClick={() => handleRoleSwitch('STUDENT')}
                  style={{
                    padding: '8px',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    background: '#f8fafc',
                    color: '#0f172a',
                    fontSize: '11px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '4px',
                  }}
                >
                  <User size={16} color="#3b82f6" />
                  Student
                </button>
                <button
                  onClick={() => handleRoleSwitch('INSTRUCTOR')}
                  style={{
                    padding: '8px',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    background: '#f8fafc',
                    color: '#0f172a',
                    fontSize: '11px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '4px',
                  }}
                >
                  <Sparkles size={16} color="#eab308" />
                  Instructor
                </button>
                <button
                  onClick={() => handleRoleSwitch('ADMIN')}
                  style={{
                    padding: '8px',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    background: '#f8fafc',
                    color: '#0f172a',
                    fontSize: '11px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '4px',
                  }}
                >
                  <Shield size={16} color="#ef4444" />
                  Admin
                </button>
              </div>
            </div>

            {/* Course access override */}
            <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#4a5568' }}>
                    Bypass Course Enrollments
                  </label>
                  <span style={{ fontSize: '10px', color: '#64748b' }}>Access all lessons & curriculum locks</span>
                </div>
                <input
                  type="checkbox"
                  checked={bypassEnrollments}
                  onChange={(e) => setBypassEnrollments(e.target.checked)}
                  style={{
                    width: '36px',
                    height: '20px',
                    cursor: 'pointer',
                  }}
                  aria-label="Bypass Course Enrollments"
                />
              </div>
            </div>

            {/* Simulators */}
            <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: '12px' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#4a5568', marginBottom: '8px' }}>
                Socket Event Simulator
              </label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <button
                  onClick={() => simulateSocketEvent('dm:received')}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    textAlign: 'left',
                    borderRadius: '6px',
                    border: '1px solid #e2e8f0',
                    background: '#ffffff',
                    fontSize: '11px',
                    color: '#334155',
                    cursor: 'pointer',
                  }}
                >
                  💬 Simulate Incoming Direct Message
                </button>
                <button
                  onClick={() => simulateSocketEvent('call:ringing')}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    textAlign: 'left',
                    borderRadius: '6px',
                    border: '1px solid #e2e8f0',
                    background: '#ffffff',
                    fontSize: '11px',
                    color: '#334155',
                    cursor: 'pointer',
                  }}
                >
                  📞 Simulate Incoming WebRTC Call Signal
                </button>
                <button
                  onClick={() => simulateSocketEvent('moderation:flagged')}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    textAlign: 'left',
                    borderRadius: '6px',
                    border: '1px solid #e2e8f0',
                    background: '#ffffff',
                    fontSize: '11px',
                    color: '#334155',
                    cursor: 'pointer',
                  }}
                >
                  🚨 Trigger Moderation Queue Flag
                </button>
              </div>
            </div>

            {/* Navigation links */}
            <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: '12px' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#4a5568', marginBottom: '8px' }}>
                Quick Route Navigator
              </label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                {['/', '/courses', '/messages', '/admin'].map((route) => (
                  <button
                    key={route}
                    onClick={() => {
                      window.location.href = route;
                    }}
                    style={{
                      padding: '4px 8px',
                      borderRadius: '4px',
                      border: '1px solid #cbd5e1',
                      background: '#f8fafc',
                      color: '#475569',
                      fontSize: '10px',
                      cursor: 'pointer',
                    }}
                  >
                    {route}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Status Bar */}
          {status && (
            <div
              style={{
                padding: '8px 16px',
                backgroundColor: '#f1f5f9',
                borderTop: '1px solid #e2e8f0',
                fontSize: '11px',
                color: '#475569',
                textAlign: 'center',
                fontWeight: 500,
              }}
            >
              {status}
            </div>
          )}
        </div>
      )}
    </>
  );
}
