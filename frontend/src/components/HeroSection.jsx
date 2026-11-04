import React from 'react';

export default function HeroSection() {
  const scrollToSection = (id) => {
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <section className="hero-cover">
      <img
        src="/hero-traffic-signal.jpg"
        alt="Traffic Signal Network"
        className="hero-bg-img"
      />
      <div className="hero-overlay" />

      <div className="hero-content">
        <div className="hero-badge">
          INTELLIGENT TRANSPORTATION SYSTEMS (ITS) • CITY-SCALE PLATFORM
        </div>
        <h1 className="hero-title">NexTrAI</h1>
        <p className="hero-subtitle">
          Urban Traffic Intelligence & Management Platform
        </p>
        <p className="hero-desc">
          Unified intelligent platform integrating high-accuracy license plate OCR, spatial-temporal multi-camera tracking, interactive GIS trajectory reconstruction, and macro-level urban traffic intelligence.
        </p>

        <div className="hero-actions">
          <button
            onClick={() => scrollToSection('section-network')}
            className="hero-btn hero-btn-primary"
          >
            VIEW NETWORK
          </button>
          <button
            onClick={() => scrollToSection('section-events')}
            className="hero-btn hero-btn-secondary"
          >
            EMERGENCY RESPONSE
          </button>
        </div>
      </div>
    </section>
  );
}
