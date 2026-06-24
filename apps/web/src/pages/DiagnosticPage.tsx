import { useState } from 'react';
import { useAuth } from '../features/auth/useAuth';
import { apiClient } from '../lib/apiClient';

export function DiagnosticPage() {
  const { user, isAuthenticated } = useAuth();
  const [testResults, setTestResults] = useState<Record<string, any>>({});

  const runTest = async (testName: string, testFn: () => Promise<any>) => {
    try {
      const result = await testFn();
      setTestResults(prev => ({ ...prev, [testName]: { success: true, result } }));
    } catch (error: any) {
      setTestResults(prev => ({ ...prev, [testName]: { success: false, error: error.message } }));
    }
  };

  const tests = {
    'Auth Status': () => Promise.resolve({ 
      isAuthenticated, 
      userId: user?.id, 
      role: user?.role,
      name: user?.name 
    }),
    'CometChat Status': () => Promise.resolve({
      note: 'CometChat handles real-time messaging and calls. Check browser console for CometChat logs.',
    }),
    'Enrollment API': () => apiClient.get('/api/enrollments/me'),
    'Courses API': () => apiClient.get('/api/courses'),
  };

  return (
    <div style={{ padding: 32, maxWidth: 1200, margin: '0 auto' }}>
      <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 24 }}>System Diagnostics</h1>
      
      <div style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 20, fontWeight: 600, marginBottom: 16 }}>Quick Status</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
          <StatusCard title="Authentication" status={isAuthenticated} value={user?.name || 'Not logged in'} />
          <StatusCard title="Real-time" status={true} value="CometChat" />
          <StatusCard title="User Role" status={!!user?.role} value={user?.role || 'N/A'} />
        </div>
      </div>

      <div style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 20, fontWeight: 600, marginBottom: 16 }}>Run Tests</h2>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginBottom: 16 }}>
          {Object.keys(tests).map(testName => (
            <button
              key={testName}
              onClick={() => runTest(testName, tests[testName as keyof typeof tests])}
              style={{
                padding: '8px 16px',
                background: '#10b981',
                color: '#fff',
                border: 'none',
                borderRadius: 6,
                cursor: 'pointer',
                fontSize: 14,
                fontWeight: 600,
              }}
            >
              Test: {testName}
            </button>
          ))}
          <button
            onClick={() => {
              Object.keys(tests).forEach(testName => {
                runTest(testName, tests[testName as keyof typeof tests]);
              });
            }}
            style={{
              padding: '8px 16px',
              background: '#7c3aed',
              color: '#fff',
              border: 'none',
              borderRadius: 6,
              cursor: 'pointer',
              fontSize: 14,
              fontWeight: 600,
            }}
          >
            Run All Tests
          </button>
        </div>

        <div style={{ background: '#f3f4f6', borderRadius: 8, padding: 16 }}>
          <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 12 }}>Test Results:</h3>
          {Object.keys(testResults).length === 0 ? (
            <p style={{ color: '#6b7280', margin: 0 }}>No tests run yet. Click a test button above.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {Object.entries(testResults).map(([name, result]) => (
                <div 
                  key={name}
                  style={{
                    background: '#fff',
                    borderRadius: 6,
                    padding: 12,
                    borderLeft: `4px solid ${result.success ? '#10b981' : '#ef4444'}`,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <span style={{ fontSize: 18 }}>{result.success ? '✅' : '❌'}</span>
                    <strong>{name}</strong>
                  </div>
                  <pre style={{ 
                    background: '#f9fafb', 
                    padding: 8, 
                    borderRadius: 4, 
                    fontSize: 12, 
                    overflow: 'auto',
                    margin: 0,
                  }}>
                    {JSON.stringify(result.success ? result.result : result.error, null, 2)}
                  </pre>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div>
        <h2 style={{ fontSize: 20, fontWeight: 600, marginBottom: 16 }}>Console Logs</h2>
        <div style={{ background: '#1f2937', color: '#10b981', padding: 16, borderRadius: 8, fontSize: 13, fontFamily: 'monospace' }}>
          <p style={{ margin: 0 }}>Open browser console (F12) to see detailed logs.</p>
          <p style={{ margin: '8px 0 0' }}>Look for logs starting with [CometChat], [Auth], [Dev Mode]</p>
        </div>
      </div>
    </div>
  );
}

function StatusCard({ title, status, value }: { title: string; status?: boolean; value: string }) {
  return (
    <div style={{
      background: '#fff',
      border: '1px solid #e5e7eb',
      borderRadius: 8,
      padding: 16,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <div style={{
          width: 12,
          height: 12,
          borderRadius: '50%',
          background: status ? '#10b981' : '#ef4444',
        }} />
        <h3 style={{ fontSize: 14, fontWeight: 600, color: '#6b7280', margin: 0 }}>{title}</h3>
      </div>
      <p style={{ fontSize: 16, fontWeight: 600, color: '#111827', margin: 0, wordBreak: 'break-all' }}>
        {value}
      </p>
    </div>
  );
}
