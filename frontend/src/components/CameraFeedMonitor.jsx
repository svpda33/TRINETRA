import React, { useState, useEffect, useRef } from 'react';
import { Maximize2, X, Video, AlertTriangle, VideoOff } from 'lucide-react';
import { getApiUrl } from '../config';

export default function CameraFeedMonitor({ intersections = [], onTriggerVisionDetection, onReturnHome }) {
  const [activeSlide, setActiveSlide] = useState('I1');
  const [fullscreenCam, setFullscreenCam] = useState(null);
  const [currentTime, setCurrentTime] = useState('');
  const [apiDetections, setApiDetections] = useState({});
  const [videoErrors, setVideoErrors] = useState({});

  const videoRefs = useRef({});
  const modalVideoRef = useRef(null);

  const handleVideoError = (camId) => {
    setVideoErrors(prev => ({ ...prev, [camId]: true }));
  };

  // Define 4 Cameras per Intersection (Total 8 Cameras across I1 & I2)
  const cameraConfig = {
    I1: {
      intersectionId: 'I1',
      name: 'Main St & 1st Ave',
      crossStreet: '1st Ave',
      mainStreet: 'Main St',
      cameras: [
        { camId: 'CAM_I1_NORTH', dir: 'NORTH', backendCamId: 'CAM_I1', videoSrc: '/videos/I1_NORTH.mp4' },
        { camId: 'CAM_I1_SOUTH', dir: 'SOUTH', backendCamId: 'CAM_I1', videoSrc: '/videos/I1_SOUTH.mp4' },
        { camId: 'CAM_I1_EAST',  dir: 'EAST',  backendCamId: 'CAM_I1', videoSrc: '/videos/I1_EAST.mp4' },
        { camId: 'CAM_I1_WEST',  dir: 'WEST',  backendCamId: 'CAM_I1', videoSrc: '/videos/I1_WEST.mp4' }
      ]
    },
    I2: {
      intersectionId: 'I2',
      name: 'Main St & 2nd Ave',
      crossStreet: '2nd Ave',
      mainStreet: 'Main St',
      cameras: [
        { camId: 'CAM_I2_NORTH', dir: 'NORTH', backendCamId: 'CAM_I2', videoSrc: '/videos/I2_NORTH.mp4' },
        { camId: 'CAM_I2_SOUTH', dir: 'SOUTH', backendCamId: 'CAM_I2', videoSrc: '/videos/I2_SOUTH.mp4' },
        { camId: 'CAM_I2_EAST',  dir: 'EAST',  backendCamId: 'CAM_I2', videoSrc: '/videos/I2_EAST.mp4' },
        { camId: 'CAM_I2_WEST',  dir: 'WEST',  backendCamId: 'CAM_I2', videoSrc: '/videos/I2_WEST.mp4' }
      ]
    }
  };

  // Priority Level Definitions and Ranks (P1 > P2 > P3 > P4 > P5 > NORMAL)
  const PRIORITY_TIERS = {
    EMERGENCY_VEHICLE:    { rank: 1, tier: 'P1', phaseLabel: 'P1 PREEMPTION' },
    VULNERABLE_ROAD_USER: { rank: 2, tier: 'P2', phaseLabel: 'P2 PREEMPTION' },
    WANTED_VEHICLE:       { rank: 3, tier: 'P3', phaseLabel: 'P3 PREEMPTION' },
    ACCIDENT:             { rank: 4, tier: 'P4', phaseLabel: 'P4 INCIDENT' },
    TRANSIT:              { rank: 5, tier: 'P5', phaseLabel: 'P5 TRANSIT PRIORITY' },
    NORMAL:               { rank: 6, tier: 'NORMAL', phaseLabel: 'NORMAL CYCLE' }
  };

  // Derived state model helper for a camera feed based on authoritative signal telemetry & priority arbitration
  const getCameraContext = (camObj, intersectionData) => {
    if (!camObj) {
      return {
        isPlaying: false,
        isGreen: false,
        isCurrentApproach: false,
        hudSignal: '[SIGNAL: RED — TRAFFIC HALTED]',
        phaseLabel: 'NORMAL CYCLE',
        overlayTag: null,
        effectivePriority: PRIORITY_TIERS.NORMAL
      };
    }

    const activeApproach = intersectionData?.active_approach || 'NORTH';
    const timerState = intersectionData?.timer_state || 'GREEN';
    const currentPriorityKey = intersectionData?.current_priority || 'NORMAL';
    const isCurrentApproach = (camObj.dir === activeApproach);

    // Resolve CV detection priority if active on this camera feed
    const rawDet = apiDetections[camObj.backendCamId];
    const rawDetLabel = rawDet ? (rawDet.class_label || rawDet.vehicle_type || '').toUpperCase() : '';

    let activePriorityKey = currentPriorityKey;
    if (rawDetLabel.includes('AMBULANCE') || rawDetLabel.includes('FIRE')) {
      activePriorityKey = 'EMERGENCY_VEHICLE';
    } else if (rawDetLabel.includes('PEDESTRIAN')) {
      activePriorityKey = 'VULNERABLE_ROAD_USER';
    } else if (rawDetLabel.includes('POLICE') || rawDetLabel.includes('CHASE')) {
      activePriorityKey = 'WANTED_VEHICLE';
    } else if (rawDetLabel.includes('ACCIDENT') || rawDetLabel.includes('COLLISION')) {
      activePriorityKey = 'ACCIDENT';
    } else if (rawDetLabel.includes('BUS')) {
      activePriorityKey = 'TRANSIT';
    }

    const effectivePriority = PRIORITY_TIERS[activePriorityKey] || PRIORITY_TIERS.NORMAL;

    // Strict GREEN signal condition: Active approach and GREEN phase state
    // Yellow and All-Red clearance are transition states (RED/PAUSED)
    const isGreen = isCurrentApproach && (timerState === 'GREEN');

    // Playback Decision Order (Part 19):
    // 1. Blocked by P4 incident -> PAUSE, [FEED HALTED: P4 INCIDENT LANE LOCK]
    // 2. Held by higher priority conflicting phase -> PAUSE, [FEED PAUSED: HELD FOR HIGHER PRIORITY (P{tier})]
    // 3. Granted active GREEN approach -> PLAY, [SIGNAL: GREEN — TRAFFIC ACTIVE]
    // 4. RED / YELLOW / ALL_RED -> PAUSE, [SIGNAL: RED — TRAFFIC HALTED]

    let isPlaying = false;
    let overlayTag = null;

    if (activePriorityKey === 'ACCIDENT' && !isCurrentApproach) {
      isPlaying = false;
      overlayTag = '[FEED HALTED: P4 INCIDENT LANE LOCK]';
    } else if (effectivePriority.rank < 6 && !isCurrentApproach) {
      isPlaying = false;
      overlayTag = `[FEED PAUSED: HELD FOR HIGHER PRIORITY (${effectivePriority.tier})]`;
    } else if (isGreen) {
      isPlaying = true;
      overlayTag = null;
    } else {
      isPlaying = false;
      overlayTag = null;
    }

    const hudSignal = isPlaying ? '[SIGNAL: GREEN — TRAFFIC ACTIVE]' : '[SIGNAL: RED — TRAFFIC HALTED]';

    return {
      isPlaying,
      isGreen,
      isCurrentApproach,
      hudSignal,
      phaseLabel: effectivePriority.phaseLabel,
      overlayTag,
      effectivePriority,
      timerState
    };
  };

  // Programmatic Play/Pause Synchronization based on Authoritative Signal State & Priority Preemption
  useEffect(() => {
    Object.keys(cameraConfig).forEach(intersectionId => {
      const interData = intersections.find(i => i.intersection_id === intersectionId);
      cameraConfig[intersectionId].cameras.forEach(cam => {
        const vidEl = videoRefs.current[cam.camId];
        if (vidEl) {
          const { isPlaying } = getCameraContext(cam, interData);
          if (isPlaying) {
            vidEl.play().catch(() => {});
          } else {
            vidEl.pause();
          }
        }
      });
    });

    if (fullscreenCam && modalVideoRef.current) {
      const interData = intersections.find(i => i.intersection_id === fullscreenCam.intersectionId);
      const { isPlaying } = getCameraContext(fullscreenCam, interData);
      if (isPlaying) {
        modalVideoRef.current.play().catch(() => {});
      } else {
        modalVideoRef.current.pause();
      }
    }
  }, [intersections, apiDetections, fullscreenCam, activeSlide]);

  // Helper to resolve detection details and automatic priority
  const getDetectionDetails = (det) => {
    if (!det) return null;
    const rawLabel = (det.class_label || det.vehicle_type || '').toUpperCase();

    if (rawLabel.includes('AMBULANCE')) {
      return {
        title: 'AMBULANCE DETECTED',
        subtitle: 'EMERGENCY VEHICLE',
        priority: 'PRIORITY P1',
        color: '#dc2626',
        confidence: det.confidence || 0.94,
        speed: det.estimated_speed_kmh || 68
      };
    }
    if (rawLabel.includes('FIRE') || rawLabel.includes('TRUCK')) {
      return {
        title: 'FIRE ENGINE DETECTED',
        subtitle: 'EMERGENCY VEHICLE',
        priority: 'PRIORITY P1',
        color: '#dc2626',
        confidence: det.confidence || 0.96,
        speed: det.estimated_speed_kmh || 58
      };
    }
    return {
      title: `${rawLabel} DETECTED`,
      subtitle: 'AUTOMATIC CV EVENT',
      priority: 'PRIORITY P1',
      color: '#dc2626',
      confidence: det.confidence || 0.94,
      speed: det.estimated_speed_kmh || 60
    };
  };

  // Live CCTV Timestamp generator
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      const timeStr = now.toLocaleTimeString('en-US', { hour12: false });
      setCurrentTime(timeStr);
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  // Poll backend for vision detections
  const fetchVisionStatus = () => {
    fetch(getApiUrl('/api/vision/cameras'))
      .then(res => res.json())
      .then(data => {
        if (data.cameras) {
          const map = {};
          data.cameras.forEach(c => {
            if (c.active_detection) {
              map[c.camera_id] = c.active_detection;
            }
          });
          setApiDetections(map);
        }
      })
      .catch(err => console.warn('Vision status fetch error:', err));
  };

  useEffect(() => {
    fetchVisionStatus();
    const interval = setInterval(fetchVisionStatus, 2000);
    return () => clearInterval(interval);
  }, []);

  // Global Keyboard Escape Listener
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' || e.key === 'Esc' || e.code === 'Escape') {
        if (fullscreenCam) {
          setFullscreenCam(null);
          if (onReturnHome) {
            onReturnHome();
          } else {
            const overviewElem = document.getElementById('section-overview');
            if (overviewElem) {
              overviewElem.scrollIntoView({ behavior: 'smooth' });
            } else {
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }
          }
        }
      }
    };

    if (fullscreenCam) {
      window.addEventListener('keydown', handleKeyDown, true);
    }

    return () => {
      window.removeEventListener('keydown', handleKeyDown, true);
    };
  }, [fullscreenCam, onReturnHome]);

  const currentConfig = cameraConfig[activeSlide];
  const currentNodeData = intersections.find(i => i.intersection_id === activeSlide);

  // Helper to find camera by direction in current slide
  const getCamByDir = (dir) => currentConfig.cameras.find(c => c.dir === dir);

  // Sub-component rendering 2D Mini Signal with L-shape design (arrows top, vertical light below)
  const renderMini2DSignal = (dir) => {
    const activeApproach = currentNodeData?.active_approach || 'NORTH';
    const timerState = currentNodeData?.timer_state || 'GREEN';
    const timerRemaining = currentNodeData?.timer_remaining ?? 25;
    const isEmergency = currentNodeData?.current_priority === 'EMERGENCY_VEHICLE';

    const isCurrentActive = (activeApproach === dir);
    const isGreen = isCurrentActive && timerState === 'GREEN';
    const isYellow = isCurrentActive && timerState === 'YELLOW';
    const isRed = !isCurrentActive || timerState === 'ALL_RED';

    const formatTimer = (sec) => {
      const s = Math.max(0, sec);
      const mins = String(Math.floor(s / 60)).padStart(2, '0');
      const secs = String(s % 60).padStart(2, '0');
      return `${mins}:${secs}`;
    };

    const arrowColors = {
      left: isGreen ? '#10b981' : (isYellow ? '#f59e0b' : '#334155'),
      straight: isGreen ? '#10b981' : (isYellow ? '#f59e0b' : '#334155'),
      right: isGreen ? '#10b981' : (isYellow ? '#f59e0b' : '#334155')
    };

    return (
      <div style={{
        backgroundColor: '#090d16',
        border: isEmergency && isCurrentActive ? '1px solid #dc2626' : '1px solid #334155',
        borderRadius: '5px',
        padding: '0.35rem 0.45rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.25rem',
        fontFamily: 'monospace',
        width: '100%',
        boxShadow: 'inset 0 0 6px rgba(0,0,0,0.8)',
        marginTop: '0.4rem'
      }}>
        {/* Top Horizontal Arrow Bar: ← LEFT | ↑ STRAIGHT | → RIGHT */}
        <div style={{
          display: 'flex',
          justify: 'space-between',
          alignItems: 'center',
          backgroundColor: '#0f172a',
          padding: '0.15rem 0.35rem',
          borderRadius: '3px',
          border: '1px solid #1e293b'
        }}>
          <div style={{ color: arrowColors.left, fontSize: '0.625rem', fontWeight: 900 }} title="Left Turn">
            ← <span style={{ fontSize: '0.525rem' }}>L</span>
          </div>
          <div style={{ color: arrowColors.straight, fontSize: '0.625rem', fontWeight: 900 }} title="Straight">
            ↑ <span style={{ fontSize: '0.525rem' }}>S</span>
          </div>
          <div style={{ color: arrowColors.right, fontSize: '0.625rem', fontWeight: 900 }} title="Right Turn">
            → <span style={{ fontSize: '0.525rem' }}>R</span>
          </div>
        </div>

        {/* Vertical Traffic Light Housing & Timer Display */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' }}>
          <div style={{
            backgroundColor: '#1e293b',
            border: '1px solid #334155',
            borderRadius: '10px',
            padding: '0.2rem 0.15rem',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '0.15rem'
          }}>
            <div style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: isRed ? '#ef4444' : '#334155', boxShadow: isRed ? '0 0 6px #ef4444' : 'none' }} />
            <div style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: isYellow ? '#f59e0b' : '#334155', boxShadow: isYellow ? '0 0 6px #f59e0b' : 'none' }} />
            <div style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: isGreen ? '#10b981' : '#334155', boxShadow: isGreen ? '0 0 6px #10b981' : 'none' }} />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
            {isEmergency && isCurrentActive ? (
              <div>
                <div style={{ color: '#dc2626', fontSize: '0.6rem', fontWeight: 900 }}>P1 EMERGENCY</div>
                <div style={{ color: '#10b981', fontSize: '0.55rem', fontWeight: 800 }}>GREEN PRIORITY</div>
                <div style={{ color: '#38bdf8', fontSize: '0.525rem' }}>TRACKING ID: 07</div>
              </div>
            ) : (
              <div>
                <div style={{ color: isGreen ? '#10b981' : (isYellow ? '#f59e0b' : '#ef4444'), fontSize: '0.6rem', fontWeight: 900 }}>
                  {isGreen ? 'GREEN' : (isYellow ? 'YELLOW' : (timerState === 'ALL_RED' ? 'ALL RED' : 'RED'))}
                </div>
                <div style={{ color: '#ffffff', fontSize: '0.8rem', fontWeight: 900, letterSpacing: '0.5px' }}>
                  {formatTimer(timerRemaining)}
                </div>
                <div style={{ color: '#64748b', fontSize: '0.525rem' }}>
                  {dir} APPROACH
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  // Helper to render individual CCTV preview card (AUTONOMOUS, NO MANUAL CONTROLS)
  const renderCameraCard = (camObj) => {
    if (!camObj) return null;
    const rawDet = apiDetections[camObj.backendCamId];
    const detInfo = getDetectionDetails(rawDet);
    const hasDetection = Boolean(detInfo);
    const hasError = videoErrors[camObj.camId];
    const hasVideo = Boolean(camObj.videoSrc) && !hasError;
    const camState = getCameraContext(camObj, currentNodeData);

    let badgeText = 'STREAM ONLINE';
    let badgeColor = '#059669';
    let badgeBg = '#ecfdf5';
    let badgeBorder = '#a7f3d0';

    if (hasDetection) {
      badgeText = detInfo.priority;
      badgeColor = detInfo.color;
      badgeBg = `${detInfo.color}15`;
      badgeBorder = `${detInfo.color}40`;
    } else if (!camObj.videoSrc) {
      badgeText = 'SOURCE PENDING';
      badgeColor = '#d97706';
      badgeBg = '#fffbeb';
      badgeBorder = '#fde68a';
    } else if (hasError) {
      badgeText = 'CAMERA OFFLINE';
      badgeColor = '#dc2626';
      badgeBg = '#fef2f2';
      badgeBorder = '#fecaca';
    }

    return (
      <div
        key={camObj.camId}
        style={{
          backgroundColor: '#ffffff',
          border: hasDetection ? `2px solid ${detInfo.color}` : '1px solid #cbd5e1',
          borderRadius: '6px',
          padding: '0.65rem',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: hasDetection ? `0 0 12px ${detInfo.color}40` : '0 1px 3px rgba(0,0,0,0.05)',
          transition: 'all 0.2s ease-in-out'
        }}
      >
        {/* CCTV Camera Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <span style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.2rem',
              color: !camObj.videoSrc ? '#d97706' : (hasError ? '#dc2626' : '#dc2626'),
              fontSize: '0.675rem',
              fontWeight: 900,
              fontFamily: 'monospace'
            }}>
              <span style={{
                width: '7px',
                height: '7px',
                borderRadius: '50%',
                backgroundColor: !camObj.videoSrc ? '#d97706' : (hasError ? '#dc2626' : '#dc2626'),
                display: 'inline-block',
                animation: hasVideo ? 'pulse 1.5s infinite' : 'none'
              }} />
              {!camObj.videoSrc ? 'STBY' : (hasError ? 'ERR' : 'REC')}
            </span>
            <strong style={{ fontSize: '0.775rem', color: '#0b2545', fontFamily: 'monospace' }}>
              {camObj.camId}
            </strong>
          </div>
          <span style={{
            fontSize: '0.625rem',
            fontWeight: 800,
            color: badgeColor,
            backgroundColor: badgeBg,
            border: `1px solid ${badgeBorder}`,
            padding: '0.1rem 0.4rem',
            borderRadius: '2px',
            fontFamily: 'monospace'
          }}>
            {badgeText}
          </span>
        </div>

        {/* Video Viewport Box with CCTV Overlay */}
        <div
          onClick={() => setFullscreenCam({ ...camObj, juncName: currentConfig.name, intersectionId: currentConfig.intersectionId, detInfo })}
          style={{
            height: '145px',
            backgroundColor: '#0f172a',
            borderRadius: '4px',
            position: 'relative',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            overflow: 'hidden',
            cursor: 'pointer',
            border: '1px solid #1e293b'
          }}
          title="Click to open Fullscreen CCTV view"
        >
          {/* Video / Placeholder Content */}
          {!camObj.videoSrc ? (
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              textAlign: 'center',
              padding: '0.75rem',
              color: '#94a3b8'
            }}>
              <VideoOff size={24} style={{ color: '#f59e0b', marginBottom: '0.35rem' }} />
              <div style={{ color: '#f59e0b', fontWeight: 800, fontSize: '0.725rem', fontFamily: 'monospace' }}>
                VIDEO SOURCE PENDING
              </div>
              <div style={{ color: '#64748b', fontSize: '0.575rem', fontFamily: 'monospace', marginTop: '0.15rem' }}>
                CAMERA HARDWARE INSTALLED
              </div>
              <div style={{ color: '#475569', fontSize: '0.55rem', fontFamily: 'monospace' }}>
                STREAM PROVISIONING IN PROGRESS
              </div>
            </div>
          ) : hasError ? (
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              textAlign: 'center',
              padding: '0.75rem',
              color: '#ef4444'
            }}>
              <AlertTriangle size={24} style={{ color: '#ef4444', marginBottom: '0.35rem' }} />
              <div style={{ color: '#ef4444', fontWeight: 800, fontSize: '0.7rem', fontFamily: 'monospace' }}>
                CAMERA OFFLINE / VIDEO SOURCE UNAVAILABLE
              </div>
              <div style={{ color: '#94a3b8', fontSize: '0.575rem', fontFamily: 'monospace', marginTop: '0.15rem' }}>
                SIGNAL LOSS DETECTED
              </div>
            </div>
          ) : (
            <video
              ref={el => { videoRefs.current[camObj.camId] = el; }}
              src={camObj.videoSrc}
              autoPlay
              loop
              muted
              playsInline
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              onError={() => handleVideoError(camObj.camId)}
            />
          )}

          {/* CCTV Scanline & Noise Overlay Effect */}
          <div style={{
            position: 'absolute',
            inset: 0,
            background: 'linear-gradient(rgba(18, 16, 16, 0) 50%, rgba(0, 0, 0, 0.25) 50%)',
            backgroundSize: '100% 4px',
            pointerEvents: 'none',
            opacity: 0.6
          }} />

          {/* Top-Left HUD Corner Indicator: REC + SIGNAL STATUS */}
          <div style={{
            position: 'absolute',
            top: '6px',
            left: '6px',
            display: 'flex',
            flexDirection: 'column',
            gap: '2px',
            zIndex: 5
          }}>
            <div style={{
              fontSize: '0.625rem',
              fontFamily: 'monospace',
              color: '#ffffff',
              background: 'rgba(15, 23, 42, 0.85)',
              padding: '0.15rem 0.35rem',
              borderRadius: '2px',
              display: 'flex',
              alignItems: 'center',
              gap: '0.25rem'
            }}>
              <span style={{ color: !camObj.videoSrc ? '#f59e0b' : (hasError ? '#ef4444' : '#dc2626'), fontWeight: 900 }}>
                {!camObj.videoSrc ? '○ STBY' : (hasError ? '✕ OFF' : '● REC')}
              </span>
              <span>{camObj.camId}</span>
            </div>
            <div style={{
              fontSize: '0.55rem',
              fontFamily: 'monospace',
              fontWeight: 900,
              color: camState.isPlaying ? '#10b981' : '#ef4444',
              background: camState.isPlaying ? 'rgba(6, 78, 59, 0.95)' : 'rgba(127, 29, 29, 0.95)',
              border: `1px solid ${camState.isPlaying ? '#10b981' : '#ef4444'}`,
              padding: '0.1rem 0.3rem',
              borderRadius: '2px'
            }}>
              {camState.hudSignal}
            </div>
          </div>

          {/* Top-Right HUD Corner Indicator: DIRECTION */}
          <div style={{
            position: 'absolute',
            top: '6px',
            right: '6px',
            fontSize: '0.625rem',
            fontFamily: 'monospace',
            fontWeight: 800,
            color: '#38bdf8',
            background: 'rgba(15, 23, 42, 0.85)',
            padding: '0.15rem 0.35rem',
            borderRadius: '2px',
            zIndex: 5
          }}>
            {camObj.dir}
          </div>

          {/* Bottom-Left HUD Corner Indicator: LOCATION + ACTIVE PHASE */}
          <div style={{
            position: 'absolute',
            bottom: '6px',
            left: '6px',
            display: 'flex',
            flexDirection: 'column',
            gap: '2px',
            zIndex: 5
          }}>
            <div style={{
              fontSize: '0.6rem',
              fontFamily: 'monospace',
              color: '#94a3b8',
              background: 'rgba(15, 23, 42, 0.85)',
              padding: '0.1rem 0.3rem',
              borderRadius: '2px'
            }}>
              {currentConfig.name}
            </div>
            <div style={{
              fontSize: '0.525rem',
              fontFamily: 'monospace',
              fontWeight: 800,
              color: camState.effectivePriority?.rank < 6 ? '#f59e0b' : '#38bdf8',
              background: 'rgba(15, 23, 42, 0.9)',
              padding: '0.08rem 0.3rem',
              borderRadius: '2px',
              border: '1px solid rgba(56, 189, 248, 0.3)'
            }}>
              ACTIVE PHASE: {camState.phaseLabel}
            </div>
          </div>

          {/* Bottom-Right HUD Corner Indicator: TIMESTAMP */}
          <div style={{
            position: 'absolute',
            bottom: '6px',
            right: '6px',
            fontSize: '0.6rem',
            fontFamily: 'monospace',
            color: '#10b981',
            background: 'rgba(15, 23, 42, 0.85)',
            padding: '0.15rem 0.35rem',
            borderRadius: '2px',
            zIndex: 5
          }}>
            {currentTime}
          </div>

          {/* PRIORITY PREEMPTION & INCIDENT LOCK OVERLAY TAG BANNER */}
          {camState.overlayTag && (
            <div style={{
              position: 'absolute',
              inset: 0,
              backgroundColor: 'rgba(15, 23, 42, 0.8)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 8,
              padding: '0.5rem',
              pointerEvents: 'none'
            }}>
              <div style={{
                backgroundColor: '#dc2626',
                color: '#ffffff',
                fontSize: '0.65rem',
                fontWeight: 900,
                fontFamily: 'monospace',
                padding: '0.35rem 0.6rem',
                borderRadius: '4px',
                boxShadow: '0 0 14px rgba(220, 38, 38, 0.9)',
                textAlign: 'center',
                letterSpacing: '0.5px'
              }}>
                {camState.overlayTag}
              </div>
              <div style={{
                fontSize: '0.525rem',
                color: '#cbd5e1',
                fontFamily: 'monospace',
                marginTop: '0.3rem'
              }}>
                AUTONOMOUS SIGNAL PREEMPTION IN EFFECT
              </div>
            </div>
          )}

          {/* COMPUTER VISION GREEN TRACKING BOUNDING BOX OVERLAY */}
          {hasDetection && (
            <div style={{
              position: 'absolute',
              top: '18%',
              left: '20%',
              width: '60%',
              height: '60%',
              border: '2px solid #10b981',
              borderRadius: '4px',
              boxShadow: '0 0 12px rgba(16, 185, 129, 0.7), inset 0 0 12px rgba(16, 185, 129, 0.25)',
              pointerEvents: 'none',
              display: 'flex',
              flexDirection: 'column',
              justify: 'space-between',
              padding: '4px',
              zIndex: 7
            }}>
              <div style={{
                backgroundColor: '#10b981',
                color: '#0f172a',
                fontSize: '0.55rem',
                fontWeight: 900,
                fontFamily: 'monospace',
                padding: '0.1rem 0.35rem',
                borderRadius: '2px',
                alignSelf: 'flex-start'
              }}>
                AMBULANCE | ID: 07 | CONF: {Math.round(detInfo.confidence * 100)}% | P1 EMERGENCY
              </div>
              <div style={{ fontSize: '0.5rem', color: '#10b981', fontFamily: 'monospace', alignSelf: 'flex-end', backgroundColor: 'rgba(15,23,42,0.85)', padding: '0.05rem 0.25rem', borderRadius: '2px' }}>
                POSITION TRACKED ({detInfo.speed} km/h)
              </div>
            </div>
          )}

          {/* Hover Expand Hint */}
          <div style={{
            position: 'absolute',
            inset: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.45)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            opacity: 0,
            transition: 'opacity 0.2s',
            color: '#ffffff',
            fontSize: '0.725rem',
            fontWeight: 700,
            gap: '0.3rem',
            zIndex: 9
          }} className="cctv-hover-overlay">
            <Maximize2 size={14} /> Click for Fullscreen
          </div>
        </div>

        {/* 2D MINI TRAFFIC SIGNAL INTEGRATED AT BOTTOM OF CARD */}
        {renderMini2DSignal(camObj.dir)}
      </div>
    );
  };

  return (
    <div className="gov-section" id="section-vision">
      {/* Section Header */}
      <div className="gov-section-header">
        <div className="gov-section-title">
          <span>CCTV CAMERA DETECTION FEEDS</span>
        </div>
        <span style={{ fontSize: '0.725rem', color: '#64748b', fontFamily: 'monospace' }}>
          COMPUTER VISION DETECTION LAYER (SIMULATION)
        </span>
      </div>

      {/* Slide Navigation Header Bar */}
      <div style={{
        display: 'flex',
        justify: 'space-between',
        alignItems: 'center',
        backgroundColor: '#0f172a',
        border: '1px solid #334155',
        borderRadius: '6px',
        padding: '0.6rem 0.85rem',
        marginBottom: '1rem',
        flexWrap: 'wrap',
        gap: '0.5rem'
      }}>
        {/* Intersection Slide Toggle Buttons */}
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button
            onClick={() => setActiveSlide('I1')}
            style={{
              backgroundColor: activeSlide === 'I1' ? '#0284c7' : '#1e293b',
              color: activeSlide === 'I1' ? '#ffffff' : '#94a3b8',
              border: activeSlide === 'I1' ? '1px solid #38bdf8' : '1px solid #475569',
              borderRadius: '4px',
              padding: '0.35rem 0.75rem',
              fontSize: '0.75rem',
              fontWeight: 800,
              fontFamily: 'monospace',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.35rem',
              transition: 'all 0.2s'
            }}
          >
            <Video size={13} /> SLIDE 1 — INTERSECTION I1 (Main St & 1st Ave)
          </button>

          <button
            onClick={() => setActiveSlide('I2')}
            style={{
              backgroundColor: activeSlide === 'I2' ? '#0284c7' : '#1e293b',
              color: activeSlide === 'I2' ? '#ffffff' : '#94a3b8',
              border: activeSlide === 'I2' ? '1px solid #38bdf8' : '1px solid #475569',
              borderRadius: '4px',
              padding: '0.35rem 0.75rem',
              fontSize: '0.75rem',
              fontWeight: 800,
              fontFamily: 'monospace',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.35rem',
              transition: 'all 0.2s'
            }}
          >
            <Video size={13} /> SLIDE 2 — INTERSECTION I2 (Main St & 2nd Ave)
          </button>
        </div>

        {/* Intersection Overview Metadata */}
        <div style={{ fontSize: '0.725rem', fontFamily: 'monospace', color: '#38bdf8', display: 'flex', gap: '1rem' }}>
          <span>INTERSECTION {currentConfig.intersectionId}: <strong>{currentConfig.name}</strong></span>
          <span>CAMERAS: <strong>4</strong></span>
          <span style={{ color: '#10b981' }}>
            STATUS: <strong>ALL STREAMS ONLINE</strong>
          </span>
        </div>
      </div>

      {/* Junction Layout with 4 Camera Feeds Arranged Around Center Junction */}
      <div style={{
        backgroundColor: '#f8fafc',
        border: '1px solid #cbd5e1',
        borderRadius: '6px',
        padding: '1rem',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '1rem'
      }}>
        {/* Top: NORTH Camera */}
        <div style={{ width: '100%', maxWidth: '340px' }}>
          {renderCameraCard(getCamByDir('NORTH'))}
        </div>

        {/* Middle Row: WEST Camera <--- JUNCTION SCHEMATIC ---> EAST Camera */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: '1rem',
          width: '100%',
          alignItems: 'center'
        }}>
          {/* Left: WEST Camera */}
          <div>
            {renderCameraCard(getCamByDir('WEST'))}
          </div>

          {/* Center: 2D Junction Schematic Box */}
          <div style={{
            backgroundColor: '#0f172a',
            border: '2px solid #334155',
            borderRadius: '6px',
            padding: '0.85rem',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#ffffff',
            textAlign: 'center',
            boxShadow: 'inset 0 0 10px rgba(0,0,0,0.6)'
          }}>
            <div style={{ fontSize: '0.65rem', color: '#94a3b8', fontFamily: 'monospace', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              JUNCTION CONTROL CENTER
            </div>
            <strong style={{ fontSize: '0.9rem', color: '#38bdf8', marginTop: '0.2rem' }}>
              INTERSECTION {currentConfig.intersectionId}
            </strong>
            <div style={{ fontSize: '0.75rem', color: '#cbd5e1', fontWeight: 600 }}>
              {currentConfig.name}
            </div>

            {/* Junction Direction Indicator Diagram */}
            <div style={{
              margin: '0.6rem 0',
              padding: '0.5rem',
              border: '1px dashed #475569',
              borderRadius: '4px',
              width: '100%',
              fontSize: '0.65rem',
              fontFamily: 'monospace',
              color: '#10b981'
            }}>
              <div>NORTH ({currentConfig.mainStreet}) ↑</div>
              <div style={{ display: 'flex', justifyContent: 'space-between', margin: '0.25rem 0' }}>
                <span>← WEST ({currentConfig.crossStreet})</span>
                <span>[ 4-WAY SURVEILLANCE ]</span>
                <span>EAST ({currentConfig.crossStreet}) →</span>
              </div>
              <div>↓ SOUTH ({currentConfig.mainStreet})</div>
            </div>

            <div style={{ fontSize: '0.65rem', color: '#64748b', fontFamily: 'monospace' }}>
              AUTONOMOUS CV MONITORING ACTIVE
            </div>
          </div>

          {/* Right: EAST Camera */}
          <div>
            {renderCameraCard(getCamByDir('EAST'))}
          </div>
        </div>

        {/* Bottom: SOUTH Camera */}
        <div style={{ width: '100%', maxWidth: '340px' }}>
          {renderCameraCard(getCamByDir('SOUTH'))}
        </div>
      </div>

      {/* FULLSCREEN CCTV MODAL VIEW */}
      {fullscreenCam && (() => {
        const modalCamState = getCameraContext(
          fullscreenCam,
          intersections.find(i => i.intersection_id === fullscreenCam.intersectionId)
        );

        return (
          <div style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.95)',
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1rem',
            backdropFilter: 'blur(4px)'
          }}>
            <div style={{
              backgroundColor: '#0f172a',
              border: '1px solid #334155',
              borderRadius: '8px',
              width: '100%',
              maxWidth: '920px',
              maxHeight: '94vh',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.7)'
            }}>
              {/* Modal Header Bar */}
              <div style={{
                display: 'flex',
                justify: 'space-between',
                alignItems: 'center',
                backgroundColor: '#1e293b',
                padding: '0.75rem 1rem',
                borderBottom: '1px solid #334155'
              }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span style={{
                      color: !fullscreenCam.videoSrc ? '#f59e0b' : (videoErrors[fullscreenCam.camId] ? '#dc2626' : '#dc2626'),
                      fontWeight: 900,
                      fontSize: '0.75rem',
                      fontFamily: 'monospace'
                    }}>
                      {!fullscreenCam.videoSrc ? '○ STBY' : (videoErrors[fullscreenCam.camId] ? '✕ ERR' : '● REC')}
                    </span>
                    <strong style={{ color: '#ffffff', fontSize: '0.95rem', fontFamily: 'monospace' }}>
                      {fullscreenCam.camId}
                    </strong>
                    <span style={{ backgroundColor: '#0284c7', color: '#ffffff', fontSize: '0.65rem', padding: '0.1rem 0.4rem', borderRadius: '2px', fontWeight: 800, fontFamily: 'monospace' }}>
                      {fullscreenCam.dir} CAMERA
                    </span>
                  </div>
                  <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '0.1rem' }}>
                    INTERSECTION {fullscreenCam.intersectionId} — {fullscreenCam.juncName}
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                  <span style={{ color: '#10b981', fontFamily: 'monospace', fontSize: '0.8rem', fontWeight: 700 }}>
                    {currentTime}
                  </span>
                  <button
                    onClick={() => setFullscreenCam(null)}
                    style={{
                      backgroundColor: '#dc2626',
                      color: '#ffffff',
                      border: 'none',
                      borderRadius: '4px',
                      padding: '0.35rem 0.75rem',
                      fontSize: '0.75rem',
                      fontWeight: 800,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.25rem'
                    }}
                  >
                    <X size={14} /> CLOSE FULLSCREEN (ESC)
                  </button>
                </div>
              </div>

              {/* Modal Large Video Viewport */}
              <div style={{
                position: 'relative',
                width: '100%',
                height: '480px',
                backgroundColor: '#000000',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                overflow: 'hidden'
              }}>
                {!fullscreenCam.videoSrc ? (
                  <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    textAlign: 'center',
                    padding: '2rem',
                    color: '#94a3b8'
                  }}>
                    <VideoOff size={48} style={{ color: '#f59e0b', marginBottom: '0.75rem' }} />
                    <div style={{ color: '#f59e0b', fontWeight: 800, fontSize: '1.1rem', fontFamily: 'monospace' }}>
                      VIDEO SOURCE PENDING
                    </div>
                    <div style={{ color: '#cbd5e1', fontSize: '0.85rem', fontFamily: 'monospace', marginTop: '0.35rem' }}>
                      CAMERA HARDWARE INSTALLED — STREAM PROVISIONING IN PROGRESS
                    </div>
                    <div style={{ color: '#64748b', fontSize: '0.75rem', fontFamily: 'monospace', marginTop: '0.25rem' }}>
                      FEED CONNECTION EXPECTED SHORTLY
                    </div>
                  </div>
                ) : videoErrors[fullscreenCam.camId] ? (
                  <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    textAlign: 'center',
                    padding: '2rem',
                    color: '#ef4444'
                  }}>
                    <AlertTriangle size={48} style={{ color: '#ef4444', marginBottom: '0.75rem' }} />
                    <div style={{ color: '#ef4444', fontWeight: 800, fontSize: '1.1rem', fontFamily: 'monospace' }}>
                      CAMERA OFFLINE / VIDEO SOURCE UNAVAILABLE
                    </div>
                    <div style={{ color: '#cbd5e1', fontSize: '0.85rem', fontFamily: 'monospace', marginTop: '0.35rem' }}>
                      TELEMETRY CONNECTION LOSS DETECTED
                    </div>
                  </div>
                ) : (
                  <video
                    ref={modalVideoRef}
                    src={fullscreenCam.videoSrc}
                    loop
                    muted
                    playsInline
                    style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                    onError={() => handleVideoError(fullscreenCam.camId)}
                  />
                )}

                {/* Scanlines Effect */}
                <div style={{
                  position: 'absolute',
                  inset: 0,
                  background: 'linear-gradient(rgba(18, 16, 16, 0) 50%, rgba(0, 0, 0, 0.25) 50%)',
                  backgroundSize: '100% 4px',
                  pointerEvents: 'none',
                  opacity: 0.5
                }} />

                {/* Top-Left HUD Corner Indicator: REC + SIGNAL STATUS */}
                <div style={{
                  position: 'absolute',
                  top: '12px',
                  left: '14px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '4px',
                  zIndex: 5
                }}>
                  <div style={{
                    fontSize: '0.8rem',
                    fontFamily: 'monospace',
                    color: '#ffffff',
                    background: 'rgba(15, 23, 42, 0.85)',
                    padding: '0.25rem 0.5rem',
                    borderRadius: '3px',
                    border: '1px solid #334155'
                  }}>
                    <span style={{ color: !fullscreenCam.videoSrc ? '#f59e0b' : (videoErrors[fullscreenCam.camId] ? '#ef4444' : '#dc2626'), fontWeight: 900 }}>
                      {!fullscreenCam.videoSrc ? '○ STBY' : (videoErrors[fullscreenCam.camId] ? '✕ OFF' : '● REC')}
                    </span> {fullscreenCam.camId}
                  </div>
                  <div style={{
                    fontSize: '0.7rem',
                    fontFamily: 'monospace',
                    fontWeight: 900,
                    color: modalCamState.isPlaying ? '#10b981' : '#ef4444',
                    background: modalCamState.isPlaying ? 'rgba(6, 78, 59, 0.95)' : 'rgba(127, 29, 29, 0.95)',
                    border: `1px solid ${modalCamState.isPlaying ? '#10b981' : '#ef4444'}`,
                    padding: '0.15rem 0.45rem',
                    borderRadius: '3px'
                  }}>
                    {modalCamState.hudSignal}
                  </div>
                </div>

                {/* Top-Right HUD Corner Indicator */}
                <div style={{
                  position: 'absolute',
                  top: '12px',
                  right: '14px',
                  fontSize: '0.8rem',
                  fontFamily: 'monospace',
                  fontWeight: 800,
                  color: '#38bdf8',
                  background: 'rgba(15, 23, 42, 0.85)',
                  padding: '0.25rem 0.5rem',
                  borderRadius: '3px',
                  border: '1px solid #334155',
                  zIndex: 5
                }}>
                  {fullscreenCam.dir} CAMERA FEED
                </div>

                {/* Bottom-Left HUD Corner Indicator */}
                <div style={{
                  position: 'absolute',
                  bottom: '12px',
                  left: '14px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '4px',
                  zIndex: 5
                }}>
                  <div style={{
                    fontSize: '0.75rem',
                    fontFamily: 'monospace',
                    color: '#cbd5e1',
                    background: 'rgba(15, 23, 42, 0.85)',
                    padding: '0.25rem 0.5rem',
                    borderRadius: '3px',
                    border: '1px solid #334155'
                  }}>
                    LOCATION: {fullscreenCam.juncName} (INTERSECTION {fullscreenCam.intersectionId})
                  </div>
                  <div style={{
                    fontSize: '0.675rem',
                    fontFamily: 'monospace',
                    fontWeight: 800,
                    color: modalCamState.effectivePriority?.rank < 6 ? '#f59e0b' : '#38bdf8',
                    background: 'rgba(15, 23, 42, 0.9)',
                    padding: '0.15rem 0.45rem',
                    borderRadius: '3px',
                    border: '1px solid rgba(56, 189, 248, 0.3)'
                  }}>
                    ACTIVE PHASE: {modalCamState.phaseLabel}
                  </div>
                </div>

                {/* Bottom-Right HUD Corner Indicator */}
                <div style={{
                  position: 'absolute',
                  bottom: '12px',
                  right: '14px',
                  fontSize: '0.8rem',
                  fontFamily: 'monospace',
                  color: '#10b981',
                  fontWeight: 800,
                  background: 'rgba(15, 23, 42, 0.85)',
                  padding: '0.25rem 0.5rem',
                  borderRadius: '3px',
                  border: '1px solid #334155',
                  zIndex: 5
                }}>
                  CCTV TIME: {currentTime}
                </div>

                {/* FULLSCREEN PRIORITY OVERLAY TAG BANNER */}
                {modalCamState.overlayTag && (
                  <div style={{
                    position: 'absolute',
                    inset: 0,
                    backgroundColor: 'rgba(15, 23, 42, 0.85)',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 8,
                    padding: '1rem',
                    pointerEvents: 'none'
                  }}>
                    <div style={{
                      backgroundColor: '#dc2626',
                      color: '#ffffff',
                      fontSize: '0.95rem',
                      fontWeight: 900,
                      fontFamily: 'monospace',
                      padding: '0.5rem 1rem',
                      borderRadius: '6px',
                      boxShadow: '0 0 20px rgba(220, 38, 38, 0.9)',
                      textAlign: 'center',
                      letterSpacing: '0.75px'
                    }}>
                      {modalCamState.overlayTag}
                    </div>
                    <div style={{
                      fontSize: '0.75rem',
                      color: '#cbd5e1',
                      fontFamily: 'monospace',
                      marginTop: '0.5rem'
                    }}>
                      AUTONOMOUS DETERMINISTIC PRIORITY PREEMPTION IN EFFECT
                    </div>
                  </div>
                )}
              </div>

              {/* Modal Controls Footer */}
              <div style={{
                backgroundColor: '#1e293b',
                padding: '0.85rem 1rem',
                display: 'flex',
                justify: 'space-between',
                alignItems: 'center',
                borderTop: '1px solid #334155'
              }}>
                <div style={{ fontSize: '0.75rem', fontFamily: 'monospace', color: fullscreenCam.detInfo ? fullscreenCam.detInfo.color : '#10b981', fontWeight: 700 }}>
                  {fullscreenCam.detInfo
                    ? `AUTOMATIC CV DETECTION: ${fullscreenCam.detInfo.title} (${fullscreenCam.detInfo.subtitle} — ${fullscreenCam.detInfo.priority})`
                    : 'STATUS: AUTOMATIC COMPUTER VISION SURVEILLANCE ACTIVE | STREAM ONLINE'}
                </div>

                <div style={{ fontSize: '0.7rem', color: '#64748b', fontFamily: 'monospace' }}>
                  PRESS ESC TO CLOSE & RETURN HOME
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Embedded CSS Hover Styles */}
      <style>{`
        .cctv-hover-overlay {
          opacity: 0;
        }
        div:hover > .cctv-hover-overlay {
          opacity: 1 !important;
        }
        @keyframes pulse {
          0% { opacity: 1; }
          50% { opacity: 0.3; }
          100% { opacity: 1; }
        }
      `}</style>
    </div>
  );
}
