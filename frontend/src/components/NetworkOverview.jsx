import React from 'react';

export default function NetworkOverview({ activeIntersectionsCount = 2, activeEvents = [], activeCorridors = [] }) {
  const activeEventCount = activeEvents.length;
  const emergencyCorridorCount = activeCorridors.length;

  return (
    <div className="gov-section" id="section-overview">
      <div className="gov-section-header">
        <div className="gov-section-title">
          <span>SYSTEM OVERVIEW</span>
        </div>
        <span style={{ fontSize: '0.725rem', color: '#64748b', fontFamily: 'monospace' }}>
          REF: MAIN STREET CORRIDOR
        </span>
      </div>

      <div className="overview-stats-row">
        {/* Stat 1 */}
        <div className="stat-column">
          <div className="stat-label">Active Intersections</div>
          <div className="stat-val">{String(activeIntersectionsCount || 2).padStart(2, '0')}</div>
          <div className="stat-sub">Nodes: I1, I2</div>
        </div>

        {/* Stat 2 */}
        <div className="stat-column">
          <div className="stat-label">Active Events</div>
          <div className="stat-val" style={{ color: activeEventCount > 0 ? '#dc2626' : '#0b2545' }}>
            {String(activeEventCount).padStart(2, '0')}
          </div>
          <div className="stat-sub">
            {activeEventCount > 0 ? `${activeEventCount} priority override active` : 'No active incidents'}
          </div>
        </div>

        {/* Stat 3 */}
        <div className="stat-column">
          <div className="stat-label">Emergency Corridors</div>
          <div className="stat-val" style={{ color: emergencyCorridorCount > 0 ? '#059669' : '#0b2545' }}>
            {String(emergencyCorridorCount).padStart(2, '0')}
          </div>
          <div className="stat-sub">
            {emergencyCorridorCount > 0 ? 'Preemption corridor active' : 'Preemption status: Standby'}
          </div>
        </div>

        {/* Stat 4 */}
        <div className="stat-column">
          <div className="stat-label">Network Status</div>
          <div className="stat-val" style={{ color: '#059669', fontSize: '1.25rem' }}>
            {emergencyCorridorCount > 0 ? 'PREEMPTED' : 'OPERATIONAL'}
          </div>
          <div className="stat-sub">Deterministic Safety Layer Active</div>
        </div>
      </div>
    </div>
  );
}

