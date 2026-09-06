#!/bin/bash
set -e

PORT_NUM=${PORT:-8000}
echo "Starting Trinetra API Server on port $PORT_NUM..."
exec python -m uvicorn app.main:app --host 0.0.0.0 --port "$PORT_NUM"
