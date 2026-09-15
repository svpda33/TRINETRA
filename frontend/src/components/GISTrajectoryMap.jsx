import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, Tooltip, useMap } from 'react-leaflet';
import L from 'leaflet';
import { MapPin, Navigation, Eye, AlertTriangle, ShieldCheck } from 'lucide-react';
import { getApiUrl } from '../config';

// Fix default Leaflet marker icon asset paths for Vite/React bundling
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

// Custom SVG Icons for ITMS Command Center
const createJunctionIcon = (id, isActive) => {
  return L.divIcon({
    className: 'custom-junction-marker',
    html: `
      <div style="
        background: ${isActive ? '#dc2626' : '#0b2545'};
        border: 2px solid ${isActive ? '#f87171' : '#38bdf8'};
        color: #ffffff;
        font-family: monospace;
        font-weight: 800;
        font-size: 11px;
        width: 32px;
        height: 32px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        box-shadow: 0 0 ${isActive ? '12px #ef4444' : '6px rgba(0,0,0,0.5)'};
      ">
        ${id}
      </div>
    `,
    iconSize: [32, 32],
    iconAnchor: [16, 16],
    popupAnchor: [0, -18],
  });
};

const createBreadcrumbIcon = (stepIndex, isLast) => {
  return L.divIcon({
    className: 'custom-breadcrumb-marker',
    html: `
      <div style="
        background: ${isLast ? '#10b981' : '#f59e0b'};
        border: 2px solid #ffffff;
        color: #0b2545;
        font-family: monospace;
        font-weight: 900;
        font-size: 11px;
        width: 26px;
        height: 26px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        box-shadow: 0 0 10px ${isLast ? '#10b981' : '#f59e0b'};
      ">
        ${stepIndex}
      </div>
    `,
    iconSize: [26, 26],
    iconAnchor: [13, 13],
    popupAnchor: [0, -14],
  });
};

// Component to dynamically pan map when active trajectory changes
function MapRecenter({ coords }) {
  const map = useMap();
  useEffect(() => {
    if (coords && coords.length > 0) {
      if (coords.length === 1) {
        map.setView(coords[0], 15);
      } else {
        const bounds = L.latLngBounds(coords);
        map.fitBounds(bounds, { padding: [40, 40] });
      }
    }
  }, [coords, map]);
  return null;
}

export default function GISTrajectoryMap({ activeTrajectory = null, onSelectPlate }) {
  const [topology, setTopology] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(getApiUrl('/api/gis/topology'))
      .then(res => res.json())
      .then(resData => {
        if (resData.data) {
          setTopology(resData.data);
        }
      })
      .catch(err => console.warn('Failed to load GIS topology:', err))
      .finally(() => setLoading(false));
  }, []);

  const defaultCenter = [17.4440, 78.3750];
  const junctions = topology?.junctions || [
    { intersection_id: "I1", name: "Cyber Towers Junction", latitude: 17.4504, longitude: 78.3808, locality: "Hitec City Core" },
    { intersection_id: "I2", name: "Hitec City / Mindspace Junction", latitude: 17.4428, longitude: 78.3813, locality: "Mindspace SEZ" },
    { intersection_id: "I3", name: "Bio-Diversity Junction", latitude: 17.4325, longitude: 78.3728, locality: "Raidurgam" },
    { intersection_id: "I4", name: "Gachibowli Junction", latitude: 17.4401, longitude: 78.3489, locality: "Financial District Gate" },
  ];

  // Base corridor path lines connecting the 4 Hyderabad junctions
  const corridorPath = junctions.map(j => [j.latitude, j.longitude]);

  // Active searched vehicle trajectory path
  const trajectoryCoords = activeTrajectory?.path_coordinates || [];

  return (
    <div className="gov-section" id="section-gis">
      <div className="gov-section-header">
        <div className="gov-section-title" style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
          <Navigation size={18} style={{ color: '#0284c7' }} />
          <span>CITY-WIDE GIS SPATIAL TRAJECTORY MAP</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', fontFamily: 'monospace', fontSize: '0.725rem', color: '#64748b' }}>
          <span>HYDERABAD IT CORRIDOR (CYBER TOWERS ↔ GACHIBOWLI)</span>
          <span style={{ color: '#059669', fontWeight: 700 }}>● GIS SATELLITE TELEMETRY ACTIVE</span>
        </div>
      </div>

      {/* Map Container */}
      <div style={{
        position: 'relative',
        height: '480px',
        width: '100%',
        borderRadius: '6px',
        overflow: 'hidden',
        border: '2px solid #0b2545',
        boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
      }}>
        {/* Active Trajectory Floating Overlay Banner */}
        {activeTrajectory && (
          <div style={{
            position: 'absolute',
            top: '12px',
            right: '12px',
            zIndex: 1000,
            backgroundColor: 'rgba(7, 25, 44, 0.92)',
            backdropFilter: 'blur(4px)',
            border: '1px solid #38bdf8',
            borderRadius: '4px',
            padding: '0.65rem 0.9rem',
            color: '#ffffff',
            fontFamily: 'monospace',
            maxWidth: '320px',
            boxShadow: '0 4px 10px rgba(0,0,0,0.5)'
          }}>
            <div style={{ fontSize: '0.7rem', color: '#94a3b8' }}>TRACKED VEHICLE TRAJECTORY</div>
            <div style={{ fontSize: '1rem', fontWeight: 800, color: '#38bdf8', marginTop: '2px' }}>
              {activeTrajectory.formatted_plate || activeTrajectory.plate_number}
            </div>
            <div style={{ fontSize: '0.75rem', color: '#cbd5e1', marginTop: '4px' }}>
              Sightings: <strong>{activeTrajectory.total_sightings} hops</strong> | Avg Speed: <strong>{activeTrajectory.average_speed_kmh} km/h</strong>
            </div>
            <div style={{ fontSize: '0.7rem', color: '#10b981', marginTop: '2px' }}>
              Last Seen: {activeTrajectory.last_seen_camera} ({activeTrajectory.last_seen})
            </div>
          </div>
        )}

        <MapContainer
          center={defaultCenter}
          zoom={14}
          scrollWheelZoom={true}
          style={{ height: '100%', width: '100%' }}
        >
          {/* CartoDB Dark Matter tiles matching ITMS command center dark aesthetic */}
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
            url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
          />

          <MapRecenter coords={trajectoryCoords.length > 0 ? trajectoryCoords : corridorPath} />

          {/* Base Corridor Backbone Line */}
          <Polyline
            positions={corridorPath}
            pathOptions={{
              color: '#3b82f6',
              weight: 4,
              opacity: 0.65,
              dashArray: '8, 8'
            }}
          />

          {/* Active Vehicle Trajectory Line */}
          {trajectoryCoords.length > 1 && (
            <Polyline
              positions={trajectoryCoords}
              pathOptions={{
                color: '#10b981',
                weight: 5,
                opacity: 0.95
              }}
            />
          )}

          {/* Junction / Intersection Markers */}
          {junctions.map((j) => {
            const hasTrajectoryHit = activeTrajectory?.hops?.some(h => h.camera_id.includes(j.intersection_id));
            return (
              <Marker
                key={j.intersection_id}
                position={[j.latitude, j.longitude]}
                icon={createJunctionIcon(j.intersection_id, hasTrajectoryHit)}
              >
                <Popup>
                  <div style={{ fontFamily: 'sans-serif', minWidth: '180px' }}>
                    <strong style={{ color: '#0b2545', fontSize: '0.875rem' }}>{j.name}</strong>
                    <div style={{ fontSize: '0.75rem', color: '#64748b' }}>{j.locality}</div>
                    <div style={{ fontSize: '0.7rem', fontFamily: 'monospace', marginTop: '4px', color: '#0284c7' }}>
                      GPS: {j.latitude.toFixed(4)}°N, {j.longitude.toFixed(4)}°E
                    </div>
                    <div style={{ marginTop: '6px', fontSize: '0.725rem', borderTop: '1px solid #e2e8f0', paddingTop: '4px' }}>
                      Cameras Monitored: <strong>4 Approaches</strong>
                    </div>
                  </div>
                </Popup>
                <Tooltip direction="top" offset={[0, -18]} opacity={0.9}>
                  <span style={{ fontFamily: 'monospace', fontWeight: 700 }}>
                    {j.intersection_id}: {j.name}
                  </span>
                </Tooltip>
              </Marker>
            );
          })}

          {/* Sighting Breadcrumbs for Searched Vehicle */}
          {activeTrajectory?.hops?.map((hop, idx) => {
            const isLast = idx === activeTrajectory.hops.length - 1;
            return (
              <Marker
                key={`hop-${idx}`}
                position={[hop.latitude, hop.longitude]}
                icon={createBreadcrumbIcon(hop.sequence_index, isLast)}
              >
                <Popup>
                  <div style={{ fontFamily: 'sans-serif', minWidth: '200px' }}>
                    <div style={{ color: isLast ? '#059669' : '#d97706', fontWeight: 800, fontSize: '0.8rem' }}>
                      {isLast ? 'CURRENT / LAST SEEN LOCATION' : `TRAJECTORY HOP #${hop.sequence_index}`}
                    </div>
                    <div style={{ fontWeight: 700, fontSize: '0.9rem', color: '#0b2545', marginTop: '2px' }}>
                      {hop.intersection_name}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '2px' }}>
                      Camera: <strong>{hop.camera_id}</strong>
                    </div>
                    <div style={{ fontSize: '0.75rem', color: '#334155', marginTop: '2px' }}>
                      Timestamp: <strong>{hop.timestamp}</strong>
                    </div>
                    <div style={{ fontSize: '0.75rem', color: '#334155' }}>
                      Speed: <strong>{hop.speed_kmh} km/h</strong> | Heading: <strong>{hop.heading}</strong>
                    </div>
                    {hop.travel_time_seconds > 0 && (
                      <div style={{ fontSize: '0.7rem', color: '#0284c7', marginTop: '4px', borderTop: '1px solid #e2e8f0', paddingTop: '4px' }}>
                        Hop Duration: {hop.travel_time_seconds}s | Dist: {hop.segment_distance_meters}m
                      </div>
                    )}
                  </div>
                </Popup>
              </Marker>
            );
          })}
        </MapContainer>
      </div>

      {/* Map Footer Information Bar */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '0.6rem 0.5rem 0',
        fontSize: '0.725rem',
        color: '#64748b',
        fontFamily: 'monospace'
      }}>
        <div style={{ display: 'flex', gap: '1.25rem' }}>
          <span><strong style={{ color: '#0b2545' }}>[I1 - I4]</strong> Corridor Junctions</span>
          <span><strong style={{ color: '#10b981' }}>━━━</strong> Reconstructed Trajectory</span>
          <span><strong style={{ color: '#3b82f6' }}>- - -</strong> Monitored Corridor Segment</span>
        </div>
        <span>ACCURACY: GPS MAPPED & INTERPOLATED SPATIAL NODES</span>
      </div>
    </div>
  );
}
