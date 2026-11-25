// Obsidian Prism v1.0.2 - Live Antigravity Host CDP Adapter (Sidebar Studio v2)
// - Strictly enforces the zero global permission writes rule (globalPermissionWrites is always 0)
// - Only invokes the 4 project-level setters on renderer window.__agPrismSidebarHostOps.psp via controlled evaluateInHost
// - Supports Win32 case/trailing-slash normalization + WSL /mnt/<drive>/... cross-environment shared directory detection
// - Any host offline/timeout/error conservatively returns failure or ambiguous; never fabricates success or writes blindly

import fs from 'node:fs';
import path from 'node:path';

const ALLOWED_AUTO_EXEC = new Set(['unspecified', 'off', 'ask', 'auto', 'eager', 'turbo', 'sandbox']);
const ALLOWED_FILE_ACCESS = new Set(['unspecified', 'deny', 'ask', 'allow', 'deny-outside', 'ask-outside', 'allow-workspace', 'allow-all']);
const ALLOWED_INTERNET = new Set(['unspecified', 'deny', 'ask', 'allow']);
const ALLOWED_SANDBOX = new Set(['off', 'disabled', 'on', 'enabled', 'enabled-if-supported', 'wsl2']);

function isPlainObject(v) {
  return Boolean(v) && typeof v === 'object' && !Array.isArray(v);
}

function serializeJsonForEval(val) {
  const raw = JSON.stringify(val === undefined ? null : val);
  return String(raw).replace(/[<>/\u2028\u2029]/g, (ch) =>
    `\\u${ch.charCodeAt(0).toString(16).padStart(4, '0')}`
  );
}

/**
 * Normalize a local directory path for comparison with active Code workspaces:
 * - Unify extended UNC (`\\?\UNC\server\share\...`) and standard UNC (`\\server\share\...`) to `//server/share/...`
 * - Normalize WSL mount paths `/mnt/c/foo/bar` to `c:/foo/bar` for cross-environment comparison with Win32 `C:\foo\bar`
 * - Unify forward slashes and strip trailing slashes; lowercase for Windows, UNC, and WSL drive paths
 */
export function normalizeHostPathKey(rawPath) {
  if (typeof rawPath !== 'string') return '';
  let s = rawPath.trim();
  if (!s) return '';
  if (/^\\\\\?\\UNC\\/i.test(s)) {
    s = `//${s.slice(8)}`;
  } else if (s.startsWith('\\\\?\\')) {
    s = s.slice(4);
  }
  const wslMatch = s.match(/^\/mnt\/([a-zA-Z])(?:\/(.*))?$/);
  if (wslMatch) {
    const drive = wslMatch[1].toLowerCase();
    const rest = String(wslMatch[2] || '').replace(/\/+/g, '/').replace(/^\/+|\/+$/g, '');
    return rest ? `${drive}:/${rest.toLowerCase()}` : `${drive}:/`;
  }
  if (/^(?:\\\\|\/\/)/.test(s)) {
    const uncBody = s.replace(/\\/g, '/').replace(/^\/+/, '').replace(/\/+/g, '/').replace(/\/+$/g, '');
    if (!uncBody) return '';
    return `//${uncBody.toLowerCase()}`;
  }
  const winDrive = /^([a-zA-Z]):(?:[\\/]|$)/.test(s);
  if (winDrive) {
    s = s.replace(/\\/g, '/').replace(/\/+/g, '/').replace(/\/+$/g, '');
    if (s.length === 2 && s[1] === ':') s += '/';
    return s.toLowerCase();
  }
  s = s.replace(/\\/g, '/').replace(/\/+/g, '/').replace(/\/+$/g, '');
  if (!s) return '/';
  return process.platform === 'win32' ? s.toLowerCase() : s;
}

function resolveRealPathKey(rawPath) {
  if (typeof rawPath !== 'string' || !rawPath.trim()) return '';
  try {
    return normalizeHostPathKey(fs.realpathSync(rawPath));
  } catch {
    return normalizeHostPathKey(rawPath);
  }
}

function resolveFileIdentityKey(rawPath) {
  if (typeof rawPath !== 'string' || !rawPath.trim()) return '';
  try {
    const st = fs.statSync(rawPath, { bigint: true });
    if (st && typeof st.ino === 'bigint' && st.ino > 0n) {
      return `id:${String(st.dev)}:${String(st.ino)}`;
    }
  } catch {}
  return '';
}

function isPathPrefixOf(parentKey, childKey) {
  if (!parentKey || !childKey) return false;
  if (parentKey === childKey) return true;
  if (parentKey === '/') {
    return childKey.startsWith('/') && !childKey.startsWith('//');
  }
  if (/^[a-z]:\/$/.test(parentKey)) {
    return childKey.startsWith(parentKey);
  }
  return childKey.startsWith(`${parentKey}/`);
}

function isSameOrNestedPathKey(a, b) {
  if (!a || !b) return false;
  if (a === b) return true;
  return isPathPrefixOf(a, b) || isPathPrefixOf(b, a);
}

const RESERVED_GLOBAL_SCOPES = new Set(['global', 'default', '*', 'all', 'root', 'user']);
const FORBIDDEN_OBJECT_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

function sanitizeCatalogItem(raw) {
  if (!isPlainObject(raw)) return null;
  const cascadeId = typeof raw.cascadeId === 'string' && raw.cascadeId.trim() ? raw.cascadeId.trim().slice(0, 128) : '';
  if (!cascadeId || FORBIDDEN_OBJECT_KEYS.has(cascadeId)) return null;
  const rawStatus = typeof raw.status === 'string' ? raw.status.trim().toLowerCase() : 'idle';
  const status = rawStatus === 'running' || rawStatus === 'blocked' || rawStatus === 'error' ? rawStatus : 'idle';
  const updatedAt = Number.isFinite(Number(raw.updatedAt)) ? Number(raw.updatedAt) : Date.now();
  const statusStartedAt = Number.isFinite(Number(raw.statusStartedAt)) ? Number(raw.statusStartedAt) : updatedAt;
  return {
    cascadeId,
    title: typeof raw.title === 'string' ? raw.title.slice(0, 160) : '',
    status,
    statusStartedAt,
    updatedAt,
    workspace: typeof raw.workspace === 'string' ? raw.workspace.slice(0, 260) : '',
    workspacePath: typeof raw.workspacePath === 'string' ? raw.workspacePath.slice(0, 1024) : '',
    hidden: Boolean(raw.hidden),
    pinned: Boolean(raw.pinned),
    archived: Boolean(raw.archived),
    unread: Boolean(raw.unread),
  };
}

/**
 * Build the live CDP Host Adapter for the Antigravity daemon / inject runtime.
 * @param {object} options
 * @param {(expression: string, timeoutMs?: number) => Promise<any>} options.evaluateInHost
 * @param {(msg: string) => void} [options.logger]
 */
export function createLiveHostAdapter(options = {}) {
  const evaluateInHost = typeof options.evaluateInHost === 'function' ? options.evaluateInHost : null;
  const logger = typeof options.logger === 'function' ? options.logger : () => {};

  let catalog = { health: 'loading', items: [], lastKnownById: Object.create(null) };
  let codeDirKeys = new Set();
  let hostProjectDirKeys = new Set();
  let hostProjectIds = new Set();
  const scopeDirPaths = new Map();
  const recentlyDelivered = new Map();
  const deletedTombstones = new Map();
  const OPTIMISTIC_DELIVERY_TTL_MS = 15000;
  const DELETED_TOMBSTONE_TTL_MS = 5 * 60 * 1000;
  const MAX_DELETED_TOMBSTONES = 1000;

  const pruneDeletedTombstones = (now = Date.now()) => {
    for (const [cid, ts] of deletedTombstones.entries()) {
      if (!Number.isFinite(ts) || now - ts > DELETED_TOMBSTONE_TTL_MS) {
        deletedTombstones.delete(cid);
      }
    }
    while (deletedTombstones.size > MAX_DELETED_TOMBSTONES) {
      const oldestKey = deletedTombstones.keys().next().value;
      if (oldestKey === undefined) break;
      deletedTombstones.delete(oldestKey);
    }
  };

  const checkPathSharedWithCode = (dirPath) => {
    if (typeof dirPath !== 'string' || !dirPath.trim()) return false;
    const realKey = resolveRealPathKey(dirPath);
    const normKey = normalizeHostPathKey(dirPath);
    const fileIdKey = resolveFileIdentityKey(dirPath);
    if (
      (realKey && codeDirKeys.has(realKey)) ||
      (normKey && codeDirKeys.has(normKey)) ||
      (fileIdKey && codeDirKeys.has(fileIdKey))
    ) {
      return true;
    }
    // Segment-boundary ancestor/descendant comparison (covers recursive directory-tree project permissions)
    for (const existingKey of codeDirKeys) {
      if (!existingKey || existingKey.startsWith('id:')) continue;
      if (isSameOrNestedPathKey(realKey, existingKey) || isSameOrNestedPathKey(normKey, existingKey)) {
        return true;
      }
    }
    // Also compare against known Code session workspacePath entries (including physical File ID and ancestor/descendant trees)
    for (const it of catalog.items) {
      if (!it || !it.workspacePath) continue;
      const wk = resolveRealPathKey(it.workspacePath);
      const wnorm = normalizeHostPathKey(it.workspacePath);
      if (isSameOrNestedPathKey(realKey, wk) || isSameOrNestedPathKey(normKey, wnorm)) return true;
      if (fileIdKey) {
        const wfid = resolveFileIdentityKey(it.workspacePath);
        if (wfid && wfid === fileIdKey) return true;
      }
    }
    return false;
  };
  let capabilities = {
    projectPermissions: false,
    perCascadeIsolation: false,
    sessionRebind: false,
    sandboxAvailable: false,
    wslAvailable: false,
    artifactsAvailable: true,
  };

  let projectPermissionWrites = 0;
  let nonDestructiveGuardCount = 0;
  const permissionAuditLog = [];

  const pushAudit = (entry) => {
    permissionAuditLog.push({ ts: Date.now(), ...entry });
    if (permissionAuditLog.length > 200) permissionAuditLog.splice(0, permissionAuditLog.length - 200);
  };

  const upsertCatalogItem = (item) => {
    if (!item || !item.cascadeId || FORBIDDEN_OBJECT_KEYS.has(item.cascadeId)) return;
    const items = Array.isArray(catalog.items) ? catalog.items.slice() : [];
    const idx = items.findIndex((x) => x && x.cascadeId === item.cascadeId);
    if (idx >= 0) items[idx] = { ...items[idx], ...item };
    else items.unshift(item);
    const nextById = Object.assign(Object.create(null), catalog.lastKnownById);
    nextById[item.cascadeId] = item;
    catalog = {
      health: catalog.health === 'error' ? 'error' : 'ready',
      items,
      lastKnownById: nextById,
    };
  };

  const callHostOp = async (methodName, argObj = null, timeoutMs = 4500) => {
    if (!evaluateInHost) return { ok: false, error: 'host-evaluator-unavailable' };
    const safeMethod = String(methodName || '').replace(/[^a-zA-Z0-9_.]/g, '');
    const parts = safeMethod.split('.').filter(Boolean);
    if (
      !safeMethod ||
      parts.length === 0 ||
      parts.some((p) => p === '__proto__' || p === 'prototype' || p === 'constructor')
    ) {
      return { ok: false, error: 'invalid-host-op' };
    }
    // Pass as a JSON string literal and construct via JSON.parse inside the host to eliminate __proto__ object literal prototype pollution
    const argStrLiteral = serializeJsonForEval(JSON.stringify(argObj === undefined ? null : argObj));
    const expr = `(async () => {
      try {
        const ops = window.__agPrismSidebarHostOps;
        if (!ops || typeof ops !== 'object') return { ok: false, error: 'host-ops-not-mounted' };
        const parts = ${serializeJsonForEval(parts)};
        let owner = ops;
        for (let i = 0; i < parts.length - 1; i++) {
          owner = owner && typeof owner === 'object' && Object.prototype.hasOwnProperty.call(owner, parts[i]) ? owner[parts[i]] : null;
        }
        const leaf = parts[parts.length - 1];
        const fn = owner && typeof owner === 'object' && Object.prototype.hasOwnProperty.call(owner, leaf) ? owner[leaf] : null;
        if (typeof fn !== 'function') return { ok: false, error: 'host-op-missing' };
        const parsedArg = JSON.parse(${argStrLiteral});
        return await fn.call(owner, parsedArg);
      } catch (err) {
        return { ok: false, error: String(err && err.message ? err.message : err) };
      }
    })()`;
    try {
      const res = await evaluateInHost(expr, timeoutMs);
      return res === undefined || res === null ? { ok: false, error: 'empty-host-response' } : res;
    } catch (err) {
      return { ok: false, error: String(err && err.message ? err.message : err) };
    }
  };

  const updateCodeDirKeys = (rawPaths) => {
    const next = new Set();
    if (Array.isArray(rawPaths)) {
      for (const p of rawPaths) {
        const k = resolveRealPathKey(p);
        if (k) next.add(k);
        const norm = normalizeHostPathKey(p);
        if (norm) next.add(norm);
        const fid = resolveFileIdentityKey(p);
        if (fid) next.add(fid);
      }
    }
    codeDirKeys = next;
  };

  const invokeProjectSetter = async (setterName, scopeRef, value, allowedSet) => {
    const trimmedScope = typeof scopeRef === 'string' ? scopeRef.trim() : '';
    if (!trimmedScope || RESERVED_GLOBAL_SCOPES.has(trimmedScope.toLowerCase())) {
      throw new Error(`Invalid or reserved global scopeRef for ${setterName}`);
    }
    if (allowedSet && value !== null && !allowedSet.has(String(value))) {
      throw new Error(`Disallowed policy value for ${setterName}`);
    }
    const dirPath = scopeDirPaths.get(trimmedScope) || '';
    const res = await callHostOp(`psp.${setterName}`, { scopeRef: trimmedScope, dirPath, value }, 5000);
    if (!res || res.ok !== true) {
      pushAudit({
        scope: 'project-only',
        setter: setterName,
        scopeRef,
        value,
        ok: false,
        detail: res?.error || 'host-setter-rejected',
      });
      throw new Error(res?.error || `${setterName} failed in host`);
    }
    projectPermissionWrites += 1;
    pushAudit({
      scope: 'project-only',
      setter: setterName,
      scopeRef,
      value,
      ok: true,
    });
  };

  const projectSettingsProvider = {
    async getProjectPermissionGrants(scopeRef) {
      if (typeof scopeRef !== 'string' || !scopeRef.trim()) return null;
      const trimmedScope = scopeRef.trim();
      const dirPath = scopeDirPaths.get(trimmedScope) || '';
      const res = await callHostOp('psp.getProjectPermissionGrants', { scopeRef: trimmedScope, dirPath }, 4000);
      if (!res || res.ok !== true || !isPlainObject(res.grants)) return null;
      return { ...res.grants };
    },
    async setProjectAutoExecutionPolicy(scopeRef, policy) {
      return invokeProjectSetter('setProjectAutoExecutionPolicy', scopeRef, policy, ALLOWED_AUTO_EXEC);
    },
    async setProjectFileAccessPolicy(scopeRef, policy) {
      return invokeProjectSetter('setProjectFileAccessPolicy', scopeRef, policy, ALLOWED_FILE_ACCESS);
    },
    async setProjectInternetPolicy(scopeRef, policy) {
      return invokeProjectSetter('setProjectInternetPolicy', scopeRef, policy, ALLOWED_INTERNET);
    },
    async setProjectSandboxMode(scopeRef, mode) {
      return invokeProjectSetter('setProjectSandboxMode', scopeRef, mode, ALLOWED_SANDBOX);
    },
  };

  return {
    isSandbox: false,
    getCatalog() {
      return {
        health: catalog.health,
        items: catalog.items.map((it) => ({ ...it })),
        lastKnownById: { ...catalog.lastKnownById },
      };
    },
    registerScopePath(scopeRef, dirPath) {
      if (typeof scopeRef === 'string' && scopeRef.trim() && typeof dirPath === 'string' && dirPath.trim()) {
        scopeDirPaths.set(scopeRef.trim(), dirPath.trim());
      }
    },
    syncFromRenderer(payload) {
      if (!isPlainObject(payload)) return;
      if (isPlainObject(payload.catalog)) {
        const now = Date.now();
        pruneDeletedTombstones(now);
        const rawHealth = payload.catalog.health;
        const health = rawHealth === 'ready' || rawHealth === 'error' ? rawHealth : 'loading';
        const rawItems = Array.isArray(payload.catalog.items) ? payload.catalog.items : [];
        const items = [];
        const seen = new Set();
        const prevById = Object.assign(Object.create(null), catalog.lastKnownById);
        for (const deletedId of deletedTombstones.keys()) {
          delete prevById[deletedId];
        }
        for (let i = 0; i < rawItems.length && items.length < 1000; i++) {
          const item = sanitizeCatalogItem(rawItems[i]);
          if (!item || seen.has(item.cascadeId)) continue;
          if (deletedTombstones.has(item.cascadeId)) continue;
          seen.add(item.cascadeId);
          items.push(item);
          prevById[item.cascadeId] = item;
          recentlyDelivered.delete(item.cascadeId);
        }
        // Before host Redux trajectorySummaries async push arrives, retain newly delivered Chat sessions briefly to avoid falsely falling back to `/`
        for (const [cid, entry] of recentlyDelivered.entries()) {
          if (!entry || now - entry.ts > OPTIMISTIC_DELIVERY_TTL_MS || deletedTombstones.has(cid) || FORBIDDEN_OBJECT_KEYS.has(cid)) {
            recentlyDelivered.delete(cid);
            continue;
          }
          if (!seen.has(cid) && entry.item) {
            seen.add(cid);
            items.unshift(entry.item);
            prevById[cid] = entry.item;
          }
        }
        // Upper-bound guard: keep lastKnownById strictly <= 2000 entries (prioritize currently visible seen items by updatedAt, then recent history)
        const MAX_LAST_KNOWN_CATALOG = 2000;
        const prevKeys = Object.keys(prevById);
        let boundedById = prevById;
        if (prevKeys.length > MAX_LAST_KNOWN_CATALOG) {
          boundedById = Object.create(null);
          const activeKeys = [];
          const extras = [];
          for (let i = 0; i < prevKeys.length; i++) {
            const k = prevKeys[i];
            if (seen.has(k)) {
              activeKeys.push(k);
            } else {
              extras.push(k);
            }
          }
          if (activeKeys.length > MAX_LAST_KNOWN_CATALOG) {
            activeKeys.sort((a, b) => (Number(prevById[b]?.updatedAt) || 0) - (Number(prevById[a]?.updatedAt) || 0));
          }
          let kept = 0;
          for (let i = 0; i < activeKeys.length && kept < MAX_LAST_KNOWN_CATALOG; i++) {
            boundedById[activeKeys[i]] = prevById[activeKeys[i]];
            kept++;
          }
          const remain = MAX_LAST_KNOWN_CATALOG - kept;
          if (remain > 0 && extras.length > 0) {
            extras.sort((a, b) => (Number(prevById[b]?.updatedAt) || 0) - (Number(prevById[a]?.updatedAt) || 0));
            for (let i = 0; i < extras.length && i < remain; i++) {
              boundedById[extras[i]] = prevById[extras[i]];
            }
          }
        }
        catalog = { health, items, lastKnownById: boundedById };
      }
      if (Array.isArray(payload.codeWorkspacePaths)) {
        updateCodeDirKeys(payload.codeWorkspacePaths);
      }
      if (Array.isArray(payload.hostProjects)) {
        const nextDirKeys = new Set();
        const nextIds = new Set();
        for (const p of payload.hostProjects) {
          if (!isPlainObject(p)) continue;
          if (typeof p.id === 'string' && p.id.trim()) nextIds.add(p.id.trim());
          const pPaths = [];
          if (typeof p.path === 'string' && p.path.trim()) pPaths.push(p.path.trim());
          if (Array.isArray(p.paths)) {
            for (const sub of p.paths) {
              if (typeof sub === 'string' && sub.trim()) pPaths.push(sub.trim());
            }
          }
          for (const dir of pPaths) {
            const rk = resolveRealPathKey(dir);
            if (rk) nextDirKeys.add(rk);
            const nk = normalizeHostPathKey(dir);
            if (nk) nextDirKeys.add(nk);
          }
        }
        hostProjectDirKeys = nextDirKeys;
        hostProjectIds = nextIds;
      }
      if (isPlainObject(payload.capabilities)) {
        capabilities = {
          projectPermissions: Boolean(payload.capabilities.projectPermissions),
          perCascadeIsolation: Boolean(payload.capabilities.perCascadeIsolation),
          sessionRebind: Boolean(payload.capabilities.sessionRebind),
          sandboxAvailable: Boolean(payload.capabilities.sandboxAvailable),
          wslAvailable: Boolean(payload.capabilities.wslAvailable),
          artifactsAvailable: payload.capabilities.artifactsAvailable !== false,
        };
      }
    },
    getCapabilities() {
      return { ...capabilities };
    },
    getProjectSettingsProvider() {
      return capabilities.projectPermissions ? projectSettingsProvider : null;
    },
    isPathSharedWithCode(dirPath) {
      return checkPathSharedWithCode(dirPath);
    },
    isScopeIsolated(scopeRef, scopeMeta = null) {
      if (!capabilities.projectPermissions) return false;
      const trimmedScope = typeof scopeRef === 'string' ? scopeRef.trim() : '';
      if (!trimmedScope || RESERVED_GLOBAL_SCOPES.has(trimmedScope.toLowerCase())) {
        return false;
      }
      const wslIsolated = Boolean(scopeMeta && scopeMeta.wslIsolated === true);
      if (scopeMeta && scopeMeta.sharedWithCode === true && !wslIsolated) {
        return false;
      }
      if (!wslIsolated) {
        const candidatePath =
          (scopeMeta && typeof scopeMeta.dirPath === 'string' && scopeMeta.dirPath.trim()) ||
          scopeDirPaths.get(trimmedScope) ||
          '';
        if (candidatePath) {
          if (checkPathSharedWithCode(candidatePath)) return false;
        } else if (!scopeMeta || typeof scopeMeta.sharedWithCode !== 'boolean') {
          // Neither explicit sharedWithCode result nor registered path available; conservatively refuse to assume isolation
          return false;
        }
      }
      return true;
    },
    usesPerCascadeIsolation(scopeRef, kind, dirPath = '') {
      if (!capabilities.perCascadeIsolation) return false;
      if (kind === 'knowledge') return true;
      if (kind === 'spark') {
        const trimmedScope = typeof scopeRef === 'string' ? scopeRef.trim() : '';
        if (trimmedScope && hostProjectIds.has(trimmedScope)) return false;
        if (typeof dirPath === 'string' && dirPath.trim()) {
          const rk = resolveRealPathKey(dirPath);
          const nk = normalizeHostPathKey(dirPath);
          if ((rk && hostProjectDirKeys.has(rk)) || (nk && hostProjectDirKeys.has(nk))) {
            return false;
          }
        }
        return true;
      }
      return false;
    },
    recordPerCascadeIsolationAudit(scopeRef, detail) {
      nonDestructiveGuardCount += 1;
      pushAudit({
        scope: 'per-cascade-isolated',
        nonDestructive: true,
        setter: 'per-cascade-config-guard',
        scopeRef,
        value: 'autoExecutionPolicy=OFF(per-cascade)',
        ok: true,
        detail: String(detail || 'per-cascade-isolated'),
      });
    },
    recordNonDestructiveSharedAudit(scopeRef, detail) {
      nonDestructiveGuardCount += 1;
      pushAudit({
        scope: 'non-destructive-shared',
        nonDestructive: true,
        setter: 'non-destructive-shared-guard',
        scopeRef,
        value: 'preserve-active-code-permissions',
        ok: true,
        detail: String(detail || 'shared-with-code'),
      });
    },
    requiresWslConfirmation(_kind) {
      return false;
    },
    async verifyWslEnvironment() {
      if (!capabilities.wslAvailable) return false;
      const res = await callHostOp('verifyWslEnvironment', null, 4000);
      return Boolean(res && res.ok === true && res.available === true);
    },
    async verifyArtifacts() {
      return Boolean(capabilities.artifactsAvailable);
    },
    async validateSessionRebind({ cascadeId }) {
      if (!capabilities.sessionRebind) {
        return { ok: false, code: 'CAPABILITY_UNAVAILABLE', message: 'Host session rebind unavailable' };
      }
      const res = await callHostOp('validateSessionRebind', { cascadeId }, 4000);
      if (!res || res.ok !== true) {
        return {
          ok: false,
          code: typeof res?.code === 'string' ? res.code : 'CAPABILITY_UNAVAILABLE',
          message: typeof res?.message === 'string' ? res.message : 'Host rejected rebind precheck',
        };
      }
      return { ok: true };
    },
    async rebindSession({ cascadeId, scopeRef, placement }) {
      const res = await callHostOp('rebindSession', { cascadeId, scopeRef, placement }, 6000);
      if (!res || res.ok !== true || res.cascadeId !== cascadeId || res.scopeRef !== scopeRef) {
        return { ok: false };
      }
      return { ok: true, cascadeId, scopeRef };
    },
    async reserveSession({ idempotencyKey, scopeRef, kind, title, dirPath, modelId, effort }) {
      const res = await callHostOp(
        'reserveSession',
        { idempotencyKey, scopeRef, kind, title, dirPath, modelId, effort },
        10000
      );
      if (!res || res.ok !== true || typeof res.cascadeId !== 'string' || !res.cascadeId.trim()) {
        throw new Error(res?.error || 'Host failed to reserve Chat session');
      }
      return { cascadeId: res.cascadeId.trim(), hidden: Boolean(res.hidden), replayed: Boolean(res.replayed) };
    },
    async deliverFirstMessage({ idempotencyKey, cascadeId, message, scopeRef, kind, dirPath, modelId, effort }) {
      const res = await callHostOp(
        'deliverFirstMessage',
        { idempotencyKey, cascadeId, message, scopeRef, kind, dirPath, modelId, effort },
        20000
      );
      if (!res || typeof res.status !== 'string') {
        logger(`[sidebar-studio] deliverFirstMessage returned unknown outcome for ${cascadeId}`);
        return { status: 'ambiguous', cascadeId };
      }
      if (res.status === 'delivered' && res.cascadeId === cascadeId) {
        const now = Date.now();
        const snippet = String(message || '').trim().slice(0, 64) || 'Chat Conversation';
        const optimisticItem = {
          cascadeId,
          title: snippet,
          status: 'running',
          statusStartedAt: now,
          updatedAt: now,
          workspace: kind === 'spark' && dirPath ? path.basename(dirPath) || 'Spark' : 'Knowledge',
          workspacePath: kind === 'spark' ? String(dirPath || '') : '',
          hidden: false,
          pinned: false,
          unread: false,
        };
        deletedTombstones.delete(cascadeId);
        recentlyDelivered.set(cascadeId, { ts: now, item: optimisticItem });
        upsertCatalogItem(optimisticItem);
        return { status: 'delivered', cascadeId, replayed: Boolean(res.replayed) };
      }
      if (res.status === 'not-received' && res.cascadeId === cascadeId) {
        return { status: 'not-received', cascadeId };
      }
      return { status: 'ambiguous', cascadeId };
    },
    async updateConversationAnnotations({ cascadeId, annotations }) {
      const res = await callHostOp('updateConversationAnnotations', { cascadeId, annotations }, 6000);
      if (!res || res.ok !== true) {
        return { ok: false, error: res?.error || 'host-annotations-failed' };
      }
      // Optimistically update locally cached catalog item (title/pinned/archived) without waiting for the next Redux push
      const items = Array.isArray(catalog.items) ? catalog.items.slice() : [];
      const idx = items.findIndex((x) => x && x.cascadeId === cascadeId);
      if (idx >= 0 && isPlainObject(annotations) && !FORBIDDEN_OBJECT_KEYS.has(cascadeId)) {
        const nextItem = { ...items[idx] };
        if (typeof annotations.title === 'string' && annotations.title.trim()) nextItem.title = annotations.title.trim();
        if (typeof annotations.pinned === 'boolean') nextItem.pinned = annotations.pinned;
        if (typeof annotations.archived === 'boolean') nextItem.archived = annotations.archived;
        items[idx] = nextItem;
        const nextById = Object.assign(Object.create(null), catalog.lastKnownById);
        nextById[cascadeId] = nextItem;
        catalog = { ...catalog, items, lastKnownById: nextById };
      }
      return { ok: true, cascadeId };
    },
    async deleteConversation({ cascadeId }) {
      const res = await callHostOp('deleteConversation', { cascadeId }, 8000);
      if (!res || res.ok !== true) {
        return { ok: false, error: res?.error || 'host-delete-conversation-failed' };
      }
      const now = Date.now();
      pruneDeletedTombstones(now);
      deletedTombstones.set(cascadeId, now);
      recentlyDelivered.delete(cascadeId);
      const items = (Array.isArray(catalog.items) ? catalog.items : []).filter((x) => x && x.cascadeId !== cascadeId);
      const nextById = Object.assign(Object.create(null), catalog.lastKnownById);
      delete nextById[cascadeId];
      catalog = { ...catalog, items, lastKnownById: nextById };
      return { ok: true, cascadeId };
    },
    async cancelConversation({ cascadeId }) {
      const res = await callHostOp('cancelConversation', { cascadeId }, 5000);
      return res && res.ok === true ? { ok: true, cascadeId } : { ok: false, error: res?.error || 'host-cancel-failed' };
    },
    async checkDeliveryStatus({ idempotencyKey, cascadeId }) {
      const res = await callHostOp('checkDeliveryStatus', { idempotencyKey, cascadeId }, 5000);
      if (!res || res.ok !== true || res.cascadeId !== cascadeId) {
        return { delivered: false, confirmedNotReceived: false, cascadeId };
      }
      const delivered = Boolean(res.delivered);
      const confirmedNotReceived = Boolean(res.confirmedNotReceived);
      // Contradictory terminal states (claiming both delivered and not-received) are always treated as ambiguous; never resend blindly
      if (delivered && confirmedNotReceived) {
        return { delivered: false, confirmedNotReceived: false, cascadeId };
      }
      return {
        delivered,
        confirmedNotReceived,
        cascadeId,
      };
    },
    getAuditReport() {
      return {
        globalPermissionWrites: 0,
        projectPermissionWrites,
        nonDestructiveGuardCount,
        permissionAuditLog: permissionAuditLog.slice(-60),
      };
    },
  };
}

export default createLiveHostAdapter;
