# JiraniPass — Estate Visitor Access Management

> A secure, privacy-first visitor access control system connecting security guards at estate gates with residents via the official WhatsApp Business Platform.

---

## Overview

**JiraniPass** streamlines residential estate security gate operations. When an unannounced visitor arrives at the gate:

1. **Arrival Capture:** The security guard searches for the target household unit and logs the visitor's details (name, optional vehicle plate, and purpose).
2. **Resident Approval via WhatsApp:** The system dispatches an official Meta-approved WhatsApp utility template to the designated household resident featuring interactive **Approve** and **Deny** buttons.
3. **Atomic Authorization:** When the resident taps a button, a cryptographically signed webhook verifies the response and updates the gate's live dashboard in real time.
4. **Physical Verification & Check-In:** The guard verifies the visitor's identity against the approved request details and admits them within a strict validity window (default 10 minutes), logging check-in and subsequent check-out.

---

## Core Features

- **WhatsApp Resident Verification**: Seamless resident approvals using official WhatsApp Business Cloud API utility templates—no mobile app download required for residents in the MVP.
- **Guard Mobile Application**: Android-first tablet and mobile app (Expo / React Native) with high-contrast UI for outdoor visibility, fast indexed unit lookup, and live real-time status updates via Server-Sent Events (SSE).
- **Fail-Closed Security**: Entry is denied by default unless an explicit, valid approval is received within the expiration window. Stale or duplicate replies cannot authorize entry.
- **Supervisor Override & Audit Trail**: Any exceptional entry during network outages or emergencies requires supervisor credentials and mandatory justification, logged separately from resident approval.
- **Privacy & Kenya ODPC Compliance**:
  - Resident phone numbers are masked on guard screens.
  - Explicit WhatsApp consent capture with version and timestamp logging.
  - Automatic 90-day retention purge for routine visitor logs.
- **Outbox Architecture**: Transactional outbox pattern using PostgreSQL and Redis/BullMQ ensures reliable message dispatch and tamper-proof state transitions.

---

## Architecture & Technology Stack

| Layer | Technology | Purpose | Supported Platforms |
| :--- | :--- | :--- | :--- |
| **Guard Mobile App** | React Native (Expo) | Gate interface for visitor arrival capture & live approvals | **Android (APK/AAB)**, **iOS (IPA)** |
| **Desktop Gate Station** | Electron | High-performance kiosk station for gate booths | **Linux (.AppImage, .deb)** |
| **Universal PWA** | Next.js, Web App Manifest | Zero-install offline app with 1-click desktop/mobile installation | **Linux**, **Android**, **iOS** |
| **Management Console** | Next.js, React, Tailwind CSS | Estate administration, unit enrollment, resident consent tracking | Web / Desktop / Mobile |
| **Backend API** | NestJS (TypeScript) | RBAC, tenant scoping, visit state engine, SSE streams, webhooks | Linux Container (Docker) |
| **Outbox & Jobs** | Redis + BullMQ | Reliable WhatsApp message delivery with backoff retry & expiry | Linux Container (Docker) |
| **Database** | PostgreSQL + Prisma | Relational data persistence, optimistic concurrency control | PostgreSQL 16 |

---

## Cross-Platform Installation (Android, iOS & Linux)

JiraniPass can be installed across all devices used by guards, supervisors, and gate stations:

### 🤖 Android Devices (Phones & Tablets)
1. **Direct Standalone APK**: Download the pre-built `JiraniPass-Guard-v1.0.apk` from the Download Hub (`/download`) or build locally:
   ```bash
   pnpm --filter @jiranipass/mobile eas build -p android --profile preview
   ```
2. **Instant PWA Installation**: Open the web portal in Chrome on Android and tap **"Install App"** to add it to your home screen.
3. **Google Play Store AAB**: Generate production App Bundle via `eas build -p android --profile production`.

### 🍏 iOS Devices (iPhone & iPad)
1. **Safari Standalone App**: Open the web portal in iOS Safari, tap the **Share** button, and select **"Add to Home Screen"**.
2. **iPad Gate Kiosk Lock**: Mount an iPad at the gate station and enable **Guided Access** (`Settings > Accessibility > Guided Access`) to lock the station strictly into JiraniPass.
3. **TestFlight / Enterprise IPA**: Build with `pnpm --filter @jiranipass/mobile eas build -p ios`.

### 🐧 Linux Devices & Security Booth Terminals
1. **Universal Linux `.AppImage`**:
   Runs on all Linux distributions (Ubuntu, Debian, Fedora, Arch, Raspberry Pi OS) with zero external dependencies:
   ```bash
   # Build Linux AppImage
   pnpm desktop:linux

   # Run on any Linux machine
   chmod +x JiraniPass-Guard-1.0.0-linux-x86_64.AppImage
   ./JiraniPass-Guard-1.0.0-linux-x86_64.AppImage
   ```
2. **Debian / Ubuntu `.deb` Package**:
   ```bash
   sudo dpkg -i jiranipass-guard_1.0.0_amd64.deb
   ```
3. **Fullscreen Kiosk Mode** (for Raspberry Pi or booth touchscreens):
   ```bash
   pnpm desktop:start -- --kiosk
   ```
4. **Linux Desktop PWA Launcher**:
   In Chrome/Chromium/Edge on Linux, click the install icon in the address bar to create a native desktop launcher integrated into your desktop environment (GNOME, KDE Plasma, XFCE).

---

## Documentation

- [Implementation Plan](file:///Users/egacheru/Projects/Personal/jiranipass/implementation.md) — Architectural specification, data models, state machine, and security controls.
- [Engineering Workplan](file:///Users/egacheru/Projects/Personal/jiranipass/workplan.md) — 8-week phased execution roadmap, WBS tracks, RACI matrix, and pilot milestones.

---

## License

**Private & Confidential**

Copyright © 2026 JiraniPass. All rights reserved.

This software, its source code, and associated documentation are proprietary and confidential. Unauthorized copying, modification, distribution, reverse engineering, or transfer of this software, via any medium, is strictly prohibited without explicit written permission from the copyright holders.
