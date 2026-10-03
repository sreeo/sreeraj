#!/usr/bin/env bash
# Create the SSH key n8n uses to run `gh` on the host, authorize it for the n8n Docker
# network only, and import it into n8n as the "Redesign host (gh CLI)" credential.
# The private key never leaves this host. Run as the user whose gh login n8n should use.
set -euo pipefail

CONTAINER="${N8N_CONTAINER:-redesign-n8n-n8n-1}"
NETWORK="${N8N_NETWORK:-redesign-n8n_default}"
SECRETS="${SECRETS_DIR:-$HOME/n8n/secrets}"
KEY="$SECRETS/n8n_host_ed25519"

mkdir -p "$SECRETS" && chmod 700 "$SECRETS"
[ -f "$KEY" ] || ssh-keygen -q -t ed25519 -N "" -C n8n-redesign -f "$KEY"

SUBNET="$(docker network inspect "$NETWORK" -f '{{(index .IPAM.Config 0).Subnet}}')"
mkdir -p ~/.ssh && touch ~/.ssh/authorized_keys && chmod 600 ~/.ssh/authorized_keys
if ! grep -q n8n-redesign ~/.ssh/authorized_keys; then
  echo "from=\"$SUBNET\",no-port-forwarding,no-agent-forwarding,no-X11-forwarding,no-pty $(cat "$KEY.pub")" >> ~/.ssh/authorized_keys
fi

TMP="$(mktemp)"; trap 'rm -f "$TMP"' EXIT
KEY="$KEY" USER_NAME="$(id -un)" python3 - > "$TMP" <<'PY'
import json, os
print(json.dumps([{
    "id": "rdHostSshKey0001",
    "name": "Redesign host (gh CLI)",
    "type": "sshPrivateKey",
    "data": {"host": "host.docker.internal", "port": 22, "username": os.environ["USER_NAME"],
             "privateKey": open(os.environ["KEY"]).read(), "passphrase": ""},
}]))
PY
docker cp "$TMP" "$CONTAINER:/tmp/cred.json"
docker exec -u root "$CONTAINER" chown node /tmp/cred.json
docker exec "$CONTAINER" n8n import:credentials --input=/tmp/cred.json
docker exec "$CONTAINER" rm -f /tmp/cred.json
echo "SSH credential ready (authorized from $SUBNET only)."
