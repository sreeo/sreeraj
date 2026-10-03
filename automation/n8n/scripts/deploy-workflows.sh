#!/usr/bin/env bash
# Import every workflow in ../workflows, publish it, restart n8n so the triggers register,
# then create the data tables (idempotent). The JSON files in the repo are the source of truth.
set -euo pipefail

HERE="$(cd "$(dirname "$0")/.." && pwd)"
CONTAINER="${N8N_CONTAINER:-redesign-n8n-n8n-1}"
BASE="${N8N_LOCAL_URL:-http://127.0.0.1:5678}"

docker exec "$CONTAINER" rm -rf /tmp/workflows
docker cp "$HERE/workflows" "$CONTAINER:/tmp/workflows"
docker exec -u root "$CONTAINER" chown -R node /tmp/workflows
docker exec "$CONTAINER" n8n import:workflow --separate --input=/tmp/workflows

for f in "$HERE"/workflows/*.json; do
  id="$(python3 -c 'import json,sys; print(json.load(open(sys.argv[1]))["id"])' "$f")"
  docker exec "$CONTAINER" n8n publish:workflow --id="$id" >/dev/null
  echo "published $id"
done

# Published triggers register only at start-up.
since="$(date -u +%FT%TZ)"
( cd "$HERE" && docker compose restart n8n >/dev/null )
until docker logs --since "$since" "$CONTAINER" 2>&1 | grep -q "Finished building workflow dependency index"; do sleep 2; done

curl -fsS -X POST "$BASE/webhook/setup-redesign-tables" >/dev/null
echo "data tables ready"
curl -fsS "$BASE/webhook/redesign-feedback" | head -c 300; echo
