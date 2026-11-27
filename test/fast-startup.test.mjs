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

    // Simulate upgraded cdp.js signature from an OLDER persistent daemon -> newer daemon must NOT yield
    fs.writeFileSync(
      d1.pidFile,
      JSON.stringify({ pid: process.ppid || 1, token: 'tok', persistent: true, rootDir: tmpDir, cdpSig: 'old-sig', startedAt: Date.now() - 60000 }),
      'utf8'
    );
    assert.equal(d2.hasMatchingPersistentOwner(), null, 'Upgraded daemon must take over from stale persistent daemon');

    // Simulate an OLDER parked sidecar seeing a NEWER persistent daemon with an updated cdpSig -> older sidecar MUST yield
    fs.writeFileSync(
      d1.pidFile,
      JSON.stringify({ pid: process.ppid || 1, token: 'tok', persistent: true, rootDir: tmpDir, cdpSig: 'newer-sig', startedAt: Date.now() + 60000 }),
      'utf8'
    );
    const newerMatch = d2.hasMatchingPersistentOwner();
    assert.ok(newerMatch && newerMatch.pid === (process.ppid || 1), 'Older parked sidecar must yield to newer persistent daemon even after upgrade');
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

test('installMacosLaunchAgentWatcher writes --persistent LaunchAgent plist and removes cleanly', () => {
  const tmpHome = fs.mkdtempSync(path.join(os.tmpdir(), 'prism-macos-agent-'));
  const calls = [];
  const fakeLaunchctl = (args) => {
    calls.push(args.join(' '));
    return true;
  };
  try {
    const res = installer.installMacosLaunchAgentWatcher({
      targetDir: '/Users/test/.gemini/config/plugins/obsidian-prism',
      repoDir: '/Users/test/obsidian-prism',
      nodeExe: '/usr/local/bin/node',
      homeDir: tmpHome,
      runLaunchctl: fakeLaunchctl,
    });
    assert.equal(res.installed, true);
    assert.equal(res.active, true);
    const plist = fs.readFileSync(res.plistPath, 'utf8');
    assert.ok(plist.includes('com.obsidian-prism.daemon'));
    assert.ok(plist.includes('<string>--persistent</string>'));
    assert.ok(plist.includes('<key>RunAtLoad</key>'));
    assert.ok(calls.some((c) => c.startsWith('bootstrap gui/')));
    assert.equal(installer.isStandaloneWatcherInstalled({ platformOverride: 'darwin', homeDir: tmpHome }), true);

    const rm = installer.removeMacosLaunchAgentWatcher({ homeDir: tmpHome, runLaunchctl: fakeLaunchctl });
    assert.equal(rm.removed, true);
    assert.equal(fs.existsSync(res.plistPath), false);
    assert.equal(installer.isStandaloneWatcherInstalled({ platformOverride: 'darwin', homeDir: tmpHome }), false);
  } finally {
    fs.rmSync(tmpHome, { recursive: true, force: true });
  }
});

test('installWindowsStartupWatcher writes silent VBS --persistent launcher, registers HKCU Run, and removes cleanly', () => {
  const tmpTarget = fs.mkdtempSync(path.join(os.tmpdir(), 'prism-win-startup-'));
  const regCalls = [];
  const fakeReg = (args) => {
    regCalls.push(args);
    return true;
  };
  try {
    const res = installer.installWindowsStartupWatcher({
      targetDir: tmpTarget,
      repoDir: 'C:\\Users\\Test\\obsidian-prism',
      nodeExe: 'C:\\Program Files\\nodejs\\node.exe',
      runReg: fakeReg,
    });
    assert.equal(res.installed, true);
    assert.equal(res.registered, true);
    const vbs = fs.readFileSync(res.vbsPath, 'utf8');
    assert.ok(vbs.includes('WScript.Shell'));
    assert.ok(vbs.includes('--persistent'));
    assert.ok(vbs.includes(', 0, False'));
    assert.equal(regCalls[0][0], 'add');
    assert.ok(regCalls[0].includes('ObsidianPrismDaemon'));
    assert.equal(installer.isStandaloneWatcherInstalled({ platformOverride: 'win32', targetDir: tmpTarget }), true);

    const rm = installer.removeWindowsStartupWatcher({ targetDir: tmpTarget, runReg: fakeReg });
    assert.equal(rm.removed, true);
    assert.equal(fs.existsSync(res.vbsPath), false);
    assert.equal(regCalls[1][0], 'delete');
  } finally {
    fs.rmSync(tmpTarget, { recursive: true, force: true });
  }
});

test('Windows C# and macOS Swift standalone watchers include instant DevToolsActivePort file watching', () => {
  const winWatcher = fs.readFileSync(path.resolve(import.meta.dirname, '..', 'installer', 'watcher', 'Program.cs'), 'utf8');
  assert.ok(winWatcher.includes('new FileSystemWatcher(agConfigDir, "DevToolsActivePort")'));
  assert.ok(winWatcher.includes('portWakeEvent'));

  const macWatcher = fs.readFileSync(path.resolve(import.meta.dirname, '..', 'installer', 'macos', 'Watcher', 'main.swift'), 'utf8');
  assert.ok(macWatcher.includes('DevToolsActivePort'));
  assert.ok(macWatcher.includes('portDirSource'));
  assert.ok(macWatcher.includes('fastRetryDeadline'));
});

test('telemetry freshness, RTL unit isolation, and freeze/pointer-capture recovery stay wired', () => {
  const root = path.resolve(import.meta.dirname, '..');
  const storeSrc = fs.readFileSync(path.join(root, 'vendor', 'pulse-dashboard', 'sidecars', 'panel', 'store.mjs'), 'utf8');
  assert.ok(storeSrc.includes('RetrieveUserQuotaSummary'), 'store.mjs should call RetrieveUserQuotaSummary');
  assert.ok(storeSrc.includes('forceRefresh: true'), 'store.mjs must force-refresh quota summary to avoid stale LS limits');
  assert.ok(storeSrc.includes('< 12_000') || storeSrc.includes('< 12000'), 'store.mjs quota TTL should be 12s');
  assert.ok(storeSrc.includes('< 1800'), 'store.mjs session hot TTL should be 1800ms');

  const fallbackSrc = fs.readFileSync(path.join(root, 'vendor', 'pulse-dashboard', 'inline-fallback.js'), 'utf8');
  assert.ok(fallbackSrc.includes('direction:ltr;unicode-bidi:isolate'), 'inline-fallback.js must isolate LTR numeric/unit readouts in RTL mode');
  assert.ok(fallbackSrc.includes('quotaRefresh: true'), 'opening telemetry popover must force quota refresh');
  assert.ok(fallbackSrc.includes("'pointerdown'"), 'outside pointerdown must close stuck telemetry popover');

  const mascotSrc = fs.readFileSync(path.join(root, 'dual-mascot-rig.js'), 'utf8');
  assert.ok(mascotSrc.includes('lostpointercapture'), 'dual-mascot-rig.js must recover on lostpointercapture');

  const pickerSrc = fs.readFileSync(path.join(root, 'vendor', 'periodic-picker', 'periodic-picker.js'), 'utf8');
  assert.ok(pickerSrc.includes('lostpointercapture'), 'periodic-picker.js must recover on lostpointercapture');
});

test('CdpSession.close() marks session closed synchronously even on zombie half-open sockets', async () => {
  const cdp = require('../cdp.js');
  let closeCalls = 0;
  let onCloseFired = 0;
  const fakeWs = {
    addEventListener() {},
    send() {},
    close() {
      closeCalls += 1;
      // Intentionally never emits "close" (simulates half-open socket inherited by xdg-open/browser)
    },
  };
  const sess = new cdp.CdpSession(fakeWs);
  sess.onClose = () => {
    onCloseFired += 1;
  };
  const pending = sess.send('Runtime.evaluate', { expression: '1' }, 5000);
  sess.close();
  assert.equal(sess.closed, true, 'CdpSession.close() must set closed=true synchronously');
  assert.equal(closeCalls, 1);
  assert.equal(onCloseFired, 1);
  await assert.rejects(pending, /closed/i);
});

test('tick() evicts stale-port zombie sessions immediately on port change without blocking new-port attach', async () => {
  const cdp = require('../cdp.js');
  const daemon = new PrismDaemon({
    rootDir: path.resolve(import.meta.dirname, '..'),
    overridePort: 34837,
    enabledCheck: () => true,
    enableAutoUpdateTimer: false,
    enableStorageGuardTimer: false,
    silent: true,
  });
  daemon.running = true;
  daemon.injectExpr = '(() => ({ status: "ok" }))()';
  daemon._lastActiveCdpPort = 40983;

  let zombieRpcCalls = 0;
  let zombieCloseCalls = 0;
  const zombieWs = {
    addEventListener() {},
    send() {
      zombieRpcCalls += 1;
    },
    close() {
      zombieCloseCalls += 1;
    },
  };
  const zombieSession = new cdp.CdpSession(zombieWs);
  const oldWsUrl = 'ws://127.0.0.1:40983/devtools/page/OLD';
  daemon.sessions.set(oldWsUrl, {
    wsUrl: oldWsUrl,
    pageId: 'OLD',
    url: 'https://127.0.0.1:41111/',
    title: 'Old Antigravity',
    session: zombieSession,
    scriptId: 's1',
    omniScriptId: 's2',
    hostI18nScriptId: 's3',
    _opChain: Promise.resolve(),
  });

  const attachedTargets = [];
  daemon.cdp = {
    ...daemon.cdp,
    listPages: async (p) => {
      assert.equal(p, 34837);
      return [
        {
          id: 'NEW1',
          type: 'page',
          title: 'Antigravity',
          url: 'https://127.0.0.1:42961/',
          webSocketDebuggerUrl: 'ws://127.0.0.1:34837/devtools/page/NEW1',
        },
      ];
    },
    getBrowserWsUrl: async () => null,
  };
  daemon.attachTarget = async (target) => {
    attachedTargets.push(target.id);
    daemon.sessions.set(target.webSocketDebuggerUrl, {
      wsUrl: target.webSocketDebuggerUrl,
      pageId: target.id,
      session: { closed: false, close() {} },
    });
    return null;
  };

  const t0 = Date.now();
  await daemon.tick();
  const elapsedMs = Date.now() - t0;

  assert.equal(zombieCloseCalls, 1, 'Stale-port zombie session must be closed immediately');
  assert.equal(zombieSession.closed, true, 'Stale-port zombie session must become closed=true');
  assert.equal(zombieRpcCalls, 0, 'Must not send blocking teardown RPCs to a stale port');
  assert.equal(daemon.sessions.has(oldWsUrl), false, 'Old-port session must be evicted');
  assert.deepEqual(attachedTargets, ['NEW1'], 'New-port page must attach immediately on the same tick');
  assert.ok(elapsedMs < 500, `Expected instant port-change failover (<500ms), got ${elapsedMs}ms`);
});
