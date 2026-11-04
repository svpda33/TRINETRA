# Contributing to NexTrAI

Thank you for your interest in contributing to **NexTrAI — Urban Traffic Intelligence & Management Platform**!

NexTrAI is an Intelligent Transportation Systems (ITS) software platform that manages high-density arterial corridors, combining edge computer vision, deterministic signal optimization, GIS spatial mapping, and Google Gemini AI operations intelligence.

---

## 1. Code of Conduct & Development Principles

To maintain the architectural integrity, safety, and security of NexTrAI, all contributors must observe these core principles:

1. **Safety is Deterministic and Absolute**:
   - The AI / LLM component is **strictly an advisory co-pilot**. It must never directly actuate signals, modify green durations, or bypass safety interlocks.
   - All signal plans must pass through the `DeterministicSafetyValidator` enforcing the immutable 12-movement conflict matrix under IRC:67 guidelines.
2. **Data Transparency & Provenance**:
   - Prerecorded video streams must always be labeled `RECORDED_CCTV_REPLAY`.
   - Never label recorded video as live municipal CCTV.
   - Camera coordinates must remain flagged with `APPROXIMATE_APPROACH_OFFSET` and `gps_verified: False` unless actual differential GPS ground-truth coordinates are provided.
3. **Zero Secrets in Repository**:
   - Never commit `.env` files, API keys, tokens, or credentials.
   - Secrets must always be injected via environment variables.

---

## 2. Local Development Setup

### 2.1 Backend Setup
```bash
# Clone your fork
git clone https://github.com/<your-username>/NexTrAI.git
cd NexTrAI

# Create virtual environment
python -m venv venv
# On Windows:
venv\Scripts\activate
# On Linux/macOS:
source venv/bin/activate

# Install dependencies
pip install -r backend/requirements.txt

# Configure environment
cp .env.example .env
# Edit .env with your local settings (e.g. GEMINI_API_KEY)
```

### 2.2 Frontend Setup
```bash
cd frontend
npm install
npm run dev
```

---

## 3. Project Structure

```
NexTrAI/
├── backend/
│   ├── app/
│   │   ├── api/             # FastAPI REST & WebSocket route handlers
│   │   ├── models/          # Pydantic schemas and SQLAlchemy ORM models
│   │   └── services/        # Business logic engines
│   │       ├── adaptive_signal_service.py     # Webster-delay density controller
│   │       ├── cv_engine.py                   # YOLOv8 + IoU multi-object tracking
│   │       ├── emergency_priority_service.py  # 6-state preemption FSM
│   │       ├── gemini_service.py              # Google GenAI SDK integration
│   │       ├── gis_engine.py                  # Spatial topology & distance engine
│   │       ├── safety_validator.py            # IRC:67 12-movement conflict validator
│   │       ├── spatial_geometry_service.py    # Lane polygons & stop-line crossing
│   │       └── video_ingestion_service.py     # Video stream workers & camera feeds
│   └── tests/               # Pytest automated test suites
├── frontend/
│   ├── src/
│   │   ├── components/      # React functional UI components
│   │   │   ├── HyderabadTrafficMap.jsx        # Interactive Leaflet GIS command map
│   │   │   ├── AIReasoningPanel.jsx           # Gemini AI operations assistant
│   │   │   └── ...
│   │   └── App.jsx          # Root dashboard component
│   └── package.json
├── requirements.txt
├── .env.example
├── CONTRIBUTING.md
└── README.md
```

---

## 4. Testing & Quality Assurance Expectations

Before opening a pull request, ensure that all automated tests pass and the frontend builds cleanly without warnings:

```bash
# 1. Run full backend pytest suite
python -m pytest backend/tests/ -o pythonpath=backend -v

# 2. Verify frontend production compilation
cd frontend
npm run build
```

Every new feature or bug fix must include corresponding tests in `backend/tests/`.

---

## 5. Pull Request Guidelines

1. **Branch Naming**: Use descriptive branch names:
   - `feature/adaptive-queue-improvement`
   - `fix/gis-coordinate-precision`
   - `docs/setup-guide-refinement`
2. **Commit Messages**: Write clear, imperative commit messages (e.g. `feat: add queue debt penalty in Webster cycle allocation`).
3. **No Breaking Changes to Safety Core**: PRs that modify `safety_validator.py` or relax clearance times (min-green 10s, yellow 3s, all-red 2s) will be rejected unless backed by official IRC / MoRTH amendments.
