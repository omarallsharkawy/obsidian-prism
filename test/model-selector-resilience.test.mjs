import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const require = createRequire(import.meta.url);

globalThis.__agCodexEffortSliderDisableAutoBoot = true;
const upstreamLib = require('../vendor/effort-slider/upstream-client.js');
const sliderCoexist = require('../vendor/effort-slider/slider-coexist.js');
const mgc = require('../model-glyph-crystal.js');
const cdp = require('../cdp.js');

function createSimEnv(options = {}) {
  const listenersByNode = new WeakMap();
  const winListeners = new Map();
  let fakeNow = 1000;
  let rafSeq = 0;
  const rafQueue = [];

  function makeClassList(el) {
    const tokens = () => String(el.className || '').trim().split(/\s+/).filter(Boolean);
    return {
      add(...cls) {
        const s = new Set(tokens());
        cls.forEach((c) => c && s.add(c));
        el.className = Array.from(s).join(' ');
      },
      remove(...cls) {
        const drop = new Set(cls);
        el.className = tokens().filter((c) => !drop.has(c)).join(' ');
      },
      contains(c) {
        return tokens().includes(c);
      },
      toggle(c, force) {
        const has = tokens().includes(c);
        const on = force === undefined ? !has : Boolean(force);
        if (on) this.add(c);
        else this.remove(c);
        return on;
      },
    };
  }

  function matchSimple(node, sel) {
    if (!node || node.nodeType !== 1) return false;
    let rest = sel.trim();
    if (!rest) return false;
    // tag prefix
    const tagM = rest.match(/^([a-zA-Z0-9_-]+)/);
    if (tagM) {
      if (node.tagName !== tagM[1].toUpperCase()) return false;
      rest = rest.slice(tagM[0].length);
    }
    while (rest.length > 0) {
      if (rest[0] === '#') {
        const m = rest.match(/^#([a-zA-Z0-9_-]+)/);
        if (!m || node.id !== m[1]) return false;
        rest = rest.slice(m[0].length);
      } else if (rest[0] === '.') {
        const m = rest.match(/^\.([a-zA-Z0-9_-]+)/);
        if (!m || !node.classList.contains(m[1])) return false;
        rest = rest.slice(m[0].length);
      } else if (rest[0] === '[') {
        const m = rest.match(/^\[([a-zA-Z0-9_-]+)(?:(\^?=)"([^"]*)")?\]/);
        if (!m) return false;
        const val = node.getAttribute(m[1]);
        if (val === null) return false;
        if (m[2] === '=' && val !== m[3]) return false;
        if (m[2] === '^=' && !val.startsWith(m[3])) return false;
        rest = rest.slice(m[0].length);
      } else {
        return false;
      }
    }
    return true;
  }

  function matchesSelector(node, selectorList) {
    return String(selectorList)
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
      .some((sel) => matchSimple(node, sel));
  }

  function makeEl(tag, opts = {}) {
    const attrs = new Map();
    const styleProps = new Map();
    const listeners = { capture: new Map(), bubble: new Map() };
    const el = {
      nodeType: 1,
      tagName: String(tag).toUpperCase(),
      children: [],
      childNodes: [],
      parentNode: null,
      parentElement: null,
      isConnected: true,
      hidden: false,
      className: opts.className || '',
      _text: opts.text || '',
      _visible: opts.visible !== false,
      style: {
        setProperty(k, v) { styleProps.set(k, String(v)); },
        getPropertyValue(k) { return styleProps.get(k) || ''; },
        removeProperty(k) { styleProps.delete(k); },
        get color() { return styleProps.get('color') || ''; },
        set color(v) { if (v) styleProps.set('color', String(v)); else styleProps.delete('color'); },
        get opacity() { return styleProps.get('opacity') || ''; },
        set opacity(v) { if (v) styleProps.set('opacity', String(v)); else styleProps.delete('opacity'); },
        get fontWeight() { return styleProps.get('fontWeight') || ''; },
        set fontWeight(v) { if (v) styleProps.set('fontWeight', String(v)); else styleProps.delete('fontWeight'); },
        get display() { return styleProps.get('display') || ''; },
        set display(v) { if (v) styleProps.set('display', String(v)); else styleProps.delete('display'); },
        get width() { return styleProps.get('width') || ''; },
        set width(v) { styleProps.set('width', String(v)); },
        get left() { return styleProps.get('left') || ''; },
        set left(v) { styleProps.set('left', String(v)); },
        get background() { return styleProps.get('background') || ''; },
        set background(v) { styleProps.set('background', String(v)); },
      },
      get id() { return attrs.get('id') || ''; },
      set id(v) { attrs.set('id', String(v)); },
      get firstChild() { return el.childNodes[0] || null; },
      get firstElementChild() { return el.children[0] || null; },
      get nextSibling() {
        if (!el.parentNode) return null;
        const arr = el.parentNode.childNodes;
        const idx = arr.indexOf(el);
        return idx >= 0 ? arr[idx + 1] || null : null;
      },
      get nextElementSibling() {
        if (!el.parentNode) return null;
        const arr = el.parentNode.children;
        const idx = arr.indexOf(el);
        return idx >= 0 ? arr[idx + 1] || null : null;
      },
      get textContent() {
        if (el.childNodes.length === 0) return el._text;
        return el.childNodes.map((c) => (c.nodeType === 3 ? c.nodeValue : c.textContent)).join('');
      },
      set textContent(v) {
        el._text = String(v ?? '');
        el.children = [];
        el.childNodes = [];
      },
      get innerHTML() { return el._innerHTML || ''; },
      set innerHTML(v) {
        el._innerHTML = String(v || '');
        if (!v) { el.children = []; el.childNodes = []; el._text = ''; }
      },
      setAttribute(k, v) { attrs.set(k, String(v)); },
      getAttribute(k) { return attrs.has(k) ? attrs.get(k) : null; },
      hasAttribute(k) { return attrs.has(k); },
      removeAttribute(k) { attrs.delete(k); },
      checkVisibility() { return el._visible; },
      getBoundingClientRect() { return { left: 0, top: 0, width: 220, height: 28, right: 220, bottom: 28 }; },
      blur() {},
      focus() {},
      appendChild(child) {
        if (child.parentNode) child.parentNode.removeChild(child);
        child.parentNode = el;
        child.parentElement = el;
        child.isConnected = el.isConnected;
        el.childNodes.push(child);
        if (child.nodeType === 1) el.children.push(child);
        return child;
      },
      insertBefore(child, ref) {
        if (!ref) return el.appendChild(child);
        if (child.parentNode) child.parentNode.removeChild(child);
        child.parentNode = el;
        child.parentElement = el;
        child.isConnected = el.isConnected;
        const cnIdx = el.childNodes.indexOf(ref);
        if (cnIdx >= 0) el.childNodes.splice(cnIdx, 0, child);
        else el.childNodes.push(child);
        if (child.nodeType === 1) {
          el.children = el.childNodes.filter((n) => n.nodeType === 1);
        }
        return child;
      },
      removeChild(child) {
        const ci = el.childNodes.indexOf(child);
        if (ci >= 0) el.childNodes.splice(ci, 1);
        const ei = el.children.indexOf(child);
        if (ei >= 0) el.children.splice(ei, 1);
        child.parentNode = null;
        child.parentElement = null;
        child.isConnected = false;
        return child;
      },
      remove() { if (el.parentNode) el.parentNode.removeChild(el); },
      contains(other) {
        let cur = other;
        while (cur) {
          if (cur === el) return true;
          cur = cur.parentNode;
        }
        return false;
      },
      closest(sel) {
        let cur = el;
        while (cur && cur.nodeType === 1) {
          if (matchesSelector(cur, sel)) return cur;
          cur = cur.parentElement;
        }
        return null;
      },
      querySelector(sel) { return el.querySelectorAll(sel)[0] || null; },
      querySelectorAll(sel) {
        const out = [];
        const walk = (n) => {
          for (const c of n.children || []) {
            if (matchesSelector(c, sel)) out.push(c);
            walk(c);
          }
        };
        walk(el);
        return out;
      },
      addEventListener(type, fn, useCapture) {
        const bucket = useCapture ? listeners.capture : listeners.bubble;
        if (!bucket.has(type)) bucket.set(type, []);
        bucket.get(type).push(fn);
      },
      removeEventListener(type, fn, useCapture) {
        const bucket = useCapture ? listeners.capture : listeners.bubble;
        const arr = bucket.get(type);
        if (!arr) return;
        const idx = arr.indexOf(fn);
        if (idx >= 0) arr.splice(idx, 1);
      },
      dispatchEvent(ev) {
        const pathNodes = [];
        let cur = el;
        while (cur) {
          pathNodes.unshift(cur);
          cur = cur.parentElement;
        }
        ev.target = el;
        ev.defaultPrevented = false;
        ev._stopped = false;
        ev._immStopped = false;
        ev.preventDefault = () => { ev.defaultPrevented = true; };
        ev.stopPropagation = () => { ev._stopped = true; };
        ev.stopImmediatePropagation = () => { ev._stopped = true; ev._immStopped = true; };
        for (const node of pathNodes) {
          const ls = listenersByNode.get(node);
          const fns = ls ? [...(ls.capture.get(ev.type) || [])] : [];
          for (const fn of fns) {
            if (ev._immStopped) break;
            fn(ev);
          }
          if (ev._stopped) return !ev.defaultPrevented;
        }
        for (let i = pathNodes.length - 1; i >= 0; i--) {
          const node = pathNodes[i];
          const ls = listenersByNode.get(node);
          const fns = ls ? [...(ls.bubble.get(ev.type) || [])] : [];
          for (const fn of fns) {
            if (ev._immStopped) break;
            fn(ev);
          }
          if (ev._stopped) return !ev.defaultPrevented;
        }
        return !ev.defaultPrevented;
      },
    };
    el.classList = makeClassList(el);
    listenersByNode.set(el, listeners);
    if (opts.attrs) {
      for (const [k, v] of Object.entries(opts.attrs)) el.setAttribute(k, v);
    }
    return el;
  }

  function makeText(v) {
    return { nodeType: 3, nodeValue: String(v), parentNode: null, parentElement: null };
  }

  const html = makeEl('html');
  const head = makeEl('head');
  const body = makeEl('body');
  html.appendChild(head);
  html.appendChild(body);

  let lsGets = 0;
  const lsMap = new Map();
  const localStorage = {
    getItem(k) { lsGets += 1; return lsMap.has(k) ? lsMap.get(k) : null; },
    setItem(k, v) { lsMap.set(k, String(v)); },
    removeItem(k) { lsMap.delete(k); },
    get _getCount() { return lsGets; },
  };

  const observers = [];
  class FakeMO {
    constructor(cb) {
      this.cb = cb;
      this.records = [];
      observers.push(this);
    }
    observe() {}
    disconnect() { this.records = []; }
    takeRecords() { const r = this.records.slice(); this.records = []; return r; }
    trigger(recs) { this.cb(recs, this); }
  }

  const doc = {
    documentElement: html,
    head,
    body,
    hidden: false,
    activeElement: null,
    createElement: (t) => makeEl(t),
    createTextNode: (v) => makeText(v),
    getElementById: (id) => html.querySelector(`#${id}`),
    querySelector: (s) => html.querySelector(s),
    querySelectorAll: (s) => html.querySelectorAll(s),
    addEventListener(t, fn, c) { html.addEventListener(t, fn, c); },
    removeEventListener(t, fn, c) { html.removeEventListener(t, fn, c); },
  };

  const win = {
    document: doc,
    localStorage,
    MutationObserver: FakeMO,
    performance: { now: () => fakeNow },
    requestAnimationFrame(cb) {
      const id = ++rafSeq;
      rafQueue.push({ id, cb });
      return id;
    },
    cancelAnimationFrame(id) {
      const idx = rafQueue.findIndex((r) => r.id === id);
      if (idx >= 0) rafQueue.splice(idx, 1);
    },
    getComputedStyle: () => ({ backgroundColor: 'rgb(14, 14, 18)' }),
    matchMedia: () => ({ matches: false }),
    Event: class { constructor(t) { this.type = t; } },
    CustomEvent: class { constructor(t, o) { this.type = t; this.detail = o && o.detail; } },
    addEventListener(t, fn) {
      if (!winListeners.has(t)) winListeners.set(t, []);
      winListeners.get(t).push(fn);
    },
    removeEventListener(t, fn) {
      const arr = winListeners.get(t);
      if (!arr) return;
      const idx = arr.indexOf(fn);
      if (idx >= 0) arr.splice(idx, 1);
    },
    dispatchEvent(ev) {
      for (const fn of [...(winListeners.get(ev.type) || [])]) fn(ev);
    },
    __agCodexEffortSliderDisableAutoBoot: true,
    setTimeout,
    clearTimeout,
  };
  doc.defaultView = win;

  function makeTrigger(labelText, effortText = '') {
    const btn = makeEl('button', { attrs: { 'data-testid': 'model-selector-trigger', 'aria-label': `Select model, current: ${labelText}` } });
    const outer = makeEl('span', { className: 'min-w-0' });
    outer.appendChild(makeText(labelText));
    if (effortText) {
      const sp = makeEl('span', { className: 'opacity-70', text: ` ${effortText}` });
      outer.appendChild(sp);
    }
    btn.appendChild(outer);
    return btn;
  }

  function makePanel() {
    const panel = makeEl('div', { attrs: { 'data-testid': 'model-selector-panel' } });
    const listWrap = makeEl('div');
    panel.appendChild(listWrap);
    return { panel, listWrap };
  }

  function addGroupRow(listWrap, baseName, effortLabel) {
    const mi = makeEl('div', { attrs: { role: 'menuitem' }, className: 'agy-overlay-item text-secondary-foreground' });
    const gs = makeEl('span', { attrs: { 'data-testid': 'model-selector-effort-group', 'data-model-base': baseName }, text: baseName });
    const eff = makeEl('span', { text: effortLabel });
    mi.appendChild(gs);
    mi.appendChild(eff);
    listWrap.appendChild(mi);
    return { row: mi, groupSpan: gs, effortSpan: eff };
  }

  function addSingleRow(listWrap, label, omitAttr = false) {
    const attrs = { 'data-testid': 'model-selector-item' };
    if (!omitAttr) attrs['data-model-label'] = label;
    const row = makeEl('div', { attrs, text: label });
    listWrap.appendChild(row);
    return row;
  }

  function attachFiberChain(el, { selectorCtx, popoverProps, convId, globalModelCtx }) {
    const chain = [];
    if (selectorCtx) chain.push({ memoizedProps: { value: selectorCtx } });
    if (popoverProps) chain.push({ memoizedProps: popoverProps });
    if (convId !== undefined) chain.push({ memoizedProps: { conversationId: convId, placement: 'top-start' } });
    if (globalModelCtx) chain.push({ memoizedProps: { value: globalModelCtx } });
    for (let i = 0; i < chain.length - 1; i++) chain[i].return = chain[i + 1];
    el.__reactFiber$test = chain[0] || null;
  }

  function simulateNativeClick(target, nativeOnClick) {
    const pu = { type: 'pointerup', button: 0, bubbles: true };
    const mu = { type: 'mouseup', button: 0, bubbles: true };
    const ck = { type: 'click', button: 0, bubbles: true };
    const host = target.closest('[data-testid="model-selector-panel"],[role="menu"],[role="listbox"],.agy-overlay');
    let nativeCalled = false;
    const handler = (ev) => {
      nativeCalled = true;
      if (typeof nativeOnClick === 'function') nativeOnClick(ev);
    };
    if (host) host.addEventListener('click', handler, false);
    target.dispatchEvent(pu);
    target.dispatchEvent(mu);
    target.dispatchEvent(ck);
    if (host) host.removeEventListener('click', handler, false);
    return { pu, mu, ck, nativeCalled };
  }

  return {
    html, head, body, doc, win, localStorage, observers, rafQueue,
    makeEl, makeText, makeTrigger, makePanel, addGroupRow, addSingleRow, attachFiberChain, simulateNativeClick,
    advanceRaf() {
      const batch = rafQueue.splice(0, rafQueue.length);
      fakeNow += 16;
      for (const item of batch) item.cb(fakeNow);
      return batch.length;
    },
  };
}

test('Jio model menu keeps all four Flash tiers active and allows native close for Claude and GPT-OSS', () => {
  const env = createSimEnv();
  const flashMin = { label: 'Gemini 3.8 Flash (Minimal)', modelId: 'gemini-3.8-flash-minimal', value: 1317 };
  const flashLow = { label: 'Gemini 3.8 Flash (Low)', modelId: 'gemini-3.8-flash-low', value: 1320 };
  const flashMed = { label: 'Gemini 3.8 Flash (Medium)', modelId: 'gemini-3.8-flash-medium', value: 1319 };
  const flashHigh = { label: 'Gemini 3.8 Flash (High)', modelId: 'gemini-3.8-flash-high', value: 1318 };
  const claudeSon = { label: 'Claude Sonnet 4.6 (Thinking)', modelId: 'claude-sonnet-4-6-thinking', value: 1410 };
  const claudeOpus = { label: 'Claude Opus 4.6 (Thinking)', modelId: 'claude-opus-4-6-thinking', value: 1411 };
  const gptOss = { label: 'GPT-OSS 120B (Medium)', modelId: 'gpt-oss-120b-medium', value: 342 };

  const modelOptions = [flashMin, flashLow, flashMed, flashHigh, claudeSon, claudeOpus, gptOss];
  let selectedModel = claudeSon;
  let isOpen = true;
  const committed = [];

  const selectorCtx = {
    effortIndex: new Map([['gemini-3.8-flash', new Map([['minimal', flashMin], ['low', flashLow], ['medium', flashMed], ['high', flashHigh]])]]),
    modelOptions,
    get selectedModel() { return selectedModel; },
  };
  const popoverProps = {
    modelOptions,
    get selectedModel() { return selectedModel; },
    get open() { return isOpen; },
    setIsOpen(v) { isOpen = Boolean(v); },
    setSelectedModel(opt) { selectedModel = opt; isOpen = false; },
  };
  const globalModelCtx = {
    setModelConfigByLabelForConversation(label, convId, keepOpen) {
      committed.push({ label, convId, keepOpen });
      selectedModel = modelOptions.find((o) => o.label === label) || selectedModel;
    },
  };

  const trigger = env.makeTrigger('Claude Sonnet 4.6 (Thinking)');
  env.body.appendChild(trigger);
  const { panel, listWrap } = env.makePanel();
  const flashRow = env.addGroupRow(listWrap, 'Gemini 3.8 Flash', 'Medium');
  const sonRow = env.addSingleRow(listWrap, claudeSon.label);
  const opusRow = env.addSingleRow(listWrap, claudeOpus.label);
  const gptRow = env.addSingleRow(listWrap, gptOss.label);
  env.body.appendChild(panel);
  env.attachFiberChain(panel, { selectorCtx, popoverProps, convId: 'conv-jio', globalModelCtx });

  const agObs = upstreamLib.installAntigravityObserver({ document: env.doc, window: env.win, MutationObserver: env.win.MutationObserver });
  assert.equal(env.html.getAttribute('data-ces-slider-ready'), '1', 'Valid ctx + open panel must set data-ces-slider-ready="1"');
  assert.ok(panel.querySelector('.ces-ag-section'), 'Must mount effort slider section');

  const resSwitch = env.simulateNativeClick(flashRow.groupSpan, () => { isOpen = false; });
  assert.equal(resSwitch.pu._stopped, true);
  assert.equal(resSwitch.ck.defaultPrevented, true);
  assert.equal(resSwitch.nativeCalled, false, 'Switching to a new tunable multi-effort model must keep menu open');
  assert.equal(isOpen, true);
  assert.equal(committed.length, 1);
  assert.equal(committed[0].label, 'Gemini 3.8 Flash (Medium)');
  assert.equal(panel.querySelectorAll('.ces-tick').length, 4, '3.8 Flash must show 4 ticks (Minimal/Low/Medium/High)');

  const sliderRoot = panel.querySelector('.ces-root');
  sliderRoot.dispatchEvent({ type: 'keydown', key: 'Home' });
  assert.equal(selectedModel.label, 'Gemini 3.8 Flash (Minimal)');
  assert.equal(panel.querySelector('.ces-ag-effort-value').textContent, 'Minimal');

  const resSecond = env.simulateNativeClick(flashRow.groupSpan, () => { isOpen = false; });
  assert.equal(resSecond.pu._stopped, false);
  assert.equal(resSecond.ck.defaultPrevented, false);
  assert.equal(resSecond.nativeCalled, true, 'Re-clicking already-selected model must pass through to close menu');
  assert.equal(isOpen, false);

  isOpen = true;
  for (const singleRow of [opusRow, gptRow, sonRow]) {
    isOpen = true;
    const r = env.simulateNativeClick(singleRow, () => { isOpen = false; });
    assert.equal(r.pu._stopped, false, `pointerup must pass through for ${singleRow.getAttribute('data-model-label')}`);
    assert.equal(r.mu._stopped, false);
    assert.equal(r.ck.defaultPrevented, false);
    assert.equal(r.nativeCalled, true);
    assert.equal(isOpen, false);
  }

  panel.remove();
  agObs.rescan();
  assert.equal(env.html.hasAttribute('data-ces-slider-ready'), false);
  agObs.stop();
});


test('Ultra 20x resolves slug effort keys and adjustable Orchestrator without eKa.Provider', () => {
  const env = createSimEnv();
  const neonLow = { label: 'Gemini 4 Neon (Low)', modelId: 'gemini-4-neon-low', value: 1534 };
  const neonMed = { label: 'Gemini 4 Neon (Medium)', modelId: 'gemini-4-neon-medium', value: 1533 };
  const neonHigh = { label: 'Gemini 4 Neon (High)', modelId: 'gemini-4-neon-high', value: 1532 };
  const neonXHigh = { label: 'Gemini 4 Neon (XHigh)', modelId: 'gemini-4-neon-xhigh', value: 1535 };
  const opusLow = { label: 'Claude Opus 5.5 (Low)', modelId: 'claude-opus-5-5-low', value: 1400 };
  const opusHigh = { label: 'Claude Opus 5.5 (High)', modelId: 'claude-opus-5-5-high', value: 1402 };
  const orchNeon = { label: 'Orchestrator (Neon)', modelId: 'gemini-pro-orchestrator-neon', value: 1537 };

  const planners = [neonLow, neonMed, neonHigh, neonXHigh];
  const modelOptions = [...planners, opusLow, opusHigh, orchNeon];
  let selectedModel = orchNeon;
  let isOpen = true;
  const orchSelectCalls = [];
  const unwrappedCalls = [];

  const selectorCtx = {
    effortIndex: new Map([
      ['gemini-4-neon', new Map([['low', neonLow], ['medium', neonMed], ['high', neonHigh], ['xhigh', neonXHigh]])],
      ['claude-opus-5-5', new Map([['low', opusLow], ['high', opusHigh]])],
    ]),
    modelOptions,
    get selectedModel() { return selectedModel; },
    orchestratorPlanners: planners,
    orchestratorPlannerIndex: new Map([['gemini-4-neon', new Map([['low', neonLow], ['medium', neonMed], ['high', neonHigh], ['xhigh', neonXHigh]])]]),
    orchestratorDefaultPlanner: neonXHigh,
    orchestratorPick: {
      model: null,
      select(v) { orchSelectCalls.push(v); this.model = v === 0 ? null : v; },
    },
  };
  const popoverProps = {
    modelOptions,
    get selectedModel() { return selectedModel; },
    get open() { return isOpen; },
    setIsOpen(v) { isOpen = Boolean(v); },
    setSelectedModel(opt) { unwrappedCalls.push(opt.label); selectedModel = opt; },
  };

  const trigger = env.makeTrigger('Orchestrator');
  env.body.appendChild(trigger);
  const { panel, listWrap } = env.makePanel();
  const orchRow = env.makeEl('div', { attrs: { role: 'menuitem', 'data-testid': 'model-selector-orchestrator' }, text: 'Orchestrator' });
  listWrap.appendChild(orchRow);
  const opusRow = env.addGroupRow(listWrap, 'Claude Opus 5.5', 'High');
  env.body.appendChild(panel);
  env.attachFiberChain(panel, { selectorCtx, popoverProps, convId: 'conv-ultra' });

  const agObs = upstreamLib.installAntigravityObserver({ document: env.doc, window: env.win, MutationObserver: env.win.MutationObserver });
  assert.equal(env.html.getAttribute('data-ces-slider-ready'), '1');
  assert.equal(panel.getAttribute('data-ces-orch-tunable'), 'true');

  const sliderRoot = panel.querySelector('.ces-root');
  sliderRoot.dispatchEvent({ type: 'keydown', key: 'Home' });
  assert.equal(orchSelectCalls[0], neonLow.value, 'Orchestrator slider must invoke orchestratorPick.select');

  const rOrch = env.simulateNativeClick(orchRow, () => { isOpen = false; });
  assert.equal(rOrch.ck.defaultPrevented, false);
  assert.equal(rOrch.nativeCalled, true);

  isOpen = true;
  const rOpus = env.simulateNativeClick(opusRow.groupSpan);
  assert.equal(rOpus.ck.defaultPrevented, true);
  assert.deepEqual(unwrappedCalls, ['Claude Opus 5.5 (Low)']);
  assert.equal(selectedModel.label, 'Claude Opus 5.5 (Low)');
  assert.equal(isOpen, true);

  panel.remove();
  agObs.rescan();
  assert.equal(env.html.hasAttribute('data-ces-slider-ready'), false);
  agObs.stop();
});


test('Antigravity 2.33 selects by display name through eKa.Provider and allows native recovery on failure', () => {
  const env = createSimEnv();
  const hLow = { label: 'Gemini 4 Hydrogen (Low)', modelId: 'h-low', value: 1 };
  const hHigh = { label: 'Gemini 4 Hydrogen (High)', modelId: 'h-high', value: 2 };
  const cLow = { label: 'Claude 4.5 (Low)', modelId: 'c-low', value: 3 };
  const cHigh = { label: 'Claude 4.5 (High)', modelId: 'c-high', value: 4 };
  let selectedModel = hLow;
  let shouldFailCommit = false;
  const commits = [];

  const selectorCtx = {
    effortIndex: new Map([
      ['Gemini 4 Hydrogen', new Map([['low', hLow], ['high', hHigh]])],
      ['Claude 4.5', new Map([['low', cLow], ['high', cHigh]])],
    ]),
    modelOptions: [hLow, hHigh, cLow, cHigh],
    get selectedModel() { return selectedModel; },
  };
  const globalModelCtx = {
    setModelConfigByLabelForConversation(label, convId, keepOpen) {
      if (shouldFailCommit) throw new Error('boom');
      commits.push({ label, convId, keepOpen });
      selectedModel = selectorCtx.modelOptions.find((o) => o.label === label) || selectedModel;
    },
  };

  const trigger = env.makeTrigger('Gemini 4 Hydrogen', 'Low');
  env.body.appendChild(trigger);
  const { panel, listWrap } = env.makePanel();
  const cRow = env.addGroupRow(listWrap, 'Claude 4.5', 'High');
  env.body.appendChild(panel);
  env.attachFiberChain(panel, { selectorCtx, convId: 'conv-233', globalModelCtx });

  const agObs = upstreamLib.installAntigravityObserver({ document: env.doc, window: env.win, MutationObserver: env.win.MutationObserver });
  const rOk = env.simulateNativeClick(cRow.groupSpan);
  assert.equal(rOk.ck.defaultPrevented, true);
  assert.equal(commits.length, 1);
  assert.equal(commits[0].keepOpen, true);

  shouldFailCommit = true;
  const hRow = env.addGroupRow(listWrap, 'Gemini 4 Hydrogen', 'Low');
  const rFail = env.simulateNativeClick(hRow.groupSpan);
  assert.equal(rFail.ck.defaultPrevented, false, 'Failed _commitAgOpt must NOT swallow click');
  assert.equal(rFail.nativeCalled, true, 'Failed _commitAgOpt must fall through to native click');
  agObs.stop();
});


test('Unsupported host Fiber leaves the model menu and its clicks native', () => {
  const env = createSimEnv();
  const trigger = env.makeTrigger('Unknown Model');
  env.body.appendChild(trigger);
  const { panel, listWrap } = env.makePanel();
  const gRow = env.addGroupRow(listWrap, 'Future Model X', 'High');
  const sRow = env.addSingleRow(listWrap, 'Future Model Y');
  env.body.appendChild(panel);

  const agObs = upstreamLib.installAntigravityObserver({ document: env.doc, window: env.win, MutationObserver: env.win.MutationObserver });
  assert.equal(env.html.hasAttribute('data-ces-slider-ready'), false, 'Native submenu CSS must remain unhidden when Fiber ctx is null');
  assert.equal(panel.querySelector('.ces-ag-section'), null, 'Must not mount broken slider section when ctx is null');

  for (const target of [gRow.groupSpan, sRow]) {
    const res = env.simulateNativeClick(target);
    assert.equal(res.pu._stopped, false);
    assert.equal(res.mu._stopped, false);
    assert.equal(res.ck.defaultPrevented, false);
    assert.equal(res.ck._stopped, false);
    assert.equal(res.nativeCalled, true);
  }
  agObs.stop();
});


test('Split-pane triggers and custom models coexist within observer and bundle limits', async () => {
  const env = createSimEnv();

  const subWrap = env.makeEl('div', { attrs: { 'data-testid': 'subagent-tab-conversation' } });
  const subTrigger = env.makeTrigger('Subagent Old Model');
  subWrap.appendChild(subTrigger);
  env.body.appendChild(subWrap);

  const mainTrigger = env.makeTrigger('Main Model');
  env.body.appendChild(mainTrigger);
  const pickedTrig = upstreamLib.findAntigravityTrigger(env.doc);
  assert.equal(pickedTrig, mainTrigger, 'findAntigravityTrigger must skip subagent-tab-conversation trigger');

  const fLow = { label: 'Gemini 3.8 Flash (Low)', modelId: 'f-low', value: 10 };
  const fHigh = { label: 'Gemini 3.8 Flash (High)', modelId: 'f-high', value: 11 };
  const customOpt = { label: 'My Custom Endpoint', modelId: 'custom-1', isCustom: true, value: 99 };
  env.attachFiberChain(mainTrigger, {
    selectorCtx: { effortIndex: new Map(), modelOptions: [customOpt], selectedModel: customOpt },
    globalModelCtx: { setModelConfigByLabelForConversation() {} },
  });
  const { panel, listWrap } = env.makePanel();
  const flashRow = env.addGroupRow(listWrap, 'Gemini 3.8 Flash', 'Low');
  const customRow = env.addSingleRow(listWrap, 'My Custom Endpoint', true);
  env.body.appendChild(panel);
  let activeModel = customOpt;
  env.attachFiberChain(panel, {
    selectorCtx: {
      effortIndex: new Map([['gemini-3.8-flash', new Map([['low', fLow], ['high', fHigh]])]]),
      modelOptions: [fLow, fHigh, customOpt],
      get selectedModel() { return activeModel; },
    },
    globalModelCtx: {
      setModelConfigByLabelForConversation(l) { activeModel = l === fHigh.label ? fHigh : fLow; },
    },
  });

  const ctl = sliderCoexist.createEffortSliderController({ window: env.win, document: env.doc });
  ctl.sync({ effortSliderModule: 'on' });
  assert.equal(env.html.getAttribute('data-ces-slider-ready'), '1');

  assert.equal(customRow.getAttribute('data-ces-model-selected'), 'true');
  const rCustom = env.simulateNativeClick(customRow);
  assert.equal(rCustom.ck.defaultPrevented, false);
  assert.equal(rCustom.nativeCalled, true);

  const mo = env.observers[0];
  const baseScans = ctl.getState().perfStats.executedScans;
  const glyphNode = env.makeEl('span', { className: 'ag-cs-panel-row-glyph' });
  panel.appendChild(glyphNode);
  for (let i = 0; i < 20; i++) mo.trigger([{ type: 'childList', target: glyphNode, addedNodes: [] }]);
  assert.equal(ctl.getState().perfStats.executedScans, baseScans, 'Ignored glyph mutations must execute 0 scans');

  for (let i = 0; i < 30; i++) mo.trigger([{ type: 'childList', target: flashRow.row, addedNodes: [] }]);
  const afterImmediate = ctl.getState().perfStats.executedScans;
  assert.ok(afterImmediate <= baseScans + 1, `Expected at most 1 immediate scan on open, got ${afterImmediate - baseScans}`);
  await new Promise((r) => setTimeout(r, 60));
  const afterWindow = ctl.getState().perfStats.executedScans;
  assert.ok(afterWindow <= baseScans + 2, `30 burst mutations inside open menu must coalesce into <=2 scans, got ${afterWindow - baseScans}`);

  assert.equal(env.html.getAttribute('data-ces-slider-ready'), '1', 'data-ces-slider-ready must be 1 while panel is mounted');
  panel.remove();
  mo.trigger([{ type: 'childList', target: env.body, addedNodes: [], removedNodes: [panel] }]);
  assert.equal(env.html.hasAttribute('data-ces-slider-ready'), false, 'Closing model panel must immediately clear data-ces-slider-ready without waiting for destroy()');

  const getsBefore = env.localStorage._getCount;
  env.localStorage.setItem('ag.codexEffortSlider.settings.v1', JSON.stringify({ motion: 'fast', ticks: 'highlight' }));
  env.win.dispatchEvent(Object.assign(new env.win.Event('storage'), { key: 'ag.codexEffortSlider.settings.v1' }));
  for (let i = 0; i < 20; i++) {
    assert.equal(upstreamLib.motionMode(env.win, null, env.doc), 'fast');
  }
  assert.equal(env.localStorage._getCount - getsBefore, 1, 'readSettings must cache settings in memory instead of reading localStorage every frame');
  env.localStorage.setItem('ag.codexEffortSlider.settings.v1', JSON.stringify({ motion: 'quick', ticks: 'dim' }));
  env.win.dispatchEvent(Object.assign(new env.win.Event('storage'), { key: 'ag.codexEffortSlider.settings.v1' }));
  assert.equal(upstreamLib.motionMode(env.win, null, env.doc), 'quick', 'storage event must invalidate readSettings cache');
  assert.equal(env.localStorage._getCount - getsBefore, 2);

  const uiSrc = fs.readFileSync(path.join(ROOT, 'ui-runtime.js'), 'utf8');
  assert.ok(uiSrc.includes('.ces-ag-section, .ces-set, #ag-codex-effort-slider-styles'));
  assert.equal(uiSrc.includes("document.querySelector?.('[data-testid=\"model-selector-panel\"]')"), false);

  let webglMountCalls = 0;
  const mCtl = mgc.createModelGlyphCrystalController({
    animatedIcons: null,
    crystalPrismCore: {
      mountCrystalPrismBar() {
        webglMountCalls += 1;
        return { step() {}, isIdle: () => true, setPointerClient() {}, setReduceMotion() {}, wake() {}, dispose() {} };
      },
    },
    isDestroyed: () => false,
    isComposerRestyleEnabled: () => true,
    isZh: () => true,
    isDarkTheme: () => true,
    motionReduced: () => false,
    getMinFrameGapMs: () => 0,
    canMountRealCanvas: () => true,
    getLastPointerPos: () => null,
    setAttrIfChanged: (el, k, v) => el.setAttribute(k, v),
  });
  const orchPanelEnv = createSimEnv();
  const { panel: orchPanel, listWrap: orchWrap } = orchPanelEnv.makePanel();
  const orchItem = orchPanelEnv.makeEl('button', { attrs: { 'data-selected': 'true' }, text: 'Orchestrator' });
  orchWrap.appendChild(orchItem);
  orchPanelEnv.body.appendChild(orchPanel);
  const prevDoc = globalThis.document;
  const prevRaf = globalThis.requestAnimationFrame;
  const prevCaf = globalThis.cancelAnimationFrame;
  globalThis.document = orchPanelEnv.doc;
  globalThis.requestAnimationFrame = orchPanelEnv.win.requestAnimationFrame.bind(orchPanelEnv.win);
  globalThis.cancelAnimationFrame = orchPanelEnv.win.cancelAnimationFrame.bind(orchPanelEnv.win);
  try {
    mCtl.syncModelSelectorPanel({ isOrchestrator: true, brand: 'antigravity', tier: 'auto' });
    assert.equal(webglMountCalls, 0, 'First menu open must defer heavy WebGL2 shader compile to next rAF frame');
    mCtl.teardownCrystalMount();
    orchPanelEnv.advanceRaf();
    assert.equal(webglMountCalls, 0, 'teardownCrystalMount must cancel pending mountRafId before rAF fires');
  } finally {
    globalThis.document = prevDoc;
    globalThis.requestAnimationFrame = prevRaf;
    globalThis.cancelAnimationFrame = prevCaf;
  }

  const expr = cdp.buildInjectExpression(cdp.DEFAULT_CONFIG);
  const bytes = Buffer.byteLength(expr, 'utf8');
  assert.ok(bytes < 690 * 1024, `Default bundle must be strictly < 706,560 B (690 KiB), got ${bytes}`);
  assert.ok(bytes <= 704000, `Default bundle must stay <= 704,000 B, got ${bytes}`);
  const pulseBytes = fs.statSync(path.join(ROOT, 'pulse-vial-bridge.js')).size;
  assert.ok(pulseBytes < 31000, `pulse-vial-bridge.js must stay < 31,000 B, got ${pulseBytes}`);
  assert.ok(cdp.REMOVE_EXPRESSION.includes("'data-ces-slider-ready'"));

  ctl.destroy();
  assert.equal(env.html.hasAttribute('data-ces-slider-ready'), false);
});

test('Pro model matrix and Argon-only Orchestrator never select disabled models', () => {
  const env = createSimEnv();
  const argLow = { label: 'Gemini 4 Argon (Low)', modelId: 'gemini-4-argon-low', value: 1201 };
  const argMed = { label: 'Gemini 4 Argon (Medium)', modelId: 'gemini-4-argon-medium', value: 1202 };
  const argHigh = { label: 'Gemini 4 Argon (High)', modelId: 'gemini-4-argon-high', value: 1203 };
  const flashLow = { label: 'Gemini 3.8 Flash (Low)', modelId: 'gemini-3.8-flash-low', value: 1320 };
  const flashHigh = { label: 'Gemini 3.8 Flash (High)', modelId: 'gemini-3.8-flash-high', value: 1318 };
  const claudeSon = { label: 'Claude Sonnet 4.6 (Thinking)', modelId: 'claude-sonnet-4-6-thinking', value: 1410 };
  const gptOss = { label: 'GPT-OSS 120B (Medium)', modelId: 'gpt-oss-120b-medium', value: 342 };
  const neonLockedLow = { label: 'Gemini 4 Neon (Low)', modelId: 'gemini-4-neon-low', value: 1534, disabled: true };
  const neonLockedHigh = { label: 'Gemini 4 Neon (High)', modelId: 'gemini-4-neon-high', value: 1532, disabled: true };
  const proDisabledLow = { label: 'Gemini 4 Pro Locked (Low)', modelId: 'gemini-4-pro-locked-low', value: 1550 };
  const proDisabledHigh = { label: 'Gemini 4 Pro Locked (High)', modelId: 'gemini-4-pro-locked-high', value: 1551 };
  const orchArgon = { label: 'Orchestrator (Argon)', modelId: 'gemini-pro-orchestrator-argon', value: 1299 };

  const planners = [argLow, argMed, argHigh];
  const modelOptions = [
    argLow, argMed, argHigh, flashLow, flashHigh, claudeSon, gptOss,
    neonLockedLow, neonLockedHigh, proDisabledLow, proDisabledHigh, orchArgon,
  ];
  let selectedModel = orchArgon;
  let isOpen = true;
  const commits = [];
  const orchPicks = [];

  const selectorCtx = {
    effortIndex: new Map([
      ['gemini-4-argon', new Map([['low', argLow], ['medium', argMed], ['high', argHigh]])],
      ['gemini-3.8-flash', new Map([['low', flashLow], ['high', flashHigh]])],
      ['gemini-4-neon', new Map([['low', neonLockedLow], ['high', neonLockedHigh]])],
      ['gemini-4-pro-locked', new Map([['low', proDisabledLow], ['high', proDisabledHigh]])],
    ]),
    modelOptions,
    get selectedModel() { return selectedModel; },
    orchestratorPlanners: planners,
    orchestratorPlannerIndex: new Map([['gemini-4-argon', new Map([['low', argLow], ['medium', argMed], ['high', argHigh]])]]),
    orchestratorDefaultPlanner: argMed,
    orchestratorPick: { model: null, select(v) { orchPicks.push(v); this.model = v === 0 ? null : v; } },
  };
  const globalModelCtx = {
    setModelConfigByLabelForConversation(label) {
      commits.push(label);
      selectedModel = modelOptions.find((o) => o.label === label) || selectedModel;
    },
  };

  const trigger = env.makeTrigger('Orchestrator');
  env.body.appendChild(trigger);
  const { panel, listWrap } = env.makePanel();
  const orchRow = env.makeEl('div', { attrs: { role: 'menuitem', 'data-testid': 'model-selector-orchestrator' }, text: 'Orchestrator' });
  listWrap.appendChild(orchRow);
  const argonRow = env.addGroupRow(listWrap, 'Gemini 4 Argon', 'Medium');
  const flashRow = env.addGroupRow(listWrap, 'Gemini 3.8 Flash', 'Low');
  env.addSingleRow(listWrap, claudeSon.label);
  env.addSingleRow(listWrap, gptOss.label);
  const neonAttrDisabledRow = env.addGroupRow(listWrap, 'Gemini 4 Neon', 'High');
  neonAttrDisabledRow.row.setAttribute('aria-disabled', 'true');
  const dataDisabledRow = env.addGroupRow(listWrap, 'Gemini 4 Pro Locked', 'Low');
  dataDisabledRow.row.setAttribute('data-disabled', '');
  env.body.appendChild(panel);
  env.attachFiberChain(panel, { selectorCtx, convId: 'conv-pro', globalModelCtx });

  const agObs = upstreamLib.installAntigravityObserver({ document: env.doc, window: env.win, MutationObserver: env.win.MutationObserver });
  assert.equal(env.html.getAttribute('data-ces-slider-ready'), '1');

  const sliderRoot = panel.querySelector('.ces-root');
  assert.equal(panel.querySelectorAll('.ces-tick').length, 3);
  sliderRoot.dispatchEvent({ type: 'keydown', key: 'End' });
  assert.equal(orchPicks[0], argHigh.value);

  const commitsBeforeDisabled = commits.length;
  for (const disTarget of [neonAttrDisabledRow.groupSpan, dataDisabledRow.groupSpan]) {
    const rDis = env.simulateNativeClick(disTarget, () => { isOpen = false; });
    assert.equal(rDis.pu._stopped, false);
    assert.equal(rDis.mu._stopped, false);
    assert.equal(rDis.ck.defaultPrevented, false);
    assert.equal(rDis.nativeCalled, true);
  }
  assert.equal(commits.length, commitsBeforeDisabled, 'Disabled/restricted models must NEVER call _commitAgOpt');

  isOpen = true;
  const rArg = env.simulateNativeClick(argonRow.groupSpan);
  assert.equal(rArg.ck.defaultPrevented, true);
  assert.equal(selectedModel.label, 'Gemini 4 Argon (Medium)');
  assert.equal(isOpen, true);

  const rFlash = env.simulateNativeClick(flashRow.groupSpan);
  assert.equal(rFlash.ck.defaultPrevented, true);
  assert.equal(selectedModel.label, 'Gemini 3.8 Flash (Low)');
  assert.equal(panel.querySelectorAll('.ces-tick').length, 2);

  agObs.stop();
});

test('Slider commits once after dragging, preserves prototypes, caches stage state and throttles rendering without contacting Google', async () => {
  const env = createSimEnv();
  const commits = [];
  const rowEl = env.makeEl('div', { className: 'ces-ag-effort-row' });
  const valEl = env.makeEl('span', { className: 'ces-ag-effort-value' });
  const container = env.makeEl('div', { className: 'ces-inline' });
  rowEl.appendChild(valEl);
  rowEl.appendChild(container);
  env.body.appendChild(rowEl);

  let official = 'low';
  const mountR1 = upstreamLib.mountCodexEffortSlider({
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
  assert.ok(track);
  // track rect width = 220, usable = 220 - 28 = 192, centers at x = 14, 78, 142, 206
  track.dispatchEvent({ type: 'pointerdown', button: 0, clientX: 14, pointerId: 1 });
  track.dispatchEvent({ type: 'pointermove', buttons: 1, clientX: 78, pointerId: 1 });
  assert.equal(valEl.textContent, 'Medium', 'pointermove must update visual preview immediately');
  track.dispatchEvent({ type: 'pointermove', buttons: 1, clientX: 142, pointerId: 1 });
  assert.equal(valEl.textContent, 'High');
  track.dispatchEvent({ type: 'pointermove', buttons: 1, clientX: 206, pointerId: 1 });
  assert.equal(valEl.textContent, 'Extra');
  assert.equal(commits.length, 0, 'R1: dragging across 4 tiers must trigger 0 commits before pointerup');

  track.dispatchEvent({ type: 'pointerup', button: 0, clientX: 206, pointerId: 1 });
  assert.deepEqual(commits, ['xhigh'], 'R1: pointerup must commit exactly 1 time with final tier');

  track.dispatchEvent({ type: 'pointerdown', button: 0, clientX: 206, pointerId: 2 });
  track.dispatchEvent({ type: 'pointermove', buttons: 1, clientX: 78, pointerId: 2 });
  track.dispatchEvent({ type: 'pointermove', buttons: 1, clientX: 206, pointerId: 2 });
  track.dispatchEvent({ type: 'pointerup', button: 0, clientX: 206, pointerId: 2 });
  assert.equal(commits.length, 1, 'R1: dragging away and returning to official tier before pointerup must trigger 0 extra commits');
  mountR1.unmount();

  const upSrc = fs.readFileSync(path.join(ROOT, 'vendor', 'effort-slider', 'upstream-client.js'), 'utf8');
  assert.equal(upSrc.includes('HTMLElement.prototype'), false, 'R2: upstream-client.js must not reference HTMLElement.prototype');
  assert.equal(upSrc.includes('Element.prototype'), false, 'R2: upstream-client.js must not reference Element.prototype');

  const envR2 = createSimEnv();
  const editor = envR2.makeEl('div', { attrs: { contenteditable: 'true' } });
  let blurCalls = 0;
  editor.blur = () => { blurCalls += 1; };
  envR2.body.appendChild(editor);
  const oLow = { label: 'Gemini 4 Neon (Low)', modelId: 'n-low', value: 1 };
  const oHigh = { label: 'Gemini 4 Neon (High)', modelId: 'n-high', value: 2 };
  const cLow = { label: 'Claude 4.5 (Low)', modelId: 'c-low', value: 3 };
  const cHigh = { label: 'Claude 4.5 (High)', modelId: 'c-high', value: 4 };
  let selR2 = oLow;
  const { panel: pR2, listWrap: lwR2 } = envR2.makePanel();
  const cRowR2 = envR2.addGroupRow(lwR2, 'Claude 4.5', 'High');
  envR2.body.appendChild(pR2);
  envR2.attachFiberChain(pR2, {
    selectorCtx: {
      effortIndex: new Map([
        ['Gemini 4 Neon', new Map([['low', oLow], ['high', oHigh]])],
        ['Claude 4.5', new Map([['low', cLow], ['high', cHigh]])],
      ]),
      modelOptions: [oLow, oHigh, cLow, cHigh],
      get selectedModel() { return selR2; },
    },
    popoverProps: {
      modelOptions: [oLow, oHigh, cLow, cHigh],
      get selectedModel() { return selR2; },
      open: true,
      setIsOpen() {},
      setSelectedModel(opt) {
        selR2 = opt;
        envR2.doc.activeElement = editor;
        editor.dispatchEvent({ type: 'focus' });
      },
    },
  });
  const protoFocus = function () {};
  const FakeHTMLElement = { prototype: { focus: protoFocus } };
  const FakeElement = { prototype: { focus: protoFocus } };
  const prevHtmlEl = globalThis.HTMLElement;
  const prevEl = globalThis.Element;
  const prevDoc = globalThis.document;
  globalThis.HTMLElement = FakeHTMLElement;
  globalThis.Element = FakeElement;
  globalThis.document = envR2.doc;
  try {
    const obsR2 = upstreamLib.installAntigravityObserver({ document: envR2.doc, window: envR2.win, MutationObserver: envR2.win.MutationObserver });
    envR2.simulateNativeClick(cRowR2.groupSpan);
    assert.equal(FakeHTMLElement.prototype.focus, protoFocus, 'R2: HTMLElement.prototype.focus must stay untouched');
    assert.equal(FakeElement.prototype.focus, protoFocus, 'R2: Element.prototype.focus must stay untouched');
    assert.ok(blurCalls >= 1, 'R2: scoped focus listener on editor must neutralize focus theft without prototype mutation');
    obsR2.stop();
  } finally {
    if (prevHtmlEl === undefined) delete globalThis.HTMLElement; else globalThis.HTMLElement = prevHtmlEl;
    if (prevEl === undefined) delete globalThis.Element; else globalThis.Element = prevEl;
    if (prevDoc === undefined) delete globalThis.document; else globalThis.document = prevDoc;
  }

  const sbSrc = fs.readFileSync(path.join(ROOT, 'vendor', 'sidebar-studio', 'sidebar-client.js'), 'utf8');
  assert.ok(sbSrc.includes('cachedStartCascadeStage'), 'R3: sidebar-client.js must cache winning startCascade stage');
  let startStageCalls = 0;
  const sbEnv = createSimEnv();
  const fakeLs = {
    async startCascade(arg) {
      startStageCalls += 1;
      if (arg.customAgentSpec && 'workspace' in arg.customAgentSpec) {
        throw new Error('unsupported workspace field');
      }
      return { cascadeId: `cid-${startStageCalls}` };
    },
    async sendUserCascadeMessage() { return {}; },
  };
  const rootEl = sbEnv.makeEl('div', { attrs: { id: 'root' } });
  rootEl.__reactFiber$r3 = {
    tag: 10,
    memoizedProps: { value: { store: { getState: () => ({ trajectorySummaries: { summaries: {} } }), subscribe: () => () => {} } } },
    sibling: {
      tag: 10,
      memoizedProps: { value: { sendUserCascadeMessage: async () => ({}) } },
      sibling: {
        tag: 10,
        memoizedProps: { value: { navigate: () => {}, subscribe: () => () => {} } },
        sibling: {
          tag: 10,
          memoizedProps: { value: { core: { projectManagementService: { projectsStateProvider: { getState: () => [] }, lsClient: fakeLs } } } },
        },
      },
    },
  };
  sbEnv.body.appendChild(rootEl);
  const sbCtx = {
    window: null,
    globalThis: null,
    document: sbEnv.doc,
    localStorage: sbEnv.localStorage,
    MutationObserver: sbEnv.win.MutationObserver,
    ResizeObserver: class { observe() {} disconnect() {} },
    requestAnimationFrame: sbEnv.win.requestAnimationFrame,
    cancelAnimationFrame: sbEnv.win.cancelAnimationFrame,
    getComputedStyle: sbEnv.win.getComputedStyle,
    performance: sbEnv.win.performance,
    setTimeout,
    clearTimeout,
    Map, Set, Array, Object, Math, Number, String, Boolean, Date, RegExp, JSON, Promise, Error, URL,
    __agPrismSidebarResolve: undefined,
    __agPrismSidebarMeta: { baseUrl: 'http://127.0.0.1:0' },
  };
  sbCtx.window = sbCtx;
  sbCtx.globalThis = sbCtx;
  vm.runInNewContext(sbSrc, sbCtx);
  sbCtx.__agPrismSidebar.sync({ sidebarStudio: 'on' });
  await new Promise((r) => setTimeout(r, 15));
  const ops = sbCtx.__agPrismSidebarHostOps;
  const r1 = await ops.reserveSession({ idempotencyKey: 'r3-1', scopeRef: 's1', kind: 'knowledge', title: 'T1', dirPath: '' });
  assert.equal(r1.ok, true);
  assert.equal(startStageCalls, 2, 'First reserveSession probes stage1 -> falls back to stage2 (2 calls)');
  const r2 = await ops.reserveSession({ idempotencyKey: 'r3-2', scopeRef: 's1', kind: 'knowledge', title: 'T2', dirPath: '' });
  assert.equal(r2.ok, true);
  assert.equal(startStageCalls, 3, 'R3: second reserveSession must hit cached stage2 directly in 1 call (0 failing probes)');
  sbCtx.__agPrismSidebar.destroy();

  const expr = cdp.buildInjectExpression(cdp.DEFAULT_CONFIG);
  const googleTransRe = new RegExp(['translate', 'googleapis', 'com'].join('\\.'), 'i');
  assert.equal(googleTransRe.test(expr), false, 'R4: compiled bundle must contain zero translate.googleapis.com');
  assert.ok(Buffer.byteLength(expr, 'utf8') <= 704000, 'Default bundle must stay <= 704,000 B (< 690 KiB)');

  const iwSrc = fs.readFileSync(path.join(ROOT, 'vendor', 'pulse-dashboard', 'compat', 'inline-widget.cjs'), 'utf8');
  const qm = iwSrc.match(/QUOTA_HOVER_COOLDOWN=(\d+)/);
  assert.ok(qm && Number(qm[1]) >= 20000, 'R5: QUOTA_HOVER_COOLDOWN must be >= 20000ms');
  const mm = iwSrc.match(/MANUAL_REFRESH_COOLDOWN=(\d+)/);
  assert.ok(mm && Number(mm[1]) >= 5000, 'R5: MANUAL_REFRESH_COOLDOWN must be >= 5000ms');

  const hweSrc = fs.readFileSync(path.join(ROOT, 'host-workbench-enhancer.js'), 'utf8');
  const hweEnv = createSimEnv();
  const conv = hweEnv.makeEl('div', { attrs: { 'data-testid': 'conversation-view' } });
  const turn1 = hweEnv.makeEl('div', { attrs: { 'data-testid': 'user-input-step' } });
  const turn2 = hweEnv.makeEl('div', { attrs: { 'data-testid': 'user-input-step' } });
  conv.appendChild(turn1);
  let foldClicks = 0;
  for (let i = 0; i < 6; i++) {
    const b = hweEnv.makeEl('button', { attrs: { 'data-testid': 'worked-for-collapsible', 'aria-expanded': 'true' } });
    b.click = () => { foldClicks += 1; b.setAttribute('aria-expanded', 'false'); };
    b.compareDocumentPosition = (other) => (other === turn2 ? 2 : 4);
    conv.appendChild(b);
  }
  conv.appendChild(turn2);
  turn2.compareDocumentPosition = () => 2; // preceding relative to earlier nodes
  hweEnv.body.appendChild(conv);

  const hweSb = {
    document: hweEnv.doc,
    window: hweEnv.win,
    requestAnimationFrame: hweEnv.win.requestAnimationFrame.bind(hweEnv.win),
    cancelAnimationFrame: hweEnv.win.cancelAnimationFrame.bind(hweEnv.win),
    performance: hweEnv.win.performance,
    MutationObserver: hweEnv.win.MutationObserver,
    ResizeObserver: class { observe() {} disconnect() {} },
    getComputedStyle: hweEnv.win.getComputedStyle,
    setTimeout,
    clearTimeout,
    Map, Set, WeakMap, WeakSet, Array, Object, Math, Number, String, Boolean,
  };
  hweSb.window = hweSb;
  hweSb.globalThis = hweSb;
  vm.runInNewContext(hweSrc, hweSb);
  const hweCtl = hweSb.__agPrismHostEnhancer.createHostEnhancerController({
    isDestroyed: () => false,
    isDarkTheme: () => true,
    isZh: () => true,
    getLang: () => 'ar',
    setAttrIfChanged: (el, k, v) => el.setAttribute(k, v),
    runGuardedMut: (fn) => fn(),
  });
  const totalFold = hweCtl.foldHistoricalSteps();
  assert.equal(totalFold, 6, 'R5: foldHistoricalSteps must return total matched count');
  assert.equal(foldClicks, 2, 'R5: first frame must click only 2 collapsibles');
  hweEnv.advanceRaf();
  assert.equal(foldClicks, 4, 'R5: second frame clicks next 2 collapsibles');
  hweCtl.destroy();
  hweEnv.advanceRaf();
  assert.equal(foldClicks, 4, 'R5: destroy() must cancel remaining pending foldRafId');
});

test('Orchestrator keeps model selection open and hides redundant Arabic and English effort menus', () => {
  const env = createSimEnv();
  const neonLow = { label: 'Gemini 4 Neon (Low)', modelId: 'gemini-4-neon-low', value: 1534 };
  const neonMed = { label: 'Gemini 4 Neon (Medium)', modelId: 'gemini-4-neon-medium', value: 1533 };
  const neonHigh = { label: 'Gemini 4 Neon (High)', modelId: 'gemini-4-neon-high', value: 1532 };
  const neonXHigh = { label: 'Gemini 4 Neon (XHigh)', modelId: 'gemini-4-neon-xhigh', value: 1535 };
  const carbLow = { label: 'Gemini 4 Carbon (Low)', modelId: 'gemini-4-carbon-low', value: 1520 };
  const carbMed = { label: 'Gemini 4 Carbon (Medium)', modelId: 'gemini-4-carbon-medium', value: 1521 };
  const carbHigh = { label: 'Gemini 4 Carbon (High)', modelId: 'gemini-4-carbon-high', value: 1522 };
  const opusLow = { label: 'Claude Opus 5.5 (Low)', modelId: 'claude-opus-5-5-low', value: 1400 };
  const opusMed = { label: 'Claude Opus 5.5 (Medium)', modelId: 'claude-opus-5-5-medium', value: 1401 };
  const opusHigh = { label: 'Claude Opus 5.5 (High)', modelId: 'claude-opus-5-5-high', value: 1402 };
  const orchNeon = { label: 'Orchestrator (Neon)', modelId: 'gemini-pro-orchestrator-neon', value: 1537 };

  const planners = [neonLow, neonMed, neonHigh, neonXHigh, carbLow, carbMed, carbHigh, opusLow, opusMed, opusHigh];
  const modelOptions = [...planners, orchNeon];
  let selectedModel = neonXHigh;
  let isOpen = true;
  const commits = [];
  const orchPicks = [];

  const plannerIdx = new Map([
    ['gemini-4-neon', new Map([['low', neonLow], ['medium', neonMed], ['high', neonHigh], ['xhigh', neonXHigh]])],
    ['gemini-4-carbon', new Map([['low', carbLow], ['medium', carbMed], ['high', carbHigh]])],
    ['claude-opus-5-5', new Map([['low', opusLow], ['medium', opusMed], ['high', opusHigh]])],
  ]);
  const selectorCtx = {
    effortIndex: plannerIdx,
    modelOptions,
    get selectedModel() { return selectedModel; },
    orchestratorPlanners: planners,
    orchestratorPlannerIndex: plannerIdx,
    orchestratorDefaultPlanner: neonXHigh,
    orchestratorPick: {
      model: null,
      select(v) { orchPicks.push(v); this.model = v === 0 ? null : v; },
    },
  };
  const globalModelCtx = {
    setModelConfigByLabelForConversation(label, convId, keepOpen) {
      commits.push({ label, convId, keepOpen });
      selectedModel = modelOptions.find((o) => o.label === label) || selectedModel;
    },
  };

  const trigger = env.makeTrigger('Gemini 4 Neon', 'Extra');
  env.body.appendChild(trigger);
  const { panel, listWrap } = env.makePanel();
  const neonRow = env.addGroupRow(listWrap, 'Gemini 4 Neon', 'Extra');
  const orchRow = env.makeEl('div', { attrs: { role: 'menuitem', 'data-testid': 'model-selector-orchestrator' }, text: 'Orchestrator Gemini 4 Neon Extra New' });
  listWrap.appendChild(orchRow);
  env.body.appendChild(panel);
  env.attachFiberChain(panel, { selectorCtx, convId: 'conv-orch-8', globalModelCtx });

  const agObs = upstreamLib.installAntigravityObserver({ document: env.doc, window: env.win, MutationObserver: env.win.MutationObserver });

  const sliderStyle = env.doc.getElementById('ag-codex-effort-slider-styles');
  assert.ok(sliderStyle, 'Slider style tag must be injected');
  assert.equal(sliderStyle.textContent.includes(':is(>svg'), false, 'SLIDER_CSS must NOT contain invalid :is(>svg...) relative selector');
  assert.equal(
    sliderStyle.textContent.includes("[data-ces-orch-row='1']>svg:last-child:not(:first-child):not(.lucide-check)"),
    true,
    'SLIDER_CSS must use standard top-level selector to hide L2 chevron arrow'
  );

  const rEnterOrch = env.simulateNativeClick(orchRow, () => { isOpen = false; });
  assert.equal(rEnterOrch.pu._stopped, true);
  assert.equal(rEnterOrch.ck.defaultPrevented, true);
  assert.equal(rEnterOrch.nativeCalled, false, 'Switching from normal model to Orchestrator must keep menu open');
  assert.equal(isOpen, true);
  assert.equal(selectedModel, orchNeon);
  assert.equal(panel.getAttribute('data-ces-orch-tunable'), 'true');
  assert.equal(orchRow.getAttribute('data-ces-model-selected'), 'true');
  assert.equal(neonRow.row.getAttribute('data-ces-model-selected'), 'false');

  const rSecondOrch = env.simulateNativeClick(orchRow, () => { isOpen = false; });
  assert.equal(rSecondOrch.ck.defaultPrevented, false);
  assert.equal(rSecondOrch.nativeCalled, true);
  assert.equal(isOpen, false);
  isOpen = true;

  const subOverlay = env.makeEl('div', { className: 'agy-overlay' });
  const subMenu = env.makeEl('div', { attrs: { role: 'menu' } });
  const subNeon = env.makeEl('div', { attrs: { role: 'menuitemradio' }, text: 'Gemini 4 Neon Medium' });
  const subCarb = env.makeEl('div', { attrs: { role: 'menuitemradio' }, text: 'Gemini 4 Carbon Medium' });
  const subOpus = env.makeEl('div', { attrs: { role: 'menuitemradio' }, text: 'Claude Opus 5.5 Medium' });
  const subDis = env.makeEl('div', { attrs: { role: 'menuitemradio', 'aria-disabled': 'true' }, text: 'Gemini 4 Carbon Medium' });
  subMenu.appendChild(subNeon);
  subMenu.appendChild(subCarb);
  subMenu.appendChild(subOpus);
  subMenu.appendChild(subDis);
  subOverlay.appendChild(subMenu);
  env.body.appendChild(subOverlay);

  const l3Overlay = env.makeEl('div', { className: 'agy-overlay' });
  const l3Menu = env.makeEl('div', { attrs: { role: 'menu' } });
  l3Menu.appendChild(env.makeEl('div', { attrs: { role: 'menuitem' }, text: 'Low' }));
  l3Menu.appendChild(env.makeEl('div', { attrs: { role: 'menuitem' }, text: 'Medium ✓' }));
  l3Menu.appendChild(env.makeEl('div', { attrs: { role: 'menuitem' }, text: 'High' }));
  l3Overlay.appendChild(l3Menu);
  env.body.appendChild(l3Overlay);

  const zhL3Menu = env.makeEl('div', { attrs: { role: 'menu' } });
  zhL3Menu.appendChild(env.makeEl('div', { attrs: { role: 'menuitem' }, text: 'منخفض' }));
  zhL3Menu.appendChild(env.makeEl('div', { attrs: { role: 'menuitem' }, text: 'متوسط ✓' }));
  zhL3Menu.appendChild(env.makeEl('div', { attrs: { role: 'menuitem' }, text: 'عالي' }));
  zhL3Menu.appendChild(env.makeEl('div', { attrs: { role: 'menuitem' }, text: 'فائق' }));
  subOverlay.appendChild(zhL3Menu);

  const unrelatedMenu = env.makeEl('div', { attrs: { role: 'menu' } });
  const copyItem = env.makeEl('div', { attrs: { role: 'menuitem' }, text: 'Copy' });
  const pasteItem = env.makeEl('div', { attrs: { role: 'menuitem' }, text: 'Paste' });
  unrelatedMenu.appendChild(copyItem);
  unrelatedMenu.appendChild(pasteItem);
  env.body.appendChild(unrelatedMenu);

  agObs.rescan();
  assert.equal(subMenu.getAttribute('data-ag-cs-model-submenu'), '1');
  assert.equal(subMenu.getAttribute('data-ag-cs-orch-l2'), '1');
  assert.equal(subOverlay.getAttribute('data-ag-cs-model-submenu'), '1');
  assert.equal(subNeon.getAttribute('data-ces-orch-row'), '1');
  assert.equal(subNeon.getAttribute('data-ces-model-selected'), 'true');
  assert.equal(l3Menu.getAttribute('data-ag-cs-orch-l3'), '1', 'Redundant Layer 3 effort submenu must be hidden');
  assert.equal(l3Overlay.getAttribute('data-ag-cs-orch-l3'), '1', 'Layer 3 dedicated overlay must be hidden');
  assert.equal(zhL3Menu.getAttribute('data-ag-cs-orch-l3'), '1', 'Localized Arabic Layer 3 effort submenu must be hidden');
  assert.equal(subOverlay.hasAttribute('data-ag-cs-orch-l3'), false, 'Shared overlay containing Layer 2 must NEVER be hidden as Layer 3');
  assert.equal(unrelatedMenu.hasAttribute('data-ag-cs-model-submenu'), false, 'Unrelated context menu must never be touched');
  assert.equal(unrelatedMenu.hasAttribute('data-ag-cs-orch-l3'), false, 'Unrelated context menu must never be hidden as Layer 3');

  const pdEv = { type: 'pointerdown', button: 0, bubbles: true };
  const mdEv = { type: 'mousedown', button: 0, bubbles: true };
  subOpus.dispatchEvent(pdEv);
  subOpus.dispatchEvent(mdEv);
  assert.equal(pdEv._stopped, true, 'pointerdown on Layer 2 planner must be stopped');
  assert.equal(mdEv._stopped, true, 'mousedown on Layer 2 planner must be stopped');
  assert.equal(mdEv.defaultPrevented, true, 'mousedown on Layer 2 planner must preventDefault to avoid blur-close');

  const rPickOpus = env.simulateNativeClick(subOpus, () => { isOpen = false; });
  assert.equal(rPickOpus.pu._stopped, true);
  assert.equal(rPickOpus.ck.defaultPrevented, true);
  assert.equal(rPickOpus.nativeCalled, false, 'Clicking new Orchestrator planner in submenu must keep model selector open');
  assert.equal(isOpen, true);
  assert.equal(orchPicks[orchPicks.length - 1], opusMed.value);
  assert.equal(subOpus.getAttribute('data-ces-model-selected'), 'true');
  assert.equal(subNeon.getAttribute('data-ces-model-selected'), 'false');
  assert.equal(panel.querySelector('.ces-root').getAttribute('data-theme'), 'claude');

  panel.querySelector('.ces-root').dispatchEvent({ type: 'keydown', key: 'Home' });
  assert.equal(orchPicks[orchPicks.length - 1], opusLow.value);

  const picksBeforeDis = orchPicks.length;
  const rDis = env.simulateNativeClick(subDis, () => { isOpen = false; });
  assert.equal(rDis.ck.defaultPrevented, false);
  assert.equal(rDis.nativeCalled, true);
  assert.equal(orchPicks.length, picksBeforeDis);

  isOpen = true;
  const rCopy = env.simulateNativeClick(copyItem, () => { isOpen = false; });
  assert.equal(rCopy.ck.defaultPrevented, false);
  assert.equal(rCopy.nativeCalled, true);

  subOverlay.remove();
  agObs.rescan();
  const btnOverlay = env.makeEl('div', { className: 'agy-overlay' });
  const btnNeon = env.makeEl('button', { text: 'Gemini 4 Neon Medium' });
  const btnCarb = env.makeEl('button', { text: 'Gemini 4 Carbon Medium' });
  btnOverlay.appendChild(btnNeon);
  btnOverlay.appendChild(btnCarb);
  env.body.appendChild(btnOverlay);
  agObs.rescan();
  assert.equal(btnOverlay.getAttribute('data-ag-cs-orch-l2'), '1', 'Overlay without role=menu containing button planner rows must still be detected as Layer 2');

  isOpen = true;
  const rBackNeon = env.simulateNativeClick(neonRow.groupSpan, () => { isOpen = false; });
  assert.equal(rBackNeon.ck.defaultPrevented, true);
  assert.equal(selectedModel.label.startsWith('Gemini 4 Neon'), true);
  assert.equal(isOpen, true);

  const rDirectCarb = env.simulateNativeClick(btnCarb, () => { isOpen = false; });
  assert.equal(rDirectCarb.ck.defaultPrevented, true);
  assert.equal(rDirectCarb.nativeCalled, false, 'Clicking .agy-overlay button planner must intercept click before bubbling to .agy-overlay');
  assert.equal(isOpen, true);
  assert.equal(selectedModel, orchNeon);
  assert.equal(orchPicks[orchPicks.length - 1], carbMed.value);
  assert.equal(btnCarb.getAttribute('data-ces-model-selected'), 'true');

  const rRepeatCarb = env.simulateNativeClick(btnCarb, () => { isOpen = false; });
  assert.equal(rRepeatCarb.ck.defaultPrevented, false, 'Re-clicking already selected planner must Fail-Open');
  assert.equal(rRepeatCarb.nativeCalled, true, 'simulateNativeClick must actually observe bubbling on .agy-overlay when Fail-Open');

  panel.remove();
  agObs.rescan();
  assert.equal(btnOverlay.hasAttribute('data-ag-cs-model-submenu'), false);
  assert.equal(btnOverlay.hasAttribute('data-ag-cs-orch-l2'), false);
  assert.equal(btnCarb.hasAttribute('data-ces-orch-row'), false);
  assert.equal(l3Menu.hasAttribute('data-ag-cs-orch-l3'), false);
  assert.equal(l3Overlay.hasAttribute('data-ag-cs-orch-l3'), false);

  btnOverlay.setAttribute('data-ag-cs-model-submenu', '1');
  btnOverlay.setAttribute('data-ag-cs-orch-l2', '1');
  l3Menu.setAttribute('data-ag-cs-orch-l3', '1');
  btnCarb.setAttribute('data-ces-orch-row', '1');
  env.html.setAttribute('data-ces-slider-ready', '1');
  agObs.stop();
  assert.equal(btnOverlay.hasAttribute('data-ag-cs-model-submenu'), false);
  assert.equal(btnOverlay.hasAttribute('data-ag-cs-orch-l2'), false);
  assert.equal(l3Menu.hasAttribute('data-ag-cs-orch-l3'), false);
  assert.equal(btnCarb.hasAttribute('data-ces-orch-row'), false);
  assert.equal(env.html.hasAttribute('data-ces-slider-ready'), false);
});

test('Effort aliases preserve localized labels without mount flicker and clear on unmount', () => {
  const env = createSimEnv();
  const rowEl = env.makeEl('div', { className: 'ces-ag-effort-row' });
  const valEl = env.makeEl('span', { className: 'ces-ag-effort-value' });
  const container = env.makeEl('div', { className: 'ces-inline' });
  rowEl.appendChild(valEl);
  rowEl.appendChild(container);
  env.body.appendChild(rowEl);

  let official = 'medium';
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
        { effort: 'minimal', label: 'Minimal' },
        { effort: 'low', label: 'Low' },
        { effort: 'medium', label: 'Medium' },
        { effort: 'high', label: 'High' },
        { effort: 'xhigh', label: 'Extra' },
      ],
      get currentEffort() { return official; },
      selectEffort() {},
    },
  });

  // 1) Initial mount fills empty valEl without replaying ces-text-rise
  assert.equal(valEl.textContent, 'Medium');
  assert.equal(valEl.classList.contains('ces-text-rise'), false, 'Initial mount must not trigger rise flicker');

  // 2) External i18n rewrites (Simplified/Traditional/Parenthesized/Unknown locale) cause 0 overwrites and 0 rise animations
  for (const localized of ['متوسط', 'متوسط', '(متوسط)', 'متوسطتفكير', 'Moyen']) {
    valEl.textContent = localized;
    mount.refresh();
    assert.equal(valEl.textContent, localized, `refresh() must preserve external translation "${localized}"`);
    assert.equal(valEl.classList.contains('ces-text-rise'), false);
    assert.equal(valEl.classList.contains('is-claude-changing'), false);
  }

  // 3) Empty DOM with non-empty target must self-heal back to target label
  valEl.textContent = '';
  mount.refresh();
  assert.equal(valEl.textContent, 'Medium', 'Empty valEl must be rewritten when logical label is non-empty');

  // 4) Genuine tier transition updates text and triggers rise animation once
  valEl.textContent = 'متوسط';
  official = 'high';
  mount.refresh();
  assert.equal(valEl.textContent, 'High');
  assert.equal(valEl.classList.contains('ces-text-rise'), true, 'Real tier transition must still trigger rise animation');

  // Traditional Chinese alias for xhigh pre-populated before mount must not flash English or replay rise
  mount.unmount();
  assert.equal(valEl.__cesLastLabel, undefined, 'unmount() must clear __cesLastLabel to avoid stale cache on remount');

  valEl.classList.remove('ces-text-rise', 'is-claude-changing');
  valEl.textContent = '(تفكير فائق)';
  official = 'xhigh';
  const remount = upstreamLib.mountCodexEffortSlider({
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
      selectEffort() {},
    },
  });
  assert.equal(valEl.textContent, '(تفكير فائق)', 'Initial mount on pre-localized Traditional Chinese valEl must not flash English');
  assert.equal(valEl.classList.contains('ces-text-rise'), false, 'Initial mount on pre-localized valEl must not trigger rise');
  remount.unmount();
});

test('Effort text updates prevent repeated DOM writes and clear cache when the slider is disabled', () => {
  const env = createSimEnv();
  const neonLow = { label: 'Gemini 4 Neon (Low)', modelId: 'gemini-4-neon-low', value: 1534 };
  const neonMed = { label: 'Gemini 4 Neon (Medium)', modelId: 'gemini-4-neon-medium', value: 1533 };
  const neonHigh = { label: 'Gemini 4 Neon (High)', modelId: 'gemini-4-neon-high', value: 1532 };
  const neonXHigh = { label: 'Gemini 4 Neon (XHigh)', modelId: 'gemini-4-neon-xhigh', value: 1535 };
  const carbLow = { label: 'Gemini 4 Carbon (Low)', modelId: 'gemini-4-carbon-low', value: 1520 };
  const carbMed = { label: 'Gemini 4 Carbon (Medium)', modelId: 'gemini-4-carbon-medium', value: 1521 };
  const carbHigh = { label: 'Gemini 4 Carbon (High)', modelId: 'gemini-4-carbon-high', value: 1522 };
  const modelOptions = [neonLow, neonMed, neonHigh, neonXHigh, carbLow, carbMed, carbHigh];
  let selectedModel = neonMed;

  const selectorCtx = {
    effortIndex: new Map([
      ['gemini-4-neon', new Map([['low', neonLow], ['medium', neonMed], ['high', neonHigh], ['xhigh', neonXHigh]])],
      ['gemini-4-carbon', new Map([['low', carbLow], ['medium', carbMed], ['high', carbHigh]])],
    ]),
    modelOptions,
    get selectedModel() { return selectedModel; },
  };
  const globalModelCtx = {
    setModelConfigByLabelForConversation(label) {
      selectedModel = modelOptions.find((o) => o.label === label) || selectedModel;
    },
  };

  const trigger = env.makeTrigger('Gemini 4 Neon', 'Medium');
  const effortSpan = trigger.querySelector('span.opacity-70');
  env.body.appendChild(trigger);

  const { panel, listWrap } = env.makePanel();
  const neonRow = env.addGroupRow(listWrap, 'Gemini 4 Neon', 'Medium');
  const carbRow = env.addGroupRow(listWrap, 'Gemini 4 Carbon', 'Medium');
  env.body.appendChild(panel);
  env.attachFiberChain(panel, { selectorCtx, convId: 'conv-i18n-10', globalModelCtx });
  env.attachFiberChain(trigger, { selectorCtx, convId: 'conv-i18n-10', globalModelCtx });

  const agObs = upstreamLib.installAntigravityObserver({
    document: env.doc,
    window: env.win,
    MutationObserver: env.win.MutationObserver,
  });

  const valEl = panel.querySelector('.ces-ag-effort-value');
  assert.ok(valEl, 'Slider value element must be mounted');
  assert.equal(valEl.textContent, 'Medium');
  assert.equal(valEl.classList.contains('ces-text-rise'), false, 'Panel mount must not replay ces-text-rise');

  // Simulate external Chinese i18n rewriting all three sites simultaneously
  valEl.textContent = 'متوسط';
  effortSpan.textContent = ' متوسط';
  neonRow.effortSpan.textContent = 'متوسط';
  carbRow.effortSpan.textContent = 'متوسط';

  let valWrites = 0, trigWrites = 0, sibWrites = 0;
  const wrapTextWrite = (el, onWrite) => {
    const desc = Object.getOwnPropertyDescriptor(el, 'textContent');
    Object.defineProperty(el, 'textContent', {
      configurable: true,
      get: desc.get,
      set(v) { onWrite(v); desc.set.call(this, v); },
    });
  };
  wrapTextWrite(valEl, () => { valWrites += 1; });
  wrapTextWrite(effortSpan, () => { trigWrites += 1; });
  wrapTextWrite(neonRow.effortSpan, () => { sibWrites += 1; });

  // Multiple rescans with unchanged tier must cause ZERO overwrites on all 3 sites
  for (let i = 0; i < 5; i += 1) agObs.rescan();
  assert.equal(valWrites, 0, 'valEl must have 0 ping-pong overwrites');
  assert.equal(trigWrites, 0, 'trigger effortSpan must have 0 ping-pong overwrites');
  assert.equal(sibWrites, 0, 'menu row sib must have 0 ping-pong overwrites');
  assert.equal(valEl.textContent, 'متوسط');
  assert.equal(effortSpan.textContent, ' متوسط');
  assert.equal(neonRow.effortSpan.textContent, 'متوسط');
  assert.equal(carbRow.effortSpan.textContent, 'متوسط');

  // allInsideSlider self-trigger guard: mutations strictly inside .ces-ag-section must skip scan()
  const mo = env.observers[env.observers.length - 1];
  let getSelectedReads = 0;
  const origSelDesc = Object.getOwnPropertyDescriptor(selectorCtx, 'selectedModel');
  Object.defineProperty(selectorCtx, 'selectedModel', {
    configurable: true,
    get() { getSelectedReads += 1; return origSelDesc.get(); },
  });
  const readsBeforeInsideMut = getSelectedReads;
  mo.trigger([{ type: 'characterData', target: valEl }]);
  assert.equal(getSelectedReads, readsBeforeInsideMut, 'allInsideSlider mutation must skip scan() completely');

  // Genuine tier switch Medium -> Extra (xhigh) must update all 3 sites cleanly
  selectedModel = neonXHigh;
  agObs.rescan();
  assert.equal(valEl.textContent, 'Extra');
  assert.equal(effortSpan.textContent, ' Extra');
  assert.equal(neonRow.effortSpan.textContent, 'Extra');

  // External i18n translates Extra -> فائق (Traditional Chinese) -> again 0 ping-pong overwrites
  valEl.textContent = 'فائق';
  effortSpan.textContent = ' فائق';
  neonRow.effortSpan.textContent = 'تفكير فائق';
  const w1 = valWrites, w2 = trigWrites, w3 = sibWrites;
  agObs.rescan();
  agObs.rescan();
  assert.equal(valWrites, w1);
  assert.equal(trigWrites, w2);
  assert.equal(sibWrites, w3);

  // Empty DOM on sib must still be restored when logical label is non-empty
  neonRow.effortSpan.textContent = '';
  agObs.rescan();
  assert.equal(neonRow.effortSpan.textContent, 'Extra', 'Empty sib must be restored even if __cesLastText matched');

  // Stopping observer clears __cesLastText & __cesLastLabel so remount never sees stale cache
  agObs.stop();
  assert.equal(effortSpan.__cesLastText, undefined, '_clrAgDom must clear effortSpan.__cesLastText');
  assert.equal(neonRow.effortSpan.__cesLastText, undefined, '_clrAgDom/_unmntSec must clear sib.__cesLastText');
  assert.equal(valEl.__cesLastLabel, undefined, '_unmntSec must clear valEl.__cesLastLabel');
});

test('Scenario 11 (PR #35 / Issue #34 View Usage false-positive Orchestrator L2 regression): View Usage popup containing Gemini 4 Argon quota rows must never be bound as Orchestrator L2 submenu or switch model to Orchestrator on click', () => {
  const env = createSimEnv();
  const neonHigh = { label: 'Gemini 4 Neon (High)', modelId: 'gemini-4-neon-high', value: 1532 };
  const neonMed = { label: 'Gemini 4 Neon (Medium)', modelId: 'gemini-4-neon-medium', value: 1533 };
  const argonHigh = { label: 'Gemini 4 Argon (High)', modelId: 'gemini-4-argon-high', value: 1417 };
  const argonMed = { label: 'Gemini 4 Argon (Medium)', modelId: 'gemini-4-argon-medium', value: 1418 };
  const argonXHigh = { label: 'Gemini 4 Argon (Extra)', modelId: 'gemini-4-argon-xhigh', value: 1419 };
  const orchNeon = { label: 'Orchestrator (Neon)', modelId: 'gemini-pro-orchestrator-neon', value: 1537 };

  const planners = [neonHigh, neonMed, argonHigh, argonMed, argonXHigh];
  const modelOptions = [...planners, orchNeon];
  let selectedModel = neonHigh;
  const commits = [];
  const orchPicks = [];

  const plannerIdx = new Map([
    ['gemini-4-neon', new Map([['medium', neonMed], ['high', neonHigh]])],
    ['gemini-4-argon', new Map([['medium', argonMed], ['high', argonHigh], ['xhigh', argonXHigh]])],
  ]);
  const selectorCtx = {
    effortIndex: plannerIdx,
    modelOptions,
    get selectedModel() { return selectedModel; },
    orchestratorPlanners: planners,
    orchestratorPlannerIndex: plannerIdx,
    orchestratorDefaultPlanner: neonHigh,
    orchestratorPick: {
      model: argonMed.value,
      select(v) { orchPicks.push(v); this.model = v; },
    },
  };
  const globalModelCtx = {
    setModelConfigByLabelForConversation(label, convId, keepOpen) {
      commits.push({ label, convId, keepOpen });
      selectedModel = modelOptions.find((o) => o.label === label) || selectedModel;
    },
  };

  const trigger = env.makeTrigger('Gemini 4 Neon', 'High');
  env.body.appendChild(trigger);
  const { panel, listWrap } = env.makePanel();
  env.addGroupRow(listWrap, 'Gemini 4 Neon', 'High');
  env.addGroupRow(listWrap, 'Gemini 4 Argon', 'Medium');
  const orchRow = env.makeEl('div', { attrs: { role: 'menuitem', 'data-testid': 'model-selector-orchestrator' }, text: 'Orchestrator Gemini 4 Argon Medium New' });
  listWrap.appendChild(orchRow);
  const viewUsageRow = env.makeEl('div', { attrs: { role: 'menuitem', 'aria-haspopup': 'menu' }, text: 'View Usage' });
  panel.appendChild(viewUsageRow);
  env.body.appendChild(panel);
  env.attachFiberChain(panel, { selectorCtx, convId: 'conv-usage-11', globalModelCtx });

  // Build exact Antigravity v2.34 View Usage nested popup:
  // outer <div data-side="right" role="presentation"> wrapping <div data-side="right" tabindex="-1" role="menu" class="agy-overlay">
  const usagePositioner = env.makeEl('div', {
    className: 'z-[6000]',
    attrs: { 'data-side': 'right', 'data-align': 'start', 'data-nested': '', role: 'presentation' },
  });
  const usageMenu = env.makeEl('div', {
    className: 'agy-overlay surface-glass bg-card',
    attrs: { 'data-side': 'right', 'data-align': 'start', 'data-nested': '', tabindex: '-1', role: 'menu' },
  });
  const usageBody = env.makeEl('div', {
    text: 'UsageRefreshing...Gemini ModelsWeekly limit57% leftResets in 5d 14h5h limit97% leftResets in 4h 28mClaude and GPT modelsWeekly limit61% leftResets in 3d 12h5h limit100% leftGemini 4 Argon57% leftWeekly limit, resets in 6d 22h',
  });
  const argonLabelSpan = env.makeEl('span', { text: 'Gemini 4 Argon' });
  usageBody.appendChild(argonLabelSpan);
  usageMenu.appendChild(usageBody);
  usagePositioner.appendChild(usageMenu);
  env.body.appendChild(usagePositioner);

  // Also test a short-text quota card carrying [data-testid="quota-progress-circle"]
  const quotaCard = env.makeEl('div', { className: 'agy-overlay', attrs: { role: 'menu', 'data-side': 'right' } });
  const quotaRing = env.makeEl('div', { attrs: { 'data-testid': 'quota-progress-circle' } });
  const quotaRow = env.makeEl('div', { attrs: { role: 'menuitem' }, text: 'Gemini 4 Argon' });
  quotaCard.appendChild(quotaRing);
  quotaCard.appendChild(quotaRow);
  env.body.appendChild(quotaCard);

  // Also test non-prefix container text ("Usage for Gemini 4 Argon") -> must NOT match prefix-only _mPlan
  const nonPrefixBox = env.makeEl('div', { attrs: { role: 'menu', 'data-side': 'right' } });
  const nonPrefixRow = env.makeEl('div', { attrs: { role: 'menuitem' }, text: 'Usage for Gemini 4 Argon' });
  nonPrefixBox.appendChild(nonPrefixRow);
  env.body.appendChild(nonPrefixBox);

  const agObs = upstreamLib.installAntigravityObserver({
    document: env.doc,
    window: env.win,
    MutationObserver: env.win.MutationObserver,
  });
  agObs.rescan();

  // Neither the outer presentation wrapper nor the inner Usage menu / quota-progress-circle / non-prefix box may be bound as Orchestrator L2
  assert.equal(usagePositioner.hasAttribute('data-ag-cs-orch-l2'), false, 'Usage positioner must never be tagged data-ag-cs-orch-l2');
  assert.equal(usageMenu.hasAttribute('data-ag-cs-orch-l2'), false, 'Usage menu must never be tagged data-ag-cs-orch-l2');
  assert.equal(usageMenu.hasAttribute('data-ces-orch-row'), false, 'Usage menu container must never be tagged data-ces-orch-row');
  assert.equal(quotaCard.hasAttribute('data-ag-cs-orch-l2'), false, 'Quota card with quota-progress-circle must never be tagged data-ag-cs-orch-l2');
  assert.equal(nonPrefixBox.hasAttribute('data-ag-cs-orch-l2'), false, 'Non-prefix row "Usage for Gemini 4 Argon" must never match _mPlan');

  // Clicking inside the Usage panel (even without quota-progress-circle testids) must NEVER switch model to Orchestrator
  env.simulateNativeClick(argonLabelSpan, () => {});
  env.simulateNativeClick(usageMenu, () => {});
  env.simulateNativeClick(quotaRow, () => {});
  env.simulateNativeClick(nonPrefixRow, () => {});
  assert.equal(selectedModel, neonHigh, 'Active model must remain Gemini 4 Neon (High) after clicking Usage/quota panels');
  assert.equal(commits.length, 0, 'Clicking Usage panel must trigger 0 model commits');
  assert.equal(orchPicks.length, 0, 'Clicking Usage panel must trigger 0 orchestratorPick.select calls');

  // Genuine Orchestrator L2 submenu with multi-word tail effort ("Gemini 4 Argon Extra High") still works via linear tail stripping
  const realL2 = env.makeEl('div', { className: 'agy-overlay', attrs: { role: 'menu', 'data-side': 'right' } });
  const realArgon = env.makeEl('div', { attrs: { role: 'menuitemradio' }, text: 'Gemini 4 Argon Extra High' });
  const realNeon = env.makeEl('div', { attrs: { role: 'menuitemradio' }, text: 'Gemini 4 Neon High' });
  realL2.appendChild(realArgon);
  realL2.appendChild(realNeon);
  env.body.appendChild(realL2);
  agObs.rescan();
  assert.equal(realL2.getAttribute('data-ag-cs-orch-l2'), '1', 'Real Orchestrator L2 with multi-word tail effort must still bind');
  assert.equal(realArgon.getAttribute('data-ces-orch-row'), '1', 'Linear tail stripper must recognize "Gemini 4 Argon Extra High"');
  // Clicking the outer container realL2 directly (it === m / _isBox) must NOT trigger commit
  env.simulateNativeClick(realL2, () => {});
  assert.equal(commits.length, 0, 'Clicking outer L2 box itself must not trigger commit');

  agObs.stop();
});
