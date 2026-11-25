import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const __dirname = import.meta.dirname;
const ROOT = path.resolve(__dirname, '..');

const EXPECTED_NO_TR_ATTRS = [
  ['translate', 'no'],
  ['data-no-translate', 'true'],
  ['data-ag-localization-skip', 'true'],
  ['data-agy-no-translate', 'true'],
  ['data-antigravity-zh-skip', '1'],
];

function assertHasAllNoTranslateAttrs(el, label) {
  assert.ok(el, `${label} must exist`);
  for (const [k, v] of EXPECTED_NO_TR_ATTRS) {
    assert.equal(el.getAttribute(k), v, `${label} must have ${k}="${v}"`);
  }
}

function assertHostUntaggedNoTranslate(el, label) {
  assert.ok(el, `${label} must exist`);
  for (const [k] of EXPECTED_NO_TR_ATTRS) {
    assert.equal(el.getAttribute(k), null, `host element ${label} must NOT receive ${k}`);
  }
}

// ── Lightweight Deterministic DOM Harness ───────────────────────────────────
function createClassList(el) {
  const set = new Set();
  const sync = () => {
    const str = Array.from(set).join(' ');
    if (str) el._attrs.set('class', str);
    else el._attrs.delete('class');
  };
  return {
    _syncFromString(str) {
      set.clear();
      for (const tok of String(str || '').split(/\s+/).filter(Boolean)) set.add(tok);
    },
    add(...tokens) {
      for (const t of tokens) if (t) set.add(t);
      sync();
    },
    remove(...tokens) {
      for (const t of tokens) set.delete(t);
      sync();
    },
    contains(t) {
      return set.has(t);
    },
    toString() {
      return Array.from(set).join(' ');
    },
  };
}

function matchesSimple(el, rawSel) {
  if (!el || el.nodeType !== 1) return false;
  const sel = rawSel.trim();
  if (!sel) return false;
  if (sel.includes(' ')) {
    const parts = sel.split(/\s+/).filter(Boolean);
    if (!matchesSimple(el, parts[parts.length - 1])) return false;
    let cur = el.parentElement;
    for (let i = parts.length - 2; i >= 0; i--) {
      while (cur && !matchesSimple(cur, parts[i])) cur = cur.parentElement;
      if (!cur) return false;
      cur = cur.parentElement;
    }
    return true;
  }
  let rem = sel;
  const tagM = rem.match(/^[a-zA-Z0-9-]+/);
  if (tagM) {
    if (el.tagName.toLowerCase() !== tagM[0].toLowerCase()) return false;
    rem = rem.slice(tagM[0].length);
  }
  const idM = rem.match(/#([a-zA-Z0-9_\\.-]+)/);
  if (idM) {
    const wantId = idM[1].replace(/\\/g, '');
    if (el.id !== wantId) return false;
    rem = rem.replace(idM[0], '');
  }
  for (const cm of rem.matchAll(/\.([a-zA-Z0-9_-]+)/g)) {
    if (!el.classList.contains(cm[1])) return false;
  }
  rem = rem.replace(/\.[a-zA-Z0-9_-]+/g, '');
  for (const am of rem.matchAll(/\[([a-zA-Z0-9_-]+)(?:="([^"]*)")?\]/g)) {
    if (!el.hasAttribute(am[1])) return false;
    if (am[2] !== undefined && el.getAttribute(am[1]) !== am[2]) return false;
  }
  return true;
}

function matchesAny(el, selectorList) {
  for (const part of String(selectorList || '').split(',')) {
    if (part.trim() && matchesSimple(el, part.trim())) return true;
  }
  return false;
}

function createDomEnv() {
  let orderSeq = 1;
  function createElement(tag, initialAttrs = {}) {
    const listeners = new Map();
    const attrs = new Map();
    let _textContent = '';
    const el = {
      nodeType: 1,
      tagName: String(tag || 'div').toUpperCase(),
      nodeName: String(tag || 'div').toUpperCase(),
      _attrs: attrs,
      _order: orderSeq++,
      _rect: { left: 0, top: 0, width: 300, height: 240, right: 300, bottom: 240 },
      parentElement: null,
      parentNode: null,
      childNodes: [],
      children: [],
      style: {
        setProperty(k, v) { this[k] = v; },
        removeProperty(k) { delete this[k]; },
      },
      hidden: false,
      disabled: false,
      scrollTop: 0,
      clientWidth: 480,
      clientHeight: 300,
      get id() { return attrs.get('id') || ''; },
      set id(v) { if (v) attrs.set('id', String(v)); else attrs.delete('id'); },
      get className() { return attrs.get('class') || ''; },
      set className(v) {
        const s = String(v || '');
        if (s) attrs.set('class', s);
        else attrs.delete('class');
        el.classList._syncFromString(s);
      },
      get firstChild() { return el.childNodes[0] || null; },
      get firstElementChild() { return el.children[0] || null; },
      get lastElementChild() { return el.children[el.children.length - 1] || null; },
      get childElementCount() { return el.children.length; },
      get nextSibling() {
        if (!el.parentElement) return null;
        const idx = el.parentElement.childNodes.indexOf(el);
        return idx >= 0 ? el.parentElement.childNodes[idx + 1] || null : null;
      },
      get nextElementSibling() {
        if (!el.parentElement) return null;
        const idx = el.parentElement.children.indexOf(el);
        return idx >= 0 ? el.parentElement.children[idx + 1] || null : null;
      },
      get isConnected() {
        let cur = el;
        while (cur.parentElement) cur = cur.parentElement;
        return cur === doc.documentElement;
      },
      get textContent() {
        if (el.childNodes.length === 0) return _textContent;
        return el.childNodes.map((c) => (c.nodeType === 3 ? c.data : c.textContent)).join('');
      },
      set textContent(val) {
        el.childNodes = [];
        el.children = [];
        _textContent = String(val ?? '');
      },
      get innerHTML() { return ''; },
      set innerHTML(val) {
        if (val === '') {
          el.childNodes = [];
          el.children = [];
          _textContent = '';
        }
      },
      setAttribute(k, v) {
        const key = String(k);
        const s = String(v);
        attrs.set(key, s);
        if (key === 'class') el.classList._syncFromString(s);
        if (key === 'hidden') el.hidden = true;
      },
      getAttribute(k) { return attrs.has(String(k)) ? attrs.get(String(k)) : null; },
      hasAttribute(k) { return attrs.has(String(k)); },
      removeAttribute(k) {
        const key = String(k);
        attrs.delete(key);
        if (key === 'class') el.classList._syncFromString('');
        if (key === 'hidden') el.hidden = false;
      },
      toggleAttribute(k, force) {
        const on = force === undefined ? !el.hasAttribute(k) : Boolean(force);
        if (on) el.setAttribute(k, '');
        else el.removeAttribute(k);
        return on;
      },
      appendChild(child) {
        if (!child) return child;
        if (child.nodeType === 11) {
          for (const sub of child.childNodes.slice()) el.appendChild(sub);
          return child;
        }
        if (child.parentElement) child.parentElement.removeChild(child);
        child.parentElement = el;
        child.parentNode = el;
        el.childNodes.push(child);
        if (child.nodeType === 1) el.children.push(child);
        return child;
      },
      insertBefore(child, ref) {
        if (!ref) return el.appendChild(child);
        if (child.parentElement) child.parentElement.removeChild(child);
        child.parentElement = el;
        child.parentNode = el;
        const ni = el.childNodes.indexOf(ref);
        if (ni >= 0) el.childNodes.splice(ni, 0, child);
        else el.childNodes.push(child);
        if (child.nodeType === 1) {
          const ei = el.children.indexOf(ref);
          if (ei >= 0) el.children.splice(ei, 0, child);
          else el.children.push(child);
        }
        return child;
      },
      removeChild(child) {
        const ni = el.childNodes.indexOf(child);
        if (ni >= 0) el.childNodes.splice(ni, 1);
        const ei = el.children.indexOf(child);
        if (ei >= 0) el.children.splice(ei, 1);
        child.parentElement = null;
        child.parentNode = null;
        return child;
      },
      remove() {
        if (el.parentElement) el.parentElement.removeChild(el);
      },
      contains(other) {
        let cur = other;
        while (cur) {
          if (cur === el) return true;
          cur = cur.parentElement;
        }
        return false;
      },
      compareDocumentPosition(other) {
        if (!other || other === el) return 0;
        return (other._order || 0) > (el._order || 0) ? 4 : 2;
      },
      closest(sel) {
        let cur = el;
        while (cur) {
          if (matchesAny(cur, sel)) return cur;
          cur = cur.parentElement;
        }
        return null;
      },
      querySelectorAll(sel) {
        const out = [];
        const walk = (n) => {
          for (const ch of n.children) {
            if (matchesAny(ch, sel)) out.push(ch);
            walk(ch);
          }
        };
        walk(el);
        return out;
      },
      querySelector(sel) { return el.querySelectorAll(sel)[0] || null; },
      getBoundingClientRect() { return { ...el._rect }; },
      addEventListener(type, fn) {
        if (!listeners.has(type)) listeners.set(type, new Set());
        listeners.get(type).add(fn);
      },
      removeEventListener(type, fn) { listeners.get(type)?.delete(fn); },
      dispatchEvent(evt) {
        const e = evt || { type: 'click' };
        if (!e.target) e.target = el;
        for (const fn of Array.from(listeners.get(e.type) || [])) fn(e);
      },
      click() { el.dispatchEvent({ type: 'click', target: el, preventDefault() {}, stopPropagation() {} }); },
    };
    el.classList = createClassList(el);
    for (const [k, v] of Object.entries(initialAttrs)) el.setAttribute(k, v);
    return el;
  }

  const docEl = createElement('html');
  const head = createElement('head');
  const body = createElement('body');
  docEl.appendChild(head);
  docEl.appendChild(body);

  const doc = {
    documentElement: docEl,
    head,
    body,
    hidden: false,
    activeElement: null,
    createElement: (tag) => createElement(tag),
    createElementNS: (_ns, tag) => createElement(tag),
    createTextNode: (data) => ({ nodeType: 3, data: String(data ?? ''), parentElement: null, parentNode: null }),
    createDocumentFragment: () => ({ nodeType: 11, childNodes: [], children: [], appendChild(c) { this.childNodes.push(c); return c; } }),
    getElementById: (id) => docEl.querySelectorAll('*').find((e) => e.id === id) || null,
    querySelector: (sel) => docEl.querySelector(sel),
    querySelectorAll: (sel) => docEl.querySelectorAll(sel),
    addEventListener() {},
    removeEventListener() {},
  };

  // Patch '*' matching for getElementById fallback
  const origQsa = docEl.querySelectorAll.bind(docEl);
  doc.getElementById = (id) => {
    const stack = [...docEl.children];
    while (stack.length) {
      const n = stack.shift();
      if (n.id === id) return n;
      for (const ch of n.children) stack.push(ch);
    }
    return null;
  };
  void origQsa;

  const win = {
    document: doc,
    innerWidth: 1440,
    innerHeight: 900,
    location: { pathname: '/' },
    getComputedStyle: () => ({ position: 'relative', getPropertyValue: () => '' }),
    requestAnimationFrame: (fn) => { fn(16); return 1; },
    cancelAnimationFrame() {},
    addEventListener() {},
    removeEventListener() {},
    matchMedia: () => ({ matches: false, addEventListener() {}, removeEventListener() {} }),
  };

  return { doc, docEl, head, body, win, createElement };
}

test('1) Source audit: all 5 target modules contain the 5 anti-translation exemption attributes and preserve data-ag-no-i18n', () => {
  const files = [
    'home-studio-panel.js',
    'host-workbench-enhancer.js',
    'vendor/thought-translator/thought-client.js',
    'vendor/thought-translator/thought-settings-ui.js',
    'vendor/sidebar-studio/sidebar-client.js',
  ];
  for (const rel of files) {
    const src = fs.readFileSync(path.join(ROOT, rel), 'utf8');
    for (const [k, v] of EXPECTED_NO_TR_ATTRS) {
      assert.ok(src.includes(k) && src.includes(v), `${rel} must define ${k}="${v}"`);
    }
  }
  // Ensure pre-existing data-ag-no-i18n was preserved
  for (const rel of ['home-studio-panel.js', 'host-workbench-enhancer.js', 'vendor/thought-translator/thought-client.js']) {
    const src = fs.readFileSync(path.join(ROOT, rel), 'utf8');
    assert.ok(src.includes('data-ag-no-i18n'), `${rel} must preserve data-ag-no-i18n`);
  }
});

test('2) home-studio-panel.js marks .ag-cs-home-panel-seat with all 5 attributes + data-ag-no-i18n and leaves host .agy-home untouched', () => {
  const env = createDomEnv();
  const prevDoc = globalThis.document;
  const prevWin = globalThis.window;
  const prevRaf = globalThis.requestAnimationFrame;
  globalThis.document = env.doc;
  globalThis.window = env.win;
  globalThis.requestAnimationFrame = env.win.requestAnimationFrame;

  try {
    const homeEl = env.createElement('div', { class: 'agy-home' });
    const greeting = env.createElement('div', { 'data-testid': 'home-greeting' });
    const h1 = env.createElement('h1');
    h1.textContent = 'Welcome';
    greeting.appendChild(h1);
    homeEl.appendChild(greeting);
    env.body.appendChild(homeEl);

    const usageCore = require(path.join(ROOT, 'usage-core.js'));
    const homeStudioMod = require(path.join(ROOT, 'home-studio-panel.js'));
    const ctl = homeStudioMod.createHomeStudioPanelController({
      usageCore,
      isDestroyed: () => false,
      getHomeLayout: () => 'studio',
      getLang: () => 'en',
      uiText: () => ({}),
      getDisplayName: () => 'Dev',
      ensureHooks: () => null,
      canMountRealCanvas: () => true,
      setAttrIfChanged: (el, k, v) => el.setAttribute(k, v),
      runGuardedMut: (fn) => fn(),
    });

    ctl.renderHomePanel(true);
    const seat = homeEl.querySelector('.ag-cs-home-panel-seat');
    assertHasAllNoTranslateAttrs(seat, 'home-studio-panel .ag-cs-home-panel-seat');
    assert.equal(seat.getAttribute('data-ag-no-i18n'), '', 'home-studio-panel seat must keep data-ag-no-i18n');
    assertHostUntaggedNoTranslate(homeEl, '.agy-home');
    assertHostUntaggedNoTranslate(h1, '[data-testid="home-greeting"] h1');
  } finally {
    globalThis.document = prevDoc;
    globalThis.window = prevWin;
    globalThis.requestAnimationFrame = prevRaf;
  }
});

test('3) host-workbench-enhancer.js marks fold button and nav outline popover only, never host DOM elements', () => {
  const env = createDomEnv();
  const enhancerMod = require(path.join(ROOT, 'host-workbench-enhancer.js'));

  const convView = env.createElement('div', { 'data-testid': 'conversation-view' });
  const viewport = env.createElement('div', { 'data-testid': 'autoscroll-viewport' });
  const prose = env.createElement('div', { 'data-testid': 'planner-response-text' });
  const pre = env.createElement('pre');
  const card = env.createElement('div', { class: 'relative my-2 rounded-xl bg-muted border' });
  const header = env.createElement('div', { class: 'min-h-7 relative flex items-center justify-between border-b px-2' });
  const langLabel = env.createElement('div');
  langLabel.textContent = 'javascript';
  const actions = env.createElement('div', { class: 'flex items-center gap-2' });
  header.appendChild(langLabel);
  header.appendChild(actions);

  const bodyWrap = env.createElement('div', { class: 'p-3' });
  const codeBlock = env.createElement('div', { class: 'code-block' });
  for (let i = 0; i < 60; i++) {
    const ln = env.createElement('div', { class: 'code-line' });
    ln.textContent = `const x_${i} = ${i};`;
    codeBlock.appendChild(ln);
  }
  bodyWrap.appendChild(codeBlock);
  card.appendChild(header);
  card.appendChild(bodyWrap);
  pre.appendChild(card);
  prose.appendChild(pre);
  viewport.appendChild(prose);
  convView.appendChild(viewport);

  const navRail = env.createElement('div', { 'data-testid': 'conversation-navigator' });
  const dot = env.createElement('button', { 'aria-label': 'Turn 1' });
  navRail.appendChild(dot);
  convView.appendChild(navRail);
  env.body.appendChild(convView);

  const ctl = enhancerMod.createHostEnhancerController({
    doc: env.doc,
    win: env.win,
    getLang: () => 'en',
    isConvRunning: () => false,
  });

  try {
    ctl.sync();
    const foldBtn = header.querySelector('.ag-cs-code-fold-btn');
    assertHasAllNoTranslateAttrs(foldBtn, 'host-workbench-enhancer .ag-cs-code-fold-btn');
    assert.equal(foldBtn.getAttribute('data-ag-no-i18n'), '');

    navRail.dispatchEvent({ type: 'pointerenter', target: navRail });
    const pop = convView.querySelector('.ag-cs-nav-outline-popover');
    assertHasAllNoTranslateAttrs(pop, 'host-workbench-enhancer .ag-cs-nav-outline-popover');
    assert.equal(pop.getAttribute('data-ag-no-i18n'), '');

    // Ensure host elements remain free of no-translate exemption markers
    assertHostUntaggedNoTranslate(pre, 'host <pre>');
    assertHostUntaggedNoTranslate(card, 'host code card');
    assertHostUntaggedNoTranslate(header, 'host code header');
    assertHostUntaggedNoTranslate(convView, 'host conversation-view');
    assertHostUntaggedNoTranslate(navRail, 'host conversation-navigator');
  } finally {
    ctl.destroy();
  }
});

test('4) thought-client.js & thought-settings-ui.js mark owned UI roots/badges/buttons/errors only and leave host thought panel untouched', async () => {
  const clientSrc = fs.readFileSync(path.join(ROOT, 'vendor', 'thought-translator', 'thought-client.js'), 'utf8');
  const settingsUiSrc = fs.readFileSync(path.join(ROOT, 'vendor', 'thought-translator', 'thought-settings-ui.js'), 'utf8');

  const env = createDomEnv();
  const uiSandbox = {
    window: env.win,
    document: env.doc,
    globalThis: null,
    console,
    URL,
    setTimeout,
    clearTimeout,
  };
  uiSandbox.globalThis = uiSandbox;
  vm.runInNewContext(settingsUiSrc, uiSandbox);
  const { box } = uiSandbox.__agPrismThoughtSettingsUi.createThoughtAiConfigBox({
    mkEl: (tag, cls) => {
      const e = env.createElement(tag);
      if (cls) e.className = cls;
      return e;
    },
    btnClass: 'btn',
    getMode: () => 'ai',
  });
  assertHasAllNoTranslateAttrs(box, 'thought-settings-ui prism-thought-ai-config');

  let failMode = true;
  const triggerBtn = env.createElement('button', { 'data-testid': 'thinking-collapsible-trigger', 'aria-expanded': 'true' });
  triggerBtn.textContent = 'Thought for 3s';
  const panelDiv = env.createElement('div');
  const rawPara = env.createElement('p');
  rawPara.textContent = 'Analyzing architecture trade-offs and checking translation boundaries carefully.';
  panelDiv.appendChild(rawPara);
  env.body.appendChild(triggerBtn);
  env.body.appendChild(panelDiv);

  const sandbox = {
    window: env.win,
    document: env.doc,
    globalThis: null,
    console,
    setTimeout,
    clearTimeout,
    requestAnimationFrame: env.win.requestAnimationFrame,
    cancelAnimationFrame: env.win.cancelAnimationFrame,
    MutationObserver: class { observe() {} disconnect() {} },
    IntersectionObserver: class { observe() {} disconnect() {} },
    __agPrismThoughtBridge: {
      call: async ({ action }) => (action === 'get-cache' ? { ok: true, stylePreset: 'technical', entries: {} } : { ok: true }),
      translateStream: async (_opts, onPartial) => {
        if (failMode) return { ok: false, error: 'network_error' };
        const txt = 'تمت مراجعة المفاضلات المعمارية والتحقق من حدود الترجمة بدقة.';
        if (onPartial) onPartial(txt);
        return { ok: true, text: txt, engine: 'machine', fallback: true };
      },
    },
  };
  sandbox.globalThis = sandbox;
  sandbox.window.__agPrismThoughtBridge = sandbox.__agPrismThoughtBridge;

  vm.runInNewContext(clientSrc, sandbox);
  const api = sandbox.__agPrismThought;
  assert.ok(api);

  try {
    api.sync({ thoughtTranslate: 'ai', thoughtTrigger: 'expand' });
    await new Promise((r) => setTimeout(r, 150));

    const errBar = panelDiv.querySelector('.ag-prism-thought-error-bar');
    const retryBtn = panelDiv.querySelector('.ag-prism-thought-retry-btn');
    assertHasAllNoTranslateAttrs(errBar, 'thought-client .ag-prism-thought-error-bar');
    assertHasAllNoTranslateAttrs(retryBtn, 'thought-client .ag-prism-thought-retry-btn');
    assertHostUntaggedNoTranslate(panelDiv, 'host failed thought panel');

    failMode = false;
    retryBtn.click();
    await new Promise((r) => setTimeout(r, 150));

    const ov = panelDiv.querySelector('.ag-prism-thought-overlay');
    const bodyEl = ov?.querySelector('.ag-prism-thought-body');
    const fb = ov?.querySelector('.ag-prism-thought-fallback-badge');
    const rb = ov?.querySelector('.ag-prism-thought-retranslate-btn');
    const tb = ov?.querySelector('.ag-prism-thought-raw-toggle');

    assertHasAllNoTranslateAttrs(ov, 'thought-client .ag-prism-thought-overlay');
    assert.equal(ov.getAttribute('data-ag-no-i18n'), '');
    assertHasAllNoTranslateAttrs(bodyEl, 'thought-client .ag-prism-thought-body');
    assert.equal(bodyEl.getAttribute('data-ag-no-i18n'), '');
    assertHasAllNoTranslateAttrs(fb, 'thought-client .ag-prism-thought-fallback-badge');
    assertHasAllNoTranslateAttrs(rb, 'thought-client .ag-prism-thought-retranslate-btn');
    assertHasAllNoTranslateAttrs(tb, 'thought-client .ag-prism-thought-raw-toggle');

    // Host panel and host trigger button must NOT be tagged
    assertHostUntaggedNoTranslate(panelDiv, 'host thought panel');
    assertHostUntaggedNoTranslate(triggerBtn, 'host thinking-collapsible-trigger');
    assertHostUntaggedNoTranslate(env.docEl, 'documentElement');
  } finally {
    api.destroy();
  }
});

test('5) sidebar-client.js marks owned top-level roots (dock, chat-pane, chat-home, topbar, chip, modal, popover, toast) without tagging host containers', async () => {
  const clientSrc = fs.readFileSync(path.join(ROOT, 'vendor', 'sidebar-studio', 'sidebar-client.js'), 'utf8');
  const env = createDomEnv();

  // Build minimal host sidebar + main canvas + topbar + composer box
  const nav = env.createElement('div', { role: 'navigation', 'aria-label': 'Sidebar' });
  nav._rect = { left: 0, top: 0, width: 260, height: 700, right: 260, bottom: 700 };
  const headerSlot = env.createElement('div');
  const navSlot = env.createElement('div');
  const divTop = env.createElement('div');
  divTop._rect = { left: 0, top: 40, width: 260, height: 1, right: 260, bottom: 41 };
  const nativeList = env.createElement('div', { 'data-testid': 'conversation-list-sidebar' });
  const divBot = env.createElement('div');
  divBot._rect = { left: 0, top: 640, width: 260, height: 1, right: 260, bottom: 641 };
  const customFooter = env.createElement('div');
  customFooter._rect = { left: 0, top: 641, width: 260, height: 48, right: 260, bottom: 689 };
  nav.appendChild(headerSlot);
  nav.appendChild(navSlot);
  nav.appendChild(divTop);
  nav.appendChild(nativeList);
  nav.appendChild(divBot);
  nav.appendChild(customFooter);

  const mainHost = env.createElement('main');
  mainHost._rect = { left: 260, top: 0, width: 1180, height: 900, right: 1440, bottom: 900 };
  const topbarWrap = env.createElement('div');
  const overviewBtn = env.createElement('button', { 'data-testid': 'toggle-overview-panel' });
  topbarWrap.appendChild(overviewBtn);
  const inputBox = env.createElement('div', { id: 'antigravity.agentSidePanelInputBox' });
  mainHost.appendChild(topbarWrap);
  mainHost.appendChild(inputBox);

  env.body.appendChild(nav);
  env.body.appendChild(mainHost);

  const rootEl = env.createElement('div', { id: 'root' });
  env.body.appendChild(rootEl);

  let curBridgeView = '/';
  env.win.__agPrismSidebarBridge = {
    isOnline: () => true,
    call: async () => ({
      ok: true,
      snapshot: {
        storeId: 's1',
        rev: 1,
        navRev: 1,
        draftRev: 1,
        activeMode: 'chat',
        currentView: curBridgeView,
        chatDraft: { kind: 'knowledge', folderId: null, sparkProjectId: null },
        assignments: {
          'chat-demo-1': { mode: 'chat', placement: { kind: 'knowledge', folderId: null }, continuation: 'ready' },
        },
        knowledgeFolders: [],
        sparkProjects: [],
        chatSidebar: {
          knowledge: { rootItems: [{ cascadeId: 'chat-demo-1', title: 'Demo Chat', updatedAt: Date.now() }], folders: [] },
          spark: { projects: [] },
          archived: { items: [], totalCount: 0 },
        },
        catalogHealth: 'ready',
        capabilities: { projectPermissions: true, perCascadeIsolation: true },
        prefs: { modeThemes: { code: {}, chat: {} } },
      },
    }),
  };

  const sandbox = {
    window: env.win,
    globalThis: null,
    document: env.doc,
    crypto: globalThis.crypto,
    getComputedStyle: env.win.getComputedStyle,
    requestAnimationFrame: env.win.requestAnimationFrame,
    cancelAnimationFrame: env.win.cancelAnimationFrame,
    setTimeout,
    clearTimeout,
    MutationObserver: class { observe() {} disconnect() {} },
    console,
  };
  sandbox.globalThis = sandbox;

  vm.runInNewContext(clientSrc, sandbox);
  const sbApi = env.win.__agPrismSidebar;
  assert.ok(sbApi);

  try {
    sbApi.sync({ sidebarStudio: 'on' });
    await new Promise((r) => setTimeout(r, 120));

    const dock = env.doc.querySelector('[data-testid="prism-bipolar-mode-dock"]');
    const pane = env.doc.querySelector('[data-testid="prism-bipolar-chat-pane"]');
    const chatHome = env.doc.querySelector('[data-testid="prism-live-chat-home"]');
    assertHasAllNoTranslateAttrs(dock, 'sidebar-client prism-bipolar-mode-dock');
    assertHasAllNoTranslateAttrs(pane, 'sidebar-client prism-bipolar-chat-pane');
    assertHasAllNoTranslateAttrs(chatHome, 'sidebar-client prism-live-chat-home');

    // Switch to running chat view by clicking chat row so topbarActs & policyChip mount, then open modal
    curBridgeView = '/c/chat-demo-1';
    const chatRow = pane.querySelector('[data-cascade-id="chat-demo-1"]');
    assert.ok(chatRow, 'chat row in pane must exist');
    chatRow.click();
    await new Promise((r) => setTimeout(r, 120));

    const topbarActs = env.doc.querySelector('[data-testid="prism-chat-topbar-acts"]');
    const policyChip = env.doc.querySelector('[data-testid="prism-chat-policy-chip"]');
    assertHasAllNoTranslateAttrs(topbarActs, 'sidebar-client prism-chat-topbar-acts');
    assertHasAllNoTranslateAttrs(policyChip, 'sidebar-client prism-chat-policy-chip');

    // Trigger policy modal and check modal backdrop has all 5 attributes
    policyChip.click();
    const modalBackdrop = env.doc.querySelector('.ag-prism-modal-backdrop');
    assertHasAllNoTranslateAttrs(modalBackdrop, 'sidebar-client .ag-prism-modal-backdrop');

    // Check source also routes toast, popover, and chat-home through markOwnedRoot
    for (const marker of [
      "const t = applyDir(markOwnedRoot(el('div', 'ag-prism-sb-toast', msg)))",
      "applyDir(markOwnedRoot(pop));",
      "const container = applyDir(markOwnedRoot(el('div', 'ag-prism-chat-home')))",
    ]) {
      assert.ok(clientSrc.includes(marker), `sidebar-client.js must apply markOwnedRoot for ${marker}`);
    }

    // Host nodes must remain clean
    assertHostUntaggedNoTranslate(nav, 'host sidebar nav');
    assertHostUntaggedNoTranslate(mainHost, 'host main');
    assertHostUntaggedNoTranslate(topbarWrap, 'host topbarWrap');
    assertHostUntaggedNoTranslate(inputBox, 'host agentSidePanelInputBox');
  } finally {
    sbApi.destroy();
  }
});

test('6) upstream-client.js has zero buildParticles dead code while effort-slider core functions operate normally', () => {
  const upstreamPath = path.join(ROOT, 'vendor', 'effort-slider', 'upstream-client.js');
  const upstreamSrc = fs.readFileSync(upstreamPath, 'utf8');
  assert.equal(/\bbuildParticles\b/.test(upstreamSrc), false, 'upstream-client.js must not contain buildParticles dead code');

  const upstreamLib = require(upstreamPath);
  const idxMap = upstreamLib.normalizeEffortIndex(null, [
    { label: 'Gemini 4 Neon (Low)' },
    { label: 'Gemini 4 Neon (High)' },
  ]);
  assert.ok(idxMap instanceof Map && idxMap.size > 0, 'normalizeEffortIndex must build effort map');
  assert.ok(upstreamLib.fillColorFor(0.8).startsWith('#'));

  const env = createDomEnv();
  const container = env.createElement('div');
  const row = env.createElement('div');
  env.body.appendChild(row);
  env.body.appendChild(container);

  const mounted = upstreamLib.mountCodexEffortSlider({
    container,
    row,
    document: env.doc,
    window: env.win,
    seat: {
      options: [
        { id: 'low', label: 'Low', effort: 'low' },
        { id: 'medium', label: 'Medium', effort: 'medium' },
        { id: 'high', label: 'High', effort: 'high' },
      ],
      selectedIndex: 2,
      onSelect() {},
    },
  });
  try {
    const stars = container.querySelectorAll('.ces-star');
    assert.equal(stars.length, 22, '22 golden-ratio PARTICLES must still render properly');
    assert.ok(container.querySelector('.ces-root'), 'slider root must mount cleanly');
  } finally {
    mounted.unmount();
  }
});
