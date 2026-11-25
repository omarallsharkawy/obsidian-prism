#!/usr/bin/env bash
set -euo pipefail

# Obsidian Prism — Linux Installation Status Check (English / Arabic)

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
INSTALLER_JS="$SCRIPT_DIR/tools/install-plugin.cjs"

if ! command -v node >/dev/null 2>&1; then
  printf '[Obsidian Prism] Node.js >= 22 is required.\n' >&2
  printf '[Obsidian Prism] يتطلب Node.js 22 أو أحدث.\n' >&2
  exit 1
fi

if [ ! -f "$INSTALLER_JS" ]; then
  printf '[Obsidian Prism] Missing installer entry: %s\n' "$INSTALLER_JS" >&2
  exit 1
fi

exec node "$INSTALLER_JS" --status "$@"
