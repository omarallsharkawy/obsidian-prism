import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const patchAsar = require('../tools/patch-asar.cjs');

function buildFixtureAsar(preloadContent, extraPayloadMarker = '// Antigravity Chinese Localization Injection stub\n') {
  const preloadBuf = Buffer.from(preloadContent, 'utf8');
  const locBuf = Buffer.from(extraPayloadMarker, 'utf8');

  const header = {
    files: {
      dist: {
        files: {
          'preload.js': {
            size: preloadBuf.length,
            offset: '0',
            integrity: patchAsar.computeIntegrity(preloadBuf),
          },
          'zh-stub.js': {
            size: locBuf.length,
            offset: String(preloadBuf.length),
            integrity: patchAsar.computeIntegrity(locBuf),
          },
        },
      },
    },
  };

  return patchAsar.buildAsarArchive(header, [preloadBuf, locBuf]);
}

function sendWsFrame(socket, data, opcode = 0x1) {
  if (socket.destroyed) return;
  const payload = Buffer.isBuffer(data) ? data : Buffer.from(String(data), 'utf8');
  let header;
  if (payload.length < 126) {
    header = Buffer.from([0x80 | opcode, payload.length]);
  } else if (payload.length < 65536) {
    header = Buffer.alloc(4);
    header[0] = 0x80 | opcode;
    header[1] = 126;
    header.writeUInt16BE(payload.length, 2);
  } else {
    header = Buffer.alloc(10);
    header[0] = 0x80 | opcode;
    header[1] = 127;
    header.writeBigUInt64BE(BigInt(payload.length), 2);
  }
  socket.write(Buffer.concat([header, payload]));
}

async function startMockCdpServer(docState) {
  const sockets = new Set();
  const wsClients = new Set();

  const server = http.createServer((req, res) => {
    const addr = server.address();
    const port = typeof addr === 'object' && addr ? addr.port : 0;
    if (req.url === '/json/list') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(
        JSON.stringify([
          {
            id: 'hang-launchpad',
            type: 'page',
            title: 'Untitled - launchpad',
            url: 'vscode-file://vscode-app/launchpad.html',
            webSocketDebuggerUrl: `ws://127.0.0.1:${port}/devtools/page/hang-launchpad`,
          },
          {
            id: 'main-workbench',
            type: 'page',
            title: 'Project - Antigravity',
            url: 'vscode-file://vscode-app/workbench.html',
            webSocketDebuggerUrl: `ws://127.0.0.1:${port}/devtools/page/main-workbench`,
          },
        ])
      );
      return;
    }
    res.writeHead(404);
    res.end();
  });

  server.on('connection', (sock) => {
    sockets.add(sock);
    sock.on('close', () => sockets.delete(sock));
  });

  server.on('upgrade', (req, socket) => {
    if (String(req.url || '').includes('hang-launchpad')) {
      docState.touchedLaunchpad = true;
      socket.destroy();
      return;
    }
    const key = req.headers['sec-websocket-key'];
    const accept = crypto
      .createHash('sha1')
      .update(`${key}258EAFA5-E914-47DA-95CA-C5AB0DC85B11`)
      .digest('base64');

    socket.write(
      [
        'HTTP/1.1 101 Switching Protocols',
        'Upgrade: websocket',
        'Connection: Upgrade',
        `Sec-WebSocket-Accept: ${accept}`,
        '\r\n',
      ].join('\r\n')
    );

    wsClients.add(socket);
    socket.on('close', () => wsClients.delete(socket));
    socket.on('error', () => wsClients.delete(socket));

    let rxBuf = Buffer.alloc(0);
    socket.on('data', (chunk) => {
      rxBuf = Buffer.concat([rxBuf, chunk]);
      while (rxBuf.length >= 2) {
        const b0 = rxBuf[0];
        const b1 = rxBuf[1];
        const opcode = b0 & 0x0f;
        const masked = (b1 & 0x80) !== 0;
        let payloadLen = b1 & 0x7f;
        let headerLen = 2;
        if (payloadLen === 126) {
          if (rxBuf.length < 4) break;
          payloadLen = rxBuf.readUInt16BE(2);
          headerLen = 4;
        } else if (payloadLen === 127) {
          if (rxBuf.length < 10) break;
          payloadLen = Number(rxBuf.readBigUInt64BE(2));
          headerLen = 10;
        }
        const maskLen = masked ? 4 : 0;
        const frameTotal = headerLen + maskLen + payloadLen;
        if (rxBuf.length < frameTotal) break;

        const payload = Buffer.from(rxBuf.subarray(headerLen + maskLen, frameTotal));
        if (masked) {
          const mask = rxBuf.subarray(headerLen, headerLen + 4);
          for (let i = 0; i < payload.length; i++) {
            payload[i] ^= mask[i & 3];
          }
        }
        rxBuf = rxBuf.subarray(frameTotal);

        if (opcode === 0x8) {
          socket.end();
          return;
        }
        if (opcode === 0x9) {
          sendWsFrame(socket, payload, 0x0a);
          continue;
        }
        if (opcode === 0x1) {
          const msg = JSON.parse(payload.toString('utf8'));
          if (msg.method === 'Page.enable') {
            docState.pageEnabledCount += 1;
            sendWsFrame(socket, JSON.stringify({ id: msg.id, result: {} }));
          } else if (msg.method === 'Page.addScriptToEvaluateOnNewDocument') {
            docState.newDocScripts.push(msg.params?.source || '');
            sendWsFrame(socket, JSON.stringify({ id: msg.id, result: { identifier: 'script-1' } }));
          } else if (msg.method === 'Runtime.evaluate') {
            const expr = String(msg.params?.expression || '');
            if (expr.includes("hasAttribute('data-ag-prism')")) {
              const status =
                docState.readyState === 'loading'
                  ? 'loading'
                  : docState.agPrism
                  ? 'prism'
                  : docState.agCsStyle === '1'
                  ? 'legacy'
                  : 'missing';
              sendWsFrame(
                socket,
                JSON.stringify({ id: msg.id, result: { result: { type: 'string', value: status } } })
              );
            } else if (expr.includes('__TEST_STAGED_INJECT_V1__')) {
              docState.agPrism = '1.0.1';
              docState.agCsStyle = '1';
              docState.injectCount += 1;
              docState.lastMarker = '__TEST_STAGED_INJECT_V1__';
              sendWsFrame(
                socket,
                JSON.stringify({ id: msg.id, result: { result: { type: 'object', value: { status: 'ok' } } } })
              );
            } else if (expr.includes('__TEST_STAGED_INJECT_V2__')) {
              docState.agPrism = '1.0.1';
              docState.agCsStyle = '1';
              docState.injectCount += 1;
              docState.lastMarker = '__TEST_STAGED_INJECT_V2__';
              sendWsFrame(
                socket,
                JSON.stringify({ id: msg.id, result: { result: { type: 'object', value: { status: 'ok' } } } })
              );
            } else if (expr.includes('cleanedLegacy')) {
              docState.agCsStyle = null;
              docState.cleanedLegacyCount = (docState.cleanedLegacyCount || 0) + 1;
              sendWsFrame(
                socket,
                JSON.stringify({ id: msg.id, result: { result: { type: 'object', value: { cleanedLegacy: true } } } })
              );
            } else {
              sendWsFrame(
                socket,
                JSON.stringify({ id: msg.id, result: { result: { type: 'undefined' } } })
              );
            }
          } else {
            sendWsFrame(socket, JSON.stringify({ id: msg.id, result: {} }));
          }
        }
      }
    });
  });

  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  const port = typeof address === 'object' && address ? address.port : 0;

  return {
    port,
    emitReload() {
      docState.agPrism = null;
      docState.agCsStyle = null;
      for (const ws of wsClients) {
        sendWsFrame(ws, JSON.stringify({ method: 'Page.loadEventFired', params: { timestamp: Date.now() } }));
      }
    },
    async close() {
      for (const s of sockets) {
        try {
          s.destroy();
        } catch {}
      }
      await new Promise((resolve) => server.close(() => resolve()));
    },
  };
}

async function waitForCondition(predicate, timeoutMs = 4500, stepMs = 60) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await predicate()) return true;
    await new Promise((r) => setTimeout(r, stepMs));
  }
  return Boolean(await predicate());
}

test('tools/patch-asar.cjs installs /* __AG_PRISM_START__ */, preserves Chinese & Codex slider, updates SHA256/SHA1, and restores losslessly', () => {
  const workDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ag-prism-asar-'));
  try {
    const asarPath = path.join(workDir, 'app.asar');
    const bakPath = path.join(workDir, 'app.asar.bak');
    const codexBakPath = path.join(workDir, 'app.asar.codex.bak');
    const metaPath = path.join(workDir, '.antigravity_chinese_meta.json');

    const basePreload = [
      '"use strict";',
      'const electron_1 = require("electron");',
      '/* Antigravity Chinese Localization Injection */',
      '/* __AG_CODEX_EFFORT_SLIDER_START__ */',
      'const slider = "keep-me";',
      '/* __AG_CODEX_EFFORT_SLIDER_END__ */',
      '',
    ].join('\n');

    const stubInjectExpr =
      '(() => { window.__agPrism = { ok: true }; document.documentElement?.setAttribute("data-ag-prism", "1.0.1"); })()';

    const initialAsarBuf = buildFixtureAsar(basePreload);
    fs.writeFileSync(asarPath, initialAsarBuf);
    fs.writeFileSync(bakPath, Buffer.from('ORIGINAL_BAK_SENTINEL'));
    fs.writeFileSync(codexBakPath, Buffer.from('CODEX_BAK_SENTINEL'));
    fs.writeFileSync(
      metaPath,
      JSON.stringify({ patched: true, patchedFingerprint: '0000000000000000', timestamp: 1 }, null, 2),
      'utf8'
    );

    assert.equal(patchAsar.isHostClientRunning(asarPath), false);

    // 1. Initial install & idempotency check
    const res1 = patchAsar.patchAsarFile(asarPath, { noSwap: true, injectExpr: stubInjectExpr });
    assert.equal(res1.ok, true);
    assert.equal(res1.written, true);
    assert.equal(res1.deferred, false);
    assert.equal(res1.backupCreated, true);
    assert.equal(res1.backupPath, path.join(workDir, 'app.asar.prism.bak'));

    assert.equal(fs.readFileSync(bakPath, 'utf8'), 'ORIGINAL_BAK_SENTINEL');
    assert.equal(fs.readFileSync(codexBakPath, 'utf8'), 'CODEX_BAK_SENTINEL');

    const st1 = patchAsar.inspectAsarStatus(asarPath);
    assert.equal(st1.hasPrism, true);
    assert.equal(st1.hasClaudeStyle, true);
    assert.equal(st1.hasCodexSlider, true);
    assert.equal(st1.hasChinesePatch, true);
    assert.equal(st1.hasBackup, true);

    const read1 = patchAsar.readPreloadFromAsar(asarPath);
    assert.equal(read1.preloadText.split(patchAsar.PATCH_START_MARKER).length - 1, 1);
    assert.equal(read1.preloadText.split(patchAsar.PATCH_END_MARKER).length - 1, 1);
    assert.ok(read1.preloadText.includes('const slider = "keep-me";'));
    assert.ok(read1.preloadText.includes('/* Antigravity Chinese Localization Injection */'));

    const preloadBuf1 = Buffer.from(read1.preloadText, 'utf8');
    const expectedSha256 = crypto.createHash('sha256').update(preloadBuf1).digest('hex');
    assert.equal(read1.preloadEntry.integrity.hash, expectedSha256);

    let executedPayload = null;
    const mockElectron = {
      webFrame: {
        executeJavaScript(code) {
          executedPayload = code;
        },
      },
    };
    const preloadCtx = {
      require(id) {
        if (id === 'electron') return mockElectron;
        throw new Error('Unexpected require: ' + id);
      },
      window: { addEventListener() {} },
      document: { readyState: 'complete' },
      console,
    };
    assert.doesNotThrow(() => vm.runInNewContext(read1.preloadText, preloadCtx));
    assert.ok(executedPayload && executedPayload.includes('__agPrism'));
    assert.doesNotThrow(() => new vm.Script(executedPayload));

    const rawAfterInstall = fs.readFileSync(asarPath);
    const expectedMetaFp = crypto.createHash('sha1').update(rawAfterInstall).digest('hex').slice(0, 16);
    const metaAfterInstall = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
    assert.equal(metaAfterInstall.patchedFingerprint, expectedMetaFp);

    // 2. Second idempotent install
    const res2 = patchAsar.patchAsarFile(asarPath, { noSwap: true, injectExpr: stubInjectExpr });
    assert.equal(res2.backupCreated, false);
    const read2 = patchAsar.readPreloadFromAsar(asarPath);
    assert.equal(read2.preloadText.split(patchAsar.PATCH_START_MARKER).length - 1, 1);

    // 3. Lossless restore
    const restRes = patchAsar.restoreAsarFile(asarPath, { noSwap: true });
    assert.equal(restRes.ok, true);
    assert.equal(restRes.changed, true);
    assert.equal(restRes.written, true);

    const stAfterRestore = patchAsar.inspectAsarStatus(asarPath);
    assert.equal(stAfterRestore.hasPrism, false);
    assert.equal(stAfterRestore.hasCodexSlider, true);
    assert.equal(stAfterRestore.hasChinesePatch, true);
  } finally {
    fs.rmSync(workDir, { recursive: true, force: true });
  }
});

test('tools/patch-asar.cjs --clean-legacy strips legacy /* __AG_CLAUDE_STYLE_START__ */ (legacy-patch) and deletes .agcs-staged* while protecting Chinese & Codex slider and live ASAR offsets', async () => {
  const workDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ag-prism-clean-legacy-'));
  let mockHost = null;
  let guardPid = null;

  try {
    const asarPath = path.join(workDir, 'app.asar');
    const legacyStaged1 = path.join(workDir, 'app.asar.agcs-staged');
    const legacyStaged2 = path.join(workDir, 'app.asar.agcs-staged.json');
    const metaPath = path.join(workDir, '.antigravity_chinese_meta.json');

    const legacyPreload = [
      '"use strict";',
      'const electron_1 = require("electron");',
      '/* Antigravity Chinese Localization Injection */',
      '/* __AG_CODEX_EFFORT_SLIDER_START__ */',
      'const slider = "keep-me";',
      '/* __AG_CODEX_EFFORT_SLIDER_END__ */',
      '/* __AG_CLAUDE_STYLE_START__ */',
      'const __agClaudeStyleCode = "legacy-patch-legacy-payload";',
      '/* __AG_CLAUDE_STYLE_END__ */',
      '',
    ].join('\n');

    const initialAsarBuf = buildFixtureAsar(legacyPreload);
    fs.writeFileSync(asarPath, initialAsarBuf);
    fs.writeFileSync(legacyStaged1, 'stale-staged-binary');
    fs.writeFileSync(legacyStaged2, '{"stale":true}');
    const initialFp = crypto.createHash('sha1').update(initialAsarBuf).digest('hex').slice(0, 16);
    fs.writeFileSync(
      metaPath,
      JSON.stringify({ patched: true, patchedFingerprint: initialFp, timestamp: 10 }, null, 2),
      'utf8'
    );

    const cliParsed = patchAsar.parseCliArgs(['node', 'patch-asar.cjs', '--clean-legacy']);
    assert.equal(cliParsed.action, 'clean-legacy');

    // Spawn mock host process: verify --clean-legacy never overwrites app.asar in place while running,
    // immediately deletes .agcs-staged*, and defers the swap via a background guard process.
    mockHost = spawn(process.execPath, ['-e', 'setInterval(() => {}, 10000)'], {
      stdio: 'ignore',
      windowsHide: true,
    });

    const cleanRes = patchAsar.cleanLegacyAsar(asarPath, {
      hostPid: mockHost.pid,
      pollIntervalMs: 120,
    });
    guardPid = cleanRes.guardPid;

    assert.equal(cleanRes.ok, true);
    assert.equal(cleanRes.hadLegacyBlock, true);
    assert.equal(cleanRes.written, false);
    assert.equal(cleanRes.deferred, true);
    assert.equal(cleanRes.hostRunning, true);
    assert.equal(cleanRes.removedLegacyStaged.length, 2);
    assert.equal(fs.existsSync(legacyStaged1), false);
    assert.equal(fs.existsSync(legacyStaged2), false);

    // Original app.asar byte offsets remain 100% untouched while host is running
    assert.equal(Buffer.compare(fs.readFileSync(asarPath), initialAsarBuf), 0);

    // After host exits, guard process swaps the cleaned archive and updates .antigravity_chinese_meta.json
    mockHost.kill();
    const swapped = await waitForCondition(
      () => !fs.existsSync(cleanRes.stagedPath) && (!guardPid || !patchAsar.isPidAlive(guardPid)),
      6000
    );
    assert.equal(swapped, true);

    const afterStatus = patchAsar.inspectAsarStatus(asarPath, { assumeStopped: true });
    assert.equal(afterStatus.hasLegacyClaudeStyle, false);
    assert.equal(afterStatus.hasPrism, false);
    assert.equal(afterStatus.hasCodexSlider, true);
    assert.equal(afterStatus.hasChinesePatch, true);

    const afterRead = patchAsar.readPreloadFromAsar(asarPath);
    assert.equal(afterRead.preloadText.includes('legacy-patch-legacy-payload'), false);
    assert.ok(afterRead.preloadText.includes('const slider = "keep-me";'));
    assert.ok(afterRead.preloadText.includes('/* Antigravity Chinese Localization Injection */'));

    const expectedFp = crypto.createHash('sha1').update(fs.readFileSync(asarPath)).digest('hex').slice(0, 16);
    assert.equal(JSON.parse(fs.readFileSync(metaPath, 'utf8')).patchedFingerprint, expectedFp);
  } finally {
    if (mockHost && patchAsar.isPidAlive(mockHost.pid)) {
      try { mockHost.kill(); } catch {}
    }
    if (guardPid && patchAsar.isPidAlive(guardPid)) {
      try { process.kill(guardPid); } catch {}
    }
    fs.rmSync(workDir, { recursive: true, force: true });
  }
});

test('tools/patch-asar.cjs deferred daemon heals CDP window on Ctrl+Shift+R reload and swaps staged ASAR after host exits', async () => {
  const workDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ag-prism-asar-daemon-'));
  let mockHost = null;
  let mockCdp = null;
  let guardPid = null;

  try {
    const asarPath = path.join(workDir, 'app.asar');
    const metaPath = path.join(workDir, '.antigravity_chinese_meta.json');
    const basePreload = [
      '"use strict";',
      'const electron_1 = require("electron");',
      '/* Antigravity Chinese Localization Injection */',
      '/* __AG_CODEX_EFFORT_SLIDER_START__ */',
      'const slider = "keep-me";',
      '/* __AG_CODEX_EFFORT_SLIDER_END__ */',
      '',
    ].join('\n');

    const initialAsarBuf = buildFixtureAsar(basePreload);
    fs.writeFileSync(asarPath, initialAsarBuf);
    const initialFp = crypto.createHash('sha1').update(initialAsarBuf).digest('hex').slice(0, 16);
    fs.writeFileSync(
      metaPath,
      JSON.stringify({ patched: true, patchedFingerprint: initialFp, timestamp: 1 }, null, 2),
      'utf8'
    );

    const docState = {
      readyState: 'complete',
      agPrism: '1.0.1',
      agCsStyle: '1',
      injectCount: 0,
      pageEnabledCount: 0,
      touchedLaunchpad: false,
      lastMarker: null,
      newDocScripts: [],
    };

    mockCdp = await startMockCdpServer(docState);
    mockHost = spawn(process.execPath, ['-e', 'setInterval(() => {}, 10000)'], {
      stdio: 'ignore',
      windowsHide: true,
    });

    const stagedInjectExpr =
      '(() => { /* __TEST_STAGED_INJECT_V2__ */ document.documentElement.setAttribute("data-ag-prism", "1.0.1"); })()';

    const res = patchAsar.patchAsarFile(asarPath, {
      hostPid: mockHost.pid,
      cdpPort: mockCdp.port,
      pollIntervalMs: 120,
      injectExpr: stagedInjectExpr,
    });

    guardPid = res.guardPid;
    assert.equal(res.ok, true);
    assert.equal(res.written, false);
    assert.equal(res.deferred, true);
    assert.equal(res.hostRunning, true);
    assert.ok(guardPid && patchAsar.isPidAlive(guardPid));

    const attachedOk = await waitForCondition(() => docState.pageEnabledCount >= 1, 4500);
    assert.equal(attachedOk, true);
    assert.equal(docState.touchedLaunchpad, false);
    assert.equal(Buffer.compare(fs.readFileSync(asarPath), initialAsarBuf), 0);

    mockCdp.emitReload();
    const healedOnEvent = await waitForCondition(
      () => docState.agPrism === '1.0.1' && docState.injectCount >= 1,
      4500
    );
    assert.equal(healedOnEvent, true);
    assert.equal(docState.lastMarker, '__TEST_STAGED_INJECT_V2__');

    mockHost.kill();
    await mockCdp.close();
    mockCdp = null;

    const swappedAndExited = await waitForCondition(
      () => !fs.existsSync(res.stagedPath) && !patchAsar.isPidAlive(guardPid),
      6000
    );
    assert.equal(swappedAndExited, true);
    assert.equal(fs.existsSync(res.stagedMetaPath), false);

    const finalStatus = patchAsar.inspectAsarStatus(asarPath, { assumeStopped: true });
    assert.equal(finalStatus.hasPrism, true);
    assert.equal(finalStatus.hasCodexSlider, true);
    assert.equal(finalStatus.hasChinesePatch, true);
    assert.equal(finalStatus.hasStaged, false);
  } finally {
    if (mockHost && patchAsar.isPidAlive(mockHost.pid)) {
      try { mockHost.kill(); } catch {}
    }
    if (guardPid && patchAsar.isPidAlive(guardPid)) {
      try { process.kill(guardPid); } catch {}
    }
    if (mockCdp) {
      await mockCdp.close().catch(() => {});
    }
    fs.rmSync(workDir, { recursive: true, force: true });
  }
});
