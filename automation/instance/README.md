# Running the monthly redesign on the instance

This runs the monthly redesign pipeline as a **systemd user timer** on the
Hetzner box instead of GitHub Actions — deps are pre-installed, it uses the
system Chrome, and the agentic Layout QA stage can run as long as it needs.

## What it does each run

1. Hard-resets a **dedicated clone** (`~/.local/share/sreeraj-redesign/repo`) to
   `origin/main` — never your dev checkout.
2. Discovers a design trend (web search + Claude; registry fallback).
3. Creative rebuild via `claude -p` (generation stays on Claude Code).
4. `npm run build`.
5. **Layout QA & Fix stage** — deterministic geometry analysis + Agent SDK
   fixer (+ Webwright, best-effort).
6. Opens a **PR** to `main`. It never auto-merges; deploy happens via
   `deploy.yml` when you merge.

## Install

```sh
automation/instance/install.sh
# optional config (no API key needed by default — see Auth below):
$EDITOR ~/.config/sreeraj-redesign/env      # e.g. set HEALTHCHECK_URL
```

## Auth — runs on your Claude Code session (no API key)

Everything Claude-powered goes through the Claude Code session
(subscription/OAuth): `claude -p` generation, the Agent SDK layout fixer, the
vision quality gate, and trend discovery. So **no `ANTHROPIC_API_KEY` is
required** — leave it unset.

- If a key **is** set in the env file, `claude`/the Agent SDK switch to
  API-billing mode for everything and will fail on an invalid key. Only set it
  if you want the optional, non-blocking **Webwright** reviewer (which needs a
  raw key), and then it must be valid.
- The session token can expire and need an interactive `claude` re-login; the
  healthcheck (below) surfaces a run that fails because of this.

**Unattended runs: use a long-lived token.** The interactive login expires (it broke the 2026-10-01 run).
Run `claude setup-token` once, approve in a browser, and put the result in the env file as
`CLAUDE_CODE_OAUTH_TOKEN=...`. It is valid for one year and still bills to the subscription.

## Verify

```sh
# Plumbing only — no API key, no agent, no PR (safe anytime):
systemctl --user start sreeraj-redesign-check
journalctl --user -u sreeraj-redesign-check -n 50 --no-pager

# When the next monthly run will fire:
systemctl --user list-timers sreeraj-redesign.timer

# Trigger a real run now (generates a redesign + opens a PR):
systemctl --user start sreeraj-redesign.service
journalctl --user -u sreeraj-redesign.service -f

# Dry run (all stages, no PR) — leaves the redesign in the managed clone:
REDESIGN_DRY_RUN=1 ~/.local/share/sreeraj-redesign/redesign-run.sh full
```

## Stages and gates

| Stage | What decides | Blocks? |
|---|---|---|
| Preflight | `pipeline/probe.ts` (Claude Code and Codex) | Only when no provider works |
| Style | `pipeline/ideation.ts`: researchers, novelty filter, decider, two judges | Falls back to the style registry |
| Rebuild | implementer agent (Claude, then Codex) | No `src/` change = abort |
| Guard | `pipeline/guard.ts` undoes any agent edit under `automation/` | — |
| E2E | `pipeline/e2e-stage.ts`: blocking checks + up to 3 fix passes | Still failing = draft PR |
| Layout QA | geometry analyzer + fixer | Reported |
| Visual QA | `pipeline/visual-qa.ts`: 14 templates x 2 widths, typed verdicts, up to 2 fix passes | High layout breakage left = draft PR |
| PR | decision, e2e, visual QA and layout summaries, plus a screenshot gallery (`redesign-assets` branch) | Never auto-merges |

The run pauses the 3 GB decider container after the style decision and starts it again on exit:
the host has 7.7 GB and no swap, and a Chrome was OOM-killed when both ran at once.

## Health check and alerts

`sreeraj-redesign-probe.timer` runs `redesign-probe.sh` every Monday at 09:00 UTC. It checks both
agent logins, the decider and n8n, and posts to the n8n `alerts` workflow (Discord) on failure.
The runner also posts when a run fails and when a PR is ready. Set `N8N_WEBHOOK_TOKEN` in the env
file (`automation/n8n/scripts/create-webhook-token.sh` does it).

## Watch a run

`sreeraj-run-viewer.service` serves a read-only page on port 8790. Put `VIEWER_BIND=<tailscale-ip>` in
`~/.config/sreeraj-redesign/viewer.env` to reach it over Tailscale.

- **Stage bar:** start, auth, archive, trend, rebuild, build, Layout QA, archives, PR, done (from the runner log).
- **Claude sessions:** every `claude -p` and Agent SDK call the run made, with prompts, tool calls, tool results,
  replies, model and token counts (read from `~/.claude/projects/<clone>/*.jsonl`).
- **Artifacts:** the trend spec, the full rebuild prompt and the Layout QA summary (latest run only).
- **Past runs:** pick any earlier run from the journal in the selector.

Transcripts can contain file contents. Keep the viewer on localhost or the tailnet.

## Resume after a failure

The run checkpoints **after** the expensive rebuild+build: the working-tree
changes are saved as a git patch under `~/.local/share/sreeraj-redesign/state/`.
If a later stage (Layout QA, PR) crashes, continue without regenerating:

```sh
systemctl --user start sreeraj-redesign-resume.service     # or: redesign-run.sh resume
```

Resume fresh-resets the clone, re-applies the saved patch, and picks up at
Layout QA. A crash *during* generation (before the checkpoint) has nothing to
resume — just run `full` again. On success the checkpoint is cleared
automatically, so the next monthly run starts fresh.

## Reliability notes

- **Linger** must be enabled (`sudo loginctl enable-linger $USER`, done by the
  installer) so the timer fires without an active login session.
- **Healthcheck**: set `HEALTHCHECK_URL` in the env file. The runner pings
  `/start`, success, and `/fail` — the only reliable way to notice a missed or
  failed unattended run. Without it, a silent miss is invisible.
- `Persistent=true` makes a run that was missed while the box was off fire on
  next boot.

## Relationship to GitHub Actions

- The GitHub `full-redesign.yml` **cron is disabled** (this replaces it).
  `workflow_dispatch` is kept for manual cloud runs.
- `deploy.yml` is unchanged — merging a redesign PR to `main` still deploys.
- `layout-qa.yml` remains as a standalone manual/CI check.

## Uninstall

```sh
systemctl --user disable --now sreeraj-redesign.timer
rm ~/.config/systemd/user/sreeraj-redesign*.service ~/.config/systemd/user/sreeraj-redesign.timer
systemctl --user daemon-reload
# optional: rm -rf ~/.local/share/sreeraj-redesign ~/.config/sreeraj-redesign
```
