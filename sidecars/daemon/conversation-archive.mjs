#!/usr/bin/env node
/**
 * Obsidian Prism — Safe Antigravity Conversation Storage Health & Archiver
 *
 * Problem solved:
 *   The official Antigravity language_server.exe loads historical conversation .db files
 *   under ~/.gemini/antigravity/conversations/ (including many hidden background subagent /
 *   Swarm child conversations) into memory on startup, which can cause language_server.exe
 *   to consume 3-5 GB of RAM immediately on launch.
 *
 * Safety boundaries (zero data loss):
 *   1. Never deletes any .db file — archiving always moves files with a manifest.json ledger
 *      so any batch can be restored losslessly in one click;
 *   2. Runtime fail-closed lock protection — checks whether language_server is running before
 *      moving/restoring and before each conversation; any detection error fails closed as running;
 *   3. Atomic companion bundle moves with rollback tracking — .db / .db-wal / .db-shm move
 *      together; rollback failures are explicitly surfaced and recorded in manifest.json;
 *   4. Full path-chain symlink rejection + exclusive random temp files — lstatSync rejects
 *      ancestor/leaf symlinks and all writes use unpredictable random names with O_EXCL ('wx');
 *   5. Unique non-reusable batch directories + defaults to finished hidden subagents only —
 *      100% of main conversations are preserved by default.
 */

import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFile, execFileSync, spawn } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const GUID_RE = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const DB_FILE_RE = /^([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})\.db(?:-(wal|shm))?$/i;
const BATCH_NAME_RE = /^batch-[0-9T-]+(?:-[a-f0-9]{8})?$/;
const RUNNING_STATUS_RE = /RUNNING|IN_PROGRESS|GENERATING|ACTIVE/i;
const INDEX_FILENAME = '.last-catalog-index.json';
const LAST_ARCHIVE_RESULT_FILENAME = '.last-archive-result.json';
const ACTIVE_ARCHIVE_TASK_FILENAME = '.archive-task-active.json';
export const WARN_TOTAL_MB = 1536;
export const WARN_SUBAGENT_MB = 512;
export const WARN_LS_MEMORY_MB = 4096;
export const AUTO_ARCHIVE_SUBAGENT_MAX_AGE_HOURS = 2;
const DEFAULT_SUBAGENT_MAX_AGE_HOURS = 6;
const DEFAULT_MAIN_MAX_AGE_DAYS = 14;
const DEFAULT_KEEP_RECENT_MAIN = 20;
const MAX_CATALOG_ENTRIES = 8000;
const WIN_HOST_PROCESS_RE = /^(?:language_server[^"]*|antigravity|agy)\.exe$/i;
const WIN_LS_ONLY_PROCESS_RE = /^language_server[^"]*\.exe$/i;
const POSIX_LS_RE = /(?:^|\/)language_server(?:[^\s/]*)?(?:\s|$)/i;
const POSIX_ANTIGRAVITY_APP_RE = /(?:^|\/)Antigravity(?:\s+Helper(?:\s+\([^)]+\))?)?\.app\/Contents\/MacOS\//i;
const POSIX_HOST_ARGV0_RE = /^(?:["']?)(?:\S*\/)?(?:antigravity(?:\.appimage)?|agy)(?:["']?)(?:\s|$)/i;
const POSIX_ELECTRON_APP_RE = /(?:^|\/)antigravity\/resources\/app/i;
const POSIX_SELF_SCRIPT_RE = /(?:^|[\/\s"'])(?:conversation-archive\.mjs|archive-(?:subagents|old-main)\.(?:sh|command)|restore-(?:latest-archive|batch-[0-9T-]+(?:-[a-f0-9]{8})?)\.(?:sh|command))(?:["'\s]|$)/i;

function isRunningTrajectoryStatus(status) {
  if (status === 2 || status === '2' || status === 'CASCADE_RUN_STATUS_2') return true;
  return RUNNING_STATUS_RE.test(String(status || ''));
}

export function getDefaultAntigravityDir(homeDir = os.homedir()) {
  return path.join(homeDir, '.gemini', 'antigravity');
}

export function getDefaultConversationsDir(homeDir = os.homedir()) {
  return path.join(getDefaultAntigravityDir(homeDir), 'conversations');
}

export function getDefaultArchiveDir(homeDir = os.homedir()) {
  return path.join(getDefaultAntigravityDir(homeDir), 'conversations_archive');
}

function isDarwinSystemRootSymlink(curPath) {
  if (process.platform !== 'darwin') return false;
  if (curPath !== '/var' && curPath !== '/tmp') return false;
  try {
    const linkTarget = fs.readlinkSync(curPath);
    if (curPath === '/var') return linkTarget === 'private/var' || linkTarget === '/private/var';
    if (curPath === '/tmp') return linkTarget === 'private/tmp' || linkTarget === '/private/tmp';
  } catch {
    return false;
  }
  return false;
}

async function isDarwinSystemRootSymlinkAsync(curPath) {
  if (process.platform !== 'darwin') return false;
  if (curPath !== '/var' && curPath !== '/tmp') return false;
  try {
    const linkTarget = await fs.promises.readlink(curPath);
    if (curPath === '/var') return linkTarget === 'private/var' || linkTarget === '/private/var';
    if (curPath === '/tmp') return linkTarget === 'private/tmp' || linkTarget === '/private/tmp';
  } catch {
    return false;
  }
  return false;
}

async function assertPathChainNoSymlinksAsync(targetPath, label = 'path') {
  const resolved = path.resolve(targetPath);
  const parsed = path.parse(resolved);
  const rel = resolved.slice(parsed.root.length);
  const parts = rel.split(/[\\/]+/).filter(Boolean);
  let cur = parsed.root;
  let lastStat = null;
  for (let i = 0; i < parts.length; i++) {
    cur = path.join(cur, parts[i]);
    try {
      const st = await fs.promises.lstat(cur);
      if (st.isSymbolicLink()) {
        if (await isDarwinSystemRootSymlinkAsync(cur)) {
          lastStat = await fs.promises.stat(cur);
          continue;
        }
        throw new Error(`Refusing symbolic link in ${label} chain: ${cur}`);
      }
      lastStat = st;
    } catch (err) {
      if (err && err.code === 'ENOENT') {
        lastStat = null;
        break;
      }
      throw err;
    }
  }
  return lastStat;
}

function assertPathChainNoSymlinks(targetPath, label = 'path') {
  const resolved = path.resolve(targetPath);
  const parsed = path.parse(resolved);
  const rel = resolved.slice(parsed.root.length);
  const parts = rel.split(/[\\/]+/).filter(Boolean);
  let cur = parsed.root;
  let lastStat = null;
  for (let i = 0; i < parts.length; i++) {
    cur = path.join(cur, parts[i]);
    try {
      const st = fs.lstatSync(cur);
      if (st.isSymbolicLink()) {
        if (isDarwinSystemRootSymlink(cur)) {
          lastStat = fs.statSync(cur);
          continue;
        }
        throw new Error(`Refusing symbolic link in ${label} chain: ${cur}`);
      }
      lastStat = st;
    } catch (err) {
      if (err && err.code === 'ENOENT') {
        lastStat = null;
        break;
      }
      throw err;
    }
  }
  return lastStat;
}

function ensureSafeDir(dirPath) {
  const resolved = path.resolve(dirPath);
  const st = assertPathChainNoSymlinks(resolved, 'directory');
  if (!st) {
    fs.mkdirSync(resolved, { recursive: true, mode: 0o700 });
    const after = assertPathChainNoSymlinks(resolved, 'directory');
    if (!after || !after.isDirectory()) {
      throw new Error(`Failed to create safe directory: ${resolved}`);
    }
  } else if (!st.isDirectory()) {
    throw new Error(`Expected directory but found non-directory: ${resolved}`);
  }
  return resolved;
}

function createExclusiveBatchDir(archiveRoot, now = Date.now()) {
  const safeRoot = ensureSafeDir(archiveRoot);
  const stamp = new Date(now).toISOString().replace(/[:.]/g, '-').slice(0, 19);
  for (let attempt = 0; attempt < 5; attempt++) {
    const suffix = crypto.randomBytes(4).toString('hex');
    const batchName = `batch-${stamp}-${suffix}`;
    const batchDir = path.join(safeRoot, batchName);
    try {
      fs.mkdirSync(batchDir, { mode: 0o700 });
      assertPathChainNoSymlinks(batchDir, 'batch directory');
      return { batchName, batchDir };
    } catch (err) {
      if (err && err.code === 'EEXIST') continue;
      throw err;
    }
  }
  throw new Error('Unable to allocate unique batch directory');
}

function atomicWriteTextExclusiveSync(filePath, text, mode = 0o600) {
  const resolved = path.resolve(filePath);
  assertPathChainNoSymlinks(resolved, 'target file');
  ensureSafeDir(path.dirname(resolved));
  const tmp = `${resolved}.tmp.${crypto.randomBytes(8).toString('hex')}`;
  let fd = null;
  try {
    fd = fs.openSync(tmp, 'wx', mode);
    fs.writeFileSync(fd, text, { encoding: 'utf8' });
    try { fs.fsyncSync(fd); } catch {}
    fs.closeSync(fd);
    fd = null;
    try { fs.chmodSync(tmp, mode); } catch {}
    fs.renameSync(tmp, resolved);
  } catch (err) {
    if (fd !== null) {
      try { fs.closeSync(fd); } catch {}
    }
    try { fs.unlinkSync(tmp); } catch {}
    throw err;
  }
}

function withArchiveLock(archiveDir, fn) {
  const safeRoot = ensureSafeDir(archiveDir);
  const lockPath = path.join(safeRoot, '.archive.lock');
  assertPathChainNoSymlinks(lockPath, 'archive lock');
  let fd = null;
  try {
    fd = fs.openSync(lockPath, 'wx', 0o600);
    fs.writeFileSync(fd, JSON.stringify({ pid: process.pid, startedAt: new Date().toISOString() }) + '\n', 'utf8');
    try { fs.fsyncSync(fd); } catch {}
    fs.closeSync(fd);
    fd = null;
  } catch (err) {
    if (fd !== null) { try { fs.closeSync(fd); } catch {} }
    if (err && err.code === 'EEXIST') {
      return {
        ok: false,
        code: 'ARCHIVE_LOCKED',
        error: `Another archive/restore process is already running (lock file exists: ${lockPath}). If no process is running, remove the lock file manually and retry.`,
      };
    }
    throw err;
  }
  try {
    return fn();
  } finally {
    try { fs.unlinkSync(lockPath); } catch {}
  }
}

function atomicWriteJsonSync(filePath, data) {
  atomicWriteTextExclusiveSync(filePath, JSON.stringify(data, null, 2) + '\n', 0o600);
}

function safeMoveFileSync(src, dst) {
  const srcStat = assertPathChainNoSymlinks(src, 'source file');
  if (!srcStat || !srcStat.isFile()) {
    throw new Error(`Source is not a regular file: ${src}`);
  }
  const dstStat = assertPathChainNoSymlinks(dst, 'destination file');
  if (dstStat) {
    throw new Error(`Destination already exists: ${dst}`);
  }
  ensureSafeDir(path.dirname(dst));
  try {
    fs.renameSync(src, dst);
  } catch (err) {
    if (err && err.code === 'EXDEV') {
      const tmp = `${dst}.copy.${crypto.randomBytes(8).toString('hex')}`;
      try {
        fs.copyFileSync(src, tmp, fs.constants.COPYFILE_EXCL);
        const copied = fs.lstatSync(tmp);
        if (copied.isSymbolicLink() || !copied.isFile() || copied.size !== srcStat.size) {
          throw new Error(`Cross-device copy verification failed for ${path.basename(src)}`);
        }
        fs.renameSync(tmp, dst);
        fs.unlinkSync(src);
      } catch (copyErr) {
        try { fs.unlinkSync(tmp); } catch {}
        throw copyErr;
      }
      return;
    }
    throw err;
  }
}

export function parseWindowsTasklistCsv(csvText, { selfPid = process.pid } = {}) {
  const text = String(csvText || '').trim();
  if (!text) return true; // unexpected empty output -> fail-closed
  let parsedCount = 0;
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;
    const m = /^\s*"([^"]+)"\s*,\s*"(\d+)",/.exec(line);
    if (!m) continue;
    parsedCount++;
    const imageName = m[1];
    const pid = Number(m[2]);
    // When running offline archive via Antigravity.exe (ELECTRON_RUN_AS_NODE=1) without global node, exclude self PID only (never language_server)
    if (
      Number.isInteger(selfPid) &&
      selfPid > 0 &&
      pid === selfPid &&
      !WIN_LS_ONLY_PROCESS_RE.test(imageName)
    ) {
      continue;
    }
    if (WIN_HOST_PROCESS_RE.test(imageName)) {
      return true;
    }
  }
  // If tasklist returned non-CSV/error text with zero valid process rows -> fail-closed
  return parsedCount === 0;
}

export function parsePosixProcessList(psText, { selfPid = process.pid, selfPpid = process.ppid } = {}) {
  const text = String(psText || '').trim();
  if (!text) return true; // unexpected empty output -> fail-closed
  let parsedCount = 0;
  for (const rawLine of text.split(/\r?\n/)) {
    const m = /^\s*(\d+)\s+(.+)$/.exec(rawLine);
    if (!m) continue;
    parsedCount++;
    const pid = Number(m[1]);
    const cmd = m[2].trim();
    if (pid === selfPid) continue;
    // Exclude current archiver script or its helper shell wrapper to avoid self-match
    if (
      POSIX_SELF_SCRIPT_RE.test(cmd) &&
      (pid === selfPpid || /^(?:["']?)(?:\S*\/)?(?:node|bash|sh|zsh|env)(?:["']?)(?:\s|$)/i.test(cmd))
    ) {
      continue;
    }
    if (
      POSIX_LS_RE.test(cmd) ||
      POSIX_ANTIGRAVITY_APP_RE.test(cmd) ||
      POSIX_HOST_ARGV0_RE.test(cmd) ||
      POSIX_ELECTRON_APP_RE.test(cmd)
    ) {
      return true;
    }
  }
  return parsedCount === 0;
}

/**
 * Fail-closed check: returns true if language_server OR Antigravity/agy host is running,
 * or if process detection itself fails/errors/times out.
 * Note: offline CLI tool cannot enforce OS-level host startup mutex across closed-source
 * Antigravity; users must keep Antigravity closed until the archive command finishes.
 */
export function isLanguageServerRunning({
  platform = process.platform,
  exec = execFileSync,
  selfPid = process.pid,
  selfPpid = process.ppid,
} = {}) {
  try {
    if (platform === 'win32') {
      const out = exec(
        'tasklist.exe',
        ['/NH', '/FO', 'CSV'],
        { encoding: 'utf8', windowsHide: true, timeout: 6000, maxBuffer: 8 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'] }
      );
      return parseWindowsTasklistCsv(out, { selfPid });
    }
    const out = exec('ps', ['-eo', 'pid=,args='], {
      encoding: 'utf8',
      timeout: 5000,
      maxBuffer: 8 * 1024 * 1024,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    return parsePosixProcessList(out, { selfPid, selfPpid });
  } catch {
    // Any process query failure (non-zero exit, ENOENT, timeout, ENOBUFS) fails closed (true)
    return true;
  }
}

/**
 * Read-only parser for Windows tasklist /NH /FO CSV language_server memory usage (strictly read-only, zero cross-process manipulation).
 */
export function parseWindowsTasklistMemoryCsv(csvText) {
  const text = String(csvText || '').trim();
  if (!text) return { ok: false, totalMb: 0, processCount: 0, pids: [], processes: [] };
  let parsedRows = 0;
  let totalKb = 0;
  const pids = [];
  const processes = [];
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;
    const m = /^\s*"([^"]+)"\s*,\s*"(\d+)"\s*,\s*"[^"]*"\s*,\s*"[^"]*"\s*,\s*"([^"]+)"\s*$/.exec(line);
    if (!m) continue;
    parsedRows += 1;
    const imageName = m[1];
    const pid = Number(m[2]);
    if (!WIN_LS_ONLY_PROCESS_RE.test(imageName)) continue;
    const kbDigits = m[3].replace(/[^\d]/g, '');
    const kb = kbDigits ? Number(kbDigits) : 0;
    if (Number.isFinite(kb) && kb > 0) totalKb += kb;
    if (Number.isInteger(pid) && pid > 0) pids.push(pid);
    processes.push({ pid, name: imageName, mb: Number((kb / 1024).toFixed(1)) });
  }
  if (parsedRows === 0) return { ok: false, totalMb: 0, processCount: 0, pids: [], processes: [] };
  return {
    ok: true,
    totalMb: Number((totalKb / 1024).toFixed(1)),
    processCount: processes.length,
    pids,
    processes,
  };
}

/**
 * Read-only parser for POSIX ps -eo pid=,rss=,args= language_server resident memory (KB -> MB).
 */
export function parsePosixPsRss(psText, { selfPid = process.pid, selfPpid = process.ppid } = {}) {
  const text = String(psText || '').trim();
  if (!text) return { ok: false, totalMb: 0, processCount: 0, pids: [], processes: [] };
  let parsedRows = 0;
  let totalKb = 0;
  const pids = [];
  const processes = [];
  for (const rawLine of text.split(/\r?\n/)) {
    const m = /^\s*(\d+)\s+(\d+)\s+(.+)$/.exec(rawLine);
    if (!m) continue;
    parsedRows += 1;
    const pid = Number(m[1]);
    const rssKb = Number(m[2]);
    const cmd = m[3].trim();
    if (pid === selfPid) continue;
    if (
      POSIX_SELF_SCRIPT_RE.test(cmd) &&
      (pid === selfPpid || /^(?:["']?)(?:\S*\/)?(?:node|bash|sh|zsh|env)(?:["']?)(?:\s|$)/i.test(cmd))
    ) {
      continue;
    }
    if (!POSIX_LS_RE.test(cmd)) continue;
    if (Number.isFinite(rssKb) && rssKb > 0) totalKb += rssKb;
    if (Number.isInteger(pid) && pid > 0) pids.push(pid);
    processes.push({ pid, name: 'language_server', mb: Number((rssKb / 1024).toFixed(1)) });
  }
  if (parsedRows === 0) return { ok: false, totalMb: 0, processCount: 0, pids: [], processes: [] };
  return {
    ok: true,
    totalMb: Number((totalKb / 1024).toFixed(1)),
    processCount: processes.length,
    pids,
    processes,
  };
}

function defaultExecFileAsync(file, args, options) {
  return new Promise((resolve, reject) => {
    execFile(file, args, options, (err, stdout) => {
      if (err) {
        reject(err);
        return;
      }
      resolve(String(stdout || ''));
    });
  });
}

/**
 * Async read-only probe of current language_server process memory usage (no OpenProcess/EmptyWorkingSet/force-kill).
 */
export async function getLanguageServerMemoryStatsAsync({
  platform = process.platform,
  execAsync = defaultExecFileAsync,
  selfPid = process.pid,
  selfPpid = process.ppid,
} = {}) {
  try {
    if (platform === 'win32') {
      const out = await execAsync('tasklist.exe', ['/NH', '/FO', 'CSV'], {
        encoding: 'utf8',
        windowsHide: true,
        timeout: 6000,
        maxBuffer: 8 * 1024 * 1024,
      });
      return parseWindowsTasklistMemoryCsv(out);
    }
    const out = await execAsync('ps', ['-eo', 'pid=,rss=,args='], {
      encoding: 'utf8',
      timeout: 5000,
      maxBuffer: 8 * 1024 * 1024,
    });
    return parsePosixPsRss(out, { selfPid, selfPpid });
  } catch {
    return { ok: false, totalMb: 0, processCount: 0, pids: [], processes: [] };
  }
}

function parseSummaryTimeMs(raw) {
  if (raw === null || raw === undefined || raw === '') return 0;
  if (typeof raw === 'number') {
    if (!Number.isFinite(raw) || raw <= 0) return 0;
    return raw < 1e11 ? Math.floor(raw * 1000) : Math.floor(raw);
  }
  if (typeof raw === 'string') {
    const s = raw.trim();
    if (!s) return 0;
    if (/^\d+(?:\.\d+)?$/.test(s)) {
      const n = Number(s);
      if (!Number.isFinite(n) || n <= 0) return 0;
      return n < 1e11 ? Math.floor(n * 1000) : Math.floor(n);
    }
    const parsed = Date.parse(s);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
  }
  if (typeof raw === 'object') {
    const sec = Number(raw.seconds ?? raw.sec);
    if (Number.isFinite(sec) && sec > 0) {
      const nanos = Number(raw.nanos || 0);
      return Math.floor(sec * 1000 + (Number.isFinite(nanos) ? nanos / 1e6 : 0));
    }
  }
  return 0;
}

export function extractCatalogIndexFromSummaries(rawSummaries, extraSignals = null) {
  const map = {};
  const protectedMainIds = new Set();
  if (extraSignals && extraSignals.protectedMainIds) {
    const src = extraSignals.protectedMainIds;
    const iter = src instanceof Set || Array.isArray(src) ? src : Object.keys(src);
    for (const raw of iter) {
      const id = String(raw || '').trim().toLowerCase();
      if (GUID_RE.test(id)) protectedMainIds.add(id);
    }
  }
  const chapterTitleIds = new Set();
  if (extraSignals && extraSignals.chapterTitleIds) {
    const src = extraSignals.chapterTitleIds;
    const iter = src instanceof Set || Array.isArray(src) ? src : Object.keys(src);
    for (const raw of iter) {
      const id = String(raw || '').trim().toLowerCase();
      if (GUID_RE.test(id)) chapterTitleIds.add(id);
    }
  }
  const discoveredSubs = new Map();
  if (extraSignals && extraSignals.discoveredSubagents) {
    const rawDisc = extraSignals.discoveredSubagents;
    const pairs =
      rawDisc instanceof Map
        ? [...rawDisc.entries()]
        : Array.isArray(rawDisc)
          ? rawDisc.map((x) => (typeof x === 'string' ? [x, {}] : [x?.id || x?.cascadeId || '', x || {}]))
          : typeof rawDisc === 'object'
            ? Object.entries(rawDisc)
            : [];
    for (const [rawId, info] of pairs) {
      const id = String(rawId || '').trim().toLowerCase();
      if (!GUID_RE.test(id)) continue;
      const pid = String(info?.parentId || info?.parentConversationId || '').trim().toLowerCase();
      discoveredSubs.set(id, {
        ...(GUID_RE.test(pid) && pid !== id ? { parentId: pid } : {}),
        ...(Number(info?.lastModifiedMs) > 0 ? { lastModifiedMs: Number(info.lastModifiedMs) } : {}),
      });
    }
  }

  const entries = Array.isArray(rawSummaries)
    ? rawSummaries.map((s) => [s?.id || s?.cascadeId || '', s])
    : Object.entries(rawSummaries || {});
  for (const [rawId, s] of entries) {
    const id = String(rawId || s?.id || s?.cascadeId || '').trim().toLowerCase();
    if (!GUID_RE.test(id) || !s || typeof s !== 'object') continue;
    const meta = s.trajectoryMetadata && typeof s.trajectoryMetadata === 'object' ? s.trajectoryMetadata : {};
    const rawParentId = String(
      s.parentConversationId ||
        meta.parentConversationId ||
        s.parentId ||
        s.parentCascadeId ||
        meta.parentCascadeId ||
        s.parentTrajectoryId ||
        meta.parentTrajectoryId ||
        ''
    ).trim().toLowerCase();
    const parentId = rawParentId && rawParentId !== id ? rawParentId : '';
    const rawRootId = String(
      s.rootConversationId ||
        meta.rootConversationId ||
        s.rootId ||
        s.rootCascadeId ||
        meta.rootCascadeId ||
        ''
    ).trim().toLowerCase();
    const rootId = rawRootId && rawRootId !== id ? rawRootId : '';
    const swarmId = String(s.swarmId || meta.swarmId || '').trim();
    const subagentName = String(s.subagentName || meta.subagentName || '').trim();
    const selfPoison = Boolean((rawParentId && rawParentId === id) || (!parentId && rawRootId && rawRootId === id));
    const explicitSubagent = Boolean(
      (s.subagent === true && !selfPoison) ||
        Boolean(parentId) ||
        Boolean(rootId) ||
        Number(meta.nestingDepth || s.nestingDepth || 0) > 0 ||
        s.isSubagent === true ||
        meta.isSubagent === true ||
        Boolean(subagentName) ||
        Boolean(swarmId)
    );
    const discInfo = discoveredSubs.get(id) || null;
    const isProtectedMain = protectedMainIds.has(id) && !explicitSubagent;
    const subagent = !isProtectedMain && (explicitSubagent || Boolean(discInfo && !chapterTitleIds.has(id)));
    const discParent =
      discInfo?.parentId && String(discInfo.parentId).trim().toLowerCase() !== id
        ? String(discInfo.parentId).trim().toLowerCase()
        : '';
    const resolvedParentId = parentId || discParent || '';
    const lastModifiedMs =
      parseSummaryTimeMs(s.lastModifiedTime) ||
      parseSummaryTimeMs(s.modifiedAt) ||
      parseSummaryTimeMs(s.updatedAt) ||
      parseSummaryTimeMs(s.createdTime) ||
      (discInfo?.lastModifiedMs || 0);
    map[id] = {
      subagent,
      ...(isProtectedMain ? { protectedMain: true } : {}),
      ...(resolvedParentId ? { parentId: resolvedParentId } : {}),
      ...(rootId ? { rootId } : {}),
      status: String(s.status ?? ''),
      stepCount: Math.max(0, Number(s.stepCount ?? s.numTotalSteps ?? 0) || 0),
      title: String(s.summary || s.title || '').slice(0, 120),
      ...(lastModifiedMs > 0 ? { lastModifiedMs } : {}),
    };
  }

  // Supplement with subagents discovered via invokeSubagent / delegatedConversations that are absent from Redux summaries
  for (const [id, discInfo] of discoveredSubs.entries()) {
    if (map[id]) continue;
    if (protectedMainIds.has(id) || chapterTitleIds.has(id)) continue;
    map[id] = {
      subagent: true,
      ...(discInfo.parentId ? { parentId: discInfo.parentId } : {}),
      status: '',
      stepCount: 0,
      title: '',
      source: 'discovered',
      ...(discInfo.lastModifiedMs > 0 ? { lastModifiedMs: discInfo.lastModifiedMs } : {}),
    };
  }

  // Pin explicitly visible main conversations in the allowlist as main to protect them unconditionally
  for (const mainId of protectedMainIds) {
    if (!map[mainId]) {
      map[mainId] = {
        subagent: false,
        protectedMain: true,
        status: '',
        stepCount: 0,
        title: '',
      };
    }
  }
  return map;
}

export function saveCatalogIndex(archiveDir, rawSummaries, opts = {}) {
  const safeArchive = ensureSafeDir(archiveDir);
  const mergeExisting = opts?.mergeExisting !== false;
  const maxEntries = Number.isInteger(opts?.maxEntries) && opts.maxEntries > 0 ? opts.maxEntries : MAX_CATALOG_ENTRIES;
  const fresh = extractCatalogIndexFromSummaries(rawSummaries, opts?.extraSignals || null);

  let merged = fresh;
  if (mergeExisting) {
    const existing = loadCatalogIndex(safeArchive);
    if (existing && existing.entries && typeof existing.entries === 'object') {
      merged = Object.create(null);
      for (const [rawId, prev] of Object.entries(existing.entries)) {
        const id = String(rawId || '').trim().toLowerCase();
        if (!GUID_RE.test(id) || !prev || typeof prev !== 'object') continue;
        merged[id] = prev;
      }
      for (const [id, next] of Object.entries(fresh)) {
        const prev = merged[id];
        if (prev && prev.subagent === true && !next.subagent && !next.protectedMain) {
          // Prevent v2.34+ Redux/searchConversations entries lacking parent fields from overwriting authoritative subagent classification
          merged[id] = {
            ...prev,
            ...(next.title && !prev.title ? { title: next.title } : {}),
            ...(next.status ? { status: next.status } : {}),
            ...(Number(next.stepCount) > Number(prev.stepCount || 0) ? { stepCount: next.stepCount } : {}),
            ...(Number(next.lastModifiedMs) > Number(prev.lastModifiedMs || 0) ? { lastModifiedMs: next.lastModifiedMs } : {}),
          };
        } else if (prev && prev.protectedMain === true && (!next.subagent || next.source === 'discovered')) {
          // Preserve previously confirmed sidebar-visible main allowlist mark against DOM-less refreshes or heuristic discovery
          merged[id] = next.subagent
            ? { ...prev, subagent: false, protectedMain: true }
            : { ...next, subagent: false, protectedMain: true };
        } else {
          merged[id] = next;
        }
      }
      const keys = Object.keys(merged);
      if (keys.length > maxEntries) {
        keys.sort((a, b) => (Number(merged[b]?.lastModifiedMs) || 0) - (Number(merged[a]?.lastModifiedMs) || 0));
        const trimmed = Object.create(null);
        for (let i = 0; i < maxEntries; i += 1) {
          trimmed[keys[i]] = merged[keys[i]];
        }
        merged = trimmed;
      }
    }
  }

  const plainEntries = {};
  for (const [k, v] of Object.entries(merged)) plainEntries[k] = v;
  const payload = {
    schema: 1,
    updatedAt: new Date().toISOString(),
    count: Object.keys(plainEntries).length,
    entries: plainEntries,
  };
  const indexPath = path.join(safeArchive, INDEX_FILENAME);
  atomicWriteJsonSync(indexPath, payload);
  return { indexPath, count: payload.count, entries: plainEntries };
}

export function loadCatalogIndex(archiveDir) {
  try {
    const indexPath = path.join(path.resolve(archiveDir), INDEX_FILENAME);
    const st = assertPathChainNoSymlinks(indexPath, 'catalog index');
    if (!st || !st.isFile()) return null;
    const parsed = JSON.parse(fs.readFileSync(indexPath, 'utf8'));
    if (!parsed || parsed.schema !== 1 || !parsed.entries || typeof parsed.entries !== 'object') {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export async function loadCatalogIndexAsync(archiveDir) {
  try {
    const indexPath = path.join(path.resolve(archiveDir), INDEX_FILENAME);
    const st = await assertPathChainNoSymlinksAsync(indexPath, 'catalog index');
    if (!st || !st.isFile()) return null;
    const parsed = JSON.parse(await fs.promises.readFile(indexPath, 'utf8'));
    if (!parsed || parsed.schema !== 1 || !parsed.entries || typeof parsed.entries !== 'object') {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function normalizeNonNegativeThreshold(value, fallback, { integer = false } = {}) {
  if (value === null || value === undefined || typeof value === 'boolean') return fallback;
  if (typeof value === 'string' && value.trim() === '') return fallback;
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return fallback;
  return integer ? Math.floor(n) : n;
}

const ASYNC_SCAN_LSTAT_CONCURRENCY = 24;
const TOP_CONSUMERS_LIMIT = 5;

// Aligned with main.mjs sanitizeSecretText plus rk-/pk-/ak-/AKIA and control-char redaction
const REPORT_URL_CREDENTIALS_RE = /https?:\/\/[^/\s:@]+:[^/\s@]+@/gi;
const REPORT_URL_SECRET_QUERY_RE = /([?&](?:token|auth|signature|key|secret)=)[^&\s#"']+/gi;
const REPORT_BEARER_RE = /\bBearer\s+[A-Za-z0-9._\-]{8,}\b/gi;
const REPORT_SECRET_TOKEN_RE =
  /(?:(?:sk|rk|pk|ak)[_-][A-Za-z0-9_\-]{6,}|AIza[A-Za-z0-9_\-]{12,}|AKIA[0-9A-Z]{12,}|xai-[A-Za-z0-9_\-]{8,}|ghp_[A-Za-z0-9]{12,}|github_pat_[A-Za-z0-9_]{12,})/gi;

export function sanitizeTitleForReport(raw) {
  return String(raw || '')
    .replace(/[\x00-\x1f\x7f]/g, ' ')
    .replace(REPORT_URL_CREDENTIALS_RE, 'https://***@')
    .replace(REPORT_URL_SECRET_QUERY_RE, '$1[REDACTED]')
    .replace(REPORT_BEARER_RE, 'Bearer [REDACTED]')
    .replace(REPORT_SECRET_TOKEN_RE, '[REDACTED]')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 72);
}

function buildStorageScanReport({
  safeConvDir,
  safeArchiveDir,
  catalogEntries,
  catalogUpdatedAt,
  groups,
  totalBytes,
  walBytes,
  fileCount,
  subagentMaxAgeHours,
  mainMaxAgeDays,
  keepRecentMain,
  excluded,
  lsMemoryMb = null,
  now,
}) {
  const items = [];
  for (const g of groups.values()) {
    const info = catalogEntries ? catalogEntries[g.id] || null : null;
    const kind = info ? (info.subagent ? 'subagent' : 'main') : 'unknown';
    // Age calculation ignores .db-shm (Antigravity restarts touch all .db-shm mtimes) and 0-byte .db-wal:
    // prefer authoritative host RPC lastModifiedMs, falling back to latest mtime of main .db and non-empty .db-wal.
    const fileMtimeMs = Math.max(g.dbMtimeMs || 0, g.walNonEmptyMtimeMs || 0) || g.mtimeMs || 0;
    const rpcMs = info && Number(info.lastModifiedMs) > 0 ? Number(info.lastModifiedMs) : 0;
    const activityMs = rpcMs > 0 ? rpcMs : fileMtimeMs;
    const ageMs = Math.max(0, now - activityMs);
    items.push({
      id: g.id,
      kind,
      subagent: kind === 'subagent',
      bytes: g.bytes,
      mb: Number((g.bytes / 1048576).toFixed(2)),
      mtimeMs: activityMs,
      ageHours: Number((ageMs / 3600000).toFixed(2)),
      ageDays: Number((ageMs / 86400000).toFixed(2)),
      status: info?.status || '',
      running: isRunningTrajectoryStatus(info?.status),
      stepCount: info?.stepCount || 0,
      title: info?.title || '',
      parentId: info?.parentId || '',
      files: g.files,
      excluded: excluded.has(g.id),
    });
  }

  const safeKeepRecentMain = normalizeNonNegativeThreshold(keepRecentMain, DEFAULT_KEEP_RECENT_MAIN, { integer: true });
  const safeSubagentMaxAgeHours = normalizeNonNegativeThreshold(subagentMaxAgeHours, DEFAULT_SUBAGENT_MAX_AGE_HOURS);
  const safeMainMaxAgeDays = normalizeNonNegativeThreshold(mainMaxAgeDays, DEFAULT_MAIN_MAX_AGE_DAYS);

  const mainItems = items.filter((it) => it.kind === 'main').sort((a, b) => b.mtimeMs - a.mtimeMs);
  const protectedMainIds = new Set(mainItems.slice(0, safeKeepRecentMain).map((it) => it.id));

  const subagentMinAgeMs = safeSubagentMaxAgeHours * 3600000;
  const mainMinAgeMs = safeMainMaxAgeDays * 86400000;

  const archivableSubagents = [];
  const archivableOldMain = [];
  let subagentBytes = 0;
  let mainBytes = 0;
  let unknownBytes = 0;
  let subagentCount = 0;
  let mainCount = 0;
  let unknownCount = 0;

  for (const it of items) {
    if (it.kind === 'subagent') {
      subagentCount++;
      subagentBytes += it.bytes;
      if (!it.excluded && !it.running && now - it.mtimeMs >= subagentMinAgeMs) {
        archivableSubagents.push(it);
      }
    } else if (it.kind === 'main') {
      mainCount++;
      mainBytes += it.bytes;
      if (!it.excluded && !it.running && !protectedMainIds.has(it.id) && now - it.mtimeMs >= mainMinAgeMs) {
        archivableOldMain.push(it);
      }
    } else {
      unknownCount++;
      unknownBytes += it.bytes;
    }
  }

  archivableSubagents.sort((a, b) => b.bytes - a.bytes);
  archivableOldMain.sort((a, b) => b.bytes - a.bytes);

  const topConsumers = [...items]
    .sort((a, b) => b.bytes - a.bytes)
    .slice(0, TOP_CONSUMERS_LIMIT)
    .map((it) => ({
      id: it.id,
      kind: it.kind,
      mb: it.mb,
      ageDays: it.ageDays,
      running: it.running,
      title: sanitizeTitleForReport(it.title),
    }));

  const totalMb = Number((totalBytes / 1048576).toFixed(1));
  const subagentMb = Number((subagentBytes / 1048576).toFixed(1));
  const mainMb = Number((mainBytes / 1048576).toFixed(1));
  const unknownMb = Number((unknownBytes / 1048576).toFixed(1));
  const archivableSubagentBytes = archivableSubagents.reduce((s, x) => s + x.bytes, 0);
  const archivableOldMainBytes = archivableOldMain.reduce((s, x) => s + x.bytes, 0);
  const validLsMemMb = Number.isFinite(Number(lsMemoryMb)) && Number(lsMemoryMb) > 0 ? Number(Number(lsMemoryMb).toFixed(1)) : null;

  const warnReasons = [];
  if (totalMb >= WARN_TOTAL_MB) warnReasons.push('total');
  if (subagentMb >= WARN_SUBAGENT_MB) warnReasons.push('subagent');
  if (validLsMemMb !== null && validLsMemMb >= WARN_LS_MEMORY_MB) warnReasons.push('ls-memory');

  return {
    ok: true,
    convDir: safeConvDir,
    archiveDir: safeArchiveDir,
    hasCatalogIndex: Boolean(catalogEntries && Object.keys(catalogEntries).length > 0),
    catalogUpdatedAt,
    fileCount,
    conversationCount: items.length,
    totalBytes,
    totalMb,
    walMb: Number((walBytes / 1048576).toFixed(1)),
    mainCount,
    mainMb,
    subagentCount,
    subagentMb,
    unknownCount,
    unknownMb,
    archivableSubagentCount: archivableSubagents.length,
    archivableSubagentMb: Number((archivableSubagentBytes / 1048576).toFixed(1)),
    archivableOldMainCount: archivableOldMain.length,
    archivableOldMainMb: Number((archivableOldMainBytes / 1048576).toFixed(1)),
    lsMemoryMb: validLsMemMb,
    warn: warnReasons.length > 0,
    warnReasons,
    warnThresholds: { totalMb: WARN_TOTAL_MB, subagentMb: WARN_SUBAGENT_MB, lsMemoryMb: WARN_LS_MEMORY_MB },
    topConsumers,
    archivableSubagents,
    archivableOldMain,
  };
}

export function scanConversationStorage({
  convDir = getDefaultConversationsDir(),
  archiveDir = getDefaultArchiveDir(),
  summaries = null,
  extraSignals = null,
  subagentMaxAgeHours = DEFAULT_SUBAGENT_MAX_AGE_HOURS,
  mainMaxAgeDays = DEFAULT_MAIN_MAX_AGE_DAYS,
  keepRecentMain = DEFAULT_KEEP_RECENT_MAIN,
  excludeIds = [],
  lsMemoryMb = null,
  now = Date.now(),
} = {}) {
  const safeConvDir = path.resolve(convDir);
  const safeArchiveDir = path.resolve(archiveDir);
  const convStat = assertPathChainNoSymlinks(safeConvDir, 'conversations directory');
  const excluded = new Set((excludeIds || []).map((x) => String(x || '').trim().toLowerCase()).filter(Boolean));

  let catalogEntries = null;
  let catalogUpdatedAt = null;
  if (summaries && typeof summaries === 'object') {
    catalogEntries = extractCatalogIndexFromSummaries(summaries, extraSignals);
    catalogUpdatedAt = new Date(now).toISOString();
  } else {
    const loaded = loadCatalogIndex(safeArchiveDir);
    if (loaded) {
      catalogEntries = loaded.entries;
      catalogUpdatedAt = loaded.updatedAt || null;
    }
  }

  const groups = new Map();
  let totalBytes = 0;
  let walBytes = 0;
  let fileCount = 0;

  if (convStat && convStat.isDirectory()) {
    for (const dirent of fs.readdirSync(safeConvDir, { withFileTypes: true })) {
      if (dirent.isSymbolicLink() || !dirent.isFile()) continue;
      const m = DB_FILE_RE.exec(dirent.name);
      if (!m) continue;
      const id = m[1].toLowerCase();
      const suffix = m[2] ? m[2].toLowerCase() : 'db';
      const fullPath = path.join(safeConvDir, dirent.name);
      let st;
      try {
        st = fs.lstatSync(fullPath);
        if (st.isSymbolicLink() || !st.isFile()) continue;
      } catch {
        continue;
      }
      fileCount++;
      totalBytes += st.size;
      if (suffix === 'wal' || suffix === 'shm') walBytes += st.size;
      let g = groups.get(id);
      if (!g) {
        g = { id, files: [], bytes: 0, mtimeMs: 0, dbMtimeMs: 0, walNonEmptyMtimeMs: 0, hasDb: false };
        groups.set(id, g);
      }
      g.files.push({ name: dirent.name, bytes: st.size, suffix });
      g.bytes += st.size;
      if (suffix === 'db') {
        g.hasDb = true;
        if (st.mtimeMs > g.dbMtimeMs) g.dbMtimeMs = st.mtimeMs;
      } else if (suffix === 'wal' && st.size > 0) {
        if (st.mtimeMs > g.walNonEmptyMtimeMs) g.walNonEmptyMtimeMs = st.mtimeMs;
      }
      if (suffix !== 'shm' && st.mtimeMs > g.mtimeMs) g.mtimeMs = st.mtimeMs;
    }
  }

  return buildStorageScanReport({
    safeConvDir,
    safeArchiveDir,
    catalogEntries,
    catalogUpdatedAt,
    groups,
    totalBytes,
    walBytes,
    fileCount,
    subagentMaxAgeHours,
    mainMaxAgeDays,
    keepRecentMain,
    excluded,
    lsMemoryMb,
    now,
  });
}

export async function scanConversationStorageAsync({
  convDir = getDefaultConversationsDir(),
  archiveDir = getDefaultArchiveDir(),
  summaries = null,
  extraSignals = null,
  subagentMaxAgeHours = DEFAULT_SUBAGENT_MAX_AGE_HOURS,
  mainMaxAgeDays = DEFAULT_MAIN_MAX_AGE_DAYS,
  keepRecentMain = DEFAULT_KEEP_RECENT_MAIN,
  excludeIds = [],
  lsMemoryMb = null,
  now = Date.now(),
  concurrency = ASYNC_SCAN_LSTAT_CONCURRENCY,
} = {}) {
  const safeConvDir = path.resolve(convDir);
  const safeArchiveDir = path.resolve(archiveDir);
  const convStat = await assertPathChainNoSymlinksAsync(safeConvDir, 'conversations directory');
  const excluded = new Set((excludeIds || []).map((x) => String(x || '').trim().toLowerCase()).filter(Boolean));

  let catalogEntries = null;
  let catalogUpdatedAt = null;
  if (summaries && typeof summaries === 'object') {
    catalogEntries = extractCatalogIndexFromSummaries(summaries, extraSignals);
    catalogUpdatedAt = new Date(now).toISOString();
  } else {
    const loaded = await loadCatalogIndexAsync(safeArchiveDir);
    if (loaded) {
      catalogEntries = loaded.entries;
      catalogUpdatedAt = loaded.updatedAt || null;
    }
  }

  const groups = new Map();
  let totalBytes = 0;
  let walBytes = 0;
  let fileCount = 0;

  if (convStat && convStat.isDirectory()) {
    const dirents = await fs.promises.readdir(safeConvDir, { withFileTypes: true });
    const candidates = [];
    for (const dirent of dirents) {
      if (dirent.isSymbolicLink() || !dirent.isFile()) continue;
      const m = DB_FILE_RE.exec(dirent.name);
      if (!m) continue;
      candidates.push({
        name: dirent.name,
        id: m[1].toLowerCase(),
        suffix: m[2] ? m[2].toLowerCase() : 'db',
        fullPath: path.join(safeConvDir, dirent.name),
      });
    }

    const stats = new Array(candidates.length).fill(null);
    const maxWorkers = Math.max(1, Math.min(Number(concurrency) || ASYNC_SCAN_LSTAT_CONCURRENCY, candidates.length));
    let cursor = 0;
    const worker = async () => {
      while (true) {
        const idx = cursor++;
        if (idx >= candidates.length) return;
        try {
          const st = await fs.promises.lstat(candidates[idx].fullPath);
          if (!st.isSymbolicLink() && st.isFile()) {
            stats[idx] = st;
          }
        } catch {}
      }
    };
    if (candidates.length > 0) {
      await Promise.all(Array.from({ length: maxWorkers }, () => worker()));
    }

    for (let i = 0; i < candidates.length; i++) {
      const st = stats[i];
      if (!st) continue;
      const { name, id, suffix } = candidates[i];
      fileCount++;
      totalBytes += st.size;
      if (suffix === 'wal' || suffix === 'shm') walBytes += st.size;
      let g = groups.get(id);
      if (!g) {
        g = { id, files: [], bytes: 0, mtimeMs: 0, dbMtimeMs: 0, walNonEmptyMtimeMs: 0, hasDb: false };
        groups.set(id, g);
      }
      g.files.push({ name, bytes: st.size, suffix });
      g.bytes += st.size;
      if (suffix === 'db') {
        g.hasDb = true;
        if (st.mtimeMs > g.dbMtimeMs) g.dbMtimeMs = st.mtimeMs;
      } else if (suffix === 'wal' && st.size > 0) {
        if (st.mtimeMs > g.walNonEmptyMtimeMs) g.walNonEmptyMtimeMs = st.mtimeMs;
      }
      if (suffix !== 'shm' && st.mtimeMs > g.mtimeMs) g.mtimeMs = st.mtimeMs;
    }
  }

  return buildStorageScanReport({
    safeConvDir,
    safeArchiveDir,
    catalogEntries,
    catalogUpdatedAt,
    groups,
    totalBytes,
    walBytes,
    fileCount,
    subagentMaxAgeHours,
    mainMaxAgeDays,
    keepRecentMain,
    excluded,
    lsMemoryMb,
    now,
  });
}

function collectLiveCompanionFiles(convDir, id) {
  const suffixes = ['.db', '.db-wal', '.db-shm'];
  const found = [];
  for (const sfx of suffixes) {
    const name = `${id}${sfx}`;
    const full = path.join(convDir, name);
    const st = assertPathChainNoSymlinks(full, 'conversation file');
    if (st && st.isFile()) {
      found.push({ name, bytes: st.size });
    }
  }
  return found;
}

export function archiveConversations({
  convDir = getDefaultConversationsDir(),
  archiveDir = getDefaultArchiveDir(),
  summaries = null,
  mode = 'subagents',
  subagentMaxAgeHours = 6,
  mainMaxAgeDays = 14,
  keepRecentMain = 20,
  excludeIds = [],
  dryRun = false,
  now = Date.now(),
  checkRunning = isLanguageServerRunning,
} = {}) {
  const scan = scanConversationStorage({
    convDir,
    archiveDir,
    summaries,
    subagentMaxAgeHours,
    mainMaxAgeDays,
    keepRecentMain,
    excludeIds,
    now,
  });

  if (!scan.hasCatalogIndex) {
    return {
      ok: false,
      code: 'NO_CATALOG_INDEX',
      error: 'Conversation classification index not found (cannot distinguish hidden subagents from main chats). Run --prepare while Antigravity is running or click "Generate Archive Scripts" in Settings to refresh the index.',
      scan,
    };
  }

  const targets =
    mode === 'subagents+old-main'
      ? [...scan.archivableSubagents, ...scan.archivableOldMain]
      : [...scan.archivableSubagents];

  const targetBytes = targets.reduce((s, x) => s + x.bytes, 0);
  if (dryRun) {
    return {
      ok: true,
      dryRun: true,
      mode,
      candidateCount: targets.length,
      candidateMb: Number((targetBytes / 1048576).toFixed(1)),
      remainingEstimatedMb: Number(Math.max(0, (scan.totalBytes - targetBytes) / 1048576).toFixed(1)),
      targets: targets.map((t) => ({ id: t.id, kind: t.kind, mb: t.mb, ageHours: t.ageHours, title: t.title })),
      scan,
    };
  }

  const isRunning = () => {
    try {
      return typeof checkRunning === 'function' ? Boolean(checkRunning()) : isLanguageServerRunning();
    } catch {
      return true; // fail-closed
    }
  };

  if (isRunning()) {
    return {
      ok: false,
      code: 'LANGUAGE_SERVER_RUNNING',
      error: 'Detected language_server running (or process state cannot be verified). To prevent data corruption, fully quit Antigravity before running the archive script.',
      candidateCount: targets.length,
      candidateMb: Number((targetBytes / 1048576).toFixed(1)),
    };
  }

  if (targets.length === 0) {
    return {
      ok: true,
      dryRun: false,
      mode,
      movedCount: 0,
      movedMb: 0,
      batchDir: null,
      message: 'No eligible finished subagents or expired conversations to archive; nothing was moved.',
    };
  }

  return withArchiveLock(scan.archiveDir, () => {
    const { batchName, batchDir } = createExclusiveBatchDir(scan.archiveDir, now);
    const manifestPath = path.join(batchDir, 'manifest.json');
    const movedItems = [];
    const failedItems = [];
    const partialSplits = [];
    let movedBytes = 0;
    let abortedByHostRestart = false;

    const persistManifest = (status) => {
      const m = {
        schema: 1,
        status,
        batchName,
        createdAt: new Date(now).toISOString(),
        updatedAt: new Date().toISOString(),
        mode,
        sourceConvDir: scan.convDir,
        movedCount: movedItems.length,
        movedBytes,
        movedMb: Number((movedBytes / 1048576).toFixed(1)),
        failedCount: failedItems.length,
        rollbackFailed: partialSplits.length > 0,
        abortedByHostRestart,
        partialSplits,
        items: movedItems,
      };
      atomicWriteJsonSync(manifestPath, m);
      return m;
    };

    // Write pre-move journal manifest BEFORE moving any file so crashes are always discoverable
    persistManifest('in-progress');

    for (const item of targets) {
      if (isRunning()) {
        abortedByHostRestart = true;
        failedItems.push({ id: item.id, error: 'LANGUAGE_SERVER_STARTED_MID_ARCHIVE' });
        break;
      }
      let liveFiles;
      try {
        liveFiles = collectLiveCompanionFiles(scan.convDir, item.id);
      } catch (err) {
        failedItems.push({ id: item.id, error: err?.message || String(err) });
        continue;
      }
      if (liveFiles.length === 0) continue;

      const movedFiles = [];
      let itemFailed = null;
      for (const f of liveFiles) {
        const src = path.join(scan.convDir, f.name);
        const dst = path.join(batchDir, f.name);
        try {
          safeMoveFileSync(src, dst);
          movedFiles.push(f.name);
        } catch (err) {
          itemFailed = err?.message || String(err);
          const rollbackErrors = [];
          for (const backName of [...movedFiles].reverse()) {
            try {
              safeMoveFileSync(path.join(batchDir, backName), path.join(scan.convDir, backName));
            } catch (rbErr) {
              rollbackErrors.push({
                file: backName,
                stuckAt: path.join(batchDir, backName),
                expectedAt: path.join(scan.convDir, backName),
                error: rbErr?.message || String(rbErr),
              });
            }
          }
          if (rollbackErrors.length > 0) {
            partialSplits.push({ id: item.id, originalError: itemFailed, rollbackErrors });
          }
          break;
        }
      }
      if (itemFailed) {
        failedItems.push({ id: item.id, error: itemFailed });
      } else {
        const bundleBytes = liveFiles.reduce((s, f) => s + f.bytes, 0);
        movedBytes += bundleBytes;
        movedItems.push({
          id: item.id,
          kind: item.kind,
          bytes: bundleBytes,
          mb: Number((bundleBytes / 1048576).toFixed(2)),
          title: item.title,
          parentId: item.parentId,
          files: movedFiles,
        });
      }
      // Incrementally commit manifest after each conversation so crash recovery never loses track
      persistManifest('in-progress');
      if (isRunning()) {
        abortedByHostRestart = true;
        break;
      }
    }

    const finalManifest = persistManifest(abortedByHostRestart ? 'aborted' : 'completed');

    return {
      ok: failedItems.length === 0 && partialSplits.length === 0 && !abortedByHostRestart,
      ...(partialSplits.length > 0 ? { code: 'ROLLBACK_FAILED', error: 'Rollback failed for some conversation file bundles; check partialSplits in manifest.json to verify file locations.' } : {}),
      ...(abortedByHostRestart ? { code: 'LANGUAGE_SERVER_RUNNING', error: 'Detected Antigravity/language_server starting mid-archive; remaining moves were aborted immediately. Completed items can be restored via --restore latest.' } : {}),
      dryRun: false,
      mode,
      batchName,
      batchDir,
      movedCount: movedItems.length,
      movedMb: finalManifest.movedMb,
      failedItems,
      partialSplits,
      remainingEstimatedMb: Number(Math.max(0, (scan.totalBytes - movedBytes) / 1048576).toFixed(1)),
    };
  });
}

function scanBatchDirForFallbackItems(batchDir) {
  const byId = new Map();
  let totalBytes = 0;
  for (const dirent of fs.readdirSync(batchDir, { withFileTypes: true })) {
    if (dirent.isSymbolicLink() || !dirent.isFile()) continue;
    const m = DB_FILE_RE.exec(dirent.name);
    if (!m) continue;
    const id = m[1].toLowerCase();
    const st = fs.lstatSync(path.join(batchDir, dirent.name));
    if (st.isSymbolicLink() || !st.isFile()) continue;
    totalBytes += st.size;
    let rec = byId.get(id);
    if (!rec) {
      rec = { id, files: [], bytes: 0 };
      byId.set(id, rec);
    }
    rec.files.push(dirent.name);
    rec.bytes += st.size;
  }
  return { items: [...byId.values()], totalBytes };
}

export function listArchiveBatches(archiveDir = getDefaultArchiveDir()) {
  const safeArchiveRoot = path.resolve(archiveDir);
  const st = assertPathChainNoSymlinks(safeArchiveRoot, 'archive directory');
  if (!st || !st.isDirectory()) return [];
  const batches = [];
  for (const dirent of fs.readdirSync(safeArchiveRoot, { withFileTypes: true })) {
    if (dirent.isSymbolicLink() || !dirent.isDirectory() || !BATCH_NAME_RE.test(dirent.name)) continue;
    const batchDir = path.join(safeArchiveRoot, dirent.name);
    const manifestPath = path.join(batchDir, 'manifest.json');
    let parsed = null;
    try {
      const mStat = assertPathChainNoSymlinks(manifestPath, 'batch manifest');
      if (mStat && mStat.isFile()) {
        const raw = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
        if (raw && raw.schema === 1) parsed = raw;
      }
    } catch {}
    if (parsed) {
      batches.push({
        batchName: dirent.name,
        batchDir,
        status: parsed.status || 'completed',
        createdAt: parsed.createdAt || '',
        mode: parsed.mode || 'subagents',
        movedCount: Number(parsed.movedCount || 0),
        movedMb: Number(parsed.movedMb || 0),
        rollbackFailed: Boolean(parsed.rollbackFailed),
      });
    } else {
      // Crash-recovery discovery: surface batches containing orphaned DB files even if manifest is absent/corrupt
      try {
        const fb = scanBatchDirForFallbackItems(batchDir);
        if (fb.items.length > 0) {
          batches.push({
            batchName: dirent.name,
            batchDir,
            status: 'recovered-no-manifest',
            createdAt: '',
            mode: 'unknown',
            movedCount: fb.items.length,
            movedMb: Number((fb.totalBytes / 1048576).toFixed(1)),
            rollbackFailed: false,
          });
        }
      } catch {}
    }
  }
  batches.sort((a, b) => String(b.batchName).localeCompare(String(a.batchName)));
  return batches;
}

export function restoreArchiveBatch({
  convDir = getDefaultConversationsDir(),
  archiveDir = getDefaultArchiveDir(),
  batchName = 'latest',
  checkRunning = isLanguageServerRunning,
} = {}) {
  const isRunning = () => {
    try {
      return typeof checkRunning === 'function' ? Boolean(checkRunning()) : isLanguageServerRunning();
    } catch {
      return true; // fail-closed
    }
  };
  if (isRunning()) {
    return {
      ok: false,
      code: 'LANGUAGE_SERVER_RUNNING',
      error: 'Detected Antigravity/language_server running (or state cannot be verified). Fully quit Antigravity before running one-click restore.',
    };
  }
  const safeConvDir = ensureSafeDir(convDir);
  const safeArchiveRoot = path.resolve(archiveDir);
  return withArchiveLock(safeArchiveRoot, () => {
    const batches = listArchiveBatches(safeArchiveRoot);
    if (batches.length === 0) {
      return { ok: false, code: 'NO_BATCH', error: 'No historical archive batches found.' };
    }
    const chosen =
      batchName === 'latest'
        ? batches[0]
        : BATCH_NAME_RE.test(String(batchName || ''))
        ? batches.find((b) => b.batchName === batchName)
        : null;
    if (!chosen) {
      return { ok: false, code: 'BATCH_NOT_FOUND', error: `Archive batch not found: ${batchName}` };
    }
    const manifestPath = path.join(chosen.batchDir, 'manifest.json');
    let restoreItems = [];
    try {
      const mStat = assertPathChainNoSymlinks(manifestPath, 'batch manifest');
      if (mStat && mStat.isFile()) {
        const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
        if (manifest && Array.isArray(manifest.items) && manifest.items.length > 0 && manifest.status === 'completed') {
          restoreItems = manifest.items;
        }
      }
    } catch {}
    // For missing/corrupt/in-progress manifests, synthesize directly from live files inside batchDir
    if (restoreItems.length === 0) {
      restoreItems = scanBatchDirForFallbackItems(chosen.batchDir).items;
    }

    const restored = [];
    const skipped = [];
    const failed = [];
    const partialSplits = [];

    for (const item of restoreItems) {
      if (isRunning()) {
        failed.push({ id: item.id, error: 'LANGUAGE_SERVER_STARTED_MID_RESTORE' });
        break;
      }
      const files = (Array.isArray(item.files) ? item.files : []).filter((fn) => typeof fn === 'string' && DB_FILE_RE.test(fn));
      if (files.length === 0) continue;
      const anyConflict = files.some((fn) => fs.existsSync(path.join(safeConvDir, fn)));
      if (anyConflict) {
        skipped.push({ id: item.id, reason: 'destination-exists' });
        continue;
      }
      const doneFiles = [];
      let errMsg = null;
      for (const fn of files) {
        const src = path.join(chosen.batchDir, fn);
        const dst = path.join(safeConvDir, fn);
        if (!fs.existsSync(src)) continue;
        try {
          safeMoveFileSync(src, dst);
          doneFiles.push(fn);
        } catch (err) {
          errMsg = err?.message || String(err);
          const rollbackErrors = [];
          for (const bfn of [...doneFiles].reverse()) {
            try {
              safeMoveFileSync(path.join(safeConvDir, bfn), path.join(chosen.batchDir, bfn));
            } catch (rbErr) {
              rollbackErrors.push({
                file: bfn,
                stuckAt: path.join(safeConvDir, bfn),
                expectedAt: path.join(chosen.batchDir, bfn),
                error: rbErr?.message || String(rbErr),
              });
            }
          }
          if (rollbackErrors.length > 0) {
            partialSplits.push({ id: item.id, originalError: errMsg, rollbackErrors });
          }
          break;
        }
      }
      if (errMsg) failed.push({ id: item.id, error: errMsg });
      else if (doneFiles.length > 0) restored.push(item.id);
    }

    return {
      ok: failed.length === 0 && partialSplits.length === 0,
      batchName: chosen.batchName,
      restoredCount: restored.length,
      skippedCount: skipped.length,
      failed,
      partialSplits,
    };
  });
}

function assertSafeHelperPath(p, label) {
  const s = String(p || '');
  if (!s || /[\r\n\0"&|<>^`$;!]/.test(s)) {
    throw new Error(`Unsafe characters in ${label}: refusing to generate shell script`);
  }
  return s;
}

function escapeBatchArg(p) {
  return `"${p.replace(/%/g, '%%')}"`;
}

function escapePosixSingleQuoted(p) {
  return `'${p.replace(/'/g, "'\\''")}'`;
}

function escapePsSingleQuoted(p) {
  return `'${String(p || '').replace(/'/g, "''")}'`;
}

export function validateBatchSelector(batchName = 'latest') {
  const raw = String(batchName ?? 'latest').trim() || 'latest';
  if (raw === 'latest') return 'latest';
  if (BATCH_NAME_RE.test(raw)) return raw;
  throw new Error(`Invalid archive batch name: ${raw.slice(0, 64)}`);
}

export function writeHelperScripts({
  scriptPath,
  archiveDir = getDefaultArchiveDir(),
  nodeExecPath = process.execPath,
  mode = 'subagents',
  subagentMaxAgeHours = AUTO_ARCHIVE_SUBAGENT_MAX_AGE_HOURS,
  mainDays = DEFAULT_MAIN_MAX_AGE_DAYS,
  keepRecentMain = DEFAULT_KEEP_RECENT_MAIN,
  restoreBatch = 'latest',
  writeArchiveScript = true,
  writeRestoreScript = true,
} = {}) {
  const safeArchive = ensureSafeDir(archiveDir);
  const absScript = assertSafeHelperPath(path.resolve(scriptPath), 'scriptPath');
  const isElectronHost = /antigravity(?:\.exe)?$/i.test(path.basename(nodeExecPath || ''));
  const safeNodeExec = isElectronHost ? 'node' : assertSafeHelperPath(path.resolve(nodeExecPath), 'nodeExecPath');
  const safeMode = mode === 'subagents+old-main' ? 'subagents+old-main' : 'subagents';
  const safeSubHours = normalizeNonNegativeThreshold(subagentMaxAgeHours, AUTO_ARCHIVE_SUBAGENT_MAX_AGE_HOURS);
  const safeMainDays = normalizeNonNegativeThreshold(mainDays, DEFAULT_MAIN_MAX_AGE_DAYS, { integer: true });
  const safeKeepMain = normalizeNonNegativeThreshold(keepRecentMain, DEFAULT_KEEP_RECENT_MAIN, { integer: true });
  const safeRestoreBatch = validateBatchSelector(restoreBatch);
  const archiveFlags =
    safeMode === 'subagents+old-main'
      ? `--archive --wait-exit --include-old-main --subagent-hours=${safeSubHours} --main-days=${safeMainDays} --keep-main=${safeKeepMain}`
      : `--archive --wait-exit --subagent-hours=${safeSubHours}`;
  const restoreFlags = `--restore ${safeRestoreBatch} --wait-exit`;

  if (process.platform === 'win32') {
    const nodeCmd = safeNodeExec === 'node' ? 'node' : escapeBatchArg(safeNodeExec);
    const scriptArg = escapeBatchArg(absScript);
    // Write subagents+old-main and specific-batch restore to dedicated filenames so defaults are never silently overwritten
    const archiveFilename = safeMode === 'subagents+old-main' ? 'archive-old-main.cmd' : 'archive-subagents.cmd';
    const restoreFilename = safeRestoreBatch === 'latest' ? 'restore-latest-archive.cmd' : `restore-${safeRestoreBatch}.cmd`;
    const archiveCmdPath = path.join(safeArchive, archiveFilename);
    const restoreCmdPath = path.join(safeArchive, restoreFilename);
    if (writeArchiveScript) {
      const archiveBanner =
        safeMode === 'subagents+old-main'
          ? `echo  Obsidian Prism - Safe Conversation Archiver (includes >${safeMainDays}d old main chats, keeps latest ${safeKeepMain}, move-only)`
          : 'echo  Obsidian Prism - Antigravity Safe Conversation Archiver (move-only, never deletes)';
      const archiveCmd = [
        '@echo off',
        'setlocal DisableDelayedExpansion',
        'chcp 65001 >nul',
        'echo ============================================================',
        archiveBanner,
        'echo ============================================================',
        'echo  Please ensure Antigravity is completely closed (wait for language_server.exe to exit)',
        'echo.',
        `${nodeCmd} ${scriptArg} ${archiveFlags}`,
        'echo.',
        'pause',
        '',
      ].join('\r\n');
      atomicWriteTextExclusiveSync(archiveCmdPath, archiveCmd, 0o600);
    }
    if (writeRestoreScript) {
      const restoreCmd = [
        '@echo off',
        'setlocal DisableDelayedExpansion',
        'chcp 65001 >nul',
        'echo ============================================================',
        `echo  Obsidian Prism - One-Click Lossless Archive Restore (${safeRestoreBatch})`,
        'echo ============================================================',
        'echo  Please ensure Antigravity is completely closed (wait for language_server.exe to exit)',
        'echo.',
        `${nodeCmd} ${scriptArg} ${restoreFlags}`,
        'echo.',
        'pause',
        '',
      ].join('\r\n');
      atomicWriteTextExclusiveSync(restoreCmdPath, restoreCmd, 0o600);
    }
    return {
      archiveScriptPath: writeArchiveScript ? archiveCmdPath : '',
      restoreScriptPath: writeRestoreScript ? restoreCmdPath : '',
      archiveDir: safeArchive,
      mode: safeMode,
      restoreBatch: safeRestoreBatch,
    };
  }

  const ext = process.platform === 'darwin' ? '.command' : '.sh';
  const nodeCmd = safeNodeExec === 'node' ? 'node' : escapePosixSingleQuoted(safeNodeExec);
  const scriptArg = escapePosixSingleQuoted(absScript);
  const archiveFilename = safeMode === 'subagents+old-main' ? `archive-old-main${ext}` : `archive-subagents${ext}`;
  const restoreFilename = safeRestoreBatch === 'latest' ? `restore-latest-archive${ext}` : `restore-${safeRestoreBatch}${ext}`;
  const archiveShPath = path.join(safeArchive, archiveFilename);
  const restoreShPath = path.join(safeArchive, restoreFilename);
  if (writeArchiveScript) {
    const archiveSh = `#!/usr/bin/env bash\nset -euo pipefail\n${nodeCmd} ${scriptArg} ${archiveFlags}\n`;
    atomicWriteTextExclusiveSync(archiveShPath, archiveSh, 0o700);
  }
  if (writeRestoreScript) {
    const restoreSh = `#!/usr/bin/env bash\nset -euo pipefail\n${nodeCmd} ${scriptArg} ${restoreFlags}\n`;
    atomicWriteTextExclusiveSync(restoreShPath, restoreSh, 0o700);
  }
  return {
    archiveScriptPath: writeArchiveScript ? archiveShPath : '',
    restoreScriptPath: writeRestoreScript ? restoreShPath : '',
    archiveDir: safeArchive,
    mode: safeMode,
    restoreBatch: safeRestoreBatch,
  };
}

const STORAGE_WB_I18N = {
  en: {
    summary: 'Storage Details & Lossless Archive Workbench',
    archiveOldMain: 'Include >14d Main',
    restoreBtn: 'Offline Restore Script',
    refreshBtn: 'Refresh',
    restoreReadyTpl: 'Restore script ready ({0}): {1} (quit Antigravity first)',
    oldMainReadyTpl: 'Old-main archive script ready ({0} items / {1}): {2} (quit Antigravity first)',
    breakdown: 'Breakdown',
    main: 'Main',
    subagent: 'Subagents',
    wal: 'WAL',
    unknown: 'Unindexed',
    lsMem: 'Background RAM',
    archivable: 'Archivable',
    archSub: 'Finished subagents',
    archOld: 'Old main >14d (keeps latest 20)',
    topTitle: 'Top 5 Largest Conversations (Read-only)',
    batchTitle: 'Lossless Archive Batches',
    none: 'None',
    hint: 'Zero-loss policy: move-only with manifest.json for per-batch restore; quit Antigravity before running helper scripts.',
  },
  ar: {
    summary: 'تفاصيل التخزين ومنصة الأرشفة بدون فقدان',
    archiveOldMain: 'تضمين المحادثات الرئيسية الأقدم من 14 يوماً',
    restoreBtn: 'سكربت الاستعادة دون اتصال',
    refreshBtn: 'تحديث',
    restoreReadyTpl: 'سكربت الاستعادة جاهز ({0}): {1} (أغلق Antigravity أولاً)',
    oldMainReadyTpl: 'سكربت أرشفة المحادثات القديمة جاهز ({0} عنصر / {1}): {2} (أغلق Antigravity أولاً)',
    breakdown: 'توزيع المساحة',
    main: 'الرئيسية',
    subagent: 'الوكلاء الفرعيون',
    wal: 'سجل WAL',
    unknown: 'غير مفهرس',
    lsMem: 'ذاكرة الخدمة الخلفية',
    archivable: 'قابل للأرشفة الآمنة',
    archSub: 'الوكلاء الفرعيون المنتهون',
    archOld: 'محادثات رئيسية أقدم من 14 يوماً (يحتفظ بآخر 20)',
    topTitle: 'أكبر 5 محادثات حجماً (للقراءة فقط)',
    batchTitle: 'دفعات الأرشفة بدون فقدان',
    none: 'لا يوجد',
    hint: 'سياسة عدم الفقدان: نقل فقط مع ملف manifest.json للاستعادة حسب الدفعة؛ أغلق Antigravity قبل تشغيل السكربتات المساعدة.',
  },
};

export const WORKBENCH_SUPPORTED_LANGS = Object.freeze(['en', 'ar']);

export function normalizeWorkbenchLang(lang = 'en') {
  if (lang === true) return 'ar';
  if (lang === false) return 'en';
  const s = String(lang || '').trim().toLowerCase().replace(/_/g, '-').split(/[.@]/)[0];
  if (!s || s === 'auto') return 'en';
  if (s === 'ar' || s.startsWith('ar-') || s === 'arabic' || s === 'العربية') return 'ar';
  return 'en';
}

export function getStorageWorkbenchLabels(lang = 'en') {
  return STORAGE_WB_I18N[normalizeWorkbenchLang(lang)] || STORAGE_WB_I18N.en;
}

function fmtSizeMb(mb) {
  const n = Number(mb) || 0;
  return n >= 1024 ? `${(n / 1024).toFixed(2)} GB` : `${n.toFixed(1)} MB`;
}

export function formatStorageDetailReport(detail = {}, lang = 'en') {
  const L = getStorageWorkbenchLabels(lang);
  const lines = [];
  const unkPart = Number(detail.unknownCount) > 0 ? ` · ${L.unknown} ${detail.unknownCount} (${fmtSizeMb(detail.unknownMb)})` : '';
  const lsMemPart = Number(detail.lsMemoryMb) > 0 ? ` · ${L.lsMem} ${fmtSizeMb(detail.lsMemoryMb)}` : '';
  const subHours = Number.isFinite(Number(detail.subagentMaxAgeHours))
    ? Number(detail.subagentMaxAgeHours)
    : AUTO_ARCHIVE_SUBAGENT_MAX_AGE_HOURS;
  lines.push(
    `${L.breakdown}: ${fmtSizeMb(detail.totalMb)} (${detail.conversationCount || 0}) | ${L.main} ${detail.mainCount || 0} (${fmtSizeMb(detail.mainMb)}) · ${L.subagent} ${detail.subagentCount || 0} (${fmtSizeMb(detail.subagentMb)}) · ${L.wal} ${fmtSizeMb(detail.walMb)}${unkPart}${lsMemPart}`
  );
  lines.push(
    `${L.archivable}: ${L.archSub} (>${subHours}h) ${detail.archivableSubagentCount || 0} (${fmtSizeMb(detail.archivableSubagentMb)}) | ${L.archOld} ${detail.archivableOldMainCount || 0} (${fmtSizeMb(detail.archivableOldMainMb)})`
  );
  lines.push('');
  lines.push(`${L.topTitle}:`);
  const top = Array.isArray(detail.topConsumers) ? detail.topConsumers : [];
  if (top.length === 0) {
    lines.push(`  - ${L.none}`);
  } else {
    top.forEach((it, idx) => {
      const tag = it.kind === 'subagent' ? L.subagent : it.kind === 'main' ? L.main : L.unknown;
      const safeTitle = sanitizeTitleForReport(it.title);
      const titlePart = safeTitle ? ` · ${safeTitle}` : ` · ${String(it.id || '').slice(0, 8)}`;
      const agePart = Number.isFinite(it.ageDays) ? ` · ${Math.round(it.ageDays)}d` : '';
      lines.push(`  ${idx + 1}. [${tag}] ${fmtSizeMb(it.mb)}${agePart}${titlePart}`);
    });
  }
  lines.push('');
  lines.push(`${L.batchTitle}:`);
  const batches = Array.isArray(detail.batches) ? detail.batches : [];
  if (batches.length === 0) {
    lines.push(`  - ${L.none}`);
  } else {
    batches.forEach((b) => {
      const ts = b.createdAt ? ` · ${String(b.createdAt).slice(0, 16).replace('T', ' ')}` : '';
      lines.push(`  - ${b.batchName} (${b.movedCount || 0} / ${fmtSizeMb(b.movedMb)} · ${b.status || 'completed'}${ts})`);
    });
  }
  lines.push('');
  lines.push(L.hint);
  return lines.join('\n');
}

export function readLastArchiveResult(archiveDir = getDefaultArchiveDir()) {
  try {
    const filePath = path.join(path.resolve(archiveDir), LAST_ARCHIVE_RESULT_FILENAME);
    const st = assertPathChainNoSymlinks(filePath, 'last archive result');
    if (!st || !st.isFile() || st.size > 256 * 1024) return null;
    const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function writeLastArchiveResult(archiveDir = getDefaultArchiveDir(), result = {}) {
  try {
    const safeArchive = ensureSafeDir(archiveDir);
    const filePath = path.join(safeArchive, LAST_ARCHIVE_RESULT_FILENAME);
    const payload = {
      schema: 1,
      recordedAt: new Date().toISOString(),
      action: String(result.action || 'archive'),
      ok: Boolean(result.ok),
      code: result.code ? String(result.code) : '',
      error: result.error ? String(result.error).slice(0, 400) : '',
      movedCount: Number(result.movedCount || 0) || 0,
      movedMb: Number(result.movedMb || 0) || 0,
      restoredCount: Number(result.restoredCount || 0) || 0,
      batchName: result.batchName ? String(result.batchName) : '',
      relaunched: Boolean(result.relaunched),
    };
    atomicWriteJsonSync(filePath, payload);
    return payload;
  } catch {
    return null;
  }
}

export function writeActiveArchiveTask(archiveDir = getDefaultArchiveDir(), info = {}) {
  try {
    const safeArchive = ensureSafeDir(archiveDir);
    const filePath = path.join(safeArchive, ACTIVE_ARCHIVE_TASK_FILENAME);
    const pidNum = Number(info.pid);
    const payload = {
      schema: 1,
      action: String(info.action || 'archive-and-restart'),
      pid: Number.isInteger(pidNum) && pidNum > 0 ? pidNum : 0,
      startedAt: new Date().toISOString(),
    };
    atomicWriteJsonSync(filePath, payload);
    return payload;
  } catch {
    return null;
  }
}

export function clearActiveArchiveTask(archiveDir = getDefaultArchiveDir(), expectedPid = 0) {
  try {
    const filePath = path.join(path.resolve(archiveDir), ACTIVE_ARCHIVE_TASK_FILENAME);
    const st = assertPathChainNoSymlinks(filePath, 'active archive task');
    if (!st || !st.isFile()) return false;
    if (Number.isInteger(expectedPid) && expectedPid > 0) {
      try {
        const cur = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        if (cur && Number.isInteger(cur.pid) && cur.pid > 0 && cur.pid !== expectedPid) {
          return false;
        }
      } catch {}
    }
    fs.unlinkSync(filePath);
    return true;
  } catch {
    return false;
  }
}

function normalizeMacAppBundlePath(rawPath) {
  const s = String(rawPath || '').trim();
  if (!s) return '/Applications/Antigravity.app';
  const m = /^(.+?\.app)(?:\/.*)?$/i.exec(s);
  if (m && m[1]) return m[1];
  return '/Applications/Antigravity.app';
}

const WIN_GRACEFUL_CLOSE_PS = [
  '$ErrorActionPreference = "SilentlyContinue"',
  'foreach ($p in @(Get-Process -Name "Antigravity","agy" -ErrorAction SilentlyContinue)) {',
  '  if ($p.MainWindowHandle -ne 0) { $null = $p.CloseMainWindow() }',
  '}',
].join('\n');
const WIN_GRACEFUL_CLOSE_B64 = Buffer.from(WIN_GRACEFUL_CLOSE_PS, 'utf16le').toString('base64');

const WIN_READ_GOMEMLIMIT_PS =
  '$v = [Environment]::GetEnvironmentVariable("GOMEMLIMIT", "User"); if ($null -ne $v) { [Console]::Out.Write($v) }';
const WIN_READ_GOMEMLIMIT_B64 = Buffer.from(WIN_READ_GOMEMLIMIT_PS, 'utf16le').toString('base64');
const ALLOWED_GOMEMLIMIT_RE = /^(?:1536MiB|2GiB|2500MiB|3GiB|4GiB)$/;
const LINUX_ENVD_GOMEMLIMIT_LINE_RE = /^GOMEMLIMIT=([0-9]+(B|KiB|MiB|GiB|TiB))$/;

export function readLinuxEnvDGoMemLimit(opts = {}) {
  const env = opts.env || process.env;
  const homeDir = opts.homeDir ? path.resolve(opts.homeDir) : os.homedir();
  const hasCustomHome = Boolean(opts.homeDir && path.resolve(opts.homeDir) !== path.resolve(os.homedir()));
  const xdgConfig =
    !hasCustomHome && env && typeof env.XDG_CONFIG_HOME === 'string' && env.XDG_CONFIG_HOME.trim()
      ? path.resolve(env.XDG_CONFIG_HOME.trim())
      : path.join(homeDir, '.config');
  const confPath = opts.envFile
    ? path.resolve(opts.envFile)
    : path.join(xdgConfig, 'environment.d', '90-obsidian-prism-gomemlimit.conf');
  try {
    const dirStat = fs.lstatSync(path.dirname(confPath));
    if (dirStat.isSymbolicLink() || !dirStat.isDirectory()) return '';
    const fileStat = fs.lstatSync(confPath);
    if (fileStat.isSymbolicLink() || !fileStat.isFile()) return '';
    const lines = fs.readFileSync(confPath, 'utf8').split(/\r?\n/);
    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line || line.startsWith('#')) continue;
      const m = LINUX_ENVD_GOMEMLIMIT_LINE_RE.exec(line);
      if (m && m[1]) return m[1];
    }
    return '';
  } catch {
    return '';
  }
}

export function resolveLinuxHostExecutable(exePath, opts = {}) {
  const existsFn = typeof opts.existsSync === 'function' ? opts.existsSync : fs.existsSync;
  const homeDir = opts.homeDir ? path.resolve(opts.homeDir) : os.homedir();
  const explicit = String(exePath || '').trim();
  if (explicit) {
    if (!explicit.includes('/') && !explicit.includes('\\')) {
      return explicit;
    }
    try {
      if (existsFn(explicit)) return explicit;
    } catch {}
  }
  const candidates = Array.isArray(opts.candidatePaths) && opts.candidatePaths.length > 0
    ? opts.candidatePaths
    : [
        '/usr/share/antigravity/antigravity',
        '/opt/Antigravity/antigravity',
        '/usr/bin/antigravity',
        path.join(homeDir, '.local', 'bin', 'antigravity'),
      ];
  for (const cand of candidates) {
    if (!cand) continue;
    try {
      if (existsFn(cand)) return cand;
    } catch {}
  }
  return 'antigravity';
}

const WIN_WMI_CREATE_PS = [
  '$ErrorActionPreference = "Stop"',
  '$cmd = [string]$env:AG_PRISM_WMI_CMD',
  'if (-not $cmd) { exit 1 }',
  '$psi = New-CimInstance -ClassName Win32_ProcessStartup -ClientOnly -Property @{ ShowWindow = [uint16]0 }',
  '$r = Invoke-CimMethod -ClassName Win32_Process -MethodName Create -Arguments @{ CommandLine = $cmd; ProcessStartupInformation = $psi }',
  'if ($r -and $r.ReturnValue -eq 0 -and $r.ProcessId) { Write-Output $r.ProcessId }',
].join('\n');
const WIN_WMI_CREATE_B64 = Buffer.from(WIN_WMI_CREATE_PS, 'utf16le').toString('base64');

function normalizeLoopbackCdpPort(rawPort) {
  const n = Number(rawPort);
  return Number.isInteger(n) && n >= 1 && n <= 65535 ? n : 0;
}

function normalizeExpectedBrowserWsPath(rawPath) {
  const s = String(rawPath || '').trim();
  if (!s || /[\r\n\s]/.test(s) || !s.startsWith('/devtools/browser/')) return '';
  return s;
}

function isAntigravityCdpTarget(target) {
  if (!target || !target.webSocketDebuggerUrl) return false;
  const url = String(target.url || '').trim();
  const title = String(target.title || '').trim();
  if (!url) return false;
  const lowUrl = url.toLowerCase();
  if (
    (target.type === 'iframe' || target.type === 'page') &&
    /^plugin:\/\/swarm--swarm_board-\d+(?:\/|$)/i.test(lowUrl)
  ) {
    return true;
  }
  if (target.type !== 'page') return false;
  if (
    lowUrl.startsWith('devtools://') ||
    lowUrl.startsWith('data:') ||
    lowUrl.startsWith('about:') ||
    lowUrl.startsWith('chrome:') ||
    lowUrl.startsWith('chrome-extension:') ||
    lowUrl.startsWith('edge:') ||
    lowUrl.startsWith('blob:') ||
    lowUrl.startsWith('plugin:')
  ) {
    return false;
  }
  if (/\bvisual studio code\b/i.test(title) && !/\bantigravity\b/i.test(title)) {
    return false;
  }
  if (lowUrl.startsWith('vscode-file://') || lowUrl.startsWith('app://')) {
    return true;
  }
  if (lowUrl.startsWith('file://')) {
    return /workbench|antigravity/i.test(lowUrl) || /\bantigravity\b/i.test(title);
  }
  const m = /^(https?):\/\/(127\.0\.0\.1|localhost|\[::1\])(?::\d+)?(\/[^?#]*)?(?:[?#]|$)/i.exec(url);
  if (!m) return false;
  const pathname = (m[3] || '/').toLowerCase();
  if (/^\/(?:viewer(?:\/|$)|sandbox(?:\/|$)|stream(?:\/|$)|api(?:\/|$))/.test(pathname)) {
    return false;
  }
  return /\bantigravity\b/i.test(title);
}

/**
 * Send standard Browser.close over the local loopback CDP browser endpoint to request graceful host shutdown
 * (triggers Electron app.quit(), avoiding Windows tray interception of WM_CLOSE that only minimizes).
 * Strictly validates both /json/version and /json/list belong to local Antigravity before sending;
 * fails closed (returns false) on timeout without ACK or close so OS-level graceful quit fallback runs immediately.
 */
export async function requestCdpBrowserClose(cdpPort, opts = {}) {
  const port = normalizeLoopbackCdpPort(cdpPort);
  if (!port) return false;
  const fetchImpl = typeof opts.fetchImpl === 'function' ? opts.fetchImpl : globalThis.fetch;
  const WsCtor = typeof opts.WebSocketCtor === 'function' ? opts.WebSocketCtor : globalThis.WebSocket;
  if (typeof fetchImpl !== 'function' || typeof WsCtor !== 'function') return false;
  const timeoutMs = Math.max(200, Math.min(8000, Number(opts.timeoutMs) || 2500));
  const expectedPath = normalizeExpectedBrowserWsPath(opts.expectedBrowserWsPath);

  const fetchJsonLoopback = async (endpointPath) => {
    const controller = new AbortController();
    const fetchTimer = setTimeout(() => controller.abort(), Math.min(1500, timeoutMs));
    if (fetchTimer && typeof fetchTimer.unref === 'function') fetchTimer.unref();
    try {
      const res = await fetchImpl(`http://127.0.0.1:${port}${endpointPath}`, { signal: controller.signal });
      if (!res || !res.ok) return null;
      return await res.json();
    } catch {
      return null;
    } finally {
      clearTimeout(fetchTimer);
    }
  };

  const info = await fetchJsonLoopback('/json/version');
  if (!info || typeof info !== 'object') return false;
  const browserSig = `${String(info.Browser || '')} ${String(info['User-Agent'] || '')}`;
  if (/\bEdg\//i.test(browserSig) && !/\bAntigravity\b/i.test(browserSig)) {
    return false;
  }
  const wsUrl = typeof info.webSocketDebuggerUrl === 'string' ? info.webSocketDebuggerUrl.trim() : '';

  let parsed;
  try {
    parsed = new URL(wsUrl);
  } catch {
    return false;
  }
  const hostOk = parsed.hostname === '127.0.0.1' || parsed.hostname === 'localhost' || parsed.hostname === '[::1]';
  const portNum = parsed.port ? Number(parsed.port) : 80;
  if (parsed.protocol !== 'ws:' || !hostOk || portNum !== port || !parsed.pathname.startsWith('/devtools/browser/')) {
    return false;
  }
  if (expectedPath && parsed.pathname !== expectedPath) {
    return false;
  }

  // Secondary check on /json/list to confirm port belongs to Antigravity (prevents closing Chrome/Edge/VS Code/other Electron)
  const targets = await fetchJsonLoopback('/json/list');
  if (!Array.isArray(targets) || !targets.some(isAntigravityCdpTarget)) {
    return false;
  }

  return new Promise((resolve) => {
    let settled = false;
    let sent = false;
    let ws = null;
    const finish = (ok) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      try {
        if (ws && typeof ws.close === 'function') ws.close();
      } catch {}
      resolve(Boolean(ok));
    };
    // Return false on timeout without {id:1} ACK or clean close so CloseMainWindow fallback runs immediately
    const timer = setTimeout(() => finish(false), timeoutMs);
    try {
      ws = new WsCtor(parsed.href);
    } catch {
      finish(false);
      return;
    }
    const onOpen = () => {
      try {
        ws.send(JSON.stringify({ id: 1, method: 'Browser.close' }));
        sent = true;
      } catch {
        finish(false);
      }
    };
    const onMessage = (evt) => {
      try {
        const raw = typeof evt === 'string' ? evt : evt?.data;
        const msg = JSON.parse(String(raw || ''));
        if (msg && msg.id === 1) {
          finish(!msg.error);
        }
      } catch {}
    };
    const onClose = () => finish(sent);
    const onError = () => finish(false);
    if (typeof ws.addEventListener === 'function') {
      ws.addEventListener('open', onOpen, { once: true });
      ws.addEventListener('message', onMessage);
      ws.addEventListener('close', onClose, { once: true });
      ws.addEventListener('error', onError, { once: true });
    } else if (typeof ws.on === 'function') {
      ws.once('open', onOpen);
      ws.on('message', onMessage);
      ws.once('close', onClose);
      ws.once('error', onError);
    } else {
      finish(false);
    }
  });
}

export async function requestGracefulHostQuit(hostPid, exePath, platform = process.platform, opts = {}) {
  const cdpPort = normalizeLoopbackCdpPort(opts?.cdpPort);
  const cdpCloseFn = typeof opts?.requestCdpClose === 'function' ? opts.requestCdpClose : requestCdpBrowserClose;
  if (cdpPort > 0) {
    try {
      const closedViaCdp = await cdpCloseFn(cdpPort, opts);
      if (closedViaCdp) return true;
    } catch {}
  }
  const execSyncFn = typeof opts?.execFileSyncFn === 'function' ? opts.execFileSyncFn : execFileSync;
  const killFn = typeof opts?.killFn === 'function' ? opts.killFn : process.kill;
  try {
    if (platform === 'win32') {
      // Fallback: send WM_CLOSE only to the Antigravity main window for graceful exit; never force-kill language_server.exe
      execSyncFn(
        'powershell.exe',
        ['-NoProfile', '-NonInteractive', '-WindowStyle', 'Hidden', '-EncodedCommand', WIN_GRACEFUL_CLOSE_B64],
        { windowsHide: true, timeout: 5000, stdio: 'ignore' }
      );
      return true;
    }
    if (platform === 'darwin') {
      const appPath = normalizeMacAppBundlePath(exePath);
      try {
        execSyncFn(
          'osascript',
          ['-e', 'on run argv', '-e', 'tell application (item 1 of argv) to quit', '-e', 'end run', appPath],
          { timeout: 5000, stdio: 'ignore' }
        );
        return true;
      } catch {}
      if (Number.isInteger(hostPid) && hostPid > 0) {
        try { killFn(hostPid, 'SIGTERM'); return true; } catch {}
      }
      return false;
    }
    if (Number.isInteger(hostPid) && hostPid > 0) {
      try { killFn(hostPid, 'SIGTERM'); return true; } catch {}
    }
    return false;
  } catch {
    return false;
  }
}

export function launchHostWithCdpFlag(exePath, platform = process.platform, opts = {}) {
  const baseEnv = opts && opts.env ? opts.env : process.env;
  const spawnFn = opts && typeof opts.spawnFn === 'function' ? opts.spawnFn : spawn;
  const cleanEnv = { ...baseEnv };
  delete cleanEnv.ELECTRON_RUN_AS_NODE;
  if (platform === 'win32') {
    // Read latest user-level GOMEMLIMIT (allowlisted values only) so a setting applied right before restart takes effect immediately
    try {
      const freshVal = String(
        execFileSync(
          'powershell.exe',
          ['-NoProfile', '-NonInteractive', '-WindowStyle', 'Hidden', '-EncodedCommand', WIN_READ_GOMEMLIMIT_B64],
          { encoding: 'utf8', windowsHide: true, timeout: 4000, stdio: ['ignore', 'pipe', 'ignore'] }
        ) || ''
      ).trim();
      if (ALLOWED_GOMEMLIMIT_RE.test(freshVal)) cleanEnv.GOMEMLIMIT = freshVal;
      else if (!freshVal) delete cleanEnv.GOMEMLIMIT;
    } catch {}
    const resolvedExe =
      String(exePath || '').trim() ||
      path.join(process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local'), 'Programs', 'antigravity', 'Antigravity.exe');
    if (!fs.existsSync(resolvedExe)) return false;
    try {
      const child = spawnFn(resolvedExe, ['--remote-debugging-port=0'], {
        cwd: path.dirname(resolvedExe),
        detached: true,
        stdio: 'ignore',
        windowsHide: false,
        env: cleanEnv,
      });
      if (child && typeof child.on === 'function') child.on('error', () => {});
      if (child && typeof child.unref === 'function') child.unref();
      return Boolean(child && child.pid);
    } catch {
      return false;
    }
  }
  if (platform === 'darwin') {
    const appPath = normalizeMacAppBundlePath(exePath);
    try {
      const child = spawnFn('/usr/bin/open', ['-na', appPath, '--args', '--remote-debugging-port=0'], {
        detached: true,
        stdio: 'ignore',
        env: cleanEnv,
      });
      if (child && typeof child.on === 'function') child.on('error', () => {});
      if (child && typeof child.unref === 'function') child.unref();
      return Boolean(child && child.pid);
    } catch {
      return false;
    }
  }
  const freshLinuxGoMem = readLinuxEnvDGoMemLimit({
    env: baseEnv,
    homeDir: opts.homeDir,
    envFile: opts.envFile,
  });
  if (freshLinuxGoMem) {
    cleanEnv.GOMEMLIMIT = freshLinuxGoMem;
  }
  const resolvedExe = resolveLinuxHostExecutable(exePath, opts);
  try {
    const spawnOpts = {
      detached: true,
      stdio: 'ignore',
      env: cleanEnv,
    };
    if (resolvedExe.includes('/') && path.isAbsolute(resolvedExe)) {
      const parentDir = path.dirname(resolvedExe);
      try {
        const existsFn = typeof opts.existsSync === 'function' ? opts.existsSync : fs.existsSync;
        if (existsFn(parentDir)) spawnOpts.cwd = parentDir;
      } catch {}
    }
    const child = spawnFn(resolvedExe, ['--remote-debugging-port=0'], spawnOpts);
    if (child && typeof child.on === 'function') child.on('error', () => {});
    if (child && typeof child.unref === 'function') child.unref();
    return Boolean(child && child.pid);
  } catch {
    return false;
  }
}

/**
 * Fully async offline archive/restore and optional restart orchestrator:
 *   1) If restarting: request graceful Antigravity quit (never force-kill language_server)
 *   2) Poll until Antigravity and language_server exit completely (fail-closed abort on timeout)
 *   3) Wait 3-5s to settle and run double fail-closed isLanguageServerRunning() verification
 *   4) Perform atomic move archive or lossless restore (abort safely if host relaunches mid-run)
 *   5) If restarting: relaunch Antigravity with --remote-debugging-port=0
 */
export async function executeArchiveTaskSequence(task = {}, hooks = {}) {
  const action = String(task.action || 'archive-and-restart');
  const convDir = task.convDir ? path.resolve(String(task.convDir)) : getDefaultConversationsDir();
  const archiveDir = task.archiveDir ? path.resolve(String(task.archiveDir)) : getDefaultArchiveDir();
  const hostPid = Number(task.hostPid) || 0;
  const cdpPort = normalizeLoopbackCdpPort(task.cdpPort);
  const expectedBrowserWsPath = normalizeExpectedBrowserWsPath(task.cdpBrowserWsPath);
  const exePath = String(task.exePath || '').trim();
  const gracefulQuit = Boolean(task.gracefulQuit);
  const relaunch = Boolean(task.relaunch);
  const waitExitTimeoutMs = Math.max(500, Math.min(180000, Number(task.waitExitTimeoutMs) || 45000));
  const pollMs = Math.max(50, Math.min(3000, Number(task.pollMs) || 500));
  const settleMs = Math.max(0, Math.min(15000, Number(task.settleMs ?? 4000)));
  const recheckGapMs = Math.max(0, Math.min(5000, Number(task.recheckGapMs ?? 1500)));
  const relaunchDelayMs = Math.max(0, Math.min(5000, Number(task.relaunchDelayMs ?? 500)));

  const sleepFn = typeof hooks.sleep === 'function' ? hooks.sleep : (ms) => new Promise((r) => setTimeout(r, ms));
  const checkRunning =
    typeof hooks.checkRunning === 'function' ? hooks.checkRunning : () => isLanguageServerRunning();
  const safeIsRunning = () => {
    try {
      return Boolean(checkRunning());
    } catch {
      return true; // fail-closed
    }
  };
  const quitHost =
    typeof hooks.requestGracefulQuit === 'function'
      ? hooks.requestGracefulQuit
      : (pid, exe, quitOpts) => requestGracefulHostQuit(pid, exe, process.platform, quitOpts);
  const launchHost =
    typeof hooks.launchHost === 'function'
      ? hooks.launchHost
      : () => launchHostWithCdpFlag(exePath);
  const runArchive = typeof hooks.archiveFn === 'function' ? hooks.archiveFn : archiveConversations;
  const runRestore = typeof hooks.restoreFn === 'function' ? hooks.restoreFn : restoreArchiveBatch;

  writeActiveArchiveTask(archiveDir, { action, pid: process.pid });
  try {
    if (gracefulQuit && safeIsRunning()) {
      await quitHost(hostPid, exePath, { cdpPort, expectedBrowserWsPath, attempt: 1 });
    }

    // Wait for Antigravity and language_server to exit completely
    const deadline = Date.now() + waitExitTimeoutMs;
    let exited = !safeIsRunning();
    let nudged = false;
    const nudgeAt = Date.now() + Math.min(5000, Math.floor(waitExitTimeoutMs / 3));
    while (!exited && Date.now() <= deadline) {
      await sleepFn(pollMs);
      if (!safeIsRunning()) {
        exited = true;
        break;
      }
      if (gracefulQuit && !nudged && Date.now() >= nudgeAt) {
        nudged = true;
        await quitHost(hostPid, exePath, { cdpPort: 0, attempt: 2 });
      }
    }
    if (!exited) {
      const out = {
        ok: false,
        action,
        code: 'HOST_EXIT_TIMEOUT',
        error: 'Timed out waiting for Antigravity and language_server to exit; aborted safely without moving any files.',
        relaunched: false,
      };
      writeLastArchiveResult(archiveDir, out);
      return out;
    }

    // Settle for 3-5s + double fail-closed re-check
    if (settleMs > 0) await sleepFn(settleMs);
    if (safeIsRunning()) {
      const out = {
        ok: false,
        action,
        code: 'HOST_RESTARTED_DURING_SETTLE',
        error: 'Detected Antigravity restarting during settle period; aborted safely.',
        relaunched: false,
      };
      writeLastArchiveResult(archiveDir, out);
      return out;
    }
    if (recheckGapMs > 0) await sleepFn(recheckGapMs);
    if (safeIsRunning()) {
      const out = {
        ok: false,
        action,
        code: 'HOST_RESTARTED_DURING_SETTLE',
        error: 'Detected Antigravity restarting during secondary check; aborted safely.',
        relaunched: false,
      };
      writeLastArchiveResult(archiveDir, out);
      return out;
    }

    let opRes;
    if (action === 'restore-and-restart' || action === 'restore') {
      opRes = runRestore({
        convDir,
        archiveDir,
        batchName: task.batchName || 'latest',
        checkRunning: safeIsRunning,
      });
    } else {
      opRes = runArchive({
        convDir,
        archiveDir,
        mode: task.mode === 'subagents+old-main' ? 'subagents+old-main' : 'subagents',
        subagentMaxAgeHours: Number.isFinite(Number(task.subagentMaxAgeHours))
          ? Number(task.subagentMaxAgeHours)
          : AUTO_ARCHIVE_SUBAGENT_MAX_AGE_HOURS,
        mainMaxAgeDays: Number.isFinite(Number(task.mainMaxAgeDays)) ? Number(task.mainMaxAgeDays) : DEFAULT_MAIN_MAX_AGE_DAYS,
        keepRecentMain: Number.isInteger(Number(task.keepRecentMain)) ? Number(task.keepRecentMain) : DEFAULT_KEEP_RECENT_MAIN,
        checkRunning: safeIsRunning,
      });
    }

    let relaunched = false;
    if (relaunch && opRes?.code !== 'LANGUAGE_SERVER_RUNNING' && !safeIsRunning()) {
      if (relaunchDelayMs > 0) await sleepFn(relaunchDelayMs);
      if (!safeIsRunning()) {
        relaunched = Boolean(await launchHost(exePath, ['--remote-debugging-port=0']));
      }
    }

    const finalOut = {
      ...opRes,
      action,
      relaunched,
    };
    writeLastArchiveResult(archiveDir, finalOut);
    return finalOut;
  } finally {
    clearActiveArchiveTask(archiveDir, process.pid);
  }
}

function isElectronHostBinaryPath(rawPath) {
  const s = String(rawPath || '').trim();
  if (!s) return false;
  const base = path.basename(s);
  if (/^(?:antigravity|agy)(?:\.exe)?$/i.test(base)) return true;
  if (/Antigravity(?:\s+Helper(?:\s+\([^)]+\))?)?\.app[\\/]Contents[\\/]MacOS[\\/]/i.test(s)) return true;
  return false;
}

/**
 * Resolve the Node runtime for detached offline archive tasks:
 *   1) Reuse directly when the current process is standalone node;
 *   2) When running under Electron host (ELECTRON_RUN_AS_NODE=1), prefer system standalone node;
 *   3) If no global node is installed (common in packaged Antigravity installs), safely fall back
 *      to the host binary with ELECTRON_RUN_AS_NODE=1 (paired with selfPid exclusion in
 *      parseWindowsTasklistCsv / parsePosixProcessList to avoid self-detection deadlocks or ENOENT).
 */
export function resolveArchiveNodeRuntime(
  nodeExec = process.execPath,
  { platform = process.platform, whichSync = null, existsSync = fs.existsSync } = {}
) {
  const raw = String(nodeExec || '').trim();
  if (!raw) throw new Error('Unable to resolve Node runtime path');
  if (!isElectronHostBinaryPath(raw)) {
    return { execPath: assertSafeHelperPath(path.resolve(raw), 'nodeExecPath'), useElectronAsNode: false };
  }

  const candidates = [];
  const runWhich = (bin, args) => {
    try {
      const out =
        typeof whichSync === 'function'
          ? whichSync(bin, args)
          : execFileSync(bin, args, {
              encoding: 'utf8',
              windowsHide: true,
              timeout: 3000,
              stdio: ['ignore', 'pipe', 'ignore'],
            });
      for (const line of String(out || '').split(/\r?\n/)) {
        const trimmed = line.trim();
        if (trimmed) candidates.push(trimmed);
      }
    } catch {}
  };
  if (platform === 'win32') {
    runWhich('where.exe', ['node.exe']);
  } else {
    runWhich('which', ['node']);
    candidates.push('/opt/homebrew/bin/node', '/usr/local/bin/node', '/usr/bin/node');
  }

  for (const cand of candidates) {
    try {
      if (isElectronHostBinaryPath(cand)) continue;
      if (!existsSync(cand)) continue;
      const safeCand = assertSafeHelperPath(path.resolve(cand), 'nodeExecPath');
      return { execPath: safeCand, useElectronAsNode: false };
    } catch {}
  }

  const safeElectron = assertSafeHelperPath(path.resolve(raw), 'nodeExecPath');
  if (existsSync(safeElectron)) {
    return { execPath: safeElectron, useElectronAsNode: true };
  }
  throw new Error('No usable Node.js or Electron runtime found for detached archive task');
}

/**
 * Spawn a standalone offline task process physically detached from the host process tree (and Windows Job Object).
 */
export function spawnDetachedArchiveTask(task = {}, opts = {}) {
  const archiveDir = ensureSafeDir(task.archiveDir || getDefaultArchiveDir());
  const scriptPath = assertSafeHelperPath(
    path.resolve(opts.scriptPath || fileURLToPath(import.meta.url)),
    'scriptPath'
  );
  const runtime = resolveArchiveNodeRuntime(opts.nodeExecPath || process.execPath, {
    platform: opts.platform || process.platform,
    whichSync: opts.whichSync,
    existsSync: opts.existsSync,
  });
  const safeNodeExec = runtime.execPath;
  const useElectronAsNode = runtime.useElectronAsNode;
  const taskFile = path.join(archiveDir, `.archive-task-${crypto.randomBytes(6).toString('hex')}.json`);

  const safePayload = {
    schema: 1,
    action: String(task.action || 'archive-and-restart'),
    convDir: path.resolve(task.convDir || getDefaultConversationsDir()),
    archiveDir,
    hostPid: Number(task.hostPid) || 0,
    cdpPort: normalizeLoopbackCdpPort(task.cdpPort),
    cdpBrowserWsPath: normalizeExpectedBrowserWsPath(task.cdpBrowserWsPath),
    exePath: String(task.exePath || '').trim(),
    gracefulQuit: Boolean(task.gracefulQuit),
    relaunch: Boolean(task.relaunch),
    mode: task.mode === 'subagents+old-main' ? 'subagents+old-main' : 'subagents',
    subagentMaxAgeHours: Number.isFinite(Number(task.subagentMaxAgeHours))
      ? Number(task.subagentMaxAgeHours)
      : AUTO_ARCHIVE_SUBAGENT_MAX_AGE_HOURS,
    batchName: String(task.batchName || 'latest'),
    settleMs: Number.isFinite(Number(task.settleMs)) ? Number(task.settleMs) : 4000,
    waitExitTimeoutMs: Number.isFinite(Number(task.waitExitTimeoutMs)) ? Number(task.waitExitTimeoutMs) : 45000,
  };
  atomicWriteJsonSync(taskFile, safePayload);

  if (typeof opts.spawnHook === 'function') {
    const hookRes = opts.spawnHook({ nodeExec: safeNodeExec, useElectronAsNode, scriptPath, taskFile, payload: safePayload });
    if (hookRes?.spawned && Number.isInteger(hookRes.pid) && hookRes.pid > 0) {
      writeActiveArchiveTask(archiveDir, { action: safePayload.action, pid: hookRes.pid });
    }
    return hookRes;
  }

  const cleanEnv = { ...process.env };
  if (useElectronAsNode) cleanEnv.ELECTRON_RUN_AS_NODE = '1';
  else delete cleanEnv.ELECTRON_RUN_AS_NODE;

  const cleanupTaskFile = () => {
    try { fs.unlinkSync(taskFile); } catch {}
  };

  if (process.platform === 'win32') {
    const safeTaskFile = assertSafeHelperPath(taskFile, 'taskFile');
    if (!opts.disableWmiBreakaway) {
      try {
        // Launch runtime to execute task file via Base64 EncodedCommand, breaking away from the Antigravity Job Object
        const envLine = useElectronAsNode
          ? '$env:ELECTRON_RUN_AS_NODE = "1"'
          : 'Remove-Item Env:ELECTRON_RUN_AS_NODE -ErrorAction SilentlyContinue';
        const innerPs = [
          '$ErrorActionPreference = "SilentlyContinue"',
          envLine,
          `& ${escapePsSingleQuoted(safeNodeExec)} ${escapePsSingleQuoted(scriptPath)} ${escapePsSingleQuoted(`--run-task=${safeTaskFile}`)}`,
        ].join('\n');
        const innerB64 = Buffer.from(innerPs, 'utf16le').toString('base64');
        const wmiCmd = `powershell.exe -NoProfile -NonInteractive -WindowStyle Hidden -EncodedCommand ${innerB64}`;
        const out = execFileSync(
          'powershell.exe',
          ['-NoProfile', '-NonInteractive', '-WindowStyle', 'Hidden', '-EncodedCommand', WIN_WMI_CREATE_B64],
          {
            encoding: 'utf8',
            windowsHide: true,
            timeout: 6000,
            stdio: ['ignore', 'pipe', 'ignore'],
            env: { ...cleanEnv, AG_PRISM_WMI_CMD: wmiCmd },
          }
        );
        const helperPid = parseInt(String(out || '').trim().split(/\s+/).pop(), 10);
        if (Number.isInteger(helperPid) && helperPid > 0) {
          writeActiveArchiveTask(archiveDir, { action: safePayload.action, pid: helperPid });
          return { spawned: true, pid: helperPid, method: 'wmi-breakaway', useElectronAsNode, taskFile };
        }
      } catch {}
    }
    try {
      const child = spawn(safeNodeExec, [scriptPath, `--run-task=${safeTaskFile}`], {
        detached: true,
        stdio: 'ignore',
        windowsHide: true,
        cwd: os.tmpdir(),
        env: cleanEnv,
      });
      child.on('error', () => {});
      if (!child.pid) {
        cleanupTaskFile();
        return { spawned: false, code: 'SPAWN_FAILED', error: 'Failed to launch detached archive worker', taskFile: '' };
      }
      child.unref();
      writeActiveArchiveTask(archiveDir, { action: safePayload.action, pid: child.pid });
      return { spawned: true, pid: child.pid, method: 'detached-spawn', useElectronAsNode, taskFile };
    } catch (err) {
      cleanupTaskFile();
      return { spawned: false, code: 'SPAWN_FAILED', error: String(err?.message || err), taskFile: '' };
    }
  }

  try {
    const child = spawn(safeNodeExec, [scriptPath, `--run-task=${taskFile}`], {
      detached: true,
      stdio: 'ignore',
      cwd: os.tmpdir(),
      env: cleanEnv,
    });
    child.on('error', () => {});
    if (!child.pid) {
      cleanupTaskFile();
      return { spawned: false, code: 'SPAWN_FAILED', error: 'Failed to launch detached archive worker', taskFile: '' };
    }
    child.unref();
    writeActiveArchiveTask(archiveDir, { action: safePayload.action, pid: child.pid });
    return { spawned: true, pid: child.pid, method: 'detached-spawn', useElectronAsNode, taskFile };
  } catch (err) {
    cleanupTaskFile();
    return { spawned: false, code: 'SPAWN_FAILED', error: String(err?.message || err), taskFile: '' };
  }
}

async function fetchLiveSummariesViaClient() {
  try {
    const clientUrl = new URL('../../vendor/pulse-dashboard/sidecars/panel/client.mjs', import.meta.url);
    const { AntigravityClient } = await import(clientUrl.href);
    const cli = new AntigravityClient();
    try {
      const res = await cli.call('GetAllCascadeTrajectories', { excludeSubtrajectories: false });
      return res?.trajectorySummaries || null;
    } finally {
      cli.dispose();
    }
  } catch {
    return null;
  }
}

async function waitForLanguageServerExit(timeoutMs = 120000) {
  if (!isLanguageServerRunning()) return true;
  console.log('[wait] language_server is still running. Please quit Antigravity completely; safe archiving will start automatically once it exits...');
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 1500));
    if (!isLanguageServerRunning()) {
      await new Promise((r) => setTimeout(r, 1500));
      return true;
    }
  }
  return false;
}

function parseStrictCliNonNegativeNumber(flagName, rawValue, { integer = false } = {}) {
  if (typeof rawValue !== 'string' || rawValue.trim() === '') {
    throw new Error(`Invalid CLI option ${flagName}: expected a non-empty non-negative finite number`);
  }
  const n = Number(rawValue.trim());
  if (!Number.isFinite(n) || n < 0 || (integer && !Number.isInteger(n))) {
    throw new Error(
      `Invalid CLI option ${flagName}=${rawValue}: expected a non-negative finite ${integer ? 'integer' : 'number'}`
    );
  }
  return n;
}

export function parseCliArgs(argv) {
  const opts = {
    action: 'scan',
    mode: 'subagents',
    subagentHours: DEFAULT_SUBAGENT_MAX_AGE_HOURS,
    mainDays: DEFAULT_MAIN_MAX_AGE_DAYS,
    keepRecentMain: DEFAULT_KEEP_RECENT_MAIN,
    dryRun: false,
    waitExit: false,
    json: false,
    restoreBatch: 'latest',
    runTaskFile: '',
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--scan') opts.action = 'scan';
    else if (a === '--prepare') opts.action = 'prepare';
    else if (a === '--archive') opts.action = 'archive';
    else if (a === '--restore') {
      opts.action = 'restore';
      if (argv[i + 1] && !argv[i + 1].startsWith('--')) opts.restoreBatch = argv[++i];
    } else if (a === '--list-batches') opts.action = 'list';
    else if (a === '--run-task') {
      throw new Error('Invalid CLI option --run-task: missing "=value"');
    } else if (a.startsWith('--run-task=')) {
      const f = a.slice('--run-task='.length).trim();
      if (!f) throw new Error('Invalid CLI option --run-task: expected non-empty path');
      opts.action = 'run-task';
      opts.runTaskFile = f;
    }
    else if (a === '--include-old-main') opts.mode = 'subagents+old-main';
    else if (a === '--dry-run') opts.dryRun = true;
    else if (a === '--wait-exit') opts.waitExit = true;
    else if (a === '--json') opts.json = true;
    else if (a === '--subagent-hours' || a === '--main-days' || a === '--keep-main') {
      throw new Error(`Invalid CLI option ${a}: missing "=value"`);
    } else if (a.startsWith('--subagent-hours=')) {
      opts.subagentHours = parseStrictCliNonNegativeNumber('--subagent-hours', a.slice('--subagent-hours='.length));
    } else if (a.startsWith('--main-days=')) {
      opts.mainDays = parseStrictCliNonNegativeNumber('--main-days', a.slice('--main-days='.length));
    } else if (a.startsWith('--keep-main=')) {
      opts.keepRecentMain = parseStrictCliNonNegativeNumber('--keep-main', a.slice('--keep-main='.length), {
        integer: true,
      });
    }
  }
  return opts;
}

export async function executeCli(argv = process.argv.slice(2), deps = {}) {
  const opts = parseCliArgs(argv);
  const convDir = deps.convDir || getDefaultConversationsDir();
  const archiveDir = deps.archiveDir || getDefaultArchiveDir();
  const checkRunning = typeof deps.isRunning === 'function' ? deps.isRunning : isLanguageServerRunning;
  const waitExitFn = typeof deps.waitExit === 'function' ? deps.waitExit : waitForLanguageServerExit;
  const logOut = typeof deps.log === 'function' ? deps.log : console.log;
  const logErr = typeof deps.error === 'function' ? deps.error : console.error;
  const setExitCode = typeof deps.setExitCode === 'function' ? deps.setExitCode : (c) => { process.exitCode = c; };

  if (opts.action === 'run-task') {
    const resolvedTask = path.resolve(opts.runTaskFile);
    const st = assertPathChainNoSymlinks(resolvedTask, 'archive task file');
    if (!st || !st.isFile() || st.size > 256 * 1024) {
      throw new Error('Archive task file missing or invalid');
    }
    const rawText = fs.readFileSync(resolvedTask, 'utf8');
    try { fs.unlinkSync(resolvedTask); } catch {}
    const task = JSON.parse(rawText);
    const res = await executeArchiveTaskSequence(task);
    if (opts.json) logOut(JSON.stringify(res, null, 2));
    if (!res.ok) setExitCode(1);
    return res;
  }

  if (opts.action === 'list') {
    const batches = listArchiveBatches(archiveDir);
    if (opts.json) logOut(JSON.stringify(batches, null, 2));
    else logOut(batches.length ? batches : 'No archive batches found.');
    return batches;
  }

  if (opts.action === 'prepare' || opts.action === 'scan') {
    const liveSums = typeof deps.fetchLiveSummaries === 'function' ? await deps.fetchLiveSummaries() : await fetchLiveSummariesViaClient();
    if (liveSums) saveCatalogIndex(archiveDir, liveSums);
    const report = scanConversationStorage({
      convDir,
      archiveDir,
      summaries: liveSums,
      subagentMaxAgeHours: opts.subagentHours,
      mainMaxAgeDays: opts.mainDays,
      keepRecentMain: opts.keepRecentMain,
    });
    let helpers = null;
    if (opts.action === 'prepare') {
      helpers = writeHelperScripts({
        scriptPath: fileURLToPath(import.meta.url),
        archiveDir,
        mode: opts.mode,
        subagentMaxAgeHours: opts.subagentHours,
        mainDays: opts.mainDays,
        keepRecentMain: opts.keepRecentMain,
      });
    }
    if (opts.json) {
      const { archivableSubagents, archivableOldMain, ...summary } = report;
      logOut(JSON.stringify({ ...summary, helpers }, null, 2));
      return { ...summary, helpers };
    }
    logOut(`[scan] Conversations dir: ${report.convDir}`);
    logOut(`[scan] Total size: ${report.totalMb} MB (${report.conversationCount} conversations: ${report.mainCount} main / ${report.mainMb} MB, ${report.subagentCount} hidden subagents / ${report.subagentMb} MB)`);
    logOut(`[tip] Safely archivable finished subagents (>${opts.subagentHours}h): ${report.archivableSubagentCount} items, estimated savings ${report.archivableSubagentMb} MB`);
    if (helpers) {
      logOut(`[ready] Safe archive helper script generated: ${helpers.archiveScriptPath}`);
      logOut(`[ready] Lossless restore helper script generated: ${helpers.restoreScriptPath}`);
    }
    return { report, helpers };
  }

  if (opts.action === 'archive') {
    if (!opts.dryRun && opts.waitExit && checkRunning()) {
      const exited = await waitExitFn(120000);
      if (!exited) {
        logErr('[abort] Timed out waiting for language_server to exit. Fully quit Antigravity and retry.');
        setExitCode(1);
        return { ok: false, code: 'WAIT_EXIT_TIMEOUT' };
      }
    }
    const res = archiveConversations({
      convDir,
      archiveDir,
      mode: opts.mode,
      subagentMaxAgeHours: opts.subagentHours,
      mainMaxAgeDays: opts.mainDays,
      keepRecentMain: opts.keepRecentMain,
      dryRun: opts.dryRun,
      checkRunning,
    });
    if (!opts.dryRun && res.ok && Number(res.movedCount || 0) > 0) {
      writeLastArchiveResult(archiveDir, { ...res, action: 'archive', relaunched: false });
    }
    if (opts.json) logOut(JSON.stringify(res, null, 2));
    else if (!res.ok) {
      logErr(`[denied] ${res.error}`);
      setExitCode(1);
    } else if (res.dryRun) {
      logOut(`[dry-run] Would move ${res.candidateCount} conversations (${res.candidateMb} MB); estimated remaining DB size: ${res.remainingEstimatedMb} MB (all main conversations preserved).`);
    } else {
      logOut(`[done] Safely archived ${res.movedCount} conversations (freed ${res.movedMb} MB) to: ${res.batchDir}`);
      logOut(`[done] Estimated remaining DB size: ~${res.remainingEstimatedMb} MB. You may now reopen Antigravity.`);
    }
    return res;
  }

  if (opts.action === 'restore') {
    let safeBatch;
    try {
      safeBatch = validateBatchSelector(opts.restoreBatch);
    } catch (err) {
      const errRes = { ok: false, code: 'INVALID_BATCH', error: err?.message || 'Invalid archive batch name' };
      if (opts.json) logOut(JSON.stringify(errRes, null, 2));
      else logErr(`[denied] ${errRes.error}`);
      setExitCode(1);
      return errRes;
    }
    if (opts.waitExit && checkRunning()) {
      const exited = await waitExitFn(120000);
      if (!exited) {
        const timeoutRes = {
          ok: false,
          code: 'WAIT_EXIT_TIMEOUT',
          error: 'Timed out waiting for language_server to exit. Fully quit Antigravity and retry.',
        };
        if (opts.json) logOut(JSON.stringify(timeoutRes, null, 2));
        else logErr(`[abort] ${timeoutRes.error}`);
        setExitCode(1);
        return timeoutRes;
      }
    }
    const res = restoreArchiveBatch({ convDir, archiveDir, batchName: safeBatch, checkRunning });
    if (opts.json) logOut(JSON.stringify(res, null, 2));
    else if (!res.ok) {
      logErr(`[failed] ${res.error}`);
      setExitCode(1);
    } else {
      logOut(`[done] Losslessly restored batch ${res.batchName}: restored ${res.restoredCount} conversations (skipped ${res.skippedCount} conflicts).`);
    }
    return res;
  }
  return null;
}

async function runCli() {
  await executeCli(process.argv.slice(2));
}

function resolveRealpathForEntry(targetPath) {
  if (typeof fs.realpathSync.native === 'function') {
    try {
      return fs.realpathSync.native(targetPath);
    } catch (err) {
      if (err && (err.code === 'ENOENT' || err.code === 'ENOTDIR' || err.code === 'EACCES' || err.code === 'EPERM')) {
        return path.resolve(targetPath);
      }
    }
  }
  try {
    return fs.realpathSync(targetPath);
  } catch {
    return path.resolve(targetPath);
  }
}

/**
 * Determine whether this module was launched directly as the CLI entry point.
 * Resolves symlinks and Windows junctions (e.g., when ~/.gemini is moved to another drive)
 * and normalizes drive letter casing on Win32.
 */
export function isMainEntry(argv1, moduleUrl = import.meta.url) {
  if (!argv1 || !moduleUrl) return false;
  const modulePath = String(moduleUrl).startsWith('file:') ? fileURLToPath(moduleUrl) : String(moduleUrl);
  const resolvedArgv = resolveRealpathForEntry(argv1);
  const resolvedSelf = resolveRealpathForEntry(modulePath);
  if (process.platform === 'win32') {
    return (
      resolvedArgv.replace(/^\\\\\?\\/, '').toLowerCase() ===
      resolvedSelf.replace(/^\\\\\?\\/, '').toLowerCase()
    );
  }
  return resolvedArgv === resolvedSelf;
}

const isEntry = isMainEntry(process.argv[1], import.meta.url);

if (isEntry) {
  runCli().catch((err) => {
    console.error('[error]', err?.message || err);
    process.exitCode = 1;
  });
}
