# Deploying Trinetra Backend to Railway (Railpack / Nixpacks)

This guide walks you through deploying the FastAPI backend on [Railway](https://railway.app/) using **Railpack / Nixpacks** (no Docker required).

---

## What We Configured For Railpack
The project now includes all files required for Railpack v0.39.0+ and Nixpacks auto-detection:
- `requirements.txt` (Dependencies: FastAPI, Uvicorn standard with WebSockets support, Pydantic, httpx)
- `start.sh` (Auto-detects backend directory and binds to Railway's dynamic `$PORT`)
- `Procfile` (Standard web worker process runner)
- `railway.json` & `nixpacks.toml` (Healthcheck on `/api/health`, Nixpacks build instructions)

---

## Step-by-Step Deployment Instructions

### Step 1: Push Changes to GitHub
Commit and push the new files to your GitHub repository:
```bash
git add .
git commit -m "Add Railway Railpack deployment configuration and dynamic port handling"
git push origin main
```

---

### Step 2: Deploy on Railway Dashboard

1. Go to [railway.app](https://railway.app/) and log in.
2. Click **"New Project"** -> **"Deploy from GitHub repo"**.
3. Select your repository: `NexGenX` (or your repo name).
4. Railway will automatically detect the Python environment via `requirements.txt` and start the build with Railpack.

*(Optional)* If you only want to build the backend service:
- In the Railway Service **Settings** tab -> **Source Directory / Root Directory**, you can set `/backend` (or leave it empty `/`, both are supported!).

---

### Step 3: Add Environment Variables in Railway

In your Railway Project Dashboard -> **Variables** tab, add:

| Variable Name | Recommended Value | Description |
| :--- | :--- | :--- |
| `FEATHERLESS_API_KEY` | *(Your Featherless AI API key)* | Optional for LLM reasoning |
| `FEATHERLESS_MODEL` | `meta-llama/Meta-Llama-3.1-70B-Instruct` | Target LLM model |
| `ENVIRONMENT` | `production` | Deployment mode |
| `CORS_ORIGINS` | `*` *(or your frontend domain)* | Allowed CORS origins |

> **Note on `PORT`**: Railway automatically assigns and injects the `PORT` environment variable. You **do not** need to manually define `PORT` in Variables.

---

### Step 4: Generate a Public Domain

1. In Railway, click on your backend service.
2. Go to the **Settings** tab.
3. Scroll down to **Networking** -> **Public Networking**.
4. Click **"Generate Domain"** (e.g. `trinetra-backend.up.railway.app`).

---

### Step 5: Verify Deployment

Once deployed, visit your Railway URL in your browser:
- **Root Status**: `https://<your-railway-domain>.up.railway.app/`
- **Swagger Docs**: `https://<your-railway-domain>.up.railway.app/docs`
- **Health Check**: `https://<your-railway-domain>.up.railway.app/api/health`
- **WebSocket Endpoint**: `wss://<your-railway-domain>.up.railway.app/api/ws/telemetry`

---

### Step 6: Connect Your Frontend

In your frontend deployment (Vercel, Netlify, or `.env.production`):
Set the environment variable:
```env
VITE_API_URL=https://<your-railway-domain>.up.railway.app
```
*(The frontend automatically derives the secure WebSocket `wss://` URL from `VITE_API_URL`)*.
