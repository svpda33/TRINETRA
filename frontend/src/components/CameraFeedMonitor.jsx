import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Maximize2, X, Video, AlertTriangle, VideoOff } from 'lucide-react';
import { getApiUrl } from '../config';

// Format seconds into MM:SS format
const formatTimer = (sec) => {
  const s = Math.max(0, Number(sec) || 0);
  const mins = String(Math.floor(s / 60)).padStart(2, '0');
  const secs = String(s % 60).padStart(2, '0');
  return `${mins}:${secs}`;
};

export default function CameraFeedMonitor({ intersections = [], onTriggerVisionDetection, onReturnHome }) {
  const [activeSlide, setActiveSlide] = useState('I1');
  const [fullscreenCam, setFullscreenCam] = useState(null);
  const [currentTime, setCurrentTime] = useState('');
  const [apiDetections, setApiDetections] = useState({});
  const [cameraStatuses, setCameraStatuses] = useState({});
  const [activeTracks, setActiveTracks] = useState({});
  const [processingBatch, setProcessingBatch] = useState({});
  const [feedActionLoading, setFeedActionLoading] = useState({});
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
      name: 'Cyber Towers Junction',
      crossStreet: 'Hitec City Main Rd',
      mainStreet: 'Cyber Towers Flyover',
      cameras: [
        { camId: 'CAM_I1_NORTH', dir: 'NORTH', backendCamId: 'CAM_I1_NORTH', videoSrc: '/videos/I1_NORTH.mp4' },
        { camId: 'CAM_I1_SOUTH', dir: 'SOUTH', backendCamId: 'CAM_I1_SOUTH', videoSrc: '/videos/I1_SOUTH.mp4' },
        { camId: 'CAM_I1_EAST',  dir: 'EAST',  backendCamId: 'CAM_I1_EAST', videoSrc: '/videos/I1_EAST.mp4' },
        { camId: 'CAM_I1_WEST',  dir: 'WEST',  backendCamId: 'CAM_I1_WEST', videoSrc: '/videos/I1_WEST.mp4' }
      ]
    },
    I2: {
      intersectionId: 'I2',
      name: 'Hitec City / Mindspace Junction',
      crossStreet: 'Mindspace Inorbit Rd',
      mainStreet: 'Hitec City Main Rd',
      cameras: [
        { camId: 'CAM_I2_NORTH', dir: 'NORTH', backendCamId: 'CAM_I2_NORTH', videoSrc: '/videos/I2_NORTH.mp4' },
        { camId: 'CAM_I2_SOUTH', dir: 'SOUTH', backendCamId: 'CAM_I2_SOUTH', videoSrc: '/videos/I2_SOUTH.mp4' },
        { camId: 'CAM_I2_EAST',  dir: 'EAST',  backendCamId: 'CAM_I2_EAST', videoSrc: '/videos/I2_EAST.mp4' },
        { camId: 'CAM_I2_WEST',  dir: 'WEST',  backendCamId: 'CAM_I2_WEST', videoSrc: '/videos/I2_WEST.mp4' }
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
    const rawLabel = (det.class_label || det.vehicle_type || "").toUpperCase();

    if (rawLabel.includes("AMBULANCE")) {
      return {
        title: "AMBULANCE (OPERATOR / V2X TRIGGER)",
        subtitle: "EMERGENCY VEHICLE PREEMPTION",
        priority: "PRIORITY P1",
        color: "#dc2626",
        confidence: det.confidence || 0.94,
        speed: det.estimated_speed_kmh || 68
      };
    }
    if (rawLabel.includes("FIRE")) {
      return {
        title: "FIRE ENGINE (OPERATOR / V2X TRIGGER)",
        subtitle: "EMERGENCY VEHICLE PREEMPTION",
        priority: "PRIORITY P1",
        color: "#dc2626",
        confidence: det.confidence || 0.96,
        speed: det.estimated_speed_kmh || 58
      };
    }
    if (rawLabel.includes("TRUCK")) {
      return {
        title: "TRUCK DETECTED",
        subtitle: "HEAVY COMMERCIAL (CIVILIAN)",
        priority: "NORMAL",
        color: "#f59e0b",
        confidence: det.confidence || 0.88,
        speed: det.estimated_speed_kmh || 42
      };
    }
    if (rawLabel.includes("BUS")) {
      return {
        title: "BUS DETECTED",
        subtitle: "PUBLIC TRANSIT",
        priority: "PRIORITY P5",
        color: "#10b981",
        confidence: det.confidence || 0.91,
        speed: det.estimated_speed_kmh || 38
      };
    }
    return {
      title: `${rawLabel} DETECTED`,
      subtitle: "AUTOMATIC CCTV CV EVENT",
      priority: "NORMAL",
      color: "#0284c7",
      confidence: det.confidence || 0.90,
      speed: det.estimated_speed_kmh || 45
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

  // Poll backend for vision detections and real feed status with freshness/stale policy
  const fetchVisionStatus = useCallback(async () => {
    try {
      const res = await fetch(getApiUrl('/api/vision/cameras'));
      const data = await res.json();
      if (data && data.cameras) {
        const detMap = {};
        const statusMap = {};
        const tracksMap = {};
        data.cameras.forEach(c => {
          if (c.active_detection) {
            detMap[c.camera_id] = c.active_detection;
          }
          if (c.feed_status) {
            statusMap[c.camera_id] = c.feed_status;
          }
          // Policy: If worker is running, accept detections.
          // If worker is stopped and detection is expired (>10-12s aged or is_expired), clear detections!
          const isExpired = c.is_expired || (!c.is_running && c.detection_age_sec !== null && c.detection_age_sec !== undefined && c.detection_age_sec > 12.0);
          if (c.active_detections && c.active_detections.length > 0 && !isExpired) {
            tracksMap[c.camera_id] = c.active_detections;
          } else {
            tracksMap[c.camera_id] = [];
          }
        });
        setApiDetections(detMap);
        setCameraStatuses(statusMap);
        setActiveTracks(tracksMap);
      }
    } catch (err) {
      console.warn('Vision status fetch error:', err);
    }
  }, []);

  const handleStartFeed = async (camId) => {
    setFeedActionLoading(prev => ({ ...prev, [camId]: true }));
    try {
      await fetch(getApiUrl(`/api/vision/start-feed/${camId}?sample_interval=4`), {
        method: 'POST'
      });
      fetchVisionStatus();
    } catch (err) {
      console.error('Error starting camera feed:', err);
    } finally {
      setFeedActionLoading(prev => ({ ...prev, [camId]: false }));
    }
  };

  const handleStopFeed = async (camId) => {
    setFeedActionLoading(prev => ({ ...prev, [camId]: true }));
    // Immediately clear active tracks locally upon stop to prevent stale overlays over looping video
    setActiveTracks(prev => ({ ...prev, [camId]: [] }));
    try {
      await fetch(getApiUrl(`/api/vision/stop-feed/${camId}`), {
        method: 'POST'
      });
      fetchVisionStatus();
    } catch (err) {
      console.error('Error stopping camera feed:', err);
    } finally {
      setFeedActionLoading(prev => ({ ...prev, [camId]: false }));
    }
  };

  const handleProcessBatch = async (camId) => {
    setProcessingBatch(prev => ({ ...prev, [camId]: true }));
    try {
      const res = await fetch(getApiUrl(`/api/vision/process-batch/${camId}?max_frames=15`), {
        method: 'POST'
      });
      const data = await res.json();
      if (data && data.active_tracks) {
        setActiveTracks(prev => ({ ...prev, [camId]: data.active_tracks }));
      }
      fetchVisionStatus();
    } catch (err) {
      console.error('Error running batch detection:', err);
    } finally {
      setProcessingBatch(prev => ({ ...prev, [camId]: false }));
    }
  };

  // Adaptive Polling: 800ms when any camera worker is running or processing batch; 4000ms when all idle; pauses when backgrounded
  useEffect(() => {
    let timerId = null;

    const poll = async () => {
      // Pause polling if user switched tabs / minimized window
      if (document.hidden) {
        timerId = setTimeout(poll, 3000);
        return;
      }

      await fetchVisionStatus();

      const anyRunning = Object.values(cameraStatuses).some(s => s && s.is_running);
      const anyBatch = Object.values(processingBatch).some(b => b === true);
      const intervalMs = (anyRunning || anyBatch) ? 800 : 4000;

      timerId = setTimeout(poll, intervalMs);
    };

    const handleVisibilityChange = () => {
      if (!document.hidden) {
        fetchVisionStatus();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    poll();

    return () => {
      if (timerId) clearTimeout(timerId);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [cameraStatuses, processingBatch, fetchVisionStatus]);

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

  // Helper to render individual CCTV preview card with Real CV Worker integration
  const renderCameraCard = (camObj) => {
    if (!camObj) return null;
    const rawDet = apiDetections[camObj.backendCamId];
    const detInfo = getDetectionDetails(rawDet);
    const feedStatus = cameraStatuses[camObj.camId] || {};
    const isWorkerRunning = feedStatus.is_running || false;
    const isBatchProcessing = processingBatch[camObj.camId] || false;
    const isActionLoading = feedActionLoading[camObj.camId] || false;
    const framesCount = feedStatus.frames_processed || 0;
    const detectionAgeSec = feedStatus.detection_age_sec !== undefined && feedStatus.detection_age_sec !== null
      ? feedStatus.detection_age_sec
      : null;
    const isStale = detectionAgeSec !== null && !isWorkerRunning && detectionAgeSec > 6.0;
    const isExpired = feedStatus.is_expired || (detectionAgeSec !== null && !isWorkerRunning && detectionAgeSec > 12.0);
    const currentTracks = isExpired ? [] : (activeTracks[camObj.camId] || []);
    const vehiclesCount = currentTracks.length;
    const hasDetection = Boolean(detInfo) || vehiclesCount > 0;
    const hasError = videoErrors[camObj.camId];
    const hasVideo = Boolean(camObj.videoSrc) && !hasError;
    const camState = getCameraContext(camObj, currentNodeData);

    let badgeText = 'REPLAY READY';
    let badgeColor = '#64748b';
    let badgeBg = '#f1f5f9';
    let badgeBorder = '#cbd5e1';

    if (detInfo) {
      badgeText = detInfo.priority;
      badgeColor = detInfo.color;
      badgeBg = `${detInfo.color}15`;
      badgeBorder = `${detInfo.color}40`;
    } else if (isWorkerRunning) {
      badgeText = `CCTV REPLAY (${vehiclesCount} VEH)`;
      badgeColor = '#059669';
      badgeBg = '#ecfdf5';
      badgeBorder = '#a7f3d0';
    } else if (vehiclesCount > 0) {
      if (isStale) {
        badgeText = `STALE (${Math.round(detectionAgeSec)}s AGED)`;
        badgeColor = '#d97706';
        badgeBg = '#fffbeb';
        badgeBorder = '#fde68a';
      } else {
        badgeText = `CV BATCH (${vehiclesCount} VEH)`;
        badgeColor = '#0284c7';
        badgeBg = '#f0f9ff';
        badgeBorder = '#bae6fd';
      }
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
          border: hasDetection ? `2px solid ${detInfo ? detInfo.color : '#0284c7'}` : '1px solid #cbd5e1',
          borderRadius: '6px',
          padding: '0.65rem',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: hasDetection ? `0 0 12px ${detInfo ? detInfo.color : '#0284c7'}30` : '0 1px 3px rgba(0,0,0,0.05)',
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
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
            <span style={{
              fontSize: '0.525rem',
              fontWeight: 700,
              color: '#475569',
              backgroundColor: '#f8fafc',
              border: '1px solid #cbd5e1',
              padding: '0.08rem 0.35rem',
              borderRadius: '2px',
              fontFamily: 'monospace'
            }}>
              RECORDED REPLAY
            </span>
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
        </div>

        {/* Video Viewport Box with Exact 16:9 Aspect Ratio Frame Preservation */}
        <div
          onClick={() => setFullscreenCam({ ...camObj, juncName: currentConfig.name, intersectionId: currentConfig.intersectionId, detInfo, currentTracks, feedStatus })}
          style={{
            width: '100%',
            aspectRatio: '16 / 9',
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
              style={{ width: '100%', height: '100%', objectFit: 'fill', display: 'block' }}
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

          {/* Bottom-Right HUD Corner Indicator: LIVE SIGNAL COUNTDOWN + CCTV TIMESTAMP */}
          <div style={{
            position: 'absolute',
            bottom: '6px',
            right: '6px',
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            zIndex: 5
          }}>
            <div style={{
              fontSize: '0.6rem',
              fontFamily: 'monospace',
              fontWeight: 900,
              color: camState.isGreen ? '#10b981' : (camState.timerState === 'YELLOW' ? '#f59e0b' : '#ef4444'),
              background: 'rgba(15, 23, 42, 0.92)',
              padding: '0.1rem 0.35rem',
              borderRadius: '2px',
              border: `1px solid ${camState.isGreen ? '#10b981' : (camState.timerState === 'YELLOW' ? '#f59e0b' : '#ef4444')}`
            }}>
              ⏱ {formatTimer(currentNodeData?.timer_remaining ?? 0)}
            </div>
            <div style={{
              fontSize: '0.6rem',
              fontFamily: 'monospace',
              color: '#94a3b8',
              background: 'rgba(15, 23, 42, 0.85)',
              padding: '0.1rem 0.35rem',
              borderRadius: '2px'
            }}>
              {currentTime}
            </div>
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

          {/* REAL COMPUTER VISION / YOLOv8 TRACKING BOUNDING BOX OVERLAYS */}
          {currentTracks && currentTracks.length > 0 ? (
            <>
              {/* Asynchronous Frame Synchronization Transparency Badge */}
              <div style={{
                position: 'absolute',
                top: '5px',
                left: '50%',
                transform: 'translateX(-50%)',
                backgroundColor: isStale ? 'rgba(180, 83, 9, 0.95)' : 'rgba(15, 23, 42, 0.9)',
                border: `1px solid ${isStale ? '#f59e0b' : '#38bdf8'}`,
                color: isStale ? '#fef3c7' : '#e0f2fe',
                fontSize: '0.475rem',
                fontFamily: 'monospace',
                fontWeight: 800,
                padding: '0.08rem 0.35rem',
                borderRadius: '3px',
                pointerEvents: 'none',
                zIndex: 8,
                whiteSpace: 'nowrap',
                boxShadow: '0 2px 6px rgba(0,0,0,0.5)'
              }}>
                {isWorkerRunning ? '● CCTV REPLAY' : (isStale ? `⚠ STALE (${Math.round(detectionAgeSec)}s AGED)` : 'ASYNC SNAPSHOT')} • FRAME #{feedStatus.last_frame_idx || 0} (@{feedStatus.video_time_sec || 0}s)
              </div>

              {currentTracks.slice(0, 8).map((trk) => {
                const pct = trk.bbox_pct || { left: 20, top: 20, width: 25, height: 25 };
                const isEmerg = trk.class_label === 'AMBULANCE' || trk.class_label === 'FIRE ENGINE';
                const isBusTruck = trk.class_label === 'BUS' || trk.class_label === 'TRUCK';
                const boxColor = isEmerg ? '#ef4444' : (isBusTruck ? '#f59e0b' : '#10b981');
                return (
                  <div
                    key={`track-${trk.tracker_id || trk.track_id}`}
                    style={{
                      position: 'absolute',
                      top: `${pct.top}%`,
                      left: `${pct.left}%`,
                      width: `${pct.width}%`,
                      height: `${pct.height}%`,
                      border: isStale ? '2px dashed #f59e0b' : `2px solid ${boxColor}`,
                      borderRadius: '3px',
                      boxShadow: isStale ? '0 0 8px rgba(245, 158, 11, 0.5)' : `0 0 8px ${boxColor}80`,
                      opacity: isStale ? 0.75 : 1,
                      pointerEvents: 'none',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                      padding: '2px',
                      zIndex: 7
                    }}
                  >
                    <div style={{
                      backgroundColor: isStale ? '#b45309' : boxColor,
                      color: '#0f172a',
                      fontSize: '0.5rem',
                      fontWeight: 900,
                      fontFamily: 'monospace',
                      padding: '0.05rem 0.25rem',
                      borderRadius: '2px',
                      alignSelf: 'flex-start',
                      whiteSpace: 'nowrap'
                    }}>
                      {trk.class_label} #{trk.tracker_id || trk.track_id} | {Math.round((trk.confidence || 0.8) * 100)}%
                    </div>
                    {trk.heading && (
                      <div style={{
                        fontSize: '0.45rem',
                        color: isStale ? '#fde68a' : boxColor,
                        fontFamily: 'monospace',
                        alignSelf: 'flex-end',
                        backgroundColor: 'rgba(15,23,42,0.85)',
                        padding: '0.02rem 0.2rem',
                        borderRadius: '2px',
                        whiteSpace: 'nowrap'
                      }}>
                        {trk.heading}
                      </div>
                    )}
                  </div>
                );
              })}
            </>
          ) : (
            /* Empty state: No vehicles currently tracked or expired */
            <div style={{
              position: 'absolute',
              bottom: '22px',
              left: '6px',
              right: '6px',
              backgroundColor: 'rgba(15, 23, 42, 0.75)',
              border: '1px dashed #475569',
              borderRadius: '3px',
              padding: '0.2rem 0.4rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              pointerEvents: 'none',
              zIndex: 6
            }}>
              <span style={{ fontSize: '0.525rem', color: isExpired ? '#f59e0b' : '#94a3b8', fontFamily: 'monospace' }}>
                {isExpired
                  ? `DETECTIONS EXPIRED (${Math.round(detectionAgeSec || 12)}s AGED) — CLICK 'RUN BATCH'`
                  : (isWorkerRunning ? `YOLO TRACKING: SCANNING (0 ACTIVE IN FRAME #${feedStatus.last_frame_idx || 0})` : 'WORKER IDLE — NO ACTIVE DETECTIONS')}
              </span>
              <span style={{ fontSize: '0.5rem', color: '#64748b', fontFamily: 'monospace' }}>
                RECORDED REPLAY
              </span>
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

        {/* Real Backend CV Worker Controls & Status Bar */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          backgroundColor: '#0f172a',
          padding: '0.35rem 0.5rem',
          borderRadius: '4px',
          marginTop: '0.35rem',
          marginBottom: '0.35rem',
          border: '1px solid #1e293b'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', flexWrap: 'wrap' }}>
            <span style={{
              fontSize: '0.55rem',
              fontFamily: 'monospace',
              fontWeight: 800,
              color: isWorkerRunning ? '#10b981' : (framesCount > 0 ? '#38bdf8' : '#94a3b8')
            }}>
              {isWorkerRunning ? `● CV ACTIVE (${framesCount}f)` : (framesCount > 0 ? `○ BATCH DONE (${framesCount}f)` : '○ CV IDLE')}
            </span>
            {feedStatus?.last_update && (
              <span style={{ fontSize: '0.5rem', color: '#64748b', fontFamily: 'monospace' }}>
                {feedStatus.last_update}
              </span>
            )}
            {detectionAgeSec !== null && !isWorkerRunning && (
              <span style={{
                fontSize: '0.475rem',
                color: isExpired ? '#ef4444' : (isStale ? '#f59e0b' : '#38bdf8'),
                fontFamily: 'monospace',
                backgroundColor: 'rgba(255,255,255,0.06)',
                padding: '0.05rem 0.2rem',
                borderRadius: '2px'
              }}>
                AGE: {Math.round(detectionAgeSec)}s
              </span>
            )}
          </div>
          <div style={{ display: 'flex', gap: '0.3rem' }}>
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleProcessBatch(camObj.camId);
              }}
              disabled={isBatchProcessing}
              style={{
                backgroundColor: isBatchProcessing ? '#334155' : '#0284c7',
                color: '#ffffff',
                border: 'none',
                borderRadius: '3px',
                padding: '0.15rem 0.45rem',
                fontSize: '0.55rem',
                fontWeight: 800,
                fontFamily: 'monospace',
                cursor: isBatchProcessing ? 'not-allowed' : 'pointer',
                transition: 'all 0.15s'
              }}
              title="Run real YOLO detection on 15 frames from recorded video"
            >
              {isBatchProcessing ? 'RUNNING YOLO...' : 'RUN BATCH (15f)'}
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                if (isWorkerRunning) {
                  handleStopFeed(camObj.camId);
                } else {
                  handleStartFeed(camObj.camId);
                }
              }}
              disabled={isActionLoading}
              style={{
                backgroundColor: isWorkerRunning ? '#7f1d1d' : '#064e3b',
                color: isWorkerRunning ? '#fca5a5' : '#6ee7b7',
                border: `1px solid ${isWorkerRunning ? '#ef4444' : '#10b981'}`,
                borderRadius: '3px',
                padding: '0.15rem 0.45rem',
                fontSize: '0.55rem',
                fontWeight: 800,
                fontFamily: 'monospace',
                cursor: isActionLoading ? 'not-allowed' : 'pointer'
              }}
              title={isWorkerRunning ? "Stop background CV worker" : "Start real background CV inference worker"}
            >
              {isActionLoading ? '...' : (isWorkerRunning ? 'STOP FEED' : 'START FEED')}
            </button>
          </div>
        </div>

        {/* 2D MINI TRAFFIC SIGNAL INTEGRATED AT BOTTOM OF CARD */}
        {/* REAL-TIME SPATIAL GEOMETRY & LANE QUEUES (STAGE 3.1) */}
        {feedStatus?.spatial?.is_calibrated && (
          <div style={{
            backgroundColor: '#090d16',
            border: '1px solid #1e293b',
            borderRadius: '4px',
            padding: '0.3rem 0.45rem',
            marginBottom: '0.35rem',
            fontSize: '0.55rem',
            fontFamily: 'monospace',
            color: '#cbd5e1'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.2rem' }}>
              <span style={{ color: '#38bdf8', fontWeight: 800 }}>
                QUEUE: {feedStatus.spatial.queue_vehicle_count} VEH
              </span>
              <span style={{ color: '#10b981', fontSize: '0.5rem', fontWeight: 700 }}>
                CROSSINGS: {feedStatus.spatial.stop_line_crossings_count || 0}
              </span>
            </div>
            {/* Lane Queues & Density Percentages */}
            <div style={{ display: 'flex', gap: '0.25rem', flexWrap: 'wrap' }}>
              {Object.entries(feedStatus.spatial.lane_queues || {}).map(([lid, cnt]) => {
                const laneNum = lid.split('_').pop();
                const density = feedStatus.spatial.lane_densities?.[lid] || 0;
                const color = density > 75 ? '#ef4444' : (density > 45 ? '#f59e0b' : '#10b981');
                return (
                  <span key={lid} style={{
                    backgroundColor: 'rgba(255,255,255,0.05)',
                    border: `1px solid ${color}60`,
                    borderRadius: '2px',
                    padding: '0.05rem 0.25rem',
                    color: '#f8fafc'
                  }}>
                    L{laneNum}: <strong style={{ color }}>{cnt}</strong> ({Math.round(density)}%)
                  </span>
                );
              })}
            </div>
          </div>
        )}

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
          COMPUTER VISION DETECTION LAYER (RECORDED CCTV REPLAY • REAL YOLOv8 DETECTION)
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

              {/* Modal Large Video Viewport with Strict 16:9 Inner Canvas */}
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
                <div style={{
                  position: 'relative',
                  height: '100%',
                  maxHeight: '480px',
                  aspectRatio: '16 / 9',
                  backgroundColor: '#0f172a',
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
                    style={{ width: '100%', height: '100%', objectFit: 'fill', display: 'block' }}
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

                {/* Real Computer Vision Tracking Bounding Boxes (Modal) */}
                {(() => {
                  const modalStatus = cameraStatuses[fullscreenCam.camId] || {};
                  const modalAgeSec = modalStatus.detection_age_sec !== undefined && modalStatus.detection_age_sec !== null
                    ? modalStatus.detection_age_sec
                    : null;
                  const isModalRunning = modalStatus.is_running || false;
                  const isModalStale = modalAgeSec !== null && !isModalRunning && modalAgeSec > 6.0;
                  const isModalExpired = modalStatus.is_expired || (modalAgeSec !== null && !isModalRunning && modalAgeSec > 12.0);
                  const modalTracks = isModalExpired ? [] : (activeTracks[fullscreenCam.camId] || []);

                  if (modalTracks.length > 0) {
                    return (
                      <>
                        <div style={{
                          position: 'absolute',
                          top: '12px',
                          left: '50%',
                          transform: 'translateX(-50%)',
                          backgroundColor: isModalStale ? 'rgba(180, 83, 9, 0.95)' : 'rgba(15, 23, 42, 0.92)',
                          border: `1px solid ${isModalStale ? '#f59e0b' : '#38bdf8'}`,
                          color: isModalStale ? '#fef3c7' : '#e0f2fe',
                          fontSize: '0.625rem',
                          fontFamily: 'monospace',
                          fontWeight: 800,
                          padding: '0.15rem 0.5rem',
                          borderRadius: '4px',
                          pointerEvents: 'none',
                          zIndex: 8,
                          whiteSpace: 'nowrap',
                          boxShadow: '0 2px 8px rgba(0,0,0,0.6)'
                        }}>
                          {isModalRunning ? '● CCTV REPLAY' : (isModalStale ? `⚠ STALE SNAPSHOT (${Math.round(modalAgeSec)}s AGED)` : 'ASYNC SNAPSHOT')} • FRAME #{modalStatus.last_frame_idx || 0} (@{modalStatus.video_time_sec || 0}s)
                        </div>

                        {modalTracks.slice(0, 12).map((trk) => {
                          const pct = trk.bbox_pct || { left: 20, top: 20, width: 25, height: 25 };
                          const isEmerg = trk.class_label === 'AMBULANCE' || trk.class_label === 'FIRE ENGINE';
                          const isBusTruck = trk.class_label === 'BUS' || trk.class_label === 'TRUCK';
                          const boxColor = isEmerg ? '#ef4444' : (isBusTruck ? '#f59e0b' : '#10b981');
                          return (
                            <div
                              key={`modal-trk-${trk.tracker_id || trk.track_id}`}
                              style={{
                                position: 'absolute',
                                top: `${pct.top}%`,
                                left: `${pct.left}%`,
                                width: `${pct.width}%`,
                                height: `${pct.height}%`,
                                border: isModalStale ? '2px dashed #f59e0b' : `2px solid ${boxColor}`,
                                borderRadius: '4px',
                                boxShadow: isModalStale ? '0 0 10px rgba(245, 158, 11, 0.6)' : `0 0 12px ${boxColor}90`,
                                opacity: isModalStale ? 0.75 : 1,
                                pointerEvents: 'none',
                                display: 'flex',
                                flexDirection: 'column',
                                justifyContent: 'space-between',
                                padding: '4px',
                                zIndex: 7
                              }}
                            >
                              <div style={{
                                backgroundColor: isModalStale ? '#b45309' : boxColor,
                                color: '#0f172a',
                                fontSize: '0.65rem',
                                fontWeight: 900,
                                fontFamily: 'monospace',
                                padding: '0.1rem 0.35rem',
                                borderRadius: '2px',
                                alignSelf: 'flex-start'
                              }}>
                                {trk.class_label} #{trk.tracker_id || trk.track_id} | {Math.round((trk.confidence || 0.8) * 100)}%
                              </div>
                              <div style={{
                                fontSize: '0.55rem',
                                color: isModalStale ? '#fde68a' : boxColor,
                                fontFamily: 'monospace',
                                alignSelf: 'flex-end',
                                backgroundColor: 'rgba(15,23,42,0.85)',
                                padding: '0.05rem 0.25rem',
                                borderRadius: '2px'
                              }}>
                                {trk.heading || 'TRACKED'}
                              </div>
                            </div>
                          );
                        })}
                      </>
                    );
                  }
                  return (
                    <div style={{
                      position: 'absolute',
                      bottom: '40px',
                      left: '14px',
                      right: '14px',
                      backgroundColor: 'rgba(15, 23, 42, 0.8)',
                      border: '1px dashed #475569',
                      borderRadius: '4px',
                      padding: '0.4rem 0.75rem',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      pointerEvents: 'none',
                      zIndex: 6
                    }}>
                      <span style={{ fontSize: '0.7rem', color: isModalExpired ? '#f59e0b' : '#94a3b8', fontFamily: 'monospace' }}>
                        {isModalExpired
                          ? `DETECTIONS EXPIRED (${Math.round(modalAgeSec || 12)}s AGED) — CLICK 'PROCESS BATCH' OR START WORKER`
                          : (isModalRunning ? `YOLO TRACKING: SCANNING (0 ACTIVE IN FRAME #${modalStatus.last_frame_idx || 0})` : 'CV WORKER IDLE — NO ACTIVE DETECTIONS')}
                      </span>
                    </div>
                  );
                })()}

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

                {/* Bottom-Right HUD Corner Indicator: LIVE SIGNAL COUNTDOWN + CCTV TIME */}
                <div style={{
                  position: 'absolute',
                  bottom: '12px',
                  right: '14px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  zIndex: 5
                }}>
                  <div style={{
                    fontSize: '0.85rem',
                    fontFamily: 'monospace',
                    fontWeight: 900,
                    color: modalCamState.isGreen ? '#10b981' : (modalCamState.timerState === 'YELLOW' ? '#f59e0b' : '#ef4444'),
                    background: 'rgba(15, 23, 42, 0.95)',
                    padding: '0.25rem 0.6rem',
                    borderRadius: '3px',
                    border: `1px solid ${modalCamState.isGreen ? '#10b981' : (modalCamState.timerState === 'YELLOW' ? '#f59e0b' : '#ef4444')}`
                  }}>
                    ⏱ {formatTimer(intersections.find(i => i.intersection_id === fullscreenCam.intersectionId)?.timer_remaining ?? 0)}
                  </div>
                  <div style={{
                    fontSize: '0.8rem',
                    fontFamily: 'monospace',
                    color: '#94a3b8',
                    background: 'rgba(15, 23, 42, 0.85)',
                    padding: '0.25rem 0.5rem',
                    borderRadius: '3px',
                    border: '1px solid #334155'
                  }}>
                    CCTV TIME: {currentTime}
                  </div>
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
                </div> {/* End 16:9 Inner Canvas Stage */}
              </div>

              {/* Modal Controls Footer */}
              <div style={{
                backgroundColor: '#1e293b',
                padding: '0.85rem 1rem',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                borderTop: '1px solid #334155',
                flexWrap: 'wrap',
                gap: '0.5rem'
              }}>
                <div style={{ fontSize: '0.725rem', fontFamily: 'monospace', color: '#38bdf8', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.65rem', flexWrap: 'wrap' }}>
                  <span>
                    YOLOv8: <strong>{(activeTracks[fullscreenCam.camId] || []).length} VEH</strong>
                  </span>
                  <span style={{ color: '#94a3b8' }}>|</span>
                  <span style={{ color: cameraStatuses[fullscreenCam.camId]?.is_running ? '#10b981' : '#f59e0b' }}>
                    WORKER: <strong>{cameraStatuses[fullscreenCam.camId]?.is_running ? 'RUNNING' : 'IDLE'}</strong>
                  </span>
                  <span style={{ color: '#94a3b8' }}>|</span>
                  <span style={{ color: '#cbd5e1' }}>
                    FRAME: <strong>#{cameraStatuses[fullscreenCam.camId]?.last_frame_idx || 0} (@{cameraStatuses[fullscreenCam.camId]?.video_time_sec || 0}s)</strong>
                  </span>
                  {cameraStatuses[fullscreenCam.camId]?.detection_age_sec !== undefined && cameraStatuses[fullscreenCam.camId]?.detection_age_sec !== null && (
                    <>
                      <span style={{ color: '#94a3b8' }}>|</span>
                      <span style={{ color: cameraStatuses[fullscreenCam.camId]?.detection_age_sec > 6 ? '#f59e0b' : '#10b981' }}>
                        AGE: <strong>{Math.round(cameraStatuses[fullscreenCam.camId]?.detection_age_sec)}s</strong>
                      </span>
                    </>
                  )}
                  <span style={{ color: '#94a3b8' }}>|</span>
                  <span style={{ color: '#cbd5e1' }}>
                    RECORDED REPLAY
                  </span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <button
                    onClick={() => handleProcessBatch(fullscreenCam.camId)}
                    disabled={processingBatch[fullscreenCam.camId]}
                    style={{
                      backgroundColor: processingBatch[fullscreenCam.camId] ? '#334155' : '#0284c7',
                      color: '#ffffff',
                      border: 'none',
                      borderRadius: '4px',
                      padding: '0.3rem 0.65rem',
                      fontSize: '0.7rem',
                      fontWeight: 800,
                      fontFamily: 'monospace',
                      cursor: processingBatch[fullscreenCam.camId] ? 'not-allowed' : 'pointer'
                    }}
                  >
                    {processingBatch[fullscreenCam.camId] ? 'RUNNING YOLO...' : 'PROCESS BATCH (15f)'}
                  </button>
                  <button
                    onClick={() => {
                      if (cameraStatuses[fullscreenCam.camId]?.is_running) {
                        handleStopFeed(fullscreenCam.camId);
                      } else {
                        handleStartFeed(fullscreenCam.camId);
                      }
                    }}
                    style={{
                      backgroundColor: cameraStatuses[fullscreenCam.camId]?.is_running ? '#7f1d1d' : '#064e3b',
                      color: cameraStatuses[fullscreenCam.camId]?.is_running ? '#fca5a5' : '#6ee7b7',
                      border: `1px solid ${cameraStatuses[fullscreenCam.camId]?.is_running ? '#ef4444' : '#10b981'}`,
                      borderRadius: '4px',
                      padding: '0.3rem 0.65rem',
                      fontSize: '0.7rem',
                      fontWeight: 800,
                      fontFamily: 'monospace',
                      cursor: 'pointer'
                    }}
                  >
                    {cameraStatuses[fullscreenCam.camId]?.is_running ? 'STOP WORKER' : 'START WORKER'}
                  </button>
                  <div style={{ fontSize: '0.7rem', color: '#64748b', fontFamily: 'monospace' }}>
                    ESC TO CLOSE
                  </div>
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
