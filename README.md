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

| Layer | Technology | Purpose |
| :--- | :--- | :--- |
| **Guard Mobile App** | React Native (Expo) | Gate tablet/phone interface for visitor capture, live SSE updates, and check-in/out |
| **Management Console** | Next.js, React, Tailwind CSS | Estate administration, unit enrollment, resident consent tracking, and audit log review |
| **Backend API** | NestJS (TypeScript) | RBAC, tenant scoping, visit state engine, SSE streams, and webhook ingestion |
| **Outbox & Jobs** | Redis + BullMQ | Reliable WhatsApp message delivery with backoff retry and request expiry management |
| **Database** | PostgreSQL + Prisma | Relational data persistence, optimistic concurrency control, and immutable audit logs |
| **Messaging Integration** | WhatsApp Business Cloud API (Meta) | Signed quick-reply utility templates with HMAC-SHA256 signature verification |

---

## Documentation

- [Implementation Plan](file:///Users/egacheru/Projects/Personal/jiranipass/implementation.md) — Architectural specification, data models, state machine, and security controls.
- [Engineering Workplan](file:///Users/egacheru/Projects/Personal/jiranipass/workplan.md) — 8-week phased execution roadmap, WBS tracks, RACI matrix, and pilot milestones.

---

## License

**Private & Confidential**

Copyright © 2026 JiraniPass. All rights reserved.

This software, its source code, and associated documentation are proprietary and confidential. Unauthorized copying, modification, distribution, reverse engineering, or transfer of this software, via any medium, is strictly prohibited without explicit written permission from the copyright holders.
