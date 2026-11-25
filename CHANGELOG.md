# Changelog

All notable changes to **Obsidian Prism** are documented in this file.
This project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html) and [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [1.0.8-beta.2-en-ar] - 2026-11-25

> **Bilingual English & Arabic (RTL) Edition (`omarallsharkawy/obsidian-prism`)**: Community fork based on upstream [`RMvdesi/obsidian-prism`](https://github.com/RMvdesi/obsidian-prism) `v1.0.8-beta.2`, preserving full `GPL-3.0-only` licensing and `NOTICE` / `THIRD_PARTY_NOTICES.md` attribution.

### Changed & Localized

- **Bilingual English (`en`) & Arabic (`ar`, RTL) Suite**: Streamlined all UI locales, settings controls, thought translator targets, host localization support, Windows (C#) & macOS (Swift) installers/watchers, local optical/Studio workbench, GitHub templates, and documentation (`README.md` + `README.ar.md`) exclusively to **English (`en`)** and **Arabic (`ar`)** with full RTL (`dir="rtl"`) support.
- **Complete CJK Removal**: Removed all Chinese/CJK characters and fullwidth CJK punctuation across source code, installers, workbench, docs, and templates while preserving every upstream credit, copyright notice, and contributor attribution in English (romanizing `Yueshanghan / LLYSH-HANNARI` in `NOTICE` and `THIRD_PARTY_NOTICES.md`).

## [1.0.8-beta.2] - 2026-11-25

### Multi-Pane Split View & Channel 12 Offload

- **Multi-Pane Split View, Per-Pane Telemetry Isolation & Channel 12 Offload ([#62](https://github.com/RMvdesi/obsidian-prism/issues/62))**: Converges static Split View sashes to subtle `1px` dark/light hairlines while keeping hover/drag glow; mounts independent per-pane telemetry bars (session-scoped, narrow collapse, zero focus-jump) and prism rims with pane-isolated Effort sliders, Periodic Picker triggers, and Thought badges; smoothly follows active focus for the shared mascot, aura, and context vial (with `peek` clearance when the vial card opens); and offloads Home Studio to on-demand Channel 12.

### Conversation Matrix Ripple & WebGL2 Self-Healing

- **4-Tier Conversation Matrix Ripple & v2.35 Split Backdrop ([#63](https://github.com/RMvdesi/obsidian-prism/issues/63))**: Adds an opt-in 4-tier `convRipple` segmented control (`Off / Subtle / Medium / Full`, default `Off`, independent of `homeLayout`) rendered on one continuous main-shell WebGL2 canvas across split panes with live tier hot-swap, `0fps` idle/streaming sleep, wallpaper/browser-hole yielding, and v2.35 split backdrop fixes.
- **WebGL2 Resize Context Preservation & 3-Layer White-Screen Self-Healing ([#64](https://github.com/RMvdesi/obsidian-prism/issues/64) · [PR #60](https://github.com/RMvdesi/obsidian-prism/pull/60))**: Integrates PR #60 to keep WebGL2 contexts alive across terminal (`Ctrl+J`) and sidebar resizes while isolating sync errors; breaks Chromium's same-canvas `getContext('2d') -> null` fallback deadlock by swapping in a fresh canvas; hardens `glowCanvas` lifecycle symmetry; and adds debounced async `webglcontextlost` hide-and-recover with automatic 2D stabilization.

### Custom Wallpaper, Tray Quit & Linux Updater Fixes

- **Custom Wallpaper v2.34+ Reveal, Windows Tray Quit & Linux Updater Fix ([#59](https://github.com/RMvdesi/obsidian-prism/issues/59) · [PR #61](https://github.com/RMvdesi/obsidian-prism/pull/61))**: Clears opaque `.agy-inset-shell`/`.agy-sheet`/`flex-1`/`.bg-sidebar` blockers over custom wallpapers with tuned dual-theme `[data-ag-cs-conv-seat="1"]` opacity; integrates PR #61 with strict `/json/list` + `DevToolsActivePort` target verification via `this.browserPort` before `Browser.close` and immediate timeout fallback; and resolves the `obsidian-prism-linux-portable.tar.gz` asset on Linux.

### Acknowledgements

- Special thanks to [@OyatsuSuki](https://github.com/OyatsuSuki) ([PR #60](https://github.com/RMvdesi/obsidian-prism/pull/60)/[PR #61](https://github.com/RMvdesi/obsidian-prism/pull/61)), [@IASUI](https://github.com/IASUI) ([#62](https://github.com/RMvdesi/obsidian-prism/issues/62)), [@VehideX](https://github.com/VehideX) ([#63](https://github.com/RMvdesi/obsidian-prism/issues/63)), [@water707](https://github.com/water707) ([#64](https://github.com/RMvdesi/obsidian-prism/issues/64)), [@yuaniyuan](https://github.com/yuaniyuan) ([#59](https://github.com/RMvdesi/obsidian-prism/issues/59)), and [@Xinbeok](https://github.com/Xinbeok) (PR #60 macOS verification).

## [1.0.8-beta.1] - 2026-11-25

> **Design Provenance & License Notice**: The 3D periodic-table visual and interaction design study originates from the original author's separate repository [RMvdesi/prism-periodic-console](https://github.com/RMvdesi/prism-periodic-console) (`All Rights Reserved`); its integration in this repository was implemented by the original author and released under `obsidian-prism`'s **GPL-3.0** license.

### Periodic-Table 3D Model Picker & Architecture

- **3D Mechanical Keyboard Periodic-Table Model Picker (Channel 8)**: On-demand WebGL2 PBR keycap console with OLED HUD and 300Hz frame-pacing optimizations (parallel shader compilation, reduced GPU geometry/OLED uploads, zero-reflow layout, background module pausing when open). Locks invocation during active turns, auto-dismisses when switching into running sessions, and keeps page-wide prism rims pointer-reactive while open.
- **Locale Expansion, Channel 1 Slimming (-136 KB), Reversible Native-EN Restore & Swarm CDP Localization ([#18](https://github.com/RMvdesi/obsidian-prism/issues/18) · [PR #55](https://github.com/RMvdesi/obsidian-prism/pull/55))**: Shipped multi-locale parity and upgraded upstream dictionary (PR #55); split Settings/full locales to on-demand Channel 9 and Mascot runtime to Channel 10 (-136 KB on Channel 1); added reversible native-English restoration in `hostLocalization: 'off'` (including isolated external localizers); and added zero-Ch1-overhead Swarm OOPIF pure-CDP localization (#18 Layer B) with full-chain `?token=` redaction.

### Memory Governance, Storage Workbench & Linux Native Support

- **4-Layer Zero-Risk `language_server` Memory Governance & Storage Details Workbench ([#40](https://github.com/RMvdesi/obsidian-prism/issues/40)/[#47](https://github.com/RMvdesi/obsidian-prism/issues/47) · [PR #41](https://github.com/RMvdesi/obsidian-prism/pull/41)/[PR #48](https://github.com/RMvdesi/obsidian-prism/pull/48)/[PR #56](https://github.com/RMvdesi/obsidian-prism/pull/56))**: Eliminates v2.34+ cache thrashing, adds an idle-only Storage Guard banner, opt-in exit auto-archiving for old subagents (>2h only, never main chats), and opt-in `GOMEMLIMIT` user env controls; adds an About-sheet Storage Details & Archive Workbench (Top-5 size ranking, lazy `<details>`, multi-batch lossless restore, `>14d` old-main archive preset with mutually exclusive confirmations); preserves real token totals for deleted/archived chats (#40/PR #41); and heals self-referential `rootConversationId` entries (#47/PR #48).
- **Full Native Linux Support ([#44](https://github.com/RMvdesi/obsidian-prism/issues/44))**: Adds zero-dependency portable `.tar.gz` packaging (`install.sh`/`uninstall.sh`/`status.sh`) in release CI, rootless XDG `.desktop` shadow overrides and managed launcher with lossless rollback, `/proc` + `APPIMAGE` detection, `zenity`/`kdialog` relaunch prompts, and `SIGHUP` graceful daemon shutdown.

### Mascot Casting Stage, Omni Sandbox, Prompt Suggester & Extensibility

- **Four-Species Pixel Mascots & 3D Parallax Obsidian Star Tavern Pixel Stage ([PR #45](https://github.com/RMvdesi/obsidian-prism/pull/45))**: Adds GPT white dragon and DeepSeek blue whale pixel sprites with clean 0/1 single-pet toggles and an on-demand WebGL2 3D Parallax Obsidian Star Tavern Pixel Stage inside Channel 9 (zero Channel 1 overhead, instant `0x0` + `WEBGL_lose_context` VRAM reclaim when hidden), plus live mascot remount on Channel 10 hot-reload.
- **Omni Default Sandboxed Previews, Channel 11 Prompt Suggester (Beta) & Local `AddonRegistry` ([PR #42](https://github.com/RMvdesi/obsidian-prism/pull/42))**: Enables default sandboxed `.html`/`.htm`/`.svg` previews in the Omni side pane with Opaque Origin isolation and tightened CORS; integrates Prompt Suggester as on-demand Channel 11 (Beta, off by default, zero Ch1 bytes, Tab/Esc menu-safe); and introduces a zero-network `AddonRegistry` foundation with unified `--purge-data` cleanup.

### Smoked Obsidian Polish & Antigravity `v2.35.0` / `v2.35.1` Compatibility

- **Smoked Obsidian Facets & Antigravity `v2.35.0`/`v2.35.1` Parity ([#52](https://github.com/RMvdesi/obsidian-prism/issues/52) · [PR #43](https://github.com/RMvdesi/obsidian-prism/pull/43)/[PR #49](https://github.com/RMvdesi/obsidian-prism/pull/49)/[PR #50](https://github.com/RMvdesi/obsidian-prism/pull/50)/[PR #51](https://github.com/RMvdesi/obsidian-prism/pull/51)/[PR #53](https://github.com/RMvdesi/obsidian-prism/pull/53)/[PR #54](https://github.com/RMvdesi/obsidian-prism/pull/54))**: Adds 5-state Obsidian star-core task icons, monochrome specular rims, precision Home Studio SVG charts, 4s subagent breathing glow, pure-CSS step-plan styling & trigger truncation fix (PR #43), and zero-gap queued-card mascot docking (PR #51); fixes mid-conversation `sidecar-iframe-slot` theme sync (PR #53), High-default effort memory & locked selector guards (PR #54), Windows UI locale detection & daemon heal guard (PR #49/#50), and zero silent network calls when `autoUpdate: 'off'`.
- **Core Rendering & UX Fixes ([#57](https://github.com/RMvdesi/obsidian-prism/issues/57) / [#58](https://github.com/RMvdesi/obsidian-prism/issues/58))**: Fixes composer CSSOM mask drop and spurious send/switch fiber flash; restores native bleed exemptions for wide Markdown tables (#57); and fixes model-menu mascot crouch clearance, mascot Tab-chain exclusion (`tabindex="-1"`), Orchestrator crystal slider anti-aliasing/fringe edges, and full-height focus lines on scroll viewports (#58).

### Acknowledgements

- Special thanks to all PR authors and issue reporters who contributed to `v1.0.8-beta.1`: [@tone-leh](https://github.com/tone-leh), [@OyatsuSuki](https://github.com/OyatsuSuki), [@Gruu6y](https://github.com/Gruu6y), [@yzd05](https://github.com/yzd05), [@hukun01](https://github.com/hukun01), [@zmzwynzj](https://github.com/zmzwynzj), [@wanghaoyi216](https://github.com/wanghaoyi216), [@legegeCoder](https://github.com/legegeCoder), and [@IASUI](https://github.com/IASUI).

## [1.0.7] - 2026-11-24

### Visual Polish, Desktop Companions & UX

- **Unified Smoked Obsidian Facets & UI Polish**: Refines chat bubbles, file strips, Artifact cards, keycap "Allow" buttons, single-frame chips, and pinned context vials; strips hairline orbital arcs from Home Studio; restores `7px × 2px` luminous dash cores for subagent spinners only; and boosts `ask_question` selected contrast & zero-reflow Submit clearance.
- **Desktop Mascots Elevated `peek`, Prism Rim Ambient Bounce Light, Home Pass-Through ([#39](https://github.com/RMvdesi/obsidian-prism/issues/39)) & Pixel Micro-Theaters**: Elevates `peek` geometry above the prism rim (`z: 8`) behind overlays (`z: 12+`) with full pointer pass-through; adds `source-atop` silhouette-contained bottom ambient rim bounce lighting synced with the 6 prism palettes while preserving `0fps` sleep; fixes home toolbar occlusion (#39); and adds `0fps` habitat props, feeding easter eggs, and 9 slash micro-theaters.
- **Two-Column Settings Overhaul, Independent `effortMemory` Toggle ([#9](https://github.com/RMvdesi/obsidian-prism/issues/9)/[#11](https://github.com/RMvdesi/obsidian-prism/issues/11)) & Beta Tab**: Redesigns settings with 10 thumb switches and 5 accent dots; adds `sidebarNavFold`, `scrollBottomMotion`, and `effortMemory` (default `on`, remembers per-model & Orchestrator effort even when the effort slider is off); and organizes experimental items under a clearly labeled "Beta" tab.

### Modular Architecture, Translation & Performance

- **On-Demand Modules, Zero-`eval` LZSS & Unified Disk Cache (45x Cold Start)**: Splits Thought Translator (`0 B` when off), Inline Diff Preview, and local static/video Wallpapers (Beta, off by default) into on-demand modules with `.bundle-cache.json` (`~26 ms` cold start), Canvas VRAM `0x0` sleep reclamation, and the core bundle kept under `685,000 B`.
- **Thought & Async New-Conversation Title Translation, 1-Click Diagnose & Proxy Support ([#14](https://github.com/RMvdesi/obsidian-prism/issues/14)/[#27](https://github.com/RMvdesi/obsidian-prism/issues/27))**: Resolves 5 intermittent translator root causes; adds async OS proxy detection, manual HTTP/HTTPS/SOCKS5 proxy config, opt-in tool-summary batch translation, 1-Click Diagnose, and opt-in `translateTitles` with targeted MutationObserver support for asynchronously generated new conversation titles (excluding chat streams, lossless restore on disable).
- **60fps Effort Slider Refactor & Core Interaction Fixes ([#11](https://github.com/RMvdesi/obsidian-prism/issues/11)/[#15](https://github.com/RMvdesi/obsidian-prism/issues/15)/[#16](https://github.com/RMvdesi/obsidian-prism/issues/16)/[#31](https://github.com/RMvdesi/obsidian-prism/issues/31))**: Eliminates per-frame reflows during slider drags; fixes React 19 multi-HostText switching (#11), bilingual label flicker/drop (#16/#31), side-pane maximize squeeze, native `<select>` contrast (#15), capture-phase `/btw` menus, and v2.34 `/compact` double-insert.

### Bilingual Installers, Localization & Post-Update Resilience

- **Bilingual Win/macOS Installers, Instant Host-i18n Rollback & External Patch Notice ([#37](https://github.com/RMvdesi/obsidian-prism/issues/37) / [#18](https://github.com/RMvdesi/obsidian-prism/issues/18) Layer A)**: Localizes all C#/Swift installer wizards, tray menus, and logs with `--lang` overrides; ensures instant lossless `host-i18n` teardown with an amber external-patch notice pill; and adds built-in Swarm host card strings (#18 Layer A).
- **Post-Update Persistence Hardening & macOS Relaunch / Lossless Launcher ([#38](https://github.com/RMvdesi/obsidian-prism/issues/38))**: Fixes macOS relaunches dropping `--remote-debugging-port=0` via normalized `.app` paths, Helper/`SingletonLock` waits, `ELECTRON_RUN_AS_NODE` stripping, `open -na`, and an optional signature-safe `~/Applications/Antigravity Prism.app` launcher; hardens Win/macOS/CLI installers against stale ports, safe reparse tags (WOF/Cloud/Dedup), file locks, and PID reuse.

### Community PRs & Security Hardening

- **Integrated and Hardened 10 Community PRs & Key Fixes**:
  - [PR #10](https://github.com/RMvdesi/obsidian-prism/pull/10) ([@yzd05](https://github.com/yzd05)): Fixed Orchestrator L1/L2 hover premature close and redundant L3 submenu.
  - [PR #12](https://github.com/RMvdesi/obsidian-prism/pull/12) ([@DDykarc](https://github.com/DDykarc)): Fixed localized effort-slider label ping-pong flicker.
  - [PR #13](https://github.com/RMvdesi/obsidian-prism/pull/13) ([@yzd05](https://github.com/yzd05)): Hardened daemon UNC/NT path blocking, fail-closed `Host` checks, pre-write SHA-256 verification, and top-level `mainFrame` gating.
  - [PR #17](https://github.com/RMvdesi/obsidian-prism/pull/17) ([@SuzumiyaHaruhi719](https://github.com/SuzumiyaHaruhi719)): Restored Prism metrics fallback in Home Studio when external `agPulseHost` returns empty quotas.
  - [PR #19](https://github.com/RMvdesi/obsidian-prism/pull/19) ([@Kazaorus](https://github.com/Kazaorus)): Resolved symlinks and Windows junctions in the daemon CLI entry-point check.
  - [PR #20](https://github.com/RMvdesi/obsidian-prism/pull/20) / [PR #21](https://github.com/RMvdesi/obsidian-prism/pull/21) / [PR #22](https://github.com/RMvdesi/obsidian-prism/pull/22) / [PR #23](https://github.com/RMvdesi/obsidian-prism/pull/23) / [PR #29](https://github.com/RMvdesi/obsidian-prism/pull/29) ([@yzd05](https://github.com/yzd05)): Dedicated rail outline trigger, wave-phase continuity & 450ms semantic blend, cross-port usage disk persistence (with Local/Remote-SSH isolation), WeakMap/ResizeObserver optimizations, and light-mode overlay & submenu readability fixes ([#26](https://github.com/RMvdesi/obsidian-prism/issues/26)).
  - [PR #30](https://github.com/RMvdesi/obsidian-prism/pull/30) ([@zzirui321-rgb](https://github.com/zzirui321-rgb) · [#28](https://github.com/RMvdesi/obsidian-prism/issues/28)): Fixed Windows 200% high-DPI installer clipping.
  - [PR #33](https://github.com/RMvdesi/obsidian-prism/pull/33) ([@zzirui321-rgb](https://github.com/zzirui321-rgb) · [#32](https://github.com/RMvdesi/obsidian-prism/issues/32)): Fixed Antigravity v2.34 Home Studio Protobuf `BigInt` crash and added `WeakRef` Redux summary fallback.
  - [PR #35](https://github.com/RMvdesi/obsidian-prism/pull/35) ([@zzirui321-rgb](https://github.com/zzirui321-rgb) · [#34](https://github.com/RMvdesi/obsidian-prism/issues/34)): Prevented clicking `View Usage` in the model menu from mis-switching to `Orchestrator`.
  - **Auto-refresh `Ctx %` and Context Vial after `/compact`** ([#36](https://github.com/RMvdesi/obsidian-prism/issues/36) · [@zzirui321-rgb](https://github.com/zzirui321-rgb)): Wired v2.34 `contextWindowUsage` / `compactedAtStepIndices` / `CortexStepCheckpoint` and memory-only `PeekContextState`.
- **Zero CodeQL Alerts & All-OS Node 22 CI Green**: Resolves all CodeQL alerts (`#32`–`#37`), sandboxes inline-diff Git RPCs and wallpaper single-`fd` reads, fixes Node 22 timer/SIGTERM CI races, and expands automated tests to **`584 pass / 0 fail`**.

### Acknowledgements

- Special thanks to all PR authors and issue reporters who shaped `v1.0.7`: [@yzd05](https://github.com/yzd05), [@zzirui321-rgb](https://github.com/zzirui321-rgb), [@Kazaorus](https://github.com/Kazaorus), [@DDykarc](https://github.com/DDykarc), [@SuzumiyaHaruhi719](https://github.com/SuzumiyaHaruhi719), [@boy14204367](https://github.com/boy14204367), [@nanpi8633-spec](https://github.com/nanpi8633-spec), [@yanzhem02](https://github.com/yanzhem02), [@awasllll0317](https://github.com/awasllll0317), [@baihao2006](https://github.com/baihao2006), [@fenzsen](https://github.com/fenzsen), [@L-yifan](https://github.com/L-yifan), [@Gruu6y](https://github.com/Gruu6y), and [@Freezecatmeow](https://github.com/Freezecatmeow).

## [1.0.6] - 2026-11-21

### Performance (#2 / #3 / #4 / #5 / #7 / PR #6)

- **Host Localization Engine Overhaul**: Adds 327-regex fast indexing and `2048`-entry bounded positive/negative caches (**3.2x** faster cold start, **25.9x** faster negative-cache lookups), eliminates `pointerenter` recursive DOM rescans (0 rescans), and adds `5ms` frame-budget time slicing.
- **Zero Top-Level `:has()` & Zero-Reflow Settings Panel**: Eliminates all top-level `:has()` selectors in `style.css` via targeted `O(1)` attributes (reducing Blink `RecalcStyle` by ~80%), and introduces collapsed lazy-building plus Read-then-Write updates in `settings-panel.js` (eliminating 238 click-time layout reflows and 600-button full scans).
- **Mascot RLE Canvas Batching & True `0fps` Blur Hibernation**: Batches pixel draws via horizontal RLE `fillRect` + `lastFill` skip + cached 2D context (**-90%** CPU), and honors `data-ag-cs-win-blur="1"` for true `0fps` / zero-RPC hibernation on macOS and high-refresh displays.
- **`v2.34.0` `renderer-proxy` Tiered Caching, Daemon Heap & Installer Slimming**: Caches LS wrapper via `WeakRef` with request coalescing and tiered TTLs; trims daemon resident heap by **35.5 MiB** and excludes promo screenshots from installer bundles (**~1.6 MB**, **-85%**).

### Fixed (#8)

- **Fix P0 `mainFrameId === null` CDP Binding Paralysis**: Resolves `Page.getFrameTree` timeouts that permanently disabled all privileged CDP bindings (including Thought Translator).
- **Fix Scrollbars & UI Regressions**: Fixes Windows dual scrollbars and exposed native arrows ([#8](https://github.com/RMvdesi/obsidian-prism/issues/8)), telemetry subagent label truncation, queued-message 3-gear button mis-replacement, and stale purple `Extra` badge when switching from `XHigh` to `Carbon`.

### Compatibility & Release Channels

- **13-Provider Localization Coexistence & Hardening**: Adds fingerprinting to politely yield to the top 13 active community localization plugins on GitHub, zero `Map.prototype` hijacking immunity, 5 anti-mistranslation exemption attributes, and bilingual model/effort parsing.
- **Stable / Beta Update Channels & Discussion Template**: Expands validated settings to **30** keys with `updateChannel` (`stable` / `beta`), automatic CI `--prerelease` tagging, and a new community Discussion issue template.

### Acknowledgements

- Special thanks to [@TheSixPasserby](https://github.com/TheSixPasserby) ([PR #6](https://github.com/RMvdesi/obsidian-prism/pull/6), credited via `Co-authored-by`) and community contributors [@Gruu6y](https://github.com/Gruu6y) ([#2](https://github.com/RMvdesi/obsidian-prism/issues/2)/[#3](https://github.com/RMvdesi/obsidian-prism/issues/3)/[#8](https://github.com/RMvdesi/obsidian-prism/issues/8)), [@Gyf0402](https://github.com/Gyf0402) ([#4](https://github.com/RMvdesi/obsidian-prism/issues/4)), [@TheSixPasserby](https://github.com/TheSixPasserby) ([#5](https://github.com/RMvdesi/obsidian-prism/issues/5)), and [@boy14204367](https://github.com/boy14204367) ([#7](https://github.com/RMvdesi/obsidian-prism/issues/7)) for their profiling, PRs, and actionable bug reports.

## [1.0.5] - 2026-11-21

### Added

- **Built-in Host Localization (On-Demand Runtime Module)**: Zero modification to official `app.asar`; injected on-demand via an isolated runtime module (`vendor/host-i18n/`) with zero static main-bundle overhead. Exposes a tri-state setting (`auto` / `on` / `off`, defaulting to `auto`), a universal 4-layer auto-yield and `3000ms` ping-pong circuit breaker for external localization plugins, `WeakRef`/`WeakMap`-backed zero-leak snapshots, `0fps` blur hibernation, and 100% lossless original-text restoration.

### Fixed

- **Fix GitHub Issue #1 (Narrow-Screen & Side-Panel Bottom Bar Crowding / Jitter)**: Introduces 5-tier fluid collapse choreography (Tier 1 gracefully collapses the model name first while retaining icon, quota, and chevron, progressively compacting down to a `26×26` frosted-glass context ring), `0-Reflow` `ResizeObserver` sizing with GPU `transform: scale(1.27)`, and container-relative `min(332px, 46%)` right-pane anti-collapse protection (compatible with maximized panels).
- **Dual-Mascot (Cat + Clawd) Side-Panel Snap, Debounced Parabolic Rebound & Model-Selector Handoff Animation**: Eliminates teleportation when grabbing sliding mascots, stabilizes wide-screen landing positions, aligns mini-crab totem stacks, and ensures click-through never blocks model-menu dismissal.

### Security & Quality

- **CodeQL & Security Audit Hardening**: Resolves CodeQL Alerts #30/#31 and polynomial regex backtracking risks, closing all 27 security and stability findings identified during audits.

### Acknowledgements

- Gratefully acknowledges **[yiheng8023/antigravity-chinese](https://github.com/yiheng8023/antigravity-chinese)** (`v3.3.19`, `MIT License`, `Copyright (c) 2026 Antigravity Chinese Localization Contributors`) for the upstream localization dictionary and frontend DOM translation pattern reference.

## [1.0.4] - 2026-11-21

### Added

- **Auto-Update Check, Optional Auto-Update Toggle (`autoUpdate: "off"` by Default) & Hot-Reload Upgrades**: Adds an isolated Node-side `sidecars/daemon/update-service.mjs` (zero outbound requests from renderer code; `45s` startup check + `6h` interval, `10s` manual cooldown) enforcing strict GitHub host allowlists with hop-by-hop redirect validation, a `64 MiB` download cap, and **mandatory fail-closed SHA-256 verification** against release `digest` / `SHA256SUMS.txt` (simultaneously generated and uploaded by `.github/workflows/release.yml`). Expands the settings schema to **28** validated keys, adding status badges, one-click hot-reload updates, and reload/restart guidance in **Settings → About**; supports silent in-place upgrades with live multi-window hot-reinject on Windows, `git pull --ff-only` hot-sync with core-change notices for source repos, and official `.dmg` release links on macOS.
- **In-Settings One-Click Uninstall (Optional Data Purge) & Telemetry Disk LRU Governance**: Adds an inline-confirmed uninstall workflow in **Settings → About** (data purge unchecked by default; automatically backs up `config.json` to `~/.gemini/config/obsidian-prism-config.backup.json` and restores it on reinstall). Opting into purge (`--purge-data` across Windows, macOS, and CLI) cleanly removes plugin configs, caches, 12 Prism `localStorage` keys, and `telemetry/`, while strictly blocking symlinks/reparse points, unowned `AG_PRISM_TELEMETRY_DIR` overrides, and user-data redline directories (`conversations_archive`, `prism-knowledge-space`, `Antigravity-Spark`) and their descendants. Adds active-file-safe LRU disk pruning to `history.mjs` and `usage.mjs` (`UsageLedger` defaults to `256` files).

### Fixed

- **Eliminate Multi-Tier & Cross-Version Model-Selector Deadlocks**: Rewrites effort-slider click interception as strictly **Fail-Open**, covering **Jio / Free** (single-tier `Claude 4.6 (Thinking)`, `GPT-OSS 120B`, `Gemini 3.8 Flash (Minimal)`), **Pro** (disabled/non-Carbon rows), **Ultra 20x**, and `v2.33`/`v2.34`/future hosts (100% native click pass-through whenever React Fiber lookup misses). Gates native submenu hiding behind `html[data-ces-slider-ready='1']` and clears it immediately on menu close (fixing `justClosed` cleanup and closed-state `localStorage` cache misses), eliminates dual `MutationObserver` feedback loops, and defers Orchestrator WebGL2 mount by one `rAF` frame.
- **Fix Mid-Stream Mixed-Language Translation Halts**: Refactors client/server `isAlreadyTargetLang` heuristics so mixed-language reasoning is no longer skipped prematurely, stops `res.skipped === true` from poisoning local caches or locking render state, and wires locale-isolated caching, prompts, and machine-translation targets.

### Security & Compliance

- **Rate-Limit & Anti-Detection Hardening, Zero Prototype Patching & Zero Renderer Outbound Calls**: Effort slider drags now commit once on `pointerup`; removes all `HTMLElement.prototype.focus` / `Element.prototype.focus` prototype overrides; caches `startCascade` protocol stage in `reserveSession` to eliminate repeated probing errors; removes direct renderer calls to `translate.googleapis.com` (guaranteeing zero Google Translate / GitHub API outbound requests in compiled bundles); increases quota hover cooldown to `20s` / manual cooldown to `5s` and slices historical step folding across `rAF` frames; expands automated tests to **297** cases while keeping the default static main bundle at **`692,096 B` (`675.88 KiB` < `680 KiB` hard cap)**.

### Platform Testing Note

> All Windows installer, daemon, hot-update, uninstall, and live Antigravity `v2.34.0` features in `v1.0.4` were compiled and verified on Windows, with macOS CI verification added in GitHub Actions.

## [1.0.3] - 2026-11-21

### Fixed (Antigravity Desktop `v2.34.0+` Compatibility)

- **Effort Slider Unlock, Living-Crystal Orchestrator Prism Bar & Claude Icon Sync**: Adapts to Antigravity `v2.34.0`'s shift from display-name keys to kebab-case slugs in `selectorCtx.effortIndex` (`gemini-4-neon`, `claude-opus-5-5`, `gemini-3.8-flash`) via `normalizeEffortIndex` and unified slug lookup, restoring unlocked multi-tier dragging and accurate tier badges across all 7 model groups. For `v2.34.0`'s selectable-planner Orchestrator, keeps the native submenu while seamlessly blending a frameless WebGL2 prism slider into the menu: the **active left side** renders polished, glossy cut crystal (crisp facet depth, top glass specular ribbon, 105px spectral dispersion, and 4-anchor glints), while the **inactive right side** recesses into an etched crystal-bed channel with subtle slow-flowing precursor liquid caustics (automatically sleeping at `0fps` when full, reduced-motion, ambient-off, or menu-closed), paired with **`2×8px`** dual-contrast etched detent ticks and a **gunmetal titanium-grey knob** ringed by a compact 32px mouse-tracking composer prism rim (falling back to the laser-etched locked `Auto` bar on legacy hosts). Selecting a Claude planner under Orchestrator automatically shows the Claude brand icon and camp state on the composer trigger.
- **Telemetry Bar & 512K Context Vial Recovery (Read-Only Renderer `lsWrapper` Fallback, 0 B Main-Bundle Cost)**: Restores live telemetry on Antigravity `v2.34.0` where `language_server` no longer passes `--csrf_token` on the command line. Adds a Node-side read-only fallback (`renderer-rpc-adapter.mjs`) while keeping the direct HTTP path 100% intact for `v2.33.x` and earlier. Enforces a 5-method read-only allowlist and strict UUID validation, projects numeric/timestamp telemetry in-renderer while stripping all prompts, snippets, tool payloads, and token breakdown trees before crossing CDP, and normalizes Protobuf-ES `Timestamp`, `Duration`, oneof `remaining`, numeric `apiProvider`, and `step.case` fields back into live TPS, TTFT, cache hit rate, quota buckets, and 512K vial metrics.
- **Usage Rollup Full History, Step Counts, 24h Distribution & Subagent Recovery**: Compensates for the removal of `getAllCascadeTrajectories` in `v2.34.0` by supplementing `searchConversations` with read-only local `.db` ID discovery via `discoverLocalConversations`, reusing projected trajectories with full `steps[i].metadata.createdAt` and `invokeSubagent` links inside `fetchUsageRollupBatch`, and fixing `stepCount === 0` precedence in `usage-core.js` to restore accurate step counts, hourly distribution, and subagent attribution.
- **Streaming Prose Choreography & Fallback Selector Adaptation**: Extends `stream-choreography.js` and `vendor/pulse-dashboard/inline-fallback.js` to match both legacy `[data-testid="planner-response-text"]` and `v2.34.0` `[data-testid="agent-response"] [data-markdown-root]`, restoring streaming fade-ins and code-scan animations.

### Changed & Optimized

- **Eliminate 15s Process-Discovery Churn in `renderer-proxy` Mode**: Extends `AntigravityClient.discover()` cache TTL from `15s` to `120s` under `renderer-proxy` (still refreshing immediately on error) to stop periodic PowerShell/netstat scans, skips direct-CSRF background worker spawning in proxy mode, and aligns the projected trajectory budget to `8 MiB`.
- **Gemini 4 / Orchestrator Catalog Updates, CI Stability & Main-Bundle Discipline**: Adds `Gemini 4 Neon / Carbon / Argon / Hydrogen` and `Orchestrator (Neon|Carbon|Argon)` recognition across `usage.mjs`, `context.mjs`, and `model-glyph-crystal.js`, guards non-numeric `modelOrAlias.choice.value` against `NaN` and sorts summaries by recency before truncation in `renderer-rpc-adapter.mjs`, replaces a fixed-delay wait in `test/vendor-coexist.test.mjs` with bounded polling for macOS CI stability, upgrades the prism slider shader with zero new WebGL2 uniforms while keeping the default static bundle at **`684,659 B` (`668.61 KiB`)** (`+1,421 B` headroom under `670 KiB`), and adds `test/v234-compat.test.mjs` (bringing the suite to **276** tests).

## [1.0.2] - 2026-11-21

### Added

- **Chat Mode (Beta · Off by Default, `sidebarStudio`)**: Adds an experimental `Chat Mode (Beta)` toggle under **Settings → Appearance → Beta** (`"off"` by default, hot-toggleable without restart, expanding the validated settings schema to **27** keys). In the off state, the client is never compiled, no CDP binding is registered, and no background service starts. When enabled via an isolated on-demand module, it adds a Code / Chat dual-mode workspace featuring: (1) **Pure** per-session `CustomAgentSpec` isolation with inline policy toggles (web search, images/files, user rules, `zeroTools`) and dynamic plugin/MCP allowlists while keeping global Code permissions untouched (`globalPermissionWrites === 0`); (2) **Spark** single-directory workspaces with native folder pickers, safe file drag-and-drop import, and cross-platform Win32/UNC/WSL/`dev:ino` shared-directory detection; (3) sidebar folder drag-and-drop grouping, multi-select batch actions (skipping running/Code sessions), chat topbar actions (pin, rename, Markdown export, new chat), Gemini reasoning-tier model menu, minimal Pulse cards, and starter chips.
- **Conversation Storage Health & Offline Archiver (`npm run archive:conversations`)**: Adds local conversation DB diagnostics in **Settings → About** and one-click offline archive/restore script generation to curb `language_server` memory bloat from accumulated hidden subagent `.db` files. Strictly move-only (never deletes), bundling `.db` + `.db-wal` + `.db-shm` sets into manifest-tracked batches while preserving main conversations and active subagents, with lossless restore and recovery support.
- **Interactive GUI Install Confirmation (Windows & macOS)**: Both desktop installers now run a read-only environment preflight on launch (zero writes) and wait for explicit user choice (**Install / Reinstall & Upgrade**, **Uninstall & Restore**, or **Cancel**) instead of auto-installing immediately; `--silent` CLI automation remains fully compatible.
- **Local Optical & `/studio` Preview Workbench (`npm run workbench`)**: Includes the local `workbench/` visual preview suite (Single / Split / Quad / Matrix optical inspector plus sandboxed `/studio` Chat preview with project-scoped permission audit drawer), backed by **270** automated tests across Ubuntu 24.04, Windows, and macOS CI plus CodeQL security gates.

### Changed & Optimized

- **Host Turbo Runtime Relief & GPU Texture Reclamation**: Deduplicates repeated inline host `alert.css` `<style>` tags into a `<head>` singleton (restored losslessly on teardown), applies `decoding="async"` / `loading="lazy"` to images, pauses ambient/shimmer animations `1.2s` after window blur with `0ms` instant wake on focus/input, skips style reads and `postMessage` for collapsed/hidden extension iframes (syncing via `ResizeObserver` on reveal), short-circuits sealed `<pre>` code-block scans, and reclaims idle `ag-v2-chroma-fx` particle canvases to `0×0` to free GPU memory.
- **Background Telemetry & Daemon Memory Slimming**: Switches `vendor/pulse-dashboard/` to persistent Keep-Alive HTTP pooling (`maxSockets: 2`) with `includeMessages: false`, adds a zero-allocation discard fast path in `TrajectoryJson`, tightens memory/polling budgets (`4 MiB` reader, `32`-session LRU protecting active background jobs, `2 MiB` delegated usage, `48 MB` / `32 MB` worker old-space caps with OOM diagnostics), trims translator in-memory cache to `400` entries, and releases idle telemetry clients in Daemon after `120s` (or when `telemetryModule === 'off'`).
- **Chat Throttling & Lossless Main Bundle Slimming (`662.15 KiB < 670 KiB`)**: Bounds `lastKnownById` (`<= 2000`) and deleted tombstones (`<= 1000` / 5m TTL), adds deterministic timestamp parsing and render-signature DOM diff skipping in `sidebar-client.js`, and adds interface-safe `minifyGlsl` local-identifier shortening, safe 6-to-3 hex CSS compaction, compact dictionaries, and integer SVG coordinates—bringing the default static bundle down to **`678,046 B` (`662.15 KiB`)** with `+8,034 B` headroom.

### Security

- **Full IPv6 SSRF Defense & API Key Leak Prevention**: Adds complete IPv4 / 8-hextet IPv6 parsing in `translator-service.mjs` to block link-local, unspecified, cloud-metadata, IPv4-mapped/translated/compatible, NAT64, and 6to4 bypasses, tightens keyless local ULA prefix matching against public-domain spoofing, and rejects blocked custom `baseUrl` values outright rather than silently falling back to `api.openai.com` with third-party credentials.
- **Chat Beta Backend Gating, Fail-Closed Isolation & Sandbox Hardening**: Enforces disabled-state zero binding registration and pre-parse gating on `SIDEBAR_BINDING`, main-frame/document-generation verification with teardown revocation, normalized-action `Buffer.byteLength` payload caps (`128 KiB` / `12 MiB`), and client `setPrefValue(s)` rejection; enforces fail-closed Chat message send/creation isolation and zero-listener disabled state in `sidebar-client.js`; hardens `sandboxRoot` verification, blocked import extensions, prototype-pollution filtering, and zero-shell native picker invocations.
- **Installer, Archiver & Daemon Filesystem Hardening**: Adds Zip Slip prefix checks, reparse-point chain blocking, protected system/user root uninstall guards, PID identity checks, and `powershell.exe -EncodedCommand` (replacing `cmd.exe`) in `Program.cs`; hardens `conversation-archive.mjs` with full-platform `language_server` / host process detection (fail-closed on query error), strict CLI numeric validation, symlink-chain rejection, and `0o700` helper scripts; aligns `main.mjs`, `install-plugin.cjs`, and `cdp.js` on `O_EXCL ('wx')` atomic writes, `0o600` permissions, and symlink defenses.
- **Workbench, Omni & Host Bridge Hardening (0 CodeQL Alerts)**: Adds `fs.realpathSync` containment and loopback Host/Origin/`Sec-Fetch-Site`/`X-Studio-Token` (`timingSafeEqual`) checks in `workbench/server.cjs`, allowlists DOM attributes in `workbench/app.js` and sanitizes `SIDEBAR_BINDING` eval IDs in `main.mjs` (bringing open CodeQL alerts to **0**), strips local full paths from `workbench-page.mjs` `postMessage`, and restricts extension iframe theme `postMessage` to `plugin://`, `vscode-webview://`, and loopback origins.

### Fixed

- **Virtual-Scroll Session Flicker & Dual-Mode Transition Fixes**: Tracks real session IDs (`data-cascade-id` / `href`) instead of shifting virtual-scroll DOM indices in `stream-choreography.js`, adding `suppressEntryMotion` and Chat-mode mascot clearance.
- **Style Self-Healing, Beta Tab Persistence & Concurrency Fixes**: Aligns `data-ag-cs-flat` length-fingerprinted self-healing, fixes **Beta** sub-tab persistence in `settings-panel.js`, cancels pending `220ms` pulse-bar timers on `teardownCore()`, serializes `verifyAndHealEntry` via `_runEntryExclusive`, fixes `NaN` storage-index refresh and `_telemetryInFlight` protection in `_handleStorageAction`, and removes dead helpers/CSS.
- **macOS Compatibility & Version/License Alignment**: Allows macOS system root links (`/var`, `/tmp`) in `conversation-archive.mjs` while keeping all other symlinks blocked, fixes case-insensitive APFS path assertions in tests, and aligns `1.0.2` / `GPL-3.0` metadata across all manifests, templates, installers, and workbench views.

## [1.0.1] - 2026-11-18

### Added

- **Omni Native Right-Pane Browser Tab Integration & `v2.33.0+` Stock-First Yielding (`omniModule` / `linkTarget`)**: Yields 100% of stock `<a href="http...">` clicks and context menus to the host's native `defaultLinkOpenTarget`, in-page search, and confirmation modals, while routing bare URLs, `localhost` ports, and translated links into native resizable, multi-tab closable host Browser Tabs (`wcvBrowser` isolated views with `browser-hole-ancestor` transparent viewport pass-through and `v2.33.0+` right-pane scope compatibility).
- **Right-Click Context Menu (Zero Hover Clutter)**: Keeps reading surfaces free of hover toolbars; surfaces actions strictly on `contextmenu` over bare links, file pills, Artifact cards, code headers, and Mermaid diagrams (open in side-pane/default app, reveal in folder, copy absolute/relative paths, insert as `@mention` into composer, and zoom Mermaid diagrams).
- **Loopback HTTP `206 Range` Streaming Gateway & Unsupported-File Auto-Upgrade**: Adds a loopback-only (`127.0.0.1`) token-authenticated streaming server that yields cleanly to native host viewers (`<= 200MB` media, CSV, PDF, HTML, images) and automatically upgrades `> 20MB` / `> 200MB` size-limit or unsupported views in-place into five workbenches: (1) frame-stepped (`1/30s`) large video inspection, `A-B` loop, and lossless PNG frame capture; (2) real-time audio waveform rendering with millisecond markers; (3) checkerboard SVG/transparent-image zoom canvas with `1x/2x/4x` PNG export; (4) responsive local HTML sandboxes and streaming PDF reader; (5) frozen-header `CSV/TSV/JSONL` table search/sorting/pagination and `TTF/OTF/WOFF2` font waterfall specimens.
- **Zero-DOM-Mutation Ink-Feather Streaming Fade & Bare URL/Path Activation (`CSS.highlights`)**: Delivers 5-stage `::highlight(ag-stream-f0..f4)` word-level ink-feather streaming fade-ins across main responses and native thinking blocks (paired with a Smooth Token Pacer soft-focus engine in Thought Translator that settles to `0fps` on completion), while activating bare URLs, `localhost` ports, and local file paths without splitting or detaching host React 19 `HostText` nodes.
- **Host Workbench Integration, 26-Key Settings Center & Thought Translator Upgrades**: Adds real-time four-theme token syncing for `plugin://*` extension iframes, sticky headers with manual folding for completed code blocks (`>= 48` lines), conversation rail outline filtering with `Alt+↑/↓` navigation, and three-state `0fps` semantic edge cues; expands the settings schema to **26** validated keys with three scene presets (Full Visuals / Deep Focus / Silent Eco), sanitized JSON config backup/restore, and one-click stored API key clearing; adds `file://` line-number jump pills, keyless local LLM endpoints, concurrency queuing, and full local plugin deployment in Windows/macOS installers.

### Changed & Optimized

- **Microkernel Runtime Split**: Decomposes `ui-runtime.js` into a compact microkernel orchestrating 6 independent controller modules (`home-studio-panel.js`, `home-ripple-host.js`, `model-glyph-crystal.js`, `stream-choreography.js`, `prism-rim-canvas.js`, `host-workbench-enhancer.js`).
- **Shared-Pool Compiler & On-Demand Injection**: Upgrades `cdp.js` with a cross-module shared string pool, GLSL minification, and CSS constant folding (`669.08 KiB < 670 KiB` static main bundle, plus on-demand Omni client injection); reduces warm config refresh builds to `< 3.6ms` and enforces `~30fps` steady-state throttling with `0fps` idle sleep on 300Hz displays.
- **Zero-Visual-Loss Long-Session Optimization & Lock-Free Thought-Cache Overhaul (`52.5×` Streaming FPS Boost)**: Implements `O(1)` caching and strict DOM write/read phase separation across all runtime modules (`smooth-caret` fast-path selection gating, two-phase `prism-rim-canvas` geometry reads, conflict-free shared `CSS.highlights` buckets, and external Pulse re-injection deadlock prevention); overhauls Thought Translator storage caching with `checkVisibility()` hidden-ancestor ghost-DOM suppression, `800px` viewport-band lazy hydration on captured scroll, `O(1)` folded-preload regex/hash elimination, L1 hot-window idle-debounced flushes, first-frame persisted `custom` style-tag hits, and Daemon single-flight async atomic disk writes—delivering a `52.5×` streaming frame-rate boost (`3.30ms` P50 frame interval, `0.00ms` forced synchronous layout, and `74.5%` lower task time under full cache) in `34k+`-node sessions.
- **Telemetry `v0.9.1` Alignment, Solid Optical Quota Bars & 1:1 Pixel-Matrix Effort Slider**: Aligns `vendor/pulse-dashboard/` with `ATtacK030130/antigrative-dashboard` `v0.9.1` (MIT) with redesigned solid optical-gradient quota bars, main vs. Swarm/subagent token attribution, cache hit rate, and CDP process-lineage discovery; introduces a zero-WMI `NtQueryInformationProcess` fast path on Windows (`< 520ms`), dedicated `#ag-prism-pulse-bar` host isolation (auto-hidden on New Conversation home screens) with compact right-aligned context vial cards, and 1:1 faithful Claude / Gemini pixel-dot matrix, detent dots, and `High`-tier luminous border rendering on the effort slider.
- **Legacy Key & Dead-File Cleanup**: Retires 3 unreferenced legacy config keys (`ringMode`, `effortSliderStyle`, `effortAccent`), removes 8 unused legacy files under `vendor/pulse-dashboard/compat/`, and prunes unused localization entries, sprite tables, and stale CSS rules.

### Security

- **Per-Directory HMAC Sub-Tokens & Opaque Sandbox Isolation**: Protects local HTML preview mounts with `HMAC-SHA256(secret, mountId)` read-only sub-tokens (isolated from `/meta`, `/stream`, and `/viewer` with sliding TTL eviction) inside opaque `sandbox` iframes without `allow-same-origin`.
- **Top-Level Frame Verification on CDP Bindings**: Enforces top-level `mainFrameId` and main-world context validation across all `__agPrism*` CDP bindings, rejecting sub-`<iframe>` RPC calls.
- **Sensitive Credential & Remote UNC Blocking**: Applies pre- and post-`realpath` denylists for `.env*`, `.ssh`, `.aws`, private keys, browser credential stores, and local translator config files, while blocking remote Windows UNC paths (preventing NetNTLMv2 hash leakage) and executable shortcuts.
- **Cross-Site Guards, Linear Allowlist SVG Builder & CodeQL Hardening**: Enforces `Host`, `Sec-Fetch-Site`, explicit slice allocation bounds, strict `CSP`, and `Referrer-Policy: no-referrer`; builds sanitized SVG DOM trees via an `O(n)` lexical allowlist scanner and `createElementNS` (zero `innerHTML` / `DOMParser` sinks); escapes all dynamic CDP callback payloads via `serializeJsonForEval`, eliminates ReDoS backtracking in path tokenizers, and blocks redirects/cloud-metadata IPs in translator requests.

### Fixed

- **Single-Flight Config Broadcast & `pendingAckEpoch` Guard**: Eliminates UI state rebound during rapid consecutive setting toggles and prevents startup script handle leaks via session-scoped `pendingAckEpoch` tracking and single-flight broadcast coalescing.
- **Thought Translator Zero-Flicker `appendData` Streaming, V8 Binding & Badge Fixes**: Preserves live `CSS.highlights` ranges via `TextNode.appendData` with incomplete-Markdown tail buffering and block-level DOM reuse for zero streaming flicker; connects cache stats, disk cache clearing, and queue cancellation through `window.__agPrismThoughtBridge.call`, and fixes false fallback badges on AI responses.
- **`Antigravity v2.33.0+` Dual-Layer Port Self-Healing, Zero-Node Daemon Bootstrap & Stale-PID Guard**: Automatically maintains `--remote-debugging-port=0` on `Antigravity.lnk` shortcuts for `Antigravity v2.33.0+` (cleanly stripped on uninstall) and offers deduplicated single-prompt safe relaunch recovery after `quitAndInstall` auto-updates; bootstraps the full local background `Daemon` via bundled Electron (`ELECTRON_RUN_AS_NODE=1`) without system Node.js, enforces 100% command-line signature checks (`NtQueryInformationProcess` / `ps`) with stale `.daemon.pid` self-healing, and prevents false style teardown in Swarm Full View (`Untitled Conversation`).
- **Font Fallbacks, Monochrome Token Sync & WCAG AA Contrast**: Adds Windows `Consolas` fallback for `SF Mono` and code ligatures; aligns the context vial, quota bars, and effort slider with `mono` silver-titanium tokens; calibrates stacking context layering between bottom telemetry popover cards and the pixel mascot stage; fixes `mascot: "minis"` persistence, `webglcontextlost` 2D fallback, and light-mode workbench contrast (`>= 4.87:1` WCAG AA).

## [1.0.0] - 2026-11-17

### Added

- **Four Dark/Daylight Themes**: Initial release with `obsidian`, `warm`, `crystal`, and `alabaster` palettes and automatic host light/dark tracking.
- **Spring Motion, WebGL2 Shaders & Pixel Mascots**: Introduces 4-tier damped spring physics, WebGL2 horizon and glyph wavefields, read/write-separated smooth caret tracking, and optional composer pixel mascots.
- **Smart-Coexisting Telemetry, Effort Slider & Dual-Mode Thought Translator**: Ships the 512K shallow-water context vial, model-menu effort slider with Auto-Yield coexistence, dual-mode thought translation, standalone Windows/macOS installers, and `GPL-3.0-only` + `NOTICE` compliance metadata.
