import type { Metadata, Viewport } from 'next';
import './globals.css';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'JiraniPass — Estate Management Console',
  description: 'Secure, real-time estate visitor access management via WhatsApp Business. Installable on Android, iOS, and Linux.',
  manifest: '/manifest.json',
  icons: {
    icon: '/icon.svg',
    apple: '/icon-192.png',
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'JiraniPass',
  },
};

export const viewport: Viewport = {
  themeColor: '#0F172A',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <link rel="manifest" href="/manifest.json" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
      </head>
      <body>
        <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
          {/* Header Navigation */}
          <header
            style={{
              backgroundColor: '#ffffff',
              borderBottom: '1px solid var(--border-subtle)',
              position: 'sticky',
              top: 0,
              zIndex: 40,
            }}
          >
            <div
              style={{
                maxWidth: '1200px',
                margin: '0 auto',
                padding: '0.85rem 1.5rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              {/* Brand Logo & Estate Context */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
                <Link
                  href="/"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.6rem',
                    textDecoration: 'none',
                    color: 'var(--text-main)',
                  }}
                >
                  <div
                    style={{
                      width: '36px',
                      height: '36px',
                      borderRadius: '8px',
                      background: 'linear-gradient(135deg, hsl(224, 76%, 48%), hsl(245, 82%, 60%))',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#ffffff',
                      fontWeight: 800,
                      fontSize: '1.15rem',
                    }}
                  >
                    J
                  </div>
                  <div>
                    <div style={{ fontWeight: 800, fontSize: '1.15rem', letterSpacing: '-0.02em' }}>
                      JiraniPass
                    </div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                      ESTATE ACCESS CONSOLE
                    </div>
                  </div>
                </Link>

                <div
                  style={{
                    padding: '0.25rem 0.75rem',
                    backgroundColor: 'var(--primary-50)',
                    border: '1px solid var(--primary-100)',
                    borderRadius: '20px',
                    fontSize: '0.8rem',
                    fontWeight: 600,
                    color: 'var(--primary-600)',
                  }}
                >
                  🏡 Green Valley Estate
                </div>
              </div>

              {/* Navigation Links */}
              <nav style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <Link
                  href="/"
                  style={{
                    padding: '0.5rem 0.9rem',
                    borderRadius: '6px',
                    fontSize: '0.875rem',
                    fontWeight: 600,
                    color: 'var(--text-main)',
                    textDecoration: 'none',
                  }}
                >
                  Live Gate
                </Link>
                <Link
                  href="/households"
                  style={{
                    padding: '0.5rem 0.9rem',
                    borderRadius: '6px',
                    fontSize: '0.875rem',
                    fontWeight: 600,
                    color: 'var(--text-muted)',
                    textDecoration: 'none',
                  }}
                >
                  Households & Consents
                </Link>
                <Link
                  href="/audit"
                  style={{
                    padding: '0.5rem 0.9rem',
                    borderRadius: '6px',
                    fontSize: '0.875rem',
                    fontWeight: 600,
                    color: 'var(--text-muted)',
                    textDecoration: 'none',
                  }}
                >
                  Audit Trail
                </Link>
                <Link
                  href="/download"
                  style={{
                    padding: '0.45rem 0.85rem',
                    borderRadius: '6px',
                    fontSize: '0.82rem',
                    fontWeight: 700,
                    backgroundColor: '#0F172A',
                    color: '#FFFFFF',
                    textDecoration: 'none',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.4rem',
                  }}
                >
                  📥 Install App (Android / iOS / Linux)
                </Link>
              </nav>

              {/* Live Status indicator & Admin User */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.4rem',
                    fontSize: '0.8rem',
                    fontWeight: 600,
                    color: 'hsl(145, 80%, 30%)',
                  }}
                >
                  <span
                    style={{
                      width: '8px',
                      height: '8px',
                      borderRadius: '50%',
                      backgroundColor: 'hsl(145, 80%, 45%)',
                      display: 'inline-block',
                    }}
                  />
                  Live SSE Connected
                </div>
                <div
                  style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '50%',
                    backgroundColor: 'var(--border-subtle)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 700,
                    fontSize: '0.85rem',
                  }}
                >
                  EA
                </div>
              </div>
            </div>
          </header>

          {/* Page Content */}
          <main style={{ flex: 1, maxWidth: '1200px', width: '100%', margin: '0 auto', padding: '2rem 1.5rem' }}>
            {children}
          </main>

          {/* Footer */}
          <footer
            style={{
              backgroundColor: '#ffffff',
              borderTop: '1px solid var(--border-subtle)',
              padding: '1.25rem 1.5rem',
              textAlign: 'center',
              fontSize: '0.8rem',
              color: 'var(--text-muted)',
            }}
          >
            JiraniPass v1.0 • Cross-Platform App: Android • iOS • Linux • Kenya ODPC Compliant
          </footer>
        </div>

        {/* Service Worker Registration */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              if ('serviceWorker' in navigator) {
                window.addEventListener('load', function() {
                  navigator.serviceWorker.register('/sw.js').then(function(reg) {
                    console.log('JiraniPass PWA ServiceWorker registered with scope:', reg.scope);
                  }).catch(function(err) {
                    console.log('JiraniPass ServiceWorker registration failed:', err);
                  });
                });
              }
            `,
          }}
        />
      </body>
    </html>
  );
}
