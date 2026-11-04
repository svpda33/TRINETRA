# NexTrAI — Urban Traffic Intelligence & Management Platform

**Project Category:** Intelligent Transportation Systems (ITS)  
**System Designation:** NexTrAI Enterprise ITMS Command Engine  
**Deployment Corridor:** Hyderabad Smart IT Corridor (Cyber Towers — Mindspace — Bio-Diversity — Gachibowli)

---

## 📌 Executive Summary

**NexTrAI** is an independent, city-scale intelligent edge-and-central traffic management platform. It fuses **Multi-Camera Automatic Number Plate Recognition (ANPR)**, **Deep Learning Computer Vision (YOLOv8)**, **Spatio-Temporal Trajectory Reconstruction**, **Geographic Information Systems (GIS)**, **Google Gemini AI Traffic Intelligence**, and **Deterministic Traffic Signal Safety Orchestration** into a unified urban command-center platform.

Key Capabilities:
1. **Multi-Camera ANPR & Re-Identification:** Real-time license plate detection and OCR using **YOLOv8** vehicle localization, **EasyOCR** text extraction, and strict Indian **MoRTH HSRP (High-Security Registration Plate)** and **BH (Bharat Series)** regex validation.
2. **Spatio-Temporal Trajectory Reconstruction:** Multi-junction vehicle journey mapping, point-to-point average speed calculation, travel time analysis, and anomalous movement flags.
3. **Automated Watchlist & Containment Grid:** Instant O(1) memory lookup for stolen, flagged, and wanted vehicles with automated containment signal strategies verified through the safety layer.
4. **Interactive GIS Traffic Command Map:** Full geo-referenced visualization powered by **Leaflet** on OpenStreetMap/CartoDB tiles calibrated for the **Hyderabad Smart IT Corridor** (I1: Cyber Towers $\leftrightarrow$ I2: Mindspace $\leftrightarrow$ I3: Bio-Diversity $\leftrightarrow$ I4: Gachibowli). Features layer controls, one-click bounds fitting, camera provenance disclosure, and live phase countdown meters.
5. **Urban Traffic Analytics:** Automated Modal Split classification, Turning Movement Counts (TMC), Origin-Destination (O-D) flow matrices, and real-time corridor bottleneck identification.
6. **Deterministic Safety Validator:** Zero-compromise safety rules (12-movement conflict matrix, minimum 10s green, 3-4s yellow + 2s all-red clearance, 8/8 passing automated safety test suite according to IRC:67 guidelines).
7. **Google Gemini AI Traffic Intelligence:** Real-time narrative operational briefings, signal decision explanations, congestion insights, and interactive operator co-pilot chat powered by Google GenAI. All AI outputs remain strictly advisory with physical signals protected by deterministic safety layers.

---

## 🏗️ System Architecture

```mermaid
graph TD
    subgraph Edge & Camera Sensing Layer
        C1["Camera I1: Cyber Towers (4 Approaches)"] --> CV[YOLOv8 Vehicle Detection & Spatial Tracker]
        C2["Camera I2: Mindspace (4 Approaches)"] --> CV
        C3["Camera I3: Bio-Diversity"] --> CV
        C4["Camera I4: Gachibowli"] --> CV
        CV --> OCR[EasyOCR + Image Preprocessing CLAHE / Bilateral]
        OCR --> VAL[MoRTH HSRP & BH Regex Validator]
    end

    subgraph Central Intelligence & Storage
        VAL --> DB[(SQLite / SQLAlchemy Persistence\nnextrai.db)]
        DB --> TE[Spatio-Temporal Trajectory Engine]
        DB --> WL[Watchlist & Security Alert Dispatcher]
        DB --> AN[Urban Traffic Analytics Engine\nModal Split | TMC | O-D Matrix]
    end

    subgraph Signal Orchestration & Safety Core
        WL --> ADAPT[Adaptive Signal Controller\nReal-Time Queue Balancing]
        ADAPT --> EM[6-State Emergency Preemption FSM]
        EM --> DSV[Deterministic Safety Validator\nIRC:67 12-Movement Conflict Matrix]
        DSV --> SIG[Traffic Signal Controllers]
    end

    subgraph AI Advisory & Co-Pilot Layer
        DB --> GEMINI[Google Gemini AI Engine\ngemini-3.5-flash]
        GEMINI -.->|Advisory Summaries & Explanations| UI
    end

    subgraph ITMS Command Center Dashboard
        TE --> UI[React 18 ITMS Command Center]
        WL --> UI
        AN --> UI
        SIG --> UI
        GIS[Leaflet GIS Topology Engine] --> UI
    end
```

---

## 🛡️ Core Safety Foundations

NexTrAI adheres to the principle: **The AI is an advisory co-pilot; safety is non-negotiable and deterministic.**

- **Rule 1: Exclusive Approach & Geometrical Conflict Gate**  
  Opposing conflict movements (e.g., North-to-South vs East-to-West) can **never** receive concurrent green displays under any circumstances.
- **Rule 2: Clearance Phase Enforcement**  
  Every signal transition requires a minimum of 3-4 seconds of Yellow clearance followed by 2 seconds of All-Red clearance before opening opposing approaches.
- **Rule 3: Deterministic Preemption FSM**  
  Emergency corridors transition through a formal 6-state finite state machine (`IDLE` $\rightarrow$ `DETECTION` $\rightarrow$ `WAITING_CLEARANCE` $\rightarrow$ `ACTIVE` $\rightarrow$ `HOLD` $\rightarrow$ `RECOVERY`), ensuring zero abrupt transitions or hazardous clearance cancellations.
- **Rule 4: Sensor Loss Graceful Degradation**  
  If camera feeds or telemetry packets drop, controllers never assume zero traffic; they enter safe rotation mode based on wait timers.

---

## 🚀 Quick Start Guide

### Prerequisites
- **Python:** 3.10+ (tested on Python 3.11, 3.12, 3.14)
- **Node.js:** 18+ and npm
- **Google Gemini API Key:** (optional, for Gemini AI Traffic Assistant)

### 1. Backend Setup
```bash
# Clone the repository
git clone https://github.com/your-org/NexTrAI.git
cd NexTrAI

# Set up virtual environment
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Configure environment
cp .env.example .env
# Edit .env and insert your GEMINI_API_KEY (optional)

# Start backend server
python -m uvicorn app.main:app --app-dir backend --host 127.0.0.1 --port 8000 --reload
```

### 2. Frontend Setup
```bash
cd frontend
npm install
npm run dev
```
Open `http://127.0.0.1:5173/` in your browser.

---

## 🧪 Testing & Verification

Run the complete automated test suite (60 tests covering CV pipeline, spatial geometry, adaptive signal control, emergency preemption, corridor coordination, Gemini AI integration, and GIS map telemetry):

```bash
# Run all backend tests with pytest
python -m pytest backend/tests/ -o pythonpath=backend -v

# Run frontend production build check
cd frontend
npm run build
```

---

## ⚠️ Current System Boundaries & Disclosures

1. **CCTV Data Provenance**: Video inputs are sourced from pre-recorded MP4 clips (`RECORDED_CCTV_REPLAY`) sampled at controlled frame intervals ($k=4$). Telemetry status reflects active video stream processing (`ACTIVE_REPLAY_STREAM`). The platform does not claim unverified live municipal CCTV hardware integration.
2. **Camera Coordinate Precision**: Camera coordinates on the Hyderabad GIS map represent calibrated directional approach offsets ($\sim 60\text{m} - 75\text{m}$ along approach lines from junction centroids) with `location_confidence: APPROXIMATE_APPROACH_OFFSET` and `gps_verified: False`.
3. **Physical Signal Isolation**: NexTrAI is an ITMS software platform. For safety, signal transitions are governed by deterministic Webster-delay logic and validated by the immutable 12-movement conflict matrix in `DeterministicSafetyValidator`. Google Gemini operates strictly as an advisory diagnostic co-pilot with zero actuation authority.
4. **License Plate & Detection Heuristics**: Auto-rickshaw classification uses bounding box aspect-ratio heuristics. EasyOCR runs on local CPU/GPU for MoRTH-standard plates; extreme angles, motion blur, and non-standard stylized fonts may reduce character accuracy.
5. **Corridor Segments**: The active I1–I2 corridor ($\sim 850\text{m}$) is fully monitored with dual-camera coverage. The downstream segments to Bio-Diversity (I3, $\sim 1400\text{m}$) and Gachibowli (I4, $\sim 2600\text{m}$) represent planned corridor expansion topology.

---

## 📜 License & Disclosures

- **License Status:** The project code is prepared for open-source distribution. Formal license selection (e.g., Apache 2.0 or MIT) is pending final maintainer authorization prior to public repository release.
- **Hardware Integration:** Production municipal deployment requires certified NEMA TS2, Type 170, or Type 2070 traffic signal controllers interfacing via NTCIP 1202 standards.
