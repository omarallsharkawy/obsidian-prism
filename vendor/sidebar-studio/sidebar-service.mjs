// Obsidian Prism v1.0.2 - Sidebar Studio v2 Backend Persistence, Single-Writer Transactions, and Host Permission Service
// - Single pure state machine source of truth: ./state-machine.mjs (SCHEMA_VERSION = 2, Code / Chat bipolar workbench)
// - Persistence path: ~/.gemini/config/obsidian-prism-sidebar.json (exclusive write lock + 0600 atomic commit + lossless v1 backup & migration)
// - Sandbox mode (sandboxMode: true): used by Workbench /studio preview; strictly isolated temp dir & fake host, never touches real config
// - Zero global Code permission writes: only project-level permission isolation via the 4 projectSettingsProvider setters is allowed
// - Zero external dependencies; all system commands use execFile arg arrays (static scripts + env vars, CodeQL clean)

import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFile as cpExecFile } from 'node:child_process';

import {
  SCHEMA_VERSION,
  MODES,
  CHAT_KINDS,
  ERROR_CODES,
  LIMITS,
  PERMISSION_PROFILES,
  DEFAULT_MODE_THEMES,
  GREETING_POOLS,
  normalizeGreetingLang,
  formatGreeting,
  isSafeIdentifier,
  isValidChatReservation,
  createDefaultChatDraft,
  createDefaultStateV2,
  validateState,
  migrateV1,
  parseView,
  resolveView,
  selectChatSidebar,
  selectBackgroundBadge,
  selectSnapshot,
  reduce,
  applyProjectPermissionIsolation,
  restoreProjectPermissionBaseline,
} from './state-machine.mjs';

export const SIDEBAR_BINDING = '__agPrismSidebarCall';
export const SERVICE_SCHEMA_VERSION = SCHEMA_VERSION;

const FORBIDDEN_KEYS = new Set(['__proto__', 'constructor', 'prototype', 'toString', 'valueOf', 'hasOwnProperty']);
const RESERVED_WIN_NAMES = new Set([
  'CON', 'PRN', 'AUX', 'NUL',
  'COM1', 'COM2', 'COM3', 'COM4', 'COM5', 'COM6', 'COM7', 'COM8', 'COM9',
  'LPT1', 'LPT2', 'LPT3', 'LPT4', 'LPT5', 'LPT6', 'LPT7', 'LPT8', 'LPT9',
]);

// Legacy v1 three-space and global permission write actions return a version error in v2 (never trigger legacy global permission switches)
const LEGACY_V1_UNSUPPORTED_ACTIONS = new Set([
  'set-active-space',
  'set-assignment',
  'bulk-assign',
  'set-space-theme',
  'classify-workspaces',
]);

const MAX_BOX_NAME_LEN = 80;
const MAX_PATH_LEN = 1024;
const MAX_RPC_PAYLOAD_BYTES = 131072;
const MAX_SPARK_IMPORT_RPC_BYTES = 12 * 1024 * 1024;
const MAX_SPARK_IMPORT_FILE_BYTES = 8 * 1024 * 1024;
const MAX_SPARK_IMPORT_BASE64_CHARS = Math.ceil(MAX_SPARK_IMPORT_FILE_BYTES / 3) * 4;
const LOCK_RECOVERY_STALE_MS = 30 * 1000;
const BLOCKED_SPARK_IMPORT_EXTS = new Set([
  '.exe', '.bat', '.cmd', '.ps1', '.psm1', '.psd1', '.vbs', '.vbe', '.vb',
  '.msi', '.msp', '.dll', '.scr', '.com', '.pif', '.hta', '.jar', '.sh', '.bash', '.zsh',
  '.pem', '.key', '.pfx', '.p12',
  '.lnk', '.url', '.reg', '.wsf', '.wsh', '.jse', '.scf', '.cpl', '.msc', '.inf',
  '.svg', '.html', '.htm', '.xhtml',
  '.js', '.mjs', '.cjs', '.py', '.rb', '.php',
]);
const SELECTION_TOKEN_TTL_MS = 5 * 60 * 1000;
const WSL_CHALLENGE_TTL_MS = 5 * 60 * 1000;
const EVICTED_RECEIPT_BUCKET_KEY = 'evicted-receipts-index';
const MAX_LIVE_RECEIPTS = LIMITS.MAX_RECEIPTS - 1;
const MAX_EVICTED_RECEIPT_KEYS = 512;
const KNOWLEDGE_SCOPE_REF = 'scope-knowledge-default';

// Static Windows folder picker PowerShell script (zero dynamic interpolation; args via env vars only; UTF-8 Base64 output prevents encoding corruption)
const WIN_PICK_FOLDER_PS = [
  'Add-Type -AssemblyName System.Windows.Forms;',
  '$dlg = New-Object System.Windows.Forms.FolderBrowserDialog;',
  'if ($env:AG_PRISM_PICK_TITLE) { $dlg.Description = $env:AG_PRISM_PICK_TITLE }',
  'if ($env:AG_PRISM_PICK_INIT_DIR -and (Test-Path -LiteralPath $env:AG_PRISM_PICK_INIT_DIR -PathType Container)) { $dlg.SelectedPath = $env:AG_PRISM_PICK_INIT_DIR }',
  '$dlg.ShowNewFolderButton = $true;',
  '$res = $dlg.ShowDialog();',
  'if ($res -eq [System.Windows.Forms.DialogResult]::OK -and $dlg.SelectedPath) {',
  '  [Console]::Out.Write([Convert]::ToBase64String([System.Text.Encoding]::UTF8.GetBytes($dlg.SelectedPath)))',
  '}',
].join(' ');
const WIN_PICK_FOLDER_ENCODED = Buffer.from(WIN_PICK_FOLDER_PS, 'utf16le').toString('base64');

// Static macOS folder picker AppleScript (reads arguments via system attribute env vars)
const MAC_PICK_FOLDER_AS = [
  'set pTitle to system attribute "AG_PRISM_PICK_TITLE"',
  'if pTitle is "" then set pTitle to "Choose Folder"',
  'POSIX path of (choose folder with prompt pTitle)',
].join('\n');

function isPlainObject(v) {
  return Boolean(v) && typeof v === 'object' && !Array.isArray(v);
}

function hasControlChars(str) {
  for (let i = 0; i < str.length; i++) {
    const code = str.charCodeAt(i);
    if (code <= 0x1f || code === 0x7f) return true;
  }
  return false;
}

function hasForbiddenKeysDeep(val, depth = 0) {
  if (!val || typeof val !== 'object') return false;
  if (depth > 16) return true;
  if (Array.isArray(val)) {
    for (const item of val) {
      if (hasForbiddenKeysDeep(item, depth + 1)) return true;
    }
    return false;
  }
  for (const key of Object.keys(val)) {
    if (FORBIDDEN_KEYS.has(key)) return true;
    if (hasForbiddenKeysDeep(val[key], depth + 1)) return true;
  }
  return false;
}

function canonicalStringify(value) {
  if (value === null || value === undefined) return 'null';
  const t = typeof value;
  if (t === 'boolean' || t === 'number' || t === 'string') return JSON.stringify(value);
  if (Array.isArray(value)) {
    return `[${value.map((item) => canonicalStringify(item)).join(',')}]`;
  }
  if (t === 'object') {
    const keys = Object.keys(value)
      .filter((k) => !FORBIDDEN_KEYS.has(k) && value[k] !== undefined)
      .sort();
    return `{${keys.map((k) => `${JSON.stringify(k)}:${canonicalStringify(value[k])}`).join(',')}}`;
  }
  return 'null';
}

function sha256Hex(text) {
  return crypto.createHash('sha256').update(String(text || ''), 'utf8').digest('hex');
}

function randomId(prefix, byteLen = 8) {
  return `${prefix}-${crypto.randomBytes(byteLen).toString('hex')}`;
}

function cloneJson(value) {
  if (value === undefined) return undefined;
  return JSON.parse(JSON.stringify(value));
}

function normalizePathForCompare(p) {
  const resolved = path.resolve(p);
  return process.platform === 'win32' ? resolved.toLowerCase() : resolved;
}

/**
 * Block remote Windows UNC / SMB / NT device paths (standalone pure function, avoiding cross-channel coupling to omni-viewer)
 */
export function isBlockedUncPath(rawInput) {
  if (!rawInput || typeof rawInput !== 'string') return false;
  let s = rawInput.trim();
  if (!s) return false;
  if (s.startsWith('@') && s.length > 1 && !s.startsWith('@/')) s = s.slice(1).trim();
  if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
    s = s.slice(1, -1).trim();
  }
  if (/^file:\/\//i.test(s)) {
    const afterScheme = s.slice(7);
    if (!afterScheme.startsWith('/')) {
      const host = afterScheme.split(/[/?#\\]/)[0].toLowerCase();
      if (
        host &&
        host !== 'localhost' &&
        host !== '127.0.0.1' &&
        host !== '[::1]' &&
        host !== 'wsl.localhost' &&
        host !== 'wsl$' &&
        !/^[a-z]:$/i.test(host)
      ) {
        return true;
      }
    }
    try {
      s = decodeURIComponent(afterScheme);
    } catch {
      s = afterScheme;
    }
  }
  if (/^[\\/]{2}/.test(s)) {
    const rest = s.replace(/^[\\/]+/, '');
    if (/^[?.][\\/]/.test(rest)) {
      const inner = rest.slice(2).replace(/^[\\/]+/, '');
      if (/^[A-Za-z]:(?:[\\/]|$)/.test(inner)) {
        return false;
      }
      const uncMatch = inner.match(/^(?:global[\\/]+)*unc[\\/]+(.+)$/i);
      if (uncMatch) {
        const uncHost = uncMatch[1].split(/[\\/]/)[0].toLowerCase();
        return uncHost !== 'localhost' && uncHost !== '127.0.0.1' && uncHost !== 'wsl.localhost' && uncHost !== 'wsl$';
      }
      return true;
    }
    const host = rest.split(/[\\/]/)[0].toLowerCase();
    if (host === 'localhost' || host === '127.0.0.1' || host === 'wsl.localhost' || host === 'wsl$') {
      return false;
    }
    return true;
  }
  return false;
}

function makeScopeRefFromPath(realDirPath) {
  const norm = normalizePathForCompare(realDirPath);
  return `scope-spk-${sha256Hex(norm).slice(0, 16)}`;
}

/**
 * Strictly check whether targetPath is inside baseDir (equal to baseDir allowed only when allowEqual is true)
 */
export function isPathInsideDir(baseDir, targetPath, allowEqual = false) {
  if (typeof baseDir !== 'string' || typeof targetPath !== 'string') return false;
  if (!baseDir.trim() || !targetPath.trim()) return false;
  const normBase = normalizePathForCompare(baseDir);
  const normTarget = normalizePathForCompare(targetPath);
  if (normBase === normTarget) return Boolean(allowEqual);
  const rel = path.relative(normBase, normTarget);
  if (!rel || rel === '.' || rel === '..') return false;
  if (rel.startsWith(`..${path.sep}`) || rel.startsWith('../')) return false;
  if (path.isAbsolute(rel)) return false;
  return true;
}

/**
 * Validate and sanitize a Spark sandbox folder name (prevent path traversal, separators, reserved names, and control chars)
 */
export function validateSparkBoxName(rawName) {
  if (typeof rawName !== 'string') {
    return { ok: false, error: 'Folder name must be a string' };
  }
  const trimmed = rawName.trim();
  if (!trimmed) {
    return { ok: false, error: 'Folder name cannot be empty' };
  }
  if (trimmed.length > MAX_BOX_NAME_LEN) {
    return { ok: false, error: `Folder name cannot exceed ${MAX_BOX_NAME_LEN} characters` };
  }
  if (
    trimmed === '.' ||
    trimmed === '..' ||
    trimmed.includes('..') ||
    trimmed.includes('/') ||
    trimmed.includes('\\') ||
    trimmed.includes(':') ||
    trimmed.includes('\0') ||
    hasControlChars(trimmed) ||
    path.basename(trimmed) !== trimmed
  ) {
    return { ok: false, error: 'Folder name contains invalid path characters' };
  }
  if (trimmed.startsWith('.') || trimmed.endsWith('.')) {
    return { ok: false, error: 'Folder name cannot start or end with a dot' };
  }
  if (!/^[\p{L}\p{N}_ .-]+$/u.test(trimmed)) {
    return { ok: false, error: 'Folder name contains unsupported special characters' };
  }
  const upperStem = trimmed.split('.')[0].toUpperCase();
  if (RESERVED_WIN_NAMES.has(upperStem)) {
    return { ok: false, error: 'Folder name is a reserved system name' };
  }
  return { ok: true, name: trimmed };
}

function resolveDefaultConfigDir() {
  const envDir = process.env.AG_PRISM_GEMINI_CONFIG_DIR;
  if (typeof envDir === 'string' && envDir.trim()) {
    return path.resolve(envDir.trim());
  }
  return path.join(os.homedir(), '.gemini', 'config');
}

function resolveDefaultSparkRoot() {
  return path.join(os.homedir(), 'Documents', 'Antigravity-Spark');
}

function resolveDefaultKnowledgeRoot() {
  return path.join(os.homedir(), '.gemini', 'antigravity', 'prism-knowledge-space');
}

function defaultExecFilePromise(file, args, options) {
  return new Promise((resolve, reject) => {
    cpExecFile(file, args, options, (err, stdout, stderr) => {
      if (err) {
        err.stdout = stdout;
        err.stderr = stderr;
        reject(err);
        return;
      }
      resolve({ stdout: String(stdout || ''), stderr: String(stderr || '') });
    });
  });
}

function isPidAlive(pid) {
  if (!Number.isSafeInteger(pid) || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (err) {
    if (err && err.code === 'EPERM') return true;
    return false;
  }
}

function makeRpcError(code, message, retryable = false) {
  return {
    code: String(code || ERROR_CODES.INVALID_ARGUMENT),
    retryable: Boolean(retryable),
    message: String(message || code || 'Unknown error'),
  };
}

function makeDefaultSandboxCatalog() {
  const now = Date.now();
  return {
    health: 'ready',
    items: [
      {
        cascadeId: 'code-turbo-build',
        title: 'Antigravity Core Refactor (TURBO)',
        status: 'running',
        statusStartedAt: now - 45000,
        updatedAt: now - 1000,
        workspace: 'repo/obsidian-prism',
        hidden: false,
        pinned: true,
      },
      {
        cascadeId: 'code-ci-review',
        title: 'PR #128 Review & Lint Check',
        status: 'idle',
        statusStartedAt: now - 120000,
        updatedAt: now - 8000,
        workspace: 'repo/obsidian-prism',
        hidden: false,
        pinned: false,
      },
    ],
    lastKnownById: {},
  };
}

/**
 * Build a strictly isolated fake host adapter for sandboxMode / Workbench `/studio`.
 * - Maintains an independent project-level permission table alongside a read-only global Code TURBO permission reference;
 * - Logs all project-level permission audit entries and asserts globalPermissionWrites is always 0;
 * - Supports injecting permission conflicts, sandbox fallback, WSL confirmation, partial failures, and crash points via applyFixture.
 */
export function createSandboxHostAdapter(sandboxRoot, opts = {}) {
  const projectsRoot = path.join(sandboxRoot, 'projects');
  fs.mkdirSync(projectsRoot, { recursive: true, mode: 0o700 });

  // Pre-seed a sandbox demo directory sharing a physical path with Code (strictly inside sandbox root to demo shared non-destructive protection)
  const sharedCodeRepoName = 'obsidian-prism';
  const sharedCodeRepoDir = path.join(projectsRoot, sharedCodeRepoName);
  fs.mkdirSync(sharedCodeRepoDir, { recursive: true, mode: 0o700 });
  const sharedCodeRealDir = fs.realpathSync(sharedCodeRepoDir);
  const sharedCodeDirKeys = new Set([normalizePathForCompare(sharedCodeRealDir)]);

  // Read-only global Code permission snapshot (this adapter exposes no global setters; permanently TURBO with 0 writes)
  const globalCodeSettings = Object.freeze({
    autoExecutionPolicy: 'turbo',
    fileAccessPolicy: 'allow-all',
    internetPolicy: 'allow',
    sandboxMode: 'off',
  });

  const projectSettingsStore = new Map();
  const permissionAuditLog = [];
  const reservedSessionsByKey = new Map();
  const deliveredMessagesByKey = new Map();
  const hiddenSessionIds = new Set();

  let catalog = isPlainObject(opts.initialCatalog) ? cloneJson(opts.initialCatalog) : makeDefaultSandboxCatalog();
  let capabilities = {
    projectPermissions: true,
    sessionRebind: true,
    sandboxAvailable: true,
    wslAvailable: true,
    artifactsAvailable: true,
    ...(isPlainObject(opts.capabilities) ? opts.capabilities : {}),
  };
  let faults = {
    scopeIsolated: true,
    requireWslConfirmation: false,
    wslVerified: true,
    failPermissionSetter: null,
    crashAfter: null,
    messageDeliveryOutcome: 'ok',
    rebindSupported: true,
    pickCancelled: false,
    pickDirectoryName: 'Spark-Playground',
    ...(isPlainObject(opts.faults) ? opts.faults : {}),
  };

  let sessionSeq = 1;
  const globalPermissionWrites = 0;

  const ensureProjectBaseline = (scopeRef) => {
    if (!projectSettingsStore.has(scopeRef)) {
      projectSettingsStore.set(scopeRef, {
        autoExecutionPolicy: 'ask',
        fileAccessPolicy: 'ask-outside',
        internetPolicy: 'allow',
        sandboxMode: 'off',
      });
    }
    return projectSettingsStore.get(scopeRef);
  };

  const recordProjectAudit = (setter, scopeRef, value, ok, detail = null) => {
    permissionAuditLog.push({
      ts: Date.now(),
      scope: 'project-only',
      globalTouched: false,
      nonDestructive: false,
      setter,
      scopeRef,
      value,
      ok: Boolean(ok),
      ...(detail ? { detail } : {}),
    });
  };

  const recordNonDestructiveSharedAudit = (scopeRef, detail = 'shared-with-code') => {
    permissionAuditLog.push({
      ts: Date.now(),
      scope: 'shared-non-destructive',
      globalTouched: false,
      nonDestructive: true,
      setter: 'non-destructive-shared-guard',
      scopeRef,
      value: 'preserve-active-code-permissions',
      ok: true,
      detail,
    });
  };

  const projectSettingsProvider = {
    async getProjectPermissionGrants(scopeRef) {
      const snap = ensureProjectBaseline(scopeRef);
      return { ...snap };
    },
    async setProjectAutoExecutionPolicy(scopeRef, policy) {
      if (faults.failPermissionSetter === 'setProjectAutoExecutionPolicy') {
        recordProjectAudit('setProjectAutoExecutionPolicy', scopeRef, policy, false, 'injected-fault');
        throw new Error('Injected fault on setProjectAutoExecutionPolicy');
      }
      const cur = ensureProjectBaseline(scopeRef);
      cur.autoExecutionPolicy = policy;
      recordProjectAudit('setProjectAutoExecutionPolicy', scopeRef, policy, true);
    },
    async setProjectFileAccessPolicy(scopeRef, policy) {
      if (faults.failPermissionSetter === 'setProjectFileAccessPolicy') {
        recordProjectAudit('setProjectFileAccessPolicy', scopeRef, policy, false, 'injected-fault');
        throw new Error('Injected fault on setProjectFileAccessPolicy');
      }
      const cur = ensureProjectBaseline(scopeRef);
      cur.fileAccessPolicy = policy;
      recordProjectAudit('setProjectFileAccessPolicy', scopeRef, policy, true);
    },
    async setProjectInternetPolicy(scopeRef, policy) {
      if (faults.failPermissionSetter === 'setProjectInternetPolicy') {
        recordProjectAudit('setProjectInternetPolicy', scopeRef, policy, false, 'injected-fault');
        throw new Error('Injected fault on setProjectInternetPolicy');
      }
      const cur = ensureProjectBaseline(scopeRef);
      cur.internetPolicy = policy;
      recordProjectAudit('setProjectInternetPolicy', scopeRef, policy, true);
    },
    async setProjectSandboxMode(scopeRef, mode) {
      if (faults.failPermissionSetter === 'setProjectSandboxMode') {
        recordProjectAudit('setProjectSandboxMode', scopeRef, mode, false, 'injected-fault');
        throw new Error('Injected fault on setProjectSandboxMode');
      }
      const cur = ensureProjectBaseline(scopeRef);
      cur.sandboxMode = mode;
      recordProjectAudit('setProjectSandboxMode', scopeRef, mode, true);
    },
  };

  const upsertCatalogSession = (sessionObj) => {
    if (!Array.isArray(catalog.items)) catalog.items = [];
    const idx = catalog.items.findIndex((it) => it && (it.cascadeId === sessionObj.cascadeId || it.id === sessionObj.cascadeId));
    if (idx >= 0) {
      catalog.items[idx] = { ...catalog.items[idx], ...sessionObj };
    } else {
      catalog.items.unshift(sessionObj);
    }
  };

  return {
    isSandbox: true,
    projectsRoot,
    getCatalog() {
      return cloneJson(catalog);
    },
    setCatalog(nextCatalog) {
      if (isPlainObject(nextCatalog)) {
        const prevById = {};
        for (const it of Array.isArray(catalog.items) ? catalog.items : []) {
          if (it && it.cascadeId) prevById[it.cascadeId] = it;
        }
        catalog = {
          health: nextCatalog.health || nextCatalog.catalogHealth || 'ready',
          items: Array.isArray(nextCatalog.items) ? cloneJson(nextCatalog.items) : cloneJson(catalog.items || []),
          lastKnownById: isPlainObject(nextCatalog.lastKnownById) ? cloneJson(nextCatalog.lastKnownById) : prevById,
        };
      }
    },
    getCapabilities() {
      return { ...capabilities };
    },
    setCapabilities(patch) {
      if (isPlainObject(patch)) {
        capabilities = { ...capabilities, ...patch };
      }
    },
    getFaults() {
      return { ...faults };
    },
    setFaults(patch) {
      if (isPlainObject(patch)) {
        faults = { ...faults, ...patch };
      }
    },
    mutateProjectSettingExternally(scopeRef, field, value) {
      const cur = ensureProjectBaseline(scopeRef);
      if (field === 'autoExecutionPolicy' || field === 'fileAccessPolicy' || field === 'internetPolicy' || field === 'sandboxMode') {
        cur[field] = value;
      }
    },
    getProjectSettingsProvider() {
      return capabilities.projectPermissions ? projectSettingsProvider : null;
    },
    isPathSharedWithCode(dirPath) {
      if (typeof dirPath !== 'string' || !dirPath.trim()) return false;
      try {
        const realDir = fs.realpathSync(dirPath);
        return sharedCodeDirKeys.has(normalizePathForCompare(realDir));
      } catch {
        return sharedCodeDirKeys.has(normalizePathForCompare(dirPath));
      }
    },
    isScopeIsolated(_scopeRef, scopeMeta = null) {
      if (faults.scopeIsolated !== true) return false;
      if (scopeMeta && scopeMeta.sharedWithCode === true && scopeMeta.wslIsolated !== true) {
        return false;
      }
      return true;
    },
    recordNonDestructiveSharedAudit(scopeRef, detail) {
      recordNonDestructiveSharedAudit(scopeRef, detail);
    },
    getSharedCodePreset() {
      return {
        preset: 'shared-code-repo',
        displayName: sharedCodeRepoName,
        sharedWithCode: true,
      };
    },
    requiresWslConfirmation(kind) {
      return Boolean(faults.requireWslConfirmation && (kind === 'spark' || kind === 'knowledge'));
    },
    async verifyWslEnvironment() {
      return Boolean(capabilities.wslAvailable && faults.wslVerified !== false);
    },
    async verifyArtifacts() {
      return Boolean(capabilities.artifactsAvailable);
    },
    async pickProjectDirectory(params = {}) {
      if (params.cancel === true || faults.pickCancelled === true) {
        return { cancelled: true };
      }
      const wantsSharedPreset = params.preset === 'shared-code-repo' || params.sharedWithCode === true;
      if (wantsSharedPreset) {
        fs.mkdirSync(sharedCodeRepoDir, { recursive: true, mode: 0o700 });
        const realShared = fs.realpathSync(sharedCodeRepoDir);
        sharedCodeDirKeys.add(normalizePathForCompare(realShared));
        return {
          cancelled: false,
          realPath: realShared,
          displayName: sharedCodeRepoName,
          sharedWithCode: true,
        };
      }
      const rawName = typeof params.mockDirName === 'string' && params.mockDirName.trim()
        ? params.mockDirName.trim()
        : faults.pickDirectoryName || 'Spark-Playground';
      const valid = validateSparkBoxName(rawName);
      if (!valid.ok) {
        return { cancelled: false, error: valid.error };
      }
      const dirPath = path.resolve(projectsRoot, valid.name);
      if (!isPathInsideDir(projectsRoot, dirPath, false)) {
        return { cancelled: false, error: 'Selected sandbox directory escapes sandbox root' };
      }
      fs.mkdirSync(dirPath, { recursive: true, mode: 0o700 });
      const realDir = fs.realpathSync(dirPath);
      if (!isPathInsideDir(fs.realpathSync(sandboxRoot), realDir, false) || !fs.statSync(realDir).isDirectory()) {
        return { cancelled: false, error: 'Selected sandbox directory is outside the private root' };
      }
      const isShared = sharedCodeDirKeys.has(normalizePathForCompare(realDir));
      return {
        cancelled: false,
        realPath: realDir,
        displayName: path.basename(realDir),
        sharedWithCode: isShared,
      };
    },
    async validateSessionRebind({ cascadeId }) {
      if (!capabilities.sessionRebind || faults.rebindSupported === false) {
        return { ok: false, code: ERROR_CODES.CAPABILITY_UNAVAILABLE, message: 'Host session rebind unavailable' };
      }
      const found = (catalog.items || []).find((it) => it && it.cascadeId === cascadeId);
      if (!found) {
        return { ok: false, code: ERROR_CODES.NOT_FOUND, message: 'Session not found in host catalog' };
      }
      if (found.status === 'running' || found.status === 'blocked') {
        return { ok: false, code: ERROR_CODES.BUSY, message: `Session is currently ${found.status}` };
      }
      return { ok: true };
    },
    async rebindSession({ cascadeId, scopeRef }) {
      const current = (catalog.items || []).find((item) => item?.cascadeId === cascadeId);
      if (!capabilities.sessionRebind || !current || current.hidden || ['running', 'blocked'].includes(current.status)) {
        return { ok: false };
      }
      upsertCatalogSession({ cascadeId, workspace: scopeRef });
      return { ok: true, cascadeId, scopeRef };
    },
    async reserveSession({ idempotencyKey, scopeRef, kind, title }) {
      if (reservedSessionsByKey.has(idempotencyKey)) {
        return { ...reservedSessionsByKey.get(idempotencyKey), replayed: true };
      }
      const cascadeId = `chat-${kind}-${String(sessionSeq).padStart(4, '0')}`;
      sessionSeq += 1;
      hiddenSessionIds.add(cascadeId);
      const now = Date.now();
      upsertCatalogSession({
        cascadeId,
        title: title || (kind === 'spark' ? 'New Spark Chat' : 'New Knowledge Chat'),
        status: 'idle',
        statusStartedAt: now,
        updatedAt: now,
        workspace: scopeRef,
        hidden: true,
        pinned: false,
      });
      const rec = { cascadeId, hidden: true };
      reservedSessionsByKey.set(idempotencyKey, rec);
      return { ...rec, replayed: false };
    },
    async deliverFirstMessage({ idempotencyKey, cascadeId, message }) {
      if (deliveredMessagesByKey.has(idempotencyKey)) {
        return { status: 'delivered', cascadeId, replayed: true };
      }
      if (faults.messageDeliveryOutcome === 'ambiguous') {
        return { status: 'ambiguous', cascadeId };
      }
      if (faults.messageDeliveryOutcome === 'not-received') {
        return { status: 'not-received', cascadeId };
      }
      deliveredMessagesByKey.set(idempotencyKey, { cascadeId, messageHash: sha256Hex(message) });
      hiddenSessionIds.delete(cascadeId);
      const now = Date.now();
      const snippet = String(message || '').trim().slice(0, 48) || 'Chat Conversation';
      upsertCatalogSession({
        cascadeId,
        title: snippet,
        status: 'idle',
        statusStartedAt: now,
        updatedAt: now,
        hidden: false,
      });
      return { status: 'delivered', cascadeId, replayed: false };
    },
    async updateConversationAnnotations({ cascadeId, annotations }) {
      if (!Array.isArray(catalog.items)) catalog.items = [];
      const idx = catalog.items.findIndex((it) => it && it.cascadeId === cascadeId);
      if (idx >= 0 && isPlainObject(annotations)) {
        if (typeof annotations.title === 'string' && annotations.title.trim()) catalog.items[idx].title = annotations.title.trim();
        if (typeof annotations.pinned === 'boolean') catalog.items[idx].pinned = annotations.pinned;
        if (typeof annotations.archived === 'boolean') catalog.items[idx].archived = annotations.archived;
      }
      return { ok: true, cascadeId };
    },
    async deleteConversation({ cascadeId }) {
      if (Array.isArray(catalog.items)) {
        catalog.items = catalog.items.filter((it) => it && it.cascadeId !== cascadeId);
      }
      return { ok: true, cascadeId };
    },
    async cancelConversation({ cascadeId }) {
      if (Array.isArray(catalog.items)) {
        const idx = catalog.items.findIndex((it) => it && it.cascadeId === cascadeId);
        if (idx >= 0) catalog.items[idx].status = 'idle';
      }
      return { ok: true, cascadeId };
    },
    async checkDeliveryStatus({ idempotencyKey, cascadeId }) {
      if (deliveredMessagesByKey.has(idempotencyKey)) {
        return { delivered: true, confirmedNotReceived: false, cascadeId };
      }
      if (faults.messageDeliveryOutcome === 'ambiguous') {
        return { delivered: false, confirmedNotReceived: false, cascadeId };
      }
      return { delivered: false, confirmedNotReceived: true, cascadeId };
    },
    getAuditReport() {
      const projectSettingsSnapshot = {};
      for (const [k, v] of projectSettingsStore.entries()) {
        projectSettingsSnapshot[k] = { ...v };
      }
      const projectWriteCount = permissionAuditLog.filter((entry) => entry && entry.scope === 'project-only').length;
      const nonDestructiveGuardCount = permissionAuditLog.filter(
        (entry) => entry && entry.scope === 'shared-non-destructive'
      ).length;
      return {
        globalPermissionWrites,
        globalCodeSettings: { ...globalCodeSettings },
        projectPermissionWrites: projectWriteCount,
        nonDestructiveGuardCount,
        permissionAuditLog: cloneJson(permissionAuditLog),
        projectSettings: projectSettingsSnapshot,
        sharedCodePreset: {
          preset: 'shared-code-repo',
          displayName: sharedCodeRepoName,
          sharedWithCode: true,
        },
      };
    },
    resetRuntime() {
      projectSettingsStore.clear();
      permissionAuditLog.length = 0;
      reservedSessionsByKey.clear();
      deliveredMessagesByKey.clear();
      hiddenSessionIds.clear();
      catalog = makeDefaultSandboxCatalog();
      capabilities = {
        projectPermissions: true,
        sessionRebind: true,
        sandboxAvailable: true,
        wslAvailable: true,
        artifactsAvailable: true,
      };
      faults = {
        scopeIsolated: true,
        requireWslConfirmation: false,
        wslVerified: true,
        failPermissionSetter: null,
        crashAfter: null,
        messageDeliveryOutcome: 'ok',
        rebindSupported: true,
        pickCancelled: false,
        pickDirectoryName: 'Spark-Playground',
      };
      sessionSeq = 1;
    },
  };
}

/**
 * Sanitized operation projection: strictly omits internal paths, permission baselines, and WSL challenge tokens.
 */
function sanitizePublicOperation(operationId, op) {
  if (!isPlainObject(op)) return null;
  const out = {
    operationId,
    kind: typeof op.kind === 'string' ? op.kind : 'unknown',
    status: typeof op.status === 'string' ? op.status : 'pending',
    phase: typeof op.phase === 'string' ? op.phase : 'created',
    createdAt: Number.isFinite(op.createdAt) ? op.createdAt : 0,
    updatedAt: Number.isFinite(op.updatedAt) ? op.updatedAt : 0,
  };
  if (op.sparkProjectId) out.sparkProjectId = op.sparkProjectId;
  if (op.cascadeId) out.cascadeId = op.cascadeId;
  if (op.view) out.view = op.view;
  if (typeof op.degraded === 'boolean') out.degraded = op.degraded;
  if (op.degradedReason) out.degradedReason = op.degradedReason;
  if (typeof op.sharedWithCode === 'boolean') out.sharedWithCode = op.sharedWithCode;
  if (typeof op.nonDestructive === 'boolean') out.nonDestructive = op.nonDestructive;
  if (typeof op.permissionStatus === 'string') out.permissionStatus = op.permissionStatus;
  if (op.status === 'awaiting-confirmation') {
    out.requiresWslConfirmation = true;
  }
  if (isPlainObject(op.error)) {
    out.error = makeRpcError(op.error.code, op.error.message, op.error.retryable);
  }
  if (isPlainObject(op.publicResult)) {
    out.result = cloneJson(op.publicResult);
  }
  return out;
}

export class SidebarStudioService {
  constructor(options = {}) {
    this.sandboxMode = Boolean(options.sandboxMode);
    this.logger = typeof options.logger === 'function' ? options.logger : () => {};
    this._execFile = typeof options.execFile === 'function' ? options.execFile : defaultExecFilePromise;
    this._now = typeof options.now === 'function' ? options.now : () => Date.now();
    this._disposed = false;
    this._writeSeq = 0;
    this._queue = Promise.resolve();
    this._lockPath = null;
    this._lockToken = randomId('lock', 8);
    this._ownedSandboxRoot = null;
    this._selectionTokens = new Map();
    this._wslChallenges = new Map();
    this._pendingMessageBodies = new Map();
    this._bootDiagnostic = null;

    if (this.sandboxMode) {
      // Sandbox mode must never read the real ~/.gemini/config or environment override variables
      const sbRoot = options.sandboxRoot
        ? path.resolve(options.sandboxRoot)
        : fs.mkdtempSync(path.join(os.tmpdir(), 'ag-prism-studio-sb-'));
      if (!options.sandboxRoot) {
        this._ownedSandboxRoot = sbRoot;
      }
      this.sandboxRoot = sbRoot;
      fs.mkdirSync(sbRoot, { recursive: true, mode: 0o700 });
      this.statePath = options.statePath
        ? path.resolve(options.statePath)
        : path.join(sbRoot, 'state', 'obsidian-prism-sidebar.json');
      this.defaultSparkRoot = options.sparkRoot
        ? path.resolve(options.sparkRoot)
        : path.join(sbRoot, 'spark-boxes');
      this.knowledgeSpaceDir = options.knowledgeRoot
        ? path.resolve(options.knowledgeRoot)
        : path.join(sbRoot, 'knowledge-space');
      this.hostAdapter = options.hostAdapter || createSandboxHostAdapter(sbRoot, options.sandboxHostOptions || {});
    } else {
      const configDir = options.configDir ? path.resolve(options.configDir) : resolveDefaultConfigDir();
      this.sandboxRoot = null;
      this.statePath = options.statePath
        ? path.resolve(options.statePath)
        : path.join(configDir, 'obsidian-prism-sidebar.json');
      this.defaultSparkRoot = options.sparkRoot
        ? path.resolve(options.sparkRoot)
        : resolveDefaultSparkRoot();
      this.knowledgeSpaceDir = options.knowledgeRoot
        ? path.resolve(options.knowledgeRoot)
        : resolveDefaultKnowledgeRoot();
      this.hostAdapter = options.hostAdapter || null;
    }

    this._catalog = isPlainObject(options.initialCatalog)
      ? cloneJson(options.initialCatalog)
      : this.hostAdapter && typeof this.hostAdapter.getCatalog === 'function'
      ? this.hostAdapter.getCatalog()
      : { health: 'loading', items: [], lastKnownById: {} };

    try {
      this._acquireWriterLock();
      this._state = this._loadOrMigrateState();
      if (!this._bootDiagnostic) this._recoverPersistedOperationsOnBoot();
    } catch (err) {
      this._releaseWriterLock();
      if (this._ownedSandboxRoot) {
        try { fs.rmSync(this._ownedSandboxRoot, { recursive: true, force: true }); } catch {}
      }
      throw err;
    }
  }

  _acquireWriterLock() {
    const dir = path.dirname(this.statePath);
    fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
    const lockPath = `${this.statePath}.lock`;
    const lockPayload = JSON.stringify({
      pid: process.pid,
      token: this._lockToken,
      createdAt: this._now(),
    });

    const tryOpen = () => {
      const fd = fs.openSync(lockPath, 'wx', 0o600);
      try {
        try {
          fs.writeFileSync(fd, lockPayload, 'utf8');
          fs.fsyncSync(fd);
        } finally {
          fs.closeSync(fd);
        }
      } catch (err) {
        try { fs.unlinkSync(lockPath); } catch {}
        throw err;
      }
      this._lockPath = lockPath;
    };

    try {
      tryOpen();
      return;
    } catch (err) {
      if (!err || err.code !== 'EEXIST') {
        throw err;
      }
    }

    // Existing lock file detected: reclaim stale lock if owner process exited; return BUSY if same process is alive
    let existing = null;
    try {
      existing = JSON.parse(fs.readFileSync(lockPath, 'utf8'));
    } catch {
      existing = null;
    }

    const busy = () => Object.assign(new Error('Sidebar state already has a writer or its lock cannot be verified'), {
      code: ERROR_CODES.BUSY,
    });
    // Do not treat an unfinished lock being written by another instance as stale.
    if (!Number.isSafeInteger(existing?.pid) || existing.pid <= 0 || !existing.token || isPidAlive(existing.pid)) throw busy();
    const recoveryPath = `${lockPath}.recovery`;
    const acquireRecoveryDir = () => {
      try {
        fs.mkdirSync(recoveryPath, { mode: 0o700 });
        return;
      } catch (err) {
        if (err?.code !== 'EEXIST') throw err;
      }
      // Stale .lock.recovery detected: if expired and verified as a non-symlink directory, safely reclaim and atomically re-acquire to prevent permanent BUSY deadlock after crashes
      let st;
      try {
        st = fs.lstatSync(recoveryPath);
      } catch (statErr) {
        if (statErr?.code !== 'ENOENT') throw busy();
        try {
          fs.mkdirSync(recoveryPath, { mode: 0o700 });
          return;
        } catch (retryErr) {
          if (retryErr?.code === 'EEXIST') throw busy();
          throw retryErr;
        }
      }
      if (st.isSymbolicLink() || !st.isDirectory()) throw busy();
      const nowMs = Math.max(Date.now(), this._now());
      const ageMs = nowMs - Math.trunc(st.mtimeMs || 0);
      if (ageMs < LOCK_RECOVERY_STALE_MS) throw busy();
      try {
        fs.rmdirSync(recoveryPath);
      } catch (rmErr) {
        if (rmErr?.code !== 'ENOENT') throw busy();
      }
      try {
        fs.mkdirSync(recoveryPath, { mode: 0o700 });
      } catch (retryErr) {
        if (retryErr?.code === 'EEXIST') throw busy();
        throw retryErr;
      }
    };
    acquireRecoveryDir();
    try {
      let current;
      try { current = JSON.parse(fs.readFileSync(lockPath, 'utf8')); } catch { throw busy(); }
      if (current?.pid !== existing.pid || current?.token !== existing.token || isPidAlive(current.pid)) throw busy();
      fs.unlinkSync(lockPath);
      try { tryOpen(); } catch (err) { if (err?.code === 'EEXIST') throw busy(); throw err; }
    } finally {
      try { fs.rmdirSync(recoveryPath); } catch {}
    }
  }

  _releaseWriterLock() {
    if (!this._lockPath) return;
    const lp = this._lockPath;
    this._lockPath = null;
    try {
      const raw = fs.readFileSync(lp, 'utf8');
      const parsed = JSON.parse(raw);
      if (parsed && parsed.token === this._lockToken) {
        fs.unlinkSync(lp);
      }
    } catch {
      // Silently ignore if already cleaned up externally
    }
  }

  _backupLegacyV1Bytes(rawBuf) {
    const baseBak = `${this.statePath}.v1.bak`;
    let bakPath = baseBak;
    if (fs.existsSync(bakPath)) {
      bakPath = `${this.statePath}.v1.${this._now()}.${crypto.randomBytes(6).toString('hex')}.bak`;
    }
    const fd = fs.openSync(bakPath, 'wx', 0o600);
    try {
      fs.writeFileSync(fd, rawBuf);
      fs.fsyncSync(fd);
    } finally {
      fs.closeSync(fd);
    }
    try {
      fs.chmodSync(bakPath, 0o600);
    } catch {
      // Windows NTFS ignores POSIX mode
    }
    this._lastV1BackupPath = bakPath;
    return bakPath;
  }

  _loadOrMigrateState() {
    if (!fs.existsSync(this.statePath)) {
      const fresh = createDefaultStateV2({
        storeId: randomId('store', 8),
        sparkRoot: this.defaultSparkRoot,
        knowledgeRoot: this.knowledgeSpaceDir,
      });
      this._saveStateAtomic(fresh);
      return fresh;
    }

    let rawBuf;
    try {
      rawBuf = fs.readFileSync(this.statePath);
    } catch (err) {
      this._bootDiagnostic = makeRpcError(
        ERROR_CODES.PERSISTENCE_FAILED,
        'Failed reading sidebar state file',
        true
      );
      return createDefaultStateV2({
        storeId: randomId('store', 8),
        sparkRoot: this.defaultSparkRoot,
        knowledgeRoot: this.knowledgeSpaceDir,
      });
    }

    const rawText = rawBuf.toString('utf8').replace(/^\uFEFF/, '').trim();
    if (!rawText) {
      // 0-byte empty file: preserve diagnostics without blind overwrite, or safely rebuild only when explicitly empty
      this._bootDiagnostic = makeRpcError(
        ERROR_CODES.MIGRATION_FAILED,
        'Persisted sidebar state file is empty; original file preserved for inspection',
        false
      );
      return createDefaultStateV2({
        storeId: randomId('store', 8),
        sparkRoot: this.defaultSparkRoot,
        knowledgeRoot: this.knowledgeSpaceDir,
      });
    }

    let parsed;
    try {
      parsed = JSON.parse(rawText);
    } catch (err) {
      // Corrupted JSON: must preserve the original file without overwriting and return diagnostics
      this._bootDiagnostic = makeRpcError(
        ERROR_CODES.MIGRATION_FAILED,
        'Corrupt JSON in sidebar state file (original file preserved)',
        false
      );
      return createDefaultStateV2({
        storeId: randomId('store', 8),
        sparkRoot: this.defaultSparkRoot,
        knowledgeRoot: this.knowledgeSpaceDir,
      });
    }

    // Strict version field validation: reject any invalid type, conflicting version, future version, or v2 structure missing explicit schemaVersion=2, preserving the original file
    const hasSchemaField = isPlainObject(parsed) && Object.prototype.hasOwnProperty.call(parsed, 'schemaVersion');
    const hasLegacyVerField = isPlainObject(parsed) && Object.prototype.hasOwnProperty.call(parsed, 'version');
    const rawSv = hasSchemaField ? parsed.schemaVersion : undefined;
    const rawLv = hasLegacyVerField ? parsed.version : undefined;

    if (
      (hasSchemaField && (!Number.isInteger(rawSv) || rawSv < 1)) ||
      (hasLegacyVerField && (!Number.isInteger(rawLv) || rawLv < 1)) ||
      (hasSchemaField && hasLegacyVerField && rawSv !== rawLv)
    ) {
      this._bootDiagnostic = makeRpcError(
        ERROR_CODES.INVALID_ARGUMENT,
        'Invalid or conflicting schemaVersion/version field in sidebar state file (original file preserved)',
        false
      );
      return createDefaultStateV2({
        storeId: randomId('store', 8),
        sparkRoot: this.defaultSparkRoot,
        knowledgeRoot: this.knowledgeSpaceDir,
      });
    }

    const versionCandidate = hasSchemaField ? rawSv : hasLegacyVerField ? rawLv : null;
    if (typeof versionCandidate === 'number' && versionCandidate > SCHEMA_VERSION) {
      this._bootDiagnostic = makeRpcError(
        ERROR_CODES.UNSUPPORTED_SCHEMA,
        `Unsupported future schema version ${versionCandidate} (original file preserved)`,
        false
      );
      return createDefaultStateV2({
        storeId: randomId('store', 8),
        sparkRoot: this.defaultSparkRoot,
        knowledgeRoot: this.knowledgeSpaceDir,
      });
    }

    // When any v2-only structural key is present, schemaVersion === 2 must be declared explicitly; never fall back into v1 migration
    const hasV2ShapeKeys =
      isPlainObject(parsed) &&
      (
        Object.prototype.hasOwnProperty.call(parsed, 'activeMode') ||
        Object.prototype.hasOwnProperty.call(parsed, 'modeLastView') ||
        Object.prototype.hasOwnProperty.call(parsed, 'chatDraft') ||
        Object.prototype.hasOwnProperty.call(parsed, 'knowledgeFolders') ||
        Object.prototype.hasOwnProperty.call(parsed, 'sparkProjects') ||
        Object.prototype.hasOwnProperty.call(parsed, 'projectScopes')
      );
    if (hasV2ShapeKeys && parsed.schemaVersion !== SCHEMA_VERSION) {
      this._bootDiagnostic = makeRpcError(
        ERROR_CODES.INVALID_ARGUMENT,
        'Persisted v2 sidebar state is missing explicit schemaVersion: 2 (original file preserved)',
        false
      );
      return createDefaultStateV2({
        storeId: randomId('store', 8),
        sparkRoot: this.defaultSparkRoot,
        knowledgeRoot: this.knowledgeSpaceDir,
      });
    }

    if (parsed && typeof parsed === 'object' && parsed.schemaVersion === SCHEMA_VERSION) {
      const checked = validateState(parsed);
      if (!checked.ok) {
        this._bootDiagnostic = makeRpcError(
          checked.error.code,
          'Invalid v2 sidebar state (original file preserved)',
          false
        );
        return createDefaultStateV2({
          storeId: randomId('store', 8),
          sparkRoot: this.defaultSparkRoot,
          knowledgeRoot: this.knowledgeSpaceDir,
        });
      }
      return checked.state;
    }

    // Lossless v1 migration: back up raw v1 bytes first, invoke migrateV1, then atomically persist v2
    const migrated = migrateV1(parsed, {
      storeId: randomId('store', 8),
      sparkRoot: this.defaultSparkRoot,
      knowledgeRoot: this.knowledgeSpaceDir,
    });
    if (!migrated.ok) {
      this._bootDiagnostic = makeRpcError(
        migrated.error.code,
        'v1 migration failed (original file preserved)',
        false
      );
      return createDefaultStateV2({
        storeId: randomId('store', 8),
        sparkRoot: this.defaultSparkRoot,
        knowledgeRoot: this.knowledgeSpaceDir,
      });
    }

    this._backupLegacyV1Bytes(rawBuf);
    this._saveStateAtomic(migrated.state);
    this.logger(`[sidebar-studio] Backed up original v1 file and losslessly migrated to v2: ${this._lastV1BackupPath}`);
    return migrated.state;
  }

  _saveStateAtomic(stateObj) {
    const dir = path.dirname(this.statePath);
    fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
    const payload = JSON.stringify(stateObj, null, 2) + '\n';
    this._writeSeq += 1;
    const tmpName = `${path.basename(this.statePath)}.${process.pid}.${this._writeSeq}.${crypto.randomBytes(4).toString('hex')}.tmp`;
    const tmpPath = path.join(dir, tmpName);

    let fd = null;
    try {
      fd = fs.openSync(tmpPath, 'wx', 0o600);
      fs.writeFileSync(fd, payload, 'utf8');
      fs.fsyncSync(fd);
      fs.closeSync(fd);
      fd = null;
    } catch (err) {
      if (fd !== null) {
        try { fs.closeSync(fd); } catch {}
      }
      try { fs.unlinkSync(tmpPath); } catch {}
      throw err;
    }

    try {
      fs.chmodSync(tmpPath, 0o600);
    } catch {
      // Windows NTFS ignores POSIX mode
    }

    try {
      // On transient Windows sharing violations, retry atomic replace without truncating the last valid state.
      for (let attempt = 0; ; attempt++) {
        try {
          fs.renameSync(tmpPath, this.statePath);
          break;
        } catch (err) {
          if (process.platform !== 'win32' || attempt >= 3 || !['EBUSY', 'EPERM', 'EACCES'].includes(err?.code)) throw err;
          try {
            Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 15 * (attempt + 1));
          } catch {}
        }
      }
    } catch (err) {
      try { fs.unlinkSync(tmpPath); } catch {}
      throw err;
    }

    try {
      fs.chmodSync(this.statePath, 0o600);
    } catch {
      // Windows NTFS ignores POSIX mode
    }

    // Fsync parent directory on POSIX platforms to ensure directory entry durability (safely ignored on Windows)
    if (process.platform !== 'win32') {
      let dirFd = null;
      try {
        dirFd = fs.openSync(dir, 'r');
        fs.fsyncSync(dirFd);
      } catch {
        // Some filesystems do not support directory fsync; ignore
      } finally {
        if (dirFd !== null) {
          try { fs.closeSync(dirFd); } catch {}
        }
      }
    }
  }

  _expireWslConfirmations() {
    const now = this._now();
    let next = null;
    const expired = new Set();
    for (const [id, op] of Object.entries(this._state.operations)) {
      if (op.kind !== 'send-chat-first' || op.status !== 'awaiting-confirmation') continue;
      const entry = this._wslChallenges.get(id);
      if (entry && entry.expiresAt > now && entry.scopeRef === op.scopeRef &&
          entry.envFingerprint === `${process.platform}:${this._state.storeId}`) continue;
      next ??= cloneJson(this._state);
      expired.add(id);
      Object.assign(next.operations[id], {
        status: 'failed', phase: 'confirmation-expired', updatedAt: now,
        error: makeRpcError(ERROR_CODES.INVALID_ARGUMENT, 'WSL confirmation expired; start a fresh request', true),
      });
    }
    if (!next) return;
    next.rev += 1;
    for (const receipt of Object.values(next.receipts)) {
      const id = receipt.response?.result?.operationId;
      if (expired.has(id)) receipt.response = { ok: false, rev: next.rev, error: next.operations[id].error };
    }
    this._saveStateAtomic(next);
    this._state = next;
    for (const id of expired) {
      this._wslChallenges.delete(id);
      this._pendingMessageBodies.delete(id);
    }
  }

  _recoverPersistedOperationsOnBoot() {
    this._expireWslConfirmations();
    let changed = false;
    const ops = this._state.operations || {};
    const now = this._now();

    for (const scope of Object.values(this._state.projectScopes)) {
      if (scope.permissionStatus === 'applying' || scope.permissionStatus === 'restoring') {
        scope.permissionStatus = 'needs-reconciliation';
        changed = true;
      }
    }
    for (const opId of Object.keys(ops)) {
      const op = this._state.operations[opId];
      if (!isPlainObject(op)) continue;
      if (op.kind === 'send-chat-first' && op.status === 'pending') {
        if (op.phase === 'applying-permissions') {
          // Host may have only completed partial writes; keep original baseline and block automatic re-application.
          op.status = 'needs-reconciliation';
          op.updatedAt = now;
          op.error = makeRpcError(ERROR_CODES.NEEDS_RECONCILIATION, 'Project permission application was interrupted');
          const scope = this._state.projectScopes[op.scopeRef];
          if (scope) scope.permissionStatus = 'needs-reconciliation';
          changed = true;
        } else if (op.phase === 'delivering-message') {
          // Crashed during delivery phase: cannot confirm host receipt, forbid blind replay, enter reconciliation state
          op.status = 'needs-reconciliation';
          op.updatedAt = now;
          op.error = makeRpcError(
            ERROR_CODES.NEEDS_RECONCILIATION,
            'Process restarted while message delivery outcome was uncertain; manual reconciliation required',
            false
          );
          changed = true;
        } else if (op.phase === 'message-confirmed') {
          // Message confirmed delivered but crashed before committing completion: auto-finalize assignment on startup
          const completed = reduce(
            this._state,
            {
              type: 'complete-chat-first',
              cascadeId: op.cascadeId,
              placement: op.placement,
              originDraftRev: op.originDraftRev,
              originNavRev: op.originNavRev,
            },
            { catalog: this._getRuntimeCatalog() }
          );
          if (completed.ok) {
            this._state = completed.nextState;
            this._state.operations[opId] = {
              ...op,
              status: 'succeeded',
              phase: 'completed',
              view: completed.result.view,
              publicResult: {
                operationId: opId,
                status: 'succeeded',
                cascadeId: op.cascadeId,
                view: completed.result.view,
                draftCleared: completed.result.draftCleared,
                navigated: completed.result.navigated,
              },
              updatedAt: now,
            };
          } else {
            op.status = 'needs-reconciliation';
            op.updatedAt = now;
            op.error = makeRpcError(ERROR_CODES.NEEDS_RECONCILIATION, 'Confirmed delivery could not be committed after restart');
          }
          changed = true;
        } else {
          // Restarted during create/permission/reservation phase with in-memory body lost: mark needs-input and await resubmission reusing the same operation
          op.status = 'needs-input';
          op.updatedAt = now;
          op.error = makeRpcError(
            ERROR_CODES.INVALID_ARGUMENT,
            'Service restarted before message dispatch; resubmit original message with resumeOperationId to continue',
            true
          );
          changed = true;
        }
      }
    }

    // Live safe self-healing: if no host project permissions were ever written (empty applied, no baseline) and no reserved session or interrupted permission write exists, clear stale zero-write needs-reconciliation deadlock
    if (!this.sandboxMode) {
      const blockedScopes = new Set();
      for (const op of Object.values(this._state.operations || {})) {
        if (!isPlainObject(op) || !op.scopeRef) continue;
        if (
          op.cascadeId ||
          op.phase === 'applying-permissions' ||
          op.phase === 'delivering-message' ||
          op.phase === 'permission-restore-reconcile'
        ) {
          blockedScopes.add(op.scopeRef);
        }
      }
      for (const [ref, scope] of Object.entries(this._state.projectScopes || {})) {
        if (!isPlainObject(scope) || scope.permissionStatus !== 'needs-reconciliation') continue;
        const hasAppliedKeys = isPlainObject(scope.applied) && Object.keys(scope.applied).length > 0;
        if (hasAppliedKeys || scope.baseline || blockedScopes.has(ref)) continue;
        if (!this._isScopeDirectoryCurrent(scope)) continue;
        scope.permissionStatus = 'pending';
        scope.applied = null;
        scope.baseline = null;
        changed = true;
        for (const op of Object.values(this._state.operations || {})) {
          if (
            isPlainObject(op) &&
            op.scopeRef === ref &&
            op.status === 'needs-reconciliation' &&
            !op.cascadeId &&
            op.phase === 'created'
          ) {
            op.status = 'failed';
            op.updatedAt = now;
            changed = true;
          }
        }
      }
    }

    if (changed) {
      this._saveStateAtomic(this._state);
    }
  }

  _getRuntimeCatalog() {
    if (this.hostAdapter && typeof this.hostAdapter.getCatalog === 'function') {
      return this.hostAdapter.getCatalog();
    }
    return this._catalog;
  }

  _getRuntimeCapabilities() {
    if (this.hostAdapter && typeof this.hostAdapter.getCapabilities === 'function') {
      return this.hostAdapter.getCapabilities();
    }
    return {
      projectPermissions: false,
      sessionRebind: false,
      sandboxAvailable: false,
      wslAvailable: false,
      artifactsAvailable: true,
    };
  }

  _buildSnapshot(stateOverride = null) {
    const targetState = stateOverride || this._state;
    return selectSnapshot(targetState, {
      catalog: this._getRuntimeCatalog(),
      capabilities: this._getRuntimeCapabilities(),
    });
  }

  getBootDiagnostic() {
    return this._bootDiagnostic ? { ...this._bootDiagnostic } : null;
  }

  getState() {
    const snapshot = this._buildSnapshot();
    if (this._bootDiagnostic) {
      return {
        ok: false,
        rev: this._state.rev,
        error: { ...this._bootDiagnostic },
        snapshot,
      };
    }
    return {
      ok: true,
      rev: this._state.rev,
      result: snapshot,
      snapshot,
    };
  }

  getSnapshot() {
    return this._buildSnapshot();
  }

  getPermissionAudit() {
    if (this.hostAdapter && typeof this.hostAdapter.getAuditReport === 'function') {
      return this.hostAdapter.getAuditReport();
    }
    return {
      globalPermissionWrites: 0,
      projectPermissionWrites: 0,
      permissionAuditLog: [],
      projectSettings: {},
    };
  }

  /**
   * Restricted to trusted host confirmation dialogs (or test/Workbench fake hosts) to obtain the one-time WSL challenge for a paused operation.
   * Must NEVER be exposed through ordinary public RPCs like get-state or get-operation!
   */
  getTrustedWslChallenge(operationId) {
    const entry = this._wslChallenges.get(operationId);
    if (!entry) return null;
    if (entry.expiresAt <= this._now()) {
      this._wslChallenges.delete(operationId);
      return null;
    }
    return {
      operationId,
      challenge: entry.challenge,
      scopeRef: entry.scopeRef,
      expiresAt: entry.expiresAt,
    };
  }

  /**
   * Enqueue any task serially onto the single-writer queue to eliminate concurrent read-modify-write races.
   */
  _enqueue(fn) {
    const next = this._queue.then(fn, fn);
    this._queue = next.catch(() => {});
    return next;
  }

  /**
   * Unified update for the runtime host catalog mirror (submitted via the same single-writer queue, supporting automatic assignment reconciliation and view fallback).
   */
  updateCatalog(catalogPayload) {
    return this._enqueue(async () => {
      if (this._disposed) {
        return { ok: false, rev: this._state.rev, error: makeRpcError(ERROR_CODES.BUSY, 'Service disposed') };
      }
      if (this._bootDiagnostic) {
        return { ok: false, rev: this._state.rev, error: { ...this._bootDiagnostic } };
      }
      if (this.hostAdapter && typeof this.hostAdapter.setCatalog === 'function') {
        this.hostAdapter.setCatalog(catalogPayload);
      } else if (isPlainObject(catalogPayload)) {
        this._catalog = cloneJson(catalogPayload);
      }
      const catalog = this._getRuntimeCatalog();
      const rec = reduce(this._state, { type: 'reconcile-catalog', catalog }, { catalog });
      if (rec.ok && rec.nextState !== this._state) {
        this._saveStateAtomic(rec.nextState);
        this._state = rec.nextState;
      }
      const snapshot = this._buildSnapshot();
      return { ok: true, rev: this._state.rev, result: rec.result, snapshot };
    });
  }

  /**
   * sandboxMode only: update fake catalog, state, capabilities, or fault injection points from a fixture (via the same single-writer queue).
   */
  applyFixture(fixture = {}) {
    return this._enqueue(async () => {
      if (!this.sandboxMode || !this.hostAdapter) {
        return {
          ok: false,
          rev: this._state.rev,
          error: makeRpcError(ERROR_CODES.CAPABILITY_UNAVAILABLE, 'applyFixture is only available in sandboxMode'),
          snapshot: this._buildSnapshot(),
        };
      }
      if (!isPlainObject(fixture) || hasForbiddenKeysDeep(fixture)) {
        return {
          ok: false,
          rev: this._state.rev,
          error: makeRpcError(ERROR_CODES.INVALID_ARGUMENT, 'Invalid fixture payload'),
          snapshot: this._buildSnapshot(),
        };
      }
      if (isPlainObject(fixture.capabilities) && typeof this.hostAdapter.setCapabilities === 'function') {
        this.hostAdapter.setCapabilities(fixture.capabilities);
      }
      if (isPlainObject(fixture.faults) && typeof this.hostAdapter.setFaults === 'function') {
        this.hostAdapter.setFaults(fixture.faults);
      }
      if (isPlainObject(fixture.externalProjectSetting) && typeof this.hostAdapter.mutateProjectSettingExternally === 'function') {
        const { scopeRef, field, value } = fixture.externalProjectSetting;
        if (typeof scopeRef === 'string' && typeof field === 'string') {
          this.hostAdapter.mutateProjectSettingExternally(scopeRef, field, value);
        }
      }
      if (isPlainObject(fixture.catalog) && typeof this.hostAdapter.setCatalog === 'function') {
        this.hostAdapter.setCatalog(fixture.catalog);
      }

      // If fixture explicitly requests rebuilding test assignments (sandbox fixture only), validate before atomic commit
      if (fixture.preset === 'dual-active-background') {
        const now = this._now();
        this.hostAdapter.setCatalog({
          health: 'ready',
          items: [
            {
              cascadeId: 'code-turbo-build',
              title: 'Antigravity Core Refactor (TURBO)',
              status: 'running',
              statusStartedAt: now - 30000,
              updatedAt: now - 500,
              workspace: 'repo/obsidian-prism',
            },
            {
              cascadeId: 'code-blocked-approval',
              title: 'Deploy Production Migration',
              status: 'blocked',
              statusStartedAt: now - 15000,
              updatedAt: now - 200,
              workspace: 'repo/obsidian-prism',
            },
            {
              cascadeId: 'chat-know-brief',
              title: 'Q4 Research Synthesis',
              status: 'running',
              statusStartedAt: now - 12000,
              updatedAt: now - 100,
              workspace: KNOWLEDGE_SCOPE_REF,
            },
          ],
        });
        const next = cloneJson(this._state);
        next.assignments['chat-know-brief'] = {
          mode: 'chat',
          placement: { kind: 'knowledge', folderId: null },
          continuation: 'ready',
        };
        next.rev += 1;
        this._saveStateAtomic(next);
        this._state = next;
      } else {
        const catalog = this._getRuntimeCatalog();
        const rec = reduce(this._state, { type: 'reconcile-catalog', catalog }, { catalog });
        if (rec.ok && rec.nextState !== this._state) {
          this._saveStateAtomic(rec.nextState);
          this._state = rec.nextState;
        }
      }

      const snapshot = this._buildSnapshot();
      return { ok: true, rev: this._state.rev, result: snapshot, snapshot };
    });
  }

  /**
   * sandboxMode only: drain the queue and generate fresh temporary state with a new storeId (stale storeId requests trigger STALE_STATE).
   */
  resetSandbox() {
    return this._enqueue(async () => {
      if (!this.sandboxMode || !this.hostAdapter) {
        return {
          ok: false,
          rev: this._state.rev,
          error: makeRpcError(ERROR_CODES.CAPABILITY_UNAVAILABLE, 'resetSandbox is only available in sandboxMode'),
          snapshot: this._buildSnapshot(),
        };
      }
      this._selectionTokens.clear();
      this._wslChallenges.clear();
      this._pendingMessageBodies.clear();
      this._bootDiagnostic = null;
      if (typeof this.hostAdapter.resetRuntime === 'function') {
        this.hostAdapter.resetRuntime();
      }
      const fresh = createDefaultStateV2({
        storeId: randomId('store', 8),
        sparkRoot: this.defaultSparkRoot,
        knowledgeRoot: this.knowledgeSpaceDir,
      });
      this._saveStateAtomic(fresh);
      this._state = fresh;
      const snapshot = this._buildSnapshot();
      return { ok: true, rev: this._state.rev, result: snapshot, snapshot };
    });
  }

  _lookupReceipt(requestId, fingerprint) {
    const receipts = this._state.receipts || {};
    if (Object.prototype.hasOwnProperty.call(receipts, requestId)) {
      const rec = receipts[requestId];
      if (rec && rec.fingerprint === fingerprint) {
        const receipt = rec.response;
        const op = receipt?.result?.status === 'awaiting-confirmation'
          ? this._state.operations[receipt.result.operationId] : null;
        const refreshed = op?.publicResult
          ? { ok: true, rev: this._state.rev, result: op.publicResult }
          : op?.error ? { ok: false, rev: this._state.rev, error: op.error } : receipt;
        return { hit: true, conflict: false, response: cloneJson(refreshed) };
      }
      return { hit: true, conflict: true, response: null };
    }
    const evictedBucket = receipts[EVICTED_RECEIPT_BUCKET_KEY];
    if (isPlainObject(evictedBucket) && isPlainObject(evictedBucket.hashes)) {
      if (Object.prototype.hasOwnProperty.call(evictedBucket.hashes, requestId)) {
        const storedFp = evictedBucket.hashes[requestId];
        if (storedFp !== fingerprint) {
          return { hit: true, conflict: true, response: null };
        }
        return {
          hit: true,
          conflict: true,
          evictedReplay: true,
          response: null,
        };
      }
    }
    // Persist the operation record first on initial attempt; the process may stop before generating the final receipt.
    const op = Object.values(this._state.operations).find((item) => item.requestId === requestId);
    if (op) {
      if (op.requestFingerprint !== fingerprint) return { hit: true, conflict: true };
      const rev = this._state.rev;
      const response = op.error
        ? { ok: false, rev, error: cloneJson(op.error) }
        : { ok: true, rev, result: op.publicResult ?? sanitizePublicOperation(op.operationId, op) };
      return { hit: true, conflict: false, response };
    }
    return { hit: false, conflict: false, response: null };
  }

  _recordReceiptOnState(stateObj, requestId, fingerprint, response) {
    if (!requestId) return;
    if (!isPlainObject(stateObj.receipts)) stateObj.receipts = {};

    const liveKeys = Object.keys(stateObj.receipts).filter((k) => k !== EVICTED_RECEIPT_BUCKET_KEY);
    if (liveKeys.length >= MAX_LIVE_RECEIPTS && !Object.prototype.hasOwnProperty.call(stateObj.receipts, requestId)) {
      // Evict oldest receipts in chronological order and archive their compressed fingerprints to keep detecting old key replays/conflicts
      liveKeys.sort((a, b) => (stateObj.receipts[a]?.ts || 0) - (stateObj.receipts[b]?.ts || 0));
      const evictKey = liveKeys[0];
      const evicted = stateObj.receipts[evictKey];
      delete stateObj.receipts[evictKey];
      if (!isPlainObject(stateObj.receipts[EVICTED_RECEIPT_BUCKET_KEY])) {
        stateObj.receipts[EVICTED_RECEIPT_BUCKET_KEY] = { hashes: {}, order: [] };
      }
      const bucket = stateObj.receipts[EVICTED_RECEIPT_BUCKET_KEY];
      if (!isPlainObject(bucket.hashes)) bucket.hashes = {};
      if (!Array.isArray(bucket.order)) bucket.order = [];
      if (evicted && typeof evicted.fingerprint === 'string') {
        bucket.hashes[evictKey] = evicted.fingerprint;
        bucket.order.push(evictKey);
        while (bucket.order.length > MAX_EVICTED_RECEIPT_KEYS) {
          const drop = bucket.order.shift();
          delete bucket.hashes[drop];
        }
      }
    }

    // Receipts do not duplicate the full snapshot (to avoid bloat); store only result/error and rev, hydrating latest snapshot on read
    const slimResponse = response.ok
      ? { ok: true, rev: response.rev, result: cloneJson(response.result) }
      : { ok: false, rev: response.rev, error: cloneJson(response.error) };

    stateObj.receipts[requestId] = {
      fingerprint,
      ts: this._now(),
      response: slimResponse,
    };
  }

  _pruneOperations(stateObj) {
    const ops = stateObj.operations || {};
    const keys = Object.keys(ops);
    if (keys.length <= LIMITS.MAX_OPERATIONS) return;
    const finished = keys
      .filter((k) => ops[k] && (ops[k].status === 'succeeded' || ops[k].status === 'failed'))
      .sort((a, b) => (ops[a]?.updatedAt || 0) - (ops[b]?.updatedAt || 0));
    while (Object.keys(ops).length > LIMITS.MAX_OPERATIONS && finished.length > 0) {
      delete ops[finished.shift()];
    }
  }

  _issueSelectionToken(realPath, displayName, meta = {}) {
    const now = this._now();
    for (const [k, v] of this._selectionTokens.entries()) {
      if (v.expiresAt <= now) this._selectionTokens.delete(k);
    }
    const token = randomId('sel', 12);
    this._selectionTokens.set(token, {
      realPath,
      displayName,
      sharedWithCode: Boolean(meta && meta.sharedWithCode),
      expiresAt: now + SELECTION_TOKEN_TTL_MS,
    });
    return token;
  }

  _consumeSelectionToken(token) {
    if (typeof token !== 'string' || !token.trim()) return null;
    const rec = this._selectionTokens.get(token);
    if (!rec) return null;
    if (rec.expiresAt <= this._now()) {
      this._selectionTokens.delete(token);
      return null;
    }
    this._selectionTokens.delete(token);
    return rec;
  }

  _isScopeDirectoryCurrent(scope) {
    if (typeof scope?.realPath !== 'string' || !path.isAbsolute(scope.realPath) || hasControlChars(scope.realPath)) return false;
    try {
      const real = fs.realpathSync(scope.realPath);
      return normalizePathForCompare(real) === normalizePathForCompare(scope.realPath) && fs.statSync(real).isDirectory() &&
        (!this.sandboxMode || isPathInsideDir(fs.realpathSync(this.sandboxRoot), real, false));
    } catch {
      return false;
    }
  }

  _ensureKnowledgeScopeRecord(stateObj) {
    if (!isPlainObject(stateObj.projectScopes)) stateObj.projectScopes = {};
    if (!fs.existsSync(this.knowledgeSpaceDir)) {
      fs.mkdirSync(this.knowledgeSpaceDir, { recursive: true, mode: 0o700 });
    }
    const realKnowledgeDir = fs.realpathSync(this.knowledgeSpaceDir);
    if (!isPlainObject(stateObj.projectScopes[KNOWLEDGE_SCOPE_REF])) {
      stateObj.projectScopes[KNOWLEDGE_SCOPE_REF] = {
        scopeRef: KNOWLEDGE_SCOPE_REF,
        kind: 'knowledge',
        displayName: 'Knowledge Space',
        realPath: realKnowledgeDir,
        scopeGeneration: 1,
        permissionStatus: 'pending',
        degraded: false,
        baseline: null,
        applied: null,
      };
    } else {
      const scope = stateObj.projectScopes[KNOWLEDGE_SCOPE_REF];
      if (normalizePathForCompare(scope.realPath || '') !== normalizePathForCompare(realKnowledgeDir)) {
        scope.permissionStatus = 'needs-reconciliation';
      }
    }
    return stateObj.projectScopes[KNOWLEDGE_SCOPE_REF];
  }

  _checkVersionGuard(envelope, { requireStore = true, requireBaseRev = true } = {}) {
    if (requireStore && envelope.storeId !== undefined) {
      if (typeof envelope.storeId !== 'string' || envelope.storeId !== this._state.storeId) {
        return makeRpcError(ERROR_CODES.STALE_STATE, 'Stale or mismatched storeId', true);
      }
    }
    if (requireBaseRev && envelope.baseRev !== undefined) {
      if (!Number.isSafeInteger(envelope.baseRev) || envelope.baseRev !== this._state.rev) {
        return makeRpcError(ERROR_CODES.STALE_STATE, 'Stale baseRev; refresh snapshot and retry', true);
      }
    }
    return null;
  }

  _normalizeEnvelope(action, rawParams) {
    if (typeof action !== 'string' || !action.trim()) {
      return { ok: false, error: makeRpcError(ERROR_CODES.INVALID_ARGUMENT, 'RPC action must be a non-empty string') };
    }
    const act = action.trim();
    if (rawParams !== undefined && rawParams !== null && !isPlainObject(rawParams)) {
      return { ok: false, error: makeRpcError(ERROR_CODES.INVALID_ARGUMENT, 'RPC params must be a plain object') };
    }
    const src = isPlainObject(rawParams) ? rawParams : {};
    if (hasForbiddenKeysDeep(src)) {
      return { ok: false, error: makeRpcError(ERROR_CODES.INVALID_ARGUMENT, 'Forbidden prototype key detected in RPC payload') };
    }
    let serializedBytes = 0;
    try {
      serializedBytes = Buffer.byteLength(JSON.stringify(src), 'utf8');
    } catch {
      return { ok: false, error: makeRpcError(ERROR_CODES.INVALID_ARGUMENT, 'Unserializable RPC payload') };
    }
    const payloadLimit = act === 'import-spark-file' ? MAX_SPARK_IMPORT_RPC_BYTES : MAX_RPC_PAYLOAD_BYTES;
    if (serializedBytes > payloadLimit) {
      return { ok: false, error: makeRpcError(ERROR_CODES.LIMIT_EXCEEDED, 'RPC payload exceeds maximum size limit') };
    }

    if (src.version !== undefined && src.version !== SCHEMA_VERSION) {
      return {
        ok: false,
        error: makeRpcError(
          ERROR_CODES.UNSUPPORTED_SCHEMA,
          `Unsupported RPC version ${String(src.version)}; expected v${SCHEMA_VERSION}`
        ),
      };
    }

    let requestId = null;
    if (src.requestId !== undefined && src.requestId !== null && src.requestId !== '') {
      if (!isSafeIdentifier(src.requestId)) {
        return { ok: false, error: makeRpcError(ERROR_CODES.INVALID_ARGUMENT, 'Invalid requestId format') };
      }
      if (src.requestId === EVICTED_RECEIPT_BUCKET_KEY) {
        return { ok: false, error: makeRpcError(ERROR_CODES.INVALID_ARGUMENT, 'Reserved requestId') };
      }
      requestId = src.requestId;
    }

    if (src.payload !== undefined && !isPlainObject(src.payload)) {
      return { ok: false, error: makeRpcError(ERROR_CODES.INVALID_ARGUMENT, 'RPC payload must be an object') };
    }
    const { version: _version, action: _action, requestId: _requestId, storeId, baseRev, ...flatPayload } = src;
    const payload = src.payload ?? flatPayload;
    return {
      ok: true,
      action: act,
      requestId,
      storeId,
      baseRev,
      payload,
    };
  }

  async _handleCreateSparkBox(payload) {
    const check = validateSparkBoxName(payload?.name);
    if (!check.ok) {
      return { ok: false, error: makeRpcError(ERROR_CODES.INVALID_ARGUMENT, check.error) };
    }
    const safeName = check.name;
    const sparkRoot = this.sandboxMode ? this.defaultSparkRoot : (this._state.prefs.sparkRoot || this.defaultSparkRoot);

    let realSparkRoot;
    try {
      fs.mkdirSync(sparkRoot, { recursive: true, mode: 0o700 });
      const rootLstat = fs.lstatSync(sparkRoot);
      if (rootLstat.isSymbolicLink()) {
        return { ok: false, error: makeRpcError(ERROR_CODES.INVALID_ARGUMENT, 'Refusing to create sandbox inside a symlink root directory') };
      }
      realSparkRoot = fs.realpathSync(sparkRoot);
    } catch (err) {
      return {
        ok: false,
        error: makeRpcError(ERROR_CODES.PERSISTENCE_FAILED, 'Unable to initialize Spark sandbox root directory'),
      };
    }

    const candidatePath = path.resolve(realSparkRoot, safeName);
    if (!isPathInsideDir(realSparkRoot, candidatePath, false)) {
      return { ok: false, error: makeRpcError(ERROR_CODES.INVALID_ARGUMENT, 'Target path escaped boundary and was blocked') };
    }

    let created = false;
    try {
      if (fs.existsSync(candidatePath)) {
        const lstat = fs.lstatSync(candidatePath);
        if (lstat.isSymbolicLink()) {
          return { ok: false, error: makeRpcError(ERROR_CODES.INVALID_ARGUMENT, 'Refusing to operate on a symlink target') };
        }
        const realExisting = fs.realpathSync(candidatePath);
        if (!isPathInsideDir(realSparkRoot, realExisting, false)) {
          return { ok: false, error: makeRpcError(ERROR_CODES.INVALID_ARGUMENT, 'Resolved target path escaped sandbox root and was blocked') };
        }
        if (!lstat.isDirectory()) {
          return { ok: false, error: makeRpcError(ERROR_CODES.INVALID_ARGUMENT, 'A file with the same name already exists and is not a directory') };
        }
        const selectionToken = this._issueSelectionToken(realExisting, safeName);
        return {
          ok: true,
          result: { name: safeName, displayName: safeName, created: false, selectionToken },
        };
      }

      fs.mkdirSync(candidatePath, { recursive: false, mode: 0o700 });
      created = true;
      const postLstat = fs.lstatSync(candidatePath);
      const realCreated = fs.realpathSync(candidatePath);
      if (postLstat.isSymbolicLink() || !isPathInsideDir(realSparkRoot, realCreated, false)) {
        try { fs.rmdirSync(candidatePath); } catch {}
        return { ok: false, error: makeRpcError(ERROR_CODES.INVALID_ARGUMENT, 'Created directory escaped sandbox root and was rolled back') };
      }

      const selectionToken = this._issueSelectionToken(realCreated, safeName);
      return {
        ok: true,
        result: { name: safeName, displayName: safeName, created, selectionToken },
      };
    } catch (err) {
      return {
        ok: false,
        error: makeRpcError(ERROR_CODES.PERSISTENCE_FAILED, 'Failed to create sandbox directory'),
      };
    }
  }

  async _handlePickProjectDirectory(payload) {
    if (this.sandboxMode) {
      if (!this.hostAdapter || typeof this.hostAdapter.pickProjectDirectory !== 'function') {
        return { ok: false, error: makeRpcError(ERROR_CODES.CAPABILITY_UNAVAILABLE, 'Sandbox picker unavailable') };
      }
      const picked = await this.hostAdapter.pickProjectDirectory(payload || {});
      if (picked.cancelled) {
        return { ok: true, result: { cancelled: true } };
      }
      if (picked.error || !picked.realPath) {
        return { ok: false, error: makeRpcError(ERROR_CODES.INVALID_ARGUMENT, picked.error || 'Invalid directory selection') };
      }
      const sharedWithCode = Boolean(
        picked.sharedWithCode ||
        (typeof this.hostAdapter.isPathSharedWithCode === 'function' && this.hostAdapter.isPathSharedWithCode(picked.realPath))
      );
      const selectionToken = this._issueSelectionToken(
        picked.realPath,
        picked.displayName || path.basename(picked.realPath),
        { sharedWithCode }
      );
      return {
        ok: true,
        result: {
          cancelled: false,
          displayName: picked.displayName || path.basename(picked.realPath),
          selectionToken,
          sharedWithCode,
        },
      };
    }

    if (this.hostAdapter && typeof this.hostAdapter.pickProjectDirectory === 'function') {
      const picked = await this.hostAdapter.pickProjectDirectory(payload || {});
      if (picked.cancelled) return { ok: true, result: { cancelled: true } };
      if (!picked.realPath) {
        return { ok: false, error: makeRpcError(ERROR_CODES.INVALID_ARGUMENT, picked.error || 'Invalid picked directory') };
      }
      const realDir = fs.realpathSync(picked.realPath);
      if (!fs.statSync(realDir).isDirectory()) {
        return { ok: false, error: makeRpcError(ERROR_CODES.INVALID_ARGUMENT, 'Picked target is not a directory') };
      }
      const displayName = path.basename(realDir) || 'Project';
      const sharedWithCode = Boolean(
        picked.sharedWithCode ||
        (typeof this.hostAdapter.isPathSharedWithCode === 'function' && this.hostAdapter.isPathSharedWithCode(realDir))
      );
      const selectionToken = this._issueSelectionToken(realDir, displayName, { sharedWithCode });
      return { ok: true, result: { cancelled: false, displayName, selectionToken, sharedWithCode } };
    }

    const osPicked = await this.pickFolder(payload || {});
    if (!osPicked.ok) {
      return { ok: false, error: makeRpcError(ERROR_CODES.CAPABILITY_UNAVAILABLE, osPicked.error) };
    }
    if (osPicked.canceled || !osPicked.path) {
      return { ok: true, result: { cancelled: true } };
    }
    try {
      const realDir = fs.realpathSync(osPicked.path);
      if (!fs.statSync(realDir).isDirectory()) {
        return { ok: false, error: makeRpcError(ERROR_CODES.INVALID_ARGUMENT, 'Selected path is not a directory') };
      }
      const displayName = path.basename(realDir) || 'Project';
      const selectionToken = this._issueSelectionToken(realDir, displayName);
      return { ok: true, result: { cancelled: false, displayName, selectionToken } };
    } catch (err) {
      return { ok: false, error: makeRpcError(ERROR_CODES.INVALID_ARGUMENT, `Selected directory inaccessible: ${err?.message || err}`) };
    }
  }

  async _executeChatFirstOperation(opId, rawMessage, requestId, fingerprint) {
    const op = this._state.operations[opId];
    if (!op) {
      return { ok: false, rev: this._state.rev, error: makeRpcError(ERROR_CODES.NOT_FOUND, 'Operation not found') };
    }

    const psp = this.hostAdapter && typeof this.hostAdapter.getProjectSettingsProvider === 'function'
      ? this.hostAdapter.getProjectSettingsProvider()
      : null;
    const scopeRef = op.scopeRef;
    const scopeRec = this._state.projectScopes[scopeRef];
    if (scopeRec?.realPath && typeof this.hostAdapter?.registerScopePath === 'function') {
      this.hostAdapter.registerScopePath(scopeRef, scopeRec.realPath);
    }
    const isSharedWithCode = Boolean(scopeRec?.sharedWithCode ||
      (scopeRec?.realPath && this.hostAdapter?.isPathSharedWithCode?.(scopeRec.realPath)));
    const usesPerCascade = Boolean(
      !isSharedWithCode &&
      typeof this.hostAdapter?.usesPerCascadeIsolation === 'function' &&
      this.hostAdapter.usesPerCascadeIsolation(scopeRef, op.placement.kind, scopeRec?.realPath || '')
    );
    const hasAppliedScopeKeys = Boolean(scopeRec && isPlainObject(scopeRec.applied) && Object.keys(scopeRec.applied).length > 0);
    const scopeBlockedByReconcile = !isSharedWithCode &&
      ['needs-reconciliation', 'applying', 'restoring'].includes(scopeRec?.permissionStatus) &&
      !(usesPerCascade && !hasAppliedScopeKeys && !scopeRec?.baseline);
    if (!this._isScopeDirectoryCurrent(scopeRec) || scopeBlockedByReconcile) {
      op.status = 'needs-reconciliation';
      op.updatedAt = this._now();
      op.error = makeRpcError(
        ERROR_CODES.NEEDS_RECONCILIATION,
        'Project permission scope requires reconciliation before sending new messages'
      );
      this._saveStateAtomic(this._state);
      return { ok: false, rev: this._state.rev, error: op.error };
    }

    // Stage 1: Project-level non-intrusive permission isolation (strictly only calls the 4 project-level setters on projectSettingsProvider, 0 global permission writes; shared directories use non-destructive protection; Knowledge / lightweight Spark without a host Project uses zero-write per-cascade cascadeConfig isolation)
    let permRes;
    if (usesPerCascade) {
      if (typeof this.hostAdapter?.recordPerCascadeIsolationAudit === 'function') {
        this.hostAdapter.recordPerCascadeIsolationAudit(scopeRef, `send-chat-first:${op.placement.kind}:per-cascade`);
      }
      permRes = {
        ok: true,
        status: 'per-cascade-isolated',
        kind: op.placement.kind,
        scopeRef,
        sharedWithCode: false,
        nonDestructive: true,
        globalWrites: 0,
        projectWrites: 0,
        baseline: null,
        applied: {},
        degraded: false,
        degradedReason: 'per-cascade-isolated',
        artifactsVerified: null,
        steps: [],
      };
    } else {
      const caps = this._getRuntimeCapabilities();
      const scopeIsolated = !isSharedWithCode && this.hostAdapter && typeof this.hostAdapter.isScopeIsolated === 'function'
        ? this.hostAdapter.isScopeIsolated(scopeRef, {
            sharedWithCode: isSharedWithCode,
            wslIsolated: Boolean(op.wslConfirmed),
          })
        : false;
      const verifyArtifacts = this.hostAdapter && typeof this.hostAdapter.verifyArtifacts === 'function'
        ? (ref) => this.hostAdapter.verifyArtifacts(ref)
        : null;

      permRes = await applyProjectPermissionIsolation({
        kind: op.placement.kind,
        scopeRef,
        projectSettingsProvider: psp,
        scopeIsolated,
        sharedWithCode: isSharedWithCode,
        allowSharedNonDestructive: isSharedWithCode,
        sandboxAvailable: Boolean(caps.sandboxAvailable),
        verifyArtifacts,
        beforeWrite: (baseline) => {
          scopeRec.baseline ??= baseline;
          op.phase = 'applying-permissions';
          this._saveStateAtomic(this._state);
        },
        onFieldApplied: (_field, _value, partialApplied) => {
          scopeRec.applied = { ...(isPlainObject(scopeRec.applied) ? scopeRec.applied : {}), ...partialApplied };
          this._saveStateAtomic(this._state);
        },
      });
    }

    if (!permRes.ok) {
      op.status = permRes.status === 'needs-reconciliation' ? 'needs-reconciliation' : 'failed';
      op.updatedAt = this._now();
      op.error = makeRpcError(permRes.error.code, permRes.error.message, permRes.error.retryable);
      if (scopeRec && permRes.status === 'needs-reconciliation') {
        scopeRec.permissionStatus = 'needs-reconciliation';
        if (!scopeRec.baseline && permRes.baseline) scopeRec.baseline = permRes.baseline;
        if (permRes.applied) scopeRec.applied = { ...scopeRec.applied, ...permRes.applied };
      }
      this._saveStateAtomic(this._state);
      return { ok: false, rev: this._state.rev, error: op.error };
    }

    const isNonDestructiveShared = permRes.status === 'non-destructive-shared';
    const isPerCascadeIsolated = permRes.status === 'per-cascade-isolated';
    if (isNonDestructiveShared && this.hostAdapter && typeof this.hostAdapter.recordNonDestructiveSharedAudit === 'function') {
      this.hostAdapter.recordNonDestructiveSharedAudit(scopeRef, 'send-chat-first:shared-with-code');
    }

    if (scopeRec) {
      if (isNonDestructiveShared) {
        scopeRec.sharedWithCode = true;
        scopeRec.nonDestructive = true;
        scopeRec.degraded = false;
        scopeRec.degradedReason = 'shared-with-code';
        scopeRec.applied = {};
        scopeRec.permissionStatus = 'non-destructive-shared';
      } else if (isPerCascadeIsolated) {
        scopeRec.sharedWithCode = false;
        scopeRec.nonDestructive = true;
        scopeRec.degraded = false;
        scopeRec.degradedReason = 'per-cascade-isolated';
        scopeRec.applied = {};
        scopeRec.permissionStatus = 'per-cascade-isolated';
      } else {
        if (!scopeRec.baseline) scopeRec.baseline = permRes.baseline;
        scopeRec.applied = permRes.applied;
        scopeRec.degraded = Boolean(permRes.degraded);
        scopeRec.degradedReason = permRes.degradedReason || null;
        scopeRec.nonDestructive = false;
        scopeRec.permissionStatus = permRes.degraded ? 'degraded' : 'applied';
      }
    }
    op.phase = 'permissions-applied';
    op.degraded = Boolean(permRes.degraded);
    op.degradedReason = permRes.degradedReason || null;
    op.sharedWithCode = Boolean(isSharedWithCode || permRes.sharedWithCode);
    op.nonDestructive = Boolean(isNonDestructiveShared || isPerCascadeIsolated);
    op.permissionStatus = isNonDestructiveShared
      ? 'non-destructive-shared'
      : isPerCascadeIsolated
      ? 'per-cascade-isolated'
      : permRes.degraded
      ? 'degraded'
      : 'applied';
    op.updatedAt = this._now();
    this._saveStateAtomic(this._state);

    // Fault injection point: simulate crash after applying permissions (for crash recovery unit tests)
    const faults = this.hostAdapter && typeof this.hostAdapter.getFaults === 'function' ? this.hostAdapter.getFaults() : {};
    if (faults.crashAfter === 'permission-applied') {
      return {
        ok: true,
        rev: this._state.rev,
        result: {
          operationId: opId,
          status: 'pending',
          phase: 'permissions-applied',
          degraded: op.degraded,
        },
      };
    }

    // Stage 2: Idempotently reserve a hidden empty session
    if (!op.cascadeId) {
      if (typeof this.hostAdapter.reserveSession !== 'function') {
        op.status = 'failed';
        op.updatedAt = this._now();
        op.error = makeRpcError(ERROR_CODES.CAPABILITY_UNAVAILABLE, 'Host reserveSession capability unavailable');
        this._saveStateAtomic(this._state);
        return { ok: false, rev: this._state.rev, error: op.error };
      }
      let reserved;
      try {
        reserved = await this.hostAdapter.reserveSession({
          idempotencyKey: `${op.idempotencyKey}:reserve`,
          scopeRef,
          kind: op.placement.kind,
          title: Array.from(rawMessage).slice(0, 48).join(''),
          dirPath: this._state.projectScopes?.[scopeRef]?.realPath || '',
          modelId: op.modelId || null,
          effort: op.effort || null,
        });
      } catch {
        // Reservation failure allows resubmitting the original body; recovery reuses the same host idempotency key.
        op.status = 'needs-input';
        op.updatedAt = this._now();
        op.error = makeRpcError(ERROR_CODES.CAPABILITY_UNAVAILABLE, 'Host reservation unavailable; resubmit the original message', true);
        this._saveStateAtomic(this._state);
        return { ok: false, rev: this._state.rev, error: op.error };
      }
      if (!isValidChatReservation(this._state, this._getRuntimeCatalog(), opId, reserved?.cascadeId)) {
        op.status = 'needs-reconciliation';
        op.error = makeRpcError(ERROR_CODES.NEEDS_RECONCILIATION, 'Host returned an invalid or already owned reservation');
        op.updatedAt = this._now();
        this._saveStateAtomic(this._state);
        return { ok: false, rev: this._state.rev, error: op.error };
      }
      op.cascadeId = reserved.cascadeId;
      op.phase = 'session-reserved';
      op.updatedAt = this._now();
      this._saveStateAtomic(this._state);
    }

    if (faults.crashAfter === 'session-created') {
      return {
        ok: true,
        rev: this._state.rev,
        result: {
          operationId: opId,
          status: 'pending',
          phase: 'session-reserved',
          cascadeId: op.cascadeId,
          degraded: op.degraded,
        },
      };
    }

    // Stage 3: Deliver the first message with the idempotency key
    op.phase = 'delivering-message';
    op.updatedAt = this._now();
    this._saveStateAtomic(this._state);

    if (faults.crashAfter === 'delivering-message') {
      return {
        ok: true,
        rev: this._state.rev,
        result: {
          operationId: opId,
          status: 'pending',
          phase: 'delivering-message',
          cascadeId: op.cascadeId,
        },
      };
    }

    if (typeof this.hostAdapter.deliverFirstMessage !== 'function') {
      op.status = 'failed';
      op.updatedAt = this._now();
      op.error = makeRpcError(ERROR_CODES.CAPABILITY_UNAVAILABLE, 'Host deliverFirstMessage capability unavailable');
      this._saveStateAtomic(this._state);
      return { ok: false, rev: this._state.rev, error: op.error };
    }

    let delivered;
    try {
      delivered = await this.hostAdapter.deliverFirstMessage({
        idempotencyKey: `${op.idempotencyKey}:send`,
        cascadeId: op.cascadeId,
        scopeRef,
        kind: op.placement.kind,
        dirPath: this._state.projectScopes?.[scopeRef]?.realPath || '',
        message: rawMessage,
        modelId: op.modelId || null,
        effort: op.effort || null,
      });
    } catch {
      // Transport error does not prove the host did not receive the message; never auto-replay.
    }
    this._pendingMessageBodies.delete(opId);
    const deliveryMatches = delivered?.cascadeId === op.cascadeId;
    if (!deliveryMatches || !['delivered', 'not-received'].includes(delivered.status)) {
      op.status = 'needs-reconciliation';
      op.updatedAt = this._now();
      op.error = makeRpcError(
        ERROR_CODES.NEEDS_RECONCILIATION,
        'First message delivery outcome is uncertain; pausing automatic replay',
        false
      );
      this._saveStateAtomic(this._state);
      return { ok: false, rev: this._state.rev, error: op.error };
    }

    if (delivered.status === 'not-received') {
      op.status = 'needs-input';
      op.phase = 'session-reserved';
      op.updatedAt = this._now();
      op.error = makeRpcError(
        ERROR_CODES.INVALID_ARGUMENT,
        'Host confirmed message was not received; resubmit message to retry safely',
        true
      );
      this._saveStateAtomic(this._state);
      return { ok: false, rev: this._state.rev, error: op.error };
    }

    op.phase = 'message-confirmed';
    op.updatedAt = this._now();
    this._saveStateAtomic(this._state);

    if (faults.crashAfter === 'message-confirmed') {
      return {
        ok: true,
        rev: this._state.rev,
        result: {
          operationId: opId,
          status: 'pending',
          phase: 'message-confirmed',
          cascadeId: op.cascadeId,
        },
      };
    }

    // Stage 4: After delivery is confirmed, invoke pure state machine complete-chat-first to atomically commit ownership, conditionally clear draft, and conditionally switch route
    const catalog = this._getRuntimeCatalog();
    const completed = reduce(
      this._state,
      {
        type: 'complete-chat-first',
        cascadeId: op.cascadeId,
        placement: op.placement,
        originDraftRev: op.originDraftRev,
        originNavRev: op.originNavRev,
      },
      { catalog }
    );
    if (!completed.ok) {
      op.status = 'needs-reconciliation';
      op.updatedAt = this._now();
      op.error = makeRpcError(completed.error.code, completed.error.message, completed.error.retryable);
      this._saveStateAtomic(this._state);
      return { ok: false, rev: this._state.rev, error: op.error };
    }

    const nextState = completed.nextState;
    const publicResult = {
      operationId: opId,
      status: 'succeeded',
      cascadeId: op.cascadeId,
      view: completed.result.view,
      draftCleared: completed.result.draftCleared,
      navigated: completed.result.navigated,
      degraded: op.degraded,
      ...(op.degradedReason ? { degradedReason: op.degradedReason } : {}),
      ...(op.sharedWithCode ? { sharedWithCode: true } : {}),
      ...(op.nonDestructive ? { nonDestructive: true } : {}),
      ...(op.permissionStatus ? { permissionStatus: op.permissionStatus } : {}),
    };

    nextState.operations[opId] = {
      ...op,
      status: 'succeeded',
      phase: 'completed',
      view: completed.result.view,
      publicResult,
      updatedAt: this._now(),
    };
    this._pendingMessageBodies.delete(opId);
    this._pruneOperations(nextState);

    const response = { ok: true, rev: nextState.rev, result: publicResult };
    if (requestId && fingerprint) {
      this._recordReceiptOnState(nextState, requestId, fingerprint, response);
    }
    this._saveStateAtomic(nextState);
    this._state = nextState;
    return response;
  }

  async _dispatchSerialized(action, envelope) {
    if (this._disposed) {
      return {
        ok: false,
        rev: this._state.rev,
        error: makeRpcError(ERROR_CODES.BUSY, 'SidebarStudioService has been disposed'),
      };
    }

    if (this._bootDiagnostic && action !== 'get-state') {
      return {
        ok: false,
        rev: this._state.rev,
        error: { ...this._bootDiagnostic },
        snapshot: this._buildSnapshot(),
      };
    }

    if (!this._bootDiagnostic) this._expireWslConfirmations();

    // 1. Queries observe cleaned operation state within the same serialized queue
    if (action === 'get-state') {
      return this.getState();
    }

    if (action === 'sync-catalog') {
      if (!this.sandboxMode && this.hostAdapter && typeof this.hostAdapter.syncFromRenderer === 'function') {
        this.hostAdapter.syncFromRenderer(envelope.payload || {});
      }
      return this.getState();
    }

    if (action === 'get-operation') {
      const verErr = this._checkVersionGuard(envelope, { requireStore: true, requireBaseRev: false });
      if (verErr) {
        return { ok: false, rev: this._state.rev, error: verErr, snapshot: this._buildSnapshot() };
      }
      const opId = envelope.payload?.operationId;
      if (!isSafeIdentifier(opId)) {
        return {
          ok: false,
          rev: this._state.rev,
          error: makeRpcError(ERROR_CODES.INVALID_ARGUMENT, 'Invalid operationId'),
          snapshot: this._buildSnapshot(),
        };
      }
      const op = this._state.operations?.[opId];
      if (!op) {
        return {
          ok: false,
          rev: this._state.rev,
          error: makeRpcError(ERROR_CODES.NOT_FOUND, 'Operation not found'),
          snapshot: this._buildSnapshot(),
        };
      }
      return {
        ok: true,
        rev: this._state.rev,
        result: sanitizePublicOperation(opId, op),
        snapshot: this._buildSnapshot(),
      };
    }

    // 2. Legacy v1 three-space and global permission write actions return a version error in v2
    if (LEGACY_V1_UNSUPPORTED_ACTIONS.has(action)) {
      return {
        ok: false,
        rev: this._state.rev,
        error: makeRpcError(
          ERROR_CODES.UNSUPPORTED_SCHEMA,
          `Legacy v1 action "${action}" is unsupported in v2; global permission switching is disabled`
        ),
        snapshot: this._buildSnapshot(),
      };
    }

    // 3. Check idempotency receipts first (retries look up persisted receipt before version checks)
    const requestId = envelope.requestId;
    const fingerprint = requestId
      ? sha256Hex(canonicalStringify({ action, payload: envelope.payload }))
      : null;

    if (requestId) {
      const receiptHit = this._lookupReceipt(requestId, fingerprint);
      if (receiptHit.hit) {
        if (receiptHit.conflict) {
          return {
            ok: false,
            rev: this._state.rev,
            error: makeRpcError(
              ERROR_CODES.IDEMPOTENCY_CONFLICT,
              receiptHit.evictedReplay
                ? 'RequestId was already compacted and cannot be replayed'
                : 'Same requestId reused with different action or payload'
            ),
            snapshot: this._buildSnapshot(),
          };
        }
        return {
          ...receiptHit.response,
          snapshot: this._buildSnapshot(),
        };
      }
    }

    // 4. Version guard before mutating persisted state (storeId / baseRev)
    const isStateMutatingAction = action !== 'pick-project-directory' && action !== 'create-spark-box' && action !== 'pick-folder' && action !== 'reveal-folder';
    if (isStateMutatingAction) {
      const verErr = this._checkVersionGuard(envelope, { requireStore: true, requireBaseRev: true });
      if (verErr) {
        return { ok: false, rev: this._state.rev, error: verErr, snapshot: this._buildSnapshot() };
      }
    }

    const payload = envelope.payload || {};
    const catalog = this._getRuntimeCatalog();

    // 5. Unified commit helper for pure state-machine reduction actions
    const commitPureEvent = (eventObj, extraFacts = {}) => {
      const res = reduce(this._state, eventObj, { catalog, ...extraFacts });
      if (!res.ok) {
        return {
          ok: false,
          rev: this._state.rev,
          error: makeRpcError(res.error.code, res.error.message, res.error.retryable),
          snapshot: this._buildSnapshot(),
        };
      }
      const nextState = res.nextState === this._state ? cloneJson(this._state) : res.nextState;
      const response = { ok: true, rev: nextState.rev, result: res.result };
      if (requestId) {
        this._recordReceiptOnState(nextState, requestId, fingerprint, response);
      }
      if (res.nextState !== this._state || requestId) {
        try {
          this._saveStateAtomic(nextState);
        } catch (err) {
          return {
            ok: false,
            rev: this._state.rev,
            error: makeRpcError(ERROR_CODES.PERSISTENCE_FAILED, 'Failed persisting sidebar state', true),
            snapshot: this._buildSnapshot(),
          };
        }
        this._state = nextState;
      }
      return { ...response, snapshot: this._buildSnapshot() };
    };

    switch (action) {
      case 'switch-mode':
        return commitPureEvent({ type: 'switch-mode', to: payload.to, navRev: payload.navRev });

      case 'navigate':
        return commitPureEvent({
          type: 'navigate',
          mode: payload.mode,
          view: payload.view,
          navRev: payload.navRev,
        });

      case 'open-background-task':
        return commitPureEvent({
          type: 'open-background-task',
          targetMode: payload.targetMode,
          cascadeId: payload.cascadeId,
          navRev: payload.navRev,
        });

      case 'set-chat-draft':
        return commitPureEvent({
          type: 'set-chat-draft',
          draft: payload.draft,
          navRev: payload.navRev,
          draftRev: payload.draftRev,
        });

      case 'create-knowledge-folder':
        return commitPureEvent(
          { type: 'create-knowledge-folder', name: payload.name },
          { newId: randomId('kf', 6) }
        );

      case 'rename-knowledge-folder':
        return commitPureEvent({
          type: 'rename-knowledge-folder',
          folderId: payload.folderId,
          name: payload.name,
        });

      case 'set-knowledge-folder-collapsed':
        return commitPureEvent({
          type: 'set-knowledge-folder-collapsed',
          folderId: payload.folderId,
          collapsed: payload.collapsed,
        });

      case 'delete-knowledge-folder': {
        const childAction =
          payload.childAction === 'archive' || payload.childAction === 'delete' ? payload.childAction : 'move-to-root';
        const preview = reduce(
          this._state,
          { type: 'delete-knowledge-folder', folderId: payload.folderId, childAction },
          { catalog }
        );
        if (!preview.ok) {
          return {
            ok: false,
            rev: this._state.rev,
            error: makeRpcError(preview.error.code, preview.error.message, preview.error.retryable),
            snapshot: this._buildSnapshot(),
          };
        }
        if (childAction === 'archive' && Array.isArray(preview.result.archivedSessionIds)) {
          for (const cid of preview.result.archivedSessionIds) {
            if (typeof this.hostAdapter?.updateConversationAnnotations === 'function') {
              await this.hostAdapter.updateConversationAnnotations({ cascadeId: cid, annotations: { archived: true, pinned: false } }).catch(() => {});
            }
          }
        } else if (childAction === 'delete' && Array.isArray(preview.result.deletedSessionIds) && preview.result.deletedSessionIds.length > 0) {
          if (typeof this.hostAdapter?.deleteConversation !== 'function') {
            return {
              ok: false,
              rev: this._state.rev,
              error: makeRpcError(ERROR_CODES.CAPABILITY_UNAVAILABLE, 'Host conversation deletion capability unavailable'),
              snapshot: this._buildSnapshot(),
            };
          }
          for (const cid of preview.result.deletedSessionIds) {
            const delRes = await this.hostAdapter.deleteConversation({ cascadeId: cid });
            if (!delRes || delRes.ok !== true) {
              return {
                ok: false,
                rev: this._state.rev,
                error: makeRpcError(ERROR_CODES.CAPABILITY_UNAVAILABLE, `Failed deleting session ${cid}: ${delRes?.error || 'host rejected'}`),
                snapshot: this._buildSnapshot(),
              };
            }
          }
        }
        return commitPureEvent({
          type: 'delete-knowledge-folder',
          folderId: payload.folderId,
          childAction,
        });
      }

      case 'set-prefs': {
        const patch = isPlainObject(payload.patch) ? payload.patch : payload;
        // Strictly forbid writing legacy global permission snapshot fields in v2
        if (Object.prototype.hasOwnProperty.call(patch, 'savedCodePermissionSnapshot')) {
          return {
            ok: false,
            rev: this._state.rev,
            error: makeRpcError(
              ERROR_CODES.UNSUPPORTED_SCHEMA,
              'savedCodePermissionSnapshot is archived in v2 and cannot be written'
            ),
            snapshot: this._buildSnapshot(),
          };
        }
        return commitPureEvent({ type: 'set-prefs', patch });
      }

      case 'pick-project-directory': {
        const picked = await this._handlePickProjectDirectory(payload);
        if (!picked.ok) {
          return { ok: false, rev: this._state.rev, error: picked.error, snapshot: this._buildSnapshot() };
        }
        return { ok: true, rev: this._state.rev, result: picked.result, snapshot: this._buildSnapshot() };
      }

      case 'create-spark-box': {
        const created = await this._handleCreateSparkBox(payload);
        if (!created.ok) {
          return { ok: false, rev: this._state.rev, error: created.error, snapshot: this._buildSnapshot() };
        }
        const response = { ok: true, rev: this._state.rev, result: created.result };
        if (requestId) {
          const next = cloneJson(this._state);
          this._recordReceiptOnState(next, requestId, fingerprint, response);
          this._saveStateAtomic(next);
          this._state = next;
        }
        return { ...response, snapshot: this._buildSnapshot() };
      }

      case 'select-spark-project': {
        const tokenRec = this._consumeSelectionToken(payload.selectionToken);
        if (!tokenRec) {
          return {
            ok: false,
            rev: this._state.rev,
            error: makeRpcError(ERROR_CODES.INVALID_ARGUMENT, 'Invalid or expired selectionToken'),
            snapshot: this._buildSnapshot(),
          };
        }
        let realDir;
        try {
          realDir = fs.realpathSync(tokenRec.realPath);
          if (!fs.statSync(realDir).isDirectory()) {
            throw new Error('Target is not a directory');
          }
        } catch {
          return {
            ok: false,
            rev: this._state.rev,
            error: makeRpcError(ERROR_CODES.NOT_FOUND, 'Selected project directory no longer exists'),
            snapshot: this._buildSnapshot(),
          };
        }
        if (normalizePathForCompare(realDir) !== normalizePathForCompare(tokenRec.realPath) ||
            (this.sandboxMode && !isPathInsideDir(fs.realpathSync(this.sandboxRoot), realDir, false))) {
          return { ok: false, rev: this._state.rev, snapshot: this._buildSnapshot(),
            error: makeRpcError(ERROR_CODES.INVALID_ARGUMENT, 'Selected directory identity changed') };
        }
        const scopeRef = makeScopeRefFromPath(realDir);
        const displayName = tokenRec.displayName || path.basename(realDir) || 'Spark Project';
        const isSharedWithCode = Boolean(
          tokenRec.sharedWithCode ||
          this._state.projectScopes[scopeRef]?.sharedWithCode ||
          (this.hostAdapter && typeof this.hostAdapter.isPathSharedWithCode === 'function' && this.hostAdapter.isPathSharedWithCode(realDir))
        );
        const res = reduce(
          this._state,
          {
            type: 'select-spark-project',
            scopeRef,
            name: displayName,
            navRev: payload.navRev,
            draftRev: payload.draftRev,
          },
          { catalog, newId: randomId('sp', 6) }
        );
        if (!res.ok) {
          return {
            ok: false,
            rev: this._state.rev,
            error: makeRpcError(res.error.code, res.error.message, res.error.retryable),
            snapshot: this._buildSnapshot(),
          };
        }
        const nextState = res.nextState;
        if (!isPlainObject(nextState.projectScopes[scopeRef])) {
          // Reserve one slot for the fixed Knowledge scope; never evict permission evidence still requiring manual reconciliation.
          const maxScopes = LIMITS.MAX_PROJECT_SCOPES - (Object.hasOwn(nextState.projectScopes, KNOWLEDGE_SCOPE_REF) ? 0 : 1);
          if (Object.keys(nextState.projectScopes).length >= maxScopes) {
            const active = new Set(nextState.sparkProjects.map((project) => project.scopeRef));
            const reusable = Object.keys(nextState.projectScopes).find((ref) => ref !== KNOWLEDGE_SCOPE_REF && !active.has(ref) &&
              nextState.projectScopes[ref].permissionStatus === 'restored' && !nextState.projectScopes[ref].baseline);
            if (!reusable) return { ok: false, rev: this._state.rev, snapshot: this._buildSnapshot(),
              error: makeRpcError(ERROR_CODES.LIMIT_EXCEEDED, 'Project permission scope capacity reached') };
            delete nextState.projectScopes[reusable];
          }
          nextState.projectScopes[scopeRef] = {
            scopeRef,
            kind: 'spark',
            displayName,
            realPath: realDir,
            scopeGeneration: 1,
            permissionStatus: isSharedWithCode ? 'non-destructive-shared' : 'pending',
            degraded: false,
            sharedWithCode: isSharedWithCode,
            nonDestructive: isSharedWithCode,
            baseline: null,
            applied: null,
          };
        } else {
          nextState.projectScopes[scopeRef].displayName = displayName;
          nextState.projectScopes[scopeRef].realPath = realDir;
          if (isSharedWithCode) {
            nextState.projectScopes[scopeRef].sharedWithCode = true;
            nextState.projectScopes[scopeRef].nonDestructive = true;
            if (nextState.projectScopes[scopeRef].permissionStatus === 'pending') {
              nextState.projectScopes[scopeRef].permissionStatus = 'non-destructive-shared';
            }
          }
        }
        if (isSharedWithCode && this.hostAdapter && typeof this.hostAdapter.recordNonDestructiveSharedAudit === 'function') {
          this.hostAdapter.recordNonDestructiveSharedAudit(scopeRef, 'select-spark-project:shared-with-code');
        }
        const resultOut = {
          ...res.result,
          sharedWithCode: isSharedWithCode,
          nonDestructive: isSharedWithCode,
        };
        const response = { ok: true, rev: nextState.rev, result: resultOut };
        if (requestId) this._recordReceiptOnState(nextState, requestId, fingerprint, response);
        this._saveStateAtomic(nextState);
        this._state = nextState;
        return { ...response, snapshot: this._buildSnapshot() };
      }

      case 'set-spark-project-collapsed':
        return commitPureEvent({
          type: 'set-spark-project-collapsed',
          sparkProjectId: payload.sparkProjectId,
          collapsed: payload.collapsed,
        });

      case 'rename-spark-project':
        return commitPureEvent({
          type: 'rename-spark-project',
          sparkProjectId: payload.sparkProjectId,
          name: payload.name,
        });

      case 'reveal-spark-project': {
        if (this.sandboxMode) {
          return {
            ok: false,
            rev: this._state.rev,
            error: makeRpcError(ERROR_CODES.CAPABILITY_UNAVAILABLE, 'System folder reveal is disabled in sandboxMode'),
            snapshot: this._buildSnapshot(),
          };
        }
        const pid = payload.sparkProjectId;
        const proj = (this._state.sparkProjects || []).find((p) => p.id === pid);
        const realDir = proj ? this._state.projectScopes?.[proj.scopeRef]?.realPath : '';
        if (!proj || !realDir) {
          return {
            ok: false,
            rev: this._state.rev,
            error: makeRpcError(ERROR_CODES.NOT_FOUND, 'Spark project directory not found'),
            snapshot: this._buildSnapshot(),
          };
        }
        const revRes = await this.revealFolder({ path: realDir });
        return {
          ok: Boolean(revRes.ok),
          rev: this._state.rev,
          ...(revRes.ok ? { result: { revealed: true } } : { error: makeRpcError(ERROR_CODES.CAPABILITY_UNAVAILABLE, revRes.error || 'Reveal failed') }),
          snapshot: this._buildSnapshot(),
        };
      }

      case 'list-spark-files': {
        const pid = payload.sparkProjectId;
        const proj = (this._state.sparkProjects || []).find((p) => p.id === pid);
        const scopeRec = proj ? this._state.projectScopes?.[proj.scopeRef] : null;
        const realDir = scopeRec?.realPath || '';
        if (!proj || !scopeRec || !realDir) {
          return {
            ok: false,
            rev: this._state.rev,
            error: makeRpcError(ERROR_CODES.NOT_FOUND, 'Spark project directory not found'),
            snapshot: this._buildSnapshot(),
          };
        }
        if (!this._isScopeDirectoryCurrent(scopeRec)) {
          return {
            ok: false,
            rev: this._state.rev,
            error: makeRpcError(ERROR_CODES.PROJECT_SCOPE_CONFLICT, 'Spark project directory identity changed or is outside allowed root'),
            snapshot: this._buildSnapshot(),
          };
        }
        try {
          const verifiedDir = fs.realpathSync(realDir);
          if (
            normalizePathForCompare(verifiedDir) !== normalizePathForCompare(realDir) ||
            !fs.statSync(verifiedDir).isDirectory()
          ) {
            return {
              ok: false,
              rev: this._state.rev,
              error: makeRpcError(ERROR_CODES.PROJECT_SCOPE_CONFLICT, 'Spark project directory identity mismatch'),
              snapshot: this._buildSnapshot(),
            };
          }
          if (this.sandboxMode && !isPathInsideDir(fs.realpathSync(this.sandboxRoot), verifiedDir, false)) {
            return {
              ok: false,
              rev: this._state.rev,
              error: makeRpcError(ERROR_CODES.INVALID_ARGUMENT, 'Spark project directory escapes sandbox root'),
              snapshot: this._buildSnapshot(),
            };
          }
          const entries = fs.readdirSync(verifiedDir, { withFileTypes: true });
          const files = [];
          for (const ent of entries) {
            const nm = ent.name;
            if (!nm || nm.startsWith('.') || nm === 'node_modules' || nm === '__pycache__') continue;
            const ext = path.extname(nm).toLowerCase();
            if (ext === '.pem' || ext === '.key') continue;
            let size = 0;
            let updatedAt = 0;
            let isDir = ent.isDirectory();
            try {
              const full = path.join(verifiedDir, nm);
              const lst = fs.lstatSync(full);
              if (lst.isSymbolicLink()) continue;
              isDir = lst.isDirectory();
              size = isDir ? 0 : lst.size;
              updatedAt = Math.trunc(lst.mtimeMs || 0);
            } catch {
              continue;
            }
            files.push({ name: nm, isDir, size, updatedAt });
          }
          files.sort((a, b) => {
            if (a.isDir !== b.isDir) return a.isDir ? -1 : 1;
            return b.updatedAt - a.updatedAt || a.name.localeCompare(b.name);
          });
          return {
            ok: true,
            rev: this._state.rev,
            result: {
              sparkProjectId: pid,
              projectName: proj.name,
              totalCount: files.length,
              files: files.slice(0, 40),
            },
            snapshot: this._buildSnapshot(),
          };
        } catch {
          return {
            ok: false,
            rev: this._state.rev,
            error: makeRpcError(ERROR_CODES.NOT_FOUND, 'Unable to read Spark project directory'),
            snapshot: this._buildSnapshot(),
          };
        }
      }

      case 'import-spark-file': {
        const pid = payload.sparkProjectId;
        const proj = (this._state.sparkProjects || []).find((p) => p.id === pid);
        const scopeRec = proj ? this._state.projectScopes?.[proj.scopeRef] : null;
        const realDir = scopeRec?.realPath || '';
        if (!proj || !scopeRec || !realDir) {
          return {
            ok: false,
            rev: this._state.rev,
            error: makeRpcError(ERROR_CODES.NOT_FOUND, 'Spark project directory not found'),
            snapshot: this._buildSnapshot(),
          };
        }
        if (!this._isScopeDirectoryCurrent(scopeRec)) {
          return {
            ok: false,
            rev: this._state.rev,
            error: makeRpcError(ERROR_CODES.PROJECT_SCOPE_CONFLICT, 'Spark project directory identity changed or is outside allowed root'),
            snapshot: this._buildSnapshot(),
          };
        }
        const rawFileName = typeof payload.fileName === 'string' ? payload.fileName.trim() : '';
        const nameCheck = validateSparkBoxName(rawFileName);
        if (!nameCheck.ok) {
          return {
            ok: false,
            rev: this._state.rev,
            error: makeRpcError(ERROR_CODES.INVALID_ARGUMENT, nameCheck.error || 'Invalid file name'),
            snapshot: this._buildSnapshot(),
          };
        }
        const safeName = nameCheck.name;
        const ext = path.extname(safeName).toLowerCase();
        if (BLOCKED_SPARK_IMPORT_EXTS.has(ext) || safeName.toLowerCase().startsWith('.env')) {
          return {
            ok: false,
            rev: this._state.rev,
            error: makeRpcError(ERROR_CODES.INVALID_ARGUMENT, `Blocked unsafe file type: ${ext || safeName}`),
            snapshot: this._buildSnapshot(),
          };
        }
        if (typeof payload.base64Data !== 'string') {
          return {
            ok: false,
            rev: this._state.rev,
            error: makeRpcError(ERROR_CODES.INVALID_ARGUMENT, 'base64Data must be a base64 string'),
            snapshot: this._buildSnapshot(),
          };
        }
        // Pre-validate Base64 length limit, valid charset, and decoded size before Buffer.from to prevent memory amplification and malformed encoding
        const rawB64 = payload.base64Data.trim();
        if (rawB64.length > MAX_SPARK_IMPORT_BASE64_CHARS) {
          return {
            ok: false,
            rev: this._state.rev,
            error: makeRpcError(ERROR_CODES.LIMIT_EXCEEDED, 'Imported file base64 payload exceeds 8 MB limit'),
            snapshot: this._buildSnapshot(),
          };
        }
        if (rawB64.length % 4 !== 0 || !/^[A-Za-z0-9+/]*={0,2}$/.test(rawB64)) {
          return {
            ok: false,
            rev: this._state.rev,
            error: makeRpcError(ERROR_CODES.INVALID_ARGUMENT, 'base64Data contains invalid base64 characters or padding'),
            snapshot: this._buildSnapshot(),
          };
        }
        const padLen = rawB64.endsWith('==') ? 2 : rawB64.endsWith('=') ? 1 : 0;
        const estimatedBytes = rawB64.length === 0 ? 0 : (rawB64.length / 4) * 3 - padLen;
        if (estimatedBytes > MAX_SPARK_IMPORT_FILE_BYTES) {
          return {
            ok: false,
            rev: this._state.rev,
            error: makeRpcError(ERROR_CODES.LIMIT_EXCEEDED, 'Imported file exceeds 8 MB limit'),
            snapshot: this._buildSnapshot(),
          };
        }
        const buf = Buffer.from(rawB64, 'base64');
        if (buf.length > MAX_SPARK_IMPORT_FILE_BYTES) {
          return {
            ok: false,
            rev: this._state.rev,
            error: makeRpcError(ERROR_CODES.LIMIT_EXCEEDED, 'Imported file exceeds 8 MB limit'),
            snapshot: this._buildSnapshot(),
          };
        }
        let tmpPath = '';
        let tmpCreated = false;
        let renamed = false;
        try {
          const verifiedDir = fs.realpathSync(realDir);
          if (
            normalizePathForCompare(verifiedDir) !== normalizePathForCompare(realDir) ||
            !fs.statSync(verifiedDir).isDirectory()
          ) {
            return {
              ok: false,
              rev: this._state.rev,
              error: makeRpcError(ERROR_CODES.PROJECT_SCOPE_CONFLICT, 'Spark project directory identity mismatch'),
              snapshot: this._buildSnapshot(),
            };
          }
          if (this.sandboxMode && !isPathInsideDir(fs.realpathSync(this.sandboxRoot), verifiedDir, false)) {
            return {
              ok: false,
              rev: this._state.rev,
              error: makeRpcError(ERROR_CODES.INVALID_ARGUMENT, 'Spark project directory escapes sandbox root'),
              snapshot: this._buildSnapshot(),
            };
          }
          const stem = ext ? safeName.slice(0, safeName.length - ext.length) : safeName;
          const pickTarget = () => {
            for (let attempt = 0; attempt < 50; attempt++) {
              let candidate = safeName;
              if (attempt > 0) {
                const suffix = `-${attempt + 1}`;
                const maxStemLen = MAX_BOX_NAME_LEN - suffix.length - ext.length;
                const trimmedStem = maxStemLen > 0 ? stem.slice(0, maxStemLen).replace(/[. ]+$/, '') : '';
                candidate = `${trimmedStem || 'file'}${suffix}${ext}`;
              }
              if (!validateSparkBoxName(candidate).ok) continue;
              const full = path.join(verifiedDir, candidate);
              if (!isPathInsideDir(verifiedDir, full, false)) {
                return { escaped: true };
              }
              try {
                fs.lstatSync(full);
                continue;
              } catch (statErr) {
                if (statErr && statErr.code === 'ENOENT') {
                  return { candidate, full };
                }
                throw statErr;
              }
            }
            return null;
          };

          const target = pickTarget();
          if (target && target.escaped) {
            return {
              ok: false,
              rev: this._state.rev,
              error: makeRpcError(ERROR_CODES.INVALID_ARGUMENT, 'Target path escapes Spark workspace'),
              snapshot: this._buildSnapshot(),
            };
          }
          if (!target) {
            return {
              ok: false,
              rev: this._state.rev,
              error: makeRpcError(ERROR_CODES.LIMIT_EXCEEDED, 'Too many conflicting file names in folder'),
              snapshot: this._buildSnapshot(),
            };
          }

          tmpPath = path.join(verifiedDir, `.ag-spark-import-${process.pid}-${crypto.randomBytes(6).toString('hex')}.tmp`);
          if (!isPathInsideDir(verifiedDir, tmpPath, false)) {
            return {
              ok: false,
              rev: this._state.rev,
              error: makeRpcError(ERROR_CODES.INVALID_ARGUMENT, 'Temporary path escapes Spark workspace'),
              snapshot: this._buildSnapshot(),
            };
          }
          const fd = fs.openSync(tmpPath, 'wx', 0o600);
          tmpCreated = true;
          try {
            fs.writeFileSync(fd, buf);
            fs.fsyncSync(fd);
          } finally {
            fs.closeSync(fd);
          }

          if (!this._isScopeDirectoryCurrent(scopeRec)) {
            return {
              ok: false,
              rev: this._state.rev,
              error: makeRpcError(ERROR_CODES.PROJECT_SCOPE_CONFLICT, 'Spark project directory changed during import'),
              snapshot: this._buildSnapshot(),
            };
          }
          let finalTarget = target;
          try {
            fs.lstatSync(finalTarget.full);
            finalTarget = pickTarget();
          } catch (statErr) {
            if (!statErr || statErr.code !== 'ENOENT') throw statErr;
          }
          if (!finalTarget || finalTarget.escaped) {
            return {
              ok: false,
              rev: this._state.rev,
              error: makeRpcError(
                finalTarget?.escaped ? ERROR_CODES.INVALID_ARGUMENT : ERROR_CODES.LIMIT_EXCEEDED,
                finalTarget?.escaped ? 'Target path escapes Spark workspace' : 'Too many conflicting file names in folder'
              ),
              snapshot: this._buildSnapshot(),
            };
          }
          fs.renameSync(tmpPath, finalTarget.full);
          renamed = true;
          return {
            ok: true,
            rev: this._state.rev,
            result: {
              sparkProjectId: pid,
              fileName: finalTarget.candidate,
              size: buf.length,
            },
            snapshot: this._buildSnapshot(),
          };
        } catch (err) {
          return {
            ok: false,
            rev: this._state.rev,
            error: makeRpcError(ERROR_CODES.PERSISTENCE_FAILED, String(err?.message || 'Failed to import file')),
            snapshot: this._buildSnapshot(),
          };
        } finally {
          if (tmpCreated && !renamed && tmpPath) {
            try { fs.unlinkSync(tmpPath); } catch {}
          }
        }
      }

      case 'unlink-spark-project': {
        const pid = payload.sparkProjectId;
        const childAction =
          payload.childAction === 'archive' || payload.childAction === 'delete' ? payload.childAction : 'unbind';
        const preview = reduce(
          this._state,
          { type: 'unlink-spark-project', sparkProjectId: pid, childAction },
          { catalog }
        );
        if (!preview.ok) {
          return {
            ok: false,
            rev: this._state.rev,
            error: makeRpcError(preview.error.code, preview.error.message, preview.error.retryable),
            snapshot: this._buildSnapshot(),
          };
        }

        if (childAction === 'archive' && Array.isArray(preview.result.archivedSessionIds)) {
          for (const cid of preview.result.archivedSessionIds) {
            if (typeof this.hostAdapter?.updateConversationAnnotations === 'function') {
              await this.hostAdapter.updateConversationAnnotations({ cascadeId: cid, annotations: { archived: true, pinned: false } }).catch(() => {});
            }
          }
        } else if (childAction === 'delete' && Array.isArray(preview.result.deletedSessionIds) && preview.result.deletedSessionIds.length > 0) {
          if (typeof this.hostAdapter?.deleteConversation !== 'function') {
            return {
              ok: false,
              rev: this._state.rev,
              error: makeRpcError(ERROR_CODES.CAPABILITY_UNAVAILABLE, 'Host conversation deletion capability unavailable'),
              snapshot: this._buildSnapshot(),
            };
          }
          for (const cid of preview.result.deletedSessionIds) {
            const delRes = await this.hostAdapter.deleteConversation({ cascadeId: cid });
            if (!delRes || delRes.ok !== true) {
              return {
                ok: false,
                rev: this._state.rev,
                error: makeRpcError(ERROR_CODES.CAPABILITY_UNAVAILABLE, `Failed deleting session ${cid}: ${delRes?.error || 'host rejected'}`),
                snapshot: this._buildSnapshot(),
              };
            }
          }
        }

        const scopeRef = preview.result.scopeRef;
        const scopeRec = this._state.projectScopes?.[scopeRef] || null;
        const opId = randomId('op', 6);
        const now = this._now();
        const nextState = preview.nextState;
        // Check capacity before any host writes so we never persist a state that cannot be loaded next time.
        nextState.operations[opId] = { status: 'pending', updatedAt: now };
        this._pruneOperations(nextState);
        if (Object.keys(nextState.operations).length > LIMITS.MAX_OPERATIONS) {
          return { ok: false, rev: this._state.rev, snapshot: this._buildSnapshot(),
            error: makeRpcError(ERROR_CODES.LIMIT_EXCEEDED, 'Sidebar operation capacity reached') };
        }

        let restoreOutcome = { ok: true, status: 'skipped' };
        const hasAppliedKeys = Boolean(scopeRec && isPlainObject(scopeRec.applied) && Object.keys(scopeRec.applied).length > 0);
        const isNonDestructiveScope = Boolean(
          preview.result.skippedPermissionRestore ||
          (scopeRec?.nonDestructive === true && !hasAppliedKeys) ||
          (scopeRec?.realPath && this.hostAdapter?.isPathSharedWithCode?.(scopeRec.realPath))
        );
        if (isNonDestructiveScope) {
          restoreOutcome = { ok: true, status: 'skipped-non-destructive' };
        } else if (!scopeRec || hasAppliedKeys || scopeRec.permissionStatus !== 'pending') {
          if (scopeRec?.realPath && typeof this.hostAdapter?.registerScopePath === 'function') {
            this.hostAdapter.registerScopePath(scopeRef, scopeRec.realPath);
          }
          const psp = this.hostAdapter?.getProjectSettingsProvider?.();
          restoreOutcome = await restoreProjectPermissionBaseline({
            scopeRef,
            projectSettingsProvider: psp,
            baseline: scopeRec?.baseline,
            applied: scopeRec?.applied,
            scopeControlled: Boolean(this._isScopeDirectoryCurrent(scopeRec) &&
              (scopeRec.permissionStatus === 'degraded' ||
                (scopeRec.permissionStatus === 'applied' && Object.hasOwn(scopeRec.applied ?? {}, 'sandboxMode'))) &&
              this.hostAdapter?.isScopeIsolated?.(scopeRef, { sharedWithCode: false }) === true),
            beforeWrite: () => {
              const staged = cloneJson(this._state);
              staged.projectScopes[scopeRef].permissionStatus = 'restoring';
              this._saveStateAtomic(staged);
              this._state = staged;
            },
          });
        }
        const restoreNeedsReconciliation = !restoreOutcome.ok && restoreOutcome.status === 'needs-reconciliation';
        if (nextState.projectScopes?.[scopeRef]) {
          nextState.projectScopes[scopeRef].scopeGeneration = (nextState.projectScopes[scopeRef].scopeGeneration || 1) + 1;
          nextState.projectScopes[scopeRef].permissionStatus = restoreNeedsReconciliation ? 'needs-reconciliation' : 'restored';
          if (restoreOutcome.ok) {
            nextState.projectScopes[scopeRef].baseline = null;
            nextState.projectScopes[scopeRef].applied = null;
            if (isNonDestructiveScope) nextState.projectScopes[scopeRef].sharedWithCode = true;
          }
        }

        const publicResult = {
          operationId: opId,
          status: restoreNeedsReconciliation ? 'needs-reconciliation' : 'succeeded',
          unlinkedProjectId: pid,
          childAction,
          movedSessionIds: preview.result.movedSessionIds,
          archivedSessionIds: preview.result.archivedSessionIds || [],
          deletedSessionIds: preview.result.deletedSessionIds || [],
          draftReset: preview.result.draftReset,
          navigatedFallback: Boolean(preview.result.navigatedFallback),
          view: preview.result.view,
          permissionRestoreStatus: restoreOutcome.status,
        };
        nextState.operations[opId] = {
          operationId: opId,
          kind: 'unlink-spark-project',
          sparkProjectId: pid,
          scopeRef,
          status: publicResult.status,
          phase: restoreNeedsReconciliation ? 'permission-restore-reconcile' : 'completed',
          createdAt: now,
          updatedAt: now,
          publicResult,
          ...(restoreOutcome.error ? { error: restoreOutcome.error } : {}),
        };
        this._pruneOperations(nextState);

        const response = { ok: true, rev: nextState.rev, result: publicResult };
        if (requestId) this._recordReceiptOnState(nextState, requestId, fingerprint, response);
        this._saveStateAtomic(nextState);
        this._state = nextState;
        return { ...response, snapshot: this._buildSnapshot() };
      }

      case 'move-chat-session': {
        const cid = payload.cascadeId;
        if (!isSafeIdentifier(cid)) {
          return {
            ok: false,
            rev: this._state.rev,
            error: makeRpcError(ERROR_CODES.INVALID_ARGUMENT, 'Invalid cascadeId'),
            snapshot: this._buildSnapshot(),
          };
        }
        const existing = this._state.assignments?.[cid];
        if (!existing || existing.mode !== 'chat') {
          return {
            ok: false,
            rev: this._state.rev,
            error: makeRpcError(ERROR_CODES.NOT_FOUND, 'Chat session assignment not found'),
            snapshot: this._buildSnapshot(),
          };
        }
        let targetPlacement = payload.placement;
        if (!targetPlacement) {
          if (payload.sparkProjectId !== undefined && payload.sparkProjectId !== null) {
            targetPlacement = { kind: 'spark', sparkProjectId: payload.sparkProjectId };
          } else if (payload.folderId !== undefined) {
            targetPlacement = { kind: 'knowledge', folderId: payload.folderId };
          } else {
            targetPlacement = { kind: 'knowledge', folderId: null };
          }
        }
        const prev = existing.placement;
        const crossProjectMove =
          !prev ||
          prev.kind !== targetPlacement.kind ||
          (targetPlacement.kind === 'spark' && prev.sparkProjectId !== targetPlacement.sparkProjectId);

        // Cross-project/cross-kind moves require host idle & rebind capability verification; reorganizing subfolders within Knowledge commits atomically without blocking running state
        if (crossProjectMove && this.hostAdapter && typeof this.hostAdapter.validateSessionRebind === 'function') {
          const rebindCheck = await this.hostAdapter.validateSessionRebind({
            cascadeId: cid,
            placement: targetPlacement,
          });
          if (!rebindCheck.ok) {
            return {
              ok: false,
              rev: this._state.rev,
              error: makeRpcError(rebindCheck.code || ERROR_CODES.CAPABILITY_UNAVAILABLE, rebindCheck.message),
              snapshot: this._buildSnapshot(),
            };
          }
        }
        return commitPureEvent({
          type: 'move-chat-session',
          cascadeId: cid,
          placement: payload.placement,
          folderId: payload.folderId,
          sparkProjectId: payload.sparkProjectId,
        });
      }

      case 'pin-chat-session': {
        const cid = payload.cascadeId;
        const pinned = Boolean(payload.pinned);
        const preview = reduce(this._state, { type: 'pin-chat-session', cascadeId: cid, pinned }, { catalog });
        if (!preview.ok) {
          return {
            ok: false,
            rev: this._state.rev,
            error: makeRpcError(preview.error.code, preview.error.message, preview.error.retryable),
            snapshot: this._buildSnapshot(),
          };
        }
        if (typeof this.hostAdapter?.updateConversationAnnotations === 'function') {
          await this.hostAdapter.updateConversationAnnotations({ cascadeId: cid, annotations: { pinned } }).catch(() => {});
        }
        return commitPureEvent({ type: 'pin-chat-session', cascadeId: cid, pinned });
      }

      case 'rename-chat-session': {
        const cid = payload.cascadeId;
        const title = typeof payload.title === 'string' ? payload.title.trim() : '';
        const preview = reduce(this._state, { type: 'rename-chat-session', cascadeId: cid, title }, { catalog });
        if (!preview.ok) {
          return {
            ok: false,
            rev: this._state.rev,
            error: makeRpcError(preview.error.code, preview.error.message, preview.error.retryable),
            snapshot: this._buildSnapshot(),
          };
        }
        if (typeof this.hostAdapter?.updateConversationAnnotations === 'function') {
          await this.hostAdapter.updateConversationAnnotations({ cascadeId: cid, annotations: { title } }).catch(() => {});
        }
        return commitPureEvent({ type: 'rename-chat-session', cascadeId: cid, title });
      }

      case 'archive-chat-session': {
        const cid = payload.cascadeId;
        const archived = payload.archived !== false;
        const preview = reduce(this._state, { type: 'archive-chat-session', cascadeId: cid, archived }, { catalog });
        if (!preview.ok) {
          return {
            ok: false,
            rev: this._state.rev,
            error: makeRpcError(preview.error.code, preview.error.message, preview.error.retryable),
            snapshot: this._buildSnapshot(),
          };
        }
        if (typeof this.hostAdapter?.updateConversationAnnotations === 'function') {
          await this.hostAdapter
            .updateConversationAnnotations({ cascadeId: cid, annotations: { archived, ...(archived ? { pinned: false } : {}) } })
            .catch(() => {});
        }
        return commitPureEvent({ type: 'archive-chat-session', cascadeId: cid, archived });
      }

      case 'delete-chat-session': {
        const cid = payload.cascadeId;
        const preview = reduce(this._state, { type: 'delete-chat-session', cascadeId: cid }, { catalog });
        if (!preview.ok) {
          return {
            ok: false,
            rev: this._state.rev,
            error: makeRpcError(preview.error.code, preview.error.message, preview.error.retryable),
            snapshot: this._buildSnapshot(),
          };
        }
        if (typeof this.hostAdapter?.deleteConversation === 'function') {
          const delRes = await this.hostAdapter.deleteConversation({ cascadeId: cid });
          if (!delRes || delRes.ok !== true) {
            return {
              ok: false,
              rev: this._state.rev,
              error: makeRpcError(ERROR_CODES.CAPABILITY_UNAVAILABLE, delRes?.error || 'Failed to delete conversation in host'),
              snapshot: this._buildSnapshot(),
            };
          }
        }
        return commitPureEvent({ type: 'delete-chat-session', cascadeId: cid });
      }

      case 'batch-chat-sessions': {
        const rawIds = Array.isArray(payload.cascadeIds) ? payload.cascadeIds : [];
        const op = payload.op;
        if (!['move', 'archive', 'delete'].includes(op) || rawIds.length === 0 || rawIds.length > 100) {
          return {
            ok: false,
            rev: this._state.rev,
            error: makeRpcError(ERROR_CODES.INVALID_ARGUMENT, 'Invalid batch-chat-sessions arguments'),
            snapshot: this._buildSnapshot(),
          };
        }
        const uniqueIds = [];
        const seen = new Set();
        for (const rawId of rawIds) {
          if (typeof rawId !== 'string' || !isSafeIdentifier(rawId) || seen.has(rawId)) continue;
          seen.add(rawId);
          uniqueIds.push(rawId);
        }
        if (uniqueIds.length === 0) {
          return {
            ok: false,
            rev: this._state.rev,
            error: makeRpcError(ERROR_CODES.INVALID_ARGUMENT, 'No valid cascadeIds provided for batch-chat-sessions'),
            snapshot: this._buildSnapshot(),
          };
        }
        const catalogHealth = catalog && typeof catalog.health === 'string' ? catalog.health : 'loading';
        const catById = new Map();
        if (catalog && Array.isArray(catalog.items)) {
          for (const it of catalog.items) {
            if (!it || typeof it.cascadeId !== 'string') continue;
            const updatedAt = Number.isFinite(Number(it.updatedAt)) ? Number(it.updatedAt) : 0;
            const prev = catById.get(it.cascadeId);
            if (prev && prev.updatedAt > updatedAt) continue;
            catById.set(it.cascadeId, { status: it.status || 'idle', updatedAt });
          }
        }
        const lastKnownById = catalog && isPlainObject(catalog.lastKnownById) ? catalog.lastKnownById : {};
        const succeededIds = [];
        const skippedIds = [];
        const failedIds = [];
        let workingState = this._state;
        let navigatedFallback = false;

        for (const cid of uniqueIds) {
          const assignment = workingState.assignments?.[cid];
          if (!assignment || assignment.mode !== 'chat') {
            skippedIds.push(cid);
            continue;
          }
          const liveEntry = catById.get(cid);
          const knownEntry = isPlainObject(lastKnownById[cid]) ? lastKnownById[cid] : null;
          if (op === 'archive' || op === 'delete') {
            if (catalogHealth !== 'ready' || !liveEntry) {
              skippedIds.push(cid);
              continue;
            }
            const liveSt = liveEntry.status;
            const knownSt = knownEntry ? knownEntry.status : null;
            if (liveSt === 'running' || liveSt === 'blocked' || knownSt === 'running' || knownSt === 'blocked') {
              skippedIds.push(cid);
              continue;
            }
          }
          let event;
          if (op === 'move') {
            const folderId = payload.folderId === null || payload.folderId === undefined ? null : payload.folderId;
            event = { type: 'move-chat-session', cascadeId: cid, placement: { kind: 'knowledge', folderId } };
          } else if (op === 'archive') {
            event = { type: 'archive-chat-session', cascadeId: cid, archived: payload.archived !== false };
          } else {
            event = { type: 'delete-chat-session', cascadeId: cid };
          }
          const preview = reduce(workingState, event, { catalog });
          if (!preview.ok) {
            skippedIds.push(cid);
            continue;
          }
          if (op === 'archive' && typeof this.hostAdapter?.updateConversationAnnotations === 'function') {
            const arch = payload.archived !== false;
            let archRes = null;
            try {
              archRes = await this.hostAdapter.updateConversationAnnotations({
                cascadeId: cid,
                annotations: { archived: arch, ...(arch ? { pinned: false } : {}) },
              });
            } catch {
              archRes = null;
            }
            if (!archRes || archRes.ok !== true) {
              failedIds.push(cid);
              continue;
            }
          }
          if (op === 'delete' && typeof this.hostAdapter?.deleteConversation === 'function') {
            let delRes = null;
            try {
              delRes = await this.hostAdapter.deleteConversation({ cascadeId: cid });
            } catch {
              delRes = null;
            }
            if (!delRes || delRes.ok !== true) {
              failedIds.push(cid);
              continue;
            }
          }
          workingState = preview.nextState;
          if (preview.result?.navigatedFallback) navigatedFallback = true;
          succeededIds.push(cid);
        }

        if (succeededIds.length > 0) {
          const response = {
            ok: true,
            rev: workingState.rev,
            result: { op, succeededIds, skippedIds, failedIds, navigatedFallback },
          };
          if (requestId) {
            this._recordReceiptOnState(workingState, requestId, fingerprint, response);
          }
          try {
            this._saveStateAtomic(workingState);
            this._state = workingState;
          } catch (err) {
            return {
              ok: false,
              rev: this._state.rev,
              error: makeRpcError(ERROR_CODES.PERSISTENCE_FAILED, String(err?.message || 'Atomic save failed'), true),
              snapshot: this._buildSnapshot(),
            };
          }
          return { ...response, snapshot: this._buildSnapshot() };
        }
        if (failedIds.length > 0) {
          return {
            ok: false,
            rev: this._state.rev,
            error: makeRpcError(
              ERROR_CODES.CAPABILITY_UNAVAILABLE,
              `Batch ${op} failed in host for ${failedIds.length} session(s)`,
              true
            ),
            result: { op, succeededIds: [], skippedIds, failedIds, navigatedFallback: false },
            snapshot: this._buildSnapshot(),
          };
        }
        const skippedResponse = {
          ok: true,
          rev: this._state.rev,
          result: { op, succeededIds: [], skippedIds, failedIds: [], navigatedFallback: false },
        };
        if (requestId) {
          const nextState = cloneJson(this._state);
          this._recordReceiptOnState(nextState, requestId, fingerprint, skippedResponse);
          try {
            this._saveStateAtomic(nextState);
            this._state = nextState;
          } catch (err) {
            return {
              ok: false,
              rev: this._state.rev,
              error: makeRpcError(ERROR_CODES.PERSISTENCE_FAILED, String(err?.message || 'Atomic save failed'), true),
              snapshot: this._buildSnapshot(),
            };
          }
        }
        return {
          ...skippedResponse,
          snapshot: this._buildSnapshot(),
        };
      }

      case 'cancel-chat-session': {
        const cid = payload.cascadeId;
        if (!isSafeIdentifier(cid) || !this._state.assignments?.[cid]) {
          return {
            ok: false,
            rev: this._state.rev,
            error: makeRpcError(ERROR_CODES.NOT_FOUND, 'Chat session not found'),
            snapshot: this._buildSnapshot(),
          };
        }
        if (typeof this.hostAdapter?.cancelConversation !== 'function') {
          return {
            ok: false,
            rev: this._state.rev,
            error: makeRpcError(ERROR_CODES.CAPABILITY_UNAVAILABLE, 'Cancel capability unavailable'),
            snapshot: this._buildSnapshot(),
          };
        }
        const cancelRes = await this.hostAdapter.cancelConversation({ cascadeId: cid });
        return {
          ok: Boolean(cancelRes && cancelRes.ok),
          rev: this._state.rev,
          ...(cancelRes && cancelRes.ok
            ? { result: { cascadeId: cid, cancelled: true } }
            : { error: makeRpcError(ERROR_CODES.CAPABILITY_UNAVAILABLE, cancelRes?.error || 'Cancel failed') }),
          snapshot: this._buildSnapshot(),
        };
      }

      case 'resume-chat-session': {
        const cid = payload.cascadeId;
        if (!isSafeIdentifier(cid)) {
          return {
            ok: false,
            rev: this._state.rev,
            error: makeRpcError(ERROR_CODES.INVALID_ARGUMENT, 'Invalid cascadeId'),
            snapshot: this._buildSnapshot(),
          };
        }
        const assign = this._state.assignments?.[cid];
        if (!assign) {
          return {
            ok: false,
            rev: this._state.rev,
            error: makeRpcError(ERROR_CODES.NOT_FOUND, 'Chat session assignment not found'),
            snapshot: this._buildSnapshot(),
          };
        }
        if (!this.hostAdapter || typeof this.hostAdapter.validateSessionRebind !== 'function' ||
            typeof this.hostAdapter.rebindSession !== 'function') {
          return {
            ok: false,
            rev: this._state.rev,
            error: makeRpcError(ERROR_CODES.CAPABILITY_UNAVAILABLE, 'Host session rebind capability is unavailable'),
            snapshot: this._buildSnapshot(),
          };
        }
        const rebindCheck = await this.hostAdapter.validateSessionRebind({ cascadeId: cid, placement: assign.placement });
        if (!rebindCheck.ok) {
          return {
            ok: false,
            rev: this._state.rev,
            error: makeRpcError(rebindCheck.code || ERROR_CODES.CAPABILITY_UNAVAILABLE, rebindCheck.message),
            snapshot: this._buildSnapshot(),
          };
        }

        // Derive target scope from committed ownership and verify project-level permissions
        let targetScopeRef = KNOWLEDGE_SCOPE_REF;
        if (assign.placement.kind === 'knowledge') {
          this._ensureKnowledgeScopeRecord(this._state);
        } else {
          const proj = (this._state.sparkProjects || []).find((p) => p.id === assign.placement.sparkProjectId);
          if (!proj) {
            return {
              ok: false,
              rev: this._state.rev,
              error: makeRpcError(ERROR_CODES.NOT_FOUND, 'Target spark project not found'),
              snapshot: this._buildSnapshot(),
            };
          }
          targetScopeRef = proj.scopeRef;
        }
        const psp = typeof this.hostAdapter.getProjectSettingsProvider === 'function'
          ? this.hostAdapter.getProjectSettingsProvider()
          : null;
        const caps = this._getRuntimeCapabilities();
        const targetScopeRec = this._state.projectScopes?.[targetScopeRef] || null;
        if (!this._isScopeDirectoryCurrent(targetScopeRec) ||
            ['needs-reconciliation', 'applying', 'restoring'].includes(targetScopeRec.permissionStatus)) {
          return { ok: false, rev: this._state.rev, snapshot: this._buildSnapshot(),
            error: makeRpcError(ERROR_CODES.NEEDS_RECONCILIATION, 'Target scope must be reconciled before rebind') };
        }
        const isSharedWithCode = Boolean(
          targetScopeRec &&
          (targetScopeRec.sharedWithCode ||
            (typeof this.hostAdapter.isPathSharedWithCode === 'function' &&
              targetScopeRec.realPath &&
              this.hostAdapter.isPathSharedWithCode(targetScopeRec.realPath)))
        );
        const scopeIsolated = typeof this.hostAdapter.isScopeIsolated === 'function'
          ? this.hostAdapter.isScopeIsolated(targetScopeRef, { sharedWithCode: isSharedWithCode, wslIsolated: false })
          : false;
        const permRes = await applyProjectPermissionIsolation({
          kind: assign.placement.kind,
          scopeRef: targetScopeRef,
          projectSettingsProvider: psp,
          scopeIsolated,
          sharedWithCode: isSharedWithCode,
          allowSharedNonDestructive: isSharedWithCode,
          sandboxAvailable: Boolean(caps.sandboxAvailable),
          beforeWrite: (baseline) => {
            targetScopeRec.baseline ??= baseline;
            targetScopeRec.permissionStatus = 'applying';
            this._saveStateAtomic(this._state);
          },
        });
        if (!permRes.ok) {
          if (permRes.status === 'needs-reconciliation') {
            targetScopeRec.permissionStatus = 'needs-reconciliation';
            if (!targetScopeRec.baseline && permRes.baseline) targetScopeRec.baseline = permRes.baseline;
            if (permRes.applied) targetScopeRec.applied = { ...targetScopeRec.applied, ...permRes.applied };
            this._saveStateAtomic(this._state);
          }
          return {
            ok: false,
            rev: this._state.rev,
            error: makeRpcError(permRes.error.code, permRes.error.message, permRes.error.retryable),
            snapshot: this._buildSnapshot(),
          };
        }
        const isNonDestructiveShared = permRes.status === 'non-destructive-shared';
        if (isNonDestructiveShared && typeof this.hostAdapter.recordNonDestructiveSharedAudit === 'function') {
          this.hostAdapter.recordNonDestructiveSharedAudit(targetScopeRef, 'resume-chat-session:shared-with-code');
        }
        if (this._state.projectScopes[targetScopeRef]) {
          if (isNonDestructiveShared) {
            this._state.projectScopes[targetScopeRef].sharedWithCode = true;
            this._state.projectScopes[targetScopeRef].nonDestructive = true;
            this._state.projectScopes[targetScopeRef].degraded = false;
            this._state.projectScopes[targetScopeRef].applied = {};
            this._state.projectScopes[targetScopeRef].permissionStatus = 'non-destructive-shared';
          } else {
            if (!this._state.projectScopes[targetScopeRef].baseline) {
              this._state.projectScopes[targetScopeRef].baseline = permRes.baseline;
            }
            this._state.projectScopes[targetScopeRef].applied = permRes.applied;
            this._state.projectScopes[targetScopeRef].degraded = Boolean(permRes.degraded);
            this._state.projectScopes[targetScopeRef].permissionStatus = permRes.degraded ? 'degraded' : 'applied';
          }
        }
        let rebound;
        try {
          rebound = await this.hostAdapter.rebindSession({ cascadeId: cid, scopeRef: targetScopeRef, placement: assign.placement });
        } catch {
          // Do not mark an unconfirmed host rebind as ready to continue.
        }
        if (rebound?.ok !== true || rebound.cascadeId !== cid || rebound.scopeRef !== targetScopeRef) {
          this._saveStateAtomic(this._state);
          return { ok: false, rev: this._state.rev, snapshot: this._buildSnapshot(),
            error: makeRpcError(ERROR_CODES.NEEDS_RECONCILIATION, 'Host did not confirm the target session binding') };
        }
        return commitPureEvent({ type: 'resume-chat-session', cascadeId: cid });
      }

      case 'send-chat-first': {
        const message = typeof payload.message === 'string' ? payload.message.trim() : '';
        if (!message || message.length > LIMITS.MAX_MESSAGE_LEN) {
          return {
            ok: false,
            rev: this._state.rev,
            error: makeRpcError(ERROR_CODES.INVALID_ARGUMENT, 'Message must be a non-empty string within length limit'),
            snapshot: this._buildSnapshot(),
          };
        }

        // Allow resubmitting the original message to reuse a needs-input operation after restart
        if (payload.resumeOperationId !== undefined) {
          const resumeId = payload.resumeOperationId;
          if (!isSafeIdentifier(resumeId)) {
            return {
              ok: false,
              rev: this._state.rev,
              error: makeRpcError(ERROR_CODES.INVALID_ARGUMENT, 'Invalid resumeOperationId'),
              snapshot: this._buildSnapshot(),
            };
          }
          const existingOp = this._state.operations?.[resumeId];
          if (!existingOp || existingOp.kind !== 'send-chat-first') {
            return {
              ok: false,
              rev: this._state.rev,
              error: makeRpcError(ERROR_CODES.NOT_FOUND, 'Resumable send-chat-first operation not found'),
              snapshot: this._buildSnapshot(),
            };
          }
          if (existingOp.status !== 'needs-input') {
            return {
              ok: false,
              rev: this._state.rev,
              error: makeRpcError(ERROR_CODES.BUSY, `Operation is in "${existingOp.status}" state and cannot accept message resubmission`),
              snapshot: this._buildSnapshot(),
            };
          }
          if (existingOp.messageHash && existingOp.messageHash !== sha256Hex(message)) {
            return {
              ok: false,
              rev: this._state.rev,
              error: makeRpcError(ERROR_CODES.IDEMPOTENCY_CONFLICT, 'Resubmitted message does not match original operation digest'),
              snapshot: this._buildSnapshot(),
            };
          }
          existingOp.status = 'pending';
          existingOp.error = null;
          existingOp.updatedAt = this._now();
          this._saveStateAtomic(this._state);
          const execRes = await this._executeChatFirstOperation(resumeId, message, requestId, fingerprint);
          return { ...execRes, snapshot: this._buildSnapshot() };
        }

        // Standard first-message checks: must be on Chat `/`, verify navRev & draftRev
        if (payload.navRev !== undefined && payload.navRev !== this._state.navRev) {
          return {
            ok: false,
            rev: this._state.rev,
            error: makeRpcError(ERROR_CODES.STALE_NAVIGATION, 'Stale navRev on send-chat-first', true),
            snapshot: this._buildSnapshot(),
          };
        }
        if (this._state.activeMode !== 'chat' || this._state.modeLastView.chat !== '/') {
          return {
            ok: false,
            rev: this._state.rev,
            error: makeRpcError(ERROR_CODES.STALE_NAVIGATION, 'send-chat-first requires active Chat "/" view', true),
            snapshot: this._buildSnapshot(),
          };
        }
        if (payload.draftRev !== undefined && payload.draftRev !== this._state.draftRev) {
          return {
            ok: false,
            rev: this._state.rev,
            error: makeRpcError(ERROR_CODES.STALE_DRAFT, 'Stale draftRev on send-chat-first', true),
            snapshot: this._buildSnapshot(),
          };
        }

        // Only one incomplete first-message operation may occupy the same draft revision at a time
        for (const op of Object.values(this._state.operations || {})) {
          if (
            op &&
            op.kind === 'send-chat-first' &&
            op.draftRev === this._state.draftRev &&
            (op.status === 'pending' || op.status === 'awaiting-confirmation' || op.status === 'needs-input')
          ) {
            return {
              ok: false,
              rev: this._state.rev,
              error: makeRpcError(ERROR_CODES.BUSY, 'Another send-chat-first operation is already occupying this draftRev', true),
              snapshot: this._buildSnapshot(),
            };
          }
        }

        const draft = this._state.chatDraft;
        let placement;
        let scopeRef;
        let sparkProjectId = null;

        if (draft.kind === 'knowledge') {
          this._ensureKnowledgeScopeRecord(this._state);
          placement = { kind: 'knowledge', folderId: draft.folderId ?? null };
          scopeRef = KNOWLEDGE_SCOPE_REF;
        } else {
          if (!draft.sparkProjectId) {
            return {
              ok: false,
              rev: this._state.rev,
              error: makeRpcError(ERROR_CODES.INVALID_ARGUMENT, 'Spark draft requires selecting a project before sending'),
              snapshot: this._buildSnapshot(),
            };
          }
          const proj = (this._state.sparkProjects || []).find((p) => p.id === draft.sparkProjectId);
          if (!proj) {
            return {
              ok: false,
              rev: this._state.rev,
              error: makeRpcError(ERROR_CODES.NOT_FOUND, 'Selected spark project no longer exists'),
              snapshot: this._buildSnapshot(),
            };
          }
          sparkProjectId = proj.id;
          placement = { kind: 'spark', sparkProjectId: proj.id };
          scopeRef = proj.scopeRef;
        }

        const opId = randomId('op', 6);
        const now = this._now();
        const idempotencyKey = `idem-${this._state.storeId}-${opId}`;
        const safeModelId =
          typeof payload.modelId === 'string' && payload.modelId.trim() && !hasControlChars(payload.modelId)
            ? payload.modelId.trim().slice(0, 80)
            : null;
        const safeEffort =
          typeof payload.effort === 'string' && ['Low', 'Medium', 'High', 'XHigh'].includes(payload.effort.trim())
            ? payload.effort.trim()
            : null;
        const opRecord = {
          operationId: opId,
          kind: 'send-chat-first',
          status: 'pending',
          phase: 'created',
          idempotencyKey,
          ...(requestId ? { requestId, requestFingerprint: fingerprint } : {}),
          originNavRev: this._state.navRev,
          originDraftRev: this._state.draftRev,
          draftRev: this._state.draftRev,
          placement,
          scopeRef,
          sparkProjectId,
          ...(safeModelId ? { modelId: safeModelId } : {}),
          ...(safeEffort ? { effort: safeEffort } : {}),
          cascadeId: null,
          messageHash: sha256Hex(message),
          createdAt: now,
          updatedAt: now,
        };

        // Waiting for confirmation is part of the initial transaction; do not persist a directly resumable created state beforehand.
        const requiresWsl = await this.hostAdapter?.requiresWslConfirmation?.(draft.kind, scopeRef);
        const next = cloneJson(this._state);
        next.operations[opId] = opRecord;
        this._pruneOperations(next);
        if (Object.keys(next.operations).length > LIMITS.MAX_OPERATIONS ||
            Object.keys(next.assignments).length >= LIMITS.MAX_ASSIGNMENTS) {
          return { ok: false, rev: this._state.rev, snapshot: this._buildSnapshot(),
            error: makeRpcError(ERROR_CODES.LIMIT_EXCEEDED, 'Sidebar operation or assignment capacity reached') };
        }

        if (requiresWsl) {
          const challenge = randomId('wslc', 12);
          opRecord.status = 'awaiting-confirmation';
          opRecord.phase = 'awaiting-wsl-confirmation';
          opRecord.updatedAt = this._now();
          const pendingResult = {
            operationId: opId,
            status: 'awaiting-confirmation',
            requiresWslConfirmation: true,
          };
          const response = { ok: true, rev: next.rev, result: pendingResult };
          if (requestId) this._recordReceiptOnState(next, requestId, fingerprint, response);
          this._saveStateAtomic(next);
          this._state = next;
          this._wslChallenges.set(opId, {
            challenge,
            scopeRef,
            envFingerprint: `${process.platform}:${next.storeId}`,
            expiresAt: now + WSL_CHALLENGE_TTL_MS,
          });
          this._pendingMessageBodies.set(opId, message);
          return { ...response, snapshot: this._buildSnapshot() };
        }

        this._saveStateAtomic(next);
        this._state = next;
        const execRes = await this._executeChatFirstOperation(opId, message, requestId, fingerprint);
        return { ...execRes, snapshot: this._buildSnapshot() };
      }

      case 'confirm-wsl': {
        const opId = payload.operationId;
        const challenge = payload.challenge;
        if (!isSafeIdentifier(opId) || typeof challenge !== 'string' || !challenge.trim()) {
          return {
            ok: false,
            rev: this._state.rev,
            error: makeRpcError(ERROR_CODES.INVALID_ARGUMENT, 'operationId and challenge are required'),
            snapshot: this._buildSnapshot(),
          };
        }
        const op = this._state.operations?.[opId];
        if (!op) {
          return {
            ok: false,
            rev: this._state.rev,
            error: makeRpcError(ERROR_CODES.NOT_FOUND, 'Operation not found'),
            snapshot: this._buildSnapshot(),
          };
        }
        if (op.status !== 'awaiting-confirmation') {
          return {
            ok: false,
            rev: this._state.rev,
            error: makeRpcError(ERROR_CODES.INVALID_ARGUMENT, `Operation is not awaiting WSL confirmation (status=${op.status})`),
            snapshot: this._buildSnapshot(),
          };
        }
        const entry = this._wslChallenges.get(opId);
        if (
          !entry ||
          entry.expiresAt <= this._now() ||
          entry.scopeRef !== op.scopeRef ||
          entry.envFingerprint !== `${process.platform}:${this._state.storeId}`
        ) {
          this._wslChallenges.delete(opId);
          return {
            ok: false,
            rev: this._state.rev,
            error: makeRpcError(ERROR_CODES.INVALID_ARGUMENT, 'WSL challenge expired or unbound to current scope'),
            snapshot: this._buildSnapshot(),
          };
        }
        // Verify one-time challenge using constant-time comparison
        const aBuf = Buffer.from(entry.challenge, 'utf8');
        const bBuf = Buffer.from(challenge.trim(), 'utf8');
        if (aBuf.length !== bBuf.length || !crypto.timingSafeEqual(aBuf, bBuf)) {
          return {
            ok: false,
            rev: this._state.rev,
            error: makeRpcError(ERROR_CODES.INVALID_ARGUMENT, 'Invalid WSL confirmation challenge'),
            snapshot: this._buildSnapshot(),
          };
        }
        // Consume one-time challenge
        this._wslChallenges.delete(opId);

        // Re-verify WSL environment and required policies before resuming
        let wslOk = false;
        try { wslOk = await this.hostAdapter?.verifyWslEnvironment?.(op.scopeRef) === true; } catch {}
        if (!wslOk) {
          this._pendingMessageBodies.delete(opId);
          op.status = 'failed';
          op.updatedAt = this._now();
          op.error = makeRpcError(ERROR_CODES.CAPABILITY_UNAVAILABLE, 'WSL environment verification failed');
          this._saveStateAtomic(this._state);
          return { ok: false, rev: this._state.rev, error: op.error, snapshot: this._buildSnapshot() };
        }

        const pendingMsg = this._pendingMessageBodies.get(opId);
        if (!pendingMsg) {
          op.status = 'needs-input';
          op.updatedAt = this._now();
          op.error = makeRpcError(ERROR_CODES.INVALID_ARGUMENT, 'Original message body unavailable after confirmation; please resubmit', true);
          this._saveStateAtomic(this._state);
          return { ok: false, rev: this._state.rev, error: op.error, snapshot: this._buildSnapshot() };
        }

        op.status = 'pending';
        op.phase = 'wsl-confirmed';
        op.wslConfirmed = true;
        op.updatedAt = this._now();
        this._saveStateAtomic(this._state);

        const execRes = await this._executeChatFirstOperation(opId, pendingMsg, requestId, fingerprint);
        return { ...execRes, snapshot: this._buildSnapshot() };
      }

      case 'pick-folder': {
        if (this.sandboxMode) {
          return {
            ok: false,
            rev: this._state.rev,
            error: makeRpcError(ERROR_CODES.CAPABILITY_UNAVAILABLE, 'System folder picker is disabled in sandboxMode'),
            snapshot: this._buildSnapshot(),
          };
        }
        return this.pickFolder(payload);
      }

      case 'reveal-folder': {
        if (this.sandboxMode) {
          return {
            ok: false,
            rev: this._state.rev,
            error: makeRpcError(ERROR_CODES.CAPABILITY_UNAVAILABLE, 'System folder reveal is disabled in sandboxMode'),
            snapshot: this._buildSnapshot(),
          };
        }
        return this.revealFolder(payload);
      }

      default:
        return {
          ok: false,
          rev: this._state.rev,
          error: makeRpcError(ERROR_CODES.INVALID_ARGUMENT, `Unknown sidebar-studio action: ${action}`),
          snapshot: this._buildSnapshot(),
        };
    }
  }

  /**
   * Unified v2 RPC entry point: accepts `{ version: 2, action, requestId, storeId, baseRev, payload }`.
   */
  async handleRpc(request) {
    if (!isPlainObject(request)) {
      return {
        ok: false,
        rev: this._state.rev,
        error: makeRpcError(ERROR_CODES.INVALID_ARGUMENT, 'RPC request must be a plain object'),
        snapshot: this._buildSnapshot(),
      };
    }
    return this.handleRpcAction(request.action, request);
  }

  /**
   * Compatibility dispatch entry point for sidecars/daemon/main.mjs (supports both flat params and v2 RpcRequest envelopes).
   */
  async handleRpcAction(action, params = {}) {
    const normalized = this._normalizeEnvelope(action, params);
    if (!normalized.ok) {
      return {
        ok: false,
        rev: this._state.rev,
        error: normalized.error,
        snapshot: this._buildSnapshot(),
      };
    }
    if (normalized.action === 'pick-folder') {
      if (this.sandboxMode) {
        return {
          ok: false,
          rev: this._state.rev,
          error: makeRpcError(ERROR_CODES.CAPABILITY_UNAVAILABLE, 'System folder picker is disabled in sandboxMode'),
          snapshot: this._buildSnapshot(),
        };
      }
      return this.pickFolder(normalized.payload);
    }
    return this._enqueue(() => this._dispatchSerialized(normalized.action, normalized));
  }

  async handleAction(action, params = {}) {
    return this.handleRpcAction(action, params);
  }

  async pickFolder(params = {}) {
    if (this.sandboxMode) {
      return {
        ok: false,
        error: makeRpcError(ERROR_CODES.CAPABILITY_UNAVAILABLE, 'System pickFolder is forbidden in sandboxMode'),
      };
    }
    const rawTitle = typeof params?.title === 'string' ? params.title.trim() : '';
    const safeTitle = (rawTitle || 'Choose Workspace Folder').replace(/[\u0000-\u001f]/g, '').slice(0, 120);
    let safeInitDir = '';
    if (typeof params?.initialDir === 'string' && params.initialDir.trim() && !params.initialDir.includes('\0') && !isBlockedUncPath(params.initialDir)) {
      const candidateInitDir = path.resolve(params.initialDir.trim());
      if (!isBlockedUncPath(candidateInitDir)) {
        try {
          const resolved = fs.realpathSync(candidateInitDir);
          if (!isBlockedUncPath(resolved) && fs.statSync(resolved).isDirectory()) safeInitDir = resolved;
        } catch {
          safeInitDir = '';
        }
      }
    }

    const env = {
      ...process.env,
      AG_PRISM_PICK_TITLE: safeTitle,
      AG_PRISM_PICK_INIT_DIR: safeInitDir,
    };

    try {
      if (process.platform === 'win32') {
        const { stdout } = await this._execFile(
          'powershell.exe',
          ['-NoProfile', '-NonInteractive', '-STA', '-EncodedCommand', WIN_PICK_FOLDER_ENCODED],
          { env, windowsHide: true, timeout: 120000 }
        );
        const b64 = String(stdout || '').trim();
        if (!b64) return { ok: true, canceled: true, path: null };
        const picked = Buffer.from(b64, 'base64').toString('utf8').trim();
        return picked ? { ok: true, canceled: false, path: picked } : { ok: true, canceled: true, path: null };
      }

      if (process.platform === 'darwin') {
        const { stdout } = await this._execFile(
          '/usr/bin/osascript',
          ['-e', MAC_PICK_FOLDER_AS],
          { env, timeout: 120000 }
        );
        const picked = String(stdout || '').trim();
        return picked ? { ok: true, canceled: false, path: picked } : { ok: true, canceled: true, path: null };
      }

      try {
        const zArgs = ['--file-selection', '--directory', '--title', safeTitle];
        if (safeInitDir) zArgs.push('--filename', safeInitDir.endsWith('/') ? safeInitDir : `${safeInitDir}/`);
        const { stdout } = await this._execFile('zenity', zArgs, { env, timeout: 120000 });
        const picked = String(stdout || '').trim();
        return picked ? { ok: true, canceled: false, path: picked } : { ok: true, canceled: true, path: null };
      } catch (zErr) {
        if (zErr && zErr.code === 1) {
          return { ok: true, canceled: true, path: null };
        }
        try {
          const { stdout } = await this._execFile(
            'kdialog',
            ['--getexistingdirectory', safeInitDir || os.homedir(), '--title', safeTitle],
            { env, timeout: 120000 }
          );
          const picked = String(stdout || '').trim();
          return picked ? { ok: true, canceled: false, path: picked } : { ok: true, canceled: true, path: null };
        } catch (kErr) {
          if (kErr && kErr.code === 1) {
            return { ok: true, canceled: true, path: null };
          }
          throw kErr;
        }
      }
    } catch (err) {
      const msg = String(err?.stderr || err?.message || '');
      if (msg.includes('-128') || msg.toLowerCase().includes('user canceled')) {
        return { ok: true, canceled: true, path: null };
      }
      return { ok: false, error: `Failed to open folder picker: ${err?.message || err}` };
    }
  }

  async revealFolder(params = {}) {
    if (this.sandboxMode) {
      return {
        ok: false,
        error: makeRpcError(ERROR_CODES.CAPABILITY_UNAVAILABLE, 'System revealFolder is forbidden in sandboxMode'),
      };
    }
    const rawPath = params?.path;
    if (typeof rawPath !== 'string' || !rawPath.trim() || rawPath.length > MAX_PATH_LEN || rawPath.includes('\0') || isBlockedUncPath(rawPath)) {
      return { ok: false, error: 'Invalid directory path' };
    }

    const candidatePath = path.resolve(rawPath.trim());
    if (isBlockedUncPath(candidatePath)) {
      return { ok: false, error: 'Invalid directory path' };
    }

    let realPath;
    try {
      realPath = fs.realpathSync(candidatePath);
      if (isBlockedUncPath(realPath) || !fs.statSync(realPath).isDirectory()) {
        return { ok: false, error: 'Target path is not a valid directory' };
      }
    } catch {
      return { ok: false, error: 'Target directory does not exist or is inaccessible' };
    }

    try {
      if (process.platform === 'win32') {
        try {
          await this._execFile('explorer.exe', [realPath], { windowsHide: false, timeout: 15000 });
        } catch (expErr) {
          if (expErr && expErr.code !== 1) throw expErr;
        }
      } else if (process.platform === 'darwin') {
        await this._execFile('/usr/bin/open', [realPath], { timeout: 15000 });
      } else {
        await this._execFile('xdg-open', [realPath], { timeout: 15000 });
      }
      return { ok: true, path: realPath };
    } catch (err) {
      return { ok: false, error: `Failed to reveal folder: ${err?.message || err}` };
    }
  }

  async dispose() {
    this._disposed = true;
    // Drain the single-writer queue before releasing the lock and sandbox temp dir
    try {
      await this._queue;
    } catch {
      // Ignore trailing errors from drained tasks
    }
    this._selectionTokens.clear();
    this._wslChallenges.clear();
    this._pendingMessageBodies.clear();
    this._releaseWriterLock();
    if (this._ownedSandboxRoot) {
      const owned = this._ownedSandboxRoot;
      this._ownedSandboxRoot = null;
      try {
        fs.rmSync(owned, { recursive: true, force: true });
      } catch {
        // Ignore temp directory cleanup errors
      }
    }
  }
}

export function createSidebarStudioService(options = {}) {
  return new SidebarStudioService(options);
}

export function createStudioSandboxService(options = {}) {
  return new SidebarStudioService({
    ...options,
    sandboxMode: true,
  });
}

export {
  SCHEMA_VERSION,
  MODES,
  CHAT_KINDS,
  ERROR_CODES,
  LIMITS,
  PERMISSION_PROFILES,
  DEFAULT_MODE_THEMES,
  GREETING_POOLS,
  normalizeGreetingLang,
  formatGreeting,
};

export default SidebarStudioService;
