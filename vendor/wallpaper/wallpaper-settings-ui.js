// Obsidian Prism — Channel 7 Local Static/Dynamic Wallpaper Settings Card UI (v1.0.8-beta.2 · Beta, Bilingual EN/AR, 0 innerHTML)
// Exposes globalThis.__prismMountWallpaperUi(slotEl, ctx) and window.__prismMountWallpaperUi(slotEl, ctx)

(function (root) {
  'use strict';
  const G = root || (typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : null);
  if (!G) return;

  const NO_TR_ATTRS = [
    ['translate', 'no'],
    ['data-no-translate', 'true'],
    ['data-ag-localization-skip', 'true'],
    ['data-agy-no-translate', 'true'],
    ['data-antigravity-zh-skip', '1'],
    ['data-ag-no-i18n', ''],
  ];

  const I18N_KEYS =
    'title|desc|enableLabel|on|off|pickBtn|applyBtn|clearBtn|pathPh|opacityLabel|blurLabel|dimLabel|fitLabel|fitCover|fitContain|pauseBlurLabel|pauseBlurDesc|stIdle|stOffline|stActiveImg|stActiveVid|stBlobFallback|stVideoBlocked|stManualLinux|stCanceled|stPicking|stSaving|stCleared|errUnsupportedExt|errSensitivePath|errSymlink|errUncDevice|errNotFound|errInvalidMagic|errTooLarge|errBlobTooLarge|errGeneric'.split(
      '|'
    );

  const I18N_ROWS = {
    en:
      'Custom Static / Live Wallpaper (Beta)|Beta experimental feature (off by default, may evolve across versions): 100% local images & MP4/WebM, zero external network requests, auto 0fps sleep on blur or chat.|Enable Wallpaper (Beta)|On|Off|Choose Image / Video|Apply|Clear|Enter absolute path to local image or MP4/WebM video…|Opacity|Gaussian Blur|Eye-Care Dim|Fit Mode|Cover|Contain|Pause Video on Blur|Automatically pauses video wallpaper when window loses focus or minimizes.|Wallpaper disabled (Beta · 0 resource usage).|Prism background daemon is offline; wallpaper service unavailable.|Static image wallpaper active (Beta · local read-only stream).|Live video wallpaper active (Beta · auto 0fps sleep on blur/hide).|Restricted by host security policy; automatically switched to <= 8 MB safe image fallback.|Video stream restricted by host security policy or failed to decode. Try a static image (<= 8 MB) instead.|On Linux, paste the absolute local media file path above and click Apply.|File selection canceled.|Opening native file picker…|Validating and saving wallpaper settings…|Wallpaper cleared and local port released.|Unsupported format: only JPG/PNG/WebP/GIF/AVIF/MP4/WebM allowed (no SVG/HTML/scripts).|Blocked for security: system and credential directories (.ssh/.aws/.gemini/Windows) are forbidden.|Blocked for security: symbolic links are not allowed as wallpaper files.|Blocked for security: UNC network paths and NT device paths are forbidden.|File not found or unreadable. Check the path and try again.|Magic-byte check failed: file contents do not match its extension.|File size exceeds the maximum allowed limit.|Image exceeds the 8 MB safe fallback limit. Compress the image or allow local loopback stream.|Action failed. Check file path and permissions.',
    ar:
      'خلفية ثابتة / متحركة مخصصة (تجريبي)|ميزة تجريبية (معطلة افتراضياً وقد تتطور عبر الإصدارات): قراءة محلية 100% للصور وملفات MP4/WebM بدون أي طلبات خارجية، مع سكون تلقائي 0fps عند فقدان التركيز أو أثناء الدردشة.|تفعيل خلفية الشاشة (تجريبي)|تشغيل|إيقاف|اختيار صورة / فيديو|تطبيق|مسح|أدخل المسار الكامل لصورة محلية أو فيديو MP4/WebM…|الشفافية|تمويه غاوسي|تعتيم مريح للعين|وضع الملاءمة|تعبئة مع القص|احتواء كامل|إيقاف الفيديو عند فقدان التركيز|إيقاف خلفية الفيديو تلقائياً عند فقدان النافذة للتركيز أو تصغيرها لتقليل استهلاك GPU.|الخلفية معطلة (تجريبي · استهلاك صفري للموارد).|خدمة Prism الخلفية غير متصلة؛ خدمة الخلفية غير متاحة حالياً.|خلفية الصورة الثابتة مفعلة (تجريبي · بث محلي للقراءة فقط).|خلفية الفيديو المتحركة مفعلة (تجريبي · سكون تلقائي 0fps عند فقدان التركيز).|مقيدة بسياسة أمان المضيف؛ تم التبديل تلقائياً إلى العرض الآمن للصور (<= 8 MB).|بث الفيديو مقيد بسياسة أمان المضيف أو تعذر فك ترميزه. جرّب صورة ثابتة (<= 8 MB).|على Linux، الصق المسار المحلي الكامل للملف أعلاه ثم انقر «تطبيق».|تم إلغاء اختيار الملف.|جارٍ فتح منتقي الملفات…|جارٍ التحقق من إعدادات الخلفية وحفظها…|تم مسح الخلفية وتحرير المنفذ المحلي.|صيغة غير مدعومة: يُسمح فقط بـ JPG/PNG/WebP/GIF/AVIF/MP4/WebM (يُمنع SVG/HTML/النصوص البرمجية).|حظر أمني: يُمنع الوصول إلى مجلدات النظام أو بيانات الاعتماد (.ssh/.aws/.gemini/Windows).|حظر أمني: لا يُسمح باستخدام الروابط الرمزية (Symlink) كملفات خلفية.|حظر أمني: يُمنع استخدام مسارات الشبكة UNC ومسارات أجهزة النظام.|الملف غير موجود أو تعذر قراءته. تحقق من المسار وحاول مجدداً.|فشل التحقق من ترويسة الملف: محتوى الملف لا يطابق امتداده.|حجم الملف يتجاوز الحد الأقصى المسموح به.|تتجاوز الصورة حد العرض الآمن البالغ 8 MB. يرجى ضغط الصورة أو السماح بالبث المحلي.|فشلت العملية. تحقق من مسار الملف والأذونات.',
  };

  const WALLPAPER_I18N = Object.fromEntries(
    Object.entries(I18N_ROWS).map(([lang, row]) => {
      const vals = row.split('|');
      const map = {};
      for (let i = 0; i < I18N_KEYS.length; i++) map[I18N_KEYS[i]] = vals[i] || '';
      return [lang, map];
    })
  );

  function normalizeLang(raw) {
    const s = String(raw || '').trim().toLowerCase().replace(/_/g, '-');
    if (!s || s === 'auto') return '';
    if (s === 'ar' || s.startsWith('ar-') || s === 'arabic') return 'ar';
    if (/^en\b/.test(s) || s === 'english') return 'en';
    return '';
  }

  function resolveLang(doc, ctx) {
    if (ctx && ctx.lang) {
      const l = normalizeLang(ctx.lang);
      if (l) return l;
    }
    if (ctx && typeof ctx.getLang === 'function') {
      const l = normalizeLang(ctx.getLang());
      if (l) return l;
    }
    try {
      const de = doc && doc.documentElement;
      if (de && typeof de.getAttribute === 'function') {
        const l1 = normalizeLang(de.getAttribute('data-ag-cs-lang'));
        if (l1) return l1;
        const l2 = normalizeLang(de.getAttribute('data-ag-prism-lang'));
        if (l2) return l2;
      }
      const navObj = G && 'navigator' in G ? G.navigator : (typeof navigator !== 'undefined' ? navigator : null);
      const navLang = normalizeLang(navObj?.language || '');
      if (navLang) return navLang;
    } catch {}
    return 'en';
  }

  function markNoTrOwned(el) {
    if (el && typeof el.setAttribute === 'function') {
      for (let i = 0; i < NO_TR_ATTRS.length; i++) {
        el.setAttribute(NO_TR_ATTRS[i][0], NO_TR_ATTRS[i][1]);
      }
      el.setAttribute('data-ag-owned', '1');
    }
    return el;
  }

  function mapErrorCode(code, pack) {
    switch (code) {
      case 'unsupported-extension':
        return pack.errUnsupportedExt;
      case 'blocked-sensitive-path':
        return pack.errSensitivePath;
      case 'symlink-not-allowed':
        return pack.errSymlink;
      case 'blocked-unc-or-device':
      case 'invalid-scheme':
        return pack.errUncDevice;
      case 'file-not-found':
      case 'not-a-regular-file':
      case 'file-unreadable':
      case 'empty-file':
        return pack.errNotFound;
      case 'invalid-magic-bytes':
        return pack.errInvalidMagic;
      case 'file-too-large':
        return pack.errTooLarge;
      case 'blob-size-limit-exceeded':
        return pack.errBlobTooLarge;
      case 'blob-image-only':
      case 'video-stream-blocked':
        return pack.stVideoBlocked;
      case 'manual-input-required':
        return pack.stManualLinux;
      case 'bridge-offline':
      case 'bridge-disposed':
        return pack.stOffline;
      default:
        return pack.errGeneric;
    }
  }

  function mountWallpaperUi(slotEl, ctx = {}) {
    if (!slotEl) return null;
    const win = (ctx && ctx.window) || (typeof window !== 'undefined' ? window : G);
    const doc = (ctx && ctx.document) || slotEl.ownerDocument || (win && win.document) || (typeof document !== 'undefined' ? document : null);
    if (!doc) return null;

    const guard = typeof ctx.runGuardedMut === 'function' ? ctx.runGuardedMut : (fn) => fn();
    const resolveClient = () => (win && win.__agPrismWallpaper) || G.__agPrismWallpaper || null;
    const resolveBridge = () =>
      (win && win.__agPrismWallpaperBridge) ||
      G.__agPrismWallpaperBridge ||
      resolveClient()?.bridge ||
      null;

    // Idempotent reuse: refresh language and state on mounted instance without rebuilding DOM
    const existingHandle = slotEl.__agPrismWpUiHandle;
    if (existingHandle && existingHandle.root && existingHandle.root.parentElement === slotEl) {
      const nextLang = resolveLang(doc, ctx);
      existingHandle.updateLang(nextLang);
      const client = resolveClient();
      if (client && typeof client.getState === 'function') {
        existingHandle.syncState(client.getState());
      }
      return existingHandle;
    }

    const mk = (tag, cls, txt) => {
      const el = doc.createElement(tag);
      if (cls) el.className = cls;
      if (txt !== undefined) el.textContent = String(txt);
      return el;
    };
    const mkBtn = (cls, txt, testId) => {
      const b = mk('button', cls, txt);
      b.type = 'button';
      if (testId) b.setAttribute('data-testid', testId);
      return b;
    };

    const segBtnCls = (ctx && ctx.btnClass) || 'ag-cs-seg-btn data-[pressed]:bg-secondary data-[pressed]:text-foreground';
    let curLang = resolveLang(doc, ctx);
    let pack = WALLPAPER_I18N[curLang] || WALLPAPER_I18N.en;
    let busy = false;
    let customStatus = null; // { tone, text } | null
    let lastState = {
      enabled: false,
      mediaPath: '',
      mediaType: '',
      opacity: 0.28,
      blurPx: 4,
      dimOverlay: 0.45,
      fit: 'cover',
      pauseOnBlur: true,
      renderMode: 'idle',
      lastError: '',
      bridgeOnline: Boolean(resolveBridge()?.isOnline?.()),
    };

    const card = mk('div', 'ag-prism-wp-card');
    card.setAttribute('data-testid', 'prism-wallpaper-card');
    card.setAttribute('data-ag-cs-lang', curLang);
    card.setAttribute('dir', curLang === 'ar' ? 'rtl' : 'ltr');
    markNoTrOwned(card);

    // 1) Header + Enable switch
    const headRow = mk('div', 'ag-prism-wp-row');
    const headMeta = mk('div', 'ag-prism-wp-meta');
    const titleEl = mk('span', 'ag-prism-wp-title', pack.title);
    const descEl = mk('span', 'ag-prism-wp-desc', pack.desc);
    headMeta.appendChild(titleEl);
    headMeta.appendChild(descEl);

    const enableGrp = mk('div', 'ag-cs-seg-group');
    enableGrp.setAttribute('role', 'group');
    enableGrp.setAttribute('data-ui-kind', 'switch');
    enableGrp.setAttribute('data-switch-on', '0');
    const enableThumb = mk('span', 'ag-cs-switch-thumb');
    enableThumb.setAttribute('aria-hidden', 'true');
    const enableOnBtn = mkBtn(segBtnCls, pack.on, 'prism-wp-enable-on');
    const enableOffBtn = mkBtn(segBtnCls, pack.off, 'prism-wp-enable-off');
    enableGrp.appendChild(enableThumb);
    enableGrp.appendChild(enableOnBtn);
    enableGrp.appendChild(enableOffBtn);
    headRow.appendChild(headMeta);
    headRow.appendChild(enableGrp);

    // 2) Path input + Pick / Apply / Clear buttons
    const pathRow = mk('div', 'ag-prism-wp-path-row');
    const pathInput = mk('input', 'ag-prism-wp-path-input');
    pathInput.type = 'text';
    pathInput.setAttribute('data-testid', 'prism-wp-path-input');
    pathInput.setAttribute('placeholder', pack.pathPh);
    pathInput.setAttribute('autocomplete', 'off');
    pathInput.setAttribute('spellcheck', 'false');

    const pickBtn = mkBtn('ag-cs-thought-btn', pack.pickBtn, 'prism-wp-pick-btn');
    const applyBtn = mkBtn('ag-cs-thought-btn', pack.applyBtn, 'prism-wp-apply-btn');
    const clearBtn = mkBtn('ag-cs-thought-btn', pack.clearBtn, 'prism-wp-clear-btn');
    pathRow.appendChild(pathInput);
    pathRow.appendChild(pickBtn);
    pathRow.appendChild(applyBtn);
    pathRow.appendChild(clearBtn);

    // 3) Sliders: Opacity / Blur / Dim Overlay
    const slidersGrid = mk('div', 'ag-prism-wp-sliders');
    const mkSlider = (testId, labelText, min, max, step, valText) => {
      const wrap = mk('div', 'ag-prism-wp-slider-item');
      const head = mk('div', 'ag-prism-wp-slider-head');
      const lbl = mk('span', '', labelText);
      const val = mk('span', 'ag-prism-wp-slider-val', valText);
      head.appendChild(lbl);
      head.appendChild(val);
      const inp = mk('input', 'ag-prism-wp-range');
      inp.type = 'range';
      inp.min = String(min);
      inp.max = String(max);
      inp.step = String(step);
      inp.setAttribute('data-testid', testId);
      wrap.appendChild(head);
      wrap.appendChild(inp);
      slidersGrid.appendChild(wrap);
      return { lbl, val, inp };
    };

    const opacityCtrl = mkSlider('prism-wp-opacity', pack.opacityLabel, 0.05, 0.85, 0.01, '28%');
    const blurCtrl = mkSlider('prism-wp-blur', pack.blurLabel, 0, 24, 1, '4 px');
    const dimCtrl = mkSlider('prism-wp-dim', pack.dimLabel, 0, 0.85, 0.01, '45%');

    // 4) Fit Mode (cover / contain)
    const fitRow = mk('div', 'ag-prism-wp-row');
    const fitMeta = mk('div', 'ag-prism-wp-meta');
    const fitLbl = mk('span', 'ag-prism-wp-title', pack.fitLabel);
    fitMeta.appendChild(fitLbl);
    const fitGrp = mk('div', 'ag-cs-seg-group');
    fitGrp.setAttribute('role', 'group');
    const fitCoverBtn = mkBtn(segBtnCls, pack.fitCover, 'prism-wp-fit-cover');
    const fitContainBtn = mkBtn(segBtnCls, pack.fitContain, 'prism-wp-fit-contain');
    fitGrp.appendChild(fitCoverBtn);
    fitGrp.appendChild(fitContainBtn);
    fitRow.appendChild(fitMeta);
    fitRow.appendChild(fitGrp);

    // 5) Pause Video on Blur switch
    const pauseRow = mk('div', 'ag-prism-wp-row');
    const pauseMeta = mk('div', 'ag-prism-wp-meta');
    const pauseLbl = mk('span', 'ag-prism-wp-title', pack.pauseBlurLabel);
    const pauseDesc = mk('span', 'ag-prism-wp-desc', pack.pauseBlurDesc);
    pauseMeta.appendChild(pauseLbl);
    pauseMeta.appendChild(pauseDesc);
    const pauseGrp = mk('div', 'ag-cs-seg-group');
    pauseGrp.setAttribute('role', 'group');
    pauseGrp.setAttribute('data-ui-kind', 'switch');
    pauseGrp.setAttribute('data-switch-on', '1');
    const pauseThumb = mk('span', 'ag-cs-switch-thumb');
    pauseThumb.setAttribute('aria-hidden', 'true');
    const pauseOnBtn = mkBtn(segBtnCls, pack.on, 'prism-wp-pause-blur-on');
    const pauseOffBtn = mkBtn(segBtnCls, pack.off, 'prism-wp-pause-blur-off');
    pauseGrp.appendChild(pauseThumb);
    pauseGrp.appendChild(pauseOnBtn);
    pauseGrp.appendChild(pauseOffBtn);
    pauseRow.appendChild(pauseMeta);
    pauseRow.appendChild(pauseGrp);

    // 6) Status banner
    const statusEl = mk('div', 'ag-prism-wp-status', pack.stIdle);
    statusEl.setAttribute('data-testid', 'prism-wp-status');
    statusEl.setAttribute('role', 'status');
    statusEl.setAttribute('data-tone', 'idle');

    card.appendChild(headRow);
    card.appendChild(pathRow);
    card.appendChild(slidersGrid);
    card.appendChild(fitRow);
    card.appendChild(pauseRow);
    card.appendChild(statusEl);

    function setBtnPressed(btn, on) {
      btn.setAttribute('aria-pressed', on ? 'true' : 'false');
      if (on) btn.setAttribute('data-pressed', '');
      else btn.removeAttribute('data-pressed');
    }

    function computeStatusView(st) {
      if (customStatus) return customStatus;
      const bridge = resolveBridge();
      const online = st.bridgeOnline !== undefined ? st.bridgeOnline : Boolean(bridge?.isOnline?.());
      if (!online) return { tone: 'warn', text: pack.stOffline };
      if (st.lastError) return { tone: 'error', text: mapErrorCode(st.lastError, pack) };
      if (st.mediaError) return { tone: 'error', text: mapErrorCode(st.mediaError, pack) };
      if (!st.enabled) return { tone: 'idle', text: pack.stIdle };
      if (st.renderMode === 'blob-fallback') return { tone: 'warn', text: pack.stBlobFallback };
      if (st.mediaType === 'video') return { tone: 'ok', text: pack.stActiveVid };
      if (st.mediaType === 'image') return { tone: 'ok', text: pack.stActiveImg };
      return { tone: 'idle', text: pack.stIdle };
    }

    function renderUiFromState() {
      guard(() => {
        enableGrp.setAttribute('data-switch-on', lastState.enabled ? '1' : '0');
        setBtnPressed(enableOnBtn, lastState.enabled);
        setBtnPressed(enableOffBtn, !lastState.enabled);

        // Only sync backend path when input is not focused to avoid interrupting typing
        if (doc.activeElement !== pathInput && pathInput.value !== (lastState.mediaPath || '')) {
          pathInput.value = lastState.mediaPath || '';
        }

        const op = Number.isFinite(Number(lastState.opacity)) ? Number(lastState.opacity) : 0.28;
        const bl = Number.isFinite(Number(lastState.blurPx)) ? Number(lastState.blurPx) : 4;
        const dm = Number.isFinite(Number(lastState.dimOverlay)) ? Number(lastState.dimOverlay) : 0.45;

        opacityCtrl.inp.value = String(op);
        opacityCtrl.val.textContent = `${Math.round(op * 100)}%`;
        blurCtrl.inp.value = String(bl);
        blurCtrl.val.textContent = `${Math.round(bl)} px`;
        dimCtrl.inp.value = String(dm);
        dimCtrl.val.textContent = `${Math.round(dm * 100)}%`;

        const isContain = lastState.fit === 'contain';
        setBtnPressed(fitCoverBtn, !isContain);
        setBtnPressed(fitContainBtn, isContain);

        const pBlur = lastState.pauseOnBlur !== false;
        pauseGrp.setAttribute('data-switch-on', pBlur ? '1' : '0');
        setBtnPressed(pauseOnBtn, pBlur);
        setBtnPressed(pauseOffBtn, !pBlur);

        pickBtn.disabled = busy;
        applyBtn.disabled = busy;
        clearBtn.disabled = busy;

        const sv = computeStatusView(lastState);
        statusEl.setAttribute('data-tone', sv.tone);
        statusEl.textContent = sv.text;
      });
    }

    function updateLang(nextLangRaw) {
      const navObj = win && 'navigator' in win ? win.navigator : (G && 'navigator' in G ? G.navigator : (typeof navigator !== 'undefined' ? navigator : null));
      const nextCode = normalizeLang(nextLangRaw) || normalizeLang(navObj?.language || '') || 'en';
      if (nextCode === curLang) return;
      curLang = nextCode;
      pack = WALLPAPER_I18N[curLang] || WALLPAPER_I18N.en;
      customStatus = null;
      guard(() => {
        card.setAttribute('data-ag-cs-lang', curLang);
        card.setAttribute('dir', curLang === 'ar' ? 'rtl' : 'ltr');
        titleEl.textContent = pack.title;
        descEl.textContent = pack.desc;
        enableOnBtn.textContent = pack.on;
        enableOffBtn.textContent = pack.off;
        pathInput.setAttribute('placeholder', pack.pathPh);
        pickBtn.textContent = pack.pickBtn;
        applyBtn.textContent = pack.applyBtn;
        clearBtn.textContent = pack.clearBtn;
        opacityCtrl.lbl.textContent = pack.opacityLabel;
        blurCtrl.lbl.textContent = pack.blurLabel;
        dimCtrl.lbl.textContent = pack.dimLabel;
        fitLbl.textContent = pack.fitLabel;
        fitCoverBtn.textContent = pack.fitCover;
        fitContainBtn.textContent = pack.fitContain;
        pauseLbl.textContent = pack.pauseBlurLabel;
        pauseDesc.textContent = pack.pauseBlurDesc;
        pauseOnBtn.textContent = pack.on;
        pauseOffBtn.textContent = pack.off;
      });
      renderUiFromState();
    }

    function syncState(next) {
      if (!next || typeof next !== 'object') return;
      lastState = { ...lastState, ...next };
      renderUiFromState();
    }

    async function saveConfigPatch(patch, opts = {}) {
      const bridge = resolveBridge();
      if (!bridge || !bridge.isOnline()) {
        customStatus = { tone: 'warn', text: pack.stOffline };
        renderUiFromState();
        return { ok: false, offline: true };
      }
      if (!opts.silentBusy) {
        busy = true;
        customStatus = { tone: 'idle', text: pack.stSaving };
        renderUiFromState();
      }
      try {
        const res = await bridge.saveConfig(patch);
        if (res && res.ok && res.config) {
          customStatus = null;
          const client = resolveClient();
          if (client && typeof client.applyConfig === 'function') {
            lastState = client.applyConfig(res.config);
          } else {
            lastState = { ...lastState, ...res.config, lastError: '' };
          }
        } else {
          customStatus = {
            tone: 'error',
            text: mapErrorCode(res && res.code, pack),
          };
          if (res && res.config) {
            lastState = { ...lastState, ...res.config };
          }
        }
        return res;
      } finally {
        busy = false;
        renderUiFromState();
      }
    }

    enableOnBtn.addEventListener('click', () => {
      const typed = String(pathInput.value || '').trim();
      const patch = typed && typed !== lastState.mediaPath ? { enabled: true, mediaPath: typed } : { enabled: true };
      void saveConfigPatch(patch);
    });
    enableOffBtn.addEventListener('click', () => {
      void saveConfigPatch({ enabled: false });
    });

    pickBtn.addEventListener('click', async () => {
      if (busy) return;
      const bridge = resolveBridge();
      if (!bridge || !bridge.isOnline()) {
        customStatus = { tone: 'warn', text: pack.stOffline };
        renderUiFromState();
        return;
      }
      busy = true;
      customStatus = { tone: 'idle', text: pack.stPicking };
      renderUiFromState();
      try {
        const res = await bridge.pickMedia({ autoEnable: true });
        if (res && res.canceled) {
          customStatus = { tone: 'idle', text: pack.stCanceled };
        } else if (res && res.manualRequired) {
          customStatus = { tone: 'warn', text: pack.stManualLinux };
          try {
            pathInput.focus?.();
          } catch {}
        } else if (res && res.ok && res.config) {
          customStatus = null;
          pathInput.value = res.config.mediaPath || '';
          const client = resolveClient();
          if (client && typeof client.applyConfig === 'function') {
            lastState = client.applyConfig(res.config);
          } else {
            lastState = { ...lastState, ...res.config, lastError: '' };
          }
        } else {
          customStatus = { tone: 'error', text: mapErrorCode(res && res.code, pack) };
        }
      } finally {
        busy = false;
        renderUiFromState();
      }
    });

    applyBtn.addEventListener('click', () => {
      const typed = String(pathInput.value || '').trim();
      if (!typed) {
        void saveConfigPatch({ mediaPath: '', enabled: false });
        return;
      }
      void saveConfigPatch({ mediaPath: typed, enabled: true });
    });

    pathInput.addEventListener('keydown', (ev) => {
      if (ev && ev.key === 'Enter') {
        ev.preventDefault?.();
        applyBtn.click?.();
      }
    });

    clearBtn.addEventListener('click', async () => {
      if (busy) return;
      const bridge = resolveBridge();
      if (!bridge || !bridge.isOnline()) {
        customStatus = { tone: 'warn', text: pack.stOffline };
        renderUiFromState();
        return;
      }
      busy = true;
      renderUiFromState();
      try {
        const res = await bridge.clearMedia();
        if (res && res.ok && res.config) {
          pathInput.value = '';
          customStatus = { tone: 'idle', text: pack.stCleared };
          const client = resolveClient();
          if (client && typeof client.applyConfig === 'function') {
            lastState = client.applyConfig(res.config);
          } else {
            lastState = { ...lastState, ...res.config, lastError: '' };
          }
        } else {
          customStatus = { tone: 'error', text: mapErrorCode(res && res.code, pack) };
        }
      } finally {
        busy = false;
        renderUiFromState();
      }
    });

    const bindSlider = (ctrl, key, fmt) => {
      ctrl.inp.addEventListener('input', () => {
        const v = Number(ctrl.inp.value);
        if (!Number.isFinite(v)) return;
        lastState[key] = v;
        ctrl.val.textContent = fmt(v);
        resolveClient()?.previewVisualVars?.({ [key]: v });
      });
      ctrl.inp.addEventListener('change', () => {
        const v = Number(ctrl.inp.value);
        if (!Number.isFinite(v)) return;
        void saveConfigPatch({ [key]: v }, { silentBusy: true });
      });
    };

    bindSlider(opacityCtrl, 'opacity', (v) => `${Math.round(v * 100)}%`);
    bindSlider(blurCtrl, 'blurPx', (v) => `${Math.round(v)} px`);
    bindSlider(dimCtrl, 'dimOverlay', (v) => `${Math.round(v * 100)}%`);

    fitCoverBtn.addEventListener('click', () => {
      resolveClient()?.previewVisualVars?.({ fit: 'cover' });
      void saveConfigPatch({ fit: 'cover' }, { silentBusy: true });
    });
    fitContainBtn.addEventListener('click', () => {
      resolveClient()?.previewVisualVars?.({ fit: 'contain' });
      void saveConfigPatch({ fit: 'contain' }, { silentBusy: true });
    });

    pauseOnBtn.addEventListener('click', () => {
      void saveConfigPatch({ pauseOnBlur: true }, { silentBusy: true });
    });
    pauseOffBtn.addEventListener('click', () => {
      void saveConfigPatch({ pauseOnBlur: false }, { silentBusy: true });
    });

    let unsub = null;
    const client = resolveClient();
    if (client) {
      if (typeof client.getState === 'function') {
        lastState = { ...lastState, ...client.getState() };
      }
      if (typeof client.subscribe === 'function') {
        unsub = client.subscribe((st) => {
          if (card.isConnected === false) {
            try {
              unsub?.();
            } catch {}
            unsub = null;
            return;
          }
          syncState(st);
        });
      }
    }

    guard(() => {
      while (slotEl.firstChild) slotEl.removeChild(slotEl.firstChild);
      slotEl.hidden = false;
      slotEl.removeAttribute?.('hidden');
      slotEl.appendChild(card);
    });
    renderUiFromState();

    // On first mount when online and config hasn't been pulled yet, silently sync backend config once
    const bridge = resolveBridge();
    if (bridge && bridge.isOnline() && !lastState.mediaPath && !lastState.enabled) {
      void bridge.getConfig().then((res) => {
        if (res && res.ok && res.config) {
          const liveClient = resolveClient();
          if (liveClient && typeof liveClient.applyConfig === 'function') {
            syncState(liveClient.applyConfig(res.config));
          } else {
            syncState({ ...res.config, bridgeOnline: true });
          }
        }
      });
    }

    const handle = {
      root: card,
      updateLang,
      syncState,
      destroy() {
        try {
          unsub?.();
        } catch {}
        unsub = null;
        try {
          card.remove?.();
        } catch {}
        if (slotEl.__agPrismWpUiHandle === handle) {
          slotEl.__agPrismWpUiHandle = null;
        }
      },
    };
    slotEl.__agPrismWpUiHandle = handle;
    return handle;
  }

  const exported = {
    WALLPAPER_I18N,
    mountWallpaperUi,
  };

  G.__prismMountWallpaperUi = mountWallpaperUi;
  G.__agPrismWallpaperSettingsUi = exported;
  if (typeof window !== 'undefined') {
    window.__prismMountWallpaperUi = mountWallpaperUi;
    window.__agPrismWallpaperSettingsUi = exported;
  }
  if (typeof module === 'object' && module.exports) {
    module.exports = exported;
  }
})(typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : null);
