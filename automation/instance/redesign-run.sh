#!/usr/bin/env bash
#
# Monthly redesign runner for the Hetzner instance.
#
# Stages: trend discovery -> creative rebuild (agent adapter) -> build
#         -> [checkpoint] -> Layout QA & Fix stage -> open PR
#
# Resumable: after the expensive rebuild+build, the working-tree changes are
# saved as a git patch OUTSIDE the clone. If a later stage crashes, re-run in
# `resume` mode — it fresh-resets the clone, re-applies the patch, and continues
# from Layout QA without regenerating. (A crash DURING generation has no
# checkpoint yet, so just run `full` again.)
#
# Everything Claude-powered runs on the Claude Code session (no API key); see
# README. Opens a PR; never auto-merges or deploys.
#
# Usage:
#   redesign-run.sh full      # default — fresh run; checkpoints after generation
#   redesign-run.sh resume    # re-apply the saved checkpoint, continue at Layout QA
#   redesign-run.sh check     # plumbing only: checkout+deps+build+geometry, no PR
#
# Env: REDESIGN_DRY_RUN=1 runs stages but skips commit/push/PR.
set -euo pipefail

MODE="${1:-full}"

# --- Config (override via systemd EnvironmentFile / shell env) ---
REPO_URL="${REDESIGN_REPO_URL:-https://github.com/sreeo/sreeraj.git}"
REPO_DIR="${REDESIGN_REPO_DIR:-$HOME/.local/share/sreeraj-redesign/repo}"
BASE_BRANCH="${REDESIGN_BASE_BRANCH:-main}"
STATE_DIR="${REDESIGN_STATE_DIR:-$HOME/.local/share/sreeraj-redesign/state}"
HC_URL="${HEALTHCHECK_URL:-}"
DRY_RUN="${REDESIGN_DRY_RUN:-0}"
# Claude model for the preflight and the creative rebuild. Pinned on purpose: a full ID,
# not an alias, so the model only changes when this line does.
CLAUDE_MODEL="${REDESIGN_CLAUDE_MODEL:-claude-opus-5-5}"
export PLAYWRIGHT_CHROME_CHANNEL="${PLAYWRIGHT_CHROME_CHANNEL:-chrome}"
# Ubuntu 26.04 can't download Playwright's bundled browsers — we use system
# Chrome via the channel above. Make any stray `playwright install` a no-op so
# it can never hang the run (this bit the first full run via claude's self-check).
export PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD="${PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD:-1}"

# --- Load nvm so node/npm/npx/tsx/claude resolve under systemd ---
export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
# shellcheck disable=SC1091
[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"
nvm use default >/dev/null 2>&1 || true

log() { echo "[$(date -u +%FT%TZ)] $*"; }
hc()  { [ -n "$HC_URL" ] && curl -fsS -m 10 "${HC_URL}${1:-}" >/dev/null 2>&1 || true; }

trap 'rc=$?; if [ $rc -ne 0 ]; then hc "/fail"; log "FAILED rc=$rc (state kept in '"$STATE_DIR"'; run: redesign-run.sh resume)"; fi' EXIT
hc "/start"
log "=== Monthly redesign (mode=$MODE, dry=$DRY_RUN, host=$(hostname)) ==="

mkdir -p "$STATE_DIR"

# --- 1. Clean, pinned checkout (ALWAYS fresh-reset — hygiene over the clone) ---
if [ ! -d "$REPO_DIR/.git" ]; then
  mkdir -p "$(dirname "$REPO_DIR")"
  git clone "$REPO_URL" "$REPO_DIR"
fi
cd "$REPO_DIR"
git fetch --prune origin
if ! git rev-parse --verify --quiet "origin/$BASE_BRANCH" >/dev/null; then
  log "FATAL: base branch origin/$BASE_BRANCH not found on origin."
  log "       Set REDESIGN_BASE_BRANCH correctly in the env file (production = main)."
  exit 2
fi
# Scrub the working tree FIRST — the clone persists between runs, so a previous
# run's leftover changes (incl. untracked files) would otherwise make the
# branch switch abort ("untracked working tree files would be overwritten").
git reset --hard HEAD 2>/dev/null || true
git clean -fd
git checkout -fB "$BASE_BRANCH" "origin/$BASE_BRANCH"
git reset --hard "origin/$BASE_BRANCH"
git clean -fd   # full clean; npm ci below rebuilds node_modules reproducibly

# --- 2. Dependencies (clean, reproducible install) ---
npm ci
( cd automation && npm ci )

# --- check mode: verify instance plumbing only (no agent, no PR) ---
if [ "$MODE" = "check" ]; then
  npm run build
  ( cd automation && npx tsx layout-geometry.ts ) || true
  log "check mode OK — checkout, deps, build and geometry analyzer all work"
  hc ""
  exit 0
fi

# --- Auth ---
# Every agent step (rebuild, layout fixer, vision gate, trend research) runs through
# automation/pipeline/agent.ts on the host's SUBSCRIPTION logins — Claude Code
# (CLAUDE_CODE_OAUTH_TOKEN) first, Codex (ChatGPT login) as fallback. No API key.
# An ANTHROPIC_API_KEY is OPTIONAL and only used by the non-blocking Webwright
# reviewer. NOTE: if a key IS set, claude switches to API-billing mode and will
# fail on an invalid key — so leave it unset to use the subscription.
if [ -n "${ANTHROPIC_API_KEY:-}" ]; then
  log "ANTHROPIC_API_KEY is set — API-billing mode (also used by Webwright)."
else
  log "No ANTHROPIC_API_KEY — using Claude Code session auth; Webwright will skip."
fi

# Preflight: prove at least one agent provider (Claude Code or Codex) can answer BEFORE
# mutating anything. The Claude login expiring broke the 2026-10-01 run; with Codex as a
# fallback, one expired login no longer stops the month.
export REDESIGN_CLAUDE_MODEL="$CLAUDE_MODEL"
if [ "$MODE" != "check" ]; then
  if ! PROBE_OUT="$(cd automation && timeout 300 npx tsx pipeline/probe.ts 2>&1)"; then
    log "FATAL: no agent provider can authenticate — no redesign attempted."
    printf '%s\n' "$PROBE_OUT" | grep -E '^probe ' | while read -r l; do log "       $l"; done
    log "       Fix: renew CLAUDE_CODE_OAUTH_TOKEN (claude setup-token) or run 'codex login --device-auth',"
    log "       then: systemctl --user start sreeraj-redesign.service"
    exit 4
  fi
  printf '%s\n' "$PROBE_OUT" | grep -E '^probe ' | while read -r l; do log "Preflight: $l"; done
  log "Auth preflight OK (claude model: $CLAUDE_MODEL)."
fi

STAGE_FILE="$STATE_DIR/stage"
PATCH_FILE="$STATE_DIR/generation.patch"
TREND_FILE="$STATE_DIR/trend.txt"

if [ "$MODE" = "resume" ]; then
  # --- Resume: re-apply the saved generation checkpoint, skip to Layout QA ---
  if [ "$(cat "$STAGE_FILE" 2>/dev/null)" != "generation" ] || [ ! -s "$PATCH_FILE" ]; then
    log "Nothing to resume — no saved generation checkpoint in $STATE_DIR."
    exit 1
  fi
  TREND="$(cat "$TREND_FILE" 2>/dev/null || echo 'Resumed redesign')"
  log "Resuming: applying saved generation patch, skipping trend + rebuild."
  git apply --whitespace=nowarn "$PATCH_FILE" || { log "FATAL: could not apply generation patch."; exit 3; }
else
  # --- Full: clear stale state, then generate ---
  rm -f "$STAGE_FILE" "$PATCH_FILE" "$TREND_FILE"

  # --- Archive the OUTGOING design as an edition (self-maintaining archives) ---
  # HEAD is still the current/live design here. Tag it edition/<its-month> and
  # add a registry entry with that sourceRef; rebuild-archives (run at deploy)
  # then builds its frozen snapshot from current content. Skipped if the live
  # manifest has no month or it equals this run's month.
  # REDESIGN_MONTH overrides the month (used for rehearsal/back-dated runs).
  NEW_MONTH="${REDESIGN_MONTH:-$(date -u +%Y-%m)}"
  ARCHIVE_INFO="$(NEW_MONTH="$NEW_MONTH" python3 - <<'PY'
import json, os
try:
    m = json.load(open('src/data/design-manifest.json'))
except Exception:
    m = {}
out = m.get('month')
if out and out != os.environ['NEW_MONTH']:
    print('\t'.join([out, m.get('trend', 'Previous design'),
                     m.get('description', ''), m.get('primaryColor', '#000000'),
                     json.dumps(m.get('fingerprint') or {})]))
PY
)"
  if [ -n "$ARCHIVE_INFO" ]; then
    OUT_MONTH="$(printf '%s' "$ARCHIVE_INFO" | cut -f1)"
    # Remember the outgoing trend so the manifest stamp can tell whether the
    # rebuild actually rewrote the manifest for the new design.
    PREV_TREND="$(printf '%s' "$ARCHIVE_INFO" | cut -f2)"
    log "Archiving outgoing design as edition $OUT_MONTH"
    git tag -f "edition/$OUT_MONTH" HEAD >/dev/null 2>&1 || true
    git push -f origin "edition/$OUT_MONTH" >/dev/null 2>&1 || log "edition tag push failed (continuing)"
    ARCHIVE_INFO="$ARCHIVE_INFO" python3 - <<'PY'
import json, os, datetime
month, trend, desc, color, fp = (os.environ['ARCHIVE_INFO'].split('\t') + ['{}'])[:5]
p = 'public/archive/registry.json'
try:
    reg = json.load(open(p))
except Exception:
    reg = {'archives': []}
reg['archives'] = [a for a in reg.get('archives', []) if a.get('month') != month]
reg['archives'].append({
    'month': month, 'trend': trend, 'description': desc, 'primaryColor': color,
    'deployedAt': datetime.datetime.now(datetime.timezone.utc).isoformat(),
    'sourceRef': f'edition/{month}',
    **({'fingerprint': json.loads(fp)} if fp and fp != '{}' else {}),
})
reg['archives'].sort(key=lambda a: a['month'], reverse=True)
json.dump(reg, open(p, 'w'), indent=2, ensure_ascii=False)
open(p, 'a').write('\n')
PY
  else
    log "No outgoing edition to archive (manifest has no month, or same month)."
  fi

  # 3. Decide the design style. pipeline/ideation.ts researches candidates (three
  # researcher agents with web search), drops repeats of the archive and of styles
  # rejected in PR reviews (n8n), scores the shortlist (local decider + two judges)
  # and decides in code. It prints the trend line on stdout and writes the full spec
  # to automation/history/current-trend.json plus test-output/decision*.{json,md}.
  # pick-trend.ts (the style registry) is the fallback. Clear stale outputs first so
  # a manual REDESIGN_TREND override can't pick up last month's files.
  rm -f automation/history/current-trend.json automation/test-output/decision.json automation/test-output/decision-summary.md \
        automation/test-output/e2e-summary.md automation/test-output/agent-calls.jsonl \
        automation/test-output/visual-qa-summary.md automation/test-output/visual-qa.json \
        automation/test-output/gallery.md
  rm -rf automation/test-output/visual
  TREND="${REDESIGN_TREND:-}"
  if [ -z "$TREND" ]; then
    TREND="$(cd automation && timeout 3600 npx tsx pipeline/ideation.ts 2>>/tmp/ideation.err)" || TREND=""
    if [ -z "$TREND" ]; then
      log "Ideation produced nothing (see /tmp/ideation.err); falling back to the style registry."
      TREND="$(cd automation && npx tsx pick-trend.ts 2>>/tmp/pick-trend.err)" || TREND=""
    fi
    if [ -z "$TREND" ]; then
      log "Trend selection produced nothing; using a safe default."
      TREND="Editorial Minimalism — restrained type-driven layout, generous whitespace, a single accent, clear hierarchy"
    fi
  fi
  printf '%s' "$TREND" > "$TREND_FILE"
  log "Trend: $TREND"

  # 4. Build the rebuild prompt from the template.
  cp automation/prompts/full-rebuild.md /tmp/rebuild-prompt.md
  TREND="$TREND" python3 - <<'PY'
import os, json
p = '/tmp/rebuild-prompt.md'
s = open(p).read().replace('{{TREND}}', os.environ['TREND'])
hist = 'No previous designs yet.'
try:
    d = json.load(open('automation/history/design-log.json'))
    rows = [f"- {x['month']}: {x['trendName']} ({x['status']})" for x in d.get('designs', [])[-6:]]
    if rows: hist = "\n".join(rows)
except Exception:
    pass
s = s.replace('{{DESIGN_HISTORY}}', hist)
# Inject the full style spec written by pick-trend (structure/typography/
# spacing/interactions/references). Without this the rebuild only ever saw a
# one-line trend and the registry's rich specs were discarded.
spec = 'No detailed specification available — interpret the style line above with conviction and research the idiom yourself.'
try:
    t = json.load(open('automation/history/current-trend.json'))
    parts = [f"**{k.capitalize()}:** {t[k]}" for k in ('structure', 'typography', 'color', 'spacing', 'interactions', 'motifs', 'references', 'lessons') if t.get(k)]
    if parts: spec = "\n\n".join(parts)
except Exception:
    pass
s = s.replace('{{TREND_SPEC}}', spec)
open(p, 'w').write(s)
PY

  # 5. Creative rebuild (agent adapter: Claude Code, falling back to Codex).
  # A non-zero exit may still mean useful work (e.g. hit max-turns), so don't
  # abort on it alone — the substantive check is the src/ diff below.
  REBUILD_RC=0
  # Runs on the implementer role's provider order (Claude, then Codex) — see pipeline/roles.json.
  ( cd automation && npx tsx pipeline/rebuild.ts /tmp/rebuild-prompt.md ) \
    || REBUILD_RC=$?
  [ "$REBUILD_RC" -ne 0 ] && log "rebuild exited $REBUILD_RC"
  # The tests, prompts and pipeline that judge the design are off limits to the agent.
  log "$(cd automation && npx tsx pipeline/guard.ts 2>&1 | tail -1)"

  # HARD GATE: the rebuild must actually have changed the presentation layer.
  # Without this, a failed rebuild (e.g. expired OAuth) still produced a PR
  # whose only content was the runner's own bookkeeping — a "redesign" that
  # just bumped the month. No src/ change = no redesign = abort.
  if git diff --quiet -- src/ && [ -z "$(git status --porcelain -- src/)" ]; then
    log "FATAL: the creative rebuild produced NO changes under src/ (rc=$REBUILD_RC)."
    log "       Refusing to open a bookkeeping-only PR. Nothing was pushed."
    log "       Check the log above for the cause (auth expiry, max-turns, API error),"
    log "       then re-run: systemctl --user start sreeraj-redesign.service"
    exit 5
  fi
  log "Rebuild changed $(git status --porcelain -- src/ | wc -l) file(s) under src/."

  # Stamp this run's month + trend into the new design's manifest, so next
  # month's run can archive it as edition/$NEW_MONTH.
  NEW_MONTH="$NEW_MONTH" TREND="$TREND" PREV_TREND="${PREV_TREND:-}" python3 - <<'PY'
import json, os, re
p = 'src/data/design-manifest.json'
try:
    m = json.load(open(p))
except Exception:
    m = {}
m['month'] = os.environ['NEW_MONTH']
# The rebuild is supposed to rewrite this manifest for the new design. If it
# left the OUTGOING design's trend in place (or none), record this run's trend
# ourselves — otherwise the manifest would describe last month's design with
# only the month bumped (the 2026-08 failure).
prev = os.environ.get('PREV_TREND', '')
if not m.get('trend') or (prev and m['trend'] == prev):
    m['trend'] = os.environ['TREND'].split(' — ')[0]
    m['description'] = os.environ['TREND']
if not m.get('primaryColor'):
    try:
        css = open('src/styles/global.css').read()
        hit = re.search(r'--color-accent:\s*(#[0-9a-fA-F]{3,8})', css)
        m['primaryColor'] = hit.group(1) if hit else '#000000'
    except Exception:
        m['primaryColor'] = '#000000'
# Fingerprint of the chosen style, so next month's ideation can compare against it.
try:
    fp = json.load(open('automation/history/current-trend.json')).get('fingerprint')
    if fp:
        m['fingerprint'] = fp
except Exception:
    pass
json.dump(m, open(p, 'w'), indent=2, ensure_ascii=False)
open(p, 'a').write('\n')
PY

  # 6. Build.
  npm run build

  # --- Checkpoint: save the generation as a patch OUTSIDE the clone ---
  git add -A
  git diff --cached --binary > "$PATCH_FILE"
  git reset -q
  echo generation > "$STAGE_FILE"
  log "Checkpoint saved (generation) -> $PATCH_FILE"
fi

# --- 6b. E2E stage: blocking invariants (routes, content, data-qa contract, nav, overflow,
# archive) with an agent fix loop. A design that still fails becomes a DRAFT PR.
E2E_RC=0
( cd automation && npx tsx pipeline/e2e-stage.ts ) || E2E_RC=$?
log "e2e exit: $E2E_RC"

# --- 7. Layout QA & Fix stage (deterministic geometry + agent fixer + webwright) ---
QA_RC=0
( cd automation && npx tsx layout-qa-stage.ts ) || QA_RC=$?
log "layout-qa exit: $QA_RC"

# --- 7b. Visual QA: 14 page templates at 390/1280px, a typed vision verdict per page, a
# code gate (only high-severity layout breakage blocks) and a bounded fix loop.
VQA_RC=0
( cd automation && npx tsx pipeline/visual-qa.ts ) || VQA_RC=$?
log "visual-qa exit: $VQA_RC"

# --- 8. Record the design in the log (used by trend discovery to avoid repeats) ---
# Record the ACTUAL outcome, not a hardcoded success — a design logged as
# 'success' is treated as shipped and avoided by future trend discovery.
TREND="$TREND" NEW_MONTH="${NEW_MONTH:-}" QA_RC="$QA_RC" python3 - <<'PY'
import json, os, datetime
p = 'automation/history/design-log.json'
try:
    log = json.load(open(p))
except Exception:
    log = {'designs': []}
now = datetime.datetime.now(datetime.timezone.utc)
import re as _re
log.setdefault('designs', []).append({
    'month': os.environ.get('NEW_MONTH') or now.strftime('%Y-%m'),
    # Slug of the trend name (not a constant) so registry recency-avoidance
    # can match cron-produced entries.
    'trendId': _re.sub(r'[^a-z0-9]+', '-', os.environ['TREND'].split(' — ')[0].lower()).strip('-'),
    'trendName': os.environ['TREND'],
    'status': 'success' if os.environ.get('QA_RC') == '0' else 'layout-qa-failed',
    'timestamp': now.isoformat(),
    'description': os.environ['TREND'],
})
json.dump(log, open(p, 'w'), indent=2, ensure_ascii=False)
open(p, 'a').write('\n')
PY

# --- 8b. Generate archive snapshots so /archive/<month>/ is COMMITTED in the PR ---
# The archive step registered the outgoing edition in the registry + tagged it,
# but the frozen snapshot DIRECTORY must also exist in the committed tree —
# otherwise /archive/<month>/ 404s in any build that didn't run archives:rebuild
# first (PR preview, local build), and there's no fallback if the deploy-time
# rebuild fails. Generate them now so the `git add -A` below commits them.
log "Generating archive snapshots for commit..."
( cd automation && npx tsx rebuild-archives.ts ) \
  || log "archive snapshot rebuild failed (continuing; deploy will regenerate)"

# --- 9. Open a PR (skipped in dry-run; never auto-merges) ---
if [ "$DRY_RUN" = "1" ]; then
  log "DRY RUN: skipping commit/push/PR. The redesign is in the working tree at $REPO_DIR."
elif git diff --quiet && git diff --quiet --cached; then
  log "No changes generated; nothing to PR."
else
  BRANCH="redesign/$(date -u +%Y%m%d-%H%M%S)"
  git checkout -b "$BRANCH"
  git add -A
  git commit -m "Monthly redesign: ${TREND:0:60}"
  git push -u origin "$BRANCH"
  # Screenshots go to the orphan branch redesign-assets (never main); gallery.md links them.
  ( cd automation && npx tsx pipeline/publish-shots.ts "${NEW_MONTH:-$(date -u +%Y-%m)}" "${BRANCH#redesign/}" ) || true
  # Build the body in a file: printf %b on accumulated markdown would eat backslashes.
  BODY_FILE="$(mktemp)"
  printf 'Automated monthly redesign on %s.\n\n**Trend:** %s\n' "$(hostname)" "$TREND" > "$BODY_FILE"
  for part in decision-summary e2e-summary visual-qa-summary layout-qa-summary gallery; do
    f="automation/test-output/$part.md"
    if [ -f "$f" ]; then printf '\n---\n\n' >> "$BODY_FILE"; cat "$f" >> "$BODY_FILE"; fi
  done
  DRAFT=()
  if [ "$E2E_RC" -ne 0 ] || [ "$VQA_RC" -ne 0 ]; then
    DRAFT=(--draft)
    log "Blocking checks still fail (e2e=$E2E_RC, visual=$VQA_RC) — opening a DRAFT PR for manual finishing."
  fi
  gh pr create "${DRAFT[@]}" --title "Monthly redesign: ${TREND:0:60}" \
    --body-file "$BODY_FILE" --head "$BRANCH" --base "$BASE_BRANCH" \
    || log "PR creation failed (push succeeded; open the PR manually)"
fi

# --- Success: clear the checkpoint so the next run starts fresh ---
rm -f "$STAGE_FILE" "$PATCH_FILE" "$TREND_FILE"
log "=== done ==="
hc ""
