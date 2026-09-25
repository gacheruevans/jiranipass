'use client';

import React, { useState, useEffect } from 'react';
import { VisitRequestResponse, VisitStatus } from '@jiranipass/shared';

export default function DashboardPage() {
  const [requests, setRequests] = useState<VisitRequestResponse[]>([]);
  const [filter, setFilter] = useState<'ALL' | 'PENDING' | 'APPROVED' | 'INSIDE'>('ALL');
  const [isLoading, setIsLoading] = useState(true);
  const [isSimulating, setIsSimulating] = useState<string | null>(null);

  // Quick arrival capture modal state
  const [showModal, setShowModal] = useState(false);
  const [unitCode, setUnitCode] = useState('House B12');
  const [visitorName, setVisitorName] = useState('');
  const [vehiclePlate, setVehiclePlate] = useState('');
  const [purpose, setPurpose] = useState('Personal visit');

  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

  // Fetch visit requests
  const fetchRequests = async () => {
    try {
      // In dev console, query requests with guard login or simulated token
      const res = await fetch(`${API_URL}/v1/visit-requests?limit=50`, {
        headers: {
          // Dev bypass or Authorization token
          'Content-Type': 'application/json',
        },
      });
      if (res.ok) {
        const data = await res.json();
        setRequests(data);
      }
    } catch (err) {
      console.warn('Backend API not reachable yet. Showing demo data.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchRequests();
    // Poll every 4 seconds as fallback
    const interval = setInterval(fetchRequests, 4000);
    return () => clearInterval(interval);
  }, []);

  // Simulate resident reply (Approve / Deny)
  const handleSimulateReply = async (requestId: string, action: 'APPROVE' | 'DENY') => {
    setIsSimulating(requestId);
    try {
      await fetch(`${API_URL}/v1/webhooks/whatsapp/simulate-reply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requestId, action }),
      });
      await fetchRequests();
    } catch (e) {
      console.error(e);
    } finally {
      setIsSimulating(null);
    }
  };

  // Status Badge Component
  const renderStatusBadge = (status: VisitStatus) => {
    const styleMap: Record<string, { bg: string; text: string; border: string; label: string }> = {
      [VisitStatus.PENDING]: {
        bg: 'var(--status-pending-bg)',
        text: 'var(--status-pending-text)',
        border: 'var(--status-pending-border)',
        label: '⏳ Pending WhatsApp Reply',
      },
      [VisitStatus.APPROVED]: {
        bg: 'var(--status-approved-bg)',
        text: 'var(--status-approved-text)',
        border: 'var(--status-approved-border)',
        label: '✅ Approved (Ready to Admit)',
      },
      [VisitStatus.CHECKED_IN]: {
        bg: 'var(--status-checkedin-bg)',
        text: 'var(--status-checkedin-text)',
        border: 'var(--status-checkedin-border)',
        label: '🏠 Checked In (Inside)',
      },
      [VisitStatus.CHECKED_OUT]: {
        bg: '#F1F5F9',
        text: '#475569',
        border: '#CBD5E1',
        label: '👋 Departed',
      },
      [VisitStatus.DENIED]: {
        bg: 'var(--status-denied-bg)',
        text: 'var(--status-denied-text)',
        border: 'var(--status-denied-border)',
        label: '⛔ Denied by Resident',
      },
      [VisitStatus.EXPIRED]: {
        bg: '#FEF2F2',
        text: '#991B1B',
        border: '#FECACA',
        label: '⏰ Expired (No Reply)',
      },
      [VisitStatus.OVERRIDE_ADMITTED]: {
        bg: '#F5F3FF',
        text: '#6D28D9',
        border: '#DDD6FE',
        label: '🛡️ Supervisor Override',
      },
    };

    const s = styleMap[status] || { bg: '#F1F5F9', text: '#334155', border: '#E2E8F0', label: status };

    return (
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '0.35rem',
          padding: '0.3rem 0.65rem',
          borderRadius: '9999px',
          fontSize: '0.78rem',
          fontWeight: 700,
          backgroundColor: s.bg,
          color: s.text,
          border: `1px solid ${s.border}`,
        }}
      >
        {status === VisitStatus.PENDING && <span className="pulse-indicator" />}
        {s.label}
      </span>
    );
  };

  // Filter requests
  const filteredRequests = requests.filter((r) => {
    if (filter === 'PENDING') return r.status === VisitStatus.PENDING;
    if (filter === 'APPROVED') return r.status === VisitStatus.APPROVED;
    if (filter === 'INSIDE') return r.status === VisitStatus.CHECKED_IN;
    return true;
  });

  return (
    <div>
      {/* Top Banner & Quick Action */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '2rem',
          flexWrap: 'wrap',
          gap: '1rem',
        }}
      >
        <div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 800, letterSpacing: '-0.025em' }}>
            Gate Visitor Dashboard
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginTop: '0.2rem' }}>
            Real-time live monitoring of arrival requests, WhatsApp approvals, and visitor check-ins.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button
            onClick={() => setShowModal(true)}
            className="btn-primary"
            style={{ fontSize: '0.9rem' }}
          >
            ➕ Log Visitor Arrival
          </button>
        </div>
      </div>

      {/* Metrics Row */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: '1rem',
          marginBottom: '2rem',
        }}
      >
        <div className="panel" style={{ padding: '1.25rem' }}>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600 }}>TOTAL TODAY</div>
          <div style={{ fontSize: '1.8rem', fontWeight: 800, marginTop: '0.3rem' }}>{requests.length}</div>
          <div style={{ fontSize: '0.75rem', color: 'hsl(145, 80%, 30%)', marginTop: '0.25rem' }}>Active Main Gate</div>
        </div>

        <div className="panel" style={{ padding: '1.25rem' }}>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600 }}>AWAITING REPLY</div>
          <div style={{ fontSize: '1.8rem', fontWeight: 800, color: 'hsl(38, 92%, 40%)', marginTop: '0.3rem' }}>
            {requests.filter((r) => r.status === VisitStatus.PENDING).length}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>WhatsApp Utility Alerts</div>
        </div>

        <div className="panel" style={{ padding: '1.25rem' }}>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600 }}>CURRENTLY INSIDE</div>
          <div style={{ fontSize: '1.8rem', fontWeight: 800, color: 'hsl(221, 83%, 50%)', marginTop: '0.3rem' }}>
            {requests.filter((r) => r.status === VisitStatus.CHECKED_IN).length}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>Admitted Visitors</div>
        </div>

        <div className="panel" style={{ padding: '1.25rem' }}>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600 }}>READY TO ADMIT</div>
          <div style={{ fontSize: '1.8rem', fontWeight: 800, color: 'hsl(145, 80%, 35%)', marginTop: '0.3rem' }}>
            {requests.filter((r) => r.status === VisitStatus.APPROVED).length}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>Valid Approval Window</div>
        </div>
      </div>

      {/* Filter Tabs */}
      <div
        style={{
          display: 'flex',
          gap: '0.5rem',
          marginBottom: '1rem',
          borderBottom: '1px solid var(--border-subtle)',
          paddingBottom: '0.75rem',
        }}
      >
        {(['ALL', 'PENDING', 'APPROVED', 'INSIDE'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setFilter(tab)}
            style={{
              padding: '0.4rem 0.9rem',
              borderRadius: '6px',
              border: 'none',
              fontWeight: 600,
              fontSize: '0.85rem',
              cursor: 'pointer',
              backgroundColor: filter === tab ? 'var(--primary-500)' : 'transparent',
              color: filter === tab ? '#ffffff' : 'var(--text-muted)',
              transition: 'all 120ms ease',
            }}
          >
            {tab === 'ALL' && 'All Requests'}
            {tab === 'PENDING' && 'Pending Reply'}
            {tab === 'APPROVED' && 'Approved (Gate Ready)'}
            {tab === 'INSIDE' && 'Inside Estate'}
          </button>
        ))}
      </div>

      {/* Requests Table Panel */}
      <div className="panel" style={{ overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.875rem' }}>
          <thead style={{ backgroundColor: '#F8FAFC', borderBottom: '1px solid var(--border-subtle)' }}>
            <tr>
              <th style={{ padding: '0.85rem 1rem', fontWeight: 700, color: 'var(--text-muted)' }}>REF</th>
              <th style={{ padding: '0.85rem 1rem', fontWeight: 700, color: 'var(--text-muted)' }}>DESTINATION</th>
              <th style={{ padding: '0.85rem 1rem', fontWeight: 700, color: 'var(--text-muted)' }}>VISITOR DETAILS</th>
              <th style={{ padding: '0.85rem 1rem', fontWeight: 700, color: 'var(--text-muted)' }}>HOST / RESIDENT</th>
              <th style={{ padding: '0.85rem 1rem', fontWeight: 700, color: 'var(--text-muted)' }}>STATUS</th>
              <th style={{ padding: '0.85rem 1rem', fontWeight: 700, color: 'var(--text-muted)', textAlign: 'right' }}>
                ACTIONS
              </th>
            </tr>
          </thead>
          <tbody>
            {filteredRequests.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ padding: '3rem 1rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                  <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>📋</div>
                  <div style={{ fontWeight: 600 }}>No requests in this view</div>
                  <div style={{ fontSize: '0.8rem', marginTop: '0.2rem' }}>
                    New visitor arrival requests will appear here dynamically.
                  </div>
                </td>
              </tr>
            ) : (
              filteredRequests.map((req) => (
                <tr
                  key={req.id}
                  style={{
                    borderBottom: '1px solid var(--border-subtle)',
                    transition: 'background-color 100ms ease',
                  }}
                >
                  <td style={{ padding: '1rem', fontFamily: 'var(--font-mono)', fontWeight: 700 }}>
                    {req.reference}
                  </td>
                  <td style={{ padding: '1rem', fontWeight: 600 }}>{req.unitCode}</td>
                  <td style={{ padding: '1rem' }}>
                    <div style={{ fontWeight: 600 }}>{req.visitorName}</div>
                    {req.vehiclePlate && (
                      <div
                        style={{
                          display: 'inline-block',
                          backgroundColor: '#FEF3C7',
                          color: '#92400E',
                          padding: '0.1rem 0.4rem',
                          borderRadius: '4px',
                          fontSize: '0.72rem',
                          fontWeight: 700,
                          marginTop: '0.2rem',
                        }}
                      >
                        🚗 {req.vehiclePlate}
                      </div>
                    )}
                  </td>
                  <td style={{ padding: '1rem', color: 'var(--text-muted)' }}>
                    {req.assignedResidentName || 'Primary Host'}
                  </td>
                  <td style={{ padding: '1rem' }}>{renderStatusBadge(req.status)}</td>
                  <td style={{ padding: '1rem', textAlign: 'right' }}>
                    {/* If PENDING, show simulate reply buttons for testing */}
                    {req.status === VisitStatus.PENDING && (
                      <div style={{ display: 'inline-flex', gap: '0.35rem' }}>
                        <button
                          disabled={isSimulating === req.id}
                          onClick={() => handleSimulateReply(req.id, 'APPROVE')}
                          style={{
                            padding: '0.3rem 0.6rem',
                            backgroundColor: '#DCFCE7',
                            color: '#15803D',
                            border: '1px solid #86EFAC',
                            borderRadius: '6px',
                            fontWeight: 700,
                            fontSize: '0.75rem',
                            cursor: 'pointer',
                          }}
                        >
                          Simulate Approve
                        </button>
                        <button
                          disabled={isSimulating === req.id}
                          onClick={() => handleSimulateReply(req.id, 'DENY')}
                          style={{
                            padding: '0.3rem 0.6rem',
                            backgroundColor: '#FEE2E2',
                            color: '#B91C1C',
                            border: '1px solid #FCA5A5',
                            borderRadius: '6px',
                            fontWeight: 700,
                            fontSize: '0.75rem',
                            cursor: 'pointer',
                          }}
                        >
                          Deny
                        </button>
                      </div>
                    )}

                    {req.status === VisitStatus.APPROVED && (
                      <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'hsl(145, 80%, 30%)' }}>
                        Ready for Guard ID Check
                      </span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Arrival Simulation Modal */}
      {showModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.4)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 50,
          }}
        >
          <div
            className="panel"
            style={{
              width: '100%',
              maxWidth: '460px',
              padding: '1.75rem',
              backgroundColor: '#ffffff',
            }}
          >
            <h3 style={{ fontSize: '1.25rem', fontWeight: 800, marginBottom: '0.25rem' }}>
              Record Arriving Visitor
            </h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1.25rem' }}>
              Initiates an instant WhatsApp access request to the household resident.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.9rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, marginBottom: '0.25rem' }}>
                  Target Unit
                </label>
                <select
                  value={unitCode}
                  onChange={(e) => setUnitCode(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '0.6rem',
                    borderRadius: '6px',
                    border: '1px solid var(--border-medium)',
                  }}
                >
                  <option value="House B12">House B12 (Mary Nduta - +254712345678)</option>
                  <option value="House A1">House A1 (John Kamau - +254722000001)</option>
                  <option value="House A2">House A2 (Grace Wanjiku - +254733000002)</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, marginBottom: '0.25rem' }}>
                  Visitor Full Name *
                </label>
                <input
                  type="text"
                  placeholder="e.g. Peter Otieno"
                  value={visitorName}
                  onChange={(e) => setVisitorName(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '0.6rem',
                    borderRadius: '6px',
                    border: '1px solid var(--border-medium)',
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, marginBottom: '0.25rem' }}>
                  Vehicle Plate (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. KDD 420X"
                  value={vehiclePlate}
                  onChange={(e) => setVehiclePlate(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '0.6rem',
                    borderRadius: '6px',
                    border: '1px solid var(--border-medium)',
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, marginBottom: '0.25rem' }}>
                  Purpose of Visit
                </label>
                <input
                  type="text"
                  placeholder="e.g. Delivery / Family Visit"
                  value={purpose}
                  onChange={(e) => setPurpose(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '0.6rem',
                    borderRadius: '6px',
                    border: '1px solid var(--border-medium)',
                  }}
                />
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.5rem' }}>
              <button onClick={() => setShowModal(false)} className="btn-secondary">
                Cancel
              </button>
              <button
                disabled={!visitorName.trim()}
                onClick={async () => {
                  try {
                    // Search household id
                    const hRes = await fetch(`${API_URL}/v1/households?query=${encodeURIComponent(unitCode)}`);
                    const households = await hRes.json();
                    if (households && households.length > 0) {
                      await fetch(`${API_URL}/v1/visit-requests`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                          householdId: households[0].id,
                          visitorName,
                          vehiclePlate,
                          purpose,
                          gateId: 'GATE-MAIN',
                        }),
                      });
                      setShowModal(false);
                      setVisitorName('');
                      setVehiclePlate('');
                      fetchRequests();
                    }
                  } catch (err) {
                    console.error('Error logging visit:', err);
                  }
                }}
                className="btn-primary"
              >
                Send WhatsApp Alert
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
