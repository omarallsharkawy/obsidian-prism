/**
 * Obsidian Prism — Channel 4 Reverse English Restoration Rules (hostLocalization: 'off')
 * Zero-dependency UMD module exposing:
 *   - CommonJS: module.exports
 *   - Browser / Electron: globalThis.__agPrismHostI18nReversePatterns
 *
 * Guarantees:
 *   1. REVERSE_EXACT_OVERRIDES < 3 KB compact disambiguation & external Arabic Chrome UI overrides
 *   2. Every pattern in REVERSE_PATTERNS is strictly anchored (^...$) to prevent prose corruption
 *   3. REVERSE_CROSS_NODE_RULES symmetrically restores cross-TextNode templates in host-i18n-runtime.js
 */
(function (root, factory) {
  var api = factory();
  if (root) {
    root.__agPrismHostI18nReversePatterns = api;
  }
  if (typeof module === 'object' && module.exports) {
    module.exports = api;
  }
})(typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : this, function () {
  'use strict';

  var REVERSE_EXACT_OVERRIDES = Object.assign(Object.create(null), {
    'الإعدادات': 'Settings',
    'إعدادات التطبيق': 'App Settings',
    'التفضيلات': 'Preferences',
    'إجراء': 'Action',
    'إغلاق': 'Close',
    'إلغاء': 'Cancel',
    'حذف': 'Delete',
    'حفظ': 'Save',
    'نسخ': 'Copy',
    'بحث': 'Search',
    'جديد': 'New',
    'ملف': 'File',
    'تحرير': 'Edit',
    'عرض': 'View',
    'انتقال': 'Go',
    'الطرفية': 'Terminal',
    'مساعدة': 'Help',
    'الإضافات': 'Extensions',
    'المظهر': 'Appearance',
    'عام': 'General',
    'الحساب': 'Account',
    'السجل': 'History',
    'النموذج': 'Model',
    'الخطة': 'Plan',
    'الوكيل': 'Agent',
    'مساحة العمل': 'Workspace',
    'المحادثة': 'Conversation',
    'صندوق الوارد': 'Inbox',
    'الإشعارات': 'Notifications',
    'التفكير': 'Thought',
    'متابعة': 'Continue',
    'إعادة المحاولة': 'Retry',
    'قبول': 'Accept',
    'رفض': 'Reject',
    'سماح': 'Allow',
    'منع': 'Deny',
    'تفعيل': 'Enable',
    'تعطيل': 'Disable',
    'فتح': 'Open',
    'إعادة تعيين': 'Reset',
    'إعادة تحميل': 'Reload',
    'تحديث': 'Refresh',
    'تثبيت': 'Install',
    'إلغاء التثبيت': 'Uninstall',
    'تحديث التطبيق': 'Update',
    'تصدير': 'Export',
    'استيراد': 'Import',
    'مسح': 'Clear',
    'تصفية': 'Filter',
    'فرز': 'Sort',
    'التفاصيل': 'Details',
    'نظرة عامة': 'Overview',
    'تصحيح الأخطاء': 'Debug',
    'تشغيل': 'Run',
    'إيقاف': 'Stop',
    'إيقاف مؤقت': 'Pause',
    'استئناف': 'Resume',
    'تحديد': 'Select',
    'تم': 'Done',
    'تقديم': 'Submit',
    'خروج': 'Exit',
    'طي': 'Collapse',
    'تراجع': 'Undo',
    'محادثة جديدة': 'New Conversation',
    'الملحقات': 'Plugins',
    'الوكلاء الفرعيون': 'Subagents',
    'المهام المجدولة': 'Scheduled Tasks',
    'أدوات MCP': 'MCP Tools',
    'إضافات الواجهة': 'UI Extensions',
    'الوضع المستقل': 'Autonomous Mode',
    'تباين عالٍ': 'High Contrast',
    'مكتمل': 'Completed',
    'قيد التنفيذ': 'In Progress',
    'إرسال الآن': 'Send Now',
    'الآن': 'Just now',
    'اليوم': 'Today',
    'أمس': 'Yesterday',
    'تسجيل الدخول': 'Sign In',
    'تسجيل الخروج': 'Sign Out',
    'المثبّتة': 'Pinned',
    'المحرر': 'Editor',
    'الخصوصية': 'Privacy',
    'النظام': 'System',
    'السمة': 'Theme',
    'الخط': 'Font',
    'جارٍ التفكير': 'Thinking',
    'إرسال': 'Send',
    'جميع المشاريع': 'All Projects',
    'المحادثات الأخيرة': 'Recent Conversations',
    'المحادثة الحالية': 'Current Conversation',
    'اختصارات لوحة المفاتيح': 'Keyboard Shortcuts',
    'ترقية': 'Upgrade',
    'مفعّل': 'On',
    'استعادة الافتراضي': 'Reset to Default',
    'فائق السرعة': 'Turbo',
  });

  var REVERSE_PATTERNS = [
    // 1. Thought / Thinking / Worked / Stopped / Timed durations
    {
      regex: '^تم التفكير لمدة\\s+(\\d+)\\s*س\\s+(\\d+)\\s*د\\s+(\\d+(?:\\.\\d+)?)\\s*ث$',
      replacement: 'Thought for $1h $2m $3s',
    },
    {
      regex: '^تم التفكير لمدة\\s+(\\d+)\\s*س\\s+(\\d+)\\s*د$',
      replacement: 'Thought for $1h $2m',
    },
    {
      regex: '^تم التفكير لمدة\\s+(\\d+)\\s*س$',
      replacement: 'Thought for $1h',
    },
    {
      regex: '^تم التفكير لمدة\\s+(\\d+)\\s*د\\s+(\\d+(?:\\.\\d+)?)\\s*ث$',
      replacement: 'Thought for $1m $2s',
    },
    {
      regex: '^تم التفكير لمدة\\s+(\\d+)\\s*د$',
      replacement: 'Thought for $1m',
    },
    {
      regex: '^تم التفكير لمدة\\s+(\\d+(?:\\.\\d+)?)\\s*ث$',
      replacement: 'Thought for $1s',
    },
    {
      regex: '^جارٍ التفكير منذ\\s+(\\d+)\\s*س\\s+(\\d+)\\s*د\\s+(\\d+(?:\\.\\d+)?)\\s*ث$',
      replacement: 'Thinking for $1h $2m $3s',
    },
    {
      regex: '^جارٍ التفكير منذ\\s+(\\d+)\\s*س\\s+(\\d+)\\s*د$',
      replacement: 'Thinking for $1h $2m',
    },
    {
      regex: '^جارٍ التفكير منذ\\s+(\\d+)\\s*س$',
      replacement: 'Thinking for $1h',
    },
    {
      regex: '^جارٍ التفكير منذ\\s+(\\d+)\\s*د\\s+(\\d+(?:\\.\\d+)?)\\s*ث$',
      replacement: 'Thinking for $1m $2s',
    },
    {
      regex: '^جارٍ التفكير منذ\\s+(\\d+)\\s*د$',
      replacement: 'Thinking for $1m',
    },
    {
      regex: '^جارٍ التفكير منذ\\s+(\\d+(?:\\.\\d+)?)\\s*ث$',
      replacement: 'Thinking for $1s',
    },
    {
      regex: '^عمل لمدة\\s+(\\d+)\\s*ي\\s+(\\d+)\\s*س\\s+(\\d+)\\s*د$',
      replacement: 'Worked for $1d $2h $3m',
    },
    {
      regex: '^عمل لمدة\\s+(\\d+)\\s*س\\s+(\\d+)\\s*د\\s+(\\d+(?:\\.\\d+)?)\\s*ث$',
      replacement: 'Worked for $1h $2m $3s',
    },
    {
      regex: '^عمل لمدة\\s+(\\d+)\\s*س\\s+(\\d+)\\s*د$',
      replacement: 'Worked for $1h $2m',
    },
    {
      regex: '^عمل لمدة\\s+(\\d+)\\s*س$',
      replacement: 'Worked for $1h',
    },
    {
      regex: '^عمل لمدة\\s+(\\d+)\\s*د\\s+(\\d+(?:\\.\\d+)?)\\s*ث$',
      replacement: 'Worked for $1m $2s',
    },
    {
      regex: '^عمل لمدة\\s+(\\d+)\\s*د$',
      replacement: 'Worked for $1m',
    },
    {
      regex: '^عمل لمدة\\s+(\\d+(?:\\.\\d+)?)\\s*ث$',
      replacement: 'Worked for $1s',
    },
    {
      regex: '^توقف بعد\\s+(\\d+)\\s*ي\\s+(\\d+)\\s*س\\s+(\\d+)\\s*د$',
      replacement: 'Stopped after $1d $2h $3m',
    },
    {
      regex: '^توقف بعد\\s+(\\d+)\\s*س\\s+(\\d+)\\s*د\\s+(\\d+(?:\\.\\d+)?)\\s*ث$',
      replacement: 'Stopped after $1h $2m $3s',
    },
    {
      regex: '^توقف بعد\\s+(\\d+)\\s*س\\s+(\\d+)\\s*د$',
      replacement: 'Stopped after $1h $2m',
    },
    {
      regex: '^توقف بعد\\s+(\\d+)\\s*س$',
      replacement: 'Stopped after $1h',
    },
    {
      regex: '^توقف بعد\\s+(\\d+)\\s*د\\s+(\\d+(?:\\.\\d+)?)\\s*ث$',
      replacement: 'Stopped after $1m $2s',
    },
    {
      regex: '^توقف بعد\\s+(\\d+)\\s*د$',
      replacement: 'Stopped after $1m',
    },
    {
      regex: '^توقف بعد\\s+(\\d+(?:\\.\\d+)?)\\s*ث$',
      replacement: 'Stopped after $1s',
    },
    {
      regex: '^توقف بعد\\s+1\\s+خطوة$',
      replacement: 'Stopped after 1 step',
    },
    {
      regex: '^توقف بعد\\s+(\\d+)\\s+خطوة$',
      replacement: 'Stopped after $1 steps',
    },
    {
      regex: '^استغرق\\s+1\\s+ثانية$',
      replacement: 'Timed 1 second',
    },
    {
      regex: '^استغرق\\s+(\\d+)\\s+ثانية$',
      replacement: 'Timed $1 seconds',
    },
    {
      regex: '^استغرق\\s+1\\s+دقيقة$',
      replacement: 'Timed 1 minute',
    },
    {
      regex: '^استغرق\\s+(\\d+)\\s+دقيقة$',
      replacement: 'Timed $1 minutes',
    },

    // 2. Relative timestamps & quota reset/refresh countdowns
    { regex: '^الآن$', replacement: 'Just now' },
    { regex: '^منذ\\s+1\\s+ثانية$', replacement: '1 second ago' },
    { regex: '^منذ\\s+(\\d+)\\s+ثانية$', replacement: '$1 seconds ago' },
    { regex: '^منذ\\s+1\\s+دقيقة$', replacement: '1 minute ago' },
    { regex: '^منذ\\s+(\\d+)\\s+دقيقة$', replacement: '$1 minutes ago' },
    { regex: '^منذ\\s+1\\s+ساعة$', replacement: '1 hour ago' },
    { regex: '^منذ\\s+(\\d+)\\s+ساعة$', replacement: '$1 hours ago' },
    { regex: '^منذ\\s+1\\s+يوم$', replacement: '1 day ago' },
    { regex: '^منذ\\s+(\\d+)\\s+يوم$', replacement: '$1 days ago' },
    { regex: '^منذ\\s+1\\s+أسبوع$', replacement: '1 week ago' },
    { regex: '^منذ\\s+(\\d+)\\s+أسبوع$', replacement: '$1 weeks ago' },
    { regex: '^منذ\\s+1\\s+شهر$', replacement: '1 month ago' },
    { regex: '^منذ\\s+(\\d+)\\s+شهر$', replacement: '$1 months ago' },
    { regex: '^منذ\\s+1\\s+سنة$', replacement: '1 year ago' },
    { regex: '^منذ\\s+(\\d+)\\s+سنة$', replacement: '$1 years ago' },
    {
      regex: '^يُعاد التعيين خلال\\s+(\\d+)\\s+يوم\\s+(\\d+)\\s+ساعة\\s+(\\d+)\\s+دقيقة$',
      replacement: 'Resets in $1d $2h $3m',
    },
    {
      regex: '^يُعاد التعيين خلال\\s+(\\d+)\\s+يوم\\s+(\\d+)\\s+ساعة$',
      replacement: 'Resets in $1d $2h',
    },
    {
      regex: '^يُعاد التعيين خلال\\s+(\\d+)\\s+ساعة\\s+(\\d+)\\s+دقيقة$',
      replacement: 'Resets in $1h $2m',
    },
    {
      regex: '^يُعاد التعيين خلال\\s+(\\d+)\\s+دقيقة\\s+(\\d+)\\s+ثانية$',
      replacement: 'Resets in $1m $2s',
    },
    { regex: '^يُعاد التعيين خلال\\s+(\\d+)\\s+يوم$', replacement: 'Resets in $1d' },
    { regex: '^يُعاد التعيين خلال\\s+(\\d+)\\s+ساعة$', replacement: 'Resets in $1h' },
    { regex: '^يُعاد التعيين خلال\\s+(\\d+)\\s+دقيقة$', replacement: 'Resets in $1m' },
    { regex: '^يُعاد التعيين خلال\\s+(\\d+)\\s+ثانية$', replacement: 'Resets in $1s' },
    { regex: '^يُعاد التعيين خلال أقل من دقيقة$', replacement: 'Resets in less than a minute' },
    { regex: '^يُعاد التعيين خلال بضع ثوانٍ$', replacement: 'Resets in a few seconds' },
    { regex: '^يُعاد التعيين قريباً$', replacement: 'Resets soon' },
    {
      regex: '^يتجدد خلال\\s+(\\d+)\\s+يوم\\s+(\\d+)\\s+ساعة\\s+(\\d+)\\s+دقيقة$',
      replacement: 'Refreshes in $1d $2h $3m',
    },
    {
      regex: '^يتجدد خلال\\s+(\\d+)\\s+يوم\\s+(\\d+)\\s+ساعة$',
      replacement: 'Refreshes in $1d $2h',
    },
    {
      regex: '^يتجدد خلال\\s+(\\d+)\\s+ساعة\\s+(\\d+)\\s+دقيقة$',
      replacement: 'Refreshes in $1h $2m',
    },
    {
      regex: '^يتجدد خلال\\s+(\\d+)\\s+دقيقة\\s+(\\d+)\\s+ثانية$',
      replacement: 'Refreshes in $1m $2s',
    },
    { regex: '^يتجدد خلال\\s+(\\d+)\\s+يوم$', replacement: 'Refreshes in $1d' },
    { regex: '^يتجدد خلال\\s+(\\d+)\\s+ساعة$', replacement: 'Refreshes in $1h' },
    { regex: '^يتجدد خلال\\s+(\\d+)\\s+دقيقة$', replacement: 'Refreshes in $1m' },
    { regex: '^يتجدد خلال\\s+(\\d+)\\s+ثانية$', replacement: 'Refreshes in $1s' },
    { regex: '^يتجدد قريباً$', replacement: 'Refreshes soon' },
    { regex: '^(\\d+)\\s+يوم،\\s*(\\d+)\\s+ساعة$', replacement: '$1 days, $2 hours' },
    { regex: '^(\\d+)\\s+ساعة،\\s*(\\d+)\\s+دقيقة$', replacement: '$1 hours, $2 minutes' },
    { regex: '^1\\s+يوم$', replacement: '1 day' },
    { regex: '^(\\d+)\\s+يوم$', replacement: '$1 days' },
    { regex: '^1\\s+ساعة$', replacement: '1 hour' },
    { regex: '^(\\d+)\\s+ساعة$', replacement: '$1 hours' },
    { regex: '^1\\s+دقيقة$', replacement: '1 minute' },
    { regex: '^(\\d+)\\s+دقيقة$', replacement: '$1 minutes' },

    // 3. File / line / step / item / subagent / conversation / token / git counts
    { regex: '^عرض الكل\\s*\\((\\d+)\\)$', replacement: 'See all ($1)' },
    { regex: '^عرض الكل\\s+(\\d+)$', replacement: 'See all $1' },
    { regex: '^\\(1\\s+وكيل فرعي\\)$', replacement: '(1 subagent)' },
    { regex: '^\\((\\d+)\\s+وكيل فرعي\\)$', replacement: '($1 subagents)' },
    { regex: '^1\\s+وكيل فرعي$', replacement: '1 subagent' },
    { regex: '^(\\d+)\\s+وكيل فرعي$', replacement: '$1 subagents' },
    { regex: '^1\\s+وكيل فرعي نشط$', replacement: '1 active subagent' },
    { regex: '^(\\d+)\\s+وكيل فرعي نشط$', replacement: '$1 active subagents' },
    { regex: '^1\\s+مهمة قيد التشغيل$', replacement: '1 task running' },
    { regex: '^(\\d+)\\s+مهمة قيد التشغيل$', replacement: '$1 tasks running' },
    { regex: '^1\\s+وكيل قيد التشغيل$', replacement: '1 agent running' },
    { regex: '^(\\d+)\\s+وكيل قيد التشغيل$', replacement: '$1 agents running' },
    { regex: '^المهمة\\s+(\\d+)\\s+قيد التشغيل$', replacement: 'Task $1 running' },
    { regex: '^1\\s+ملف تم تعديله$', replacement: '1 file changed' },
    { regex: '^(\\d+)\\s+ملف تم تعديله$', replacement: '$1 files changed' },
    { regex: '^1\\s+إضافة\\(\\+\\)$', replacement: '1 insertion(+)' },
    { regex: '^(\\d+)\\s+إضافة\\(\\+\\)$', replacement: '$1 insertions(+)' },
    { regex: '^1\\s+حذف\\(-\\)$', replacement: '1 deletion(-)' },
    { regex: '^(\\d+)\\s+حذف\\(-\\)$', replacement: '$1 deletions(-)' },
    { regex: '^الخطوة\\s+(\\d+)\\s+من\\s+(\\d+)$', replacement: 'Step $1 of $2' },
    { regex: '^تم إنشاء\\s+1\\s+ملف$', replacement: 'Created 1 file' },
    { regex: '^تم إنشاء\\s+(\\d+)\\s+ملف$', replacement: 'Created $1 files' },
    { regex: '^تم تعديل\\s+1\\s+ملف$', replacement: 'Modified 1 file' },
    { regex: '^تم تعديل\\s+(\\d+)\\s+ملف$', replacement: 'Modified $1 files' },
    { regex: '^تم استكشاف\\s+1\\s+ملف$', replacement: 'Explored 1 file' },
    { regex: '^تم استكشاف\\s+(\\d+)\\s+ملف$', replacement: 'Explored $1 files' },
    { regex: '^تم تشغيل\\s+1\\s+أمر$', replacement: 'Ran 1 command' },
    { regex: '^تم تشغيل\\s+(\\d+)\\s+أمر$', replacement: 'Ran $1 commands' },
    { regex: '^تم استكشاف\\s+1\\s+مهمة$', replacement: 'Explored 1 task' },
    { regex: '^تم استكشاف\\s+(\\d+)\\s+مهمة$', replacement: 'Explored $1 tasks' },
    { regex: '^تم الحفظ الساعة\\s+(\\d{1,2}:\\d{2}(?::\\d{2})?)$', replacement: 'Saved at $1' },
    { regex: '^عرض\\s+1\\s+تفصيل$', replacement: 'Show 1 breakdown' },
    { regex: '^عرض\\s+(\\d+)\\s+تفصيل$', replacement: 'Show $1 breakdowns' },
    { regex: '^إخفاء\\s+1\\s+تفصيل$', replacement: 'Hide 1 breakdown' },
    { regex: '^إخفاء\\s+(\\d+)\\s+تفصيل$', replacement: 'Hide $1 breakdowns' },
    { regex: '^1\\s+محادثة نشطة$', replacement: '1 active conversation' },
    { regex: '^(\\d+)\\s+محادثة نشطة$', replacement: '$1 active conversations' },
    { regex: '^1\\s+محادثة مؤرشفة$', replacement: '1 archived conversation' },
    { regex: '^(\\d+)\\s+محادثة مؤرشفة$', replacement: '$1 archived conversations' },
    { regex: '^تحديد جميع المحادثات \\((\\d+)\\) كمقروءة$', replacement: 'Mark all $1 conversations as read' },
    { regex: '^تحديد\\s+1\\s+محادثة كمقروءة$', replacement: 'Mark 1 conversation as read' },
    { regex: '^تحديد\\s+(\\d+)\\s+محادثة كمقروءة$', replacement: 'Mark $1 conversations as read' },
    { regex: '^تم تحديد\\s+(\\d+)\\s+نموذج$', replacement: '$1 models selected' },
    { regex: '^1\\s+التزام للدفع$', replacement: '1 commit to push' },
    { regex: '^(\\d+)\\s+التزام للدفع$', replacement: '$1 commits to push' },
    { regex: '^1\\s+التزام للسحب$', replacement: '1 commit to pull' },
    { regex: '^(\\d+)\\s+التزام للسحب$', replacement: '$1 commits to pull' },
    { regex: '^الفرع\\s+([a-zA-Z0-9_\\-.\\/]+)$', replacement: 'Branch $1' },
    { regex: '^تم تفعيل\\s+1\\s+أداة$', replacement: '1 tool enabled' },
    { regex: '^تم تفعيل\\s+(\\d+)\\s+أداة$', replacement: '$1 tools enabled' },
    { regex: '^تم تعطيل\\s+1\\s+أداة$', replacement: '1 tool disabled' },
    { regex: '^تم تعطيل\\s+(\\d+)\\s+أداة$', replacement: '$1 tools disabled' },
    { regex: '^تم استبعاد\\s+1\\s+أداة$', replacement: '1 tool excluded' },
    { regex: '^تم استبعاد\\s+(\\d+)\\s+أداة$', replacement: '$1 tools excluded' },
    { regex: '^(\\d+)\\s+أداة$', replacement: '$1 tools' },
    { regex: '^تم خفض مستوى\\s+(\\d+)$', replacement: '$1 demoted' },
    { regex: '^تم استبعاد\\s+(\\d+)$', replacement: '$1 excluded' },
    {
      regex: '^([\\d.]+)%\\s+من ميزانية التخصيص متاحة\\.?$',
      replacement: '$1% of the customization budget is available.',
    },
    {
      regex: '^([\\d,]+)\\s*\\/\\s*([\\d,]+)\\s+رمز\\s*\\(([\\d.]+%)\\)$',
      replacement: '$1 / $2 tokens ($3)',
    },
    { regex: '^\\(([\\d,]+)\\s+رمز\\)\\s*([\\d.]+%)$', replacement: '($1 tokens) $2' },
    { regex: '^\\(([\\d,]+)\\s+رمز\\)$', replacement: '($1 tokens)' },
    { regex: '^السعة غير المستخدمة:\\s*([\\d,]+)\\s+رمز$', replacement: 'Unused capacity: $1 tokens' },
    { regex: '^القواعد:\\s*([\\d,]+)\\s+رمز$', replacement: 'Rules: $1 tokens' },
    { regex: '^المهارات:\\s*([\\d,]+)\\s+رمز$', replacement: 'Skills: $1 tokens' },
    { regex: '^الوكلاء الفرعيون:\\s*([\\d,]+)\\s+رمز$', replacement: 'Subagents: $1 tokens' },
    { regex: '^أدوات MCP:\\s*([\\d,]+)\\s+رمز$', replacement: 'MCP Tools: $1 tokens' },
    { regex: '^خوادم MCP:\\s*([\\d,]+)\\s+رمز$', replacement: 'MCP Servers: $1 tokens' },
    { regex: '^موجّه النظام:\\s*([\\d,]+)\\s+رمز$', replacement: 'System Prompt: $1 tokens' },
    { regex: '^التخصيصات:\\s*([\\d,]+)\\s+رمز$', replacement: 'Customizations: $1 tokens' },
    { regex: '^تخصيصات أخرى:\\s*([\\d,]+)\\s+رمز$', replacement: 'Other Customizations: $1 tokens' },
    { regex: '^اختيار النموذج، الحالي:\\s*(.+)$', replacement: 'Select model, current: $1' },
    {
      regex: '^محدد إعدادات أذونات الوكيل المسبقة، الحالي:\\s*(.+)$',
      replacement: 'Agent permissions preset selector, current: $1',
    },
    { regex: '^خطتك:\\s*(.+)$', replacement: 'Your Plan: $1' },
    { regex: '^مشترك مع:\\s*(.+)$', replacement: 'Shared with: $1' },
    { regex: '^أرصدة الذكاء الاصطناعي المتاحة:\\s*(.+)$', replacement: 'Available AI Credits: $1' },
    {
      regex: '^إرسال الرسالة\\s+(Enter|Return|Ctrl\\+Enter|Cmd\\+Enter|↵)$',
      replacement: 'Send message $1',
    },
    {
      regex: '^إرسال الرسالة\\s+\\((Enter|Return|Ctrl\\+Enter|Cmd\\+Enter|↵)\\)$',
      replacement: 'Send message ($1)',
    },
    {
      regex: '^إلغاء\\s*\\(((?:Ctrl|Cmd|Alt|Shift)\\+[\\w+\\-]+)\\)$',
      replacement: 'Cancel ($1)',
    },
    {
      regex: '^(Enter|Alt\\+Enter|Shift\\+Enter|Ctrl\\+Enter|Cmd\\+Enter)\\s+يُدرج في قائمة الانتظار بعد انتهاء الدور$',
      replacement: '$1 Queues after the turn',
    },
    {
      regex: '^(Enter|Alt\\+Enter|Shift\\+Enter|Ctrl\\+Enter|Cmd\\+Enter)\\s+يُرسل فوراً$',
      replacement: '$1 Sends immediately',
    },
    {
      regex: '^(Enter|Alt\\+Enter|Shift\\+Enter|Ctrl\\+Enter|Cmd\\+Enter)\\s+عند فراغ الحقل، يُرسل الرسالة التالية في قائمة الانتظار$',
      replacement: '$1 On empty prompt, sends next in queue',
    },
    { regex: '^تعمل جميع المهام المجدولة باستخدام\\s+(.+?)\\.?$', replacement: 'All scheduled tasks run as $1.' },
    { regex: '^تعمل جميع الملحقات باستخدام\\s+(.+?)\\.?$', replacement: 'All plugins run as $1.' },
    { regex: '^تعمل جميع مهام الأتمتة باستخدام\\s+(.+?)\\.?$', replacement: 'All automations run as $1.' },
    { regex: '^وكيل بدون اسم\\s+(\\d+)$', replacement: 'Unnamed agent $1' },
    { regex: '^مهارة بدون اسم\\s+(\\d+)$', replacement: 'Unnamed skill $1' },
    { regex: '^إضافة واجهة\\s+(\\d+)$', replacement: 'UI Extension $1' },
    { regex: '^أتمتة\\s+(\\d+)$', replacement: 'Automation $1' },
    { regex: '^قاعدة\\s+(\\d+)$', replacement: 'Rule $1' },

    // 4. Arabic dates & AM/PM timestamps (two-stage fully ^...$ anchored conversion)
    {
      regex: '^(\\d{1,2})\\s+(يناير|فبراير|مارس|أبريل|مايو|يونيو|يوليو|أغسطس|سبتمبر|أكتوبر|نوفمبر|ديسمبر)\\s+(\\d{4})[،,]\\s*(\\d{1,2}:\\d{2}(?::\\d{2})?)\\s*(ص|م)$',
      replacement: '$2 $1, $3, $4 $5',
    },
    {
      regex: '^(\\d{1,2})\\s+(يناير|فبراير|مارس|أبريل|مايو|يونيو|يوليو|أغسطس|سبتمبر|أكتوبر|نوفمبر|ديسمبر)\\s+(\\d{4})[،,]\\s*(\\d{1,2}:\\d{2}(?::\\d{2})?)$',
      replacement: '$2 $1, $3, $4',
    },
    {
      regex: '^(\\d{1,2})\\s+(يناير|فبراير|مارس|أبريل|مايو|يونيو|يوليو|أغسطس|سبتمبر|أكتوبر|نوفمبر|ديسمبر)[،,]\\s*(\\d{1,2}:\\d{2}(?::\\d{2})?)\\s*(ص|م)$',
      replacement: '$2 $1, $3 $4',
    },
    {
      regex: '^(\\d{1,2})\\s+(يناير|فبراير|مارس|أبريل|مايو|يونيو|يوليو|أغسطس|سبتمبر|أكتوبر|نوفمبر|ديسمبر)[،,]\\s*(\\d{1,2}:\\d{2}(?::\\d{2})?)$',
      replacement: '$2 $1, $3',
    },
    {
      regex: '^(\\d{1,2})\\s+(يناير|فبراير|مارس|أبريل|مايو|يونيو|يوليو|أغسطس|سبتمبر|أكتوبر|نوفمبر|ديسمبر)\\s+(\\d{4})$',
      replacement: '$2 $1, $3',
    },
    {
      regex: '^(\\d{1,2})\\s+(يناير|فبراير|مارس|أبريل|مايو|يونيو|يوليو|أغسطس|سبتمبر|أكتوبر|نوفمبر|ديسمبر)\\s*[-–—]\\s*(\\d{1,2})\\s+(يناير|فبراير|مارس|أبريل|مايو|يونيو|يوليو|أغسطس|سبتمبر|أكتوبر|نوفمبر|ديسمبر)$',
      replacement: '$2 $1 - $4 $3',
    },
    {
      regex: '^(\\d{1,2})\\s*[-–—]\\s*(\\d{1,2})\\s+(يناير|فبراير|مارس|أبريل|مايو|يونيو|يوليو|أغسطس|سبتمبر|أكتوبر|نوفمبر|ديسمبر)$',
      replacement: '$3 $1 - $2',
    },
    {
      regex: '^(\\d{1,2})\\s+(يناير|فبراير|مارس|أبريل|مايو|يونيو|يوليو|أغسطس|سبتمبر|أكتوبر|نوفمبر|ديسمبر)$',
      replacement: '$2 $1',
    },
    { regex: '^(\\d{1,2}:\\d{2}(?::\\d{2})?)\\s+ص$', replacement: '$1 AM' },
    { regex: '^(\\d{1,2}:\\d{2}(?::\\d{2})?)\\s+م$', replacement: '$1 PM' },
    {
      regex: '^((?:يناير|فبراير|مارس|أبريل|مايو|يونيو|يوليو|أغسطس|سبتمبر|أكتوبر|نوفمبر|ديسمبر) \\d{1,2}(?:, \\d{4})?, \\d{1,2}:\\d{2}(?::\\d{2})?) ص$',
      replacement: '$1 AM',
    },
    {
      regex: '^((?:يناير|فبراير|مارس|أبريل|مايو|يونيو|يوليو|أغسطس|سبتمبر|أكتوبر|نوفمبر|ديسمبر) \\d{1,2}(?:, \\d{4})?, \\d{1,2}:\\d{2}(?::\\d{2})?) م$',
      replacement: '$1 PM',
    },
    { regex: '^((?:يناير|فبراير|مارس|أبريل|مايو|يونيو|يوليو|أغسطس|سبتمبر|أكتوبر|نوفمبر|ديسمبر) \\d{1,2} - )يناير (\\d{1,2})$', replacement: '$1Jan $2' },
    { regex: '^((?:يناير|فبراير|مارس|أبريل|مايو|يونيو|يوليو|أغسطس|سبتمبر|أكتوبر|نوفمبر|ديسمبر) \\d{1,2} - )فبراير (\\d{1,2})$', replacement: '$1Feb $2' },
    { regex: '^((?:يناير|فبراير|مارس|أبريل|مايو|يونيو|يوليو|أغسطس|سبتمبر|أكتوبر|نوفمبر|ديسمبر) \\d{1,2} - )مارس (\\d{1,2})$', replacement: '$1Mar $2' },
    { regex: '^((?:يناير|فبراير|مارس|أبريل|مايو|يونيو|يوليو|أغسطس|سبتمبر|أكتوبر|نوفمبر|ديسمبر) \\d{1,2} - )أبريل (\\d{1,2})$', replacement: '$1Apr $2' },
    { regex: '^((?:يناير|فبراير|مارس|أبريل|مايو|يونيو|يوليو|أغسطس|سبتمبر|أكتوبر|نوفمبر|ديسمبر) \\d{1,2} - )مايو (\\d{1,2})$', replacement: '$1May $2' },
    { regex: '^((?:يناير|فبراير|مارس|أبريل|مايو|يونيو|يوليو|أغسطس|سبتمبر|أكتوبر|نوفمبر|ديسمبر) \\d{1,2} - )يونيو (\\d{1,2})$', replacement: '$1Jun $2' },
    { regex: '^((?:يناير|فبراير|مارس|أبريل|مايو|يونيو|يوليو|أغسطس|سبتمبر|أكتوبر|نوفمبر|ديسمبر) \\d{1,2} - )يوليو (\\d{1,2})$', replacement: '$1Jul $2' },
    { regex: '^((?:يناير|فبراير|مارس|أبريل|مايو|يونيو|يوليو|أغسطس|سبتمبر|أكتوبر|نوفمبر|ديسمبر) \\d{1,2} - )أغسطس (\\d{1,2})$', replacement: '$1Aug $2' },
    { regex: '^((?:يناير|فبراير|مارس|أبريل|مايو|يونيو|يوليو|أغسطس|سبتمبر|أكتوبر|نوفمبر|ديسمبر) \\d{1,2} - )سبتمبر (\\d{1,2})$', replacement: '$1Sep $2' },
    { regex: '^((?:يناير|فبراير|مارس|أبريل|مايو|يونيو|يوليو|أغسطس|سبتمبر|أكتوبر|نوفمبر|ديسمبر) \\d{1,2} - )أكتوبر (\\d{1,2})$', replacement: '$1Oct $2' },
    { regex: '^((?:يناير|فبراير|مارس|أبريل|مايو|يونيو|يوليو|أغسطس|سبتمبر|أكتوبر|نوفمبر|ديسمبر) \\d{1,2} - )نوفمبر (\\d{1,2})$', replacement: '$1Nov $2' },
    { regex: '^((?:يناير|فبراير|مارس|أبريل|مايو|يونيو|يوليو|أغسطس|سبتمبر|أكتوبر|نوفمبر|ديسمبر) \\d{1,2} - )ديسمبر (\\d{1,2})$', replacement: '$1Dec $2' },
    {
      regex: '^يناير (\\d{1,2}(?:, \\d{4})?(?:, \\d{1,2}:\\d{2}(?::\\d{2})?(?: (?:AM|PM))?)?(?: - (?:[A-Z][a-z]{2} )?\\d{1,2})?)$',
      replacement: 'Jan $1',
    },
    {
      regex: '^فبراير (\\d{1,2}(?:, \\d{4})?(?:, \\d{1,2}:\\d{2}(?::\\d{2})?(?: (?:AM|PM))?)?(?: - (?:[A-Z][a-z]{2} )?\\d{1,2})?)$',
      replacement: 'Feb $1',
    },
    {
      regex: '^مارس (\\d{1,2}(?:, \\d{4})?(?:, \\d{1,2}:\\d{2}(?::\\d{2})?(?: (?:AM|PM))?)?(?: - (?:[A-Z][a-z]{2} )?\\d{1,2})?)$',
      replacement: 'Mar $1',
    },
    {
      regex: '^أبريل (\\d{1,2}(?:, \\d{4})?(?:, \\d{1,2}:\\d{2}(?::\\d{2})?(?: (?:AM|PM))?)?(?: - (?:[A-Z][a-z]{2} )?\\d{1,2})?)$',
      replacement: 'Apr $1',
    },
    {
      regex: '^مايو (\\d{1,2}(?:, \\d{4})?(?:, \\d{1,2}:\\d{2}(?::\\d{2})?(?: (?:AM|PM))?)?(?: - (?:[A-Z][a-z]{2} )?\\d{1,2})?)$',
      replacement: 'May $1',
    },
    {
      regex: '^يونيو (\\d{1,2}(?:, \\d{4})?(?:, \\d{1,2}:\\d{2}(?::\\d{2})?(?: (?:AM|PM))?)?(?: - (?:[A-Z][a-z]{2} )?\\d{1,2})?)$',
      replacement: 'Jun $1',
    },
    {
      regex: '^يوليو (\\d{1,2}(?:, \\d{4})?(?:, \\d{1,2}:\\d{2}(?::\\d{2})?(?: (?:AM|PM))?)?(?: - (?:[A-Z][a-z]{2} )?\\d{1,2})?)$',
      replacement: 'Jul $1',
    },
    {
      regex: '^أغسطس (\\d{1,2}(?:, \\d{4})?(?:, \\d{1,2}:\\d{2}(?::\\d{2})?(?: (?:AM|PM))?)?(?: - (?:[A-Z][a-z]{2} )?\\d{1,2})?)$',
      replacement: 'Aug $1',
    },
    {
      regex: '^سبتمبر (\\d{1,2}(?:, \\d{4})?(?:, \\d{1,2}:\\d{2}(?::\\d{2})?(?: (?:AM|PM))?)?(?: - (?:[A-Z][a-z]{2} )?\\d{1,2})?)$',
      replacement: 'Sep $1',
    },
    {
      regex: '^أكتوبر (\\d{1,2}(?:, \\d{4})?(?:, \\d{1,2}:\\d{2}(?::\\d{2})?(?: (?:AM|PM))?)?(?: - (?:[A-Z][a-z]{2} )?\\d{1,2})?)$',
      replacement: 'Oct $1',
    },
    {
      regex: '^نوفمبر (\\d{1,2}(?:, \\d{4})?(?:, \\d{1,2}:\\d{2}(?::\\d{2})?(?: (?:AM|PM))?)?(?: - (?:[A-Z][a-z]{2} )?\\d{1,2})?)$',
      replacement: 'Nov $1',
    },
    {
      regex: '^ديسمبر (\\d{1,2}(?:, \\d{4})?(?:, \\d{1,2}:\\d{2}(?::\\d{2})?(?: (?:AM|PM))?)?(?: - (?:[A-Z][a-z]{2} )?\\d{1,2})?)$',
      replacement: 'Dec $1',
    },
  ];

  /**
   * Declarative cross-TextNode reverse restoration rules mirroring the forward cross-node
   * transformations in host-i18n-runtime.js:
   *   1. plan-command-fyi-alert: "اكتب " + <code>/plan</code> -> "Type " + <code>/plan</code>
   *   2. also-includes-when-working: "يشمل أيضاً " + <el> + " عند العمل في هذا المشروع." -> "Also includes " + <el> + " when working in this project."
   *   3. trailing-ar-question-after-en: <English sibling> + "؟" -> <English sibling> + "?"
   */
  var REVERSE_CROSS_NODE_RULES = [
    {
      id: 'plan-command-fyi-alert-type',
      kind: 'testid-span-prefix',
      testid: 'plan-command-fyi-alert',
      matchTrimmed: ['اكتب'],
      replacement: 'Type',
    },
    {
      id: 'also-includes-when-working',
      kind: 'element-sandwich',
      leadTrimmed: ['يشمل أيضاً', 'يشمل أيضًا'],
      tailTrimmed: ['عند العمل في هذا المشروع.', 'عند العمل في هذا المشروع'],
      leadReplacement: 'Also includes ',
      tailReplacement: ' when working in this project.',
    },
    {
      id: 'trailing-ar-question-after-en',
      kind: 'trailing-period-after-ascii',
      matchTrimmed: '؟',
      replacement: '?',
    },
  ];

  return {
    REVERSE_EXACT_OVERRIDES: REVERSE_EXACT_OVERRIDES,
    REVERSE_PATTERNS: REVERSE_PATTERNS,
    REVERSE_CROSS_NODE_RULES: REVERSE_CROSS_NODE_RULES,
  };
});
