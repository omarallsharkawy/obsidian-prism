# Contributing to Obsidian Prism

Thank you for contributing to **Obsidian Prism**!

## Prerequisites

- **Node.js >= 22.0.0** (uses built-in `fetch` and `WebSocket` with zero external `npm` runtime dependencies).

## Modular Architecture Map

To prevent monolithic file growth, runtime features are cleanly separated into focused modules compiled in order by `cdp.js`:

- `cdp.js` / `inject.js` / `remove.js` — Zero-dependency lexical CSS/JS bundler, single-source-of-truth config validator (`VALIDATORS` & `SYNC_ROOT_FILES`), CDP transport, and clean teardown.
- `style.css` — Obsidian & Warm dark themes + Daylight Crystal & Warm Alabaster light presets.
- `i18n-locales.js` / `i18n-core.js` — Bilingual English (`en`) & Arabic (`ar`, RTL) UI copy table.
- `motion-engine.js` / `animated-icons.js` — 4-tier damped spring physics & 21 micro-animated SVG icons.
- `ripple-core.js` / `conv-aura.js` — WebGL2 horizon aurora shader, 32% conversation aura scheduler, and character ripple matrix.
- `smooth-caret.js` — FastDOM read/write-separated gliding caret controller.
- `dual-mascot-rig.js` — Pixel mascot stage with rigid-body anti-overlap, leapfrog, and totem stacking.
- `vial-core.js` / `pulse-vial-bridge.js` — 512K borosilicate water vial & telemetry popover bridge.
- `settings-panel.js` — Collapsible settings banner, 5-group option renderer, and Git sync / credits card.
- `ui-runtime.js` — Incremental dirty-subtree scheduler & React Fiber state bridge.
- `vendor/pulse-dashboard/` — Absorbed telemetry collector & smart-coexistence fallback bar.
- `vendor/effort-slider/` — Absorbed reasoning effort slider with coexistence auto-yield.
- `vendor/thought-translator/` — Dual-mode (Machine / OpenAI SSE) thought translator service, client runtime, and multi-profile settings workbench.

## Development & Verification

```bash
# Run the full zero-dependency test suite
npm test

# Launch the local 4-theme optical & GPU sleep workbench (127.0.0.1:4321)
npm run workbench

# Install / sync into local Antigravity plugins directory
npm run install:plugin
```

## Pull Request Checklist

1. Keep runtime dependencies at **zero** (pure Node >= 22 built-ins + browser Web APIs).
2. Never commit personal paths, API keys, custom prompts, or compiled `.exe` / `.dmg` binaries.
3. Ensure `npm test` passes with 0 failures and the compiled bundle remains under the `680 KB` budget.
