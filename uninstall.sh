#!/usr/bin/env bash
set -euo pipefail

# Obsidian Prism — Linux Lossless Uninstaller (English / Arabic)
# Removes injected UI, restores XDG .desktop launchers, and stops the background daemon.

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
INSTALLER_JS="$SCRIPT_DIR/tools/install-plugin.cjs"
REMOVE_JS="$SCRIPT_DIR/remove.js"

if ! command -v node >/dev/null 2>&1; then
  printf '[Obsidian Prism] Node.js >= 22 is required to run uninstall.\n' >&2
  printf '[Obsidian Prism] يتطلب Node.js 22 أو أحدث لتشغيل إلغاء التثبيت.\n' >&2
  exit 1
fi

if [ -f "$REMOVE_JS" ]; then
  node "$REMOVE_JS" >/dev/null 2>&1 || true
fi

if [ ! -f "$INSTALLER_JS" ]; then
  printf '[Obsidian Prism] Missing installer entry: %s\n' "$INSTALLER_JS" >&2
  exit 1
fi

exec node "$INSTALLER_JS" --uninstall "$@"
