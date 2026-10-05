# Monthly redesign — runbook

Start here. This page says what runs, where it lives, and how to fix it.
Details: [instance/README.md](instance/README.md) (runner) and [n8n/README.md](n8n/README.md) (n8n, decider).

## What it does

On the 1st of each month the server redesigns sreeraj.dev and opens a PR. Nothing goes live
until you merge it. n8n reads your PR reviews so the next month avoids styles you rejected.

1. Check logins (Claude Code, else Codex).
2. Archive the live design as `edition/<month>`.
3. Pick a style: 3 web researchers → filter repeats → local decider + 2 judges → code picks.
4. Rebuild the site (Claude, fallback Codex).
5. E2E checks; an agent fixes failures (max 3 passes).
6. Layout check, then visual QA of 14 page types at 390/1280 px; an agent fixes breakage.
7. Open the PR with the decision, test results and screenshots. Draft if still broken.
8. Post to Discord: PR ready, or run failed.

## Where things live (host `code-instance`, user `sreeraj`)

| What | Where |
|---|---|
| Repo (dev checkout) | `~/sreeraj` — keep on `main`; use worktrees for changes |
| Runner's clone | `~/.local/share/sreeraj-redesign/repo` — hard-reset every run, never edit |
| Installed runner | `~/.local/share/sreeraj-redesign/redesign-run.sh` (from `instance/install.sh`) |
| Runner secrets | `~/.config/sreeraj-redesign/env` (0600): `CLAUDE_CODE_OAUTH_TOKEN`, `N8N_WEBHOOK_TOKEN`, `REDESIGN_BASE_BRANCH` |
| Run state (resume) | `~/.local/share/sreeraj-redesign/state/` |
| Run viewer | http://100.104.153.63:8790 (`sreeraj-run-viewer.service`, bind in `~/.config/sreeraj-redesign/viewer.env`) |
| n8n + decider | `~/n8n` (Docker Compose), UI http://code-instance.tail5d3b6b.ts.net:5678 |
| n8n secrets | `~/n8n/secrets/` (SSH key for `gh`, webhook token); Discord URL is an n8n credential |
| Agent config | `automation/pipeline/roles.json` (providers, models, turn limits) |
| Codex login/config | `~/.codex/` (`model = "gpt-6.1-sol"`) |
| Screenshots | orphan branch `redesign-assets` on GitHub |

## Schedule

| Timer | When |
|---|---|
| `sreeraj-redesign.timer` | 1st of the month, 03:00 UTC (catches up after downtime) |
| `sreeraj-redesign-probe.timer` | Mondays 09:00 UTC — logins, decider, n8n |
| n8n PR review learner | hourly |
| n8n missed-run check | 2nd of the month, 06:00 UTC |

## Things that expire

| What | Expires | Renew |
|---|---|---|
| Claude token (`CLAUDE_CODE_OAUTH_TOKEN`) | ~2027-10-03 | `claude setup-token`, put the result in the env file |
| Codex login | refreshes itself; the probe alerts if not | `codex login --device-auth` |

## Common tasks

Run these as `sreeraj` (`ssh root@100.104.153.63`, then `su - sreeraj`). User units need
`export XDG_RUNTIME_DIR=/run/user/$(id -u)` when you came in through `su`.

```bash
# Watch a run: open the viewer, or
journalctl --user -u sreeraj-redesign.service -f

# Run now (real PR)
systemctl --user start sreeraj-redesign.service

# Dry run of a branch (no commit/push/PR; still force-pushes the edition tag)
set -a; . ~/.config/sreeraj-redesign/env; set +a
REDESIGN_DRY_RUN=1 REDESIGN_BASE_BRANCH=<branch> REDESIGN_MONTH=<yyyy-mm> bash <worktree>/automation/instance/redesign-run.sh full

# Resume after a crash past the rebuild (skips research and rebuild)
systemctl --user start sreeraj-redesign-resume.service

# Health check now
systemctl --user start sreeraj-redesign-probe.service && journalctl --user -u sreeraj-redesign-probe -n 20

# Force one provider (testing)
REDESIGN_PROVIDERS=codex ...        # or claude

# Change a model: edit automation/pipeline/roles.json (or REDESIGN_CLAUDE_MODEL / REDESIGN_CODEX_MODEL)

# Install runner, viewer and timers after merging changes (never during a run)
cd <worktree of origin/main> && bash automation/instance/install.sh

# Update n8n workflows after merging changes
cp -r automation/n8n/workflows automation/n8n/scripts ~/n8n/ && ~/n8n/scripts/deploy-workflows.sh

# Unit tests, type check, e2e (from automation/)
npm run test:unit && npm run typecheck
npm run build:site && PLAYWRIGHT_CHROME_CHANNEL=chrome npm run test:e2e
```

## When something breaks

| Symptom | Fix |
|---|---|
| Discord: "Monthly redesign failed" | Open the viewer, find the failing stage. Fix, then start the service again (or the resume service if it got past the rebuild). |
| Preflight fails: no provider | Renew the Claude token or `codex login --device-auth`. |
| PR opened as draft | Blocking checks still fail after the fix passes. The PR body lists them. Finish by hand on the branch. |
| Probe: decider or n8n down | `cd ~/n8n && docker compose up -d && docker compose ps` |
| `/webhook/...` returns 403 | Missing header `x-redesign-token` (value in `~/n8n/secrets/webhook-token`). |
| `/webhook/redesign-reviews/sync` returns 500 "No item to return" | Normal when no PR needs re-classifying. |
| Run killed / browser hangs | Memory. Host: 7.7 GB + 4 GB swap. The runner pauses the decider during heavy stages; don't run heavy tests during a run. |
| Changes to `automation/` vanish after a run | `pipeline/guard.ts` undoes agent edits there on purpose. Commit real changes through a PR. |

## Code map (`automation/`)

| File | Job |
|---|---|
| `instance/redesign-run.sh` | The runner: stages, checkpoints, PR, alerts |
| `pipeline/agent.ts` | Runs Claude Code or Codex; typed output; fallback; logs calls |
| `pipeline/ideation.ts`, `style-decision.ts` | Style research and decision |
| `pipeline/rebuild.ts` | The rebuild step |
| `pipeline/e2e-stage.ts`, `guard.ts` | E2E fix loop; protects `automation/` |
| `pipeline/visual-qa.ts`, `publish-shots.ts` | Visual QA, screenshot gallery |
| `e2e/` | The e2e suite and the 14-page template list |
| `layout-qa-stage.ts` | Geometry checks + fixer |
| `prompts/full-rebuild.md` | The rebuild prompt (includes the `data-qa` markup contract) |
| `instance/run-viewer.py/html` | The run viewer |
| `n8n/` | n8n workflows, decider service, setup scripts |

## Open items

- Three inactive `tmp …` workflows can be deleted in the n8n UI.
- `history/design-log.json` is still written; ideation reads the archive instead.
- The Discord webhook URL appeared in a chat log; regenerate it in Discord and rerun
  `n8n/scripts/create-discord-credential.sh` if you want to rotate it.
