(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.__agCsI18nCore = factory();
})(typeof globalThis !== 'undefined' ? globalThis : window, function () {
  const LANG_OPTIONS = Object.freeze([
    { id: 'en', label: 'English', htmlLang: 'en', intl: 'en-US', dir: 'ltr' },
    { id: 'ar', label: 'العربية', htmlLang: 'ar', intl: 'ar-EG', dir: 'rtl' },
  ]);

  const SUPPORTED_LANG_IDS = Object.freeze(LANG_OPTIONS.map((opt) => opt.id));
  const RTL_LANG_IDS = new Set(['ar']);
  const LANG_META = Object.fromEntries(LANG_OPTIONS.map((opt) => [opt.id, opt]));

  /**
   * Normalize a language identifier to one of the supported bilingual locales ('en' or 'ar').
   */
  function normalizeLanguage(lang, fallback = 'en') {
    if (lang === true) return 'ar';
    if (lang === false) return 'en';
    const raw = typeof lang === 'string' ? lang.trim().toLowerCase().replace(/_/g, '-') : '';
    if (!raw) return fallback;
    const clean = raw.split(/[.@]/)[0];
    if (!clean) return fallback;
    if (clean === 'ar' || clean.startsWith('ar-') || clean === 'arabic' || clean === 'العربية') return 'ar';
    if (clean === 'en' || clean.startsWith('en-') || clean === 'english') return 'en';
    return fallback;
  }

  function intlLocale(lang) {
    const id = normalizeLanguage(lang);
    return LANG_META[id]?.intl || 'en-US';
  }

  function htmlLangAttr(lang) {
    const id = normalizeLanguage(lang);
    return LANG_META[id]?.htmlLang || 'en';
  }

  function htmlDirAttr(lang) {
    const id = normalizeLanguage(lang);
    return LANG_META[id]?.dir || 'ltr';
  }

  function isRtlLanguage(lang) {
    return RTL_LANG_IDS.has(normalizeLanguage(lang));
  }

  function isCjkLanguage() {
    return false;
  }

  const DURATION_TOKEN = /(\d+)\s*(months?|mo|weeks?|w|days?|d|hours?|h|minutes?|mins?|m|seconds?|secs?|s|years?|y)\b/g;

  function formatDuration(text, units) {
    if (!text || !units) return null;
    DURATION_TOKEN.lastIndex = 0;
    const parts = [...String(text).matchAll(DURATION_TOKEN)];
    if (!parts.length) return null;
    const leftover = String(text)
      .replace(DURATION_TOKEN, '')
      .replace(/,|\band\b/gi, '')
      .trim();
    if (leftover) return null;
    if (parts.length === 1 && parts[0][2] === 'm' && units.singleMin) {
      return parts[0][1] + units.singleMin;
    }
    const sep = typeof units.joiner === 'string' ? units.joiner : '';
    return parts
      .map((p) => {
        const key = p[2].toLowerCase();
        const unit = units[key] || units[key.replace(/s$/, '')] || key;
        return p[1] + unit;
      })
      .join(sep);
  }

  /**
   * Global host DOM dictionary override engine is disabled here to avoid conflicts
   * with the host UI or dedicated on-demand Channel 4 localization (always returns null).
   */
  function createDomTranslator() {
    return null;
  }

  return {
    SUPPORTED_LANG_IDS,
    LANG_OPTIONS,
    normalizeLanguage,
    intlLocale,
    htmlLangAttr,
    htmlDirAttr,
    isRtlLanguage,
    isCjkLanguage,
    formatDuration,
    createDomTranslator,
  };
});
