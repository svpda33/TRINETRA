#!/bin/bash
set -e

# If running from root directory, navigate to backend
if [ -d "backend" ]; then
  cd backend
fi

PORT_NUM=${PORT:-8000}
echo "Starting Trinetra API Server on port $PORT_NUM..."
exec python -m uvicorn app.main:app --host 0.0.0.0 --port "$PORT_NUM"
