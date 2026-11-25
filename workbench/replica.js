/* ==========================================================================
   Antigravity v2.34+ 1:1 Host Mirror Controller (workbench/replica.js)
   - Hydrates 17 authentic Antigravity SVG icons from local .gitignore mirror
   - Renders exact native Tailwind DOM classes consumed by /api/host-mirror/native.css
   - Toggles Native Antigravity <-> Live Compiled Obsidian Prism via <script> tags
   ========================================================================== */
(function () {
  'use strict';

  const FALLBACK_SVG = {
    appLogo: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M12 2.2c.23 0 .43.16.49.38c.19.72.44 1.43.73 2.11c1.13 2.62 3.1 4.6 5.73 5.73c.68.29 1.39.54 2.11.73c.22.06.38.26.38.49s-.16.43-.38.49a15 15 0 0 0-2.11.73c-2.63 1.13-4.6 3.11-5.73 5.73c-.29.68-.54 1.39-.73 2.11a.5.5 0 0 1-.49.38a.5.5 0 0 1-.49-.38a15 15 0 0 0-.73-2.11c-1.13-2.62-3.1-4.6-5.73-5.73a15 15 0 0 0-2.11-.73a.5.5 0 0 1-.38-.49c0-.23.16-.43.38-.49c.72-.19 1.43-.44 2.11-.73c2.63-1.13 4.6-3.11 5.73-5.73c.29-.68.54-1.39.73-2.11c.06-.22.26-.38.49-.38Z" fill="currentColor"/></svg>',
    sidebarToggle: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="3" width="18" height="18" rx="3"/><line x1="9" y1="3" x2="9" y2="21"/></svg>',
    newConv: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 5v14M5 12h14"/></svg>',
    search: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>',
    automations: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',
    projectFolder: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Z"/></svg>',
    addProject: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14"/></svg>',
    settings: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="3"/></svg>',
    toggleOverview: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="3" width="18" height="18" rx="3"/><line x1="15" y1="3" x2="15" y2="21"/></svg>',
    moreActions: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/></svg>',
    composerPlus: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14"/></svg>',
    ovFiles: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/></svg>',
    ovReview: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M9 11l3 3L22 4"/></svg>',
    ovTerminal: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><polyline points="4 17 10 11 4 5"/><line x1="12" y1="19" x2="20" y2="19"/></svg>',
    ovPlugins: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="4" y="4" width="16" height="16" rx="3"/></svg>',
    ovCustomize: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="3"/></svg>',
    voiceStart: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="9" y="2" width="6" height="12" rx="3"/><path d="M5 10a7 7 0 0 0 14 0"/><line x1="12" y1="19" x2="12" y2="22"/></svg>',
    chevronDown: '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>',
    chevRight: '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 6 15 12 9 18"/></svg>',
    doubleChevDown: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><polyline points="7 7 12 12 17 7"/><polyline points="7 13 12 18 17 13"/></svg>',
    sendUp: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 19V5"/><path d="m5 12 7-7 7 7"/></svg>',
    shieldTurbo: '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>',
    branch: '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><line x1="6" y1="3" x2="6" y2="15"/><circle cx="18" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><path d="M18 9a9 9 0 0 1-9 9"/></svg>',
    pin: '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M12 17v5"/><path d="M9 10.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V16h14v-.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V7a1 1 0 0 1 1-1 2 2 0 0 0 0-4H8a2 2 0 0 0 0 4 1 1 0 0 1 1 1z"/></svg>',
    archive: '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="4" rx="1"/><path d="M5 8v10a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8"/><path d="M10 12h4"/></svg>',
    check: '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>',
    close: '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>',
    searchSm: '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>',
    sparkle: '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9L12 3z"/></svg>',
    stopSquare: '<svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="6" width="12" height="12" rx="2"/></svg>',
  };

  const SVG_NS = 'http://www.w3.org/2000/svg';
  const SVG_TAG_MAP = {
    svg: 'svg',
    g: 'g',
    path: 'path',
    circle: 'circle',
    ellipse: 'ellipse',
    rect: 'rect',
    line: 'line',
    polyline: 'polyline',
    polygon: 'polygon',
    defs: 'defs',
    lineargradient: 'linearGradient',
    radialgradient: 'radialGradient',
    stop: 'stop',
    clippath: 'clipPath',
    mask: 'mask',
    title: 'title',
  };
  const SVG_ATTR_MAP = {
    viewbox: 'viewBox',
    width: 'width',
    height: 'height',
    fill: 'fill',
    'fill-rule': 'fill-rule',
    'fill-opacity': 'fill-opacity',
    'clip-rule': 'clip-rule',
    'clip-path': 'clip-path',
    stroke: 'stroke',
    'stroke-width': 'stroke-width',
    'stroke-linecap': 'stroke-linecap',
    'stroke-linejoin': 'stroke-linejoin',
    'stroke-miterlimit': 'stroke-miterlimit',
    'stroke-dasharray': 'stroke-dasharray',
    'stroke-dashoffset': 'stroke-dashoffset',
    'stroke-opacity': 'stroke-opacity',
    opacity: 'opacity',
    d: 'd',
    cx: 'cx',
    cy: 'cy',
    r: 'r',
    rx: 'rx',
    ry: 'ry',
    x: 'x',
    y: 'y',
    x1: 'x1',
    y1: 'y1',
    x2: 'x2',
    y2: 'y2',
    points: 'points',
    transform: 'transform',
    class: 'class',
    xmlns: 'xmlns',
    'aria-hidden': 'aria-hidden',
    focusable: 'focusable',
    role: 'role',
    offset: 'offset',
    'stop-color': 'stop-color',
    'stop-opacity': 'stop-opacity',
    gradientunits: 'gradientUnits',
    gradienttransform: 'gradientTransform',
    id: 'id',
    preserveaspectratio: 'preserveAspectRatio',
    color: 'color',
  };
  const SVG_UNSAFE_VAL_RE = /(?:javascript|vbscript|data)\s*:|expression\s*\(/i;
  const SVG_URL_RE = /url\s*\(([^)]*)\)/gi;

  function isSafeSvgAttrValue(attrName, val) {
    const v = String(val ?? '').trim();
    if (!v || v.length > 4096) return false;
    if (SVG_UNSAFE_VAL_RE.test(v)) return false;
    if (/url\s*\(/i.test(v)) {
      if (attrName !== 'clip-path' && attrName !== 'fill' && attrName !== 'stroke' && attrName !== 'mask') return false;
      SVG_URL_RE.lastIndex = 0;
      let m;
      while ((m = SVG_URL_RE.exec(v)) !== null) {
        const inner = m[1].trim().replace(/^['"]|['"]$/g, '');
        if (!/^#[A-Za-z0-9_-]+$/.test(inner)) return false;
      }
    }
    return true;
  }

  function cloneCleanSvgNode(srcNode, outDoc) {
    if (!srcNode || srcNode.nodeType !== 1) return null;
    const canonTag = SVG_TAG_MAP[String(srcNode.localName || srcNode.tagName || '').toLowerCase()];
    if (!canonTag) return null;
    const cleanEl = outDoc.createElementNS(SVG_NS, canonTag);
    for (const attr of Array.from(srcNode.attributes || [])) {
      const low = String(attr.name || '').toLowerCase();
      if (!low || low.startsWith('on') || low === 'style' || low === 'href' || low === 'xlink:href' || low === 'src') continue;
      const canonAttr = SVG_ATTR_MAP[low];
      if (!canonAttr) continue;
      if (!isSafeSvgAttrValue(canonAttr, attr.value)) continue;
      cleanEl.setAttribute(canonAttr, attr.value);
    }
    if (canonTag === 'title') {
      const txt = String(srcNode.textContent || '').trim();
      if (txt) cleanEl.textContent = txt.slice(0, 120);
      return cleanEl;
    }
    for (const child of Array.from(srcNode.children || [])) {
      const sub = cloneCleanSvgNode(child, outDoc);
      if (sub) cleanEl.appendChild(sub);
    }
    return cleanEl;
  }

  function parseCleanSvgElement(rawSvg, targetDoc) {
    if (typeof rawSvg !== 'string' || !rawSvg.trim() || rawSvg.length > 65536) return null;
    if (typeof DOMParser !== 'function') return null;
    try {
      const parsed = new DOMParser().parseFromString(rawSvg, 'image/svg+xml');
      if (!parsed || parsed.querySelector('parsererror')) return null;
      const rootEl = parsed.documentElement;
      if (!rootEl || String(rootEl.localName || rootEl.tagName || '').toLowerCase() !== 'svg') return null;
      return cloneCleanSvgNode(rootEl, targetDoc || document);
    } catch {
      return null;
    }
  }

  function sanitizeSvgMarkup(rawSvg) {
    const cleanEl = parseCleanSvgElement(rawSvg, document);
    if (!cleanEl) return '';
    try {
      if (typeof XMLSerializer === 'function') {
        return new XMLSerializer().serializeToString(cleanEl);
      }
      return cleanEl.outerHTML || '';
    } catch {
      return '';
    }
  }

  let hostSvgIcons = { ...FALLBACK_SVG };

  function iconHtml(name) {
    return hostSvgIcons[name] || FALLBACK_SVG[name] || '';
  }

  function hydrateStaticHostIcons() {
    document.querySelectorAll('[data-host-icon]').forEach((el) => {
      const key = el.getAttribute('data-host-icon');
      if (!key) return;
      const cleanEl = parseCleanSvgElement(iconHtml(key), document);
      if (cleanEl) el.replaceChildren(cleanEl);
      else el.replaceChildren();
    });
  }

  const CONVERSATIONS = [
    {
      id: '11111111-2222-4333-8444-555555555551',
      pinned: false,
      title: 'Primary Engineering Session',
      branch: 'feat_arch_001',
      time: '3m',
      running: false,
      turns: [
        {
          prompt: 'Build a 1:1 mirror of the Antigravity desktop host using native stylesheets and a clean DOM skeleton, with a one-click toggle between Native Host and Live Prism Injection.',
          workedFor: 'Worked for 38s',
          thought: 'Extracted native jetbox.css + compiled_tailwind.css (473 KB, local .gitignore cache) and 17 host SVG icons read-only, reproducing the exact DOM hierarchy: 35px titlebar, 256px sidebar, full-width conversation stream, top-right floating Overview card, and .surface-composer input.',
          tools: [
            { label: 'Read file', detail: 'workbench/server.cjs (L645-L692)' },
            {
              label: 'Edited',
              detail: 'style.css',
              add: 37,
              del: 15,
              diff: {
                file: 'style.css',
                additions: 37,
                deletions: 15,
                startLine: 693,
                oldText: [
                  '& [data-testid="title-menu-bar-item"]{border-radius:999px !important;}',
                  '& button[data-diff-action="accept"]{border-radius:999px !important;padding:0 11px !important;}',
                  '& [data-testid="revert-button"]{border-radius:999px !important;}',
                ].join('\n'),
                newText: [
                  '& [data-testid="title-menu-bar-item"]{border-radius:var(--ag-cs-r-sm) !important;}',
                  '& button[data-diff-action="accept"]{border-radius:var(--ag-cs-r-sm) !important;padding:0 9px !important;}',
                  '& [data-testid="revert-button"]{border-radius:var(--ag-cs-r-sm) !important;}',
                  '& .ag-cs-inline-diff-box{margin:4px 0 8px 18px;border-radius:var(--ag-cs-r-md);}',
                ].join('\n'),
              },
            },
            {
              label: 'Edited',
              detail: 'host-workbench-enhancer.js',
              add: 84,
              del: 4,
              diff: {
                file: 'host-workbench-enhancer.js',
                additions: 84,
                deletions: 4,
                startLine: 1290,
                oldText: [
                  'function sync() {',
                  '  syncCodeBlocks();',
                  '  syncNavRails();',
                  '}',
                ].join('\n'),
                newText: [
                  'function sync() {',
                  '  syncCodeBlocks();',
                  '  syncNavRails();',
                  '  syncSidebarOverflowTools(); // preserve top 3, fold extra tools into More',
                  '}',
                  'function runFastScrollToBottom(btnEl) { /* 350~540ms fast glide + wheel interrupt */ }',
                ].join('\n'),
              },
            },
            { label: 'Ran command', detail: 'npm test — 62 pass, 0 fail' },
          ],
          summary: 'This view loads authentic Antigravity stylesheets, Google Sans Flex typography, and native SVG icons. Click Native Host / Live Prism Inject in the top center pill to compare seamlessly.',
        },
        {
          prompt: 'Include interactive tool folding, Markdown tables, blockquotes, 5-tone alerts, collapsible 56-line code blocks, and code diff review cards in the conversation stream.',
          workedFor: 'Worked for 24s',
          thought: 'Embedded host-isomorphic .agy-md-table, blockquote, .markdown-alert, a 56-line code block (triggering host-workbench-enhancer folding and sticky header), and files-changed-header + .monaco-diff-editor + Accept/Reject pills.',
          tools: [],
          summary: 'Below is the full set of host-isomorphic prose details and diff review cards. Hover the 28px progress dot rail on the far left to open the interactive prompt outline popover.',
        },
        {
          prompt: 'Verify the borderless Orchestrator prism slider in the model menu, the 512K borosilicate vial, and all 9 dual-mascot slash theaters.',
          workedFor: 'Worked for 19s',
          thought: 'Wired 4-layer isomorphic React Fiber contract on the model menu for upstream-client.js, connected agPulseHost telemetry to drive the 512K vial, and enabled all 9 dual-mascot slash theaters via input commands or the control drawer.',
          tools: [],
          summary: 'Click the model selector at bottom-left to inspect the Orchestrator prism bar, or open Controls in the top pill to switch all 5 palettes, view .agy-home, trigger 86% vial warnings, blur 0fps sleep, and spawn 4-tone optical toasts.',
        },
      ],
    },
    {
      id: '11111111-2222-4333-8444-555555555552',
      pinned: false,
      title: 'Performance Optimization Session',
      branch: 'optimize_project_perf',
      time: '12m',
      running: true,
      turns: [
        {
          prompt: 'Verify the Orchestrator prism crystal bar and titanium knob remain 100% unaffected by the M3 refactor.',
          workedFor: 'Worked for 15s',
          thought: 'Verified .ces-ag-effort-row[data-ag-orch-p] and :not(.ces-knob) exemption rules.',
          tools: [],
          summary: 'The Orchestrator slider and titanium knob are fully preserved; open the bottom-left model menu to inspect live.',
        },
      ],
    },
    {
      id: '11111111-2222-4333-8444-555555555553',
      pinned: false,
      title: 'Architecture & Ecology Session',
      branch: 'carbon_architecture_blue',
      time: '5h',
      running: false,
      turns: [
        {
          prompt: 'Confirm the full pipeline enters 0fps sleep 1.2s after window blur and wakes instantly on focus.',
          workedFor: 'Worked for 11s',
          thought: 'Audited window-blur freeze gates across dual-mascot-rig, conv-aura, pulse-vial-bridge, and effort-slider.',
          tools: [],
          summary: 'Use Blur 0fps Sim or Vial 86% Warning inside Controls to test directly.',
        },
      ],
    },
    {
      id: '11111111-2222-4333-8444-555555555554',
      pinned: false,
      title: 'Chat Module Navigation Session',
      branch: 'sidebar_studio_develop',
      time: '7h',
      running: false,
      turns: [
        {
          prompt: 'Verify that switching sidebar sessions updates data-cascade-id and resets the outline filter query.',
          workedFor: 'Worked for 9s',
          thought: 'Each sidebar session carries its own data-cascade-id and syncs immediately on switch.',
          tools: [],
          summary: 'Switch sessions in the sidebar and hover the 28px left rail to verify outline sync and automatic filter reset.',
        },
      ],
    },
  ];

  const SLASH_COMMANDS = [
    { cmd: '/plan', desc: 'Unfold pixel blueprint and step-by-step architecture plan', kbd: 'P' },
    { cmd: '/goal', desc: 'Tie on the focus headband for long-horizon goal mode', kbd: 'G' },
    { cmd: '/boost', desc: 'Deep multi-perspective problem solving with 4-color prism crystals', kbd: 'B' },
    { cmd: '/teamwork', desc: 'Raise the banner to summon a mini-crab multi-agent swarm', kbd: 'T' },
    { cmd: '/browser', desc: 'Surf the web in sunglasses for live browser automation', kbd: 'W' },
    { cmd: '/compact', desc: 'Compress context clouds together to reclaim token headroom', kbd: 'C' },
    { cmd: '/schedule', desc: 'Set a watch hourglass for recurring or scheduled tasks', kbd: 'S' },
    { cmd: '/grill-me', desc: 'Spotlight interview to pressure-test requirements and edge cases', kbd: 'Q' },
    { cmd: '/learn', desc: 'Review notes and light up insights to persist long-term lessons', kbd: 'L' },
  ];

  const MODEL_CATALOG = [
    {
      label: 'Orchestrator (Gemini 4 Neon High)',
      short: 'Orchestrator',
      isOrchestrator: true,
      efforts: ['low', 'medium', 'high'],
      effortLabels: {
        low: 'Orchestrator (Gemini 4 Neon Low)',
        medium: 'Orchestrator (Gemini 4 Neon Medium)',
        high: 'Orchestrator (Gemini 4 Neon High)',
      },
      modelId: 'orchestrator-neon',
    },
    {
      label: 'Gemini 4 Carbon (High)',
      short: 'Gemini 4 Carbon',
      efforts: ['low', 'medium', 'high'],
      effortLabels: {
        low: 'Gemini 4 Carbon (Low)',
        medium: 'Gemini 4 Carbon (Medium)',
        high: 'Gemini 4 Carbon (High)',
      },
      modelId: 'gemini-4-carbon',
    },
    {
      label: 'Gemini 4 Hydrogen (Extra)',
      short: 'Gemini 4 Hydrogen',
      efforts: ['low', 'medium', 'high', 'xhigh'],
      effortLabels: {
        low: 'Gemini 4 Hydrogen (Low)',
        medium: 'Gemini 4 Hydrogen (Medium)',
        high: 'Gemini 4 Hydrogen (High)',
        xhigh: 'Gemini 4 Hydrogen (Extra)',
      },
      modelId: 'gemini-4-hydrogen',
    },
    {
      label: 'Claude Opus 4.6 (High)',
      short: 'Claude Opus 4.6',
      efforts: ['low', 'medium', 'high'],
      effortLabels: {
        low: 'Claude Opus 4.6 (Low)',
        medium: 'Claude Opus 4.6 (Medium)',
        high: 'Claude Opus 4.6 (High)',
      },
      modelId: 'claude-opus-4-6',
    },
    {
      label: 'GPT-OSS 120B (Medium)',
      short: 'GPT-OSS 120B (Medium)',
      efforts: ['medium'],
      effortLabels: { medium: 'GPT-OSS 120B (Medium)' },
      modelId: 'gpt-oss-120b',
    },
  ];

  const LONG_SAMPLE_CODE = Array.from({ length: 56 }, (_, i) => {
    const ln = String(i + 1).padStart(2, '0');
    if (i === 0) return `// Obsidian Prism — Host Tonal & Cascade Sync Sample (56 lines -> triggers real Fold button)`;
    if (i === 1) return `export function syncCascadeTonalBridge(root, cascadeId, palette) {`;
    if (i === 2) return `  const tonalVars = ['--ag-cs-tonal-0', '--ag-cs-tonal-1', '--ag-cs-tonal-2', '--ag-cs-tonal-3', '--ag-cs-tonal-4'];`;
    if (i === 54) return `  return { cascadeId, palette, synced: tonalVars.length, idleFps: 0 };`;
    if (i === 55) return `}`;
    return `  const step_${ln} = root.getAttribute('data-ag-cs-palette') || palette; // line ${ln} optical guard`;
  }).join('\n');

  const urlParams = new URLSearchParams(window.location.search);

  const PERM_MODES = [
    { id: 'turbo', label: 'Turbo', desc: 'Automatically run commands and edit files; ask only for high-risk external or system actions.' },
    { id: 'auto', label: 'Balanced', desc: 'Allow routine file reads/writes automatically with lightweight confirmation before shell execution.' },
    { id: 'ask', label: 'Ask', desc: 'Show an approval card before every file modification or terminal command.' },
  ];

  const sim = {
    prismOn: urlParams.get('prism') === '1',
    hostTheme: urlParams.get('theme') === 'light' ? 'light' : 'dark',
    view: urlParams.get('view') === 'home' ? 'home' : urlParams.get('view') === 'history' ? 'history' : 'conv',
    historyQuery: '',
    activeConvId: CONVERSATIONS[0].id,
    sidebarCollapsed: false,
    overviewOpen: true,
    terminalOpen: false,
    drawerOpen: false,
    modelMenuOpen: false,
    permMenuOpen: urlParams.get('perm') === '1',
    permMode: 'turbo',
    slashMenuOpen: false,
    slashActiveIdx: 0,
    fastpickOpen: false,
    settingsOpen: false,
    settingsTab: 'appearance',
    streaming: false,
    vialHigh: false,
    winBlurSim: false,
    diffExpanded: urlParams.get('diff') === '1',
    floatKitOpen: urlParams.get('floatkit') === '1',
    diffStatus: 'pending',
    sheetSwitchOn: true,
    toastCycleIdx: 0,
    selectedModelLabel: MODEL_CATALOG[0].label,
    mirrorLive: false,
    prismCfg: {
      palette: urlParams.get('palette') || 'obsidian',
      lightPreset: urlParams.get('lightPreset') || 'crystal',
      corners: urlParams.get('corners') || 'balanced',
      scrollBottomMotion: urlParams.get('scroll') === 'instant' ? 'instant' : 'smooth',
      motionLevel: 'ultra',
      accentTone: 'follow',
      mascotMiniPile: false,
      homeLayout: 'studio',
      telemetryModule: 'on',
      effortSliderModule: 'on',
      language: urlParams.get('lang') === 'ar' ? 'ar' : 'en',
    },
    injectBusy: false,
  };

  function esc(str) {
    return String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function getActiveConv() {
    return CONVERSATIONS.find((c) => c.id === sim.activeConvId) || CONVERSATIONS[0];
  }

  function getSelectedModelEntry() {
    for (const m of MODEL_CATALOG) {
      if (m.label === sim.selectedModelLabel || Object.values(m.effortLabels).includes(sim.selectedModelLabel)) {
        return m;
      }
    }
    return MODEL_CATALOG[0];
  }

  // ── 1. Host Read-Only Shims ───────────────────────────────────────────────
  function buildMetricsSnapshot() {
    const frac = sim.vialHigh ? 0.86 : 0.42;
    const used = Math.round(512000 * frac);
    return {
      connection: 'live',
      collection: { state: sim.streaming ? 'processing' : 'idle' },
      speed: {
        tps: sim.streaming ? 95.6 : 88.4,
        latestTps: sim.streaming ? 95.6 : 88.4,
        ttftSeconds: 0.42,
        rounds: 14,
        cacheHitRate: 0.948,
        cache: { hitRate: 0.948, totalTokens: 1620000 },
        taskUsage: { subagents: 6, total: { totalTokens: 1620000 }, own: { totalTokens: 1180000 }, delegated: { totalTokens: 440000 } },
        context: {
          usedTokens: used,
          maxTokens: 512000,
          usedFraction: frac,
          model: sim.selectedModelLabel,
          sampledAt: sim.streaming ? new Date().toISOString() : '2026-11-21T03:30:00Z',
          layers: {
            system: Math.round(used * 0.16),
            history: Math.round(used * 0.56),
            tools: Math.round(used * 0.28),
          },
        },
      },
      quotas: [
        { id: 'five-hour', label: '5h Window', remainingPct: sim.vialHigh ? 18 : 78, resetInSec: 9420 },
        { id: 'weekly', label: 'Weekly Pool', remainingPct: 64, resetInSec: 342000 },
      ],
    };
  }

  function installHostShims() {
    window.__agPrismMetricsCall = (raw) => {
      let id = 0;
      try { id = JSON.parse(String(raw || '{}')).id; } catch {}
      setTimeout(() => {
        try { window.__agPrismMetricsResolve?.(id, buildMetricsSnapshot()); } catch {}
      }, 0);
    };
    window.agPulseHost = {
      getMetrics: async () => buildMetricsSnapshot(),
      getLatestSnapshot: () => buildMetricsSnapshot(),
      getPreferences: async () => ({ language: sim.prismCfg.language || 'en' }),
      setPreferences: async (v) => v || {},
      report: () => {},
    };
    window.__agPrismMetricsBridge = {
      __prismOwned: true,
      getMetrics: async () => buildMetricsSnapshot(),
      getLatestSnapshot: () => buildMetricsSnapshot(),
    };
    window.__agPrismUsageBridge = {
      getOverview: async () => ({
        ok: true,
        totals: { tokens: 3560000, messages: 1284, sessions: 48, hours: 36.4, cacheHitRate: 0.869 },
        topModel: 'Gemini 4 Carbon',
        daily: Array.from({ length: 182 }, (_, idx) => ({
          date: new Date(Date.now() - (181 - idx) * 86400000).toISOString().slice(0, 10),
          tokens: ((idx * 37) % 11) * 14500,
          messages: ((idx * 13) % 9) + 1,
        })),
        models: [
          { name: 'Gemini 4 Carbon', tokens: 1890000, share: 0.53 },
          { name: 'Claude Opus 4.6', tokens: 1020000, share: 0.29 },
          { name: 'Gemini 4 Hydrogen', tokens: 650000, share: 0.18 },
        ],
      }),
      listSummaries: async () => ({ ok: true, items: [] }),
    };
    window.__agPrismConfigWrite = (patch) => {
      if (!patch || typeof patch !== 'object') return;
      Object.assign(sim.prismCfg, patch);
      if (patch.palette === 'warm') sim.prismCfg.lightPreset = 'alabaster';
      if (sim.prismOn) void applyPrismInjection();
      syncControlUI();
    };
  }

  // ── 2. Authentic 4-Layer React Fiber Contract for Live Effort Slider ──────
  function buildMockFiberContext() {
    const modelOptions = [];
    const effortIndex = new Map();
    const orchestratorPlanners = [];
    const orchestratorPlannerIndex = new Map();

    for (const m of MODEL_CATALOG) {
      const groupArr = [];
      for (const ef of m.efforts) {
        const lbl = m.effortLabels[ef];
        const opt = {
          label: lbl,
          model: `${m.modelId}-${ef}`,
          effort: ef,
          isOrchestrator: Boolean(m.isOrchestrator),
        };
        groupArr.push(opt);
        if (m.isOrchestrator) orchestratorPlanners.push(opt);
        else modelOptions.push(opt);
      }
      if (m.isOrchestrator) {
        orchestratorPlannerIndex.set(m.short, groupArr);
        for (const opt of groupArr) orchestratorPlannerIndex.set(opt.label, groupArr);
      } else {
        effortIndex.set(m.short, groupArr);
        for (const opt of groupArr) effortIndex.set(opt.label, groupArr);
      }
    }
    const orchOption = {
      label: sim.selectedModelLabel.startsWith('Orchestrator') ? sim.selectedModelLabel : MODEL_CATALOG[0].label,
      model: 'orchestrator',
      isOrchestrator: true,
    };
    modelOptions.unshift(orchOption);

    const onChangeLabel = (nextLabel) => {
      if (!nextLabel) return;
      sim.selectedModelLabel = String(nextLabel);
      const trigText = document.getElementById('ag-model-trigger-label');
      if (trigText) trigText.textContent = sim.selectedModelLabel;
      renderModelMenuRows();
      attachFiberToModelPanel();
      if (window.__agClaudeStyle && typeof window.__agClaudeStyle.sync === 'function') {
        window.__agClaudeStyle.sync();
      }
    };

    const selectedOpt =
      modelOptions.find((o) => o.label === sim.selectedModelLabel) ||
      orchestratorPlanners.find((o) => o.label === sim.selectedModelLabel) ||
      orchOption;

    const fGlobal = {
      memoizedProps: {
        value: {
          setModelConfigByLabelForConversation: (_cid, label) => onChangeLabel(label),
          modelOptions,
          orchestratorPlanners,
          orchestratorDefaultPlanner: orchestratorPlanners[orchestratorPlanners.length - 1],
          orchestratorPlannerIndex,
        },
      },
      return: null,
    };
    const fConv = { memoizedProps: { conversationId: sim.activeConvId, placement: 'top-start' }, return: fGlobal };
    const fPopover = {
      memoizedProps: {
        open: sim.modelMenuOpen,
        setIsOpen: (v) => {
          sim.modelMenuOpen = Boolean(v);
          syncComposerPopovers();
        },
        setSelectedModel: (m) => onChangeLabel(typeof m === 'string' ? m : m && m.label),
        modelOptions,
        selectedModel: selectedOpt,
      },
      return: fConv,
    };
    return {
      memoizedProps: {
        value: {
          effortIndex,
          modelOptions,
          selectedModel: selectedOpt,
          orchestratorPlanners,
          orchestratorDefaultPlanner: orchestratorPlanners[orchestratorPlanners.length - 1],
          orchestratorPlannerIndex,
          groups: [],
        },
      },
      return: fPopover,
    };
  }

  function attachFiberToModelPanel() {
    const panel = document.getElementById('ag-model-panel');
    if (panel) panel.__reactFiber$replica = buildMockFiberContext();
  }

  // ── 3. Zero-Eval Dynamic Injection / Removal via <script> ─────────────────
  function runScriptUrl(url) {
    return new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = url;
      s.async = false;
      s.onload = () => { s.remove(); resolve(); };
      s.onerror = () => { s.remove(); reject(new Error('Failed to load ' + url)); };
      document.head.appendChild(s);
    });
  }

  async function applyPrismRemoval() {
    if (sim.injectBusy) return;
    sim.injectBusy = true;
    try {
      await runScriptUrl('/api/prism-remove.js?t=' + Date.now());
      syncHostThemeClasses();
    } catch (err) {
      console.error('[Replica] remove error:', err);
    } finally {
      sim.injectBusy = false;
      syncControlUI();
    }
  }

  async function applyPrismInjection() {
    if (sim.injectBusy) return;
    sim.injectBusy = true;
    try {
      await runScriptUrl('/api/prism-remove.js?t=' + Date.now());
      syncHostThemeClasses();
      const qs = new URLSearchParams();
      for (const [k, v] of Object.entries(sim.prismCfg)) {
        qs.set(k, typeof v === 'boolean' ? (v ? '1' : '0') : String(v));
      }
      qs.set('t', String(Date.now()));
      await runScriptUrl('/api/prism-inject.js?' + qs.toString());
      if (window.__agClaudeStyle && typeof window.__agClaudeStyle.sync === 'function') {
        window.__agClaudeStyle.sync();
      }
      if (sim.winBlurSim) document.documentElement.setAttribute('data-ag-cs-win-blur', '1');
    } catch (err) {
      console.error('[Replica] inject error:', err);
    } finally {
      sim.injectBusy = false;
      syncControlUI();
    }
  }

  function syncHostThemeClasses() {
    const isLight = sim.hostTheme === 'light';
    document.body.className = isLight
      ? 'theme-standalone light light-theme theme-light'
      : 'theme-standalone dark dark-theme theme-dark';
    document.body.setAttribute('data-agy-theme', isLight ? 'light' : 'dark');
    document.body.setAttribute('data-agy-font', 'google-sans');
    const root = document.getElementById('ag-replica-root');
    if (root) {
      root.classList.toggle('dark', !isLight);
      root.classList.toggle('light', isLight);
    }
    if (sim.prismOn) {
      document.documentElement.setAttribute('data-ag-cs-theme', isLight ? 'light' : 'dark');
      if (window.__agClaudeStyle && typeof window.__agClaudeStyle.sync === 'function') {
        window.__agClaudeStyle.sync();
      }
    }
  }

  // ── 4. Renderers (Authentic Antigravity Tailwind Classes & Original SVGs) ─
  function renderSidebar() {
    const sb = document.getElementById('ag-sidebar-pane');
    if (sb) sb.setAttribute('data-collapsed', String(sim.sidebarCollapsed));
    const expandBtn = document.getElementById('ag-header-expand-sb');
    if (expandBtn) expandBtn.style.display = sim.sidebarCollapsed ? 'inline-flex' : 'none';

    const buildRow = (c) => {
      const sel = sim.view === 'conv' && c.id === sim.activeConvId;
      const isRun = Boolean(c.running || (sel && sim.streaming));
      return `
        <div role="button" tabindex="0" data-testid="conversation-row-sidebar" data-selected="${sel}" data-conv-id="${c.id}" data-sim-action="pick-conv"
          class="relative w-full select-none cursor-pointer rounded-lg flex flex-row justify-between agy-sidebar-row group pr-2 py-1.5 items-start hover:bg-sidebar-muted ${sel ? 'bg-sidebar-secondary text-foreground' : 'text-secondary-foreground'}" style="padding-left:22px;">
          <div class="flex flex-col min-w-0 flex-1">
            <div class="flex items-center justify-between gap-2 min-w-0">
              <span class="text-[12.5px] leading-snug truncate ${sel ? 'font-medium text-foreground' : 'text-secondary-foreground group-hover:text-foreground'}">${esc(c.title)}</span>
              ${
                isRun
                  ? '<span data-testid="status-loading-spinner" class="inline-flex items-center shrink-0"><span data-agent-state-dot="true" class="w-1.5 h-1.5 rounded-full bg-primary inline-block"></span></span>'
                  : `<span class="text-[11px] text-muted-foreground shrink-0 tabular-nums">${esc(c.time)}</span>`
              }
            </div>
            ${
              c.branch
                ? `<span class="text-[11px] text-muted-foreground/80 flex items-center gap-1 mt-0.5 truncate">${iconHtml('branch')}<span class="truncate">${esc(c.branch)}</span></span>`
                : ''
            }
          </div>
          <div class="agy-row-actions">
            <button type="button" data-testid="conversation-pin-button" class="agy-button agy-button-icon-sm inline-flex items-center justify-center w-5 h-5 rounded border-none bg-transparent text-muted-foreground hover:text-foreground hover:bg-secondary cursor-pointer" title="Pin conversation">${iconHtml('pin')}</button>
            <button type="button" data-testid="conversation-archive-button" class="agy-button agy-button-icon-sm inline-flex items-center justify-center w-5 h-5 rounded border-none bg-transparent text-muted-foreground hover:text-foreground hover:bg-secondary cursor-pointer" title="Archive conversation">${iconHtml('archive')}</button>
          </div>
        </div>`;
    };

    const pinnedHost = document.getElementById('ag-pinned-list');
    const projHost = document.getElementById('ag-project-list');
    if (pinnedHost) pinnedHost.innerHTML = CONVERSATIONS.filter((c) => c.pinned).map(buildRow).join('');
    if (projHost) projHost.innerHTML = CONVERSATIONS.filter((c) => !c.pinned).map(buildRow).join('');
  }

  function renderModelMenuRows() {
    const panel = document.getElementById('ag-model-panel');
    if (!panel) return;
    const activeEntry = getSelectedModelEntry();
    const rowsHtml = MODEL_CATALOG.map((m) => {
      const sel = m.modelId === activeEntry.modelId;
      const tid = m.isOrchestrator ? 'model-selector-orchestrator' : 'model-selector-item';
      const displayLabel = sel ? sim.selectedModelLabel : m.label;
      return `
        <button type="button" role="menuitem" data-testid="${tid}" data-selected="${sel}" data-model-pick="${esc(displayLabel)}"
          class="w-full px-2.5 py-1.5 rounded-lg border-none bg-transparent hover:bg-secondary text-foreground text-sm flex items-center justify-between gap-2 cursor-pointer text-left ${sel ? 'bg-secondary font-medium' : ''}">
          <span class="truncate">${esc(displayLabel)}</span>
          <span class="text-xs text-muted-foreground shrink-0 inline-flex items-center">${sel ? iconHtml('check') : iconHtml('chevRight')}</span>
        </button>`;
    }).join('');
    panel.innerHTML = `
      ${rowsHtml}
      <div class="h-px bg-border my-1 mx-1.5"></div>
      <button type="button" role="menuitem" data-sim-action="toggle-vial-high"
        class="w-full px-2.5 py-1.5 rounded-lg border-none bg-transparent hover:bg-secondary text-secondary-foreground hover:text-foreground text-sm flex items-center justify-between gap-2 cursor-pointer text-left">
        <span>View Usage (512K Context)</span>
        <span class="text-xs text-muted-foreground tabular-nums">${sim.vialHigh ? '86%' : '42%'}</span>
      </button>`;
    attachFiberToModelPanel();
  }

  function syncComposerPopovers() {
    const slot = document.getElementById('ag-composer-popovers');
    if (!slot) return;
    slot.innerHTML = '';

    if (sim.slashMenuOpen) {
      const sm = document.createElement('div');
      sm.className = 'ag-slash-popover';
      sm.setAttribute('data-testid', 'slash-command-menu');
      sm.id = 'ag-slash-menu';
      sm.setAttribute('role', 'listbox');
      sm.innerHTML = SLASH_COMMANDS.map(
        (s, i) => `
          <button type="button" role="option" ${i === sim.slashActiveIdx ? 'data-selected="true" data-highlighted=""' : ''} aria-selected="${i === sim.slashActiveIdx}" data-sim-slash-pick="${esc(s.cmd)}"
            class="agy-overlay-item w-full px-2.5 py-1.5 rounded-lg border-none bg-transparent hover:bg-secondary text-foreground text-sm flex items-center justify-between gap-2 cursor-pointer text-left">
            <span class="truncate"><strong>${esc(s.cmd)}</strong> <span class="text-muted-foreground ml-1.5 text-xs">${esc(s.desc)}</span></span>
            <span class="agy-shortcut-keycap">${esc(s.kbd)}</span>
          </button>`
      ).join('');
      slot.appendChild(sm);
    }

    if (sim.modelMenuOpen) {
      const wrap = document.createElement('div');
      wrap.className = 'ag-popover-surface';
      wrap.setAttribute('data-radix-popper-content-wrapper', '');
      const panel = document.createElement('div');
      panel.setAttribute('data-testid', 'model-selector-panel');
      panel.id = 'ag-model-panel';
      panel.setAttribute('role', 'menu');
      panel.className = 'w-full flex flex-col gap-0.5';
      wrap.appendChild(panel);
      slot.appendChild(wrap);
      renderModelMenuRows();
    }

    if (sim.permMenuOpen) {
      const pm = document.createElement('div');
      pm.className = 'agy-overlay ag-perm-popover rounded-xl border border-border bg-card shadow-2xl flex flex-col gap-0.5 p-1.5';
      pm.setAttribute('data-testid', 'permissions-menu');
      pm.setAttribute('role', 'menu');
      pm.innerHTML = PERM_MODES.map((m) => {
        const checked = sim.permMode === m.id;
        return `
          <button type="button" role="menuitemradio" aria-checked="${checked}" data-perm-tone="${esc(m.id)}" data-sim-perm="${esc(m.id)}"
            class="agy-overlay-item w-full px-2.5 py-2 border-none bg-transparent text-left cursor-pointer flex items-start justify-between gap-2">
            <div class="flex flex-col min-w-0 flex-1 gap-0.5">
              <div class="text-xs font-medium text-foreground">${esc(m.label)}</div>
              <div class="text-[11px] text-muted-foreground leading-snug">${esc(m.desc)}</div>
            </div>
            <span class="text-primary shrink-0 pt-0.5 inline-flex items-center">${checked ? iconHtml('check') : ''}</span>
          </button>`;
      }).join('');
      slot.appendChild(pm);
    }

    const trigger = document.querySelector('[data-testid="model-selector-trigger"]');
    if (trigger) trigger.setAttribute('aria-expanded', String(sim.modelMenuOpen));
    const permTrigger = document.querySelector('[data-testid="permissions-selector-trigger"]');
    if (permTrigger) permTrigger.setAttribute('aria-expanded', String(sim.permMenuOpen));

    if (sim.prismOn && window.__agClaudeStyle && typeof window.__agClaudeStyle.sync === 'function') {
      window.__agClaudeStyle.sync();
      setTimeout(() => window.__agClaudeStyle.sync(), 30);
    }
  }

  function buildComposerHtml() {
    return `
      <div class="ag-composer-shell">
        <div data-testid="agent-input-box" class="flex flex-col w-full shrink-0 relative">
          <div id="ag-composer-popovers"></div>

          <div class="surface-composer relative flex flex-col p-px rounded-2xl bg-border">
            <div class="surface-composer-card relative z-[1] flex flex-col gap-0 p-1 rounded-[calc(theme(borderRadius.2xl)-1px)] bg-card">
              <div class="relative w-full">
                <div class="ag-composer-editable" id="ag-composer-input" role="combobox" contenteditable="true" spellcheck="false" data-placeholder="Ask anything, @ to mention, / for workflows..."></div>
              </div>

              <div class="agy-composer-footer @container/input-footer flex w-full items-center justify-between gap-1 p-0.5" data-testid="input-box-bottom-toolbar">
                <div class="flex min-w-0 flex-1 items-center gap-0">
                  <button type="button" aria-haspopup="menu" aria-expanded="false" data-sim-action="toggle-slash-menu" title="Add context or /slash workflow"
                    class="p-1.5 rounded-full text-secondary-foreground hover:bg-secondary hover:text-foreground border-none bg-transparent cursor-pointer inline-flex items-center justify-center w-7 h-7">
                    ${iconHtml('composerPlus')}
                  </button>
                  <input type="file" class="hidden" />
                  <div class="flex items-center gap-0 min-w-0">
                    <div class="flex items-center gap-1 min-w-0">
                      <button type="button" data-testid="model-selector-trigger" data-sim-action="open-model-menu" aria-expanded="${sim.modelMenuOpen}"
                        class="flex cursor-pointer items-center h-7 gap-1 rounded-full pl-2 pr-1.5 text-sm text-secondary-foreground select-none outline-none hover:bg-secondary hover:text-foreground transition-colors min-w-0 max-w-full bg-transparent border-none">
                        <span id="ag-model-trigger-label" class="truncate">${esc(sim.selectedModelLabel)}</span>
                        <span class="shrink-0 opacity-70 inline-flex">${iconHtml('chevronDown')}</span>
                      </button>
                    </div>
                  </div>
                </div>

                <div class="shrink-0 flex items-center gap-0.5">
                  <button type="button" data-testid="permissions-selector-trigger" data-ag-perm-mode="${esc(sim.permMode)}" aria-expanded="${sim.permMenuOpen}" data-sim-action="toggle-perm-menu"
                    class="flex cursor-pointer items-center h-7 gap-1 rounded-md pl-2 pr-1.5 text-sm text-secondary-foreground select-none outline-none hover:bg-secondary hover:text-foreground transition-colors shrink-0 whitespace-nowrap bg-transparent border-none">
                    <span class="shrink-0 opacity-85 inline-flex">${iconHtml('shieldTurbo')}</span>
                    <span id="ag-perm-trigger-label">${esc((PERM_MODES.find((x) => x.id === sim.permMode) || PERM_MODES[0]).label)}</span>
                    <span class="shrink-0 opacity-70 inline-flex">${iconHtml('chevronDown')}</span>
                  </button>
                  <div class="flex items-center gap-1">
                    <span data-testid="voice-live-pill" class="inline-flex items-center">
                      <button type="button" data-testid="voice-start-button" data-sim-action="spawn-toast" title="Voice input"
                        class="h-7 w-7 rounded-full flex items-center justify-center cursor-pointer select-none outline-none text-secondary-foreground hover:bg-secondary hover:text-foreground bg-transparent border-none">
                        ${iconHtml('voiceStart')}
                      </button>
                    </span>
                    ${
                      sim.streaming
                        ? `<button type="button" data-testid="input-cancel-button" data-sim-action="toggle-streaming" title="Stop generation"
                             class="bg-secondary hover:opacity-90 w-7 h-7 rounded-full cursor-pointer border-none text-foreground inline-flex items-center justify-center">${iconHtml('stopSquare')}</button>`
                        : `<button type="button" data-testid="send-button" data-sim-action="send-composer" title="Send (Enter)"
                             class="bg-primary text-primary-foreground hover:opacity-90 w-7 h-7 rounded-full cursor-pointer border-none inline-flex items-center justify-center">${iconHtml('sendUp')}</button>`
                    }
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>`;
  }

  function renderHistoryRows() {
    const list = document.getElementById('ag-history-list');
    const cnt = document.getElementById('ag-history-count');
    if (!list) return;
    const q = String(sim.historyQuery || '').trim().toLowerCase();
    const matched = CONVERSATIONS.filter(
      (c) => !q || c.title.toLowerCase().includes(q) || String(c.branch || '').toLowerCase().includes(q)
    );
    if (cnt) cnt.textContent = `${matched.length} / ${CONVERSATIONS.length} conversations`;
    if (!matched.length) {
      list.innerHTML = '<div class="py-8 text-center text-xs text-muted-foreground">No matching conversation history</div>';
      return;
    }
    list.innerHTML = matched
      .map((c, i) => {
        const sel = c.id === sim.activeConvId || (!q && i === 0);
        const dotActive = Boolean(c.running || sel);
        return `
          <div role="button" tabindex="0" data-testid="conversation-row-history" data-selected="${sel}" data-conv-id="${c.id}" data-sim-action="pick-conv"
            class="relative w-full select-none cursor-pointer flex items-center justify-between gap-4 text-sm text-secondary-foreground">
            <div class="flex items-center gap-2.5 min-w-0 flex-1">
              <span class="ag-cs-hist-dot" data-active="${dotActive ? '1' : '0'}"></span>
              <span class="font-medium text-foreground truncate">${esc(c.title)}</span>
              <span class="inline-flex items-center gap-1 text-xs text-muted-foreground/80 truncate" style="font-family:'Google Sans Code',monospace;">${iconHtml('branch')}<span>${esc(c.branch)}</span></span>
            </div>
            <div class="flex items-center gap-3 shrink-0 text-xs text-muted-foreground tabular-nums" style="font-family:'Google Sans Code',monospace;">
              <span>${c.turns.length} turns</span>
              <span>${esc(c.time)}</span>
            </div>
            <div class="agy-row-actions">
              <button type="button" data-testid="conversation-pin-button" class="agy-button agy-button-icon-sm inline-flex items-center justify-center w-6 h-6 rounded border-none bg-transparent text-muted-foreground hover:text-foreground hover:bg-secondary cursor-pointer" title="Pin">${iconHtml('pin')}</button>
              <button type="button" data-testid="conversation-archive-button" class="agy-button agy-button-icon-sm inline-flex items-center justify-center w-6 h-6 rounded border-none bg-transparent text-muted-foreground hover:text-foreground hover:bg-secondary cursor-pointer" title="Archive">${iconHtml('archive')}</button>
            </div>
          </div>`;
      })
      .join('');
  }

  function renderMainStage() {
    const host = document.getElementById('ag-stage-mount');
    const crumb = document.getElementById('ag-crumb-title');
    const ovShell = document.getElementById('ag-overview-shell');
    if (!host) return;

    if (sim.view === 'home') {
      try { window.history.replaceState(null, '', '/'); } catch {}
      if (crumb) crumb.textContent = 'New conversation';
      if (ovShell) ovShell.hidden = true;
      host.innerHTML = `
        <div class="agy-home relative flex flex-col items-center justify-center w-full h-full min-h-0 overflow-y-auto px-6 py-10 bg-background">
          <div class="w-full max-w-[48rem] flex flex-col items-center gap-6 relative z-[2]">
            <div class="flex flex-col items-center gap-3 text-center">
              <div class="text-foreground/90">${iconHtml('appLogo')}</div>
              <h1 data-testid="home-greeting" class="text-3xl font-medium tracking-tight text-foreground m-0">What can I help you build?</h1>
            </div>
            <div class="mt-auto w-full">${buildComposerHtml()}</div>
          </div>
        </div>`;
    } else if (sim.view === 'history') {
      try { window.history.replaceState(null, '', '/'); } catch {}
      if (crumb) crumb.textContent = 'History';
      if (ovShell) ovShell.hidden = true;
      host.innerHTML = `
        <div class="w-full h-full overflow-y-auto px-6 py-6 bg-background">
          <div class="ag-conv-column">
            <div class="flex items-center justify-between gap-3 pb-3 border-b border-border">
              <div class="flex items-baseline gap-2.5 min-w-0">
                <h2 class="m-0 text-sm font-semibold text-foreground">History</h2>
                <span id="ag-history-count" class="text-xs text-muted-foreground tabular-nums"></span>
              </div>
              <div class="flex items-center gap-2 shrink-0">
                <div class="ag-cs-hist-search-wrap">
                  ${iconHtml('searchSm')}
                  <input id="ag-hist-search-input" type="search" class="ag-cs-hist-search" placeholder="Filter conversation history..." value="${esc(sim.historyQuery)}" />
                </div>
                <button type="button" data-sim-action="go-conv" class="agy-button agy-button-sm px-2.5 py-1 rounded-md border border-border bg-secondary text-foreground text-xs cursor-pointer">Back to Chat</button>
              </div>
            </div>
            <div id="ag-history-list" class="flex flex-col"></div>
          </div>
        </div>`;
      renderHistoryRows();
      const hInp = document.getElementById('ag-hist-search-input');
      if (hInp) {
        hInp.addEventListener('input', () => {
          sim.historyQuery = hInp.value || '';
          renderHistoryRows();
        });
      }
    } else {
      const conv = getActiveConv();
      try { window.history.replaceState(null, '', '/c/' + conv.id); } catch {}
      if (crumb) crumb.textContent = conv.title;
      if (ovShell) ovShell.hidden = !sim.overviewOpen;

      const navDots = Array.from({ length: 12 }, (_, idx) => {
        const isLast = idx === 11;
        return `<button type="button" data-testid="conversation-navigator-turn" data-turn-index="${idx + 1}" data-active="${isLast}" class="ag-nav-dot" aria-label="Turn ${idx + 1}"></button>`;
      }).join('');

      const diffStatusLabel =
        sim.diffStatus === 'accepted' ? 'Accepted' : sim.diffStatus === 'rejected' ? 'Rejected' : 'Review';

      const turnsHtml = conv.turns
        .map((t, idx) => {
          const isRichTurn = idx === 1 || conv.turns.length === 1;
          const toolsHtml = (t.tools || [])
            .map((tl) => {
              const diffBadge = tl.diff
                ? `<span role="button" tabindex="0" data-testid="diff-line-count" data-sim-action="scroll-diff" data-ag-diff-json="${esc(JSON.stringify(tl.diff))}" title="Click in Prism mode to toggle inline diff; in Native mode scrolls to review section" class="text-xs flex flex-row gap-1 whitespace-nowrap cursor-pointer hover:bg-secondary rounded px-1.5 py-0.5 tabular-nums ml-auto"><span style="color:#4ade80;">+${tl.add}</span><span style="color:#f87171;">-${tl.del}</span></span>`
                : '';
              return `
                <div data-testid="tool-call-row" data-ag-tool-row="1" class="flex flex-row items-center gap-2 px-2.5 py-1 rounded-md bg-muted/60 border border-border/50 text-xs text-secondary-foreground">
                  <span class="font-medium text-foreground shrink-0">${esc(tl.label)}</span>
                  <span class="text-muted-foreground truncate" style="font-family:'Google Sans Code',monospace;">${esc(tl.detail)}</span>
                  ${diffBadge}
                </div>`;
            })
            .join('');

          return `
            <div data-testid="user-input-step" class="flex flex-col w-full group/user-input-step items-end gap-1 pt-6">
              <div data-testid="user-message" class="flex flex-col items-end max-w-[85%] gap-1">
                <div data-testid="user-message-bubble" class="agy-user-bubble relative flex flex-col gap-2 px-3.5 py-2.5 rounded-[calc(theme(borderRadius.xl)-1px)] bg-card border border-card-border overflow-hidden text-sm leading-relaxed text-foreground">
                  ${isRichTurn ? '<div class="agy-user-bubble-header flex items-center justify-between gap-2 -mx-3.5 -mt-2.5 mb-1"><span>Context · 2 files attached</span><span class="agy-shortcut-keycap">Wave 1</span></div>' : ''}
                  <div data-testid="user-message-content">${esc(t.prompt)}</div>
                </div>
                <div data-testid="user-message-actions" class="flex items-center gap-2 text-xs text-muted-foreground opacity-80 group-hover/user-input-step:opacity-100">
                  <button type="button" data-testid="revert-button" class="border-none bg-transparent text-muted-foreground hover:text-foreground cursor-pointer px-2 py-0.5 rounded hover:bg-secondary text-xs">Revert</button>
                  <span>#${idx + 1}</span>
                </div>
              </div>
            </div>

            <div data-testid="agent-response" class="w-full flex flex-col gap-2.5 pt-2">
              <div class="flex flex-col gap-1">
                <button type="button" data-testid="worked-for-collapsible" aria-expanded="${idx === 0}" data-sim-toggle-collapse="1"
                  class="group flex items-center gap-1.5 text-left text-sm px-2 min-h-8 py-1 rounded-lg tabular-nums select-none cursor-pointer w-full text-secondary-foreground hover:text-foreground hover:bg-muted bg-transparent border-none transition-[opacity,background-color]">
                  <span class="opacity-60 inline-flex items-center">${iconHtml('chevRight')}</span>
                  <span>${esc(t.workedFor)}</span>
                </button>
                <div class="pl-3 ml-2 border-l border-border flex flex-col gap-1.5 py-1" ${idx === 0 ? '' : 'hidden'}>
                  <button type="button" data-testid="thinking-collapsible-trigger" aria-expanded="true" data-sim-toggle-collapse="1"
                    class="group flex items-center gap-1.5 text-left text-xs px-2 min-h-7 py-1 rounded-lg select-none cursor-pointer w-full text-muted-foreground hover:text-foreground hover:bg-muted bg-transparent border-none">
                    <span>Thought Process</span>
                  </button>
                  <div class="px-2 text-xs leading-relaxed text-muted-foreground">${esc(t.thought)}</div>
                  ${toolsHtml ? `<div class="flex flex-col gap-1 px-2 pt-1">${toolsHtml}</div>` : ''}
                </div>
              </div>

              <div data-testid="planner-response-text" data-markdown-root="" class="text-[14.5px] leading-relaxed text-foreground flex flex-col gap-3 px-2 md-divider-spacing">
                <p class="m-0">${esc(t.summary)}${isRichTurn ? ' Linked files: <span class="context-scope-mention">@style.css</span> <span class="context-scope-mention">@workbench/replica.js</span>.' : ''}</p>
                ${
                  isRichTurn
                    ? `
                  <div class="markdown-frontmatter">
                    <div>wave: coverage-wave-1 · native-tokens-and-prose</div>
                    <div>palette: obsidian-neutral-cool · tonal: 5-step · blur-fps: 0</div>
                  </div>

                  <div class="md-table-bleed">
                    <div class="md-table-host" data-width-mode="column">
                      <div class="md-table-scroll overflow-x-auto">
                        <table class="md-table-el w-full border-collapse text-sm">
                          <thead>
                            <tr class="bg-card text-secondary-foreground">
                              <th class="text-left px-3 py-2 font-medium border-b border-border">Native Coverage Module</th>
                              <th class="text-left px-3 py-2 font-medium border-b border-border">Host Selectors / Tokens</th>
                              <th class="text-left px-3 py-2 font-medium border-b border-border">Verification Status</th>
                            </tr>
                          </thead>
                          <tbody>
                            <tr class="border-b border-border/60"><td class="px-3 py-2">Core Host Tokens</td><td class="px-3 py-2">--nux-radius-* / --onyx-key / --editor-diff-*</td><td class="px-3 py-2">Bridged Across 5 Themes</td></tr>
                            <tr class="border-b border-border/60"><td class="px-3 py-2">Chat Micro-Controls</td><td class="px-3 py-2">.agy-shortcut-keycap / .agy-scroll-bottom / Tooltip</td><td class="px-3 py-2">Dark &amp; Light Parity</td></tr>
                            <tr><td class="px-3 py-2">Rich Prose Surfaces</td><td class="px-3 py-2">.md-table-host / .markdown-frontmatter / task-list</td><td class="px-3 py-2">Borderless Clarity</td></tr>
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>

                  <ul class="contains-task-list m-0 p-0 list-none flex flex-col gap-1 text-sm">
                    <li class="task-list-item task-checked flex items-center"><input type="checkbox" checked readonly /><span class="task-checked-content">Bridge native Antigravity --nux-radius-*, --onyx-key, and --editor-diff-* tokens</span></li>
                    <li class="task-list-item flex items-center"><input type="checkbox" readonly /><span>Wave 2 covers Takeover approval cards, global forms, and Aux Pane / PDF SDK</span></li>
                  </ul>

                  <hr />

                  <blockquote class="m-0 pl-3.5 py-2 border-l-2 border-primary bg-muted/50 rounded-r-lg text-sm text-secondary-foreground">
                    95% calm obsidian-graphite tonal layering + 5% top-edge specular highlights and semantic prism glow; switch Native Host vs Live Prism Inject from the top pill.
                  </blockquote>

                  <div class="grid gap-2" style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;">
                    <div class="markdown-alert markdown-alert-tip rounded-lg border border-border bg-card px-3 py-2 text-xs"><strong>TIP</strong> · Hover the far-left progress rail to open the live prompt outline.</div>
                    <div class="markdown-alert markdown-alert-important rounded-lg border border-border bg-card px-3 py-2 text-xs"><strong>IMPORTANT</strong> · Right-click mascots for donuts, or Alt+click for hot coffee.</div>
                  </div>

                  <pre class="m-0">
                    <div class="border border-card-border rounded-xl bg-muted overflow-hidden">
                      <div class="border-b border-border bg-card px-3 py-1.5 flex items-center justify-between text-xs text-muted-foreground" style="font-family:'Google Sans Code',monospace;">
                        <span>host-tonal-bridge.mjs · 56 lines</span>
                        <button type="button" class="border-none bg-transparent text-muted-foreground hover:text-foreground cursor-pointer text-xs">Copy</button>
                      </div>
                      <div class="ag-code-body"><code>${esc(LONG_SAMPLE_CODE)}</code></div>
                    </div>
                  </pre>

                  <!-- Real Antigravity Compact Single-Row Changed Files Card (Click Review/Header to expand True Diff!) -->
                  <div id="ag-diff-anchor" data-testid="changed-files-card" class="flex flex-col w-full select-none rounded-xl border border-card-border bg-card overflow-hidden">
                    <div data-testid="changed-files-card-header" data-sim-action="toggle-diff-expand" class="flex items-center justify-between pl-3 p-2 files-changed-header gap-2 transition-colors duration-200 cursor-pointer hover:bg-muted">
                      <span class="text-xs text-foreground inline-flex items-center gap-2 min-w-0 truncate">
                        <span>5 files changed</span>
                        <span class="tabular-nums" style="color:#4ade80;">+1160</span>
                        <span class="tabular-nums" style="color:#f87171;">-1802</span>
                        <span class="opacity-55 inline-flex items-center">${sim.diffExpanded ? iconHtml('chevronDown') : iconHtml('chevRight')}</span>
                      </span>
                      <button type="button" data-testid="changed-files-card-review" class="shrink-0 flex items-center gap-1 px-2 py-0.5 rounded-md cursor-pointer select-none border border-border bg-muted hover:bg-secondary transition-colors text-secondary-foreground hover:text-foreground review-button text-xs">${iconHtml('ovReview')}<span>${esc(diffStatusLabel)}</span></button>
                    </div>
                    ${
                      sim.diffExpanded
                        ? `<div class="monaco-diff-editor py-1 border-t border-border">
                             <div class="ag-diff-line"><span class="ag-diff-ln">36</span><span>  '--warning', '--success', '--scrim',</span></div>
                             <div class="ag-diff-line bg-diffEditor-removedLineBackground line-delete"><span class="ag-diff-ln">37</span><span>- <span class="bg-diffEditor-removedTextBackground char-delete">const legacyBg = '#121216';</span></span></div>
                             <div class="ag-diff-line bg-diffEditor-insertedLineBackground line-insert"><span class="ag-diff-ln">37</span><span>+ <span class="bg-diffEditor-insertedTextBackground char-insert">'--editor-diff-inserted-line-background', '--onyx-key',</span></span></div>
                             <div class="ag-diff-line bg-diffEditor-insertedLineBackground line-insert"><span class="ag-diff-ln">38</span><span>+ <span class="bg-diffEditor-insertedTextBackground char-insert">'--nux-radius-md', '--ag-cs-tonal-0..4',</span></span></div>
                             <div class="flex items-center justify-between px-3 py-2 border-t border-border text-xs text-muted-foreground mt-1">
                               <span>style.css · Hunk 1/1</span>
                               <div class="ag-m3-diff-actions inline-flex items-center gap-1.5">
                                 <button type="button" data-diff-action="accept" data-sim-diff="accepted" class="px-2.5 py-0.5 rounded-md border border-border bg-secondary text-foreground cursor-pointer text-xs">Accept</button>
                                 <button type="button" data-diff-action="reject" data-sim-diff="rejected" class="px-2.5 py-0.5 rounded-md border border-border bg-secondary text-foreground cursor-pointer text-xs">Reject</button>
                               </div>
                             </div>
                           </div>`
                        : ''
                    }
                  </div>

                  <!-- Authentic Running Items Panel ([data-testid="running-items-panel"]) -->
                  <div data-testid="running-items-panel" class="flex flex-col gap-1 p-2 rounded-lg border border-border bg-card text-xs">
                    <div data-testid="running-row" class="flex items-center justify-between px-2 py-1 text-secondary-foreground">
                      <span class="inline-flex items-center gap-2"><span data-testid="status-loading-spinner" class="inline-flex items-center"><span data-agent-state-dot="true" class="w-1.5 h-1.5 rounded-full bg-primary inline-block"></span></span><span>1 background task running · workbench/server.cjs</span></span>
                      <span class="agy-shortcut-keycap">4321</span>
                    </div>
                  </div>

                  <!-- Authentic AI Response Footer Toolbar ([data-testid="cascade-system-message-toolbar"]) -->
                  <div data-testid="cascade-system-message-toolbar" class="flex items-center gap-1 px-1 text-xs text-muted-foreground">
                    <button type="button" class="border-none bg-transparent px-2 py-1 text-xs text-muted-foreground cursor-pointer">Copy</button>
                    <button type="button" class="border-none bg-transparent px-2 py-1 text-xs text-muted-foreground cursor-pointer">Good</button>
                    <button type="button" class="border-none bg-transparent px-2 py-1 text-xs text-muted-foreground cursor-pointer">Bad</button>
                    <span class="ml-1 tabular-nums opacity-75">4m ago</span>
                  </div>`
                    : ''
                }
              </div>
            </div>`;
        })
        .join('');

      host.innerHTML = `
        <div data-testid="conversation-view" data-cascade-id="${conv.id}" class="w-full flex h-full min-h-0 flex-col items-center relative outline-none overflow-hidden">
          <nav data-testid="conversation-navigator" class="group/rail pointer-events-none absolute inset-y-0 left-0 z-10 flex w-7 flex-col items-center justify-center gap-1.5">${navDots}</nav>
          <div data-testid="autoscroll-viewport" class="h-full overflow-y-auto min-h-0 w-full isolate outline-none scrollbar-hide pl-4">
            <div class="ag-conv-column">${turnsHtml}</div>
          </div>
          <!-- Floating Wave 1 Selection Pill & Tooltip Showcase (Toggleable via Drawer or ?floatkit=1) -->
          <div class="ag-floatkit-bar" id="ag-floatkit-bar" ${sim.floatKitOpen ? '' : 'hidden'}>
            <div class="compact-tooltip px-2.5 py-1.5 text-xs">Tooltip · Concentric corners &amp; 1px top specular highlight</div>
            <button type="button" class="agy-selection-pill inline-flex items-center gap-1.5 px-3 py-1 text-xs border border-border bg-card text-foreground cursor-pointer" data-sim-action="toggle-floatkit">
              <span class="inline-flex items-center opacity-80">${iconHtml('sparkle')}</span><span>Ask Antigravity about selection</span><span class="agy-shortcut-keycap">Ctrl+L</span>
            </button>
          </div>
          <!-- Authentic Scroll-To-Bottom Floating Button (.agy-scroll-bottom) -->
          <button type="button" class="agy-scroll-bottom ag-scroll-bottom-seat rounded-full bg-card text-foreground" data-sim-action="scroll-bottom" title="Scroll to bottom">
            ${iconHtml('doubleChevDown')}
          </button>
          ${buildComposerHtml()}
        </div>`;
    }

    syncComposerPopovers();
    bindComposerInputEvents();
    if (sim.prismOn && window.__agClaudeStyle && typeof window.__agClaudeStyle.sync === 'function') {
      window.__agClaudeStyle.sync();
    }
  }

  function renderSettingsDialog() {
    const scrim = document.getElementById('ag-settings-scrim');
    const body = document.getElementById('ag-settings-body');
    if (!scrim || !body) return;
    scrim.hidden = !sim.settingsOpen;
    document.querySelectorAll('[data-sim-settings-tab]').forEach((b) => {
      const act = b.getAttribute('data-sim-settings-tab') === sim.settingsTab;
      b.setAttribute('data-active', String(act));
      b.classList.toggle('bg-sidebar-secondary', act);
      b.classList.toggle('text-foreground', act);
    });
    if (!sim.settingsOpen) return;

    if (sim.settingsTab === 'appearance') {
      body.innerHTML = `
        <div class="p-6">
          <h2 class="m-0 mb-1 text-lg font-semibold text-foreground">Appearance</h2>
          <p class="m-0 text-xs text-muted-foreground">When Live Prism Inject is active, the collapsible Obsidian Prism settings hub mounts automatically below.</p>
          <div class="space-y-2 mt-4">
            <div class="divide-y divide-border rounded-xl border border-card-border bg-card overflow-hidden">
              <div class="py-2 px-3.5 flex items-center justify-between gap-3">
                <div>
                  <div class="text-sm font-medium text-foreground">Host Color Mode</div>
                  <div class="text-xs text-muted-foreground">Switch the native Antigravity Dark / Light base theme</div>
                </div>
                <button type="button" class="px-3 py-1.5 rounded-lg border border-border bg-secondary text-foreground text-xs cursor-pointer" data-sim-action="toggle-host-theme">${sim.hostTheme === 'light' ? 'Light' : 'Dark'}</button>
              </div>
              <div class="py-2 px-3.5 flex items-center justify-between gap-3">
                <div>
                  <div class="text-sm font-medium text-foreground">Live Prism Injection</div>
                  <div class="text-xs text-muted-foreground">Switch losslessly between native Antigravity and live-compiled Obsidian Prism</div>
                </div>
                <button type="button" class="px-3 py-1.5 rounded-lg border border-border bg-secondary text-foreground text-xs cursor-pointer" data-sim-action="set-prism" data-val="${sim.prismOn ? '0' : '1'}">${sim.prismOn ? 'Return to Native Host' : 'Enable Prism Inject'}</button>
              </div>
            </div>
          </div>
        </div>`;
    } else {
      body.innerHTML = `
        <div class="p-6 flex flex-col gap-3">
          <div>
            <h2 class="m-0 mb-1 text-lg font-semibold text-foreground">Plugins &amp; MCP Marketplace</h2>
            <p class="m-0 text-xs text-muted-foreground">Authentic host Bento cards and .agy-sheet form controls</p>
          </div>
          <div class="grid grid-cols-2 gap-3">
            <div class="agy-plugin-card p-3 rounded-xl border border-card-border bg-card flex flex-col gap-1.5" data-testid="plugin-card">
              <div class="flex items-center justify-between">
                <strong class="text-sm text-foreground">Obsidian Prism</strong>
                <span class="text-xs text-primary">${sim.prismOn ? 'Injected' : 'Native Off'}</span>
              </div>
              <span class="text-xs text-muted-foreground">Obsidian Prism optical &amp; 0fps idle-sleep styling engine</span>
            </div>
            <div class="agy-bento-card p-3 rounded-xl border border-card-border bg-card flex flex-col gap-1.5" data-testid="mcp-server-card">
              <div class="flex items-center justify-between">
                <strong class="text-sm text-foreground">gemini-decisions MCP</strong>
                <span class="text-xs text-success">Connected</span>
              </div>
              <span class="text-xs text-muted-foreground">Zero-cost structured gate &amp; multi-candidate screening</span>
            </div>
          </div>
          <div class="agy-sheet p-3.5 rounded-xl border border-card-border bg-card flex flex-col gap-3">
            <div class="flex items-center justify-between">
              <span class="text-sm font-medium text-foreground">Sheet Drawer Form (2px focus ring &amp; pill switches)</span>
              <button type="button" role="switch" aria-checked="${sim.sheetSwitchOn}" data-sim-action="toggle-sheet-switch"
                style="width:38px;height:20px;padding:2px;border-radius:999px;border:1px solid var(--card-border);background:${sim.sheetSwitchOn ? 'var(--primary)' : 'var(--secondary)'};display:inline-flex;align-items:center;justify-content:${sim.sheetSwitchOn ? 'flex-end' : 'flex-start'};cursor:pointer;">
                <span style="width:14px;height:14px;border-radius:999px;background:#fff;display:block;"></span>
              </button>
            </div>
            <div class="grid grid-cols-2 gap-2.5">
              <input type="text" value="Obsidian Neutral" class="px-3 py-1.5 rounded-lg border border-border bg-background text-foreground text-sm" />
              <select class="px-3 py-1.5 rounded-lg border border-border bg-background text-foreground text-sm">
                <option>Balanced (10px shell + pill controls)</option>
                <option>Soft (14px shell + pill controls)</option>
                <option>Crisp (6px sharp precision)</option>
              </select>
            </div>
          </div>
        </div>`;
    }

    if (sim.prismOn && window.__agClaudeStyle && typeof window.__agClaudeStyle.sync === 'function') {
      setTimeout(() => window.__agClaudeStyle.sync(), 30);
    }
  }

  function renderFastpickList(query = '') {
    const list = document.getElementById('ag-fastpick-list');
    if (!list) return;
    const q = String(query || '').trim().toLowerCase();
    const items = [
      ...SLASH_COMMANDS.map((s) => ({ title: s.cmd, sub: s.desc, kbd: s.kbd, kind: 'slash', val: s.cmd })),
      { title: 'style.css', sub: 'M3 5-step tonal &amp; core surface stylesheet', kbd: 'F', kind: 'file', val: 'style.css' },
      { title: 'dual-mascot-rig.js', sub: 'Pixel rig, 9 Slash theaters &amp; miniature habitats', kbd: 'F', kind: 'file', val: 'dual-mascot-rig.js' },
    ].filter((it) => !q || it.title.toLowerCase().includes(q) || it.sub.toLowerCase().includes(q));

    list.innerHTML = items
      .map(
        (it, idx) => `
          <button type="button" role="option" ${idx === 0 ? 'data-selected="true" data-highlighted=""' : ''} aria-selected="${idx === 0}" data-sim-fp-pick="${esc(it.kind + ':' + it.val)}"
            class="agy-overlay-item w-full px-2.5 py-1.5 rounded-lg border-none bg-transparent hover:bg-secondary text-foreground text-sm flex items-center justify-between gap-2 cursor-pointer text-left">
            <span class="truncate"><strong>${esc(it.title)}</strong> <span class="text-muted-foreground ml-1.5 text-xs">${esc(it.sub)}</span></span>
            <span class="agy-shortcut-keycap">${esc(it.kbd)}</span>
          </button>`
      )
      .join('');
  }

  function spawnToast(typeOverride) {
    const host = document.getElementById('ag-toast-host');
    if (!host) return;
    const types = ['info', 'success', 'warning', 'error'];
    const tp = typeOverride || types[sim.toastCycleIdx++ % types.length];
    const copy = {
      info: ['Info · Sidecar Tokens Synced', '5-step Tonal Surface & Google Sans pushed to child panels'],
      success: ['Success · Live Injection Verified', 'style.css 0 non-ASCII · 281 automated checks green'],
      warning: ['Warning · 512K Vial at 86%', 'Wrote data-pv-warn="1"; mascots will peek from the left after streaming ends'],
      error: ['Error · Out-of-Bounds Write Blocked', 'Fail-Closed guard intercepted simulated symlink escape'],
    }[tp];
    const el = document.createElement('div');
    el.className = 'agy-toast px-3.5 py-2.5 rounded-xl border border-card-border bg-card shadow-xl flex items-start justify-between gap-3 text-xs';
    el.setAttribute('data-testid', 'toast-notification');
    el.setAttribute('data-type', tp);
    el.innerHTML = `<div><div class="font-semibold text-foreground">${esc(copy[0])}</div><div class="text-muted-foreground mt-0.5">${esc(copy[1])}</div></div><button type="button" class="border-none bg-transparent text-muted-foreground hover:text-foreground cursor-pointer inline-flex items-center justify-center p-0.5" aria-label="Close">${iconHtml('close')}</button>`;
    el.querySelector('button').addEventListener('click', () => el.remove());
    host.appendChild(el);
    while (host.children.length > 3) host.firstElementChild.remove();
    setTimeout(() => el.remove(), 5500);
  }

  function submitComposerText(rawText) {
    const text = String(rawText || '').trim();
    if (!text) return;
    const inputEl = document.getElementById('ag-composer-input');
    if (inputEl) inputEl.textContent = '';
    if (sim.slashMenuOpen) {
      sim.slashMenuOpen = false;
      syncComposerPopovers();
    }

    const m = text.match(/^\/(plan|goal|boost|teamwork|swarm|browser|compact|schedule|grill-me|learn)\b/i);
    if (m && sim.prismOn) {
      const cmd = '/' + m[1].toLowerCase();
      try {
        const rig = window.__agClaudeStyle && window.__agClaudeStyle.getMascotRig && window.__agClaudeStyle.getMascotRig();
        if (rig && typeof rig.notify === 'function') rig.notify('slash-cmd', { cmd });
      } catch {}
    }

    if (sim.view === 'home') sim.view = 'conv';
    const conv = getActiveConv();
    conv.turns.push({
      prompt: text,
      workedFor: 'Worked for 3s',
      thought: '1:1 host mirror processed command: ' + text,
      tools: [],
      summary: m
        ? `Sent ${m[0]} command; when Live Prism Inject is enabled, the dual-mascot stage above the composer plays its dedicated 2-3s micro-theater.`
        : 'Appended this turn live to the 1:1 mirrored conversation stream.',
    });
    renderMainStage();
    const vp = document.querySelector('[data-testid="autoscroll-viewport"]');
    if (vp) vp.scrollTop = vp.scrollHeight;
  }

  function bindComposerInputEvents() {
    const inputEl = document.getElementById('ag-composer-input');
    if (!inputEl) return;
    inputEl.addEventListener('input', () => {
      const txt = (inputEl.textContent || '').trim();
      const shouldOpen = txt.startsWith('/') && !txt.includes(' ');
      if (shouldOpen !== sim.slashMenuOpen) {
        sim.slashMenuOpen = shouldOpen;
        syncComposerPopovers();
      }
    });
    inputEl.addEventListener('keydown', (ev) => {
      if (ev.key === 'Escape' && sim.slashMenuOpen) {
        ev.preventDefault();
        sim.slashMenuOpen = false;
        syncComposerPopovers();
        return;
      }
      if (ev.key === 'Enter' && !ev.shiftKey && !ev.isComposing && ev.keyCode !== 229) {
        if (sim.slashMenuOpen) {
          ev.preventDefault();
          const chosen = SLASH_COMMANDS[sim.slashActiveIdx] || SLASH_COMMANDS[0];
          inputEl.textContent = chosen.cmd + ' ';
          sim.slashMenuOpen = false;
          syncComposerPopovers();
          return;
        }
        ev.preventDefault();
        submitComposerText(inputEl.textContent);
      }
    });
  }

  function syncControlUI() {
    const btnNative = document.getElementById('sim-mode-native');
    const btnPrism = document.getElementById('sim-mode-prism');
    const btnTheme = document.getElementById('sim-toggle-theme');
    const btnDrawer = document.getElementById('sim-toggle-drawer');
    const drawer = document.getElementById('wb-sim-drawer');
    const status = document.getElementById('sim-status-line');
    const ovBadge = document.getElementById('ag-ov-prism-badge');

    if (btnNative) btnNative.setAttribute('data-active', String(!sim.prismOn));
    if (btnPrism) btnPrism.setAttribute('data-active', String(sim.prismOn));
    if (btnTheme) btnTheme.textContent = sim.hostTheme === 'light' ? 'Light' : 'Dark';
    if (btnDrawer) btnDrawer.setAttribute('data-active', String(sim.drawerOpen));
    if (drawer) drawer.hidden = !sim.drawerOpen;
    if (ovBadge) ovBadge.textContent = sim.prismOn ? 'Prism Live' : 'Native';

    if (status) {
      const mirrorTag = sim.mirrorLive ? 'Host CSS' : 'Fallback CSS';
      status.textContent = sim.prismOn
        ? `Current State: Obsidian Prism Live Inject (${mirrorTag}) · ${sim.prismCfg.palette}/${sim.hostTheme}`
        : `Current State: Native Antigravity 1:1 Mirror (${mirrorTag} · ${sim.hostTheme})`;
    }

    const activePreset =
      sim.hostTheme === 'light'
        ? sim.prismCfg.lightPreset === 'alabaster' || sim.prismCfg.palette === 'warm'
          ? 'alabaster-light'
          : 'crystal-light'
        : sim.prismCfg.palette === 'warm'
          ? 'warm-dark'
          : sim.prismCfg.palette === 'host'
            ? 'host-dark'
            : 'obsidian-dark';

    document.querySelectorAll('[data-sim-preset]').forEach((b) => {
      b.setAttribute('data-active', String(b.getAttribute('data-sim-preset') === activePreset));
    });
    document.querySelectorAll('[data-sim-cfg]').forEach((b) => {
      const [k, v] = String(b.getAttribute('data-sim-cfg') || '').split(':');
      if (v === 'toggle') b.setAttribute('data-active', String(Boolean(sim.prismCfg[k])));
      else b.setAttribute('data-active', String(String(sim.prismCfg[k]) === v));
    });
  }

  function bindGlobalEvents() {
    document.addEventListener('click', (ev) => {
      const t = ev.target;
      if (!t || typeof t.closest !== 'function') return;

      const collapseBtn = t.closest('[data-sim-toggle-collapse]');
      if (collapseBtn) {
        const body = collapseBtn.nextElementSibling;
        if (body) {
          const next = body.hidden;
          body.hidden = !next;
          collapseBtn.setAttribute('aria-expanded', String(next));
        }
        return;
      }

      const diffBtn = t.closest('[data-sim-diff]');
      if (diffBtn) {
        sim.diffStatus = diffBtn.getAttribute('data-sim-diff') || 'pending';
        renderMainStage();
        return;
      }

      const permPick = t.closest('[data-sim-perm]');
      if (permPick) {
        sim.permMode = permPick.getAttribute('data-sim-perm') || 'turbo';
        const trig = document.querySelector('[data-testid="permissions-selector-trigger"]');
        if (trig) trig.setAttribute('data-ag-perm-mode', sim.permMode);
        const lbl = document.getElementById('ag-perm-trigger-label');
        const ent = PERM_MODES.find((x) => x.id === sim.permMode) || PERM_MODES[0];
        if (lbl) lbl.textContent = ent.label;
        if (sim.prismOn) {
          const pm = document.querySelector('[data-testid="permissions-menu"]');
          if (pm) {
            pm.querySelectorAll('[data-sim-perm]').forEach((btn) => {
              btn.setAttribute('aria-checked', String(btn.getAttribute('data-sim-perm') === sim.permMode));
            });
          }
          if (window.__agClaudeStyle && typeof window.__agClaudeStyle.sync === 'function') {
            window.__agClaudeStyle.sync();
          }
        } else {
          sim.permMenuOpen = false;
          syncComposerPopovers();
        }
        return;
      }

      const modelPick = t.closest('[data-model-pick]');
      if (modelPick) {
        sim.selectedModelLabel = modelPick.getAttribute('data-model-pick') || sim.selectedModelLabel;
        const lbl = document.getElementById('ag-model-trigger-label');
        if (lbl) lbl.textContent = sim.selectedModelLabel;
        renderModelMenuRows();
        if (sim.prismOn && window.__agClaudeStyle && typeof window.__agClaudeStyle.sync === 'function') {
          window.__agClaudeStyle.sync();
        }
        return;
      }

      const slashPick = t.closest('[data-sim-slash-pick]');
      if (slashPick) {
        submitComposerText(slashPick.getAttribute('data-sim-slash-pick'));
        return;
      }

      const slashDemo = t.closest('[data-sim-slash]');
      if (slashDemo) {
        const cmd = slashDemo.getAttribute('data-sim-slash');
        if (!sim.prismOn) {
          sim.prismOn = true;
          void applyPrismInjection().then(() => submitComposerText(cmd));
        } else {
          submitComposerText(cmd);
        }
        return;
      }

      const fpPick = t.closest('[data-sim-fp-pick]');
      if (fpPick) {
        const raw = fpPick.getAttribute('data-sim-fp-pick') || '';
        sim.fastpickOpen = false;
        const scrim = document.getElementById('ag-fastpick-scrim');
        if (scrim) scrim.hidden = true;
        if (raw.startsWith('slash:')) submitComposerText(raw.slice(6));
        return;
      }

      const tabBtn = t.closest('[data-sim-settings-tab]');
      if (tabBtn) {
        sim.settingsTab = tabBtn.getAttribute('data-sim-settings-tab') || 'appearance';
        renderSettingsDialog();
        return;
      }

      const presetBtn = t.closest('[data-sim-preset]');
      if (presetBtn) {
        const pid = presetBtn.getAttribute('data-sim-preset');
        if (pid === 'obsidian-dark') {
          sim.hostTheme = 'dark'; sim.prismCfg.palette = 'obsidian'; sim.prismCfg.lightPreset = 'crystal';
        } else if (pid === 'warm-dark') {
          sim.hostTheme = 'dark'; sim.prismCfg.palette = 'warm'; sim.prismCfg.lightPreset = 'alabaster';
        } else if (pid === 'crystal-light') {
          sim.hostTheme = 'light'; sim.prismCfg.palette = 'obsidian'; sim.prismCfg.lightPreset = 'crystal';
        } else if (pid === 'alabaster-light') {
          sim.hostTheme = 'light'; sim.prismCfg.palette = 'warm'; sim.prismCfg.lightPreset = 'alabaster';
        } else if (pid === 'host-dark') {
          sim.hostTheme = 'dark'; sim.prismCfg.palette = 'host';
        }
        sim.prismOn = true;
        syncHostThemeClasses();
        void applyPrismInjection();
        return;
      }

      const cfgBtn = t.closest('[data-sim-cfg]');
      if (cfgBtn) {
        const [k, v] = String(cfgBtn.getAttribute('data-sim-cfg') || '').split(':');
        if (v === 'toggle') sim.prismCfg[k] = !sim.prismCfg[k];
        else sim.prismCfg[k] = v;
        if (sim.prismOn) void applyPrismInjection();
        else syncControlUI();
        return;
      }

      const actEl = t.closest('[data-sim-action]');
      if (actEl) {
        const act = actEl.getAttribute('data-sim-action');
        if (act === 'set-prism') {
          const want = actEl.getAttribute('data-val') === '1';
          sim.prismOn = want;
          if (want) void applyPrismInjection();
          else void applyPrismRemoval();
        } else if (act === 'toggle-host-theme') {
          sim.hostTheme = sim.hostTheme === 'light' ? 'dark' : 'light';
          syncHostThemeClasses();
          if (sim.settingsOpen) renderSettingsDialog();
          syncControlUI();
        } else if (act === 'toggle-drawer') {
          sim.drawerOpen = !sim.drawerOpen;
          syncControlUI();
        } else if (act === 'toggle-sidebar') {
          sim.sidebarCollapsed = !sim.sidebarCollapsed;
          renderSidebar();
        } else if (act === 'toggle-overview') {
          sim.overviewOpen = !sim.overviewOpen;
          const ov = document.getElementById('ag-overview-shell');
          if (ov) ov.hidden = !sim.overviewOpen || sim.view === 'home';
        } else if (act === 'toggle-terminal') {
          sim.terminalOpen = !sim.terminalOpen;
          const term = document.getElementById('ag-bottom-terminal');
          if (term) term.hidden = !sim.terminalOpen;
        } else if (act === 'go-home') {
          sim.view = 'home';
          sim.modelMenuOpen = false;
          renderSidebar();
          renderMainStage();
        } else if (act === 'go-history') {
          sim.view = 'history';
          sim.modelMenuOpen = false;
          renderSidebar();
          renderMainStage();
        } else if (act === 'go-conv') {
          sim.view = 'conv';
          sim.modelMenuOpen = false;
          renderSidebar();
          renderMainStage();
        } else if (act === 'toggle-floatkit') {
          sim.floatKitOpen = !sim.floatKitOpen;
          const bar = document.getElementById('ag-floatkit-bar');
          if (bar) bar.hidden = !sim.floatKitOpen;
          syncControlUI();
        } else if (act === 'scroll-bottom') {
          const vp = document.querySelector('[data-testid="autoscroll-viewport"]');
          if (vp) vp.scrollTop = vp.scrollHeight;
        } else if (act === 'toggle-perm-menu') {
          sim.permMenuOpen = !sim.permMenuOpen;
          if (sim.permMenuOpen) {
            sim.modelMenuOpen = false;
            sim.slashMenuOpen = false;
          }
          syncComposerPopovers();
        } else if (act === 'pick-conv') {
          const cid = actEl.getAttribute('data-conv-id');
          if (cid) sim.activeConvId = cid;
          sim.view = 'conv';
          sim.modelMenuOpen = false;
          renderSidebar();
          renderMainStage();
        } else if (act === 'scroll-diff') {
          sim.view = 'conv';
          sim.diffExpanded = true;
          renderMainStage();
          setTimeout(() => document.getElementById('ag-diff-anchor')?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 40);
        } else if (act === 'toggle-diff-expand') {
          sim.diffExpanded = !sim.diffExpanded;
          renderMainStage();
        } else if (act === 'open-model-menu') {
          sim.modelMenuOpen = !sim.modelMenuOpen;
          if (sim.modelMenuOpen) { sim.slashMenuOpen = false; sim.permMenuOpen = false; }
          syncComposerPopovers();
        } else if (act === 'toggle-slash-menu') {
          sim.slashMenuOpen = !sim.slashMenuOpen;
          if (sim.slashMenuOpen) { sim.modelMenuOpen = false; sim.permMenuOpen = false; }
          syncComposerPopovers();
        } else if (act === 'open-fastpick') {
          sim.fastpickOpen = true;
          const scrim = document.getElementById('ag-fastpick-scrim');
          if (scrim) scrim.hidden = false;
          renderFastpickList('');
          const inp = document.getElementById('ag-fastpick-input');
          if (inp) { inp.value = ''; inp.focus(); }
        } else if (act === 'open-settings') {
          sim.settingsOpen = true;
          sim.settingsTab = 'appearance';
          renderSettingsDialog();
        } else if (act === 'open-settings-plugins') {
          sim.settingsOpen = true;
          sim.settingsTab = 'plugins';
          renderSettingsDialog();
        } else if (act === 'close-settings') {
          sim.settingsOpen = false;
          renderSettingsDialog();
        } else if (act === 'toggle-sheet-switch') {
          sim.sheetSwitchOn = !sim.sheetSwitchOn;
          renderSettingsDialog();
        } else if (act === 'toggle-streaming') {
          sim.streaming = !sim.streaming;
          renderSidebar();
          renderMainStage();
        } else if (act === 'toggle-vial-high') {
          sim.vialHigh = !sim.vialHigh;
          if (window.__agCsPulseBridgeInst && typeof window.__agCsPulseBridgeInst.sync === 'function') {
            void window.__agCsPulseBridgeInst.sync();
          }
          spawnToast(sim.vialHigh ? 'warning' : 'info');
          renderModelMenuRows();
        } else if (act === 'toggle-win-blur') {
          sim.winBlurSim = !sim.winBlurSim;
          if (sim.winBlurSim) document.documentElement.setAttribute('data-ag-cs-win-blur', '1');
          else document.documentElement.removeAttribute('data-ag-cs-win-blur');
          if (window.__agClaudeStyle && typeof window.__agClaudeStyle.sync === 'function') {
            window.__agClaudeStyle.sync();
          }
          spawnToast('info');
        } else if (act === 'spawn-toast') {
          spawnToast();
        } else if (act === 'send-composer') {
          const inp = document.getElementById('ag-composer-input');
          submitComposerText(inp ? inp.textContent : '');
        }
        return;
      }

      if (t.id === 'ag-fastpick-scrim') {
        sim.fastpickOpen = false;
        t.hidden = true;
      } else if (t.id === 'ag-settings-scrim') {
        sim.settingsOpen = false;
        renderSettingsDialog();
      } else if (
        sim.permMenuOpen &&
        !t.closest('[data-testid="permissions-menu"]') &&
        !t.closest('[data-testid="permissions-selector-trigger"]')
      ) {
        sim.permMenuOpen = false;
        syncComposerPopovers();
      }
    });

    const fpInput = document.getElementById('ag-fastpick-input');
    if (fpInput) fpInput.addEventListener('input', () => renderFastpickList(fpInput.value));

    document.addEventListener('keydown', (ev) => {
      if ((ev.ctrlKey || ev.metaKey) && ev.key.toLowerCase() === 'k') {
        ev.preventDefault();
        sim.fastpickOpen = !sim.fastpickOpen;
        const scrim = document.getElementById('ag-fastpick-scrim');
        if (scrim) scrim.hidden = !sim.fastpickOpen;
        if (sim.fastpickOpen) {
          renderFastpickList('');
          const inp = document.getElementById('ag-fastpick-input');
          if (inp) { inp.value = ''; inp.focus(); }
        }
      } else if (ev.key === 'Escape') {
        if (sim.fastpickOpen) {
          sim.fastpickOpen = false;
          const scrim = document.getElementById('ag-fastpick-scrim');
          if (scrim) scrim.hidden = true;
        } else if (sim.settingsOpen) {
          sim.settingsOpen = false;
          renderSettingsDialog();
        } else if (sim.modelMenuOpen) {
          sim.modelMenuOpen = false;
          syncComposerPopovers();
        } else if (sim.permMenuOpen) {
          sim.permMenuOpen = false;
          syncComposerPopovers();
        }
      }
    });
  }

  function connectLiveReload() {
    if (typeof EventSource !== 'function') return;
    try {
      const es = new EventSource('/api/events');
      es.addEventListener('reload', () => {
        if (sim.prismOn) void applyPrismInjection();
        else window.location.reload();
      });
    } catch {}
  }

  async function boot() {
    installHostShims();
    syncHostThemeClasses();
    try {
      const resp = await fetch('/api/host-mirror/blueprint.json');
      if (resp.ok) {
        const bp = await resp.json();
        if (bp && bp.parts && bp.parts.svgIcons && Object.keys(bp.parts.svgIcons).length > 0) {
          const cleanIcons = { ...FALLBACK_SVG };
          for (const [k, raw] of Object.entries(bp.parts.svgIcons)) {
            if (typeof k !== 'string' || !k || k === '__proto__' || k === 'constructor' || k === 'prototype') continue;
            const cleaned = sanitizeSvgMarkup(raw);
            if (cleaned) cleanIcons[k] = cleaned;
          }
          hostSvgIcons = cleanIcons;
          sim.mirrorLive = !bp.meta?.fallback;
        }
      }
    } catch {}
    hydrateStaticHostIcons();
    renderSidebar();
    renderMainStage();
    bindGlobalEvents();
    syncControlUI();
    connectLiveReload();
    if (sim.prismOn) void applyPrismInjection();
  }

  void boot();
})();
