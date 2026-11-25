/**
 * Obsidian Prism v1.0.2 Bipolar Workbench Shared Pure State Machine (vendor/sidebar-studio/state-machine.mjs)
 *
 * Architectural constraints:
 * - Zero DOM, zero Node I/O, zero clock, zero randomness: consumed directly by Node and browser native ESM as 100% deterministic pure functions.
 * - Single source of truth: renderer client, sidebar-service.mjs, and Workbench `/studio` preview share the same exports and contracts.
 * - Project-level permission isolation adapter is strictly limited to the 4 project-level setters on `projectSettingsProvider`, never touching global Code permissions.
 */

export const SCHEMA_VERSION = 2;

export const MODES = Object.freeze(['code', 'chat']);
export const CHAT_KINDS = Object.freeze(['knowledge', 'spark']);

export const ERROR_CODES = Object.freeze({
  INVALID_ARGUMENT: 'INVALID_ARGUMENT',
  STALE_STATE: 'STALE_STATE',
  STALE_NAVIGATION: 'STALE_NAVIGATION',
  STALE_DRAFT: 'STALE_DRAFT',
  NOT_FOUND: 'NOT_FOUND',
  BADGE_STALE: 'BADGE_STALE',
  BUSY: 'BUSY',
  LIMIT_EXCEEDED: 'LIMIT_EXCEEDED',
  PROJECT_SCOPE_CONFLICT: 'PROJECT_SCOPE_CONFLICT',
  CAPABILITY_UNAVAILABLE: 'CAPABILITY_UNAVAILABLE',
  NEEDS_RECONCILIATION: 'NEEDS_RECONCILIATION',
  PERSISTENCE_FAILED: 'PERSISTENCE_FAILED',
  IDEMPOTENCY_CONFLICT: 'IDEMPOTENCY_CONFLICT',
  UNSUPPORTED_SCHEMA: 'UNSUPPORTED_SCHEMA',
  MIGRATION_FAILED: 'MIGRATION_FAILED',
});

export const LIMITS = Object.freeze({
  MAX_FOLDERS: 64,
  MAX_SPARK_PROJECTS: 64,
  MAX_ASSIGNMENTS: 2000,
  MAX_OPERATIONS: 128,
  MAX_PROJECT_SCOPES: 128,
  MAX_RECEIPTS: 256,
  MAX_NAME_LEN: 80,
  MAX_ID_LEN: 128,
  MAX_SCOPE_REF_LEN: 256,
  MAX_MESSAGE_LEN: 65536,
});

export const PERMISSION_PROFILES = Object.freeze({
  knowledge: Object.freeze({
    kind: 'knowledge',
    autoExecutionPolicy: 'off',
    fileAccessPolicy: 'deny-outside',
    internetPolicy: 'allow',
    sandboxMode: null,
    requireArtifacts: true,
  }),
  spark: Object.freeze({
    kind: 'spark',
    autoExecutionPolicy: 'off',
    fileAccessPolicy: 'ask-outside',
    internetPolicy: null,
    sandboxMode: 'enabled-if-supported',
    requireArtifacts: false,
  }),
});

export const ALLOWED_PALETTES = Object.freeze(['host', 'obsidian', 'warm', 'claude']);
export const ALLOWED_ACCENTS = Object.freeze(['follow', 'cobalt', 'iris', 'amber', 'mono']);
export const ALLOWED_LIGHT_PRESETS = Object.freeze(['crystal', 'alabaster']);

export const DEFAULT_MODE_THEMES = Object.freeze({
  code: Object.freeze({ palette: 'obsidian', accentTone: 'follow', lightPreset: 'crystal' }),
  chat: Object.freeze({ palette: 'warm', accentTone: 'amber', lightPreset: 'crystal' }),
});

export const DEFAULT_CHAT_POLICY = Object.freeze({
  pure: Object.freeze({
    webSearch: true,
    imageAndFiles: true,
    keepUserRules: true,
    zeroTools: false,
    allowedPlugins: Object.freeze([]),
    allowedMcps: Object.freeze([]),
  }),
  spark: Object.freeze({
    fileAccess: true,
    schedule: true,
    webSearch: true,
    imageAndFiles: true,
    keepUserRules: true,
    sandbox: true,
    allowedPlugins: Object.freeze([]),
    allowedMcps: Object.freeze([]),
  }),
  showTelemetryAboveComposer: true,
  showStarterChips: true,
});

/**
 * Bilingual (English / Arabic) greeting pool with username and anonymous fallbacks.
 */
export const GREETING_POOLS = Object.freeze({
  en: Object.freeze({
    withUser: Object.freeze([
      'Hi, {user}!',
      '{user}, you are here!',
      'Ready when you are, {user}.',
      "What's on your mind, {user}?",
    ]),
    anonymous: Object.freeze([
      'You are here!',
      'Ready when you are.',
      "What's on your mind?",
    ]),
  }),
  ar: Object.freeze({
    withUser: Object.freeze([
      'مرحباً، {user}!',
      'أهلاً بعودتك، {user}!',
      'جاهز عندما تكون مستعداً، {user}.',
      'بماذا تفكر اليوم، {user}؟',
    ]),
    anonymous: Object.freeze([
      'أهلاً بك!',
      'جاهز عندما تكون مستعداً.',
      'بماذا تفكر اليوم؟',
    ]),
  }),
});

export function normalizeGreetingLang(rawLang) {
  const s = String(rawLang || 'en').trim().toLowerCase().replace(/_/g, '-');
  if (s === 'ar' || s.startsWith('ar-') || s === 'arabic') return 'ar';
  return 'en';
}

export function formatGreeting(lang = 'en', userName = '', seedIndex = 0) {
  const key = normalizeGreetingLang(lang);
  const pool = GREETING_POOLS[key] || GREETING_POOLS.en;
  const cleanUser = typeof userName === 'string' && !hasControlChars(userName) && !hasLoneSurrogate(userName)
    ? Array.from(userName.trim()).slice(0, 48).join('') : '';
  const list = cleanUser ? pool.withUser : pool.anonymous;
  const idx = Number.isFinite(Number(seedIndex)) ? Math.abs(Math.trunc(Number(seedIndex))) % list.length : 0;
  const tpl = list[idx] || list[0];
  return cleanUser ? tpl.replace(/\{user\}/g, () => cleanUser) : tpl;
}

/**
 * Gemini-style two-tier centered hero greeting pool (row 1: icon + subtle eyebrow; row 2: light-weight main headline).
 * Bilingual English / Arabic with deterministic seed-based selection.
 */
export const HERO_GREETING_POOLS = Object.freeze({
  en: Object.freeze({
    eyebrowWithUser: Object.freeze([
      'Hi, {user}',
      'Hello, {user}',
      'Welcome back, {user}',
    ]),
    eyebrowAnonymous: Object.freeze([
      'Hello',
      'Welcome back',
      'Ready when you are',
    ]),
    headlines: Object.freeze([
      'Where should we start?',
      'What can I help you with today?',
      'What would you like to explore?',
    ]),
  }),
  ar: Object.freeze({
    eyebrowWithUser: Object.freeze([
      'مرحباً، {user}',
      'أهلاً، {user}',
      'أهلاً بعودتك، {user}',
    ]),
    eyebrowAnonymous: Object.freeze([
      'مرحباً',
      'أهلاً بعودتك',
      'جاهز للبدء',
    ]),
    headlines: Object.freeze([
      'من أين نبدأ اليوم؟',
      'كيف يمكنني مساعدتك اليوم؟',
      'ما الذي تود استكشافه؟',
    ]),
  }),
});

export function formatHeroGreeting(lang = 'en', userName = '', seedIndex = 0) {
  const key = normalizeGreetingLang(lang);
  const pool = HERO_GREETING_POOLS[key] || HERO_GREETING_POOLS.en;
  const cleanUser = typeof userName === 'string' && !hasControlChars(userName) && !hasLoneSurrogate(userName)
    ? Array.from(userName.trim()).slice(0, 48).join('') : '';
  const n = Number.isFinite(Number(seedIndex)) ? Math.abs(Math.trunc(Number(seedIndex))) : 0;
  const eyeList = cleanUser ? pool.eyebrowWithUser : pool.eyebrowAnonymous;
  const headList = pool.headlines;
  const eyeTpl = eyeList[n % eyeList.length] || eyeList[0];
  const eyebrow = cleanUser ? eyeTpl.replace(/\{user\}/g, () => cleanUser) : eyeTpl;
  const headline = headList[Math.floor(n / eyeList.length) % headList.length] || headList[0];
  return { eyebrow, headline };
}

const FORBIDDEN_KEYS = new Set([
  '__proto__',
  'constructor',
  'prototype',
  'toString',
  'valueOf',
  'hasOwnProperty',
]);

function isPlainObject(v) {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return false;
  const proto = Object.getPrototypeOf(v);
  return proto === Object.prototype || proto === null;
}

function makeError(code, message, retryable = false) {
  return { code, retryable: Boolean(retryable), message: String(message || code) };
}

function fail(code, message, retryable = false) {
  return { ok: false, error: makeError(code, message, retryable) };
}

function hasControlChars(str) {
  for (let i = 0; i < str.length; i++) {
    const code = str.charCodeAt(i);
    if (code <= 0x1f || code === 0x7f) return true;
  }
  return false;
}

function hasLoneSurrogate(str) {
  for (let i = 0; i < str.length; i++) {
    const code = str.charCodeAt(i);
    if (code >= 0xd800 && code <= 0xdbff) {
      const next = i + 1 < str.length ? str.charCodeAt(i + 1) : 0;
      if (next >= 0xdc00 && next <= 0xdfff) {
        i += 1;
        continue;
      }
      return true;
    }
    if (code >= 0xdc00 && code <= 0xdfff) {
      return true;
    }
  }
  return false;
}

export function isSafeIdentifier(rawId, maxLen = LIMITS.MAX_ID_LEN) {
  if (typeof rawId !== 'string') return false;
  const id = rawId.trim();
  if (!id || id !== rawId || id.length > maxLen) return false;
  if (FORBIDDEN_KEYS.has(id) || Object.hasOwn(Object.prototype, id)) return false;
  if (id === '.' || id === '..') return false;
  if (hasControlChars(id) || hasLoneSurrogate(id)) return false;
  if (id.includes('/') || id.includes('\\') || id.includes('?') || id.includes('#') || id.includes('%')) return false;
  for (let i = 0; i < id.length; i++) {
    const ch = id[i];
    if (ch === ' ' || ch === '\t') return false;
  }
  return true;
}

function sanitizeDisplayName(rawName) {
  if (typeof rawName !== 'string') return null;
  const trimmed = rawName.trim();
  if (!trimmed || trimmed.length > LIMITS.MAX_NAME_LEN) return null;
  if (hasControlChars(trimmed) || hasLoneSurrogate(trimmed)) return null;
  return trimmed;
}

function sanitizeThemeEntry(raw, fallback) {
  const src = isPlainObject(raw) ? raw : {};
  const palette = ALLOWED_PALETTES.includes(src.palette) ? src.palette : fallback.palette;
  const accentTone = ALLOWED_ACCENTS.includes(src.accentTone) ? src.accentTone : fallback.accentTone;
  const lightPreset = ALLOWED_LIGHT_PRESETS.includes(src.lightPreset) ? src.lightPreset : fallback.lightPreset;
  return { palette, accentTone, lightPreset };
}

function sanitizePolicyNameList(raw, fallback = []) {
  const src = Array.isArray(raw) ? raw : Array.isArray(fallback) ? fallback : [];
  const out = [];
  const seen = new Set();
  for (let i = 0; i < src.length && out.length < 64; i++) {
    const item = src[i];
    if (typeof item !== 'string') continue;
    const trimmed = item.trim();
    if (!trimmed || trimmed.length > 128) continue;
    if (hasControlChars(trimmed) || hasLoneSurrogate(trimmed)) continue;
    if (FORBIDDEN_KEYS.has(trimmed)) continue;
    const key = trimmed.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(trimmed);
  }
  return out;
}

function resolveStrictBoolean(rawVal, fallbackVal, defaultVal) {
  if (typeof rawVal === 'boolean') return rawVal;
  if (typeof fallbackVal === 'boolean') return fallbackVal;
  return defaultVal;
}

export function sanitizeChatPolicy(raw, fallback = DEFAULT_CHAT_POLICY) {
  const fb = isPlainObject(fallback) ? fallback : DEFAULT_CHAT_POLICY;
  const fbPure = isPlainObject(fb.pure) ? fb.pure : DEFAULT_CHAT_POLICY.pure;
  const fbSpark = isPlainObject(fb.spark) ? fb.spark : DEFAULT_CHAT_POLICY.spark;
  const src = isPlainObject(raw) ? raw : {};
  const srcPure = isPlainObject(src.pure) ? src.pure : {};
  const srcSpark = isPlainObject(src.spark) ? src.spark : {};
  return {
    pure: {
      webSearch: resolveStrictBoolean(srcPure.webSearch, fbPure.webSearch, DEFAULT_CHAT_POLICY.pure.webSearch),
      imageAndFiles: resolveStrictBoolean(srcPure.imageAndFiles, fbPure.imageAndFiles, DEFAULT_CHAT_POLICY.pure.imageAndFiles),
      keepUserRules: resolveStrictBoolean(srcPure.keepUserRules, fbPure.keepUserRules, DEFAULT_CHAT_POLICY.pure.keepUserRules),
      zeroTools: resolveStrictBoolean(srcPure.zeroTools, fbPure.zeroTools, DEFAULT_CHAT_POLICY.pure.zeroTools),
      allowedPlugins: sanitizePolicyNameList(
        Array.isArray(srcPure.allowedPlugins) ? srcPure.allowedPlugins : fbPure.allowedPlugins
      ),
      allowedMcps: sanitizePolicyNameList(
        Array.isArray(srcPure.allowedMcps) ? srcPure.allowedMcps : fbPure.allowedMcps
      ),
    },
    spark: {
      fileAccess: resolveStrictBoolean(srcSpark.fileAccess, fbSpark.fileAccess, DEFAULT_CHAT_POLICY.spark.fileAccess),
      schedule: resolveStrictBoolean(srcSpark.schedule, fbSpark.schedule, DEFAULT_CHAT_POLICY.spark.schedule),
      webSearch: resolveStrictBoolean(srcSpark.webSearch, fbSpark.webSearch, DEFAULT_CHAT_POLICY.spark.webSearch),
      imageAndFiles: resolveStrictBoolean(srcSpark.imageAndFiles, fbSpark.imageAndFiles, DEFAULT_CHAT_POLICY.spark.imageAndFiles),
      keepUserRules: resolveStrictBoolean(srcSpark.keepUserRules, fbSpark.keepUserRules, DEFAULT_CHAT_POLICY.spark.keepUserRules),
      sandbox: resolveStrictBoolean(srcSpark.sandbox, fbSpark.sandbox, DEFAULT_CHAT_POLICY.spark.sandbox),
      allowedPlugins: sanitizePolicyNameList(
        Array.isArray(srcSpark.allowedPlugins) ? srcSpark.allowedPlugins : fbSpark.allowedPlugins
      ),
      allowedMcps: sanitizePolicyNameList(
        Array.isArray(srcSpark.allowedMcps) ? srcSpark.allowedMcps : fbSpark.allowedMcps
      ),
    },
    showTelemetryAboveComposer: resolveStrictBoolean(
      src.showTelemetryAboveComposer,
      fb.showTelemetryAboveComposer,
      DEFAULT_CHAT_POLICY.showTelemetryAboveComposer
    ),
    showStarterChips: resolveStrictBoolean(
      src.showStarterChips,
      fb.showStarterChips,
      DEFAULT_CHAT_POLICY.showStarterChips
    ),
  };
}

function sanitizePrefsV2(raw, fallbackSparkRoot = '', fallbackKnowledgeRoot = '') {
  const src = isPlainObject(raw) ? raw : {};
  const rawThemes = isPlainObject(src.modeThemes) ? src.modeThemes : {};
  const sparkRoot =
    typeof src.sparkRoot === 'string' && !hasControlChars(src.sparkRoot)
      ? src.sparkRoot.trim()
      : String(fallbackSparkRoot || '');
  const knowledgeRoot =
    typeof src.knowledgeRoot === 'string' && !hasControlChars(src.knowledgeRoot)
      ? src.knowledgeRoot.trim()
      : String(fallbackKnowledgeRoot || '');
  return {
    hostModeSync: typeof src.hostModeSync === 'boolean' ? src.hostModeSync : true,
    keepCustomizationsEntry: typeof src.keepCustomizationsEntry === 'boolean' ? src.keepCustomizationsEntry : true,
    sparkRoot,
    knowledgeRoot,
    modeThemes: {
      code: sanitizeThemeEntry(rawThemes.code, DEFAULT_MODE_THEMES.code),
      chat: sanitizeThemeEntry(rawThemes.chat, DEFAULT_MODE_THEMES.chat),
    },
    chatPolicy: sanitizeChatPolicy(src.chatPolicy, DEFAULT_CHAT_POLICY),
  };
}

export function cloneJsonSafe(value, depth = 0) {
  if (value === null || value === undefined) return null;
  const t = typeof value;
  if (t === 'boolean' || t === 'string') return value;
  if (t === 'number') return Number.isFinite(value) ? value : null;
  if (depth > 12) {
    return Array.isArray(value) ? [] : {};
  }
  if (Array.isArray(value)) {
    return value.map((item) => cloneJsonSafe(item, depth + 1));
  }
  if (isPlainObject(value)) {
    const out = {};
    for (const [k, v] of Object.entries(value)) {
      if (FORBIDDEN_KEYS.has(k)) continue;
      if (v === undefined || typeof v === 'function' || typeof v === 'symbol') continue;
      out[k] = cloneJsonSafe(v, depth + 1);
    }
    return out;
  }
  return null;
}

export function createDefaultChatDraft() {
  return { kind: 'knowledge', folderId: null, sparkProjectId: null };
}

export function createDefaultStateV2(opts = {}) {
  const storeId = isSafeIdentifier(opts.storeId, LIMITS.MAX_ID_LEN) ? opts.storeId : 'studio-default';
  const prefs = sanitizePrefsV2(opts.prefs, opts.sparkRoot || '', opts.knowledgeRoot || '');
  return {
    schemaVersion: SCHEMA_VERSION,
    storeId,
    rev: 0,
    navRev: 0,
    activeMode: 'code',
    modeLastView: { code: '/', chat: '/' },
    chatDraft: createDefaultChatDraft(),
    draftRev: 0,
    assignments: {},
    knowledgeFolders: [],
    sparkProjects: [],
    prefs,
    operations: {},
    projectScopes: {},
    receipts: {},
  };
}

/**
 * Strictly parse view paths: accept only `/` and single-segment canonical `/c/<id>`.
 * ID is decoded once; rejects separators, control characters, reserved keys, and non-canonical/double encoding.
 */
export function parseView(rawPath) {
  if (typeof rawPath !== 'string') {
    return fail(ERROR_CODES.INVALID_ARGUMENT, 'View path must be a string');
  }
  if (rawPath === '/') {
    return { ok: true, view: '/', kind: 'home', cascadeId: null };
  }
  if (!rawPath.startsWith('/c/')) {
    return fail(ERROR_CODES.INVALID_ARGUMENT, 'View must be "/" or "/c/<id>"');
  }
  const rawSeg = rawPath.slice(3);
  if (!rawSeg || rawSeg.includes('/') || rawSeg.includes('?') || rawSeg.includes('#') || rawSeg.includes('\\')) {
    return fail(ERROR_CODES.INVALID_ARGUMENT, 'View must be a single canonical segment "/c/<id>"');
  }
  if (hasControlChars(rawSeg) || hasLoneSurrogate(rawSeg)) {
    return fail(ERROR_CODES.INVALID_ARGUMENT, 'View contains control characters or invalid UTF-16 surrogate');
  }

  let decoded;
  try {
    decoded = decodeURIComponent(rawSeg);
  } catch {
    return fail(ERROR_CODES.INVALID_ARGUMENT, 'Malformed percent-encoding in view');
  }

  if (!isSafeIdentifier(decoded)) {
    return fail(ERROR_CODES.INVALID_ARGUMENT, 'Invalid conversation identifier in view');
  }

  let canonical;
  try {
    canonical = encodeURIComponent(decoded);
  } catch {
    return fail(ERROR_CODES.INVALID_ARGUMENT, 'Malformed UTF-16 sequence in view');
  }

  // Reject non-canonical encoding (e.g. double-encoding ordinary characters or `%` as `%25...`, or encoding `/` as `%2F`)
  if (rawSeg.includes('%')) {
    if (decoded !== rawSeg && rawSeg !== canonical) {
      return fail(ERROR_CODES.INVALID_ARGUMENT, 'Non-canonical percent-encoding in view');
    }
    if (decoded === rawSeg) {
      return fail(ERROR_CODES.INVALID_ARGUMENT, 'Ambiguous percent-encoding in view');
    }
    // Forbid redundant percent-encoding of unreserved ASCII letters/digits/._-~
    if (canonical === decoded) {
      return fail(ERROR_CODES.INVALID_ARGUMENT, 'Unnecessary percent-encoding in view');
    }
  }

  return {
    ok: true,
    view: `/c/${canonical}`,
    kind: 'conversation',
    cascadeId: decoded,
  };
}

function getCatalogHealth(catalog) {
  if (!catalog || typeof catalog !== 'object') return 'loading';
  const h = catalog.health || catalog.catalogHealth;
  if (h === 'ready' || h === 'loading' || h === 'disconnected') return h;
  if (Array.isArray(catalog.items) || Array.isArray(catalog.sessions) || isPlainObject(catalog.byId)) {
    return 'ready';
  }
  return 'loading';
}

function buildCatalogIndex(catalog) {
  const byId = new Map();
  if (!catalog || typeof catalog !== 'object') {
    return { health: 'loading', byId, lastKnownById: new Map() };
  }
  const health = getCatalogHealth(catalog);
  const ingestItem = (targetMap, id, raw) => {
    if (!isSafeIdentifier(id) || !isPlainObject(raw)) return;
    const status =
      raw.status === 'blocked' || raw.status === 'running' || raw.status === 'error' ? raw.status : 'idle';
    const updatedAt = Number.isFinite(Number(raw.updatedAt)) ? Number(raw.updatedAt) : 0;
    const statusStartedAt = Number.isFinite(Number(raw.statusStartedAt))
      ? Number(raw.statusStartedAt)
      : updatedAt;
    const previous = targetMap.get(id);
    if (previous && (previous.updatedAt > updatedAt || (previous.updatedAt === updatedAt && previous.hidden && !raw.hidden))) return;
    targetMap.set(id, {
      cascadeId: id,
      title: typeof raw.title === 'string' ? raw.title : '',
      status,
      statusStartedAt,
      updatedAt,
      workspace: typeof raw.workspace === 'string' ? raw.workspace : '',
      hidden: Boolean(raw.hidden),
      pinned: Boolean(raw.pinned),
      archived: Boolean(raw.archived),
    });
  };

  if (catalog.byId instanceof Map) {
    for (const [k, v] of catalog.byId.entries()) ingestItem(byId, k, v);
  } else if (isPlainObject(catalog.byId)) {
    for (const [k, v] of Object.entries(catalog.byId)) ingestItem(byId, k, v);
  }
  const list = Array.isArray(catalog.items)
    ? catalog.items
    : Array.isArray(catalog.sessions)
    ? catalog.sessions
    : [];
  for (const item of list) {
    if (!isPlainObject(item)) continue;
    const id = item.cascadeId || item.id;
    ingestItem(byId, id, item);
  }

  const lastKnownById = new Map();
  if (catalog.lastKnownById instanceof Map) {
    for (const [k, v] of catalog.lastKnownById.entries()) ingestItem(lastKnownById, k, v);
  } else if (isPlainObject(catalog.lastKnownById)) {
    for (const [k, v] of Object.entries(catalog.lastKnownById)) ingestItem(lastKnownById, k, v);
  }

  return { health, byId, lastKnownById };
}

function getSessionOwnerMode(state, cascadeId) {
  return state && isPlainObject(state.assignments) && Object.prototype.hasOwnProperty.call(state.assignments, cascadeId)
    ? 'chat'
    : 'code';
}

export function isValidChatReservation(state, catalog, operationId, cascadeId) {
  if (!isSafeIdentifier(cascadeId) || Object.hasOwn(state.assignments, cascadeId)) return false;
  if (Object.entries(state.operations).some(([id, op]) => id !== operationId && op.cascadeId === cascadeId)) return false;
  const index = buildCatalogIndex(catalog);
  const row = index.byId.get(cascadeId) ?? index.lastKnownById.get(cascadeId);
  return !row || row.hidden;
}

function isPendingReservedSession(state, cascadeId) {
  if (!state || !isPlainObject(state.operations)) return false;
  for (const op of Object.values(state.operations)) {
    if (!isPlainObject(op)) continue;
    if (
      op.cascadeId === cascadeId &&
      (op.status === 'pending' || op.status === 'awaiting-confirmation' || op.status === 'needs-input')
    ) {
      return true;
    }
  }
  return false;
}

/**
 * Resolve remembered or target view in a given mode:
 * - Invalid view, changed mode ownership, or catalog ready with confirmed deletion -> fallback to `/`
 * - Catalog loading or temporarily disconnected -> keep remembered view pending confirmation
 */
export function resolveView(state, catalog, mode, rawView) {
  if (!MODES.includes(mode)) {
    return { view: '/', cascadeId: null, fallback: true, pendingConfirmation: false, reason: 'invalid-mode' };
  }
  const candidate = rawView !== undefined ? rawView : state?.modeLastView?.[mode] ?? '/';
  const parsed = parseView(candidate);
  if (!parsed.ok) {
    return { view: '/', cascadeId: null, fallback: true, pendingConfirmation: false, reason: 'invalid-view' };
  }
  if (parsed.kind === 'home') {
    return { view: '/', cascadeId: null, fallback: false, pendingConfirmation: false, reason: 'home' };
  }

  const cid = parsed.cascadeId;
  const ownerMode = getSessionOwnerMode(state, cid);
  if (ownerMode !== mode) {
    return { view: '/', cascadeId: null, fallback: true, pendingConfirmation: false, reason: 'mode-mismatch' };
  }

  const idx = buildCatalogIndex(catalog);
  if (idx.health !== 'ready') {
    return {
      view: parsed.view,
      cascadeId: cid,
      fallback: false,
      pendingConfirmation: true,
      reason: 'catalog-not-ready',
    };
  }

  if (idx.byId.get(cid)?.hidden || (!idx.byId.has(cid) && !isPendingReservedSession(state, cid))) {
    return { view: '/', cascadeId: null, fallback: true, pendingConfirmation: false, reason: 'deleted' };
  }

  return { view: parsed.view, cascadeId: cid, fallback: false, pendingConfirmation: false, reason: 'ok' };
}

/**
 * Full-field allowlist, quota, and referential integrity validation.
 */
export function validateState(raw) {
  const diagnostics = [];
  if (!isPlainObject(raw)) {
    return {
      ok: false,
      error: makeError(ERROR_CODES.INVALID_ARGUMENT, 'State root must be a plain object'),
      diagnostics: ['root-not-object'],
    };
  }
  if (typeof raw.schemaVersion !== 'number' || !Number.isInteger(raw.schemaVersion)) {
    return {
      ok: false,
      error: makeError(ERROR_CODES.INVALID_ARGUMENT, 'Missing or invalid schemaVersion'),
      diagnostics: ['invalid-schema-version'],
    };
  }
  if (raw.schemaVersion > SCHEMA_VERSION) {
    return {
      ok: false,
      error: makeError(
        ERROR_CODES.UNSUPPORTED_SCHEMA,
        `Unsupported future schemaVersion ${raw.schemaVersion}`
      ),
      diagnostics: [`future-schema-${raw.schemaVersion}`],
    };
  }
  if (raw.schemaVersion !== SCHEMA_VERSION) {
    return {
      ok: false,
      error: makeError(ERROR_CODES.INVALID_ARGUMENT, `Expected schemaVersion ${SCHEMA_VERSION}`),
      diagnostics: [`unexpected-schema-${raw.schemaVersion}`],
    };
  }

  if (!isSafeIdentifier(raw.storeId)) {
    diagnostics.push('invalid-store-id');
  }
  for (const revKey of ['rev', 'navRev', 'draftRev']) {
    const val = raw[revKey];
    if (!Number.isSafeInteger(val) || val < 0) diagnostics.push(`invalid-${revKey}`);
  }
  if (!MODES.includes(raw.activeMode)) {
    diagnostics.push('invalid-active-mode');
  }

  const modeLastView = { code: '/', chat: '/' };
  if (!isPlainObject(raw.modeLastView)) {
    diagnostics.push('invalid-mode-last-view');
  } else {
    for (const m of MODES) {
      const p = parseView(raw.modeLastView[m]);
      if (!p.ok) diagnostics.push(`invalid-modeLastView-${m}`);
      else modeLastView[m] = p.view;
    }
  }

  // Validate knowledgeFolders
  const knowledgeFolders = [];
  const folderIdSet = new Set();
  if (!Array.isArray(raw.knowledgeFolders)) {
    diagnostics.push('invalid-knowledgeFolders');
  } else if (raw.knowledgeFolders.length > LIMITS.MAX_FOLDERS) {
    diagnostics.push('knowledgeFolders-limit-exceeded');
  } else {
    for (const f of raw.knowledgeFolders) {
      if (!isPlainObject(f) || !isSafeIdentifier(f.id) || folderIdSet.has(f.id)) {
        diagnostics.push('invalid-knowledge-folder-entry');
        continue;
      }
      const cleanName = sanitizeDisplayName(f.name);
      if (!cleanName) {
        diagnostics.push(`invalid-folder-name:${f.id}`);
        continue;
      }
      folderIdSet.add(f.id);
      knowledgeFolders.push({ id: f.id, name: cleanName, collapsed: Boolean(f.collapsed) });
    }
  }

  // Validate sparkProjects
  const sparkProjects = [];
  const projectIdSet = new Set();
  if (!Array.isArray(raw.sparkProjects)) {
    diagnostics.push('invalid-sparkProjects');
  } else if (raw.sparkProjects.length > LIMITS.MAX_SPARK_PROJECTS) {
    diagnostics.push('sparkProjects-limit-exceeded');
  } else {
    for (const p of raw.sparkProjects) {
      if (!isPlainObject(p) || !isSafeIdentifier(p.id) || projectIdSet.has(p.id)) {
        diagnostics.push('invalid-spark-project-entry');
        continue;
      }
      const cleanName = sanitizeDisplayName(p.name);
      const scopeRef = typeof p.scopeRef === 'string' ? p.scopeRef.trim() : '';
      if (!cleanName || !isSafeIdentifier(scopeRef, LIMITS.MAX_SCOPE_REF_LEN)) {
        diagnostics.push(`invalid-spark-project-fields:${p.id}`);
        continue;
      }
      projectIdSet.add(p.id);
      sparkProjects.push({
        id: p.id,
        name: cleanName,
        scopeRef,
        collapsed: Boolean(p.collapsed),
      });
    }
  }

  // Validate chatDraft referential integrity
  let chatDraft = createDefaultChatDraft();
  if (!isPlainObject(raw.chatDraft) || !CHAT_KINDS.includes(raw.chatDraft.kind)) {
    diagnostics.push('invalid-chatDraft');
  } else if (raw.chatDraft.kind === 'knowledge') {
    if (raw.chatDraft.sparkProjectId !== null && raw.chatDraft.sparkProjectId !== undefined) {
      diagnostics.push('knowledge-draft-has-sparkProjectId');
    }
    const fid = raw.chatDraft.folderId ?? null;
    if (fid !== null && (!isSafeIdentifier(fid) || !folderIdSet.has(fid))) {
      diagnostics.push('knowledge-draft-dangling-folderId');
    } else {
      chatDraft = { kind: 'knowledge', folderId: fid, sparkProjectId: null };
    }
  } else {
    if (raw.chatDraft.folderId !== null && raw.chatDraft.folderId !== undefined) {
      diagnostics.push('spark-draft-has-folderId');
    }
    const pid = raw.chatDraft.sparkProjectId ?? null;
    if (pid !== null && (!isSafeIdentifier(pid) || !projectIdSet.has(pid))) {
      diagnostics.push('spark-draft-dangling-projectId');
    } else {
      chatDraft = { kind: 'spark', folderId: null, sparkProjectId: pid };
    }
  }

  // Validate sparse assignments referential integrity
  const assignments = {};
  if (!isPlainObject(raw.assignments)) {
    diagnostics.push('invalid-assignments');
  } else {
    const entries = Object.entries(raw.assignments);
    if (entries.length > LIMITS.MAX_ASSIGNMENTS) {
      diagnostics.push('assignments-limit-exceeded');
    } else {
      for (const [cid, entry] of entries) {
        if (!isSafeIdentifier(cid) || !isPlainObject(entry) || entry.mode !== 'chat') {
          diagnostics.push(`invalid-assignment:${cid}`);
          continue;
        }
        const continuation = entry.continuation === 'needs-rebind' ? 'needs-rebind' : entry.continuation === 'ready' ? 'ready' : null;
        if (!continuation || !isPlainObject(entry.placement)) {
          diagnostics.push(`invalid-assignment-meta:${cid}`);
          continue;
        }
        const pl = entry.placement;
        const extraMeta = {};
        if (entry.pinned === true) extraMeta.pinned = true;
        if (entry.archived === true) extraMeta.archived = true;
        if (typeof entry.titleOverride === 'string' && entry.titleOverride.trim() && !hasControlChars(entry.titleOverride)) {
          extraMeta.titleOverride = entry.titleOverride.trim().slice(0, 120);
        }
        if (pl.kind === 'knowledge') {
          const fid = pl.folderId ?? null;
          if (fid !== null && (!isSafeIdentifier(fid) || !folderIdSet.has(fid))) {
            diagnostics.push(`dangling-assignment-folder:${cid}`);
            continue;
          }
          assignments[cid] = {
            mode: 'chat',
            placement: { kind: 'knowledge', folderId: fid },
            continuation,
            ...extraMeta,
          };
        } else if (pl.kind === 'spark') {
          const pid = pl.sparkProjectId;
          if (!isSafeIdentifier(pid) || !projectIdSet.has(pid)) {
            diagnostics.push(`dangling-assignment-project:${cid}`);
            continue;
          }
          assignments[cid] = {
            mode: 'chat',
            placement: { kind: 'spark', sparkProjectId: pid },
            continuation,
            ...extraMeta,
          };
        } else {
          diagnostics.push(`invalid-assignment-kind:${cid}`);
        }
      }
    }
  }

  const sanitizeRecordMap = (obj, maxCount, label) => {
    const out = {};
    if (obj === undefined) return out;
    if (!isPlainObject(obj)) {
      diagnostics.push(`invalid-${label}`);
      return out;
    }
    const entries = Object.entries(obj);
    if (entries.length > maxCount) {
      diagnostics.push(`${label}-limit-exceeded`);
      return out;
    }
    for (const [k, v] of entries) {
      if (!isSafeIdentifier(k, LIMITS.MAX_SCOPE_REF_LEN) || !isPlainObject(v)) {
        diagnostics.push(`invalid-${label}-entry:${k}`);
        continue;
      }
      out[k] = cloneJsonSafe(v);
    }
    return out;
  };

  const operations = sanitizeRecordMap(raw.operations, LIMITS.MAX_OPERATIONS, 'operations');
  const projectScopes = sanitizeRecordMap(raw.projectScopes, LIMITS.MAX_PROJECT_SCOPES, 'projectScopes');
  const receipts = sanitizeRecordMap(raw.receipts, LIMITS.MAX_RECEIPTS, 'receipts');

  if (diagnostics.length > 0) {
    const isLimit = diagnostics.some((d) => d.includes('limit-exceeded'));
    return {
      ok: false,
      error: makeError(
        isLimit ? ERROR_CODES.LIMIT_EXCEEDED : ERROR_CODES.INVALID_ARGUMENT,
        `State validation failed: ${diagnostics.slice(0, 4).join(', ')}`
      ),
      diagnostics,
    };
  }

  const normalized = {
    schemaVersion: SCHEMA_VERSION,
    storeId: raw.storeId,
    rev: raw.rev,
    navRev: raw.navRev,
    activeMode: raw.activeMode,
    modeLastView,
    chatDraft,
    draftRev: raw.draftRev,
    assignments,
    knowledgeFolders,
    sparkProjects,
    prefs: sanitizePrefsV2(raw.prefs),
    operations,
    projectScopes,
    receipts,
  };
  if (isPlainObject(raw.legacyV1)) {
    normalized.legacyV1 = cloneJsonSafe(raw.legacyV1);
  }
  return { ok: true, state: normalized, diagnostics: [] };
}

/**
 * Lossless v1 -> v2 pure migration function:
 * - All v1 fields (including old assignments / pinnedIds / savedCodePermissionSnapshot) are archived verbatim to legacyV1;
 * - v2 assignments strictly start from empty `{}` (minimal isolation);
 * - Allowlisted and still-applicable theme, prefs, and sparkRoot map to V2Prefs;
 * - Corrupted structures or unknown future versions return an explicit diagnostic failure.
 */
export function migrateV1(raw, opts = {}) {
  if (!isPlainObject(raw)) {
    return {
      ok: false,
      error: makeError(ERROR_CODES.MIGRATION_FAILED, 'Cannot migrate non-object state payload'),
      diagnostics: ['corrupt-root'],
    };
  }

  const version = raw.schemaVersion ?? raw.version;
  if (raw.schemaVersion !== undefined && raw.version !== undefined && raw.schemaVersion !== raw.version) {
    return { ok: false, error: makeError(ERROR_CODES.MIGRATION_FAILED, 'Conflicting persisted versions'), diagnostics: ['conflicting-version'] };
  }
  if (version === undefined && !['code', 'knowledge', 'spark'].includes(raw.activeSpace)) {
    return { ok: false, error: makeError(ERROR_CODES.MIGRATION_FAILED, 'Unrecognized legacy sidebar state'), diagnostics: ['unknown-legacy-shape'] };
  }
  if (version !== undefined) {
    if (!Number.isInteger(version) || version < 1) {
      return {
        ok: false,
        error: makeError(ERROR_CODES.MIGRATION_FAILED, 'Invalid schemaVersion in persisted state'),
        diagnostics: ['invalid-schema-version'],
      };
    }
    if (version > SCHEMA_VERSION) {
      return {
        ok: false,
        error: makeError(ERROR_CODES.UNSUPPORTED_SCHEMA, 'Persisted state is newer than this service'),
        diagnostics: ['future-schema'],
      };
    }
    if (version === SCHEMA_VERSION) {
      const checked = validateState(raw);
      if (!checked.ok) return checked;
      return { ok: true, migrated: false, state: checked.state };
    }
  }

  const rawPrefs = isPlainObject(raw.prefs) ? raw.prefs : {};
  const rawThemes = isPlainObject(raw.spaceThemes) ? raw.spaceThemes : {};
  const mappedPrefs = sanitizePrefsV2(
    {
      hostModeSync: rawPrefs.hostModeSync,
      keepCustomizationsEntry: rawPrefs.keepCustomizationsEntry,
      sparkRoot: typeof rawPrefs.sparkRoot === 'string' && rawPrefs.sparkRoot.trim()
        ? rawPrefs.sparkRoot.trim()
        : opts.sparkRoot || '',
      knowledgeRoot: opts.knowledgeRoot || '',
      modeThemes: {
        code: sanitizeThemeEntry(rawThemes.code, DEFAULT_MODE_THEMES.code),
        chat: sanitizeThemeEntry(rawThemes.knowledge || rawThemes.spark, DEFAULT_MODE_THEMES.chat),
      },
    },
    opts.sparkRoot || '',
    opts.knowledgeRoot || ''
  );

  const next = createDefaultStateV2({
    storeId: opts.storeId || 'studio-migrated',
    prefs: mappedPrefs,
  });
  // v2 assignments explicitly start empty; full v1 data is losslessly archived (including savedCodePermissionSnapshot)
  next.legacyV1 = cloneJsonSafe(raw);

  const verified = validateState(next);
  if (!verified.ok) {
    return {
      ok: false,
      error: makeError(ERROR_CODES.MIGRATION_FAILED, verified.error.message),
      diagnostics: verified.diagnostics,
    };
  }
  return { ok: true, migrated: true, state: verified.state };
}

function compareSidebarItems(a, b) {
  const pa = a.pinned ? 1 : 0;
  const pb = b.pinned ? 1 : 0;
  if (pa !== pb) return pb - pa;
  if (a.updatedAt !== b.updatedAt) return b.updatedAt - a.updatedAt;
  return a.cascadeId < b.cascadeId ? -1 : a.cascadeId > b.cascadeId ? 1 : 0;
}

/**
 * Project explicit Chat assignments into Knowledge (fixed first group: root + single-level subfolders), Spark (fixed second group: grouped by project), and archived list.
 * When catalog is not ready, retain last-known data and mark loading state.
 */
export function selectChatSidebar(state, catalog = null) {
  const idx = buildCatalogIndex(catalog);
  const catalogReady = idx.health === 'ready';
  const rootItems = [];
  const archivedItems = [];
  const folderBuckets = new Map();
  for (const f of state.knowledgeFolders || []) {
    folderBuckets.set(f.id, []);
  }
  const projectBuckets = new Map();
  for (const p of state.sparkProjects || []) {
    projectBuckets.set(p.id, []);
  }

  for (const [cid, assign] of Object.entries(state.assignments || {})) {
    if (!assign || assign.mode !== 'chat' || !assign.placement) continue;
    const live = idx.byId.get(cid) || null;
    const cached = !catalogReady ? idx.lastKnownById.get(cid) || null : null;
    const pending = isPendingReservedSession(state, cid);
    if (catalogReady && !live && !pending) continue;
    const meta = live || cached;
    if (meta?.hidden) continue;
    const isArchived = Boolean(assign.archived || meta?.archived);
    const isPinned = Boolean(!isArchived && (assign.pinned || meta?.pinned));
    const projected = {
      cascadeId: cid,
      view: `/c/${encodeURIComponent(cid)}`,
      title: assign.titleOverride || (meta ? meta.title : ''),
      status: meta ? meta.status : 'idle',
      statusStartedAt: meta ? meta.statusStartedAt : 0,
      updatedAt: meta ? meta.updatedAt : 0,
      workspace: meta ? meta.workspace : '',
      continuation: assign.continuation || 'ready',
      placement: cloneJsonSafe(assign.placement),
      pinned: isPinned,
      archived: isArchived,
      stale: !live && !pending,
    };

    if (isArchived) {
      archivedItems.push(projected);
      continue;
    }

    if (assign.placement.kind === 'knowledge') {
      const fid = assign.placement.folderId;
      if (fid && folderBuckets.has(fid)) {
        folderBuckets.get(fid).push(projected);
      } else {
        rootItems.push(projected);
      }
    } else if (assign.placement.kind === 'spark') {
      const pid = assign.placement.sparkProjectId;
      if (pid && projectBuckets.has(pid)) {
        projectBuckets.get(pid).push(projected);
      } else {
        rootItems.push(projected);
      }
    }
  }

  rootItems.sort(compareSidebarItems);
  archivedItems.sort(compareSidebarItems);
  const folders = (state.knowledgeFolders || []).map((f) => {
    const items = folderBuckets.get(f.id) || [];
    items.sort(compareSidebarItems);
    return {
      id: f.id,
      name: f.name,
      collapsed: Boolean(f.collapsed),
      items,
    };
  });

  const projects = (state.sparkProjects || []).map((p) => {
    const items = projectBuckets.get(p.id) || [];
    items.sort(compareSidebarItems);
    return {
      id: p.id,
      name: p.name,
      scopeRef: p.scopeRef,
      collapsed: Boolean(p.collapsed),
      items,
    };
  });

  const knowledgeTotal = rootItems.length + folders.reduce((acc, f) => acc + f.items.length, 0);
  const sparkTotal = projects.reduce((acc, p) => acc + p.items.length, 0);

  return {
    loading: !catalogReady,
    catalogHealth: idx.health,
    knowledge: {
      kind: 'knowledge',
      rootItems,
      folders,
      totalCount: knowledgeTotal,
    },
    spark: {
      kind: 'spark',
      projects,
      totalCount: sparkTotal,
    },
    archived: {
      items: archivedItems,
      totalCount: archivedItems.length,
    },
  };
}

function statusPriority(status) {
  if (status === 'blocked') return 0;
  if (status === 'running') return 1;
  return 9;
}

/**
 * Filter blocked and running sessions from the inactive mode to generate a deterministic background task badge:
 * - status uses highest priority (blocked > running)
 * - count is the combined total
 * - primary session is ordered by (status priority -> earliest statusStartedAt -> lexical ID)
 */
export function selectBackgroundBadge(state, catalog = null) {
  const idx = buildCatalogIndex(catalog);
  if (idx.health !== 'ready') return null;

  const targetMode = state.activeMode === 'code' ? 'chat' : 'code';
  const activeTasks = [];
  let blockedCount = 0;
  let runningCount = 0;

  for (const item of idx.byId.values()) {
    if (item.hidden) continue;
    if (item.status !== 'blocked' && item.status !== 'running') continue;
    const owner = getSessionOwnerMode(state, item.cascadeId);
    if (owner !== targetMode) continue;
    if (item.status === 'blocked') blockedCount += 1;
    else runningCount += 1;
    activeTasks.push(item);
  }

  if (activeTasks.length === 0) return null;

  activeTasks.sort((a, b) => {
    const pa = statusPriority(a.status);
    const pb = statusPriority(b.status);
    if (pa !== pb) return pa - pb;
    const ta = a.statusStartedAt > 0 ? a.statusStartedAt : Number.MAX_SAFE_INTEGER;
    const tb = b.statusStartedAt > 0 ? b.statusStartedAt : Number.MAX_SAFE_INTEGER;
    if (ta !== tb) return ta - tb;
    return a.cascadeId < b.cascadeId ? -1 : a.cascadeId > b.cascadeId ? 1 : 0;
  });

  const primary = activeTasks[0];
  return {
    targetMode,
    status: blockedCount > 0 ? 'blocked' : 'running',
    count: blockedCount + runningCount,
    blockedCount,
    runningCount,
    primary: {
      cascadeId: primary.cascadeId,
      view: `/c/${encodeURIComponent(primary.cascadeId)}`,
      title: primary.title,
      status: primary.status,
      statusStartedAt: primary.statusStartedAt,
    },
    items: activeTasks.slice(0, 12).map((t) => ({
      cascadeId: t.cascadeId,
      view: `/c/${encodeURIComponent(t.cascadeId)}`,
      title: t.title,
      status: t.status,
      statusStartedAt: t.statusStartedAt,
    })),
  };
}

/**
 * Unified public state snapshot projection for RPC and Workbench `/studio`:
 * Strictly omits permission baselines, internal paths, confirmation tokens, receipt tables, and legacyV1.
 */
export function selectSnapshot(state, runtime = {}) {
  const catalog = runtime && runtime.catalog ? runtime.catalog : null;
  const idx = buildCatalogIndex(catalog);
  const chatSidebar = selectChatSidebar(state, catalog);
  const backgroundBadge = selectBackgroundBadge(state, catalog);

  const scopes = isPlainObject(state.projectScopes) ? state.projectScopes : {};
  const sparkProjects = (state.sparkProjects || []).map((p) => {
    const sc = isPlainObject(scopes[p.scopeRef]) ? scopes[p.scopeRef] : null;
    return {
      id: p.id,
      name: p.name,
      scopeRef: p.scopeRef,
      collapsed: Boolean(p.collapsed),
      permissionStatus: sc && typeof sc.permissionStatus === 'string' ? sc.permissionStatus : 'pending',
      degraded: Boolean(sc && sc.degraded),
      sharedWithCode: Boolean(sc && sc.sharedWithCode),
      nonDestructive: Boolean(sc && sc.nonDestructive),
    };
  });

  const publicAssignments = {};
  for (const [cid, a] of Object.entries(state.assignments || {})) {
    publicAssignments[cid] = {
      mode: 'chat',
      placement: cloneJsonSafe(a.placement),
      continuation: a.continuation || 'ready',
      ...(a.pinned ? { pinned: true } : {}),
      ...(a.archived ? { archived: true } : {}),
      ...(a.titleOverride ? { titleOverride: a.titleOverride } : {}),
    };
  }

  const pendingOperations = [];
  for (const [opId, op] of Object.entries(state.operations || {})) {
    if (!isPlainObject(op)) continue;
    if (op.status === 'succeeded' || op.status === 'failed') continue;
    pendingOperations.push({
      operationId: opId,
      kind: typeof op.kind === 'string' ? op.kind : 'unknown',
      status: typeof op.status === 'string' ? op.status : 'pending',
      ...(op.sparkProjectId ? { sparkProjectId: op.sparkProjectId } : {}),
      ...(op.cascadeId ? { cascadeId: op.cascadeId } : {}),
    });
  }

  const rawCaps = isPlainObject(runtime && runtime.capabilities) ? runtime.capabilities : {};
  const capabilities = {
    projectPermissions: Boolean(rawCaps.projectPermissions),
    perCascadeIsolation: Boolean(rawCaps.perCascadeIsolation),
    sessionRebind: Boolean(rawCaps.sessionRebind),
    sandboxAvailable: Boolean(rawCaps.sandboxAvailable),
    wslAvailable: Boolean(rawCaps.wslAvailable),
    artifactsAvailable: rawCaps.artifactsAvailable !== false,
  };

  return {
    schemaVersion: state.schemaVersion,
    storeId: state.storeId,
    rev: state.rev,
    navRev: state.navRev,
    draftRev: state.draftRev,
    activeMode: state.activeMode,
    currentView: resolveView(state, catalog, state.activeMode).view,
    modeLastView: {
      code: state.modeLastView.code,
      chat: state.modeLastView.chat,
    },
    chatDraft: { ...state.chatDraft },
    chatAssignedIds: Object.keys(publicAssignments),
    assignments: publicAssignments,
    knowledgeFolders: (state.knowledgeFolders || []).map((f) => ({
      id: f.id,
      name: f.name,
      collapsed: Boolean(f.collapsed),
    })),
    sparkProjects,
    chatSidebar,
    backgroundBadge,
    catalogHealth: idx.health,
    navigationPending: Boolean(runtime && runtime.navigationPending),
    capabilities,
    prefs: {
      hostModeSync: state.prefs?.hostModeSync !== false,
      keepCustomizationsEntry: state.prefs?.keepCustomizationsEntry !== false,
      modeThemes: cloneJsonSafe(state.prefs?.modeThemes || DEFAULT_MODE_THEMES),
      chatPolicy: sanitizeChatPolicy(state.prefs?.chatPolicy, DEFAULT_CHAT_POLICY),
    },
    pendingOperations,
  };
}

function cloneState(state) {
  return {
    schemaVersion: state.schemaVersion,
    storeId: state.storeId,
    rev: state.rev,
    navRev: state.navRev,
    activeMode: state.activeMode,
    modeLastView: { ...state.modeLastView },
    chatDraft: { ...state.chatDraft },
    draftRev: state.draftRev,
    assignments: cloneJsonSafe(state.assignments || {}),
    knowledgeFolders: (state.knowledgeFolders || []).map((f) => ({ ...f })),
    sparkProjects: (state.sparkProjects || []).map((p) => ({ ...p })),
    prefs: sanitizePrefsV2(state.prefs),
    operations: cloneJsonSafe(state.operations || {}),
    projectScopes: cloneJsonSafe(state.projectScopes || {}),
    receipts: cloneJsonSafe(state.receipts || {}),
    ...(isPlainObject(state.legacyV1) ? { legacyV1: cloneJsonSafe(state.legacyV1) } : {}),
  };
}

function hasBlockingOperationForDraft(state, draftRev) {
  for (const op of Object.values(state.operations || {})) {
    if (!isPlainObject(op)) continue;
    if (
      op.kind === 'send-chat-first' &&
      op.draftRev === draftRev &&
      (op.status === 'pending' || op.status === 'awaiting-confirmation' || op.status === 'needs-input')
    ) {
      return true;
    }
  }
  return false;
}

function hasBlockingOperationForProject(state, sparkProjectId) {
  for (const op of Object.values(state.operations || {})) {
    if (!isPlainObject(op)) continue;
    if (
      op.sparkProjectId === sparkProjectId &&
      (op.status === 'pending' || op.status === 'awaiting-confirmation' || op.status === 'needs-input')
    ) {
      return true;
    }
  }
  return false;
}

function hasBlockingOperationForSession(state, cascadeId) {
  for (const op of Object.values(state.operations || {})) {
    if (!isPlainObject(op)) continue;
    if (
      op.cascadeId === cascadeId &&
      (op.status === 'pending' || op.status === 'awaiting-confirmation' || op.status === 'needs-input')
    ) {
      return true;
    }
  }
  return false;
}

function isDraftValidForState(state, draft) {
  if (!isPlainObject(draft) || !CHAT_KINDS.includes(draft.kind)) return false;
  if (draft.kind === 'knowledge') {
    if (draft.sparkProjectId !== null && draft.sparkProjectId !== undefined) return false;
    const fid = draft.folderId ?? null;
    if (fid === null) return true;
    return (state.knowledgeFolders || []).some((f) => f.id === fid);
  }
  if (draft.folderId !== null && draft.folderId !== undefined) return false;
  const pid = draft.sparkProjectId ?? null;
  if (pid === null) return true;
  return (state.sparkProjects || []).some((p) => p.id === pid);
}

function isPlacementValidForState(state, placement) {
  if (!isPlainObject(placement) || !CHAT_KINDS.includes(placement.kind)) return false;
  if (placement.kind === 'knowledge') {
    const fid = placement.folderId ?? null;
    if (fid === null) return true;
    return (state.knowledgeFolders || []).some((f) => f.id === fid);
  }
  const pid = placement.sparkProjectId;
  return Boolean(pid && (state.sparkProjects || []).some((p) => p.id === pid));
}

/**
 * Shared pure state machine reducer:
 * Takes `(state, event, facts)`, never mutates `state` in place, returns `{ ok, nextState, result, intents, error? }`.
 */
export function reduce(state, event, facts = {}) {
  if (!isPlainObject(state) || state.schemaVersion !== SCHEMA_VERSION) {
    return {
      ok: false,
      nextState: state,
      result: null,
      intents: [],
      error: makeError(ERROR_CODES.INVALID_ARGUMENT, 'Reducer requires a valid v2 state'),
    };
  }
  if (!isPlainObject(event) || typeof event.type !== 'string') {
    return {
      ok: false,
      nextState: state,
      result: null,
      intents: [],
      error: makeError(ERROR_CODES.INVALID_ARGUMENT, 'Event must include a string type'),
    };
  }

  const catalog = facts && facts.catalog ? facts.catalog : null;
  const reject = (code, message, retryable = false) => ({
    ok: false,
    nextState: state,
    result: null,
    intents: [],
    error: makeError(code, message, retryable),
  });

  switch (event.type) {
    case 'switch-mode': {
      const to = event.to;
      if (!MODES.includes(to)) {
        return reject(ERROR_CODES.INVALID_ARGUMENT, 'Target mode must be "code" or "chat"');
      }
      if (event.navRev !== undefined && event.navRev !== state.navRev) {
        return reject(ERROR_CODES.STALE_NAVIGATION, 'Stale navRev on switch-mode', true);
      }
      if (to === state.activeMode) {
        return {
          ok: true,
          nextState: state,
          result: { switched: false, mode: to, view: state.modeLastView[to], navRev: state.navRev },
          intents: [],
        };
      }
      const resolved = resolveView(state, catalog, to, state.modeLastView[to]);
      const next = cloneState(state);
      next.activeMode = to;
      next.modeLastView[to] = resolved.view;
      next.navRev = state.navRev + 1;
      next.rev = state.rev + 1;
      return {
        ok: true,
        nextState: next,
        result: {
          switched: true,
          mode: to,
          view: resolved.view,
          fallback: resolved.fallback,
          navRev: next.navRev,
        },
        intents: [{ type: 'host-navigate', mode: to, view: resolved.view, navRev: next.navRev }],
      };
    }

    case 'navigate': {
      const targetMode = event.mode !== undefined ? event.mode : state.activeMode;
      if (!MODES.includes(targetMode)) {
        return reject(ERROR_CODES.INVALID_ARGUMENT, 'Invalid mode on navigate');
      }
      if (event.navRev !== undefined && event.navRev !== state.navRev) {
        return reject(ERROR_CODES.STALE_NAVIGATION, 'Stale navRev on navigate', true);
      }
      if (targetMode !== state.activeMode) {
        return reject(ERROR_CODES.STALE_NAVIGATION, 'Navigate mode does not match activeMode', true);
      }
      const parsed = parseView(event.view);
      if (!parsed.ok) {
        return reject(parsed.error.code, parsed.error.message);
      }
      if (parsed.kind === 'conversation') {
        const owner = getSessionOwnerMode(state, parsed.cascadeId);
        if (owner !== targetMode) {
          return reject(ERROR_CODES.INVALID_ARGUMENT, `Conversation belongs to "${owner}" mode`);
        }
        const idx = buildCatalogIndex(catalog);
        if (idx.byId.get(parsed.cascadeId)?.hidden || (idx.health === 'ready' &&
            !idx.byId.has(parsed.cascadeId) && !isPendingReservedSession(state, parsed.cascadeId))) {
          return reject(ERROR_CODES.NOT_FOUND, 'Conversation not found in host catalog');
        }
      }
      if (state.modeLastView[targetMode] === parsed.view) {
        return {
          ok: true,
          nextState: state,
          result: { navigated: false, mode: targetMode, view: parsed.view, navRev: state.navRev },
          intents: [],
        };
      }
      const next = cloneState(state);
      next.modeLastView[targetMode] = parsed.view;
      next.navRev = state.navRev + 1;
      next.rev = state.rev + 1;
      return {
        ok: true,
        nextState: next,
        result: { navigated: true, mode: targetMode, view: parsed.view, navRev: next.navRev },
        intents: [{ type: 'host-navigate', mode: targetMode, view: parsed.view, navRev: next.navRev }],
      };
    }

    case 'open-background-task': {
      const targetMode = event.targetMode;
      const cid = event.cascadeId;
      if (!MODES.includes(targetMode) || !isSafeIdentifier(cid)) {
        return reject(ERROR_CODES.INVALID_ARGUMENT, 'Invalid targetMode or cascadeId');
      }
      if (event.navRev !== undefined && event.navRev !== state.navRev) {
        return reject(ERROR_CODES.STALE_NAVIGATION, 'Stale navRev on open-background-task', true);
      }
      if (targetMode === state.activeMode) {
        return reject(ERROR_CODES.BADGE_STALE, 'Target mode is already active', true);
      }
      if (getSessionOwnerMode(state, cid) !== targetMode) {
        return reject(ERROR_CODES.BADGE_STALE, 'Target session ownership changed', true);
      }
      const idx = buildCatalogIndex(catalog);
      const taskItem = idx.health === 'ready' ? idx.byId.get(cid) : null;
      if (!taskItem || taskItem.hidden || (taskItem.status !== 'blocked' && taskItem.status !== 'running')) {
        return reject(ERROR_CODES.BADGE_STALE, 'Background task is no longer running or blocked', true);
      }
      const targetView = `/c/${encodeURIComponent(cid)}`;
      const next = cloneState(state);
      next.activeMode = targetMode;
      next.modeLastView[targetMode] = targetView;
      next.navRev = state.navRev + 1;
      next.rev = state.rev + 1;
      return {
        ok: true,
        nextState: next,
        result: {
          mode: targetMode,
          cascadeId: cid,
          view: targetView,
          status: taskItem.status,
          navRev: next.navRev,
        },
        intents: [{ type: 'host-navigate', mode: targetMode, view: targetView, navRev: next.navRev }],
      };
    }

    case 'set-chat-draft': {
      if (event.navRev !== undefined && event.navRev !== state.navRev) {
        return reject(ERROR_CODES.STALE_NAVIGATION, 'Stale navRev on set-chat-draft', true);
      }
      if (state.activeMode !== 'chat' || state.modeLastView.chat !== '/') {
        return reject(ERROR_CODES.STALE_NAVIGATION, 'Draft edits are only allowed on Chat "/" view', true);
      }
      if (event.draftRev !== undefined && event.draftRev !== state.draftRev) {
        return reject(ERROR_CODES.STALE_DRAFT, 'Stale draftRev on set-chat-draft', true);
      }
      if (hasBlockingOperationForDraft(state, state.draftRev)) {
        return reject(ERROR_CODES.BUSY, 'Current chat draft is locked by a pending send operation', true);
      }
      const draft = event.draft;
      if (!isDraftValidForState(state, draft)) {
        return reject(ERROR_CODES.INVALID_ARGUMENT, 'Invalid chatDraft or dangling folder/project reference');
      }
      const normalizedDraft =
        draft.kind === 'knowledge'
          ? { kind: 'knowledge', folderId: draft.folderId ?? null, sparkProjectId: null }
          : { kind: 'spark', folderId: null, sparkProjectId: draft.sparkProjectId ?? null };
      const next = cloneState(state);
      next.chatDraft = normalizedDraft;
      next.draftRev = state.draftRev + 1;
      next.rev = state.rev + 1;
      return {
        ok: true,
        nextState: next,
        result: { chatDraft: { ...next.chatDraft }, draftRev: next.draftRev },
        intents: [],
      };
    }

    case 'create-knowledge-folder': {
      const cleanName = sanitizeDisplayName(event.name);
      if (!cleanName) {
        return reject(ERROR_CODES.INVALID_ARGUMENT, 'Folder name must be a non-empty valid string');
      }
      if ((state.knowledgeFolders || []).length >= LIMITS.MAX_FOLDERS) {
        return reject(ERROR_CODES.LIMIT_EXCEEDED, 'Knowledge folder limit reached');
      }
      const newId = facts && facts.newId;
      if (!isSafeIdentifier(newId)) {
        return reject(ERROR_CODES.INVALID_ARGUMENT, 'Pre-allocated folder newId is required');
      }
      if ((state.knowledgeFolders || []).some((f) => f.id === newId)) {
        return reject(ERROR_CODES.INVALID_ARGUMENT, 'Duplicate folder id');
      }
      const folder = { id: newId, name: cleanName, collapsed: false };
      const next = cloneState(state);
      next.knowledgeFolders.push(folder);
      next.rev = state.rev + 1;
      return {
        ok: true,
        nextState: next,
        result: { folder: { ...folder } },
        intents: [],
      };
    }

    case 'rename-knowledge-folder': {
      const folderId = event.folderId;
      const cleanName = sanitizeDisplayName(event.name);
      if (!isSafeIdentifier(folderId) || !cleanName) {
        return reject(ERROR_CODES.INVALID_ARGUMENT, 'Invalid folderId or name');
      }
      const pos = (state.knowledgeFolders || []).findIndex((f) => f.id === folderId);
      if (pos < 0) {
        return reject(ERROR_CODES.NOT_FOUND, 'Knowledge folder not found');
      }
      const next = cloneState(state);
      next.knowledgeFolders[pos].name = cleanName;
      next.rev = state.rev + 1;
      return {
        ok: true,
        nextState: next,
        result: { folder: { ...next.knowledgeFolders[pos] } },
        intents: [],
      };
    }

    case 'set-knowledge-folder-collapsed': {
      const folderId = event.folderId;
      if (!isSafeIdentifier(folderId) || typeof event.collapsed !== 'boolean') {
        return reject(ERROR_CODES.INVALID_ARGUMENT, 'Invalid folderId or collapsed boolean');
      }
      const pos = (state.knowledgeFolders || []).findIndex((f) => f.id === folderId);
      if (pos < 0) {
        return reject(ERROR_CODES.NOT_FOUND, 'Knowledge folder not found');
      }
      const next = cloneState(state);
      next.knowledgeFolders[pos].collapsed = event.collapsed;
      next.rev = state.rev + 1;
      return {
        ok: true,
        nextState: next,
        result: { folder: { ...next.knowledgeFolders[pos] } },
        intents: [],
      };
    }

    case 'delete-knowledge-folder': {
      const folderId = event.folderId;
      if (!isSafeIdentifier(folderId)) {
        return reject(ERROR_CODES.INVALID_ARGUMENT, 'Invalid folderId');
      }
      const childAction =
        event.childAction === 'archive' || event.childAction === 'delete' ? event.childAction : 'move-to-root';
      const pos = (state.knowledgeFolders || []).findIndex((f) => f.id === folderId);
      if (pos < 0) {
        return reject(ERROR_CODES.NOT_FOUND, 'Knowledge folder not found');
      }

      const idx = buildCatalogIndex(catalog);
      const childIds = [];
      for (const [cid, assign] of Object.entries(state.assignments || {})) {
        if (assign && assign.placement && assign.placement.kind === 'knowledge' && assign.placement.folderId === folderId) {
          childIds.push(cid);
          if (childAction === 'delete') {
            const item = idx.byId.get(cid);
            if (item && (item.status === 'running' || item.status === 'blocked')) {
              return reject(ERROR_CODES.BUSY, `Cannot delete folder while session ${cid} is ${item.status}`, true);
            }
            if (hasBlockingOperationForSession(state, cid)) {
              return reject(ERROR_CODES.BUSY, `Session ${cid} has pending operation`, true);
            }
          }
        }
      }

      const next = cloneState(state);
      next.knowledgeFolders.splice(pos, 1);

      let movedSessions = 0;
      const archivedSessionIds = [];
      const deletedSessionIds = [];
      for (const cid of childIds) {
        const assign = next.assignments[cid];
        if (!assign) continue;
        if (childAction === 'delete') {
          delete next.assignments[cid];
          deletedSessionIds.push(cid);
        } else if (childAction === 'archive') {
          assign.placement = { kind: 'knowledge', folderId: null };
          assign.archived = true;
          delete assign.pinned;
          archivedSessionIds.push(cid);
        } else {
          assign.placement = { kind: 'knowledge', folderId: null };
          movedSessions += 1;
        }
      }

      const affectedSet = new Set([...archivedSessionIds, ...deletedSessionIds]);
      let navigatedFallback = false;
      const parsedChat = parseView(next.modeLastView.chat);
      if (parsedChat.ok && parsedChat.kind === 'conversation' && affectedSet.has(parsedChat.cascadeId)) {
        next.modeLastView.chat = '/';
        if (next.activeMode === 'chat') {
          next.navRev = state.navRev + 1;
          navigatedFallback = true;
        }
      }

      for (const op of Object.values(next.operations)) {
        if (op.kind === 'send-chat-first' && op.status !== 'succeeded' && op.status !== 'failed' &&
            op.placement?.kind === 'knowledge' && op.placement.folderId === folderId) {
          op.placement.folderId = null;
        }
      }

      let draftUpdated = false;
      if (next.chatDraft.kind === 'knowledge' && next.chatDraft.folderId === folderId) {
        next.chatDraft = { kind: 'knowledge', folderId: null, sparkProjectId: null };
        next.draftRev = state.draftRev + 1;
        draftUpdated = true;
      }

      next.rev = state.rev + 1;
      return {
        ok: true,
        nextState: next,
        result: {
          deletedFolderId: folderId,
          childAction,
          movedSessions,
          archivedSessionIds,
          deletedSessionIds,
          draftUpdated,
          draftRev: next.draftRev,
          navigatedFallback,
          view: next.activeMode === 'chat' ? next.modeLastView.chat : next.modeLastView.code,
        },
        intents: navigatedFallback ? [{ type: 'host-navigate', mode: 'chat', view: '/', navRev: next.navRev }] : [],
      };
    }

    case 'select-spark-project': {
      if (event.navRev !== undefined && event.navRev !== state.navRev) {
        return reject(ERROR_CODES.STALE_NAVIGATION, 'Stale navRev on select-spark-project', true);
      }
      if (state.activeMode !== 'chat' || state.modeLastView.chat !== '/') {
        return reject(ERROR_CODES.STALE_NAVIGATION, 'Selecting spark project draft requires Chat "/" view', true);
      }
      if (event.draftRev !== undefined && event.draftRev !== state.draftRev) {
        return reject(ERROR_CODES.STALE_DRAFT, 'Stale draftRev on select-spark-project', true);
      }
      if (hasBlockingOperationForDraft(state, state.draftRev)) {
        return reject(ERROR_CODES.BUSY, 'Draft is locked by a pending operation', true);
      }

      const scopeRef = typeof event.scopeRef === 'string' ? event.scopeRef.trim() : '';
      const cleanName = sanitizeDisplayName(event.name);
      if (!isSafeIdentifier(scopeRef, LIMITS.MAX_SCOPE_REF_LEN)) {
        return reject(ERROR_CODES.INVALID_ARGUMENT, 'Invalid scopeRef for spark project');
      }

      const next = cloneState(state);
      let project = next.sparkProjects.find((p) => p.scopeRef === scopeRef);
      let created = false;
      if (!project) {
        if (!cleanName) {
          return reject(ERROR_CODES.INVALID_ARGUMENT, 'Spark project name is required');
        }
        if (next.sparkProjects.length >= LIMITS.MAX_SPARK_PROJECTS) {
          return reject(ERROR_CODES.LIMIT_EXCEEDED, 'Spark project limit reached');
        }
        const newId = event.sparkProjectId || (facts && facts.newId);
        if (!isSafeIdentifier(newId) || next.sparkProjects.some((p) => p.id === newId)) {
          return reject(ERROR_CODES.INVALID_ARGUMENT, 'Valid unique sparkProjectId is required');
        }
        project = { id: newId, name: cleanName, scopeRef, collapsed: false };
        next.sparkProjects.push(project);
        created = true;
      } else if (cleanName && project.name !== cleanName) {
        project.name = cleanName;
      }

      next.chatDraft = { kind: 'spark', folderId: null, sparkProjectId: project.id };
      next.draftRev = state.draftRev + 1;
      next.rev = state.rev + 1;
      return {
        ok: true,
        nextState: next,
        result: { project: { ...project }, created, chatDraft: { ...next.chatDraft }, draftRev: next.draftRev },
        intents: [],
      };
    }

    case 'set-spark-project-collapsed': {
      const pid = event.sparkProjectId;
      if (!isSafeIdentifier(pid) || typeof event.collapsed !== 'boolean') {
        return reject(ERROR_CODES.INVALID_ARGUMENT, 'Invalid sparkProjectId or collapsed boolean');
      }
      const pos = (state.sparkProjects || []).findIndex((p) => p.id === pid);
      if (pos < 0) {
        return reject(ERROR_CODES.NOT_FOUND, 'Spark project not found');
      }
      const next = cloneState(state);
      next.sparkProjects[pos].collapsed = event.collapsed;
      next.rev = state.rev + 1;
      return {
        ok: true,
        nextState: next,
        result: { project: { ...next.sparkProjects[pos] } },
        intents: [],
      };
    }

    case 'rename-spark-project': {
      const pid = event.sparkProjectId;
      const cleanName = sanitizeDisplayName(event.name);
      if (!isSafeIdentifier(pid) || !cleanName) {
        return reject(ERROR_CODES.INVALID_ARGUMENT, 'Invalid sparkProjectId or project name');
      }
      const pos = (state.sparkProjects || []).findIndex((p) => p.id === pid);
      if (pos < 0) {
        return reject(ERROR_CODES.NOT_FOUND, 'Spark project not found');
      }
      const next = cloneState(state);
      next.sparkProjects[pos].name = cleanName;
      next.rev = state.rev + 1;
      return {
        ok: true,
        nextState: next,
        result: { project: { ...next.sparkProjects[pos] } },
        intents: [],
      };
    }

    case 'unlink-spark-project': {
      const pid = event.sparkProjectId;
      if (!isSafeIdentifier(pid)) {
        return reject(ERROR_CODES.INVALID_ARGUMENT, 'Invalid sparkProjectId');
      }
      const childAction =
        event.childAction === 'archive' || event.childAction === 'delete' ? event.childAction : 'unbind';
      const pos = (state.sparkProjects || []).findIndex((p) => p.id === pid);
      if (pos < 0) {
        return reject(ERROR_CODES.NOT_FOUND, 'Spark project not found');
      }
      if (hasBlockingOperationForProject(state, pid)) {
        return reject(ERROR_CODES.BUSY, 'Spark project has pending operations', true);
      }

      const idx = buildCatalogIndex(catalog);
      for (const [cid, assign] of Object.entries(state.assignments || {})) {
        if (assign?.placement?.kind === 'spark' && assign.placement.sparkProjectId === pid) {
          const item = idx.byId.get(cid);
          if (idx.health !== 'ready' || (item?.hidden)) {
            return reject(ERROR_CODES.BUSY, 'Spark session activity cannot be verified', true);
          }
          if (item && (item.status === 'running' || item.status === 'blocked')) {
            return reject(ERROR_CODES.BUSY, `Cannot unlink spark project while session ${cid} is ${item.status}`, true);
          }
          if (hasBlockingOperationForSession(state, cid)) {
            return reject(ERROR_CODES.BUSY, `Session ${cid} has pending operation`, true);
          }
        }
      }

      const next = cloneState(state);
      const removedProject = next.sparkProjects.splice(pos, 1)[0];
      const movedSessionIds = [];
      const archivedSessionIds = [];
      const deletedSessionIds = [];
      for (const [cid, assign] of Object.entries(next.assignments)) {
        if (assign?.placement?.kind === 'spark' && assign.placement.sparkProjectId === pid) {
          if (childAction === 'delete') {
            delete next.assignments[cid];
            deletedSessionIds.push(cid);
          } else if (childAction === 'archive') {
            assign.placement = { kind: 'knowledge', folderId: null };
            assign.continuation = 'needs-rebind';
            assign.archived = true;
            delete assign.pinned;
            archivedSessionIds.push(cid);
          } else {
            assign.placement = { kind: 'knowledge', folderId: null };
            assign.continuation = 'needs-rebind';
            movedSessionIds.push(cid);
          }
        }
      }

      const affectedSet = new Set([...archivedSessionIds, ...deletedSessionIds]);
      let navigatedFallback = false;
      const parsedChat = parseView(next.modeLastView.chat);
      if (parsedChat.ok && parsedChat.kind === 'conversation' && affectedSet.has(parsedChat.cascadeId)) {
        next.modeLastView.chat = '/';
        if (next.activeMode === 'chat') {
          next.navRev = state.navRev + 1;
          navigatedFallback = true;
        }
      }

      let draftReset = false;
      if (next.chatDraft.kind === 'spark' && next.chatDraft.sparkProjectId === pid) {
        next.chatDraft = createDefaultChatDraft();
        next.draftRev = state.draftRev + 1;
        draftReset = true;
      }

      const scopeRec = isPlainObject(state.projectScopes?.[removedProject.scopeRef])
        ? state.projectScopes[removedProject.scopeRef]
        : null;
      const isSharedOrNonDestructive = Boolean(
        scopeRec &&
          (scopeRec.sharedWithCode === true ||
            scopeRec.nonDestructive === true ||
            scopeRec.permissionStatus === 'non-destructive-shared' ||
            scopeRec.permissionStatus === 'per-cascade-isolated')
      );

      next.rev = state.rev + 1;
      return {
        ok: true,
        nextState: next,
        result: {
          unlinkedProjectId: pid,
          scopeRef: removedProject.scopeRef,
          childAction,
          movedSessionIds,
          archivedSessionIds,
          deletedSessionIds,
          draftReset,
          draftRev: next.draftRev,
          navigatedFallback,
          view: next.activeMode === 'chat' ? next.modeLastView.chat : next.modeLastView.code,
          skippedPermissionRestore: isSharedOrNonDestructive,
        },
        intents: isSharedOrNonDestructive
          ? []
          : [{ type: 'restore-project-permissions', scopeRef: removedProject.scopeRef, sparkProjectId: pid }],
      };
    }

    case 'pin-chat-session': {
      const cid = event.cascadeId;
      if (!isSafeIdentifier(cid) || typeof event.pinned !== 'boolean') {
        return reject(ERROR_CODES.INVALID_ARGUMENT, 'Invalid cascadeId or pinned boolean');
      }
      const existing = state.assignments?.[cid];
      if (!existing || existing.mode !== 'chat') {
        return reject(ERROR_CODES.NOT_FOUND, 'Chat session assignment not found');
      }
      const next = cloneState(state);
      if (event.pinned) next.assignments[cid].pinned = true;
      else delete next.assignments[cid].pinned;
      next.rev = state.rev + 1;
      return {
        ok: true,
        nextState: next,
        result: { cascadeId: cid, pinned: Boolean(event.pinned) },
        intents: [],
      };
    }

    case 'rename-chat-session': {
      const cid = event.cascadeId;
      const rawTitle = typeof event.title === 'string' ? event.title.trim() : '';
      if (!isSafeIdentifier(cid) || !rawTitle || rawTitle.length > 120 || hasControlChars(rawTitle)) {
        return reject(ERROR_CODES.INVALID_ARGUMENT, 'Invalid cascadeId or session title');
      }
      const existing = state.assignments?.[cid];
      if (!existing || existing.mode !== 'chat') {
        return reject(ERROR_CODES.NOT_FOUND, 'Chat session assignment not found');
      }
      const next = cloneState(state);
      next.assignments[cid].titleOverride = rawTitle;
      next.rev = state.rev + 1;
      return {
        ok: true,
        nextState: next,
        result: { cascadeId: cid, title: rawTitle },
        intents: [],
      };
    }

    case 'archive-chat-session': {
      const cid = event.cascadeId;
      if (!isSafeIdentifier(cid) || typeof event.archived !== 'boolean') {
        return reject(ERROR_CODES.INVALID_ARGUMENT, 'Invalid cascadeId or archived boolean');
      }
      const existing = state.assignments?.[cid];
      if (!existing || existing.mode !== 'chat') {
        return reject(ERROR_CODES.NOT_FOUND, 'Chat session assignment not found');
      }
      const next = cloneState(state);
      if (event.archived) {
        next.assignments[cid].archived = true;
        delete next.assignments[cid].pinned;
      } else {
        delete next.assignments[cid].archived;
      }
      let navigatedFallback = false;
      if (event.archived) {
        const parsedChat = parseView(next.modeLastView.chat);
        if (parsedChat.ok && parsedChat.kind === 'conversation' && parsedChat.cascadeId === cid) {
          next.modeLastView.chat = '/';
          if (next.activeMode === 'chat') {
            next.navRev = state.navRev + 1;
            navigatedFallback = true;
          }
        }
      }
      next.rev = state.rev + 1;
      return {
        ok: true,
        nextState: next,
        result: {
          cascadeId: cid,
          archived: Boolean(event.archived),
          navigatedFallback,
          view: next.activeMode === 'chat' ? next.modeLastView.chat : next.modeLastView.code,
        },
        intents: navigatedFallback ? [{ type: 'host-navigate', mode: 'chat', view: '/', navRev: next.navRev }] : [],
      };
    }

    case 'delete-chat-session': {
      const cid = event.cascadeId;
      if (!isSafeIdentifier(cid)) {
        return reject(ERROR_CODES.INVALID_ARGUMENT, 'Invalid cascadeId');
      }
      const existing = state.assignments?.[cid];
      if (!existing || existing.mode !== 'chat') {
        return reject(ERROR_CODES.NOT_FOUND, 'Chat session assignment not found');
      }
      if (hasBlockingOperationForSession(state, cid)) {
        return reject(ERROR_CODES.BUSY, 'Session has a pending operation', true);
      }
      const idx = buildCatalogIndex(catalog);
      const item = idx.byId.get(cid);
      if (item && (item.status === 'running' || item.status === 'blocked')) {
        return reject(ERROR_CODES.BUSY, `Cannot delete session while it is ${item.status}`, true);
      }
      const next = cloneState(state);
      delete next.assignments[cid];
      let navigatedFallback = false;
      const parsedChat = parseView(next.modeLastView.chat);
      if (parsedChat.ok && parsedChat.kind === 'conversation' && parsedChat.cascadeId === cid) {
        next.modeLastView.chat = '/';
        if (next.activeMode === 'chat') {
          next.navRev = state.navRev + 1;
          navigatedFallback = true;
        }
      }
      next.rev = state.rev + 1;
      return {
        ok: true,
        nextState: next,
        result: {
          deletedCascadeId: cid,
          navigatedFallback,
          view: next.activeMode === 'chat' ? next.modeLastView.chat : next.modeLastView.code,
        },
        intents: navigatedFallback ? [{ type: 'host-navigate', mode: 'chat', view: '/', navRev: next.navRev }] : [],
      };
    }

    case 'move-chat-session': {
      const cid = event.cascadeId;
      if (!isSafeIdentifier(cid)) {
        return reject(ERROR_CODES.INVALID_ARGUMENT, 'Invalid cascadeId');
      }
      const existing = state.assignments?.[cid];
      if (!existing || existing.mode !== 'chat') {
        return reject(ERROR_CODES.NOT_FOUND, 'Chat session assignment not found');
      }

      let rawPlacement = event.placement;
      if (!rawPlacement) {
        if (event.sparkProjectId !== undefined && event.sparkProjectId !== null) {
          rawPlacement = { kind: 'spark', sparkProjectId: event.sparkProjectId };
        } else if (event.folderId !== undefined) {
          rawPlacement = { kind: 'knowledge', folderId: event.folderId };
        } else {
          rawPlacement = { kind: 'knowledge', folderId: null };
        }
      }
      if (!isPlacementValidForState(state, rawPlacement)) {
        return reject(ERROR_CODES.INVALID_ARGUMENT, 'Invalid target placement for move-chat-session');
      }

      const normPlacement =
        rawPlacement.kind === 'knowledge'
          ? { kind: 'knowledge', folderId: rawPlacement.folderId ?? null }
          : { kind: 'spark', sparkProjectId: rawPlacement.sparkProjectId };

      const prev = existing.placement;
      const samePlacement =
        prev &&
        prev.kind === normPlacement.kind &&
        (normPlacement.kind === 'knowledge'
          ? (prev.folderId ?? null) === normPlacement.folderId
          : prev.sparkProjectId === normPlacement.sparkProjectId);

      if (samePlacement) {
        return {
          ok: true,
          nextState: state,
          result: { cascadeId: cid, moved: false, previousPlacement: cloneJsonSafe(prev), placement: normPlacement },
          intents: [],
        };
      }

      // Moving/dragging subfolders within the same Knowledge space only updates sidebar categorization and does not block running sessions; moving across projects/kinds requires an idle barrier
      const crossProjectMove =
        !prev ||
        prev.kind !== normPlacement.kind ||
        (normPlacement.kind === 'spark' && prev.sparkProjectId !== normPlacement.sparkProjectId);

      if (crossProjectMove) {
        if (hasBlockingOperationForSession(state, cid)) {
          return reject(ERROR_CODES.BUSY, 'Session has a pending operation', true);
        }
        const idx = buildCatalogIndex(catalog);
        const live = idx.health === 'ready' ? idx.byId.get(cid) : null;
        if (!live || live.hidden) return reject(ERROR_CODES.BUSY, 'Session activity cannot be verified', true);
        if (live.status === 'running' || live.status === 'blocked') {
          return reject(ERROR_CODES.BUSY, `Cannot move session across projects while status is ${live.status}`, true);
        }
      }

      const next = cloneState(state);
      next.assignments[cid] = {
        mode: 'chat',
        placement: normPlacement,
        continuation: crossProjectMove ? 'needs-rebind' : existing.continuation || 'ready',
      };
      next.rev = state.rev + 1;
      return {
        ok: true,
        nextState: next,
        result: {
          cascadeId: cid,
          moved: true,
          crossProjectMove,
          previousPlacement: cloneJsonSafe(prev),
          placement: normPlacement,
        },
        intents: [],
      };
    }

    case 'resume-chat-session': {
      const cid = event.cascadeId;
      if (!isSafeIdentifier(cid)) {
        return reject(ERROR_CODES.INVALID_ARGUMENT, 'Invalid cascadeId');
      }
      const assign = Object.hasOwn(state.assignments, cid) ? state.assignments[cid] : null;
      if (assign?.mode !== 'chat') {
        return reject(ERROR_CODES.NOT_FOUND, 'Chat session assignment not found');
      }
      const next = cloneState(state);
      next.assignments[cid].continuation = 'ready';
      next.rev = state.rev + 1;
      return {
        ok: true,
        nextState: next,
        result: { cascadeId: cid, continuation: 'ready', placement: { ...next.assignments[cid].placement } },
        intents: [],
      };
    }

    case 'complete-chat-first': {
      const cid = event.cascadeId;
      if (!isSafeIdentifier(cid)) {
        return reject(ERROR_CODES.INVALID_ARGUMENT, 'Invalid cascadeId on complete-chat-first');
      }
      if (Object.hasOwn(state.assignments, cid) || Object.keys(state.assignments).length >= LIMITS.MAX_ASSIGNMENTS) {
        return reject(ERROR_CODES.NEEDS_RECONCILIATION, 'Cannot commit a duplicate reservation or exceed the assignment limit');
      }
      const placement = event.placement || { kind: 'knowledge', folderId: null };
      if (!isPlacementValidForState(state, placement)) {
        return reject(ERROR_CODES.INVALID_ARGUMENT, 'Invalid placement on complete-chat-first');
      }

      const normPlacement =
        placement.kind === 'knowledge'
          ? { kind: 'knowledge', folderId: placement.folderId ?? null }
          : { kind: 'spark', sparkProjectId: placement.sparkProjectId };

      const next = cloneState(state);
      next.assignments[cid] = {
        mode: 'chat',
        placement: normPlacement,
        continuation: 'ready',
      };

      // Only restore the default Knowledge root draft if draftRev still matches the draft version when initiated
      let draftCleared = false;
      if (event.originDraftRev === state.draftRev) {
        next.chatDraft = createDefaultChatDraft();
        next.draftRev = state.draftRev + 1;
        draftCleared = true;
      }

      // Only navigate to `/c/<newUuid>` if still on the originating Chat `/` visit
      const newView = `/c/${encodeURIComponent(cid)}`;
      let navigated = false;
      const intents = [];
      if (
        state.activeMode === 'chat' &&
        state.modeLastView.chat === '/' &&
        event.originNavRev === state.navRev
      ) {
        next.modeLastView.chat = newView;
        next.navRev = state.navRev + 1;
        navigated = true;
        intents.push({ type: 'host-navigate', mode: 'chat', view: newView, navRev: next.navRev });
      }

      next.rev = state.rev + 1;
      return {
        ok: true,
        nextState: next,
        result: { cascadeId: cid, view: newView, draftCleared, navigated, navRev: next.navRev, draftRev: next.draftRev },
        intents,
      };
    }

    case 'set-prefs': {
      if (!isPlainObject(event.patch)) {
        return reject(ERROR_CODES.INVALID_ARGUMENT, 'Prefs patch must be an object');
      }
      const next = cloneState(state);
      const patch = event.patch;
      const curPolicy = sanitizeChatPolicy(next.prefs?.chatPolicy, DEFAULT_CHAT_POLICY);
      const mergedPolicy = isPlainObject(patch.chatPolicy)
        ? sanitizeChatPolicy(
            {
              pure: isPlainObject(patch.chatPolicy.pure)
                ? { ...curPolicy.pure, ...patch.chatPolicy.pure }
                : curPolicy.pure,
              spark: isPlainObject(patch.chatPolicy.spark)
                ? { ...curPolicy.spark, ...patch.chatPolicy.spark }
                : curPolicy.spark,
              showTelemetryAboveComposer:
                typeof patch.chatPolicy.showTelemetryAboveComposer === 'boolean'
                  ? patch.chatPolicy.showTelemetryAboveComposer
                  : curPolicy.showTelemetryAboveComposer,
              showStarterChips:
                typeof patch.chatPolicy.showStarterChips === 'boolean'
                  ? patch.chatPolicy.showStarterChips
                  : curPolicy.showStarterChips,
            },
            curPolicy
          )
        : curPolicy;
      // Per-mode theme is retained only for migration compatibility; actual theme is managed by host global settings.
      next.prefs = sanitizePrefsV2(
        {
          ...next.prefs,
          ...(typeof patch.hostModeSync === 'boolean' ? { hostModeSync: patch.hostModeSync } : {}),
          ...(typeof patch.keepCustomizationsEntry === 'boolean'
            ? { keepCustomizationsEntry: patch.keepCustomizationsEntry }
            : {}),
          chatPolicy: mergedPolicy,
        },
        next.prefs.sparkRoot,
        next.prefs.knowledgeRoot
      );
      next.rev = state.rev + 1;
      return {
        ok: true,
        nextState: next,
        result: { prefs: {
          hostModeSync: next.prefs.hostModeSync,
          keepCustomizationsEntry: next.prefs.keepCustomizationsEntry,
          modeThemes: cloneJsonSafe(next.prefs.modeThemes),
          chatPolicy: cloneJsonSafe(next.prefs.chatPolicy),
        } },
        intents: [],
      };
    }

    case 'reconcile-catalog': {
      const idx = buildCatalogIndex(event.catalog || catalog);
      if (idx.health !== 'ready') {
        return {
          ok: true,
          nextState: state,
          result: { reconciled: false, catalogHealth: idx.health, removedIds: [] },
          intents: [],
        };
      }
      const next = cloneState(state);
      // Catalog is a visibility mirror, not a session ownership source; missing items do not imply permanent deletion.
      const removedIds = [];
      let changed = false;
      const intents = [];
      for (const m of MODES) {
        const res = resolveView(next, event.catalog || catalog, m, next.modeLastView[m]);
        if (res.fallback && next.modeLastView[m] !== res.view) {
          next.modeLastView[m] = res.view;
          changed = true;
          if (m === next.activeMode) {
            next.navRev = state.navRev + 1;
            intents.push({ type: 'host-navigate', mode: m, view: res.view, navRev: next.navRev });
          }
        }
      }
      if (!changed) {
        return {
          ok: true,
          nextState: state,
          result: { reconciled: true, catalogHealth: 'ready', removedIds: [] },
          intents: [],
        };
      }
      next.rev = state.rev + 1;
      return {
        ok: true,
        nextState: next,
        result: { reconciled: true, catalogHealth: 'ready', removedIds },
        intents,
      };
    }

    default:
      return reject(ERROR_CODES.INVALID_ARGUMENT, `Unsupported state-machine event: ${event.type}`);
  }
}

/**
 * Project-level zero-interference permission adapter (strictly limited to 4 project-level setters; never touches global Code permissions).
 *
 * Allowed write surface:
 * - projectSettingsProvider.setProjectAutoExecutionPolicy(scopeRef, policy)
 * - projectSettingsProvider.setProjectFileAccessPolicy(scopeRef, policy)
 * - projectSettingsProvider.setProjectInternetPolicy(scopeRef, policy)
 * - projectSettingsProvider.setProjectSandboxMode(scopeRef, mode)
 */
const PROJECT_PERMISSION_FIELDS = Object.freeze({
  autoExecutionPolicy: { setter: 'setProjectAutoExecutionPolicy', values: ['unspecified', 'off', 'ask', 'auto', 'eager', 'turbo', 'sandbox'] },
  fileAccessPolicy: { setter: 'setProjectFileAccessPolicy', values: ['unspecified', 'deny', 'ask', 'allow', 'deny-outside', 'ask-outside', 'allow-workspace', 'allow-all'] },
  internetPolicy: { setter: 'setProjectInternetPolicy', values: ['unspecified', 'deny', 'ask', 'allow'] },
  sandboxMode: { setter: 'setProjectSandboxMode', values: ['off', 'enabled', 'disabled'] },
});

const RESERVED_GLOBAL_PERMISSION_SCOPES = new Set(['global', 'default', '*', 'all', 'root', 'user']);

function isValidPermissionScopeRef(scopeRef) {
  if (typeof scopeRef !== 'string') return false;
  const trimmed = scopeRef.trim();
  if (!trimmed || trimmed !== scopeRef || trimmed.length > LIMITS.MAX_SCOPE_REF_LEN) return false;
  if (hasControlChars(trimmed) || hasLoneSurrogate(trimmed)) return false;
  if (FORBIDDEN_KEYS.has(trimmed) || RESERVED_GLOBAL_PERMISSION_SCOPES.has(trimmed.toLowerCase())) return false;
  return true;
}

function isScopeRefBindingConsistent(snapshot, expectedScopeRef) {
  if (!isPlainObject(snapshot) || !Object.hasOwn(snapshot, 'scopeRef')) return true;
  return typeof snapshot.scopeRef === 'string' && snapshot.scopeRef === expectedScopeRef;
}

function hasProjectPermissionValue(snapshot, field) {
  return isPlainObject(snapshot) && Object.hasOwn(snapshot, field) &&
    PROJECT_PERMISSION_FIELDS[field].values.includes(snapshot[field]);
}

export async function applyProjectPermissionIsolation({
  kind,
  scopeRef,
  projectSettingsProvider,
  scopeIsolated = false,
  sharedWithCode = false,
  allowSharedNonDestructive = false,
  sandboxAvailable = false,
  verifyArtifacts = null,
  beforeWrite = null,
  onFieldApplied = null,
  policyValues = null,
} = {}) {
  const profile = kind === 'knowledge' ? PERMISSION_PROFILES.knowledge : kind === 'spark' ? PERMISSION_PROFILES.spark : null;
  if (!profile) {
    return {
      ok: false,
      status: 'failed',
      error: makeError(ERROR_CODES.INVALID_ARGUMENT, 'Permission profile kind must be "knowledge" or "spark"'),
      globalWrites: 0,
      projectWrites: 0,
      baseline: null,
      applied: null,
      steps: [],
    };
  }
  if (!isValidPermissionScopeRef(scopeRef)) {
    return {
      ok: false,
      status: 'failed',
      error: makeError(ERROR_CODES.INVALID_ARGUMENT, 'Valid non-global project scopeRef is required'),
      globalWrites: 0,
      projectWrites: 0,
      baseline: null,
      applied: null,
      steps: [],
    };
  }

  // Pre-validate policyValues structure and enum values before any host writes
  if (policyValues !== null && policyValues !== undefined && !isPlainObject(policyValues)) {
    return {
      ok: false,
      status: 'failed',
      error: makeError(ERROR_CODES.INVALID_ARGUMENT, 'policyValues must be a plain object'),
      globalWrites: 0,
      projectWrites: 0,
      baseline: null,
      applied: null,
      steps: [],
    };
  }
  const overrides = isPlainObject(policyValues) ? policyValues : {};
  for (const key of Object.keys(overrides)) {
    if (!Object.hasOwn(PROJECT_PERMISSION_FIELDS, key)) {
      return {
        ok: false,
        status: 'failed',
        error: makeError(ERROR_CODES.INVALID_ARGUMENT, `Unsupported permission policy field: ${key}`),
        globalWrites: 0,
        projectWrites: 0,
        baseline: null,
        applied: null,
        steps: [],
      };
    }
    const rawVal = overrides[key];
    if (rawVal !== undefined && !PROJECT_PERMISSION_FIELDS[key].values.includes(rawVal)) {
      return {
        ok: false,
        status: 'failed',
        error: makeError(ERROR_CODES.INVALID_ARGUMENT, `Invalid permission policy value for ${key}`),
        globalWrites: 0,
        projectWrites: 0,
        baseline: null,
        applied: null,
        steps: [],
      };
    }
  }

  // Shared-directory non-destructive compatibility mode: whenever sharedWithCode===true or shared non-destructive mode is active, short-circuit with 0 writes (even if host misreports scopeIsolated=true)
  if (sharedWithCode === true || (scopeIsolated === false && allowSharedNonDestructive === true)) {
    return {
      ok: true,
      status: 'non-destructive-shared',
      kind: profile.kind,
      scopeRef,
      sharedWithCode: true,
      nonDestructive: true,
      globalWrites: 0,
      projectWrites: 0,
      baseline: null,
      applied: {},
      degraded: false,
      degradedReason: 'shared-with-code',
      artifactsVerified: null,
      steps: [],
    };
  }

  // Code zero-interference hard gate: if not in shared-directory mode and project scope isolation from Code cannot be proven, reject with 0 writes
  if (scopeIsolated !== true) {
    return {
      ok: false,
      status: 'failed',
      error: makeError(
        ERROR_CODES.PROJECT_SCOPE_CONFLICT,
        'Project scope is not guaranteed isolated from Code sessions; refusing permission write'
      ),
      globalWrites: 0,
      projectWrites: 0,
      baseline: null,
      applied: null,
      steps: [],
    };
  }

  const psp = projectSettingsProvider;
  if (
    !psp ||
    typeof psp.setProjectAutoExecutionPolicy !== 'function' ||
    typeof psp.setProjectFileAccessPolicy !== 'function' ||
    (profile.internetPolicy !== null && typeof psp.setProjectInternetPolicy !== 'function')
  ) {
    return {
      ok: false,
      status: 'failed',
      error: makeError(
        ERROR_CODES.CAPABILITY_UNAVAILABLE,
        'Host projectSettingsProvider required project-level setters are unavailable'
      ),
      globalWrites: 0,
      projectWrites: 0,
      baseline: null,
      applied: null,
      steps: [],
    };
  }

  const autoVal = overrides.autoExecutionPolicy ?? profile.autoExecutionPolicy;
  const fileVal = overrides.fileAccessPolicy ?? profile.fileAccessPolicy;
  const internetVal = profile.internetPolicy !== null ? overrides.internetPolicy ?? profile.internetPolicy : null;
  const sandboxVal = overrides.sandboxMode ?? 'enabled';

  const plannedWrites = [
    ['autoExecutionPolicy', autoVal],
    ['fileAccessPolicy', fileVal],
  ];
  if (internetVal !== null) plannedWrites.push(['internetPolicy', internetVal]);
  const willWriteSandbox =
    profile.sandboxMode === 'enabled-if-supported' &&
    sandboxAvailable &&
    typeof psp.setProjectSandboxMode === 'function';
  if (willWriteSandbox) plannedWrites.push(['sandboxMode', sandboxVal]);

  for (const [field, val] of plannedWrites) {
    if (!PROJECT_PERMISSION_FIELDS[field].values.includes(val)) {
      return {
        ok: false,
        status: 'failed',
        error: makeError(ERROR_CODES.INVALID_ARGUMENT, `Disallowed target policy value for ${field}`),
        globalWrites: 0,
        projectWrites: 0,
        baseline: null,
        applied: null,
        steps: [],
      };
    }
  }

  // 1. Capture and persist the project-level baseline before performing any writes
  let baseline = null;
  try {
    if (typeof psp.getProjectPermissionGrants === 'function') {
      const snap = await psp.getProjectPermissionGrants(scopeRef);
      if (isPlainObject(snap)) baseline = cloneJsonSafe(snap);
    } else if (typeof psp.getProjectSettings === 'function') {
      const snap = await psp.getProjectSettings(scopeRef);
      if (isPlainObject(snap)) baseline = cloneJsonSafe(snap);
    }
  } catch (err) {
    return {
      ok: false,
      status: 'needs-reconciliation',
      globalWrites: 0,
      projectWrites: 0,
      error: makeError(
        ERROR_CODES.NEEDS_RECONCILIATION,
        'Failed to read project permission baseline'
      ),
      baseline: null,
      applied: null,
      steps: [],
    };
  }

  if (!isPlainObject(baseline) || !isScopeRefBindingConsistent(baseline, scopeRef)) {
    return {
      ok: false,
      status: 'needs-reconciliation',
      globalWrites: 0,
      projectWrites: 0,
      error: makeError(ERROR_CODES.NEEDS_RECONCILIATION, 'Project permission baseline is missing or mismatched with scopeRef'),
      baseline: null,
      applied: null,
      steps: [],
    };
  }

  const fields = plannedWrites.map(([field]) => field);
  if (!fields.every((field) => hasProjectPermissionValue(baseline, field))) {
    return {
      ok: false,
      status: 'needs-reconciliation',
      globalWrites: 0,
      projectWrites: 0,
      error: makeError(ERROR_CODES.NEEDS_RECONCILIATION, 'Project permission baseline is incomplete or invalid'),
      baseline: null,
      applied: null,
      steps: [],
    };
  }

  if (typeof beforeWrite === 'function') await beforeWrite(baseline);

  const applied = {};
  const steps = [];
  let degraded = false;
  let degradedReason = null;

  const runSetter = async (setterName, fieldKey, val) => {
    try {
      await psp[setterName](scopeRef, val);
      applied[fieldKey] = val;
      steps.push({ setter: setterName, field: fieldKey, value: val, ok: true });
      if (typeof onFieldApplied === 'function') {
        try {
          await onFieldApplied(fieldKey, val, { ...applied });
        } catch {
          // Persistence tracking callback errors must not mask host writes that have already occurred
        }
      }
      return true;
    } catch (err) {
      steps.push({
        setter: setterName,
        field: fieldKey,
        value: val,
        ok: false,
        error: String(err && err.message ? err.message : err),
      });
      return false;
    }
  };

  const makePartialFailure = (message) => ({
    ok: false,
    status: 'needs-reconciliation',
    globalWrites: 0,
    projectWrites: steps.filter((s) => s.ok && !s.skipped).length,
    error: makeError(ERROR_CODES.NEEDS_RECONCILIATION, message),
    baseline,
    applied: { ...applied },
    steps,
  });

  if (!(await runSetter('setProjectAutoExecutionPolicy', 'autoExecutionPolicy', autoVal))) {
    return makePartialFailure('Failed to apply project autoExecutionPolicy');
  }

  if (!(await runSetter('setProjectFileAccessPolicy', 'fileAccessPolicy', fileVal))) {
    return makePartialFailure('Failed to apply project fileAccessPolicy');
  }

  if (internetVal !== null) {
    if (!(await runSetter('setProjectInternetPolicy', 'internetPolicy', internetVal))) {
      return makePartialFailure('Failed to apply project internetPolicy');
    }
  }

  if (profile.sandboxMode === 'enabled-if-supported') {
    if (willWriteSandbox) {
      if (!(await runSetter('setProjectSandboxMode', 'sandboxMode', sandboxVal))) {
        return makePartialFailure('Failed to apply project sandboxMode');
      }
    } else {
      degraded = true;
      degradedReason = 'sandbox-unavailable';
      steps.push({ setter: 'setProjectSandboxMode', field: 'sandboxMode', value: null, ok: true, skipped: true });
    }
  }

  let artifactsVerified = null;
  if (profile.requireArtifacts && typeof verifyArtifacts === 'function') {
    try {
      artifactsVerified = Boolean(await verifyArtifacts(scopeRef));
    } catch {
      artifactsVerified = false;
    }
  }

  return {
    ok: true,
    status: 'applied',
    kind: profile.kind,
    scopeRef,
    sharedWithCode: false,
    nonDestructive: false,
    globalWrites: 0,
    projectWrites: steps.filter((s) => s.ok && !s.skipped).length,
    baseline,
    applied: { ...applied },
    degraded,
    degradedReason,
    artifactsVerified,
    steps,
  };
}

/**
 * Safely restore the project-level baseline when unbinding a project scope:
 * Only restore baseline if scope is still controlled and current project values match applied values; if modified externally, enter needs-reconciliation.
 * Supports rolling back the applied subset item-by-item after partial write failure to prevent unrecoverable half-written deadlocks.
 */
export async function restoreProjectPermissionBaseline({
  scopeRef,
  projectSettingsProvider,
  baseline = null,
  applied = null,
  scopeControlled = false,
  beforeWrite = null,
} = {}) {
  const rejectRestore = (message) => ({
    ok: false, status: 'needs-reconciliation',
    error: makeError(ERROR_CODES.NEEDS_RECONCILIATION, message), steps: [],
  });
  const psp = projectSettingsProvider;
  if (!isValidPermissionScopeRef(scopeRef)) {
    return rejectRestore('Valid non-global project scopeRef is required for restore');
  }
  if (scopeControlled !== true || !isPlainObject(baseline) || !isPlainObject(applied) || !psp) {
    return rejectRestore('Scope is not controlled or restore evidence is missing');
  }
  if (!isScopeRefBindingConsistent(baseline, scopeRef)) {
    return rejectRestore('Project permission baseline scopeRef does not match target scope');
  }
  const fields = Object.keys(applied);
  // Verify all applied fields and capabilities upfront before restoring; allows rolling back the applied subset after partial writes.
  if (fields.length === 0 ||
      !fields.every((field) => Object.hasOwn(PROJECT_PERMISSION_FIELDS, field) &&
        hasProjectPermissionValue(baseline, field) && hasProjectPermissionValue(applied, field) &&
        typeof psp[PROJECT_PERMISSION_FIELDS[field].setter] === 'function')) {
    return rejectRestore('Project permission restore records or setters are incomplete');
  }
  const read = psp.getProjectPermissionGrants ?? psp.getProjectSettings;
  if (typeof read !== 'function') return rejectRestore('Project permission readback is unavailable');
  try {
    const current = await read.call(psp, scopeRef);
    if (!isPlainObject(current) || !isScopeRefBindingConsistent(current, scopeRef)) {
      return rejectRestore('Current project permission snapshot is missing or mismatched with scopeRef');
    }
    if (!fields.every((field) => hasProjectPermissionValue(current, field) && current[field] === applied[field])) {
      return rejectRestore('Current project permission is unknown or differs from the applied record');
    }
  } catch {
    return rejectRestore('Failed to verify current project settings before restore');
  }

  if (typeof beforeWrite === 'function') await beforeWrite();
  const steps = [];
  const restored = {};
  const remainingApplied = { ...applied };
  for (const field of fields) {
    const setterName = PROJECT_PERMISSION_FIELDS[field].setter;
    try {
      await psp[setterName](scopeRef, baseline[field]);
      restored[field] = baseline[field];
      delete remainingApplied[field];
      steps.push({ setter: setterName, field, value: baseline[field], ok: true });
    } catch (err) {
      steps.push({
        setter: setterName,
        field,
        value: baseline[field],
        ok: false,
        error: String(err && err.message ? err.message : err),
      });
      return {
        ok: false,
        status: 'needs-reconciliation',
        error: makeError(ERROR_CODES.NEEDS_RECONCILIATION, `Failed restoring project ${field}`),
        restored,
        remainingApplied,
        steps,
      };
    }
  }

  return { ok: true, status: 'restored', scopeRef, restored, steps };
}
