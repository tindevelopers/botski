#!/usr/bin/env bash
# Run the app on localhost using the remote DB and env from Vercel (pulled via Vercel CLI).
# Usage: ./run-local-with-vercel-db.sh
set -e
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"
ENV_FILE="recall/.env"

if [[ ! -f "$ENV_FILE" ]] || [[ "$1" == "--pull" ]]; then
  if ! command -v vercel &> /dev/null; then
    echo "❌ Vercel CLI not found. Install with: npm i -g vercel, then vercel login"
    exit 1
  fi
  echo "Pulling env from Vercel into recall/.env..."
  ./recall/scripts/pull-vercel-env.sh
fi

if [[ ! -f "$ENV_FILE" ]]; then
  echo "❌ recall/.env not found. Run: ./recall/scripts/pull-vercel-env.sh"
  exit 1
fi

echo "🚀 Starting app on localhost with env from Vercel (remote DB)"
echo "   Main: http://localhost:3003"
echo "   Worker (other terminal): cd recall && npm run dev:worker"
echo ""
cd recall
npm run dev
