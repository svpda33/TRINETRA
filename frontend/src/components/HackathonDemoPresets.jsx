import React from 'react';

export default function HackathonDemoPresets({ onTriggerEvent, onClearEvents }) {
  return (
    <div className="gov-section">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.6rem', borderBottom: '1px solid #e2e8f0', paddingBottom: '0.4rem' }}>
        <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#0b2545', textTransform: 'uppercase' }}>
          SCENARIO SIMULATION PRESETS (1-CLICK DEMO)
        </span>
        <span style={{ fontSize: '0.7rem', color: '#64748b', fontFamily: 'monospace' }}>
          PRIORITY ORDER: P1 &gt; P2 &gt; P3 &gt; P4 &gt; P5
        </span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.5rem' }}>
        <button onClick={() => onTriggerEvent('EMERGENCY_VEHICLE', 'I1')} className="gov-btn gov-btn-danger" style={{ fontSize: '0.725rem', justifyContent: 'center' }}>
          P1: Ambulance (I1)
        </button>

        <button onClick={() => onTriggerEvent('VULNERABLE_ROAD_USER', 'I2')} className="gov-btn gov-btn-warning" style={{ fontSize: '0.725rem', justifyContent: 'center' }}>
          P2: Pedestrians (I2)
        </button>

        <button onClick={() => onTriggerEvent('WANTED_VEHICLE', 'I3')} className="gov-btn" style={{ fontSize: '0.725rem', justifyContent: 'center' }}>
          P3: Suspect Car (I3)
        </button>

        <button onClick={() => onTriggerEvent('ACCIDENT', 'I1')} className="gov-btn" style={{ backgroundColor: '#6d28d9', borderColor: '#5b21b6', fontSize: '0.725rem', justifyContent: 'center' }}>
          P4: Crash Lockdown (I1)
        </button>

        <button onClick={() => onTriggerEvent('TRANSIT', 'I4')} className="gov-btn" style={{ backgroundColor: '#047857', borderColor: '#065f46', fontSize: '0.725rem', justifyContent: 'center' }}>
          P5: City Bus (I4)
        </button>

        <button onClick={onClearEvents} className="gov-btn gov-btn-secondary" style={{ fontSize: '0.725rem', justifyContent: 'center' }}>
          Reset Baseline
        </button>
      </div>
    </div>
  );
}
