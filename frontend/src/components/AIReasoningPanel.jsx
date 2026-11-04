import React, { useState, useEffect } from 'react';
import {
  Bot, CheckCircle2, XCircle, AlertTriangle, ShieldCheck, Play,
  Zap, BarChart2, Activity, Clock, ArrowRight, Compass, Siren, RotateCcw,
  MessageSquare, Send, Sparkles, FileText, TrendingUp, RefreshCw, HelpCircle
} from 'lucide-react';
import { getApiUrl } from '../config';

export default function AIReasoningPanel() {
  const [activeTab, setActiveTab] = useState('adaptive'); // 'adaptive' | 'corridor' | 'benchmark' | 'cloud_llm'

  // Adaptive Signal State (Stage 3.2)
  const [signalStatusI1, setSignalStatusI1] = useState(null);
  const [signalStatusI2, setSignalStatusI2] = useState(null);
  const [selectedIntersection, setSelectedIntersection] = useState('I1');

  // Benchmark State (Stage 3.2)
  const [benchmarkData, setBenchmarkData] = useState(null);
  const [benchmarkLoading, setBenchmarkLoading] = useState(false);
  const [benchmarkProfile, setBenchmarkProfile] = useState('arterial_corridor_heavy');

  // Corridor Coordination State (Stage 3.4)
  const [progressionData, setProgressionData] = useState(null);
  const [heatmapData, setHeatmapData] = useState(null);

  // Emergency Preemption State (Stage 3.3)
  const [emergencyStatus, setEmergencyStatus] = useState(null);
  const [actionMessage, setActionMessage] = useState(null);

  // Gemini AI Assistant State
  const [aiData, setAiData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [errorState, setErrorState] = useState(null);
  const [geminiStatus, setGeminiStatus] = useState(null);
  const [aiSubTab, setAiSubTab] = useState('chat'); // 'chat' | 'summary' | 'explain' | 'insights' | 'report'
  const [aiSummary, setAiSummary] = useState(null);
  const [aiSummaryLoading, setAiSummaryLoading] = useState(false);
  const [aiExplanation, setAiExplanation] = useState(null);
  const [aiExplainLoading, setAiExplainLoading] = useState(false);
  const [explainIntersection, setExplainIntersection] = useState('I1');
  const [aiInsights, setAiInsights] = useState(null);
  const [aiInsightsLoading, setAiInsightsLoading] = useState(false);
  const [aiIncidentReport, setAiIncidentReport] = useState(null);
  const [aiIncidentLoading, setAiIncidentLoading] = useState(false);
  const [chatMessages, setChatMessages] = useState([
    {
      role: 'assistant',
      content: 'Hello, Operator. I am NexTrAI\'s Gemini Traffic Operations Assistant. I monitor real-time queue densities, green allocations, and corridor coordination across the Cyber Towers - Mindspace corridor. How can I assist you with traffic management today?'
    }
  ]);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);

  // Polling for real-time telemetry
  useEffect(() => {
    const fetchStatus = () => {
      // 1. Adaptive signals
      fetch(getApiUrl(`/api/signals/adaptive/${selectedIntersection}/status`))
        .then(res => res.json())
        .then(data => {
          if (selectedIntersection === 'I1') setSignalStatusI1(data);
          else setSignalStatusI2(data);
        })
        .catch(() => {});

      // 2. Emergency status
      fetch(getApiUrl('/api/priority/emergency/status'))
        .then(res => res.json())
        .then(data => setEmergencyStatus(data))
        .catch(() => {});

      // 3. Corridor heatmap
      fetch(getApiUrl('/api/corridor/heatmap'))
        .then(res => res.json())
        .then(data => setHeatmapData(data))
        .catch(() => {});

      // 4. Corridor progression
      if (!progressionData) {
        fetch(getApiUrl('/api/corridor/progression?speed_kmh=40'))
          .then(res => res.json())
          .then(data => setProgressionData(data))
          .catch(() => {});
      }
    };

    fetchStatus();
    fetchGeminiStatus();
    const interval = setInterval(fetchStatus, 3000);
    return () => clearInterval(interval);
  }, [selectedIntersection, progressionData]);

  // Handle Tick Signal Controller
  const handleTickSignal = (delta = 5.0) => {
    fetch(getApiUrl(`/api/signals/adaptive/${selectedIntersection}/tick`), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ delta_sec: delta })
    })
      .then(res => res.json())
      .then(data => {
        if (selectedIntersection === 'I1') setSignalStatusI1(data);
        else setSignalStatusI2(data);
        setActionMessage(`Advanced ${selectedIntersection} controller by +${delta}s`);
        setTimeout(() => setActionMessage(null), 3000);
      })
      .catch(err => setActionMessage(`Tick failed: ${err.message}`));
  };

  // Handle Emergency Corridor Trigger
  const handleTriggerEmergencyCorridor = () => {
    fetch(getApiUrl('/api/priority/emergency/trigger'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        camera_id: 'CAM_I1_WEST',
        vehicle_class: 'AMBULANCE',
        track_id: Math.floor(1000 + Math.random() * 9000)
      })
    })
      .then(res => res.json())
      .then(data => {
        setActionMessage(`Staged emergency preemption activated: I1 immediate, I2 scheduled for T+61.5s!`);
        // Refresh status
        fetch(getApiUrl('/api/priority/emergency/status'))
          .then(r => r.json())
          .then(d => setEmergencyStatus(d));
        setTimeout(() => setActionMessage(null), 4000);
      })
      .catch(err => setActionMessage(`Preemption trigger failed: ${err.message}`));
  };

  // Handle Emergency Release
  const handleReleaseEmergency = (iid) => {
    fetch(getApiUrl(`/api/priority/emergency/release/${iid}`), {
      method: 'POST'
    })
      .then(res => res.json())
      .then(data => {
        setActionMessage(`Emergency preemption released on ${iid}`);
        fetch(getApiUrl('/api/priority/emergency/status'))
          .then(r => r.json())
          .then(d => setEmergencyStatus(d));
        setTimeout(() => setActionMessage(null), 3000);
      })
      .catch(err => setActionMessage(`Release failed: ${err.message}`));
  };

  // Handle Run Benchmark Comparison
  const handleRunBenchmark = () => {
    setBenchmarkLoading(true);
    fetch(getApiUrl(`/api/signals/benchmark/comparison?simulation_seconds=180&profile=${benchmarkProfile}`))
      .then(res => res.json())
      .then(data => setBenchmarkData(data))
      .catch(err => setActionMessage(`Benchmark failed: ${err.message}`))
      .finally(() => setBenchmarkLoading(false));
  };

  // Handle Fetch Gemini AI Status
  const fetchGeminiStatus = () => {
    fetch(getApiUrl('/api/ai/status'))
      .then(res => res.json())
      .then(data => setGeminiStatus(data))
      .catch(() => {});
  };

  // Handle Fetch Traffic Intelligence Summary
  const handleFetchSummary = () => {
    setAiSummaryLoading(true);
    fetch(getApiUrl('/api/ai/traffic-summary'))
      .then(res => res.json())
      .then(data => setAiSummary(data))
      .catch(err => setAiSummary({ status: 'error', summary: `Summary retrieval failed: ${err.message}` }))
      .finally(() => setAiSummaryLoading(false));
  };

  // Handle Explain Active Signal Decision
  const handleFetchExplanation = (nodeId = explainIntersection) => {
    setAiExplainLoading(true);
    fetch(getApiUrl(`/api/ai/explain-signal/${nodeId}`))
      .then(res => res.json())
      .then(data => setAiExplanation(data))
      .catch(err => setAiExplanation({ status: 'error', explanation: `Signal explanation failed: ${err.message}` }))
      .finally(() => setAiExplainLoading(false));
  };

  // Handle Fetch Congestion Insights
  const handleFetchInsights = () => {
    setAiInsightsLoading(true);
    fetch(getApiUrl('/api/ai/congestion-insights'))
      .then(res => res.json())
      .then(data => setAiInsights(data))
      .catch(err => setAiInsights({ status: 'error', analysis: `Analysis failed: ${err.message}` }))
      .finally(() => setAiInsightsLoading(false));
  };

  // Handle Send Chat Message to Gemini Assistant
  const handleSendChatMessage = (textToSend = null) => {
    const text = (textToSend || chatInput).trim();
    if (!text || chatLoading) return;

    const newHistory = [...chatMessages, { role: 'user', content: text }];
    setChatMessages(newHistory);
    setChatInput('');
    setChatLoading(true);

    fetch(getApiUrl('/api/ai/chat'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: text,
        history: newHistory.slice(-6).map(m => ({ role: m.role, content: m.content }))
      })
    })
      .then(res => res.json())
      .then(data => {
        const replyText = data.reply || data.message || 'No reply from Gemini.';
        setChatMessages(prev => [...prev, { role: 'assistant', content: replyText }]);
      })
      .catch(err => {
        setChatMessages(prev => [
          ...prev,
          { role: 'assistant', content: `Error contacting Gemini Assistant: ${err.message}. Local deterministic controllers remain fully active.` }
        ]);
      })
      .finally(() => setChatLoading(false));
  };

  // Handle Generate Incident Post-Mortem Report
  const handleGenerateReport = () => {
    setAiIncidentLoading(true);
    fetch(getApiUrl('/api/ai/incident-report'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        event_id: 'EVT-CORRIDOR-PREEMPT',
        intersection_id: 'I1',
        type: 'EMERGENCY_AMBULANCE_PREEMPTION',
        severity: 'CRITICAL',
        details: {
          corridor: 'Cyber Towers - Mindspace',
          response_rule: '6-State Preemption FSM + Safety Validator'
        }
      })
    })
      .then(res => res.json())
      .then(data => setAiIncidentReport(data))
      .catch(err => setAiIncidentReport({ status: 'error', report_markdown: `Report generation failed: ${err.message}` }))
      .finally(() => setAiIncidentLoading(false));
  };

  // Handle Legacy Cloud LLM Call (Backwards-compatible)
  const handleComputeAI = () => {
    setLoading(true);
    setErrorState(null);
    setAiData(null);

    fetch(getApiUrl('/api/ai/optimize'), { method: 'POST' })
      .then(res => res.json())
      .then(resData => {
        if (resData.status === 'unconfigured' || resData.data?.status === 'unconfigured') {
          setErrorState({
            type: 'UNCONFIGURED',
            title: 'AI SERVICE NOT CONFIGURED',
            message: resData.data?.message || 'GEMINI_API_KEY environment variable is missing in .env file.'
          });
        } else if (resData.status === 'failed' || resData.data?.status === 'failed') {
          setErrorState({
            type: 'FAILED',
            title: 'AI OPTIMIZATION FAILED',
            message: resData.data?.message || 'AI request encountered an error.'
          });
        } else if (resData.data) {
          setAiData(resData.data);
        }
      })
      .catch(err => {
        setErrorState({
          type: 'ERROR',
          title: 'AI OPTIMIZATION FAILED',
          message: `Network communication error: ${err.message}`
        });
      })
      .finally(() => setLoading(false));
  };

  const activeSignal = selectedIntersection === 'I1' ? signalStatusI1 : signalStatusI2;

  return (
    <div className="gov-section" id="section-ai">
      {/* Header */}
      <div className="gov-section-header">
        <div className="gov-section-title" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <Zap size={18} style={{ color: '#0284c7' }} />
          <span>AUTONOMOUS SIGNAL INTELLIGENCE & CORRIDOR COORDINATION</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          {actionMessage && (
            <span style={{
              fontSize: '0.65rem',
              color: '#10b981',
              fontFamily: 'monospace',
              backgroundColor: '#064e3b',
              padding: '0.2rem 0.5rem',
              borderRadius: '4px',
              border: '1px solid #10b981'
            }}>
              {actionMessage}
            </span>
          )}
          <span style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 600, fontFamily: 'monospace' }}>
            ENGINE: Deterministic State Machine + Safety Layer
          </span>
        </div>
      </div>

      {/* Tab Navigation */}
      <div style={{
        display: 'flex',
        gap: '0.4rem',
        borderBottom: '2px solid #e2e8f0',
        paddingBottom: '0.5rem',
        marginBottom: '1rem',
        flexWrap: 'wrap'
      }}>
        <button
          onClick={() => setActiveTab('adaptive')}
          style={{
            backgroundColor: activeTab === 'adaptive' ? '#0284c7' : '#f1f5f9',
            color: activeTab === 'adaptive' ? '#ffffff' : '#475569',
            border: 'none',
            borderRadius: '4px',
            padding: '0.35rem 0.75rem',
            fontSize: '0.75rem',
            fontWeight: 800,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '0.3rem'
          }}
        >
          <Activity size={14} /> Adaptive Signal Decision (Stage 3.2)
        </button>

        <button
          onClick={() => setActiveTab('corridor')}
          style={{
            backgroundColor: activeTab === 'corridor' ? '#0284c7' : '#f1f5f9',
            color: activeTab === 'corridor' ? '#ffffff' : '#475569',
            border: 'none',
            borderRadius: '4px',
            padding: '0.35rem 0.75rem',
            fontSize: '0.75rem',
            fontWeight: 800,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '0.3rem'
          }}
        >
          <Compass size={14} /> Corridor Progression & Heatmap (Stage 3.4)
        </button>

        <button
          onClick={() => setActiveTab('benchmark')}
          style={{
            backgroundColor: activeTab === 'benchmark' ? '#0284c7' : '#f1f5f9',
            color: activeTab === 'benchmark' ? '#ffffff' : '#475569',
            border: 'none',
            borderRadius: '4px',
            padding: '0.35rem 0.75rem',
            fontSize: '0.75rem',
            fontWeight: 800,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '0.3rem'
          }}
        >
          <BarChart2 size={14} /> Controller Benchmark (Stage 3.2)
        </button>

        <button
          onClick={() => setActiveTab('cloud_llm')}
          style={{
            backgroundColor: activeTab === 'cloud_llm' ? '#0284c7' : '#f1f5f9',
            color: activeTab === 'cloud_llm' ? '#ffffff' : '#475569',
            border: 'none',
            borderRadius: '4px',
            padding: '0.35rem 0.75rem',
            fontSize: '0.75rem',
            fontWeight: 800,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '0.3rem'
          }}
        >
          <Sparkles size={14} style={{ color: activeTab === 'cloud_llm' ? '#ffffff' : '#0284c7' }} /> Gemini AI Copilot & Traffic Intelligence
        </button>
      </div>

      {/* TAB 1: ADAPTIVE SIGNAL DECISION (STAGE 3.2 & 3.3) */}
      {activeTab === 'adaptive' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
          {/* Controls Bar */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            backgroundColor: '#0f172a',
            padding: '0.6rem 0.85rem',
            borderRadius: '6px',
            flexWrap: 'wrap',
            gap: '0.5rem'
          }}>
            {/* Intersection Toggle */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <span style={{ color: '#94a3b8', fontSize: '0.7rem', fontFamily: 'monospace' }}>INTERSECTION:</span>
              <button
                onClick={() => setSelectedIntersection('I1')}
                style={{
                  backgroundColor: selectedIntersection === 'I1' ? '#0284c7' : '#1e293b',
                  color: '#ffffff',
                  border: '1px solid #38bdf8',
                  borderRadius: '3px',
                  padding: '0.2rem 0.5rem',
                  fontSize: '0.7rem',
                  fontWeight: 800,
                  cursor: 'pointer'
                }}
              >
                I1 (Cyber Towers)
              </button>
              <button
                onClick={() => setSelectedIntersection('I2')}
                style={{
                  backgroundColor: selectedIntersection === 'I2' ? '#0284c7' : '#1e293b',
                  color: '#ffffff',
                  border: '1px solid #38bdf8',
                  borderRadius: '3px',
                  padding: '0.2rem 0.5rem',
                  fontSize: '0.7rem',
                  fontWeight: 800,
                  cursor: 'pointer'
                }}
              >
                I2 (Mindspace)
              </button>
            </div>

            {/* Quick Action Buttons */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <button
                onClick={() => handleTickSignal(5.0)}
                style={{
                  backgroundColor: '#1e293b',
                  color: '#38bdf8',
                  border: '1px solid #38bdf8',
                  borderRadius: '3px',
                  padding: '0.25rem 0.55rem',
                  fontSize: '0.65rem',
                  fontWeight: 800,
                  cursor: 'pointer',
                  fontFamily: 'monospace'
                }}
                title="Advance signal state machine by 5 seconds"
              >
                +5s TICK
              </button>
              <button
                onClick={handleTriggerEmergencyCorridor}
                style={{
                  backgroundColor: '#dc2626',
                  color: '#ffffff',
                  border: '1px solid #ef4444',
                  borderRadius: '3px',
                  padding: '0.25rem 0.55rem',
                  fontSize: '0.65rem',
                  fontWeight: 800,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.25rem',
                  fontFamily: 'monospace'
                }}
                title="Simulate ambulance confirmation and corridor preemption"
              >
                <Siren size={12} /> TRIGGER I1→I2 PREEMPTION
              </button>
              {emergencyStatus?.active_preemptions?.[selectedIntersection] && (
                <button
                  onClick={() => handleReleaseEmergency(selectedIntersection)}
                  style={{
                    backgroundColor: '#1e293b',
                    color: '#f59e0b',
                    border: '1px solid #f59e0b',
                    borderRadius: '3px',
                    padding: '0.25rem 0.55rem',
                    fontSize: '0.65rem',
                    fontWeight: 800,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.25rem',
                    fontFamily: 'monospace'
                  }}
                >
                  <RotateCcw size={12} /> CANCEL PREEMPTION
                </button>
              )}
            </div>
          </div>

          {/* Staged Downstream Preemption Banner (Priority 5) */}
          {emergencyStatus?.scheduled_preemptions?.some(s => s.intersection_id === selectedIntersection) && (
            <div style={{
              backgroundColor: '#fffbeb',
              border: '2px solid #f59e0b',
              borderRadius: '6px',
              padding: '0.75rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              color: '#92400e'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Clock size={20} style={{ color: '#d97706' }} />
                <div>
                  <strong style={{ fontSize: '0.8rem', color: '#b45309' }}>
                    STAGED DOWNSTREAM PREEMPTION SCHEDULED FOR {selectedIntersection}
                  </strong>
                  <div style={{ fontSize: '0.675rem', color: '#92400e' }}>
                    Corridor progression active • Clearance starts T+61.5s prior to ambulance arrival (Distance: 850m)
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Active Preemption Alert Banner */}
          {emergencyStatus?.active_preemptions?.[selectedIntersection] && (
            <div style={{
              backgroundColor: '#fef2f2',
              border: '2px solid #ef4444',
              borderRadius: '6px',
              padding: '0.75rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              color: '#991b1b'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Siren size={20} style={{ color: '#dc2626' }} />
                <div>
                  <strong style={{ fontSize: '0.8rem', color: '#dc2626' }}>
                    EMERGENCY PREEMPTION ACTIVE ON {selectedIntersection} ({emergencyStatus.active_preemptions[selectedIntersection].approach} APPROACH)
                  </strong>
                  <div style={{ fontSize: '0.675rem', color: '#7f1d1d' }}>
                    Trigger: {emergencyStatus.active_preemptions[selectedIntersection].vehicle_class} • Clearance transition enforced
                  </div>
                </div>
              </div>
              <button
                onClick={() => handleReleaseEmergency(selectedIntersection)}
                style={{
                  backgroundColor: '#dc2626',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '3px',
                  padding: '0.25rem 0.6rem',
                  fontSize: '0.65rem',
                  fontWeight: 800,
                  cursor: 'pointer'
                }}
              >
                RELEASE
              </button>
            </div>
          )}

          {/* Real Decision State Grid */}
          {activeSignal ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                gap: '0.65rem'
              }}>
                {/* Active Approach Card */}
                <div style={{
                  backgroundColor: '#0f172a',
                  border: '1px solid #334155',
                  borderRadius: '6px',
                  padding: '0.75rem',
                  color: '#ffffff',
                  fontFamily: 'monospace'
                }}>
                  <div style={{ fontSize: '0.65rem', color: '#94a3b8' }}>ACTIVE SIGNAL STATE</div>
                  <div style={{
                    fontSize: '1.05rem',
                    fontWeight: 900,
                    color: activeSignal.interval_state === 'GREEN' ? '#10b981' : (activeSignal.interval_state === 'YELLOW' ? '#f59e0b' : '#ef4444'),
                    marginTop: '0.2rem'
                  }}>
                    {activeSignal.current_approach} {activeSignal.interval_state}
                  </div>
                  <div style={{ fontSize: '0.7rem', color: '#cbd5e1', marginTop: '0.15rem' }}>
                    Elapsed: {activeSignal.interval_elapsed_sec}s • Target: {activeSignal.target_approach || activeSignal.current_approach}
                  </div>
                </div>

                {/* Constraints Card */}
                <div style={{
                  backgroundColor: '#0f172a',
                  border: '1px solid #334155',
                  borderRadius: '6px',
                  padding: '0.75rem',
                  color: '#ffffff',
                  fontFamily: 'monospace'
                }}>
                  <div style={{ fontSize: '0.65rem', color: '#94a3b8' }}>ACTIVE CONSTRAINTS</div>
                  <div style={{ display: 'flex', gap: '0.25rem', flexWrap: 'wrap', marginTop: '0.3rem' }}>
                    {(activeSignal.active_constraints || []).map((c, i) => (
                      <span key={i} style={{
                        backgroundColor: '#1e293b',
                        border: '1px solid #38bdf8',
                        color: '#38bdf8',
                        padding: '0.1rem 0.35rem',
                        borderRadius: '3px',
                        fontSize: '0.6rem',
                        fontWeight: 800
                      }}>
                        {c}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              {/* Explainability Rationale */}
              <div style={{
                backgroundColor: '#f8fafc',
                border: '1px solid #cbd5e1',
                borderRadius: '6px',
                padding: '0.85rem'
              }}>
                <div style={{ fontSize: '0.7rem', fontWeight: 800, color: '#0b2545', fontFamily: 'monospace', textTransform: 'uppercase' }}>
                  Deterministic Decision Rationale & Pressure Telemetry:
                </div>
                <p style={{ marginTop: '0.35rem', color: '#1e293b', fontSize: '0.85rem', lineHeight: 1.45, fontWeight: 600 }}>
                  {activeSignal.decision_reason}
                </p>

                {/* Approach Pressures Meter */}
                <div style={{ marginTop: '0.6rem', display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.5rem' }}>
                  {['NORTH', 'SOUTH', 'EAST', 'WEST'].map((app) => {
                    const p = activeSignal.pressures?.[app] || 0;
                    const q = activeSignal.queue_counts?.[app] || 0;
                    const w = activeSignal.waiting_times?.[app] || 0;
                    const isCur = app === activeSignal.current_approach;
                    return (
                      <div key={app} style={{
                        backgroundColor: isCur ? '#eff6ff' : '#f1f5f9',
                        border: isCur ? '2px solid #0284c7' : '1px solid #cbd5e1',
                        borderRadius: '4px',
                        padding: '0.45rem',
                        textAlign: 'center'
                      }}>
                        <div style={{ fontSize: '0.65rem', fontWeight: 800, color: '#475569' }}>{app}</div>
                        <div style={{ fontSize: '0.9rem', fontWeight: 900, color: isCur ? '#0284c7' : '#0f172a' }}>
                          P: {p}
                        </div>
                        <div style={{ fontSize: '0.6rem', color: '#64748b' }}>
                          Q: {q} | Wait: {w}s
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          ) : (
            <div style={{ color: '#64748b', fontSize: '0.8rem', padding: '1rem', textAlign: 'center' }}>
              Loading adaptive signal status for {selectedIntersection}...
            </div>
          )}
        </div>
      )}

      {/* TAB 2: CORRIDOR PROGRESSION & HEATMAP (STAGE 3.4) */}
      {activeTab === 'corridor' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
          {/* Progression Metric Cards */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: '0.65rem'
          }}>
            <div style={{
              backgroundColor: '#0f172a',
              border: '1px solid #334155',
              borderRadius: '6px',
              padding: '0.75rem',
              color: '#ffffff',
              fontFamily: 'monospace'
            }}>
              <div style={{ fontSize: '0.65rem', color: '#94a3b8' }}>MG ROAD ARTERIAL CORRIDOR</div>
              <div style={{ fontSize: '0.95rem', fontWeight: 900, color: '#38bdf8', marginTop: '0.2rem' }}>
                I1 (Cyber Towers) ↔ I2 (Mindspace)
              </div>
              <div style={{ fontSize: '0.7rem', color: '#cbd5e1', marginTop: '0.15rem' }}>
                Distance: {progressionData?.distance_meters || 850}m • Design Speed: {progressionData?.corridor_speed_kmh || 40} km/h
              </div>
            </div>

            <div style={{
              backgroundColor: '#0f172a',
              border: '1px solid #334155',
              borderRadius: '6px',
              padding: '0.75rem',
              color: '#ffffff',
              fontFamily: 'monospace'
            }}>
              <div style={{ fontSize: '0.65rem', color: '#94a3b8' }}>GREEN-WAVE OFFSET & TRAVEL TIME</div>
              <div style={{ fontSize: '1.05rem', fontWeight: 900, color: '#10b981', marginTop: '0.2rem' }}>
                OFFSET: {progressionData?.ideal_green_wave_offset_sec || 76.5}s
              </div>
              <div style={{ fontSize: '0.7rem', color: '#cbd5e1', marginTop: '0.15rem' }}>
                Platoon Window: [{progressionData?.platoon_arrival_window?.start_sec}s - {progressionData?.platoon_arrival_window?.end_sec}s]
              </div>
            </div>

            <div style={{
              backgroundColor: '#0f172a',
              border: '1px solid #334155',
              borderRadius: '6px',
              padding: '0.75rem',
              color: '#ffffff',
              fontFamily: 'monospace'
            }}>
              <div style={{ fontSize: '0.65rem', color: '#94a3b8' }}>NETWORK CONGESTION INDEX</div>
              <div style={{
                fontSize: '1.05rem',
                fontWeight: 900,
                color: (heatmapData?.network_congestion_index_pct || 0) > 65 ? '#ef4444' : '#38bdf8',
                marginTop: '0.2rem'
              }}>
                {heatmapData?.network_congestion_index_pct || 42.5}% ({heatmapData?.congestion_level || 'MODERATE'})
              </div>
              <div style={{ fontSize: '0.7rem', color: '#cbd5e1', marginTop: '0.15rem' }}>
                Spillback Risk: <strong style={{ color: heatmapData?.spillback_risk === 'HIGH' ? '#ef4444' : '#10b981' }}>{heatmapData?.spillback_risk || 'LOW'}</strong>
              </div>
            </div>
          </div>

          {/* Camera Metrics Table */}
          <div style={{ backgroundColor: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '6px', overflow: 'hidden' }}>
            <div style={{ backgroundColor: '#f1f5f9', padding: '0.5rem 0.75rem', fontWeight: 800, fontSize: '0.75rem', color: '#0b2545', fontFamily: 'monospace' }}>
              INDEPENDENT CCTV CORRIDOR OBSERVATIONS ({heatmapData?.total_independent_cameras || 7} CAMERAS)
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.75rem', fontFamily: 'monospace' }}>
              <thead>
                <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#475569' }}>
                  <th style={{ padding: '0.4rem 0.6rem', textAlign: 'left' }}>CAMERA</th>
                  <th style={{ padding: '0.4rem 0.6rem', textAlign: 'left' }}>INTERSECTION</th>
                  <th style={{ padding: '0.4rem 0.6rem', textAlign: 'left' }}>DIRECTION</th>
                  <th style={{ padding: '0.4rem 0.6rem', textAlign: 'right' }}>QUEUE</th>
                  <th style={{ padding: '0.4rem 0.6rem', textAlign: 'right' }}>PEAK DENSITY</th>
                  <th style={{ padding: '0.4rem 0.6rem', textAlign: 'right' }}>CROSSINGS</th>
                  <th style={{ padding: '0.4rem 0.6rem', textAlign: 'center' }}>STATUS</th>
                </tr>
              </thead>
              <tbody>
                {(heatmapData?.per_camera_metrics || []).map((m, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '0.35rem 0.6rem', fontWeight: 700, color: '#0284c7' }}>{m.camera_id}</td>
                    <td style={{ padding: '0.35rem 0.6rem' }}>{m.intersection_id}</td>
                    <td style={{ padding: '0.35rem 0.6rem' }}>{m.direction}</td>
                    <td style={{ padding: '0.35rem 0.6rem', textAlign: 'right', fontWeight: 800 }}>{m.queue_count} veh</td>
                    <td style={{ padding: '0.35rem 0.6rem', textAlign: 'right' }}>{Math.round(m.peak_lane_density_pct)}%</td>
                    <td style={{ padding: '0.35rem 0.6rem', textAlign: 'right', color: '#10b981' }}>{m.stop_line_crossings}</td>
                    <td style={{ padding: '0.35rem 0.6rem', textAlign: 'center' }}>
                      <span style={{
                        backgroundColor: m.is_congested ? '#fef2f2' : '#ecfdf5',
                        color: m.is_congested ? '#dc2626' : '#059669',
                        padding: '0.1rem 0.35rem',
                        borderRadius: '3px',
                        fontSize: '0.65rem',
                        fontWeight: 700
                      }}>
                        {m.is_congested ? 'CONGESTED' : 'NORMAL'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: CONTROLLER BENCHMARK (STAGE 3.2) */}
      {activeTab === 'benchmark' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <strong style={{ fontSize: '0.85rem', color: '#0b2545' }}>
                Traffic Signal Controller Benchmark Simulation
              </strong>
              <div style={{ fontSize: '0.725rem', color: '#64748b' }}>
                Deterministic comparative analysis across Pre-Timed, Semi-Actuated, and NexTrAI Adaptive models.
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <select
                value={benchmarkProfile}
                onChange={(e) => setBenchmarkProfile(e.target.value)}
                style={{
                  backgroundColor: '#ffffff',
                  border: '1px solid #cbd5e1',
                  borderRadius: '4px',
                  padding: '0.35rem 0.5rem',
                  fontSize: '0.7rem',
                  fontWeight: 600,
                  color: '#1e293b'
                }}
              >
                <option value="arterial_corridor_heavy">Profile: Arterial Corridor Heavy (Commuter)</option>
                <option value="balanced_all_approach">Profile: Balanced All-Approach (Uniform)</option>
                <option value="off_peak">Profile: Off-Peak (Low Demand)</option>
              </select>
              <button
                onClick={handleRunBenchmark}
                disabled={benchmarkLoading}
                style={{
                  backgroundColor: benchmarkLoading ? '#475569' : '#0284c7',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '4px',
                  padding: '0.4rem 0.85rem',
                  fontSize: '0.75rem',
                  fontWeight: 800,
                  cursor: benchmarkLoading ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.35rem'
                }}
              >
                {benchmarkLoading ? 'RUNNING BENCHMARK...' : 'RUN BENCHMARK (180s)'}
              </button>
            </div>
          </div>

          {benchmarkData ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {/* Equal Capacity Audit Banner */}
              {benchmarkData.methodology_audit && (
                <div style={{
                  backgroundColor: '#f8fafc',
                  border: '1px solid #cbd5e1',
                  borderRadius: '6px',
                  padding: '0.65rem 0.85rem',
                  fontSize: '0.725rem',
                  color: '#334155'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontWeight: 800, color: '#0369a1' }}>
                    <ShieldCheck size={16} /> METHODOLOGY AUDIT: {benchmarkData.methodology_audit.status}
                  </div>
                  <div style={{ marginTop: '0.2rem', color: '#475569' }}>
                    Policy: {benchmarkData.methodology_audit.saturation_discharge_policy}
                  </div>
                  <div style={{ marginTop: '0.2rem', color: '#b91c1c', fontWeight: 700 }}>
                    Historical Audit Note: {benchmarkData.methodology_audit.previous_asymmetric_benchmark}
                  </div>
                </div>
              )}

              {/* Highlight Cards */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.65rem' }}>
                <div style={{ backgroundColor: '#ecfdf5', border: '1px solid #a7f3d0', borderRadius: '4px', padding: '0.65rem', textAlign: 'center' }}>
                  <div style={{ fontSize: '0.65rem', color: '#065f46', fontWeight: 700 }}>AVERAGE DELAY REDUCTION</div>
                  <div style={{ fontSize: '1.25rem', fontWeight: 900, color: '#059669', marginTop: '0.2rem' }}>
                    -{benchmarkData.performance_comparison?.delay_reduction_vs_fixed_time_pct}%
                  </div>
                  <div style={{ fontSize: '0.65rem', color: '#047857' }}>vs Fixed-Time Pre-Timed Cycle</div>
                </div>

                <div style={{ backgroundColor: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '4px', padding: '0.65rem', textAlign: 'center' }}>
                  <div style={{ fontSize: '0.65rem', color: '#1e40af', fontWeight: 700 }}>THROUGHPUT INCREASE</div>
                  <div style={{ fontSize: '1.25rem', fontWeight: 900, color: '#2563eb', marginTop: '0.2rem' }}>
                    +{benchmarkData.performance_comparison?.throughput_improvement_vs_fixed_time_pct}%
                  </div>
                  <div style={{ fontSize: '0.65rem', color: '#1d4ed8' }}>More vehicles cleared per hour</div>
                </div>

                <div style={{ backgroundColor: '#fefce8', border: '1px solid #fef08a', borderRadius: '4px', padding: '0.65rem', textAlign: 'center' }}>
                  <div style={{ fontSize: '0.65rem', color: '#854d0e', fontWeight: 700 }}>WASTED GREEN ELIMINATED</div>
                  <div style={{ fontSize: '1.25rem', fontWeight: 900, color: '#ca8a04', marginTop: '0.2rem' }}>
                    -{benchmarkData.performance_comparison?.wasted_green_reduction_pct}%
                  </div>
                  <div style={{ fontSize: '0.65rem', color: '#a16207' }}>Reduced empty phase waiting</div>
                </div>
              </div>

              {/* Models Comparison Table */}
              <div style={{ backgroundColor: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '6px', overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.75rem', fontFamily: 'monospace' }}>
                  <thead>
                    <tr style={{ backgroundColor: '#f1f5f9', borderBottom: '1px solid #cbd5e1', color: '#334155' }}>
                      <th style={{ padding: '0.5rem 0.75rem', textAlign: 'left' }}>CONTROLLER MODEL</th>
                      <th style={{ padding: '0.5rem 0.75rem', textAlign: 'right' }}>AVG DELAY (s/veh)</th>
                      <th style={{ padding: '0.5rem 0.75rem', textAlign: 'right' }}>THROUGHPUT (veh)</th>
                      <th style={{ padding: '0.5rem 0.75rem', textAlign: 'right' }}>HOURLY RATE (veh/hr)</th>
                      <th style={{ padding: '0.5rem 0.75rem', textAlign: 'right' }}>WASTED GREEN (s)</th>
                      <th style={{ padding: '0.5rem 0.75rem', textAlign: 'right' }}>CLEARANCE EFFICIENCY</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(benchmarkData.models || {}).map(([mKey, mVal]) => {
                      const isAdaptive = mKey === 'NEXTRAI_ADAPTIVE';
                      return (
                        <tr key={mKey} style={{
                          backgroundColor: isAdaptive ? '#f0fdf4' : '#ffffff',
                          borderBottom: '1px solid #e2e8f0',
                          fontWeight: isAdaptive ? 800 : 500
                        }}>
                          <td style={{ padding: '0.45rem 0.75rem', color: isAdaptive ? '#059669' : '#0f172a' }}>
                            {mVal.model_name}
                          </td>
                          <td style={{ padding: '0.45rem 0.75rem', textAlign: 'right', color: isAdaptive ? '#059669' : '#0f172a' }}>
                            {mVal.average_delay_sec_per_veh}s
                          </td>
                          <td style={{ padding: '0.45rem 0.75rem', textAlign: 'right' }}>
                            {mVal.total_throughput_vehicles}
                          </td>
                          <td style={{ padding: '0.45rem 0.75rem', textAlign: 'right' }}>
                            {mVal.throughput_hourly_rate}
                          </td>
                          <td style={{ padding: '0.45rem 0.75rem', textAlign: 'right' }}>
                            {mVal.wasted_green_seconds}s
                          </td>
                          <td style={{ padding: '0.45rem 0.75rem', textAlign: 'right', color: isAdaptive ? '#059669' : '#0f172a' }}>
                            {mVal.queue_clearance_efficiency_pct}%
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Statistical Variance Breakdown (Stage 3.6.E) */}
              {benchmarkData.statistical_distributions && (
                <div style={{
                  backgroundColor: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: '6px',
                  padding: '0.65rem 0.85rem',
                  fontSize: '0.72rem',
                  color: '#334155'
                }}>
                  <div style={{ fontWeight: 800, color: '#0f172a', marginBottom: '0.35rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                    <ShieldCheck size={14} color="#0284c7" />
                    Monte Carlo Statistical Distribution (N={benchmarkData.seeds_evaluated?.length || 5} Seeds: {benchmarkData.seeds_evaluated?.join(', ') || '42, 101, 777, 2024, 9999'})
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.5rem' }}>
                    {Object.entries(benchmarkData.statistical_distributions).map(([key, stats]) => (
                      <div key={key} style={{ backgroundColor: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '4px', padding: '0.45rem' }}>
                        <div style={{ fontWeight: 700, fontSize: '0.68rem', color: key === 'NEXTRAI_ADAPTIVE' ? '#059669' : '#475569' }}>
                          {key.replace('_', ' ')}
                        </div>
                        <div style={{ fontSize: '0.7rem', marginTop: '0.15rem' }}>
                          Mean Delay: <strong>{stats.delay_sec?.mean}s</strong> (σ=±{stats.delay_sec?.std_dev}s)
                        </div>
                        <div style={{ fontSize: '0.7rem', color: '#64748b' }}>
                          Median: {stats.delay_sec?.median}s • Max Q: {stats.max_queue_vehicles} veh
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div style={{ color: '#64748b', fontSize: '0.8rem', padding: '1rem', textAlign: 'center', backgroundColor: '#f8fafc', border: '1px dashed #cbd5e1', borderRadius: '4px' }}>
              Click <strong>"RUN BENCHMARK (180s CYCLE)"</strong> to execute the multi-model comparison simulation.
            </div>
          )}
        </div>
      )}

      {/* TAB 4: GEMINI AI COPILOT & TRAFFIC INTELLIGENCE */}
      {activeTab === 'cloud_llm' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
          {/* Top Status & Capabilities Navigation Bar */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            backgroundColor: '#0b2545',
            color: '#f8fafc',
            padding: '0.65rem 0.85rem',
            borderRadius: '6px',
            flexWrap: 'wrap',
            gap: '0.5rem'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
              <div style={{
                backgroundColor: geminiStatus?.gemini_configured ? '#065f46' : '#7f1d1d',
                color: geminiStatus?.gemini_configured ? '#34d399' : '#fca5a5',
                border: `1px solid ${geminiStatus?.gemini_configured ? '#059669' : '#dc2626'}`,
                borderRadius: '4px',
                padding: '0.2rem 0.5rem',
                fontSize: '0.68rem',
                fontWeight: 800,
                display: 'flex',
                alignItems: 'center',
                gap: '0.35rem'
              }}>
                <Sparkles size={12} />
                <span>PROVIDER: {geminiStatus?.provider?.toUpperCase() || 'GEMINI AI'}</span>
                <span>({geminiStatus?.model || 'gemini-3.5-flash'})</span>
              </div>

              <span style={{ fontSize: '0.7rem', color: '#94a3b8', fontFamily: 'monospace' }}>
                STATUS: {geminiStatus?.status || 'INITIALIZING'}
              </span>
            </div>

            {/* Sub-Feature Tab Switcher */}
            <div style={{ display: 'flex', gap: '0.3rem', flexWrap: 'wrap' }}>
              {[
                { id: 'chat', label: 'OPERATOR CHAT', icon: MessageSquare },
                { id: 'summary', label: 'TRAFFIC SUMMARY', icon: FileText },
                { id: 'explain', label: 'EXPLAIN SIGNAL', icon: HelpCircle },
                { id: 'insights', label: 'CONGESTION INSIGHTS', icon: TrendingUp },
                { id: 'report', label: 'INCIDENT REPORT', icon: AlertTriangle },
                { id: 'reasoning', label: 'SAFETY VALIDATION PLAN', icon: ShieldCheck }
              ].map(item => {
                const isSelected = aiSubTab === item.id;
                const Icon = item.icon || Sparkles;
                return (
                  <button
                    key={item.id}
                    onClick={() => setAiSubTab(item.id)}
                    style={{
                      backgroundColor: isSelected ? '#0284c7' : 'rgba(255, 255, 255, 0.08)',
                      color: isSelected ? '#ffffff' : '#cbd5e1',
                      border: 'none',
                      borderRadius: '4px',
                      padding: '0.25rem 0.55rem',
                      fontSize: '0.68rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.3rem',
                      transition: 'all 0.2s'
                    }}
                  >
                    <Icon size={12} />
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* SUBTAB 1: OPERATOR CHAT COPILOT */}
          {aiSubTab === 'chat' && (
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              backgroundColor: '#ffffff',
              border: '1px solid #cbd5e1',
              borderRadius: '6px',
              overflow: 'hidden'
            }}>
              {/* Chat Header */}
              <div style={{
                backgroundColor: '#f8fafc',
                borderBottom: '1px solid #e2e8f0',
                padding: '0.55rem 0.85rem',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.75rem', fontWeight: 700, color: '#0b2545' }}>
                  <MessageSquare size={14} color="#0284c7" />
                  <span>Natural Language Traffic Operations Co-Pilot</span>
                </div>
                <span style={{ fontSize: '0.68rem', color: '#64748b' }}>
                  Advisory Mode • Physical Signals Controlled by Deterministic Engine
                </span>
              </div>

              {/* Chat Message Scroll Area */}
              <div style={{
                padding: '0.85rem',
                height: '280px',
                overflowY: 'auto',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.65rem',
                backgroundColor: '#f8fafc'
              }}>
                {chatMessages.map((msg, idx) => {
                  const isUser = msg.role === 'user';
                  return (
                    <div
                      key={idx}
                      style={{
                        display: 'flex',
                        justifyContent: isUser ? 'flex-end' : 'flex-start'
                      }}
                    >
                      <div style={{
                        maxWidth: '82%',
                        backgroundColor: isUser ? '#0284c7' : '#ffffff',
                        color: isUser ? '#ffffff' : '#1e293b',
                        border: isUser ? 'none' : '1px solid #cbd5e1',
                        borderRadius: isUser ? '8px 8px 0 8px' : '8px 8px 8px 0',
                        padding: '0.6rem 0.85rem',
                        fontSize: '0.78rem',
                        lineHeight: '1.45',
                        boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
                        whiteSpace: 'pre-wrap'
                      }}>
                        {!isUser && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', color: '#0284c7', fontWeight: 800, fontSize: '0.68rem', marginBottom: '0.25rem' }}>
                            <Sparkles size={11} />
                            <span>GEMINI TRAFFIC COPILOT</span>
                          </div>
                        )}
                        {msg.content}
                      </div>
                    </div>
                  );
                })}
                {chatLoading && (
                  <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
                    <div style={{
                      backgroundColor: '#ffffff',
                      border: '1px solid #cbd5e1',
                      borderRadius: '8px 8px 8px 0',
                      padding: '0.5rem 0.85rem',
                      fontSize: '0.75rem',
                      color: '#0284c7',
                      fontFamily: 'monospace',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.4rem'
                    }}>
                      <RefreshCw size={12} className="spin" />
                      <span>Gemini is evaluating corridor telemetry...</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Suggested Quick Prompt Chips */}
              <div style={{
                backgroundColor: '#ffffff',
                borderTop: '1px solid #e2e8f0',
                padding: '0.45rem 0.85rem',
                display: 'flex',
                gap: '0.4rem',
                flexWrap: 'wrap'
              }}>
                <span style={{ fontSize: '0.68rem', color: '#64748b', alignSelf: 'center', fontWeight: 600 }}>Try:</span>
                {[
                  "Status of Cyber Towers (I1)?",
                  "Why is West approach waiting on I1?",
                  "Is ambulance corridor clear?",
                  "Recommend timing adjust for evening rush"
                ].map((prompt, i) => (
                  <button
                    key={i}
                    onClick={() => handleSendChatMessage(prompt)}
                    style={{
                      backgroundColor: '#f1f5f9',
                      color: '#0369a1',
                      border: '1px solid #e2e8f0',
                      borderRadius: '12px',
                      padding: '0.15rem 0.55rem',
                      fontSize: '0.68rem',
                      cursor: 'pointer'
                    }}
                  >
                    {prompt}
                  </button>
                ))}
              </div>

              {/* Input Field + Send Button */}
              <div style={{
                display: 'flex',
                gap: '0.5rem',
                padding: '0.6rem 0.85rem',
                backgroundColor: '#ffffff',
                borderTop: '1px solid #e2e8f0'
              }}>
                <input
                  type="text"
                  placeholder="Ask Gemini AI about live queues, green allocations, corridors, or safety status..."
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSendChatMessage()}
                  style={{
                    flex: 1,
                    border: '1px solid #cbd5e1',
                    borderRadius: '4px',
                    padding: '0.45rem 0.75rem',
                    fontSize: '0.75rem',
                    outline: 'none'
                  }}
                />
                <button
                  onClick={() => handleSendChatMessage()}
                  disabled={chatLoading || !chatInput.trim()}
                  style={{
                    backgroundColor: chatLoading || !chatInput.trim() ? '#94a3b8' : '#0284c7',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '4px',
                    padding: '0.45rem 0.85rem',
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    cursor: chatLoading || !chatInput.trim() ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.35rem'
                  }}
                >
                  <Send size={13} />
                  <span>SEND</span>
                </button>
              </div>
            </div>
          )}

          {/* SUBTAB 2: TRAFFIC INTELLIGENCE SUMMARY */}
          {aiSubTab === 'summary' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
                  Real-time narrative operational summary computed directly from live corridor telemetry.
                </span>
                <button
                  onClick={handleFetchSummary}
                  disabled={aiSummaryLoading}
                  style={{
                    backgroundColor: aiSummaryLoading ? '#94a3b8' : '#0284c7',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '4px',
                    padding: '0.35rem 0.75rem',
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    cursor: aiSummaryLoading ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.35rem'
                  }}
                >
                  <RefreshCw size={12} className={aiSummaryLoading ? 'spin' : ''} />
                  <span>{aiSummaryLoading ? 'GENERATING SUMMARY...' : 'GENERATE AI SUMMARY'}</span>
                </button>
              </div>

              {aiSummary ? (
                <div style={{
                  backgroundColor: '#ffffff',
                  border: '1px solid #cbd5e1',
                  borderRadius: '6px',
                  padding: '1rem',
                  fontSize: '0.8rem',
                  color: '#1e293b',
                  lineHeight: '1.5'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', borderBottom: '1px solid #f1f5f9', paddingBottom: '0.4rem' }}>
                    <span style={{ fontWeight: 800, color: '#0b2545' }}>CORRIDOR INTELLIGENCE BRIEF</span>
                    <span style={{
                      backgroundColor: '#ecfdf5',
                      color: '#059669',
                      padding: '0.1rem 0.4rem',
                      borderRadius: '3px',
                      fontSize: '0.68rem',
                      fontWeight: 700
                    }}>
                      STATUS: {aiSummary.corridor_status}
                    </span>
                  </div>
                  <div style={{ whiteSpace: 'pre-wrap' }}>{aiSummary.summary}</div>
                </div>
              ) : (
                <div style={{
                  color: '#64748b',
                  fontSize: '0.78rem',
                  padding: '1.5rem',
                  textAlign: 'center',
                  backgroundColor: '#ffffff',
                  border: '1px dashed #cbd5e1',
                  borderRadius: '6px'
                }}>
                  Click <strong>"GENERATE AI SUMMARY"</strong> to request a live narrative assessment of network conditions.
                </div>
              )}
            </div>
          )}

          {/* SUBTAB 3: EXPLAIN SIGNAL DECISION */}
          {aiSubTab === 'explain' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600 }}>SELECT INTERSECTION:</span>
                  <select
                    value={explainIntersection}
                    onChange={(e) => setExplainIntersection(e.target.value)}
                    style={{
                      border: '1px solid #cbd5e1',
                      borderRadius: '4px',
                      padding: '0.3rem 0.5rem',
                      fontSize: '0.72rem',
                      fontWeight: 700,
                      color: '#0b2545'
                    }}
                  >
                    <option value="I1">I1 — Cyber Towers Junction</option>
                    <option value="I2">I2 — Hitec City / Mindspace Junction</option>
                    <option value="I3">I3 — Bio-Diversity Junction</option>
                    <option value="I4">I4 — Gachibowli Junction</option>
                  </select>
                </div>

                <button
                  onClick={() => handleFetchExplanation(explainIntersection)}
                  disabled={aiExplainLoading}
                  style={{
                    backgroundColor: aiExplainLoading ? '#94a3b8' : '#0284c7',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '4px',
                    padding: '0.35rem 0.75rem',
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    cursor: aiExplainLoading ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.35rem'
                  }}
                >
                  <Sparkles size={12} />
                  <span>{aiExplainLoading ? 'EXPLAINING DECISION...' : 'EXPLAIN ACTIVE SIGNAL DECISION'}</span>
                </button>
              </div>

              {aiExplanation ? (
                <div style={{
                  backgroundColor: '#ffffff',
                  border: '1px solid #cbd5e1',
                  borderRadius: '6px',
                  padding: '1rem',
                  fontSize: '0.8rem',
                  color: '#1e293b',
                  lineHeight: '1.5'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', borderBottom: '1px solid #f1f5f9', paddingBottom: '0.4rem' }}>
                    <span style={{ fontWeight: 800, color: '#0b2545' }}>
                      {aiExplanation.node_name || explainIntersection} — SIGNAL RATIONALE
                    </span>
                    <span style={{
                      backgroundColor: '#f0fdf4',
                      color: '#059669',
                      padding: '0.1rem 0.4rem',
                      borderRadius: '3px',
                      fontSize: '0.68rem',
                      fontWeight: 700
                    }}>
                      ACTIVE: {aiExplanation.active_approach} ({aiExplanation.phase_state})
                    </span>
                  </div>
                  <div style={{ whiteSpace: 'pre-wrap' }}>{aiExplanation.explanation}</div>
                </div>
              ) : (
                <div style={{
                  color: '#64748b',
                  fontSize: '0.78rem',
                  padding: '1.5rem',
                  textAlign: 'center',
                  backgroundColor: '#ffffff',
                  border: '1px dashed #cbd5e1',
                  borderRadius: '6px'
                }}>
                  Select an intersection and click <strong>"EXPLAIN ACTIVE SIGNAL DECISION"</strong> to analyze green phase allocation.
                </div>
              )}
            </div>
          )}

          {/* SUBTAB 4: CONGESTION INSIGHTS */}
          {aiSubTab === 'insights' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
                  Macro-level corridor bottleneck assessment and flow efficiency analysis.
                </span>
                <button
                  onClick={handleFetchInsights}
                  disabled={aiInsightsLoading}
                  style={{
                    backgroundColor: aiInsightsLoading ? '#94a3b8' : '#0284c7',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '4px',
                    padding: '0.35rem 0.75rem',
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    cursor: aiInsightsLoading ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.35rem'
                  }}
                >
                  <TrendingUp size={12} />
                  <span>{aiInsightsLoading ? 'ANALYZING CORRIDOR...' : 'ANALYZE CORRIDOR BOTTLENECKS'}</span>
                </button>
              </div>

              {aiInsights ? (
                <div style={{
                  backgroundColor: '#ffffff',
                  border: '1px solid #cbd5e1',
                  borderRadius: '6px',
                  padding: '1rem',
                  fontSize: '0.8rem',
                  color: '#1e293b'
                }}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.5rem', marginBottom: '0.75rem' }}>
                    <div style={{ backgroundColor: '#f0fdf4', border: '1px solid #86efac', borderRadius: '4px', padding: '0.5rem' }}>
                      <span style={{ fontSize: '0.68rem', color: '#166534', fontWeight: 700 }}>FLOW EFFICIENCY SCORE</span>
                      <div style={{ fontSize: '1.25rem', fontWeight: 900, color: '#15803d' }}>
                        {aiInsights.flow_efficiency_score}%
                      </div>
                    </div>
                    <div style={{ backgroundColor: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: '4px', padding: '0.5rem' }}>
                      <span style={{ fontSize: '0.68rem', color: '#475569', fontWeight: 700 }}>KEY BOTTLENECK NODES</span>
                      <div style={{ fontSize: '0.85rem', fontWeight: 800, color: '#0f172a', marginTop: '2px' }}>
                        {(aiInsights.bottlenecks || []).join(', ') || 'None detected'}
                      </div>
                    </div>
                  </div>
                  <div style={{ whiteSpace: 'pre-wrap', lineHeight: '1.5' }}>{aiInsights.analysis}</div>
                </div>
              ) : (
                <div style={{
                  color: '#64748b',
                  fontSize: '0.78rem',
                  padding: '1.5rem',
                  textAlign: 'center',
                  backgroundColor: '#ffffff',
                  border: '1px dashed #cbd5e1',
                  borderRadius: '6px'
                }}>
                  Click <strong>"ANALYZE CORRIDOR BOTTLENECKS"</strong> to evaluate arterial traffic progression.
                </div>
              )}
            </div>
          )}

          {/* SUBTAB 5: INCIDENT REPORT GENERATOR */}
          {aiSubTab === 'report' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
                  Automated generation of formal markdown incident documentation for emergency preemption events.
                </span>
                <button
                  onClick={handleGenerateReport}
                  disabled={aiIncidentLoading}
                  style={{
                    backgroundColor: aiIncidentLoading ? '#94a3b8' : '#0284c7',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '4px',
                    padding: '0.35rem 0.75rem',
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    cursor: aiIncidentLoading ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.35rem'
                  }}
                >
                  <FileText size={12} />
                  <span>{aiIncidentLoading ? 'GENERATING REPORT...' : 'GENERATE INCIDENT REPORT'}</span>
                </button>
              </div>

              {aiIncidentReport ? (
                <div style={{
                  backgroundColor: '#ffffff',
                  border: '1px solid #cbd5e1',
                  borderRadius: '6px',
                  padding: '1rem',
                  fontSize: '0.8rem',
                  color: '#1e293b'
                }}>
                  <div style={{ fontWeight: 800, color: '#0b2545', marginBottom: '0.5rem', borderBottom: '1px solid #f1f5f9', paddingBottom: '0.4rem' }}>
                    REPORT ID: {aiIncidentReport.report_id}
                  </div>
                  <div style={{ whiteSpace: 'pre-wrap', fontFamily: 'Segoe UI, sans-serif', lineHeight: '1.5' }}>
                    {aiIncidentReport.report_markdown}
                  </div>
                </div>
              ) : (
                <div style={{
                  color: '#64748b',
                  fontSize: '0.78rem',
                  padding: '1.5rem',
                  textAlign: 'center',
                  backgroundColor: '#ffffff',
                  border: '1px dashed #cbd5e1',
                  borderRadius: '6px'
                }}>
                  Click <strong>"GENERATE INCIDENT REPORT"</strong> to produce formal post-mortem documentation.
                </div>
              )}
            </div>
          )}

          {/* SUBTAB 6: SAFETY VALIDATION REASONING PLAN (STAGE 3.2 BACKWARDS-COMPATIBLE) */}
          {aiSubTab === 'reasoning' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
                  Safety Layer Dual-Phase Verification: Evaluates AI proposals against Deterministic Rule #1.
                </span>
                <button
                  onClick={handleComputeAI}
                  disabled={loading}
                  style={{
                    backgroundColor: loading ? '#475569' : '#0284c7',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '4px',
                    padding: '0.35rem 0.75rem',
                    fontSize: '0.75rem',
                    fontWeight: 800,
                    cursor: loading ? 'not-allowed' : 'pointer'
                  }}
                >
                  {loading ? 'ANALYZING...' : 'RUN SAFETY VALIDATION PLAN'}
                </button>
              </div>

              {loading ? (
                <div style={{ textAlign: 'center', padding: '1.5rem', color: '#38bdf8', fontFamily: 'monospace' }}>
                  RUNNING AI SAFETY VALIDATION OPTIMIZATION...
                </div>
              ) : errorState ? (
                <div style={{ backgroundColor: '#fef2f2', border: '2px solid #fecaca', borderRadius: '6px', padding: '1rem', display: 'flex', gap: '0.75rem' }}>
                  <AlertTriangle size={24} style={{ color: '#dc2626', flexShrink: 0 }} />
                  <div>
                    <strong style={{ color: '#dc2626' }}>{errorState.title}</strong>
                    <p style={{ color: '#991b1b', fontSize: '0.75rem', margin: '0.2rem 0' }}>{errorState.message}</p>
                  </div>
                </div>
              ) : aiData ? (
                <div style={{ backgroundColor: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '6px', padding: '0.85rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem', borderBottom: '1px solid #f1f5f9', paddingBottom: '0.35rem' }}>
                    <strong style={{ color: '#0b2545', fontSize: '0.85rem' }}>PROPOSED APPROACH: {aiData.approach}</strong>
                    <span style={{
                      backgroundColor: aiData.safety_validation?.is_approved ? '#ecfdf5' : '#fef2f2',
                      color: aiData.safety_validation?.is_approved ? '#059669' : '#dc2626',
                      padding: '0.15rem 0.45rem',
                      borderRadius: '3px',
                      fontSize: '0.7rem',
                      fontWeight: 800
                    }}>
                      {aiData.safety_validation?.is_approved ? 'APPROVED BY SAFETY LAYER' : 'REJECTED'}
                    </span>
                  </div>

                  <p style={{ color: '#334155', fontSize: '0.8rem', marginTop: '0.25rem' }}>
                    <strong>RATIONALE:</strong> {aiData.reason}
                  </p>

                  <div style={{ marginTop: '0.5rem', backgroundColor: '#f8fafc', padding: '0.5rem', borderRadius: '4px', fontSize: '0.72rem', color: '#475569' }}>
                    <strong>SAFETY VERDICT:</strong> {aiData.safety_validation?.verdict}
                  </div>
                </div>
              ) : (
                <div style={{ color: '#64748b', fontSize: '0.8rem', padding: '1.5rem', textAlign: 'center', backgroundColor: '#ffffff', border: '1px dashed #cbd5e1', borderRadius: '6px' }}>
                  Click <strong>"RUN SAFETY VALIDATION PLAN"</strong> to evaluate AI multi-intersection coordination.
                </div>
              )}
            </div>
          )}

          {/* Safety Disclosure Banner */}
          <div style={{
            backgroundColor: '#eff6ff',
            border: '1px solid #bfdbfe',
            borderRadius: '4px',
            padding: '0.45rem 0.75rem',
            fontSize: '0.68rem',
            color: '#1e40af',
            display: 'flex',
            alignItems: 'center',
            gap: '0.4rem'
          }}>
            <ShieldCheck size={14} style={{ color: '#2563eb', flexShrink: 0 }} />
            <span>
              <strong>SAFETY INVARIANT:</strong> Gemini AI functions strictly as a diagnostic, intelligence, and explanatory assistant. Traffic signal switching, clearance timing (yellow/all-red), and preemption are deterministically controlled and safety-validated (IRC:67).
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
