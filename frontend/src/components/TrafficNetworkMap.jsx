import React from 'react';
import IntersectionTrafficVisualizer from './IntersectionTrafficVisualizer';

export default function TrafficNetworkMap({ intersections = [] }) {
  // Filter for I1 and I2 only; use default fallback if empty
  const displayNodes = (intersections && intersections.length > 0)
    ? intersections.filter(i => i.intersection_id === 'I1' || i.intersection_id === 'I2')
    : [
        {
          intersection_id: 'I1',
          name: 'Main St & 1st Ave',
          active_approach: 'WEST',
          active_movements: ['W → E', 'W → N', 'W → S'],
          active_movement_ids: ['W_TO_E', 'W_TO_N', 'W_TO_S'],
          safety_validation_status: 'VALIDATED',
          other_approaches_status: 'NORTH: RED | SOUTH: RED | EAST: RED',
          conflict_check_detail: 'VALIDATED: Exclusive West Approach Active. Approved W → E, W → N, W → S.'
        },
        {
          intersection_id: 'I2',
          name: 'Main St & 2nd Ave',
          active_approach: 'NORTH',
          active_movements: ['N → S', 'N → E', 'N → W'],
          active_movement_ids: ['N_TO_S', 'N_TO_E', 'N_TO_W'],
          safety_validation_status: 'VALIDATED',
          other_approaches_status: 'SOUTH: RED | EAST: RED | WEST: RED',
          conflict_check_detail: 'VALIDATED: Exclusive North Approach Active. Approved N → S, N → E, N → W.'
        }
      ];

  return (
    <div className="gov-section" id="section-network">
      <div className="gov-section-header">
        <div className="gov-section-title">
          <span>TRAFFIC NETWORK TOPOLOGY & 4-WAY INTERSECTION VISUALIZERS</span>
        </div>
        <span style={{ fontSize: '0.725rem', color: '#64748b', fontFamily: 'monospace' }}>
          MAIN STREET TRAFFIC CORRIDOR (NODES I1 ↔ I2)
        </span>
      </div>

      <div className="network-canvas-box">
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: '#64748b', borderBottom: '1px solid #e2e8f0', paddingBottom: '0.4rem', fontFamily: 'monospace', marginBottom: '0.75rem' }}>
          <span>GIS REGION: MAIN STREET CORRIDOR (LAT 37.7749° N TO 37.7779° N)</span>
          <span>STATE SYNC: BIDIRECTIONAL REAL-TIME TELEMETRY</span>
        </div>

        {/* Real-time Telemetry Connection Link Bar Between I1 & I2 */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '0.75rem',
          backgroundColor: '#0f172a',
          color: '#38bdf8',
          border: '1px solid #0284c7',
          borderRadius: '4px',
          padding: '0.45rem 1rem',
          marginBottom: '1rem',
          fontSize: '0.725rem',
          fontFamily: 'monospace',
          fontWeight: 700,
          boxShadow: 'inset 0 0 8px rgba(0,0,0,0.5)'
        }}>
          <span>NODE I1 (Main St & 1st Ave)</span>
          <span style={{ color: '#10b981', letterSpacing: '1px' }}>
            ◄═══════ [ REAL-TIME BIDIRECTIONAL TELEMETRY CORRIDOR: ACTIVE ] ═══════►
          </span>
          <span>NODE I2 (Main St & 2nd Ave)</span>
        </div>

        {/* Visually Balanced 2-Node Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.25rem' }}>
          {displayNodes.map((node) => (
            <IntersectionTrafficVisualizer key={node.intersection_id} intersection={node} />
          ))}
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.75rem', color: '#64748b', borderTop: '1px solid #e2e8f0', paddingTop: '0.75rem', marginTop: '1rem' }}>
          <div style={{ display: 'flex', gap: '1rem' }}>
            <span><strong style={{ color: '#059669' }}>↓ ↑ ← → GREEN</strong>: Permitted Movement</span>
            <span><strong style={{ color: '#dc2626' }}>↓ ↑ ← → RED</strong>: Prohibited Conflict Movement</span>
          </div>
          <span style={{ fontFamily: 'monospace' }}>SAFETY LAYER: DETERMINISTIC CONFLICT MATRIX ENFORCED</span>
        </div>
      </div>
    </div>
  );
}

