#!/bin/bash
# Start worker with proper logging. Uses REDIS_URL from .env (remote or local).
set -e

echo "🚀 Starting recall worker locally..."
echo ""

# Load environment first so we know if we're using remote Redis
if [ -f .env ]; then
    export $(grep -v '^#' .env | xargs)
fi
export REDIS_URL="${REDIS_URL:-redis://127.0.0.1:6379}"

# Only check/start local Redis when not using a remote REDIS_URL
if [[ "$REDIS_URL" == "redis://127.0.0.1"* ]] || [[ "$REDIS_URL" == "redis://localhost"* ]]; then
  if ! (echo "PING" | nc -w 1 localhost 6379 &>/dev/null 2>&1); then
    echo "⚠️  Redis is not running on localhost:6379"
    echo ""
    echo "📦 Attempting to start Redis..."
    if command -v docker &> /dev/null && docker ps &> /dev/null 2>&1; then
      docker run -d --name redis-local -p 6379:6379 redis:6.2-alpine 2>/dev/null || docker start redis-local 2>/dev/null
      sleep 2
    elif command -v brew &> /dev/null && brew services list 2>/dev/null | grep -q redis; then
      brew services start redis
      sleep 2
    elif command -v redis-server &> /dev/null; then
      redis-server --daemonize yes --port 6379
      sleep 2
    else
      echo "❌ Redis not available. Install Redis or set REDIS_URL to a remote Redis in .env"
      exit 1
    fi
    if ! (echo "PING" | nc -w 1 localhost 6379 &>/dev/null 2>&1); then
      echo "❌ Failed to start Redis."
      exit 1
    fi
  fi
  echo "✅ Using local Redis: $REDIS_URL"
else
  echo "✅ Using remote Redis (REDIS_URL from .env)"
fi
echo ""

echo "📋 Starting worker process..."
echo "   NODE_ENV: ${NODE_ENV:-development}"
echo "   REDIS_URL: ${REDIS_URL}"
echo ""

NODE_ENV=${NODE_ENV:-development} npm run start:worker
