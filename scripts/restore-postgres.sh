#!/usr/bin/env bash
set -e

if [ -z "$1" ]; then
  echo "Usage: restore-postgres.sh <backup.sql>"
  exit 1
fi

cat "$1" | docker exec -i cometlms-postgres psql -U cometlms -d cometlms

echo "Restore complete"
