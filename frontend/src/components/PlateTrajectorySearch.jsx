import React, { useState, useEffect } from 'react';
import { Search, Navigation, AlertTriangle, ShieldCheck, Clock, MapPin, CheckCircle2 } from 'lucide-react';
import { getApiUrl } from '../config';

export default function PlateTrajectorySearch({ onTrajectoryLoaded, currentTrajectory }) {
  const [searchQuery, setSearchQuery] = useState('TS09EA1234');
  const [trajectoryData, setTrajectoryData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);

  const handleSearch = (plateToSearch = null) => {
    const plate = (plateToSearch || searchQuery || '').trim().replace(/\s+/g, '').toUpperCase();
    if (!plate) return;

    setLoading(true);
    setErrorMsg(null);

    fetch(getApiUrl(`/api/trajectories/${plate}`))
      .then(res => res.json())
      .then(resData => {
        if (resData.status === 'success' && resData.data) {
          setTrajectoryData(resData.data);
          if (onTrajectoryLoaded) {
            onTrajectoryLoaded(resData.data);
          }
        } else {
          setErrorMsg(`No sightings found for plate "${plate}".`);
        }
      })
      .catch(err => {
        setErrorMsg(`Failed to query trajectory: ${err.message}`);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    // Initial load with default sample plate
    handleSearch('TS09EA1234');
  }, []);

  const demoPlates = [
    { plate: 'TS09EA1234', label: 'Stolen Vehicle (FIR #402)', severity: 'CRITICAL', color: '#dc2626' },
    { plate: 'AP28BK5678', label: 'Wanted Suspect (Lookout)', severity: 'HIGH', color: '#ea580c' },
    { plate: 'DL1CAB9999', label: 'E-Challan Violator', severity: 'MEDIUM', color: '#0284c7' }
  ];

  return (
    <div className="gov-section" id="section-search">
      <div className="gov-section-header">
        <div className="gov-section-title" style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
          <Search size={18} style={{ color: '#0284c7' }} />
          <span>SINGLE PLATE TRAJECTORY RECONSTRUCTION ENGINE</span>
        </div>
        <span style={{ fontSize: '0.725rem', color: '#64748b', fontFamily: 'monospace' }}>
          SPATIAL-TEMPORAL MULTI-CAMERA CORRELATION
        </span>
      </div>

      {/* Search Input Row & Demo Quick Chips */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1.25rem' }}>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value.toUpperCase())}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            placeholder="ENTER VEHICLE REGISTRATION (e.g. TS09EA1234)"
            style={{
              flex: 1,
              backgroundColor: '#ffffff',
              border: '2px solid #0b2545',
              borderRadius: '4px',
              padding: '0.55rem 0.85rem',
              fontFamily: 'monospace',
              fontSize: '0.95rem',
              fontWeight: 700,
              color: '#0b2545',
              letterSpacing: '1px'
            }}
          />
          <button
            onClick={() => handleSearch()}
            disabled={loading}
            className="gov-btn"
            style={{
              backgroundColor: '#0284c7',
              borderColor: '#0369a1',
              padding: '0 1.25rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
              fontSize: '0.85rem'
            }}
          >
            <Search size={15} />
            {loading ? 'RECONSTRUCTING...' : 'TRACK TRAJECTORY'}
          </button>
        </div>

        {/* Preset Quick Chips */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '0.725rem', color: '#64748b', fontFamily: 'monospace' }}>
            DEMO WATCHLIST PROFILES:
          </span>
          {demoPlates.map((item) => (
            <button
              key={item.plate}
              onClick={() => {
                setSearchQuery(item.plate);
                handleSearch(item.plate);
              }}
              style={{
                backgroundColor: searchQuery === item.plate ? '#0f172a' : '#f8fafc',
                border: `1px solid ${searchQuery === item.plate ? item.color : '#cbd5e1'}`,
                color: searchQuery === item.plate ? '#ffffff' : '#334155',
                padding: '0.2rem 0.6rem',
                borderRadius: '3px',
                fontSize: '0.725rem',
                fontFamily: 'monospace',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.35rem'
              }}
            >
              <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: item.color }} />
              <span>{item.plate}</span>
              <span style={{ opacity: 0.75, fontSize: '0.65rem' }}>({item.label})</span>
            </button>
          ))}
        </div>
      </div>

      {errorMsg && (
        <div style={{
          backgroundColor: '#fef2f2',
          border: '1px solid #fecaca',
          color: '#dc2626',
          padding: '0.75rem',
          borderRadius: '4px',
          fontSize: '0.825rem',
          fontFamily: 'monospace',
          marginBottom: '1rem'
        }}>
          {errorMsg}
        </div>
      )}

      {/* Trajectory Details Header Card */}
      {trajectoryData && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
            gap: '0.65rem',
            backgroundColor: '#0f172a',
            border: '1px solid #334155',
            borderRadius: '5px',
            padding: '1rem',
            color: '#ffffff',
            fontFamily: 'monospace'
          }}>
            <div>
              <div style={{ fontSize: '0.65rem', color: '#94a3b8' }}>VEHICLE PLATE</div>
              <div style={{ fontSize: '1.15rem', fontWeight: 900, color: '#38bdf8' }}>
                {trajectoryData.formatted_plate || trajectoryData.plate_number}
              </div>
              <div style={{ fontSize: '0.7rem', color: '#10b981' }}>
                Class: {trajectoryData.vehicle_class}
              </div>
            </div>

            <div>
              <div style={{ fontSize: '0.65rem', color: '#94a3b8' }}>TOTAL SIGHTINGS</div>
              <div style={{ fontSize: '1.15rem', fontWeight: 800, color: '#10b981' }}>
                {trajectoryData.total_sightings} Camera Nodes
              </div>
              <div style={{ fontSize: '0.7rem', color: '#cbd5e1' }}>
                First: {trajectoryData.first_seen}
              </div>
            </div>

            <div>
              <div style={{ fontSize: '0.65rem', color: '#94a3b8' }}>CURRENT / LAST SEEN</div>
              <div style={{ fontSize: '0.9rem', fontWeight: 800, color: '#f59e0b' }}>
                {trajectoryData.last_seen_camera}
              </div>
              <div style={{ fontSize: '0.7rem', color: '#cbd5e1' }}>
                Time: {trajectoryData.last_seen}
              </div>
            </div>

            <div>
              <div style={{ fontSize: '0.65rem', color: '#94a3b8' }}>CORRIDOR KINEMATICS</div>
              <div style={{ fontSize: '1.15rem', fontWeight: 800, color: '#a78bfa' }}>
                {trajectoryData.average_speed_kmh} km/h
              </div>
              <div style={{ fontSize: '0.7rem', color: '#cbd5e1' }}>
                Distance: {(trajectoryData.total_distance_meters / 1000.0).toFixed(2)} km
              </div>
            </div>
          </div>

          {/* Chronological Hop-by-Hop Sequence Table */}
          <div className="gov-table-container">
            <table className="gov-data-table">
              <thead>
                <tr>
                  <th>Hop #</th>
                  <th>Camera Node & Junction</th>
                  <th>Timestamp</th>
                  <th>Observed Speed</th>
                  <th>Heading</th>
                  <th>Hop Travel Time</th>
                  <th>Segment Distance</th>
                  <th>Calculated Speed</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {trajectoryData.hops?.map((h) => (
                  <tr key={h.sequence_index}>
                    <td style={{ fontFamily: 'monospace', fontWeight: 800, color: '#0284c7' }}>
                      #{h.sequence_index}
                    </td>
                    <td>
                      <strong style={{ color: '#0b2545' }}>{h.intersection_name}</strong>
                      <div style={{ fontSize: '0.7rem', color: '#64748b', fontFamily: 'monospace' }}>
                        {h.camera_id} ({h.latitude.toFixed(4)}°N, {h.longitude.toFixed(4)}°E)
                      </div>
                    </td>
                    <td style={{ fontFamily: 'monospace', fontSize: '0.75rem', fontWeight: 600 }}>
                      {h.timestamp}
                    </td>
                    <td style={{ fontFamily: 'monospace', fontWeight: 700, color: '#059669' }}>
                      {h.speed_kmh} km/h
                    </td>
                    <td style={{ fontFamily: 'monospace', fontSize: '0.725rem' }}>
                      {h.heading}
                    </td>
                    <td style={{ fontFamily: 'monospace', fontSize: '0.75rem' }}>
                      {h.travel_time_seconds > 0 ? `${h.travel_time_seconds}s` : 'ORIGIN (0s)'}
                    </td>
                    <td style={{ fontFamily: 'monospace', fontSize: '0.75rem' }}>
                      {h.segment_distance_meters > 0 ? `${h.segment_distance_meters}m` : '—'}
                    </td>
                    <td style={{ fontFamily: 'monospace', fontWeight: 700, color: '#2563eb' }}>
                      {h.corridor_speed_kmh ? `${h.corridor_speed_kmh} km/h` : `${h.speed_kmh} km/h`}
                    </td>
                    <td>
                      <span style={{
                        fontSize: '0.7rem',
                        fontWeight: 700,
                        padding: '0.15rem 0.4rem',
                        borderRadius: '2px',
                        backgroundColor: '#ecfdf5',
                        color: '#059669',
                        border: '1px solid #a7f3d0'
                      }}>
                        VERIFIED SIGHTING
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
