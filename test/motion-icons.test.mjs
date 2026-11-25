import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, '..');

const motionEngine = require(path.join(ROOT_DIR, 'motion-engine.js'));
const animatedIcons = require(path.join(ROOT_DIR, 'animated-icons.js'));

const REQUIRED_ICONS_WITH_PARTS = [
  ['panel-left', ['.ai-part-rail']],
  ['sparkles-pen', ['.ai-part-pen', '.ai-part-spark']],
  ['search', ['.ai-part-lens']],
  ['pin', ['.ai-part-pin']],
  ['clock-history', ['.ai-part-hand']],
  ['folder-workspace', ['.ai-part-flap']],
  ['settings-gear', ['.ai-part-gear']],
  ['trash-sweep', ['.ai-part-lid', '.ai-part-bin']],
  ['copy-check', ['.ai-part-copy', '.ai-part-check']],
  ['plus-spin', ['.ai-part-plus']],
  ['arrow-up-launch', ['.ai-part-arrow']],
  ['chevron-right', ['.ai-part-chevron']],
  ['chevron-down', ['.ai-part-chevron']],
  ['more-horizontal', ['.ai-part-d1', '.ai-part-d2', '.ai-part-d3']],
  ['radar-pulse', ['.ai-part-wave', '.ai-part-core']],
  ['sliders-tune', ['.ai-part-k1', '.ai-part-k2', '.ai-part-k3']],
  ['sun-moon', ['.ai-part-celestial', '.ai-part-rays']],
  ['layers-stack', ['.ai-part-top', '.ai-part-mid', '.ai-part-bot']],
  ['zap-bolt', ['.ai-part-bolt']],
  ['alert-triangle', ['.ai-part-triangle', '.ai-part-mark']],
  ['x-close', ['.ai-part-cross']],
];

function createMockElement(tagName = 'div', attrs = {}) {
  const attrMap = new Map(Object.entries(attrs));
  const children = [];
  const listeners = new Map();
  const animateCalls = [];

  const el = {
    tagName: tagName.toUpperCase(),
    style: {},
    children,
    parentElement: null,
    animateCalls,
    setAttribute(k, v) {
      attrMap.set(k, String(v));
    },
    getAttribute(k) {
      return attrMap.has(k) ? attrMap.get(k) : null;
    },
    appendChild(child) {
      child.parentElement = el;
      children.push(child);
      return child;
    },
    contains(other) {
      let cur = other;
      while (cur) {
        if (cur === el) return true;
        cur = cur.parentElement;
      }
      return false;
    },
    matches(selector) {
      if (selector === ':focus-visible') return true;
      for (const token of selector.split(',').map((s) => s.trim())) {
        if (token === tagName.toLowerCase()) return true;
        if (token === '[data-anim-icon]' && attrMap.has('data-anim-icon')) return true;
        if (token.startsWith('.')) {
          const cls = (attrMap.get('class') || '').split(/\s+/);
          if (cls.includes(token.slice(1))) return true;
        }
      }
      return false;
    },
    closest(selector) {
      let cur = el;
      while (cur) {
        if (typeof cur.matches === 'function' && cur.matches(selector)) return cur;
        cur = cur.parentElement;
      }
      return null;
    },
    querySelectorAll(selector) {
      const out = [];
      function walk(node) {
        for (const ch of node.children) {
          if (ch.matches(selector)) out.push(ch);
          walk(ch);
        }
      }
      walk(el);
      return out;
    },
    querySelector(selector) {
      return el.querySelectorAll(selector)[0] || null;
    },
    addEventListener(type, fn) {
      if (!listeners.has(type)) listeners.set(type, new Set());
      listeners.get(type).add(fn);
    },
    removeEventListener(type, fn) {
      if (listeners.has(type)) listeners.get(type).delete(fn);
    },
    dispatch(type, eventInit = {}) {
      const set = listeners.get(type);
      if (!set) return;
      for (const fn of set) fn({ type, target: el, ...eventInit });
    },
    listenerCount(type) {
      return listeners.has(type) ? listeners.get(type).size : 0;
    },
    animate(keyframes, options) {
      let cancelled = false;
      const anim = {
        keyframes,
        options,
        get cancelled() {
          return cancelled;
        },
        finished: Promise.resolve(),
        cancel() {
          cancelled = true;
        },
        commitStyles() {},
      };
      animateCalls.push(anim);
      return anim;
    },
  };
  return el;
}

test('UMD dual export and < 35KB zero-dependency bundle size contract', () => {
  assert.equal(globalThis.__agMotionEngine, motionEngine);
  assert.equal(globalThis.__agAnimatedIcons, animatedIcons);

  const engineBytes = fs.statSync(path.join(ROOT_DIR, 'motion-engine.js')).size;
  const iconsBytes = fs.statSync(path.join(ROOT_DIR, 'animated-icons.js')).size;
  const totalBytes = engineBytes + iconsBytes;

  assert.ok(
    totalBytes < 35 * 1024,
    `Expected combined bundle < 35840 bytes, got ${totalBytes} bytes (${engineBytes} + ${iconsBytes})`
  );
});

test('springLinear second-order damped harmonic oscillator convergence (underdamped overshoot / overdamped no overshoot / exact anchors)', () => {
  const std = motionEngine.springLinear({ stiffness: 380, damping: 26, mass: 1 });
  assert.match(std.easing, /^linear\(0, .*, 1\)$/);
  assert.equal(std.samples[0], 0);
  assert.equal(std.samples[std.samples.length - 1], 1);
  assert.ok(std.durationMs >= 180 && std.durationMs <= 1200, `Unexpected durationMs: ${std.durationMs}`);
  assert.ok(Math.abs(1 - std.solveAt(std.durationMs / 1000)) <= 0.002);

  const bouncy = motionEngine.springLinear({ stiffness: 420, damping: 12, mass: 1 });
  const maxSample = Math.max(...bouncy.samples);
  assert.ok(maxSample > 1.05, `Expected underdamped overshoot > 1.05, got ${maxSample}`);
  assert.equal(bouncy.samples[bouncy.samples.length - 1], 1);

  const overdamped = motionEngine.springLinear({ stiffness: 200, damping: 90, mass: 1 });
  const maxOver = Math.max(...overdamped.samples);
  assert.ok(maxOver <= 1.0001, `Expected overdamped no overshoot, got ${maxOver}`);
});

test('spring / stagger / glideIndicator / drawStroke with prefers-reduced-motion protection', () => {
  const box = createMockElement('div');
  const h1 = motionEngine.spring(box, [{ opacity: 0 }, { opacity: 1 }], { stiffness: 400, damping: 28 });
  assert.equal(box.animateCalls.length, 1);
  assert.equal(box.animateCalls[0].cancelled, false);

  const h2 = motionEngine.spring(box, [{ opacity: 0.5 }, { opacity: 1 }], { stiffness: 400, damping: 28 });
  assert.equal(box.animateCalls.length, 2);
  assert.equal(box.animateCalls[0].cancelled, true);
  assert.ok(h1 && h2);

  const quietEl = createMockElement('div');
  motionEngine.spring(
    quietEl,
    [{ transform: 'translateY(12px)', opacity: 0 }, { transform: 'translateY(0px)', opacity: 1 }],
    { fill: 'forwards', reducedMotion: true }
  );
  assert.equal(quietEl.animateCalls.length, 0);
  assert.equal(quietEl.style.opacity, '1');

  const items = [createMockElement('li'), createMockElement('li'), createMockElement('li')];
  const group = motionEngine.stagger(items, [{ opacity: 0 }, { opacity: 1 }], { delayStep: 30 });
  assert.equal(group.length, 3);
  assert.equal(items[0].animateCalls[0].options.delay, 0);
  assert.equal(items[1].animateCalls[0].options.delay, 30);
  assert.equal(items[2].animateCalls[0].options.delay, 60);

  const pill = createMockElement('div');
  motionEngine.glideIndicator(
    pill,
    { left: 12, top: 100, width: 200, height: 32 },
    { left: 12, top: 140, width: 200, height: 32 }
  );
  assert.equal(pill.animateCalls.length, 1);
  assert.match(pill.animateCalls[0].keyframes[0].transform, /translate3d\(0\.00px, -40\.00px, 0\)/);

  const checkPath = createMockElement('path', { 'data-path-length': '22' });
  motionEngine.drawStroke(checkPath);
  assert.equal(checkPath.style.strokeDasharray, '23');
  assert.equal(checkPath.animateCalls.length, 1);
});

test('renderGoogleSparkOrbitSvg authentic 4-color soft-glow star: full light/dark chroma and zero fixed ID collisions', () => {
  const svgColor = animatedIcons.renderGoogleSparkOrbitSvg({ size: 18, tier: 'auto', monochrome: false });
  assert.match(svgColor, /^<svg\b[^>]*viewBox="0 0 24 24"[^>]*>.*<\/svg>$/);
  assert.ok(!svgColor.includes('<linearGradient'), 'Must not contain <linearGradient>');
  assert.ok(!svgColor.includes('<radialGradient'), 'Must not contain <radialGradient>');
  assert.ok(!/\bid="/i.test(svgColor), 'Must not contain any fixed id="..." attribute');
  assert.ok(!svgColor.includes('21.751'), 'Legacy boomerang arch path must be completely eliminated');

  assert.ok(svgColor.includes('#4285F4'), 'Missing Google Cobalt Blue');
  assert.ok(svgColor.includes('#EA4335'), 'Missing Google Coral Red');
  assert.ok(svgColor.includes('#FBBC04'), 'Missing Google Amber Yellow');
  assert.ok(svgColor.includes('#34A853'), 'Missing Google Emerald Green');
  assert.ok(svgColor.includes('clip-path:path('), 'Missing single-silhouette clip-path mesh blur');
  assert.ok(svgColor.includes('data-monochrome="false"'));

  const svgMono = animatedIcons.renderGoogleSparkOrbitSvg({ size: 16, monochrome: true });
  assert.ok(!svgMono.includes('#4285F4'));
  assert.ok(svgMono.includes('currentColor'));
  assert.ok(svgMono.includes('data-monochrome="true"'));

  const svgXhigh = animatedIcons.renderGoogleSparkOrbitSvg({ tier: 'xhigh' });
  assert.ok(svgXhigh.includes('ai-part-orbit-outer'));
  const dataUri = animatedIcons.renderGoogleSparkOrbitDataUri({ size: 32 });
  assert.match(dataUri, /^data:image\/svg\+xml,/);
});

test('all 21 micro-animated icons: valid SVG, 24x24 stroke spec, and .ai-part-* sub-element integrity', () => {
  assert.equal(animatedIcons.ICON_NAMES.length, 21, `Expected all 21 icons, got ${animatedIcons.ICON_NAMES.length}`);

  for (const [iconName, requiredSelectors] of REQUIRED_ICONS_WITH_PARTS) {
    const svg = animatedIcons.renderIcon(iconName, { size: 15 });
    assert.ok(svg.length > 60, `Icon "${iconName}" rendered empty or invalid SVG`);
    assert.match(svg, /^<svg\b[^>]*data-anim-icon="[^"]+"[^>]*>.*<\/svg>$/);
    assert.ok(svg.includes('viewBox="0 0 24 24"'), `${iconName} missing 24x24 viewBox`);
    assert.ok(svg.includes('stroke-width="1.8"'), `${iconName} missing stroke-width="1.8"`);
    assert.ok(svg.includes('stroke-linecap="round"'), `${iconName} missing stroke-linecap="round"`);
    assert.ok(svg.includes('stroke-linejoin="round"'), `${iconName} missing stroke-linejoin="round"`);
    assert.ok(!/\bid="/i.test(svg), `${iconName} must not contain fixed id attribute`);
    assert.ok(animatedIcons.ICON_SPECS[iconName], `${iconName} missing entry in ICON_SPECS`);

    for (const partSel of requiredSelectors) {
      const clsName = partSel.replace(/^\./, '');
      const re = new RegExp(`class="[^"]*\\b${clsName}\\b[^"]*"`);
      assert.match(svg, re, `Icon "${iconName}" missing sub-part class "${clsName}"`);
    }
  }
});

test('bindMicroInteractions idempotent event delegation and triggerIcon(copyBtn, "check") state transition', () => {
  const root = createMockElement('div');
  const b1 = motionEngine.bindMicroInteractions(root, { cooldownMs: 120 });
  const b2 = motionEngine.bindMicroInteractions(root, { cooldownMs: 120 });
  assert.equal(b1, b2, 'bindMicroInteractions must be idempotent on same root');
  assert.equal(root.listenerCount('pointerover'), 1);

  const btn = createMockElement('button');
  const svg = createMockElement('svg', { 'data-anim-icon': 'copy-check', class: 'ag-anim-icon' });
  const copyGroup = createMockElement('g', { class: 'ai-part-copy' });
  const copyFront = createMockElement('rect', { class: 'ai-part-copy-front' });
  const copyBack = createMockElement('path', { class: 'ai-part-copy-back' });
  const checkPath = createMockElement('path', { class: 'ai-part-check', 'data-path-length': '22' });
  copyGroup.appendChild(copyBack);
  copyGroup.appendChild(copyFront);
  svg.appendChild(copyGroup);
  svg.appendChild(checkPath);
  btn.appendChild(svg);
  root.appendChild(btn);

  root.dispatch('pointerover', { target: btn, relatedTarget: root });
  assert.equal(copyFront.animateCalls.length, 1);
  assert.equal(copyBack.animateCalls.length, 1);

  root.dispatch('pointerover', { target: btn, relatedTarget: root });
  assert.equal(copyFront.animateCalls.length, 1);

  const res = motionEngine.triggerIcon(btn, 'check');
  assert.equal(res.iconName, 'copy-check');
  assert.equal(svg.getAttribute('data-icon-state'), 'check');
  assert.equal(copyGroup.style.opacity, '0');
  assert.equal(checkPath.style.opacity, '1');
  assert.ok(checkPath.animateCalls.length >= 1, 'Expected stroke/scale animation on .ai-part-check');

  b1.unbind();
  assert.equal(root.listenerCount('pointerover'), 0);
});
