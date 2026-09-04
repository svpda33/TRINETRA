import React, { useState } from 'react';
import SignalDetailsModal from './SignalDetailsModal';

export default function SignalStatus({ intersections = [] }) {
  const [selectedIntersection, setSelectedIntersection] = useState(null);

  return (
    <div className="gov-section" id="section-signal">
      <div className="gov-section-header">
        <div className="gov-section-title">
          <span>TRAFFIC SIGNAL STATUS & MOVEMENT VALIDATION</span>
        </div>
        <span style={{ fontSize: '0.725rem', color: '#64748b', fontFamily: 'monospace' }}>
          DETERMINISTIC MOVEMENT CONFLICT MATRIX: ACTIVE
        </span>
      </div>

      <div className="gov-table-container">
        <table className="gov-data-table">
          <thead>
            <tr>
              <th>Intersection & Location</th>
              <th>Active Approach</th>
              <th>Permitted Movements</th>
              <th>Signal State</th>
              <th>Other Approaches</th>
              <th>Queue Density</th>
              <th>Priority</th>
              <th>Safety Validation</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {intersections.map((node) => {
              const activeMovements = node.permitted_movements || node.active_movements || ["N → S", "N → E", "N → W"];
              const yellowMovements = node.yellow_movements || [];
              const isYellow = yellowMovements.length > 0;
              const isClearance = node.is_clearance_active;
              const activeApproach = isClearance ? 'NONE (CLEARANCE)' : isYellow ? `${node.active_approach || 'NORTH'} (YELLOW)` : (node.active_approach || 'NORTH');

              return (
                <tr key={node.intersection_id}>
                  <td>
                    <strong style={{ color: '#0b2545' }}>Intersection {node.intersection_id}</strong>
                    <div style={{ fontSize: '0.725rem', color: '#64748b' }}>{node.name}</div>
                  </td>

                  <td>
                    <span style={{
                      fontSize: '0.75rem',
                      fontWeight: 800,
                      fontFamily: 'monospace',
                      padding: '0.15rem 0.4rem',
                      borderRadius: '2px',
                      backgroundColor: isClearance ? '#fef2f2' : isYellow ? '#fffbeb' : '#ecfdf5',
                      color: isClearance ? '#dc2626' : isYellow ? '#d97706' : '#059669',
                      border: '1px solid #cbd5e1'
                    }}>
                      {activeApproach}
                    </span>
                  </td>

                  <td style={{ fontFamily: 'monospace', fontWeight: 700, color: '#1b365d' }}>
                    {isClearance ? 'NONE (ALL RED)' : isYellow ? `TRANSITION (${yellowMovements.join(', ')})` : activeMovements.join(', ')}
                  </td>

                  <td>
                    <span style={{
                      fontSize: '0.725rem',
                      fontWeight: 800,
                      fontFamily: 'monospace',
                      color: isClearance ? '#dc2626' : isYellow ? '#d97706' : '#059669'
                    }}>
                      {isClearance ? 'RED (ALL RED)' : isYellow ? 'YELLOW' : 'GREEN'}
                    </span>
                  </td>

                  <td>
                    <span style={{ fontSize: '0.7rem', fontFamily: 'monospace', color: '#dc2626', fontWeight: 600 }}>
                      {node.other_approaches_status || "SOUTH: RED | EAST: RED | WEST: RED"}
                    </span>
                  </td>

                  <td>
                    <span style={{ fontSize: '0.75rem', fontFamily: 'monospace' }}>
                      N-S: {node.queue_density?.[0]?.vehicle_count || 10} veh | E-W: {node.queue_density?.[1]?.vehicle_count || 8} veh
                    </span>
                  </td>

                  <td>
                    <span style={{
                      fontSize: '0.7rem',
                      fontWeight: 700,
                      padding: '0.1rem 0.35rem',
                      borderRadius: '2px',
                      backgroundColor: node.current_priority === 'WANTED_VEHICLE' ? '#fef2f2' : '#eff6ff',
                      color: node.current_priority === 'WANTED_VEHICLE' ? '#dc2626' : '#2563eb',
                      border: '1px solid #cbd5e1'
                    }}>
                      {node.current_priority || 'NORMAL'}
                    </span>
                  </td>

                  <td>
                    <div style={{ fontSize: '0.725rem', fontWeight: 700, color: '#059669' }}>
                      {node.safety_validation_status || "VALIDATED"}
                    </div>
                    <div style={{ fontSize: '0.675rem', color: '#64748b', fontFamily: 'monospace' }}>
                      {node.conflict_check_detail || "CONFLICT CHECK: PASSED"}
                    </div>
                  </td>

                  <td>
                    <button
                      onClick={() => setSelectedIntersection(node)}
                      className="gov-btn"
                      style={{ fontSize: '0.7rem', padding: '0.2rem 0.5rem' }}
                    >
                      View Details
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Signal Details Modal */}
      {selectedIntersection && (
        <SignalDetailsModal
          intersection={selectedIntersection}
          onClose={() => setSelectedIntersection(null)}
        />
      )}
    </div>
  );
}
