// Obsidian Prism - Smart Arabic/English BiDi Engine (arabic-bidi.js)
(function (root) {
  'use strict';
  const G = root || (typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : null);
  if (!G) return;

  const BIDI_ATTR = 'data-ag-bidi', INLINE_ATTR = 'data-ag-bidi-inline';
  const AR = '\\u0600-\\u06FF\\u0750-\\u077F\\u08A0-\\u08FF\\uFB50-\\uFDFF\\uFE70-\\uFEFF';
  const ARABIC_RE = new RegExp('[' + AR + ']'), LAT_RE = /[A-Za-z]/;
  const TOK_RE = new RegExp('[' + AR + ']+|[A-Za-z]+(?:[\'\\u2019-][A-Za-z]+)*', 'g');
  const FIRST_RE = new RegExp('([' + AR + '])|([A-Za-z])');
  const TECH_TOK_RE = /https?:\/\/\S+|(?:[A-Za-z]:\\|\/|~\/|\.\.?\/)[^\s,\u060C\u061B()\[\]{}"']+|@[A-Za-z0-9._/-]+|\b[A-Za-z0-9_-]+\.[a-z]{1,4}\b/gi;
  const STOP_RE = /^(?:the|a|an|is|are|was|were|be|have|has|had|do|does|did|will|would|should|can|could|to|of|in|for|on|with|at|by|from|as|into|about|this|that|these|those|it|its|they|we|you|your|and|or|but|if|then|when|where|while|not|no|here|now|how|what|which|all|some|only)$/i;
  const SKIP_TG = /^(PRE|CODE|KBD|SAMP|SCRIPT|STYLE|SVG|MATH|NOSCRIPT|BDI|CANVAS|VIDEO|AUDIO)$/;
  const NEST_TG = /^(UL|OL|BLOCKQUOTE|TABLE|PRE|DIV)$/;
  const CODE_TG = /^(CODE|KBD|SAMP)$/;
  const T = (v) => `[data-testid="${v}"]`;
  const TECH_SEL = `.context-scope-mention,[data-quotable-inline="true"],${T('entity-pill')},.inline-pill,[data-ag-ltr="1"]`;
  const CHAT_SEL = `${T('agent-response')},${T('planner-response-text')},${T('artifact-view')},${T('user-message-bubble')},.agy-user-bubble,${T('queued-messages-card')},${T('side-question-panel')},${T('interaction-takeover-card')},${T('thinking-collapsible-trigger')}+div`;
  const BLOCK_SEL = `p,li,h1,h2,h3,h4,h5,h6,blockquote,.markdown-alert,td,th,${T('user-message-content')}>div`;
  const INLINE_SEL = 'strong,b,em,i,a,mark,del,s,code,kbd,samp,bdi,' + TECH_SEL;
  const ED_SEL = `[data-lexical-editor="true"],${T('agent-input-box')} :is([contenteditable="true"],textarea),${T('side-question-panel')} :is(textarea,input[type="text"])`;
  const SKIP_SEL = 'pre,.monaco-editor,.monaco-diff-editor,.xterm,#ag-cs-settings-sec,.ag-cs-home-panel,.ag-omni-workbench,#ag-prism-periodic-picker-root';

  const tagU = (e) => (e && e.tagName ? String(e.tagName).toUpperCase() : '');
  const isEl = (n) => Boolean(n && (n.nodeType === 1 || (n.nodeType === undefined && typeof n.tagName === 'string')));
  const match = (e, s) => { try { return Boolean(e && e.matches && e.matches(s)); } catch { return false; } };
  const cl = (e, s) => { try { return e && e.closest ? e.closest(s) : null; } catch { return null; } };
  const inSkip = (e) => Boolean(cl(e, SKIP_SEL));
  const qa = (r, s) => (r && r.querySelectorAll ? r.querySelectorAll(s) : []);

  function detectTextDirection(rawText) {
    const raw = String(rawText || '');
    if (!raw || !ARABIC_RE.test(raw)) return null;
    const cl = raw.replace(TECH_TOK_RE, ' '), src = ARABIC_RE.test(cl) ? cl : raw;
    const fm = FIRST_RE.exec(src), first = fm ? (fm[1] ? 'rtl' : 'ltr') : null;
    let arW = 0, latW = 0, arC = 0, latC = 0, st = 0, rAr = 0, mAr = false;
    for (const t of src.match(TOK_RE) || []) {
      if (ARABIC_RE.test(t)) { arW++; arC += t.length; if (++rAr >= 2) mAr = true; }
      else { latW++; latC += t.length; rAr = 0; if (STOP_RE.test(t)) st++; }
    }
    if (!arW) return null;
    if (!latW || arW > latW) return 'rtl';
    if (arW === latW) return first === 'rtl' || !st || mAr ? 'rtl' : 'ltr';
    if (first === 'rtl' && (!st || (arW >= 2 && arW * 2 >= latW))) return 'rtl';
    if (!st && (mAr || (arW >= 2 && arW * 2 >= latW))) return 'rtl';
    if (mAr && arW >= 3 && st <= 1 && arW * 1.6 >= latW && arC * 2 >= latC) return 'rtl';
    return 'ltr';
  }

  function detectMultilineDirection(rawText) {
    const raw = String(rawText || '');
    if (!raw || !ARABIC_RE.test(raw)) return null;
    if (!raw.includes('\n')) return detectTextDirection(raw);
    let r = 0, l = 0;
    for (const ln of raw.split(/\r?\n/)) {
      const s = ln.trim();
      if (!s) continue;
      if (ARABIC_RE.test(s)) { const d = detectTextDirection(s); if (d === 'rtl') r++; else if (d === 'ltr') l++; }
      else if (LAT_RE.test(s)) l++;
    }
    if (!r && !l) return detectTextDirection(raw);
    return r && !l ? 'rtl' : r && l ? (r >= l * 3 ? 'rtl' : 'rtl-mixed') : 'ltr';
  }

  function extractProseText(el, depth = 0) {
    if (!el || depth > 8) return '';
    const ns = el.childNodes;
    if (!ns || !ns.length) return String(el.textContent || '');
    let out = '';
    for (const n of ns) {
      if (!n) continue;
      if (n.nodeType === 3) out += n.nodeValue || '';
      else if (isEl(n)) {
        const tg = tagU(n);
        if (SKIP_TG.test(tg) || match(n, TECH_SEL)) out += ' ';
        else if (!(depth > 0 && NEST_TG.test(tg))) out += extractProseText(n, depth + 1);
      }
    }
    return out;
  }

  function classifyInlineDirection(el) {
    const raw = el ? String(el.textContent || '').trim() : '';
    if (!raw) return null;
    const hasAr = ARABIC_RE.test(raw), hasLat = LAT_RE.test(raw);
    if (CODE_TG.test(tagU(el)) || match(el, TECH_SEL)) return hasAr && detectTextDirection(raw) === 'rtl' ? 'rtl' : 'ltr';
    return !hasAr && (hasLat || /\d/.test(raw)) ? 'ltr' : hasAr && !hasLat ? 'rtl' : null;
  }

  function createArabicBidiController({ doc, isDestroyed, runGuardedMut, setAttrIfChanged } = {}) {
    const D = doc || (typeof document !== 'undefined' ? document : null);
    const alive = () => !(typeof isDestroyed === 'function' && isDestroyed());
    const guard = (fn) => (typeof runGuardedMut === 'function' ? runGuardedMut(fn) : fn());
    const put = (e, k, v) => { if (e?.setAttribute) setAttrIfChanged ? setAttrIfChanged(e, k, v) : e.getAttribute(k) !== String(v) && e.setAttribute(k, String(v)); };
    const del = (e, k) => { if (e?.hasAttribute?.(k)) e.removeAttribute(k); };
    const set = (e, k, v) => (v ? put(e, k, v) : del(e, k));

    const sigs = new WeakMap(), pend = new Set();
    let obs = null, obsT = null, tmr = 0, bound = false;

    const syncInl = (blk, clr) => { for (const x of qa(blk, INLINE_SEL)) if (x && !inSkip(x)) set(x, INLINE_ATTR, clr ? null : classifyInlineDirection(x)); };

    const syncBlock = (el) => {
      if (!isEl(el) || inSkip(el)) return;
      const txt = String(el.textContent || '');
      const sig = `${txt.length}|${el.children ? el.children.length : 0}|${txt.slice(0, 40)}|${txt.slice(-20)}`;
      if (sigs.get(el) === sig) return;
      sigs.set(el, sig);
      if (!ARABIC_RE.test(txt)) { if (el.hasAttribute(BIDI_ATTR)) { del(el, BIDI_ATTR); syncInl(el, true); } return; }
      const prose = extractProseText(el), src = ARABIC_RE.test(prose) ? prose : txt;
      const bub = el.parentElement && el.parentElement.getAttribute && el.parentElement.getAttribute('data-testid') === 'user-message-content';
      const d = bub ? detectMultilineDirection(src) : detectTextDirection(src);
      set(el, BIDI_ATTR, d); syncInl(el, !d);
    };

    const syncGrp = (el, items, cell) => {
      if (!isEl(el) || inSkip(el) || !items) return;
      let tot = 0, rtl = 0;
      for (const it of items) {
        if (cell) { const t = String(it.textContent || '').trim(); if (!t || (!ARABIC_RE.test(t) && !LAT_RE.test(t))) continue; }
        else if (tagU(it) !== 'LI') continue;
        tot++;
        const d = it.getAttribute(BIDI_ATTR);
        if (d === 'rtl' || d === 'rtl-mixed') rtl++;
      }
      set(el, BIDI_ATTR, tot && rtl && rtl * 2 >= tot ? 'rtl' : null);
    };

    const syncEd = (ed) => {
      if (!isEl(ed) || inSkip(ed)) return;
      const tg = tagU(ed);
      if (tg === 'TEXTAREA' || tg === 'INPUT') { const v = String(ed.value || ''); set(ed, BIDI_ATTR, tg === 'TEXTAREA' ? detectMultilineDirection(v) : detectTextDirection(v)); return; }
      const bs = qa(ed, 'p,li');
      if (bs.length) { for (const b of bs) set(b, BIDI_ATTR, detectTextDirection(b.textContent || '')); del(ed, BIDI_ATTR); }
      else set(ed, BIDI_ATTR, detectMultilineDirection(ed.textContent || ''));
    };

    const syncScope = (r) => {
      for (const b of qa(r, BLOCK_SEL)) syncBlock(b);
      for (const l of qa(r, 'ul,ol')) syncGrp(l, l.children, false);
      for (const t of qa(r, 'table')) syncGrp(t, qa(t, 'th,td'), true);
    };

    const flush = () => {
      tmr = 0;
      if (!alive() || !D || !pend.size) { pend.clear(); return; }
      const batch = [...pend]; pend.clear();
      guard(() => {
        const uls = new Set(), tbs = new Set();
        for (const raw of batch) {
          const el = isEl(raw) ? raw : raw && raw.parentElement;
          if (!el || el.isConnected === false || inSkip(el)) continue;
          const ed = cl(el, ED_SEL);
          if (ed) { syncEd(ed); continue; }
          const blk = cl(el, BLOCK_SEL);
          if (blk && !inSkip(blk)) {
            syncBlock(blk);
            const u = cl(blk, 'ul,ol'); if (u) uls.add(u);
            const tb = cl(blk, 'table'); if (tb) tbs.add(tb);
          } else syncScope(el);
        }
        uls.forEach((u) => syncGrp(u, u.children, false));
        tbs.forEach((t) => syncGrp(t, qa(t, 'th,td'), true));
      });
    };

    const q = (n) => { if (n && alive()) { pend.add(n); if (!tmr) tmr = setTimeout(flush, 80); } };
    const onIn = (ev) => { const ed = alive() && isEl(ev && ev.target) ? cl(ev.target, ED_SEL) : null; if (ed) guard(() => syncEd(ed)); };
    const evOpt = { capture: true, passive: true };
    const toggleEv = (m) => { if (D && D[m]) try { D[m]('input', onIn, evOpt); D[m]('compositionend', onIn, evOpt); } catch {} };
    function sync(scopeRoot) {
      if (!alive() || !D) return;
      if (!bound) { bound = true; toggleEv('addEventListener'); }
      if (typeof MutationObserver === 'function') {
        const vp = D.querySelector?.(T('autoscroll-viewport')) || null;
        if (vp !== obsT || !obs) {
          try { obs?.disconnect(); } catch {}
          obs = null; obsT = vp;
          if (obsT) {
            obs = new MutationObserver((ms) => {
              if (!alive()) return;
              for (const m of ms) {
                if (m.type === 'characterData') q(m.target);
                else if (m.addedNodes?.length) { for (const n of m.addedNodes) q(n); }
                else q(m.target);
              }
            });
            try { obs.observe(obsT, { childList: true, subtree: true, characterData: true }); } catch {}
          }
        }
      }
      guard(() => {
        const r = scopeRoot && scopeRoot.querySelectorAll ? scopeRoot : D;
        for (const s of qa(r, CHAT_SEL)) syncScope(s);
        for (const e of qa(r, ED_SEL)) syncEd(e);
        for (const row of qa(r, `${T('conversation-row-sidebar')},${T('conversation-row-history')}`)) {
          if (!ARABIC_RE.test(row.textContent || '')) continue;
          for (const sp of qa(row, 'span,a,p,div')) if (!sp.children || !sp.children.length) set(sp, BIDI_ATTR, detectTextDirection(sp.textContent || ''));
        }
      });
    }

    function destroy() {
      if (tmr) { clearTimeout(tmr); tmr = 0; }
      pend.clear();
      if (obs) { try { obs.disconnect(); } catch {} obs = null; }
      obsT = null;
      if (bound) { toggleEv('removeEventListener'); bound = false; }
      for (const e of qa(D, `[${BIDI_ATTR}]`)) del(e, BIDI_ATTR);
      for (const e of qa(D, `[${INLINE_ATTR}]`)) del(e, INLINE_ATTR);
    }

    return { sync, syncScope, syncEditorElement: syncEd, destroy };
  }

  const api = { BIDI_ATTR, INLINE_ATTR, ARABIC_RE, detectTextDirection, detectMultilineDirection, extractProseText, classifyInlineDirection, createArabicBidiController };
  G.__agPrismArabicBidi = api;
  if (typeof module === 'object' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : this);
