import React, { useState, useEffect } from 'react';
import { ShieldAlert, Plus, CheckCircle2, AlertTriangle, Lock, Eye, Trash2 } from 'lucide-react';
import { getApiUrl } from '../config';

export default function WatchlistManager({ onTriggerContainment }) {
  const [watchlist, setWatchlist] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [newPlate, setNewPlate] = useState('');
  const [newType, setNewType] = useState('STOLEN_VEHICLE');
  const [newSeverity, setNewSeverity] = useState('CRITICAL');
  const [newNotes, setNewNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const fetchWatchlistData = () => {
    fetch(getApiUrl('/api/watchlist'))
      .then(res => res.json())
      .then(data => {
        if (data.watchlist) setWatchlist(data.watchlist);
      })
      .catch(err => console.warn('Failed to load watchlist:', err));

    fetch(getApiUrl('/api/watchlist/alerts'))
      .then(res => res.json())
      .then(data => {
        if (data.alerts) setAlerts(data.alerts);
      })
      .catch(err => console.warn('Failed to load alerts:', err));
  };

  useEffect(() => {
    fetchWatchlistData();
    const interval = setInterval(fetchWatchlistData, 4000);
    return () => clearInterval(interval);
  }, []);

  const handleAddPlate = (e) => {
    e.preventDefault();
    if (!newPlate.trim()) return;

    setSubmitting(true);
    fetch(getApiUrl('/api/watchlist'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        plate_number: newPlate.trim(),
        alert_type: newType,
        severity: newSeverity,
        notes: newNotes
      })
    })
      .then(res => res.json())
      .then(() => {
        setNewPlate('');
        setNewNotes('');
        fetchWatchlistData();
      })
      .catch(err => console.warn('Failed to add watchlist:', err))
      .finally(() => setSubmitting(false));
  };

  const handleAckAlert = (alertId) => {
    fetch(getApiUrl(`/api/watchlist/alerts/${alertId}/ack`), { method: 'POST' })
      .then(() => fetchWatchlistData())
      .catch(err => console.warn('Failed to ack alert:', err));
  };

  return (
    <div className="gov-section" id="section-watchlist">
      <div className="gov-section-header">
        <div className="gov-section-title" style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
          <ShieldAlert size={18} style={{ color: '#dc2626' }} />
          <span>SECURITY WATCHLIST & REAL-TIME INCIDENT ALERTS</span>
        </div>
        <span style={{ fontSize: '0.725rem', color: '#64748b', fontFamily: 'monospace' }}>
          LAW ENFORCEMENT & TRAFFIC POLICE HOTLIST
        </span>
      </div>

      {/* Active Security Alerts Banner */}
      {alerts.length > 0 && (
        <div style={{
          backgroundColor: '#fef2f2',
          border: '2px solid #ef4444',
          borderRadius: '5px',
          padding: '1rem',
          marginBottom: '1.25rem'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.65rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#dc2626', fontWeight: 800, fontSize: '0.85rem', fontFamily: 'monospace' }}>
              <AlertTriangle size={18} />
              <span>URGENT WATCHLIST INTERCEPTION ALERTS ({alerts.length} ACTIVE)</span>
            </div>
            <span style={{ fontSize: '0.7rem', color: '#991b1b', fontFamily: 'monospace' }}>
              DETERMINISTIC CONTAINMENT READY
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {alerts.map((a) => (
              <div key={a.id} style={{
                backgroundColor: '#ffffff',
                border: '1px solid #fecaca',
                borderRadius: '4px',
                padding: '0.65rem 0.85rem',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                fontSize: '0.75rem'
              }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <strong style={{ fontFamily: 'monospace', fontSize: '0.95rem', color: '#dc2626' }}>
                      {a.plate_number}
                    </strong>
                    <span style={{
                      backgroundColor: '#fee2e2',
                      color: '#991b1b',
                      fontSize: '0.65rem',
                      fontWeight: 800,
                      padding: '0.1rem 0.35rem',
                      borderRadius: '2px'
                    }}>
                      {a.alert_type} ({a.severity})
                    </span>
                    <span style={{ color: '#64748b', fontSize: '0.7rem' }}>
                      Spotted on <strong>{a.camera_id}</strong> at {a.timestamp}
                    </span>
                  </div>
                  <div style={{ color: '#475569', fontSize: '0.725rem', marginTop: '2px' }}>
                    {a.notes || 'Flagged suspect vehicle matching hotlist profile.'}
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '0.4rem' }}>
                  <button
                    onClick={() => handleAckAlert(a.id)}
                    className="gov-btn"
                    style={{ fontSize: '0.7rem', padding: '0.2rem 0.5rem', backgroundColor: '#059669' }}
                  >
                    <CheckCircle2 size={12} /> Acknowledge
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Watchlist Grid (Form + Table) */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.25rem' }}>
        {/* Add Entry Form */}
        <div style={{ backgroundColor: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '4px', padding: '1rem' }}>
          <div style={{ fontSize: '0.8rem', fontWeight: 800, color: '#0b2545', textTransform: 'uppercase', marginBottom: '0.75rem' }}>
            Add Monitored Vehicle to Watchlist
          </div>

          <form onSubmit={handleAddPlate} style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
            <div>
              <label style={{ fontSize: '0.7rem', color: '#475569', fontWeight: 700, display: 'block', marginBottom: '0.2rem' }}>
                VEHICLE REGISTRATION NUMBER (HSRP)
              </label>
              <input
                type="text"
                value={newPlate}
                onChange={(e) => setNewPlate(e.target.value.toUpperCase())}
                placeholder="e.g. TS09EA1234"
                required
                style={{
                  width: '100%',
                  padding: '0.4rem 0.6rem',
                  fontFamily: 'monospace',
                  fontWeight: 700,
                  fontSize: '0.85rem',
                  border: '1px solid #94a3b8',
                  borderRadius: '3px'
                }}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
              <div>
                <label style={{ fontSize: '0.7rem', color: '#475569', fontWeight: 700, display: 'block', marginBottom: '0.2rem' }}>
                  ALERT CATEGORY
                </label>
                <select
                  value={newType}
                  onChange={(e) => setNewType(e.target.value)}
                  style={{ width: '100%', padding: '0.35rem 0.5rem', fontSize: '0.75rem', borderRadius: '3px', border: '1px solid #94a3b8' }}
                >
                  <option value="STOLEN_VEHICLE">Stolen Vehicle</option>
                  <option value="CRIMINAL_SUSPECT">Wanted Suspect</option>
                  <option value="TRAFFIC_VIOLATOR">E-Challan Violator</option>
                  <option value="VIP_ESCORT">VIP Priority Escort</option>
                </select>
              </div>

              <div>
                <label style={{ fontSize: '0.7rem', color: '#475569', fontWeight: 700, display: 'block', marginBottom: '0.2rem' }}>
                  SEVERITY RANK
                </label>
                <select
                  value={newSeverity}
                  onChange={(e) => setNewSeverity(e.target.value)}
                  style={{ width: '100%', padding: '0.35rem 0.5rem', fontSize: '0.75rem', borderRadius: '3px', border: '1px solid #94a3b8' }}
                >
                  <option value="CRITICAL">P1: Critical</option>
                  <option value="HIGH">P2: High</option>
                  <option value="MEDIUM">P3: Medium</option>
                  <option value="LOW">P4: Low</option>
                </select>
              </div>
            </div>

            <div>
              <label style={{ fontSize: '0.7rem', color: '#475569', fontWeight: 700, display: 'block', marginBottom: '0.2rem' }}>
                CASE / FIR NOTES & ISSUING POLICE STATION
              </label>
              <textarea
                value={newNotes}
                onChange={(e) => setNewNotes(e.target.value)}
                placeholder="e.g. Stolen car FIR #402/2026 registered at Banjara Hills PS."
                rows={2}
                style={{
                  width: '100%',
                  padding: '0.4rem 0.6rem',
                  fontSize: '0.75rem',
                  border: '1px solid #94a3b8',
                  borderRadius: '3px',
                  resize: 'none'
                }}
              />
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="gov-btn"
              style={{ backgroundColor: '#dc2626', borderColor: '#b91c1c', marginTop: '0.25rem', justifyContent: 'center' }}
            >
              <Plus size={14} /> {submitting ? 'Adding...' : 'Add Plate to Watchlist'}
            </button>
          </form>
        </div>

        {/* Monitored Watchlist Table */}
        <div style={{ backgroundColor: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '4px', padding: '1rem' }}>
          <div style={{ fontSize: '0.8rem', fontWeight: 800, color: '#0b2545', textTransform: 'uppercase', marginBottom: '0.75rem' }}>
            Active Watchlist Registry ({watchlist.length} Monitored)
          </div>

          <div className="gov-table-container">
            <table className="gov-data-table" style={{ fontSize: '0.725rem' }}>
              <thead>
                <tr>
                  <th>Plate Number</th>
                  <th>Alert Category</th>
                  <th>Severity</th>
                  <th>Case Notes</th>
                </tr>
              </thead>
              <tbody>
                {watchlist.map((w) => (
                  <tr key={w.id}>
                    <td>
                      <strong style={{ fontFamily: 'monospace', fontSize: '0.85rem', color: '#0b2545' }}>
                        {w.plate_number}
                      </strong>
                    </td>
                    <td>
                      <span style={{ fontWeight: 600 }}>{w.alert_type}</span>
                    </td>
                    <td>
                      <span style={{
                        fontSize: '0.65rem',
                        fontWeight: 800,
                        padding: '0.1rem 0.35rem',
                        borderRadius: '2px',
                        backgroundColor: w.severity === 'CRITICAL' ? '#fef2f2' : w.severity === 'HIGH' ? '#fff7ed' : '#eff6ff',
                        color: w.severity === 'CRITICAL' ? '#dc2626' : w.severity === 'HIGH' ? '#ea580c' : '#2563eb',
                        border: '1px solid #cbd5e1'
                      }}>
                        {w.severity}
                      </span>
                    </td>
                    <td style={{ color: '#475569', maxWidth: '160px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {w.notes || 'Monitored'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
