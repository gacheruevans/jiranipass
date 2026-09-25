'use client';

import React, { useState, useEffect } from 'react';

interface AuditEvent {
  id: string;
  action: string;
  reference: string;
  visitorName: string;
  unitCode: string;
  gateId: string;
  actorName: string;
  actorRole: string;
  reason?: string;
  verificationMethod?: string;
  createdAt: string;
}

export default function AuditTrailPage() {
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [filterAction, setFilterAction] = useState<string>('ALL');

  useEffect(() => {
    // Demo audit records matching our seeded estate
    setEvents([
      {
        id: 'evt-1',
        action: 'REQUEST_CREATED',
        reference: 'V-8K4Q',
        visitorName: 'Mary Njoroge',
        unitCode: 'House B12',
        gateId: 'GATE-MAIN',
        actorName: 'Samson Omwamba',
        actorRole: 'GUARD',
        createdAt: new Date(Date.now() - 25 * 60 * 1000).toISOString(),
      },
      {
        id: 'evt-2',
        action: 'APPROVED',
        reference: 'V-8K4Q',
        visitorName: 'Mary Njoroge',
        unitCode: 'House B12',
        gateId: 'GATE-MAIN',
        actorName: 'Mary Nduta (Resident)',
        actorRole: 'RESIDENT',
        createdAt: new Date(Date.now() - 23 * 60 * 1000).toISOString(),
      },
      {
        id: 'evt-3',
        action: 'CHECKED_IN',
        reference: 'V-8K4Q',
        visitorName: 'Mary Njoroge',
        unitCode: 'House B12',
        gateId: 'GATE-MAIN',
        actorName: 'Samson Omwamba',
        actorRole: 'GUARD',
        verificationMethod: 'PHYSICAL_RECOGNITION',
        reason: 'Plate matched KDD 888Y',
        createdAt: new Date(Date.now() - 20 * 60 * 1000).toISOString(),
      },
      {
        id: 'evt-4',
        action: 'OVERRIDE_ADMITTED',
        reference: 'V-3M7T',
        visitorName: 'David Kilonzo',
        unitCode: 'House A1',
        gateId: 'GATE-MAIN',
        actorName: 'Peter Mwangi (Supervisor)',
        actorRole: 'SUPERVISOR',
        verificationMethod: 'PHONE_CALL_CONFIRMED',
        reason: 'Resident phone battery depleted; confirmed arrival directly via secondary landline number.',
        createdAt: new Date(Date.now() - 85 * 60 * 1000).toISOString(),
      },
    ]);
  }, []);

  const filteredEvents = events.filter((e) => {
    if (filterAction === 'OVERRIDE') return e.action === 'OVERRIDE_ADMITTED';
    if (filterAction === 'APPROVALS') return e.action === 'APPROVED' || e.action === 'DENIED';
    return true;
  });

  return (
    <div>
      <div style={{ marginBottom: '2rem' }}>
        <h1 style={{ fontSize: '1.75rem', fontWeight: 800, letterSpacing: '-0.025em' }}>
          Security & Access Audit Trail
        </h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginTop: '0.2rem' }}>
          Immutable record of visitor access events, resident WhatsApp decisions, and supervisor exceptions.
        </p>
      </div>

      {/* Filter Tabs */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.25rem' }}>
        {(['ALL', 'OVERRIDE', 'APPROVALS'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setFilterAction(tab)}
            style={{
              padding: '0.4rem 0.9rem',
              borderRadius: '6px',
              border: 'none',
              fontWeight: 600,
              fontSize: '0.85rem',
              cursor: 'pointer',
              backgroundColor: filterAction === tab ? 'var(--primary-500)' : '#E2E8F0',
              color: filterAction === tab ? '#ffffff' : 'var(--text-muted)',
            }}
          >
            {tab === 'ALL' && 'All Access Events'}
            {tab === 'OVERRIDE' && 'Supervisor Overrides'}
            {tab === 'APPROVALS' && 'Resident Decisions'}
          </button>
        ))}
      </div>

      {/* Events Table */}
      <div className="panel" style={{ overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.875rem' }}>
          <thead style={{ backgroundColor: '#F8FAFC', borderBottom: '1px solid var(--border-subtle)' }}>
            <tr>
              <th style={{ padding: '0.85rem 1rem', fontWeight: 700, color: 'var(--text-muted)' }}>TIMESTAMP</th>
              <th style={{ padding: '0.85rem 1rem', fontWeight: 700, color: 'var(--text-muted)' }}>ACTION</th>
              <th style={{ padding: '0.85rem 1rem', fontWeight: 700, color: 'var(--text-muted)' }}>REF & UNIT</th>
              <th style={{ padding: '0.85rem 1rem', fontWeight: 700, color: 'var(--text-muted)' }}>VISITOR</th>
              <th style={{ padding: '0.85rem 1rem', fontWeight: 700, color: 'var(--text-muted)' }}>ACTOR</th>
              <th style={{ padding: '0.85rem 1rem', fontWeight: 700, color: 'var(--text-muted)' }}>DETAILS & REASON</th>
            </tr>
          </thead>
          <tbody>
            {filteredEvents.map((evt) => (
              <tr key={evt.id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                <td style={{ padding: '1rem', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                  {new Date(evt.createdAt).toLocaleTimeString('en-KE', { hour: '2-digit', minute: '2-digit' })}
                </td>
                <td style={{ padding: '1rem' }}>
                  <span
                    style={{
                      padding: '0.2rem 0.5rem',
                      borderRadius: '4px',
                      fontSize: '0.75rem',
                      fontWeight: 700,
                      backgroundColor:
                        evt.action === 'OVERRIDE_ADMITTED'
                          ? '#F5F3FF'
                          : evt.action === 'APPROVED'
                          ? '#DCFCE7'
                          : evt.action === 'CHECKED_IN'
                          ? '#DBEAFE'
                          : '#F1F5F9',
                      color:
                        evt.action === 'OVERRIDE_ADMITTED'
                          ? '#6D28D9'
                          : evt.action === 'APPROVED'
                          ? '#15803D'
                          : evt.action === 'CHECKED_IN'
                          ? '#1E40AF'
                          : '#475569',
                    }}
                  >
                    {evt.action}
                  </span>
                </td>
                <td style={{ padding: '1rem' }}>
                  <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700 }}>{evt.reference}</span>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{evt.unitCode}</div>
                </td>
                <td style={{ padding: '1rem', fontWeight: 600 }}>{evt.visitorName}</td>
                <td style={{ padding: '1rem' }}>
                  <div style={{ fontWeight: 600 }}>{evt.actorName}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{evt.actorRole}</div>
                </td>
                <td style={{ padding: '1rem', fontSize: '0.82rem', maxWidth: '320px' }}>
                  {evt.reason ? (
                    <div style={{ color: '#0F172A', fontStyle: 'italic' }}>"{evt.reason}"</div>
                  ) : (
                    <span style={{ color: 'var(--text-faint)' }}>Standard procedure</span>
                  )}
                  {evt.verificationMethod && (
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                      Method: {evt.verificationMethod}
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
