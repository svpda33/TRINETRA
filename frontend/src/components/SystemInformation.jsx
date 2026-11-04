import React from 'react';

export default function SystemInformation() {
  return (
    <div className="gov-section" id="section-system">
      <div className="gov-section-header">
        <div className="gov-section-title">
          <span>SYSTEM INFORMATION</span>
        </div>
        <span style={{ fontSize: '0.725rem', color: '#64748b', fontFamily: 'monospace' }}>
          ARCHITECTURAL DISCLOSURE
        </span>
      </div>

      <div className="system-info-grid">
        <div>
          <div className="info-item-row">
            <span className="info-label">System Name:</span>
            <span className="info-val">NexTrAI</span>
          </div>
          <div className="info-item-row">
            <span className="info-label">Category:</span>
            <span className="info-val" style={{ color: '#059669', fontWeight: 700 }}>
              Intelligent Transportation Systems (ITS)
            </span>
          </div>
          <div className="info-item-row">
            <span className="info-label">Primary Purpose:</span>
            <span className="info-val" style={{ fontSize: '0.75rem', fontFamily: 'sans-serif' }}>
              Urban Traffic Intelligence & Management Platform
            </span>
          </div>
          <div className="info-item-row">
            <span className="info-label">Deployment Environment:</span>
            <span className="info-val">Production ITMS Prototype</span>
          </div>
        </div>

        <div>
          <div className="info-item-row">
            <span className="info-label">Monitored Corridor:</span>
            <span className="info-val">Hyderabad Smart IT Corridor (Nodes 1-4)</span>
          </div>
          <div className="info-item-row">
            <span className="info-label">ANPR Engine:</span>
            <span className="info-val" style={{ color: '#059669', fontWeight: 600 }}>YOLOv8 + EasyOCR + Indian HSRP Validator</span>
          </div>
          <div className="info-item-row">
            <span className="info-label">GIS Engine:</span>
            <span className="info-val" style={{ color: '#059669', fontWeight: 600 }}>Interactive Leaflet.js Spatial Map</span>
          </div>
          <div className="info-item-row">
            <span className="info-label">Safety & Preemption Layer:</span>
            <span className="info-val" style={{ color: '#2563eb' }}>Deterministic 12-Movement Conflict Validator</span>
          </div>
        </div>
      </div>
    </div>
  );
}
