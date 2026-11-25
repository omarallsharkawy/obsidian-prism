import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

import {
  SidebarStudioService,
  SIDEBAR_BINDING,
  SERVICE_SCHEMA_VERSION,
  ERROR_CODES,
  createStudioSandboxService,
  createSandboxHostAdapter,
  isPathInsideDir,
  validateSparkBoxName,
} from '../vendor/sidebar-studio/sidebar-service.mjs';

import {
  SCHEMA_VERSION,
  GREETING_POOLS,
  normalizeGreetingLang,
  formatGreeting,
  parseView,
  selectBackgroundBadge,
  sanitizeChatPolicy,
  cloneJsonSafe,
  applyProjectPermissionIsolation,
  restoreProjectPermissionBaseline,
} from '../vendor/sidebar-studio/state-machine.mjs';

import {
  createLiveHostAdapter,
  normalizeHostPathKey,
} from '../vendor/sidebar-studio/live-host-adapter.mjs';

const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, '..');
const SERVICE_FILE = path.resolve(__dirname, '../vendor/sidebar-studio/sidebar-service.mjs');
const STATE_MACHINE_FILE = path.resolve(__dirname, '../vendor/sidebar-studio/state-machine.mjs');
const LIVE_ADAPTER_FILE = path.resolve(__dirname, '../vendor/sidebar-studio/live-host-adapter.mjs');
const CLIENT_FILE = path.resolve(__dirname, '../vendor/sidebar-studio/sidebar-client.js');
const WORKBENCH_SERVER_FILE = path.resolve(ROOT_DIR, 'workbench/server.cjs');

function makeTempEnv(prefix = 'ag-prism-sbv2-') {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  const statePath = path.join(root, 'config', 'obsidian-prism-sidebar.json');
  const sparkRoot = path.join(root, 'spark-boxes');
  const knowledgeRoot = path.join(root, 'knowledge-space');
  return { root, statePath, sparkRoot, knowledgeRoot };
}

test('v2 SidebarStudioService initializes atomically (0600), enforces single-writer lock, and preserves corrupt/future files', async () => {
  const env = makeTempEnv('ag-prism-v2-init-');
  try {
    assert.equal(SIDEBAR_BINDING, '__agPrismSidebarCall');
    assert.equal(SERVICE_SCHEMA_VERSION, 2);
    assert.equal(SCHEMA_VERSION, 2);

    const svc = new SidebarStudioService({
      statePath: env.statePath,
      sparkRoot: env.sparkRoot,
      knowledgeRoot: env.knowledgeRoot,
    });
    const res = svc.getState();
    assert.equal(res.ok, true);
    assert.equal(res.snapshot.schemaVersion, 2);
    assert.equal(res.snapshot.activeMode, 'code');
    assert.deepEqual(res.snapshot.modeLastView, { code: '/', chat: '/' });
    assert.deepEqual(res.snapshot.chatDraft, { kind: 'knowledge', folderId: null, sparkProjectId: null });
    assert.deepEqual(res.snapshot.assignments, {});

    assert.equal(fs.existsSync(env.statePath), true);
    const siblings = fs.readdirSync(path.dirname(env.statePath));
    assert.equal(siblings.some((f) => f.endsWith('.tmp')), false);
    if (process.platform !== 'win32') {
      const mode = fs.statSync(env.statePath).mode & 0o777;
      assert.equal(mode, 0o600);
    }

    assert.throws(
      () => new SidebarStudioService({ statePath: env.statePath, sparkRoot: env.sparkRoot }),
      (err) => err && err.code === ERROR_CODES.BUSY
    );

    await svc.dispose();
    assert.equal(fs.existsSync(`${env.statePath}.lock`), false);

    fs.writeFileSync(`${env.statePath}.lock`, JSON.stringify({ pid: 999999999, token: 'stale-lock' }), 'utf8');
    const svcRecovered = new SidebarStudioService({
      statePath: env.statePath,
      sparkRoot: env.sparkRoot,
      knowledgeRoot: env.knowledgeRoot,
    });
    assert.equal(svcRecovered.getState().ok, true);
    await svcRecovered.dispose();

    const corruptBytes = '{corrupt-json-preserve-me';
    fs.writeFileSync(env.statePath, corruptBytes, 'utf8');
    const svcCorrupt = new SidebarStudioService({
      statePath: env.statePath,
      sparkRoot: env.sparkRoot,
      knowledgeRoot: env.knowledgeRoot,
    });
    const corruptState = svcCorrupt.getState();
    assert.equal(corruptState.ok, false);
    assert.equal(corruptState.error.code, ERROR_CODES.MIGRATION_FAILED);
    assert.equal((await svcCorrupt.updateCatalog({ health: 'ready', items: [] })).error?.code, ERROR_CODES.MIGRATION_FAILED);
    assert.equal(fs.readFileSync(env.statePath, 'utf8'), corruptBytes);
    await svcCorrupt.dispose();

    const futureBytes = JSON.stringify({ schemaVersion: 99, activeMode: 'code' }, null, 2);
    fs.writeFileSync(env.statePath, futureBytes, 'utf8');
    const svcFuture = new SidebarStudioService({
      statePath: env.statePath,
      sparkRoot: env.sparkRoot,
      knowledgeRoot: env.knowledgeRoot,
    });
    const futureState = svcFuture.getState();
    assert.equal(futureState.ok, false);
    assert.equal(futureState.error.code, ERROR_CODES.UNSUPPORTED_SCHEMA);
    assert.equal(fs.readFileSync(env.statePath, 'utf8'), futureBytes);
    await svcFuture.dispose();
  } finally {
    fs.rmSync(env.root, { recursive: true, force: true });
  }
});

test('v1 backup + lossless migration to v2 archives legacyV1, starts assignments empty, and rejects legacy v1 write actions', async () => {
  const env = makeTempEnv('ag-prism-v2-migrate-');
  try {
    fs.mkdirSync(path.dirname(env.statePath), { recursive: true });
    const v1Raw = {
      version: 1,
      activeSpace: 'spark',
      assignments: {
        'conv-old-know': 'knowledge',
        'conv-old-spark': 'spark',
        'conv-old-code': 'code',
      },
      pinnedIds: ['conv-old-know'],
      spaceThemes: {
        code: { palette: 'obsidian', accentTone: 'cobalt' },
        knowledge: { palette: 'claude', accentTone: 'iris', lightPreset: 'alabaster' },
        spark: { palette: 'warm', accentTone: 'amber' },
      },
      prefs: {
        hostModeSync: false,
        keepCustomizationsEntry: true,
        sparkRoot: env.sparkRoot,
        savedCodePermissionSnapshot: {
          permissionPreset: 'turbo',
          enableTerminalSandbox: false,
          nonWorkspaceFileAccessPolicy: 1,
          cascadeAutoExecutionPolicy: 3,
        },
      },
      classifiedAt: 1700000000000,
      updatedAt: 1700000001000,
    };
    const v1Text = JSON.stringify(v1Raw, null, 2) + '\n';
    fs.writeFileSync(env.statePath, v1Text, 'utf8');

    const svc = new SidebarStudioService({
      statePath: env.statePath,
      sparkRoot: env.sparkRoot,
      knowledgeRoot: env.knowledgeRoot,
    });

    const bakPath = `${env.statePath}.v1.bak`;
    assert.equal(fs.existsSync(bakPath), true);
    assert.equal(fs.readFileSync(bakPath, 'utf8'), v1Text);

    const snapRes = svc.getState();
    assert.equal(snapRes.ok, true);
    assert.equal(snapRes.snapshot.schemaVersion, 2);
    assert.equal(snapRes.snapshot.activeMode, 'code');
    assert.deepEqual(snapRes.snapshot.assignments, {});
    assert.equal(snapRes.snapshot.prefs.hostModeSync, false);
    assert.equal(snapRes.snapshot.prefs.modeThemes.code.accentTone, 'cobalt');
    assert.equal(snapRes.snapshot.prefs.modeThemes.chat.palette, 'claude');
    const updatedPrefs = await svc.handleRpcAction('set-prefs', {
      patch: { hostModeSync: true, modeThemes: { chat: { palette: 'obsidian' } } },
    });
    assert.equal(updatedPrefs.result.prefs.hostModeSync, true);
    assert.deepEqual(updatedPrefs.result.prefs.modeThemes, snapRes.snapshot.prefs.modeThemes);
    assert.equal(Object.hasOwn(updatedPrefs.result.prefs, 'sparkRoot'), false);
    assert.equal(Object.hasOwn(updatedPrefs.result.prefs, 'knowledgeRoot'), false);
    assert.equal(Object.prototype.hasOwnProperty.call(snapRes.snapshot, 'legacyV1'), false);
    assert.equal(
      Object.prototype.hasOwnProperty.call(snapRes.snapshot.prefs, 'savedCodePermissionSnapshot'),
      false
    );

    const persisted = JSON.parse(fs.readFileSync(env.statePath, 'utf8'));
    assert.equal(persisted.schemaVersion, 2);
    assert.deepEqual(persisted.legacyV1.assignments, v1Raw.assignments);
    assert.deepEqual(
      persisted.legacyV1.prefs.savedCodePermissionSnapshot,
      v1Raw.prefs.savedCodePermissionSnapshot
    );

    for (const legacyAct of ['set-active-space', 'set-assignment', 'bulk-assign', 'set-space-theme', 'classify-workspaces']) {
      const r = await svc.handleRpcAction(legacyAct, { space: 'spark' });
      assert.equal(r.ok, false);
      assert.equal(r.error.code, ERROR_CODES.UNSUPPORTED_SCHEMA);
    }
    const legacySnapWrite = await svc.handleRpcAction('set-prefs', {
      savedCodePermissionSnapshot: { permissionPreset: 'turbo' },
    });
    assert.equal(legacySnapWrite.ok, false);
    assert.equal(legacySnapWrite.error.code, ERROR_CODES.UNSUPPORTED_SCHEMA);

    await svc.dispose();
  } finally {
    fs.rmSync(env.root, { recursive: true, force: true });
  }
});

test('Phase 1 bipolar routing memory (/c/A -> Chat / -> /c/B -> Code /c/A), background badge priority & staleness, and atomic folder CRUD', async () => {
  const svc = createStudioSandboxService();
  try {
    const now = Date.now();
    await svc.applyFixture({
      catalog: {
        health: 'ready',
        items: [
          { cascadeId: 'code-A', title: 'Code Task A', status: 'running', statusStartedAt: now - 50000, updatedAt: now - 500 },
          { cascadeId: 'code-blocked', title: 'Approve Migration', status: 'blocked', statusStartedAt: now - 10000, updatedAt: now - 200 },
          { cascadeId: 'code-idle', title: 'Idle Code', status: 'idle', statusStartedAt: now - 80000, updatedAt: now - 1000 },
        ],
      },
    });

    const s0 = svc.getState().snapshot;
    const storeId = s0.storeId;

    const navA = await svc.handleRpc({
      version: 2,
      action: 'navigate',
      requestId: 'req-nav-a',
      storeId,
      baseRev: s0.rev,
      payload: { mode: 'code', view: '/c/code-A', navRev: s0.navRev },
    });
    assert.equal(navA.ok, true);
    assert.equal(navA.snapshot.currentView, '/c/code-A');
    assert.equal(navA.snapshot.modeLastView.code, '/c/code-A');

    const toChat = await svc.handleRpc({
      version: 2,
      action: 'switch-mode',
      requestId: 'req-to-chat',
      storeId,
      baseRev: navA.rev,
      payload: { to: 'chat', navRev: navA.snapshot.navRev },
    });
    assert.equal(toChat.ok, true);
    assert.equal(toChat.snapshot.activeMode, 'chat');
    assert.equal(toChat.snapshot.currentView, '/');
    assert.equal(toChat.snapshot.modeLastView.code, '/c/code-A');
    assert.equal(toChat.snapshot.backgroundBadge.targetMode, 'code');
    assert.equal(toChat.snapshot.backgroundBadge.status, 'blocked');
    assert.equal(toChat.snapshot.backgroundBadge.count, 2);
    assert.equal(toChat.snapshot.backgroundBadge.primary.cascadeId, 'code-blocked');

    const backCode = await svc.handleRpc({
      version: 2,
      action: 'switch-mode',
      requestId: 'req-back-code-1',
      storeId,
      baseRev: toChat.rev,
      payload: { to: 'code', navRev: toChat.snapshot.navRev },
    });
    assert.equal(backCode.ok, true);
    assert.equal(backCode.snapshot.currentView, '/c/code-A');

    const backChat = await svc.handleRpc({
      version: 2,
      action: 'switch-mode',
      requestId: 'req-back-chat-1',
      storeId,
      baseRev: backCode.rev,
      payload: { to: 'chat', navRev: backCode.snapshot.navRev },
    });
    assert.equal(backChat.ok, true);
    assert.equal(backChat.snapshot.currentView, '/');

    const fCreate = await svc.handleRpc({
      version: 2,
      action: 'create-knowledge-folder',
      requestId: 'req-kf-create',
      storeId,
      baseRev: backChat.rev,
      payload: { name: 'ملاحظات البنية' },
    });
    assert.equal(fCreate.ok, true);
    const folderId = fCreate.result.folder.id;

    const fRename = await svc.handleRpc({
      version: 2,
      action: 'rename-knowledge-folder',
      requestId: 'req-kf-rename',
      storeId,
      baseRev: fCreate.rev,
      payload: { folderId, name: 'البنية والتصميم' },
    });
    assert.equal(fRename.ok, true);
    assert.equal(fRename.result.folder.name, 'البنية والتصميم');

    const fCollapse = await svc.handleRpc({
      version: 2,
      action: 'set-knowledge-folder-collapsed',
      requestId: 'req-kf-collapse',
      storeId,
      baseRev: fRename.rev,
      payload: { folderId, collapsed: true },
    });
    assert.equal(fCollapse.ok, true);
    assert.equal(fCollapse.result.folder.collapsed, true);

    const setDraft = await svc.handleRpc({
      version: 2,
      action: 'set-chat-draft',
      requestId: 'req-draft-kf',
      storeId,
      baseRev: fCollapse.rev,
      payload: {
        draft: { kind: 'knowledge', folderId, sparkProjectId: null },
        navRev: fCollapse.snapshot.navRev,
        draftRev: fCollapse.snapshot.draftRev,
      },
    });
    assert.equal(setDraft.ok, true);
    assert.equal(setDraft.snapshot.chatDraft.folderId, folderId);

    const firstChat = await svc.handleRpc({
      version: 2,
      action: 'send-chat-first',
      requestId: 'req-first-b',
      storeId,
      baseRev: setDraft.rev,
      payload: {
        navRev: setDraft.snapshot.navRev,
        draftRev: setDraft.snapshot.draftRev,
        message: 'لخّص مقترح البنية اليوم',
      },
    });
    assert.equal(firstChat.ok, true);
    assert.equal(firstChat.result.status, 'succeeded');
    const chatBId = firstChat.result.cascadeId;
    assert.equal(firstChat.snapshot.currentView, `/c/${chatBId}`);
    assert.equal(firstChat.snapshot.assignments[chatBId].placement.folderId, folderId);

    const backCode2 = await svc.handleRpc({
      version: 2,
      action: 'switch-mode',
      requestId: 'req-back-code-2',
      storeId,
      baseRev: firstChat.rev,
      payload: { to: 'code', navRev: firstChat.snapshot.navRev },
    });
    assert.equal(backCode2.ok, true);
    assert.equal(backCode2.snapshot.currentView, '/c/code-A');
    assert.equal(backCode2.snapshot.modeLastView.chat, `/c/${chatBId}`);

    const toChat2 = await svc.handleRpc({
      version: 2,
      action: 'switch-mode',
      requestId: 'req-to-chat-2',
      storeId,
      baseRev: backCode2.rev,
      payload: { to: 'chat', navRev: backCode2.snapshot.navRev },
    });
    assert.equal(toChat2.snapshot.currentView, `/c/${chatBId}`);

    const navChatHome = await svc.handleRpc({
      version: 2,
      action: 'navigate',
      requestId: 'req-chat-home',
      storeId,
      baseRev: toChat2.rev,
      payload: { mode: 'chat', view: '/', navRev: toChat2.snapshot.navRev },
    });
    const setDraftAgain = await svc.handleRpc({
      version: 2,
      action: 'set-chat-draft',
      requestId: 'req-draft-kf-2',
      storeId,
      baseRev: navChatHome.rev,
      payload: {
        draft: { kind: 'knowledge', folderId, sparkProjectId: null },
        navRev: navChatHome.snapshot.navRev,
        draftRev: navChatHome.snapshot.draftRev,
      },
    });
    const prevDraftRev = setDraftAgain.snapshot.draftRev;
    const fDelete = await svc.handleRpc({
      version: 2,
      action: 'delete-knowledge-folder',
      requestId: 'req-kf-del',
      storeId,
      baseRev: setDraftAgain.rev,
      payload: { folderId },
    });
    assert.equal(fDelete.ok, true);
    assert.equal(fDelete.result.movedSessions, 1);
    assert.equal(fDelete.result.draftUpdated, true);
    assert.equal(fDelete.snapshot.draftRev, prevDraftRev + 1);
    assert.equal(fDelete.snapshot.chatDraft.folderId, null);
    assert.equal(fDelete.snapshot.assignments[chatBId].placement.folderId, null);

    const jump = await svc.handleRpc({
      version: 2,
      action: 'open-background-task',
      requestId: 'req-jump-badge',
      storeId,
      baseRev: fDelete.rev,
      payload: { targetMode: 'code', cascadeId: 'code-blocked', navRev: fDelete.snapshot.navRev },
    });
    assert.equal(jump.ok, true);
    assert.equal(jump.snapshot.activeMode, 'code');
    assert.equal(jump.snapshot.currentView, '/c/code-blocked');

    const staleJump = await svc.handleRpc({
      version: 2,
      action: 'open-background-task',
      requestId: 'req-jump-stale',
      storeId,
      baseRev: jump.rev,
      payload: { targetMode: 'chat', cascadeId: chatBId, navRev: jump.snapshot.navRev },
    });
    assert.equal(staleJump.ok, false);
    assert.equal(staleJump.error.code, ERROR_CODES.BADGE_STALE);

    for (const bad of ['', 'c/a', '/c/', '/c/a/b', '/c/%2e%2e', '/c/%2561', '/c/__proto__', '/c/a?x=1']) {
      assert.equal(parseView(bad).ok, false);
    }
    assert.equal(selectBackgroundBadge(jump.snapshot, { health: 'loading', items: [] }), null);
  } finally {
    await svc.dispose();
  }
});

test('Single-writer serialization, requestId idempotency, IDEMPOTENCY_CONFLICT, and version guards (STALE_STATE/STALE_NAVIGATION/STALE_DRAFT)', async () => {
  const svc = createStudioSandboxService();
  try {
    const s0 = svc.getState().snapshot;

    const r1 = await svc.handleRpc({
      version: 2,
      action: 'create-knowledge-folder',
      requestId: 'idem-folder-1',
      storeId: s0.storeId,
      baseRev: s0.rev,
      payload: { name: 'مجلد الاختبار' },
    });
    assert.equal(r1.ok, true);
    const createdFolderId = r1.result.folder.id;

    const rOther = await svc.handleRpc({
      version: 2,
      action: 'create-knowledge-folder',
      requestId: 'idem-folder-2',
      storeId: s0.storeId,
      baseRev: r1.rev,
      payload: { name: 'مجلد آخر' },
    });
    assert.equal(rOther.ok, true);

    const replay = await svc.handleRpc({
      version: 2,
      action: 'create-knowledge-folder',
      requestId: 'idem-folder-1',
      storeId: s0.storeId,
      baseRev: s0.rev,
      payload: { name: 'مجلد الاختبار' },
    });
    assert.equal(replay.ok, true);
    assert.equal(replay.result.folder.id, createdFolderId);
    assert.equal(replay.snapshot.knowledgeFolders.length, 2);

    const conflict = await svc.handleRpc({
      version: 2,
      action: 'create-knowledge-folder',
      requestId: 'idem-folder-1',
      storeId: s0.storeId,
      baseRev: rOther.rev,
      payload: { name: 'اسم معدّل' },
    });
    assert.equal(conflict.ok, false);
    assert.equal(conflict.error.code, ERROR_CODES.IDEMPOTENCY_CONFLICT);

    const badStore = await svc.handleRpc({
      version: 2,
      action: 'create-knowledge-folder',
      requestId: 'req-bad-store',
      storeId: 'store-wrong-id',
      baseRev: rOther.rev,
      payload: { name: 'X' },
    });
    assert.equal(badStore.ok, false);
    assert.equal(badStore.error.code, ERROR_CODES.STALE_STATE);

    const badRev = await svc.handleRpc({
      version: 2,
      action: 'create-knowledge-folder',
      requestId: 'req-bad-rev',
      storeId: s0.storeId,
      baseRev: 0,
      payload: { name: 'X' },
    });
    assert.equal(badRev.ok, false);
    assert.equal(badRev.error.code, ERROR_CODES.STALE_STATE);

    const badNav = await svc.handleRpc({
      version: 2,
      action: 'switch-mode',
      requestId: 'req-bad-nav',
      storeId: s0.storeId,
      baseRev: rOther.rev,
      payload: { to: 'chat', navRev: 999 },
    });
    assert.equal(badNav.ok, false);
    assert.equal(badNav.error.code, ERROR_CODES.STALE_NAVIGATION);

    const toChat = await svc.handleRpc({
      version: 2,
      action: 'switch-mode',
      requestId: 'req-switch-chat',
      storeId: s0.storeId,
      baseRev: rOther.rev,
      payload: { to: 'chat', navRev: rOther.snapshot.navRev },
    });
    const badDraft = await svc.handleRpc({
      version: 2,
      action: 'set-chat-draft',
      requestId: 'req-bad-draft',
      storeId: s0.storeId,
      baseRev: toChat.rev,
      payload: { draft: { kind: 'spark', folderId: null, sparkProjectId: null }, navRev: toChat.snapshot.navRev, draftRev: 999 },
    });
    assert.equal(badDraft.ok, false);
    assert.equal(badDraft.error.code, ERROR_CODES.STALE_DRAFT);

    const revBeforeBatch = toChat.rev;
    const batchResults = await Promise.all(
      Array.from({ length: 10 }, (_, idx) =>
        svc.handleRpcAction('create-knowledge-folder', {
          requestId: `batch-kf-${idx}`,
          name: `مجلد متزامن-${idx}`,
        })
      )
    );
    assert.equal(batchResults.every((r) => r.ok), true);
    const finalSnap = svc.getState().snapshot;
    assert.equal(finalSnap.rev, revBeforeBatch + 10);
    assert.equal(finalSnap.knowledgeFolders.length, 12);

    const protoPayload = JSON.parse('{"name":"ok","__proto__":{"polluted":true}}');
    const protoRes = await svc.handleRpcAction('create-knowledge-folder', protoPayload);
    assert.equal(protoRes.ok, false);
    assert.equal(protoRes.error.code, ERROR_CODES.INVALID_ARGUMENT);
    assert.equal(Object.prototype.hasOwnProperty.call(Object.prototype, 'polluted'), false);
  } finally {
    await svc.dispose();
  }
});

test('Phase 2 Spark lifecycle, create-spark-box traversal/symlink defense, ZERO global Code permission writes, sandbox degradation & unlink restore', async () => {
  const svc = createStudioSandboxService();
  try {
    const okBox1 = await svc.handleRpcAction('create-spark-box', { name: 'مسودة 01_alpha-v2' });
    assert.equal(okBox1.ok, true);
    assert.equal(okBox1.result.created, true);
    assert.equal(typeof okBox1.result.selectionToken, 'string');
    assert.equal(Object.prototype.hasOwnProperty.call(okBox1.result, 'path'), false);

    const realBoxPath = path.join(svc.defaultSparkRoot, 'مسودة 01_alpha-v2');
    assert.equal(fs.existsSync(realBoxPath), true);
    assert.equal(isPathInsideDir(fs.realpathSync(svc.defaultSparkRoot), fs.realpathSync(realBoxPath), false), true);

    const okBox2 = await svc.handleRpcAction('create-spark-box', { name: 'مسودة 01_alpha-v2' });
    assert.equal(okBox2.ok, true);
    assert.equal(okBox2.result.created, false);

    for (const evil of ['', '   ', '.', '..', '../escape', '..\\escape', 'a/b', 'a\\b', 'C:evil', '.hidden', 'trailing.', 'foo..bar', 'CON', 'nul.txt', 'bad\0name', 'bad<name>', 'a'.repeat(81)]) {
      assert.equal(validateSparkBoxName(evil).ok, false);
      const r = await svc.handleRpcAction('create-spark-box', { name: evil });
      assert.equal(r.ok, false);
    }

    const outsideDir = path.join(svc.sandboxRoot, 'outside-secret');
    fs.mkdirSync(outsideDir, { recursive: true });
    const escapeLink = path.join(svc.defaultSparkRoot, 'escape-link');
    let linkMade = false;
    try {
      fs.symlinkSync(outsideDir, escapeLink, process.platform === 'win32' ? 'junction' : 'dir');
      linkMade = true;
    } catch {
      linkMade = false;
    }
    if (linkMade) {
      const symRes = await svc.handleRpcAction('create-spark-box', { name: 'escape-link' });
      assert.equal(symRes.ok, false);
    }

    const pickCancel = await svc.handleRpcAction('pick-project-directory', { cancel: true });
    assert.equal(pickCancel.ok, true);
    assert.equal(pickCancel.result.cancelled, true);

    const s0 = svc.getState().snapshot;
    const toChat = await svc.handleRpc({
      version: 2,
      action: 'switch-mode',
      requestId: 'req-sp-chat',
      storeId: s0.storeId,
      baseRev: s0.rev,
      payload: { to: 'chat', navRev: s0.navRev },
    });

    const selected = await svc.handleRpc({
      version: 2,
      action: 'select-spark-project',
      requestId: 'req-sp-select',
      storeId: s0.storeId,
      baseRev: toChat.rev,
      payload: {
        selectionToken: okBox2.result.selectionToken,
        navRev: toChat.snapshot.navRev,
        draftRev: toChat.snapshot.draftRev,
      },
    });
    assert.equal(selected.ok, true);
    assert.equal(selected.result.created, true);
    const sparkProjectId = selected.result.project.id;
    assert.equal(selected.snapshot.chatDraft.kind, 'spark');
    assert.equal(selected.snapshot.chatDraft.sparkProjectId, sparkProjectId);

    const collapsed = await svc.handleRpc({
      version: 2,
      action: 'set-spark-project-collapsed',
      requestId: 'req-sp-collapse',
      storeId: s0.storeId,
      baseRev: selected.rev,
      payload: { sparkProjectId, collapsed: true },
    });
    assert.equal(collapsed.ok, true);
    assert.equal(collapsed.result.project.collapsed, true);

    await svc.applyFixture({ faults: { scopeIsolated: false } });
    const conflictSend = await svc.handleRpc({
      version: 2,
      action: 'send-chat-first',
      requestId: 'req-sp-scope-conflict',
      storeId: s0.storeId,
      baseRev: collapsed.rev,
      payload: {
        navRev: collapsed.snapshot.navRev,
        draftRev: collapsed.snapshot.draftRev,
        message: 'يجب أن تبقى الأذونات كما هي',
      },
    });
    assert.equal(conflictSend.ok, false);
    assert.equal(conflictSend.error.code, ERROR_CODES.PROJECT_SCOPE_CONFLICT);
    assert.equal(svc.getPermissionAudit().projectPermissionWrites, 0);
    assert.equal(svc.getPermissionAudit().globalPermissionWrites, 0);

    await svc.applyFixture({
      faults: { scopeIsolated: true },
      capabilities: { sandboxAvailable: false },
    });
    const sendSpark = await svc.handleRpc({
      version: 2,
      action: 'send-chat-first',
      requestId: 'req-sp-send-degraded',
      storeId: s0.storeId,
      baseRev: svc.getState().rev,
      payload: {
        navRev: svc.getState().snapshot.navRev,
        draftRev: svc.getState().snapshot.draftRev,
        message: 'ساعدني في تخطيط نموذج أولي',
      },
    });
    assert.equal(sendSpark.ok, true);
    assert.equal(sendSpark.result.status, 'succeeded');
    assert.equal(sendSpark.result.degraded, true);
    const sparkChatId = sendSpark.result.cascadeId;

    const audit = svc.getPermissionAudit();
    assert.equal(audit.globalPermissionWrites, 0);
    assert.equal(audit.globalCodeSettings.autoExecutionPolicy, 'turbo');
    assert.ok(audit.projectPermissionWrites >= 2);
    assert.equal(audit.permissionAuditLog.every((e) => e.scope === 'project-only' && e.globalTouched === false), true);
    const codeRunning = svc.hostAdapter.getCatalog().items.find((it) => it.cascadeId === 'code-turbo-build');
    assert.equal(codeRunning.status, 'running');

    const moveCodeToChat = await svc.handleRpc({
      version: 2,
      action: 'move-session-to-chat',
      requestId: 'req-cross-forbid-1',
      storeId: s0.storeId,
      baseRev: sendSpark.rev,
      payload: { cascadeId: 'code-ci-review', placement: { kind: 'knowledge', folderId: null } },
    });
    assert.equal(moveCodeToChat.ok, false);
    assert.equal(moveCodeToChat.error.code, ERROR_CODES.INVALID_ARGUMENT);
    assert.equal(Object.prototype.hasOwnProperty.call(svc.getState().snapshot.assignments, 'code-ci-review'), false);

    const unlinkRes = await svc.handleRpc({
      version: 2,
      action: 'unlink-spark-project',
      requestId: 'req-sp-unlink',
      storeId: s0.storeId,
      baseRev: sendSpark.rev,
      payload: { sparkProjectId },
    });
    assert.equal(unlinkRes.ok, true);
    assert.equal(unlinkRes.result.status, 'succeeded');
    assert.equal(unlinkRes.result.permissionRestoreStatus, 'restored');
    assert.equal(fs.existsSync(realBoxPath), true);
    assert.equal(unlinkRes.snapshot.assignments[sparkChatId].placement.kind, 'knowledge');
    assert.equal(unlinkRes.snapshot.assignments[sparkChatId].placement.folderId, null);
    assert.equal(unlinkRes.snapshot.assignments[sparkChatId].continuation, 'needs-rebind');

    const resumeRes = await svc.handleRpc({
      version: 2,
      action: 'resume-chat-session',
      requestId: 'req-sp-resume',
      storeId: s0.storeId,
      baseRev: unlinkRes.rev,
      payload: { cascadeId: sparkChatId },
    });
    assert.equal(resumeRes.ok, true);
    assert.equal(resumeRes.snapshot.assignments[sparkChatId].continuation, 'ready');
    assert.equal(svc.hostAdapter.getCatalog().items.find((row) => row.cascadeId === sparkChatId).workspace, 'scope-knowledge-default');
    assert.equal(svc.getPermissionAudit().globalPermissionWrites, 0);
  } finally {
    await svc.dispose();
  }
});

test('WSL challenge explicit confirmation, operation sanitization, and crash-recovery (needs-input & needs-reconciliation & message-confirmed)', async () => {
  const env = makeTempEnv('ag-prism-v2-wsl-crash-');
  const hostAdapter = createSandboxHostAdapter(env.root);
  try {
    hostAdapter.setFaults({ requireWslConfirmation: true });
    const svc = new SidebarStudioService({
      sandboxMode: true,
      sandboxRoot: env.root,
      statePath: env.statePath,
      sparkRoot: env.sparkRoot,
      knowledgeRoot: env.knowledgeRoot,
      hostAdapter,
    });

    const s0 = svc.getState().snapshot;
    const toChat = await svc.handleRpc({
      version: 2,
      action: 'switch-mode',
      requestId: 'req-wsl-chat',
      storeId: s0.storeId,
      baseRev: s0.rev,
      payload: { to: 'chat', navRev: s0.navRev },
    });

    const sendPaused = await svc.handleRpc({
      version: 2,
      action: 'send-chat-first',
      requestId: 'req-wsl-send',
      storeId: s0.storeId,
      baseRev: toChat.rev,
      payload: {
        navRev: toChat.snapshot.navRev,
        draftRev: toChat.snapshot.draftRev,
        message: 'رسالة أولى تتطلب تأكيد WSL',
      },
    });
    assert.equal(sendPaused.ok, true);
    assert.equal(sendPaused.result.status, 'awaiting-confirmation');
    const opId = sendPaused.result.operationId;

    const trusted = svc.getTrustedWslChallenge(opId);
    assert.ok(trusted && trusted.challenge);

    const opView = await svc.handleRpcAction('get-operation', { operationId: opId });
    assert.equal(opView.ok, true);
    assert.equal(opView.result.status, 'awaiting-confirmation');
    assert.equal(JSON.stringify(opView).includes(trusted.challenge), false);
    assert.equal(JSON.stringify(svc.getState()).includes(trusted.challenge), false);

    const badConfirm = await svc.handleRpc({
      version: 2,
      action: 'confirm-wsl',
      requestId: 'req-wsl-bad',
      storeId: s0.storeId,
      baseRev: sendPaused.rev,
      payload: { operationId: opId, challenge: 'forged-challenge' },
    });
    assert.equal(badConfirm.ok, false);
    assert.equal(badConfirm.error.code, ERROR_CODES.INVALID_ARGUMENT);

    const okConfirm = await svc.handleRpc({
      version: 2,
      action: 'confirm-wsl',
      requestId: 'req-wsl-ok',
      storeId: s0.storeId,
      baseRev: sendPaused.rev,
      payload: { operationId: opId, challenge: trusted.challenge },
    });
    assert.equal(okConfirm.ok, true);
    assert.equal(okConfirm.result.status, 'succeeded');
    assert.ok(okConfirm.result.cascadeId);

    const replayConfirm = await svc.handleRpc({
      version: 2,
      action: 'confirm-wsl',
      requestId: 'req-wsl-replay',
      storeId: s0.storeId,
      baseRev: okConfirm.rev,
      payload: { operationId: opId, challenge: trusted.challenge },
    });
    assert.equal(replayConfirm.ok, false);

    hostAdapter.setFaults({ requireWslConfirmation: false, crashAfter: 'session-created' });
    const navHome = await svc.handleRpc({
      version: 2,
      action: 'navigate',
      requestId: 'req-nav-home-crash',
      storeId: s0.storeId,
      baseRev: okConfirm.rev,
      payload: { mode: 'chat', view: '/', navRev: okConfirm.snapshot.navRev },
    });
    const origMsg = 'نص الرسالة نفسه بعد الاسترداد من التعطل';
    const crashedSend = await svc.handleRpc({
      version: 2,
      action: 'send-chat-first',
      requestId: 'req-crash-1',
      storeId: s0.storeId,
      baseRev: navHome.rev,
      payload: { navRev: navHome.snapshot.navRev, draftRev: navHome.snapshot.draftRev, message: origMsg },
    });
    assert.equal(crashedSend.ok, true);
    assert.equal(crashedSend.result.status, 'pending');
    const crashOpId = crashedSend.result.operationId;
    const reservedCid = crashedSend.result.cascadeId;
    await svc.dispose();

    hostAdapter.setFaults({ crashAfter: null });
    const svcRebooted = new SidebarStudioService({
      sandboxMode: true,
      sandboxRoot: env.root,
      statePath: env.statePath,
      sparkRoot: env.sparkRoot,
      knowledgeRoot: env.knowledgeRoot,
      hostAdapter,
    });
    const opAfterBoot = await svcRebooted.handleRpcAction('get-operation', { operationId: crashOpId });
    assert.equal(opAfterBoot.ok, true);
    assert.equal(opAfterBoot.result.status, 'needs-input');

    const wrongMsg = await svcRebooted.handleRpcAction('send-chat-first', {
      resumeOperationId: crashOpId,
      message: 'رسالة بديلة معدّلة',
    });
    assert.equal(wrongMsg.ok, false);
    assert.equal(wrongMsg.error.code, ERROR_CODES.IDEMPOTENCY_CONFLICT);

    const resumed = await svcRebooted.handleRpcAction('send-chat-first', {
      requestId: 'req-crash-resume',
      resumeOperationId: crashOpId,
      message: origMsg,
    });
    assert.equal(resumed.ok, true);
    assert.equal(resumed.result.status, 'succeeded');
    assert.equal(resumed.result.cascadeId, reservedCid);

    hostAdapter.setFaults({ crashAfter: 'delivering-message' });
    const navHome2 = await svcRebooted.handleRpcAction('navigate', {
      mode: 'chat',
      view: '/',
      navRev: resumed.snapshot.navRev,
    });
    const ambSend = await svcRebooted.handleRpcAction('send-chat-first', {
      navRev: navHome2.snapshot.navRev,
      draftRev: navHome2.snapshot.draftRev,
      message: 'اختبار التعطل أثناء الإرسال',
    });
    const ambOpId = ambSend.result.operationId;
    await svcRebooted.dispose();

    hostAdapter.setFaults({ crashAfter: null });
    const svcRebooted2 = new SidebarStudioService({
      sandboxMode: true,
      sandboxRoot: env.root,
      statePath: env.statePath,
      sparkRoot: env.sparkRoot,
      knowledgeRoot: env.knowledgeRoot,
      hostAdapter,
    });
    const ambOp = await svcRebooted2.handleRpcAction('get-operation', { operationId: ambOpId });
    assert.equal(ambOp.result.status, 'needs-reconciliation');
    await svcRebooted2.dispose();

    const psp = hostAdapter.getProjectSettingsProvider();
    const applyRes = await applyProjectPermissionIsolation({
      kind: 'spark',
      scopeRef: 'scope-ext-test',
      projectSettingsProvider: psp,
      scopeIsolated: true,
      sandboxAvailable: true,
    });
    assert.equal(applyRes.ok, true);
    hostAdapter.mutateProjectSettingExternally('scope-ext-test', 'autoExecutionPolicy', 'turbo');
    const restoreBlocked = await restoreProjectPermissionBaseline({
      scopeRef: 'scope-ext-test',
      projectSettingsProvider: psp,
      baseline: applyRes.baseline,
      applied: applyRes.applied,
      scopeControlled: true,
    });
    assert.equal(restoreBlocked.ok, false);
    assert.equal(restoreBlocked.status, 'needs-reconciliation');
    assert.equal(restoreBlocked.error.code, ERROR_CODES.NEEDS_RECONCILIATION);
    assert.equal(hostAdapter.getAuditReport().globalPermissionWrites, 0);
  } finally {
    fs.rmSync(env.root, { recursive: true, force: true });
  }
});

test('sandboxMode strictly isolates from real ~/.gemini/config and env overrides, disables native OS commands, and supports resetSandbox storeId rotation', async () => {
  const decoyDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ag-prism-decoy-cfg-'));
  const prevEnv = process.env.AG_PRISM_GEMINI_CONFIG_DIR;
  process.env.AG_PRISM_GEMINI_CONFIG_DIR = decoyDir;
  let execCalls = 0;
  const svc = createStudioSandboxService({
    execFile: async () => {
      execCalls += 1;
      return { stdout: '', stderr: '' };
    },
  });
  try {
    assert.equal(fs.readdirSync(decoyDir).length, 0);
    assert.equal(isPathInsideDir(os.tmpdir(), svc.statePath, false), true);

    const pf = await svc.handleRpcAction('pick-folder', {});
    assert.equal(pf.ok, false);
    assert.equal(pf.error.code, ERROR_CODES.CAPABILITY_UNAVAILABLE);
    const rf = await svc.handleRpcAction('reveal-folder', { path: svc.sandboxRoot });
    assert.equal(rf.ok, false);
    assert.equal(rf.error.code, ERROR_CODES.CAPABILITY_UNAVAILABLE);
    assert.equal(execCalls, 0);

    const oldStoreId = svc.getState().snapshot.storeId;
    const resetRes = await svc.resetSandbox();
    assert.equal(resetRes.ok, true);
    assert.notEqual(resetRes.snapshot.storeId, oldStoreId);

    const staleAfterReset = await svc.handleRpc({
      version: 2,
      action: 'create-knowledge-folder',
      requestId: 'req-after-reset',
      storeId: oldStoreId,
      baseRev: 0,
      payload: { name: 'Stale' },
    });
    assert.equal(staleAfterReset.ok, false);
    assert.equal(staleAfterReset.error.code, ERROR_CODES.STALE_STATE);
  } finally {
    const ownedRoot = svc.sandboxRoot;
    await svc.dispose();
    assert.equal(fs.existsSync(ownedRoot), false);
    if (prevEnv === undefined) delete process.env.AG_PRISM_GEMINI_CONFIG_DIR;
    else process.env.AG_PRISM_GEMINI_CONFIG_DIR = prevEnv;
    fs.rmSync(decoyDir, { recursive: true, force: true });
  }
});

test('non-sandbox pick-folder and reveal-folder invoke execFile safely with strict argument arrays and directory verification', async () => {
  const env = makeTempEnv('ag-prism-v2-cmd-');
  try {
    const validDir = path.join(env.root, 'مساحة عمل عربية');
    fs.mkdirSync(validDir, { recursive: true });
    const sampleFile = path.join(validDir, 'a.txt');
    fs.writeFileSync(sampleFile, 'hi', 'utf8');

    const calls = [];
    const mockExecFile = async (file, args, options) => {
      calls.push({ file, args, options });
      if (file === 'powershell.exe') {
        return { stdout: Buffer.from(validDir, 'utf8').toString('base64'), stderr: '' };
      }
      if (file === '/usr/bin/osascript' || file === 'zenity' || file === 'kdialog') {
        return { stdout: `${validDir}\n`, stderr: '' };
      }
      return { stdout: '', stderr: '' };
    };

    const svc = new SidebarStudioService({
      statePath: env.statePath,
      sparkRoot: env.sparkRoot,
      knowledgeRoot: env.knowledgeRoot,
      execFile: mockExecFile,
    });

    const picked = await svc.handleRpcAction('pick-folder', { title: 'اختر مجلد الأفكار', initialDir: validDir });
    assert.equal(picked.ok, true);
    assert.equal(picked.canceled, false);
    assert.equal(picked.path, validDir);
    assert.equal(calls.length, 1);

    const revOk = await svc.handleRpcAction('reveal-folder', { path: validDir });
    assert.equal(revOk.ok, true);
    assert.equal(revOk.path, fs.realpathSync(validDir));
    assert.equal(calls.length, 2);

    const revMissing = await svc.handleRpcAction('reveal-folder', { path: path.join(env.root, 'no-such-dir') });
    assert.equal(revMissing.ok, false);
    const revFile = await svc.handleRpcAction('reveal-folder', { path: sampleFile });
    assert.equal(revFile.ok, false);
    assert.equal(calls.length, 2);

    await svc.dispose();
  } finally {
    fs.rmSync(env.root, { recursive: true, force: true });
  }
});

test('Workbench /api/studio/* isolation contract (end-to-end HTTP security, RPC, fixture, reset & 0 global writes)', async () => {
  const { createRequire } = await import('node:module');
  const req = createRequire(import.meta.url);
  const { createWorkbenchServer } = req(WORKBENCH_SERVER_FILE);
  const decoyDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ag-prism-wb-decoy-'));
  const prevEnv = process.env.AG_PRISM_GEMINI_CONFIG_DIR;
  process.env.AG_PRISM_GEMINI_CONFIG_DIR = decoyDir;

  const wb = createWorkbenchServer({ watch: false });
  const server = wb.server || wb;
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();
  const baseUrl = `http://127.0.0.1:${port}`;
  let sandboxRootPath = null;

  try {
    const pageRes = await fetch(`${baseUrl}/studio`);
    assert.equal(pageRes.status, 200);
    assert.equal(pageRes.headers.get('cache-control')?.includes('no-store'), true);

    const esmRes = await fetch(`${baseUrl}/shared/sidebar-state-machine.mjs`);
    assert.equal(esmRes.status, 200);
    assert.equal(esmRes.headers.get('content-type')?.includes('javascript'), true);

    const stRes = await fetch(`${baseUrl}/api/studio/state`);
    assert.equal(stRes.status, 200);
    const token = stRes.headers.get('x-studio-token') || (typeof server.getStudioToken === 'function' ? server.getStudioToken() : '');
    assert.ok(token && token.length >= 16);
    const stJson = await stRes.json();
    const snap0 = stJson.snapshot || stJson.result;
    assert.equal(snap0.schemaVersion, 2);
    assert.equal(snap0.activeMode, 'code');
    assert.equal(stJson.audit.globalPermissionWrites, 0);
    sandboxRootPath = typeof server.getStudioSandboxRoot === 'function' ? server.getStudioSandboxRoot() : null;
    assert.ok(sandboxRootPath && fs.existsSync(sandboxRootPath));

    const noTokenRes = await fetch(`${baseUrl}/api/studio/rpc`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: baseUrl },
      body: JSON.stringify({ version: 2, action: 'switch-mode', requestId: 'wb-no-tok', payload: { to: 'chat' } }),
    });
    assert.equal(noTokenRes.status, 403);

    const evilOriginRes = await fetch(`${baseUrl}/api/studio/rpc`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Origin: 'http://198.51.100.7:8080',
        'X-Studio-Token': token,
      },
      body: JSON.stringify({ version: 2, action: 'switch-mode', requestId: 'wb-evil-origin', payload: { to: 'chat' } }),
    });
    assert.equal(evilOriginRes.status, 403);

    const badMimeRes = await fetch(`${baseUrl}/api/studio/rpc`, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain', Origin: baseUrl, 'X-Studio-Token': token },
      body: '{}',
    });
    assert.equal(badMimeRes.status, 400);

    const postStudio = (endpoint, bodyObj) =>
      fetch(`${baseUrl}${endpoint}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Origin: baseUrl,
          'X-Studio-Token': token,
        },
        body: JSON.stringify(bodyObj),
      });

    const swRes = await postStudio('/api/studio/rpc', {
      version: 2,
      action: 'switch-mode',
      requestId: 'wb-sw-chat',
      storeId: snap0.storeId,
      baseRev: snap0.rev,
      payload: { to: 'chat', navRev: snap0.navRev },
    });
    assert.equal(swRes.status, 200);
    const swJson = await swRes.json();
    assert.equal(swJson.snapshot.activeMode, 'chat');

    const boxRes = await postStudio('/api/studio/rpc', {
      version: 2,
      action: 'create-spark-box',
      requestId: 'wb-box-1',
      payload: { name: 'PreviewSandboxBox' },
    });
    assert.equal(boxRes.status, 200);
    const boxJson = await boxRes.json();
    assert.ok(boxJson.result.selectionToken);

    const selRes = await postStudio('/api/studio/rpc', {
      version: 2,
      action: 'select-spark-project',
      requestId: 'wb-sel-1',
      storeId: snap0.storeId,
      baseRev: swJson.rev,
      payload: {
        selectionToken: boxJson.result.selectionToken,
        navRev: swJson.snapshot.navRev,
        draftRev: swJson.snapshot.draftRev,
      },
    });
    assert.equal(selRes.status, 200);
    const selJson = await selRes.json();

    const sendRes = await postStudio('/api/studio/rpc', {
      version: 2,
      action: 'send-chat-first',
      requestId: 'wb-send-1',
      storeId: snap0.storeId,
      baseRev: selJson.rev,
      payload: {
        navRev: selJson.snapshot.navRev,
        draftRev: selJson.snapshot.draftRev,
        message: 'اختبار إرسال أول رسالة في Workbench Studio المعزول',
      },
    });
    assert.equal(sendRes.status, 200);
    const sendJson = await sendRes.json();
    assert.equal(sendJson.result.status, 'succeeded');
    assert.equal(sendJson.audit.globalPermissionWrites, 0);
    assert.ok(sendJson.audit.projectPermissionWrites >= 2);

    const fixRes = await postStudio('/api/studio/fixture', { preset: 'dual-active-background' });
    assert.equal(fixRes.status, 200);
    const fixJson = await fixRes.json();
    assert.equal(fixJson.snapshot.backgroundBadge.targetMode, 'code');
    assert.equal(fixJson.snapshot.backgroundBadge.status, 'blocked');

    const rstRes = await postStudio('/api/studio/reset', {});
    assert.equal(rstRes.status, 200);
    const rstJson = await rstRes.json();
    assert.notEqual(rstJson.snapshot.storeId, snap0.storeId);

    const staleRes = await postStudio('/api/studio/rpc', {
      version: 2,
      action: 'switch-mode',
      requestId: 'wb-stale-after-reset',
      storeId: snap0.storeId,
      baseRev: 0,
      payload: { to: 'chat', navRev: 0 },
    });
    assert.equal(staleRes.status, 409);
    const staleJson = await staleRes.json();
    assert.equal(staleJson.error.code, ERROR_CODES.STALE_STATE);

    assert.equal(fs.readdirSync(decoyDir).length, 0);
  } finally {
    await new Promise((resolve) => server.close(resolve));
    if (sandboxRootPath) {
      assert.equal(fs.existsSync(sandboxRootPath), false);
    }
    if (prevEnv === undefined) delete process.env.AG_PRISM_GEMINI_CONFIG_DIR;
    else process.env.AG_PRISM_GEMINI_CONFIG_DIR = prevEnv;
    fs.rmSync(decoyDir, { recursive: true, force: true });
  }
});

test('Shared-with-code Spark project non-destructive protection (0 global & 0 project writes), audit logging, and safe unlink', async () => {
  const svc = createStudioSandboxService();
  try {
    const s0 = svc.getState().snapshot;
    const storeId = s0.storeId;

    const toChat = await svc.handleRpc({
      version: 2,
      action: 'switch-mode',
      requestId: 'req-sh-chat',
      storeId,
      baseRev: s0.rev,
      payload: { to: 'chat', navRev: s0.navRev },
    });
    assert.equal(toChat.ok, true);

    const pickedShared = await svc.handleRpcAction('pick-project-directory', { preset: 'shared-code-repo' });
    assert.equal(pickedShared.ok, true);
    assert.equal(pickedShared.result.cancelled, false);
    assert.equal(pickedShared.result.displayName, 'obsidian-prism');
    assert.equal(pickedShared.result.sharedWithCode, true);
    assert.ok(pickedShared.result.selectionToken);

    const selected = await svc.handleRpc({
      version: 2,
      action: 'select-spark-project',
      requestId: 'req-sh-select',
      storeId,
      baseRev: toChat.rev,
      payload: {
        selectionToken: pickedShared.result.selectionToken,
        navRev: toChat.snapshot.navRev,
        draftRev: toChat.snapshot.draftRev,
      },
    });
    assert.equal(selected.ok, true);
    assert.equal(selected.result.sharedWithCode, true);
    assert.equal(selected.result.nonDestructive, true);
    const sharedProjId = selected.result.project.id;
    const projSnap = selected.snapshot.sparkProjects.find((p) => p.id === sharedProjId);
    assert.equal(projSnap.sharedWithCode, true);
    assert.equal(projSnap.nonDestructive, true);
    assert.equal(projSnap.permissionStatus, 'non-destructive-shared');

    const sent = await svc.handleRpc({
      version: 2,
      action: 'send-chat-first',
      requestId: 'req-sh-send',
      storeId,
      baseRev: selected.rev,
      payload: {
        navRev: selected.snapshot.navRev,
        draftRev: selected.snapshot.draftRev,
        message: 'ناقش تصميم البنية في المستودع المشترك',
      },
    });
    assert.equal(sent.ok, true);
    assert.equal(sent.result.status, 'succeeded');
    assert.equal(sent.result.sharedWithCode, true);
    assert.equal(sent.result.nonDestructive, true);
    assert.equal(sent.result.permissionStatus, 'non-destructive-shared');
    const sharedChatId = sent.result.cascadeId;

    const audit = svc.getPermissionAudit();
    assert.equal(audit.globalPermissionWrites, 0);
    assert.equal(audit.projectPermissionWrites, 0);
    assert.ok(audit.nonDestructiveGuardCount >= 2);
    assert.equal(
      audit.permissionAuditLog.some((e) => e.scope === 'shared-non-destructive' && e.globalTouched === false && e.nonDestructive === true),
      true
    );
    assert.equal(audit.globalCodeSettings.autoExecutionPolicy, 'turbo');
    const codeRunning = svc.hostAdapter.getCatalog().items.find((it) => it.cascadeId === 'code-turbo-build');
    assert.equal(codeRunning.status, 'running');

    const unlinked = await svc.handleRpc({
      version: 2,
      action: 'unlink-spark-project',
      requestId: 'req-sh-unlink',
      storeId,
      baseRev: sent.rev,
      payload: { sparkProjectId: sharedProjId },
    });
    assert.equal(unlinked.ok, true);
    assert.equal(unlinked.result.permissionRestoreStatus, 'skipped-non-destructive');
    assert.equal(unlinked.snapshot.assignments[sharedChatId].placement.kind, 'knowledge');
    assert.equal(unlinked.snapshot.assignments[sharedChatId].continuation, 'needs-rebind');
    assert.equal(svc.getPermissionAudit().globalPermissionWrites, 0);
    assert.equal(svc.getPermissionAudit().projectPermissionWrites, 0);

    const envMisreport = makeTempEnv('ag-prism-p1-shared-');
    try {
      const misreportAdapter = createSandboxHostAdapter(envMisreport.root);
      misreportAdapter.isScopeIsolated = () => true;
      const svcMisreport = new SidebarStudioService({
        sandboxMode: true,
        sandboxRoot: envMisreport.root,
        statePath: envMisreport.statePath,
        sparkRoot: envMisreport.sparkRoot,
        knowledgeRoot: envMisreport.knowledgeRoot,
        hostAdapter: misreportAdapter,
      });
      try {
        const ms0 = svcMisreport.getState().snapshot;
        const mChat = await svcMisreport.handleRpc({
          version: 2,
          action: 'switch-mode',
          requestId: 'req-p1-chat',
          storeId: ms0.storeId,
          baseRev: ms0.rev,
          payload: { to: 'chat', navRev: ms0.navRev },
        });
        const mPick = await svcMisreport.handleRpcAction('pick-project-directory', { preset: 'shared-code-repo' });
        assert.equal(mPick.ok, true);
        assert.equal(mPick.result.sharedWithCode, true);

        const mSel = await svcMisreport.handleRpc({
          version: 2,
          action: 'select-spark-project',
          requestId: 'req-p1-sel',
          storeId: ms0.storeId,
          baseRev: mChat.rev,
          payload: {
            selectionToken: mPick.result.selectionToken,
            navRev: mChat.snapshot.navRev,
            draftRev: mChat.snapshot.draftRev,
          },
        });
        assert.equal(mSel.ok, true);
        const mProjId = mSel.result.project.id;

        const mSend = await svcMisreport.handleRpc({
          version: 2,
          action: 'send-chat-first',
          requestId: 'req-p1-send',
          storeId: ms0.storeId,
          baseRev: mSel.rev,
          payload: {
            navRev: mSel.snapshot.navRev,
            draftRev: mSel.snapshot.draftRev,
            message: 'تحقق من منع الكتابة في مجلد مشترك عندما يفيد المضيف خطأ بأنه معزول',
          },
        });
        assert.equal(mSend.ok, true);
        assert.equal(mSend.result.permissionStatus, 'non-destructive-shared');
        assert.equal(mSend.result.sharedWithCode, true);
        assert.equal(mSend.result.nonDestructive, true);
        assert.equal(svcMisreport.getPermissionAudit().projectPermissionWrites, 0);
        assert.equal(svcMisreport.getPermissionAudit().globalPermissionWrites, 0);

        const mUnlink = await svcMisreport.handleRpc({
          version: 2,
          action: 'unlink-spark-project',
          requestId: 'req-p1-unlink',
          storeId: ms0.storeId,
          baseRev: mSend.rev,
          payload: { sparkProjectId: mProjId },
        });
        assert.equal(mUnlink.ok, true);
        assert.equal(mUnlink.result.permissionRestoreStatus, 'skipped-non-destructive');
        assert.equal(svcMisreport.getPermissionAudit().projectPermissionWrites, 0);
        assert.equal(svcMisreport.getPermissionAudit().globalPermissionWrites, 0);
      } finally {
        await svcMisreport.dispose();
      }
    } finally {
      fs.rmSync(envMisreport.root, { recursive: true, force: true });
    }
  } finally {
    await svc.dispose();
  }
});

test('Chat-only move-chat-session (drag/drop into folders, running Knowledge move allowed, cross-project BUSY), strict Code<->Chat non-interop, and English and Arabic greeting pools', async () => {
  const svc = createStudioSandboxService();
  try {
    const s0 = svc.getState().snapshot;
    const storeId = s0.storeId;

    for (const lang of ['en', 'ar']) {
      assert.ok(Array.isArray(GREETING_POOLS[lang].withUser) && GREETING_POOLS[lang].withUser.length > 0);
      assert.ok(Array.isArray(GREETING_POOLS[lang].anonymous) && GREETING_POOLS[lang].anonymous.length > 0);
      const named = formatGreeting(lang, 'Alex', 0);
      assert.equal(named.includes('Alex'), true);
      const anon = formatGreeting(lang, '', 0);
      assert.equal(anon.includes('{user}'), false);
    }
    assert.equal(normalizeGreetingLang('ar-EG'), 'ar');
    assert.equal(normalizeGreetingLang('pt-BR'), 'en');
    assert.equal(normalizeGreetingLang('en-US'), 'en');
    assert.equal(normalizeGreetingLang('ar_SA'), 'ar');

    const toChat = await svc.handleRpc({
      version: 2,
      action: 'switch-mode',
      requestId: 'req-mv-chat',
      storeId,
      baseRev: s0.rev,
      payload: { to: 'chat', navRev: s0.navRev },
    });
    const f1 = await svc.handleRpc({
      version: 2,
      action: 'create-knowledge-folder',
      requestId: 'req-mv-f1',
      storeId,
      baseRev: toChat.rev,
      payload: { name: 'ملاحظات البحث' },
    });
    const f2 = await svc.handleRpc({
      version: 2,
      action: 'create-knowledge-folder',
      requestId: 'req-mv-f2',
      storeId,
      baseRev: f1.rev,
      payload: { name: 'أرشيف الأفكار' },
    });
    const folder1Id = f1.result.folder.id;
    const folder2Id = f2.result.folder.id;

    const sent = await svc.handleRpc({
      version: 2,
      action: 'send-chat-first',
      requestId: 'req-mv-send',
      storeId,
      baseRev: f2.rev,
      payload: {
        navRev: f2.snapshot.navRev,
        draftRev: f2.snapshot.draftRev,
        message: 'محادثة لاختبار النقل بالسحب والعودة إلى Code',
      },
    });
    assert.equal(sent.ok, true);
    const chatId = sent.result.cascadeId;
    assert.equal(sent.snapshot.currentView, `/c/${chatId}`);

    const navHome = await svc.handleRpc({
      version: 2,
      action: 'navigate',
      requestId: 'req-mv-home',
      storeId,
      baseRev: sent.rev,
      payload: { mode: 'chat', view: '/', navRev: sent.snapshot.navRev },
    });
    const box = await svc.handleRpcAction('create-spark-box', { name: 'DragTargetBox' });
    const selProj = await svc.handleRpc({
      version: 2,
      action: 'select-spark-project',
      requestId: 'req-mv-sel-proj',
      storeId,
      baseRev: navHome.rev,
      payload: {
        selectionToken: box.result.selectionToken,
        navRev: navHome.snapshot.navRev,
        draftRev: navHome.snapshot.draftRev,
      },
    });
    const sparkProjId = selProj.result.project.id;

    const liveItems = svc.hostAdapter.getCatalog().items.map((it) =>
      it.cascadeId === chatId ? { ...it, status: 'running' } : it
    );
    await svc.applyFixture({ catalog: { health: 'ready', items: liveItems } });

    const dragF1 = await svc.handleRpc({
      version: 2,
      action: 'move-chat-session',
      requestId: 'req-mv-drag-f1',
      storeId,
      baseRev: svc.getState().rev,
      payload: { cascadeId: chatId, folderId: folder1Id },
    });
    assert.equal(dragF1.ok, true);
    assert.equal(dragF1.result.moved, true);
    assert.equal(dragF1.snapshot.assignments[chatId].placement.folderId, folder1Id);

    const dragF2 = await svc.handleRpc({
      version: 2,
      action: 'move-chat-session',
      requestId: 'req-mv-drag-f2',
      storeId,
      baseRev: dragF1.rev,
      payload: { cascadeId: chatId, placement: { kind: 'knowledge', folderId: folder2Id } },
    });
    assert.equal(dragF2.ok, true);
    assert.equal(dragF2.snapshot.assignments[chatId].placement.folderId, folder2Id);

    const crossBusy = await svc.handleRpc({
      version: 2,
      action: 'move-chat-session',
      requestId: 'req-mv-cross-busy',
      storeId,
      baseRev: dragF2.rev,
      payload: { cascadeId: chatId, sparkProjectId: sparkProjId },
    });
    assert.equal(crossBusy.ok, false);
    assert.equal(crossBusy.error.code, ERROR_CODES.BUSY);

    const toCodeForbiddenRunning = await svc.handleRpc({
      version: 2,
      action: 'move-session-to-code',
      requestId: 'req-mv-code-forbid-1',
      storeId,
      baseRev: dragF2.rev,
      payload: { cascadeId: chatId },
    });
    assert.equal(toCodeForbiddenRunning.ok, false);
    assert.equal(toCodeForbiddenRunning.error.code, ERROR_CODES.INVALID_ARGUMENT);

    const idleItems = svc.hostAdapter.getCatalog().items.map((it) =>
      it.cascadeId === chatId ? { ...it, status: 'idle' } : it
    );
    await svc.applyFixture({ catalog: { health: 'ready', items: idleItems } });

    const crossOk = await svc.handleRpc({
      version: 2,
      action: 'move-chat-session',
      requestId: 'req-mv-cross-ok',
      storeId,
      baseRev: svc.getState().rev,
      payload: { cascadeId: chatId, sparkProjectId: sparkProjId },
    });
    assert.equal(crossOk.ok, true);
    assert.equal(crossOk.snapshot.assignments[chatId].placement.kind, 'spark');
    assert.equal(crossOk.snapshot.assignments[chatId].placement.sparkProjectId, sparkProjId);
    assert.equal(crossOk.snapshot.assignments[chatId].continuation, 'needs-rebind');

    const backToKnowRoot = await svc.handleRpc({
      version: 2,
      action: 'move-chat-session',
      requestId: 'req-mv-know-root',
      storeId,
      baseRev: crossOk.rev,
      payload: { cascadeId: chatId, placement: { kind: 'knowledge', folderId: null } },
    });
    assert.equal(backToKnowRoot.ok, true);
    assert.equal(backToKnowRoot.snapshot.assignments[chatId].placement.kind, 'knowledge');
    assert.equal(backToKnowRoot.snapshot.assignments[chatId].placement.folderId, null);

    const openInChat = await svc.handleRpc({
      version: 2,
      action: 'navigate',
      requestId: 'req-mv-open-chat',
      storeId,
      baseRev: backToKnowRoot.rev,
      payload: { mode: 'chat', view: `/c/${chatId}`, navRev: backToKnowRoot.snapshot.navRev },
    });
    assert.equal(openInChat.ok, true);
    assert.equal(openInChat.snapshot.currentView, `/c/${chatId}`);

    const toCodeForbiddenIdle = await svc.handleRpc({
      version: 2,
      action: 'move-session-to-code',
      requestId: 'req-mv-code-forbid-2',
      storeId,
      baseRev: openInChat.rev,
      payload: { cascadeId: chatId },
    });
    assert.equal(toCodeForbiddenIdle.ok, false);
    assert.equal(toCodeForbiddenIdle.error.code, ERROR_CODES.INVALID_ARGUMENT);
    assert.equal(Object.prototype.hasOwnProperty.call(svc.getState().snapshot.assignments, chatId), true);
    assert.equal(svc.getState().snapshot.modeLastView.chat, `/c/${chatId}`);

    const toChatForbiddenIdle = await svc.handleRpc({
      version: 2,
      action: 'move-session-to-chat',
      requestId: 'req-mv-chat-forbid-2',
      storeId,
      baseRev: openInChat.rev,
      payload: { cascadeId: 'code-ci-review', placement: { kind: 'knowledge', folderId: null } },
    });
    assert.equal(toChatForbiddenIdle.ok, false);
    assert.equal(toChatForbiddenIdle.error.code, ERROR_CODES.INVALID_ARGUMENT);
    assert.equal(Object.prototype.hasOwnProperty.call(svc.getState().snapshot.assignments, 'code-ci-review'), false);
    assert.equal(svc.getPermissionAudit().globalPermissionWrites, 0);
  } finally {
    await svc.dispose();
  }
});

test('failed atomic replace preserves committed bytes and the queue accepts the next request', async (t) => {
  const svc = createStudioSandboxService();
  t.after(() => svc.dispose());
  const before = fs.readFileSync(svc.statePath);
  const fault = t.mock.method(fs, 'renameSync', () => {
    throw Object.assign(new Error('simulated filesystem failure'), { code: 'EIO' });
  });
  try {
    const result = await svc.handleRpcAction('switch-mode', { to: 'chat' });
    assert.equal(result.error?.code, ERROR_CODES.PERSISTENCE_FAILED);
    assert.equal(svc.getSnapshot().activeMode, 'code');
    assert.deepEqual(fs.readFileSync(svc.statePath), before);
    assert.equal(fs.readdirSync(path.dirname(svc.statePath)).some((p) => p.endsWith('.tmp')), false);
  } finally {
    fault.mock.restore();
  }
  assert.equal((await svc.handleRpcAction('switch-mode', { to: 'chat' })).ok, true);
});

test('constructor releases writer lock when the initial save fails', (t) => {
  const env = makeTempEnv();
  t.after(() => fs.rmSync(env.root, { recursive: true, force: true }));
  const fsync = fs.fsyncSync;
  let calls = 0;
  const fail = t.mock.method(fs, 'fsyncSync', (fd) => {
    if (++calls === 2) throw new Error('simulated disk full');
    fsync(fd);
  });
  try {
    assert.throws(() => new SidebarStudioService(env), /simulated disk full/);
  } finally {
    fail.mock.restore();
  }
  assert.equal(fs.existsSync(`${env.statePath}.lock`), false);
});

test('expired WSL confirmation frees the draft without dispatching the old message', async (t) => {
  let now = 1000;
  const svc = createStudioSandboxService({ now: () => now });
  t.after(() => svc.dispose());
  svc.hostAdapter.setFaults({ requireWslConfirmation: true });
  await svc.handleRpcAction('switch-mode', { to: 'chat' });
  const first = await svc.handleRpcAction('send-chat-first', { message: 'Awaiting confirmation' });
  assert.equal(first.result.status, 'awaiting-confirmation');
  now += 6 * 60 * 1000;
  const next = await svc.handleRpcAction('send-chat-first', { message: 'A fresh draft' });
  assert.equal(next.result?.status, 'awaiting-confirmation');
  assert.notEqual(next.result.operationId, first.result.operationId);
  const old = await svc.handleRpcAction('get-operation', { operationId: first.result.operationId });
  assert.equal(old.result.status, 'failed');
  assert.ok(old.rev > first.rev);
  assert.equal(svc.getPermissionAudit().projectPermissionWrites, 0);
});

test('restarting during WSL confirmation releases the draft and requires a fresh confirmation', async (t) => {
  const env = makeTempEnv();
  t.after(() => fs.rmSync(env.root, { recursive: true, force: true }));
  const options = { sandboxMode: true, sandboxRoot: env.root, ...env };
  const svc = new SidebarStudioService(options);
  let first;
  try {
    svc.hostAdapter.setFaults({ requireWslConfirmation: true });
    await svc.handleRpcAction('switch-mode', { to: 'chat' });
    first = await svc.handleRpcAction('send-chat-first', { requestId: 'confirmed-once', message: 'Awaiting confirmation' });
    assert.equal(first.result.status, 'awaiting-confirmation');
  } finally {
    await svc.dispose();
  }
  const reopened = new SidebarStudioService(options);
  t.after(() => reopened.dispose());
  reopened.hostAdapter.setFaults({ requireWslConfirmation: true });
  const old = await reopened.handleRpcAction('get-operation', { operationId: first.result.operationId });
  assert.equal(old.result.status, 'failed');
  const replay = await reopened.handleRpcAction('send-chat-first', { requestId: 'confirmed-once', message: 'Awaiting confirmation' });
  assert.equal(replay.ok, false);
  const next = await reopened.handleRpcAction('send-chat-first', { requestId: 'confirmed-fresh', message: 'Awaiting confirmation' });
  assert.equal(next.result?.status, 'awaiting-confirmation');
  assert.equal(reopened.getPermissionAudit().projectPermissionWrites, 0);
});

test('permission changes require a usable baseline and restoration preflights every field before writing', async () => {
  const baseline = { autoExecutionPolicy: 'ask', fileAccessPolicy: 'allow-all' };
  const applied = { autoExecutionPolicy: 'off', fileAccessPolicy: 'ask-outside' };
  const writes = [];
  const setters = {
    setProjectAutoExecutionPolicy: async (_scope, value) => writes.push(value),
    setProjectFileAccessPolicy: async (_scope, value) => writes.push(value),
  };
  const scopeRef = 'scope-fixture';
  for (const snapshot of [null, {}, { ...baseline, fileAccessPolicy: null }]) {
    const res = await applyProjectPermissionIsolation({ kind: 'spark', scopeRef, scopeIsolated: true,
      projectSettingsProvider: { ...setters, getProjectSettings: async () => snapshot } });
    assert.equal(res.status, 'needs-reconciliation');
  }
  for (const args of [
    { baseline: { autoExecutionPolicy: 'ask' }, projectSettingsProvider: { ...setters, getProjectSettings: async () => applied } },
    { baseline, projectSettingsProvider: setters },
    { baseline, projectSettingsProvider: { ...setters, getProjectSettings: async () => ({ autoExecutionPolicy: 'off' }) } },
  ]) {
    const res = await restoreProjectPermissionBaseline({ scopeRef, applied, scopeControlled: true, ...args });
    assert.equal(res.status, 'needs-reconciliation');
  }
  assert.deepEqual(writes, []);
  assert.equal((await restoreProjectPermissionBaseline({ scopeRef, baseline, applied, scopeControlled: true,
    projectSettingsProvider: { ...setters, getProjectSettings: async () => applied } })).status, 'restored');
  assert.deepEqual(writes, ['ask', 'allow-all']);
});

test('Spark directory creation replays the original outcome without allocating another token', async (t) => {
  const svc = createStudioSandboxService();
  t.after(() => svc.dispose());
  const request = { requestId: 'spark-box-retry', payload: { name: 'Retry fixture' } };
  const created = await svc.handleRpcAction('create-spark-box', request);
  const replay = await svc.handleRpcAction('create-spark-box', request);
  assert.equal(created.result.created, true);
  assert.deepEqual(replay.result, created.result);
  const conflict = await svc.handleRpcAction('create-spark-box', { ...request, payload: { name: 'Other fixture' } });
  assert.equal(conflict.error?.code, ERROR_CODES.IDEMPOTENCY_CONFLICT);
});

test('reserved conversation IDs that already belong to a visible session are not delivered to', async (t) => {
  const svc = createStudioSandboxService();
  t.after(() => svc.dispose());
  await svc.updateCatalog({ health: 'ready', items: [{ cascadeId: 'existing-session', title: 'Existing' }] });
  svc.hostAdapter.reserveSession = async () => ({ cascadeId: 'existing-session' });
  let deliveries = 0;
  svc.hostAdapter.deliverFirstMessage = async () => { deliveries++; return { status: 'received' }; };
  await svc.handleRpcAction('switch-mode', { to: 'chat' });
  const res = await svc.handleRpcAction('send-chat-first', { message: 'New conversation' });
  assert.equal(res.ok, false);
  assert.equal(deliveries, 0);
  assert.deepEqual(svc.getSnapshot().assignments, {});
});

test('unlink preserves Code settings when the host reports the project is now shared', async (t) => {
  const svc = createStudioSandboxService();
  t.after(() => svc.dispose());
  await svc.handleRpcAction('switch-mode', { to: 'chat' });
  const box = await svc.handleRpcAction('create-spark-box', { name: 'Later shared' });
  await svc.handleRpcAction('select-spark-project', { selectionToken: box.result.selectionToken });
  const projectId = svc.getSnapshot().chatDraft.sparkProjectId;
  assert.equal((await svc.handleRpcAction('send-chat-first', { message: 'Before sharing' })).ok, true);
  const before = svc.getPermissionAudit().projectPermissionWrites;
  svc.hostAdapter.isPathSharedWithCode = () => true;
  const result = await svc.handleRpcAction('unlink-spark-project', { sparkProjectId: projectId });
  assert.equal(result.result?.permissionRestoreStatus, 'skipped-non-destructive');
  assert.equal(svc.getPermissionAudit().projectPermissionWrites, before);
});

test('unrecognized host delivery outcomes never commit a conversation to Chat', async (t) => {
  const svc = createStudioSandboxService();
  t.after(() => svc.dispose());
  svc.hostAdapter.deliverFirstMessage = async ({ cascadeId }) => ({ status: 'unrecognized', cascadeId });
  await svc.handleRpcAction('switch-mode', { to: 'chat' });
  const result = await svc.handleRpcAction('send-chat-first', { message: 'Await delivery' });
  assert.equal(result.error?.code, ERROR_CODES.NEEDS_RECONCILIATION);
  assert.deepEqual(svc.getSnapshot().assignments, {});
});

test('healthy daemon Sidebar RPC preserves transport IDs and passes a single v2 envelope', async () => {
  const { PrismDaemon } = await import('../sidecars/daemon/main.mjs');
  const daemon = Object.create(PrismDaemon.prototype);
  const calls = [];
  daemon.cdp = { readConfig: () => ({ sidebarStudio: 'on' }) };
  daemon.ensureSidebarService = async () => ({ handleRpc: async (request) => { calls.push(request); return { ok: true }; } });
  const responses = [];
  const entry = {
    sidebarHostVerified: true, mainFrameId: 'root-frame', hasFrameTree: true,
    contextFrames: new Map([[1, { isDefault: true, type: 'default', frameId: 'root-frame' }]]),
    session: { closed: false, send: async (_command, params) => { responses.push(params); } },
  };
  const id = 2 ** 32 + 10;
  const envelope = { version: 2, action: 'get-state', payload: {} };
  await daemon.handleBindingCall(entry, {
    name: SIDEBAR_BINDING, executionContextId: 1,
    payload: JSON.stringify({ id, ...envelope, input: envelope }),
  });
  assert.deepEqual(calls, [envelope]);
  assert.equal(responses[0].contextId, 1);
  assert.ok(responses[0].expression.includes(`b.resolve(${id}, r)`));
});

test('Workbench Studio roots and host adapter are owned by the gateway', async (t) => {
  const { createRequire } = await import('node:module');
  const { createWorkbenchServer } = createRequire(import.meta.url)(WORKBENCH_SERVER_FILE);
  const env = makeTempEnv();
  let adapterReads = 0;
  const wb = createWorkbenchServer({ watch: false, studioOptions: {
    knowledgeRoot: env.knowledgeRoot,
    hostAdapter: { getCatalog() { adapterReads++; return { health: 'ready', items: [] }; } },
  } });
  t.after(async () => {
    await new Promise((resolve) => wb.close(resolve));
    fs.rmSync(env.root, { recursive: true, force: true });
  });
  await new Promise((resolve) => wb.listen(0, '127.0.0.1', resolve));
  const response = await fetch(`http://127.0.0.1:${wb.address().port}/api/studio/state`);
  assert.equal(response.status, 200);
  assert.equal(adapterReads, 0);
  assert.equal(fs.existsSync(env.knowledgeRoot), false);
});

test('a transient ready catalog omission does not change permanent Chat ownership', async (t) => {
  const svc = createStudioSandboxService();
  t.after(() => svc.dispose());
  await svc.handleRpcAction('switch-mode', { to: 'chat' });
  const sent = await svc.handleRpcAction('send-chat-first', { message: 'Retain ownership' });
  const { cascadeId } = sent.result;
  const original = svc.hostAdapter.getCatalog();
  await svc.updateCatalog({ health: 'ready', items: [] });
  assert.equal(svc.getSnapshot().currentView, '/');
  assert.equal(svc.getSnapshot().assignments[cascadeId]?.mode, 'chat');
  await svc.updateCatalog(original);
  assert.ok(svc.getSnapshot().chatAssignedIds.includes(cascadeId));
});

test('HTTP Studio returns a structured 413 at the payload limit', async (t) => {
  const { createRequire } = await import('node:module');
  const { createWorkbenchServer } = createRequire(import.meta.url)(WORKBENCH_SERVER_FILE);
  const wb = createWorkbenchServer({ watch: false });
  t.after(() => new Promise((resolve) => wb.close(resolve)));
  await new Promise((resolve) => wb.listen(0, '127.0.0.1', resolve));
  const origin = `http://127.0.0.1:${wb.address().port}`;
  const response = await fetch(`${origin}/api/studio/rpc`, {
    method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json', 'X-Studio-Token': wb.getStudioToken() },
    body: JSON.stringify({ action: 'get-state', padding: 'a'.repeat(65536) }),
  });
  assert.equal(response.status, 413);
  assert.equal((await response.json()).error.code, ERROR_CODES.LIMIT_EXCEEDED);
});

test('daemon mounts safe v2 Sidebar client and still refuses any legacy client containing global permission writers', async () => {
  const { PrismDaemon } = await import('../sidecars/daemon/main.mjs');
  const daemon = Object.create(PrismDaemon.prototype);
  daemon.rootDir = ROOT_DIR;
  daemon._readCdpFileSig = () => null;
  daemon.cdp = {
    buildInjectExpression: () => 'main',
    buildSidebarStudioExpression: (meta, client) => ({ meta, client }),
  };
  daemon.rebuildBundle();
  assert.equal(daemon._hasSafeV2SidebarClientFile(), true);
  assert.equal(daemon.sidebarExpr.client, undefined);
  assert.equal(daemon.sidebarExpr.meta.serviceReady, false);

  const legacyDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ag-prism-legacy-sb-'));
  try {
    const sbDir = path.join(legacyDir, 'vendor', 'sidebar-studio');
    fs.mkdirSync(sbDir, { recursive: true });
    fs.writeFileSync(
      path.join(sbDir, 'sidebar-client.js'),
      'const SIDEBAR_STUDIO_CLIENT_V2 = "2.0.0"; host.setPrefValues({ global: 1 });',
      'utf8'
    );
    daemon.rootDir = legacyDir;
    daemon.rebuildBundle();
    assert.equal(daemon._hasSafeV2SidebarClientFile(), false);
    assert.equal(daemon.sidebarExpr.client, '');

    fs.writeFileSync(path.join(sbDir, 'sidebar-client.js'), '// legacy v1 without marker', 'utf8');
    daemon.rebuildBundle();
    assert.equal(daemon._hasSafeV2SidebarClientFile(), false);
    assert.equal(daemon.sidebarExpr.client, '');
  } finally {
    fs.rmSync(legacyDir, { recursive: true, force: true });
  }
});

test('Sidebar daemon stop waits for initialization and disposes its service once', async () => {
  const { PrismDaemon } = await import('../sidecars/daemon/main.mjs');
  const daemon = Object.create(PrismDaemon.prototype);
  daemon.detachAll = async () => {};
  daemon.releaseOwnership = () => {};
  let finish;
  let disposed = 0;
  daemon._sidebarServicePromise = new Promise((resolve) => { finish = resolve; });
  const stopped = daemon.stop();
  await new Promise(setImmediate);
  daemon.sidebarService = { dispose: async () => { disposed++; } };
  finish(daemon.sidebarService);
  await stopped;
  assert.equal(disposed, 1);
  assert.equal(await daemon.ensureSidebarService(), null);
});

test('a confirmed first message survives restart and replays without redelivery', async () => {
  const env = makeTempEnv();
  const hostAdapter = createSandboxHostAdapter(env.root);
  const options = { ...env, sandboxMode: true, sandboxRoot: env.root, hostAdapter };
  let svc;
  try {
    svc = new SidebarStudioService(options);
    await svc.handleRpcAction('switch-mode', { to: 'chat' });
    hostAdapter.setFaults({ crashAfter: 'message-confirmed' });
    const request = { requestId: 'confirmed-recovery', message: 'Once only' };
    const pending = await svc.handleRpcAction('send-chat-first', request);
    assert.equal(pending.result.phase, 'message-confirmed');
    await svc.dispose();
    hostAdapter.setFaults({ crashAfter: null });
    svc = new SidebarStudioService(options);
    const replay = await svc.handleRpcAction('send-chat-first', request);
    assert.equal(replay.result?.status, 'succeeded');
    assert.equal(replay.result.cascadeId, pending.result.cascadeId);
    assert.equal(svc.getSnapshot().assignments[pending.result.cascadeId].mode, 'chat');
    assert.equal(svc.getPermissionAudit().projectPermissionWrites, 3);
  } finally {
    await svc?.dispose();
    fs.rmSync(env.root, { recursive: true, force: true });
  }
});

test('first-send records the original permission baseline before the first host write', async (t) => {
  const svc = createStudioSandboxService();
  t.after(() => svc.dispose());
  const provider = svc.hostAdapter.getProjectSettingsProvider();
  const original = provider.setProjectAutoExecutionPolicy;
  let beforeWrite;
  provider.setProjectAutoExecutionPolicy = (scope, value) => {
    beforeWrite = JSON.parse(fs.readFileSync(svc.statePath, 'utf8'));
    return original(scope, value);
  };
  await svc.handleRpcAction('switch-mode', { to: 'chat' });
  assert.equal((await svc.handleRpcAction('send-chat-first', { message: 'Journal the baseline' })).ok, true);
  assert.equal(Object.values(beforeWrite.operations)[0].phase, 'applying-permissions');
  assert.equal(beforeWrite.projectScopes['scope-knowledge-default'].baseline.autoExecutionPolicy, 'ask');
});

test('a hidden or outdated catalog row cannot be opened as a background task', async (t) => {
  const svc = createStudioSandboxService();
  t.after(() => svc.dispose());
  await svc.handleRpcAction('switch-mode', { to: 'chat' });
  await svc.updateCatalog({ health: 'ready', items: [
    { cascadeId: 'code-task', status: 'idle', hidden: true, updatedAt: 20 },
    { cascadeId: 'code-task', status: 'running', updatedAt: 10 },
  ] });
  assert.equal(svc.getSnapshot().backgroundBadge, null);
  const result = await svc.handleRpcAction('open-background-task', { targetMode: 'code', cascadeId: 'code-task' });
  assert.equal(result.error?.code, ERROR_CODES.BADGE_STALE);
});

test('a rejected host reservation is resumable without wedging the service queue', async (t) => {
  const svc = createStudioSandboxService();
  t.after(() => svc.dispose());
  const reserve = svc.hostAdapter.reserveSession;
  svc.hostAdapter.reserveSession = async () => { throw new Error('temporary host outage'); };
  await svc.handleRpcAction('switch-mode', { to: 'chat' });
  const result = await svc.handleRpcAction('send-chat-first', { requestId: 'reserve-retry', message: 'Same message' });
  assert.equal(result.error?.code, ERROR_CODES.CAPABILITY_UNAVAILABLE);
  const [op] = svc.getSnapshot().pendingOperations;
  assert.equal(op.status, 'needs-input');
  svc.hostAdapter.reserveSession = reserve;
  const retried = await svc.handleRpcAction('send-chat-first', { resumeOperationId: op.operationId, message: 'Same message' });
  assert.equal(retried.result?.status, 'succeeded');
});

test('sidebar-studio modules enforce local source hygiene, zero global writes, and 7 performance CSS laws', () => {
  const files = [SERVICE_FILE, STATE_MACHINE_FILE, LIVE_ADAPTER_FILE, CLIENT_FILE];
  const banned = [
    new RegExp(['work', 'space_', 'program'].join(''), 'i'),
    new RegExp(['Users', 'Administrator'].join('\\\\'), 'i'),
    new RegExp(['AIza', 'Sy'].join('')),
    new RegExp(['\\bsk-', 'ant'].join('')),
    new RegExp(['\\bgh', 'p_'].join('')),
  ];
  for (const filePath of files) {
    const src = fs.readFileSync(filePath, 'utf8');
    assert.equal(/\bexec\s*\(|\bexecSync\s*\(/.test(src), false);
    assert.equal(/\beval\s*\(|new\s+Function\s*\(/.test(src), false);
    assert.equal(/\.innerHTML\s*=|\.outerHTML\s*=/.test(src), false);
    for (const re of banned) {
      assert.equal(re.test(src), false);
    }
  }
  const clientSrc = fs.readFileSync(CLIENT_FILE, 'utf8');
  assert.ok(clientSrc.includes('SIDEBAR_STUDIO_CLIENT_V2'));
  assert.equal(/\bsetPrefValues?\s*\(/.test(clientSrc), false);
  assert.equal(/:has\s*\(/.test(clientSrc), false);
  assert.equal(/\.isCollapsed\b/.test(clientSrc), false);
  assert.equal(/contain:\s*strict|contain:\s*content|contain:\s*layout/.test(clientSrc), false);
  assert.ok(clientSrc.includes('contain:style'));
  assert.ok(clientSrc.includes('content-visibility:hidden'));
  assert.equal(/\p{Extended_Pictographic}/u.test(clientSrc), false);
});

test('live-host-adapter normalizes Win32/WSL paths, matches real File ID, enforces project-only setters & 0 global writes', async () => {
  assert.equal(normalizeHostPathKey('C:\\Projects\\Demo\\'), 'c:/projects/demo');
  assert.equal(normalizeHostPathKey('/mnt/c/Projects/Demo/'), 'c:/projects/demo');
  assert.equal(normalizeHostPathKey('\\\\?\\D:\\Code\\App\\'), 'd:/code/app');

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ag-prism-live-adp-'));
  const codeDir = path.join(tmpDir, 'CodeRepo');
  const sparkOnlyDir = path.join(tmpDir, 'SparkOnly');
  fs.mkdirSync(codeDir, { recursive: true });
  fs.mkdirSync(sparkOnlyDir, { recursive: true });

  try {
    const pspWrites = [];
    const mockHostOps = {
      psp: {
        getProjectPermissionGrants: async ({ scopeRef }) => ({
          ok: true,
          grants: {
            autoExecutionPolicy: 'ask',
            fileAccessPolicy: 'ask-outside',
            internetPolicy: 'ask',
            sandboxMode: 'off',
            scopeRef,
          },
        }),
        setProjectAutoExecutionPolicy: async (args) => {
          pspWrites.push(['auto', args]);
          return { ok: true };
        },
        setProjectFileAccessPolicy: async (args) => {
          pspWrites.push(['file', args]);
          return { ok: true };
        },
        setProjectInternetPolicy: async (args) => {
          pspWrites.push(['net', args]);
          return { ok: true };
        },
        setProjectSandboxMode: async (args) => {
          pspWrites.push(['sandbox', args]);
          return { ok: true };
        },
      },
      deliverFirstMessage: async () => ({ status: 'weird-status' }),
      rebindSession: async ({ cascadeId, scopeRef }) => ({ ok: true, cascadeId: 'wrong-id', scopeRef }),
    };

    const adapter = createLiveHostAdapter({
      evaluateInHost: async (expr) => {
        const sandbox = { window: { __agPrismSidebarHostOps: mockHostOps } };
        return await vm.runInNewContext(expr, sandbox);
      },
    });

    assert.equal(adapter.getProjectSettingsProvider(), null);
    adapter.syncFromRenderer({
      catalog: { health: 'ready', items: [{ cascadeId: 'c1', title: 'Code 1', status: 'idle', workspacePath: codeDir }] },
      codeWorkspacePaths: [codeDir],
      capabilities: { projectPermissions: true, sessionRebind: true, sandboxAvailable: true, wslAvailable: false },
    });

    assert.equal(adapter.isPathSharedWithCode(codeDir), true);
    const upperCodeDir = codeDir.toUpperCase();
    let isCaseInsensitiveFs = process.platform === 'win32';
    if (!isCaseInsensitiveFs) {
      try {
        const stOrig = fs.statSync(codeDir);
        const stUpper = fs.statSync(upperCodeDir);
        isCaseInsensitiveFs = stOrig.dev === stUpper.dev && stOrig.ino === stUpper.ino;
      } catch {
        isCaseInsensitiveFs = false;
      }
    }
    assert.equal(adapter.isPathSharedWithCode(upperCodeDir), isCaseInsensitiveFs);
    assert.equal(adapter.isPathSharedWithCode(sparkOnlyDir), false);

    if (process.platform === 'win32') {
      const m = /^([a-zA-Z]):[\\/](.*)$/.exec(codeDir);
      if (m) {
        const wslEquivalent = `/mnt/${m[1].toLowerCase()}/${m[2].replace(/\\/g, '/')}`;
        assert.equal(adapter.isPathSharedWithCode(wslEquivalent), true);
      }
    }

    const psp = adapter.getProjectSettingsProvider();
    assert.ok(psp);
    const grants = await psp.getProjectPermissionGrants('scope-spark-1');
    assert.equal(grants.autoExecutionPolicy, 'ask');
    await psp.setProjectAutoExecutionPolicy('scope-spark-1', 'off');
    await psp.setProjectFileAccessPolicy('scope-spark-1', 'ask-outside');
    await assert.rejects(() => psp.setProjectAutoExecutionPolicy('scope-spark-1', 'dangerous-value'), /Disallowed policy value/);
    await assert.rejects(() => psp.setProjectAutoExecutionPolicy('global', 'off'), /reserved global scopeRef/);

    assert.equal(adapter.isPathSharedWithCode(path.join(codeDir, 'packages', 'sub')), true);

    const deliv = await adapter.deliverFirstMessage({ idempotencyKey: 'k1', cascadeId: 'c-new', message: 'hi' });
    assert.equal(deliv.status, 'ambiguous');
    mockHostOps.deliverFirstMessage = async () => ({ status: 'not-received', cascadeId: 'other-cid' });
    const delivMismatch = await adapter.deliverFirstMessage({ idempotencyKey: 'k2', cascadeId: 'c-new', message: 'hi' });
    assert.equal(delivMismatch.status, 'ambiguous');
    mockHostOps.checkDeliveryStatus = async ({ cascadeId }) => ({ ok: true, cascadeId, delivered: true, confirmedNotReceived: true });
    const chkConflict = await adapter.checkDeliveryStatus({ idempotencyKey: 'k2', cascadeId: 'c-new' });
    assert.equal(chkConflict.delivered, false);
    assert.equal(chkConflict.confirmedNotReceived, false);
    const rebind = await adapter.rebindSession({ cascadeId: 'c1', scopeRef: 'scope-spark-1', placement: {} });
    assert.equal(rebind.ok, false);

    const audit = adapter.getAuditReport();
    assert.equal(audit.globalPermissionWrites, 0);
    assert.equal(audit.projectPermissionWrites, 2);
    assert.equal(pspWrites.length, 2);
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('sidebar-service rejects v2-shaped persisted JSON missing explicit schemaVersion and supports non-sandbox sync-catalog', async () => {
  const env = makeTempEnv('ag-prism-noschema-');
  try {
    fs.mkdirSync(path.dirname(env.statePath), { recursive: true });
    for (const badPayload of [
      { activeMode: 'chat', modeLastView: { code: '/', chat: '/' }, knowledgeFolders: [{ id: 'f1', name: 'Notes' }] },
      { version: 2, activeMode: 'chat', knowledgeFolders: [] },
      { schemaVersion: '2', activeMode: 'chat', knowledgeFolders: [] },
      { schemaVersion: '3', activeMode: 'chat' },
    ]) {
      const rawBad = JSON.stringify(badPayload);
      fs.writeFileSync(env.statePath, rawBad, 'utf8');
      const svc = new SidebarStudioService(env);
      try {
        const diag = svc.getBootDiagnostic();
        assert.ok(diag && diag.code === ERROR_CODES.INVALID_ARGUMENT);
        assert.equal(fs.readFileSync(env.statePath, 'utf8'), rawBad);
      } finally {
        await svc.dispose();
      }
    }
  } finally {
    fs.rmSync(env.root, { recursive: true, force: true });
  }

  const env2 = makeTempEnv('ag-prism-synccat-');
  try {
    const adapter = createLiveHostAdapter();
    const svcLive = new SidebarStudioService({ ...env2, hostAdapter: adapter });
    try {
      const res = await svcLive.handleRpc({
        version: 2,
        action: 'sync-catalog',
        payload: {
          catalog: { health: 'ready', items: [{ cascadeId: 'live-1', title: 'Live Task', status: 'running' }] },
          capabilities: { projectPermissions: true },
        },
      });
      assert.equal(res.ok, true);
      assert.equal(adapter.getCatalog().items.length, 1);
      assert.equal(adapter.getCapabilities().projectPermissions, true);
    } finally {
      await svcLive.dispose();
    }

    const sandboxSvc = createStudioSandboxService();
    try {
      const beforeItems = sandboxSvc.hostAdapter.getCatalog().items.length;
      assert.ok(beforeItems > 0);
      const ignored = await sandboxSvc.handleRpcAction('sync-catalog', {
        catalog: { health: 'ready', items: [] },
      });
      assert.equal(ignored.ok, true);
      assert.equal(sandboxSvc.hostAdapter.getCatalog().items.length, beforeItems);
    } finally {
      await sandboxSvc.dispose();
    }
  } finally {
    fs.rmSync(env2.root, { recursive: true, force: true });
  }
});

test('v2 sidebar-client enforces zero-empty-screen circuit breaker, honest non-fake session reservation, PSP proxy, and clean destroy', async () => {
  const clientSrc = fs.readFileSync(CLIENT_FILE, 'utf8');
  assert.doesNotThrow(() => new vm.Script(clientSrc));

  function makeEl(tag) {
    const attrs = new Map();
    const classes = new Set();
    const listeners = new Map();
    const el = {
      tagName: String(tag).toUpperCase(),
      nodeName: String(tag).toUpperCase(),
      id: '',
      textContent: '',
      value: '',
      style: {},
      children: [],
      parentElement: null,
      get firstChild() { return this.children[0] || null; },
      get firstElementChild() { return this.children[0] || null; },
      get className() { return [...classes].join(' '); },
      set className(v) {
        classes.clear();
        for (const c of String(v || '').split(/\s+/).filter(Boolean)) classes.add(c);
      },
      classList: {
        add: (...cs) => cs.forEach((c) => classes.add(c)),
        remove: (...cs) => cs.forEach((c) => classes.delete(c)),
        contains: (c) => classes.has(c),
      },
      setAttribute(k, v) { attrs.set(k, String(v)); if (k === 'id') this.id = String(v); },
      getAttribute(k) { return attrs.has(k) ? attrs.get(k) : null; },
      removeAttribute(k) { attrs.delete(k); },
      appendChild(child) {
        if (child.parentElement) child.parentElement.removeChild(child);
        child.parentElement = this;
        this.children.push(child);
        return child;
      },
      insertBefore(child, ref) {
        if (child.parentElement) child.parentElement.removeChild(child);
        child.parentElement = this;
        const idx = this.children.indexOf(ref);
        if (idx >= 0) this.children.splice(idx, 0, child);
        else this.children.push(child);
        return child;
      },
      removeChild(child) {
        const idx = this.children.indexOf(child);
        if (idx >= 0) this.children.splice(idx, 1);
        child.parentElement = null;
        return child;
      },
      remove() { if (this.parentElement) this.parentElement.removeChild(this); },
      addEventListener(type, fn) {
        if (!listeners.has(type)) listeners.set(type, []);
        listeners.get(type).push(fn);
      },
      click() {
        const arr = listeners.get('click') || [];
        for (const fn of arr) fn({ stopPropagation() {}, preventDefault() {}, target: this });
      },
      removeEventListener(type, fn) {
        const arr = listeners.get(type);
        if (!arr) return;
        const i = arr.indexOf(fn);
        if (i >= 0) arr.splice(i, 1);
      },
      contains(target) {
        let cur = target;
        while (cur) { if (cur === this) return true; cur = cur.parentElement; }
        return false;
      },
      getBoundingClientRect() { return { left: 0, top: 0, right: 256, bottom: 720, width: 256, height: 720 }; },
      querySelectorAll(sel) {
        const out = [];
        const walk = (n) => {
          for (const c of n.children) {
            if (sel.includes('conversation-row-sidebar') && c.getAttribute('data-testid') === 'conversation-row-sidebar') out.push(c);
            walk(c);
          }
        };
        walk(this);
        return out;
      },
    };
    return el;
  }

  const head = makeEl('head');
  const body = makeEl('body');
  const rootEl = makeEl('div');
  rootEl.setAttribute('id', 'root');
  const layout = makeEl('div');
  const nativeSb = makeEl('aside');
  nativeSb.setAttribute('data-testid', 'conversation-list-sidebar');
  const nativeRow = makeEl('button');
  nativeRow.setAttribute('data-testid', 'conversation-row-sidebar');
  nativeSb.appendChild(nativeRow);
  layout.appendChild(nativeSb);
  const mainEl = makeEl('main');
  layout.appendChild(mainEl);
  rootEl.appendChild(layout);
  body.appendChild(rootEl);

  const pspCalls = [];
  const routerNavCalls = [];
  const fakeSummaries = {};
  const fakeStore = {
    getState: () => ({
      trajectorySummaries: { summaries: fakeSummaries },
      models: {
        visibleModelConfigs: [
          { label: 'Gemini 4 Neon (High)', tagDescription: 'For most deep reasoning and complex problems' },
          { label: 'Gemini 4 Neon (XHigh)', tagDescription: 'For most deep reasoning and complex problems' },
          { label: 'Gemini 4 Carbon (High)', tagDescription: 'For your hardest, long-horizon tasks' },
          { label: 'Gemini 4 Argon (High)', tagDescription: 'The original Gemini 4 model for advanced workflows' },
          { label: 'Gemini 4 Hydrogen (XHigh)', tagDescription: 'For speed and efficiency in execution tasks' },
          { label: 'Gemini 3.8 Flash (Medium)', tagDescription: '' },
          { label: 'Orchestrator (Neon)', tagDescription: 'Should be excluded' },
          { label: 'Claude Opus 5.5 (High)', tagDescription: 'Should be excluded' },
          { label: 'GPT-OSS 120B (Medium)', tagDescription: 'Should be excluded' },
        ],
      },
    }),
    subscribe: () => () => {},
  };
  const fakeRouter = {
    state: { location: { pathname: '/' } },
    navigate: (arg) => { routerNavCalls.push(arg); },
    subscribe: () => () => {},
  };
  const fakePsp = {
    getProjectPermissionGrants: async () => ({ autoExecutionPolicy: 'ask', fileAccessPolicy: 'ask-outside' }),
    setProjectAutoExecutionPolicy: async (s, v) => { pspCalls.push(['auto', s, v]); },
    setProjectFileAccessPolicy: async (s, v) => { pspCalls.push(['file', s, v]); },
  };
  rootEl.__reactFiber$test = {
    tag: 10,
    memoizedProps: { value: { store: fakeStore } },
    child: {
      tag: 10,
      memoizedProps: { value: { getState: () => ({ projectSettingsProvider: fakePsp }), onDidChange: () => () => {} } },
      child: {
        tag: 10,
        memoizedProps: { value: fakeRouter },
      },
    },
  };

  const docEl = makeEl('html');
  const doc = {
    head,
    body,
    documentElement: docEl,
    hidden: false,
    activeElement: null,
    createElement: (t) => makeEl(t),
    createElementNS: (_ns, t) => makeEl(t),
    importNode: (n) => n,
    getElementById: (id) => {
      const find = (n) => {
        if (n.id === id) return n;
        for (const c of n.children) { const r = find(c); if (r) return r; }
        return null;
      };
      return find(head) || find(body);
    },
    querySelector: (sel) => {
      if (sel === '[data-testid="conversation-list-sidebar"]') return nativeSb;
      if (sel === 'main') return mainEl;
      return null;
    },
    querySelectorAll: () => [],
    addEventListener: () => {},
    removeEventListener: () => {},
  };

  let activeSnap = {
    schemaVersion: 2,
    storeId: 'store-vm',
    rev: 1,
    navRev: 1,
    draftRev: 1,
    activeMode: 'code',
    currentView: '/',
    chatDraft: { kind: 'knowledge', folderId: null, sparkProjectId: null },
    assignments: {},
    knowledgeFolders: [],
    sparkProjects: [],
    chatSidebar: {
      knowledge: { rootItems: [{ cascadeId: 'chat-demo-1', title: 'Chat Demo', status: 'idle' }], folders: [] },
      spark: { projects: [] },
    },
  };

  const win = {
    innerWidth: 1280,
    innerHeight: 800,
    document: doc,
    navigator: { language: 'ar' },
    getComputedStyle: () => ({ position: 'static' }),
    __agPrismSidebarBridge: {
      isOnline: () => true,
      call: async (req) => {
        if (req.action === 'switch-mode') {
          activeSnap = { ...activeSnap, activeMode: req.payload.to, rev: activeSnap.rev + 1 };
          return { ok: true, result: { view: req.payload.to === 'chat' ? '/c/chat-demo-1' : '/' }, snapshot: activeSnap };
        }
        return { ok: true, snapshot: activeSnap };
      },
    },
    setTimeout,
    clearTimeout,
  };
  win.window = win;
  win.globalThis = win;

  vm.runInNewContext(clientSrc, {
    window: win,
    globalThis: win,
    document: doc,
    navigator: win.navigator,
    getComputedStyle: win.getComputedStyle,
    setTimeout,
    clearTimeout,
  });

  await new Promise((r) => setTimeout(r, 40));
  assert.equal(win.__agPrismSidebar.getState().engaged, false);
  assert.equal(nativeSb.classList.contains('ag-prism-sb-native-hidden'), false);
  assert.equal(layout.children.find((c) => c.getAttribute('data-testid') === 'prism-bipolar-mode-dock'), undefined);

  win.__agPrismSidebar.sync({ sidebarStudio: 'on' });
  await new Promise((r) => setTimeout(r, 40));
  assert.equal(win.__agPrismSidebar.getState().circuitTripped, true);
  assert.equal(win.__agPrismSidebar.getState().engaged, false);
  assert.equal(nativeSb.classList.contains('ag-prism-sb-native-hidden'), false);

  assert.deepEqual(Array.from(win.__agPrismSidebar.getState().models), [
    'Gemini 4 Neon',
    'Gemini 4 Carbon',
    'Gemini 4 Argon',
    'Gemini 4 Hydrogen',
    'Gemini 3.8 Flash',
  ]);

  const resv = await win.__agPrismSidebarHostOps.reserveSession({ idempotencyKey: 'k1', scopeRef: 's1', kind: 'knowledge' });
  assert.equal(resv.ok, false);

  const pspRes = await win.__agPrismSidebarHostOps.psp.setProjectAutoExecutionPolicy({ scopeRef: 'scope-1', value: 'off' });
  assert.equal(pspRes.ok, true);
  assert.deepEqual(pspCalls, [['auto', 'scope-1', 'off']]);

  fakeSummaries['code-real-1'] = { summary: 'Real Code Task', lastModifiedTime: Date.now() };
  win.__agPrismSidebar.sync({ sidebarStudio: 'on' });
  await new Promise((r) => setTimeout(r, 180));
  assert.equal(win.__agPrismSidebar.getState().circuitTripped, false);
  assert.equal(win.__agPrismSidebar.getState().engaged, true);
  assert.equal(nativeSb.classList.contains('ag-prism-sb-native-hidden'), false);
  const modeDockBefore = layout.children.find((c) => c.getAttribute('data-testid') === 'prism-bipolar-mode-dock');
  assert.ok(modeDockBefore);

  const chatBtn = modeDockBefore.children[0].children[2];
  assert.equal(chatBtn.getAttribute('data-mode-btn'), 'chat');
  const betaPill = chatBtn.children.find((c) => c.className && c.className.includes('ag-prism-sb-beta-pill'));
  assert.ok(betaPill && /Beta/i.test(betaPill.textContent));
  chatBtn.click();
  await new Promise((r) => setTimeout(r, 40));
  const modeDockAfter = layout.children.find((c) => c.getAttribute('data-testid') === 'prism-bipolar-mode-dock');
  assert.equal(modeDockAfter, modeDockBefore);
  assert.equal(nativeSb.classList.contains('ag-prism-sb-native-hidden'), true);
  assert.deepEqual(
    JSON.parse(JSON.stringify(routerNavCalls[routerNavCalls.length - 1])),
    { to: '/c/$cascadeId', params: { cascadeId: 'chat-demo-1' } }
  );

  const chatPane = layout.children.find((c) => c.getAttribute('data-testid') === 'prism-bipolar-chat-pane');
  assert.equal(chatPane.getAttribute('data-active'), '1');
  const codeBtn = modeDockBefore.children[0].children[1];
  codeBtn.click();
  await new Promise((r) => setTimeout(r, 40));
  assert.equal(nativeSb.classList.contains('ag-prism-sb-native-hidden'), false);
  assert.deepEqual(JSON.parse(JSON.stringify(routerNavCalls[routerNavCalls.length - 1])), { to: '/' });

  win.__agPrismSidebar.sync({ sidebarStudio: 'off' });
  assert.equal(win.__agPrismSidebar.getState().engaged, false);
  assert.equal(nativeSb.classList.contains('ag-prism-sb-native-hidden'), false);
  assert.equal(layout.children.find((c) => c.getAttribute('data-testid') === 'prism-bipolar-mode-dock'), undefined);
  win.__agPrismSidebar.sync({ sidebarStudio: 'on' });
  assert.equal(win.__agPrismSidebar.getState().engaged, true);
  assert.ok(layout.children.find((c) => c.getAttribute('data-testid') === 'prism-bipolar-mode-dock'));

  win.__agPrismSidebar.destroy();
  assert.equal(nativeSb.classList.contains('ag-prism-sb-native-hidden'), false);
  assert.equal(doc.getElementById('ag-prism-sidebar-studio-css'), null);
  assert.equal(win.__agPrismSidebarHostOps, undefined);
  assert.equal(win.__agPrismSidebar, undefined);
});

test('cdp.buildSidebarStudioExpression builds clean v2 bridge without legacy v1 write shortcuts and rejects unsafe client sources', () => {
  const cdp = require('../cdp.js');
  const expr = cdp.buildSidebarStudioExpression({ binding: SIDEBAR_BINDING, schemaVersion: 2, serviceReady: true });
  assert.doesNotThrow(() => new vm.Script(expr));
  assert.ok(expr.includes('SIDEBAR_STUDIO_CLIENT_V2'));
  assert.ok(expr.includes('delete window.__agPrismSidebar'));
  assert.ok(expr.includes('!existing.destroyed'));
  assert.equal(expr.includes('setActiveSpace'), false);
  assert.equal(expr.includes('setAssignment'), false);
  assert.equal(expr.includes('bulkAssign'), false);
  assert.equal(expr.includes('setSpaceTheme'), false);
  assert.equal(/setPrefValues?/i.test(expr), false);

  const sneakyExpr = cdp.buildSidebarStudioExpression(
    { binding: SIDEBAR_BINDING, schemaVersion: 2, serviceReady: true },
    'const SIDEBAR_STUDIO_CLIENT_V2 = "2.0.0"; ops["setPrefValue"]("global", 1);'
  );
  assert.equal(sneakyExpr.includes('SIDEBAR_STUDIO_CLIENT_V2'), false);
  assert.equal(/setPrefValues?/i.test(sneakyExpr), false);
});

test('v2 sidebar-client bridges real native 4-getter PSP protobuf enums and lsClient startCascade/sendUserCascadeMessage', async () => {
  const clientCode = fs.readFileSync(CLIENT_FILE, 'utf8');
  const startCalls = [];
  const sendCalls = [];
  const dispatched = [];
  const pspState = {
    'proj-uuid-spark': { auto: 2, file: 1, net: 1, sandbox: false },
  };
  const fakePsp = {
    getProjectAutoExecutionPolicy: async (pid) => pspState[pid]?.auto ?? 0,
    getProjectFileAccessPolicy: async (pid) => pspState[pid]?.file ?? 0,
    getProjectInternetPolicy: async (pid) => pspState[pid]?.net ?? 0,
    getProjectSandboxMode: async (pid) => Boolean(pspState[pid]?.sandbox),
    setProjectAutoExecutionPolicy: async (pid, v) => { pspState[pid].auto = v; },
    setProjectFileAccessPolicy: async (pid, v) => { pspState[pid].file = v; },
    setProjectInternetPolicy: async (pid, v) => { pspState[pid].net = v; },
    setProjectSandboxMode: async (pid, v) => { pspState[pid].sandbox = v; },
  };
  const fakeLsClient = {
    startCascade: async (req) => {
      startCalls.push(req);
      return { cascadeId: req.cascadeId };
    },
    sendUserCascadeMessage: async (req) => {
      sendCalls.push(req);
      return {};
    },
  };
  const fakeProjects = [
    {
      project: {
        id: 'proj-uuid-spark',
        name: 'SparkDemo',
        projectResources: {
          resources: [{ type: { case: 'gitFolder', value: { folderUri: 'file:///c%3A/temp/SparkDemo' } } }],
        },
      },
    },
  ];
  const makeNode = (tag) => {
    const attrs = new Map();
    const n = {
      tagName: String(tag || 'DIV').toUpperCase(),
      nodeName: String(tag || 'DIV').toUpperCase(),
      children: [],
      style: {},
      classList: { add() {}, remove() {}, contains() { return false; } },
      setAttribute(k, v) { attrs.set(k, String(v)); },
      getAttribute(k) { return attrs.has(k) ? attrs.get(k) : null; },
      removeAttribute(k) { attrs.delete(k); },
      appendChild(c) { c.parentElement = n; n.children.push(c); return c; },
      insertBefore(c) { c.parentElement = n; n.children.push(c); return c; },
      remove() {},
      addEventListener() {},
      removeEventListener() {},
      querySelector() { return null; },
      querySelectorAll() { return []; },
      getBoundingClientRect() { return { width: 240, height: 600, top: 0, left: 0, bottom: 600, right: 240 }; },
      get firstChild() { return n.children[0] || null; },
    };
    return n;
  };
  const rootEl = makeNode('div');
  rootEl.id = 'root';
  rootEl.__reactFiber$native = {
    tag: 10,
    memoizedProps: {
      value: {
        store: {
          getState: () => ({
            trajectorySummaries: { summaries: {} },
            userStatus: {
              cascadeModelConfigData: {
                clientModelConfigs: [
                  { label: 'Gemini 4 Neon (High)', modelOrAlias: { choice: { case: 'model', value: 1532 } } },
                  { label: 'Gemini 4 Hydrogen (XHigh)', modelOrAlias: { choice: { case: 'model', value: 1528 } } },
                  { label: 'Gemini 3.8 Flash (Medium)', modelOrAlias: { choice: { case: 'model', value: 1602 } } },
                ],
              },
            },
          }),
          subscribe: () => () => {},
          dispatch: (act) => dispatched.push(act),
        },
      },
    },
    sibling: {
      tag: 10,
      memoizedProps: { value: { getState: () => ({ projectSettingsProvider: fakePsp }), onDidChange: () => () => {} } },
      sibling: {
        tag: 10,
        memoizedProps: {
          value: {
            core: {
              projectManagementService: {
                projectsStateProvider: { getState: () => fakeProjects },
                lsClient: fakeLsClient,
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
    addEventListener() {},
    removeEventListener() {},
  };
  const win = {
    document: doc,
    innerWidth: 1440,
    innerHeight: 900,
    location: { pathname: '/' },
    getComputedStyle: () => ({ position: 'relative' }),
    __agPrismSidebarBridge: { isOnline: () => false, call: async () => ({ ok: false }) },
  };
  vm.runInNewContext(clientCode, {
    window: win,
    globalThis: win,
    document: doc,
    crypto: globalThis.crypto,
    getComputedStyle: win.getComputedStyle,
    setTimeout,
    clearTimeout,
  });

  win.__agPrismSidebar.sync({ sidebarStudio: 'on' });
  const ops = win.__agPrismSidebarHostOps;
  assert.equal(ops.getCapabilities().projectPermissions, true);
  assert.equal(ops.getCapabilities().perCascadeIsolation, true);

  const grants = await ops.psp.getProjectPermissionGrants({ scopeRef: 'spark-scope-1', dirPath: 'C:\\temp\\SparkDemo' });
  assert.equal(grants.ok, true);
  assert.deepEqual(JSON.parse(JSON.stringify(grants.grants)), {
    autoExecutionPolicy: 'auto',
    fileAccessPolicy: 'allow-all',
    internetPolicy: 'allow',
    sandboxMode: 'off',
  });
  assert.equal((await ops.psp.setProjectAutoExecutionPolicy({ scopeRef: 'spark-scope-1', dirPath: 'C:\\temp\\SparkDemo', value: 'off' })).ok, true);
  assert.equal((await ops.psp.setProjectFileAccessPolicy({ scopeRef: 'spark-scope-1', dirPath: 'C:\\temp\\SparkDemo', value: 'ask-outside' })).ok, true);
  assert.equal((await ops.psp.setProjectSandboxMode({ scopeRef: 'spark-scope-1', dirPath: 'C:\\temp\\SparkDemo', value: 'enabled' })).ok, true);
  assert.deepEqual(pspState['proj-uuid-spark'], { auto: 1, file: 2, net: 1, sandbox: true });

  const resv = await ops.reserveSession({
    idempotencyKey: 'idem-live-1:reserve',
    scopeRef: 'scope-knowledge-default',
    kind: 'knowledge',
    title: 'مرحبًا',
    dirPath: '',
    modelId: 'Gemini 4 Hydrogen',
    effort: 'XHigh',
  });
  assert.equal(resv.ok, true);
  assert.equal(startCalls.length, 1);
  assert.equal(startCalls[0].source, 1);
  assert.deepEqual(Array.from(startCalls[0].workspaceUris), []);
  assert.equal(startCalls[0].requestedModel, 1528);

  const deliv = await ops.deliverFirstMessage({
    idempotencyKey: 'idem-live-1:send',
    cascadeId: resv.cascadeId,
    message: 'مرحبًا',
    scopeRef: 'scope-knowledge-default',
    kind: 'knowledge',
    dirPath: '',
    modelId: 'Gemini 4 Hydrogen',
    effort: 'XHigh',
  });
  assert.equal(deliv.status, 'delivered');
  assert.equal(sendCalls.length, 1);
  assert.equal(sendCalls[0].cascadeId, resv.cascadeId);
  assert.deepEqual(JSON.parse(JSON.stringify(sendCalls[0].items)), [{ chunk: { case: 'text', value: 'مرحبًا' } }]);
  assert.equal(sendCalls[0].cascadeConfig.plannerConfig.planModel, 1528);
  assert.equal(sendCalls[0].cascadeConfig.plannerConfig.toolConfig.runCommand.autoCommandConfig.autoExecutionPolicy, 1);
  assert.equal(dispatched.some((a) => a.type === 'modelSelection/modelPicked' && a.payload?.model === 1528), true);

  win.__agPrismSidebar.destroy();
});

test('non-sandbox boot self-heals zero-write needs-reconciliation and sends Knowledge via per-cascade isolation while keeping written scopes locked', async (t) => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ag-prism-live-heal-'));
  t.after(() => fs.rmSync(tmpDir, { recursive: true, force: true }));
  const knowledgeDir = path.join(tmpDir, 'knowledge-space');
  const sparkDir = path.join(tmpDir, 'spark-locked');
  fs.mkdirSync(knowledgeDir, { recursive: true });
  fs.mkdirSync(sparkDir, { recursive: true });
  const statePath = path.join(tmpDir, 'obsidian-prism-sidebar.json');

  const { createDefaultStateV2 } = await import('../vendor/sidebar-studio/state-machine.mjs');
  const seeded = createDefaultStateV2({ storeId: 'store-live-heal', sparkRoot: tmpDir, knowledgeRoot: knowledgeDir });
  seeded.activeMode = 'chat';
  seeded.sparkProjects = [{ id: 'sp-locked', name: 'LockedSpark', scopeRef: 'scope-spark-locked', collapsed: false }];
  seeded.projectScopes = {
    'scope-knowledge-default': {
      scopeRef: 'scope-knowledge-default',
      kind: 'knowledge',
      displayName: 'Knowledge Space',
      realPath: fs.realpathSync(knowledgeDir),
      scopeGeneration: 1,
      permissionStatus: 'needs-reconciliation',
      degraded: false,
      baseline: null,
      applied: null,
    },
    'scope-spark-locked': {
      scopeRef: 'scope-spark-locked',
      kind: 'spark',
      displayName: 'LockedSpark',
      realPath: fs.realpathSync(sparkDir),
      scopeGeneration: 1,
      permissionStatus: 'needs-reconciliation',
      degraded: false,
      baseline: { autoExecutionPolicy: 'auto', fileAccessPolicy: 'allow-all' },
      applied: { autoExecutionPolicy: 'off' },
    },
  };
  seeded.operations = {
    'op-stale-zero-write': {
      operationId: 'op-stale-zero-write',
      kind: 'send-chat-first',
      status: 'needs-reconciliation',
      phase: 'created',
      scopeRef: 'scope-knowledge-default',
      cascadeId: null,
      createdAt: 1000,
      updatedAt: 1000,
    },
  };
  fs.writeFileSync(statePath, JSON.stringify(seeded), 'utf8');

  const liveCalls = [];
  const adapter = createLiveHostAdapter({
    evaluateInHost: async (expr) => {
      if (expr.includes('"reserveSession"')) {
        liveCalls.push('reserve');
        return { ok: true, cascadeId: 'live-uuid-001', hidden: true, replayed: false };
      }
      if (expr.includes('"deliverFirstMessage"')) {
        liveCalls.push('deliver');
        return { status: 'delivered', cascadeId: 'live-uuid-001', replayed: false };
      }
      return { ok: false, error: 'unexpected-op' };
    },
  });
  adapter.syncFromRenderer({
    catalog: { health: 'ready', items: [{ cascadeId: 'code-1', title: 'Code Task', status: 'idle', updatedAt: Date.now() }] },
    codeWorkspacePaths: [],
    hostProjects: [{ id: 'proj-locked', name: 'LockedSpark', path: fs.realpathSync(sparkDir) }],
    capabilities: { projectPermissions: true, perCascadeIsolation: true, sessionRebind: false, sandboxAvailable: false, wslAvailable: false, artifactsAvailable: true },
  });

  const svc = new SidebarStudioService({
    sandboxMode: false,
    statePath,
    sparkRoot: tmpDir,
    knowledgeRoot: knowledgeDir,
    hostAdapter: adapter,
  });
  t.after(() => svc.dispose());

  const sent = await svc.handleRpcAction('send-chat-first', {
    message: 'مرحبًا',
    modelId: 'Gemini 4 Hydrogen',
    effort: 'XHigh',
  });
  assert.equal(sent.ok, true);
  assert.equal(sent.result.status, 'succeeded');
  assert.equal(sent.result.cascadeId, 'live-uuid-001');
  assert.equal(sent.snapshot.currentView, '/c/live-uuid-001');
  assert.deepEqual(liveCalls, ['reserve', 'deliver']);
  assert.equal(adapter.getAuditReport().globalPermissionWrites, 0);
  assert.equal(adapter.getAuditReport().projectPermissionWrites, 0);

  await svc.handleRpcAction('navigate', { mode: 'chat', view: '/' });
  await svc.handleRpcAction('set-chat-draft', { draft: { kind: 'spark', folderId: null, sparkProjectId: 'sp-locked' } });
  const blocked = await svc.handleRpcAction('send-chat-first', { message: 'Should remain locked' });
  assert.equal(blocked.ok, false);
  assert.equal(blocked.error?.code, ERROR_CODES.NEEDS_RECONCILIATION);
});

test('Chat sidebar full CRUD: pin/rename/archive/restore/delete sessions and folder/Spark deletion with archive or delete childAction', async (t) => {
  const svc = createStudioSandboxService();
  t.after(() => svc.dispose());
  await svc.handleRpcAction('switch-mode', { to: 'chat' });

  const f1 = await svc.handleRpcAction('create-knowledge-folder', { name: 'Reading Notes' });
  assert.equal(f1.ok, true);
  const fid = f1.result.folder.id;
  await svc.handleRpcAction('set-chat-draft', { draft: { kind: 'knowledge', folderId: fid, sparkProjectId: null } });
  const m1 = await svc.handleRpcAction('send-chat-first', { message: 'First note' });
  assert.equal(m1.ok, true);
  const cid1 = m1.result.cascadeId;

  await svc.handleRpcAction('navigate', { mode: 'chat', view: '/' });
  await svc.handleRpcAction('set-chat-draft', { draft: { kind: 'knowledge', folderId: fid, sparkProjectId: null } });
  const m2 = await svc.handleRpcAction('send-chat-first', { message: 'Second note' });
  assert.equal(m2.ok, true);
  const cid2 = m2.result.cascadeId;

  assert.equal((await svc.handleRpcAction('pin-chat-session', { cascadeId: cid1, pinned: true })).ok, true);
  assert.equal((await svc.handleRpcAction('rename-chat-session', { cascadeId: cid1, title: 'Pinned Note' })).ok, true);
  const folderView = svc.getSnapshot().chatSidebar.knowledge.folders.find((f) => f.id === fid);
  assert.equal(folderView.items[0].cascadeId, cid1);
  assert.equal(folderView.items[0].pinned, true);
  assert.equal(folderView.items[0].title, 'Pinned Note');

  const archRes = await svc.handleRpcAction('archive-chat-session', { cascadeId: cid2, archived: true });
  assert.equal(archRes.ok, true);
  assert.equal(archRes.result.navigatedFallback, true);
  assert.equal(archRes.snapshot.currentView, '/');
  assert.equal(archRes.snapshot.chatSidebar.archived.items.some((x) => x.cascadeId === cid2), true);

  assert.equal((await svc.handleRpcAction('archive-chat-session', { cascadeId: cid2, archived: false })).ok, true);
  const delFoldArch = await svc.handleRpcAction('delete-knowledge-folder', { folderId: fid, childAction: 'archive' });
  assert.equal(delFoldArch.ok, true);
  assert.equal(delFoldArch.result.archivedSessionIds.length, 2);
  assert.equal(delFoldArch.snapshot.chatSidebar.archived.totalCount, 2);

  const delOne = await svc.handleRpcAction('delete-chat-session', { cascadeId: cid1 });
  assert.equal(delOne.ok, true);
  assert.equal(delOne.snapshot.chatSidebar.archived.totalCount, 1);

  const box = await svc.handleRpcAction('create-spark-box', { name: 'ScratchBox' });
  await svc.handleRpcAction('select-spark-project', { selectionToken: box.result.selectionToken });
  const spId = svc.getSnapshot().chatDraft.sparkProjectId;
  const sm = await svc.handleRpcAction('send-chat-first', { message: 'Spark task' });
  assert.equal(sm.ok, true);
  const spCid = sm.result.cascadeId;

  const delSp = await svc.handleRpcAction('unlink-spark-project', { sparkProjectId: spId, childAction: 'delete' });
  assert.equal(delSp.ok, true);
  assert.deepEqual(delSp.result.deletedSessionIds, [spCid]);
  assert.equal(delSp.snapshot.assignments[spCid], undefined);
  assert.equal(delSp.snapshot.currentView, '/');
  assert.equal(svc.getPermissionAudit().globalPermissionWrites, 0);
});

test('v2 sidebar-client enforces web-like Knowledge/Spark MCP+hooks+tools isolation and guards follow-up Chat sends without touching Code', async () => {
  const clientCode = fs.readFileSync(CLIENT_FILE, 'utf8');
  const startCalls = [];
  const rawSendCalls = [];
  const wrapperSendCalls = [];
  const fakeLsClient = {
    startCascade: async (req) => { startCalls.push(req); return { cascadeId: req.cascadeId }; },
    sendUserCascadeMessage: async (req) => { rawSendCalls.push(req); return {}; },
    updateConversationAnnotations: async () => ({}),
    deleteCascadeTrajectory: async () => ({}),
  };
  const fakeLsWrapper = {
    startCascade: async (req) => ({ cascadeId: req.cascadeId }),
    sendUserCascadeMessage: async (req) => { wrapperSendCalls.push(req); return {}; },
    deleteCascadeTrajectory: async () => ({}),
    updateConversationAnnotations: async () => ({}),
  };
  const makeNode = (tag) => ({
    tagName: String(tag || 'DIV').toUpperCase(),
    nodeName: String(tag || 'DIV').toUpperCase(),
    children: [],
    style: {},
    classList: { add() {}, remove() {}, contains() { return false; } },
    setAttribute() {},
    getAttribute() { return null; },
    removeAttribute() {},
    appendChild(c) { this.children.push(c); return c; },
    insertBefore(c) { this.children.push(c); return c; },
    remove() {},
    addEventListener() {},
    removeEventListener() {},
    querySelector() { return null; },
    querySelectorAll() { return []; },
    getBoundingClientRect() { return { width: 240, height: 600, top: 0, left: 0, bottom: 600, right: 240 }; },
    get firstChild() { return this.children[0] || null; },
  });
  const rootEl = makeNode('div');
  rootEl.id = 'root';
  rootEl.__reactFiber$iso = {
    tag: 10,
    memoizedProps: {
      value: {
        store: {
          getState: () => ({ trajectorySummaries: { summaries: {} }, userStatus: { cascadeModelConfigData: { clientModelConfigs: [] } } }),
          subscribe: () => () => {},
          dispatch: () => {},
        },
      },
    },
    sibling: {
      tag: 10,
      memoizedProps: { value: fakeLsWrapper },
      sibling: {
        tag: 10,
        memoizedProps: {
          value: { core: { projectManagementService: { projectsStateProvider: { getState: () => [] }, lsClient: fakeLsClient } } },
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
    addEventListener() {},
    removeEventListener() {},
  };
  const win = {
    document: doc,
    innerWidth: 1440,
    innerHeight: 900,
    location: { pathname: '/' },
    getComputedStyle: () => ({ position: 'relative' }),
    __agPrismSidebarBridge: {
      isOnline: () => true,
      call: async () => ({
        ok: true,
        snapshot: {
          storeId: 's1',
          rev: 1,
          navRev: 1,
          draftRev: 1,
          activeMode: 'chat',
          currentView: '/',
          chatDraft: { kind: 'knowledge', folderId: null, sparkProjectId: null },
          assignments: {
            'chat-know-1': { mode: 'chat', placement: { kind: 'knowledge', folderId: null }, continuation: 'ready' },
            'chat-spark-1': { mode: 'chat', placement: { kind: 'spark', sparkProjectId: 'sp1' }, continuation: 'ready' },
          },
          knowledgeFolders: [],
          sparkProjects: [],
          chatSidebar: { knowledge: { rootItems: [], folders: [] }, spark: { projects: [] }, archived: { items: [], totalCount: 0 } },
          catalogHealth: 'ready',
          capabilities: { projectPermissions: true, perCascadeIsolation: true },
        },
      }),
    },
  };
  vm.runInNewContext(clientCode, {
    window: win,
    globalThis: win,
    document: doc,
    crypto: globalThis.crypto,
    getComputedStyle: win.getComputedStyle,
    setTimeout,
    clearTimeout,
  });
  win.__agPrismSidebar.sync({ sidebarStudio: 'on' });
  await new Promise((r) => setTimeout(r, 40));

  assert.equal(win.__agPrismSidebar.getState().hasSendGuard, true);

  const resv = await win.__agPrismSidebarHostOps.reserveSession({
    idempotencyKey: 'iso-k1:r', scopeRef: 'scope-knowledge-default', kind: 'knowledge', title: 'Hi', dirPath: '',
  });
  assert.equal(resv.ok, true);
  assert.equal(startCalls[0].customAgentSpec.config.case, 'customAgent');
  assert.equal(startCalls[0].customAgentSpec.config.value.excludeDefaultComponents, true);
  assert.ok(startCalls[0].customAgentSpec.config.value.toolNames.includes('search_web'));
  assert.ok(!startCalls[0].customAgentSpec.config.value.toolNames.includes('write_file'));
  assert.equal(startCalls[0].customAgentSpec.customizationConfig.enableJsonHooks, false);
  assert.equal(startCalls[0].customAgentSpec.cascadeConfig.plannerConfig.customizationDiscoveryConfig.hooks.inheritUser, false);
  assert.equal(startCalls[0].customAgentSpec.cascadeConfig.plannerConfig.customizationDiscoveryConfig.mcp.inheritUser, false);
  assert.equal(startCalls[0].customAgentSpec.cascadeConfig.plannerConfig.customizationDiscoveryConfig.plugins.inheritUser, false);
  assert.equal(startCalls[0].customAgentSpec.cascadeConfig.plannerConfig.toolConfig.runCommand.forceDisable, true);
  assert.equal(startCalls[0].customAgentSpec.cascadeConfig.plannerConfig.toolConfig.writeToFile.forceDisable, true);
  assert.equal(startCalls[0].customAgentSpec.cascadeConfig.plannerConfig.toolConfig.searchWeb.forceDisable, false);

  const codeReq = { cascadeId: 'code-session-99', cascadeConfig: { $typeName: 'exa.cortex_pb.CascadeConfig', plannerConfig: { supportsLatexRendering: true } } };
  await fakeLsWrapper.sendUserCascadeMessage(codeReq);
  assert.equal(wrapperSendCalls[0], codeReq);

  await fakeLsWrapper.sendUserCascadeMessage({
    cascadeId: 'chat-know-1',
    cascadeConfig: { $typeName: 'exa.cortex_pb.CascadeConfig', plannerConfig: { $typeName: 'exa.cortex_pb.CascadePlannerConfig', planModel: 1528 } },
  });
  const patchedKnow = wrapperSendCalls[1];
  assert.equal(patchedKnow.cascadeConfig.$typeName, undefined);
  assert.equal(patchedKnow.cascadeConfig.plannerConfig.planModel, 1528);
  assert.equal(patchedKnow.cascadeConfig.plannerConfig.plannerTypeConfig.case, 'customAgent');
  assert.equal(patchedKnow.cascadeConfig.plannerConfig.plannerTypeConfig.value.excludeDefaultComponents, true);
  assert.equal(patchedKnow.cascadeConfig.plannerConfig.toolConfig.mcp.forceDisable, true);
  assert.equal(patchedKnow.cascadeConfig.plannerConfig.toolConfig.writeToFile.forceDisable, true);
  assert.equal(patchedKnow.cascadeConfig.plannerConfig.customizationDiscoveryConfig.hooks.inheritUser, false);

  await fakeLsWrapper.sendUserCascadeMessage({
    cascadeId: 'chat-spark-1',
    cascadeConfig: { plannerConfig: { planModel: 1532 } },
  });
  const patchedSpark = wrapperSendCalls[2];
  assert.equal(patchedSpark.cascadeConfig.plannerConfig.toolConfig.mcp.forceDisable, true);
  assert.equal(patchedSpark.cascadeConfig.plannerConfig.toolConfig.invokeSubagent.enabled, false);
  assert.equal(patchedSpark.cascadeConfig.plannerConfig.toolConfig.writeToFile.forceDisable, false);
  assert.equal(patchedSpark.cascadeConfig.plannerConfig.toolConfig.schedule.enabled, true);
  assert.equal(patchedSpark.cascadeConfig.plannerConfig.toolConfig.runCommand.forceDisable, undefined);
  assert.equal(patchedSpark.cascadeConfig.plannerConfig.toolConfig.runCommand.autoCommandConfig.autoExecutionPolicy, 1);

  const origFnBeforeDestroy = fakeLsWrapper.sendUserCascadeMessage;
  win.__agPrismSidebar.destroy();
  assert.notEqual(fakeLsWrapper.sendUserCascadeMessage, origFnBeforeDestroy);
});

test('prefs.chatPolicy persists Pure/Spark whitelist toggles atomically with sanitization and backward compatibility', async (t) => {
  const env = makeTempEnv();
  t.after(() => fs.rmSync(env.root, { recursive: true, force: true }));
  const svc = new SidebarStudioService({ sandboxMode: true, sandboxRoot: env.root, ...env });
  t.after(() => svc.dispose());

  const initialPolicy = svc.getSnapshot().prefs.chatPolicy;
  assert.equal(initialPolicy.pure.webSearch, true);
  assert.equal(initialPolicy.pure.zeroTools, false);
  assert.deepEqual(initialPolicy.pure.allowedPlugins, []);
  assert.equal(initialPolicy.spark.schedule, true);
  assert.equal(initialPolicy.spark.sandbox, true);
  assert.equal(initialPolicy.showTelemetryAboveComposer, true);

  const res1 = await svc.handleRpcAction('set-prefs', {
    patch: {
      chatPolicy: {
        pure: {
          zeroTools: false,
          allowedPlugins: ['companion-pack', 'COMPANION-PACK', 'bad\nname', '   '],
          allowedMcps: ['docs-mcp'],
        },
        showTelemetryAboveComposer: false,
      },
    },
  });
  assert.equal(res1.ok, true);
  assert.deepEqual(res1.snapshot.prefs.chatPolicy.pure.allowedPlugins, ['companion-pack']);
  assert.deepEqual(res1.snapshot.prefs.chatPolicy.pure.allowedMcps, ['docs-mcp']);
  assert.equal(res1.snapshot.prefs.chatPolicy.spark.schedule, true);
  assert.equal(res1.snapshot.prefs.chatPolicy.showTelemetryAboveComposer, false);

  await svc.dispose();
  const reopened = new SidebarStudioService({ sandboxMode: true, sandboxRoot: env.root, ...env });
  t.after(() => reopened.dispose());
  assert.deepEqual(reopened.getSnapshot().prefs.chatPolicy.pure.allowedPlugins, ['companion-pack']);
  assert.deepEqual(reopened.getSnapshot().prefs.chatPolicy.pure.allowedMcps, ['docs-mcp']);
  assert.equal(reopened.getSnapshot().prefs.chatPolicy.showTelemetryAboveComposer, false);
  assert.equal(reopened.getPermissionAudit().globalPermissionWrites, 0);
});

test('v2 sidebar-client dynamically resolves plugin/MCP whitelists and honors Pure zeroTools without hardcoded private names', async () => {
  const clientCode = fs.readFileSync(CLIENT_FILE, 'utf8');
  const startCalls = [];
  const fakeLsClient = {
    getAllPlugins: async () => ({
      plugins: [
        { name: 'companion-plugin', displayName: 'Companion', path: 'file:///C:/plugins/companion', isBuiltin: false, rules: ['a.md'] },
        { name: 'dev-hooks-plugin', displayName: 'Dev Hooks', path: 'file:///C:/plugins/dev-hooks', isBuiltin: false, hooksJson: '{}' },
        { name: 'swarm', displayName: 'Swarm', path: '', isBuiltin: true },
      ],
    }),
    getMcpServerStates: async () => ({
      states: [
        { status: 2, tools: [{ name: 'search_notes' }], spec: { $typeName: 'McpServerSpec', serverName: 'notes-mcp', command: 'node' } },
        { status: 2, tools: [{ name: 'deploy_prod' }], spec: { $typeName: 'McpServerSpec', serverName: 'ops-mcp', command: 'node' } },
      ],
    }),
    startCascade: async (req) => { startCalls.push(req); return { cascadeId: req.cascadeId }; },
    sendUserCascadeMessage: async () => ({}),
  };

  let activePolicy = {
    pure: {
      webSearch: true,
      imageAndFiles: false,
      keepUserRules: true,
      zeroTools: false,
      allowedPlugins: ['companion-plugin'],
      allowedMcps: ['notes-mcp'],
    },
    spark: {
      fileAccess: true,
      schedule: true,
      webSearch: true,
      imageAndFiles: true,
      keepUserRules: true,
      sandbox: true,
      allowedPlugins: [],
      allowedMcps: [],
    },
    showTelemetryAboveComposer: true,
  };

  const makeNode = (tag) => ({
    tagName: String(tag || 'DIV').toUpperCase(),
    nodeName: String(tag || 'DIV').toUpperCase(),
    children: [],
    style: {},
    classList: { add() {}, remove() {}, contains() { return false; } },
    setAttribute() {},
    getAttribute() { return null; },
    removeAttribute() {},
    appendChild(c) { this.children.push(c); return c; },
    insertBefore(c) { this.children.push(c); return c; },
    remove() {},
    addEventListener() {},
    removeEventListener() {},
    querySelector() { return null; },
    querySelectorAll() { return []; },
    getBoundingClientRect() { return { width: 240, height: 600, top: 0, left: 0, bottom: 600, right: 240 }; },
    get firstChild() { return this.children[0] || null; },
  });
  const rootEl = makeNode('div');
  rootEl.id = 'root';
  rootEl.__reactFiber$wl = {
    tag: 10,
    memoizedProps: {
      value: {
        store: {
          getState: () => ({ trajectorySummaries: { summaries: {} }, userStatus: { cascadeModelConfigData: { clientModelConfigs: [] } } }),
          subscribe: () => () => {},
          dispatch: () => {},
        },
      },
    },
    sibling: {
      tag: 10,
      memoizedProps: {
        value: { core: { projectManagementService: { projectsStateProvider: { getState: () => [] }, lsClient: fakeLsClient } } },
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
    addEventListener() {},
    removeEventListener() {},
  };
  const win = {
    document: doc,
    innerWidth: 1440,
    innerHeight: 900,
    location: { pathname: '/' },
    getComputedStyle: () => ({ position: 'relative' }),
    __agPrismSidebarBridge: {
      isOnline: () => true,
      call: async () => ({
        ok: true,
        snapshot: {
          storeId: 's-wl',
          rev: 1,
          navRev: 1,
          draftRev: 1,
          activeMode: 'chat',
          currentView: '/',
          chatDraft: { kind: 'knowledge', folderId: null, sparkProjectId: null },
          assignments: {},
          knowledgeFolders: [],
          sparkProjects: [],
          chatSidebar: { knowledge: { rootItems: [], folders: [] }, spark: { projects: [] }, archived: { items: [], totalCount: 0 } },
          catalogHealth: 'ready',
          capabilities: { projectPermissions: true, perCascadeIsolation: true },
          prefs: { chatPolicy: activePolicy },
        },
      }),
    },
  };
  vm.runInNewContext(clientCode, {
    window: win,
    globalThis: win,
    document: doc,
    crypto: globalThis.crypto,
    getComputedStyle: win.getComputedStyle,
    setTimeout,
    clearTimeout,
  });
  win.__agPrismSidebar.sync({ sidebarStudio: 'on' });
  await new Promise((r) => setTimeout(r, 50));

  await win.__agPrismSidebarHostOps.reserveSession({
    idempotencyKey: 'wl-1:r', scopeRef: 'scope-knowledge-default', kind: 'knowledge', title: 'WL', dirPath: '',
  });
  const spec1 = JSON.parse(JSON.stringify(startCalls[0].customAgentSpec));
  const disc1 = spec1.cascadeConfig.plannerConfig.customizationDiscoveryConfig;
  assert.deepEqual(disc1.plugins.pluginsPaths, [{ path: { case: 'absolute', value: 'C:/plugins/companion' } }]);
  assert.deepEqual(disc1.plugins.builtinPluginNames, []);
  assert.equal(disc1.hooks.inheritUser, false);
  assert.equal(disc1.mcp.servers.length, 1);
  assert.equal(disc1.mcp.servers[0].serverName, 'notes-mcp');
  assert.equal(disc1.mcp.servers[0].$typeName, undefined);
  assert.equal(spec1.cascadeConfig.plannerConfig.toolConfig.mcp.forceDisable, false);
  assert.equal(spec1.cascadeConfig.plannerConfig.toolConfig.generateImage.forceDisable, true);
  assert.ok(spec1.config.value.toolNames.includes('mcp_notes-mcp_search_notes'));

  activePolicy.pure.zeroTools = true;
  await win.__agPrismSidebarHostOps.reserveSession({
    idempotencyKey: 'wl-2:r', scopeRef: 'scope-knowledge-default', kind: 'knowledge', title: 'Zero', dirPath: '',
  });
  const spec2 = JSON.parse(JSON.stringify(startCalls[1].customAgentSpec));
  assert.equal(spec2.cascadeConfig.plannerConfig.toolConfig.forceDisableToolCalling, true);
  assert.equal(spec2.cascadeConfig.plannerConfig.toolConfig.mcp.forceDisable, true);
  assert.deepEqual(spec2.config.value.toolNames, []);
  assert.deepEqual(spec2.cascadeConfig.plannerConfig.customizationDiscoveryConfig.plugins.pluginsPaths, []);

  win.__agPrismSidebar.destroy();
});

test('batch-chat-sessions atomically moves/archives/deletes Chat sessions while skipping running items and never touching Code', async (t) => {
  const svc = createStudioSandboxService();
  t.after(() => svc.dispose());

  await svc.handleRpcAction('switch-mode', { to: 'chat' });
  const fRes = await svc.handleRpcAction('create-knowledge-folder', { name: 'مجلد التنظيم' });
  const folderId = fRes.result.folder.id;

  const s1 = await svc.handleRpcAction('send-chat-first', { message: 'المحادثة الأولى' });
  await svc.handleRpcAction('navigate', { mode: 'chat', view: '/' });
  const s2 = await svc.handleRpcAction('send-chat-first', { message: 'المحادثة الثانية' });
  await svc.handleRpcAction('navigate', { mode: 'chat', view: '/' });
  const s3 = await svc.handleRpcAction('send-chat-first', { message: 'المحادثة الثالثة' });
  const c1 = s1.result.cascadeId;
  const c2 = s2.result.cascadeId;
  const c3 = s3.result.cascadeId;

  const origGetCatalog = svc.hostAdapter.getCatalog.bind(svc.hostAdapter);
  svc.hostAdapter.getCatalog = () => {
    const base = origGetCatalog();
    return {
      ...base,
      items: (base.items || []).map((it) => (it.cascadeId === c3 ? { ...it, status: 'running' } : it)),
    };
  };

  const mv = await svc.handleRpcAction('batch-chat-sessions', {
    op: 'move',
    cascadeIds: [c1, c2, 'code-ci-review'],
    folderId,
  });
  assert.equal(mv.ok, true);
  assert.deepEqual(mv.result.succeededIds, [c1, c2]);
  assert.deepEqual(mv.result.skippedIds, ['code-ci-review']);
  assert.equal(svc.getSnapshot().assignments[c1].placement.folderId, folderId);

  const arch = await svc.handleRpcAction('batch-chat-sessions', {
    op: 'archive',
    cascadeIds: [c1, c3],
    archived: true,
  });
  assert.equal(arch.ok, true);
  assert.deepEqual(arch.result.succeededIds, [c1]);
  assert.deepEqual(arch.result.skippedIds, [c3]);
  assert.equal(svc.getSnapshot().assignments[c1].archived, true);

  const del = await svc.handleRpcAction('batch-chat-sessions', {
    op: 'delete',
    cascadeIds: [c2, c3],
  });
  assert.equal(del.ok, true);
  assert.deepEqual(del.result.succeededIds, [c2]);
  assert.deepEqual(del.result.skippedIds, [c3]);
  assert.equal(svc.getSnapshot().assignments[c2], undefined);
  assert.ok(svc.getSnapshot().assignments[c3]);
  assert.equal(svc.getPermissionAudit().globalPermissionWrites, 0);
});

test('Spark list-spark-files and import-spark-file enforce traversal/extension guards, non-overwrite naming, and showStarterChips pref', async (t) => {
  const svc = createStudioSandboxService();
  t.after(() => svc.dispose());

  await svc.handleRpcAction('switch-mode', { to: 'chat' });
  const box = await svc.handleRpcAction('create-spark-box', { name: 'مجلد المستندات المعزول' });
  await svc.handleRpcAction('select-spark-project', { selectionToken: box.result.selectionToken });
  const pid = svc.getSnapshot().chatDraft.sparkProjectId;

  const imp1 = await svc.handleRpcAction('import-spark-file', {
    sparkProjectId: pid,
    fileName: 'notes.md',
    base64Data: Buffer.from('# Hello Spark', 'utf8').toString('base64'),
  });
  assert.equal(imp1.ok, true);
  assert.equal(imp1.result.fileName, 'notes.md');

  const imp2 = await svc.handleRpcAction('import-spark-file', {
    sparkProjectId: pid,
    fileName: 'notes.md',
    base64Data: Buffer.from('# Second Copy', 'utf8').toString('base64'),
  });
  assert.equal(imp2.ok, true);
  assert.equal(imp2.result.fileName, 'notes-2.md');

  for (const badName of ['../escape.txt', 'run.exe', 'secret.pem', 'script.ps1', '.env']) {
    const rej = await svc.handleRpcAction('import-spark-file', {
      sparkProjectId: pid,
      fileName: badName,
      base64Data: Buffer.from('bad', 'utf8').toString('base64'),
    });
    assert.equal(rej.ok, false);
  }

  const listed = await svc.handleRpcAction('list-spark-files', { sparkProjectId: pid });
  assert.equal(listed.ok, true);
  const names = listed.result.files.map((f) => f.name).sort();
  assert.deepEqual(names, ['notes-2.md', 'notes.md']);

  assert.equal(svc.getSnapshot().prefs.chatPolicy.showStarterChips, true);
  const prefRes = await svc.handleRpcAction('set-prefs', { patch: { chatPolicy: { showStarterChips: false } } });
  assert.equal(prefRes.ok, true);
  assert.equal(prefRes.snapshot.prefs.chatPolicy.showStarterChips, false);
  assert.equal(svc.getPermissionAudit().globalPermissionWrites, 0);
});

test('RPC envelope enforces payload limit strictly by normalized action (blocks src.action spoofing)', async (t) => {
  const svc = createStudioSandboxService();
  t.after(() => svc.dispose());

  const spoofed = await svc.handleRpcAction('set-prefs', {
    action: 'import-spark-file',
    patch: { padding: 'A'.repeat(200 * 1024) },
  });
  assert.equal(spoofed.ok, false);
  assert.equal(spoofed.error?.code, ERROR_CODES.LIMIT_EXCEEDED);

  await svc.handleRpcAction('switch-mode', { to: 'chat' });
  const box = await svc.handleRpcAction('create-spark-box', { name: 'PayloadCheckBox' });
  await svc.handleRpcAction('select-spark-project', { selectionToken: box.result.selectionToken });
  const pid = svc.getSnapshot().chatDraft.sparkProjectId;
  const bigBuf = Buffer.alloc(180 * 1024, 0x41);
  const imp = await svc.handleRpcAction('import-spark-file', {
    sparkProjectId: pid,
    fileName: 'large-note.txt',
    base64Data: bigBuf.toString('base64'),
  });
  assert.equal(imp.ok, true);
  assert.equal(imp.result.fileName, 'large-note.txt');
  assert.equal(imp.result.size, bigBuf.length);
});

test('Spark file import & listing enforce blocked extensions, Base64 precheck, -2 naming, atomic cleanup, and scope directory identity', async (t) => {
  const env = makeTempEnv('ag-prism-spark-sec-');
  const outsideDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ag-prism-spark-outside-'));
  t.after(() => {
    fs.rmSync(env.root, { recursive: true, force: true });
    fs.rmSync(outsideDir, { recursive: true, force: true });
  });
  const svc = new SidebarStudioService({ sandboxMode: true, sandboxRoot: env.root, ...env });
  t.after(() => svc.dispose());

  await svc.handleRpcAction('switch-mode', { to: 'chat' });
  const box = await svc.handleRpcAction('create-spark-box', { name: 'SecBox' });
  await svc.handleRpcAction('select-spark-project', { selectionToken: box.result.selectionToken });
  const pid = svc.getSnapshot().chatDraft.sparkProjectId;

  const blockedExts = [
    '.lnk', '.url', '.reg', '.wsf', '.wsh', '.jse', '.vbe', '.scf', '.hta',
    '.svg', '.html', '.htm', '.js', '.mjs', '.cjs', '.py', '.rb', '.php',
  ];
  for (const ext of blockedExts) {
    const res = await svc.handleRpcAction('import-spark-file', {
      sparkProjectId: pid,
      fileName: `evil${ext}`,
      base64Data: Buffer.from('payload', 'utf8').toString('base64'),
    });
    assert.equal(res.ok, false);
    assert.equal(res.error?.code, ERROR_CODES.INVALID_ARGUMENT);
  }

  const allowedExts = [
    '.md', '.txt', '.json', '.csv', '.pdf', '.png', '.jpg', '.jpeg', '.webp', '.gif', '.docx', '.xlsx', '.pptx',
  ];
  for (const ext of allowedExts) {
    const res = await svc.handleRpcAction('import-spark-file', {
      sparkProjectId: pid,
      fileName: `doc${ext}`,
      base64Data: Buffer.from('ok', 'utf8').toString('base64'),
    });
    assert.equal(res.ok, true);
  }

  for (const badB64 of ['not-base64!!!', 'abc', 'AA=A', '====', 'SGVs bG8=']) {
    const res = await svc.handleRpcAction('import-spark-file', {
      sparkProjectId: pid,
      fileName: 'bad-b64.txt',
      base64Data: badB64,
    });
    assert.equal(res.ok, false);
    assert.equal(res.error?.code, ERROR_CODES.INVALID_ARGUMENT);
  }
  const overLimitB64 = 'A'.repeat(Math.ceil((8 * 1024 * 1024) / 3) * 4 + 4);
  const overLimitRes = await svc.handleRpcAction('import-spark-file', {
    sparkProjectId: pid,
    fileName: 'too-big.txt',
    base64Data: overLimitB64,
  });
  assert.equal(overLimitRes.ok, false);
  assert.equal(overLimitRes.error?.code, ERROR_CODES.LIMIT_EXCEEDED);

  const c1 = await svc.handleRpcAction('import-spark-file', {
    sparkProjectId: pid,
    fileName: 'report.md',
    base64Data: Buffer.from('v1', 'utf8').toString('base64'),
  });
  const c2 = await svc.handleRpcAction('import-spark-file', {
    sparkProjectId: pid,
    fileName: 'report.md',
    base64Data: Buffer.from('v2', 'utf8').toString('base64'),
  });
  const c3 = await svc.handleRpcAction('import-spark-file', {
    sparkProjectId: pid,
    fileName: 'report.md',
    base64Data: Buffer.from('v3', 'utf8').toString('base64'),
  });
  assert.equal(c1.result.fileName, 'report.md');
  assert.equal(c2.result.fileName, 'report-2.md');
  assert.equal(c3.result.fileName, 'report-3.md');
  assert.equal(validateSparkBoxName(c2.result.fileName).ok, true);

  const proj = svc._state.sparkProjects.find((p) => p.id === pid);
  const scopeRec = svc._state.projectScopes[proj.scopeRef];
  const entries = fs.readdirSync(scopeRec.realPath);
  assert.equal(entries.some((name) => name.includes('.ag-spark-import-')), false);

  const origCheckDir = svc._isScopeDirectoryCurrent.bind(svc);
  let dirCheckCount = 0;
  svc._isScopeDirectoryCurrent = (sc) => {
    dirCheckCount += 1;
    return dirCheckCount === 1 ? origCheckDir(sc) : false;
  };
  const abortedImport = await svc.handleRpcAction('import-spark-file', {
    sparkProjectId: pid,
    fileName: 'aborted.md',
    base64Data: Buffer.from('should-clean-up', 'utf8').toString('base64'),
  });
  svc._isScopeDirectoryCurrent = origCheckDir;
  assert.equal(abortedImport.ok, false);
  assert.equal(abortedImport.error?.code, ERROR_CODES.PROJECT_SCOPE_CONFLICT);
  assert.equal(fs.existsSync(path.join(scopeRec.realPath, 'aborted.md')), false);
  assert.equal(
    fs.readdirSync(scopeRec.realPath).some((name) => name.includes('.ag-spark-import-')),
    false
  );

  const origRealPath = scopeRec.realPath;
  scopeRec.realPath = fs.realpathSync(outsideDir);
  const listEscaped = await svc.handleRpcAction('list-spark-files', { sparkProjectId: pid });
  assert.equal(listEscaped.ok, false);
  assert.equal(listEscaped.error?.code, ERROR_CODES.PROJECT_SCOPE_CONFLICT);
  const importEscaped = await svc.handleRpcAction('import-spark-file', {
    sparkProjectId: pid,
    fileName: 'escape.txt',
    base64Data: Buffer.from('x', 'utf8').toString('base64'),
  });
  assert.equal(importEscaped.ok, false);
  assert.equal(importEscaped.error?.code, ERROR_CODES.PROJECT_SCOPE_CONFLICT);
  assert.equal(fs.existsSync(path.join(outsideDir, 'escape.txt')), false);
  scopeRec.realPath = origRealPath;
});

test('batch-chat-sessions reports host errors in failedIds without swallowing, guards missing catalog items, and records skipped-all receipts', async (t) => {
  const svc = createStudioSandboxService();
  t.after(() => svc.dispose());

  await svc.handleRpcAction('switch-mode', { to: 'chat' });
  const s1 = await svc.handleRpcAction('send-chat-first', { message: 'المجموعة الأولى' });
  await svc.handleRpcAction('navigate', { mode: 'chat', view: '/' });
  const s2 = await svc.handleRpcAction('send-chat-first', { message: 'المجموعة الثانية' });
  await svc.handleRpcAction('navigate', { mode: 'chat', view: '/' });
  const s3 = await svc.handleRpcAction('send-chat-first', { message: 'المجموعة الثالثة' });
  const c1 = s1.result.cascadeId;
  const c2 = s2.result.cascadeId;
  const c3 = s3.result.cascadeId;

  const origAnnot = svc.hostAdapter.updateConversationAnnotations.bind(svc.hostAdapter);
  svc.hostAdapter.updateConversationAnnotations = async (args) => {
    if (args.cascadeId === c2) throw new Error('host annotation rpc error');
    return origAnnot(args);
  };
  const archPartial = await svc.handleRpcAction('batch-chat-sessions', {
    op: 'archive',
    cascadeIds: [c1, c2],
    archived: true,
  });
  assert.equal(archPartial.ok, true);
  assert.deepEqual(archPartial.result.succeededIds, [c1]);
  assert.deepEqual(archPartial.result.failedIds, [c2]);
  assert.equal(svc.getSnapshot().assignments[c1].archived, true);
  assert.notEqual(svc.getSnapshot().assignments[c2].archived, true);

  const archAllFail = await svc.handleRpcAction('batch-chat-sessions', {
    op: 'archive',
    cascadeIds: [c2],
    archived: true,
  });
  assert.equal(archAllFail.ok, false);
  assert.deepEqual(archAllFail.result.failedIds, [c2]);
  svc.hostAdapter.updateConversationAnnotations = origAnnot;

  const origDel = svc.hostAdapter.deleteConversation.bind(svc.hostAdapter);
  svc.hostAdapter.deleteConversation = async (args) => {
    if (args.cascadeId === c2) return { ok: false, error: 'disk locked' };
    return origDel(args);
  };
  const delPartial = await svc.handleRpcAction('batch-chat-sessions', {
    op: 'delete',
    cascadeIds: [c1, c2],
  });
  assert.equal(delPartial.ok, true);
  assert.deepEqual(delPartial.result.succeededIds, [c1]);
  assert.deepEqual(delPartial.result.failedIds, [c2]);
  assert.deepEqual(delPartial.result.skippedIds, []);
  assert.equal(svc.getSnapshot().assignments[c1], undefined);
  assert.ok(svc.getSnapshot().assignments[c2]);
  svc.hostAdapter.deleteConversation = origDel;

  const origGetCatalog = svc.hostAdapter.getCatalog.bind(svc.hostAdapter);
  svc.hostAdapter.getCatalog = () => {
    const base = origGetCatalog();
    return {
      ...base,
      items: (base.items || []).filter((it) => it.cascadeId !== c3),
    };
  };
  const skippedReq = {
    requestId: 'batch-all-skipped-1',
    payload: { op: 'delete', cascadeIds: [c3] },
  };
  const skippedRes = await svc.handleRpcAction('batch-chat-sessions', skippedReq);
  assert.equal(skippedRes.ok, true);
  assert.deepEqual(skippedRes.result.succeededIds, []);
  assert.deepEqual(skippedRes.result.skippedIds, [c3]);
  assert.deepEqual(skippedRes.result.failedIds, []);
  assert.ok(svc.getSnapshot().assignments[c3]);

  svc.hostAdapter.getCatalog = origGetCatalog;
  const replaySkipped = await svc.handleRpcAction('batch-chat-sessions', skippedReq);
  assert.equal(replaySkipped.ok, true);
  assert.deepEqual(replaySkipped.result.skippedIds, [c3]);
  assert.ok(svc.getSnapshot().assignments[c3]);
  const conflictSkipped = await svc.handleRpcAction('batch-chat-sessions', {
    requestId: 'batch-all-skipped-1',
    payload: { op: 'delete', cascadeIds: [c2] },
  });
  assert.equal(conflictSkipped.ok, false);
  assert.equal(conflictSkipped.error?.code, ERROR_CODES.IDEMPOTENCY_CONFLICT);
});

test('writer lock self-heals stale .lock.recovery directory while keeping fresh recovery guarded as BUSY', async (t) => {
  const env = makeTempEnv('ag-prism-lock-heal-');
  t.after(() => fs.rmSync(env.root, { recursive: true, force: true }));
  fs.mkdirSync(path.dirname(env.statePath), { recursive: true });
  const lockPath = `${env.statePath}.lock`;
  const recoveryPath = `${lockPath}.recovery`;
  fs.writeFileSync(lockPath, JSON.stringify({ pid: 99999999, token: 'dead-lock', createdAt: Date.now() - 120000 }), 'utf8');
  fs.mkdirSync(recoveryPath, { mode: 0o700 });

  assert.throws(
    () => new SidebarStudioService({ statePath: env.statePath, sparkRoot: env.sparkRoot, knowledgeRoot: env.knowledgeRoot }),
    (err) => err && err.code === ERROR_CODES.BUSY
  );

  const staleSec = (Date.now() - 60_000) / 1000;
  fs.utimesSync(recoveryPath, staleSec, staleSec);
  const svc = new SidebarStudioService({ statePath: env.statePath, sparkRoot: env.sparkRoot, knowledgeRoot: env.knowledgeRoot });
  t.after(() => svc.dispose());
  assert.equal(fs.existsSync(recoveryPath), false);
  assert.equal(svc.getSnapshot().schemaVersion, 2);
});

test('state-machine permission isolation validates scopeRef/policyValues enums and supports partial-write rollback', async () => {
  const writes = [];
  const state = {
    autoExecutionPolicy: 'ask',
    fileAccessPolicy: 'allow-all',
    internetPolicy: 'allow',
    sandboxMode: 'off',
  };
  let failFileSetter = false;
  const psp = {
    getProjectPermissionGrants: async (scopeRef) => ({ ...state, scopeRef }),
    setProjectAutoExecutionPolicy: async (scopeRef, v) => { writes.push(['auto', scopeRef, v]); state.autoExecutionPolicy = v; },
    setProjectFileAccessPolicy: async (scopeRef, v) => {
      if (failFileSetter) throw new Error('injected setter failure');
      writes.push(['file', scopeRef, v]);
      state.fileAccessPolicy = v;
    },
    setProjectInternetPolicy: async (scopeRef, v) => { writes.push(['net', scopeRef, v]); state.internetPolicy = v; },
    setProjectSandboxMode: async (scopeRef, v) => { writes.push(['sandbox', scopeRef, v]); state.sandboxMode = v; },
  };

  const badScope = await applyProjectPermissionIsolation({
    kind: 'spark', scopeRef: 'global', scopeIsolated: true, projectSettingsProvider: psp,
  });
  assert.equal(badScope.ok, false);
  assert.equal(badScope.error.code, ERROR_CODES.INVALID_ARGUMENT);

  const badEnum = await applyProjectPermissionIsolation({
    kind: 'spark', scopeRef: 'scope-valid-1', scopeIsolated: true, projectSettingsProvider: psp,
    policyValues: { autoExecutionPolicy: 'evil-policy' },
  });
  assert.equal(badEnum.ok, false);
  assert.equal(badEnum.error.code, ERROR_CODES.INVALID_ARGUMENT);

  const badField = await applyProjectPermissionIsolation({
    kind: 'spark', scopeRef: 'scope-valid-1', scopeIsolated: true, projectSettingsProvider: psp,
    policyValues: { unknownField: 'off' },
  });
  assert.equal(badField.ok, false);
  assert.equal(badField.error.code, ERROR_CODES.INVALID_ARGUMENT);
  assert.equal(writes.length, 0);

  const mismatchedBaseline = await applyProjectPermissionIsolation({
    kind: 'spark',
    scopeRef: 'scope-valid-1',
    scopeIsolated: true,
    projectSettingsProvider: {
      ...psp,
      getProjectPermissionGrants: async () => ({ ...state, scopeRef: 'other-project-scope' }),
    },
  });
  assert.equal(mismatchedBaseline.ok, false);
  assert.equal(mismatchedBaseline.status, 'needs-reconciliation');
  assert.equal(writes.length, 0);

  failFileSetter = true;
  const partial = await applyProjectPermissionIsolation({
    kind: 'spark', scopeRef: 'scope-valid-1', scopeIsolated: true, projectSettingsProvider: psp,
  });
  assert.equal(partial.ok, false);
  assert.equal(partial.status, 'needs-reconciliation');
  assert.deepEqual(partial.applied, { autoExecutionPolicy: 'off' });
  assert.equal(state.autoExecutionPolicy, 'off');

  failFileSetter = false;
  const rolledBack = await restoreProjectPermissionBaseline({
    scopeRef: 'scope-valid-1',
    projectSettingsProvider: psp,
    baseline: partial.baseline,
    applied: partial.applied,
    scopeControlled: true,
  });
  assert.equal(rolledBack.ok, true);
  assert.equal(rolledBack.status, 'restored');
  assert.equal(state.autoExecutionPolicy, 'ask');
});

test('state-machine cloneJsonSafe blocks deep reference leaks and sanitizeChatPolicy enforces strict booleans', () => {
  const leaf = { secret: 'mutable' };
  let deep = leaf;
  for (let i = 0; i < 16; i++) deep = { child: deep };
  const cloned = cloneJsonSafe(deep);
  let cursor = cloned;
  let origCursor = deep;
  for (let i = 0; i < 13; i++) {
    assert.notEqual(cursor, origCursor);
    cursor = cursor.child;
    origCursor = origCursor.child;
  }
  assert.notEqual(cursor, origCursor);
  assert.deepEqual(cursor, {});
  cursor.injected = true;
  assert.equal(origCursor.injected, undefined);

  class CustomBox { constructor() { this.a = 1; } }
  const nullProto = Object.assign(Object.create(null), { ok: true });
  const mixed = cloneJsonSafe({ d: new Date(), box: new CustomBox(), clean: nullProto });
  assert.equal(mixed.d, null);
  assert.equal(mixed.box, null);
  assert.deepEqual(mixed.clean, { ok: true });

  const policy = sanitizeChatPolicy(
    {
      pure: { webSearch: 0, zeroTools: 'false', imageAndFiles: 'yes' },
      spark: { sandbox: 0, schedule: null },
      showTelemetryAboveComposer: 'false',
      showStarterChips: 0,
    },
    {
      pure: { webSearch: 'nope', zeroTools: 'true' },
      spark: { sandbox: 'off' },
      showTelemetryAboveComposer: 0,
      showStarterChips: 'no',
    }
  );
  assert.equal(policy.pure.webSearch, true);
  assert.equal(policy.pure.zeroTools, false);
  assert.equal(policy.pure.imageAndFiles, true);
  assert.equal(policy.spark.sandbox, true);
  assert.equal(policy.spark.schedule, true);
  assert.equal(policy.showTelemetryAboveComposer, true);
  assert.equal(policy.showStarterChips, true);
});

test('live-host-adapter enforces isScopeIsolated shared-path linkage, UNC/drive-root matching, and deleted session tombstones', async (t) => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ag-prism-live-hard-'));
  const codeDir = path.join(tmpDir, 'CodeDir');
  const sparkDir = path.join(tmpDir, 'SparkDir');
  fs.mkdirSync(codeDir, { recursive: true });
  fs.mkdirSync(sparkDir, { recursive: true });
  t.after(() => fs.rmSync(tmpDir, { recursive: true, force: true }));

  assert.equal(normalizeHostPathKey('\\\\?\\UNC\\FileSrv\\Share\\Repo\\'), '//filesrv/share/repo');
  assert.equal(normalizeHostPathKey('\\\\FileSrv\\Share\\Repo\\'), '//filesrv/share/repo');
  assert.equal(normalizeHostPathKey('C:\\'), 'c:/');

  const adapter = createLiveHostAdapter({
    evaluateInHost: async (expr) => {
      if (expr.includes('"deleteConversation"')) return { ok: true };
      return { ok: false, error: 'unexpected' };
    },
  });
  adapter.syncFromRenderer({
    catalog: {
      health: 'ready',
      items: [
        { cascadeId: 'chat-to-del', title: 'Delete Me', status: 'idle', updatedAt: 1000 },
        { cascadeId: 'code-keep', title: 'Keep Me', status: 'idle', updatedAt: 1000, workspacePath: codeDir },
      ],
    },
    codeWorkspacePaths: [codeDir, '\\\\?\\UNC\\127.0.0.1\\Share\\Repo', 'C:\\'],
    capabilities: { projectPermissions: true, perCascadeIsolation: true },
  });

  assert.equal(adapter.isPathSharedWithCode('\\\\127.0.0.1\\share\\repo\\sub'), true);
  assert.equal(adapter.isPathSharedWithCode('C:\\Projects\\AnySubDir'), true);
  assert.equal(adapter.isPathSharedWithCode('D:\\Projects\\OtherDrive'), false);

  const isolatedAdapter = createLiveHostAdapter({ evaluateInHost: async () => ({ ok: true }) });
  isolatedAdapter.syncFromRenderer({
    catalog: { health: 'ready', items: [] },
    codeWorkspacePaths: [codeDir],
    capabilities: { projectPermissions: true },
  });
  isolatedAdapter.registerScopePath('scope-shared', codeDir);
  isolatedAdapter.registerScopePath('scope-clean', sparkDir);
  assert.equal(isolatedAdapter.isScopeIsolated('scope-shared'), false);
  assert.equal(isolatedAdapter.isScopeIsolated('scope-shared', {}), false);
  assert.equal(isolatedAdapter.isScopeIsolated('scope-shared', { sharedWithCode: false }), false);
  assert.equal(isolatedAdapter.isScopeIsolated('scope-clean'), true);
  assert.equal(isolatedAdapter.isScopeIsolated('scope-unregistered'), false);
  assert.equal(isolatedAdapter.isScopeIsolated('scope-shared', { sharedWithCode: true, wslIsolated: true }), true);

  const delRes = await adapter.deleteConversation({ cascadeId: 'chat-to-del' });
  assert.equal(delRes.ok, true);
  assert.equal(adapter.getCatalog().items.some((x) => x.cascadeId === 'chat-to-del'), false);

  adapter.syncFromRenderer({
    catalog: {
      health: 'ready',
      items: [
        { cascadeId: 'chat-to-del', title: 'Stale Ghost', status: 'idle', updatedAt: 2000 },
        { cascadeId: 'code-keep', title: 'Keep Me', status: 'idle', updatedAt: 2000 },
      ],
    },
  });
  const afterSync = adapter.getCatalog();
  assert.equal(afterSync.items.some((x) => x.cascadeId === 'chat-to-del'), false);
  assert.equal(afterSync.lastKnownById['chat-to-del'], undefined);
  assert.equal(afterSync.items.some((x) => x.cascadeId === 'code-keep'), true);
});
