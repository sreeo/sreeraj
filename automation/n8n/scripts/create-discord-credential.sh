#!/usr/bin/env bash
# Import the Discord webhook used for redesign alerts as the n8n credential
# "Redesign alerts (Discord)". Pass the URL on stdin so it never lands in shell history:
#   scripts/create-discord-credential.sh < url.txt      (or paste, then Ctrl-D)
set -euo pipefail
CONTAINER="${N8N_CONTAINER:-redesign-n8n-n8n-1}"
URL="$(tr -d '[:space:]')"
case "$URL" in https://discord.com/api/webhooks/*|https://discordapp.com/api/webhooks/*) ;; *) echo "not a Discord webhook URL" >&2; exit 1 ;; esac
umask 077
TMP="$(mktemp)"; trap 'rm -f "$TMP"' EXIT
URL="$URL" python3 -c 'import json,os; print(json.dumps([{"id": "rdDiscordHook001", "name": "Redesign alerts (Discord)", "type": "discordWebhookApi", "data": {"webhookUri": os.environ["URL"]}}]))' > "$TMP"
docker cp "$TMP" "$CONTAINER:/tmp/discord-cred.json"
docker exec -u root "$CONTAINER" chown node /tmp/discord-cred.json
docker exec "$CONTAINER" n8n import:credentials --input=/tmp/discord-cred.json
docker exec "$CONTAINER" rm -f /tmp/discord-cred.json
echo "Discord credential ready."
