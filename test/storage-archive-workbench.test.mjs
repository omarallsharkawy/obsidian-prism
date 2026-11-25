import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';

import * as arch from '../sidecars/daemon/conversation-archive.mjs';
import { PrismDaemon, REPO_BINDING } from '../sidecars/daemon/main.mjs';
import { buildStorageGuardBannerExpression } from '../sidecars/daemon/storage-guard-ui.mjs';

const require = createRequire(import.meta.url);
const ROOT = path.resolve(import.meta.dirname, '..');
const cdp = require(path.join(ROOT, 'cdp.js'));
const settingsPanel = require(path.join(ROOT, 'settings-panel.js'));
const i18nLocales = require(path.join(ROOT, 'i18n-locales.js'));
const i18nCore = require(path.join(ROOT, 'i18n-core.js'));

const SUPPORTED_2 = ['en', 'ar'];
const CJK_RE = /[\u4e00-\u9fff\u3400-\u4dbf\u3000-\u303f\uff00-\uffef]/;

function makeTempDir(prefix) {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

function writeSizedFile(filePath, bytes, mtimeMs) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, Buffer.alloc(bytes, 0x61));
  if (Number.isFinite(mtimeMs)) {
    const t = mtimeMs / 1000;
    fs.utimesSync(filePath, t, t);
  }
}

function createMiniDom() {
  const matches = (n, selList) =>
    selList.split(',').some((raw) => {
      const s = raw.trim();
      if (!s) return false;
      if (s.startsWith('#')) return n.id === s.slice(1);
      let rest = s;
      const tm = rest.match(/^[a-zA-Z0-9-]+/);
      if (tm) {
        if (n.tagName !== tm[0].toUpperCase()) return false;
        rest = rest.slice(tm[0].length);
      }
      for (const m of rest.matchAll(/\.([a-zA-Z0-9_-]+)/g)) {
        if (!n.classList.contains(m[1])) return false;
      }
      for (const m of rest.matchAll(/\[([^\]=]+)(?:="([^"]*)")?\]/g)) {
        if (!n.hasAttribute(m[1])) return false;
        if (m[2] !== undefined && n.getAttribute(m[1]) !== m[2]) return false;
      }
      return true;
    });

  const makeEl = (tag, doc) => {
    const attrs = new Map();
    const listeners = new Map();
    const el = {
      tagName: String(tag).toUpperCase(),
      nodeType: 1,
      id: '',
      innerHTML: '',
      ownerDocument: doc,
      parentElement: null,
      parentNode: null,
      children: [],
      hidden: false,
      disabled: false,
      open: false,
      value: '',
      className: '',
      _text: '',
      style: { setProperty() {}, removeProperty() {} },
      classList: {
        add(c) {
          if (!el.className.split(/\s+/).includes(c)) el.className = `${el.className} ${c}`.trim();
        },
        remove(c) {
          el.className = el.className.split(/\s+/).filter((x) => x !== c).join(' ');
        },
        contains(c) {
          return el.className.split(/\s+/).includes(c);
        },
      },
      get isConnected() {
        let p = el;
        while (p) {
          if (p === doc.documentElement) return true;
          p = p.parentElement;
        }
        return false;
      },
      get textContent() {
        return el.children.length ? el._text + el.children.map((c) => c.textContent).join('') : el._text;
      },
      set textContent(v) {
        el._text = String(v ?? '');
        el.children.length = 0;
      },
      get firstChild() {
        return el.children[0] || null;
      },
      setAttribute(k, v) {
        attrs.set(k, String(v));
        if (k === 'id') el.id = String(v);
        if (k === 'hidden') el.hidden = true;
      },
      getAttribute(k) {
        return attrs.has(k) ? attrs.get(k) : null;
      },
      hasAttribute(k) {
        return attrs.has(k);
      },
      removeAttribute(k) {
        attrs.delete(k);
        if (k === 'hidden') el.hidden = false;
      },
      toggleAttribute(k, f) {
        const on = f === undefined ? !attrs.has(k) : Boolean(f);
        if (on) attrs.set(k, '');
        else attrs.delete(k);
        return on;
      },
      appendChild(c) {
        c.parentElement = el;
        c.parentNode = el;
        el.children.push(c);
        if (el.tagName === 'SELECT' && c.tagName === 'OPTION' && !el.value) el.value = c.value;
        return c;
      },
      removeChild(c) {
        el.children = el.children.filter((x) => x !== c);
        c.parentElement = null;
        c.parentNode = null;
        return c;
      },
      remove() {
        if (el.parentElement) el.parentElement.removeChild(el);
      },
      closest(sel) {
        let cur = el;
        while (cur) {
          if (matches(cur, sel)) return cur;
          cur = cur.parentElement;
        }
        return null;
      },
      addEventListener(ev, fn) {
        if (!listeners.has(ev)) listeners.set(ev, []);
        listeners.get(ev).push(fn);
      },
      removeEventListener() {},
      dispatchEvent(ev) {
        for (const fn of listeners.get(ev.type) || []) fn(ev);
      },
      click() {
        if (el.disabled) return;
        for (const fn of listeners.get('click') || []) fn({ preventDefault() {}, stopPropagation() {} });
      },
      querySelector(sel) {
        return el.querySelectorAll(sel)[0] || null;
      },
      querySelectorAll(sel) {
        const out = [];
        const walk = (n) => {
          for (const c of n.children || []) {
            if (matches(c, sel)) out.push(c);
            walk(c);
          }
        };
        walk(el);
        return out;
      },
    };
    return el;
  };

  const doc = {
    body: null,
    head: null,
    documentElement: null,
    createElement(tag) {
      return makeEl(tag, doc);
    },
    getElementById(id) {
      return doc.documentElement.querySelector('#' + id);
    },
    querySelectorAll(s) {
      return doc.documentElement.querySelectorAll(s);
    },
    querySelector(s) {
      return doc.documentElement.querySelector(s);
    },
  };
  doc.documentElement = makeEl('html', doc);
  doc.head = makeEl('head', doc);
  doc.body = makeEl('body', doc);
  doc.documentElement.appendChild(doc.head);
  doc.documentElement.appendChild(doc.body);

  const dialog = makeEl('div', doc);
  dialog.setAttribute('role', 'dialog');
  const panel = makeEl('div', doc);
  const h2 = makeEl('h2', doc);
  h2.textContent = 'Appearance';
  const anchor = makeEl('div', doc);
  anchor.className = 'space-y-2';
  panel.appendChild(h2);
  panel.appendChild(anchor);
  dialog.appendChild(panel);
  doc.body.appendChild(dialog);

  return { doc, makeEl };
}

test('conversation-archive: topConsumers Top-5 sort, strong secret redaction (ghp_/?token=/user:pass@/xai-/AIza/Bearer), and bilingual en/ar report with 0 CJK leak', () => {
  // 1) Direct sanitizeTitleForReport redaction matrix
  const samples = [
    ['OpenAI sk-secret1234567890abcd done', 'sk-secret'],
    ['Stripe rk_live_1234567890ab & pk_test_abcdef123456', 'rk_live_'],
    ['Stripe pk_test_abcdef123456', 'pk_test_'],
    ['Key ak_prod_1234567890xy and AKIAIOSFODNN7EXAMPLE', 'ak_prod_'],
    ['AWS AKIAIOSFODNN7EXAMPLE here', 'AKIAIOSFODNN7EXAMPLE'],
    ['Google AIzaSyD1234567890abcdef token', 'AIzaSyD'],
    ['GitHub ghp_AbCdEfGhIjKlMnOpQrSt1234 leak', 'ghp_AbCd'],
    ['GitHub github_pat_11ABCDEFG_1234567890xyz leak', 'github_pat_11'],
    ['xAI xai-1234567890abcdef token', 'xai-123456'],
    ['Auth Bearer eyJhbGciOiJIUzI1NiJ9.payload', 'eyJhbGci'],
    ['URL https://api.example.com/v1?token=supersecret123&key=mykey456&secret=s789', 'supersecret123'],
    ['URL https://api.example.com/v1?key=mykey456', 'mykey456'],
    ['Git https://alice:topsecretpass@git.example.com/org/repo.git', 'topsecretpass'],
  ];
  for (const [raw, leakedNeedle] of samples) {
    const cleaned = arch.sanitizeTitleForReport(raw);
    assert.equal(cleaned.includes(leakedNeedle), false, `Must redact ${leakedNeedle} from ${raw}, got: ${cleaned}`);
  }
  // Must NOT false-positive on normal English words like acknowledgement or sparkling
  assert.equal(arch.sanitizeTitleForReport('acknowledgement for sparkling water'), 'acknowledgement for sparkling water');

  // 2) Scan report: Top-5 cap, WAL breakdown, old-main count, and redacted titles
  const tmpRoot = makeTempDir('ag-prism-wb-scan-');
  try {
    const convDir = path.join(tmpRoot, 'conversations');
    const archiveDir = path.join(tmpRoot, 'archive');
    const now = Date.parse('2026-11-25T08:00:00Z');
    const ids = [1, 2, 3, 4, 5, 6].map((n) => `11111111-1111-4111-8111-00000000000${n}`);

    // Sizes descending: ids[0]=6MB, ids[1]=5MB+0.5MB WAL, ids[2]=4MB, ids[3]=3MB, ids[4]=2MB, ids[5]=1MB
    writeSizedFile(path.join(convDir, `${ids[0]}.db`), 6 * 1024 * 1024, now - 5 * 3600000);
    writeSizedFile(path.join(convDir, `${ids[1]}.db`), 5 * 1024 * 1024, now - 20 * 86400000);
    writeSizedFile(path.join(convDir, `${ids[1]}.db-wal`), 512 * 1024, now - 20 * 86400000);
    writeSizedFile(path.join(convDir, `${ids[2]}.db`), 4 * 1024 * 1024, now - 3 * 86400000);
    writeSizedFile(path.join(convDir, `${ids[3]}.db`), 3 * 1024 * 1024, now - 2 * 86400000);
    writeSizedFile(path.join(convDir, `${ids[4]}.db`), 2 * 1024 * 1024, now - 1 * 86400000);
    writeSizedFile(path.join(convDir, `${ids[5]}.db`), 1 * 1024 * 1024, now - 1 * 3600000);

    const summaries = {
      [ids[0]]: {
        status: 'CASCADE_RUN_STATUS_IDLE',
        stepCount: 18,
        summary: 'Sub ghp_1234567890abcdef1234 https://bob:pw123@ex.com/a?token=tok999',
        lastModifiedTime: new Date(now - 5 * 3600000).toISOString(),
        trajectoryMetadata: { parentConversationId: ids[1] },
      },
      [ids[1]]: {
        status: 'CASCADE_RUN_STATUS_IDLE',
        stepCount: 40,
        summary: 'Legacy Main Session',
        lastModifiedTime: new Date(now - 20 * 86400000).toISOString(),
      },
      [ids[2]]: {
        status: 'CASCADE_RUN_STATUS_IDLE',
        stepCount: 10,
        summary: 'Recent Main Session',
        lastModifiedTime: new Date(now - 3 * 86400000).toISOString(),
      },
    };

    const scan = arch.scanConversationStorage({
      convDir,
      archiveDir,
      summaries,
      subagentMaxAgeHours: 2,
      mainMaxAgeDays: 14,
      keepRecentMain: 1,
      lsMemoryMb: 2048,
      now,
    });

    assert.equal(scan.topConsumers.length, 5, 'topConsumers must be strictly capped at Top 5');
    assert.deepEqual(
      scan.topConsumers.map((x) => x.id),
      ids.slice(0, 5),
      'topConsumers must be sorted by total bytes descending'
    );
    assert.equal(scan.topConsumers[0].kind, 'subagent');
    assert.equal(scan.topConsumers[0].title.includes('ghp_123456'), false);
    assert.equal(scan.topConsumers[0].title.includes('pw123'), false);
    assert.equal(scan.topConsumers[0].title.includes('tok999'), false);
    assert.equal(scan.walMb, 0.5);
    assert.equal(scan.archivableOldMainCount, 1);
    assert.equal(scan.archivableOldMainMb, 5.5);

    // 3) Bilingual en/ar parity, fallback to en, 0 CJK leak across all supported locales
    assert.deepEqual(arch.WORKBENCH_SUPPORTED_LANGS, SUPPORTED_2);
    assert.equal(arch.normalizeWorkbenchLang('ar-SA'), 'ar');
    assert.equal(arch.normalizeWorkbenchLang('arabic'), 'ar');
    assert.equal(arch.normalizeWorkbenchLang('pt-BR'), 'en');
    assert.equal(arch.normalizeWorkbenchLang('unknown-xx'), 'en');

    for (const lang of SUPPORTED_2) {
      const labels = arch.getStorageWorkbenchLabels(lang);
      assert.ok(labels.summary && labels.archiveOldMain && labels.restoreBtn && labels.refreshBtn && labels.oldMainReadyTpl);
      const txt = arch.formatStorageDetailReport({ ...scan, batches: [] }, lang);
      assert.ok(txt.includes('Legacy Main Session'), `Detail report (${lang}) should include top consumer title`);
      assert.ok(txt.includes(labels.topTitle), `Detail report (${lang}) should include localized Top-5 heading`);
      assert.ok(txt.includes('0.5 MB'), `Detail report (${lang}) should include WAL size`);
      for (const [k, v] of Object.entries(labels)) {
        assert.equal(CJK_RE.test(v), false, `CJK leak in STORAGE_WB_I18N[${lang}].${k}: ${v}`);
      }
      assert.equal(CJK_RE.test(txt), false, `CJK leak in formatStorageDetailReport(${lang}): ${txt}`);
    }
    const fallbackTxt = arch.formatStorageDetailReport({ ...scan, batches: [] }, 'pt-BR');
    assert.equal(CJK_RE.test(fallbackTxt), false, 'Unknown locale fallback must be en with 0 CJK');
  } finally {
    fs.rmSync(tmpRoot, { recursive: true, force: true });
  }
});

test('conversation-archive: validateBatchSelector, isolated >14d & per-batch helper script filenames (never clobber defaults), and CLI --restore <batch> --wait-exit', async () => {
  // 1) Path traversal & shell injection rejection
  assert.equal(arch.validateBatchSelector('latest'), 'latest');
  assert.equal(arch.validateBatchSelector(''), 'latest');
  const validBatch = 'batch-2026-11-25T08-00-00-a1b2c3d4';
  assert.equal(arch.validateBatchSelector(validBatch), validBatch);
  for (const bad of ['../evil', '..\\evil', 'batch-1; rm -rf /', 'batch-1 && echo hi', 'batch-1|cat', '$(id)', 'batch-2026\nfoo']) {
    assert.throws(() => arch.validateBatchSelector(bad), /Invalid archive batch/i, `Must reject ${bad}`);
  }

  const tmpRoot = makeTempDir('ag-prism-wb-scripts-');
  try {
    const convDir = path.join(tmpRoot, 'conversations');
    const archiveDir = path.join(tmpRoot, 'archive');
    const scriptPath = path.join(ROOT, 'sidecars', 'daemon', 'conversation-archive.mjs');

    // 2) First write default subagents + latest restore scripts
    const defaultHelpers = arch.writeHelperScripts({ scriptPath, archiveDir });
    const defaultArchiveContent = fs.readFileSync(defaultHelpers.archiveScriptPath, 'utf8');
    const defaultRestoreContent = fs.readFileSync(defaultHelpers.restoreScriptPath, 'utf8');
    assert.equal(defaultArchiveContent.includes('--include-old-main'), false);
    assert.ok(defaultRestoreContent.includes('--restore latest --wait-exit'));

    // 3) Then write subagents+old-main + specific batch restore -> MUST use isolated filenames & never clobber defaults
    const oldHelpers = arch.writeHelperScripts({
      scriptPath,
      archiveDir,
      mode: 'subagents+old-main',
      mainDays: 14,
      keepRecentMain: 20,
      restoreBatch: validBatch,
    });
    assert.notEqual(
      path.basename(oldHelpers.archiveScriptPath),
      path.basename(defaultHelpers.archiveScriptPath),
      'subagents+old-main must use a dedicated filename instead of overwriting default subagent script'
    );
    assert.ok(path.basename(oldHelpers.archiveScriptPath).startsWith('archive-old-main.'));
    assert.notEqual(
      path.basename(oldHelpers.restoreScriptPath),
      path.basename(defaultHelpers.restoreScriptPath),
      'Specific batch restore script must use a dedicated filename instead of overwriting restore-latest'
    );
    assert.ok(path.basename(oldHelpers.restoreScriptPath).startsWith(`restore-${validBatch}.`));

    // Verify default scripts remained completely untouched!
    assert.equal(fs.readFileSync(defaultHelpers.archiveScriptPath, 'utf8'), defaultArchiveContent);
    assert.equal(fs.readFileSync(defaultHelpers.restoreScriptPath, 'utf8'), defaultRestoreContent);

    const oldArchScript = fs.readFileSync(oldHelpers.archiveScriptPath, 'utf8');
    const batchRestScript = fs.readFileSync(oldHelpers.restoreScriptPath, 'utf8');
    assert.ok(oldArchScript.includes('--include-old-main'));
    assert.ok(oldArchScript.includes('--main-days=14') && oldArchScript.includes('--keep-main=20'));
    assert.ok(batchRestScript.includes(`--restore ${validBatch} --wait-exit`));
    if (process.platform !== 'win32') {
      assert.equal(fs.statSync(oldHelpers.archiveScriptPath).mode & 0o777, 0o700);
      assert.equal(fs.statSync(oldHelpers.restoreScriptPath).mode & 0o777, 0o700);
    }

    // 4) CLI --restore <batch> --wait-exit behavior (timeout abort, wait->exit->restore specific batch, and path traversal block)
    const now = Date.parse('2026-11-25T09:00:00Z');
    const sub1 = 'aaaa1111-1111-4111-8111-111111111111';
    const sub2 = 'aaaa2222-2222-4222-8222-222222222222';
    const main1 = 'bbbb1111-1111-4111-8111-111111111111';
    writeSizedFile(path.join(convDir, `${sub1}.db`), 1024, now - 5 * 3600000);
    writeSizedFile(path.join(convDir, `${main1}.db`), 1024, now - 5 * 3600000);
    const sums1 = {
      [sub1]: { status: 'CASCADE_RUN_STATUS_IDLE', lastModifiedTime: new Date(now - 5 * 3600000).toISOString(), trajectoryMetadata: { parentConversationId: main1 } },
      [main1]: { status: 'CASCADE_RUN_STATUS_IDLE', lastModifiedTime: new Date(now - 5 * 3600000).toISOString() },
    };
    const b1 = arch.archiveConversations({ convDir, archiveDir, summaries: sums1, subagentMaxAgeHours: 1, now: now - 60000, checkRunning: () => false });
    assert.equal(b1.ok, true);

    writeSizedFile(path.join(convDir, `${sub2}.db`), 1024, now - 5 * 3600000);
    const sums2 = {
      ...sums1,
      [sub2]: { status: 'CASCADE_RUN_STATUS_IDLE', lastModifiedTime: new Date(now - 5 * 3600000).toISOString(), trajectoryMetadata: { parentConversationId: main1 } },
    };
    const b2 = arch.archiveConversations({ convDir, archiveDir, summaries: sums2, subagentMaxAgeHours: 1, now, checkRunning: () => false });
    assert.equal(b2.ok, true);
    assert.notEqual(b1.batchName, b2.batchName);

    // 4a) --restore <b1> --wait-exit aborts safely when waitExit times out
    let exitCode = 0;
    let waitCalled = 0;
    const timeoutOut = await arch.executeCli(['--restore', b1.batchName, '--wait-exit', '--json'], {
      convDir,
      archiveDir,
      isRunning: () => true,
      waitExit: async () => { waitCalled += 1; return false; },
      log: () => {},
      error: () => {},
      setExitCode: (c) => { exitCode = c; },
    });
    assert.equal(waitCalled, 1, '--restore --wait-exit must wait for language_server exit when running');
    assert.equal(timeoutOut.ok, false);
    assert.equal(timeoutOut.code, 'WAIT_EXIT_TIMEOUT');
    assert.equal(exitCode, 1);
    assert.equal(fs.existsSync(path.join(convDir, `${sub1}.db`)), false);

    // 4b) --restore <b1> --wait-exit restores chosen older batch b1 once host exits, leaving b2 archived
    let running = true;
    exitCode = 0;
    const okOut = await arch.executeCli(['--restore', b1.batchName, '--wait-exit', '--json'], {
      convDir,
      archiveDir,
      isRunning: () => running,
      waitExit: async () => { running = false; return true; },
      log: () => {},
      error: () => {},
      setExitCode: (c) => { exitCode = c; },
    });
    assert.equal(okOut.ok, true);
    assert.equal(okOut.batchName, b1.batchName);
    assert.equal(okOut.restoredCount, 1);
    assert.equal(exitCode, 0);
    assert.equal(fs.existsSync(path.join(convDir, `${sub1}.db`)), true);
    assert.equal(fs.existsSync(path.join(convDir, `${sub2}.db`)), false);

    // 4c) --restore ../evil --wait-exit rejects immediately BEFORE waiting
    let evilWaitCalled = 0;
    exitCode = 0;
    const badCliOut = await arch.executeCli(['--restore', '../evil', '--wait-exit', '--json'], {
      convDir,
      archiveDir,
      isRunning: () => true,
      waitExit: async () => { evilWaitCalled += 1; return false; },
      log: () => {},
      error: () => {},
      setExitCode: (c) => { exitCode = c; },
    });
    assert.equal(evilWaitCalled, 0, 'Invalid batch selector must be rejected before waiting for exit');
    assert.equal(badCliOut.ok, false);
    assert.equal(badCliOut.code, 'INVALID_BATCH');
    assert.equal(exitCode, 1);

    // 4d) Real CLI subprocess sanity check on path traversal rejection (never touches live user data)
    let cliFailed = false;
    try {
      execFileSync(process.execPath, [scriptPath, '--restore', '../evil', '--wait-exit', '--json'], {
        encoding: 'utf8',
        windowsHide: true,
        stdio: 'pipe',
      });
    } catch (err) {
      cliFailed = true;
      assert.equal(err.status, 1);
      const parsed = JSON.parse(String(err.stdout || '{}'));
      assert.equal(parsed.ok, false);
      assert.equal(parsed.code, 'INVALID_BATCH');
    }
    assert.equal(cliFailed, true, 'Real CLI subprocess must exit 1 on invalid batch selector');
  } finally {
    fs.rmSync(tmpRoot, { recursive: true, force: true });
  }
});

test('PrismDaemon: storage-detail, confirmed >14d prepare-archive, multi-batch restore-archive/prepare-restore, _archiveActionInFlight lock, and REPO_BINDING param passthrough & isolation', async () => {
  const tmpRoot = makeTempDir('ag-prism-wb-daemon-');
  try {
    const convDir = path.join(tmpRoot, 'conversations');
    const archiveDir = path.join(tmpRoot, 'archive');
    const guardStatePath = path.join(tmpRoot, 'guard-state.json');
    const now = Date.parse('2026-11-25T09:00:00Z');
    const sub1 = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1';
    const sub2 = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2';
    const mainOld = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1';

    writeSizedFile(path.join(convDir, `${sub1}.db`), 2 * 1024 * 1024, now - 4 * 3600000);
    writeSizedFile(path.join(convDir, `${mainOld}.db`), 3 * 1024 * 1024, now - 30 * 86400000);
    writeSizedFile(path.join(convDir, `${mainOld}.db-wal`), 256 * 1024, now - 30 * 86400000);

    const summaries = {
      [sub1]: {
        status: 'CASCADE_RUN_STATUS_IDLE',
        stepCount: 5,
        summary: 'Hidden Subagent 1',
        lastModifiedTime: new Date(now - 4 * 3600000).toISOString(),
        trajectoryMetadata: { parentConversationId: mainOld },
      },
      [sub2]: {
        status: 'CASCADE_RUN_STATUS_IDLE',
        stepCount: 6,
        summary: 'Hidden Subagent 2',
        lastModifiedTime: new Date(now - 4 * 3600000).toISOString(),
        trajectoryMetadata: { parentConversationId: mainOld },
      },
      [mainOld]: {
        status: 'CASCADE_RUN_STATUS_IDLE',
        stepCount: 12,
        summary: 'Old Main Conversation ghp_1234567890abcdefghij',
        lastModifiedTime: new Date(now - 30 * 86400000).toISOString(),
      },
    };
    arch.saveCatalogIndex(archiveDir, summaries);

    // Create 2 real archived batches
    const batch1 = arch.archiveConversations({ convDir, archiveDir, summaries, mode: 'subagents', subagentMaxAgeHours: 1, now: now - 120000, checkRunning: () => false });
    assert.equal(batch1.ok, true);
    writeSizedFile(path.join(convDir, `${sub2}.db`), 1 * 1024 * 1024, now - 4 * 3600000);
    const batch2 = arch.archiveConversations({ convDir, archiveDir, summaries, mode: 'subagents', subagentMaxAgeHours: 1, now, checkRunning: () => false });
    assert.equal(batch2.ok, true);

    const daemon = new PrismDaemon({
      rootDir: ROOT,
      storageGuardStatePath: guardStatePath,
      enableStorageGuardTimer: false,
      enableAutoUpdateTimer: false,
      silent: true,
    });
    daemon._lazyStore = { client: { reader: { summaries } } };
    daemon.ensureLsClient = async () => ({ call: async () => ({ trajectorySummaries: summaries }) });

    // 1) storage-detail returns topConsumers (redacted), walMb, batches, localized detailText, and does NOT clobber storage-health cache
    const detail = await daemon._handleStorageAction('storage-detail', { convDir, archiveDir, lsMemoryMb: 1024, now }, { lang: 'ar' });
    assert.equal(detail.ok, true);
    assert.equal(detail.batches.length, 2);
    assert.equal(detail.walMb, 0.3);
    assert.equal(detail.topConsumers[0].id, mainOld);
    assert.equal(detail.topConsumers[0].title.includes('ghp_123456'), false);
    assert.ok(detail.detailText.includes(batch1.batchName) && detail.detailText.includes(batch2.batchName));
    assert.equal(CJK_RE.test(detail.detailText), false, 'Arabic detailText must have 0 CJK leakage');
    assert.equal(daemon._storageHealthCache, null, 'storage-detail must not clobber storage-health cache');

    // 2) prepare-archive(old-main) REQUIRES confirm:true and writes isolated archive-old-main.* without clobbering default script
    const defaultPrep = await daemon._handleStorageAction('prepare-archive', { convDir, archiveDir, skipUsageSnapshot: true, now }, { lang: 'en' });
    assert.equal(defaultPrep.ok, true);
    const defaultText = fs.readFileSync(defaultPrep.archiveScriptPath, 'utf8');

    const unconfirmedOld = await daemon._handleStorageAction(
      'prepare-archive',
      { convDir, archiveDir, skipUsageSnapshot: true, now },
      { lang: 'en', mode: 'subagents+old-main', oldMain: true }
    );
    assert.equal(unconfirmedOld.ok, false);
    assert.equal(unconfirmedOld.error, 'confirmation_required');

    const confirmedOld = await daemon._handleStorageAction(
      'prepare-archive',
      { convDir, archiveDir, skipUsageSnapshot: true, now },
      { lang: 'en', mode: 'subagents+old-main', oldMain: true, confirm: true }
    );
    assert.equal(confirmedOld.ok, true);
    assert.equal(confirmedOld.mode, 'subagents+old-main');
    assert.notEqual(confirmedOld.archiveScriptPath, defaultPrep.archiveScriptPath);
    assert.ok(fs.readFileSync(confirmedOld.archiveScriptPath, 'utf8').includes('--include-old-main'));
    assert.equal(fs.readFileSync(defaultPrep.archiveScriptPath, 'utf8'), defaultText, 'Default subagent script must remain untouched');
    assert.equal(CJK_RE.test(confirmedOld.chipText || ''), false, 'EN old-main chipText must have 0 CJK');

    // 3) prepare-restore writes dedicated batch restore script & rejects missing/malicious batch
    const prepRes = await daemon._handleStorageAction(
      'prepare-restore',
      { convDir, archiveDir, now },
      { lang: 'ar', batch: batch1.batchName }
    );
    assert.equal(prepRes.ok, true);
    assert.equal(prepRes.batchName, batch1.batchName);
    assert.ok(path.basename(prepRes.restoreScriptPath).startsWith(`restore-${batch1.batchName}.`));
    assert.ok(fs.readFileSync(prepRes.restoreScriptPath, 'utf8').includes(`--restore ${batch1.batchName} --wait-exit`));
    assert.equal(CJK_RE.test(prepRes.chipText || ''), false, 'AR prepare-restore chipText must have 0 CJK');

    const badPrepRes = await daemon._handleStorageAction('prepare-restore', { convDir, archiveDir, now }, { batchName: '../escape;id' });
    assert.equal(badPrepRes.ok, false);
    assert.equal(badPrepRes.code, 'INVALID_BATCH');

    // 4) restore-archive supports selecting non-latest batch (via batch or batchName), rejects traversal, and preserves _archiveActionInFlight lock
    const badRestore = await daemon.executeRepoAction({
      action: 'restore-archive',
      confirm: true,
      batchName: '../escape',
      _testOverrides: { convDir, archiveDir, checkIdle: async () => ({ idle: true }) },
    });
    assert.equal(badRestore.ok, false);
    assert.equal(badRestore.code, 'INVALID_BATCH');

    let capturedRestorePayload = null;
    const multiRestore = await daemon.executeRepoAction({
      action: 'restore-archive',
      confirm: true,
      batch: batch1.batchName,
      _testOverrides: {
        convDir,
        archiveDir,
        checkIdle: async () => ({ idle: true }),
        detectHost: async () => ({ pid: 9001, exePath: 'C:\\Antigravity\\Antigravity.exe' }),
        spawnHook: (arg) => {
          capturedRestorePayload = arg.payload;
          return { spawned: true, method: 'mock' };
        },
      },
    });
    assert.equal(multiRestore.ok, true);
    assert.equal(multiRestore.batchName, batch1.batchName);
    assert.equal(capturedRestorePayload.batchName, batch1.batchName);

    // 5) REPO_BINDING whitelist passes through lang/mode/oldMain/batch/batchName/confirm/force and strips _testOverrides/forceBusy/convDir/archiveDir
    const capturedCalls = [];
    daemon.executeRepoAction = async (inp) => {
      capturedCalls.push(inp);
      return { ok: true };
    };
    const fakeEntry = {
      mainFrameId: 'frame-main',
      contextFrames: new Map([[1, { frameId: 'frame-main', isDefault: true, type: 'default' }]]),
      session: {
        closed: false,
        send: async () => ({ result: { value: null } }),
      },
    };
    await daemon.handleBindingCall(fakeEntry, {
      name: REPO_BINDING,
      executionContextId: 1,
      payload: JSON.stringify({
        id: 42,
        action: 'prepare-archive',
        lang: 'ar',
        mode: 'subagents+old-main',
        oldMain: true,
        batch: batch1.batchName,
        batchName: batch1.batchName,
        confirm: true,
        force: true,
        input: {
          _testOverrides: { convDir: '/etc' },
          forceBusy: true,
          convDir: '/etc',
          archiveDir: '/tmp/evil',
        },
      }),
    });
    assert.equal(capturedCalls.length, 1);
    const forwarded = capturedCalls[0];
    assert.equal(forwarded.action, 'prepare-archive');
    assert.equal(forwarded.lang, 'ar');
    assert.equal(forwarded.mode, 'subagents+old-main');
    assert.equal(forwarded.oldMain, true);
    assert.equal(forwarded.batch, batch1.batchName);
    assert.equal(forwarded.batchName, batch1.batchName);
    assert.equal(forwarded.confirm, true);
    assert.equal(forwarded.force, true);
    assert.equal(forwarded._testOverrides, undefined, 'REPO_BINDING must strip _testOverrides');
    assert.equal(forwarded.forceBusy, undefined, 'REPO_BINDING must strip forceBusy');
    assert.equal(forwarded.convDir, undefined, 'REPO_BINDING must strip untrusted convDir');
    assert.equal(forwarded.archiveDir, undefined, 'REPO_BINDING must strip untrusted archiveDir');

    await daemon.stop(false, { skipAutoArchive: true });
  } finally {
    fs.rmSync(tmpRoot, { recursive: true, force: true });
  }
});

test('settings-panel (Ch9): lazy <details> drawer, 3-way mutually exclusive confirm gates (>14d + archive-restart + multi-batch restore), bilingual en/ar 0 CJK leak, and 0 B into Ch1 / 0 BOM / 0 CRLF', async () => {
  // 1) Architecture & engineering gates: settings-panel.js stays in Ch9 (0 B into Ch1), pulse-vial-bridge < 31KB, 0 BOM / 0 CRLF
  assert.equal(cdp.RUNTIME_PARTS.includes('settings-panel.js'), false, 'settings-panel.js must remain outside Ch1 RUNTIME_PARTS');
  assert.ok(fs.statSync(path.join(ROOT, 'pulse-vial-bridge.js')).size < 31000, 'pulse-vial-bridge.js must stay < 31,000 B');
  for (const rel of [
    'sidecars/daemon/conversation-archive.mjs',
    'sidecars/daemon/main.mjs',
    'settings-panel.js',
    'CONTRIBUTORS.md',
    'test/storage-archive-workbench.test.mjs',
  ]) {
    const buf = fs.readFileSync(path.join(ROOT, rel));
    assert.equal(buf[0] === 0xef && buf[1] === 0xbb && buf[2] === 0xbf, false, `${rel} must have 0 BOM`);
    assert.equal(buf.includes(0x0d), false, `${rel} must have 0 CRLF`);
  }

  const prevDoc = globalThis.document;
  const prevWin = globalThis.window;
  const prevStorage = globalThis.localStorage;

  const batchNewest = 'batch-2026-11-25T09-00-00-b2b2b2b2';
  const batchOlder = 'batch-2026-11-25T08-00-00-a1a1a1a1';

  try {
    // 2) Full interactive flow test (EN)
    const { doc } = createMiniDom();
    const storeMap = new Map([['ag-prism:settings-open', '1'], ['ag-prism:settings-subtab', 'about']]);
    const storage = {
      getItem: (k) => (storeMap.has(k) ? storeMap.get(k) : null),
      setItem: (k, v) => storeMap.set(k, String(v)),
      removeItem: (k) => storeMap.delete(k),
    };
    const calls = [];
    const win = {
      document: doc,
      localStorage: storage,
      __agPrismRepoBridge: (payload) => {
        calls.push(payload);
        if (payload.action === 'storage-health') {
          return {
            ok: true,
            totalMb: 1200,
            walMb: 24,
            mainCount: 25,
            subagentCount: 40,
            subagentMb: 600,
            archivableOldMainCount: 5,
            archivableOldMainMb: 300,
            warn: true,
            latestBatch: { batchName: batchNewest, movedCount: 4, movedMb: 120 },
            batches: [
              { batchName: batchNewest, movedCount: 4, movedMb: 120 },
              { batchName: batchOlder, movedCount: 8, movedMb: 320 },
            ],
          };
        }
        if (payload.action === 'storage-detail') {
          return {
            ok: true,
            action: 'storage-detail',
            detailText: 'Breakdown: 1.17 GB | WAL 24.0 MB\nTop 1: Old Main',
            batches: [
              { batchName: batchNewest, movedCount: 4, movedMb: 120 },
              { batchName: batchOlder, movedCount: 8, movedMb: 320 },
            ],
          };
        }
        if (payload.action === 'restore-archive' && payload.listOnly) {
          return {
            ok: true,
            action: 'restore-archive',
            batches: [
              { batchName: batchNewest, movedCount: 4, movedMb: 120 },
              { batchName: batchOlder, movedCount: 8, movedMb: 320 },
            ],
          };
        }
        if (payload.action === 'restore-archive' && payload.confirm) {
          return { ok: true, action: 'restore-archive', scheduled: true, batchName: payload.batchName };
        }
        if (payload.action === 'prepare-archive') {
          const isOld = payload.oldMain === true || payload.mode === 'subagents+old-main';
          return {
            ok: true,
            action: 'prepare-archive',
            mode: isOld ? 'subagents+old-main' : 'subagents',
            archivableSubagentCount: 10,
            archivableSubagentMb: 200,
            archivableOldMainCount: 5,
            archivableOldMainMb: 300,
            archiveScriptPath: isOld ? '/tmp/archive-old-main.command' : '/tmp/archive-subagents.command',
          };
        }
        if (payload.action === 'prepare-restore') {
          return {
            ok: true,
            action: 'prepare-restore',
            batchName: payload.batchName,
            restoreScriptPath: `/tmp/restore-${payload.batchName}.command`,
          };
        }
        return { ok: true, noRemote: true, branch: 'local' };
      },
    };
    globalThis.document = doc;
    globalThis.window = win;
    globalThis.localStorage = storage;

    const state = { ...settingsPanel.getDefaultSettingsPatch(), language: 'en' };
    settingsPanel.mountOrSyncSettingsSection({
      version: '1.0.8',
      getLang: () => state.language,
      uiText: (l) => i18nLocales.getUiStrings(l),
      isZh: () => false,
      i18nCore,
      formatSettingsSummary: () => 'summary',
      resolveSettingRowActiveValue: (k) => state[k],
      isSettingButtonMatch: (_k, valJson, cur) => JSON.parse(valJson) === cur,
      saveSetting: (k, v) => { state[k] = v; },
      saveSettingsBatch: (p) => Object.assign(state, p),
      getThoughtTranslateMode: () => state.thoughtTranslate,
      handledGroupClicks: new WeakSet(),
      runSettingsGroupGlide: () => {},
      runGuardedMut: (fn) => fn(),
    });
    await new Promise((r) => setTimeout(r, 15));

    // Lazy loading: collapsed drawer must NOT request storage-detail
    assert.equal(calls.some((c) => c.action === 'storage-detail'), false, 'storage-detail must stay lazy while drawer is collapsed');

    const sec = doc.getElementById(settingsPanel.SETTINGS_SEC_ID);
    const wb = sec.querySelector('[data-ag-cs-storage-wb="1"]');
    assert.ok(wb, 'Storage workbench details drawer must exist');
    wb.open = true;
    wb.dispatchEvent({ type: 'toggle' });
    await new Promise((r) => setTimeout(r, 15));
    assert.ok(calls.some((c) => c.action === 'storage-detail' && c.lang === 'en'), 'Expanding drawer must fetch storage-detail with lang');
    const pre = sec.querySelector('[data-ag-cs-storage-detail="1"]');
    assert.ok(pre.textContent.includes('WAL 24.0 MB'));

    // >14d preset MUST open secondary confirmation box (NEVER fire prepare-archive directly on first click!)
    const archBox = sec.querySelector('[data-ag-cs-archive-restart-box="1"]');
    const restoreBox = sec.querySelector('[data-ag-cs-storage-restore-box="1"]');
    const oldBox = sec.querySelector('[data-ag-cs-storage-old-box="1"]');
    assert.equal(archBox.hidden, true);
    assert.equal(restoreBox.hidden, true);
    assert.equal(oldBox.hidden, true);

    sec.querySelector('[data-ag-cs-storage-old="1"]').click();
    await new Promise((r) => setTimeout(r, 10));
    assert.equal(oldBox.hidden, false, 'Clicking >14d must open secondary confirm box');
    assert.equal(calls.some((c) => c.action === 'prepare-archive' && c.oldMain === true), false, 'First click on >14d must NOT fire prepare-archive without confirm');

    // 3-way mutual exclusion: opening Archive & Restart closes oldBox; opening Restore closes archBox; opening >14d closes restoreBox
    sec.querySelector('[data-ag-cs-archive-restart="1"]').click();
    assert.equal(archBox.hidden, false);
    assert.equal(oldBox.hidden, true);
    assert.equal(restoreBox.hidden, true);

    sec.querySelector('[data-ag-cs-storage-restore="1"]').click();
    await new Promise((r) => setTimeout(r, 10));
    assert.equal(restoreBox.hidden, false);
    assert.equal(archBox.hidden, true);
    assert.equal(oldBox.hidden, true);

    // Multi-batch <select> inside restoreConfirmBox selects older batch & wires both restore-archive and prepare-restore
    const batchSel = sec.querySelector('[data-ag-cs-storage-batch-select="1"]');
    assert.ok(batchSel, 'Multi-batch select must live inside restoreConfirmBox');
    assert.equal(batchSel.children.length, 2);
    batchSel.value = batchOlder;
    batchSel.dispatchEvent({ type: 'change' });
    assert.ok(restoreBox.textContent.includes(batchOlder), 'Restore description must update to selected batch');

    // Offline restore script for selected older batch
    sec.querySelector('[data-ag-cs-storage-res="1"]').click();
    await new Promise((r) => setTimeout(r, 15));
    assert.ok(calls.some((c) => c.action === 'prepare-restore' && c.batchName === batchOlder && c.lang === 'en'));
    const chip = sec.querySelector('[data-ag-cs-storage-status]');
    assert.equal(chip.getAttribute('data-status'), 'updated');
    assert.ok(chip.textContent.includes(`restore-${batchOlder}.command`));

    // Confirm lossless restore-archive for selected older batch
    sec.querySelector('[data-ag-cs-storage-restore-confirm="1"]').click();
    await new Promise((r) => setTimeout(r, 15));
    assert.ok(calls.some((c) => c.action === 'restore-archive' && c.confirm === true && c.batchName === batchOlder));
    assert.equal(restoreBox.hidden, true);

    // Re-open >14d confirm box and confirm -> sends confirm:true + mode:'subagents+old-main' + oldMain:true
    sec.querySelector('[data-ag-cs-storage-old="1"]').click();
    assert.equal(oldBox.hidden, false);
    sec.querySelector('[data-ag-cs-storage-old-confirm="1"]').click();
    await new Promise((r) => setTimeout(r, 15));
    assert.ok(
      calls.some((c) => c.action === 'prepare-archive' && c.mode === 'subagents+old-main' && c.oldMain === true && c.confirm === true && c.lang === 'en')
    );
    assert.equal(oldBox.hidden, true);
    assert.ok(chip.textContent.includes('archive-old-main.command'));

    // 3) Both bilingual locales (en/ar) mount cleanly with 0 CJK leakage
    for (const lang of SUPPORTED_2) {
      const { doc: langDoc } = createMiniDom();
      const lStore = new Map([['ag-prism:settings-open', '1'], ['ag-prism:settings-subtab', 'about']]);
      const lStorage = {
        getItem: (k) => (lStore.has(k) ? lStore.get(k) : null),
        setItem: (k, v) => lStore.set(k, String(v)),
        removeItem: (k) => lStore.delete(k),
      };
      globalThis.document = langDoc;
      globalThis.localStorage = lStorage;
      globalThis.window = {
        document: langDoc,
        localStorage: lStorage,
        __agPrismRepoBridge: (p) => {
          if (p.action === 'storage-health') {
            return { ok: true, totalMb: 512, mainCount: 10, subagentCount: 5, subagentMb: 100, warn: false, batches: [{ batchName: batchNewest, movedCount: 2, movedMb: 50 }] };
          }
          return { ok: true, noRemote: true, branch: 'local' };
        },
      };
      const lState = { ...settingsPanel.getDefaultSettingsPatch(), language: lang };
      settingsPanel.mountOrSyncSettingsSection({
        version: '1.0.8',
        getLang: () => lang,
        uiText: (l) => i18nLocales.getUiStrings(l),
        isZh: () => false,
        i18nCore,
        formatSettingsSummary: () => 'summary',
        resolveSettingRowActiveValue: (k) => lState[k],
        isSettingButtonMatch: (_k, valJson, cur) => JSON.parse(valJson) === cur,
        saveSetting: (k, v) => { lState[k] = v; },
        saveSettingsBatch: (p) => Object.assign(lState, p),
        getThoughtTranslateMode: () => lState.thoughtTranslate,
        handledGroupClicks: new WeakSet(),
        runSettingsGroupGlide: () => {},
        runGuardedMut: (fn) => fn(),
      });
      await new Promise((r) => setTimeout(r, 10));
      const lSec = langDoc.getElementById(settingsPanel.SETTINGS_SEC_ID);
      assert.ok(lSec.querySelector('[data-ag-cs-storage-wb="1"]'), `Workbench drawer must mount for ${lang}`);
      assert.equal(CJK_RE.test(lSec.textContent), false, `Settings panel (${lang}) leaked CJK: ${lSec.textContent}`);
    }
  } finally {
    if (prevDoc === undefined) delete globalThis.document;
    else globalThis.document = prevDoc;
    if (prevWin === undefined) delete globalThis.window;
    else globalThis.window = prevWin;
    if (prevStorage === undefined) delete globalThis.localStorage;
    else globalThis.localStorage = prevStorage;
  }
});

test('Windows tray graceful quit via loopback CDP Browser.close, Antigravity target verification, timeout fallback, cdpPort sanitization, and dark-mode storage-guard banner contrast', async () => {
  const antigravityTargets = [
    {
      id: 'ag-1',
      type: 'page',
      title: 'obsidian-prism - Antigravity',
      url: 'vscode-file://vscode-app/workbench.html',
      webSocketDebuggerUrl: 'ws://127.0.0.1:7530/devtools/page/ag-1',
    },
  ];
  const makeCdpFetch = (versionPayload = {}, listPayload = antigravityTargets, listOk = true) => async (url) => {
    if (url.endsWith('/json/version')) {
      return {
        ok: true,
        json: async () => ({
          Browser: 'Chrome/132.0.0.0',
          webSocketDebuggerUrl: 'ws://127.0.0.1:7530/devtools/browser/abc-123',
          ...versionPayload,
        }),
      };
    }
    if (url.endsWith('/json/list')) {
      return { ok: listOk, json: async () => listPayload };
    }
    throw new Error(`Unexpected fetch URL: ${url}`);
  };

  // 1) requestCdpBrowserClose rejects invalid ports & non-loopback / wrong-port / non-browser WS URLs
  for (const badPort of [0, -1, 65536, 99999, '7530a', NaN, null, undefined]) {
    let called = false;
    const ok = await arch.requestCdpBrowserClose(badPort, {
      fetchImpl: async () => { called = true; return { ok: true, json: async () => ({}) }; },
    });
    assert.equal(ok, false);
    assert.equal(called, false, `Invalid port ${String(badPort)} must not issue fetch`);
  }

  for (const evilUrl of [
    'ws://evil.example:7530/devtools/browser/1',
    'wss://127.0.0.1:7530/devtools/browser/1',
    'ws://127.0.0.1:9999/devtools/browser/1',
    'ws://127.0.0.1:7530/devtools/page/1',
    'http://127.0.0.1:7530/devtools/browser/1',
  ]) {
    let wsCreated = false;
    const ok = await arch.requestCdpBrowserClose(7530, {
      fetchImpl: makeCdpFetch({ webSocketDebuggerUrl: evilUrl }),
      WebSocketCtor: class { constructor() { wsCreated = true; } },
    });
    assert.equal(ok, false);
    assert.equal(wsCreated, false, `Untrusted WS URL ${evilUrl} must be rejected before opening socket`);
  }

  // 2) Non-Antigravity /json/list ports (Chrome, Edge, VS Code, generic Electron, empty/error) & mismatched expectedBrowserWsPath MUST be rejected before opening WebSocket
  const foreignListScenarios = [
    {
      label: 'Chrome browser tabs',
      targets: [{ id: 'c1', type: 'page', title: 'Google', url: 'https://www.google.com/', webSocketDebuggerUrl: 'ws://127.0.0.1:7530/devtools/page/c1' }],
    },
    {
      label: 'Edge browser UA',
      version: { Browser: 'Edg/132.0.0.0', 'User-Agent': 'Mozilla/5.0 Edg/132.0.0.0' },
      targets: [{ id: 'e1', type: 'page', title: 'New tab', url: 'edge://newtab/', webSocketDebuggerUrl: 'ws://127.0.0.1:7530/devtools/page/e1' }],
    },
    {
      label: 'VS Code window (not Antigravity)',
      targets: [{ id: 'v1', type: 'page', title: 'my-project - Visual Studio Code', url: 'vscode-file://vscode-app/workbench.html', webSocketDebuggerUrl: 'ws://127.0.0.1:7530/devtools/page/v1' }],
    },
    {
      label: 'Generic Electron app',
      targets: [{ id: 'g1', type: 'page', title: 'Discord', url: 'http://localhost:3000/app', webSocketDebuggerUrl: 'ws://127.0.0.1:7530/devtools/page/g1' }],
    },
    {
      label: 'Empty /json/list',
      targets: [],
    },
    {
      label: 'Failed /json/list (HTTP 500)',
      targets: [],
      listOk: false,
    },
  ];
  for (const sc of foreignListScenarios) {
    let wsCreated = false;
    const ok = await arch.requestCdpBrowserClose(7530, {
      fetchImpl: makeCdpFetch(sc.version || {}, sc.targets, sc.listOk !== false),
      WebSocketCtor: class { constructor() { wsCreated = true; } },
    });
    assert.equal(ok, false, `${sc.label} must be rejected without closing`);
    assert.equal(wsCreated, false, `${sc.label} must not open browser WebSocket`);
  }

  {
    let wsCreated = false;
    const mismatchOk = await arch.requestCdpBrowserClose(7530, {
      expectedBrowserWsPath: '/devtools/browser/expected-guid-111',
      fetchImpl: makeCdpFetch({ webSocketDebuggerUrl: 'ws://127.0.0.1:7530/devtools/browser/other-guid-999' }),
      WebSocketCtor: class { constructor() { wsCreated = true; } },
    });
    assert.equal(mismatchOk, false, 'Mismatched DevToolsActivePort browser GUID must be rejected');
    assert.equal(wsCreated, false);
  }

  // 3) Happy path: loopback Browser.close returns true on JSON-RPC ACK or immediate socket close after send (including Swarm OOPIF target match)
  const sentMessages = [];
  class MockAckWs {
    constructor(url) {
      this.url = url;
      this._listeners = new Map();
      queueMicrotask(() => this._emit('open'));
    }
    addEventListener(ev, fn) {
      if (!this._listeners.has(ev)) this._listeners.set(ev, []);
      this._listeners.get(ev).push(fn);
    }
    _emit(ev, arg) {
      for (const fn of this._listeners.get(ev) || []) fn(arg);
    }
    send(payload) {
      sentMessages.push(JSON.parse(payload));
      queueMicrotask(() => this._emit('message', { data: JSON.stringify({ id: 1, result: {} }) }));
    }
    close() {}
  }
  const ackOk = await arch.requestCdpBrowserClose(7530, {
    expectedBrowserWsPath: '/devtools/browser/abc-123',
    fetchImpl: makeCdpFetch({ webSocketDebuggerUrl: 'ws://127.0.0.1:7530/devtools/browser/abc-123' }),
    WebSocketCtor: MockAckWs,
  });
  assert.equal(ackOk, true);
  assert.deepEqual(sentMessages, [{ id: 1, method: 'Browser.close' }]);

  class MockCloseOnQuitWs extends MockAckWs {
    send(payload) {
      sentMessages.push(JSON.parse(payload));
      queueMicrotask(() => this._emit('close'));
    }
  }
  const closeOk = await arch.requestCdpBrowserClose(7530, {
    fetchImpl: makeCdpFetch(
      { webSocketDebuggerUrl: 'ws://127.0.0.1:7530/devtools/browser/abc-456' },
      [{ id: 'sw1', type: 'iframe', title: 'Swarm', url: 'plugin://swarm--swarm_board-1/', webSocketDebuggerUrl: 'ws://127.0.0.1:7530/devtools/page/sw1' }]
    ),
    WebSocketCtor: MockCloseOnQuitWs,
  });
  assert.equal(closeOk, true, 'Socket closing right after Browser.close send must be treated as accepted quit');

  // 4) Timeout without ACK or close MUST return false (fail-closed) and immediately trigger Win32 CloseMainWindow fallback
  class MockHangingWs extends MockAckWs {
    send(payload) {
      sentMessages.push(JSON.parse(payload));
      // Intentionally neither emits {id:1} message nor closes socket
    }
  }
  let timeoutFallbackCalls = 0;
  const quitOnCdpTimeout = await arch.requestGracefulHostQuit(1234, 'C:\\Antigravity\\Antigravity.exe', 'win32', {
    cdpPort: 7530,
    timeoutMs: 200,
    fetchImpl: makeCdpFetch(),
    WebSocketCtor: MockHangingWs,
    execFileSyncFn: () => { timeoutFallbackCalls += 1; },
  });
  assert.equal(quitOnCdpTimeout, true);
  assert.equal(timeoutFallbackCalls, 1, 'CDP Browser.close timeout without ACK must return false and immediately fall back to Win32 CloseMainWindow');

  // 5) requestGracefulHostQuit uses CDP Browser.close first (skipping WM_CLOSE when accepted) and falls back to CloseMainWindow on failure
  let psFallbackCalls = 0;
  const cdpPortsTried = [];
  const quitViaCdp = await arch.requestGracefulHostQuit(1234, 'C:\\Antigravity\\Antigravity.exe', 'win32', {
    cdpPort: 7530,
    requestCdpClose: async (p) => { cdpPortsTried.push(p); return true; },
    execFileSyncFn: () => { psFallbackCalls += 1; },
  });
  assert.equal(quitViaCdp, true);
  assert.deepEqual(cdpPortsTried, [7530]);
  assert.equal(psFallbackCalls, 0, 'When CDP Browser.close succeeds, Win32 WM_CLOSE fallback must not be invoked');

  const quitFallback = await arch.requestGracefulHostQuit(1234, 'C:\\Antigravity\\Antigravity.exe', 'win32', {
    cdpPort: 7530,
    requestCdpClose: async (p) => { cdpPortsTried.push(p); return false; },
    execFileSyncFn: () => { psFallbackCalls += 1; },
  });
  assert.equal(quitFallback, true);
  assert.equal(psFallbackCalls, 1, 'When CDP Browser.close fails, Win32 CloseMainWindow fallback must run');

  // 6) spawnDetachedArchiveTask persists valid cdpPort/cdpBrowserWsPath & sanitizes invalid inputs, executeArchiveTaskSequence clears cdpPort on nudge, and PrismDaemon forwards cdpPort/browserPort
  const tmpRoot = makeTempDir('ag-prism-win-tray-');
  try {
    const convDir = path.join(tmpRoot, 'conversations');
    const archiveDir = path.join(tmpRoot, 'archive');
    fs.mkdirSync(convDir, { recursive: true });
    let capturedValid = null;
    let capturedInvalid = null;
    arch.spawnDetachedArchiveTask(
      { action: 'archive-and-restart', convDir, archiveDir, cdpPort: 7530, cdpBrowserWsPath: '/devtools/browser/ok-guid', gracefulQuit: true, relaunch: true },
      { spawnHook: (arg) => { capturedValid = arg.payload; return { spawned: true, method: 'mock' }; } }
    );
    arch.spawnDetachedArchiveTask(
      { action: 'archive-and-restart', convDir, archiveDir, cdpPort: 'evil:99999', cdpBrowserWsPath: '/devtools/page/evil\n', gracefulQuit: true, relaunch: true },
      { spawnHook: (arg) => { capturedInvalid = arg.payload; return { spawned: true, method: 'mock' }; } }
    );
    assert.equal(capturedValid.cdpPort, 7530);
    assert.equal(capturedValid.cdpBrowserWsPath, '/devtools/browser/ok-guid');
    assert.equal(capturedInvalid.cdpPort, 0);
    assert.equal(capturedInvalid.cdpBrowserWsPath, '');

    const quitTrace = [];
    let checks = 0;
    const seqOut = await arch.executeArchiveTaskSequence(
      { action: 'archive-and-restart', convDir, archiveDir, hostPid: 555, cdpPort: 7530, cdpBrowserWsPath: '/devtools/browser/ok-guid', gracefulQuit: true, relaunch: false, waitExitTimeoutMs: 600, pollMs: 50, settleMs: 0, recheckGapMs: 0 },
      {
        sleep: (ms) => new Promise((r) => setTimeout(r, ms)),
        checkRunning: () => (++checks < 8),
        requestGracefulQuit: async (pid, _exe, opts) => { quitTrace.push({ pid, cdpPort: opts?.cdpPort, expectedBrowserWsPath: opts?.expectedBrowserWsPath, attempt: opts?.attempt }); return true; },
        archiveFn: () => ({ ok: true, movedCount: 0, movedMb: 0 }),
      }
    );
    assert.equal(seqOut.ok, true);
    assert.equal(quitTrace[0].cdpPort, 7530);
    assert.equal(quitTrace[0].expectedBrowserWsPath, '/devtools/browser/ok-guid');
    assert.equal(quitTrace[0].attempt, 1);
    if (quitTrace.length > 1) {
      assert.equal(quitTrace[1].cdpPort, 0, 'Nudge retry must fall back to OS-level graceful quit');
      assert.equal(quitTrace[1].attempt, 2);
    }

    const daemon = new PrismDaemon({
      rootDir: ROOT,
      storageGuardStatePath: path.join(tmpRoot, 'guard.json'),
      enableStorageGuardTimer: false,
      enableAutoUpdateTimer: false,
      silent: true,
    });
    let daemonPayload = null;
    const schedRes = await daemon.executeRepoAction({
      action: 'archive-and-restart',
      confirm: true,
      _testOverrides: {
        convDir,
        archiveDir,
        cdpPort: 17530,
        skipUsageSnapshot: true,
        checkIdle: async () => ({ idle: true }),
        detectHost: async () => ({ pid: 8888, exePath: 'C:\\Antigravity\\Antigravity.exe' }),
        spawnHook: (arg) => { daemonPayload = arg.payload; return { spawned: true, method: 'mock' }; },
      },
    });
    assert.equal(schedRes.ok, true);
    assert.equal(daemonPayload.cdpPort, 17530);

    // Verify _resolveCdpQuitTarget uses live verified this.browserPort (not undefined this.cdpPort) when running normally
    daemon.browserPort = 27530;
    const resolvedTarget = daemon._resolveCdpQuitTarget(null);
    assert.equal(resolvedTarget.cdpPort, 27530);
    await daemon.stop(false, { skipAutoArchive: true });
  } finally {
    fs.rmSync(tmpRoot, { recursive: true, force: true });
  }

  // 7) storage-guard-ui.mjs light-theme selectors must NOT use html:not(.dark) (which falsely matches dark Antigravity where .dark is on <body>)
  const bannerExpr = buildStorageGuardBannerExpression({ copy: {} });
  assert.equal(bannerExpr.includes('html:not(.dark)'), false, 'storage-guard-ui CSS must never use html:not(.dark)');
  const bannerSrc = fs.readFileSync(path.join(ROOT, 'sidecars', 'daemon', 'storage-guard-ui.mjs'), 'utf8');
  assert.equal(bannerSrc.includes('html:not(.dark)'), false, 'storage-guard-ui.mjs must never use html:not(.dark)');
  assert.ok(bannerSrc.includes('html[data-ag-cs-theme="light"]'), 'light title/button styles must target html[data-ag-cs-theme="light"]');
  assert.ok(bannerSrc.includes('html>body:is(.theme-light,.light-theme,.light)'), 'light styles must support body light-theme classes');
  assert.ok(bannerExpr.includes('html\\u003ebody:is(.theme-light,.light-theme,.light)'), 'serialized banner expression must preserve body light-theme selector with XSS-escaped >');
});
