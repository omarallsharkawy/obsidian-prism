/**
 * Obsidian Prism — Periodic Model Catalog, Classification, Pagination & Benchmark Registry
 *
 * Standalone zero-DOM-dependency catalog engine providing:
 *   - 90-slot main periodic table + 28 f-block IUPAC elements (`ELEMENTS_90`, `SLOT_BY_Z`, `ELEMENT_BY_NAME`)
 *   - Google element model parser & aggregator (`parseElementModelLabel`, `matchGoogleElementModels`)
 *   - Non-element aux model classifier & paginator (`classifyNonElementOption`, `matchHostAuxModels`,
 *     `AUX_PAGE_SIZE`, `getAuxPageCount`, `getAuxPageSlice`, `findAuxPageForId`)
 *   - Honest 2026Q4 public benchmark lookup (`BENCHMARK_2026Q4_DB`, `resolveBenchmarkMetrics`)
 *     that NEVER borrows Carbon or GPT-OSS scores for unknown/unbenchmarked models
 *   - Strict EN/AR bilingual display helpers with zero hardcoded CJK characters
 *
 * Contract:
 *   globalThis.__agPeriodicModelCatalog = { ... }
 *   module.exports = api
 */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module && typeof module.exports === 'object') {
    module.exports = api;
  }
  if (root && typeof root === 'object') {
    root.__agPeriodicModelCatalog = api;
  }
  if (typeof globalThis === 'object' && globalThis) {
    globalThis.__agPeriodicModelCatalog = api;
  }
  if (typeof window === 'object' && window) {
    window.__agPeriodicModelCatalog = api;
  }
})(
  typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : this,
  function () {
    'use strict';

    var AUX_PAGE_SIZE = 6;
    var DEFAULT_MAX_CONTEXT_TOKENS = 524288; /* Antigravity 512K standard context capacity */

    var EFFORT_ORDER = ['off', 'minimal', 'low', 'medium', 'high', 'xhigh', 'max'];
    var EFFORT_NORM_MAP = {
      off: 0.12,
      minimal: 0.2,
      low: 0.25,
      medium: 0.5,
      high: 0.78,
      xhigh: 1.0,
      max: 1.0,
    };
    var EFFORT_LABELS = {
      off: 'Off',
      minimal: 'Minimal',
      low: 'Low',
      medium: 'Medium',
      high: 'High',
      xhigh: 'Extra',
      max: 'Max',
    };
    var EFFORT_LABELS_AR = {
      off: 'إيقاف',
      minimal: 'أدنى',
      low: 'منخفض',
      medium: 'متوسط',
      high: 'عالي',
      xhigh: 'فائق',
      max: 'أقصى',
    };
    var EFFORT_LABELS_ZH = EFFORT_LABELS_AR;

    var MODEL_TRIGGER_TEXT_RE =
      /(?:gemini|hydrogen|carbon|neon|argon|flash|claude|sonnet|opus|haiku|gpt|openai|o1|o3|o4|codex|orchestrator|المنسق|المجدول)/i;

    var EXCLUDED_FAMILY_RE =
      /\b(?:orchestrator|claude|anthropic|sonnet|opus|haiku|gpt|openai|codex|deepseek|llama|mistral|qwen)\b|\bo[134](?:-[a-z0-9]+)?\b|المنسق|المجدول/i;

    var AR_EFFORT_PAREN_RE =
      /\s*\(\s*(أقصى|فائق|عالي جدا|عالي جداً|عميق|عالي|متوسط|منخفض|أدنى|تلقائي|إيقاف|مغلق)\s*\)\s*$/;
    var ZH_EFFORT_PAREN_RE = AR_EFFORT_PAREN_RE;

    var EN_EFFORT_PAREN_RE =
      /\s*\(\s*(off|minimal|low|medium|med|high|xhigh|extra|max|auto)(?:\s+thinking)?\s*\)\s*$/i;

    /* Compact 90-slot main periodic table (18 cols x 7 rows):
       [z, symbol, name, ar, mass, row, col, group, numLabel?] */
    var RAW_SLOTS_90 = [
      [1, 'H', 'Hydrogen', 'الهيدروجين', '1.008', 1, 1, 'nonmetal'],
      [2, 'He', 'Helium', 'الهيليوم', '4.0026', 1, 18, 'noble'],

      [3, 'Li', 'Lithium', 'الليثيوم', '6.94', 2, 1, 'alkali'],
      [4, 'Be', 'Beryllium', 'البيريليوم', '9.0122', 2, 2, 'alkaline'],
      [5, 'B', 'Boron', 'البورون', '10.81', 2, 13, 'metalloid'],
      [6, 'C', 'Carbon', 'الكربون', '12.011', 2, 14, 'nonmetal'],
      [7, 'N', 'Nitrogen', 'النيتروجين', '14.007', 2, 15, 'nonmetal'],
      [8, 'O', 'Oxygen', 'الأكسجين', '15.999', 2, 16, 'nonmetal'],
      [9, 'F', 'Fluorine', 'الفلور', '18.998', 2, 17, 'halogen'],
      [10, 'Ne', 'Neon', 'النيون', '20.180', 2, 18, 'noble'],

      [11, 'Na', 'Sodium', 'الصوديوم', '22.990', 3, 1, 'alkali'],
      [12, 'Mg', 'Magnesium', 'المغنيسيوم', '24.305', 3, 2, 'alkaline'],
      [13, 'Al', 'Aluminium', 'الألمنيوم', '26.982', 3, 13, 'post-transition'],
      [14, 'Si', 'Silicon', 'السيليكون', '28.085', 3, 14, 'metalloid'],
      [15, 'P', 'Phosphorus', 'الفوسفور', '30.974', 3, 15, 'nonmetal'],
      [16, 'S', 'Sulfur', 'الكبريت', '32.06', 3, 16, 'nonmetal'],
      [17, 'Cl', 'Chlorine', 'الكلور', '35.45', 3, 17, 'halogen'],
      [18, 'Ar', 'Argon', 'الأرجون', '39.948', 3, 18, 'noble'],

      [19, 'K', 'Potassium', 'البوتاسيوم', '39.098', 4, 1, 'alkali'],
      [20, 'Ca', 'Calcium', 'الكالسيوم', '40.078', 4, 2, 'alkaline'],
      [21, 'Sc', 'Scandium', 'السكانديوم', '44.956', 4, 3, 'transition'],
      [22, 'Ti', 'Titanium', 'التيتانيوم', '47.867', 4, 4, 'transition'],
      [23, 'V', 'Vanadium', 'الفاناديوم', '50.942', 4, 5, 'transition'],
      [24, 'Cr', 'Chromium', 'الكروم', '51.996', 4, 6, 'transition'],
      [25, 'Mn', 'Manganese', 'المنغنيز', '54.938', 4, 7, 'transition'],
      [26, 'Fe', 'Iron', 'الحديد', '55.845', 4, 8, 'transition'],
      [27, 'Co', 'Cobalt', 'الكوبالت', '58.933', 4, 9, 'transition'],
      [28, 'Ni', 'Nickel', 'النيكل', '58.693', 4, 10, 'transition'],
      [29, 'Cu', 'Copper', 'النحاس', '63.546', 4, 11, 'transition'],
      [30, 'Zn', 'Zinc', 'الزنك', '65.38', 4, 12, 'transition'],
      [31, 'Ga', 'Gallium', 'الغاليوم', '69.723', 4, 13, 'post-transition'],
      [32, 'Ge', 'Germanium', 'الجرمانيوم', '72.630', 4, 14, 'metalloid'],
      [33, 'As', 'Arsenic', 'الزرنيخ', '74.922', 4, 15, 'metalloid'],
      [34, 'Se', 'Selenium', 'السيلينيوم', '78.971', 4, 16, 'nonmetal'],
      [35, 'Br', 'Bromine', 'البروم', '79.904', 4, 17, 'halogen'],
      [36, 'Kr', 'Krypton', 'الكريبتون', '83.798', 4, 18, 'noble'],

      [37, 'Rb', 'Rubidium', 'الروبيديوم', '85.468', 5, 1, 'alkali'],
      [38, 'Sr', 'Strontium', 'السترونشيوم', '87.62', 5, 2, 'alkaline'],
      [39, 'Y', 'Yttrium', 'الإتريوم', '88.906', 5, 3, 'transition'],
      [40, 'Zr', 'Zirconium', 'الزركونيوم', '91.224', 5, 4, 'transition'],
      [41, 'Nb', 'Niobium', 'النيوبيوم', '92.906', 5, 5, 'transition'],
      [42, 'Mo', 'Molybdenum', 'الموليبدينوم', '95.95', 5, 6, 'transition'],
      [43, 'Tc', 'Technetium', 'التكنيشيوم', '98', 5, 7, 'transition'],
      [44, 'Ru', 'Ruthenium', 'الروثينيوم', '101.07', 5, 8, 'transition'],
      [45, 'Rh', 'Rhodium', 'الروديوم', '102.91', 5, 9, 'transition'],
      [46, 'Pd', 'Palladium', 'البلاديوم', '106.42', 5, 10, 'transition'],
      [47, 'Ag', 'Silver', 'الفضة', '107.87', 5, 11, 'transition'],
      [48, 'Cd', 'Cadmium', 'الكادميوم', '112.41', 5, 12, 'transition'],
      [49, 'In', 'Indium', 'الإنديوم', '114.82', 5, 13, 'post-transition'],
      [50, 'Sn', 'Tin', 'القصدير', '118.71', 5, 14, 'post-transition'],
      [51, 'Sb', 'Antimony', 'الإثمد', '121.76', 5, 15, 'metalloid'],
      [52, 'Te', 'Tellurium', 'التيلوريوم', '127.60', 5, 16, 'metalloid'],
      [53, 'I', 'Iodine', 'اليود', '126.90', 5, 17, 'halogen'],
      [54, 'Xe', 'Xenon', 'الزينون', '131.29', 5, 18, 'noble'],

      [55, 'Cs', 'Caesium', 'السيزيوم', '132.91', 6, 1, 'alkali'],
      [56, 'Ba', 'Barium', 'الباريوم', '137.33', 6, 2, 'alkaline'],
      [57, 'La', 'Lanthanum', 'اللانثانوم', '138.91', 6, 3, 'lanthanoid', '57-71'],
      [72, 'Hf', 'Hafnium', 'الهافنيوم', '178.49', 6, 4, 'transition'],
      [73, 'Ta', 'Tantalum', 'التانتالوم', '180.95', 6, 5, 'transition'],
      [74, 'W', 'Tungsten', 'التنغستن', '183.84', 6, 6, 'transition'],
      [75, 'Re', 'Rhenium', 'الرينيوم', '186.21', 6, 7, 'transition'],
      [76, 'Os', 'Osmium', 'الأوزميوم', '190.23', 6, 8, 'transition'],
      [77, 'Ir', 'Iridium', 'الإيريديوم', '192.22', 6, 9, 'transition'],
      [78, 'Pt', 'Platinum', 'البلاتين', '195.08', 6, 10, 'transition'],
      [79, 'Au', 'Gold', 'الذهب', '196.97', 6, 11, 'transition'],
      [80, 'Hg', 'Mercury', 'الزئبق', '200.59', 6, 12, 'transition'],
      [81, 'Tl', 'Thallium', 'الثاليوم', '204.38', 6, 13, 'post-transition'],
      [82, 'Pb', 'Lead', 'الرصاص', '207.2', 6, 14, 'post-transition'],
      [83, 'Bi', 'Bismuth', 'البزموت', '208.98', 6, 15, 'post-transition'],
      [84, 'Po', 'Polonium', 'البولونيوم', '209', 6, 16, 'metalloid'],
      [85, 'At', 'Astatine', 'الأستاتين', '210', 6, 17, 'halogen'],
      [86, 'Rn', 'Radon', 'الرادون', '222', 6, 18, 'noble'],

      [87, 'Fr', 'Francium', 'الفرانسيوم', '223', 7, 1, 'alkali'],
      [88, 'Ra', 'Radium', 'الراديوم', '226', 7, 2, 'alkaline'],
      [89, 'Ac', 'Actinium', 'الأكتينيوم', '227', 7, 3, 'actinoid', '89-103'],
      [104, 'Rf', 'Rutherfordium', 'الرذرفورديوم', '267', 7, 4, 'transition'],
      [105, 'Db', 'Dubnium', 'الدوبنيوم', '268', 7, 5, 'transition'],
      [106, 'Sg', 'Seaborgium', 'السيبورغيوم', '269', 7, 6, 'transition'],
      [107, 'Bh', 'Bohrium', 'البوريوم', '270', 7, 7, 'transition'],
      [108, 'Hs', 'Hassium', 'الهاسيوم', '277', 7, 8, 'transition'],
      [109, 'Mt', 'Meitnerium', 'المايتنريوم', '278', 7, 9, 'transition'],
      [110, 'Ds', 'Darmstadtium', 'الدارمشتاتيوم', '281', 7, 10, 'transition'],
      [111, 'Rg', 'Roentgenium', 'الرونتجينيوم', '282', 7, 11, 'transition'],
      [112, 'Cn', 'Copernicium', 'الكوبرنيسيوم', '285', 7, 12, 'transition'],
      [113, 'Nh', 'Nihonium', 'النيهونيوم', '286', 7, 13, 'post-transition'],
      [114, 'Fl', 'Flerovium', 'الفليروفيوم', '289', 7, 14, 'post-transition'],
      [115, 'Mc', 'Moscovium', 'الموسكوفيوم', '290', 7, 15, 'post-transition'],
      [116, 'Lv', 'Livermorium', 'الليفرموريوم', '293', 7, 16, 'post-transition'],
      [117, 'Ts', 'Tennessine', 'التينيسين', '294', 7, 17, 'halogen'],
      [118, 'Og', 'Oganesson', 'الأوغانيسون', '294', 7, 18, 'noble'],
    ];

    /* Remaining f-block elements (58..71 -> slot 57, 90..103 -> slot 89) so all 118 IUPAC elements match */
    var RAW_FBLOCK_28 = [
      [58, 'Ce', 'Cerium', 'السيريوم', '140.12', 57, 'lanthanoid'],
      [59, 'Pr', 'Praseodymium', 'البراسوديميوم', '140.91', 57, 'lanthanoid'],
      [60, 'Nd', 'Neodymium', 'النيوديميوم', '144.24', 57, 'lanthanoid'],
      [61, 'Pm', 'Promethium', 'البروميثيوم', '145', 57, 'lanthanoid'],
      [62, 'Sm', 'Samarium', 'الساماريوم', '150.36', 57, 'lanthanoid'],
      [63, 'Eu', 'Europium', 'اليوروبيوم', '151.96', 57, 'lanthanoid'],
      [64, 'Gd', 'Gadolinium', 'الغادولينيوم', '157.25', 57, 'lanthanoid'],
      [65, 'Tb', 'Terbium', 'التيربيوم', '158.93', 57, 'lanthanoid'],
      [66, 'Dy', 'Dysprosium', 'الديسبروسيوم', '162.50', 57, 'lanthanoid'],
      [67, 'Ho', 'Holmium', 'الهولميوم', '164.93', 57, 'lanthanoid'],
      [68, 'Er', 'Erbium', 'الإربيوم', '167.26', 57, 'lanthanoid'],
      [69, 'Tm', 'Thulium', 'الثوليوم', '168.93', 57, 'lanthanoid'],
      [70, 'Yb', 'Ytterbium', 'الإيتربيوم', '173.05', 57, 'lanthanoid'],
      [71, 'Lu', 'Lutetium', 'اللوتيشيوم', '174.97', 57, 'lanthanoid'],

      [90, 'Th', 'Thorium', 'الثوريوم', '232.04', 89, 'actinoid'],
      [91, 'Pa', 'Protactinium', 'البروتكتينيوم', '231.04', 89, 'actinoid'],
      [92, 'U', 'Uranium', 'اليورانيوم', '238.03', 89, 'actinoid'],
      [93, 'Np', 'Neptunium', 'النبتونيوم', '237', 89, 'actinoid'],
      [94, 'Pu', 'Plutonium', 'البلوتونيوم', '244', 89, 'actinoid'],
      [95, 'Am', 'Americium', 'الأمريسيوم', '243', 89, 'actinoid'],
      [96, 'Cm', 'Curium', 'الكوريوم', '247', 89, 'actinoid'],
      [97, 'Bk', 'Berkelium', 'البركيليوم', '247', 89, 'actinoid'],
      [98, 'Cf', 'Californium', 'الكاليفورنيوم', '251', 89, 'actinoid'],
      [99, 'Es', 'Einsteinium', 'الأينشتاينيوم', '252', 89, 'actinoid'],
      [100, 'Fm', 'Fermium', 'الفيرميوم', '257', 89, 'actinoid'],
      [101, 'Md', 'Mendelevium', 'المندليفيوم', '258', 89, 'actinoid'],
      [102, 'No', 'Nobelium', 'النوبليوم', '259', 89, 'actinoid'],
      [103, 'Lr', 'Lawrencium', 'اللورنسيوم', '266', 89, 'actinoid'],
    ];

    var ELEMENT_BY_NAME = new Map();
    var SLOT_BY_Z = new Map();

    var ELEMENTS_90 = Object.freeze(
      RAW_SLOTS_90.map(function (r) {
        var item = Object.freeze({
          z: r[0],
          slotZ: r[0],
          symbol: r[1],
          name: r[2],
          ar: r[3],
          mass: r[4],
          row: r[5],
          col: r[6],
          group: r[7],
          numLabel: r[8] || String(r[0]),
        });
        SLOT_BY_Z.set(item.z, item);
        ELEMENT_BY_NAME.set(item.name.toLowerCase(), item);
        return item;
      })
    );

    for (var fi = 0; fi < RAW_FBLOCK_28.length; fi += 1) {
      var fr = RAW_FBLOCK_28[fi];
      var parentSlot = SLOT_BY_Z.get(fr[5]);
      var fItem = Object.freeze({
        z: fr[0],
        slotZ: fr[5],
        symbol: fr[1],
        name: fr[2],
        ar: fr[3],
        mass: fr[4],
        row: parentSlot ? parentSlot.row : 6,
        col: parentSlot ? parentSlot.col : 3,
        group: fr[6],
        numLabel: String(fr[0]),
      });
      ELEMENT_BY_NAME.set(fItem.name.toLowerCase(), fItem);
    }

    /* US/UK IUPAC spelling aliases */
    ELEMENT_BY_NAME.set('aluminum', SLOT_BY_Z.get(13));
    ELEMENT_BY_NAME.set('cesium', SLOT_BY_Z.get(55));
    ELEMENT_BY_NAME.set('sulphur', SLOT_BY_Z.get(16));

    var GROUP_META = {
      nonmetal: { en: 'Reactive Nonmetal', ar: 'لافلز نشط' },
      noble: { en: 'Noble Gas', ar: 'غاز نبيل' },
      alkali: { en: 'Alkali Metal', ar: 'فلز قلوي' },
      alkaline: { en: 'Alkaline Earth Metal', ar: 'فلز قلوي ترابي' },
      metalloid: { en: 'Metalloid', ar: 'شبه فلز' },
      halogen: { en: 'Halogen', ar: 'هالوجين' },
      'post-transition': { en: 'Post-Transition Metal', ar: 'فلز ما بعد انتقالي' },
      transition: { en: 'Transition Metal', ar: 'فلز انتقالي' },
      lanthanoid: { en: 'Lanthanoid Series', ar: 'سلسلة اللانثانيدات' },
      actinoid: { en: 'Actinoid Series', ar: 'سلسلة الأكتينيدات' },
    };

    var ELEMENT_LORE = {
      1: {
        en: 'Group 1 · Reactive Nonmetal · Agile High-Throughput Reasoning',
        ar: 'المجموعة 1 · لافلز نشط · نواة استدلال سريعة وعالية التدفق',
      },
      6: {
        en: 'Group 14 · Tetravalent Carbon Core · Flagship Deep Synthesis',
        ar: 'المجموعة 14 · نواة الكربون الرباعي · رائد الاستدلال العميق والهندسة',
      },
      10: {
        en: 'Group 18 · Noble Gas · Luminous Low-Latency Multimodal',
        ar: 'المجموعة 18 · غاز نبيل · متعدد الوسائط سريع الاستجابة ومنخفض الكمون',
      },
      18: {
        en: 'Group 18 · Noble Gas · Balanced Precision & Visual Craft',
        ar: 'المجموعة 18 · غاز نبيل · دقة متوازنة وتحقق بصري متقن',
      },
    };

    /* V14.1 Theme-Native Frosted Hairline Micro-Badge Palette Resolver */
    var MINI_BADGE_SOUL_HEX = {
      1: { dark: '#56C8FA', light: '#0284C7' },
      6: { dark: '#669DF6', light: '#2563EB' },
      10: { dark: '#F4845F', light: '#D95D24' },
      18: { dark: '#9B7DF7', light: '#6D28D9' },
      orchestrator: { dark: '#E2B354', light: '#A16207' },
      flash: { dark: '#38BDF8', light: '#0284C7' },
      claude: { dark: '#DF8458', light: '#B45309' },
      gpt: { dark: '#4FD1C5', light: '#0F766E' },
      fallback: { dark: '#8EA4C8', light: '#475569' },
    };

    var MINI_BADGE_THEME_SUBSTRATES = {
      'obsidian-dark': {
        surfaceRgb: [255, 255, 255],
        surfaceBaseAlpha: 0.038,
        tintSurfaceAlpha: 0.092,
        borderRgb: [218, 228, 255],
        borderAlpha: 0.19,
        fgRgb: [204, 212, 226],
        fgTintMix: 0.36,
        borderTintMix: 0.28,
      },
      'warm-dark': {
        surfaceRgb: [245, 236, 222],
        surfaceBaseAlpha: 0.046,
        tintSurfaceAlpha: 0.096,
        borderRgb: [232, 206, 174],
        borderAlpha: 0.22,
        fgRgb: [218, 208, 194],
        fgTintMix: 0.38,
        borderTintMix: 0.30,
      },
      'crystal-light': {
        surfaceRgb: [15, 23, 42],
        surfaceBaseAlpha: 0.056,
        tintSurfaceAlpha: 0.096,
        borderRgb: [15, 23, 42],
        borderAlpha: 0.22,
        fgRgb: [26, 36, 52],
        fgTintMix: 0.24,
        borderTintMix: 0.26,
      },
      'alabaster-light': {
        surfaceRgb: [42, 32, 20],
        surfaceBaseAlpha: 0.062,
        tintSurfaceAlpha: 0.096,
        borderRgb: [42, 32, 20],
        borderAlpha: 0.23,
        fgRgb: [36, 30, 24],
        fgTintMix: 0.22,
        borderTintMix: 0.24,
      },
    };

    /* V14 Google DeepMind Official Spectrum HUD Gem Tokens */
    var CORE_FOUR_ELEMENTS = [
      { slotZ: 1, symbol: 'H' },
      { slotZ: 6, symbol: 'C' },
      { slotZ: 10, symbol: 'Ne' },
      { slotZ: 18, symbol: 'Ar' },
    ];

    var HUD_GEM_STYLES = {
      1: {
        dot: 'linear-gradient(135deg, #38BDF8 0%, #7DD3FC 55%, #BAE6FD 100%)',
        glow: 'rgba(56, 189, 248, 0.36)',
        ring: 'rgba(56, 189, 248, 0.24)',
        haloDark: 'rgba(56, 189, 248, 0.032)',
        haloLight: 'rgba(2, 132, 199, 0.024)',
      },
      6: {
        dot: 'linear-gradient(135deg, #2563EB 0%, #3B82F6 50%, #67E8F9 100%)',
        glow: 'rgba(59, 130, 246, 0.38)',
        ring: 'rgba(96, 165, 250, 0.26)',
        haloDark: 'rgba(59, 130, 246, 0.034)',
        haloLight: 'rgba(29, 78, 216, 0.024)',
      },
      10: {
        dot: 'linear-gradient(135deg, #FF5A3D 0%, #FF6B4A 52%, #FFB347 100%)',
        glow: 'rgba(255, 107, 74, 0.38)',
        ring: 'rgba(255, 138, 92, 0.25)',
        haloDark: 'rgba(255, 107, 74, 0.032)',
        haloLight: 'rgba(234, 88, 12, 0.024)',
      },
      18: {
        dot: 'linear-gradient(135deg, #3B66F5 0%, #7C5CFF 55%, #A78BFA 100%)',
        glow: 'rgba(124, 92, 255, 0.38)',
        ring: 'rgba(139, 92, 246, 0.26)',
        haloDark: 'rgba(124, 92, 255, 0.034)',
        haloLight: 'rgba(109, 40, 217, 0.024)',
      },
      fallback: {
        dot: 'linear-gradient(180deg, #60A5FA 0%, #3B82F6 100%)',
        glow: 'rgba(59, 130, 246, 0.34)',
        ring: 'rgba(96, 165, 250, 0.22)',
        haloDark: 'rgba(59, 130, 246, 0.048)',
        haloLight: 'rgba(37, 99, 235, 0.036)',
      },
      monoDark: {
        dot: 'linear-gradient(180deg, #F1F5F9 0%, #CBD5E1 100%)',
        glow: 'rgba(226, 232, 240, 0.36)',
        ring: 'rgba(226, 232, 240, 0.22)',
        haloDark: 'rgba(208, 216, 230, 0.058)',
        haloLight: 'rgba(100, 116, 139, 0.045)',
      },
      monoLight: {
        dot: 'linear-gradient(180deg, #334155 0%, #0F172A 100%)',
        glow: 'rgba(51, 65, 85, 0.26)',
        ring: 'rgba(51, 65, 85, 0.18)',
        haloDark: 'rgba(208, 216, 230, 0.058)',
        haloLight: 'rgba(71, 85, 105, 0.045)',
      },
    };

    function parseHexRgb255(hex, fallbackRgb) {
      var s = String(hex || '').trim();
      if (s.charAt(0) === '#') s = s.slice(1);
      if (s.length === 3) {
        s = s.charAt(0) + s.charAt(0) + s.charAt(1) + s.charAt(1) + s.charAt(2) + s.charAt(2);
      }
      if (s.length !== 6) return fallbackRgb || [136, 150, 172];
      var num = parseInt(s, 16);
      if (isNaN(num)) return fallbackRgb || [136, 150, 172];
      return [(num >> 16) & 255, (num >> 8) & 255, num & 255];
    }

    function lerpRgb255(a, b, t) {
      var k = t < 0 ? 0 : t > 1 ? 1 : t;
      return [
        Math.round(a[0] + (b[0] - a[0]) * k),
        Math.round(a[1] + (b[1] - a[1]) * k),
        Math.round(a[2] + (b[2] - a[2]) * k),
      ];
    }

    function rgba255Css(rgb, alpha) {
      var a = Math.round((alpha < 0 ? 0 : alpha > 1 ? 1 : alpha) * 1000) / 1000;
      return 'rgba(' + rgb[0] + ', ' + rgb[1] + ', ' + rgb[2] + ', ' + a + ')';
    }

    function rgb255ToHex(rgb) {
      var to2 = function (v) {
        var h = Math.max(0, Math.min(255, Math.round(v))).toString(16);
        return h.length === 1 ? '0' + h : h;
      };
      return ('#' + to2(rgb[0]) + to2(rgb[1]) + to2(rgb[2])).toUpperCase();
    }

    function resolveThemeNativeMiniBadgeColors(tintKey, profile) {
      var prof = profile || { id: 'obsidian-dark', isLight: false, isMono: false, accent: 'follow', primaryHex: '#669DF6' };
      var kitId = MINI_BADGE_THEME_SUBSTRATES[prof.id] ? prof.id : prof.isLight ? 'crystal-light' : 'obsidian-dark';
      var sub = MINI_BADGE_THEME_SUBSTRATES[kitId];

      if (prof.isMono || prof.accent === 'mono') {
        var monoFg = prof.isLight
          ? kitId === 'alabaster-light'
            ? '#3B352E'
            : '#334155'
          : kitId === 'warm-dark'
          ? '#CFC8BE'
          : '#C8CDD6';
        return {
          bg: rgba255Css(sub.surfaceRgb, sub.surfaceBaseAlpha + 0.012),
          fg: monoFg,
          border: rgba255Css(sub.borderRgb, sub.borderAlpha),
        };
      }

      var soulEntry = MINI_BADGE_SOUL_HEX[tintKey] || MINI_BADGE_SOUL_HEX.fallback;
      var soulHex = prof.isLight ? soulEntry.light : soulEntry.dark;
      var soulRgb = parseHexRgb255(soulHex, sub.fgRgb);

      var harmonyRgb = soulRgb;
      var acc = String(prof.accent || 'follow');
      if (acc === 'cobalt' || acc === 'iris' || acc === 'amber') {
        var hostAccRgb = parseHexRgb255(prof.primaryHex, soulRgb);
        harmonyRgb = lerpRgb255(hostAccRgb, soulRgb, 0.25);
      } else if (kitId === 'warm-dark' && tintKey === 'orchestrator') {
        harmonyRgb = [228, 182, 98];
      }

      var bgRgb = lerpRgb255(sub.surfaceRgb, harmonyRgb, 0.62);
      var borderRgb = lerpRgb255(sub.borderRgb, harmonyRgb, sub.borderTintMix);
      var fgRgb = lerpRgb255(sub.fgRgb, harmonyRgb, sub.fgTintMix);

      return {
        bg: rgba255Css(bgRgb, sub.tintSurfaceAlpha),
        fg: rgb255ToHex(fgRgb),
        border: rgba255Css(borderRgb, sub.borderAlpha + 0.04),
      };
    }

    /* V12 2026Q4 Authoritative Public Raw Benchmark Registry */
    var BENCHMARK_SOURCE_CITATION =
      'Artificial Analysis v5.0 · Terminal-Bench · SWE-bench (2026Q4)';
    var BENCHMARK_SOURCE_CITATION_SHORT = 'AA v5 · TermBench · SWE-bench (2026Q4)';

    var RADAR_AXES = [
      { key: 'aa', ar: 'AA v5', en: 'AA v5', vertexAr: 'الذكاء', vertexEn: 'AA' },
      { key: 'term', ar: 'TermBench', en: 'TermBench', vertexAr: 'الطرفية', vertexEn: 'Term' },
      { key: 'sci', ar: 'HLE-D', en: 'HLE-D', vertexAr: 'العلوم', vertexEn: 'Sci' },
      { key: 'swe', ar: 'SWE-Pro', en: 'SWE-Pro', vertexAr: 'الهندسة', vertexEn: 'SWE' },
      { key: 'tps', ar: 'السرعة', en: 'Velocity', vertexAr: 'السرعة', vertexEn: 'Speed' },
    ];

    var BENCHMARK_CEILINGS = {
      aa: 100,
      term: 100,
      'HLE-D': 100,
      'GPQA-D': 100,
      'MMLU-Pro': 100,
      'SWE-Pro': 100,
      AutoBench: 100,
      DeepSWE: 100,
      'SWE-Ver': 100,
      'SWE-Verified': 100,
      tps: 400,
    };

    var BENCHMARK_2026Q4_DB = {
      10: {
        sciName: 'HLE-D',
        sweName: 'AutoBench',
        tps: 110,
        tiers: {
          low: { aa: 47, term: 32.8, sci: 54.2, swe: 64.0 },
          medium: { aa: 55, term: 51.4, sci: 62.8, swe: 72.5 },
          high: { aa: 60, term: 61.9, sci: 68.4, swe: 77.8 },
          xhigh: { aa: 61, term: 63.6, sci: 71.3, swe: 79.3 },
        },
        defaultTier: 'high',
      },
      6: {
        sciName: 'HLE-D',
        sweName: 'SWE-Pro',
        tps: 68,
        tiers: {
          low: { aa: 50, term: 46.5, sci: 55.0, swe: 74.0 },
          medium: { aa: 56, term: 58.4, sci: 63.5, swe: 80.6 },
          high: { aa: 60, term: 65.2, sci: 69.1, swe: 84.5 },
        },
        defaultTier: 'high',
      },
      18: {
        sciName: 'HLE-D',
        sweName: 'AutoBench',
        tps: 82,
        tiers: {
          low: { aa: 42, term: 44.0, sci: 45.0, swe: 62.0 },
          medium: { aa: 47, term: 57.1, sci: 52.4, swe: 69.5 },
          high: { aa: 50, term: 55.1, sci: 56.7, swe: 72.4 },
        },
        defaultTier: 'high',
      },
      1: {
        sciName: 'HLE-D',
        sweName: 'AutoBench',
        tps: 168,
        tiers: {
          low: { aa: 38, term: 18.5, sci: 32.2, swe: 60.5 },
          medium: { aa: 46, term: 41.2, sci: 46.5, swe: 68.4 },
          high: { aa: 51, term: 54.0, sci: 54.6, swe: 74.2 },
          xhigh: { aa: 54, term: 53.5, sci: 58.8, swe: 76.1 },
        },
        defaultTier: 'high',
      },
      'claude-opus': {
        sciName: 'GPQA-D',
        sweName: 'SWE-Pro',
        tps: 54,
        tiers: {
          low: { aa: 51, term: 54.2, sci: 86.4, swe: 79.5 },
          medium: { aa: 57, term: 61.5, sci: 91.2, swe: 85.8 },
          high: { aa: 60, term: 66.4, sci: 93.9, swe: 89.9 },
        },
        defaultTier: 'high',
      },
      'claude-sonnet': {
        sciName: 'GPQA-D',
        sweName: 'SWE-Pro',
        tps: 88,
        tiers: {
          low: { aa: 46, term: 53.0, sci: 85.0, swe: 71.2 },
          medium: { aa: 52, term: 61.8, sci: 90.8, swe: 77.4 },
          high: { aa: 56, term: 70.6, sci: 94.1, swe: 81.3 },
        },
        defaultTier: 'high',
      },
      flash: {
        sciName: 'GPQA-D',
        sweName: 'DeepSWE',
        tps: 215,
        tiers: {
          low: { aa: 25, term: 14.2, sci: 84.0, swe: 64.2 },
          medium: { aa: 28, term: 17.5, sci: 91.5, swe: 70.1 },
          high: { aa: 31, term: 19.7, sci: 95.3, swe: 73.7 },
        },
        defaultTier: 'high',
      },
      'gpt-oss': {
        sciName: 'MMLU-Pro',
        sweName: 'SWE-Verified',
        tps: 135,
        tiers: {
          low: { aa: 44, term: 31.4, sci: 79.2, swe: 33.6 },
          medium: { aa: 44, term: 31.4, sci: 79.2, swe: 33.6 },
          high: { aa: 44, term: 31.4, sci: 79.2, swe: 33.6 },
        },
        defaultTier: 'high',
      },
    };

    var ELEMENT_SPEC_PROFILES = {
      1: {
        badge: '01 · H · AGILE',
        accentHex: '#38BDF8',
        secondaryHex: '#7DD3FC',
        accentHexLight: '#0284C7',
        secondaryHexLight: '#0EA5E9',
        glowRgba: 'rgba(56, 189, 248, 0.28)',
        roleTag: 'HIGH-THROUGHPUT',
        switchSpecAr: 'Sky-Ice Crystal',
        switchSpecEn: 'Sky-Ice Crystal',
        taglineAr: 'المجموعة 1 لافلز نشط · نواة استدلال متوازي سريعة وعالية التدفق',
        taglineEn: 'Group 1 Reactive Nonmetal · Agile High-Throughput Reasoning Core',
        scenesAr: ['بحث سريع', 'توازي 512K', 'كمون منخفض'],
        scenesEn: ['Fast Search', '512K Shard', 'Low Latency'],
      },
      6: {
        badge: '06 · C · PRO',
        accentHex: '#3B82F6',
        secondaryHex: '#67E8F9',
        accentHexLight: '#1D4ED8',
        secondaryHexLight: '#0284C7',
        glowRgba: 'rgba(59, 130, 246, 0.30)',
        roleTag: 'COBALT · PRO',
        switchSpecAr: 'Cobalt Diamond Prism',
        switchSpecEn: 'Cobalt Diamond Prism',
        taglineAr: 'المجموعة 14 نواة الكربون الرباعي · رائد التركيب العميق والمعمارية المعقدة',
        taglineEn: 'Group 14 Tetravalent Carbon · Flagship Deep Synthesis & Architecture',
        scenesAr: ['استدلال عميق', 'معمارية 512K', 'برمجة احترافية'],
        scenesEn: ['Reasoning', '512K Arch', 'Code Pro'],
      },
      10: {
        badge: '10 · Ne · FLOW',
        accentHex: '#FF6B4A',
        secondaryHex: '#FFB347',
        accentHexLight: '#EA580C',
        secondaryHexLight: '#D97706',
        glowRgba: 'rgba(255, 107, 74, 0.30)',
        roleTag: 'CORAL · FLOW',
        switchSpecAr: 'Coral-Gold Glass',
        switchSpecEn: 'Coral-Gold Glass',
        taglineAr: 'المجموعة 18 غاز نبيل · متعدد الوسائط منخفض الكمون وتصميم واجهات إبداعي',
        taglineEn: 'Group 18 Noble Gas · Luminous Low-Latency Multimodal & UI Craft',
        scenesAr: ['برمجة فورية', 'متعدد الوسائط', 'تصميم واجهات'],
        scenesEn: ['Live Coding', 'Multimodal', 'UI Craft'],
      },
      18: {
        badge: '18 · Ar · PRO',
        accentHex: '#7C5CFF',
        secondaryHex: '#4F7CFF',
        accentHexLight: '#6D28D9',
        secondaryHexLight: '#4338CA',
        glowRgba: 'rgba(124, 92, 255, 0.30)',
        roleTag: 'INDIGO · QA',
        switchSpecAr: 'Indigo-Violet Prism',
        switchSpecEn: 'Indigo-Violet Prism',
        taglineAr: 'المجموعة 18 غاز نبيل · تدقيق بصري عالي الجمالية وتحليل دقيق متوازن',
        taglineEn: 'Group 18 Noble Gas · High-Aesthetic Visual QA & Balanced Precision',
        scenesAr: ['تدقيق بصري', 'مراجعة 512K', 'تحليل دقيق'],
        scenesEn: ['Visual QA', '512K Audit', 'Precision'],
      },
      fallback: {
        badge: 'ELEMENT · SERIES',
        accentHex: '#60A5FA',
        secondaryHex: '#38BDF8',
        accentHexLight: '#2563EB',
        secondaryHexLight: '#0284C7',
        glowRgba: 'rgba(96, 165, 250, 0.24)',
        roleTag: 'ELEMENT CORE',
        switchSpecAr: 'Crystal Prism',
        switchSpecEn: 'Crystal Prism',
        taglineAr: 'سلسلة العناصر الكيميائية من Google · نواة أصلية طويلة السياق',
        taglineEn: 'Google Chemical Element Series · Native Long-Context Core',
        scenesAr: ['استدلال', 'توليد شيفرة', 'سياق 512K'],
        scenesEn: ['Reasoning', 'Code Gen', '512K Ctx'],
      },
    };

    var AUX_MODEL_PRESETS = [
      {
        id: 'orchestrator',
        oledAuxId: 'orchestrator',
        miniKey: 'orchestrator',
        shortLabel: 'Orch',
        subLabel: 'LATCH',
        badgeCode: 'ORCH',
        defaultTitle: 'Orchestrator',
        roleTag: 'DUAL-CORE',
        accentHex: '#8B5CF6',
        accentHexLight: '#6D28D9',
        secondaryHex: '#F5B942',
        secondaryHexLight: '#B45309',
        glowRgba: 'rgba(139, 92, 246, 0.32)',
        taglineAr: 'مفتاح تنسيق ثنائي النواة بقفل ذاتي · نواة التخطيط + تفريغ سريع إلى 1H',
        taglineEn: 'Dual-Core Latching Mode Switch · Planner Core + 1H Offload',
        scenesAr: ['ثنائي النواة', 'توجيه 512K', 'تفريغ 1H'],
        scenesEn: ['Dual-Core', '512K Route', '1H Offload'],
      },
      {
        id: 'flash',
        oledAuxId: 'flash',
        miniKey: 'flash',
        shortLabel: 'Flash',
        subLabel: '3.8',
        badgeCode: 'FLASH',
        defaultTitle: 'Gemini 3.8 Flash',
        roleTag: 'HYPER-SPEED',
        accentHex: '#00D4FF',
        accentHexLight: '#0284C7',
        secondaryHex: '#67E8F9',
        secondaryHexLight: '#0891B2',
        glowRgba: 'rgba(0, 212, 255, 0.30)',
        taglineAr: 'نواة استجابة فائقة السرعة دون الثانية · استكشاف الشيفرة والفرز السريع',
        taglineEn: 'Sub-Second Hyper-Velocity Core · Rapid Codebase Exploration & Triage',
        scenesAr: ['بحث فائق', 'فرز السجلات', 'توازي عالٍ'],
        scenesEn: ['Fast Search', 'Log Triage', 'Parallel'],
      },
      {
        id: 'claude-opus',
        oledAuxId: 'claude',
        miniKey: 'claude',
        shortLabel: 'Opus',
        subLabel: '5.5',
        badgeCode: 'OPUS',
        defaultTitle: 'Claude Opus 5.5',
        roleTag: 'ARTISAN · DEEP',
        accentHex: '#E07A48',
        accentHexLight: '#C25929',
        secondaryHex: '#F4A261',
        secondaryHexLight: '#B45309',
        glowRgba: 'rgba(224, 122, 72, 0.30)',
        taglineAr: 'نواة استدلال متقنة رائدة · تدقيق شيفرة عميق وتحليل معماري دقيق',
        taglineEn: 'Flagship Artisan Reasoning · Deep Code Audit & Nuanced Synthesis',
        scenesAr: ['تدقيق شيفرة', 'تشخيص عميق', 'إتقان'],
        scenesEn: ['Code Audit', 'Deep Debug', 'Craft'],
      },
      {
        id: 'claude-sonnet',
        oledAuxId: 'claude',
        miniKey: 'claude',
        shortLabel: 'Sonnet',
        subLabel: '5.5',
        badgeCode: 'SONNET',
        defaultTitle: 'Claude Sonnet 5.5',
        roleTag: 'AGILE · CODE',
        accentHex: '#D97742',
        accentHexLight: '#B45309',
        secondaryHex: '#F4B26A',
        secondaryHexLight: '#D97706',
        glowRgba: 'rgba(217, 119, 66, 0.28)',
        taglineAr: 'نواة برمجة رشيقة ومتوازنة · بناء سريع للواجهات وتكامل سلس مع الأدوات',
        taglineEn: 'Balanced Agile Coding Core · Rapid UI Engineering & Tool Use',
        scenesAr: ['هندسة واجهات', 'بناء سريع', 'استخدام أدوات'],
        scenesEn: ['UI Craft', 'Fast Build', 'Tool Use'],
      },
      {
        id: 'gpt-oss',
        oledAuxId: 'gpt',
        miniKey: 'gpt',
        shortLabel: 'GPT',
        subLabel: '120B',
        badgeCode: 'GPT',
        defaultTitle: 'GPT-OSS 120B',
        roleTag: 'MATRIX · LOGIC',
        accentHex: '#4FD1C5',
        accentHexLight: '#0F766E',
        secondaryHex: '#99F6E4',
        secondaryHexLight: '#0D9488',
        glowRgba: 'rgba(79, 209, 197, 0.28)',
        taglineAr: 'مصفوفة منطق مفتوحة الأوزان · تحقق متقاطع للخلفية واستدلال رياضي',
        taglineEn: 'Silver-Mint Logic Matrix · Backend Cross-Verification & Math',
        scenesAr: ['خوارزميات', 'تدقيق خلفي', 'فحص منطقي'],
        scenesEn: ['Algorithms', 'Audit', 'Logic Check'],
      },
      {
        id: 'blind',
        oledAuxId: 'standby',
        miniKey: 'fallback',
        shortLabel: '—',
        subLabel: 'LOCK',
        badgeCode: 'AUX',
        defaultTitle: 'Aux Macro Slot — Reserved',
        roleTag: 'RESERVED',
        accentHex: '#64748B',
        accentHexLight: '#475569',
        secondaryHex: '#475569',
        secondaryHexLight: '#334155',
        glowRgba: 'rgba(100, 116, 139, 0.22)',
        taglineAr: 'مفتاح توسعة محجوز على اللوحة المساعدة 2x3 من الألمنيوم المؤكسد',
        taglineEn: 'Bespoke CNC 2x3 Aux Macro Pad Reserved Anodized Blind Keycap',
        scenesAr: ['محجوز', 'مفتاح خامل', 'AUX-06'],
        scenesEn: ['Reserved', 'Blind Cap', 'AUX-06'],
      },
    ];

    function isArabicLangFlag(langOrFlag) {
      if (typeof langOrFlag === 'string') {
        var s = langOrFlag.trim().toLowerCase().replace(/_/g, '-');
        return s === 'ar' || s.indexOf('ar-') === 0 || s === 'arabic';
      }
      return false;
    }

    function normalizeArEffortWord(word) {
      var w = String(word || '').trim();
      if (w === 'فائق' || w === 'عالي جدا' || w === 'عالي جداً') return 'xhigh';
      if (w === 'أقصى') return 'max';
      if (w === 'متوسط') return 'medium';
      if (w === 'منخفض' || w === 'أدنى') return 'low';
      if (w === 'إيقاف' || w === 'مغلق') return 'off';
      if (w === 'تلقائي') return 'auto';
      if (w === 'عالي' || w === 'عميق') return 'high';
      return 'high';
    }
    var normalizeZhEffortWord = normalizeArEffortWord;

    function normalizeEnEffortWord(word) {
      var w = String(word || '').toLowerCase();
      if (w === 'extra') return 'xhigh';
      if (w === 'med') return 'medium';
      return w;
    }

    function stripEffortSuffixFromLabel(rawLabel) {
      var clean = String(rawLabel || '').replace(/^.*?\bcurrent:\s*/i, '').trim();
      var effort = '';
      var hasExplicit = false;
      var arM = AR_EFFORT_PAREN_RE.exec(clean);
      if (arM) {
        effort = normalizeArEffortWord(arM[1]);
        clean = clean.slice(0, arM.index).trim();
        hasExplicit = true;
      } else {
        var enM = EN_EFFORT_PAREN_RE.exec(clean);
        if (enM) {
          effort = normalizeEnEffortWord(enM[1]);
          clean = clean.slice(0, enM.index).trim();
          hasExplicit = true;
        } else {
          var bareEn = /\s+(extra\s+high|xhigh|extra|max|high|medium|med|low|minimal|off)\s*$/i.exec(clean);
          if (bareEn) {
            var rEff = bareEn[1].toLowerCase().replace(/\s+/g, '');
            effort = rEff === 'extrahigh' ? 'xhigh' : normalizeEnEffortWord(rEff);
            clean = clean.slice(0, bareEn.index).trim();
            hasExplicit = true;
          } else {
            var bareAr =
              /\s+(عالي جدا|عالي جداً|أقصى|فائق|عميق|متوسط|منخفض|أدنى|تلقائي|إيقاف|مغلق|عالي)\s*$/.exec(
                clean
              );
            if (bareAr) {
              effort = normalizeArEffortWord(bareAr[1]);
              clean = clean.slice(0, bareAr.index).trim();
              hasExplicit = true;
            }
          }
        }
      }
      return {
        baseName: clean || String(rawLabel || '').trim(),
        effort: effort && EFFORT_LABELS[effort] ? effort : '',
        hasExplicitEffort: hasExplicit,
      };
    }

    /**
     * Parse a raw model label or host modelOption into a Google chemical element descriptor.
     * Strictly rejects Orchestrator, Flash, Claude, GPT/OpenAI/Codex, and custom models.
     */
    function parseElementModelLabel(input) {
      if (!input) return null;
      var rawLabel = '';
      var modelId = '';
      if (typeof input === 'string') {
        rawLabel = input.trim();
      } else if (typeof input === 'object') {
        if (input.isCustom) return null;
        rawLabel = typeof input.label === 'string' ? input.label.trim() : '';
        modelId = typeof input.modelId === 'string' ? input.modelId.trim() : '';
      }
      if (!rawLabel) return null;
      if (EXCLUDED_FAMILY_RE.test(rawLabel) || (modelId && EXCLUDED_FAMILY_RE.test(modelId))) {
        return null;
      }

      var baseName = rawLabel.replace(/^.*?\bcurrent:\s*/i, '').trim();
      var effort = '';
      var hasExplicitEffort = false;

      var arMatch = AR_EFFORT_PAREN_RE.exec(baseName);
      if (arMatch) {
        effort = normalizeArEffortWord(arMatch[1]);
        baseName = baseName.slice(0, arMatch.index).trim();
        hasExplicitEffort = true;
      } else {
        var enMatch = EN_EFFORT_PAREN_RE.exec(baseName);
        if (enMatch) {
          effort = normalizeEnEffortWord(enMatch[1]);
          baseName = baseName.slice(0, enMatch.index).trim();
          hasExplicitEffort = true;
        } else {
          var bareEnMatch = /\s+(extra\s+high|xhigh|extra|max|high|medium|med|low|minimal|off)\s*$/i.exec(baseName);
          if (bareEnMatch) {
            var rawEff = bareEnMatch[1].toLowerCase().replace(/\s+/g, '');
            effort = rawEff === 'extrahigh' ? 'xhigh' : normalizeEnEffortWord(rawEff);
            baseName = baseName.slice(0, bareEnMatch.index).trim();
            hasExplicitEffort = true;
          } else {
            var bareArMatch =
              /\s+(عالي جدا|عالي جداً|أقصى|فائق|عميق|متوسط|منخفض|أدنى|تلقائي|إيقاف|مغلق|عالي)\s*$/.exec(
                baseName
              );
            if (bareArMatch) {
              effort = normalizeArEffortWord(bareArMatch[1]);
              baseName = baseName.slice(0, bareArMatch.index).trim();
              hasExplicitEffort = true;
            }
          }
        }
      }

      if (!baseName || EXCLUDED_FAMILY_RE.test(baseName)) return null;
      if (effort === 'auto') return null;

      var tokens = baseName
        .replace(/[^a-zA-Z0-9.]+/g, ' ')
        .trim()
        .split(/\s+/)
        .filter(Boolean);
      if (!tokens.length) return null;

      var hasGooglePrefix = /\b(?:gemini|google)\b/i.test(baseName) || /\bgemini\b/i.test(modelId);
      if (!hasGooglePrefix) return null;

      var matchedElement = null;
      for (var i = tokens.length - 1; i >= 0; i -= 1) {
        var tok = tokens[i].toLowerCase();
        if (tok === 'gemini' || tok === 'google') continue;
        if (/^\d+(?:\.\d+)*$/.test(tok)) continue;
        var elHit = ELEMENT_BY_NAME.get(tok);
        if (elHit) {
          matchedElement = elHit;
          break;
        }
        return null;
      }

      if (!matchedElement) return null;
      var normEffort = effort && EFFORT_LABELS[effort] ? effort : 'medium';
      var slot = SLOT_BY_Z.get(matchedElement.slotZ) || matchedElement;

      return {
        z: matchedElement.z,
        slotZ: slot.z,
        symbol: slot.symbol,
        elementSymbol: matchedElement.symbol,
        name: slot.name,
        elementName: matchedElement.name,
        ar: slot.ar,
        mass: slot.mass,
        group: slot.group,
        baseName: baseName,
        effort: normEffort,
        effortLabel: hasExplicitEffort ? EFFORT_LABELS[normEffort] || normEffort : 'Default',
        hasExplicitEffort: hasExplicitEffort,
      };
    }

    /**
     * Match & aggregate Google chemical element models from host `modelOptions` (and optional `effortIndex`).
     * Returns a sorted Array of matched element entries, augmented with `.byZ` and `.bySymbol` Maps.
     */
    function matchGoogleElementModels(modelOptions, effortIndex) {
      var grouped = new Map();

      function ingestOption(opt, forcedEffort) {
        if (!opt) return;
        var optionObj = typeof opt === 'string' ? { label: opt, value: opt } : opt;
        if (typeof optionObj.label !== 'string') return;
        var parsed = parseElementModelLabel(optionObj);
        if (!parsed) return;

        var eff = forcedEffort ? normalizeEnEffortWord(forcedEffort) : parsed.effort;
        if (!EFFORT_LABELS[eff]) eff = parsed.effort || 'medium';

        var entry = grouped.get(parsed.slotZ);
        if (!entry) {
          var slot = SLOT_BY_Z.get(parsed.slotZ);
          entry = {
            z: parsed.z,
            slotZ: parsed.slotZ,
            symbol: slot ? slot.symbol : parsed.symbol,
            name: parsed.elementName || parsed.name,
            ar: slot ? slot.ar : parsed.ar,
            mass: slot ? slot.mass : parsed.mass,
            group: slot ? slot.group : parsed.group,
            baseName: parsed.baseName,
            _byEffort: new Map(),
          };
          grouped.set(parsed.slotZ, entry);
        }
        if (!entry._byEffort.has(eff)) {
          entry._byEffort.set(eff, {
            effort: eff,
            label: parsed.hasExplicitEffort || forcedEffort ? EFFORT_LABELS[eff] || eff : 'Default',
            option: optionObj,
            modelOption: optionObj,
          });
        }
      }

      if (Array.isArray(modelOptions)) {
        for (var i = 0; i < modelOptions.length; i += 1) {
          ingestOption(modelOptions[i], '');
        }
      }

      if (effortIndex instanceof Map) {
        effortIndex.forEach(function (innerMap) {
          if (!(innerMap instanceof Map)) return;
          innerMap.forEach(function (opt, effKey) {
            ingestOption(opt, String(effKey || ''));
          });
        });
      }

      var result = [];
      var byZ = new Map();
      var bySymbol = new Map();

      var sortedKeys = Array.from(grouped.keys()).sort(function (a, b) {
        return a - b;
      });

      for (var k = 0; k < sortedKeys.length; k += 1) {
        var slotZ = sortedKeys[k];
        var raw = grouped.get(slotZ);
        var levels = [];
        for (var ei = 0; ei < EFFORT_ORDER.length; ei += 1) {
          var ek = EFFORT_ORDER[ei];
          if (raw._byEffort.has(ek)) {
            levels.push(raw._byEffort.get(ek));
          }
        }
        var finalized = {
          z: raw.z,
          slotZ: raw.slotZ,
          symbol: raw.symbol,
          name: raw.name,
          elementName: raw.name,
          ar: raw.ar,
          mass: raw.mass,
          group: raw.group,
          baseName: raw.baseName,
          levels: levels,
          defaultOption: levels.length ? levels[levels.length - 1].option : null,
        };
        result.push(finalized);
        byZ.set(slotZ, finalized);
        bySymbol.set(finalized.symbol, finalized);
      }

      Object.defineProperty(result, 'byZ', { value: byZ, enumerable: false });
      Object.defineProperty(result, 'bySymbol', { value: bySymbol, enumerable: false });
      return result;
    }

    /**
     * Resolve 2026Q4 public benchmark metrics for a known model key.
     * Unknown / unbenchmarked models strictly return `{ isKnownBenchmark: false, scores: null }`
     * and NEVER fall back to Carbon (6) or GPT-OSS scores.
     */
    function resolveBenchmarkMetrics(benchKey, effortCode, langOrFlag, isAvailable) {
      var useAr = isArabicLangFlag(langOrFlag);
      var normEff = String(effortCode || '').toLowerCase();

      if (isAvailable === false) {
        return {
          isKnownBenchmark: false,
          scores: null,
          ratios: null,
          rawValues: null,
          rows: [],
          compactText: useAr ? 'خانة مقفلة' : 'Locked Slot',
          effort: normEff,
          isAvailable: false,
        };
      }

      var hasRecord =
        benchKey !== undefined &&
        benchKey !== null &&
        Object.prototype.hasOwnProperty.call(BENCHMARK_2026Q4_DB, benchKey);
      var rec = hasRecord ? BENCHMARK_2026Q4_DB[benchKey] : null;
      if (!rec) {
        return {
          isKnownBenchmark: false,
          scores: null,
          ratios: null,
          rawValues: null,
          rows: [],
          compactText: useAr ? 'لا توجد بيانات قياس' : 'No Benchmark Data',
          effort: normEff,
          isAvailable: true,
        };
      }

      if (normEff === 'max' || normEff === 'extra') normEff = 'xhigh';
      if (normEff === 'minimal' || normEff === 'off') normEff = 'low';
      var tier =
        rec.tiers[normEff] ||
        (normEff === 'xhigh' && rec.tiers.high) ||
        rec.tiers[rec.defaultTier] ||
        rec.tiers.high ||
        rec.tiers.medium;

      var sciCeil = BENCHMARK_CEILINGS[rec.sciName] || 100;
      var sweCeil = BENCHMARK_CEILINGS[rec.sweName] || 100;
      var r0 = Math.max(0.06, Math.min(1.0, tier.aa / BENCHMARK_CEILINGS.aa));
      var r1 = Math.max(0.06, Math.min(1.0, tier.term / BENCHMARK_CEILINGS.term));
      var r2 = Math.max(0.06, Math.min(1.0, tier.sci / sciCeil));
      var r3 = Math.max(0.06, Math.min(1.0, tier.swe / sweCeil));
      var r4 = Math.max(0.06, Math.min(1.0, rec.tps / BENCHMARK_CEILINGS.tps));

      var sweDisplayLbl = rec.sweName === 'SWE-Verified' ? 'SWE-Ver' : rec.sweName;
      var aaStr = String(tier.aa);
      var termStr = tier.term.toFixed(1) + '%';
      var sciStr = tier.sci.toFixed(1) + '%';
      var sweStr = tier.swe.toFixed(1) + '%';
      var tpsStr = rec.tps + ' tok/s';
      var scoresArr = [r0, r1, r2, r3, r4];

      return {
        isKnownBenchmark: true,
        scores: scoresArr,
        ratios: scoresArr.slice(),
        rawValues: [tier.aa, tier.term, tier.sci, tier.swe, rec.tps],
        rows: [
          { label: 'AA v5', valText: aaStr, fillPct: Math.round(r0 * 100), raw: tier.aa, unit: 'int' },
          { label: 'TermBench', valText: termStr, fillPct: Math.round(r1 * 100), raw: tier.term, unit: 'pct' },
          { label: rec.sciName, valText: sciStr, fillPct: Math.round(r2 * 100), raw: tier.sci, unit: 'pct' },
          { label: sweDisplayLbl, valText: sweStr, fillPct: Math.round(r3 * 100), raw: tier.swe, unit: 'pct' },
          { label: useAr ? 'السرعة' : 'Velocity', valText: tpsStr, fillPct: Math.round(r4 * 100), raw: rec.tps, unit: 'tps' },
        ],
        compactText: 'AA ' + aaStr + ' · Term ' + termStr + ' · ' + tpsStr,
        effort: normEff || rec.defaultTier,
        isAvailable: true,
      };
    }

    function readNativeOptionDescription(optionObj) {
      if (!optionObj || typeof optionObj !== 'object') return '';
      var cand =
        typeof optionObj.description === 'string'
          ? optionObj.description
          : typeof optionObj.subtitle === 'string'
          ? optionObj.subtitle
          : typeof optionObj.detail === 'string'
          ? optionObj.detail
          : '';
      return cand.trim();
    }

    function buildNeutralAuxPreset(id, baseName, shortLabel, subLabel, badgeCode, nativeDesc, styleHint) {
      var title = baseName || shortLabel || 'Native Model';
      var desc = nativeDesc ? String(nativeDesc).trim() : '';
      var isClaudeFamily = styleHint === 'claude';
      return {
        id: id,
        oledAuxId: isClaudeFamily ? 'claude' : 'standby',
        miniKey: isClaudeFamily ? 'claude' : 'fallback',
        shortLabel: shortLabel || 'Aux',
        subLabel: subLabel || 'EXT',
        badgeCode: badgeCode || 'AUX',
        defaultTitle: title,
        roleTag: isClaudeFamily ? 'CLAUDE · NATIVE' : 'NATIVE · MODEL',
        accentHex: isClaudeFamily ? '#D97742' : '#8EA4C8',
        accentHexLight: isClaudeFamily ? '#B45309' : '#475569',
        secondaryHex: isClaudeFamily ? '#F4B26A' : '#A5B4FC',
        secondaryHexLight: isClaudeFamily ? '#D97706' : '#64748B',
        glowRgba: isClaudeFamily ? 'rgba(217, 119, 66, 0.24)' : 'rgba(142, 164, 200, 0.24)',
        taglineAr: desc || title + ' · إعداد نموذج أصلي (لا توجد بيانات قياس 2026Q4)',
        taglineEn: desc || title + ' · Native model configuration (no benchmark data)',
        scenesAr: ['نموذج أصلي', 'التفكير', 'خانة توسعة'],
        scenesEn: ['Native', 'Thinking', 'Ext Slot'],
      };
    }

    function extractShortToken(baseName) {
      var cleanShort = String(baseName || '')
        .replace(/[^A-Za-z0-9]+/g, ' ')
        .trim()
        .split(/\s+/)[0] || 'Aux';
      if (cleanShort.length > 6) cleanShort = cleanShort.slice(0, 6);
      return cleanShort;
    }

    function extractSubVersionToken(baseName) {
      var mSize = /\b(\d+[bBmM])\b/.exec(baseName);
      if (mSize) return mSize[1].toUpperCase();
      var mVer = /\b([vVrR]?\d+(?:\.\d+)?)\b/.exec(baseName);
      if (mVer) return mVer[1].toUpperCase();
      return 'EXT';
    }

    /**
     * Classify a non-element host model option without ever borrowing GPT-OSS preset/scores
     * for unknown or unbenchmarked models.
     */
    function classifyNonElementOption(optionObj, forcedEffortKey) {
      var opt = typeof optionObj === 'string' ? { label: optionObj, value: optionObj } : optionObj || {};
      var rawLabel = typeof opt.label === 'string' ? opt.label.trim() : '';
      var modelId = typeof opt.modelId === 'string' ? opt.modelId.trim() : '';
      var nativeDesc = readNativeOptionDescription(opt);
      var hay = (rawLabel + ' ' + modelId).toLowerCase();

      if (/orchestrator|المنسق|المجدول/.test(hay)) {
        var isVariant = /\(/.test(rawLabel);
        return {
          groupKey: 'orchestrator',
          priority: 0,
          preset: AUX_MODEL_PRESETS[0],
          baseName: 'Orchestrator',
          nativeDescription: nativeDesc,
          variantEffort: '',
          variantLabel: '',
          preferAsDefault: !isVariant,
          isKnownBenchmark: false,
        };
      }

      var stripped = stripEffortSuffixFromLabel(rawLabel);
      var effResolved = forcedEffortKey ? normalizeEnEffortWord(forcedEffortKey) : stripped.effort;
      var hasExp = Boolean(forcedEffortKey || stripped.hasExplicitEffort);
      if (!EFFORT_LABELS[effResolved]) effResolved = '';

      if (/\bflash\b/.test(hay)) {
        var verFlash = /\b(\d+\.\d+)\b/.exec(stripped.baseName);
        var fEff = effResolved || 'high';
        return {
          groupKey: 'flash',
          priority: 1,
          preset: AUX_MODEL_PRESETS[1],
          baseName: stripped.baseName,
          nativeDescription: nativeDesc,
          subLabelOverride: verFlash ? verFlash[1] : 'FAST',
          variantEffort: fEff,
          variantLabel: hasExp ? EFFORT_LABELS[fEff] || fEff : 'Adaptive',
          preferAsDefault: !hasExp || fEff === 'high',
          isKnownBenchmark: true,
        };
      }

      if (/\bopus\b/.test(hay)) {
        var verOpus = /\b(\d+(?:\.\d+)?)\b/.exec(stripped.baseName);
        var oEff = effResolved || 'high';
        return {
          groupKey: 'claude-opus',
          priority: 2,
          preset: AUX_MODEL_PRESETS[2],
          baseName: stripped.baseName,
          nativeDescription: nativeDesc,
          subLabelOverride: verOpus ? verOpus[1] : 'DEEP',
          variantEffort: oEff,
          variantLabel: hasExp ? EFFORT_LABELS[oEff] || oEff : 'High',
          preferAsDefault: !hasExp || oEff === 'high',
          isKnownBenchmark: true,
        };
      }

      if (/\bsonnet\b/.test(hay)) {
        var verSonnet = /\b(\d+(?:\.\d+)?)\b/.exec(stripped.baseName);
        var sEff = effResolved || 'high';
        return {
          groupKey: 'claude-sonnet',
          priority: 3,
          preset: AUX_MODEL_PRESETS[3],
          baseName: stripped.baseName,
          nativeDescription: nativeDesc,
          shortLabelOverride: 'Sonnet',
          badgeCodeOverride: 'SONNET',
          subLabelOverride: verSonnet ? verSonnet[1] : 'CODE',
          variantEffort: sEff,
          variantLabel: hasExp ? EFFORT_LABELS[sEff] || sEff : 'Adaptive',
          preferAsDefault: !hasExp || sEff === 'high',
          isKnownBenchmark: true,
        };
      }

      if (/\b(?:haiku|claude|anthropic)\b/.test(hay)) {
        var isHaiku = /\bhaiku\b/.test(hay);
        var clShort = isHaiku ? 'Haiku' : 'Claude';
        var clBadge = isHaiku ? 'HAIKU' : 'CLAUDE';
        var clSub = extractSubVersionToken(stripped.baseName);
        var clEff = effResolved || 'high';
        var clGroup = isHaiku ? 'claude-haiku' : 'custom:' + stripped.baseName.toLowerCase();
        return {
          groupKey: clGroup,
          priority: isHaiku ? 3.5 : 3.7,
          preset: buildNeutralAuxPreset(clGroup, stripped.baseName, clShort, clSub, clBadge, nativeDesc, 'claude'),
          baseName: stripped.baseName,
          nativeDescription: nativeDesc,
          shortLabelOverride: clShort,
          badgeCodeOverride: clBadge,
          subLabelOverride: clSub,
          variantEffort: clEff,
          variantLabel: hasExp ? EFFORT_LABELS[clEff] || clEff : 'Default',
          preferAsDefault: !hasExp || clEff === 'high',
          isKnownBenchmark: false,
        };
      }

      if (/\bgpt[-_\s]?oss\b/.test(hay)) {
        var subGpt = /\b(\d+[bB])\b/.exec(stripped.baseName);
        var gEff = effResolved || 'medium';
        return {
          groupKey: 'gpt-oss',
          priority: 4,
          preset: AUX_MODEL_PRESETS[4],
          baseName: stripped.baseName,
          nativeDescription: nativeDesc,
          shortLabelOverride: 'GPT',
          badgeCodeOverride: 'GPT',
          subLabelOverride: subGpt ? subGpt[1].toUpperCase() : 'OSS',
          variantEffort: gEff,
          variantLabel: hasExp ? EFFORT_LABELS[gEff] || gEff : 'Adaptive',
          preferAsDefault: !hasExp || gEff === 'high' || gEff === 'medium',
          isKnownBenchmark: true,
        };
      }

      var cleanShort = extractShortToken(stripped.baseName);
      var cleanSub = extractSubVersionToken(stripped.baseName);
      var cleanBadge = cleanShort.toUpperCase();
      var customKey = 'custom:' + stripped.baseName.toLowerCase();
      var cEff = effResolved || 'high';
      return {
        groupKey: customKey,
        priority: 5,
        preset: buildNeutralAuxPreset(customKey, stripped.baseName, cleanShort, cleanSub, cleanBadge, nativeDesc, ''),
        baseName: stripped.baseName,
        nativeDescription: nativeDesc,
        shortLabelOverride: cleanShort,
        badgeCodeOverride: cleanBadge,
        subLabelOverride: cleanSub,
        variantEffort: cEff,
        variantLabel: hasExp ? EFFORT_LABELS[cEff] || cEff : 'Default',
        preferAsDefault: true,
        isKnownBenchmark: false,
      };
    }

    function buildBlindAuxSlot(slotIndex) {
      var bp = AUX_MODEL_PRESETS[5];
      return {
        slotIndex: slotIndex,
        auxIndex: slotIndex,
        id: 'blind-' + slotIndex,
        groupKey: 'blind-' + slotIndex,
        oledAuxId: 'standby',
        miniKey: 'fallback',
        shortLabel: bp.shortLabel,
        subLabel: bp.subLabel,
        badgeCode: bp.badgeCode,
        title: bp.defaultTitle,
        roleTag: bp.roleTag,
        accentHex: bp.accentHex,
        accentHexLight: bp.accentHexLight,
        secondaryHex: bp.secondaryHex,
        secondaryHexLight: bp.secondaryHexLight,
        glowRgba: bp.glowRgba,
        taglineAr: bp.taglineAr,
        taglineEn: bp.taglineEn,
        tagline: bp.taglineEn,
        scenesAr: bp.scenesAr,
        scenesEn: bp.scenesEn,
        scenes: bp.scenesEn.slice(),
        nativeDescription: '',
        isKnownBenchmark: false,
        scores: null,
        available: false,
        levels: [],
        defaultOption: null,
        allOptions: [],
      };
    }

    function unwrapAuxList(list) {
      if (Array.isArray(list)) return list;
      if (list && Array.isArray(list.allAuxModels)) return list.allAuxModels;
      return [];
    }

    function getAuxPageCount(list) {
      var arr = unwrapAuxList(list);
      if (!arr.length) return 0;
      return Math.ceil(arr.length / AUX_PAGE_SIZE);
    }

    function getAuxPageSlice(list, page) {
      var arr = unwrapAuxList(list);
      if (!arr.length) return [];
      var pageCount = Math.ceil(arr.length / AUX_PAGE_SIZE);
      var p = Number(page);
      if (!Number.isFinite(p) || p < 0) p = 0;
      p = Math.floor(p);
      if (p >= pageCount) p = pageCount - 1;
      var start = p * AUX_PAGE_SIZE;
      return arr.slice(start, start + AUX_PAGE_SIZE);
    }

    function findAuxPageForId(list, id) {
      var arr = unwrapAuxList(list);
      if (!arr.length || id === undefined || id === null || id === '') return -1;
      var target = String(id).trim().toLowerCase();
      for (var i = 0; i < arr.length; i += 1) {
        var item = arr[i];
        if (!item) continue;
        if (
          (item.id !== undefined && String(item.id).toLowerCase() === target) ||
          (item.groupKey !== undefined && String(item.groupKey).toLowerCase() === target) ||
          (item.title !== undefined && String(item.title).toLowerCase() === target) ||
          (item.defaultOption &&
            ((item.defaultOption.modelId && String(item.defaultOption.modelId).toLowerCase() === target) ||
              (item.defaultOption.value && String(item.defaultOption.value).toLowerCase() === target) ||
              (item.defaultOption.label && String(item.defaultOption.label).toLowerCase() === target)))
        ) {
          return Math.floor(i / AUX_PAGE_SIZE);
        }
      }
      return -1;
    }

    /**
     * Pad any page slice (< 6 items) to a full 6-slot 2x3 macro pad page with blind keycaps.
     */
    function padAuxPageSlots(pageSlice) {
      var out = Array.isArray(pageSlice) ? pageSlice.slice(0, AUX_PAGE_SIZE) : [];
      for (var i = out.length; i < AUX_PAGE_SIZE; i += 1) {
        out.push(buildBlindAuxSlot(i));
      }
      return out;
    }

    /**
     * Extract all non-element host models into a sorted array (zero 6-slot truncation).
     * Slot #0 is prioritized for Orchestrator latching toggle when present.
     * Augments the returned array with non-enumerable `.allAuxModels` (all real matched models)
     * and supports pagination via `AUX_PAGE_SIZE`, `getAuxPageCount`, `getAuxPageSlice`, `findAuxPageForId`.
     */
    function matchHostAuxModels(modelOptions, effortIndex, orchestratorPlanners, options) {
      var opts = options && typeof options === 'object' ? options : {};
      var useAr = Boolean(opts.ar || isArabicLangFlag(opts.lang));
      var langArg = useAr ? 'ar' : 'en';
      var hasHostMenu = Array.isArray(modelOptions) && modelOptions.length > 0;

      if (!hasHostMenu) {
        var demoOut = [];
        var demoReal = [];
        for (var di = 0; di < AUX_PAGE_SIZE; di += 1) {
          var dp = AUX_MODEL_PRESETS[di];
          var isDemoAvail = di < 5;
          var demoOpt = isDemoAvail
            ? { label: dp.defaultTitle, value: dp.id, modelId: dp.id }
            : null;
          var demoBench = resolveBenchmarkMetrics(dp.id, 'high', langArg, isDemoAvail);
          var demoSlot = {
            slotIndex: di,
            auxIndex: di,
            id: dp.id,
            groupKey: dp.id,
            oledAuxId: dp.oledAuxId,
            miniKey: dp.miniKey,
            shortLabel: dp.shortLabel,
            subLabel: dp.subLabel,
            badgeCode: dp.badgeCode,
            title: dp.defaultTitle,
            roleTag: dp.roleTag,
            accentHex: dp.accentHex,
            accentHexLight: dp.accentHexLight || dp.accentHex,
            secondaryHex: dp.secondaryHex,
            secondaryHexLight: dp.secondaryHexLight || dp.secondaryHex,
            glowRgba: dp.glowRgba,
            taglineAr: dp.taglineAr,
            taglineEn: dp.taglineEn,
            tagline: useAr ? dp.taglineAr : dp.taglineEn,
            scenesAr: dp.scenesAr,
            scenesEn: dp.scenesEn,
            scenes: (useAr ? dp.scenesAr : dp.scenesEn).slice(),
            nativeDescription: '',
            isKnownBenchmark: Boolean(demoBench.isKnownBenchmark),
            scores: demoBench.isKnownBenchmark && demoBench.scores ? demoBench.scores.slice() : null,
            available: isDemoAvail,
            levels:
              isDemoAvail && dp.id !== 'orchestrator'
                ? [{ effort: 'high', label: 'Adaptive', option: demoOpt, modelOption: demoOpt }]
                : [],
            defaultOption: demoOpt,
            allOptions: demoOpt ? [demoOpt] : [],
          };
          demoOut.push(demoSlot);
          if (isDemoAvail) demoReal.push(demoSlot);
        }
        Object.defineProperty(demoOut, 'allAuxModels', { value: demoReal, enumerable: false });
        return demoOut;
      }

      var groups = new Map();
      var orderCounter = 0;

      function ingestAuxOpt(rawOpt, forcedEffKey) {
        if (!rawOpt) return;
        var optObj =
          typeof rawOpt === 'string'
            ? { label: rawOpt, value: rawOpt }
            : rawOpt.nodeType === 1
            ? { label: String(rawOpt.textContent || '').trim(), _domNode: rawOpt }
            : rawOpt;
        if (!optObj || typeof optObj.label !== 'string' || !optObj.label.trim()) return;
        if (parseElementModelLabel(optObj)) return;

        var cls = classifyNonElementOption(optObj, forcedEffKey);
        var g = groups.get(cls.groupKey);
        if (!g) {
          g = {
            groupKey: cls.groupKey,
            priority: cls.priority,
            order: orderCounter++,
            preset: cls.preset,
            baseName: cls.baseName,
            nativeDescription: cls.nativeDescription || '',
            shortLabel: cls.shortLabelOverride || cls.preset.shortLabel,
            subLabel: cls.subLabelOverride || cls.preset.subLabel,
            badgeCode: cls.badgeCodeOverride || cls.preset.badgeCode,
            byEffort: new Map(),
            defaultOption: optObj,
            hasPreferredDefault: Boolean(cls.preferAsDefault),
            allOptions: [],
          };
          groups.set(cls.groupKey, g);
        } else if (!g.nativeDescription && cls.nativeDescription) {
          g.nativeDescription = cls.nativeDescription;
        }

        if (g.allOptions.indexOf(optObj) === -1) {
          g.allOptions.push(optObj);
        }
        if (!g.hasPreferredDefault && cls.preferAsDefault) {
          g.defaultOption = optObj;
          g.hasPreferredDefault = true;
        }
        if (cls.groupKey !== 'orchestrator') {
          var effCode = cls.variantEffort || 'high';
          if (!g.byEffort.has(effCode)) {
            g.byEffort.set(effCode, {
              effort: effCode,
              label: cls.variantLabel || 'Adaptive',
              option: optObj,
              modelOption: optObj,
            });
          }
        }
      }

      for (var i = 0; i < modelOptions.length; i += 1) {
        ingestAuxOpt(modelOptions[i], '');
      }
      if (effortIndex instanceof Map) {
        effortIndex.forEach(function (innerMap) {
          if (!(innerMap instanceof Map)) return;
          innerMap.forEach(function (opt, effKey) {
            ingestAuxOpt(opt, String(effKey || ''));
          });
        });
      }
      if (Array.isArray(orchestratorPlanners)) {
        for (var pi = 0; pi < orchestratorPlanners.length; pi += 1) {
          var pOpt = orchestratorPlanners[pi];
          if (pOpt && !parseElementModelLabel(pOpt) && groups.size > 0) {
            var pCls = classifyNonElementOption(pOpt, '');
            if (groups.has(pCls.groupKey)) {
              ingestAuxOpt(pOpt, '');
            }
          }
        }
      }

      var sortedGroups = Array.from(groups.values()).sort(function (a, b) {
        if (a.priority !== b.priority) return a.priority - b.priority;
        return a.order - b.order;
      });

      var totalSlots = Math.max(AUX_PAGE_SIZE, sortedGroups.length);
      var slots = [];
      var realAuxModels = [];

      for (var k = 0; k < totalSlots; k += 1) {
        if (k < sortedGroups.length) {
          var sg = sortedGroups[k];
          var pr = sg.preset;
          var orderedLevels = [];
          for (var ei = 0; ei < EFFORT_ORDER.length; ei += 1) {
            var ek = EFFORT_ORDER[ei];
            if (sg.byEffort.has(ek)) {
              orderedLevels.push(sg.byEffort.get(ek));
            }
          }
          sg.byEffort.forEach(function (lvObj, lvKey) {
            if (EFFORT_ORDER.indexOf(lvKey) === -1) {
              orderedLevels.push(lvObj);
            }
          });
          if (orderedLevels.length >= 2) {
            for (var li = 0; li < orderedLevels.length; li += 1) {
              if (EFFORT_LABELS[orderedLevels[li].effort]) {
                orderedLevels[li].label = EFFORT_LABELS[orderedLevels[li].effort];
              }
            }
          }

          var slotId = sg.groupKey;
          var initBench = resolveBenchmarkMetrics(slotId, 'high', langArg, true);
          var taglineAr = sg.nativeDescription || pr.taglineAr;
          var taglineEn = sg.nativeDescription || pr.taglineEn;
          var slotItem = {
            slotIndex: k,
            auxIndex: k,
            id: slotId,
            groupKey: sg.groupKey,
            oledAuxId: pr.oledAuxId,
            miniKey: pr.miniKey,
            shortLabel: sg.shortLabel,
            subLabel: sg.subLabel,
            badgeCode: sg.badgeCode,
            title: sg.baseName,
            roleTag: pr.roleTag,
            accentHex: pr.accentHex,
            accentHexLight: pr.accentHexLight || pr.accentHex,
            secondaryHex: pr.secondaryHex,
            secondaryHexLight: pr.secondaryHexLight || pr.secondaryHex,
            glowRgba: pr.glowRgba,
            taglineAr: taglineAr,
            taglineEn: taglineEn,
            tagline: useAr ? taglineAr : taglineEn,
            scenesAr: pr.scenesAr,
            scenesEn: pr.scenesEn,
            scenes: (useAr ? pr.scenesAr : pr.scenesEn).slice(),
            nativeDescription: sg.nativeDescription || '',
            isKnownBenchmark: Boolean(initBench.isKnownBenchmark),
            scores: initBench.isKnownBenchmark && initBench.scores ? initBench.scores.slice() : null,
            available: true,
            levels: orderedLevels,
            defaultOption: sg.defaultOption,
            allOptions: sg.allOptions,
          };
          slots.push(slotItem);
          realAuxModels.push(slotItem);
        } else {
          slots.push(buildBlindAuxSlot(k));
        }
      }

      Object.defineProperty(slots, 'allAuxModels', { value: realAuxModels, enumerable: false });
      return slots;
    }

    function getGroupLabel(group, langOrFlag) {
      var useAr = isArabicLangFlag(langOrFlag);
      var meta = GROUP_META[group] || GROUP_META.transition;
      return useAr ? meta.ar : meta.en;
    }

    function getElementSpecProfile(z) {
      return ELEMENT_SPEC_PROFILES[z] || ELEMENT_SPEC_PROFILES.fallback;
    }

    function getElementLore(z, langOrFlag) {
      var useAr = isArabicLangFlag(langOrFlag);
      var slot = SLOT_BY_Z.get(Number(z));
      var lore = ELEMENT_LORE[Number(z)];
      if (lore) return useAr ? lore.ar : lore.en;
      if (!slot) {
        return useAr ? 'سلسلة العناصر الكيميائية من Google' : 'Google Chemical Element Series';
      }
      var groupText = getGroupLabel(slot.group, langOrFlag);
      return useAr
        ? 'المجموعة ' + slot.col + ' · ' + groupText + ' · سلسلة عناصر Google'
        : 'Group ' + slot.col + ' · ' + groupText + ' · Google Element Series';
    }

    function getRadarAxes(langOrFlag) {
      var useAr = isArabicLangFlag(langOrFlag);
      return RADAR_AXES.map(function (ax) {
        return {
          key: ax.key,
          label: useAr ? ax.ar : ax.en,
          vertexLabel: useAr ? ax.vertexAr : ax.vertexEn,
        };
      });
    }

    function resolveElementDisplay(slotOrZ, langOrFlag) {
      var useAr = isArabicLangFlag(langOrFlag);
      var slot =
        typeof slotOrZ === 'object' && slotOrZ
          ? slotOrZ
          : SLOT_BY_Z.get(Number(slotOrZ)) || ELEMENTS_90[5];
      var prof = getElementSpecProfile(slot.z);
      return {
        z: slot.z,
        symbol: slot.symbol,
        name: slot.name,
        displayName: useAr && slot.ar ? slot.name + ' (' + slot.ar + ')' : slot.name,
        groupLabel: getGroupLabel(slot.group, langOrFlag),
        lore: getElementLore(slot.z, langOrFlag),
        roleTag: prof.roleTag,
        switchSpec: useAr ? prof.switchSpecAr : prof.switchSpecEn,
        tagline: useAr ? prof.taglineAr : prof.taglineEn,
        scenes: (useAr ? prof.scenesAr : prof.scenesEn).slice(),
      };
    }

    function resolveAuxSlotDisplay(slot, langOrFlag) {
      var useAr = isArabicLangFlag(langOrFlag);
      if (!slot || typeof slot !== 'object') {
        return {
          title: '',
          shortLabel: '',
          roleTag: '',
          tagline: '',
          scenes: [],
          nativeDescription: '',
        };
      }
      var nativeDesc = typeof slot.nativeDescription === 'string' ? slot.nativeDescription.trim() : '';
      return {
        id: slot.id || '',
        title: slot.title || '',
        shortLabel: slot.shortLabel || '',
        roleTag: slot.roleTag || '',
        tagline: nativeDesc || (useAr ? slot.taglineAr || slot.taglineEn || '' : slot.taglineEn || ''),
        scenes: (useAr ? slot.scenesAr || slot.scenesEn || [] : slot.scenesEn || []).slice(),
        nativeDescription: nativeDesc,
      };
    }

    function getLocalizedEffortLabel(effortCode, langOrFlag) {
      var useAr = isArabicLangFlag(langOrFlag);
      var code = String(effortCode || '').toLowerCase();
      if (useAr && EFFORT_LABELS_AR[code]) return EFFORT_LABELS_AR[code];
      return EFFORT_LABELS[code] || effortCode || '';
    }

    return {
      AUX_PAGE_SIZE: AUX_PAGE_SIZE,
      DEFAULT_MAX_CONTEXT_TOKENS: DEFAULT_MAX_CONTEXT_TOKENS,
      EFFORT_ORDER: EFFORT_ORDER,
      EFFORT_NORM_MAP: EFFORT_NORM_MAP,
      EFFORT_LABELS: EFFORT_LABELS,
      EFFORT_LABELS_AR: EFFORT_LABELS_AR,
      EFFORT_LABELS_ZH: EFFORT_LABELS_ZH,
      MODEL_TRIGGER_TEXT_RE: MODEL_TRIGGER_TEXT_RE,
      EXCLUDED_FAMILY_RE: EXCLUDED_FAMILY_RE,
      AR_EFFORT_PAREN_RE: AR_EFFORT_PAREN_RE,
      ZH_EFFORT_PAREN_RE: ZH_EFFORT_PAREN_RE,
      EN_EFFORT_PAREN_RE: EN_EFFORT_PAREN_RE,
      ELEMENTS_90: ELEMENTS_90,
      SLOT_BY_Z: SLOT_BY_Z,
      ELEMENT_BY_NAME: ELEMENT_BY_NAME,
      GROUP_META: GROUP_META,
      ELEMENT_LORE: ELEMENT_LORE,
      ELEMENT_SPEC_PROFILES: ELEMENT_SPEC_PROFILES,
      MINI_BADGE_SOUL_HEX: MINI_BADGE_SOUL_HEX,
      MINI_BADGE_THEME_SUBSTRATES: MINI_BADGE_THEME_SUBSTRATES,
      CORE_FOUR_ELEMENTS: CORE_FOUR_ELEMENTS,
      HUD_GEM_STYLES: HUD_GEM_STYLES,
      BENCHMARK_SOURCE_CITATION: BENCHMARK_SOURCE_CITATION,
      BENCHMARK_SOURCE_CITATION_SHORT: BENCHMARK_SOURCE_CITATION_SHORT,
      RADAR_AXES: RADAR_AXES,
      BENCHMARK_CEILINGS: BENCHMARK_CEILINGS,
      BENCHMARK_2026Q4_DB: BENCHMARK_2026Q4_DB,
      AUX_MODEL_PRESETS: AUX_MODEL_PRESETS,
      parseHexRgb255: parseHexRgb255,
      lerpRgb255: lerpRgb255,
      rgba255Css: rgba255Css,
      rgb255ToHex: rgb255ToHex,
      resolveThemeNativeMiniBadgeColors: resolveThemeNativeMiniBadgeColors,
      normalizeArEffortWord: normalizeArEffortWord,
      normalizeZhEffortWord: normalizeZhEffortWord,
      normalizeEnEffortWord: normalizeEnEffortWord,
      stripEffortSuffixFromLabel: stripEffortSuffixFromLabel,
      parseElementModelLabel: parseElementModelLabel,
      matchGoogleElementModels: matchGoogleElementModels,
      resolveBenchmarkMetrics: resolveBenchmarkMetrics,
      classifyNonElementOption: classifyNonElementOption,
      matchHostAuxModels: matchHostAuxModels,
      getAuxPageCount: getAuxPageCount,
      getAuxPageSlice: getAuxPageSlice,
      findAuxPageForId: findAuxPageForId,
      padAuxPageSlots: padAuxPageSlots,
      getGroupLabel: getGroupLabel,
      getElementSpecProfile: getElementSpecProfile,
      getElementLore: getElementLore,
      getRadarAxes: getRadarAxes,
      resolveElementDisplay: resolveElementDisplay,
      resolveAuxSlotDisplay: resolveAuxSlotDisplay,
      getLocalizedEffortLabel: getLocalizedEffortLabel,
    };
  }
);
