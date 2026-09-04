import React from 'react';
import { Activity } from 'lucide-react';

export default function EventMonitor({ activeEvents = [], onClearEvents }) {
  return (
    <div className="gov-section" id="section-events">
      <div className="gov-section-header">
        <div className="gov-section-title" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <Activity size={16} style={{ color: '#dc2626' }} />
          <span>LIVE EVENT MONITOR (COMPUTER VISION)</span>
        </div>

        {/* Clear action */}
        {activeEvents.length > 0 && (
          <button onClick={onClearEvents} className="gov-btn gov-btn-secondary" style={{ fontSize: '0.7rem', padding: '0.15rem 0.5rem' }}>
            Reset Incidents
          </button>
        )}
      </div>

      <div className="gov-table-container">
        <table className="gov-data-table">
          <thead>
            <tr>
              <th>Event ID</th>
              <th>Event Type</th>
              <th>Location</th>
              <th>Priority</th>
              <th>Safety Validator</th>
              <th>Detected At</th>
            </tr>
          </thead>
          <tbody>
            {activeEvents.length > 0 ? (
              activeEvents.map((evt) => (
                <tr key={evt.event_id}>
                  <td style={{ fontFamily: 'monospace', fontWeight: 700, color: '#1b365d' }}>
                    {evt.event_id}
                  </td>
                  <td>
                    <span style={{
                      fontSize: '0.7rem',
                      fontWeight: 700,
                      padding: '0.1rem 0.4rem',
                      borderRadius: '2px',
                      backgroundColor: evt.category === 'EMERGENCY_VEHICLE' ? '#fef2f2' : '#fffbeb',
                      color: evt.category === 'EMERGENCY_VEHICLE' ? '#dc2626' : '#d97706',
                      border: evt.category === 'EMERGENCY_VEHICLE' ? '1px solid #fecaca' : '1px solid #fde68a'
                    }}>
                      {evt.category}
                    </span>
                  </td>
                  <td style={{ fontWeight: 600 }}>{evt.title} ({evt.source})</td>
                  <td style={{ fontFamily: 'monospace', fontWeight: 700, color: '#2563eb' }}>
                    {evt.category === 'EMERGENCY_VEHICLE' ? 'PRIORITY P1' : 'PRIORITY P2'}
                  </td>
                  <td>
                    <span style={{ color: '#059669', fontWeight: 600, fontSize: '0.75rem' }}>
                      VALIDATED & APPROVED
                    </span>
                  </td>
                  <td style={{ fontFamily: 'monospace', fontSize: '0.75rem', color: '#64748b' }}>
                    {evt.timestamp}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={6} className="empty-cell-row" style={{ textAlign: 'center', color: '#64748b', padding: '1.25rem' }}>
                  No active traffic events. CCTV computer-vision surveillance monitoring nominal network flow.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
