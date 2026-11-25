import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const ROOT = path.resolve(import.meta.dirname, '..');

function makeFakeTimers(startNow = 1000) {
  let now = startNow;
  let seq = 1;
  const timers = new Map();
  const rafs = new Map();
  return {
    get now() { return now; },
    set now(v) { now = v; },
    timers,
    rafs,
    performance: { now: () => now },
    setTimeout(fn, ms = 0) {
      const id = seq++;
      timers.set(id, { fn, ms: Number(ms) || 0, due: now + Math.max(0, Number(ms) || 0) });
      return id;
    },
    clearTimeout(id) { timers.delete(id); },
    requestAnimationFrame(fn) {
      const id = seq++;
      rafs.set(id, fn);
      return id;
    },
    cancelAnimationFrame(id) { rafs.delete(id); },
    flushRafs(stepMs = 16) {
      now += stepMs;
      const entries = [...rafs.entries()];
      rafs.clear();
      for (const [, fn] of entries) fn(now);
      return entries.length;
    },
    advanceTimers(deltaMs) {
      const target = now + deltaMs;
      while (true) {
        let next = null;
        for (const [id, t] of timers.entries()) {
          if (t.due <= target && (!next || t.due < next.t.due)) next = { id, t };
        }
        if (!next) break;
        now = next.t.due;
        timers.delete(next.id);
        next.t.fn();
      }
      now = target;
    },
  };
}

function makeMiniNode(tag, attrs = {}, rect = { left: 0, top: 0, width: 240, height: 32, right: 240, bottom: 32 }) {
  const attrMap = new Map(Object.entries(attrs).map(([k, v]) => [k, String(v)]));
  const clsSet = new Set(String(attrs.class || '').split(/\s+/).filter(Boolean));
  const styleProps = new Map();
  const node = {
    nodeType: 1,
    tagName: String(tag).toUpperCase(),
    id: attrs.id || '',
    textContent: '',
    hidden: false,
    disabled: false,
    isConnected: true,
    scrollTop: 0,
    parentElement: null,
    parentNode: null,
    children: [],
    childNodes: [],
    shadowRoot: null,
    _rect: { ...rect },
    _rectReads: 0,
    get className() { return attrMap.get('class') || ''; },
    set className(v) {
      const s = String(v || '');
      if (s) attrMap.set('class', s);
      else attrMap.delete('class');
      clsSet.clear();
      s.split(/\s+/).filter(Boolean).forEach((c) => clsSet.add(c));
    },
    attachShadow() {
      this.shadowRoot = makeMiniNode('shadow-root');
      return this.shadowRoot;
    },
    style: {
      display: '',
      width: '',
      opacity: '',
      setProperty(k, v) { styleProps.set(k, String(v)); this[k] = String(v); },
      getPropertyValue(k) { return styleProps.get(k) || ''; },
      removeProperty(k) { styleProps.delete(k); delete this[k]; },
    },
    classList: {
      add: (...cs) => cs.forEach((c) => c && clsSet.add(c)),
      remove: (...cs) => cs.forEach((c) => clsSet.delete(c)),
      contains: (c) => clsSet.has(c),
    },
    setAttribute(k, v) {
      attrMap.set(k, String(v));
      if (k === 'id') this.id = String(v);
      if (k === 'class') {
        this.className = String(v);
        clsSet.clear();
        String(v).split(/\s+/).filter(Boolean).forEach((c) => clsSet.add(c));
      }
    },
    getAttribute(k) { return attrMap.has(k) ? attrMap.get(k) : null; },
    hasAttribute(k) { return attrMap.has(k); },
    removeAttribute(k) {
      attrMap.delete(k);
      if (k === 'class') { this.className = ''; clsSet.clear(); }
    },
    appendChild(ch) {
      if (!ch) return ch;
      if (ch.parentElement && ch.parentElement !== this) ch.parentElement.removeChild(ch);
      ch.parentElement = ch.parentNode = this;
      ch.isConnected = true;
      if (!this.children.includes(ch)) this.children.push(ch);
      if (!this.childNodes.includes(ch)) this.childNodes.push(ch);
      return ch;
    },
    insertBefore(ch, ref) {
      if (!ch) return ch;
      if (ch.parentElement && ch.parentElement !== this) ch.parentElement.removeChild(ch);
      ch.parentElement = ch.parentNode = this;
      ch.isConnected = true;
      const idx = ref ? this.children.indexOf(ref) : -1;
      if (idx >= 0) this.children.splice(idx, 0, ch);
      else this.children.push(ch);
      this.childNodes.push(ch);
      return ch;
    },
    removeChild(ch) {
      const i = this.children.indexOf(ch);
      if (i >= 0) this.children.splice(i, 1);
      const j = this.childNodes.indexOf(ch);
      if (j >= 0) this.childNodes.splice(j, 1);
      ch.parentElement = ch.parentNode = null;
      ch.isConnected = false;
      return ch;
    },
    remove() {
      if (this.parentElement) this.parentElement.removeChild(this);
      else this.isConnected = false;
    },
    contains(other) {
      let cur = other;
      while (cur) {
        if (cur === this) return true;
        cur = cur.parentElement;
      }
      return false;
    },
    get firstElementChild() { return this.children[0] || null; },
    get lastElementChild() { return this.children[this.children.length - 1] || null; },
    get firstChild() { return this.children[0] || null; },
    getBoundingClientRect() {
      this._rectReads += 1;
      return { ...this._rect };
    },
    matches(selList) {
      return String(selList || '').split(',').some((raw) => {
        const s = raw.trim();
        if (!s) return false;
        const parts = s.split(/\s+/);
        if (parts.length > 1) {
          if (!this.matches(parts[parts.length - 1])) return false;
          let cur = this.parentElement;
          for (let i = parts.length - 2; i >= 0; i--) {
            while (cur && !cur.matches(parts[i])) cur = cur.parentElement;
            if (!cur) return false;
            cur = cur.parentElement;
          }
          return true;
        }
        let rem = s;
        if (rem.includes(':')) return false;
        const tagM = rem.match(/^[a-zA-Z0-9-]+/);
        if (tagM) {
          if (this.tagName.toLowerCase() !== tagM[0].toLowerCase()) return false;
          rem = rem.slice(tagM[0].length);
        }
        for (const im of rem.matchAll(/#([a-zA-Z0-9_-]+)/g)) {
          if (this.id !== im[1]) return false;
        }
        rem = rem.replace(/#[a-zA-Z0-9_-]+/g, '');
        for (const cm of rem.matchAll(/\.([a-zA-Z0-9_-]+)/g)) {
          if (!clsSet.has(cm[1])) return false;
        }
        rem = rem.replace(/\.[a-zA-Z0-9_-]+/g, '');
        for (const am of rem.matchAll(/\[([a-zA-Z0-9_-]+)(?:([\^*$|~])?="([^"]*)")?\]/g)) {
          const [, k, op, val] = am;
          if (!attrMap.has(k)) return false;
          if (val !== undefined) {
            const actual = attrMap.get(k);
            if (op === '*') { if (!actual.includes(val)) return false; }
            else if (op === '^') { if (!actual.startsWith(val)) return false; }
            else if (actual !== val) return false;
          }
        }
        rem = rem.replace(/\[[^\]]+\]/g, '').trim();
        return rem === '';
      });
    },
    closest(sel) {
      let cur = this;
      while (cur) {
        if (cur.matches?.(sel)) return cur;
        cur = cur.parentElement;
      }
      return null;
    },
    querySelectorAll(sel) {
      const out = [];
      const walk = (n) => {
        for (const c of n.children) {
          if (c.matches(sel)) out.push(c);
          walk(c);
        }
      };
      walk(this);
      return out;
    },
    querySelector(sel) { return this.querySelectorAll(sel)[0] || null; },
    addEventListener() {},
    removeEventListener() {},
  };
  return node;
}

test('P0-1 stream-choreography: running row recognition (spinner + stop button + 1-frame gap hold) & glide pill running state without blue flash', () => {
  const src = fs.readFileSync(path.join(ROOT, 'stream-choreography.js'), 'utf8');
  const env = makeFakeTimers(2000);
  const html = makeMiniNode('html', { 'data-ag-cs-sidebar': 'on', 'data-ag-cs-motion': 'standard' });
  const body = makeMiniNode('body');
  html.appendChild(body);
  const list = makeMiniNode('div', { 'data-testid': 'conversation-list-sidebar' }, { left: 0, top: 0, width: 260, height: 600 });
  body.appendChild(list);

  // Row 1: idle selected
  const rowIdle = makeMiniNode('div', {
    'data-testid': 'conversation-row-sidebar',
    'data-cascade-id': 'cid-idle',
    'data-selected': 'true',
  }, { left: 8, top: 40, width: 240, height: 32 });
  // Add non-stop buttons (Unpin / More menu / Pin) to verify zero false positives
  const unpinBtn = makeMiniNode('button', { 'aria-label': 'إلغاء التثبيت' });
  const moreBtn = makeMiniNode('button', { 'aria-label': 'More options', 'aria-haspopup': 'menu', 'data-testid': 'row-more-menu' });
  const deskBtn = makeMiniNode('button', { 'data-testid': 'desktop-row-action' });
  rowIdle.appendChild(unpinBtn);
  rowIdle.appendChild(moreBtn);
  rowIdle.appendChild(deskBtn);
  list.appendChild(rowIdle);

  // Row 2: running with status-loading-spinner
  const rowSpin = makeMiniNode('div', {
    'data-testid': 'conversation-row-sidebar',
    'data-cascade-id': 'cid-spin',
    'data-selected': 'false',
  }, { left: 8, top: 80, width: 240, height: 32 });
  const spinner = makeMiniNode('span', { 'data-testid': 'status-loading-spinner' });
  rowSpin.appendChild(spinner);
  list.appendChild(rowSpin);

  // Row 3: running with stop button (hovered/selected replacement form)
  const rowStop = makeMiniNode('div', {
    'data-testid': 'conversation-row-sidebar',
    'data-cascade-id': 'cid-stop',
    'data-selected': 'false',
  }, { left: 8, top: 120, width: 240, height: 32 });
  const stopBtn = makeMiniNode('button', { 'data-testid': 'sidebar-stop-button', 'aria-label': 'إيقاف التوليد' });
  stopBtn.appendChild(makeMiniNode('svg', { class: 'lucide-square' }));
  rowStop.appendChild(stopBtn);
  list.appendChild(rowStop);

  // Row 4: running with lucide-circle-stop icon only
  const rowCircleStop = makeMiniNode('div', {
    'data-testid': 'conversation-row-sidebar',
    'data-cascade-id': 'cid-circle-stop',
    'data-selected': 'false',
  }, { left: 8, top: 160, width: 240, height: 32 });
  const circleStopBtn = makeMiniNode('button');
  circleStopBtn.appendChild(makeMiniNode('svg', { class: 'lucide-circle-stop' }));
  rowCircleStop.appendChild(circleStopBtn);
  list.appendChild(rowCircleStop);

  const fakeDoc = {
    hidden: false,
    documentElement: html,
    body,
    createElement: (t) => makeMiniNode(t),
    querySelector: (s) => html.querySelector(s),
    querySelectorAll: (s) => html.querySelectorAll(s),
  };

  let motionStandardOrUltra = true;
  const glideCalls = [];
  const sb = {
    document: fakeDoc,
    performance: env.performance,
    setTimeout: env.setTimeout,
    clearTimeout: env.clearTimeout,
    requestAnimationFrame: env.requestAnimationFrame,
    cancelAnimationFrame: env.cancelAnimationFrame,
    Map, WeakMap, Set, WeakSet, Array, Object, Math, Number, String, Boolean, Date,
  };
  sb.window = sb;
  sb.globalThis = sb;
  vm.runInNewContext(src, sb);

  const ctl = sb.__agPrismStreamChoreography.createStreamChoreographyController({
    motionEngine: {
      glideIndicator(pill, fromRect, toRect, opts) {
        glideCalls.push({ pill, fromRect, toRect, opts });
      },
    },
    isDestroyed: () => false,
    isMotionStandardOrUltra: () => motionStandardOrUltra,
    isMotionUltra: () => false,
    isConvRunning: () => false,
    isThoughtIsolatedNode: () => false,
    isThoughtMutationRecord: () => false,
    isManagedThoughtPanel: () => false,
    setAttrIfChanged: (el, k, v) => { if (el.getAttribute(k) !== v) el.setAttribute(k, v); },
    runGuardedMut: (fn) => fn(),
  });

  // 1) Verify strict running detection & zero false positives on unpin / menu / desktop buttons
  assert.equal(ctl.isSidebarRowRunning(rowIdle), false, 'Unpin / menu / desktop buttons must NOT trigger running state');
  assert.equal(ctl.isSidebarRowRunning(rowSpin), true, 'Spinner row must be detected as running');
  assert.equal(ctl.isSidebarRowRunning(rowStop), true, 'Stop button row must be detected as running');
  assert.equal(ctl.isSidebarRowRunning(rowCircleStop), true, 'lucide-circle-stop button row must be detected as running');

  // Initial snapshot sets baseline on rowIdle
  ctl.syncSidebarSelectionGlide(ctl.measureSidebarSelectionSnapshot());
  assert.equal(rowIdle.hasAttribute('data-ag-cs-row-running'), false);
  assert.equal(rowSpin.getAttribute('data-ag-cs-row-running'), '1');
  assert.equal(rowStop.getAttribute('data-ag-cs-row-running'), '1');
  assert.equal(rowCircleStop.getAttribute('data-ag-cs-row-running'), '1');

  // 2) Switch idle -> running (spinner): glide pill MUST carry data-ag-cs-glide-running="1"
  rowIdle.setAttribute('data-selected', 'false');
  rowSpin.setAttribute('data-selected', 'true');
  ctl.syncSidebarSelectionGlide(ctl.measureSidebarSelectionSnapshot());
  const pill1 = body.querySelector('.ag-cs-sidebar-glide-pill');
  assert.ok(pill1, 'Glide pill must be created on session switch in standard motion');
  assert.equal(pill1.getAttribute('data-ag-cs-glide-running'), '1', 'Switching into spinner running row must mark pill as running (no blue cover)');
  assert.equal(pill1.hasAttribute('data-ag-cs-glide-from-running'), false);
  assert.equal(rowSpin.getAttribute('data-ag-cs-row-running'), '1');

  // 3) Simulate 1-frame empty gap: spinner removed before stop button mounts while switching into rowSpin!
  // First switch back to rowIdle (running -> idle transition should set data-ag-cs-glide-from-running="1")
  rowSpin.setAttribute('data-selected', 'false');
  rowIdle.setAttribute('data-selected', 'true');
  ctl.syncSidebarSelectionGlide(ctl.measureSidebarSelectionSnapshot());
  const pillToIdle = body.querySelector('.ag-cs-sidebar-glide-pill');
  assert.ok(pillToIdle);
  assert.equal(pillToIdle.hasAttribute('data-ag-cs-glide-running'), false);
  assert.equal(pillToIdle.getAttribute('data-ag-cs-glide-from-running'), '1', 'Running->idle switch must mark pill for smooth rainbow->blue fade');

  // Now pointerdown locks rowSpin, React removes spinner before stop button appears (1-frame gap!)
  assert.equal(ctl.lockSidebarRowRunningOnPointerDown(rowSpin), true);
  spinner.remove();
  assert.equal(ctl.isSidebarRowRunning(rowSpin), false, 'DOM temporarily has neither spinner nor stop button (1-frame gap)');
  rowIdle.setAttribute('data-selected', 'false');
  rowSpin.setAttribute('data-selected', 'true');
  env.now += 16; // 1 frame later, well inside 450ms hold window
  ctl.stampSidebarRowRunningImmediate(rowSpin);
  assert.equal(rowSpin.getAttribute('data-ag-cs-row-running'), '1', '1-frame gap must keep data-ag-cs-row-running="1"');
  ctl.syncSidebarSelectionGlide(ctl.measureSidebarSelectionSnapshot());
  const pillGap = body.querySelector('.ag-cs-sidebar-glide-pill');
  assert.ok(pillGap);
  assert.equal(pillGap.getAttribute('data-ag-cs-glide-running'), '1', '1-frame gap must still stamp glide pill as running (zero blue flash)');

  // 4) Switch to stop-button running row (no spinner, stop icon only)
  rowSpin.setAttribute('data-selected', 'false');
  rowStop.setAttribute('data-selected', 'true');
  ctl.syncSidebarSelectionGlide(ctl.measureSidebarSelectionSnapshot());
  const pillStop = body.querySelector('.ag-cs-sidebar-glide-pill');
  assert.ok(pillStop);
  assert.equal(pillStop.getAttribute('data-ag-cs-glide-running'), '1', 'Stop-button running row must stamp glide pill as running');

  // 5) Hold window expires after >450ms with no spinner/stop button -> rowSpin clears cleanly
  env.advanceTimers(600);
  assert.equal(rowSpin.hasAttribute('data-ag-cs-row-running'), false, 'Running hold must auto-expire after 450ms when task actually finished');
  assert.equal(rowStop.getAttribute('data-ag-cs-row-running'), '1', 'Still-running stop row must stay running');

  // 6) motionLevel === 'off': zero glide pill created, running row still protected against blue flash
  motionStandardOrUltra = false;
  for (const n of body.querySelectorAll('.ag-cs-sidebar-glide-pill')) n.remove();
  rowStop.setAttribute('data-selected', 'false');
  rowCircleStop.setAttribute('data-selected', 'true');
  ctl.syncSidebarSelectionGlide(ctl.measureSidebarSelectionSnapshot());
  assert.equal(body.querySelectorAll('.ag-cs-sidebar-glide-pill').length, 0, 'motion=off must spawn 0 glide pills');
  assert.equal(rowCircleStop.getAttribute('data-ag-cs-row-running'), '1', 'motion=off must still maintain running attr without blue flash');

  ctl.clearTransientTimers();
  assert.equal(env.timers.size, 0, 'clearTransientTimers must clear run hold & pill timers');
});

test('P0-2 conv-aura: continuous resize & html[data-ag-cs-resizing="1"] defer backing realloc to 120ms trailing debounce without per-frame burst redraw', () => {
  const src = fs.readFileSync(path.join(ROOT, 'conv-aura.js'), 'utf8');
  const env = makeFakeTimers(1000);
  let roCb = null;

  const html = makeMiniNode('html');
  const seat = makeMiniNode('div');
  seat.clientWidth = 800;
  seat.clientHeight = 600;
  const convView = makeMiniNode('div', { 'data-testid': 'conversation-view' });
  convView.clientWidth = 800;
  convView.clientHeight = 600;
  seat.appendChild(convView);

  const fakeDoc = {
    hidden: false,
    documentElement: html,
    hasFocus: () => true,
    createElement: (t) => {
      const n = makeMiniNode(t);
      if (t === 'canvas') { n.width = 0; n.height = 0; }
      return n;
    },
    querySelector: () => null,
    querySelectorAll: (sel) => (sel.includes('conversation-view') ? [convView] : []),
    addEventListener() {},
    removeEventListener() {},
  };

  const sb = {
    document: fakeDoc,
    devicePixelRatio: 1,
    performance: env.performance,
    requestAnimationFrame: env.requestAnimationFrame,
    cancelAnimationFrame: env.cancelAnimationFrame,
    setTimeout: env.setTimeout,
    clearTimeout: env.clearTimeout,
    ResizeObserver: class {
      constructor(cb) { roCb = cb; }
      observe() {}
      disconnect() {}
    },
    addEventListener() {},
    removeEventListener() {},
    WeakSet, Set, Map, Array, Object, Math, Number, String, Boolean,
  };
  sb.window = sb;
  sb.globalThis = sb;
  vm.runInNewContext(src, sb);

  let resizeCalls = 0;
  let drawCalls = 0;
  const lastResizeArgs = [];
  const rippleCore = {
    resolveHorizonDpr: (raw, scale) => raw * scale,
    mountBrandHorizonGlow(cv) {
      return {
        mode: 'webgl2',
        resize(w, h, dpr) {
          resizeCalls += 1;
          lastResizeArgs.push({ w, h, dpr });
          cv.width = Math.max(1, Math.round(w * dpr));
          cv.height = Math.max(1, Math.round(h * dpr));
        },
        releaseBackingStore() { cv.width = cv.height = 0; },
        invalidate() {},
        clear() {},
        draw() { drawCalls += 1; },
        drawStaticSnapshot() { drawCalls += 1; },
        dispose() {},
      };
    },
  };

  const ctl = sb.__agPrismConvAura.createConvAuraController({
    isDestroyed: () => false,
    isHomeRippleEnabled: () => true,
    isMotionStandardOrUltra: () => true,
    isDarkTheme: () => true,
    getMinFrameGapMs: () => 0,
    getAmbientIntensity: () => 1,
    getSpectrumMode: () => 'default',
    isWindowFocused: () => true,
    rippleCore,
    setAttrIfChanged: (el, k, v) => el.setAttribute(k, v),
    runGuardedMut: (fn) => fn(),
  });

  ctl.sync();
  const inst = ctl.getInstance();
  assert.ok(inst && resizeCalls === 1 && drawCalls === 1);

  // Simulate 25 frames of dragging right aux pane while html[data-ag-cs-resizing="1"] is set
  html.setAttribute('data-ag-cs-resizing', '1');
  const resizesBeforeDrag = resizeCalls;
  const drawsBeforeDrag = drawCalls;
  for (let i = 1; i <= 25; i++) {
    env.now += 16;
    roCb([{ contentRect: { width: 800 - i * 10, height: 600 } }]);
  }
  assert.equal(resizeCalls, resizesBeforeDrag, 'Must NOT reallocate WebGL2/2D buffer on every frame during resizing');
  assert.equal(drawCalls, drawsBeforeDrag, 'Must NOT force bypass-throttle redraws during resizing');
  assert.equal(inst.width, 800, 'Logical canvas buffer remains intact for CSS zero-cost stretch during drag');

  // Even if timer fires while resizing is still active, it must keep deferring
  env.advanceTimers(150);
  assert.equal(resizeCalls, resizesBeforeDrag, 'Must stay deferred while data-ag-cs-resizing="1" is still held');

  // Release resizing attribute -> trailing 120ms debounce flushes ONCE at final size (550x600)
  html.removeAttribute('data-ag-cs-resizing');
  env.advanceTimers(130);
  env.flushRafs(16);
  assert.equal(resizeCalls, resizesBeforeDrag + 1, 'Must perform exactly 1 trailing resize after drag settles');
  assert.equal(inst.width, 550);
  assert.equal(lastResizeArgs[lastResizeArgs.length - 1].w, 550);
  assert.ok(drawCalls > drawsBeforeDrag, 'Must wake and paint sharp trailing frame after resize settles');

  // Single isolated non-continuous resize (after idle gap > 180ms) applies immediately (preserves existing contracts)
  env.now += 500;
  const resizesBeforeSingle = resizeCalls;
  roCb([{ contentRect: { width: 720, height: 600 } }]);
  assert.equal(resizeCalls, resizesBeforeSingle + 1, 'Single isolated resize applies immediately');
  assert.equal(inst.width, 720);

  // Continuous burst without resizing attribute also debounces cleanly
  const resizesBeforeBurst = resizeCalls;
  for (let i = 1; i <= 10; i++) {
    env.now += 16;
    roCb([{ contentRect: { width: 720 - i * 8, height: 600 } }]);
  }
  assert.equal(resizeCalls, resizesBeforeBurst, 'Rapid continuous resize burst must debounce without per-frame realloc');
  env.advanceTimers(130);
  assert.equal(resizeCalls, resizesBeforeBurst + 1);
  assert.equal(inst.width, 640);

  // Unmount clears pending resizeTimer cleanly
  env.now += 16;
  roCb([{ contentRect: { width: 600, height: 600 } }]);
  ctl.unmount();
  assert.equal(env.timers.size, 0, 'unmount() must clear pending resizeTimer');
});

test('P0-2 prism-rim-canvas: zero querySelectorAll, zero getBoundingClientRect, and zero redraws during resizing & mascot-drag, then resumes cleanly', () => {
  const src = fs.readFileSync(path.join(ROOT, 'prism-rim-canvas.js'), 'utf8');
  const env = makeFakeTimers(5000);
  let strokeCalls = 0;
  let qsaCalls = 0;
  let rectReads = 0;
  let roCb = null;

  const makeMockCanvas = () => {
    const cv = makeMiniNode('canvas');
    cv.width = 0;
    cv.height = 0;
    cv.getContext = (type) => {
      if (type !== '2d') return null;
      return {
        globalAlpha: 1,
        lineWidth: 1,
        strokeStyle: null,
        clearRect() {},
        beginPath() {},
        roundRect() {},
        stroke() { strokeCalls += 1; },
        createRadialGradient: () => ({ addColorStop() {} }),
      };
    };
    return cv;
  };

  let curRect = { left: 100, top: 100, right: 400, bottom: 180, width: 300, height: 80 };
  const box = makeMiniNode('div', { 'data-ag-cs-prism-box': '1' }, curRect);
  box.getBoundingClientRect = () => { rectReads += 1; return { ...curRect }; };
  const html = makeMiniNode('html', { 'data-ag-cs-motion': 'standard', 'data-ag-cs-ambient': '1' });

  const fakeDoc = {
    hidden: false,
    documentElement: html,
    createElement: (t) => (t === 'canvas' ? makeMockCanvas() : makeMiniNode(t)),
    getElementById: () => null,
    querySelectorAll(sel) {
      qsaCalls += 1;
      if (sel.includes('data-ag-cs-prism-box')) return [box];
      if (sel.includes('.ag-cs-prism-rim-cv')) return box.firstElementChild ? [box.firstElementChild] : [];
      if (sel.includes('data-ag-cs-prism-cv')) return box.hasAttribute('data-ag-cs-prism-cv') ? [box] : [];
      return [];
    },
    addEventListener() {},
    removeEventListener() {},
  };

  const sb = {
    document: fakeDoc,
    devicePixelRatio: 1,
    performance: env.performance,
    requestAnimationFrame: env.requestAnimationFrame,
    cancelAnimationFrame: env.cancelAnimationFrame,
    setTimeout: env.setTimeout,
    clearTimeout: env.clearTimeout,
    getComputedStyle: () => ({ borderTopLeftRadius: '10px' }),
    ResizeObserver: class {
      constructor(cb) { roCb = cb; }
      observe() {}
      unobserve() {}
      disconnect() {}
    },
    Set, Map, Array, Math, Number, String, Boolean,
  };
  sb.window = sb;
  sb.globalThis = sb;
  vm.runInNewContext(src, sb);

  const ctl = sb.__agPrismRimCanvas.createPrismRimCanvasController({
    isDestroyed: () => false,
    isDarkTheme: () => true,
    motionReduced: () => false,
    getMinFrameGapMs: () => 0,
    getAmbientIntensity: () => 1,
    getAccentTone: () => 'follow',
    canMountRealCanvas: () => true,
    setAttrIfChanged: (el, k, v) => el.setAttribute(k, v),
    runGuardedMut: (fn) => fn(),
  });

  // Warm up with normal hover
  ctl.onPointerMove({ clientX: 200, clientY: 140 });
  env.flushRafs(20);
  assert.equal(strokeCalls, 1);

  // 1) During html[data-ag-cs-resizing="1"]: 0 qsa, 0 getBoundingClientRect, 0 strokes, 0 rAFs
  html.setAttribute('data-ag-cs-resizing', '1');
  const qsaBeforeResize = qsaCalls;
  const rectBeforeResize = rectReads;
  const strokeBeforeResize = strokeCalls;
  for (let i = 0; i < 20; i++) {
    roCb?.(); // prismBoxRo only marks dirty
    ctl.onPointerMove({ clientX: 210 + i, clientY: 145 });
  }
  env.flushRafs(20);
  assert.equal(qsaCalls, qsaBeforeResize, '0 querySelectorAll while resizing');
  assert.equal(rectReads, rectBeforeResize, '0 getBoundingClientRect while resizing');
  assert.equal(strokeCalls, strokeBeforeResize, '0 rim canvas strokes while resizing');
  assert.equal(env.rafs.size, 0, '0 rim rAFs scheduled while resizing');

  // 2) During html[data-ag-cs-mascot-drag="1"]: 0 qsa, 0 getBoundingClientRect, 0 strokes
  html.removeAttribute('data-ag-cs-resizing');
  html.setAttribute('data-ag-cs-mascot-drag', '1');
  for (let i = 0; i < 20; i++) {
    ctl.onPointerMove({ clientX: 240 + i, clientY: 150 });
  }
  env.flushRafs(20);
  assert.equal(qsaCalls, qsaBeforeResize, '0 querySelectorAll while mascot-drag');
  assert.equal(rectReads, rectBeforeResize, '0 getBoundingClientRect while mascot-drag');
  assert.equal(strokeCalls, strokeBeforeResize, '0 rim canvas strokes while mascot-drag');

  // 3) Drag ends -> automatically refreshes updated rect & repaints on next pointer move
  html.removeAttribute('data-ag-cs-mascot-drag');
  curRect = { left: 100, top: 100, right: 340, bottom: 180, width: 240, height: 80 };
  ctl.onPointerMove({ clientX: 220, clientY: 140 });
  env.flushRafs(20);
  assert.equal(strokeCalls, strokeBeforeResize + 1, 'Rim canvas must resume painting after drag ends');
  assert.equal(box.firstElementChild.width, 242, 'Rim canvas must pick up new width after drag ends');

  ctl.teardown();
});

test('P0-2 host-workbench-enhancer: iframeRo reads entry.contentRect with 0 synchronous getBoundingClientRect calls', () => {
  const enhancerMod = require(path.join(ROOT, 'host-workbench-enhancer.js'));
  let roCb = null;
  const html = makeMiniNode('html', {
    'data-ag-cs-style': '1',
    'data-ag-cs-theme': 'dark',
    'data-ag-cs-palette': 'obsidian',
  });
  const body = makeMiniNode('body');
  html.appendChild(body);
  const iframe = makeMiniNode('iframe', {
    'data-testid': 'sidecar-iframe',
    src: 'plugin://swarm--board-1234/',
  }, { left: 0, top: 0, width: 0, height: 0 });
  const msgs = [];
  iframe.contentWindow = { postMessage: (msg, origin) => msgs.push({ msg, origin }) };
  body.appendChild(iframe);

  const win = {
    innerHeight: 900,
    getComputedStyle: () => ({ getPropertyValue: (k) => (k === '--background' ? '#0B0B0E' : k === 'color-scheme' ? 'dark' : '') }),
    addEventListener() {},
    removeEventListener() {},
    ResizeObserver: class {
      constructor(cb) { roCb = cb; }
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  };
  const doc = {
    documentElement: html,
    body,
    querySelectorAll: (s) => html.querySelectorAll(s),
    querySelector: (s) => html.querySelector(s),
    createElement: (t) => makeMiniNode(t),
  };

  const ctl = enhancerMod.createHostEnhancerController({ doc, win, getLang: () => 'en' });
  ctl.sync();
  assert.equal(msgs.length, 0, 'Hidden 0x0 iframe initially skipped');
  assert.ok(roCb, 'iframeRo must be attached');

  // Reset rect read counter before simulating 30 resize frames
  iframe._rectReads = 0;
  for (let i = 0; i < 30; i++) {
    roCb([{ target: iframe, contentRect: { width: 320 + i * 4, height: 640 } }]);
  }
  assert.equal(iframe._rectReads, 0, 'iframeRo with contentRect must perform 0 synchronous getBoundingClientRect calls');
  assert.equal(msgs.length, 1, 'Iframe becoming visible via contentRect pushes theme once and deduplicates subsequent frames');

  // Collapsed 0x0 contentRect also performs 0 getBoundingClientRect calls
  roCb([{ target: iframe, contentRect: { width: 0, height: 0 } }]);
  assert.equal(iframe._rectReads, 0, 'Collapsed 0x0 contentRect must also perform 0 getBoundingClientRect calls');

  // Fallback when entry.contentRect is omitted still works safely
  iframe._rect = { left: 0, top: 0, width: 400, height: 600 };
  roCb([{ target: iframe }]);
  assert.equal(iframe._rectReads, 1, 'Fallback reads getBoundingClientRect only when contentRect is absent');

  ctl.destroy();
});

test('P0-2 pulse inline-fallback: tierRo uses entry.contentRect.width without extra getBoundingClientRect calls', () => {
  const src = fs.readFileSync(path.join(ROOT, 'vendor', 'pulse-dashboard', 'inline-fallback.js'), 'utf8');
  const env = makeFakeTimers(1000);
  let roCb = null;

  const html = makeMiniNode('html');
  const body = makeMiniNode('body');
  html.appendChild(body);
  const convView = makeMiniNode('div', { 'data-testid': 'conversation-view', 'data-cascade-id': '11111111-1111-1111-1111-111111111111' });
  const inputBox = makeMiniNode('div', { 'data-testid': 'agent-input-box' });
  const footer = makeMiniNode('div', { class: 'agy-composer-footer' }, { left: 0, top: 0, width: 700, height: 32 });
  const leftSlot = makeMiniNode('div');
  const rightSlot = makeMiniNode('div');
  footer.appendChild(leftSlot);
  footer.appendChild(rightSlot);
  inputBox.appendChild(footer);
  convView.appendChild(inputBox);
  body.appendChild(convView);

  const fakeDoc = {
    hidden: false,
    documentElement: html,
    body,
    querySelector: (s) => html.querySelector(s),
    querySelectorAll: (s) => html.querySelectorAll(s),
    createElement: (t) => makeMiniNode(t),
    createElementNS: (_ns, t) => makeMiniNode(t),
    addEventListener() {},
    removeEventListener() {},
  };

  const sb = {
    document: fakeDoc,
    location: { pathname: '/conversation/11111111-1111-1111-1111-111111111111', href: 'http://localhost/conversation/11111111-1111-1111-1111-111111111111' },
    performance: env.performance,
    requestAnimationFrame: env.requestAnimationFrame,
    cancelAnimationFrame: env.cancelAnimationFrame,
    setTimeout: env.setTimeout,
    clearTimeout: env.clearTimeout,
    setInterval: () => 1,
    clearInterval() {},
    ResizeObserver: class {
      constructor(cb) { roCb = cb; }
      observe() {}
      disconnect() {}
    },
    addEventListener() {},
    removeEventListener() {},
    Map, Set, Array, Object, Math, Number, String, Boolean, Date, Promise,
  };
  sb.window = sb;
  sb.globalThis = sb;
  vm.runInNewContext(src, sb);

  sb.__agPrismTelemetry.sync({ telemetryModule: 'on', language: 'en' });
  assert.ok(roCb, 'tierRo must be created and observing composer footer');
  assert.equal(footer.getAttribute('data-t'), '0');

  footer._rectReads = 0;
  for (const w of [600, 500, 420, 360, 310, 680]) {
    roCb([{ target: footer, contentRect: { width: w, height: 32 } }]);
    env.flushRafs(16);
  }
  assert.equal(footer._rectReads, 0, 'tierRo with contentRect.width must perform 0 getBoundingClientRect calls');
  assert.equal(footer.getAttribute('data-t'), '0');

  // Verify narrow width transitions to tier 5 and 0-width entry skips getBoundingClientRect
  roCb([{ target: footer, contentRect: { width: 300, height: 32 } }]);
  env.flushRafs(16);
  assert.equal(footer.getAttribute('data-t'), '1 2 3 4 5');
  roCb([{ target: footer, contentRect: { width: 0, height: 0 } }]);
  env.flushRafs(16);
  assert.equal(footer._rectReads, 0, '0-width contentRect must NOT fall back to getBoundingClientRect');

  // Repeated sync() on same footer with active tierRo must NOT redundantly call getBoundingClientRect
  sb.__agPrismTelemetry.sync({ telemetryModule: 'on', language: 'en' });
  assert.equal(footer._rectReads, 0, 'Repeated sync on observed footer must avoid redundant getBoundingClientRect');

  sb.__agPrismTelemetry.destroy();
});

test('P0-1 + P0-2 ui-runtime end-to-end: aux-pane-split drag sets data-ag-cs-resizing="1" with 0 runSync storms, restores after 120ms, and sidebar pointerdown locks running row', () => {
  const cdp = require(path.join(ROOT, 'cdp.js'));
  const uiMainFactory = require(path.join(ROOT, 'ui-runtime.js'));
  const i18nCore = require(path.join(ROOT, 'i18n-core.js'));
  const i18nLocales = require(path.join(ROOT, 'i18n-locales.js'));
  const env = makeFakeTimers(3000);

  const html = makeMiniNode('html');
  const head = makeMiniNode('head');
  const body = makeMiniNode('body');
  html.appendChild(head);
  html.appendChild(body);

  // Build aux-pane-split with left pane, sash handle (2nd child), right pane
  const auxSplit = makeMiniNode('div', { 'data-testid': 'aux-pane-split' });
  const auxLeft = makeMiniNode('div', { style: 'width: 600px' });
  const auxSash = makeMiniNode('div', { role: 'separator' });
  const auxRight = makeMiniNode('div', { style: 'width: 400px' });
  auxSplit.appendChild(auxLeft);
  auxSplit.appendChild(auxSash);
  auxSplit.appendChild(auxRight);
  body.appendChild(auxSplit);

  // Build sidebar with an idle row and a running row
  const sidebar = makeMiniNode('aside', { 'data-testid': 'conversation-list-sidebar' });
  const rowA = makeMiniNode('div', {
    'data-testid': 'conversation-row-sidebar',
    'data-cascade-id': 'cid-a',
    'data-selected': 'true',
  }, { left: 8, top: 40, width: 220, height: 30 });
  const rowB = makeMiniNode('div', {
    'data-testid': 'conversation-row-sidebar',
    'data-cascade-id': 'cid-b',
    'data-selected': 'false',
  }, { left: 8, top: 76, width: 220, height: 30 });
  const spinB = makeMiniNode('span', { 'data-testid': 'status-loading-spinner' });
  rowB.appendChild(spinB);
  sidebar.appendChild(rowA);
  sidebar.appendChild(rowB);
  body.appendChild(sidebar);

  // Build a prism-box to ensure pointermove during resizing does 0 rect reads
  const prismBox = makeMiniNode('div', { 'data-ag-cs-prism-box': '1' }, { left: 100, top: 500, width: 400, height: 80 });
  body.appendChild(prismBox);

  const docListeners = new Map();
  const winListeners = new Map();
  const fakeDoc = {
    hidden: false,
    documentElement: html,
    head,
    body,
    activeElement: null,
    hasFocus: () => true,
    createElement: (t) => makeMiniNode(t),
    getElementById: (id) => html.querySelector(`#${id}`),
    querySelector: (s) => html.querySelector(s),
    querySelectorAll: (s) => html.querySelectorAll(s),
    addEventListener(ev, fn) {
      if (!docListeners.has(ev)) docListeners.set(ev, new Set());
      docListeners.get(ev).add(fn);
    },
    removeEventListener(ev, fn) { docListeners.get(ev)?.delete(fn); },
  };
  const dispatchDoc = (type, ev) => {
    for (const fn of [...(docListeners.get(type) || [])]) fn(ev);
  };
  const dispatchWin = (type, ev) => {
    for (const fn of [...(winListeners.get(type) || [])]) fn(ev);
  };

  const moInstances = [];
  class FakeMO {
    constructor(cb) { this.cb = cb; this.targets = []; moInstances.push(this); }
    observe(target, opts) { this.targets.push({ target, opts }); }
    disconnect() { this.targets = []; }
    takeRecords() { return []; }
  }

  const sb = {
    window: null,
    document: fakeDoc,
    location: { pathname: '/chat', href: 'http://localhost/chat' },
    performance: env.performance,
    devicePixelRatio: 1,
    innerHeight: 900,
    innerWidth: 1400,
    localStorage: { getItem: () => null, setItem() {}, removeItem() {} },
    getComputedStyle: () => ({ borderTopLeftRadius: '10px', getPropertyValue: () => '' }),
    matchMedia: () => ({ matches: false, addEventListener() {}, removeEventListener() {} }),
    addEventListener(ev, fn) {
      if (!winListeners.has(ev)) winListeners.set(ev, new Set());
      winListeners.get(ev).add(fn);
    },
    removeEventListener(ev, fn) { winListeners.get(ev)?.delete(fn); },
    MutationObserver: FakeMO,
    requestAnimationFrame: env.requestAnimationFrame,
    cancelAnimationFrame: env.cancelAnimationFrame,
    setTimeout: env.setTimeout,
    clearTimeout: env.clearTimeout,
    setInterval: () => 1,
    clearInterval() {},
    __agCsI18nCore: i18nCore,
    __agCsLocales: i18nLocales,
    __agMotionEngine: { glideIndicator() {}, bindMicroInteractions: () => ({ unbind() {} }) },
    __agAnimatedIcons: { renderIcon: (name) => `<svg class="ag-anim-icon" data-icon="${name}"></svg>` },
    Set, WeakSet, Map, WeakMap, Array, Object, Number, Math, String, Boolean, JSON, Promise, Date,
  };
  sb.window = sb;
  sb.globalThis = sb;

  // Load real modules used by ui-runtime
  vm.runInNewContext(fs.readFileSync(path.join(ROOT, 'stream-choreography.js'), 'utf8'), sb);
  vm.runInNewContext(fs.readFileSync(path.join(ROOT, 'prism-rim-canvas.js'), 'utf8'), sb);
  vm.runInNewContext(`(${uiMainFactory.toString()})(${JSON.stringify(cdp.DEFAULT_CONFIG)})`, sb);

  const api = sb.window.__agPrism;
  assert.ok(api, 'ui-runtime must boot cleanly');
  assert.equal(auxSplit.getAttribute('data-ag-cs-aux-dual'), '1');
  assert.equal(rowB.getAttribute('data-ag-cs-row-running'), '1');

  // Find axO (observing auxSplit/auxRight) and mainObserver (observing html)
  const mainMo = moInstances.find((m) => m.targets.some((t) => t.target === html));
  const axMo = moInstances.find((m) => m.targets.some((t) => t.target === auxRight));
  assert.ok(mainMo && axMo, 'Both mainObserver and axO must be active');

  // 1) Continuous width drag on aux-pane-split child: sets data-ag-cs-resizing="1" with 0 runSync storms!
  const syncCountBeforeDrag = api.getState().perf.syncCount;
  prismBox._rectReads = 0;
  for (let i = 1; i <= 20; i++) {
    env.now += 16;
    auxRight.setAttribute('style', `width: ${400 + i * 5}px`);
    axMo.cb([{ type: 'attributes', target: auxRight, attributeName: 'style' }]);
    mainMo.cb([{ type: 'attributes', target: auxRight, attributeName: 'style' }]);
    dispatchWin('pointermove', { clientX: 200 + i, clientY: 520 });
    env.flushRafs(16);
  }
  assert.equal(html.getAttribute('data-ag-cs-resizing'), '1', 'Continuous aux-pane-split style drag must set data-ag-cs-resizing="1"');
  assert.equal(api.getState().perf.syncCount, syncCountBeforeDrag, 'Dragging width without flipping auxDual must trigger 0 runSync calls');
  assert.equal(prismBox._rectReads, 0, 'Pointer moves during resizing must trigger 0 prism-box rect reads');

  // 2) Stop dragging -> 120ms debounce clears data-ag-cs-resizing and triggers 1 clean trailing sync
  env.advanceTimers(130);
  env.flushRafs(16);
  assert.equal(html.hasAttribute('data-ag-cs-resizing'), false, 'data-ag-cs-resizing must clear after 120ms settle');
  assert.equal(api.getState().perf.syncCount, syncCountBeforeDrag + 1, 'Must run exactly 1 clean trailing sync after resize settles');

  // 3) Sash pointerdown -> sets data-ag-cs-resizing="1", pointerup -> clears after 120ms
  dispatchDoc('pointerdown', { target: auxSash, clientX: 600, clientY: 300 });
  assert.equal(html.getAttribute('data-ag-cs-resizing'), '1', 'Pointerdown on split sash must immediately set data-ag-cs-resizing="1"');
  dispatchWin('pointerup', {});
  env.advanceTimers(130);
  env.flushRafs(16);
  assert.equal(html.hasAttribute('data-ag-cs-resizing'), false, 'Pointerup must clear data-ag-cs-resizing after 120ms');

  // 4) Sidebar pointerdown on running row locks running attr across 1-frame empty gap before rAF
  dispatchDoc('pointerdown', { target: rowB, clientX: 60, clientY: 90 });
  spinB.remove(); // 1-frame empty gap: spinner gone, stop button not yet mounted
  rowA.setAttribute('data-selected', 'false');
  rowB.setAttribute('data-selected', 'true');
  mainMo.cb([{ type: 'attributes', target: rowB, attributeName: 'data-selected' }]);
  assert.equal(rowB.getAttribute('data-ag-cs-row-running'), '1', 'Running attr must stay locked synchronously BEFORE rAF');
  env.flushRafs(16);
  assert.equal(rowB.getAttribute('data-ag-cs-row-running'), '1', 'Running attr must stay locked AFTER rAF');
  const pill = body.querySelector('.ag-cs-sidebar-glide-pill');
  assert.ok(pill, 'Glide pill must exist after sidebar switch');
  assert.equal(pill.getAttribute('data-ag-cs-glide-running'), '1', 'Glide pill must carry running attr (no pure blue flash)');

  api.destroy();
  assert.equal(html.hasAttribute('data-ag-cs-resizing'), false);
});

test('style.css hygiene & PR #10 / P0-1 / P0-2 CSS contracts (0 :has(), 0 non-ASCII)', () => {
  const css = fs.readFileSync(path.join(ROOT, 'style.css'), 'utf8');
  assert.equal((css.match(/:has\(/g) || []).length, 0, 'style.css must have 0 :has() selectors');
  assert.equal(/[^\x00-\x7F]/.test(css), false, 'style.css must have 0 non-ASCII characters');
  assert.ok(
    css.includes('.ag-cs-sidebar-glide-pill[data-ag-cs-glide-running="1"]::after{background:var(--_rb);box-shadow:0 0 6px rgba(49,134,255,.35);}'),
    'style.css must style running glide pill accent bar with var(--_rb)'
  );
  assert.ok(
    css.includes('.ag-cs-sidebar-glide-pill[data-ag-cs-glide-running="1"]{background-image:var(--ag-cs-run-wash);}'),
    'style.css must blend running wash on running glide pill'
  );
  assert.ok(
    css.includes('html[data-ag-cs-style][data-ag-cs-resizing="1"]') && css.includes('transition:none !important;'),
    'style.css must freeze layout transitions during html[data-ag-cs-resizing="1"]'
  );
  assert.ok(
    css.includes('html[data-ag-cs-model-menu="1"] :is([data-ag-cs-model-submenu="1"],[data-testid="context-menu-submenu-popup"]){z-index:65 !important;}'),
    'style.css must elevate PR #10 model submenu & context-menu-submenu-popup to z-index:65 above overlay z-index:60'
  );
});
