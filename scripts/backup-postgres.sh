#!/usr/bin/env bash
set -e

mkdir -p backups

docker exec cometlms-postgres pg_dump -U cometlms cometlms > backups/cometlms-$(date +%Y%m%d-%H%M%S).sql

echo "Backup complete"
