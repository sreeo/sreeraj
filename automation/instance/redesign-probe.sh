#!/usr/bin/env bash
#
# Weekly health check for the monthly redesign, so a broken login or service is found days
# before the 1st, not during the run. Checks both agent providers (Claude Code, Codex), the
# local decider and n8n, and posts to the n8n alert webhook (Discord) when something fails.
# Run by sreeraj-redesign-probe.timer; safe to run by hand.
set -uo pipefail

REPO_DIR="${REDESIGN_REPO_DIR:-$HOME/.local/share/sreeraj-redesign/repo}"
N8N_URL="${N8N_URL:-http://127.0.0.1:5678}"
DECIDER_URL="${DECIDER_URL:-http://127.0.0.1:8000}"

export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
# shellcheck disable=SC1091
[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"
nvm use default >/dev/null 2>&1 || true

notify() {  # level title message
  [ -n "${N8N_WEBHOOK_TOKEN:-}" ] || return 0
  LEVEL="$1" TITLE="$2" MESSAGE="$3" python3 -c 'import json,os; print(json.dumps({"level": os.environ["LEVEL"], "title": os.environ["TITLE"], "message": os.environ["MESSAGE"]}))' \
    | curl -fsS -m 15 -X POST "$N8N_URL/webhook/redesign-alert" -H "x-redesign-token: $N8N_WEBHOOK_TOKEN" \
        -H 'content-type: application/json' --data-binary @- >/dev/null 2>&1 || true
}

problems=()
if [ -d "$REPO_DIR/automation/node_modules" ]; then
  PROBE="$(cd "$REPO_DIR/automation" && timeout 300 npx tsx pipeline/probe.ts 2>&1 >/dev/null | grep '^probe ')"
  echo "$PROBE"
  while read -r line; do
    case "$line" in *": OK") ;; "") ;; *) problems+=("$line") ;; esac
  done <<< "$PROBE"
else
  problems+=("redesign clone has no automation/node_modules; run the redesign service once")
fi
curl -fsS -m 10 "$DECIDER_URL/healthz" >/dev/null 2>&1 || problems+=("decider is down ($DECIDER_URL/healthz)")
curl -fsS -m 10 "$N8N_URL/healthz" >/dev/null 2>&1 || problems+=("n8n is down ($N8N_URL/healthz)")

if [ ${#problems[@]} -eq 0 ]; then
  echo "probe: all OK"
  exit 0
fi
printf 'probe: %s\n' "${problems[@]}"
# Both agent providers down means the next run cannot start at all.
level=warn
if printf '%s\n' "${problems[@]}" | grep -q 'probe claude' && printf '%s\n' "${problems[@]}" | grep -q 'probe codex'; then level=error; fi
notify "$level" "Redesign health check: ${#problems[@]} problem(s)" \
  "$(printf -- '- %s\n' "${problems[@]}")
Fix: renew CLAUDE_CODE_OAUTH_TOKEN (claude setup-token) or run codex login --device-auth; restart services with docker compose up -d in ~/n8n."
exit 1
