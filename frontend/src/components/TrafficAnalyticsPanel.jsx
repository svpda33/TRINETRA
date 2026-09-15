import React, { useState, useEffect } from 'react';
import { BarChart3, TrendingUp, AlertTriangle, ArrowRight, Gauge, Activity } from 'lucide-react';
import { getApiUrl } from '../config';

export default function TrafficAnalyticsPanel() {
  const [summary, setSummary] = useState(null);
  const [odMatrix, setOdMatrix] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch(getApiUrl('/api/analytics/summary')).then(res => res.json()),
      fetch(getApiUrl('/api/analytics/od-matrix')).then(res => res.json())
    ])
      .then(([sumRes, odRes]) => {
        if (sumRes.data) setSummary(sumRes.data);
        if (odRes.data) setOdMatrix(odRes.data);
      })
      .catch(err => console.warn('Failed to load traffic analytics:', err))
      .finally(() => setLoading(false));
  }, []);

  const modalSplit = summary?.modal_split || [
    { class_label: 'CAR', display_name: 'Passenger Cars', count: 48, percentage: 33.8 },
    { class_label: 'MOTORCYCLE', display_name: 'Motorcycles / 2W', count: 52, percentage: 36.6 },
    { class_label: 'AUTO_RICKSHAW', display_name: 'Auto-Rickshaws (3W)', count: 28, percentage: 19.7 },
    { class_label: 'BUS', display_name: 'Public Transit Buses', count: 8, percentage: 5.6 },
    { class_label: 'TRUCK', display_name: 'Commercial Trucks', count: 6, percentage: 4.2 }
  ];

  return (
    <div className="gov-section" id="section-analytics">
      <div className="gov-section-header">
        <div className="gov-section-title" style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
          <BarChart3 size={18} style={{ color: '#0284c7' }} />
          <span>URBAN TRAFFIC FLOW ANALYTICS & MACRO INTELLIGENCE</span>
        </div>
        <span style={{ fontSize: '0.725rem', color: '#64748b', fontFamily: 'monospace' }}>
          HYDERABAD IT CORRIDOR TRAFFIC FLOW TELEMETRY
        </span>
      </div>

      {/* KPI Cards */}
      <div className="overview-stats-row" style={{ marginBottom: '1.25rem' }}>
        <div className="stat-column">
          <div className="stat-label">Total Monitored Flow</div>
          <div className="stat-val">{summary?.total_vehicles_monitored || 142}</div>
          <div className="stat-sub">Across 8 Camera Feeds</div>
        </div>

        <div className="stat-column">
          <div className="stat-label">Corridor Average Speed</div>
          <div className="stat-val" style={{ color: '#059669' }}>
            {summary?.average_corridor_speed_kmh || 38.4} <span style={{ fontSize: '0.85rem' }}>km/h</span>
          </div>
          <div className="stat-sub">Design Speed: 50 km/h</div>
        </div>

        <div className="stat-column">
          <div className="stat-label">Peak Flow Rate</div>
          <div className="stat-val" style={{ color: '#2563eb' }}>
            {summary?.peak_hour_flow_rate_vph || 1704} <span style={{ fontSize: '0.85rem' }}>vph</span>
          </div>
          <div className="stat-sub">Volume-Capacity: 68%</div>
        </div>

        <div className="stat-column">
          <div className="stat-label">Corridor Congestion</div>
          <div className="stat-val" style={{ color: '#059669', fontSize: '1.25rem' }}>
            {summary?.congestion_level || 'MODERATE'}
          </div>
          <div className="stat-sub">LOS Grade: B (Nominal)</div>
        </div>
      </div>

      {/* Modal Split & Turning Movement Counts Row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.25rem', marginBottom: '1.25rem' }}>
        {/* Modal Split Card */}
        <div style={{ backgroundColor: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '4px', padding: '1rem' }}>
          <div style={{ fontSize: '0.8rem', fontWeight: 800, color: '#0b2545', textTransform: 'uppercase', marginBottom: '0.75rem' }}>
            Vehicle Modal Classification Split
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
            {modalSplit.map((m) => (
              <div key={m.class_label}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', marginBottom: '0.2rem' }}>
                  <span style={{ fontWeight: 600, color: '#334155' }}>{m.display_name}</span>
                  <span style={{ fontFamily: 'monospace', fontWeight: 700, color: '#0b2545' }}>
                    {m.count} veh ({m.percentage}%)
                  </span>
                </div>
                <div style={{ height: '7px', backgroundColor: '#e2e8f0', borderRadius: '4px', overflow: 'hidden' }}>
                  <div style={{
                    width: `${m.percentage}%`,
                    height: '100%',
                    backgroundColor: m.class_label === 'MOTORCYCLE' ? '#38bdf8' : m.class_label === 'CAR' ? '#0284c7' : m.class_label === 'AUTO_RICKSHAW' ? '#f59e0b' : '#10b981'
                  }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Turning Movement Counts (TMC) */}
        <div style={{ backgroundColor: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '4px', padding: '1rem' }}>
          <div style={{ fontSize: '0.8rem', fontWeight: 800, color: '#0b2545', textTransform: 'uppercase', marginBottom: '0.75rem' }}>
            Junction Turning Movement Counts (TMC)
          </div>
          <div className="gov-table-container">
            <table className="gov-data-table" style={{ fontSize: '0.75rem' }}>
              <thead>
                <tr>
                  <th>Junction</th>
                  <th>Straight (↑)</th>
                  <th>Left Turn (←)</th>
                  <th>Right Turn (→)</th>
                  <th>Total Split</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td><strong>I1 (Cyber Towers)</strong></td>
                  <td style={{ fontFamily: 'monospace', fontWeight: 700 }}>124 veh</td>
                  <td style={{ fontFamily: 'monospace', color: '#059669' }}>45 veh</td>
                  <td style={{ fontFamily: 'monospace', color: '#d97706' }}>32 veh</td>
                  <td style={{ fontFamily: 'monospace', fontWeight: 700 }}>201 veh</td>
                </tr>
                <tr>
                  <td><strong>I2 (Mindspace)</strong></td>
                  <td style={{ fontFamily: 'monospace', fontWeight: 700 }}>98 veh</td>
                  <td style={{ fontFamily: 'monospace', color: '#059669' }}>38 veh</td>
                  <td style={{ fontFamily: 'monospace', color: '#d97706' }}>26 veh</td>
                  <td style={{ fontFamily: 'monospace', fontWeight: 700 }}>162 veh</td>
                </tr>
                <tr>
                  <td><strong>I3 (Bio-Diversity)</strong></td>
                  <td style={{ fontFamily: 'monospace', fontWeight: 700 }}>85 veh</td>
                  <td style={{ fontFamily: 'monospace', color: '#059669' }}>29 veh</td>
                  <td style={{ fontFamily: 'monospace', color: '#d97706' }}>22 veh</td>
                  <td style={{ fontFamily: 'monospace', fontWeight: 700 }}>136 veh</td>
                </tr>
                <tr>
                  <td><strong>I4 (Gachibowli)</strong></td>
                  <td style={{ fontFamily: 'monospace', fontWeight: 700 }}>110 veh</td>
                  <td style={{ fontFamily: 'monospace', color: '#059669' }}>41 veh</td>
                  <td style={{ fontFamily: 'monospace', color: '#d97706' }}>35 veh</td>
                  <td style={{ fontFamily: 'monospace', fontWeight: 700 }}>186 veh</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Origin-Destination (O-D) Matrix Table */}
      <div style={{ backgroundColor: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '4px', padding: '1rem', marginBottom: '1.25rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
          <span style={{ fontSize: '0.8rem', fontWeight: 800, color: '#0b2545', textTransform: 'uppercase' }}>
            Origin-Destination (O-D) Flow Distribution Matrix
          </span>
          <span style={{ fontSize: '0.7rem', color: '#64748b', fontFamily: 'monospace' }}>
            DOMINANT CORRIDOR: I1 (CYBER TOWERS) → I2 (MINDSPACE) [48% FLOW]
          </span>
        </div>

        <div className="gov-table-container">
          <table className="gov-data-table" style={{ fontSize: '0.75rem', textAlign: 'center' }}>
            <thead>
              <tr>
                <th style={{ textAlign: 'left' }}>Origin \ Destination</th>
                <th>To I1 (Cyber Towers)</th>
                <th>To I2 (Mindspace)</th>
                <th>To I3 (Bio-Diversity)</th>
                <th>To I4 (Gachibowli)</th>
              </tr>
            </thead>
            <tbody>
              {odMatrix?.nodes?.map((nodeName, rIdx) => (
                <tr key={nodeName}>
                  <td style={{ textAlign: 'left', fontWeight: 700, color: '#0b2545' }}>{nodeName}</td>
                  {odMatrix.matrix[rIdx].map((pct, cIdx) => (
                    <td
                      key={cIdx}
                      style={{
                        fontFamily: 'monospace',
                        fontWeight: pct > 40 ? 900 : 600,
                        backgroundColor: pct > 40 ? '#ecfdf5' : pct === 0 ? '#f8fafc' : 'transparent',
                        color: pct > 40 ? '#059669' : pct === 0 ? '#94a3b8' : '#1e293b'
                      }}
                    >
                      {pct === 0 ? '—' : `${pct}%`}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Bottleneck Warning Banner */}
      {summary?.bottlenecks?.map((b, idx) => (
        <div key={idx} style={{
          backgroundColor: '#fffbeb',
          border: '1px solid #fde68a',
          borderRadius: '4px',
          padding: '0.75rem 1rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          fontSize: '0.775rem'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <AlertTriangle size={18} style={{ color: '#d97706', flexShrink: 0 }} />
            <div>
              <strong style={{ color: '#92400e' }}>Active Corridor Bottleneck: {b.corridor}</strong>
              <div style={{ color: '#78350f', marginTop: '2px' }}>
                Current Speed: <strong>{b.current_speed_kmh} km/h</strong> (Speed dropped by {b.speed_reduction_pct}%)
              </div>
            </div>
          </div>
          <span style={{ fontFamily: 'monospace', fontWeight: 700, color: '#0284c7', backgroundColor: '#ffffff', padding: '0.3rem 0.6rem', borderRadius: '3px', border: '1px solid #bfdbfe' }}>
            {b.recommended_action}
          </span>
        </div>
      ))}
    </div>
  );
}
