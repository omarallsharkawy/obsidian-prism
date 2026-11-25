(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.__agCsUsageCore = factory();
})(typeof globalThis !== 'undefined' ? globalThis : window, function () {
  const HOME_HEAT_WEEKS = 26;
  const HOME_HEAT_RAMP = [8, 28, 52, 76, 100];
  const HOME_HEAT_STEPS = HOME_HEAT_RAMP.length;
  const HOME_CHART_DAYS = 30;
  const HOME_MODEL_ROWS = 6;
  const HOME_MODEL_COLOUR_COUNT = 10;

  function numOr(v) {
    return typeof v === 'bigint' ? Number(v) : v;
  }

  function toNum(v) {
    const n = typeof v === 'number' || typeof v === 'bigint' || typeof v === 'string' ? Number(v) : 0;
    return Number.isFinite(n) ? n : 0;
  }

  const L2 = ['en', 'ar'];
  function resolveLang(langOrAr) {
    if (langOrAr === true) return 'ar';
    if (!langOrAr) return 'en';
    const lo = String(langOrAr).trim().toLowerCase().replace(/_/g, '-');
    if (!lo) return 'en';
    if (lo === 'ar' || lo.startsWith('ar-') || lo === 'arabic' || lo === 'العربية') return 'ar';
    return 'en';
  }

  function pick2(arr, langOrAr) {
    const i = L2.indexOf(resolveLang(langOrAr));
    return arr[i >= 0 ? i : 0] ?? arr[0];
  }

  const mkLbls = (a) => Object.fromEntries(L2.map((k, i) => [k, a[i]]));
  const HOME_RANGES = [
    ['all', 0, ['All', 'الكل']],
    ['30d', 30, ['30d', '30 يوماً']],
    ['7d', 7, ['7d', '7 أيام']],
  ].map(([id, days, a]) => ({ id, days, labelEn: a[0], labelAr: a[1], labels: mkLbls(a) }));

  const HOME_BOOKS = `tao|7607|Tao Te Ching|تاو تي تشينغ
yellow|7778|The Yellow Wallpaper|ورق الجدران الأصفر
meta|27557|Metamorphosis|المسخ
jekyll|34713|The Strange Case of Dr Jekyll and Mr Hyde|الدكتور جيكل والسيد هايد
alice|37248|Alice's Adventures in Wonderland|أليس في بلاد العجائب
animal|39000|Animal Farm|مزرعة الحيوان
carol|40306|A Christmas Carol|ترنيمة عيد الميلاد
wild|42383|The Call of the Wild|نداء البرية
time|42817|The Time Machine|آلة الزمن
oz|51004|The Wonderful Wizard of Oz|ساحر أوز العجيب
darkness|52163|Heart of Darkness|قلب الظلام
faust|53930|Faust|فاوست
screw|57484|The Turn of the Screw|دورة اللولب
aesop|60707|Aesop's Fables|خرافات إيسوب
peter|63821|Peter Pan|بيتر بان
gatsby|65763|The Great Gatsby|غاتسبي العظيم
prince|66670|The Prince|الأمير
invisible|68163|The Invisible Man|الرجل الخفي
andersen|73931|Andersen's Fairy Tales|حكايات أندرسن الخيالية
worlds|80168|The War of the Worlds|حرب العوالم
beyond|89836|Beyond Good and Evil|ما وراء الخير والشر
whitefang|96418|White Fang|الناب الأبيض
meditations|96973|Meditations|التأملات
frankenstein|97886|Frankenstein|فرانكنشتاين
stone|100000|Harry Potter and the Philosopher's Stone|هاري بوتر وحجر الفيلسوف
dorian|106339|The Picture of Dorian Gray|صورة دوريان غراي
tolive|115000|To Live|أن تحيا
hobbit|123000|The Hobbit|الهوبيت
grimm|132467|Grimms' Fairy Tales|حكايات الأخوين غريم
1984|136278|Nineteen Eighty-Four|1984
sherlock|138725|The Adventures of Sherlock Holmes|مغامرات شيرلوك هولمز
gulliver|138958|Gulliver's Travels|رحلات غوليفر
walden|152659|Walden|والدن
crusoe|153596|Robinson Crusoe|روبنسون كروزو
huck|154263|Adventures of Huckleberry Finn|مغامرات هكلبري فين
divine|157765|The Divine Comedy|الكوميديا الإلهية
bovary|159575|Madame Bovary|مدام بوفاري
zarathustra|161488|Thus Spoke Zarathustra|هكذا تكلم زرادشت
pride|171701|Pride and Prejudice|كبرياء وتحامل
odyssey|173150|The Odyssey|الأوديسة
twocities|187333|A Tale of Two Cities|قصة مدينتين
threebody|202000|The Three-Body Problem|مشكلة الأجسام الثلاثة
dracula|213648|Dracula|دراكولا
expectations|252176|Great Expectations|آمال عظيمة
janeeyre|256179|Jane Eyre|جين إير
republic|279539|The Republic|الجمهورية
crime|285009|Crime and Punishment|الجريمة والعقاب
leviathan|304696|Leviathan|اللوياثان
moby|306522|Moby-Dick|موبي ديك
darkforest|307000|The Dark Forest|الغابة المظلمة
deathsend|336000|Death's End|نهاية الموت
anna|481659|Anna Karenina|آنا كارنينا
karamazov|487590|The Brothers Karamazov|الإخوة كارامازوف
quixote|574243|Don Quixote|دون كيخوتي
lotr|625000|The Lord of the Rings|سيد الخواتم
kingdoms|638009|Romance of the Three Kingdoms|رومانسية الممالك الثلاث
montecristo|651128|The Count of Monte Cristo|الكونت دي مونت كريستو
warpeace|769001|War and Peace|الحرب والسلام
journeywest|783200|Journey to the West|رحلة إلى الغرب
miserables|801791|Les Misérables|البؤساء
redchamber|903956|Dream of the Red Chamber|حلم الغرفة الحمراء
watermargin|958242|Water Margin|حافة الماء
ordinary|998000|Ordinary World|عالم عادي
harrypotter|1409000|the entire Harry Potter series|سلسلة هاري بوتر الكاملة
losttime|1647000|In Search of Lost Time|البحث عن الزمن المفقود`.split('\n').map((row) => {
    const [key, tk, en, ar] = row.split('|');
    return { key, tokens: +tk, en, ar };
  });

  function homeBookTitle(book, langOrAr) {
    if (!book) return '';
    const l = resolveLang(langOrAr);
    return l === 'ar' ? (book.ar || book.en) : book.en;
  }

  function homeRangeLabel(rangeOrId, langOrZh) {
    const r = typeof rangeOrId === 'string' ? (HOME_RANGES.find((x) => x.id === rangeOrId) || HOME_RANGES[0]) : rangeOrId;
    if (!r) return '';
    const l = resolveLang(langOrZh);
    return (r.labels && (r.labels[l] ?? r.labels.en)) || r.labelEn || '';
  }

  function pad2(v) {
    return v < 10 ? '0' + v : String(v);
  }

  function homeDayKey(date) {
    const d = date instanceof Date ? date : new Date(numOr(date));
    return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
  }

  function homeRangeStart(windowDays, nowDate) {
    if (!windowDays) return null;
    const start = nowDate ? new Date(nowDate.getTime()) : new Date();
    start.setHours(0, 0, 0, 0);
    start.setDate(start.getDate() - (windowDays - 1));
    return homeDayKey(start);
  }

  function formatHomeCount(count) {
    const value = Math.round(toNum(count));
    return String(value).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  }

  function formatCompactTokens(count) {
    const value = toNum(count);
    const units = [[1e9, 'B'], [1e6, 'M'], [1e3, 'k']];
    for (let u = 0; u < units.length; u++) {
      const scaled = Math.round((value / units[u][0]) * 10) / 10;
      if (scaled >= 1) return String(scaled) + units[u][1];
    }
    return String(Math.round(value));
  }

  function formatHomeHour(hour, langOrAr) {
    const h = ((Math.floor(toNum(hour)) % 24) + 24) % 24;
    const h12 = h % 12 || 12;
    const pm = h >= 12 ? 1 : 0;
    const l = resolveLang(langOrAr);
    if (l === 'ar') return h12 + (pm ? ' م' : ' ص');
    return h12 + (pm ? ' PM' : ' AM');
  }

  function homeShortDateFormat(langOrAr) {
    return new Intl.DateTimeFormat(pick2(['en-US', 'ar-EG'], langOrAr), { month: 'short', day: 'numeric' });
  }

  function homeShortDate(format, day) {
    const parts = String(day || '').split('-');
    if (parts.length !== 3) return String(day || '');
    return format.format(new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2])));
  }

  function tsToMs(ts) {
    if (!ts) return 0;
    if (typeof ts === 'number') return Number.isFinite(ts) ? ts : 0;
    if (typeof ts === 'string' || typeof ts === 'bigint') {
      const parsed = typeof ts === 'string' ? Date.parse(ts) : NaN;
      if (Number.isFinite(parsed) && parsed > 0) return parsed;
      const num = toNum(ts);
      return num > 0 ? (num > 1e11 ? num : num * 1000) : 0;
    }
    const sec = toNum(ts.seconds);
    return sec > 0 ? sec * 1000 + Math.floor(toNum(ts.nanos) / 1e6) : 0;
  }

  function cleanModelName(val) {
    const d = String(val?.modelDisplayName || val?.responseModel || val?.modelName || '').trim();
    if (d) return d;
    const m = val?.model, ms = typeof m === 'string' ? m.trim() : '';
    return ms ? (/^\d+$/.test(ms) ? 'Model #' + ms : ms) : m ? 'Model #' + m : 'unknown';
  }

  function eqId(a, b) { return !!(a && b && String(a).trim().toLowerCase() === String(b).trim().toLowerCase()); }

  const pickS = (...a) => String(a.find(Boolean) || '').trim();
  function isSubagentSummary(summary, selfId) {
    if (!summary || typeof summary !== 'object') return false;
    const s = pickS(selfId, summary.cascadeId, summary.id), m = summary.trajectoryMetadata || {};
    const p = pickS(m.parentConversationId, summary.parentConversationId, summary.parentId);
    const r = pickS(m.rootConversationId, summary.rootConversationId, summary.rootId);
    return !!((p && !eqId(p, s)) || (s && r && !eqId(r, s)) || toNum(m.nestingDepth) > 0 || (summary.subagent === true && !eqId(p, s) && !eqId(r, s)));
  }

  function normalizeWorkspaceLabel(rawUriOrPath) {
    let s = String(rawUriOrPath || '').trim();
    if (!s) return '';
    try { s = decodeURIComponent(s.replace(/^file:\/\//i, '')); } catch {}
    return s.replace(/[\\/]+$/, '').split(/[\\/]/).filter(Boolean).pop() || '';
  }

  function extractWorkspaceId(summaryObj, trajObj) {
    if (typeof summaryObj?.workspace === 'string' && summaryObj.workspace.trim()) return normalizeWorkspaceLabel(summaryObj.workspace);
    const tm = summaryObj?.trajectoryMetadata;
    const ws = summaryObj?.workspaces || tm?.workspaces || trajObj?.metadata?.workspaces;
    const f = Array.isArray(ws) ? ws[0] : null;
    return normalizeWorkspaceLabel(f?.workspaceFolderAbsoluteUri || f?.gitRootAbsoluteUri || f?.uri || f?.path || summaryObj?.workspaceUri || summaryObj?.workspacePath || tm?.workspaceUri || '');
  }

  function extractParentConversationId(summaryObj, trajObj, selfId) {
    const s = pickS(selfId, summaryObj?.cascadeId, summaryObj?.id, trajObj?.cascadeId), tm = summaryObj?.trajectoryMetadata;
    const p = pickS(tm?.parentConversationId, summaryObj?.parentConversationId, summaryObj?.parentId, trajObj?.metadata?.parentConversationId);
    if (p) return eqId(p, s) ? '' : p;
    const r = pickS(tm?.rootConversationId, summaryObj?.rootConversationId, summaryObj?.rootId);
    return r && s && !eqId(r, s) ? r : '';
  }

  const M_KEYS = ['input', 'output', 'cacheRead', 'cacheWrite', 'total', 'calls'];
  const mkMod = () => ({ input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0, calls: 0 });
  const mkDay = () => ({ calls: 0, input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0, hours: new Array(24).fill(0), models: {} });

  // Extract a compact, JSON-serializable per-conversation usage record for caching.
  function analyzeTrajectoryForUsage(trajObj, summaryObj, cascadeId) {
    const t = trajObj?.response?.trajectory || trajObj?.trajectory || trajObj || {};
    const steps = Array.isArray(t.steps) ? t.steps : [];
    const gmList = Array.isArray(t.generatorMetadata) ? t.generatorMetadata : [];
    const stepTime = new Map();
    for (let i = 0; i < steps.length; i++) {
      const ms = tsToMs(steps[i]?.metadata?.createdAt || steps[i]?.createdAt);
      if (ms > 0) stepTime.set(i, ms);
    }
    const createdMs = tsToMs(summaryObj?.createdTime) || tsToMs(t?.metadata?.createdAt) || 0;
    const lastModMs = tsToMs(summaryObj?.lastModifiedTime) || 0;
    const fallbackMs = lastModMs || createdMs || 0;
    const totalStepSpan = Math.max(1, toNum(summaryObj?.stepCount ?? trajObj?.numTotalSteps ?? steps.length ?? 1));

    const days = {}; // YYYY-MM-DD -> { calls, input, output, cacheRead, cacheWrite, total, hours: number[24], models: { [id]: { input, output, cacheRead, cacheWrite, total, calls } } }
    let calls = 0;

    for (let i = 0; i < gmList.length; i++) {
      const val = gmList[i]?.metadata?.value || gmList[i]?.chatModel;
      if (!val) continue;
      const u = val.usage || val.retryInfos?.[val.retryInfos.length - 1]?.usage || gmList[i]?.usage;
      if (!u) continue;
      const [input, cacheRead, cacheWrite, output] = [u.inputTokens, u.cacheReadTokens, u.cacheWriteTokens, u.outputTokens].map(toNum);
      const total = input + cacheRead + cacheWrite + output;
      if (total <= 0 && !input && !output) continue;

      calls += 1;
      const sIndices = Array.isArray(gmList[i].stepIndices) ? gmList[i].stepIndices : [];
      let ts = 0;
      for (const idx of sIndices) {
        const hit = stepTime.get(numOr(idx));
        if (hit) { ts = hit; break; }
      }
      if (!ts) {
        const chatMs = tsToMs(val?.chatStartMetadata?.createdAt);
        ts = chatMs > 0
          ? chatMs
          : !steps.length && createdMs > 0 && lastModMs > createdMs && sIndices.length > 0
          ? Math.round(createdMs + Math.min(1, Math.max(0, toNum(sIndices[0]) / totalStepSpan)) * (lastModMs - createdMs))
          : fallbackMs;
      }
      if (!ts) continue;

      const d = new Date(ts);
      const dayKey = homeDayKey(d);
      const hour = d.getHours();
      const modelId = cleanModelName(val);

      const day = days[dayKey] || (days[dayKey] = mkDay());
      const mod = day.models[modelId] || (day.models[modelId] = mkMod());
      for (const o of [day, mod]) { o.calls += 1; o.input += input; o.output += output; o.cacheRead += cacheRead; o.cacheWrite += cacheWrite; o.total += total; }
      day.hours[hour] = (day.hours[hour] || 0) + 1;
    }

    const lastModifiedSec =
      toNum(summaryObj?.lastModifiedSec) ||
      toNum(summaryObj?.lastModifiedTime?.seconds) ||
      (lastModMs > 0 ? Math.floor(lastModMs / 1000) : 0);
    const workspace = extractWorkspaceId(summaryObj, t);
    const parentId = extractParentConversationId(summaryObj, t, cascadeId);

    return {
      cascadeId: String(cascadeId || t.cascadeId || ''),
      stepCount: Math.max(toNum(summaryObj?.stepCount), toNum(trajObj?.numTotalSteps), steps.length),
      lastModifiedSec,
      gmCount: toNum(trajObj?.numTotalGeneratorMetadata ?? gmList.length),
      subagent: isSubagentSummary(summaryObj, cascadeId),
      workspace,
      parentId,
      calls,
      days,
    };
  }

  function mergeUsageRecordDelta(baseRec, deltaRec, nextMeta = {}) {
    if (!baseRec || !baseRec.days) return deltaRec;
    const days = {};
    for (const src of [baseRec.days, deltaRec?.days]) {
      if (!src) continue;
      for (const [dk, dd] of Object.entries(src)) {
        if (!dd) continue;
        const dst = days[dk] || (days[dk] = mkDay());
        for (const k of M_KEYS) dst[k] += toNum(dd[k]);
        if (Array.isArray(dd.hours)) {
          for (let h = 0; h < 24; h++) dst.hours[h] = (dst.hours[h] || 0) + toNum(dd.hours[h]);
        }
        for (const [mk, mv] of Object.entries(dd.models || {})) {
          if (!mv) continue;
          const dm = dst.models[mk] || (dst.models[mk] = mkMod());
          for (const k of M_KEYS) dm[k] += toNum(mv[k]);
        }
      }
    }
    const cid = String(nextMeta.cascadeId ?? deltaRec?.cascadeId ?? baseRec.cascadeId ?? '');
    const p = String(nextMeta.parentId ?? deltaRec?.parentId ?? baseRec.parentId ?? '').trim();
    const r = String(nextMeta.rootId ?? deltaRec?.rootId ?? baseRec.rootId ?? '').trim();
    const sp = eqId(p, cid) || (!p && eqId(r, cid));
    const bp = eqId(baseRec.parentId, cid) || (!baseRec.parentId && eqId(baseRec.rootId || baseRec.rootConversationId, cid));
    return {
      cascadeId: cid,
      stepCount: toNum(nextMeta.stepCount ?? deltaRec?.stepCount ?? baseRec.stepCount ?? 0),
      lastModifiedSec: toNum(nextMeta.lastModifiedSec ?? deltaRec?.lastModifiedSec ?? baseRec.lastModifiedSec ?? 0),
      gmCount: toNum(nextMeta.gmCount ?? deltaRec?.gmCount ?? baseRec.gmCount ?? 0),
      subagent: sp ? false : Boolean(nextMeta.subagent ?? deltaRec?.subagent ?? (bp ? false : baseRec.subagent)),
      workspace: String(nextMeta.workspace ?? deltaRec?.workspace ?? baseRec.workspace ?? ''),
      parentId: sp ? '' : p,
      calls: toNum(baseRec.calls) + toNum(deltaRec?.calls),
      days,
    };
  }

  function homeHeatGrid(dayTotalsMap, nowDate) {
    const today = nowDate ? new Date(nowDate.getTime()) : new Date();
    today.setHours(0, 0, 0, 0);
    const start = new Date(today);
    start.setDate(start.getDate() - (HOME_HEAT_WEEKS * 7 - 1));
    start.setDate(start.getDate() - start.getDay());
    const cells = [];
    let peak = 0;
    for (const cursor = new Date(start); cursor <= today; cursor.setDate(cursor.getDate() + 1)) {
      const key = homeDayKey(cursor);
      const tokens = toNum(dayTotalsMap[key]);
      if (tokens > peak) peak = tokens;
      cells.push({ date: key, tokens, level: 0 });
    }
    for (const cell of cells) {
      if (cell.tokens > 0 && peak > 0) cell.level = Math.max(1, Math.min(HOME_HEAT_STEPS, Math.ceil((cell.tokens / peak) * HOME_HEAT_STEPS)));
    }
    return { cells, peak };
  }

  function aggregateUsageRollup(records, rangeId, bookPick, zh, nowDate, options = {}) {
    const list = Array.isArray(records) ? records : [];
    const rangeObj = HOME_RANGES.find((r) => r.id === rangeId) || HOME_RANGES[0];
    const start = homeRangeStart(rangeObj.days, nowDate);
    const inRange = (dateStr) => start === null || dateStr >= start;
    const workspaceFilter = typeof options?.workspace === 'string' && options.workspace && options.workspace !== 'all' ? options.workspace : '';
    const incArch = options?.includeArchived !== false;

    const byId = new Map();
    for (const r of list) if (r?.cascadeId) byId.set(r.cascadeId, r);
    const walkRec = (rec, fn) => {
      for (let c = rec, h = 0; c && h < 5; h++) {
        const v = fn(c);
        if (v) return v;
        if (!c.parentId || eqId(c.parentId, c.cascadeId)) break;
        c = byId.get(c.parentId);
      }
      return '';
    };

    let totalTokens = 0;
    let mainTokens = 0;
    let subagentTokens = 0;
    let totalCalls = 0;
    let totalInput = 0;
    let totalCacheRead = 0;
    let hasArch = false;
    const sessionSet = new Set();
    const actSet = new Set();
    const archSet = new Set();
    const subagentSessionSet = new Set();
    const activeDaySet = new Set();
    const hourCounts = new Array(24).fill(0);
    const modelTotals = {}; // modelId -> { id, input, output, cacheRead, cacheWrite, tokens, subagentTokens, calls, sessionsSet: Set }
    const allDayTotals = {}; // full calendar day -> tokens (heat grid shows 26 weeks)
    const allDayModels = {}; // full calendar day -> { modelId: tokens } (chart shows 30d/7d)
    const workspaceMap = {}; // wsId -> { id, tokens, sessionsSet: Set }

    for (let i = 0; i < list.length; i++) {
      const rec = list[i];
      if (!rec || !rec.days) continue;
      const rid = rec.cascadeId || String(i);
      const isSub = !!(rec.subagent && !eqId(rec.parentId, rec.cascadeId) && (rec.parentId || !eqId(rec.rootId || rec.rootConversationId, rec.cascadeId)));
      const isArch = Boolean(walkRec(rec, (c) => c.archived));
      if (!isSub && isArch) hasArch = true;
      const wsId = String(walkRec(rec, (c) => c.workspace) || '');
      const dayKeys = Object.keys(rec.days);
      const matchWs = !workspaceFilter || wsId === workspaceFilter;

      if (!isSub && isArch && matchWs && dayKeys.some((dk) => inRange(dk) && (toNum(rec.days[dk]?.total) > 0 || toNum(rec.days[dk]?.calls) > 0))) archSet.add(rid);
      if (!incArch && isArch) continue;

      const wsEntry = wsId ? workspaceMap[wsId] || (workspaceMap[wsId] = { id: wsId, tokens: 0, sessionsSet: new Set() }) : null;
      let countedSessionInRange = false;
      for (const dk of dayKeys) {
        const day = rec.days[dk];
        if (!day) continue;
        const dTotal = toNum(day.total);
        const dCalls = toNum(day.calls);
        const okRange = inRange(dk);
        if (wsEntry && okRange) {
          wsEntry.tokens += dTotal;
          if (!isSub && (dTotal > 0 || dCalls > 0)) wsEntry.sessionsSet.add(rid);
        }
        if (!matchWs) continue;
        allDayTotals[dk] = (allDayTotals[dk] || 0) + dTotal;
        if (day.models) {
          const dm = allDayModels[dk] || (allDayModels[dk] = {});
          for (const [mId, mData] of Object.entries(day.models)) dm[mId] = (dm[mId] || 0) + toNum(mData.total);
        }
        if (!okRange) continue;
        if (dTotal > 0 || dCalls > 0) {
          activeDaySet.add(dk);
          if (isSub) subagentSessionSet.add(rid);
          else if (!countedSessionInRange) {
            sessionSet.add(rid);
            if (!isArch) actSet.add(rid);
            countedSessionInRange = true;
          }
        }
        totalTokens += dTotal;
        if (isSub) subagentTokens += dTotal;
        else mainTokens += dTotal;
        totalCalls += dCalls;
        const dCacheRead = toNum(day.cacheRead);
        totalInput += toNum(day.input) + dCacheRead + toNum(day.cacheWrite);
        totalCacheRead += dCacheRead;
        if (Array.isArray(day.hours)) for (let h = 0; h < 24; h++) hourCounts[h] += toNum(day.hours[h]);
        if (day.models) {
          for (const [mId, mData] of Object.entries(day.models)) {
            const entry = modelTotals[mId] || (modelTotals[mId] = { id: mId, input: 0, output: 0, cacheRead: 0, cacheWrite: 0, tokens: 0, subagentTokens: 0, calls: 0, sessionsSet: new Set() });
            const mTok = toNum(mData.total);
            for (const k of ['input', 'output', 'cacheRead', 'cacheWrite', 'calls']) entry[k] += toNum(mData[k]);
            entry.tokens += mTok;
            if (isSub) entry.subagentTokens += mTok;
            if (!isSub) entry.sessionsSet.add(rid);
          }
        }
      }
    }

    let bestHour = 0;
    let hourSum = 0;
    for (let h = 0; h < 24; h++) {
      hourSum += hourCounts[h];
      if (hourCounts[h] > hourCounts[bestHour]) bestHour = h;
    }
    const peakHour = hourSum > 0 ? formatHomeHour(bestHour, zh) : null;

    const models = Object.values(modelTotals)
      .map(({ sessionsSet, ...m }) => {
        const mInp = m.input + m.cacheRead + m.cacheWrite;
        return { ...m, cacheHitRate: mInp > 0 ? m.cacheRead / mInp : null, sessions: sessionsSet.size };
      })
      .sort((a, b) => b.tokens - a.tokens || b.calls - a.calls || a.id.localeCompare(b.id));

    const workspaces = Object.values(workspaceMap)
      .map((w) => ({ id: w.id, tokens: w.tokens, sessions: w.sessionsSet.size }))
      .filter((w) => w.tokens > 0 || w.sessions > 0)
      .sort((a, b) => b.tokens - a.tokens || a.id.localeCompare(b.id));

    const favModel = models.length > 0 ? models[0].id : null;

    // Book comparison
    let funBook = null;
    if (totalTokens > 0) {
      const pick = typeof bookPick === 'number' && Number.isFinite(bookPick) ? Math.max(0, Math.min(0.999999, bookPick)) : 0.07;
      let idx = Math.min(HOME_BOOKS.length - 1, Math.floor(pick * HOME_BOOKS.length));
      while (idx >= 0 && totalTokens < HOME_BOOKS[idx].tokens) idx -= 1;
      if (idx >= 0) {
        const book = HOME_BOOKS[idx];
        const count = Math.max(1, Math.round(totalTokens / book.tokens));
        const l = resolveLang(zh);
        const title = homeBookTitle(book, l);
        const cntStr = formatHomeCount(count);
        funBook = pick2([
          `You've used ~${cntStr}× the tokens in ${title}.`,
          `لقد استهلكت ما يعادل ~${cntStr}× من رموز «${title}».`,
        ], l);
      }
    }

    // Chart columns (last 30d or 7d)
    const chartSpan = rangeObj.days > 0 && rangeObj.days < HOME_CHART_DAYS ? rangeObj.days : HOME_CHART_DAYS;
    const chartStart = homeRangeStart(chartSpan, nowDate);
    const modelDays = Object.keys(allDayModels)
      .filter((dk) => dk >= chartStart)
      .sort()
      .map((dk) => ({ date: dk, models: allDayModels[dk] }));

    return {
      sessions: sessionSet.size,
      activeSessions: actSet.size,
      archivedSessions: archSet.size,
      hasArchived: hasArch,
      subagentSessions: subagentSessionSet.size,
      calls: totalCalls,
      tokens: totalTokens,
      mainTokens,
      subagentTokens,
      totalInput,
      cacheReadTokens: totalCacheRead,
      cacheHitRate: totalInput > 0 ? totalCacheRead / totalInput : null,
      activeDays: activeDaySet.size,
      peakHour,
      model: favModel,
      grid: homeHeatGrid(allDayTotals, nowDate),
      funBook,
      models,
      modelDays,
      workspaces,
    };
  }

  // ── v0.9.1 Quota Pools, Argon Weekly Allowance & Linear Depletion Forecast ──
  function quotaGroupKind(group) {
    if (!group || typeof group !== 'object') return 'other';
    const w5 = group.windows?.['5h']?.id || group.fiveHour?.id || '';
    const ww = group.windows?.weekly?.id || group.weekly?.id || '';
    const hay = `${group.id || ''} ${group.name || ''} ${group.description || ''} ${w5} ${ww}`.toLowerCase();
    if (/argon|wtu/.test(hay)) return 'gemini-argon';
    if (/claude|anthropic|gpt|openai/.test(hay)) return 'claude';
    if (/gemini|google/.test(hay)) return 'gemini';
    return 'other';
  }

  const Q_KIND_LBL = { 'gemini-argon': 'Gemini (Argon)', claude: 'Claude / GPT', gemini: 'Gemini' };
  const Q_POOL_FB = ['Quota Pool', 'مجموعة الحصة'];
  function quotaGroupLabel(group, langOrAr) {
    return Q_KIND_LBL[quotaGroupKind(group)] || String(group?.name || group?.id || '').trim() || pick2(Q_POOL_FB, langOrAr);
  }

  function quotaRemaining(bucket) {
    if (!bucket || typeof bucket !== 'object' || bucket.available === false || bucket.disabled === true) return null;
    if (bucket.expired === true) return 1;
    const r = numOr(bucket.remaining ?? bucket.remainingFraction);
    const n = typeof r === 'number' ? r : typeof r === 'string' && r.trim() ? Number(r) : NaN;
    return Number.isFinite(n) ? Math.max(0, Math.min(1, n)) : null;
  }

  function quotaWindows(group) {
    if (!group || typeof group !== 'object') return [];
    return [['5h', group.windows?.['5h'] || group.fiveHour], ['weekly', group.windows?.weekly || group.weekly]].filter(([, b]) => b && quotaRemaining(b) !== null);
  }

  function chooseQuotaGroup(groups, models, selectedId) {
    const list = Array.isArray(groups) ? groups.filter((g) => g && typeof g === 'object') : [];
    if (!list.length) return null;
    if (selectedId) {
      const hit = list.find((g) => g.id === selectedId || g.name === selectedId);
      if (hit) return hit;
    }
    const byK = (k) => list.find((g) => quotaGroupKind(g) === k);
    const modelStr = (Array.isArray(models) ? models.join(' ') : String(models || '')).toLowerCase();
    const pick = /argon/.test(modelStr)
      ? byK('gemini-argon') || byK('gemini')
      : /claude|anthropic|sonnet|opus|haiku|gpt|openai|o1|o3|o4/.test(modelStr)
      ? byK('claude')
      : /gemini|carbon|hydrogen|pro|flash/.test(modelStr)
      ? byK('gemini') || byK('gemini-argon')
      : null;
    return pick || list.find((g) => quotaWindows(g).length > 0) || list[0];
  }

  const REFRESHING_L = ['Refreshing', 'جاري التحديث'];

  const ETA_U = ['d|h|m|m| ', 'ي|س|د|د| '];
  function fmtEtaSec(totalSec, l) {
    const d = Math.floor(totalSec / 86400);
    const h = Math.floor((totalSec % 86400) / 3600);
    const m = Math.floor((totalSec % 3600) / 60);
    const u = pick2(ETA_U, l).split('|');
    return d > 0 ? `${d}${u[0]}${u[4]}${h}${u[1]}` : h > 0 ? `${h}${u[1]}${u[4]}${m}${u[2]}` : `${Math.max(1, m)}${u[3]}`;
  }

  function shortEta(ms, langOrAr) {
    const l = resolveLang(langOrAr);
    const v = numOr(ms);
    if (!(v > 0) || !Number.isFinite(v)) return pick2(REFRESHING_L, l);
    return fmtEtaSec(Math.max(1, Math.round(v / 1000)), l);
  }

  function quotaForecast(bucket, windowKey, nowMs = Date.now()) {
    const rem = quotaRemaining(bucket);
    if (rem === null) return null;
    const now = numOr(nowMs);
    const spanMs = windowKey === 'weekly' ? 7 * 86400 * 1000 : 5 * 3600 * 1000;
    const r0 = numOr(bucket?.resetAt ?? bucket?.resetTime);
    const resetMs = typeof r0 === 'number' ? (r0 > 1e11 ? r0 : r0 * 1000) : (tsToMs(r0) || NaN);
    const mkFc = (endRemaining, forecastDrop, willExhaust, exhaustInMs, paceRatio, status, resetAtMs, resetInMs) => ({
      window: windowKey, remaining: rem, endRemaining, forecastDrop, willExhaust, exhaustInMs, paceRatio, status, resetAtMs, resetInMs,
    });

    if (!Number.isFinite(resetMs) || resetMs <= now) {
      return mkFc(rem, 0, false, null, 0, rem < 1 ? 'ok' : 'idle', Number.isFinite(resetMs) ? resetMs : null, 0);
    }

    const leftMs = Math.max(0, Math.min(spanMs, resetMs - now));
    const elapsedMs = Math.max(0, spanMs - leftMs);
    const used = Math.max(0, 1 - rem);
    const minSmoothMs = windowKey === 'weekly' ? 2 * 3600 * 1000 : 15 * 60 * 1000;

    if (used < 0.005 || elapsedMs < 3 * 60 * 1000) {
      return mkFc(rem, 0, rem <= 0.005, rem <= 0.005 ? 0 : null, 0, rem <= 0.005 ? 'exhaust' : 'idle', resetMs, leftMs);
    }

    const burnPerMs = used / Math.max(elapsedMs, minSmoothMs);
    const endRemaining = Math.max(0, Math.min(rem, rem - burnPerMs * leftMs));
    const idealUsed = spanMs > 0 ? elapsedMs / spanMs : 0;
    const paceRatio = idealUsed > 0.02 ? used / idealUsed : used / 0.02;
    const timeToZeroMs = burnPerMs > 0 ? rem / burnPerMs : Infinity;
    const willExhaust = rem <= 0.01 || (timeToZeroMs < leftMs * 0.95 && used >= 0.06);
    const status = willExhaust ? 'exhaust' : paceRatio > 1.18 && used >= 0.05 ? 'tight' : used < 0.01 ? 'idle' : 'ok';

    return mkFc(
      endRemaining,
      Math.max(0, rem - endRemaining),
      willExhaust,
      Number.isFinite(timeToZeroMs) && willExhaust ? Math.max(0, Math.round(timeToZeroMs)) : null,
      Number(paceRatio.toFixed(2)),
      status,
      resetMs,
      leftMs
    );
  }

  const Q_LBL = {
    exhaust: ['Depleting early', 'ينفد مبكراً'],
    tight: ['Burning fast', 'استهلاك سريع'],
    ok: ['On track', 'ضمن المعدل'],
    idle: ['Standby', 'جاهز'],
  };
  function groupQuotaPace(group, langOrAr, nowMs = Date.now()) {
    const l = resolveLang(langOrAr);
    const forecasts = quotaWindows(group).map(([wk, b]) => quotaForecast(b, wk, nowMs)).filter(Boolean);
    const rank = { exhaust: 3, tight: 2, ok: 1, idle: 0 };
    let primary = null;
    for (const f of forecasts) {
      if (!primary || (rank[f.status] ?? 0) > (rank[primary.status] ?? 0)) primary = f;
    }
    const status = primary ? primary.status : 'idle';
    const label = pick2(Q_LBL[status] || Q_LBL.idle, l);
    let detail = '';
    if (primary) {
      if (primary.willExhaust && primary.exhaustInMs !== null) {
        const eta = shortEta(primary.exhaustInMs, l);
        detail = pick2([`Est. empty in ${eta}`, `يُتوقع النفاد خلال ${eta}`], l);
      } else if (primary.resetInMs > 0) {
        const eta = shortEta(primary.resetInMs, l);
        const endPct = Math.round(primary.endRemaining * 100);
        detail = pick2([`Resets in ${eta} · Est. ${endPct}% left`, `إعادة التعيين خلال ${eta} · المتوقع المتبقي ${endPct}%`], l);
      }
    }
    return { status, label, detail, primary, forecasts };
  }

  function axisMax(peak) {
    const p = numOr(peak);
    if (!(p > 0)) return 0;
    const magnitude = Math.pow(10, Math.floor(Math.log(p) / Math.LN10));
    const scaled = p / magnitude;
    const step = scaled <= 1 ? 1 : scaled <= 2 ? 2 : scaled <= 2.5 ? 2.5 : scaled <= 5 ? 5 : 10;
    return step * magnitude;
  }

  function homeChartTicks(widths, axisWidth, gap = 8, columnGap = 2) {
    const n = widths.length;
    if (!n || !(axisWidth > 0)) return [];
    const col = (axisWidth - columnGap * (n - 1)) / n;
    if (!(col > 0)) return [];
    const widest = Math.max(0, ...widths);
    const need = widest + gap + Math.max(0, (widest - col) / 2);
    let step = 1;
    while (step < n && step * (col + columnGap) < need) step += 1;
    const boxes = [];
    for (let i = n - 1; i >= 0; i -= step) {
      const w = widths[i];
      boxes.unshift({ index: i, left: Math.min(Math.max(i * (col + columnGap) + (col - w) / 2, 0), Math.max(axisWidth - w, 0)) });
    }
    const kept = [];
    for (let i = boxes.length - 1; i >= 0; i--) {
      if (!kept[0] || boxes[i].left + widths[boxes[i].index] + gap <= kept[0].left) kept.unshift(boxes[i]);
    }
    return kept;
  }

  function createHomeModelColours() {
    const assigned = new Map();
    return function assign(ids) {
      const out = {};
      for (const id of Array.from(new Set(ids)).sort()) {
        if (assigned.has(id)) { out[id] = assigned.get(id); continue; }
        const used = new Set(assigned.values());
        let h = 2166136261;
        for (let i = 0; i < id.length; i++) h = Math.imul(h ^ id.charCodeAt(i), 16777619);
        let c = (h >>> 0) % HOME_MODEL_COLOUR_COUNT;
        while (used.size < HOME_MODEL_COLOUR_COUNT && used.has(c)) c = (c + 1) % HOME_MODEL_COLOUR_COUNT;
        assigned.set(id, c);
        out[id] = c;
      }
      return out;
    };
  }

  function durSec(d) {
    return !d ? 0 : typeof d === 'object' ? toNum(d.seconds) + toNum(d.nanos) / 1e9 : toNum(d);
  }

  function tsSec(ts) {
    if (!ts) return 0;
    if (typeof ts === 'string') { const ms = Date.parse(ts); return Number.isFinite(ms) ? ms / 1000 : toNum(ts); }
    return durSec(ts);
  }

  function fmtK(n) {
    const v = toNum(n);
    if (v >= 1000000) return (v / 1000000).toFixed(2) + 'M';
    if (v >= 1000) return (v / 1000).toFixed(1) + 'K';
    return String(Math.round(v));
  }

  function fmtInt(n) {
    return toNum(n).toLocaleString();
  }

  function fmtPct(p, digits = 1) {
    const v = toNum(p);
    return v.toFixed(digits) + '%';
  }

  function fmtSec(s) {
    const v = toNum(s);
    if (v <= 0) return '—';
    if (v < 1) return Math.round(v * 1000) + 'ms';
    return v.toFixed(1) + 's';
  }

  function fmtResetTime(tsSeconds, langOrAr, nowSec) {
    const n0 = numOr(nowSec);
    const now = typeof n0 === 'number' ? n0 : Date.now() / 1000;
    const sec = (tsSeconds && typeof tsSeconds === 'object' ? tsSec(tsSeconds) : toNum(tsSeconds)) - now;
    const l = resolveLang(langOrAr);
    return sec <= 0 ? pick2(REFRESHING_L, l) : fmtEtaSec(sec, l);
  }

  return {
    HOME_HEAT_WEEKS,
    HOME_HEAT_RAMP,
    HOME_HEAT_STEPS,
    HOME_CHART_DAYS,
    HOME_MODEL_ROWS,
    HOME_RANGES,
    HOME_BOOKS,
    resolveLang,
    homeRangeLabel,
    homeBookTitle,
    homeDayKey,
    homeRangeStart,
    formatHomeCount,
    formatCompactTokens,
    formatHomeHour,
    homeShortDateFormat,
    homeShortDate,
    isSubagentSummary,
    extractWorkspaceId,
    analyzeTrajectoryForUsage,
    mergeUsageRecordDelta,
    homeHeatGrid,
    aggregateUsageRollup,
    quotaGroupKind,
    quotaGroupLabel,
    quotaRemaining,
    quotaWindows,
    chooseQuotaGroup,
    shortEta,
    quotaForecast,
    groupQuotaPace,
    axisMax,
    homeChartTicks,
    createHomeModelColours,
    durSec,
    tsSec,
    fmtK,
    fmtInt,
    fmtPct,
    fmtSec,
    fmtResetTime,
  };
});
