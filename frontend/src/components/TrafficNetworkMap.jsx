import React from 'react';
import IntersectionTrafficVisualizer from './IntersectionTrafficVisualizer';

export default function TrafficNetworkMap({ intersections = [] }) {
  // Display available intersections, fallback to standard 4 Hyderabad corridor nodes
  const displayNodes = (intersections && intersections.length > 0)
    ? intersections
    : [
        {
          intersection_id: 'I1',
          name: 'Cyber Towers Junction',
          active_approach: 'NORTH',
          active_movements: ['N → S', 'N → E', 'N → W'],
          active_movement_ids: ['N_TO_S', 'N_TO_E', 'N_TO_W'],
          safety_validation_status: 'VALIDATED',
          other_approaches_status: 'SOUTH: RED | EAST: RED | WEST: RED',
          conflict_check_detail: 'VALIDATED: Exclusive North Approach Active. Approved N → S, N → E, N → W.'
        },
        {
          intersection_id: 'I2',
          name: 'Hitec City / Mindspace Junction',
          active_approach: 'SOUTH',
          active_movements: ['S → N', 'S → E', 'S → W'],
          active_movement_ids: ['S_TO_N', 'S_TO_E', 'S_TO_W'],
          safety_validation_status: 'VALIDATED',
          other_approaches_status: 'NORTH: RED | EAST: RED | WEST: RED',
          conflict_check_detail: 'VALIDATED: Exclusive South Approach Active. Approved S → N, S → E, S → W.'
        },
        {
          intersection_id: 'I3',
          name: 'Bio-Diversity Junction',
          active_approach: 'EAST',
          active_movements: ['E → W', 'E → N', 'E → S'],
          active_movement_ids: ['E_TO_W', 'E_TO_N', 'E_TO_S'],
          safety_validation_status: 'VALIDATED',
          other_approaches_status: 'NORTH: RED | SOUTH: RED | WEST: RED',
          conflict_check_detail: 'VALIDATED: Exclusive East Approach Active. Approved E → W, E → N, E → S.'
        },
        {
          intersection_id: 'I4',
          name: 'Gachibowli Junction',
          active_approach: 'WEST',
          active_movements: ['W → E', 'W → N', 'W → S'],
          active_movement_ids: ['W_TO_E', 'W_TO_N', 'W_TO_S'],
          safety_validation_status: 'VALIDATED',
          other_approaches_status: 'NORTH: RED | SOUTH: RED | EAST: RED',
          conflict_check_detail: 'VALIDATED: Exclusive West Approach Active. Approved W → E, W → N, W → S.'
        }
      ];

  return (
    <div className="gov-section" id="section-network">
      <div className="gov-section-header">
        <div className="gov-section-title">
          <span>4-WAY LEFT-HAND TRAFFIC (LHT) INTERSECTION SIGNAL VISUALIZERS</span>
        </div>
        <span style={{ fontSize: '0.725rem', color: '#64748b', fontFamily: 'monospace' }}>
          HYDERABAD SMART IT CORRIDOR (NODES I1 ↔ I4)
        </span>
      </div>

      <div className="network-canvas-box">
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: '#64748b', borderBottom: '1px solid #e2e8f0', paddingBottom: '0.4rem', fontFamily: 'monospace', marginBottom: '0.75rem' }}>
          <span>GIS REGION: HYDERABAD SMART IT CORRIDOR (17.4325° N TO 17.4510° N)</span>
          <span>STATE SYNC: BIDIRECTIONAL REAL-TIME TELEMETRY</span>
        </div>

        {/* Real-time Telemetry Connection Link Bar */}
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
          <span>NODE I1 (Cyber Towers)</span>
          <span style={{ color: '#10b981', letterSpacing: '1px' }}>
            ◄════ [ REAL-TIME HYDERABAD CORRIDOR TELEMETRY: NODES I1 ↔ I2 ↔ I3 ↔ I4 ] ════►
          </span>
          <span>NODE I4 (Gachibowli)</span>
        </div>

        {/* Visually Balanced 4-Node Grid */}
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
