import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const ROOT = path.resolve(import.meta.dirname, '..');

globalThis.__agCodexEffortSliderDisableAutoBoot = true;
const ctxMenuMod = require(path.join(ROOT, 'context-menu-btw.js'));
const upstreamLib = require(path.join(ROOT, 'vendor', 'effort-slider', 'upstream-client.js'));
const sliderCoexist = require(path.join(ROOT, 'vendor', 'effort-slider', 'slider-coexist.js'));
const mgcMod = require(path.join(ROOT, 'model-glyph-crystal.js'));
const cdp = require(path.join(ROOT, 'cdp.js'));

// ── Lightweight Deterministic DOM Harness ───────────────────────────────────
function matchesSingle(el, rawSel) {
  if (!el || el.nodeType !== 1) return false;
  const sel = rawSel.trim();
  if (!sel) return false;
  const descParts = sel.match(/(?:"[^"]*"|[^\s])+/g) || [];
  if (descParts.length > 1) {
    if (!matchesSingle(el, descParts[descParts.length - 1])) return false;
    let cur = el.parentElement;
    for (let i = descParts.length - 2; i >= 0; i--) {
      while (cur && !matchesSingle(cur, descParts[i])) cur = cur.parentElement;
      if (!cur) return false;
      cur = cur.parentElement;
    }
    return true;
  }
  let rem = sel;
  for (const nm of rem.matchAll(/:not\(\[([a-zA-Z0-9_-]+)(?:="([^"]*)")?\]\)/g)) {
    if (nm[2] !== undefined) { if (el.getAttribute(nm[1]) === nm[2]) return false; }
    else if (el.hasAttribute(nm[1])) return false;
  }
  let prevRem;
  do {
    prevRem = rem;
    rem = rem.replace(/:not\(\[[a-zA-Z0-9_-]+(?:="[^"]*")?\]\)/g, '');
  } while (rem !== prevRem);
  const tagM = rem.match(/^[a-zA-Z0-9-]+/);
  if (tagM) {
    if (el.tagName.toLowerCase() !== tagM[0].toLowerCase()) return false;
    rem = rem.slice(tagM[0].length);
  }
  const idM = rem.match(/#([a-zA-Z0-9_\\.-]+)/);
  if (idM) {
    if (el.id !== idM[1].replace(/\\/g, '')) return false;
    rem = rem.replace(idM[0], '');
  }
  for (const cm of rem.matchAll(/\.([a-zA-Z0-9_-]+)/g)) {
    if (!el.classList.contains(cm[1])) return false;
  }
  rem = rem.replace(/\.[a-zA-Z0-9_-]+/g, '');
  for (const am of rem.matchAll(/\[([a-zA-Z0-9_-]+)(?:(\^?=)"([^"]*)")?\]/g)) {
    if (!el.hasAttribute(am[1])) return false;
    if (am[3] !== undefined) {
      const val = el.getAttribute(am[1]) || '';
      if (am[2] === '^=') { if (!val.startsWith(am[3])) return false; }
      else if (val !== am[3]) return false;
    }
  }
  return true;
}

function matchesAny(el, selList) {
  for (const part of String(selList || '').split(',')) {
    if (part.trim() && matchesSingle(el, part.trim())) return true;
  }
  return false;
}

function createDomEnv(opts = {}) {
  let fakeNow = opts.startNow || 1000;
  let rafSeq = 0;
  let timerSeq = 0;
  const rafs = new Map();
  const timers = new Map();
  const winListeners = new Map();
  const docListeners = new Map();
  const winDispatched = [];
  const observers = [];

  function makeEl(tag, init = {}) {
    const attrs = new Map();
    const classes = new Set();
    const styleProps = new Map();
    const listeners = { capture: new Map(), bubble: new Map() };
    const children = [];
    let _text = init.text || '';
    let _rect = { left: 0, top: 0, width: 220, height: 28, right: 220, bottom: 28, ...(init.rect || {}) };
    const el = {
      nodeType: 1,
      tagName: String(tag || 'div').toUpperCase(),
      parentElement: null,
      parentNode: null,
      children,
      childNodes: children,
      isConnected: false,
      disabled: Boolean(init.disabled),
      value: init.value || '',
      _rectReads: 0,
      _offsetWidthReads: 0,
      _qsCalls: 0,
      _qsaCalls: 0,
      _styleSets: [],
      _dispatched: [],
      _clientWidth: init.clientWidth,
      _clientHeight: init.clientHeight,
      get _rect() { return _rect; },
      set _rect(v) { _rect = { ..._rect, ...v }; },
      get offsetWidth() { el._offsetWidthReads += 1; return el._clientWidth !== undefined ? el._clientWidth : _rect.width; },
      get clientWidth() { return el._clientWidth !== undefined ? el._clientWidth : _rect.width; },
      get clientHeight() { return el._clientHeight !== undefined ? el._clientHeight : _rect.height; },
      get offsetLeft() { return _rect.left; },
      style: {
        display: '',
        width: '',
        left: '',
        transform: '',
        opacity: '',
        color: '',
        background: '',
        fontWeight: '',
        animationDuration: '',
        animationDelay: '',
        setProperty(k, v) {
          styleProps.set(k, String(v));
          el._styleSets.push({ k, v: String(v) });
          this[k] = String(v);
        },
        getPropertyValue(k) { return styleProps.get(k) || ''; },
        removeProperty(k) { styleProps.delete(k); delete this[k]; },
      },
      classList: {
        add(...cs) { cs.forEach((c) => c && classes.add(c)); attrs.set('class', [...classes].join(' ')); },
        remove(...cs) { cs.forEach((c) => classes.delete(c)); attrs.set('class', [...classes].join(' ')); },
        contains: (c) => classes.has(c),
        toggle(c, force) {
          const on = force === undefined ? !classes.has(c) : Boolean(force);
          if (on) classes.add(c); else classes.delete(c);
          attrs.set('class', [...classes].join(' '));
          return on;
        },
      },
      get id() { return attrs.get('id') || ''; },
      set id(v) { if (v) attrs.set('id', String(v)); else attrs.delete('id'); },
      get className() { return [...classes].join(' '); },
      set className(v) {
        classes.clear();
        String(v || '').split(/\s+/).filter(Boolean).forEach((c) => classes.add(c));
        if (classes.size) attrs.set('class', [...classes].join(' '));
        else attrs.delete('class');
      },
      get firstChild() { return children[0] || null; },
      get firstElementChild() { return children[0] || null; },
      get nextSibling() {
        if (!el.parentElement) return null;
        const idx = el.parentElement.children.indexOf(el);
        return idx >= 0 ? el.parentElement.children[idx + 1] || null : null;
      },
      get nextElementSibling() { return el.nextSibling; },
      get textContent() {
        if (children.length && !_text) return children.map((c) => c.textContent).join('');
        return _text;
      },
      set textContent(v) {
        children.length = 0;
        _text = String(v ?? '');
      },
      get innerHTML() { return el._innerHTML || ''; },
      set innerHTML(v) {
        el._innerHTML = String(v || '');
        if (!v) { children.length = 0; _text = ''; }
      },
      setAttribute(k, v) { attrs.set(k, String(v)); if (k === 'class') el.className = String(v); },
      getAttribute(k) { return attrs.has(k) ? attrs.get(k) : null; },
      hasAttribute(k) { return attrs.has(k); },
      removeAttribute(k) { attrs.delete(k); if (k === 'class') el.className = ''; },
      appendChild(ch) {
        if (ch.parentElement) ch.parentElement.removeChild(ch);
        ch.parentElement = ch.parentNode = el;
        children.push(ch);
        const mark = (n, val) => { n.isConnected = val; for (const c of n.children || []) mark(c, val); };
        if (el.isConnected) mark(ch, true);
        return ch;
      },
      insertBefore(ch, ref) {
        if (!ref) return el.appendChild(ch);
        if (ch.parentElement) ch.parentElement.removeChild(ch);
        ch.parentElement = ch.parentNode = el;
        const idx = children.indexOf(ref);
        if (idx >= 0) children.splice(idx, 0, ch); else children.push(ch);
        const mark = (n, val) => { n.isConnected = val; for (const c of n.children || []) mark(c, val); };
        if (el.isConnected) mark(ch, true);
        return ch;
      },
      removeChild(ch) {
        const idx = children.indexOf(ch);
        if (idx >= 0) children.splice(idx, 1);
        ch.parentElement = ch.parentNode = null;
        const mark = (n) => { n.isConnected = false; for (const c of n.children || []) mark(c); };
        mark(ch);
        return ch;
      },
      remove() { if (el.parentElement) el.parentElement.removeChild(el); else el.isConnected = false; },
      contains(other) {
        let cur = other;
        while (cur) { if (cur === el) return true; cur = cur.parentElement; }
        return false;
      },
      closest(sel) {
        let cur = el;
        while (cur) { if (matchesAny(cur, sel)) return cur; cur = cur.parentElement; }
        return null;
      },
      querySelectorAll(sel) {
        el._qsaCalls += 1;
        const out = [];
        const walk = (n) => { for (const c of n.children) { if (matchesAny(c, sel)) out.push(c); walk(c); } };
        walk(el);
        return out;
      },
      querySelector(sel) { el._qsCalls += 1; return el.querySelectorAll(sel)[0] || null; },
      getBoundingClientRect() { el._rectReads += 1; return { ..._rect }; },
      addEventListener(type, fn, cap) {
        const b = cap === true || cap?.capture ? listeners.capture : listeners.bubble;
        if (!b.has(type)) b.set(type, []);
        b.get(type).push(fn);
      },
      removeEventListener(type, fn, cap) {
        const b = cap === true || cap?.capture ? listeners.capture : listeners.bubble;
        const arr = b.get(type);
        if (!arr) return;
        const idx = arr.indexOf(fn);
        if (idx >= 0) arr.splice(idx, 1);
      },
      dispatchEvent(ev) {
        el._dispatched.push(ev);
        ev.target = ev.target || el;
        ev.preventDefault = ev.preventDefault || (() => { ev.defaultPrevented = true; });
        ev.stopPropagation = ev.stopPropagation || (() => { ev._stopped = true; });
        ev.stopImmediatePropagation = ev.stopImmediatePropagation || (() => { ev._stopped = ev._imm = true; });
        for (const fn of [...(listeners.capture.get(ev.type) || [])]) fn(ev);
        for (const fn of [...(listeners.bubble.get(ev.type) || [])]) fn(ev);
        return !ev.defaultPrevented;
      },
      click() { el.dispatchEvent({ type: 'click' }); },
      focus() { el._focused = (el._focused || 0) + 1; },
      blur() {},
    };
    if (init.id) el.id = init.id;
    if (init.className) el.className = init.className;
    if (init.attrs) for (const [k, v] of Object.entries(init.attrs)) el.setAttribute(k, v);
    return el;
  }

  const html = makeEl('html', { attrs: { 'data-ag-cs-theme': 'dark', 'data-ag-cs-lang': 'ar', 'data-ag-cs-motion': 'ultra' } });
  html.isConnected = true;
  const head = makeEl('head');
  const body = makeEl('body');
  html.appendChild(head);
  html.appendChild(body);

  class FakeMO {
    constructor(cb) { this.cb = cb; this.disconnected = false; observers.push(this); }
    observe() {}
    disconnect() { this.disconnected = true; }
    takeRecords() { return []; }
    trigger(recs) { if (!this.disconnected) this.cb(recs, this); }
  }

  let execCommandHandler = opts.execCommand || (() => false);
  const execCalls = [];
  const doc = {
    hidden: false,
    documentElement: html,
    head,
    body,
    createElement: (tag) => makeEl(tag),
    createElementNS: (_ns, tag) => makeEl(tag),
    getElementById: (id) => html.querySelector(`#${id}`),
    querySelector: (sel) => html.querySelector(sel),
    querySelectorAll: (sel) => html.querySelectorAll(sel),
    addEventListener(t, fn) { if (!docListeners.has(t)) docListeners.set(t, []); docListeners.get(t).push(fn); },
    removeEventListener(t, fn) { const a = docListeners.get(t); if (a) { const i = a.indexOf(fn); if (i >= 0) a.splice(i, 1); } },
    getSelection: () => ({ isCollapsed: true, toString: () => '', removeAllRanges() {}, addRange() {} }),
    createRange: () => ({ selectNodeContents() {}, collapse() {} }),
    execCommand(cmd, ui, val) { execCalls.push({ cmd, ui, val }); return execCommandHandler(cmd, val); },
  };

  const win = {
    document: doc,
    location: { pathname: '/c/test-conv-beta3' },
    navigator: { language: 'ar' },
    performance: { now: () => fakeNow },
    MutationObserver: FakeMO,
    Event: class FakeEvent { constructor(t) { this.type = t; } },
    CustomEvent: class FakeCustomEvent { constructor(t, o) { this.type = t; this.detail = o?.detail; } },
    getComputedStyle: () => ({ backgroundColor: 'rgb(14, 14, 18)' }),
    matchMedia: () => ({ matches: false }),
    setTimeout: opts.virtualTimers
      ? (cb, ms = 0) => {
          const id = ++timerSeq;
          timers.set(id, { cb, dueAt: fakeNow + Math.max(0, Number(ms) || 0), delay: Number(ms) || 0 });
          return id;
        }
      : setTimeout,
    clearTimeout: opts.virtualTimers ? (id) => { timers.delete(id); } : clearTimeout,
    requestAnimationFrame(cb) {
      const id = ++rafSeq;
      rafs.set(id, cb);
      return id;
    },
    cancelAnimationFrame(id) {
      rafs.delete(id);
    },
    addEventListener(t, fn) { if (!winListeners.has(t)) winListeners.set(t, []); winListeners.get(t).push(fn); },
    removeEventListener(t, fn) { const a = winListeners.get(t); if (a) { const i = a.indexOf(fn); if (i >= 0) a.splice(i, 1); } },
    dispatchEvent(ev) {
      winDispatched.push(ev?.type || '');
      for (const fn of [...(winListeners.get(ev?.type) || [])]) fn(ev);
      return true;
    },
  };

  function flushRafs(dtMs = 16.67) {
    fakeNow += dtMs;
    const batch = [...rafs.entries()];
    rafs.clear();
    for (const [, cb] of batch) cb(fakeNow);
    return batch.length;
  }

  function flushTimers(dtMs = 0) {
    fakeNow += dtMs;
    let fired = 0;
    for (const [id, rec] of [...timers.entries()]) {
      if (rec.dueAt <= fakeNow) {
        timers.delete(id);
        rec.cb();
        fired += 1;
      }
    }
    return fired;
  }

  return {
    html, head, body, doc, win, makeEl, rafs, timers, observers, winDispatched, execCalls,
    setExecCommandHandler(fn) { execCommandHandler = fn; },
    getNow: () => fakeNow,
    advanceNow(ms) { fakeNow += ms; },
    flushRafs,
    flushTimers,
  };
}

// ── Test 1: Lexical async execCommand('insertText') single-path guard ───────
test('1. context-menu-btw: Lexical async execCommand("insertText") returning true writes /compact, /plan, /learn, /grill-me exactly once (zero double-write)', async () => {
  const env = createDomEnv();
  const box = env.makeEl('div', { attrs: { 'data-testid': 'agent-input-box' } });
  const ed = env.makeEl('div', { attrs: { contenteditable: 'true' }, text: '' });
  const sendBtn = env.makeEl('button', { attrs: { 'data-testid': 'input-send-button' } });
  let sendClicks = 0;
  sendBtn.addEventListener('click', () => { sendClicks += 1; });
  box.appendChild(ed);
  box.appendChild(sendBtn);
  env.body.appendChild(box);

  // Simulate real Lexical controlled contenteditable:
  // execCommand('insertText', false, text) returns true immediately,
  // while DOM textContent is asynchronously updated in a microtask!
  env.setExecCommandHandler((cmd, val) => {
    if (cmd !== 'insertText') return false;
    queueMicrotask(() => {
      ed.textContent = String(ed.textContent || '') + String(val);
    });
    return true;
  });

  const ctl = ctxMenuMod.createContextMenuController({
    doc: env.doc, win: env.win, nav: env.win.navigator, loc: env.win.location, stepDelayMs: 5,
  });

  const cases = [
    ['/compact', '', '/compact'],
    ['/plan', 'Refactor OAuth token refresh', '/plan\nRefactor OAuth token refresh'],
    ['/learn', 'Cache trackRect during drag', '/learn\nCache trackRect during drag'],
    ['/grill-me', 'Choose storage layout', '/grill-me\nChoose storage layout'],
  ];

  for (const [cmd, sel, expected] of cases) {
    ed.textContent = '';
    ed._dispatched.length = 0;
    const beforeClicks = sendClicks;
    const res = await ctl.triggerSlashCommand(cmd, sel);
    assert.equal(res.ok, true, `${cmd} must succeed`);
    assert.equal(res.command, cmd);
    assert.equal(ed.textContent, expected, `${cmd} must write once without doubling (got ${JSON.stringify(ed.textContent)})`);
    assert.equal(
      ed._dispatched.filter((e) => e.type === 'input').length,
      0,
      `${cmd} must NOT dispatch synthetic InputEvent when execCommand returned true`
    );
    assert.equal(sendClicks, beforeClicks + 1, `${cmd} must click send button once`);
  }

  // Fallback path when execCommand returns false or throws: still writes textContent + dispatches InputEvent
  env.setExecCommandHandler(() => { throw new Error('execCommand blocked'); });
  ed.textContent = '';
  ed._dispatched.length = 0;
  const fbRes = await ctl.triggerSlashCommand('/compact', '');
  assert.equal(fbRes.ok, true);
  assert.equal(ed.textContent, '/compact');
  assert.equal(ed._dispatched.filter((e) => e.type === 'input').length, 1, 'fallback path must dispatch InputEvent');

  ctl.destroy();
});

// ── Test 2: Pre-submit duplicate slash prefix guard ─────────────────────────
test('2. context-menu-btw: pre-submit duplicate slash guard aborts /compact/compact & /plan /plan without sending, while allowing valid quoted multiline text', async () => {
  const env = createDomEnv();
  const box = env.makeEl('div', { attrs: { 'data-testid': 'agent-input-box' } });
  const ed = env.makeEl('div', { attrs: { contenteditable: 'true' }, text: '' });
  const sendBtn = env.makeEl('button', { attrs: { 'data-testid': 'input-send-button' } });
  let sendClicks = 0;
  sendBtn.addEventListener('click', () => { sendClicks += 1; });
  box.appendChild(ed);
  box.appendChild(sendBtn);
  env.body.appendChild(box);

  const ctl = ctxMenuMod.createContextMenuController({
    doc: env.doc, win: env.win, nav: env.win.navigator, loc: env.win.location, stepDelayMs: 5,
  });

  // Simulate broken host duplicating the inserted command into /compact/compact
  env.setExecCommandHandler((cmd, val) => {
    if (cmd !== 'insertText') return false;
    ed.textContent = String(ed.textContent || '') + String(val) + String(val);
    return true;
  });
  const dup1 = await ctl.triggerSlashCommand('/compact', '');
  assert.equal(dup1.ok, false);
  assert.equal(dup1.reason, 'duplicate-command');
  assert.equal(sendClicks, 0, 'duplicate /compact/compact must NEVER click send');
  assert.equal(ed._dispatched.some((e) => e.type === 'keydown' && e.key === 'Enter'), false);

  // Space-separated duplicate /plan /plan is also blocked
  ed.textContent = '';
  env.setExecCommandHandler((cmd, val) => {
    if (cmd !== 'insertText') return false;
    ed.textContent = val === '/plan' ? '/plan /plan' : ed.textContent + val;
    return true;
  });
  const dup2 = await ctl.triggerSlashCommand('/plan', 'some quote');
  assert.equal(dup2.ok, false);
  assert.equal(dup2.reason, 'duplicate-command');
  assert.equal(sendClicks, 0, 'duplicate /plan /plan must NEVER click send');

  // Valid multiline quote starting with /plan on line 2 must NOT be falsely blocked
  ed.textContent = '';
  env.setExecCommandHandler((cmd, val) => {
    if (cmd !== 'insertText') return false;
    ed.textContent = String(ed.textContent || '') + String(val);
    return true;
  });
  const validRes = await ctl.triggerSlashCommand('/plan', '/plan details on second line');
  assert.equal(validRes.ok, true);
  assert.equal(sendClicks, 1);

  ctl.destroy();
});

// ── Test 3: Dragging zero reflow + single-rAF coalescing + compositor knob + zero offsetWidth ──
test('3. upstream-client: drag caches trackRect (0 rect reads on move, invalidates on resize), coalesces pointermove into 1 rAF, uses knob transform, zero offsetWidth reflows, no container double-write', () => {
  const env = createDomEnv();
  const rowEl = env.makeEl('div', { className: 'ces-ag-effort-row' });
  const valEl = env.makeEl('span', { className: 'ces-ag-effort-value' });
  const container = env.makeEl('div', { className: 'ces-inline' });
  rowEl.appendChild(valEl);
  rowEl.appendChild(container);
  env.body.appendChild(rowEl);

  let official = 'low';
  const commits = [];
  const mount = upstreamLib.mountCodexEffortSlider({
    container,
    row: rowEl,
    valueElement: valEl,
    document: env.doc,
    window: env.win,
    seat: {
      isClaude: false,
      locked: false,
      effortLevels: [
        { effort: 'low', label: 'Low' },
        { effort: 'medium', label: 'Medium' },
        { effort: 'high', label: 'High' },
        { effort: 'xhigh', label: 'Extra' },
      ],
      get currentEffort() { return official; },
      selectEffort(item) {
        const eff = typeof item === 'string' ? item : item.effort;
        commits.push(eff);
        official = eff;
      },
    },
  });

  const track = container.querySelector('.ces-track');
  const knob = container.querySelector('.ces-knob');
  track._rect = { left: 0, top: 0, width: 220, height: 28, right: 220, bottom: 28 };
  track._rectReads = 0;
  valEl._offsetWidthReads = 0;

  // Container must NOT be double-written with data-energy / --ces-energy / data-theme
  assert.equal(container.hasAttribute('data-energy'), false, 'container must not be double-written with data-energy');
  assert.equal(container.hasAttribute('data-theme'), false, 'container must not be double-written with data-theme');
  assert.equal(container.style.getPropertyValue('--ces-energy'), '', 'container must not be double-written with --ces-energy');

  // Pointerdown caches trackRect exactly once
  track.dispatchEvent({ type: 'pointerdown', button: 0, clientX: 14, pointerId: 1 });
  assert.equal(track._rectReads, 1, 'onPointerDown must read trackRect exactly once');

  // 25 rapid pointermove events within a single frame
  track._styleSets.length = 0;
  for (let i = 1; i <= 25; i++) {
    const cx = 14 + Math.round((192 * i) / 25);
    track.dispatchEvent({ type: 'pointermove', buttons: 1, clientX: cx, pointerId: 1 });
  }
  assert.equal(track._rectReads, 1, '25 pointermove events must perform 0 additional getBoundingClientRect() calls');
  const fillWritesBeforeRaf = track._styleSets.filter((s) => s.k === '--ces-fill').length;
  assert.equal(fillWritesBeforeRaf, 0, 'pointermove visual updates must be coalesced into rAF, not written synchronously per move');
  assert.equal(valEl.textContent, 'Extra', 'value label must still reflect tier jump immediately');
  assert.equal(valEl._offsetWidthReads, 0, 'rapid tier switches must trigger 0 synchronous offsetWidth forced reflows');

  // Single rAF flush paints visual exactly once and uses compositor transform on knob
  env.flushRafs(16.67);
  const fillWritesAfterRaf = track._styleSets.filter((s) => s.k === '--ces-fill').length;
  assert.equal(fillWritesAfterRaf, 1, '25 coalesced pointermove events must produce exactly 1 --ces-fill write per frame');
  assert.match(knob.style.transform, /^translate3d\([\d.]+px,0,0\)$/, 'knob must use compositor translate3d during drag');
  assert.equal(knob.style.left, '0px', 'knob must pin left:0px while translate3d is active');

  // Pointerup commits once and restores responsive CSS left positioning
  track.dispatchEvent({ type: 'pointerup', button: 0, clientX: 206, pointerId: 1 });
  assert.deepEqual(commits, ['xhigh']);
  assert.equal(knob.style.transform, '', 'knob transform must reset after pointerup');
  assert.equal(knob.style.left, '', 'knob left must reset to responsive CSS var(--ces-fill) after pointerup');
  assert.equal(valEl._offsetWidthReads, 0, 'triggerMaxEffects must also perform 0 synchronous offsetWidth forced reflows');

  // Resize invalidates cached rect on next drag
  track._rect = { left: 10, top: 0, width: 320, height: 28, right: 330, bottom: 28 };
  env.win.dispatchEvent(new env.win.Event('resize'));
  const readsBeforeSecondDrag = track._rectReads;
  track.dispatchEvent({ type: 'pointerdown', button: 0, clientX: 24, pointerId: 2 });
  assert.equal(track._rectReads, readsBeforeSecondDrag + 1, 'resize must invalidate cached rect for next drag');
  track.dispatchEvent({ type: 'pointerup', button: 0, clientX: 24, pointerId: 2 });

  mount.unmount();
});

// ── Test 4: Dragging zero 500-layer Fiber walk & full-menu QSA + zero mount resize storm ──
test('4. upstream-client: mounting emits 0 global window resize events; dragging executes 0 Fiber walks, 0 panel QSA scans, and defers heavy _syncAgDom to pointerup', () => {
  const env = createDomEnv();
  const optLow = { label: 'Gemini 4 Carbon (Low)', modelId: 'c-low', value: 1 };
  const optMed = { label: 'Gemini 4 Carbon (Medium)', modelId: 'c-med', value: 2 };
  const optHigh = { label: 'Gemini 4 Carbon (High)', modelId: 'c-high', value: 3 };
  let selected = optLow;
  let commitCalls = 0;

  const panel = env.makeEl('div', { attrs: { 'data-testid': 'model-selector-panel' } });
  const listWrap = env.makeEl('div');
  const rowItem = env.makeEl('div', { attrs: { role: 'menuitem' } });
  const grpSpan = env.makeEl('span', { attrs: { 'data-testid': 'model-selector-effort-group', 'data-model-base': 'Gemini 4 Carbon' }, text: 'Gemini 4 Carbon' });
  const effSpan = env.makeEl('span', { text: 'Low' });
  rowItem.appendChild(grpSpan);
  rowItem.appendChild(effSpan);
  listWrap.appendChild(rowItem);
  panel.appendChild(listWrap);
  env.body.appendChild(panel);

  // Build 120-layer Fiber chain with access counter
  let fiberWalkSteps = 0;
  const providerVal = {
    effortIndex: new Map([['Gemini 4 Carbon', new Map([['low', optLow], ['medium', optMed], ['high', optHigh]])]]),
    modelOptions: [optLow, optMed, optHigh],
    get selectedModel() { return selected; },
    setModelConfigByLabelForConversation(lbl) {
      commitCalls += 1;
      selected = [optLow, optMed, optHigh].find((o) => o.label === lbl) || selected;
    },
  };
  let cur = { memoizedProps: { value: providerVal }, return: null };
  for (let i = 0; i < 120; i++) {
    const parent = cur;
    cur = {
      get memoizedProps() { fiberWalkSteps += 1; return {}; },
      return: parent,
    };
  }
  panel.__reactFiber$beta3 = cur;

  env.winDispatched.length = 0;
  const inst = upstreamLib.installCodexEffortSlider({
    document: env.doc,
    window: env.win,
    skipGenericMenuObserver: true,
  });

  // 1) Mounting MUST emit ZERO global window resize events
  assert.equal(
    env.winDispatched.filter((t) => t === 'resize').length,
    0,
    'Mounting effort slider must NEVER dispatch global window resize event'
  );

  const track = panel.querySelector('.ces-track');
  const valEl = panel.querySelector('.ces-ag-effort-value');
  assert.ok(track && valEl);

  // Start drag
  track.dispatchEvent({ type: 'pointerdown', button: 0, clientX: 14, pointerId: 1 });
  const fiberAfterDown = fiberWalkSteps;
  const qsaAfterDown = panel._qsaCalls;

  // 20 rapid pointermove events (both intra-tier micro-moves & cross-tier jumps) + rAF flushes
  for (let i = 1; i <= 20; i++) {
    track.dispatchEvent({ type: 'pointermove', buttons: 1, clientX: 14 + i * 9, pointerId: 1 });
    if (i % 5 === 0) env.flushRafs(16.67);
  }
  assert.equal(fiberWalkSteps, fiberAfterDown, 'Dragging (pointermove + rAF visual) must perform 0 React Fiber walks');
  assert.equal(panel._qsaCalls, qsaAfterDown, 'Dragging must perform 0 full-panel querySelectorAll scans');
  assert.equal(commitCalls, 0, 'Dragging must not commit before pointerup');
  assert.equal(valEl.textContent, 'High', 'Lightweight value label must update across tier jumps during drag');

  // Pointerup triggers single commit & deferred heavy _syncAgDom
  track.dispatchEvent({ type: 'pointerup', button: 0, clientX: 206, pointerId: 1 });
  assert.equal(commitCalls, 1, 'pointerup must commit once');
  assert.equal(selected, optHigh);
  assert.equal(effSpan.textContent, 'High', 'Heavy _syncAgDom must sync menu row effort label on pointerup');

  inst.stop();
});

// ── Test 5: Claude dither canvas HiDPI + fillRect + fixed backing store + idle timer throttle + motion=off 0fps ──
test('5. upstream-client: Claude paintDither uses fillRect (0 quadraticCurveTo) + precomputed light LUT; stepClaudeCanvas renders crisp HiDPI inside .ces-fill, paces idle via setTimeout (0 idle rAF churn), and enforces 0fps in motion=off', () => {
  const env = createDomEnv({ virtualTimers: true });
  let fillRectCalls = 0;
  let bezierCalls = 0;
  let clipCalls = 0;
  let widthWrites = 0;
  const transformArgs = [];
  const lightFillStyles = new Set();
  const darkFillStyles = new Set();

  const makeMockCtx = (styleBag) => ({
    globalAlpha: 1,
    _fs: '',
    get fillStyle() { return this._fs; },
    set fillStyle(v) { this._fs = String(v); styleBag.add(this._fs); },
    clearRect() {},
    createLinearGradient: () => ({ addColorStop() {} }),
    fillRect(_x, _y, w, h) { if (w < 20 && h < 20) fillRectCalls += 1; },
    setTransform(...args) { transformArgs.push(args); },
    save() {},
    restore() {},
    beginPath() {},
    rect() {},
    clip() { clipCalls += 1; },
    quadraticCurveTo() { bezierCalls += 1; },
  });

  // 1) Direct paintDither verification (dark & light)
  const darkCtx = makeMockCtx(darkFillStyles);
  upstreamLib.paintDither(darkCtx, 220, 28, true, 1, 0.5, 1);
  assert.ok(fillRectCalls > 100, `Expected >100 fillRect cells in dark mode, got ${fillRectCalls}`);
  assert.equal(bezierCalls, 0, 'paintDither must use fillRect instead of quadraticCurveTo bezier paths');
  assert.ok(darkFillStyles.has('rgb(208,192,246)') && darkFillStyles.has('rgb(220, 204, 255)'));

  const beforeLight = fillRectCalls;
  const lightCtx = makeMockCtx(lightFillStyles);
  upstreamLib.paintDither(lightCtx, 220, 28, false, 1, 0.5, 1);
  assert.ok(fillRectCalls - beforeLight > 50, 'Light mode paintDither must paint cells via fillRect');
  assert.equal(bezierCalls, 0);
  assert.ok([...lightFillStyles].some((s) => /^rgb\(\d+,\d+,\d+\)$/.test(s)), 'Light mode must paint via precomputed rgb LUT');

  // 2) HiDPI backing store inside .ces-fill + fixed backing store on drag + idle timer pacing + motion=off 0fps
  const origCreateEl = env.doc.createElement;
  let canvasCtx = null;
  let canvasEl = null;
  env.doc.createElement = (tag) => {
    const node = origCreateEl(tag);
    if (String(tag).toLowerCase() === 'canvas') {
      let _w = 280;
      let _h = 28;
      Object.defineProperty(node, 'width', {
        get() { return _w; },
        set(v) { widthWrites += 1; _w = v; },
      });
      Object.defineProperty(node, 'height', {
        get() { return _h; },
        set(v) { _h = v; },
      });
      canvasCtx = makeMockCtx(darkFillStyles);
      node.getContext = () => canvasCtx;
      canvasEl = node;
    }
    return node;
  };

  let curEffort = 'high';
  let seatSub = null;
  const container = env.makeEl('div', { className: 'ces-inline' });
  env.body.appendChild(container);
  const mount = upstreamLib.mountCodexEffortSlider({
    container,
    document: env.doc,
    window: env.win,
    seat: {
      isClaude: true,
      theme: 'claude',
      locked: false,
      effortLevels: [
        { effort: 'low', label: 'Low' },
        { effort: 'medium', label: 'Medium' },
        { effort: 'high', label: 'High' },
      ],
      get currentEffort() { return curEffort; },
      selectEffort(item) { curEffort = typeof item === 'string' ? item : item.effort; },
      subscribe(fn) { seatSub = fn; return () => { seatSub = null; }; },
    },
  });

  const track = container.querySelector('.ces-track');
  const fillEl = container.querySelector('.ces-fill');
  assert.equal(canvasEl.parentNode, fillEl, 'Claude canvas must be mounted inside .ces-fill so overflow:hidden clips cleanly');
  track._rect = { left: 0, top: 0, width: 220, height: 28, right: 220, bottom: 28 };
  widthWrites = 0;
  clipCalls = 0;

  // Initial paint at dpr=1 sets backing store width once to trackW (220)
  env.flushRafs(20);
  assert.equal(canvasEl.width, 220, 'Canvas backing store width must match fixed trackW at dpr=1');
  assert.equal(canvasEl.height, 28);
  assert.equal(canvasEl.style.width, '220px');
  assert.equal(canvasEl.style.height, '28px');
  assert.equal(widthWrites, 1, 'Canvas backing store should allocate width once');
  assert.deepEqual(transformArgs.at(-1), [1, 0, 0, 1, 0, 0]);

  // HiDPI verification: dpr = 1.5 and dpr = 2 scale backing store while pinning CSS dimensions
  env.win.devicePixelRatio = 1.5;
  env.flushRafs(20);
  assert.equal(canvasEl.width, Math.round(220 * 1.5), 'dpr=1.5 backing store width must equal Math.round(fullW * 1.5)');
  assert.equal(canvasEl.height, Math.round(28 * 1.5), 'dpr=1.5 backing store height must equal Math.round(th * 1.5)');
  assert.equal(canvasEl.style.width, '220px', 'CSS width must stay fixed at fullW px');
  assert.equal(canvasEl.style.height, '28px', 'CSS height must stay fixed at th px');
  assert.deepEqual(transformArgs.at(-1), [1.5, 0, 0, 1.5, 0, 0], 'cctx.setTransform(dpr,0,0,dpr,0,0) must run before paint');

  env.win.devicePixelRatio = 2;
  env.flushRafs(20);
  assert.equal(canvasEl.width, 440, 'dpr=2 backing store width must equal 440');
  assert.equal(canvasEl.height, 56, 'dpr=2 backing store height must equal 56');
  assert.equal(canvasEl.style.width, '220px');
  assert.equal(canvasEl.style.height, '28px');
  assert.deepEqual(transformArgs.at(-1), [2, 0, 0, 2, 0, 0]);

  // Dragging across 10 positions at dpr=2 must perform 0 backing store width reallocations and use clip
  const writesBeforeDrag = widthWrites;
  track.dispatchEvent({ type: 'pointerdown', button: 0, clientX: 160, pointerId: 1 });
  for (let i = 0; i < 10; i++) {
    track.dispatchEvent({ type: 'pointermove', buttons: 1, clientX: 110 + i * 8, pointerId: 1 });
    env.flushRafs(20);
  }
  assert.equal(widthWrites, writesBeforeDrag, 'Dragging must NOT reallocate canvas.width on every pixel move');
  assert.ok(clipCalls >= 5, 'Partial-width draw must clip cleanly on fixed backing store');
  track.dispatchEvent({ type: 'pointerup', button: 0, clientX: 206, pointerId: 1 });

  // After sweep finishes (progress >= 1) and idle at high tier, uses 32ms setTimeout pacing with ZERO idle rAF churn
  env.advanceNow(2000);
  env.flushRafs(40);
  const paintsAtIdle = fillRectCalls;
  assert.equal(env.rafs.size, 0, 'Idle high-tier Claude canvas must NOT spin rAF every VSync frame');
  assert.equal(env.timers.size, 1, 'Idle high-tier Claude canvas must schedule a 32ms setTimeout');
  assert.equal([...env.timers.values()][0].delay, 32);

  // 18ms later: timer has not fired yet -> 0 paints, 0 rAF
  env.flushTimers(18);
  env.flushRafs(0);
  assert.equal(fillRectCalls, paintsAtIdle, 'Idle high-tier Claude canvas must skip 18ms tick');
  assert.equal(env.rafs.size, 0);

  // Past 32ms gap: timer queues 1 rAF -> resumes painting cleanly and sleeps again
  env.flushTimers(16);
  assert.equal(env.rafs.size, 1, 'Timer expiry must schedule exactly 1 VSync-aligned rAF');
  env.flushRafs(1);
  assert.ok(fillRectCalls > paintsAtIdle, 'Idle high-tier Claude canvas must resume painting past 32ms gap');
  assert.equal(env.rafs.size, 0, 'Must return to setTimeout sleep immediately after idle paint');

  // Medium tier (claudeIntensity < 0.7) uses 50ms idle pacing
  curEffort = 'medium';
  env.html.setAttribute('data-ag-cs-motion', 'ultra');
  seatSub?.();
  env.flushTimers(50);
  env.flushRafs(60);
  // Settle motion spring to medium if still stepping
  for (let k = 0; k < 20 && env.rafs.size > 0; k++) env.flushRafs(20);
  env.flushTimers(60);
  env.flushRafs(60);
  if (env.timers.size > 0) {
    assert.equal([...env.timers.values()][0].delay, 50, 'Medium-tier idle Claude canvas must pace at 50ms');
  }

  // motion="off" enforces strict 0fps halt (0 pending rAFs AND 0 pending timers)
  env.html.setAttribute('data-ag-cs-motion', 'off');
  const paintsBeforeOff = fillRectCalls;
  env.flushTimers(100);
  env.flushRafs(60);
  assert.equal(fillRectCalls, paintsBeforeOff, 'motion="off" must paint 0 frames');
  assert.equal(env.rafs.size, 0, 'motion="off" must leave 0 pending Claude canvas rAFs');
  assert.equal(env.timers.size, 0, 'motion="off" must leave 0 pending Claude canvas timers');

  mount.unmount();
  assert.equal(env.rafs.size, 0);
  assert.equal(env.timers.size, 0);
});

// ── Test 6: slider-coexist anti-self-MO + model-glyph-crystal knob rect cache + Channel 1 budget ──
test('6. slider-coexist skips self-injected glyphs/owned nodes in open menu, model-glyph-crystal caches knob rect, and Channel 1 stays < 685,000 B', () => {
  const env = createDomEnv();
  const panel = env.makeEl('div', { attrs: { 'data-testid': 'model-selector-panel' } });
  const row = env.makeEl('div', { attrs: { role: 'menuitem' } });
  const grp = env.makeEl('span', { attrs: { 'data-testid': 'model-selector-effort-group', 'data-model-base': 'Gemini 4 Carbon' }, text: 'Gemini 4 Carbon' });
  row.appendChild(grp);
  panel.appendChild(row);
  env.body.appendChild(panel);

  const ctl = sliderCoexist.createEffortSliderController({ window: env.win, document: env.doc });
  ctl.sync({ effortSliderModule: 'on' });
  const mo = env.observers[0];
  const baseScans = ctl.getState().perfStats.executedScans;

  // 1) Self-injected .ag-cs-panel-row-glyph & [data-ag-owned="1"] inserted into open menu row -> 0 rescans
  const glyph = env.makeEl('span', { className: 'ag-cs-model-glyph ag-cs-panel-row-glyph', attrs: { 'data-ag-owned': '1' } });
  const ownedBar = env.makeEl('div', { attrs: { 'data-ag-owned': '1' } });
  const cesSec = env.makeEl('div', { className: 'ces-ag-section' });
  const unrelatedDiv = env.makeEl('div');
  env.body.appendChild(unrelatedDiv);

  for (let i = 0; i < 20; i++) {
    mo.trigger([{ type: 'childList', target: row, addedNodes: [glyph], removedNodes: [] }]);
    mo.trigger([{ type: 'childList', target: panel, addedNodes: [ownedBar], removedNodes: [] }]);
    mo.trigger([{ type: 'childList', target: panel, addedNodes: [cesSec], removedNodes: [] }]);
    mo.trigger([{ type: 'childList', target: unrelatedDiv, addedNodes: [], removedNodes: [] }]);
  }
  assert.equal(ctl.getState().perfStats.executedScans, baseScans, 'Self-injected glyphs, ces-ag-section & unrelated nodes must trigger 0 rescans while menu is open');

  // Genuine submenu [role="menu"] insertion MUST still trigger immediate scan
  const subMenu = env.makeEl('div', { attrs: { role: 'menu' } });
  mo.trigger([{ type: 'childList', target: env.body, addedNodes: [subMenu], removedNodes: [] }]);
  assert.equal(ctl.getState().perfStats.executedScans, baseScans + 1, 'Genuine submenu insertion must still trigger scan');
  ctl.destroy();

  // 2) model-glyph-crystal caches knob getBoundingClientRect() during high-frequency pointer moves
  const mgcEnv = createDomEnv();
  mgcEnv.html.setAttribute('data-ag-cs-ambient', '1');
  const mPanel = mgcEnv.makeEl('div', { attrs: { 'data-testid': 'model-selector-panel', 'data-ces-orch-tunable': 'true' } });
  const orchRow = mgcEnv.makeEl('div', { attrs: { role: 'menuitem', 'data-testid': 'model-selector-orchestrator', 'data-ces-model-selected': 'true' }, text: 'Orchestrator' });
  const sec = mgcEnv.makeEl('div', { className: 'ces-ag-section' });
  const effRow = mgcEnv.makeEl('div', { className: 'ces-ag-effort-row' });
  const trk = mgcEnv.makeEl('div', { className: 'ces-track' });
  trk.style.setProperty('--ces-fill', 'calc(14px + (100% - 28px) * 0.5)');
  const knob = mgcEnv.makeEl('div', { className: 'ces-knob', rect: { left: 100, top: 100, width: 20, height: 20, right: 120, bottom: 120 } });
  trk.appendChild(knob);
  effRow.appendChild(trk);
  sec.appendChild(effRow);
  mPanel.appendChild(orchRow);
  mPanel.appendChild(sec);
  mgcEnv.body.appendChild(mPanel);

  const prevDoc = globalThis.document;
  const prevPerf = globalThis.performance;
  const prevRaf = globalThis.requestAnimationFrame;
  const prevCaf = globalThis.cancelAnimationFrame;
  globalThis.document = mgcEnv.doc;
  globalThis.performance = mgcEnv.win.performance;
  globalThis.requestAnimationFrame = mgcEnv.win.requestAnimationFrame;
  globalThis.cancelAnimationFrame = mgcEnv.win.cancelAnimationFrame;
  try {
    const mCtl = mgcMod.createModelGlyphCrystalController({
      animatedIcons: null,
      crystalPrismCore: {
        mountCrystalPrismBar() {
          return { setReduceMotion() {}, setPointerClient() {}, wake() {}, step() {}, isIdle: () => true, dispose() {} };
        },
      },
      isDestroyed: () => false,
      isComposerRestyleEnabled: () => true,
      isZh: () => true,
      isDarkTheme: () => true,
      motionReduced: () => false,
      getMinFrameGapMs: () => 0,
      canMountRealCanvas: () => true,
      getLastPointerPos: () => ({ x: 110, y: 110 }),
      setAttrIfChanged: (el, k, v) => el.setAttribute(k, v),
    });
    mCtl.syncModelSelectorPanel({ brand: 'antigravity', tier: 'auto', isOrchestrator: true });
    mgcEnv.flushRafs(16);
    const readsAfterMount = knob._rectReads;
    assert.equal(readsAfterMount, 1, 'Initial mount reads knob rect once');

    // 25 pointer moves within 100ms while --ces-fill is unchanged -> 0 additional rect reads
    for (let i = 0; i < 25; i++) {
      mgcEnv.advanceNow(3);
      mCtl.setCrystalPointerClient(105 + (i % 10), 108);
    }
    assert.equal(knob._rectReads, readsAfterMount, '25 pointer moves within 120ms TTL must hit cached knob rect (0 extra getBoundingClientRect)');

    // Updating --ces-fill invalidates knob rect cache immediately
    trk.style.setProperty('--ces-fill', 'calc(14px + (100% - 28px) * 1)');
    mCtl.setCrystalPointerClient(112, 112);
    assert.equal(knob._rectReads, readsAfterMount + 1, 'Changing --ces-fill must invalidate knob rect cache');
    mCtl.teardownCrystalMount();
  } finally {
    globalThis.document = prevDoc;
    globalThis.performance = prevPerf;
    globalThis.requestAnimationFrame = prevRaf;
    globalThis.cancelAnimationFrame = prevCaf;
  }

  // 3) Channel 1 bundle stays strictly < 685,000 B & parses cleanly
  const expr = cdp.buildInjectExpression(cdp.DEFAULT_CONFIG);
  const bytes = Buffer.byteLength(expr, 'utf8');
  assert.ok(bytes < 685000, `Channel 1 bundle must stay < 685,000 B, got ${bytes} B`);
  assert.doesNotThrow(() => new vm.Script(expr), 'Channel 1 bundle must parse cleanly');
});

// ── Test 7: P1-2 Orchestrator L2 planner switch syncs brand color, crystal bar & __agPrism.sync() ──
test('7. upstream-client (P1-2): Orchestrator L2 planner switch triggers __agPrism.sync() and restores orchestrator-effort-bar when switching back to non-tunable planner', () => {
  const env = createDomEnv();
  let prismSyncCalls = 0;
  env.win.__agPrism = { sync() { prismSyncCalls += 1; } };

  const neonLow = { label: 'Gemini 4 Neon (Low)', modelId: 'n-low', value: 11 };
  const neonHigh = { label: 'Gemini 4 Neon (High)', modelId: 'n-high', value: 12 };
  const opusLow = { label: 'Claude Opus 5.5 (Low)', modelId: 'c-low', value: 21 };
  const opusHigh = { label: 'Claude Opus 5.5 (High)', modelId: 'c-high', value: 22 };
  const autoSingle = { label: 'Gemini Auto', modelId: 'g-auto', value: 31 };
  const orchOpt = { label: 'Orchestrator', modelId: 'orch', value: 100 };
  const planners = [neonLow, neonHigh, opusLow, opusHigh, autoSingle];
  const plannerIdx = new Map([
    ['gemini-4-neon', new Map([['low', neonLow], ['high', neonHigh]])],
    ['claude-opus-5-5', new Map([['low', opusLow], ['high', opusHigh]])],
  ]);

  let selectedModel = orchOpt;
  const selectorCtx = {
    effortIndex: plannerIdx,
    modelOptions: [...planners, orchOpt],
    get selectedModel() { return selectedModel; },
    orchestratorPlanners: planners,
    orchestratorPlannerIndex: plannerIdx,
    orchestratorDefaultPlanner: neonHigh,
    orchestratorPick: {
      model: neonHigh.value,
      select(v) { this.model = v; },
    },
    setModelConfigByLabelForConversation(lbl) {
      selectedModel = [orchOpt, ...planners].find((o) => o.label === lbl) || selectedModel;
    },
  };

  const trigger = env.makeEl('button', { attrs: { 'data-testid': 'model-selector-trigger' } });
  const trigSpan = env.makeEl('span', { className: 'min-w-0', text: 'Orchestrator' });
  trigger.appendChild(trigSpan);
  env.body.appendChild(trigger);

  const panel = env.makeEl('div', { attrs: { 'data-testid': 'model-selector-panel' } });
  const listWrap = env.makeEl('div');
  const orchRow = env.makeEl('div', { attrs: { role: 'menuitem', 'data-testid': 'model-selector-orchestrator' }, text: 'Orchestrator' });
  listWrap.appendChild(orchRow);
  panel.appendChild(listWrap);
  // Pre-existing crystal Auto bar (created by model-glyph-crystal.js in live runtime)
  const orchBar = env.makeEl('div', { attrs: { 'data-testid': 'orchestrator-effort-bar', 'data-row-hidden': 'false', 'aria-hidden': 'false' } });
  panel.appendChild(orchBar);
  env.body.appendChild(panel);
  panel.__reactFiber$p12 = { memoizedProps: { value: selectorCtx }, return: null };

  const inst = upstreamLib.installAntigravityObserver({ document: env.doc, window: env.win, MutationObserver: env.win.MutationObserver });
  const activeRow = panel.querySelector('.ces-ag-effort-row');
  assert.ok(activeRow, 'slider row must mount');
  assert.equal(trigger.getAttribute('data-ces-orch-b'), 'gemini');
  assert.equal(panel.getAttribute('data-ces-orch-tunable'), 'true');
  assert.equal(activeRow.getAttribute('data-row-hidden'), 'false');
  assert.equal(orchBar.getAttribute('data-row-hidden'), 'true');

  // Mount L2 submenu with Claude planner and non-tunable Gemini Auto planner
  const subOverlay = env.makeEl('div', { className: 'agy-overlay' });
  const subMenu = env.makeEl('div', { attrs: { role: 'menu' } });
  const subNeon = env.makeEl('div', { attrs: { role: 'menuitemradio' }, text: 'Gemini 4 Neon High' });
  const subClaude = env.makeEl('div', { attrs: { role: 'menuitemradio' }, text: 'Claude Opus 5.5 High' });
  const subAuto = env.makeEl('div', { attrs: { role: 'menuitemradio' }, text: 'Gemini Auto' });
  subMenu.appendChild(subNeon);
  subMenu.appendChild(subClaude);
  subMenu.appendChild(subAuto);
  subOverlay.appendChild(subMenu);
  env.body.appendChild(subOverlay);
  inst.rescan();

  // 1) Switch Orchestrator planner from Gemini -> Claude while staying in Orchestrator mode (a.need === false)
  const syncBeforeClaude = prismSyncCalls;
  subMenu.dispatchEvent({ type: 'click', target: subClaude });
  assert.equal(trigger.getAttribute('data-ces-orch-b'), 'claude', 'Trigger brand attr must switch to claude immediately');
  assert.equal(panel.getAttribute('data-ces-orch-tunable'), 'true');
  assert.ok(prismSyncCalls > syncBeforeClaude, 'onCk must invoke win.__agPrism.sync() to refresh trigger badge & crystal bar');

  // 2) Adjusting effort via selectEffort (keyboard Home) must also invoke win.__agPrism.sync()
  const syncBeforeEff = prismSyncCalls;
  const sliderRoot = panel.querySelector('.ces-root');
  sliderRoot.dispatchEvent({ type: 'keydown', key: 'Home' });
  assert.ok(prismSyncCalls > syncBeforeEff, 'selectEffort must invoke win.__agPrism.sync()');

  // 3) Switch back from tunable Claude planner to non-tunable single-tier Gemini Auto planner
  const syncBeforeAuto = prismSyncCalls;
  subMenu.dispatchEvent({ type: 'click', target: subAuto });
  assert.equal(panel.hasAttribute('data-ces-orch-tunable'), false, 'data-ces-orch-tunable must be removed for non-tunable planner');
  assert.equal(panel.getAttribute('data-ag-cs-orch-active'), '1', 'data-ag-cs-orch-active must be restored for crystal Auto bar');
  assert.equal(orchBar.getAttribute('data-row-hidden'), 'false', 'orchestrator-effort-bar must be unhidden when switching to Auto planner');
  assert.equal(orchBar.getAttribute('aria-hidden'), 'false');
  assert.equal(activeRow.getAttribute('data-row-hidden'), 'true', 'slider row must be hidden when switching to non-tunable Auto planner');
  assert.equal(activeRow.getAttribute('aria-hidden'), 'true');
  assert.ok(prismSyncCalls > syncBeforeAuto, 'switching to Auto planner must invoke win.__agPrism.sync()');

  inst.stop();
});

// ── Test 8: P2-1 entry scale(.965) drag width + window blur cancel, P1-3 slider-coexist MDL_SEL, P1-5 ui-runtime title scan ──
test('8. P2-1/P1-3/P1-5 regressions: drag translate3d uses trackEl.clientWidth under scale(.965) + cancels on window blur; slider-coexist accepts fallback trigger & context-menu-submenu-popup; ui-runtime triggers title scan on flags.s/g/o', () => {
  // (a) P2-1: Entry animation scale(0.965) yields smaller boundingClientRect.width (212.3) than layout clientWidth (220)
  const env = createDomEnv();
  const container = env.makeEl('div', { className: 'ces-inline' });
  env.body.appendChild(container);
  const mount = upstreamLib.mountCodexEffortSlider({
    container,
    document: env.doc,
    window: env.win,
    seat: {
      isClaude: false,
      locked: false,
      effortLevels: [
        { effort: 'low', label: 'Low' },
        { effort: 'high', label: 'High' },
      ],
      currentEffort: 'low',
      selectEffort() {},
    },
  });
  const track = container.querySelector('.ces-track');
  const knob = container.querySelector('.ces-knob');
  track._clientWidth = 220;
  track._rect = { left: 10, top: 0, width: 212.3, height: 27, right: 222.3, bottom: 27 };

  // Pointer down & drag to visual right end (p = 1) -> translate3d must use layout clientWidth 220 -> 206.0px (NOT scaled 198.3px)
  track.dispatchEvent({ type: 'pointerdown', button: 0, clientX: 10 + 14, pointerId: 1 });
  track.dispatchEvent({ type: 'pointermove', buttons: 1, clientX: 10 + 212.3 - 14, pointerId: 1 });
  env.flushRafs(16.67);
  assert.equal(knob.style.transform, 'translate3d(206.0px,0,0)', 'translate3d must use unscaled trackEl.clientWidth under scale(.965)');

  // Window blur while dragging cancels drag cleanly and resets knob positioning
  env.win.dispatchEvent(new env.win.Event('blur'));
  assert.equal(knob.style.transform, '', 'window blur must cancel active drag and clear knob transform');
  assert.equal(knob.style.left, '', 'window blur must clear knob left override');
  mount.unmount();

  // (b) P1-3: slider-coexist MDL_SEL covers fallback button[aria-label^="Select model"] & [data-testid="context-menu-submenu-popup"]
  const cEnv = createDomEnv();
  const fbTrig = cEnv.makeEl('button', { attrs: { 'aria-label': 'Select model: Claude' }, text: 'Claude Opus 4.6 (Medium)' });
  cEnv.body.appendChild(fbTrig);
  const ctl = sliderCoexist.createEffortSliderController({ window: cEnv.win, document: cEnv.doc });
  ctl.sync({ effortSliderModule: 'on' });
  const mo = cEnv.observers[0];
  const baseScans = ctl.getState().perfStats.executedScans;

  // characterData mutation on text node inside fallback Select model button must NOT be dropped
  const fakeTextNode = { nodeType: 3, parentElement: fbTrig };
  mo.trigger([{ type: 'characterData', target: fakeTextNode, addedNodes: [], removedNodes: [] }]);
  assert.equal(ctl.getState().perfStats.executedScans, baseScans + 1, 'Fallback Select model trigger characterData mutation must pass touchesModel');

  // Open model menu, then insert portal submenu with ONLY data-testid="context-menu-submenu-popup" (no role="menu" / .agy-overlay)
  const mPanel = cEnv.makeEl('div', { attrs: { 'data-testid': 'model-selector-panel' } });
  cEnv.body.appendChild(mPanel);
  mo.trigger([{ type: 'childList', target: cEnv.body, addedNodes: [mPanel], removedNodes: [] }]);
  const scansAfterPanel = ctl.getState().perfStats.executedScans;

  const subPopup = cEnv.makeEl('div', { attrs: { 'data-testid': 'context-menu-submenu-popup' } });
  mo.trigger([{ type: 'childList', target: cEnv.body, addedNodes: [subPopup], removedNodes: [] }]);
  assert.equal(ctl.getState().perfStats.executedScans, scansAfterPanel + 1, 'context-menu-submenu-popup without role="menu" must trigger immediate scan');
  ctl.destroy();

  // (c) P1-5: ui-runtime.js triggers W.__agPrismThought?.scan?.() on sidebar/history/overlay flags (flags.s || flags.g || flags.o) when getTranslateTitles() is active
  const uiSrc = fs.readFileSync(path.join(ROOT, 'ui-runtime.js'), 'utf8');
  assert.match(
    uiSrc,
    /\(\(flags\.s\s*\|\|\s*flags\.g\s*\|\|\s*flags\.o\)\s*&&\s*W\.__agPrismThought\?\.getTranslateTitles\?\.\(\)\)/,
    'ui-runtime.js must trigger thought title scan incrementally on flags.s || flags.g || flags.o when getTranslateTitles() is enabled'
  );
});

// ── Test 9: Antigravity v2.34 Lexical typeahead-item-* slash menu (no listbox, bare label, inner onClickCapture target) ──
test('9. context-menu-btw: matches Antigravity v2.34 typeahead-item-* options with bare menu-option-label, skips category/planner, and clicks inner label/row', async () => {
  const env = createDomEnv();
  const box = env.makeEl('div', { attrs: { 'data-testid': 'agent-input-box' } });
  const ed = env.makeEl('div', { attrs: { contenteditable: 'true' } });
  const sendBtn = env.makeEl('button', { attrs: { 'data-testid': 'input-send-button' } });
  let sendClicks = 0;
  sendBtn.addEventListener('click', () => { sendClicks += 1; });
  box.appendChild(ed);
  box.appendChild(sendBtn);
  env.body.appendChild(box);

  // Portal container WITHOUT [role="listbox"] or [data-testid="slash-command-menu"] (exact v2.34 structure)
  const portal = env.makeEl('div', { className: 'agy-overlay' });
  env.body.appendChild(portal);

  const selectedCommands = [];
  const mountTypeaheadMenu = (items) => {
    portal.children.length = 0;
    items.forEach((it, idx) => {
      const opt = env.makeEl('div', { attrs: { id: `typeahead-item-${idx}`, role: 'option', 'aria-selected': idx === 0 ? 'true' : 'false' } });
      const row = env.makeEl('div', {
        attrs: it.category ? { 'data-testid': 'menu-category-row', 'aria-disabled': 'true' } : {},
        className: 'flex w-full cursor-pointer',
      });
      const lbl = env.makeEl('span', { attrs: { 'data-testid': 'menu-option-label' }, text: it.label });
      const desc = env.makeEl('span', { attrs: { 'data-testid': 'menu-option-description' }, text: it.desc || '' });
      // Host attaches React onClickCapture on inner row (clicking outer opt alone never hits it!)
      lbl.addEventListener('click', () => {
        if (!it.category) {
          selectedCommands.push(it.label);
          ed.textContent = `[SLASH_CHIP:${it.label}] `;
          portal.children.length = 0;
        }
      });
      row.appendChild(lbl);
      row.appendChild(desc);
      opt.appendChild(row);
      portal.appendChild(opt);
    });
  };

  env.setExecCommandHandler((cmd, val) => {
    if (cmd !== 'insertText') return false;
    Promise.resolve().then(() => {
      ed.textContent = (ed.textContent || '') + String(val);
      if (val === '/compact') {
        mountTypeaheadMenu([
          { label: 'Commands', category: true },
          { label: 'compact', desc: 'Compact conversation context' },
        ]);
      } else if (val === '/plan') {
        mountTypeaheadMenu([
          { label: 'planner', desc: 'Distractor' },
          { label: 'plan', desc: 'Create step-by-step plan' },
        ]);
      }
    });
    return true;
  });

  const ctl = ctxMenuMod.createContextMenuController({
    doc: env.doc, win: env.win, nav: env.win.navigator, loc: env.win.location, stepDelayMs: 5,
  });

  const cRes = await ctl.triggerSlashCommand('/compact', '');
  assert.deepEqual(cRes, { ok: true, command: '/compact', pickedFromMenu: true, hasQuote: false, submitMethod: 'click-send-button' });
  assert.deepEqual(selectedCommands, ['compact']);
  assert.equal(ed.textContent, '[SLASH_CHIP:compact] ');
  assert.equal(sendClicks, 1);

  ed.textContent = '';
  const pRes = await ctl.triggerSlashCommand('/plan', 'Need architecture review');
  assert.deepEqual(pRes, { ok: true, command: '/plan', pickedFromMenu: true, hasQuote: true, submitMethod: 'click-send-button' });
  assert.deepEqual(selectedCommands, ['compact', 'plan']);
  assert.equal(ed.textContent, '[SLASH_CHIP:plan] \nNeed architecture review');
  assert.equal(sendClicks, 2);

  ctl.destroy();
});

// ── Test 10: Issue #31 anti-flicker & first-frame anti-translation regression ──
test('10. upstream-client (Issue #31): _mntSec stamps 5+1 no-translate attrs before DOM insertion, bilingual synonyms (Medium <-> متوسط) never trigger rise flicker, real tier change updates with bounded <=22% rise & overflow-y:clip margin', () => {
  const REQUIRED_NO_TR_ATTRS = [
    ['data-ag-i18n-skip', '1'],
    ['data-ag-no-tr', '1'],
    ['data-no-translate', '1'],
    ['data-translate', 'no'],
    ['translate', 'no'],
  ];
  const assertNoTrComplete = (el, name) => {
    assert.ok(el, `${name} must exist`);
    for (const [k, v] of REQUIRED_NO_TR_ATTRS) {
      assert.equal(el.getAttribute(k), v, `${name} must carry ${k}="${v}" on first frame`);
    }
    assert.equal(el.classList.contains('notranslate'), true, `${name} must carry class "notranslate" on first frame`);
  };

  // (a) Verify _mntSec stamps full 5+1 anti-translation attributes synchronously BEFORE inserting into panel (without slider-coexist)
  const env = createDomEnv({ virtualTimers: true });
  const optLow = { label: 'Gemini 4 Hydrogen (Low)', modelId: 'h-low', value: 1 };
  const optMed = { label: 'Gemini 4 Hydrogen (Medium)', modelId: 'h-med', value: 2 };
  const optHigh = { label: 'Gemini 4 Hydrogen (High)', modelId: 'h-high', value: 3 };
  let selected = optMed;

  const panel = env.makeEl('div', { attrs: { 'data-testid': 'model-selector-panel' } });
  const listWrap = env.makeEl('div');
  const rowItem = env.makeEl('div', { attrs: { role: 'menuitem' } });
  const grpSpan = env.makeEl('span', {
    attrs: { 'data-testid': 'model-selector-effort-group', 'data-model-base': 'Gemini 4 Hydrogen' },
    text: 'Gemini 4 Hydrogen',
  });
  const effSpan = env.makeEl('span', { text: 'متوسط' });
  rowItem.appendChild(grpSpan);
  rowItem.appendChild(effSpan);
  listWrap.appendChild(rowItem);
  panel.appendChild(listWrap);
  const viewUsageRow = env.makeEl('div', { text: 'View Usage Details' });
  panel.appendChild(viewUsageRow);
  env.body.appendChild(panel);

  const selectorCtx = {
    effortIndex: new Map([['Gemini 4 Hydrogen', new Map([['low', optLow], ['medium', optMed], ['high', optHigh]])]]),
    modelOptions: [optLow, optMed, optHigh],
    get selectedModel() { return selected; },
    setModelConfigByLabelForConversation(lbl) {
      selected = [optLow, optMed, optHigh].find((o) => o.label === lbl) || selected;
    },
  };
  panel.__reactFiber$issue31 = { memoizedProps: { value: selectorCtx }, return: null };

  // Intercept insertBefore to assert first-frame attributes exist BEFORE external i18n MutationObserver can react
  let insertedSnapshotOk = false;
  const origInsertBefore = panel.insertBefore.bind(panel);
  panel.insertBefore = (node, ref) => {
    if (node.classList.contains('ces-ag-section')) {
      assertNoTrComplete(node, '.ces-ag-section (pre-insert)');
      assertNoTrComplete(node.querySelector('.ces-ag-effort-row'), '.ces-ag-effort-row (pre-insert)');
      assertNoTrComplete(node.querySelector('.ces-ag-effort-head'), '.ces-ag-effort-head (pre-insert)');
      assertNoTrComplete(node.querySelector('.ces-ag-effort-title'), '.ces-ag-effort-title (pre-insert)');
      assertNoTrComplete(node.querySelector('.ces-ag-effort-value'), '.ces-ag-effort-value (pre-insert)');
      assertNoTrComplete(node.querySelector('.ces-inline'), '.ces-inline (pre-insert)');
      insertedSnapshotOk = true;
    }
    return origInsertBefore(node, ref);
  };

  const agObs = upstreamLib.installAntigravityObserver({
    document: env.doc,
    window: env.win,
    MutationObserver: env.win.MutationObserver,
  });
  assert.equal(insertedSnapshotOk, true, '_mntSec must stamp 5+1 anti-translation attributes synchronously before DOM insertion');

  // Verify SLIDER_CSS bounds rise animation displacement <= 22% and clips .ces-ag-effort-head with overflow-y:clip + overflow-clip-margin:10px (without hard-clipping Max glow)
  const styleEl = env.doc.getElementById('ag-codex-effort-slider-styles');
  assert.ok(styleEl, 'SLIDER_CSS style element must be installed');
  const css = styleEl.textContent;
  const kfMatch = /@keyframes\s+ces-claude-rise\{([^}]+(?:\{[^}]*\}[^}]*)*)\}/.exec(css);
  assert.ok(kfMatch, 'SLIDER_CSS must define @keyframes ces-claude-rise');
  const yMatches = [...kfMatch[1].matchAll(/translateY\(\s*(-?\d+(?:\.\d+)?)%\s*\)/g)].map((m) => Number(m[1]));
  assert.ok(yMatches.length > 0, 'ces-claude-rise must specify translateY percentage');
  for (const pct of yMatches) {
    assert.ok(pct <= 22 && pct >= -10, `ces-claude-rise translateY(${pct}%) must stay bounded within [-10%, 22%] to prevent bleeding into slider track`);
  }
  assert.match(css, /\.ces-ag-effort-head\{[^}]*overflow-y:clip;overflow-clip-margin:10px/, '.ces-ag-effort-head must use overflow-y:clip + overflow-clip-margin:10px so Max glow is not hard-clipped');
  assert.doesNotMatch(css, /\.ces-ag-effort-head\{[^}]*overflow:hidden/, '.ces-ag-effort-head must not hard-clip is-glowing with overflow:hidden');

  agObs.stop();

  // (b) Bilingual synonym oscillation (Medium <-> متوسط <-> Med <-> Medium) must NEVER trigger ces-text-rise / is-claude-changing
  const mEnv = createDomEnv({ virtualTimers: true });
  const rowEl = mEnv.makeEl('div', { className: 'ces-ag-effort-row' });
  const valEl = mEnv.makeEl('span', { className: 'ces-ag-effort-value' });
  const container = mEnv.makeEl('div', { className: 'ces-inline' });
  rowEl.appendChild(valEl);
  rowEl.appendChild(container);
  mEnv.body.appendChild(rowEl);

  let riseAdds = 0;
  const origClassAdd = valEl.classList.add.bind(valEl.classList);
  valEl.classList.add = (...cs) => {
    if (cs.includes('ces-text-rise')) riseAdds += 1;
    return origClassAdd(...cs);
  };

  let seatLabelMed = 'Medium';
  let seatLabelHigh = 'High';
  let curEffort = 'medium';
  let seatLevelsUseEmptyKey = false;
  const mount = upstreamLib.mountCodexEffortSlider({
    container,
    row: rowEl,
    valueElement: valEl,
    document: mEnv.doc,
    window: mEnv.win,
    seat: {
      isClaude: false,
      locked: false,
      get effortLevels() {
        return [
          { effort: seatLevelsUseEmptyKey ? '' : 'low', label: 'Low' },
          { effort: seatLevelsUseEmptyKey ? '' : 'medium', label: seatLabelMed },
          { effort: seatLevelsUseEmptyKey ? '' : 'high', label: seatLabelHigh },
        ];
      },
      get currentEffort() { return curEffort; },
      selectEffort() {},
    },
  });

  assert.equal(valEl.textContent, 'Medium');
  assert.equal(riseAdds, 0, 'Initial mount must not trigger rise animation');

  // Alternate seat label & external DOM text between bilingual equivalents: Medium <-> متوسط <-> Med <-> Medium
  for (const [nextSeatLbl, domRewrite] of [
    ['متوسط', 'متوسط'],
    ['Medium', 'متوسط'],
    ['Med', 'Med'],
    ['Medium', 'Medium'],
    ['(متوسط)', '(متوسط)'],
    ['Medium', 'متوسط'],
  ]) {
    seatLabelMed = nextSeatLbl;
    valEl.textContent = domRewrite;
    mount.refresh();
    mEnv.flushRafs(16);
    assert.equal(valEl.classList.contains('ces-text-rise'), false, `Bilingual synonym "${nextSeatLbl}" must not add ces-text-rise`);
    assert.equal(valEl.classList.contains('is-claude-changing'), false, `Bilingual synonym "${nextSeatLbl}" must not add is-claude-changing`);
  }
  // Even when effort key is absent and only label oscillates between 'Medium' and 'متوسط'
  seatLevelsUseEmptyKey = true;
  curEffort = 'Medium';
  seatLabelMed = 'متوسط';
  curEffort = 'متوسط';
  mount.refresh();
  seatLabelMed = 'Medium';
  curEffort = 'Medium';
  mount.refresh();
  assert.equal(riseAdds, 0, 'Bilingual synonym oscillation must produce 0 rise animations');

  // (c) Real tier change (Medium -> High) updates text cleanly and triggers bounded rise animation once
  seatLevelsUseEmptyKey = false;
  seatLabelMed = 'Medium';
  seatLabelHigh = 'High';
  curEffort = 'high';
  mount.refresh();
  assert.equal(valEl.textContent, 'High', 'Real tier change Medium -> High must update value text');
  assert.equal(valEl.classList.contains('ces-text-rise'), true, 'Real tier change must play controlled rise animation');
  assert.equal(riseAdds, 1, 'Real tier change must trigger rise animation exactly once');

  // Repeated refreshes at High (including High <-> عالي synonym) must NOT re-trigger animation
  mEnv.flushTimers(300);
  assert.equal(valEl.classList.contains('ces-text-rise'), false, 'Rise animation class must clear after timer');
  seatLabelHigh = 'عالي';
  valEl.textContent = 'عالي';
  mount.refresh();
  seatLabelHigh = 'High';
  mount.refresh();
  assert.equal(riseAdds, 1, 'Synonym oscillation at High must not re-trigger rise animation');

  mount.unmount();
  assert.equal(valEl.__cesLastLabel, undefined);
  assert.equal(valEl.__cesLastKey, undefined);
});

// ── Test 11: Red-team #255 P1 #6 (Adaptive + fixed locked key) & P1 #7 (markNoTranslate idempotence + orchestrator-effort-bar 5+1) ──
test('11. Red-team #255 P1 #6/#7: Adaptive <-> تكيفي zero-flicker, Medium -> Adaptive / GPT-OSS 120B (sE="fixed") never stalls, markNoTranslate is idempotent (0 redundant setAttribute), and orchestrator-effort-bar carries 5+1 no-translate attrs pre-insert', () => {
  const REQUIRED_NO_TR_ATTRS = [
    ['data-ag-i18n-skip', '1'],
    ['data-ag-no-tr', '1'],
    ['data-no-translate', '1'],
    ['data-translate', 'no'],
    ['translate', 'no'],
  ];

  // (a) slider-coexist EFF_MAP & EFF_LABELS map Adaptive / تكيفي cleanly
  for (const raw of ['Claude Sonnet (Adaptive)', 'Claude Sonnet (تكيفي)']) {
    const parsed = sliderCoexist.parseLocalizedModelLabel(raw);
    assert.equal(parsed.effort, 'adaptive', `${raw} must map to effort="adaptive"`);
    assert.equal(parsed.effortLabel, 'Adaptive', `${raw} must map to effortLabel="Adaptive"`);
    assert.equal(parsed.canonicalLabel, 'Claude Sonnet (Adaptive)');
  }

  // (b) Adaptive <-> تكيفي zero-flicker, Medium -> Adaptive (even with fallback effort="medium"), and Medium -> GPT-OSS 120B (locked single-tier)
  const mEnv = createDomEnv({ virtualTimers: true });
  const rowEl = mEnv.makeEl('div', { className: 'ces-ag-effort-row' });
  const valEl = mEnv.makeEl('span', { className: 'ces-ag-effort-value' });
  const container = mEnv.makeEl('div', { className: 'ces-inline' });
  rowEl.appendChild(valEl);
  rowEl.appendChild(container);
  mEnv.body.appendChild(rowEl);

  let riseAdds = 0;
  const origClassAdd = valEl.classList.add.bind(valEl.classList);
  valEl.classList.add = (...cs) => {
    if (cs.includes('ces-text-rise')) riseAdds += 1;
    return origClassAdd(...cs);
  };

  let curLevels = [
    { effort: 'low', label: 'Low' },
    { effort: 'medium', label: 'Medium' },
    { effort: 'high', label: 'High' },
  ];
  let curEffort = 'medium';
  let curLocked = false;
  const mount = upstreamLib.mountCodexEffortSlider({
    container,
    row: rowEl,
    valueElement: valEl,
    document: mEnv.doc,
    window: mEnv.win,
    seat: {
      isClaude: false,
      get locked() { return curLocked; },
      get effortLevels() { return curLevels; },
      get currentEffort() { return curEffort; },
      selectEffort() {},
    },
  });
  assert.equal(valEl.textContent, 'Medium');
  assert.equal(riseAdds, 0);

  // Switch Medium -> Adaptive (even if seat reports fallback effort="medium") -> MUST NOT stall on "Medium"
  curLevels = [
    { effort: 'medium', label: 'Adaptive' },
    { effort: 'high', label: 'High' },
  ];
  curEffort = 'medium';
  mount.refresh();
  assert.equal(valEl.textContent, 'Adaptive', 'Medium -> Adaptive must update value text even when seat effort falls back to "medium"');
  assert.equal(riseAdds, 1, 'Medium -> Adaptive real change triggers 1 rise animation');
  mEnv.flushTimers(300);

  // Bilingual Adaptive <-> تكيفي oscillation -> 0 rise animations & 0 ping-pong overwrites
  for (const [seatLbl, domTxt] of [
    ['تكيفي', 'تكيفي'],
    ['Adaptive', 'تكيفي'],
    ['(تكيفي)', '(تكيفي)'],
    ['Adaptive', 'Adaptive'],
  ]) {
    curLevels = [{ effort: 'adaptive', label: seatLbl }, { effort: 'high', label: 'High' }];
    curEffort = 'adaptive';
    valEl.textContent = domTxt;
    mount.refresh();
    mEnv.flushRafs(16);
    assert.equal(valEl.classList.contains('ces-text-rise'), false, `Adaptive synonym "${seatLbl}" must never trigger rise flicker`);
  }
  assert.equal(riseAdds, 1, 'Adaptive <-> تكيفي must produce 0 extra rise animations');

  // Switch back to Medium, then switch to unparenthesized single-tier locked model GPT-OSS 120B (sE="fixed")
  curLevels = [{ effort: 'low', label: 'Low' }, { effort: 'medium', label: 'Medium' }];
  curEffort = 'medium';
  curLocked = false;
  mount.refresh();
  assert.equal(valEl.textContent, 'Medium');
  mEnv.flushTimers(300);

  const gptOssSingle = { label: 'GPT-OSS 120B', modelId: 'gpt-oss-120b', value: 901 };
  const gptProf = upstreamLib.resolveModelEffortProfile(
    { effortIndex: new Map(), modelOptions: [gptOssSingle], selectedModel: gptOssSingle },
    gptOssSingle
  );
  assert.equal(gptProf.locked, true);
  assert.equal(gptProf.currentEffort, 'fixed', 'Unparenthesized single-tier locked model must use sE="fixed" instead of "medium"');
  assert.equal(gptProf.levels[0].effort, 'fixed');

  curLevels = gptProf.levels;
  curEffort = gptProf.currentEffort;
  curLocked = gptProf.locked;
  mount.refresh();
  assert.equal(valEl.textContent, gptProf.currentLabel, 'Medium -> GPT-OSS 120B must update value text to Fixed/ثابت (no "medium" key collision)');

  // Also switch Medium -> unknown unmapped label "Turbo" (even with effort="medium") -> !_sameEffTxt updates cleanly
  curLevels = [{ effort: 'medium', label: 'Medium' }];
  curEffort = 'medium';
  mount.refresh();
  assert.equal(valEl.textContent, 'Medium');
  curLevels = [{ effort: 'medium', label: 'Turbo' }];
  curEffort = 'medium';
  mount.refresh();
  assert.equal(valEl.textContent, 'Turbo', 'Medium -> unknown label must still update text via !_sameEffTxt guard');
  mount.unmount();

  // (c) P1 #7: markNoTranslate idempotence — 0 redundant setAttribute / classList.add on already-marked nodes, incremental fill on partial nodes
  const nEnv = createDomEnv();
  const node = nEnv.makeEl('div', { className: 'ces-ag-effort-row' });
  let setAttrCount = 0;
  let clsAddCount = 0;
  const origSetAttr = node.setAttribute.bind(node);
  const origClsAdd = node.classList.add.bind(node.classList);
  node.setAttribute = (k, v) => { setAttrCount += 1; return origSetAttr(k, v); };
  node.classList.add = (...cs) => { clsAddCount += 1; return origClsAdd(...cs); };

  upstreamLib.markNoTranslate(node);
  assert.ok(setAttrCount >= 5, 'First markNoTranslate call stamps all anti-translation attributes');
  assert.equal(clsAddCount, 1);

  const afterFirstSet = setAttrCount;
  const afterFirstCls = clsAddCount;
  for (let i = 0; i < 10; i++) upstreamLib.markNoTranslate(node);
  assert.equal(setAttrCount, afterFirstSet, 'Repeated markNoTranslate calls must short-circuit with 0 setAttribute calls');
  assert.equal(clsAddCount, afterFirstCls, 'Repeated markNoTranslate calls must short-circuit with 0 classList.add calls');

  // Partial node (has 2 of 8 attrs + notranslate): only missing attrs are written
  const partialNode = nEnv.makeEl('span', { className: 'notranslate', attrs: { 'data-ag-i18n-skip': '1', translate: 'no' } });
  const writtenKeys = [];
  const origPSet = partialNode.setAttribute.bind(partialNode);
  partialNode.setAttribute = (k, v) => { writtenKeys.push(k); return origPSet(k, v); };
  upstreamLib.markNoTranslate(partialNode);
  assert.equal(writtenKeys.includes('data-ag-i18n-skip'), false, 'markNoTranslate must not rewrite already-equal data-ag-i18n-skip');
  assert.equal(writtenKeys.includes('translate'), false, 'markNoTranslate must not rewrite already-equal translate');
  assert.equal(writtenKeys.includes('data-antigravity-zh-skip'), true, 'markNoTranslate must fill missing attributes');

  // (d) P1 #7: model-glyph-crystal.js stamps 5+1 anti-translation attributes on [data-testid="orchestrator-effort-bar"] BEFORE DOM insertion
  for (const withUpstream of [false, true]) {
    const mgcEnv = createDomEnv();
    const prevDoc = globalThis.document;
    const prevPerf = globalThis.performance;
    const prevRaf = globalThis.requestAnimationFrame;
    const prevCaf = globalThis.cancelAnimationFrame;
    const prevUp = globalThis.AntigravityCodexEffortSlider;
    globalThis.document = mgcEnv.doc;
    globalThis.performance = mgcEnv.win.performance;
    globalThis.requestAnimationFrame = mgcEnv.win.requestAnimationFrame;
    globalThis.cancelAnimationFrame = mgcEnv.win.cancelAnimationFrame;
    if (withUpstream) globalThis.AntigravityCodexEffortSlider = upstreamLib;
    else delete globalThis.AntigravityCodexEffortSlider;
    try {
      const panel = mgcEnv.makeEl('div', { attrs: { 'data-testid': 'model-selector-panel' } });
      const orchItem = mgcEnv.makeEl('div', { attrs: { role: 'menuitem', 'data-testid': 'model-selector-orchestrator', 'data-selected': 'true' }, text: 'Orchestrator' });
      panel.appendChild(orchItem);
      mgcEnv.body.appendChild(panel);

      let checkedPreInsert = false;
      const origAppend = panel.appendChild.bind(panel);
      panel.appendChild = (ch) => {
        if (ch.getAttribute?.('data-testid') === 'orchestrator-effort-bar') {
          for (const target of [
            ch,
            ch.querySelector('.ces-ag-effort-head'),
            ch.querySelector('.ces-ag-effort-title'),
            ch.querySelector('.ces-ag-effort-value'),
            ch.querySelector('.ces-inline'),
          ]) {
            assert.ok(target, 'orchestrator-effort-bar child must exist before insertion');
            for (const [k, v] of REQUIRED_NO_TR_ATTRS) {
              assert.equal(target.getAttribute(k), v, `orchestrator-effort-bar (withUpstream=${withUpstream}) must carry ${k}="${v}" before insertion`);
            }
            assert.equal(target.classList.contains('notranslate'), true, `orchestrator-effort-bar (withUpstream=${withUpstream}) must carry notranslate before insertion`);
          }
          checkedPreInsert = true;
        }
        return origAppend(ch);
      };

      const mCtl = mgcMod.createModelGlyphCrystalController({
        animatedIcons: null,
        crystalPrismCore: {
          mountCrystalPrismBar() {
            return { step() {}, isIdle: () => true, setPointerClient() {}, setReduceMotion() {}, wake() {}, dispose() {} };
          },
        },
        isDestroyed: () => false,
        isComposerRestyleEnabled: () => true,
        isZh: () => true,
        isDarkTheme: () => true,
        motionReduced: () => false,
        getMinFrameGapMs: () => 0,
        canMountRealCanvas: () => false,
        getLastPointerPos: () => null,
        setAttrIfChanged: (el, k, v) => el.setAttribute(k, v),
      });
      mCtl.syncModelSelectorPanel({ brand: 'antigravity', tier: 'auto', isOrchestrator: true });
      assert.equal(checkedPreInsert, true, `orchestrator-effort-bar pre-insert 5+1 check must run (withUpstream=${withUpstream})`);
      mCtl.teardownCrystalMount();
    } finally {
      globalThis.document = prevDoc;
      globalThis.performance = prevPerf;
      globalThis.requestAnimationFrame = prevRaf;
      globalThis.cancelAnimationFrame = prevCaf;
      if (prevUp === undefined) delete globalThis.AntigravityCodexEffortSlider;
      else globalThis.AntigravityCodexEffortSlider = prevUp;
    }
  }
});
