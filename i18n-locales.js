(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.__agCsLocales = factory();
})(typeof globalThis !== 'undefined' ? globalThis : window, function () {
  const LANG_IDS = ['en', 'ar'];

  const LANG_INDEX = {
    en: 0,
    ar: 1,
  };

  function resolveLangId(lang) {
    if (Object.prototype.hasOwnProperty.call(LANG_INDEX, lang)) return lang;
    const core = typeof globalThis !== 'undefined' ? globalThis.__agCsI18nCore : null;
    if (core && typeof core.normalizeLanguage === 'function') {
      return core.normalizeLanguage(lang, 'en');
    }
    if (typeof lang !== 'string') return 'en';
    const clean = lang.trim().toLowerCase().replace(/_/g, '-').split(/[.@]/)[0];
    if (!clean) return 'en';
    if (clean === 'ar' || clean.startsWith('ar-') || clean === 'arabic' || clean === 'العربية') return 'ar';
    return 'en';
  }

  function pick(lang, arr) {
    const resolved = resolveLangId(lang);
    const idx = Object.prototype.hasOwnProperty.call(LANG_INDEX, resolved) ? LANG_INDEX[resolved] : 0;
    return arr[idx] !== undefined ? arr[idx] : arr[0];
  }

  // Unified bilingual table for Obsidian Prism UI [en, ar]
  const UI_TABLE = {
    // ── Brand Header & Collapsible Banner ────────────────────────────────────
    sectionTitle: [
      'Obsidian Prism',
      'Obsidian Prism · أوبسيديان بريزم',
    ],
    sectionSubtitle: [
      'Clean UI & Productivity Suite for Antigravity',
      'واجهة بصرية أنيقة وحزمة إنتاجية لـ Antigravity',
    ],
    foldExpandHint: [
      'Click to expand appearance & feature settings',
      'انقر لتوسيع إعدادات المظهر والميزات',
    ],
    foldCollapseHint: [
      'Click to collapse settings panel',
      'انقر لطي لوحة الإعدادات',
    ],

    // ── About, Repo Sync & Open-Source Credits ───────────────────────────────
    aboutGroupTitle: [
      'About, Updates & Open-Source Credits',
      'حول الإضافة، التحديثات والشكر للمصادر المفتوحة',
    ],
    aboutRepoSyncTitle: [
      'Git Repository Status & Sync',
      'حالة مستودع Git والمزامنة',
    ],
    aboutRepoSyncBtn: [
      'Check / Sync Git Updates',
      'فحص / مزامنة تحديثات Git',
    ],
    aboutRepoChecking: [
      'Checking Git repository status…',
      'جارٍ فحص حالة مستودع Git…',
    ],
    aboutRepoUpToDate: [
      'Repository is already up to date',
      'المستودع محدّث بالفعل إلى آخر إصدار',
    ],
    aboutRepoUpdated: [
      'Pulled latest commits & hot-reloaded UI',
      'تم سحب أحدث التعديلات وإعادة تحميل الواجهة فورياً',
    ],
    aboutRepoNoRemote: [
      'Local Git repository (no remote configured)',
      'مستودع Git محلي (لم يتم إعداد مستودع بعيد)',
    ],
    setAutoUpdateTitle: [
      'Auto Update',
      'التحديث التلقائي',
    ],
    setAutoUpdateDesc: [
      'Off by default (checks only when triggered manually); when On, checks periodically and hot-reloads.',
      'مُعطّل افتراضياً (يفحص فقط عند الطلب اليدوي)؛ عند التفعيل يفحص دورياً ويحدّث فورياً.',
    ],
    setUpdateChannelTitle: [
      'Update Channel',
      'قناة التحديثات',
    ],
    setUpdateChannelDesc: [
      'Receive stable releases only, or opt into -beta / -rc pre-releases.',
      'اختر استقبال الإصدارات المستقرة فقط أو تجربة إصدارات -beta / -rc التجريبية.',
    ],
    optChannelStable: ['Stable', 'مستقر'],
    optChannelBeta: ['Beta', 'تجريبي'],
    updCheckBtn: [
      'Check Update',
      'فحص التحديثات',
    ],
    updApplyBtn: [
      'Update Now (Hot Reload)',
      'تحديث الآن (فوري)',
    ],
    updUpToDate: [
      'Up to date v{0}',
      'محدّث v{0}',
    ],
    updAvailTpl: [
      'Update v{0} available',
      'يتوفر تحديث v{0}',
    ],
    updUpdating: [
      'Downloading & hot-reloading…',
      'جارٍ التنزيل وإعادة التحميل الفوري…',
    ],
    updHotDone: [
      'Hot-reloaded (hard reload Ctrl+R / Cmd+R or restart if core changed)',
      'تم التحديث الفوري (اضغط Ctrl+R / Cmd+R أو أعد التشغيل عند تغيّر النواة)',
    ],
    updManualHint: [
      'Download installer from Release to update to v{0}',
      'نزّل المثبّت من صفحة الإصدارات للترقية إلى v{0}',
    ],
    updHotNote: [
      'Hot reload applies immediately; core, style, or background service changes need a hard reload (Ctrl+R / Cmd+R) or Antigravity restart.',
      'يُطبَّق التحديث الفوري مباشرة؛ بعض تغييرات النواة أو التنسيق أو الخدمة الخلفية تتطلب Ctrl+R / Cmd+R أو إعادة تشغيل Antigravity.',
    ],
    storageHealthTitle: [
      'Conversation DB Health',
      'سلامة قاعدة بيانات المحادثات',
    ],
    storageHealthIdle: [
      'Auto-checks DB bloat for background service',
      'فحص تلقائي لتضخم قاعدة البيانات لمنع استهلاك الذاكرة',
    ],
    storageArchiveBtn: [
      'Prepare Archive',
      'تحضير سكربت الأرشفة',
    ],
    storageOk: ['Healthy', 'سليم'],
    storageWarn: [
      'Archive recommended',
      'يُنصح بالأرشفة لتقليل الذاكرة',
    ],
    storageSummaryTpl: [
      '{0} ({1} main · {2} subagents / {3}) · {4}',
      '{0} (رئيسية {1} · وكلاء فرعيون {2} / {3}) · {4}',
    ],
    storageReadyTpl: [
      'Script ready ({0} subagents / {1}). Close Antigravity & run: {2}',
      'السكربت جاهز ({0} وكيل فرعي / {1}). أغلق Antigravity ثم شغّل: {2}',
    ],
    storageGuardTitle: [
      'Memory & Conversation DB Guard',
      'حارس الذاكرة وقاعدة المحادثات',
    ],
    storageGuardSummaryTpl: [
      'DB {0} · {1} archivable subagents ({2}) · Background RAM {3} (100% main chats kept, zero deletion)',
      'قاعدة البيانات {0} · {1} وكيل فرعي قابل للأرشفة ({2}) · ذاكرة الخلفية {3} (تُحفظ المحادثات الرئيسية 100% دون أي حذف)',
    ],
    storageGuardEnableAutoExitBtn: [
      'Enable Auto-Archive on Exit',
      'تفعيل الأرشفة التلقائية عند الخروج',
    ],
    storageGuardSnooze24hBtn: [
      'Snooze 24h',
      'تأجيل 24 ساعة',
    ],
    storageGuardBusyMsg: [
      'AI or Swarm is currently running; retry when idle',
      'الذكاء الاصطناعي أو Swarm قيد التشغيل حالياً؛ أعد المحاولة عند الخمول',
    ],
    storageAutoExitTitle: [
      'Auto-Archive on Exit',
      'الأرشفة التلقائية عند الخروج',
    ],
    storageAutoExitDesc: [
      'Moves finished subagents (>2h) offline 4s after Antigravity & its background service exit (main chats untouched, zero deletion)',
      'ينقل الوكلاء الفرعيين المنتهين (>ساعتين) بعد 4 ثوانٍ من إغلاق Antigravity بالكامل (دون المساس بالمحادثات الرئيسية ودون حذف)',
    ],
    storageAutoExitOff: ['Off (Default)', 'إيقاف (افتراضي)'],
    storageAutoExitOn: ['On', 'تفعيل'],
    storageAutoExitEnabledMsg: [
      'Auto-archive on exit enabled',
      'تم تفعيل الأرشفة التلقائية عند الخروج',
    ],
    storageArchiveRestartBtn: [
      'Archive & Restart',
      'أرشفة وإعادة التشغيل',
    ],
    storageArchiveRestartConfirmDesc: [
      'This will: 1) persist token usage stats; 2) close Antigravity gracefully until its background service exits; 3) move finished subagents (>2h) without deleting any files (all main chats kept); 4) relaunch automatically.',
      'سيؤدي هذا إلى: 1) حفظ إحصائيات الرموز؛ 2) إغلاق Antigravity بأمان حتى توقف الخدمة الخلفية؛ 3) نقل الوكلاء الفرعيين المنتهين (>ساعتين) دون حذف أي ملفات (مع إبقاء جميع المحادثات الرئيسية)؛ 4) إعادة التشغيل تلقائياً.',
    ],
    storageArchiveRestartConfirmBtn: [
      'Confirm & Restart',
      'تأكيد وإعادة التشغيل',
    ],
    storageArchiveRestartRunning: [
      'Saving usage ledger & starting safe archiver…',
      'جارٍ حفظ سجل الاستخدام وتشغيل المؤرشف الآمن…',
    ],
    storageArchiveRestartScheduled: [
      'Safe offline archive started; Antigravity will close and relaunch automatically',
      'بدأت الأرشفة الآمنة؛ سيُغلق Antigravity ويُعاد تشغيله تلقائياً',
    ],
    storageRestoreBtn: [
      'Restore Archive',
      'استعادة الأرشيف',
    ],
    storageRestoreConfirmDesc: [
      'Will close Antigravity gracefully, restore latest batch ({0}) losslessly, and relaunch.',
      'سيُغلق Antigravity بأمان، ويستعيد أحدث دفعة ({0}) دون فقدان، ثم يعيد التشغيل تلقائياً.',
    ],
    storageRestoreConfirmBtn: [
      'Confirm Restore',
      'تأكيد الاستعادة',
    ],
    storageRestoreScheduled: [
      'Lossless restore scheduled; Antigravity will relaunch automatically',
      'تمت جدولة الاستعادة الكاملة؛ سيُعاد تشغيل Antigravity تلقائياً',
    ],
    storageRestoreEmpty: [
      'No archive batches yet',
      'لا توجد دفعات أرشفة بعد',
    ],
    storageLsMemTpl: [
      'Background RAM {0}',
      'ذاكرة الخدمة الخلفية {0}',
    ],
    goMemLimitTitle: [
      'Background Process Memory Limit (Go GOMEMLIMIT · Optional)',
      'حد ذاكرة الخدمة الخلفية (Go GOMEMLIMIT · اختياري)',
    ],
    goMemLimitDesc: [
      'Uses Go 1.19+ native user-level GOMEMLIMIT env var to softly cap the host background service heap without modifying official binaries. Takes effect after restarting Antigravity.',
      'يستخدم متغير البيئة الرسمي Go 1.19+ GOMEMLIMIT على مستوى المستخدم لضبط حد الذاكرة برفق دون تعديل ملفات التطبيق الرسمية. يسري بعد إعادة تشغيل Antigravity.',
    ],
    goMemLimitUnset: [
      'Not set (System default)',
      'غير محدد (افتراضي النظام)',
    ],
    goMemLimitActiveTpl: [
      'User env: {0}',
      'متغير المستخدم الحالي: {0}',
    ],
    goMemLimitRestartNote: [
      '(Restart Antigravity to apply)',
      '(أعد تشغيل Antigravity للتطبيق)',
    ],
    goMemLimitApplyBtn: [
      'Apply',
      'تطبيق',
    ],
    goMemLimitClearBtn: [
      'Clear',
      'إلغاء',
    ],
    goMemLimitAppliedTpl: [
      'Set GOMEMLIMIT={0}; restart Antigravity to take effect',
      'تم ضبط GOMEMLIMIT={0}؛ أعد تشغيل Antigravity للتفعيل',
    ],
    goMemLimitCleared: [
      'Cleared GOMEMLIMIT; restart Antigravity to restore default',
      'تم مسح GOMEMLIMIT؛ أعد تشغيل Antigravity لاستعادة الافتراضي',
    ],
    aboutCreditsTitle: [
      'Upstream Open-Source & Inspiration Credits',
      'المشاريع مفتوحة المصدر ومصادر الإلهام',
    ],
    aboutLicenseTitle: [
      'GPL-3.0 License & Attribution Notice',
      'ترخيص GPL-3.0 وإشعار نسب الحقوق',
    ],
    aboutDisclaimer: [
      'Obsidian Prism is an independent open-source project and is not affiliated with or endorsed by Google LLC.',
      'Obsidian Prism مشروع مفتوح المصدر مستقل غير تابع لشركة Google LLC ولا يحظى برعايتها أو اعتمادها الرسمي.',
    ],
    uninstallBtn: [
      'Uninstall Prism',
      'إزالة Prism',
    ],
    uninstallPurge: [
      'Purge config, key & cache',
      'مسح الإعدادات ومفاتيح API والذاكرة المؤقتة',
    ],
    uninstallKeepNote: [
      'Keeps chats, conversations_archive, Spark & knowledge',
      'يحتفظ بالمحادثات والأرشيف وSpark ومساحة المعرفة',
    ],
    uninstallCancelBtn: ['Cancel', 'إلغاء'],
    uninstallConfirmBtn: ['Confirm', 'تأكيد الإزالة'],
    uninstallDone: [
      'Uninstalling; restoring UI',
      'جارٍ الإزالة واستعادة الواجهة الأصلية',
    ],

    // ── Studio Placeholder & Home Dashboard ──────────────────────────────────
    studioPlaceholder: [
      'How can I help you today?',
      'كيف يمكنني مساعدتك اليوم؟',
    ],
    tabOverview: ['Overview', 'نظرة عامة'],
    tabModels: ['Models', 'النماذج'],
    kpiSessions: ['Sessions', 'الجلسات'],
    kpiCalls: ['Messages', 'الرسائل'],
    kpiTokens: ['Total tokens', 'إجمالي الرموز'],
    kpiDays: ['Active days', 'أيام النشاط'],
    kpiFavModel: ['Favorite model', 'النموذج الأكثر استخداماً'],
    noModelUsage: [
      'No model usage data yet',
      'لا توجد بيانات استخدام للنماذج بعد',
    ],
    sessionsUnit: ['sessions', 'جلسة'],
    subagentsUnit: ['subagents', 'وكلاء فرعيون'],
    swarmBadge: ['Swarm', 'Swarm'],
    tokensInShort: ['in', 'دخل'],
    tokensOutShort: ['out', 'خرج'],
    quotaJustNow: ['Just now', 'الآن'],
    tokenUnit: ['tokens', 'رمز'],
    showLess: ['Show less', 'عرض أقل'],

    // ── Studio Quotas & Effort Slider ────────────────────────────────────────
    thinkingEllipsis: ['Thinking…', 'جارٍ التفكير…'],
    kpiCacheHit: ['Cache Hit Rate', 'معدل إصابة الكاش'],
    cacheRead: ['Cache Read', 'قراءة من الكاش'],
    cacheShort: ['Cache', 'كاش'],
    quotaPoolsTitle: [
      'Model Quota Pools Remaining',
      'حصص النماذج المتبقية',
    ],
    quotaLoading: [
      'Loading model quota status…',
      'جارٍ تحميل حالة حصص النماذج…',
    ],
    weeklyLabel: ['Weekly', 'أسبوعي'],
    refreshBtnTitle: [
      'Refresh telemetry',
      'تحديث القياسات والحصص',
    ],
    tabQuotas: ['Quotas', 'الحصص'],
    effortTitle: ['Reasoning effort', 'مستوى التفكير'],

    // ── Settings Panel ───────────────────────────────────────────────────────
    grpAppearance: [
      'Appearance & Layout',
      'المظهر والتخطيط',
    ],
    grpInteraction: [
      'Composer, Sidebar & Mascots',
      'مربع الإدخال والشريط الجانبي والرفاق',
    ],
    groupModules: [
      'Utility Modules',
      'الوحدات الإضافية',
    ],
    grpBeta: [
      'Beta Features',
      'الميزات التجريبية (Beta)',
    ],
    betaPlaceholderNotice: [
      'Note: This section contains experimental features that are off by default and may evolve across versions.',
      'ملاحظة: يحتوي هذا القسم على ميزات تجريبية مُعطّلة افتراضياً وقد تتطور عبر الإصدارات.',
    ],
    onLabel: ['On', 'تفعيل'],
    offLabel: ['Off', 'إيقاف'],
    optAutoCoexist: ['Auto', 'تلقائي'],

    setLanguageTitle: ['UI Language', 'لغة الواجهة'],
    setLanguageDesc: [
      'Switch language for Obsidian Prism dashboard and settings UI (English / Arabic).',
      'التبديل بين الإنجليزية والعربية للوحة التحكم وإعدادات Obsidian Prism.',
    ],
    setHostI18nTitle: [
      'Host UI Localization (Arabic)',
      'تعريب واجهة Antigravity',
    ],
    setHostI18nDesc: [
      'Auto: Arabic UI when language is Arabic & yields to external plugins; On: force built-in Arabic host UI; Off: restore native English UI without modifying the host package.',
      'تلقائي: يفعّل التعريب عند اختيار العربية ويحترم الإضافات الخارجية؛ تفعيل: يفرض تعريب واجهة Antigravity؛ إيقاف: يستعيد الإنجليزية الأصلية دون تعديل ملفات التطبيق.',
    ],
    optHostI18nAuto: ['Auto', 'تلقائي'],
    optHostI18nOn: ['On (Arabic)', 'تفعيل (عربي)'],
    optHostI18nOff: ['Native EN', 'إنجليزي أصلي'],
    hostLocStatusEnforced: [
      'Enforcing native English UI',
      'تم فرض استعادة الواجهة الإنجليزية الأصلية',
    ],
    hostLocStatusBlocked: [
      'External localization script keeps overriding the UI; loop-guard protection is active. Consider disabling the external localization extension in Extensions.',
      'يقوم سكربت تعريب خارجي بالكتابة فوق الواجهة باستمرار؛ تم تفعيل حماية منع التكرار. يُنصح بتعطيل الإضافة الخارجية من مدير الإضافات.',
    ],
    hostI18nYieldHint: [
      'Detected external localization — auto-yielded',
      'تم اكتشاف إضافة تعريب خارجية — تم التنازل تلقائياً',
    ],
    hostI18nOffExtHint: [
      'Prism host localization is off; an external localization plugin or client patch is still active.',
      'تعريب Prism مُعطّل؛ لا تزال هناك إضافة أو رُقعة لغة خارجية نشطة.',
    ],
    setHomeLayoutTitle: ['Home Layout', 'تخطيط الصفحة الرئيسية'],
    setHomeLayoutDesc: [
      'Switch new-conversation home layout.',
      'تبديل تخطيط شاشة المحادثة الجديدة (لوحة Studio / كلاسيكي / أصلي).',
    ],
    optStudio: ['Studio', 'استوديو'],
    optClassic: ['Classic', 'كلاسيكي'],
    optNativeOff: ['Off', 'أصلي'],
    setPaletteTitle: ['Color Palette', 'نظام الألوان'],
    setPaletteDesc: [
      'Follow host theme, or switch to refined Obsidian / Alabaster Warm palettes.',
      'اتباع سمة التطبيق أو التبديل بين ألوان Obsidian الداكنة وAlabaster الدافئة.',
    ],
    optObsidian: ['Obsidian', 'أوبسيديان داكن'],
    optWarm: ['Alabaster Warm', 'ألباستر دافئ'],
    optClaude: ['Alabaster Warm', 'ألباستر دافئ'],
    optHost: ['Follow Host', 'اتباع التطبيق'],

    setLightPresetTitle: ['Daylight Surface Preset', 'مظهر الوضع النهاري'],
    setLightPresetDesc: [
      'Tune surface elevation, glass contrast, and tint in light mode.',
      'ضبط تباين الأسطح ودرجة الإضاءة في الوضع الفاتح.',
    ],
    optLightCrystal: ['Daylight Crystal', 'كريستال نهاري'],
    optLightAlabaster: ['Warm Alabaster', 'ألباستر دافئ'],
    lightPresetHintDark: [
      'Active in Light mode — switch host theme to Light to preview',
      'يعمل في الوضع الفاتح — بدّل سمة التطبيق إلى الفاتح للمعاينة',
    ],
    lightPresetHintWarm: [
      'Alabaster Warm palette automatically applies warm linen surface',
      'نظام Alabaster الدافئ يطبّق سطح الكتان الدافئ تلقائياً',
    ],
    lightPresetHintHost: [
      'Following host theme — select Obsidian palette in Light mode to customize',
      'يتبع سمة التطبيق — اختر Obsidian في الوضع الفاتح للتخصيص',
    ],

    setTelemetryTitle: [
      'Bottom Telemetry & Context HUD',
      'مؤشر القياسات والسياق السفلي',
    ],
    setTelemetryDesc: [
      'Show speed, cache, and context usage; compatible with external plugins.',
      'يعرض سرعة التوليد والكاش واستهلاك السياق (512K) بتوافق تلقائي مع الإضافات الخارجية.',
    ],
    setEffortSliderTitle: [
      'Model Reasoning Effort Slider',
      'شريط مستوى التفكير للنماذج',
    ],
    setEffortSliderDesc: [
      'Add a reasoning effort slider inside the model menu.',
      'يضيف شريط تحكم بمستوى التفكير داخل قائمة اختيار النماذج.',
    ],
    setEffortMemoryTitle: [
      'Remember Effort Per Model',
      'تذكر مستوى التفكير لكل نموذج',
    ],
    setEffortMemoryDesc: [
      'Remember your last reasoning effort per model and Orchestrator planner, even with the slider turned off.',
      'يحفظ آخر مستوى تفكير اخترته لكل نموذج وOrchestrator تلقائياً حتى عند إيقاف الشريط.',
    ],
    setPeriodicPickerTitle: [
      'Periodic Table Picker',
      'منتقي النماذج الدوري (3D)',
    ],
    setPeriodicPickerDesc: [
      'Long-press the bottom model selector for the 3D periodic table; short-click opens the native list.',
      'اضغط مطولاً على منتقي النماذج السفلي لفتح الجدول الدوري ثلاثي الأبعاد؛ النقرة القصيرة تفتح القائمة الأصلية.',
    ],
    setOmniTitle: [
      'File Viewer & Context Menu',
      'عارض الملفات وقائمة النقر الأيمن',
    ],
    setOmniDesc: [
      'Enable link handling, file context menu actions, and side-pane media/data preview.',
      'يفعّل فتح الروابط والمسارات، قائمة النقر الأيمن، ومعاينة الملفات الكبيرة باللوحة الجانبية.',
    ],
    setLinkTargetTitle: [
      'Web Link Target',
      'وجهة فتح روابط الويب',
    ],
    setLinkTargetDesc: [
      'Default target when clicking web links (hold Ctrl/Cmd+Click to invert).',
      'المكان الافتراضي لفتح الروابط عند النقر (اضغط Ctrl/Cmd+نقر لعكس الاختيار مؤقتاً).',
    ],
    setSidebarStudioTitle: [
      'Chat Mode (Beta)',
      'وضع الدردشة (Beta)',
    ],
    setSidebarStudioDesc: [
      'Experimental (off by default). Adds a Code / Chat switcher to the sidebar for everyday chat and document tasks.',
      'ميزة تجريبية (مُعطّلة افتراضياً). تضيف مبدّلاً بين Code وChat أعلى الشريط الجانبي للمحادثات اليومية وتنظيم المستندات.',
    ],
    optLinkBuiltin: ['Side Pane', 'اللوحة الجانبية'],
    optLinkExternal: ['System Browser', 'متصفح النظام'],

    setLogoInkTitle: ['Logo Color', 'لون شعار الترحيب'],
    setLogoInkDesc: [
      'Tint of the home greeting mark.',
      'تحديد لون نجمة الترحيب في صفحة المحادثة الجديدة.',
    ],
    optAccent: ['Accent', 'لون التمييز'],
    optForeground: ['Ink', 'لون النص'],
    setSidebarTitle: ['Sidebar Restyle', 'تنسيق الشريط الجانبي'],
    setSidebarDesc: [
      'Apply refined row height and hover plates to sidebar.',
      'تطبيق تباعد مدمج وتأثيرات تمرير أنيقة لقائمة المحادثات والمشاريع.',
    ],
    setSidebarCompactTitle: ['Compact Sidebar', 'شريط جانبي مضغوط'],
    setSidebarCompactDesc: [
      'Tighten sidebar row height from 28px to 24px.',
      'تقليل ارتفاع صفوف الشريط الجانبي من 28px إلى 24px لعرض محادثات أكثر.',
    ],
    setComposerTitle: ['Composer Restyle', 'تنسيق مربع الإدخال'],
    setComposerDesc: [
      'Minimalist input box + clean canvas footer.',
      'مربع إدخال أنيق وشريط أدوات سفلي مُحسّن.',
    ],
    setPlaceholderTitle: ['Placeholder Style', 'أسلوب نص التلميح'],
    setPlaceholderDesc: [
      'Switch between Studio placeholder copy and host default.',
      'التبديل بين نص التلميح البسيط لـ Studio والنص الافتراضي للتطبيق.',
    ],
    optPlaceholderHost: ['Host', 'افتراضي التطبيق'],
    setSmoothCaretTitle: ['Smooth Typing Caret', 'مؤشر كتابة سلس'],
    setSmoothCaretDesc: [
      'Enable smooth gliding caret interpolation in composer input.',
      'تفعيل حركة انسيابية ناعمة لمؤشر الكتابة داخل مربع الإدخال.',
    ],
    rowContextMenuTitle: [
      'Conversation Quick Menu (/btw)',
      'القائمة السريعة للمحادثة (/btw)',
    ],
    rowContextMenuDesc: [
      'Right-click anywhere in a conversation to launch /btw side chat with selected text or run /compact; hold Shift+Right-Click for the native menu.',
      'انقر بزر الفأرة الأيمن في أي مكان بالمحادثة لفتح /btw بالنص المحدد أو تنفيذ /compact؛ اضغط Shift+زر أيمن للقائمة الأصلية.',
    ],
    setMotionLevelTitle: ['Motion Level', 'مستوى الحركة والأنيميشن'],
    setMotionLevelDesc: [
      'Control spring micro-interactions, streaming text reveal, and scene transitions.',
      'التحكم في حركات النوابض وظهور النص المتدفق وانتقالات المشاهد.',
    ],
    optMotionOff: ['Off', 'إيقاف'],
    optMotionSubtle: ['Subtle', 'خفيف'],
    optMotionStandard: ['Standard', 'قياسي'],
    optMotionUltra: ['Ultra', 'كامل'],
    setTargetFpsTitle: ['Target Frame Rate', 'معدل الإطارات المستهدف'],
    setTargetFpsDesc: [
      'Cap active FPS for prism rim, home ripples, crystal bar & vial animations (auto-sleeps when idle).',
      'تحديد الحد الأقصى لمعدل الإطارات للتأثيرات البصرية (يدخل وضع السكون 0fps تلقائياً عند الخمول).',
    ],
    optFps60: ['60 FPS', '60 FPS'],
    optFps120: ['120 FPS', '120 FPS'],
    optFps180: ['180 FPS', '180 FPS'],
    optFpsNative: ['Native Max', 'أقصى معدل للشاشة'],
    setMascotTitle: ['Pixel Mascot Stage', 'الرفاق البكسليون'],
    setMascotDesc: [
      'Show interactive pixel mascots on composer.',
      'عرض رفاق بكسليين تفاعليين فوق مربع الإدخال.',
    ],
    optMascotCrab: ['Dual', 'ثنائي'],
    optMascotMinis: ['Dual + Crabs', 'ثنائي + سلطعونات'],
    optMascotQuad: ['Quad', 'رباعي'],
    optMascotQuadMinis: ['Quad + Crabs', 'رباعي + سلطعونات'],
    optMascotOff: ['Off', 'إيقاف'],
    mascotRosterTitle: ['Custom Roster', 'تشكيلة الرفاق المخصصة'],
    mascotRosterCount: ['Main {n}/4', 'الرئيسيون {n}/4'],
    mascotRosterMinis: ['+3 Mini Crabs', '+3 سلطعونات صغيرة'],
    mascotSpeciesCrab: ['Claude Crab', 'سلطعون Claude'],
    mascotSpeciesCat: ['Gemini Cat', 'قطة Gemini'],
    mascotSpeciesDragon: ['GPT Dragon', 'تنين GPT'],
    mascotSpeciesWhale: ['DeepSeek Whale', 'حوت DeepSeek'],
    mascotStageOpenBtn: ['Open Casting Stage', 'فتح مسرح اختيار الرفاق'],
    mascotStageTitle: ['Mascot Casting Stage', 'مسرح اختيار الرفاق'],
    mascotStageBackBtn: ['Back to Settings', 'العودة للإعدادات'],
    mascotStageHint: [
      'Click mascots in the tavern or badges below to toggle spotlights; move pointer for 3D parallax',
      'انقر على الشخصيات في المسرح أو الشارات بالأسفل لتفعيلها؛ حرّك المؤشر لتجربة عمق 3D',
    ],
    mascotStagePresetDual: ['Classic Dual', 'ثنائي كلاسيكي'],
    mascotStagePresetQuad: ['All Four', 'الأربعة معاً'],
    mascotStagePresetOff: ['All Resting', 'استراحة للجميع'],
    mascotStageMinisSlot: ['Mini Crab Corner', 'ركن السلطعونات الصغيرة'],
    mascotStageActiveOn: ['On Stage', 'على المسرح'],
    mascotStageActiveOff: ['Resting', 'في استراحة'],
    setRippleTitle: ['Home Matrix Ripple', 'تموجات الصفحة الرئيسية'],
    setRippleDesc: [
      'Interactive character matrix ripple field on home view.',
      'مصفوفة حروف تفاعلية تنشر تموجات ضوئية عند النقر في الصفحة الرئيسية.',
    ],
    setConvRippleTitle: ['Chat Matrix Ripple', 'تموجات صفحة المحادثة'],
    setConvRippleDesc: [
      'Character matrix ripple on chat background with adjustable intensity (off by default; auto-yields to custom wallpaper or split view).',
      'تموجات مصفوفة الحروف في خلفية المحادثة بشدة قابلة للتعديل (مُعطّلة افتراضياً وتتوقف تلقائياً مع الخلفية المخصصة أو العرض المنقسم).',
    ],
    optConvRippleOff: ['Off', 'إيقاف'],
    optConvRippleSubtle: ['Subtle', 'خافت'],
    optConvRippleMedium: ['Medium', 'متوسط'],
    optConvRippleFull: ['Full', 'واضح'],

    // ── Thought Translator & OpenAI Polisher ─────────────────────────────────
    grpThought: [
      'Thought Translation & Polishing',
      'ترجمة وصقل سلسلة التفكير',
    ],
    setThoughtModeTitle: [
      'Thought Translation Mode',
      'وضع ترجمة التفكير',
    ],
    setThoughtModeDesc: [
      'Translate reasoning chains via zero-config Machine Translate or streaming OpenAI-compatible AI polish.',
      'ترجمة سلسلة التفكير عبر الترجمة الآلية الفورية بدون إعداد، أو الصقل المتدفق عبر واجهة OpenAI متوافقة.',
    ],
    optThoughtOff: ['Off', 'إيقاف'],
    optThoughtMachine: ['Machine', 'ترجمة آلية'],
    optThoughtAi: ['AI Polish', 'صقل بالذكاء الاصطناعي'],
    setThoughtTriggerTitle: [
      'Translation Trigger Timing',
      'توقيت بدء الترجمة',
    ],
    setThoughtTriggerDesc: [
      'Preload latest finished thought in background, or translate strictly on expand to save tokens.',
      '«تحميل مسبق» يترجم أحدث كتلة تفكير فور اكتمالها في الخلفية؛ «عند التوسيع» يترجم فقط عند الفتح لتوفير الرموز.',
    ],
    optTriggerPreload: ['Preload', 'تحميل مسبق'],
    optTriggerExpand: ['On Expand', 'عند التوسيع'],
    thoughtStyleLabel: ['Polishing Style', 'أسلوب الصياغة'],
    optStyleTech: ['Technical Manuscript', 'ملاحظات هندسية احترافية'],
    optStyleConcise: ['Concise Key Points', 'نقاط رئيسية موجزة'],
    optStyleCustom: ['Custom Prompt', 'موجه مخصص'],
    thoughtCustomPromptPh: [
      'Enter custom polishing prompt (saved locally only)…',
      'أدخل موجه الصياغة المخصص (يُحفظ محلياً فقط)…',
    ],
    thoughtProfilesLabel: ['OpenAI Endpoint Profiles', 'ملفات نقاط OpenAI'],
    thoughtAddProfileBtn: ['+ New Profile', '+ ملف جديد'],
    thoughtDelProfileBtn: ['Delete', 'حذف'],
    thoughtFieldName: ['Profile Name', 'اسم الملف'],
    thoughtFieldBaseUrl: ['Base URL', 'رابط الواجهة (Base URL)'],
    thoughtFieldApiKey: ['API Key', 'مفتاح API'],
    thoughtFieldModel: ['Model ID', 'معرّف النموذج (Model ID)'],
    thoughtFetchModelsBtn: ['Fetch Models', 'جلب النماذج'],
    thoughtSaveBtn: ['Save Config', 'حفظ الإعدادات'],
    thoughtTestBtn: ['Send Test Message', 'إرسال رسالة اختبار'],
    thoughtPrivacyHint: [
      'API keys and custom prompts are stored locally only and never uploaded.',
      'تُحفظ مفاتيح API والموجهات المخصصة محلياً فقط بصلاحيات مقيدة ولا تُرفع أبداً.',
    ],

    // ── Studio Quotas, Scene Presets, Config Keys & Backup ───────────────────
    workspaceAll: ['All Projects', 'كل المشاريع'],
    workspaceFilterAria: ['Filter usage by workspace', 'تصفية الاستخدام حسب المشروع'],
    homeScopeAll: ['All', 'مع الأرشيف'],
    homeScopeActive: ['Current', 'الحالي فقط'],
    homeScopeActiveCount: ['Active', 'نشط'],
    homeScopeArchivedCount: ['Archived', 'مؤرشف'],
    homeLocalOnlyTag: ['Local only', 'محلي فقط'],
    homeLocalScopeNote: [
      'Counts saved local sessions only (excludes cloud)',
      'يحسب الجلسات المحفوظة محلياً فقط (دون السحابة)',
    ],
    fiveHourLabel: ['5-Hour Window', 'نافذة 5 ساعات'],
    quotaEmptyHint: [
      'Waiting for live quota snapshot — click Refresh to retry',
      'بانتظار لقطة الحصص الحية — انقر تحديث لإعادة المحاولة',
    ],
    presetBarLabel: ['Scene Presets', 'إعدادات المشهد الجاهزة'],
    presetUltra: ['Full Visuals', 'مؤثرات كاملة'],
    presetFocus: ['Deep Focus', 'تركيز برمجي'],
    presetEco: ['Silent Eco', 'توفير صامت'],
    subTabAll: ['All', 'الكل'],
    subTabAppearance: ['Appearance', 'المظهر'],
    subTabInteraction: ['Workspace', 'مساحة العمل'],
    subTabThought: ['Thought', 'التفكير'],
    subTabModules: ['Modules', 'الوحدات'],
    subTabBeta: ['Beta', 'تجريبي'],
    subTabAbout: ['Config & About', 'النسخ الاحتياطي وحول'],

    setAccentToneTitle: ['Accent Tone', 'درجة لون التمييز'],
    setAccentToneDesc: [
      'Adjust accent hue for active controls, focus rings, and charts.',
      'تعديل لون التمييز للأزرار النشطة وحلقات التركيز والرسوم البيانية.',
    ],
    optToneFollow: ['Follow Model', 'اتباع النموذج'],
    optToneCobalt: ['Cobalt', 'أزرق كوبالت'],
    optToneIris: ['Iris', 'بنفسجي سوسني'],
    optToneAmber: ['Amber', 'عنبر ذهبي'],
    optToneMono: ['Monochrome', 'أحادي اللون'],

    setCornerStyleTitle: ['Corner Radius Style', 'استدارة الزوايا'],
    setCornerStyleDesc: [
      'Adjust border radius curvature across composer, cards, and popovers.',
      'تعديل انحناء الحواف لمربع الإدخال والبطاقات والنوافذ المنبثقة.',
    ],
    optCornerSharp: ['Sharp', 'حاد'],
    optCornerBalanced: ['Balanced', 'متوازن'],
    optCornerSoft: ['Soft', 'ناعم'],

    setScrollBottomTitle: ['Scroll-to-Bottom Motion', 'حركة التمرير للأسفل'],
    setScrollBottomDesc: [
      'Use high-speed inertial glide when clicking Scroll-to-Bottom (wheel interrupts instantly), or keep native instant jump.',
      'استخدام انزلاق سلس سريع عند النقر على زر النزول للأسفل (تتوقف فور تحريك العجلة) أو القفز الفوري الأصلي.',
    ],
    optScrollBottomSmooth: ['Fast Glide', 'انزلاق سريع'],
    optScrollBottomInstant: ['Instant', 'فوري'],
    inlineDiffOpenSidebar: ['Open in Sidebar', 'فتح في الشريط الجانبي'],
    inlineDiffCollapse: ['Collapse', 'طي'],
    inlineDiffLoading: ['Loading diff...', 'جارٍ تحميل الفروقات...'],
    inlineDiffBinary: [
      'Binary file cannot be previewed inline. Right-click to open in Sidebar.',
      'لا يمكن معاينة الملف الثنائي مضمناً. انقر بزر الفأرة الأيمن لفتحه في الشريط الجانبي.',
    ],
    inlineDiffNoPreview: [
      'Full hunk text is not cached on this step. Right-click to open full diff in Sidebar.',
      'نص التعديل الكامل غير متوفر لهذه الخطوة. انقر بزر الفأرة الأيمن لعرض المقارنة الكاملة في الشريط الجانبي.',
    ],
    inlineDiffSnapshotNotice: [
      'Not tracked by Git · previewing current file (right-click to open full diff in Sidebar)',
      'غير متتبع في Git · معاينة محتوى الملف الحالي (زر أيمن لفتح المقارنة الكاملة)',
    ],
    inlineDiffLongLinesTag: ['long line', 'سطر طويل'],
    inlineDiffMenuExpand: ['Expand inline diff', 'توسيع الفروقات المضمنة'],
    inlineDiffMenuCollapse: ['Collapse inline diff', 'طي الفروقات المضمنة'],
    inlineDiffMenuCopyPath: ['Copy file path', 'نسخ مسار الملف'],
    inlineDiffLargeExpandBtn: [
      '⋯ Showing key hunks · Click to open full diff in Sidebar',
      '⋯ عرض الأجزاء الرئيسية فقط · انقر لفتح المقارنة الكاملة في الشريط الجانبي',
    ],
    sidebarMoreLabel: ['More', 'المزيد'],
    sidebarLessLabel: ['Less', 'أقل'],
    setSidebarNavFoldLabel: ['Compact Sidebar Nav', 'طي تنقل الشريط الجانبي'],
    setSidebarNavFoldDesc: [
      'Show all 3 nav items when off; when on, keep New Conversation pinned and fold Automations & Customizations into More.',
      'عند الإيقاف تظهر العناصر الثلاثة؛ عند التفعيل يثبت «محادثة جديدة» وتُطوى الأتمتة والتخصيصات داخل «المزيد».',
    ],
    optSidebarNavFoldOff: ['Show All', 'عرض الكل'],
    optSidebarNavFoldOn: ['Fold Extra', 'طي الإضافي'],

    setCodeFontTitle: ['Code Monospace Font', 'خط الكود أحادي العرض'],
    setCodeFontDesc: [
      'Preferred monospace font family for code blocks and inline code.',
      'تحديد خط الكود المفضل لكتل الشيفرة والكود المضمن والطرفية.',
    ],
    optFontDefault: ['Default', 'افتراضي النظام'],
    optFontSfmono: ['SF Mono / Consolas', 'SF Mono / Consolas'],

    setCodeLigaturesTitle: ['Code Font Ligatures', 'روابط خط البرمجة (Ligatures)'],
    setCodeLigaturesDesc: [
      'Enable programming font ligatures (=>, !==, >=) inside code blocks.',
      'تفعيل دمج رموز البرمجة مثل => و !== و >= داخل كتل الكود.',
    ],

    setAmbientIntensityTitle: ['Ambient Glow Intensity', 'كثافة الإضاءة المحيطية'],
    setAmbientIntensityDesc: [
      'Control opacity scale of ambient aurora and edge refraction glow.',
      'التحكم الدقيق في شفافية الإضاءة الخلفية وتوهج الحواف.',
    ],
    optAmb0: ['0%', 'إيقاف (0%)'],
    optAmb35: ['35%', 'خافت (35%)'],
    optAmb70: ['70%', 'متوسط (70%)'],
    optAmb100: ['100%', 'قياسي (100%)'],

    setThoughtViewTitle: ['Translated Thought View', 'عرض ترجمة التفكير'],
    setThoughtViewDesc: [
      'Switch between clean immersive translation and stacked bilingual view.',
      'التبديل بين عرض الترجمة الصافية أو العرض ثنائي اللغة (الترجمة + النص الأصلي).',
    ],
    optThoughtImmersive: ['Immersive', 'ترجمة صافية'],
    optThoughtBilingual: ['Bilingual', 'ثنائي اللغة'],

    cfgToolbarTitle: ['Configuration Backup & Reset', 'النسخ الاحتياطي وإعادة الضبط'],
    cfgToolbarHint: [
      'Exported JSON strips all API keys automatically for safe backup and sharing.',
      'يزيل ملف JSON المُصدَّر جميع مفاتيح API تلقائياً للنسخ الاحتياطي والمشاركة الآمنة.',
    ],
    cfgExportBtn: ['Export JSON', 'تصدير JSON'],
    cfgImportBtn: ['Import JSON', 'استيراد JSON'],
    cfgResetBtn: ['Reset Defaults', 'استعادة الافتراضي'],
    cfgExportOk: [
      'Exported sanitized config (API keys stripped)',
      'تم تصدير الإعدادات بأمان (دون مفاتيح API)',
    ],
    cfgImportOk: [
      'Validated and restored settings',
      'تم التحقق واستعادة الإعدادات بنجاح',
    ],
    cfgImportErr: [
      'Invalid JSON or no recognized setting keys',
      'صيغة JSON غير صالحة أو لا تحتوي على مفاتيح إعدادات معروفة',
    ],
    cfgResetOk: [
      'Restored all default settings',
      'تمت استعادة جميع الإعدادات الافتراضية',
    ],
    thoughtClearCacheBtn: ['Clear Cache', 'مسح الكاش'],
    thoughtViewLabel: ['Reading View', 'طريقة العرض'],

    // ── Omni Context Menu & Built-in Side-Pane Browser / Viewer ──────────────
    omniOpenBuiltin: ['Open in Side Pane', 'فتح في اللوحة الجانبية'],
    omniOpenPreview: ['Preview in Workbench', 'معاينة في منصة العرض'],
    omniOpenExternal: ['Open in Default App', 'فتح بالتطبيق الافتراضي'],
    omniOpenBrowser: ['Open in System Browser', 'فتح في متصفح النظام'],
    omniRevealFolder: ['Reveal in Folder', 'إظهار في المجلد'],
    omniInsertMention: ['Insert as @Mention', 'إدراج كإشارة @Mention'],
    omniCopyLink: ['Copy Link URL', 'نسخ رابط العنوان'],
    omniCopyAbsPath: ['Copy Absolute Path', 'نسخ المسار الكامل'],
    omniCopyRelPath: ['Copy Relative Path', 'نسخ المسار النسبي'],
    omniCopyText: ['Copy Text', 'نسخ النص'],
    omniZoomDiagram: ['Zoom Diagram', 'تكبير المخطط'],
    omniViewWorkbench: ['Workbench View', 'عرض المعاينة'],
    omniViewRaw: ['Raw View', 'العرض الخام'],
    omniReload: ['Reload', 'تحديث'],
    omniBack: ['Back', 'رجوع'],
    omniForward: ['Forward', 'تقدم'],
  };

  // Static UI keys required by non-settings runtime modules (Channel 1 slim slice)
  const RUNTIME_UI_KEYS = Object.freeze([
    'studioPlaceholder',
    'optObsidian',
    'optWarm',
    'optHost',
    'optLightCrystal',
    'optLightAlabaster',
    'optMotionOff',
    'optMotionSubtle',
    'optMotionStandard',
    'optMotionUltra',
    'tabOverview',
    'tabModels',
    'tabQuotas',
    'kpiSessions',
    'kpiCalls',
    'kpiTokens',
    'kpiDays',
    'kpiCacheHit',
    'kpiFavModel',
    'cacheRead',
    'cacheShort',
    'noModelUsage',
    'sessionsUnit',
    'subagentsUnit',
    'swarmBadge',
    'tokensInShort',
    'tokensOutShort',
    'quotaJustNow',
    'tokenUnit',
    'showLess',
    'thinkingEllipsis',
    'quotaPoolsTitle',
    'quotaLoading',
    'quotaEmptyHint',
    'weeklyLabel',
    'fiveHourLabel',
    'refreshBtnTitle',
    'workspaceAll',
    'workspaceFilterAria',
    'homeScopeAll',
    'homeScopeActive',
    'homeScopeActiveCount',
    'homeScopeArchivedCount',
    'homeLocalOnlyTag',
    'homeLocalScopeNote',
    'sidebarMoreLabel',
    'sidebarLessLabel',
    'effortTitle',
    'omniOpenBuiltin',
    'omniOpenPreview',
    'omniOpenExternal',
    'omniOpenBrowser',
    'omniRevealFolder',
    'omniInsertMention',
    'omniCopyLink',
    'omniCopyAbsPath',
    'omniCopyRelPath',
    'omniCopyText',
    'omniZoomDiagram',
    'omniViewWorkbench',
    'omniViewRaw',
    'omniReload',
    'omniBack',
    'omniForward',
    'inlineDiffOpenSidebar',
    'inlineDiffCollapse',
    'inlineDiffLoading',
    'inlineDiffBinary',
    'inlineDiffNoPreview',
    'inlineDiffSnapshotNotice',
    'inlineDiffLongLinesTag',
    'inlineDiffMenuExpand',
    'inlineDiffMenuCollapse',
    'inlineDiffMenuCopyPath',
    'inlineDiffLargeExpandBtn',
    'optThoughtImmersive',
    'optThoughtBilingual',
  ]);

  function getUiStrings(lang) {
    const resolved = resolveLangId(lang);
    const out = {};
    for (const key in UI_TABLE) {
      out[key] = pick(resolved, UI_TABLE[key]);
    }
    out.optViewImmersive = out.optThoughtImmersive;
    out.optViewBilingual = out.optThoughtBilingual;
    out.swarmSplitSub = (mainPct, subPct) =>
      resolved === 'ar'
        ? `الرئيسية ${mainPct}% · الوكلاء الفرعيون ${subPct}%`
        : `Main ${mainPct}% · Swarm ${subPct}%`;
    out.showMoreN = (n) =>
      resolved === 'ar'
        ? `عرض ${n} إضافي`
        : `Show ${n} more`;
    return out;
  }

  function getRuntimeUiSlice(lang) {
    const norm = resolveLangId(lang);
    const strings = {};
    for (let i = 0; i < RUNTIME_UI_KEYS.length; i++) {
      const k = RUNTIME_UI_KEYS[i];
      if (Object.prototype.hasOwnProperty.call(UI_TABLE, k)) {
        strings[k] = pick(norm, UI_TABLE[k]);
      }
    }
    return { lang: norm, strings };
  }

  // Global host DOM dictionary override stays empty here (handled on-demand by Channel 4)
  const DICT_ROWS = [];

  function resolveLocaleBundle(lang) {
    const norm = resolveLangId(lang);
    if (norm !== 'ar') return null;
    return {
      lang: 'ar',
      cjkLatinSpacing: false,
      rtl: true,
      units: null,
      dict: Object.create(null),
      rules: [],
      timeRules: [],
      sentences: [],
    };
  }

  return {
    LANG_IDS,
    LANG_INDEX,
    UI_TABLE,
    RUNTIME_UI_KEYS,
    getUiStrings,
    getRuntimeUiSlice,
    DICT_ROWS,
    resolveLocaleBundle,
    __isFullLocales: true,
  };
});
