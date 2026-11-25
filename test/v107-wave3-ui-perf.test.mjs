import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const ROOT = path.resolve(import.meta.dirname, '..');

function checkBalancedBraces(css) {
  let depth = 0;
  let inSingle = false;
  let inDouble = false;
  let inComment = false;
  for (let i = 0; i < css.length; i += 1) {
    const ch = css[i];
    const next = css[i + 1];
    if (inComment) {
      if (ch === '*' && next === '/') {
        inComment = false;
        i += 1;
      }
      continue;
    }
    if (!inSingle && !inDouble && ch === '/' && next === '*') {
      inComment = true;
      i += 1;
      continue;
    }
    if (ch === '\\' && (inSingle || inDouble)) {
      i += 1;
      continue;
    }
    if (!inDouble && ch === "'") {
      inSingle = !inSingle;
      continue;
    }
    if (!inSingle && ch === '"') {
      inDouble = !inDouble;
      continue;
    }
    if (inSingle || inDouble) continue;
    if (ch === '{') depth += 1;
    else if (ch === '}') {
      depth -= 1;
      if (depth < 0) return { ok: false, depth };
    }
  }
  return { ok: depth === 0 && !inSingle && !inDouble && !inComment, depth };
}

function makeDomNode(tag, attrs = {}, rect = { left: 0, top: 0, width: 200, height: 32, right: 200, bottom: 32 }) {
  const attrMap = new Map(Object.entries(attrs).map(([k, v]) => [k, String(v)]));
  const clsSet = new Set(String(attrs.class || '').split(/\s+/).filter(Boolean));
  const styleProps = new Map();
  const listeners = new Map();
  let _text = '';
  const node = {
    nodeType: 1,
    tagName: String(tag).toUpperCase(),
    hidden: false,
    disabled: false,
    isConnected: true,
    dataset: {},
    ownerDocument: null,
    scrollTop: 0,
    parentElement: null,
    parentNode: null,
    children: [],
    childNodes: [],
    shadowRoot: null,
    _rect: { ...rect },
    _rectReads: 0,
    _closestQueries: [],
    _qsQueries: [],
    _getByTagCalls: [],
    _innerHtmlSets: 0,
    _listenerOpts: [],
    get id() { return attrMap.get('id') || ''; },
    set id(v) { if (v) attrMap.set('id', String(v)); else attrMap.delete('id'); },
    get className() { return attrMap.get('class') || ''; },
    set className(v) {
      const s = String(v || '');
      if (s) attrMap.set('class', s);
      else attrMap.delete('class');
      clsSet.clear();
      s.split(/\s+/).filter(Boolean).forEach((c) => clsSet.add(c));
    },
    get textContent() {
      if (this.childNodes.length === 0) return _text;
      return this.childNodes.map((c) => (c.nodeType === 3 ? c.data : c.textContent)).join('');
    },
    set textContent(v) {
      this.children = [];
      this.childNodes = [];
      _text = String(v ?? '');
    },
    get innerHTML() { return this._innerHTML || ''; },
    set innerHTML(v) {
      this._innerHtmlSets += 1;
      this._innerHTML = String(v || '');
      if (!v) {
        this.children = [];
        this.childNodes = [];
        _text = '';
      }
    },
    get firstChild() { return this.childNodes[0] || null; },
    get firstElementChild() { return this.children[0] || null; },
    get lastElementChild() { return this.children[this.children.length - 1] || null; },
    get childElementCount() { return this.children.length; },
    get nextSibling() {
      if (!this.parentElement) return null;
      const arr = this.parentElement.childNodes;
      const idx = arr.indexOf(this);
      return idx >= 0 ? arr[idx + 1] || null : null;
    },
    get nextElementSibling() {
      if (!this.parentElement) return null;
      const arr = this.parentElement.children;
      const idx = arr.indexOf(this);
      return idx >= 0 ? arr[idx + 1] || null : null;
    },
    get previousSibling() {
      if (!this.parentElement) return null;
      const arr = this.parentElement.childNodes;
      const idx = arr.indexOf(this);
      return idx > 0 ? arr[idx - 1] : null;
    },
    get previousElementSibling() {
      if (!this.parentElement) return null;
      const arr = this.parentElement.children;
      const idx = arr.indexOf(this);
      return idx > 0 ? arr[idx - 1] : null;
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
      add: (...cs) => { cs.forEach((c) => c && clsSet.add(c)); attrMap.set('class', [...clsSet].join(' ')); },
      remove: (...cs) => { cs.forEach((c) => clsSet.delete(c)); attrMap.set('class', [...clsSet].join(' ')); },
      contains: (c) => clsSet.has(c),
    },
    setAttribute(k, v) {
      attrMap.set(k, String(v));
      if (k === 'class') this.className = String(v);
    },
    getAttribute(k) { return attrMap.has(k) ? attrMap.get(k) : null; },
    hasAttribute(k) { return attrMap.has(k); },
    removeAttribute(k) {
      attrMap.delete(k);
      if (k === 'class') this.className = '';
    },
    appendChild(ch) {
      if (!ch) return ch;
      if (ch.parentElement && ch.parentElement !== this) ch.parentElement.removeChild(ch);
      ch.parentElement = ch.parentNode = this;
      const mark = (n, val) => { n.isConnected = val; for (const c of n.children || []) mark(c, val); };
      mark(ch, this.isConnected);
      if (!this.childNodes.includes(ch)) this.childNodes.push(ch);
      if (ch.nodeType === 1 && !this.children.includes(ch)) this.children.push(ch);
      return ch;
    },
    insertBefore(ch, ref) {
      if (!ref) return this.appendChild(ch);
      if (ch.parentElement && ch.parentElement !== this) ch.parentElement.removeChild(ch);
      ch.parentElement = ch.parentNode = this;
      const mark = (n, val) => { n.isConnected = val; for (const c of n.children || []) mark(c, val); };
      mark(ch, this.isConnected);
      const ci = this.childNodes.indexOf(ref);
      if (ci >= 0) this.childNodes.splice(ci, 0, ch);
      else this.childNodes.push(ch);
      if (ch.nodeType === 1) {
        const ei = this.children.indexOf(ref);
        if (ei >= 0) this.children.splice(ei, 0, ch);
        else this.children.push(ch);
      }
      return ch;
    },
    removeChild(ch) {
      const ci = this.childNodes.indexOf(ch);
      if (ci >= 0) this.childNodes.splice(ci, 1);
      const ei = this.children.indexOf(ch);
      if (ei >= 0) this.children.splice(ei, 1);
      ch.parentElement = ch.parentNode = null;
      const mark = (n) => { n.isConnected = false; for (const c of n.children || []) mark(c); };
      mark(ch);
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
    getBoundingClientRect() {
      this._rectReads += 1;
      return { ...this._rect };
    },
    getElementsByTagName(tagName) {
      const upper = String(tagName || '').toUpperCase();
      this._getByTagCalls.push(upper);
      const out = [];
      const walk = (n) => {
        for (const c of n.children) {
          if (c.tagName === upper) out.push(c);
          walk(c);
        }
      };
      walk(this);
      return out;
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
        // Handle simple :not([attr]) and :not([attr="val"]) segments
        for (const nm of rem.matchAll(/:not\(\[([a-zA-Z0-9_-]+)(?:="([^"]*)")?\]\)/g)) {
          if (nm[2] !== undefined) {
            if (attrMap.get(nm[1]) === nm[2]) return false;
          } else if (this.hasAttribute(nm[1])) {
            return false;
          }
        }
        rem = rem.replace(/:not\(\[[a-zA-Z0-9_-]+(?:="[^"]*")?\]\)/g, '');
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
      this._closestQueries.push(String(sel));
      let cur = this;
      while (cur) {
        if (cur.matches?.(sel)) return cur;
        cur = cur.parentElement;
      }
      return null;
    },
    querySelectorAll(sel) {
      this._qsQueries.push(String(sel));
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
    querySelector(sel) {
      return this.querySelectorAll(sel)[0] || null;
    },
    attachShadow() {
      this.shadowRoot = makeDomNode('shadow-root');
      return this.shadowRoot;
    },
    addEventListener(type, fn, opts) {
      if (!listeners.has(type)) listeners.set(type, new Set());
      listeners.get(type).add(fn);
      this._listenerOpts.push({ op: 'add', type, fn, opts });
    },
    removeEventListener(type, fn, opts) {
      listeners.get(type)?.delete(fn);
      this._listenerOpts.push({ op: 'remove', type, fn, opts });
    },
    dispatchEvent(ev) {
      const evt = ev || { type: 'unknown' };
      if (!evt.target) evt.target = this;
      for (const fn of [...(listeners.get(evt.type) || [])]) fn(evt);
    },
    click() {
      this.dispatchEvent({ type: 'click', target: this, preventDefault() {}, stopPropagation() {} });
    },
  };
  return node;
}

// ── 1. style.css invariants + P1-3a/P1-3b + Channel 1 size budget ──────────
test('Wave 3 CSS hygiene: 0 :has(), 0 non-ASCII, balanced braces, 0 [style*="--ag-row-i"], toast without backdrop-filter, no sidebar content-visibility, Channel 1 < 685,000 B', () => {
  const css = fs.readFileSync(path.join(ROOT, 'style.css'), 'utf8');
  assert.equal((css.match(/:has\(/g) || []).length, 0, 'style.css must have 0 :has( selectors');
  assert.equal(/[^\x00-\x7F]/.test(css), false, 'style.css must have 0 non-ASCII chars');
  assert.equal(checkBalancedBraces(css).ok, true, 'style.css braces must be strictly balanced');

  // P1-3a: remove [style*="--ag-row-i"] completely and standardize on [data-ag-row-stagger="1"]
  assert.equal(css.includes('[style*="--ag-row-i"]'), false, 'style.css must not scan inline style with [style*="--ag-row-i"]');
  assert.ok(css.includes('& [data-ag-row-stagger="1"]{animation:ag-cs-row-stagger'), 'style.css must target & [data-ag-row-stagger="1"]');
  const reduceLine = css.split('\n').find((l) => l.includes('prefers-reduced-motion:reduce') && l.includes('ag-cs-ctx-toast')) || '';
  assert.ok(reduceLine.includes('[data-ag-row-stagger="1"]'), 'prefers-reduced-motion rule must also use [data-ag-row-stagger="1"]');

  // P1-3b: .ag-cs-ctx-toast omits backdrop-filter; only .ag-cs-ctx-menu retains blur(16px)
  const sharedCtxLine = css.split('\n').find((l) => l.startsWith(':is(.ag-cs-ctx-menu,.ag-cs-ctx-toast){')) || '';
  assert.ok(sharedCtxLine.length > 0, 'Expected shared .ag-cs-ctx-menu/.ag-cs-ctx-toast base rule');
  assert.equal(sharedCtxLine.includes('backdrop-filter'), false, '.ag-cs-ctx-toast shared base rule must NOT include backdrop-filter');
  assert.ok(sharedCtxLine.includes('background:var(--ag-cs-popover-bg,var(--card))'), 'Toast must preserve high-opacity background');
  assert.ok(sharedCtxLine.includes('border:1px solid var(--ag-cs-border-2)'), 'Toast must preserve border');
  assert.ok(sharedCtxLine.includes('box-shadow:inset 0 1px 0 var(--ag-cs-specular),var(--_cx)'), 'Toast must preserve shadow');
  const menuBlockMatch = css.match(/\.ag-cs-ctx-menu\{[\s\S]*?\n\}/);
  assert.ok(menuBlockMatch && menuBlockMatch[0].includes('backdrop-filter:blur(16px) saturate(140%)'), '.ag-cs-ctx-menu retains backdrop-filter');
  const toastLine = css.split('\n').find((l) => l.startsWith('.ag-cs-ctx-toast{')) || '';
  assert.equal(toastLine.includes('backdrop-filter'), false, '.ag-cs-ctx-toast must NOT declare backdrop-filter');

  // Strict guardrail: never apply content-visibility:auto to conversation-row-sidebar
  for (const line of css.split('\n')) {
    if (line.includes('conversation-row-sidebar')) {
      assert.equal(line.includes('content-visibility'), false, 'Must never add content-visibility to conversation-row-sidebar');
    }
  }

  // Channel 1 bundle must stay < 685,000 B
  const cdp = require(path.join(ROOT, 'cdp.js'));
  const expr = cdp.buildInjectExpression(cdp.DEFAULT_CONFIG);
  const bytes = Buffer.byteLength(expr, 'utf8');
  assert.ok(bytes < 685000, `Channel 1 bundle must stay < 685,000 B, got ${bytes} B`);
});

// ── 2. ui-runtime: P1-1, P1-2a, P1-2b, P1-2c, P2-1 end-to-end verification ─
test('Wave 3 ui-runtime: P1-1 mascot power sync, P1-2a narrowed dirtyFlags, P1-2b owned fast-path & inConvStream quick check, P1-2c async enhancer sync, P2-1 passive listeners & lazy pointer rect', () => {
  const cdp = require(path.join(ROOT, 'cdp.js'));
  const uiMainFactory = require(path.join(ROOT, 'ui-runtime.js'));
  const i18nCore = require(path.join(ROOT, 'i18n-core.js'));
  const i18nLocales = require(path.join(ROOT, 'i18n-locales.js'));

  const html = makeDomNode('html');
  const head = makeDomNode('head');
  const body = makeDomNode('body', { class: 'dark' });
  html.appendChild(head);
  html.appendChild(body);

  const convView = makeDomNode('div', { 'data-testid': 'conversation-view', 'data-cascade-id': 'cid-wave3' });
  const viewport = makeDomNode('div', { 'data-testid': 'autoscroll-viewport' });
  convView.appendChild(viewport);
  const inputBox = makeDomNode('div', { 'data-testid': 'agent-input-box' });
  const card = makeDomNode('div', { class: 'surface-composer-card' });
  const modelBtn = makeDomNode(
    'button',
    { 'data-testid': 'model-selector-trigger' },
    { left: 430, top: 702, width: 180, height: 28, right: 610, bottom: 730 }
  );
  modelBtn.textContent = 'Gemini 4 Carbon High';
  card.appendChild(modelBtn);
  inputBox.appendChild(card);
  convView.appendChild(inputBox);
  body.appendChild(convView);

  const docListeners = new Map();
  const docAddRecords = [];
  const docRemoveRecords = [];
  const fakeDoc = {
    hidden: false,
    documentElement: html,
    head,
    body,
    activeElement: null,
    hasFocus: () => true,
    createElement: (t) => makeDomNode(t),
    getElementById: (id) => html.querySelector(`#${id}`),
    querySelector: (s) => html.querySelector(s),
    querySelectorAll: (s) => html.querySelectorAll(s),
    addEventListener(type, fn, opts) {
      docAddRecords.push({ type, fn, opts });
      if (!docListeners.has(type)) docListeners.set(type, new Set());
      docListeners.get(type).add(fn);
    },
    removeEventListener(type, fn, opts) {
      docRemoveRecords.push({ type, fn, opts });
      docListeners.get(type)?.delete(fn);
    },
  };

  let fakeNow = 2000;
  let seq = 1;
  const rafs = new Map();
  const timers = new Map();
  const flushRafs = () => {
    const entries = [...rafs.entries()];
    rafs.clear();
    fakeNow += 16;
    for (const [, fn] of entries) fn(fakeNow);
    return entries.length;
  };

  let mainMo = null;
  class FakeMO {
    constructor(cb) { this.cb = cb; }
    observe(target) { if (target === html) mainMo = this; }
    disconnect() {}
    takeRecords() { return []; }
  }

  // Spies for P1-1, P1-2a, P1-2c
  const powerSyncStates = [];
  let convAuraSyncCalls = 0;
  let glyphSyncCalls = 0;
  let enhancerSyncCalls = 0;
  let enhancerCalledInsideGuard = 0;
  let inGuardedMut = false;
  let measureChangedHeadersCalls = 0;
  let syncThinkingSparksCalls = 0;

  const sb = {
    window: null,
    document: fakeDoc,
    location: { pathname: '/c/cid-wave3', href: 'http://localhost/c/cid-wave3' },
    localStorage: { getItem: () => null, setItem() {}, removeItem() {} },
    performance: { now: () => fakeNow },
    navigator: { language: 'en' },
    innerWidth: 1280,
    innerHeight: 800,
    devicePixelRatio: 1,
    getComputedStyle: () => ({ getPropertyValue: () => '' }),
    matchMedia: () => ({ matches: false, addEventListener() {}, removeEventListener() {} }),
    addEventListener() {},
    removeEventListener() {},
    MutationObserver: FakeMO,
    requestAnimationFrame(cb) { const id = seq++; rafs.set(id, cb); return id; },
    cancelAnimationFrame(id) { rafs.delete(id); },
    setTimeout(cb, ms) { const id = seq++; timers.set(id, { cb, ms }); return id; },
    clearTimeout(id) { timers.delete(id); },
    setInterval: () => 1,
    clearInterval() {},
    __agCsI18nCore: i18nCore,
    __agCsLocales: i18nLocales,
    __agMotionEngine: { glideIndicator() {}, bindMicroInteractions: () => ({ unbind() {} }) },
    __agAnimatedIcons: { renderIcon: (name) => `<svg class="ag-anim-icon" data-icon="${name}"></svg>` },
    __agDualMascotRig: {
      mountDualMascotStage(stage) {
        return {
          setState() {},
          notify() {},
          syncPowerState() {
            powerSyncStates.push({ connected: stage.isConnected });
          },
          dispose() {},
        };
      },
    },
    __agPrismConvAura: {
      isConvRunning: () => false,
      createConvAuraController: () => ({
        prime() {},
        sync() { convAuraSyncCalls += 1; },
        refreshTheme() {},
        setSemanticState() {},
        triggerStart() {},
        unmount() {},
      }),
    },
    __agPrismHostEnhancer: {
      createHostEnhancerController: ({ runGuardedMut }) => ({
        sync() {
          enhancerSyncCalls += 1;
          if (inGuardedMut) enhancerCalledInsideGuard += 1;
        },
        onThemeChange() {},
        destroy() {},
        getDebugState: () => ({}),
        _runGuardedMut: runGuardedMut,
      }),
    },
    __agPrismModelGlyphCrystal: {
      createModelGlyphCrystalController: () => ({
        readButtonLabelWithoutGlyph: (b) => b?.textContent || '',
        normalizeModelEffortLabel: (s) => s,
        parseModelLabelInfo: () => ({ brand: 'gemini', tier: 'high', isOrchestrator: false, camp: 'gemini' }),
        syncModelGlyphOnButton() {
          glyphSyncCalls += 1;
          return { brand: 'gemini', tier: 'high', isOrchestrator: false, camp: 'gemini' };
        },
        syncModelSelectorPanel() {},
        teardownCrystalMount() {},
        buildBrandMarkSvg: () => '<svg></svg>',
        cloneCachedSvgElement: () => null,
      }),
    },
    Set, WeakSet, Map, WeakMap, Array, Object, Math, Number, String, Boolean, Date, RegExp, JSON, Promise, Proxy,
  };
  sb.window = sb;
  sb.globalThis = sb;

  // Load real stream-choreography and wrap its measureVisibleChangedHeaders / syncThinkingSparks to spy
  vm.runInNewContext(fs.readFileSync(path.join(ROOT, 'stream-choreography.js'), 'utf8'), sb);
  const origCreateChoreo = sb.__agPrismStreamChoreography.createStreamChoreographyController;
  sb.__agPrismStreamChoreography.createStreamChoreographyController = (opts) => {
    const origGuard = opts.runGuardedMut;
    opts.runGuardedMut = (fn) => {
      const prev = inGuardedMut;
      inGuardedMut = true;
      try { return origGuard(fn); } finally { inGuardedMut = prev; }
    };
    const ctl = origCreateChoreo(opts);
    const origMeasureHdrs = ctl.measureVisibleChangedHeaders;
    const origSyncSparks = ctl.syncThinkingSparks;
    ctl.measureVisibleChangedHeaders = (...a) => {
      measureChangedHeadersCalls += 1;
      return origMeasureHdrs(...a);
    };
    ctl.syncThinkingSparks = (...a) => {
      syncThinkingSparksCalls += 1;
      return origSyncSparks(...a);
    };
    return ctl;
  };

  // Override createElement so nodes get ownerDocument & canvas 2d context for canMountRealCanvas
  const origCreateEl = fakeDoc.createElement;
  fakeDoc.createElement = (t) => {
    const n = origCreateEl(t);
    n.ownerDocument = fakeDoc;
    if (String(t).toLowerCase() === 'canvas') n.getContext = () => ({});
    return n;
  };
  html.ownerDocument = head.ownerDocument = body.ownerDocument = convView.ownerDocument = inputBox.ownerDocument = card.ownerDocument = fakeDoc;

  vm.runInNewContext(`(${uiMainFactory.toString()})(${JSON.stringify(cdp.DEFAULT_CONFIG)})`, sb);
  const api = sb.window.__agPrism;
  assert.ok(api && mainMo, 'ui-runtime and mainObserver must boot cleanly');

  // P1-2c: Initial runSync(true) must NOT invoke hostEnhancerCtl.sync synchronously inside Phase 2!
  assert.equal(enhancerSyncCalls, 0, 'P1-2c: hostEnhancerCtl.sync must not run synchronously inside runSync Phase 2');
  assert.equal(enhancerCalledInsideGuard, 0, 'P1-2c: hostEnhancerCtl.sync must never run inside runGuardedMut');
  flushRafs();
  assert.equal(enhancerSyncCalls, 1, 'P1-2c: hostEnhancerCtl.sync must execute asynchronously on next rAF');

  // P1-2b: Mascot root carries data-ag-owned="1"
  const msRootEl = card.querySelector('.ag-cs-crab');
  assert.ok(msRootEl, 'Mascot stage must mount on primary card');
  assert.equal(msRootEl.getAttribute('data-ag-owned'), '1', 'P1-2b: msRoot must carry data-ag-owned="1"');

  // P1-1: Detaching primary card calls msRig.syncPowerState() with isConnected === false; reattaching calls it with true
  const pwrCountBefore = powerSyncStates.length;
  inputBox.remove();
  api.sync();
  assert.equal(powerSyncStates.length, pwrCountBefore + 1, 'P1-1: detaching msRoot must notify msRig.syncPowerState()');
  assert.equal(powerSyncStates[powerSyncStates.length - 1].connected, false);
  assert.equal(msRootEl.isConnected, false);

  convView.appendChild(inputBox);
  api.sync();
  assert.equal(powerSyncStates.length, pwrCountBefore + 2, 'P1-1: reattaching msRoot must notify msRig.syncPowerState()');
  assert.equal(powerSyncStates[powerSyncStates.length - 1].connected, true);
  assert.equal(msRootEl.isConnected, true);

  // Regular sync without detach/reattach does NOT spam syncPowerState()
  api.sync();
  assert.equal(powerSyncStates.length, pwrCountBefore + 2, 'P1-1: steady-state sync without reattach must not redundantly call syncPowerState()');
  flushRafs();

  // P1-2a: Streaming <pre> and worked-for-collapsible must NOT trigger syncComposers, measureVisibleChangedHeaders, or convAuraCtl.sync
  const glyphBeforePre = glyphSyncCalls;
  const auraBeforePre = convAuraSyncCalls;
  const hdrBeforePre = measureChangedHeadersCalls;
  const sparksBeforePre = syncThinkingSparksCalls;

  const streamPre = makeDomNode('pre');
  const codeLine = makeDomNode('code');
  codeLine.textContent = 'const a = 1;';
  streamPre.appendChild(codeLine);
  viewport.appendChild(streamPre);
  mainMo.cb([{ type: 'childList', target: viewport, addedNodes: [streamPre], removedNodes: [] }]);
  flushRafs();

  assert.equal(glyphSyncCalls, glyphBeforePre, 'P1-2a: streaming <pre> must NOT trigger syncComposers');
  assert.equal(auraBeforePre, convAuraSyncCalls, 'P1-2a: streaming <pre> must NOT trigger convAuraCtl.sync(true)');
  assert.equal(measureChangedHeadersCalls, hdrBeforePre, 'P1-2a: streaming <pre> must NOT trigger measureVisibleChangedHeaders');
  assert.equal(syncThinkingSparksCalls, sparksBeforePre, 'P1-2a: streaming <pre> must NOT trigger syncThinkingSparks');

  const workedBtn = makeDomNode('button', { 'data-testid': 'worked-for-collapsible', 'aria-expanded': 'false' });
  viewport.appendChild(workedBtn);
  mainMo.cb([{ type: 'childList', target: viewport, addedNodes: [workedBtn], removedNodes: [] }]);
  flushRafs();
  assert.equal(glyphSyncCalls, glyphBeforePre, 'P1-2a: worked-for-collapsible must NOT trigger syncComposers');
  assert.equal(convAuraSyncCalls, auraBeforePre, 'P1-2a: worked-for-collapsible must NOT trigger convAuraCtl.sync(true)');
  assert.equal(measureChangedHeadersCalls, hdrBeforePre, 'P1-2a: worked-for-collapsible must NOT trigger measureVisibleChangedHeaders');

  // P1-2a: thinking-collapsible-trigger triggers ONLY syncThinkingSparks (not syncComposers / changedHeaders / convAura)
  const thinkTrig = makeDomNode('button', { 'data-testid': 'thinking-collapsible-trigger' });
  thinkTrig.textContent = 'Thinking...';
  viewport.appendChild(thinkTrig);
  mainMo.cb([{ type: 'childList', target: viewport, addedNodes: [thinkTrig], removedNodes: [] }]);
  flushRafs();
  assert.equal(syncThinkingSparksCalls, sparksBeforePre + 1, 'P1-2a: thinking-collapsible-trigger must trigger syncThinkingSparks');
  assert.equal(glyphSyncCalls, glyphBeforePre, 'P1-2a: thinking-collapsible-trigger alone must NOT trigger syncComposers');
  assert.equal(measureChangedHeadersCalls, hdrBeforePre, 'P1-2a: thinking-collapsible-trigger alone must NOT trigger measureVisibleChangedHeaders');
  assert.equal(convAuraSyncCalls, auraBeforePre, 'P1-2a: thinking-collapsible-trigger alone must NOT trigger convAuraCtl.sync(true)');

  // P1-2a: changed-files-card-header triggers measureVisibleChangedHeaders without triggering syncComposers
  const cfHdr = makeDomNode('div', { 'data-testid': 'changed-files-card-header' });
  viewport.appendChild(cfHdr);
  mainMo.cb([{ type: 'childList', target: viewport, addedNodes: [cfHdr], removedNodes: [] }]);
  flushRafs();
  assert.equal(measureChangedHeadersCalls, hdrBeforePre + 1, 'P1-2a: changed-files-card-header must trigger measureVisibleChangedHeaders');
  assert.equal(glyphSyncCalls, glyphBeforePre, 'P1-2a: changed-files-card-header alone must NOT trigger syncComposers');

  // P1-2b: isOwnPluginNode fast-path hits [data-ag-owned],[data-prism-ignore] without scanning OWN_PLUGIN_SELECTOR
  const ownedChild = makeDomNode('span');
  msRootEl.appendChild(ownedChild);
  ownedChild._closestQueries.length = 0;
  mainMo.cb([{ type: 'childList', target: msRootEl, addedNodes: [ownedChild], removedNodes: [] }]);
  assert.equal(
    ownedChild._closestQueries.some((q) => q.includes('.ag-cs-home-panel-seat')),
    false,
    'P1-2b: owned plugin child must short-circuit before scanning full OWN_PLUGIN_SELECTOR'
  );
  // Also test directly on an added owned node under body
  const ownedBox = makeDomNode('div', { 'data-ag-owned': '1' });
  body.appendChild(ownedBox);
  ownedBox._closestQueries.length = 0;
  mainMo.cb([{ type: 'childList', target: body, addedNodes: [ownedBox], removedNodes: [] }]);
  assert.ok(ownedBox._closestQueries.includes('[data-ag-owned],[data-prism-ignore]'), 'P1-2b: isOwnPluginNode must hit fast owned selector');
  assert.equal(
    ownedBox._closestQueries.some((q) => q.includes('.ag-cs-home-panel-seat')),
    false,
    'P1-2b: owned node must skip full OWN_PLUGIN_SELECTOR'
  );

  // P1-2b: inConvStream non-leaf container uses getElementsByTagName instead of :not() querySelector
  const proseBlock = makeDomNode('div');
  proseBlock.appendChild(makeDomNode('p'));
  viewport.appendChild(proseBlock);
  proseBlock._qsQueries.length = 0;
  proseBlock._getByTagCalls.length = 0;
  mainMo.cb([{ type: 'childList', target: viewport, addedNodes: [proseBlock], removedNodes: [] }]);
  assert.ok(proseBlock._getByTagCalls.includes('IMG'), 'P1-2b: inConvStream must probe img via getElementsByTagName');
  assert.equal(
    proseBlock._qsQueries.some((q) => q.includes(':not([data-ag-turbo-img])')),
    false,
    'P1-2b: inConvStream must skip complex :not() selector scan'
  );

  // And if an <img> IS inside a streamed container, Host Turbo still optimizes it!
  const imgWrap = makeDomNode('div');
  const streamedImg = makeDomNode('img', { src: 'pic.png' });
  imgWrap.appendChild(streamedImg);
  viewport.appendChild(imgWrap);
  mainMo.cb([{ type: 'childList', target: viewport, addedNodes: [imgWrap], removedNodes: [] }]);
  flushRafs();
  assert.equal(streamedImg.getAttribute('decoding'), 'async', 'P1-2b: streamed <img> must still be optimized by Host Turbo');
  assert.equal(streamedImg.getAttribute('loading'), 'lazy');

  // P2-1: DOC_LISTENERS read-only events use { capture: true, passive: true }
  const passiveExpected = new Set(['scroll', 'pointerdown', 'mouseup', 'focusin', 'focusout', 'transitionend']);
  for (const evName of passiveExpected) {
    const rec = docAddRecords.find((r) => r.type === evName);
    assert.ok(rec, `P2-1: expected document listener for ${evName}`);
    assert.equal(rec.opts?.capture, true, `P2-1: ${evName} must set capture: true`);
    assert.equal(rec.opts?.passive, true, `P2-1: ${evName} must set passive: true`);
  }

  // P2-1: onDocPointerDown performs ZERO synchronous getBoundingClientRect() on normal clicks, then lazy-measures when an overlay actually opens
  const pDown = [...(docListeners.get('pointerdown') || [])][0];
  assert.ok(pDown, 'pointerdown handler must be registered');
  modelBtn._rectReads = 0;
  pDown({ target: modelBtn, clientX: 500, clientY: 710 });
  assert.equal(modelBtn._rectReads, 0, 'P2-1: onDocPointerDown must perform 0 synchronous getBoundingClientRect() calls');

  // Flush a non-overlay sync -> still 0 rect reads on modelBtn
  api.sync();
  assert.equal(modelBtn._rectReads, 0, 'P2-1: without new overlay, trigger element must remain unmeasured');

  // Now mount a new overlay -> lazy-measures modelBtn ONCE and sets --ag-origin-x / --ag-origin-y + data-ag-row-stagger="1"
  const overlay = makeDomNode(
    'div',
    { class: 'agy-overlay' },
    { left: 420, top: 440, width: 320, height: 260, right: 740, bottom: 700 }
  );
  const item0 = makeDomNode('div', { role: 'menuitem' });
  const item1 = makeDomNode('div', { role: 'menuitem' });
  overlay.appendChild(item0);
  overlay.appendChild(item1);
  body.appendChild(overlay);
  mainMo.cb([{ type: 'childList', target: body, addedNodes: [overlay], removedNodes: [] }]);
  flushRafs();
  assert.equal(modelBtn._rectReads, 1, 'P2-1: trigger button is lazy-measured exactly once when new overlay opens');
  assert.equal(overlay.style.getPropertyValue('--ag-origin-x'), '100px');
  assert.equal(overlay.style.getPropertyValue('--ag-origin-y'), '276px');
  assert.equal(item0.style.getPropertyValue('--ag-row-i'), '0');
  assert.equal(item0.getAttribute('data-ag-row-stagger'), '1', 'P1-3a: menu item must be tagged data-ag-row-stagger="1"');
  assert.equal(item1.style.getPropertyValue('--ag-row-i'), '1');
  assert.equal(item1.getAttribute('data-ag-row-stagger'), '1');

  // Also mount an overview-panel shell to verify destroy() cleans --ag-origin-x/--ag-origin-y & data-ag-row-stagger/--ag-row-i
  const ovShell = makeDomNode('div', {}, { left: 100, top: 80, width: 420, height: 320, right: 520, bottom: 400 });
  const ovPanel = makeDomNode('div', { 'data-testid': 'overview-panel' });
  const ovRow = makeDomNode('div', { 'data-testid': 'artifact-row' });
  ovPanel.appendChild(ovRow);
  ovShell.appendChild(ovPanel);
  body.appendChild(ovShell);
  mainMo.cb([{ type: 'childList', target: body, addedNodes: [ovShell], removedNodes: [] }]);
  flushRafs();
  assert.equal(ovShell.getAttribute('data-ag-cs-overview-shell'), '1');
  assert.ok(ovShell.style.getPropertyValue('--ag-origin-x'));
  assert.ok(ovShell.style.getPropertyValue('--ag-origin-y'));
  assert.equal(ovRow.getAttribute('data-ag-row-stagger'), '1');
  assert.equal(ovRow.style.getPropertyValue('--ag-row-i'), '0');

  // Teardown removes all DOC_LISTENERS cleanly with matching opts AND cleans row-stagger / origin styles
  api.destroy();
  assert.equal(item0.hasAttribute('data-ag-row-stagger'), false, 'destroy() must strip data-ag-row-stagger');
  assert.equal(item0.style.getPropertyValue('--ag-row-i'), '', 'destroy() must clear --ag-row-i');
  assert.equal(item1.hasAttribute('data-ag-row-stagger'), false);
  assert.equal(item1.style.getPropertyValue('--ag-row-i'), '');
  assert.equal(ovRow.hasAttribute('data-ag-row-stagger'), false);
  assert.equal(ovRow.style.getPropertyValue('--ag-row-i'), '');
  assert.equal(overlay.style.getPropertyValue('--ag-origin-x'), '', 'destroy() must clear overlay --ag-origin-x');
  assert.equal(overlay.style.getPropertyValue('--ag-origin-y'), '', 'destroy() must clear overlay --ag-origin-y');
  assert.equal(ovShell.hasAttribute('data-ag-cs-overview-shell'), false);
  assert.equal(ovShell.style.getPropertyValue('--ag-origin-x'), '', 'destroy() must clear overview-shell --ag-origin-x');
  assert.equal(ovShell.style.getPropertyValue('--ag-origin-y'), '', 'destroy() must clear overview-shell --ag-origin-y');
  for (const evName of passiveExpected) {
    const rem = docRemoveRecords.find((r) => r.type === evName);
    assert.ok(rem, `destroy() must remove ${evName}`);
    assert.equal(rem.opts?.capture, true);
    assert.equal(rem.opts?.passive, true);
    assert.equal(docListeners.get(evName)?.size || 0, 0);
  }
});

// ── 3. host-workbench-enhancer: P1-2c & P2-2 live execution verification ───
test('Wave 3 host-workbench-enhancer: cached iframe size, zero-alloc countCodeLines, streamingPre short-circuit & non-tail seal, in-place outline active switch, passive navRail hover short-circuit', () => {
  const enhancerMod = require(path.join(ROOT, 'host-workbench-enhancer.js'));

  const html = makeDomNode('html', {
    'data-ag-cs-style': '1',
    'data-ag-cs-theme': 'dark',
    'data-ag-cs-palette': 'obsidian',
    'data-ag-cs-lang': 'en',
  });
  const body = makeDomNode('body');
  html.appendChild(body);

  // Sidecar iframe for cached iframeRo size test
  const iframe = makeDomNode('iframe', { 'data-testid': 'sidecar-iframe', src: 'plugin://swarm--board/' }, { left: 0, top: 0, width: 400, height: 600 });
  iframe.contentWindow = { postMessage() {} };
  body.appendChild(iframe);

  // Conversation with 3 turns + lastResp containing [doneTallPre, <p>after</p>, streamingTailPre]
  const convView = makeDomNode('div', { 'data-testid': 'conversation-view' });
  const navRail = makeDomNode('nav', { 'data-testid': 'conversation-navigator' });
  const dot0 = makeDomNode('button', { 'data-testid': 'conversation-navigator-turn', 'aria-label': 'Turn 1 of 3' });
  const dot1 = makeDomNode('button', { 'data-testid': 'conversation-navigator-turn', 'aria-label': 'Turn 2 of 3' });
  const dot2 = makeDomNode('button', { 'data-testid': 'conversation-navigator-turn', 'aria-label': 'Turn 3 of 3' });
  navRail.appendChild(dot0);
  navRail.appendChild(dot1);
  navRail.appendChild(dot2);
  convView.appendChild(navRail);

  const vp = makeDomNode('div', { 'data-testid': 'autoscroll-viewport' }, { left: 0, top: 0, width: 900, height: 600, right: 900, bottom: 600 });
  convView.appendChild(vp);

  const turn0 = makeDomNode('div', { 'data-testid': 'user-input-step' }, { left: 0, top: -300, width: 700, height: 40 });
  turn0.textContent = 'First prompt';
  const turn1 = makeDomNode('div', { 'data-testid': 'user-input-step' }, { left: 0, top: 100, width: 700, height: 40 });
  turn1.textContent = 'Second prompt';
  const turn2 = makeDomNode('div', { 'data-testid': 'user-input-step' }, { left: 0, top: 450, width: 700, height: 40 });
  turn2.textContent = 'Third prompt';
  vp.appendChild(turn0);
  vp.appendChild(turn1);
  vp.appendChild(turn2);

  const lastResp = makeDomNode('div', { 'data-testid': 'planner-response-text' });
  const makeCodePre = (text) => {
    const pre = makeDomNode('pre');
    const card = makeDomNode('div', { class: 'border bg-muted' });
    const header = makeDomNode('div', { class: 'border-b justify-between' });
    const bodyEl = makeDomNode('div');
    let textReads = 0;
    Object.defineProperty(bodyEl, 'textContent', {
      get() { textReads += 1; return text; },
      configurable: true,
    });
    bodyEl._getTextReads = () => textReads;
    card.appendChild(header);
    card.appendChild(bodyEl);
    pre.appendChild(card);
    return { pre, card, header, bodyEl };
  };

  // Plain-text 55-line completed block (tests zero-alloc indexOf('\n') countCodeLines + non-tail sealing!)
  const lines55 = Array.from({ length: 55 }, (_, i) => `const x${i} = ${i};`).join('\n') + '\n';
  const donePre = makeCodePre(lines55);
  const afterPara = makeDomNode('p');
  afterPara.textContent = 'Explanation after first code block';
  const streamingPre = makeCodePre(lines55);

  lastResp.appendChild(donePre.pre);
  lastResp.appendChild(afterPara);
  lastResp.appendChild(streamingPre.pre);
  vp.appendChild(lastResp);
  body.appendChild(convView);

  let roCb = null;
  let groupCardQueries = 0;
  const doc = {
    documentElement: html,
    body,
    activeElement: null,
    createElement: (t) => makeDomNode(t),
    querySelector: (s) => html.querySelector(s),
    querySelectorAll(s) {
      if (s === '[data-testid="conversation-navigator-group-card"]') groupCardQueries += 1;
      return html.querySelectorAll(s);
    },
  };
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

  let running = true;
  const ctl = enhancerMod.createHostEnhancerController({
    doc,
    win,
    getLang: () => 'en',
    isConvRunning: () => running,
  });

  // Spy String.prototype.split during sync to prove countCodeLines uses indexOf('\n') without split('\n')
  const origSplit = String.prototype.split;
  let newlineSplitCalls = 0;
  String.prototype.split = function (sep, ...rest) {
    if (sep === '\n') newlineSplitCalls += 1;
    return origSplit.call(this, sep, ...rest);
  };
  try {
    ctl.sync();
  } finally {
    String.prototype.split = origSplit;
  }

  assert.equal(newlineSplitCalls, 0, 'P1-2c: countCodeLines must count newlines via indexOf without String.split("\\n")');
  const foldBtn = donePre.header.querySelector('.ag-cs-code-fold-btn');
  assert.ok(foldBtn, 'Non-tail 55-line pre inside lastResp must mount fold button');
  assert.equal(foldBtn.textContent, 'Fold (55L)', 'countCodeLines must accurately count trailing-newline 55 lines');
  assert.equal(foldBtn.getAttribute('data-ag-owned'), '1');

  // streamingPre must short-circuit early: 0 text reads, no fold button, yet keeps data-ag-cs-rich-pre="1"
  assert.equal(streamingPre.bodyEl._getTextReads(), 0, 'P1-2c: streamingPre must short-circuit before reading body text');
  assert.equal(streamingPre.header.querySelector('.ag-cs-code-fold-btn'), null);
  assert.equal(streamingPre.pre.getAttribute('data-ag-cs-rich-pre'), '1');

  // Non-tail donePre in lastResp was sealed -> subsequent syncs do 0 extra body.textContent reads on donePre!
  const readsAfterSeal = donePre.bodyEl._getTextReads();
  ctl.sync();
  ctl.sync();
  assert.equal(donePre.bodyEl._getTextReads(), readsAfterSeal, 'P1-2c: sealed non-tail pre in lastResp must skip re-scanning');

  // Cached iframeRo size: once RO reports contentRect, repeated sync() performs 0 getBoundingClientRect calls
  roCb([{ target: iframe, contentRect: { width: 420, height: 600 } }]);
  iframe._rectReads = 0;
  ctl.sync();
  ctl.sync();
  assert.equal(iframe._rectReads, 0, 'P1-2c: isIframeHidden must reuse ResizeObserver cached size with 0 getBoundingClientRect');

  // P2-2: navRail listeners must all be { passive: true } and open outline with zero redundant group-card queries while open
  const railAdds = navRail._listenerOpts.filter((r) => r.op === 'add');
  assert.equal(railAdds.length, 3, 'navRail keeps 3 pointer listeners for backwards contract compatibility');
  for (const r of railAdds) {
    assert.deepEqual(r.opts, { passive: true }, `P2-2: navRail ${r.type} must be passive`);
  }

  navRail.dispatchEvent({ type: 'pointerenter', target: dot1 });
  const pop = html.querySelector('.ag-cs-nav-outline-popover');
  assert.ok(pop && !pop.hidden);
  assert.equal(pop.getAttribute('data-ag-owned'), '1');

  // Moving pointer over dots while outline is already open hits lightweight short-circuit BEFORE isHostGroupCardVisible()
  groupCardQueries = 0;
  for (let i = 0; i < 15; i++) {
    navRail.dispatchEvent({ type: 'pointerover', target: i % 2 === 0 ? dot0 : dot2 });
  }
  assert.equal(groupCardQueries, 0, 'P2-2: lightweight short-circuit while outline is open must perform 0 isHostGroupCardVisible() queries');

  // P1-2c: renderOutlineListOnly switches data-active="1" in place without destroying/recreating DOM buttons
  const btnsBefore = pop.querySelectorAll('.ag-cs-nav-outline-item');
  assert.equal(btnsBefore.length, 3);
  assert.equal(btnsBefore[1].getAttribute('data-active'), '1');
  assert.equal(btnsBefore[2].hasAttribute('data-active'), false);

  // Scroll turns so turn2 becomes active (midY = 600 * 0.35 = 210)
  turn1._rect.top = -200;
  turn2._rect.top = 120;
  running = false;
  ctl.sync();

  const btnsAfter = pop.querySelectorAll('.ag-cs-nav-outline-item');
  assert.equal(btnsAfter.length, 3);
  assert.equal(btnsAfter[0], btnsBefore[0], 'P1-2c: outline item 0 must NOT be destroyed/recreated on activeIdx change');
  assert.equal(btnsAfter[1], btnsBefore[1], 'P1-2c: outline item 1 must NOT be destroyed/recreated on activeIdx change');
  assert.equal(btnsAfter[2], btnsBefore[2], 'P1-2c: outline item 2 must NOT be destroyed/recreated on activeIdx change');
  assert.equal(btnsAfter[1].hasAttribute('data-active'), false, 'Old active outline item must clear data-active');
  assert.equal(btnsAfter[2].getAttribute('data-active'), '1', 'New active outline item must receive data-active="1"');

  // Edge cases of countCodeLines via plain pre blocks (compare directly against reference split('\n') semantics)
  const pad49 = Array.from({ length: 49 }, () => 'x').join('\n');
  const samples = [
    '',
    '\n',
    `${pad49}\nsingle`,
    `${pad49}\nsingle\n`,
    `${pad49}\n\n`,
    `${pad49}\na\nb\nc`,
    `${pad49}\na\nb\nc\n`,
  ];
  for (const raw of samples) {
    const trimmed = raw.endsWith('\n') ? raw.slice(0, -1) : raw;
    const expected = trimmed.length === 0 ? 0 : trimmed.split('\n').length;
    const preObj = makeCodePre(raw);
    lastResp.appendChild(preObj.pre);
    ctl.sync();
    const b = preObj.header.querySelector('.ag-cs-code-fold-btn');
    if (expected < 48) {
      assert.equal(b, null, `Expected no fold button for ${expected} lines`);
    } else {
      assert.equal(b?.getAttribute('data-lines'), String(expected), `countCodeLines mismatch for sample len=${raw.length}`);
    }
  }

  ctl.destroy();
});

// ── 4. stream-choreography: P1-3c historical English "Thinking Process" never false-triggers streaming ─
test('Wave 3 stream-choreography P1-3c: historical English "Thinking Process" never false-triggers streaming spark or comet, while active streaming ellipsis/Arabic/attr works accurately', () => {
  const src = fs.readFileSync(path.join(ROOT, 'stream-choreography.js'), 'utf8');
  const html = makeDomNode('html', { 'data-ag-cs-motion': 'ultra' });
  const body = makeDomNode('body');
  html.appendChild(body);
  const conv = makeDomNode('div', { 'data-testid': 'conversation-view' });

  const makeTriggerWithLabel = (labelText) => {
    const trig = makeDomNode('button', { 'data-testid': 'thinking-collapsible-trigger', 'aria-expanded': 'true' });
    const lbl = makeDomNode('span');
    lbl.textContent = labelText;
    trig.appendChild(lbl);
    return { trig, lbl };
  };
  const { trig: trigHistEn } = makeTriggerWithLabel('Thinking Process');
  const bodyHistEn = makeDomNode('div');

  const { trig: trigHistEllipsis } = makeTriggerWithLabel('Thinking about architecture...');
  const bodyHistEllipsis = makeDomNode('div');

  const { trig: trigLatestDone, lbl: lblLatestDone } = makeTriggerWithLabel('Thinking Process');
  const bodyLatestDone = makeDomNode('div');

  conv.appendChild(trigHistEn);
  conv.appendChild(bodyHistEn);
  conv.appendChild(trigHistEllipsis);
  conv.appendChild(bodyHistEllipsis);
  conv.appendChild(trigLatestDone);
  conv.appendChild(bodyLatestDone);
  body.appendChild(conv);

  const fakeDoc = {
    hidden: false,
    documentElement: html,
    body,
    createElement: (t) => makeDomNode(t),
    querySelector: (s) => html.querySelector(s),
    querySelectorAll: (s) => html.querySelectorAll(s),
  };
  const sb = {
    document: fakeDoc,
    performance: { now: () => 5000 },
    requestAnimationFrame: () => 0,
    cancelAnimationFrame() {},
    setTimeout: () => 1,
    clearTimeout() {},
    MutationObserver: class { observe() {} disconnect() {} },
    Map, WeakMap, Set, WeakSet, Array, Object, Math, Number, String, Boolean, Date, RegExp,
  };
  sb.window = sb;
  sb.globalThis = sb;
  vm.runInNewContext(src, sb);

  const ctl = sb.__agPrismStreamChoreography.createStreamChoreographyController({
    isDestroyed: () => false,
    isMotionStandardOrUltra: () => true,
    isMotionUltra: () => true,
    isConvRunning: () => true,
    isThoughtIsolatedNode: () => false,
    isThoughtMutationRecord: () => false,
    isManagedThoughtPanel: () => false,
    setAttrIfChanged: (el, k, v) => el.setAttribute(k, v),
    runGuardedMut: (fn) => fn(),
    buildBrandMarkSvg: () => '<svg></svg>',
    cloneCachedSvgElement: () => null,
  });

  // Case 1: Even while conv is running (e.g. writing prose after thought finished), "Thinking Process" & non-tail ellipsis are DONE
  ctl.syncThinkingSparks({ brand: 'gemini' });
  ctl.syncDualStreamEngine();

  for (const [label, trig, bDiv] of [
    ['historical Thinking Process', trigHistEn, bodyHistEn],
    ['historical non-tail ellipsis', trigHistEllipsis, bodyHistEllipsis],
    ['latest finished Thinking Process', trigLatestDone, bodyLatestDone],
  ]) {
    const sp = trig.querySelector('.ag-cs-thinking-spark');
    assert.ok(sp, `${label} mounts spark`);
    assert.equal(sp.getAttribute('data-ag-owned'), '1');
    assert.equal(sp.getAttribute('data-state'), 'done', `${label} spark must be done (no infinite spin)`);
    assert.equal(trig.hasAttribute('data-ag-cs-spark-streaming'), false, `${label} must not set spark-streaming`);
    assert.equal(bDiv.hasAttribute('data-ag-cs-thought-streaming'), false, `${label} must not set thought-streaming comet`);
  }

  // Case 2: Latest trigger actively streaming ("Thinking...", "جاري التفكير", "يفكر", "جارٍ التحليل…") OR explicit data-op-thought-state="streaming"
  for (const activeText of ['Thinking...', 'جاري التفكير', 'يفكر', 'جارٍ التحليل…']) {
    lblLatestDone.textContent = activeText;
    ctl.syncThinkingSparks({ brand: 'gemini' });
    ctl.syncDualStreamEngine();
    assert.equal(trigLatestDone.querySelector('.ag-cs-thinking-spark').getAttribute('data-state'), 'streaming', `${activeText} must be streaming`);
    assert.equal(trigLatestDone.getAttribute('data-ag-cs-spark-streaming'), '1');
    assert.equal(bodyLatestDone.getAttribute('data-ag-cs-thought-streaming'), '1');
  }

  // Case 3: Explicit data-op-thought-state="streaming" always wins even on non-tail trigger
  lblLatestDone.textContent = 'Thought for 3s';
  trigHistEn.setAttribute('data-op-thought-state', 'streaming');
  ctl.syncThinkingSparks({ brand: 'gemini' });
  ctl.syncDualStreamEngine();
  assert.equal(trigHistEn.querySelector('.ag-cs-thinking-spark').getAttribute('data-state'), 'streaming');
  assert.equal(bodyHistEn.getAttribute('data-ag-cs-thought-streaming'), '1');
  assert.equal(trigLatestDone.querySelector('.ag-cs-thinking-spark').getAttribute('data-state'), 'done');
  assert.equal(bodyLatestDone.hasAttribute('data-ag-cs-thought-streaming'), false);

  ctl.disconnectStreamObserver();
  ctl.clearTransientTimers();
});

// ── 5. home-studio-panel: P2-3 skip re-render on non-quota tabs ──────────
test('Wave 3 home-studio-panel P2-3: quota telemetry refreshes perform 0 panel re-renders on Overview/Models tabs, and re-render normally on Quotas tab', async () => {
  const src = fs.readFileSync(path.join(ROOT, 'home-studio-panel.js'), 'utf8');
  const html = makeDomNode('html');
  const head = makeDomNode('head');
  const body = makeDomNode('body');
  const home = makeDomNode('div', { class: 'agy-home' });
  const greeting = makeDomNode('div', { 'data-testid': 'home-greeting' });
  home.appendChild(greeting);
  body.appendChild(home);
  html.appendChild(head);
  html.appendChild(body);

  let snapCounter = 0;
  const fakeDoc = {
    documentElement: html,
    head,
    body,
    title: 'obsidian-prism',
    createElement: (t) => makeDomNode(t),
    getElementById: (id) => html.querySelector(`#${id}`),
    querySelector: (s) => html.querySelector(s),
    querySelectorAll: (s) => html.querySelectorAll(s),
  };
  const sb = {
    document: fakeDoc,
    window: null,
    localStorage: { getItem: () => null, setItem() {}, removeItem() {} },
    requestAnimationFrame: () => 0,
    cancelAnimationFrame() {},
    setTimeout,
    clearTimeout,
    agPulseHost: {
      async getMetrics() {
        snapCounter += 1;
        return {
          groups: [{ id: 'g1', name: 'Gemini', windows: { fiveHour: { remaining: 0.8 - snapCounter * 0.1 } } }],
          usage: {},
        };
      },
    },
    Map, Set, Array, Object, Math, Number, String, Boolean, Date, JSON, Promise,
  };
  sb.window = sb;
  sb.globalThis = sb;
  vm.runInNewContext(src, sb);

  const usageCore = {
    HOME_RANGES: [{ id: 'all', labelEn: 'All' }],
    HOME_MODEL_ROWS: 5,
    createHomeModelColours: () => () => ({ 'gemini-4': 0 }),
    aggregateUsageRollup: () => ({
      workspaces: [],
      sessions: 3,
      calls: 12,
      tokens: 12000,
      subagentTokens: 0,
      cacheHitRate: 0.5,
      activeDays: 2,
      model: 'gemini-4',
      grid: { cells: [] },
      models: [{ id: 'gemini-4', tokens: 12000, sessions: 3, input: 8000, output: 4000, cacheHitRate: 0.5 }],
      modelDays: [],
    }),
    formatHomeCount: (n) => String(n),
    formatCompactTokens: (n) => `${n}`,
    fmtPct: (n) => `${n}%`,
    homeShortDateFormat: () => null,
    homeShortDate: () => 'Nov 22',
    quotaWindows: (g) => Object.entries(g.windows || {}),
    quotaForecast: (b) => ({ remaining: b.remaining, resetInMs: 0 }),
    quotaGroupKind: () => 'gemini',
    quotaGroupLabel: (g) => g.name,
  };

  const ctl = sb.__agPrismHomeStudioPanel.createHomeStudioPanelController({
    usageCore,
    isDestroyed: () => false,
    getHomeLayout: () => 'studio',
    getLang: () => 'en',
    uiText: () => ({}),
    getDisplayName: () => '',
    ensureHooks: () => null,
    canMountRealCanvas: () => false,
    setAttrIfChanged: (el, k, v) => el.setAttribute(k, v),
    runGuardedMut: (fn) => fn(),
  });

  ctl.renderHomePanel();
  const seat = home.querySelector('.ag-cs-home-panel-seat');
  const panel = home.querySelector('.ag-cs-home-panel');
  assert.ok(seat && panel);
  assert.equal(seat.getAttribute('data-ag-owned'), '1', 'P1-2b: panelSeat must carry data-ag-owned="1"');

  // 1) Overview tab: quota refreshes must perform 0 panel re-renders (panel._innerHtmlSets unchanged)
  const setsOnOverview = panel._innerHtmlSets;
  const firstChildOverview = panel.firstElementChild;
  await ctl.refreshLiveTelemetrySnapshot(true);
  await ctl.refreshLiveTelemetrySnapshot(true);
  ctl.renderHomePanel();
  assert.equal(panel._innerHtmlSets, setsOnOverview, 'P2-3: quota refresh on overview tab must trigger 0 panel innerHTML rebuilds');
  assert.equal(panel.firstElementChild, firstChildOverview, 'Overview DOM nodes must remain intact');

  // 2) Models tab: quota refreshes must ALSO perform 0 panel re-renders
  const modelsTabBtn = panel.querySelector('button[data-tab="models"]');
  modelsTabBtn.click();
  const setsOnModels = panel._innerHtmlSets;
  await ctl.refreshLiveTelemetrySnapshot(true);
  ctl.renderHomePanel();
  assert.equal(panel._innerHtmlSets, setsOnModels, 'P2-3: quota refresh on models tab must trigger 0 panel innerHTML rebuilds');

  // 3) Quotas tab: quota refresh DOES trigger re-render with updated quota cards
  const quotasTabBtn = panel.querySelector('button[data-tab="quotas"]');
  quotasTabBtn.click();
  const setsBeforeQuotaRefresh = panel._innerHtmlSets;
  await ctl.refreshLiveTelemetrySnapshot(true);
  assert.ok(panel._innerHtmlSets > setsBeforeQuotaRefresh, 'P2-3: quotas tab must re-render when quota snapshot updates');
  assert.ok(panel.querySelector('.ag-cs-quota-card'), 'Quotas tab must render quota cards');
});

// ── 6. model-glyph-crystal: P2-4 stepCrystalLoop read-before-write + cache knob/width ─
test('Wave 3 model-glyph-crystal P2-4: stepCrystalLoop reads fillRatio before writing --knob-px/--knob-py and caches knob ref & track width', () => {
  const src = fs.readFileSync(path.join(ROOT, 'model-glyph-crystal.js'), 'utf8');
  const html = makeDomNode('html', { 'data-ag-cs-ambient': '1' });
  const body = makeDomNode('body');
  html.appendChild(body);

  const panel = makeDomNode('div', { 'data-testid': 'model-selector-panel', 'data-ces-orch-tunable': 'true' });
  const orchRow = makeDomNode('div', { role: 'menuitem', 'data-testid': 'model-selector-orchestrator', 'data-ces-model-selected': 'true' });
  orchRow.textContent = 'Orchestrator';
  const cesSec = makeDomNode('div', { class: 'ces-ag-section' });
  const effRow = makeDomNode('div', { class: 'ces-ag-effort-row' });
  const trk = makeDomNode('div', { class: 'ces-track' });
  const knob = makeDomNode('div', { class: 'ces-knob' }, { left: 100, top: 100, width: 20, height: 20, right: 120, bottom: 120 });

  const ops = [];
  let clientWidthReads = 0;
  let knobQsCalls = 0;
  Object.defineProperty(trk, 'clientWidth', {
    get() {
      clientWidthReads += 1;
      ops.push('read:trk.clientWidth');
      return 220;
    },
  });
  Object.defineProperty(knob, 'offsetLeft', {
    get() {
      ops.push('read:knob.offsetLeft');
      return 110;
    },
  });
  const origTrkQs = trk.querySelector.bind(trk);
  trk.querySelector = (sel) => {
    if (sel === '.ces-knob') knobQsCalls += 1;
    return origTrkQs(sel);
  };
  const origKnobRect = knob.getBoundingClientRect.bind(knob);
  knob.getBoundingClientRect = () => {
    ops.push('read:knob.rect');
    return origKnobRect();
  };
  const origKnobSetProp = knob.style.setProperty.bind(knob.style);
  knob.style.setProperty = (k, v) => {
    ops.push(`write:${k}`);
    return origKnobSetProp(k, v);
  };

  trk.appendChild(knob);
  effRow.appendChild(trk);
  cesSec.appendChild(effRow);
  panel.appendChild(orchRow);
  panel.appendChild(cesSec);
  body.appendChild(panel);

  let fakeNow = 1000;
  const rafs = [];
  const fakeDoc = {
    hidden: false,
    documentElement: html,
    body,
    createElement: (t) => makeDomNode(t),
    querySelector: (s) => html.querySelector(s),
    querySelectorAll: (s) => html.querySelectorAll(s),
  };
  const sb = {
    document: fakeDoc,
    performance: { now: () => fakeNow },
    requestAnimationFrame(cb) { rafs.push(cb); return rafs.length; },
    cancelAnimationFrame() {},
    Map, Set, Array, Object, Math, Number, String, Boolean, RegExp,
  };
  sb.window = sb;
  sb.globalThis = sb;
  vm.runInNewContext(src, sb);

  let stepFillRatios = [];
  let savedGetState = null;
  const ctl = sb.__agPrismModelGlyphCrystal.createModelGlyphCrystalController({
    animatedIcons: null,
    crystalPrismCore: {
      mountCrystalPrismBar(_cv, opts) {
        savedGetState = opts.getState;
        return {
          setReduceMotion() {},
          setPointerClient() {},
          wake() {},
          step() {
            ops.push('step:begin');
            const st = savedGetState();
            stepFillRatios.push(st.fillRatio);
            ops.push('step:end');
          },
          isIdle: () => false,
          dispose() {},
        };
      },
    },
    isDestroyed: () => false,
    isComposerRestyleEnabled: () => true,
    isZh: () => true,
    isDarkTheme: () => true,
    motionReduced: () => false,
    getMinFrameGapMs: () => 0,
    canMountRealCanvas: () => true,
    getLastPointerPos: () => ({ x: 112, y: 112 }),
    setAttrIfChanged: (el, k, v) => el.setAttribute(k, v),
  });

  // Mount via first rAF
  ctl.syncModelSelectorPanel({ brand: 'antigravity', tier: 'auto', isOrchestrator: true, camp: 'gemini' });
  assert.equal(rafs.length, 1);
  ops.length = 0;
  rafs.shift()(fakeNow);

  // Verify initial kickCrystal also reads before writing
  const firstWriteKick = ops.findIndex((x) => x.startsWith('write:'));
  const lastLayoutReadKick = Math.max(
    ops.lastIndexOf('read:trk.clientWidth'),
    ops.lastIndexOf('read:knob.offsetLeft'),
    ops.lastIndexOf('read:knob.rect')
  );
  assert.ok(firstWriteKick > lastLayoutReadKick && firstWriteKick >= 0, `kickCrystal must read before writing, ops=${JSON.stringify(ops)}`);
  assert.equal(stepFillRatios[0], 0.5);

  // Run 2nd frame via stepCrystalLoop
  ops.length = 0;
  const widthReadsBeforeFrame2 = clientWidthReads;
  const knobQsBeforeFrame2 = knobQsCalls;
  fakeNow += 16;
  rafs.shift()(fakeNow);

  const firstWriteF2 = ops.findIndex((x) => x.startsWith('write:'));
  const lastLayoutReadF2 = Math.max(
    ops.lastIndexOf('read:trk.clientWidth'),
    ops.lastIndexOf('read:knob.offsetLeft'),
    ops.lastIndexOf('read:knob.rect')
  );
  assert.ok(firstWriteF2 > lastLayoutReadF2 && firstWriteF2 >= 0, `P2-4: stepCrystalLoop must read fillRatio/rect before writing CSS vars, ops=${JSON.stringify(ops)}`);
  assert.equal(clientWidthReads, widthReadsBeforeFrame2, 'P2-4: track width must be cached across frames');
  assert.equal(knobQsCalls, knobQsBeforeFrame2, 'P2-4: knob element ref must be cached across frames');
  assert.equal(stepFillRatios[stepFillRatios.length - 1], 0.5);

  ctl.teardownCrystalMount();
});

// ── 7. pulse-dashboard/inline-fallback: P2-5 merge duplicate seatObs queries & early exit ───
test('Wave 3 pulse inline-fallback P2-5: seatObs merges duplicate isConv() and findAnchor() queries and early-exits cleanly', () => {
  const src = fs.readFileSync(path.join(ROOT, 'vendor', 'pulse-dashboard', 'inline-fallback.js'), 'utf8');
  const html = makeDomNode('html');
  const body = makeDomNode('body');
  html.appendChild(body);

  const convView = makeDomNode('div', { 'data-testid': 'conversation-view', 'data-cascade-id': '11111111-1111-1111-1111-111111111111' });
  const inputBox = makeDomNode('div', { 'data-testid': 'agent-input-box' });
  const footer = makeDomNode('div', { class: 'agy-composer-footer' }, { left: 0, top: 0, width: 700, height: 32 });
  footer.appendChild(makeDomNode('div'));
  footer.appendChild(makeDomNode('div'));
  inputBox.appendChild(footer);
  convView.appendChild(inputBox);
  body.appendChild(convView);

  let homeChecks = 0;
  let footerAnchorChecks = 0;
  const fakeDoc = {
    hidden: false,
    documentElement: html,
    body,
    createElement: (t) => makeDomNode(t),
    getElementById: (id) => html.querySelector(`#${id}`),
    querySelector(sel) {
      if (sel.includes('.agy-home')) homeChecks += 1;
      if (sel.includes('.agy-composer-footer')) footerAnchorChecks += 1;
      return html.querySelector(sel);
    },
    querySelectorAll: (s) => html.querySelectorAll(s),
    addEventListener() {},
    removeEventListener() {},
  };

  let seatMoCb = null;
  const timers = new Map();
  let tSeq = 1;
  const sb = {
    document: fakeDoc,
    location: { pathname: '/c/11111111-1111-1111-1111-111111111111' },
    performance: { now: () => 1000 },
    requestAnimationFrame: () => 0,
    cancelAnimationFrame() {},
    setTimeout(fn, ms) { const id = tSeq++; timers.set(id, { fn, ms }); return id; },
    clearTimeout(id) { timers.delete(id); },
    setInterval: () => 1,
    clearInterval() {},
    ResizeObserver: class { observe() {} disconnect() {} },
    MutationObserver: class {
      constructor(cb) { this.cb = cb; }
      observe(target) { if (target === body) seatMoCb = this.cb; }
      disconnect() {}
    },
    addEventListener() {},
    removeEventListener() {},
    Map, Set, Array, Object, Math, Number, String, Boolean, Date, Promise,
  };
  sb.window = sb;
  sb.globalThis = sb;
  vm.runInNewContext(src, sb);

  // 1) Start in auto mode on conversation page (fbEl mounted + data-ag-owned="1")
  sb.__agPrismTelemetry.sync({ telemetryModule: 'on', language: 'en' });
  assert.ok(seatMoCb, 'seatObs must be attached');
  const fbNode = html.querySelector('#ag-prism-pulse-bar');
  assert.ok(fbNode);
  assert.equal(fbNode.getAttribute('data-ag-owned'), '1', 'P1-2b: fallback bar must carry data-ag-owned="1"');

  // Connected fbEl: seatObs runs isConv ONCE and skips findAnchor completely
  homeChecks = 0;
  footerAnchorChecks = 0;
  seatMoCb([{ type: 'childList', target: body }]);
  assert.equal(homeChecks, 1, 'P2-5: seatObs with connected fbEl must call isConv exactly once');
  assert.equal(footerAnchorChecks, 0, 'P2-5: seatObs with connected fbEl must skip findAnchor');

  // 2) Unmount fbEl (e.g. home page -> back to conv without fbEl): seatObs merges isConv across hasExt + findAnchor into 1 call!
  const homeEl = makeDomNode('div', { class: 'agy-home' });
  body.appendChild(homeEl);
  sb.__agPrismTelemetry.sync({ telemetryModule: 'on', language: 'en' });
  assert.equal(html.querySelector('#ag-prism-pulse-bar'), null, 'Home page must unmount fallback bar');

  // While on home page: seatObs early-exits after 1 isConv and 0 findAnchor calls
  homeChecks = 0;
  footerAnchorChecks = 0;
  timers.clear();
  seatMoCb([{ type: 'childList', target: body }]);
  assert.equal(homeChecks, 1, 'P2-5: home page seatObs must call isConv exactly once and early-exit');
  assert.equal(footerAnchorChecks, 0, 'P2-5: home page seatObs must perform 0 findAnchor queries');

  // Leave home page -> back in conv without fbEl yet: seatObs checks isConv ONCE across !fbEl -> hasExt -> findAnchor
  homeEl.remove();
  homeChecks = 0;
  footerAnchorChecks = 0;
  timers.clear();
  seatMoCb([{ type: 'childList', target: body }]);
  assert.equal(homeChecks, 1, 'P2-5: seatObs checking hasExt + findAnchor must call isConv exactly once (not 3-4 times)');
  assert.equal(footerAnchorChecks, 1, 'P2-5: findAnchor probes footer once');
  assert.equal(timers.size, 1, 'seatObs must schedule fast heal when anchor is ready');

  sb.__agPrismTelemetry.destroy();
});

// ── 8. ui-runtime autoUpdate normalization & boolean compatibility ─────────
test('P1 ui-runtime autoUpdate normalization (default off, boolean true/false -> on/off, wire binding alignment)', () => {
  const cdp = require(path.join(ROOT, 'cdp.js'));
  const uiMainFactory = require(path.join(ROOT, 'ui-runtime.js'));
  const i18nCore = require(path.join(ROOT, 'i18n-core.js'));
  const i18nLocales = require(path.join(ROOT, 'i18n-locales.js'));

  const html = makeDomNode('html');
  const head = makeDomNode('head');
  const body = makeDomNode('body');
  html.appendChild(head);
  html.appendChild(body);
  const fakeDoc = {
    hidden: false,
    documentElement: html,
    head,
    body,
    hasFocus: () => true,
    createElement: (t) => makeDomNode(t),
    getElementById: (id) => html.querySelector(`#${id}`),
    querySelector: (s) => html.querySelector(s),
    querySelectorAll: (s) => html.querySelectorAll(s),
    addEventListener() {},
    removeEventListener() {},
  };
  const wiredPayloads = [];
  const storage = new Map();
  const sb = {
    window: null,
    document: fakeDoc,
    location: { pathname: '/', href: 'http://localhost/' },
    localStorage: {
      getItem: (k) => (storage.has(k) ? storage.get(k) : null),
      setItem: (k, v) => storage.set(k, String(v)),
      removeItem: (k) => storage.delete(k),
    },
    performance: { now: () => 1000 },
    navigator: { language: 'en' },
    innerWidth: 1280,
    innerHeight: 800,
    devicePixelRatio: 1,
    getComputedStyle: () => ({ getPropertyValue: () => '' }),
    matchMedia: () => ({ matches: false, addEventListener() {}, removeEventListener() {} }),
    addEventListener() {},
    removeEventListener() {},
    MutationObserver: class { observe() {} disconnect() {} takeRecords() { return []; } },
    requestAnimationFrame: () => 1,
    cancelAnimationFrame() {},
    setTimeout: () => 1,
    clearTimeout() {},
    setInterval: () => 1,
    clearInterval() {},
    __agCsI18nCore: i18nCore,
    __agCsLocales: i18nLocales,
    __agPrismSetting: (raw) => { wiredPayloads.push(JSON.parse(raw)); },
    Set, WeakSet, Map, WeakMap, Array, Object, Math, Number, String, Boolean, Date, RegExp, JSON, Promise, Proxy,
  };
  sb.window = sb;
  sb.globalThis = sb;

  const initCfg = { ...cdp.DEFAULT_CONFIG, autoUpdate: true };
  vm.runInNewContext(`(${uiMainFactory.toString()})(${JSON.stringify(initCfg)})`, sb);
  const api = sb.window.__agPrism;

  // Initial boolean true normalizes to 'on'
  assert.equal(api.getState().cfg.autoUpdate, 'on');

  // refreshConfig with invalid value falls back to default 'off'
  api.refreshConfig({ autoUpdate: 'bogus-value' });
  assert.equal(api.getState().cfg.autoUpdate, 'off');

  // saveSettingsBatch with boolean true/false normalizes and emits 'on'/'off' to host wire binding
  wiredPayloads.length = 0;
  api.saveSettingsBatch({ autoUpdate: true });
  assert.equal(api.getState().cfg.autoUpdate, 'on');
  assert.equal(wiredPayloads[wiredPayloads.length - 1]?.entries?.autoUpdate, 'on');

  api.saveSettingsBatch({ autoUpdate: false });
  assert.equal(api.getState().cfg.autoUpdate, 'off');
  assert.equal(wiredPayloads[wiredPayloads.length - 1]?.entries?.autoUpdate, 'off');

  // Default omitted config also resolves to 'off'
  api.refreshConfig({ autoUpdate: undefined });
  assert.equal(api.getState().cfg.autoUpdate, 'off');

  api.destroy();
});

// ── 9. Effort Slider cleanup symmetry + conv-aura external caller isolation + enhancer guarded title ──
test('P1 Effort Slider cleanup strips data-ces-orch-b/tunable, conv-aura computeConvAuraOptics isolates external callers, and host-workbench-enhancer guards outlineTitleEl mutation', () => {
  // (a) slider-coexist clrTint & upstream-client _clrAgDom strip data-ces-orch-b and data-ces-orch-tunable
  const sliderCoexist = require(path.join(ROOT, 'vendor', 'effort-slider', 'slider-coexist.js'));
  const upstreamClient = require(path.join(ROOT, 'vendor', 'effort-slider', 'upstream-client.js'));

  const html = makeDomNode('html', { 'data-ces-slider-ready': '1' });
  const head = makeDomNode('head');
  const body = makeDomNode('body');
  html.appendChild(head);
  html.appendChild(body);

  const panel = makeDomNode('div', {
    'data-testid': 'model-selector-panel',
    'data-ces-orch-tunable': 'true',
    'data-ces-orch-b': '1',
    'data-ces-orch-row': '1',
  });
  const orchRow = makeDomNode('div', {
    role: 'menuitem',
    'data-ces-model-selected': 'true',
    'data-ces-orch-b': 'true',
    'data-ces-orch-tunable': '1',
  });
  panel.appendChild(orchRow);
  body.appendChild(panel);

  const fakeDoc = {
    documentElement: html,
    head,
    body,
    createElement: (t) => makeDomNode(t),
    getElementById: (id) => html.querySelector(`#${id}`),
    querySelector: (s) => html.querySelector(s),
    querySelectorAll: (s) => html.querySelectorAll(s),
    addEventListener() {},
    removeEventListener() {},
  };
  const fakeWin = {
    document: fakeDoc,
    __agCodexEffortSlider: upstreamClient,
    addEventListener() {},
    removeEventListener() {},
    MutationObserver: class { observe() {} disconnect() {} },
    setTimeout: () => 1,
    clearTimeout() {},
  };

  // slider-coexist sync({ effortSliderModule: 'off' }) strips data-ces-orch-b & data-ces-orch-tunable
  const sliderCtl = sliderCoexist.createEffortSliderController({ window: fakeWin, document: fakeDoc });
  sliderCtl.sync({ effortSliderModule: 'off' });
  assert.equal(panel.hasAttribute('data-ces-orch-tunable'), false, 'slider-coexist clrTint must strip data-ces-orch-tunable');
  assert.equal(panel.hasAttribute('data-ces-orch-b'), false, 'slider-coexist clrTint must strip data-ces-orch-b');
  assert.equal(orchRow.hasAttribute('data-ces-orch-tunable'), false);
  assert.equal(orchRow.hasAttribute('data-ces-orch-b'), false);
  sliderCtl.destroy();

  // upstream-client installCodexEffortSlider(...).stop() -> _clrAgDom also strips both attributes
  panel.setAttribute('data-ces-orch-tunable', 'true');
  panel.setAttribute('data-ces-orch-b', '1');
  orchRow.setAttribute('data-ces-orch-tunable', '1');
  orchRow.setAttribute('data-ces-orch-b', 'true');
  const rawInst = upstreamClient.installCodexEffortSlider({
    document: fakeDoc,
    window: fakeWin,
    MutationObserver: fakeWin.MutationObserver,
    skipGenericMenuObserver: true,
  });
  rawInst.stop();
  assert.equal(panel.hasAttribute('data-ces-orch-tunable'), false, 'upstream-client _clrAgDom must strip data-ces-orch-tunable');
  assert.equal(panel.hasAttribute('data-ces-orch-b'), false, 'upstream-client _clrAgDom must strip data-ces-orch-b');
  assert.equal(orchRow.hasAttribute('data-ces-orch-tunable'), false);
  assert.equal(orchRow.hasAttribute('data-ces-orch-b'), false);

  // (b) conv-aura computeConvAuraOptics defaults to fresh {} per call (no aliasing / clobbering across external calls)
  const auraSrc = fs.readFileSync(path.join(ROOT, 'conv-aura.js'), 'utf8');
  const auraSb = { Math, Number, String, Boolean, Array, Object, Set, WeakSet, Map, WeakMap };
  auraSb.window = auraSb;
  auraSb.globalThis = auraSb;
  vm.runInNewContext(auraSrc, auraSb);
  const o1 = auraSb.__agPrismConvAura.computeConvAuraOptics('start', 0, 150, true, true);
  const snapO1 = { ...o1 };
  const o2 = auraSb.__agPrismConvAura.computeConvAuraOptics('error-halted', 0, 100, false, false);
  assert.notEqual(o1, o2, 'external computeConvAuraOptics calls must not share mutable OPTICS_BUF');
  assert.deepEqual({ ...o1 }, snapO1, 'second computeConvAuraOptics call must not mutate first returned object');
  assert.equal(o2.semantic, 'error-halted');

  // (c) host-workbench-enhancer writes outlineTitleEl.textContent inside runGuardedMut
  const enhMod = require(path.join(ROOT, 'host-workbench-enhancer.js'));
  const eHtml = makeDomNode('html', { 'data-ag-cs-style': '1', 'data-ag-cs-lang': 'en' });
  const eBody = makeDomNode('body');
  eHtml.appendChild(eBody);
  const eConv = makeDomNode('div', { 'data-testid': 'conversation-view' });
  const eRail = makeDomNode('nav', { 'data-testid': 'conversation-navigator' });
  const eDot = makeDomNode('button', { 'data-testid': 'conversation-navigator-turn', 'aria-label': 'Turn 1' });
  eRail.appendChild(eDot);
  const eVp = makeDomNode('div', { 'data-testid': 'autoscroll-viewport' }, { left: 0, top: 0, width: 800, height: 600 });
  const eTurn = makeDomNode('div', { 'data-testid': 'user-input-step' }, { left: 0, top: 80, width: 600, height: 40 });
  eTurn.textContent = 'Check guarded outline title';
  eVp.appendChild(eTurn);
  eConv.appendChild(eRail);
  eConv.appendChild(eVp);
  eBody.appendChild(eConv);

  let guardedDepth = 0;
  let titleWritesOutsideGuard = 0;
  let titleWritesInsideGuard = 0;
  const eDoc = {
    documentElement: eHtml,
    body: eBody,
    activeElement: null,
    createElement(tag) {
      const n = makeDomNode(tag);
      const origDesc = Object.getOwnPropertyDescriptor(n, 'textContent');
      Object.defineProperty(n, 'textContent', {
        get() { return origDesc.get.call(this); },
        set(v) {
          if (this.className && this.className.includes('ag-cs-nav-outline-title')) {
            if (guardedDepth > 0) titleWritesInsideGuard += 1;
            else titleWritesOutsideGuard += 1;
          }
          return origDesc.set.call(this, v);
        },
        configurable: true,
      });
      return n;
    },
    querySelector: (s) => eHtml.querySelector(s),
    querySelectorAll: (s) => eHtml.querySelectorAll(s),
  };
  const eWin = {
    innerHeight: 800,
    getComputedStyle: () => ({ getPropertyValue: () => '' }),
    addEventListener() {},
    removeEventListener() {},
  };
  const eCtl = enhMod.createHostEnhancerController({
    doc: eDoc,
    win: eWin,
    getLang: () => 'en',
    runGuardedMut: (fn) => {
      guardedDepth += 1;
      try { return fn(); } finally { guardedDepth -= 1; }
    },
  });
  eCtl.sync();
  eRail.dispatchEvent({ type: 'pointerenter', target: eDot });
  assert.ok(titleWritesInsideGuard >= 1, 'outlineTitleEl.textContent update must run inside runGuardedMut');
  assert.equal(titleWritesOutsideGuard, 0, 'outlineTitleEl.textContent must never mutate outside runGuardedMut');
  eCtl.destroy();
});
