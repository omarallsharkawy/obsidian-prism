// Obsidian Prism — OpenAI-Compatible Thought Translator Settings Workbench UI (v1.0.8-beta.2 Bilingual EN/AR & Sync Hardened)
// Extracted modular UI component mounted on globalThis.__agPrismThoughtSettingsUi

(function (root) {
  'use strict';
  const G = root || (typeof globalThis !== 'undefined' ? globalThis : window);
  if (!G) return;

  const WB_STR_KEYS =
    'defaultProfName|customProfPrefix|viewLabel|optImmersive|optBilingual|styleLabel|optTech|optConcise|optCustom|customPromptPh|profilesLabel|addProfile|delProfile|fieldName|fieldNamePh|fetchModels|saveBtn|testBtn|clearCacheBtn|privacyHint|keylessPh|keylessBadge|clearKeyBtn|keyClearedBadge|fetchingModels|fetchErr|savingCfg|saveErr|testingConn|testErr|clearDualOk|clearLocalOk|usageHint|bridgeOfflineHint|proxyLabel|proxyModeAuto|proxyModeCustom|proxyModeDirect|proxyHintAuto|proxyHintDirect|proxyHintValid|proxyHintSavedAuth|proxyHintInvalid|proxyClearBtn|toolSumLabel|toolSumDesc|toolSumOn|toolSumOff'.split(
      '|'
    );
  const wbFmt = (t, args) => t.replace(/\{(\d)\}/g, (_, i) => String(args[i] ?? ''));
  const WB_FMT_SPECS = [
    ['savedKeyPh', (t) => (m) => wbFmt(t, [m])],
    ['cacheBadge', (t) => (n) => wbFmt(t, [n])],
    ['cacheDetail', (t) => (l, d, k) => wbFmt(t, [l, d]) + (k ? ` (${k})` : '')],
    ['quickSelect', (t) => (n) => wbFmt(t, [n])],
    ['fetchOk', (t) => (n, ms) => wbFmt(t, [n, ms])],
    ['saveOk', (t, f0, f1) => (nm, md) => wbFmt(t, [nm || f0, md || f1])],
    ['testOk', (t) => (ms, md, r) => wbFmt(t, [ms, md, r])],
  ];
  const WB_DATA = {
    en: [
      'Primary OpenAI Profile|Profile|Reading View|Translated Only|Bilingual Stacked|Polishing Style|Technical Manuscript|Concise Key Points|Custom Prompt|Enter local-only custom system prompt (saved in ~/.gemini/config/, never in Git)…|OpenAI Endpoint Profiles|+ New|Delete|Profile Name|e.g. Primary Gateway / Local Ollama|Fetch Models|Save Config|Send Test Message|Clear Cache|API keys & custom prompts are stored locally in ~/.gemini/config/ (0600) and never touch Git.|Optional for local endpoint|Keyless OK|Clear|Pending clear|Fetching upstream /models…|Failed to fetch models|Saving configuration…|Save failed (daemon offline)|Testing endpoint latency…|Connection test failed|✓ Cleared translation cache|✓ Cleared local cache|Expand a thinking block to view translations; blocks already in your target language keep the original text; free machine translation automatically follows your system proxy.|Prism background service is disconnected. Please make sure the plugin daemon is running.|Custom Proxy URL|Auto|Custom|Direct|Leave blank to auto-detect env & OS system proxy; supports http://, https://, socks5://, socks5h://|Direct mode enabled: env & OS system proxies are bypassed.|✓ Proxy URL valid (prioritized after save; credentials redacted)|✓ Saved proxy with redacted credentials (clear or overwrite to change)|✕ Invalid proxy URL: only http://, https://, socks5://, socks5h:// (port 1–65535, no control chars)|Clear|Translate "Exploring" Tool Summaries|Batch-translate short prose in Exploring/tool lists (off by default); auto-protects filenames, paths, line refs & exit codes, and restores raw text when off.|On|Off',
      ['Saved {0} (leave blank to keep)', 'Cache: {0}', 'Frontend: {0} / Daemon: {1}', '▾ Quick-select from {0} models…', '✓ Loaded {0} models · {1}ms', '✓ Saved ({0} · {1})', '✓ Connected · {0}ms · Reply: "{2}"'],
      'Profile',
      'No model',
    ],
    ar: [
      'ملف OpenAI الرئيسي|ملف مخصص|عرض القراءة|الترجمة فقط|ثنائي اللغة (الترجمة والأصل)|أسلوب الصياغة|ملاحظات هندسية تقنية|نقاط رئيسية موجزة|أمر نظام مخصص|أدخل أمر نظام مخصصًا يُحفظ محليًا فقط في ~/.gemini/config/ ولا يُرفع إلى Git أبدًا…|ملفات نقاط OpenAI|+ جديد|حذف|اسم الملف|مثال: البوابة الرئيسية / Ollama محلي|جلب النماذج|حفظ الإعدادات|إرسال رسالة اختبار|مسح الذاكرة المؤقتة|تُحفظ مفاتيح API والأوامر المخصصة محليًا في ~/.gemini/config/ بصلاحيات 0600 ولا تُكتب في مستودع Git.|اختياري للخادم المحلي|محلي بدون مفتاح|مسح|بانتظار المسح|جارٍ جلب قائمة النماذج /models…|تعذر جلب قائمة النماذج|جارٍ حفظ الإعدادات…|فشل الحفظ (الخدمة الخلفية غير متصلة)|جارٍ اختبار الاتصال وزمن الاستجابة…|فشل اختبار الاتصال|✓ تم مسح ذاكرة الترجمة المؤقتة|✓ تم مسح الذاكرة المحلية|افتح كتلة التفكير لعرض الترجمة؛ الكتل المكتوبة أصلًا باللغة المستهدفة تبقى كما هي؛ الترجمة الآلية المجانية تتبع وكيل النظام تلقائيًا.|خدمة Prism الخلفية غير متصلة. يرجى التأكد من تشغيل الخدمة الخلفية للإضافة.|رابط وكيل مخصص|تلقائي|مخصص|مباشر|اتركه فارغًا لاكتشاف متغيرات البيئة ووكيل النظام تلقائيًا؛ يدعم http:// وhttps:// وsocks5:// وsocks5h://|وضع الاتصال المباشر مفعل: يتم تجاهل وكيل البيئة والنظام.|✓ رابط الوكيل صالح (يُستخدم أولًا بعد الحفظ مع إخفاء بيانات الاعتماد)|✓ تم حفظ وكيل ببيانات اعتماد مخفية (امسحه أو استبدله للتعديل)|✕ رابط الوكيل غير صالح: يدعم فقط http:// وhttps:// وsocks5:// وsocks5h:// (المنفذ 1–65535، دون محارف تحكم)|مسح|ترجمة ملخصات أدوات «الاستكشاف»|ترجمة الجمل القصيرة في قوائم الاستكشاف والأدوات دفعة واحدة (معطلة افتراضيًا)؛ تحمي أسماء الملفات والمسارات وأرقام الأسطر ورموز الخروج تلقائيًا وتعيد النص الأصلي عند إيقافها.|مفعل|معطل',
      ['محفوظ {0} (اتركه فارغًا للإبقاء عليه)', 'الذاكرة المؤقتة: {0}', 'الواجهة: {0} / الخدمة الخلفية: {1}', '▾ اختيار سريع من {0} نموذجًا…', '✓ تم تحميل {0} نموذجًا · {1}ms', '✓ تم الحفظ ({0} · {1})', '✓ متصل · {0}ms · الرد: "{2}"'],
      'ملف',
      'بدون نموذج',
    ],
  };
  const WORKBENCH_I18N = Object.fromEntries(
    Object.entries(WB_DATA).map(([lk, [strRow, fmts, f0, f1]]) => {
      const vals = strRow.split('|');
      const obj = {};
      for (let i = 0; i < WB_STR_KEYS.length; i++) obj[WB_STR_KEYS[i]] = vals[i];
      for (let i = 0; i < WB_FMT_SPECS.length; i++) {
        obj[WB_FMT_SPECS[i][0]] = WB_FMT_SPECS[i][1](fmts[i], f0, f1);
      }
      return [lk, obj];
    })
  );

  const EXTRA_I18N = {
    en: {
      titlesLabel: 'Auto-Translate Conversation Titles',
      titlesDesc: 'Translates conversation titles in the render layer only (off by default); never modifies underlying session data, skips timestamps/paths/filenames, and restores raw titles when off.',
      diagBtn: 'Diagnose',
      diagRunning: 'Diagnosing…',
      diagBridgeLbl: '1. Daemon Bridge',
      diagBridgeOnline: 'Online',
      diagBridgeOffline: 'Offline (daemon disconnected)',
      diagProfileLbl: '2. Mode & Profile',
      diagModeAi: 'AI Polish',
      diagModeMachine: 'Machine',
      diagModeOff: 'Off',
      diagProfileOk: 'Profile ready',
      diagProfileMissing: 'Incomplete config',
      diagIssueUrl: 'Invalid Base URL',
      diagIssueModel: 'Missing Model ID',
      diagIssueKey: 'Missing API Key',
      diagConnLbl: '3. Proxy & Connectivity',
      diagConnOk: 'Connected',
      diagConnSkipped: 'Skipped (translator off)',
      diagConnOffline: 'Unavailable (bridge offline)',
      diagConnFail: 'Unreachable',
      diagProxyNone: 'Direct / No proxy',
      diagProxyOs: 'OS Proxy',
      diagRemedyLbl: '4. Troubleshooting',
      diagHealthy: 'All checks passed. Expand a thought block to see translation.',
      diagRemedyOffline: 'Run the status command below in a terminal to verify the daemon, then relaunch Antigravity via its patched shortcut.',
      diagRemedyAuth: 'Upstream authentication failed. Check your API key, quota, and model permissions.',
      diagRemedyProxy: 'Upstream or proxy timed out / unreachable. Switch Auto / Custom / Direct proxy mode and verify your local proxy port.',
      diagRemedyProfile: 'Fill in a valid Base URL, Model ID, and API Key (local Ollama can omit key), or switch to free Machine Translation.',
      diagRemedyGeneral: 'Run the status command below to inspect installation & daemon health, or restart Antigravity.',
      diagCopyBtn: 'Copy',
      diagCopied: 'Copied ✓',
    },
    ar: {
      titlesLabel: 'الترجمة التلقائية لعناوين المحادثات',
      titlesDesc: 'يترجم عناوين المحادثات في طبقة العرض فقط (معطل افتراضيًا)؛ لا يعدل بيانات الجلسة الأصلية، ويتجاوز الطوابع الزمنية والمسارات وأسماء الملفات، ويعيد العناوين الأصلية فور الإيقاف.',
      diagBtn: 'تشخيص',
      diagRunning: 'جارٍ التشخيص…',
      diagBridgeLbl: '1. جسر الخدمة الخلفية',
      diagBridgeOnline: 'متصل',
      diagBridgeOffline: 'غير متصل (الخدمة الخلفية منقطعة)',
      diagProfileLbl: '2. الوضع والملف',
      diagModeAi: 'صياغة بالذكاء الاصطناعي',
      diagModeMachine: 'ترجمة آلية',
      diagModeOff: 'معطل',
      diagProfileOk: 'الملف جاهز',
      diagProfileMissing: 'إعداد غير مكتمل',
      diagIssueUrl: 'رابط Base URL غير صالح',
      diagIssueModel: 'معرف النموذج مفقود',
      diagIssueKey: 'مفتاح API مفقود',
      diagConnLbl: '3. الوكيل والاتصال',
      diagConnOk: 'متصل',
      diagConnSkipped: 'تم التخطي (المترجم معطل)',
      diagConnOffline: 'غير متاح (الجسر غير متصل)',
      diagConnFail: 'تعذر الوصول',
      diagProxyNone: 'مباشر / بدون وكيل',
      diagProxyOs: 'وكيل النظام',
      diagRemedyLbl: '4. إرشادات الحل',
      diagHealthy: 'نجحت جميع الفحوصات. افتح كتلة تفكير لرؤية الترجمة.',
      diagRemedyOffline: 'شغّل أمر التحقق أدناه في الطرفية للتأكد من عمل الخدمة الخلفية، ثم أعد تشغيل Antigravity عبر الاختصار المعدّل.',
      diagRemedyAuth: 'فشلت المصادقة مع المزود. تحقق من صحة مفتاح API والرصيد وصلاحيات النموذج.',
      diagRemedyProxy: 'انتهت المهلة أو تعذر الوصول للوكيل/المزود. جرّب التبديل بين تلقائي / مخصص / مباشر وتحقق من منفذ الوكيل المحلي.',
      diagRemedyProfile: 'أدخل رابط Base URL ومعرف النموذج ومفتاح API صالحين (Ollama المحلي لا يتطلب مفتاحًا)، أو انتقل للترجمة الآلية المجانية.',
      diagRemedyGeneral: 'شغّل أمر الحالة أدناه لفحص التثبيت والخدمة الخلفية، أو أعد تشغيل Antigravity.',
      diagCopyBtn: 'نسخ',
      diagCopied: 'تم النسخ ✓',
    },
  };
  for (const [lk, extra] of Object.entries(EXTRA_I18N)) {
    if (WORKBENCH_I18N[lk]) Object.assign(WORKBENCH_I18N[lk], extra);
  }

  function normalizeLangCode(raw) {
    const s = String(raw || '').trim().toLowerCase().replace(/_/g, '-');
    if (!s || s === 'auto') return '';
    if (/^ar(?:\b|-)/.test(s) || s === 'arabic' || s === 'العربية') return 'ar';
    if (/^en(?:\b|-)/.test(s) || s === 'english') return 'en';
    if (/^zh(?:\b|-)/.test(s) || s === 'tw' || s === 'hant' || s === 'yue' || s.startsWith('yue-') || s.includes('cantonese')) {
      return 'ar';
    }
    return '';
  }

  function isLocalKeylessUrl(rawUrl) {
    const raw = String(rawUrl || '').trim();
    if (!raw) return false;
    const withProto = /^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(raw) ? raw : 'http://' + raw;
    try {
      const u = new URL(withProto);
      const host = u.hostname.toLowerCase().replace(/^\[|\]$/g, '');
      if (
        !host ||
        host === '0.0.0.0' ||
        host === '100.100.100.200' ||
        host === 'metadata.google.internal' ||
        host === 'metadata' ||
        host === 'instance-data' ||
        /^fd00:ec2::254$/i.test(host) ||
        /^169\.254(?:\.\d{1,3}){2}$/.test(host)
      ) {
        return false;
      }
      if (
        host === 'localhost' ||
        host.endsWith('.localhost') ||
        host === '::1' ||
        host === 'host.docker.internal' ||
        host === 'gateway.docker.internal'
      ) {
        return true;
      }
      if (/^127(?:\.\d{1,3}){3}$/.test(host)) return true;
      if (/^10(?:\.\d{1,3}){3}$/.test(host)) return true;
      if (/^192\.168(?:\.\d{1,3}){2}$/.test(host)) return true;
      if (/^172\.(?:1[6-9]|2\d|3[0-1])(?:\.\d{1,3}){2}$/.test(host)) return true;
      if (/^100\.(?:6[4-9]|[7-9]\d|1[01]\d|12[0-7])(?:\.\d{1,3}){2}$/.test(host)) return true;
      if (/^(?:fc|fd|fe80:)/i.test(host)) return true;
      if (/\.(?:local|lan|internal|home|arpa)$/i.test(host)) return true;
      if (!host.includes('.') && !host.includes(':')) return true;
      return false;
    } catch {
      return false;
    }
  }

  function validateCustomProxyInput(rawProxy, savedMaskedProxy = '') {
    const rawStr = String(rawProxy || '');
    if (/[\r\n\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(rawStr)) {
      return { ok: false, empty: false, reason: 'control-chars' };
    }
    const s = rawStr.trim();
    if (!s) return { ok: true, empty: true, savedAuth: false };
    if (s.includes('••••')) {
      if (savedMaskedProxy && s === savedMaskedProxy) {
        return { ok: true, empty: false, savedAuth: true };
      }
      return { ok: false, empty: false, reason: 'invalid-mask' };
    }
    if (/[\u0000-\u001f\u007f]/.test(s)) {
      return { ok: false, empty: false, reason: 'control-chars' };
    }
    if (/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(s)) {
      if (!/^(?:https?|socks5h?):\/\//i.test(s)) {
        return { ok: false, empty: false, reason: 'unsupported-protocol' };
      }
    } else if (s.includes('=') || /^[a-zA-Z][a-zA-Z0-9+.-]*:(?!\d+$)/.test(s)) {
      return { ok: false, empty: false, reason: 'invalid-format' };
    }
    const withScheme = /^(?:https?|socks5h?):\/\//i.test(s) ? s : `http://${s}`;
    try {
      const u = new URL(withScheme);
      if (!['http:', 'https:', 'socks5:', 'socks5h:'].includes(u.protocol)) {
        return { ok: false, empty: false, reason: 'unsupported-protocol' };
      }
      const host = u.hostname.toLowerCase().replace(/^\[|\]$/g, '');
      if (
        !host ||
        /[\u0000-\u001f\u007f\s=@/?#]/.test(host) ||
        host === '0.0.0.0' ||
        host === '100.100.100.200' ||
        host === 'metadata.google.internal' ||
        host === 'metadata' ||
        host === 'instance-data' ||
        /^fd00:ec2::254$/i.test(host) ||
        /^169\.254(?:\.\d{1,3}){2}$/.test(host)
      ) {
        return { ok: false, empty: false, reason: 'invalid-host' };
      }
      if (u.port) {
        if (!/^\d{1,5}$/.test(u.port)) return { ok: false, empty: false, reason: 'invalid-port' };
        const p = Number(u.port);
        if (!Number.isInteger(p) || p < 1 || p > 65535) return { ok: false, empty: false, reason: 'invalid-port' };
      }
      let user = '';
      let pass = '';
      try { user = decodeURIComponent(u.username || ''); } catch { user = u.username || ''; }
      try { pass = decodeURIComponent(u.password || ''); } catch { pass = u.password || ''; }
      if (/[\u0000-\u001f\u007f]/.test(user) || /[\u0000-\u001f\u007f]/.test(pass)) {
        return { ok: false, empty: false, reason: 'control-chars' };
      }
      return { ok: true, empty: false, savedAuth: false, protocol: u.protocol };
    } catch {
      return { ok: false, empty: false, reason: 'invalid-url' };
    }
  }

  function applyNoTranslateAttrs(el) {
    if (!el || !el.setAttribute) return el;
    el.setAttribute('data-ag-no-i18n', '');
    for (const s of 'translate=no,data-no-translate=true,data-ag-localization-skip=true,data-agy-no-translate=true,data-antigravity-zh-skip=1'.split(',')) {
      const p = s.split('=');
      el.setAttribute(p[0], p[1]);
    }
    return el;
  }

  function setToggleAttr(el, name, on) {
    if (!el) return;
    if (typeof el.toggleAttribute === 'function') {
      el.toggleAttribute(name, Boolean(on));
    } else if (on) {
      el.setAttribute(name, '');
    } else {
      el.removeAttribute(name);
    }
  }

  function resolveThoughtApi() {
    if (typeof window !== 'undefined' && window.__agPrismThought) return window.__agPrismThought;
    return G.__agPrismThought || null;
  }

  function resolveHostPrism() {
    if (typeof window !== 'undefined' && window.__agPrism) return window.__agPrism;
    return G.__agPrism || null;
  }

  function hasThoughtBridge() {
    const br =
      (typeof window !== 'undefined' && window.__agPrismThoughtBridge) || G.__agPrismThoughtBridge || null;
    return Boolean(br && typeof br === 'object');
  }

  // Strictly prioritize `__agPrismThoughtBridge` over raw V8 CDP binding `__agPrismThoughtCall(jsonStr) -> void`!
  function resolveThoughtRpcCall() {
    const br =
      (typeof window !== 'undefined' && window.__agPrismThoughtBridge) || G.__agPrismThoughtBridge || null;
    if (br) {
      return (payload) => {
        const act = payload && payload.action;
        if (act === 'cache-stats' && typeof br.cacheStats === 'function') return br.cacheStats();
        if (act === 'clear-cache' && typeof br.clearCache === 'function') return br.clearCache();
        if (act === 'cancel-translate' && typeof br.cancelTranslate === 'function') return br.cancelTranslate(payload);
        if (typeof br.call === 'function') return br.call(payload);
        return Promise.resolve({ ok: false, offline: true });
      };
    }
    const rawFn =
      (typeof window !== 'undefined' && typeof window.__agPrismThoughtCall === 'function' && window.__agPrismThoughtCall) ||
      (typeof G.__agPrismThoughtCall === 'function' && G.__agPrismThoughtCall) ||
      null;
    if (rawFn) {
      return (payload) => {
        const ret = rawFn(payload);
        return ret && typeof ret.then === 'function' ? ret : Promise.resolve({ ok: false, offline: true });
      };
    }
    return null;
  }

  function resolveWorkbenchLang(doc, explicitLang, getLangFn, isZhFn) {
    if (typeof getLangFn === 'function') {
      const fromFn = normalizeLangCode(getLangFn());
      if (fromFn) return fromFn;
    }
    const fromProp = normalizeLangCode(explicitLang);
    if (fromProp) return fromProp;
    try {
      const docEl = doc && doc.documentElement;
      if (docEl && docEl.getAttribute) {
        const csLang = normalizeLangCode(docEl.getAttribute('data-ag-cs-lang'));
        if (csLang) return csLang;
        const prismLang = normalizeLangCode(docEl.getAttribute('data-ag-prism-lang'));
        if (prismLang) return prismLang;
      }
      const hostLang = normalizeLangCode(resolveHostPrism()?.getState?.()?.cfg?.language);
      if (hostLang) return hostLang;
      const navObj = G && 'navigator' in G ? G.navigator : (typeof navigator !== 'undefined' ? navigator : null);
      const navLang = normalizeLangCode(navObj?.language || '');
      if (navLang) return navLang;
    } catch (_) {}
    if (typeof isZhFn === 'function') {
      return isZhFn() ? 'ar' : 'en';
    }
    return 'en';
  }

  function createThoughtAiConfigBox({
    mkEl,
    btnClass,
    ui = {},
    lang,
    getLang,
    isZh,
    getMode,
    hideViewBar,
    runGuardedMut,
  }) {
    const doc = typeof document !== 'undefined' ? document : G.document || null;
    if (!doc) {
      return {
        box: null,
        onModeSwitched() {},
        onViewSwitched() {},
        onLanguageChanged() {},
        ensureLoaded() {},
        reloadConfig() {
          return Promise.resolve({ ok: false });
        },
      };
    }

    const guard = typeof runGuardedMut === 'function' ? runGuardedMut : (fn) => fn();
    const modeFn = typeof getMode === 'function' ? getMode : () => 'ai';
    let currentExplicitLang = lang || '';

    const getActiveLang = () => resolveWorkbenchLang(doc, currentExplicitLang, getLang, isZh);

    const getPack = () => {
      const code = getActiveLang();
      return WORKBENCH_I18N[code] || WORKBENCH_I18N.en;
    };

    const applyBoxDirection = (el) => {
      if (!el || !el.setAttribute) return;
      const code = getActiveLang();
      el.setAttribute('dir', code === 'ar' ? 'rtl' : 'ltr');
      el.setAttribute('lang', code === 'ar' ? 'ar' : 'en');
    };

    const box = mkEl('div', 'ag-cs-thought-cfg-box');
    box.setAttribute('data-testid', 'prism-thought-ai-config');
    applyNoTranslateAttrs(box);
    applyBoxDirection(box);
    box.hidden = modeFn() !== 'ai';

    const sharedMountSlot = mkEl('div', '');
    if (sharedMountSlot.style) {
      sharedMountSlot.style.display = 'flex';
      sharedMountSlot.style.flexDirection = 'column';
      sharedMountSlot.style.gap = '10px';
    }
    box.appendChild(sharedMountSlot);

    const hostCfgView = resolveHostPrism()?.getState?.()?.cfg?.thoughtView;
    const initialApi = resolveThoughtApi();
    const initialViewMode =
      hostCfgView === 'bilingual' || hostCfgView === 'immersive'
        ? hostCfgView
        : initialApi && typeof initialApi.getViewMode === 'function'
        ? initialApi.getViewMode()
        : 'immersive';

    const initialPack = getPack();
    const state = {
      loaded: false,
      busy: false,
      viewMode: initialViewMode === 'bilingual' ? 'bilingual' : 'immersive',
      stylePreset: 'technical',
      customPrompt: '',
      proxyMode: 'auto',
      customProxyUrl: '',
      savedMaskedProxy: '',
      hasProxyCredentials: false,
      translateToolSummaries: false,
      translateTitles: false,
      dirtyToolSum: false,
      dirtyTitles: false,
      diagnosing: false,
      lastDiag: null,
      cacheCount: 0,
      cacheDetailText: '',
      activeProfileId: 'default',
      profiles: [
        {
          id: 'default',
          name: initialPack.defaultProfName,
          baseUrl: 'https://api.openai.com/v1',
          model: 'gpt-4o-mini',
          hasApiKey: false,
          maskedKey: '',
          draftKey: '',
        },
      ],
      fetchedModels: [],
    };
    let loadConfigPromise = null;

    // -1) Usage Hint, Background Bridge Status Banner & One-Click Diagnostics Strip
    const usageBanner = mkEl('div', 'ag-cs-thought-hint');
    usageBanner.setAttribute('data-testid', 'thought-usage-banner');
    applyNoTranslateAttrs(usageBanner);
    if (usageBanner.style) {
      usageBanner.style.display = 'flex';
      usageBanner.style.flexDirection = 'column';
      usageBanner.style.gap = '6px';
      usageBanner.style.padding = '7px 10px';
      usageBanner.style.borderRadius = 'var(--ag-cs-r-md, 8px)';
      usageBanner.style.border = '1px solid var(--ag-cs-border-1, rgba(128, 128, 128, 0.22))';
      usageBanner.style.background = 'var(--ag-cs-pill-bg, rgba(128, 128, 128, 0.06))';
    }
    const usageTopRow = mkEl('div', 'ag-cs-thought-bar');
    if (usageTopRow.style) {
      usageTopRow.style.alignItems = 'flex-start';
      usageTopRow.style.gap = '8px';
    }
    const usageHintEl = mkEl('p', 'ag-cs-thought-hint');
    usageHintEl.setAttribute('data-testid', 'thought-usage-hint');
    usageHintEl.textContent = ui.thoughtUsageHint || initialPack.usageHint;

    const diagBtn = doc.createElement('button');
    diagBtn.type = 'button';
    diagBtn.className = 'ag-cs-thought-btn';
    diagBtn.setAttribute('data-testid', 'thought-diagnose-btn');
    if (diagBtn.style) diagBtn.style.flexShrink = '0';
    diagBtn.textContent = ui.thoughtDiagBtn || initialPack.diagBtn;

    usageTopRow.appendChild(usageHintEl);
    usageTopRow.appendChild(diagBtn);

    const bridgeWarnEl = mkEl('p', 'ag-cs-thought-hint');
    bridgeWarnEl.setAttribute('data-testid', 'thought-bridge-warning');
    bridgeWarnEl.setAttribute('role', 'status');
    if (bridgeWarnEl.style) {
      bridgeWarnEl.style.color = 'var(--warning, #D97706)';
      bridgeWarnEl.style.fontWeight = '500';
      bridgeWarnEl.style.opacity = '1';
    }

    const diagPanel = mkEl('div', 'ag-cs-thought-diag-panel');
    diagPanel.setAttribute('data-testid', 'thought-diagnose-panel');
    diagPanel.setAttribute('role', 'status');
    applyNoTranslateAttrs(diagPanel);
    diagPanel.hidden = true;
    if (diagPanel.style) {
      diagPanel.style.display = 'none';
      diagPanel.style.flexDirection = 'column';
      diagPanel.style.gap = '4px';
      diagPanel.style.paddingTop = '6px';
      diagPanel.style.borderTop = '1px solid var(--ag-cs-border-1, rgba(128, 128, 128, 0.18))';
      diagPanel.style.fontSize = '11.5px';
    }

    const mkDiagRow = (tid) => {
      const row = mkEl('div', 'ag-cs-thought-diag-item');
      row.setAttribute('data-testid', tid);
      row.setAttribute('data-state', 'idle');
      if (row.style) {
        row.style.display = 'flex';
        row.style.flexWrap = 'wrap';
        row.style.alignItems = 'center';
        row.style.gap = '6px';
        row.style.lineHeight = '1.45';
      }
      const lbl = doc.createElement('span');
      if (lbl.style) {
        lbl.style.fontWeight = '600';
        lbl.style.opacity = '0.88';
      }
      const val = doc.createElement('span');
      row.appendChild(lbl);
      row.appendChild(val);
      diagPanel.appendChild(row);
      return { row, lbl, val };
    };

    const diagBridgeRow = mkDiagRow('thought-diag-bridge');
    const diagProfileRow = mkDiagRow('thought-diag-profile');
    const diagConnRow = mkDiagRow('thought-diag-connectivity');
    const diagRemedyRow = mkDiagRow('thought-diag-remedy');

    const diagCmdWrap = mkEl('div', 'ag-cs-thought-diag-cmd-row');
    diagCmdWrap.setAttribute('data-testid', 'thought-diag-cmd-wrap');
    diagCmdWrap.hidden = true;
    if (diagCmdWrap.style) {
      diagCmdWrap.style.display = 'none';
      diagCmdWrap.style.alignItems = 'center';
      diagCmdWrap.style.gap = '6px';
      diagCmdWrap.style.marginTop = '2px';
    }
    const diagCmdCode = doc.createElement('code');
    diagCmdCode.setAttribute('data-testid', 'thought-diag-cmd');
    diagCmdCode.setAttribute('dir', 'ltr');
    diagCmdCode.setAttribute('data-ag-ltr', '1');
    diagCmdCode.textContent = 'node tools/install-plugin.cjs --status';
    if (diagCmdCode.style) {
      diagCmdCode.style.fontFamily = 'monospace';
      diagCmdCode.style.fontSize = '11px';
      diagCmdCode.style.padding = '2px 6px';
      diagCmdCode.style.borderRadius = '4px';
      diagCmdCode.style.background = 'var(--ag-cs-pill-bg, rgba(128, 128, 128, 0.14))';
      diagCmdCode.style.userSelect = 'all';
    }
    const diagCopyBtn = doc.createElement('button');
    diagCopyBtn.type = 'button';
    diagCopyBtn.className = 'ag-cs-thought-btn';
    diagCopyBtn.setAttribute('data-testid', 'thought-diag-copy-cmd');
    diagCopyBtn.textContent = initialPack.diagCopyBtn;
    if (diagCopyBtn.style) {
      diagCopyBtn.style.fontSize = '10.5px';
      diagCopyBtn.style.padding = '1px 6px';
      diagCopyBtn.style.minHeight = '20px';
    }
    diagCopyBtn.addEventListener('click', (ev) => {
      if (ev && typeof ev.stopPropagation === 'function') ev.stopPropagation();
      const cmd = diagCmdCode.textContent || 'node tools/install-plugin.cjs --status';
      const clip = typeof navigator !== 'undefined' && navigator.clipboard ? navigator.clipboard : G.navigator?.clipboard;
      if (clip && typeof clip.writeText === 'function') {
        void Promise.resolve()
          .then(() => clip.writeText(cmd))
          .catch(() => {});
      }
      const p = getPack();
      guard(() => {
        diagCopyBtn.textContent = p.diagCopied;
      });
      setTimeout(() => {
        if (diagCopyBtn.isConnected === false) return;
        guard(() => {
          diagCopyBtn.textContent = getPack().diagCopyBtn;
        });
      }, 1600);
    });
    diagCmdWrap.appendChild(diagCmdCode);
    diagCmdWrap.appendChild(diagCopyBtn);
    diagPanel.appendChild(diagCmdWrap);

    usageBanner.appendChild(usageTopRow);
    usageBanner.appendChild(bridgeWarnEl);
    usageBanner.appendChild(diagPanel);
    sharedMountSlot.appendChild(usageBanner);

    const setDiagItemState = (item, kind, labelText, valueText) => {
      item.row.setAttribute('data-state', kind);
      item.lbl.textContent = labelText;
      item.val.textContent = valueText;
      if (item.val.style) {
        item.val.style.color =
          kind === 'ok'
            ? 'var(--success, #50A37B)'
            : kind === 'err'
            ? 'var(--error, #E5534B)'
            : kind === 'warn'
            ? 'var(--warning, #D97706)'
            : '';
      }
    };

    const redactUiDiagText = (raw) =>
      String(raw || '')
        .replace(/([a-zA-Z][a-zA-Z0-9+.-]*:\/\/)[^@\s\x2f\x22\x27<>]+@/gi, '$1***REDACTED***@')
        .replace(
          /(sk-[A-Za-z0-9_\-]{6,}|Bearer\s+[A-Za-z0-9._\-:+/=]{6,}|(?:Proxy-)?Authorization\s*:\s*Basic\s+[A-Za-z0-9+/=]{4,})/gi,
          '***REDACTED***'
        )
        .slice(0, 160);

    const renderDiagnostics = () => {
      const pack = getPack();
      guard(() => {
        diagBtn.textContent = state.diagnosing ? pack.diagRunning : ui.thoughtDiagBtn || pack.diagBtn;
        diagBtn.disabled = Boolean(state.diagnosing);
        diagCopyBtn.textContent = pack.diagCopyBtn;
        const d = state.lastDiag;
        if (!d) {
          diagPanel.hidden = true;
          if (diagPanel.style) diagPanel.style.display = 'none';
          return;
        }
        diagPanel.hidden = false;
        if (diagPanel.style) diagPanel.style.display = 'flex';

        const bridgeOnline = d.bridgeOnline === true;
        setDiagItemState(
          diagBridgeRow,
          bridgeOnline ? 'ok' : 'err',
          pack.diagBridgeLbl,
          bridgeOnline ? `✓ ${pack.diagBridgeOnline}` : `✕ ${pack.diagBridgeOffline}`
        );

        const modeName =
          d.mode === 'ai' ? pack.diagModeAi : d.mode === 'machine' ? pack.diagModeMachine : pack.diagModeOff;
        const issueLabels = Array.isArray(d.profileIssues)
          ? d.profileIssues.map((code) =>
              code === 'invalid_base_url'
                ? pack.diagIssueUrl
                : code === 'missing_model'
                ? pack.diagIssueModel
                : code === 'missing_api_key'
                ? pack.diagIssueKey
                : code
            )
          : [];
        const profileOk = d.mode === 'ai' ? Boolean(d.profileReady) : d.mode !== 'off';
        const profileText =
          d.mode === 'ai'
            ? `${modeName} · ${d.profileReady ? `✓ ${pack.diagProfileOk}` : `✕ ${pack.diagProfileMissing} (${issueLabels.join(', ')})`}`
            : modeName;
        setDiagItemState(
          diagProfileRow,
          d.mode === 'off' ? 'warn' : profileOk ? 'ok' : 'err',
          pack.diagProfileLbl,
          profileText
        );

        const conn = d.connectivity || {};
        const proxyParts = [];
        if (d.proxyMode) proxyParts.push(d.proxyMode);
        if (d.effectiveProxy) proxyParts.push(redactUiDiagText(d.effectiveProxy));
        else proxyParts.push(pack.diagProxyNone);
        if (d.osProxyDetected && d.osProxyDetected !== d.effectiveProxy) {
          proxyParts.push(`${pack.diagProxyOs}: ${redactUiDiagText(d.osProxyDetected)}`);
        }
        const proxyPrefix = proxyParts.length ? `[${proxyParts.join(' · ')}] ` : '';
        let connKind = 'idle';
        let connVal = '';
        if (!bridgeOnline) {
          connKind = 'err';
          connVal = `✕ ${pack.diagConnOffline}`;
        } else if (conn.skipped) {
          connKind = 'warn';
          connVal = `${proxyPrefix}${pack.diagConnSkipped}`;
        } else if (conn.ok) {
          connKind = 'ok';
          const ms = Number.isFinite(conn.latencyMs) ? ` · ${conn.latencyMs}ms` : '';
          connVal = `${proxyPrefix}✓ ${pack.diagConnOk}${ms}`;
        } else {
          connKind = 'err';
          const detail = conn.error ? ` (${redactUiDiagText(conn.error)})` : conn.reason ? ` (${conn.reason})` : '';
          connVal = `${proxyPrefix}✕ ${pack.diagConnFail}${detail}`;
        }
        setDiagItemState(diagConnRow, connKind, pack.diagConnLbl, connVal);

        const hasIssue = !bridgeOnline || d.mode === 'off' || (d.mode === 'ai' && !d.profileReady) || (conn && !conn.ok);
        let remedyMsg = pack.diagHealthy;
        if (!bridgeOnline) remedyMsg = pack.diagRemedyOffline;
        else if (d.mode === 'ai' && !d.profileReady) remedyMsg = pack.diagRemedyProfile;
        else if (conn && !conn.ok && conn.reason === 'auth_error') remedyMsg = pack.diagRemedyAuth;
        else if (
          conn &&
          !conn.ok &&
          (conn.reason === 'timeout' || conn.reason === 'proxy_error' || conn.reason === 'network_error' || conn.reason === 'invalid_proxy')
        ) {
          remedyMsg = pack.diagRemedyProxy;
        } else if (hasIssue) {
          remedyMsg = pack.diagRemedyGeneral;
        }
        setDiagItemState(diagRemedyRow, hasIssue ? 'warn' : 'ok', pack.diagRemedyLbl, remedyMsg);

        const cmdText =
          Array.isArray(d.suggestedCommands) && d.suggestedCommands[0]
            ? String(d.suggestedCommands[0])
            : 'node tools/install-plugin.cjs --status';
        diagCmdCode.textContent = cmdText;
        diagCmdWrap.hidden = !hasIssue;
        if (diagCmdWrap.style) diagCmdWrap.style.display = hasIssue ? 'flex' : 'none';
      });
    };

    const syncUsageBanner = () => {
      const pack = getPack();
      const offline = !hasThoughtBridge();
      guard(() => {
        usageHintEl.textContent = ui.thoughtUsageHint || pack.usageHint;
        usageBanner.setAttribute('data-bridge-state', offline ? 'offline' : 'online');
        bridgeWarnEl.textContent = offline ? ui.thoughtBridgeOfflineHint || pack.bridgeOfflineHint : '';
        bridgeWarnEl.hidden = !offline;
        if (bridgeWarnEl.style) bridgeWarnEl.style.display = offline ? '' : 'none';
      });
      renderDiagnostics();
    };

    const runDiagnostics = () => {
      if (state.diagnosing) return Promise.resolve(state.lastDiag);
      const curMode = modeFn() || 'off';
      if (!hasThoughtBridge()) {
        syncFormIntoProfile();
        const cur = getActiveProfile();
        const issues = [];
        if (!cur?.baseUrl) issues.push('invalid_base_url');
        if (!cur?.model) issues.push('missing_model');
        if (!cur?.hasApiKey && !cur?.draftKey && !isLocalKeylessUrl(cur?.baseUrl)) issues.push('missing_api_key');
        state.lastDiag = {
          ok: false,
          bridgeOnline: false,
          mode: curMode,
          proxyMode: state.proxyMode,
          effectiveProxy: '',
          osProxyDetected: '',
          profileReady: issues.length === 0,
          profileIssues: issues,
          connectivity: { ok: false, latencyMs: 0, reason: 'bridge_offline' },
          translateToolSummaries: Boolean(state.translateToolSummaries),
          translateTitles: Boolean(state.translateTitles),
          suggestedCommands: ['node tools/install-plugin.cjs --status'],
        };
        syncUsageBanner();
        return Promise.resolve(state.lastDiag);
      }
      state.diagnosing = true;
      renderDiagnostics();
      const waitLoad = () => {
        if (state.loaded) return Promise.resolve();
        let tm = null;
        return Promise.race([
          ensureConfigLoaded().catch(() => {}),
          new Promise((resolve) => {
            tm = setTimeout(resolve, 1500);
          }),
        ]).finally(() => {
          if (tm) clearTimeout(tm);
        });
      };
      return waitLoad()
        .then(() => {
          const reqPayload = { mode: curMode };
          if (state.loaded) {
            syncFormIntoProfile();
            const cur = getActiveProfile();
            reqPayload.profileId = cur?.id;
            reqPayload.baseUrl = cur?.baseUrl;
            reqPayload.model = cur?.model;
            reqPayload.apiKey = cur?.draftKey || '';
            reqPayload.proxyMode = state.proxyMode;
            reqPayload.customProxyUrl = state.proxyMode === 'custom' ? String(state.customProxyUrl || '').trim() : '';
          }
          const api = resolveThoughtApi();
          const rpcCall = resolveThoughtRpcCall();
          if (api && typeof api.diagnose === 'function') return api.diagnose(reqPayload);
          if (rpcCall) return rpcCall({ action: 'diagnose', ...reqPayload });
          return { ok: false, offline: true };
        })
        .then((res) => {
          if (res && res.ok) {
            state.lastDiag = { ...res, bridgeOnline: true };
          } else {
            state.lastDiag = {
              ok: false,
              bridgeOnline: !res?.offline,
              mode: curMode,
              proxyMode: state.proxyMode,
              effectiveProxy: '',
              osProxyDetected: '',
              profileReady: false,
              profileIssues: [],
              connectivity: {
                ok: false,
                latencyMs: 0,
                reason: res?.offline ? 'bridge_offline' : 'diagnose_failed',
                error: redactUiDiagText(res?.error || ''),
              },
              translateToolSummaries: Boolean(state.translateToolSummaries),
              translateTitles: Boolean(state.translateTitles),
              suggestedCommands: ['node tools/install-plugin.cjs --status'],
            };
          }
          return state.lastDiag;
        })
        .catch((err) => {
          state.lastDiag = {
            ok: false,
            bridgeOnline: hasThoughtBridge(),
            mode: curMode,
            proxyMode: state.proxyMode,
            effectiveProxy: '',
            osProxyDetected: '',
            profileReady: false,
            profileIssues: [],
            connectivity: {
              ok: false,
              latencyMs: 0,
              reason: 'diagnose_failed',
              error: redactUiDiagText(err?.message || String(err)),
            },
            translateToolSummaries: Boolean(state.translateToolSummaries),
            translateTitles: Boolean(state.translateTitles),
            suggestedCommands: ['node tools/install-plugin.cjs --status'],
          };
          return state.lastDiag;
        })
        .finally(() => {
          state.diagnosing = false;
          syncUsageBanner();
        });
    };

    diagBtn.addEventListener('click', (ev) => {
      if (ev && typeof ev.stopPropagation === 'function') ev.stopPropagation();
      void runDiagnostics();
    });

    // 0) Reading View Bar: kept in DOM for standalone/test usage; auto-hidden when parent settings-panel already renders thoughtView row
    const viewBar = mkEl('div', 'ag-cs-thought-bar');
    const hasParentViewRow =
      hideViewBar === true || Boolean(ui && (ui.optThoughtImmersive || ui.optThoughtBilingual || ui.thoughtViewTitle));
    viewBar.hidden = hasParentViewRow;

    const viewLbl = mkEl('span', 'ag-cs-thought-label');
    viewLbl.textContent = ui.thoughtViewLabel || ui.thoughtViewTitle || initialPack.viewLabel;
    const viewGrp = mkEl(
      'div',
      'inline-flex items-center rounded-lg border border-border bg-secondary/20 p-0.5 gap-0.5 select-none min-h-8'
    );
    viewGrp.setAttribute('role', 'group');
    viewGrp.setAttribute('data-testid', 'thought-view-mode-group');

    const getViewLabel = (vid, pack) => {
      if (vid === 'bilingual') {
        return ui.optThoughtBilingual || ui.optViewBilingual || pack.optBilingual;
      }
      return ui.optThoughtImmersive || ui.optViewImmersive || pack.optImmersive;
    };

    const viewBtns = new Map();

    const syncViewModeUi = () => {
      guard(() => {
        const pack = getPack();
        for (const [vid, btn] of viewBtns.entries()) {
          const on = state.viewMode === vid;
          btn.setAttribute('aria-pressed', String(on));
          setToggleAttr(btn, 'data-pressed', on);
          btn.textContent = getViewLabel(vid, pack);
        }
      });
    };

    for (const vid of ['immersive', 'bilingual']) {
      const vb = doc.createElement('button');
      vb.type = 'button';
      vb.className = btnClass;
      vb.textContent = getViewLabel(vid, initialPack);
      vb.setAttribute('data-thought-view', vid);
      vb.addEventListener('click', (ev) => {
        if (ev && typeof ev.stopPropagation === 'function') ev.stopPropagation();
        state.viewMode = vid;
        syncViewModeUi();
        const api = resolveThoughtApi();
        if (api && typeof api.setViewMode === 'function') {
          api.setViewMode(vid);
        }
        const prism = resolveHostPrism();
        if (prism && typeof prism.saveSettingsBatch === 'function') {
          prism.saveSettingsBatch({ thoughtView: vid });
        }
      });
      viewBtns.set(vid, vb);
      viewGrp.appendChild(vb);
    }
    viewBar.appendChild(viewLbl);
    viewBar.appendChild(viewGrp);
    sharedMountSlot.appendChild(viewBar);

    // 0b) Optional "Exploring" Tool Execution Summaries Batch Translation Toggle (default false)
    const toolSumWrap = mkEl('div', 'ag-cs-thought-field');
    toolSumWrap.setAttribute('data-testid', 'thought-tool-summaries-row');
    const toolSumBar = mkEl('div', 'ag-cs-thought-bar');
    const toolSumLbl = mkEl('span', 'ag-cs-thought-label');
    toolSumLbl.textContent = ui.thoughtToolSumLabel || initialPack.toolSumLabel;
    const toolSumBtn = doc.createElement('button');
    toolSumBtn.type = 'button';
    toolSumBtn.className = 'ag-cs-thought-btn';
    toolSumBtn.setAttribute('role', 'switch');
    toolSumBtn.setAttribute('aria-checked', 'false');
    toolSumBtn.setAttribute('data-testid', 'thought-tool-summaries-toggle');
    toolSumBtn.textContent = initialPack.toolSumOff;
    const toolSumDesc = mkEl('p', 'ag-cs-thought-hint');
    toolSumDesc.setAttribute('data-testid', 'thought-tool-summaries-desc');
    toolSumDesc.textContent = ui.thoughtToolSumDesc || initialPack.toolSumDesc;

    const syncToolSumUi = () => {
      const pack = getPack();
      const on = Boolean(state.translateToolSummaries);
      guard(() => {
        toolSumLbl.textContent = ui.thoughtToolSumLabel || pack.toolSumLabel;
        toolSumDesc.textContent = ui.thoughtToolSumDesc || pack.toolSumDesc;
        toolSumBtn.setAttribute('aria-checked', String(on));
        setToggleAttr(toolSumBtn, 'data-pressed', on);
        if (on) toolSumBtn.setAttribute('data-primary', '1');
        else toolSumBtn.removeAttribute('data-primary');
        toolSumBtn.textContent = on ? pack.toolSumOn : pack.toolSumOff;
      });
    };

    toolSumBtn.addEventListener('click', (ev) => {
      if (ev && typeof ev.stopPropagation === 'function') ev.stopPropagation();
      const next = !state.translateToolSummaries;
      state.translateToolSummaries = next;
      state.dirtyToolSum = true;
      syncToolSumUi();
      const api = resolveThoughtApi();
      if (api && typeof api.setTranslateToolSummaries === 'function') {
        api.setTranslateToolSummaries(next, { persistDaemon: false });
      }
      if (api && typeof api.saveConfig === 'function' && !state.busy) {
        void api.saveConfig({ translateToolSummaries: next }).catch(() => {});
      }
    });

    toolSumBar.appendChild(toolSumLbl);
    toolSumBar.appendChild(toolSumBtn);
    toolSumWrap.appendChild(toolSumBar);
    toolSumWrap.appendChild(toolSumDesc);
    sharedMountSlot.appendChild(toolSumWrap);

    // 0b2) Optional Conversation Titles Render-Layer Auto-Translation Toggle (default false)
    const titlesWrap = mkEl('div', 'ag-cs-thought-field');
    titlesWrap.setAttribute('data-testid', 'thought-titles-row');
    applyNoTranslateAttrs(titlesWrap);
    const titlesBar = mkEl('div', 'ag-cs-thought-bar');
    const titlesLbl = mkEl('span', 'ag-cs-thought-label');
    titlesLbl.textContent = ui.thoughtTitlesLabel || initialPack.titlesLabel;
    const titlesBtn = doc.createElement('button');
    titlesBtn.type = 'button';
    titlesBtn.className = 'ag-cs-thought-btn';
    titlesBtn.setAttribute('role', 'switch');
    titlesBtn.setAttribute('aria-checked', 'false');
    titlesBtn.setAttribute('data-testid', 'thought-titles-toggle');
    titlesBtn.textContent = initialPack.toolSumOff;
    const titlesDesc = mkEl('p', 'ag-cs-thought-hint');
    titlesDesc.setAttribute('data-testid', 'thought-titles-desc');
    titlesDesc.textContent = ui.thoughtTitlesDesc || initialPack.titlesDesc;

    const syncTitlesUi = () => {
      const pack = getPack();
      const on = Boolean(state.translateTitles);
      guard(() => {
        titlesLbl.textContent = ui.thoughtTitlesLabel || pack.titlesLabel;
        titlesDesc.textContent = ui.thoughtTitlesDesc || pack.titlesDesc;
        titlesBtn.setAttribute('aria-checked', String(on));
        setToggleAttr(titlesBtn, 'data-pressed', on);
        if (on) titlesBtn.setAttribute('data-primary', '1');
        else titlesBtn.removeAttribute('data-primary');
        titlesBtn.textContent = on ? pack.toolSumOn : pack.toolSumOff;
      });
    };

    titlesBtn.addEventListener('click', (ev) => {
      if (ev && typeof ev.stopPropagation === 'function') ev.stopPropagation();
      const next = !state.translateTitles;
      state.translateTitles = next;
      state.dirtyTitles = true;
      syncTitlesUi();
      const api = resolveThoughtApi();
      if (api && typeof api.setTranslateTitles === 'function') {
        api.setTranslateTitles(next, { persistDaemon: false });
      }
      if (api && typeof api.saveConfig === 'function' && !state.busy) {
        void api.saveConfig({ translateTitles: next }).catch(() => {});
      }
    });

    titlesBar.appendChild(titlesLbl);
    titlesBar.appendChild(titlesBtn);
    titlesWrap.appendChild(titlesBar);
    titlesWrap.appendChild(titlesDesc);
    sharedMountSlot.appendChild(titlesWrap);

    // 0c) Custom Proxy URL Setting (HTTP / HTTPS / SOCKS5 / SOCKS5H + Auto / Custom / Direct mode + live validation)
    const proxyWrap = mkEl('div', 'ag-cs-thought-field');
    proxyWrap.setAttribute('data-testid', 'thought-custom-proxy-section');
    const proxyHeaderBar = mkEl('div', 'ag-cs-thought-bar');
    const proxyLbl = mkEl('span', 'ag-cs-thought-label');
    proxyLbl.textContent = ui.thoughtProxyLabel || initialPack.proxyLabel;
    const proxyModeGrp = mkEl(
      'div',
      'inline-flex items-center rounded-lg border border-border bg-secondary/20 p-0.5 gap-0.5 select-none min-h-8'
    );
    proxyModeGrp.setAttribute('role', 'group');
    proxyModeGrp.setAttribute('data-testid', 'thought-proxy-mode-group');

    const proxyModeBtns = new Map();
    const getProxyModeLabel = (mid, pack) => {
      if (mid === 'custom') return pack.proxyModeCustom;
      if (mid === 'direct') return pack.proxyModeDirect;
      return pack.proxyModeAuto;
    };

    const proxyInputRow = mkEl('div', 'ag-cs-thought-input-row');
    const proxyInput = doc.createElement('input');
    proxyInput.type = 'text';
    proxyInput.className = 'ag-cs-thought-input';
    proxyInput.setAttribute('data-mono', '1');
    proxyInput.setAttribute('dir', 'ltr');
    proxyInput.setAttribute('data-ag-ltr', '1');
    proxyInput.setAttribute('data-testid', 'thought-custom-proxy-url');
    proxyInput.placeholder = 'http://127.0.0.1:7890 | socks5://127.0.0.1:1080';

    const clearProxyBtn = doc.createElement('button');
    clearProxyBtn.type = 'button';
    clearProxyBtn.className = 'ag-cs-thought-btn';
    clearProxyBtn.setAttribute('data-testid', 'thought-clear-proxy-btn');
    clearProxyBtn.textContent = initialPack.proxyClearBtn;
    clearProxyBtn.hidden = true;
    if (clearProxyBtn.style) clearProxyBtn.style.display = 'none';

    const proxyHintEl = mkEl('p', 'ag-cs-thought-hint');
    proxyHintEl.setAttribute('data-testid', 'thought-custom-proxy-hint');
    proxyHintEl.textContent = initialPack.proxyHintAuto;

    const syncProxyUi = () => {
      const pack = getPack();
      const rawVal = String(state.customProxyUrl || '').trim();
      const check = validateCustomProxyInput(rawVal, state.savedMaskedProxy);
      guard(() => {
        proxyLbl.textContent = ui.thoughtProxyLabel || pack.proxyLabel;
        clearProxyBtn.textContent = pack.proxyClearBtn;
        for (const [mid, btn] of proxyModeBtns.entries()) {
          const on = state.proxyMode === mid;
          btn.setAttribute('aria-pressed', String(on));
          setToggleAttr(btn, 'data-pressed', on);
          btn.textContent = getProxyModeLabel(mid, pack);
        }
        if (proxyInput.value !== state.customProxyUrl) proxyInput.value = state.customProxyUrl;
        const isDirect = state.proxyMode === 'direct';
        proxyInput.disabled = isDirect;
        const showClear = Boolean(rawVal && !isDirect);
        clearProxyBtn.hidden = !showClear;
        if (clearProxyBtn.style) clearProxyBtn.style.display = showClear ? '' : 'none';

        if (isDirect) {
          proxyHintEl.setAttribute('data-state', 'idle');
          proxyHintEl.textContent = pack.proxyHintDirect;
          if (proxyHintEl.style) proxyHintEl.style.color = '';
        } else if (state.proxyMode === 'auto' || !rawVal) {
          proxyHintEl.setAttribute('data-state', 'idle');
          proxyHintEl.textContent = pack.proxyHintAuto;
          if (proxyHintEl.style) proxyHintEl.style.color = '';
        } else if (check.ok) {
          proxyHintEl.setAttribute('data-state', 'ok');
          proxyHintEl.textContent = check.savedAuth || state.hasProxyCredentials ? pack.proxyHintSavedAuth : pack.proxyHintValid;
          if (proxyHintEl.style) proxyHintEl.style.color = 'var(--success, #50A37B)';
        } else {
          proxyHintEl.setAttribute('data-state', 'err');
          proxyHintEl.textContent = pack.proxyHintInvalid;
          if (proxyHintEl.style) proxyHintEl.style.color = 'var(--error, #E5534B)';
        }
      });
    };

    for (const mid of ['auto', 'custom', 'direct']) {
      const pb = doc.createElement('button');
      pb.type = 'button';
      pb.className = btnClass;
      pb.textContent = getProxyModeLabel(mid, initialPack);
      pb.setAttribute('data-proxy-mode', mid);
      pb.addEventListener('click', (ev) => {
        if (ev && typeof ev.stopPropagation === 'function') ev.stopPropagation();
        state.proxyMode = mid;
        syncProxyUi();
      });
      proxyModeBtns.set(mid, pb);
      proxyModeGrp.appendChild(pb);
    }

    proxyInput.addEventListener('input', () => {
      state.customProxyUrl = proxyInput.value;
      if (state.customProxyUrl.trim() && state.proxyMode !== 'custom') {
        state.proxyMode = 'custom';
      }
      if (state.customProxyUrl.trim() !== state.savedMaskedProxy) {
        state.hasProxyCredentials = false;
      }
      syncProxyUi();
    });

    clearProxyBtn.addEventListener('click', (ev) => {
      if (ev && typeof ev.stopPropagation === 'function') ev.stopPropagation();
      state.customProxyUrl = '';
      state.savedMaskedProxy = '';
      state.hasProxyCredentials = false;
      if (state.proxyMode === 'custom') state.proxyMode = 'auto';
      syncProxyUi();
    });

    proxyHeaderBar.appendChild(proxyLbl);
    proxyHeaderBar.appendChild(proxyModeGrp);
    proxyInputRow.appendChild(proxyInput);
    proxyInputRow.appendChild(clearProxyBtn);
    proxyWrap.appendChild(proxyHeaderBar);
    proxyWrap.appendChild(proxyInputRow);
    proxyWrap.appendChild(proxyHintEl);
    sharedMountSlot.appendChild(proxyWrap);

    // 1) Style Preset Bar + Conditional Local Custom Prompt Textarea
    const styleBar = mkEl('div', 'ag-cs-thought-bar');
    const styleLbl = mkEl('span', 'ag-cs-thought-label');
    styleLbl.textContent = ui.thoughtStyleLabel || initialPack.styleLabel;
    const styleGrp = mkEl(
      'div',
      'inline-flex items-center rounded-lg border border-border bg-secondary/20 p-0.5 gap-0.5 select-none min-h-8'
    );
    styleGrp.setAttribute('role', 'group');

    const getStyleLabel = (sid, pack) => {
      if (sid === 'concise') return ui.optStyleConcise || pack.optConcise;
      if (sid === 'custom') return ui.optStyleCustom || pack.optCustom;
      return ui.optStyleTech || pack.optTech;
    };

    const styleBtns = new Map();

    const customField = mkEl('div', 'ag-cs-thought-field');
    const customTa = doc.createElement('textarea');
    customTa.className = 'ag-cs-thought-textarea';
    customTa.setAttribute('data-testid', 'thought-custom-prompt');
    customTa.placeholder = ui.thoughtCustomPromptPh || initialPack.customPromptPh;
    customTa.addEventListener('input', () => {
      state.customPrompt = customTa.value;
    });
    customField.appendChild(customTa);

    const syncStyleUi = () => {
      guard(() => {
        const pack = getPack();
        for (const [sid, btn] of styleBtns.entries()) {
          const on = state.stylePreset === sid;
          btn.setAttribute('aria-pressed', String(on));
          setToggleAttr(btn, 'data-pressed', on);
          btn.textContent = getStyleLabel(sid, pack);
        }
        customField.hidden = state.stylePreset !== 'custom';
        if (customTa.value !== state.customPrompt) customTa.value = state.customPrompt;
      });
    };

    for (const sid of ['technical', 'concise', 'custom']) {
      const sb = doc.createElement('button');
      sb.type = 'button';
      sb.className = btnClass;
      sb.textContent = getStyleLabel(sid, initialPack);
      sb.setAttribute('data-thought-style', sid);
      sb.addEventListener('click', (ev) => {
        if (ev && typeof ev.stopPropagation === 'function') ev.stopPropagation();
        state.stylePreset = sid;
        syncStyleUi();
      });
      styleBtns.set(sid, sb);
      styleGrp.appendChild(sb);
    }
    styleBar.appendChild(styleLbl);
    styleBar.appendChild(styleGrp);
    box.appendChild(styleBar);
    box.appendChild(customField);

    // 2) Multi-Profile Selector Pills + Add/Delete
    const profBar = mkEl('div', 'ag-cs-thought-bar');
    const profLbl = mkEl('span', 'ag-cs-thought-label');
    profLbl.textContent = ui.thoughtProfilesLabel || initialPack.profilesLabel;
    const profPills = mkEl('div', 'ag-cs-thought-profiles');
    profBar.appendChild(profLbl);
    profBar.appendChild(profPills);
    box.appendChild(profBar);

    // 3) 2x2 Form Grid: Name, Base URL, API Key, Model + Fetch Models
    const grid = mkEl('div', 'ag-cs-thought-grid');

    const mkField = (labelText, inputEl, extraRightEl) => {
      const wrap = mkEl('div', 'ag-cs-thought-field');
      const lbl = doc.createElement('label');
      const lblSpan = doc.createElement('span');
      lblSpan.textContent = labelText;
      lbl.appendChild(lblSpan);
      if (extraRightEl) lbl.appendChild(extraRightEl);
      wrap.appendChild(lbl);
      wrap.appendChild(inputEl);
      return { wrap, lblSpan };
    };

    const nameInput = doc.createElement('input');
    nameInput.type = 'text';
    nameInput.className = 'ag-cs-thought-input';
    nameInput.setAttribute('data-testid', 'thought-prof-name');
    nameInput.placeholder = initialPack.fieldNamePh;

    const urlInput = doc.createElement('input');
    urlInput.type = 'text';
    urlInput.className = 'ag-cs-thought-input';
    urlInput.setAttribute('data-mono', '1');
    urlInput.setAttribute('dir', 'ltr');
    urlInput.setAttribute('data-ag-ltr', '1');
    urlInput.setAttribute('data-testid', 'thought-base-url');
    urlInput.placeholder = 'https://api.openai.com/v1';

    const keyRightWrap = mkEl('span', 'inline-flex items-center gap-1.5');
    const keyMetaBadge = mkEl('span', 'text-[11px] opacity-80');
    const clearKeyBtn = doc.createElement('button');
    clearKeyBtn.type = 'button';
    clearKeyBtn.className = 'ag-cs-thought-btn';
    clearKeyBtn.setAttribute('data-testid', 'thought-clear-key-btn');
    clearKeyBtn.hidden = true;
    if (clearKeyBtn.style) {
      clearKeyBtn.style.display = 'none';
      clearKeyBtn.style.fontSize = '10.5px';
      clearKeyBtn.style.padding = '0 5px';
      clearKeyBtn.style.minHeight = '18px';
      clearKeyBtn.style.lineHeight = '16px';
    }
    clearKeyBtn.textContent = initialPack.clearKeyBtn;
    keyRightWrap.appendChild(keyMetaBadge);
    keyRightWrap.appendChild(clearKeyBtn);

    const keyInput = doc.createElement('input');
    keyInput.type = 'password';
    keyInput.autocomplete = 'off';
    keyInput.className = 'ag-cs-thought-input';
    keyInput.setAttribute('data-mono', '1');
    keyInput.setAttribute('dir', 'ltr');
    keyInput.setAttribute('data-ag-ltr', '1');
    keyInput.setAttribute('data-testid', 'thought-api-key');
    keyInput.placeholder = 'sk-...';

    const modelRow = mkEl('div', 'ag-cs-thought-input-row');
    const modelInput = doc.createElement('input');
    modelInput.type = 'text';
    modelInput.className = 'ag-cs-thought-input';
    modelInput.setAttribute('data-mono', '1');
    modelInput.setAttribute('dir', 'ltr');
    modelInput.setAttribute('data-ag-ltr', '1');
    modelInput.setAttribute('data-testid', 'thought-model-input');
    modelInput.placeholder = 'gpt-4o-mini';

    const fetchModelsBtn = doc.createElement('button');
    fetchModelsBtn.type = 'button';
    fetchModelsBtn.className = 'ag-cs-thought-btn';
    fetchModelsBtn.setAttribute('data-testid', 'thought-fetch-models-btn');
    fetchModelsBtn.textContent = ui.thoughtFetchModelsBtn || initialPack.fetchModels;
    modelRow.appendChild(modelInput);
    modelRow.appendChild(fetchModelsBtn);

    const modelSelectWrap = mkEl('div', 'ag-cs-thought-field');
    modelSelectWrap.setAttribute('data-span', '2');
    modelSelectWrap.hidden = true;
    const modelSelect = doc.createElement('select');
    modelSelect.className = 'ag-cs-thought-select';
    modelSelect.setAttribute('data-testid', 'thought-model-select');
    modelSelectWrap.appendChild(modelSelect);

    const nameField = mkField(ui.thoughtFieldName || initialPack.fieldName, nameInput);
    const urlField = mkField(ui.thoughtFieldBaseUrl || 'Base URL', urlInput);
    const keyField = mkField(ui.thoughtFieldApiKey || 'API Key', keyInput, keyRightWrap);
    const modelField = mkField(ui.thoughtFieldModel || 'Model ID', modelRow);

    grid.appendChild(nameField.wrap);
    grid.appendChild(urlField.wrap);
    grid.appendChild(keyField.wrap);
    grid.appendChild(modelField.wrap);
    grid.appendChild(modelSelectWrap);
    box.appendChild(grid);

    // 4) Action Buttons + Dual-End Cache Stats / Clear + Live Status Badge
    const actRow = mkEl('div', 'ag-cs-thought-actions');
    const btnGrp = mkEl('div', 'ag-cs-thought-btn-group');

    const saveBtn = doc.createElement('button');
    saveBtn.type = 'button';
    saveBtn.className = 'ag-cs-thought-btn';
    saveBtn.setAttribute('data-primary', '1');
    saveBtn.setAttribute('data-testid', 'thought-save-btn');
    saveBtn.textContent = ui.thoughtSaveBtn || initialPack.saveBtn;

    const testBtn = doc.createElement('button');
    testBtn.type = 'button';
    testBtn.className = 'ag-cs-thought-btn';
    testBtn.setAttribute('data-testid', 'thought-test-btn');
    testBtn.textContent = ui.thoughtTestBtn || initialPack.testBtn;

    const clearCacheBtn = doc.createElement('button');
    clearCacheBtn.type = 'button';
    clearCacheBtn.className = 'ag-cs-thought-btn';
    clearCacheBtn.setAttribute('data-testid', 'thought-clear-cache-btn');
    clearCacheBtn.textContent = ui.thoughtClearCacheBtn || initialPack.clearCacheBtn;

    const cacheStatsBadge = mkEl('span', 'ag-cs-thought-cache-badge');
    cacheStatsBadge.setAttribute('data-testid', 'thought-cache-stats');
    if (cacheStatsBadge.style) {
      cacheStatsBadge.style.fontSize = '11px';
      cacheStatsBadge.style.opacity = '0.75';
      cacheStatsBadge.style.alignSelf = 'center';
      cacheStatsBadge.style.padding = '0 4px';
    }
    cacheStatsBadge.textContent = initialPack.cacheBadge(0);

    btnGrp.appendChild(saveBtn);
    btnGrp.appendChild(testBtn);
    btnGrp.appendChild(clearCacheBtn);
    btnGrp.appendChild(cacheStatsBadge);

    const statusBadge = mkEl('span', 'ag-cs-thought-status');
    statusBadge.setAttribute('data-testid', 'thought-status-badge');
    statusBadge.hidden = true;

    actRow.appendChild(btnGrp);
    actRow.appendChild(statusBadge);
    box.appendChild(actRow);

    const privHint = mkEl('p', 'ag-cs-thought-hint');
    privHint.textContent = ui.thoughtPrivacyHint || initialPack.privacyHint;
    box.appendChild(privHint);

    const setStatus = (kind, msg) => {
      guard(() => {
        if (!msg) {
          statusBadge.hidden = true;
          statusBadge.textContent = '';
          return;
        }
        statusBadge.hidden = false;
        statusBadge.setAttribute('data-state', kind);
        statusBadge.textContent = msg;
        statusBadge.title = msg;
      });
    };

    const renderCacheBadge = (count, detailTitle = '') => {
      const n = Math.max(0, Number(count) || 0);
      state.cacheCount = n;
      state.cacheDetailText = detailTitle || '';
      const pack = getPack();
      guard(() => {
        cacheStatsBadge.textContent =
          typeof ui.thoughtCacheBadgeFmt === 'function' ? ui.thoughtCacheBadgeFmt(n) : pack.cacheBadge(n);
        cacheStatsBadge.title = state.cacheDetailText;
      });
    };

    const refreshCacheStats = () => {
      const api = resolveThoughtApi();
      const localStats =
        api && typeof api.getLocalCacheStats === 'function' ? api.getLocalCacheStats() : { memEntries: 0 };
      const localCount = Number(localStats?.memEntries) || 0;
      const rpcCall = resolveThoughtRpcCall();
      if (!rpcCall) {
        renderCacheBadge(localCount);
        return Promise.resolve({ ok: true, localOnly: true, count: localCount });
      }
      return Promise.resolve()
        .then(() => rpcCall({ action: 'cache-stats' }))
        .then((res) => {
          const daemonCount =
            res && res.ok && typeof (res.entries ?? res.count) === 'number'
              ? Number(res.entries ?? res.count)
              : null;
          if (daemonCount !== null) {
            const total = Math.max(localCount, daemonCount);
            const kb = res.diskBytes ? `${(res.diskBytes / 1024).toFixed(1)} KB` : '';
            const pack = getPack();
            const detail = pack.cacheDetail(localCount, daemonCount, kb);
            renderCacheBadge(total, detail);
            return { ok: true, localOnly: false, count: total };
          }
          renderCacheBadge(localCount);
          return { ok: true, localOnly: true, count: localCount };
        })
        .catch(() => {
          renderCacheBadge(localCount);
          return { ok: true, localOnly: true, count: localCount };
        });
    };

    const getActiveProfile = () => state.profiles.find((p) => p.id === state.activeProfileId) || state.profiles[0];

    const syncKeyHintForUrl = (cur) => {
      if (!cur) return;
      const pack = getPack();
      guard(() => {
        const showClearBtn = Boolean(cur.hasApiKey && !cur.draftKey && !cur.clearSavedKey);
        clearKeyBtn.hidden = !showClearBtn;
        if (clearKeyBtn.style) clearKeyBtn.style.display = showClearBtn ? '' : 'none';
        clearKeyBtn.textContent = ui.thoughtClearKeyBtn || pack.clearKeyBtn;

        if (cur.clearSavedKey && !cur.draftKey) {
          keyInput.placeholder = isLocalKeylessUrl(cur.baseUrl)
            ? ui.thoughtKeylessPh || pack.keylessPh
            : 'sk-...';
          keyMetaBadge.textContent = pack.keyClearedBadge;
        } else if (cur.hasApiKey && cur.maskedKey && !cur.draftKey) {
          keyInput.placeholder = pack.savedKeyPh(cur.maskedKey);
          keyMetaBadge.textContent = `✓ ${cur.maskedKey}`;
        } else if (!cur.draftKey && isLocalKeylessUrl(cur.baseUrl)) {
          keyInput.placeholder = ui.thoughtKeylessPh || pack.keylessPh;
          keyMetaBadge.textContent = ui.thoughtKeylessBadge || pack.keylessBadge;
        } else {
          keyInput.placeholder = 'sk-...';
          keyMetaBadge.textContent = '';
        }
      });
    };

    clearKeyBtn.addEventListener('click', (ev) => {
      if (ev && typeof ev.stopPropagation === 'function') ev.stopPropagation();
      const cur = getActiveProfile();
      if (!cur) return;
      cur.clearSavedKey = true;
      cur.draftKey = '';
      keyInput.value = '';
      syncKeyHintForUrl(cur);
    });

    const syncFormIntoProfile = () => {
      const cur = getActiveProfile();
      if (!cur) return;
      cur.name = nameInput.value.trim() || cur.name || 'Profile';
      cur.baseUrl = urlInput.value.trim() || 'https://api.openai.com/v1';
      cur.model = modelInput.value.trim();
      if (keyInput.value.trim()) {
        cur.draftKey = keyInput.value.trim();
      }
    };

    const renderProfilePillsAndForm = () => {
      const pack = getPack();
      guard(() => {
        while (profPills.firstChild) profPills.removeChild(profPills.firstChild);
        for (const p of state.profiles) {
          const chip = doc.createElement('button');
          chip.type = 'button';
          chip.className = 'ag-cs-thought-prof-chip';
          chip.setAttribute('data-profile-id', p.id);
          chip.setAttribute('data-active', p.id === state.activeProfileId ? '1' : '0');
          chip.textContent = p.name || p.id;
          chip.addEventListener('click', (ev) => {
            if (ev && typeof ev.stopPropagation === 'function') ev.stopPropagation();
            syncFormIntoProfile();
            state.activeProfileId = p.id;
            state.fetchedModels = [];
            modelSelectWrap.hidden = true;
            renderProfilePillsAndForm();
          });
          profPills.appendChild(chip);
        }

        const addBtn = doc.createElement('button');
        addBtn.type = 'button';
        addBtn.className = 'ag-cs-thought-btn';
        addBtn.setAttribute('data-testid', 'thought-add-profile-btn');
        addBtn.textContent = ui.thoughtAddProfileBtn || pack.addProfile;
        addBtn.addEventListener('click', (ev) => {
          if (ev && typeof ev.stopPropagation === 'function') ev.stopPropagation();
          syncFormIntoProfile();
          const curPack = getPack();
          const nextNum = state.profiles.length + 1;
          const newId = `prof_${Date.now().toString(36)}_${nextNum}`;
          state.profiles.push({
            id: newId,
            name: `${curPack.customProfPrefix} ${nextNum}`,
            baseUrl: 'https://api.openai.com/v1',
            model: 'gpt-4o-mini',
            hasApiKey: false,
            maskedKey: '',
            draftKey: '',
          });
          state.activeProfileId = newId;
          state.fetchedModels = [];
          modelSelectWrap.hidden = true;
          renderProfilePillsAndForm();
        });
        profPills.appendChild(addBtn);

        if (state.profiles.length > 1) {
          const delBtn = doc.createElement('button');
          delBtn.type = 'button';
          delBtn.className = 'ag-cs-thought-btn';
          delBtn.setAttribute('data-danger', '1');
          delBtn.setAttribute('data-testid', 'thought-del-profile-btn');
          delBtn.textContent = ui.thoughtDelProfileBtn || pack.delProfile;
          delBtn.addEventListener('click', (ev) => {
            if (ev && typeof ev.stopPropagation === 'function') ev.stopPropagation();
            if (state.profiles.length <= 1) return;
            state.profiles = state.profiles.filter((item) => item.id !== state.activeProfileId);
            state.activeProfileId = state.profiles[0].id;
            renderProfilePillsAndForm();
          });
          profPills.appendChild(delBtn);
        }

        const cur = getActiveProfile();
        if (cur) {
          nameInput.value = cur.name || '';
          urlInput.value = cur.baseUrl || 'https://api.openai.com/v1';
          modelInput.value = cur.model || '';
          keyInput.value = cur.draftKey || '';
          syncKeyHintForUrl(cur);
        }
      });
    };

    const refreshStaticLabels = () => {
      const pack = getPack();
      guard(() => {
        applyBoxDirection(box);
        if (machineBox) applyBoxDirection(machineBox);
        viewLbl.textContent = ui.thoughtViewLabel || ui.thoughtViewTitle || pack.viewLabel;
        styleLbl.textContent = ui.thoughtStyleLabel || pack.styleLabel;
        customTa.placeholder = ui.thoughtCustomPromptPh || pack.customPromptPh;
        profLbl.textContent = ui.thoughtProfilesLabel || pack.profilesLabel;
        nameField.lblSpan.textContent = ui.thoughtFieldName || pack.fieldName;
        nameInput.placeholder = pack.fieldNamePh;
        fetchModelsBtn.textContent = ui.thoughtFetchModelsBtn || pack.fetchModels;
        saveBtn.textContent = ui.thoughtSaveBtn || pack.saveBtn;
        testBtn.textContent = ui.thoughtTestBtn || pack.testBtn;
        clearCacheBtn.textContent = ui.thoughtClearCacheBtn || pack.clearCacheBtn;
        privHint.textContent = ui.thoughtPrivacyHint || pack.privacyHint;
      });
      syncUsageBanner();
      syncViewModeUi();
      syncToolSumUi();
      syncTitlesUi();
      syncProxyUi();
      syncStyleUi();
      renderProfilePillsAndForm();
      renderCacheBadge(state.cacheCount, state.cacheDetailText);
    };

    nameInput.addEventListener('input', () => {
      const cur = getActiveProfile();
      if (cur) {
        cur.name = nameInput.value;
        const activeChip =
          profPills.querySelector && profPills.querySelector(`[data-profile-id="${cur.id}"]`);
        if (activeChip) activeChip.textContent = cur.name.trim() || cur.id;
      }
    });
    urlInput.addEventListener('input', () => {
      const cur = getActiveProfile();
      if (cur) {
        cur.baseUrl = urlInput.value;
        syncKeyHintForUrl(cur);
      }
    });
    modelInput.addEventListener('input', () => {
      const cur = getActiveProfile();
      if (cur) cur.model = modelInput.value;
    });
    keyInput.addEventListener('input', () => {
      const cur = getActiveProfile();
      if (cur) {
        cur.draftKey = keyInput.value;
        if (cur.draftKey.trim()) cur.clearSavedKey = false;
        syncKeyHintForUrl(cur);
      }
    });
    modelSelect.addEventListener('change', () => {
      if (modelSelect.value) {
        modelInput.value = modelSelect.value;
        const cur = getActiveProfile();
        if (cur) cur.model = modelSelect.value;
      }
    });

    const syncActionButtons = () => {
      const waitingLoad = hasThoughtBridge() && !state.loaded;
      guard(() => {
        saveBtn.disabled = state.busy || waitingLoad;
        testBtn.disabled = state.busy || waitingLoad;
      });
    };

    const applySanitizedConfig = (res, opts = {}) => {
      if (!res || !res.ok) return;
      const fromSave = Boolean(opts && opts.fromSave);
      state.loaded = true;
      const mappedPreset = res.stylePreset === 'tech' ? 'technical' : res.stylePreset;
      state.stylePreset = ['technical', 'concise', 'custom'].includes(mappedPreset) ? mappedPreset : 'technical';
      const hostView = resolveHostPrism()?.getState?.()?.cfg?.thoughtView;
      const api = resolveThoughtApi();
      const clientView = api && typeof api.getViewMode === 'function' ? api.getViewMode() : null;
      if (hostView === 'bilingual' || hostView === 'immersive') {
        state.viewMode = hostView;
      } else if (res.viewMode === 'bilingual' || res.viewMode === 'immersive') {
        state.viewMode = clientView || res.viewMode;
      }
      state.customPrompt = typeof res.customPrompt === 'string' ? res.customPrompt : '';
      if (['auto', 'custom', 'direct'].includes(res.proxyMode)) {
        state.proxyMode = res.proxyMode;
      }
      if (typeof res.customProxyUrl === 'string') {
        state.customProxyUrl = res.customProxyUrl;
        state.savedMaskedProxy = res.hasProxyCredentials ? res.customProxyUrl : '';
      }
      state.hasProxyCredentials = Boolean(res.hasProxyCredentials);
      if (typeof res.translateToolSummaries === 'boolean' && (fromSave || !state.dirtyToolSum)) {
        state.translateToolSummaries = res.translateToolSummaries;
        if (fromSave) state.dirtyToolSum = false;
      }
      if (typeof res.translateTitles === 'boolean' && (fromSave || !state.dirtyTitles)) {
        state.translateTitles = res.translateTitles;
        if (fromSave) state.dirtyTitles = false;
      }
      if (Array.isArray(res.profiles) && res.profiles.length > 0) {
        state.profiles = res.profiles.map((p) => ({
          id: p.id,
          name: p.name,
          baseUrl: p.baseUrl,
          model: p.model,
          hasApiKey: Boolean(p.hasApiKey),
          maskedKey: p.maskedKey || '',
          draftKey: '',
          clearSavedKey: false,
        }));
      }
      state.activeProfileId = state.profiles.some((p) => p.id === res.activeProfileId)
        ? res.activeProfileId
        : state.profiles[0].id;
      syncViewModeUi();
      syncToolSumUi();
      syncTitlesUi();
      syncProxyUi();
      syncStyleUi();
      renderProfilePillsAndForm();
      syncActionButtons();
    };

    const buildSavePayload = () => {
      syncFormIntoProfile();
      const trimmedProxy = String(state.customProxyUrl || '').trim();
      const includeProxyUrl =
        state.proxyMode === 'custom' ||
        !trimmedProxy ||
        validateCustomProxyInput(trimmedProxy, state.savedMaskedProxy).ok;
      const payload = {
        stylePreset: state.stylePreset,
        viewMode: state.viewMode,
        customPrompt: state.customPrompt,
        proxyMode: state.proxyMode,
        translateToolSummaries: Boolean(state.translateToolSummaries),
        translateTitles: Boolean(state.translateTitles),
        activeProfileId: state.activeProfileId,
        profiles: state.profiles.map((p) => ({
          id: p.id,
          name: p.name,
          baseUrl: p.baseUrl,
          model: p.model,
          apiKey: p.draftKey || '',
          keepExistingKey: Boolean(!p.draftKey && !p.clearSavedKey),
        })),
      };
      if (includeProxyUrl) {
        payload.customProxyUrl = trimmedProxy;
      }
      return payload;
    };

    const ensureConfigLoaded = () => {
      if (state.loaded) return Promise.resolve({ ok: true });
      if (loadConfigPromise) return loadConfigPromise;
      const api = resolveThoughtApi();
      if (!api || typeof api.getConfig !== 'function') {
        return Promise.resolve({ ok: false });
      }
      loadConfigPromise = Promise.resolve()
        .then(() => api.getConfig())
        .then((res) => {
          if (res && res.ok) applySanitizedConfig(res);
          else syncActionButtons();
          return res || { ok: false };
        })
        .catch(() => {
          syncActionButtons();
          return { ok: false };
        })
        .finally(() => {
          loadConfigPromise = null;
        });
      return loadConfigPromise;
    };

    const reloadConfig = () => {
      state.loaded = false;
      loadConfigPromise = null;
      state.dirtyToolSum = false;
      state.dirtyTitles = false;
      syncUsageBanner();
      syncActionButtons();
      const hostView = resolveHostPrism()?.getState?.()?.cfg?.thoughtView;
      if (hostView === 'bilingual' || hostView === 'immersive') {
        state.viewMode = hostView;
        syncViewModeUi();
      }
      void refreshCacheStats();
      return ensureConfigLoaded();
    };

    const ensureLoaded = () => {
      syncUsageBanner();
      syncActionButtons();
      const hostView = resolveHostPrism()?.getState?.()?.cfg?.thoughtView;
      if (hostView === 'bilingual' || hostView === 'immersive') {
        state.viewMode = hostView;
        syncViewModeUi();
      }
      void refreshCacheStats();
      if (state.loaded) return;
      void ensureConfigLoaded();
    };

    fetchModelsBtn.addEventListener('click', (ev) => {
      if (ev && typeof ev.stopPropagation === 'function') ev.stopPropagation();
      const api = resolveThoughtApi();
      if (!api || typeof api.fetchModels !== 'function' || state.busy) return;
      syncFormIntoProfile();
      const cur = getActiveProfile();
      const pack = getPack();
      if (state.proxyMode === 'custom' && !validateCustomProxyInput(state.customProxyUrl, state.savedMaskedProxy).ok) {
        setStatus('err', pack.proxyHintInvalid);
        return;
      }
      state.busy = true;
      fetchModelsBtn.disabled = true;
      syncActionButtons();
      setStatus('idle', pack.fetchingModels);
      void api
        .fetchModels({
          profileId: cur?.id,
          baseUrl: cur?.baseUrl,
          apiKey: cur?.draftKey || '',
          proxyMode: state.proxyMode,
          customProxyUrl: state.proxyMode === 'custom' ? String(state.customProxyUrl || '').trim() : '',
        })
        .then((res) => {
          const curPack = getPack();
          if (res && res.ok && Array.isArray(res.models)) {
            state.fetchedModels = res.models;
            guard(() => {
              while (modelSelect.firstChild) modelSelect.removeChild(modelSelect.firstChild);
              const placeholderOpt = doc.createElement('option');
              placeholderOpt.value = '';
              placeholderOpt.textContent = curPack.quickSelect(res.models.length);
              modelSelect.appendChild(placeholderOpt);
              for (const mid of res.models) {
                const opt = doc.createElement('option');
                opt.value = mid;
                opt.textContent = mid;
                if (cur && cur.model === mid) opt.selected = true;
                modelSelect.appendChild(opt);
              }
              modelSelectWrap.hidden = res.models.length === 0;
              if (
                res.models.length > 0 &&
                (!cur.model || cur.model === 'gpt-4o-mini') &&
                !res.models.includes(cur.model)
              ) {
                cur.model = res.models[0];
                modelInput.value = res.models[0];
              }
            });
            setStatus('ok', curPack.fetchOk(res.models.length, res.latencyMs || 0));
          } else {
            setStatus('err', `✕ ${res?.error || curPack.fetchErr}`);
          }
        })
        .finally(() => {
          state.busy = false;
          if (fetchModelsBtn.isConnected !== false) fetchModelsBtn.disabled = false;
          syncActionButtons();
        });
    });

    // Notify any mounted prompt-suggester settings card in the same window to reload shared profiles and avoid stale credential overwrites
    const notifyPeerSuggesterUi = () => {
      try {
        const sgUi =
          (typeof window !== 'undefined' && window.__agPrismSuggesterSettingsUi) ||
          G.__agPrismSuggesterSettingsUi ||
          null;
        sgUi?.reloadProfiles?.();
      } catch {}
    };

    saveBtn.addEventListener('click', (ev) => {
      if (ev && typeof ev.stopPropagation === 'function') ev.stopPropagation();
      const api = resolveThoughtApi();
      if (!api || typeof api.saveConfig !== 'function' || state.busy) return;
      if (hasThoughtBridge() && !state.loaded) return;
      const pack = getPack();
      if (state.proxyMode === 'custom' && !validateCustomProxyInput(state.customProxyUrl, state.savedMaskedProxy).ok) {
        setStatus('err', pack.proxyHintInvalid);
        return;
      }
      state.busy = true;
      syncActionButtons();
      setStatus('idle', pack.savingCfg);
      void api
        .saveConfig(buildSavePayload())
        .then((res) => {
          const curPack = getPack();
          if (res && res.ok) {
            applySanitizedConfig(res, { fromSave: true });
            const cur = getActiveProfile();
            setStatus('ok', curPack.saveOk(cur?.name, cur?.model));
            try {
              api.scan?.();
            } catch {}
            notifyPeerSuggesterUi();
          } else {
            setStatus('err', `✕ ${res?.error || curPack.saveErr}`);
          }
        })
        .finally(() => {
          state.busy = false;
          syncActionButtons();
        });
    });

    testBtn.addEventListener('click', (ev) => {
      if (ev && typeof ev.stopPropagation === 'function') ev.stopPropagation();
      const api = resolveThoughtApi();
      if (!api || typeof api.testConnection !== 'function' || state.busy) return;
      if (hasThoughtBridge() && !state.loaded) return;
      const pack = getPack();
      if (state.proxyMode === 'custom' && !validateCustomProxyInput(state.customProxyUrl, state.savedMaskedProxy).ok) {
        setStatus('err', pack.proxyHintInvalid);
        return;
      }
      state.busy = true;
      syncActionButtons();
      setStatus('idle', pack.testingConn);
      const payload = buildSavePayload();
      void api
        .saveConfig(payload)
        .then((savedRes) => {
          if (savedRes && savedRes.ok) {
            applySanitizedConfig(savedRes, { fromSave: true });
            notifyPeerSuggesterUi();
          }
          const cur = getActiveProfile();
          return api.testConnection({
            profileId: cur?.id,
            baseUrl: cur?.baseUrl,
            model: cur?.model,
            proxyMode: state.proxyMode,
            customProxyUrl: state.proxyMode === 'custom' ? String(state.customProxyUrl || '').trim() : '',
          });
        })
        .then((res) => {
          const curPack = getPack();
          if (res && res.ok) {
            setStatus('ok', curPack.testOk(res.latencyMs, res.model, res.reply));
          } else {
            setStatus('err', `✕ ${res?.error || curPack.testErr}`);
          }
        })
        .finally(() => {
          state.busy = false;
          syncActionButtons();
        });
    });

    clearCacheBtn.addEventListener('click', (ev) => {
      if (ev && typeof ev.stopPropagation === 'function') ev.stopPropagation();
      if (state.busy) return;
      state.busy = true;
      clearCacheBtn.disabled = true;

      const api = resolveThoughtApi();
      if (api && typeof api.clearLocalCache === 'function') {
        api.clearLocalCache();
      }

      const rpcCall = resolveThoughtRpcCall();
      const daemonClear = rpcCall
        ? Promise.resolve()
            .then(() => rpcCall({ action: 'clear-cache' }))
            .catch(() => ({ ok: false, offline: true }))
        : Promise.resolve({ ok: false, offline: true });

      void daemonClear
        .then((res) => {
          const curPack = getPack();
          renderCacheBadge(0);
          if (res && res.ok) {
            setStatus('ok', curPack.clearDualOk);
          } else {
            setStatus('ok', curPack.clearLocalOk);
          }
        })
        .finally(() => {
          state.busy = false;
          if (clearCacheBtn.isConnected !== false) clearCacheBtn.disabled = false;
        });
    });

    let machineBox = null;
    const syncModeLayout = (nextMode) => {
      guard(() => {
        box.hidden = nextMode !== 'ai';
        const hostParent = box.parentElement || null;
        if (nextMode === 'machine' && hostParent && typeof hostParent.appendChild === 'function') {
          if (!machineBox) {
            machineBox = mkEl('div', 'ag-cs-thought-cfg-box');
            machineBox.setAttribute('data-testid', 'prism-thought-general-config');
            applyNoTranslateAttrs(machineBox);
            applyBoxDirection(machineBox);
          } else {
            applyBoxDirection(machineBox);
          }
          if (machineBox.parentElement !== hostParent) {
            hostParent.appendChild(machineBox);
          }
          machineBox.hidden = false;
          if (sharedMountSlot.parentElement !== machineBox) machineBox.appendChild(sharedMountSlot);
          if (actRow.parentElement !== machineBox) machineBox.appendChild(actRow);
          testBtn.hidden = true;
          if (testBtn.style) testBtn.style.display = 'none';
        } else {
          if (sharedMountSlot.parentElement !== box) {
            if (typeof box.insertBefore === 'function' && styleBar.parentElement === box) {
              box.insertBefore(sharedMountSlot, styleBar);
            } else {
              box.appendChild(sharedMountSlot);
            }
          }
          if (actRow.parentElement !== box) {
            if (typeof box.insertBefore === 'function' && privHint.parentElement === box) {
              box.insertBefore(actRow, privHint);
            } else {
              box.appendChild(actRow);
            }
          }
          testBtn.hidden = false;
          if (testBtn.style) testBtn.style.display = '';
          if (machineBox && machineBox.parentElement) {
            machineBox.remove();
          }
        }
      });
    };

    syncUsageBanner();
    syncViewModeUi();
    syncToolSumUi();
    syncTitlesUi();
    syncProxyUi();
    syncStyleUi();
    renderProfilePillsAndForm();
    syncActionButtons();
    if (!box.hidden) ensureLoaded();

    return {
      box,
      ensureLoaded,
      reloadConfig,
      refreshCacheStats,
      runDiagnostics,
      onViewSwitched(nextView) {
        if (nextView !== 'bilingual' && nextView !== 'immersive') return;
        state.viewMode = nextView;
        syncViewModeUi();
      },
      onLanguageChanged(nextLang) {
        if (nextLang) currentExplicitLang = nextLang;
        refreshStaticLabels();
      },
      onModeSwitched(nextMode) {
        syncModeLayout(nextMode);
        syncUsageBanner();
        syncActionButtons();
        if (nextMode === 'ai' || nextMode === 'machine') ensureLoaded();
      },
    };
  }

  G.__agPrismThoughtSettingsUi = { createThoughtAiConfigBox, isLocalKeylessUrl, validateCustomProxyInput };
})(typeof globalThis !== 'undefined' ? globalThis : window);
