import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const bidi = require('../arabic-bidi.js');
const cdp = require('../cdp.js');

function makeNode(tag, { attrs = {}, text = '', children = [], value = '' } = {}) {
  const attrMap = new Map(Object.entries(attrs));
  const node = {
    nodeType: 1,
    tagName: tag.toUpperCase(),
    isConnected: true,
    parentElement: null,
    children: [],
    childNodes: [],
    value,
    get textContent() {
      if (this.childNodes.length === 0) return text;
      return this.childNodes.map((c) => (c.nodeType === 3 ? c.nodeValue : c.textContent)).join('');
    },
    set textContent(v) {
      text = String(v);
      this.childNodes = [];
      this.children = [];
    },
    getAttribute(k) {
      return attrMap.has(k) ? attrMap.get(k) : null;
    },
    setAttribute(k, v) {
      attrMap.set(k, String(v));
    },
    hasAttribute(k) {
      return attrMap.has(k);
    },
    removeAttribute(k) {
      attrMap.delete(k);
    },
    matches(sel) {
      return sel.split(',').some((raw) => {
        const s = raw.trim();
        if (!s) return false;
        if (s.includes('>')) {
          const [pSel, cSel] = s.split('>').map((x) => x.trim());
          return Boolean(this.parentElement && this.parentElement.matches(pSel) && this.matches(cSel));
        }
        if (s.includes(' ')) {
          const parts = s.split(/\s+/);
          const leaf = parts[parts.length - 1];
          const anc = parts.slice(0, -1).join(' ');
          return Boolean(this.matches(leaf) && this.parentElement && this.parentElement.closest(anc));
        }
        if (s.startsWith('.')) {
          const cls = String(attrMap.get('class') || '').split(/\s+/);
          return cls.includes(s.slice(1));
        }
        if (s.startsWith('#')) return attrMap.get('id') === s.slice(1);
        const attrM = /^([a-z0-9]*)?\[([^=\]]+)(?:="([^"]*)")?\]$/i.exec(s);
        if (attrM) {
          const [, tg, k, v] = attrM;
          if (tg && tg.toUpperCase() !== this.tagName) return false;
          if (!attrMap.has(k)) return false;
          return v === undefined ? true : attrMap.get(k) === v;
        }
        return s.toUpperCase() === this.tagName;
      });
    },
    closest(sel) {
      for (let cur = this; cur; cur = cur.parentElement) {
        if (cur.matches(sel)) return cur;
      }
      return null;
    },
    querySelectorAll(sel) {
      const out = [];
      const walk = (el) => {
        for (const c of el.children) {
          if (c.matches(sel)) out.push(c);
          walk(c);
        }
      };
      walk(this);
      return out;
    },
    querySelector(sel) {
      return this.querySelectorAll(sel)[0] || null;
    },
    appendChild(child) {
      if (child.nodeType === 1) {
        child.parentElement = this;
        this.children.push(child);
      }
      this.childNodes.push(child);
      return child;
    },
  };
  if (text && children.length === 0) {
    node.childNodes.push({ nodeType: 3, nodeValue: text, parentElement: node });
  }
  for (const c of children) {
    if (typeof c === 'string') node.childNodes.push({ nodeType: 3, nodeValue: c, parentElement: node });
    else node.appendChild(c);
  }
  return node;
}

test('detectTextDirection handles mixed Arabic/English ordering accurately', () => {
  assert.equal(bidi.detectTextDirection('Hello world, pure English.'), null);
  assert.equal(bidi.detectTextDirection('صلح باقي العربي برده'), 'rtl');
  assert.equal(bidi.detectTextDirection('عربي English عربي'), 'rtl');
  assert.equal(bidi.detectTextDirection('English عربي English'), 'ltr');
  assert.equal(bidi.detectTextDirection('Antigravity بيعمل bug في العربي مع English لما أكتب'), 'rtl');
  assert.equal(bidi.detectTextDirection('API بيعمل fetch للـ data من server وبيرجع JSON'), 'rtl');
  assert.equal(bidi.detectTextDirection('React و Next.js بيعملوا SSR'), 'rtl');
  assert.equal(bidi.detectTextDirection('Chapter 2 (Ch 2: Prep & Cleaning): تعريف جمع البيانات (Primary vs Secondary)'), 'rtl');
  assert.equal(bidi.detectTextDirection('المشروع يستخدم React Native Expo Router Tailwind CSS'), 'rtl');
  assert.equal(bidi.detectTextDirection('Fix the مشكلة here and check تجربة now'), 'ltr');
  assert.equal(bidi.detectTextDirection('Check the word "مرحبا" in the output'), 'ltr');
  assert.equal(bidi.detectTextDirection('مشكلة is an Arabic word meaning problem'), 'ltr');
  assert.equal(bidi.detectTextDirection('https://example.com/path/file.ts شغال كويس'), 'rtl');
  assert.equal(bidi.detectTextDirection('@Aflamk1.kt صلح الكود ده'), 'rtl');
});

test('detectMultilineDirection separates pure Arabic multiline from mixed Arabic + English logs', () => {
  assert.equal(
    bidi.detectMultilineDirection('API بيعمل مشكلة\nوالرد بيرجع فاضي'),
    'rtl'
  );
  assert.equal(
    bidi.detectMultilineDirection('صلح الخطأ ده:\nTypeError: Cannot read properties of undefined\nat Object.<anonymous> (index.js:10:5)'),
    'rtl-mixed'
  );
});

test('createArabicBidiController applies smart RTL/LTR, inline isolation, list/table alignment, editor sync, and lossless destroy', () => {
  const root = makeNode('div', { attrs: { 'data-testid': 'conversation-view' } });
  const agentResp = makeNode('div', { attrs: { 'data-testid': 'agent-response' } });

  const bdiMention = makeNode('bdi', { attrs: { class: 'context-scope-mention', 'data-quotable-inline': 'true' }, text: 'Lecture 1.pdf' });
  const strongEn = makeNode('strong', { text: 'Ch 1: Intro (v2)' });
  const codeEn = makeNode('code', { attrs: { dir: 'ltr' }, text: '175 ZB' });
  const codeAr = makeNode('code', { attrs: { dir: 'ltr' }, text: 'مرحباً بك' });
  const li1 = makeNode('li', {
    attrs: { dir: 'auto' },
    children: [bdiMention, ' (', strongEn, '): التعريف، Raw Data مقابل Analysis و ', codeEn, ' و ', codeAr],
  });
  const li2 = makeNode('li', {
    attrs: { dir: 'auto' },
    text: 'Chapter 2: تعريف جمع البيانات وتنظيفها',
  });
  const ul = makeNode('ul', { children: [li1, li2] });

  const mixedStrong = makeNode('strong', { text: 'Data Analysis (د. محمود الصباغ)' });
  const pAr = makeNode('p', {
    attrs: { dir: 'auto' },
    children: ['في مادة ', mixedStrong, ' تمت قراءة المحاضرات'],
  });
  const pEnWithAr = makeNode('p', {
    attrs: { dir: 'auto' },
    children: ['Fix the ', makeNode('strong', { text: 'مشكلة!' }), ' in the response'],
  });
  const pPureEn = makeNode('p', { attrs: { dir: 'auto' }, text: 'Everything works cleanly in English.' });

  const pre = makeNode('pre', { children: [makeNode('code', { text: 'const x = "عربي";' })] });
  agentResp.appendChild(ul);
  agentResp.appendChild(pAr);
  agentResp.appendChild(pEnWithAr);
  agentResp.appendChild(pPureEn);
  agentResp.appendChild(pre);

  const editorP = makeNode('p', { text: 'React بيعمل render للـ DOM بسرعة' });
  const editor = makeNode('div', { attrs: { 'data-lexical-editor': 'true', contenteditable: 'true' }, children: [editorP] });

  root.appendChild(agentResp);
  root.appendChild(editor);

  const listeners = new Map();
  const fakeDoc = {
    querySelector: (s) => (root.matches(s) ? root : root.querySelector(s)),
    querySelectorAll: (s) => {
      const list = root.querySelectorAll(s);
      return root.matches(s) ? [root, ...list] : list;
    },
    addEventListener: (ev, fn) => listeners.set(ev, fn),
    removeEventListener: (ev) => listeners.delete(ev),
  };

  const ctl = bidi.createArabicBidiController({ doc: fakeDoc, win: {} });
  ctl.sync();

  // Leading English/mention Arabic list items & parent UL resolve to RTL
  assert.equal(li1.getAttribute(bidi.BIDI_ATTR), 'rtl');
  assert.equal(li2.getAttribute(bidi.BIDI_ATTR), 'rtl');
  assert.equal(ul.getAttribute(bidi.BIDI_ATTR), 'rtl');

  // Inline elements isolate cleanly: English-only -> ltr, Arabic-only -> rtl, mixed -> inherit
  assert.equal(bdiMention.getAttribute(bidi.INLINE_ATTR), 'ltr');
  assert.equal(strongEn.getAttribute(bidi.INLINE_ATTR), 'ltr');
  assert.equal(codeEn.getAttribute(bidi.INLINE_ATTR), 'ltr');
  assert.equal(codeAr.getAttribute(bidi.INLINE_ATTR), 'rtl');
  assert.equal(pAr.getAttribute(bidi.BIDI_ATTR), 'rtl');
  assert.equal(mixedStrong.getAttribute(bidi.INLINE_ATTR), null);

  // English sentence containing an Arabic word stays LTR, while its Arabic inline strong isolates RTL
  assert.equal(pEnWithAr.getAttribute(bidi.BIDI_ATTR), 'ltr');
  assert.equal(pEnWithAr.querySelector('strong').getAttribute(bidi.INLINE_ATTR), 'rtl');

  // Pure English paragraph and code block are completely untouched
  assert.equal(pPureEn.getAttribute(bidi.BIDI_ATTR), null);
  assert.equal(pre.querySelector('code').getAttribute(bidi.INLINE_ATTR), null);

  // Live Lexical editor paragraph gets RTL smart direction
  assert.equal(editorP.getAttribute(bidi.BIDI_ATTR), 'rtl');

  // Lossless destroy removes all attributes and listeners
  ctl.destroy();
  assert.equal(li1.getAttribute(bidi.BIDI_ATTR), null);
  assert.equal(ul.getAttribute(bidi.BIDI_ATTR), null);
  assert.equal(strongEn.getAttribute(bidi.INLINE_ATTR), null);
  assert.equal(editorP.getAttribute(bidi.BIDI_ATTR), null);
  assert.equal(listeners.size, 0);
});

test('arabic-bidi.js is wired into RUNTIME_PARTS and SYNC_ROOT_FILES within Channel 1 budget', () => {
  assert.equal(cdp.RUNTIME_PARTS.includes('arabic-bidi.js'), true);
  assert.equal(cdp.SYNC_ROOT_FILES.includes('arabic-bidi.js'), true);
  const expr = cdp.buildInjectExpression({ ...cdp.DEFAULT_CONFIG, language: 'ar' });
  assert.ok(expr.includes('__agPrismArabicBidi'), 'Compiled Channel 1 bundle includes arabic-bidi runtime');
  assert.ok(Buffer.byteLength(expr, 'utf8') < 550_000, 'Channel 1 bundle stays under 550 KB budget');
});
