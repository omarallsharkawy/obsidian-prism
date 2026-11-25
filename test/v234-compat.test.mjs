import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

import {
  buildRendererRpcExpression,
  extractModelLabelMap,
  normalizeRendererUserStatus,
  normalizeRendererQuotaSummary,
  normalizeRendererSummaries,
  normalizeRendererTrajectory,
} from '../vendor/pulse-dashboard/sidecars/panel/renderer-rpc-adapter.mjs';
import { AntigravityClient } from '../vendor/pulse-dashboard/sidecars/panel/client.mjs';
import { MetricsStore } from '../vendor/pulse-dashboard/sidecars/panel/store.mjs';
import { quotaMetrics, trajectoryMetrics } from '../vendor/pulse-dashboard/sidecars/panel/metrics.mjs';
import { quotaModelFamily } from '../vendor/pulse-dashboard/sidecars/panel/usage.mjs';
import { formatModelName } from '../vendor/pulse-dashboard/sidecars/panel/context.mjs';
import { PrismDaemon } from '../sidecars/daemon/main.mjs';

const require = createRequire(import.meta.url);
globalThis.__agCodexEffortSliderDisableAutoBoot = true;
const effortSlider = require('../vendor/effort-slider/upstream-client.js');
const sliderCoexist = require('../vendor/effort-slider/slider-coexist.js');
const usageCore = require('../usage-core.js');

test('v2.34.0 Effort Slider: normalizes kebab-case slug effortIndex and unlocks all multi-effort models', () => {
  const neonLow = { label: 'Gemini 4 Neon (Low)', modelId: 'gemini-4-neon-low', value: 1534 };
  const neonMed = { label: 'Gemini 4 Neon (Medium)', modelId: 'gemini-4-neon-medium', value: 1533 };
  const neonHigh = { label: 'Gemini 4 Neon (High)', modelId: 'gemini-4-neon-high', value: 1532 };
  const neonXHigh = { label: 'Gemini 4 Neon (XHigh)', modelId: 'gemini-4-neon-xhigh', value: 1535 };
  const opusLow = { label: 'Claude Opus 5.5 (Low)', modelId: 'claude-opus-5-5-low', value: 1400 };
  const opusMed = { label: 'Claude Opus 5.5 (Medium)', modelId: 'claude-opus-5-5-medium', value: 1401 };
  const opusHigh = { label: 'Claude Opus 5.5 (High)', modelId: 'claude-opus-5-5-high', value: 1402 };
  const flashLow = { label: 'Gemini 3.8 Flash (Low)', modelId: 'gemini-3.8-flash-low', value: 1320 };
  const flashHigh = { label: 'Gemini 3.8 Flash (High)', modelId: 'gemini-3.8-flash-high', value: 1318 };
  const orchNeon = { label: 'Orchestrator (Neon)', modelId: 'gemini-pro-orchestrator-neon', value: 1537 };
  const gptOss = { label: 'GPT-OSS 120B (Medium)', modelId: 'gpt-oss-120b-medium', value: 342 };

  const slugEffortIndex = new Map([
    ['gemini-4-neon', new Map([['low', neonLow], ['medium', neonMed], ['high', neonHigh], ['xhigh', neonXHigh]])],
    ['claude-opus-5-5', new Map([['low', opusLow], ['medium', opusMed], ['high', opusHigh]])],
    ['gemini-3.8-flash', new Map([['low', flashLow], ['high', flashHigh]])],
  ]);

  const modelOptions = [neonLow, neonMed, neonHigh, neonXHigh, opusLow, opusMed, opusHigh, flashLow, flashHigh, orchNeon, gptOss];
  const normalized = effortSlider.normalizeEffortIndex(slugEffortIndex, modelOptions);
  assert.equal(normalized.has('Gemini 4 Neon'), true);
  assert.equal(normalized.has('Claude Opus 5.5'), true);
  assert.equal(normalized.has('Gemini 3.8 Flash'), true);
  assert.equal(normalized.has('Orchestrator'), false);

  // Works both with normalized display-name keys AND directly with raw slug-keyed Map
  for (const idx of [normalized, slugEffortIndex]) {
    const ctx = { effortIndex: idx, modelOptions, selectedModel: neonXHigh };
    const neonProf = effortSlider.resolveModelEffortProfile(ctx, neonXHigh);
    assert.equal(neonProf.locked, false);
    assert.equal(neonProf.baseName, 'Gemini 4 Neon');
    assert.deepEqual(neonProf.levels.map((l) => l.effort), ['low', 'medium', 'high', 'xhigh']);
    assert.equal(neonProf.currentEffort, 'xhigh');
    assert.equal(neonProf.currentLabel, 'Extra');

    const opusProf = effortSlider.resolveModelEffortProfile(ctx, 'Claude Opus 5.5');
    assert.equal(opusProf.locked, false);
    assert.equal(opusProf.isClaude, true);
    assert.equal(opusProf.theme, 'claude');
    assert.equal(opusProf.levels.length, 3);

    const flashProf = effortSlider.resolveModelEffortProfile(ctx, 'Gemini 3.8 Flash');
    assert.equal(flashProf.locked, false);
    assert.deepEqual(flashProf.levels.map((l) => l.effort), ['low', 'high']);

    const singleProf = effortSlider.resolveModelEffortProfile(ctx, gptOss);
    assert.equal(singleProf.locked, true);
  }
});

test('v2.34.0 Effort Slider: Orchestrator exposes tunable planner effort levels & falls back cleanly on legacy hosts', () => {
  const neonLow = { label: 'Gemini 4 Neon (Low)', modelId: 'gemini-4-neon-low', value: 1534 };
  const neonHigh = { label: 'Gemini 4 Neon (High)', modelId: 'gemini-4-neon-high', value: 1532 };
  const neonXHigh = { label: 'Gemini 4 Neon (XHigh)', modelId: 'gemini-4-neon-xhigh', value: 1535 };
  const opusLow = { label: 'Claude Opus 5.5 (Low)', modelId: 'claude-opus-5-5-low', value: 1400 };
  const opusHigh = { label: 'Claude Opus 5.5 (High)', modelId: 'claude-opus-5-5-high', value: 1402 };
  const orchNeon = { label: 'Orchestrator (Neon)', modelId: 'gemini-pro-orchestrator-neon', value: 1537 };

  const planners = [neonLow, neonHigh, neonXHigh, opusLow, opusHigh];
  const rawPlannerIdx = new Map([
    ['gemini-4-neon', new Map([['low', neonLow], ['high', neonHigh], ['xhigh', neonXHigh]])],
    ['claude-opus-5-5', new Map([['low', opusLow], ['high', opusHigh]])],
  ]);
  const orchCtx = {
    effortIndex: new Map(),
    modelOptions: [...planners, orchNeon],
    selectedModel: orchNeon,
    orchPlanners: planners,
    orchIdx: effortSlider.normalizeEffortIndex(rawPlannerIdx, planners),
    orchDef: neonXHigh,
    orchPick: { model: null, select: () => {} },
  };

  // Default planner (Gemini 4 Neon XHigh)
  const defProf = effortSlider.resolveModelEffortProfile(orchCtx, orchNeon);
  assert.equal(defProf.isOrchestrator, true);
  assert.equal(defProf.orchestratorTunable, true);
  assert.equal(defProf.locked, false);
  assert.equal(defProf.baseName, 'Gemini 4 Neon');
  assert.equal(defProf.currentEffort, 'xhigh');
  assert.equal(defProf.theme, 'codex');

  // Custom planner override (Claude Opus 5.5 High) switches theme to claude automatically
  const claudeOrchProf = effortSlider.resolveModelEffortProfile(
    { ...orchCtx, orchPick: { model: 1402, select: () => {} } },
    orchNeon
  );
  assert.equal(claudeOrchProf.isOrchestrator, true);
  assert.equal(claudeOrchProf.orchestratorTunable, true);
  assert.equal(claudeOrchProf.locked, false);
  assert.equal(claudeOrchProf.baseName, 'Claude Opus 5.5');
  assert.equal(claudeOrchProf.isClaude, true);
  assert.equal(claudeOrchProf.theme, 'claude');
  assert.equal(claudeOrchProf.currentEffort, 'high');

  // Legacy host without orchestratorPick stays locked so crystal Auto bar takes over
  const legacyOrchProf = effortSlider.resolveModelEffortProfile(
    { effortIndex: new Map(), modelOptions: [orchNeon], selectedModel: orchNeon },
    orchNeon
  );
  assert.equal(legacyOrchProf.isOrchestrator, true);
  assert.equal(legacyOrchProf.orchestratorTunable, false);
  assert.equal(legacyOrchProf.locked, true);
});

test('v2.34.0 Telemetry adapter: enforces read-only allowlist, UUID guard, Protobuf-ES normalization & strips prompts', () => {
  assert.throws(() => buildRendererRpcExpression('SendUserCascadeMessage', {}), /Unsupported renderer RPC/);
  assert.throws(() => buildRendererRpcExpression('DeleteCascadeTrajectory', {}), /Unsupported renderer RPC/);
  assert.throws(() => buildRendererRpcExpression('GetCascadeTrajectory', { cascadeId: '../bad' }), /Invalid cascadeId/);
  assert.throws(() => buildRendererRpcExpression('GetCascadeTrajectory', { cascadeId: "');alert(1)//" }), /Invalid cascadeId/);

  const validId = '11111111-2222-3333-4444-555555555555';
  const expr = buildRendererRpcExpression('GetCascadeTrajectory', { cascadeId: validId });
  assert.equal(expr.includes(validId), true);

  // Quota Protobuf-ES oneof remaining + Timestamp -> quotaMetrics()
  const normQuota = normalizeRendererQuotaSummary({
    response: {
      groups: [
        {
          displayName: 'Gemini Models',
          description: 'Gemini 4 family',
          buckets: [
            {
              bucketId: 'gemini-5h',
              window: '5h',
              remaining: { case: 'remainingFraction', value: 0.75 },
              resetTime: { seconds: '1795228894', nanos: 0 },
              disabled: false,
            },
            {
              bucketId: 'gemini-weekly',
              window: 'weekly',
              remaining: { case: 'remainingFraction', value: 0.25 },
              resetTime: { seconds: '1795564219', nanos: 0 },
              disabled: false,
            },
          ],
        },
      ],
    },
  });
  const qm = quotaMetrics(normQuota, 1795200000000);
  assert.equal(qm.length, 1);
  assert.equal(qm[0].id, 'gemini');
  assert.equal(qm[0].windows['5h'].remaining, 0.75);
  assert.equal(typeof qm[0].windows['5h'].resetAt, 'string');
  assert.equal(qm[0].windows.weekly.remaining, 0.25);

  // UserStatus -> model label map
  const normUser = normalizeRendererUserStatus({
    userStatus: {
      email: 'dev@example.com',
      cascadeModelConfigData: {
        clientModelConfigs: [
          { label: 'Gemini 4 Carbon (High)', modelId: 'gemini-4-carbon-high', modelOrAlias: { choice: { case: 'model', value: 1427 } } },
        ],
      },
    },
  });
  const labelMap = extractModelLabelMap(normUser);
  assert.equal(labelMap.get('1427'), 'Gemini 4 Carbon (High)');

  // Trajectory normalization -> trajectoryMetrics()
  const childId = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
  const normTraj = normalizeRendererTrajectory(
    {
      status: 2,
      numTotalSteps: 4,
      numTotalGeneratorMetadata: 1,
      trajectory: {
        cascadeId: validId,
        steps: [
          { type: 14, stepCase: 'userInput', metadata: { createdAt: { seconds: '1795214000', nanos: 0 } } },
          {
            type: 15,
            stepCase: 'plannerResponse',
            hasToolCalls: false,
            hasResponseText: true,
            metadata: { createdAt: { seconds: '1795214002', nanos: 0 } },
          },
          {
            type: 21,
            stepCase: 'runCommand',
            metadata: {
              startedAt: { seconds: '1795214010', nanos: 0 },
              completedAt: { seconds: '1795214015', nanos: 0 },
              hasToolCall: true,
            },
          },
          {
            type: 127,
            stepCase: 'invokeSubagent',
            invokeSubagent: { conversationId: childId, results: [] },
            metadata: { createdAt: { seconds: '1795214016', nanos: 0 } },
          },
        ],
        generatorMetadata: [
          {
            stepIndices: [1],
            chatModel: {
              model: 1427,
              responseModel: 'gemini-4-carbon',
              systemPrompt: 'SHOULD_NEVER_LEAK',
              messagePrompts: ['SECRET_USER_TEXT'],
              timeToFirstToken: { seconds: '2', nanos: 500000000 },
              streamingDuration: { seconds: '5', nanos: 0 },
              usage: {
                model: 1427,
                inputTokens: '2000',
                outputTokens: '800',
                thinkingOutputTokens: '300',
                responseOutputTokens: '500',
                cacheReadTokens: '18000',
                cacheWriteTokens: '0',
                apiProvider: 24,
                responseId: 'resp-1',
              },
              chatStartMetadata: {
                createdAt: { seconds: '1795214001', nanos: 0 },
                contextWindowMetadata: { estimatedTokensUsed: 128000, maxContextTokens: 512000 },
              },
            },
          },
        ],
      },
    },
    validId,
    labelMap
  );

  const serialized = JSON.stringify(normTraj);
  assert.equal(serialized.includes('SHOULD_NEVER_LEAK'), false);
  assert.equal(serialized.includes('SECRET_USER_TEXT'), false);
  assert.equal(normTraj.trajectory.steps[0].type, 'CORTEX_STEP_TYPE_USER_INPUT');
  assert.equal(normTraj.trajectory.steps[3].invokeSubagent.conversationId, childId);

  const tm = trajectoryMetrics(normTraj);
  assert.equal(tm.rounds, 1);
  assert.equal(tm.model, 'Gemini 4 Carbon (High)');
  assert.equal(tm.tps, 100);
  assert.equal(tm.ttftSeconds, 2.5);
  assert.equal(tm.toolSeconds, 5);
  assert.equal(tm.cache.hitRate, 0.9);
  assert.equal(tm.cache.complete, true);
  assert.equal(tm.context.usedTokens, 128000);
  assert.equal(tm.context.maxTokens, 512000);
  assert.equal(tm.context.usedFraction, 0.25);
});

test('v2.34.0 AntigravityClient & MetricsStore: seamlessly falls back to renderer-proxy when --csrf_token is absent', async () => {
  const cid = '22222222-3333-4444-5555-666666666666';
  const rpcCalls = [];
  const rendererRpc = async (method, body) => {
    rpcCalls.push(method);
    if (method === 'Probe') return { available: true };
    if (method === 'GetUserStatus') {
      return normalizeRendererUserStatus({
        userStatus: { email: 'test@example.com', cascadeModelConfigData: { clientModelConfigs: [] } },
      });
    }
    if (method === 'RetrieveUserQuotaSummary') {
      return normalizeRendererQuotaSummary({
        response: {
          groups: [
            {
              displayName: 'Gemini Models',
              buckets: [
                {
                  bucketId: 'gemini-5h',
                  window: '5h',
                  remaining: { case: 'remainingFraction', value: 0.88 },
                  resetTime: { seconds: '1795228894', nanos: 0 },
                },
              ],
            },
          ],
        },
      });
    }
    if (method === 'GetAllCascadeTrajectories') {
      return normalizeRendererSummaries({
        results: [
          {
            cascadeId: cid,
            title: 'Test Session',
            workspaceName: 'demo-ws',
            lastModifiedTime: { seconds: '1795214500', nanos: 0 },
          },
        ],
      });
    }
    if (method === 'GetCascadeTrajectory') {
      assert.equal(body.cascadeId, cid);
      return normalizeRendererTrajectory(
        {
          status: 2,
          numTotalSteps: 2,
          numTotalGeneratorMetadata: 1,
          trajectory: {
            cascadeId: cid,
            steps: [
              { type: 14, stepCase: 'userInput', metadata: { createdAt: { seconds: '1795214490', nanos: 0 } } },
              { type: 15, stepCase: 'plannerResponse', hasResponseText: true, metadata: { createdAt: { seconds: '1795214495', nanos: 0 } } },
            ],
            generatorMetadata: [
              {
                stepIndices: [1],
                chatModel: {
                  modelDisplayName: 'Gemini 4 Neon (XHigh)',
                  timeToFirstToken: { seconds: '3', nanos: 0 },
                  streamingDuration: { seconds: '4', nanos: 0 },
                  usage: {
                    inputTokens: '1000',
                    outputTokens: '400',
                    responseOutputTokens: '400',
                    cacheReadTokens: '9000',
                    cacheWriteTokens: '0',
                    apiProvider: 24,
                    responseId: 'r-v234',
                  },
                  chatStartMetadata: {
                    createdAt: { seconds: '1795214491', nanos: 0 },
                    contextWindowMetadata: { estimatedTokensUsed: 64000, maxContextTokens: 512000 },
                  },
                },
              },
            ],
          },
        },
        cid
      );
    }
    throw new Error(`Unexpected RPC: ${method}`);
  };

  const client = new AntigravityClient({
    paths: () => ({ log: '/nonexistent/ls.log', logCandidates: ['/nonexistent/ls.log'] }),
    readLog: async () => 'Language server listening on http://127.0.0.1:11244\n',
    processes: async () => [
      {
        ProcessId: 57948,
        CommandLine: 'language_server.exe --standalone --override_ide_version 2.34.0 --read_host_bridge_token_from_stdin',
        Ports: [11244],
      },
    ],
    rendererRpc,
  });

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'prism-v234-store-'));
  const store = new MetricsStore(client, { dataDir: tmpDir });
  try {
    const snap = await store.snapshot({ force: true });
    assert.equal(snap.connection, 'live');
    assert.equal(snap.error, null);
    assert.equal(snap.sessionError, null);
    assert.equal(client.server?.mode, 'renderer-proxy');
    assert.equal(snap.groups.length, 1);
    assert.equal(snap.groups[0].windows['5h'].remaining, 0.88);
    assert.equal(snap.speed.model, 'Gemini 4 Neon (XHigh)');
    assert.equal(snap.speed.rounds, 1);
    assert.equal(snap.speed.tps, 100);
    assert.equal(snap.speed.cache.hitRate, 0.9);
    assert.equal(snap.speed.context.usedTokens, 64000);
    assert.equal(store.startBackground('scope', cid, {}, () => true), false);
    assert.equal(rpcCalls.includes('Probe'), true);
    assert.equal(rpcCalls.includes('GetCascadeTrajectory'), true);
  } finally {
    store.dispose();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('v2.34.0 follow-up fixes: usage-core stepCount/hours, renderer-proxy 120s discovery TTL, neon family & stream-choreography selector', async () => {
  // 1) usage-core must not collapse stepCount to 0 when summaryObj.stepCount===0 and must spread hours by step createdAt
  const d1 = new Date('2026-11-20T02:10:00Z');
  const d2 = new Date('2026-11-20T14:20:00Z');
  const rec = usageCore.analyzeTrajectoryForUsage(
    {
      numTotalSteps: 1642,
      numTotalGeneratorMetadata: 2,
      trajectory: {
        cascadeId: '33333333-4444-5555-6666-777777777777',
        steps: [
          { type: 'CORTEX_STEP_TYPE_PLANNER_RESPONSE', metadata: { createdAt: d1.toISOString() } },
          { type: 'CORTEX_STEP_TYPE_PLANNER_RESPONSE', metadata: { createdAt: d2.toISOString() } },
        ],
        generatorMetadata: [
          { stepIndices: [0], chatModel: { modelDisplayName: 'Gemini 4 Neon (XHigh)', usage: { inputTokens: '100', outputTokens: '50', cacheReadTokens: '0', cacheWriteTokens: '0' } } },
          { stepIndices: [1], chatModel: { modelDisplayName: 'Gemini 4 Neon (XHigh)', usage: { inputTokens: '200', outputTokens: '80', cacheReadTokens: '0', cacheWriteTokens: '0' } } },
        ],
      },
    },
    { stepCount: 0, lastModifiedTime: { seconds: Math.floor(d2.getTime() / 1000) } },
    '33333333-4444-5555-6666-777777777777'
  );
  assert.equal(rec.stepCount, 1642);
  const allHours = Object.values(rec.days).flatMap((d) => d.hours.map((v, h) => (v > 0 ? h : -1)).filter((h) => h >= 0));
  assert.equal(allHours.length >= 2, true);

  // 2) renderer-proxy discovery TTL >= 120s avoids 15s process-scan churn
  let nowMs = 1_000_000;
  let processScans = 0;
  const client = new AntigravityClient({
    now: () => nowMs,
    paths: () => ({ log: '/nonexistent/ls.log', logCandidates: ['/nonexistent/ls.log'] }),
    readLog: async () => 'Language server listening on http://127.0.0.1:11244\n',
    processes: async () => {
      processScans += 1;
      return [{ ProcessId: 1234, CommandLine: 'language_server.exe --standalone --read_host_bridge_token_from_stdin', Ports: [11244] }];
    },
    rendererRpc: async (method) => (method === 'Probe' ? { available: true } : {}),
  });
  await client.discover();
  assert.equal(processScans, 1);
  nowMs += 60_000;
  await client.discover();
  assert.equal(processScans, 1);
  nowMs += 70_000;
  await client.discover();
  assert.equal(processScans, 2);
  client.dispose();

  // 3) Model family & context name normalization for Gemini 4 Neon / Orchestrator
  assert.equal(quotaModelFamily('neon'), 'gemini');
  assert.equal(quotaModelFamily('Gemini 4 Neon (XHigh)'), 'gemini');
  assert.equal(formatModelName('gemini-4-neon-xhigh'), 'Gemini 4 Neon (XHigh)');
  assert.equal(formatModelName('gemini-pro-orchestrator-neon'), 'Orchestrator (Neon)');

  // 4) stream-choreography & inline-fallback include v2.34.0 agent-response [data-markdown-root]
  const scSrc = fs.readFileSync(new URL('../stream-choreography.js', import.meta.url), 'utf8');
  assert.equal(scSrc.includes('[data-testid="agent-response"] [data-markdown-root]'), true);
  assert.equal(scSrc.includes("tid === 'agent-response'"), true);
  const fbSrc = fs.readFileSync(new URL('../vendor/pulse-dashboard/inline-fallback.js', import.meta.url), 'utf8');
  assert.equal(fbSrc.includes('[data-testid="agent-response"]'), true);
});

test('v2.34.0 Orchestrator patch: Claude planner shows Claude icon & tunable Orchestrator mounts unlocked crystal prism bar', () => {
  const mgc = require('../model-glyph-crystal.js');
  // 1) parseModelLabelInfo recognizes Orchestrator + Claude -> brand=claude, isOrchestrator=true
  const orchClaude = mgc.parseModelLabelInfo('Orchestrator Claude Opus 5.5 High');
  assert.equal(orchClaude.isOrchestrator, true);
  assert.equal(orchClaude.brand, 'claude');
  assert.equal(orchClaude.camp, 'claude');
  assert.equal(orchClaude.tier, 'high');

  const orchCarbon = mgc.parseModelLabelInfo('Orchestrator Gemini 4 Carbon High');
  assert.equal(orchCarbon.isOrchestrator, true);
  assert.equal(orchCarbon.brand, 'antigravity');
  assert.equal(orchCarbon.camp, 'gemini');
  assert.equal(orchCarbon.tier, 'high');

  const orchLegacy = mgc.parseModelLabelInfo('Orchestrator');
  assert.equal(orchLegacy.isOrchestrator, true);
  assert.equal(orchLegacy.brand, 'antigravity');
  assert.equal(orchLegacy.tier, 'auto');

  // 2) Fallback data-ces-orch-b="claude" on truncated trigger button
  const fakeBtn = {
    nodeType: 1,
    childNodes: [{ nodeType: 3, nodeValue: 'Orchestrator' }],
    getAttribute: (k) => (k === 'data-ces-orch-b' ? 'claude' : ''),
    querySelectorAll: () => [],
  };
  const ctl = mgc.createModelGlyphCrystalController({
    animatedIcons: null,
    crystalPrismCore: null,
    isDestroyed: () => false,
    isComposerRestyleEnabled: () => true,
    isZh: () => true,
    isDarkTheme: () => true,
    motionReduced: () => false,
    getMinFrameGapMs: () => 0,
    canMountRealCanvas: () => true,
    getLastPointerPos: () => null,
    setAttrIfChanged: (el, k, v) => el.setAttribute(k, v),
  });
  const trigInfo = ctl.parseModelTriggerInfo(fakeBtn);
  assert.equal(trigInfo.isOrchestrator, true);
  assert.equal(trigInfo.brand, 'claude');
  assert.equal(trigInfo.camp, 'claude');

  // 3) crystal-prism-core supports hideLock + Scheme-A fillRatio split without adding new GLSL uniforms
  const cpSrc = fs.readFileSync(new URL('../crystal-prism-core.js', import.meta.url), 'utf8');
  assert.equal(cpSrc.includes('u_reduce < 1.5'), true);
  assert.equal(cpSrc.includes('u_reduce > 1.5'), true);
  assert.equal(cpSrc.includes('if (!hideLock) drawLaserEtchedLock'), true);
  assert.equal(cpSrc.includes('sliderFillRatio'), true);

  // 4) style.css defines frosted crystal knob with compact 32px mouse-tracking prism rim & crisp detent ticks
  const cssSrc = fs.readFileSync(new URL('../style.css', import.meta.url), 'utf8');
  assert.equal(cssSrc.includes('32px circle at var(--knob-px'), true);
  assert.equal(cssSrc.includes('.ces-tick.is-on'), true);
  assert.equal(cssSrc.includes('.ces-knob-notch'), true);
});

test('v2.34.0 renderer-proxy perf: WeakRef LS cache, stale fallback rescan, in-flight coalescing & settled/summary TTL avoid redundant full trajectory deserializations', async () => {
  const cidIdle = '44444444-5555-6666-7777-888888888888';
  const cidRun = '55555555-6666-7777-8888-999999999999';
  const probeExpr = buildRendererRpcExpression('Probe', {});
  assert.equal(probeExpr.includes('__agPrismLsRef'), true, 'renderer-rpc-adapter must cache discovered LS wrapper via WeakRef');

  // Execute buildRendererRpcExpression in VM to verify 0-Fiber-walk WeakRef cache hit + automatic rescan on stale LS error
  let fiberVisits = 0;
  let activeLsBroken = false;
  const ls1 = {
    getUserStatus: async () => {
      if (activeLsBroken) throw new Error('disposed_ls_instance');
      return { userStatus: { email: 'first@example.com', cascadeModelConfigData: { clientModelConfigs: [] } } };
    },
    getCascadeTrajectory: async () => ({ trajectory: { steps: [], generatorMetadata: [] } }),
  };
  const ls2 = {
    getUserStatus: async () => ({ userStatus: { email: 'rebound@example.com', cascadeModelConfigData: { clientModelConfigs: [] } } }),
    getCascadeTrajectory: async () => ({ trajectory: { steps: [], generatorMetadata: [] } }),
  };
  let mountedLs = ls1;
  const fiberRoot = {
    get child() {
      fiberVisits += 1;
      return {
        get memoizedProps() {
          fiberVisits += 1;
          return { value: mountedLs };
        },
        child: null,
        sibling: null,
      };
    },
    sibling: null,
  };
  const domRoot = { '__reactContainer$test': fiberRoot };
  const sandbox = vm.createContext({
    document: { getElementById: (id) => (id === 'root' ? domRoot : null), body: domRoot },
    WeakRef: globalThis.WeakRef,
    Promise,
  });
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;

  const userStatusExpr = buildRendererRpcExpression('GetUserStatus', {});
  const r1 = await vm.runInContext(userStatusExpr, sandbox);
  assert.equal(r1.ok, true);
  assert.equal(r1.data.userStatus.email, 'first@example.com');
  const visitsAfterFirst = fiberVisits;
  assert.ok(visitsAfterFirst >= 2, 'First RPC must walk React Fiber tree');

  // Second RPC must hit WeakRef cache with ZERO Fiber node visits
  const r2 = await vm.runInContext(userStatusExpr, sandbox);
  assert.equal(r2.ok, true);
  assert.equal(fiberVisits, visitsAfterFirst, 'Cached LS wrapper must avoid React Fiber traversal');

  // Simulate React remount invalidating ls1 -> must clear cache, rescan Fiber tree & succeed with ls2
  activeLsBroken = true;
  mountedLs = ls2;
  const r3 = await vm.runInContext(userStatusExpr, sandbox);
  assert.equal(r3.ok, true);
  assert.equal(r3.data.userStatus.email, 'rebound@example.com');
  assert.ok(fiberVisits > visitsAfterFirst, 'Failed cached LS call must fall back to Fiber rescan');

  let nowMs = 2_000_000;
  let trajCalls = 0;
  let releasePending = null;
  const rendererRpc = async (method, body) => {
    if (method === 'Probe') return { available: true };
    if (method === 'GetCascadeTrajectory') {
      trajCalls += 1;
      if (body.cascadeId === cidRun && trajCalls === 1) {
        await new Promise((r) => { releasePending = r; });
      }
      return {
        status: body.cascadeId === cidIdle ? 'CASCADE_RUN_STATUS_1' : 'CASCADE_RUN_STATUS_2',
        numTotalSteps: 2,
        numTotalGeneratorMetadata: 1,
        trajectory: { cascadeId: body.cascadeId, steps: [], generatorMetadata: [] },
      };
    }
    return {};
  };

  const client = new AntigravityClient({
    now: () => nowMs,
    paths: () => ({ log: '/nonexistent/ls.log', logCandidates: ['/nonexistent/ls.log'] }),
    readLog: async () => 'Language server listening on http://127.0.0.1:11244\n',
    processes: async () => [{ ProcessId: 99, CommandLine: 'language_server --standalone', Ports: [11244] }],
    rendererRpc,
  });

  try {
    // 1) Concurrent calls to same cascadeId coalesce into a single renderer RPC
    const p1 = client.trajectory(cidRun);
    const p2 = client.trajectory(cidRun);
    await new Promise((r) => setTimeout(r, 10));
    assert.equal(trajCalls, 1, 'Concurrent trajectory() calls must coalesce');
    releasePending();
    await Promise.all([p1, p2]);

    // 2) Active trajectory caches for 4s (not bypassed by unconditional force=true)
    nowMs += 2000;
    await client.trajectory(cidRun);
    assert.equal(trajCalls, 1, 'Active trajectory must reuse cache within 4s');
    nowMs += 3000;
    await client.trajectory(cidRun);
    assert.equal(trajCalls, 2, 'Active trajectory must refresh after 4s');

    // 3) Settled (status=1 / IDLE) trajectory reuses cache for 20s, and 60s when summary stamp matches
    const sum = { stepCount: 2, lastModifiedTime: { seconds: '1795214500', nanos: 0 } };
    await client.trajectory(cidIdle, { summary: sum });
    assert.equal(trajCalls, 3);
    nowMs += 15000;
    await client.trajectory(cidIdle, { summary: sum });
    assert.equal(trajCalls, 3, 'Settled trajectory must reuse cache at 15s');
    nowMs += 30000;
    await client.trajectory(cidIdle, { summary: sum });
    assert.equal(trajCalls, 3, 'Settled trajectory with unchanged summary stamp must reuse cache up to 60s');
    // Force bypasses cache immediately
    await client.trajectory(cidIdle, { force: true, summary: sum });
    assert.equal(trajCalls, 4, 'force: true must bypass proxy cache immediately');
  } finally {
    client.dispose();
  }
});

test('v2.34.0 Effort Slider: switching from Gemini 4 Neon (XHigh) to Gemini 4 Carbon preserves React HostText nodes and never leaks Extra badge', async () => {
  const neonLow = { label: 'Gemini 4 Neon (Low)', modelId: 'gemini-4-neon-low', value: 1534 };
  const neonMed = { label: 'Gemini 4 Neon (Medium)', modelId: 'gemini-4-neon-medium', value: 1533 };
  const neonHigh = { label: 'Gemini 4 Neon (High)', modelId: 'gemini-4-neon-high', value: 1532 };
  const neonXHigh = { label: 'Gemini 4 Neon (XHigh)', modelId: 'gemini-4-neon-xhigh', value: 1535 };
  const carbonLow = { label: 'Gemini 4 Carbon (Low)', modelId: 'gemini-4-carbon-low', value: 1601 };
  const carbonMed = { label: 'Gemini 4 Carbon (Medium)', modelId: 'gemini-4-carbon-medium', value: 1602 };
  const carbonHigh = { label: 'Gemini 4 Carbon (High)', modelId: 'gemini-4-carbon-high', value: 1603 };
  const carbonSingle = { label: 'Gemini 4 Carbon', modelId: 'gemini-4-carbon', value: 1610 };

  const slugEffortIndex = new Map([
    ['gemini-4-neon', new Map([['low', neonLow], ['medium', neonMed], ['high', neonHigh], ['xhigh', neonXHigh]])],
    ['gemini-4-carbon', new Map([['low', carbonLow], ['medium', carbonMed], ['high', carbonHigh]])],
  ]);
  const modelOptions = [neonLow, neonMed, neonHigh, neonXHigh, carbonLow, carbonMed, carbonHigh, carbonSingle];

  // Minimal DOM + FakeMutationObserver modeling React 19 HostText in-place nodeValue updates
  const observers = new Set();
  function notifyMutation(target, type, extra = {}) {
    for (const obs of observers) obs._deliver({ target, type, ...extra });
  }
  class FakeMO {
    constructor(cb) {
      this._cb = cb;
      this._targets = [];
      this._queue = [];
      observers.add(this);
    }
    observe(target, opts = {}) {
      this._targets.push({ target, opts });
    }
    disconnect() {
      this._targets = [];
      this._queue = [];
    }
    takeRecords() {
      const q = this._queue;
      this._queue = [];
      return q;
    }
    _deliver(rec) {
      for (const { target, opts } of this._targets) {
        if (!containsNode(target, rec.target)) continue;
        if (rec.type === 'characterData' && !opts.characterData) continue;
        if (rec.type === 'childList' && !opts.childList) continue;
        this._queue.push(rec);
        queueMicrotask(() => {
          if (this._queue.length) {
            const batch = this.takeRecords();
            this._cb(batch, this);
          }
        });
        break;
      }
    }
  }
  function containsNode(anc, cur) {
    let p = cur;
    while (p) {
      if (p === anc) return true;
      p = p.parentNode || p.parentElement || null;
    }
    return false;
  }
  function makeTextNode(initial) {
    const node = {
      nodeType: 3,
      parentNode: null,
      parentElement: null,
      _val: String(initial),
      get nodeValue() { return this._val; },
      set nodeValue(v) {
        const s = String(v);
        if (this._val === s) return;
        this._val = s;
        notifyMutation(this, 'characterData');
      },
      get textContent() { return this._val; },
      set textContent(v) { this.nodeValue = v; },
    };
    return node;
  }
  function makeElement(tag, attrs = {}) {
    const attrMap = new Map(Object.entries(attrs));
    const classes = new Set(String(attrs.class || '').split(/\s+/).filter(Boolean));
    const el = {
      nodeType: 1,
      tagName: tag.toUpperCase(),
      parentNode: null,
      parentElement: null,
      style: { setProperty() {}, removeProperty() {}, color: '', opacity: '', fontWeight: '' },
      children: [],
      childNodes: [],
      classList: {
        add: (...cs) => cs.forEach((c) => classes.add(c)),
        remove: (...cs) => cs.forEach((c) => classes.delete(c)),
        contains: (c) => classes.has(c),
        toggle: (c, force) => {
          const on = force === undefined ? !classes.has(c) : Boolean(force);
          if (on) classes.add(c);
          else classes.delete(c);
          return on;
        },
      },
      get firstChild() { return this.childNodes[0] || null; },
      get nextElementSibling() {
        if (!this.parentNode) return null;
        const idx = this.parentNode.children.indexOf(this);
        return idx >= 0 ? this.parentNode.children[idx + 1] || null : null;
      },
      get textContent() {
        return this.childNodes.map((c) => c.textContent).join('');
      },
      set textContent(v) {
        this.childNodes = [];
        this.children = [];
        const tn = makeTextNode(v);
        tn.parentNode = this;
        tn.parentElement = this;
        this.childNodes.push(tn);
        notifyMutation(this, 'childList', { addedNodes: [tn], removedNodes: [] });
      },
      appendChild(child) {
        child.parentNode = this;
        child.parentElement = this;
        this.childNodes.push(child);
        if (child.nodeType === 1) this.children.push(child);
        notifyMutation(this, 'childList', { addedNodes: [child], removedNodes: [] });
        return child;
      },
      removeChild(child) {
        this.childNodes = this.childNodes.filter((c) => c !== child);
        this.children = this.children.filter((c) => c !== child);
        child.parentNode = null;
        child.parentElement = null;
        notifyMutation(this, 'childList', { addedNodes: [], removedNodes: [child] });
        return child;
      },
      remove() {
        if (this.parentNode) this.parentNode.removeChild(this);
      },
      getAttribute: (k) => (attrMap.has(k) ? attrMap.get(k) : null),
      setAttribute: (k, v) => attrMap.set(k, String(v)),
      hasAttribute: (k) => attrMap.has(k),
      removeAttribute: (k) => attrMap.delete(k),
      contains: (other) => containsNode(el, other),
      matches(sel) {
        return sel.split(',').some((raw) => {
          const s = raw.trim();
          if (!s) return false;
          if (s === 'span.min-w-0') return this.tagName === 'SPAN' && classes.has('min-w-0');
          if (s === 'span.opacity-70') return this.tagName === 'SPAN' && classes.has('opacity-70');
          if (s === '[data-ces-part=\'trigger-effort\']' || s === '[data-ces-part="trigger-effort"]') {
            return attrMap.get('data-ces-part') === 'trigger-effort';
          }
          if (s === '[data-testid="model-selector-trigger"]') return attrMap.get('data-testid') === 'model-selector-trigger';
          if (s === '[data-testid="model-selector-panel"]') return attrMap.get('data-testid') === 'model-selector-panel';
          if (s === '[data-testid="model-selector-effort-group"]') return attrMap.get('data-testid') === 'model-selector-effort-group';
          if (s === '[data-testid="model-selector-item"]') return attrMap.get('data-testid') === 'model-selector-item';
          if (s === '[role="menuitem"]') return attrMap.get('role') === 'menuitem';
          if (s === '.ces-ag-section') return classes.has('ces-ag-section');
          if (s === '.ces-set') return classes.has('ces-set');
          if (s === '.ces-ag-effort-title') return classes.has('ces-ag-effort-title');
          if (s === 'span') return this.tagName === 'SPAN';
          return false;
        });
      },
      closest(sel) {
        let p = this;
        while (p && p.nodeType === 1) {
          if (p.matches(sel)) return p;
          p = p.parentElement;
        }
        return null;
      },
      querySelector(sel) {
        return this.querySelectorAll(sel)[0] || null;
      },
      querySelectorAll(sel) {
        const res = [];
        const walk = (n) => {
          for (const ch of n.children || []) {
            if (ch.matches?.(sel)) res.push(ch);
            walk(ch);
          }
        };
        walk(this);
        return res;
      },
      addEventListener() {},
      removeEventListener() {},
    };
    return el;
  }

  let currentSelected = neonHigh;
  const selectorState = {
    effortIndex: slugEffortIndex,
    modelOptions,
    get selectedModel() { return currentSelected; },
    setSelectedModel: (m) => { currentSelected = m; },
    setIsOpen: () => {},
  };

  const docEl = makeElement('html');
  const head = makeElement('head');
  const body = makeElement('body');
  docEl.appendChild(head);
  docEl.appendChild(body);

  const triggerBtn = makeElement('button', { 'data-testid': 'model-selector-trigger' });
  const outerSpan = makeElement('span', { class: 'min-w-0' });
  const reactModelText = makeTextNode('Gemini 4 Neon');
  const effortSpan = makeElement('span', { class: 'opacity-70' });
  const reactEffortText = makeTextNode(' High');
  outerSpan.appendChild(reactModelText);
  effortSpan.appendChild(reactEffortText);
  outerSpan.appendChild(effortSpan);
  triggerBtn.appendChild(outerSpan);
  triggerBtn['__reactFiber$test'] = { memoizedProps: { value: selectorState }, return: null };
  body.appendChild(triggerBtn);

  const doc = {
    documentElement: docEl,
    head,
    body,
    createElement: (t) => makeElement(t),
    getElementById: (id) => head.children.find((c) => c.id === id) || null,
    querySelector: (s) => docEl.querySelector(s),
    querySelectorAll: (s) => docEl.querySelectorAll(s),
    addEventListener() {},
    removeEventListener() {},
  };
  const win = {
    document: doc,
    MutationObserver: FakeMO,
    AntigravityCodexEffortSlider: effortSlider,
    setTimeout,
    clearTimeout,
    addEventListener() {},
    removeEventListener() {},
  };

  const ctrl = sliderCoexist.createEffortSliderController({ window: win, document: doc });
  try {
    ctrl.sync({ effortSliderModule: 'auto' });

    // 1) User selects Neon Extra (XHigh): trigger shows "Gemini 4 Neon Extra" while keeping exact React HostText nodes!
    currentSelected = neonXHigh;
    win.__agCodexEffortSliderInstance.rescan();
    assert.equal(outerSpan.textContent, 'Gemini 4 Neon Extra');
    assert.equal(outerSpan.firstChild, reactModelText, 'Model base TextNode reference must be preserved');
    assert.equal(effortSpan.firstChild, reactEffortText, 'Effort Span HostText reference must NEVER be replaced via textContent');
    assert.equal(effortSpan.style.color, '#8b5cf6', 'Neon Extra should display max-tier purple');

    // 2) Host switches to 3-tier Gemini 4 Carbon (Medium) via React HostText characterData update ONLY (even if effort text wasn't updated yet!)
    currentSelected = carbonMed;
    reactModelText.nodeValue = 'Gemini 4 Carbon';
    await new Promise((r) => setTimeout(r, 150));

    assert.equal(outerSpan.firstChild, reactModelText);
    assert.equal(effortSpan.firstChild, reactEffortText, 'HostText node must remain intact across model switches');
    assert.equal(outerSpan.textContent, 'Gemini 4 Carbon Medium', 'Trigger must update to Carbon Medium via localized characterData MO and never retain Extra');

    // Also switch to Carbon (High) via characterData
    currentSelected = carbonHigh;
    reactEffortText.nodeValue = ' High';
    await new Promise((r) => setTimeout(r, 150));
    assert.equal(outerSpan.textContent, 'Gemini 4 Carbon High', 'Trigger must display Gemini 4 Carbon High');

    // 3) Host switches to single-tier locked Gemini 4 Carbon (no effort levels in effortIndex or modelOptions): clears effort text AND purple inline style
    slugEffortIndex.delete('gemini-4-carbon');
    modelOptions.splice(4, 3);
    currentSelected = carbonSingle;
    reactModelText.nodeValue = 'Gemini 4 Carbon ';
    reactModelText.nodeValue = 'Gemini 4 Carbon';
    await new Promise((r) => setTimeout(r, 150));

    assert.equal(outerSpan.textContent, 'Gemini 4 Carbon', 'Locked single-tier Carbon must clear stale effort suffix');
    assert.equal(effortSpan.firstChild, reactEffortText, 'Clearing effort text on locked model must still preserve HostText node');
    assert.equal(effortSpan.style.color, '', 'Locked single-tier Carbon must clear residual purple inline color');
  } finally {
    ctrl.destroy();
  }
});

test('Issue #11: multi-HostText effortSpan (React 19 [" ", "Medium"]) & extra spans never detach; disabling effortSliderModule syncs trigger live to High', async () => {
  const argonLow = { label: 'Gemini 4 Argon (Low)', modelId: 'gemini-4-argon-low', value: 1610 };
  const argonMed = { label: 'Gemini 4 Argon (Medium)', modelId: 'gemini-4-argon-medium', value: 1611 };
  const argonHigh = { label: 'Gemini 4 Argon (High)', modelId: 'gemini-4-argon-high', value: 1612 };
  const argonXHigh = { label: 'Gemini 4 Argon (XHigh)', modelId: 'gemini-4-argon-xhigh', value: 1613 };
  const carbonLow = { label: 'Gemini 4 Carbon (Low)', modelId: 'gemini-4-carbon-low', value: 1520 };
  const carbonMed = { label: 'Gemini 4 Carbon (Medium)', modelId: 'gemini-4-carbon-medium', value: 1521 };
  const carbonHigh = { label: 'Gemini 4 Carbon (High)', modelId: 'gemini-4-carbon-high', value: 1522 };
  const carbonSingle = { label: 'Gemini 4 Carbon', modelId: 'gemini-4-carbon', value: 1525 };

  const slugEffortIndex = new Map([
    ['gemini-4-argon', new Map([['low', argonLow], ['medium', argonMed], ['high', argonHigh], ['xhigh', argonXHigh]])],
    ['gemini-4-carbon', new Map([['low', carbonLow], ['medium', carbonMed], ['high', carbonHigh]])],
  ]);
  const modelOptions = [argonLow, argonMed, argonHigh, argonXHigh, carbonLow, carbonMed, carbonHigh];

  const moInstances = [];
  function notifyMutation(target, type, extra = {}) {
    for (const mo of moInstances) mo._deliver({ target, type, addedNodes: [], removedNodes: [], ...extra });
  }
  class FakeMO {
    constructor(cb) {
      this._cb = cb;
      this._targets = [];
      this._queue = [];
      moInstances.push(this);
    }
    observe(target, opts = {}) {
      this._targets.push({ target, opts });
    }
    disconnect() {
      this._targets = [];
      this._queue = [];
    }
    takeRecords() {
      const q = this._queue.slice();
      this._queue = [];
      return q;
    }
    _deliver(rec) {
      for (const { target, opts } of this._targets) {
        if (!containsNode(target, rec.target)) continue;
        if (rec.type === 'characterData' && !opts.characterData) continue;
        if (rec.type === 'childList' && !opts.childList) continue;
        this._queue.push(rec);
        queueMicrotask(() => {
          if (this._queue.length) {
            const batch = this.takeRecords();
            this._cb(batch, this);
          }
        });
        break;
      }
    }
  }
  function containsNode(anc, cur) {
    let p = cur;
    while (p) {
      if (p === anc) return true;
      p = p.parentNode || p.parentElement || null;
    }
    return false;
  }

  let docEl = null;
  function makeTextNode(initial) {
    const node = {
      nodeType: 3,
      parentNode: null,
      parentElement: null,
      _val: String(initial),
      get isConnected() { return Boolean(docEl && containsNode(docEl, this)); },
      get nodeValue() { return this._val; },
      set nodeValue(v) {
        const s = String(v);
        if (this._val === s) return;
        this._val = s;
        notifyMutation(this, 'characterData');
      },
      get textContent() { return this._val; },
      set textContent(v) { this.nodeValue = v; },
    };
    return node;
  }
  function makeElement(tag, attrs = {}) {
    const attrMap = new Map(Object.entries(attrs));
    const classes = new Set(String(attrs.class || '').split(/\s+/).filter(Boolean));
    const el = {
      nodeType: 1,
      tagName: tag.toUpperCase(),
      parentNode: null,
      parentElement: null,
      style: { setProperty() {}, removeProperty() {}, color: '', opacity: '', fontWeight: '' },
      children: [],
      childNodes: [],
      get isConnected() { return Boolean(docEl && containsNode(docEl, this)); },
      classList: {
        add: (...cs) => cs.forEach((c) => classes.add(c)),
        remove: (...cs) => cs.forEach((c) => classes.delete(c)),
        contains: (c) => classes.has(c),
        toggle: (c, force) => {
          const on = force === undefined ? !classes.has(c) : Boolean(force);
          if (on) classes.add(c);
          else classes.delete(c);
          return on;
        },
      },
      get firstChild() { return this.childNodes[0] || null; },
      get nextElementSibling() {
        if (!this.parentNode) return null;
        const idx = this.parentNode.children.indexOf(this);
        return idx >= 0 ? this.parentNode.children[idx + 1] || null : null;
      },
      get textContent() {
        return this.childNodes.map((c) => c.textContent).join('');
      },
      set textContent(v) {
        for (const ch of this.childNodes) { ch.parentNode = null; ch.parentElement = null; }
        this.childNodes = [];
        this.children = [];
        const tn = makeTextNode(v);
        tn.parentNode = this;
        tn.parentElement = this;
        this.childNodes.push(tn);
        notifyMutation(this, 'childList', { addedNodes: [tn], removedNodes: [] });
      },
      appendChild(child) {
        child.parentNode = this;
        child.parentElement = this;
        this.childNodes.push(child);
        if (child.nodeType === 1) this.children.push(child);
        notifyMutation(this, 'childList', { addedNodes: [child], removedNodes: [] });
        return child;
      },
      removeChild(child) {
        this.childNodes = this.childNodes.filter((c) => c !== child);
        this.children = this.children.filter((c) => c !== child);
        child.parentNode = null;
        child.parentElement = null;
        notifyMutation(this, 'childList', { addedNodes: [], removedNodes: [child] });
        return child;
      },
      remove() {
        if (this.parentNode) this.parentNode.removeChild(this);
      },
      getAttribute: (k) => (attrMap.has(k) ? attrMap.get(k) : null),
      setAttribute: (k, v) => attrMap.set(k, String(v)),
      hasAttribute: (k) => attrMap.has(k),
      removeAttribute: (k) => attrMap.delete(k),
      contains: (other) => containsNode(el, other),
      matches(sel) {
        return sel.split(',').some((raw) => {
          const s = raw.trim();
          if (!s) return false;
          if (s === 'span.min-w-0') return this.tagName === 'SPAN' && classes.has('min-w-0');
          if (s === 'span.opacity-70') return this.tagName === 'SPAN' && classes.has('opacity-70');
          if (s === "[data-ces-part='trigger-effort']" || s === '[data-ces-part="trigger-effort"]') {
            return attrMap.get('data-ces-part') === 'trigger-effort';
          }
          if (s === '[data-testid="model-selector-trigger"]') return attrMap.get('data-testid') === 'model-selector-trigger';
          if (s === '[data-testid="model-selector-panel"]') return attrMap.get('data-testid') === 'model-selector-panel';
          if (s === 'span') return this.tagName === 'SPAN';
          const attrOnly = /^\[([a-zA-Z0-9_-]+)\]$/.exec(s);
          if (attrOnly) return attrMap.has(attrOnly[1]);
          return false;
        });
      },
      closest(sel) {
        let p = this;
        while (p && p.nodeType === 1) {
          if (p.matches(sel)) return p;
          p = p.parentElement;
        }
        return null;
      },
      querySelector(sel) {
        return this.querySelectorAll(sel)[0] || null;
      },
      querySelectorAll(sel) {
        const res = [];
        const walk = (n) => {
          for (const ch of n.children || []) {
            if (ch.matches?.(sel)) res.push(ch);
            walk(ch);
          }
        };
        walk(this);
        return res;
      },
      addEventListener() {},
      removeEventListener() {},
    };
    return el;
  }

  let currentSelected = argonMed;
  const selectorState = {
    effortIndex: slugEffortIndex,
    modelOptions,
    get selectedModel() { return currentSelected; },
    setSelectedModel: (m) => { currentSelected = m; },
    setIsOpen: () => {},
  };

  docEl = makeElement('html');
  const head = makeElement('head');
  const body = makeElement('body');
  docEl.appendChild(head);
  docEl.appendChild(body);

  // React 19 JSX `<span className="min-w-0">{base}<span className="opacity-70"> {effort}</span><span className="native-icon" /></span>`
  const triggerBtn = makeElement('button', { 'data-testid': 'model-selector-trigger' });
  const outerSpan = makeElement('span', { class: 'min-w-0' });
  const reactModelText = makeTextNode('Gemini 4 Argon');
  const effortSpan = makeElement('span', { class: 'opacity-70' });
  const reactSpaceText = makeTextNode(' ');
  const reactEffortText = makeTextNode('Medium');
  const extraNativeSpan = makeElement('span', { class: 'native-icon' });
  effortSpan.appendChild(reactSpaceText);
  effortSpan.appendChild(reactEffortText);
  outerSpan.appendChild(reactModelText);
  outerSpan.appendChild(effortSpan);
  outerSpan.appendChild(extraNativeSpan);
  triggerBtn.appendChild(outerSpan);
  triggerBtn['__reactFiber$test'] = { memoizedProps: { value: selectorState }, return: null };
  body.appendChild(triggerBtn);

  const doc = {
    documentElement: docEl,
    head,
    body,
    createElement: (t) => makeElement(t),
    createTextNode: (t) => makeTextNode(t),
    getElementById: (id) => head.children.find((c) => c.id === id) || null,
    querySelector: (s) => docEl.querySelector(s),
    querySelectorAll: (s) => docEl.querySelectorAll(s),
    addEventListener() {},
    removeEventListener() {},
  };
  const win = {
    document: doc,
    MutationObserver: FakeMO,
    AntigravityCodexEffortSlider: effortSlider,
    setTimeout,
    clearTimeout,
    addEventListener() {},
    removeEventListener() {},
  };

  const ctrl = sliderCoexist.createEffortSliderController({ window: win, document: doc });
  try {
    ctrl.sync({ effortSliderModule: 'auto' });

    currentSelected = argonXHigh;
    win.__agCodexEffortSliderInstance.rescan();
    assert.equal(outerSpan.textContent, 'Gemini 4 Argon Extra');
    assert.equal(reactSpaceText.isConnected, true, 'Leading space HostText must remain connected');
    assert.equal(reactEffortText.isConnected, true, 'Effort HostText must NEVER be detached by _setTxt');
    assert.equal(extraNativeSpan.isConnected, true, 'Extra native <span> inside outerSpan must NEVER be removed');
    assert.equal(extraNativeSpan.parentNode, outerSpan);

    currentSelected = carbonMed;
    reactModelText.nodeValue = 'Gemini 4 Carbon';
    win.__agCodexEffortSliderInstance.rescan();
    assert.equal(outerSpan.textContent, 'Gemini 4 Carbon Medium');
    assert.equal(reactSpaceText.isConnected, true);
    assert.equal(reactEffortText.isConnected, true);
    assert.equal(extraNativeSpan.isConnected, true);

    slugEffortIndex.delete('gemini-4-carbon');
    modelOptions.splice(4, 3);
    currentSelected = carbonSingle;
    win.__agCodexEffortSliderInstance.rescan();
    assert.equal(outerSpan.textContent, 'Gemini 4 Carbon');
    assert.equal(reactSpaceText.isConnected, true);
    assert.equal(reactEffortText.isConnected, true);

    currentSelected = argonMed;
    reactModelText.nodeValue = 'Gemini 4 Argon';
    win.__agCodexEffortSliderInstance.rescan();
    assert.equal(outerSpan.textContent, 'Gemini 4 Argon Medium');
    assert.equal(reactSpaceText.nodeValue, ' ', 'Leading space HostText must be restored to single space');
    assert.equal(reactEffortText.nodeValue, 'Medium');
    assert.equal(reactSpaceText.isConnected, true);
    assert.equal(reactEffortText.isConnected, true);

    triggerBtn.setAttribute('data-ag-cs-model-submenu', '1');
    triggerBtn.setAttribute('data-ag-cs-orch-l2', '1');
    triggerBtn.setAttribute('data-ag-cs-orch-l3', '1');
    triggerBtn.setAttribute('data-ces-orch-row', '1');
    docEl.setAttribute('data-ces-slider-ready', '1');
    ctrl.sync({ effortSliderModule: 'off' });
    assert.equal(win.__agCodexEffortSliderInstance, undefined, 'Built-in instance must be fully removed when off');
    assert.equal(docEl.hasAttribute('data-ces-slider-ready'), false);
    assert.equal(triggerBtn.hasAttribute('data-ag-cs-model-submenu'), false);
    assert.equal(triggerBtn.hasAttribute('data-ag-cs-orch-l2'), false);
    assert.equal(triggerBtn.hasAttribute('data-ag-cs-orch-l3'), false);
    assert.equal(triggerBtn.hasAttribute('data-ces-orch-row'), false);
    assert.equal(effortSpan.style.color, '');

    let orphanStopped = false;
    win.__agCodexEffortSliderInstance = { __prismOwned: true, stop() { orphanStopped = true; } };
    ctrl.sync({ effortSliderModule: 'off' });
    assert.equal(orphanStopped, true, 'Orphan __prismOwned instance must be stopped when off');
    assert.equal(win.__agCodexEffortSliderInstance, undefined);

    currentSelected = argonHigh;
    reactEffortText.nodeValue = 'High';
    assert.equal(reactEffortText.isConnected, true);
    assert.equal(outerSpan.textContent, 'Gemini 4 Argon High', 'Trigger button must immediately reflect React 19 High update instead of freezing on Medium');
  } finally {
    ctrl.destroy();
  }
});

test('Issue #16 + PR #12 + Issue #11: React 19 multi-HostText [" ", "Medium"] -> [" ", "متوسط"] & menu sib have 0 ping-pong loop under live i18n, preserve HostText, and reset cache across off/on toggle', async () => {
  const argonLow = { label: 'Gemini 4 Argon (Low)', modelId: 'gemini-4-argon-low', value: 1610 };
  const argonMed = { label: 'Gemini 4 Argon (Medium)', modelId: 'gemini-4-argon-medium', value: 1611 };
  const argonHigh = { label: 'Gemini 4 Argon (High)', modelId: 'gemini-4-argon-high', value: 1612 };
  const argonXHigh = { label: 'Gemini 4 Argon (XHigh)', modelId: 'gemini-4-argon-xhigh', value: 1613 };
  const carbonSingle = { label: 'Gemini 4 Carbon', modelId: 'gemini-4-carbon', value: 1525 };

  const slugEffortIndex = new Map([
    ['gemini-4-argon', new Map([['low', argonLow], ['medium', argonMed], ['high', argonHigh], ['xhigh', argonXHigh]])],
  ]);
  const modelOptions = [argonLow, argonMed, argonHigh, argonXHigh, carbonSingle];

  const moInstances = [];
  function notifyMutation(target, type, extra = {}) {
    for (const mo of moInstances) mo._deliver({ target, type, addedNodes: [], removedNodes: [], ...extra });
  }
  class FakeMO {
    constructor(cb) {
      this._cb = cb;
      this._targets = [];
      this._queue = [];
      moInstances.push(this);
    }
    observe(target, opts = {}) { this._targets.push({ target, opts }); }
    disconnect() { this._targets = []; this._queue = []; }
    takeRecords() { const q = this._queue.slice(); this._queue = []; return q; }
    _deliver(rec) {
      for (const { target, opts } of this._targets) {
        if (!containsNode(target, rec.target)) continue;
        if (rec.type === 'characterData' && !opts.characterData) continue;
        if (rec.type === 'childList' && !opts.childList) continue;
        this._queue.push(rec);
        queueMicrotask(() => {
          if (this._queue.length) {
            const batch = this.takeRecords();
            this._cb(batch, this);
          }
        });
        break;
      }
    }
  }
  function containsNode(anc, cur) {
    let p = cur;
    while (p) {
      if (p === anc) return true;
      p = p.parentNode || p.parentElement || null;
    }
    return false;
  }

  let docEl = null;
  function makeTextNode(initial) {
    return {
      nodeType: 3,
      parentNode: null,
      parentElement: null,
      _val: String(initial),
      _writes: 0,
      get isConnected() { return Boolean(docEl && containsNode(docEl, this)); },
      get nodeValue() { return this._val; },
      set nodeValue(v) {
        const s = String(v);
        if (this._val === s) return;
        this._val = s;
        this._writes += 1;
        notifyMutation(this, 'characterData');
      },
      get textContent() { return this._val; },
      set textContent(v) { this.nodeValue = v; },
    };
  }
  function makeElement(tag, attrs = {}) {
    const attrMap = new Map(Object.entries(attrs));
    const classes = new Set(String(attrs.class || '').split(/\s+/).filter(Boolean));
    const el = {
      nodeType: 1,
      tagName: tag.toUpperCase(),
      parentNode: null,
      parentElement: null,
      style: { setProperty() {}, removeProperty() {}, color: '', opacity: '', fontWeight: '', display: '' },
      children: [],
      childNodes: [],
      get isConnected() { return Boolean(docEl && containsNode(docEl, this)); },
      get className() { return Array.from(classes).join(' '); },
      set className(v) {
        classes.clear();
        String(v || '').split(/\s+/).filter(Boolean).forEach((c) => classes.add(c));
      },
      classList: {
        add: (...cs) => cs.forEach((c) => classes.add(c)),
        remove: (...cs) => cs.forEach((c) => classes.delete(c)),
        contains: (c) => classes.has(c),
        toggle: (c, force) => {
          const on = force === undefined ? !classes.has(c) : Boolean(force);
          if (on) classes.add(c);
          else classes.delete(c);
          return on;
        },
      },
      get firstChild() { return this.childNodes[0] || null; },
      get firstElementChild() { return this.children[0] || null; },
      get nextSibling() {
        if (!this.parentNode) return null;
        const idx = this.parentNode.childNodes.indexOf(this);
        return idx >= 0 ? this.parentNode.childNodes[idx + 1] || null : null;
      },
      get nextElementSibling() {
        if (!this.parentNode) return null;
        const idx = this.parentNode.children.indexOf(this);
        return idx >= 0 ? this.parentNode.children[idx + 1] || null : null;
      },
      get textContent() { return this.childNodes.map((c) => c.textContent).join(''); },
      set textContent(v) {
        for (const ch of this.childNodes) { ch.parentNode = null; ch.parentElement = null; }
        this.childNodes = [];
        this.children = [];
        const tn = makeTextNode(v);
        tn.parentNode = this;
        tn.parentElement = this;
        this.childNodes.push(tn);
        notifyMutation(this, 'childList', { addedNodes: [tn], removedNodes: [] });
      },
      get innerHTML() { return ''; },
      set innerHTML(v) {
        if (!v) {
          for (const ch of this.childNodes) { ch.parentNode = null; ch.parentElement = null; }
          this.childNodes = [];
          this.children = [];
        }
      },
      appendChild(child) {
        child.parentNode = this;
        child.parentElement = this;
        this.childNodes.push(child);
        if (child.nodeType === 1) this.children.push(child);
        notifyMutation(this, 'childList', { addedNodes: [child], removedNodes: [] });
        return child;
      },
      insertBefore(child, ref) {
        if (!ref) return this.appendChild(child);
        child.parentNode = this;
        child.parentElement = this;
        const ci = this.childNodes.indexOf(ref);
        if (ci >= 0) this.childNodes.splice(ci, 0, child);
        else this.childNodes.push(child);
        if (child.nodeType === 1) this.children = this.childNodes.filter((n) => n.nodeType === 1);
        notifyMutation(this, 'childList', { addedNodes: [child], removedNodes: [] });
        return child;
      },
      removeChild(child) {
        this.childNodes = this.childNodes.filter((c) => c !== child);
        this.children = this.children.filter((c) => c !== child);
        child.parentNode = null;
        child.parentElement = null;
        notifyMutation(this, 'childList', { addedNodes: [], removedNodes: [child] });
        return child;
      },
      remove() { if (this.parentNode) this.parentNode.removeChild(this); },
      getAttribute: (k) => (attrMap.has(k) ? attrMap.get(k) : null),
      setAttribute: (k, v) => attrMap.set(k, String(v)),
      hasAttribute: (k) => attrMap.has(k),
      removeAttribute: (k) => attrMap.delete(k),
      contains: (other) => containsNode(el, other),
      matches(sel) {
        return sel.split(',').some((raw) => {
          const s = raw.trim();
          if (!s) return false;
          if (s === 'span.min-w-0') return this.tagName === 'SPAN' && classes.has('min-w-0');
          if (s === 'span.opacity-70') return this.tagName === 'SPAN' && classes.has('opacity-70');
          if (s === "[data-ces-part='trigger-effort']" || s === '[data-ces-part="trigger-effort"]') return attrMap.get('data-ces-part') === 'trigger-effort';
          if (s === '[data-ces-part="value"]') return attrMap.get('data-ces-part') === 'value';
          if (s === '.ces-ag-effort-value') return classes.has('ces-ag-effort-value');
          if (s === '.ces-ag-section') return classes.has('ces-ag-section');
          if (s === '.ces-ag-effort-title') return classes.has('ces-ag-effort-title');
          if (s === '.ces-ag-panel-enhanced') return classes.has('ces-ag-panel-enhanced');
          if (s === '.ces-set') return classes.has('ces-set');
          if (s === '[data-testid="model-selector-trigger"]') return attrMap.get('data-testid') === 'model-selector-trigger';
          if (s === '[data-testid="model-selector-panel"]') return attrMap.get('data-testid') === 'model-selector-panel';
          if (s === '[data-testid="model-selector-effort-group"]') return attrMap.get('data-testid') === 'model-selector-effort-group';
          if (s === '[data-testid="model-selector-item"]') return attrMap.get('data-testid') === 'model-selector-item';
          if (s === '[role="menuitem"]') return attrMap.get('role') === 'menuitem';
          if (s === 'span') return this.tagName === 'SPAN';
          const attrOnly = /^\[([a-zA-Z0-9_-]+)\]$/.exec(s);
          if (attrOnly) return attrMap.has(attrOnly[1]);
          return false;
        });
      },
      closest(sel) {
        let p = this;
        while (p && p.nodeType === 1) {
          if (p.matches(sel)) return p;
          p = p.parentElement;
        }
        return null;
      },
      querySelector(sel) { return this.querySelectorAll(sel)[0] || null; },
      querySelectorAll(sel) {
        const res = [];
        const walk = (n) => {
          for (const ch of n.children || []) {
            if (ch.matches?.(sel)) res.push(ch);
            walk(ch);
          }
        };
        walk(this);
        return res;
      },
      addEventListener() {},
      removeEventListener() {},
    };
    return el;
  }

  let currentSelected = argonMed;
  const selectorState = {
    effortIndex: slugEffortIndex,
    modelOptions,
    get selectedModel() { return currentSelected; },
    setSelectedModel: (m) => { currentSelected = m; },
    setIsOpen: () => {},
  };

  docEl = makeElement('html');
  const head = makeElement('head');
  const body = makeElement('body');
  docEl.appendChild(head);
  docEl.appendChild(body);

  // React 19 multi-HostText trigger button + open panel with effort-group row sib
  const triggerBtn = makeElement('button', { 'data-testid': 'model-selector-trigger' });
  const outerSpan = makeElement('span', { class: 'min-w-0' });
  const reactModelText = makeTextNode('Gemini 4 Argon');
  const effortSpan = makeElement('span', { class: 'opacity-70' });
  const reactSpaceText = makeTextNode(' ');
  const reactEffortText = makeTextNode('Medium');
  const extraNativeSpan = makeElement('span', { class: 'native-icon' });
  effortSpan.appendChild(reactSpaceText);
  effortSpan.appendChild(reactEffortText);
  outerSpan.appendChild(reactModelText);
  outerSpan.appendChild(effortSpan);
  outerSpan.appendChild(extraNativeSpan);
  triggerBtn.appendChild(outerSpan);
  triggerBtn['__reactFiber$test'] = { memoizedProps: { value: selectorState }, return: null };
  body.appendChild(triggerBtn);

  const panel = makeElement('div', { 'data-testid': 'model-selector-panel' });
  const listWrap = makeElement('div');
  const menuItem = makeElement('div', { role: 'menuitem' });
  const groupSpan = makeElement('span', { 'data-testid': 'model-selector-effort-group', 'data-model-base': 'Gemini 4 Argon' });
  groupSpan.appendChild(makeTextNode('Gemini 4 Argon'));
  const sibSpan = makeElement('span');
  const sibText = makeTextNode('Medium');
  sibSpan.appendChild(sibText);
  menuItem.appendChild(groupSpan);
  menuItem.appendChild(sibSpan);
  listWrap.appendChild(menuItem);
  panel.appendChild(listWrap);
  panel['__reactFiber$test'] = { memoizedProps: { value: selectorState }, return: null };
  body.appendChild(panel);

  const doc = {
    documentElement: docEl,
    head,
    body,
    createElement: (t) => makeElement(t),
    createTextNode: (t) => makeTextNode(t),
    getElementById: (id) => head.children.find((c) => c.id === id) || null,
    querySelector: (s) => docEl.querySelector(s),
    querySelectorAll: (s) => docEl.querySelectorAll(s),
    addEventListener() {},
    removeEventListener() {},
  };
  const win = {
    document: doc,
    MutationObserver: FakeMO,
    AntigravityCodexEffortSlider: effortSlider,
    matchMedia: () => ({ matches: false }),
    setTimeout,
    clearTimeout,
    addEventListener() {},
    removeEventListener() {},
  };

  const ctrl = sliderCoexist.createEffortSliderController({ window: win, document: doc });
  try {
    ctrl.sync({ effortSliderModule: 'auto' });
    const valEl = panel.querySelector('.ces-ag-effort-value');
    assert.ok(valEl);
    assert.equal(valEl.textContent, 'Medium');

    // Simulate external Chinese i18n translating React 19 HostText [" ", "Medium"] -> [" ", "متوسط"], sib -> "متوسط", valEl -> "متوسط"
    reactEffortText.nodeValue = 'متوسط';
    sibText.nodeValue = 'متوسط';
    valEl.textContent = 'متوسط';
    const trigWritesAfterZh = reactEffortText._writes;
    const sibWritesAfterZh = sibText._writes;

    // Wait past slider-coexist throttle window (120ms) and trigger explicit rescan: must produce ZERO ping-pong overwrites
    await new Promise((r) => setTimeout(r, 180));
    win.__agCodexEffortSliderInstance.rescan();
    await new Promise((r) => setTimeout(r, 60));

    assert.equal(reactEffortText._writes, trigWritesAfterZh, 'React 19 effort HostText must have 0 ping-pong overwrites');
    assert.equal(sibText._writes, sibWritesAfterZh, 'Menu row sib HostText must have 0 ping-pong overwrites');
    assert.equal(outerSpan.textContent, 'Gemini 4 Argon متوسط');
    assert.equal(sibSpan.textContent, 'متوسط');
    assert.equal(valEl.textContent, 'متوسط');
    assert.equal(reactSpaceText.isConnected, true);
    assert.equal(reactEffortText.isConnected, true);
    assert.equal(extraNativeSpan.isConnected, true);

    // Real tier change Medium -> Extra updates all 3 sites while keeping React 19 HostText nodes intact
    currentSelected = argonXHigh;
    win.__agCodexEffortSliderInstance.rescan();
    assert.equal(outerSpan.textContent, 'Gemini 4 Argon Extra');
    assert.equal(sibSpan.textContent, 'Extra');
    assert.equal(valEl.textContent, 'Extra');
    assert.equal(reactSpaceText.nodeValue, ' ');
    assert.equal(reactSpaceText.isConnected, true);
    assert.equal(reactEffortText.isConnected, true);

    // Re-localize Extra -> فائق -> still 0 ping-pong overwrites
    reactEffortText.nodeValue = 'فائق';
    sibText.nodeValue = 'تفكير فائق';
    valEl.textContent = 'فائق';
    const tw2 = reactEffortText._writes;
    const sw2 = sibText._writes;
    await new Promise((r) => setTimeout(r, 160));
    assert.equal(reactEffortText._writes, tw2);
    assert.equal(sibText._writes, sw2);
    assert.equal(outerSpan.textContent, 'Gemini 4 Argon فائق');

    // Switch to locked single-tier Carbon clears localized suffix cleanly without detaching HostText
    currentSelected = carbonSingle;
    reactModelText.nodeValue = 'Gemini 4 Carbon';
    win.__agCodexEffortSliderInstance.rescan();
    assert.equal(outerSpan.textContent, 'Gemini 4 Carbon');
    assert.equal(reactSpaceText.isConnected, true);
    assert.equal(reactEffortText.isConnected, true);

    // Toggle off clears __cesLastText / __cesLastLabel and lets React update freely; toggling back on must sync cleanly
    ctrl.sync({ effortSliderModule: 'off' });
    assert.equal(effortSpan.__cesLastText, undefined, 'sync(off) must clear effortSpan.__cesLastText');
    assert.equal(sibSpan.__cesLastText, undefined, 'sync(off) must clear sibSpan.__cesLastText');
    currentSelected = argonHigh;
    reactModelText.nodeValue = 'Gemini 4 Argon';
    reactSpaceText.nodeValue = ' ';
    reactEffortText.nodeValue = 'High';
    assert.equal(outerSpan.textContent, 'Gemini 4 Argon High', 'React 19 HostText updates must apply immediately while slider is off');

    // Re-enable slider: stale cache must not prevent syncing sib & valEl to current High tier
    ctrl.sync({ effortSliderModule: 'auto' });
    assert.equal(sibSpan.textContent, 'High', 'Re-enabling slider after off must sync sib to current High tier');
    assert.equal(panel.querySelector('.ces-ag-effort-value').textContent, 'High');
    assert.equal(outerSpan.textContent, 'Gemini 4 Argon High');
    assert.equal(reactSpaceText.isConnected, true);
    assert.equal(reactEffortText.isConnected, true);
  } finally {
    ctrl.destroy();
  }
});

test('PR #17 Home Studio Quotas: fallback resilience, telemetry-off veto, no double-fire, R3 cooldowns, inline-fallback lastSnap/timeouts & daemon forwarding', async () => {
  const homeStudioPanel = require('../home-studio-panel.js');
  const inlineFallback = require('../vendor/pulse-dashboard/inline-fallback.js');
  const prevWin = globalThis.window;
  const prevDoc = globalThis.document;
  const prevStorage = globalThis.localStorage;
  const origDateNow = Date.now;
  const origSetTimeout = globalThis.setTimeout;

  function makeQuotaDom() {
    const storeMem = new Map();
    function makeNode(tag) {
      const attrs = new Map();
      const listeners = new Map();
      const children = [];
      const el = {
        nodeType: 1,
        tagName: String(tag).toUpperCase(),
        children,
        parentNode: null,
        parentElement: null,
        isConnected: true,
        disabled: false,
        type: '',
        value: '',
        id: '',
        className: '',
        _text: '',
        style: { setProperty() {}, removeProperty() {}, transform: '', width: '' },
        set textContent(v) { children.length = 0; this._text = String(v); },
        get textContent() { return children.length ? children.map((c) => c.textContent).join('') : this._text; },
        set innerHTML(v) { children.length = 0; this._text = String(v); },
        get innerHTML() { return this._text; },
        get childElementCount() { return children.length; },
        get firstChild() { return children[0] || null; },
        get nextSibling() {
          if (!this.parentElement) return null;
          const idx = this.parentElement.children.indexOf(this);
          return idx >= 0 ? this.parentElement.children[idx + 1] || null : null;
        },
        get previousSibling() {
          if (!this.parentElement) return null;
          const idx = this.parentElement.children.indexOf(this);
          return idx > 0 ? this.parentElement.children[idx - 1] || null : null;
        },
        appendChild(ch) {
          if (ch.parentElement) ch.parentElement.removeChild(ch);
          ch.parentElement = el;
          ch.parentNode = el;
          children.push(ch);
          return ch;
        },
        insertBefore(ch, ref) {
          if (ch.parentElement) ch.parentElement.removeChild(ch);
          ch.parentElement = el;
          ch.parentNode = el;
          const idx = ref ? children.indexOf(ref) : -1;
          if (idx >= 0) children.splice(idx, 0, ch);
          else children.push(ch);
          return ch;
        },
        removeChild(ch) {
          const idx = children.indexOf(ch);
          if (idx >= 0) children.splice(idx, 1);
          ch.parentElement = null;
          ch.parentNode = null;
          return ch;
        },
        setAttribute(k, v) { attrs.set(k, String(v)); if (k === 'id') this.id = String(v); },
        getAttribute(k) { return attrs.has(k) ? attrs.get(k) : null; },
        hasAttribute(k) { return attrs.has(k); },
        removeAttribute(k) { attrs.delete(k); },
        addEventListener(ev, fn) { if (!listeners.has(ev)) listeners.set(ev, []); listeners.get(ev).push(fn); },
        click() { for (const fn of listeners.get('click') || []) fn({ type: 'click' }); },
        querySelector(sel) { return el.querySelectorAll(sel)[0] || null; },
        querySelectorAll(sel) {
          const out = [];
          const walk = (n) => {
            for (const c of n.children || []) {
              if (sel.startsWith('.') && String(c.className || '').split(/\s+/).includes(sel.slice(1))) out.push(c);
              else if (sel === '[data-testid="home-greeting"]' && c.getAttribute('data-testid') === 'home-greeting') out.push(c);
              else if (sel.startsWith('[data-tab="') && c.getAttribute('data-tab') === sel.slice(11, -2)) out.push(c);
              walk(c);
            }
          };
          walk(el);
          return out;
        },
      };
      return el;
    }
    const root = makeNode('html');
    const head = makeNode('head');
    const body = makeNode('body');
    const home = makeNode('div');
    home.className = 'agy-home';
    const greeting = makeNode('div');
    greeting.setAttribute('data-testid', 'home-greeting');
    home.appendChild(greeting);
    body.appendChild(home);
    root.appendChild(head);
    root.appendChild(body);
    const doc = {
      title: 'obsidian-prism - Antigravity',
      documentElement: root,
      head,
      body,
      createElement: (t) => makeNode(t),
      getElementById: (id) => root.children.flatMap((c) => [c, ...c.children]).find((c) => c.id === id) || null,
      querySelector: (s) => root.querySelector(s),
      querySelectorAll: (s) => root.querySelectorAll(s),
    };
    const storage = {
      getItem: (k) => (storeMem.has(k) ? storeMem.get(k) : null),
      setItem: (k, v) => storeMem.set(k, String(v)),
    };
    return { doc, root, home, storage };
  }

  const future5h = new Date(Date.now() + 2 * 3600 * 1000).toISOString();
  const futureWeek = new Date(Date.now() + 4 * 86400 * 1000).toISOString();
  const liveGroups = [
    {
      id: 'gemini',
      name: 'Gemini Models',
      windows: {
        '5h': { available: true, id: 'gemini-5h', remaining: 0.88, resetAt: future5h },
        weekly: { available: true, id: 'gemini-weekly', remaining: 0.91, resetAt: futureWeek },
      },
    },
    {
      id: '3p',
      name: 'Claude and GPT models',
      windows: {
        '5h': { available: true, id: '3p-5h', remaining: 1, resetAt: future5h },
        weekly: { available: true, id: '3p-weekly', remaining: 0.5, resetAt: futureWeek },
      },
    },
  ];

  const makeCtl = () => homeStudioPanel.createHomeStudioPanelController({
    usageCore,
    storageUsageCacheKey: 'test:quotas:v234',
    isDestroyed: () => false,
    getHomeLayout: () => 'studio',
    getLang: () => 'ar',
    uiText: () => ({ quotaEmptyHint: 'لا تتوفر بيانات الحصة حاليًا', tabQuotas: 'الحصص', tabOverview: 'نظرة عامة' }),
    getDisplayName: () => 'Dev',
    ensureHooks: () => ({ store: { getState: () => ({ trajectorySummaries: { summaries: {} } }) }, svc: {} }),
    canMountRealCanvas: () => false,
    setAttrIfChanged: (el, k, v) => el?.setAttribute?.(k, v),
    runGuardedMut: (fn) => fn(),
  });

  try {
    // 1a) External agPulseHost returns offline empty groups -> falls back to __agPrismMetricsBridge & renders quota cards
    {
      const { doc, home, storage } = makeQuotaDom();
      const bridgeInputs = [];
      globalThis.document = doc;
      globalThis.localStorage = storage;
      globalThis.window = {
        agPulseHost: {
          getMetrics: async () => ({ connection: 'offline', error: 'No usable local detection credentials provided by this version', groups: [] }),
        },
        __agPrismMetricsBridge: {
          getMetrics: async (inp) => {
            bridgeInputs.push(inp);
            return { connection: 'live', groups: liveGroups };
          },
        },
        __agPrismTelemetry: {
          refresh: async () => null,
          getLatestSnapshot: () => null,
        },
      };
      const ctl = makeCtl();
      ctl.renderHomePanel(true);
      const quotasTab = home.querySelector('[data-tab="quotas"]');
      assert.ok(quotasTab);
      quotasTab.click();
      await new Promise((r) => origSetTimeout(r, 30));
      assert.equal(bridgeInputs.length, 1);
      assert.equal(bridgeInputs[0].selectLatest, false);
      assert.equal(bridgeInputs[0].quotaRefresh, true);
      assert.equal(home.querySelectorAll('.ag-cs-quota-card').length, 2, 'Must render 2 live quota cards via __agPrismMetricsBridge fallback');
      assert.equal(home.querySelectorAll('.ag-cs-home-models-empty').length, 0);
    }

    // 1b) External agPulseHost hangs (>3s timeout) -> times out at ~3000ms and falls back to __agPrismMetricsBridge
    {
      const { doc, home, storage } = makeQuotaDom();
      let bridgeCalls = 0;
      globalThis.document = doc;
      globalThis.localStorage = storage;
      globalThis.window = {
        agPulseHost: {
          getMetrics: () => new Promise(() => {}),
        },
        __agPrismMetricsBridge: {
          getMetrics: async (inp) => {
            bridgeCalls += 1;
            assert.equal(inp.selectLatest, false);
            return { connection: 'live', groups: liveGroups };
          },
        },
      };
      const ctl = makeCtl();
      ctl.renderHomePanel(true);
      const t0 = origDateNow();
      const snap = await ctl.refreshLiveTelemetrySnapshot(true);
      const elapsed = origDateNow() - t0;
      assert.equal(bridgeCalls, 1, 'Stalled external agPulseHost must fall back to __agPrismMetricsBridge after 3s timeout');
      assert.equal(snap?.groups?.length, 2);
      assert.ok(elapsed >= 2800 && elapsed < 7000, `Expected ~3000ms timeout fallback, got ${elapsed}ms`);
    }

    // 1c) External agPulseHost throws AND __agPrismMetricsBridge missing -> falls back to __agPrismMetricsCall;
    //     restores __agPrismMetricsResolve with ownership check; empty snapshot does NOT wipe cached live groups.
    {
      const { doc, home, storage } = makeQuotaDom();
      let hostCalls = 0;
      let bindingCalls = 0;
      let returnLiveFromBinding = false;
      let swapResolveMidflight = false;
      const prevResolveMarker = () => {};
      const externalReplacementResolve = () => {};
      globalThis.document = doc;
      globalThis.localStorage = storage;
      globalThis.window = {
        agPulseHost: {
          getMetrics: () => {
            hostCalls += 1;
            if (hostCalls === 1) throw new Error('boom');
            return Promise.reject(new Error('offline'));
          },
        },
        __agPrismMetricsResolve: prevResolveMarker,
        __agPrismMetricsCall: (payloadStr) => {
          bindingCalls += 1;
          const req = JSON.parse(payloadStr);
          const capturedCb = globalThis.window.__agPrismMetricsResolve;
          origSetTimeout(() => {
            if (swapResolveMidflight) {
              globalThis.window.__agPrismMetricsResolve = externalReplacementResolve;
            }
            capturedCb?.(
              req.id,
              returnLiveFromBinding ? { connection: 'live', groups: liveGroups } : { connection: 'offline', groups: [] }
            );
          }, 5);
        },
      };
      const ctl = makeCtl();
      ctl.renderHomePanel(true);
      const initialSnap = await ctl.refreshLiveTelemetrySnapshot(false);
      assert.equal(Array.isArray(initialSnap?.groups) ? initialSnap.groups.length : 0, 0);
      assert.equal(globalThis.window.__agPrismMetricsResolve, prevResolveMarker, 'Must restore previous __agPrismMetricsResolve');

      // First Quotas tab click retries because previous snapshot had no usable groups
      returnLiveFromBinding = true;
      home.querySelector('[data-tab="quotas"]').click();
      await new Promise((r) => origSetTimeout(r, 40));
      assert.equal(bindingCalls, 2);
      assert.equal(home.querySelectorAll('.ag-cs-quota-card').length, 2, 'Must populate cards from __agPrismMetricsCall fallback on retry');

      // Subsequent empty/offline snapshot must NOT overwrite previously cached live quota groups,
      // and ownership check must NOT clobber a replacement __agPrismMetricsResolve installed mid-flight!
      returnLiveFromBinding = false;
      swapResolveMidflight = true;
      const afterEmpty = await ctl.refreshLiveTelemetrySnapshot(true);
      assert.equal(afterEmpty.groups.length, 2, 'Must retain previously fetched valid quota groups when refresh returns empty');
      assert.equal(home.querySelectorAll('.ag-cs-quota-card').length, 2);
      assert.equal(
        globalThis.window.__agPrismMetricsResolve,
        externalReplacementResolve,
        'Ownership check must not overwrite replacement __agPrismMetricsResolve installed during flight'
      );
    }

    // 2) Healthy external agPulseHost returning valid groups -> adopted directly with 0 fallback calls
    {
      const { doc, home, storage } = makeQuotaDom();
      let extCalls = 0;
      let bridgeCalls = 0;
      let bindingCalls = 0;
      let telRefreshCalls = 0;
      globalThis.document = doc;
      globalThis.localStorage = storage;
      globalThis.window = {
        agPulseHost: {
          getMetrics: async () => {
            extCalls += 1;
            return { connection: 'live', groups: liveGroups };
          },
        },
        __agPrismMetricsBridge: {
          getMetrics: async () => {
            bridgeCalls += 1;
            return { connection: 'live', groups: liveGroups };
          },
        },
        __agPrismMetricsCall: () => {
          bindingCalls += 1;
        },
        __agPrismTelemetry: {
          refresh: async () => {
            telRefreshCalls += 1;
            return { connection: 'live', groups: liveGroups };
          },
          getLatestSnapshot: () => null,
        },
      };
      const ctl = makeCtl();
      ctl.renderHomePanel(true);
      const snap = await ctl.refreshLiveTelemetrySnapshot(true);
      assert.equal(extCalls, 1);
      assert.equal(snap?.groups?.length, 2);
      assert.equal(bridgeCalls, 0, 'Healthy external agPulseHost must NEVER pierce through to __agPrismMetricsBridge');
      assert.equal(bindingCalls, 0, 'Healthy external agPulseHost must NEVER pierce through to __agPrismMetricsCall');
      assert.equal(telRefreshCalls, 0, 'Healthy external agPulseHost must NEVER pierce through to __agPrismTelemetry.refresh');
    }

    // 3) No double-fire: when __agPrismMetricsBridge.getMetrics returns empty, NEVER invoke __agPrismMetricsCall
    {
      const { doc, storage } = makeQuotaDom();
      let bridgeCalls = 0;
      let bindingCalls = 0;
      let telRefreshCalls = 0;
      globalThis.document = doc;
      globalThis.localStorage = storage;
      globalThis.window = {
        agPulseHost: {
          getMetrics: async () => ({ connection: 'offline', groups: [] }),
        },
        __agPrismMetricsBridge: {
          getMetrics: async () => {
            bridgeCalls += 1;
            return { connection: 'offline', groups: [] };
          },
        },
        __agPrismMetricsCall: () => {
          bindingCalls += 1;
        },
        __agPrismTelemetry: {
          refresh: async () => {
            telRefreshCalls += 1;
            return null;
          },
          getLatestSnapshot: () => null,
        },
      };
      const ctl = makeCtl();
      await ctl.refreshLiveTelemetrySnapshot(true);
      assert.equal(bridgeCalls, 1);
      assert.equal(bindingCalls, 0, 'Must NOT double-fire __agPrismMetricsCall when __agPrismMetricsBridge.getMetrics returned empty');
      assert.equal(telRefreshCalls, 0, 'Must NOT cascade to __agPrismTelemetry.refresh after bridge call');
    }

    // 4) data-ag-cs-telemetry="off" strict veto:
    //    4a) external host empty -> 0 Prism bridge/binding/telemetry calls;
    //    4b) external host healthy -> read-only allowed, 0 Prism calls;
    //    4c) __prismFallback host -> 0 host/bridge/binding calls.
    {
      const { doc, root, storage } = makeQuotaDom();
      root.setAttribute('data-ag-cs-telemetry', 'off');
      let extCalls = 0;
      let bridgeCalls = 0;
      let bindingCalls = 0;
      let telRefreshCalls = 0;
      globalThis.document = doc;
      globalThis.localStorage = storage;
      globalThis.window = {
        agPulseHost: {
          getMetrics: async () => {
            extCalls += 1;
            return { connection: 'offline', groups: [] };
          },
        },
        __agPrismMetricsBridge: {
          getMetrics: async () => {
            bridgeCalls += 1;
            return { connection: 'live', groups: liveGroups };
          },
        },
        __agPrismMetricsCall: () => {
          bindingCalls += 1;
        },
        __agPrismTelemetry: {
          refresh: async () => {
            telRefreshCalls += 1;
            return { connection: 'live', groups: liveGroups };
          },
          getLatestSnapshot: () => ({ connection: 'live', groups: liveGroups }),
        },
      };
      const ctl = makeCtl();
      const emptySnap = await ctl.refreshLiveTelemetrySnapshot(true);
      assert.equal(extCalls, 1);
      assert.equal(emptySnap, null);
      assert.equal(bridgeCalls, 0, 'telemetry="off" must veto __agPrismMetricsBridge fallback');
      assert.equal(bindingCalls, 0, 'telemetry="off" must veto __agPrismMetricsCall fallback');
      assert.equal(telRefreshCalls, 0, 'telemetry="off" must veto __agPrismTelemetry.refresh');

      // 4b) external non-prismFallback agPulseHost returning live groups is still readable
      globalThis.window.agPulseHost = {
        getMetrics: async () => ({ connection: 'live', groups: liveGroups }),
      };
      const okSnap = await ctl.refreshLiveTelemetrySnapshot(true);
      assert.equal(okSnap?.groups?.length, 2, 'telemetry="off" allows read-only external non-fallback agPulseHost');
      assert.equal(bridgeCalls, 0);
      assert.equal(bindingCalls, 0);

      // 4c) __prismFallback host is blocked when telemetry="off"
      let prismHostCalls = 0;
      globalThis.window.agPulseHost = {
        __prismFallback: true,
        getMetrics: async () => {
          prismHostCalls += 1;
          return { connection: 'live', groups: liveGroups };
        },
      };
      const ctl2 = makeCtl();
      const blockedSnap = await ctl2.refreshLiveTelemetrySnapshot(true);
      assert.equal(blockedSnap, null);
      assert.equal(prismHostCalls, 0, 'telemetry="off" must not call __prismFallback agPulseHost');
      assert.equal(bridgeCalls, 0);
      assert.equal(bindingCalls, 0);
    }

    // 5) Google R3 cooldown enforcement:
    //    - 15s fail cooldown for non-force auto refresh
    //    - 20s tab-switch cooldown for Quotas tab
    //    - 5s manual button cooldown (while programmatic refreshLiveTelemetrySnapshot(true) bypasses UI button cooldown)
    //    - in-flight deduplication without unthrottled follow-up retry in finally
    {
      let fakeNow = 100000;
      Date.now = () => fakeNow;
      try {
        const { doc, home, storage } = makeQuotaDom();
        let bridgeCalls = 0;
        let pendingResolve = null;
        globalThis.document = doc;
        globalThis.localStorage = storage;
        globalThis.window = {
          __agPrismMetricsBridge: {
            getMetrics: () => {
              bridgeCalls += 1;
              if (pendingResolve === 'HOLD') {
                return new Promise((resolve) => { pendingResolve = resolve; });
              }
              return Promise.resolve({ connection: 'offline', groups: [] });
            },
          },
        };
        const ctl = makeCtl();
        ctl.renderHomePanel(true);

        // 5a) Auto refresh fail cooldown (15s)
        await ctl.refreshLiveTelemetrySnapshot(false);
        assert.equal(bridgeCalls, 1);
        fakeNow += 14999;
        await ctl.refreshLiveTelemetrySnapshot(false);
        assert.equal(bridgeCalls, 1, 'Non-force refresh within 15s of empty/fail must be throttled');
        fakeNow += 1;
        await ctl.refreshLiveTelemetrySnapshot(false);
        assert.equal(bridgeCalls, 2, 'Non-force refresh after 15s cooldown must proceed');

        // 5b) Quotas tab-switch cooldown (20s)
        home.querySelector('[data-tab="quotas"]').click();
        await new Promise((r) => origSetTimeout(r, 15));
        assert.equal(bridgeCalls, 3, 'First Quotas tab switch triggers one quotaRefresh');
        fakeNow += 19999;
        home.querySelector('[data-tab="overview"]').click();
        home.querySelector('[data-tab="quotas"]').click();
        await new Promise((r) => origSetTimeout(r, 15));
        assert.equal(bridgeCalls, 3, 'Repeated Quotas tab switch within 20s must be throttled');
        fakeNow += 1;
        home.querySelector('[data-tab="overview"]').click();
        home.querySelector('[data-tab="quotas"]').click();
        await new Promise((r) => origSetTimeout(r, 15));
        assert.equal(bridgeCalls, 4, 'Quotas tab switch after 20s cooldown may retry');

        // 5c) Refresh button manual cooldown (5s)
        const getRefreshBtn = () => home.querySelector('.ag-cs-quota-refresh');
        getRefreshBtn().click();
        await new Promise((r) => origSetTimeout(r, 15));
        assert.equal(bridgeCalls, 5, 'First manual refresh button click proceeds');
        fakeNow += 4999;
        getRefreshBtn().click();
        await new Promise((r) => origSetTimeout(r, 15));
        assert.equal(bridgeCalls, 5, 'Rapid manual refresh button clicks within 5s must be throttled');
        fakeNow += 1;
        getRefreshBtn().click();
        await new Promise((r) => origSetTimeout(r, 15));
        assert.equal(bridgeCalls, 6, 'Manual refresh button after 5s cooldown proceeds');

        // 5d) Direct programmatic refreshLiveTelemetrySnapshot(true) is NOT blocked by 5s UI button cooldown
        await ctl.refreshLiveTelemetrySnapshot(true);
        await ctl.refreshLiveTelemetrySnapshot(true);
        assert.equal(bridgeCalls, 8, 'Programmatic refreshLiveTelemetrySnapshot(true) must bypass UI button cooldown');

        // 5e) In-flight dedupe: concurrent force call during pending request must NOT fire unthrottled second request in finally
        fakeNow += 16000;
        pendingResolve = 'HOLD';
        const p1 = ctl.refreshLiveTelemetrySnapshot(false);
        const p2 = ctl.refreshLiveTelemetrySnapshot(true);
        await new Promise((r) => origSetTimeout(r, 10));
        assert.equal(bridgeCalls, 9);
        assert.equal(typeof pendingResolve, 'function');
        pendingResolve({ connection: 'offline', groups: [] });
        pendingResolve = null;
        await Promise.all([p1, p2]);
        await new Promise((r) => origSetTimeout(r, 15));
        assert.equal(bridgeCalls, 9, 'Must not fire unthrottled follow-up retry in finally after concurrent call');
      } finally {
        Date.now = origDateNow;
      }
    }

    // 6a) inline-fallback.js: mRes updates lastSnap (preserving speed & conversations) and selects 10000ms / 4500ms timeout
    {
      const recordedTimeouts = [];
      const sentPayloads = [];
      const { doc } = makeQuotaDom();
      const fakeWin = {
        document: doc,
        location: { pathname: '/' },
        __agPrismMetricsCall: (payloadStr) => {
          sentPayloads.push(JSON.parse(payloadStr));
        },
      };
      const tel = inlineFallback.createTelemetryController({ window: fakeWin, document: doc });
      globalThis.setTimeout = (fn, ms, ...rest) => {
        recordedTimeouts.push(ms);
        return origSetTimeout(fn, ms, ...rest);
      };
      try {
        tel.sync({ telemetryModule: 'auto' });
        assert.ok(fakeWin.__agPrismMetricsBridge && typeof fakeWin.__agPrismMetricsBridge.getMetrics === 'function');

        // Normal request -> 4500ms timeout; resolves with live speed + conversations + groups
        const pNormal = fakeWin.__agPrismMetricsBridge.getMetrics({ conversationId: null, force: false });
        assert.equal(recordedTimeouts.at(-1), 4500, 'Normal reqSnap must use 4500ms timeout');
        const id1 = sentPayloads.at(-1).id;
        const speedObj = { model: 'Gemini 4 Carbon', tps: 52.3, rounds: 4 };
        const convList = [{ id: '11111111-1111-1111-1111-111111111111', title: 'Chat A' }];
        fakeWin.__agPrismMetricsResolve(id1, {
          connection: 'live',
          speed: speedObj,
          conversations: convList,
          groups: [liveGroups[0]],
        });
        await pNormal;
        assert.equal(tel.getLatestSnapshot().groups.length, 1);
        assert.deepEqual(tel.getLatestSnapshot().speed, speedObj);
        assert.deepEqual(tel.getLatestSnapshot().conversations, convList);

        // quotaRefresh request -> 10000ms timeout; resolves with groups only (speed: null, conversations: [])
        const pQuota = fakeWin.__agPrismMetricsBridge.getMetrics({ conversationId: null, force: false, quotaRefresh: true, selectLatest: false });
        assert.equal(recordedTimeouts.at(-1), 10000, 'quotaRefresh reqSnap must use 10000ms timeout');
        const id2 = sentPayloads.at(-1).id;
        fakeWin.__agPrismMetricsResolve(id2, {
          connection: 'live',
          speed: null,
          conversations: [],
          groups: liveGroups,
        });
        await pQuota;
        assert.equal(tel.getLatestSnapshot().groups.length, 2, 'mRes must update lastSnap with live groups');
        assert.deepEqual(tel.getLatestSnapshot().speed, speedObj, 'mRes must preserve lastSnap.speed when incoming speed is null');
        assert.deepEqual(tel.getLatestSnapshot().conversations, convList, 'mRes must preserve lastSnap.conversations when incoming conversations is empty');

        // force request -> 10000ms timeout; local-estimate / empty groups must NOT overwrite lastSnap
        const pForce = fakeWin.__agPrismMetricsBridge.getMetrics({ conversationId: null, force: true });
        assert.equal(recordedTimeouts.at(-1), 10000, 'force reqSnap must use 10000ms timeout');
        const id3 = sentPayloads.at(-1).id;
        fakeWin.__agPrismMetricsResolve(id3, { connection: 'local-estimate', speed: { model: 'est' }, groups: liveGroups });
        await pForce;
        assert.deepEqual(tel.getLatestSnapshot().speed, speedObj, 'local-estimate must not overwrite lastSnap');
      } finally {
        globalThis.setTimeout = origSetTimeout;
        tel.destroy();
      }
    }

    // 6b) PrismDaemon.ensureMetricsCollector forwards selectLatest:false & quotaRefresh:true, and defaults selectLatest:true
    {
      const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
      const tmpDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'prism-daemon-quota-'));
      try {
        const daemon = new PrismDaemon({ rootDir: repoRoot, enableAutoUpdateTimer: false });
        const rpcCalls = [];
        const fakeClient = {
          server: { port: 0, csrf: '', pid: 1, mode: 'renderer-proxy' },
          setCdpPort() {},
          async discover() { return this.server; },
          async call(method, body) {
            rpcCalls.push([method, body || null]);
            if (method === 'GetUserStatus') return { userStatus: { email: 'dev@example.com' } };
            if (method === 'RetrieveUserQuotaSummary') {
              return {
                response: {
                  groups: [{
                    displayName: 'Gemini Models',
                    buckets: [{ bucketId: 'gemini-5h', window: '5h', remainingFraction: 0.77, resetTime: future5h }],
                  }],
                },
              };
            }
            if (method === 'GetAllCascadeTrajectories') return { trajectorySummaries: {} };
            throw new Error(`Unexpected RPC ${method}`);
          },
          dispose() {},
        };
        daemon._lazyStore = new MetricsStore(fakeClient, { dataDir: tmpDataDir });
        const collector = await daemon.ensureMetricsCollector();

        // selectLatest: false + quotaRefresh: true skips GetAllCascadeTrajectories and sends forceRefresh:true
        const res = await collector({ conversationId: null, force: false, quotaRefresh: true, selectLatest: false });
        assert.equal(res.connection, 'live');
        assert.equal(res.groups.length, 1);
        assert.equal(res.speed, null);
        assert.deepEqual(rpcCalls.map(([m]) => m), ['GetUserStatus', 'RetrieveUserQuotaSummary']);
        assert.deepEqual(rpcCalls[1][1], { forceRefresh: true });

        // Default call (omitting selectLatest) preserves selectLatest:true and fetches summaries for conversation bar
        rpcCalls.length = 0;
        await collector({ conversationId: null, force: false });
        assert.ok(
          rpcCalls.some(([m]) => m === 'GetAllCascadeTrajectories'),
          'Default ensureMetricsCollector call must preserve selectLatest:true'
        );
        daemon._lazyStore.dispose();
      } finally {
        fs.rmSync(tmpDataDir, { recursive: true, force: true });
      }
    }
  } finally {
    Date.now = origDateNow;
    globalThis.setTimeout = origSetTimeout;
    if (prevWin === undefined) delete globalThis.window;
    else globalThis.window = prevWin;
    if (prevDoc === undefined) delete globalThis.document;
    else globalThis.document = prevDoc;
    if (prevStorage === undefined) delete globalThis.localStorage;
    else globalThis.localStorage = prevStorage;
  }
});
