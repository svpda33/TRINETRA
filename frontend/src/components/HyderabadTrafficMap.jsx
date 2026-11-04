import React, { useState, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, Tooltip, useMap } from 'react-leaflet';
import L from 'leaflet';
import {
  Navigation, Video, AlertTriangle, ShieldCheck, Compass, Eye,
  RefreshCw, Maximize2, Layers, CheckCircle2, Clock, Car, Flame, Info
} from 'lucide-react';
import { getApiUrl } from '../config';

// Ensure standard Leaflet marker icons are correctly bound
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

// Custom SVG Marker Generators
const createIntersectionMarkerIcon = (id, phase, congestion, isEmergency) => {
  let borderColor = '#38bdf8';
  let bgColor = '#0b2545';
  let glowColor = 'rgba(56, 189, 248, 0.4)';

  if (isEmergency) {
    borderColor = '#f87171';
    bgColor = '#991b1b';
    glowColor = '#ef4444';
  } else if (phase === 'GREEN') {
    borderColor = '#34d399';
    glowColor = 'rgba(16, 185, 129, 0.6)';
  } else if (phase === 'YELLOW') {
    borderColor = '#fbbf24';
    glowColor = 'rgba(245, 158, 11, 0.6)';
  } else if (phase === 'ALL_RED') {
    borderColor = '#f87171';
    glowColor = 'rgba(239, 68, 68, 0.6)';
  }

  const congestionBadgeColor =
    congestion === 'CRITICAL' ? '#ef4444' :
    congestion === 'HEAVY' ? '#f59e0b' :
    congestion === 'MODERATE' ? '#3b82f6' : '#10b981';

  return L.divIcon({
    className: 'custom-intersection-marker',
    html: `
      <div style="position: relative; width: 38px; height: 38px;">
        <div style="
          background: ${bgColor};
          border: 3px solid ${borderColor};
          color: #ffffff;
          font-family: 'Segoe UI', monospace;
          font-weight: 900;
          font-size: 13px;
          width: 38px;
          height: 38px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 0 14px ${glowColor};
          transition: all 0.3s ease;
        ">
          ${id}
        </div>
        <div style="
          position: absolute;
          top: -3px;
          right: -3px;
          width: 12px;
          height: 12px;
          border-radius: 50%;
          background: ${congestionBadgeColor};
          border: 2px solid #ffffff;
        "></div>
      </div>
    `,
    iconSize: [38, 38],
    iconAnchor: [19, 19],
    popupAnchor: [0, -22],
  });
};

const createCameraMarkerIcon = (direction, isApproachActive) => {
  const color = isApproachActive ? '#10b981' : '#64748b';
  const border = isApproachActive ? '#34d399' : '#cbd5e1';
  return L.divIcon({
    className: 'custom-camera-marker',
    html: `
      <div style="
        background: #0f172a;
        border: 2px solid ${border};
        color: ${color};
        font-family: monospace;
        font-weight: 700;
        font-size: 9px;
        width: 22px;
        height: 22px;
        border-radius: 4px;
        display: flex;
        align-items: center;
        justify-content: center;
        box-shadow: 0 2px 6px rgba(0,0,0,0.4);
      ">
        ${direction[0]}
      </div>
    `,
    iconSize: [22, 22],
    iconAnchor: [11, 11],
    popupAnchor: [0, -14],
  });
};

// Map Recenter & Fit-Bounds Controller Component
function MapFitBoundsHandler({ triggerFit, bounds }) {
  const map = useMap();
  useEffect(() => {
    if (triggerFit && bounds && bounds.length > 0) {
      map.fitBounds(L.latLngBounds(bounds), { padding: [50, 50] });
    }
  }, [triggerFit, bounds, map]);
  return null;
}

export default function HyderabadTrafficMap({ activeTrajectory = null, onSelectPlate = null }) {
  const [telemetry, setTelemetry] = useState(null);
  const [loading, setLoading] = useState(true);
  const [lastRefreshed, setLastRefreshed] = useState(new Date());
  const [fitTrigger, setFitTrigger] = useState(0);
  const [selectedNode, setSelectedNode] = useState(null);
  const [selectedCamera, setSelectedCamera] = useState(null);
  const [viewMode, setViewMode] = useState('traffic'); // 'traffic' | 'trajectory'

  // Layer Toggles
  const [showIntersections, setShowIntersections] = useState(true);
  const [showCameras, setShowCameras] = useState(true);
  const [showActiveCorridor, setShowActiveCorridor] = useState(true);
  const [showPlannedLinks, setShowPlannedLinks] = useState(true);

  // Fetch real-time map telemetry
  const fetchMapTelemetry = () => {
    fetch(getApiUrl('/api/gis/map-telemetry'))
      .then(res => res.json())
      .then(data => {
        if (data && data.intersections) {
          setTelemetry(data);
          setLastRefreshed(new Date());
          // Auto-select I1 on first load if nothing selected
          if (!selectedNode && data.intersections.length > 0) {
            setSelectedNode(data.intersections[0]);
          }
        }
      })
      .catch(err => console.warn('Failed to fetch map telemetry:', err))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchMapTelemetry();
    const timer = setInterval(fetchMapTelemetry, 2500);
    return () => clearInterval(timer);
  }, []);

  const defaultCenter = [17.4440, 78.3750];
  const allCoords = (telemetry?.intersections || []).map(i => [i.latitude, i.longitude]);

  const handleFitAll = () => {
    setFitTrigger(prev => prev + 1);
  };

  // Trajectory coords if active
  const trajectoryCoords = activeTrajectory?.path_coordinates || [];

  return (
    <div className="gov-section" id="section-gis">
      {/* Header with Title and Mode Switcher */}
      <div className="gov-section-header" style={{ flexWrap: 'wrap', gap: '0.75rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Navigation size={18} style={{ color: '#0284c7' }} />
          <span className="gov-section-title">
            HYDERABAD SMART IT CORRIDOR — INTERACTIVE TRAFFIC COMMAND MAP
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
          {/* View Mode Toggle */}
          <div style={{ display: 'flex', backgroundColor: '#0f172a', padding: '2px', borderRadius: '4px' }}>
            <button
              onClick={() => setViewMode('traffic')}
              style={{
                backgroundColor: viewMode === 'traffic' ? '#0284c7' : 'transparent',
                color: viewMode === 'traffic' ? '#ffffff' : '#94a3b8',
                border: 'none',
                borderRadius: '3px',
                padding: '0.25rem 0.65rem',
                fontSize: '0.7rem',
                fontWeight: 700,
                cursor: 'pointer'
              }}
            >
              TRAFFIC INTELLIGENCE
            </button>
            <button
              onClick={() => setViewMode('trajectory')}
              style={{
                backgroundColor: viewMode === 'trajectory' ? '#10b981' : 'transparent',
                color: viewMode === 'trajectory' ? '#ffffff' : '#94a3b8',
                border: 'none',
                borderRadius: '3px',
                padding: '0.25rem 0.65rem',
                fontSize: '0.7rem',
                fontWeight: 700,
                cursor: 'pointer'
              }}
            >
              PLATE TRAJECTORY {activeTrajectory ? `(${activeTrajectory.formatted_plate || activeTrajectory.plate_number})` : ''}
            </button>
          </div>

          <button
            onClick={handleFitAll}
            title="Fit bounds to all 4 intersections"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.3rem',
              backgroundColor: '#ffffff',
              border: '1px solid #cbd5e1',
              borderRadius: '4px',
              padding: '0.3rem 0.6rem',
              fontSize: '0.7rem',
              fontWeight: 700,
              color: '#0b2545',
              cursor: 'pointer'
            }}
          >
            <Maximize2 size={12} />
            <span>FIT BOUNDS</span>
          </button>

          <button
            onClick={fetchMapTelemetry}
            title="Refresh GIS telemetry"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.3rem',
              backgroundColor: '#f1f5f9',
              border: '1px solid #cbd5e1',
              borderRadius: '4px',
              padding: '0.3rem 0.6rem',
              fontSize: '0.7rem',
              fontWeight: 700,
              color: '#475569',
              cursor: 'pointer'
            }}
          >
            <RefreshCw size={12} className={loading ? 'spin' : ''} />
            <span>REFRESH</span>
          </button>
        </div>
      </div>

      {/* Layer Control Bar & Legend */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        backgroundColor: '#0b2545',
        color: '#f8fafc',
        padding: '0.45rem 0.85rem',
        fontSize: '0.72rem',
        borderRadius: '4px 4px 0 0',
        flexWrap: 'wrap',
        gap: '0.5rem'
      }}>
        {/* Layer Checkboxes */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontWeight: 700, color: '#38bdf8' }}>
            <Layers size={13} />
            <span>MAP LAYERS:</span>
          </div>

          <label style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={showIntersections}
              onChange={(e) => setShowIntersections(e.target.checked)}
            />
            <span>Intersections (I1-I4)</span>
          </label>

          <label style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={showCameras}
              onChange={(e) => setShowCameras(e.target.checked)}
            />
            <span>Cameras (8 Feeds)</span>
          </label>

          <label style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={showActiveCorridor}
              onChange={(e) => setShowActiveCorridor(e.target.checked)}
            />
            <span style={{ color: '#34d399' }}>● Active Monitored MG Road (I1-I2)</span>
          </label>

          <label style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={showPlannedLinks}
              onChange={(e) => setShowPlannedLinks(e.target.checked)}
            />
            <span style={{ color: '#fbbf24' }}>- - - Planned Extension (I2-I4)</span>
          </label>
        </div>

        {/* Live Refresh Timestamp */}
        <div style={{ fontFamily: 'monospace', color: '#94a3b8' }}>
          UPDATED: {lastRefreshed.toLocaleTimeString()} (AUTO-REFRESH: 2.5s)
        </div>
      </div>

      {/* Main Map + Side Details Split View */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 340px',
        gap: '0',
        border: '2px solid #0b2545',
        borderRadius: '0 0 6px 6px',
        overflow: 'hidden',
        minHeight: '520px',
        boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
      }}>
        {/* Leaflet Map Canvas */}
        <div style={{ position: 'relative', height: '520px', width: '100%', backgroundColor: '#0f172a' }}>
          <MapContainer
            center={defaultCenter}
            zoom={14}
            scrollWheelZoom={true}
            style={{ height: '100%', width: '100%' }}
          >
            {/* Tile Layer: OpenStreetMap / CartoDB Voyager for high clarity */}
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
              url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
            />

            <MapFitBoundsHandler triggerFit={fitTrigger} bounds={allCoords} />

            {/* Monitored Active Corridor Polyline: I1 to I2 (850m) */}
            {showActiveCorridor && (
              <Polyline
                positions={[[17.4504, 78.3808], [17.4428, 78.3813]]}
                pathOptions={{
                  color: '#059669',
                  weight: 6,
                  opacity: 0.9,
                  lineCap: 'round'
                }}
              >
                <Tooltip sticky>
                  <div style={{ fontFamily: 'sans-serif', fontSize: '0.75rem' }}>
                    <strong>Active Monitored Corridor Segment</strong><br />
                    Cyber Towers ↔ Mindspace (850m)<br />
                    Speed: ~41.5 km/h | Travel Time: ~74s<br />
                    <span style={{ color: '#059669', fontWeight: 700 }}>● Green Wave Progression Active</span>
                  </div>
                </Tooltip>
              </Polyline>
            )}

            {/* Planned Extension Links: I2 to I3, I3 to I4 */}
            {showPlannedLinks && (
              <>
                <Polyline
                  positions={[[17.4428, 78.3813], [17.4325, 78.3728]]}
                  pathOptions={{
                    color: '#f59e0b',
                    weight: 4,
                    opacity: 0.7,
                    dashArray: '6, 8'
                  }}
                >
                  <Tooltip sticky>
                    <div style={{ fontSize: '0.75rem' }}>
                      <strong>Planned Expansion Link: I2 → I3</strong><br />
                      Mindspace to Bio-Diversity (1,400m)
                    </div>
                  </Tooltip>
                </Polyline>

                <Polyline
                  positions={[[17.4325, 78.3728], [17.4401, 78.3489]]}
                  pathOptions={{
                    color: '#f59e0b',
                    weight: 4,
                    opacity: 0.7,
                    dashArray: '6, 8'
                  }}
                >
                  <Tooltip sticky>
                    <div style={{ fontSize: '0.75rem' }}>
                      <strong>Planned Expansion Link: I3 → I4</strong><br />
                      Bio-Diversity to Gachibowli (2,600m)
                    </div>
                  </Tooltip>
                </Polyline>
              </>
            )}

            {/* Reconstructed Plate Trajectory Path (if in Trajectory View) */}
            {viewMode === 'trajectory' && trajectoryCoords.length > 1 && (
              <Polyline
                positions={trajectoryCoords}
                pathOptions={{
                  color: '#dc2626',
                  weight: 6,
                  opacity: 0.95
                }}
              />
            )}

            {/* Intersection Markers */}
            {showIntersections && (telemetry?.intersections || []).map((node) => {
              const isSelected = selectedNode?.intersection_id === node.intersection_id;
              return (
                <Marker
                  key={`node-${node.intersection_id}`}
                  position={[node.latitude, node.longitude]}
                  icon={createIntersectionMarkerIcon(
                    node.intersection_id,
                    node.phase_state,
                    node.congestion_rating,
                    node.emergency_preemption_active
                  )}
                  eventHandlers={{
                    click: () => {
                      setSelectedNode(node);
                      setSelectedCamera(null);
                    }
                  }}
                >
                  <Tooltip direction="top" offset={[0, -20]} opacity={0.95}>
                    <div style={{ fontFamily: 'sans-serif', fontSize: '0.75rem' }}>
                      <strong>{node.intersection_id}: {node.name}</strong><br />
                      Active: <strong>{node.active_approach}</strong> ({node.phase_state})<br />
                      Total Queue: <strong>{node.total_vehicles} vehicles</strong>
                    </div>
                  </Tooltip>
                </Marker>
              );
            })}

            {/* Camera Markers */}
            {showCameras && (telemetry?.cameras || []).map((cam) => {
              return (
                <Marker
                  key={`cam-${cam.camera_id}`}
                  position={[cam.latitude, cam.longitude]}
                  icon={createCameraMarkerIcon(cam.direction, cam.is_active_approach)}
                  eventHandlers={{
                    click: () => {
                      setSelectedCamera(cam);
                      const parentNode = (telemetry?.intersections || []).find(i => i.intersection_id === cam.intersection_id);
                      if (parentNode) setSelectedNode(parentNode);
                    }
                  }}
                >
                  <Tooltip direction="bottom" offset={[0, 10]} opacity={0.95}>
                    <div style={{ fontFamily: 'monospace', fontSize: '0.7rem' }}>
                      <strong>{cam.camera_id}</strong><br />
                      Approach: {cam.direction}<br />
                      Queue: {cam.current_approach_queue} veh<br />
                      Source: RECORDED_CCTV_REPLAY<br />
                      Loc: Approximate Offset
                    </div>
                  </Tooltip>
                </Marker>
              );
            })}
          </MapContainer>

          {/* Floating Transparency Watermark Badge */}
          <div style={{
            position: 'absolute',
            bottom: '8px',
            left: '8px',
            zIndex: 1000,
            backgroundColor: 'rgba(15, 23, 42, 0.88)',
            border: '1px solid #334155',
            borderRadius: '4px',
            padding: '0.35rem 0.65rem',
            color: '#94a3b8',
            fontSize: '0.68rem',
            fontFamily: 'monospace',
            display: 'flex',
            alignItems: 'center',
            gap: '0.4rem'
          }}>
            <ShieldCheck size={12} color="#10b981" />
            <span>CCTV PROVENANCE: RECORDED BENCHMARK REPLAY • ZERO LIVE SURVEILLANCE</span>
          </div>
        </div>

        {/* Real-Time Node & Camera Inspector Panel */}
        <div style={{
          backgroundColor: '#f8fafc',
          borderLeft: '1px solid #cbd5e1',
          padding: '0.85rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.75rem',
          overflowY: 'auto',
          maxHeight: '520px'
        }}>
          {selectedCamera ? (
            /* Camera Inspector Card */
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.7rem', fontWeight: 800, color: '#0284c7', textTransform: 'uppercase' }}>
                  CAMERA FEED INSPECTOR
                </span>
                <button
                  onClick={() => setSelectedCamera(null)}
                  style={{
                    backgroundColor: 'transparent',
                    border: 'none',
                    fontSize: '0.7rem',
                    color: '#64748b',
                    cursor: 'pointer'
                  }}
                >
                  Back to Junction
                </button>
              </div>

              <div style={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '0.75rem' }}>
                <div style={{ fontWeight: 800, color: '#0b2545', fontSize: '0.9rem' }}>
                  {selectedCamera.camera_id}
                </div>
                <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '2px' }}>
                  {selectedCamera.name}
                </div>

                {/* Video Provenance Notice */}
                <div style={{
                  backgroundColor: '#eff6ff',
                  border: '1px solid #bfdbfe',
                  borderRadius: '4px',
                  padding: '0.45rem',
                  marginTop: '0.5rem',
                  fontSize: '0.68rem',
                  color: '#1e40af'
                }}>
                  <div><strong>SOURCE TYPE:</strong> {selectedCamera.source_type || 'RECORDED_CCTV_REPLAY'}</div>
                  <div style={{ marginTop: '2px' }}>
                    <strong>PROCESSING:</strong> ACTIVE REPLAY STREAM ({selectedCamera.telemetry_freshness || 'FRESH'})
                  </div>
                  <div style={{ marginTop: '2px', color: '#475569' }}>
                    <strong>LOCATION:</strong> Approximate approach offset (~60m-75m from junction center).
                  </div>
                  <div style={{ color: '#475569', marginTop: '2px' }}>
                    Pre-recorded calibration video ({selectedCamera.video_file}). Transparent playback.
                  </div>
                </div>

                <div style={{ marginTop: '0.65rem', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', fontSize: '0.75rem' }}>
                  <div>
                    <span style={{ color: '#64748b' }}>Approach:</span><br />
                    <strong>{selectedCamera.direction}</strong>
                  </div>
                  <div>
                    <span style={{ color: '#64748b' }}>Status:</span><br />
                    <span style={{ color: '#059669', fontWeight: 800 }}>● {selectedCamera.status}</span>
                  </div>
                  <div>
                    <span style={{ color: '#64748b' }}>Current Queue:</span><br />
                    <strong>{selectedCamera.current_approach_queue} vehicles</strong>
                  </div>
                  <div>
                    <span style={{ color: '#64748b' }}>Phase:</span><br />
                    <strong style={{ color: selectedCamera.is_active_approach ? '#059669' : '#dc2626' }}>
                      {selectedCamera.is_active_approach ? 'GREEN' : 'RED'}
                    </strong>
                  </div>
                </div>
              </div>
            </div>
          ) : selectedNode ? (
            /* Intersection Node Inspector Card */
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.7rem', fontWeight: 800, color: '#0284c7', textTransform: 'uppercase' }}>
                  INTERSECTION TELEMETRY
                </span>
                <span style={{
                  backgroundColor: selectedNode.congestion_rating === 'CRITICAL' ? '#fef2f2' : (selectedNode.congestion_rating === 'HEAVY' ? '#fffbeb' : '#ecfdf5'),
                  color: selectedNode.congestion_rating === 'CRITICAL' ? '#dc2626' : (selectedNode.congestion_rating === 'HEAVY' ? '#d97706' : '#059669'),
                  padding: '0.15rem 0.45rem',
                  borderRadius: '3px',
                  fontSize: '0.68rem',
                  fontWeight: 800
                }}>
                  {selectedNode.congestion_rating}
                </span>
              </div>

              <div style={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '0.75rem' }}>
                <div style={{ fontWeight: 800, color: '#0b2545', fontSize: '0.95rem' }}>
                  {selectedNode.intersection_id}: {selectedNode.name}
                </div>
                <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: '2px' }}>
                  GPS: {selectedNode.latitude.toFixed(4)}°N, {selectedNode.longitude.toFixed(4)}°E
                </div>

                {/* Emergency Preemption Banner if active */}
                {selectedNode.emergency_preemption_active && (
                  <div style={{
                    backgroundColor: '#fef2f2',
                    border: '1px solid #fecaca',
                    borderRadius: '4px',
                    padding: '0.4rem',
                    marginTop: '0.45rem',
                    fontSize: '0.7rem',
                    color: '#dc2626',
                    fontWeight: 700,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.35rem'
                  }}>
                    <AlertTriangle size={14} />
                    <span>EMERGENCY CORRIDOR PREEMPTION ACTIVE</span>
                  </div>
                )}

                {/* Active Phase Countdown Meter */}
                <div style={{
                  backgroundColor: '#0f172a',
                  color: '#ffffff',
                  borderRadius: '6px',
                  padding: '0.65rem',
                  marginTop: '0.65rem'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.7rem', color: '#94a3b8' }}>ACTIVE APPROACH:</span>
                    <span style={{
                      fontWeight: 800,
                      color: selectedNode.phase_state === 'GREEN' ? '#34d399' : (selectedNode.phase_state === 'YELLOW' ? '#fbbf24' : '#f87171'),
                      fontSize: '0.8rem'
                    }}>
                      {selectedNode.active_approach} ({selectedNode.phase_state})
                    </span>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginTop: '0.35rem' }}>
                    <span style={{ fontSize: '0.7rem', color: '#94a3b8' }}>COUNTDOWN:</span>
                    <span style={{ fontFamily: 'monospace', fontSize: '1.4rem', fontWeight: 900, color: '#38bdf8' }}>
                      {selectedNode.remaining_seconds}s
                    </span>
                  </div>
                  <div style={{ fontSize: '0.68rem', color: '#64748b', textAlign: 'right' }}>
                    Elapsed: {selectedNode.state_elapsed}s / {selectedNode.green_duration}s Green
                  </div>
                </div>

                {/* Approach Queue Densities Breakdown */}
                <div style={{ marginTop: '0.75rem' }}>
                  <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#334155', marginBottom: '0.35rem' }}>
                    APPROACH QUEUES ({selectedNode.total_vehicles} total vehicles):
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.4rem' }}>
                    {Object.entries(selectedNode.queues || {}).map(([approach, count]) => {
                      const isActive = selectedNode.active_approach === approach;
                      return (
                        <div
                          key={approach}
                          style={{
                            backgroundColor: isActive ? '#f0fdf4' : '#f8fafc',
                            border: `1px solid ${isActive ? '#86efac' : '#e2e8f0'}`,
                            borderRadius: '4px',
                            padding: '0.35rem 0.5rem',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center'
                          }}
                        >
                          <span style={{ fontSize: '0.72rem', fontWeight: isActive ? 800 : 500, color: isActive ? '#059669' : '#475569' }}>
                            {approach}
                          </span>
                          <span style={{ fontFamily: 'monospace', fontWeight: 800, fontSize: '0.75rem', color: '#0f172a' }}>
                            {count} veh
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Permitted Movements */}
                <div style={{ marginTop: '0.65rem', borderTop: '1px solid #f1f5f9', paddingTop: '0.45rem' }}>
                  <span style={{ fontSize: '0.68rem', color: '#64748b' }}>Permitted Movements:</span>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem', marginTop: '0.2rem' }}>
                    {(selectedNode.permitted_movements || []).map((m, idx) => (
                      <span key={idx} style={{
                        backgroundColor: '#f1f5f9',
                        color: '#334155',
                        padding: '0.1rem 0.35rem',
                        borderRadius: '3px',
                        fontSize: '0.68rem',
                        fontFamily: 'monospace'
                      }}>
                        {m}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div style={{ textAlign: 'center', color: '#64748b', padding: '2rem 1rem', fontSize: '0.8rem' }}>
              Select an intersection or camera marker on the map to inspect live telemetry.
            </div>
          )}

          {/* Quick Select Buttons for Intersections */}
          <div style={{ marginTop: 'auto', borderTop: '1px solid #e2e8f0', paddingTop: '0.5rem' }}>
            <span style={{ fontSize: '0.68rem', color: '#64748b', fontWeight: 700 }}>SELECT JUNCTION:</span>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.3rem', marginTop: '0.3rem' }}>
              {(telemetry?.intersections || []).map(node => (
                <button
                  key={node.intersection_id}
                  onClick={() => {
                    setSelectedNode(node);
                    setSelectedCamera(null);
                  }}
                  style={{
                    backgroundColor: selectedNode?.intersection_id === node.intersection_id ? '#0284c7' : '#ffffff',
                    color: selectedNode?.intersection_id === node.intersection_id ? '#ffffff' : '#0b2545',
                    border: '1px solid #cbd5e1',
                    borderRadius: '3px',
                    padding: '0.25rem 0',
                    fontSize: '0.7rem',
                    fontWeight: 800,
                    cursor: 'pointer'
                  }}
                >
                  {node.intersection_id}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Corridor Legend & GIS Spatial Assurance Banner */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '0.6rem 0.5rem 0',
        fontSize: '0.725rem',
        color: '#64748b',
        fontFamily: 'monospace',
        flexWrap: 'wrap',
        gap: '0.5rem'
      }}>
        <div style={{ display: 'flex', gap: '1.25rem', flexWrap: 'wrap' }}>
          <span><strong style={{ color: '#0b2545' }}>[I1 - I4]</strong> Smart Corridor Junctions</span>
          <span><strong style={{ color: '#059669' }}>━━━</strong> Active Monitored Arterial (850m)</span>
          <span><strong style={{ color: '#f59e0b' }}>- - -</strong> Planned Continuous Corridors (4,000m)</span>
          <span><strong style={{ color: '#64748b' }}>[N/S/E/W]</strong> 8 Fixed Approach Cameras</span>
        </div>
        <span style={{ color: '#059669', fontWeight: 700 }}>
          COORDINATES CALIBRATED: HYDERABAD METROPOLITAN IT CORRIDOR (WGS84)
        </span>
      </div>
    </div>
  );
}
