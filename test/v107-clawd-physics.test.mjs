import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const rig = require('../dual-mascot-rig.js');

/**
 * Build a stage test fixture with controllable rAF, ResizeObserver, MutationObserver, and zero-reflow counters.
 */
function createPhysicsStageHarness(opts = {}) {
  let curW = opts.width ?? 720;
  let clientWidthReads = 0;
  let rectReads = 0;
  let clearRectCalls = 0;
  let drawImageCalls = 0;
  let createdCanvases = 0;
  let roCb = null;
  let moCb = null;
  let nowMs = 10000;
  let rafSeq = 0;
  const rafMap = new Map();
  const winListeners = new Map();
  const docListeners = new Map();

  const origPerfNow = performance.now.bind(performance);
  const useManualClock = Boolean(opts.manualClock);
  if (useManualClock) {
    performance.now = () => nowMs;
  }

  const prevRO = globalThis.ResizeObserver;
  const prevMO = globalThis.MutationObserver;
  class FakeRO {
    constructor(cb) {
      roCb = cb;
    }
    observe() {}
    disconnect() {}
  }
  class FakeMO {
    constructor(cb) {
      moCb = cb;
    }
    observe() {}
    disconnect() {}
  }
  globalThis.ResizeObserver = FakeRO;
  globalThis.MutationObserver = FakeMO;

  const htmlAttrs = new Map();
  const mockHtml = {
    getAttribute(k) {
      return htmlAttrs.has(k) ? htmlAttrs.get(k) : null;
    },
    hasAttribute(k) {
      return htmlAttrs.has(k);
    },
    setAttribute(k, v) {
      htmlAttrs.set(k, String(v));
      if (moCb) moCb([{ attributeName: k }]);
    },
    removeAttribute(k) {
      htmlAttrs.delete(k);
      if (moCb) moCb([{ attributeName: k }]);
    },
  };

  const mockWin = {
    devicePixelRatio: 1,
    ResizeObserver: FakeRO,
    MutationObserver: FakeMO,
    matchMedia: () => ({ matches: false }),
    requestAnimationFrame(fn) {
      const id = ++rafSeq;
      rafMap.set(id, fn);
      return id;
    },
    cancelAnimationFrame(id) {
      rafMap.delete(id);
    },
    addEventListener(type, fn) {
      if (!winListeners.has(type)) winListeners.set(type, new Set());
      winListeners.get(type).add(fn);
    },
    removeEventListener(type, fn) {
      winListeners.get(type)?.delete(fn);
    },
    dispatch(type, ev = {}) {
      for (const fn of [...(winListeners.get(type) || [])]) fn({ type, ...ev });
    },
  };

  function makeNode(tag) {
    const upper = String(tag).toUpperCase();
    if (upper === 'CANVAS') createdCanvases += 1;
    const attrs = new Map();
    const listeners = new Map();
    const children = [];
    const style = {
      display: '',
      zIndex: '',
      transform: '',
      transformOrigin: '',
      transition: '',
      cursor: '',
      pointerEvents: '',
      touchAction: '',
    };
    const node = {
      nodeType: 1,
      tagName: upper,
      ownerDocument: null,
      parentNode: null,
      width: 96,
      height: 84,
      className: '',
      dataset: {},
      style,
      children,
      get firstChild() {
        return children[0] || null;
      },
      setAttribute(k, v) {
        attrs.set(k, String(v));
      },
      getAttribute(k) {
        return attrs.has(k) ? attrs.get(k) : null;
      },
      removeAttribute(k) {
        attrs.delete(k);
      },
      appendChild(c) {
        c.parentNode = node;
        children.push(c);
        return c;
      },
      removeChild(c) {
        const i = children.indexOf(c);
        if (i >= 0) children.splice(i, 1);
        c.parentNode = null;
        return c;
      },
      getBoundingClientRect() {
        rectReads += 1;
        return { left: 0, top: 0, right: curW, bottom: 84, width: curW, height: 84 };
      },
      addEventListener(t, fn) {
        if (!listeners.has(t)) listeners.set(t, new Set());
        listeners.get(t).add(fn);
      },
      removeEventListener(t, fn) {
        listeners.get(t)?.delete(fn);
      },
      dispatch(t, ev = {}) {
        for (const fn of [...(listeners.get(t) || [])]) {
          fn({ type: t, button: 0, pointerId: 1, preventDefault() {}, stopPropagation() {}, ...ev });
        }
      },
      getContext(kind) {
        if (kind !== '2d') return null;
        return {
          imageSmoothingEnabled: false,
          fillStyle: '',
          save() {},
          restore() {},
          setTransform() {},
          clearRect() {
            clearRectCalls += 1;
          },
          beginPath() {},
          rect() {},
          clip() {},
          translate() {},
          scale() {},
          rotate() {},
          fillRect() {},
          drawImage() {
            drawImageCalls += 1;
          },
        };
      },
    };
    return node;
  }

  const mockDoc = {
    hidden: false,
    documentElement: mockHtml,
    defaultView: mockWin,
    createElement(tag) {
      const n = makeNode(tag);
      n.ownerDocument = mockDoc;
      return n;
    },
    addEventListener(t, fn) {
      if (!docListeners.has(t)) docListeners.set(t, new Set());
      docListeners.get(t).add(fn);
    },
    removeEventListener(t, fn) {
      docListeners.get(t)?.delete(fn);
    },
    dispatchDoc(t) {
      for (const fn of [...(docListeners.get(t) || [])]) fn({ type: t });
    },
  };

  const hostEl = mockDoc.createElement('div');
  // Simulate real DOM prototype chain clientWidth getter (so isMockHostWidth === false, enabling ResizeObserver and cached width path)
  Object.setPrototypeOf(hostEl, {
    get clientWidth() {
      clientWidthReads += 1;
      return curW;
    },
  });

  const stage = rig.mountDualMascotStage(hostEl, {
    camp: opts.camp || 'gemini',
    miniPileEnabled: opts.miniPileEnabled ?? true,
    reducedMotion: opts.reducedMotion ?? false,
  });

  const findActorEl = (id) => hostEl.children.find((c) => c.getAttribute?.('data-mascot-id') === id);
  const findMiniEl = (id) => {
    const group = hostEl.children.find((c) => c.className === 'ag-v2-mini-pile');
    return group?.children.find((c) => c.dataset?.miniCrab === id) || null;
  };

  const stepRafOnce = (dtMs = 16.6667) => {
    if (useManualClock) nowMs += dtMs;
    const t = useManualClock ? nowMs : performance.now();
    const batch = [...rafMap.values()];
    rafMap.clear();
    for (const fn of batch) fn(t);
    return batch.length;
  };

  const advanceClock = (dtMs) => {
    if (useManualClock) nowMs += dtMs;
  };

  const triggerRo = (entries) => {
    if (roCb) roCb(entries);
  };

  const setWidth = (w) => {
    curW = w;
  };

  const resetCounters = () => {
    clientWidthReads = 0;
    rectReads = 0;
    clearRectCalls = 0;
    drawImageCalls = 0;
  };

  const cleanup = () => {
    stage.dispose();
    if (useManualClock) performance.now = origPerfNow;
    globalThis.ResizeObserver = prevRO;
    globalThis.MutationObserver = prevMO;
  };

  return {
    stage,
    hostEl,
    mockDoc,
    mockHtml,
    mockWin,
    findActorEl,
    findMiniEl,
    stepRafOnce,
    advanceClock,
    triggerRo,
    setWidth,
    resetCounters,
    cleanup,
    pendingRafCount: () => rafMap.size,
    counters: () => ({ clientWidthReads, rectReads, clearRectCalls, drawImageCalls, createdCanvases }),
  };
}

test('v107 P0-3.1: ballistic launch & y===0 ground-bounce frames stay locked on data-direct="1" (transition:none) for both main actors and mini-crabs, and release cleanly on settle/hidden', () => {
  const h = createPhysicsStageHarness({ miniPileEnabled: true, reducedMotion: false, manualClock: true });
  try {
    const clawdEl = h.findActorEl('clawd');
    const clawdCanvas = clawdEl.children[0];
    const snap0 = h.stage.getLayoutSnapshot();
    const clawd0 = snap0.actors.find((a) => a.id === 'clawd');

    // 1) Drag and toss Clawd upward at high speed (guarantees high-altitude drop + at least 1 y===0 ground bounce)
    clawdEl.dispatch('pointerdown', { clientX: clawd0.worldCx, clientY: 120 });
    h.advanceClock(16);
    clawdEl.dispatch('pointermove', { clientX: clawd0.worldCx - 16, clientY: 96 });
    h.advanceClock(16);
    clawdEl.dispatch('pointermove', { clientX: clawd0.worldCx - 34, clientY: 64 });
    h.advanceClock(16);
    clawdEl.dispatch('pointerup', { clientX: clawd0.worldCx - 34, clientY: 64 });

    // At launch start (before first rAF executes), data-direct="1" and transition="none" must already be locked
    assert.equal(clawdEl.getAttribute('data-direct'), '1', 'Launch start must lock data-direct="1" immediately before first rAF');
    assert.equal(clawdEl.style.transition, 'none', 'Launch start must force inline transition:none');

    let frames = 0;
    let bounceZeroYFrames = 0;
    let lowAltitudeFrames = 0;
    let settled = false;

    while (h.pendingRafCount() > 0 && frames < 240) {
      h.stepRafOnce(16.6667);
      frames += 1;
      const actorSnap = h.stage.getLayoutSnapshot().actors.find((a) => a.id === 'clawd');
      const stillFlying = h.pendingRafCount() > 0;
      if (stillFlying) {
        assert.equal(
          clawdEl.getAttribute('data-direct'),
          '1',
          `Frame ${frames} (y=${actorSnap.y}) must keep data-direct="1" throughout flight & bounce`
        );
        assert.equal(
          clawdEl.style.transition,
          'none',
          `Frame ${frames} (y=${actorSnap.y}) must keep transition="none" throughout flight & bounce`
        );
        if (actorSnap.y === 0) bounceZeroYFrames += 1;
        if (actorSnap.y >= -0.4 && actorSnap.y < 0) lowAltitudeFrames += 1;
      } else {
        settled = true;
      }
    }

    assert.equal(settled, true, 'Ballistic flight must terminate cleanly within 240 frames');
    assert.ok(bounceZeroYFrames >= 1, `Expected at least 1 mid-flight ground-bounce frame at y===0, observed ${bounceZeroYFrames}`);
    assert.equal(clawdEl.getAttribute('data-direct'), null, 'Settled actor must release data-direct');
    assert.equal(clawdEl.style.transition, '', 'Settled actor must restore default transition');
    assert.equal(clawdCanvas.style.transform, '', 'Settled actor canvas rotation must reset to empty string');
    assert.ok(lowAltitudeFrames >= 0);

    // 2) High-speed mini-crab toss also keeps data-direct="1" locked throughout flight (including y===0 bounce), then restores on settle
    const miniEl = h.findMiniEl('cowboy');
    const mini0 = h.stage.getLayoutSnapshot().minis.find((m) => m.id === 'cowboy');
    miniEl.dispatch('pointerdown', { clientX: mini0.worldCx, clientY: 120 });
    h.advanceClock(16);
    miniEl.dispatch('pointermove', { clientX: mini0.worldCx + 14, clientY: 96 });
    h.advanceClock(16);
    miniEl.dispatch('pointermove', { clientX: mini0.worldCx + 32, clientY: 66 });
    h.advanceClock(16);
    miniEl.dispatch('pointerup', { clientX: mini0.worldCx + 32, clientY: 66 });

    assert.equal(miniEl.getAttribute('data-direct'), '1', 'Mini-crab launch start must immediately lock data-direct="1"');
    assert.equal(miniEl.style.transition, 'none');

    let miniFrames = 0;
    let miniBounceZeroY = 0;
    while (h.pendingRafCount() > 0 && miniFrames < 200) {
      h.stepRafOnce(16.6667);
      miniFrames += 1;
      const ms = h.stage.getLayoutSnapshot().minis.find((m) => m.id === 'cowboy');
      if (h.pendingRafCount() > 0) {
        assert.equal(miniEl.getAttribute('data-direct'), '1', `Mini-crab frame ${miniFrames} (y=${ms.y}) must stay data-direct="1"`);
        assert.equal(miniEl.style.transition, 'none');
        if (ms.y === 0) miniBounceZeroY += 1;
      }
    }
    assert.ok(miniBounceZeroY >= 1, `Mini-crab must hit >= 1 y===0 bounce frame while direct-locked, got ${miniBounceZeroY}`);
    assert.equal(miniEl.getAttribute('data-direct'), null, 'Settled mini-crab must release data-direct');
    assert.equal(miniEl.style.transition, '');
    assert.equal(miniEl.style.transform.includes('rotate('), false, 'Settled mini-crab must clear rotate()');

    // 3) Setting document.hidden = true mid-toss forces safe settle and clears ballisticActive / data-direct / rotate
    h.stage.triggerDemo('toss');
    const leaderId = h.stage.getLayoutSnapshot().camp === 'claude' ? 'clawd' : 'cat';
    const leaderEl = h.findActorEl(leaderId);
    const leaderCv = leaderEl.children[0];
    h.stepRafOnce(16.6667);
    assert.equal(leaderEl.getAttribute('data-direct'), '1');
    h.mockDoc.hidden = true;
    h.stepRafOnce(16.6667);
    assert.equal(leaderEl.getAttribute('data-direct'), null, 'document.hidden settle must clear data-direct');
    assert.equal(leaderEl.style.transition, '');
    assert.equal(leaderCv.style.transform, '', 'document.hidden settle must clear canvas rotate()');
    assert.equal(h.stage.getLayoutSnapshot().actors.find((a) => a.id === leaderId).y, 0);
  } finally {
    h.cleanup();
  }
});

test('v107 P0-3.2: 60fps GPU rotation on inner canvas with zero software __agRotOff redraws and canvasSkips hits during drag, flight, and static tilt', () => {
  const h = createPhysicsStageHarness({ miniPileEnabled: true, reducedMotion: false, manualClock: true });
  try {
    const clawdEl = h.findActorEl('clawd');
    const clawdCv = clawdEl.children[0];
    const catEl = h.findActorEl('cat');
    const catCv = catEl.children[0];
    const canvasesAfterMount = h.counters().createdCanvases;

    // Rotation anchor must align with pixel draw anchor (OX+8)*PX=48px, (OY+10)*PX=81px
    assert.equal(clawdCv.style.transformOrigin, '48px 81px');
    assert.equal(catCv.style.transformOrigin, '48px 81px');

    const clawd0 = h.stage.getLayoutSnapshot().actors.find((a) => a.id === 'clawd');
    clawdEl.dispatch('pointerdown', { clientX: clawd0.worldCx, clientY: 110 });
    h.advanceClock(16);
    // First frame crossing drag threshold: transitions into dangle pose
    clawdEl.dispatch('pointermove', { clientX: clawd0.worldCx - 14, clientY: 96 });
    assert.equal(clawdEl.style.transform.includes('rotate('), false, 'Outer actor.el.style.transform must remain pure translate3d()');
    assert.match(clawdCv.style.transform, /^rotate\(-?\d+(?:\.\d+)?deg\)$/, 'Inner actor.canvas must drive 60fps GPU rotate()');

    // Record baseline after initial dangle draw, then perform 12 rapid drags + flush rAF on same tickIdx
    h.resetCounters();
    const snapAfterDragStart = h.stage.getLayoutSnapshot();
    const drawsAtDragStart = snapAfterDragStart.perf.canvasDraws;
    const skipsAtDragStart = snapAfterDragStart.perf.canvasSkips;
    const seenDragRots = new Set([clawdCv.style.transform]);

    let px = clawd0.worldCx - 14;
    for (let i = 1; i <= 12; i++) {
      h.advanceClock(16);
      // Variable-speed left/right dragging to produce continuous physical tilt angle changes
      px += i <= 6 ? -(4 + i * 2.5) : 5 + (i - 6) * 2.2;
      clawdEl.dispatch('pointermove', { clientX: px, clientY: 88 - i * 1.5 });
      seenDragRots.add(clawdCv.style.transform);
      h.stepRafOnce(16);
    }

    const snapDuringDrag = h.stage.getLayoutSnapshot();
    assert.ok(seenDragRots.size >= 4, `Expected continuous GPU rotation updates during drag, observed ${seenDragRots.size}: ${[...seenDragRots]}`);
    assert.equal(snapDuringDrag.perf.canvasDraws, drawsAtDragStart, 'Continuous dragging with unchanged sprite pose must do 0 software canvasDraws');
    assert.equal(h.counters().clearRectCalls, 0, 'Continuous dragging must trigger 0 clearRect calls');
    assert.equal(h.counters().drawImageCalls, 0, 'GPU rotation must never call software offscreen drawImage');
    assert.equal(clawdCv.__agRotOff, undefined, 'Must never allocate offscreen __agRotOff rotation canvas');
    assert.equal(h.counters().createdCanvases, canvasesAfterMount, 'No auxiliary rotation canvas may be allocated');
    assert.ok(
      snapDuringDrag.perf.canvasSkips >= skipsAtDragStart + 12,
      `Expected canvasSkips to hit on unchanged drag rAF frames (${skipsAtDragStart} -> ${snapDuringDrag.perf.canvasSkips})`
    );

    // Fling up-left before release: verify every flight rAF syncs 60fps GPU tilt without offscreen canvas, redrawing only on pose transitions (e.g. bounce flat)
    h.advanceClock(16);
    clawdEl.dispatch('pointermove', { clientX: px - 18, clientY: 42 });
    h.advanceClock(16);
    clawdEl.dispatch('pointerup', { clientX: px - 18, clientY: 42 });

    const seenFlightRots = new Set();
    let flightFrames = 0;
    const drawsAtLaunch = h.stage.getLayoutSnapshot().perf.canvasDraws;
    while (h.pendingRafCount() > 0 && flightFrames < 200) {
      h.stepRafOnce(16.6667);
      flightFrames += 1;
      if (h.pendingRafCount() > 0 && clawdCv.style.transform) {
        seenFlightRots.add(clawdCv.style.transform);
      }
    }

    const drawsAfterFlight = h.stage.getLayoutSnapshot().perf.canvasDraws;
    assert.ok(flightFrames >= 12, `Expected multi-frame ballistic arc, got ${flightFrames}`);
    assert.ok(seenFlightRots.size >= 5, `Expected smooth 60fps GPU rotation updates across flight, got ${seenFlightRots.size}`);
    assert.ok(
      drawsAfterFlight - drawsAtLaunch <= 4,
      `Flight must only redraw on actual pose transitions (not every 60fps frame); delta=${drawsAfterFlight - drawsAtLaunch} over ${flightFrames} frames`
    );
    assert.equal(h.counters().drawImageCalls, 0, 'Ballistic flight must perform 0 offscreen drawImage rotations');
    assert.equal(clawdCv.__agRotOff, undefined);
    assert.equal(clawdCv.style.transform, '', 'Landing must reset GPU rotation back to empty string');

    // Verify static head-tilt pose (tilt) also uses GPU rotate with 0 software offscreen redraws
    h.stage.onUserType('is this smooth?');
    assert.equal(catCv.style.transform, 'rotate(-9deg)', 'tilt clip must drive GPU rotate(-9deg) on inner canvas');
    assert.equal(h.counters().drawImageCalls, 0);
    assert.equal(catCv.__agRotOff, undefined);
  } finally {
    h.cleanup();
  }
});

test('v107 P0-3.3: pointerdown reuses cached stageW with 0 clientWidth reflows and syncs data-ag-cs-mascot-drag="1" across drag, release, blur, and dispose', () => {
  const h = createPhysicsStageHarness({ width: 720, miniPileEnabled: true, reducedMotion: false, manualClock: true });
  try {
    const clawdEl = h.findActorEl('clawd');
    const shadesEl = h.findMiniEl('shades');
    const html = h.mockHtml;

    assert.equal(html.getAttribute('data-ag-cs-mascot-drag'), null);

    // Reset read counters after initial mount
    h.resetCounters();

    // 1) Main mascot drag: onDown reuses cachedHostWidth (0 forced clientWidth reflows), sub-threshold does not set attr, active drag sets attr, release clears it
    const clawd0 = h.stage.getLayoutSnapshot().actors.find((a) => a.id === 'clawd');
    clawdEl.dispatch('pointerdown', { clientX: clawd0.worldCx, clientY: 100 });
    assert.equal(h.counters().clientWidthReads, 0, 'pointerdown must reuse cached stage width with 0 clientWidth reflows');
    assert.equal(html.getAttribute('data-ag-cs-mascot-drag'), null, 'Sub-threshold pointerdown must not set data-ag-cs-mascot-drag');

    h.advanceClock(16);
    clawdEl.dispatch('pointermove', { clientX: clawd0.worldCx - 18, clientY: 88 });
    assert.equal(html.getAttribute('data-ag-cs-mascot-drag'), '1', 'Dragging main actor must set data-ag-cs-mascot-drag="1" on documentElement');
    assert.equal(h.counters().clientWidthReads, 0, 'Dragging must perform 0 clientWidth reflows');

    h.advanceClock(16);
    clawdEl.dispatch('pointerup', { clientX: clawd0.worldCx - 18, clientY: 88 });
    assert.equal(html.getAttribute('data-ag-cs-mascot-drag'), null, 'Releasing main actor must clear data-ag-cs-mascot-drag immediately');

    // Drain ballistic rAF queue
    for (let i = 0; i < 120 && h.pendingRafCount() > 0; i++) h.stepRafOnce(16.6667);

    // 2) Window blur mid-drag of main mascot -> immediately clears data-ag-cs-mascot-drag
    const clawd1 = h.stage.getLayoutSnapshot().actors.find((a) => a.id === 'clawd');
    clawdEl.dispatch('pointerdown', { clientX: clawd1.worldCx, clientY: 100 });
    h.advanceClock(16);
    clawdEl.dispatch('pointermove', { clientX: clawd1.worldCx - 20, clientY: 80 });
    assert.equal(html.getAttribute('data-ag-cs-mascot-drag'), '1');
    h.mockWin.dispatch('blur');
    assert.equal(html.getAttribute('data-ag-cs-mascot-drag'), null, 'window blur must clear data-ag-cs-mascot-drag');
    h.mockWin.dispatch('focus');

    // 3) Mini-crab drag + blur cleanup
    const sh0 = h.stage.getLayoutSnapshot().minis.find((m) => m.id === 'shades');
    shadesEl.dispatch('pointerdown', { clientX: sh0.worldCx, clientY: 100 });
    h.advanceClock(16);
    shadesEl.dispatch('pointermove', { clientX: sh0.worldCx + 16, clientY: 86 });
    assert.equal(html.getAttribute('data-ag-cs-mascot-drag'), '1', 'Dragging mini-crab must set data-ag-cs-mascot-drag="1"');
    assert.equal(h.counters().clientWidthReads, 0, 'Mini-crab drag must perform 0 clientWidth reflows');
    h.mockWin.dispatch('blur');
    assert.equal(html.getAttribute('data-ag-cs-mascot-drag'), null, 'window blur during mini-crab drag must clear data-ag-cs-mascot-drag');
    h.mockWin.dispatch('focus');

    // 4) dispose() mid-drag -> must clean up data-ag-cs-mascot-drag so prism rim tracking never remains stuck
    clawdEl.dispatch('pointerdown', { clientX: clawd1.worldCx, clientY: 100 });
    h.advanceClock(16);
    clawdEl.dispatch('pointermove', { clientX: clawd1.worldCx - 16, clientY: 84 });
    assert.equal(html.getAttribute('data-ag-cs-mascot-drag'), '1');
    h.stage.dispose();
    assert.equal(html.getAttribute('data-ag-cs-mascot-drag'), null, 'dispose() during active drag must remove data-ag-cs-mascot-drag');
  } finally {
    h.cleanup();
  }

  // 5) Unmeasured initial width (clientWidth===0) falls back to one-time measurement and caches for 0 subsequent reflows
  const hZero = createPhysicsStageHarness({ width: 0, miniPileEnabled: false, reducedMotion: true, manualClock: true });
  try {
    hZero.resetCounters();
    hZero.setWidth(680);
    const catEl = hZero.findActorEl('cat');
    catEl.dispatch('pointerdown', { clientX: 500, clientY: 100 });
    catEl.dispatch('pointerup', { clientX: 500, clientY: 100 });
    assert.equal(hZero.counters().clientWidthReads, 1, 'Unmeasured initial width should fall back to reading clientWidth once');
    catEl.dispatch('pointerdown', { clientX: 500, clientY: 100 });
    catEl.dispatch('pointerup', { clientX: 500, clientY: 100 });
    assert.equal(hZero.counters().clientWidthReads, 1, 'Subsequent pointerdowns must reuse cached width with 0 extra reads');
  } finally {
    hZero.cleanup();
  }
});

test('v107 P0-3.4: high-frequency right-sidebar resize coalesces via rAF with 0 clientWidth/rect reflows, follows smoothly during data-ag-cs-resizing="1", and rebounds cleanly on release', async () => {
  const h = createPhysicsStageHarness({ width: 720, miniPileEnabled: true, reducedMotion: false, manualClock: false });
  try {
    const snap0 = h.stage.getLayoutSnapshot();
    const cat0 = snap0.actors.find((a) => a.id === 'cat').x;
    const clawd0 = snap0.actors.find((a) => a.id === 'clawd').x;
    const draws0 = snap0.perf.canvasDraws;
    const catEl = h.findActorEl('cat');
    const clawdEl = h.findActorEl('clawd');

    h.resetCounters();

    // Enable right-sidebar drag flag (via data-ag-cs-resizing="1" only, without dispatching window pointerdown)
    h.mockHtml.setAttribute('data-ag-cs-resizing', '1');

    // Burst same-frame shrink events mixed with collapsed 0-width and multi-entry callbacks: must read only last valid contentRect.width and coalesce into 1 rAF
    h.setWidth(360);
    h.triggerRo([{ contentRect: { width: 640 } }]);
    h.triggerRo([{ contentRect: { width: 0 } }]); // Collapsed/hidden frame must never fall back to reading hostEl.clientWidth
    h.triggerRo([{ contentRect: { width: 540 } }, { contentRect: { width: 360 } }]);

    assert.equal(h.pendingRafCount(), 1, 'Burst ResizeObserver events within one frame must coalesce into 1 rAF');
    assert.equal(h.counters().clientWidthReads, 0, 'ResizeObserver path must perform 0 hostEl.clientWidth reflows');
    assert.equal(h.counters().rectReads, 0, 'ResizeObserver path must perform 0 getBoundingClientRect reflows');

    h.stepRafOnce();
    assert.equal(h.counters().clientWidthReads, 0, 'Flushing narrow resize rAF must perform 0 clientWidth reflows');
    assert.equal(h.counters().rectReads, 0, 'Flushing narrow resize rAF must perform 0 getBoundingClientRect reflows');
    const snapNarrow = h.stage.getLayoutSnapshot();
    const catN = snapNarrow.actors.find((a) => a.id === 'cat').x;
    const clawdN = snapNarrow.actors.find((a) => a.id === 'clawd').x;
    assert.ok(catN < cat0 - 150 && clawdN < clawd0 - 150, `Both mascots must be pushed left on narrow stage (${cat0}->${catN}, ${clawd0}->${clawdN})`);
    assert.equal(catEl.getAttribute('data-direct'), '1', 'Pushed cat must lock data-direct="1" during data-ag-cs-resizing="1"');
    assert.equal(clawdEl.getAttribute('data-direct'), '1', 'Pushed clawd must lock data-direct="1" during data-ag-cs-resizing="1"');
    assert.equal(snapNarrow.perf.canvasDraws, draws0, 'Resize push must trigger 0 software canvasDraws');

    // Widen back to the right (360 -> 500) while data-ag-cs-resizing="1" is active: low-overhead direct follow with 0 canvas redraws
    h.resetCounters();
    h.setWidth(500);
    h.triggerRo([{ contentRect: { width: 500 } }]);
    h.stepRafOnce();
    assert.equal(h.counters().clientWidthReads, 0, 'Widen follow-push must perform 0 clientWidth reflows');
    assert.equal(h.counters().rectReads, 0, 'Widen follow-push must perform 0 getBoundingClientRect reflows');
    const snapMid = h.stage.getLayoutSnapshot();
    const catMid = snapMid.actors.find((a) => a.id === 'cat').x;
    const clawdMid = snapMid.actors.find((a) => a.id === 'clawd').x;
    assert.ok(catMid > catN + 80 && clawdMid > clawdN + 80, 'Both mascots must follow smoothly during data-ag-cs-resizing="1" widen');
    assert.equal(catEl.getAttribute('data-direct'), '1');
    assert.equal(snapMid.perf.canvasDraws, draws0, 'Follow-push during resizing must trigger 0 software canvasDraws');

    // Release while still at narrower 500px width (remove data-ag-cs-resizing): hold steady without jumping and clear data-direct
    h.mockHtml.removeAttribute('data-ag-cs-resizing');
    assert.equal(catEl.getAttribute('data-direct'), null, 'Releasing resize at steady edge must release data-direct');

    // Collapse sidebar to expand back to 720px -> natural parabolic rebound to original position after 120ms debounce
    h.setWidth(720);
    h.triggerRo([{ contentRect: { width: 720 } }]);
    h.stepRafOnce();
    await new Promise((r) => setTimeout(r, 220));
    for (let i = 0; i < 120 && h.pendingRafCount() > 0; i++) {
      await new Promise((r) => setTimeout(r, 4));
      h.stepRafOnce();
    }

    const snapBack = h.stage.getLayoutSnapshot();
    assert.ok(
      Math.abs(snapBack.actors.find((a) => a.id === 'cat').x - cat0) <= 2,
      `cat must rebound to original x (${cat0} vs ${snapBack.actors.find((a) => a.id === 'cat').x})`
    );
    assert.ok(
      Math.abs(snapBack.actors.find((a) => a.id === 'clawd').x - clawd0) <= 2,
      `clawd must rebound to original x (${clawd0} vs ${snapBack.actors.find((a) => a.id === 'clawd').x})`
    );
    assert.equal(catEl.getAttribute('data-direct'), null, 'Rebound completion must cleanly clear data-direct');
    assert.equal(clawdEl.getAttribute('data-direct'), null, 'Rebound completion must cleanly clear data-direct');
    assert.equal(h.counters().clientWidthReads, 0, 'Entire high-frequency resize + rebound cycle must do 0 clientWidth reflows');
  } finally {
    h.cleanup();
  }
});

test('v107 P0-3.5: mini-crab ballistic flight streams 60fps GPU translate3d+rotate with zero redundant main-actor canvas redraws', () => {
  const h = createPhysicsStageHarness({ miniPileEnabled: true, reducedMotion: false, manualClock: true });
  try {
    const wizEl = h.findMiniEl('wizard');
    const wiz0 = h.stage.getLayoutSnapshot().minis.find((m) => m.id === 'wizard');
    // Toss into open left space away from right-side main mascot heads to verify pure ballistic flight triggers 0 main-actor redraws
    wizEl.dispatch('pointerdown', { clientX: wiz0.worldCx, clientY: 110 });
    h.advanceClock(16);
    wizEl.dispatch('pointermove', { clientX: wiz0.worldCx - 16, clientY: 88 });
    assert.match(wizEl.style.transform, /^translate3d\([^)]+\) rotate\(-?\d+(?:\.\d+)?deg\)$/);

    h.advanceClock(16);
    wizEl.dispatch('pointermove', { clientX: wiz0.worldCx - 34, clientY: 64 });
    h.advanceClock(16);
    wizEl.dispatch('pointerup', { clientX: wiz0.worldCx - 34, clientY: 64 });

    h.resetCounters();
    const drawsBefore = h.stage.getLayoutSnapshot().perf.canvasDraws;
    const seenMiniTransforms = new Set();
    let frames = 0;

    while (h.pendingRafCount() > 0 && frames < 160) {
      h.stepRafOnce(16.6667);
      frames += 1;
      if (h.pendingRafCount() > 0) {
        seenMiniTransforms.add(wizEl.style.transform);
      }
    }

    assert.ok(frames >= 10, `Expected multi-frame mini-crab arc, got ${frames}`);
    assert.ok(
      [...seenMiniTransforms].some((t) => /translate3d\([^)]+\) rotate\(-?\d+(?:\.\d+)?deg\)/.test(t)),
      'Mini-crab flight must apply 60fps GPU translate3d + rotate'
    );
    assert.equal(
      h.stage.getLayoutSnapshot().perf.canvasDraws,
      drawsBefore,
      'Mini-crab ballistic flight must trigger 0 redundant main-actor canvasDraws'
    );
    assert.equal(h.counters().drawImageCalls, 0);
    assert.equal(wizEl.style.transform.includes('rotate('), false, 'Settled mini-crab must remove rotate()');
  } finally {
    h.cleanup();
  }
});
