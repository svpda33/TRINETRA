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
            <span className="info-val">Trinetra</span>
          </div>
          <div className="info-item-row">
            <span className="info-label">Primary Purpose:</span>
            <span className="info-val" style={{ fontSize: '0.75rem', fontFamily: 'sans-serif' }}>
              Emergency-Aware, Self-Healing Traffic Signal Network
            </span>
          </div>
          <div className="info-item-row">
            <span className="info-label">Deployment Environment:</span>
            <span className="info-val">Hackathon Prototype</span>
          </div>
        </div>

        <div>
          <div className="info-item-row">
            <span className="info-label">Simulated Network:</span>
            <span className="info-val">4 Connected Intersections (I1 - I4)</span>
          </div>
          <div className="info-item-row">
            <span className="info-label">AI Coordination Layer:</span>
            <span className="info-val" style={{ color: '#2563eb' }}>Planned (Featherless API Integration)</span>
          </div>
          <div className="info-item-row">
            <span className="info-label">Computer Vision Pipeline:</span>
            <span className="info-val" style={{ color: '#2563eb' }}>Planned (Ultralytics YOLO / OpenCV)</span>
          </div>
          <div className="info-item-row">
            <span className="info-label">Traffic Hardware Interface:</span>
            <span className="info-val" style={{ color: '#d97706' }}>Simulation Only</span>
          </div>
        </div>
      </div>
    </div>
  );
}
