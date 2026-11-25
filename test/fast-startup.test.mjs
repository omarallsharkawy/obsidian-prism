import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { PrismDaemon } from '../sidecars/daemon/main.mjs';

const require = createRequire(import.meta.url);
const installer = require('../tools/install-plugin.cjs');

test('DevToolsActivePort fs.watch wakes daemon within ~150ms instead of waiting 3s pollInterval', async () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'prism-fast-watch-'));
  const portFile = path.join(tmpDir, 'DevToolsActivePort');
  let listCalls = 0;
  let seenPort = null;

  const daemon = new PrismDaemon({
    rootDir: path.resolve(import.meta.dirname, '..'),
    portFile,
    pollIntervalMs: 30000,
    enabledCheck: () => true,
    enableAutoUpdateTimer: false,
    enableStorageGuardTimer: false,
    silent: true,
  });
  daemon.cdp = {
    ...daemon.cdp,
    listPages: async (p) => {
      listCalls += 1;
      seenPort = p;
      return [];
    },
    getBrowserWsUrl: async () => null,
  };

  try {
    daemon.start({ claimPid: false, watchFiles: true });
    await new Promise((r) => setTimeout(r, 80));
    const beforeCalls = listCalls;
    const t0 = Date.now();
    fs.writeFileSync(portFile, '43210\n/devtools/browser/test\n', 'utf8');

    for (let i = 0; i < 40 && seenPort !== 43210; i++) {
      await new Promise((r) => setTimeout(r, 20));
    }
    const elapsedMs = Date.now() - t0;
    assert.equal(seenPort, 43210, 'fs.watch must detect DevToolsActivePort update immediately');
    assert.ok(listCalls > beforeCalls, 'tick must invoke listPages after DevToolsActivePort write');
    assert.ok(elapsedMs < 1000, `Expected < 1000ms wake via fs.watch, got ${elapsedMs}ms`);
  } finally {
    await daemon.stop(false, { skipAutoArchive: true });
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('applyToEntry injects Channel 1 immediately before ensureOmniServer resolves', async () => {
  const order = [];
  let releaseOmni;
  const omniGate = new Promise((r) => { releaseOmni = r; });

  const daemon = new PrismDaemon({
    rootDir: path.resolve(import.meta.dirname, '..'),
    enabledCheck: () => true,
    enableAutoUpdateTimer: false,
    enableStorageGuardTimer: false,
    silent: true,
  });
  daemon.injectExpr = '(() => ({ status: "ok" }))()';
  daemon.omniExpr = '';
  daemon.hostI18nExpr = '';
  daemon.inlineDiffExpr = '';
  daemon.wallpaperExpr = '';
  daemon.suggesterExpr = '';
  daemon.periodicPickerExpr = '';
  daemon.mascotExpr = '';
  daemon.homeStudioExpr = '';
  daemon._isOmniEnabled = () => true;
  daemon._isSidebarStudioEnabled = () => false;
  daemon._isHostI18nEnabled = () => false;
  daemon._isThoughtEnabled = () => false;
  daemon._isPeriodicPickerEnabled = () => false;
  daemon._isMascotEnabled = () => false;
  daemon._isHomeStudioEnabled = () => false;
  daemon.ensureOmniServer = async () => {
    order.push('omni:start');
    await omniGate;
    order.push('omni:done');
    return null;
  };

  const entry = {
    sidebarDocument: 0,
    scriptId: null,
    _opChain: Promise.resolve(),
    session: {
      closed: false,
      send: async (method) => {
        if (method === 'Page.addScriptToEvaluateOnNewDocument') {
          order.push('ch1:addScript');
          return { identifier: 's1' };
        }
        return {};
      },
      evaluate: async () => {
        order.push('ch1:eval');
        releaseOmni();
        return { status: 'ok' };
      },
    },
  };

  const res = await daemon.applyToEntry(entry);
  assert.equal(res.status, 'ok');
  assert.ok(order.indexOf('ch1:eval') >= 0, 'Channel 1 evaluate must execute');
  assert.ok(order.indexOf('ch1:eval') < order.indexOf('omni:done'), 'Channel 1 must not wait for Omni server startup');
});

test('hasMatchingPersistentOwner yields to matching persistent daemon and detects code upgrade', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'prism-persist-'));
  const fakeCdp = path.join(tmpDir, 'cdp.js');
  fs.writeFileSync(fakeCdp, 'module.exports = { readConfig: () => ({}), DEFAULT_CONFIG: {}, isExpectedDaemonProcess: () => true };\n', 'utf8');

  try {
    const d1 = new PrismDaemon({
      rootDir: tmpDir,
      persistent: true,
      daemonPidVerifier: () => true,
      enableAutoUpdateTimer: false,
      enableStorageGuardTimer: false,
      silent: true,
    });
    fs.writeFileSync(
      d1.pidFile,
      JSON.stringify({ pid: process.ppid || 1, token: 'tok', persistent: true, rootDir: tmpDir, cdpSig: d1._cdpFileSig }),
      'utf8'
    );

    const d2 = new PrismDaemon({
      rootDir: tmpDir,
      persistent: false,
      daemonPidVerifier: () => true,
      enableAutoUpdateTimer: false,
      enableStorageGuardTimer: false,
      silent: true,
    });
    const match = d2.hasMatchingPersistentOwner();
    assert.ok(match && match.pid === (process.ppid || 1), 'Sidecar should yield to matching persistent daemon');

    // Simulate upgraded cdp.js signature -> must NOT yield
    fs.writeFileSync(
      d1.pidFile,
      JSON.stringify({ pid: process.ppid || 1, token: 'tok', persistent: true, rootDir: tmpDir, cdpSig: 'old-sig' }),
      'utf8'
    );
    assert.equal(d2.hasMatchingPersistentOwner(), null, 'Upgraded daemon must take over from stale persistent daemon');
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('installLinuxSystemdWatcher writes --persistent unit and removeLinuxSystemdWatcher cleans it up', () => {
  const tmpHome = fs.mkdtempSync(path.join(os.tmpdir(), 'prism-systemd-'));
  const calls = [];
  const fakeRun = (args) => {
    calls.push(args.join(' '));
    return true;
  };
  try {
    const res = installer.installLinuxSystemdWatcher({
      targetDir: '/home/test/.gemini/config/plugins/obsidian-prism',
      repoDir: '/home/test/obsidian-prism',
      nodeExe: '/usr/bin/node',
      homeDir: tmpHome,
      runSystemctl: fakeRun,
    });
    assert.equal(res.installed, true);
    assert.equal(res.active, true);
    const unit = fs.readFileSync(res.unitPath, 'utf8');
    assert.ok(unit.includes('--persistent'));
    assert.ok(unit.includes('main.mjs'));
    assert.deepEqual(calls, ['daemon-reload', 'enable obsidian-prism.service', 'restart obsidian-prism.service']);

    const rm = installer.removeLinuxSystemdWatcher({ homeDir: tmpHome, runSystemctl: fakeRun });
    assert.equal(rm.removed, true);
    assert.equal(fs.existsSync(res.unitPath), false);
  } finally {
    fs.rmSync(tmpHome, { recursive: true, force: true });
  }
});
