(function () {
  'use strict';

  const DEFAULT_TOKENS = {
    palette: 'obsidian',
    theme: 'dark',
    lightPreset: 'crystal',
    radiusBase: 6,
    specularAlpha: 0.095,
    borderAlpha: 0.115,
    glassBlur: 16,
    proseLineHeight: 1.7,
    editorialSerif: true,
    grainAlpha: 0.022,
    prismStrength: 1,
  };

  const MODELS = [
    {
      id: 'orchestrator',
      group: 'Antigravity Orchestrator · Dual-Phase Managed',
      name: 'Orchestrator',
      camp: 'gemini',
      isOrchestrator: true,
      sampledId: 'Carbon (Plan) ⇄ Exec',
      fallbackId: 'gemini-4-flash-001',
      desc: 'Planner deep thinking <-> Executor fast pass · Auto managed',
      efforts: [],
    },
    {
      id: 'claude-4.6-sonnet',
      group: 'Claude 4.6 Series · Native 3-Tier',
      name: 'Claude 4.6 Sonnet',
      camp: 'claude',
      sampledId: 'claude-sonnet-4-6-20260929',
      fallbackId: 'claude-haiku-4-5-20260601',
      desc: 'Daily coding & architecture alignment · Low / Med / High',
      efforts: ['low', 'medium', 'high'],
    },
    {
      id: 'claude-4.6-opus',
      group: 'Claude 4.6 Series · Native 3-Tier',
      name: 'Claude 4.6 Opus',
      camp: 'claude',
      sampledId: 'claude-opus-4-6-20260929',
      fallbackId: 'claude-sonnet-4-5-20260715',
      desc: 'Deep-water refactoring · High activates full sweep matrix',
      efforts: ['low', 'medium', 'high'],
    },
    {
      id: 'gemini-4-carbon',
      group: 'Gemini 4 Series · Native 3-Tier',
      name: 'Gemini 4 Carbon',
      camp: 'gemini',
      sampledId: 'gemini-4-carbon-001',
      fallbackId: 'gemini-4-flash-001',
      desc: 'Core flagship · Supports Low / Medium / High',
      efforts: ['low', 'medium', 'high'],
    },
    {
      id: 'gemini-4-hydrogen',
      group: 'Gemini 4 Series · Hydrogen Deep',
      name: 'Gemini 4 Hydrogen',
      camp: 'gemini',
      sampledId: 'gemini-4-hydrogen-001',
      fallbackId: 'gemini-4-carbon-001',
      desc: 'Extreme-depth reasoning · Supports Low..Extra (xhigh)',
      efforts: ['low', 'medium', 'high', 'xhigh'],
    },
    {
      id: 'gpt-oss-120b',
      group: 'Fixed Depth · Single-Tier Lock Reference',
      name: 'GPT-OSS 120B (Medium)',
      camp: 'gemini',
      sampledId: 'gpt-oss-120b-medium',
      fallbackId: 'gemini-4-flash-lite',
      desc: 'Fixed depth · Triggers .is-locked dimmed lock state',
      efforts: ['medium'],
    },
  ];

  const ALL_EFFORTS = [
    { id: 'low', label: 'Low', short: 'LOW', title: 'Fast lightweight reasoning', bars: 1 },
    { id: 'medium', label: 'Medium', short: 'MED', title: 'Balanced standard reasoning', bars: 2 },
    { id: 'high', label: 'High', short: 'HIGH', title: 'Deep architectural reasoning', bars: 3, top: true },
    { id: 'xhigh', label: 'Extra', short: 'EXTRA', title: 'Maximum intensive reasoning', bars: 4, spectrum: true },
  ];

  const SESSIONS = [
    { id: 'studio-home', group: 'Pinned', title: 'Studio Home & Fullscreen Ripple Glow', time: 'Live', scene: 'studio' },
    { id: 'm3-surface-lab', group: 'Today', title: 'M3 Surface Lab (True CSS)', time: 'Live', scene: 'm3lab' },
    { id: 'v2-refactor', group: 'Today', title: 'Obsidian Prism Visual Refactor', time: 'Now', scene: 'chat' },
    { id: 'effort-merge', group: 'Today', title: '1:1 Native Effort Slider', time: 'Running', scene: 'effort', running: true },
    { id: 'dash-fastpath', group: 'Past 7 Days', title: 'Optical Vial & Model Verification', time: '1d', scene: 'dashboard' },
    { id: 'theme-tokens', group: 'Past 7 Days', title: 'Appearance Settings & Mini Crab Pile', time: '3d', scene: 'settings' },
  ];

  const TIME_RANGE_STATS = {
    '7d': {
      books: '3.1 books',
      sub: '782K Tokens · 312 messages · Top model Gemini 4 Carbon',
      scale: 0.78,
    },
    '30d': {
      books: '14.2 books',
      sub: '3.56M Tokens · 1,284 messages · Top model Gemini 4 Carbon',
      scale: 1,
    },
    all: {
      books: '84.6 books',
      sub: '21.6M Tokens · 10,254 messages · Top model Gemini 4 Carbon',
      scale: 1.18,
    },
  };

  const STREAM_FULL_PARAGRAPHS = [
    {
      type: 'h3',
      text: '1. Input-Only Prism & Zero-Tint Neutral Obsidian',
    },
    {
      type: 'p',
      html: 'De-noised the <code>Obsidian Neutral</code> graphite chassis so only the primary focus <code>[data-testid="agent-input-box"]</code> carries the 4-color optical prism edge, while cards and popovers return to crisp <code>1px</code> top specular highlights.',
    },
    {
      type: 'h3',
      text: '2. 512K Frameless Floating Vial & Deep-Ocean Ionized Spectrum',
    },
    {
      type: 'p',
      html: 'Connected the live <code>Sampled Model</code> verification header on the right and upgraded the frameless WebGL2 borosilicate vial to a <code>512K</code> scale (<code>128k / 256k / 384k</code> laser tick marks) with a continuous deep-ocean spectrum.',
    },
  ];

  const state = {
    tokens: { ...DEFAULT_TOKENS },
    viewMode: 'single', // 'single' | 'split' | 'matrix'
    scene: 'studio', // 'studio' | 'chat' | 'effort' | 'dashboard' | 'settings'
    inspectorOpen: true,
    timeRange: '30d', // '7d' | '30d' | 'all'
    activeModelId: 'gemini-4-carbon',
    effortByModel: {
      'claude-4.6-sonnet': 'medium',
      'claude-4.6-opus': 'high',
      'gemini-4-carbon': 'high',
      'gemini-4-hydrogen': 'xhigh',
      'gpt-oss-120b': 'medium',
    },
    openPopover: null, // null | 'effort' | 'dashboard'
    overlayDemo: null, // null | 'takeover' | 'slash'
    mascotYieldMode: 'none', // 'none' | 'leap' | 'peek'
    mascotMiniPile: false,
    userBubbleExpanded: false,
    thinkingOpen: false,
    streamPhase: 'done', // 'done' | 'streaming'
    streamWordProgress: 999,
    convAuraPhase: 'idle', // 'idle' | 'start' | 'running' | 'complete'
    convAuraPhaseAt: 0,
    liftoffEbbAt: 0,
    motionLevel: 'ultra', // 'off' | 'subtle' | 'standard' | 'ultra'
    hasToolError: false,
    cacheCleanStep: 'idle', // 'idle' | 'confirm' | 'done'
    cacheTimerId: 0,
    contextVialEnabled: true,
    vialStreaming: false,
    vialCritical: false,
    telemetryModule: 'auto',
    effortSliderModule: 'auto',
    hoveredSlice: -1, // -1 | 0 | 1 | 2
    sampleSimMode: 'ok', // 'ok' | 'fallback' | 'unreliable'
    rippleEnabled: true,
    sidebarCollapsed: false,
    sidebarSearchOpen: false,
    sidebarSearchQuery: '',
    sidebarCollapsedGroups: {},
    workspaceName: 'obsidian-prism',
    m3ActiveSlashIdx: 1,
    m3DiffStatus: 'pending', // 'pending' | 'accepted' | 'rejected'
    m3SwitchOn: true,
    m3ToastType: 'info', // 'info' | 'success' | 'warning' | 'error'
  };

  let rippleControllers = [];
  let convAuraControllers = [];
  let vialControllers = [];
  let crystalControllers = [];
  let sliderControllers = [];
  let mascotControllers = [];
  let masterRafId = 0;
  let masterSleeping = false;
  let masterFrameTicks = 0;
  let lastFrameMs = 0;
  let streamTimerId = 0;
  let windowBlurredLong = false;
  let blurTimeoutId = 0;
  let lastPointerPos = { x: -9999, y: -9999 };
  let prismDirty = false;
  let prismRafId = 0;

  function escapeHtml(text) {
    return String(text || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  // Mixed-script micro-labels: keep Latin uppercase tracking while resetting Arabic spans to sans-serif with zero letter-spacing
  function fmtMicroLabel(text) {
    return escapeHtml(text).replace(/([\u0600-\u06ff\u0750-\u077f\u08a0-\u08ff]+)/g, '<span class="ag-cjk">$1</span>');
  }

  // Check whether reduced motion is active (including motionLevel === 'off')
  function prefersReducedMotion() {
    if (state.motionLevel === 'off') return true;
    return Boolean(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  }

  // View-level switch: use View Transitions for 200ms crossfade when supported
  function withViewTransition(fn) {
    if (
      typeof document.startViewTransition === 'function' &&
      !prefersReducedMotion() &&
      state.motionLevel !== 'subtle' &&
      !document.hidden
    ) {
      try {
        document.startViewTransition(() => fn());
        return;
      } catch {}
    }
    fn();
  }

  function getGreetingLabel() {
    const h = new Date().getHours();
    if (h < 6) return 'Late night — what are we building?';
    if (h < 12) return 'Good morning — ready to build?';
    if (h < 18) return 'Good afternoon — what shall we build?';
    return 'Good evening — what are we building?';
  }

  function getActiveModel() {
    return MODELS.find((m) => m.id === state.activeModelId) || MODELS[3] || MODELS[0];
  }

  function getActiveEffortMeta() {
    const model = getActiveModel();
    if (model.isOrchestrator) {
      return { id: 'auto', label: 'Auto', short: 'AUTO', title: 'Dual-phase auto orchestration', bars: 4, orchestrator: true };
    }
    const curId = state.effortByModel[model.id] || model.efforts[0];
    return ALL_EFFORTS.find((e) => e.id === curId) || ALL_EFFORTS[1];
  }

  /* ── Official Brand Vector Marks, Google Spark Orbit & Animated Icons Bridge ── */
  const BRAND_PATHS = {
    gemini:
      'M24 12.024c-6.437.388-11.59 5.539-11.977 11.976h-.047C11.588 17.563 6.436 12.412 0 12.024v-.047C6.437 11.588 11.588 6.437 11.976 0h.047c.388 6.437 5.54 11.588 11.977 11.977z',
    claude:
      'm4.714 15.956l4.718-2.648l.079-.23l-.08-.128h-.23l-.79-.048l-2.695-.073l-2.337-.097l-2.265-.122l-.57-.121l-.535-.704l.055-.353l.48-.321l.685.06l1.518.104l2.277.157l1.651.098l2.447.255h.389l.054-.158l-.133-.097l-.103-.098l-2.356-1.596l-2.55-1.688l-1.336-.972l-.722-.491L2 6.223l-.158-1.008l.656-.722l.88.06l.224.061l.893.686l1.906 1.476l2.49 1.833l.364.304l.146-.104l.018-.072l-.164-.274l-1.354-2.446l-1.445-2.49l-.644-1.032l-.17-.619a3 3 0 0 1-.103-.729L6.287.133L6.7 0l.995.134l.42.364l.619 1.415L9.735 4.14l1.555 3.03l.455.898l.243.832l.09.255h.159V9.01l.127-1.706l.237-2.095l.23-2.695l.08-.76l.376-.91l.747-.492l.583.28l.48.685l-.067.444l-.286 1.851l-.558 2.903l-.365 1.942h.213l.243-.242l.983-1.306l1.652-2.064l.728-.82l.85-.904l.547-.431h1.032l.759 1.129l-.34 1.166l-1.063 1.347l-.88 1.142l-1.263 1.7l-.79 1.36l.074.11l.188-.02l2.853-.606l1.542-.28l1.84-.315l.832.388l.09.395l-.327.807l-1.967.486l-2.307.462l-3.436.813l-.043.03l.049.061l1.548.146l.662.036h1.62l3.018.225l.79.522l.473.638l-.08.485l-1.213.62l-1.64-.389l-3.825-.91l-1.31-.329h-.183v.11l1.093 1.068l2.003 1.81l2.508 2.33l.127.578l-.321.455l-.34-.049l-2.204-1.657l-.85-.747l-1.925-1.62h-.127v.17l.443.649l2.343 3.521l.122 1.08l-.17.353l-.607.213l-.668-.122l-1.372-1.924l-1.415-2.168l-1.141-1.943l-.14.08l-.674 7.254l-.316.37l-.728.28l-.607-.461l-.322-.747l.322-1.476l.388-1.924l.316-1.53l.285-1.9l.17-.632l-.012-.042l-.14.018l-1.432 1.967l-2.18 2.945l-1.724 1.845l-.413.164l-.716-.37l.066-.662l.401-.589l2.386-3.036l1.439-1.882l.929-1.086l-.006-.158h-.055L4.138 18.56l-1.13.146l-.485-.456l.06-.746l.231-.243l1.907-1.312Z',
    openai:
      'M20.562 10.188c.25-.688.313-1.376.25-2.063c-.062-.687-.312-1.375-.625-2c-.562-.937-1.375-1.687-2.312-2.125c-1-.437-2.063-.562-3.125-.312c-.5-.5-1.063-.938-1.688-1.25S11.687 2 11 2a5.17 5.17 0 0 0-3 .938c-.875.624-1.5 1.5-1.813 2.5c-.75.187-1.375.5-2 .875c-.562.437-1 1-1.375 1.562c-.562.938-.75 2-.625 3.063a5.44 5.44 0 0 0 1.25 2.874a4.7 4.7 0 0 0-.25 2.063c.063.688.313 1.375.625 2c.563.938 1.375 1.688 2.313 2.125c1 .438 2.062.563 3.125.313c.5.5 1.062.937 1.687 1.25S12.312 22 13 22a5.17 5.17 0 0 0 3-.937c.875-.625 1.5-1.5 1.812-2.5a4.54 4.54 0 0 0 1.938-.875c.562-.438 1.062-.938 1.375-1.563c.562-.937.75-2 .625-3.062c-.125-1.063-.5-2.063-1.188-2.876m-7.5 10.5c-1 0-1.75-.313-2.437-.875c0 0 .062-.063.125-.063l4-2.312a.5.5 0 0 0 .25-.25a.57.57 0 0 0 .062-.313V11.25l1.688 1v4.625a3.685 3.685 0 0 1-3.688 3.813M5 17.25c-.438-.75-.625-1.625-.438-2.5c0 0 .063.063.125.063l4 2.312a.56.56 0 0 0 .313.063c.125 0 .25 0 .312-.063l4.875-2.812v1.937l-4.062 2.375A3.7 3.7 0 0 1 7.312 19c-1-.25-1.812-.875-2.312-1.75M3.937 8.563a3.8 3.8 0 0 1 1.938-1.626v4.751c0 .124 0 .25.062.312a.5.5 0 0 0 .25.25l4.875 2.813l-1.687 1l-4-2.313a3.7 3.7 0 0 1-1.75-2.25c-.25-.937-.188-2.062.312-2.937M17.75 11.75l-4.875-2.812l1.687-1l4 2.312c.625.375 1.125.875 1.438 1.5s.5 1.313.437 2.063a3.7 3.7 0 0 1-.75 1.937c-.437.563-1 1-1.687 1.25v-4.75c0-.125 0-.25-.063-.312c0 0-.062-.126-.187-.188m1.687-2.5s-.062-.062-.125-.062l-4-2.313c-.125-.062-.187-.062-.312-.062s-.25 0-.313.062L9.812 9.688V7.75l4.063-2.375c.625-.375 1.312-.5 2.062-.5c.688 0 1.375.25 2 .688c.563.437 1.063 1 1.313 1.625s.312 1.375.187 2.062m-10.5 3.5l-1.687-1V7.063c0-.688.187-1.438.562-2C8.187 4.438 8.75 4 9.375 3.688a3.37 3.37 0 0 1 2.062-.313c.688.063 1.375.375 1.938.813c0 0-.063.062-.125.062l-4 2.313a.5.5 0 0 0-.25.25c-.063.125-.063.187-.063.312zm.875-2L12 9.5l2.187 1.25v2.5L12 14.5l-2.188-1.25z',
  };

  function renderSparkOrbitMark(opts = {}) {
    const size = opts.size || 15;
    const tier = opts.tier || 'auto';
    const monochrome = Boolean(opts.monochrome);
    const className = opts.className || '';
    const icons = globalThis.__agAnimatedIcons;
    if (icons && typeof icons.renderGoogleSparkOrbitSvg === 'function') {
      const rendered = icons.renderGoogleSparkOrbitSvg({ size, tier, monochrome, className });
      if (rendered) {
        if (className && !rendered.includes(className)) {
          if (/class="([^"]*)"/.test(rendered)) {
            return rendered.replace(/class="([^"]*)"/, `class="$1 ${className}"`);
          }
          return rendered.replace('<svg', `<svg class="${className}"`);
        }
        return rendered;
      }
    }
    // Official monochrome four-point star static fallback
    const cls = className ? ` class="${className}"` : '';
    const sparkFill = monochrome ? 'currentColor' : '#669DF6';
    return `<svg${cls} width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 1.2c.25 0 .47.17.53.41c.21.79.48 1.56.8 2.31c1.23 2.86 3.39 5.02 6.25 6.25c.75.32 1.52.59 2.31.8c.24.06.41.28.41.53s-.17.47-.41.53a16 16 0 0 0-2.31.8c-2.86 1.23-5.02 3.39-6.25 6.25c-.32.75-.59 1.52-.8 2.31a.55.55 0 0 1-.53.41a.55.55 0 0 1-.53-.41a16 16 0 0 0-.8-2.31c-1.23-2.86-3.39-5.02-6.25-6.25a16 16 0 0 0-2.31-.8A.55.55 0 0 1 1.2 12c0-.25.17-.47.41-.53c.79-.21 1.56-.48 2.31-.8c2.86-1.23 5.02-3.39 6.25-6.25c.32-.75.59-1.52.8-2.31c.06-.24.28-.41.53-.41Z" fill="${sparkFill}"/></svg>`;
  }

  function renderAnimIcon(name, opts = {}) {
    const size = opts.size || 14;
    const className = opts.className || '';
    const active = Boolean(opts.active);
    const icons = globalThis.__agAnimatedIcons;
    if (icons && typeof icons.renderIcon === 'function') {
      const svg = icons.renderIcon(name, { size, className, active });
      if (svg) {
        if (svg.includes('data-anim-icon=')) return svg;
        return svg.replace('<svg', `<svg data-anim-icon="${name}"`);
      }
    }
    const cls = className ? ` class="${className}"` : '';
    return `<svg${cls} data-anim-icon="${name}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="4"/></svg>`;
  }

  function syncMotionSpringTokens() {
    const me = globalThis.__agMotionEngine;
    if (!me || typeof me.springLinear !== 'function') return;
    try {
      const sp = me.springLinear({ stiffness: 420, damping: 32, mass: 1 });
      const easing = typeof sp === 'string' ? sp : sp && (sp.easing || sp.linear || sp.cssEasing || sp.css);
      const durMs = sp && typeof sp === 'object' ? (sp.durationMs || sp.duration || 300) : 300;
      if (easing) {
        document.documentElement.style.setProperty('--ag-spring-sidebar-ease', easing);
        document.documentElement.style.setProperty('--ag-spring-sidebar-dur', `${Math.round(durMs)}ms`);
        document.querySelectorAll('.ag-v2-stage').forEach((st) => {
          st.style.setProperty('--ag-spring-sidebar-ease', easing);
          st.style.setProperty('--ag-spring-sidebar-dur', `${Math.round(durMs)}ms`);
        });
      }
    } catch {}
  }

  function runGlide(indicatorEl, prevRect, nextRect, opts) {
    if (!indicatorEl || !prevRect || !nextRect || prefersReducedMotion()) return;
    const me = globalThis.__agMotionEngine;
    if (me && typeof me.glideIndicator === 'function') {
      try {
        me.glideIndicator(indicatorEl, prevRect, nextRect, opts);
      } catch {}
    }
  }

  function triggerAnimIcon(elOrBtn, stateName, opts) {
    if (!elOrBtn || prefersReducedMotion()) return;
    const me = globalThis.__agMotionEngine;
    if (me && typeof me.triggerIcon === 'function') {
      try {
        me.triggerIcon(elOrBtn, stateName, opts);
      } catch {}
    }
  }

  function hydrateShellIcons() {
    const icons = globalThis.__agAnimatedIcons;
    if (icons && typeof icons.renderGoogleSparkOrbitDataUri === 'function') {
      const fav = document.querySelector('link[rel="icon"]');
      if (fav) {
        fav.setAttribute('href', icons.renderGoogleSparkOrbitDataUri({ size: 32, tier: 'auto', monochrome: false }));
      }
    }
    const brandMark = document.getElementById('wb-brand-mark');
    if (brandMark) {
      // Topbar brand mark uses minimal silver monochrome star; full 4-color glow appears only on active model badge
      brandMark.innerHTML = renderSparkOrbitMark({ size: 14, tier: 'auto', monochrome: true });
    }
    document.querySelectorAll('[data-wb-icon]').forEach((slot) => {
      const rawIcon = slot.getAttribute('data-wb-icon');
      let safeIcon = '';
      if (rawIcon === 'layers-stack') safeIcon = 'layers-stack';
      else if (rawIcon === 'sun-moon') safeIcon = 'sun-moon';
      else if (rawIcon === 'sliders-tune') safeIcon = 'sliders-tune';
      if (!safeIcon) return;
      const size = safeIcon === 'sliders-tune' ? 14 : 13;
      slot.innerHTML = renderAnimIcon(safeIcon, { size });
    });
  }

  function getModelBrand(model) {
    if (!model) return 'gemini';
    if (model.isOrchestrator || model.id === 'orchestrator') return 'antigravity';
    if (model.camp === 'claude' || model.id.startsWith('claude')) return 'claude';
    if (model.id.startsWith('gpt')) return 'openai';
    return 'gemini';
  }

  function getModelEffortTier(model, effortMeta) {
    if (!model) return 'medium';
    if (model.isOrchestrator) return 'auto';
    if (model.efforts.length <= 1) return 'fixed';
    return (effortMeta && effortMeta.id) || 'medium';
  }

  function buildBrandMarkSvg(brand, size = 14, extraClass = '', opts = {}) {
    if (brand === 'antigravity') {
      return renderSparkOrbitMark({
        size,
        tier: opts.tier || 'auto',
        monochrome: Boolean(opts.monochrome),
        className: extraClass,
      });
    }
    const d = BRAND_PATHS[brand] || BRAND_PATHS.gemini;
    const cls = extraClass ? ` class="${extraClass}"` : '';
    return `<svg${cls} width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="${d}" fill="currentColor" fill-rule="evenodd"/></svg>`;
  }

  function buildTriggerGlyphInnerSvg(brand, tier) {
    if (brand === 'antigravity') {
      return renderSparkOrbitMark({
        size: 17,
        tier: tier || 'auto',
        monochrome: false,
        className: 'ag-v2-model-glyph-svg',
      });
    }
    const d = BRAND_PATHS[brand] || BRAND_PATHS.gemini;
    const coreR = brand === 'gemini' ? '2.7' : '2.1';
    const fixedLock =
      tier === 'fixed'
        ? '<g class="ag-v2-glyph-lock"><rect x="15.2" y="16.2" width="8.6" height="6.8" rx="1.6"/><path d="M17.3 16.2v-1.7a2.2 2.2 0 1 1 4.4 0v1.7" fill="none" stroke-width="1.5"/></g>'
        : '';
    return `
      <svg class="ag-v2-model-glyph-svg" width="17" height="17" viewBox="-4 -4 32 32" fill="none" aria-hidden="true">
        <g class="ag-v2-glyph-orbit-group">
          <ellipse class="ag-v2-glyph-orbit" cx="12" cy="12" rx="14.5" ry="6.2" transform="rotate(-24 12 12)" />
          <circle class="ag-v2-glyph-sat is-a" cx="25.2" cy="6.1" r="1.65" />
          <circle class="ag-v2-glyph-sat is-b" cx="-1.2" cy="17.9" r="1.25" />
        </g>
        <path class="ag-v2-glyph-body" d="${d}" fill-rule="evenodd" />
        <circle class="ag-v2-glyph-core" cx="12" cy="12" r="${coreR}" />
        ${fixedLock}
      </svg>`;
  }

  function buildModelEffortGlyphHtml(model, effortMeta) {
    const brand = getModelBrand(model);
    const tier = getModelEffortTier(model, effortMeta);
    return `<span class="ag-v2-model-glyph" data-composer-model-glyph="true" data-brand="${brand}" data-tier="${tier}">${buildTriggerGlyphInnerSvg(brand, tier)}</span>`;
  }

  function buildOrbitalGeometrySvg() {
    return `
      <div class="ag-v2-orbital-backdrop" data-orbital-geometry="true" aria-hidden="true">
        <svg class="ag-v2-orbital-svg" viewBox="0 0 760 280" fill="none" preserveAspectRatio="none">
          <ellipse class="ag-v2-orbit-arc is-primary" cx="468" cy="136" rx="348" ry="118" transform="rotate(-10 468 136)" />
          <ellipse class="ag-v2-orbit-arc is-dashed" cx="468" cy="136" rx="252" ry="82" transform="rotate(-10 468 136)" />
          <g class="ag-v2-orbit-reticle" transform="translate(466 36)">
            <path d="M-4 0H4M0 -4V4" />
          </g>
          <g class="ag-v2-orbit-reticle" transform="translate(216 184)">
            <path d="M-3.5 0H3.5M0 -3.5V3.5" />
          </g>
          <g class="ag-v2-orbit-reticle" transform="translate(698 92)">
            <path d="M-3.5 0H3.5M0 -3.5V3.5" />
          </g>
          <circle class="ag-v2-orbit-node is-cobalt" cx="634" cy="54" r="2.2" />
          <circle class="ag-v2-orbit-node is-iris" cx="308" cy="64" r="1.8" />
          <circle class="ag-v2-orbit-node is-amber" cx="566" cy="212" r="1.8" />
        </svg>
      </div>`;
  }

  function getContextTelemetry() {
    if (state.vialCritical) {
      return {
        pct: 89.5,
        usedText: '458.2k / 512k',
        pctText: '89.5%',
        sysK: '44.0k',
        convK: '276.8k',
        toolsK: '137.4k',
        ratios: [0.086, 0.541, 0.268],
        maxTokens: 512000,
        rate: '84.2 tok/s',
      };
    }
    return {
      pct: 46.5,
      usedText: '238.1k / 512k',
      pctText: '46.5%',
      sysK: '38.9k',
      convK: '136.2k',
      toolsK: '63.0k',
      ratios: [0.076, 0.266, 0.123],
      maxTokens: 512000,
      rate: state.vialStreaming ? '74.8 tok/s' : 'IDLE',
    };
  }

  function getModelSamplingTelemetry() {
    const model = getActiveModel();
    if (state.sampleSimMode === 'fallback') {
      return {
        status: 'fallback',
        badgeText: 'FALLBACK',
        selectedName: model.name,
        sampledModel: model.fallbackId,
        ttftText: '1.84s',
        tpsText: '42.1 tok/s',
        note: 'Mismatch with selected model detected; fallback routing active',
      };
    }
    if (state.sampleSimMode === 'unreliable') {
      return {
        status: 'unreliable',
        badgeText: 'Timing Anomaly',
        selectedName: model.name,
        sampledModel: model.sampledId,
        ttftText: '0.00s',
        tpsText: '--',
        note: 'First-token timing anomaly detected; distorted TPS readout suppressed',
      };
    }
    return {
      status: 'ok',
      badgeText: 'VERIFIED',
      selectedName: model.name,
      sampledModel: model.sampledId,
      ttftText: model.camp === 'claude' ? '0.46s' : '0.32s',
      tpsText: state.vialCritical ? '84.2 tok/s' : '74.8 tok/s',
      note: 'Verified response matches generatorMetadata.chatModel',
    };
  }

  function buildHeatmapCells() {
    const scale = TIME_RANGE_STATS[state.timeRange].scale;
    const cells = [];
    for (let w = 0; w < 26; w++) {
      for (let d = 0; d < 7; d++) {
        const idx = w * 7 + d;
        const hash = ((idx * 1103515245 + 12345) >>> 16) & 0xff;
        let level = 0;
        const boosted = Math.min(255, Math.round(hash * scale));
        if (state.timeRange === '7d' && w < 24) {
          level = 0;
        } else if (w > 19 && d < 6) {
          level = (boosted % 5) + (boosted > 205 ? 1 : 0);
        } else if (boosted > 220) {
          level = 5;
        } else if (boosted > 180) {
          level = 4;
        } else if (boosted > 138) {
          level = 3;
        } else if (boosted > 98) {
          level = 2;
        } else if (boosted > 62) {
          level = 1;
        }
        level = Math.min(5, Math.max(0, level));
        // Zero-delay glass tooltip via delegated popover; --i drives staggered column fade on range switch
        const dayLabel = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'][d];
        const msgCount = level === 0 ? 0 : Math.round(level * 9 + (boosted % 11));
        cells.push(`<span class="ag-v2-heat-cell" data-level="${level}" style="--i:${w}" data-tip="Week ${w + 1} · ${dayLabel}|${msgCount} msgs · L${level}"></span>`);
      }
    }
    return cells.join('');
  }

  function buildInlineCacheHtml() {
    if (state.cacheCleanStep === 'confirm') {
      return `
        <span class="ag-v2-inline-cleaner">
          <span>Free 118 MB?</span>
          <button type="button" class="ag-v2-inline-btn" data-tone="warn" data-action="cache-confirm">Confirm</button>
          <button type="button" class="ag-v2-inline-btn" data-action="cache-cancel">Cancel</button>
        </span>`;
    }
    if (state.cacheCleanStep === 'done') {
      return `
        <span class="ag-v2-inline-cleaner">
          <span>Trace Cache 24 MB (freed 118 MB)</span>
          <button type="button" class="ag-v2-inline-btn" data-tone="ok" data-action="cache-reset">Restore Demo</button>
        </span>`;
    }
    return `
      <span class="ag-v2-inline-cleaner">
        <span>Trace Cache 142 MB</span>
        <button type="button" class="ag-v2-inline-btn" data-action="cache-start">${renderAnimIcon('trash-sweep', { size: 12 })}<span>Clear</span></button>
      </span>`;
  }

  function buildModelPanelHtml(isFloating = true) {
    const model = getActiveModel();
    const isOrch = Boolean(model.isOrchestrator);
    const curEffortId = isOrch ? 'high' : (state.effortByModel[model.id] || model.efforts[0]);
    const curMeta = getActiveEffortMeta();

    const groups = [];
    const seen = new Set();
    for (const m of MODELS) {
      if (!seen.has(m.group)) {
        seen.add(m.group);
        groups.push(m.group);
      }
    }

    const listHtml = groups
      .map((grp) => {
        const items = MODELS.filter((m) => m.group === grp)
          .map((m) => {
            const selected = m.id === model.id;
            const mOrch = Boolean(m.isOrchestrator);
            const mLocked = !mOrch && m.efforts.length <= 1;
            const mEffortKey = state.effortByModel[m.id] || m.efforts[0];
            const mEffortMeta = ALL_EFFORTS.find((e) => e.id === mEffortKey) || ALL_EFFORTS[1];
            const tagText = mOrch ? 'Auto' : mLocked ? 'Fixed' : mEffortMeta.label;
            const mBrand = getModelBrand(m);
            return `
              <button type="button" class="ag-v2-model-option" data-action="pick-model" data-model-id="${m.id}" data-brand="${mBrand}" data-selected="${selected}">
                <span class="ag-v2-model-option-main">
                  <span class="ag-v2-option-logo" data-brand="${mBrand}">${buildBrandMarkSvg(mBrand, 15, '', { tier: selected ? 'auto' : 'low', monochrome: !selected })}</span>
                  <span class="ag-v2-model-option-copy">
                    <div class="ag-v2-model-name">${escapeHtml(m.name)}</div>
                    <div class="ag-v2-model-sub">${fmtMicroLabel(m.desc)}</div>
                  </span>
                </span>
                <span class="ag-v2-effort-tag" data-model-effort-tag="${m.id}" data-orch="${mOrch}">${tagText}</span>
              </button>`;
          })
          .join('');
        return `<div class="ag-v2-model-group-label">${fmtMicroLabel(grp)}</div>${items}`;
      })
      .join('');

    return `
      <div class="ag-v2-popover ${isFloating ? 'ag-v2-popover-docked is-left' : ''}" data-testid="model-selector-panel">
        <div class="ag-v2-popover-inner">
          <div class="ag-v2-model-list">${listHtml}</div>
          <div class="ces-ag-section" data-effort-slot="true">
            <div class="ces-ag-effort-row" data-ces-effort-row="true" data-row-hidden="${isOrch}" aria-hidden="${isOrch}">
              <div class="ces-ag-effort-head">
                <span class="ces-ag-effort-title">Effort Level</span>
                <span class="ces-ag-effort-value">${escapeHtml(curMeta.label)}</span>
              </div>
              <div class="ces-inline" data-workbench-ces-mount="true" data-effort="${escapeHtml(curEffortId)}"></div>
            </div>
            <div class="ces-ag-effort-row ag-v2-orch-row" data-testid="orchestrator-effort-bar" data-row-hidden="${!isOrch}" aria-hidden="${!isOrch}">
              <div class="ces-ag-effort-head">
                <span class="ces-ag-effort-title">Effort Level</span>
                <span class="ces-ag-effort-value ag-v2-orch-value">Auto</span>
              </div>
              <div class="ces-inline">
                <div class="ag-v2-orch-track" role="status" title="Orchestrator cut-crystal auto scheduling (Plan <-> Exec, subtle local prism dispersion on hover)" aria-label="Orchestrator crystal prism effort bar (Auto)">
                  <canvas class="ag-v2-orch-canvas" data-orch-crystal-canvas="true" aria-hidden="true"></canvas>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>`;
  }

  function buildDashboardPanelHtml(isFloating = true) {
    const ctx = getContextTelemetry();
    const samp = getModelSamplingTelemetry();
    const model = getActiveModel();
    const vialOn = Boolean(state.contextVialEnabled);
    const claudePct = state.vialCritical ? 12 : 82;
    const proPct = state.vialCritical ? 46 : 94;
    const flashPct = 100;
    const isCrit = state.vialCritical;
    const sysColor = isCrit ? '#C75714' : '#1B49B2';
    const convColor = isCrit ? '#F59E0B' : '#3186FF';
    const toolColor = isCrit ? '#FFDB47' : '#5CC6FC';

    const leftColumnHtml = vialOn
      ? `
            <div class="ag-v2-radar-left">
              <div class="ag-v2-vial-well">
                <div class="ag-v2-vial-readout">
                  <span class="ag-v2-vial-readout-label">512K</span>
                  <strong class="ag-v2-vial-readout-val" data-warn="${state.vialCritical}">${escapeHtml(ctx.pctText)}</strong>
                </div>
                <canvas class="ag-v2-vial-canvas" data-vial-canvas="true" width="192" height="440" title="512K capacity (128k / 256k / 384k laser ticks) · Click to ripple fluid, drag sample bar to tilt gravity"></canvas>
                <div class="ag-v2-vial-rate">${escapeHtml(ctx.rate)}</div>
              </div>
            </div>`
      : '';

    const minimalBarHtml = !vialOn
      ? `
                <div class="ag-v2-ctx-bar-wrap" data-testid="context-minimal-bar" data-warn="${state.vialCritical}" data-camp="${model.camp}">
                  <div class="ag-v2-ctx-bar-track" data-has-hover="${state.hoveredSlice >= 0}">
                    <span class="ag-v2-ctx-bar-seg" data-layer-slice="0" data-hovered="${state.hoveredSlice === 0}" style="width:${(ctx.ratios[0] * 100).toFixed(2)}%; --seg-color:${sysColor};" title="System Rules · ${escapeHtml(ctx.sysK)}"></span>
                    <span class="ag-v2-ctx-bar-seg" data-layer-slice="1" data-hovered="${state.hoveredSlice === 1}" style="width:${(ctx.ratios[1] * 100).toFixed(2)}%; --seg-color:${convColor};" title="Conversation · ${escapeHtml(ctx.convK)}"></span>
                    <span class="ag-v2-ctx-bar-seg" data-layer-slice="2" data-hovered="${state.hoveredSlice === 2}" style="width:${(ctx.ratios[2] * 100).toFixed(2)}%; --seg-color:${toolColor};" title="Tools & Subagents · ${escapeHtml(ctx.toolsK)}"></span>
                    <i class="ag-v2-ctx-bar-threshold" aria-hidden="true" title="85% critical compaction threshold (435.2k / 512k)"></i>
                  </div>
                  <div class="ag-v2-ctx-bar-meta">
                    <span>Used ${escapeHtml(ctx.usedText)}</span>
                    <span>Ticks 128k·256k·384k</span>
                  </div>
                </div>`
      : '';

    return `
      <div class="ag-v2-popover ag-v2-dash-popover ${isFloating ? 'ag-v2-popover-docked is-right' : ''}" data-testid="quota-radar-popover" data-vial-mode="${vialOn ? 'vial' : 'bar'}">
        <div class="ag-v2-popover-inner">
          <div class="ag-v2-radar-layout">${leftColumnHtml}

            <div class="ag-v2-radar-right">
              <div class="ag-v2-sample-bar" data-testid="model-sampling-bar" data-status="${samp.status}">
                <div class="ag-v2-sample-top">
                  <span class="ag-v2-sample-title">Live Model Verification</span>
                  <span class="ag-v2-sample-badge">${escapeHtml(samp.badgeText)}</span>
                </div>
                <div class="ag-v2-sample-id" title="${escapeHtml(samp.note)}">${escapeHtml(samp.selectedName)} → ${escapeHtml(samp.sampledModel)}</div>
                <div class="ag-v2-sample-meta">
                  <span>TTFT ${escapeHtml(samp.ttftText)}</span>
                  <span>TPS ${escapeHtml(samp.tpsText)}</span>
                </div>
              </div>

              <div>
                <div class="ag-v2-radar-sec-head">
                  <span class="ag-v2-radar-label">${vialOn ? 'Deep-Ocean Ionized Spectrum' : 'Context Usage'}</span>
                  <span class="ag-v2-radar-head-right">
                    <span class="ag-v2-ctx-readout" data-warn="${state.vialCritical}">${escapeHtml(ctx.usedText)} · ${escapeHtml(ctx.pctText)}</span>
                    <button type="button" class="ag-v2-vial-mode-pill" data-testid="radar-vial-mode-toggle" data-action="toggle-context-vial" data-on="${vialOn}" title="${vialOn ? 'Switch from optical vial to minimal bar' : 'Enable borosilicate fluid vial'}">${vialOn ? 'Vial' : 'Bar'}</button>
                  </span>
                </div>${minimalBarHtml}
                <div class="ag-v2-layer-list">
                  <div class="ag-v2-layer-row" data-layer-slice="0" data-hovered="${state.hoveredSlice === 0}">
                    <span class="ag-v2-layer-key"><i class="ag-v2-swatch" style="background:${sysColor};"></i>System Rules</span>
                    <span class="ag-v2-layer-val">${escapeHtml(ctx.sysK)}</span>
                  </div>
                  <div class="ag-v2-layer-row" data-layer-slice="1" data-hovered="${state.hoveredSlice === 1}">
                    <span class="ag-v2-layer-key"><i class="ag-v2-swatch" style="background:${convColor};"></i>Conversation</span>
                    <span class="ag-v2-layer-val">${escapeHtml(ctx.convK)}</span>
                  </div>
                  <div class="ag-v2-layer-row" data-layer-slice="2" data-hovered="${state.hoveredSlice === 2}">
                    <span class="ag-v2-layer-key"><i class="ag-v2-swatch" style="background:${toolColor};"></i>Tools &amp; Subagents</span>
                    <span class="ag-v2-layer-val">${escapeHtml(ctx.toolsK)}</span>
                  </div>
                </div>
              </div>

              <div>
                <div class="ag-v2-radar-sec-head">
                  <span class="ag-v2-radar-label">5h Model Quota Pool</span>
                  <span class="ag-v2-pool-stats">2ms Fast-RPC</span>
                </div>
                <div class="ag-v2-pool-stack" style="gap:8px;">
                  <div class="ag-v2-pool-item" data-brand="claude" style="gap:3px;">
                    <div class="ag-v2-pool-top">
                      <span class="ag-v2-pool-name"><span class="ag-v2-pool-logo" data-brand="claude">${buildBrandMarkSvg('claude', 12)}</span>Claude Pool</span>
                      <span class="ag-v2-pool-stats"><strong class="ag-v2-pool-pct">${claudePct}%</strong> · 1h 48m</span>
                    </div>
                    <div class="ag-v2-track-4px"><div class="ag-v2-track-fill" data-warn="${claudePct < 15}" style="width:${claudePct}%; --pool-color:var(--ag-pool-claude);"></div></div>
                  </div>
                  <div class="ag-v2-pool-item" data-brand="gemini" style="gap:3px;">
                    <div class="ag-v2-pool-top">
                      <span class="ag-v2-pool-name"><span class="ag-v2-pool-logo" data-brand="gemini">${buildBrandMarkSvg('gemini', 12)}</span>Gemini Pro</span>
                      <span class="ag-v2-pool-stats"><strong class="ag-v2-pool-pct">${proPct}%</strong> · 3h 12m</span>
                    </div>
                    <div class="ag-v2-track-4px"><div class="ag-v2-track-fill" style="width:${proPct}%; --pool-color:var(--ag-pool-pro);"></div></div>
                  </div>
                  <div class="ag-v2-pool-item" data-brand="gemini" style="gap:3px;">
                    <div class="ag-v2-pool-top">
                      <span class="ag-v2-pool-name"><span class="ag-v2-pool-logo" data-brand="gemini">${buildBrandMarkSvg('gemini', 12)}</span>Gemini Flash</span>
                      <span class="ag-v2-pool-stats"><strong class="ag-v2-pool-pct">${flashPct}%</strong> · READY</span>
                    </div>
                    <div class="ag-v2-track-4px"><div class="ag-v2-track-fill" style="width:${flashPct}%; --pool-color:var(--ag-pool-flash);"></div></div>
                  </div>
                </div>
              </div>

              <div class="ag-v2-radar-foot">
                <span class="ag-v2-pool-stats">Local Trace Cache</span>
                ${buildInlineCacheHtml()}
              </div>
            </div>
          </div>
        </div>
      </div>`;
  }

  function buildMotionShowcaseBarHtml() {
    const tiers = [
      ['off', 'Off'],
      ['subtle', 'Subtle'],
      ['standard', 'Standard'],
      ['ultra', 'Ultra'],
    ];
    return `
          <div class="ag-v2-motion-showcase" data-testid="motion-showcase-bar" aria-label="4-tier motion & optical hero transition showcase">
            <div class="ag-v2-motion-showcase-left">
              <span class="ag-v2-sec-title">Motion Tier</span>
              <div class="ag-v2-seg-ctrl" role="group" aria-label="Motion tier switcher" data-testid="studio-motion-tier-tabs">
                ${tiers
                  .map(
                    ([id, label]) =>
                      `<button type="button" class="ag-v2-seg-btn" data-wb-motion="${id}" data-active="${state.motionLevel === id}">${state.motionLevel === id ? '<span class="ag-v2-seg-glide-bg" data-motion-glide="true" aria-hidden="true"></span>' : ''}<span>${label}</span></button>`
                  )
                  .join('')}
              </div>
            </div>
            <div class="ag-v2-motion-showcase-actions">
              <button type="button" class="ag-v2-inline-btn" data-hero-demo="liftoff">${renderAnimIcon('arrow-up-launch', { size: 12 })}<span>Hero A Liftoff</span></button>
              <button type="button" class="ag-v2-inline-btn" data-hero-demo="caustic">${renderAnimIcon('sparkles-pen', { size: 12 })}<span>Hero C Caustic</span></button>
              <button type="button" class="ag-v2-inline-btn" data-hero-demo="fiber">${renderAnimIcon('radar-pulse', { size: 12 })}<span>Hero D Fiber Lock</span></button>
              <button type="button" class="ag-v2-inline-btn" data-hero-demo="dual-stream">${renderAnimIcon('zap-bolt', { size: 12 })}<span>Dual-Track Stream</span></button>
            </div>
          </div>`;
  }

  function buildStudioHomeHtml() {
    const stat = TIME_RANGE_STATS[state.timeRange];
    const claudePct = state.vialCritical ? 12 : 82;
    const proPct = state.vialCritical ? 46 : 94;
    const flashPct = 100;

    return `
      <div class="ag-v2-studio-home ag-v2-scroll">
        <div class="ag-v2-studio-stack">
          <div class="ag-v2-greeting-row">
            <h1 data-testid="home-greeting">${escapeHtml(getGreetingLabel())}</h1>
            <span class="ag-v2-ready-badge">
              <span class="ag-v2-google-dots" aria-hidden="true"><i class="is-b"></i><i class="is-r"></i><i class="is-y"></i><i class="is-g"></i></span>
              <span>WORKSPACE READY</span>
            </span>
          </div>

          <section class="ag-v2-bento-chassis" data-testid="studio-bento-chassis" aria-label="Activity cadence and 5-hour quota overview">
            ${buildOrbitalGeometrySvg()}
            <div class="ag-v2-chassis-inner">
              <div class="ag-v2-chassis-grid">
                <div class="ag-v2-bento-left">
                  <div class="ag-v2-bento-heat-zone">
                    <div class="ag-v2-bento-head">
                      <span class="ag-v2-sec-title">Activity Cadence</span>
                      <div class="ag-v2-seg-ctrl" data-testid="studio-time-range-tabs">
                        <button type="button" class="ag-v2-seg-btn" data-action="pick-range" data-range="7d" data-active="${state.timeRange === '7d'}">${state.timeRange === '7d' ? '<span class="ag-v2-seg-glide-bg" data-range-glide="true" aria-hidden="true"></span>' : ''}<span>7d</span></button>
                        <button type="button" class="ag-v2-seg-btn" data-action="pick-range" data-range="30d" data-active="${state.timeRange === '30d'}">${state.timeRange === '30d' ? '<span class="ag-v2-seg-glide-bg" data-range-glide="true" aria-hidden="true"></span>' : ''}<span>30d</span></button>
                        <button type="button" class="ag-v2-seg-btn" data-action="pick-range" data-range="all" data-active="${state.timeRange === 'all'}">${state.timeRange === 'all' ? '<span class="ag-v2-seg-glide-bg" data-range-glide="true" aria-hidden="true"></span>' : ''}<span>All</span></button>
                      </div>
                    </div>
                    <div class="ag-v2-heat-wrap">
                      <div class="ag-v2-heat-grid" data-heat-grid="true">${buildHeatmapCells()}</div>
                      <div class="ag-v2-heat-tip" aria-hidden="true"><strong></strong><span></span></div>
                    </div>
                  </div>

                  <div class="ag-v2-bento-scale-zone">
                    <div class="ag-v2-hero-metric">
                      Equivalent to <span class="ag-v2-hero-num" data-hero-num="true">${escapeHtml(stat.books)}</span><span class="ag-v2-scale-note">(The Turn of the Screw)</span>
                    </div>
                    <div class="ag-v2-scale-sub" data-scale-sub="true">${escapeHtml(stat.sub)}</div>
                  </div>
                </div>

                <div class="ag-v2-bento-right">
                  <div class="ag-v2-bento-head">
                    <span class="ag-v2-sec-title">5h Quota Pool</span>
                    <span class="ag-v2-pool-stats">${state.vialCritical ? 'Critical Demo' : 'Live Healthy'}</span>
                  </div>

                  <div class="ag-v2-pool-stack">
                    <div class="ag-v2-pool-item" data-brand="claude">
                      <div class="ag-v2-pool-top">
                        <span class="ag-v2-pool-name"><span class="ag-v2-pool-logo" data-brand="claude">${buildBrandMarkSvg('claude', 12)}</span>Claude Pool</span>
                        <span class="ag-v2-pool-stats"><strong class="ag-v2-pool-pct">${claudePct}%</strong> <span>1h 48m</span></span>
                      </div>
                      <div class="ag-v2-track-4px"><div class="ag-v2-track-fill" data-warn="${claudePct < 15}" style="width:${claudePct}%; --pool-color:var(--ag-pool-claude);"></div></div>
                    </div>

                    <div class="ag-v2-pool-item" data-brand="gemini">
                      <div class="ag-v2-pool-top">
                        <span class="ag-v2-pool-name"><span class="ag-v2-pool-logo" data-brand="gemini">${buildBrandMarkSvg('gemini', 12)}</span>Gemini Pro</span>
                        <span class="ag-v2-pool-stats"><strong class="ag-v2-pool-pct">${proPct}%</strong> <span>3h 12m</span></span>
                      </div>
                      <div class="ag-v2-track-4px"><div class="ag-v2-track-fill" style="width:${proPct}%; --pool-color:var(--ag-pool-pro);"></div></div>
                    </div>

                    <div class="ag-v2-pool-item" data-brand="gemini">
                      <div class="ag-v2-pool-top">
                        <span class="ag-v2-pool-name"><span class="ag-v2-pool-logo" data-brand="gemini">${buildBrandMarkSvg('gemini', 12)}</span>Gemini Flash</span>
                        <span class="ag-v2-pool-stats"><strong class="ag-v2-pool-pct">${flashPct}%</strong> <span>READY</span></span>
                      </div>
                      <div class="ag-v2-track-4px"><div class="ag-v2-track-fill" style="width:${flashPct}%; --pool-color:var(--ag-pool-flash);"></div></div>
                    </div>
                  </div>

                  <div class="ag-v2-pool-foot-hint">
                    <span class="ag-v2-foot-hint-text">Click bottom-right badge to open the optical vial</span>
                    <button type="button" class="ag-v2-text-link" data-action="toggle-dash-pop">${renderAnimIcon('radar-pulse', { size: 12.5 })}<span>Inspect</span></button>
                  </div>
                </div>
              </div>

              <div class="ag-v2-chassis-foot">
                <span class="ag-v2-chassis-telemetry">14-day streak · Peak 18:00–21:00 · Move pointer for fluid wake, click for 4-color ripple</span>
                ${buildInlineCacheHtml()}
              </div>
            </div>
          </section>
          ${buildMotionShowcaseBarHtml()}
        </div>
      </div>`;
  }

  // Streamed prose blocks: reveal incrementally while streaming, then append table/quote/code cards in place
  function buildProseChunkHtml(item, withCaret) {
    const caret = withCaret ? '<span class="ag-v2-stream-caret"></span>' : '';
    return item.type === 'h3' ? `<h2>${escapeHtml(item.text)}${caret}</h2>` : `<p>${item.html}${caret}</p>`;
  }

  function buildProseTailHtml() {
    return `
        <table class="ag-v2-md-table">
          <thead><tr><th>Metric</th><th>Selected Model</th><th>Actual Response</th><th class="is-num">TTFT</th></tr></thead>
          <tbody>
            <tr><td>Orchestrated</td><td>Orchestrator</td><td>Carbon (Plan) ⇄ Exec</td><td class="is-num">0.32s</td></tr>
            <tr><td>Flagship</td><td>Gemini 4 Carbon</td><td>gemini-4-carbon-001</td><td class="is-num">0.41s</td></tr>
          </tbody>
        </table>
        <blockquote class="ag-v2-md-quote">Refinement comes from 95% quiet restraint framing 5% optical focus and character warmth.</blockquote>
        <div class="ag-v2-code-card" data-testid="code-block-container">
          <div class="ag-v2-code-inner">
            <div class="ag-v2-code-head">
              <div class="ag-v2-code-meta">
                <span class="ag-v2-code-lang">CSS</span>
                <span class="ag-v2-code-file">v2-tokens.css · Input-Only Prism</span>
              </div>
              <button type="button" class="ag-v2-copy-btn" data-action="copy-code" aria-label="Copy code">
                <span class="ag-v2-copy-icons" aria-hidden="true">${renderAnimIcon('copy-check', { size: 13 })}</span>
                <span class="ag-v2-copy-label" data-copy-label="true">Copy</span>
              </button>
            </div>
            <pre class="ag-v2-code-pre"><code><span class="ag-v2-tok-cm">/* Only agent-input-box carries the Gemini 4-color prism edge */</span>
<span class="ag-v2-tok-prop">--elevation-1</span><span class="ag-v2-tok-punct">:</span>
  <span class="ag-v2-tok-kw">inset</span> <span class="ag-v2-tok-num">0 1px 0</span> <span class="ag-v2-tok-fn">rgba</span><span class="ag-v2-tok-punct">(</span><span class="ag-v2-tok-num">255, 255, 255</span><span class="ag-v2-tok-punct">,</span> <span class="ag-v2-tok-fn">var</span><span class="ag-v2-tok-punct">(</span><span class="ag-v2-tok-str">--ag-v2-specular</span><span class="ag-v2-tok-punct">)),</span>
  <span class="ag-v2-tok-num">0 1px 2px</span> <span class="ag-v2-tok-fn">rgba</span><span class="ag-v2-tok-punct">(</span><span class="ag-v2-tok-num">0, 0, 0, 0.48</span><span class="ag-v2-tok-punct">),</span>
  <span class="ag-v2-tok-num">0 12px 32px -6px</span> <span class="ag-v2-tok-fn">rgba</span><span class="ag-v2-tok-punct">(</span><span class="ag-v2-tok-num">0, 0, 0, 0.62</span><span class="ag-v2-tok-punct">);</span></code></pre>
          </div>
        </div>`;
  }

  function buildStreamProseHtml() {
    const totalUnits = STREAM_FULL_PARAGRAPHS.length;
    if (state.streamPhase === 'done') {
      return STREAM_FULL_PARAGRAPHS.map((item) => buildProseChunkHtml(item, false)).join('') + buildProseTailHtml();
    }
    const visible = Math.min(totalUnits, state.streamWordProgress);
    const chunks = [];
    for (let i = 0; i < visible; i++) {
      chunks.push(buildProseChunkHtml(STREAM_FULL_PARAGRAPHS[i], i === visible - 1));
    }
    return chunks.join('');
  }

  function getThinkingTriggerText() {
    const isStreaming = state.streamPhase === 'streaming';
    return state.hasToolError
      ? 'Reasoning interrupted · 1 blocking error found (auto-expanded)'
      : isStreaming
        ? 'Reasoning & invoking tools...'
        : 'Thought for 14s · 6 tool steps';
  }

  function buildThinkingTriggerInnerHtml() {
    const isStreaming = state.streamPhase === 'streaming';
    const model = getActiveModel();
    const brand = getModelBrand(model);
    const status = getThinkingStatus();
    const spark = `<span class="ag-v2-thinking-spark" data-thinking-spark="true" data-brand="${brand}" data-state="${status}">${buildBrandMarkSvg(brand, 13, '', { tier: status === 'error' ? 'low' : 'auto', monochrome: status === 'error' })}</span>`;
    const chevron =
      isStreaming || state.hasToolError
        ? ''
        : renderAnimIcon('chevron-right', { size: 12, className: 'ag-v2-thinking-chevron' });
    return `${spark}
                <span class="ag-v2-thinking-label">${escapeHtml(getThinkingTriggerText())}</span>
                <span class="ag-v2-thinking-meta">${state.thinkingOpen ? 'Click to collapse' : 'Click to expand'}</span>${chevron}`;
  }

  function buildStepRowsHtml() {
    const isStreaming = state.streamPhase === 'streaming';
    const steps = [
      { verb: 'READ', path: 'workbench/styles/v2-tokens.css#L1-L130', dur: '11ms', state: 'ok' },
      { verb: 'EDIT', path: 'dual-mascot-rig.js (Clawd & Gemini Cat)', dur: '24ms', state: 'ok' },
      { verb: 'TEST', path: 'node --test test/*.test.mjs', dur: state.hasToolError ? 'ERR 1' : '184ms', state: state.hasToolError ? 'error' : 'ok' },
      { verb: 'RPC', path: 'GetCascadeTrajectoryGeneratorMetadata', dur: isStreaming ? '...' : '2ms', state: isStreaming ? 'running' : 'ok' },
    ];
    return steps
      .map(
        (s, idx) => `
      <div class="ag-v2-step-row" data-state="${s.state}" data-step-idx="${idx}" data-testid="tool-call-step-row">
        <div class="ag-v2-step-left">
          <span class="ag-v2-step-dot"></span>
          <span class="ag-v2-step-verb">${s.verb}</span>
          <span class="ag-v2-step-path">${escapeHtml(s.path)}</span>
        </div>
        <span class="ag-v2-step-dur">${escapeHtml(s.dur)}</span>
      </div>`
      )
      .join('');
  }

  function buildSimbarInnerHtml() {
    const isStreaming = state.streamPhase === 'streaming';
    const auraLabelMap = {
      idle: 'IDLE · 8fps Soft Breathe',
      start: 'START · Prism Surge',
      running: 'RUNNING · Prism Flow',
      complete: 'COMPLETE · Mist Settle',
    };
    const auraLabel = auraLabelMap[state.convAuraPhase] || auraLabelMap.idle;
    return `
            <span class="ag-v2-sim-status">
              <span class="ag-v2-live-dot" data-tone="${isStreaming ? 'live' : state.hasToolError ? 'error' : 'ok'}"></span>
              <span>${isStreaming ? 'Streaming: bottom aura glowing while lead mascot takes notes…' : state.hasToolError ? 'Error guard active: thinking chain pinned open' : 'Complete: borderless thinking chain smoothly collapsed'}</span>
              <span class="ag-v2-aura-phase-pill" data-conv-aura-badge="${state.convAuraPhase}">${auraLabel}</span>
            </span>
            <div class="ag-v2-sim-actions">
              <button type="button" class="ag-v2-inline-btn" data-action="replay-stream">${renderAnimIcon('zap-bolt', { size: 12 })}<span>${isStreaming ? 'Streaming...' : 'Replay Stream -> Watch 4-State Aura & Mascots'}</span></button>
              <button type="button" class="ag-v2-inline-btn" data-tone="${state.hasToolError ? 'warn' : ''}" data-action="toggle-tool-error">${renderAnimIcon('alert-triangle', { size: 12 })}<span>${state.hasToolError ? 'Restore Healthy' : 'Simulate Tool Error'}</span></button>
            </div>`;
  }

  function getThinkingStatus() {
    return state.hasToolError ? 'error' : state.streamPhase === 'streaming' ? 'streaming' : 'done';
  }

  function buildChatStreamHtml() {
    return `
      <div class="ag-v2-scroll" data-testid="conversation-view">
        <div class="ag-v2-stream-inner">
          <div class="ag-v2-stream-simbar">${buildSimbarInnerHtml()}
          </div>

          <div class="ag-v2-turn-user">
            <div data-testid="user-message-bubble">
              <div class="ag-v2-user-text-wrap" data-collapsed="${!state.userBubbleExpanded}">
                Upgrade the Antigravity Desktop workbench to v3.3: align reasoning effort tiers to real host ranges (no fake Off), build the dual-phase crystal bar for Orchestrator, upgrade the Water Vial with borosilicate glass and live model verification, and pair Clawd with Gemini Cat above the composer.
              </div>
              <button type="button" class="ag-v2-user-expand-btn" data-action="toggle-user-bubble">${state.userBubbleExpanded ? 'Collapse Prompt' : 'Expand Full Prompt'}</button>
            </div>
          </div>

          <div class="ag-v2-turn-assistant">
            <div class="ag-v2-thinking-block" data-open="${state.thinkingOpen}" data-status="${getThinkingStatus()}">
              <button type="button" data-testid="thinking-collapsible-trigger" data-action="toggle-thinking" aria-expanded="${state.thinkingOpen}">
                ${buildThinkingTriggerInnerHtml()}
              </button>

              <div class="ag-v2-thinking-collapse" data-testid="worked-for-collapsible" ${state.thinkingOpen ? '' : 'inert'}>
                <div class="ag-v2-thinking-inner">
                  <div class="ag-v2-worked-guide" ${state.streamPhase === 'streaming' && state.thinkingOpen && state.motionLevel === 'ultra' ? 'data-ag-cs-thought-streaming="1"' : ''}>
                    <div class="ag-v2-thinking-note">
                      1. Verify <code>dual-mascot-rig.js</code> flat pixel sprite matrix (PX=3, TICK=100ms, borderless silhouettes).<br />
                      2. Verify <code>antigravity-effort-slider</code> native <code>.ces-track</code> and <code>.ces-claude-canvas</code> lossless mounting.
                    </div>
                    <div class="ag-v2-step-list">${buildStepRowsHtml()}</div>
                  </div>
                </div>
              </div>
            </div>

            <article data-testid="planner-response-text">
              ${buildStreamProseHtml()}
            </article>
          </div>
        </div>
      </div>`;
  }

  function unwrapWbStreamSpan(span) {
    if (!span || !span.parentNode) return;
    const parent = span.parentNode;
    while (span.firstChild) {
      parent.insertBefore(span.firstChild, span);
    }
    parent.removeChild(span);
    if (typeof parent.normalize === 'function') {
      try {
        parent.normalize();
      } catch {}
    }
  }

  function decorateDualTrackStreamNode(el) {
    if (!el || state.motionLevel !== 'ultra' || prefersReducedMotion()) return;
    const tag = String(el.tagName || '').toUpperCase();
    const isCodeOrTable =
      tag === 'TABLE' ||
      tag === 'PRE' ||
      tag === 'CODE' ||
      el.getAttribute?.('data-testid') === 'code-block-container' ||
      Boolean(el.querySelector?.('pre, table'));
    if (isCodeOrTable) {
      el.classList.add('ag-cs-code-scan');
      setTimeout(() => el.classList.remove('ag-cs-code-scan'), 240);
      return;
    }
    // Prose paragraphs/headings: wrap direct text nodes and unwrap back to native Text nodes within 250ms
    for (const ch of Array.from(el.childNodes || [])) {
      if (ch.nodeType === 3 && ch.nodeValue && ch.nodeValue.trim()) {
        const sp = document.createElement('span');
        sp.className = 'ag-cs-stream-chunk';
        el.insertBefore(sp, ch);
        sp.appendChild(ch);
        setTimeout(() => unwrapWbStreamSpan(sp), 250);
      }
    }
  }

  /* ── In-place chat stream patching: mutate existing nodes only to preserve CSS transitions & scroll position ── */
  function patchChatStreamDom(opts = {}) {
    const views = document.querySelectorAll('[data-testid="conversation-view"]');
    if (!views.length) return false;
    const status = getThinkingStatus();
    const isThoughtStreaming = state.streamPhase === 'streaming' && state.thinkingOpen && state.motionLevel === 'ultra' && !prefersReducedMotion();
    views.forEach((view) => {
      const simbar = view.querySelector('.ag-v2-stream-simbar');
      if (simbar) simbar.innerHTML = buildSimbarInnerHtml();

      const block = view.querySelector('.ag-v2-thinking-block');
      if (block) {
        block.setAttribute('data-status', status);
        block.setAttribute('data-open', String(state.thinkingOpen));
        const trigger = block.querySelector('[data-testid="thinking-collapsible-trigger"]');
        if (trigger) {
          trigger.innerHTML = buildThinkingTriggerInnerHtml();
          trigger.setAttribute('aria-expanded', String(state.thinkingOpen));
        }
        const collapse = block.querySelector('.ag-v2-thinking-collapse');
        if (collapse) collapse.toggleAttribute('inert', !state.thinkingOpen);
        const guide = block.querySelector('.ag-v2-worked-guide');
        if (guide) {
          if (isThoughtStreaming) guide.setAttribute('data-ag-cs-thought-streaming', '1');
          else guide.removeAttribute('data-ag-cs-thought-streaming');
        }
        // Step rows: only mutate attributes on state change so CSS triggers completion bounce
        const nextRows = document.createElement('div');
        nextRows.innerHTML = buildStepRowsHtml();
        const curRows = block.querySelectorAll('.ag-v2-step-row');
        nextRows.querySelectorAll('.ag-v2-step-row').forEach((nr, idx) => {
          const cr = curRows[idx];
          if (!cr) return;
          const prevState = cr.getAttribute('data-state');
          const ns = nr.getAttribute('data-state');
          if (prevState !== ns) {
            cr.setAttribute('data-state', ns);
            if (ns === 'ok' && prevState === 'running') {
              cr.classList.remove('is-settled');
              void cr.offsetWidth;
              cr.classList.add('is-settled');
              if (state.motionLevel === 'ultra') {
                cr.classList.add('ag-cs-thought-chunk');
                setTimeout(() => cr.classList.remove('ag-cs-thought-chunk'), 200);
              }
            }
          }
          const dur = cr.querySelector('.ag-v2-step-dur');
          const ndur = nr.querySelector('.ag-v2-step-dur');
          if (dur && ndur && dur.textContent !== ndur.textContent) dur.textContent = ndur.textContent;
        });
      }

      const article = view.querySelector('[data-testid="planner-response-text"]');
      if (article) {
        if (state.streamPhase === 'done') {
          article.querySelectorAll('.ag-cs-stream-chunk').forEach((sp) => unwrapWbStreamSpan(sp));
        }
        if (opts.resetProse) {
          article.innerHTML = buildStreamProseHtml();
          Array.from(article.children).forEach((ch) => decorateDualTrackStreamNode(ch));
          return;
        }
        // Append only newly arrived chunks with dual-track reveal while keeping earlier blocks untouched
        article.querySelectorAll('.ag-v2-stream-caret').forEach((c) => c.remove());
        const total = STREAM_FULL_PARAGRAPHS.length;
        const isDone = state.streamPhase === 'done';
        const target = isDone ? total : Math.min(total, state.streamWordProgress);
        const existing = article.querySelectorAll(':scope > h2, :scope > p').length;
        let html = '';
        for (let i = existing; i < target; i++) {
          html += buildProseChunkHtml(STREAM_FULL_PARAGRAPHS[i], !isDone && i === target - 1);
        }
        if (!isDone && existing >= target && target > 0) {
          const last = article.querySelectorAll(':scope > h2, :scope > p')[target - 1];
          if (last) last.insertAdjacentHTML('beforeend', '<span class="ag-v2-stream-caret"></span>');
        }
        if (isDone && !article.querySelector('[data-testid="code-block-container"]')) html += buildProseTailHtml();
        if (html) {
          const tmp = document.createElement('div');
          tmp.innerHTML = html;
          Array.from(tmp.children).forEach((child, k) => {
            child.classList.add('ag-v2-enter');
            child.style.setProperty('--enter-delay', `${k * 60}ms`);
            article.appendChild(child);
            decorateDualTrackStreamNode(child);
          });
        }
      }
    });
    syncRunningUiDom();
    syncMascotsState();
    return true;
  }

  function buildSettingsSceneHtml() {
    const lp = state.tokens.lightPreset || 'crystal';
    const tm = state.telemetryModule || 'auto';
    const em = state.effortSliderModule || 'auto';
    return `
      <div class="ag-v2-settings-wrap ag-v2-scroll">
        <div class="ag-v2-greeting-row ag-v2-settings-head">
          <h2 class="ag-v2-settings-title" style="display:inline-flex; align-items:center; gap:8px;">
            ${renderSparkOrbitMark({ size: 18 })}
            <span>Obsidian Prism · Optical Engine</span>
          </h2>
          <span class="ag-v2-ready-badge">OBSIDIAN PRISM v1.0 → APPEARANCE</span>
        </div>

        <div class="ag-v2-settings-card" data-testid="appearance-settings-drawer">
          <div class="ag-v2-set-row">
            <div>
              <div class="ag-v2-set-title">Color Palette</div>
              <div class="ag-v2-set-desc">Flagship default Obsidian Dark (zero-tint neutral graphite), with optional Warm Alabaster and Titanium</div>
            </div>
            <div class="ag-v2-seg-ctrl">
              <button type="button" class="ag-v2-seg-btn" data-wb-palette="obsidian" data-active="${state.tokens.palette === 'obsidian'}">Obsidian Dark</button>
              <button type="button" class="ag-v2-seg-btn" data-wb-palette="warm" data-active="${state.tokens.palette === 'warm'}">Warm Alabaster</button>
              <button type="button" class="ag-v2-seg-btn" data-wb-palette="titanium" data-active="${state.tokens.palette === 'titanium'}">Titanium</button>
            </div>
          </div>

          <div class="ag-v2-set-row" data-testid="settings-light-preset-row" style="border-top:1px solid var(--border-etched); padding-top:10px;">
            <div>
              <div class="ag-v2-set-title">Daylight Surface Preset</div>
              <div class="ag-v2-set-desc">Tune cool mineral surface depth, refractive ink highlights, and glass contrast in light mode.</div>
            </div>
            <div class="ag-v2-seg-ctrl" role="group" aria-label="Daylight surface preset">
              <button type="button" class="ag-v2-seg-btn" data-wb-light-preset="crystal" data-active="${lp === 'crystal'}">Daylight Crystal</button>
              <button type="button" class="ag-v2-seg-btn" data-wb-light-preset="alabaster" data-active="${lp === 'alabaster'}">Warm Alabaster</button>
            </div>
          </div>

          <div class="ag-v2-set-row" data-testid="settings-motion-tier-row" style="border-top:1px solid var(--border-etched); padding-top:10px;">
            <div>
              <div class="ag-v2-set-title">Motion Tier</div>
              <div class="ag-v2-set-desc">Control spring feedback, streaming text cadence, and optical scene transition intensity.</div>
            </div>
            <div class="ag-v2-seg-ctrl" role="group" aria-label="Motion tier">
              <button type="button" class="ag-v2-seg-btn" data-wb-motion="off" data-active="${state.motionLevel === 'off'}">Off</button>
              <button type="button" class="ag-v2-seg-btn" data-wb-motion="subtle" data-active="${state.motionLevel === 'subtle'}">Subtle</button>
              <button type="button" class="ag-v2-seg-btn" data-wb-motion="standard" data-active="${state.motionLevel === 'standard'}">Standard</button>
              <button type="button" class="ag-v2-seg-btn" data-wb-motion="ultra" data-active="${state.motionLevel === 'ultra'}">Ultra</button>
            </div>
          </div>

          <div class="ag-v2-set-row" data-testid="settings-telemetry-coexist-row" style="border-top:1px solid var(--border-etched); padding-top:10px;">
            <div>
              <div class="ag-v2-set-title">Bottom Telemetry &amp; 512K Optical Vial (Auto-Coexist)</div>
              <div class="ag-v2-set-desc">Built-in throughput and quota sampling; automatically yields when an external dashboard plugin is detected.</div>
            </div>
            <div class="ag-v2-seg-ctrl" role="group" aria-label="Bottom telemetry and 512K optical vial">
              <button type="button" class="ag-v2-seg-btn" data-action="set-telemetry-mod" data-mod-val="auto" data-active="${tm === 'auto'}">Auto</button>
              <button type="button" class="ag-v2-seg-btn" data-action="set-telemetry-mod" data-mod-val="on" data-active="${tm === 'on'}">On</button>
              <button type="button" class="ag-v2-seg-btn" data-action="set-telemetry-mod" data-mod-val="off" data-active="${tm === 'off'}">Off</button>
            </div>
          </div>

          <div class="ag-v2-set-row" data-testid="settings-slider-coexist-row" style="border-top:1px solid var(--border-etched); padding-top:10px;">
            <div>
              <div class="ag-v2-set-title">Model Effort Slider (Auto-Coexist)</div>
              <div class="ag-v2-set-desc">Built-in effort slider inside the model menu; yields automatically if an external slider instance is active.</div>
            </div>
            <div class="ag-v2-seg-ctrl" role="group" aria-label="Model effort slider">
              <button type="button" class="ag-v2-seg-btn" data-action="set-slider-mod" data-mod-val="auto" data-active="${em === 'auto'}">Auto</button>
              <button type="button" class="ag-v2-seg-btn" data-action="set-slider-mod" data-mod-val="on" data-active="${em === 'on'}">On</button>
              <button type="button" class="ag-v2-seg-btn" data-action="set-slider-mod" data-mod-val="off" data-active="${em === 'off'}">Off</button>
            </div>
          </div>

          <div class="ag-v2-set-row" style="border-top:1px solid var(--border-etched); padding-top:10px;">
            <div>
              <div class="ag-v2-set-title">Fullscreen ASCII Glyph Wave Backdrop</div>
              <div class="ag-v2-set-desc">Click for concentric prism ripples with automatic 0fps idle sleep</div>
            </div>
            <button type="button" class="ag-v2-switch" data-action="toggle-ripple" data-on="${state.rippleEnabled}"></button>
          </div>

          <div class="ag-v2-set-row" style="border-top:1px solid var(--border-etched); padding-top:10px;">
            <div>
              <div class="ag-v2-set-title">Input-Only Gemini Prism Focus Rim</div>
              <div class="ag-v2-set-desc">Only the primary composer carries 4-color prism refraction; all other cards stay neutral</div>
            </div>
            <button type="button" class="ag-v2-switch" data-action="toggle-prism" data-on="${state.tokens.prismStrength > 0}"></button>
          </div>

          <div class="ag-v2-set-row" style="border-top:1px solid var(--border-etched); padding-top:10px;">
            <div>
              <div class="ag-v2-set-title">Home Editorial Serif Accent</div>
              <div class="ag-v2-set-desc">Applies only to the Studio greeting and scale callouts, never inside conversation prose</div>
            </div>
            <button type="button" class="ag-v2-switch" data-action="toggle-serif" data-on="${state.tokens.editorialSerif}"></button>
          </div>

          <div class="ag-v2-set-row" style="border-top:1px solid var(--border-etched); padding-top:10px;">
            <div>
              <div class="ag-v2-set-title">Mini Costume Crab Pile (Cowboy / Shades / Wizard)</div>
              <div class="ag-v2-set-desc">Summon 3 miniature 2px pixel crabs strolling beside the composer</div>
            </div>
            <button type="button" class="ag-v2-switch" data-action="toggle-mini-pile" data-on="${state.mascotMiniPile}"></button>
          </div>

          <div class="ag-v2-set-row" style="border-top:1px solid var(--border-etched); padding-top:10px;">
            <div>
              <div class="ag-v2-set-title">Borosilicate Optical Vial Context</div>
              <div class="ag-v2-set-desc">Render the WebGL2 borosilicate vial in the radar popover; disable to show a minimal segmented bar</div>
            </div>
            <button type="button" class="ag-v2-switch" data-testid="context-vial-switch" data-action="toggle-context-vial" data-on="${state.contextVialEnabled}"></button>
          </div>
        </div>

        <div class="ag-v2-settings-card" data-testid="workbench-about-preview" style="margin-top:12px;">
          <div class="ag-v2-set-row">
            <div>
              <div class="ag-v2-set-title">About, Git Updates &amp; Open-Source Credits · Obsidian Prism v1.0.8-beta.2</div>
              <div class="ag-v2-set-desc">GPL-3.0 · Credits: 0DNANCY/agy-claude-style, ATtacK030130/antigrative-dashboard, LLYSH-HANNARI/antigravity-Codex-Claude-effort-slider, Nwflower/dsh-claude-style, Microqian2th/dsh-codex-effort-slider, mobius/dsh-performance-slider, claudenoshujin/claude-web (Mascot Pile &amp; Micro-Ecology Interaction Inspiration)</div>
            </div>
            <span class="ag-v2-ready-badge">GPL-3.0 · 7 CREDITS</span>
          </div>
        </div>
      </div>`;
  }

  function buildOverlayCardHtml() {
    if (state.overlayDemo === 'takeover') {
      const modeDesc =
        state.mascotYieldMode === 'leap'
          ? 'Mascots hopped onto the top edge of the takeover card (draggable / stackable)'
          : 'Mascots are peeking from behind the composer edge';
      return `
        <div class="ag-v2-overlay-card" data-testid="interaction-takeover-card">
          <div class="ag-v2-overlay-head">
            <span class="ag-v2-overlay-title">
              <span class="ag-v2-perm-dot"></span>
              <span>Permission Approval · Allow patch write? (Mascot Yield Demo)</span>
            </span>
            <span class="ag-v2-pool-stats">${escapeHtml(modeDesc)}</span>
          </div>
          <div class="ag-v2-overlay-desc">
            Workbench demo only (never touches real desktop app.asar). Click Toggle Yield Pose to compare hopping atop vs peeking behind.
          </div>
          <div class="ag-v2-overlay-actions">
            <button type="button" class="ag-v2-inline-btn" data-action="reroll-takeover">Toggle Yield Pose</button>
            <button type="button" class="ag-v2-inline-btn" data-tone="warn" data-action="close-overlay">Close Card</button>
          </div>
        </div>`;
    }

    if (state.overlayDemo === 'slash') {
      const items = [
        { cmd: '/grill-me', desc: 'Interactive interview to align design decisions and edge cases' },
        { cmd: '/compact', desc: 'Compress context at a clean milestone and anchor key state' },
        { cmd: '/teamwork', desc: 'Launch a parallel multi-worker agent swarm' },
      ];
      const rows = items
        .map(
          (it, idx) => `
          <div class="ag-v2-slash-row" data-active="${idx === 0}" data-action="close-overlay">
            <span class="ag-v2-slash-cmd">${it.cmd}</span>
            <span class="ag-v2-slash-desc">${it.desc}</span>
          </div>`
        )
        .join('');
      return `
        <div class="ag-v2-overlay-card" data-testid="slash-command-menu">
          <div class="ag-v2-overlay-head">
            <span class="ag-v2-overlay-title">Slash Command Menu · Mascots Peeking Behind Edge</span>
            <button type="button" class="ag-v2-inline-btn" data-action="close-overlay">Close</button>
          </div>
          <div>${rows}</div>
        </div>`;
    }

    return '';
  }

  function buildComposerActionBtnHtml(allowFloat = true) {
    if (allowFloat && state.streamPhase === 'streaming') {
      return `<button type="button" class="ag-v2-send-btn is-running" data-testid="input-cancel-button" data-action="stop-stream" aria-label="Stop generation" title="Stop generation"><div class="ag-v2-stop-square" aria-hidden="true"></div></button>`;
    }
    return `<button type="button" class="ag-v2-send-btn" data-testid="send-button" aria-label="Send" title="Send">${renderAnimIcon('arrow-up-launch', { size: 15 })}</button>`;
  }

  function buildComposerHtml(allowFloat = true) {
    const model = getActiveModel();
    const effort = getActiveEffortMeta();
    const isOrch = Boolean(model.isOrchestrator);
    const locked = !isOrch && model.efforts.length <= 1;
    const isSpectrum = !isOrch && !locked && effort.id === 'xhigh';
    const brand = getModelBrand(model);
    const tier = getModelEffortTier(model, effort);
    const ctx = getContextTelemetry();

    const activePop =
      !allowFloat
        ? ''
        : state.openPopover === 'effort'
          ? buildModelPanelHtml(true)
          : state.openPopover === 'dashboard'
            ? buildDashboardPanelHtml(true)
            : '';

    const overlayHtml = allowFloat ? buildOverlayCardHtml() : '';

    const circumference = 34.5575;
    const dashOffset = (circumference * (1 - ctx.pct / 100)).toFixed(2);

    return `
      <div class="ag-v2-composer-dock">
        <div class="ag-v2-composer-wrap">
          <div class="ag-v2-mascot-stage" data-mascot-stage="true" data-floating="${allowFloat}"></div>

          ${overlayHtml}
          ${activePop}

          <div class="ag-prism-rim" data-prism-tier="1" data-testid="agent-input-box">
            <div class="ag-v2-composer-input" contenteditable="true" data-placeholder="Type to watch Clawd & Gemini Cat nod along — drag to toss or stack them on each other!"></div>
            <div data-testid="input-box-bottom-toolbar">
              <div class="ag-v2-toolbar-left">
                <button type="button" class="ag-v2-chip-btn ag-v2-chip-icon" title="Attach file or screenshot" aria-label="Attach file or screenshot">
                  ${renderAnimIcon('plus-spin', { size: 14 })}
                </button>
                <button type="button" class="ag-v2-chip-btn ag-v2-model-trigger-pill" data-testid="model-selector-trigger" data-brand="${brand}" data-tier="${tier}" data-action="toggle-effort-pop" aria-expanded="${allowFloat && state.openPopover === 'effort'}">
                  ${buildModelEffortGlyphHtml(model, effort)}
                  <span class="ag-v2-model-trigger-name" data-composer-model-name="true">${escapeHtml(model.name)}</span>
                  <span class="ag-v2-effort-tag" data-tier="${tier}" data-high="${isSpectrum}" data-orch="${isOrch}" data-composer-effort-tag="true">${isOrch ? 'AUTO' : locked ? 'FIXED' : effort.short}</span>
                </button>
                <button type="button" class="ag-v2-chip-btn" data-testid="permissions-selector-trigger" data-action="toggle-takeover">
                  <span class="ag-v2-perm-dot"></span>
                  <span class="ag-v2-chip-label">Auto</span>
                </button>
              </div>

              <div class="ag-v2-toolbar-right">
                <div class="ag-v2-telemetry-stream" data-testid="composer-telemetry-stream">
                  <span class="ag-v2-tele-item" data-tele="speed">${escapeHtml(ctx.rate === 'IDLE' ? '74.8 tok/s' : ctx.rate)}</span>
                  <span class="ag-v2-tele-sep" aria-hidden="true">·</span>
                  <span class="ag-v2-tele-item" data-tele="cache"><span class="ag-v2-tele-dim">Cache Hit</span> 86.9%</span>
                  <span class="ag-v2-tele-sep" aria-hidden="true">·</span>
                  <button type="button" class="ag-v2-ctx-trigger" data-testid="dashboard-vial-trigger" data-vial-mode="${state.contextVialEnabled ? 'vial' : 'bar'}" data-warn="${state.vialCritical}" data-action="toggle-dash-pop" aria-expanded="${allowFloat && state.openPopover === 'dashboard'}">
                    <svg class="ag-v2-ring-svg" viewBox="0 0 16 16" aria-hidden="true" style="${state.contextVialEnabled ? '' : 'display:none;'}">
                      <circle class="ag-v2-ring-track" cx="8" cy="8" r="5.5" />
                      <circle class="ag-v2-ring-arc" cx="8" cy="8" r="5.5" stroke-dasharray="${circumference.toFixed(2)}" stroke-dashoffset="${dashOffset}" />
                    </svg>
                    <span class="ag-v2-trigger-minibar" data-trigger-minibar="true" aria-hidden="true" style="${state.contextVialEnabled ? 'display:none;' : ''}"><i style="width:${Math.round(ctx.pct)}%;"></i></span>
                    <span>${Math.round(ctx.pct)}%</span>
                    <span class="ag-v2-ctx-tooltip">Live rate ${escapeHtml(ctx.rate)} · Click to open ${state.contextVialEnabled ? 'optical vial' : 'minimal context bar'}</span>
                  </button>
                </div>
                ${buildComposerActionBtnHtml(allowFloat)}
              </div>
            </div>
          </div>
        </div>
      </div>`;
  }

  function getActiveSessionId() {
    return state.scene === 'studio'
      ? 'studio-home'
      : state.scene === 'm3lab'
        ? 'm3-surface-lab'
        : state.scene === 'effort'
          ? 'effort-merge'
          : state.scene === 'dashboard'
            ? 'dash-fastpath'
            : state.scene === 'settings'
              ? 'theme-tokens'
              : 'v2-refactor';
  }

  function buildM3LabSceneHtml() {
    const slashItems = [
      { cmd: '/plan', desc: 'Two-phase architecture blueprint + dependency breakdown', kbd: 'P' },
      { cmd: '/boost', desc: 'Deep architectural problem solving + multi-angle verification', kbd: 'B' },
      { cmd: '/teamwork', desc: 'Native multi-agent swarm collaboration', kbd: 'T' },
      { cmd: '/grill-me', desc: 'Interactive requirements & edge-case alignment', kbd: 'G' },
      { cmd: '/compact', desc: 'Clean breakpoint context compaction', kbd: 'C' },
    ];
    const diffBadge =
      state.m3DiffStatus === 'accepted'
        ? 'Accepted'
        : state.m3DiffStatus === 'rejected'
          ? 'Rejected'
          : '+14 / -3 · Pending';
    const toastMeta = {
      info: { title: 'Info · Theme synced to Sidecar overlays', detail: 'Pushed 5-step Tonal Surface & Google Sans tokens' },
      success: { title: 'Success · All 312 automated checks passed', detail: 'style.css pure-ASCII guard and 0fps idle sleep verified' },
      warning: { title: 'Warning · 512K Vial reached 84%', detail: 'Run /compact at a clean checkpoint to reclaim context' },
      error: { title: 'Error · Out-of-bounds symlink write blocked', detail: 'Path escape detector triggered Fail-Closed guard' },
    };
    const activeToast = toastMeta[state.m3ToastType] || toastMeta.info;

    return `
      <div class="wb-m3lab-scroll" data-testid="m3-surface-lab">
        <div class="wb-m3lab-wrap">
          <div class="wb-m3lab-banner">
            <div>
              <div class="wb-m3lab-banner-title">Google M3 Expressive · 1:1 Live style.css Surface Lab</div>
              <div class="wb-m3lab-banner-sub">Connected live to /shared/style.css host selectors · Syncs with 4 flagship themes, Split, Quad, and corner radius</div>
            </div>
            <div class="wb-m3lab-swatches" aria-label="5-step Tonal Surface scale">
              <span class="wb-m3lab-swatch"><i style="background:var(--ag-cs-tonal-0)"></i>T0</span>
              <span class="wb-m3lab-swatch"><i style="background:var(--ag-cs-tonal-1)"></i>T1</span>
              <span class="wb-m3lab-swatch"><i style="background:var(--ag-cs-tonal-2)"></i>T2</span>
              <span class="wb-m3lab-swatch"><i style="background:var(--ag-cs-tonal-3)"></i>T3</span>
              <span class="wb-m3lab-swatch"><i style="background:var(--ag-cs-tonal-4)"></i>T4</span>
            </div>
          </div>

          <div class="wb-m3lab-grid">
            <!-- Surface 1: Fastpick / Slash Command Menu -->
            <section class="wb-m3lab-panel">
              <div class="wb-m3lab-panel-head">
                <span class="wb-m3lab-panel-title">1. Fastpick &amp; Slash Command Popover</span>
                <span class="wb-m3lab-panel-tag">.agy-fastpick / [data-testid="slash-command-menu"]</span>
              </div>
              <div class="agy-fastpick" data-testid="slash-command-menu">
                <div class="wb-m3lab-fastpick-body">
                  <input type="text" value="/boo" placeholder="Search Slash commands or workspace files..." aria-label="Fastpick search input" />
                  <div role="listbox" aria-label="Slash command options">
                    ${slashItems
                      .map((it, idx) => {
                        const sel = idx === state.m3ActiveSlashIdx;
                        return `
                          <button type="button" class="wb-m3lab-fp-item" role="option" aria-selected="${sel}" data-active="${sel}" data-action="m3-pick-slash" data-idx="${idx}">
                            <span><strong>${escapeHtml(it.cmd)}</strong> <span style="opacity:.72;margin-left:6px;">${escapeHtml(it.desc)}</span></span>
                            <span class="wb-m3lab-fp-meta"><kbd>Ctrl</kbd><kbd>${escapeHtml(it.kbd)}</kbd></span>
                          </button>`;
                      })
                      .join('')}
                  </div>
                </div>
              </div>
            </section>

            <!-- Surface 2: Diff review card & line/word diffs -->
            <section class="wb-m3lab-panel">
              <div class="wb-m3lab-panel-head">
                <span class="wb-m3lab-panel-title">2. Code Diff Review Card &amp; 25px Dual Pills</span>
                <span class="wb-m3lab-panel-tag">[data-testid="changed-files-card"] / .monaco-diff-editor</span>
              </div>
              <div data-testid="changed-files-card" style="padding:10px 12px;">
                <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:8px;">
                  <span style="font-size:12.5px;font-weight:600;">host-workbench-enhancer.js</span>
                  <span style="font-size:11px;opacity:.78;font-variant-numeric:tabular-nums;">${escapeHtml(diffBadge)}</span>
                </div>
                <div class="monaco-diff-editor" style="border-radius:var(--ag-cs-r-md);overflow:hidden;border:1px solid var(--ag-cs-border-1);">
                  <div class="wb-m3lab-diff-lines">
                    <div class="wb-m3lab-diff-line"><span class="wb-m3lab-diff-ln">36</span><span>  '--warning', '--success', '--scrim',</span></div>
                    <div class="wb-m3lab-diff-line line-delete"><span class="wb-m3lab-diff-ln">37</span><span>- <span class="char-delete">const legacyBg = '#121216';</span></span></div>
                    <div class="wb-m3lab-diff-line line-insert"><span class="wb-m3lab-diff-ln">37</span><span>+ <span class="char-insert">'--ag-cs-tonal-0', '--ag-cs-tonal-1', '--ag-cs-tonal-2',</span></span></div>
                    <div class="wb-m3lab-diff-line line-insert"><span class="wb-m3lab-diff-ln">38</span><span>+ <span class="char-insert">'--ag-cs-tonal-3', '--ag-cs-tonal-4', '--font-sans',</span></span></div>
                  </div>
                  <div style="display:flex;align-items:center;justify-content:space-between;padding:8px 10px;border-top:1px solid var(--ag-cs-border-1);background:var(--ag-cs-tonal-2);">
                    <span style="font-size:11px;color:var(--muted-foreground);">Hunk 1/2 · Scoped to cross-origin Sidecar tokens</span>
                    <div class="ag-m3-diff-actions">
                      <button type="button" data-diff-action="accept" data-action="m3-diff-decision" data-decision="accepted">Accept</button>
                      <button type="button" data-diff-action="reject" data-action="m3-diff-decision" data-decision="rejected">Reject</button>
                    </div>
                  </div>
                </div>
              </div>
            </section>

            <!-- Surface 3: Plugin / MCP cards + Sheet form + 4-tone optical Toast -->
            <section class="wb-m3lab-panel">
              <div class="wb-m3lab-panel-head">
                <span class="wb-m3lab-panel-title">3. Plugin Bento Cards · Sheet Form · 4-Tone Optical Toast</span>
                <span class="wb-m3lab-panel-tag">.agy-bento-card / .agy-sheet / .agy-toast</span>
              </div>
              <div class="wb-m3lab-bento-row">
                <div class="agy-plugin-card wb-m3lab-card-pad" data-testid="plugin-card">
                  <div style="display:flex;align-items:center;justify-content:space-between;">
                    <strong style="font-size:12.5px;">Obsidian Prism</strong>
                    <span style="font-size:10.5px;padding:1px 7px;border-radius:999px;background:var(--primary-soft);color:var(--primary);">Active</span>
                  </div>
                  <span style="font-size:11.5px;color:var(--muted-foreground);">Obsidian Prism optical &amp; 0fps idle-sleep engine</span>
                </div>
                <div class="agy-bento-card wb-m3lab-card-pad" data-testid="mcp-server-card">
                  <div style="display:flex;align-items:center;justify-content:space-between;">
                    <strong style="font-size:12.5px;">MCP · gemini-decisions</strong>
                    <span style="font-size:10.5px;padding:1px 7px;border-radius:999px;background:var(--success-soft);color:var(--success);">18ms</span>
                  </div>
                  <span style="font-size:11.5px;color:var(--muted-foreground);">Zero-cost structured screening &amp; verification gate</span>
                </div>
              </div>

              <div class="agy-sheet" style="padding:10px 12px;border-radius:var(--ag-cs-r-lg);border:1px solid var(--ag-cs-border-1);background:var(--ag-cs-tonal-1);">
                <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;">
                  <span style="font-size:12px;font-weight:500;">Sheet Drawer Form Controls &amp; 2px Focus Ring</span>
                  <button type="button" role="switch" aria-checked="${state.m3SwitchOn}" data-action="m3-toggle-switch" style="width:36px;height:20px;padding:2px;border:1px solid var(--ag-cs-border-2);background:${state.m3SwitchOn ? 'var(--primary)' : 'var(--ag-cs-tonal-3)'};cursor:pointer;display:inline-flex;align-items:center;justify-content:${state.m3SwitchOn ? 'flex-end' : 'flex-start'};">
                    <span style="width:14px;height:14px;border-radius:999px;background:#fff;display:block;"></span>
                  </button>
                </div>
                <div class="wb-m3lab-sheet-row">
                  <input type="text" value="Obsidian Neutral" aria-label="Sheet text input" style="padding:6px 10px;font-size:12px;" />
                  <select aria-label="Sheet select" style="padding:6px 10px;font-size:12px;">
                    <option>Balanced (10px shell + pill controls)</option>
                    <option>Soft (14px shell + pill controls)</option>
                    <option>Crisp (6px sharp precision)</option>
                  </select>
                </div>
              </div>

              <div class="wb-m3lab-toast-stack">
                <div style="display:flex;gap:6px;flex-wrap:wrap;">
                  ${['info', 'success', 'warning', 'error']
                    .map(
                      (tp) =>
                        `<button type="button" class="wb-mini-action" data-active="${state.m3ToastType === tp}" data-action="m3-toast-type" data-toast-type="${tp}">${tp.toUpperCase()}</button>`
                    )
                    .join('')}
                </div>
                <div class="agy-toast wb-m3lab-toast-item" data-testid="toast-notification" data-type="${state.m3ToastType}">
                  <div>
                    <div style="font-weight:600;color:var(--foreground);">${escapeHtml(activeToast.title)}</div>
                    <div style="font-size:11.5px;color:var(--muted-foreground);margin-top:2px;">${escapeHtml(activeToast.detail)}</div>
                  </div>
                  <kbd>Esc</kbd>
                </div>
              </div>
            </section>

            <!-- Surface 4: Prose reading details + Artifact card + recessed terminal -->
            <section class="wb-m3lab-panel">
              <div class="wb-m3lab-panel-head">
                <span class="wb-m3lab-panel-title">4. Prose Table/Quote/Alerts · Artifact · Terminal Well</span>
                <span class="wb-m3lab-panel-tag">.agy-md-table / .markdown-alert / bottom-terminal-panel</span>
              </div>
              <div data-testid="agent-response" style="display:flex;flex-direction:column;gap:10px;">
                <table class="agy-md-table" style="width:100%;border-collapse:collapse;font-size:12px;">
                  <thead>
                    <tr><th style="text-align:left;padding:6px 10px;">Optical Channel</th><th style="text-align:left;padding:6px 10px;">Idle State</th><th style="text-align:right;padding:6px 10px;">Status</th></tr>
                  </thead>
                  <tbody>
                    <tr><td style="padding:6px 10px;">Channel 1 · Static Bundle</td><td style="padding:6px 10px;">0fps Idle</td><td style="text-align:right;padding:6px 10px;font-variant-numeric:tabular-nums;">662 KiB</td></tr>
                    <tr><td style="padding:6px 10px;">Channel 2 · Omni Workbench</td><td style="padding:6px 10px;">Zero-Flash Prepaint</td><td style="text-align:right;padding:6px 10px;">Tonal Sync</td></tr>
                  </tbody>
                </table>

                <blockquote style="margin:0;padding:7px 12px;font-size:12px;">
                  Outer shells follow the active corner preset while high-frequency inner controls adopt M3 pills, preserving the borderless Orchestrator crystal bar 100%.
                </blockquote>

                <div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;font-size:11.5px;">
                  <div class="markdown-alert markdown-alert-tip" style="padding:7px 10px;"><strong>TIP</strong> · Dark mode relies on 5-step tonal layering instead of noisy inner borders</div>
                  <div class="markdown-alert markdown-alert-important" style="padding:7px 10px;"><strong>IMPORTANT</strong> · Right-click for donuts, Alt+click for hot coffee</div>
                </div>

                <div data-testid="artifact-card" style="overflow:hidden;">
                  <div data-testid="artifact-header" style="padding:7px 11px;display:flex;align-items:center;justify-content:space-between;font-size:12px;font-weight:600;">
                    <span>ARCH-001-GRILL-DECISIONS.md</span>
                    <span style="font-size:10.5px;opacity:.72;">Artifact · Locked</span>
                  </div>
                  <div style="padding:8px 11px;font-size:11.5px;color:var(--muted-foreground);">All 3 batches of isolated worktree decisions and verification baselines archived.</div>
                </div>

                <div data-testid="bottom-terminal-panel" style="border-radius:var(--ag-cs-r-md);overflow:hidden;">
                  <div class="wb-m3lab-term-body">
                    <div>$ npm test  <span style="color:var(--success);"># 0 failures · Tonal-0 Console Well</span></div>
                    <div style="opacity:.72;">› style.css non-ASCII check: 0 bad chars (packCssJsExpr OK)</div>
                  </div>
                </div>
              </div>
            </section>
          </div>
        </div>
      </div>`;
  }

  function getFilteredSessions() {
    const q = (state.sidebarSearchQuery || '').trim().toLowerCase();
    if (!q) return SESSIONS;
    return SESSIONS.filter(
      (s) =>
        s.title.toLowerCase().includes(q) ||
        s.group.toLowerCase().includes(q) ||
        s.scene.toLowerCase().includes(q)
    );
  }

  function buildSidebarSearchTailHtml() {
    return `<button type="button" class="ag-v2-search-clear" data-action="clear-sidebar-search" aria-label="Close search" title="Clear filter">${renderAnimIcon('x-close', { size: 12 })}</button>`;
  }

  function buildRunningSpinnerHtml() {
    return `<span class="ag-v2-row-spinner-wrap" aria-hidden="true"><span data-testid="status-loading-spinner"><span data-agent-state-dot="true"></span><span data-agent-state-dot="true"></span><span data-agent-state-dot="true"></span><span data-agent-state-dot="true"></span></span></span>`;
  }

  function buildSidebarSessionsHtml() {
    const activeSid = getActiveSessionId();
    const q = (state.sidebarSearchQuery || '').trim();
    const filtered = getFilteredSessions();

    if (q && filtered.length === 0) {
      return `
        <div class="ag-v2-sidebar-empty" data-testid="sidebar-search-empty">
          <span>No conversations matching "${escapeHtml(q)}"</span>
          <button type="button" class="ag-v2-sidebar-empty-reset" data-action="clear-sidebar-search">Clear Filter</button>
        </div>`;
    }

    const groups = ['Pinned', 'Today', 'Past 7 Days'];
    return groups
      .map((grp) => {
        const groupItems = filtered.filter((s) => s.group === grp);
        if (!groupItems.length) return '';
        const isGroupCollapsed = q ? false : Boolean(state.sidebarCollapsedGroups[grp]);
        const rows = groupItems
          .map((s) => {
            const isActive = s.id === activeSid;
            const isRunning = Boolean(s.running || (isActive && state.streamPhase === 'streaming'));
            return `
              <button type="button" data-testid="conversation-row-sidebar" data-action="pick-session" data-scene="${s.scene}" data-session-id="${s.id}" data-active="${isActive}" data-running="${isRunning}">
                ${isActive ? '<span class="ag-v2-glide-bg" data-sidebar-row-glide="true" aria-hidden="true"></span>' : ''}
                <span class="ag-v2-row-title">${escapeHtml(s.title)}</span>
                ${isRunning ? buildRunningSpinnerHtml() : ''}
                <span class="ag-v2-row-more" data-action="session-more" title="More conversation actions" role="presentation">${renderAnimIcon('more-horizontal', { size: 14 })}</span>
              </button>`;
          })
          .join('');

        return `
          <div class="ag-v2-sidebar-group" data-sidebar-group="${escapeHtml(grp)}" data-group-collapsed="${isGroupCollapsed}">
            <button type="button" class="ag-v2-sidebar-group-head" data-action="toggle-sidebar-group" data-group="${escapeHtml(grp)}" aria-expanded="${!isGroupCollapsed}">
              <span>${escapeHtml(grp)}</span>
            </button>
            <div class="ag-v2-sidebar-group-collapse">
              <div class="ag-v2-sidebar-group-rows">${rows}</div>
            </div>
          </div>`;
      })
      .join('');
  }

  function buildSidebarRailHtml() {
    const railItems = [
      { scene: 'studio', icon: 'layers-stack', tip: 'Studio Home' },
      { scene: 'chat', icon: 'zap-bolt', tip: 'Deep Chat' },
      { scene: 'effort', icon: 'sliders-tune', tip: 'Effort Slider' },
      { scene: 'dashboard', icon: 'radar-pulse', tip: 'Optical Vial' },
    ];
    const navBtns = railItems
      .map((it) => {
        const isAct = state.scene === it.scene;
        return `
          <button type="button" class="ag-v2-rail-btn" data-action="pick-session" data-scene="${it.scene}" data-active="${isAct}" data-tip="${it.tip}" aria-label="${it.tip}">
            ${isAct ? '<span class="ag-v2-glide-bg" data-rail-glide="true" aria-hidden="true"></span>' : ''}
            ${renderAnimIcon(it.icon, { size: 15, active: isAct })}
          </button>`;
      })
      .join('');

    const setAct = state.scene === 'settings';
    return `
      <div class="ag-v2-sidebar-rail-body" aria-label="Compact rail navigation">
        <button type="button" class="ag-v2-rail-btn is-primary-action" data-action="pick-session" data-scene="studio" data-tip="New Conversation|Cmd+N" aria-label="New Conversation">
          ${renderAnimIcon('sparkles-pen', { size: 15 })}
        </button>
        <div class="ag-v2-rail-nav">${navBtns}</div>
        <button type="button" class="ag-v2-rail-btn is-footer-rail" data-action="pick-session" data-scene="settings" data-active="${setAct}" data-tip="Appearance & Preferences" aria-label="Appearance & Preferences">
          ${setAct ? '<span class="ag-v2-glide-bg" data-rail-glide="true" aria-hidden="true"></span>' : ''}
          ${renderAnimIcon('settings-gear', { size: 15, active: setAct })}
        </button>
      </div>`;
  }

  function buildSidebarHtml(collapsedOverride) {
    const collapsed = typeof collapsedOverride === 'boolean' ? collapsedOverride : Boolean(state.sidebarCollapsed);
    const searchOpen = Boolean(state.sidebarSearchOpen || state.sidebarSearchQuery);
    return `
      <aside data-testid="sidebar-split" data-collapsed="${collapsed}" data-search-open="${searchOpen}">
        <div class="ag-v2-sidebar-top">
          <button type="button" class="ag-v2-workspace-label" data-testid="workspace-switcher" data-action="cycle-workspace" title="Switch workspace">
            <span class="ag-v2-workspace-name" data-workspace-name="true">${escapeHtml(state.workspaceName)}</span>
            <span class="ag-v2-workspace-caret">${renderAnimIcon('chevron-down', { size: 11 })}</span>
          </button>
          <div class="ag-v2-sidebar-top-tools">
            <button type="button" class="ag-v2-top-icon-btn" data-testid="sidebar-search-toggle" data-action="toggle-sidebar-search" data-active="${searchOpen}" data-tip="Search Conversations|Cmd+K" aria-label="Search Conversations">
              ${renderAnimIcon('search', { size: 14, active: searchOpen })}
            </button>
            <button type="button" class="ag-v2-collapse-btn" data-testid="sidebar-collapse-btn" data-action="toggle-sidebar" data-tip="${collapsed ? 'Expand Sidebar|[' : 'Collapse Sidebar|['}" aria-expanded="${!collapsed}" aria-label="${collapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}">
              ${renderAnimIcon('panel-left', { size: 14.5, active: !collapsed })}
            </button>
          </div>
        </div>

        <div class="ag-v2-sidebar-expanded-body">
          <div class="ag-v2-sidebar-actions">
            <button type="button" class="ag-v2-new-chat-btn" data-testid="new-conversation-button" data-action="pick-session" data-scene="studio">
              <span class="ag-v2-new-chat-lead">
                ${renderAnimIcon('sparkles-pen', { size: 14 })}
                <span>New Conversation</span>
              </span>
              <span class="ag-v2-kbd-hint">⌘N</span>
            </button>

            <div class="ag-v2-sidebar-search-collapse" data-sidebar-search-wrap="true" data-open="${searchOpen}">
              <div class="ag-v2-sidebar-search-inner">
                <div class="ag-v2-sidebar-search">
                  <span class="ag-v2-search-ico" aria-hidden="true">${renderAnimIcon('search', { size: 13 })}</span>
                  <input type="text" class="ag-v2-search-input" data-testid="sidebar-search-input" placeholder="Search conversations…" value="${escapeHtml(state.sidebarSearchQuery)}" autocomplete="off" spellcheck="false" aria-label="Filter conversation list" />
                  <span data-sidebar-search-tail="true">${buildSidebarSearchTailHtml()}</span>
                </div>
              </div>
            </div>
          </div>

          <div class="ag-v2-scroll ag-v2-sidebar-sessions" data-sidebar-sessions="true">
            ${buildSidebarSessionsHtml()}
          </div>

          <div class="ag-v2-sidebar-footer-wrap">
            <button type="button" class="ag-v2-sidebar-footer" data-action="pick-session" data-scene="settings" data-active="${state.scene === 'settings'}">
              ${renderAnimIcon('settings-gear', { size: 14 })}
              <span class="ag-v2-footer-label">Appearance &amp; Preferences</span>
            </button>
          </div>
        </div>

        ${buildSidebarRailHtml()}
      </aside>`;
  }

  function buildSingleStageHtml(themeOverride, stageOpts = null) {
    const theme = (stageOpts && stageOpts.theme) || themeOverride || state.tokens.theme;
    const palette = (stageOpts && stageOpts.palette) || state.tokens.palette;
    const lightPreset = (stageOpts && stageOpts.lightPreset) || state.tokens.lightPreset || 'crystal';
    const isLockedStage = Boolean(stageOpts && stageOpts.lockedPreset);
    const isHome = state.scene === 'studio';
    const isM3Lab = state.scene === 'm3lab';
    const bodyHtml =
      state.scene === 'studio'
        ? buildStudioHomeHtml()
        : state.scene === 'settings'
          ? buildSettingsSceneHtml()
          : isM3Lab
            ? buildM3LabSceneHtml()
            : buildChatStreamHtml();

    const titleText =
      state.scene === 'studio'
        ? 'Studio Overview · 0fps Idle Sleep & 4-Color Prism Ripple'
        : isM3Lab
          ? 'Google M3 Expressive · 1:1 Live style.css Surface Lab'
          : state.scene === 'effort'
            ? '1:1 Native Codex / Claude Effort Slider'
            : state.scene === 'dashboard'
              ? '512K Optical Vial & Live Model Verification'
              : state.scene === 'settings'
                ? 'Obsidian Prism · Collapsible Appearance & Coexistence Settings'
                : 'Deep Conversation Stream · Obsidian Prism';

    const customTag = stageOpts && stageOpts.crumbTag;
    const paletteTag =
      customTag ||
      (theme === 'light'
        ? lightPreset === 'alabaster' || palette === 'warm'
          ? 'WARM ALABASTER · LIGHT'
          : 'DAYLIGHT CRYSTAL · LIGHT'
        : `${palette.toUpperCase()} · DARK`);

    return `
      <div class="ag-v2-stage" data-palette="${palette}" data-theme="${theme}" data-light-preset="${lightPreset}" ${isLockedStage ? 'data-stage-locked="1"' : ''} data-serif="${state.tokens.editorialSerif ? 'on' : 'off'}">
        ${buildSidebarHtml(stageOpts && typeof stageOpts.sidebarCollapsed === 'boolean' ? stageOpts.sidebarCollapsed : undefined)}
        <div class="ag-v2-main">
          <div class="ag-v2-ripple-backdrop" data-dormant="${!isHome}">
            <canvas class="ag-cs-brand-glow ag-v2-brand-glow" data-testid="onboarding-brand-glow" aria-hidden="true"></canvas>
            <canvas class="ag-cs-ripple-canvas" aria-hidden="true"></canvas>
          </div>
          <div class="ag-v2-conv-aura" data-testid="conv-aura-host" data-dormant="${isHome || state.scene === 'settings' || isM3Lab}" data-aura-phase="${state.convAuraPhase}" aria-hidden="true">
            <canvas class="ag-v2-conv-glow"></canvas>
          </div>

          <div class="ag-v2-titlebar">
            <div class="ag-v2-titlebar-left">
              <span class="ag-v2-crumb-tag">${escapeHtml(paletteTag)}</span>
              <span class="ag-v2-session-title">${escapeHtml(titleText)}</span>
            </div>
            <div class="ag-v2-titlebar-actions">
              <button type="button" class="ag-v2-icon-btn" data-action="toggle-dash-pop">${renderAnimIcon('radar-pulse', { size: 12.5 })}<span>5h: ${state.vialCritical ? '12%' : '82%'}</span></button>
            </div>
          </div>

          ${bodyHtml}
          ${isM3Lab ? '' : buildComposerHtml(stageOpts && typeof stageOpts.allowFloat === 'boolean' ? stageOpts.allowFloat : true)}
        </div>
        <div class="ag-v2-floating-tip" data-stage-floating-tip="true" aria-hidden="true"><span></span><kbd></kbd></div>
      </div>`;
  }

  function buildMatrixHtml() {
    const theme = state.tokens.theme;
    const lightPreset = state.tokens.lightPreset || 'crystal';
    const paletteTag =
      theme === 'light'
        ? lightPreset === 'alabaster' || state.tokens.palette === 'warm'
          ? 'Warm Alabaster · Light'
          : 'Daylight Crystal · Light'
        : state.tokens.palette === 'obsidian'
          ? 'Obsidian Neutral · Dark'
          : state.tokens.palette === 'titanium'
            ? 'Titanium Prism · Dark'
            : 'Warm Editorial · Dark';

    return `
      <div class="ag-v2-stage wb-matrix-scroll" data-palette="${state.tokens.palette}" data-theme="${theme}" data-light-preset="${lightPreset}" data-serif="${state.tokens.editorialSerif ? 'on' : 'off'}" style="display:block;">
        <div class="wb-matrix-canvas">
          <div class="wb-matrix-header">
            <div>
              <h1 class="wb-matrix-title">Obsidian Prism v1.0 · Full Component Optical &amp; Performance Matrix</h1>
              <p class="wb-matrix-sub">Obsidian Prism · Daylight Crystal &amp; Warm Alabaster · 512K Borosilicate Optical Vial · Breathing Conversation Aura &amp; 0fps Home Idle Sleep.</p>
            </div>
            <span class="ag-v2-crumb-tag">${escapeHtml(paletteTag)}</span>
          </div>

          <div class="wb-matrix-grid">
            <section class="wb-matrix-cell wb-span-7" style="position:relative; overflow:hidden; min-height:380px;">
              <div class="wb-cell-head" style="position:relative; z-index:2;">
                <span class="wb-cell-title">1. Studio Home · Fluid Wake &amp; 4-Color Prism Ripple</span>
                <span class="wb-cell-tag">[data-testid="studio-bento-chassis"]</span>
              </div>
              <div class="ag-v2-ripple-backdrop" style="inset:40px 0 0 0;" data-dormant="false">
                <canvas class="ag-cs-brand-glow ag-v2-brand-glow" data-testid="onboarding-brand-glow" aria-hidden="true"></canvas>
                <canvas class="ag-cs-ripple-canvas" aria-hidden="true"></canvas>
              </div>
              <div style="position:relative; z-index:2; padding:6px 0;">
                ${buildStudioHomeHtml()}
              </div>
            </section>

            <section class="wb-matrix-cell wb-span-5">
              <div class="wb-cell-head">
                <span class="wb-cell-title">2. Native Codex/Claude Slider &amp; Borosilicate Optical Vial</span>
                <span class="wb-cell-tag">Z4 Instrument Popovers</span>
              </div>
              <div style="display:flex; flex-direction:column; gap:14px; align-items:center;">
                ${buildModelPanelHtml(false)}
                ${buildDashboardPanelHtml(false)}
              </div>
            </section>

            <section class="wb-matrix-cell wb-span-7" style="position:relative; overflow:hidden;">
              <div class="wb-cell-head" style="position:relative; z-index:2;">
                <span class="wb-cell-title">3. Conversation Stream · 32% Bottom Aura (0fps Sleep) / Borderless Thinking</span>
                <span class="wb-cell-tag">[data-testid="conversation-view"]</span>
              </div>
              <div class="ag-v2-conv-aura" data-testid="conv-aura-host" data-dormant="false" data-aura-phase="${state.convAuraPhase}" style="inset:auto 0 0 0; height:32%;" aria-hidden="true">
                <canvas class="ag-v2-conv-glow"></canvas>
              </div>
              <div style="position:relative; z-index:2;">
                ${buildChatStreamHtml()}
              </div>
            </section>

            <section class="wb-matrix-cell wb-span-5">
              <div class="wb-cell-head">
                <span class="wb-cell-title">4. Input-Only Prism Rim · Dual Mascot Stage · Appearance Toggles</span>
                <span class="wb-cell-tag">Input-Only Prism &amp; Mascots</span>
              </div>
              <div style="padding-top:68px;">
                ${buildComposerHtml(false)}
              </div>
              <div style="display:flex; gap:10px; align-items:stretch; flex-wrap:wrap;">
                <div style="flex:1 1 200px; border:1px solid var(--border-etched); border-radius:var(--ag-v2-r-sm); overflow:hidden;">
                  ${buildSidebarHtml()}
                </div>
                <div style="flex:1.2 1 240px;">
                  ${buildSettingsSceneHtml()}
                </div>
              </div>
            </section>
          </div>
        </div>
        <div class="ag-v2-floating-tip" data-stage-floating-tip="true" aria-hidden="true"><span></span><kbd></kbd></div>
      </div>`;
  }

  function syncLiveStyleCss() {
    const t = state.tokens;
    const html = document.documentElement;
    const link = document.getElementById('wb-live-style-css');
    const active = state.scene === 'm3lab';
    if (link) link.disabled = !active;
    if (active) {
      const lp = t.lightPreset || 'crystal';
      const corners = t.radiusBase >= 10 ? 'soft' : t.radiusBase <= 3 ? 'crisp' : 'balanced';
      html.setAttribute('data-ag-cs-style', '1');
      html.setAttribute('data-ag-cs-theme', t.theme === 'light' ? 'light' : 'dark');
      html.setAttribute('data-ag-cs-palette', t.palette === 'warm' ? 'warm' : 'obsidian');
      html.setAttribute('data-ag-cs-light-preset', lp);
      html.setAttribute('data-ag-cs-corners', corners);
    } else {
      html.removeAttribute('data-ag-cs-style');
      html.removeAttribute('data-ag-cs-theme');
      html.removeAttribute('data-ag-cs-palette');
      html.removeAttribute('data-ag-cs-corners');
    }
  }

  function applyTokenStylesToStages() {
    const t = state.tokens;
    const lp = t.lightPreset || 'crystal';
    document.documentElement.setAttribute('data-ag-cs-motion', state.motionLevel);
    document.documentElement.setAttribute('data-ag-cs-light-preset', lp);
    syncLiveStyleCss();
    const stages = document.querySelectorAll('.ag-v2-stage');
    stages.forEach((stage) => {
      if (stage.getAttribute('data-stage-locked') !== '1') {
        stage.setAttribute('data-palette', t.palette);
        stage.setAttribute('data-light-preset', lp);
      }
      stage.setAttribute('data-motion', state.motionLevel);
      stage.setAttribute('data-serif', t.editorialSerif ? 'on' : 'off');
      stage.style.setProperty('--ag-v2-radius', `${t.radiusBase}px`);
      stage.style.setProperty('--ag-v2-specular', String(t.specularAlpha));
      stage.style.setProperty('--ag-v2-border-alpha', String(t.borderAlpha));
      stage.style.setProperty('--ag-v2-glass-blur', `${t.glassBlur}px`);
      stage.style.setProperty('--ag-v2-prose-lh', String(t.proseLineHeight));
      stage.style.setProperty('--ag-v2-grain-alpha', String(t.grainAlpha));
      stage.style.setProperty('--ag-prism-strength', String(t.prismStrength ?? 1));
    });
  }

  function getActiveQuickPresetId() {
    const { palette, theme, lightPreset = 'crystal' } = state.tokens;
    if (theme === 'light') {
      return lightPreset === 'alabaster' || palette === 'warm' ? 'warm-alabaster' : 'daylight-crystal';
    }
    if (palette === 'warm') return 'warm-dark';
    if (palette === 'obsidian') return 'obsidian-dark';
    return '';
  }

  function syncTopbarControls() {
    const wbRoot = document.getElementById('wb-root');
    if (wbRoot) {
      wbRoot.setAttribute('data-view', state.viewMode);
      wbRoot.setAttribute('data-inspector', state.inspectorOpen ? 'open' : 'closed');
      wbRoot.setAttribute('data-motion', state.motionLevel);
      wbRoot.setAttribute('data-shell-theme', state.tokens.theme === 'light' && state.viewMode !== 'quad' ? 'light' : 'dark');
    }
    document.documentElement.setAttribute('data-ag-cs-motion', state.motionLevel);
    document.documentElement.setAttribute('data-ag-cs-light-preset', state.tokens.lightPreset || 'crystal');

    document.querySelectorAll('[data-wb-view]').forEach((btn) => {
      btn.setAttribute('data-active', String(btn.getAttribute('data-wb-view') === state.viewMode));
    });
    document.querySelectorAll('[data-wb-scene]').forEach((btn) => {
      btn.setAttribute('data-active', String(btn.getAttribute('data-wb-scene') === state.scene));
    });
    const activePreset = getActiveQuickPresetId();
    document.querySelectorAll('[data-wb-preset]').forEach((btn) => {
      btn.setAttribute('data-active', String(btn.getAttribute('data-wb-preset') === activePreset));
    });
    document.querySelectorAll('[data-wb-palette]:not([data-wb-preset])').forEach((btn) => {
      btn.setAttribute('data-active', String(btn.getAttribute('data-wb-palette') === state.tokens.palette));
    });
    document.querySelectorAll('[data-wb-light-preset]').forEach((btn) => {
      btn.setAttribute('data-active', String(btn.getAttribute('data-wb-light-preset') === (state.tokens.lightPreset || 'crystal')));
    });
    document.querySelectorAll('[data-wb-motion]').forEach((btn) => {
      btn.setAttribute('data-active', String(btn.getAttribute('data-wb-motion') === state.motionLevel));
    });
    document.querySelectorAll('[data-wb-theme]').forEach((btn) => {
      btn.disabled = state.viewMode === 'split' || state.viewMode === 'quad';
      btn.setAttribute('data-active', String(btn.getAttribute('data-wb-theme') === state.tokens.theme));
    });
    const inspBtn = document.getElementById('wb-toggle-inspector');
    if (inspBtn) inspBtn.setAttribute('data-active', String(state.inspectorOpen));
  }

  function syncInspectorControls() {
    const t = state.tokens;
    const motionLabelMap = { off: 'Off', subtle: 'Subtle', standard: 'Standard', ultra: 'Ultra' };
    const mtVal = document.getElementById('val-motion-tier');
    if (mtVal) mtVal.textContent = motionLabelMap[state.motionLevel] || 'Ultra';
    const lpVal = document.getElementById('val-light-preset');
    if (lpVal) lpVal.textContent = (t.lightPreset || 'crystal') === 'alabaster' ? 'Warm Alabaster' : 'Daylight Crystal';
    const setPair = (id, valId, value, text) => {
      const el = document.getElementById(id);
      const valEl = document.getElementById(valId);
      if (el) el.value = String(value);
      if (valEl) valEl.textContent = text;
    };
    setPair('ctrl-radius', 'val-radius', t.radiusBase, `${t.radiusBase}px`);
    setPair('ctrl-prism', 'val-prism', t.prismStrength ?? 1, Number(t.prismStrength ?? 1).toFixed(2));
    setPair('ctrl-specular', 'val-specular', t.specularAlpha, Number(t.specularAlpha).toFixed(3));
    setPair('ctrl-border', 'val-border', t.borderAlpha, Number(t.borderAlpha).toFixed(3));
    setPair('ctrl-blur', 'val-blur', t.glassBlur, `${t.glassBlur}px`);
    setPair('ctrl-lh', 'val-lh', t.proseLineHeight, Number(t.proseLineHeight).toFixed(2));
    setPair('ctrl-grain', 'val-grain', t.grainAlpha, Number(t.grainAlpha).toFixed(3));

    const serifBtn = document.getElementById('ctrl-serif');
    if (serifBtn) serifBtn.setAttribute('data-on', String(t.editorialSerif));

    const streamBtn = document.getElementById('btn-vial-stream');
    if (streamBtn) {
      streamBtn.textContent = `Stream Drip: ${state.vialStreaming ? 'On' : 'Off'}`;
      streamBtn.setAttribute('data-active', String(state.vialStreaming));
    }
    const vialModeBtn = document.getElementById('btn-vial-mode');
    if (vialModeBtn) {
      vialModeBtn.textContent = `Context: ${state.contextVialEnabled ? 'Optical Vial' : 'Minimal Bar'}`;
      vialModeBtn.setAttribute('data-active', String(!state.contextVialEnabled));
    }
    const critBtn = document.getElementById('btn-vial-crit');
    if (critBtn) critBtn.setAttribute('data-active', String(state.vialCritical));

    const campBtn = document.getElementById('btn-vial-camp');
    if (campBtn) {
      const m = getActiveModel();
      campBtn.textContent = `Tint: ${m.camp === 'claude' ? 'Stardust Iris' : 'Deep-Sea Cyan'}`;
    }

    const fbBtn = document.getElementById('btn-vial-fallback');
    if (fbBtn) {
      fbBtn.textContent = state.sampleSimMode === 'ok' ? 'Sim Fallback' : state.sampleSimMode === 'fallback' ? 'Sim Bad Timing' : 'Restore Sample OK';
      fbBtn.setAttribute('data-active', String(state.sampleSimMode !== 'ok'));
    }

    const pileBtn = document.getElementById('btn-mascot-pile');
    if (pileBtn) {
      pileBtn.textContent = `Mini Crab Pile: ${state.mascotMiniPile ? 'On' : 'Off'}`;
      pileBtn.setAttribute('data-active', String(state.mascotMiniPile));
    }

    const takeoverBtn = document.getElementById('btn-demo-takeover');
    if (takeoverBtn) takeoverBtn.setAttribute('data-active', String(state.overlayDemo === 'takeover'));
    const slashBtn = document.getElementById('btn-demo-slash');
    if (slashBtn) slashBtn.setAttribute('data-active', String(state.overlayDemo === 'slash'));
    const orchBtn = document.getElementById('btn-orch-demo');
    if (orchBtn) orchBtn.setAttribute('data-active', String(state.activeModelId === 'orchestrator'));
  }

  function updatePrismCoordinates() {
    prismRafId = 0;
    prismDirty = false;
    const reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const { x, y } = lastPointerPos;

    if (!reduceMotion) {
      const rims = document.querySelectorAll('.ag-prism-rim');
      rims.forEach((el) => {
        if (x < -1000) {
          el.style.setProperty('--px', '-9999px');
          el.style.setProperty('--py', '-9999px');
          return;
        }
        const rect = el.getBoundingClientRect();
        const maxRange = 280;
        if (
          x < rect.left - maxRange ||
          x > rect.right + maxRange ||
          y < rect.top - maxRange ||
          y > rect.bottom + maxRange
        ) {
          el.style.setProperty('--px', '-9999px');
          el.style.setProperty('--py', '-9999px');
          return;
        }
        el.style.setProperty('--px', `${Math.round(x - rect.left)}px`);
        el.style.setProperty('--py', `${Math.round(y - rect.top)}px`);
      });
    }

    // Sync local pointer proximity to Orchestrator crystal prism edge and WebGL2 shader
    document.querySelectorAll('.ag-v2-orch-track').forEach((trackEl) => {
      if (reduceMotion || x < -1000) {
        trackEl.style.setProperty('--orch-px', '-9999px');
        trackEl.style.setProperty('--orch-py', '-9999px');
        return;
      }
      const rect = trackEl.getBoundingClientRect();
      const maxRange = 120;
      if (
        rect.width < 10 ||
        x < rect.left - maxRange ||
        x > rect.right + maxRange ||
        y < rect.top - maxRange ||
        y > rect.bottom + maxRange
      ) {
        trackEl.style.setProperty('--orch-px', '-9999px');
        trackEl.style.setProperty('--orch-py', '-9999px');
        return;
      }
      trackEl.style.setProperty('--orch-px', `${Math.round(x - rect.left)}px`);
      trackEl.style.setProperty('--orch-py', `${Math.round(y - rect.top)}px`);
    });

    for (const c of crystalControllers) {
      c.setPointerClient(x, y);
    }
  }

  function schedulePrismUpdate(clientX, clientY) {
    lastPointerPos.x = clientX;
    lastPointerPos.y = clientY;
    if (!prismDirty) {
      prismDirty = true;
      prismRafId = requestAnimationFrame(updatePrismCoordinates);
    }
  }

  function syncComposerTriggerDom() {
    const model = getActiveModel();
    const effort = getActiveEffortMeta();
    const isOrch = Boolean(model.isOrchestrator);
    const locked = !isOrch && model.efforts.length <= 1;
    const isSpectrum = !isOrch && !locked && effort.id === 'xhigh';
    const brand = getModelBrand(model);
    const tier = getModelEffortTier(model, effort);

    document.querySelectorAll('[data-testid="model-selector-trigger"]').forEach((btn) => {
      btn.setAttribute('data-brand', brand);
      btn.setAttribute('data-tier', tier);
    });
    document.querySelectorAll('[data-composer-model-name="true"]').forEach((el) => {
      el.textContent = model.name;
    });
    document.querySelectorAll('[data-composer-model-glyph="true"]').forEach((glyphEl) => {
      const prevBrand = glyphEl.getAttribute('data-brand');
      const prevTier = glyphEl.getAttribute('data-tier');
      glyphEl.setAttribute('data-brand', brand);
      glyphEl.setAttribute('data-tier', tier);
      if (prevBrand !== brand || prevTier !== tier) {
        glyphEl.innerHTML = buildTriggerGlyphInnerSvg(brand, tier);
        if (!prefersReducedMotion()) {
          glyphEl.classList.remove('is-pulsing');
          void glyphEl.offsetWidth;
          glyphEl.classList.add('is-pulsing');
        }
      }
    });
    document.querySelectorAll('[data-composer-effort-tag="true"]').forEach((el) => {
      el.textContent = isOrch ? 'AUTO' : locked ? 'FIXED' : effort.short;
      el.setAttribute('data-tier', tier);
      el.setAttribute('data-high', String(isSpectrum));
      el.setAttribute('data-orch', String(isOrch));
    });
    document.querySelectorAll('[data-thinking-spark="true"]').forEach((sp) => {
      if (sp.getAttribute('data-brand') !== brand) {
        sp.setAttribute('data-brand', brand);
        const st = getThinkingStatus();
        sp.innerHTML = buildBrandMarkSvg(brand, 13, '', { tier: st === 'error' ? 'low' : 'auto', monochrome: st === 'error' });
      }
    });
    // Crossfade inside the same 64px grid cell so both rows overlap with zero height shift
    let switchedToOrch = false;
    document.querySelectorAll('[data-ces-effort-row="true"]').forEach((el) => {
      el.setAttribute('data-row-hidden', String(isOrch));
      el.setAttribute('aria-hidden', String(isOrch));
    });
    document.querySelectorAll('[data-testid="orchestrator-effort-bar"]').forEach((el) => {
      if (isOrch && el.getAttribute('data-row-hidden') === 'true') switchedToOrch = true;
      el.setAttribute('data-row-hidden', String(!isOrch));
      el.setAttribute('aria-hidden', String(!isOrch));
    });
    if (isOrch) {
      for (const c of crystalControllers) {
        c.setPointerClient(lastPointerPos.x, lastPointerPos.y);
        c.step(0.016);
        // Optical wake: trigger a single cool-white sweep when switching to Orchestrator
        if (switchedToOrch && typeof c.wake === 'function') c.wake();
      }
    }

    document.querySelectorAll('.ag-v2-model-option').forEach((opt) => {
      const sel = opt.getAttribute('data-model-id') === model.id;
      const wasSel = opt.getAttribute('data-selected') === 'true';
      opt.setAttribute('data-selected', String(sel));
      if (sel !== wasSel && opt.getAttribute('data-brand') === 'antigravity') {
        const logoSlot = opt.querySelector('.ag-v2-option-logo');
        if (logoSlot) {
          logoSlot.innerHTML = buildBrandMarkSvg('antigravity', 15, '', { tier: sel ? 'auto' : 'low', monochrome: !sel });
        }
      }
    });
    document.querySelectorAll(`[data-model-effort-tag="${model.id}"]`).forEach((mEffortTag) => {
      mEffortTag.textContent = isOrch ? 'Auto' : locked ? 'Fixed' : effort.label;
      mEffortTag.setAttribute('data-orch', String(isOrch));
    });
    syncMascotsState();
    syncInspectorControls();
  }

  // Broadcast UI events to all mounted dual-mascot rigs (silently skip if notify unavailable)
  function notifyMascots(event, payload) {
    mascotControllers.forEach((mc) => {
      if (mc.rig && typeof mc.rig.notify === 'function') {
        try { mc.rig.notify(event, payload || {}); } catch {}
      }
    });
  }

  let lastOrchState = null;
  let lastActivityAt = 0;

  // Throttle user activity (<= once per 2s) to wake dozing mascots
  function markUserActivity() {
    const now = performance.now();
    if (now - lastActivityAt < 2000) return;
    lastActivityAt = now;
    notifyMascots('activity');
  }

  function syncMascotsState() {
    const model = getActiveModel();
    const isOrchNow = Boolean(model.isOrchestrator);
    mascotControllers.forEach((ctrl) => {
      const wrap = ctrl.host.closest('.ag-v2-composer-wrap');
      const card = wrap ? wrap.querySelector('.ag-v2-overlay-card:not(.is-closing)') : null;
      const rightPop = wrap ? wrap.querySelector('.ag-v2-popover-docked.is-right:not(.is-closing)') : null;
      const leapY = card && state.mascotYieldMode === 'leap' ? (card.offsetHeight || 76) + 16 : 0;
      const popW = rightPop ? rightPop.offsetWidth || (state.contextVialEnabled ? 408 : 316) : 0;
      ctrl.rig.setState({
        camp: model.camp,
        streaming: state.streamPhase === 'streaming',
        streamTier: state.effortByModel[model.id] === 'xhigh' || model.isOrchestrator ? 3 : 2,
        hasError: state.hasToolError,
        yieldMode: state.overlayDemo ? state.mascotYieldMode : 'none',
        leapOffsetY: leapY,
        popoverRightWidth: ctrl.floating ? popW : 0,
        miniPileEnabled: state.mascotMiniPile,
        orchestrator: isOrchNow,
      });
    });
    // Orchestrator toggle: mascots glance up at model trigger while Clawd summons/stows crystal prop
    if (lastOrchState !== null && lastOrchState !== isOrchNow) notifyMascots('orchestrator', { on: isOrchNow });
    lastOrchState = isOrchNow;
  }

  function getRipplePalette(stageEl, auraState) {
    const rippleCore = globalThis.__agCsRippleCore;
    const cs = getComputedStyle(stageEl);
    const isDark = stageEl.getAttribute('data-theme') !== 'light';
    const ink =
      (rippleCore && rippleCore.parseCssColorToRgb(cs.getPropertyValue('--ag-v2-ripple-ink'))) ||
      (isDark ? [146, 148, 156] : [120, 122, 132]);
    const wave =
      (rippleCore && rippleCore.parseCssColorToRgb(cs.getPropertyValue('--ag-v2-ripple-wave'))) ||
      (isDark ? [214, 218, 228] : [74, 80, 96]);
    const fontFamily = cs.getPropertyValue('--ag-v2-font-mono').trim() || 'monospace';
    const strength = state.tokens.prismStrength ?? 1;
    const aura =
      auraState && auraState.active && strength > 0
        ? { x: auraState.x, y: auraState.y, radius: 230, strength, active: true }
        : { x: 0, y: 0, radius: 230, strength: 0, active: false };
    return { dark: isDark, ink, wave, fontFamily, aura };
  }

  function mountRipples() {
    const rippleCore = globalThis.__agCsRippleCore;
    if (!rippleCore || !state.rippleEnabled) return;
    const { RIPPLE, createWaveField, createGlyphField } = rippleCore;

    document.querySelectorAll('.ag-cs-ripple-canvas').forEach((canvas) => {
      const stageEl = canvas.closest('.ag-v2-stage');
      const backdropEl = canvas.closest('.ag-v2-ripple-backdrop');
      const glowCanvas = backdropEl ? backdropEl.querySelector('.ag-v2-brand-glow') : null;
      const listenTarget = canvas.closest('.ag-v2-main') || canvas.parentElement;
      if (!stageEl || !listenTarget) return;

      let waves = null;
      let field = null;
      const glow =
        glowCanvas && typeof rippleCore.mountBrandHorizonGlow === 'function'
          ? rippleCore.mountBrandHorizonGlow(glowCanvas)
          : null;
      let columns = 0;
      let rows = 0;
      let lastDrawAt = 0;
      let lastStepAt = performance.now();
      let lastSkimX = null;
      let lastSkimY = null;
      let lastSkimAt = 0;
      let skimCarryDist = 0;
      const auraState = { x: 0, y: 0, active: false };

      const setup = () => {
        const rect = canvas.getBoundingClientRect();
        if (!rect.width || !rect.height) return;
        columns = Math.max(16, Math.floor(rect.width / RIPPLE.cellWidth));
        rows = Math.max(8, Math.floor(rect.height / RIPPLE.cellHeight));
        canvas.width = Math.max(1, Math.round(columns * RIPPLE.cellWidth));
        canvas.height = Math.max(1, Math.round(rows * RIPPLE.cellHeight));
        if (glow) glow.resize(rect.width, rect.height, Math.min(window.devicePixelRatio || 1, 1.5));
        if (field) field.dispose(true);
        waves = createWaveField(columns, rows);
        field = createGlyphField(canvas, columns, rows, waves);
        waves.disturb(Math.floor(columns * 0.24), Math.floor(rows * 0.34));
        waves.disturb(Math.floor(columns * 0.78), Math.floor(rows * 0.66));
        updateCalmZones();
      };

      // Quiet zone: soften ASCII ripple behind greeting headline (alpha x0.45 feathered) for legibility
      const updateCalmZones = () => {
        if (!field || typeof field.setCalmZones !== 'function') return;
        const scope = canvas.closest('.wb-matrix-cell') || stageEl;
        const greet = scope.querySelector('[data-testid="home-greeting"]');
        if (!greet) {
          field.setCalmZones([]);
          return;
        }
        const c = canvas.getBoundingClientRect();
        const g = greet.getBoundingClientRect();
        if (!c.width || !g.width) return;
        field.setCalmZones([
          { x: g.left - c.left - 28, y: g.top - c.top - 14, w: g.width + 56, h: g.height + 28 },
        ]);
      };

      setup();
      requestAnimationFrame(updateCalmZones);
      const ro = new ResizeObserver(setup);
      ro.observe(canvas);

      const onMove = (evt) => {
        if (!field || (backdropEl && backdropEl.getAttribute('data-dormant') === 'true')) return;
        const rect = canvas.getBoundingClientRect();
        const x = evt.clientX - rect.left;
        const y = evt.clientY - rect.top;
        if (x < 0 || y < 0 || x > rect.width || y > rect.height) {
          lastSkimX = null;
          lastSkimY = null;
          skimCarryDist = 0;
          if (auraState.active) {
            auraState.active = false;
            field.invalidate();
            wakeMasterLoop();
          }
          return;
        }
        const now = performance.now();
        if (lastSkimX !== null && lastSkimY !== null && waves && !prefersReducedMotion()) {
          const stepDist = Math.hypot(x - lastSkimX, y - lastSkimY);
          const dtSec = Math.max(0.004, (now - lastSkimAt) / 1000);
          const pxPerSec = stepDist / dtSec;
          if (pxPerSec >= 220) {
            skimCarryDist += stepDist;
            if (skimCarryDist >= 42) {
              skimCarryDist = Math.min(20, skimCarryDist - 42);
              const speedNorm = Math.max(0.05, Math.min(1, (pxPerSec - 220) / 1800));
              const col = Math.floor(x / RIPPLE.cellWidth);
              const row = Math.floor(y / RIPPLE.cellHeight);
              if (typeof waves.skimmer === 'function') {
                waves.skimmer(col, row, speedNorm);
              }
            }
          } else {
            skimCarryDist *= 0.85;
          }
        }
        lastSkimX = x;
        lastSkimY = y;
        lastSkimAt = now;
        auraState.x = x;
        auraState.y = y;
        auraState.active = true;
        field.invalidate();
        wakeMasterLoop();
      };

      const onLeave = () => {
        lastSkimX = null;
        lastSkimY = null;
        skimCarryDist = 0;
        if (auraState.active && field) {
          auraState.active = false;
          field.invalidate();
          wakeMasterLoop();
        }
      };

      const onDown = (evt) => {
        if (!waves || columns <= 0 || rows <= 0) return;
        if (backdropEl && backdropEl.getAttribute('data-dormant') === 'true') return;
        const rect = canvas.getBoundingClientRect();
        const x = evt.clientX - rect.left;
        const y = evt.clientY - rect.top;
        if (x < 0 || y < 0 || x > rect.width || y > rect.height) return;
        waves.disturb(Math.floor(x / RIPPLE.cellWidth), Math.floor(y / RIPPLE.cellHeight));
        if (field) field.invalidate();
        wakeMasterLoop();
        mascotControllers.forEach((mc) => {
          if (!mc.rig || typeof mc.rig.notify !== 'function' || mc.host.closest('.ag-v2-stage') !== stageEl) return;
          const hr = mc.host.getBoundingClientRect();
          try { mc.rig.notify('ripple', { x: evt.clientX - hr.left }); } catch {}
        });
      };

      listenTarget.addEventListener('pointermove', onMove, { passive: true });
      listenTarget.addEventListener('pointerleave', onLeave, { passive: true });
      listenTarget.addEventListener('pointerdown', onDown, { passive: true });

      let drawnStatic = false;
      const mountedAt = performance.now();

      const ctrl = {
        isSleeping(now = performance.now()) {
          if (!waves || !field) return true;
          if (backdropEl && backdropEl.getAttribute('data-dormant') === 'true') return true;
          if (prefersReducedMotion()) return drawnStatic;
          if (!drawnStatic) return false;
          if (now - mountedAt < 1600) return false;
          if (auraState.active) return false;
          return typeof field.busy === 'function' ? !field.busy() : !waves.active();
        },
        step(now) {
          if (!waves || !field) return;
          if (backdropEl && backdropEl.getAttribute('data-dormant') === 'true') return;
          if (ctrl.isSleeping(now)) return;
          if (columns * rows > 4200 && now - lastDrawAt < 28) return;
          const realDt = Math.min(0.05, Math.max(0.001, (now - lastStepAt) / 1000));
          lastStepAt = now;
          lastDrawAt = now;
          const isDark = stageEl.getAttribute('data-theme') !== 'light';
          const strength = state.tokens.prismStrength ?? 1;
          if (glow) {
            glow.draw(now, { dark: isDark, still: prefersReducedMotion(), prismStrength: strength });
          }
          if (waves.active()) waves.advance(realDt);
          if (!drawnStatic || field.needsDraw(now, false)) {
            field.draw(now, getRipplePalette(stageEl, auraState), false);
            drawnStatic = true;
          }
        },
        invalidate() {
          drawnStatic = false;
          if (field) field.invalidate();
          if (glow) glow.invalidate();
          wakeMasterLoop();
        },
        triggerLiftoffBurst(nx = 0.5, ny = 0.62) {
          if (field && typeof field.triggerLiftoffBurst === 'function') {
            field.triggerLiftoffBurst(nx, ny);
          } else if (waves && columns > 0 && rows > 0) {
            waves.disturb(Math.round(columns * nx), Math.round(rows * ny));
          }
          drawnStatic = false;
          if (field) field.invalidate();
          wakeMasterLoop();
        },
        triggerTideSwell() {
          if (field && typeof field.triggerTideSwell === 'function') {
            field.triggerTideSwell();
            drawnStatic = false;
            field.invalidate();
            wakeMasterLoop();
          }
        },
        getWaveState() {
          return {
            active: waves ? waves.active() : false,
            sleeping: ctrl.isSleeping(),
            auraActive: auraState.active,
            columns,
            rows,
          };
        },
        dispose() {
          ro.disconnect();
          listenTarget.removeEventListener('pointermove', onMove);
          listenTarget.removeEventListener('pointerleave', onLeave);
          listenTarget.removeEventListener('pointerdown', onDown);
          if (field) field.dispose();
          if (glow) glow.dispose();
        },
      };
      rippleControllers.push(ctrl);
    });
  }

  const WB_CONV_AURA_HEIGHT_RATIO = 0.32;
  const WB_CONV_AURA_START_MS = 1150;
  const WB_CONV_AURA_COMPLETE_MS = 1400;

  function scaleWbConvReach(fullReach) {
    return Math.max(0.08, Math.min(0.98, +(fullReach / WB_CONV_AURA_HEIGHT_RATIO).toFixed(4)));
  }

  function syncConvAuraDomPhase() {
    document.querySelectorAll('.ag-v2-conv-aura').forEach((el) => {
      el.setAttribute('data-aura-phase', state.convAuraPhase);
    });
    const auraLabelMap = {
      idle: 'IDLE · 0fps Sleep',
      start: 'START · Prism Surge',
      running: 'RUNNING · Prism Flow',
      complete: 'COMPLETE · Mist Settle',
    };
    const label = auraLabelMap[state.convAuraPhase] || auraLabelMap.idle;
    document.querySelectorAll('[data-conv-aura-badge]').forEach((b) => {
      b.setAttribute('data-conv-aura-badge', state.convAuraPhase);
      b.textContent = label;
    });
  }

  function computeWbConvAuraOptics(phase, phaseAt, now, dark, isRunning, prismScale) {
    if (state.liftoffEbbAt > 0 && now - state.liftoffEbbAt < 520) {
      const p = Math.max(0, Math.min(1, (now - state.liftoffEbbAt) / 520));
      const ease = 1 - Math.pow(1 - p, 2.25);
      const endStr = dark ? 0.29 : 0.62;
      return {
        strength: 0.92 + (endStr - 0.92) * ease,
        reach: scaleWbConvReach(0.31 + (0.21 - 0.31) * ease),
        prism: (0.62 + (0.19 - 0.62) * ease) * Math.max(0, Math.min(1, prismScale)),
        surge: 0.34 * (1 - ease),
        speed: 1.32 + (1.0 - 1.32) * ease,
        frameMs: 16,
      };
    }
    const idleStr = dark ? 0.21 : 0.52;
    const runBase = dark ? 0.31 : 0.64;
    const idlePrism = dark ? 0.14 : 0.26;
    let out;
    if (phase === 'start') {
      const p = Math.max(0, Math.min(1, (now - phaseAt) / WB_CONV_AURA_START_MS));
      const s = Math.sin(p * Math.PI);
      const peakStr = dark ? 0.46 : 0.78;
      const endStr = isRunning ? runBase : idleStr;
      const endReach = isRunning ? 0.22 : 0.16;
      const rawReach = p <= 0.5 ? 0.16 + (0.26 - 0.16) * s : endReach + (0.26 - endReach) * s;
      const endPrism = isRunning ? 0.70 : idlePrism;
      const settleEase = Math.pow(p, 2.4);
      const endSpeed = isRunning ? 1.45 : 0.72;
      out = {
        strength: p <= 0.5 ? idleStr + (peakStr - idleStr) * s : endStr + (peakStr - endStr) * s,
        reach: scaleWbConvReach(rawReach),
        prism: p <= 0.5 ? idlePrism + (0.74 - idlePrism) * s : endPrism + (0.74 - endPrism) * s,
        surge: Number((0.50 * (1 - 0.32 * settleEase)).toFixed(4)),
        speed: Number((1.95 - (1.95 - endSpeed) * settleEase).toFixed(4)),
        frameMs: 22,
      };
    } else if (phase === 'running') {
      out = {
        strength: runBase + (dark ? 0.035 : 0.045) * Math.sin(now * 0.0021),
        reach: scaleWbConvReach(0.22),
        prism: 0.70,
        surge: 0.06 * Math.sin(now * 0.0024),
        speed: 1.45,
        frameMs: 32,
      };
    } else if (phase === 'complete') {
      const p = Math.max(0, Math.min(1, (now - phaseAt) / WB_CONV_AURA_COMPLETE_MS));
      const ease = 1 - Math.pow(1 - p, 2.1);
      const startStr = dark ? 0.38 : 0.70;
      const rawReach = 0.24 + (0.16 - 0.24) * ease;
      out = {
        strength: startStr + (idleStr - startStr) * ease,
        reach: scaleWbConvReach(rawReach),
        prism: 0.76 + (idlePrism - 0.76) * ease,
        surge: -0.36 * (1 - ease * 0.85),
        speed: 1.45 + (0.72 - 1.45) * ease,
        frameMs: 28,
      };
    } else {
      out = {
        strength: idleStr + (dark ? 0.024 : 0.038) * Math.sin(now * 0.0018),
        reach: scaleWbConvReach(0.16),
        prism: idlePrism,
        surge: 0,
        speed: 0.72,
        frameMs: 50,
      };
    }
    out.prism *= Math.max(0, Math.min(1, prismScale));
    return out;
  }

  function invokeWbHorizonGlow(glow, now, dark, still, opt) {
    if (!glow) return;
    try {
      if (still && typeof glow.drawStaticSnapshot === 'function') {
        glow.drawStaticSnapshot(now, dark, opt.strength, {
          reach: opt.reach,
          prism: opt.prism,
          surge: opt.surge,
          speed: opt.speed,
          still: true,
        });
        return;
      }
      if (typeof glow.draw === 'function') {
        glow.draw(now, dark, opt.strength, {
          reach: opt.reach,
          prism: opt.prism,
          surge: opt.surge,
          speed: opt.speed,
          still,
        });
      }
    } catch {}
  }

  function isWbConvLivingFlow() {
    if (prefersReducedMotion() || document.hidden) return false;
    return state.motionLevel === 'standard' || state.motionLevel === 'ultra';
  }

  function mountConvAuras() {
    const rippleCore = globalThis.__agCsRippleCore;
    if (!rippleCore || !state.rippleEnabled || typeof rippleCore.mountBrandHorizonGlow !== 'function') return;

    document.querySelectorAll('.ag-v2-conv-glow').forEach((canvas) => {
      const stageEl = canvas.closest('.ag-v2-stage');
      const hostEl = canvas.closest('.ag-v2-conv-aura');
      if (!stageEl || !hostEl) return;

      const glow = rippleCore.mountBrandHorizonGlow(canvas);
      let lastDrawAt = -Infinity;
      let staticSleepDrawn = false;

      const setup = () => {
        const rect = hostEl.getBoundingClientRect();
        if (!rect.width || !rect.height) return;
        glow.resize(rect.width, rect.height, Math.min(window.devicePixelRatio || 1, 1) * 0.72);
        lastDrawAt = -Infinity;
        staticSleepDrawn = false;
      };

      setup();
      const ro = new ResizeObserver(() => {
        setup();
        wakeMasterLoop();
      });
      ro.observe(hostEl);

      const ctrl = {
        isSleeping() {
          if (hostEl.getAttribute('data-dormant') === 'true') return true;
          if (isWbConvLivingFlow()) return false;
          return staticSleepDrawn;
        },
        step(now, force = false) {
          if (hostEl.getAttribute('data-dormant') === 'true') return;
          if (state.convAuraPhase === 'start' && now - state.convAuraPhaseAt >= WB_CONV_AURA_START_MS) {
            state.convAuraPhase = state.streamPhase === 'streaming' ? 'running' : 'idle';
            state.convAuraPhaseAt = now;
            staticSleepDrawn = false;
            syncConvAuraDomPhase();
            force = true;
          } else if (state.convAuraPhase === 'complete' && now - state.convAuraPhaseAt >= WB_CONV_AURA_COMPLETE_MS) {
            state.convAuraPhase = 'idle';
            state.convAuraPhaseAt = now;
            staticSleepDrawn = false;
            syncConvAuraDomPhase();
            force = true;
          }

          const allowLiving = isWbConvLivingFlow();
          if (!allowLiving && staticSleepDrawn && !force) return;

          const isDark = stageEl.getAttribute('data-theme') !== 'light';
          const prismScale = state.tokens.prismStrength ?? 1;
          const opt = computeWbConvAuraOptics(
            state.convAuraPhase,
            state.convAuraPhaseAt,
            now,
            isDark,
            state.streamPhase === 'streaming',
            prismScale
          );
          if (!force && allowLiving && now - lastDrawAt < opt.frameMs) return;
          lastDrawAt = now;
          if ((force || !allowLiving) && typeof glow.invalidate === 'function') glow.invalidate();
          invokeWbHorizonGlow(glow, now, isDark, !allowLiving, opt);
          if (!allowLiving) {
            staticSleepDrawn = true;
            hostEl.setAttribute('data-aura-sleep', '1');
          } else {
            staticSleepDrawn = false;
            hostEl.removeAttribute('data-aura-sleep');
          }
        },
        invalidate() {
          lastDrawAt = -Infinity;
          staticSleepDrawn = false;
          if (typeof glow.invalidate === 'function') glow.invalidate();
          wakeMasterLoop();
        },
        dispose() {
          ro.disconnect();
          if (typeof glow.dispose === 'function') glow.dispose();
        },
      };
      convAuraControllers.push(ctrl);
    });

    const nowInit = performance.now();
    for (const c of convAuraControllers) c.step(nowInit, true);
  }

  function mountEffortSliders() {
    const sliderMod = globalThis.AntigravityCodexEffortSlider;
    if (!sliderMod || typeof sliderMod.mountCodexEffortSlider !== 'function') return;

    document.querySelectorAll('[data-workbench-ces-mount="true"]').forEach((mountEl) => {
      if (mountEl.dataset.mounted === '1') return;
      mountEl.dataset.mounted = '1';
      const listeners = new Set();
      const seat = {
        get effortLevels() {
          const m = getActiveModel();
          if (m.isOrchestrator || !m.efforts.length) {
            return [{ effort: 'high', label: 'High' }];
          }
          return m.efforts.map((id) => {
            const meta = ALL_EFFORTS.find((e) => e.id === id) || { id, label: id };
            return { effort: id, label: meta.label };
          });
        },
        get currentEffort() {
          const m = getActiveModel();
          if (m.isOrchestrator || !m.efforts.length) return 'high';
          return state.effortByModel[m.id] || m.efforts[0];
        },
        get locked() {
          const m = getActiveModel();
          return Boolean(m.isOrchestrator) || m.efforts.length <= 1;
        },
        get baseName() {
          return getActiveModel().name;
        },
        get isClaude() {
          return getActiveModel().camp === 'claude';
        },
        get theme() {
          return getActiveModel().camp === 'claude' ? 'claude' : 'codex';
        },
        selectEffort(item) {
          const m = getActiveModel();
          const key = (item && (item.effort || (item.raw && item.raw.effort))) || '';
          if (m.isOrchestrator || !key || !m.efforts.includes(key)) return;
          state.effortByModel[m.id] = key;
          syncComposerTriggerDom();
          listeners.forEach((fn) => {
            try { fn(); } catch {}
          });
        },
        subscribe(fn) {
          listeners.add(fn);
          return () => listeners.delete(fn);
        },
      };

      const rowEl = mountEl.closest('[data-ces-effort-row="true"]');
      const valEl = rowEl ? rowEl.querySelector('.ces-ag-effort-value') : null;
      const inst = sliderMod.mountCodexEffortSlider({
        container: mountEl,
        seat,
        row: rowEl,
        valueElement: valEl,
        document,
        window,
      });

      sliderControllers.push({
        el: mountEl,
        notify() {
          listeners.forEach((fn) => {
            try { fn(); } catch {}
          });
          if (inst && typeof inst.refresh === 'function') inst.refresh();
        },
        dispose() {
          if (inst && typeof inst.unmount === 'function') inst.unmount();
        },
      });
    });
  }

  /* ── Physical Optical Borosilicate Water Vial (WebGL2 Backdrop Refraction + Slosh) ── */
  function mountVials() {
    const vialCore = globalThis.__agVialCore;
    if (!vialCore || typeof vialCore.mountPhysicalWaterVial !== 'function') return;

    const reduceMotion =
      window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const canvases = document.querySelectorAll('canvas[data-vial-canvas="true"]');

    canvases.forEach((canvas) => {
      const stageEl = canvas.closest('.ag-v2-stage');
      if (!stageEl || canvas.dataset.mounted === '1') return;
      canvas.dataset.mounted = '1';

      const getState = () => {
        const isDark = stageEl.getAttribute('data-theme') !== 'light';
        const model = getActiveModel();
        const tele = getContextTelemetry();
        const fill = Math.min(0.95, tele.ratios[0] + tele.ratios[1] + tele.ratios[2]);
        return {
          isDark,
          camp: model.camp,
          critical: state.vialCritical,
          fill,
          ratios: tele.ratios,
          maxTokens: 512000,
          hoveredSlice: state.hoveredSlice,
          streaming: state.vialStreaming,
        };
      };

      const initTele = getContextTelemetry();
      const inst = vialCore.mountPhysicalWaterVial(canvas, {
        fill: Math.min(0.95, initTele.ratios[0] + initTele.ratios[1] + initTele.ratios[2]),
        maxTokens: 512000,
        streaming: state.vialStreaming,
        reduceMotion,
        getState,
      });
      if (!inst) return;

      // Gravity slosh when shaking/dragging the floating radar popover window
      const popoverEl = canvas.closest('.ag-v2-dash-popover');
      let cleanups = [];
      if (popoverEl) {
        let draggingWin = false;
        let downX = 0;
        let downY = 0;
        let lastX = 0;
        let lastVx = 0;

        const onWinDown = (evt) => {
          if (evt.button !== 0) return;
          if (evt.target.closest('button, a, canvas[data-vial-canvas], [data-layer-slice]')) return;
          draggingWin = true;
          downX = evt.clientX;
          downY = evt.clientY;
          lastX = evt.clientX;
          lastVx = 0;
          popoverEl.style.transition = 'none';
          popoverEl.setPointerCapture?.(evt.pointerId);
        };
        const onWinMove = (evt) => {
          if (!draggingWin) return;
          const dxStep = evt.clientX - lastX;
          lastX = evt.clientX;
          const ox = Math.max(-44, Math.min(44, (evt.clientX - downX) * 0.55));
          const oy = Math.max(-20, Math.min(20, (evt.clientY - downY) * 0.4));
          popoverEl.style.transform = `translate3d(${ox.toFixed(1)}px, ${oy.toFixed(1)}px, 0) rotate(${(ox * 0.09).toFixed(2)}deg)`;
          if (Math.abs(dxStep) > 0.25) {
            const imp = Math.max(-3.2, Math.min(3.2, -dxStep * 0.13));
            lastVx = imp;
            inst.impulse(imp);
          }
        };
        const onWinUp = (evt) => {
          if (!draggingWin) return;
          draggingWin = false;
          popoverEl.releasePointerCapture?.(evt.pointerId);
          popoverEl.style.transition = 'transform 340ms cubic-bezier(0.22, 1.4, 0.36, 1)';
          popoverEl.style.transform = '';
          if (Math.abs(lastVx) > 0.15) inst.impulse(-lastVx * 0.55);
        };

        popoverEl.addEventListener('pointerdown', onWinDown);
        popoverEl.addEventListener('pointermove', onWinMove);
        popoverEl.addEventListener('pointerup', onWinUp);
        popoverEl.addEventListener('pointercancel', onWinUp);
        cleanups.push(() => {
          popoverEl.removeEventListener('pointerdown', onWinDown);
          popoverEl.removeEventListener('pointermove', onWinMove);
          popoverEl.removeEventListener('pointerup', onWinUp);
          popoverEl.removeEventListener('pointercancel', onWinUp);
          popoverEl.style.transform = '';
          popoverEl.style.transition = '';
        });
      }

      vialControllers.push({
        el: canvas,
        isSleeping() {
          if (state.vialStreaming) return false;
          if (typeof inst.isSettled === 'function') return Boolean(inst.isSettled());
          return false;
        },
        step(dtSec) {
          if (!state.vialStreaming && typeof inst.isSettled === 'function' && inst.isSettled()) return;
          inst.step(dtSec);
        },
        impulse(strength) {
          inst.impulse(strength);
          wakeMasterLoop();
        },
        spawnDroplet() {
          if (typeof inst.spawnDroplet === 'function') inst.spawnDroplet();
          wakeMasterLoop();
        },
        getDebugState() {
          return typeof inst.getDebugState === 'function' ? inst.getDebugState() : null;
        },
        dispose() {
          cleanups.forEach((fn) => fn());
          inst.dispose();
        },
      });
    });
  }

  /* ── Orchestrator Cut Optical Crystal Prism Bar (WebGL2 Facets + Near-Field Dispersion) ── */
  function mountCrystalBars() {
    const crystalCore = globalThis.__agCrystalPrismCore;
    if (!crystalCore || typeof crystalCore.mountCrystalPrismBar !== 'function') return;

    const reduceMotion =
      window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const canvases = document.querySelectorAll('canvas[data-orch-crystal-canvas="true"]');

    canvases.forEach((canvas) => {
      const stageEl = canvas.closest('.ag-v2-stage');
      if (!stageEl || canvas.dataset.mounted === '1') return;
      canvas.dataset.mounted = '1';

      const getState = () => {
        const isDark = stageEl.getAttribute('data-theme') !== 'light';
        const rawStrength = Number.parseFloat(getComputedStyle(stageEl).getPropertyValue('--ag-prism-strength'));
        const prismStrength = Number.isFinite(rawStrength) ? rawStrength : (state.tokens.prismStrength ?? 1);
        return {
          isDark,
          prismStrength,
        };
      };

      const inst = crystalCore.mountCrystalPrismBar(canvas, {
        reduceMotion,
        getState,
      });
      if (!inst) return;

      if (lastPointerPos.x > -1000) {
        inst.setPointerClient(lastPointerPos.x, lastPointerPos.y);
      }
      inst.step(0.016);
      inst.__hostEl = canvas;
      crystalControllers.push(inst);
    });
  }

  function mountMascots() {
    const rigMod = globalThis.__agDualMascotRig;
    if (!rigMod || typeof rigMod.mountDualMascotStage !== 'function') return;

    document.querySelectorAll('[data-mascot-stage="true"]').forEach((host) => {
      const floating = host.getAttribute('data-floating') === 'true';
      const model = getActiveModel();
      const wrap = host.closest('.ag-v2-composer-wrap');
      const card = wrap ? wrap.querySelector('.ag-v2-overlay-card') : null;
      const rightPop = wrap ? wrap.querySelector('.ag-v2-popover-docked.is-right') : null;
      const leapY = card && state.mascotYieldMode === 'leap' ? (card.offsetHeight || 76) + 16 : 0;
      const popW = rightPop ? rightPop.offsetWidth || (state.contextVialEnabled ? 408 : 316) : 0;

      const rig = rigMod.mountDualMascotStage(host, {
        camp: model.camp,
        streaming: state.streamPhase === 'streaming',
        streamTier: state.effortByModel[model.id] === 'xhigh' || model.isOrchestrator ? 3 : 2,
        hasError: state.hasToolError,
        yieldMode: state.overlayDemo ? state.mascotYieldMode : 'none',
        leapOffsetY: leapY,
        popoverRightWidth: floating ? popW : 0,
        miniPileEnabled: state.mascotMiniPile,
        orchestrator: Boolean(model.isOrchestrator),
      });
      if (rig) {
        mascotControllers.push({ host, floating, rig });
      }
    });
  }

  function computePerfSleepSnapshot(now = performance.now()) {
    const auraSleep =
      convAuraControllers.length === 0 || convAuraControllers.every((c) => (typeof c.isSleeping === 'function' ? c.isSleeping(now) : true));
    const rippleSleep =
      rippleControllers.length === 0 || rippleControllers.every((r) => (typeof r.isSleeping === 'function' ? r.isSleeping(now) : true));
    const vialSleep =
      vialControllers.length === 0 || vialControllers.every((v) => (typeof v.isSleeping === 'function' ? v.isSleeping() : true));
    const crystalSleep =
      crystalControllers.length === 0 || state.activeModelId !== 'orchestrator' || state.openPopover !== 'effort';
    const allSleep = auraSleep && rippleSleep && vialSleep && crystalSleep;
    return {
      allSleep,
      auraSleeping: auraSleep,
      rippleSleeping: rippleSleep,
      vialSleeping: vialSleep,
      auraText: auraSleep ? 'Aura: 0fps Idle Sleep' : `Aura: Active (${state.convAuraPhase})`,
      rippleText: rippleSleep ? 'Ripple: 0fps Idle Sleep' : 'Ripple: Active',
      vialText: vialSleep ? 'Vial: 0fps Idle Sleep' : 'Vial: Active',
    };
  }

  function updatePerfSleepIndicators(now = performance.now()) {
    const snap = computePerfSleepSnapshot(now);
    const auraEl = document.getElementById('val-aura-sleep');
    if (auraEl) {
      auraEl.textContent = snap.auraText;
      auraEl.setAttribute('data-state', snap.auraSleeping ? 'sleep' : 'active');
    }
    const rippleEl = document.getElementById('val-ripple-sleep');
    if (rippleEl) {
      rippleEl.textContent = snap.rippleText;
      rippleEl.setAttribute('data-state', snap.rippleSleeping ? 'sleep' : 'active');
    }
    const vialEl = document.getElementById('val-vial-sleep');
    if (vialEl) {
      vialEl.textContent = snap.vialText;
      vialEl.setAttribute('data-state', snap.vialSleeping ? 'sleep' : 'active');
    }
    const masterEl = document.getElementById('val-master-fps');
    if (masterEl) {
      masterEl.textContent = snap.allSleep ? '0fps Idle' : '60fps Active';
      masterEl.setAttribute('data-sleep', String(snap.allSleep));
    }
    return snap;
  }

  function wakeMasterLoop() {
    if (masterRafId) return;
    startMasterLoop();
  }

  function startMasterLoop() {
    if (masterRafId) cancelAnimationFrame(masterRafId);
    masterSleeping = false;
    lastFrameMs = performance.now();

    const tick = (now) => {
      masterRafId = 0;
      masterFrameTicks += 1;
      const dtSec = Math.min(0.05, Math.max(0.001, (now - lastFrameMs) / 1000));
      lastFrameMs = now;

      if (!document.hidden && !windowBlurredLong) {
        for (const r of rippleControllers) r.step(now);
        for (const a of convAuraControllers) a.step(now);
        for (const v of vialControllers) v.step(dtSec);
        if (state.activeModelId === 'orchestrator' && state.openPopover === 'effort') {
          for (const c of crystalControllers) c.step(dtSec);
        }
      }

      const snap = updatePerfSleepIndicators(now);
      if (snap.allSleep || document.hidden || windowBlurredLong) {
        masterSleeping = true;
        return;
      }
      masterRafId = requestAnimationFrame(tick);
    };
    masterRafId = requestAnimationFrame(tick);
  }

  function disposeRuntimeInstances() {
    if (masterRafId) {
      cancelAnimationFrame(masterRafId);
      masterRafId = 0;
    }
    if (prismRafId) {
      cancelAnimationFrame(prismRafId);
      prismRafId = 0;
    }
    for (const ctrl of rippleControllers) {
      try { ctrl.dispose(); } catch {}
    }
    rippleControllers = [];
    for (const aura of convAuraControllers) {
      try { aura.dispose(); } catch {}
    }
    convAuraControllers = [];
    for (const vial of vialControllers) {
      try { vial.dispose(); } catch {}
    }
    vialControllers = [];
    for (const crystal of crystalControllers) {
      try { crystal.dispose(); } catch {}
    }
    crystalControllers = [];
    for (const sl of sliderControllers) {
      try { sl.dispose(); } catch {}
    }
    sliderControllers = [];
    for (const mc of mascotControllers) {
      try { mc.rig.dispose(); } catch {}
    }
    mascotControllers = [];
  }

  function buildQuadHtml() {
    return `
      <div class="wb-quad-grid" data-testid="wb-quad-theme-matrix">
        <div class="wb-quad-pane" data-quad="obsidian-dark">
          ${buildSingleStageHtml('dark', {
            palette: 'obsidian',
            theme: 'dark',
            lightPreset: 'crystal',
            lockedPreset: true,
            sidebarCollapsed: true,
            allowFloat: false,
            crumbTag: '1 · DARK OBSIDIAN',
          })}
        </div>
        <div class="wb-quad-pane" data-quad="warm-dark">
          ${buildSingleStageHtml('dark', {
            palette: 'warm',
            theme: 'dark',
            lightPreset: 'alabaster',
            lockedPreset: true,
            sidebarCollapsed: true,
            allowFloat: false,
            crumbTag: '2 · DARK WARM',
          })}
        </div>
        <div class="wb-quad-pane" data-quad="daylight-crystal">
          ${buildSingleStageHtml('light', {
            palette: 'obsidian',
            theme: 'light',
            lightPreset: 'crystal',
            lockedPreset: true,
            sidebarCollapsed: true,
            allowFloat: false,
            crumbTag: '3 · LIGHT DAYLIGHT CRYSTAL',
          })}
        </div>
        <div class="wb-quad-pane" data-quad="warm-alabaster">
          ${buildSingleStageHtml('light', {
            palette: 'warm',
            theme: 'light',
            lightPreset: 'alabaster',
            lockedPreset: true,
            sidebarCollapsed: true,
            allowFloat: false,
            crumbTag: '4 · LIGHT WARM ALABASTER',
          })}
        </div>
      </div>`;
  }

  function renderWorkbench() {
    disposeRuntimeInstances();
    const host = document.getElementById('wb-stage-host');
    if (!host) return;

    if (state.viewMode === 'split') {
      host.innerHTML = `
        <div class="wb-split-grid">
          <div class="wb-split-pane">
            <span class="wb-split-badge">DARK · ${state.tokens.palette.toUpperCase()}</span>
            ${buildSingleStageHtml('dark')}
          </div>
          <div class="wb-split-pane">
            <span class="wb-split-badge">LIGHT · ${(state.tokens.lightPreset || 'crystal').toUpperCase()}</span>
            ${buildSingleStageHtml('light')}
          </div>
        </div>`;
    } else if (state.viewMode === 'quad') {
      host.innerHTML = buildQuadHtml();
    } else if (state.viewMode === 'matrix') {
      host.innerHTML = buildMatrixHtml();
    } else {
      host.innerHTML = buildSingleStageHtml();
    }

    applyTokenStylesToStages();
    syncTopbarControls();
    syncInspectorControls();
    mountRipples();
    mountConvAuras();
    mountVials();
    mountCrystalBars();
    mountEffortSliders();
    mountMascots();
    requestAnimationFrame(syncMascotsState);
    if (lastPointerPos.x > -1000) updatePrismCoordinates();
    updatePerfSleepIndicators();
    startMasterLoop();
  }

  /* ── In-place patch layer: update popovers/overlays/ranges/cache without rebuilding WebGL or losing focus ── */
  function pruneDetachedControllers() {
    vialControllers = vialControllers.filter((v) => {
      if (v.el && !v.el.isConnected) {
        try { v.dispose(); } catch {}
        return false;
      }
      return true;
    });
    crystalControllers = crystalControllers.filter((c) => {
      if (c.__hostEl && !c.__hostEl.isConnected) {
        try { c.dispose(); } catch {}
        return false;
      }
      return true;
    });
    sliderControllers = sliderControllers.filter((sl) => {
      if (sl.el && !sl.el.isConnected) {
        try { sl.dispose(); } catch {}
        return false;
      }
      return true;
    });
  }

  // Unmount after exit transition completes, or immediately under reduced motion
  function animateOut(el, onDone) {
    if (!el) {
      if (onDone) onDone();
      return;
    }
    let finished = false;
    const finish = () => {
      if (finished) return;
      finished = true;
      el.remove();
      if (onDone) onDone();
    };
    if (prefersReducedMotion()) {
      finish();
      return;
    }
    el.classList.add('is-closing');
    el.style.pointerEvents = 'none';
    el.addEventListener('animationend', finish, { once: true });
    setTimeout(finish, 260);
  }

  function getFloatingComposerWraps() {
    return Array.from(document.querySelectorAll('.ag-v2-mascot-stage[data-floating="true"]'))
      .map((host) => host.closest('.ag-v2-composer-wrap'))
      .filter(Boolean);
  }

  function syncPopoverTriggers() {
    document.querySelectorAll('.ag-v2-composer-wrap').forEach((wrap) => {
      const floating = Boolean(wrap.querySelector('.ag-v2-mascot-stage[data-floating="true"]'));
      const m = wrap.querySelector('[data-testid="model-selector-trigger"]');
      const d = wrap.querySelector('[data-testid="dashboard-vial-trigger"]');
      if (m) m.setAttribute('aria-expanded', String(floating && state.openPopover === 'effort'));
      if (d) d.setAttribute('aria-expanded', String(floating && state.openPopover === 'dashboard'));
    });
  }

  // Anchored popover transitions: play is-closing on old popover and agPopIn from trigger on new one
  function swapPopovers() {
    const wraps = getFloatingComposerWraps();
    if (!wraps.length) {
      renderWorkbench();
      return;
    }
    const html =
      state.openPopover === 'effort'
        ? buildModelPanelHtml(true)
        : state.openPopover === 'dashboard'
          ? buildDashboardPanelHtml(true)
          : '';
    wraps.forEach((wrap) => {
      wrap.querySelectorAll(':scope > .ag-v2-popover-docked:not(.is-closing)').forEach((old) => {
        animateOut(old, () => {
          pruneDetachedControllers();
          syncMascotsState();
        });
      });
      if (html) {
        const box = wrap.querySelector('[data-testid="agent-input-box"]');
        if (box) box.insertAdjacentHTML('beforebegin', html);
      }
    });
    mountVials();
    mountCrystalBars();
    mountEffortSliders();
    syncPopoverTriggers();
    notifyMascots('popover', { side: state.openPopover === 'effort' ? 'left' : state.openPopover === 'dashboard' ? 'right' : null });
    if (lastPointerPos.x > -1000) updatePrismCoordinates();
    requestAnimationFrame(syncMascotsState);
  }

  function applyHoveredSliceDom() {
    document.querySelectorAll('[data-layer-slice]').forEach((r) => {
      const idx = parseInt(r.getAttribute('data-layer-slice'), 10);
      r.setAttribute('data-hovered', String(idx === state.hoveredSlice));
    });
    document.querySelectorAll('.ag-v2-ctx-bar-track').forEach((track) => {
      track.setAttribute('data-has-hover', String(state.hoveredSlice >= 0));
    });
  }

  function syncContextVialUiControls() {
    const ctx = getContextTelemetry();
    document.querySelectorAll('[data-testid="dashboard-vial-trigger"]').forEach((trg) => {
      trg.setAttribute('data-vial-mode', state.contextVialEnabled ? 'vial' : 'bar');
      const svg = trg.querySelector('.ag-v2-ring-svg');
      const mini = trg.querySelector('[data-trigger-minibar="true"]');
      const tip = trg.querySelector('.ag-v2-ctx-tooltip');
      if (svg) svg.style.display = state.contextVialEnabled ? '' : 'none';
      if (mini) {
        mini.style.display = state.contextVialEnabled ? 'none' : '';
        const fill = mini.querySelector('i');
        if (fill) fill.style.width = `${Math.round(ctx.pct)}%`;
      }
      if (tip) {
        tip.textContent = `Live rate ${ctx.rate} · Click to open ${state.contextVialEnabled ? 'optical vial' : 'minimal context bar'}`;
      }
    });

    document.querySelectorAll('[data-action="toggle-context-vial"]').forEach((btn) => {
      btn.setAttribute('data-on', String(state.contextVialEnabled));
    });
    syncInspectorControls();
  }

  // Toggle optical vial <-> minimal segmented bar in place without flicker while managing WebGL cleanly
  function setContextVialEnabled(nextOn) {
    state.contextVialEnabled = Boolean(nextOn);
    for (const v of vialControllers) {
      try { v.dispose(); } catch {}
    }
    vialControllers = [];

    document.querySelectorAll('.ag-v2-dash-popover:not(.is-closing)').forEach((pop) => {
      const isFloating = pop.classList.contains('ag-v2-popover-docked');
      const tmp = document.createElement('div');
      tmp.innerHTML = buildDashboardPanelHtml(isFloating).trim();
      const nextPop = tmp.firstElementChild;
      if (nextPop) {
        nextPop.classList.add('is-mode-swap');
        pop.replaceWith(nextPop);
      }
    });

    syncContextVialUiControls();
    if (state.contextVialEnabled) {
      mountVials();
    }
    requestAnimationFrame(syncMascotsState);
  }

  // Takeover card / slash menu: patch in place for same type or crossfade between types
  function swapOverlay() {
    const wraps = getFloatingComposerWraps();
    if (!wraps.length) {
      renderWorkbench();
      return;
    }
    const html = buildOverlayCardHtml();
    const tmp = document.createElement('div');
    tmp.innerHTML = html;
    const next = tmp.firstElementChild;
    wraps.forEach((wrap) => {
      const old = wrap.querySelector(':scope > .ag-v2-overlay-card:not(.is-closing)');
      if (old && next && old.getAttribute('data-testid') === next.getAttribute('data-testid')) {
        old.innerHTML = next.innerHTML;
        return;
      }
      if (old) animateOut(old, () => requestAnimationFrame(syncMascotsState));
      if (next) {
        const stage = wrap.querySelector('.ag-v2-mascot-stage');
        if (stage) stage.insertAdjacentHTML('afterend', html);
      }
    });
    requestAnimationFrame(syncMascotsState);
  }

  // Switch 7d / 30d / All: glide pill indicator + staggered heatmap reflow + scale readout flip
  function patchTimeRange() {
    const grids = document.querySelectorAll('[data-heat-grid="true"]');
    if (!grids.length) {
      renderWorkbench();
      return;
    }
    const stat = TIME_RANGE_STATS[state.timeRange];
    grids.forEach((g) => {
      g.innerHTML = buildHeatmapCells();
      g.classList.remove('is-restaging');
      void g.offsetWidth;
      g.classList.add('is-restaging');
    });
    document.querySelectorAll('[data-hero-num="true"]').forEach((el) => {
      el.textContent = stat.books;
      el.classList.remove('is-rolling');
      void el.offsetWidth;
      el.classList.add('is-rolling');
    });
    document.querySelectorAll('[data-scale-sub="true"]').forEach((el) => {
      el.textContent = stat.sub;
    });
    document.querySelectorAll('[data-testid="studio-time-range-tabs"]').forEach((tabBar) => {
      const prevBtn = tabBar.querySelector('[data-range][data-active="true"]');
      const prevRect = prevBtn ? prevBtn.getBoundingClientRect() : null;
      tabBar.querySelectorAll('.ag-v2-seg-glide-bg').forEach((g) => g.remove());
      let nextBtn = null;
      tabBar.querySelectorAll('[data-range]').forEach((btn) => {
        const isAct = btn.getAttribute('data-range') === state.timeRange;
        btn.setAttribute('data-active', String(isAct));
        if (isAct) nextBtn = btn;
      });
      if (nextBtn) {
        nextBtn.insertAdjacentHTML('afterbegin', '<span class="ag-v2-seg-glide-bg" data-range-glide="true" aria-hidden="true"></span>');
        const glideEl = nextBtn.querySelector('.ag-v2-seg-glide-bg');
        if (glideEl && prevRect && prevBtn !== nextBtn) {
          runGlide(glideEl, prevRect, nextBtn.getBoundingClientRect());
        }
      }
    });
  }

  // Collapse/expand sidebar in place (236px <-> 56px micro-rail) without destroying WebGL stages
  function setSidebarCollapsed(nextCollapsed) {
    const target = Boolean(nextCollapsed);
    if (state.sidebarCollapsed === target) return;
    state.sidebarCollapsed = target;

    document.querySelectorAll('[data-stage-floating-tip="true"]').forEach((t) => t.setAttribute('data-show', 'false'));

    document.querySelectorAll('[data-testid="sidebar-split"]').forEach((sb) => {
      sb.setAttribute('data-collapsed', String(target));
      const btn = sb.querySelector('[data-testid="sidebar-collapse-btn"]');
      if (btn) {
        btn.setAttribute('data-tip', target ? 'Expand Sidebar|[' : 'Collapse Sidebar|[');
        btn.setAttribute('aria-expanded', String(!target));
        btn.setAttribute('aria-label', target ? 'Expand Sidebar' : 'Collapse Sidebar');
        triggerAnimIcon(btn, target ? 'collapse' : 'expand');
      }
      if (target && globalThis.__agMotionEngine && typeof globalThis.__agMotionEngine.stagger === 'function' && !prefersReducedMotion()) {
        const railBtns = sb.querySelectorAll('.ag-v2-sidebar-rail-body .ag-v2-rail-btn');
        if (railBtns.length) {
          try {
            globalThis.__agMotionEngine.stagger(
              Array.from(railBtns),
              [
                { opacity: 0, transform: 'scale(0.86) translateY(4px)' },
                { opacity: 1, transform: 'scale(1) translateY(0)' },
              ],
              { delayStep: 22, stiffness: 400, damping: 28 }
            );
          } catch {}
        }
      }
    });

    setTimeout(() => {
      rippleControllers.forEach((ctrl) => ctrl.invalidate());
      requestAnimationFrame(syncMascotsState);
    }, 330);
  }

  // Toggle on-demand sidebar search field (hidden at rest for zero clutter)
  function setSidebarSearchOpen(nextOpen, focusInput = false) {
    const target = Boolean(nextOpen);
    state.sidebarSearchOpen = target;
    document.querySelectorAll('[data-testid="sidebar-split"]').forEach((sb) => {
      sb.setAttribute('data-search-open', String(target));
      const wrap = sb.querySelector('[data-sidebar-search-wrap="true"]');
      if (wrap) wrap.setAttribute('data-open', String(target));
      const toggleBtn = sb.querySelector('[data-testid="sidebar-search-toggle"]');
      if (toggleBtn) toggleBtn.setAttribute('data-active', String(target));
    });
    if (target && focusInput) {
      requestAnimationFrame(() => {
        const inp = document.querySelector('[data-testid="sidebar-search-input"]');
        if (inp) {
          inp.focus();
          inp.select?.();
        }
      });
    }
  }

  // Filter sidebar conversation list in place while preserving search input focus and caret
  function patchSidebarSessions(syncInputValue = false) {
    document.querySelectorAll('[data-testid="sidebar-split"]').forEach((sb) => {
      if (syncInputValue) {
        const inp = sb.querySelector('[data-testid="sidebar-search-input"]');
        if (inp && inp.value !== state.sidebarSearchQuery) {
          inp.value = state.sidebarSearchQuery;
        }
      }
      const tail = sb.querySelector('[data-sidebar-search-tail="true"]');
      if (tail) tail.innerHTML = buildSidebarSearchTailHtml();
      const list = sb.querySelector('[data-sidebar-sessions="true"]');
      if (list) {
        list.innerHTML = buildSidebarSessionsHtml();
      }
    });
  }

  // Delegated glass tooltip for sidebar collapse & 56px rail buttons mounted at stage root to avoid clipping
  function bindStageTooltips() {
    const hideAll = () => {
      document.querySelectorAll('[data-stage-floating-tip="true"]').forEach((t) => t.setAttribute('data-show', 'false'));
    };
    document.addEventListener('pointerover', (evt) => {
      const host = evt.target && evt.target.closest ? evt.target.closest('[data-tip]:not(.ag-v2-heat-cell)') : null;
      if (!host) return;
      const stage = host.closest('.ag-v2-stage');
      const tip = stage ? stage.querySelector('[data-stage-floating-tip="true"]') : null;
      if (!stage || !tip) return;
      const raw = String(host.getAttribute('data-tip') || '');
      if (!raw) return;
      const [label, kbd] = raw.split('|');
      const spanEl = tip.querySelector('span');
      const kbdEl = tip.querySelector('kbd');
      if (spanEl) spanEl.textContent = label || '';
      if (kbdEl) {
        kbdEl.textContent = kbd || '';
        kbdEl.style.display = kbd ? '' : 'none';
      }
      const sRect = stage.getBoundingClientRect();
      const r = host.getBoundingClientRect();
      const left = r.right - sRect.left + 10;
      const top = r.top - sRect.top + r.height / 2;
      tip.style.setProperty('--ftip-x', `${left.toFixed(1)}px`);
      tip.style.setProperty('--ftip-y', `${top.toFixed(1)}px`);
      tip.setAttribute('data-show', 'true');
    });
    document.addEventListener('pointerout', (evt) => {
      const host = evt.target && evt.target.closest ? evt.target.closest('[data-tip]:not(.ag-v2-heat-cell)') : null;
      if (!host) return;
      if (evt.relatedTarget && host.contains(evt.relatedTarget)) return;
      hideAll();
    });
    document.addEventListener('pointerdown', hideAll, { passive: true });
  }

  function patchCacheCleaner() {
    const cleaners = document.querySelectorAll('.ag-v2-inline-cleaner');
    if (!cleaners.length) {
      renderWorkbench();
      return;
    }
    const html = buildInlineCacheHtml().trim();
    cleaners.forEach((el) => {
      el.outerHTML = html;
    });
  }

  function patchUserBubble() {
    document.querySelectorAll('.ag-v2-user-text-wrap').forEach((w) => {
      w.setAttribute('data-collapsed', String(!state.userBubbleExpanded));
    });
    document.querySelectorAll('[data-action="toggle-user-bubble"]').forEach((b) => {
      b.textContent = state.userBubbleExpanded ? 'Collapse Prompt' : 'Expand Full Prompt';
    });
  }

  // Delegated zero-delay glass tooltip pill for heatmap cells (bound once globally)
  function bindHeatTooltip() {
    document.addEventListener('pointerover', (evt) => {
      const cell = evt.target && evt.target.closest ? evt.target.closest('.ag-v2-heat-cell') : null;
      if (!cell) return;
      const wrap = cell.closest('.ag-v2-heat-wrap');
      const tip = wrap ? wrap.querySelector('.ag-v2-heat-tip') : null;
      if (!tip) return;
      const [title, sub] = String(cell.getAttribute('data-tip') || '').split('|');
      tip.querySelector('strong').textContent = title || '';
      tip.querySelector('span').textContent = sub || '';
      const wrapRect = wrap.getBoundingClientRect();
      const r = cell.getBoundingClientRect();
      const half = (tip.offsetWidth || 120) / 2;
      const cx = Math.max(half, Math.min(wrapRect.width - half, r.left - wrapRect.left + r.width / 2));
      tip.style.setProperty('--tip-x', `${cx.toFixed(1)}px`);
      tip.style.setProperty('--tip-y', `${(r.top - wrapRect.top).toFixed(1)}px`);
      tip.setAttribute('data-show', 'true');
    });
    document.addEventListener('pointerout', (evt) => {
      const cell = evt.target && evt.target.closest ? evt.target.closest('.ag-v2-heat-cell') : null;
      if (!cell) return;
      const to = evt.relatedTarget && evt.relatedTarget.closest ? evt.relatedTarget.closest('.ag-v2-heat-cell') : null;
      if (to) return;
      const wrap = cell.closest('.ag-v2-heat-wrap');
      const tip = wrap ? wrap.querySelector('.ag-v2-heat-tip') : null;
      if (tip) tip.setAttribute('data-show', 'false');
    });
  }

  function syncRunningUiDom() {
    getFloatingComposerWraps().forEach((wrap) => {
      const rightBar = wrap.querySelector('.ag-v2-toolbar-right');
      if (!rightBar) return;
      const curBtn = rightBar.querySelector('[data-testid="send-button"], [data-testid="input-cancel-button"]');
      if (!curBtn) return;
      const wantRunning = state.streamPhase === 'streaming';
      const isRunningNow = curBtn.getAttribute('data-testid') === 'input-cancel-button';
      if (wantRunning !== isRunningNow) {
        curBtn.outerHTML = buildComposerActionBtnHtml(true);
      }
    });
    patchSidebarSessions(false);
  }

  function stopStreamSimulation() {
    clearInterval(streamTimerId);
    streamTimerId = 0;
    if (state.streamPhase !== 'streaming') return;
    state.streamPhase = 'done';
    state.convAuraPhase = 'complete';
    state.convAuraPhaseAt = performance.now();
    syncConvAuraDomPhase();
    convAuraControllers.forEach((c) => c.invalidate());
    if (!state.hasToolError) {
      state.thinkingOpen = false;
    }
    if (!patchChatStreamDom()) {
      syncRunningUiDom();
      syncMascotsState();
    }
  }

  function startStreamSimulation() {
    clearInterval(streamTimerId);
    // Patch in place if already in chat/effort/dashboard scene; otherwise transition to chat scene
    const needFullRender =
      state.viewMode === 'matrix' || !document.querySelector('[data-testid="conversation-view"]');
    if (needFullRender) state.scene = 'chat';
    if (state.viewMode === 'matrix') state.viewMode = 'single';
    state.streamPhase = 'streaming';
    state.convAuraPhase = 'start';
    state.convAuraPhaseAt = performance.now();
    state.thinkingOpen = true;
    state.streamWordProgress = 1;
    if (needFullRender) {
      withViewTransition(renderWorkbench);
    } else {
      syncConvAuraDomPhase();
      convAuraControllers.forEach((c) => c.invalidate());
      patchChatStreamDom({ resetProse: true });
    }

    streamTimerId = setInterval(() => {
      // Pause stream cadence while tab is hidden and resume when visible
      if (document.hidden) return;
      if (state.streamWordProgress < STREAM_FULL_PARAGRAPHS.length) {
        state.streamWordProgress += 1;
        if (!patchChatStreamDom()) renderWorkbench();
      } else {
        clearInterval(streamTimerId);
        streamTimerId = 0;
        state.streamPhase = 'done';
        state.convAuraPhase = 'complete';
        state.convAuraPhaseAt = performance.now();
        syncConvAuraDomPhase();
        convAuraControllers.forEach((c) => c.invalidate());
        // Collapse thinking chain only after turn completes; keep open on error
        if (!state.hasToolError) {
          state.thinkingOpen = false;
        }
        if (!patchChatStreamDom()) renderWorkbench();
        // Turn complete: mascots celebrate (or show concern on error)
        notifyMascots('streamDone', { error: state.hasToolError });
      }
    }, 720);
  }

  function setMotionLevel(nextLv, sourceBtn = null) {
    if (nextLv !== 'off' && nextLv !== 'subtle' && nextLv !== 'standard' && nextLv !== 'ultra') return;
    const prevGlide = document.querySelector('[data-motion-glide="true"]');
    const prevRect = prevGlide ? prevGlide.getBoundingClientRect() : null;
    const grp = sourceBtn ? sourceBtn.closest('[role="group"]') : null;
    const prevGrpBtn = grp ? grp.querySelector('[data-active="true"]') : null;
    const prevGrpRect = prevGrpBtn ? prevGrpBtn.getBoundingClientRect() : null;

    state.motionLevel = nextLv;
    applyTokenStylesToStages();
    syncTopbarControls();
    syncInspectorControls();
    for (const ctrl of rippleControllers) ctrl.invalidate();
    for (const ctrl of convAuraControllers) ctrl.invalidate();

    document.querySelectorAll('[data-testid="studio-motion-tier-tabs"]').forEach((tabs) => {
      tabs.querySelectorAll('[data-wb-motion]').forEach((b) => {
        const active = b.getAttribute('data-wb-motion') === nextLv;
        b.setAttribute('data-active', String(active));
        const existing = b.querySelector('[data-motion-glide]');
        if (active && !existing) {
          const span = document.createElement('span');
          span.className = 'ag-v2-seg-glide-bg';
          span.setAttribute('data-motion-glide', 'true');
          span.setAttribute('aria-hidden', 'true');
          b.insertBefore(span, b.firstChild);
        } else if (!active && existing) {
          existing.remove();
        }
      });
    });

    if ((nextLv === 'standard' || nextLv === 'ultra') && !prefersReducedMotion()) {
      const nextGlide = document.querySelector('[data-motion-glide="true"]');
      const nextBtn = nextGlide ? nextGlide.closest('[data-wb-motion]') : null;
      if (prevRect && nextGlide && nextBtn) {
        runGlide(nextGlide, prevRect, nextBtn.getBoundingClientRect());
      } else if (grp && sourceBtn && prevGrpBtn && prevGrpBtn !== sourceBtn && prevGrpRect) {
        runGlide(sourceBtn, prevGrpRect, sourceBtn.getBoundingClientRect());
      }
    }
  }

  function triggerHeroDemo(kind) {
    const me = globalThis.__agMotionEngine;
    if (kind === 'liftoff') {
      if (state.motionLevel !== 'ultra') setMotionLevel('ultra');
      const homeBox = document.querySelector('.ag-v2-studio-home [data-testid="agent-input-box"], [data-testid="agent-input-box"]');
      const oldRect = homeBox ? homeBox.getBoundingClientRect() : null;
      rippleControllers.forEach((c) => c.triggerLiftoffBurst(0.5, 0.62));

      document.querySelectorAll('.ag-cs-liftoff-veil').forEach((n) => n.remove());
      const veil = document.createElement('div');
      veil.className = 'ag-cs-liftoff-veil';
      veil.setAttribute('aria-hidden', 'true');
      veil.style.setProperty('--ag-lift-x', oldRect && oldRect.width > 0 ? `${Math.round(oldRect.left + oldRect.width / 2)}px` : '50%');
      veil.style.setProperty('--ag-lift-y', oldRect && oldRect.height > 0 ? `${Math.round(oldRect.top + oldRect.height / 2)}px` : '58%');
      const ring = document.createElement('div');
      ring.className = 'ag-cs-liftoff-ring';
      veil.appendChild(ring);
      document.body.appendChild(veil);
      setTimeout(() => veil.remove(), 540);

      state.scene = 'chat';
      if (state.viewMode === 'matrix') state.viewMode = 'single';
      state.openPopover = null;
      state.liftoffEbbAt = performance.now();
      state.convAuraPhase = 'start';
      state.convAuraPhaseAt = state.liftoffEbbAt;
      renderWorkbench();

      const newBox = document.querySelector('[data-testid="agent-input-box"]');
      if (newBox && me && typeof me.spring === 'function') {
        const nr = newBox.getBoundingClientRect();
        const rawDy = oldRect && nr ? Math.round(oldRect.top - nr.top) : -160;
        const dy = Math.max(-420, Math.min(-24, rawDy === 0 ? -150 : rawDy));
        me.spring(newBox, [{ transform: `translateY(${dy}px) scale(0.985)` }, { transform: 'translateY(0) scale(1)' }], {
          durationMs: 480,
          stiffness: 310,
          damping: 28,
          slot: 'wb-liftoff-dock',
        });
      }
      const bubble = document.querySelector('[data-testid="user-message-bubble"]');
      if (bubble) {
        bubble.setAttribute('data-ag-cs-liftoff-bubble', '1');
        setTimeout(() => bubble.removeAttribute('data-ag-cs-liftoff-bubble'), 500);
      }
      return;
    }

    if (kind === 'caustic') {
      if (state.motionLevel !== 'ultra') setMotionLevel('ultra');
      const targets = document.querySelectorAll('[data-testid="agent-input-box"], [data-testid="code-block-container"]');
      targets.forEach((el) => {
        el.removeAttribute('data-ag-cs-caustic');
        void el.offsetWidth;
        el.setAttribute('data-ag-cs-caustic', '1');
        setTimeout(() => el.removeAttribute('data-ag-cs-caustic'), 920);
      });
      notifyMascots('streamDone', { error: false });
      return;
    }

    if (kind === 'fiber') {
      if (state.motionLevel !== 'ultra') setMotionLevel('ultra');
      const cycle = ['orchestrator', 'gemini-4-carbon', 'claude-4.6-opus', 'gpt-oss-120b'];
      const nextIdx = (cycle.indexOf(state.activeModelId) + 1) % cycle.length;
      state.activeModelId = cycle[nextIdx];
      syncComposerTriggerDom();
      syncInspectorControls();
      const brand = getModelBrand(getActiveModel());
      document.querySelectorAll('[data-testid="agent-input-box"]').forEach((box) => {
        box.removeAttribute('data-ag-cs-fiber-camp');
        void box.offsetWidth;
        box.setAttribute('data-ag-cs-fiber-camp', brand);
        setTimeout(() => box.removeAttribute('data-ag-cs-fiber-camp'), 480);
      });
      if (me && typeof me.spring === 'function') {
        document.querySelectorAll('[data-composer-model-glyph="true"]').forEach((gl) => {
          me.spring(
            gl,
            [{ transform: 'scale(0.84) rotate(-8deg)' }, { transform: 'scale(1.14) rotate(3deg)' }, { transform: 'scale(1) rotate(0deg)' }],
            { stiffness: 420, damping: 22, slot: 'wb-fiber-focus' }
          );
        });
      }
      return;
    }

    if (kind === 'dual-stream') {
      if (state.motionLevel !== 'ultra') setMotionLevel('ultra');
      startStreamSimulation();
    }
  }

  function triggerOverlayDemo(kind) {
    if (kind === 'slash') {
      state.openPopover = null;
      state.overlayDemo = state.overlayDemo === 'slash' ? null : 'slash';
      state.mascotYieldMode = state.overlayDemo === 'slash' ? 'peek' : 'none';
      swapPopovers();
      swapOverlay();
      return;
    }

    if (kind === 'takeover') {
      state.openPopover = null;
      if (state.overlayDemo === 'takeover') {
        state.overlayDemo = null;
        state.mascotYieldMode = 'none';
      } else {
        state.overlayDemo = 'takeover';
        state.mascotYieldMode = 'leap';
      }
      swapPopovers();
      swapOverlay();
    }
  }

  function bindGlobalEvents() {
    window.addEventListener('pointermove', (evt) => {
      schedulePrismUpdate(evt.clientX, evt.clientY);
      markUserActivity();
    });
    window.addEventListener('keydown', (evt) => {
      markUserActivity();

      // Ctrl+K / Cmd+K: auto-expand sidebar, reveal search input, and focus
      if ((evt.ctrlKey || evt.metaKey) && !evt.altKey && evt.key && evt.key.toLowerCase() === 'k') {
        evt.preventDefault();
        if (state.sidebarCollapsed) setSidebarCollapsed(false);
        setSidebarSearchOpen(true, true);
        return;
      }

      // Press `[` when focus is outside an input to toggle sidebar collapse
      if (evt.key === '[' && !evt.ctrlKey && !evt.metaKey && !evt.altKey) {
        const t = evt.target;
        const isEditable =
          t &&
          (t.tagName === 'INPUT' ||
            t.tagName === 'TEXTAREA' ||
            t.tagName === 'SELECT' ||
            t.isContentEditable ||
            (t.closest && t.closest('[contenteditable="true"]')));
        if (!isEditable) {
          evt.preventDefault();
          setSidebarCollapsed(!state.sidebarCollapsed);
        }
      }
    });
    window.addEventListener('pointerleave', () => {
      schedulePrismUpdate(-9999, -9999);
    });
    document.addEventListener('mouseout', (evt) => {
      if (!evt.relatedTarget) {
        schedulePrismUpdate(-9999, -9999);
      }
    });
    window.addEventListener('blur', () => {
      clearTimeout(blurTimeoutId);
      blurTimeoutId = setTimeout(() => {
        windowBlurredLong = true;
      }, 30000);
    });
    window.addEventListener('focus', () => {
      clearTimeout(blurTimeoutId);
      windowBlurredLong = false;
    });

    // Hover laser spotlight sync between right layer rows / minimal bar and left sapphire tube
    document.addEventListener('pointerover', (evt) => {
      const row = evt.target && evt.target.closest ? evt.target.closest('[data-layer-slice]') : null;
      if (row) {
        const idx = parseInt(row.getAttribute('data-layer-slice'), 10);
        if (state.hoveredSlice !== idx) {
          state.hoveredSlice = Number.isFinite(idx) ? idx : -1;
          applyHoveredSliceDom();
        }
      }
    });
    document.addEventListener('pointerout', (evt) => {
      const row = evt.target && evt.target.closest ? evt.target.closest('[data-layer-slice]') : null;
      if (row && (!evt.relatedTarget || !row.contains(evt.relatedTarget))) {
        const list = row.closest('.ag-v2-layer-list, .ag-v2-ctx-bar-track');
        if (list && (!evt.relatedTarget || !list.contains(evt.relatedTarget))) {
          state.hoveredSlice = -1;
          applyHoveredSliceDom();
        }
      }
    });

    // Listen for typing in sidebar search filter OR composer input
    document.addEventListener('input', (evt) => {
      const target = evt.target;
      if (target && target.getAttribute && target.getAttribute('data-testid') === 'sidebar-search-input') {
        state.sidebarSearchQuery = target.value || '';
        patchSidebarSessions(false);
        return;
      }
      if (!target || !target.classList || !target.classList.contains('ag-v2-composer-input')) return;
      mascotControllers.forEach((mc) => mc.rig.onUserType(target.textContent || ''));
      const text = (target.textContent || '').trim();
      if (text.startsWith('/') && state.overlayDemo !== 'slash') {
        state.openPopover = null;
        state.overlayDemo = 'slash';
        state.mascotYieldMode = 'peek';
        // Insert slash menu in place without rebuilding composer so caret and focus remain intact
        swapPopovers();
        swapOverlay();
      }
    });

    document.addEventListener('keyup', (evt) => {
      const target = evt.target;
      if (target && target.getAttribute && target.getAttribute('data-testid') === 'sidebar-search-input') {
        if (evt.key === 'Escape') {
          if (state.sidebarSearchQuery) {
            state.sidebarSearchQuery = '';
            patchSidebarSessions(true);
          }
          setSidebarSearchOpen(false, false);
          target.blur();
        }
        return;
      }
      if (!target || !target.classList || !target.classList.contains('ag-v2-composer-input')) return;
      if (evt.key === 'Escape' && state.overlayDemo === 'slash') {
        state.overlayDemo = null;
        state.mascotYieldMode = 'none';
        swapOverlay();
      }
    });

    document.addEventListener('click', (evt) => {
      const viewBtn = evt.target.closest('[data-wb-view]');
      if (viewBtn) {
        state.viewMode = viewBtn.getAttribute('data-wb-view');
        if (state.viewMode === 'matrix' || state.viewMode === 'quad') {
          state.openPopover = null;
          state.overlayDemo = null;
        }
        withViewTransition(renderWorkbench);
        return;
      }

      const sceneBtn = evt.target.closest('[data-wb-scene]');
      if (sceneBtn) {
        const nextScene = sceneBtn.getAttribute('data-wb-scene');
        state.scene = nextScene;
        if (state.viewMode === 'matrix') state.viewMode = 'single';
        state.overlayDemo = null;
        state.mascotYieldMode = 'none';
        if (nextScene === 'effort' && state.viewMode !== 'quad') state.openPopover = 'effort';
        else if (nextScene === 'dashboard' && state.viewMode !== 'quad') state.openPopover = 'dashboard';
        else state.openPopover = null;
        withViewTransition(renderWorkbench);
        return;
      }

      const presetBtn = evt.target.closest('[data-wb-preset]');
      if (presetBtn) {
        const pid = presetBtn.getAttribute('data-wb-preset');
        if (pid === 'obsidian-dark') {
          state.tokens.palette = 'obsidian';
          state.tokens.theme = 'dark';
        } else if (pid === 'warm-dark') {
          state.tokens.palette = 'warm';
          state.tokens.theme = 'dark';
        } else if (pid === 'daylight-crystal') {
          state.tokens.palette = 'obsidian';
          state.tokens.theme = 'light';
          state.tokens.lightPreset = 'crystal';
        } else if (pid === 'warm-alabaster') {
          state.tokens.palette = 'warm';
          state.tokens.theme = 'light';
          state.tokens.lightPreset = 'alabaster';
        }
        if (state.viewMode === 'quad') state.viewMode = 'single';
        withViewTransition(renderWorkbench);
        return;
      }

      const lightPresetBtn = evt.target.closest('[data-wb-light-preset]');
      if (lightPresetBtn) {
        const lp = lightPresetBtn.getAttribute('data-wb-light-preset') === 'alabaster' ? 'alabaster' : 'crystal';
        state.tokens.lightPreset = lp;
        state.tokens.palette = lp === 'alabaster' ? 'warm' : 'obsidian';
        if (state.viewMode === 'single' && state.tokens.theme !== 'light') {
          state.tokens.theme = 'light';
        }
        withViewTransition(renderWorkbench);
        return;
      }

      const paletteBtn = evt.target.closest('[data-wb-palette]');
      if (paletteBtn) {
        const rawPalette = paletteBtn.getAttribute('data-wb-palette');
        state.tokens.palette = rawPalette === 'warm' ? 'warm' : rawPalette === 'titanium' ? 'titanium' : 'obsidian';
        if (state.tokens.palette === 'warm') state.tokens.lightPreset = 'alabaster';
        else if (state.tokens.palette === 'obsidian') state.tokens.lightPreset = 'crystal';
        applyTokenStylesToStages();
        syncTopbarControls();
        syncInspectorControls();
        for (const ctrl of rippleControllers) ctrl.invalidate();
        for (const ctrl of convAuraControllers) ctrl.invalidate();
        return;
      }

      const motionBtn = evt.target.closest('[data-wb-motion]');
      if (motionBtn) {
        setMotionLevel(motionBtn.getAttribute('data-wb-motion'), motionBtn);
        return;
      }

      const heroDemoBtn = evt.target.closest('[data-hero-demo]');
      if (heroDemoBtn) {
        triggerHeroDemo(heroDemoBtn.getAttribute('data-hero-demo'));
        return;
      }

      const themeBtn = evt.target.closest('[data-wb-theme]');
      if (themeBtn && !themeBtn.disabled) {
        state.tokens.theme = themeBtn.getAttribute('data-wb-theme') === 'light' ? 'light' : 'dark';
        withViewTransition(renderWorkbench);
        return;
      }

      if (evt.target.closest('#wb-toggle-inspector')) {
        state.inspectorOpen = !state.inspectorOpen;
        syncTopbarControls();
        return;
      }

      const mascotBtn = evt.target.closest('[data-mascot-cmd]');
      if (mascotBtn) {
        const cmd = mascotBtn.getAttribute('data-mascot-cmd');
        if (cmd === 'pile') {
          state.mascotMiniPile = !state.mascotMiniPile;
          syncMascotsState();
          syncInspectorControls();
        } else if (cmd === 'idle') {
          clearInterval(streamTimerId);
          streamTimerId = 0;
          state.streamPhase = 'done';
          state.overlayDemo = null;
          state.mascotYieldMode = 'none';
          mascotControllers.forEach((mc) => mc.rig.triggerDemo('unstack'));
          syncRunningUiDom();
          syncMascotsState();
        } else if (cmd === 'write') {
          startStreamSimulation();
        } else {
          // Mini-crab interaction requires enabling the mini crab pile first
          if ((cmd === 'crabRide' || cmd === 'crabChase') && !state.mascotMiniPile) {
            state.mascotMiniPile = true;
            syncMascotsState();
            syncInspectorControls();
          }
          mascotControllers.forEach((mc) => mc.rig.triggerDemo(cmd));
        }
        return;
      }

      const overlayBtn = evt.target.closest('[data-overlay-demo]');
      if (overlayBtn) {
        triggerOverlayDemo(overlayBtn.getAttribute('data-overlay-demo'));
        return;
      }

      const vialBtn = evt.target.closest('[data-vial-cmd]');
      if (vialBtn) {
        const cmd = vialBtn.getAttribute('data-vial-cmd');
        if (cmd === 'open') {
          state.openPopover = 'dashboard';
          if (state.viewMode === 'matrix') {
            state.viewMode = 'single';
            withViewTransition(renderWorkbench);
          } else {
            swapPopovers();
          }
        } else if (cmd === 'mode') {
          const nextMode = !state.contextVialEnabled;
          if (state.viewMode !== 'matrix' && state.openPopover !== 'dashboard') {
            state.contextVialEnabled = nextMode;
            state.openPopover = 'dashboard';
            swapPopovers();
            syncContextVialUiControls();
          } else {
            setContextVialEnabled(nextMode);
          }
        } else if (cmd === 'slosh') {
          if (!state.contextVialEnabled) setContextVialEnabled(true);
          if (state.openPopover !== 'dashboard' && state.viewMode !== 'matrix') {
            state.openPopover = 'dashboard';
            renderWorkbench();
          }
          for (const v of vialControllers) v.impulse(2.1);
        } else if (cmd === 'drop') {
          if (!state.contextVialEnabled) setContextVialEnabled(true);
          if (state.openPopover !== 'dashboard' && state.viewMode !== 'matrix') {
            state.openPopover = 'dashboard';
            renderWorkbench();
          }
          for (const v of vialControllers) v.spawnDroplet();
        } else if (cmd === 'stream') {
          state.vialStreaming = !state.vialStreaming;
          renderWorkbench();
        } else if (cmd === 'critical') {
          state.vialCritical = !state.vialCritical;
          renderWorkbench();
          for (const v of vialControllers) v.impulse(1.4);
          requestAnimationFrame(() => notifyMascots('critical', { on: state.vialCritical }));
        } else if (cmd === 'camp') {
          const cur = getActiveModel();
          state.activeModelId = cur.camp === 'claude' ? 'gemini-4-carbon' : 'claude-4.6-opus';
          if (state.viewMode !== 'matrix') state.openPopover = 'dashboard';
          renderWorkbench();
        } else if (cmd === 'fallback') {
          state.sampleSimMode =
            state.sampleSimMode === 'ok' ? 'fallback' : state.sampleSimMode === 'fallback' ? 'unreliable' : 'ok';
          if (state.viewMode !== 'matrix') state.openPopover = 'dashboard';
          renderWorkbench();
        }
        return;
      }

      // Send button: launch spring feedback + ignite prism surge + lead mascot salute & partner nod
      const sendBtn = evt.target.closest('[data-testid="send-button"]');
      if (sendBtn) {
        triggerAnimIcon(sendBtn, 'launch');
        state.convAuraPhase = 'start';
        state.convAuraPhaseAt = performance.now();
        syncConvAuraDomPhase();
        convAuraControllers.forEach((c) => c.invalidate());
        notifyMascots('send');
        return;
      }

      const actionEl = evt.target.closest('[data-action]');
      if (!actionEl) return;
      const action = actionEl.getAttribute('data-action');

      if (action === 'stop-stream') {
        stopStreamSimulation();
        return;
      }

      if (action === 'toggle-sidebar') {
        setSidebarCollapsed(!state.sidebarCollapsed);
      } else if (action === 'toggle-sidebar-search') {
        const nextOpen = !state.sidebarSearchOpen;
        if (!nextOpen && state.sidebarSearchQuery) {
          state.sidebarSearchQuery = '';
          patchSidebarSessions(true);
        }
        setSidebarSearchOpen(nextOpen, nextOpen);
      } else if (action === 'clear-sidebar-search') {
        state.sidebarSearchQuery = '';
        patchSidebarSessions(true);
        setSidebarSearchOpen(false, false);
      } else if (action === 'toggle-sidebar-group') {
        const grp = actionEl.getAttribute('data-group');
        if (grp) {
          const nextCollapsed = !state.sidebarCollapsedGroups[grp];
          state.sidebarCollapsedGroups[grp] = nextCollapsed;
          document.querySelectorAll(`[data-sidebar-group="${grp}"]`).forEach((gEl) => {
            gEl.setAttribute('data-group-collapsed', String(nextCollapsed));
            const head = gEl.querySelector('.ag-v2-sidebar-group-head');
            if (head) head.setAttribute('aria-expanded', String(!nextCollapsed));
          });
        }
      } else if (action === 'cycle-workspace') {
        const workspaces = ['antigravity', 'agy-claude-style', 'obsidian-v3.5'];
        const nextIdx = (workspaces.indexOf(state.workspaceName) + 1) % workspaces.length;
        state.workspaceName = workspaces[nextIdx];
        document.querySelectorAll('[data-workspace-name="true"]').forEach((el) => {
          el.textContent = state.workspaceName;
        });
        triggerAnimIcon(actionEl, 'open');
      } else if (action === 'session-more') {
        evt.stopPropagation();
      } else if (action === 'pick-session') {
        const sc = actionEl.getAttribute('data-scene') || 'studio';
        const prevRow = document.querySelector('[data-testid="conversation-row-sidebar"][data-active="true"]');
        const prevRail = document.querySelector('.ag-v2-rail-btn[data-active="true"]');
        const prevRowRect = prevRow ? prevRow.getBoundingClientRect() : null;
        const prevRailRect = prevRail ? prevRail.getBoundingClientRect() : null;
        state.scene = sc;
        state.overlayDemo = null;
        state.mascotYieldMode = 'none';
        state.openPopover = sc === 'effort' ? 'effort' : sc === 'dashboard' ? 'dashboard' : null;
        renderWorkbench();
        if (prevRowRect) {
          const nextGlide = document.querySelector('[data-sidebar-row-glide="true"]');
          const nextRow = nextGlide ? nextGlide.closest('[data-testid="conversation-row-sidebar"]') : null;
          if (nextGlide && nextRow) runGlide(nextGlide, prevRowRect, nextRow.getBoundingClientRect());
        }
        if (prevRailRect) {
          const nextRailGlide = document.querySelector('[data-rail-glide="true"]');
          const nextRailBtn = nextRailGlide ? nextRailGlide.closest('.ag-v2-rail-btn') : null;
          if (nextRailGlide && nextRailBtn) runGlide(nextRailGlide, prevRailRect, nextRailBtn.getBoundingClientRect());
        }
      } else if (action === 'm3-pick-slash') {
        const idx = Number(actionEl.getAttribute('data-idx'));
        if (Number.isFinite(idx)) {
          state.m3ActiveSlashIdx = idx;
          renderWorkbench();
        }
      } else if (action === 'm3-diff-decision') {
        const dec = actionEl.getAttribute('data-decision');
        if (dec === 'accepted' || dec === 'rejected') {
          state.m3DiffStatus = dec;
          renderWorkbench();
        }
      } else if (action === 'm3-toggle-switch') {
        state.m3SwitchOn = !state.m3SwitchOn;
        renderWorkbench();
      } else if (action === 'm3-toast-type') {
        const tp = actionEl.getAttribute('data-toast-type');
        if (tp === 'info' || tp === 'success' || tp === 'warning' || tp === 'error') {
          state.m3ToastType = tp;
          renderWorkbench();
        }
      } else if (action === 'pick-range') {
        state.timeRange = actionEl.getAttribute('data-range') || '30d';
        patchTimeRange();
      } else if (action === 'cache-start') {
        triggerAnimIcon(actionEl, 'sweep');
        clearTimeout(state.cacheTimerId);
        state.cacheCleanStep = 'confirm';
        state.cacheTimerId = setTimeout(() => {
          if (state.cacheCleanStep === 'confirm') {
            state.cacheCleanStep = 'idle';
            patchCacheCleaner();
          }
        }, 4000);
        patchCacheCleaner();
      } else if (action === 'cache-confirm') {
        clearTimeout(state.cacheTimerId);
        state.cacheCleanStep = 'done';
        patchCacheCleaner();
      } else if (action === 'cache-cancel' || action === 'cache-reset') {
        clearTimeout(state.cacheTimerId);
        state.cacheCleanStep = 'idle';
        patchCacheCleaner();
      } else if (action === 'toggle-thinking') {
        state.thinkingOpen = !state.thinkingOpen;
        if (!patchChatStreamDom()) renderWorkbench();
      } else if (action === 'toggle-user-bubble') {
        state.userBubbleExpanded = !state.userBubbleExpanded;
        patchUserBubble();
      } else if (action === 'replay-stream') {
        startStreamSimulation();
      } else if (action === 'toggle-tool-error') {
        state.hasToolError = !state.hasToolError;
        if (state.hasToolError) state.thinkingOpen = true;
        if (!patchChatStreamDom()) renderWorkbench();
      } else if (action === 'toggle-effort-pop') {
        const hadOverlay = Boolean(state.overlayDemo);
        state.overlayDemo = null;
        state.mascotYieldMode = 'none';
        state.openPopover = state.openPopover === 'effort' ? null : 'effort';
        swapPopovers();
        if (hadOverlay) swapOverlay();
      } else if (action === 'toggle-orchestrator') {
        const hadOverlay = Boolean(state.overlayDemo);
        state.overlayDemo = null;
        state.mascotYieldMode = 'none';
        state.activeModelId = state.activeModelId === 'orchestrator' ? 'gemini-4-carbon' : 'orchestrator';
        if (state.openPopover === 'effort' && getFloatingComposerWraps().length) {
          // Popover already open: crossfade slider <-> crystal bar in place and trigger optical wake
          syncComposerTriggerDom();
          sliderControllers.forEach((sl) => sl.notify());
        } else {
          state.openPopover = 'effort';
          swapPopovers();
          syncComposerTriggerDom();
          if (state.activeModelId === 'orchestrator') {
            crystalControllers.forEach((c) => typeof c.wake === 'function' && c.wake());
          }
        }
        if (hadOverlay) swapOverlay();
      } else if (action === 'toggle-dash-pop') {
        const hadOverlay = Boolean(state.overlayDemo);
        state.overlayDemo = null;
        state.mascotYieldMode = 'none';
        state.openPopover = state.openPopover === 'dashboard' ? null : 'dashboard';
        swapPopovers();
        if (hadOverlay) swapOverlay();
      } else if (action === 'toggle-takeover') {
        triggerOverlayDemo('takeover');
      } else if (action === 'reroll-takeover') {
        state.mascotYieldMode = state.mascotYieldMode === 'leap' ? 'peek' : 'leap';
        swapOverlay();
      } else if (action === 'close-overlay') {
        state.overlayDemo = null;
        state.mascotYieldMode = 'none';
        swapOverlay();
      } else if (action === 'pick-model') {
        state.activeModelId = actionEl.getAttribute('data-model-id');
        // In-place update without destroying the open menu or resetting slider spring
        syncComposerTriggerDom();
        sliderControllers.forEach((sl) => sl.notify());
      } else if (action === 'set-telemetry-mod') {
        state.telemetryModule = actionEl.getAttribute('data-mod-val') || 'auto';
        renderWorkbench();
      } else if (action === 'set-slider-mod') {
        state.effortSliderModule = actionEl.getAttribute('data-mod-val') || 'auto';
        renderWorkbench();
      } else if (action === 'toggle-serif') {
        state.tokens.editorialSerif = !state.tokens.editorialSerif;
        applyTokenStylesToStages();
        syncInspectorControls();
        actionEl.setAttribute('data-on', String(state.tokens.editorialSerif));
      } else if (action === 'toggle-ripple') {
        state.rippleEnabled = !state.rippleEnabled;
        renderWorkbench();
      } else if (action === 'toggle-prism') {
        state.tokens.prismStrength = state.tokens.prismStrength > 0 ? 0 : 1;
        applyTokenStylesToStages();
        syncInspectorControls();
        actionEl.setAttribute('data-on', String(state.tokens.prismStrength > 0));
      } else if (action === 'toggle-mini-pile') {
        state.mascotMiniPile = !state.mascotMiniPile;
        syncMascotsState();
        syncInspectorControls();
        actionEl.setAttribute('data-on', String(state.mascotMiniPile));
      } else if (action === 'toggle-context-vial') {
        setContextVialEnabled(!state.contextVialEnabled);
      } else if (action === 'copy-code') {
        const codeCard = actionEl.closest('.ag-v2-code-card');
        const codeText = codeCard ? codeCard.querySelector('pre')?.textContent || '' : '';
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(codeText).catch(() => {});
        }
        // Animated stroke checkmark feedback: morph copy icon -> check and restore after 1.6s
        triggerAnimIcon(actionEl, 'check', { revertAfterMs: 1600 });
        const label = actionEl.querySelector('[data-copy-label]');
        actionEl.setAttribute('data-copied', 'true');
        if (label) label.textContent = 'Copied';
        clearTimeout(actionEl.__copyTimer);
        actionEl.__copyTimer = setTimeout(() => {
          actionEl.removeAttribute('data-copied');
          if (label) label.textContent = 'Copy';
        }, 1600);
      }
    });

    // Live Inspector sliders
    const bindRange = (id, key, parser) => {
      const el = document.getElementById(id);
      if (!el) return;
      el.addEventListener('input', () => {
        state.tokens[key] = parser(el.value);
        applyTokenStylesToStages();
        syncInspectorControls();
        if (key === 'prismStrength') {
          rippleControllers.forEach((ctrl) => ctrl.invalidate());
          convAuraControllers.forEach((ctrl) => ctrl.invalidate());
        }
      });
    };
    bindRange('ctrl-radius', 'radiusBase', (v) => parseInt(v, 10));
    bindRange('ctrl-prism', 'prismStrength', (v) => parseFloat(v));
    bindRange('ctrl-specular', 'specularAlpha', (v) => parseFloat(v));
    bindRange('ctrl-border', 'borderAlpha', (v) => parseFloat(v));
    bindRange('ctrl-blur', 'glassBlur', (v) => parseInt(v, 10));
    bindRange('ctrl-lh', 'proseLineHeight', (v) => parseFloat(v));
    bindRange('ctrl-grain', 'grainAlpha', (v) => parseFloat(v));

    const serifBtn = document.getElementById('ctrl-serif');
    if (serifBtn) {
      serifBtn.addEventListener('click', () => {
        state.tokens.editorialSerif = !state.tokens.editorialSerif;
        applyTokenStylesToStages();
        syncInspectorControls();
      });
    }

    const showToast = (msg) => {
      const el = document.getElementById('wb-toast');
      if (!el) return;
      el.textContent = msg;
      setTimeout(() => {
        if (el.textContent === msg) el.textContent = '';
      }, 2400);
    };

    const saveBtn = document.getElementById('wb-save-tokens');
    if (saveBtn) {
      saveBtn.addEventListener('click', async () => {
        try {
          const res = await fetch('/api/tokens', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(state.tokens),
          });
          if (!res.ok) throw new Error('HTTP ' + res.status);
          showToast('Saved preset to design-tokens.json ✓');
        } catch (err) {
          showToast('Save failed: ' + (err && err.message ? err.message : 'unknown'));
        }
      });
    }

    const copyBtn = document.getElementById('wb-copy-css');
    if (copyBtn) {
      copyBtn.addEventListener('click', async () => {
        const t = state.tokens;
        const cssSnippet = [
          `/* AGY Obsidian Prism Preset (${t.palette} / ${t.theme}) */`,
          `--ag-v2-radius: ${t.radiusBase}px;`,
          `--ag-prism-strength: ${t.prismStrength ?? 1};`,
          `--ag-v2-specular: ${t.specularAlpha};`,
          `--ag-v2-border-alpha: ${t.borderAlpha};`,
          `--ag-v2-glass-blur: ${t.glassBlur}px;`,
          `--ag-v2-prose-lh: ${t.proseLineHeight};`,
          `--ag-v2-grain-alpha: ${t.grainAlpha};`,
          `/* editorialSerif: ${t.editorialSerif} */`,
        ].join('\n');
        try {
          await navigator.clipboard.writeText(cssSnippet);
          showToast('Copied CSS variable block ✓');
        } catch {
          showToast('Generated CSS variables (clipboard restricted)');
        }
      });
    }

    const resetBtn = document.getElementById('wb-reset-tokens');
    if (resetBtn) {
      resetBtn.addEventListener('click', () => {
        state.tokens = { ...DEFAULT_TOKENS };
        renderWorkbench();
        showToast('Restored factory default tokens');
      });
    }
  }

  function applyUrlParams() {
    const params = new URLSearchParams(window.location.search);
    const view = params.get('view');
    const scene = params.get('scene');
    const palette = params.get('palette');
    const theme = params.get('theme');
    const lightPreset = params.get('lightPreset') || params.get('preset');
    if (view === 'single' || view === 'split' || view === 'quad' || view === 'matrix') state.viewMode = view;
    if (scene === 'studio' || scene === 'chat' || scene === 'effort' || scene === 'dashboard' || scene === 'settings' || scene === 'm3lab') {
      state.scene = scene;
      if (scene === 'effort' && state.viewMode !== 'quad') state.openPopover = 'effort';
      if (scene === 'dashboard' && state.viewMode !== 'quad') state.openPopover = 'dashboard';
    }
    if (palette === 'obsidian' || palette === 'titanium' || palette === 'warm') state.tokens.palette = palette;
    if (theme === 'dark' || theme === 'light') state.tokens.theme = theme;
    if (lightPreset === 'crystal' || lightPreset === 'alabaster') state.tokens.lightPreset = lightPreset;
    if (params.get('stream') === '1' || params.get('streaming') === '1') {
      state.streamPhase = 'streaming';
      state.convAuraPhase = 'running';
      state.thinkingOpen = true;
      state.streamWordProgress = 2;
    }
    const auraParam = params.get('aura');
    if (auraParam === 'idle' || auraParam === 'start' || auraParam === 'running' || auraParam === 'complete') {
      state.convAuraPhase = auraParam;
      state.convAuraPhaseAt = performance.now();
    }
    const motionParam = params.get('motion');
    if (motionParam === 'off' || motionParam === 'subtle' || motionParam === 'standard' || motionParam === 'ultra') {
      state.motionLevel = motionParam;
    }
  }

  function exposeTestHooks() {
    globalThis.__wbTestApi = {
      getMotionLevel() {
        return state.motionLevel;
      },
      setMotionLevel(lv) {
        setMotionLevel(lv);
      },
      getLightPreset() {
        return state.tokens.lightPreset || 'crystal';
      },
      setLightPreset(lp) {
        state.tokens.lightPreset = lp === 'alabaster' ? 'alabaster' : 'crystal';
        state.tokens.theme = 'light';
        state.tokens.palette = state.tokens.lightPreset === 'alabaster' ? 'warm' : 'obsidian';
        renderWorkbench();
      },
      setViewMode(vm) {
        if (vm === 'single' || vm === 'split' || vm === 'quad' || vm === 'matrix') {
          state.viewMode = vm;
          renderWorkbench();
        }
      },
      getPerfSleepState() {
        const snap = updatePerfSleepIndicators(performance.now());
        return {
          masterSleeping,
          masterFrameTicks,
          ...snap,
        };
      },
      triggerHeroDemo(kind) {
        triggerHeroDemo(kind);
        wakeMasterLoop();
      },
      getRippleState() {
        return rippleControllers.map((c) => c.getWaveState());
      },
      getConvAuraState() {
        return {
          phase: state.convAuraPhase,
          controllers: convAuraControllers.length,
          sleeping: convAuraControllers.every((c) => (typeof c.isSleeping === 'function' ? c.isSleeping() : true)),
        };
      },
      setConvAuraPhase(phase) {
        if (phase === 'idle' || phase === 'start' || phase === 'running' || phase === 'complete') {
          state.convAuraPhase = phase;
          state.convAuraPhaseAt = performance.now();
          syncConvAuraDomPhase();
          const now = performance.now();
          convAuraControllers.forEach((c) => c.step(now, true));
          wakeMasterLoop();
        }
      },
      getMascotSnapshot() {
        return mascotControllers.map((m) => m.rig.getLayoutSnapshot());
      },
      triggerMascotDemo(cmd) {
        mascotControllers.forEach((m) => m.rig.triggerDemo(cmd));
      },
      simulateInputChar(text) {
        mascotControllers.forEach((m) => m.rig.onUserType(text));
      },
      pokeMascot(id = 'cat') {
        mascotControllers.forEach((m) => {
          if (typeof m.rig.poke === 'function') m.rig.poke(id);
        });
      },
      getVialState() {
        return vialControllers.map((v) => v.getDebugState());
      },
      getCrystalState() {
        return crystalControllers.map((c) => c.getDebugState());
      },
      spawnVialDroplet() {
        vialControllers.forEach((v) => v.spawnDroplet());
      },
      sloshVial(strength = 2.0) {
        vialControllers.forEach((v) => v.impulse(strength));
      },
      setMiniPile(on) {
        state.mascotMiniPile = Boolean(on);
        syncMascotsState();
        syncInspectorControls();
      },
      setContextVial(on) {
        setContextVialEnabled(Boolean(on));
      },
      getContextVialEnabled() {
        return Boolean(state.contextVialEnabled);
      },
      setHoveredSlice(idx) {
        state.hoveredSlice = idx;
        applyHoveredSliceDom();
      },
      toggleSidebar(collapsed) {
        setSidebarCollapsed(typeof collapsed === 'boolean' ? collapsed : !state.sidebarCollapsed);
      },
      setSidebarSearchOpen(open) {
        setSidebarSearchOpen(Boolean(open), Boolean(open));
      },
      getSidebarState() {
        return {
          collapsed: Boolean(state.sidebarCollapsed),
          searchOpen: Boolean(state.sidebarSearchOpen),
          searchQuery: state.sidebarSearchQuery,
          workspace: state.workspaceName,
        };
      },
      startStream() {
        startStreamSimulation();
      },
      stopStream() {
        stopStreamSimulation();
      },
      inspectMascot(opts) {
        return mascotControllers.map((m) => (typeof m.rig.inspectPose === 'function' ? m.rig.inspectPose(opts) : null));
      },
      stepMascotTick(delta = 1) {
        return mascotControllers.map((m) => (typeof m.rig.stepTick === 'function' ? m.rig.stepTick(delta) : 0));
      },
    };
  }

  function bindMascotInspectorControls() {
    const poseSel = document.getElementById('wb-inspect-pose');
    const toggleBtn = document.getElementById('btn-inspect-toggle');
    const prevBtn = document.getElementById('btn-inspect-prev');
    const nextBtn = document.getElementById('btn-inspect-next');
    const mirrorBtn = document.getElementById('btn-inspect-mirror');
    const rulerBtn = document.getElementById('btn-inspect-ruler');
    const blurBtn = document.getElementById('btn-sim-win-blur');
    const habBtn = document.getElementById('btn-habitat-cycle');
    const sqwInput = document.getElementById('ctrl-inspect-sqw');
    const sqhInput = document.getElementById('ctrl-inspect-sqh');
    const tickVal = document.getElementById('val-inspect-tick');
    const sqwVal = document.getElementById('val-inspect-sqw');
    const sqhVal = document.getElementById('val-inspect-sqh');
    if (!poseSel || !toggleBtn) return;

    const inspect = { active: false, pose: 'idle', tick: 0, mirror: false, ruler: false, sqW: 0, sqH: 0, blur: false };
    const fillPoses = () => {
      const rig = mascotControllers[0]?.rig;
      const list = rig && typeof rig.listPoses === 'function' ? rig.listPoses() : ['idle'];
      if (poseSel.options.length === list.length) return;
      poseSel.innerHTML = '';
      for (const p of list) {
        const opt = document.createElement('option');
        opt.value = p;
        opt.textContent = p;
        poseSel.appendChild(opt);
      }
      poseSel.value = inspect.pose;
    };
    const apply = () => {
      fillPoses();
      if (tickVal) tickVal.textContent = `Tick ${inspect.tick}`;
      if (sqwVal) sqwVal.textContent = String(inspect.sqW);
      if (sqhVal) sqhVal.textContent = String(inspect.sqH);
      toggleBtn.textContent = `Lock Inspect: ${inspect.active ? 'On' : 'Off'}`;
      if (mirrorBtn) mirrorBtn.textContent = `Mirror: ${inspect.mirror ? 'On' : 'Off'}`;
      if (rulerBtn) rulerBtn.textContent = `y=9 Ruler: ${inspect.ruler ? 'On' : 'Off'}`;
      if (blurBtn) blurBtn.textContent = `Blur 0fps: ${inspect.blur ? 'On' : 'Off'}`;
      mascotControllers.forEach((m) => {
        if (typeof m.rig.inspectPose === 'function') {
          m.rig.inspectPose(inspect.active ? { ...inspect } : { active: false });
        }
      });
    };

    poseSel.addEventListener('change', () => {
      inspect.pose = poseSel.value;
      inspect.active = true;
      apply();
    });
    toggleBtn.addEventListener('click', () => {
      inspect.active = !inspect.active;
      apply();
    });
    prevBtn?.addEventListener('click', () => {
      inspect.active = true;
      inspect.tick = Math.max(0, inspect.tick - 1);
      apply();
    });
    nextBtn?.addEventListener('click', () => {
      inspect.active = true;
      inspect.tick += 1;
      apply();
    });
    mirrorBtn?.addEventListener('click', () => {
      inspect.active = true;
      inspect.mirror = !inspect.mirror;
      apply();
    });
    rulerBtn?.addEventListener('click', () => {
      inspect.active = true;
      inspect.ruler = !inspect.ruler;
      apply();
    });
    blurBtn?.addEventListener('click', () => {
      inspect.blur = !inspect.blur;
      if (inspect.blur) document.documentElement.setAttribute('data-ag-cs-win-blur', '1');
      else document.documentElement.removeAttribute('data-ag-cs-win-blur');
      mascotControllers.forEach((m) => m.rig.notify('host-sleep', { sleep: inspect.blur }));
      apply();
    });
    const habModes = [
      ['auto', 'Auto'],
      ['cactus', 'Day Cactus'],
      ['lamp', 'Night Lamp'],
      ['hourglass', 'Hourglass'],
    ];
    let habIdx = 0;
    habBtn?.addEventListener('click', () => {
      habIdx = (habIdx + 1) % habModes.length;
      const [mode, label] = habModes[habIdx];
      habBtn.textContent = `Habitat: ${label}`;
      mascotControllers.forEach((m) => m.rig.setHabitatPreview?.(mode));
    });
    sqwInput?.addEventListener('input', () => {
      inspect.active = true;
      inspect.sqW = Number(sqwInput.value) || 0;
      apply();
    });
    sqhInput?.addEventListener('input', () => {
      inspect.active = true;
      inspect.sqH = Number(sqhInput.value) || 0;
      apply();
    });
    fillPoses();
  }

  async function init() {
    try {
      const res = await fetch('/api/tokens', { cache: 'no-store' });
      if (res.ok) {
        const loaded = await res.json();
        state.tokens = { ...DEFAULT_TOKENS, ...loaded };
      }
    } catch {}

    hydrateShellIcons();
    syncMotionSpringTokens();
    if (globalThis.__agMotionEngine && typeof globalThis.__agMotionEngine.bindMicroInteractions === 'function') {
      globalThis.__agMotionEngine.bindMicroInteractions(document);
    }

    applyUrlParams();
    exposeTestHooks();
    bindGlobalEvents();
    bindHeatTooltip();
    bindStageTooltips();
    renderWorkbench();
    bindMascotInspectorControls();

    try {
      const es = new EventSource('/api/events');
      es.addEventListener('reload', () => {
        window.location.reload();
      });
    } catch {}
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();
