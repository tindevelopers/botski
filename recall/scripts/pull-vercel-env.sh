#!/usr/bin/env bash
# Pull environment variables from Vercel into recall/.env for local dev with remote DB.
# Overwrites PUBLIC_URL with http://localhost:3003 so OAuth and links work on localhost.
# Usage: from repo root: ./recall/scripts/pull-vercel-env.sh
#        or from recall/: ./scripts/pull-vercel-env.sh
set -e
REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
RECALL_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ENV_FILE="$RECALL_ROOT/.env"
cd "$REPO_ROOT"

if ! command -v vercel &> /dev/null; then
  echo "❌ Vercel CLI not found. Install with: npm i -g vercel"
  echo "   Then: vercel login"
  exit 1
fi

echo "Pulling env from Vercel into recall/.env..."
vercel env pull "$ENV_FILE" --yes 2>/dev/null || vercel env pull "$ENV_FILE"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "❌ Failed to create $ENV_FILE. Run 'vercel link' in the repo root if needed."
  exit 1
fi

# Force localhost for local dev (OAuth callbacks, links)
if grep -q "^PUBLIC_URL=" "$ENV_FILE"; then
  if [[ "$(uname)" == "Darwin" ]]; then
    sed -i '' 's|^PUBLIC_URL=.*|PUBLIC_URL=http://localhost:3003|' "$ENV_FILE"
  else
    sed -i 's|^PUBLIC_URL=.*|PUBLIC_URL=http://localhost:3003|' "$ENV_FILE"
  fi
else
  echo "PUBLIC_URL=http://localhost:3003" >> "$ENV_FILE"
fi

echo "✅ Wrote $ENV_FILE (PUBLIC_URL set to http://localhost:3003 for local dev)."
echo "   Start app: cd recall && npm run dev"
