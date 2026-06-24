import { GraduationCap, Smartphone, Download, CheckCircle } from 'lucide-react';

export function DownloadPage() {
  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #0f0f0f 0%, #1a1a2e 100%)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '24px',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    }}>
      {/* Logo */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 40 }}>
        <GraduationCap size={36} color="#7c3aed" />
        <span style={{ fontSize: 28, fontWeight: 800, color: '#fff', letterSpacing: '-0.5px' }}>CometLMS</span>
      </div>

      {/* Card */}
      <div style={{
        background: '#1a1a1a',
        border: '1px solid #2a2a2a',
        borderRadius: 20,
        padding: '48px 40px',
        maxWidth: 460,
        width: '100%',
        textAlign: 'center',
      }}>
        <div style={{
          width: 72,
          height: 72,
          background: 'linear-gradient(135deg, #7c3aed, #5b21b6)',
          borderRadius: 20,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: '0 auto 24px',
        }}>
          <Smartphone size={36} color="#fff" />
        </div>

        <h1 style={{ fontSize: 26, fontWeight: 700, color: '#fff', margin: '0 0 12px' }}>
          Get the Android App
        </h1>
        <p style={{ color: '#888', fontSize: 15, lineHeight: 1.6, margin: '0 0 32px' }}>
          Access your courses, chat with instructors, and join live sessions — all from your phone.
        </p>

        <a
          href="/cometlms.apk"
          download="cometlms.apk"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 10,
            background: 'linear-gradient(135deg, #7c3aed, #5b21b6)',
            color: '#fff',
            textDecoration: 'none',
            padding: '14px 32px',
            borderRadius: 12,
            fontSize: 16,
            fontWeight: 700,
            letterSpacing: '-0.2px',
            transition: 'opacity 0.2s',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.opacity = '0.9')}
          onMouseLeave={(e) => (e.currentTarget.style.opacity = '1')}
        >
          <Download size={20} />
          Download APK
        </a>

        <p style={{ color: '#555', fontSize: 12, marginTop: 12 }}>
          Android 8.0+ · ~158 MB
        </p>

        {/* Steps */}
        <div style={{
          marginTop: 36,
          borderTop: '1px solid #2a2a2a',
          paddingTop: 28,
          textAlign: 'left',
        }}>
          <p style={{ fontSize: 11, fontWeight: 700, color: '#555', letterSpacing: '0.08em', marginBottom: 16, textTransform: 'uppercase' }}>
            Installation guide
          </p>
          {[
            'Download the APK file',
            'Open it from your Downloads folder',
            'Tap Install — allow "Install unknown apps" if prompted',
            'Open the app and sign in with your account',
          ].map((step, i) => (
            <div key={i} style={{ display: 'flex', gap: 12, alignItems: 'flex-start', marginBottom: 12 }}>
              <CheckCircle size={16} color="#7c3aed" style={{ flexShrink: 0, marginTop: 2 }} />
              <span style={{ fontSize: 14, color: '#888', lineHeight: 1.5 }}>{step}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Footer */}
      <p style={{ color: '#444', fontSize: 12, marginTop: 32 }}>
        © {new Date().getFullYear()} CometLMS · Powered by CometChat
      </p>
    </div>
  );
}
