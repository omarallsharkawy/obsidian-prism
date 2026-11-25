import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';

import {
  PrismDaemon,
  INLINE_DIFF_BINDING,
  readSafeInlineDiff,
} from '../sidecars/daemon/main.mjs';

const require = createRequire(import.meta.url);
const ROOT = path.resolve(import.meta.dirname, '..');
const cdp = require(path.join(ROOT, 'cdp.js'));
const inlineDiffMod = require(path.join(ROOT, 'vendor', 'inline-diff', 'inline-diff-client.js'));
const ctxMenuMod = require(path.join(ROOT, 'context-menu-btw.js'));
const enhancerMod = require(path.join(ROOT, 'host-workbench-enhancer.js'));
const settingsPanel = require(path.join(ROOT, 'settings-panel.js'));
const i18nLocales = require(path.join(ROOT, 'i18n-locales.js'));
const installPluginTool = require(path.join(ROOT, 'tools', 'install-plugin.cjs'));

function runGit(dir, args) {
  return execFileSync('git', ['-C', dir, ...args], {
    encoding: 'utf8',
    windowsHide: true,
    env: {
      ...process.env,
      GIT_TERMINAL_PROMPT: '0',
      GIT_AUTHOR_NAME: 'Prism Test',
      GIT_AUTHOR_EMAIL: 'prism-test@example.invalid',
      GIT_COMMITTER_NAME: 'Prism Test',
      GIT_COMMITTER_EMAIL: 'prism-test@example.invalid',
    },
  });
}

function initGitRepo(prefix) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  runGit(dir, ['init']);
  runGit(dir, ['config', 'user.name', 'Prism Test']);
  runGit(dir, ['config', 'user.email', 'prism-test@example.invalid']);
  runGit(dir, ['config', 'core.autocrlf', 'false']);
  return dir;
}

test('Redteam P0-1 & P0-2 & P0-4 & P1-1/P1-2: gitfile Fail-Closed, glob pathspec block, credential blacklist, unsafe git config fallback, semaphore & rawDiff cache', async () => {
  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'ag-prism-rt-sec-'));
  const repoDir = initGitRepo('ag-prism-rt-repo-');
  try {
    // 1) .git gitfile UNC / oversized (>4KB) / malformed Fail-Closed
    for (const [name, content] of [
      ['unc-gitfile', 'gitdir: \\\\attacker.invalid\\share\\repo.git\n'],
      ['oversized-gitfile', 'gitdir: ./.git-real\n' + ' '.repeat(4200)],
      ['invalid-gitfile', 'not-a-gitdir-pointer\n'],
    ]) {
      const sub = path.join(tmpRoot, name);
      fs.mkdirSync(sub, { recursive: true });
      fs.writeFileSync(path.join(sub, '.git'), content, 'utf8');
      const target = path.join(sub, 'demo.js');
      fs.writeFileSync(target, 'const ok = 1;\n', 'utf8');
      const res = await readSafeInlineDiff(target);
      assert.equal(res.ok, false, `Malformed/UNC gitfile (${name}) must fail closed`);
      assert.equal(res.error, 'outside_git_repo');
    }

    // Valid git worktree with gitfile pointer continues working
    fs.writeFileSync(path.join(repoDir, 'work.js'), 'const a = 1;\n', 'utf8');
    runGit(repoDir, ['add', 'work.js']);
    runGit(repoDir, ['commit', '-m', 'init']);
    const wtDir = path.join(tmpRoot, 'valid-wt');
    runGit(repoDir, ['worktree', 'add', wtDir]);
    const wtFile = path.join(wtDir, 'work.js');
    fs.writeFileSync(wtFile, 'const a = 2;\n', 'utf8');
    const wtRes = await readSafeInlineDiff(wtFile);
    assert.equal(wtRes.ok, true, 'Legitimate git worktree must remain supported');
    assert.equal(wtRes.mode, 'git-diff');

    // 2) Git glob pathspec [.][e][n][v] must not match .env via --literal-pathspecs + GIT_LITERAL_PATHSPECS=1
    fs.writeFileSync(path.join(repoDir, '.env'), 'API_KEY=supersecret\n', 'utf8');
    const globName = path.join(repoDir, '[.][e][n][v]');
    // Even if passed directly as path, literal pathspecs ensure git never expands glob against .env
    const globRes = await readSafeInlineDiff(globName);
    assert.equal(globRes.ok, false);
    assert.equal(JSON.stringify(globRes).includes('supersecret'), false);

    // 3) Google / Antigravity credential paths & extensions blocked
    const credPaths = [
      path.join(repoDir, '.gemini', 'antigravity', 'config.txt'),
      path.join(repoDir, '.config', 'gcloud', 'credentials.db'),
      path.join(repoDir, 'auth.json'),
      path.join(repoDir, 'token.json'),
      path.join(repoDir, 'mcp_config.json'),
      path.join(repoDir, 'transcript.jsonl'),
      path.join(repoDir, 'state.vscdb'),
      path.join(repoDir, 'data.sqlite'),
      path.join(repoDir, 'bash_history'),
    ];
    for (const cp of credPaths) {
      fs.mkdirSync(path.dirname(cp), { recursive: true });
      fs.writeFileSync(cp, 'SECRET_TOKEN=1\n', 'utf8');
      const r = await readSafeInlineDiff(cp);
      assert.equal(r.ok, false, `Credential file must be blocked: ${cp}`);
      assert.equal(r.error, 'blocked_sensitive');
    }

    // 4) Unsafe git config ([filter / fsmonitor=) skips git subprocess and degrades to safe bounded snapshot
    const unsafeRepo = initGitRepo('ag-prism-rt-filter-');
    try {
      const f = path.join(unsafeRepo, 'safe.js');
      fs.writeFileSync(f, 'const safe = true;\n', 'utf8');
      runGit(unsafeRepo, ['add', 'safe.js']);
      runGit(unsafeRepo, ['commit', '-m', 'init']);
      fs.writeFileSync(f, 'const safe = false;\n', 'utf8');
      fs.appendFileSync(path.join(unsafeRepo, '.git', 'config'), '\n[filter "evil"]\n\tclean = touch pwned\n', 'utf8');
      const filterRes = await readSafeInlineDiff(f);
      assert.equal(filterRes.ok, true);
      assert.equal(filterRes.mode, 'snapshot', 'Repo with [filter] config must bypass git subprocess to safe snapshot');
      assert.equal(fs.existsSync(path.join(unsafeRepo, 'pwned')), false);
    } finally {
      fs.rmSync(unsafeRepo, { recursive: true, force: true });
    }

    // 5) rawDiff cache decouples client hints (different hintAdd hits cached rawDiff cleanly)
    const multiFile = path.join(repoDir, 'hints.js');
    fs.writeFileSync(multiFile, 'line1\nline2\n', 'utf8');
    runGit(repoDir, ['add', 'hints.js']);
    runGit(repoDir, ['commit', '-m', 'hints']);
    fs.writeFileSync(multiFile, 'line1\nline2_mod\nline3_add\n', 'utf8');
    const r1 = await readSafeInlineDiff(multiFile, { hints: { additions: 1, deletions: 1 } });
    const r2 = await readSafeInlineDiff(multiFile, { hints: { additions: 99, deletions: 1 } });
    assert.equal(r1.ok, true);
    assert.equal(r2.ok, true);
    assert.equal(r2.additions, 2);

    // 6) Concurrency semaphore (max 3 active + queue cap 16 -> >19 simultaneous noCache calls shed load with 'busy')
    const burst = await Promise.all(
      Array.from({ length: 28 }, () => readSafeInlineDiff(multiFile, { noCache: true }))
    );
    const busyCount = burst.filter((x) => !x.ok && x.error === 'busy').length;
    assert.ok(busyCount >= 1, `Expected semaphore queue >16 to shed excess load with busy, got busyCount=${busyCount}`);
  } finally {
    fs.rmSync(tmpRoot, { recursive: true, force: true });
    fs.rmSync(repoDir, { recursive: true, force: true });
  }
});

test('Redteam P0-3 & P1-5: INLINE_DIFF_BINDING requires sidebarHostVerified, removes binding on skipped-non-host, and skips idle tick heal', async () => {
  const workDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ag-prism-rt-daemon-'));
  const targetPluginDir = path.join(workDir, 'obsidian-prism');
  const repoDir = initGitRepo('ag-prism-rt-bind-');
  let daemon = null;

  try {
    const tracked = path.join(repoDir, 'file.js');
    fs.writeFileSync(tracked, 'const v = 1;\n', 'utf8');
    runGit(repoDir, ['add', 'file.js']);
    runGit(repoDir, ['commit', '-m', 'init']);
    fs.writeFileSync(tracked, 'const v = 2;\n', 'utf8');

    await installPluginTool.installPlugin({
      targetDir: targetPluginDir,
      noCdp: true,
      skipHostConfig: true,
      startDaemon: false,
    });

    daemon = new PrismDaemon({
      rootDir: targetPluginDir,
      overridePort: 19993,
      pollIntervalMs: 5000,
      enableAutoUpdateTimer: false,
      silent: true,
    });

    const removedBindings = [];
    const evalCalls = [];
    let inlineDiffEvalCount = 0;
    const listeners = new Map();
    let modeSkippedNonHost = false;

    const fakeSession = {
      closed: false,
      on(ev, fn) {
        if (!listeners.has(ev)) listeners.set(ev, []);
        listeners.get(ev).push(fn);
      },
      emit(ev, params) {
        for (const fn of listeners.get(ev) || []) fn(params);
      },
      async send(method, params = {}) {
        if (method === 'Page.getFrameTree') return { frameTree: { frame: { id: 'MAIN_F' } } };
        if (method === 'Runtime.enable') {
          this.emit('Runtime.executionContextCreated', {
            context: { id: 1, auxData: { frameId: 'MAIN_F', isDefault: true, type: 'default' } },
          });
          return {};
        }
        if (method === 'Runtime.removeBinding') {
          removedBindings.push(params.name);
          return {};
        }
        if (method === 'Runtime.evaluate') {
          evalCalls.push(params);
          return {};
        }
        if (method === 'Page.addScriptToEvaluateOnNewDocument') {
          return { identifier: 'sc-1' };
        }
        return {};
      },
      async evaluate(expr) {
        const s = String(expr || '');
        if (s.includes('needsDashboardSync')) {
          return {
            ready: true,
            isHostDom: !modeSkippedNonHost,
            href: modeSkippedNonHost ? 'http://127.0.0.1:43123/viewer' : 'vscode-file://vscode-app/workbench.html',
            prismAttr: daemon.cdp.PLUGIN_VERSION,
            hasPrism: !modeSkippedNonHost,
            hasRepoBridge: !modeSkippedNonHost,
            hasThoughtBridge: !modeSkippedNonHost,
            hasUsageBridge: !modeSkippedNonHost,
            hasOmniBridge: false,
            hasOmniServerMeta: false,
            hasOmni: false,
            omniMode: 'off',
            hasSidebarBridge: false,
            hasSidebar: false,
            sidebarMode: 'off',
            hasHostI18n: false,
            hasInlineDiff: false,
            codeHash: daemon.codeHash,
            hasLegacyCss: false,
            needsDashboardSync: false,
          };
        }
        if (s.includes('__agPrismInlineDiff')) {
          inlineDiffEvalCount += 1;
          if (modeSkippedNonHost) return { ok: false, status: 'skipped-non-host' };
          return { ok: true, status: 'mounted' };
        }
        return { ok: true, status: 'ok' };
      },
      close() {
        this.closed = true;
      },
    };

    const origConnect = daemon.cdp.CdpSession.connect;
    daemon.cdp.CdpSession.connect = async () => fakeSession;
    const entry = await daemon.attachTarget({
      id: 'T_RT_GATE',
      title: 'Antigravity',
      url: 'vscode-file://vscode-app/workbench.html',
      webSocketDebuggerUrl: 'ws://127.0.0.1:19993/devtools/page/T_RT_GATE',
    });
    daemon.cdp.CdpSession.connect = origConnect;

    // 1) When sidebarHostVerified is false, INLINE_DIFF_BINDING must be rejected fail-closed
    entry.sidebarHostVerified = false;
    evalCalls.length = 0;
    await daemon.handleBindingCall(entry, {
      name: INLINE_DIFF_BINDING,
      payload: JSON.stringify({ id: 1, action: 'readInlineDiff', uri: pathToFileURL(tracked).href }),
      executionContextId: 1,
    });
    assert.equal(evalCalls.length, 0, 'Unverified host must be blocked from invoking INLINE_DIFF_BINDING');

    // 2) When Channel 6 evaluates to skipped-non-host, binding is removed and inlineDiffSkipped=true prevents idle heal loop
    modeSkippedNonHost = true;
    entry.inlineDiffMounted = false;
    entry.inlineDiffScriptId = null;
    inlineDiffEvalCount = 0;
    await daemon.verifyAndHealEntry(entry, true);
    assert.equal(entry.inlineDiffSkipped, true, 'skipped-non-host must set entry.inlineDiffSkipped = true');
    assert.ok(removedBindings.includes(INLINE_DIFF_BINDING), 'skipped-non-host must remove INLINE_DIFF_BINDING');

    const countBeforeIdleVerify = inlineDiffEvalCount;
    await daemon.verifyAndHealEntry(entry, false);
    assert.equal(inlineDiffEvalCount, countBeforeIdleVerify, 'inlineDiffSkipped=true must short-circuit idle verifyAndHealEntry');
  } finally {
    if (daemon) await daemon.stop(false).catch(() => {});
    fs.rmSync(workDir, { recursive: true, force: true });
    fs.rmSync(repoDir, { recursive: true, force: true });
  }
});

test('Redteam P0-1 & P1-1 & P1-4: zombie singleton prevention, no-RPC native fallback, and dual right-click menu mutex + selection passthrough', () => {
  const listeners = new Map();
  const bodyChildren = [];
  const makeEl = (tag, attrs = {}) => {
    const map = new Map(Object.entries(attrs));
    const clsSet = new Set(String(attrs.class || '').split(/\s+/).filter(Boolean));
    const elListeners = new Map();
    const children = [];
    const el = {
      nodeType: 1,
      tagName: String(tag).toUpperCase(),
      children,
      parentNode: null,
      parentElement: null,
      _text: '',
      style: { setProperty() {}, removeProperty() {}, getPropertyValue: () => '' },
      get id() { return map.get('id') || ''; },
      set id(v) { if (v) map.set('id', String(v)); else map.delete('id'); },
      get className() { return Array.from(clsSet).join(' '); },
      set className(v) {
        clsSet.clear();
        for (const c of String(v || '').split(/\s+/).filter(Boolean)) clsSet.add(c);
        if (clsSet.size) map.set('class', this.className);
        else map.delete('class');
      },
      classList: {
        add(...cs) { for (const c of cs) clsSet.add(c); map.set('class', el.className); },
        remove(...cs) { for (const c of cs) clsSet.delete(c); map.set('class', el.className); },
        contains(c) { return clsSet.has(c); },
      },
      get textContent() { return children.length && !this._text ? children.map((c) => c.textContent).join('') : this._text; },
      set textContent(v) { this._text = String(v ?? ''); },
      setAttribute(k, v) { map.set(k, String(v)); if (k === 'class') this.className = v; },
      getAttribute(k) { return map.has(k) ? map.get(k) : null; },
      hasAttribute(k) { return map.has(k); },
      removeAttribute(k) { map.delete(k); if (k === 'class') clsSet.clear(); },
      appendChild(ch) { children.push(ch); ch.parentNode = this; ch.parentElement = this; return ch; },
      insertBefore(ch, ref) {
        const idx = ref ? children.indexOf(ref) : -1;
        if (idx >= 0) children.splice(idx, 0, ch);
        else children.push(ch);
        ch.parentNode = this;
        ch.parentElement = this;
        return ch;
      },
      remove() {
        const arr = this.parentNode?.children;
        if (arr) { const i = arr.indexOf(this); if (i >= 0) arr.splice(i, 1); }
        this.parentNode = null;
        this.parentElement = null;
      },
      addEventListener(t, fn) { if (!elListeners.has(t)) elListeners.set(t, new Set()); elListeners.get(t).add(fn); },
      removeEventListener(t, fn) { elListeners.get(t)?.delete(fn); },
      closest(sel) {
        const parts = sel.split(',').map((s) => s.trim()).filter(Boolean);
        let cur = this;
        while (cur) {
          for (const p of parts) {
            if (p.startsWith('.') && cur.classList?.contains(p.slice(1))) return cur;
            const am = /^\[([a-zA-Z0-9_-]+)(?:="([^"]*)")?\]$/.exec(p);
            if (am && (am[2] !== undefined ? cur.getAttribute(am[1]) === am[2] : cur.hasAttribute(am[1]))) return cur;
          }
          cur = cur.parentElement;
        }
        return null;
      },
      querySelector(sel) { return this.querySelectorAll(sel)[0] || null; },
      querySelectorAll(sel) {
        const out = [];
        const parts = sel.split(',').map((s) => s.trim()).filter(Boolean);
        const match = (n, p) => {
          if (p.startsWith('#')) return n.id === p.slice(1);
          if (p.startsWith('.')) return n.classList?.contains(p.slice(1));
          const am = /^\[([a-zA-Z0-9_-]+)(?:="([^"]*)")?\]$/.exec(p);
          return am ? (am[2] !== undefined ? n.getAttribute(am[1]) === am[2] : n.hasAttribute(am[1])) : false;
        };
        const walk = (n) => { for (const c of n.children) { if (parts.some((p) => match(c, p))) out.push(c); walk(c); } };
        walk(this);
        return out;
      },
      getBoundingClientRect() { return { left: 0, top: 0, width: 640, height: 28, right: 640, bottom: 28 }; },
    };
    return el;
  };

  const html = makeEl('html', { 'data-ag-cs-lang': 'en' });
  const head = makeEl('head');
  const body = makeEl('body', { class: 'monaco-workbench' });
  html.appendChild(head);
  html.appendChild(body);
  const doc = {
    readyState: 'complete',
    documentElement: html,
    head,
    body,
    createElement: (t) => makeEl(t),
    createElementNS: (_ns, t) => makeEl(t),
    getElementById: (id) => html.querySelector(`#${id}`),
    querySelector: (sel) => html.querySelector(sel),
    querySelectorAll: (sel) => html.querySelectorAll(sel),
    addEventListener(t, fn) { if (!listeners.has(t)) listeners.set(t, new Set()); listeners.get(t).add(fn); },
    removeEventListener(t, fn) { listeners.get(t)?.delete(fn); },
  };
  let selectionText = '';
  const win = {
    innerWidth: 1280,
    innerHeight: 800,
    document: doc,
    location: { href: 'vscode-file://vscode-app/workbench.html' },
    getComputedStyle: (el) => ({ display: 'flex', flexDirection: el?.classList?.contains('flex-col') ? 'column' : 'row', getPropertyValue: () => '' }),
    getSelection: () => ({ toString: () => selectionText }),
    addEventListener(t, fn) { if (!listeners.has(t)) listeners.set(t, new Set()); listeners.get(t).add(fn); },
    removeEventListener(t, fn) { listeners.get(t)?.delete(fn); },
    dispatchEvent(ev) { for (const fn of listeners.get(ev.type) || []) fn(ev); },
    requestAnimationFrame: (fn) => { fn(16); return 1; },
    cancelAnimationFrame() {},
    setTimeout,
    clearTimeout,
  };

  // 1) No-RPC graceful fallback: toggleInlineDiffPreview without lines and without __agPrismInlineDiffCall returns false cleanly
  const col = makeEl('div', { class: 'flex flex-col' });
  const row = makeEl('div', { class: 'group flex w-full' });
  const badge = makeEl('span', { 'data-testid': 'diff-line-count' });
  badge.textContent = '+3 -1';
  badge.__reactFiber$test = { memoizedProps: { fileDiff: { uri: 'file:///C:/repo/a.js' } }, return: null };
  row.appendChild(badge);
  col.appendChild(row);
  body.appendChild(col);

  const client = inlineDiffMod.createInlineDiffClient({ win, doc, getConfig: () => ({}) });
  win.__agPrismInlineDiff = client;
  assert.equal(client.toggleInlineDiffPreview(badge), false, 'Without RPC and local lines, must yield false to native click');
  assert.equal(col.querySelector('.ag-cs-inline-diff-box'), null, 'Must never mount empty error card when yielding to native click');

  // 2) Dual right-click menu mutex: ag-prism:ctx-open closes diffCtxMenu when source !== 'inline-diff'
  // First open an inline diff box using local JSON payload, then right-click badge to open diff menu
  badge.setAttribute('data-ag-diff-json', JSON.stringify({ file: 'a.js', additions: 1, deletions: 0, oldText: 'a', newText: 'a\nb' }));
  assert.equal(client.toggleInlineDiffPreview(badge), true);
  assert.ok(col.querySelector('.ag-cs-inline-diff-box'));

  let prevented = false;
  win.dispatchEvent({ type: 'contextmenu', target: badge, clientX: 50, clientY: 50, shiftKey: false, preventDefault() { prevented = true; }, stopPropagation() {} });
  assert.equal(prevented, true);
  assert.ok(body.querySelector('.ag-cs-diff-ctx-menu'), 'Diff context menu must open');

  // Shift+Right-click must close diff menu and pass through without preventing default
  let shiftPrevented = false;
  win.dispatchEvent({ type: 'contextmenu', target: badge, clientX: 50, clientY: 50, shiftKey: true, preventDefault() { shiftPrevented = true; }, stopPropagation() {} });
  assert.equal(shiftPrevented, false);
  assert.equal(body.querySelector('.ag-cs-diff-ctx-menu'), null);

  // Re-open diff menu, then dispatch /btw ctx-open bus event -> diff menu must auto-close
  win.dispatchEvent({ type: 'contextmenu', target: badge, clientX: 50, clientY: 50, shiftKey: false, preventDefault() {}, stopPropagation() {} });
  assert.ok(body.querySelector('.ag-cs-diff-ctx-menu'));
  win.dispatchEvent({ type: 'ag-prism:ctx-open', detail: { source: 'btw' } });
  assert.equal(body.querySelector('.ag-cs-diff-ctx-menu'), null, 'Opening /btw menu must close diff context menu');

  // Text selection inside .ag-cs-inline-diff-box must pass through to /btw menu
  const box = col.querySelector('.ag-cs-inline-diff-box');
  const codeSpan = box.querySelector('.ag-cs-inline-diff-code') || box;
  selectionText = 'selected code';
  let selPrevented = false;
  win.dispatchEvent({ type: 'contextmenu', target: codeSpan, clientX: 60, clientY: 60, shiftKey: false, preventDefault() { selPrevented = true; }, stopPropagation() {} });
  assert.equal(selPrevented, false, 'Selection inside inline diff box must pass through to /btw menu');

  // Verify context-menu-btw.js includes .ag-cs-diff-ctx-menu in EXCL and closes diff menu
  const btwSrc = fs.readFileSync(path.join(ROOT, 'context-menu-btw.js'), 'utf8');
  assert.ok(btwSrc.includes('.ag-cs-diff-ctx-menu'));
  assert.ok(btwSrc.includes('closeMenuIfOpen'));
  assert.ok(ctxMenuMod);

  // 3) Zombie singleton prevention: Channel 6 destroy sets destroyed=true and mountOrReuse replaces it cleanly
  client.destroy();
  assert.equal(client.getDebugState().destroyed, true);
  assert.equal(win.__agPrismInlineDiff, undefined);
  const expr = cdp.buildInlineDiffInjectExpression(cdp.DEFAULT_CONFIG);
  const sandbox = {
    window: null,
    globalThis: null,
    self: null,
    top: null,
    document: doc,
    location: win.location,
    getComputedStyle: win.getComputedStyle,
    requestAnimationFrame: win.requestAnimationFrame,
    cancelAnimationFrame: win.cancelAnimationFrame,
    setTimeout,
    clearTimeout,
    setInterval: () => 1,
    clearInterval() {},
    Uint16Array,
    Math, Date, JSON, Map, Set, Array, Object, String, Number, Boolean, Promise, RegExp, Error,
  };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  sandbox.self = sandbox;
  sandbox.top = sandbox;
  // Simulate stale reference left on window with destroyed=true -> mountOrReuse must NOT reuse it!
  sandbox.__agPrismInlineDiff = client;
  const remountRes = vm.runInNewContext(expr, sandbox);
  assert.equal(remountRes.ok, true);
  assert.notEqual(remountRes.reused, true, 'mountOrReuse must never reuse a destroyed Channel 6 singleton');
  assert.equal(sandbox.__agPrismInlineDiff.getDebugState().destroyed, false);
  sandbox.__agPrismInlineDiff.destroy();
});

test('Redteam P1-2 & P1-3 & P0-1(ui-runtime): style.css exclusions/contrasts, sidebarNavFold collapsed & parent-gate, and bidirectional hostSleep', () => {
  const styleCss = fs.readFileSync(path.join(ROOT, 'style.css'), 'utf8');
  const replicaCss = fs.readFileSync(path.join(ROOT, 'workbench', 'replica.css'), 'utf8');
  const uiRuntimeSrc = fs.readFileSync(path.join(ROOT, 'ui-runtime.js'), 'utf8');

  // 1) style.css PR #10 & /btw & Issue #15 contrast guards
  assert.ok(styleCss.includes(':not(.ag-cs-ctx-menu):not(.ag-cs-diff-ctx-menu)'), 'style.css [role="menu"] must exclude both prism context menus');
  assert.ok(styleCss.includes(':not(.ag-cs-ctx-item):not(.ag-cs-diff-ctx-item):not([data-ces-orch-row="1"])'), 'style.css [role="menuitem*"] must exclude ctx items and PR #10 Orchestrator rows');
  assert.ok(styleCss.includes(':not(.ces-set)'), 'style.css dialog surface must exclude .ces-set to prevent white-on-white light contrast failure');
  assert.equal(styleCss.includes('.ag-cs-hist-search'), false, 'Dead replica CSS .ag-cs-hist-search must be removed from production style.css');
  assert.ok(replicaCss.includes('.ag-cs-hist-search'), 'workbench/replica.css must hold .ag-cs-hist-search');

  // 2) Narrow collapsed sidebarNavFold CSS + sidebarRestyle=false gate in settings-panel & enhancer
  assert.ok(styleCss.includes('[data-ag-cs-sidebar-collapsed="1"]'), 'style.css must handle collapsed sidebar state');
  assert.ok(styleCss.includes('[data-testid="sidebar-navigation-items"] :is(button,a,.ag-cs-sb-more-btn)'), 'Collapsed narrow sidebar must center .ag-cs-sb-more-btn as 36x36 icon');
  assert.ok(styleCss.includes('.ag-cs-sb-more-lbl,.ag-cs-sb-more-chev){display:none !important;}'));

  // settings-panel dims sidebarNavFold when sidebarRestyle is false
  const prevWin = globalThis.window;
  const prevDoc = globalThis.document;
  const prevLs = globalThis.localStorage;
  try {
    const lsMap = new Map([['ag-prism:settings-open', '1']]);
    const mk = (tag, attrs = {}) => {
      const am = new Map(Object.entries(attrs));
      const clsSet = new Set(String(attrs.class || '').split(/\s+/).filter(Boolean));
      const ch = [];
      const listeners = new Map();
      const el = {
        nodeType: 1,
        isConnected: true,
        tagName: String(tag).toUpperCase(),
        children: ch,
        style: { opacity: '', display: '', setProperty() {}, removeProperty() {} },
        get id() { return am.get('id') || ''; },
        set id(v) { if (v) am.set('id', String(v)); else am.delete('id'); },
        get className() { return Array.from(clsSet).join(' '); },
        set className(v) { clsSet.clear(); for (const c of String(v || '').split(/\s+/).filter(Boolean)) clsSet.add(c); if (clsSet.size) am.set('class', this.className); else am.delete('class'); },
        classList: {
          add(...cs) { for (const c of cs) clsSet.add(c); am.set('class', el.className); },
          remove(...cs) { for (const c of cs) clsSet.delete(c); am.set('class', el.className); },
          contains(c) { return clsSet.has(c); },
        },
        setAttribute(k, v) { am.set(k, String(v)); if (k === 'class') this.className = v; },
        getAttribute(k) { return am.has(k) ? am.get(k) : null; },
        hasAttribute(k) { return am.has(k); },
        removeAttribute(k) { am.delete(k); if (k === 'class') clsSet.clear(); },
        appendChild(c) { ch.push(c); c.parentElement = this; c.parentNode = this; return c; },
        insertBefore(c, ref) { const i = ref ? ch.indexOf(ref) : -1; if (i >= 0) ch.splice(i, 0, c); else ch.push(c); c.parentElement = this; c.parentNode = this; return c; },
        remove() { const a = this.parentNode?.children; if (a) { const i = a.indexOf(this); if (i >= 0) a.splice(i, 1); } },
        replaceChildren(...xs) { ch.length = 0; for (const x of xs) this.appendChild(x); },
        addEventListener(t, fn) { if (!listeners.has(t)) listeners.set(t, new Set()); listeners.get(t).add(fn); },
        click() { for (const fn of listeners.get('click') || []) fn({ preventDefault() {}, stopPropagation() {} }); },
        closest(sel) {
          let cur = this;
          while (cur) {
            if (sel === '[role="dialog"]' && cur.getAttribute('role') === 'dialog') return cur;
            if (sel === 'div.p-6' && cur.tagName === 'DIV' && cur.classList.contains('p-6')) return cur;
            cur = cur.parentElement;
          }
          return null;
        },
        querySelector(sel) { return this.querySelectorAll(sel)[0] || null; },
        querySelectorAll(sel) {
          const out = [];
          const walk = (n) => {
            for (const c of n.children) {
              if (sel === '[role="dialog"] h2' && c.tagName === 'H2' && c.parentElement?.closest?.('[role="dialog"]')) out.push(c);
              else if (sel === 'div.space-y-2' && c.tagName === 'DIV' && c.classList.contains('space-y-2')) out.push(c);
              else if (sel.startsWith('#') && c.id === sel.slice(1)) out.push(c);
              else if (sel.startsWith('.') && c.classList.contains(sel.slice(1))) out.push(c);
              else {
                const attrM = /^\[([a-zA-Z0-9_-]+)(?:="([^"]*)")?\]$/.exec(sel);
                if (attrM && (attrM[2] !== undefined ? c.getAttribute(attrM[1]) === attrM[2] : c.hasAttribute(attrM[1]))) out.push(c);
              }
              walk(c);
            }
          };
          walk(this);
          return out;
        },
      };
      return el;
    };
    const dlg = mk('div', { role: 'dialog' });
    const panel = mk('div', { class: 'p-6' });
    const h2 = mk('h2');
    h2.textContent = 'المظهر';
    const anchorSec = mk('div', { class: 'space-y-2' });
    panel.appendChild(h2);
    panel.appendChild(anchorSec);
    dlg.appendChild(panel);
    const body = mk('div');
    body.appendChild(dlg);
    const html = mk('html');
    html.appendChild(body);
    const doc = {
      documentElement: html,
      body,
      createElement: (t) => mk(t),
      getElementById: (id) => html.querySelector(`#${id}`),
      querySelector: (s) => html.querySelector(s),
      querySelectorAll: (s) => html.querySelectorAll(s),
    };
    globalThis.document = doc;
    globalThis.window = { document: doc, matchMedia: () => ({ matches: false }) };
    globalThis.localStorage = { getItem: (k) => lsMap.get(k) ?? null, setItem: (k, v) => lsMap.set(k, String(v)) };

    const st = { ...cdp.DEFAULT_CONFIG, sidebarRestyle: false, sidebarNavFold: 'on' };
    settingsPanel.mountOrSyncSettingsSection({
      version: cdp.PLUGIN_VERSION,
      getLang: () => 'ar',
      uiText: () => i18nLocales.getUiStrings('ar'),
      isZh: () => true,
      i18nCore: {},
      formatSettingsSummary: () => 'summary',
      resolveSettingRowActiveValue: (k) => st[k],
      isSettingButtonMatch: (k, valJson, cur) => valJson === JSON.stringify(cur),
      saveSetting() {},
      saveSettingsBatch() {},
      getThoughtTranslateMode: () => st.thoughtTranslate,
      handledGroupClicks: new WeakSet(),
      runSettingsGroupGlide() {},
      runGuardedMut: (fn) => fn(),
    });
    const navFoldRow = dlg.querySelector('[data-ag-cs-row="sidebarNavFold"]');
    assert.ok(navFoldRow);
    assert.equal(navFoldRow.style.opacity, '0.55', 'sidebarNavFold row must dim when parent sidebarRestyle=false');
    assert.equal(navFoldRow.getAttribute('data-ag-cs-dimmed'), '1');
  } finally {
    if (prevWin === undefined) delete globalThis.window; else globalThis.window = prevWin;
    if (prevDoc === undefined) delete globalThis.document; else globalThis.document = prevDoc;
    if (prevLs === undefined) delete globalThis.localStorage; else globalThis.localStorage = prevLs;
  }

  // host-workbench-enhancer syncSidebarOverflowTools also honors sidebarRestyle=false gate
  assert.ok(enhancerMod);
  assert.ok(uiRuntimeSrc.includes("msLastHostSleep !== chatSleep"), 'ui-runtime syncCrab must perform bidirectional cached hostSleep sync');
  assert.equal(/onWinBlur[\s\S]{0,400}host-sleep/.test(uiRuntimeSrc), false, 'window.blur must NOT trigger host-sleep VRAM wipe');
});
