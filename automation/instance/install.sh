#!/usr/bin/env bash
#
# Install the monthly-redesign systemd user timer on this instance.
# Idempotent. Run from anywhere inside the repo: automation/instance/install.sh
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SHARE_DIR="$HOME/.local/share/sreeraj-redesign"
CONF_DIR="$HOME/.config/sreeraj-redesign"
UNIT_DIR="$HOME/.config/systemd/user"

echo "Installing sreeraj.dev redesign runner..."
mkdir -p "$SHARE_DIR" "$CONF_DIR" "$UNIT_DIR"

# 1. Wrapper script (kept outside the managed clone so a reset can't clobber it).
install -m 0755 "$SCRIPT_DIR/redesign-run.sh" "$SHARE_DIR/redesign-run.sh"
echo "  • wrapper  -> $SHARE_DIR/redesign-run.sh"

# 2. Env file (don't overwrite an existing one with real secrets).
if [ ! -f "$CONF_DIR/env" ]; then
  install -m 0600 "$SCRIPT_DIR/env.example" "$CONF_DIR/env"
  echo "  • env      -> $CONF_DIR/env  (EDIT THIS: add ANTHROPIC_API_KEY)"
else
  echo "  • env      -> $CONF_DIR/env  (kept existing)"
fi

# 3. systemd user units.
install -m 0644 "$SCRIPT_DIR/sreeraj-redesign.service"       "$UNIT_DIR/"
install -m 0644 "$SCRIPT_DIR/sreeraj-redesign.timer"         "$UNIT_DIR/"
install -m 0644 "$SCRIPT_DIR/sreeraj-redesign-check.service" "$UNIT_DIR/"
echo "  • units    -> $UNIT_DIR/"

systemctl --user daemon-reload
systemctl --user enable --now sreeraj-redesign.timer

# 4. Linger so the timer fires even when you're not logged in.
if command -v loginctl >/dev/null && [ "$(loginctl show-user "$USER" -p Linger --value 2>/dev/null)" != "yes" ]; then
  if sudo -n loginctl enable-linger "$USER" 2>/dev/null; then
    echo "  • linger   -> enabled (timer runs without an active login)"
  else
    echo "  • linger   -> NOT enabled; run: sudo loginctl enable-linger $USER"
  fi
fi

echo
echo "Done. Next:"
echo "  1) Edit $CONF_DIR/env and add your ANTHROPIC_API_KEY"
echo "  2) Plumbing check:  systemctl --user start sreeraj-redesign-check && journalctl --user -u sreeraj-redesign-check -n 40 --no-pager"
echo "  3) Next run:        systemctl --user list-timers sreeraj-redesign.timer"
echo "  4) Manual full run: systemctl --user start sreeraj-redesign.service"
