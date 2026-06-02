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
```

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
