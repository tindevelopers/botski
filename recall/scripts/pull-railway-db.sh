#!/usr/bin/env bash
# Pull PostgreSQL dump from Railway and import into local Docker Postgres.
# Requires: Railway CLI (railway link + login), pg_dump on PATH, local Docker DB running.
# Usage: from recall/: ./scripts/pull-railway-db.sh
set -e
RECALL_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
BACKUP="$RECALL_ROOT/scripts/railway_backup.sql"
cd "$RECALL_ROOT"

if ! command -v railway &> /dev/null; then
  echo "❌ Railway CLI not found. Install with: npm i -g @railway/cli"
  echo "   Then: railway login"
  exit 1
fi
if ! railway whoami &> /dev/null; then
  echo "❌ Not logged in to Railway. Run: railway login"
  exit 1
fi
if ! railway status &> /dev/null; then
  echo "❌ Project not linked. Run from repo root: railway link"
  exit 1
fi
if ! command -v pg_dump &> /dev/null; then
  echo "❌ pg_dump not found. Install PostgreSQL client tools (e.g. brew install libpq)."
  exit 1
fi

echo "Pulling database from Railway..."
railway run bash -c 'pg_dump "$DATABASE_URL" --no-owner --no-acl' > "$BACKUP"
echo "Dump saved to scripts/railway_backup.sql"

echo "Importing into local Postgres..."
"$RECALL_ROOT/scripts/import-railway-backup.sh" "$BACKUP"
echo "Done."
