import React, { useState, useEffect } from 'react';
import { BarChart3, TrendingUp, AlertTriangle, ArrowRight, Gauge, Activity, RefreshCw } from 'lucide-react';
import { getApiUrl } from '../config';

export default function TrafficAnalyticsPanel() {
  const [summary, setSummary] = useState(null);
  const [odMatrix, setOdMatrix] = useState(null);
  const [loading, setLoading] = useState(true);

  const loadData = () => {
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
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 4000);
    return () => clearInterval(interval);
  }, []);

  const modalSplit = summary?.modal_split || [];

  return (
    <div className="gov-section" id="section-analytics">
      <div className="gov-section-header">
        <div className="gov-section-title" style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
          <BarChart3 size={18} style={{ color: '#0284c7' }} />
          <span>URBAN TRAFFIC FLOW ANALYTICS & MACRO INTELLIGENCE</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
          <button
            onClick={loadData}
            className="gov-btn"
            style={{ fontSize: '0.725rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}
          >
            <RefreshCw size={12} />
            Refresh Analytics
          </button>
          <span style={{ fontSize: '0.725rem', color: '#64748b', fontFamily: 'monospace' }}>
            HYDERABAD IT CORRIDOR TRAFFIC FLOW TELEMETRY
          </span>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="overview-stats-row" style={{ marginBottom: '1.25rem' }}>
        <div className="stat-column">
          <div className="stat-label">Total Monitored Flow</div>
          <div className="stat-val">{summary?.total_vehicles_monitored || 0}</div>
          <div className="stat-sub">Across Monitored Corridor Nodes</div>
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
          <div className="stat-val" style={{ color: '#0284c7' }}>
            {summary?.peak_hour_flow_rate_vph || 0} <span style={{ fontSize: '0.85rem' }}>veh/hr</span>
          </div>
          <div className="stat-sub">Corridor Hourly Throughput</div>
        </div>

        <div className="stat-column">
          <div className="stat-label">Congestion Index</div>
          <div className="stat-val" style={{
            color: summary?.congestion_level === 'HIGH' ? '#dc2626' : (summary?.congestion_level === 'MODERATE' ? '#ea580c' : '#059669'),
            fontSize: '1.25rem'
          }}>
            {summary?.congestion_level || 'LOW'}
          </div>
          <div className="stat-sub">Level of Service (LOS)</div>
        </div>
      </div>

      {/* Analytics Main Columns */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1rem', marginBottom: '1rem' }}>
        {/* Modal Split Breakdown */}
        <div style={{
          backgroundColor: '#f8fafc',
          border: '1px solid #e2e8f0',
          borderRadius: '4px',
          padding: '1rem'
        }}>
          <div style={{ fontWeight: 800, fontSize: '0.85rem', color: '#0b2545', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <TrendingUp size={15} color="#0284c7" />
            <span>MODAL SPLIT CLASSIFICATION (YOLO VEHICLE DETECTION)</span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
            {modalSplit.map((item) => (
              <div key={item.class_label}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', marginBottom: '2px' }}>
                  <span style={{ fontWeight: 600, color: '#334155' }}>{item.display_name}</span>
                  <span style={{ fontFamily: 'monospace', color: '#64748b' }}>
                    <strong>{item.count}</strong> ({item.percentage}%)
                  </span>
                </div>
                <div style={{ height: '7px', backgroundColor: '#e2e8f0', borderRadius: '3px', overflow: 'hidden' }}>
                  <div style={{
                    height: '100%',
                    width: `${item.percentage}%`,
                    backgroundColor: item.class_label === 'CAR' ? '#0284c7' :
                                     item.class_label === 'MOTORCYCLE' ? '#059669' :
                                     item.class_label === 'AUTO_RICKSHAW' ? '#eab308' :
                                     item.class_label === 'BUS' ? '#9333ea' : '#ea580c'
                  }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Turning Movement Counts */}
        <div style={{
          backgroundColor: '#f8fafc',
          border: '1px solid #e2e8f0',
          borderRadius: '4px',
          padding: '1rem'
        }}>
          <div style={{ fontWeight: 800, fontSize: '0.85rem', color: '#0b2545', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <Activity size={15} color="#059669" />
            <span>TURNING MOVEMENT COUNTS (TMC BY CORRIDOR JUNCTION)</span>
          </div>

          <div className="gov-table-container" style={{ maxHeight: '180px', overflowY: 'auto' }}>
            <table className="gov-data-table" style={{ fontSize: '0.75rem' }}>
              <thead>
                <tr>
                  <th>JUNCTION</th>
                  <th>THROUGH</th>
                  <th>LEFT TURN</th>
                  <th>RIGHT TURN</th>
                </tr>
              </thead>
              <tbody>
                {summary?.turning_movement_counts && Object.entries(summary.turning_movement_counts).map(([node, counts]) => (
                  <tr key={node}>
                    <td style={{ fontWeight: 700, color: '#0b2545' }}>{node}</td>
                    <td style={{ fontFamily: 'monospace', color: '#059669' }}>{counts.STRAIGHT}</td>
                    <td style={{ fontFamily: 'monospace', color: '#0284c7' }}>{counts.LEFT_TURN}</td>
                    <td style={{ fontFamily: 'monospace', color: '#d97706' }}>{counts.RIGHT_TURN}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Origin-Destination (O-D) Matrix */}
      {odMatrix && (
        <div style={{
          backgroundColor: '#ffffff',
          border: '1px solid #e2e8f0',
          borderRadius: '4px',
          padding: '1rem',
          marginBottom: '1rem'
        }}>
          <div style={{ fontWeight: 800, fontSize: '0.85rem', color: '#0b2545', marginBottom: '0.75rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <Gauge size={15} color="#0284c7" />
              <span>ORIGIN-DESTINATION (O-D) TRAFFIC FLOW MATRIX (%)</span>
            </div>
            <span style={{ fontSize: '0.7rem', color: '#64748b', fontFamily: 'monospace' }}>
              Dominant: {odMatrix.dominant_corridor}
            </span>
          </div>

          <div className="gov-table-container">
            <table className="gov-data-table" style={{ fontSize: '0.75rem', textAlign: 'center' }}>
              <thead>
                <tr>
                  <th style={{ textAlign: 'left' }}>ORIGIN \ DESTINATION</th>
                  {odMatrix.nodes?.map((n, i) => <th key={i}>{n}</th>)}
                </tr>
              </thead>
              <tbody>
                {odMatrix.matrix?.map((row, i) => (
                  <tr key={i}>
                    <td style={{ textAlign: 'left', fontWeight: 700, color: '#0b2545' }}>
                      {odMatrix.nodes[i]}
                    </td>
                    {row.map((val, j) => (
                      <td key={j} style={{
                        fontFamily: 'monospace',
                        fontWeight: val > 30 ? 800 : 400,
                        backgroundColor: i === j ? '#f1f5f9' : (val > 35 ? 'rgba(2, 132, 199, 0.12)' : 'transparent'),
                        color: i === j ? '#94a3b8' : (val > 35 ? '#0284c7' : '#334155')
                      }}>
                        {i === j ? '—' : `${val}%`}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Bottleneck Warning Banner */}
      {summary?.bottlenecks?.length > 0 && (
        <div style={{
          backgroundColor: '#fffbeb',
          border: '1px solid #fde68a',
          borderRadius: '4px',
          padding: '0.75rem 1rem',
          display: 'flex',
          alignItems: 'center',
          gap: '0.75rem'
        }}>
          <AlertTriangle size={18} color="#d97706" style={{ flexShrink: 0 }} />
          <div style={{ fontSize: '0.775rem', color: '#92400e', lineHeight: '1.4' }}>
            <strong>IDENTIFIED CORRIDOR BOTTLENECK:</strong> {summary.bottlenecks[0].corridor} — Speed: {summary.bottlenecks[0].current_speed_kmh} km/h (-{summary.bottlenecks[0].speed_reduction_pct}%).
            <span style={{ display: 'block', color: '#78350f', marginTop: '2px' }}>
              <strong>Recommended Action:</strong> {summary.bottlenecks[0].recommended_action}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
