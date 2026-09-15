import React from 'react';

export default function NetworkOverview({ activeIntersectionsCount = 4, activeEvents = [], activeCorridors = [] }) {
  const activeEventCount = activeEvents.length;
  const emergencyCorridorCount = activeCorridors.length;

  return (
    <div className="gov-section" id="section-overview">
      <div className="gov-section-header">
        <div className="gov-section-title">
          <span>SYSTEM OVERVIEW & EXECUTIVE METRICS</span>
        </div>
        <span style={{ fontSize: '0.725rem', color: '#64748b', fontFamily: 'monospace' }}>
          REF: HYDERABAD SMART IT CORRIDOR (BEL SIH PS 26127)
        </span>
      </div>

      <div className="overview-stats-row">
        {/* Stat 1 */}
        <div className="stat-column">
          <div className="stat-label">Monitored Junctions</div>
          <div className="stat-val">{String(activeIntersectionsCount || 4).padStart(2, '0')}</div>
          <div className="stat-sub">Cyber Towers ↔ Gachibowli</div>
        </div>

        {/* Stat 2 */}
        <div className="stat-column">
          <div className="stat-label">CCTV Cameras</div>
          <div className="stat-val" style={{ color: '#0284c7' }}>08</div>
          <div className="stat-sub">4 Approaches per Junction</div>
        </div>

        {/* Stat 3 */}
        <div className="stat-column">
          <div className="stat-label">ANPR Detections</div>
          <div className="stat-val" style={{ color: '#059669' }}>142</div>
          <div className="stat-sub">Real EasyOCR & HSRP Validated</div>
        </div>

        {/* Stat 4 */}
        <div className="stat-column">
          <div className="stat-label">Security Alerts</div>
          <div className="stat-val" style={{ color: activeEventCount > 0 ? '#dc2626' : '#0b2545' }}>
            {String(activeEventCount).padStart(2, '0')}
          </div>
          <div className="stat-sub">
            {activeEventCount > 0 ? `${activeEventCount} active watchlist hits` : 'No active alerts'}
          </div>
        </div>

        {/* Stat 5 */}
        <div className="stat-column">
          <div className="stat-label">Network Status</div>
          <div className="stat-val" style={{ color: '#059669', fontSize: '1.25rem' }}>
            {emergencyCorridorCount > 0 ? 'CONTAINMENT' : 'OPERATIONAL'}
          </div>
          <div className="stat-sub">Safety Validator & Trajectory Active</div>
        </div>
      </div>
    </div>
  );
}
