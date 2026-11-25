import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { createWorkbenchServer, DEFAULT_TOKENS, validateAndNormalizeTokens } = require('../workbench/server.cjs');

test('workbench server serves HTML, styles, shared core scripts, and safely validates/persists tokens including lightPreset', async () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ag-prism-wb-test-'));
  const tmpTokensPath = path.join(tmpDir, 'design-tokens.json');
  fs.writeFileSync(tmpTokensPath, JSON.stringify(DEFAULT_TOKENS, null, 2), 'utf8');

  const server = createWorkbenchServer({ tokensPath: tmpTokensPath, watch: false });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));

  try {
    const addr = server.address();
    const baseUrl = `http://127.0.0.1:${addr.port}`;

    // 1. HTML, CSS, and shared runtime scripts
    for (const p of [
      '/',
      '/legacy',
      '/replica.css',
      '/replica.js',
      '/api/prism-inject.js?palette=obsidian&corners=balanced',
      '/api/prism-remove.js',
      '/styles/v2-tokens.css',
      '/styles/v2-components.css',
      '/styles/workbench-shell.css',
      '/shared/style.css',
      '/shared/ripple-core.js',
      '/shared/motion-engine.js',
      '/shared/animated-icons.js',
      '/shared/dual-mascot-rig.js',
      '/shared/vial-core.js',
      '/shared/crystal-prism-core.js',
      '/shared/effort-slider-client.js',
    ]) {
      const res = await fetch(baseUrl + p);
      assert.equal(res.status, 200, `Expected 200 for ${p}`);
      const text = await res.text();
      assert.ok(text.length > 50, `Expected non-empty content for ${p}`);
    }

    // 2. Directory traversal protection
    const traversal = await fetch(baseUrl + '/../package.json');
    assert.ok(traversal.status === 403 || traversal.status === 404);

    // 3. GET & POST /api/tokens (with lightPreset: 'crystal' | 'alabaster')
    const getRes = await fetch(baseUrl + '/api/tokens');
    assert.equal(getRes.status, 200);
    const loaded = await getRes.json();
    assert.equal(loaded.palette, 'obsidian');
    assert.equal(loaded.lightPreset, 'crystal');
    assert.equal(loaded.prismStrength, 1);

    const postRes = await fetch(baseUrl + '/api/tokens', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        palette: 'titanium',
        theme: 'light',
        lightPreset: 'alabaster',
        radiusBase: 2,
        glassBlur: 999,
        prismStrength: 2.5,
      }),
    });
    assert.equal(postRes.status, 200);
    const saved = await postRes.json();
    assert.equal(saved.ok, true);
    assert.equal(saved.tokens.palette, 'titanium');
    assert.equal(saved.tokens.theme, 'light');
    assert.equal(saved.tokens.lightPreset, 'alabaster');
    assert.equal(saved.tokens.radiusBase, 2);
    assert.equal(saved.tokens.glassBlur, 36);
    assert.equal(saved.tokens.prismStrength, 1);

    const warmRes = await fetch(baseUrl + '/api/tokens', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ palette: 'warm', lightPreset: 'crystal', prismStrength: 0.4 }),
    });
    assert.equal(warmRes.status, 200);
    const warmSaved = await warmRes.json();
    assert.equal(warmSaved.tokens.palette, 'warm');
    assert.equal(warmSaved.tokens.lightPreset, 'crystal');
    assert.equal(warmSaved.tokens.prismStrength, 0.4);

    // Invalid palette or lightPreset returns 400
    const badRes = await fetch(baseUrl + '/api/tokens', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ palette: 'neon-pink' }),
    });
    assert.equal(badRes.status, 400);

    const badPresetRes = await fetch(baseUrl + '/api/tokens', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lightPreset: 'washout-white' }),
    });
    assert.equal(badPresetRes.status, 400);

    assert.throws(() => validateAndNormalizeTokens(null));
  } finally {
    await new Promise((resolve) => server.close(resolve));
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('workbench app aligns real Antigravity effort tiers (no off/max) and provides Orchestrator dual-phase bar', () => {
  const appPath = path.resolve(import.meta.dirname, '..', 'workbench', 'app.js');
  const src = fs.readFileSync(appPath, 'utf8');

  const effortsBlockMatch = src.match(/const ALL_EFFORTS = \[([\s\S]*?)\];/);
  assert.ok(effortsBlockMatch, 'Expected ALL_EFFORTS declaration in workbench/app.js');
  const effortsBlock = effortsBlockMatch[1];
  assert.equal(/\bid:\s*['"]off['"]/.test(effortsBlock), false, 'ALL_EFFORTS must not expose fake "off" effort');
  assert.equal(/\bid:\s*['"]max['"]/.test(effortsBlock), false, 'ALL_EFFORTS must not expose fake "max" effort');
  assert.ok(/\bid:\s*['"]low['"]/.test(effortsBlock));
  assert.ok(/\bid:\s*['"]medium['"]/.test(effortsBlock));
  assert.ok(/\bid:\s*['"]high['"]/.test(effortsBlock));
  assert.ok(/\bid:\s*['"]xhigh['"]/.test(effortsBlock));

  const modelsBlockMatch = src.match(/const MODELS = \[([\s\S]*?)\n  \];/);
  assert.ok(modelsBlockMatch, 'Expected MODELS declaration in workbench/app.js');
  const modelsBlock = modelsBlockMatch[1];
  assert.equal(/['"]off['"]/.test(modelsBlock), false, 'MODELS must not contain "off" effort');
  assert.equal(/['"]max['"]/.test(modelsBlock), false, 'MODELS must not contain "max" effort');
  assert.ok(/id:\s*['"]orchestrator['"]/.test(modelsBlock), 'MODELS must register orchestrator');
  assert.ok(/isOrchestrator:\s*true/.test(modelsBlock), 'orchestrator model must set isOrchestrator: true');

  assert.ok(src.includes('data-testid="orchestrator-effort-bar"'), 'Must render dedicated orchestrator-effort-bar');
  assert.ok(src.includes('data-orch-crystal-canvas="true"'), 'Orchestrator effort bar must render crystal prism canvas');
  assert.equal(src.includes('ag-v2-orch-block'), false, 'Legacy snake-like ag-v2-orch-block must be removed');
  assert.equal(src.includes('ag-v2-orch-knob'), false, 'Legacy plastic white ag-v2-orch-knob must be removed');
  assert.ok(src.includes("action === 'toggle-orchestrator'"), 'Must handle toggle-orchestrator action');

  assert.ok(src.includes('contextVialEnabled: true'), 'Workbench state should default contextVialEnabled to true');
  assert.ok(src.includes('data-testid="context-minimal-bar"'), 'Must render minimal segmented context bar when vial is disabled');
  assert.ok(src.includes('data-testid="context-vial-switch"'), 'Settings panel must expose context-vial-switch');
  assert.ok(src.includes('data-testid="radar-vial-mode-toggle"'), 'Radar popover must expose inline vial mode toggle');
  assert.ok(src.includes("action === 'toggle-context-vial'"), 'Must handle toggle-context-vial action');

  const htmlPath = path.resolve(import.meta.dirname, '..', 'workbench', 'index.html');
  const htmlSrc = fs.readFileSync(htmlPath, 'utf8');
  assert.ok(htmlSrc.includes('data-vial-cmd="mode"'), 'Inspector must expose context vial toggle button');
  assert.ok(htmlSrc.includes('data-mascot-cmd="bump"'), 'Inspector must expose mascot bump demo button');
  assert.ok(htmlSrc.includes('data-mascot-cmd="passBy"'), 'Inspector must expose mascot passBy demo button');

  assert.equal(src.includes('ag-v2-effort-bars'), false, 'Legacy cellular signal bars ag-v2-effort-bars must be removed');
  assert.equal(src.includes('ag-v2-ebar'), false, 'Legacy signal bar item ag-v2-ebar must be removed');
  assert.ok(src.includes('data-composer-model-glyph="true"'), 'Model trigger must render official brand optical glyph');
  assert.ok(src.includes('data-orbital-geometry="true"'), 'Studio Bento chassis must render Antigravity orbital geometry');
  assert.ok(src.includes('data-thinking-spark="true"'), 'Thinking pill must render living brand spark');
});

test('workbench v1.0 rebrands to Obsidian Prism, supports Dual Light / Dark 4-theme matrix, and displays live GPU telemetry', () => {
  const appPath = path.resolve(import.meta.dirname, '..', 'workbench', 'app.js');
  const htmlPath = path.resolve(import.meta.dirname, '..', 'workbench', 'index.html');
  const serverPath = path.resolve(import.meta.dirname, '..', 'workbench', 'server.cjs');
  const tokensCssPath = path.resolve(import.meta.dirname, '..', 'workbench', 'styles', 'v2-tokens.css');
  const cssPath = path.resolve(import.meta.dirname, '..', 'workbench', 'styles', 'v2-components.css');
  const shellCssPath = path.resolve(import.meta.dirname, '..', 'workbench', 'styles', 'workbench-shell.css');
  const src = fs.readFileSync(appPath, 'utf8');
  const htmlSrc = fs.readFileSync(htmlPath, 'utf8');
  const serverSrc = fs.readFileSync(serverPath, 'utf8');
  const tokensCssSrc = fs.readFileSync(tokensCssPath, 'utf8');
  const cssSrc = fs.readFileSync(cssPath, 'utf8');
  const shellCssSrc = fs.readFileSync(shellCssPath, 'utf8');

  // 1. Obsidian Prism v1.0 rebranding & zero hardcoded legacy repo directory name
  assert.equal(src.includes('M21.751 22.607'), false);
  assert.equal(htmlSrc.includes('M21.751 22.607'), false);
  assert.equal(src.includes('antigravity-prism'), false, 'No hardcoded old folder name in workbench/app.js');
  assert.equal(serverSrc.includes('antigravity-prism'), false, 'No hardcoded old folder name in workbench/server.cjs');
  assert.ok(htmlSrc.includes('Obsidian Prism v1.0 · Optical &amp; Performance Workbench'), 'Topbar & title must upgrade to Obsidian Prism v1.0');
  assert.ok(src.includes('Obsidian Prism · Optical Engine'));
  assert.ok(src.includes('renderGoogleSparkOrbitSvg'));

  // 2. 4-Theme Presets (Dark Obsidian / Dark Warm / Light Daylight Crystal / Light Warm Alabaster) & Quad View
  for (const preset of ['obsidian-dark', 'warm-dark', 'daylight-crystal', 'warm-alabaster']) {
    assert.ok(htmlSrc.includes(`data-wb-preset="${preset}"`), `Topbar must expose quick preset "${preset}"`);
  }
  assert.ok(htmlSrc.includes('data-wb-view="quad"'), 'Topbar must expose 4-theme Quad comparison view');
  assert.ok(src.includes('data-testid="wb-quad-theme-matrix"'), 'app.js must render 2x2 quad theme matrix');
  assert.ok(tokensCssSrc.includes('#e8eef6') && tokensCssSrc.includes('#f4f7fb'), 'v2-tokens.css must define Daylight Crystal surface hierarchy');
  assert.ok(tokensCssSrc.includes('#ebe6dc') && tokensCssSrc.includes('#f6f4ee'), 'v2-tokens.css must define Warm Alabaster surface hierarchy');

  // 3. Live 0fps Idle Sleep Telemetry in Inspector
  assert.ok(htmlSrc.includes('data-testid="wb-perf-sleep-monitor"'), 'Inspector must expose GPU sleep monitor card');
  assert.ok(htmlSrc.includes('Aura: 0fps Idle Sleep'), 'Inspector must display Aura: 0fps Idle Sleep indicator');
  assert.ok(htmlSrc.includes('Ripple: 0fps Idle Sleep'), 'Inspector must display Ripple: 0fps Idle Sleep indicator');
  assert.ok(htmlSrc.includes('Vial: 0fps Idle Sleep'), 'Inspector must display Vial: 0fps Idle Sleep indicator');
  assert.ok(src.includes('getPerfSleepState'), 'Workbench test API must expose getPerfSleepState()');

  // 4. Hybrid collapsible sidebar, skimmer wake & animated icons
  assert.ok(src.includes('sidebarCollapsed: false'));
  assert.ok(src.includes('data-testid="sidebar-collapse-btn"'));
  assert.ok(src.includes('data-testid="sidebar-search-toggle"'));
  assert.ok(src.includes('waves.skimmer('));
  assert.ok(htmlSrc.includes('/shared/motion-engine.js'));
  assert.ok(htmlSrc.includes('/shared/animated-icons.js'));
  assert.ok(shellCssSrc.includes('overflow: clip;'));
  assert.ok(cssSrc.includes('overflow: clip;'));
});

test('workbench & host runtime enforce GPU compositor optimization, 32% aura height, 0fps sleep, and optical showcase parity', () => {
  const appPath = path.resolve(import.meta.dirname, '..', 'workbench', 'app.js');
  const htmlPath = path.resolve(import.meta.dirname, '..', 'workbench', 'index.html');
  const cssPath = path.resolve(import.meta.dirname, '..', 'workbench', 'styles', 'v2-components.css');
  const hostCssPath = path.resolve(import.meta.dirname, '..', 'style.css');
  const runtimePath = path.resolve(import.meta.dirname, '..', 'ui-runtime.js');
  const src = fs.readFileSync(appPath, 'utf8');
  const htmlSrc = fs.readFileSync(htmlPath, 'utf8');
  const cssSrc = fs.readFileSync(cssPath, 'utf8');
  const hostCssSrc = fs.readFileSync(hostCssPath, 'utf8');
  const extractedParts = [
    'conv-aura.js',
    'home-studio-panel.js',
    'home-ripple-host.js',
    'model-glyph-crystal.js',
    'stream-choreography.js',
    'prism-rim-canvas.js',
  ]
    .map((rel) => fs.readFileSync(path.resolve(import.meta.dirname, '..', rel), 'utf8'))
    .join('\n');
  const runtimeSrc = fs.readFileSync(runtimePath, 'utf8') + '\n' + extractedParts;

  // 1. Composer send/cancel & sidebar running indicator parity
  assert.ok(src.includes('ag-v2-send-btn'));
  assert.ok(src.includes('data-testid="input-cancel-button"'));
  assert.ok(src.includes('data-testid="status-loading-spinner"'));
  assert.ok(src.includes('maxTokens: 512000'));
  assert.ok(src.includes('128k / 256k / 384k'));
  assert.ok(src.includes('ag-v2-conv-aura') && src.includes('ag-v2-conv-glow'));

  // 2. Host style.css & ui-runtime.js performance & compatibility contracts
  assert.ok(hostCssSrc.includes('[data-testid="send-button"] svg{display:none !important;}'));
  assert.ok(hostCssSrc.includes('[data-testid="input-cancel-button"]::before'));
  assert.ok(runtimeSrc.includes('enterIdleSleep()'), 'ui-runtime.js ripple must support 0fps true idle sleep');
  assert.ok(runtimeSrc.includes('enterAuraSleep()'), 'ui-runtime.js conversation aura must support 0fps true idle sleep');
  assert.ok(runtimeSrc.includes('CONV_AURA_HEIGHT_RATIO = 0.32'), 'ui-runtime.js must shrink conversation aura canvas to 32% height');
  assert.ok(runtimeSrc.includes('STREAM_BATCH_MS = 52'), 'ui-runtime.js must coalesce stream chunks at 52ms');
  assert.ok(runtimeSrc.includes('ag-prism-thought-raw-toggle'), 'ui-runtime.js must explicitly isolate Thought Translator raw-toggle button');

  // 3. 4-tier motionLevel & Hero A/C/D/dual-stream showcase
  for (const tier of ['off', 'subtle', 'standard', 'ultra']) {
    assert.ok(htmlSrc.includes(`data-wb-motion="${tier}"`), `index.html must expose motion tier "${tier}"`);
  }
  for (const demo of ['liftoff', 'caustic', 'fiber', 'dual-stream']) {
    assert.ok(htmlSrc.includes(`data-hero-demo="${demo}"`), `Inspector must expose hero demo "${demo}"`);
    assert.ok(src.includes(`data-hero-demo="${demo}"`), `Studio showcase must expose hero demo "${demo}"`);
  }
  assert.ok(cssSrc.includes('.ag-cs-liftoff-veil') && cssSrc.includes('.ag-cs-liftoff-ring'));
  assert.ok(cssSrc.includes('[data-ag-cs-caustic="1"]::after'));
  assert.ok(cssSrc.includes('[data-testid="agent-input-box"][data-ag-cs-fiber-camp]'));
  assert.ok(cssSrc.includes('.ag-cs-stream-chunk') && !cssSrc.includes('filter: blur(4px)'), 'Stream chunk blur filter must be purged in workbench CSS too');
  assert.ok(runtimeSrc.includes('syncWorkedForAutoUnfold') && runtimeSrc.includes('ag-cs-conv-aura-host'));
  assert.ok(runtimeSrc.includes('syncLensOverlayOrigins') && runtimeSrc.includes('syncHostAnimatedIcons'));

  // 4. WO-MAIN-001C True-CSS M3 Expressive Surface Lab & 0 non-ASCII guard
  assert.ok(htmlSrc.includes('data-wb-scene="m3lab"'), 'index.html must expose M3 true-CSS surface lab scene');
  assert.ok(htmlSrc.includes('href="/shared/style.css"'), 'index.html must link /shared/style.css for true-CSS M3 preview');
  assert.ok(src.includes('buildM3LabSceneHtml') && src.includes('syncLiveStyleCss'), 'app.js must implement true-CSS M3 surface lab');
  assert.ok(hostCssSrc.includes('--ag-cs-tonal-0') && hostCssSrc.includes('.agy-fastpick') && hostCssSrc.includes('.agy-toast'), 'style.css must define M3 tonal tokens and 4 dead-zone surfaces');
  let badCssChars = 0;
  for (let i = 0; i < hostCssSrc.length; i++) {
    const code = hostCssSrc.charCodeAt(i);
    if (code >= 0x00a1 && code <= 0x1360) badCssChars++;
  }
  assert.equal(badCssChars, 0, 'style.css must stay strictly free of 0x00A1..0x1360 chars for packCssJsExpr');
});
