import React from 'react';
import { Clock, Play, Pause, RotateCcw } from 'lucide-react';

export default function Header({ backendConnected, isSimulating, onStartSim, onStopSim, onClearSim }) {
  return (
    <>
      {/* Formal Top Bar */}
      <div className="gov-top-bar">
        <div className="top-bar-left">
          <strong style={{ letterSpacing: '0.05em' }}>TRAFFIC MANAGEMENT INFORMATION SYSTEM (TMIS)</strong>
          <span>|</span>
          <span className="prototype-tag">HACKATHON PROTOTYPE DEMONSTRATION</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', fontFamily: 'monospace' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
            <Clock size={12} /> IST (UTC+5:30)
          </span>
          <span>|</span>
          <span>VERSION 1.0</span>
        </div>
      </div>

      {/* Main Header with Hyderabad Traffic Police Emblem Logo */}
      <header className="header-bar">
        <div className="header-brand">
          <div style={{
            backgroundColor: '#ffffff',
            padding: '2px 4px',
            borderRadius: '4px',
            display: 'flex',
            alignItems: 'center',
            justify: 'center',
            boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
            height: '48px'
          }}>
            <img 
              src="/logo.jpg" 
              alt="Hyderabad Traffic Police Emblem" 
              style={{ height: '44px', width: 'auto', borderRadius: '2px', objectFit: 'contain' }}
              onError={(e) => {
                // Fallback if logo.jpg is not found
                e.target.src = '/tg.jpeg';
              }}
            />
          </div>
          <div className="title-group">
            <h1>TRINETRA</h1>
            <p>Autonomous Emergency-Aware Traffic Signal Network</p>
          </div>
        </div>

        {/* Operational Status & Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', backgroundColor: '#1b365d', padding: '0.3rem 0.5rem', borderRadius: '3px', border: '1px solid rgba(255,255,255,0.15)' }}>
            {isSimulating ? (
              <button onClick={onStopSim} className="gov-btn gov-btn-warning" style={{ fontSize: '0.725rem', padding: '0.2rem 0.5rem' }}>
                <Pause size={12} /> PAUSE CYCLE
              </button>
            ) : (
              <button onClick={onStartSim} className="gov-btn" style={{ fontSize: '0.725rem', padding: '0.2rem 0.5rem', backgroundColor: '#059669' }}>
                <Play size={12} /> RUN CYCLE
              </button>
            )}
            <button onClick={onClearSim} className="gov-btn gov-btn-secondary" style={{ fontSize: '0.725rem', padding: '0.2rem 0.5rem' }}>
              <RotateCcw size={12} /> RESET
            </button>
          </div>

          <div className="header-status-badge">
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#059669' }} />
            <span>Network Status: OPERATIONAL</span>
          </div>
        </div>
      </header>
    </>
  );
}
