import React, { useState, useEffect, useRef } from 'react';
import Header from './components/Header';
import Navigation from './components/Navigation';
import HeroSection from './components/HeroSection';
import NetworkOverview from './components/NetworkOverview';
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
  const wsRef = useRef(null);

  const fetchState = () => {
    fetch(getApiUrl('/api/simulation/state'))
      .then(res => res.json())
      .then(data => {
        if (data.topology?.intersections) {
          const filtered = data.topology.intersections.filter(
            i => i.intersection_id === 'I1' || i.intersection_id === 'I2'
          );
          setIntersections(filtered);
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
            const filtered = data.intersections.filter(
              i => i.intersection_id === 'I1' || i.intersection_id === 'I2'
            );
            setIntersections(filtered);
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
      {/* Fixed Subtle Background Watermark Image */}
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
        {/* System Overview Panels */}
        <NetworkOverview 
          activeIntersectionsCount={intersections.length || 2}
          activeEvents={activeEvents}
          activeCorridors={activeCorridors}
        />

        {/* Traffic Network Status */}
        <TrafficNetworkMap intersections={intersections} />

        {/* Live Event Monitor */}
        <EventMonitor 
          activeEvents={activeEvents}
          onClearEvents={handleClearEvents}
        />

        {/* Signal Status */}
        <SignalStatus intersections={intersections} />

        {/* Deterministic Safety Test Suite for Judges */}
        <SafetyTestPanel />

        {/* CCTV Camera Stream Feeds */}
        <CameraFeedMonitor
          intersections={intersections}
          onTriggerVisionDetection={fetchState}
          onReturnHome={handleReturnHome}
        />

        {/* Autonomous AI Reasoning Layer */}
        <AIReasoningPanel />

        {/* System Information Disclosure */}
        <SystemInformation />
      </main>

      {/* Institutional Footer */}
      <footer className="gov-footer">
        <div>
          <strong>TRINETRA</strong> — Emergency-Aware, Self-Healing Traffic Signal Network
        </div>
        <div>
          Hackathon Prototype Demonstration | For Research and Evaluation Purposes
        </div>
        <div style={{ marginTop: '0.25rem', fontSize: '0.725rem', color: '#64748b' }}>
          © 2026 Trinetra. All rights reserved.
        </div>
      </footer>
    </div>
  );
}
