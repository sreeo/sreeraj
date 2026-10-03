#!/usr/bin/env bash
# Create the shared secret that guards the redesign webhooks (header x-redesign-token), import
# it into n8n as the "Redesign webhook token" credential, and give it to the runner as
# N8N_WEBHOOK_TOKEN in its env file. Idempotent; the token is never printed.
set -euo pipefail

CONTAINER="${N8N_CONTAINER:-redesign-n8n-n8n-1}"
SECRETS="${SECRETS_DIR:-$HOME/n8n/secrets}"
RUNNER_ENV="${REDESIGN_ENV_FILE:-$HOME/.config/sreeraj-redesign/env}"
TOKEN_FILE="$SECRETS/webhook-token"

umask 077
mkdir -p "$SECRETS"
[ -s "$TOKEN_FILE" ] || head -c 32 /dev/urandom | base64 | tr -dc 'A-Za-z0-9' | head -c 40 > "$TOKEN_FILE"

TMP="$(mktemp)"; trap 'rm -f "$TMP"' EXIT
TOKEN_FILE="$TOKEN_FILE" python3 - > "$TMP" <<'PY'
import json, os
token = open(os.environ["TOKEN_FILE"]).read().strip()
print(json.dumps([{
    "id": "rdWebhookToken01",
    "name": "Redesign webhook token",
    "type": "httpHeaderAuth",
    "data": {"name": "x-redesign-token", "value": token},
}]))
PY
docker cp "$TMP" "$CONTAINER:/tmp/token-cred.json"
docker exec -u root "$CONTAINER" chown node /tmp/token-cred.json
docker exec "$CONTAINER" n8n import:credentials --input=/tmp/token-cred.json
docker exec "$CONTAINER" rm -f /tmp/token-cred.json

if [ -f "$RUNNER_ENV" ] && ! grep -q '^N8N_WEBHOOK_TOKEN=' "$RUNNER_ENV"; then
  printf '\n# Shared secret for the n8n redesign webhooks (header x-redesign-token).\nN8N_WEBHOOK_TOKEN=%s\n' "$(cat "$TOKEN_FILE")" >> "$RUNNER_ENV"
  echo "Added N8N_WEBHOOK_TOKEN to $RUNNER_ENV"
fi
echo "Webhook token ready. Callers send header: x-redesign-token: <token from $TOKEN_FILE>"
