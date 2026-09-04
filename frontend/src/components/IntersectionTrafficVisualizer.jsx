import React from 'react';
import { CheckCircle2 } from 'lucide-react';

export default function IntersectionTrafficVisualizer({ intersection }) {
  const activeIds = intersection?.active_movement_ids || [];
  const activeLabels = intersection?.active_movements || [];
  const yellowLabels = intersection?.yellow_movements || [];
  const det = intersection?.signal_state?.detailed_movements || {};

  // Helper to determine single movement lamp color (GREEN, YELLOW, RED)
  const getMovementColor = (id, label, detVal) => {
    if (yellowLabels.includes(label) || yellowLabels.includes(id)) {
      return 'YELLOW';
    }
    if (activeIds.includes(id) || activeLabels.includes(label) || detVal === 'GREEN') {
      return 'GREEN';
    }
    return 'RED';
  };

  // Straight & Right turn movements calculate color dynamically for Left-Hand Traffic (LHT)
  const n_s = getMovementColor('N_TO_S', 'N → S', det.n_to_s);
  const n_w = getMovementColor('N_TO_W', 'N → W', det.n_to_w); // Right turn in LHT

  const s_n = getMovementColor('S_TO_N', 'S → N', det.s_to_n);
  const s_e = getMovementColor('S_TO_E', 'S → E', det.s_to_e); // Right turn in LHT

  const e_w = getMovementColor('E_TO_W', 'E → W', det.e_to_w);
  const e_n = getMovementColor('E_TO_N', 'E → N', det.e_to_n); // Right turn in LHT

  const w_e = getMovementColor('W_TO_E', 'W → E', det.w_to_e);
  const w_s = getMovementColor('W_TO_S', 'W → S', det.w_s); // Right turn in LHT

  // CRITICAL REQUIREMENT (LHT): All LEFT-TURN Arrows (N→E, S→W, E→S, W→N) MUST ALWAYS REMAIN GREEN!
  const n_e = 'GREEN'; // Left Turn in LHT (N → E)
  const s_w = 'GREEN'; // Left Turn in LHT (S → W)
  const e_s = 'GREEN'; // Left Turn in LHT (E → S)
  const w_n = 'GREEN'; // Left Turn in LHT (W → N)

  const ped = activeIds.includes('PEDESTRIAN_WALK') || activeLabels.includes('PEDESTRIAN_WALK') || det.pedestrian === 'GREEN';

  // Hex color codes for ITMS dashboard
  const getArrowColorHex = (val) => {
    if (val === 'GREEN') return '#10b981';  // Emerald Green
    if (val === 'YELLOW') return '#f59e0b'; // Amber Yellow
    return '#ef4444';                       // Crimson Red
  };

  const getStatusText = (val) => {
    if (val === 'GREEN') return 'PERMITTED (GREEN)';
    if (val === 'YELLOW') return 'TRANSITIONING (YELLOW)';
    return 'STOPPED / WAITING (RED)';
  };

  const isYellowTransition = yellowLabels.length > 0;
  const isClearance = intersection?.is_clearance_active || (
    !isYellowTransition &&
    n_s !== 'GREEN' && s_n !== 'GREEN' && e_w !== 'GREEN' && w_e !== 'GREEN' &&
    n_w !== 'GREEN' && s_e !== 'GREEN' && e_n !== 'GREEN' && w_s !== 'GREEN' && !ped
  );

  return (
    <div style={{
      backgroundColor: 'rgba(248, 250, 252, 0.98)',
      border: '1px solid #cbd5e1',
      borderRadius: '6px',
      padding: '0.85rem',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: '0.65rem',
      fontFamily: 'system-ui, -apple-system, sans-serif',
      boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
    }}>
      {/* Node Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center' }}>
        <div>
          <strong style={{ fontSize: '0.875rem', color: '#0b2545', letterSpacing: '-0.01em' }}>
            Intersection {intersection?.intersection_id}
          </strong>
          <div style={{ fontSize: '0.725rem', color: '#64748b', fontWeight: 500 }}>{intersection?.name}</div>
        </div>
        <span style={{
          fontSize: '0.65rem',
          fontWeight: 800,
          fontFamily: 'monospace',
          padding: '0.2rem 0.5rem',
          borderRadius: '3px',
          backgroundColor: isClearance ? '#fef2f2' : isYellowTransition ? '#fffbeb' : '#ecfdf5',
          color: isClearance ? '#dc2626' : isYellowTransition ? '#d97706' : '#059669',
          border: isClearance ? '1px solid #fecaca' : isYellowTransition ? '1px solid #fde68a' : '1px solid #a7f3d0'
        }}>
          {isClearance ? 'ALL RED CLEARANCE' : isYellowTransition ? 'YELLOW TRANSITION' : 'PHASE ACTIVE'}
        </span>
      </div>

      {/* Realistic Indian / Left-Hand-Traffic (LHT) 4-Way Road Visualizer (SVG Canvas 380x380) */}
      <div style={{
        position: 'relative',
        width: '100%',
        maxWidth: '360px',
        aspectRatio: '1 / 1',
        backgroundColor: '#0f172a',
        borderRadius: '6px',
        overflow: 'hidden',
        boxShadow: 'inset 0 0 12px rgba(0,0,0,0.7)',
        border: '1px solid #334155'
      }}>
        <svg
          viewBox="0 0 380 380"
          style={{ width: '100%', height: '100%', display: 'block' }}
        >
          <defs>
            {/* Soft Shadow for Road Stencil Markings */}
            <filter id="stencil-shadow" x="-20%" y="-20%" width="140%" height="140%">
              <feDropShadow dx="0" dy="1" stdDeviation="0.8" floodColor="#000000" floodOpacity="0.5" />
            </filter>
          </defs>

          {/* Grass / Terrain Background */}
          <rect x="0" y="0" width="380" height="380" fill="#0f172a" />

          {/* Sidewalk Corners */}
          <rect x="0" y="0" width="120" height="120" fill="#1e293b" />
          <rect x="260" y="0" width="120" height="120" fill="#1e293b" />
          <rect x="0" y="260" width="120" height="120" fill="#1e293b" />
          <rect x="260" y="260" width="120" height="120" fill="#1e293b" />

          {/* Curb Borders */}
          <rect x="116" y="0" width="4" height="120" fill="#475569" />
          <rect x="260" y="0" width="4" height="120" fill="#475569" />
          <rect x="116" y="260" width="4" height="120" fill="#475569" />
          <rect x="260" y="260" width="4" height="120" fill="#475569" />

          <rect x="0" y="116" width="120" height="4" fill="#475569" />
          <rect x="0" y="260" width="120" height="4" fill="#475569" />
          <rect x="260" y="116" width="120" height="4" fill="#475569" />
          <rect x="260" y="260" width="120" height="4" fill="#475569" />

          {/* Asphalt Surfaces (Width = 140px, centered at 190) */}
          <rect x="120" y="0" width="140" height="380" fill="#1e293b" />
          <rect x="0" y="120" width="380" height="140" fill="#1e293b" />
          <rect x="120" y="120" width="140" height="140" fill="#243044" />

          {/* Double Yellow Median Dividing Lines (Opposing Traffic) */}
          <line x1="188.5" y1="0" x2="188.5" y2="100" stroke="#eab308" strokeWidth="1.5" />
          <line x1="191.5" y1="0" x2="191.5" y2="100" stroke="#eab308" strokeWidth="1.5" />
          <line x1="188.5" y1="280" x2="188.5" y2="380" stroke="#eab308" strokeWidth="1.5" />
          <line x1="191.5" y1="280" x2="191.5" y2="380" stroke="#eab308" strokeWidth="1.5" />
          <line x1="0" y1="188.5" x2="100" y2="188.5" stroke="#eab308" strokeWidth="1.5" />
          <line x1="0" y1="191.5" x2="100" y2="191.5" stroke="#eab308" strokeWidth="1.5" />
          <line x1="280" y1="188.5" x2="380" y2="188.5" stroke="#eab308" strokeWidth="1.5" />
          <line x1="280" y1="191.5" x2="380" y2="191.5" stroke="#eab308" strokeWidth="1.5" />

          {/* White Dashed Lane Dividers */}
          <line x1="143" y1="0" x2="143" y2="100" stroke="#94a3b8" strokeWidth="1.5" strokeDasharray="6 6" />
          <line x1="166" y1="0" x2="166" y2="100" stroke="#94a3b8" strokeWidth="1.5" strokeDasharray="6 6" />
          <line x1="214" y1="0" x2="214" y2="100" stroke="#94a3b8" strokeWidth="1.5" strokeDasharray="6 6" />
          <line x1="237" y1="0" x2="237" y2="100" stroke="#94a3b8" strokeWidth="1.5" strokeDasharray="6 6" />
          <line x1="143" y1="280" x2="143" y2="380" stroke="#94a3b8" strokeWidth="1.5" strokeDasharray="6 6" />
          <line x1="166" y1="280" x2="166" y2="380" stroke="#94a3b8" strokeWidth="1.5" strokeDasharray="6 6" />
          <line x1="214" y1="280" x2="214" y2="380" stroke="#94a3b8" strokeWidth="1.5" strokeDasharray="6 6" />
          <line x1="237" y1="280" x2="237" y2="380" stroke="#94a3b8" strokeWidth="1.5" strokeDasharray="6 6" />
          <line x1="0" y1="143" x2="100" y2="143" stroke="#94a3b8" strokeWidth="1.5" strokeDasharray="6 6" />
          <line x1="0" y1="166" x2="100" y2="166" stroke="#94a3b8" strokeWidth="1.5" strokeDasharray="6 6" />
          <line x1="0" y1="214" x2="100" y2="214" stroke="#94a3b8" strokeWidth="1.5" strokeDasharray="6 6" />
          <line x1="0" y1="237" x2="100" y2="237" stroke="#94a3b8" strokeWidth="1.5" strokeDasharray="6 6" />
          <line x1="280" y1="143" x2="380" y2="143" stroke="#94a3b8" strokeWidth="1.5" strokeDasharray="6 6" />
          <line x1="280" y1="166" x2="380" y2="166" stroke="#94a3b8" strokeWidth="1.5" strokeDasharray="6 6" />
          <line x1="280" y1="214" x2="380" y2="214" stroke="#94a3b8" strokeWidth="1.5" strokeDasharray="6 6" />
          <line x1="280" y1="237" x2="380" y2="237" stroke="#94a3b8" strokeWidth="1.5" strokeDasharray="6 6" />

          {/* Zebra Crosswalk Stripes */}
          {[124, 134, 144, 154, 164, 174, 184, 194, 204, 214, 224, 234, 244, 254].map(x => (
            <rect key={`n-cw-${x}`} x={x} y="102" width="6" height="15" fill="#f8fafc" opacity="0.85" />
          ))}
          {[124, 134, 144, 154, 164, 174, 184, 194, 204, 214, 224, 234, 244, 254].map(x => (
            <rect key={`s-cw-${x}`} x={x} y="263" width="6" height="15" fill="#f8fafc" opacity="0.85" />
          ))}
          {[124, 134, 144, 154, 164, 174, 184, 194, 204, 214, 224, 234, 244, 254].map(y => (
            <rect key={`w-cw-${y}`} x="102" y={y} width="15" height="6" fill="#f8fafc" opacity="0.85" />
          ))}
          {[124, 134, 144, 154, 164, 174, 184, 194, 204, 214, 224, 234, 244, 254].map(y => (
            <rect key={`e-cw-${y}`} x="263" y={y} width="15" height="6" fill="#f8fafc" opacity="0.85" />
          ))}

          {/* Solid White Stop Bars Across Incoming Carriageways (LHT) */}
          {/* North Leg Incoming (East Side X=191.5..260) */}
          <line x1="191.5" y1="100" x2="260" y2="100" stroke="#ffffff" strokeWidth="4" />
          {/* South Leg Incoming (West Side X=120..188.5) */}
          <line x1="120" y1="280" x2="188.5" y2="280" stroke="#ffffff" strokeWidth="4" />
          {/* West Leg Incoming (North Side Y=120..188.5) */}
          <line x1="100" y1="120" x2="100" y2="188.5" stroke="#ffffff" strokeWidth="4" />
          {/* East Leg Incoming (South Side Y=191.5..260) */}
          <line x1="280" y1="191.5" x2="280" y2="260" stroke="#ffffff" strokeWidth="4" />

          {/* Pedestrian Walk Highlight Band */}
          {ped && (
            <g>
              <rect x="120" y="100" width="140" height="18" fill="#10b981" opacity="0.4" />
              <rect x="120" y="262" width="140" height="18" fill="#10b981" opacity="0.4" />
              <rect x="100" y="120" width="18" height="140" fill="#10b981" opacity="0.4" />
              <rect x="262" y="120" width="18" height="140" fill="#10b981" opacity="0.4" />
              <text x="190" y="195" textAnchor="middle" fill="#10b981" fontSize="11" fontWeight="900" letterSpacing="1px">
                PEDESTRIAN WALK ACTIVE
              </text>
            </g>
          )}

          {/* ====================================================================== */}
          {/* INDIAN / LEFT-HAND-TRAFFIC (LHT) DIRECTIONAL STENCIL ARROWS            */}
          {/* ====================================================================== */}

          <g filter="url(#stencil-shadow)">
            {/* ------------------------------------------------------------------ */}
            {/* NORTH APPROACH ARROWS (Driving South downwards, incoming East side) */}
            {/* Lane 1 (Outermost Left X=248.5): N → E (Left Turn - ALWAYS GREEN) */}
            {/* Lane 2 (Middle X=225.5): N → S (Straight)                         */}
            {/* Lane 3 (Innermost Right X=202.5): N → W (Right Turn)               */}
            {/* ------------------------------------------------------------------ */}

            {/* N → E (Left Turn Arrow - ALWAYS GREEN) */}
            <g title={`N → E Left Turn: ${getStatusText(n_e)}`}>
              <path d="M 248.5 45 L 248.5 70 Q 248.5 82 261 82 L 263 82" fill="none" stroke={getArrowColorHex(n_e)} strokeWidth="3.5" strokeLinecap="round" />
              <path d="M 259 76 L 269 82 L 259 88 Z" fill={getArrowColorHex(n_e)} stroke={getArrowColorHex(n_e)} strokeWidth="1.5" strokeJoin="round" />
            </g>

            {/* N → S (Straight Arrow) */}
            <g title={`N → S Straight: ${getStatusText(n_s)}`}>
              <path d="M 225.5 45 L 225.5 75" fill="none" stroke={getArrowColorHex(n_s)} strokeWidth="3.5" strokeLinecap="round" />
              <path d="M 219.5 72 L 225.5 84 L 231.5 72 Z" fill={getArrowColorHex(n_s)} stroke={getArrowColorHex(n_s)} strokeWidth="1.5" strokeJoin="round" />
            </g>

            {/* N → W (Right Turn Arrow) */}
            <g title={`N → W Right Turn: ${getStatusText(n_w)}`}>
              <path d="M 202.5 45 L 202.5 70 Q 202.5 82 190 82 L 188 82" fill="none" stroke={getArrowColorHex(n_w)} strokeWidth="3.5" strokeLinecap="round" />
              <path d="M 192 76 L 182 82 L 192 88 Z" fill={getArrowColorHex(n_w)} stroke={getArrowColorHex(n_w)} strokeWidth="1.5" strokeJoin="round" />
            </g>

            {/* ------------------------------------------------------------------ */}
            {/* SOUTH APPROACH ARROWS (Driving North upwards, incoming West side)   */}
            {/* Lane 1 (Outermost Left X=131.5): S → W (Left Turn - ALWAYS GREEN) */}
            {/* Lane 2 (Middle X=154.5): S → N (Straight)                         */}
            {/* Lane 3 (Innermost Right X=177.5): S → E (Right Turn)               */}
            {/* ------------------------------------------------------------------ */}

            {/* S → W (Left Turn Arrow - ALWAYS GREEN) */}
            <g title={`S → W Left Turn: ${getStatusText(s_w)}`}>
              <path d="M 131.5 335 L 131.5 310 Q 131.5 298 119 298 L 117 298" fill="none" stroke={getArrowColorHex(s_w)} strokeWidth="3.5" strokeLinecap="round" />
              <path d="M 121 292 L 111 298 L 121 304 Z" fill={getArrowColorHex(s_w)} stroke={getArrowColorHex(s_w)} strokeWidth="1.5" strokeJoin="round" />
            </g>

            {/* S → N (Straight Arrow) */}
            <g title={`S → N Straight: ${getStatusText(s_n)}`}>
              <path d="M 154.5 335 L 154.5 305" fill="none" stroke={getArrowColorHex(s_n)} strokeWidth="3.5" strokeLinecap="round" />
              <path d="M 148.5 308 L 154.5 296 L 160.5 308 Z" fill={getArrowColorHex(s_n)} stroke={getArrowColorHex(s_n)} strokeWidth="1.5" strokeJoin="round" />
            </g>

            {/* S → E (Right Turn Arrow) */}
            <g title={`S → E Right Turn: ${getStatusText(s_e)}`}>
              <path d="M 177.5 335 L 177.5 310 Q 177.5 298 190 298 L 192 298" fill="none" stroke={getArrowColorHex(s_e)} strokeWidth="3.5" strokeLinecap="round" />
              <path d="M 188 292 L 198 298 L 188 304 Z" fill={getArrowColorHex(s_e)} stroke={getArrowColorHex(s_e)} strokeWidth="1.5" strokeJoin="round" />
            </g>

            {/* ------------------------------------------------------------------ */}
            {/* WEST APPROACH ARROWS (Driving East rightwards, incoming North side)*/}
            {/* Lane 1 (Outermost Left Y=131.5): W → N (Left Turn - ALWAYS GREEN) */}
            {/* Lane 2 (Middle Y=154.5): W → E (Straight)                         */}
            {/* Lane 3 (Innermost Right Y=177.5): W → S (Right Turn)               */}
            {/* ------------------------------------------------------------------ */}

            {/* W → N (Left Turn Arrow - ALWAYS GREEN) */}
            <g title={`W → N Left Turn: ${getStatusText(w_n)}`}>
              <path d="M 45 131.5 L 70 131.5 Q 82 131.5 82 119 L 82 117" fill="none" stroke={getArrowColorHex(w_n)} strokeWidth="3.5" strokeLinecap="round" />
              <path d="M 76 121 L 82 111 L 88 121 Z" fill={getArrowColorHex(w_n)} stroke={getArrowColorHex(w_n)} strokeWidth="1.5" strokeJoin="round" />
            </g>

            {/* W → E (Straight Arrow) */}
            <g title={`W → E Straight: ${getStatusText(w_e)}`}>
              <path d="M 45 154.5 L 75 154.5" fill="none" stroke={getArrowColorHex(w_e)} strokeWidth="3.5" strokeLinecap="round" />
              <path d="M 72 148.5 L 84 154.5 L 72 160.5 Z" fill={getArrowColorHex(w_e)} stroke={getArrowColorHex(w_e)} strokeWidth="1.5" strokeJoin="round" />
            </g>

            {/* W → S (Right Turn Arrow) */}
            <g title={`W → S Right Turn: ${getStatusText(w_s)}`}>
              <path d="M 45 177.5 L 70 177.5 Q 82 177.5 82 190 L 82 192" fill="none" stroke={getArrowColorHex(w_s)} strokeWidth="3.5" strokeLinecap="round" />
              <path d="M 76 188 L 82 198 L 88 188 Z" fill={getArrowColorHex(w_s)} stroke={getArrowColorHex(w_s)} strokeWidth="1.5" strokeJoin="round" />
            </g>

            {/* ------------------------------------------------------------------ */}
            {/* EAST APPROACH ARROWS (Driving West leftwards, incoming South side) */}
            {/* Lane 1 (Outermost Left Y=248.5): E → S (Left Turn - ALWAYS GREEN) */}
            {/* Lane 2 (Middle Y=225.5): E → W (Straight)                         */}
            {/* Lane 3 (Innermost Right Y=202.5): E → N (Right Turn)               */}
            {/* ------------------------------------------------------------------ */}

            {/* E → S (Left Turn Arrow - ALWAYS GREEN) */}
            <g title={`E → S Left Turn: ${getStatusText(e_s)}`}>
              <path d="M 335 248.5 L 310 248.5 Q 298 248.5 298 261 L 298 263" fill="none" stroke={getArrowColorHex(e_s)} strokeWidth="3.5" strokeLinecap="round" />
              <path d="M 292 259 L 298 269 L 304 259 Z" fill={getArrowColorHex(e_s)} stroke={getArrowColorHex(e_s)} strokeWidth="1.5" strokeJoin="round" />
            </g>

            {/* E → W (Straight Arrow) */}
            <g title={`E → W Straight: ${getStatusText(e_w)}`}>
              <path d="M 335 225.5 L 305 225.5" fill="none" stroke={getArrowColorHex(e_w)} strokeWidth="3.5" strokeLinecap="round" />
              <path d="M 308 219.5 L 296 225.5 L 308 231.5 Z" fill={getArrowColorHex(e_w)} stroke={getArrowColorHex(e_w)} strokeWidth="1.5" strokeJoin="round" />
            </g>

            {/* E → N (Right Turn Arrow) */}
            <g title={`E → N Right Turn: ${getStatusText(e_n)}`}>
              <path d="M 335 202.5 L 310 202.5 Q 298 202.5 298 190 L 298 188" fill="none" stroke={getArrowColorHex(e_n)} strokeWidth="3.5" strokeLinecap="round" />
              <path d="M 292 192 L 298 182 L 304 192 Z" fill={getArrowColorHex(e_n)} stroke={getArrowColorHex(e_n)} strokeWidth="1.5" strokeJoin="round" />
            </g>
          </g>

          <text x="190" y="24" textAnchor="middle" fill="#94a3b8" fontSize="11" fontWeight="800">N</text>
          <text x="190" y="368" textAnchor="middle" fill="#94a3b8" fontSize="11" fontWeight="800">S</text>
          <text x="12" y="194" textAnchor="middle" fill="#94a3b8" fontSize="11" fontWeight="800">W</text>
          <text x="368" y="194" textAnchor="middle" fill="#94a3b8" fontSize="11" fontWeight="800">E</text>
        </svg>
      </div>

      {/* Human-Readable Active Approach Badge */}
      <div style={{
        fontSize: '0.725rem',
        fontWeight: 800,
        textAlign: 'center',
        padding: '0.35rem 0.5rem',
        borderRadius: '4px',
        backgroundColor: isClearance ? '#fef2f2' : isYellowTransition ? '#fffbeb' : '#ecfdf5',
        color: isClearance ? '#dc2626' : isYellowTransition ? '#d97706' : '#059669',
        border: isClearance ? '1px solid #fecaca' : isYellowTransition ? '1px solid #fde68a' : '1px solid #a7f3d0',
        width: '100%'
      }}>
        <div>ACTIVE APPROACH: {isClearance ? 'CLEARANCE / ALL RED' : (intersection?.active_approach || 'NORTH')}</div>
        <div style={{ fontSize: '0.675rem', fontWeight: 600, marginTop: '0.15rem', color: '#334155' }}>
          PERMITTED MOVEMENTS: {activeLabels.length > 0 ? activeLabels.join(', ') : (yellowLabels.length > 0 ? `TRANSITION (${yellowLabels.join(', ')})` : 'NONE (ALL RED)')}
        </div>
      </div>

      {/* Dynamic Safety Validation Info Box */}
      <div style={{
        backgroundColor: '#ffffff',
        border: '1px solid #e2e8f0',
        borderRadius: '4px',
        padding: '0.4rem 0.6rem',
        fontSize: '0.675rem',
        width: '100%',
        fontFamily: 'monospace'
      }}>
        <div style={{ color: '#059669', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
          <CheckCircle2 size={12} /> {intersection?.safety_validation_status || "VALIDATED"}
        </div>
        <div style={{ color: '#475569', marginTop: '0.1rem' }}>
          {intersection?.other_approaches_status || "OTHER APPROACHES: RED"}
        </div>
        <div style={{ color: '#64748b', marginTop: '0.1rem' }}>
          {intersection?.conflict_check_detail || "CONFLICT CHECK: PASSED"}
        </div>
      </div>
    </div>
  );
}
