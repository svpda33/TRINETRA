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
          PUBLIC SAFETY & TRAFFIC INFRASTRUCTURE
        </div>
        <h1 className="hero-title">TRINETRA</h1>
        <p className="hero-subtitle">
          Autonomous Emergency-Aware Traffic Signal Network
        </p>
        <p className="hero-desc">
          AI-powered coordination of connected traffic signals for safer and faster emergency response.
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
