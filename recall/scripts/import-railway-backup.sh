#!/usr/bin/env bash
# Import a Railway pg_dump into local Docker Postgres.
# Usage:
#   1. Put railway_backup.sql in this directory (recall/scripts/) or in recall/
#   2. From recall/: ./scripts/import-railway-backup.sh [path/to/railway_backup.sql]
set -e
BACKUP="${1:-scripts/railway_backup.sql}"
if [[ ! -f "$BACKUP" ]]; then
  echo "Backup file not found: $BACKUP"
  echo "Put railway_backup.sql in recall/ or recall/scripts/ and run:"
  echo "  ./scripts/import-railway-backup.sh [path/to/railway_backup.sql]"
  exit 1
fi
echo "Importing $BACKUP into local Postgres..."
docker exec -i recall-calrecall-db-1 psql -U recall -d recall < "$BACKUP"
echo "Done."
