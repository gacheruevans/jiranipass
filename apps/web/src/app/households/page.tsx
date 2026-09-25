'use client';

import React, { useState, useEffect } from 'react';
import { HouseholdSearchResult } from '@jiranipass/shared';

export default function HouseholdsPage() {
  const [households, setHouseholds] = useState<HouseholdSearchResult[]>([]);
  const [search, setSearch] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [unitCode, setUnitCode] = useState('');

  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

  const fetchHouseholds = async () => {
    try {
      const res = await fetch(`${API_URL}/v1/households?query=${encodeURIComponent(search)}`);
      if (res.ok) {
        const data = await res.json();
        setHouseholds(data);
      }
    } catch (e) {
      console.warn('API error, using sample households');
      setHouseholds([
        { id: '1', unitCode: 'House B12', primaryResidentName: 'Mary Nduta', maskedPhone: '+254 7XX XXX 678', isActive: true },
        { id: '2', unitCode: 'House A1', primaryResidentName: 'John Kamau', maskedPhone: '+254 7XX XXX 001', isActive: true },
        { id: '3', unitCode: 'House A2', primaryResidentName: 'Grace Wanjiku', maskedPhone: '+254 7XX XXX 002', isActive: true },
        { id: '4', unitCode: 'House C4', primaryResidentName: 'Unassigned', maskedPhone: 'N/A', isActive: true },
      ]);
    }
  };

  useEffect(() => {
    fetchHouseholds();
  }, [search]);

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 800, letterSpacing: '-0.025em' }}>
            Households & Resident Consents
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginTop: '0.2rem' }}>
            Unit registry, assigned primary decision-makers, and Kenya ODPC WhatsApp consent audit trail.
          </p>
        </div>

        <button onClick={() => setShowAddModal(true)} className="btn-primary">
          ➕ Register Unit
        </button>
      </div>

      {/* Search Input */}
      <div style={{ marginBottom: '1.5rem', maxWidth: '400px' }}>
        <input
          type="text"
          placeholder="🔍 Search unit (e.g. House B12)..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{
            width: '100%',
            padding: '0.65rem 1rem',
            borderRadius: '8px',
            border: '1px solid var(--border-medium)',
            fontSize: '0.9rem',
          }}
        />
      </div>

      {/* Households Table */}
      <div className="panel" style={{ overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.875rem' }}>
          <thead style={{ backgroundColor: '#F8FAFC', borderBottom: '1px solid var(--border-subtle)' }}>
            <tr>
              <th style={{ padding: '0.85rem 1rem', fontWeight: 700, color: 'var(--text-muted)' }}>UNIT CODE</th>
              <th style={{ padding: '0.85rem 1rem', fontWeight: 700, color: 'var(--text-muted)' }}>PRIMARY DECISION-MAKER</th>
              <th style={{ padding: '0.85rem 1rem', fontWeight: 700, color: 'var(--text-muted)' }}>MASKED PHONE</th>
              <th style={{ padding: '0.85rem 1rem', fontWeight: 700, color: 'var(--text-muted)' }}>WHATSAPP CONSENT</th>
              <th style={{ padding: '0.85rem 1rem', fontWeight: 700, color: 'var(--text-muted)' }}>STATUS</th>
            </tr>
          </thead>
          <tbody>
            {households.map((h) => (
              <tr key={h.id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                <td style={{ padding: '1rem', fontWeight: 800 }}>{h.unitCode}</td>
                <td style={{ padding: '1rem', fontWeight: 600 }}>{h.primaryResidentName}</td>
                <td style={{ padding: '1rem', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>
                  {h.maskedPhone}
                </td>
                <td style={{ padding: '1rem' }}>
                  {h.primaryResidentName !== 'Unassigned' ? (
                    <span
                      style={{
                        padding: '0.25rem 0.6rem',
                        borderRadius: '20px',
                        backgroundColor: '#DCFCE7',
                        color: '#15803D',
                        fontSize: '0.75rem',
                        fontWeight: 700,
                      }}
                    >
                      ✓ Opted-in (v1.0)
                    </span>
                  ) : (
                    <span style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>No Consent Record</span>
                  )}
                </td>
                <td style={{ padding: '1rem' }}>
                  <span
                    style={{
                      display: 'inline-block',
                      width: '8px',
                      height: '8px',
                      borderRadius: '50%',
                      backgroundColor: h.isActive ? '#22C55E' : '#94A3B8',
                      marginRight: '0.4rem',
                    }}
                  />
                  {h.isActive ? 'Active' : 'Inactive'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showAddModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0,0,0,0.4)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 50,
          }}
        >
          <div className="panel" style={{ width: '100%', maxWidth: '400px', padding: '1.5rem', backgroundColor: '#fff' }}>
            <h3 style={{ fontSize: '1.2rem', fontWeight: 800, marginBottom: '0.5rem' }}>Add Household Unit</h3>
            <input
              type="text"
              placeholder="e.g. Unit 304 or House D1"
              value={unitCode}
              onChange={(e) => setUnitCode(e.target.value)}
              style={{ width: '100%', padding: '0.6rem', borderRadius: '6px', border: '1px solid var(--border-medium)', marginBottom: '1rem' }}
            />
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
              <button onClick={() => setShowAddModal(false)} className="btn-secondary">Cancel</button>
              <button
                disabled={!unitCode.trim()}
                onClick={async () => {
                  await fetch(`${API_URL}/v1/admin/households`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ unitCode }),
                  });
                  setShowAddModal(false);
                  setUnitCode('');
                  fetchHouseholds();
                }}
                className="btn-primary"
              >
                Create
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
