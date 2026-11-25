// Obsidian Prism Pluggable On-Demand Addon Registry (sidecars/daemon/addon-registry.mjs)
// Pure Node built-ins with zero external npm dependencies:
// - Persistent directory defaults to ~/.gemini/antigravity/sidecar_data/obsidian-prism/addons/ (sibling to telemetry/)
// - Strict HTTPS allowlist downloads + hop-by-hop redirect re-validation (prevents SSRF / open-redirect hijacking)
// - Full in-memory SHA-256 verification before atomic rename from temporary staging directory
// - 100% blocks path traversal and Symlink/Junction escapes
// - Built-in periodic-picker (bundled) declaration; local status queries make strictly 0 hidden network requests
// - Gated behind hidden developer flag OBSIDIAN_PRISM_ADDONS_LAB=1; invisible to regular users by default

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DEFAULT_ROOT_DIR = path.resolve(__dirname, '..', '..');

export const GITHUB_REPO = 'RMvdesi/obsidian-prism';
export const ADDONS_LAB_ENV_VAR = 'OBSIDIAN_PRISM_ADDONS_LAB';
export const ADDONS_DIR_ENV_VAR = 'AG_PRISM_ADDONS_DIR';

export const MAX_MANIFEST_BYTES = 512 * 1024; // 512 KiB
export const MAX_ADDON_FILE_BYTES = 32 * 1024 * 1024; // 32 MiB
export const MAX_ADDON_TOTAL_BYTES = 128 * 1024 * 1024; // 128 MiB
export const MAX_ADDON_FILES = 64;
export const MAX_REDIRECTS = 5;

export const ADDON_ID_RE = /^[a-z0-9][a-z0-9-]{1,47}$/;
export const SHA256_HEX_RE = /^[0-9a-f]{64}$/i;
const SEMVER_RE = /^v?(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?(?:\+([0-9A-Za-z.-]+))?$/;
const EXPLICIT_PORT_RE = /^https:\/\/[^/?#]*:\d+(?:[/?#]|$)/i;
const WINDOWS_INVALID_SEG_CHARS_RE = /[<>:"|?*]/;
const WINDOWS_RESERVED_DEVICE_RE = /^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i;
const ENCODED_TRAVERSAL_RE = /(?:%2e|%5c|%00)/i;

export const TRUSTED_ADDON_HOSTS = Object.freeze([
  'github.com',
  'api.github.com',
  'raw.githubusercontent.com',
  'objects.githubusercontent.com',
  'release-assets.githubusercontent.com',
  'github-releases.githubusercontent.com',
]);

const TRUSTED_HOST_SET = new Set(TRUSTED_ADDON_HOSTS);
const REPO_LOCKED_HOST_PREFIXES = Object.freeze({
  'github.com': `/${GITHUB_REPO.toLowerCase()}/`,
  'raw.githubusercontent.com': `/${GITHUB_REPO.toLowerCase()}/`,
  'api.github.com': `/repos/${GITHUB_REPO.toLowerCase()}/`,
});

export const REDLINE_DIR_SEGMENTS = Object.freeze([
  'conversations_archive',
  'prism-knowledge-space',
  'antigravity-spark',
]);
const REDLINE_DIR_SET = new Set(REDLINE_DIR_SEGMENTS);

const RESERVED_ADDON_FILE_NAMES = new Set(['manifest.json', '.addon-meta.json']);

export const BUNDLED_ADDONS = Object.freeze([
  Object.freeze({
    id: 'periodic-picker',
    kind: 'bundled',
    name: 'Periodic Model Picker',
    entry: 'vendor/periodic-picker/periodic-picker.js',
    removable: false,
  }),
]);

/**
 * Developer lab hidden flag gate: enabled only when OBSIDIAN_PRISM_ADDONS_LAB === '1'.
 */
export function isLabEnabled(env = process.env) {
  return Boolean(env && env[ADDONS_LAB_ENV_VAR] === '1');
}

export { isLabEnabled as isAddonsLabEnabled };

/**
 * Validate a strict SemVer string (rejects empty prerelease or invalid build metadata segments).
 */
export function isValidSemver(raw) {
  if (typeof raw !== 'string') return false;
  const trimmed = raw.trim();
  if (!trimmed || trimmed.length > 128) return false;
  const m = SEMVER_RE.exec(trimmed);
  if (!m) return false;
  const major = Number(m[1]);
  const minor = Number(m[2]);
  const patch = Number(m[3]);
  if (!Number.isSafeInteger(major) || !Number.isSafeInteger(minor) || !Number.isSafeInteger(patch)) {
    return false;
  }
  if (m[4]) {
    const preParts = m[4].split('.');
    if (preParts.some((p) => !p)) return false;
  }
  if (m[5]) {
    const buildParts = m[5].split('.');
    if (buildParts.some((p) => !p)) return false;
  }
  return true;
}

function normalizeCmpPath(p) {
  const resolved = path.resolve(p);
  return process.platform === 'win32' ? resolved.toLowerCase() : resolved;
}

function normalizeMacosPrefix(rawPath) {
  const resolved = path.resolve(rawPath);
  if (process.platform === 'darwin') {
    if (resolved === '/tmp') return '/private/tmp';
    if (resolved.startsWith('/tmp/')) return `/private${resolved}`;
    if (resolved === '/var') return '/private/var';
    if (resolved.startsWith('/var/')) return `/private${resolved}`;
  }
  return resolved;
}

function isWithinDir(candidatePath, rootDir, allowEqual = false) {
  if (!candidatePath || !rootDir) return false;
  const c = normalizeCmpPath(normalizeMacosPrefix(candidatePath));
  const r = normalizeCmpPath(normalizeMacosPrefix(rootDir));
  if (c === r) return allowEqual;
  const prefix = r.endsWith(path.sep) ? r : r + path.sep;
  return c.startsWith(prefix);
}

export function hasRedlineSegment(targetPath) {
  if (typeof targetPath !== 'string' || !targetPath.trim()) return true;
  if (targetPath.includes('\0')) return true;
  const parts = path
    .resolve(targetPath)
    .split(/[\\/]+/)
    .filter(Boolean);
  return parts.some((seg) => REDLINE_DIR_SET.has(seg.toLowerCase()));
}

function expandAllowedRoots({ homeDir = os.homedir(), tmpDir = os.tmpdir(), extraAllowedRoots = [] } = {}) {
  const rawRoots = [];
  if (typeof homeDir === 'string' && homeDir.trim()) {
    rawRoots.push(path.join(path.resolve(homeDir), '.gemini'));
  }
  if (typeof tmpDir === 'string' && tmpDir.trim()) {
    rawRoots.push(path.resolve(tmpDir));
  }
  if (process.platform === 'darwin') {
    rawRoots.push('/tmp', '/private/tmp');
  }
  if (Array.isArray(extraAllowedRoots)) {
    for (const r of extraAllowedRoots) {
      if (typeof r === 'string' && r.trim()) rawRoots.push(path.resolve(r));
    }
  }
  const expanded = [];
  const seen = new Set();
  const pushUnique = (dir) => {
    const norm = normalizeMacosPrefix(dir);
    const key = normalizeCmpPath(norm);
    if (!seen.has(key)) {
      seen.add(key);
      expanded.push(norm);
    }
  };
  for (const r of rawRoots) {
    pushUnique(r);
    try {
      const real = fs.realpathSync(r);
      pushUnique(real);
    } catch {}
  }
  return expanded;
}

function isProtectedRootSelf(resolvedPath, homeDir = os.homedir()) {
  const parsed = path.parse(resolvedPath);
  if (normalizeCmpPath(resolvedPath) === normalizeCmpPath(parsed.root)) return true;
  const home = path.resolve(homeDir);
  const protectedSelf = [
    home,
    path.join(home, '.gemini'),
    path.join(home, '.gemini', 'config'),
    path.join(home, '.gemini', 'antigravity'),
    os.tmpdir(),
  ];
  const cmp = normalizeCmpPath(normalizeMacosPrefix(resolvedPath));
  return protectedSelf.some((p) => normalizeCmpPath(normalizeMacosPrefix(p)) === cmp);
}

/**
 * Check whether any symlink or NTFS junction exists along the chain from targetPath to stopRoot.
 * Returns true if a symlink/junction is found or stopRoot cannot be safely reached (fail-closed).
 */
export function hasSymlinkInChain(targetPath, stopRoot, lstatSyncFn = fs.lstatSync) {
  if (!targetPath || !stopRoot) return true;
  let cur = normalizeMacosPrefix(targetPath);
  const stopNorm = normalizeMacosPrefix(stopRoot);
  const stopCmp = normalizeCmpPath(stopNorm);
  let reachedStop = false;

  for (let depth = 0; depth < 64; depth++) {
    try {
      const st = lstatSyncFn(cur);
      if (st && typeof st.isSymbolicLink === 'function' && st.isSymbolicLink()) {
        return true;
      }
    } catch (err) {
      if (!err || err.code !== 'ENOENT') {
        return true;
      }
    }
    if (normalizeCmpPath(cur) === stopCmp) {
      reachedStop = true;
      break;
    }
    const parent = path.dirname(cur);
    if (!parent || parent === cur) break;
    cur = parent;
  }
  return !reachedStop;
}

export function getDefaultAddonsDir(homeDir = os.homedir()) {
  return path.join(path.resolve(homeDir), '.gemini', 'antigravity', 'sidecar_data', 'obsidian-prism', 'addons');
}

/**
 * Validate whether a candidate addonsDir is safe:
 * - Must reside strictly under ~/.gemini or os.tmpdir() (never equal to root or protected parent dirs)
 * - Must not match any redline directory segment
 * - When requireOwnedSegment=true (for env var overrides), path segments must include addons or obsidian-prism
 * - Neither the target nor its parent chain may contain symlinks/junctions
 */
export function validateAddonsDir(
  candidatePath,
  {
    homeDir = os.homedir(),
    tmpDir = os.tmpdir(),
    extraAllowedRoots = [],
    requireOwnedSegment = false,
    lstatSyncFn = fs.lstatSync,
  } = {}
) {
  if (typeof candidatePath !== 'string') {
    return { ok: false, error: 'invalid_addons_dir' };
  }
  const trimmed = candidatePath.trim();
  if (!trimmed || trimmed.includes('\0')) {
    return { ok: false, error: 'invalid_addons_dir' };
  }
  const resolved = normalizeMacosPrefix(trimmed);
  if (hasRedlineSegment(resolved)) {
    return { ok: false, error: 'redline_addons_dir' };
  }
  if (isProtectedRootSelf(resolved, homeDir)) {
    return { ok: false, error: 'protected_addons_dir' };
  }

  const allowedRoots = expandAllowedRoots({ homeDir, tmpDir, extraAllowedRoots });
  const matchedRoot = allowedRoots.find((root) => isWithinDir(resolved, root, false));
  if (!matchedRoot) {
    return { ok: false, error: 'untrusted_addons_dir' };
  }

  if (requireOwnedSegment) {
    const segs = resolved
      .split(/[\\/]+/)
      .filter(Boolean)
      .map((s) => s.toLowerCase());
    if (!segs.includes('addons') && !segs.includes('obsidian-prism')) {
      return { ok: false, error: 'unowned_addons_dir' };
    }
  }

  if (hasSymlinkInChain(resolved, matchedRoot, lstatSyncFn)) {
    return { ok: false, error: 'refused_symlink_addons_dir' };
  }

  return { ok: true, dir: resolved, stopRoot: matchedRoot };
}

/**
 * Resolve a safe addons directory; returns null for invalid override paths.
 */
export function resolveSafeAddonsDir({
  addonsDir = null,
  env = process.env,
  homeDir = os.homedir(),
  tmpDir = os.tmpdir(),
  extraAllowedRoots = [],
  lstatSyncFn = fs.lstatSync,
} = {}) {
  if (addonsDir !== null && addonsDir !== undefined) {
    const res = validateAddonsDir(addonsDir, {
      homeDir,
      tmpDir,
      extraAllowedRoots,
      requireOwnedSegment: false,
      lstatSyncFn,
    });
    return res.ok ? res.dir : null;
  }
  const rawEnv = typeof env?.[ADDONS_DIR_ENV_VAR] === 'string' ? env[ADDONS_DIR_ENV_VAR].trim() : '';
  if (rawEnv) {
    const res = validateAddonsDir(rawEnv, {
      homeDir,
      tmpDir,
      extraAllowedRoots,
      requireOwnedSegment: true,
      lstatSyncFn,
    });
    return res.ok ? res.dir : null;
  }
  const def = getDefaultAddonsDir(homeDir);
  const res = validateAddonsDir(def, {
    homeDir,
    tmpDir,
    extraAllowedRoots,
    requireOwnedSegment: false,
    lstatSyncFn,
  });
  return res.ok ? res.dir : null;
}

/**
 * Strictly validate that a download URL meets allowlist security requirements:
 * - Only https: is allowed; any port (including explicit :443) and userInfo are forbidden
 * - Host is strictly limited to the 6 domains in TRUSTED_ADDON_HOSTS
 * - github.com / raw.githubusercontent.com paths must start with /RMvdesi/obsidian-prism/
 * - api.github.com paths must start with /repos/RMvdesi/obsidian-prism/
 * - Rejects path traversal (.. / \ / %2e / %5c / %00)
 */
export function isTrustedAddonUrl(rawUrl) {
  if (typeof rawUrl !== 'string') return false;
  const trimmed = rawUrl.trim();
  if (!trimmed || trimmed.length > 4096) return false;
  if (/[\x00-\x1f\x7f\s\\]/.test(trimmed)) return false;
  if (EXPLICIT_PORT_RE.test(trimmed)) return false;

  let u;
  try {
    u = new URL(trimmed);
  } catch {
    return false;
  }
  if (u.protocol !== 'https:') return false;
  if (u.username || u.password) return false;
  if (u.port) return false;

  const host = u.hostname.toLowerCase();
  if (!TRUSTED_HOST_SET.has(host)) return false;

  // Extract raw path portion to block encoded traversal or pre-normalization .. segments
  const schemeEnd = trimmed.indexOf('://') + 3;
  const pathStart = trimmed.indexOf('/', schemeEnd);
  if (pathStart < 0) return false;
  const rawPathAndRest = trimmed.slice(pathStart);
  const rawPathOnly = rawPathAndRest.split(/[?#]/)[0];
  if (ENCODED_TRAVERSAL_RE.test(rawPathOnly)) return false;
  if (rawPathOnly.split('/').some((seg) => seg === '..' || seg === '.')) return false;

  const normPathname = u.pathname;
  if (!normPathname || normPathname.includes('\\') || normPathname.includes('\0')) return false;
  if (normPathname.split('/').some((seg) => seg === '..' || seg === '.')) return false;

  const requiredPrefix = REPO_LOCKED_HOST_PREFIXES[host];
  if (requiredPrefix) {
    const lowerPath = normPathname.toLowerCase();
    if (!lowerPath.startsWith(requiredPrefix)) return false;
    if (lowerPath.length <= requiredPrefix.length) return false;
  }
  return true;
}

/**
 * Validate a relative path inside an addon:
 * Rejects .., absolute paths, \0, \, drive letters, NTFS ADS, invalid Windows characters, and reserved device names.
 */
export function validateSafeRelativePath(relPath) {
  if (typeof relPath !== 'string') return { ok: false, error: 'invalid_relative_path' };
  const raw = relPath;
  if (!raw || raw.length > 256) return { ok: false, error: 'invalid_relative_path' };
  if (raw !== raw.trim()) return { ok: false, error: 'invalid_relative_path' };
  if (/[\x00-\x1f\x7f]/.test(raw)) return { ok: false, error: 'invalid_relative_path' };
  if (raw.includes('\\')) return { ok: false, error: 'backslash_not_allowed' };
  if (/^[a-zA-Z]:/.test(raw) || raw.includes(':')) return { ok: false, error: 'drive_or_colon_not_allowed' };
  if (raw.startsWith('/') || raw.endsWith('/')) return { ok: false, error: 'absolute_or_trailing_slash' };
  if (path.isAbsolute(raw) || path.posix.isAbsolute(raw) || path.win32.isAbsolute(raw)) {
    return { ok: false, error: 'absolute_path_not_allowed' };
  }

  const segments = raw.split('/');
  if (segments.length === 0 || segments.length > 16) return { ok: false, error: 'invalid_relative_path' };
  for (const seg of segments) {
    if (!seg || seg === '.' || seg === '..') {
      return { ok: false, error: 'path_traversal_detected' };
    }
    if (WINDOWS_INVALID_SEG_CHARS_RE.test(seg)) {
      return { ok: false, error: 'invalid_path_characters' };
    }
    if (seg.endsWith('.') || seg.endsWith(' ')) {
      return { ok: false, error: 'invalid_trailing_dot_or_space' };
    }
    if (WINDOWS_RESERVED_DEVICE_RE.test(seg)) {
      return { ok: false, error: 'reserved_device_filename' };
    }
    const lower = seg.toLowerCase();
    if (REDLINE_DIR_SET.has(lower) || lower === '.git') {
      return { ok: false, error: 'forbidden_path_segment' };
    }
  }

  const lowerNorm = segments.join('/').toLowerCase();
  if (RESERVED_ADDON_FILE_NAMES.has(lowerNorm)) {
    return { ok: false, error: 'reserved_manifest_filename' };
  }

  return { ok: true, normalized: segments.join('/'), segments };
}

/**
 * Strictly validate manifest.json schema (supports both remote installation and local loading).
 */
export function validateAddonManifest(rawManifest, { manifestUrl = null, requireFileUrls = true } = {}) {
  if (!rawManifest || typeof rawManifest !== 'object' || Array.isArray(rawManifest)) {
    return { ok: false, error: 'invalid_manifest_object' };
  }

  const id = typeof rawManifest.id === 'string' ? rawManifest.id.trim() : '';
  if (!ADDON_ID_RE.test(id)) {
    return { ok: false, error: 'invalid_addon_id' };
  }

  const version = typeof rawManifest.version === 'string' ? rawManifest.version.trim() : '';
  if (!isValidSemver(version)) {
    return { ok: false, error: 'invalid_addon_version' };
  }

  const name = rawManifest.name !== undefined ? String(rawManifest.name).trim() : id;
  if (!name || name.length > 120) {
    return { ok: false, error: 'invalid_addon_name' };
  }

  const description = rawManifest.description !== undefined ? String(rawManifest.description).trim() : '';
  if (description.length > 500) {
    return { ok: false, error: 'invalid_addon_description' };
  }

  if (!Array.isArray(rawManifest.files) || rawManifest.files.length === 0 || rawManifest.files.length > MAX_ADDON_FILES) {
    return { ok: false, error: 'invalid_manifest_files' };
  }

  const seenPaths = new Set();
  const normalizedFiles = [];

  for (const item of rawManifest.files) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      return { ok: false, error: 'invalid_manifest_file_entry' };
    }
    const relCheck = validateSafeRelativePath(item.path);
    if (!relCheck.ok) {
      return { ok: false, error: relCheck.error, file: String(item.path || '') };
    }
    const lowerKey = relCheck.normalized.toLowerCase();
    if (seenPaths.has(lowerKey)) {
      return { ok: false, error: 'duplicate_manifest_file_path', file: relCheck.normalized };
    }
    seenPaths.add(lowerKey);

    const sha256 = typeof item.sha256 === 'string' ? item.sha256.trim().toLowerCase() : '';
    if (!SHA256_HEX_RE.test(sha256)) {
      return { ok: false, error: 'invalid_file_sha256', file: relCheck.normalized };
    }

    let size = null;
    if (item.size !== undefined && item.size !== null) {
      const n = Number(item.size);
      if (!Number.isSafeInteger(n) || n < 0 || n > MAX_ADDON_FILE_BYTES) {
        return { ok: false, error: 'invalid_file_size', file: relCheck.normalized };
      }
      size = n;
    }

    let resolvedUrl = null;
    if (item.url !== undefined && item.url !== null && String(item.url).trim() !== '') {
      const candUrl = String(item.url).trim();
      if (!isTrustedAddonUrl(candUrl)) {
        return { ok: false, error: 'untrusted_addon_url', file: relCheck.normalized };
      }
      resolvedUrl = candUrl;
    } else if (requireFileUrls) {
      if (manifestUrl && isTrustedAddonUrl(manifestUrl)) {
        try {
          const derived = new URL(relCheck.normalized, manifestUrl).toString();
          if (!isTrustedAddonUrl(derived)) {
            return { ok: false, error: 'untrusted_addon_url', file: relCheck.normalized };
          }
          resolvedUrl = derived;
        } catch {
          return { ok: false, error: 'untrusted_addon_url', file: relCheck.normalized };
        }
      } else {
        return { ok: false, error: 'missing_file_url', file: relCheck.normalized };
      }
    }

    normalizedFiles.push({
      path: relCheck.normalized,
      sha256,
      ...(size !== null ? { size } : {}),
      ...(resolvedUrl ? { url: resolvedUrl } : {}),
    });
  }

  let entry = null;
  if (rawManifest.entry !== undefined && rawManifest.entry !== null && String(rawManifest.entry).trim() !== '') {
    const entryCheck = validateSafeRelativePath(String(rawManifest.entry).trim());
    if (!entryCheck.ok) {
      return { ok: false, error: 'invalid_manifest_entry' };
    }
    if (!seenPaths.has(entryCheck.normalized.toLowerCase())) {
      return { ok: false, error: 'manifest_entry_not_in_files' };
    }
    entry = entryCheck.normalized;
  }

  return {
    ok: true,
    manifest: {
      id,
      version,
      name,
      description,
      ...(entry ? { entry } : {}),
      files: normalizedFiles,
    },
  };
}

function getHeaderValue(headers, name) {
  if (!headers) return '';
  if (typeof headers.get === 'function') {
    return String(headers.get(name) || '');
  }
  const lower = name.toLowerCase();
  for (const [k, v] of Object.entries(headers)) {
    if (k.toLowerCase() === lower) return String(v || '');
  }
  return '';
}

async function readResponseBufferWithLimit(res, maxBytes) {
  const clRaw = getHeaderValue(res.headers, 'content-length');
  if (clRaw) {
    const cl = Number(clRaw);
    if (Number.isFinite(cl) && cl > maxBytes) {
      try { await res.body?.cancel?.(); } catch {}
      throw new Error('payload_too_large');
    }
  }
  if (res.body && typeof res.body.getReader === 'function') {
    const reader = res.body.getReader();
    const chunks = [];
    let total = 0;
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const buf = Buffer.from(value);
        total += buf.byteLength;
        if (total > maxBytes) {
          try { await reader.cancel(); } catch {}
          throw new Error('payload_too_large');
        }
        chunks.push(buf);
      }
    } finally {
      try { reader.releaseLock(); } catch {}
    }
    return Buffer.concat(chunks, total);
  }
  if (typeof res.arrayBuffer === 'function') {
    const ab = await res.arrayBuffer();
    const buf = Buffer.from(ab);
    if (buf.byteLength > maxBytes) {
      throw new Error('payload_too_large');
    }
    return buf;
  }
  if (typeof res.text === 'function') {
    const txt = await res.text();
    const buf = Buffer.from(txt, 'utf8');
    if (buf.byteLength > maxBytes) {
      throw new Error('payload_too_large');
    }
    return buf;
  }
  throw new Error('unsupported_response_body');
}

function computeSha256Hex(buf) {
  return crypto.createHash('sha256').update(buf).digest('hex').toLowerCase();
}

export class AddonRegistry {
  constructor({
    rootDir = DEFAULT_ROOT_DIR,
    addonsDir = null,
    homeDir = os.homedir(),
    tmpDir = os.tmpdir(),
    extraAllowedRoots = [],
    env = process.env,
    fetchFn = globalThis.fetch,
    lstatSyncFn = fs.lstatSync,
    realpathSyncFn = fs.realpathSync,
    maxManifestBytes = MAX_MANIFEST_BYTES,
    maxFileBytes = MAX_ADDON_FILE_BYTES,
    maxTotalBytes = MAX_ADDON_TOTAL_BYTES,
    maxRedirects = MAX_REDIRECTS,
    timeoutMs = 20_000,
    bundledAddons = BUNDLED_ADDONS,
  } = {}) {
    this.rootDir = path.resolve(rootDir || DEFAULT_ROOT_DIR);
    this.homeDir = path.resolve(homeDir || os.homedir());
    this.tmpDir = path.resolve(tmpDir || os.tmpdir());
    this.extraAllowedRoots = Array.isArray(extraAllowedRoots) ? extraAllowedRoots : [];
    this.env = env || process.env;
    this.fetchFn = fetchFn;
    this.lstatSyncFn = typeof lstatSyncFn === 'function' ? lstatSyncFn : fs.lstatSync;
    this.realpathSyncFn = typeof realpathSyncFn === 'function' ? realpathSyncFn : fs.realpathSync;
    this.maxManifestBytes = Math.max(1024, Math.min(MAX_MANIFEST_BYTES, Number(maxManifestBytes) || MAX_MANIFEST_BYTES));
    this.maxFileBytes = Math.max(1024, Math.min(MAX_ADDON_FILE_BYTES, Number(maxFileBytes) || MAX_ADDON_FILE_BYTES));
    this.maxTotalBytes = Math.max(this.maxFileBytes, Number(maxTotalBytes) || MAX_ADDON_TOTAL_BYTES);
    this.maxRedirects = Math.max(0, Math.min(MAX_REDIRECTS, Number(maxRedirects ?? MAX_REDIRECTS)));
    this.timeoutMs = Math.max(500, Number(timeoutMs) || 20_000);

    const bundledList = Array.isArray(bundledAddons) ? bundledAddons : BUNDLED_ADDONS;
    this._bundledAddons = bundledList.map((b) => Object.freeze({ ...b, kind: 'bundled', removable: false }));
    this._bundledMap = new Map(this._bundledAddons.map((b) => [b.id, b]));

    this._rejectedEnvAddonsDir = false;
    if (addonsDir !== null && addonsDir !== undefined) {
      const check = validateAddonsDir(addonsDir, {
        homeDir: this.homeDir,
        tmpDir: this.tmpDir,
        extraAllowedRoots: this.extraAllowedRoots,
        requireOwnedSegment: false,
        lstatSyncFn: this.lstatSyncFn,
      });
      if (!check.ok) {
        throw new Error(check.error);
      }
      this.addonsDir = check.dir;
      this._addonsStopRoot = check.stopRoot;
    } else {
      const rawEnv = typeof this.env?.[ADDONS_DIR_ENV_VAR] === 'string' ? this.env[ADDONS_DIR_ENV_VAR].trim() : '';
      let chosen = null;
      if (rawEnv) {
        const envCheck = validateAddonsDir(rawEnv, {
          homeDir: this.homeDir,
          tmpDir: this.tmpDir,
          extraAllowedRoots: this.extraAllowedRoots,
          requireOwnedSegment: true,
          lstatSyncFn: this.lstatSyncFn,
        });
        if (envCheck.ok) {
          chosen = envCheck;
        } else {
          this._rejectedEnvAddonsDir = true;
        }
      }
      if (!chosen) {
        const defDir = getDefaultAddonsDir(this.homeDir);
        const defCheck = validateAddonsDir(defDir, {
          homeDir: this.homeDir,
          tmpDir: this.tmpDir,
          extraAllowedRoots: this.extraAllowedRoots,
          requireOwnedSegment: false,
          lstatSyncFn: this.lstatSyncFn,
        });
        this.addonsDir = defCheck.ok ? defCheck.dir : defDir;
        this._addonsStopRoot = defCheck.ok ? defCheck.stopRoot : path.join(this.homeDir, '.gemini');
      } else {
        this.addonsDir = chosen.dir;
        this._addonsStopRoot = chosen.stopRoot;
      }
    }
  }

  isLabEnabled() {
    return isLabEnabled(this.env);
  }

  _checkBundledAddonLocal(bundled) {
    const relCheck = validateSafeRelativePath(bundled.entry);
    if (!relCheck.ok) {
      return {
        id: bundled.id,
        kind: 'bundled',
        name: bundled.name || bundled.id,
        entry: bundled.entry,
        installed: false,
        available: false,
        removable: false,
        source: 'bundled',
      };
    }
    const entryAbs = path.resolve(this.rootDir, ...relCheck.segments);
    let existsRegular = false;
    try {
      if (isWithinDir(entryAbs, this.rootDir, false) && !hasSymlinkInChain(entryAbs, this.rootDir, this.lstatSyncFn)) {
        const st = this.lstatSyncFn(entryAbs);
        if (st && !st.isSymbolicLink() && st.isFile()) {
          const realRoot = this.realpathSyncFn(this.rootDir);
          const realEntry = this.realpathSyncFn(entryAbs);
          existsRegular = isWithinDir(realEntry, realRoot, false);
        }
      }
    } catch {
      existsRegular = false;
    }
    return {
      id: bundled.id,
      kind: 'bundled',
      name: bundled.name || bundled.id,
      entry: relCheck.normalized,
      installed: existsRegular,
      available: existsRegular,
      removable: false,
      source: 'bundled',
    };
  }

  _assertAddonsDirChainSafe({ createIfMissing = false } = {}) {
    const recheck = validateAddonsDir(this.addonsDir, {
      homeDir: this.homeDir,
      tmpDir: this.tmpDir,
      extraAllowedRoots: this.extraAllowedRoots,
      requireOwnedSegment: false,
      lstatSyncFn: this.lstatSyncFn,
    });
    if (!recheck.ok) {
      throw new Error(recheck.error);
    }
    const stopRoot = recheck.stopRoot;

    if (createIfMissing && !fs.existsSync(this.addonsDir)) {
      fs.mkdirSync(this.addonsDir, { recursive: true, mode: 0o700 });
    }
    if (hasSymlinkInChain(this.addonsDir, stopRoot, this.lstatSyncFn)) {
      throw new Error('refused_symlink_addons_dir');
    }
    if (fs.existsSync(this.addonsDir)) {
      const st = this.lstatSyncFn(this.addonsDir);
      if (!st || st.isSymbolicLink() || !st.isDirectory()) {
        throw new Error('refused_symlink_addons_dir');
      }
      const realStop = this.realpathSyncFn(stopRoot);
      const realAddons = this.realpathSyncFn(this.addonsDir);
      if (!isWithinDir(realAddons, realStop, false)) {
        throw new Error('addons_dir_escaped_root');
      }
      return { realAddonsDir: realAddons, stopRoot };
    }
    return { realAddonsDir: null, stopRoot };
  }

  _readInstalledAddonRecord(addonId, realAddonsDir) {
    if (!ADDON_ID_RE.test(addonId) || this._bundledMap.has(addonId)) return null;
    const addonDir = path.join(this.addonsDir, addonId);
    if (!isWithinDir(addonDir, this.addonsDir, false)) return null;
    let dirStat;
    try {
      dirStat = this.lstatSyncFn(addonDir);
    } catch {
      return null;
    }
    if (!dirStat || dirStat.isSymbolicLink() || !dirStat.isDirectory()) return null;

    let realAddonDir;
    try {
      realAddonDir = this.realpathSyncFn(addonDir);
    } catch {
      return null;
    }
    if (!isWithinDir(realAddonDir, realAddonsDir, false)) return null;

    const manifestPath = path.join(addonDir, 'manifest.json');
    let mStat;
    try {
      mStat = this.lstatSyncFn(manifestPath);
    } catch {
      return null;
    }
    if (!mStat || mStat.isSymbolicLink() || !mStat.isFile() || mStat.size > this.maxManifestBytes) {
      return null;
    }
    try {
      const realManifest = this.realpathSyncFn(manifestPath);
      if (!isWithinDir(realManifest, realAddonDir, false)) return null;
      const raw = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
      const check = validateAddonManifest(raw, { requireFileUrls: false });
      if (!check.ok || check.manifest.id !== addonId) return null;
      return {
        id: check.manifest.id,
        kind: 'addon',
        name: check.manifest.name,
        version: check.manifest.version,
        description: check.manifest.description,
        entry: check.manifest.entry || null,
        filesCount: check.manifest.files.length,
        installed: true,
        available: true,
        removable: true,
        source: 'installed',
        installedAt: typeof raw.installedAt === 'string' ? raw.installedAt : null,
      };
    } catch {
      return null;
    }
  }

  /**
   * List all bundled modules and installed addons (local-only check, strictly 0 network requests).
   */
  listAddons() {
    const addons = this._bundledAddons.map((b) => this._checkBundledAddonLocal(b));
    try {
      const { realAddonsDir } = this._assertAddonsDirChainSafe({ createIfMissing: false });
      if (realAddonsDir) {
        const entries = fs.readdirSync(this.addonsDir, { withFileTypes: true });
        for (const ent of entries) {
          if (!ent || !ent.name || ent.name.startsWith('.')) continue;
          if (typeof ent.isSymbolicLink === 'function' && ent.isSymbolicLink()) continue;
          if (!ADDON_ID_RE.test(ent.name)) continue;
          const rec = this._readInstalledAddonRecord(ent.name, realAddonsDir);
          if (rec) addons.push(rec);
        }
      }
    } catch {}
    return {
      ok: true,
      addonsDir: this.addonsDir,
      addons,
    };
  }

  /**
   * Query status for a single addon (local-only check, strictly 0 network requests).
   */
  getAddonStatus(addonId) {
    const id = typeof addonId === 'string' ? addonId.trim() : '';
    if (!ADDON_ID_RE.test(id)) {
      return { ok: false, error: 'invalid_addon_id' };
    }
    if (this._bundledMap.has(id)) {
      const rec = this._checkBundledAddonLocal(this._bundledMap.get(id));
      return { ok: true, addon: rec };
    }
    try {
      const { realAddonsDir } = this._assertAddonsDirChainSafe({ createIfMissing: false });
      if (realAddonsDir) {
        const rec = this._readInstalledAddonRecord(id, realAddonsDir);
        if (rec) {
          return { ok: true, addon: rec };
        }
      }
    } catch (err) {
      return { ok: false, error: String(err?.message || 'addons_dir_error') };
    }
    return {
      ok: true,
      addon: {
        id,
        kind: 'addon',
        installed: false,
        available: false,
        removable: false,
        source: 'none',
      },
    };
  }

  async _trustedFetch(rawUrl, opts = {}, redirectCount = 0) {
    if (typeof this.fetchFn !== 'function') {
      throw new Error('fetch_unavailable');
    }
    if (!isTrustedAddonUrl(rawUrl)) {
      throw new Error(redirectCount > 0 ? 'untrusted_redirect_url' : 'untrusted_addon_url');
    }
    const signal =
      opts.signal ||
      (typeof AbortSignal?.timeout === 'function' ? AbortSignal.timeout(opts.timeoutMs || this.timeoutMs) : undefined);

    const res = await this.fetchFn(rawUrl, {
      ...opts,
      ...(signal ? { signal } : {}),
      redirect: 'manual',
    });

    const status = Number(res?.status || 0);
    if (status === 301 || status === 302 || status === 303 || status === 307 || status === 308) {
      try { await res.body?.cancel?.(); } catch {}
      if (redirectCount >= this.maxRedirects) {
        throw new Error('too_many_redirects');
      }
      const loc = getHeaderValue(res.headers, 'location').trim();
      if (!loc) {
        throw new Error('redirect_without_location');
      }
      // If Location is an absolute URL with an explicit port, new URL().toString() may strip :443, so block it first
      if (/^https?:\/\//i.test(loc) && EXPLICIT_PORT_RE.test(loc)) {
        throw new Error('untrusted_redirect_url');
      }
      let nextUrl;
      try {
        nextUrl = new URL(loc, rawUrl).toString();
      } catch {
        throw new Error('untrusted_redirect_url');
      }
      if (!isTrustedAddonUrl(nextUrl)) {
        throw new Error('untrusted_redirect_url');
      }
      const nextHeaders = { ...(opts.headers || {}) };
      delete nextHeaders.Authorization;
      delete nextHeaders.authorization;
      delete nextHeaders.Cookie;
      delete nextHeaders.cookie;
      return this._trustedFetch(nextUrl, { ...opts, headers: nextHeaders }, redirectCount + 1);
    }
    return res;
  }

  /**
   * Fetch manifest and files only from allowlisted repositories, verify all SHA-256 hashes in memory,
   * then atomically install into addons/<id>/.
   */
  async install({ manifestUrl, expectedManifestSha256 = null, id: expectedId = null } = {}) {
    if (!isTrustedAddonUrl(manifestUrl)) {
      return { ok: false, error: 'untrusted_addon_url' };
    }
    if (expectedManifestSha256 !== null && expectedManifestSha256 !== undefined) {
      const expHex = String(expectedManifestSha256).trim().toLowerCase();
      if (!SHA256_HEX_RE.test(expHex)) {
        return { ok: false, error: 'invalid_expected_manifest_sha256' };
      }
    }
    if (expectedId !== null && expectedId !== undefined && !ADDON_ID_RE.test(String(expectedId).trim())) {
      return { ok: false, error: 'invalid_addon_id' };
    }

    let manifestBuf;
    try {
      const mRes = await this._trustedFetch(manifestUrl, {
        headers: {
          Accept: 'application/json',
          'User-Agent': 'Obsidian-Prism-AddonRegistry',
        },
      });
      if (!mRes.ok) {
        try { await mRes.body?.cancel?.(); } catch {}
        return { ok: false, error: `manifest_http_${mRes.status}` };
      }
      manifestBuf = await readResponseBufferWithLimit(mRes, this.maxManifestBytes);
    } catch (err) {
      return { ok: false, error: String(err?.message || 'manifest_fetch_failed') };
    }

    const actualManifestSha256 = computeSha256Hex(manifestBuf);
    if (expectedManifestSha256 !== null && expectedManifestSha256 !== undefined) {
      if (actualManifestSha256 !== String(expectedManifestSha256).trim().toLowerCase()) {
        return { ok: false, error: 'manifest_sha256_mismatch' };
      }
    }

    let rawManifest;
    try {
      rawManifest = JSON.parse(manifestBuf.toString('utf8').replace(/^\uFEFF/, ''));
    } catch {
      return { ok: false, error: 'invalid_manifest_json' };
    }

    const schemaCheck = validateAddonManifest(rawManifest, { manifestUrl, requireFileUrls: true });
    if (!schemaCheck.ok) {
      return {
        ok: false,
        error: schemaCheck.error,
        ...(schemaCheck.file ? { file: schemaCheck.file } : {}),
      };
    }

    const manifest = schemaCheck.manifest;
    if (expectedId !== null && expectedId !== undefined && manifest.id !== String(expectedId).trim()) {
      return { ok: false, error: 'manifest_id_mismatch' };
    }
    if (this._bundledMap.has(manifest.id)) {
      return { ok: false, error: 'cannot_override_bundled_addon' };
    }

    // Phase 1: fetch all files into memory and verify each SHA-256; zero disk writes on any failure
    const verifiedBuffers = [];
    let totalBytes = 0;
    for (const fileItem of manifest.files) {
      let fileBuf;
      try {
        const fRes = await this._trustedFetch(fileItem.url, {
          headers: {
            'User-Agent': 'Obsidian-Prism-AddonRegistry',
          },
        });
        if (!fRes.ok) {
          try { await fRes.body?.cancel?.(); } catch {}
          return { ok: false, error: `file_http_${fRes.status}`, file: fileItem.path };
        }
        fileBuf = await readResponseBufferWithLimit(fRes, this.maxFileBytes);
      } catch (err) {
        return { ok: false, error: String(err?.message || 'file_fetch_failed'), file: fileItem.path };
      }

      if (fileItem.size !== undefined && fileBuf.byteLength !== fileItem.size) {
        return { ok: false, error: 'file_size_mismatch', file: fileItem.path };
      }
      totalBytes += fileBuf.byteLength;
      if (totalBytes > this.maxTotalBytes) {
        return { ok: false, error: 'addon_total_size_exceeded', file: fileItem.path };
      }

      const actualSha = computeSha256Hex(fileBuf);
      if (actualSha !== fileItem.sha256) {
        return { ok: false, error: 'sha256_mismatch', file: fileItem.path };
      }
      verifiedBuffers.push({ fileItem, buf: fileBuf });
    }

    // Phase 2: verify target directory chain has no symlinks, write to hidden staging dir, then atomically rename
    let stagingDir = null;
    let backupDir = null;
    let targetDir = null;
    try {
      const { realAddonsDir, stopRoot } = this._assertAddonsDirChainSafe({ createIfMissing: true });
      if (!realAddonsDir) {
        throw new Error('addons_dir_unavailable');
      }

      targetDir = path.join(this.addonsDir, manifest.id);
      if (!isWithinDir(targetDir, this.addonsDir, false)) {
        throw new Error('path_traversal_detected');
      }

      // If target already exists, verify it is not a symlink/junction and its real path stays inside addonsDir
      let targetExists = false;
      try {
        const tStat = this.lstatSyncFn(targetDir);
        if (tStat) {
          if (tStat.isSymbolicLink() || !tStat.isDirectory()) {
            throw new Error('refused_symlink_target');
          }
          const realTarget = this.realpathSyncFn(targetDir);
          if (!isWithinDir(realTarget, realAddonsDir, false)) {
            throw new Error('refused_symlink_target');
          }
          targetExists = true;
        }
      } catch (err) {
        if (!err || err.code !== 'ENOENT') throw err;
      }

      const nonce = crypto.randomBytes(6).toString('hex');
      stagingDir = path.join(this.addonsDir, `.staging-${manifest.id}-${process.pid}-${nonce}`);
      fs.mkdirSync(stagingDir, { mode: 0o700 });

      const stStat = this.lstatSyncFn(stagingDir);
      if (!stStat || stStat.isSymbolicLink() || !stStat.isDirectory()) {
        throw new Error('refused_symlink_staging');
      }
      const realStagingDir = this.realpathSyncFn(stagingDir);
      if (!isWithinDir(realStagingDir, realAddonsDir, false)) {
        throw new Error('refused_symlink_staging');
      }

      for (const { fileItem, buf } of verifiedBuffers) {
        const relCheck = validateSafeRelativePath(fileItem.path);
        if (!relCheck.ok) {
          throw new Error(relCheck.error);
        }
        const destFile = path.resolve(stagingDir, ...relCheck.segments);
        if (!isWithinDir(destFile, stagingDir, false)) {
          throw new Error('path_traversal_detected');
        }
        const destParent = path.dirname(destFile);
        fs.mkdirSync(destParent, { recursive: true, mode: 0o700 });
        if (hasSymlinkInChain(destParent, stagingDir, this.lstatSyncFn)) {
          throw new Error('refused_symlink_staging');
        }
        const realParent = this.realpathSyncFn(destParent);
        if (!isWithinDir(realParent, realStagingDir, true)) {
          throw new Error('path_traversal_detected');
        }
        const fd = fs.openSync(destFile, 'wx', 0o600);
        try {
          fs.writeFileSync(fd, buf);
          try { fs.fsyncSync(fd); } catch {}
        } finally {
          fs.closeSync(fd);
        }
        const fStat = this.lstatSyncFn(destFile);
        if (!fStat || fStat.isSymbolicLink() || !fStat.isFile()) {
          throw new Error('refused_symlink_file');
        }
      }

      const persistedManifest = {
        id: manifest.id,
        version: manifest.version,
        name: manifest.name,
        description: manifest.description,
        ...(manifest.entry ? { entry: manifest.entry } : {}),
        files: manifest.files.map((f) => ({
          path: f.path,
          sha256: f.sha256,
          ...(f.size !== undefined ? { size: f.size } : {}),
        })),
        manifestSha256: actualManifestSha256,
        installedAt: new Date().toISOString(),
      };
      const manifestDest = path.join(stagingDir, 'manifest.json');
      const mFd = fs.openSync(manifestDest, 'wx', 0o600);
      try {
        fs.writeFileSync(mFd, JSON.stringify(persistedManifest, null, 2) + '\n', 'utf8');
        try { fs.fsyncSync(mFd); } catch {}
      } finally {
        fs.closeSync(mFd);
      }

      // Re-verify parent chain and target state before atomic swap
      if (hasSymlinkInChain(this.addonsDir, stopRoot, this.lstatSyncFn)) {
        throw new Error('refused_symlink_addons_dir');
      }
      if (targetExists) {
        const tStatBeforeSwap = this.lstatSyncFn(targetDir);
        if (!tStatBeforeSwap || tStatBeforeSwap.isSymbolicLink() || !tStatBeforeSwap.isDirectory()) {
          throw new Error('refused_symlink_target');
        }
        backupDir = path.join(this.addonsDir, `.backup-${manifest.id}-${process.pid}-${nonce}`);
        fs.renameSync(targetDir, backupDir);
        try {
          fs.renameSync(stagingDir, targetDir);
          stagingDir = null;
        } catch (swapErr) {
          try { fs.renameSync(backupDir, targetDir); } catch {}
          backupDir = null;
          throw swapErr;
        }
        try { fs.rmSync(backupDir, { recursive: true, force: true }); } catch {}
        backupDir = null;
      } else {
        // Ensure targetDir was not concurrently replaced with a symlink
        try {
          const lateStat = this.lstatSyncFn(targetDir);
          if (lateStat && lateStat.isSymbolicLink()) {
            throw new Error('refused_symlink_target');
          }
        } catch (err) {
          if (!err || err.code !== 'ENOENT') throw err;
        }
        fs.renameSync(stagingDir, targetDir);
        stagingDir = null;
      }

      const finalRealTarget = this.realpathSyncFn(targetDir);
      if (!isWithinDir(finalRealTarget, realAddonsDir, false)) {
        throw new Error('refused_symlink_target');
      }

      return {
        ok: true,
        id: manifest.id,
        version: manifest.version,
        name: manifest.name,
        filesCount: manifest.files.length,
        manifestSha256: actualManifestSha256,
        installDir: targetDir,
      };
    } catch (err) {
      return { ok: false, error: String(err?.message || 'addon_install_failed') };
    } finally {
      if (stagingDir) {
        try { fs.rmSync(stagingDir, { recursive: true, force: true }); } catch {}
      }
      if (backupDir) {
        try { fs.rmSync(backupDir, { recursive: true, force: true }); } catch {}
      }
    }
  }

  /**
   * Safely uninstall an external addon (refuses to remove bundled modules or symlink/junction targets).
   */
  remove(addonId) {
    const id = typeof addonId === 'string' ? addonId.trim() : '';
    if (!ADDON_ID_RE.test(id)) {
      return { ok: false, error: 'invalid_addon_id' };
    }
    if (this._bundledMap.has(id)) {
      return { ok: false, error: 'cannot_remove_bundled_addon' };
    }

    try {
      const { realAddonsDir } = this._assertAddonsDirChainSafe({ createIfMissing: false });
      if (!realAddonsDir) {
        return { ok: true, id, removed: false };
      }

      const targetDir = path.join(this.addonsDir, id);
      if (!isWithinDir(targetDir, this.addonsDir, false)) {
        return { ok: false, error: 'path_traversal_detected' };
      }

      let st;
      try {
        st = this.lstatSyncFn(targetDir);
      } catch (err) {
        if (err && err.code === 'ENOENT') {
          return { ok: true, id, removed: false };
        }
        throw err;
      }

      if (st.isSymbolicLink() || !st.isDirectory()) {
        return { ok: false, error: 'refused_symlink_target' };
      }
      const realTarget = this.realpathSyncFn(targetDir);
      if (!isWithinDir(realTarget, realAddonsDir, false)) {
        return { ok: false, error: 'refused_symlink_target' };
      }

      fs.rmSync(targetDir, { recursive: true, force: true });
      return { ok: true, id, removed: true };
    } catch (err) {
      return { ok: false, error: String(err?.message || 'addon_remove_failed') };
    }
  }
}
