import React, { useState, useEffect, useRef } from 'react';
import Header from './components/Header';
import Navigation from './components/Navigation';
import HeroSection from './components/HeroSection';
import NetworkOverview from './components/NetworkOverview';
import GISTrajectoryMap from './components/GISTrajectoryMap';
import PlateTrajectorySearch from './components/PlateTrajectorySearch';
import ANPRSightingsFeed from './components/ANPRSightingsFeed';
import TrafficAnalyticsPanel from './components/TrafficAnalyticsPanel';
import WatchlistManager from './components/WatchlistManager';
import TrafficNetworkMap from './components/TrafficNetworkMap';
import EventMonitor from './components/EventMonitor';
import SignalStatus from './components/SignalStatus';
import SafetyTestPanel from './components/SafetyTestPanel';
import CameraFeedMonitor from './components/CameraFeedMonitor';
import AIReasoningPanel from './components/AIReasoningPanel';
import SystemInformation from './components/SystemInformation';
import { getApiUrl, getWsUrl } from './config';

export default function App() {
  const [backendConnected, setBackendConnected] = useState(false);
  const [intersections, setIntersections] = useState([]);
  const [activeEvents, setActiveEvents] = useState([]);
  const [activeCorridors, setActiveCorridors] = useState([]);
  const [isSimulating, setIsSimulating] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');
  const [activeTrajectory, setActiveTrajectory] = useState(null);
  const wsRef = useRef(null);

  const fetchState = () => {
    fetch(getApiUrl('/api/simulation/state'))
      .then(res => res.json())
      .then(data => {
        if (data.topology?.intersections) {
          setIntersections(data.topology.intersections);
          setActiveCorridors(data.topology.active_corridors || []);
        }
        if (data.active_events) {
          setActiveEvents(data.active_events);
        }
        setIsSimulating(data.is_running);
      })
      .catch(err => console.warn('Simulation state fetch error:', err));
  };

  useEffect(() => {
    fetch(getApiUrl('/api/health'))
      .then(res => res.json())
      .then(data => {
        if (data.status === 'ok') {
          setBackendConnected(true);
        }
      })
      .catch(() => setBackendConnected(false));

    fetchState();

    const intervalId = setInterval(fetchState, 1000);

    const wsUrl = getWsUrl();
    
    try {
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.intersections) {
            setIntersections(data.intersections);
            setActiveCorridors(data.active_corridors || []);
          }
        } catch (e) {
          console.warn('WS message parse error:', e);
        }
      };
    } catch (err) {
      console.warn('WebSocket connection error:', err);
    }

    return () => {
      clearInterval(intervalId);
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, []);

  const handleStartSim = () => {
    fetch(getApiUrl('/api/simulation/start'), { method: 'POST' }).then(fetchState);
  };

  const handleStopSim = () => {
    fetch(getApiUrl('/api/simulation/stop'), { method: 'POST' }).then(fetchState);
  };

  const handleClearEvents = () => {
    fetch(getApiUrl('/api/simulation/clear'), { method: 'POST' })
      .then(() => fetch(getApiUrl('/api/vision/clear-detections'), { method: 'POST' }))
      .then(fetchState);
  };

  const handleSelectPlateForTracking = (plate) => {
    fetch(getApiUrl(`/api/trajectories/${plate}`))
      .then(res => res.json())
      .then(resData => {
        if (resData.status === 'success' && resData.data) {
          setActiveTrajectory(resData.data);
          const gisElem = document.getElementById('section-gis');
          if (gisElem) {
            gisElem.scrollIntoView({ behavior: 'smooth' });
          }
        }
      })
      .catch(err => console.warn('Failed to load plate trajectory:', err));
  };

  const handleReturnHome = () => {
    setActiveTab('overview');
    const elem = document.getElementById('section-overview');
    if (elem) {
      elem.scrollIntoView({ behavior: 'smooth' });
    } else {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  return (
    <div className="app-container">
      {/* Fixed Background Watermark Image */}
      <img 
        src="/logo.jpg" 
        alt="" 
        className="bg-watermark-overlay" 
        onError={(e) => { e.target.src = '/tg.jpeg'; }} 
      />

      {/* Formal Header */}
      <Header 
        backendConnected={backendConnected} 
        isSimulating={isSimulating}
        onStartSim={handleStartSim}
        onStopSim={handleStopSim}
        onClearSim={handleClearEvents}
      />

      {/* Government Portal Horizontal Navigation */}
      <Navigation activeTab={activeTab} setActiveTab={setActiveTab} />

      {/* Full-Width Hero Cover Section */}
      <HeroSection />

      <main className="dashboard-main">
        {/* 1. System Overview & KPI Metrics */}
        <NetworkOverview 
          activeIntersectionsCount={4}
          activeEvents={activeEvents}
          activeCorridors={activeCorridors}
        />

        {/* 2. Real GIS Spatial Trajectory Map (Hyderabad Smart Corridor) */}
        <GISTrajectoryMap 
          activeTrajectory={activeTrajectory}
          onSelectPlate={handleSelectPlateForTracking}
        />

        {/* 3. Single Plate Trajectory Reconstruction Engine */}
        <PlateTrajectorySearch 
          onTrajectoryLoaded={setActiveTrajectory}
          currentTrajectory={activeTrajectory}
        />

        {/* 4. Real ANPR / OCR Recognition Stream & Empirical Benchmark */}
        <ANPRSightingsFeed 
          onSelectPlate={handleSelectPlateForTracking}
        />

        {/* 5. Urban Traffic Flow Analytics & Macro Intelligence */}
        <TrafficAnalyticsPanel />

        {/* 6. Security Watchlist & Real-Time Alert Engine */}
        <WatchlistManager />

        {/* 7. CCTV Multi-Camera Grid (Preserved) */}
        <CameraFeedMonitor
          intersections={intersections}
          onTriggerVisionDetection={fetchState}
          onReturnHome={handleReturnHome}
        />

        {/* 8. 4-Way Left-Hand Traffic (LHT) Intersection Visualizers (Preserved) */}
        <TrafficNetworkMap intersections={intersections} />

        {/* 9. Live Event Monitor Table (Preserved) */}
        <EventMonitor 
          activeEvents={activeEvents}
          onClearEvents={handleClearEvents}
        />

        {/* 10. Signal Status & Movement Permitted States (Preserved) */}
        <SignalStatus intersections={intersections} />

        {/* 11. Deterministic Movement Safety Test Suite for Judges (Preserved) */}
        <SafetyTestPanel />

        {/* 12. Autonomous AI Reasoning Layer via Featherless (Preserved) */}
        <AIReasoningPanel />

        {/* 13. System Information Disclosure (Preserved) */}
        <SystemInformation />
      </main>

      {/* Institutional Footer */}
      <footer className="gov-footer">
        <div>
          <strong>NexTrAI</strong> — City-Wide AI Engine for Multi-Camera ANPR Trajectory Tracking & Urban Traffic Analytics
        </div>
        <div>
          Bharat Electronics Limited (BEL) | Smart India Hackathon PS 26127 Prototype
        </div>
        <div style={{ marginTop: '0.25rem', fontSize: '0.725rem', color: '#64748b' }}>
          © 2026 NexTrAI. All rights reserved.
        </div>
      </footer>
    </div>
  );
}
