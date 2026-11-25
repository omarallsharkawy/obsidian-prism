import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, '..');

const motionEngine = require(path.join(ROOT_DIR, 'motion-engine.js'));
const animatedIcons = require(path.join(ROOT_DIR, 'animated-icons.js'));
const i18nLocales = require(path.join(ROOT_DIR, 'i18n-locales.js'));
void animatedIcons;

function createTestElement(tagName = 'div', attrs = {}, rect = { left: 0, top: 0, width: 88, height: 30 }) {
  const attrMap = new Map(Object.entries(attrs).map(([k, v]) => [k, String(v)]));
  const children = [];
  const listeners = new Map();
  const animateCalls = [];
  let attrWrites = 0;

  const el = {
    nodeType: 1,
    tagName: tagName.toUpperCase(),
    style: {},
    disabled: attrMap.has('disabled'),
    isContentEditable: attrMap.get('contenteditable') === 'true' || attrMap.get('contenteditable') === '',
    children,
    parentElement: null,
    parentNode: null,
    animateCalls,
    get attrWrites() {
      return attrWrites;
    },
    get className() {
      return attrMap.get('class') || '';
    },
    set className(v) {
      attrWrites++;
      if (v) attrMap.set('class', String(v));
      else attrMap.delete('class');
    },
    get id() {
      return attrMap.get('id') || '';
    },
    setAttribute(k, v) {
      attrWrites++;
      attrMap.set(k, String(v));
      if (k === 'disabled') el.disabled = true;
    },
    getAttribute(k) {
      return attrMap.has(k) ? attrMap.get(k) : null;
    },
    hasAttribute(k) {
      return attrMap.has(k);
    },
    removeAttribute(k) {
      attrWrites++;
      attrMap.delete(k);
      if (k === 'disabled') el.disabled = false;
    },
    appendChild(child) {
      child.parentElement = el;
      child.parentNode = el;
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
    getBoundingClientRect() {
      return { ...rect };
    },
    matches(selector) {
      if (selector === ':focus-visible') return true;
      return String(selector)
        .split(',')
        .map((s) => s.trim())
        .some((tok) => {
          if (!tok) return false;
          if (tok === el.tagName.toLowerCase()) return true;
          if (tok === '[data-anim-icon]' && attrMap.has('data-anim-icon')) return true;
          if (tok === '[role="button"]' && attrMap.get('role') === 'button') return true;
          if (tok === '[role="textbox"]' && attrMap.get('role') === 'textbox') return true;
          if (tok === '[contenteditable="true"]' && attrMap.get('contenteditable') === 'true') return true;
          if (tok.startsWith('.')) {
            return (attrMap.get('class') || '').split(/\s+/).includes(tok.slice(1));
          }
          return false;
        });
    },
    closest(selector) {
      let cur = el;
      while (cur) {
        if (cur.matches && cur.matches(selector)) return cur;
        cur = cur.parentElement;
      }
      return null;
    },
    querySelectorAll(selector) {
      const out = [];
      const walk = (n) => {
        for (const ch of n.children || []) {
          if (ch.matches && ch.matches(selector)) out.push(ch);
          walk(ch);
        }
      };
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
      listeners.get(type)?.delete(fn);
    },
    dispatch(type, init = {}) {
      for (const fn of [...(listeners.get(type) || [])]) {
        fn({ type, button: 0, target: el, ...init });
      }
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

test('getMotionTier resolves data-ag-cs-motion 4 tiers and prefers-reduced-motion override', () => {
  const prevDoc = globalThis.document;
  const prevMatch = globalThis.matchMedia;
  const html = createTestElement('html');
  globalThis.document = { documentElement: html };
  globalThis.matchMedia = () => ({ matches: false });

  try {
    assert.equal(motionEngine.getMotionTier(), 'ultra');
    for (const tier of ['off', 'subtle', 'standard', 'ultra']) {
      html.setAttribute('data-ag-cs-motion', tier);
      assert.equal(motionEngine.getMotionTier(), tier);
    }
    html.setAttribute('data-ag-cs-motion', 'unknown-value');
    assert.equal(motionEngine.getMotionTier(), 'ultra');

    assert.equal(motionEngine.getMotionTier('subtle'), 'subtle');
    assert.equal(motionEngine.getMotionTier(true), 'off');

    globalThis.matchMedia = () => ({ matches: true });
    html.setAttribute('data-ag-cs-motion', 'ultra');
    assert.equal(motionEngine.getMotionTier(), 'off');
    assert.equal(motionEngine.getMotionTier(false), 'ultra');
  } finally {
    globalThis.document = prevDoc;
    globalThis.matchMedia = prevMatch;
  }
});

test('spring, stagger, glideIndicator, drawStroke, and triggerIcon adapt across off / subtle / standard / ultra', () => {
  const prevDoc = globalThis.document;
  const prevMatch = globalThis.matchMedia;
  const html = createTestElement('html');
  globalThis.document = { documentElement: html };
  globalThis.matchMedia = () => ({ matches: false });

  try {
    html.setAttribute('data-ag-cs-motion', 'off');
    const offEl = createTestElement('div');
    const offRes = motionEngine.spring(
      offEl,
      [{ opacity: 0, transform: 'scale(0.9)' }, { opacity: 1, transform: 'scale(1)' }],
      { fill: 'forwards' }
    );
    assert.equal(offRes.durationMs, 0);
    assert.equal(offEl.animateCalls.length, 0);
    assert.equal(offEl.style.opacity, '1');

    const offPath = createTestElement('path', { 'data-path-length': '20' });
    motionEngine.drawStroke(offPath);
    assert.equal(offPath.style.strokeDashoffset, '0');
    assert.equal(offPath.animateCalls.length, 0);

    html.setAttribute('data-ag-cs-motion', 'subtle');
    const subEl = createTestElement('div');
    const subRes = motionEngine.spring(subEl, [
      { transform: 'scale(0.84)' },
      { transform: 'scale(1.12)' },
      { transform: 'scale(1)' },
    ]);
    assert.equal(subRes.durationMs, 120);
    assert.equal(subRes.easing, 'ease-out');
    assert.equal(subEl.animateCalls.length, 1);
    assert.equal(subEl.animateCalls[0].keyframes.length, 2, 'Subtle tier must strip overshoot middle keyframes');
    assert.equal(subEl.animateCalls[0].options.duration, 120);
    assert.equal(subEl.animateCalls[0].options.easing, 'ease-out');

    const btn = createTestElement('button');
    const svg = createTestElement('svg', { 'data-anim-icon': 'copy-check', class: 'ag-anim-icon' });
    const cp = createTestElement('g', { class: 'ai-part-copy' });
    const ck = createTestElement('path', { class: 'ai-part-check', 'data-path-length': '22' });
    svg.appendChild(cp);
    svg.appendChild(ck);
    btn.appendChild(svg);

    const hoverSub = motionEngine.triggerIcon(btn, 'hover');
    assert.equal(hoverSub.handles.length, 0, 'Subtle tier must suppress exaggerated hover bounce on icons');

    const checkSub = motionEngine.triggerIcon(btn, 'check');
    assert.equal(cp.style.opacity, '0');
    assert.equal(ck.style.opacity, '1');
    assert.ok(checkSub.handles.length >= 1);
    assert.equal(ck.animateCalls[0].options.duration, 120);
    assert.equal(ck.animateCalls[0].options.easing, 'ease-out');

    html.setAttribute('data-ag-cs-motion', 'standard');
    const prevBtn = createTestElement('button', {}, { left: 20, top: 10, width: 64, height: 26 });
    const nextBtn = createTestElement('button', {}, { left: 96, top: 10, width: 80, height: 26 });
    const glideRes = motionEngine.glideIndicator(prevBtn, nextBtn);
    assert.ok(glideRes.durationMs > 120);
    assert.equal(prevBtn.animateCalls.length, 0);
    assert.equal(nextBtn.animateCalls.length, 1);
    assert.match(nextBtn.animateCalls[0].keyframes[0].transform, /translate3d\(-76\.00px, 0\.00px, 0\)/);
  } finally {
    globalThis.document = prevDoc;
    globalThis.matchMedia = prevMatch;
  }
});

test('bindMicroInteractions explicitly skips .ag-prism-thought-raw-toggle and .ag-prism-thought-overlay with 0 animations and 0 attribute mutations', () => {
  const prevDoc = globalThis.document;
  const prevMatch = globalThis.matchMedia;
  const html = createTestElement('html', { 'data-ag-cs-motion': 'ultra' });
  globalThis.document = { documentElement: html };
  globalThis.matchMedia = () => ({ matches: false });

  const root = createTestElement('div');
  const normalBtn = createTestElement('button');
  const roleBtn = createTestElement('div', { role: 'button' });
  const iconBtn = createTestElement('button');
  const iconSvg = createTestElement('svg', { 'data-anim-icon': 'plus-spin', class: 'ag-anim-icon' });
  iconBtn.appendChild(iconSvg);

  // Thought translation component "Raw" toggle button and overlay tree
  const thoughtOverlay = createTestElement('div', { class: 'ag-prism-thought-overlay' });
  const thoughtRawBtn = createTestElement('button', { class: 'ag-prism-thought-raw-toggle' });
  const thoughtInnerSvg = createTestElement('svg', { 'data-anim-icon': 'sparkles-pen' });
  thoughtRawBtn.appendChild(thoughtInnerSvg);
  thoughtOverlay.appendChild(thoughtRawBtn);
  const standaloneRawBtn = createTestElement('button', { class: 'btn ag-prism-thought-raw-toggle secondary' });

  const disabledBtn = createTestElement('button', { disabled: 'true' });
  const ariaDisabledBtn = createTestElement('div', { role: 'button', 'aria-disabled': 'true' });
  const noSpringBtn = createTestElement('button', { 'data-no-press-spring': '1' });
  const editableInBtn = createTestElement('div', { contenteditable: 'true' });
  const wrapperRoleBtn = createTestElement('div', { role: 'button' });
  wrapperRoleBtn.appendChild(editableInBtn);
  const composerBox = createTestElement('div', { role: 'button', 'data-testid': 'agent-input-box' });
  const hugeContainer = createTestElement('div', { role: 'button' }, { left: 0, top: 0, width: 640, height: 180 });

  for (const n of [
    normalBtn,
    roleBtn,
    iconBtn,
    thoughtOverlay,
    standaloneRawBtn,
    disabledBtn,
    ariaDisabledBtn,
    noSpringBtn,
    wrapperRoleBtn,
    composerBox,
    hugeContainer,
  ]) {
    root.appendChild(n);
  }

  const binding = motionEngine.bindMicroInteractions(root);
  try {
    root.dispatch('pointerdown', { target: normalBtn });
    assert.equal(normalBtn.animateCalls.length, 1);
    assert.deepEqual(normalBtn.animateCalls[0].keyframes[1], { transform: 'scale(0.965)' });

    root.dispatch('pointerdown', { target: roleBtn });
    assert.equal(roleBtn.animateCalls.length, 1);

    root.dispatch('pointerdown', { target: iconSvg });
    assert.equal(iconSvg.animateCalls.length, 1);
    assert.equal(iconBtn.animateCalls.length, 1);

    // Verify .ag-prism-thought-raw-toggle and its children receive 0 animations and 0 attribute writes across all events and direct calls
    for (const thoughtTarget of [thoughtRawBtn, thoughtInnerSvg, thoughtOverlay, standaloneRawBtn]) {
      root.dispatch('pointerover', { target: thoughtTarget, relatedTarget: root });
      root.dispatch('focusin', { target: thoughtTarget });
      root.dispatch('pointerdown', { target: thoughtTarget });
    }
    motionEngine.spring(thoughtRawBtn, [{ transform: 'scale(0.9)' }, { transform: 'scale(1)' }]);
    motionEngine.triggerIcon(thoughtRawBtn, 'hover');

    assert.equal(thoughtRawBtn.animateCalls.length, 0, '.ag-prism-thought-raw-toggle must never receive WAAPI animations');
    assert.equal(thoughtInnerSvg.animateCalls.length, 0, 'Icons inside .ag-prism-thought-raw-toggle must never animate');
    assert.equal(standaloneRawBtn.animateCalls.length, 0, 'Standalone .ag-prism-thought-raw-toggle must never animate');
    assert.equal(thoughtRawBtn.attrWrites, 0, '.ag-prism-thought-raw-toggle must have 0 attribute mutations');
    assert.deepEqual(thoughtRawBtn.style, {}, '.ag-prism-thought-raw-toggle inline style must remain completely untouched');

    for (const excluded of [disabledBtn, ariaDisabledBtn, noSpringBtn, editableInBtn, wrapperRoleBtn, composerBox, hugeContainer]) {
      root.dispatch('pointerdown', { target: excluded });
    }
    assert.equal(disabledBtn.animateCalls.length, 0);
    assert.equal(ariaDisabledBtn.animateCalls.length, 0);
    assert.equal(noSpringBtn.animateCalls.length, 0);
    assert.equal(wrapperRoleBtn.animateCalls.length, 0);
    assert.equal(composerBox.animateCalls.length, 0);
    assert.equal(hugeContainer.animateCalls.length, 0);

    html.setAttribute('data-ag-cs-motion', 'subtle');
    root.dispatch('pointerdown', { target: normalBtn });
    assert.equal(normalBtn.animateCalls.length, 1);
  } finally {
    binding.unbind();
    globalThis.document = prevDoc;
    globalThis.matchMedia = prevMatch;
  }
});

test('i18n-locales UI_TABLE defines all 6 motionLevel keys across bilingual en and ar locales', () => {
  const requiredKeys = [
    'setMotionLevelTitle',
    'setMotionLevelDesc',
    'optMotionOff',
    'optMotionSubtle',
    'optMotionStandard',
    'optMotionUltra',
  ];
  for (const lang of ['en', 'ar']) {
    const ui = i18nLocales.getUiStrings(lang);
    for (const k of requiredKeys) {
      assert.ok(typeof ui[k] === 'string' && ui[k].length > 0, `Missing ${k} for ${lang}`);
    }
  }
});

test('cdp.REMOVE_EXPRESSION cleanly unwraps stream chunks without losing text, restores injected host icons, and purges transient attributes when cdp.js is present', (t) => {
  const cdpPath = path.join(ROOT_DIR, 'cdp.js');
  if (!fs.existsSync(cdpPath)) {
    t.skip('cdp.js not yet generated by prism-repo');
    return;
  }
  const cdp = require(cdpPath);

  function makeNode(tag, attrs = {}) {
    const attrMap = new Map(Object.entries(attrs).map(([k, v]) => [k, String(v)]));
    const childNodes = [];
    const node = {
      nodeType: 1,
      tagName: tag.toUpperCase(),
      hidden: attrMap.has('hidden'),
      style: { removeProperty() {} },
      childNodes,
      parentNode: null,
      get firstChild() {
        return childNodes[0] || null;
      },
      get attributes() {
        return [...attrMap.keys()].map((name) => ({ name, value: attrMap.get(name) }));
      },
      classList: {
        remove(...cls) {
          const set = new Set((attrMap.get('class') || '').split(/\s+/).filter(Boolean));
          for (const c of cls) set.delete(c);
          const next = [...set].join(' ');
          if (next) attrMap.set('class', next);
          else attrMap.delete('class');
        },
        get length() {
          return (attrMap.get('class') || '').split(/\s+/).filter(Boolean).length;
        },
      },
      setAttribute(k, v) {
        attrMap.set(k, String(v));
        if (k === 'hidden') node.hidden = true;
      },
      getAttribute(k) {
        return attrMap.has(k) ? attrMap.get(k) : null;
      },
      hasAttribute(k) {
        return attrMap.has(k);
      },
      removeAttribute(k) {
        attrMap.delete(k);
        if (k === 'hidden') node.hidden = false;
      },
      appendChild(ch) {
        if (ch.parentNode) ch.remove();
        ch.parentNode = node;
        childNodes.push(ch);
        return ch;
      },
      insertBefore(ch, ref) {
        const idx = childNodes.indexOf(ref);
        if (idx < 0) return node.appendChild(ch);
        if (ch.parentNode) ch.remove();
        ch.parentNode = node;
        childNodes.splice(idx, 0, ch);
        return ch;
      },
      remove() {
        if (!node.parentNode) return;
        const idx = node.parentNode.childNodes.indexOf(node);
        if (idx >= 0) node.parentNode.childNodes.splice(idx, 1);
        node.parentNode = null;
      },
      normalize() {
        for (let i = 0; i < childNodes.length - 1; ) {
          if (childNodes[i].nodeType === 3 && childNodes[i + 1].nodeType === 3) {
            childNodes[i].textContent += childNodes[i + 1].textContent;
            childNodes.splice(i + 1, 1);
          } else {
            i++;
          }
        }
      },
      get textContent() {
        return childNodes.map((c) => c.textContent).join('');
      },
      matches(sel) {
        return String(sel)
          .split(',')
          .map((s) => s.trim())
          .some((tok) => {
            if (!tok) return false;
            if (tok.startsWith('style#')) return node.tagName === 'STYLE' && attrMap.get('id') === tok.slice(6);
            if (tok.startsWith('#')) return attrMap.get('id') === tok.slice(1);
            if (tok.startsWith('.')) return (attrMap.get('class') || '').split(/\s+/).includes(tok.slice(1));
            const m = /^\[([a-zA-Z0-9_-]+)(?:="([^"]*)")?\]$/.exec(tok);
            if (m) return m[2] === undefined ? attrMap.has(m[1]) : attrMap.get(m[1]) === m[2];
            return false;
          });
      },
      querySelectorAll(sel) {
        const res = [];
        const walk = (n) => {
          for (const ch of n.childNodes || []) {
            if (ch.nodeType === 1) {
              if (ch.matches(sel)) res.push(ch);
              walk(ch);
            }
          }
        };
        walk(node);
        return res;
      },
      getElementById(id) {
        return node.querySelectorAll('#' + id)[0] || null;
      },
    };
    return node;
  }

  const makeText = (txt) => {
    const tn = {
      nodeType: 3,
      textContent: txt,
      parentNode: null,
      remove() {
        if (!tn.parentNode) return;
        const idx = tn.parentNode.childNodes.indexOf(tn);
        if (idx >= 0) tn.parentNode.childNodes.splice(idx, 1);
        tn.parentNode = null;
      },
    };
    return tn;
  };

  const root = makeNode('html', { 'data-ag-cs-motion': 'ultra', 'data-ag-cs-lang': 'ar', 'data-ag-prism': '1.0.1' });
  const body = makeNode('body');
  root.appendChild(body);

  const para = makeNode('p', {
    'data-ag-cs-sonar': '1',
    'data-ag-cs-liftoff-bubble': '1',
  });
  para.appendChild(makeText('Hello '));
  const chunk1 = makeNode('span', { class: 'ag-cs-stream-chunk' });
  chunk1.appendChild(makeText('Antigravity '));
  const chunk2 = makeNode('span', { class: 'ag-cs-thought-chunk' });
  chunk2.appendChild(makeText('Prism!'));
  para.appendChild(chunk1);
  para.appendChild(chunk2);
  body.appendChild(para);

  const copyBtn = makeNode('button', { 'data-ag-cs-icon-injected': 'copy-check' });
  const origSvg = makeNode('svg', { hidden: '', 'data-ag-cs-orig-svg': '1' });
  const animSvg = makeNode('svg', { class: 'ag-anim-icon ag-icon-copy-check' });
  copyBtn.appendChild(origSvg);
  copyBtn.appendChild(animSvg);
  body.appendChild(copyBtn);

  const documentMock = {
    documentElement: root,
    body,
    querySelector: (s) => root.querySelectorAll(s)[0] || null,
    querySelectorAll: (s) => root.querySelectorAll(s),
    getElementById: (id) => root.getElementById(id),
  };
  const sandbox = {
    document: documentMock,
    window: {},
    globalThis: {},
  };
  sandbox.globalThis = sandbox;

  vm.runInNewContext(cdp.REMOVE_EXPRESSION, sandbox);
  assert.equal(root.hasAttribute('data-ag-cs-motion'), false);
  assert.equal(para.textContent, 'Hello Antigravity Prism!');
  assert.equal(para.childNodes.length, 1);
  assert.equal(copyBtn.hasAttribute('data-ag-cs-icon-injected'), false);
  assert.equal(origSvg.hidden, false);
  assert.equal(animSvg.parentNode, null);
});

test('motionEngine WeakMap ancestor exclusion cache short-circuits repeated 300Hz pointerover walks while staying reactive to class changes', () => {
  const prevPerf = globalThis.performance;
  let fakeNow = 1000;
  globalThis.performance = { now: () => fakeNow };

  try {
    let parentClassReads = 0;
    const makeTrackedNode = (cls = '') => {
      let curCls = cls;
      const children = [];
      const n = {
        parentElement: null,
        parentNode: null,
        get className() {
          return curCls;
        },
        set className(v) {
          curCls = String(v);
        },
        getAttribute(k) {
          if (k === 'class') {
            parentClassReads++;
            return curCls;
          }
          return null;
        },
        hasAttribute() {
          return false;
        },
        appendChild(ch) {
          ch.parentElement = n;
          ch.parentNode = n;
          children.push(ch);
          return ch;
        },
      };
      return n;
    };

    const rootWrap = makeTrackedNode('conversation-root');
    const midA = makeTrackedNode('prose-section');
    const midB = makeTrackedNode('prose-paragraph');
    const leaf = makeTrackedNode('prose-word');
    rootWrap.appendChild(midA);
    midA.appendChild(midB);
    midB.appendChild(leaf);

    motionEngine.invalidateExclusionCache();
    assert.equal(motionEngine.isThoughtExcluded(leaf), false);
    const readsFirstCall = parentClassReads;
    assert.ok(readsFirstCall >= 3);

    // 50 repeated checks within the same 48ms high-refresh window only inspect leaf's own class (0 ancestor walks)
    parentClassReads = 0;
    for (let i = 0; i < 50; i++) {
      assert.equal(motionEngine.isThoughtExcluded(leaf), false);
    }
    assert.equal(parentClassReads, 50, 'Ancestors must be served from WeakMap without walking up DOM tree');

    // Sibling under cached midB also short-circuits at midB without walking midA / rootWrap
    const siblingLeaf = makeTrackedNode('prose-code');
    midB.appendChild(siblingLeaf);
    parentClassReads = 0;
    assert.equal(motionEngine.isThoughtExcluded(siblingLeaf), false);
    assert.equal(parentClassReads, 2, 'Sibling leaf should stop immediately at cached parent midB');

    // Mutating leaf itself or invalidating cache reflects exclusion immediately
    leaf.className = 'ag-prism-thought-raw-toggle';
    assert.equal(motionEngine.isThoughtExcluded(leaf), true);

    leaf.className = 'prose-word';
    rootWrap.className = 'ag-prism-thought-overlay';
    motionEngine.invalidateExclusionCache();
    assert.equal(motionEngine.isThoughtExcluded(leaf), true);
  } finally {
    globalThis.performance = prevPerf;
  }
});

test('smooth-caret tracks editor/host scrollTop without floating stale caret and snaps to physical sub-pixels on HiDPI displays', () => {
  require(path.join(ROOT_DIR, 'smooth-caret.js'));
  const smoothCaretMod = globalThis.__agPrismSmoothCaret;
  assert.ok(smoothCaretMod && typeof smoothCaretMod.createSmoothCaretController === 'function');
  assert.equal(smoothCaretMod.snapDevicePx(14.49, 1), 14);
  assert.equal(smoothCaretMod.snapDevicePx(14.49, 2), 14.5);
  assert.equal(smoothCaretMod.snapDevicePx(14.39, 2.5), 14.4);

  const prevDoc = globalThis.document;
  const prevWin = globalThis.window;
  const prevGetCs = globalThis.getComputedStyle;
  const prevRaf = globalThis.requestAnimationFrame;
  const rafCbs = [];
  globalThis.requestAnimationFrame = (cb) => {
    rafCbs.push(cb);
    return rafCbs.length;
  };

  let caretTopInViewport = 124.4;
  let caretLeftInViewport = 52.5;

  const textLeaf = { nodeType: 3, textContent: 'Line 1\nLine 2\nLine 3' };
  const hostChildren = [];
  const host = {
    clientLeft: 0,
    clientTop: 0,
    scrollLeft: 0,
    scrollTop: 0,
    attrs: new Map(),
    setAttribute(k, v) { this.attrs.set(k, String(v)); },
    getAttribute(k) { return this.attrs.has(k) ? this.attrs.get(k) : null; },
    hasAttribute(k) { return this.attrs.has(k); },
    removeAttribute(k) { this.attrs.delete(k); },
    getBoundingClientRect: () => ({ left: 40, top: 100, width: 400, height: 80 }),
    appendChild(ch) {
      ch.isConnected = true;
      hostChildren.push(ch);
      return ch;
    },
    querySelector(sel) {
      if (sel.startsWith('.ag-cs-smooth-caret')) {
        return hostChildren.find((c) => c.className === 'ag-cs-smooth-caret') || null;
      }
      return null;
    },
  };

  const ed = {
    parentElement: host,
    scrollLeft: 0,
    scrollTop: 0,
    scrollHeight: 220,
    clientHeight: 80,
    childNodes: [textLeaf],
    textContent: textLeaf.textContent,
    attrs: new Map(),
    setAttribute(k, v) { this.attrs.set(k, String(v)); },
    getAttribute(k) { return this.attrs.has(k) ? this.attrs.get(k) : null; },
    hasAttribute(k) { return this.attrs.has(k); },
    removeAttribute(k) { this.attrs.delete(k); },
    contains: (n) => n === textLeaf,
    querySelectorAll: () => [],
    getBoundingClientRect: () => ({ left: 40, top: 100, right: 440, bottom: 180, width: 400, height: 80 }),
  };

  globalThis.window = { devicePixelRatio: 2 };
  globalThis.getComputedStyle = () => ({ paddingLeft: '8px', paddingTop: '8px', fontSize: '14px', lineHeight: '22px' });
  globalThis.document = {
    activeElement: ed,
    createElement(tag) {
      const attrs = new Map();
      return {
        tagName: tag.toUpperCase(),
        className: '',
        style: {},
        isConnected: false,
        setAttribute(k, v) { attrs.set(k, String(v)); },
        getAttribute(k) { return attrs.has(k) ? attrs.get(k) : null; },
        hasAttribute(k) { return attrs.has(k); },
        removeAttribute(k) { attrs.delete(k); },
        remove() { this.isConnected = false; },
      };
    },
    getSelection: () => ({
      rangeCount: 1,
      isCollapsed: true,
      focusNode: textLeaf,
      focusOffset: 6,
      getRangeAt: () => ({
        startContainer: textLeaf,
        startOffset: 6,
        getClientRects: () => [{ left: caretLeftInViewport, top: caretTopInViewport, height: 18.5 }],
      }),
    }),
    querySelectorAll(sel) {
      if (sel.includes('[contenteditable="true"]')) return [ed];
      if (sel === '.ag-cs-smooth-caret') return hostChildren;
      return [];
    },
  };

  try {
    const ctl = smoothCaretMod.createSmoothCaretController({
      isDestroyed: () => false,
      isEnabled: () => true,
      setAttrIfChanged(el, k, v) { if (el.getAttribute(k) !== v) el.setAttribute(k, v); },
      runGuardedMut(fn) { return fn(); },
    });

    ctl.sync(true, false);
    const caret = host.querySelector('.ag-cs-smooth-caret');
    assert.ok(caret);
    // Physical 2x DPR subpixel alignment: 52.5 - 40 = 12.5px, 124.4 - 100 = 24.4 -> snapped to 24.5px
    assert.equal(caret.style.transform, 'translate3d(12.5px, 24.5px, 0)');
    assert.equal(caret.style.height, '18.5px');

    // Wheel scroll changes ed.scrollTop while selection focusNode/focusOffset stay identical!
    ed.scrollTop = 18;
    caretTopInViewport = 106.4;
    ctl.sync(false, false);
    assert.equal(
      caret.style.transform,
      'translate3d(12.5px, 6.5px, 0)',
      'Caret must update immediately on editor scrollTop change instead of floating at stale Y'
    );
    assert.equal(caret.style.transition, 'none', 'Scroll-only sync should suppress laggy glide transition');
    while (rafCbs.length) rafCbs.shift()();
    assert.equal(caret.style.transition, '', 'Next animation frame restores smooth glide transition');

    ctl.teardown();
  } finally {
    globalThis.document = prevDoc;
    globalThis.window = prevWin;
    globalThis.getComputedStyle = prevGetCs;
    globalThis.requestAnimationFrame = prevRaf;
  }
});

test('smooth-caret bumpMetricsEpoch invalidates emptyCaretProbeCache and prism-rim-canvas honors accentTone, ambient=0, subtle/off motion, orphan cleanup, and invalidateMetrics', () => {
  const smoothCaretMod = require('../smooth-caret.js');
  const prismRimMod = require('../prism-rim-canvas.js');

  // Part A: smooth-caret emptyCaretProbeCache invalidation on bumpMetricsEpoch()
  const prevDoc = globalThis.document;
  const prevWin = globalThis.window;
  const prevGetCs = globalThis.getComputedStyle;
  const prevPerf = globalThis.performance;
  const prevRaf = globalThis.requestAnimationFrame;
  const prevCaf = globalThis.cancelAnimationFrame;

  let padLeftPx = 8;
  let padTopPx = 8;
  let brViewportRect = { left: 48, top: 108, height: 18 };
  let hasSelectionRange = true;
  const hostKids = [];
  const brNode = {
    nodeName: 'BR',
    nodeType: 1,
    hasAttribute: () => true,
    getBoundingClientRect: () => brViewportRect,
  };
  const host = {
    clientLeft: 0,
    clientTop: 0,
    scrollLeft: 0,
    scrollTop: 0,
    attrs: new Map(),
    getBoundingClientRect: () => ({ left: 40, top: 100, width: 360, height: 60 }),
    setAttribute(k, v) { this.attrs.set(k, String(v)); },
    getAttribute(k) { return this.attrs.has(k) ? this.attrs.get(k) : null; },
    hasAttribute(k) { return this.attrs.has(k); },
    removeAttribute(k) { this.attrs.delete(k); },
    appendChild(c) { c.isConnected = true; hostKids.push(c); return c; },
    querySelector: () => hostKids[0] || null,
  };
  const ed = {
    nodeType: 1,
    parentElement: host,
    scrollLeft: 0,
    scrollTop: 0,
    scrollHeight: 60,
    clientHeight: 60,
    childNodes: [brNode],
    textContent: '',
    attrs: new Map(),
    setAttribute(k, v) { this.attrs.set(k, String(v)); },
    getAttribute(k) { return this.attrs.has(k) ? this.attrs.get(k) : null; },
    hasAttribute(k) { return this.attrs.has(k); },
    removeAttribute(k) { this.attrs.delete(k); },
    contains: (n) => n === ed || n === brNode,
    querySelectorAll: () => [],
    getBoundingClientRect: () => ({ left: 40, top: 100, right: 400, bottom: 160, width: 360, height: 60 }),
  };

  let rafQueue = [];
  globalThis.performance = { now: () => 1000 };
  globalThis.window = { devicePixelRatio: 1 };
  globalThis.requestAnimationFrame = (fn) => { rafQueue.push(fn); return rafQueue.length; };
  globalThis.cancelAnimationFrame = () => { rafQueue = []; };
  globalThis.getComputedStyle = (el) => {
    if (el === ed) return { paddingLeft: `${padLeftPx}px`, paddingTop: `${padTopPx}px`, fontSize: '14px', lineHeight: '20px' };
    return { borderTopLeftRadius: `${el._radiusPx || 10}px` };
  };
  globalThis.document = {
    activeElement: ed,
    documentElement: {
      attrs: new Map([['data-ag-cs-accent', 'mono'], ['data-ag-cs-ambient', '1'], ['data-ag-cs-motion', 'ultra']]),
      getAttribute(k) { return this.attrs.has(k) ? this.attrs.get(k) : null; },
    },
    createElement(tag) {
      const attrs = new Map();
      return {
        tagName: tag.toUpperCase(),
        className: '',
        style: {},
        dataset: {},
        width: 0,
        height: 0,
        isConnected: true,
        parentElement: null,
        classList: { contains(c) { return String(this._owner?.className || '').split(/\s+/).includes(c); } },
        setAttribute(k, v) { attrs.set(k, String(v)); },
        getAttribute(k) { return attrs.has(k) ? attrs.get(k) : null; },
        hasAttribute(k) { return attrs.has(k); },
        removeAttribute(k) { attrs.delete(k); },
        remove() {
          this.isConnected = false;
          if (this.parentElement && Array.isArray(this.parentElement._kids)) {
            const idx = this.parentElement._kids.indexOf(this);
            if (idx >= 0) this.parentElement._kids.splice(idx, 1);
          }
        },
        getContext: () => null,
      };
    },
    getSelection: () => (hasSelectionRange ? {
      rangeCount: 1,
      isCollapsed: true,
      focusNode: ed,
      focusOffset: 0,
      getRangeAt: () => ({
        startContainer: ed,
        startOffset: 0,
        getClientRects: () => [],
        getBoundingClientRect: () => ({ left: 0, top: 0, height: 0 }),
      }),
    } : { rangeCount: 0, isCollapsed: true }),
    querySelectorAll(sel) {
      if (sel.includes('[contenteditable="true"]')) return [ed];
      if (sel === '.ag-cs-smooth-caret') return hostKids;
      if (sel === '[data-ag-cs-prism-box="1"]') return prismBoxes.filter((b) => b.getAttribute('data-ag-cs-prism-box') === '1');
      if (sel === '.ag-cs-prism-rim-cv') return prismBoxes.flatMap((b) => b._kids.filter((k) => k.className === 'ag-cs-prism-rim-cv'));
      if (sel === '[data-ag-cs-prism-cv]') return prismBoxes.filter((b) => b.hasAttribute('data-ag-cs-prism-cv'));
      return [];
    },
    getElementById: () => null,
  };

  let prismBoxes = [];
  try {
    const caretCtl = smoothCaretMod.createSmoothCaretController({
      isDestroyed: () => false,
      isEnabled: () => true,
      setAttrIfChanged: (el, k, v) => el.setAttribute(k, v),
      runGuardedMut: (fn) => fn(),
    });
    // Seed emptyCaretProbeCache via BR rect at dx=8, dy=8
    caretCtl.sync(false, false);
    const caret = hostKids[0];
    assert.equal(caret.style.transform, 'translate3d(8px, 8px, 0)');

    // Selection temporarily empty (falls back to emptyCaretProbeCache); then composerRestyle changes padding to 16px, 14px!
    hasSelectionRange = false;
    padLeftPx = 16;
    padTopPx = 14;
    caretCtl.bumpMetricsEpoch();
    caretCtl.sync(false, true);
    assert.ok(
      caret.style.transform.startsWith('translate3d(16px, '),
      `bumpMetricsEpoch must evict stale emptyCaretProbeCache (dx=8) and use fresh padL=16, got ${caret.style.transform}`
    );
    caretCtl.teardown();
    rafQueue = [];

    // Part B: prism-rim-canvas accentTone, ambient=0, subtle/off motion, orphan cleanup, and invalidateMetrics
    const stopsSeen = [];
    const roundRectRadii = [];
    let clearsCount = 0;
    const mock2d = {
      globalAlpha: 1,
      lineWidth: 1,
      strokeStyle: null,
      clearRect() { clearsCount++; },
      beginPath() {},
      roundRect(_x, _y, _w, _h, r) { roundRectRadii.push(r); },
      stroke() {},
      createRadialGradient() {
        const stops = [];
        stopsSeen.push(stops);
        return { addColorStop(off, col) { stops.push([off, col]); } };
      },
    };
    const origCreate = globalThis.document.createElement;
    globalThis.document.createElement = (tag) => {
      const el = origCreate(tag);
      el.classList._owner = el;
      if (tag === 'canvas') el.getContext = () => mock2d;
      return el;
    };

    const boxAttrs = new Map([['data-ag-cs-prism-box', '1']]);
    const box = {
      _radiusPx: 10,
      _kids: [],
      isConnected: true,
      style: { setProperty() {}, removeProperty() {} },
      get firstElementChild() { return this._kids[0] || null; },
      setAttribute(k, v) { boxAttrs.set(k, String(v)); },
      getAttribute(k) { return boxAttrs.has(k) ? boxAttrs.get(k) : null; },
      hasAttribute(k) { return boxAttrs.has(k); },
      removeAttribute(k) { boxAttrs.delete(k); },
      appendChild(c) { c.parentElement = box; c.isConnected = true; this._kids.push(c); return c; },
      querySelector(sel) {
        if (sel === '.ag-cs-prism-rim-cv') return this._kids.find((k) => k.className === 'ag-cs-prism-rim-cv') || null;
        return null;
      },
      getBoundingClientRect: () => ({ left: 50, top: 50, right: 350, bottom: 130, width: 300, height: 80 }),
    };
    prismBoxes = [box];

    const rimCtl = prismRimMod.createPrismRimCanvasController({
      isDestroyed: () => false,
      isDarkTheme: () => true,
      motionReduced: () => false,
      getMinFrameGapMs: () => 0,
      canMountRealCanvas: () => true,
      setAttrIfChanged: (el, k, v) => el.setAttribute(k, v),
      runGuardedMut: (fn) => fn(),
      getActiveCrystalTrack: () => null,
      setCrystalPointerClient: () => {},
      onPointerActivity: () => {},
    });

    rimCtl.onPointerMove({ clientX: 120, clientY: 80 });
    assert.equal(rafQueue.length, 1);
    rafQueue.shift()(1016);
    assert.equal(stopsSeen.length, 1);
    const monoColors = stopsSeen[0].map((s) => s[1]);
    assert.ok(monoColors.includes('#E2E8F0') && !monoColors.includes('#EA4335'), `mono accent must use silver-titanium stops, got ${monoColors}`);
    assert.equal(roundRectRadii[0], 10);

    // Change cornerStyle (borderRadius 10 -> 14) and call invalidateMetrics() -> refreshes cached borderRadius!
    box._radiusPx = 14;
    globalThis.document.documentElement.attrs.set('data-ag-cs-accent', 'amber');
    rimCtl.invalidateMetrics();
    assert.equal(rafQueue.length, 1);
    rafQueue.shift()(1040);
    assert.equal(roundRectRadii[roundRectRadii.length - 1], 14, 'invalidateMetrics must refresh cached borderRadius from 10px to 14px');
    const amberColors = stopsSeen[stopsSeen.length - 1].map((s) => s[1]);
    assert.ok(amberColors.includes('#F2B84B'), `amber accent must use amber stops, got ${amberColors}`);

    // ambient=0 clears canvas and skips rAF on pointermove (0fps)
    const clearsBeforeZero = clearsCount;
    globalThis.document.documentElement.attrs.set('data-ag-cs-ambient', '0');
    rimCtl.invalidateMetrics();
    assert.ok(clearsCount > clearsBeforeZero, 'ambient=0 must clear rim canvas immediately');
    rimCtl.onPointerMove({ clientX: 140, clientY: 85 });
    assert.equal(rafQueue.length, 0, 'ambient=0 must not schedule rAF on pointermove');

    // motionLevel=subtle also skips rAF
    globalThis.document.documentElement.attrs.set('data-ag-cs-ambient', '1');
    globalThis.document.documentElement.attrs.set('data-ag-cs-motion', 'subtle');
    rimCtl.onPointerMove({ clientX: 145, clientY: 85 });
    assert.equal(rafQueue.length, 0, 'motion=subtle must not run 300Hz rim pointer loop');

    // composerRestyle: false removes data-ag-cs-prism-box -> markDirty() prunes orphan canvas & data-ag-cs-prism-cv
    box.removeAttribute('data-ag-cs-prism-box');
    rimCtl.markDirty();
    assert.equal(box._kids.length, 0, 'Orphan .ag-cs-prism-rim-cv must be removed when composerRestyle turns off');
    assert.equal(box.hasAttribute('data-ag-cs-prism-cv'), false);

    rimCtl.teardown();
  } finally {
    globalThis.document = prevDoc;
    globalThis.window = prevWin;
    globalThis.getComputedStyle = prevGetCs;
    globalThis.performance = prevPerf;
    globalThis.requestAnimationFrame = prevRaf;
    globalThis.cancelAnimationFrame = prevCaf;
  }
});

test('#257: Velvet stream feathering — Layer A block reveal, Layer B 5-bucket CSS.highlights ink fade (0 DOM split & 0fps idle), and Layer C .ag-prism-thought-chunk CSS', () => {
  const streamMod = require(path.join(ROOT_DIR, 'stream-choreography.js'));
  const cssSrc = fs.readFileSync(path.join(ROOT_DIR, 'style.css'), 'utf8');

  // Verify Layer B & Layer C CSS rules in style.css
  for (let i = 0; i < 5; i++) {
    assert.ok(cssSrc.includes(`::highlight(ag-stream-f${i})`), `Missing ::highlight(ag-stream-f${i}) in style.css`);
  }
  assert.ok(cssSrc.includes('.ag-prism-thought-chunk{animation:ag-prism-thought-chunk-in 320ms cubic-bezier(.22,1,.36,1) both;}'));
  assert.ok(cssSrc.includes('@keyframes ag-prism-thought-chunk-in{0%{opacity:.08;}68%{opacity:.94;}100%{opacity:1;}}'));

  const prevDoc = globalThis.document;
  const prevCss = globalThis.CSS;
  const prevHl = globalThis.Highlight;
  const prevPerf = globalThis.performance;
  const prevRaf = globalThis.requestAnimationFrame;
  const prevCaf = globalThis.cancelAnimationFrame;

  let nowMs = 1000;
  let nextRafId = 1;
  const rafMap = new Map();
  const highlightMap = new Map();

  class MockHighlight extends Set {}

  function mkElem(tag, attrs = {}) {
    const attrMap = new Map(Object.entries(attrs).map(([k, v]) => [k, String(v)]));
    const classSet = new Set((attrMap.get('class') || '').split(/\s+/).filter(Boolean));
    const el = {
      nodeType: 1,
      tagName: tag.toUpperCase(),
      isConnected: true,
      parentElement: null,
      parentNode: null,
      previousElementSibling: null,
      nextElementSibling: null,
      childNodes: [],
      children: [],
      classList: {
        add(c) { classSet.add(c); },
        remove(c) { classSet.delete(c); },
        contains(c) { return classSet.has(c); },
      },
      getAttribute(k) { return attrMap.has(k) ? attrMap.get(k) : null; },
      setAttribute(k, v) { attrMap.set(k, String(v)); },
      hasAttribute(k) { return attrMap.has(k); },
      removeAttribute(k) { attrMap.delete(k); },
      appendChild(ch) {
        ch.parentElement = el;
        ch.parentNode = el;
        ch.isConnected = true;
        const prevEl = el.children[el.children.length - 1] || null;
        if (ch.nodeType === 1) {
          if (prevEl) {
            prevEl.nextElementSibling = ch;
            ch.previousElementSibling = prevEl;
          }
          el.children.push(ch);
        }
        el.childNodes.push(ch);
        return ch;
      },
      matches(sel) {
        return String(sel)
          .split(',')
          .map((s) => s.trim())
          .some((tok) => {
            if (!tok) return false;
            if (tok.startsWith('.')) return classSet.has(tok.slice(1));
            const m = tok.match(/^\[([a-zA-Z0-9_-]+)="([^"]+)"\]$/);
            if (m) return attrMap.get(m[1]) === m[2];
            return tok.toUpperCase() === el.tagName;
          });
      },
      closest(sel) {
        let cur = el;
        while (cur) {
          if (cur.matches && cur.matches(sel)) return cur;
          cur = cur.parentElement;
        }
        return null;
      },
      querySelectorAll() { return []; },
      querySelector() { return null; },
    };
    return el;
  }

  function mkText(str) {
    return {
      nodeType: 3,
      data: str,
      get nodeValue() { return this.data; },
      isConnected: true,
      parentElement: null,
      parentNode: null,
    };
  }

  try {
    const html = mkElem('html', { 'data-ag-cs-style': 'true', 'data-ag-cs-motion': 'standard' });
    const body = mkElem('body');
    const conv = mkElem('div', { 'data-testid': 'conversation-view' });
    const prose = mkElem('div', { 'data-testid': 'planner-response-text' });
    const thoughtOverlay = mkElem('div', { class: 'ag-prism-thought-overlay' });
    const inputBox = mkElem('div', { 'data-testid': 'agent-input-box' });
    conv.appendChild(prose);
    conv.appendChild(thoughtOverlay);
    conv.appendChild(inputBox);
    body.appendChild(conv);

    const preThoughtBucket = new MockHighlight();
    const foreignThoughtRange = { foreign: 'thought-client-range' };
    preThoughtBucket.add(foreignThoughtRange);
    highlightMap.set('ag-stream-f0', preThoughtBucket);

    globalThis.CSS = { highlights: highlightMap };
    globalThis.Highlight = MockHighlight;
    globalThis.performance = { now: () => nowMs };
    globalThis.requestAnimationFrame = (cb) => {
      const id = nextRafId++;
      rafMap.set(id, cb);
      return id;
    };
    globalThis.cancelAnimationFrame = (id) => {
      rafMap.delete(id);
    };
    globalThis.document = {
      documentElement: html,
      body,
      createRange() {
        return {
          startContainer: null,
          startOffset: 0,
          endContainer: null,
          endOffset: 0,
          setStart(n, o) { this.startContainer = n; this.startOffset = o; },
          setEnd(n, o) { this.endContainer = n; this.endOffset = o; },
        };
      },
      querySelectorAll: () => [],
      querySelector: () => null,
    };

    let motionEnabled = true;
    const ctl = streamMod.createStreamChoreographyController({
      motionEngine: null,
      isDestroyed: () => false,
      isComposerRestyleEnabled: () => true,
      isMotionStandardOrUltra: () => motionEnabled,
      isMotionUltra: () => false, // Verify standard tier ALSO enables stream feathering!
      isConvRunning: () => true,
      isThoughtIsolatedNode: () => false,
      isThoughtMutationRecord: () => false,
      isManagedThoughtPanel: () => false,
      setAttrIfChanged: (el, k, v) => el.setAttribute(k, v),
      runGuardedMut: (fn) => fn(),
      cloneCachedSvgElement: () => null,
      buildBrandMarkSvg: () => '<svg></svg>',
      applySingleHostIcon: () => {},
      rippleCtl: null,
      convAuraCtl: null,
      notifyMascot: () => {},
    });

    // 1. Layer A: New paragraph block receives single .ag-cs-stream-chunk and snapshots initial text length
    const p1 = mkElem('p');
    const t1 = mkText('Hello');
    p1.appendChild(t1);
    prose.appendChild(p1);
    ctl.onStreamMutations([{ type: 'childList', target: prose, addedNodes: [p1] }]);
    assert.equal(p1.classList.contains('ag-cs-stream-chunk'), true, 'New block must receive .ag-cs-stream-chunk in standard tier');
    assert.equal(ctl.getHighlightFadeState().activeCount, 0, 'Initial block snapshot must not double-fade initial text');

    // 2. Layer B: Appending text via characterData on the SAME TextNode creates Range [5, 11] in ag-stream-f0 with ZERO DOM split!
    nowMs = 1020;
    t1.data = 'Hello world';
    ctl.onStreamMutations([{ type: 'characterData', target: t1 }]);
    assert.equal(p1.childNodes.length, 1, 'React TextNode must NEVER be split or wrapped');
    assert.equal(p1.childNodes[0], t1);
    let st = ctl.getHighlightFadeState();
    assert.equal(st.activeCount, 1);
    assert.equal(st.rafActive, true);
    assert.equal(highlightMap.get('ag-stream-f0'), preThoughtBucket, 'Must reuse pre-registered Highlight bucket without evicting thought-client');
    assert.equal(preThoughtBucket.has(foreignThoughtRange), true, 'Must preserve foreign thought-client Range in shared bucket');
    assert.deepEqual(st.buckets, [2, 0, 0, 0, 0]);
    const r0 = [...highlightMap.get('ag-stream-f0')].find((r) => r !== foreignThoughtRange);
    assert.equal(r0.startOffset, 5);
    assert.equal(r0.endOffset, 11);

    // Sub-frame rapid append (<= 34ms) coalesces into the SAME Range [5, 12] without allocating a second Range
    nowMs = 1040;
    t1.data = 'Hello world!';
    ctl.onStreamMutations([{ type: 'characterData', target: t1 }]);
    assert.equal(ctl.getHighlightFadeState().activeCount, 1, 'Sub-frame delta on same TextNode must coalesce');
    assert.equal(r0.endOffset, 12);

    // 3. Step through all 5 buckets (f0 -> f1 -> f2 -> f3 -> f4) and graduate cleanly to 0fps at >= 300ms
    const stepAt = (ts) => {
      nowMs = ts;
      const fn = [...rafMap.values()][0];
      rafMap.clear();
      fn(ts);
      return ctl.getHighlightFadeState();
    };
    assert.deepEqual(stepAt(1090).buckets, [1, 1, 0, 0, 0], '70ms age -> ag-stream-f1 while foreign range stays in f0');
    assert.deepEqual(stepAt(1150).buckets, [1, 0, 1, 0, 0], '130ms age -> ag-stream-f2');
    assert.deepEqual(stepAt(1210).buckets, [1, 0, 0, 1, 0], '190ms age -> ag-stream-f3');
    assert.deepEqual(stepAt(1270).buckets, [1, 0, 0, 0, 1], '250ms age -> ag-stream-f4');
    const graduated = stepAt(1330);
    assert.deepEqual(graduated.buckets, [1, 0, 0, 0, 0], '>=300ms age -> own range graduated, foreign thought range untouched!');
    assert.equal(preThoughtBucket.has(foreignThoughtRange), true, 'clearHighlightFade on graduation must NEVER .clear() foreign range');
    assert.equal(graduated.activeCount, 0);
    assert.equal(graduated.rafActive, false, 'Empty fade ring must immediately return to 0fps (zero rAF)');
    assert.equal(rafMap.size, 0);

    // 4. Exclusions: .ag-prism-thought-overlay and agent-input-box mutations never trigger Highlight ranges
    const ovTxt = mkText('Translating');
    thoughtOverlay.appendChild(ovTxt);
    const inTxt = mkText('typing');
    inputBox.appendChild(inTxt);
    ctl.onStreamMutations([
      { type: 'characterData', target: ovTxt },
      { type: 'characterData', target: inTxt },
    ]);
    assert.equal(ctl.getHighlightFadeState().activeCount, 0, 'Overlay and input box must be strictly excluded');

    // 5. Bounded 48-item ring + immediate cleanup on motion="off" / disconnectStreamObserver
    for (let k = 0; k < 56; k++) {
      nowMs += 40;
      const tn = mkText(`word-${k}`);
      p1.appendChild(tn);
      ctl.onStreamMutations([{ type: 'childList', target: p1, addedNodes: [tn] }]);
    }
    assert.equal(ctl.getHighlightFadeState().activeCount, 48, 'Fade ring must cap strictly at 48 active ranges');
    html.setAttribute('data-ag-cs-motion', 'off');
    motionEnabled = false;
    ctl.disconnectStreamObserver();
    assert.equal(ctl.getHighlightFadeState().activeCount, 0);
    assert.equal(ctl.getHighlightFadeState().rafActive, false);
    assert.deepEqual(ctl.getHighlightFadeState().buckets, [1, 0, 0, 0, 0]);
    assert.equal(preThoughtBucket.has(foreignThoughtRange), true, 'disconnectStreamObserver must drop only own ranges and keep foreign thought range');

    ctl.clearTransientTimers();
  } finally {
    globalThis.document = prevDoc;
    globalThis.CSS = prevCss;
    globalThis.Highlight = prevHl;
    globalThis.performance = prevPerf;
    globalThis.requestAnimationFrame = prevRaf;
    globalThis.cancelAnimationFrame = prevCaf;
  }
});
