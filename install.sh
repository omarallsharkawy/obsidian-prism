#!/usr/bin/env bash
set -euo pipefail

# Obsidian Prism — Linux One-Command Installer (English / Arabic)
# Deploys the native plugin to ~/.gemini/config/plugins/obsidian-prism,
# patches XDG .desktop launchers rootlessly, and starts the background daemon.

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
INSTALLER_JS="$SCRIPT_DIR/tools/install-plugin.cjs"

if ! command -v node >/dev/null 2>&1; then
  printf '[Obsidian Prism] Node.js >= 22 is required. Please install Node.js 22+ and retry.\n' >&2
  printf '[Obsidian Prism] يتطلب Node.js 22 أو أحدث. يرجى تثبيت Node.js 22+ وإعادة المحاولة.\n' >&2
  exit 1
fi

NODE_MAJOR="$(node -p "parseInt(process.versions.node.split('.')[0], 10)" 2>/dev/null || echo 0)"
if [ "${NODE_MAJOR:-0}" -lt 22 ]; then
  printf '[Obsidian Prism] Detected Node.js %s; Node.js >= 22 is required.\n' "$(node -v 2>/dev/null || echo unknown)" >&2
  printf '[Obsidian Prism] الإصدار المكتشف هو Node.js %s؛ يتطلب Node.js 22 أو أحدث.\n' "$(node -v 2>/dev/null || echo unknown)" >&2
  exit 1
fi

if [ ! -f "$INSTALLER_JS" ]; then
  printf '[Obsidian Prism] Missing installer entry: %s\n' "$INSTALLER_JS" >&2
  exit 1
fi

exec node "$INSTALLER_JS" --install "$@"
