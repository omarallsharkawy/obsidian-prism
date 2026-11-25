import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

import {
  ThoughtTranslatorService,
  normalizeOpenAiBaseUrl,
  validateOpenAiBaseUrl,
  isKeylessAllowedEndpoint,
} from '../vendor/thought-translator/translator-service.mjs';
import { createLiveHostAdapter } from '../vendor/sidebar-studio/live-host-adapter.mjs';
import { MetricsStore } from '../vendor/pulse-dashboard/sidecars/panel/store.mjs';
import { TrajectoryReader } from '../vendor/pulse-dashboard/sidecars/panel/trajectory-reader.mjs';
import { UsageLedger, DesktopUsage, LOCAL_SCOPE } from '../vendor/pulse-dashboard/sidecars/panel/usage.mjs';
import { BackgroundStatistics } from '../vendor/pulse-dashboard/sidecars/panel/background-statistics.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');
const SIDEBAR_CLIENT_FILE = path.join(ROOT_DIR, 'vendor', 'sidebar-studio', 'sidebar-client.js');

function createSidebarClientHarness({
  initialBootCfg = null,
  assignments = {},
  startCascadeImpl = null,
  wrapperSendImpl = null,
  rawSendImpl = null,
} = {}) {
  const clientCode = fs.readFileSync(SIDEBAR_CLIENT_FILE, 'utf8');
  const docListeners = new Map();
  const winListeners = new Map();
  const timers = new Map();
  let nextTimerId = 1;
  let storeSubCount = 0;
  let storeUnsubCount = 0;
  let routerSubCount = 0;
  let routerUnsubCount = 0;

  const listenerKey = (type, capture) => `${type}:${capture ? 'cap' : 'bub'}`;
  const addToMap = (map, type, fn, opts) => {
    const cap = typeof opts === 'boolean' ? opts : Boolean(opts && opts.capture);
    const k = listenerKey(type, cap);
    if (!map.has(k)) map.set(k, new Set());
    map.get(k).add(fn);
  };
  const removeFromMap = (map, type, fn, opts) => {
    const cap = typeof opts === 'boolean' ? opts : Boolean(opts && opts.capture);
    const k = listenerKey(type, cap);
    map.get(k)?.delete(fn);
  };
  const countMapListeners = (map) => {
    let total = 0;
    for (const set of map.values()) total += set.size;
    return total;
  };

  const makeNode = (tag) => {
    const attrs = new Map();
    const classes = new Set();
    const node = {
      tagName: String(tag || 'DIV').toUpperCase(),
      nodeName: String(tag || 'DIV').toUpperCase(),
      id: '',
      children: [],
      style: {},
      classList: {
        add: (...cs) => cs.forEach((c) => classes.add(c)),
        remove: (...cs) => cs.forEach((c) => classes.delete(c)),
        contains: (c) => classes.has(c),
      },
      setAttribute(k, v) {
        attrs.set(k, String(v));
        if (k === 'id') this.id = String(v);
      },
      getAttribute(k) {
        return attrs.has(k) ? attrs.get(k) : null;
      },
      removeAttribute(k) {
        attrs.delete(k);
      },
      appendChild(c) {
        c.parentElement = node;
        node.children.push(c);
        return c;
      },
      insertBefore(c) {
        c.parentElement = node;
        node.children.push(c);
        return c;
      },
      remove() {
        if (this.parentElement) {
          const i = this.parentElement.children.indexOf(this);
          if (i >= 0) this.parentElement.children.splice(i, 1);
          this.parentElement = null;
        }
      },
      addEventListener() {},
      removeEventListener() {},
      querySelector() {
        return null;
      },
      querySelectorAll() {
        return [];
      },
      getBoundingClientRect() {
        return { width: 240, height: 600, top: 0, left: 0, bottom: 600, right: 240 };
      },
      get firstChild() {
        return node.children[0] || null;
      },
    };
    return node;
  };

  const startCalls = [];
  const rawSendCalls = [];
  const wrapperSendCalls = [];

  const origRawSend = async (req) => {
    rawSendCalls.push(req);
    if (typeof rawSendImpl === 'function') return await rawSendImpl(req);
    return {};
  };
  const origWrapperSend = async (req) => {
    wrapperSendCalls.push(req);
    if (typeof wrapperSendImpl === 'function') return await wrapperSendImpl(req);
    return {};
  };

  const fakeLsClient = {
    startCascade: async (req) => {
      startCalls.push(req);
      if (typeof startCascadeImpl === 'function') return await startCascadeImpl(req);
      return { cascadeId: req.cascadeId };
    },
    sendUserCascadeMessage: origRawSend,
    updateConversationAnnotations: async () => ({}),
    deleteCascadeTrajectory: async () => ({}),
  };

  const fakeLsWrapper = {
    startCascade: async (req) => ({ cascadeId: req.cascadeId }),
    sendUserCascadeMessage: origWrapperSend,
    deleteCascadeTrajectory: async () => ({}),
    updateConversationAnnotations: async () => ({}),
  };

  const fakeRouter = {
    state: { location: { pathname: '/' } },
    navigate() {},
    subscribe() {
      routerSubCount += 1;
      return () => {
        routerUnsubCount += 1;
      };
    },
  };

  const fakeStore = {
    getState: () => ({
      trajectorySummaries: { summaries: {} },
      userStatus: { cascadeModelConfigData: { clientModelConfigs: [] } },
    }),
    subscribe() {
      storeSubCount += 1;
      return () => {
        storeUnsubCount += 1;
      };
    },
    dispatch() {},
  };

  const rootEl = makeNode('div');
  rootEl.id = 'root';
  rootEl.__reactFiber$sec = {
    tag: 10,
    memoizedProps: { value: { store: fakeStore } },
    sibling: {
      tag: 10,
      memoizedProps: { value: fakeLsWrapper },
      sibling: {
        tag: 10,
        memoizedProps: { value: fakeRouter },
        sibling: {
          tag: 10,
          memoizedProps: {
            value: {
              core: {
                projectManagementService: {
                  projectsStateProvider: { getState: () => [] },
                  lsClient: fakeLsClient,
                },
              },
            },
          },
        },
      },
    },
  };

  const doc = {
    head: makeNode('head'),
    body: makeNode('body'),
    documentElement: makeNode('html'),
    hidden: false,
    createElement: (tag) => makeNode(tag),
    createElementNS: (_ns, tag) => makeNode(tag),
    getElementById: (id) => (id === 'root' ? rootEl : null),
    querySelector: () => null,
    querySelectorAll: () => [],
    addEventListener: (type, fn, opts) => addToMap(docListeners, type, fn, opts),
    removeEventListener: (type, fn, opts) => removeFromMap(docListeners, type, fn, opts),
  };

  const snap = {
    storeId: 'store-sec',
    rev: 1,
    navRev: 1,
    draftRev: 1,
    activeMode: 'chat',
    currentView: '/',
    chatDraft: { kind: 'knowledge', folderId: null, sparkProjectId: null },
    assignments,
    knowledgeFolders: [],
    sparkProjects: [],
    chatSidebar: { knowledge: { rootItems: [], folders: [] }, spark: { projects: [] }, archived: { items: [], totalCount: 0 } },
    catalogHealth: 'ready',
    capabilities: { projectPermissions: false, perCascadeIsolation: true },
  };

  const win = {
    document: doc,
    innerWidth: 1440,
    innerHeight: 900,
    location: { pathname: '/' },
    getComputedStyle: () => ({ position: 'relative' }),
    addEventListener: (type, fn, opts) => addToMap(winListeners, type, fn, opts),
    removeEventListener: (type, fn, opts) => removeFromMap(winListeners, type, fn, opts),
    __agPrismSidebarBridge: {
      isOnline: () => true,
      call: async () => ({ ok: true, snapshot: snap }),
    },
  };
  if (initialBootCfg) {
    win.__agPrism = { getState: () => ({ cfg: initialBootCfg }) };
  }

  const fakeSetTimeout = (fn, ms) => {
    const id = nextTimerId++;
    timers.set(id, { fn, ms });
    return id;
  };
  const fakeClearTimeout = (id) => {
    timers.delete(id);
  };

  vm.runInNewContext(clientCode, {
    window: win,
    globalThis: win,
    document: doc,
    crypto: globalThis.crypto,
    getComputedStyle: win.getComputedStyle,
    setTimeout: fakeSetTimeout,
    clearTimeout: fakeClearTimeout,
  });

  return {
    win,
    doc,
    fakeLsClient,
    fakeLsWrapper,
    origRawSend,
    origWrapperSend,
    startCalls,
    rawSendCalls,
    wrapperSendCalls,
    timers,
    getCounts: () => ({
      docListeners: countMapListeners(docListeners),
      winListeners: countMapListeners(winListeners),
      activeTimers: timers.size,
      storeSubCount,
      storeUnsubCount,
      routerSubCount,
      routerUnsubCount,
    }),
  };
}

test('P1 sidebar-client: off-mode module self-protection mounts 0 listeners/timers/hostOps, lazy-activates on sync("on"), and symmetrically unbinds on sync("off")', async () => {
  const h = createSidebarClientHarness();

  assert.equal(h.win.__agPrismSidebarHostOps, undefined);
  assert.equal(h.getCounts().docListeners, 0);
  assert.equal(h.getCounts().winListeners, 0);
  assert.equal(h.getCounts().activeTimers, 0);
  assert.equal(h.getCounts().storeSubCount, 0);
  assert.equal(h.getCounts().routerSubCount, 0);
  assert.equal(h.fakeLsWrapper.sendUserCascadeMessage, h.origWrapperSend);
  assert.equal(h.fakeLsClient.sendUserCascadeMessage, h.origRawSend);
  assert.equal(h.win.__agPrismSidebar.getState().listenersBound, false);

  h.win.__agPrismSidebar.sync({ sidebarStudio: 'on' });
  await Promise.resolve();
  assert.ok(h.win.__agPrismSidebarHostOps);
  assert.equal(h.getCounts().docListeners, 8);
  assert.equal(h.getCounts().winListeners, 1);
  assert.equal(h.getCounts().storeSubCount, 1);
  assert.equal(h.getCounts().routerSubCount, 1);
  assert.notEqual(h.fakeLsWrapper.sendUserCascadeMessage, h.origWrapperSend);
  assert.notEqual(h.fakeLsClient.sendUserCascadeMessage, h.origRawSend);

  h.win.__agPrismSidebar.sync({ sidebarStudio: 'on' });
  assert.equal(h.getCounts().docListeners, 8);
  assert.equal(h.getCounts().winListeners, 1);
  assert.equal(h.getCounts().storeSubCount, 1);
  assert.equal(h.getCounts().routerSubCount, 1);

  h.win.__agPrismSidebar.sync({ sidebarStudio: 'off' });
  assert.equal(h.win.__agPrismSidebarHostOps, undefined);
  assert.equal(h.getCounts().docListeners, 0);
  assert.equal(h.getCounts().winListeners, 0);
  assert.equal(h.getCounts().activeTimers, 0);
  assert.equal(h.getCounts().storeUnsubCount, 1);
  assert.equal(h.getCounts().routerUnsubCount, 1);
  assert.equal(h.fakeLsWrapper.sendUserCascadeMessage, h.origWrapperSend);
  assert.equal(h.fakeLsClient.sendUserCascadeMessage, h.origRawSend);
  assert.equal(h.win.__agPrismSidebar.getState().listenersBound, false);

  h.win.__agPrismSidebar.destroy();
});

test('P1 sidebar-client: Chat send guard & reserveSession enforce strict fail-closed while Code sends pass through untouched', async () => {
  let startAttempt = 0;
  const h = createSidebarClientHarness({
    assignments: {
      'chat-iso-1': { mode: 'chat', placement: { kind: 'knowledge', folderId: null }, continuation: 'ready' },
    },
    startCascadeImpl: async () => {
      startAttempt += 1;
      throw new Error(`customAgentSpec unsupported stage ${startAttempt}`);
    },
  });

  h.win.__agPrismSidebar.sync({ sidebarStudio: 'on' });
  await new Promise((r) => setTimeout(r, 10));

  const brokenChatReq = { cascadeId: 'chat-iso-1' };
  Object.defineProperty(brokenChatReq, 'cascadeConfig', {
    enumerable: true,
    get() {
      throw new Error('simulated isolation serialization failure');
    },
  });

  assert.throws(
    () => h.fakeLsWrapper.sendUserCascadeMessage(brokenChatReq),
    /Chat isolation failed \(fail-closed\)/
  );
  assert.equal(h.wrapperSendCalls.length, 0);

  assert.throws(
    () => h.fakeLsClient.sendUserCascadeMessage(brokenChatReq),
    /Chat isolation failed \(fail-closed\)/
  );
  assert.equal(h.rawSendCalls.length, 0);

  const codeReq = { cascadeId: 'code-session-ok', cascadeConfig: { plannerConfig: { planModel: 1532 } } };
  await h.fakeLsWrapper.sendUserCascadeMessage(codeReq);
  assert.equal(h.wrapperSendCalls.length, 1);
  assert.equal(h.wrapperSendCalls[0], codeReq);

  const protoNameReq = { cascadeId: 'toString', cascadeConfig: {} };
  await h.fakeLsWrapper.sendUserCascadeMessage(protoNameReq);
  assert.equal(h.wrapperSendCalls.length, 2);
  assert.equal(h.wrapperSendCalls[1], protoNameReq);

  const resv = await h.win.__agPrismSidebarHostOps.reserveSession({
    idempotencyKey: 'fc-reserve-1',
    scopeRef: 'scope-knowledge-default',
    kind: 'knowledge',
    title: 'Fail Closed Test',
    dirPath: '',
  });
  assert.equal(resv.ok, false);
  assert.match(resv.error, /chat-isolation-spec-rejected/);
  assert.equal(h.startCalls.length, 3);
  assert.ok(
    h.startCalls.every((payload) => Boolean(payload && payload.customAgentSpec))
  );
  assert.equal(h.win.__agPrismSidebarLastStartStage, 'rejected-fail-closed');

  h.win.__agPrismSidebar.destroy();
});

test('P1 sidebar-client: bounded FIFO cap (<= 256) and off/destroy clear for reservedMap, deliveredMap, and sessionModelOverrides', async () => {
  const h = createSidebarClientHarness();
  h.win.__agPrismSidebar.sync({ sidebarStudio: 'on' });
  await new Promise((r) => setTimeout(r, 10));

  const ops = h.win.__agPrismSidebarHostOps;
  for (let i = 0; i < 270; i++) {
    const r = await ops.reserveSession({
      idempotencyKey: `resv-key-${i}`,
      scopeRef: 'scope-knowledge-default',
      kind: 'knowledge',
      title: `T${i}`,
      dirPath: '',
    });
    assert.equal(r.ok, true);
    const d = await ops.deliverFirstMessage({
      idempotencyKey: `deliv-key-${i}`,
      cascadeId: r.cascadeId,
      message: `msg-${i}`,
      scopeRef: 'scope-knowledge-default',
      kind: 'knowledge',
      dirPath: '',
    });
    assert.equal(d.status, 'delivered');
  }

  const stPeak = h.win.__agPrismSidebar.getState();
  assert.equal(stPeak.mapSizes.reserved, 256);
  assert.equal(stPeak.mapSizes.delivered, 256);

  const chkOld = await ops.checkDeliveryStatus({ idempotencyKey: 'deliv-key-0', cascadeId: 'any' });
  const chkNew = await ops.checkDeliveryStatus({ idempotencyKey: 'deliv-key-269', cascadeId: 'any' });
  assert.equal(chkOld.delivered, false);
  assert.equal(chkNew.delivered, true);

  h.win.__agPrismSidebar.sync({ sidebarStudio: 'off' });
  const stOff = h.win.__agPrismSidebar.getState();
  assert.equal(stOff.mapSizes.reserved, 0);
  assert.equal(stOff.mapSizes.delivered, 0);
  assert.equal(stOff.mapSizes.modelOverrides, 0);

  h.win.__agPrismSidebar.destroy();
});

test('P1 translator-service: blocks IPv6 SSRF variants, tightens keyless ULA regex, and never leaks 3rd-party API keys to api.openai.com', async () => {
  const blockedUrls = [
    'http://[::ffff:169.254.169.254]/latest/meta-data/',
    'http://[::ffff:a9fe:a9fe]/latest/meta-data/',
    'http://[0:0:0:0:0:ffff:a9fe:a9fe]/v1',
    'http://[::ffff:100.100.100.200]/latest/meta-data/',
    'http://[::ffff:6464:64c8]/latest/meta-data/',
    'http://[::169.254.169.254]/latest/meta-data/',
    'http://[::a9fe:a9fe]/latest/meta-data/',
    'http://[::100.100.100.200]/latest/meta-data/',
    'http://[::6464:64c8]/latest/meta-data/',
    'http://[64:ff9b::169.254.169.254]/latest/meta-data/',
    'http://[64:ff9b::a9fe:a9fe]/latest/meta-data/',
    'http://[64:ff9b::100.100.100.200]/v1',
    'http://[64:ff9b::6464:64c8]/v1',
    'http://[fe80::1]:8000/v1',
    'http://[fe80::a9fe:a9fe]/v1',
    'http://[febf::1234]:8000/v1',
    'http://[fd00:ec2::254]/latest/meta-data/',
    'http://[::]:11434/v1',
    'http://[0:0:0:0:0:0:0:0]:11434/v1',
    'http://127.0.0.1:6379/v1',
    'file:///etc/passwd',
  ];

  for (const url of blockedUrls) {
    const check = validateOpenAiBaseUrl(url);
    assert.equal(check.ok, false);
    assert.equal(isKeylessAllowedEndpoint(url), false);
    assert.equal(normalizeOpenAiBaseUrl(url), 'https://api.openai.com/v1');
  }

  const allowedLocalUrls = [
    'http://127.0.0.1:11434/v1',
    'http://[::1]:8000/v1',
    'http://localhost:1234/v1',
    'http://192.168.1.20:11434/v1',
    'http://10.0.0.8:8000/v1',
    'http://172.16.0.5:8000/v1',
    'http://100.64.0.12:8000/v1',
    'http://[fd12:3456::1]:11434/v1',
    'http://[fc00::1]:11434/v1',
  ];
  for (const url of allowedLocalUrls) {
    assert.equal(validateOpenAiBaseUrl(url).ok, true);
    assert.equal(isKeylessAllowedEndpoint(url), true);
  }

  assert.equal(isKeylessAllowedEndpoint('https://fc2.com/v1'), false);
  assert.equal(isKeylessAllowedEndpoint('https://fd-evil.com/v1'), false);
  assert.equal(isKeylessAllowedEndpoint('https://fc00.example.com/v1'), false);
  assert.equal(isKeylessAllowedEndpoint('https://fd99.example.org/v1'), false);

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'prism-sec-trans-'));
  try {
    const fetchCalls = [];
    const spyFetch = async (url, init) => {
      fetchCalls.push({ url: String(url), headers: init?.headers || {} });
      return new Response(JSON.stringify({ data: [] }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    };

    const svc = new ThoughtTranslatorService({ configDir: tmpDir, fetchImpl: spyFetch });
    const thirdPartyKey = 'sk-thirdparty-secret-99887766';

    const fmRes = await svc.fetchModels({ baseUrl: 'http://[::a9fe:a9fe]/v1', apiKey: thirdPartyKey });
    assert.equal(fmRes.ok, false);
    assert.match(fmRes.error, /Blocked Base URL/);

    const tcRes = await svc.testConnection({
      baseUrl: 'http://[64:ff9b::169.254.169.254]/v1',
      apiKey: thirdPartyKey,
      model: 'deepseek-chat',
    });
    assert.equal(tcRes.ok, false);
    assert.match(tcRes.error, /Blocked Base URL/);

    svc.saveConfig({
      activeProfileId: 'evil-ssrf',
      profiles: [
        {
          id: 'evil-ssrf',
          name: 'Blocked Custom',
          baseUrl: 'http://169.254.169.254/latest/meta-data/',
          apiKey: thirdPartyKey,
          model: 'deepseek-chat',
        },
      ],
    });
    const trRes = await svc.translateThought({
      text: 'Verify third-party API key is never leaked to OpenAI when custom baseUrl is blocked.',
      mode: 'ai',
    });
    assert.equal(trRes.ok, false);
    assert.match(trRes.error, /Blocked Base URL/);

    const svcReloaded = new ThoughtTranslatorService({ configDir: tmpDir, fetchImpl: spyFetch });
    const trReloaded = await svcReloaded.translateThought({
      text: 'Reloaded profile with blocked baseUrl must stay fail-closed without hitting OpenAI.',
      mode: 'ai',
    });
    assert.equal(trReloaded.ok, false);
    assert.match(trReloaded.error, /Blocked Base URL/);
    assert.equal(fetchCalls.length, 0);

    svcReloaded.saveConfig({
      activeProfileId: 'default-openai',
      profiles: [{ id: 'default-openai', name: 'Default OpenAI', baseUrl: '', apiKey: thirdPartyKey, model: 'gpt-4o-mini' }],
    });
    const okModels = await svcReloaded.fetchModels({});
    assert.equal(okModels.ok, true);
    assert.equal(fetchCalls.length, 1);
    assert.equal(fetchCalls[0].url, 'https://api.openai.com/v1/models');
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('P2 live-host-adapter: rejects __proto__/constructor/prototype cascadeId and uses null-prototype lookup map', () => {
  const adapter = createLiveHostAdapter();
  adapter.syncFromRenderer({
    catalog: {
      health: 'ready',
      items: [
        { cascadeId: '__proto__', title: 'evil1', status: 'idle', updatedAt: 10 },
        { cascadeId: 'constructor', title: 'evil2', status: 'idle', updatedAt: 11 },
        { cascadeId: 'prototype', title: 'evil3', status: 'idle', updatedAt: 12 },
        { cascadeId: 'safe-chat-1', title: 'Safe Chat', status: 'idle', updatedAt: 20 },
      ],
    },
  });

  const snap = adapter.getCatalog();
  assert.deepEqual(snap.items.map((x) => x.cascadeId), ['safe-chat-1']);
  assert.equal(Object.prototype.hasOwnProperty.call(snap.lastKnownById, '__proto__'), false);
  assert.equal(Object.prototype.hasOwnProperty.call(snap.lastKnownById, 'constructor'), false);
  assert.equal(Object.prototype.hasOwnProperty.call(snap.lastKnownById, 'prototype'), false);
  assert.equal(snap.lastKnownById['safe-chat-1']?.title, 'Safe Chat');
});

test('P2 pulse-dashboard: store LRU preserves processing background sessions & bounds cachedSession; trajectory-reader drops stale 0-byte zombies; usage & background-statistics cap caches and surface diagnostics', async () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'prism-sec-pulse-'));
  try {
    const mkGuid = (n) => `10000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
    const bgId = mkGuid(0);
    const fakeClient = {
      reader: {},
      call: async () => ({}),
      discover: async () => ({ pid: 1, port: 1234, csrf: 'tok' }),
      trajectory: async (id) => ({
        trajectory: { cascadeId: id, steps: [], generatorMetadata: [] },
        numTotalSteps: 0,
        numTotalGeneratorMetadata: 0,
        status: 'IDLE',
      }),
    };
    const fakeHistory = {
      directory: path.join(tmpDir, 'history-v1'),
      load: async (_scope, id) => ({
        metrics: {
          conversationId: id,
          tokens: { totalTokens: 100, inputTokens: 80, outputTokens: 20, outputRequests: 1 },
          cache: { readTokens: 0, writeTokens: 0 },
          requests: 1,
        },
        savedAt: new Date().toISOString(),
      }),
      save: async () => ({ savedAt: new Date().toISOString() }),
    };
    const fakeBackground = {
      state: (id) => (id === bgId ? { state: 'processing', stage: 'steps' } : null),
      request: () => true,
      reset() {},
      dispose() {},
    };
    const store = new MetricsStore(fakeClient, {
      dataDir: tmpDir,
      history: fakeHistory,
      background: fakeBackground,
      transcripts: null,
    });
    store.sessions.set(bgId, { data: null, backgroundOnly: true, pending: null, updatedAt: 0 });
    for (let i = 1; i <= 40; i++) {
      await store.session(mkGuid(i), true);
    }
    assert.equal(store.sessions.has(bgId), true);
    assert.ok(store.sessions.size <= 32);

    store.sessions.clear();
    for (let i = 100; i < 145; i++) {
      await store.cachedSession(mkGuid(i));
    }
    assert.ok(store.sessions.size <= 32);

    let stillCurrent = true;
    const reader = new TrajectoryReader({
      now: () => Date.now(),
      discover: async () => ({ pid: 1, port: 4321, csrf: 'tok' }),
      call: async (method) => {
        if (method === 'GetAllCascadeTrajectories') {
          stillCurrent = false;
          return { trajectorySummaries: { [bgId]: { stepCount: 1, status: 'IDLE', lastModifiedTime: '2026-11-20T00:00:00Z' } } };
        }
        return { steps: [], generatorMetadata: [] };
      },
    });
    await assert.rejects(
      () => reader.read(bgId, { isCurrent: () => stillCurrent }),
      /Backend reconnected/
    );
    assert.equal(reader.entries.has(bgId), false);

    const ledger = new UsageLedger(path.join(tmpDir, 'usage-v1'));
    for (let i = 0; i < 80; i++) {
      ledger.cache = { key: `k:${i}`, revision: i, value: { totalTokens: i } };
      ledger.diskSummaryRetry = { key: `r:${i}`, at: Date.now() + 30000 };
    }
    assert.equal(ledger.caches.size, 64);
    assert.equal(ledger.diskSummaryRetries.size, 64);
    assert.ok(ledger._cache !== null);

    const desktopUsage = new DesktopUsage(store, ledger);
    desktopUsage.dispose();
    assert.equal(ledger._cache, null);
    assert.equal(ledger._diskSummaryRetry, null);
    assert.equal(ledger.caches.size, 0);
    assert.equal(ledger.diskSummaryRetries.size, 0);

    const fakeWorker = new EventEmitter();
    fakeWorker.terminate = async () => {};
    const bg = new BackgroundStatistics({
      directory: path.join(tmpDir, 'collection-jobs'),
      workerFactory: () => fakeWorker,
    });
    const reqOk = bg.request(LOCAL_SCOPE, bgId, { port: 4321, csrf: 'tok' });
    assert.equal(reqOk, true);
    for (let i = 0; i < 300 && fakeWorker.listenerCount('error') === 0; i += 1) {
      await new Promise((r) => setTimeout(r, 5));
    }
    assert.ok(fakeWorker.listenerCount('error') > 0, 'BackgroundStatistics must attach worker error listener');
    fakeWorker.emit('error', Object.assign(new Error('Worker terminated due to reaching memory limit'), { code: 'ERR_WORKER_OUT_OF_MEMORY' }));
    for (let i = 0; i < 100 && bg.state(bgId)?.state !== 'limited'; i += 1) {
      await new Promise((r) => setTimeout(r, 5));
    }
    const st = bg.state(bgId);
    assert.equal(st?.state, 'limited');
    assert.equal(st?.reason, 'worker-oom');
    assert.equal(bg.lastDiagnostic?.reason, 'worker-oom');
    assert.match(String(bg.lastDiagnostic?.detail || ''), /maxOldGenerationSizeMb=48/);
    bg.dispose();
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});
