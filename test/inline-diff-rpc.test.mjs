import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';

import {
  PrismDaemon,
  INLINE_DIFF_BINDING,
  OMNI_BINDING,
  readSafeInlineDiff,
} from '../sidecars/daemon/main.mjs';

const require = createRequire(import.meta.url);
const ROOT_DIR = path.resolve(import.meta.dirname, '..');
const installPluginTool = require(path.join(ROOT_DIR, 'tools', 'install-plugin.cjs'));

function makeTempDir(prefix) {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

function runGit(repoDir, args) {
  return execFileSync('git', ['-C', repoDir, ...args], {
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

function initTempGitRepo(prefix = 'ag-prism-inline-diff-') {
  const repoDir = makeTempDir(prefix);
  runGit(repoDir, ['init']);
  runGit(repoDir, ['config', 'user.name', 'Prism Test']);
  runGit(repoDir, ['config', 'user.email', 'prism-test@example.invalid']);
  runGit(repoDir, ['config', 'core.autocrlf', 'false']);
  return repoDir;
}

test('inline-diff-rpc 1: reads modified git diff, staged (--cached) diff, untracked new file, snapshot, and enforces line/char/byte limits', async () => {
  const repoDir = initTempGitRepo('ag-prism-idiff-git-');
  const outsideDir = makeTempDir('ag-prism-idiff-nongit-');
  try {
    const modFile = path.join(repoDir, 'app.js');
    const stagedFile = path.join(repoDir, 'staged.js');
    const cleanFile = path.join(repoDir, 'clean.js');
    const longFile = path.join(repoDir, 'long.js');

    fs.writeFileSync(modFile, 'const a = 1;\nconst b = 2;\nconst c = 3;\nconst d = 4;\n', 'utf8');
    fs.writeFileSync(stagedFile, 'export const v = 1;\nexport const keep = true;\n', 'utf8');
    fs.writeFileSync(cleanFile, 'line1\nline2\n', 'utf8');
    fs.writeFileSync(
      longFile,
      Array.from({ length: 150 }, (_, i) => `const base_${i} = ${i};`).join('\n') + '\n',
      'utf8'
    );

    runGit(repoDir, ['add', '.']);
    runGit(repoDir, ['commit', '-m', 'init']);

    // 1) Modified (unstaged) diff — test both file:/// URI and raw local path
    fs.writeFileSync(modFile, 'const a = 1;\nconst b = 200;\nconst b2 = 201;\nconst c = 3;\nconst d = 4;\n', 'utf8');
    const modUri = pathToFileURL(modFile).href;
    const modRes = await readSafeInlineDiff(`${modUri}#L2-L3`);
    assert.equal(modRes.ok, true);
    assert.equal(modRes.mode, 'git-diff');
    assert.equal(modRes.fileName, 'app.js');
    assert.equal(modRes.additions, 2);
    assert.equal(modRes.deletions, 1);
    assert.equal(modRes.truncated, false);
    assert.ok(modRes.lines.some((l) => l.kind === 'hunk' && l.sign === '@@'));
    assert.ok(modRes.lines.some((l) => l.kind === 'del' && l.sign === '-' && l.text === 'const b = 2;'));
    assert.ok(modRes.lines.some((l) => l.kind === 'add' && l.sign === '+' && l.text === 'const b = 200;'));
    assert.ok(modRes.lines.some((l) => l.kind === 'add' && l.sign === '+' && l.text === 'const b2 = 201;'));
    assert.ok(modRes.lines.some((l) => l.kind === 'ctx' && l.sign === ' ' && l.text === 'const a = 1;'));

    // Also test Windows-encoded drive colon (file:///c%3A/...) when running on Windows
    if (process.platform === 'win32') {
      const encodedWinUri = modUri.replace(/^file:\/\/\/([A-Za-z]):/, (_, drv) => `file:///${drv.toLowerCase()}%3A`);
      const encodedRes = await readSafeInlineDiff(encodedWinUri);
      assert.equal(encodedRes.ok, true);
      assert.equal(encodedRes.mode, 'git-diff');
      assert.equal(encodedRes.additions, 2);
      assert.equal(encodedRes.deletions, 1);
    }

    // 2) Staged (--cached) diff
    fs.writeFileSync(stagedFile, 'export const v = 2;\nexport const keep = true;\nexport const added = 3;\n', 'utf8');
    runGit(repoDir, ['add', 'staged.js']);
    const stagedRes = await readSafeInlineDiff(stagedFile);
    assert.equal(stagedRes.ok, true);
    assert.equal(stagedRes.mode, 'git-diff');
    assert.equal(stagedRes.fileName, 'staged.js');
    assert.equal(stagedRes.additions, 2);
    assert.equal(stagedRes.deletions, 1);
    assert.ok(stagedRes.lines.some((l) => l.kind === 'del' && l.text === 'export const v = 1;'));
    assert.ok(stagedRes.lines.some((l) => l.kind === 'add' && l.text === 'export const added = 3;'));

    // 3) Untracked new file (including inside a new subdirectory)
    const newSubDir = path.join(repoDir, 'fresh-dir');
    fs.mkdirSync(newSubDir, { recursive: true });
    const untrackedFile = path.join(newSubDir, 'brand-new.ts');
    fs.writeFileSync(untrackedFile, 'export const x = 1;\nexport const y = 2;\n', 'utf8');
    const untrackedRes = await readSafeInlineDiff(pathToFileURL(untrackedFile).href);
    assert.equal(untrackedRes.ok, true);
    assert.equal(untrackedRes.mode, 'new-file');
    assert.equal(untrackedRes.fileName, 'brand-new.ts');
    assert.equal(untrackedRes.additions, 2);
    assert.equal(untrackedRes.deletions, 0);
    assert.equal(untrackedRes.truncated, false);
    assert.deepEqual(untrackedRes.lines, [
      { kind: 'add', ln: '1', sign: '+', text: 'export const x = 1;' },
      { kind: 'add', ln: '2', sign: '+', text: 'export const y = 2;' },
    ]);

    // 4) Clean committed file -> snapshot (all ctx); non-git file -> fail-closed outside_git_repo
    const cleanRes = await readSafeInlineDiff(cleanFile);
    assert.equal(cleanRes.ok, true);
    assert.equal(cleanRes.mode, 'snapshot');
    assert.equal(cleanRes.fileName, 'clean.js');
    assert.equal(cleanRes.lines.every((l) => l.kind === 'ctx' && l.sign === ' '), true);
    assert.equal(cleanRes.lines.length, 2);

    const outsideFile = path.join(outsideDir, 'notes.txt');
    fs.writeFileSync(outsideFile, 'hello\nworld\n', 'utf8');
    const outsideRes = await readSafeInlineDiff(outsideFile);
    assert.equal(outsideRes.ok, false);
    assert.equal(outsideRes.error, 'outside_git_repo');
    assert.equal(outsideRes.reason, 'outside_git_repo');

    // 5) Hard limits: git-diff <= 120 lines & <= 240 chars/line
    const hugeLine = `const wide = "${'x'.repeat(400)}";`;
    fs.writeFileSync(
      longFile,
      [hugeLine, ...Array.from({ length: 149 }, (_, i) => `const updated_${i} = ${i + 1};`)].join('\n') + '\n',
      'utf8'
    );
    const cappedDiff = await readSafeInlineDiff(longFile);
    assert.equal(cappedDiff.ok, true);
    assert.equal(cappedDiff.mode, 'git-diff');
    assert.equal(cappedDiff.truncated, true);
    assert.equal(cappedDiff.lines.length, 120);
    assert.equal(cappedDiff.lines.every((l) => l.text.length <= 240), true);

    // 5b) Hint-Aware Hunk Windowing: leading +140 pure-add hunk must NOT swallow a trailing -2/+2 hunk when hints.deletions > 0
    const multiHunkBase = Array.from({ length: 180 }, (_, i) => `const keep_${i} = ${i};`);
    const multiHunkFile = path.join(repoDir, 'multi-hunk.js');
    fs.writeFileSync(multiHunkFile, multiHunkBase.join('\n') + '\n', 'utf8');
    runGit(repoDir, ['add', 'multi-hunk.js']);
    runGit(repoDir, ['commit', '-m', 'add multi-hunk']);
    const leadingAdds = Array.from({ length: 140 }, (_, i) => `const top_insert_${i} = true;`);
    const modifiedMulti = [
      ...leadingAdds,
      ...multiHunkBase.slice(0, 170),
      'const replaced_a = 999;',
      'const replaced_b = 1000;',
      ...multiHunkBase.slice(172),
    ];
    fs.writeFileSync(multiHunkFile, modifiedMulti.join('\n') + '\n', 'utf8');
    const hintedRes = await readSafeInlineDiff(multiHunkFile, { hints: { additions: 2, deletions: 2 } });
    assert.equal(hintedRes.ok, true);
    assert.equal(hintedRes.focused, true, 'Hint-aware windowing must flag focused=true');
    assert.ok(hintedRes.lines.some((l) => l.kind === 'del' && l.text.includes('keep_170')), 'Must surface trailing deletion hunk instead of truncating inside leading pure-add block');

    // 6) Hard limits: untracked new-file <= 80 lines & <= 240 chars/line & 24 KiB cap
    const manyNewLinesFile = path.join(repoDir, 'many-lines.txt');
    fs.writeFileSync(
      manyNewLinesFile,
      Array.from({ length: 105 }, (_, i) => `row-${i}-${'z'.repeat(280)}`).join('\n') + '\n',
      'utf8'
    );
    const cappedNew = await readSafeInlineDiff(manyNewLinesFile);
    assert.equal(cappedNew.ok, true);
    assert.equal(cappedNew.mode, 'new-file');
    assert.equal(cappedNew.truncated, true);
    assert.ok(cappedNew.lines.length <= 80);
    assert.equal(cappedNew.lines.every((l) => l.kind === 'add' && l.text.length <= 240), true);
  } finally {
    fs.rmSync(repoDir, { recursive: true, force: true });
    fs.rmSync(outsideDir, { recursive: true, force: true });
  }
});

test('inline-diff-rpc 2: detects and safely reports binary files (both untracked NUL bytes and git binary diffs)', async () => {
  const repoDir = initTempGitRepo('ag-prism-idiff-bin-');
  try {
    const trackedBin = path.join(repoDir, 'asset.png');
    const untrackedBin = path.join(repoDir, 'raw.bin');
    fs.writeFileSync(trackedBin, Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d]));
    runGit(repoDir, ['add', 'asset.png']);
    runGit(repoDir, ['commit', '-m', 'add png']);

    // Modify tracked binary file so git diff emits "Binary files ... differ"
    fs.writeFileSync(trackedBin, Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x01, 0x02, 0x03]));
    const trackedBinRes = await readSafeInlineDiff(trackedBin);
    assert.equal(trackedBinRes.ok, true);
    assert.equal(trackedBinRes.mode, 'binary');
    assert.equal(trackedBinRes.fileName, 'asset.png');
    assert.deepEqual(trackedBinRes.lines, []);

    // Untracked binary file with NUL bytes
    fs.writeFileSync(untrackedBin, Buffer.from([0x41, 0x42, 0x00, 0x43, 0x44]));
    const untrackedBinRes = await readSafeInlineDiff(untrackedBin);
    assert.equal(untrackedBinRes.ok, true);
    assert.equal(untrackedBinRes.mode, 'binary');
    assert.equal(untrackedBinRes.fileName, 'raw.bin');
    assert.deepEqual(untrackedBinRes.lines, []);
  } finally {
    fs.rmSync(repoDir, { recursive: true, force: true });
  }
});

test('inline-diff-rpc 3: blocks UNC/SMB paths, traversal, null bytes, invalid schemes, and sensitive files (including symlink escape)', async () => {
  const tmpDir = makeTempDir('ag-prism-idiff-sec-');
  try {
    // 1) UNC / SMB interception (NetNTLMv2 prevention)
    const uncCases = [
      '\\\\attacker.invalid\\share\\leak.txt',
      '//attacker.invalid/share/leak.txt',
      '\\\\?\\UNC\\attacker.invalid\\share\\leak.txt',
      '\\\\.\\UNC\\attacker.invalid\\share\\leak.txt',
      '\\/attacker.invalid\\share\\leak.txt',
      '/\\attacker.invalid/share/leak.txt',
      'file://attacker.invalid/share/leak.txt',
      'file:////attacker.invalid/share/leak.txt',
      'file://localhost/c$/Windows/win.ini',
      'file:///%5C%5Cattacker.invalid%5Cshare%5Cleak.txt',
      '\\\\?\\C:\\Windows\\win.ini',
    ];
    for (const unc of uncCases) {
      const res = await readSafeInlineDiff(unc);
      assert.equal(res.ok, false, `UNC path must be rejected: ${unc}`);
      assert.equal(res.error, 'blocked_unc', `Expected blocked_unc for: ${unc}`);
    }

    // 2) Path traversal (raw and percent-encoded)
    const sampleFile = path.join(tmpDir, 'safe.js');
    fs.writeFileSync(sampleFile, 'const ok = 1;\n', 'utf8');
    const subDir = path.join(tmpDir, 'sub');
    fs.mkdirSync(subDir, { recursive: true });
    const traversalCases = [
      `${subDir}${path.sep}..${path.sep}safe.js`,
      `${pathToFileURL(subDir).href}/../safe.js`,
      `${pathToFileURL(subDir).href}/%2e%2e/safe.js`,
      `${pathToFileURL(subDir).href}/%2E%2E%5Csafe.js`,
    ];
    for (const trav of traversalCases) {
      const res = await readSafeInlineDiff(trav);
      assert.equal(res.ok, false, `Traversal must be rejected: ${trav}`);
      assert.equal(res.error, 'blocked_traversal', `Expected blocked_traversal for: ${trav}`);
    }

    // 3) Null bytes, invalid schemes, relative paths, non-file directory
    for (const bad of [
      '',
      '   ',
      'relative/path/file.js',
      './file.js',
      'http://127.0.0.1:8080/a.js',
      'javascript:alert(1)',
      `${sampleFile}\0.js`,
      `${pathToFileURL(sampleFile).href}%00`,
      'x'.repeat(2049),
    ]) {
      const res = await readSafeInlineDiff(bad);
      assert.equal(res.ok, false, `Invalid URI must be rejected: ${bad.slice(0, 40)}`);
      assert.equal(res.error, 'invalid_uri');
    }

    if (process.platform === 'win32') {
      const adsRes = await readSafeInlineDiff(`${sampleFile}::$DATA`);
      assert.equal(adsRes.ok, false);
      assert.equal(adsRes.error, 'invalid_uri');
    }

    const dirRes = await readSafeInlineDiff(subDir);
    assert.equal(dirRes.ok, false);
    assert.equal(dirRes.error, 'not_a_file');

    // 4) Sensitive file blacklist (real files on disk + system paths)
    const sensitiveRelFiles = [
      'config.json',
      'CONFIG.JSON',
      '.env',
      '.env.local',
      '.env.production',
      'tls.key',
      'private.pem',
      'cert.p12',
      'cert.pfx',
      'obsidian-prism-thought.json',
      'obsidian-prism-thought-cache.json',
      'model-hub.config.json',
      'secrets.json',
      path.join('.ssh', 'id_rsa'),
      path.join('.aws', 'credentials'),
      path.join('.gnupg', 'secring.gpg'),
      path.join('.kube', 'config'),
      path.join('.git', 'config'),
    ];
    for (const rel of sensitiveRelFiles) {
      const fp = path.join(tmpDir, rel);
      fs.mkdirSync(path.dirname(fp), { recursive: true });
      fs.writeFileSync(fp, 'TOP_SECRET=1\n', 'utf8');
      const resRaw = await readSafeInlineDiff(fp);
      assert.equal(resRaw.ok, false, `Sensitive file must be blocked (raw): ${rel}`);
      assert.equal(resRaw.error, 'blocked_sensitive', `Expected blocked_sensitive for: ${rel}`);
      const resUri = await readSafeInlineDiff(pathToFileURL(fp).href);
      assert.equal(resUri.ok, false, `Sensitive file must be blocked (uri): ${rel}`);
      assert.equal(resUri.error, 'blocked_sensitive');
      assert.equal(JSON.stringify(resUri).includes(tmpDir), false, 'Error response must never leak host path');
    }

    for (const sysPath of ['/etc/shadow', 'file:///etc/shadow']) {
      const res = await readSafeInlineDiff(sysPath);
      assert.equal(res.ok, false, `System credential file must be blocked: ${sysPath}`);
      assert.equal(res.error, 'blocked_sensitive');
    }

    // 5) Symlink with benign filename pointing to sensitive file -> blocked via post-realpathSync secondary check
    const envTarget = path.join(tmpDir, '.env');
    const benignLink = path.join(tmpDir, 'innocent-readme.txt');
    let symlinkCreated = false;
    try {
      fs.symlinkSync(envTarget, benignLink, 'file');
      symlinkCreated = true;
    } catch {}
    if (symlinkCreated) {
      const linkRes = await readSafeInlineDiff(benignLink);
      assert.equal(linkRes.ok, false, 'Symlink to .env must be blocked after realpathSync');
      assert.equal(linkRes.error, 'blocked_sensitive');
    }
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('inline-diff-rpc 4: PrismDaemon registers INLINE_DIFF_BINDING regardless of omniModule, enforces main-frame/docGen/payload guards, and resolves cleanly', async () => {
  const workDir = makeTempDir('ag-prism-idiff-daemon-');
  const targetPluginDir = path.join(workDir, 'obsidian-prism');
  const repoDir = initTempGitRepo('ag-prism-idiff-cdp-repo-');
  let daemon = null;

  try {
    const trackedFile = path.join(repoDir, 'feature.js');
    fs.writeFileSync(trackedFile, 'const x = 1;\n', 'utf8');
    runGit(repoDir, ['add', 'feature.js']);
    runGit(repoDir, ['commit', '-m', 'init']);
    fs.writeFileSync(trackedFile, 'const x = 42;\n', 'utf8');

    await installPluginTool.installPlugin({
      targetDir: targetPluginDir,
      noCdp: true,
      skipHostConfig: true,
      startDaemon: false,
    });
    fs.writeFileSync(
      path.join(targetPluginDir, 'config.json'),
      JSON.stringify({ omniModule: 'off', sidebarStudio: 'off', hostLocalization: 'off' }, null, 2),
      'utf8'
    );

    daemon = new PrismDaemon({
      rootDir: targetPluginDir,
      overridePort: 19991,
      pollIntervalMs: 5000,
      enableAutoUpdateTimer: false,
      silent: true,
    });

    const addedBindings = [];
    const evalCalls = [];
    const listeners = new Map();

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
        if (method === 'Page.getFrameTree') {
          return { frameTree: { frame: { id: 'MAIN_F' } } };
        }
        if (method === 'Runtime.enable') {
          this.emit('Runtime.executionContextCreated', {
            context: { id: 1, auxData: { frameId: 'MAIN_F', isDefault: true, type: 'default' } },
          });
          this.emit('Runtime.executionContextCreated', {
            context: { id: 2, auxData: { frameId: 'SUB_IFRAME_F', isDefault: true, type: 'default' } },
          });
          this.emit('Runtime.executionContextCreated', {
            context: { id: 3, auxData: { frameId: 'MAIN_F', isDefault: false, type: 'isolated' } },
          });
          return {};
        }
        if (method === 'Runtime.addBinding') {
          addedBindings.push(params.name);
          return {};
        }
        if (method === 'Runtime.evaluate') {
          evalCalls.push({ contextId: params.contextId, expression: String(params.expression || '') });
          return {};
        }
        if (method === 'Page.addScriptToEvaluateOnNewDocument') {
          return { identifier: 'sc-inline-diff' };
        }
        return {};
      },
      async evaluate() {
        return { status: 'ok' };
      },
      close() {
        this.closed = true;
      },
    };

    const origConnect = daemon.cdp.CdpSession.connect;
    daemon.cdp.CdpSession.connect = async () => fakeSession;
    const entry = await daemon.attachTarget({
      id: 'T_INLINE_DIFF',
      title: 'Antigravity',
      url: 'vscode-file://vscode-app/workbench.html',
      webSocketDebuggerUrl: 'ws://127.0.0.1:19991/devtools/page/T_INLINE_DIFF',
    });
    daemon.cdp.CdpSession.connect = origConnect;

    // 1) Registered in attachTarget even when omniModule === 'off'
    assert.equal(INLINE_DIFF_BINDING, '__agPrismInlineDiffCall');
    assert.ok(addedBindings.includes(INLINE_DIFF_BINDING), 'INLINE_DIFF_BINDING must be registered in attachTarget');
    assert.equal(addedBindings.includes(OMNI_BINDING), false, 'OMNI_BINDING stays off when omniModule === "off"');

    // 2) Valid main-frame call resolves through window.__agPrismInlineDiffResolve?.(reqId, resp) bound to contextId=1
    evalCalls.length = 0;
    const validPayload = JSON.stringify({
      id: 17,
      action: 'readInlineDiff',
      uri: pathToFileURL(trackedFile).href,
    });
    await daemon.handleBindingCall(entry, {
      name: INLINE_DIFF_BINDING,
      payload: validPayload,
      executionContextId: 1,
    });
    assert.equal(evalCalls.length, 1);
    assert.equal(evalCalls[0].contextId, 1, 'Runtime.evaluate must bind contextId to main default executionContextId');
    assert.ok(
      evalCalls[0].expression.startsWith('window.__agPrismInlineDiffResolve?.(17, '),
      `Unexpected resolve expression: ${evalCalls[0].expression.slice(0, 80)}`
    );

    // Execute the resolve expression against a synthetic window callback to verify wire JSON integrity
    let capturedId = null;
    let capturedResp = null;
    const fakeWindow = {
      __agPrismInlineDiffResolve(id, resp) {
        capturedId = id;
        capturedResp = resp;
      },
    };
    const runner = new Function('window', evalCalls[0].expression);
    runner(fakeWindow);
    assert.equal(capturedId, 17);
    assert.equal(capturedResp.ok, true);
    assert.equal(capturedResp.mode, 'git-diff');
    assert.equal(capturedResp.fileName, 'feature.js');
    assert.equal(capturedResp.additions, 1);
    assert.equal(capturedResp.deletions, 1);

    // 3) Sub-iframe, isolated world, and unknown executionContextId are 100% blocked
    evalCalls.length = 0;
    for (const badCtxId of [2, 3, 999, undefined]) {
      await daemon.handleBindingCall(entry, {
        name: INLINE_DIFF_BINDING,
        payload: validPayload,
        executionContextId: badCtxId,
      });
    }
    assert.equal(evalCalls.length, 0, 'Non-main-frame / isolated / unknown execution contexts must be rejected');

    // 4) Oversized payloads (ASCII > 16384 bytes & multi-byte UTF-8 > 16384 bytes) and malformed payloads are dropped
    const asciiHuge = JSON.stringify({ id: 21, action: 'readInlineDiff', uri: `file:///${'a'.repeat(17000)}` });
    const utf8Huge = JSON.stringify({ id: 22, action: 'readInlineDiff', uri: '€'.repeat(6000) }); // length ~6040, UTF-8 bytes > 18000
    assert.ok(utf8Huge.length < 16384 && Buffer.byteLength(utf8Huge, 'utf8') > 16384);
    const uriTooLong = JSON.stringify({ id: 23, action: 'readInlineDiff', uri: `file:///${'b'.repeat(2050)}` });
    const badPayloads = [
      null,
      12345,
      '{bad-json',
      asciiHuge,
      utf8Huge,
      uriTooLong,
      JSON.stringify({ id: '1', action: 'readInlineDiff', uri: trackedFile }),
      JSON.stringify({ id: -1, action: 'readInlineDiff', uri: trackedFile }),
      JSON.stringify({ id: 24, action: 'execArbitrary', uri: trackedFile }),
      JSON.stringify({ id: 25, action: 'readInlineDiff', uri: 999 }),
    ];
    for (const p of badPayloads) {
      await daemon.handleBindingCall(entry, {
        name: INLINE_DIFF_BINDING,
        payload: p,
        executionContextId: 1,
      });
    }
    assert.equal(evalCalls.length, 0, 'Oversized or invalid payloads must never trigger Runtime.evaluate');

    // 5) Cross-navigation docGen revocation during async git work prevents stale writeback
    evalCalls.length = 0;
    const inFlight = daemon.handleBindingCall(entry, {
      name: INLINE_DIFF_BINDING,
      payload: JSON.stringify({ id: 88, action: 'readInlineDiff', uri: pathToFileURL(trackedFile).href }),
      executionContextId: 1,
    });
    // Navigate main frame while readSafeInlineDiff is awaiting git subprocess
    fakeSession.emit('Page.frameNavigated', {
      frame: { id: 'MAIN_F', url: 'https://untrusted.example/navigated' },
    });
    await inFlight;
    assert.equal(evalCalls.length, 0, 'Cross-navigation docGen change during await must suppress Runtime.evaluate writeback');

    // Old contextId=1 (stale docGen) must stay rejected after navigation; destroyed new context during await must also suppress writeback
    await daemon.handleBindingCall(entry, {
      name: INLINE_DIFF_BINDING,
      payload: JSON.stringify({ id: 89, action: 'readInlineDiff', uri: pathToFileURL(trackedFile).href }),
      executionContextId: 1,
    });
    assert.equal(evalCalls.length, 0, 'Stale contextId with mismatched docGen must be rejected');

    fakeSession.emit('Runtime.executionContextCreated', {
      context: { id: 4, auxData: { frameId: 'MAIN_F', isDefault: true, type: 'default' } },
    });
    const inFlightDestroy = daemon.handleBindingCall(entry, {
      name: INLINE_DIFF_BINDING,
      payload: JSON.stringify({ id: 90, action: 'readInlineDiff', uri: pathToFileURL(trackedFile).href }),
      executionContextId: 4,
    });
    fakeSession.emit('Runtime.executionContextDestroyed', { executionContextId: 4 });
    await inFlightDestroy;
    assert.equal(evalCalls.length, 0, 'Context destruction during await must suppress Runtime.evaluate writeback');

    // 6) Static CodeQL hygiene verification on inline diff implementation in main.mjs
    const mainSrc = fs.readFileSync(path.join(ROOT_DIR, 'sidecars', 'daemon', 'main.mjs'), 'utf8');
    const diffFnStart = mainSrc.indexOf('function execGitInlineDiff(');
    const diffFnEnd = mainSrc.indexOf('export function resolvePortFileCandidates()');
    assert.ok(diffFnStart > 0 && diffFnEnd > diffFnStart);
    const diffSection = mainSrc.slice(diffFnStart, diffFnEnd);
    assert.ok(diffSection.includes("execFile(\n      'git',"), 'Inline diff must execute git via execFile');
    assert.equal(diffSection.includes('shell: true'), false, 'Inline diff git execution must never enable shell: true');
    assert.equal(/(?<!\.)\b(?:exec|execSync)\s*\(/.test(diffSection), false, 'Inline diff must use execFile, never shell exec()');
  } finally {
    if (daemon) await daemon.stop(false).catch(() => {});
    fs.rmSync(workDir, { recursive: true, force: true });
    fs.rmSync(repoDir, { recursive: true, force: true });
  }
});
