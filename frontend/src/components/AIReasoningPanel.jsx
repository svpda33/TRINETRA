import React, { useState } from 'react';
import { Bot, CheckCircle2, XCircle, AlertTriangle, ShieldCheck, Play } from 'lucide-react';
import { getApiUrl } from '../config';

export default function AIReasoningPanel() {
  const [aiData, setAiData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [errorState, setErrorState] = useState(null);

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
            message: resData.data?.message || 'FEATHERLESS_API_KEY environment variable is missing in .env file.'
          });
        } else if (resData.status === 'failed' || resData.data?.status === 'failed') {
          setErrorState({
            type: 'FAILED',
            title: 'AI OPTIMIZATION FAILED',
            message: resData.data?.message || 'Featherless API request encountered an error.'
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

  return (
    <div className="gov-section" id="section-ai">
      {/* Header */}
      <div className="gov-section-header">
        <div className="gov-section-title" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <Bot size={18} style={{ color: '#0284c7' }} />
          <span>AUTONOMOUS AI COORDINATION</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <span style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 600, fontFamily: 'monospace' }}>
            MODEL: Meta-Llama-3.1-70B-Instruct (Featherless API)
          </span>
          <button
            onClick={handleComputeAI}
            disabled={loading}
            className="gov-btn"
            style={{
              backgroundColor: loading ? '#475569' : '#0284c7',
              borderColor: '#0369a1',
              color: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              gap: '0.35rem'
            }}
          >
            {loading ? (
              <>
                <span className="spinner" style={{ width: '12px', height: '12px', borderRadius: '50%', border: '2px solid #ffffff', borderTopColor: 'transparent', display: 'inline-block', animation: 'spin 1s linear infinite' }} />
                ANALYZING NETWORK...
              </>
            ) : (
              <>
                <Play size={13} /> Run AI Optimization
              </>
            )}
          </button>
        </div>
      </div>

      {/* Main Body */}
      {loading ? (
        <div style={{
          backgroundColor: '#0f172a',
          border: '1px solid #334155',
          borderRadius: '6px',
          padding: '1.5rem',
          textAlign: 'center',
          color: '#38bdf8',
          fontFamily: 'monospace',
          fontSize: '0.85rem',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '0.5rem'
        }}>
          <div style={{ fontWeight: 800, letterSpacing: '1px' }}>RUNNING AI OPTIMIZATION...</div>
          <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Collecting live network telemetry state across I1 & I2</div>
          <div style={{ fontSize: '0.7rem', color: '#64748b' }}>Querying Featherless API → Evaluating Safety Validator</div>
        </div>
      ) : errorState ? (
        /* Error Panel (Unconfigured or Request Failed) */
        <div style={{
          backgroundColor: '#fef2f2',
          border: '2px solid #fecaca',
          borderRadius: '6px',
          padding: '1rem',
          display: 'flex',
          alignItems: 'flex-start',
          gap: '0.75rem'
        }}>
          <AlertTriangle size={24} style={{ color: '#dc2626', flexShrink: 0, marginTop: '2px' }} />
          <div>
            <div style={{ color: '#dc2626', fontWeight: 800, fontSize: '0.875rem', fontFamily: 'monospace' }}>
              {errorState.title}
            </div>
            <div style={{ color: '#991b1b', fontSize: '0.775rem', marginTop: '0.25rem', lineHeight: 1.4 }}>
              {errorState.message}
            </div>
            {errorState.type === 'UNCONFIGURED' && (
              <div style={{ color: '#7f1d1d', fontSize: '0.7rem', fontFamily: 'monospace', marginTop: '0.4rem', backgroundColor: '#fee2e2', padding: '0.4rem 0.6rem', borderRadius: '4px', border: '1px solid #fca5a5' }}>
                To configure Featherless AI: Copy <code>.env.example</code> to <code>.env</code> and populate <code>FEATHERLESS_API_KEY</code>.
              </div>
            )}
          </div>
        </div>
      ) : aiData ? (
        /* AI Decision & Rationale Card */
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
          {/* Network State Header */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.65rem' }}>
            <div style={{ backgroundColor: '#0f172a', border: '1px solid #334155', borderRadius: '4px', padding: '0.65rem', color: '#ffffff', fontFamily: 'monospace' }}>
              <div style={{ fontSize: '0.65rem', color: '#94a3b8' }}>AI DECISION & PRIORITY</div>
              <div style={{ fontSize: '0.9rem', fontWeight: 800, color: '#38bdf8', marginTop: '0.15rem' }}>
                {aiData.decision} ({aiData.priority})
              </div>
              <div style={{ fontSize: '0.7rem', color: '#cbd5e1', marginTop: '0.1rem' }}>
                Source: Node {aiData.source_intersection} ({aiData.approach} Approach)
              </div>
            </div>

            <div style={{ backgroundColor: '#0f172a', border: '1px solid #334155', borderRadius: '4px', padding: '0.65rem', color: '#ffffff', fontFamily: 'monospace' }}>
              <div style={{ fontSize: '0.65rem', color: '#94a3b8' }}>TARGET INTERSECTIONS</div>
              <div style={{ fontSize: '0.85rem', fontWeight: 800, color: '#10b981', marginTop: '0.15rem' }}>
                {(aiData.target_intersections || []).join(', ')}
              </div>
              <div style={{ fontSize: '0.7rem', color: '#cbd5e1', marginTop: '0.1rem' }}>
                Corridor Preemption Coordinated
              </div>
            </div>
          </div>

          {/* AI Decision Rationale */}
          <div style={{ backgroundColor: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: '4px', padding: '0.75rem' }}>
            <strong style={{ color: '#0b2545', fontSize: '0.75rem', fontFamily: 'monospace', textTransform: 'uppercase' }}>
              AI Rationale & Situation Analysis:
            </strong>
            <p style={{ marginTop: '0.25rem', color: '#334155', fontSize: '0.825rem', lineHeight: 1.45 }}>
              {aiData.reason}
            </p>
          </div>

          {/* Recommended Actions & Safety Validation */}
          <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '0.85rem' }}>
            {/* Recommended Actions */}
            <div style={{ backgroundColor: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: '4px', padding: '0.75rem' }}>
              <div style={{ fontSize: '0.7rem', fontWeight: 800, color: '#0b2545', fontFamily: 'monospace', textTransform: 'uppercase', marginBottom: '0.35rem' }}>
                Recommended Actions
              </div>
              <ul style={{ margin: 0, paddingLeft: '1.1rem', color: '#334155', fontSize: '0.775rem', display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                {(aiData.recommended_actions || []).map((action, idx) => (
                  <li key={idx}>{action}</li>
                ))}
              </ul>
            </div>

            {/* Safety Validation Check */}
            <div style={{
              backgroundColor: aiData.safety_validation?.is_approved ? '#ecfdf5' : '#fef2f2',
              border: aiData.safety_validation?.is_approved ? '1px solid #a7f3d0' : '1px solid #fecaca',
              borderRadius: '4px',
              padding: '0.75rem'
            }}>
              <div style={{ fontSize: '0.7rem', fontWeight: 800, color: aiData.safety_validation?.is_approved ? '#059669' : '#dc2626', fontFamily: 'monospace', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                <ShieldCheck size={14} /> Safety Layer Validation
              </div>
              <div style={{ fontSize: '0.85rem', fontWeight: 800, color: aiData.safety_validation?.is_approved ? '#059669' : '#dc2626', marginTop: '0.2rem' }}>
                {aiData.safety_validation?.is_approved ? 'APPROVED' : 'REJECTED'}
              </div>
              <div style={{ fontSize: '0.725rem', color: '#334155', marginTop: '0.2rem', lineHeight: 1.35 }}>
                {aiData.safety_validation?.verdict}
              </div>
              <div style={{ fontSize: '0.675rem', color: '#64748b', fontFamily: 'monospace', marginTop: '0.25rem' }}>
                {aiData.safety_validation?.rule_enforced}
              </div>
            </div>
          </div>

          {/* Execution Plan Footer */}
          <div style={{ backgroundColor: '#0f172a', border: '1px solid #334155', borderRadius: '4px', padding: '0.65rem', fontSize: '0.75rem', fontFamily: 'monospace', color: '#cbd5e1' }}>
            <strong style={{ color: '#38bdf8' }}>EXECUTION PLAN:</strong> {aiData.execution_plan}
          </div>
        </div>
      ) : (
        /* Standby State */
        <div style={{ color: '#64748b', fontSize: '0.8rem', padding: '1rem', textAlign: 'center', backgroundColor: '#f8fafc', border: '1px border-subtle #cbd5e1', borderRadius: '4px' }}>
          Click <strong>"Run AI Optimization"</strong> to evaluate Featherless LLM multi-intersection decision telemetry across I1 & I2.
        </div>
      )}

      {/* Embedded CSS Spinner Animation */}
      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
