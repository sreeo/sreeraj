#!/usr/bin/env bash
#
# Monthly redesign runner for the Hetzner instance.
#
# A faithful port of .github/workflows/full-redesign.yml — trend discovery →
# creative rebuild (claude -p) → build → Layout QA & Fix stage → open PR — with
# the new agentic Layout QA stage replacing the old validate + vision-feedback
# loop. Runs unattended via a systemd user timer.
#
# Safety: operates ONLY on a dedicated managed clone (REPO_DIR), never your dev
# checkout; hard-resets it to origin/main every run; opens a PR and never
# auto-merges or deploys (deploy stays on GitHub via deploy.yml on push to main).
#
# Usage:
#   redesign-run.sh full     # default — full monthly redesign + PR
#   redesign-run.sh check    # plumbing only: checkout+deps+build+geometry, no
#                            # API key, no agent, no PR (safe to run anytime)
set -euo pipefail

MODE="${1:-full}"

# --- Config (override via systemd EnvironmentFile / shell env) ---
REPO_URL="${REDESIGN_REPO_URL:-https://github.com/sreeo/sreeraj.git}"
REPO_DIR="${REDESIGN_REPO_DIR:-$HOME/.local/share/sreeraj-redesign/repo}"
BASE_BRANCH="${REDESIGN_BASE_BRANCH:-main}"
HC_URL="${HEALTHCHECK_URL:-}"            # optional healthchecks.io ping URL
export PLAYWRIGHT_CHROME_CHANNEL="${PLAYWRIGHT_CHROME_CHANNEL:-chrome}"

# --- Load nvm so node/npm/npx/tsx/claude resolve under systemd (no login shell) ---
export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
# shellcheck disable=SC1091
[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"
nvm use default >/dev/null 2>&1 || true

log() { echo "[$(date -u +%FT%TZ)] $*"; }
hc()  { [ -n "$HC_URL" ] && curl -fsS -m 10 "${HC_URL}${1:-}" >/dev/null 2>&1 || true; }

trap 'rc=$?; if [ $rc -ne 0 ]; then hc "/fail"; log "FAILED rc=$rc"; fi' EXIT
hc "/start"
log "=== Monthly redesign (mode=$MODE, host=$(hostname)) ==="

# --- 1. Clean, pinned checkout (never the dev clone) ---
if [ ! -d "$REPO_DIR/.git" ]; then
  mkdir -p "$(dirname "$REPO_DIR")"
  git clone "$REPO_URL" "$REPO_DIR"
fi
cd "$REPO_DIR"
git fetch --prune origin
# Fail loudly if the configured base branch no longer exists on origin — e.g. a
# test override (REDESIGN_BASE_BRANCH) left pointing at a since-merged/deleted
# feature branch. Without this the reset below fails with a cryptic error.
if ! git rev-parse --verify --quiet "origin/$BASE_BRANCH" >/dev/null; then
  log "FATAL: base branch origin/$BASE_BRANCH not found on origin."
  log "       Set REDESIGN_BASE_BRANCH correctly in the env file (production = main)."
  exit 2
fi
git checkout -B "$BASE_BRANCH" "origin/$BASE_BRANCH"
git reset --hard "origin/$BASE_BRANCH"
git clean -fd   # full clean; npm ci below rebuilds node_modules reproducibly

# --- 2. Dependencies (clean, reproducible install) ---
npm ci
( cd automation && npm ci )

# --- check mode: verify instance plumbing only (no key, no agent, no PR) ---
if [ "$MODE" = "check" ]; then
  npm run build
  ( cd automation && npx tsx layout-geometry.ts ) || true
  log "check mode OK — checkout, deps, build and geometry analyzer all work"
  hc ""
  exit 0
fi

# --- Auth ---
# Generation (claude -p), the Agent SDK layout fixer, the vision gate and trend
# discovery all run on the Claude Code SESSION (subscription/OAuth) — no API key.
# An ANTHROPIC_API_KEY is OPTIONAL and only used by the non-blocking Webwright
# reviewer. NOTE: if a key IS set, claude/the SDK switch to API-billing mode and
# will fail on an invalid key — so leave it unset to use session auth.
if [ -n "${ANTHROPIC_API_KEY:-}" ]; then
  log "ANTHROPIC_API_KEY is set — API-billing mode (also used by Webwright)."
else
  log "No ANTHROPIC_API_KEY — using Claude Code session auth; Webwright will skip."
fi

# --- 3. Discover the design trend (web search + Claude; registry fallback) ---
TREND="${REDESIGN_TREND:-}"
if [ -z "$TREND" ]; then
  TREND=$(cd automation && npx tsx -e "
    import { discoverTrend } from './trend-discovery.js';
    import fs from 'fs';
    const log = fs.existsSync('history/design-log.json') ? JSON.parse(fs.readFileSync('history/design-log.json','utf-8')) : { designs: [] };
    const last = log.designs.length ? log.designs[log.designs.length-1].trendName : null;
    const t = await discoverTrend(log, last);
    console.log(t.name + ' — ' + t.description);
  " 2>/dev/null) || TREND=""
  if [ -z "$TREND" ] || echo "$TREND" | grep -qi error; then
    log "Trend discovery failed; falling back to registry."
    TREND=$(cd automation && npx tsx -e "
      import { selectTrend } from './trend-registry.js';
      const t = selectTrend({ designs: [] });
      console.log(t.name + ' — ' + t.description);
    ")
  fi
fi
log "Trend: $TREND"

# --- 4. Build the rebuild prompt from the template ---
cp automation/prompts/full-rebuild.md /tmp/rebuild-prompt.md
TREND="$TREND" python3 - <<'PY'
import os, re
p = '/tmp/rebuild-prompt.md'
s = open(p).read().replace('{{TREND}}', os.environ['TREND'])
hist = 'No previous designs yet.'
try:
    import json
    d = json.load(open('automation/history/design-log.json'))
    rows = [f"- {x['month']}: {x['trendName']} ({x['status']})" for x in d.get('designs', [])[-6:]]
    if rows: hist = "\n".join(rows)
except Exception:
    pass
s = s.replace('{{DESIGN_HISTORY}}', hist)
open(p, 'w').write(s)
PY

# --- 5. Creative rebuild (generation stays on Claude Code) ---
claude -p "$(cat /tmp/rebuild-prompt.md)" --print --dangerously-skip-permissions --max-turns 50 \
  || log "claude rebuild exited non-zero (continuing with changes made)"

# --- 6. Build ---
npm run build

# --- 7. Layout QA & Fix stage (deterministic geometry + Agent SDK + webwright) ---
QA_RC=0
( cd automation && npx tsx layout-qa-stage.ts ) || QA_RC=$?
log "layout-qa exit: $QA_RC"

# --- 8. Record the design in the log (used by trend discovery to avoid repeats) ---
TREND="$TREND" python3 - <<'PY'
import json, os, datetime
p = 'automation/history/design-log.json'
try:
    log = json.load(open(p))
except Exception:
    log = {'designs': []}
now = datetime.datetime.now(datetime.timezone.utc)
log.setdefault('designs', []).append({
    'month': now.strftime('%Y-%m'),
    'trendId': 'full-rebuild',
    'trendName': os.environ['TREND'],
    'status': 'success',
    'timestamp': now.isoformat(),
    'description': os.environ['TREND'],
})
json.dump(log, open(p, 'w'), indent=2)
PY

# --- 9. Open a PR (never auto-merge; deploy happens on merge to main) ---
if git diff --quiet && git diff --quiet --cached; then
  log "No changes generated; nothing to PR."
  hc ""
  exit 0
fi
BRANCH="redesign/$(date -u +%Y%m%d-%H%M%S)"
git checkout -b "$BRANCH"
git add -A
git commit -m "Monthly redesign: ${TREND:0:60}"
git push -u origin "$BRANCH"
SUMMARY="automation/test-output/layout-qa-summary.md"
BODY="Automated monthly redesign on $(hostname).\n\n**Trend:** ${TREND}"
[ -f "$SUMMARY" ] && BODY="$(printf '%b\n\n---\n\n' "$BODY"; cat "$SUMMARY")"
gh pr create --title "Monthly redesign: ${TREND:0:60}" \
  --body "$BODY" --head "$BRANCH" --base "$BASE_BRANCH" \
  || log "PR creation failed (push succeeded; open the PR manually)"

log "=== done ==="
hc ""
