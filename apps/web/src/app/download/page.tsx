'use client';

import React, { useState, useEffect } from 'react';

export default function DownloadAppPage() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isInstallable, setIsInstallable] = useState(false);
  const [activeTab, setActiveTab] = useState<'ANDROID' | 'IOS' | 'LINUX'>('ANDROID');

  useEffect(() => {
    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setIsInstallable(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstall);
    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) {
      alert('To install, use your browser menu (Chrome / Edge on Linux/Android) and select "Install JiraniPass" or "Add to Home screen".');
      return;
    }
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setIsInstallable(false);
    }
    setDeferredPrompt(null);
  };

  return (
    <div>
      {/* Header Banner */}
      <div style={{ textAlign: 'center', marginBottom: '3rem' }}>
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.5rem',
            padding: '0.35rem 0.9rem',
            borderRadius: '20px',
            backgroundColor: 'var(--primary-50)',
            border: '1px solid var(--primary-100)',
            color: 'var(--primary-600)',
            fontSize: '0.85rem',
            fontWeight: 700,
            marginBottom: '1rem',
          }}
        >
          📱 Universal Multi-Platform Installation
        </div>
        <h1 style={{ fontSize: '2.5rem', fontWeight: 800, letterSpacing: '-0.03em', color: 'var(--text-main)' }}>
          Download & Install JiraniPass
        </h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '1.05rem', maxWidth: '640px', margin: '0.5rem auto 0 auto' }}>
          Equip security guards, supervisors, and gate stations with our dedicated app.
          Fully supported on <strong>Android</strong>, <strong>iOS</strong>, and <strong>Linux</strong> devices.
        </p>

        {/* 1-Click Universal Browser Install Button */}
        <div style={{ marginTop: '1.5rem' }}>
          <button
            onClick={handleInstallClick}
            style={{
              backgroundColor: '#0F172A',
              color: '#FFFFFF',
              padding: '0.85rem 1.75rem',
              borderRadius: '10px',
              fontSize: '1rem',
              fontWeight: 700,
              border: 'none',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.6rem',
              boxShadow: '0 4px 14px rgba(15, 23, 42, 0.25)',
              transition: 'all 150ms ease',
            }}
          >
            ⚡ Instant 1-Click Install App (PWA)
          </button>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '0.4rem' }}>
            Installs as a standalone native app on Linux desktops, Android phones, and iOS Safari.
          </div>
        </div>
      </div>

      {/* Platform Switcher Tabs */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'center',
          gap: '0.75rem',
          marginBottom: '2.5rem',
        }}
      >
        <button
          onClick={() => setActiveTab('ANDROID')}
          style={{
            padding: '0.65rem 1.5rem',
            borderRadius: '8px',
            border: '1px solid',
            borderColor: activeTab === 'ANDROID' ? 'var(--primary-500)' : 'var(--border-medium)',
            backgroundColor: activeTab === 'ANDROID' ? 'var(--primary-500)' : '#ffffff',
            color: activeTab === 'ANDROID' ? '#ffffff' : 'var(--text-main)',
            fontWeight: 700,
            fontSize: '0.95rem',
            cursor: 'pointer',
          }}
        >
          🤖 Android Devices
        </button>

        <button
          onClick={() => setActiveTab('IOS')}
          style={{
            padding: '0.65rem 1.5rem',
            borderRadius: '8px',
            border: '1px solid',
            borderColor: activeTab === 'IOS' ? 'var(--primary-500)' : 'var(--border-medium)',
            backgroundColor: activeTab === 'IOS' ? 'var(--primary-500)' : '#ffffff',
            color: activeTab === 'IOS' ? '#ffffff' : 'var(--text-main)',
            fontWeight: 700,
            fontSize: '0.95rem',
            cursor: 'pointer',
          }}
        >
          🍏 iOS (iPhone & iPad)
        </button>

        <button
          onClick={() => setActiveTab('LINUX')}
          style={{
            padding: '0.65rem 1.5rem',
            borderRadius: '8px',
            border: '1px solid',
            borderColor: activeTab === 'LINUX' ? 'var(--primary-500)' : 'var(--border-medium)',
            backgroundColor: activeTab === 'LINUX' ? 'var(--primary-500)' : '#ffffff',
            color: activeTab === 'LINUX' ? '#ffffff' : 'var(--text-main)',
            fontWeight: 700,
            fontSize: '0.95rem',
            cursor: 'pointer',
          }}
        >
          🐧 Linux Devices & Kiosks
        </button>
      </div>

      {/* TAB CONTENT */}

      {/* 1. ANDROID */}
      {activeTab === 'ANDROID' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.5rem' }}>
          <div className="panel" style={{ padding: '2rem' }}>
            <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>📦</div>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 800, marginBottom: '0.5rem' }}>
              Standalone Android APK Download
            </h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem', lineHeight: 1.6, marginBottom: '1.5rem' }}>
              Direct installable package for any Android device (tablets, phones, rugged scanners). No Google Play account required.
            </p>

            <a
              href="#download-apk"
              onClick={(e) => {
                e.preventDefault();
                alert('Downloading JiraniPass-Guard-v1.0.apk... (Built from apps/mobile via EAS or local gradle)');
              }}
              className="btn-primary"
              style={{ width: '100%', justifyContent: 'center', padding: '0.8rem', fontSize: '0.95rem' }}
            >
              📥 Download Android APK (v1.0)
            </a>

            <div style={{ marginTop: '1.5rem', borderTop: '1px solid var(--border-subtle)', paddingTop: '1rem' }}>
              <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-main)', marginBottom: '0.4rem' }}>
                Installation Guide:
              </div>
              <ol style={{ fontSize: '0.8rem', color: 'var(--text-muted)', paddingLeft: '1.2rem', lineHeight: 1.7 }}>
                <li>Tap <strong>Download Android APK</strong> on your device.</li>
                <li>When prompted, allow installation from this source.</li>
                <li>Open <strong>JiraniPass Guard</strong> from your home screen.</li>
                <li>Enter your Guard Station PIN (e.g. <code>1234</code>) to begin your shift.</li>
              </ol>
            </div>
          </div>

          <div className="panel" style={{ padding: '2rem' }}>
            <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>📲</div>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 800, marginBottom: '0.5rem' }}>
              Progressive Web App (PWA)
            </h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem', lineHeight: 1.6, marginBottom: '1.5rem' }}>
              Instant zero-install option that runs full-screen with offline caching on Samsung Internet, Chrome, or Firefox.
            </p>

            <button
              onClick={handleInstallClick}
              className="btn-secondary"
              style={{ width: '100%', justifyContent: 'center', padding: '0.8rem', fontSize: '0.95rem' }}
            >
              ➕ Add to Android Home Screen
            </button>

            <div style={{ marginTop: '1.5rem', borderTop: '1px solid var(--border-subtle)', paddingTop: '1rem' }}>
              <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-main)', marginBottom: '0.4rem' }}>
                Features on Android:
              </div>
              <ul style={{ fontSize: '0.8rem', color: 'var(--text-muted)', paddingLeft: '1.2rem', lineHeight: 1.7 }}>
                <li>High-contrast outdoor visibility theme for sunlight.</li>
                <li>Minimum 48×48dp ergonomic touch targets.</li>
                <li>Instant audio chime on WhatsApp resident approvals.</li>
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* 2. IOS */}
      {activeTab === 'IOS' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.5rem' }}>
          <div className="panel" style={{ padding: '2rem' }}>
            <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>🍏</div>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 800, marginBottom: '0.5rem' }}>
              Install on iPhone or iPad (Safari)
            </h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem', lineHeight: 1.6, marginBottom: '1.5rem' }}>
              iOS supports standalone web applications without App Store approval, running in full-screen mode.
            </p>

            <div style={{ backgroundColor: '#F8FAFC', padding: '1.2rem', borderRadius: '10px', border: '1px solid var(--border-subtle)', marginBottom: '1.5rem' }}>
              <div style={{ fontSize: '0.85rem', fontWeight: 800, color: '#0F172A', marginBottom: '0.5rem' }}>
                3-Step Safari Installation:
              </div>
              <ol style={{ fontSize: '0.85rem', color: 'var(--text-main)', paddingLeft: '1.2rem', lineHeight: 1.8 }}>
                <li>Open this page in <strong>Safari</strong> on your iPhone or iPad.</li>
                <li>Tap the <strong>Share</strong> button (box with an arrow pointing up at the bottom).</li>
                <li>Scroll down and tap <strong>"Add to Home Screen"</strong>.</li>
                <li>Tap <strong>Add</strong> in the top-right corner.</li>
              </ol>
            </div>

            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              The JiraniPass icon will now appear on your iOS home screen as a full-screen app.
            </p>
          </div>

          <div className="panel" style={{ padding: '2rem' }}>
            <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>🛡️</div>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 800, marginBottom: '0.5rem' }}>
              iPad Gate Station Kiosk Mode
            </h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem', lineHeight: 1.6, marginBottom: '1.5rem' }}>
              For estate gates mounted with an iPad, iOS <strong>Guided Access</strong> locks the iPad strictly to JiraniPass so guards cannot leave the screen.
            </p>

            <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '1rem' }}>
              <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-main)', marginBottom: '0.4rem' }}>
                Enabling iPad Kiosk Lock:
              </div>
              <ol style={{ fontSize: '0.8rem', color: 'var(--text-muted)', paddingLeft: '1.2rem', lineHeight: 1.7 }}>
                <li>Go to <strong>Settings</strong> &gt; <strong>Accessibility</strong> &gt; <strong>Guided Access</strong>.</li>
                <li>Toggle Guided Access <strong>ON</strong>.</li>
                <li>Open JiraniPass and triple-click the top or side button to lock the kiosk.</li>
              </ol>
            </div>
          </div>
        </div>
      )}

      {/* 3. LINUX */}
      {activeTab === 'LINUX' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.5rem' }}>
          <div className="panel" style={{ padding: '2rem' }}>
            <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>🐧</div>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 800, marginBottom: '0.5rem' }}>
              Universal Linux .AppImage
            </h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem', lineHeight: 1.6, marginBottom: '1.5rem' }}>
              Runs on <strong>all Linux distributions</strong> (Ubuntu, Debian, Fedora, Arch, CentOS, openSUSE) with zero installation dependencies.
            </p>

            <a
              href="#download-appimage"
              onClick={(e) => {
                e.preventDefault();
                alert('Downloading JiraniPass-Guard-1.0.0-linux-x86_64.AppImage... (Built via apps/desktop)');
              }}
              className="btn-primary"
              style={{ width: '100%', justifyContent: 'center', padding: '0.8rem', fontSize: '0.95rem' }}
            >
              📥 Download Linux .AppImage
            </a>

            <div style={{ marginTop: '1.5rem', borderTop: '1px solid var(--border-subtle)', paddingTop: '1rem' }}>
              <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-main)', marginBottom: '0.4rem' }}>
                Run from Linux Terminal:
              </div>
              <div
                style={{
                  backgroundColor: '#0F172A',
                  color: '#38BDF8',
                  padding: '0.75rem',
                  borderRadius: '6px',
                  fontFamily: 'var(--font-mono)',
                  fontSize: '0.78rem',
                  overflowX: 'auto',
                }}
              >
                chmod +x JiraniPass-Guard-*.AppImage<br />
                ./JiraniPass-Guard-*.AppImage
              </div>
            </div>
          </div>

          <div className="panel" style={{ padding: '2rem' }}>
            <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>📦</div>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 800, marginBottom: '0.5rem' }}>
              Debian / Ubuntu .deb Package
            </h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem', lineHeight: 1.6, marginBottom: '1.5rem' }}>
              Native Debian package with desktop icon, system menu registration, and automatic update capabilities.
            </p>

            <a
              href="#download-deb"
              onClick={(e) => {
                e.preventDefault();
                alert('Downloading jiranipass-guard_1.0.0_amd64.deb... (Built via apps/desktop)');
              }}
              className="btn-secondary"
              style={{ width: '100%', justifyContent: 'center', padding: '0.8rem', fontSize: '0.95rem' }}
            >
              📥 Download Debian / Ubuntu .deb
            </a>

            <div style={{ marginTop: '1.5rem', borderTop: '1px solid var(--border-subtle)', paddingTop: '1rem' }}>
              <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-main)', marginBottom: '0.4rem' }}>
                Install on Ubuntu / Debian:
              </div>
              <div
                style={{
                  backgroundColor: '#0F172A',
                  color: '#38BDF8',
                  padding: '0.75rem',
                  borderRadius: '6px',
                  fontFamily: 'var(--font-mono)',
                  fontSize: '0.78rem',
                  overflowX: 'auto',
                }}
              >
                sudo dpkg -i jiranipass-guard_*.deb<br />
                sudo apt-get install -f
              </div>
            </div>
          </div>

          <div className="panel" style={{ padding: '2rem', gridColumn: '1 / -1' }}>
            <h3 style={{ fontSize: '1.15rem', fontWeight: 800, marginBottom: '0.5rem' }}>
              🖥️ Raspberry Pi & Linux Security Booth Kiosk Setup
            </h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem', lineHeight: 1.6, marginBottom: '1rem' }}>
              For unmanned or guardhouse touch monitors running Linux or Raspberry Pi OS, run JiraniPass in borderless fullscreen kiosk mode:
            </p>
            <div
              style={{
                backgroundColor: '#0F172A',
                color: '#34D399',
                padding: '0.85rem',
                borderRadius: '8px',
                fontFamily: 'var(--font-mono)',
                fontSize: '0.82rem',
                overflowX: 'auto',
              }}
            >
              # Run Linux Desktop in Fullscreen Kiosk Mode<br />
              pnpm --filter @jiranipass/desktop start -- --kiosk
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
