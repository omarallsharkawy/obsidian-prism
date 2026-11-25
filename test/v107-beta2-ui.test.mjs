import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const ROOT = path.resolve(import.meta.dirname, '..');
const cdp = require(path.join(ROOT, 'cdp.js'));
const ctxMenuMod = require(path.join(ROOT, 'context-menu-btw.js'));
const i18nRuntime = require(path.join(ROOT, 'vendor', 'host-i18n', 'host-i18n-runtime.js'));

function checkBalancedBraces(css) {
  let depth = 0;
  let inSingle = false;
  let inDouble = false;
  let inComment = false;
  for (let i = 0; i < css.length; i += 1) {
    const ch = css[i];
    const next = css[i + 1];
    if (inComment) {
      if (ch === '*' && next === '/') { inComment = false; i += 1; }
      continue;
    }
    if (!inSingle && !inDouble && ch === '/' && next === '*') { inComment = true; i += 1; continue; }
    if (ch === '\\' && (inSingle || inDouble)) { i += 1; continue; }
    if (!inDouble && ch === "'") { inSingle = !inSingle; continue; }
    if (!inSingle && ch === '"') { inDouble = !inDouble; continue; }
    if (inSingle || inDouble) continue;
    if (ch === '{') depth += 1;
    else if (ch === '}') {
      depth -= 1;
      if (depth < 0) return false;
    }
  }
  return depth === 0 && !inSingle && !inDouble && !inComment;
}

test('v1.0.7-beta.2 Task 1 (PR #20): .ag-cs-nav-outline-trigger positioning and z-index stay in top safe zone without occluding turn dots or popover', () => {
  const css = fs.readFileSync(path.join(ROOT, 'style.css'), 'utf8');
  const trigLine = css.split(/\r?\n/).find((l) => l.includes('& .ag-cs-nav-outline-trigger{'));
  const popLine = css.split(/\r?\n/).find((l) => l.includes('& .ag-cs-nav-outline-popover{'));
  assert.ok(trigLine, 'style.css must define .ag-cs-nav-outline-trigger');
  assert.ok(popLine, 'style.css must define .ag-cs-nav-outline-popover');
  assert.ok(trigLine.includes('position:absolute;top:10px;left:4px;'), 'trigger must anchor cleanly at top:10px left:4px');
  assert.ok(trigLine.includes('width:20px;height:20px;'), 'trigger must remain compact 20x20');
  assert.ok(trigLine.includes('pointer-events:auto;'), 'trigger must explicitly enable pointer-events:auto');
  const trigZ = Number(trigLine.match(/z-index:(\d+)/)?.[1]);
  const popZ = Number(popLine.match(/z-index:(\d+)/)?.[1]);
  assert.equal(trigZ, 20);
  assert.equal(popZ, 35);
  assert.ok(trigZ < popZ, 'trigger z-index must remain strictly below outline popover z-index');
  const bridgeLine = css.split(/\r?\n/).find((l) => l.includes('& .ag-cs-nav-outline-popover::before{'));
  assert.ok(bridgeLine, 'style.css must define .ag-cs-nav-outline-popover::before bridge');
  assert.ok(
    bridgeLine.includes('left:-6px;top:0;bottom:0;width:8px;'),
    'outline popover ::before must span only left:-6px;width:8px (24..32px) so trigger click area (4..24px) has zero occlusion'
  );
});

test('v1.0.7-beta.2 Task 2 (PR #21 hardening): conv-aura caps pre-sleep WebGL2 phases (idle/awaiting-decision/long-task-complete) to ~30fps (33ms), keeps running at smooth 60fps, and enforces 0fps sleep in motion=off & hostSleep', () => {
  const auraSrc = fs.readFileSync(path.join(ROOT, 'conv-aura.js'), 'utf8');
  let nowMs = 1000;
  let rafSeq = 0;
  let timerSeq = 0;
  const rafs = new Map();
  const timers = new Map();
  const scheduledDelays = [];
  let motionAllowed = true;
  let hidden = false;
  let focused = true;
  let running = false;
  let glowDraws = 0;
  let backingCleared = 0;

  const htmlAttrs = new Map([['data-ag-cs-motion', 'ultra']]);
  const makeEl = (tag) => {
    const attrs = new Map();
    const children = [];
    const el = {
      tagName: String(tag).toUpperCase(),
      className: '',
      width: 0,
      height: 0,
      clientWidth: 800,
      clientHeight: 600,
      isConnected: true,
      parentElement: null,
      children,
      style: { setProperty() {} },
      setAttribute(k, v) { attrs.set(k, String(v)); },
      getAttribute(k) { return attrs.has(k) ? attrs.get(k) : null; },
      hasAttribute(k) { return attrs.has(k); },
      removeAttribute(k) { attrs.delete(k); },
      appendChild(c) { c.parentElement = el; children.push(c); return c; },
      insertBefore(c) { c.parentElement = el; children.unshift(c); return c; },
      remove() { el.isConnected = false; },
      closest: () => null,
      matches: () => true,
      getBoundingClientRect: () => ({ left: 0, top: 0, width: 32, height: 32, right: 32, bottom: 32 }),
      querySelector: () => null,
      querySelectorAll: () => [],
      addEventListener() {},
      removeEventListener() {},
    };
    return el;
  };

  const convView = makeEl('div');
  convView.setAttribute('data-testid', 'conversation-view');
  const stageParent = makeEl('div');
  stageParent.appendChild(convView);
  const cancelBtn = makeEl('button');
  cancelBtn.setAttribute('data-testid', 'input-cancel-button');

  const doc = {
    get hidden() { return hidden; },
    hasFocus: () => focused,
    documentElement: {
      getAttribute: (k) => (htmlAttrs.has(k) ? htmlAttrs.get(k) : null),
      hasAttribute: (k) => htmlAttrs.has(k),
    },
    body: makeEl('body'),
    createElement: makeEl,
    querySelector: (s) => {
      if (s.includes('conversation-view')) return convView;
      if (s.includes('input-cancel-button')) return running ? cancelBtn : null;
      return null;
    },
    querySelectorAll: (s) => {
      if (s.includes('conversation-view')) return [convView];
      if (s.includes('input-cancel-button') || s.includes('stop-button')) return running ? [cancelBtn] : [];
      return [];
    },
    addEventListener() {},
    removeEventListener() {},
  };

  const sb = {
    document: doc,
    window: { devicePixelRatio: 1, addEventListener() {}, removeEventListener() {} },
    performance: { now: () => nowMs },
    requestAnimationFrame: (fn) => { const id = ++rafSeq; rafs.set(id, fn); return id; },
    cancelAnimationFrame: (id) => { rafs.delete(id); },
    setTimeout: (fn, ms) => {
      const id = ++timerSeq;
      scheduledDelays.push(ms);
      timers.set(id, { fn, ms });
      return id;
    },
    clearTimeout: (id) => { timers.delete(id); },
    Map, Set, Math, Number, String, Boolean, Array, Object, Date,
  };
  sb.globalThis = sb;
  vm.runInNewContext(auraSrc, sb);

  const flushRafs = () => {
    const entries = Array.from(rafs.entries());
    rafs.clear();
    for (const [, fn] of entries) fn(nowMs);
  };
  const flushTimers = () => {
    const entries = Array.from(timers.entries());
    timers.clear();
    for (const [, rec] of entries) rec.fn();
  };

  const ctl = sb.__agPrismConvAura.createConvAuraController({
    rippleCore: {
      resolveHorizonDpr: (d, s) => d * s,
      mountBrandHorizonGlow: () => ({
        mode: 'webgl2',
        resize() {},
        draw() { glowDraws += 1; return true; },
        drawStaticSnapshot() { glowDraws += 1; return true; },
        invalidate() {},
        clear() {},
        releaseBackingStore() { backingCleared += 1; },
        dispose() {},
      }),
    },
    isDestroyed: () => false,
    isHomeRippleEnabled: () => true,
    isDarkTheme: () => true,
    isMotionStandardOrUltra: () => motionAllowed,
    isWindowFocused: () => focused,
    getMinFrameGapMs: () => 16,
    getAmbientIntensity: () => 1,
    setAttrIfChanged(el, k, v) { el?.setAttribute?.(k, v); },
    runGuardedMut: (fn) => fn(),
  });

  // 1) Idle pre-sleep phase: must NOT spin 60fps rAF; must schedule ~33ms timer & throttle +16ms early wake
  ctl.sync(false);
  flushRafs();
  assert.equal(ctl.getInstance().phase, 'idle');
  assert.equal(rafs.size, 0, 'idle pre-sleep phase must use ~30fps timer instead of spinning 60fps rAF');
  assert.equal(timers.size, 1, 'idle pre-sleep phase should schedule a single ~33ms timer');
  assert.ok(scheduledDelays[scheduledDelays.length - 1] >= 33, `idle pre-sleep delay must be >= 33ms, got ${scheduledDelays[scheduledDelays.length - 1]}`);

  const drawsAfterIdle1 = glowDraws;
  nowMs += 16; // +16ms < 31ms pre-sleep effectiveMinGap -> must throttle!
  flushTimers();
  flushRafs();
  assert.equal(glowDraws, drawsAfterIdle1, 'idle pre-sleep must throttle 16ms ticks to stay capped at ~30fps');

  nowMs += 20; // total +36ms >= 31ms -> must draw!
  flushTimers();
  flushRafs();
  assert.equal(glowDraws, drawsAfterIdle1 + 1, 'idle pre-sleep must draw cleanly at ~33ms step');

  // 2) Running phase: smooth WebGL2 VSync 60fps via rAF directly
  running = true;
  nowMs += 50;
  ctl.sync(false);
  flushRafs();
  // Advance past 'start' burst into 'running'
  nowMs += 1500;
  flushRafs();
  assert.equal(ctl.getInstance().phase, 'running');
  assert.equal(rafs.size, 1, 'running phase with WebGL2 + minGap=16 must schedule smooth VSync rAF');
  assert.equal(timers.size, 0, 'running phase smooth VSync must not depend on setTimeout jitter');

  // 3) awaiting-decision pre-sleep phase: capped at ~30fps (33ms timer, 0 rAF spin)
  running = false;
  nowMs += 300;
  ctl.setSemanticState({ awaitingDecision: true });
  flushRafs();
  assert.equal(ctl.getInstance().phase, 'awaiting-decision');
  assert.equal(rafs.size, 0, 'awaiting-decision pre-sleep phase must not spin 60fps rAF');
  assert.ok(scheduledDelays[scheduledDelays.length - 1] >= 33, `awaiting-decision delay must be >= 33ms, got ${scheduledDelays[scheduledDelays.length - 1]}`);

  // 4) long-task-complete pre-sleep phase: capped at ~30fps (33ms timer, 0 rAF spin)
  ctl.setSemanticState({ awaitingDecision: false });
  focused = false;
  nowMs += 300;
  ctl.triggerLongTaskComplete(nowMs);
  flushRafs();
  assert.equal(ctl.getInstance().phase, 'long-task-complete');
  assert.equal(rafs.size, 0, 'long-task-complete pre-sleep phase must not spin 60fps rAF');
  assert.ok(scheduledDelays[scheduledDelays.length - 1] >= 33, `long-task-complete delay must be >= 33ms, got ${scheduledDelays[scheduledDelays.length - 1]}`);

  // 5) motionLevel='off' -> 100% 0fps sleep invariant
  motionAllowed = false;
  nowMs += 50;
  ctl.sync(false);
  flushRafs();
  assert.equal(ctl.getInstance().sleeping, true, 'motionLevel=off must enter sleep immediately');
  assert.equal(rafs.size, 0, 'motionLevel=off must have 0 pending rAFs');
  assert.equal(timers.size, 0, 'motionLevel=off must have 0 pending timers');

  // 6) hostSleep (document.hidden = true) -> 0fps + 0x0 VRAM release
  motionAllowed = true;
  hidden = true;
  nowMs += 50;
  ctl.sync(false);
  flushRafs();
  assert.equal(ctl.getInstance().sleeping, true, 'hostSleep (hidden) must sleep at 0fps');
  assert.equal(rafs.size, 0, 'hostSleep must have 0 pending rAFs');
  assert.equal(timers.size, 0, 'hostSleep must have 0 pending timers');
  assert.ok(backingCleared >= 1, 'hostSleep (hidden) must release WebGL2 backing store');

  // 7) window blur (data-ag-cs-win-blur="1") -> 0fps sleep invariant
  hidden = false;
  htmlAttrs.set('data-ag-cs-win-blur', '1');
  nowMs += 50;
  ctl.sync(false);
  flushRafs();
  assert.equal(ctl.getInstance().sleeping, true, 'window blur must sleep at 0fps');
  assert.equal(rafs.size, 0);
  assert.equal(timers.size, 0);

  ctl.unmount();
});

test('v1.0.7-beta.2 Task 3 (PR #23 hardening): syncHostAnimatedIcons detects React button SVG className (copy->check->copy), role, and data-tooltip-id mutations', () => {
  const uiSrc = fs.readFileSync(path.join(ROOT, 'ui-runtime.js'), 'utf8');
  // Verify live behavior by booting minimal runtime with Channel 1 ui-runtime.js in a clean VM sandbox
  const makeNode = (tag, attrsInit = {}) => {
    const attrs = new Map(Object.entries(attrsInit));
    const classes = new Set((attrsInit.class || '').split(/\s+/).filter(Boolean));
    const children = [];
    const node = {
      nodeType: 1,
      tagName: String(tag).toUpperCase(),
      parentElement: null,
      parentNode: null,
      children,
      childNodes: children,
      isConnected: true,
      hidden: false,
      style: {
        setProperty(k, v) { this[k] = v; },
        removeProperty(k) { delete this[k]; },
      },
      classList: {
        contains: (c) => classes.has(c),
        add: (...cs) => { cs.forEach((c) => c && classes.add(c)); attrs.set('class', [...classes].join(' ')); },
        remove: (...cs) => { cs.forEach((c) => classes.delete(c)); attrs.set('class', [...classes].join(' ')); },
      },
      get className() { return [...classes].join(' '); },
      set className(v) {
        classes.clear();
        String(v || '').split(/\s+/).filter(Boolean).forEach((c) => classes.add(c));
        attrs.set('class', [...classes].join(' '));
      },
      getAttribute(k) { return attrs.has(k) ? attrs.get(k) : null; },
      setAttribute(k, v) {
        const sv = String(v);
        attrs.set(k, sv);
        if (k === 'class') this.className = sv;
      },
      hasAttribute(k) { return attrs.has(k); },
      removeAttribute(k) { attrs.delete(k); if (k === 'class') classes.clear(); },
      appendChild(c) {
        if (c.parentNode) c.parentNode.removeChild(c);
        c.parentNode = node;
        c.parentElement = node;
        children.push(c);
        return c;
      },
      insertBefore(c, ref) {
        if (c.parentNode) c.parentNode.removeChild(c);
        c.parentNode = node;
        c.parentElement = node;
        const idx = ref ? children.indexOf(ref) : -1;
        if (idx >= 0) children.splice(idx, 0, c);
        else children.push(c);
        return c;
      },
      removeChild(c) {
        const i = children.indexOf(c);
        if (i >= 0) children.splice(i, 1);
        c.parentNode = null;
        c.parentElement = null;
        return c;
      },
      remove() { if (node.parentNode) node.parentNode.removeChild(node); },
      closest(sel) {
        for (const part of String(sel).split(',')) {
          const p = part.trim();
          let cur = node;
          while (cur) {
            if (p.startsWith('.') && cur.classList.contains(p.slice(1))) return cur;
            if (p.startsWith('#') && cur.getAttribute('id') === p.slice(1)) return cur;
            const am = p.match(/^\[([^=\]]+)(?:="([^"]*)")?\]$/);
            if (am && cur.hasAttribute(am[1]) && (am[2] === undefined || cur.getAttribute(am[1]) === am[2])) return cur;
            cur = cur.parentElement;
          }
        }
        return null;
      },
      matches(sel) { return node.closest(sel) === node; },
      querySelectorAll(sel) {
        const out = [];
        const walk = (n) => {
          for (const c of n.children) {
            const matched = String(sel).split(',').some((raw) => {
              const p = raw.trim();
              if (!p) return false;
              if (p === 'svg') return c.tagName === 'SVG';
              if (p === 'button') return c.tagName === 'BUTTON';
              if (p === '.ag-anim-icon') return c.classList.contains('ag-anim-icon');
              if (p === '[data-ag-cs-orig-svg]') return c.hasAttribute('data-ag-cs-orig-svg');
              if (p === '[data-ag-cs-icon-injected]') return c.hasAttribute('data-ag-cs-icon-injected');
              if (p === '[role="button"]') return c.getAttribute('role') === 'button';
              return false;
            });
            if (matched) out.push(c);
            walk(c);
          }
        };
        walk(node);
        return out;
      },
      querySelector(sel) { return node.querySelectorAll(sel)[0] || null; },
      addEventListener() {},
      removeEventListener() {},
      getBoundingClientRect: () => ({ left: 0, top: 0, width: 24, height: 24 }),
    };
    return node;
  };

  const html = makeNode('html', { 'data-ag-cs-motion': 'ultra' });
  const body = makeNode('body');
  html.appendChild(body);

  // Button 1: React-reused copy button (copy -> check -> copy via SVG class swap only!)
  const copyBtn = makeNode('button', { 'aria-label': 'Copy code' });
  const copySvg = makeNode('svg', { class: 'lucide lucide-copy', width: '16' });
  copyBtn.appendChild(copySvg);
  body.appendChild(copyBtn);

  // Button 2: Settings button whose role/tooltip changes (button -> menuitem)
  const settingsBtn = makeNode('button', { 'data-tooltip-id': 'open-settings-tip', role: 'button' });
  const settingsSvg = makeNode('svg', { class: 'icon-gear', width: '16' });
  settingsBtn.appendChild(settingsSvg);
  body.appendChild(settingsBtn);

  const doc = {
    hidden: false,
    documentElement: html,
    body,
    head: makeNode('head'),
    createElement: (t) => makeNode(t),
    createElementNS: (_ns, t) => makeNode(t),
    querySelector: (s) => html.querySelector(s),
    querySelectorAll: (s) => html.querySelectorAll(s),
    getElementById: () => null,
    addEventListener() {},
    removeEventListener() {},
  };

  let renderCount = 0;
  const sb = {
    document: doc,
    window: null,
    location: { pathname: '/' },
    navigator: { language: 'en' },
    performance: { now: () => 1000 },
    localStorage: { getItem: () => null, setItem() {}, removeItem() {} },
    getComputedStyle: () => ({ getPropertyValue: () => '', backgroundColor: 'rgb(14,16,22)' }),
    requestAnimationFrame: () => 1,
    cancelAnimationFrame() {},
    setTimeout,
    clearTimeout,
    setInterval: () => 1,
    clearInterval() {},
    MutationObserver: class { observe() {} disconnect() {} },
    ResizeObserver: class { observe() {} disconnect() {} },
    __agAnimatedIcons: {
      renderIcon(name, opts) {
        renderCount += 1;
        return `<path data-icon="${name}" data-size="${opts?.size || 15}"/>`;
      },
    },
    Map, Set, WeakMap, WeakSet, Math, Number, String, Boolean, Array, Object, Date, JSON, RegExp, Promise,
  };
  sb.window = sb;
  sb.globalThis = sb;

  vm.runInNewContext(uiSrc, sb);
  assert.equal(typeof sb.__agCsUiMain, 'function', 'ui-runtime must expose __agCsUiMain factory');
  sb.__agCsUiMain({ motionLevel: 'ultra' });
  const runtimeApi = sb.__agPrism || sb.window.__agPrism;
  assert.ok(runtimeApi && typeof runtimeApi.sync === 'function', 'ui-runtime must expose __agPrism.sync()');

  try {
    // Pass 1: copySvg has lucide-copy -> injects copy-check; settingsBtn has open-settings-tip -> injects settings-gear
    runtimeApi.sync();
    assert.equal(copyBtn.getAttribute('data-ag-cs-icon-injected'), 'copy-check', 'copy button must receive animated copy-check icon');
    assert.equal(settingsBtn.getAttribute('data-ag-cs-icon-injected'), 'settings-gear', 'settings button must receive animated settings-gear via data-tooltip-id');
    const rendersAfterPass1 = renderCount;

    // Pass 2: unchanged -> WeakMap cache hit, zero redundant renders
    runtimeApi.sync();
    assert.equal(renderCount, rendersAfterPass1, 'unchanged buttons must hit iconSigMap cache');

    // Pass 3: React reuses copyBtn and swaps <svg> className to lucide-check (copy -> check)
    copySvg.setAttribute('class', 'lucide lucide-check');
    runtimeApi.sync();
    assert.equal(copyBtn.getAttribute('data-ag-cs-icon-injected'), null, 'copy->check SVG class swap must invalidate iconSigMap and restore native check icon');
    assert.equal(copyBtn.querySelector('.ag-anim-icon'), null, 'animated copy icon must be removed when React shows check state');

    // Pass 4: React flips back lucide-check -> lucide-copy (check -> copy)
    copySvg.setAttribute('class', 'lucide lucide-copy');
    runtimeApi.sync();
    assert.equal(copyBtn.getAttribute('data-ag-cs-icon-injected'), 'copy-check', 'check->copy SVG class swap must invalidate iconSigMap and re-inject animated icon');
    assert.ok(copyBtn.querySelector('.ag-anim-icon'), 'animated copy icon must re-mount on check->copy transition');

    // Pass 5: settingsBtn role flips button -> menuitem -> must invalidate iconSigMap and restore
    settingsBtn.setAttribute('role', 'menuitem');
    runtimeApi.sync();
    assert.equal(settingsBtn.getAttribute('data-ag-cs-icon-injected'), null, 'role change to menuitem must invalidate iconSigMap and restore');

    // Pass 6: settingsBtn restores role=button, then clears data-tooltip-id -> must invalidate iconSigMap
    settingsBtn.setAttribute('role', 'button');
    runtimeApi.sync();
    assert.equal(settingsBtn.getAttribute('data-ag-cs-icon-injected'), 'settings-gear');
    settingsBtn.removeAttribute('data-tooltip-id');
    runtimeApi.sync();
    assert.equal(settingsBtn.getAttribute('data-ag-cs-icon-injected'), null, 'data-tooltip-id removal must invalidate iconSigMap');

    // Pass 7 (#193 P1-1): Inline SVG without lucide-* class replaced wholesale by React ->
    // iconSigMap must invalidate on origSvg ref / missing data-ag-cs-orig-svg so new <svg> never sits beside .ag-anim-icon!
    const inlineCopyBtn = makeNode('button', { 'aria-label': 'Copy' });
    const inlineSvg1 = makeNode('svg', { width: '16' });
    inlineCopyBtn.appendChild(inlineSvg1);
    body.appendChild(inlineCopyBtn);
    runtimeApi.sync();
    assert.equal(inlineCopyBtn.getAttribute('data-ag-cs-icon-injected'), 'copy-check');
    assert.equal(inlineSvg1.getAttribute('data-ag-cs-orig-svg'), '1');
    assert.equal(inlineCopyBtn.querySelectorAll('.ag-anim-icon').length, 1);

    // React unmounts inlineSvg1 and inserts a brand-new visible inlineSvg2 (still no class!)
    inlineSvg1.remove();
    const inlineSvg2 = makeNode('svg', { width: '16' });
    inlineCopyBtn.appendChild(inlineSvg2);
    runtimeApi.sync();
    assert.equal(inlineSvg2.getAttribute('data-ag-cs-orig-svg'), '1', 'replacement <svg> must be hidden with data-ag-cs-orig-svg="1"');
    assert.equal(inlineSvg2.hidden, true, 'replacement <svg> must be hidden so dual icons never render side by side');
    assert.equal(inlineCopyBtn.querySelectorAll('.ag-anim-icon').length, 1, 'must keep strictly 1 .ag-anim-icon after SVG replacement');

    // Pass 8 (#193 P1-1): Container migration (parentElement change into [role="dialog"] and back) invalidates iconSigMap
    const dlg = makeNode('div', { role: 'dialog' });
    body.appendChild(dlg);
    dlg.appendChild(inlineCopyBtn);
    runtimeApi.sync();
    assert.equal(inlineCopyBtn.getAttribute('data-ag-cs-icon-injected'), null, 'moving button into [role="dialog"] must invalidate iconSigMap and restore native icon');
    assert.equal(inlineCopyBtn.querySelectorAll('.ag-anim-icon').length, 0);
    assert.equal(inlineSvg2.hidden, false);
    body.appendChild(inlineCopyBtn);
    runtimeApi.sync();
    assert.equal(inlineCopyBtn.getAttribute('data-ag-cs-icon-injected'), 'copy-check', 'moving button back out of [role="dialog"] must re-inject animated icon');
    assert.equal(inlineCopyBtn.querySelectorAll('.ag-anim-icon').length, 1);

    // Pass 9 (#193 P1-1): Deferred queue (>20 buttons) concurrent sync + duplicate replay stays idempotent (strictly 1 .ag-anim-icon)
    let deferredBatch = [];
    let capturedApply = null;
    const sb2 = {
      document: null,
      window: null,
      location: { pathname: '/' },
      navigator: { language: 'en' },
      performance: { now: () => 1000 },
      localStorage: { getItem: () => null, setItem() {}, removeItem() {} },
      getComputedStyle: () => ({ getPropertyValue: () => '', backgroundColor: 'rgb(14,16,22)' }),
      requestAnimationFrame: () => 1,
      cancelAnimationFrame() {},
      setTimeout,
      clearTimeout,
      setInterval: () => 1,
      clearInterval() {},
      MutationObserver: class { observe() {} disconnect() {} },
      ResizeObserver: class { observe() {} disconnect() {} },
      __agAnimatedIcons: sb.__agAnimatedIcons,
      Map, Set, WeakMap, WeakSet, Math, Number, String, Boolean, Array, Object, Date, JSON, RegExp, Promise,
      __agPrismStreamChoreography: {
        createStreamChoreographyController(deps) {
          capturedApply = deps.applySingleHostIcon;
          const base = {
            heroState: {},
            isEntryMotionSuppressed: () => false,
            measureVisibleChangedHeaders: () => [],
            measureNewLensOverlays: () => [],
            enqueueDeferredIcons(items) { deferredBatch.push(...items); },
          };
          return new Proxy(base, { get: (t, k) => (k in t ? t[k] : () => null) });
        },
      },
    };
    sb2.window = sb2;
    sb2.globalThis = sb2;
    const html2 = makeNode('html', { 'data-ag-cs-motion': 'ultra' });
    const body2 = makeNode('body');
    html2.appendChild(body2);
    const bulkBtns = [];
    for (let i = 0; i < 24; i++) {
      const b = makeNode('button', { 'aria-label': 'Copy' });
      b.appendChild(makeNode('svg', { class: 'lucide lucide-copy', width: '16' }));
      body2.appendChild(b);
      bulkBtns.push(b);
    }
    sb2.document = { ...doc, documentElement: html2, body: body2, head: makeNode('head'), querySelector: (s) => html2.querySelector(s), querySelectorAll: (s) => html2.querySelectorAll(s) };
    vm.runInNewContext(uiSrc, sb2);
    sb2.__agCsUiMain({ motionLevel: 'ultra' });
    const rt2 = sb2.__agPrism;
    try {
      // Initial boot already ran sync(): 16 applied synchronously, 8 deferred (not yet injected)
      assert.equal(deferredBatch.length, 8, '24 buttons must synchronously apply 16 and defer 8');
      assert.equal(bulkBtns.filter((b) => b.getAttribute('data-ag-cs-icon-injected') === 'copy-check').length, 16);
      // Before deferred queue drains, another sync() runs: because eqSig was NOT written prematurely,
      // the remaining 8 unmounted buttons are scanned and applied synchronously (<= 20)
      rt2.sync();
      assert.equal(bulkBtns.filter((b) => b.getAttribute('data-ag-cs-icon-injected') === 'copy-check').length, 24);
      // Now the stale deferred queue fires and replays applySingleHostIcon on those same 8 buttons ->
      // applySingleHostIcon idempotency guard must prevent duplicate .ag-anim-icon!
      for (const it of deferredBatch) capturedApply(it.btn, it.iconName, it.origSvg, it.size);
      for (const b of bulkBtns) {
        assert.equal(b.getAttribute('data-ag-cs-icon-injected'), 'copy-check');
        assert.equal(b.querySelectorAll('.ag-anim-icon').length, 1, 'applySingleHostIcon idempotency guard must prevent duplicate .ag-anim-icon');
      }
      // Subsequent sync hits post-mount eqSig cache with 0 new renders
      deferredBatch = [];
      const rendersBeforeCached = renderCount;
      rt2.sync();
      assert.equal(deferredBatch.length, 0);
      assert.equal(renderCount, rendersBeforeCached, 'post-mount eqSig must hit iconSigMap cache with 0 re-renders');
    } finally {
      rt2.destroy?.();
    }
  } finally {
    runtimeApi.destroy?.();
  }
});

test('v1.0.7-beta.2 Task 6 (/btw context menu capture phase): beats host #root stopPropagation, preserves Shift passthrough, yields to diff badges & non-selection inline-diff-box, honors ag-prism:ctx-open mutex and try/catch', () => {
  const docCap = [];
  const docBub = [];
  const winListeners = new Map();
  let selection = { text: '', isCollapsed: true, anchorNode: null };
  let diffCloseCalls = 0;

  const makeEl = (tag, attrsInit = {}) => {
    const attrs = new Map(Object.entries(attrsInit));
    const classes = new Set((attrsInit.class || '').split(/\s+/).filter(Boolean));
    const children = [];
    const el = {
      nodeType: 1,
      tagName: String(tag).toUpperCase(),
      parentElement: null,
      parentNode: null,
      children,
      childNodes: children,
      isConnected: true,
      style: {},
      classList: {
        contains: (c) => classes.has(c),
        add: (...cs) => { cs.forEach((c) => c && classes.add(c)); attrs.set('class', [...classes].join(' ')); },
      },
      get className() { return [...classes].join(' '); },
      set className(v) {
        classes.clear();
        String(v || '').split(/\s+/).filter(Boolean).forEach((c) => classes.add(c));
        attrs.set('class', [...classes].join(' '));
      },
      getAttribute(k) { return attrs.has(k) ? attrs.get(k) : null; },
      setAttribute(k, v) { attrs.set(k, String(v)); if (k === 'class') this.className = v; },
      hasAttribute(k) { return attrs.has(k); },
      removeAttribute(k) { attrs.delete(k); },
      appendChild(c) { c.parentElement = el; c.parentNode = el; children.push(c); return c; },
      removeChild(c) { const i = children.indexOf(c); if (i >= 0) children.splice(i, 1); c.parentElement = c.parentNode = null; return c; },
      remove() { if (el.parentNode) el.parentNode.removeChild(el); el.isConnected = false; },
      contains(t) { let cur = t; while (cur) { if (cur === el) return true; cur = cur.parentElement; } return false; },
      closest(sel) {
        for (const raw of String(sel).split(',')) {
          const p = raw.trim();
          if (!p) continue;
          let cur = el;
          while (cur) {
            let ok = true;
            if (p.startsWith('.')) ok = cur.classList.contains(p.slice(1));
            else if (p.startsWith('#')) ok = cur.getAttribute('id') === p.slice(1);
            else if (p.startsWith('[')) {
              const m = p.match(/^\[([^=\]]+)(?:="([^"]*)")?\]$/);
              ok = Boolean(m && cur.hasAttribute(m[1]) && (m[2] === undefined || cur.getAttribute(m[1]) === m[2]));
            } else {
              ok = cur.tagName.toLowerCase() === p.toLowerCase();
            }
            if (ok) return cur;
            cur = cur.parentElement;
          }
        }
        return null;
      },
      querySelectorAll(sel) {
        const out = [];
        const walk = (n) => {
          for (const c of n.children) {
            if (c.closest(sel) === c) out.push(c);
            walk(c);
          }
        };
        walk(el);
        return out;
      },
      querySelector(sel) { return el.querySelectorAll(sel)[0] || null; },
      addEventListener() {},
      removeEventListener() {},
      getBoundingClientRect: () => ({ left: 0, top: 0, width: 220, height: 260 }),
    };
    return el;
  };

  const html = makeEl('html', { 'data-ag-cs-lang': 'ar' });
  const body = makeEl('body');
  const root = makeEl('div', { id: 'root' });
  const conv = makeEl('div', { 'data-testid': 'conversation-view' });
  const para = makeEl('p');
  const diffBadge = makeEl('span', { 'data-testid': 'diff-line-count' });
  const diffChip = makeEl('span', { 'data-ag-diff-chip': '1' });
  const diffChipInner = makeEl('span');
  diffChip.appendChild(diffChipInner);
  const diffBox = makeEl('div', { class: 'ag-cs-inline-diff-box' });
  const diffLine = makeEl('span', { class: 'ag-cs-inline-diff-code' });
  diffBox.appendChild(diffLine);

  conv.appendChild(para);
  conv.appendChild(diffBadge);
  conv.appendChild(diffChip);
  conv.appendChild(diffBox);
  root.appendChild(conv);
  body.appendChild(root);
  html.appendChild(body);

  const ctxOpenEvents = [];
  const win = {
    innerWidth: 1280,
    innerHeight: 800,
    location: { pathname: '/c/beta2-conv' },
    navigator: { language: 'en' },
    __agPrismInlineDiff: { closeMenuIfOpen() { diffCloseCalls += 1; } },
    getSelection: () => ({ isCollapsed: selection.isCollapsed, anchorNode: selection.anchorNode, toString: () => selection.text }),
    addEventListener(type, fn) {
      if (!winListeners.has(type)) winListeners.set(type, []);
      winListeners.get(type).push(fn);
    },
    removeEventListener(type, fn) {
      const a = winListeners.get(type);
      if (a) { const i = a.indexOf(fn); if (i >= 0) a.splice(i, 1); }
    },
    dispatchEvent(ev) {
      if (ev?.type === 'ag-prism:ctx-open') ctxOpenEvents.push(ev.detail);
      for (const fn of [...(winListeners.get(ev.type) || [])]) fn(ev);
      return true;
    },
    setTimeout,
    clearTimeout,
  };

  const doc = {
    documentElement: html,
    body,
    createElement: (t) => makeEl(t),
    createElementNS: (_ns, t) => makeEl(t),
    querySelector: (s) => html.querySelector(s),
    querySelectorAll: (s) => html.querySelectorAll(s),
    getSelection: win.getSelection,
    addEventListener(type, fn, cap) {
      if (type !== 'contextmenu') return;
      (cap ? docCap : docBub).push(fn);
    },
    removeEventListener(type, fn, cap) {
      if (type !== 'contextmenu') return;
      const arr = cap ? docCap : docBub;
      const i = arr.indexOf(fn);
      if (i >= 0) arr.splice(i, 1);
    },
  };

  // True DOM 3-phase dispatcher simulating Antigravity #root React ContextMenu calling stopPropagation()
  let hostRootSwallowed = 0;
  function dispatchRealContextMenu(target, extra = {}) {
    const ev = {
      type: 'contextmenu',
      target,
      clientX: extra.clientX ?? 200,
      clientY: extra.clientY ?? 200,
      shiftKey: Boolean(extra.shiftKey),
      defaultPrevented: false,
      stopped: false,
      preventDefault() { this.defaultPrevented = true; },
      stopPropagation() { this.stopped = true; },
    };
    // Phase 1: document capture
    for (const fn of [...docCap]) fn(ev);
    if (ev.stopped) return ev;
    // Phase 2: host #root React ContextMenu swallows event before document bubble!
    hostRootSwallowed += 1;
    ev.stopPropagation();
    if (ev.stopped) return ev;
    // Phase 3: document bubble (never reached when host #root stops propagation)
    for (const fn of [...docBub]) fn(ev);
    return ev;
  }

  const ctl = ctxMenuMod.createContextMenuController({ doc, win, nav: win.navigator, loc: win.location, stepDelayMs: 0 });
  try {
    // 1) Must bind on capture phase (true), NOT bubble phase (false)
    assert.equal(docCap.length, 1, 'context-menu-btw must attach contextmenu listener in capture phase');
    assert.equal(docBub.length, 0, 'context-menu-btw must NOT attach contextmenu listener in bubble phase');

    // 2) Normal right-click in conversation beats host #root stopPropagation() and opens 4-item plain menu
    const plainEv = dispatchRealContextMenu(para);
    assert.equal(plainEv.defaultPrevented, true);
    assert.equal(plainEv.stopped, true);
    assert.equal(hostRootSwallowed, 0, 'capture-phase handler must intercept BEFORE host #root swallows event');
    assert.equal(ctl.isOpen(), true);
    assert.deepEqual(ctl.getState().actions, ['btw', 'compact', 'learn', 'grill-me']);

    // 3) Selection right-click opens full 6-item menu (copy + /btw + /plan + /compact + /learn + /grill-me)
    selection = { text: 'selected snippet', isCollapsed: false, anchorNode: para };
    const selEv = dispatchRealContextMenu(para);
    assert.equal(selEv.defaultPrevented, true);
    assert.deepEqual(ctl.getState().actions, ['copy', 'btw', 'plan', 'compact', 'learn', 'grill-me']);
    ctl.close();

    // 4) Shift + Right-click passes through untouched to host/native menu
    const shiftEv = dispatchRealContextMenu(para, { shiftKey: true });
    assert.equal(shiftEv.defaultPrevented, false, 'Shift+Right-click must pass through');
    assert.equal(ctl.isOpen(), false);

    // 5) Diff badge & diff chip excluded -> never steal inline-diff-client.js menu
    for (const diffTarget of [diffBadge, diffChipInner]) {
      const ev = dispatchRealContextMenu(diffTarget);
      assert.equal(ev.defaultPrevented, false, 'diff badge/chip must be excluded so inline-diff-client owns it');
      assert.equal(ctl.isOpen(), false);
    }

    // 6) .ag-cs-inline-diff-box WITHOUT selection yields to inline-diff-client.js
    selection = { text: '', isCollapsed: true, anchorNode: null };
    const diffBoxNoSel = dispatchRealContextMenu(diffLine);
    assert.equal(diffBoxNoSel.defaultPrevented, false, 'non-selection right-click inside .ag-cs-inline-diff-box must yield to inline-diff-client.js');
    assert.equal(ctl.isOpen(), false);

    // 7) .ag-cs-inline-diff-box WITH selection opens /btw selection menu & closes diff menu via mutex protocol
    selection = { text: 'const x = 1;', isCollapsed: false, anchorNode: diffLine };
    const closeBefore = diffCloseCalls;
    const busBefore = ctxOpenEvents.length;
    const diffBoxWithSel = dispatchRealContextMenu(diffLine);
    assert.equal(diffBoxWithSel.defaultPrevented, true, 'selection right-click inside .ag-cs-inline-diff-box must open /btw menu');
    assert.equal(ctl.isOpen(), true);
    assert.deepEqual(ctl.getState().actions, ['copy', 'btw', 'plan', 'compact', 'learn', 'grill-me']);
    assert.equal(diffCloseCalls, closeBefore + 1, 'opening /btw menu must call __agPrismInlineDiff.closeMenuIfOpen()');
    assert.equal(ctxOpenEvents.length, busBefore + 1);
    assert.deepEqual(ctxOpenEvents[ctxOpenEvents.length - 1], { source: 'btw' });

    // 8) Incoming ag-prism:ctx-open from inline-diff closes open /btw menu
    win.dispatchEvent({ type: 'ag-prism:ctx-open', detail: { source: 'inline-diff' } });
    assert.equal(ctl.isOpen(), false, 'ag-prism:ctx-open from inline-diff must close /btw menu');

    // 8b (#193 P1-4): Native media elements & host selection pill inside conversation must pass through untouched
    for (const mediaNode of [
      makeEl('img'),
      makeEl('video'),
      makeEl('audio'),
      makeEl('canvas'),
      makeEl('iframe'),
      makeEl('div', { class: 'agy-selection-pill' }),
    ]) {
      conv.appendChild(mediaNode);
      const mev = dispatchRealContextMenu(mediaNode);
      assert.equal(mev.defaultPrevented, false, `capture-phase handler must let native menu pass through on ${mediaNode.tagName}/${mediaNode.className}`);
      assert.equal(ctl.isOpen(), false);
    }

    // 9) Hostile throwing target is safely caught by try/catch without propagating
    const hostileTarget = { nodeType: 1, tagName: 'DIV', closest() { throw new Error('boom'); } };
    assert.doesNotThrow(() => dispatchRealContextMenu(hostileTarget));
    assert.equal(ctl.isOpen(), false);
  } finally {
    ctl.destroy();
    assert.equal(docCap.length, 0, 'destroy() must remove capture-phase contextmenu listener');
  }
});

test('v1.0.7-beta.2 Task 7 (Issue #18 Layer A): vendor/host-i18n/ar.json covers all 6 builtin Swarm host strings, preserves Swarm, and restores losslessly', () => {
  const dict = JSON.parse(fs.readFileSync(path.join(ROOT, 'vendor', 'host-i18n', 'ar.json'), 'utf8'));
  const expectedKeys = [
    'Unlock the power of agent swarms.',
    "Live view of the native swarm board, roster and @mention graph for the current conversation's swarm.",
    "(Preview & Quota Heavy) Run a swarm: several agents working in parallel on one task, each in its own conversation, collaborating through a shared message board. Use when the work splits into pieces that can be done at the same time, or when a second pair of eyes should check the first pair's work.",
    "What the coordinator writes so the Swarm UI's Overview can show the swarm's goal, its groups of work and a screenshot timeline. Load it before you brief and add the first workers to a swarm.",
    'ONLY for the native-swarm worker whose brief says it is the monitor. On a timer, it checks whether the whole swarm has stalled and calls on the one member who can unstick it. Coordinators and other workers: do not load this.',
    "ONLY for the native-swarm worker whose brief says it is the narrator. It watches the board and keeps the facts behind the user's Overview (view.json) current. Coordinators and other workers: do not load this.",
  ];
  for (const key of expectedKeys) {
    const val = dict.exact[key];
    assert.equal(typeof val, 'string', `Missing Swarm host-i18n key: ${key}`);
    assert.ok(val.includes('Swarm'), `Translation must preserve "Swarm": ${val}`);
    assert.ok(/[\u0600-\u06FF]/.test(val), `Translation must contain Arabic text: ${val}`);
  }
  assert.ok(typeof i18nRuntime.createHostI18nEngine === 'function');
  const eng = i18nRuntime.createHostI18nEngine(dict);
  for (const key of expectedKeys) {
    assert.equal(eng.translate(key), dict.exact[key], `Host i18n engine must translate "${key}"`);
  }
});

test('v1.0.7-beta.2 #192 [P2-3]: settings-panel.js remount & inject.js fallback remove expression both purge prism-thought-general-config companion card', () => {
  const settingsSrc = fs.readFileSync(path.join(ROOT, 'settings-panel.js'), 'utf8');
  const injectSrc = fs.readFileSync(path.join(ROOT, 'inject.js'), 'utf8');
  assert.ok(
    settingsSrc.includes('[data-testid="prism-thought-ai-config"],[data-testid="prism-thought-general-config"]'),
    'settings-panel.js mountThoughtUiIfReady must clean stale prism-thought-general-config alongside prism-thought-ai-config'
  );
  const fbMatch = injectSrc.match(/const FALLBACK_THOUGHT_REMOVE_EXPRESSION\s*=\s*("(?:\\.|[^"\\])*");/);
  assert.ok(fbMatch, 'inject.js must define FALLBACK_THOUGHT_REMOVE_EXPRESSION');
  const fbExpr = JSON.parse(fbMatch[1]);
  assert.ok(
    fbExpr.includes('prism-thought-general-config'),
    'inject.js FALLBACK_THOUGHT_REMOVE_EXPRESSION must clean prism-thought-general-config'
  );
  const removed = [];
  const res = vm.runInNewContext(fbExpr, {
    window: { __agPrismThought: { destroy() {} } },
    globalThis: {},
    document: {
      querySelectorAll(sel) {
        assert.ok(sel.includes('prism-thought-ai-config') && sel.includes('prism-thought-general-config'));
        return [{ remove: () => removed.push('ai') }, { remove: () => removed.push('general') }];
      },
    },
  });
  assert.deepEqual(removed, ['ai', 'general']);
  assert.equal(res.ok, true);
});

test('v1.0.7-beta.2 CSS hygiene & Channel 1 payload budget gate', () => {
  const css = fs.readFileSync(path.join(ROOT, 'style.css'), 'utf8');
  assert.equal(css.includes(':has('), false, 'style.css must have 0 :has()');
  assert.equal(/[^\x00-\x7F]/.test(css), false, 'style.css must have 0 non-ASCII');
  assert.equal(checkBalancedBraces(css), true, 'style.css braces must be strictly balanced');
  assert.equal(css.includes('\r\n'), false, 'style.css must be pure LF');
  assert.equal(css.charCodeAt(0) === 0xFEFF, false, 'style.css must be UTF-8 without BOM');

  const defaultBytes = Buffer.byteLength(cdp.buildInjectExpression(cdp.DEFAULT_CONFIG), 'utf8');
  const emptyBytes = Buffer.byteLength(cdp.buildInjectExpression({}), 'utf8');
  assert.ok(defaultBytes <= 686080, `Channel 1 DEFAULT_CONFIG must stay <= 686,080 B (got ${defaultBytes} B)`);
  assert.ok(emptyBytes < 685000, `Channel 1 {} must stay < 685,000 B (got ${emptyBytes} B)`);
});
