import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import { createRequire } from 'node:module';

import {
  buildRendererRpcExpression,
  normalizeRendererTrajectory,
} from '../vendor/pulse-dashboard/sidecars/panel/renderer-rpc-adapter.mjs';
import { trajectoryMetrics } from '../vendor/pulse-dashboard/sidecars/panel/metrics.mjs';
import { safeContext } from '../vendor/pulse-dashboard/sidecars/panel/context.mjs';
import { SessionHistory } from '../vendor/pulse-dashboard/sidecars/panel/history.mjs';
import { TrajectoryJson } from '../vendor/pulse-dashboard/sidecars/panel/trajectory-json.mjs';
import { DiskStatistics } from '../vendor/pulse-dashboard/sidecars/panel/disk-statistics.mjs';
import { AntigravityClient } from '../vendor/pulse-dashboard/sidecars/panel/client.mjs';
import { MetricsStore } from '../vendor/pulse-dashboard/sidecars/panel/store.mjs';

const require = createRequire(import.meta.url);
const pulseVialBridge = require('../pulse-vial-bridge.js');
const vialCore = require('../vial-core.js');

const CID = '77777777-8888-4999-8aaa-bbbbbbbbbbbb';

function makeBaseChatGen(stepIdx, createdIso, estimatedTokensUsed, maxContextTokens = 512000, extraCsm = {}, respId = 'resp-1') {
  return {
    stepIndices: [stepIdx],
    chatModel: {
      model: 1427,
      modelDisplayName: 'Gemini 4 Carbon (High)',
      responseModel: 'gemini-4-carbon',
      timeToFirstToken: { seconds: 1, nanos: 200000000 },
      streamingDuration: { seconds: 4, nanos: 0 },
      usage: {
        model: 1427,
        inputTokens: '4000',
        outputTokens: '600',
        responseOutputTokens: '400',
        thinkingOutputTokens: '200',
        cacheReadTokens: '36000',
        cacheWriteTokens: '0',
        apiProvider: 'API_PROVIDER_GOOGLE_GEMINI',
        responseId: respId,
      },
      chatStartMetadata: {
        createdAt: createdIso,
        startStepIndex: Math.max(0, stepIdx - 1),
        ...extraCsm,
        contextWindowMetadata: {
          estimatedTokensUsed,
          maxContextTokens,
        },
      },
    },
  };
}

test('Issue #36: normal uncompacted turns, intentOnly checkpoints, in-progress/failed checkpoints keep lastChat contextWindowMetadata unchanged', () => {
  const t0 = '2026-11-22T10:00:00.000Z';
  const t1 = '2026-11-22T10:00:05.000Z';
  const t2 = '2026-11-22T10:00:20.000Z';

  // 1) Normal conversation without compaction
  const normal = trajectoryMetrics({
    status: 'CASCADE_RUN_STATUS_IDLE',
    numTotalSteps: 2,
    numTotalGeneratorMetadata: 1,
    trajectory: {
      cascadeId: CID,
      steps: [
        { type: 'CORTEX_STEP_TYPE_USER_INPUT', metadata: { createdAt: t0 } },
        { type: 'CORTEX_STEP_TYPE_PLANNER_RESPONSE', metadata: { createdAt: t1, completedAt: t1 }, plannerResponse: { response: 'x', toolCalls: [] } },
      ],
      generatorMetadata: [makeBaseChatGen(1, t0, 460800, 512000)],
    },
  });
  assert.equal(normal.context.usedTokens, 460800);
  assert.equal(normal.context.maxTokens, 512000);
  assert.equal(normal.context.usedFraction, 0.9);
  assert.equal(normal.context.compacted, undefined);
  assert.equal(normal.context.source, 'Antigravity context window metadata');

  // 2) intentOnly: true checkpoint must NOT trigger post-compaction drop
  const intentOnlyRes = trajectoryMetrics({
    status: 'CASCADE_RUN_STATUS_IDLE',
    numTotalSteps: 3,
    numTotalGeneratorMetadata: 1,
    trajectory: {
      cascadeId: CID,
      steps: [
        { type: 'CORTEX_STEP_TYPE_USER_INPUT', metadata: { createdAt: t0 } },
        { type: 'CORTEX_STEP_TYPE_PLANNER_RESPONSE', metadata: { createdAt: t1, completedAt: t1 }, plannerResponse: { response: 'x', toolCalls: [] } },
        {
          type: 'CORTEX_STEP_TYPE_CHECKPOINT',
          status: 'CORTEX_STEP_STATUS_DONE',
          metadata: { createdAt: t2, completedAt: t2 },
          checkpoint: { checkpointIndex: 1, intentOnly: true, summaryTokens: 200 },
        },
      ],
      generatorMetadata: [makeBaseChatGen(1, t0, 460800, 512000)],
    },
  });
  assert.equal(intentOnlyRes.context.usedTokens, 460800, 'intentOnly checkpoint must not drop context occupancy');
  assert.equal(intentOnlyRes.context.compacted, undefined);

  // 3) In-progress (RUNNING / GENERATING) or failed/canceled checkpoints must NOT prematurely drop occupancy
  for (const status of ['CORTEX_STEP_STATUS_RUNNING', 'CORTEX_STEP_STATUS_GENERATING', 2, 8, 'CORTEX_STEP_STATUS_ERROR', 'CORTEX_STEP_STATUS_CANCELED', 6, 7]) {
    const res = trajectoryMetrics({
      status: 'CASCADE_RUN_STATUS_RUNNING',
      numTotalSteps: 3,
      numTotalGeneratorMetadata: 1,
      trajectory: {
        cascadeId: CID,
        steps: [
          { type: 'CORTEX_STEP_TYPE_USER_INPUT', metadata: { createdAt: t0 } },
          { type: 'CORTEX_STEP_TYPE_PLANNER_RESPONSE', metadata: { createdAt: t1, completedAt: t1 }, plannerResponse: { response: 'x', toolCalls: [] } },
          {
            type: 'CORTEX_STEP_TYPE_CHECKPOINT',
            status,
            metadata: { createdAt: t2 },
            checkpoint: { checkpointIndex: 1, intentOnly: false, renderLatestCheckpoint: true },
          },
        ],
        generatorMetadata: [makeBaseChatGen(1, t0, 460800, 512000)],
      },
    });
    assert.equal(res.context.usedTokens, 460800, `Checkpoint in status=${status} must keep pre-compact reading until completed`);
  }

  // 4) modelSummarizationFailed without fallback must NOT trigger compaction drop
  const failedSum = trajectoryMetrics({
    status: 'CASCADE_RUN_STATUS_IDLE',
    numTotalSteps: 3,
    numTotalGeneratorMetadata: 1,
    trajectory: {
      cascadeId: CID,
      steps: [
        { type: 'CORTEX_STEP_TYPE_USER_INPUT', metadata: { createdAt: t0 } },
        { type: 'CORTEX_STEP_TYPE_PLANNER_RESPONSE', metadata: { createdAt: t1, completedAt: t1 }, plannerResponse: { response: 'x', toolCalls: [] } },
        {
          type: 'CORTEX_STEP_TYPE_CHECKPOINT',
          status: 'CORTEX_STEP_STATUS_DONE',
          metadata: { createdAt: t2, completedAt: t2 },
          checkpoint: { checkpointIndex: 1, intentOnly: false, modelSummarizationFailed: true, usedFallbackSummary: false },
        },
      ],
      generatorMetadata: [makeBaseChatGen(1, t0, 460800, 512000)],
    },
  });
  assert.equal(failedSum.context.usedTokens, 460800);
});

test('Issue #36 Branch A: host AgentState.contextWindowUsage (estimatedAfterCompaction) extracted read-only via renderer Fiber & passed through with zero text leak', async () => {
  const sec0 = 1795250000;
  const secCompact = 1795250060;

  const lsMock = {
    getUserStatus: async () => ({}),
    getCascadeTrajectory: async () => ({
      status: 1n,
      numTotalSteps: 3n,
      numTotalGeneratorMetadata: 1n,
      trajectory: {
        cascadeId: CID,
        steps: [
          { type: 14, status: 3, step: { case: 'userInput', value: {} }, metadata: { createdAt: { seconds: BigInt(sec0), nanos: 0n } } },
          { type: 15, status: 3, step: { case: 'plannerResponse', value: { response: 'SECRET_REPLY' } }, metadata: { createdAt: { seconds: BigInt(sec0 + 5), nanos: 0n }, completedAt: { seconds: BigInt(sec0 + 8), nanos: 0n } } },
          {
            type: 50,
            status: 3n,
            step: {
              case: 'checkpoint',
              value: {
                checkpointIndex: 0n,
                intentOnly: false,
                includedStepIndexStart: 0n,
                includedStepIndexEnd: 1n,
                renderLatestCheckpoint: true,
                userIntent: 'TOP_SECRET_USER_INTENT_SHOULD_NOT_CROSS_CDP',
                sessionSummary: 'TOP_SECRET_SESSION_SUMMARY_SHOULD_NOT_CROSS_CDP '.repeat(40),
              },
            },
            metadata: { createdAt: { seconds: BigInt(secCompact - 2), nanos: 0n }, completedAt: { seconds: BigInt(secCompact), nanos: 0n } },
          },
        ],
        generatorMetadata: [
          {
            stepIndices: [1n],
            chatModel: {
              model: 1427,
              modelDisplayName: 'Gemini 4 Carbon (High)',
              timeToFirstToken: { seconds: 1n, nanos: 0n },
              streamingDuration: { seconds: 3n, nanos: 0n },
              usage: { inputTokens: '4000', outputTokens: '600', cacheReadTokens: '36000', cacheWriteTokens: '0', apiProvider: 24, responseId: 'r-pre' },
              chatStartMetadata: {
                createdAt: { seconds: BigInt(sec0 + 1), nanos: 0n },
                startStepIndex: 0n,
                checkpointIndex: 0n,
                contextWindowMetadata: { estimatedTokensUsed: 465000n, maxContextTokens: 512000n },
              },
            },
          },
        ],
      },
    }),
  };

  // Mock Antigravity v2.34 TrajectoriesContextProvider (Wgb instance) in React Fiber
  const agentMgr = {
    getAgentStates: () => new Map(),
    peek: (id) =>
      id.toLowerCase() === CID
        ? {
            getState: () => ({
              status: 1,
              trajectorySlice: { totalStepsLength: 3 },
              compactedAtStepIndices: [2],
              contextWindowUsage: {
                generatorMetadataIndex: 0,
                lastStepIndex: 2,
                estimatedTokensUsed: 24500n,
                maxContextTokens: 512000n,
                estimatedAfterCompaction: true,
                tokenGroups: [{ name: 'SECRET_RULE_NAME_MUST_NOT_LEAK', numTokens: 5000 }],
              },
            }),
          }
        : undefined,
  };

  const convViewEl = {
    '__reactFiber$conv': {
      memoizedProps: {},
      dependencies: { firstContext: { memoizedValue: agentMgr, next: null } },
      return: null,
    },
  };
  const rootEl = {
    '__reactContainer$1': {
      memoizedProps: { value: lsMock },
      child: null,
      sibling: null,
    },
  };

  const sandbox = vm.createContext({
    document: {
      getElementById: (id) => (id === 'root' ? rootEl : null),
      querySelectorAll: () => [convViewEl],
      body: rootEl,
    },
    WeakRef: globalThis.WeakRef,
    Promise,
  });
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;

  const expr = buildRendererRpcExpression('GetCascadeTrajectory', { cascadeId: CID });
  const rpcRes = await vm.runInContext(expr, sandbox);
  assert.equal(rpcRes.ok, true);
  const serialized = JSON.stringify(rpcRes);
  assert.equal(serialized.includes('TOP_SECRET_USER_INTENT'), false, 'Checkpoint userIntent text must never cross CDP');
  assert.equal(serialized.includes('TOP_SECRET_SESSION_SUMMARY'), false, 'Checkpoint sessionSummary text must never cross CDP');
  assert.equal(serialized.includes('SECRET_RULE_NAME'), false, 'contextWindowUsage tokenGroups must never cross CDP');
  assert.equal(rpcRes.data.contextWindowUsage.estimatedTokensUsed, 24500);
  assert.equal(rpcRes.data.contextWindowUsage.estimatedAfterCompaction, true);
  assert.deepEqual(Array.from(rpcRes.data.compactedAtStepIndices), [2]);
  assert.ok(rpcRes.data.trajectory.steps[2].checkpoint.summaryTokens > 200, 'Renderer must convert summary text to numeric summaryTokens only');

  const norm = normalizeRendererTrajectory(rpcRes.data, CID);
  assert.equal(norm.trajectory.steps[2].status, 'CORTEX_STEP_STATUS_DONE');
  assert.equal(norm.contextWindowUsage.estimatedTokensUsed, 24500);
  assert.equal(norm.contextWindowUsage.estimatedAfterCompaction, true);

  const tm = trajectoryMetrics(norm);
  assert.equal(tm.context.usedTokens, 24500, 'Host contextWindowUsage must immediately override stale 465k pre-compact reading');
  assert.equal(tm.context.maxTokens, 512000);
  assert.ok(Math.abs(tm.context.usedFraction - 24500 / 512000) < 1e-6);
  assert.equal(tm.context.compacted, true);
  assert.equal(tm.context.estimatedAfterCompaction, true);
  assert.equal(tm.context.source, 'Antigravity context window usage');
  assert.equal(tm.context.sampledAt, new Date(secCompact * 1000).toISOString());

  // Also verify PeekContextState zero-LS-RPC memory probe
  assert.throws(() => buildRendererRpcExpression('PeekContextState', { cascadeId: '../bad' }), /Invalid cascadeId/);
  const peekExpr = buildRendererRpcExpression('PeekContextState', { cascadeId: CID });
  const peekRes = await vm.runInContext(peekExpr, sandbox);
  assert.equal(peekRes.ok, true);
  assert.equal(peekRes.data.stepCount, 3);
  assert.equal(peekRes.data.contextWindowUsage.estimatedTokensUsed, 24500);
  assert.equal(peekRes.data.contextWindowUsage.estimatedAfterCompaction, true);
  assert.deepEqual(Array.from(peekRes.data.compactedAtStepIndices), [2]);
});

test('Issue #36 Branch B & C: checkpoint step (incl. proto3 index 0, summaryTokens, checkpoint.contextWindowMetadata) & compactedAtStepIndices refresh without host contextWindowUsage', () => {
  const t0 = '2026-11-22T10:00:00.000Z';
  const t1 = '2026-11-22T10:00:10.000Z';
  const tCp = '2026-11-22T10:01:00.000Z';

  // B1) Completed non-intentOnly checkpoint with proto3 checkpointIndex: 0 & summaryTokens
  const cpSummary = trajectoryMetrics({
    status: 'CASCADE_RUN_STATUS_IDLE',
    numTotalSteps: 3,
    numTotalGeneratorMetadata: 1,
    trajectory: {
      cascadeId: CID,
      steps: [
        { type: 'CORTEX_STEP_TYPE_USER_INPUT', metadata: { createdAt: t0 } },
        { type: 'CORTEX_STEP_TYPE_PLANNER_RESPONSE', metadata: { createdAt: t1, completedAt: t1 }, plannerResponse: { response: 'x', toolCalls: [] } },
        {
          type: 'CORTEX_STEP_TYPE_CHECKPOINT',
          status: 'CORTEX_STEP_STATUS_DONE',
          metadata: { createdAt: tCp, completedAt: tCp },
          checkpoint: { checkpointIndex: 0, intentOnly: false, includedStepIndexStart: 0, includedStepIndexEnd: 1, summaryTokens: 3200 },
        },
      ],
      generatorMetadata: [makeBaseChatGen(1, t0, 470000, 512000, { checkpointIndex: 0 })],
    },
  });
  assert.ok(cpSummary.context.usedTokens < 40000, `Expected low post-compact tokens, got ${cpSummary.context.usedTokens}`);
  assert.ok(cpSummary.context.usedFraction < 0.1, `Expected <10% after compact, got ${cpSummary.context.usedFraction}`);
  assert.equal(cpSummary.context.compacted, true);
  assert.equal(cpSummary.context.estimatedAfterCompaction, true);
  assert.equal(cpSummary.context.sampledAt, tCp);
  assert.equal(cpSummary.context.source, 'Antigravity post-compaction estimate');

  // B2) Checkpoint carrying explicit checkpoint.contextWindowMetadata passes through directly
  const cpDirect = trajectoryMetrics({
    status: 'CASCADE_RUN_STATUS_IDLE',
    numTotalSteps: 3,
    numTotalGeneratorMetadata: 1,
    trajectory: {
      cascadeId: CID,
      steps: [
        { type: 'CORTEX_STEP_TYPE_USER_INPUT', metadata: { createdAt: t0 } },
        { type: 'CORTEX_STEP_TYPE_PLANNER_RESPONSE', metadata: { createdAt: t1, completedAt: t1 }, plannerResponse: { response: 'x', toolCalls: [] } },
        {
          type: 'CORTEX_STEP_TYPE_CHECKPOINT',
          status: 'CORTEX_STEP_STATUS_DONE',
          metadata: { createdAt: tCp, completedAt: tCp },
          checkpoint: {
            checkpointIndex: 1,
            intentOnly: false,
            contextWindowMetadata: { estimatedTokensUsed: 19200, maxContextTokens: 512000 },
          },
        },
      ],
      generatorMetadata: [makeBaseChatGen(1, t0, 470000, 512000)],
    },
  });
  assert.equal(cpDirect.context.usedTokens, 19200);
  assert.equal(cpDirect.context.compacted, true);
  assert.equal(cpDirect.context.source, 'Antigravity context window usage');

  // B3) Bare checkpoint step (no summaryTokens) still drops from 92% red alert to low post-compact estimate
  const cpBare = trajectoryMetrics({
    status: 'CASCADE_RUN_STATUS_IDLE',
    numTotalSteps: 3,
    numTotalGeneratorMetadata: 1,
    trajectory: {
      cascadeId: CID,
      steps: [
        { type: 'CORTEX_STEP_TYPE_USER_INPUT', metadata: { createdAt: t0 } },
        { type: 'CORTEX_STEP_TYPE_PLANNER_RESPONSE', metadata: { createdAt: t1, completedAt: t1 }, plannerResponse: { response: 'x', toolCalls: [] } },
        { type: 'CORTEX_STEP_TYPE_CHECKPOINT', metadata: { completedAt: tCp } },
      ],
      generatorMetadata: [makeBaseChatGen(1, t0, 471040, 512000)],
    },
  });
  assert.ok(cpBare.context.usedTokens > 0 && cpBare.context.usedFraction <= 0.1, `Bare checkpoint must drop to safe low occupancy, got ${cpBare.context.usedFraction}`);
  assert.equal(cpBare.context.compacted, true);

  // C1) compactedAtStepIndices newer than lastChat triggers post-compaction drop
  const idxAfter = trajectoryMetrics({
    status: 'CASCADE_RUN_STATUS_IDLE',
    numTotalSteps: 3,
    numTotalGeneratorMetadata: 1,
    compactedAtStepIndices: [2],
    trajectory: {
      cascadeId: CID,
      steps: [
        { type: 'CORTEX_STEP_TYPE_USER_INPUT', metadata: { createdAt: t0 } },
        { type: 'CORTEX_STEP_TYPE_PLANNER_RESPONSE', metadata: { createdAt: t1, completedAt: t1 }, plannerResponse: { response: 'x', toolCalls: [] } },
        { type: 'CORTEX_STEP_TYPE_EPHEMERAL_MESSAGE', metadata: { completedAt: tCp } },
      ],
      generatorMetadata: [makeBaseChatGen(1, t0, 465000, 512000)],
    },
  });
  assert.ok(idxAfter.context.usedFraction < 0.1);
  assert.equal(idxAfter.context.compacted, true);

  // C2) compactedAtStepIndices <= lastChat stepIndex (historical in-turn compaction already reflected by lastChat) must NOT override lastChat
  const idxEarlier = trajectoryMetrics({
    status: 'CASCADE_RUN_STATUS_IDLE',
    numTotalSteps: 2,
    numTotalGeneratorMetadata: 1,
    compactedAtStepIndices: [1],
    trajectory: {
      cascadeId: CID,
      steps: [
        { type: 'CORTEX_STEP_TYPE_USER_INPUT', metadata: { createdAt: t0 } },
        { type: 'CORTEX_STEP_TYPE_PLANNER_RESPONSE', metadata: { createdAt: t1, completedAt: t1 }, plannerResponse: { response: 'x', toolCalls: [] } },
      ],
      generatorMetadata: [makeBaseChatGen(1, t0, 68000, 512000)],
    },
  });
  assert.equal(idxEarlier.context.usedTokens, 68000, 'Historical compaction <= lastChat stepIndex must preserve exact lastChat reading');
  assert.equal(idxEarlier.context.compacted, undefined);
});

test('Issue #36 Branch D: next user message after /compact seamlessly switches back to host exact chatStartMetadata reading', () => {
  const t0 = '2026-11-22T10:00:00.000Z';
  const t1 = '2026-11-22T10:00:10.000Z';
  const tCp = '2026-11-22T10:01:00.000Z';
  const tNextIn = '2026-11-22T10:02:00.000Z';
  const tNextOut = '2026-11-22T10:02:06.000Z';

  // Even if stale contextWindowUsage from the compaction point has not yet been replaced by host
  const afterNextMsg = trajectoryMetrics({
    status: 'CASCADE_RUN_STATUS_IDLE',
    numTotalSteps: 5,
    numTotalGeneratorMetadata: 2,
    compactedAtStepIndices: [2],
    contextWindowUsage: {
      generatorMetadataIndex: 0,
      lastStepIndex: 2,
      estimatedTokensUsed: 18000,
      maxContextTokens: 512000,
      estimatedAfterCompaction: true,
    },
    trajectory: {
      cascadeId: CID,
      steps: [
        { type: 'CORTEX_STEP_TYPE_USER_INPUT', metadata: { createdAt: t0 } },
        { type: 'CORTEX_STEP_TYPE_PLANNER_RESPONSE', metadata: { createdAt: t1, completedAt: t1 }, plannerResponse: { response: 'x', toolCalls: [] } },
        {
          type: 'CORTEX_STEP_TYPE_CHECKPOINT',
          status: 'CORTEX_STEP_STATUS_DONE',
          metadata: { createdAt: tCp, completedAt: tCp },
          checkpoint: { checkpointIndex: 1, intentOnly: false, summaryTokens: 3200 },
        },
        { type: 'CORTEX_STEP_TYPE_USER_INPUT', metadata: { createdAt: tNextIn } },
        { type: 'CORTEX_STEP_TYPE_PLANNER_RESPONSE', metadata: { createdAt: tNextOut, completedAt: tNextOut }, plannerResponse: { response: 'x', toolCalls: [] } },
      ],
      generatorMetadata: [
        makeBaseChatGen(1, t0, 465000, 512000, {}, 'resp-1'),
        makeBaseChatGen(4, tNextIn, 34560, 512000, { checkpointIndex: 1, stepsCoveredByCheckpoint: 2 }, 'resp-2'),
      ],
    },
  });

  assert.equal(afterNextMsg.context.usedTokens, 34560, 'New chatStartMetadata after /compact must replace post-compaction estimate immediately');
  assert.equal(afterNextMsg.context.maxTokens, 512000);
  assert.equal(afterNextMsg.context.sampledAt, tNextIn);
  assert.equal(afterNextMsg.context.compacted, undefined);
  assert.equal(afterNextMsg.context.source, 'Antigravity context window metadata');
});

test('Issue #36 HTTP TrajectoryJson projection preserves checkpoint & estimates summary tokens with zero text leakage', () => {
  const rawPayload = JSON.stringify({
    steps: [
      {
        type: 'CORTEX_STEP_TYPE_CHECKPOINT',
        status: 'CORTEX_STEP_STATUS_DONE',
        metadata: { completedAt: '2026-11-22T10:01:00.000Z' },
        checkpoint: {
          checkpointIndex: 1,
          intentOnly: false,
          includedStepIndexStart: 0,
          includedStepIndexEnd: 12,
          sessionSummary: 'PRIVATE_COMPACTION_SUMMARY_TEXT_NEVER_RETAINED '.repeat(30),
          userIntent: 'PRIVATE_INTENT_TEXT',
        },
      },
    ],
  });
  const parser = new TrajectoryJson();
  parser.write(rawPayload);
  const projected = parser.end();
  const outJson = JSON.stringify(projected);
  assert.equal(outJson.includes('PRIVATE_COMPACTION_SUMMARY'), false, 'TrajectoryJson must strip summary text completely');
  assert.equal(outJson.includes('PRIVATE_INTENT_TEXT'), false, 'TrajectoryJson must strip userIntent text completely');
  assert.equal(projected.steps[0].status, 'CORTEX_STEP_STATUS_DONE');
  assert.equal(projected.steps[0].checkpoint.intentOnly, false);
  assert.equal(typeof projected.steps[0].checkpoint.sessionSummary, 'number');
  assert.ok(projected.steps[0].checkpoint.sessionSummary > 200);
});

test('Issue #36 Branch E: incremental SQLite DiskStatistics matches full trajectoryMetrics 100% & SessionHistory/safeContext persists compacted state', async () => {
  const t0 = '2026-11-22T10:00:00.000Z';
  const t1 = '2026-11-22T10:00:10.000Z';
  const tCp = '2026-11-22T10:01:00.000Z';
  const tNext = '2026-11-22T10:02:00.000Z';

  const scenarios = [
    {
      name: 'pre-compact',
      steps: [
        { type: 'CORTEX_STEP_TYPE_USER_INPUT', metadata: { createdAt: t0 } },
        { type: 'CORTEX_STEP_TYPE_PLANNER_RESPONSE', metadata: { createdAt: t1, completedAt: t1 }, plannerResponse: { response: 'x', toolCalls: [] } },
      ],
      generators: [makeBaseChatGen(1, t0, 460800, 512000, {}, 'r-1')],
    },
    {
      name: 'post-compact-checkpoint-only',
      steps: [
        { type: 'CORTEX_STEP_TYPE_USER_INPUT', metadata: { createdAt: t0 } },
        { type: 'CORTEX_STEP_TYPE_PLANNER_RESPONSE', metadata: { createdAt: t1, completedAt: t1 }, plannerResponse: { response: 'x', toolCalls: [] } },
        {
          type: 'CORTEX_STEP_TYPE_CHECKPOINT',
          status: 'CORTEX_STEP_STATUS_DONE',
          metadata: { createdAt: tCp, completedAt: tCp },
          checkpoint: { checkpointIndex: 1, intentOnly: false, summaryTokens: 2800 },
        },
      ],
      generators: [makeBaseChatGen(1, t0, 460800, 512000, {}, 'r-1')],
    },
    {
      name: 'post-compact-with-contextWindowUsage',
      steps: [
        { type: 'CORTEX_STEP_TYPE_USER_INPUT', metadata: { createdAt: t0 } },
        { type: 'CORTEX_STEP_TYPE_PLANNER_RESPONSE', metadata: { createdAt: t1, completedAt: t1 }, plannerResponse: { response: 'x', toolCalls: [] } },
        {
          type: 'CORTEX_STEP_TYPE_CHECKPOINT',
          status: 'CORTEX_STEP_STATUS_DONE',
          metadata: { createdAt: tCp, completedAt: tCp },
          checkpoint: { checkpointIndex: 1, intentOnly: false, summaryTokens: 2800 },
        },
      ],
      generators: [makeBaseChatGen(1, t0, 460800, 512000, {}, 'r-1')],
      contextWindowUsage: { generatorMetadataIndex: 0, lastStepIndex: 2, estimatedTokensUsed: 22400, maxContextTokens: 512000, estimatedAfterCompaction: true },
      compactedAtStepIndices: [2],
    },
    {
      name: 'post-compact-next-turn',
      steps: [
        { type: 'CORTEX_STEP_TYPE_USER_INPUT', metadata: { createdAt: t0 } },
        { type: 'CORTEX_STEP_TYPE_PLANNER_RESPONSE', metadata: { createdAt: t1, completedAt: t1 }, plannerResponse: { response: 'x', toolCalls: [] } },
        {
          type: 'CORTEX_STEP_TYPE_CHECKPOINT',
          status: 'CORTEX_STEP_STATUS_DONE',
          metadata: { createdAt: tCp, completedAt: tCp },
          checkpoint: { checkpointIndex: 1, intentOnly: false, summaryTokens: 2800 },
        },
        { type: 'CORTEX_STEP_TYPE_USER_INPUT', metadata: { createdAt: tNext } },
        { type: 'CORTEX_STEP_TYPE_PLANNER_RESPONSE', metadata: { createdAt: tNext, completedAt: tNext }, plannerResponse: { response: 'x', toolCalls: [] } },
      ],
      generators: [
        makeBaseChatGen(1, t0, 460800, 512000, {}, 'r-1'),
        makeBaseChatGen(4, tNext, 31500, 512000, { checkpointIndex: 1 }, 'r-2'),
      ],
    },
  ];

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'prism-compact-disk-'));
  try {
    for (const sc of scenarios) {
      const fullRes = trajectoryMetrics({
        status: 'CASCADE_RUN_STATUS_IDLE',
        numTotalSteps: sc.steps.length,
        numTotalGeneratorMetadata: sc.generators.length,
        ...(sc.contextWindowUsage ? { contextWindowUsage: sc.contextWindowUsage } : {}),
        ...(sc.compactedAtStepIndices ? { compactedAtStepIndices: sc.compactedAtStepIndices } : {}),
        trajectory: { cascadeId: CID, steps: sc.steps, generatorMetadata: sc.generators },
      });

      const dbFile = path.join(tmpDir, `${sc.name}.sqlite`);
      const disk = new DiskStatistics({ file: dbFile, conversationId: CID });
      try {
        sc.steps.forEach((s, i) => disk.addStep(i, s));
        sc.generators.forEach((g, i) => disk.addGenerator(i, g));
        const diskOut = disk.finish({
          status: 'CASCADE_RUN_STATUS_IDLE',
          numTotalSteps: sc.steps.length,
          numTotalGeneratorMetadata: sc.generators.length,
          contextWindowUsage: sc.contextWindowUsage || null,
          compactedAtStepIndices: sc.compactedAtStepIndices || null,
        });
        assert.deepEqual(diskOut.metrics.context, fullRes.context, `DiskStatistics context mismatch in scenario: ${sc.name}`);
        assert.deepEqual(safeContext(fullRes.context), fullRes.context, `safeContext round-trip mismatch in scenario: ${sc.name}`);
      } finally {
        disk.close();
      }
    }

    // Verify SessionHistory persistence retains post-compaction context across save/load
    const hist = new SessionHistory(path.join(tmpDir, 'history'));
    const scope = 'a'.repeat(64);
    const compactedMetrics = trajectoryMetrics({
      status: 'CASCADE_RUN_STATUS_IDLE',
      numTotalSteps: 3,
      numTotalGeneratorMetadata: 1,
      contextWindowUsage: { generatorMetadataIndex: 0, lastStepIndex: 2, estimatedTokensUsed: 22400, maxContextTokens: 512000, estimatedAfterCompaction: true },
      trajectory: {
        cascadeId: CID,
        steps: scenarios[1].steps,
        generatorMetadata: scenarios[1].generators,
      },
    });
    await hist.save(scope, CID, compactedMetrics);
    const loaded = await hist.load(scope, CID);
    assert.ok(loaded);
    assert.equal(loaded.metrics.context.usedTokens, 22400);
    assert.equal(loaded.metrics.context.compacted, true);
    assert.equal(loaded.metrics.context.estimatedAfterCompaction, true);
    assert.equal(loaded.metrics.context.source, 'Antigravity context window usage');
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('Issue #36 E2E: PeekContextState invalidates settled proxy cache after /compact & refreshes MetricsStore + pulse-vial-bridge UI automatically', async () => {
  let nowMs = 5_000_000;
  let compacted = false;
  let trajCalls = 0;
  let peekCalls = 0;

  const t0 = '2026-11-22T10:00:00.000Z';
  const t1 = '2026-11-22T10:00:10.000Z';
  const tCp = '2026-11-22T10:00:25.000Z';

  const rendererRpc = async (method, body) => {
    if (method === 'Probe') return { available: true };
    if (method === 'GetUserStatus') {
      return { userStatus: { email: 'compact@test.dev', cascadeModelConfigData: { clientModelConfigs: [] } } };
    }
    if (method === 'RetrieveUserQuotaSummary') {
      return { response: { groups: [] } };
    }
    if (method === 'PeekContextState') {
      peekCalls += 1;
      assert.equal(body.cascadeId, CID);
      return compacted
        ? {
            stepCount: 3,
            lastModifiedTime: tCp,
            status: 1,
            compactedAtStepIndices: [2],
            contextWindowUsage: {
              generatorMetadataIndex: 0,
              lastStepIndex: 2,
              estimatedTokensUsed: 24500,
              maxContextTokens: 512000,
              estimatedAfterCompaction: true,
            },
          }
        : {
            stepCount: 2,
            lastModifiedTime: t1,
            status: 1,
          };
    }
    if (method === 'GetCascadeTrajectory') {
      trajCalls += 1;
      const steps = [
        { type: 'CORTEX_STEP_TYPE_USER_INPUT', metadata: { createdAt: t0 } },
        { type: 'CORTEX_STEP_TYPE_PLANNER_RESPONSE', metadata: { createdAt: t1, completedAt: t1 }, plannerResponse: { response: 'x', toolCalls: [] } },
      ];
      if (compacted) {
        steps.push({
          type: 'CORTEX_STEP_TYPE_CHECKPOINT',
          status: 'CORTEX_STEP_STATUS_DONE',
          metadata: { createdAt: tCp, completedAt: tCp },
          checkpoint: { checkpointIndex: 1, intentOnly: false, summaryTokens: 2500 },
        });
      }
      return {
        status: 'CASCADE_RUN_STATUS_IDLE',
        numTotalSteps: steps.length,
        numTotalGeneratorMetadata: 1,
        ...(compacted
          ? {
              compactedAtStepIndices: [2],
              contextWindowUsage: {
                generatorMetadataIndex: 0,
                lastStepIndex: 2,
                estimatedTokensUsed: 24500,
                maxContextTokens: 512000,
                estimatedAfterCompaction: true,
              },
            }
          : {}),
        trajectory: {
          cascadeId: CID,
          steps,
          generatorMetadata: [makeBaseChatGen(1, t0, 460800, 512000, {}, 'r-e2e')],
        },
      };
    }
    throw new Error(`Unexpected RPC: ${method}`);
  };

  const client = new AntigravityClient({
    now: () => nowMs,
    paths: () => ({ log: '/nonexistent/ls.log', logCandidates: ['/nonexistent/ls.log'] }),
    readLog: async () => 'Language server listening on http://127.0.0.1:11244\n',
    processes: async () => [{ ProcessId: 4242, CommandLine: 'language_server --standalone', Ports: [11244] }],
    rendererRpc,
  });

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'prism-compact-e2e-'));
  const store = new MetricsStore(client, { dataDir: tmpDir });

  // Minimal DOM mock for pulse-vial-bridge.js
  function mkEl(tag, attrs = {}) {
    const attrMap = new Map();
    const styleProps = new Map();
    const listeners = new Map();
    const el = {
      tagName: String(tag).toUpperCase(),
      children: [],
      parentNode: null,
      parentElement: null,
      shadowRoot: null,
      isConnected: true,
      hidden: false,
      textContent: '',
      get id() { return attrMap.get('id') || ''; },
      set id(v) { attrMap.set('id', String(v)); },
      get className() { return attrMap.get('class') || ''; },
      set className(v) { attrMap.set('class', String(v)); },
      get firstChild() { return el.children[0] || null; },
      get nextSibling() {
        if (!el.parentNode) return null;
        const idx = el.parentNode.children.indexOf(el);
        return idx >= 0 && idx + 1 < el.parentNode.children.length ? el.parentNode.children[idx + 1] : null;
      },
      style: new Proxy(
        {
          setProperty(k, v) { styleProps.set(k, String(v)); },
          getPropertyValue(k) { return styleProps.get(k) || ''; },
          removeProperty(k) { styleProps.delete(k); },
        },
        {
          get(t, p) { return p in t ? t[p] : styleProps.get(String(p)) || ''; },
          set(t, p, v) { if (v == null || v === '') styleProps.delete(String(p)); else styleProps.set(String(p), String(v)); return true; },
        }
      ),
      setAttribute(k, v) { if (k === 'hidden') el.hidden = true; attrMap.set(k, String(v)); },
      getAttribute(k) { return attrMap.has(k) ? attrMap.get(k) : null; },
      hasAttribute(k) { return attrMap.has(k); },
      removeAttribute(k) { if (k === 'hidden') el.hidden = false; attrMap.delete(k); },
      appendChild(c) { if (c.parentNode) c.remove(); c.parentNode = el; c.parentElement = el.tagName === '#SHADOW-ROOT' ? null : el; el.children.push(c); return c; },
      insertBefore(c, ref) {
        if (!ref) return el.appendChild(c);
        const i = el.children.indexOf(ref);
        if (i < 0) return el.appendChild(c);
        if (c.parentNode) c.remove();
        c.parentNode = el;
        c.parentElement = el.tagName === '#SHADOW-ROOT' ? null : el;
        el.children.splice(i, 0, c);
        return c;
      },
      removeChild(c) { const i = el.children.indexOf(c); if (i >= 0) { el.children.splice(i, 1); c.parentNode = c.parentElement = null; } return c; },
      remove() { if (el.parentNode) el.parentNode.removeChild(el); },
      attachShadow({ mode }) { const sr = mkEl('#shadow-root'); sr.mode = mode; sr.host = el; el.shadowRoot = sr; return sr; },
      matches(sel) {
        return String(sel).split(',').some((tok) => {
          const s = tok.trim();
          if (!s) return false;
          if (s.startsWith('#')) return el.id === s.slice(1);
          if (s.startsWith('.')) return (el.className || '').split(/\s+/).includes(s.slice(1));
          const am = s.match(/^\[([a-z0-9_-]+)(?:=["']?([^"'\]]+)["']?)?\]$/i);
          if (am) return el.hasAttribute(am[1]) && (am[2] === undefined || el.getAttribute(am[1]) === am[2]);
          return false;
        });
      },
      closest(sel) { let p = el; while (p) { if (p.matches?.(sel)) return p; p = p.parentElement; } return null; },
      getElementById(id) {
        let hit = null;
        const walk = (n) => { for (const c of n.children) { if (!hit && c.id === id) hit = c; walk(c); } };
        walk(el);
        return hit;
      },
      querySelector(sel) { return el.querySelectorAll(sel)[0] || null; },
      querySelectorAll(sel) {
        const res = [];
        const walk = (n) => { for (const c of n.children) { if (c.matches(sel)) res.push(c); walk(c); } };
        walk(el);
        return res;
      },
      addEventListener(t, fn) { if (!listeners.has(t)) listeners.set(t, new Set()); listeners.get(t).add(fn); },
      removeEventListener(t, fn) { listeners.get(t)?.delete(fn); },
      getContext(kind) {
        if (kind !== '2d') return null;
        return { save() {}, restore() {}, setTransform() {}, clearRect() {}, beginPath() {}, moveTo() {}, lineTo() {}, arcTo() {}, closePath() {}, fill() {}, stroke() {}, translate() {}, rotate() {}, ellipse() {}, fillRect() {}, fillText() {}, drawImage() {}, createLinearGradient: () => ({ addColorStop() {} }) };
      },
      getBoundingClientRect: () => ({ left: 0, top: 0, width: 96, height: 220 }),
    };
    for (const [k, v] of Object.entries(attrs)) {
      if (k === 'text') el.textContent = String(v);
      else el.setAttribute(k, v);
    }
    return el;
  }

  let bridge = null;
  try {
    // 1) Pre-compact snapshot at 90% critical occupancy
    const snapBefore = await store.snapshot({ conversationId: CID, force: true });
    assert.equal(trajCalls, 1);
    assert.equal(snapBefore.speed.context.usedTokens, 460800);
    assert.equal(snapBefore.speed.context.usedFraction, 0.9);

    // 2) 5s later (still IDLE, no compact yet) -> PeekContextState confirms unchanged, 0 extra GetCascadeTrajectory RPC
    nowMs += 5000;
    const trajUnchanged = await client.trajectory(CID);
    assert.equal(peekCalls, 1);
    assert.equal(trajCalls, 1, 'Unchanged IDLE session must reuse trajectory cache via lightweight PeekContextState');
    assert.equal(trajUnchanged.numTotalSteps, 2);

    // 3) User runs /compact -> finishes at +4s (total 9s < 20s settled TTL!) -> PeekContextState detects change immediately
    compacted = true;
    nowMs += 4000;
    // Expire MetricsStore 4.5s entry cooldown to simulate next normal non-forced poll
    const entry = store.sessions.get(CID);
    if (entry) entry.updatedAt = 0;

    const snapAfter = await store.snapshot({ conversationId: CID, force: false });
    assert.equal(peekCalls, 2);
    assert.equal(trajCalls, 2, '/compact completion must bust 20s settled proxy cache immediately via PeekContextState');
    assert.equal(snapAfter.speed.context.usedTokens, 24500);
    assert.equal(snapAfter.speed.context.compacted, true);
    assert.ok(snapAfter.speed.context.usedFraction < 0.06);

    // 4) Feed pre-compact then post-compact snapshots into pulse-vial-bridge.js and verify live UI refresh
    const docRoot = mkEl('html');
    const body = mkEl('body', { class: 'theme-dark' });
    docRoot.appendChild(body);
    const wrap = mkEl('div', { 'data-cascade-id': CID });
    body.appendChild(wrap);
    const barHost = mkEl('div', { id: 'ag-pulse-status-bar' });
    const sr = barHost.attachShadow({ mode: 'open' });
    const bar = mkEl('div', { class: 'bar' });
    const ctxChip = mkEl('button', { class: 'chip', 'data-card': 'context' });
    ctxChip.appendChild(mkEl('span', { class: 'context-ring', id: 'context-ring' }));
    ctxChip.appendChild(mkEl('strong', { id: 'context-percent', text: '90%' }));
    bar.appendChild(ctxChip);
    sr.appendChild(bar);
    const ctxCard = mkEl('section', { class: 'card', id: 'context-card' });
    ctxCard.hidden = false;
    ctxCard.appendChild(mkEl('div', { class: 'heading' }));
    ctxCard.appendChild(mkEl('strong', { id: 'context-summary', text: '90% used · 10% left' }));
    ctxCard.appendChild(mkEl('p', { id: 'context-tokens', text: '461K / 512K tok' }));
    const track = mkEl('div', { class: 'track', id: 'context-track' });
    const fill = mkEl('i', { id: 'context-fill' });
    fill.style.width = '90%';
    track.appendChild(fill);
    ctxCard.appendChild(track);
    ctxCard.appendChild(mkEl('dd', { id: 'context-model', text: 'Gemini 4 Carbon (High)' }));
    sr.appendChild(ctxCard);
    wrap.appendChild(barHost);

    let currentSnap = snapBefore;
    const mockDoc = {
      hidden: false,
      documentElement: docRoot,
      body,
      createElement: (tag) => mkEl(tag),
      getElementById: (id) => docRoot.getElementById(id),
      querySelector: (s) => docRoot.querySelector(s),
      querySelectorAll: (s) => docRoot.querySelectorAll(s),
      addEventListener() {},
      removeEventListener() {},
    };
    const mockWin = {
      document: mockDoc,
      innerWidth: 1280,
      location: { pathname: `/c/${CID}` },
      __agVialCore: vialCore,
      agPulseHost: { __prismFallback: true, getMetrics: async () => currentSnap },
      requestAnimationFrame: () => 1,
      cancelAnimationFrame() {},
      addEventListener() {},
      removeEventListener() {},
    };

    bridge = pulseVialBridge.mountPulseVialBridge({
      win: mockWin,
      doc: mockDoc,
      vialCore,
      autoPoll: false,
      allowMultiple: true,
    });
    const d1 = await bridge.sync();
    assert.equal(d1.critical, true);
    assert.equal(d1.usedTokens, 460800);
    assert.equal(barHost.getAttribute('data-pv-crit'), '1');
    assert.equal(barHost.getAttribute('data-pv-warn'), '1');
    const compactBtn = sr.querySelector('.pv-cmp');
    assert.equal(compactBtn.hidden, false, '/compact shortcut must show at 90%');

    // Switch snapshot to post-compact and sync (no user message sent!)
    currentSnap = snapAfter;
    const d2 = await bridge.sync();
    assert.equal(d2.critical, false, 'Critical red alert must clear automatically after /compact');
    assert.equal(d2.usedTokens, 24500, 'Vial bridge usedTokens must update automatically after /compact');
    assert.ok(d2.usedFraction < 0.06, 'Vial fill fraction must drop immediately after /compact');
    assert.equal(barHost.getAttribute('data-pv-crit'), '0');
    assert.equal(barHost.getAttribute('data-pv-warn'), null, 'Warning attribute must clear after /compact');
    assert.equal(barHost.style.getPropertyValue('--pv-pct'), '4.8%');
    assert.equal(compactBtn.hidden, true, '/compact shortcut button must auto-hide after compaction drops below 80%');
    assert.equal(sr.querySelector('[data-ag-pulse-vial-pct]').textContent, '5%');
    assert.equal(sr.querySelector('[data-ag-pulse-capacity]').textContent, '24.5k / 512k');
  } finally {
    bridge?.destroy?.();
    store.dispose();
    client.dispose();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('Red-team R2 regression: proto3 zero-value startStepIndex=0 / checkpointIndex=0 must NOT treat historical checkpoint as post-chat compaction', () => {
  const response = {
    trajectory: {
      cascadeId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
      steps: [
        { type: 'CORTEX_STEP_TYPE_USER_INPUT', status: 'CORTEX_STEP_STATUS_DONE', metadata: { createdAt: '2026-11-22T09:00:00Z' } },
        {
          type: 'CORTEX_STEP_TYPE_CHECKPOINT',
          status: 'CORTEX_STEP_STATUS_DONE',
          metadata: { createdAt: '2026-11-22T09:30:00Z', completedAt: '2026-11-22T09:30:05Z' },
          checkpoint: {
            checkpointIndex: 1,
            intentOnly: false,
            userIntent: 'Older compaction summary',
            summary: 'Compacted earlier history.',
          },
        },
        { type: 'CORTEX_STEP_TYPE_USER_INPUT', status: 'CORTEX_STEP_STATUS_DONE', metadata: { createdAt: '2026-11-22T10:00:00Z' } },
        { type: 'CORTEX_STEP_TYPE_PLANNER_RESPONSE', status: 'CORTEX_STEP_STATUS_DONE', metadata: { createdAt: '2026-11-22T10:05:00Z' } },
      ],
      compactionInfo: { compactedAtStepIndices: [1] },
      generatorMetadata: [
        {
          // Simulate Antigravity protobuf-es: stepIndices omitted, and unset proto3 scalar startStepIndex/checkpointIndex serialized as 0
          chatModel: {
            model: 'MODEL_PLACEHOLDER_M26',
            modelDisplayName: 'Gemini 4 Carbon (High)',
            chatStartMetadata: {
              createdAt: '2026-11-22T10:04:00Z',
              startStepIndex: 0,
              checkpointIndex: 0,
              contextWindowMetadata: {
                estimatedTokensUsed: 420000,
                maxContextTokens: 512000,
              },
            },
            usage: { inputTokens: 420000, outputTokens: 2000 },
          },
        },
      ],
    },
  };

  const m = trajectoryMetrics(response);
  assert.equal(m.context.usedTokens, 420000, 'Historical checkpoint before lastChat must NOT clear real high occupancy');
  assert.equal(m.context.maxTokens, 512000);
  assert.notEqual(m.context.compacted, true, 'Must not mark historical checkpoint as post-chat compaction');
});
