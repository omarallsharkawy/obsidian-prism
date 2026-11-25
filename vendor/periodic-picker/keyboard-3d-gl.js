/**
 * Obsidian Prism — Pure WebGL2 V12 In-Flow Desk Dock Suite: Heavy CNC Step-Bezel Dual Peripherals
 * (18×7 Main Periodic Monolith + 2×3 Aux Macro Pad), `#0 Orch` Latching Mechanical Toggle Switch,
 * Dynamic Dimmed Blind State, Effort-Scaled Dual-Core Micro-Crystal Field & 1:1 Co-Orbit Engine
 *
 * V12 Architecture Highlights:
 *   1. `#0 Orch` Latching Toggle Switch & Dual-Core Blended Micro-Crystal Field:
 *      - Slot `#0 Orchestrator` acts as a latching mechanical switch (`orchLatched`: `-0.135U` latched travel,
 *        warm purple-gold legend/edge indicator & recessed socket collar glow, never levitating).
 *      - Exactly one active model key levitates globally; when `orchLatched === true`, ~35% of its faceted
 *        micro-crystals blend royal amethyst & amber gold to echo the latched `#0 Orch` toggle.
 *   2. Dynamic Dimmed Blind State (`slotAvailCur` / `auxAvailCur` @ `~14/s` + `lockedShakeAuxIndex`):
 *      - Unsupported keys smoothly dim from high-gloss ceramic into low-contrast matte blind-key finish
 *        while retaining subtle engraved legends, with horizontal damped lock-shake feedback.
 *   3. In-Flow Drawer Frustum Optimization, Waistline Desaturation & Strict `5/10/4/5/1` GPU Budget:
 *      - Tight wedge-aware drawer frustum fills wide horizontal docks cleanly with `0` clipping at any aspect;
 *        recessed waistline lightguide desaturated by ~45% into matte micro-metal until pointer/pulse wake;
 *        strict `5 programs / 10 shaders / 4 VAOs / 5 textures / 1 FBO` & `< 180` frames to `0fps` idle sleep.
 *
 * Contract:
 *   globalThis.__agPrismKeyboard3D = { createKeyboard3DRenderer }
 *   module.exports = { createKeyboard3DRenderer }
 */
(function (root, factory) {
  var api = factory(root);
  if (typeof module === 'object' && module && typeof module.exports === 'object') {
    module.exports = api;
  }
  if (root && typeof root === 'object') {
    root.__agPrismKeyboard3D = api;
  }
  if (typeof globalThis === 'object' && globalThis) {
    globalThis.__agPrismKeyboard3D = api;
  }
  if (typeof window === 'object' && window) {
    window.__agPrismPeriodicKeyboard3D = api;
    window.__agPrismKeyboard3D = api;
  }
})(
  typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : this,
  function (moduleRoot) {
    'use strict';

    var DEG2RAD = Math.PI / 180;
    var TWO_PI = Math.PI * 2;
    var IDLE_EPS = 0.0008;

    function smoothstepScalar(edge0, edge1, x) {
      var denom = edge1 - edge0;
      if (Math.abs(denom) < 1e-9) return x >= edge1 ? 1.0 : 0.0;
      var t = (x - edge0) / denom;
      t = t < 0.0 ? 0.0 : t > 1.0 ? 1.0 : t;
      return t * t * (3.0 - 2.0 * t);
    }

    /**
     * C2-continuous quintic curve (strictly zero slope and curvature at near-field boundary, eliminating entry/exit snap)
     */
    function smootherstepScalar(edge0, edge1, x) {
      var denom = edge1 - edge0;
      if (Math.abs(denom) < 1e-9) return x >= edge1 ? 1.0 : 0.0;
      var t = (x - edge0) / denom;
      t = t < 0.0 ? 0.0 : t > 1.0 ? 1.0 : t;
      return t * t * t * (t * (t * 6.0 - 15.0) + 10.0);
    }

    function readNowMs(rtRoot) {
      if (rtRoot && rtRoot.performance && typeof rtRoot.performance.now === 'function') {
        return rtRoot.performance.now();
      }
      if (rtRoot && rtRoot.Date && typeof rtRoot.Date.now === 'function') {
        return rtRoot.Date.now();
      }
      return Date.now();
    }

    /* ============================================================================
     * 0. PBR Micro-Grain Heightfield, 128x64 Studio Metal Envmap & NOVELTY_ICONS / OLED Integration
     * ============================================================================ */
    function resolveGrainPackage(runtimeRoot) {
      return (
        (runtimeRoot && runtimeRoot.__agPrismGrainAssets) ||
        (moduleRoot && moduleRoot.__agPrismGrainAssets) ||
        (typeof globalThis !== 'undefined' && globalThis.__agPrismGrainAssets) ||
        (typeof window !== 'undefined' && window.__agPrismGrainAssets) ||
        (typeof require === 'function'
          ? (function () {
              try {
                return require('./pbr-grain-assets.js');
              } catch (_e) {
                return null;
              }
            })()
          : null)
      );
    }

    function resolveOledScreenModule(runtimeRoot) {
      return (
        (runtimeRoot && runtimeRoot.__agPrismOledScreen) ||
        (moduleRoot && moduleRoot.__agPrismOledScreen) ||
        (typeof globalThis !== 'undefined' && globalThis.__agPrismOledScreen) ||
        (typeof window !== 'undefined' && window.__agPrismOledScreen) ||
        (typeof require === 'function'
          ? (function () {
              try {
                return require('./oled-cyber-screen.js');
              } catch (_e) {
                return null;
              }
            })()
          : null)
      );
    }

    var _fallbackMetalEnvCache = null;
    var _fallbackGrainCache = null;

    /**
     * Procedurally generates a 128x64 (gl.RGB8) high-contrast studio softbox environment map fallback:
     * Horizontally periodic in u, featuring a front-left overhead softbox, rear-right cool titanium rim strip,
     * warm champagne side bounce card, and deep matte studio backdrop for anodized aluminum and PVD mirror weights
     */
    function getFallbackStudioMetalEnvRGB(envW, envH) {
      var W = envW || 128;
      var H = envH || 64;
      if (_fallbackMetalEnvCache && _fallbackMetalEnvCache.w === W && _fallbackMetalEnvCache.h === H) {
        return _fallbackMetalEnvCache.data;
      }
      var rgb = new Uint8Array(W * H * 3);
      for (var y = 0; y < H; y++) {
        var v = (y + 0.5) / H;
        var theta = v * Math.PI;
        var sinT = Math.sin(theta);
        var dy = Math.cos(theta);
        for (var x = 0; x < W; x++) {
          var u = x / W;
          var phi = (u - 0.5) * TWO_PI;
          var dx = Math.cos(phi) * sinT;
          var dz = Math.sin(phi) * sinT;

          /* Deep matte studio backdrop base (separates anodized metal from mirror PVD contrast) */
          var skyMix = smoothstepScalar(-0.22, 0.86, dy);
          var r = 0.036 + 0.125 * skyMix;
          var g = 0.042 + 0.140 * skyMix;
          var b = 0.056 + 0.172 * skyMix;

          /* 1. Front-left overhead main studio diffuse softbox (C2 smooth falloff to avoid banding) */
          var diagCoord = dx * -0.56 + dz * 0.52 + (1.0 - dy) * 0.28;
          var stripMain = smootherstepScalar(0.58, 0.04, Math.abs(diagCoord - 0.06)) * smootherstepScalar(-0.12, 0.45, dy);
          r += 0.90 * stripMain;
          g += 0.92 * stripMain;
          b += 0.96 * stripMain;

          /* 2. Rear-right cool titanium silver-blue rim backlight strip */
          var rimDot = Math.max(0.0, dx * 0.64 + dy * 0.48 + dz * -0.60);
          var rimBand = Math.pow(rimDot, 6.0) * 0.88 + smootherstepScalar(0.28, 0.03, Math.abs(dy - 0.34 - 0.14 * Math.sin(phi * 2.0))) * 0.36;
          r += 0.62 * rimBand;
          g += 0.74 * rimBand;
          b += 0.94 * rimBand;

          /* 3. Front-right warm champagne-gold fill bounce card */
          var fillDot = Math.max(0.0, dx * 0.54 + dy * 0.40 + dz * 0.74);
          var fillCard = Math.pow(fillDot, 5.2) * 0.64;
          r += 0.78 * fillCard;
          g += 0.70 * fillCard;
          b += 0.60 * fillCard;

          var idx = (y * W + x) * 3;
          rgb[idx] = Math.round(Math.max(0, Math.min(1, r)) * 255);
          rgb[idx + 1] = Math.round(Math.max(0, Math.min(1, g)) * 255);
          rgb[idx + 2] = Math.round(Math.max(0, Math.min(1, b)) * 255);
        }
      }
      _fallbackMetalEnvCache = { w: W, h: H, data: rgb };
      return rgb;
    }

    /**
     * When pbr-grain-assets.js is not injected, generates a tileable 128x128 micro-grain heightfield (RG8)
     * and 128x64 studio metal reflection envmap (RGB8) fallback
     */
    function getFallbackVelvetGrainData() {
      if (_fallbackGrainCache) return _fallbackGrainCache;
      var size = 128;
      var combined = new Uint8Array(size * size * 2);
      var cells = 24;

      function cellHash(cx, cy, seed) {
        var x = ((cx % cells) + cells) % cells;
        var y = ((cy % cells) + cells) % cells;
        var n = Math.sin(x * 127.1 + y * 311.7 + seed * 74.7) * 43758.5453;
        return n - Math.floor(n);
      }

      function worleyTile(u, v, seed) {
        var gx = u * cells;
        var gy = v * cells;
        var ix = Math.floor(gx);
        var iy = Math.floor(gy);
        var fx = gx - ix;
        var fy = gy - iy;
        var d1 = 8.0;
        var d2 = 8.0;
        for (var dy = -1; dy <= 1; dy++) {
          for (var dx = -1; dx <= 1; dx++) {
            var jx = dx + cellHash(ix + dx, iy + dy, seed) - fx;
            var jy = dy + cellHash(ix + dx, iy + dy, seed + 19.3) - fy;
            var d = Math.hypot(jx, jy);
            if (d < d1) {
              d2 = d1;
              d1 = d;
            } else if (d < d2) {
              d2 = d;
            }
          }
        }
        return [d1, d2];
      }

      for (var y = 0; y < size; y++) {
        var v = y / size;
        for (var x = 0; x < size; x++) {
          var u = x / size;
          var wPbt = worleyTile(u, v, 1.7);
          var wPbtFine = worleyTile((u * 2.0) % 1.0, (v * 2.0) % 1.0, 9.2);
          var pbtDome = Math.max(0, 1.0 - wPbt[0] * 1.15);
          var pbtVal = pbtDome * 0.58 + (1.0 - Math.min(1.0, wPbtFine[0] * 1.18)) * 0.42;
          pbtVal = Math.max(0, Math.min(1, 0.15 + pbtVal * 0.72));

          var wAlu = worleyTile((u * 3.0) % 1.0, (v * 3.0) % 1.0, 23.4);
          var aluBead = 0.5 + (0.45 - Math.min(0.9, wAlu[0])) * 0.55;
          aluBead = Math.max(0, Math.min(1, aluBead));

          var idx = (y * size + x) * 2;
          combined[idx] = Math.round(pbtVal * 255);
          combined[idx + 1] = Math.round(aluBead * 255);
        }
      }

      _fallbackGrainCache = {
        size: size,
        combinedRG: combined,
        envW: 128,
        envH: 64,
        metalEnvRGB: getFallbackStudioMetalEnvRGB(128, 64),
        emblemViewBox: 2048,
        emblemPaths: [],
        noveltyIcons: null,
      };
      return _fallbackGrainCache;
    }

    function hasNonZeroBytes(arr) {
      if (!arr || !arr.length) return false;
      var step = Math.max(1, Math.floor(arr.length / 96));
      for (var i = 0; i < arr.length; i += step) {
        if (arr[i] !== 0) return true;
      }
      return false;
    }

    function loadMacroGrainAssets(runtimeRoot) {
      var pkg = resolveGrainPackage(runtimeRoot);
      var noveltyIcons = (pkg && pkg.NOVELTY_ICONS) || null;
      if (pkg && typeof pkg.getGrainTextures === 'function') {
        try {
          var data = pkg.getGrainTextures();
          if (data) {
            var fb = null;
            var size = Number(data.size) > 0 ? Number(data.size) : 128;
            var combinedRG = data.combinedRG;
            if (!combinedRG || combinedRG.length < size * size * 2 || !hasNonZeroBytes(combinedRG)) {
              fb = getFallbackVelvetGrainData();
              size = fb.size;
              combinedRG = fb.combinedRG;
            }
            var envW = Number(data.envW) > 0 ? Number(data.envW) : 128;
            var envH = Number(data.envH) > 0 ? Number(data.envH) : 64;
            var metalEnvRGB = data.metalEnvRGB;
            if (!metalEnvRGB || metalEnvRGB.length < envW * envH * 3 || !hasNonZeroBytes(metalEnvRGB)) {
              envW = 128;
              envH = 64;
              metalEnvRGB = getFallbackStudioMetalEnvRGB(128, 64);
            }
            return {
              size: size,
              combinedRG: combinedRG,
              envW: envW,
              envH: envH,
              metalEnvRGB: metalEnvRGB,
              emblemViewBox: data.emblemViewBox || 2048,
              emblemPaths: Array.isArray(data.emblemPaths) ? data.emblemPaths : [],
              noveltyIcons: noveltyIcons,
            };
          }
        } catch (_err) {
          /* fallback to procedural velvet grain & studio metal env */
        }
      }
      var fallback = getFallbackVelvetGrainData();
      if (noveltyIcons) {
        return Object.assign({}, fallback, { noveltyIcons: noveltyIcons });
      }
      return fallback;
    }

    var _compiledEmblemCache = { rawRef: null, path2dList: null };
    function getCompiledEmblemPath2Ds(paths) {
      if (!Array.isArray(paths) || !paths.length || typeof Path2D !== 'function') {
        return null;
      }
      if (_compiledEmblemCache.rawRef === paths && _compiledEmblemCache.path2dList) {
        return _compiledEmblemCache.path2dList;
      }
      try {
        var list = [];
        for (var i = 0; i < paths.length; i++) {
          if (paths[i]) list.push(new Path2D(paths[i]));
        }
        _compiledEmblemCache.rawRef = paths;
        _compiledEmblemCache.path2dList = list;
        return list;
      } catch (_e) {
        return null;
      }
    }

    /* ============================================================================
     * 1. V7 Solid Wedge Screwless CNC Anodized Chassis Dimensions & High-Damping Spring Physics Constants (1U = 1.0 = 19.05mm)
     * ============================================================================ */
    var KEY_PITCH = 1.0;
    var ROW_Z_OFFSET = 0.44;

    /* V10 heavy CNC custom aluminum chassis thick walls & dual Step-Bezel envelope (G2 corner radius R = 0.56U) */
    var CASE_HALF_W = 9.68;
    var CASE_Z_MIN = -3.86;
    var CASE_Z_MAX = 4.62;
    var CASE_CORNER_R = 0.56;
    var CASE_Y_BOT = -0.92;
    var CASE_Y_TOP = 0.26;
    var CASE_STEP_Y = 0.222;
    var PLATE_Y = -0.18;

    /* Row 1 hardware deck coordinates: left 1U metal prism key (col=2,row=1) & right 5U PVD control deck (col=13..17,row=1) */
    var ROW1_Z = -2.56;
    var ARTISAN_WAVE_X = -7.50;
    var HW_DECK_X0 = 2.99;
    var HW_DECK_X1 = 8.01;
    var HW_DECK_Z0 = -3.03;
    var HW_DECK_Z1 = -2.07;
    var HW_DECK_Y_TOP = 0.395;
    var CTRL_RESET_X = 5.36;
    var CTRL_MUTE_X = 6.38;
    var CTRL_CLOSE_X = 7.40;
    var CONTROL_IDS = ['prism-wave', 'reset-view', 'mute', 'close'];

    /* Recessed keywell inner cavity opening bounds (V10 tight CNC wire-cut tolerances) */
    var WELL_X_MIN = -9.01;
    var WELL_X_MAX = 9.01;
    var WELL_Z_MIN = -3.07;
    var WELL_Z_MAX = 3.93;
    var WELL_CORNER_R = 0.20;

    /* V13.1 right-side magnetically docked 3D 2x3 non-element macro pad (AUX-06) geometry envelope (joined via 0.28U CNC rail bridge) */
    var AUX_SLOT_COUNT = 6;
    var AUX_COLS = 2;
    var AUX_ROWS = 3;
    var AUX_CENTER_X = 11.21;
    var AUX_COL0_X = 10.71;
    var AUX_COL1_X = 11.71;
    var AUX_ROW_ZS = [1.44, 2.44, 3.44];  /* Vertically aligned with main keyboard lower core rows 5..7 */
    var AUX_CENTER_Z = 2.44;
    var AUX_WELL_X_MIN = 10.20;
    var AUX_WELL_X_MAX = 12.22;
    var AUX_WELL_Z_MIN = 0.93;
    var AUX_WELL_Z_MAX = 3.95;
    var AUX_WELL_CORNER_R = 0.17;
    var AUX_CASE_X_MIN = 9.96;            /* Only 0.28U from main right edge +9.68U, joined by solid CNC magnetic rail bridge */
    var AUX_CASE_X_MAX = 12.46;           /* Compact dual-peripheral span covering [-9.68, +12.46] */
    var AUX_CASE_Z_MIN = 0.32;
    var AUX_CASE_Z_MAX = 4.62;            /* Front wedge lip strictly flush with main chassis +4.62U */
    var AUX_CASE_CORNER_R = 0.36;

    /* V13.1 industrial sculpted keycap geometry, +0.08U hover lift, 4-tier effort levitation heights & neighbor sympathy physics */
    var CAP_Y_BASE = 0.015;
    var CAP_HEIGHT = 0.58;
    var CAP_BASE_HALF = 0.460;
    var CAP_TOP_HALF = 0.354;
    var CAP_PRESS_TRAVEL = 0.11;          /* Tactile cross-stem bottom-out travel -0.11U (retains plate stop clearance) */
    var CAP_HOVER_LIFT = 0.080;           /* Subtle +0.08U hover lift on available model keys alongside top LED slot & compare radar */
    var CAP_SELECT_LIFT = 0.64;           /* Default Medium (Tier 1) base levitation height 0.64U */
    var EFFORT_TIER_LIFTS = [0.40, 0.64, 0.88, 1.06]; /* Low: 0.40U -> Medium: 0.64U -> High: 0.88U -> Extra: 1.06U */
    var NEIGHBOR_SYMPATHY_LIFTS = [0.0, 0.0, 0.042, 0.076]; /* High: ~0.042U, Extra: ~0.076U neighbor zero-G sympathy lift */
    var NEIGHBOR_SYMPATHY_RADIUS = 1.65;  /* Same-chassis immediate ring center distance <= 1.65U antigravity pull radius */
    var NEIGHBOR_SYMPATHY_TILT_MAX = 1.85 * DEG2RAD; /* Slight inward tilt on neighbors toward the levitated center in Extra tier */
    var CAP_SELECT_SCALE = 1.14;          /* Balanced macro magnification 1.14x */
    var CAP_MAGNETIC_DRIFT = 0.09;        /* Composed near-field horizontal magnetic drift capped at +/-0.09U (X / Z) */
    var CAP_NORM_DRIFT_COMPAT = 0.12;     /* Normalized compatibility drift amplitude for setPointerNorm */
    var CAP_TILT_MAX_RAD = 13.0 * DEG2RAD;/* Near-field max target tilt capped at +/-13 deg (~0.227 rad) Pitch / Roll */
    var CAP_YAW_MAX_RAD = 3.5 * DEG2RAD;  /* Subtle near-field +/-3.5 deg Yaw rotation */
    var NEAR_PEAK_NORM_GAIN = 2.65;       /* Pairs with C2 smootherstep so near-field dwell settles smoothly */
    var INPUT_SMOOTH_TAU = 0.038;         /* Stage-1 heavy inertia input low-pass time constant (filters pass-through jitter for hydraulic onset) */

    /* Stage-2 heavy paperweight damped ferrofluid spring (wn = 11.0 rad/s, zeta = 0.765 -> ~2.4% <=3% silky settle overshoot) */
    var TILT_SPRING_WN = 11.0;
    var TILT_SPRING_ZETA = 0.765;
    var DRIFT_SPRING_WN = 11.0;
    var DRIFT_SPRING_ZETA = 0.765;

    /* Crisp confirmation bottom-out slam non-bouncing spring (~65ms snappy return onto cross stem) */
    var SLAM_SPRING_WN = 48.0;
    var SLAM_SPRING_ZETA = 0.94;

    /* V12 #0 Orch mechanical latching travel & dynamic non-planner dim transition parameters */
    var ORCH_LATCH_TRAVEL = 0.135;             /* #0 Orch tactile latch-down travel -0.135U (never levitates) */
    var ORCH_LATCH_WN = 32.0;                  /* Latch detent spring natural frequency 32.0 rad/s */
    var ORCH_LATCH_ZETA = 0.86;                /* Crisp high damping ratio 0.86 */
    var AVAIL_DIM_RATE = 14.0;                 /* Smooth dim/relight convergence rate ~14/s for unsupported keys */

    /* V11 1:1 responsive orbit tracking, momentum coasting (damping ~6.0) & dual-chassis co-orbit physics constants */
    var ORBIT_YAW_LIMIT = 0.78;                /* +/-0.78 rad (~+/-44.7 deg) wide-angle side inspection yaw limit */
    var ORBIT_PITCH_MIN = -0.62;               /* -0.62 rad (~-35.5 deg) underside weight & waistline inspection pitch min */
    var ORBIT_PITCH_MAX = 0.56;                /* +0.56 rad (~+32.1 deg) top-down full layout & crystal field pitch max */
    var ORBIT_PIVOT_SINGLE = [0.0, -0.22, 0.38];  /* Single main-chassis centroid orbit pivot */
    var ORBIT_PIVOT_SUITE = [1.26, -0.22, 0.42];  /* Main + docked AUX-06 dual-peripheral co-orbit pivot */
    var ORBIT_SERVO_WN = 38.0;                 /* 38.0 rad/s high-bandwidth tightly coupled orbit servo */
    var ORBIT_SERVO_ZETA = 0.96;               /* Near-critical damping zeta = 0.96 (1:1 tracking with zero wobble) */
    var ORBIT_HYDRAULIC_COUPLE = 0.94;         /* 0.94 high feedforward coupling for zero-lag drag tracking */
    var ORBIT_FLING_DAMP = 6.0;                /* Smooth exponential coast damping on release (damping = 6.0, settles to 0fps in <160 frames) */
    var ORBIT_RESET_WN = 18.5;                 /* Orbit reset spring natural frequency */
    var ORBIT_RESET_ZETA = 0.88;               /* Orbit reset high damping for overshoot-free return */
    var AUX_COORBIT_LAG_RATIO = 0.032;         /* Right 2x3 aux pad ~3.2% graceful zero-G inertial lag during co-orbit */

    var GYRO_COUNTER_RATIO = 0.40;             /* Levitated hero key ~40% antigravity gyro world-up counter-balance ratio */
    var GYRO_COUNTER_MAX_RAD = 20.5 * DEG2RAD; /* Soft anti-clipping counter-tilt clamp */
    var ZERO_G_DURATION = 2.46;                /* Post-interaction ~2.46s (~154 frames <180) optical flow & crystal float window before 0fps sleep */
    var ZERO_G_FLING_CAP = 2.02;               /* Post-fling window cap (~126 frames <160) guaranteeing endChassisOrbitDrag settles in <160 frames */
    var ZERO_G_BOB_AMP = 0.028;                /* Zero-G slow vertical breathing bob +/-0.028U */
    var ZERO_G_TILT_AMP = 1.1 * DEG2RAD;       /* Zero-G slow breathing tilt +/-1.1 deg */

    var INTRO_WAKE_DURATION = 0.34;            /* triggerIntroWake: ~340ms zero-G rise + left-to-right prism sweep */
    var INTRO_SINK_Y = -0.28;                  /* Intro starting zero-G dip -0.28U */
    var INTRO_PITCH_RAD = 8.0 * DEG2RAD;       /* Intro starting pitch offset +8 deg */
    var WAVE_RIPPLE_SPEED = 32.0;              /* triggerWaveRipple: ~32 U/s 3D mechanical wave speed across main + aux pads */
    var WAVE_RIPPLE_PEAK = 0.048;              /* Mechanical wave ripple peak dip ~0.048U */
    var WAVE_RIPPLE_DURATION = 0.56;           /* ~560ms decay across both pads back to 0fps */
    var AUX_PAGE_WAVE_DURATION = 0.28;         /* Aux pad 2x3 page-switch light wave bounce duration (~280ms) */
    var ENERGY_PULSE_DURATION = 0.32;          /* triggerEnergyPulse: ~320ms effort-switch lumen resonance pulse */

    /* 6 family prism dispersion spectrum enum aligned with prism-rim-canvas.js */
    var RIM_TONE_TO_INDEX = {
      default: 0,
      warm: 1,
      cobalt: 2,
      iris: 3,
      amber: 4,
      mono: 5,
    };

    /* R1-R4 ergonomic sculpted row tilt & height biases (Row 1..7) */
    var ROW_SCULPT_PROFILE = [
      null,
      { pitch: 4.0 * DEG2RAD, scaleY: 1.06, yBias: 0.016 },  /* Row 1: R1 */
      { pitch: 2.3 * DEG2RAD, scaleY: 1.02, yBias: 0.007 },  /* Row 2: R1/R2 */
      { pitch: 0.8 * DEG2RAD, scaleY: 0.98, yBias: 0.000 },  /* Row 3: R2 */
      { pitch: -0.7 * DEG2RAD, scaleY: 0.95, yBias: -0.005 },/* Row 4: R3 core home row */
      { pitch: -2.3 * DEG2RAD, scaleY: 0.98, yBias: 0.002 }, /* Row 5: R4 */
      { pitch: -3.6 * DEG2RAD, scaleY: 1.01, yBias: 0.009 }, /* Row 6: R4 lanthanoids */
      { pitch: -4.5 * DEG2RAD, scaleY: 1.03, yBias: 0.014 }, /* Row 7: R4 actinoids */
    ];

    /* Groups 3-12 (Col 3..12, Row 1..3) rounded CNC recessed 2.5D smoked sapphire OLED screen (logical 1600x480 -> physical 800x240, 3x supersampled, -75% upload) */
    var DECK_X_MIN = -6.90;
    var DECK_X_MAX = 2.90;
    var DECK_Z_MIN = -3.02;
    var DECK_Z_MAX = -0.14;
    var DECK_CORNER_R = 0.16;
    var DECK_GLASS_Y = 0.125;
    var OLED_DESIGN_WIDTH = 1600;
    var OLED_DESIGN_HEIGHT = 480;
    var OLED_WIDTH = 800;
    var OLED_HEIGHT = 240;

    /* 71.5-deg elevated full-frame camera showing front wedge lip (auto-fits single, fullscreen dual, or compact dock) */
    var CAM_FOV_Y = 18.0 * DEG2RAD;
    var CAM_PITCH = 71.5 * DEG2RAD;
    var CAM_TARGET_SINGLE = [0.0, -0.05, 0.36];
    var CAM_TARGET_SUITE = [1.34, -0.05, 0.38];
    var CAM_TARGET_SUITE_DRAWER = [1.39, -0.06, 0.39];

    /* 1024x1024 real-time shadow map (~2.8x supersampled with 6-tap IGN Vogel PCF) & front-left overhead key light */
    var SHADOW_MAP_SIZE = 1024;
    var SHADOW_MAP_SIZE_ULTRA = 1024;
    var SHADOW_MAP_SIZE_REDUCED = 1024;
    var MAIN_LIGHT_DIR = (function () {
      var lx = -0.46, ly = 0.74, lz = 0.49;
      var l = Math.hypot(lx, ly, lz);
      return [lx / l, ly / l, lz / l];
    })();

    function normalizeTargetFps(raw) {
      if (raw === null || raw === undefined || raw === '') return 'native';
      var s = String(raw).trim().toLowerCase();
      if (s === '60' || s === '120' || s === '180' || s === 'native') return s;
      return 'native';
    }

    function resolveMinFrameGapMs(fpsKey) {
      if (fpsKey === '60') return 15.5;
      if (fpsKey === '120') return 7.6;
      if (fpsKey === '180') return 4.9;
      return 0;
    }

    function normalizeMotionLevel(raw) {
      if (raw === null || raw === undefined || raw === '') return null;
      var s = String(raw).trim().toLowerCase();
      if (s === 'ultra' || s === 'medium' || s === 'low' || s === 'subtle' || s === 'off') return s;
      if (s === 'standard') return 'medium';
      return null;
    }

    var _rmMqlCache = typeof WeakMap === 'function' ? new WeakMap() : null;
    function checkPrefersReducedMotion(rt) {
      try {
        var host = (rt && typeof rt.matchMedia === 'function')
          ? rt
          : (typeof window !== 'undefined' && window && typeof window.matchMedia === 'function' ? window : null);
        if (!host) return false;
        var mm = host.matchMedia;
        if (_rmMqlCache) {
          var cached = _rmMqlCache.get(host);
          if (cached && cached.fn === mm && cached.mq) {
            return Boolean(cached.mq.matches);
          }
          var mq = mm.call(host, '(prefers-reduced-motion: reduce)');
          _rmMqlCache.set(host, { fn: mm, mq: mq });
          return Boolean(mq && mq.matches);
        }
        var mq2 = mm.call(host, '(prefers-reduced-motion: reduce)');
        if (mq2 && mq2.matches) return true;
      } catch (_mmErr) {}
      return false;
    }

    /* ============================================================================
     * 2. V13.1 Precision CNC 6063 Bead-Blasted Anodized Aluminum Palettes (Obsidian / Warm / Crystal / Alabaster) & Industrial Keycaps
     * ============================================================================ */
    var THEME_PALETTES = {
      'obsidian-dark': {
        /* Deep titanium gunmetal CNC 6063 anodized aluminum + 45-deg bright silver chamfer + dark graphite PBT blind keys + ceramic available keys */
        caseBody: '#2B3038',
        caseStep: '#1F232A',
        caseSide: '#1C2026',
        caseUnder: '#13161B',
        caseChamfer: '#D2DBE8',
        hwDeckBody: '#252A32',
        hwDeckPanel: '#343A44',
        hwDeckRim: '#CFD8E6',
        artisanMetal: '#343A44',
        artisanRim: '#D8E0EC',
        statusLedOn: '#EEF4FC',
        backWeightBody: '#282E38',
        backWeightRim: '#B4C0D2',
        waistGroove: '#0E1116',
        footPad: '#08090C',
        innerWall: '#101318',
        plate: '#0C0F14',
        stealthCap: '#1E2127',
        stealthLegend: '#949DAB',
        stealthModCap: '#1B1E24',
        stealthModLegend: '#8C95A4',
        stealthAlphaCap: '#252930',
        stealthAlphaLegend: '#A2ABB9',
        availRestCap: '#CFC8BC',
        availRestLegend: '#14171D',
        auxRestCap: '#21252D',
        auxRestLegend: '#E8EEF6',
        deckFrame: '#161920',
        deckStep: '#0E1117',
        deckLip: '#3E4654',
        deckGlassBg: '#030509',
        deckGlassTint: [0.016, 0.020, 0.030],
        deckSub: '#94A3B8',
        deckMuted: '#64748B',
        rimTint: [0.88, 0.92, 0.98],
        defaultRimTone: 'mono',
        shadowAlpha: 0.56,
      },
      'warm-dark': {
        /* Deep bronze-titanium CNC anodized aluminum + champagne 45-deg chamfer + warm graphite PBT blind keys + ivory ceramic available keys */
        caseBody: '#322922',
        caseStep: '#251E19',
        caseSide: '#201A15',
        caseUnder: '#16120F',
        caseChamfer: '#DEC197',
        hwDeckBody: '#2A221C',
        hwDeckPanel: '#3A2F27',
        hwDeckRim: '#DFC298',
        artisanMetal: '#3A2F27',
        artisanRim: '#E6CBA4',
        statusLedOn: '#F8E6C4',
        backWeightBody: '#332820',
        backWeightRim: '#C8A87C',
        waistGroove: '#110D0A',
        footPad: '#0A0806',
        innerWall: '#130F0C',
        plate: '#0E0B09',
        stealthCap: '#221E1B',
        stealthLegend: '#A2978B',
        stealthModCap: '#1E1B18',
        stealthModLegend: '#978C80',
        stealthAlphaCap: '#2A2521',
        stealthAlphaLegend: '#B2A79A',
        availRestCap: '#DFD6C7',
        availRestLegend: '#181410',
        auxRestCap: '#241E1A',
        auxRestLegend: '#F2EAE0',
        deckFrame: '#1A1511',
        deckStep: '#120E0B',
        deckLip: '#4A3C31',
        deckGlassBg: '#050404',
        deckGlassTint: [0.026, 0.021, 0.018],
        deckSub: '#A8A29E',
        deckMuted: '#78716C',
        rimTint: [0.98, 0.91, 0.80],
        defaultRimTone: 'warm',
        shadowAlpha: 0.58,
      },
      'crystal-light': {
        /* Silver-white bead-blasted anodized aluminum + polished silver 45-deg chamfer + mist-gray PBT blind keys + porcelain available keys */
        caseBody: '#DCE1E8',
        caseStep: '#CBD2DC',
        caseSide: '#BEC6D2',
        caseUnder: '#ACB5C3',
        caseChamfer: '#FFFFFF',
        hwDeckBody: '#CFD5DF',
        hwDeckPanel: '#E0E5ED',
        hwDeckRim: '#FFFFFF',
        artisanMetal: '#D3D9E3',
        artisanRim: '#FFFFFF',
        statusLedOn: '#2563EB',
        backWeightBody: '#D1D9E6',
        backWeightRim: '#FFFFFF',
        waistGroove: '#EBF0F7',
        footPad: '#8F9AA9',
        innerWall: '#A6AFBE',
        plate: '#AEB7C4',
        stealthCap: '#C6CDD7',
        stealthLegend: '#2F3847',
        stealthModCap: '#BEC6D1',
        stealthModLegend: '#2F3847',
        stealthAlphaCap: '#D4DAE3',
        stealthAlphaLegend: '#2A3342',
        availRestCap: '#FAFBFD',
        availRestLegend: '#111620',
        auxRestCap: '#D6DCE5',
        auxRestLegend: '#171E2B',
        deckFrame: '#C2C9D4',
        deckStep: '#B0B8C5',
        deckLip: '#E0E5EE',
        deckGlassBg: '#F4F7FC',
        deckGlassTint: [0.950, 0.968, 0.992],
        deckSub: '#475569',
        deckMuted: '#64748B',
        rimTint: [0.95, 0.97, 1.00],
        defaultRimTone: 'mono',
        shadowAlpha: 0.24,
      },
      'alabaster-light': {
        /* Warm silver-alabaster bead-blasted anodized aluminum + polished silver 45-deg chamfer + light mist PBT blind keys + warm ceramic available keys */
        caseBody: '#E2E0DA',
        caseStep: '#D1CEC6',
        caseSide: '#C5C2B9',
        caseUnder: '#B5B1A7',
        caseChamfer: '#FFFFFF',
        hwDeckBody: '#D5D2CA',
        hwDeckPanel: '#E6E4DD',
        hwDeckRim: '#FFFFFF',
        artisanMetal: '#D8D5CD',
        artisanRim: '#FFFFFF',
        statusLedOn: '#2563EB',
        backWeightBody: '#D7D3C9',
        backWeightRim: '#FFFFFF',
        waistGroove: '#EFEDE6',
        footPad: '#99948B',
        innerWall: '#ABA89F',
        plate: '#B4B1A8',
        stealthCap: '#C8C6BF',
        stealthLegend: '#2F3238',
        stealthModCap: '#C0BEB6',
        stealthModLegend: '#2F3238',
        stealthAlphaCap: '#D7D5CE',
        stealthAlphaLegend: '#292C32',
        availRestCap: '#FCFBF8',
        availRestLegend: '#12151B',
        auxRestCap: '#D8D6CF',
        auxRestLegend: '#191C22',
        deckFrame: '#C8C5BC',
        deckStep: '#B6B3A9',
        deckLip: '#E5E3DC',
        deckGlassBg: '#F8F6F2',
        deckGlassTint: [0.972, 0.962, 0.942],
        deckSub: '#57534E',
        deckMuted: '#78716C',
        rimTint: [0.98, 0.97, 0.95],
        defaultRimTone: 'mono',
        shadowAlpha: 0.24,
      },
    };

    /* V14 Google DeepMind four-element spectrum: translucent frosted gemstone keycaps + clear smoked/iced levitated cap + dual-tone crystal stem */
    var ARTISAN_BY_Z = {
      1: {
        restDarkCap: '#134763',
        restDarkLegend: '#F4FBFF',
        restLightCap: '#92E1FA',
        restLightLegend: '#072436',
        cap: '#203647',
        lightHeroCap: '#B6ECFD',
        legend: '#F7FDFF',
        lightHeroLegend: '#071E2E',
        stem: '#0284C7',
        stemTop: '#BAE6FD',
        led: '#38BDF8',
      }, /* 1 H  - Clear azure ice-blue */
      6: {
        restDarkCap: '#1E469E',
        restDarkLegend: '#F6FAFF',
        restLightCap: '#82ADFA',
        restLightLegend: '#081838',
        cap: '#1C2434',
        lightHeroCap: '#B4CEFC',
        legend: '#FAFCFF',
        lightHeroLegend: '#081634',
        stem: '#1D4ED8',
        stemTop: '#67E8F9',
        led: '#3B82F6',
      }, /* 6 C  - Google royal cobalt x faceted ice-cyan iridescent prism */
      10: {
        restDarkCap: '#962E1E',
        restDarkLegend: '#FFF8F5',
        restLightCap: '#FBA080',
        restLightLegend: '#2B0C05',
        cap: '#3E1F1A',
        lightHeroCap: '#FEC4AE',
        legend: '#FFF8F5',
        lightHeroLegend: '#260B05',
        stem: '#F04424',
        stemTop: '#FFC247',
        led: '#FF7849',
      }, /* 10 Ne - Pure coral red-orange -> liquid warm gold */
      18: {
        restDarkCap: '#2E1C76',
        restDarkLegend: '#F7F5FF',
        restLightCap: '#B29DFC',
        restLightLegend: '#180B38',
        cap: '#261E46',
        lightHeroCap: '#CAC0FE',
        legend: '#F8F6FF',
        lightHeroLegend: '#160A33',
        stem: '#3749E8',
        stemTop: '#C084FC',
        led: '#7C5CFF',
      }, /* 18 Ar - Electric indigo-violet x royal sapphire glass */
    };

    /* Desaturated industrial mineral/metal tones for remaining groups */
    var GROUP_ARTISAN_FALLBACK = {
      alkali: { cap: '#6E3F34', legend: '#FFF8F6', stem: '#C98A72', led: '#E2AC96' },
      alkaline: { cap: '#685132', legend: '#FFFBF5', stem: '#C9A46E', led: '#E2C496' },
      transition: { cap: '#39546B', legend: '#F6FAFD', stem: '#94BCD8', led: '#BAD8EE' },
      'post-transition': { cap: '#3A4654', legend: '#F5F8FC', stem: '#B4C4D4', led: '#D4E0EC' },
      metalloid: { cap: '#3A4C58', legend: '#F6FCFD', stem: '#A8C4D4', led: '#CCE0EC' },
      nonmetal: { cap: '#283654', legend: '#F8FAFC', stem: '#3B82F6', led: '#67E8F9' },
      halogen: { cap: '#4E3F64', legend: '#FBF8FF', stem: '#B49ED4', led: '#D4C4EC' },
      noble: { cap: '#382B78', legend: '#F7F8FD', stem: '#6366F1', led: '#A78BFA' },
      lanthanoid: { cap: '#5E3E4B', legend: '#FFF7F9', stem: '#C494A6', led: '#E0B8C6' },
      actinoid: { cap: '#543C4E', legend: '#FFF7FB', stem: '#B894AE', led: '#D8B8CE' },
    };

    /* V14 right-side 2x3 AUX-06 brand spectrum 6-slot contract (#0 ORCH nebula violet-gold anodized metal + brand LED slot & translucent skirt) */
    var DEFAULT_AUX_MODELS = [
      {
        slotIndex: 0,
        id: 'orchestrator',
        shortLabel: 'ORCH',
        subLabel: 'DUAL',
        badgeCode: 'OR',
        accentHex: '#7C5CFF',
        secondaryHex: '#F0B85A',
        available: true,
      },
      {
        slotIndex: 1,
        id: 'flash',
        shortLabel: 'Flash',
        subLabel: 'FAST',
        badgeCode: 'FL',
        accentHex: '#00D4FF',
        secondaryHex: '#67E8F9',
        available: true,
      },
      {
        slotIndex: 2,
        id: 'claude-opus',
        shortLabel: 'Opus',
        subLabel: 'CLD',
        badgeCode: 'OP',
        accentHex: '#E07A48',
        secondaryHex: '#F6B27A',
        available: true,
      },
      {
        slotIndex: 3,
        id: 'claude-sonnet',
        shortLabel: 'Sonnet',
        subLabel: 'CLD',
        badgeCode: 'SN',
        accentHex: '#D97742',
        secondaryHex: '#F4B872',
        available: true,
      },
      {
        slotIndex: 4,
        id: 'gpt-oss',
        shortLabel: 'GPT',
        subLabel: 'OSS',
        badgeCode: 'GP',
        accentHex: '#4FD1C5',
        secondaryHex: '#99F6E4',
        available: true,
      },
      {
        slotIndex: 5,
        id: 'blind',
        shortLabel: '—',
        subLabel: '',
        badgeCode: '06',
        accentHex: '#475569',
        secondaryHex: '#64748B',
        available: false,
      },
    ];

    function normalizeAuxModels(rawList) {
      var result = new Array(AUX_SLOT_COUNT);
      for (var d = 0; d < AUX_SLOT_COUNT; d++) {
        var def = DEFAULT_AUX_MODELS[d];
        result[d] = {
          slotIndex: d,
          id: def.id,
          shortLabel: def.shortLabel,
          subLabel: def.subLabel,
          badgeCode: def.badgeCode,
          accentHex: def.accentHex,
          secondaryHex: def.secondaryHex,
          available: def.available,
        };
      }
      if (!Array.isArray(rawList)) return result;

      /* Unpopulated slots in an explicitly supplied auxModels array degrade cleanly to dark-etched metal blind keys */
      for (var k = 0; k < AUX_SLOT_COUNT; k++) {
        result[k] = {
          slotIndex: k,
          id: 'blind-' + k,
          shortLabel: '—',
          subLabel: '',
          badgeCode: '0' + (k + 1),
          accentHex: '#475569',
          secondaryHex: '#64748B',
          available: false,
        };
      }
      for (var i = 0; i < rawList.length && i < 12; i++) {
        var item = rawList[i];
        if (!item || typeof item !== 'object') continue;
        var idx = Number.isFinite(Number(item.slotIndex))
          ? clamp(Math.round(Number(item.slotIndex)), 0, AUX_SLOT_COUNT - 1)
          : (i < AUX_SLOT_COUNT ? i : -1);
        if (idx < 0 || idx >= AUX_SLOT_COUNT) continue;
        var defRef = DEFAULT_AUX_MODELS[idx] || DEFAULT_AUX_MODELS[0];
        var idStr = String(item.id || defRef.id || ('aux-' + idx)).trim();
        var isOrch = idx === 0 && /orch/i.test(idStr + ' ' + String(item.shortLabel || ''));
        var avail = item.available !== undefined ? Boolean(item.available) : true;
        var isPureBlind = /^blind(?:-\d+)?$/i.test(idStr);
        result[idx] = {
          slotIndex: idx,
          id: idStr,
          shortLabel: String(item.shortLabel !== undefined ? item.shortLabel : (isPureBlind ? '—' : defRef.shortLabel)).trim(),
          subLabel: String(item.subLabel !== undefined ? item.subLabel : (isPureBlind ? '' : defRef.subLabel)).trim(),
          badgeCode: String(item.badgeCode !== undefined ? item.badgeCode : (isOrch ? 'OR' : defRef.badgeCode)).trim(),
          accentHex: String(item.accentHex || (isOrch ? '#7C4DFF' : defRef.accentHex)).trim(),
          secondaryHex: String(item.secondaryHex || (isOrch ? '#F59E0B' : defRef.secondaryHex)).trim(),
          available: avail,
        };
      }
      return result;
    }

    /* ============================================================================
     * 3. Ground-State Electron Configuration Generator (Covers Z = 1..103 Including Hund Half/Full-Shell Exceptions)
     * ============================================================================ */
    var SUPERSCRIPT_DIGITS = ['⁰', '¹', '²', '³', '⁴', '⁵', '⁶', '⁷', '⁸', '⁹'];
    var SUBSHELL_SEQUENCE = [
      ['1s', 2], ['2s', 2], ['2p', 6], ['3s', 2], ['3p', 6],
      ['4s', 2], ['3d', 10], ['4p', 6], ['5s', 2], ['4d', 10],
      ['5p', 6], ['6s', 2], ['4f', 14], ['5d', 10], ['6p', 6],
      ['7s', 2], ['5f', 14], ['6d', 10], ['7p', 6],
    ];
    var SHELL_SPECTRO_ORDER = { s: 0, f: 1, d: 2, p: 3 };
    var ELECTRON_ANOMALIES = {
      24: '[Ar] 3d⁵ 4s¹',
      29: '[Ar] 3d¹⁰ 4s¹',
      41: '[Kr] 4d⁴ 5s¹',
      42: '[Kr] 4d⁵ 5s¹',
      44: '[Kr] 4d⁷ 5s¹',
      45: '[Kr] 4d⁸ 5s¹',
      46: '[Kr] 4d¹⁰',
      47: '[Kr] 4d¹⁰ 5s¹',
      57: '[Xe] 5d¹ 6s²',
      58: '[Xe] 4f¹ 5d¹ 6s²',
      64: '[Xe] 4f⁷ 5d¹ 6s²',
      78: '[Xe] 4f¹⁴ 5d⁹ 6s¹',
      79: '[Xe] 4f¹⁴ 5d¹⁰ 6s¹',
      89: '[Rn] 6d¹ 7s²',
      90: '[Rn] 6d² 7s²',
      91: '[Rn] 5f² 6d¹ 7s²',
      92: '[Rn] 5f³ 6d¹ 7s²',
      93: '[Rn] 5f⁴ 6d¹ 7s²',
      96: '[Rn] 5f⁷ 6d¹ 7s²',
    };

    function toSuperscript(num) {
      var s = String(Math.max(0, Math.floor(num)));
      var out = '';
      for (var i = 0; i < s.length; i++) {
        var code = s.charCodeAt(i) - 48;
        out += code >= 0 && code <= 9 ? SUPERSCRIPT_DIGITS[code] : s[i];
      }
      return out;
    }

    function formatElectronConfiguration(z, numLabel) {
      var nl = String(numLabel || '');
      if (nl === '57-71' || nl === '57–71') return '[Xe] 4f¹⁻¹⁴ 5d⁰⁻¹ 6s²';
      if (nl === '89-103' || nl === '89–103') return '[Rn] 5f⁰⁻¹⁴ 6d⁰⁻² 7s²';
      var zInt = Math.max(1, Math.min(118, Math.round(Number(z) || 6)));
      if (ELECTRON_ANOMALIES[zInt]) return ELECTRON_ANOMALIES[zInt];

      var cores = [
        { z: 86, tag: '[Rn]', skip: 15 },
        { z: 54, tag: '[Xe]', skip: 11 },
        { z: 36, tag: '[Kr]', skip: 8 },
        { z: 18, tag: '[Ar]', skip: 5 },
        { z: 10, tag: '[Ne]', skip: 3 },
        { z: 2, tag: '[He]', skip: 1 },
      ];
      var core = null;
      for (var ci = 0; ci < cores.length; ci++) {
        if (zInt > cores[ci].z) {
          core = cores[ci];
          break;
        }
      }

      var rem = zInt - (core ? core.z : 0);
      var startIdx = core ? core.skip : 0;
      var terms = [];
      for (var si = startIdx; si < SUBSHELL_SEQUENCE.length && rem > 0; si++) {
        var sub = SUBSHELL_SEQUENCE[si];
        var take = Math.min(rem, sub[1]);
        rem -= take;
        terms.push({
          orb: sub[0],
          n: parseInt(sub[0][0], 10),
          lOrder: SHELL_SPECTRO_ORDER[sub[0][1]] || 0,
          count: take,
        });
      }
      terms.sort(function (a, b) {
        return a.n !== b.n ? a.n - b.n : a.lOrder - b.lOrder;
      });
      var parts = core ? [core.tag] : [];
      for (var ti = 0; ti < terms.length; ti++) {
        parts.push(terms[ti].orb + toSuperscript(terms[ti].count));
      }
      return parts.join(' ');
    }

    /* ============================================================================
     * 4. Zero-Allocation 4x4 Matrix & 3D Ray-Intersection Utilities (Column-Major)
     * ============================================================================ */
    function clamp(v, lo, hi) {
      return v < lo ? lo : v > hi ? hi : v;
    }

    /* Zero-GC hex color read-only cache (capped at 256 entries) eliminating per-frame regex parsing and RGB array allocations */
    var _hexRgbCache = new Map();
    var _HEX_FALLBACK_RGB = [0.23, 0.60, 0.88];
    function hexToRgb01(hex, fallback) {
      var s = String(hex || '').trim();
      var cached = _hexRgbCache.get(s);
      if (cached !== undefined) {
        return cached || fallback || _HEX_FALLBACK_RGB;
      }
      var rgb = null;
      var m3 = /^#([0-9a-f]{3})$/i.exec(s);
      if (m3) {
        var h3 = m3[1];
        rgb = [
          parseInt(h3[0] + h3[0], 16) / 255,
          parseInt(h3[1] + h3[1], 16) / 255,
          parseInt(h3[2] + h3[2], 16) / 255,
        ];
      } else {
        var m6 = /^#([0-9a-f]{6})$/i.exec(s);
        if (m6) {
          var n = parseInt(m6[1], 16);
          rgb = [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
        }
      }
      if (_hexRgbCache.size < 256) {
        _hexRgbCache.set(s, rgb);
      }
      return rgb || fallback || _HEX_FALLBACK_RGB;
    }

    function rgb01ToCss(rgb, alpha) {
      var r = Math.round(clamp(rgb[0], 0, 1) * 255);
      var g = Math.round(clamp(rgb[1], 0, 1) * 255);
      var b = Math.round(clamp(rgb[2], 0, 1) * 255);
      if (alpha !== undefined && alpha < 1) {
        return 'rgba(' + r + ',' + g + ',' + b + ',' + alpha.toFixed(3) + ')';
      }
      return 'rgb(' + r + ',' + g + ',' + b + ')';
    }

    function shadeRgb(rgb, mul, add) {
      var a = add || 0;
      return [
        clamp(rgb[0] * mul + a, 0, 1),
        clamp(rgb[1] * mul + a, 0, 1),
        clamp(rgb[2] * mul + a, 0, 1),
      ];
    }

    function mixRgb(a, b, t) {
      var k = clamp(t, 0, 1);
      return [
        a[0] + (b[0] - a[0]) * k,
        a[1] + (b[1] - a[1]) * k,
        a[2] + (b[2] - a[2]) * k,
      ];
    }

    function relativeLuminance(rgb) {
      return 0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2];
    }

    function mat4Identity(out) {
      var m = out || new Float32Array(16);
      m.fill(0);
      m[0] = 1;
      m[5] = 1;
      m[10] = 1;
      m[15] = 1;
      return m;
    }

    function mat4Multiply(out, a, b) {
      var a00 = a[0], a01 = a[1], a02 = a[2], a03 = a[3];
      var a10 = a[4], a11 = a[5], a12 = a[6], a13 = a[7];
      var a20 = a[8], a21 = a[9], a22 = a[10], a23 = a[11];
      var a30 = a[12], a31 = a[13], a32 = a[14], a33 = a[15];
      for (var c = 0; c < 4; c++) {
        var idx = c * 4;
        var b0 = b[idx], b1 = b[idx + 1], b2 = b[idx + 2], b3 = b[idx + 3];
        out[idx] = b0 * a00 + b1 * a10 + b2 * a20 + b3 * a30;
        out[idx + 1] = b0 * a01 + b1 * a11 + b2 * a21 + b3 * a31;
        out[idx + 2] = b0 * a02 + b1 * a12 + b2 * a22 + b3 * a32;
        out[idx + 3] = b0 * a03 + b1 * a13 + b2 * a23 + b3 * a33;
      }
      return out;
    }

    function mat4Perspective(out, fovy, aspect, near, far) {
      var f = 1.0 / Math.tan(fovy * 0.5);
      var nf = 1.0 / (near - far);
      out.fill(0);
      out[0] = f / aspect;
      out[5] = f;
      out[10] = (far + near) * nf;
      out[11] = -1;
      out[14] = 2 * far * near * nf;
      return out;
    }

    function mat4Ortho(out, left, right, bottom, top, near, far) {
      var lr = 1.0 / (left - right);
      var bt = 1.0 / (bottom - top);
      var nf = 1.0 / (near - far);
      out.fill(0);
      out[0] = -2.0 * lr;
      out[5] = -2.0 * bt;
      out[10] = 2.0 * nf;
      out[12] = (left + right) * lr;
      out[13] = (top + bottom) * bt;
      out[14] = (far + near) * nf;
      out[15] = 1.0;
      return out;
    }

    function mat4LookAt(out, eye, center, up) {
      var zx = eye[0] - center[0];
      var zy = eye[1] - center[1];
      var zz = eye[2] - center[2];
      var len = Math.hypot(zx, zy, zz) || 1;
      zx /= len; zy /= len; zz /= len;

      var xx = up[1] * zz - up[2] * zy;
      var xy = up[2] * zx - up[0] * zz;
      var xz = up[0] * zy - up[1] * zx;
      len = Math.hypot(xx, xy, xz) || 1;
      xx /= len; xy /= len; xz /= len;

      var yx = zy * xz - zz * xy;
      var yy = zz * xx - zx * xz;
      var yz = zx * xy - zy * xx;

      out[0] = xx; out[1] = yx; out[2] = zx; out[3] = 0;
      out[4] = xy; out[5] = yy; out[6] = zy; out[7] = 0;
      out[8] = xz; out[9] = yz; out[10] = zz; out[11] = 0;
      out[12] = -(xx * eye[0] + xy * eye[1] + xz * eye[2]);
      out[13] = -(yx * eye[0] + yy * eye[1] + yz * eye[2]);
      out[14] = -(zx * eye[0] + zy * eye[1] + zz * eye[2]);
      out[15] = 1;
      return out;
    }

    function mat4FromTRS(out, tx, ty, tz, pitchX, yawY, rollZ, sx, sy, sz) {
      var cx = Math.cos(pitchX), sxr = Math.sin(pitchX);
      var cy = Math.cos(yawY), syr = Math.sin(yawY);
      var cz = Math.cos(rollZ), szr = Math.sin(rollZ);
      var scx = sx === undefined ? 1 : sx;
      var scy = sy === undefined ? 1 : sy;
      var scz = sz === undefined ? 1 : sz;

      var r00 = cy * cz + syr * sxr * szr;
      var r01 = cx * szr;
      var r02 = -syr * cz + cy * sxr * szr;

      var r10 = -cy * szr + syr * sxr * cz;
      var r11 = cx * cz;
      var r12 = syr * szr + cy * sxr * cz;

      var r20 = syr * cx;
      var r21 = -sxr;
      var r22 = cy * cx;

      out[0] = r00 * scx; out[1] = r01 * scx; out[2] = r02 * scx; out[3] = 0;
      out[4] = r10 * scy; out[5] = r11 * scy; out[6] = r12 * scy; out[7] = 0;
      out[8] = r20 * scz; out[9] = r21 * scz; out[10] = r22 * scz; out[11] = 0;
      out[12] = tx; out[13] = ty; out[14] = tz; out[15] = 1;
      return out;
    }

    function mat4Invert(out, m) {
      var a00 = m[0], a01 = m[1], a02 = m[2], a03 = m[3];
      var a10 = m[4], a11 = m[5], a12 = m[6], a13 = m[7];
      var a20 = m[8], a21 = m[9], a22 = m[10], a23 = m[11];
      var a30 = m[12], a31 = m[13], a32 = m[14], a33 = m[15];

      var b00 = a00 * a11 - a01 * a10;
      var b01 = a00 * a12 - a02 * a10;
      var b02 = a00 * a13 - a03 * a10;
      var b03 = a01 * a12 - a02 * a11;
      var b04 = a01 * a13 - a03 * a11;
      var b05 = a02 * a13 - a03 * a12;
      var b06 = a20 * a31 - a21 * a30;
      var b07 = a20 * a32 - a22 * a30;
      var b08 = a20 * a33 - a23 * a30;
      var b09 = a21 * a32 - a22 * a31;
      var b10 = a21 * a33 - a23 * a31;
      var b11 = a22 * a33 - a23 * a32;

      var det = b00 * b11 - b01 * b10 + b02 * b09 + b03 * b08 - b04 * b07 + b05 * b06;
      if (!det || Math.abs(det) < 1e-11) return null;
      det = 1.0 / det;

      out[0] = (a11 * b11 - a12 * b10 + a13 * b09) * det;
      out[1] = (a02 * b10 - a01 * b11 - a03 * b09) * det;
      out[2] = (a31 * b05 - a32 * b04 + a33 * b03) * det;
      out[3] = (a22 * b04 - a21 * b05 - a23 * b03) * det;
      out[4] = (a12 * b08 - a10 * b11 - a13 * b07) * det;
      out[5] = (a00 * b11 - a02 * b08 + a03 * b07) * det;
      out[6] = (a32 * b02 - a30 * b05 - a33 * b01) * det;
      out[7] = (a20 * b05 - a22 * b02 + a23 * b01) * det;
      out[8] = (a10 * b10 - a11 * b08 + a13 * b06) * det;
      out[9] = (a01 * b08 - a00 * b10 - a03 * b06) * det;
      out[10] = (a30 * b04 - a31 * b02 + a33 * b00) * det;
      out[11] = (a21 * b02 - a20 * b04 - a23 * b00) * det;
      out[12] = (a11 * b07 - a10 * b09 - a12 * b06) * det;
      out[13] = (a00 * b09 - a01 * b07 + a02 * b06) * det;
      out[14] = (a31 * b01 - a30 * b03 - a32 * b00) * det;
      out[15] = (a20 * b03 - a21 * b01 + a22 * b00) * det;
      return out;
    }

    /* Supports optional pre-allocated Float32Array out parameter for zero-GC writes while staying backward-compatible */
    function transformPoint4(m, x, y, z, w, out) {
      var ww = w === undefined ? 1.0 : w;
      var dst = out || [0, 0, 0, 0];
      dst[0] = m[0] * x + m[4] * y + m[8] * z + m[12] * ww;
      dst[1] = m[1] * x + m[5] * y + m[9] * z + m[13] * ww;
      dst[2] = m[2] * x + m[6] * y + m[10] * z + m[14] * ww;
      dst[3] = m[3] * x + m[7] * y + m[11] * z + m[15] * ww;
      return dst;
    }

    function transformDir3(m, dx, dy, dz, out) {
      var rx = m[0] * dx + m[4] * dy + m[8] * dz;
      var ry = m[1] * dx + m[5] * dy + m[9] * dz;
      var rz = m[2] * dx + m[6] * dy + m[10] * dz;
      var len = Math.hypot(rx, ry, rz) || 1;
      var dst = out || [0, 0, 0];
      dst[0] = rx / len;
      dst[1] = ry / len;
      dst[2] = rz / len;
      return dst;
    }

    function intersectRayAABB(ox, oy, oz, dx, dy, dz, minX, minY, minZ, maxX, maxY, maxZ) {
      var tmin = -Infinity;
      var tmax = Infinity;
      var invD, t1, t2, tmp;

      if (Math.abs(dx) < 1e-8) {
        if (ox < minX || ox > maxX) return -1;
      } else {
        invD = 1.0 / dx;
        t1 = (minX - ox) * invD;
        t2 = (maxX - ox) * invD;
        if (t1 > t2) { tmp = t1; t1 = t2; t2 = tmp; }
        if (t1 > tmin) tmin = t1;
        if (t2 < tmax) tmax = t2;
        if (tmin > tmax) return -1;
      }

      if (Math.abs(dy) < 1e-8) {
        if (oy < minY || oy > maxY) return -1;
      } else {
        invD = 1.0 / dy;
        t1 = (minY - oy) * invD;
        t2 = (maxY - oy) * invD;
        if (t1 > t2) { tmp = t1; t1 = t2; t2 = tmp; }
        if (t1 > tmin) tmin = t1;
        if (t2 < tmax) tmax = t2;
        if (tmin > tmax) return -1;
      }

      if (Math.abs(dz) < 1e-8) {
        if (oz < minZ || oz > maxZ) return -1;
      } else {
        invD = 1.0 / dz;
        t1 = (minZ - oz) * invD;
        t2 = (maxZ - oz) * invD;
        if (t1 > t2) { tmp = t1; t1 = t2; t2 = tmp; }
        if (t1 > tmin) tmin = t1;
        if (t2 < tmax) tmax = t2;
        if (tmin > tmax) return -1;
      }

      if (tmax < 0) return -1;
      return tmin >= 0 ? tmin : tmax;
    }

    function sdRoundedBox2D(px, pz, halfW, halfD, r) {
      var qx = Math.abs(px) - halfW + r;
      var qz = Math.abs(pz) - halfD + r;
      var outLen = Math.hypot(Math.max(qx, 0), Math.max(qz, 0));
      var inLen = Math.min(Math.max(qx, qz), 0);
      return outLen + inLen - r;
    }

    /* ============================================================================
     * 5. Procedural G2 CNC Minimal Screwless Chassis & R1-R4 Sculpted Keycap Mesh Builders (CCW Normals)
     * ============================================================================ */
    function sampleG2RectLoop(x0, z0, x1, z1, radius, cornerSegs, superExp) {
      var cx = (x0 + x1) * 0.5;
      var cz = (z0 + z1) * 0.5;
      var hw = (x1 - x0) * 0.5;
      var hd = (z1 - z0) * 0.5;
      var r = Math.min(Math.max(0.005, radius), hw * 0.94, hd * 0.94);
      var ix = hw - r;
      var iz = hd - r;
      var pExp = superExp || 2.28;
      var invP = 2.0 / pExp;

      var quads = [
        { ox: ix, oz: iz, sx: 1, sz: 1, flip: false },
        { ox: -ix, oz: iz, sx: -1, sz: 1, flip: true },
        { ox: -ix, oz: -iz, sx: -1, sz: -1, flip: false },
        { ox: ix, oz: -iz, sx: 1, sz: -1, flip: true },
      ];

      var pts = [];
      for (var q = 0; q < 4; q++) {
        var qd = quads[q];
        for (var s = 0; s < cornerSegs; s++) {
          var t = cornerSegs > 1 ? s / (cornerSegs - 1) : 0.5;
          var u = 0.022 + t * 0.956;
          var ang = (qd.flip ? 1.0 - u : u) * (Math.PI * 0.5);
          var ca = Math.cos(ang);
          var sa = Math.sin(ang);
          var g2c = Math.pow(Math.max(1e-6, ca), invP);
          var g2s = Math.pow(Math.max(1e-6, sa), invP);
          var nxRaw = qd.sx * Math.pow(Math.max(1e-6, ca), 2.0 - invP);
          var nzRaw = qd.sz * Math.pow(Math.max(1e-6, sa), 2.0 - invP);
          var nLen = Math.hypot(nxRaw, nzRaw) || 1;
          pts.push({
            x: cx + qd.ox + qd.sx * r * g2c,
            z: cz + qd.oz + qd.sz * r * g2s,
            nx: nxRaw / nLen,
            nz: nzRaw / nLen,
          });
        }
      }
      return pts;
    }

    function createMeshBuilder() {
      var positions = [];
      var normals = [];
      var colors = [];
      var params = []; /* [roughness, metallic, emissive, matKind] */
      var uvs = [];    /* [chamferRimMask (0..1), edgeTangentPhase (0..1)] */
      var indices = [];

      function pushVertex(px, py, pz, nx, ny, nz, r, g, b, rough, metal, emis, kind, u, v) {
        var idx = positions.length / 3;
        positions.push(px, py, pz);
        var nlen = Math.hypot(nx, ny, nz) || 1;
        normals.push(nx / nlen, ny / nlen, nz / nlen);
        colors.push(r, g, b);
        params.push(rough, metal, emis, kind || 0);
        uvs.push(u || 0, v || 0);
        return idx;
      }

      /* Dedicated to GPU vertex-shader radial offset for flux rings (kind=7.0) and bokeh radius (kind=8.0): DO NOT normalize a_normal! */
      function pushVertexRawNormal(px, py, pz, nx, ny, nz, r, g, b, rough, metal, emis, kind, u, v) {
        var idx = positions.length / 3;
        positions.push(px, py, pz);
        normals.push(nx, ny, nz);
        colors.push(r, g, b);
        params.push(rough, metal, emis, kind || 0);
        uvs.push(u || 0, v || 0);
        return idx;
      }

      function addQuad(p0, p1, p2, p3, n, col, mat, uv0, uv1, uv2, uv3) {
        var nx = n[0], ny = n[1], nz = n[2];
        if (nx === 0 && ny === 0 && nz === 0) {
          var ux = p1[0] - p0[0], uy = p1[1] - p0[1], uz = p1[2] - p0[2];
          var vx = p3[0] - p0[0], vy = p3[1] - p0[1], vz = p3[2] - p0[2];
          nx = uy * vz - uz * vy;
          ny = uz * vx - ux * vz;
          nz = ux * vy - uy * vx;
        }
        var i0 = pushVertex(
          p0[0], p0[1], p0[2], nx, ny, nz,
          col[0], col[1], col[2], mat[0], mat[1], mat[2], mat[3],
          uv0 ? uv0[0] : 0, uv0 ? uv0[1] : 0
        );
        var i1 = pushVertex(
          p1[0], p1[1], p1[2], nx, ny, nz,
          col[0], col[1], col[2], mat[0], mat[1], mat[2], mat[3],
          uv1 ? uv1[0] : 0, uv1 ? uv1[1] : 0
        );
        var i2 = pushVertex(
          p2[0], p2[1], p2[2], nx, ny, nz,
          col[0], col[1], col[2], mat[0], mat[1], mat[2], mat[3],
          uv2 ? uv2[0] : 0, uv2 ? uv2[1] : 0
        );
        var i3 = pushVertex(
          p3[0], p3[1], p3[2], nx, ny, nz,
          col[0], col[1], col[2], mat[0], mat[1], mat[2], mat[3],
          uv3 ? uv3[0] : 0, uv3 ? uv3[1] : 0
        );
        indices.push(i0, i1, i2, i0, i2, i3);
      }

      function addBox(x0, y0, z0, x1, y1, z1, colTop, colSide, matTop, matSide, skipBottom) {
        var cSide = colSide || colTop;
        var mSide = matSide || matTop;
        addQuad([x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [x0, y1, z0], [0, 1, 0], colTop, matTop);
        if (!skipBottom) {
          addQuad([x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1], [0, -1, 0], cSide, mSide);
        }
        addQuad([x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1], [0, 0, 1], cSide, mSide);
        addQuad([x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0], [0, 0, -1], cSide, mSide);
        addQuad([x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1], [1, 0, 0], cSide, mSide);
        addQuad([x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0], [-1, 0, 0], cSide, mSide);
      }

      function addChamferedBlock(x0, y0, z0, x1, y1, z1, bevel, colTop, colChamfer, colSide, matBody, matChamfer, skipBottom) {
        var bx0 = x0 + bevel, bx1 = x1 - bevel;
        var bz0 = z0 + bevel, bz1 = z1 - bevel;
        var yb = y1 - bevel * 0.85;
        addQuad([bx0, y1, bz1], [bx1, y1, bz1], [bx1, y1, bz0], [bx0, y1, bz0], [0, 1, 0], colTop, matBody);
        addQuad([x0, yb, z1], [x1, yb, z1], [bx1, y1, bz1], [bx0, y1, bz1], [0, 0.72, 0.70], colChamfer, matChamfer);
        addQuad([x1, yb, z0], [x0, yb, z0], [bx0, y1, bz0], [bx1, y1, bz0], [0, 0.72, -0.70], colChamfer, matChamfer);
        addQuad([x1, yb, z1], [x1, yb, z0], [bx1, y1, bz0], [bx1, y1, bz1], [0.70, 0.72, 0], colChamfer, matChamfer);
        addQuad([x0, yb, z0], [x0, yb, z1], [bx0, y1, bz1], [bx0, y1, bz0], [-0.70, 0.72, 0], colChamfer, matChamfer);
        addQuad([x0, y0, z1], [x1, y0, z1], [x1, yb, z1], [x0, yb, z1], [0, 0, 1], colSide, matBody);
        addQuad([x1, y0, z0], [x0, y0, z0], [x0, yb, z0], [x1, yb, z0], [0, 0, -1], colSide, matBody);
        addQuad([x1, y0, z1], [x1, y0, z0], [x1, yb, z0], [x1, yb, z1], [1, 0, 0], colSide, matBody);
        addQuad([x0, y0, z0], [x0, y0, z1], [x0, yb, z1], [x0, yb, z0], [-1, 0, 0], colSide, matBody);
        if (!skipBottom) {
          addQuad([x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1], [0, -1, 0], colSide, matBody);
        }
      }

      function addLoopWallStrip(loopLow, yLow, loopHigh, yHigh, nyVal, col, mat, inward, rimMask) {
        var n = loopLow.length;
        var radialSign = inward ? -1.0 : 1.0;
        var rm = rimMask || 0;
        var baseLow = positions.length / 3;
        for (var i = 0; i < n; i++) {
          var pl = loopLow[i];
          var yl = typeof yLow === 'function' ? yLow(pl) : yLow;
          pushVertex(
            pl.x, yl, pl.z,
            pl.nx * radialSign, nyVal, pl.nz * radialSign,
            col[0], col[1], col[2], mat[0], mat[1], mat[2], mat[3], rm, i / n
          );
        }
        var baseHigh = positions.length / 3;
        for (var j = 0; j < n; j++) {
          var ph = loopHigh[j];
          var yh = typeof yHigh === 'function' ? yHigh(ph) : yHigh;
          pushVertex(
            ph.x, yh, ph.z,
            ph.nx * radialSign, nyVal, ph.nz * radialSign,
            col[0], col[1], col[2], mat[0], mat[1], mat[2], mat[3], rm, j / n
          );
        }
        for (var s = 0; s < n; s++) {
          var s1 = (s + 1) % n;
          var a0 = baseLow + s;
          var a1 = baseLow + s1;
          var b0 = baseHigh + s;
          var b1 = baseHigh + s1;
          if (inward) {
            indices.push(a0, b1, b0, a0, a1, b1);
          } else {
            indices.push(a0, b0, b1, a0, b1, a1);
          }
        }
      }

      /**
       * Smooth continuous chamfer fillet strip (upper/lower rings carry smooth normals, color interpolation & 3D prism chamfer mask [rimLow, rimHigh])
       */
      function addSmoothFilletStrip(loopLow, yLowFn, nyLow, colLow, loopHigh, yHighFn, nyHigh, colHigh, mat, inward, rimLow, rimHigh) {
        var n = loopLow.length;
        var radialSign = inward ? -1.0 : 1.0;
        var rL = rimLow || 0;
        var rH = rimHigh === undefined ? rL : rimHigh;
        var rScaleLow = Math.sqrt(Math.max(0.0, 1.0 - Math.min(0.999, nyLow * nyLow)));
        var rScaleHigh = Math.sqrt(Math.max(0.0, 1.0 - Math.min(0.999, nyHigh * nyHigh)));
        var baseLow = positions.length / 3;
        for (var i = 0; i < n; i++) {
          var pl = loopLow[i];
          var yl = typeof yLowFn === 'function' ? yLowFn(pl) : yLowFn;
          pushVertex(
            pl.x, yl, pl.z,
            pl.nx * radialSign * rScaleLow, nyLow, pl.nz * radialSign * rScaleLow,
            colLow[0], colLow[1], colLow[2], mat[0], mat[1], mat[2], mat[3], rL, i / n
          );
        }
        var baseHigh = positions.length / 3;
        for (var j = 0; j < n; j++) {
          var ph = loopHigh[j];
          var yh = typeof yHighFn === 'function' ? yHighFn(ph) : yHighFn;
          pushVertex(
            ph.x, yh, ph.z,
            ph.nx * radialSign * rScaleHigh, nyHigh, ph.nz * radialSign * rScaleHigh,
            colHigh[0], colHigh[1], colHigh[2], mat[0], mat[1], mat[2], mat[3], rH, j / n
          );
        }
        for (var s = 0; s < n; s++) {
          var s1 = (s + 1) % n;
          var a0 = baseLow + s;
          var a1 = baseLow + s1;
          var b0 = baseHigh + s;
          var b1 = baseHigh + s1;
          if (inward) {
            indices.push(a0, b1, b0, a0, a1, b1);
          } else {
            indices.push(a0, b0, b1, a0, b1, a1);
          }
        }
      }

      function addPlanarAnnulus(outerLoop, yOuter, innerLoop, yInner, col, mat, faceDown) {
        var n = outerLoop.length;
        var ny = faceDown ? -1.0 : 1.0;
        var baseIn = positions.length / 3;
        for (var i = 0; i < n; i++) {
          var pi = innerLoop[i];
          pushVertex(pi.x, yInner, pi.z, 0, ny, 0, col[0], col[1], col[2], mat[0], mat[1], mat[2], mat[3], 0, 0);
        }
        var baseOut = positions.length / 3;
        for (var j = 0; j < n; j++) {
          var po = outerLoop[j];
          pushVertex(po.x, yOuter, po.z, 0, ny, 0, col[0], col[1], col[2], mat[0], mat[1], mat[2], mat[3], 0, 0);
        }
        for (var s = 0; s < n; s++) {
          var s1 = (s + 1) % n;
          var i0 = baseIn + s;
          var i1 = baseIn + s1;
          var o0 = baseOut + s;
          var o1 = baseOut + s1;
          if (faceDown) {
            indices.push(i0, o1, i1, i0, o0, o1);
          } else {
            indices.push(i0, i1, o1, i0, o1, o0);
          }
        }
      }

      function addLoopCap(loop, y, col, mat, faceDown) {
        var n = loop.length;
        var cx = 0, cz = 0;
        for (var k = 0; k < n; k++) {
          cx += loop[k].x;
          cz += loop[k].z;
        }
        cx /= n;
        cz /= n;
        var ny = faceDown ? -1.0 : 1.0;
        var cIdx = pushVertex(cx, y, cz, 0, ny, 0, col[0], col[1], col[2], mat[0], mat[1], mat[2], mat[3], 0, 0);
        var base = positions.length / 3;
        for (var i = 0; i < n; i++) {
          pushVertex(loop[i].x, y, loop[i].z, 0, ny, 0, col[0], col[1], col[2], mat[0], mat[1], mat[2], mat[3], 0, 0);
        }
        for (var s = 0; s < n; s++) {
          var s1 = (s + 1) % n;
          if (faceDown) {
            indices.push(cIdx, base + s, base + s1);
          } else {
            indices.push(cIdx, base + s1, base + s);
          }
        }
      }

      function pushTri(i0, i1, i2) {
        indices.push(i0, i1, i2);
      }

      function getIndexCount() {
        return indices.length;
      }

      function build(extraMeta) {
        var out = {
          positions: new Float32Array(positions),
          normals: new Float32Array(normals),
          colors: new Float32Array(colors),
          params: new Float32Array(params),
          uvs: new Float32Array(uvs),
          indices: new Uint16Array(indices),
          indexCount: indices.length,
        };
        if (extraMeta) {
          var keys = Object.keys(extraMeta);
          for (var ki = 0; ki < keys.length; ki++) {
            var k = keys[ki];
            if (extraMeta[k] !== undefined) out[k] = extraMeta[k];
          }
        }
        return out;
      }

      return {
        pushVertex: pushVertex,
        pushVertexRawNormal: pushVertexRawNormal,
        pushTri: pushTri,
        getIndexCount: getIndexCount,
        addQuad: addQuad,
        addBox: addBox,
        addChamferedBlock: addChamferedBlock,
        addLoopWallStrip: addLoopWallStrip,
        addSmoothFilletStrip: addSmoothFilletStrip,
        addPlanarAnnulus: addPlanarAnnulus,
        addLoopCap: addLoopCap,
        build: build,
      };
    }

    /**
     * Builds V10 GMK / Cherry sculpted keycap template mesh:
     * - Clean 4-face trapezoidal tapered walls (smooth G2 rounded corners R=0.068U) + crisp molded shoulder fillet
     * - Cylindrical scooped fingertip top surface with clean normals (zero artificial bright rim edge)
     * - Detailed macro underside cavity: 0.065U thick outer skirt + doubleshot inner step + 4-way ribs + central [+] cross stem socket
     */
    var _cachedSculptedKeycapGeom = null;
    function buildSculptedKeycapGeometry() {
      if (_cachedSculptedKeycapGeom) return _cachedSculptedKeycapGeom;
      var positions = [];
      var normals = [];
      var uvs = [];
      var partFlags = [];
      var indices = [];

      function emitV(px, py, pz, nx, ny, nz, u, v, flag) {
        var idx = positions.length / 3;
        positions.push(px, py, pz);
        var l = Math.hypot(nx, ny, nz) || 1;
        normals.push(nx / l, ny / l, nz / l);
        uvs.push(u, v);
        partFlags.push(flag);
        return idx;
      }

      function emitCapQuad(p0, p1, p2, p3, nx, ny, nz, flag) {
        var q0 = emitV(p0[0], p0[1], p0[2], nx, ny, nz, 0, 0, flag);
        var q1 = emitV(p1[0], p1[1], p1[2], nx, ny, nz, 0, 0, flag);
        var q2 = emitV(p2[0], p2[1], p2[2], nx, ny, nz, 0, 0, flag);
        var q3 = emitV(p3[0], p3[1], p3[2], nx, ny, nz, 0, 0, flag);
        indices.push(q0, q1, q2, q0, q2, q3);
      }

      function emitCapSubBox(x0, y0, z0, x1, y1, z1, flag, includeBottom, includeTop) {
        if (includeTop) {
          emitCapQuad([x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [x0, y1, z0], 0, 1, 0, flag);
        }
        if (includeBottom) {
          emitCapQuad([x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1], 0, -1, 0, flag);
        }
        emitCapQuad([x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1], 0, 0, 1, flag);
        emitCapQuad([x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0], 0, 0, -1, flag);
        emitCapQuad([x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1], 1, 0, 0, flag);
        emitCapQuad([x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0], -1, 0, 0, flag);
      }

      /* Lightweight crisp tessellation: 6 G2 superellipse segments/corner (24 perimeter) + 10x10 cylindrical top = 440 tris/key (-71.5%) */
      var SEG_CORNER = 6;
      var RING_COUNT = SEG_CORNER * 4;

      function sampleCapRing(halfW, halfD, radius, zShift) {
        return sampleG2RectLoop(-halfW, -halfD + zShift, halfW, halfD + zShift, radius, SEG_CORNER, 2.24);
      }

      /* Classic Cherry horizontal cylindrical fingertip scoop (gentle X concave arc + subtle Z ergonomic curve) */
      function dishHeight(nx, nz) {
        var cylX = Math.max(0.0, 1.0 - nx * nx * 0.96);
        var subtleZ = Math.max(0.0, 1.0 - nz * nz * 0.85);
        return -0.038 * cylX - 0.006 * subtleZ;
      }

      var topHalfW = CAP_TOP_HALF;
      var topHalfD = 0.352;
      var topZShift = -0.013;
      var topCornerR = 0.068;

      /* Clean GMK/Cherry 4-slope tapered walls + narrow rounded shoulder transition rings */
      var profileRings = [
        { hw: CAP_BASE_HALF, hd: CAP_BASE_HALF, r: 0.064, y: 0.000, zS: 0.000, ny: 0.19, flag: 0.0 },
        { hw: 0.414, hd: 0.413, r: 0.067, y: 0.265, zS: -0.006, ny: 0.198, flag: 0.0 },
        { hw: 0.370, hd: 0.367, r: 0.069, y: 0.525, zS: -0.012, ny: 0.22, flag: 0.0 },
        { hw: 0.362, hd: 0.359, r: 0.069, y: 0.556, zS: -0.0128, ny: 0.46, flag: 0.5 },
        { hw: 0.357, hd: 0.354, r: 0.068, y: 0.571, zS: -0.0130, ny: 0.72, flag: 0.5 },
        { hw: topHalfW + 0.0012, hd: topHalfD + 0.0012, r: topCornerR, y: CAP_HEIGHT - 0.0025, zS: topZShift, ny: 0.90, flag: 0.5 },
      ];

      var ringVertStart = [];
      for (var ri = 0; ri < profileRings.length; ri++) {
        var pr = profileRings[ri];
        var pts = sampleCapRing(pr.hw, pr.hd, pr.r, pr.zS);
        var startIdx = positions.length / 3;
        ringVertStart.push(startIdx);
        for (var pi = 0; pi < RING_COUNT; pi++) {
          var p = pts[pi];
          var py = pr.y;
          var rScale = Math.sqrt(Math.max(0.0, 1.0 - Math.min(0.999, pr.ny * pr.ny)));
          var nxOut = p.nx * rScale;
          var nzOut = p.nz * rScale;
          emitV(p.x, py, p.z, nxOut, pr.ny, nzOut, 0.5, 0.5, pr.flag);
        }
      }

      for (var rj = 0; rj < profileRings.length - 1; rj++) {
        var aBase = ringVertStart[rj];
        var bBase = ringVertStart[rj + 1];
        for (var s = 0; s < RING_COUNT; s++) {
          var sNext = (s + 1) % RING_COUNT;
          var i0 = aBase + s;
          var i1 = aBase + sNext;
          var i2 = bBase + sNext;
          var i3 = bBase + s;
          indices.push(i0, i3, i2, i0, i2, i1);
        }
      }

      var DISH_GRID = 10;
      var dishStart = positions.length / 3;

      function clampToRoundedTop(ux, uz) {
        var hwCap = topHalfW + 0.0018;
        var hdCap = topHalfD + 0.0018;
        var x = ux * hwCap;
        var z = uz * hdCap;
        var ix = hwCap - topCornerR;
        var iz = hdCap - topCornerR;
        var dx = Math.max(0, Math.abs(x) - ix);
        var dz = Math.max(0, Math.abs(z) - iz);
        var dist = Math.hypot(dx, dz);
        if (dist > topCornerR && dist > 1e-6) {
          var scale = topCornerR / dist;
          x = Math.sign(x) * (ix + dx * scale);
          z = Math.sign(z) * (iz + dz * scale);
        }
        return [x, z];
      }

      for (var gz = 0; gz <= DISH_GRID; gz++) {
        var vz = gz / DISH_GRID;
        var uz = vz * 2 - 1;
        for (var gx = 0; gx <= DISH_GRID; gx++) {
          var vx = gx / DISH_GRID;
          var ux = vx * 2 - 1;
          var xz = clampToRoundedTop(ux, uz);
          var px = xz[0];
          var pzLocal = xz[1];
          var d = dishHeight(px / topHalfW, pzLocal / topHalfD);
          var edgeZFlatten = smootherstepScalar(0.84, 1.0, Math.abs(uz));
          var edgeXFlatten = smootherstepScalar(0.90, 1.0, Math.abs(ux));
          var rimFlatten = Math.max(edgeXFlatten * 0.55, edgeZFlatten * 0.45);
          var pyTop = CAP_HEIGHT - 0.0022 * rimFlatten + d * (1.0 - rimFlatten * 0.65);

          /* True cylindrical top-face normals cleanly transitioning from the 4 sloped walls */
          var dnx = -(px / topHalfW) * 0.148 * (1.0 - edgeXFlatten * 0.35);
          var dnz = -(pzLocal / topHalfD) * 0.032 * (1.0 - edgeZFlatten * 0.45);
          var u = clamp(0.5 + px / (topHalfW * 2.02), 0.015, 0.985);
          var v = clamp(0.5 + pzLocal / (topHalfD * 2.02), 0.015, 0.985);
          emitV(px, pyTop, pzLocal + topZShift, dnx, 1.0, dnz, u, v, 1.0);
        }
      }

      var stride = DISH_GRID + 1;
      for (var dzIdx = 0; dzIdx < DISH_GRID; dzIdx++) {
        for (var dxIdx = 0; dxIdx < DISH_GRID; dxIdx++) {
          var d0 = dishStart + dzIdx * stride + dxIdx;
          var d1 = d0 + 1;
          var d2 = d0 + stride + 1;
          var d3 = d0 + stride;
          indices.push(d0, d3, d2, d0, d2, d1);
        }
      }

      /* End segment 0: all 96 keycaps draw only the lightweight 440-tri outer shell, culling unseen cavities on resting keys */
      var outerIndexCount = indices.length;

      /* ======================================================================
       * Segment 1 (drawn on demand for the single levitated keycap, reusing keycapVao with zero extra VAOs):
       * 1) 0.065U thick outer skirt bottom rim (hw: 0.460 -> 0.395, y = 0.0)
       * 2) Dual-step inner cavity walls (y = 0.0 -> 0.064 step -> 0.276 ceiling) + 4-way structural ribs
       * 3) Central protruding cylindrical [+] cross stem mount (r = 0.122 with recessed cross socket)
       * ====================================================================== */
      var wallThick = 0.065;
      var outerBotPts = sampleCapRing(CAP_BASE_HALF, CAP_BASE_HALF, 0.064, 0.0);
      var wallBotPts = sampleCapRing(CAP_BASE_HALF - wallThick, CAP_BASE_HALF - wallThick, 0.050, 0.0);
      var stepInPts = sampleCapRing(CAP_BASE_HALF - wallThick - 0.026, CAP_BASE_HALF - wallThick - 0.026, 0.044, 0.0);
      var cavTopPts = sampleCapRing(0.332, 0.332, 0.040, 0.0);
      var stepY = 0.064;
      var cavityDepth = 0.276;

      /* (a) 0.065U thick outer skirt bottom face (downward normal) */
      var botOuterStart = positions.length / 3;
      for (var bi0 = 0; bi0 < RING_COUNT; bi0++) {
        emitV(outerBotPts[bi0].x, 0.0, outerBotPts[bi0].z, 0, -1, 0, 0, 0, 0.18);
      }
      var botWallInStart = positions.length / 3;
      for (var bi1 = 0; bi1 < RING_COUNT; bi1++) {
        emitV(wallBotPts[bi1].x, 0.0, wallBotPts[bi1].z, 0, -1, 0, 0, 0, 0.18);
      }

      /* (b) Lower inner wall opening -> y=0.064 doubleshot inner step */
      var wallStepBotStart = positions.length / 3;
      for (var bi2 = 0; bi2 < RING_COUNT; bi2++) {
        emitV(wallBotPts[bi2].x, 0.0, wallBotPts[bi2].z, -wallBotPts[bi2].nx, -0.22, -wallBotPts[bi2].nz, 0, 0, 0.34);
      }
      var wallStepTopStart = positions.length / 3;
      for (var bi3 = 0; bi3 < RING_COUNT; bi3++) {
        emitV(wallBotPts[bi3].x, stepY, wallBotPts[bi3].z, -wallBotPts[bi3].nx, -0.22, -wallBotPts[bi3].nz, 0, 0, 0.34);
      }

      /* (c) y=0.064 doubleshot inner liner step ring (downward normal) */
      var stepOutStart = positions.length / 3;
      for (var bi4 = 0; bi4 < RING_COUNT; bi4++) {
        emitV(wallBotPts[bi4].x, stepY, wallBotPts[bi4].z, 0, -1, 0, 0, 0, 0.38);
      }
      var stepInStart = positions.length / 3;
      for (var bi5 = 0; bi5 < RING_COUNT; bi5++) {
        emitV(stepInPts[bi5].x, stepY, stepInPts[bi5].z, 0, -1, 0, 0, 0, 0.38);
      }

      /* (d) Deep cavity main inner walls y=0.064 -> y=0.276 and cavity ceiling */
      var cavWallBotStart = positions.length / 3;
      for (var bi6 = 0; bi6 < RING_COUNT; bi6++) {
        emitV(stepInPts[bi6].x, stepY, stepInPts[bi6].z, -stepInPts[bi6].nx, -0.28, -stepInPts[bi6].nz, 0, 0, 0.34);
      }
      var cavWallTopStart = positions.length / 3;
      for (var bi7 = 0; bi7 < RING_COUNT; bi7++) {
        emitV(cavTopPts[bi7].x, cavityDepth, cavTopPts[bi7].z, -cavTopPts[bi7].nx, -0.36, -cavTopPts[bi7].nz, 0, 0, 0.34);
      }
      var cavRoofStart = positions.length / 3;
      for (var bi8 = 0; bi8 < RING_COUNT; bi8++) {
        emitV(cavTopPts[bi8].x, cavityDepth, cavTopPts[bi8].z, 0, -1, 0, 0, 0, 0.34);
      }
      var cavRoofCenter = emitV(0, cavityDepth, 0, 0, -1, 0, 0, 0, 0.34);

      for (var bs = 0; bs < RING_COUNT; bs++) {
        var bsNext = (bs + 1) % RING_COUNT;
        indices.push(
          botWallInStart + bs, botOuterStart + bs, botOuterStart + bsNext,
          botWallInStart + bs, botOuterStart + bsNext, botWallInStart + bsNext
        );
        indices.push(
          wallStepBotStart + bs, wallStepBotStart + bsNext, wallStepTopStart + bsNext,
          wallStepBotStart + bs, wallStepTopStart + bsNext, wallStepTopStart + bs
        );
        indices.push(
          stepInStart + bs, stepOutStart + bs, stepOutStart + bsNext,
          stepInStart + bs, stepOutStart + bsNext, stepInStart + bsNext
        );
        indices.push(
          cavWallBotStart + bs, cavWallBotStart + bsNext, cavWallTopStart + bsNext,
          cavWallBotStart + bs, cavWallTopStart + bsNext, cavWallTopStart + bs
        );
        indices.push(cavRoofCenter, cavRoofStart + bs, cavRoofStart + bsNext);
      }

      /* (e) Four-way inner cavity structural ribs linking stem mount to inner walls */
      var ribHalfT = 0.015;
      var ribY0 = 0.115;
      var ribY1 = cavityDepth - 0.002;
      emitCapSubBox(0.116, ribY0, -ribHalfT, 0.336, ribY1, ribHalfT, 0.38, true, false);
      emitCapSubBox(-0.336, ribY0, -ribHalfT, -0.116, ribY1, ribHalfT, 0.38, true, false);
      emitCapSubBox(-ribHalfT, ribY0, 0.116, ribHalfT, ribY1, 0.336, 0.38, true, false);
      emitCapSubBox(-ribHalfT, ribY0, -0.336, ribHalfT, ribY1, -0.116, 0.38, true, false);

      /* (f) Central cylindrical cross-stem socket (12-seg cylinder + bottom rim + recessed [+] cross slot) */
      var bossSegs = 12;
      var bossOuterR = 0.122;
      var bossInnerR = 0.084;
      var bossBotY = 0.012;
      var bossTopY = cavityDepth - 0.001;
      var slotDepthY = 0.168;
      var crossHalfT = 0.020;

      var bossCylBot = positions.length / 3;
      for (var cs0 = 0; cs0 < bossSegs; cs0++) {
        var ang0 = (cs0 / bossSegs) * TWO_PI;
        emitV(Math.cos(ang0) * bossOuterR, bossBotY, Math.sin(ang0) * bossOuterR, Math.cos(ang0), -0.12, Math.sin(ang0), 0, 0, 0.44);
      }
      var bossCylTop = positions.length / 3;
      for (var cs1 = 0; cs1 < bossSegs; cs1++) {
        var ang1 = (cs1 / bossSegs) * TWO_PI;
        emitV(Math.cos(ang1) * bossOuterR, bossTopY, Math.sin(ang1) * bossOuterR, Math.cos(ang1), -0.12, Math.sin(ang1), 0, 0, 0.44);
      }

      /* Stem socket bottom ring (r: 0.084 .. 0.122, y = 0.012) and inner bore wall */
      var bossRimOut = positions.length / 3;
      for (var cs2 = 0; cs2 < bossSegs; cs2++) {
        var ang2 = (cs2 / bossSegs) * TWO_PI;
        emitV(Math.cos(ang2) * bossOuterR, bossBotY, Math.sin(ang2) * bossOuterR, 0, -1, 0, 0, 0, 0.44);
      }
      var bossRimIn = positions.length / 3;
      for (var cs3 = 0; cs3 < bossSegs; cs3++) {
        var ang3 = (cs3 / bossSegs) * TWO_PI;
        emitV(Math.cos(ang3) * bossInnerR, bossBotY, Math.sin(ang3) * bossInnerR, 0, -1, 0, 0, 0, 0.44);
      }
      var boreWallBot = positions.length / 3;
      for (var cs4 = 0; cs4 < bossSegs; cs4++) {
        var ang4 = (cs4 / bossSegs) * TWO_PI;
        emitV(Math.cos(ang4) * bossInnerR, bossBotY, Math.sin(ang4) * bossInnerR, -Math.cos(ang4), -0.18, -Math.sin(ang4), 0, 0, 0.30);
      }
      var boreWallTop = positions.length / 3;
      for (var cs5 = 0; cs5 < bossSegs; cs5++) {
        var ang5 = (cs5 / bossSegs) * TWO_PI;
        emitV(Math.cos(ang5) * bossInnerR, slotDepthY, Math.sin(ang5) * bossInnerR, -Math.cos(ang5), -0.18, -Math.sin(ang5), 0, 0, 0.30);
      }
      var boreRoofCenter = emitV(0, slotDepthY, 0, 0, -1, 0, 0, 0, 0.28);

      for (var csi = 0; csi < bossSegs; csi++) {
        var csiNext = (csi + 1) % bossSegs;
        indices.push(
          bossCylBot + csi, bossCylTop + csi, bossCylTop + csiNext,
          bossCylBot + csi, bossCylTop + csiNext, bossCylBot + csiNext
        );
        indices.push(
          bossRimIn + csi, bossRimOut + csi, bossRimOut + csiNext,
          bossRimIn + csi, bossRimOut + csiNext, bossRimIn + csiNext
        );
        indices.push(
          boreWallBot + csi, boreWallBot + csiNext, boreWallTop + csiNext,
          boreWallBot + csi, boreWallTop + csiNext, boreWallTop + csi
        );
        indices.push(boreRoofCenter, boreWallTop + csi, boreWallTop + csiNext);
      }

      /* Four-quadrant inner grip teeth framing the crisp recessed [+] cross socket */
      var qSpan = 0.066;
      emitCapSubBox(crossHalfT, bossBotY, crossHalfT, qSpan, slotDepthY, qSpan, 0.44, true, false);
      emitCapSubBox(-qSpan, bossBotY, crossHalfT, -crossHalfT, slotDepthY, qSpan, 0.44, true, false);
      emitCapSubBox(-qSpan, bossBotY, -qSpan, -crossHalfT, slotDepthY, -crossHalfT, 0.44, true, false);
      emitCapSubBox(crossHalfT, bossBotY, -qSpan, qSpan, slotDepthY, -crossHalfT, 0.44, true, false);

      _cachedSculptedKeycapGeom = {
        positions: new Float32Array(positions),
        normals: new Float32Array(normals),
        uvs: new Float32Array(uvs),
        partFlags: new Float32Array(partFlags),
        indices: new Uint16Array(indices),
        indexCount: indices.length,
        outerIndexCount: outerIndexCount,
        cavityIndexCount: indices.length - outerIndexCount,
      };
      return _cachedSculptedKeycapGeom;
    }

    var _cachedChassisMeshMap = new Map();
    /**
     * Builds V10 heavy CNC custom aluminum chassis mesh (buildChassisMesh):
     * - Thick anodized walls (+/-9.68U x [-3.86, 4.62]) + signature dual recessed Step-Bezel chamfer
     * - Recessed ultra-fine perimeter prism lightguide waistline seam
     * - Clean uninterrupted solid anodized top forehead
     * - Cols 3..12, Rows 1..3 feature an R=0.16U rounded CNC beveled metal OLED screen frame
     */
    function buildChassisMesh(palette, includeAuxPad) {
      var chCacheKey = (palette && palette.id ? palette.id : 'obsidian-dark') + ':' + (includeAuxPad ? 1 : 0);
      var chCached = _cachedChassisMeshMap.get(chCacheKey);
      if (chCached) return chCached;
      var mb = createMeshBuilder();
      var colBody = hexToRgb01(palette.caseBody);
      var colStep = hexToRgb01(palette.caseStep || palette.caseBody);
      var colSide = hexToRgb01(palette.caseSide);
      var colUnder = hexToRgb01(palette.caseUnder || palette.caseSide);
      var colChamfer = hexToRgb01(palette.caseChamfer);
      var colInner = hexToRgb01(palette.innerWall);
      var colPlate = hexToRgb01(palette.plate);
      var colDeckFrame = hexToRgb01(palette.deckFrame);
      var colDeckLip = hexToRgb01(palette.deckLip || palette.deckFrame);
      var colWaist = hexToRgb01(palette.waistGroove || '#06080C');
      var colFootPad = hexToRgb01(palette.footPad || '#060709');

      /* matKind:
       *   0 = 220-grit isotropic micro-blasted anodized aluminum
       *   1 = 45-deg diamond chamfer / Step-Bezel bevel / PVD mirror weight
       *   4 = 360-deg recessed ultra-fine prism waistline lightguide
       *   6 = Recessed matte switch plate / micro matte bumper feet */
      var matAnodized = [palette.isLight ? 0.24 : 0.26, palette.isLight ? 0.89 : 0.87, 0.0, 0];
      var matDiamondChamfer = palette.isLight
        ? [0.15, 0.94, 0.0, 0]
        : [0.10, 0.96, 0.0, 1];
      var matStepChamfer = palette.isLight
        ? [0.18, 0.92, 0.0, 0]
        : [0.13, 0.94, 0.0, 1];
      var matUnderSlope = [palette.isLight ? 0.22 : 0.24, 0.90, 0.0, 0];
      var matWaistCrystal = [0.26, 0.58, palette.isLight ? 0.018 : 0.030, 4];
      var matWellEdge = [0.20, 0.90, 0.0, 0];
      var matScreenBevel = palette.isLight
        ? [0.17, 0.92, 0.0, 0]
        : [0.14, 0.94, 0.0, 1];
      var matPlate = [0.42, 0.66, 0.0, 6];
      var matFootPad = [0.74, 0.08, 0.0, 6];

      var diamondChamferCol = mixRgb(colBody, colChamfer, palette.isLight ? 0.45 : 0.58);
      var stepBevelCol = mixRgb(colBody, colChamfer, palette.isLight ? 0.38 : 0.44);
      var wellBevelCol = mixRgb(colStep, colChamfer, palette.isLight ? 0.30 : 0.26);
      var waistLipCol = mixRgb(colSide, colChamfer, palette.isLight ? 0.26 : 0.20);

      /* 1. Heavy CNC chassis profile rings: tapered underbody + recessed waistline seam + thick upper wall + 45-deg chamfer + Step-Bezel */
      var CASE_SEGS = 16;
      var underFootLoop = sampleG2RectLoop(
        -CASE_HALF_W + 0.62, CASE_Z_MIN + 0.52,
        CASE_HALF_W - 0.62, CASE_Z_MAX - 0.66,
        CASE_CORNER_R - 0.22, CASE_SEGS, 2.32
      );
      var underBevelLoop = sampleG2RectLoop(
        -CASE_HALF_W + 0.48, CASE_Z_MIN + 0.40,
        CASE_HALF_W - 0.48, CASE_Z_MAX - 0.52,
        CASE_CORNER_R - 0.18, CASE_SEGS, 2.32
      );
      var waistLowerLip = sampleG2RectLoop(
        -CASE_HALF_W + 0.024, CASE_Z_MIN + 0.022,
        CASE_HALF_W - 0.024, CASE_Z_MAX - 0.042,
        CASE_CORNER_R - 0.014, CASE_SEGS, 2.32
      );
      var waistGrooveLoop = sampleG2RectLoop(
        -CASE_HALF_W + 0.068, CASE_Z_MIN + 0.064,
        CASE_HALF_W - 0.068, CASE_Z_MAX - 0.084,
        CASE_CORNER_R - 0.038, CASE_SEGS, 2.32
      );
      var waistUpperLip = sampleG2RectLoop(
        -CASE_HALF_W + 0.010, CASE_Z_MIN + 0.010,
        CASE_HALF_W - 0.010, CASE_Z_MAX - 0.018,
        CASE_CORNER_R - 0.008, CASE_SEGS, 2.32
      );
      var outerWallHigh = sampleG2RectLoop(
        -CASE_HALF_W, CASE_Z_MIN,
        CASE_HALF_W, CASE_Z_MAX,
        CASE_CORNER_R, CASE_SEGS, 2.32
      );
      var filletMid1 = sampleG2RectLoop(
        -CASE_HALF_W + 0.020, CASE_Z_MIN + 0.020,
        CASE_HALF_W - 0.020, CASE_Z_MAX - 0.024,
        CASE_CORNER_R - 0.016, CASE_SEGS, 2.32
      );
      var filletMid2 = sampleG2RectLoop(
        -CASE_HALF_W + 0.054, CASE_Z_MIN + 0.054,
        CASE_HALF_W - 0.054, CASE_Z_MAX - 0.062,
        CASE_CORNER_R - 0.042, CASE_SEGS, 2.32
      );
      var outerTopLoop = sampleG2RectLoop(
        -CASE_HALF_W + 0.088, CASE_Z_MIN + 0.088,
        CASE_HALF_W - 0.088, CASE_Z_MAX - 0.098,
        CASE_CORNER_R - 0.068, CASE_SEGS, 2.32
      );

      /* Dual recessed Step-Bezel rings (Step-Bezel Outer Top -> Step Shelf -> Well Outer -> Well Inner) */
      var stepBevelOuterLoop = sampleG2RectLoop(
        WELL_X_MIN - 0.245, WELL_Z_MIN - 0.245,
        WELL_X_MAX + 0.245, WELL_Z_MAX + 0.245,
        WELL_CORNER_R + 0.175, CASE_SEGS, 2.24
      );
      var stepShelfInnerLoop = sampleG2RectLoop(
        WELL_X_MIN - 0.196, WELL_Z_MIN - 0.196,
        WELL_X_MAX + 0.196, WELL_Z_MAX + 0.196,
        WELL_CORNER_R + 0.135, CASE_SEGS, 2.24
      );
      var wellOuterLoop = sampleG2RectLoop(
        WELL_X_MIN - 0.038, WELL_Z_MIN - 0.038,
        WELL_X_MAX + 0.038, WELL_Z_MAX + 0.038,
        WELL_CORNER_R + 0.032, CASE_SEGS, 2.20
      );
      var wellInnerLoop = sampleG2RectLoop(
        WELL_X_MIN, WELL_Z_MIN,
        WELL_X_MAX, WELL_Z_MAX,
        WELL_CORNER_R, CASE_SEGS, 2.20
      );

      /* Two-stage ergonomic wedge height profile + recessed waistline seam */
      function zRatio(pt) {
        return clamp((pt.z - CASE_Z_MIN) / (CASE_Z_MAX - CASE_Z_MIN), 0, 1);
      }
      function underBevelY(pt) {
        return CASE_Y_BOT + 0.048 + zRatio(pt) * 0.018;
      }
      function waistLowerLipY(pt) {
        return -0.376 + zRatio(pt) * 0.110;
      }
      function waistGrooveBotY(pt) {
        return -0.362 + zRatio(pt) * 0.110;
      }
      function waistGrooveTopY(pt) {
        return -0.334 + zRatio(pt) * 0.110;
      }
      function waistUpperLipY(pt) {
        return -0.320 + zRatio(pt) * 0.110;
      }
      function wedgeShoulderLowY(pt) {
        return (CASE_Y_TOP - 0.058) - zRatio(pt) * 0.024;
      }
      function wedgeShoulderMid1Y(pt) {
        return (CASE_Y_TOP - 0.032) - zRatio(pt) * 0.012;
      }
      function wedgeShoulderMid2Y(pt) {
        return (CASE_Y_TOP - 0.010) - zRatio(pt) * 0.004;
      }

      /* 1A. Underbody base plane + central recessed PVD mirror weight pocket + 4 corner matte bumper strips */
      var backSlotOuter = sampleG2RectLoop(-4.88, -2.20, 4.88, 2.80, 0.24, CASE_SEGS, 2.24);
      var backSlotInner = sampleG2RectLoop(-4.84, -2.16, 4.84, 2.76, 0.22, CASE_SEGS, 2.24);
      mb.addPlanarAnnulus(underFootLoop, CASE_Y_BOT, backSlotOuter, CASE_Y_BOT, colUnder, matAnodized, true);
      mb.addLoopWallStrip(
        backSlotOuter, CASE_Y_BOT,
        backSlotInner, CASE_Y_BOT + 0.024,
        -0.46, shadeRgb(colInner, 0.56), matAnodized, true, 0.38
      );
      mb.addLoopCap(backSlotInner, CASE_Y_BOT + 0.024, shadeRgb(colInner, 0.42), matAnodized, true);

      function addMicroStealthFoot(fx0, fz0, fx1, fz1) {
        var bev = 0.022;
        var ySeat = CASE_Y_BOT + 0.002;
        var yPad = CASE_Y_BOT - 0.024;
        var ix0 = fx0 + bev, ix1 = fx1 - bev;
        var iz0 = fz0 + bev, iz1 = fz1 - bev;
        var padRim = shadeRgb(colFootPad, 1.24, 0.015);
        mb.addQuad([ix0, yPad, iz0], [ix1, yPad, iz0], [ix1, yPad, iz1], [ix0, yPad, iz1], [0, -1, 0], colFootPad, matFootPad);
        mb.addQuad([fx0, ySeat, fz1], [ix0, yPad, iz1], [ix1, yPad, iz1], [fx1, ySeat, fz1], [0, -0.68, 0.73], padRim, matFootPad);
        mb.addQuad([fx1, ySeat, fz0], [ix1, yPad, iz0], [ix0, yPad, iz0], [fx0, ySeat, fz0], [0, -0.68, -0.73], padRim, matFootPad);
        mb.addQuad([fx0, ySeat, fz0], [ix0, yPad, iz0], [ix0, yPad, iz1], [fx0, ySeat, fz1], [-0.73, -0.68, 0], padRim, matFootPad);
        mb.addQuad([fx1, ySeat, fz1], [ix1, yPad, iz1], [ix1, yPad, iz0], [fx1, ySeat, fz0], [0.73, -0.68, 0], padRim, matFootPad);
      }
      addMicroStealthFoot(-8.02, -3.14, -6.34, -2.90);
      addMicroStealthFoot(6.34, -3.14, 8.02, -2.90);
      addMicroStealthFoot(-8.02, 3.52, -6.34, 3.76);
      addMicroStealthFoot(6.34, 3.52, 8.02, 3.76);

      /* 1B. Sculpted tapered lower underbody bevel */
      mb.addSmoothFilletStrip(
        underFootLoop, CASE_Y_BOT, -0.84, colUnder,
        underBevelLoop, underBevelY, -0.58, mixRgb(colUnder, waistLipCol, 0.42),
        matUnderSlope, false, 0.24, 0.68
      );
      mb.addSmoothFilletStrip(
        underBevelLoop, underBevelY, -0.56, mixRgb(colUnder, colSide, 0.55),
        waistLowerLip, waistLowerLipY, -0.44, colSide,
        matUnderSlope, false, 0.28, 0.56
      );

      /* 1C. Recessed matte micro-metal waistline seam (subtle at rest, cool prism shimmer on near-field/pulse) */
      mb.addSmoothFilletStrip(
        waistLowerLip, waistLowerLipY, 0.66, waistLipCol,
        waistGrooveLoop, waistGrooveBotY, 0.46, colWaist,
        matDiamondChamfer, false, 0.38, 0.54
      );
      mb.addSmoothFilletStrip(
        waistGrooveLoop, waistGrooveBotY, -0.05, colWaist,
        waistGrooveLoop, waistGrooveTopY, 0.05, colWaist,
        matWaistCrystal, false, 0.56, 0.56
      );
      mb.addSmoothFilletStrip(
        waistGrooveLoop, waistGrooveTopY, -0.46, colWaist,
        waistUpperLip, waistUpperLipY, -0.66, waistLipCol,
        matDiamondChamfer, false, 0.54, 0.38
      );

      /* 1D. Upper matte anodized side walls + outer 45-deg diamond chamfer */
      mb.addSmoothFilletStrip(
        waistUpperLip, waistUpperLipY, 0.05, colSide,
        outerWallHigh, wedgeShoulderLowY, 0.12, colSide,
        matAnodized, false, 0.00, 0.00
      );
      mb.addSmoothFilletStrip(
        outerWallHigh, wedgeShoulderLowY, 0.24, mixRgb(colSide, diamondChamferCol, 0.28),
        filletMid1, wedgeShoulderMid1Y, 0.68, diamondChamferCol,
        matDiamondChamfer, false, 0.00, 0.98
      );
      mb.addSmoothFilletStrip(
        filletMid1, wedgeShoulderMid1Y, 0.71, diamondChamferCol,
        filletMid2, wedgeShoulderMid2Y, 0.75, diamondChamferCol,
        matDiamondChamfer, false, 0.99, 0.97
      );
      mb.addSmoothFilletStrip(
        filletMid2, wedgeShoulderMid2Y, 0.86, mixRgb(colBody, diamondChamferCol, 0.34),
        outerTopLoop, CASE_Y_TOP, 0.996, colBody,
        matAnodized, false, 0.34, 0.00
      );

      /* 1E. Dual recessed Step-Bezel top frame (outer flat rim + 45-deg step bevel + recessed shelf + plate chamfer) */
      var yWellBevelBot = CASE_STEP_Y - 0.032;
      mb.addPlanarAnnulus(outerTopLoop, CASE_Y_TOP, stepBevelOuterLoop, CASE_Y_TOP, colBody, matAnodized, false);
      mb.addSmoothFilletStrip(
        stepShelfInnerLoop, CASE_STEP_Y, 0.62, mixRgb(colStep, stepBevelCol, 0.58),
        stepBevelOuterLoop, CASE_Y_TOP, 0.74, stepBevelCol,
        matStepChamfer, true, 0.76, 0.84
      );
      mb.addPlanarAnnulus(stepShelfInnerLoop, CASE_STEP_Y, wellOuterLoop, CASE_STEP_Y, colStep, matAnodized, false);
      mb.addSmoothFilletStrip(
        wellInnerLoop, yWellBevelBot, 0.42, mixRgb(colInner, wellBevelCol, 0.45),
        wellOuterLoop, CASE_STEP_Y, 0.82, wellBevelCol,
        matWellEdge, true, 0.00, 0.32
      );
      mb.addLoopWallStrip(wellInnerLoop, PLATE_Y, wellInnerLoop, yWellBevelBot, 0.04, colInner, matAnodized, true, 0.0);
      mb.addLoopCap(wellInnerLoop, PLATE_Y, colPlate, matPlate, false);

      /* 2. Groups 3-12 R=0.16U smooth rounded CNC beveled metal OLED screen bezel */
      var DECK_SEGS = 14;
      var rimTopY = DECK_GLASS_Y + 0.034;
      var glassSeatY = DECK_GLASS_Y - 0.004;

      var deckOuterBot = sampleG2RectLoop(
        DECK_X_MIN - 0.080, DECK_Z_MIN - 0.080,
        DECK_X_MAX + 0.080, DECK_Z_MAX + 0.080,
        DECK_CORNER_R + 0.072, DECK_SEGS, 2.12
      );
      var deckRimOuter = sampleG2RectLoop(
        DECK_X_MIN - 0.064, DECK_Z_MIN - 0.064,
        DECK_X_MAX + 0.064, DECK_Z_MAX + 0.064,
        DECK_CORNER_R + 0.058, DECK_SEGS, 2.12
      );
      var deckRimInnerTop = sampleG2RectLoop(
        DECK_X_MIN - 0.042, DECK_Z_MIN - 0.042,
        DECK_X_MAX + 0.042, DECK_Z_MAX + 0.042,
        DECK_CORNER_R + 0.038, DECK_SEGS, 2.10
      );
      var deckGlassIn = sampleG2RectLoop(
        DECK_X_MIN + 0.003, DECK_Z_MIN + 0.003,
        DECK_X_MAX - 0.003, DECK_Z_MAX - 0.003,
        DECK_CORNER_R - 0.002, DECK_SEGS, 2.08
      );

      var seatBgRgb = hexToRgb01(palette.deckGlassBg || '#04060A');
      var bevelLipHigh = mixRgb(colDeckLip, colChamfer, palette.isLight ? 0.34 : 0.38);
      var bevelLipLow = shadeRgb(colDeckLip, 0.72);

      mb.addLoopCap(deckGlassIn, DECK_GLASS_Y - 0.006, seatBgRgb, matAnodized, false);
      mb.addSmoothFilletStrip(
        deckOuterBot, PLATE_Y, 0.14, shadeRgb(colDeckFrame, 0.78),
        deckRimOuter, rimTopY, 0.52, colDeckFrame,
        matAnodized, false, 0.00, 0.24
      );
      mb.addPlanarAnnulus(deckRimOuter, rimTopY, deckRimInnerTop, rimTopY, mixRgb(colDeckFrame, bevelLipHigh, 0.35), matAnodized, false);
      mb.addSmoothFilletStrip(
        deckGlassIn, glassSeatY, 0.64, bevelLipLow,
        deckRimInnerTop, rimTopY, 0.72, bevelLipHigh,
        matScreenBevel, true, 0.74, 0.82
      );

      /* 2B. V13.1 Magnetic CNC 6063 rail bridge docking main chassis to AUX-06 (batched into main chassis VAO) */
      if (includeAuxPad) {
        var brX0 = CASE_HALF_W - 0.05;
        var brX1 = AUX_CASE_X_MIN + 0.05;
        var brMidX = (brX0 + brX1) * 0.5;
        var brZ0 = 0.88;
        var brZ1 = 3.64;
        var brYBot = -0.34;
        var brYTop = 0.145;
        var bridgeBodyCol = mixRgb(colBody, colStep, 0.35);
        var bridgeSpineCol = mixRgb(colBody, colChamfer, palette.isLight ? 0.58 : 0.76);
        var bridgeSlotDark = shadeRgb(colInner, 0.72);
        /* Rail bridge base and 45-deg beveled end faces */
        mb.addChamferedBlock(
          brX0, brYBot, brZ0,
          brX1, brYTop - 0.032, brZ1,
          0.024, bridgeBodyCol, bridgeSpineCol, colSide,
          matAnodized, matDiamondChamfer, true
        );
        /* Parallel left/right magnetic alignment grooves + central bright silver 45-deg diamond spine */
        mb.addBox(
          brMidX - 0.085, brYTop - 0.040, brZ0 + 0.12,
          brMidX - 0.052, brYTop - 0.022, brZ1 - 0.12,
          bridgeSlotDark, bridgeSlotDark, matAnodized, matAnodized, true
        );
        mb.addBox(
          brMidX + 0.052, brYTop - 0.040, brZ0 + 0.12,
          brMidX + 0.085, brYTop - 0.022, brZ1 - 0.12,
          bridgeSlotDark, bridgeSlotDark, matAnodized, matAnodized, true
        );
        mb.addChamferedBlock(
          brMidX - 0.048, brYTop - 0.036, brZ0 + 0.10,
          brMidX + 0.048, brYTop + 0.014, brZ1 - 0.10,
          0.020, bridgeSpineCol, colChamfer, bridgeBodyCol,
          matDiamondChamfer, matDiamondChamfer, true
        );
      }

      /* 2C. V13.1 precision laser-etched micro badge on lower-right bezel: PRISM-118 // CNC-6063 (vector-batched into static chassisGpu) */
      var LASER_FONT = {
        P: [[0, 1, 0, 0], [0, 0, 0.82, 0], [0.82, 0, 1, 0.16], [1, 0.16, 1, 0.42], [1, 0.42, 0.82, 0.56], [0.82, 0.56, 0, 0.56]],
        R: [[0, 1, 0, 0], [0, 0, 0.82, 0], [0.82, 0, 1, 0.16], [1, 0.16, 1, 0.40], [1, 0.40, 0.82, 0.54], [0.82, 0.54, 0, 0.54], [0.55, 0.54, 1, 1]],
        I: [[0.18, 0, 0.82, 0], [0.5, 0, 0.5, 1], [0.18, 1, 0.82, 1]],
        S: [[1, 0.14, 0.82, 0], [0.82, 0, 0.18, 0], [0.18, 0, 0, 0.16], [0, 0.16, 0, 0.36], [0, 0.36, 0.18, 0.48], [0.18, 0.48, 0.82, 0.52], [0.82, 0.52, 1, 0.66], [1, 0.66, 1, 0.84], [1, 0.84, 0.82, 1], [0.82, 1, 0.18, 1], [0.18, 1, 0, 0.86]],
        M: [[0, 1, 0, 0], [0, 0, 0.5, 0.58], [0.5, 0.58, 1, 0], [1, 0, 1, 1]],
        '-': [[0.14, 0.50, 0.86, 0.50]],
        '1': [[0.24, 0.18, 0.54, 0], [0.54, 0, 0.54, 1], [0.22, 1, 0.86, 1]],
        '8': [[0.18, 0, 0.82, 0], [0.82, 0, 1, 0.16], [1, 0.16, 1, 0.38], [1, 0.38, 0.82, 0.50], [0.82, 0.50, 0.18, 0.50], [0.18, 0.50, 0, 0.38], [0, 0.38, 0, 0.16], [0, 0.16, 0.18, 0], [0.18, 0.50, 0, 0.64], [0, 0.64, 0, 0.84], [0, 0.84, 0.18, 1], [0.18, 1, 0.82, 1], [0.82, 1, 1, 0.84], [1, 0.84, 1, 0.64], [1, 0.64, 0.82, 0.50]],
        '/': [[0.16, 1, 0.84, 0]],
        C: [[1, 0.18, 0.80, 0], [0.80, 0, 0.22, 0], [0.22, 0, 0, 0.22], [0, 0.22, 0, 0.78], [0, 0.78, 0.22, 1], [0.22, 1, 0.80, 1], [0.80, 1, 1, 0.82]],
        N: [[0, 1, 0, 0], [0, 0, 1, 1], [1, 1, 1, 0]],
        '6': [[0.92, 0.14, 0.76, 0], [0.76, 0, 0.22, 0], [0.22, 0, 0, 0.24], [0, 0.24, 0, 0.80], [0, 0.80, 0.20, 1], [0.20, 1, 0.80, 1], [0.80, 1, 1, 0.82], [1, 0.82, 1, 0.60], [1, 0.60, 0.80, 0.46], [0.80, 0.46, 0, 0.46]],
        '0': [[0.20, 0, 0.80, 0], [0.80, 0, 1, 0.20], [1, 0.20, 1, 0.80], [1, 0.80, 0.80, 1], [0.80, 1, 0.20, 1], [0.20, 1, 0, 0.80], [0, 0.80, 0, 0.20], [0, 0.20, 0.20, 0]],
        '3': [[0.08, 0.14, 0.24, 0], [0.24, 0, 0.80, 0], [0.80, 0, 1, 0.18], [1, 0.18, 1, 0.36], [1, 0.36, 0.78, 0.49], [0.78, 0.49, 0.32, 0.49], [0.78, 0.49, 1, 0.64], [1, 0.64, 1, 0.82], [1, 0.82, 0.80, 1], [0.80, 1, 0.22, 1], [0.22, 1, 0.06, 0.86]],
        A: [[0, 1, 0.50, 0], [0.50, 0, 1, 1], [0.20, 0.66, 0.80, 0.66]],
        U: [[0, 0, 0, 0.80], [0, 0.80, 0.20, 1], [0.20, 1, 0.80, 1], [0.80, 1, 1, 0.80], [1, 0.80, 1, 0]],
        X: [[0.04, 0, 0.96, 1], [0.96, 0, 0.04, 1]],
      };
      var addLaserEtchedText = function (text, xRight, zCenter, ySurf, charW, charH, gapW, strokeW, colRgb, matArr) {
        var totalW = text.length * charW + Math.max(0, text.length - 1) * gapW;
        var cursorX = xRight - totalW;
        var zTop = zCenter - charH * 0.5;
        var hw = strokeW * 0.5;
        for (var ci = 0; ci < text.length; ci++) {
          var ch = text.charAt(ci);
          var segs = LASER_FONT[ch];
          if (segs) {
            for (var si = 0; si < segs.length; si++) {
              var s = segs[si];
              var x0 = cursorX + s[0] * charW;
              var z0 = zTop + s[1] * charH;
              var x1 = cursorX + s[2] * charW;
              var z1 = zTop + s[3] * charH;
              var dx = x1 - x0;
              var dz = z1 - z0;
              var len = Math.hypot(dx, dz);
              if (len < 1e-4) continue;
              var ux = dx / len;
              var uz = dz / len;
              /* Extend endpoints by 0.35*hw for tight stroke miter joins */
              var ex0 = x0 - ux * hw * 0.35;
              var ez0 = z0 - uz * hw * 0.35;
              var ex1 = x1 + ux * hw * 0.35;
              var ez1 = z1 + uz * hw * 0.35;
              var px = -uz * hw;
              var pz = ux * hw;
              mb.addQuad(
                [ex0 + px, ySurf, ez0 + pz],
                [ex1 + px, ySurf, ez1 + pz],
                [ex1 - px, ySurf, ez1 - pz],
                [ex0 - px, ySurf, ez0 - pz],
                [0, 1, 0],
                colRgb,
                matArr
              );
            }
          }
          cursorX += charW + gapW;
        }
      };
      var laserInkCol = palette.isLight
        ? [0.22, 0.25, 0.30]
        : mixRgb(colBody, colChamfer, 0.72);
      var matLaserEtch = palette.isLight
        ? [0.34, 0.22, 0.0, 0]
        : [0.16, 0.94, 0.06, 1];
      addLaserEtchedText(
        'PRISM-118 // CNC-6063',
        8.96, 4.355, CASE_Y_TOP + 0.0032,
        0.102, 0.132, 0.044, 0.024,
        laserInkCol, matLaserEtch
      );

      /* 2E. Static main underbody PVD mirror prism weight plate + fore/aft wedge wings (moved into static chassisGpu to avoid per-frame rebuilds) */
      var matPvdFacet = palette.isLight ? [0.065, 0.98, 0.0, 1] : [0.090, 0.95, 0.0, 1];
      var matPvdCrown = palette.isLight ? [0.080, 0.97, 0.0, 1] : [0.090, 0.95, 0.0, 1];
      var bwBodyCol = hexToRgb01(palette.backWeightBody || palette.caseChamfer);
      var bwRimCol = hexToRgb01(palette.backWeightRim || palette.caseChamfer);
      var bwBevelSouth = mixRgb(bwBodyCol, bwRimCol, 0.64);
      var bwBevelNorth = shadeRgb(bwBodyCol, palette.isLight ? 0.88 : 0.78);
      var bwBevelLeft = mixRgb(bwBodyCol, bwRimCol, 0.72);
      var bwBevelRight = shadeRgb(bwBodyCol, palette.isLight ? 0.84 : 0.72);

      var bwx0 = -4.82, bwx1 = 4.82;
      var bwz0 = -2.14, bwz1 = 2.74;
      var bwBev = 0.15;
      var bix0 = bwx0 + bwBev, bix1 = bwx1 - bwBev;
      var biz0 = bwz0 + bwBev, biz1 = bwz1 - bwBev;
      var bySeat = CASE_Y_BOT + 0.018;
      var byEdge = CASE_Y_BOT - 0.014;
      var byApex = CASE_Y_BOT - 0.032;
      var bcz = (bwz0 + bwz1) * 0.5;

      mb.addQuad(
        [bwx0, bySeat, bwz1], [bix0, byEdge, biz1], [bix1, byEdge, biz1], [bwx1, bySeat, bwz1],
        [0.0, -0.71, 0.70], bwBevelSouth, matPvdFacet,
        [0.96, 0.00], [0.96, 0.08], [0.96, 0.25], [0.96, 0.30]
      );
      mb.addQuad(
        [bwx1, bySeat, bwz0], [bix1, byEdge, biz0], [bix0, byEdge, biz0], [bwx0, bySeat, bwz0],
        [0.0, -0.71, -0.70], bwBevelNorth, matPvdFacet,
        [0.96, 0.50], [0.96, 0.58], [0.96, 0.75], [0.96, 0.80]
      );
      mb.addQuad(
        [bwx0, bySeat, bwz0], [bix0, byEdge, biz0], [bix0, byEdge, biz1], [bwx0, bySeat, bwz1],
        [-0.70, -0.71, 0.0], bwBevelLeft, matPvdFacet,
        [0.96, 0.80], [0.96, 0.85], [0.96, 0.95], [0.96, 1.00]
      );
      mb.addQuad(
        [bwx1, bySeat, bwz1], [bix1, byEdge, biz1], [bix1, byEdge, biz0], [bwx1, bySeat, bwz0],
        [0.70, -0.71, 0.0], bwBevelRight, matPvdFacet,
        [0.96, 0.30], [0.96, 0.35], [0.96, 0.45], [0.96, 0.50]
      );

      var bwFacetS = mixRgb(bwBodyCol, bwRimCol, 0.26);
      var bwFacetN = shadeRgb(bwBodyCol, 0.88);
      var bwFacetW = mixRgb(bwBodyCol, bwRimCol, 0.34);
      var bwFacetE = shadeRgb(bwBodyCol, 0.82);
      var bRidgeX0 = -2.15, bRidgeX1 = 2.15;
      mb.addQuad(
        [bix0, byEdge, biz1], [bRidgeX0, byApex, bcz], [bRidgeX1, byApex, bcz], [bix1, byEdge, biz1],
        [0.0, -0.985, 0.17], bwFacetS, matPvdCrown,
        [0.24, 0.05], [0.58, 0.35], [0.58, 0.65], [0.24, 0.25]
      );
      mb.addQuad(
        [bix1, byEdge, biz0], [bRidgeX1, byApex, bcz], [bRidgeX0, byApex, bcz], [bix0, byEdge, biz0],
        [0.0, -0.985, -0.17], bwFacetN, matPvdCrown,
        [0.24, 0.55], [0.58, 0.65], [0.58, 0.35], [0.24, 0.75]
      );
      mb.addQuad(
        [bix0, byEdge, biz0], [bRidgeX0, byApex, bcz], [bRidgeX0, byApex, bcz], [bix0, byEdge, biz1],
        [-0.17, -0.985, 0.0], bwFacetW, matPvdCrown,
        [0.24, 0.75], [0.58, 0.35], [0.58, 0.35], [0.24, 0.95]
      );
      mb.addQuad(
        [bix1, byEdge, biz1], [bRidgeX1, byApex, bcz], [bRidgeX1, byApex, bcz], [bix1, byEdge, biz0],
        [0.17, -0.985, 0.0], bwFacetE, matPvdCrown,
        [0.24, 0.25], [0.58, 0.65], [0.58, 0.65], [0.24, 0.45]
      );

      var fwx0 = -3.56, fwx1 = 3.56;
      var fix0 = fwx0 + 0.12, fix1 = fwx1 - 0.12;
      var fyBot = -0.855, fzBot = 3.99;
      var fyTop = -0.355, fzTop = 4.52;
      var fyInBot = -0.815, fzInBot = 4.08;
      var fyInTop = -0.402, fzInTop = 4.48;
      var fyMid = (fyInBot + fyInTop) * 0.5 - 0.012;
      var fzMid = (fzInBot + fzInTop) * 0.5 + 0.016;

      mb.addQuad(
        [fwx0, fyBot, fzBot], [fix0, fyInBot, fzInBot], [fix1, fyInBot, fzInBot], [fwx1, fyBot, fzBot],
        [0.0, -0.85, 0.52], bwBevelNorth, matPvdFacet,
        [0.95, 0.02], [0.95, 0.08], [0.95, 0.28], [0.95, 0.34]
      );
      mb.addQuad(
        [fix0, fyInTop, fzInTop], [fwx0, fyTop, fzTop], [fwx1, fyTop, fzTop], [fix1, fyInTop, fzInTop],
        [0.0, -0.36, 0.93], bwBevelSouth, matPvdFacet,
        [0.95, 0.10], [0.95, 0.16], [0.95, 0.36], [0.95, 0.42]
      );
      mb.addQuad(
        [fwx0, fyTop, fzTop], [fix0, fyInTop, fzInTop], [fix0, fyInBot, fzInBot], [fwx0, fyBot, fzBot],
        [-0.68, -0.45, 0.58], bwBevelLeft, matPvdFacet,
        [0.95, 0.82], [0.95, 0.86], [0.95, 0.94], [0.95, 0.98]
      );
      mb.addQuad(
        [fwx1, fyBot, fzBot], [fix1, fyInBot, fzInBot], [fix1, fyInTop, fzInTop], [fwx1, fyTop, fzTop],
        [0.68, -0.45, 0.58], bwBevelRight, matPvdFacet,
        [0.95, 0.38], [0.95, 0.42], [0.95, 0.48], [0.95, 0.52]
      );
      mb.addQuad(
        [fix0, fyInBot, fzInBot], [fix0, fyMid, fzMid], [fix1, fyMid, fzMid], [fix1, fyInBot, fzInBot],
        [0.0, -0.68, 0.73], bwFacetN, matPvdCrown,
        [0.22, 0.10], [0.58, 0.10], [0.58, 0.40], [0.22, 0.40]
      );
      mb.addQuad(
        [fix0, fyMid, fzMid], [fix0, fyInTop, fzInTop], [fix1, fyInTop, fzInTop], [fix1, fyMid, fzMid],
        [0.0, -0.54, 0.84], bwFacetS, matPvdCrown,
        [0.58, 0.10], [0.22, 0.10], [0.22, 0.40], [0.58, 0.40]
      );

      var ryBot = -0.865, rzBot = -3.37;
      var ryTop = -0.435, rzTop = -3.79;
      var ryInBot = -0.825, rzInBot = -3.44;
      var ryInTop = -0.475, rzInTop = -3.76;
      mb.addQuad(
        [fwx1, ryBot, rzBot], [fix1, ryInBot, rzInBot], [fix0, ryInBot, rzInBot], [fwx0, ryBot, rzBot],
        [0.0, -0.84, -0.54], bwBevelNorth, matPvdFacet,
        [0.95, 0.52], [0.95, 0.58], [0.95, 0.78], [0.95, 0.84]
      );
      mb.addQuad(
        [fix1, ryInTop, rzInTop], [fwx1, ryTop, rzTop], [fwx0, ryTop, rzTop], [fix0, ryInTop, rzInTop],
        [0.0, -0.38, -0.92], bwBevelSouth, matPvdFacet,
        [0.95, 0.60], [0.95, 0.66], [0.95, 0.86], [0.95, 0.92]
      );
      mb.addQuad(
        [fwx0, ryBot, rzBot], [fix0, ryInBot, rzInBot], [fix0, ryInTop, rzInTop], [fwx0, ryTop, rzTop],
        [-0.68, -0.46, -0.57], bwBevelLeft, matPvdFacet,
        [0.95, 0.88], [0.95, 0.91], [0.95, 0.96], [0.95, 0.99]
      );
      mb.addQuad(
        [fwx1, ryTop, rzTop], [fix1, ryInTop, rzInTop], [fix1, ryInBot, rzInBot], [fwx1, ryBot, rzBot],
        [0.68, -0.46, -0.57], bwBevelRight, matPvdFacet,
        [0.95, 0.42], [0.95, 0.45], [0.95, 0.50], [0.95, 0.54]
      );
      mb.addQuad(
        [fix1, ryInBot, rzInBot], [fix1, ryInTop, rzInTop], [fix0, ryInTop, rzInTop], [fix0, ryInBot, rzInBot],
        [0.0, -0.62, -0.78], bwFacetS, matPvdCrown,
        [0.26, 0.55], [0.38, 0.55], [0.38, 0.85], [0.26, 0.85]
      );

      var mainIndexCount = mb.getIndexCount();

      /* 3. V11 docked 3D 2x3 non-element Aux Macro Pad Step-Bezel CNC aluminum chassis batched into chassisGpu VAO */
      if (includeAuxPad) {
        var AUX_SEGS = 12;
        var auxUnderFootLoop = sampleG2RectLoop(
          AUX_CASE_X_MIN + 0.30, AUX_CASE_Z_MIN + 0.32,
          AUX_CASE_X_MAX - 0.30, AUX_CASE_Z_MAX - 0.40,
          AUX_CASE_CORNER_R - 0.14, AUX_SEGS, 2.28
        );
        var auxUnderBevelLoop = sampleG2RectLoop(
          AUX_CASE_X_MIN + 0.22, AUX_CASE_Z_MIN + 0.24,
          AUX_CASE_X_MAX - 0.22, AUX_CASE_Z_MAX - 0.30,
          AUX_CASE_CORNER_R - 0.11, AUX_SEGS, 2.28
        );
        var auxWaistLowerLip = sampleG2RectLoop(
          AUX_CASE_X_MIN + 0.018, AUX_CASE_Z_MIN + 0.018,
          AUX_CASE_X_MAX - 0.018, AUX_CASE_Z_MAX - 0.030,
          AUX_CASE_CORNER_R - 0.010, AUX_SEGS, 2.28
        );
        var auxWaistGrooveLoop = sampleG2RectLoop(
          AUX_CASE_X_MIN + 0.052, AUX_CASE_Z_MIN + 0.050,
          AUX_CASE_X_MAX - 0.052, AUX_CASE_Z_MAX - 0.064,
          AUX_CASE_CORNER_R - 0.028, AUX_SEGS, 2.28
        );
        var auxWaistUpperLip = sampleG2RectLoop(
          AUX_CASE_X_MIN + 0.008, AUX_CASE_Z_MIN + 0.008,
          AUX_CASE_X_MAX - 0.008, AUX_CASE_Z_MAX - 0.014,
          AUX_CASE_CORNER_R - 0.006, AUX_SEGS, 2.28
        );
        var auxOuterWallHigh = sampleG2RectLoop(
          AUX_CASE_X_MIN, AUX_CASE_Z_MIN,
          AUX_CASE_X_MAX, AUX_CASE_Z_MAX,
          AUX_CASE_CORNER_R, AUX_SEGS, 2.28
        );
        var auxFilletMid1 = sampleG2RectLoop(
          AUX_CASE_X_MIN + 0.014, AUX_CASE_Z_MIN + 0.014,
          AUX_CASE_X_MAX - 0.014, AUX_CASE_Z_MAX - 0.018,
          AUX_CASE_CORNER_R - 0.012, AUX_SEGS, 2.28
        );
        var auxFilletMid2 = sampleG2RectLoop(
          AUX_CASE_X_MIN + 0.036, AUX_CASE_Z_MIN + 0.036,
          AUX_CASE_X_MAX - 0.036, AUX_CASE_Z_MAX - 0.044,
          AUX_CASE_CORNER_R - 0.028, AUX_SEGS, 2.28
        );
        var auxOuterTopLoop = sampleG2RectLoop(
          AUX_CASE_X_MIN + 0.058, AUX_CASE_Z_MIN + 0.058,
          AUX_CASE_X_MAX - 0.058, AUX_CASE_Z_MAX - 0.068,
          AUX_CASE_CORNER_R - 0.046, AUX_SEGS, 2.28
        );

        var auxStepBevelOuterLoop = sampleG2RectLoop(
          AUX_WELL_X_MIN - 0.116, AUX_WELL_Z_MIN - 0.240,
          AUX_WELL_X_MAX + 0.116, AUX_WELL_Z_MAX + 0.180,
          AUX_WELL_CORNER_R + 0.095, AUX_SEGS, 2.22
        );
        var auxStepShelfInnerLoop = sampleG2RectLoop(
          AUX_WELL_X_MIN - 0.082, AUX_WELL_Z_MIN - 0.185,
          AUX_WELL_X_MAX + 0.082, AUX_WELL_Z_MAX + 0.138,
          AUX_WELL_CORNER_R + 0.068, AUX_SEGS, 2.22
        );
        var auxWellOuterLoop = sampleG2RectLoop(
          AUX_WELL_X_MIN - 0.026, AUX_WELL_Z_MIN - 0.026,
          AUX_WELL_X_MAX + 0.026, AUX_WELL_Z_MAX + 0.026,
          AUX_WELL_CORNER_R + 0.022, AUX_SEGS, 2.18
        );
        var auxWellInnerLoop = sampleG2RectLoop(
          AUX_WELL_X_MIN, AUX_WELL_Z_MIN,
          AUX_WELL_X_MAX, AUX_WELL_Z_MAX,
          AUX_WELL_CORNER_R, AUX_SEGS, 2.18
        );

        /* 3A. Aux pad underbody base + central PVD weight pocket + 4 corner matte feet */
        var auxBackSlotOuter = sampleG2RectLoop(10.58, 1.42, 11.84, 3.46, 0.16, AUX_SEGS, 2.20);
        var auxBackSlotInner = sampleG2RectLoop(10.61, 1.45, 11.81, 3.43, 0.14, AUX_SEGS, 2.20);
        mb.addPlanarAnnulus(auxUnderFootLoop, CASE_Y_BOT, auxBackSlotOuter, CASE_Y_BOT, colUnder, matAnodized, true);
        mb.addLoopWallStrip(
          auxBackSlotOuter, CASE_Y_BOT,
          auxBackSlotInner, CASE_Y_BOT + 0.022,
          -0.46, shadeRgb(colInner, 0.56), matAnodized, true, 0.36
        );
        mb.addLoopCap(auxBackSlotInner, CASE_Y_BOT + 0.022, shadeRgb(colInner, 0.42), matAnodized, true);

        addMicroStealthFoot(10.36, 0.80, 10.80, 0.98);
        addMicroStealthFoot(11.62, 0.80, 12.06, 0.98);
        addMicroStealthFoot(10.36, 3.88, 10.80, 4.06);
        addMicroStealthFoot(11.62, 3.88, 12.06, 4.06);

        /* 3B. Aux pad tapered underbody bevel + 360-deg waistline seam aligned flush with main chassis */
        mb.addSmoothFilletStrip(
          auxUnderFootLoop, CASE_Y_BOT, -0.84, colUnder,
          auxUnderBevelLoop, underBevelY, -0.58, mixRgb(colUnder, waistLipCol, 0.42),
          matUnderSlope, false, 0.24, 0.68
        );
        mb.addSmoothFilletStrip(
          auxUnderBevelLoop, underBevelY, -0.56, mixRgb(colUnder, colSide, 0.55),
          auxWaistLowerLip, waistLowerLipY, -0.44, colSide,
          matUnderSlope, false, 0.28, 0.56
        );
        mb.addSmoothFilletStrip(
          auxWaistLowerLip, waistLowerLipY, 0.66, waistLipCol,
          auxWaistGrooveLoop, waistGrooveBotY, 0.46, colWaist,
          matDiamondChamfer, false, 0.38, 0.54
        );
        mb.addSmoothFilletStrip(
          auxWaistGrooveLoop, waistGrooveBotY, -0.05, colWaist,
          auxWaistGrooveLoop, waistGrooveTopY, 0.05, colWaist,
          matWaistCrystal, false, 0.56, 0.56
        );
        mb.addSmoothFilletStrip(
          auxWaistGrooveLoop, waistGrooveTopY, -0.46, colWaist,
          auxWaistUpperLip, waistUpperLipY, -0.66, waistLipCol,
          matDiamondChamfer, false, 0.54, 0.38
        );

        /* 3C. Aux pad heavy anodized walls + 45-deg chamfer + dual Step-Bezel top frame + 2x3 matte plate */
        mb.addSmoothFilletStrip(
          auxWaistUpperLip, waistUpperLipY, 0.05, colSide,
          auxOuterWallHigh, wedgeShoulderLowY, 0.12, colSide,
          matAnodized, false, 0.00, 0.00
        );
        mb.addSmoothFilletStrip(
          auxOuterWallHigh, wedgeShoulderLowY, 0.24, mixRgb(colSide, diamondChamferCol, 0.28),
          auxFilletMid1, wedgeShoulderMid1Y, 0.68, diamondChamferCol,
          matDiamondChamfer, false, 0.00, 0.98
        );
        mb.addSmoothFilletStrip(
          auxFilletMid1, wedgeShoulderMid1Y, 0.71, diamondChamferCol,
          auxFilletMid2, wedgeShoulderMid2Y, 0.75, diamondChamferCol,
          matDiamondChamfer, false, 0.99, 0.97
        );
        mb.addSmoothFilletStrip(
          auxFilletMid2, wedgeShoulderMid2Y, 0.86, mixRgb(colBody, diamondChamferCol, 0.34),
          auxOuterTopLoop, CASE_Y_TOP, 0.996, colBody,
          matAnodized, false, 0.34, 0.00
        );

        mb.addPlanarAnnulus(auxOuterTopLoop, CASE_Y_TOP, auxStepBevelOuterLoop, CASE_Y_TOP, colBody, matAnodized, false);
        mb.addSmoothFilletStrip(
          auxStepShelfInnerLoop, CASE_STEP_Y, 0.62, mixRgb(colStep, stepBevelCol, 0.58),
          auxStepBevelOuterLoop, CASE_Y_TOP, 0.74, stepBevelCol,
          matStepChamfer, true, 0.76, 0.84
        );
        mb.addPlanarAnnulus(auxStepShelfInnerLoop, CASE_STEP_Y, auxWellOuterLoop, CASE_STEP_Y, colStep, matAnodized, false);
        mb.addSmoothFilletStrip(
          auxWellInnerLoop, yWellBevelBot, 0.42, mixRgb(colInner, wellBevelCol, 0.45),
          auxWellOuterLoop, CASE_STEP_Y, 0.82, wellBevelCol,
          matWellEdge, true, 0.00, 0.32
        );
        mb.addLoopWallStrip(auxWellInnerLoop, PLATE_Y, auxWellInnerLoop, yWellBevelBot, 0.04, colInner, matAnodized, true, 0.0);
        mb.addLoopCap(auxWellInnerLoop, PLATE_Y, colPlate, matPlate, false);

        /* 3D. Aux pad top-bezel CNC laser-etched micro badge: AUX-06 (co-orbits with aux pad) */
        addLaserEtchedText(
          'AUX-06',
          AUX_CENTER_X + 0.43, 0.535, CASE_Y_TOP + 0.0032,
          0.102, 0.130, 0.046, 0.024,
          laserInkCol, matLaserEtch
        );

        /* 3E. Aux pad underbody static inlaid PVD mirror prism weight (uploaded once in static chassisGpu) */
        var abx0 = 10.62, abx1 = 11.80;
        var abz0 = 1.46, abz1 = 3.42;
        var abBev = 0.09;
        var abix0 = abx0 + abBev, abix1 = abx1 - abBev;
        var abiz0 = abz0 + abBev, abiz1 = abz1 - abBev;
        var abySeat = CASE_Y_BOT + 0.016;
        var abyEdge = CASE_Y_BOT - 0.012;
        var abyApex = CASE_Y_BOT - 0.026;
        var abcx = (abx0 + abx1) * 0.5;
        var abcz0 = 2.02, abcz1 = 2.86;

        mb.addQuad(
          [abx0, abySeat, abz1], [abix0, abyEdge, abiz1], [abix1, abyEdge, abiz1], [abx1, abySeat, abz1],
          [0.0, -0.71, 0.70], bwBevelSouth, matPvdFacet,
          [0.96, 0.05], [0.96, 0.10], [0.96, 0.25], [0.96, 0.30]
        );
        mb.addQuad(
          [abx1, abySeat, abz0], [abix1, abyEdge, abiz0], [abix0, abyEdge, abiz0], [abx0, abySeat, abz0],
          [0.0, -0.71, -0.70], bwBevelNorth, matPvdFacet,
          [0.96, 0.55], [0.96, 0.60], [0.96, 0.75], [0.96, 0.80]
        );
        mb.addQuad(
          [abx0, abySeat, abz0], [abix0, abyEdge, abiz0], [abix0, abyEdge, abiz1], [abx0, abySeat, abz1],
          [-0.70, -0.71, 0.0], bwBevelLeft, matPvdFacet,
          [0.96, 0.80], [0.96, 0.85], [0.96, 0.95], [0.96, 1.00]
        );
        mb.addQuad(
          [abx1, abySeat, abz1], [abix1, abyEdge, abiz1], [abix1, abyEdge, abiz0], [abx1, abySeat, abz0],
          [0.70, -0.71, 0.0], bwBevelRight, matPvdFacet,
          [0.96, 0.30], [0.96, 0.35], [0.96, 0.45], [0.96, 0.50]
        );
        mb.addQuad(
          [abix0, abyEdge, abiz1], [abcx, abyApex, abcz1], [abcx, abyApex, abcz1], [abix1, abyEdge, abiz1],
          [0.0, -0.985, 0.17], bwFacetS, matPvdCrown,
          [0.24, 0.10], [0.58, 0.50], [0.58, 0.50], [0.24, 0.30]
        );
        mb.addQuad(
          [abix1, abyEdge, abiz0], [abcx, abyApex, abcz0], [abcx, abyApex, abcz0], [abix0, abyEdge, abiz0],
          [0.0, -0.985, -0.17], bwFacetN, matPvdCrown,
          [0.24, 0.60], [0.58, 0.50], [0.58, 0.50], [0.24, 0.80]
        );
        mb.addQuad(
          [abix0, abyEdge, abiz0], [abcx, abyApex, abcz0], [abcx, abyApex, abcz1], [abix0, abyEdge, abiz1],
          [-0.17, -0.985, 0.0], bwFacetW, matPvdCrown,
          [0.24, 0.75], [0.58, 0.35], [0.58, 0.65], [0.24, 0.95]
        );
        mb.addQuad(
          [abix1, abyEdge, abiz1], [abcx, abyApex, abcz1], [abcx, abyApex, abcz0], [abix1, abyEdge, abiz0],
          [0.17, -0.985, 0.0], bwFacetE, matPvdCrown,
          [0.24, 0.25], [0.58, 0.65], [0.58, 0.35], [0.24, 0.45]
        );
      }

      var totalIndexCount = mb.getIndexCount();
      var builtChassis = mb.build({
        mainIndexCount: mainIndexCount,
        auxIndexCount: totalIndexCount - mainIndexCount,
      });
      if (_cachedChassisMeshMap.size >= 8) {
        var firstChKey = _cachedChassisMeshMap.keys().next().value;
        _cachedChassisMeshMap.delete(firstChKey);
      }
      _cachedChassisMeshMap.set(chCacheKey, builtChassis);
      return builtChassis;
    }

    /**
     * Builds V8 macro 5-pin condenser-lens mechanical switch inside the active levitated socket (buildActiveSwitchMesh):
     * Supports effort-switch energyPulse brightening of the south-facing convex LED condenser lens
     */
    function buildActiveSwitchMesh(mb, switchInfo, palette, ambientMul, energyPulse) {
      var sx = switchInfo.x;
      var sz = switchInfo.z;
      var stemRgb = switchInfo.stemRgb;
      var ledRgb = switchInfo.ledRgb;
      var lift = clamp(switchInfo.lift, 0, 1);
      var pulseBoost = 1.0 + clamp(Number(energyPulse) || 0, 0, 1.5) * 0.72;

      var botHousingRgb = palette.isLight ? [0.16, 0.18, 0.22] : [0.10, 0.12, 0.15];
      var pcBaseRgb = palette.isLight ? [0.40, 0.45, 0.54] : [0.26, 0.31, 0.39];
      var goldRgb = [0.92, 0.74, 0.30];
      var matHousingBase = [0.50, 0.14, 0.0, 6];
      var matGoldLeaf = [0.14, 0.96, 0.02, 1];
      var matPomStem = [0.22, 0.06, 0.02, 6];
      var matFrostedPc = [0.18, 0.06, 0.0, 5];

      var ledActive = ambientMul > 0.01 && lift > 0.03;
      var glowStrength = ledActive ? ambientMul * smoothstepScalar(0.02, 0.45, lift) * pulseBoost : 0.0;
      var litPcRgb = ledActive ? mixRgb(pcBaseRgb, ledRgb, clamp(0.22 * glowStrength, 0, 0.52)) : pcBaseRgb;
      var pcEdgeRgb = mixRgb(litPcRgb, [0.88, 0.93, 0.99], 0.38);

      /* 1. 5-pin switch bottom housing flange + left/right PCB alignment lugs + north metal leaf detail */
      mb.addBox(
        sx - 0.382, PLATE_Y, sz - 0.382,
        sx + 0.382, PLATE_Y + 0.068, sz + 0.382,
        botHousingRgb, shadeRgb(botHousingRgb, 0.78), matHousingBase, null, true
      );
      var lugRgb = shadeRgb(botHousingRgb, 1.32, 0.03);
      mb.addChamferedBlock(
        sx - 0.412, PLATE_Y + 0.015, sz - 0.145,
        sx - 0.346, PLATE_Y + 0.156, sz + 0.145,
        0.016, lugRgb, shadeRgb(lugRgb, 1.25), shadeRgb(lugRgb, 0.85),
        matHousingBase, matHousingBase, true
      );
      mb.addChamferedBlock(
        sx + 0.346, PLATE_Y + 0.015, sz - 0.145,
        sx + 0.412, PLATE_Y + 0.156, sz + 0.145,
        0.016, lugRgb, shadeRgb(lugRgb, 1.25), shadeRgb(lugRgb, 0.85),
        matHousingBase, matHousingBase, true
      );
      mb.addBox(sx - 0.315, PLATE_Y, sz - 0.048, sx - 0.235, PLATE_Y + 0.092, sz + 0.048, shadeRgb(lugRgb, 1.15), null, matHousingBase, null, true);
      mb.addBox(sx + 0.235, PLATE_Y, sz - 0.048, sx + 0.315, PLATE_Y + 0.092, sz + 0.048, shadeRgb(lugRgb, 1.15), null, matHousingBase, null, true);

      mb.addChamferedBlock(
        sx - 0.155, PLATE_Y + 0.070, sz - 0.295,
        sx + 0.165, PLATE_Y + 0.228, sz - 0.192,
        0.020, goldRgb, [1.0, 0.92, 0.62], shadeRgb(goldRgb, 0.80),
        matGoldLeaf, matGoldLeaf, true
      );

      /* 2. Translucent frosted switch top housing (tapered bevel wings + side latch tabs) */
      var hy0 = PLATE_Y + 0.068;
      var hyMid = PLATE_Y + 0.168;
      var hyTop = PLATE_Y + 0.252;
      mb.addChamferedBlock(
        sx - 0.352, hy0, sz - 0.348,
        sx - 0.194, hyTop, sz + 0.342,
        0.036, litPcRgb, pcEdgeRgb, shadeRgb(litPcRgb, 0.86),
        matFrostedPc, matFrostedPc, true
      );
      mb.addChamferedBlock(
        sx + 0.194, hy0, sz - 0.348,
        sx + 0.352, hyTop, sz + 0.342,
        0.036, litPcRgb, pcEdgeRgb, shadeRgb(litPcRgb, 0.86),
        matFrostedPc, matFrostedPc, true
      );
      mb.addChamferedBlock(
        sx - 0.396, hy0 + 0.012, sz - 0.112,
        sx - 0.342, hyMid + 0.028, sz + 0.112,
        0.015, shadeRgb(litPcRgb, 1.06), pcEdgeRgb, shadeRgb(litPcRgb, 0.84),
        matFrostedPc, matFrostedPc, true
      );
      mb.addChamferedBlock(
        sx + 0.342, hy0 + 0.012, sz - 0.112,
        sx + 0.396, hyMid + 0.028, sz + 0.112,
        0.015, shadeRgb(litPcRgb, 1.06), pcEdgeRgb, shadeRgb(litPcRgb, 0.84),
        matFrostedPc, matFrostedPc, true
      );
      mb.addChamferedBlock(
        sx - 0.206, hy0, sz - 0.352,
        sx + 0.206, hyTop - 0.014, sz - 0.196,
        0.028, litPcRgb, pcEdgeRgb, shadeRgb(litPcRgb, 0.86),
        matFrostedPc, matFrostedPc, true
      );
      mb.addChamferedBlock(
        sx - 0.206, hy0, sz + 0.180,
        sx + 0.206, PLATE_Y + 0.202, sz + 0.348,
        0.020, litPcRgb, pcEdgeRgb, shadeRgb(litPcRgb, 0.86),
        matFrostedPc, matFrostedPc, true
      );

      mb.addBox(
        sx - 0.194, PLATE_Y + 0.070, sz - 0.196,
        sx + 0.194, PLATE_Y + 0.238, sz + 0.182,
        [0.06, 0.07, 0.09], [0.05, 0.06, 0.08], [0.52, 0.10, 0, 6], null, true
      );

      /* 3. South-facing clear convex LED condenser lens (8x5 smooth spherical cap mesh) */
      var lensXHalf = 0.148;
      var lensZHalf = 0.062;
      var lensCz = sz + 0.252;
      var lensBaseY = PLATE_Y + 0.198;
      var lensCrownH = 0.078;
      var lensCols = 8;
      var lensRows = 5;
      var lensCoreCol = ledActive ? mixRgb(ledRgb, [1.0, 0.99, 0.97], 0.34) : shadeRgb(pcBaseRgb, 1.15);
      var lensRimCol = ledActive ? shadeRgb(ledRgb, 0.92, 0.04) : pcBaseRgb;

      mb.addChamferedBlock(
        sx - lensXHalf - 0.014, PLATE_Y + 0.176, lensCz - lensZHalf - 0.014,
        sx + lensXHalf + 0.014, lensBaseY + 0.008, lensCz + lensZHalf + 0.014,
        0.012, litPcRgb, pcEdgeRgb, shadeRgb(litPcRgb, 0.85),
        matFrostedPc, matFrostedPc, true
      );

      for (var lr2 = 0; lr2 < lensRows; lr2++) {
        for (var lc2 = 0; lc2 < lensCols; lc2++) {
          var ux0 = (lc2 / lensCols) * 2.0 - 1.0;
          var ux1 = ((lc2 + 1) / lensCols) * 2.0 - 1.0;
          var vz0 = (lr2 / lensRows) * 2.0 - 1.0;
          var vz1 = ((lr2 + 1) / lensRows) * 2.0 - 1.0;
          var uMid = (ux0 + ux1) * 0.5;
          var vMid = (vz0 + vz1) * 0.5;

          var evalLensPt = function (uVal, vVal) {
            var rq = Math.min(1.0, uVal * uVal * 0.86 + vVal * vVal * 0.86 + uVal * uVal * vVal * vVal * 0.14);
            var dp = (Math.sqrt(Math.max(0.0, 1.0 - rq * 0.88)) - Math.sqrt(0.12)) / (1.0 - Math.sqrt(0.12));
            return [
              sx + uVal * lensXHalf * (1.0 - 0.08 * vVal * vVal),
              lensBaseY + dp * lensCrownH,
              lensCz + vVal * lensZHalf * (1.0 - 0.08 * uVal * uVal),
              dp,
            ];
          };
          var lp00 = evalLensPt(ux0, vz0);
          var lp10 = evalLensPt(ux1, vz0);
          var lp11 = evalLensPt(ux1, vz1);
          var lp01 = evalLensPt(ux0, vz1);
          var dpAvg = (lp00[3] + lp10[3] + lp11[3] + lp01[3]) * 0.25;
          var focusT = Math.pow(clamp(dpAvg, 0, 1), 1.6);
          var patchCol = mixRgb(lensRimCol, lensCoreCol, focusT);
          var patchEmis = ledActive ? (0.16 + 0.66 * focusT) * glowStrength : 0.0;
          mb.addQuad(
            [lp00[0], lp00[1], lp00[2]],
            [lp01[0], lp01[1], lp01[2]],
            [lp11[0], lp11[1], lp11[2]],
            [lp10[0], lp10[1], lp10[2]],
            [uMid * 0.64, 1.0, vMid * 0.76],
            patchCol,
            [0.06, 0.08, patchEmis, 2]
          );
        }
      }

      /* 4. Central V14 dual-tone faceted crystal switch stem + box shroud + cross [+] (chroma-preserving against blowout) */
      var stemTopSpec = switchInfo.stemTopRgb || ledRgb;
      var stemBot = PLATE_Y + 0.236;
      var boxWallTop = PLATE_Y + 0.456;
      var crossTop = PLATE_Y + 0.514;
      var crystalEmis = ledActive ? clamp((0.36 + 0.42 * glowStrength), 0.18, 0.94) : 0.04;
      var matCrystalStem = [0.04, 0.10, crystalEmis, 2];
      var matCrystalFacet = [0.06, 0.12, crystalEmis * 0.84, 2];
      var stemBaseCol = mixRgb(stemRgb, [0.92, 0.96, 1.0], 0.04);
      var stemMidCol = mixRgb(mixRgb(stemRgb, stemTopSpec, 0.52), [1.0, 1.0, 1.0], 0.08);
      var stemTopCol = mixRgb(stemTopSpec, [1.0, 1.0, 1.0], 0.14);
      var stemChamferCol = mixRgb(stemTopSpec, [1.0, 1.0, 1.0], 0.26);
      var stemSideCol = mixRgb(stemBaseCol, stemMidCol, 0.46);
      var stemWallCol = mixRgb(stemMidCol, stemTopCol, 0.54);

      /* Translucent 12-facet beveled crystal base collar refracting dual-tone spectrum upward */
      var crBaseLoop = sampleCircleLoop(sx, sz, 0.285, 12, Math.PI / 12);
      var crMidLoop = sampleCircleLoop(sx, sz, 0.232, 12, Math.PI / 12);
      var crCrownLoop = sampleCircleLoop(sx, sz, 0.194, 12, Math.PI / 12);
      mb.addSmoothFilletStrip(
        crBaseLoop, PLATE_Y + 0.215, 0.34, stemBaseCol,
        crMidLoop, PLATE_Y + 0.330, 0.62, stemMidCol,
        matCrystalFacet, false, 0.68, 0.96
      );
      mb.addSmoothFilletStrip(
        crMidLoop, PLATE_Y + 0.330, 0.66, stemWallCol,
        crCrownLoop, PLATE_Y + 0.415, 0.88, stemTopCol,
        matCrystalStem, false, 0.82, 0.98
      );

      var bwOuter = 0.178;
      var bwThick = 0.028;
      mb.addChamferedBlock(
        sx - bwOuter, stemBot, sz + bwOuter - bwThick,
        sx + bwOuter, boxWallTop, sz + bwOuter,
        0.009, stemWallCol, stemChamferCol, stemSideCol, matCrystalFacet, matCrystalStem, true
      );
      mb.addChamferedBlock(
        sx - bwOuter, stemBot, sz - bwOuter,
        sx + bwOuter, boxWallTop, sz - bwOuter + bwThick,
        0.009, stemWallCol, stemChamferCol, stemSideCol, matCrystalFacet, matCrystalStem, true
      );
      mb.addChamferedBlock(
        sx - bwOuter, stemBot, sz - bwOuter + bwThick,
        sx - bwOuter + bwThick, boxWallTop, sz + bwOuter - bwThick,
        0.009, stemWallCol, stemChamferCol, stemSideCol, matCrystalFacet, matCrystalStem, true
      );
      mb.addChamferedBlock(
        sx + bwOuter - bwThick, stemBot, sz - bwOuter + bwThick,
        sx + bwOuter, boxWallTop, sz + bwOuter - bwThick,
        0.009, stemWallCol, stemChamferCol, stemSideCol, matCrystalFacet, matCrystalStem, true
      );

      mb.addChamferedBlock(
        sx - 0.130, stemBot, sz - 0.038,
        sx + 0.130, crossTop, sz + 0.038,
        0.012, stemTopCol, stemChamferCol, stemSideCol, matCrystalStem, matCrystalStem, true
      );
      mb.addChamferedBlock(
        sx - 0.038, stemBot, sz - 0.130,
        sx + 0.038, crossTop, sz + 0.130,
        0.012, stemTopCol, stemChamferCol, stemSideCol, matCrystalStem, matCrystalStem, true
      );
    }

    /**
     * Helper ring sampler: generates circular / diamond-knurled polygon loops with winding matching sampleG2RectLoop
     */
    function sampleCircleLoop(cx, cz, radiusOrFn, segs, phaseOffset) {
      var pts = [];
      var ph = phaseOffset || 0;
      for (var i = 0; i < segs; i++) {
        var ang = ph + (i / segs) * TWO_PI;
        var ca = Math.cos(ang);
        var sa = Math.sin(ang);
        var r = typeof radiusOrFn === 'function' ? radiusOrFn(i, ang) : radiusOrFn;
        pts.push({
          x: cx + ca * r,
          z: cz + sa * r,
          nx: ca,
          nz: sa,
        });
      }
      return pts;
    }

    /**
     * Helper rotated micro-engraved bar (for knob indicator notch, 3D cross glyph, reticle & parallel prism grooves)
     */
    function addRotatedChamferBar(mb, cx, cz, y0, y1, halfLen, halfWid, angleRad, bevel, colTop, colChamfer, colSide, matBody, matChamfer, rimMask) {
      var ca = Math.cos(angleRad);
      var sa = Math.sin(angleRad);
      var rm = rimMask || 0;
      function rotPt(lx, y, lz) {
        return [cx + lx * ca - lz * sa, y, cz + lx * sa + lz * ca];
      }
      function rotN(nx, ny, nz) {
        return [nx * ca - nz * sa, ny, nx * sa + nz * ca];
      }
      var bx = Math.max(0.002, halfLen - bevel);
      var bz = Math.max(0.002, halfWid - bevel);
      var yb = y1 - bevel * 0.82;
      var uvTop = [rm * 0.35, 0.25];
      var uvBev = [rm, 0.50];

      mb.addQuad(
        rotPt(-bx, y1, bz), rotPt(bx, y1, bz), rotPt(bx, y1, -bz), rotPt(-bx, y1, -bz),
        [0, 1, 0], colTop, matBody, uvTop, uvTop, uvTop, uvTop
      );
      mb.addQuad(
        rotPt(-halfLen, yb, halfWid), rotPt(halfLen, yb, halfWid), rotPt(bx, y1, bz), rotPt(-bx, y1, bz),
        rotN(0, 0.72, 0.70), colChamfer, matChamfer, uvBev, uvBev, uvBev, uvBev
      );
      mb.addQuad(
        rotPt(halfLen, yb, -halfWid), rotPt(-halfLen, yb, -halfWid), rotPt(-bx, y1, -bz), rotPt(bx, y1, -bz),
        rotN(0, 0.72, -0.70), colChamfer, matChamfer, uvBev, uvBev, uvBev, uvBev
      );
      mb.addQuad(
        rotPt(halfLen, yb, halfWid), rotPt(halfLen, yb, -halfWid), rotPt(bx, y1, -bz), rotPt(bx, y1, bz),
        rotN(0.70, 0.72, 0), colChamfer, matChamfer, uvBev, uvBev, uvBev, uvBev
      );
      mb.addQuad(
        rotPt(-halfLen, yb, -halfWid), rotPt(-halfLen, yb, halfWid), rotPt(-bx, y1, bz), rotPt(-bx, y1, -bz),
        rotN(-0.70, 0.72, 0), colChamfer, matChamfer, uvBev, uvBev, uvBev, uvBev
      );
      mb.addQuad(
        rotPt(-halfLen, y0, halfWid), rotPt(halfLen, y0, halfWid), rotPt(halfLen, yb, halfWid), rotPt(-halfLen, yb, halfWid),
        rotN(0, 0, 1), colSide, matBody
      );
      mb.addQuad(
        rotPt(halfLen, y0, -halfWid), rotPt(-halfLen, y0, -halfWid), rotPt(-halfLen, yb, -halfWid), rotPt(halfLen, yb, -halfWid),
        rotN(0, 0, -1), colSide, matBody
      );
      mb.addQuad(
        rotPt(halfLen, y0, halfWid), rotPt(halfLen, y0, -halfWid), rotPt(halfLen, yb, -halfWid), rotPt(halfLen, yb, halfWid),
        rotN(1, 0, 0), colSide, matBody
      );
      mb.addQuad(
        rotPt(-halfLen, y0, -halfWid), rotPt(-halfLen, y0, halfWid), rotPt(-halfLen, yb, halfWid), rotPt(-halfLen, yb, -halfWid),
        rotN(-1, 0, 0), colSide, matBody
      );
    }

    /**
     * Left 1U cutout (col=2, row=1 => x=-7.5, z=-2.56):
     * Builds 1U CNC brushed-titanium artisan metal prism keycap (action: 'prism-wave')
     * - Anodized magnetic socket shroud sealing the plate opening
     * - 4-slope CNC titanium skirt + recessed octagonal top + 3D octahedral pyramid prism relief facets
     */
    function buildArtisanPrismKeyMesh(mb, palette, hwCtrl, ambientMul) {
      var cx = ARTISAN_WAVE_X;
      var cz = ROW1_Z;
      var press = hwCtrl ? clamp(hwCtrl.prismPress || 0, 0, 1) : 0;
      var hover = hwCtrl ? clamp(hwCtrl.prismHover || 0, 0, 1) : 0;
      var waveDip = hwCtrl ? (hwCtrl.prismWaveDip || 0) : 0;

      var baseCol = hexToRgb01(palette.artisanMetal || palette.hwDeckPanel || palette.caseChamfer);
      var rimCol = hexToRgb01(palette.artisanRim || palette.caseChamfer);
      var collarCol = hexToRgb01(palette.hwDeckBody || palette.caseStep || palette.caseBody);
      var hoverGain = 1.0 + hover * (palette.isLight ? 0.08 : 0.16);
      var tiBody = shadeRgb(baseCol, hoverGain, hover * 0.018);
      var tiChamfer = mixRgb(tiBody, rimCol, palette.isLight ? 0.56 : 0.62);
      var tiDark = shadeRgb(tiBody, 0.72);

      var matCollar = [palette.isLight ? 0.22 : 0.25, 0.90, 0.0, 0];
      var matTiSkirt = [palette.isLight ? 0.14 : 0.15, 0.95, hover * 0.04 * ambientMul, 1];
      var matTiFacet = [palette.isLight ? 0.075 : 0.085, 0.98, (0.02 + hover * 0.11) * ambientMul, 1];

      /* 1. Lower CNC magnetic metal shroud sealing col=2, row=1 socket floor */
      var collarBot = sampleG2RectLoop(cx - 0.485, cz - 0.485, cx + 0.485, cz + 0.485, 0.085, 6, 2.2);
      var collarTop = sampleG2RectLoop(cx - 0.472, cz - 0.472, cx + 0.472, cz + 0.472, 0.078, 6, 2.2);
      mb.addSmoothFilletStrip(
        collarBot, PLATE_Y, 0.15, shadeRgb(collarCol, 0.75),
        collarTop, 0.032, 0.65, collarCol,
        matCollar, false, 0.0, 0.28
      );
      mb.addLoopCap(collarTop, 0.032, shadeRgb(collarCol, 0.68), matCollar, false);

      /* 2. 1U titanium artisan keycap 4-slope tapered skirt (aligned to Row 1 R1 height, supports hover/press travel) */
      var y0 = CAP_Y_BASE + 0.018 + hover * 0.030 - press * 0.105 + waveDip;
      var yMid = y0 + 0.48;
      var yShoulder = y0 + 0.565;
      var yWell = y0 + 0.538;

      var loopBase = sampleG2RectLoop(cx - 0.458, cz - 0.458, cx + 0.458, cz + 0.458, 0.066, 8, 2.22);
      var loopMid = sampleG2RectLoop(cx - 0.382, cz - 0.390, cx + 0.382, cz + 0.374, 0.068, 8, 2.22);
      var loopTopOut = sampleG2RectLoop(cx - 0.354, cz - 0.362, cx + 0.354, cz + 0.346, 0.068, 8, 2.22);
      var loopTopIn = sampleG2RectLoop(cx - 0.288, cz - 0.296, cx + 0.288, cz + 0.280, 0.056, 8, 2.18);

      mb.addSmoothFilletStrip(
        loopBase, y0, 0.19, tiDark,
        loopMid, yMid, 0.22, tiBody,
        matTiSkirt, false, 0.08, 0.24
      );
      mb.addSmoothFilletStrip(
        loopMid, yMid, 0.58, mixRgb(tiBody, tiChamfer, 0.55),
        loopTopOut, yShoulder, 0.82, tiChamfer,
        matTiFacet, false, 0.78, 0.94
      );
      mb.addSmoothFilletStrip(
        loopTopIn, yWell, 0.62, tiDark,
        loopTopOut, yShoulder, 0.84, tiChamfer,
        matTiFacet, true, 0.42, 0.88
      );
      mb.addLoopCap(loopTopIn, yWell, shadeRgb(tiBody, 0.82), matTiSkirt, false);

      /* 3. Center top crown: 8-facet octahedral pyramid prism relief with flat-faceted specular fire */
      var pCz = cz - 0.008;
      var octR = 0.228;
      var octBaseY = yWell - 0.002;
      var octApexY = y0 + 0.652;
      var octRimMask = clamp(0.68 + hover * 0.28, 0.0, 0.99);
      for (var fi = 0; fi < 8; fi++) {
        var a0 = (fi / 8) * TWO_PI + Math.PI * 0.125;
        var a1 = ((fi + 1) / 8) * TWO_PI + Math.PI * 0.125;
        var aMid = (a0 + a1) * 0.5;
        var xA = cx + Math.cos(a0) * octR;
        var zA = pCz + Math.sin(a0) * octR;
        var xB = cx + Math.cos(a1) * octR;
        var zB = pCz + Math.sin(a1) * octR;

        var fnx = Math.cos(aMid) * 0.54;
        var fny = 0.84;
        var fnz = Math.sin(aMid) * 0.54;
        var lightBias = clamp(fnx * -0.45 + fnz * 0.48, -1.0, 1.0);
        var facetCol = lightBias >= 0
          ? mixRgb(tiBody, rimCol, 0.30 + lightBias * 0.48)
          : shadeRgb(tiBody, 0.72 + (1.0 + lightBias) * 0.22);

        var vApex = mb.pushVertex(
          cx, octApexY, pCz,
          fnx * 0.65, 0.92, fnz * 0.65,
          rimCol[0], rimCol[1], rimCol[2],
          matTiFacet[0], matTiFacet[1], matTiFacet[2], matTiFacet[3],
          0.96, fi / 8
        );
        var vB = mb.pushVertex(
          xB, octBaseY, zB,
          fnx, fny, fnz,
          facetCol[0], facetCol[1], facetCol[2],
          matTiFacet[0], matTiFacet[1], matTiFacet[2], matTiFacet[3],
          octRimMask, (fi + 1) / 8
        );
        var vA = mb.pushVertex(
          xA, octBaseY, zA,
          fnx, fny, fnz,
          facetCol[0], facetCol[1], facetCol[2],
          matTiFacet[0], matTiFacet[1], matTiFacet[2], matTiFacet[3],
          octRimMask, fi / 8
        );
        mb.pushTri(vApex, vB, vA);
      }
    }

    /**
     * Right 5U cutout (col=13..17, row=1 => x in [3.0, 8.0], cx=5.5, z=-2.56):
     * Builds flush-mounted 5U PVD heavy-metal Hardware Control Deck:
     *   1) x in [3.08, 4.84]: PVD engraved nameplate zone (dual parallel prism grooves + diamond micro-emblem)
     *   2) (cx=5.36, z=-2.56): Reset-view tactile round button (cyan-white indicator ring when orbited)
     *   3) (cx=6.38, z=-2.56): CNC knurled rotary encoder knob (mute/effort wheel + pinhole indicator LEDs)
     *   4) (cx=7.40, z=-2.56): Close tactile rounded square button (3D engraved X highlight)
     */
    function buildHardwareControlDeckMesh(mb, palette, hwCtrl, ambientMul) {
      var deckCol = hexToRgb01(palette.hwDeckBody || palette.caseStep || palette.caseBody);
      var panelCol = hexToRgb01(palette.hwDeckPanel || palette.artisanMetal || palette.caseBody);
      var rimCol = hexToRgb01(palette.hwDeckRim || palette.caseChamfer);
      var grooveDark = shadeRgb(deckCol, palette.isLight ? 0.58 : 0.42);
      var deckChamferCol = mixRgb(deckCol, rimCol, palette.isLight ? 0.48 : 0.54);
      var btnChamferCol = mixRgb(panelCol, rimCol, palette.isLight ? 0.56 : 0.64);
      var etchInkCol = palette.isLight ? [0.24, 0.28, 0.35] : rimCol;
      var etchBevelCol = palette.isLight ? [0.42, 0.47, 0.55] : rimCol;

      var matDeckAnod = [palette.isLight ? 0.20 : 0.22, 0.91, 0.0, 0];
      var matDeckPvd = [palette.isLight ? 0.09 : 0.11, 0.96, 0.0, 1];
      var matKnobKnurl = [palette.isLight ? 0.11 : 0.12, 0.97, 0.0, 1];

      var resetPress = hwCtrl ? clamp(hwCtrl.resetPress || 0, 0, 1) : 0;
      var resetHover = hwCtrl ? clamp(hwCtrl.resetHover || 0, 0, 1) : 0;
      var mutePress = hwCtrl ? clamp(hwCtrl.mutePress || 0, 0, 1) : 0;
      var muteHover = hwCtrl ? clamp(hwCtrl.muteHover || 0, 0, 1) : 0;
      var closePress = hwCtrl ? clamp(hwCtrl.closePress || 0, 0, 1) : 0;
      var closeHover = hwCtrl ? clamp(hwCtrl.closeHover || 0, 0, 1) : 0;
      var knobAngle = hwCtrl ? (hwCtrl.knobAngle || 0) : -0.38;
      var isMuted = Boolean(hwCtrl && hwCtrl.muted);
      var rotMag = hwCtrl ? (hwCtrl.orbitMag || 0) : 0;

      /* 0. Flush 5U solid metal deck base filling x in [2.99, 8.01], z in [-3.03, -2.07] */
      var yDeckShoulder = HW_DECK_Y_TOP - 0.026;
      var deckLoopBot = sampleG2RectLoop(HW_DECK_X0, HW_DECK_Z0, HW_DECK_X1, HW_DECK_Z1, 0.125, 10, 2.18);
      var deckLoopMid = sampleG2RectLoop(HW_DECK_X0 + 0.008, HW_DECK_Z0 + 0.008, HW_DECK_X1 - 0.008, HW_DECK_Z1 - 0.008, 0.120, 10, 2.18);
      var deckLoopTop = sampleG2RectLoop(HW_DECK_X0 + 0.036, HW_DECK_Z0 + 0.036, HW_DECK_X1 - 0.036, HW_DECK_Z1 - 0.036, 0.104, 10, 2.18);

      mb.addSmoothFilletStrip(
        deckLoopBot, PLATE_Y, 0.12, shadeRgb(deckCol, 0.74),
        deckLoopMid, yDeckShoulder, 0.24, deckCol,
        matDeckAnod, false, 0.0, 0.18
      );
      mb.addSmoothFilletStrip(
        deckLoopMid, yDeckShoulder, 0.66, deckChamferCol,
        deckLoopTop, HW_DECK_Y_TOP, 0.84, deckChamferCol,
        matDeckPvd, false, 0.82, 0.88
      );
      mb.addLoopCap(deckLoopTop, HW_DECK_Y_TOP, deckCol, matDeckAnod, false);

      /* 1. Left zone x in [3.08, 4.84]: PVD engraved nameplate (dual parallel prism grooves + 3D diamond emblem) */
      var badgeY = HW_DECK_Y_TOP + 0.020;
      mb.addChamferedBlock(
        3.09, HW_DECK_Y_TOP - 0.002, -2.90,
        4.84, badgeY, -2.22,
        0.022, panelCol, btnChamferCol, shadeRgb(panelCol, 0.82),
        matDeckPvd, matDeckPvd, true
      );
      /* Dual parallel V-cut prism grooves (dark/bright contrast for crisp metallic engraving) */
      var grooveZList = [-2.635, -2.485];
      for (var gi = 0; gi < grooveZList.length; gi++) {
        var gz = grooveZList[gi];
        var gx0 = 3.50, gx1 = 4.68;
        var gw = 0.022;
        var gyTop = badgeY + 0.0015;
        var gyBot = badgeY - 0.012;
        mb.addQuad(
          [gx0, gyTop, gz - gw], [gx0, gyBot, gz], [gx1, gyBot, gz], [gx1, gyTop, gz - gw],
          [0, 0.62, 0.78], mixRgb(panelCol, rimCol, 0.62), matDeckPvd,
          [0.86, 0.15], [0.86, 0.15], [0.86, 0.45], [0.86, 0.45]
        );
        mb.addQuad(
          [gx0, gyBot, gz], [gx0, gyTop, gz + gw], [gx1, gyTop, gz + gw], [gx1, gyBot, gz],
          [0, 0.62, -0.78], grooveDark, matDeckPvd,
          [0.24, 0.55], [0.24, 0.55], [0.24, 0.85], [0.24, 0.85]
        );
      }
      /* Left nameplate 3D micro-engraved diamond prism emblem (cx = 3.30, cz = -2.56) */
      addRotatedChamferBar(
        mb, 3.30, ROW1_Z, badgeY - 0.001, badgeY + 0.022,
        0.084, 0.084, Math.PI * 0.25, 0.018,
        palette.isLight ? etchInkCol : mixRgb(panelCol, rimCol, 0.48), etchBevelCol, shadeRgb(panelCol, 0.76),
        matDeckPvd, matDeckPvd, 0.90
      );

      /* 2. (cx = 5.36, z = -2.56): Reset-view round tactile button (illuminates cyan-white ring when orbited) */
      var rSegs = 24;
      var rotActive = smootherstepScalar(0.015, 0.065, rotMag);
      var haloOnCol = palette.isLight ? [0.22, 0.62, 0.88] : [0.72, 0.92, 1.00];
      var haloIdleCol = shadeRgb(grooveDark, 0.85);
      var haloCol = mixRgb(haloIdleCol, haloOnCol, rotActive);
      var haloEmis = rotActive * (palette.isLight ? 0.52 : 0.78) * Math.max(0.25, ambientMul);
      var matResetHalo = [0.08, 0.16, haloEmis, 2];

      var rOuterWell = sampleCircleLoop(CTRL_RESET_X, ROW1_Z, 0.348, rSegs, 0);
      var rHaloOut = sampleCircleLoop(CTRL_RESET_X, ROW1_Z, 0.324, rSegs, 0);
      var rHaloIn = sampleCircleLoop(CTRL_RESET_X, ROW1_Z, 0.284, rSegs, 0);
      mb.addSmoothFilletStrip(
        rHaloOut, HW_DECK_Y_TOP - 0.012, 0.48, grooveDark,
        rOuterWell, HW_DECK_Y_TOP + 0.004, 0.80, deckChamferCol,
        matDeckPvd, true, 0.32, 0.72
      );
      mb.addPlanarAnnulus(rHaloOut, HW_DECK_Y_TOP - 0.008, rHaloIn, HW_DECK_Y_TOP - 0.008, haloCol, matResetHalo, false);

      var yResetTop = HW_DECK_Y_TOP + 0.125 + resetHover * 0.016 - resetPress * 0.062;
      var yResetDish = yResetTop - 0.018;
      var resetCol = shadeRgb(panelCol, 1.0 + resetHover * 0.14, resetHover * 0.016);
      var matResetBtn = [palette.isLight ? 0.12 : 0.14, 0.95, resetHover * 0.03 * ambientMul, 1];
      var rBtnBase = sampleCircleLoop(CTRL_RESET_X, ROW1_Z, 0.276, rSegs, 0);
      var rBtnRim = sampleCircleLoop(CTRL_RESET_X, ROW1_Z, 0.252, rSegs, 0);
      var rBtnDish = sampleCircleLoop(CTRL_RESET_X, ROW1_Z, 0.175, rSegs, 0);

      mb.addSmoothFilletStrip(
        rBtnBase, HW_DECK_Y_TOP - 0.010, 0.22, shadeRgb(resetCol, 0.76),
        rBtnRim, yResetTop, 0.74, mixRgb(resetCol, rimCol, 0.58),
        matResetBtn, false, 0.25, 0.88
      );
      mb.addSmoothFilletStrip(
        rBtnDish, yResetDish, 0.88, shadeRgb(resetCol, 0.88),
        rBtnRim, yResetTop, 0.96, mixRgb(resetCol, rimCol, 0.42),
        matResetBtn, true, 0.22, 0.74
      );
      mb.addLoopCap(rBtnDish, yResetDish, shadeRgb(resetCol, 0.90), matResetBtn, false);

      /* Reset button top-face micro-engraved reticle cross */
      var reticleBase = palette.isLight ? etchInkCol : mixRgb(resetCol, rimCol, 0.74);
      var reticleCol = rotActive > 0.05 ? mixRgb(reticleBase, haloOnCol, 0.58) : reticleBase;
      var matReticle = [0.09, 0.96, rotActive * 0.18 * ambientMul, 1];
      addRotatedChamferBar(mb, CTRL_RESET_X, ROW1_Z, yResetDish - 0.002, yResetDish + 0.013, 0.115, 0.017, 0.0, 0.006, reticleCol, etchBevelCol, resetCol, matReticle, matReticle, 0.82);
      addRotatedChamferBar(mb, CTRL_RESET_X, ROW1_Z, yResetDish - 0.002, yResetDish + 0.013, 0.017, 0.115, 0.0, 0.006, reticleCol, etchBevelCol, resetCol, matReticle, matReticle, 0.82);

      /* 3. (cx = 6.38, z = -2.56): V13.1 dual-tier 32-tooth diamond-knurled CNC rotary encoder knob (effort wheel + 3 pinhole LEDs) */
      var kSegs = 64; /* 32-tooth staggered diamond knurling (64 crest/valley segments) */
      var yKnobBase = HW_DECK_Y_TOP + 0.018;
      var yKnobTop = HW_DECK_Y_TOP + 0.258 + muteHover * 0.016 - mutePress * 0.052;
      var yKnobShoulder = yKnobTop - 0.026;
      var yKnobMid = (yKnobBase + yKnobShoulder) * 0.5;
      var yKnobWell = yKnobTop - 0.008;
      var knobCol = shadeRgb(panelCol, 1.08 + muteHover * 0.14, muteHover * 0.018);
      var knobToothBright = mixRgb(knobCol, rimCol, palette.isLight ? 0.58 : 0.62);
      var matKnobTop = [palette.isLight ? 0.09 : 0.10, 0.98, muteHover * 0.03 * ambientMul, 1];

      var kSkirtCollar = sampleCircleLoop(CTRL_MUTE_X, ROW1_Z, 0.366, 28, 0);
      var kSkirtInner = sampleCircleLoop(CTRL_MUTE_X, ROW1_Z, 0.334, 28, 0);
      mb.addSmoothFilletStrip(
        kSkirtCollar, HW_DECK_Y_TOP - 0.002, 0.35, shadeRgb(deckCol, 0.78),
        kSkirtInner, HW_DECK_Y_TOP + 0.024, 0.76, deckChamferCol,
        matDeckPvd, false, 0.24, 0.74
      );
      mb.addLoopCap(kSkirtInner, HW_DECK_Y_TOP + 0.024, grooveDark, matDeckAnod, false);

      var knurlRadiusFn = function (idx) {
        return idx % 2 === 0 ? 0.332 : 0.308;
      };
      var halfToothPhase = TWO_PI / kSegs;
      var kKnurlBot = sampleCircleLoop(CTRL_MUTE_X, ROW1_Z, knurlRadiusFn, kSegs, knobAngle);
      var kKnurlMid = sampleCircleLoop(CTRL_MUTE_X, ROW1_Z, knurlRadiusFn, kSegs, knobAngle + halfToothPhase);
      var kKnurlTop = sampleCircleLoop(CTRL_MUTE_X, ROW1_Z, knurlRadiusFn, kSegs, knobAngle);
      var kCapRim = sampleCircleLoop(CTRL_MUTE_X, ROW1_Z, 0.288, kSegs, knobAngle);
      var kCapInner = sampleCircleLoop(CTRL_MUTE_X, ROW1_Z, 0.240, 28, knobAngle);

      /* Dual counter-phased 32-tooth diamond-knurled side walls for crisp macro faceted highlights */
      for (var ki = 0; ki < kSegs; ki++) {
        var kiNext = (ki + 1) % kSegs;
        var pB0 = kKnurlBot[ki];
        var pB1 = kKnurlBot[kiNext];
        var pM1 = kKnurlMid[kiNext];
        var pM0 = kKnurlMid[ki];
        var pT1 = kKnurlTop[kiNext];
        var pT0 = kKnurlTop[ki];
        var dxK = pB1.x - pB0.x;
        var dzK = pB1.z - pB0.z;
        var fnxK = dzK;
        var fnzK = -dxK;
        var isLeading = ki % 2 === 0;
        var toothColLo = isLeading ? knobToothBright : shadeRgb(knobCol, 0.62);
        var toothColHi = isLeading ? shadeRgb(knobCol, 0.66) : knobToothBright;
        mb.addQuad(
          [pB0.x, yKnobBase, pB0.z],
          [pB1.x, yKnobBase, pB1.z],
          [pM1.x, yKnobMid, pM1.z],
          [pM0.x, yKnobMid, pM0.z],
          [fnxK, -0.18, fnzK],
          toothColLo,
          matKnobKnurl,
          [0.52, ki / kSegs], [0.52, kiNext / kSegs], [0.80, kiNext / kSegs], [0.80, ki / kSegs]
        );
        mb.addQuad(
          [pM0.x, yKnobMid, pM0.z],
          [pM1.x, yKnobMid, pM1.z],
          [pT1.x, yKnobShoulder, pT1.z],
          [pT0.x, yKnobShoulder, pT0.z],
          [fnxK, 0.22, fnzK],
          toothColHi,
          matKnobKnurl,
          [0.80, ki / kSegs], [0.80, kiNext / kSegs], [0.56, kiNext / kSegs], [0.56, ki / kSegs]
        );
      }
      mb.addSmoothFilletStrip(
        kKnurlTop, yKnobShoulder, 0.64, knobToothBright,
        kCapRim, yKnobTop, 0.90, mixRgb(knobCol, rimCol, 0.72),
        matKnobTop, false, 0.84, 0.98
      );
      mb.addLoopCap(kCapRim, yKnobTop, mixRgb(knobCol, rimCol, 0.28), matKnobTop, false);
      mb.addLoopCap(kCapInner, yKnobWell + 0.010, mixRgb(knobCol, rimCol, 0.16), matKnobTop, false);

      /* Top indicator notch rotating live with knobAngle */
      var notchR = 0.140;
      var notchCx = CTRL_MUTE_X + Math.sin(knobAngle) * notchR;
      var notchCz = ROW1_Z - Math.cos(knobAngle) * notchR;
      var notchCol = palette.isLight
        ? (isMuted ? [0.46, 0.50, 0.57] : etchInkCol)
        : (isMuted ? shadeRgb(rimCol, 0.64) : mixRgb(rimCol, [1.0, 1.0, 1.0], 0.55));
      addRotatedChamferBar(
        mb, notchCx, notchCz, yKnobTop - 0.002, yKnobTop + 0.015,
        0.022, 0.098, -knobAngle, 0.007,
        notchCol, palette.isLight ? etchBevelCol : [1.0, 1.0, 1.0], knobCol,
        matKnobTop, matKnobTop, 0.94
      );

      /* V13.1 3 micro pinhole indicator LEDs beside knob (Low=1 / Med=2 / High=3 / XHigh=3 bright; dimmed when muted) */
      var effTierLed = hwCtrl && Number.isFinite(Number(hwCtrl.effortTier)) ? clamp(Math.round(Number(hwCtrl.effortTier)), 0, 3) : 2;
      var litPinholeCount = isMuted ? 0 : Math.min(3, effTierLed + 1);
      var ledOnRgb = hexToRgb01(palette.statusLedOn || '#EEF4FC');
      var ledOffRgb = palette.isLight ? [0.46, 0.50, 0.56] : [0.15, 0.17, 0.21];
      var pinholeZs = [ROW1_Z - 0.155, ROW1_Z, ROW1_Z + 0.155];
      var pinholeX = 6.845;
      for (var pli = 0; pli < 3; pli++) {
        var phLit = pli < litPinholeCount;
        var phRgb = phLit ? ledOnRgb : ledOffRgb;
        var phBoost = effTierLed >= 3 ? 1.18 : 1.0;
        var phEmis = phLit ? (palette.isLight ? 0.68 : 0.96) * phBoost * Math.max(0.32, ambientMul) : 0.0;
        var matPhLens = phLit ? [0.05, 0.08, phEmis, 2] : [0.28, 0.72, 0.0, 1];
        var phZ = pinholeZs[pli];
        var phBezelOut = sampleCircleLoop(pinholeX, phZ, 0.044, 12, 0);
        var phBezelIn = sampleCircleLoop(pinholeX, phZ, 0.030, 12, 0);
        var phCrown = sampleCircleLoop(pinholeX, phZ, 0.015, 12, 0);
        mb.addSmoothFilletStrip(
          phBezelOut, HW_DECK_Y_TOP, 0.45, deckCol,
          phBezelIn, HW_DECK_Y_TOP + 0.010, 0.78, deckChamferCol,
          matDeckPvd, false, 0.20, 0.62
        );
        mb.addSmoothFilletStrip(
          phBezelIn, HW_DECK_Y_TOP + 0.008, 0.58, shadeRgb(phRgb, 0.85),
          phCrown, HW_DECK_Y_TOP + 0.024, 0.90, mixRgb(phRgb, [1.0, 1.0, 1.0], phLit ? 0.42 : 0.04),
          matPhLens, false, 0.0, 0.0
        );
        mb.addLoopCap(phCrown, HW_DECK_Y_TOP + 0.027, mixRgb(phRgb, [1.0, 1.0, 1.0], phLit ? 0.50 : 0.04), matPhLens, false);
      }

      /* 4. (cx = 7.40, z = -2.56): Close tactile anodized rounded square button (action: 'close', top 3D engraved X) */
      var clWellOut = sampleG2RectLoop(CTRL_CLOSE_X - 0.345, ROW1_Z - 0.345, CTRL_CLOSE_X + 0.345, ROW1_Z + 0.345, 0.115, 6, 2.2);
      var clWellIn = sampleG2RectLoop(CTRL_CLOSE_X - 0.315, ROW1_Z - 0.315, CTRL_CLOSE_X + 0.315, ROW1_Z + 0.315, 0.102, 6, 2.2);
      mb.addSmoothFilletStrip(
        clWellIn, HW_DECK_Y_TOP - 0.014, 0.45, grooveDark,
        clWellOut, HW_DECK_Y_TOP + 0.004, 0.80, deckChamferCol,
        matDeckPvd, true, 0.30, 0.72
      );
      mb.addLoopCap(clWellIn, HW_DECK_Y_TOP - 0.014, grooveDark, matDeckAnod, false);

      var yCloseTop = HW_DECK_Y_TOP + 0.125 + closeHover * 0.016 - closePress * 0.062;
      var yCloseWell = yCloseTop - 0.014;
      var closeCol = shadeRgb(panelCol, 1.0 + closeHover * 0.16, closeHover * 0.018);
      var matCloseBtn = [palette.isLight ? 0.12 : 0.14, 0.95, closeHover * 0.04 * ambientMul, 1];

      var clBase = sampleG2RectLoop(CTRL_CLOSE_X - 0.302, ROW1_Z - 0.302, CTRL_CLOSE_X + 0.302, ROW1_Z + 0.302, 0.096, 6, 2.2);
      var clRim = sampleG2RectLoop(CTRL_CLOSE_X - 0.274, ROW1_Z - 0.274, CTRL_CLOSE_X + 0.274, ROW1_Z + 0.274, 0.086, 6, 2.2);
      var clDish = sampleG2RectLoop(CTRL_CLOSE_X - 0.220, ROW1_Z - 0.220, CTRL_CLOSE_X + 0.220, ROW1_Z + 0.220, 0.068, 6, 2.2);

      mb.addSmoothFilletStrip(
        clBase, HW_DECK_Y_TOP - 0.012, 0.22, shadeRgb(closeCol, 0.76),
        clRim, yCloseTop, 0.76, mixRgb(closeCol, rimCol, 0.60),
        matCloseBtn, false, 0.24, 0.90
      );
      mb.addSmoothFilletStrip(
        clDish, yCloseWell, 0.85, shadeRgb(closeCol, 0.88),
        clRim, yCloseTop, 0.95, mixRgb(closeCol, rimCol, 0.45),
        matCloseBtn, true, 0.20, 0.76
      );
      mb.addLoopCap(clDish, yCloseWell, shadeRgb(closeCol, 0.90), matCloseBtn, false);

      /* Top-face 3D micro-engraved X metallic highlight */
      var xGlyphBase = palette.isLight ? etchInkCol : mixRgb(closeCol, rimCol, 0.78);
      var xGlyphCol = closeHover > 0.05
        ? mixRgb(xGlyphBase, [0.95, 0.42, 0.38], 0.40 * closeHover)
        : xGlyphBase;
      var matXGlyph = [0.08, 0.97, closeHover * 0.10 * ambientMul, 1];
      addRotatedChamferBar(
        mb, CTRL_CLOSE_X, ROW1_Z, yCloseWell - 0.002, yCloseWell + 0.014,
        0.132, 0.020, Math.PI * 0.25, 0.006,
        xGlyphCol, etchBevelCol, closeCol, matXGlyph, matXGlyph, 0.88
      );
      addRotatedChamferBar(
        mb, CTRL_CLOSE_X, ROW1_Z, yCloseWell - 0.002, yCloseWell + 0.014,
        0.132, 0.020, -Math.PI * 0.25, 0.006,
        xGlyphCol, etchBevelCol, closeCol, matXGlyph, matXGlyph, 0.88
      );
    }

    /**
     * Builds V10 dynamic hardware widgets mesh (widgetsGpu, zero extra Programs/VAOs/Textures/FBOs):
     * 1. Left 1U CNC brushed-titanium artisan prism keycap (col=2, row=1 => action: 'prism-wave')
     * 2. Right 5U PVD heavy-metal Hardware Control Deck (col=13..17, row=1 => badge + 'reset-view' + 'mute' + 'close')
     * 3. Static underside PVD weights are now in chassisGpu; widgetsGpu keeps only dynamic animated components
     * 4. Active 5-pin condenser-lens mechanical switch + antigravity flux rings, crystals & bokeh motes
     */
    function buildDynamicWidgetsMesh(params) {
      var mb = createMeshBuilder();
      var palette = params.palette;
      var switchInfo = params.switchInfo;
      var ambientMul = params.ambientMul;
      var energyPulse = params.energyPulse || 0;
      var hwCtrl = params.hwCtrl || null;

      /* 1. Left 1U metal prism artisan key + right 5U PVD hardware control deck (static PVD weights live in chassisGpu) */
      buildArtisanPrismKeyMesh(mb, palette, hwCtrl, ambientMul);
      buildHardwareControlDeckMesh(mb, palette, hwCtrl, ambientMul);

      /* 2. Exposed macro 5-pin condenser-lens mechanical switch under levitated main key */
      if (switchInfo && !switchInfo.isAux) {
        buildActiveSwitchMesh(mb, switchInfo, palette, ambientMul, energyPulse);
      }

      var mainOpaqueCount = mb.getIndexCount();

      /* 3. Aux pad opaque dynamic widgets (exposed crystal switch under levitated aux key + #0 Orch latch seam backlight, bound to auxChassisMat) */
      if (params.includeAuxPad) {
        if (switchInfo && switchInfo.isAux) {
          buildActiveSwitchMesh(mb, switchInfo, palette, ambientMul, energyPulse);
        }

        /* V12 #0 Orch mechanical latch seam violet-gold backlight (subtle base glow only, never levitates) */
        var orchLatchGlow = clamp(Number(params.orchLatchGlow) || 0.0, 0.0, 1.0);
        if (orchLatchGlow > 0.008 && ambientMul > 0.01) {
          var ocx = AUX_COL0_X;
          var ocz = AUX_ROW_ZS[0];
          var oyPlate = PLATE_Y + 0.008;
          var oyRim = PLATE_Y + 0.058 + orchLatchGlow * 0.016;
          var latchEmis = orchLatchGlow * (palette.isLight ? 0.56 : 0.84) * Math.max(0.28, ambientMul) * (1.0 + energyPulse * 0.25);
          var matLatchCollar = [0.09, 0.14, latchEmis, 2];
          var purpleCol = [0.64, 0.38, 0.99];
          var amberCol = [0.99, 0.75, 0.22];
          var collarDualMid = mixRgb(purpleCol, amberCol, 0.44);
          var loopCollarIn = sampleG2RectLoop(ocx - 0.418, ocz - 0.418, ocx + 0.418, ocz + 0.418, 0.062, 6, 2.2);
          var loopCollarMid = sampleG2RectLoop(ocx - 0.456, ocz - 0.456, ocx + 0.456, ocz + 0.456, 0.072, 6, 2.2);
          var loopCollarOut = sampleG2RectLoop(ocx - 0.486, ocz - 0.486, ocx + 0.486, ocz + 0.486, 0.082, 6, 2.2);
          mb.addSmoothFilletStrip(
            loopCollarIn, oyPlate, 0.52, purpleCol,
            loopCollarMid, oyRim, 0.90, collarDualMid,
            matLatchCollar, false, 0.0, 0.0
          );
          mb.addSmoothFilletStrip(
            loopCollarMid, oyRim, 0.90, collarDualMid,
            loopCollarOut, oyPlate + 0.004, 0.48, shadeRgb(amberCol, 0.88),
            matLatchCollar, false, 0.0, 0.0
          );
        }
      }

      var opaqueIndexCount = mb.getIndexCount();
      var auxOpaqueCount = opaqueIndexCount - mainOpaqueCount;

      /* 4. Air-gap V11 effort-scaled antigravity holographic rings + condenser light pillar + 3D octahedral micro-crystals + bokeh motes
       *    (reuses widgetsGpu + progSolid with zero extra GPU objects; distinguishes main chassisMat vs auxChassisMat) */
      if (params.fluxCfg && !params.fluxCfg.isAux) {
        appendAntigravFluxToMesh(mb, params.fluxCfg);
      }
      var afterMainFluxIdx = mb.getIndexCount();
      var mainFluxCount = afterMainFluxIdx - opaqueIndexCount;

      if (params.fluxCfg && params.fluxCfg.isAux) {
        appendAntigravFluxToMesh(mb, params.fluxCfg);
      }
      var totalIndexCount = mb.getIndexCount();
      var auxFluxCount = totalIndexCount - afterMainFluxIdx;

      return mb.build({
        opaqueIndexCount: opaqueIndexCount,
        mainOpaqueCount: mainOpaqueCount,
        auxOpaqueCount: auxOpaqueCount,
        fluxIndexCount: totalIndexCount - opaqueIndexCount,
        mainFluxCount: mainFluxCount,
        auxFluxCount: auxFluxCount,
      });
    }

    /**
     * Appends V11 effort-scaled antigravity field + 3D octahedral micro-crystals + light pillar + bokeh motes to widgetsGpu:
     * - Low    (tier=0): 1 fine base flux ring + 6 octahedral micro-crystals + 4 bokeh motes
     * - Medium (tier=1): 2 counter-rotating flux rings + 12 octahedral micro-crystals + 8 bokeh motes
     * - High   (tier=2): 2 flux rings + vertical condenser light pillar + 20 rising micro-crystals + 12 bokeh motes
     * - Extra  (tier=3): 3 interwoven holographic flux rings + vertical light pillar + 28 spiral micro-crystals + 16 bokeh motes
     * - Supports dual-tone prism refraction (e.g. #0 Orchestrator violet x amber-gold) with zero extra GPU objects
     */
    function appendAntigravFluxToMesh(mb, cfg) {
      var ox = cfg.originX;
      var oy = cfg.originY;
      var oz = cfg.originZ;
      var slamCollapse = clamp(cfg.slamCollapse || 0, 0, 1);
      var collapseScale = Math.max(0.0, 1.0 - slamCollapse * 0.94);
      if (collapseScale <= 0.002 || cfg.visAlpha <= 0.003) return;

      var tier = clamp(Math.round(Number(cfg.effortTier !== undefined ? cfg.effortTier : 1)), 0, 3);
      var effGapH = Math.max(0.025, cfg.gapH) * collapseScale;
      var phaseT = cfg.phaseT || 0;
      var ePulse = cfg.energyPulse || 0;
      var visAlpha = cfg.visAlpha;
      var elemRgb = cfg.elemRgb || [0.45, 0.72, 1.0];
      var secRgb = cfg.secondaryRgb || elemRgb;
      var orchBlend = clamp(cfg.orchBlend || 0, 0, 1);
      var orchPurpleRgb = [0.70, 0.44, 1.00];
      var orchGoldRgb = [1.00, 0.78, 0.22];
      var ringSecRgb = orchBlend > 0.01
        ? mixRgb(secRgb, mixRgb(orchPurpleRgb, orchGoldRgb, 0.46), 0.38 * orchBlend)
        : secRgb;

      /* 1. Effort-scaled holographic flux rings (kind = 7.0): Low 1 ring -> Medium/High 2 rings -> Extra 3 rings */
      var RING_SEGS = 48;
      var rings;
      if (tier === 0) {
        rings = [
          { rMid: 0.348, halfW: 0.028, yNorm: 0.22, slopeY: 0.010, ringIdx: 0.0, col: elemRgb },
        ];
      } else if (tier === 1) {
        rings = [
          { rMid: 0.382, halfW: 0.036, yNorm: 0.18, slopeY: 0.012, ringIdx: 0.0, col: elemRgb },
          { rMid: 0.276, halfW: 0.028, yNorm: 0.58, slopeY: -0.010, ringIdx: 1.0, col: ringSecRgb },
        ];
      } else if (tier === 2) {
        rings = [
          { rMid: 0.402, halfW: 0.038, yNorm: 0.16, slopeY: 0.014, ringIdx: 0.0, col: elemRgb },
          { rMid: 0.292, halfW: 0.031, yNorm: 0.58, slopeY: -0.011, ringIdx: 1.0, col: ringSecRgb },
        ];
      } else {
        rings = [
          { rMid: 0.422, halfW: 0.040, yNorm: 0.14, slopeY: 0.015, ringIdx: 0.0, col: elemRgb },
          { rMid: 0.324, halfW: 0.032, yNorm: 0.46, slopeY: -0.012, ringIdx: 1.0, col: ringSecRgb },
          { rMid: 0.232, halfW: 0.026, yNorm: 0.78, slopeY: 0.010, ringIdx: 2.0, col: mixRgb(elemRgb, ringSecRgb, 0.5) },
        ];
      }

      for (var ri = 0; ri < rings.length; ri++) {
        var rg = rings[ri];
        var rc = rg.col;
        var rIn = (rg.rMid - rg.halfW) * collapseScale;
        var rOut = (rg.rMid + rg.halfW) * collapseScale;
        var yInBase = (rg.yNorm - rg.slopeY) * effGapH;
        var yOutBase = (rg.yNorm + rg.slopeY) * effGapH;

        var ringVerts = [];
        for (var s = 0; s <= RING_SEGS; s++) {
          var u = s / RING_SEGS;
          var ang = u * TWO_PI;
          var ca = Math.cos(ang);
          var sa = Math.sin(ang);
          var lxIn = ca * rIn;
          var lzIn = sa * rIn;
          var lxOut = ca * rOut;
          var lzOut = sa * rOut;

          /* Store unnormalized local radial offset in a_normal(lx, 0, lz) so SOLID_VS drives GPU breathing & wobble via u_envParams.w */
          var vIn = mb.pushVertexRawNormal(
            ox + lxIn, oy + yInBase, oz + lzIn,
            lxIn, 0, lzIn,
            rc[0], rc[1], rc[2],
            rg.ringIdx, visAlpha, slamCollapse, 7.0,
            u, -1.0
          );
          var vOut = mb.pushVertexRawNormal(
            ox + lxOut, oy + yOutBase, oz + lzOut,
            lxOut, 0, lzOut,
            rc[0], rc[1], rc[2],
            rg.ringIdx, visAlpha, slamCollapse, 7.0,
            u, 1.0
          );
          ringVerts.push(vIn, vOut);
        }
        for (var k = 0; k < RING_SEGS; k++) {
          var i0 = ringVerts[k * 2];
          var i1 = ringVerts[k * 2 + 1];
          var i2 = ringVerts[k * 2 + 2];
          var i3 = ringVerts[k * 2 + 3];
          mb.pushTri(i0, i1, i3);
          mb.pushTri(i0, i3, i2);
        }
      }

      /* 2. High (tier=2) & Extra (tier=3) vertical condenser energy light pillar (kind = 7.3) */
      if (tier >= 2) {
        var PILLAR_SEGS = 20;
        var pillarVis = visAlpha * (tier === 3 ? 0.96 : 0.78);
        var pRadBot = (tier === 3 ? 0.168 : 0.142) * collapseScale;
        var pRadTop = (tier === 3 ? 0.245 : 0.205) * collapseScale;
        var pY0 = oy - 0.015;
        var pY1 = oy + effGapH * 0.94;
        var pColBot = elemRgb;
        var pColTop = secRgb;
        var pVerts = [];
        for (var ps = 0; ps <= PILLAR_SEGS; ps++) {
          var pu = ps / PILLAR_SEGS;
          var pang = pu * TWO_PI;
          var pca = Math.cos(pang);
          var psa = Math.sin(pang);
          var pvBot = mb.pushVertex(
            ox + pca * pRadBot, pY0, oz + psa * pRadBot,
            pca, 0.15, psa,
            pColBot[0], pColBot[1], pColBot[2],
            tier, pillarVis, slamCollapse, 7.3,
            pu, 0.0
          );
          var pvTop = mb.pushVertex(
            ox + pca * pRadTop, pY1, oz + psa * pRadTop,
            pca, 0.25, psa,
            pColTop[0], pColTop[1], pColTop[2],
            tier, pillarVis, slamCollapse, 7.3,
            pu, 1.0
          );
          pVerts.push(pvBot, pvTop);
        }
        for (var pk = 0; pk < PILLAR_SEGS; pk++) {
          var pi0 = pVerts[pk * 2];
          var pi1 = pVerts[pk * 2 + 1];
          var pi2 = pVerts[pk * 2 + 2];
          var pi3 = pVerts[pk * 2 + 3];
          mb.pushTri(pi0, pi2, pi3);
          mb.pushTri(pi0, pi3, pi1);
        }
      }

      /* 3. Faceted 3D octahedral micro-crystal cluster (kind = 7.6):
       *    Count scales strictly by effortTier: Low: 6 -> Medium: 12 -> High: 20 -> Extra: 28 */
      var CRYSTAL_COUNTS_BY_TIER = [6, 12, 20, 28];
      var crystalCount = CRYSTAL_COUNTS_BY_TIER[tier];
      var spiralHeightBoost = 0.84 + tier * 0.085;
      var spreadBoost = 0.92 + tier * 0.095;

      for (var ci = 0; ci < crystalCount; ci++) {
        var cSeed = ((ci * 0.1379) + 0.09) % 1.0;
        var cLife = 0.14 + 0.68 * ((ci + 0.5) / crystalCount);
        var cFade =
          smoothstepScalar(0.0, 0.15, cLife) *
          (1.0 - smoothstepScalar(0.78, 1.0, cLife)) *
          collapseScale;
        if (cFade <= 0.005) continue;

        /* Alternates primary/secondary prism hues; when orchLatched, mixes ~35% (7/20) violet x amber-gold orchestrator crystals */
        var baseCCol = (ci % 2 === 0) ? elemRgb : mixRgb(elemRgb, secRgb, 0.85);
        var isOrchShard = ((ci * 7 + 3) % 20) < 7;
        var orchShardRgb = (((ci * 3) % 2) === 0) ? orchPurpleRgb : orchGoldRgb;
        var cCol = (orchBlend > 0.01 && isOrchShard) ? mixRgb(baseCCol, orchShardRgb, orchBlend) : baseCCol;
        var cr = cCol[0], cg = cCol[1], cb = cCol[2];

        var cBaseAng = ci * 2.39996323;
        var ringBand = 0.215 + ((ci * 5) % 9) * 0.028;
        var cAng = cBaseAng + cLife * (1.35 + tier * 0.22);
        var cRad = ringBand * spreadBoost * (1.0 - cLife * 0.10) * collapseScale;
        var ccx = ox + Math.cos(cAng) * cRad;
        var ccy = oy + (0.06 + cLife * spiralHeightBoost) * effGapH;
        var ccz = oz + Math.sin(cAng) * cRad;

        var baseHalfW = (0.024 + (ci % 3) * 0.0065 + tier * 0.0025) * (0.76 + 0.24 * cFade);
        var halfH = baseHalfW * (1.58 + (ci % 2) * 0.24);
        var cVis = visAlpha * cFade * (0.90 + tier * 0.05);

        /* Independent slow 3D tumbling orthonormal basis (eX, eY, eZ) per octahedral micro-crystal */
        var spinYaw = ci * 1.13;
        var spinTilt = (ci % 3 - 1) * 0.24;
        var csY = Math.cos(spinYaw), snY = Math.sin(spinYaw);
        var csT = Math.cos(spinTilt), snT = Math.sin(spinTilt);

        var eXx = csY,          eXy = snT * snY,  eXz = snY * csT;
        var eYx = 0.0,          eYy = csT,        eYz = -snT;
        var eZx = -snY,         eZy = snT * csY,  eZz = csY * csT;

        var topPt = [ccx + eYx * halfH, ccy + eYy * halfH, ccz + eYz * halfH];
        var botPt = [ccx - eYx * halfH, ccy - eYy * halfH, ccz - eYz * halfH];
        var eqPts = [
          [ccx + eXx * baseHalfW, ccy + eXy * baseHalfW, ccz + eXz * baseHalfW],
          [ccx + eZx * baseHalfW, ccy + eZy * baseHalfW, ccz + eZz * baseHalfW],
          [ccx - eXx * baseHalfW, ccy - eXy * baseHalfW, ccz - eXz * baseHalfW],
          [ccx - eZx * baseHalfW, ccy - eZy * baseHalfW, ccz - eZz * baseHalfW],
        ];

        for (var f = 0; f < 4; f++) {
          var fNext = (f + 1) % 4;
          var pA = eqPts[f];
          var pB = eqPts[fNext];

          /* Upper pyramid facets (topPt, pB, pA) */
          var u1x = pB[0] - topPt[0], u1y = pB[1] - topPt[1], u1z = pB[2] - topPt[2];
          var v1x = pA[0] - topPt[0], v1y = pA[1] - topPt[1], v1z = pA[2] - topPt[2];
          var fn1x = u1y * v1z - u1z * v1y;
          var fn1y = u1z * v1x - u1x * v1z;
          var fn1z = u1x * v1y - u1y * v1x;
          var vt0 = mb.pushVertex(topPt[0], topPt[1], topPt[2], fn1x, fn1y, fn1z, cr, cg, cb, cSeed + f * 0.13, cVis, slamCollapse, 7.6, 0.5, 1.0);
          var vt1 = mb.pushVertex(pB[0], pB[1], pB[2], fn1x, fn1y, fn1z, cr, cg, cb, cSeed + f * 0.13, cVis, slamCollapse, 7.6, 1.0, 0.0);
          var vt2 = mb.pushVertex(pA[0], pA[1], pA[2], fn1x, fn1y, fn1z, cr, cg, cb, cSeed + f * 0.13, cVis, slamCollapse, 7.6, 0.0, 0.0);
          mb.pushTri(vt0, vt1, vt2);

          /* Lower pyramid facets (botPt, pA, pB) */
          var u2x = pA[0] - botPt[0], u2y = pA[1] - botPt[1], u2z = pA[2] - botPt[2];
          var v2x = pB[0] - botPt[0], v2y = pB[1] - botPt[1], v2z = pB[2] - botPt[2];
          var fn2x = u2y * v2z - u2z * v2y;
          var fn2y = u2z * v2x - u2x * v2z;
          var fn2z = u2x * v2y - u2y * v2x;
          var vb0 = mb.pushVertex(botPt[0], botPt[1], botPt[2], fn2x, fn2y, fn2z, cr, cg, cb, cSeed + f * 0.13 + 0.07, cVis, slamCollapse, 7.6, 0.5, -1.0);
          var vb1 = mb.pushVertex(pA[0], pA[1], pA[2], fn2x, fn2y, fn2z, cr, cg, cb, cSeed + f * 0.13 + 0.07, cVis, slamCollapse, 7.6, 0.0, 0.0);
          var vb2 = mb.pushVertex(pB[0], pB[1], pB[2], fn2x, fn2y, fn2z, cr, cg, cb, cSeed + f * 0.13 + 0.07, cVis, slamCollapse, 7.6, 1.0, 0.0);
          mb.pushTri(vb0, vb1, vb2);
        }
      }

      /* 4. Soft optical bokeh motes (kind = 8.0, camera-facing billboards expanded in SOLID_VS via u_camPos & u_envParams.w) */
      var MOTE_COUNTS_BY_TIER = [4, 8, 12, 16];
      var moteCount = MOTE_COUNTS_BY_TIER[tier];
      for (var mi = 0; mi < moteCount; mi++) {
        var seed = ((mi * 0.074) + 0.18) % 1.0;
        var life = 0.16 + 0.68 * ((mi + 0.5) / moteCount);
        var fade =
          smoothstepScalar(0.0, 0.18, life) *
          (1.0 - smoothstepScalar(0.74, 1.0, life)) *
          collapseScale;
        if (fade <= 0.004) continue;

        var baseMCol = (mi % 2 === 1) ? secRgb : elemRgb;
        var isOrchMote = ((mi * 7 + 2) % 20) < 7;
        var mCol = (orchBlend > 0.01 && isOrchMote)
          ? mixRgb(baseMCol, (mi % 2 === 0) ? orchPurpleRgb : orchGoldRgb, orchBlend)
          : baseMCol;
        var baseAng = mi * 2.39996323 + 0.8;
        var baseRad = 0.145 + ((mi * 7) % 10) * 0.028;
        var moteScale = 0.028 + (mi % 3) * 0.007;
        var spiralAng = baseAng + life * 1.65;
        var rad = baseRad * spreadBoost * (1.0 - life * 0.16) * collapseScale;
        var mcx = ox + Math.cos(spiralAng) * rad;
        var mcy = oy + (0.08 + life * 0.88) * effGapH;
        var mcz = oz + Math.sin(spiralAng) * rad;
        var rSize = moteScale * (0.82 + 0.48 * Math.sin(seed * 19.1) * 0.5) * (0.72 + 0.28 * fade);
        var mVis = visAlpha * fade;

        var q0 = mb.pushVertexRawNormal(
          mcx, mcy, mcz,
          rSize, 0, 0, mCol[0], mCol[1], mCol[2], seed, mVis, slamCollapse, 8.0, -1.0, -1.0
        );
        var q1 = mb.pushVertexRawNormal(
          mcx, mcy, mcz,
          rSize, 0, 0, mCol[0], mCol[1], mCol[2], seed, mVis, slamCollapse, 8.0, 1.0, -1.0
        );
        var q2 = mb.pushVertexRawNormal(
          mcx, mcy, mcz,
          rSize, 0, 0, mCol[0], mCol[1], mCol[2], seed, mVis, slamCollapse, 8.0, 1.0, 1.0
        );
        var q3 = mb.pushVertexRawNormal(
          mcx, mcy, mcz,
          rSize, 0, 0, mCol[0], mCol[1], mCol[2], seed, mVis, slamCollapse, 8.0, -1.0, 1.0
        );
        mb.pushTri(q0, q1, q2);
        mb.pushTri(q0, q2, q3);
      }
    }

    /* ============================================================================
     * 6. 2x HiDPI Texture Generators:
     *    - Legend atlas: 4 hero keys (700 Bold + NOVELTY_ICONS emblems) vs 86 resting keys (500 Medium dark-etched)
     *    - 1600x480 dark/light adaptive built-in OLED screen fallback
     * ============================================================================ */
    var ATLAS_COLS = 10;
    var ATLAS_ROWS = 9;
    /* 1024x1024 physical keycap legend atlas (102x102 px/key ~2.7x supersampled from logical 2048 coords; cuts upload/mipmap cost by 75%) */
    var ATLAS_DESIGN_SIZE = 2048;
    var ATLAS_SIZE = 1024;
    var ATLAS_SCALE = ATLAS_SIZE / ATLAS_DESIGN_SIZE;

    function createOffscreenCanvas(doc, w, h) {
      if (doc && typeof doc.createElement === 'function') {
        try {
          var c = doc.createElement('canvas');
          if (c && typeof c.getContext === 'function') {
            c.width = w;
            c.height = h;
            var ctx = c.getContext('2d');
            if (ctx) return { canvas: c, ctx: ctx };
          }
        } catch (_e) {
          /* Silent fallback when Node VM sandbox lacks a real Canvas */
        }
      }
      return null;
    }

    /**
     * Draws geometric novelty sub-legend fallback for the 4 hero elements (1H / 6C / 10Ne / 18Ar) when Path2D or NOVELTY_ICONS is absent
     */
    function drawFallbackNoveltyGlyph(ctx, z, cx, cy, r) {
      ctx.save();
      ctx.translate(cx, cy);
      /* R+G dual channel (#FFFF00) isolates top-right element-tinted emblem cleanly from main legend (#FF0000) */
      ctx.strokeStyle = '#FFFF00';
      ctx.fillStyle = '#FFFF00';
      ctx.lineWidth = 3.2;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      if (z === 1) {
        ctx.beginPath();
        ctx.arc(0, 0, r * 0.78, 0, TWO_PI);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(0, 0, r * 0.24, 0, TWO_PI);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(r * 0.55, -r * 0.55, r * 0.19, 0, TWO_PI);
        ctx.fill();
      } else if (z === 6) {
        ctx.beginPath();
        for (var k = 0; k < 6; k++) {
          var a = (k / 6) * TWO_PI - Math.PI * 0.5;
          var px = Math.cos(a) * r * 0.84;
          var py = Math.sin(a) * r * 0.84;
          if (k === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.closePath();
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(0, 0, r * 0.26, 0, TWO_PI);
        ctx.fill();
      } else if (z === 10) {
        ctx.beginPath();
        ctx.arc(0, 0, r * 0.82, 0, TWO_PI);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(0, 0, r * 0.42, 0, TWO_PI);
        ctx.stroke();
      } else if (z === 18) {
        ctx.beginPath();
        ctx.moveTo(0, -r * 0.90);
        ctx.lineTo(r * 0.82, 0);
        ctx.lineTo(0, r * 0.90);
        ctx.lineTo(-r * 0.82, 0);
        ctx.closePath();
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(0, 0, r * 0.24, 0, TWO_PI);
        ctx.fill();
      }
      ctx.restore();
    }

    var _legendAtlasCache = new Map();
    var MAX_LEGEND_ATLAS_CACHE = 4;

    function computeLegendAtlasCacheKey(slots, noveltyMap, themeKey) {
      var sLen = Array.isArray(slots) ? Math.min(slots.length, 90) : 0;
      var slotParts = [String(sLen)];
      for (var i = 0; i < sLen; i++) {
        var sl = slots[i];
        slotParts.push((sl && sl.z !== undefined ? sl.z : '') + ':' + (sl && sl.symbol ? sl.symbol : ''));
      }
      var novParts = [];
      if (noveltyMap) {
        var novKeys = ['1', '6', '10', '18'];
        for (var ni = 0; ni < novKeys.length; ni++) {
          var nk = novKeys[ni];
          var ne = noveltyMap[nk];
          novParts.push(ne && Array.isArray(ne.paths) ? String(ne.paths.length) : '0');
        }
      }
      return (themeKey ? String(themeKey) : 'shared') + '|' + novParts.join(',') + '|' + slotParts.join(',');
    }

    function computeAuxListSigQuick(auxList) {
      var list = Array.isArray(auxList) ? auxList : DEFAULT_AUX_MODELS;
      var parts = [];
      for (var k = 0; k < AUX_SLOT_COUNT; k++) {
        var s = list[k] || DEFAULT_AUX_MODELS[k];
        parts.push(
          (s ? s.id : '') + ':' + (s ? s.shortLabel : '') + ':' + (s ? s.subLabel : '') + ':' + (s ? s.badgeCode : '') + ':' + (s && s.available ? 1 : 0)
        );
      }
      return parts.join('|');
    }

    function evictLegendAtlasCache(targetDoc) {
      var evicted = 0;
      _legendAtlasCache.forEach(function (entry, key) {
        if (targetDoc && entry && entry.doc !== targetDoc) return;
        evicted++;
        if (entry && entry.surf && entry.surf.canvas) {
          try {
            entry.surf.canvas.width = 0;
            entry.surf.canvas.height = 0;
          } catch (_evErr) {}
          entry.surf.ctx = null;
          entry.surf.canvas = null;
        }
        _legendAtlasCache.delete(key);
      });
      if (!targetDoc) {
        _cachedChassisMeshMap.clear();
      }
      return evicted;
    }

    /**
     * V9 legend atlas baker (logical 2048x2048, R/G channel split for high-contrast main legend + tinted top-right emblem):
     * - 4 core available keys (1H / 6C / 10Ne / 18Ar):
     *   Bold 700 symbol + 600 atomic number in R=1.0, G=0.0; top-right NOVELTY_ICONS vector emblem in R=1.0, G=1.0 (#FFFF00)
     * - 86 resting blind keys:
     *   ~20% smaller 500 Medium subtle dark-etched legends (R=0.22 + B anti-aliased edge profile)
     * - Module-level signature cache for 0ms warm-open reuse; cleared via evictLegendAtlasCache()
     */
    function renderLegendAtlasCanvas(doc, slots, grainAssets, optAuxModels, optThemeKey) {
      var pkg = resolveGrainPackage(moduleRoot);
      var noveltyMap = (grainAssets && grainAssets.noveltyIcons) || (pkg && pkg.NOVELTY_ICONS) || null;
      var cacheKey = computeLegendAtlasCacheKey(slots, noveltyMap, optThemeKey);
      var targetAuxList = Array.isArray(optAuxModels) ? optAuxModels : DEFAULT_AUX_MODELS;
      var targetAuxSig = computeAuxListSigQuick(targetAuxList);

      var cached = _legendAtlasCache.get(cacheKey);
      if (
        cached &&
        cached.doc === doc &&
        cached.surf &&
        cached.surf.canvas &&
        cached.surf.ctx &&
        cached.surf.canvas.width === ATLAS_SIZE &&
        cached.surf.canvas.height === ATLAS_SIZE
      ) {
        _legendAtlasCache.delete(cacheKey);
        _legendAtlasCache.set(cacheKey, cached);
        if (cached.auxSig !== targetAuxSig) {
          renderAuxAtlasCellsToContext(cached.surf.ctx, targetAuxList, false);
          cached.auxSig = targetAuxSig;
        }
        return cached.surf;
      }

      var surf = createOffscreenCanvas(doc, ATLAS_SIZE, ATLAS_SIZE);
      if (!surf) return null;
      var ctx = surf.ctx;
      var cellW = ATLAS_DESIGN_SIZE / ATLAS_COLS;
      var cellH = (ATLAS_DESIGN_SIZE * 0.90) / ATLAS_ROWS;
      var hasPath2D = typeof Path2D === 'function';

      ctx.clearRect(0, 0, ATLAS_SIZE, ATLAS_SIZE);
      ctx.save();
      if (ATLAS_SCALE !== 1) {
        ctx.scale(ATLAS_SCALE, ATLAS_SCALE);
      }
      var sansStack = '"Inter", "SF Pro Display", "Helvetica Neue", "Segoe UI", system-ui, sans-serif';

      var stealthDraws = [];
      var curFont = '';

      for (var i = 0; i < slots.length && i < 90; i++) {
        var slot = slots[i];
        var col = i % ATLAS_COLS;
        var row = Math.floor(i / ATLAS_COLS);
        var x0 = col * cellW;
        var y0 = row * cellH;
        var zNum = Number(slot.z) || 0;
        var isCoreHero = zNum === 1 || zNum === 6 || zNum === 10 || zNum === 18;
        var numStr = String(slot.numLabel !== undefined && slot.numLabel !== '' ? slot.numLabel : slot.z || '').trim();
        var isRange = numStr.length > 3;
        var sym = String(slot.symbol || '');

        if (isCoreHero) {
          /* Hero keys: top-left 600 SemiBold atomic number + centered 700 Bold symbol (#FF0000) + top-right NOVELTY_ICONS emblem (#FFFF00) */
          var heroNumPx = isRange ? 27 : numStr.length === 3 ? 32 : 37;
          ctx.fillStyle = '#FF0000';
          ctx.textAlign = 'left';
          ctx.textBaseline = 'top';
          var heroNumFont = '600 ' + heroNumPx + 'px ' + sansStack;
          if (curFont !== heroNumFont) { ctx.font = heroNumFont; curFont = heroNumFont; }
          ctx.fillText(numStr, x0 + 25, y0 + 20);

          var heroSymPx = sym.length >= 3 ? 64 : sym.length === 2 ? 88 : 96;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          var heroSymFont = '700 ' + heroSymPx + 'px ' + sansStack;
          if (curFont !== heroSymFont) { ctx.font = heroSymFont; curFont = heroSymFont; }
          ctx.fillText(sym, x0 + cellW * 0.50, y0 + cellH * 0.62);

          var noveltyEntry = noveltyMap ? (noveltyMap[zNum] || noveltyMap[String(zNum)]) : null;
          if (noveltyEntry && Array.isArray(noveltyEntry.paths) && noveltyEntry.paths.length > 0 && hasPath2D) {
            var iconBox = 40;
            var iconX = x0 + cellW - 22 - iconBox;
            var iconY = y0 + 17;
            var vb = Number(noveltyEntry.viewBox) || 2048;
            var sc = iconBox / vb;
            try {
              var compiledNovelty = [];
              for (var np = 0; np < noveltyEntry.paths.length; np++) {
                if (noveltyEntry.paths[np]) {
                  compiledNovelty.push(new Path2D(noveltyEntry.paths[np]));
                }
              }
              if (compiledNovelty.length > 0) {
                ctx.save();
                ctx.translate(iconX, iconY);
                ctx.scale(sc, sc);
                ctx.fillStyle = '#FFFF00';
                ctx.strokeStyle = '#FFFF00';
                ctx.lineWidth = vb * 0.005;
                ctx.lineJoin = 'round';
                ctx.lineCap = 'round';
                for (var ci0 = 0; ci0 < compiledNovelty.length; ci0++) {
                  ctx.fill(compiledNovelty[ci0]);
                  ctx.stroke(compiledNovelty[ci0]);
                }
                ctx.restore();
              }
            } catch (_novErr) {
              drawFallbackNoveltyGlyph(ctx, zNum, x0 + cellW - 40, y0 + 36, 17);
            }
          } else {
            drawFallbackNoveltyGlyph(ctx, zNum, x0 + cellW - 40, y0 + 36, 17);
          }
        } else {
          /* Batch 86 resting blind keys to minimize Canvas state switches */
          var stealthNumPx = isRange ? 21 : numStr.length === 3 ? 25 : 29;
          var stealthSymPx = sym.length >= 3 ? 51 : sym.length === 2 ? 70 : 76;
          stealthDraws.push({
            numStr: numStr,
            sym: sym,
            nx: x0 + 28,
            ny: y0 + 24,
            sx: x0 + cellW * 0.50,
            sy: y0 + cellH * 0.61,
            numFont: '500 ' + stealthNumPx + 'px ' + sansStack,
            symFont: '500 ' + stealthSymPx + 'px ' + sansStack,
          });
        }
      }

      if (stealthDraws.length > 0) {
        ctx.save();
        for (var pass = 0; pass < 2; pass++) {
          if (pass === 0) {
            ctx.fillStyle = 'rgba(255, 0, 0, 0.22)';
          } else {
            ctx.globalCompositeOperation = 'lighter';
            ctx.fillStyle = '#0000FF';
          }
          ctx.textAlign = 'left';
          ctx.textBaseline = 'top';
          for (var si1 = 0; si1 < stealthDraws.length; si1++) {
            var sd1 = stealthDraws[si1];
            if (curFont !== sd1.numFont) { ctx.font = sd1.numFont; curFont = sd1.numFont; }
            ctx.fillText(sd1.numStr, sd1.nx, sd1.ny);
          }
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          for (var si2 = 0; si2 < stealthDraws.length; si2++) {
            var sd2 = stealthDraws[si2];
            if (curFont !== sd2.symFont) { ctx.font = sd2.symFont; curFont = sd2.symFont; }
            ctx.fillText(sd2.sym, sd2.sx, sd2.sy);
          }
        }
        ctx.restore();
      }

      ctx.restore();

      /* Synchronously bake bottom spare row 9 (physical y in [922, 1024], v in [0.9004, 1.00]) for the 6 aux pad legends & prism emblems */
      renderAuxAtlasCellsToContext(ctx, targetAuxList, false);

      surf.sharedCached = true;
      if (_legendAtlasCache.size >= MAX_LEGEND_ATLAS_CACHE) {
        var oldAtlasKey = _legendAtlasCache.keys().next().value;
        var oldAtlasEnt = _legendAtlasCache.get(oldAtlasKey);
        if (oldAtlasEnt && oldAtlasEnt.surf && oldAtlasEnt.surf.canvas) {
          try {
            oldAtlasEnt.surf.canvas.width = 0;
            oldAtlasEnt.surf.canvas.height = 0;
          } catch (_oldAtlasErr) {}
          oldAtlasEnt.surf.ctx = null;
          oldAtlasEnt.surf.canvas = null;
        }
        _legendAtlasCache.delete(oldAtlasKey);
      }
      _legendAtlasCache.set(cacheKey, {
        doc: doc,
        surf: surf,
        auxSig: targetAuxSig,
      });

      return surf;
    }

    var AUX_ATLAS_DESIGN_Y0 = 1844;
    var AUX_ATLAS_DESIGN_H = ATLAS_DESIGN_SIZE - AUX_ATLAS_DESIGN_Y0; /* 204 logical px */
    var AUX_ATLAS_Y0 = Math.round(AUX_ATLAS_DESIGN_Y0 * ATLAS_SCALE); /* 922 physical px */
    var AUX_ATLAS_H = ATLAS_SIZE - AUX_ATLAS_Y0; /* 102 physical px */

    /**
     * Draws custom top-right geometric prism emblems for right 2x3 aux pad models (#FFFF00 R+G channels):
     * - #0 Orchestrator: interwoven dual-core orbital rings + central octahedral prism core
     * - Flash: high-velocity refractive prism shuttle
     * - Claude (Opus / Sonnet): 8-point starburst faceted crystal
     * - GPT: hexagonal holographic topology matrix core
     */
    function drawAuxNoveltyGlyph(ctx, idStr, slotIdx, cx, cy, r) {
      var lowId = String(idStr || '').toLowerCase();
      ctx.save();
      ctx.translate(cx, cy);
      ctx.strokeStyle = '#FFFF00';
      ctx.fillStyle = '#FFFF00';
      ctx.lineWidth = 3.1;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      if (slotIdx === 0 || lowId.indexOf('orch') >= 0) {
        /* Interwoven dual-core elliptical orbits + central octahedral prism core */
        if (typeof ctx.ellipse === 'function') {
          ctx.beginPath();
          ctx.ellipse(0, 0, r * 0.96, r * 0.42, Math.PI * 0.25, 0, TWO_PI);
          ctx.stroke();
          ctx.beginPath();
          ctx.ellipse(0, 0, r * 0.96, r * 0.42, -Math.PI * 0.25, 0, TWO_PI);
          ctx.stroke();
        } else {
          ctx.beginPath();
          ctx.arc(0, 0, r * 0.80, 0, TWO_PI);
          ctx.stroke();
        }
        ctx.beginPath();
        ctx.moveTo(0, -r * 0.46);
        ctx.lineTo(r * 0.40, 0);
        ctx.lineTo(0, r * 0.46);
        ctx.lineTo(-r * 0.40, 0);
        ctx.closePath();
        ctx.fill();
      } else if (lowId.indexOf('flash') >= 0 || lowId.indexOf('fast') >= 0) {
        ctx.beginPath();
        ctx.moveTo(r * 0.18, -r * 0.92);
        ctx.lineTo(-r * 0.52, r * 0.06);
        ctx.lineTo(r * 0.06, r * 0.06);
        ctx.lineTo(-r * 0.18, r * 0.92);
        ctx.lineTo(r * 0.56, -r * 0.08);
        ctx.lineTo(-r * 0.04, -r * 0.08);
        ctx.closePath();
        ctx.fill();
      } else if (lowId.indexOf('claude') >= 0 || lowId.indexOf('opus') >= 0 || lowId.indexOf('sonnet') >= 0) {
        for (var sp = 0; sp < 4; sp++) {
          var ang = (sp / 4) * Math.PI;
          var ca = Math.cos(ang) * r * 0.86;
          var sa = Math.sin(ang) * r * 0.86;
          ctx.beginPath();
          ctx.moveTo(-ca, -sa);
          ctx.lineTo(ca, sa);
          ctx.stroke();
        }
        ctx.beginPath();
        ctx.arc(0, 0, r * 0.30, 0, TWO_PI);
        ctx.fill();
      } else if (lowId.indexOf('gpt') >= 0 || lowId.indexOf('oss') >= 0 || lowId.indexOf('o3') >= 0 || lowId.indexOf('o4') >= 0) {
        ctx.beginPath();
        for (var h = 0; h < 6; h++) {
          var ha = (h / 6) * TWO_PI - Math.PI * 0.5;
          var hx = Math.cos(ha) * r * 0.84;
          var hy = Math.sin(ha) * r * 0.84;
          if (h === 0) ctx.moveTo(hx, hy);
          else ctx.lineTo(hx, hy);
        }
        ctx.closePath();
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(0, 0, r * 0.28, 0, TWO_PI);
        ctx.fill();
      } else {
        ctx.beginPath();
        ctx.moveTo(0, -r * 0.85);
        ctx.lineTo(r * 0.85, 0);
        ctx.lineTo(0, r * 0.85);
        ctx.lineTo(-r * 0.85, 0);
        ctx.closePath();
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(0, 0, r * 0.24, 0, TWO_PI);
        ctx.fill();
      }
      ctx.restore();
    }

    /**
     * Renders the 6 aux model slots into atlas row 9 (physical y = AUX_ATLAS_Y0) or a standalone 1024x102 strip canvas (localStrip = true => y0 = 0)
     */
    function renderAuxAtlasCellsToContext(ctx, auxList, localStripFlag) {
      if (!ctx) return;
      var cellW = ATLAS_DESIGN_SIZE / ATLAS_COLS;
      var cellH = AUX_ATLAS_DESIGN_H;
      var yBase = localStripFlag ? 0 : AUX_ATLAS_DESIGN_Y0;
      var physYBase = localStripFlag ? 0 : AUX_ATLAS_Y0;
      var sansStack = '"Inter", "SF Pro Display", "Helvetica Neue", "Segoe UI", system-ui, sans-serif';
      var monoStack = '"JetBrains Mono", "SF Mono", Consolas, monospace';

      ctx.clearRect(0, physYBase, ATLAS_SIZE, AUX_ATLAS_H);
      ctx.save();
      if (ATLAS_SCALE !== 1) {
        ctx.scale(ATLAS_SCALE, ATLAS_SCALE);
      }

      var list = Array.isArray(auxList) ? auxList : DEFAULT_AUX_MODELS;
      for (var k = 0; k < AUX_SLOT_COUNT; k++) {
        var slot = list[k] || DEFAULT_AUX_MODELS[k];
        var x0 = k * cellW;
        var y0 = yBase;
        var isAvail = Boolean(slot && slot.available);
        var shortLbl = String((slot && slot.shortLabel) || '').trim();
        var subLbl = String((slot && slot.subLabel) || '').trim();
        var badgeStr = String((slot && slot.badgeCode) || ('0' + (k + 1))).trim();
        var hasModelGlyph = Boolean(
          shortLbl &&
          shortLbl !== '—' &&
          !/^blind(?:-\d+)?$/i.test(String((slot && slot.id) || ''))
        );

        if (isAvail || hasModelGlyph) {
          /* V13.1 clean industrial typography: crisp SemiBold centered labels (ORCH/Flash/Opus/Sonnet/GPT) without tiny mipmap-blurred sublabels */
          ctx.save();
          ctx.fillStyle = '#FF0000';
          var rawMainTxt = shortLbl || 'Aux';
          var mainTxt = (k === 0 && /^orch$/i.test(rawMainTxt)) ? 'ORCH' : rawMainTxt;
          var isAllCaps = mainTxt === mainTxt.toUpperCase() && /[A-Z]/.test(mainTxt);
          var auxWeight = isAllCaps ? '700 ' : '600 ';
          var mainPx = mainTxt.length <= 3
            ? 64
            : mainTxt.length <= 4
              ? (isAllCaps ? 50 : 54)
              : mainTxt.length <= 5
                ? 48
                : 43;
          var maxLabelW = cellW - 22;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          if ('letterSpacing' in ctx) {
            ctx.letterSpacing = mainTxt.length >= 5 ? '1.6px' : '2.2px';
          }
          ctx.font = auxWeight + mainPx + 'px ' + sansStack;
          var measuredW = ctx.measureText(mainTxt).width;
          if (measuredW > maxLabelW && measuredW > 1) {
            mainPx = Math.max(28, Math.floor(mainPx * (maxLabelW / measuredW)));
            ctx.font = auxWeight + mainPx + 'px ' + sansStack;
          }
          ctx.fillText(truncateText(ctx, mainTxt, maxLabelW + 6), x0 + cellW * 0.50, y0 + cellH * 0.60);
          ctx.restore();
        } else {
          /* Empty slot (available: false) -> dark-etched metallic blind key (R=0.22 + B=1.0 micro diamond glyph) */
          ctx.save();
          var cxB = x0 + cellW * 0.50;
          var cyB = y0 + cellH * 0.54;
          var rB = 18;
          ctx.strokeStyle = 'rgba(255, 0, 0, 0.24)';
          ctx.lineWidth = 3.4;
          ctx.beginPath();
          ctx.moveTo(cxB, cyB - rB);
          ctx.lineTo(cxB + rB, cyB);
          ctx.lineTo(cxB, cyB + rB);
          ctx.lineTo(cxB - rB, cyB);
          ctx.closePath();
          ctx.stroke();

          ctx.globalCompositeOperation = 'lighter';
          ctx.strokeStyle = '#0000FF';
          ctx.lineWidth = 3.4;
          ctx.beginPath();
          ctx.moveTo(cxB, cyB - rB);
          ctx.lineTo(cxB + rB, cyB);
          ctx.lineTo(cxB, cyB + rB);
          ctx.lineTo(cxB - rB, cyB);
          ctx.closePath();
          ctx.stroke();
          ctx.restore();
        }
      }
      ctx.restore();
    }

    function drawRoundRectPath(ctx, x, y, w, h, r) {
      var rr = Math.min(r, w * 0.5, h * 0.5);
      ctx.beginPath();
      ctx.moveTo(x + rr, y);
      ctx.arcTo(x + w, y, x + w, y + h, rr);
      ctx.arcTo(x + w, y + h, x, y + h, rr);
      ctx.arcTo(x, y + h, x, y, rr);
      ctx.arcTo(x, y, x + w, y, rr);
      ctx.closePath();
    }

    function truncateText(ctx, text, maxW) {
      var str = String(text || '');
      if (!str || ctx.measureText(str).width <= maxW) return str;
      var lo = 0, hi = str.length;
      while (lo < hi) {
        var mid = Math.ceil((lo + hi) * 0.5);
        if (ctx.measureText(str.slice(0, mid) + '…').width <= maxW) {
          lo = mid;
        } else {
          hi = mid - 1;
        }
      }
      return str.slice(0, Math.max(1, lo)) + '…';
    }

    /**
     * Computes shared geometry layout for the lower-right segmented effort capsule bar on the 1600x480 OLED fallback screen
     */
    function computeScreenEffortCapsules(deckInfo, effortPressArr, effortHoverArr) {
      var info = deckInfo;
      var levels = info && info.isAvailable !== false && Array.isArray(info.levels) ? info.levels : [];
      if (!levels.length) return { track: null, items: [] };

      var n = Math.min(levels.length, 6);
      var trackX = 560;
      var trackW = 960;
      var trackH = 106;
      var trackY = 294;
      var trackPad = 8;
      var pillGap = 10;
      var pillH = trackH - trackPad * 2;
      var pillW = Math.floor((trackW - trackPad * 2 - pillGap * (n - 1)) / n);

      var items = [];
      var spanX = DECK_X_MAX - DECK_X_MIN;
      var spanZ = DECK_Z_MAX - DECK_Z_MIN;

      for (var i = 0; i < n; i++) {
        var lv = levels[i];
        var px = trackX + trackPad + i * (pillW + pillGap);
        var py = trackY + trackPad;
        var u0 = clamp((px - 3) / OLED_DESIGN_WIDTH, 0, 1);
        var u1 = clamp((px + pillW + 3) / OLED_DESIGN_WIDTH, 0, 1);
        var v0 = clamp((py - 4) / OLED_DESIGN_HEIGHT, 0, 1);
        var v1 = clamp((py + pillH + 4) / OLED_DESIGN_HEIGHT, 0, 1);
        var effStr = String(lv.effort || '');
        var isHov = Boolean(info && info.hoveredEffort === effStr);
        var isPrs = Boolean(info && info.pressedEffort === effStr);
        items.push({
          index: i,
          effort: effStr,
          label: String(lv.label || lv.effort || ''),
          active: Boolean(lv.active),
          px: px,
          py: py,
          pw: pillW,
          ph: pillH,
          u0: u0,
          v0: v0,
          u1: u1,
          v1: v1,
          x0: DECK_X_MIN + u0 * spanX,
          x1: DECK_X_MIN + u1 * spanX,
          z0: DECK_Z_MIN + v0 * spanZ,
          z1: DECK_Z_MIN + v1 * spanZ,
          press: Math.max(isPrs ? 1.0 : 0.0, effortPressArr ? effortPressArr[i] || 0 : 0),
          hover: Math.max(isHov ? 1.0 : 0.0, effortHoverArr ? effortHoverArr[i] || 0 : 0),
        });
      }

      return {
        track: { x: trackX, y: trackY, w: trackW, h: trackH },
        items: items,
      };
    }

    /**
     * V9 built-in 1600x480 dark/light fallback screen renderer (used when external oled-cyber-screen.js is unavailable):
     * - Left translucent optical window revealing SCREEN_FS silk caustic ribbons + large sculpted element symbol
     * - Lower-right recessed frosted quartz well + glossy optical glass effort slider
     */
    function renderOledDeckCanvas(surf, deckInfo, palette, accentHex, isMono, _grainAssets, capsuleLayout) {
      if (!surf) return;
      var ctx = surf.ctx;
      var physW = surf.canvas.width || OLED_WIDTH;
      var physH = surf.canvas.height || OLED_HEIGHT;
      var W = OLED_DESIGN_WIDTH;
      var H = OLED_DESIGN_HEIGHT;
      ctx.save();
      if (physW !== W || physH !== H) {
        ctx.scale(physW / W, physH / H);
      }
      var isLight = Boolean(palette && palette.isLight);
      var isAlabaster = palette && palette.id === 'alabaster-light';
      var isWarmDark = palette && palette.id === 'warm-dark';
      var sansStack = '"Inter", "SF Pro Display", "Helvetica Neue", "Segoe UI", system-ui, sans-serif';
      var monoStack = '"JetBrains Mono", "SF Mono", "Cascadia Code", Consolas, monospace';

      var info = deckInfo || {
        z: 6,
        numLabel: '6',
        groupCode: 'G14',
        symbol: 'C',
        mass: '12.011',
        title: 'Gemini 4 Carbon',
        subtitle: 'Balanced flagship element model',
        chemLabel: '6 C · Carbon',
        sessionBanner: null,
        isAvailable: true,
        unreleasedText: 'Unreleased · Locked Stealth Keycap',
        effortTitle: 'Thinking Level',
        levels: [],
      };

      var bgHex = isLight
        ? (isAlabaster ? '#F8F6F2' : '#F4F8FD')
        : (isWarmDark ? '#060505' : '#04060B');
      ctx.clearRect(0, 0, W, H);
      ctx.fillStyle = bgHex;
      ctx.fillRect(0, 0, W, H);

      var accentRgb = hexToRgb01(accentHex);
      if (isMono) {
        accentRgb = isLight ? [0.20, 0.24, 0.32] : [0.84, 0.87, 0.92];
      }
      var brightAccent = isLight ? shadeRgb(accentRgb, 0.88, 0.0) : shadeRgb(accentRgb, 1.20, 0.10);

      /* Dark/light fluid mist halo for pure 2D fallback mode */
      if (info.isAvailable) {
        var mist = ctx.createRadialGradient(256, 240, 16, 280, 240, 380);
        mist.addColorStop(0, rgb01ToCss(accentRgb, isLight ? 0.12 : 0.16));
        mist.addColorStop(1, rgb01ToCss(accentRgb, 0.0));
        ctx.fillStyle = mist;
        ctx.fillRect(0, 0, 720, H);
      }

      var fgPrimary = isLight ? '#0F172A' : '#F8FAFC';
      var fgSub = isLight ? '#334155' : '#94A3B8';
      var fgMuted = isLight ? '#64748B' : '#64748B';

      /* 1. Left focal zone (cx = 246, cy = 244): spacious sculpted element totem */
      var rawNum = String(info.numLabel !== undefined && info.numLabel !== '' ? info.numLabel : info.z || '6').trim();
      var padNum = rawNum.length === 1 ? '0' + rawNum : rawNum;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.font = '600 20px ' + monoStack;
      ctx.fillStyle = info.isAvailable ? rgb01ToCss(brightAccent, 0.86) : fgMuted;
      ctx.fillText(padNum, 152, 132);

      var symStr = String(info.symbol || 'C');
      var symPx = symStr.length >= 3 ? 92 : symStr.length === 2 ? 122 : 146;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = '700 ' + symPx + 'px ' + sansStack;
      ctx.fillStyle = isLight ? fgPrimary : 'rgba(248, 250, 252, 0.94)';
      ctx.fillText(symStr, 246, 250);

      /* 2. Right zone (x: 556..1504): airy editorial title & electron configuration badge */
      var mainX = 556;
      var rightEdge = 1504;
      var contentMaxW = rightEdge - mainX;

      var rawMass = String(info.mass || '12.011').trim();
      var massStr = /u$/i.test(rawMass) ? rawMass : rawMass + ' u';
      var eConfig = formatElectronConfiguration(info.z, info.numLabel);
      var opticPrefix = isLight ? 'DAYLIGHT PRISM' : 'NIGHT OPTICS';
      var eyebrow = opticPrefix + ' · #' + padNum + ' ' + String(info.chemLabel || symStr).toUpperCase() + ' · ' + massStr + ' · ' + eConfig;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.font = '600 18px ' + monoStack;
      ctx.fillStyle = info.isAvailable ? fgMuted : fgMuted;
      ctx.fillText(truncateText(ctx, eyebrow, info.sessionBanner ? contentMaxW - 320 : contentMaxW), mainX, 64);

      if (info.sessionBanner) {
        ctx.font = '600 18px ' + sansStack;
        var bannerStr = truncateText(ctx, info.sessionBanner, 280);
        var bPillW = Math.min(308, ctx.measureText(bannerStr).width + 30);
        var bPillX = rightEdge - bPillW;
        drawRoundRectPath(ctx, bPillX, 46, bPillW, 36, 12);
        ctx.fillStyle = isLight ? 'rgba(217, 119, 6, 0.12)' : 'rgba(234, 168, 58, 0.15)';
        ctx.fill();
        ctx.fillStyle = isLight ? '#B45309' : '#FDE098';
        ctx.textAlign = 'center';
        ctx.fillText(bannerStr, bPillX + bPillW * 0.5, 64);
      }

      var mainTitle = String(info.title || info.symbol || '');
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      ctx.fillStyle = fgPrimary;
      ctx.font = '700 ' + (mainTitle.length > 26 ? '50px ' : '62px ') + sansStack;
      ctx.fillText(truncateText(ctx, mainTitle, contentMaxW), mainX, 102);

      var subText = info.isAvailable
        ? String(info.subtitle || '')
        : String(info.unreleasedText || info.subtitle || '');
      ctx.fillStyle = fgSub;
      ctx.font = '500 24px ' + sansStack;
      ctx.fillText(truncateText(ctx, subText, contentMaxW), mainX, 188);

      /* 3. Recessed frosted quartz well + convex optical glass slider (x: 556..1504, y: 296..388) */
      var caps = capsuleLayout || computeScreenEffortCapsules(info, null, null);
      if (caps.track && caps.items.length > 0) {
        var trX = 556, trY = 296, trW = 948, trH = 92, trR = 20;
        drawRoundRectPath(ctx, trX, trY, trW, trH, trR);
        ctx.fillStyle = '#0C1018';
        ctx.fill();
        ctx.lineWidth = 1.2;
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.09)';
        ctx.stroke();

        for (var ci = 0; ci < caps.items.length; ci++) {
          var item = caps.items[ci];
          var shrink = clamp(item.press, 0, 1) * 2.5;
          var bx = item.px + shrink;
          var by = trY + 6 + shrink * 0.6;
          var bw = item.pw - shrink * 2.0;
          var bh = trH - 12 - shrink * 1.2;
          var cxPill = bx + bw * 0.5;
          var cyPill = by + bh * 0.5;

          if (item.active) {
            var blockRgb = mixRgb([0.102, 0.125, 0.173], accentRgb, 0.20);
            drawRoundRectPath(ctx, bx, by, bw, bh, 15);
            ctx.fillStyle = rgb01ToCss(blockRgb, 0.95);
            ctx.fill();
            ctx.lineWidth = 1.2;
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.42)';
            ctx.stroke();

            ctx.fillStyle = rgb01ToCss(brightAccent, 1.0);
            ctx.beginPath();
            ctx.arc(cxPill - ctx.measureText(item.label).width * 0.5 - 14, cyPill + 1, 3.8, 0, TWO_PI);
            ctx.fill();

            ctx.fillStyle = '#F8FAFC';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.font = '600 24px ' + sansStack;
            ctx.fillText(item.label, cxPill + 4, cyPill + 1);
          } else {
            ctx.fillStyle = item.hover > 0.2 ? fgPrimary : fgMuted;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.font = '500 24px ' + sansStack;
            ctx.fillText(item.label, cxPill, cyPill + 1);
          }
        }
      } else {
        drawRoundRectPath(ctx, mainX, 296, contentMaxW, 92, 20);
        ctx.fillStyle = 'rgba(12, 16, 24, 0.82)';
        ctx.fill();
        ctx.lineWidth = 1.1;
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.09)';
        ctx.stroke();

        var effTitleStr = String(info.effortTitle || 'Thinking Level');
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.font = '500 22px ' + sansStack;
        ctx.fillStyle = fgMuted;
        ctx.fillText(
          info.isAvailable
            ? effTitleStr + ' · Direct Profile'
            : effTitleStr + ' · Locked Stealth Keycap',
          mainX + 32,
          342
        );
      }
      ctx.restore();
    }

    /* ============================================================================
     * 7. WebGL2 GLSL 300 es Shader Pipeline (Micro-Anodized Space Black x 3D Normal Prism Edge x Antigravity Field)
     * ============================================================================ */
    var SHADOW_SOLID_VS = [
      '#version 300 es',
      'precision highp float;',
      'layout(location = 0) in vec3 a_pos;',
      'layout(location = 3) in vec4 a_params;',
      'uniform mat4 u_lightViewProj;',
      'uniform mat4 u_model;',
      'void main() {',
      '  if ((a_params.w > 2.5 && a_params.w < 3.5) || a_params.w > 6.5) {',
      '    gl_Position = vec4(2.0, 2.0, 2.0, 1.0);',
      '    return;',
      '  }',
      '  gl_Position = u_lightViewProj * (u_model * vec4(a_pos, 1.0));',
      '}',
    ].join('\n');

    var SHADOW_KEYCAP_VS = [
      '#version 300 es',
      'precision highp float;',
      'layout(location = 0) in vec3 a_pos;',
      'layout(location = 4) in vec4 a_m0;',
      'layout(location = 5) in vec4 a_m1;',
      'layout(location = 6) in vec4 a_m2;',
      'layout(location = 7) in vec4 a_m3;',
      'uniform mat4 u_lightViewProj;',
      'uniform mat4 u_chassisMat;',
      'uniform mat4 u_auxChassisMat;',
      'void main() {',
      '  mat4 localM = mat4(a_m0, a_m1, a_m2, a_m3);',
      '  vec4 cp = localM * vec4(a_pos, 1.0);',
      '  mat4 activeChassis = (cp.x > 9.82) ? u_auxChassisMat : u_chassisMat;',
      '  vec4 wp = activeChassis * cp;',
      '  gl_Position = u_lightViewProj * wp;',
      '}',
    ].join('\n');

    var SHADOW_EMPTY_FS = [
      '#version 300 es',
      'precision highp float;',
      'void main() {}',
    ].join('\n');

    var GLSL_PBR_COMMON = [
      'const float PI = 3.14159265359;',
      '',
      'float grainTexelSize(sampler2D tex) {',
      '  return 1.0 / float(max(textureSize(tex, 0).x, 1));',
      '}',
      '',
      'vec3 srgbToLinear(vec3 c) {',
      '  return pow(max(c, vec3(0.0)), vec3(2.2));',
      '}',
      '',
      'vec3 acesToneMap(vec3 x) {',
      '  const float a = 2.51;',
      '  const float b = 0.03;',
      '  const float c = 2.43;',
      '  const float d = 0.59;',
      '  const float e = 0.14;',
      '  return clamp((x * (a * x + b)) / (x * (c * x + d) + e), 0.0, 1.0);',
      '}',
      '',
      'vec3 linearToDisplaySrgb(vec3 linCol, vec2 fragCoord) {',
      '  vec3 mapped = acesToneMap(max(linCol, vec3(0.0)));',
      '  vec3 srgb = pow(mapped, vec3(1.0 / 2.2));',
      '  float dither = fract(52.9829189 * fract(dot(fragCoord, vec2(0.06711056, 0.00583715)))) - 0.5;',
      '  return clamp(srgb + dither / 255.0, 0.0, 1.0);',
      '}',
      '',
      'float D_GGX(float ndh, float alpha) {',
      '  float a2 = alpha * alpha;',
      '  float d = (ndh * ndh) * (a2 - 1.0) + 1.0;',
      '  return a2 / max(PI * d * d, 1e-6);',
      '}',
      '',
      'float V_SmithGGX(float ndv, float ndl, float alpha) {',
      '  float a2 = alpha * alpha;',
      '  float gv = ndl * sqrt(ndv * (ndv - ndv * a2) + a2);',
      '  float gl = ndv * sqrt(ndl * (ndl - ndl * a2) + a2);',
      '  return 0.5 / max(gv + gl, 1e-5);',
      '}',
      '',
      'vec3 F_Schlick(float vdh, vec3 f0) {',
      '  return f0 + (1.0 - f0) * pow(clamp(1.0 - vdh, 0.0, 1.0), 5.0);',
      '}',
      '',
      'vec3 F_SchlickRoughness(float ndv, vec3 f0, float rough) {',
      '  return f0 + (max(vec3(1.0 - rough), f0) - f0) * pow(clamp(1.0 - ndv, 0.0, 1.0), 5.0);',
      '}',
      '',
      'vec2 dirToEquirectUv(vec3 d) {',
      '  float phi = (abs(d.x) < 1e-5 && abs(d.z) < 1e-5) ? 0.0 : atan(d.z, d.x);',
      '  float u = phi * (0.5 / PI) + 0.5;',
      '  float v = acos(clamp(d.y, -1.0, 1.0)) / PI;',
      '  return vec2(u, v);',
      '}',
      '',
      '/* 6 family prism spectra aligned with prism-rim-canvas.js (default / warm / cobalt / iris / amber / mono) */',
      'vec3 mix4Stops(vec3 c0, vec3 c1, vec3 c2, vec3 c3, float t) {',
      '  float p = fract(t);',
      '  float s = p * 4.0;',
      '  if (s < 1.0) return mix(c0, c1, smoothstep(0.0, 1.0, s));',
      '  if (s < 2.0) return mix(c1, c2, smoothstep(0.0, 1.0, s - 1.0));',
      '  if (s < 3.0) return mix(c2, c3, smoothstep(0.0, 1.0, s - 2.0));',
      '  return mix(c3, c0, smoothstep(0.0, 1.0, s - 3.0));',
      '}',
      '',
      'vec3 samplePrismSpectrum6(float phase, float coreSharp, float toneIdx, float isLight) {',
      '  vec3 specSrgb;',
      '  vec3 coreSrgb = vec3(1.0, 1.0, 1.0);',
      '  if (toneIdx > 4.5) {',
      '    /* 5: mono */',
      '    specSrgb = isLight > 0.5',
      '      ? mix4Stops(vec3(0.118, 0.161, 0.231), vec3(0.200, 0.255, 0.333), vec3(0.392, 0.455, 0.545), vec3(0.580, 0.639, 0.722), phase)',
      '      : mix4Stops(vec3(0.886, 0.910, 0.941), vec3(0.580, 0.639, 0.722), vec3(0.392, 0.455, 0.545), vec3(0.796, 0.835, 0.882), phase);',
      '    coreSrgb = isLight > 0.5 ? vec3(0.92, 0.95, 0.99) : vec3(0.97, 0.98, 1.00);',
      '  } else if (toneIdx > 3.5) {',
      '    /* 4: amber */',
      '    specSrgb = isLight > 0.5',
      '      ? mix4Stops(vec3(0.573, 0.251, 0.055), vec3(0.706, 0.325, 0.035), vec3(0.851, 0.467, 0.024), vec3(0.961, 0.620, 0.043), phase)',
      '      : mix4Stops(vec3(0.992, 0.902, 0.541), vec3(0.949, 0.722, 0.294), vec3(0.851, 0.467, 0.024), vec3(0.980, 0.816, 0.365), phase);',
      '    coreSrgb = vec3(1.00, 0.985, 0.92);',
      '  } else if (toneIdx > 2.5) {',
      '    /* 3: iris */',
      '    specSrgb = isLight > 0.5',
      '      ? mix4Stops(vec3(0.357, 0.129, 0.714), vec3(0.486, 0.227, 0.929), vec3(0.545, 0.361, 0.965), vec3(0.659, 0.333, 0.969), phase)',
      '      : mix4Stops(vec3(0.867, 0.839, 0.996), vec3(0.647, 0.541, 0.973), vec3(0.427, 0.157, 0.851), vec3(0.765, 0.690, 0.988), phase);',
      '    coreSrgb = vec3(0.965, 0.955, 1.00);',
      '  } else if (toneIdx > 1.5) {',
      '    /* 2: cobalt */',
      '    specSrgb = isLight > 0.5',
      '      ? mix4Stops(vec3(0.114, 0.306, 0.847), vec3(0.145, 0.388, 0.922), vec3(0.008, 0.518, 0.780), vec3(0.220, 0.741, 0.973), phase)',
      '      : mix4Stops(vec3(0.486, 0.886, 1.000), vec3(0.259, 0.522, 0.957), vec3(0.106, 0.286, 0.698), vec3(0.380, 0.720, 0.985), phase);',
      '    coreSrgb = vec3(0.945, 0.980, 1.00);',
      '  } else if (toneIdx > 0.5) {',
      '    /* 1: warm */',
      '    specSrgb = isLight > 0.5',
      '      ? mix4Stops(vec3(0.604, 0.204, 0.071), vec3(0.761, 0.349, 0.204), vec3(0.851, 0.467, 0.341), vec3(0.851, 0.467, 0.024), phase)',
      '      : mix4Stops(vec3(0.965, 0.741, 0.376), vec3(0.941, 0.639, 0.494), vec3(0.851, 0.467, 0.341), vec3(0.953, 0.686, 0.420), phase);',
      '    coreSrgb = vec3(1.00, 0.965, 0.933);',
      '  } else {',
      '    /* 0: default (#FFFFFF -> #4285F4 Cobalt -> #9B72CB Iris -> #EA4335 Coral -> #FBBC04 Amber) */',
      '    specSrgb = isLight > 0.5',
      '      ? mix4Stops(vec3(0.145, 0.388, 0.922), vec3(0.486, 0.227, 0.929), vec3(0.918, 0.263, 0.208), vec3(0.851, 0.467, 0.024), phase)',
      '      : mix4Stops(vec3(0.259, 0.522, 0.957), vec3(0.608, 0.447, 0.796), vec3(0.918, 0.263, 0.208), vec3(0.984, 0.737, 0.016), phase);',
      '    coreSrgb = vec3(1.00, 1.00, 1.00);',
      '  }',
      '  vec3 specLin = srgbToLinear(specSrgb);',
      '  vec3 coreLin = srgbToLinear(coreSrgb);',
      '  float kCore = clamp(coreSharp, 0.0, 1.0);',
      '  return mix(specLin, coreLin * mix(1.38, 1.12, isLight), kCore * mix(0.88, 0.56, isLight));',
      '}',
      '',
      '/* V9 razor-sharp 1px specular filament prism edge (82% pure white specular core + 18% crisp subtle dispersion) */',
      'vec3 evalTrue3DPrismRim(',
      '  vec3 localPos,',
      '  vec3 worldN,',
      '  vec3 V,',
      '  float chamferMask,',
      '  float edgeArcPhase,',
      '  vec4 prismFocusPos,',
      '  vec4 prismCfg,',
      '  float ambientMul,',
      '  float isLight',
      ') {',
      '  if (chamferMask <= 0.02 || ambientMul <= 0.01) return vec3(0.0);',
      '  /* Steep chamfer power lights only the 0.04U screen inner lip and outer 45-deg diamond bevel as a 1-1.5px razor filament */',
      '  float razorMask = pow(clamp(chamferMask, 0.0, 1.0), 3.6);',
      '  if (razorMask <= 0.002) return vec3(0.0);',
      '  float toneIdx = prismCfg.x;',
      '  float sweepX = prismCfg.y;',
      '  float sweepW = prismCfg.z;',
      '  float ePulse = prismCfg.w;',
      '',
      '  float isWarmTone = ((toneIdx > 0.5 && toneIdx < 1.5) || (toneIdx > 3.5 && toneIdx < 4.5)) ? 1.0 : 0.0;',
      '  vec3 pureWhiteSrgb = mix(vec3(0.973, 0.980, 0.988), vec3(1.000, 0.992, 0.969), isWarmTone);',
      '  vec3 pureWhiteLin = srgbToLinear(pureWhiteSrgb) * mix(1.42, 1.14, isLight);',
      '',
      '  float ndvAbs = clamp(abs(dot(worldN, V)), 0.0, 1.0);',
      '  float fres3D = 0.24 + 0.76 * pow(1.0 - ndvAbs, 2.35);',
      '  vec3 Hprism = normalize(V + normalize(vec3(-V.x * 0.42 + 0.22, 0.78, -V.z * 0.42 + 0.26)));',
      '  float specFilament = pow(max(dot(worldN, Hprism), 0.0), 26.0);',
      '  float softSheen = pow(max(dot(worldN, Hprism), 0.0), 8.0);',
      '',
      '  vec3 outRim = vec3(0.0);',
      '  /* V13.1 precision CNC 6063 45-deg silver/champagne metallic chamfer sweep (restrained, highlighting machined edge sharpness) */',
      '  float idlePhase = fract(edgeArcPhase * 1.45 + worldN.x * 0.28 - worldN.z * 0.24 + V.x * 0.35);',
      '  vec3 idleSpecCol = mix(pureWhiteLin, samplePrismSpectrum6(idlePhase, 0.45, toneIdx, isLight), 0.06);',
      '  outRim += idleSpecCol * (razorMask * (0.18 * specFilament + 0.052 * softSheen) * fres3D * mix(1.08, 0.78, isLight));',
      '',
      '  float focusActive = prismFocusPos.w;',
      '  if (focusActive > 0.004) {',
      '    vec3 dVec = localPos - prismFocusPos.xyz;',
      '    float dist2 = dot(dVec, dVec);',
      '    float wingEnv = exp(-dist2 * 0.20);',
      '    float whiteCore = exp(-dist2 * 1.45);',
      '    float coreRatio = clamp(whiteCore / max(wingEnv, 1e-4), 0.0, 1.0);',
      '    float tangentPhase = fract(edgeArcPhase * 1.85 + (worldN.x * 0.26 - worldN.z * 0.22) + (dVec.x - dVec.z) * 0.055);',
      '    vec3 rawSpecLin = samplePrismSpectrum6(tangentPhase, 0.18, toneIdx, isLight);',
      '    vec3 clearDispLin = mix(pureWhiteLin, rawSpecLin, 0.16);',
      '    float tailDispMix = mix(0.02, 0.09, 1.0 - coreRatio);',
      '    vec3 filamentCol = mix(pureWhiteLin, clearDispLin, tailDispMix);',
      '    float intensity = razorMask * (wingEnv * (0.34 + 0.88 * specFilament + 0.26 * softSheen) + whiteCore * 0.64) * fres3D * focusActive;',
      '    outRim += filamentCol * intensity * mix(1.62, 0.96, isLight);',
      '  }',
      '',
      '  if (sweepW > 0.004) {',
      '    float dxS = localPos.x - sweepX;',
      '    float swBand = exp(-dxS * dxS * 1.18) * sweepW;',
      '    float swCore = exp(-dxS * dxS * 3.80) * sweepW;',
      '    float swRatio = clamp(swCore / max(swBand, 1e-4), 0.0, 1.0);',
      '    float swPhase = fract(edgeArcPhase * 1.5 + localPos.x * 0.052 + worldN.z * 0.18);',
      '    vec3 swTint = mix(pureWhiteLin, samplePrismSpectrum6(swPhase, 0.0, toneIdx, isLight), 0.55);',
      '    vec3 swCol = mix(pureWhiteLin, swTint, mix(0.04, 0.19, 1.0 - swRatio));',
      '    outRim += swCol * (swBand * razorMask * (0.48 + 0.52 * fres3D) * mix(1.18, 0.78, isLight));',
      '  }',
      '',
      '  if (ePulse > 0.004) {',
      '    float pPhase = fract(edgeArcPhase * 1.6 + worldN.x * 0.20 - ePulse * 0.28);',
      '    vec3 pTint = mix(pureWhiteLin, samplePrismSpectrum6(pPhase, 0.0, toneIdx, isLight), 0.52);',
      '    vec3 pCol = mix(pureWhiteLin, pTint, 0.18);',
      '    outRim += pCol * (razorMask * ePulse * 0.28 * fres3D * mix(1.12, 0.74, isLight));',
      '  }',
      '',
      '  return outRim * ambientMul;',
      '}',
      '',
      'vec3 sampleStudioHDRI(vec3 R, float roughness, float isLightTheme) {',
      '  vec3 d = normalize(R);',
      '  float blur = mix(0.016, 0.54, roughness * roughness);',
      '  /* Space Black neutral studio dome: eliminates blue-gray cast and haze on dark chassis */',
      '  vec3 zenith = mix(vec3(0.036, 0.038, 0.044), vec3(0.34, 0.36, 0.41), isLightTheme);',
      '  vec3 nadir = mix(vec3(0.009, 0.010, 0.013), vec3(0.12, 0.13, 0.15), isLightTheme);',
      '  vec3 env = mix(nadir, zenith, smoothstep(-0.32, 0.78, d.y));',
      '',
      '  /* Front-left overhead main softbox reflection */',
      '  if (d.y > 0.04) {',
      '    vec2 ceilUv = d.xz / max(d.y, 0.10);',
      '    vec2 sbDelta = abs(ceilUv - vec2(-0.42, 0.44)) - vec2(1.18, 0.44);',
      '    float sbDist = length(max(sbDelta, 0.0)) + min(max(sbDelta.x, sbDelta.y), 0.0);',
      '    float sbMask = 1.0 - smoothstep(-blur * 0.42, blur * 1.30 + 0.04, sbDist);',
      '    float silkFalloff = 1.0 - 0.24 * clamp(length(ceilUv - vec2(-0.42, 0.44)) * 0.48, 0.0, 1.0);',
      '    float sbScale = mix(1.06, 0.90, isLightTheme);',
      '    env += vec3(2.55, 2.52, 2.48) * sbScale * sbMask * silkFalloff * smoothstep(0.04, 0.28, d.y);',
      '  }',
      '',
      '  /* Lower studio silver bounce reflector for clear metallic separation when inspecting tapered underbody & PVD weight */',
      '  if (d.y < -0.12) {',
      '    float underBounce = smoothstep(-0.12, -0.72, d.y) * smoothstep(-0.45, 0.65, d.z);',
      '    env += mix(vec3(0.42, 0.45, 0.52), vec3(0.56, 0.58, 0.64), isLightTheme) * underBounce * (1.0 - roughness * 0.55);',
      '  }',
      '',
      '  /* Rear-right dramatic rim backlight bar */',
      '  vec3 rimDir = normalize(vec3(0.62, 0.46, -0.63));',
      '  float rimDot = max(dot(d, rimDir), 0.0);',
      '  float rimBand = smoothstep(0.83 - blur * 0.48, 0.968, rimDot);',
      '  env += vec3(1.18, 1.32, 1.62) * rimBand;',
      '',
      '  /* Front-right warm champagne fill bounce card */',
      '  vec3 fillDir = normalize(vec3(0.52, 0.38, 0.76));',
      '  float fillDot = max(dot(d, fillDir), 0.0);',
      '  float fillCard = smoothstep(0.78 - blur * 0.50, 0.945, fillDot);',
      '  env += vec3(0.84, 0.78, 0.70) * fillCard;',
      '',
      '  return env;',
      '}',
      '',
      'vec3 sampleMetalStudioEnv(sampler2D metalEnvTex, vec3 R, float roughness, float isLightTheme) {',
      '  vec3 d = normalize(R);',
      '  vec2 uv = dirToEquirectUv(d);',
      '  float lod = clamp(0.85 + roughness * 5.2, 0.0, 5.0);',
      '  vec3 texSrgb = textureLod(metalEnvTex, uv, lod).rgb;',
      '  vec3 texLin = srgbToLinear(texSrgb);',
      '  float luma = dot(texLin, vec3(0.2126, 0.7152, 0.0722));',
      '  float stripBoost = 1.0 + smoothstep(0.24, 0.88, luma) * mix(2.15, 1.65, isLightTheme);',
      '  vec3 texHdr = texLin * stripBoost;',
      '  vec3 analyticHdr = sampleStudioHDRI(d, roughness, isLightTheme);',
      '  float diagArg = clamp(1.0 - abs(d.x * -0.56 + d.z * 0.52 - 0.10) / (0.44 + roughness * 0.52), 0.0, 1.0);',
      '  float diagBand = diagArg * diagArg * (3.0 - 2.0 * diagArg) * smoothstep(-0.16, 0.52, d.y);',
      '  vec3 diagStrip = vec3(1.42, 1.46, 1.56) * diagBand * mix(0.68, 0.64, isLightTheme);',
      '  vec3 baseLift = mix(vec3(0.0), vec3(0.22, 0.23, 0.26), isLightTheme * smoothstep(-0.28, 0.80, d.y));',
      '  return mix(analyticHdr, texHdr, mix(0.22, 0.34, isLightTheme)) + diagStrip + baseLift;',
      '}',
      '',
      'float sampleVogelShadow(sampler2D shadowTex, mat4 lightVP, vec3 worldPos, vec3 worldN, vec3 lightDir, float shadowEnabled) {',
      '  if (shadowEnabled < 0.5) return 1.0;',
      '  float ndl = max(dot(worldN, lightDir), 0.0);',
      '  vec3 biasedPos = worldPos + worldN * (0.016 + 0.014 * (1.0 - ndl));',
      '  vec4 ls = lightVP * vec4(biasedPos, 1.0);',
      '  vec3 proj = ls.xyz / max(ls.w, 1e-5) * 0.5 + 0.5;',
      '  if (proj.x <= 0.002 || proj.x >= 0.998 || proj.y <= 0.002 || proj.y >= 0.998 || proj.z >= 0.999) {',
      '    return 1.0;',
      '  }',
      '  float bias = max(0.0018 * (1.0 - ndl), 0.00065);',
      '  float ign = fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715)))) * 6.2831853;',
      '  float ca = cos(ign);',
      '  float sa = sin(ign);',
      '  /* 6-tap precomputed Vogel Disk PCF + IGN rotation jitter: cuts texture/trig cost by >50% with smooth soft shadow edges */',
      '  const vec2 vogel6[6] = vec2[6](',
      '    vec2( 0.000678,  0.000000),',
      '    vec2(-0.000866,  0.000794),',
      '    vec2( 0.000133, -0.001511),',
      '    vec2( 0.001122,  0.001407),',
      '    vec2(-0.002016, -0.000321),',
      '    vec2( 0.001614, -0.001577)',
      '  );',
      '  float lit = 0.0;',
      '  for (int i = 0; i < 6; i++) {',
      '    vec2 d = vogel6[i];',
      '    vec2 rotOff = vec2(ca * d.x - sa * d.y, sa * d.x + ca * d.y);',
      '    float occDepth = textureLod(shadowTex, proj.xy + rotOff, 0.0).r;',
      '    lit += (proj.z - bias <= occDepth) ? 1.0 : 0.0;',
      '  }',
      '  return lit * (1.0 / 6.0);',
      '}',
    ].join('\n');

    var SOLID_VS = [
      '#version 300 es',
      'precision highp float;',
      'layout(location = 0) in vec3 a_pos;',
      'layout(location = 1) in vec3 a_normal;',
      'layout(location = 2) in vec3 a_color;',
      'layout(location = 3) in vec4 a_params;',
      'layout(location = 4) in vec2 a_uv;',
      'uniform mat4 u_viewProj;',
      'uniform mat4 u_model;',
      'uniform vec3 u_camPos;',
      'uniform vec4 u_envParams;',
      'uniform vec4 u_prismConfig;',
      'out vec3 v_worldPos;',
      'out vec3 v_localPos;',
      'out vec3 v_normal;',
      'out vec3 v_color;',
      'out vec4 v_params;',
      'out vec2 v_uv;',
      'void main() {',
      '  vec3 pos = a_pos;',
      '  vec3 nrm = a_normal;',
      '  float kind = a_params.w;',
      '  vec4 wp;',
      '  if (kind > 6.5) {',
      '    float phaseT = u_envParams.w;',
      '    float ePulseF = u_prismConfig.w;',
      '    if (kind < 7.15) {',
      '      float ringIdx = a_params.x;',
      '      float radExpand = 1.0 + ePulseF * 0.14 + 0.038 * sin(phaseT * 2.4 + ringIdx * 2.1);',
      '      float wobX = sin(phaseT * 1.8 + ringIdx * 1.7) * 0.042;',
      '      float wobZ = cos(phaseT * 1.5 + ringIdx * 2.3) * 0.042;',
      '      pos.x += a_normal.x * (radExpand - 1.0);',
      '      pos.z += a_normal.z * (radExpand - 1.0);',
      '      pos.y += (a_normal.x * wobZ - a_normal.z * wobX) * (0.35 + 0.32 * ringIdx);',
      '      nrm = vec3(0.0, 1.0, 0.0);',
      '      wp = u_model * vec4(pos, 1.0);',
      '    } else if (kind > 7.45 && kind < 7.85) {',
      '      float cSeed = a_params.x;',
      '      pos.y += sin(phaseT * 1.65 + cSeed * 6.2831853) * 0.032 + ePulseF * 0.025;',
      '      wp = u_model * vec4(pos, 1.0);',
      '    } else if (kind > 7.85) {',
      '      float mSeed = a_params.x;',
      '      pos.y += sin(phaseT * 1.9 + mSeed * 6.2831853) * 0.042;',
      '      float mSize = clamp(a_normal.x, 0.005, 0.065) * (1.0 + ePulseF * 0.35 + 0.16 * sin(phaseT * 2.6 + mSeed * 12.56637));',
      '      vec3 wpCenter = (u_model * vec4(pos, 1.0)).xyz;',
      '      vec3 toCam = normalize(u_camPos - wpCenter);',
      '      vec3 upRef = abs(toCam.y) > 0.99 ? vec3(0.0, 0.0, 1.0) : vec3(0.0, 1.0, 0.0);',
      '      vec3 bRight = normalize(cross(upRef, toCam));',
      '      vec3 bUp = cross(toCam, bRight);',
      '      wp = vec4(wpCenter + (bRight * a_uv.x + bUp * a_uv.y) * mSize, 1.0);',
      '      nrm = vec3(0.0, 1.0, 0.0);',
      '    } else {',
      '      wp = u_model * vec4(pos, 1.0);',
      '    }',
      '  } else {',
      '    wp = u_model * vec4(pos, 1.0);',
      '  }',
      '  v_worldPos = wp.xyz;',
      '  v_localPos = pos;',
      '  v_normal = normalize(mat3(u_model) * nrm);',
      '  v_color = a_color;',
      '  v_params = a_params;',
      '  v_uv = a_uv;',
      '  gl_Position = u_viewProj * wp;',
      '}',
    ].join('\n');

    var SOLID_FS = [
      '#version 300 es',
      'precision highp float;',
      'in vec3 v_worldPos;',
      'in vec3 v_localPos;',
      'in vec3 v_normal;',
      'in vec3 v_color;',
      'in vec4 v_params;',
      'in vec2 v_uv;',
      'uniform vec3 u_camPos;',
      'uniform vec3 u_lightDir;',
      'uniform vec3 u_rimTint;',
      'uniform vec4 u_envParams;',
      'uniform vec4 u_liftCapShadow;',
      'uniform vec4 u_switchLightPos;',
      'uniform vec3 u_switchLightColor;',
      'uniform vec4 u_prismFocusPos;',
      'uniform vec4 u_prismConfig;',
      'uniform mat4 u_lightViewProj;',
      'uniform sampler2D u_shadowTex;',
      'uniform sampler2D u_grainTex;',
      'uniform sampler2D u_metalEnvTex;',
      'out vec4 outColor;',
      '',
      GLSL_PBR_COMMON,
      '',
      'float sdRoundBox2D(vec2 p, vec2 b, float r) {',
      '  vec2 q = abs(p) - b + r;',
      '  return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r;',
      '}',
      '',
      'void main() {',
      '  float kind = v_params.w;',
      '  if (kind > 2.5 && kind < 3.5) {',
      '    vec2 p = v_localPos.xz - vec2(0.05, 0.38);',
      '    float d = sdRoundBox2D(p, vec2(9.64, 4.20), 0.56);',
      '    float contactAo = exp(-max(d, 0.0) * 5.4) * 0.64;',
      '    float softDrop = smoothstep(0.58, -0.20, d) * 0.54;',
      '    float alpha = clamp((contactAo + softDrop) * v_params.x, 0.0, 0.80);',
      '    outColor = vec4(0.0, 0.0, 0.0, alpha);',
      '    return;',
      '  }',
      '  /* kind > 6.5: V11 effort-scaled antigravity flux rings (7.0) + condenser pillar (7.3) + 3D octahedral crystals (7.6) + bokeh motes (8.0) */',
      '  if (kind > 6.5) {',
      '    float liftGate = smoothstep(0.02, 0.30, u_liftCapShadow.w);',
      '    float visAlpha = v_params.y * liftGate;',
      '    if (visAlpha <= 0.003) discard;',
      '    float phaseT = u_envParams.w;',
      '    float isLightF = u_envParams.x;',
      '    float toneIdxF = u_prismConfig.x;',
      '    float ePulseF = u_prismConfig.w;',
      '    float slamCollapse = clamp(v_params.z, 0.0, 1.0);',
      '    vec3 elemLin = srgbToLinear(v_color);',
      '    if (kind < 7.15) {',
      '      float uAng = v_uv.x;',
      '      float radT = abs(v_uv.y);',
      '      float ringIdx = v_params.x;',
      '      float radialCore = exp(-radT * radT * 3.1);',
      '      float dirSign = mod(ringIdx, 2.0) < 0.5 ? 1.0 : -1.25;',
      '      float wave1 = 0.56 + 0.44 * sin((uAng * 2.0 + phaseT * 0.36 * dirSign) * 6.2831853);',
      '      float wave2 = 0.65 + 0.35 * cos((uAng * 3.0 - phaseT * 0.24 * dirSign + ringIdx * 0.4) * 6.2831853);',
      '      float specPhase = fract(uAng * 1.5 + phaseT * 0.16 * dirSign + ringIdx * 0.33);',
      '      vec3 prismLin = samplePrismSpectrum6(specPhase, radialCore * wave1 * 0.58, toneIdxF, isLightF);',
      '      vec3 ringLin = mix(elemLin * 1.52, prismLin * 1.36, 0.58) * (1.0 + ePulseF * 0.90 + slamCollapse * 0.65);',
      '      vec3 ringSrgb = linearToDisplaySrgb(ringLin * (2.15 + ePulseF * 0.85), gl_FragCoord.xy);',
      '      float rAlpha = clamp(radialCore * (0.56 + 0.52 * wave1 * wave2) * visAlpha * mix(0.96, 0.82, isLightF) * (1.0 + ePulseF * 0.35), 0.0, 0.98);',
      '      outColor = vec4(ringSrgb * rAlpha, rAlpha * mix(0.30, 0.72, isLightF));',
      '    } else if (kind < 7.45) {',
      '      /* High / Extra exclusive: luminous vertical condenser energy pillar */',
      '      float pHeightT = clamp(v_uv.y, 0.0, 1.0);',
      '      vec3 Vpil = normalize(u_camPos - v_worldPos);',
      '      vec3 Npil = normalize(v_normal);',
      '      float centerCore = pow(clamp(abs(dot(Npil, Vpil)), 0.0, 1.0), 1.45);',
      '      float vertEnv = smoothstep(0.0, 0.16, pHeightT) * pow(max(0.0, 1.0 - pHeightT * 0.88), 1.35);',
      '      float shimmerP = 0.74 + 0.26 * sin((v_uv.x * 3.0 - phaseT * 0.55 + pHeightT * 0.8) * 6.2831853);',
      '      vec3 pPrism = samplePrismSpectrum6(fract(v_uv.x + pHeightT * 0.45 - phaseT * 0.20), centerCore * 0.75, toneIdxF, isLightF);',
      '      vec3 pilLin = mix(elemLin * 1.65, pPrism * 1.35, 0.44) * (1.85 + ePulseF * 0.95);',
      '      vec3 pilSrgb = linearToDisplaySrgb(pilLin, gl_FragCoord.xy);',
      '      float pAlpha = clamp(centerCore * vertEnv * shimmerP * visAlpha * mix(0.46, 0.34, isLightF), 0.0, 0.85);',
      '      outColor = vec4(pilSrgb * pAlpha, pAlpha * mix(0.24, 0.58, isLightF));',
      '    } else if (kind < 7.85) {',
      '      /* 3D faceted octahedral micro-crystals: true face-normal Fresnel diamond fire + specular glint */',
      '      vec3 Vcr = normalize(u_camPos - v_worldPos);',
      '      vec3 Ncr = normalize(v_normal);',
      '      vec3 Lcr = normalize(u_lightDir);',
      '      float ndvCr = abs(dot(Ncr, Vcr));',
      '      float fresCr = 0.26 + 0.74 * pow(1.0 - clamp(ndvCr, 0.0, 1.0), 2.2);',
      '      vec3 Hcr = normalize(Vcr + Lcr);',
      '      float facetGlint = pow(max(abs(dot(Ncr, Hcr)), 0.0), 22.0);',
      '      float facetBody = 0.38 + 0.62 * max(abs(dot(Ncr, Lcr)), 0.0);',
      '      float apexBright = 0.75 + 0.45 * abs(v_uv.y);',
      '      float crPhase = fract(v_params.x * 1.9 + ndvCr * 0.55 + phaseT * 0.24);',
      '      vec3 crPrism = samplePrismSpectrum6(crPhase, facetGlint * 0.92 + 0.25, toneIdxF, isLightF);',
      '      vec3 crLin = (elemLin * (1.55 * facetBody * apexBright) + crPrism * (0.95 * fresCr + 2.40 * facetGlint)) * (1.95 + ePulseF * 0.95);',
      '      vec3 crSrgb = linearToDisplaySrgb(crLin, gl_FragCoord.xy);',
      '      float crAlpha = clamp((0.52 + 0.44 * fresCr + 0.45 * facetGlint) * visAlpha * mix(0.96, 0.88, isLightF), 0.0, 0.98);',
      '      outColor = vec4(crSrgb * crAlpha, crAlpha * mix(0.42, 0.78, isLightF));',
      '    } else {',
      '      float r2 = dot(v_uv, v_uv);',
      '      if (r2 > 1.0) discard;',
      '      float moteCore = exp(-r2 * 4.4);',
      '      float moteHalo = exp(-r2 * 1.55) * 0.72;',
      '      float mPhase = fract(v_params.x * 2.7 + phaseT * 0.22);',
      '      vec3 mPrism = samplePrismSpectrum6(mPhase, moteCore * 0.80, toneIdxF, isLightF);',
      '      vec3 moteLin = mix(elemLin * 1.55, mPrism * 1.40, 0.62) * (2.35 + ePulseF * 1.10);',
      '      vec3 moteSrgb = linearToDisplaySrgb(moteLin, gl_FragCoord.xy);',
      '      float mAlpha = clamp((moteCore + moteHalo) * visAlpha * mix(0.98, 0.85, isLightF), 0.0, 0.98);',
      '      outColor = vec4(moteSrgb * mAlpha, mAlpha * mix(0.28, 0.72, isLightF));',
      '    }',
      '    return;',
      '  }',
      '',
      '  float rough = v_params.x;',
      '  float metal = v_params.y;',
      '  float emis = v_params.z;',
      '  float isLight = u_envParams.x;',
      '  float ambientMul = u_envParams.z;',
      '  float chamferMask = v_uv.x;',
      '  float edgeArcPhase = v_uv.y;',
      '  vec3 albedo = srgbToLinear(v_color);',
      '',
      '  vec3 baseN = normalize(v_normal);',
      '  vec3 N = baseN;',
      '  if (kind < 0.5) {',
      '    /* 220-grit isotropic Space Black / Starlight micro-blasted anodized aluminum: seamless triplanar micro-grain sampling */',
      '    vec3 triW = pow(abs(baseN), vec3(4.0));',
      '    triW /= max(triW.x + triW.y + triW.z, 1e-4);',
      '    float gScale = 2.95;',
      '    float gStep = grainTexelSize(u_grainTex);',
      '    float beadY = texture(u_grainTex, v_localPos.xz * gScale).g;',
      '    float beadZ = texture(u_grainTex, v_localPos.xy * gScale).g;',
      '    float beadX = texture(u_grainTex, v_localPos.zy * gScale).g;',
      '    float beadH = beadX * triW.x + beadY * triW.y + beadZ * triW.z;',
      '    float pxFoot = max(length(fwidth(v_localPos.xz)), length(fwidth(v_localPos.xy)));',
      '    float aaWeight = 1.0 - smoothstep(0.035, 0.15, pxFoot);',
      '    float ignGrain = fract(52.9829189 * fract(dot(floor(gl_FragCoord.xy), vec2(0.06711056, 0.00583715)))) - 0.5;',
      '    if (aaWeight > 0.02) {',
      '      float beadHx = texture(u_grainTex, v_localPos.xz * gScale + vec2(gStep, 0.0)).g;',
      '      float beadHz = texture(u_grainTex, v_localPos.xz * gScale + vec2(0.0, gStep)).g;',
      '      vec3 T_iso = abs(baseN.y) < 0.99 ? normalize(cross(vec3(0.0, 1.0, 0.0), baseN)) : vec3(1.0, 0.0, 0.0);',
      '      vec3 B_iso = normalize(cross(baseN, T_iso));',
      '      float dBx = (beadHx - beadY) * aaWeight * 0.017 + ignGrain * 0.0032;',
      '      float dBz = (beadHz - beadY) * aaWeight * 0.017 - ignGrain * 0.0032;',
      '      N = normalize(baseN + T_iso * dBx + B_iso * dBz);',
      '    }',
      '    rough = clamp(rough + (beadH - 0.5) * 0.018 * aaWeight, 0.19, 0.32);',
      '  } else if (kind > 4.5 && kind < 5.5) {',
      '    float gStep = grainTexelSize(u_grainTex);',
      '    vec2 pcUv = (v_localPos.xz + baseN.xz * v_localPos.y) * 1.15;',
      '    float pcG = texture(u_grainTex, pcUv).r;',
      '    float pcGx = texture(u_grainTex, pcUv + vec2(gStep, 0.0)).r;',
      '    N = normalize(baseN + vec3(pcGx - pcG, 0.0, pcG - 0.5) * 0.055);',
      '  }',
      '',
      '  vec3 V = normalize(u_camPos - v_worldPos);',
      '  vec3 L = normalize(u_lightDir);',
      '  vec3 H = normalize(V + L);',
      '  float ndv = max(dot(N, V), 1e-4);',
      '  float ndl = max(dot(N, L), 0.0);',
      '  float ndh = max(dot(N, H), 0.0);',
      '  float vdh = max(dot(V, H), 0.0);',
      '',
      '  /* kind == 4: ultra-fine matte micro-metal waistline seam (subdued static saturation; reveals cool prism sheen on near-field or pulse) */',
      '  if (kind > 3.5 && kind < 4.5) {',
      '    vec3 Rw = reflect(-V, baseN);',
      '    float fresW = 0.06 + 0.94 * pow(1.0 - max(dot(baseN, V), 0.0), 3.8);',
      '    vec3 matteMetalRefl = sampleMetalStudioEnv(u_metalEnvTex, Rw, 0.28, isLight) * fresW * mix(0.24, 0.22, isLight);',
      '    float idlePhase = fract(edgeArcPhase * 1.35 + baseN.x * 0.14 - baseN.z * 0.14);',
      '    vec3 coolNeutral = srgbToLinear(mix(vec3(0.76, 0.80, 0.88), vec3(0.88, 0.90, 0.94), isLight));',
      '    vec3 desatIdleTint = mix(coolNeutral, samplePrismSpectrum6(idlePhase, 0.82, u_prismConfig.x, isLight), 0.38);',
      '    vec3 quietCore = desatIdleTint * (emis * ambientMul * mix(0.32, 0.22, isLight));',
      '    vec3 waistPrism = evalTrue3DPrismRim(v_localPos, baseN, V, 0.76, edgeArcPhase, u_prismFocusPos, u_prismConfig, ambientMul, isLight);',
      '    float pulseWave = u_prismConfig.w * (0.65 + 0.35 * sin(edgeArcPhase * 12.56637 - u_prismConfig.w * 4.0));',
      '    vec3 pulseSpec = mix(coolNeutral * 1.25, samplePrismSpectrum6(fract(edgeArcPhase * 2.4 + 0.15), 0.84, u_prismConfig.x, isLight), 0.36);',
      '    vec3 pulseGlow = pulseSpec * (pulseWave * ambientMul * 0.34);',
      '    vec3 waistTotal = albedo * mix(0.36, 0.86, isLight) + matteMetalRefl + quietCore + waistPrism * 0.82 + pulseGlow;',
      '    outColor = vec4(linearToDisplaySrgb(waistTotal, gl_FragCoord.xy), 1.0);',
      '    return;',
      '  }',
      '',
      '  float shadow = sampleVogelShadow(u_shadowTex, u_lightViewProj, v_worldPos, baseN, L, u_envParams.y);',
      '  if (u_envParams.y < 0.5 && u_liftCapShadow.w > 0.01 && v_localPos.y < 0.09 && v_localPos.y > -0.30) {',
      '    vec2 off = v_localPos.xz - (u_liftCapShadow.xz + vec2(0.22, -0.18) * u_liftCapShadow.w);',
      '    float sd = sdRoundBox2D(off, vec2(0.52, 0.52), 0.11);',
      '    shadow *= 1.0 - smoothstep(0.38, -0.16, sd) * 0.54 * u_liftCapShadow.w;',
      '  }',
      '',
      '  /* V10/V11 tight CNC tolerance Cavity AO (covers 91 main sockets and 6 right-side aux pad sockets) */',
      '  float hemiAo = 0.72 + 0.28 * clamp(baseN.y * 0.65 + 0.35, 0.0, 1.0);',
      '  float cavityAo = hemiAo;',
      '  vec3 activeWellGlow = vec3(0.0);',
      '  if (kind > 5.5 && v_localPos.y > -0.50) {',
      '    if (v_localPos.x > 9.82) {',
      '      float auxCol = clamp(floor((v_localPos.x - 10.71) + 0.5), 0.0, 1.0);',
      '      float auxRow = clamp(floor((v_localPos.z - 1.44) + 0.5), 0.0, 2.0);',
      '      vec2 auxCell = vec2(10.71 + auxCol, 1.44 + auxRow);',
      '      float dAuxWell = sdRoundBox2D(v_localPos.xz - auxCell, vec2(0.464, 0.464), 0.072);',
      '      float auxLiftOpen = 0.0;',
      '      if (u_liftCapShadow.w > 0.02) {',
      '        auxLiftOpen = (1.0 - smoothstep(0.20, 0.85, length(auxCell - u_liftCapShadow.xz))) * u_liftCapShadow.w;',
      '      }',
      '      float auxSocketDark = mix(mix(0.11, 0.40, isLight), 0.88, auxLiftOpen);',
      '      cavityAo = mix(auxSocketDark, mix(0.66, 0.90, isLight), smoothstep(-0.016, 0.034, dAuxWell));',
      '      float auxWallDist = min(min(v_localPos.x - 10.20, 12.22 - v_localPos.x), min(v_localPos.z - 0.93, 3.95 - v_localPos.z));',
      '      float auxWallMinAo = mix(0.38, 0.72, isLight);',
      '      cavityAo *= auxWallMinAo + (1.0 - auxWallMinAo) * smoothstep(0.0, 0.16, auxWallDist);',
      '    } else {',
      '      float colF = v_localPos.x + 9.5;',
      '      float rowF = (v_localPos.z - 0.44) + 4.0;',
      '      float cIdx = clamp(floor(colF + 0.5), 1.0, 18.0);',
      '      float rIdx = clamp(floor(rowF + 0.5), 1.0, 7.0);',
      '      bool inDeckGap = (rIdx <= 3.5 && cIdx >= 2.5 && cIdx <= 12.5) || (rIdx < 1.5 && cIdx >= 12.5 && cIdx <= 17.5);',
      '      if (!inDeckGap) {',
      '        vec2 cellCenter = vec2(cIdx - 9.5, (rIdx - 4.0) + 0.44);',
      '        float dWell = sdRoundBox2D(v_localPos.xz - cellCenter, vec2(0.464, 0.464), 0.072);',
      '        float liftOpen = 0.0;',
      '        if (u_liftCapShadow.w > 0.02) {',
      '          liftOpen = (1.0 - smoothstep(0.20, 0.85, length(cellCenter - u_liftCapShadow.xz))) * u_liftCapShadow.w;',
      '        }',
      '        float socketDark = mix(mix(0.11, 0.40, isLight), 0.88, liftOpen);',
      '        cavityAo = mix(socketDark, mix(0.66, 0.90, isLight), smoothstep(-0.016, 0.034, dWell));',
      '      } else {',
      '        cavityAo = mix(hemiAo * 0.86, 0.94, isLight);',
      '      }',
      '      float dDeckBorder = sdRoundBox2D(v_localPos.xz - vec2(-2.00, -1.58), vec2(4.98, 1.52), 0.232);',
      '      if (dDeckBorder > -0.02 && dDeckBorder < 0.18) {',
      '        cavityAo *= mix(mix(0.40, 0.70, isLight), 1.0, smoothstep(0.0, 0.16, max(dDeckBorder, 0.0)));',
      '      }',
      '      float dHwBorder = sdRoundBox2D(v_localPos.xz - vec2(5.50, -2.55), vec2(2.51, 0.48), 0.125);',
      '      if (dHwBorder > -0.02 && dHwBorder < 0.16) {',
      '        cavityAo *= mix(mix(0.38, 0.68, isLight), 1.0, smoothstep(0.0, 0.14, max(dHwBorder, 0.0)));',
      '      }',
      '      float wallDist = min(min(v_localPos.x + 9.01, 9.01 - v_localPos.x), min(v_localPos.z + 3.07, 3.93 - v_localPos.z));',
      '      float wallMinAo = mix(0.38, 0.72, isLight);',
      '      cavityAo *= wallMinAo + (1.0 - wallMinAo) * smoothstep(0.0, 0.18, wallDist);',
      '    }',
      '  }',
      '',
      '  /* Restrained local condenser-lens scatter strictly inside the single levitated key socket */',
      '  if (u_switchLightPos.w > 0.01 && v_localPos.y < 0.08 && v_localPos.y > -0.35) {',
      '    float dSw = length(v_localPos.xz - u_switchLightPos.xz);',
      '    if (dSw < 0.56) {',
      '      float swPool = exp(-dSw * dSw * 14.0) * (1.0 - smoothstep(-0.18, 0.08, v_localPos.y));',
      '      activeWellGlow = srgbToLinear(u_switchLightColor) * swPool * u_switchLightPos.w * 0.24;',
      '    }',
      '  }',
      '',
      '  float alphaRough = max(0.0036, rough * rough);',
      '  float maxCh = max(albedo.r, max(albedo.g, albedo.b));',
      '  /* Neutral Space Black (#0F1218) and Warm Obsidian (#13100E) anodized micro-grain F0 without muddy blue cast */',
      '  vec3 warmCoolTint = albedo.r > albedo.b ? vec3(0.044, 0.032, 0.020) : vec3(0.024, 0.028, 0.036);',
      '  vec3 darkAnodizedF0 = clamp(albedo * 2.15 + warmCoolTint, 0.038, 0.97);',
      '  vec3 metalBaseF0 = mix(darkAnodizedF0, clamp(albedo * 1.04, 0.08, 0.99), smoothstep(0.10, 0.40, maxCh));',
      '  vec3 f0 = mix(vec3(0.044), metalBaseF0, metal);',
      '  float oxideDiffWeight = (kind < 0.5 || kind > 5.5) ? mix(0.22, 0.47, isLight) : (1.0 - metal);',
      '  vec3 diffColor = albedo * max(1.0 - metal, oxideDiffWeight);',
      '',
      '  float D = D_GGX(ndh, alphaRough);',
      '  float Vis = V_SmithGGX(ndv, ndl, alphaRough);',
      '  vec3 F = F_Schlick(vdh, f0);',
      '  vec3 specBrdf = D * Vis * F;',
      '',
      '  float studioSweep = 1.0;',
      '  if (kind < 0.5) {',
      '    float diagGrad = (-v_localPos.x * 0.064 + v_localPos.z * 0.088);',
      '    studioSweep = mix(0.68 + 0.48 * smoothstep(-0.80, 0.85, diagGrad), 0.86 + 0.24 * smoothstep(-0.80, 0.85, diagGrad), isLight);',
      '  }',
      '',
      '  vec3 mainLightRad = vec3(2.54, 2.50, 2.45) * shadow;',
      '  vec3 Lo = (diffColor / PI + specBrdf * studioSweep) * mainLightRad * ndl;',
      '',
      '  /* Rear-right cool/warm rim backlight */',
      '  vec3 rimDir = normalize(vec3(0.62, 0.46, -0.63));',
      '  vec3 Hrim = normalize(V + rimDir);',
      '  float ndlRim = max(dot(N, rimDir), 0.0);',
      '  float ndhRim = max(dot(N, Hrim), 0.0);',
      '  float rimSpec = D_GGX(ndhRim, max(0.010, alphaRough)) * 0.16 * ndlRim;',
      '  vec3 rimColLin = srgbToLinear(u_rimTint) * mix(0.76, 0.48, isLight);',
      '  vec3 LoRim = (f0 * rimSpec + diffColor * ndlRim * 0.08) * rimColLin;',
      '',
      '  vec3 R = reflect(-V, N);',
      '  vec3 envSpec = sampleMetalStudioEnv(u_metalEnvTex, R, rough, isLight) * studioSweep;',
      '  vec3 envDiff = sampleStudioHDRI(N, 0.92, isLight);',
      '  vec3 kS = F_SchlickRoughness(ndv, f0, rough);',
      '  vec3 kD = max(vec3(0.0), (1.0 - kS) * max(1.0 - metal, oxideDiffWeight * 0.65));',
      '  float specOcc = mix(0.38, 1.0, shadow * 0.64 + 0.36) * cavityAo;',
      '  /* V13.1 CNC 6063 gunmetal bead-blasted anodized aluminum + 45-deg bright silver specular chamfer */',
      '  float darkMatteAbsorb = (kind < 0.5 && isLight < 0.5) ? 0.66 : 1.0;',
      '  float bevelSlopeT = 1.0 - smoothstep(0.76, 0.95, abs(baseN.y));',
      '  float darkPvdGain = mix(1.18, 2.05, bevelSlopeT);',
      '  float pvdBoost = (kind > 0.5 && kind < 1.5) ? mix(darkPvdGain, 1.54, isLight) : darkMatteAbsorb;',
      '  vec3 ambient = kD * albedo * envDiff * cavityAo * darkMatteAbsorb + envSpec * kS * specOcc * pvdBoost;',
      '',
      '  vec3 totalLin = (Lo * darkMatteAbsorb + LoRim) * cavityAo + ambient + activeWellGlow;',
      '',
      '  if (kind > 4.5 && kind < 5.5) {',
      '    float fresPc = pow(1.0 - ndv, 3.4);',
      '    vec3 clearCoatSpec = sampleMetalStudioEnv(u_metalEnvTex, R, 0.13, isLight) * (0.06 + 0.36 * fresPc);',
      '    float lensBleed = smoothstep(0.04, -0.28, v_localPos.z - u_liftCapShadow.z) * 0.18 * step(0.01, u_switchLightPos.w);',
      '    vec3 pcBleedCol = u_switchLightPos.w > 0.01 ? srgbToLinear(u_switchLightColor) : vec3(0.45, 0.65, 0.95);',
      '    totalLin = totalLin * 0.62 + clearCoatSpec + pcBleedCol * lensBleed * shadow;',
      '  } else if (kind > 1.5 && kind < 2.5) {',
      '    float fresLens = 0.08 + 0.92 * pow(1.0 - ndv, 3.8);',
      '    vec3 lensCoat = sampleMetalStudioEnv(u_metalEnvTex, R, 0.055, isLight) * fresLens * mix(0.46, 0.34, isLight);',
      '    vec3 gemCore = albedo * (emis * mix(0.96, 0.88, isLight));',
      '    float peakCh = max(gemCore.r, max(gemCore.g, gemCore.b));',
      '    gemCore /= (1.0 + peakCh * 0.40);',
      '    totalLin = totalLin * mix(0.28, 0.22, isLight) + lensCoat + gemCore;',
      '    outColor = vec4(linearToDisplaySrgb(totalLin, gl_FragCoord.xy), 1.0);',
      '    return;',
      '  }',
      '',
      '  /* Add true 3D normal-dispersed prism edge (activates only where chamferMask > 0.01 on bevels/lip/weight edges) */',
      '  if (chamferMask > 0.01) {',
      '    totalLin += evalTrue3DPrismRim(',
      '      v_localPos, baseN, V, chamferMask, edgeArcPhase,',
      '      u_prismFocusPos, u_prismConfig, ambientMul, isLight',
      '    );',
      '  }',
      '',
      '  totalLin += albedo * (emis * 1.65);',
      '',
      '  outColor = vec4(linearToDisplaySrgb(totalLin, gl_FragCoord.xy), 1.0);',
      '}',
    ].join('\n');

    var KEYCAP_VS = [
      '#version 300 es',
      'precision highp float;',
      'layout(location = 0) in vec3 a_pos;',
      'layout(location = 1) in vec3 a_normal;',
      'layout(location = 2) in vec2 a_uv;',
      'layout(location = 3) in float a_part;',
      'layout(location = 4) in vec4 a_m0;',
      'layout(location = 5) in vec4 a_m1;',
      'layout(location = 6) in vec4 a_m2;',
      'layout(location = 7) in vec4 a_m3;',
      'layout(location = 8) in vec4 a_capColor;',
      'layout(location = 9) in vec4 a_legColor;',
      'layout(location = 10) in vec4 a_atlas;',
      'layout(location = 11) in vec4 a_extra;',
      '',
      'uniform mat4 u_viewProj;',
      'uniform mat4 u_chassisMat;',
      'uniform mat4 u_auxChassisMat;',
      '',
      'out vec3 v_worldPos;',
      'out vec3 v_chassisPos;',
      'out vec3 v_localPos;',
      'out vec3 v_normal;',
      'out vec3 v_tanX;',
      'out vec2 v_atlasUv;',
      'out float v_part;',
      'out vec4 v_capColor;',
      'out vec4 v_legColor;',
      'out vec4 v_extra;',
      '',
      'void main() {',
      '  mat4 localM = mat4(a_m0, a_m1, a_m2, a_m3);',
      '  vec4 cp = localM * vec4(a_pos, 1.0);',
      '  mat4 activeChassis = (cp.x > 9.82) ? u_auxChassisMat : u_chassisMat;',
      '  vec4 wp = activeChassis * cp;',
      '  v_localPos = a_pos;',
      '  v_chassisPos = cp.xyz;',
      '  v_worldPos = wp.xyz;',
      '  mat3 nMat = mat3(activeChassis) * mat3(localM);',
      '  v_normal = normalize(nMat * a_normal);',
      '  v_tanX = normalize(nMat * vec3(1.0, 0.0, 0.0));',
      '  v_atlasUv = vec2(a_atlas.x + a_uv.x * a_atlas.z, a_atlas.y + a_uv.y * a_atlas.w);',
      '  v_part = a_part;',
      '  v_capColor = a_capColor;',
      '  v_legColor = a_legColor;',
      '  v_extra = a_extra;',
      '  gl_Position = u_viewProj * wp;',
      '}',
    ].join('\n');

    var KEYCAP_FS = [
      '#version 300 es',
      'precision highp float;',
      'in vec3 v_worldPos;',
      'in vec3 v_chassisPos;',
      'in vec3 v_localPos;',
      'in vec3 v_normal;',
      'in vec3 v_tanX;',
      'in vec2 v_atlasUv;',
      'in float v_part;',
      'in vec4 v_capColor;',
      'in vec4 v_legColor;',
      'in vec4 v_extra;',
      '',
      'uniform sampler2D u_atlasTex;',
      'uniform sampler2D u_shadowTex;',
      'uniform sampler2D u_grainTex;',
      'uniform sampler2D u_metalEnvTex;',
      'uniform mat4 u_lightViewProj;',
      'uniform vec3 u_camPos;',
      'uniform vec3 u_lightDir;',
      'uniform vec3 u_rimTint;',
      'uniform vec4 u_envParams;',
      'uniform vec4 u_switchLightPos;',
      'uniform vec3 u_switchLightColor;',
      'uniform vec4 u_liftCapShadow;',
      'uniform vec4 u_prismConfig;',
      'out vec4 outColor;',
      '',
      GLSL_PBR_COMMON,
      '',
      'vec3 resolveHeroBadgeSrgb(float zId, vec3 capSrgb, vec3 localPos) {',
      '  /* V14 Google DeepMind model spectrum: 1H azure, 6C royal cobalt x ice-cyan, 10Ne coral->gold, 18Ar electric indigo, AUX-06 brand spectrum */',
      '  float onBrightCap = step(0.42, dot(capSrgb, vec3(0.299, 0.587, 0.114)));',
      '  float diagT = clamp((localPos.x * 1.35 + localPos.z * 1.15) + 0.5, 0.0, 1.0);',
      '  if (zId <= -99.5) {',
      '    float auxIdx = -zId - 100.0;',
      '    if (auxIdx < 0.5) {',
      '      vec3 orchDark = mix(vec3(0.60, 0.44, 0.98), vec3(0.96, 0.76, 0.38), diagT);',
      '      vec3 orchBright = mix(vec3(0.42, 0.24, 0.82), vec3(0.78, 0.50, 0.12), diagT);',
      '      return mix(orchDark, orchBright, onBrightCap);',
      '    }',
      '    if (auxIdx < 1.5) return mix(mix(vec3(0.02, 0.84, 1.00), vec3(0.45, 0.92, 1.00), diagT), vec3(0.02, 0.52, 0.78), onBrightCap);',
      '    if (auxIdx < 3.5) return mix(mix(vec3(0.92, 0.48, 0.27), vec3(0.98, 0.72, 0.44), diagT), vec3(0.76, 0.34, 0.14), onBrightCap);',
      '    return mix(mix(vec3(0.32, 0.88, 0.80), vec3(0.68, 0.97, 0.91), diagT), vec3(0.08, 0.52, 0.48), onBrightCap);',
      '  }',
      '  if (abs(zId - 1.0) < 0.5) return mix(mix(vec3(0.24, 0.78, 0.99), vec3(0.68, 0.93, 1.00), diagT), vec3(0.04, 0.46, 0.72), onBrightCap);',
      '  if (abs(zId - 6.0) < 0.5) return mix(mix(vec3(0.24, 0.54, 0.99), vec3(0.44, 0.92, 1.00), diagT), vec3(0.10, 0.32, 0.78), onBrightCap);',
      '  if (abs(zId - 10.0) < 0.5) return mix(mix(vec3(1.00, 0.40, 0.26), vec3(1.00, 0.74, 0.28), diagT), vec3(0.82, 0.28, 0.10), onBrightCap);',
      '  if (abs(zId - 18.0) < 0.5) return mix(mix(vec3(0.32, 0.46, 0.99), vec3(0.64, 0.40, 1.00), diagT), vec3(0.36, 0.16, 0.78), onBrightCap);',
      '  return mix(vec3(0.76, 0.82, 0.90), vec3(0.24, 0.30, 0.40), onBrightCap);',
      '}',
      '',
      'void main() {',
      '  vec3 capLin = srgbToLinear(v_capColor.rgb);',
      '  vec3 legLin = srgbToLinear(v_legColor.rgb);',
      '  float isAvail = clamp(v_capColor.a, 0.0, 1.0);',
      '  float lift = max(v_legColor.a, 0.0);',
      '  float orchLatch = clamp(-v_legColor.a, 0.0, 1.0);',
      '  float keyHover = v_extra.x;',
      '  float waveGlow = v_extra.y;',
      '  float heroChroma = clamp(v_extra.z, 0.0, 1.0);',
      '  float zSeed = v_extra.w;',
      '  float ambientMul = u_envParams.z;',
      '  float isMonoKey = u_prismConfig.x > 4.5 ? 1.0 : 0.0;',
      '  float isOrchKey = step(zSeed, -99.5) * step(-100.5, zSeed);',
      '  float isElemGemKey = step(0.5, zSeed) * isAvail * (1.0 - isMonoKey);',
      '',
      '  /* V14 #0 ORCH brushed anodized metal keycap: dark nebula titanium-violet x champagne gold (brightens on latch); light lavender-silver x deep indigo ink */',
      '  if (isOrchKey > 0.5 && isAvail > 0.01 && isMonoKey < 0.5) {',
      '    float orchDiag = clamp((v_localPos.x * 1.18 + v_localPos.z * 0.96) + 0.50, 0.0, 1.0);',
      '    vec3 orchDarkRest = mix(vec3(0.16, 0.13, 0.31), vec3(0.32, 0.23, 0.14), orchDiag);',
      '    vec3 orchDarkActive = mix(vec3(0.32, 0.22, 0.64), vec3(0.68, 0.48, 0.20), orchDiag);',
      '    vec3 orchDarkSrgb = mix(orchDarkRest, orchDarkActive, clamp(orchLatch, 0.0, 1.0));',
      '    vec3 orchLightRest = mix(vec3(0.80, 0.76, 0.95), vec3(0.94, 0.86, 0.70), orchDiag);',
      '    vec3 orchLightActive = mix(vec3(0.72, 0.65, 0.96), vec3(0.95, 0.80, 0.54), orchDiag);',
      '    vec3 orchLightSrgb = mix(orchLightRest, orchLightActive, clamp(orchLatch, 0.0, 1.0));',
      '    vec3 orchAnodLin = srgbToLinear(mix(orchDarkSrgb, orchLightSrgb, u_envParams.x));',
      '    capLin = mix(capLin, orchAnodLin, isAvail);',
      '  } else if (isAvail > 0.001) {',
      '    float capBright = smoothstep(0.20, 0.55, dot(capLin, vec3(0.2126, 0.7152, 0.0722)));',
      '    vec3 gemRestLin = mix(capLin * 0.92, capLin * 0.98, capBright);',
      '    vec3 richJadeLin = pow(max(capLin, vec3(1e-4)), vec3(1.06)) * 0.92;',
      '    vec3 availCapLin = mix(gemRestLin, richJadeLin, heroChroma);',
      '    capLin = mix(capLin, availCapLin, isAvail);',
      '  }',
      '',
      '  /* Subtle hover highlight for blind and dynamically dimmed keys */',
      '  if (isAvail < 0.99 && keyHover > 0.01) {',
      '    vec3 hoverTint = mix(vec3(0.016, 0.020, 0.030), vec3(0.040, 0.046, 0.058), u_envParams.x);',
      '    capLin += hoverTint * keyHover * (1.0 - isAvail);',
      '  }',
      '',
      '  vec3 albedo = capLin;',
      '  vec3 activeInkLin = legLin;',
      '  float legSmoothMix = 0.0;',
      '  float legGrainHalo = 0.0;',
      '  float dotEmis = 0.0;',
      '  float engraveDip = 0.0;',
      '  float lightStealthInk = 0.0;',
      '',
      '  if (v_part > 0.85) {',
      '    float isAuxKey = step(zSeed, -50.0);',
      '    vec4 mask = texture(u_atlasTex, v_atlasUv, mix(-0.42, -0.78, isAuxKey));',
      '    float heroShape = max(mask.r, max(mask.g, mask.b));',
      '    float fw = max(fwidth(heroShape), 0.026);',
      '    float legMid = mix(0.46, 0.50, isAuxKey);',
      '    float legHalf = fw * mix(0.78, 0.56, isAuxKey);',
      '    float legAlpha = smoothstep(legMid - legHalf, legMid + legHalf, heroShape);',
      '    float seamDip = legAlpha * (1.0 - legAlpha) * 0.032;',
      '    /* Top-right quadrant + G-channel dual mask: vivid element-tinted emblem on unselected ceramic keys while main legend stays crisp */',
      '    float inTopRight = step(0.08, v_localPos.x) * step(v_localPos.z, -0.04);',
      '    float badgeMask = smoothstep(0.26, 0.64, mask.g) * inTopRight;',
      '    float isMonoMode = u_prismConfig.x > 4.5 ? 1.0 : 0.0;',
      '    vec3 badgeElemLin = srgbToLinear(resolveHeroBadgeSrgb(zSeed, v_capColor.rgb, v_localPos));',
      '    vec3 restBadgeLin = mix(badgeElemLin, legLin, isMonoMode);',
      '    vec3 cornerInkLin = mix(restBadgeLin, legLin, heroChroma * (1.0 - orchLatch));',
      '    vec3 availInkLin = mix(legLin, cornerInkLin, badgeMask);',
      '    vec3 availAlbedo = mix(capLin, availInkLin, clamp(legAlpha, 0.0, 1.0)) * (1.0 - seamDip);',
      '    float inkLuma = dot(availInkLin, vec3(0.2126, 0.7152, 0.0722));',
      '    float availEmis = clamp(legAlpha, 0.0, 1.0) * mix((0.06 * smoothstep(0.15, 0.65, inkLuma)) + 0.26 * badgeMask, 0.14, heroChroma);',
      '',
      '    /* 86 GMK blind keys + dynamically dimmed unsupported keys (retain subtle dark-etched legend without bright chroma) */',
      '    float isHeroGlyphOnly = step(0.05, mask.r) * (1.0 - step(0.05, mask.b));',
      '    float stealthShape = mix(max(mask.b, mask.r * 4.5), heroShape, isHeroGlyphOnly);',
      '    float fwS = max(fwidth(stealthShape), 0.032);',
      '    float engraveLo = mix(0.26, 0.44, isHeroGlyphOnly);',
      '    float engraveHi = mix(0.46, 0.52, isHeroGlyphOnly);',
      '    float engraveAlpha = smoothstep(engraveLo - fwS * 0.65, engraveHi + fwS * 0.65, stealthShape);',
      '    float baseStealthCtr = mix(mix(0.66, 0.78, u_envParams.x), mix(0.44, 0.56, u_envParams.x), isHeroGlyphOnly);',
      '    float stealthContrast = baseStealthCtr + keyHover * 0.18;',
      '    float stDip = engraveAlpha * mix(0.032, 0.068, u_envParams.x);',
      '    float stSmoothMix = clamp(engraveAlpha * stealthContrast, 0.0, 1.0);',
      '    vec3 stealthAlbedo = mix(capLin, legLin, stSmoothMix) * (1.0 - stDip);',
      '',
      '    activeInkLin = mix(legLin, availInkLin, isAvail);',
      '    legSmoothMix = mix(stSmoothMix, clamp(legAlpha, 0.0, 1.0), isAvail);',
      '    legGrainHalo = mix(engraveAlpha * 0.45, clamp(smoothstep(0.16, 0.55, heroShape), 0.0, 1.0), isAvail);',
      '    engraveDip = stDip * (1.0 - isAvail);',
      '    lightStealthInk = engraveAlpha * u_envParams.x * (1.0 - isAvail);',
      '    albedo = mix(stealthAlbedo, availAlbedo, isAvail);',
      '    dotEmis = availEmis * isAvail;',
      '    if (orchLatch > 0.005 && u_envParams.x < 0.5) {',
      '      float dualL = clamp((v_localPos.x + v_localPos.z + 0.36) * 1.45, 0.0, 1.0);',
      '      vec3 latchGlowLin = isMonoKey > 0.5',
      '        ? srgbToLinear(vec3(0.92, 0.92, 0.92))',
      '        : srgbToLinear(mix(vec3(0.86, 0.76, 1.00), vec3(1.00, 0.88, 0.52), dualL));',
      '      activeInkLin = mix(activeInkLin, latchGlowLin, orchLatch * (0.36 + 0.44 * badgeMask));',
      '      dotEmis += clamp(legAlpha, 0.0, 1.0) * orchLatch * (0.48 + 0.40 * badgeMask) * max(0.32, ambientMul);',
      '    }',
      '  } else if (v_part > 0.41 && v_part <= 0.48) {',
      '    albedo = mix(capLin, legLin, mix(0.20, 0.84, isAvail)) * 0.88;',
      '  } else if (v_part > 0.31 && v_part <= 0.41) {',
      '    albedo = mix(capLin, legLin, mix(0.12, 0.58, isAvail)) * 0.68;',
      '  } else if (v_part > 0.25 && v_part <= 0.31) {',
      '    albedo = capLin * 0.24;',
      '  } else if (v_part > 0.10 && v_part <= 0.25) {',
      '    albedo = capLin * 0.90;',
      '  }',
      '',
      '  /* Gloss ceramic available keys skip 3x u_grainTex fetches; only the 86 matte PBT blind keys sample micro-grain heightfield */',
      '  float grainMask = mix(mix(1.0, 0.32, legGrainHalo), 0.0, isAvail);',
      '  vec3 baseN = normalize(v_normal);',
      '  vec3 N = baseN;',
      '  float grainR = 0.5;',
      '  if (grainMask > 0.04) {',
      '    vec2 seedOff = vec2(fract(zSeed * 0.3713), fract(zSeed * 0.6197));',
      '    float rLen = length(v_localPos.xz);',
      '    vec2 radialDir = rLen > 1e-4 ? (v_localPos.xz / rLen) : vec2(1.0, 0.0);',
      '    float skirtUnfold = max(0.0, 0.565 - v_localPos.y) * 0.64;',
      '    vec2 pbtUv = (v_localPos.xz + radialDir * skirtUnfold) * 2.05 + seedOff;',
      '    float gTexel = grainTexelSize(u_grainTex);',
      '    grainR = texture(u_grainTex, pbtUv, -0.35).r;',
      '    float grainRx = texture(u_grainTex, pbtUv + vec2(gTexel, 0.0), -0.35).r;',
      '    float grainRz = texture(u_grainTex, pbtUv + vec2(0.0, gTexel), -0.35).r;',
      '    albedo *= mix(1.0, mix(0.985, 1.015, grainR), grainMask);',
      '    vec3 T = normalize(v_tanX - baseN * dot(baseN, v_tanX));',
      '    vec3 B = normalize(cross(baseN, T));',
      '    float bumpStrength = 0.115 * grainMask;',
      '    float dHx = (grainRx - grainR) * bumpStrength;',
      '    float dHz = (grainRz - grainR) * bumpStrength;',
      '    N = normalize(baseN - T * (dHx * 1.50) - B * (dHz * 1.50));',
      '  }',
      '',
      '  /* Fine matte PBT diffuse for 86 blind keys vs clean glossy ceramic clearcoat for available keys */',
      '  float stealthRough = clamp(0.65 + (0.5 - grainR) * 0.028 * grainMask + engraveDip * 0.10, 0.62, 0.69);',
      '  float availBaseRough = mix(0.195, 0.145, heroChroma);',
      '  float ceramicRough = mix(availBaseRough, 0.13, legSmoothMix);',
      '  float rough = mix(stealthRough, ceramicRough, isAvail);',
      '  vec3 Nc = grainMask > 0.04 ? normalize(mix(baseN, N, mix(0.06, 0.02, isAvail))) : baseN;',
      '',
      '  vec3 V = normalize(u_camPos - v_worldPos);',
      '  vec3 L = normalize(u_lightDir);',
      '  vec3 H = normalize(V + L);',
      '',
      '  float ndv = max(dot(N, V), 1e-4);',
      '  float ndlRaw = dot(N, L);',
      '  float ndl = max(ndlRaw, 0.0);',
      '  float ndlWrap = mix(clamp((ndlRaw + 0.04) / 1.04, 0.0, 1.0), clamp((ndlRaw + mix(0.22, 0.36, heroChroma)) / mix(1.22, 1.36, heroChroma), 0.0, 1.0), isAvail);',
      '  float ndh = max(dot(N, H), 0.0);',
      '  float vdh = max(dot(V, H), 0.0);',
      '',
      '  float shadow = sampleVogelShadow(u_shadowTex, u_lightViewProj, v_worldPos, baseN, L, u_envParams.y);',
      '  if (u_envParams.y < 0.5 && lift < 0.05 && u_liftCapShadow.w > 0.02) {',
      '    float dHoriz = length(v_chassisPos.xz - (u_liftCapShadow.xz + vec2(0.22, -0.18) * u_liftCapShadow.w));',
      '    shadow *= 1.0 - smoothstep(1.05, 0.34, dHoriz) * 0.40 * u_liftCapShadow.w;',
      '  }',
      '',
      '  /* Tightened inter-key skirt groove Cavity AO for crisp machined gap depth and 4-face wall shading */',
      '  float trenchVertical = 0.16 + 0.84 * smoothstep(0.0, 0.36, v_localPos.y);',
      '  float sideFacing = 1.0 - clamp(baseN.y, 0.0, 1.0);',
      '  float cavityAo = mix(mix(1.0, trenchVertical, sideFacing * 0.92 + 0.08), 0.98, lift);',
      '  if (v_part > 0.10 && v_part <= 0.48) {',
      '    float bossBoost = v_part > 0.41 ? 1.12 : (v_part < 0.25 ? 1.05 : 0.82);',
      '    cavityAo *= clamp(mix(0.28, 0.86, lift) * bossBoost, 0.16, 1.0);',
      '  }',
      '',
      '  float alphaRough = max(0.004, rough * rough);',
      '  vec3 f0 = vec3(mix(0.024, mix(0.048, 0.058, heroChroma), isAvail));',
      '  float D = D_GGX(ndh, alphaRough);',
      '  float Vis = V_SmithGGX(ndv, ndl, alphaRough);',
      '  vec3 F = F_Schlick(vdh, f0);',
      '  vec3 specBrdf = D * Vis * F;',
      '',
      '  /* Early-out skipping dual-lobe GGX clearcoat & envCoat sampling on 86 blind keys (clearcoat == 0) */',
      '  float clearcoat = mix(0.0, mix(0.68, 0.90, heroChroma), isAvail);',
      '  float clearcoatRoughness = mix(0.34, mix(0.125, 0.098, heroChroma), isAvail);',
      '  float ccAlpha = max(0.0036, clearcoatRoughness * clearcoatRoughness);',
      '  float ndvC = max(dot(Nc, V), 1e-4);',
      '  float ndlC = 0.0;',
      '  float Fc = 0.0;',
      '  float coatInkGuard = 1.0;',
      '  float specCoatDirect = 0.0;',
      '  if (clearcoat > 0.005) {',
      '    ndlC = max(dot(Nc, L), 0.0);',
      '    float ndhC = max(dot(Nc, H), 0.0);',
      '    float Dc = D_GGX(ndhC, ccAlpha);',
      '    float Vc = V_SmithGGX(ndvC, ndlC, ccAlpha);',
      '    Fc = (0.042 + 0.958 * pow(clamp(1.0 - vdh, 0.0, 1.0), 5.0)) * clearcoat;',
      '    float isDarkInk = 1.0 - step(0.24, dot(activeInkLin, vec3(0.2126, 0.7152, 0.0722)));',
      '    coatInkGuard = 1.0 - clamp(legSmoothMix * 1.25, 0.0, 1.0) * isDarkInk * 0.56;',
      '    specCoatDirect = Dc * Vc * Fc * coatInkGuard;',
      '  }',
      '',
      '  vec3 mainLightRad = vec3(2.48, 2.43, 2.36) * mix(1.0, 0.88, u_envParams.x) * shadow;',
      '  float coatAtten = 1.0 - Fc * 0.52;',
      '  vec3 Lo = (albedo / PI) * coatAtten * mainLightRad * ndlWrap * cavityAo',
      '    + (specBrdf * coatAtten * ndl + vec3(specCoatDirect * ndlC)) * mainLightRad * mix(0.50, 1.0, cavityAo);',
      '',
      '  vec3 jadeSss = vec3(0.0);',
      '  float carbonSmokeTopMask = 0.0;',
      '  float carbonSmokeMix = 0.0;',
      '  float restGemSmokeMix = 0.0;',
      '  float restGemTopMask = 0.0;',
      '  /* V14 translucent smoked sea-glass gemstone keycaps (deep smoked top + shoulder/skirt internal refraction on dark; pastel frosted jade on light) + clear crystal levitated cap */',
      '  if (isElemGemKey > 0.02 && v_part >= 0.0) {',
      '    float restGemWeight = (1.0 - smoothstep(0.0, 0.55, lift)) * isElemGemKey;',
      '    if (restGemWeight > 0.01) {',
      '      float isTopG = smoothstep(0.72, 0.94, v_part);',
      '      float darkModeG = 1.0 - u_envParams.x;',
      '      restGemSmokeMix = restGemWeight * darkModeG;',
      '      restGemTopMask = isTopG;',
      '      float fresGem = pow(1.0 - ndvC, 2.35);',
      '      float edgeVignette = smoothstep(0.14, 0.44, length(v_localPos.xz)) * isTopG * darkModeG;',
      '      float nonLegTopG = 1.0 - clamp(legSmoothMix * 1.06, 0.0, 1.0);',
      '      float topSmokeBlend = clamp((0.58 + edgeVignette * 0.24) * isTopG * restGemSmokeMix * nonLegTopG, 0.0, 0.80);',
      '      Lo = mix(Lo, Lo * 0.36 + vec3(0.008, 0.012, 0.022) * 0.08, topSmokeBlend);',
      '      float upperWallSmoke = (1.0 - isTopG) * smoothstep(0.16, 0.52, v_localPos.y) * restGemSmokeMix * 0.36;',
      '      Lo *= (1.0 - upperWallSmoke);',
      '      float skirtFalloff = 1.0 - smoothstep(0.02, 0.52, v_localPos.y);',
      '      float skirtSeaGlass = mix(skirtFalloff * (0.64 + 0.36 * skirtFalloff), skirtFalloff, u_envParams.x) * (1.0 - isTopG * mix(0.90, 0.38, u_envParams.x));',
      '      float shoulderBevel = smoothstep(0.08, 0.46, v_part) * (1.0 - step(0.80, v_part));',
      '      float dishOuterLip = isTopG * smoothstep(0.288, 0.352, max(abs(v_localPos.x), abs(v_localPos.z))) * 0.40;',
      '      float bevelRimGlow = clamp(shoulderBevel * 0.72 + dishOuterLip, 0.0, 1.0) * darkModeG;',
      '      float coreRadius = 1.0 - smoothstep(0.03, 0.40, length(v_localPos.xz - vec2(0.0, 0.03)));',
      '      float restTopGlowGuard = mix(1.0, 0.16, isTopG * darkModeG);',
      '      vec3 rawGemSrgb = resolveHeroBadgeSrgb(zSeed, vec3(0.06), v_localPos);',
      '      float isNeonGem = step(9.5, zSeed) * step(zSeed, 10.5) * darkModeG;',
      '      vec3 tunedGemSrgb = mix(rawGemSrgb, mix(vec3(0.98, 0.35, 0.22), rawGemSrgb, 0.48), isNeonGem);',
      '      vec3 gemSpecCol = srgbToLinear(tunedGemSrgb);',
      '      float gemInkGuard = 1.0 - legSmoothMix * 0.92;',
      '      float gemGain = mix(0.46 + keyHover * 0.18, 0.34 + keyHover * 0.12, u_envParams.x) * max(0.42, ambientMul);',
      '      jadeSss += gemSpecCol * ((skirtSeaGlass * 0.88 + bevelRimGlow * 0.46) + (coreRadius * 0.48 + fresGem * 0.26) * restTopGlowGuard) * gemInkGuard * restGemWeight * gemGain',
      '        + vec3(0.92, 0.96, 1.0) * fresGem * 0.10 * (1.0 - isTopG * 0.62) * gemInkGuard * restGemWeight;',
      '    }',
      '  }',
      '  if (isAvail > 0.02 && heroChroma > 0.02 && lift > 0.02 && v_part >= 0.0) {',
      '    float smokedMix = clamp(heroChroma * smoothstep(0.02, 0.25, lift), 0.0, 1.0);',
      '    float isCarbonKey = step(5.5, zSeed) * step(zSeed, 6.5);',
      '    float isTopFace = smoothstep(0.68, 0.92, v_part);',
      '    carbonSmokeMix = smokedMix * isCarbonKey * (1.0 - u_envParams.x);',
      '    carbonSmokeTopMask = isTopFace;',
      '    float fresPcGlass = pow(1.0 - ndvC, 2.45);',
      '    float fresEdgeCrisp = pow(1.0 - ndvC, 3.10);',
      '    float lowerSkirtTrans = (1.0 - smoothstep(0.04, 0.46, v_localPos.y)) * (1.0 - isTopFace * 0.82);',
      '    float sideRimTrans = (1.0 - clamp(baseN.y, 0.0, 1.0)) * 0.62 + fresPcGlass * (0.50 - isTopFace * 0.28);',
      '    float dishCatch = isTopFace * pow(max(dot(Nc, normalize(V + vec3(-0.38, 0.86, 0.34))), 0.0), 26.0) * (1.0 - legSmoothMix * 0.88);',
      '    vec3 dualBadgeLin = srgbToLinear(resolveHeroBadgeSrgb(zSeed, vec3(0.06), v_localPos));',
      '    vec3 prismCoreCol = u_switchLightPos.w > 0.01 ? mix(srgbToLinear(u_switchLightColor), dualBadgeLin, 0.56) : dualBadgeLin;',
      '    /* Dark mode: clear smoked frosted optical crystal cap; Light mode: translucent iced tinted crystal cap */',
      '    vec3 glassBodyTint = mix(vec3(0.024, 0.032, 0.050), mix(capLin, prismCoreCol, 0.22), u_envParams.x);',
      '    float loAtten = mix(mix(0.44, 0.36, isTopFace), mix(0.72, 0.80, isTopFace), u_envParams.x);',
      '    Lo = mix(Lo, Lo * loAtten + glassBodyTint * mix(0.15, 0.12, u_envParams.x), smokedMix * (1.0 - legSmoothMix * 0.88));',
      '    float topGlowGuard = mix(1.0, mix(0.20, 0.26, u_envParams.x), isTopFace) * (1.0 - legSmoothMix * 0.90);',
      '    jadeSss += prismCoreCol * (lowerSkirtTrans * 0.64 + sideRimTrans * 0.34 + 0.08 * isTopFace) * topGlowGuard * smokedMix * isAvail * mix(1.02, 0.68, u_envParams.x)',
      '      + vec3(0.95, 0.98, 1.0) * (fresEdgeCrisp * 0.24 * (1.0 - isTopFace * 0.58) + dishCatch * 0.28) * smokedMix;',
      '  }',
      '',
      '  /* Suppress white plastic LoRim ring on blind key tops while keeping subtle wall volume contour and ceramic glaze rim */',
      '  vec3 rimDir = normalize(vec3(0.62, 0.46, -0.63));',
      '  vec3 Hrim = normalize(V + rimDir);',
      '  float ndlRim = max(dot(Nc, rimDir), 0.0);',
      '  float ndhRim = max(dot(Nc, Hrim), 0.0);',
      '  float stealthTopSuppress = 1.0 - smoothstep(0.42, 0.85, v_part) * (1.0 - isAvail);',
      '  float rimEdge = (pow(1.0 - ndvC, 2.6) * 0.62 + 0.22) * stealthTopSuppress;',
      '  vec3 rimRad = srgbToLinear(u_rimTint) * mix(0.58, 0.30, u_envParams.x);',
      '  float rimCoatBoost = mix(0.002, mix(0.09, 0.14, heroChroma), isAvail);',
      '  vec3 LoRim = (albedo * mix(0.022, 0.12, isAvail) * ndlRim + vec3(D_GGX(ndhRim, max(0.015, ccAlpha)) * rimCoatBoost * ndlRim)) * rimRad * rimEdge * cavityAo;',
      '',
      '  vec3 R = reflect(-V, N);',
      '  vec3 envSpec = sampleStudioHDRI(R, rough, u_envParams.x) * mix(0.18 * stealthTopSuppress + 0.06, mix(0.64, 0.92, heroChroma), isAvail);',
      '  vec3 envCoat = vec3(0.0);',
      '  float fcEnv = 0.0;',
      '  if (clearcoat > 0.005) {',
      '    vec3 Rc = reflect(-V, Nc);',
      '    envCoat = sampleMetalStudioEnv(u_metalEnvTex, Rc, clearcoatRoughness, u_envParams.x) * mix(0.82, 0.68, u_envParams.x);',
      '    fcEnv = (0.055 + 0.945 * pow(clamp(1.0 - ndvC, 0.0, 1.0), 4.6)) * clearcoat * coatInkGuard;',
      '  }',
      '  vec3 envDiff = sampleStudioHDRI(N, 0.94, u_envParams.x) * mix(0.90, 0.96, u_envParams.x);',
      '  vec3 kS = F_SchlickRoughness(ndv, f0, rough);',
      '  vec3 kD = (1.0 - kS) * (1.0 - fcEnv * 0.56);',
      '  float envSpecOcc = cavityAo * mix(0.46, 1.0, shadow);',
      '  vec3 ambient = kD * albedo * envDiff * cavityAo + (envSpec * kS * (1.0 - fcEnv * 0.50) + envCoat * fcEnv) * envSpecOcc;',
      '  if (carbonSmokeMix > 0.01) {',
      '    float nonLegend = 1.0 - clamp(legSmoothMix * 1.08, 0.0, 1.0);',
      '    float smokeEnvMul = mix(1.0, mix(0.30, 0.25, carbonSmokeTopMask), carbonSmokeMix * nonLegend * mix(1.0, 0.88, u_envParams.x));',
      '    ambient *= smokeEnvMul;',
      '    dotEmis += clamp(legSmoothMix, 0.0, 1.0) * carbonSmokeMix * 0.30;',
      '  }',
      '  if (restGemSmokeMix > 0.01) {',
      '    float nonLegRest = 1.0 - clamp(legSmoothMix * 1.08, 0.0, 1.0);',
      '    vec3 restCoatKeep = envCoat * fcEnv * envSpecOcc * 0.46;',
      '    ambient = mix(ambient, ambient * 0.44 + restCoatKeep, restGemSmokeMix * restGemTopMask * nonLegRest);',
      '    ambient *= (1.0 - (1.0 - restGemTopMask) * restGemSmokeMix * 0.22);',
      '    LoRim *= (1.0 - restGemSmokeMix * mix(0.24, 0.56, restGemTopMask) * nonLegRest);',
      '    dotEmis += clamp(legSmoothMix, 0.0, 1.0) * restGemSmokeMix * 0.20;',
      '  }',
      '',
      '  vec3 totalLin = Lo + jadeSss + LoRim + ambient + activeInkLin * dotEmis;',
      '  if (lightStealthInk > 0.005) {',
      '    vec3 matteInkLin = legLin * (0.95 + 0.55 * shadow);',
      '    totalLin = mix(totalLin, matteInkLin, clamp(lightStealthInk * (0.74 + keyHover * 0.14), 0.0, 0.90));',
      '  }',
      '',
      '  /* Only the single levitated keycap cavity transmits upward light from the faceted crystal stem below */',
      '  if (u_switchLightPos.w > 0.01 && lift > 0.03) {',
      '    vec3 swColorLin = srgbToLinear(u_switchLightColor);',
      '    vec3 toLight = u_switchLightPos.xyz - v_chassisPos;',
      '    float dist = length(toLight);',
      '    vec3 Lsw = toLight / max(dist, 1e-4);',
      '    float pulseMul = 1.0 + u_prismConfig.w * 0.36;',
      '    float atten = (u_switchLightPos.w * pulseMul) / (1.0 + dist * dist * 4.2);',
      '    float cavityCatch = (v_part > 0.10 && v_part <= 0.48) ? mix(0.92, 0.72, carbonSmokeMix) : (v_part > 0.85 ? mix(0.05, 0.012, carbonSmokeMix) : mix(0.26, 0.09, carbonSmokeMix));',
      '    float skirtLipGlow = (1.0 - smoothstep(0.0, mix(0.28, 0.16, carbonSmokeMix), v_localPos.y)) * mix(0.36, 0.15, carbonSmokeMix);',
      '    float underFactor = max(dot(N, Lsw), 0.0) * cavityCatch + skirtLipGlow;',
      '    totalLin += mix(swColorLin, capLin * 1.15, mix(0.24, 0.14, carbonSmokeMix)) * atten * underFactor * mix(0.46, 0.18, carbonSmokeMix);',
      '  }',
      '',
      '  /* V14 AUX-06 aux keycaps: razor-thin top LED slot + subtle translucent bottom lightguide skirt (zero floor spill) */',
      '  if (isAvail > 0.20 && v_part > 0.85 && zSeed < -50.0 && orchLatch < 0.02 && ambientMul > 0.01) {',
      '    vec2 slitP = vec2(abs(v_localPos.x) - 0.145, abs(v_localPos.z + 0.278) - 0.015);',
      '    float slitD = length(max(slitP, 0.0)) + min(max(slitP.x, slitP.y), 0.0);',
      '    float wellMask = 1.0 - smoothstep(0.004, 0.020, slitD);',
      '    float slitMask = 1.0 - smoothstep(-0.004, 0.010, slitD);',
      '    if (wellMask > 0.005) {',
      '      totalLin = mix(totalLin, totalLin * 0.22, wellMask * 0.72);',
      '    }',
      '    if (slitMask > 0.005) {',
      '      float isMonoSlit = u_prismConfig.x > 4.5 ? 1.0 : 0.0;',
      '      vec3 slitElemLin = srgbToLinear(resolveHeroBadgeSrgb(zSeed, vec3(0.06), v_localPos));',
      '      vec3 slitCol = mix(slitElemLin, vec3(0.96, 0.98, 1.0), max(isMonoSlit * 0.85, 0.20 + keyHover * 0.36));',
      '      float slitBoost = (0.76 + keyHover * 1.15 + lift * 0.55) * isAvail * max(0.45, ambientMul);',
      '      totalLin = mix(totalLin, slitCol * (1.38 + slitBoost * 0.78), slitMask * 0.95);',
      '    }',
      '  }',
      '  if (isAvail > 0.20 && zSeed < -100.5 && zSeed > -104.5 && v_part >= 0.0 && v_part < 0.78 && isMonoKey < 0.5 && ambientMul > 0.01) {',
      '    float auxSkirtBand = (1.0 - smoothstep(0.0, 0.165, v_localPos.y)) * (1.0 - clamp(baseN.y, 0.0, 1.0));',
      '    if (auxSkirtBand > 0.004) {',
      '      vec3 auxSkirtLin = srgbToLinear(resolveHeroBadgeSrgb(zSeed, vec3(0.06), v_localPos));',
      '      float auxSkirtGain = (0.34 + keyHover * 0.42 + lift * 0.30) * isAvail * max(0.40, ambientMul) * mix(1.0, 0.72, u_envParams.x);',
      '      totalLin += auxSkirtLin * (auxSkirtBand * auxSkirtGain);',
      '    }',
      '  }',
      '',
      '  /* V13.1 periodic optical pulse ripple (cool white / subtle element glow diffusing across key gaps, settles to 0fps in <500ms) */',
      '  float sweepW = u_prismConfig.z;',
      '  if ((waveGlow > 0.004 || sweepW > 0.004) && ambientMul > 0.01) {',
      '    float shoulderMask = smoothstep(0.46, 0.74, v_part) * (1.0 - smoothstep(0.84, 0.98, v_part)) * 0.85 + pow(1.0 - ndvC, 3.2) * 0.38;',
      '    float capPhase = fract(v_chassisPos.x * 0.055 - v_chassisPos.z * 0.068 + baseN.x * 0.18);',
      '    vec3 neutralSilver = vec3(0.88, 0.92, 0.98);',
      '    if (waveGlow > 0.004) {',
      '      vec3 waveCol = mix(neutralSilver, u_switchLightPos.w > 0.01 ? srgbToLinear(u_switchLightColor) : samplePrismSpectrum6(capPhase, 0.82, u_prismConfig.x, u_envParams.x), 0.38);',
      '      totalLin += waveCol * (waveGlow * shoulderMask * ambientMul * mix(0.40, 0.24, u_envParams.x));',
      '    }',
      '    if (sweepW > 0.004) {',
      '      float dSwX = v_chassisPos.x - u_prismConfig.y;',
      '      float swEnv = exp(-dSwX * dSwX * 0.92) * sweepW;',
      '      vec3 swCapCol = mix(neutralSilver, samplePrismSpectrum6(fract(capPhase + 0.25), 0.84, u_prismConfig.x, u_envParams.x), 0.24);',
      '      totalLin += swCapCol * (swEnv * shoulderMask * ambientMul * mix(0.38, 0.24, u_envParams.x));',
      '    }',
      '  }',
      '',
      '  /* V13.1 #0 Orch mechanical latch-down state: desaturated anodized violet-gold halo (silver-gray under isMono) */',
      '  if (orchLatch > 0.005 && ambientMul > 0.01) {',
      '    float rimRing = smoothstep(0.50, 0.76, v_part) * (1.0 - smoothstep(0.84, 0.96, v_part));',
      '    float topBezel = step(0.85, v_part) * smoothstep(0.285, 0.348, max(abs(v_localPos.x), abs(v_localPos.z)));',
      '    float haloMask = clamp(rimRing * 0.82 + topBezel * 0.90 + pow(1.0 - ndvC, 3.0) * 0.22, 0.0, 1.0);',
      '    float diagPhase = clamp((v_localPos.x * 1.35 - v_localPos.z * 1.15) + 0.5, 0.0, 1.0);',
      '    vec3 orchRimLin = isMonoKey > 0.5',
      '      ? srgbToLinear(vec3(mix(0.78, 0.44, u_envParams.x)))',
      '      : srgbToLinear(mix(vec3(0.62, 0.48, 0.86), vec3(0.88, 0.72, 0.40), diagPhase));',
      '    float pulseLatch = 1.0 + u_prismConfig.w * 0.26;',
      '    totalLin += orchRimLin * (haloMask * orchLatch * pulseLatch * max(0.30, ambientMul) * mix(0.56, 0.42, u_envParams.x));',
      '  }',
      '',
      '  /* Subtle emissive hover halo on blind and dimmed keys */',
      '  if (isAvail < 0.99 && keyHover > 0.01) {',
      '    float topGlow = smoothstep(0.35, 0.58, v_localPos.y) * keyHover * 0.036 * (1.0 - isAvail);',
      '    totalLin += mix(vec3(0.42, 0.54, 0.78), vec3(0.60, 0.68, 0.82), u_envParams.x) * topGlow;',
      '  }',
      '',
      '  outColor = vec4(linearToDisplaySrgb(totalLin, gl_FragCoord.xy), 1.0);',
      '}',
    ].join('\n');

    var SCREEN_VS = [
      '#version 300 es',
      'precision highp float;',
      'layout(location = 0) in vec3 a_pos;',
      'layout(location = 1) in vec2 a_uv;',
      'uniform mat4 u_viewProj;',
      'uniform mat4 u_model;',
      'out vec3 v_worldPos;',
      'out vec3 v_localPos;',
      'out vec3 v_normal;',
      'out vec2 v_uv;',
      'void main() {',
      '  vec4 wp = u_model * vec4(a_pos, 1.0);',
      '  v_worldPos = wp.xyz;',
      '  v_localPos = a_pos;',
      '  v_normal = normalize(mat3(u_model) * vec3(0.0, 1.0, 0.0));',
      '  v_uv = a_uv;',
      '  gl_Position = u_viewProj * wp;',
      '}',
    ].join('\n');

    var SCREEN_FS = [
      '#version 300 es',
      'precision highp float;',
      'in vec3 v_worldPos;',
      'in vec3 v_localPos;',
      'in vec3 v_normal;',
      'in vec2 v_uv;',
      'uniform sampler2D u_oledTex;',
      'uniform sampler2D u_shadowTex;',
      'uniform mat4 u_lightViewProj;',
      'uniform vec3 u_camPos;',
      'uniform vec3 u_lightDir;',
      'uniform vec3 u_glassTint;',
      'uniform vec4 u_envParams;',
      'uniform vec4 u_prismFocusPos;',
      'uniform vec4 u_prismConfig;',
      'uniform vec4 u_screenOptics;',
      'uniform vec3 u_screenElemRgb;',
      'uniform float u_screenAvail;',
      'out vec4 outColor;',
      '',
      GLSL_PBR_COMMON,
      '',
      'float smootherstep5(float edge0, float edge1, float x) {',
      '  float t = clamp((x - edge0) / (edge1 - edge0), 0.0, 1.0);',
      '  return t * t * t * (t * (t * 6.0 - 15.0) + 10.0);',
      '}',
      '',
      '/* One-sided asymmetric fold-catastrophe silk caustic ribbon operator:',
      ' * Focuses a fine bright ridge at d=0, velvety diffuse wing for d>0, and deep negative space for d<0 */',
      'vec2 evalSilkRibbon(float d, float along, float cuspSharp, float wingDecay) {',
      '  float longEnv = exp(-along * along * 0.26);',
      '  float cusp = exp(-d * d * cuspSharp) * longEnv;',
      '  float wing = smoothstep(-0.048, 0.036, d) * exp(-max(d, 0.0) * wingDecay) * longEnv;',
      '  return vec2(wing, cusp);',
      '}',
      '',
      '/* V9 zero-polygon GPU per-pixel continuous silk caustic ribbons (C-infinity smooth, zero seams):',
      ' * Blends seamlessly into the clean backdrop over v_uv.x in [0.0, 0.58] via smootherstep5(0.58, 0.08, v_uv.x),',
      ' * forming 2-3 sweeping diagonal optical silk ridges */',
      'vec3 evalGpuSilkCausticBase(vec2 uv, vec3 R, float isLight) {',
      '  float isWarm = u_glassTint.r > u_glassTint.b ? 1.0 : 0.0;',
      '  vec3 baseDark = mix(vec3(0.0275, 0.0353, 0.0549), vec3(0.0431, 0.0353, 0.0314), isWarm);',
      '  vec3 baseLight = mix(vec3(0.9529, 0.9608, 0.9765), vec3(0.9608, 0.9490, 0.9255), isWarm);',
      '  vec3 pureBgSrgb = mix(baseDark, baseLight, isLight);',
      '',
      '  if (u_screenAvail < 0.5 || uv.x >= 0.58) {',
      '    return pureBgSrgb;',
      '  }',
      '',
      '  float rightFeather = smootherstep5(0.58, 0.08, uv.x);',
      '  float leftSoft = 0.28 + 0.72 * smoothstep(0.0, 0.048, uv.x);',
      '  float vertSoft = 0.24 + 0.76 * smoothstep(0.0, 0.075, uv.y) * smoothstep(1.0, 0.925, uv.y);',
      '  float wingMask = rightFeather * leftSoft * vertSoft;',
      '  if (wingMask <= 1e-4) {',
      '    return pureBgSrgb;',
      '  }',
      '',
      '  float zId = u_screenOptics.x;',
      '  float energy = clamp(u_screenOptics.y, 0.20, 1.0);',
      '  float yaw = u_screenOptics.z;',
      '  float pitch = u_screenOptics.w;',
      '  float ePulse = u_prismConfig.w;',
      '  float eGain = 0.74 + 0.42 * energy + ePulse * 0.24;',
      '',
      '  /* Wide-aspect ribbon coordinate space allowing diagonal ribbons to sweep gracefully across left-center */',
      '  vec2 p = vec2((uv.x - 0.215) * 2.85, (uv.y - 0.50) * 1.72);',
      '  vec2 refractOff = vec2(yaw * 0.48 + R.x * 0.12, -pitch * 0.40 - R.z * 0.10);',
      '  float phaseShift = yaw * 1.95 - pitch * 1.55 + ePulse * 0.62;',
      '  vec2 q = p - refractOff * 0.56;',
      '',
      '  vec3 elemSrgb = clamp(u_screenElemRgb, vec3(0.05), vec3(0.96));',
      '  float silkBody = 0.0;',
      '  float silkMid = 0.0;',
      '  float causticCrest = 0.0;',
      '  vec3 colDeepSrgb = elemSrgb * 0.50;',
      '  vec3 colMidSrgb = clamp(elemSrgb * 1.18 + 0.06, 0.0, 1.0);',
      '  vec3 colHighlightSrgb = vec3(0.94, 0.98, 1.00);',
      '',
      '  if (abs(zId - 6.0) < 0.5) {',
      '    /* Z=6 Carbon: three sweeping ice-cyan & diamond folded titanium silk caustic ribbons */',
      '    float s = q.x * 0.84 - q.y * 0.54;',
      '    float n = q.x * 0.54 + q.y * 0.84;',
      '    float d1 = n - 0.22 * sin(s * 2.15 + phaseShift * 0.75) + 0.09 * cos(s * 3.30 - yaw * 1.40) + 0.05;',
      '    float d2 = -(n + 0.20 * cos(s * 1.85 - phaseShift * 0.64) - 0.23);',
      '    float d3 = n - 0.15 * sin(s * 2.65 - 1.25 - pitch * 1.45) + 0.35;',
      '    vec2 rb1 = evalSilkRibbon(d1, s - 0.04, 58.0 + 18.0 * energy, 4.6);',
      '    vec2 rb2 = evalSilkRibbon(d2, s + 0.10, 48.0 + 14.0 * energy, 5.2);',
      '    vec2 rb3 = evalSilkRibbon(d3, s - 0.16, 72.0, 6.4);',
      '    float shimmer = 0.72 + 0.28 * cos(s * 3.4 + phaseShift);',
      '    silkBody = rb1.x * 0.76 + rb2.x * 0.82 + rb3.x * 0.44;',
      '    silkMid = rb1.x * 0.62 + rb2.x * 0.38 + (rb1.y * 0.55 + rb2.y * 0.45) * shimmer;',
      '    causticCrest = (rb1.y * 0.92 + rb2.y * 0.68 + rb3.y * 0.46) * shimmer;',
      '    colDeepSrgb = vec3(0.14, 0.16, 0.20);',
      '    colMidSrgb = vec3(0.56, 0.62, 0.70);',
      '    colHighlightSrgb = vec3(0.96, 0.98, 1.00);',
      '  } else if (abs(zId - 1.0) < 0.5) {',
      '    /* Z=1 Hydrogen: three arcing azure liquid-wave caustic ribbons */',
      '    float s1 = q.x * 0.88 - q.y * 0.47;',
      '    float n1 = q.x * 0.47 + q.y * 0.88;',
      '    float d1 = n1 - 0.25 * sin(s1 * 2.05 + phaseShift * 0.72) + 0.08 * sin(n1 * 2.4 - yaw * 1.3) + 0.09;',
      '    float d2 = -(n1 * 0.92 - q.x * 0.28 + 0.21 * cos(s1 * 2.25 - phaseShift * 0.68) - 0.19);',
      '    float d3 = n1 + 0.17 * sin(s1 * 2.75 + 0.9 - pitch * 1.4) - 0.28;',
      '    vec2 rb1 = evalSilkRibbon(d1, s1 - 0.02, 54.0 + 18.0 * energy, 4.4);',
      '    vec2 rb2 = evalSilkRibbon(d2, s1 + 0.08, 46.0 + 14.0 * energy, 5.0);',
      '    vec2 rb3 = evalSilkRibbon(d3, s1 - 0.12, 66.0, 6.0);',
      '    float causticRip = 0.70 + 0.30 * cos(s1 * 3.8 - phaseShift * 0.8);',
      '    silkBody = rb1.x * 0.78 + rb2.x * 0.76 + rb3.x * 0.45;',
      '    silkMid = rb1.x * 0.60 + rb2.x * 0.42 + (rb1.y * 0.58 + rb2.y * 0.44) * causticRip;',
      '    causticCrest = (rb1.y * 0.90 + rb2.y * 0.72 + rb3.y * 0.48) * causticRip;',
      '    colDeepSrgb = vec3(0.11, 0.31, 0.50);',
      '    colMidSrgb = vec3(0.34, 0.65, 0.87);',
      '    colHighlightSrgb = vec3(0.91, 0.97, 1.00);',
      '  } else if (abs(zId - 10.0) < 0.5) {',
      '    /* Z=10 Neon: two primary and one accent high-curvature coral-amber blown-glass plasma ribbons */',
      '    float s = q.x * 0.86 - q.y * 0.51;',
      '    float n = q.x * 0.51 + q.y * 0.86;',
      '    float d1 = n - 0.27 * sin(s * 1.95 - 0.32 + phaseShift * 0.70) + 0.10 * cos(n * 2.2 - pitch * 1.3) + 0.06;',
      '    float d2 = -(n * 0.94 + 0.23 * cos(s * 2.15 + yaw * 1.45) - 0.21);',
      '    float d3 = n + 0.16 * cos(s * 2.60 - phaseShift * 0.58) + 0.32;',
      '    vec2 rb1 = evalSilkRibbon(d1, s - 0.03, 62.0 + 20.0 * energy, 4.5);',
      '    vec2 rb2 = evalSilkRibbon(d2, s + 0.09, 50.0 + 16.0 * energy, 5.1);',
      '    vec2 rb3 = evalSilkRibbon(d3, s - 0.14, 74.0, 6.5);',
      '    float glassGlow = 0.74 + 0.26 * sin(s * 2.9 + phaseShift * 0.7);',
      '    silkBody = rb1.x * 0.80 + rb2.x * 0.78 + rb3.x * 0.40;',
      '    silkMid = rb1.x * 0.64 + rb2.x * 0.40 + (rb1.y * 0.56 + rb2.y * 0.46) * glassGlow;',
      '    causticCrest = (rb1.y * 0.94 + rb2.y * 0.70 + rb3.y * 0.45) * glassGlow;',
      '    colDeepSrgb = vec3(0.42, 0.13, 0.10);',
      '    colMidSrgb = vec3(0.85, 0.41, 0.30);',
      '    colHighlightSrgb = vec3(1.00, 0.93, 0.85);',
      '  } else if (abs(zId - 18.0) < 0.5) {',
      '    /* Z=18 Argon: three -36-deg slender royal cobalt-indigo aurora silk curtains */',
      '    float vDiag = q.x * 0.80 - q.y * 0.60;',
      '    float uDiag = q.x * 0.60 + q.y * 0.80;',
      '    float d1 = uDiag + 0.23 * sin(vDiag * 2.20 + phaseShift * 0.78) + 0.05;',
      '    float d2 = -(uDiag * 0.95 - 0.20 * cos(vDiag * 1.92 - yaw * 1.60) - 0.22);',
      '    float d3 = uDiag - 0.16 * sin(vDiag * 2.80 - 1.35 - pitch * 1.40) + 0.34;',
      '    vec2 rb1 = evalSilkRibbon(d1, vDiag - 0.04, 56.0 + 18.0 * energy, 4.4);',
      '    vec2 rb2 = evalSilkRibbon(d2, vDiag + 0.10, 48.0 + 14.0 * energy, 4.9);',
      '    vec2 rb3 = evalSilkRibbon(d3, vDiag - 0.15, 68.0, 6.2);',
      '    float auroraHarm = 0.72 + 0.28 * cos(vDiag * 3.2 + phaseShift);',
      '    silkBody = rb1.x * 0.78 + rb2.x * 0.82 + rb3.x * 0.46;',
      '    silkMid = rb1.x * 0.60 + rb2.x * 0.44 + (rb1.y * 0.55 + rb2.y * 0.45) * auroraHarm;',
      '    causticCrest = (rb1.y * 0.90 + rb2.y * 0.72 + rb3.y * 0.48) * auroraHarm;',
      '    colDeepSrgb = vec3(0.16, 0.20, 0.46);',
      '    colMidSrgb = vec3(0.36, 0.44, 0.78);',
      '    colHighlightSrgb = vec3(0.91, 0.93, 1.00);',
      '  } else {',
      '    float sg = q.x * 0.84 - q.y * 0.54;',
      '    float ng = q.x * 0.54 + q.y * 0.84;',
      '    vec2 rbg1 = evalSilkRibbon(ng - 0.22 * sin(sg * 2.1 + phaseShift * 0.7) + 0.05, sg, 56.0, 4.6);',
      '    vec2 rbg2 = evalSilkRibbon(-(ng + 0.19 * cos(sg * 1.9 - yaw) - 0.22), sg + 0.1, 48.0, 5.2);',
      '    silkBody = rbg1.x * 0.78 + rbg2.x * 0.76;',
      '    silkMid = rbg1.x * 0.62 + rbg1.y * 0.52 + rbg2.y * 0.40;',
      '    causticCrest = rbg1.y * 0.88 + rbg2.y * 0.66;',
      '  }',
      '',
      '  if (isLight > 0.5) {',
      '    /* Light mode: translucent watercolor caustic ribbons & soft white ridges over warm quartz substrate */',
      '    vec3 wcTint = mix(pureBgSrgb, colMidSrgb, 0.40);',
      '    vec3 wcDeep = mix(pureBgSrgb, colDeepSrgb * 1.32 + 0.16, 0.30);',
      '    vec3 lightWing = pureBgSrgb;',
      '    lightWing = mix(lightWing, wcDeep, clamp(silkBody * 0.54 * eGain * wingMask, 0.0, 0.66));',
      '    lightWing = mix(lightWing, wcTint, clamp(silkMid * 0.62 * eGain * wingMask, 0.0, 0.72));',
      '    lightWing += vec3(1.0, 1.0, 1.0) * (causticCrest * 0.18 * eGain * wingMask);',
      '    return clamp(lightWing, 0.0, 1.0);',
      '  }',
      '',
      '  /* Dark mode: folded caustic silk ridges sweeping through deep obsidian negative space */',
      '  vec3 baseLin = srgbToLinear(pureBgSrgb);',
      '  vec3 wingLin = srgbToLinear(colDeepSrgb) * (silkBody * 0.62)',
      '    + srgbToLinear(colMidSrgb) * (silkMid * 0.88)',
      '    + srgbToLinear(colHighlightSrgb) * (causticCrest * (0.48 + 0.26 * energy));',
      '  vec3 combinedLin = baseLin + wingLin * (wingMask * eGain);',
      '  vec3 softMapped = combinedLin / (1.0 + combinedLin * 0.44);',
      '  return pow(clamp(softMapped, 0.0, 1.0), vec3(1.0 / 2.2));',
      '}',
      '',
      'void main() {',
      '  /* 1. R=0.16U rounded-rect SDF anti-aliased clipping & 2.5D curved smoked sapphire glass normal gradient */',
      '  vec2 pScr = v_localPos.xz - vec2(-2.00, -1.58);',
      '  vec2 halfScr = vec2(4.896, 1.436);',
      '  float rScr = 0.158;',
      '  vec2 qScr = abs(pScr) - (halfScr - rScr);',
      '  vec2 outQ = max(qScr, 0.0);',
      '  float outLen = length(outQ);',
      '  float dScr = outLen + min(max(qScr.x, qScr.y), 0.0) - rScr;',
      '  float aaScr = max(fwidth(dScr), 0.0022);',
      '  float scrAlpha = 1.0 - smoothstep(-aaScr, aaScr, dScr);',
      '  if (scrAlpha <= 0.004) discard;',
      '',
      '  vec2 grad2D = outLen > 1e-4',
      '    ? sign(pScr) * (outQ / outLen)',
      '    : ((qScr.x > qScr.y) ? vec2(sign(pScr.x), 0.0) : vec2(0.0, sign(pScr.y)));',
      '  float curveT = smoothstep(-0.125, -0.003, dScr);',
      '  float domeSlope = curveT * curveT;',
      '  vec2 uvSample = clamp(v_uv - grad2D * domeSlope * vec2(0.0018, 0.0060), vec2(0.0006), vec2(0.9994));',
      '',
      '  vec4 oled = texture(u_oledTex, uvSample);',
      '  vec3 N = normalize(v_normal);',
      '  vec3 V = normalize(u_camPos - v_worldPos);',
      '  vec3 R = reflect(-V, N);',
      '  float ndv = max(dot(N, V), 1e-4);',
      '  /* SCREEN_FS skips costly multi-tap shadow lookups and drives soft breathing/scanline sheen directly on GPU (0 Canvas2D redraws) */',
      '',
      '  /* 2. Lossless dark/light full-bleed banner compositing preserving crisp daylight porcelain and deep velvet dark tones */',
      '  float isLightScr = clamp(u_envParams.x, 0.0, 1.0);',
      '  float oledA = clamp(oled.a, 0.0, 1.0);',
      '  vec3 compositedSrgb = oled.rgb;',
      '  if (oledA < 0.5) {',
      '    vec3 gpuSilkBaseSrgb = evalGpuSilkCausticBase(uvSample, R, isLightScr);',
      '    compositedSrgb = mix(gpuSilkBaseSrgb, oled.rgb, oledA * 2.0);',
      '  }',
      '',
      '  /* 3. 2.5D curved optical glass edge micro-refraction + subtle diagonal specular sheen on pointer/orbit motion */',
      '  float yaw = u_screenOptics.z;',
      '  float pitch = u_screenOptics.w;',
      '  float sweep1 = v_uv.x * 0.78 + v_uv.y * 0.46 + yaw * 0.52 - pitch * 0.36 + R.x * 0.34;',
      '  float sheenBand1 = smoothstep(0.26, 0.44, sweep1) * (1.0 - smoothstep(0.50, 0.68, sweep1));',
      '  float sweep2 = v_uv.x * 0.82 + v_uv.y * 0.42 + yaw * 0.48 - pitch * 0.32 - 0.34;',
      '  float sheenBand2 = smoothstep(0.40, 0.48, sweep2) * (1.0 - smoothstep(0.50, 0.58, sweep2));',
      '  float fres = pow(1.0 - ndv, 4.6);',
      '',
      '  float ptrSheen = 0.0;',
      '  if (u_prismFocusPos.w > 0.01) {',
      '    float dPtrDiag = (v_localPos.x - u_prismFocusPos.x) * 0.74 + (v_localPos.z - u_prismFocusPos.z) * 0.48;',
      '    float wideRibbon = exp(-dPtrDiag * dPtrDiag * 0.52);',
      '    float crispCrest = exp(-dPtrDiag * dPtrDiag * 4.20);',
      '    ptrSheen = (wideRibbon * mix(0.042, 0.056, isLightScr) + crispCrest * mix(0.046, 0.062, isLightScr)) * u_prismFocusPos.w;',
      '  }',
      '',
      '  float rimArcBand = smoothstep(-0.088, -0.012, dScr) * (1.0 - smoothstep(-0.008, 0.001, dScr));',
      '  vec2 keyDir2D = normalize(vec2(-0.52 + yaw * 0.45, -0.85 - pitch * 0.35));',
      '  float catchTopLeft = pow(max(dot(grad2D, keyDir2D), 0.0), 1.65);',
      '  float catchBotRight = pow(max(dot(grad2D, -keyDir2D), 0.0), 2.20);',
      '  vec3 edgeRefractGlint = mix(vec3(0.84, 0.91, 1.00), vec3(1.00, 1.00, 1.00), isLightScr) * (rimArcBand * (0.022 + 0.088 * catchTopLeft + 0.036 * catchBotRight));',
      '',
      '  float microSeatShade = mix(0.90 + 0.10 * smoothstep(-0.002, -0.030, dScr), 0.975 + 0.025 * smoothstep(-0.001, -0.018, dScr), isLightScr);',
      '  /* Zero-cost GPU dynamic optical breathing glow + subtle scanline sheen + effort/pulse modulation (replaces per-frame Canvas2D uploads) */',
      '  float gpuTime = u_envParams.w;',
      '  float ePulseScr = u_prismConfig.w;',
      '  float breathWave = 0.5 + 0.5 * sin(gpuTime * 1.15);',
      '  float scanSweep = fract(v_uv.x * 0.42 + v_uv.y * 0.18 - gpuTime * 0.085);',
      '  float scanBand = exp(-pow((scanSweep - 0.5) * 7.5, 2.0)) * mix(0.014, 0.009, isLightScr) * u_envParams.z;',
      '  float microScanline = (0.5 + 0.5 * sin(v_uv.y * 240.0 * 3.14159265)) * mix(0.006, 0.002, isLightScr);',
      '  float breathGain = 1.0 + (breathWave * 0.012 + ePulseScr * 0.048) * u_envParams.z * mix(1.0, 0.45, isLightScr);',
      '  float diagSheen = (sheenBand1 * 0.016 + sheenBand2 * 0.010 + fres * 0.012) + ptrSheen + scanBand;',
      '  if (u_prismConfig.z > 0.004) {',
      '    float dSw = v_localPos.x - u_prismConfig.y;',
      '    diagSheen += exp(-dSw * dSw * 1.10) * u_prismConfig.z * u_envParams.z * 0.030;',
      '  }',
      '',
      '  vec3 finalSrgb = clamp(',
      '    compositedSrgb * microSeatShade * breathGain * (1.0 - microScanline) + mix(vec3(0.93, 0.96, 1.00), vec3(1.00, 1.00, 1.00), isLightScr) * diagSheen + edgeRefractGlint,',
      '    0.0,',
      '    1.0',
      '  );',
      '  float dither = fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715)))) - 0.5;',
      '  outColor = vec4(clamp(finalSrgb + dither / 255.0, 0.0, 1.0), scrAlpha);',
      '}',
    ].join('\n');

    /* ============================================================================
     * 8. Main Factory Function createKeyboard3DRenderer
     * ============================================================================ */
    function createKeyboard3DRenderer(options) {
      var opts = options || {};
      var canvas = opts.canvas || null;
      var doc = opts.doc || (typeof document !== 'undefined' ? document : null);
      var root = opts.root || (typeof window !== 'undefined' ? window : globalThis);
      var slots = Array.isArray(opts.slots) ? opts.slots : [];
      var enableAuxPad = opts.enableAuxPad !== false;
      var activeAuxCount = enableAuxPad ? AUX_SLOT_COUNT : 0;
      var onWakeFrame = typeof opts.onWakeFrame === 'function' ? opts.onWakeFrame : null;

      var grainAssets = loadMacroGrainAssets(root);

      var slotCount = slots.length;
      var totalInstanceCapacity = Math.max(1, slotCount + AUX_SLOT_COUNT);
      var slotIndexByZ = new Map();
      var slotCoords = new Array(slotCount);
      var mainRowBucketMap = new Map();
      for (var si = 0; si < slotCount; si++) {
        var sl = slots[si];
        var zKey = sl.slotZ !== undefined ? sl.slotZ : sl.z;
        slotIndexByZ.set(zKey, si);
        if (sl.z !== undefined) slotIndexByZ.set(sl.z, si);
        var rowNum = clamp(Math.round(Number(sl.row) || 4), 1, 7);
        var rProf = ROW_SCULPT_PROFILE[rowNum] || ROW_SCULPT_PROFILE[4];
        var scx = (sl.col - 9.5) * KEY_PITCH;
        var scz = (sl.row - 4.0) * KEY_PITCH + ROW_Z_OFFSET;
        slotCoords[si] = {
          x: scx,
          z: scz,
          row: rowNum,
          rowPitch: rProf.pitch,
          rowScaleY: rProf.scaleY,
          rowYBias: rProf.yBias,
        };
        var rb = mainRowBucketMap.get(rowNum);
        if (!rb) {
          rb = { minX: scx - 0.92, maxX: scx + 0.92, minZ: scz - 0.92, maxZ: scz + 0.92, indices: [] };
          mainRowBucketMap.set(rowNum, rb);
        } else {
          if (scx - 0.92 < rb.minX) rb.minX = scx - 0.92;
          if (scx + 0.92 > rb.maxX) rb.maxX = scx + 0.92;
          if (scz - 0.92 < rb.minZ) rb.minZ = scz - 0.92;
          if (scz + 0.92 > rb.maxZ) rb.maxZ = scz + 0.92;
        }
        rb.indices.push(si);
      }
      var mainRowBuckets = Array.from(mainRowBucketMap.values());

      /* Local coordinates for right 2x3 aux pad 6 sculpted keycaps (aligned with main rows 5..7 ergonomics) */
      var auxSlotCoords = new Array(AUX_SLOT_COUNT);
      for (var asi = 0; asi < AUX_SLOT_COUNT; asi++) {
        var aCol = asi % AUX_COLS;
        var aRow = Math.floor(asi / AUX_COLS);
        var mappedRowNum = clamp(5 + aRow, 5, 7);
        var aProf = ROW_SCULPT_PROFILE[mappedRowNum] || ROW_SCULPT_PROFILE[5];
        auxSlotCoords[asi] = {
          col: aCol,
          row: aRow,
          x: aCol === 0 ? AUX_COL0_X : AUX_COL1_X,
          z: AUX_ROW_ZS[aRow],
          rowPitch: aProf.pitch,
          rowScaleY: aProf.scaleY,
          rowYBias: aProf.yBias,
        };
      }

      /* Viewport dimensions, subpixel DPR & zero-reflow geometry bounds cache */
      var cssWidth = 1040;
      var cssHeight = 552;
      var dpr = 1;
      var cachedCanvasRect = null;
      var lastCanvasRectFn = null;

      function syncCanvasBounds(explicitRect) {
        if (explicitRect && typeof explicitRect === 'object') {
          var ew = Number(explicitRect.width) || 0;
          var eh = Number(explicitRect.height) || 0;
          if (ew > 80 && eh > 60) {
            cachedCanvasRect = {
              left: Number(explicitRect.left) || 0,
              top: Number(explicitRect.top) || 0,
              width: ew,
              height: eh,
            };
            if (canvas) lastCanvasRectFn = canvas.getBoundingClientRect;
            return cachedCanvasRect;
          }
        }
        if (canvas && typeof canvas.getBoundingClientRect === 'function') {
          try {
            var mr = canvas.getBoundingClientRect();
            lastCanvasRectFn = canvas.getBoundingClientRect;
            if (mr && mr.width > 1 && mr.height > 1) {
              cachedCanvasRect = {
                left: Number(mr.left) || 0,
                top: Number(mr.top) || 0,
                width: mr.width > 80 && mr.height > 60 ? Number(mr.width) : cssWidth,
                height: mr.width > 80 && mr.height > 60 ? Number(mr.height) : cssHeight,
              };
              return cachedCanvasRect;
            }
          } catch (_rErr) {}
        }
        cachedCanvasRect = { left: 0, top: 0, width: cssWidth, height: cssHeight };
        return cachedCanvasRect;
      }

      function readCanvasCssRect(forceMeasure) {
        if (
          forceMeasure ||
          !cachedCanvasRect ||
          (canvas && canvas.getBoundingClientRect !== lastCanvasRectFn)
        ) {
          return syncCanvasBounds(null);
        }
        return cachedCanvasRect;
      }

      if (canvas) {
        var initRect = typeof canvas.getBoundingClientRect === 'function' ? canvas.getBoundingClientRect() : null;
        lastCanvasRectFn = canvas.getBoundingClientRect;
        if (initRect && initRect.width > 80 && initRect.height > 60) {
          cssWidth = initRect.width;
          cssHeight = initRect.height;
          cachedCanvasRect = {
            left: Number(initRect.left) || 0,
            top: Number(initRect.top) || 0,
            width: initRect.width,
            height: initRect.height,
          };
        } else if (canvas.width > 80 && canvas.height > 60) {
          cssWidth = canvas.width;
          cssHeight = canvas.height;
          cachedCanvasRect = {
            left: initRect ? Number(initRect.left) || 0 : 0,
            top: initRect ? Number(initRect.top) || 0 : 0,
            width: cssWidth,
            height: cssHeight,
          };
        } else if (initRect && initRect.width > 10 && initRect.height > 10) {
          cssWidth = initRect.width;
          cssHeight = initRect.height;
          cachedCanvasRect = {
            left: Number(initRect.left) || 0,
            top: Number(initRect.top) || 0,
            width: cssWidth,
            height: cssHeight,
          };
        }
      }

      /* External scene input state (V11 supports 6-slot auxModels mutual-exclusion & dual stageMode) */
      var state = {
        themeProfile: {
          id: 'obsidian-dark',
          isLight: false,
          isMono: false,
          rimTone: null,
          ambientMul: 0.7,
          primaryHex: '#5694BD',
        },
        availableByZ: new Map(),
        selectedZ: 6,
        hoveredZ: null,
        pressedZ: null,
        confirmSlamZ: null,
        confirmSlamActive: false,
        lockedShakeZ: null,
        lockedShakeAuxIndex: null,
        orchLatched: Boolean(opts.orchLatched),
        auxModels: normalizeAuxModels(opts.auxModels),
        auxPage: Math.max(0, Math.floor(Number(opts.auxPage) || 0)),
        auxPageCount: Math.max(1, Math.floor(Number(opts.auxPageCount) || 1)),
        selectedAuxIndex: null,
        hoveredAuxIndex: null,
        pressedAuxIndex: null,
        confirmSlamAuxIndex: null,
        stageMode: opts.stageMode === 'drawer' ? 'drawer' : 'fullscreen',
        deckInfo: null,
        topControls: { muted: false, hoveredBtn: null, pressedBtn: null },
        hardwareState: { muted: false, hoveredControl: null, pressedControl: null },
        reducedMotion: Boolean(opts.reducedMotion),
      };

      /* ============================================================================
       * V11 Physics Engine State:
       * 1) Heavy damped near-field magnetic spring (shared by levitated main & 2x3 aux keys)
       * 2) 1:1 responsive orbit servo + 0.88 momentum coasting + ~3.2% dual-pad zero-G co-orbit lag
       * 3) 4-tier effort levitation heights (0.40U..1.06U) + 3D octahedral crystal field + <=1.65U neighbor sympathy
       * ============================================================================ */
      var pointerMode = 'none'; /* 'none' | 'client' | 'norm' */
      var lastClientX = -9999;
      var lastClientY = -9999;
      var lastClientInside = false;
      var lastNearRadiusPx = 160;
      var lastNearDistPx = Infinity;
      var lastCapCx = NaN;
      var lastCapCy = NaN;
      var lastStaticFocusMs = 0;

      var pointerTargetX = 0;
      var pointerTargetY = 0;

      var tgtLiftPitch = 0;
      var tgtLiftRoll = 0;
      var tgtLiftYaw = 0;
      var tgtLiftMagX = 0;
      var tgtLiftMagZ = 0;
      var nearTrackingActive = false;

      /* Stage-1 heavy inertia input filter state */
      var fltLiftPitch = 0;
      var fltLiftRoll = 0;
      var fltLiftYaw = 0;
      var fltLiftMagX = 0;
      var fltLiftMagZ = 0;

      /* Main & aux pad 3D co-orbit state (aux adds ~3.2% zero-G inertial lag, converging cleanly to zero at rest/reset) */
      var orbitPitchCur = 0;
      var orbitYawCur = 0;
      var orbitTargetPitch = 0;
      var orbitTargetYaw = 0;
      var orbitServoActive = false;
      var orbitPitchVel = 0;
      var orbitYawVel = 0;
      var orbitMode = 'idle'; /* 'idle' | 'direct' | 'servo' | 'fling' | 'reset' */
      var chassisInstVelPitch = 0;
      var chassisInstVelYaw = 0;

      var auxOrbitPitchCur = 0;
      var auxOrbitYawCur = 0;
      var auxOrbitPitchVel = 0;
      var auxOrbitYawVel = 0;
      var auxPhaseLiftY = 0;

      /* Levitated hero key antigravity gyro counter-tilt & slow zero-G float state */
      var gyroPitchCur = 0;
      var gyroRollCur = 0;
      var gyroYawCur = 0;
      var gyroPitchVel = 0;
      var gyroRollVel = 0;
      var gyroYawVel = 0;

      var zeroGRemainSec = 0;
      var zeroGPhase = 0;
      var zeroGEnvCur = 0;
      var zeroGBobCur = 0;
      var fluxPhase = 0;

      /* Effort-tier levitation height & neighbor zero-G sympathy spring state */
      var effortTierCur = 1;
      var effortLiftHeightCur = EFFORT_TIER_LIFTS[1];
      var effortLiftHeightVel = 0;
      var neighborSympathyCur = 0;
      var neighborSympathyVel = 0;

      /* Global animation trio state (intro wake / wave ripple / energy pulse) */
      var introActive = false;
      var introElapsed = 0;
      var sweepWaveX = -16.0;
      var sweepWaveWeight = 0.0;

      var waveRipples = []; /* { ox, oz, elapsed, strength } */
      var keyWaveDip = new Float32Array(slotCount);
      var keyWaveGlow = new Float32Array(slotCount);
      var keyWavePitch = new Float32Array(slotCount);
      var keyWaveRoll = new Float32Array(slotCount);

      var auxKeyWaveDip = new Float32Array(AUX_SLOT_COUNT);
      var auxKeyWaveGlow = new Float32Array(AUX_SLOT_COUNT);
      var auxKeyWavePitch = new Float32Array(AUX_SLOT_COUNT);
      var auxKeyWaveRoll = new Float32Array(AUX_SLOT_COUNT);

      /* Aux pad 2x3 page-switch light elastic wave bounce state */
      var auxPageWaveActive = false;
      var auxPageWaveElapsed = 0;
      var auxPageWaveDir = 1;
      var auxPageKeyDip = new Float32Array(AUX_SLOT_COUNT);
      var auxPageKeyPitch = new Float32Array(AUX_SLOT_COUNT);

      var energyPulseActive = false;
      var energyPulseElapsed = 0;
      var energyPulseAmp = 0;
      var energyPulseVal = 0;

      /* Cached pointer 3D intersection on chassis [x, y, z, activeWeight] */
      var prismFocusVec = [0, CASE_Y_TOP, 0, 0];

      var liftYawCur = 0;
      var liftPitchCur = 0;
      var liftRollCur = 0;
      var liftMagXCur = 0;
      var liftMagZCur = 0;

      var liftYawVel = 0;
      var liftPitchVel = 0;
      var liftRollVel = 0;
      var liftMagXVel = 0;
      var liftMagZVel = 0;

      var keyLiftCur = new Float32Array(slotCount);
      var keyLiftVel = new Float32Array(slotCount);
      var keyPressCur = new Float32Array(slotCount);
      var keyHoverCur = new Float32Array(slotCount);

      var auxKeyLiftCur = new Float32Array(AUX_SLOT_COUNT);
      var auxKeyLiftVel = new Float32Array(AUX_SLOT_COUNT);
      var auxKeyPressCur = new Float32Array(AUX_SLOT_COUNT);
      var auxKeyHoverCur = new Float32Array(AUX_SLOT_COUNT);

      /* V12 #0 Orch mechanical latch spring + smooth dim transition for unsupported keys + aux lock shake state */
      var orchLatchCur = state.orchLatched ? 1.0 : 0.0;
      var orchLatchVel = 0;
      var slotAvailCur = new Float32Array(slotCount);
      var auxAvailCur = new Float32Array(AUX_SLOT_COUNT);
      var hasSyncedInitialAvail = false;
      var hasSyncedInitialAuxAvail = Boolean(Array.isArray(opts.auxModels));
      var auxShakeActiveIdx = -1;
      var auxShakeProgress = 1.0;
      for (var initAi = 0; initAi < AUX_SLOT_COUNT; initAi++) {
        var initASlot = state.auxModels[initAi] || DEFAULT_AUX_MODELS[initAi];
        auxAvailCur[initAi] = initASlot && initASlot.available ? 1.0 : 0.0;
      }

      var effortPressCur = new Float32Array(8);
      var effortHoverCur = new Float32Array(8);

      /* V10 Row 1 4 physical 3D hardware control spring states (0:'prism-wave', 1:'reset-view', 2:'mute', 3:'close') */
      var ctrlHoverCur = new Float32Array(4);
      var ctrlPressCur = new Float32Array(4);
      var ctrlPulseRemain = new Float32Array(4);
      var CTRL_PULSE_DURATION = 0.19;
      var knobAngleCur = -0.38;
      var knobAngleVel = 0;
      var knobAngleTarget = -0.38;
      var knobSpinOffset = 0;
      var blindTapIdx = -1;
      var blindTapRemain = 0;
      var BLIND_TAP_DURATION = 0.18;
      var artisanWaveDipCur = 0;

      /* Matrix cache (co-orbiting main chassisMat & right 2x3 auxChassisMat) */
      var projMat = mat4Identity();
      var viewMat = mat4Identity();
      var viewProjMat = mat4Identity();
      var invViewProjMat = mat4Identity();
      var chassisMat = mat4Identity();
      var invChassisMat = mat4Identity();
      var auxChassisMat = mat4Identity();
      var invAuxChassisMat = mat4Identity();
      var lightProjMat = mat4Identity();
      var lightViewMat = mat4Identity();
      var lightViewProjMat = mat4Identity();
      var camEye = [0, 32, 11];
      var camRightVec = [1, 0, 0];
      var camUpVec = [0, 1, 0];
      var keyLocalMats = new Array(slotCount);
      var keyLocalInvMats = new Array(slotCount);
      var keyLocalInvValid = new Uint8Array(slotCount);
      var keyTrsCache = new Float32Array(slotCount * 8);
      keyTrsCache.fill(NaN);
      var auxKeyLocalMats = new Array(AUX_SLOT_COUNT);
      var auxKeyLocalInvMats = new Array(AUX_SLOT_COUNT);
      var auxKeyLocalInvValid = new Uint8Array(AUX_SLOT_COUNT);
      var auxKeyTrsCache = new Float32Array(AUX_SLOT_COUNT * 8);
      auxKeyTrsCache.fill(NaN);
      var lastPickKind = null;
      var lastPickIdx = -1;
      var invLiftCapMat = mat4Identity();
      for (var mi = 0; mi < slotCount; mi++) {
        keyLocalMats[mi] = mat4Identity();
        keyLocalInvMats[mi] = mat4Identity();
      }
      for (var ami = 0; ami < AUX_SLOT_COUNT; ami++) {
        auxKeyLocalMats[ami] = mat4Identity();
        auxKeyLocalInvMats[ami] = mat4Identity();
      }

      /* Precomputed front-left overhead key-light ortho shadow view matrix (covers main -9.68 to aux +12.90 across full orbit) */
      var shadowCenterX = enableAuxPad ? 1.56 : 0.0;
      var shadowHalfSpanX = enableAuxPad ? 13.85 : 11.80;
      mat4Ortho(lightProjMat, -shadowHalfSpanX, shadowHalfSpanX, -8.85, 8.85, 3.0, 42.0);
      mat4LookAt(
        lightViewMat,
        [
          shadowCenterX + MAIN_LIGHT_DIR[0] * 21.0,
          MAIN_LIGHT_DIR[1] * 21.0,
          0.38 + MAIN_LIGHT_DIR[2] * 21.0,
        ],
        [shadowCenterX, 0.0, 0.38],
        [0.0, 1.0, 0.0]
      );
      mat4Multiply(lightViewProjMat, lightProjMat, lightViewMat);

      /* Lazy-init 2x HiDPI offscreen fallback canvas (avoids redundant 1600x480 2D canvas when oledPainter is active) */
      var oledSurf = null;
      var activeOledCanvas = null;
      var oledTexAllocated = false;
      var oledTexW = 0;
      var oledTexH = 0;
      var atlasSurf = null;
      var auxStripSurf = null;
      var lastAuxAtlasSig = '';
      var oledPainter = null;
      var oledPainterProbed = false;
      var animClockMs = 10000;
      var lastOledSig = '';
      var lastOledDiscreteSig = '';
      var lastOledCoreSig = '';
      var lastOledUploadMs = -1;
      var oledPendingFlush = false;
      var oledCoreTransitionStep = false;
      var OLED_SWEEP_THROTTLE_MS = 36.0;
      var OLED_ANIM_THROTTLE_MS = 33.0;
      var lastChassisThemeId = '';
      var lastChassisAuxFlag = enableAuxPad ? 1 : 0;
      var hasLiftedKeycapCavity = false;
      /* Zero-GC per-frame preallocated scratch buffers eliminating array literals & instance swap allocations */
      var _tmpInstSwap32 = new Float32Array(32);
      var _framePrismCfg4 = new Float32Array(4);
      var _frameEnvVec4 = new Float32Array(4);
      var _frameLiftShadow4 = new Float32Array(4);
      var _zeroVec4 = new Float32Array([0, 0, 0, 0]);
      var _fallbackRimTint3 = new Float32Array([0.74, 0.84, 1.0]);

      function ensureOledSurf() {
        if (!oledSurf && !disposed) {
          oledSurf = createOffscreenCanvas(doc, OLED_WIDTH, OLED_HEIGHT);
          if (!activeOledCanvas && oledSurf) {
            activeOledCanvas = oledSurf.canvas;
          }
        }
        return oledSurf;
      }

      function ensureAuxStripSurf() {
        if (!auxStripSurf && !disposed) {
          auxStripSurf = createOffscreenCanvas(doc, ATLAS_SIZE, AUX_ATLAS_H);
        }
        return auxStripSurf;
      }

      /* WebGL2 or Canvas 2D initialization probe */
      var gl = null;
      var ctx2d = null;
      var rendererMode = 'canvas2d';
      var disposed = false;
      var contextLost = false;
      var rafId = 0;
      var lastFrameMs = 0;
      var lastDrawAt = 0;
      var idle = true;
      var hasInitialRender = false;
      var camDistCur = 32;

      /* Dynamic FPS cap, motion level tiers, static shadow cache, background 0fps sleep & telemetry counters */
      var explicitTargetFps = (opts.targetFps !== undefined && opts.targetFps !== null && opts.targetFps !== '')
        ? normalizeTargetFps(opts.targetFps)
        : null;
      var explicitMotionLevel = (opts.motionLevel !== undefined && opts.motionLevel !== null && opts.motionLevel !== '')
        ? normalizeMotionLevel(opts.motionLevel)
        : null;
      var explicitPaused = Boolean(opts.paused);
      var pendingRenderWhilePaused = false;
      var shadowDirty = true;
      var lastShadowGeomSig = '';
      var lastShadowDrawClockMs = -1000;
      var SHADOW_THROTTLE_MS = 33.0;
      var lastDynMeshSig = '';
      var keycapInstanceDirty = true;
      var perfStats = {
        shadowDraws: 0,
        shadowSkips: 0,
        frameDraws: 0,
        dynMeshRebuilds: 0,
      };
      var attrMutationObserver = null;
      var visibilityListenerBound = false;

      function readDocAttr(attrName) {
        try {
          var de = doc && doc.documentElement;
          if (de && typeof de.getAttribute === 'function') {
            return de.getAttribute(attrName);
          }
        } catch (_aErr) {}
        return null;
      }

      function resolveTargetFps() {
        if (explicitTargetFps !== null) return explicitTargetFps;
        return normalizeTargetFps(readDocAttr('data-ag-cs-target-fps'));
      }

      function resolveMotionLevel() {
        if (state.reducedMotion || checkPrefersReducedMotion(root)) {
          return 'off';
        }
        if (explicitMotionLevel !== null) {
          return explicitMotionLevel;
        }
        var domLv = normalizeMotionLevel(readDocAttr('data-ag-cs-motion'));
        return domLv || 'ultra';
      }

      function isMotionReduced() {
        return Boolean(state.reducedMotion || resolveMotionLevel() === 'off');
      }

      function resolveTargetShadowMapSize() {
        return resolveMotionLevel() === 'ultra' ? SHADOW_MAP_SIZE_ULTRA : SHADOW_MAP_SIZE_REDUCED;
      }

      var activeShadowMapSize = resolveTargetShadowMapSize();

      function isDocHidden() {
        try {
          return Boolean(doc && (doc.hidden === true || doc.visibilityState === 'hidden'));
        } catch (_dhErr) {
          return false;
        }
      }

      function isWinBlurred() {
        return readDocAttr('data-ag-cs-win-blur') === '1';
      }

      function isEffectivelyPaused() {
        return Boolean(explicitPaused || isDocHidden() || isWinBlurred());
      }

      function energizeZeroG(durationSec) {
        if (isMotionReduced() || isConfirmSlamActiveGlobal()) return;
        var dur = durationSec === undefined ? ZERO_G_DURATION : Number(durationSec) || ZERO_G_DURATION;
        if (dur > zeroGRemainSec) {
          zeroGRemainSec = Math.min(ZERO_G_DURATION, dur);
        }
      }

      var asyncOledCoalesceRaf = 0;

      function cancelAsyncOledCoalesce() {
        if (asyncOledCoalesceRaf && root && typeof root.cancelAnimationFrame === 'function') {
          root.cancelAnimationFrame(asyncOledCoalesceRaf);
        }
        asyncOledCoalesceRaf = 0;
      }

      function ensureOledPainter() {
        if (disposed) return null;
        if (oledPainter) return oledPainter;
        if (oledPainterProbed) return null;
        var oledMod = resolveOledScreenModule(root);
        if (!oledMod || typeof oledMod.createOledScreenPainter !== 'function') {
          return null;
        }
        oledPainterProbed = true;
        var constructingPainter = true;
        try {
          oledPainter = oledMod.createOledScreenPainter({
            width: OLED_WIDTH,
            height: OLED_HEIGHT,
            doc: doc,
            root: root,
            lazyWallpapers: true,
            preferOffscreenBlur: true,
            targetFps: explicitTargetFps !== null ? explicitTargetFps : undefined,
            motionLevel: explicitMotionLevel !== null ? explicitMotionLevel : undefined,
            paused: isEffectivelyPaused(),
            onAsyncAssetReady: function () {
              if (disposed || contextLost) return;
              lastOledSig = '';
              lastOledDiscreteSig = '';
              lastOledCoreSig = '';
              lastOledUploadMs = -1;
              oledPendingFlush = false;
              if (constructingPainter) return;
              if (isEffectivelyPaused()) {
                pendingRenderWhilePaused = true;
                return;
              }
              if (root && typeof root.requestAnimationFrame === 'function') {
                if (!asyncOledCoalesceRaf) {
                  asyncOledCoalesceRaf = root.requestAnimationFrame(function () {
                    asyncOledCoalesceRaf = 0;
                    if (disposed || contextLost) return;
                    if (isEffectivelyPaused()) {
                      pendingRenderWhilePaused = true;
                      return;
                    }
                    renderFrame();
                    if (
                      !isMotionReduced() &&
                      oledPainter &&
                      typeof oledPainter.isAnimating === 'function' &&
                      oledPainter.isAnimating(animClockMs)
                    ) {
                      idle = false;
                      scheduleAnimLoop();
                    }
                  });
                }
              } else {
                renderFrame();
              }
            },
          });
        } catch (_oledInitErr) {
          oledPainter = null;
        } finally {
          constructingPainter = false;
        }
        return oledPainter;
      }

      var glRes = {
        programs: [],
        shaders: [],
        buffers: [],
        vaos: [],
        textures: [],
        framebuffers: [],
      };
      var glObjs = null;

      if (canvas && typeof canvas.getContext === 'function') {
        try {
          var candGl = canvas.getContext('webgl2', {
            alpha: true,
            antialias: true,
            depth: true,
            stencil: false,
            premultipliedAlpha: true,
            powerPreference: 'high-performance',
          });
          if (candGl && typeof candGl.createProgram === 'function' && typeof candGl.createVertexArray === 'function') {
            gl = candGl;
            rendererMode = 'webgl2';
          }
        } catch (_glErr) {
          gl = null;
        }
        if (!gl) {
          try {
            ctx2d = canvas.getContext('2d');
          } catch (_c2dErr) {
            ctx2d = null;
          }
          rendererMode = 'canvas2d';
        }
      }

      /* Khronos WebGL2 best practice: split compile/link submission from status checks for parallel GPU compilation with zero hot-path IPC stalls */
      function beginLinkProgram(vsSrc, fsSrc) {
        var vs = gl.createShader(gl.VERTEX_SHADER);
        var fs = gl.createShader(gl.FRAGMENT_SHADER);
        var prog = gl.createProgram();
        if (!vs || !fs || !prog) {
          if (vs) gl.deleteShader(vs);
          if (fs) gl.deleteShader(fs);
          if (prog) gl.deleteProgram(prog);
          return null;
        }
        gl.shaderSource(vs, vsSrc);
        gl.compileShader(vs);
        gl.shaderSource(fs, fsSrc);
        gl.compileShader(fs);
        gl.attachShader(prog, vs);
        gl.attachShader(prog, fs);
        gl.linkProgram(prog);
        return { vs: vs, fs: fs, prog: prog };
      }

      function finishLinkProgram(handle) {
        if (!handle || !handle.prog) return null;
        if (!gl.getProgramParameter(handle.prog, gl.LINK_STATUS)) {
          /* Read shader info logs and clean up handles only on the rare link-failure error path */
          if (handle.vs) gl.deleteShader(handle.vs);
          if (handle.fs) gl.deleteShader(handle.fs);
          gl.deleteProgram(handle.prog);
          return null;
        }
        glRes.shaders.push(handle.vs);
        glRes.shaders.push(handle.fs);
        glRes.programs.push(handle.prog);
        return handle.prog;
      }

      function discardPendingProgram(handle) {
        if (!handle) return;
        if (handle.vs) gl.deleteShader(handle.vs);
        if (handle.fs) gl.deleteShader(handle.fs);
        if (handle.prog) gl.deleteProgram(handle.prog);
      }

      function createGlBuffer(target, data, usage) {
        var buf = gl.createBuffer();
        gl.bindBuffer(target, buf);
        gl.bufferData(target, data, usage || gl.STATIC_DRAW);
        glRes.buffers.push(buf);
        return buf;
      }

      function initShadowMapResources(targetSize, deferLink) {
        if (
          !gl ||
          typeof gl.createFramebuffer !== 'function' ||
          typeof gl.bindFramebuffer !== 'function' ||
          typeof gl.framebufferTexture2D !== 'function' ||
          typeof gl.checkFramebufferStatus !== 'function'
        ) {
          return null;
        }

        var shadowSize = targetSize === SHADOW_MAP_SIZE_REDUCED ? SHADOW_MAP_SIZE_REDUCED : SHADOW_MAP_SIZE_ULTRA;
        var fbConst = gl.FRAMEBUFFER || 0x8d40;
        var depthAttachConst = gl.DEPTH_ATTACHMENT || 0x8d00;
        var fbCompleteConst = gl.FRAMEBUFFER_COMPLETE || 0x8cd5;
        var depthCompConst = gl.DEPTH_COMPONENT || 0x1902;
        var nearestConst = gl.NEAREST || 0x2600;
        var noneConst = gl.NONE !== undefined ? gl.NONE : 0;

        var fbo = gl.createFramebuffer();
        var tex = gl.createTexture();
        if (!fbo || !tex) {
          if (fbo && typeof gl.deleteFramebuffer === 'function') gl.deleteFramebuffer(fbo);
          if (tex) gl.deleteTexture(tex);
          return null;
        }

        gl.bindTexture(gl.TEXTURE_2D, tex);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, nearestConst);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, nearestConst);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

        var candidates = [
          { internalFmt: gl.DEPTH_COMPONENT24 || 0x81a6, type: gl.UNSIGNED_INT || 0x1405 },
          { internalFmt: gl.DEPTH_COMPONENT16 || 0x81a5, type: gl.UNSIGNED_SHORT },
        ];

        var complete = false;
        var chosenCand = candidates[0];
        gl.bindFramebuffer(fbConst, fbo);
        for (var ci = 0; ci < candidates.length; ci++) {
          try {
            gl.texImage2D(
              gl.TEXTURE_2D, 0, candidates[ci].internalFmt,
              shadowSize, shadowSize, 0,
              depthCompConst, candidates[ci].type, null
            );
            gl.framebufferTexture2D(fbConst, depthAttachConst, gl.TEXTURE_2D, tex, 0);
            if (typeof gl.drawBuffers === 'function') gl.drawBuffers([noneConst]);
            if (typeof gl.readBuffer === 'function') gl.readBuffer(noneConst);
            if (gl.checkFramebufferStatus(fbConst) === fbCompleteConst) {
              complete = true;
              chosenCand = candidates[ci];
              break;
            }
          } catch (_fboErr) {
            complete = false;
          }
        }
        gl.bindFramebuffer(fbConst, null);
        gl.bindTexture(gl.TEXTURE_2D, null);

        if (!complete) {
          if (typeof gl.deleteFramebuffer === 'function') gl.deleteFramebuffer(fbo);
          gl.deleteTexture(tex);
          return null;
        }

        /* When deferLink is true, submit compile/link asynchronously and check status together with main PBR programs after uploads */
        var hShadowSolid = beginLinkProgram(SHADOW_SOLID_VS, SHADOW_EMPTY_FS);
        var hShadowKeycap = beginLinkProgram(SHADOW_KEYCAP_VS, SHADOW_EMPTY_FS);
        if (!hShadowSolid || !hShadowKeycap) {
          discardPendingProgram(hShadowSolid);
          discardPendingProgram(hShadowKeycap);
          if (typeof gl.deleteFramebuffer === 'function') gl.deleteFramebuffer(fbo);
          gl.deleteTexture(tex);
          return null;
        }

        var shadowObj = {
          fbo: fbo,
          tex: tex,
          size: shadowSize,
          fbConst: fbConst,
          depthAttachConst: depthAttachConst,
          fbCompleteConst: fbCompleteConst,
          depthCompConst: depthCompConst,
          nearestConst: nearestConst,
          noneConst: noneConst,
          internalFmt: chosenCand.internalFmt,
          type: chosenCand.type,
          _pendingSolid: hShadowSolid,
          _pendingKeycap: hShadowKeycap,
          progSolid: null,
          progKeycap: null,
          uSolid: null,
          uKeycap: null,
        };

        if (!deferLink) {
          return finalizeShadowMapPrograms(shadowObj);
        }
        return shadowObj;
      }

      function finalizeShadowMapPrograms(shadowObj) {
        if (!shadowObj) return null;
        var progShadowSolid = finishLinkProgram(shadowObj._pendingSolid);
        var progShadowKeycap = finishLinkProgram(shadowObj._pendingKeycap);
        shadowObj._pendingSolid = null;
        shadowObj._pendingKeycap = null;
        if (!progShadowSolid || !progShadowKeycap) {
          if (typeof gl.deleteFramebuffer === 'function') gl.deleteFramebuffer(shadowObj.fbo);
          gl.deleteTexture(shadowObj.tex);
          return null;
        }
        glRes.framebuffers.push(shadowObj.fbo);
        glRes.textures.push(shadowObj.tex);
        activeShadowMapSize = shadowObj.size;
        shadowObj.progSolid = progShadowSolid;
        shadowObj.progKeycap = progShadowKeycap;
        shadowObj.uSolid = {
          lightViewProj: gl.getUniformLocation(progShadowSolid, 'u_lightViewProj'),
          model: gl.getUniformLocation(progShadowSolid, 'u_model'),
        };
        shadowObj.uKeycap = {
          lightViewProj: gl.getUniformLocation(progShadowKeycap, 'u_lightViewProj'),
          chassisMat: gl.getUniformLocation(progShadowKeycap, 'u_chassisMat'),
          auxChassisMat: gl.getUniformLocation(progShadowKeycap, 'u_auxChassisMat'),
        };
        return shadowObj;
      }

      /* Rebuild shadow FBO depth texture only when motionLevel crosses resolution tier (ultra 2048 <-> others 1024) */
      function ensureShadowMapSize(desiredSize) {
        var nextSize = desiredSize === SHADOW_MAP_SIZE_REDUCED ? SHADOW_MAP_SIZE_REDUCED : SHADOW_MAP_SIZE_ULTRA;
        activeShadowMapSize = nextSize;
        if (!gl || !glObjs || !glObjs.shadowPass || contextLost) {
          return;
        }
        var shPass = glObjs.shadowPass;
        if (shPass.size === nextSize) {
          return;
        }
        var rebuilt = false;
        try {
          gl.activeTexture(gl.TEXTURE0 + 1);
          gl.bindTexture(gl.TEXTURE_2D, null);
          gl.bindTexture(gl.TEXTURE_2D, shPass.tex);
          gl.texImage2D(
            gl.TEXTURE_2D, 0, shPass.internalFmt,
            nextSize, nextSize, 0,
            shPass.depthCompConst, shPass.type, null
          );
          gl.bindFramebuffer(shPass.fbConst, shPass.fbo);
          gl.framebufferTexture2D(shPass.fbConst, shPass.depthAttachConst, gl.TEXTURE_2D, shPass.tex, 0);
          if (typeof gl.drawBuffers === 'function') gl.drawBuffers([shPass.noneConst]);
          if (typeof gl.readBuffer === 'function') gl.readBuffer(shPass.noneConst);
          if (gl.checkFramebufferStatus(shPass.fbConst) === shPass.fbCompleteConst) {
            rebuilt = true;
          }
          gl.bindFramebuffer(shPass.fbConst, null);
          gl.bindTexture(gl.TEXTURE_2D, null);
        } catch (_resizeShErr) {
          rebuilt = false;
        }

        if (!rebuilt) {
          try {
            var freshTex = gl.createTexture();
            if (freshTex) {
              gl.bindTexture(gl.TEXTURE_2D, freshTex);
              gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, shPass.nearestConst);
              gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, shPass.nearestConst);
              gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
              gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
              gl.texImage2D(
                gl.TEXTURE_2D, 0, shPass.internalFmt,
                nextSize, nextSize, 0,
                shPass.depthCompConst, shPass.type, null
              );
              gl.bindFramebuffer(shPass.fbConst, shPass.fbo);
              gl.framebufferTexture2D(shPass.fbConst, shPass.depthAttachConst, gl.TEXTURE_2D, freshTex, 0);
              if (gl.checkFramebufferStatus(shPass.fbConst) === shPass.fbCompleteConst) {
                var oldTex = shPass.tex;
                shPass.tex = freshTex;
                var oldIdx = glRes.textures.indexOf(oldTex);
                if (oldIdx >= 0) glRes.textures[oldIdx] = freshTex;
                else glRes.textures.push(freshTex);
                if (oldTex) gl.deleteTexture(oldTex);
                rebuilt = true;
              } else {
                gl.deleteTexture(freshTex);
              }
              gl.bindFramebuffer(shPass.fbConst, null);
              gl.bindTexture(gl.TEXTURE_2D, null);
            }
          } catch (_rebuildShErr) {
            rebuilt = false;
          }
        }

        if (rebuilt) {
          shPass.size = nextSize;
          shadowDirty = true;
          lastShadowGeomSig = '';
        }
      }

      function initWebGLPipeline() {
        if (!gl) return false;
        /* Phase 1: submit all 5 shader programs (3 main PBR + 2 shadow passes) upfront for parallel GPU compilation overlapping CPU uploads */
        var hSolid = beginLinkProgram(SOLID_VS, SOLID_FS);
        var hKeycap = beginLinkProgram(KEYCAP_VS, KEYCAP_FS);
        var hScreen = beginLinkProgram(SCREEN_VS, SCREEN_FS);
        if (!hSolid || !hKeycap || !hScreen) {
          discardPendingProgram(hSolid);
          discardPendingProgram(hKeycap);
          discardPendingProgram(hScreen);
          return false;
        }
        /* Create 1024x1024 soft shadow FBO early with deferred link check so all 5 programs compile in parallel without stalls */
        var pendingShadowPass = initShadowMapResources(resolveTargetShadowMapSize(), true);

        /* 1. Sculpted keycap VAO + batched (90 main + 6 aux) instance buffer (32 floats = 128 bytes/instance, zero extra VAOs) */
        var capGeom = buildSculptedKeycapGeometry();
        var capVao = gl.createVertexArray();
        glRes.vaos.push(capVao);
        gl.bindVertexArray(capVao);

        var capPosBuf = createGlBuffer(gl.ARRAY_BUFFER, capGeom.positions, gl.STATIC_DRAW);
        gl.enableVertexAttribArray(0);
        gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 0, 0);

        var capNormBuf = createGlBuffer(gl.ARRAY_BUFFER, capGeom.normals, gl.STATIC_DRAW);
        gl.enableVertexAttribArray(1);
        gl.vertexAttribPointer(1, 3, gl.FLOAT, false, 0, 0);

        var capUvBuf = createGlBuffer(gl.ARRAY_BUFFER, capGeom.uvs, gl.STATIC_DRAW);
        gl.enableVertexAttribArray(2);
        gl.vertexAttribPointer(2, 2, gl.FLOAT, false, 0, 0);

        var capPartBuf = createGlBuffer(gl.ARRAY_BUFFER, capGeom.partFlags, gl.STATIC_DRAW);
        gl.enableVertexAttribArray(3);
        gl.vertexAttribPointer(3, 1, gl.FLOAT, false, 0, 0);

        var capIdxBuf = createGlBuffer(gl.ELEMENT_ARRAY_BUFFER, capGeom.indices, gl.STATIC_DRAW);

        var instanceFloats = new Float32Array(totalInstanceCapacity * 32);
        var instanceBuf = createGlBuffer(gl.ARRAY_BUFFER, instanceFloats, gl.DYNAMIC_DRAW);
        gl.bindBuffer(gl.ARRAY_BUFFER, instanceBuf);
        var instStride = 32 * 4;
        for (var attr = 0; attr < 8; attr++) {
          var loc = 4 + attr;
          gl.enableVertexAttribArray(loc);
          gl.vertexAttribPointer(loc, 4, gl.FLOAT, false, instStride, attr * 16);
          gl.vertexAttribDivisor(loc, 1);
        }
        gl.bindVertexArray(null);
        void capPosBuf; void capNormBuf; void capUvBuf; void capPartBuf; void capIdxBuf;

        /* 2. Static chassis VAO & dynamic widgets/switch/crystal VAO */
        function createSolidVao(usage) {
          var vao = gl.createVertexArray();
          glRes.vaos.push(vao);
          gl.bindVertexArray(vao);
          var bPos = createGlBuffer(gl.ARRAY_BUFFER, new Float32Array(12), usage);
          gl.enableVertexAttribArray(0);
          gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 0, 0);
          var bNorm = createGlBuffer(gl.ARRAY_BUFFER, new Float32Array(12), usage);
          gl.enableVertexAttribArray(1);
          gl.vertexAttribPointer(1, 3, gl.FLOAT, false, 0, 0);
          var bCol = createGlBuffer(gl.ARRAY_BUFFER, new Float32Array(12), usage);
          gl.enableVertexAttribArray(2);
          gl.vertexAttribPointer(2, 3, gl.FLOAT, false, 0, 0);
          var bParam = createGlBuffer(gl.ARRAY_BUFFER, new Float32Array(16), usage);
          gl.enableVertexAttribArray(3);
          gl.vertexAttribPointer(3, 4, gl.FLOAT, false, 0, 0);
          var bUv = createGlBuffer(gl.ARRAY_BUFFER, new Float32Array(8), usage);
          gl.enableVertexAttribArray(4);
          gl.vertexAttribPointer(4, 2, gl.FLOAT, false, 0, 0);
          var bIdx = createGlBuffer(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(6), usage);
          gl.bindVertexArray(null);
          return { vao: vao, bPos: bPos, bNorm: bNorm, bCol: bCol, bParam: bParam, bUv: bUv, bIdx: bIdx, count: 0 };
        }

        var chassisGpu = createSolidVao(gl.STATIC_DRAW);
        var widgetsGpu = createSolidVao(gl.DYNAMIC_DRAW);

        /* 3. Integrated narrow-lip AR-coated dark/light OLED glass screen VAO */
        var scrVao = gl.createVertexArray();
        glRes.vaos.push(scrVao);
        gl.bindVertexArray(scrVao);
        var scrVerts = new Float32Array([
          DECK_X_MIN, DECK_GLASS_Y, DECK_Z_MAX,
          DECK_X_MAX, DECK_GLASS_Y, DECK_Z_MAX,
          DECK_X_MAX, DECK_GLASS_Y, DECK_Z_MIN,
          DECK_X_MIN, DECK_GLASS_Y, DECK_Z_MIN,
        ]);
        var scrUvs = new Float32Array([0, 1, 1, 1, 1, 0, 0, 0]);
        var scrIdx = new Uint16Array([0, 1, 2, 0, 2, 3]);
        createGlBuffer(gl.ARRAY_BUFFER, scrVerts, gl.STATIC_DRAW);
        gl.enableVertexAttribArray(0);
        gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 0, 0);
        createGlBuffer(gl.ARRAY_BUFFER, scrUvs, gl.STATIC_DRAW);
        gl.enableVertexAttribArray(1);
        gl.vertexAttribPointer(1, 2, gl.FLOAT, false, 0, 0);
        createGlBuffer(gl.ELEMENT_ARRAY_BUFFER, scrIdx, gl.STATIC_DRAW);
        gl.bindVertexArray(null);

        /* 4. Legend atlas texture for 90 main keys + row-9 6 aux slots (#1/5) */
        var anisoExt =
          gl.getExtension('EXT_texture_filter_anisotropic') ||
          gl.getExtension('WEBKIT_EXT_texture_filter_anisotropic');
        var maxAniso = anisoExt ? Math.min(8, gl.getParameter(anisoExt.MAX_TEXTURE_MAX_ANISOTROPY_EXT) || 1) : 1;

        var atlasTex = gl.createTexture();
        glRes.textures.push(atlasTex);
        gl.bindTexture(gl.TEXTURE_2D, atlasTex);
        atlasSurf = renderLegendAtlasCanvas(doc, slots, grainAssets, state.auxModels, 'shared');
        lastAuxAtlasSig = computeAuxListSigQuick(state.auxModels);
        if (atlasSurf && atlasSurf.canvas) {
          gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
          gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, atlasSurf.canvas);
          gl.generateMipmap(gl.TEXTURE_2D);
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
          if (anisoExt && maxAniso > 1) {
            gl.texParameterf(gl.TEXTURE_2D, anisoExt.TEXTURE_MAX_ANISOTROPY_EXT, maxAniso);
          }
        } else {
          gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([255, 0, 255, 255]));
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        }
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

        /* 5. Tileable 128x128 RG8 micro-grain heightfield texture (#2/5) */
        var grainTex = gl.createTexture();
        glRes.textures.push(grainTex);
        gl.bindTexture(gl.TEXTURE_2D, grainTex);
        var rg8Internal = gl.RG8 || 0x822b;
        var rgFormat = gl.RG || 0x8227;
        var repeatWrap = gl.REPEAT || 0x2901;
        var unpackAlign = gl.UNPACK_ALIGNMENT || 0x0cf5;
        gl.pixelStorei(unpackAlign, 1);
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
        gl.texImage2D(
          gl.TEXTURE_2D, 0, rg8Internal,
          grainAssets.size, grainAssets.size, 0,
          rgFormat, gl.UNSIGNED_BYTE, grainAssets.combinedRG
        );
        gl.pixelStorei(unpackAlign, 4);
        gl.generateMipmap(gl.TEXTURE_2D);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, repeatWrap);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, repeatWrap);
        if (anisoExt && maxAniso > 1) {
          gl.texParameterf(gl.TEXTURE_2D, anisoExt.TEXTURE_MAX_ANISOTROPY_EXT, maxAniso);
        }

        /* 6. 128x64 RGB8 studio metal reflection envmap texture (#3/5) */
        var metalEnvTex = gl.createTexture();
        glRes.textures.push(metalEnvTex);
        gl.bindTexture(gl.TEXTURE_2D, metalEnvTex);
        var rgb8Internal = gl.RGB8 || 0x8051;
        var rgbFormat = gl.RGB || 0x1907;
        gl.pixelStorei(unpackAlign, 1);
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
        gl.texImage2D(
          gl.TEXTURE_2D, 0, rgb8Internal,
          grainAssets.envW || 128, grainAssets.envH || 64, 0,
          rgbFormat, gl.UNSIGNED_BYTE, grainAssets.metalEnvRGB
        );
        gl.pixelStorei(unpackAlign, 4);
        gl.generateMipmap(gl.TEXTURE_2D);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, repeatWrap);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

        /* 7. Dynamic dark/light OLED screen texture (#4/5) */
        var oledTex = gl.createTexture();
        glRes.textures.push(oledTex);
        gl.bindTexture(gl.TEXTURE_2D, oledTex);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([7, 10, 17, 255]));
        oledTexAllocated = false;
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        if (anisoExt && maxAniso > 1) {
          gl.texParameterf(gl.TEXTURE_2D, anisoExt.TEXTURE_MAX_ANISOTROPY_EXT, Math.min(4, maxAniso));
        }

        /* 8. Phase 2: validate LINK_STATUS across all 5 programs once geometry, textures & shadow FBO are ready */
        var progSolid = finishLinkProgram(hSolid);
        var progKeycap = finishLinkProgram(hKeycap);
        var progScreen = finishLinkProgram(hScreen);
        var shadowPass = finalizeShadowMapPrograms(pendingShadowPass);
        if (!progSolid || !progKeycap || !progScreen) {
          return false;
        }
        shadowDirty = true;
        lastShadowGeomSig = '';
        lastShadowDrawClockMs = -1000;
        lastDynMeshSig = '';
        keycapInstanceDirty = true;

        glObjs = {
          progSolid: progSolid,
          progKeycap: progKeycap,
          progScreen: progScreen,
          shadowPass: shadowPass,
          uSolid: {
            viewProj: gl.getUniformLocation(progSolid, 'u_viewProj'),
            model: gl.getUniformLocation(progSolid, 'u_model'),
            camPos: gl.getUniformLocation(progSolid, 'u_camPos'),
            lightDir: gl.getUniformLocation(progSolid, 'u_lightDir'),
            rimTint: gl.getUniformLocation(progSolid, 'u_rimTint'),
            envParams: gl.getUniformLocation(progSolid, 'u_envParams'),
            liftCapShadow: gl.getUniformLocation(progSolid, 'u_liftCapShadow'),
            switchLightPos: gl.getUniformLocation(progSolid, 'u_switchLightPos'),
            switchLightColor: gl.getUniformLocation(progSolid, 'u_switchLightColor'),
            prismFocusPos: gl.getUniformLocation(progSolid, 'u_prismFocusPos'),
            prismConfig: gl.getUniformLocation(progSolid, 'u_prismConfig'),
            lightViewProj: gl.getUniformLocation(progSolid, 'u_lightViewProj'),
            shadowTex: gl.getUniformLocation(progSolid, 'u_shadowTex'),
            grainTex: gl.getUniformLocation(progSolid, 'u_grainTex'),
            metalEnvTex: gl.getUniformLocation(progSolid, 'u_metalEnvTex'),
          },
          uKeycap: {
            viewProj: gl.getUniformLocation(progKeycap, 'u_viewProj'),
            chassisMat: gl.getUniformLocation(progKeycap, 'u_chassisMat'),
            auxChassisMat: gl.getUniformLocation(progKeycap, 'u_auxChassisMat'),
            atlasTex: gl.getUniformLocation(progKeycap, 'u_atlasTex'),
            shadowTex: gl.getUniformLocation(progKeycap, 'u_shadowTex'),
            grainTex: gl.getUniformLocation(progKeycap, 'u_grainTex'),
            metalEnvTex: gl.getUniformLocation(progKeycap, 'u_metalEnvTex'),
            lightViewProj: gl.getUniformLocation(progKeycap, 'u_lightViewProj'),
            camPos: gl.getUniformLocation(progKeycap, 'u_camPos'),
            lightDir: gl.getUniformLocation(progKeycap, 'u_lightDir'),
            rimTint: gl.getUniformLocation(progKeycap, 'u_rimTint'),
            envParams: gl.getUniformLocation(progKeycap, 'u_envParams'),
            switchLightPos: gl.getUniformLocation(progKeycap, 'u_switchLightPos'),
            switchLightColor: gl.getUniformLocation(progKeycap, 'u_switchLightColor'),
            liftCapShadow: gl.getUniformLocation(progKeycap, 'u_liftCapShadow'),
            prismConfig: gl.getUniformLocation(progKeycap, 'u_prismConfig'),
          },
          uScreen: {
            viewProj: gl.getUniformLocation(progScreen, 'u_viewProj'),
            model: gl.getUniformLocation(progScreen, 'u_model'),
            oledTex: gl.getUniformLocation(progScreen, 'u_oledTex'),
            shadowTex: gl.getUniformLocation(progScreen, 'u_shadowTex'),
            lightViewProj: gl.getUniformLocation(progScreen, 'u_lightViewProj'),
            camPos: gl.getUniformLocation(progScreen, 'u_camPos'),
            lightDir: gl.getUniformLocation(progScreen, 'u_lightDir'),
            glassTint: gl.getUniformLocation(progScreen, 'u_glassTint'),
            envParams: gl.getUniformLocation(progScreen, 'u_envParams'),
            prismFocusPos: gl.getUniformLocation(progScreen, 'u_prismFocusPos'),
            prismConfig: gl.getUniformLocation(progScreen, 'u_prismConfig'),
            screenOptics: gl.getUniformLocation(progScreen, 'u_screenOptics'),
            screenElemRgb: gl.getUniformLocation(progScreen, 'u_screenElemRgb'),
            screenAvail: gl.getUniformLocation(progScreen, 'u_screenAvail'),
          },
          capVao: capVao,
          capIndexCount: capGeom.indexCount,
          capOuterIndexCount: capGeom.outerIndexCount !== undefined ? capGeom.outerIndexCount : capGeom.indexCount,
          capCavityIndexCount: capGeom.cavityIndexCount || 0,
          instanceFloats: instanceFloats,
          instanceBuf: instanceBuf,
          chassisGpu: chassisGpu,
          widgetsGpu: widgetsGpu,
          scrVao: scrVao,
          atlasTex: atlasTex,
          grainTex: grainTex,
          metalEnvTex: metalEnvTex,
          oledTex: oledTex,
        };
        return true;
      }

      if (gl && !initWebGLPipeline()) {
        gl = null;
        rendererMode = 'canvas2d';
        if (canvas && typeof canvas.getContext === 'function') {
          try {
            ctx2d = canvas.getContext('2d');
          } catch (_e2) {
            ctx2d = null;
          }
        }
      }

      /* Symmetric WebGL context-lost guard */
      function onWebglContextLost(ev) {
        if (ev && typeof ev.preventDefault === 'function') ev.preventDefault();
        contextLost = true;
        cancelAnimLoop();
      }
      function onWebglContextRestored() {
        if (disposed || !gl) return;
        contextLost = false;
        lastOledSig = '';
        lastOledDiscreteSig = '';
        lastOledCoreSig = '';
        lastOledUploadMs = -1;
        oledPendingFlush = false;
        oledCoreTransitionStep = false;
        lastAuxAtlasSig = '';
        lastChassisThemeId = '';
        lastShadowGeomSig = '';
        lastDynMeshSig = '';
        shadowDirty = true;
        keycapInstanceDirty = true;
        oledTexAllocated = false;
        glRes = { programs: [], shaders: [], buffers: [], vaos: [], textures: [], framebuffers: [] };
        if (initWebGLPipeline()) {
          if (isEffectivelyPaused()) {
            pendingRenderWhilePaused = true;
          } else {
            renderFrame();
          }
        }
      }
      if (gl && canvas && typeof canvas.addEventListener === 'function') {
        canvas.addEventListener('webglcontextlost', onWebglContextLost, false);
        canvas.addEventListener('webglcontextrestored', onWebglContextRestored, false);
      }

      /* ============================================================================
       * 9. Theme Dispersion Derivation, 3D Trackball Orbit, Antigravity Gyro & Spring Physics Step
       * ============================================================================ */
      function getPalette() {
        var tp = state.themeProfile || {};
        var id = tp.id && THEME_PALETTES[tp.id]
          ? tp.id
          : tp.isLight
            ? 'crystal-light'
            : 'obsidian-dark';
        var base = THEME_PALETTES[id];
        return Object.assign({ id: id, isLight: Boolean(tp.isLight) }, base);
      }

      function resolveRimToneKey(palette) {
        var tp = state.themeProfile || {};
        if (tp.isMono || tp.rimTone === 'mono') return 'mono';
        var raw = typeof tp.rimTone === 'string' ? tp.rimTone.trim().toLowerCase() : '';
        if (raw && RIM_TONE_TO_INDEX[raw] !== undefined) return raw;
        return (palette && palette.defaultRimTone) || 'default';
      }

      function resolveRimToneIndex(palette) {
        var key = resolveRimToneKey(palette);
        return RIM_TONE_TO_INDEX[key] !== undefined ? RIM_TONE_TO_INDEX[key] : 0;
      }

      function isSlotAvailable(z) {
        var av = state.availableByZ;
        if (!av) return false;
        if (typeof av.has === 'function') return av.has(z);
        if (typeof av === 'object') return Boolean(av[z]);
        return false;
      }

      function resolveSlotHeroChroma(slotIndex, zVal, rawZ) {
        if (isSlotConfirmSlamming(zVal, rawZ)) return 1.0;
        var isSel = state.selectedZ === zVal || state.selectedZ === rawZ;
        if (state.reducedMotion) return isSel ? 1.0 : 0.0;
        var liftVal = slotIndex >= 0 && slotIndex < slotCount ? keyLiftCur[slotIndex] : (isSel ? 1.0 : 0.0);
        return clamp(liftVal, 0.0, 1.0);
      }

      /**
       * V14 translucent frosted gemstone keycaps (4 available elements) x clear levitated optical glass cap x GMK blind key palette resolver:
       * - 3 unselected available element keys (heroChromaT = 0.0): display translucent frosted gemstone tones (1H azure / 6C cobalt / 10Ne coral / 18Ar indigo);
       * - Single active levitated key (heroChromaT > 0.0): smoothly transitions into clear smoked (Dark) or iced (Light) frosted optical glass revealing the crystal stem below
       */
      function resolveKeyColors(slot, palette, isAvail, heroChromaOpt) {
        var tp = state.themeProfile || {};
        if (isAvail) {
          var chromaT = heroChromaOpt === undefined ? 1.0 : clamp(Number(heroChromaOpt) || 0.0, 0.0, 1.0);
          if (tp.isMono) {
            var monoRestCapHex = palette.availRestCap || (palette.isLight ? '#191E28' : '#EEF2F8');
            var monoRestLegHex = palette.availRestLegend || (palette.isLight ? '#F8FAFC' : '#0F141D');
            var monoRestCap = hexToRgb01(monoRestCapHex);
            var monoRestLeg = hexToRgb01(monoRestLegHex);
            var monoHeroCap = palette.isLight ? [0.945, 0.957, 0.976] : [0.118, 0.137, 0.176];
            var monoHeroLeg = palette.isLight ? [0.075, 0.094, 0.133] : [0.973, 0.980, 0.992];
            var mCap = mixRgb(monoRestCap, monoHeroCap, chromaT);
            var mLeg = mixRgb(monoRestLeg, monoHeroLeg, chromaT);
            return {
              capRgb: mCap,
              legendRgb: mLeg,
              cap: rgb01ToCss(mCap),
              legend: rgb01ToCss(mLeg),
              stem: palette.isLight ? '#334155' : '#CBD5E1',
              stemTop: palette.isLight ? '#64748B' : '#F1F5F9',
              led: palette.isLight ? '#94A3B8' : '#E2E8F0',
            };
          }

          var art = ARTISAN_BY_Z[slot.z] || GROUP_ARTISAN_FALLBACK[slot.group] || ARTISAN_BY_Z[6];
          var restCapHex = palette.isLight
            ? (art.restLightCap || palette.availRestCap || '#DBEAFE')
            : (art.restDarkCap || art.cap);
          var restLegHex = palette.isLight
            ? (art.restLightLegend || palette.availRestLegend || '#0F172A')
            : (art.restDarkLegend || art.legend || '#FAFCFF');
          var heroCapHex = palette.isLight ? (art.lightHeroCap || restCapHex) : art.cap;
          var heroLegHex = palette.isLight ? (art.lightHeroLegend || restLegHex) : art.legend;
          var stemTopHex = art.stemTop || art.led;

          var restCapRgb = hexToRgb01(restCapHex);
          var restLegRgb = hexToRgb01(restLegHex);
          var heroCapRgb = hexToRgb01(heroCapHex);
          var heroLegRgb = hexToRgb01(heroLegHex);

          if (chromaT >= 0.999) {
            return {
              capRgb: heroCapRgb,
              legendRgb: heroLegRgb,
              cap: heroCapHex,
              legend: heroLegHex,
              stem: art.stem,
              stemTop: stemTopHex,
              led: art.led,
            };
          }
          if (chromaT <= 0.001) {
            return {
              capRgb: restCapRgb,
              legendRgb: restLegRgb,
              cap: restCapHex,
              legend: restLegHex,
              stem: art.stem,
              stemTop: stemTopHex,
              led: art.led,
            };
          }
          var curCapRgb = mixRgb(restCapRgb, heroCapRgb, chromaT);
          var curLegRgb = mixRgb(restLegRgb, heroLegRgb, chromaT);
          return {
            capRgb: curCapRgb,
            legendRgb: curLegRgb,
            cap: rgb01ToCss(curCapRgb),
            legend: rgb01ToCss(curLegRgb),
            stem: art.stem,
            stemTop: stemTopHex,
            led: art.led,
          };
        }

        var colNum = Number(slot && slot.col) || 0;
        var rowNum = Number(slot && slot.row) || 0;
        var isDBlock = colNum >= 3 && colNum <= 12 && rowNum >= 4 && rowNum <= 7;
        var sCapHex = isDBlock
          ? (palette.stealthAlphaCap || palette.stealthCap)
          : (palette.stealthModCap || palette.stealthCap);
        var sLegHex = isDBlock
          ? (palette.stealthAlphaLegend || palette.stealthLegend)
          : (palette.stealthModLegend || palette.stealthLegend);
        return {
          capRgb: hexToRgb01(sCapHex),
          legendRgb: hexToRgb01(sLegHex),
          cap: sCapHex,
          legend: sLegHex,
          stem: '#5C6676',
          led: '#5C6676',
        };
      }

      function resolveDeckEffortEnergy(di) {
        if (!di) return 0.68;
        if (di.dragEffortProgress !== undefined && di.dragEffortProgress !== null && Number.isFinite(Number(di.dragEffortProgress))) {
          return clamp(0.25 + 0.75 * clamp(Number(di.dragEffortProgress), 0.0, 1.0), 0.25, 1.0);
        }
        var tier = resolveEffortTier(di);
        var tierEnergies = [0.28, 0.54, 0.80, 1.0];
        return tierEnergies[tier] || 0.68;
      }

      /**
       * Resolves effortTier (0..3, default 1) from state.deckInfo activeEffort or active level ('low'|'medium'|'high'|'extra'/'xhigh')
       */
      function resolveEffortTier(di) {
        if (!di || typeof di !== 'object') return effortTierCur;
        if (
          (di.isAvailable === false || di.orchUnsupported || di.blindFlash) &&
          (!Array.isArray(di.levels) || di.levels.length === 0)
        ) {
          return effortTierCur;
        }
        var candKey = '';
        if (typeof di.activeEffort === 'string' && di.activeEffort.trim()) {
          candKey = di.activeEffort.trim().toLowerCase();
        }
        var levels = Array.isArray(di.levels) ? di.levels : [];
        var activeIdx = -1;
        for (var i = 0; i < levels.length; i++) {
          if (levels[i] && levels[i].active) {
            activeIdx = i;
            if (!candKey) {
              candKey = String(levels[i].effort || levels[i].label || '').trim().toLowerCase();
            }
            break;
          }
        }
        if (candKey) {
          if (candKey.indexOf('extra') >= 0 || candKey.indexOf('xhigh') >= 0 || candKey === 'max' || candKey === 'ultra') {
            return 3;
          }
          if (candKey.indexOf('low') >= 0 || candKey === 'minimal' || candKey === 'lite') {
            return 0;
          }
          if (candKey.indexOf('med') >= 0 || candKey === 'balanced' || candKey === 'normal') {
            return 1;
          }
          if (candKey.indexOf('high') >= 0) {
            return 2;
          }
        }
        if (activeIdx >= 0 && levels.length > 0) {
          if (levels.length === 1) return 1;
          if (levels.length === 2) return activeIdx === 0 ? 1 : 2;
          if (levels.length === 3) return clamp(activeIdx, 0, 2);
          return clamp(Math.round((activeIdx / (levels.length - 1)) * 3), 0, 3);
        }
        return 1;
      }

      function resolveBlendedKeyColors(slotIdx, slot, palette, heroChromaOpt) {
        var zVal = slot.slotZ !== undefined ? slot.slotZ : slot.z;
        var rawAvail = isSlotAvailable(zVal) || isSlotAvailable(slot.z);
        var availT = (slotIdx >= 0 && slotIdx < slotCount)
          ? clamp(slotAvailCur[slotIdx], 0.0, 1.0)
          : (rawAvail ? 1.0 : 0.0);
        if (availT <= 0.0005) {
          var blindOnly = resolveKeyColors(slot, palette, false, 0.0);
          blindOnly.availMix = 0.0;
          return blindOnly;
        }
        if (availT >= 0.9995) {
          var availOnly = resolveKeyColors(slot, palette, true, heroChromaOpt);
          availOnly.availMix = 1.0;
          return availOnly;
        }
        var blindKc = resolveKeyColors(slot, palette, false, 0.0);
        var availKc = resolveKeyColors(slot, palette, true, heroChromaOpt);
        var mixCap = mixRgb(blindKc.capRgb, availKc.capRgb, availT);
        var mixLeg = mixRgb(blindKc.legendRgb, availKc.legendRgb, availT);
        return {
          capRgb: mixCap,
          legendRgb: mixLeg,
          cap: rgb01ToCss(mixCap),
          legend: rgb01ToCss(mixLeg),
          stem: availKc.stem,
          led: availKc.led,
          availMix: availT,
        };
      }

      function resolveAuxSlotHeroChroma(auxIdx) {
        if (auxIdx === 0 && state.orchLatched) return clamp(orchLatchCur, 0.0, 1.0);
        if (isAuxSlotConfirmSlamming(auxIdx)) return 1.0;
        var isSel = state.selectedAuxIndex === auxIdx && !(auxIdx === 0 && state.orchLatched);
        if (state.reducedMotion) return isSel ? 1.0 : 0.0;
        var liftVal = auxIdx >= 0 && auxIdx < AUX_SLOT_COUNT ? auxKeyLiftCur[auxIdx] : (isSel ? 1.0 : 0.0);
        return clamp(liftVal, 0.0, 1.0);
      }

      /**
       * V12 right-side 2x3 aux pad keycap material palette resolver:
       * - #0 Orchestrator: subdued violet-titanium at rest; lights up with royal violet-gold anodized sheen when latched (orchLatchCur -> 1);
       * - #1..#5 model keys: smoothly dim toward low-contrast matte blind keys via auxAvailCur (0..1) when unavailable and relight when available.
       */
      function resolveAuxKeyColors(auxSlot, auxIdx, palette, heroChromaOpt) {
        var tp = state.themeProfile || {};
        var rawAvail = Boolean(auxSlot && auxSlot.available);
        var availT = (auxIdx >= 0 && auxIdx < AUX_SLOT_COUNT)
          ? clamp(auxAvailCur[auxIdx], 0.0, 1.0)
          : (rawAvail ? 1.0 : 0.0);

        var blindCapHex = palette.stealthModCap || palette.stealthCap;
        var blindLegHex = palette.stealthModLegend || palette.stealthLegend;
        var blindCapRgb = hexToRgb01(blindCapHex);
        var blindLegRgb = hexToRgb01(blindLegHex);

        if (availT <= 0.0005) {
          return {
            capRgb: blindCapRgb,
            legendRgb: blindLegRgb,
            cap: blindCapHex,
            legend: blindLegHex,
            stem: '#5C6676',
            led: '#5C6676',
            secondaryRgb: [0.40, 0.45, 0.52],
            availMix: 0.0,
          };
        }

        var chromaT = heroChromaOpt === undefined ? 1.0 : clamp(Number(heroChromaOpt) || 0.0, 0.0, 1.0);
        var isOrch = auxIdx === 0 || /orch/i.test(String((auxSlot && auxSlot.id) || '') + ' ' + String((auxSlot && auxSlot.shortLabel) || ''));
        var latchT = (auxIdx === 0) ? clamp(orchLatchCur, 0.0, 1.0) : 0.0;

        /* #0 Orch uses Gemini nebula violet x warm gold anodized metal; #1..#4 Aux keep neutral charcoal/porcelain tops for legibility with brand accents on top LED slot & skirt */
        var restCapHex = isOrch
          ? (palette.isLight ? '#D6CFF5' : '#2C2352')
          : (palette.auxRestCap || palette.availRestCap || (palette.isLight ? '#E4E8F0' : '#222730'));
        var restLegHex = isOrch
          ? (palette.isLight ? '#1E1B4B' : '#FAF8FF')
          : (palette.auxRestLegend || palette.availRestLegend || (palette.isLight ? '#141B26' : '#EEF3FA'));
        var restCapRgb = hexToRgb01(restCapHex);
        var restLegRgb = hexToRgb01(restLegHex);

        var activeCapRgb;
        var activeLegRgb;
        var stemHex;
        var ledHex;
        var secRgb;

        if (tp.isMono) {
          var monoHeroCap = palette.isLight ? [0.945, 0.957, 0.976] : [0.118, 0.137, 0.176];
          var monoHeroLeg = palette.isLight ? [0.075, 0.094, 0.133] : [0.973, 0.980, 0.992];
          var monoBlend = isOrch ? Math.max(chromaT * 0.5, latchT) : chromaT;
          activeCapRgb = mixRgb(restCapRgb, monoHeroCap, monoBlend);
          activeLegRgb = mixRgb(restLegRgb, monoHeroLeg, monoBlend);
          stemHex = palette.isLight ? '#334155' : '#CBD5E1';
          ledHex = palette.isLight ? '#94A3B8' : '#E2E8F0';
          secRgb = palette.isLight ? [0.45, 0.50, 0.58] : [0.85, 0.88, 0.93];
        } else {
          var brandHex = (auxSlot && auxSlot.accentHex) || (isOrch ? '#7C5CFF' : '#00D4FF');
          var secHex = (auxSlot && auxSlot.secondaryHex) || (isOrch ? '#F0B85A' : brandHex);
          var brandRgb = hexToRgb01(brandHex);
          secRgb = hexToRgb01(secHex);
          var heroCapRgb = isOrch
            ? (palette.isLight ? [0.44, 0.36, 0.68] : [0.32, 0.25, 0.56])
            : (palette.isLight
                ? mixRgb([0.88, 0.91, 0.96], brandRgb, 0.24)
                : mixRgb([0.14, 0.17, 0.22], brandRgb, 0.28));
          var heroLegRgb = isOrch
            ? (palette.isLight ? [0.11, 0.08, 0.27] : [1.0, 0.97, 0.90])
            : (palette.isLight ? [0.08, 0.11, 0.17] : [0.98, 0.99, 1.0]);
          var colorT = isOrch ? Math.max(latchT, chromaT * 0.55) : chromaT;
          activeCapRgb = mixRgb(restCapRgb, heroCapRgb, colorT);
          activeLegRgb = mixRgb(restLegRgb, heroLegRgb, colorT);
          stemHex = brandHex;
          var stemTopAuxHex = isOrch ? '#F5B942' : secHex;
          ledHex = isOrch ? '#C4B5FD' : secHex;
        }

        if (availT < 0.9995) {
          activeCapRgb = mixRgb(blindCapRgb, activeCapRgb, availT);
          activeLegRgb = mixRgb(blindLegRgb, activeLegRgb, availT);
        }

        return {
          capRgb: activeCapRgb,
          legendRgb: activeLegRgb,
          cap: rgb01ToCss(activeCapRgb),
          legend: rgb01ToCss(activeLegRgb),
          stem: stemHex,
          stemTop: typeof stemTopAuxHex === 'string' ? stemTopAuxHex : ledHex,
          led: ledHex,
          secondaryRgb: secRgb,
          availMix: availT,
        };
      }

      /**
       * V14 maps active model to dual-tone antigravity crystal & flux ring spectrum:
       * 1H azure->ice-blue, 6C royal cobalt->ice-cyan, 10Ne coral->liquid gold, 18Ar royal blue->electric indigo, Orchestrator nebula violet-gold
       */
      function resolveFluxCrystalColors(switchInfo) {
        var tp = state.themeProfile || {};
        if (tp.isMono) {
          return { primary: [0.82, 0.86, 0.92], secondary: [0.64, 0.70, 0.78] };
        }
        if (switchInfo && switchInfo.isAux) {
          var auxSlot = state.auxModels[switchInfo.auxIndex] || DEFAULT_AUX_MODELS[switchInfo.auxIndex] || DEFAULT_AUX_MODELS[0];
          var isOrch = switchInfo.auxIndex === 0 || /orch/i.test(String(auxSlot.id || '') + ' ' + String(auxSlot.shortLabel || ''));
          if (isOrch) {
            return {
              primary: [0.58, 0.40, 0.99],   /* Nebula violet-blue */
              secondary: [0.98, 0.76, 0.30], /* Warm champagne gold */
            };
          }
          var pRgb = hexToRgb01(auxSlot.accentHex || '#00D4FF');
          var sRgb = hexToRgb01(auxSlot.secondaryHex || auxSlot.accentHex || '#67E8F9');
          return {
            primary: shadeRgb(pRgb, 1.12, 0.04),
            secondary: shadeRgb(sRgb, 1.10, 0.06),
          };
        }
        var zNum = switchInfo && switchInfo.z !== undefined ? Number(switchInfo.z) : Number(state.selectedZ);
        if (zNum === 1) return { primary: [0.22, 0.74, 0.98], secondary: [0.80, 0.95, 1.00] };  /* 1H azure -> ice-white blue */
        if (zNum === 6) return { primary: [0.20, 0.48, 0.98], secondary: [0.42, 0.91, 0.99] };  /* 6C royal cobalt -> ice-cyan iridescence */
        if (zNum === 10) return { primary: [1.00, 0.38, 0.22], secondary: [1.00, 0.75, 0.28] }; /* 10Ne coral red-orange -> liquid warm gold */
        if (zNum === 18) return { primary: [0.26, 0.42, 0.98], secondary: [0.66, 0.38, 1.00] }; /* 18Ar royal blue -> electric indigo-violet */
        var baseLed = (switchInfo && switchInfo.ledRgb) || [0.45, 0.68, 0.98];
        return { primary: baseLed, secondary: shadeRgb(baseLed, 1.12, 0.08) };
      }

      function resolveScreenElementRgb(zNum, palette) {
        var tp = state.themeProfile || {};
        if (tp.isMono) {
          return palette.isLight ? [0.24, 0.28, 0.35] : [0.76, 0.81, 0.88];
        }
        if (ARTISAN_BY_Z[zNum]) {
          return hexToRgb01(ARTISAN_BY_Z[zNum].cap);
        }
        var sIdx = slotIndexByZ.get(zNum);
        if (sIdx !== undefined && slots[sIdx]) {
          var grp = slots[sIdx].group;
          if (grp && GROUP_ARTISAN_FALLBACK[grp]) {
            return hexToRgb01(GROUP_ARTISAN_FALLBACK[grp].cap);
          }
        }
        return hexToRgb01(tp.primaryHex || '#94A3B8');
      }

      function computeEffortButtonLayouts() {
        var info = state.deckInfo;
        var levels = info && info.isAvailable !== false && Array.isArray(info.levels) ? info.levels : [];
        if (!levels.length) return [];

        var painter = ensureOledPainter();
        if (painter && typeof painter.getEffortUvRects === 'function') {
          try {
            var extItems = painter.getEffortUvRects(levels);
            if (Array.isArray(extItems) && extItems.length > 0) {
              var spanX = DECK_X_MAX - DECK_X_MIN;
              var spanZ = DECK_Z_MAX - DECK_Z_MIN;
              var mapped = [];
              for (var i = 0; i < extItems.length; i++) {
                var r = extItems[i];
                var u0 = clamp(Number(r.u0 !== undefined ? r.u0 : r.x / OLED_WIDTH), 0, 1);
                var v0 = clamp(Number(r.v0 !== undefined ? r.v0 : r.y / OLED_HEIGHT), 0, 1);
                var u1 = clamp(Number(r.u1 !== undefined ? r.u1 : (r.x + r.w) / OLED_WIDTH), 0, 1);
                var v1 = clamp(Number(r.v1 !== undefined ? r.v1 : (r.y + r.h) / OLED_HEIGHT), 0, 1);
                var effStr = String(r.effort || '');
                mapped.push({
                  index: i,
                  effort: effStr,
                  label: String(r.label || effStr),
                  active: Boolean(r.active),
                  u0: u0,
                  v0: v0,
                  u1: u1,
                  v1: v1,
                  x0: DECK_X_MIN + u0 * spanX,
                  x1: DECK_X_MIN + u1 * spanX,
                  z0: DECK_Z_MIN + v0 * spanZ,
                  z1: DECK_Z_MIN + v1 * spanZ,
                  press: effortPressCur[i] || 0,
                  hover: effortHoverCur[i] || 0,
                });
              }
              return mapped;
            }
          } catch (_uvErr) {
            /* fallback to built-in capsule geometry */
          }
        }

        return computeScreenEffortCapsules(info, effortPressCur, effortHoverCur).items;
      }

      function resolveControlIndex(rawId) {
        if (!rawId) return -1;
        var s = String(rawId).trim();
        if (s === 'prism-wave') return 0;
        if (s === 'reset-view' || s === 'reset') return 1;
        if (s === 'mute') return 2;
        if (s === 'close') return 3;
        return -1;
      }

      /* Preallocated hardware widget args & ray/projection scratch vectors eliminating per-frame GC churn */
      var _hwCtrlCache = {
        muted: false,
        effortTier: 0,
        orbitMag: 0,
        prismHover: 0,
        prismPress: 0,
        prismWaveDip: 0,
        resetHover: 0,
        resetPress: 0,
        muteHover: 0,
        mutePress: 0,
        knobAngle: 0,
        closeHover: 0,
        closePress: 0,
      };
      var _tmpVec4A = new Float32Array(4);
      var _tmpVec4B = new Float32Array(4);
      var _tmpVec4C = new Float32Array(4);
      var _tmpDir3A = new Float32Array(3);

      function buildHardwareCtrlParams() {
        _hwCtrlCache.muted = Boolean(state.hardwareState && state.hardwareState.muted);
        _hwCtrlCache.effortTier = effortTierCur;
        _hwCtrlCache.orbitMag = Math.hypot(orbitPitchCur, orbitYawCur);
        _hwCtrlCache.prismHover = ctrlHoverCur[0];
        _hwCtrlCache.prismPress = ctrlPressCur[0];
        _hwCtrlCache.prismWaveDip = artisanWaveDipCur;
        _hwCtrlCache.resetHover = ctrlHoverCur[1];
        _hwCtrlCache.resetPress = ctrlPressCur[1];
        _hwCtrlCache.muteHover = ctrlHoverCur[2];
        _hwCtrlCache.mutePress = ctrlPressCur[2];
        _hwCtrlCache.knobAngle = knobAngleCur;
        _hwCtrlCache.closeHover = ctrlHoverCur[3];
        _hwCtrlCache.closePress = ctrlPressCur[3];
        return _hwCtrlCache;
      }

      var _ctrlPickBoundsCache = [
        { id: 'prism-wave', action: 'prism-wave', shape: 'box', radius: 0, minX: ARTISAN_WAVE_X - 0.458, maxX: ARTISAN_WAVE_X + 0.458, minY: 0.01, maxY: 0, minZ: ROW1_Z - 0.458, maxZ: ROW1_Z + 0.458, cx3d: ARTISAN_WAVE_X, cy3d: 0, cz3d: ROW1_Z },
        { id: 'reset-view', action: 'reset-view', shape: 'disc', radius: 0.36, minX: CTRL_RESET_X - 0.35, maxX: CTRL_RESET_X + 0.35, minY: HW_DECK_Y_TOP - 0.02, maxY: 0, minZ: ROW1_Z - 0.35, maxZ: ROW1_Z + 0.35, cx3d: CTRL_RESET_X, cy3d: 0, cz3d: ROW1_Z },
        { id: 'mute', action: 'mute', shape: 'knob', radius: 0, minX: CTRL_MUTE_X - 0.36, maxX: 6.91, minY: HW_DECK_Y_TOP - 0.02, maxY: 0, minZ: ROW1_Z - 0.36, maxZ: ROW1_Z + 0.36, cx3d: CTRL_MUTE_X, cy3d: 0, cz3d: ROW1_Z },
        { id: 'close', action: 'close', shape: 'box', radius: 0, minX: CTRL_CLOSE_X - 0.345, maxX: CTRL_CLOSE_X + 0.345, minY: HW_DECK_Y_TOP - 0.02, maxY: 0, minZ: ROW1_Z - 0.345, maxZ: ROW1_Z + 0.345, cx3d: CTRL_CLOSE_X, cy3d: 0, cz3d: ROW1_Z },
      ];

      function computeControlPickBounds() {
        var pWaveY = CAP_Y_BASE + 0.018 + ctrlHoverCur[0] * 0.030 - ctrlPressCur[0] * 0.105 + artisanWaveDipCur;
        var rTopY = HW_DECK_Y_TOP + 0.125 + ctrlHoverCur[1] * 0.016 - ctrlPressCur[1] * 0.062;
        var mTopY = HW_DECK_Y_TOP + 0.245 + ctrlHoverCur[2] * 0.016 - ctrlPressCur[2] * 0.052;
        var cTopY = HW_DECK_Y_TOP + 0.125 + ctrlHoverCur[3] * 0.016 - ctrlPressCur[3] * 0.062;
        _ctrlPickBoundsCache[0].maxY = pWaveY + 0.655;
        _ctrlPickBoundsCache[0].cy3d = pWaveY + 0.58;
        _ctrlPickBoundsCache[1].maxY = rTopY + 0.02;
        _ctrlPickBoundsCache[1].cy3d = rTopY;
        _ctrlPickBoundsCache[2].maxY = mTopY + 0.02;
        _ctrlPickBoundsCache[2].cy3d = mTopY;
        _ctrlPickBoundsCache[3].maxY = cTopY + 0.02;
        _ctrlPickBoundsCache[3].cy3d = cTopY;
        return _ctrlPickBoundsCache;
      }

      function computeControlLayouts() {
        var specs = computeControlPickBounds();
        var isMuted = Boolean(state.hardwareState && state.hardwareState.muted);
        var isRot = Math.hypot(orbitPitchCur, orbitYawCur) > 0.015;

        var list = [];
        for (var i = 0; i < specs.length; i++) {
          var sp = specs[i];
          var r = projectBoxToCssRect(sp.minX, sp.minY, sp.minZ, sp.maxX, sp.maxY, sp.maxZ, null);
          var topPt = projectChassisPointToPx(sp.cx3d, sp.cy3d, sp.cz3d, 1.0);
          var cx = topPt ? Math.round(topPt[0] * 10) / 10 : Math.round((r.left + r.width * 0.5) * 10) / 10;
          var cy = topPt ? Math.round(topPt[1] * 10) / 10 : Math.round((r.top + r.height * 0.5) * 10) / 10;
          list.push({
            id: sp.id,
            action: sp.id,
            shape: sp.shape,
            radius: sp.radius || 0,
            minX: sp.minX, maxX: sp.maxX,
            minY: sp.minY, maxY: sp.maxY,
            minZ: sp.minZ, maxZ: sp.maxZ,
            cx3d: sp.cx3d, cy3d: sp.cy3d, cz3d: sp.cz3d,
            left: r.left,
            top: r.top,
            width: r.width,
            height: r.height,
            cx: cx,
            cy: cy,
            muted: isMuted,
            isRotated: isRot,
          });
        }
        return list;
      }

      function mixScalar(a, b, t) {
        return a + (b - a) * clamp(t, 0, 1);
      }

      function projectChassisPointToPx(lx, ly, lz, scaleMul) {
        var wp = transformPoint4(chassisMat, lx, ly, lz, 1.0, _tmpVec4A);
        var cp = transformPoint4(viewProjMat, wp[0], wp[1], wp[2], 1.0, _tmpVec4B);
        var w = cp[3];
        if (w <= 0.01) return null;
        var ndcX = cp[0] / w;
        var ndcY = cp[1] / w;
        var sm = scaleMul || 1;
        return [
          (ndcX * 0.5 + 0.5) * cssWidth * sm,
          (0.5 - ndcY * 0.5) * cssHeight * sm,
          w,
        ];
      }

      function projectAuxChassisPointToPx(lx, ly, lz, scaleMul) {
        var wp = transformPoint4(auxChassisMat, lx, ly, lz, 1.0, _tmpVec4A);
        var cp = transformPoint4(viewProjMat, wp[0], wp[1], wp[2], 1.0, _tmpVec4B);
        var w = cp[3];
        if (w <= 0.01) return null;
        var ndcX = cp[0] / w;
        var ndcY = cp[1] / w;
        var sm = scaleMul || 1;
        return [
          (ndcX * 0.5 + 0.5) * cssWidth * sm,
          (0.5 - ndcY * 0.5) * cssHeight * sm,
          w,
        ];
      }

      function isConfirmSlamActiveGlobal() {
        return Boolean(
          state.confirmSlamActive ||
          (state.confirmSlamZ !== null && state.confirmSlamZ !== undefined) ||
          (state.confirmSlamAuxIndex !== null && state.confirmSlamAuxIndex !== undefined)
        );
      }

      function isSlotConfirmSlamming(zVal, rawZ) {
        if (state.confirmSlamZ !== null && state.confirmSlamZ !== undefined) {
          return state.confirmSlamZ === zVal || state.confirmSlamZ === rawZ;
        }
        if (state.confirmSlamActive && state.selectedZ !== null && state.selectedZ !== undefined) {
          return state.selectedZ === zVal || state.selectedZ === rawZ;
        }
        return false;
      }

      function isAuxSlotConfirmSlamming(auxIdx) {
        if (state.confirmSlamAuxIndex !== null && state.confirmSlamAuxIndex !== undefined) {
          return state.confirmSlamAuxIndex === auxIdx;
        }
        if (state.confirmSlamActive && state.selectedAuxIndex !== null && state.selectedAuxIndex !== undefined) {
          return state.selectedAuxIndex === auxIdx;
        }
        return false;
      }

      /**
       * Computes pointer ray intersection in chassis-local space u_prismFocusPos = vec4(x, y, z, activeWeight)
       * Covers both main chassis [-9.68, +9.68] and right 2x3 aux pad [+10.40, +12.90] for live 3D prism edge dispersion
       */
      function updatePrismFocusPosition() {
        var rotMag = Math.hypot(orbitPitchCur, orbitYawCur);
        var orbitRimWeight = smootherstepScalar(0.008, 0.24, rotMag) * 0.85;
        var hasClientRay = pointerMode === 'client' && lastClientInside && Number.isFinite(lastClientX) && Number.isFinite(lastClientY);

        if (hasClientRay) {
          var rect = readCanvasCssRect(false);
          var rw = rect.width > 1 ? rect.width : cssWidth;
          var rh = rect.height > 1 ? rect.height : cssHeight;
          var lx = lastClientX - rect.left;
          var ly = lastClientY - rect.top;
          var ndcX = (lx / rw) * 2.0 - 1.0;
          var ndcY = 1.0 - (ly / rh) * 2.0;

          var nearW = transformPoint4(invViewProjMat, ndcX, ndcY, -1.0, 1.0, _tmpVec4A);
          var farW = transformPoint4(invViewProjMat, ndcX, ndcY, 1.0, 1.0, _tmpVec4B);
          if (Math.abs(nearW[3]) > 1e-7 && Math.abs(farW[3]) > 1e-7) {
            var oxW = nearW[0] / nearW[3], oyW = nearW[1] / nearW[3], ozW = nearW[2] / nearW[3];
            var fxW = farW[0] / farW[3], fyW = farW[1] / farW[3], fzW = farW[2] / farW[3];
            var dxW = fxW - oxW, dyW = fyW - oyW, dzW = fzW - ozW;
            var lenW = Math.hypot(dxW, dyW, dzW) || 1;
            dxW /= lenW; dyW /= lenW; dzW /= lenW;

            var oCh = transformPoint4(invChassisMat, oxW, oyW, ozW, 1.0, _tmpVec4C);
            var dCh = transformDir3(invChassisMat, dxW, dyW, dzW, _tmpDir3A);
            var targetPlaneY = orbitPitchCur < -0.22 ? -0.35 : CASE_Y_TOP;
            if (Math.abs(dCh[1]) > 1e-4) {
              var tHit = (targetPlaneY - oCh[1]) / dCh[1];
              if (tHit > 0) {
                var hx = clamp(oCh[0] + dCh[0] * tHit, -12.8, 15.8);
                var hz = clamp(oCh[2] + dCh[2] * tHit, -6.5, 7.5);
                var mainD = Math.max(0.0, sdRoundedBox2D(hx, hz - 0.38, CASE_HALF_W, (CASE_Z_MAX - CASE_Z_MIN) * 0.5, CASE_CORNER_R));
                var boxD = mainD;
                if (enableAuxPad) {
                  var auxD = Math.max(
                    0.0,
                    sdRoundedBox2D(
                      hx - AUX_CENTER_X,
                      hz - (AUX_CASE_Z_MIN + AUX_CASE_Z_MAX) * 0.5,
                      (AUX_CASE_X_MAX - AUX_CASE_X_MIN) * 0.5,
                      (AUX_CASE_Z_MAX - AUX_CASE_Z_MIN) * 0.5,
                      AUX_CASE_CORNER_R
                    )
                  );
                  boxD = Math.min(mainD, auxD);
                }
                var ptrWeight = Math.exp(-boxD * boxD * 0.32);
                prismFocusVec[0] = hx;
                prismFocusVec[1] = targetPlaneY;
                prismFocusVec[2] = hz;
                prismFocusVec[3] = clamp(Math.max(ptrWeight, orbitRimWeight), 0.0, 1.0);
                return;
              }
            }
          }
        }

        if (pointerMode === 'norm' && nearTrackingActive) {
          var focusMidX = enableAuxPad ? 1.56 : 0.0;
          var focusSpanX = enableAuxPad ? 11.34 : CASE_HALF_W;
          prismFocusVec[0] = clamp(focusMidX + pointerTargetX * focusSpanX, -CASE_HALF_W, enableAuxPad ? AUX_CASE_X_MAX : CASE_HALF_W);
          prismFocusVec[1] = CASE_Y_TOP;
          prismFocusVec[2] = clamp(pointerTargetY * 4.0 + 0.38, CASE_Z_MIN, CASE_Z_MAX);
          prismFocusVec[3] = 0.88;
          return;
        }

        if (orbitRimWeight > 0.01) {
          var orbBaseX = enableAuxPad ? 1.56 : 0.0;
          prismFocusVec[0] = orbBaseX + Math.sin(orbitYawCur * 1.35) * (CASE_HALF_W * 0.78);
          prismFocusVec[1] = orbitPitchCur < -0.15 ? -0.52 : CASE_Y_TOP * 0.5;
          prismFocusVec[2] = 0.38 - Math.sin(orbitPitchCur * 1.4) * 3.4;
          prismFocusVec[3] = orbitRimWeight;
          return;
        }

        prismFocusVec[3] = 0.0;
      }

      /**
       * Local near-field orientation solver (supports both main selectedZ and right 2x3 aux selectedAuxIndex levitated keys)
       */
      function recomputePointerTargets() {
        if (isConfirmSlamActiveGlobal()) {
          nearTrackingActive = false;
          tgtLiftPitch = 0;
          tgtLiftRoll = 0;
          tgtLiftYaw = 0;
          tgtLiftMagX = 0;
          tgtLiftMagZ = 0;
          return;
        }

        if (pointerMode === 'client') {
          var hasMainSel = state.selectedZ !== null && state.selectedZ !== undefined;
          var hasAuxSel = enableAuxPad && state.selectedAuxIndex !== null && state.selectedAuxIndex !== undefined;
          if (
            !lastClientInside ||
            !Number.isFinite(lastClientX) ||
            !Number.isFinite(lastClientY) ||
            (!hasMainSel && !hasAuxSel)
          ) {
            nearTrackingActive = false;
            lastNearDistPx = Infinity;
            tgtLiftPitch = 0;
            tgtLiftRoll = 0;
            tgtLiftYaw = 0;
            tgtLiftMagX = 0;
            tgtLiftMagZ = 0;
            return;
          }

          var coord = null;
          var useAuxProj = false;
          var curOrbYaw = orbitYawCur;
          if (hasAuxSel && !hasMainSel) {
            var aIdx = clamp(Math.round(Number(state.selectedAuxIndex)), 0, AUX_SLOT_COUNT - 1);
            coord = auxSlotCoords[aIdx];
            useAuxProj = true;
            curOrbYaw = auxOrbitYawCur;
          } else {
            var sIdx = slotIndexByZ.get(state.selectedZ);
            if (sIdx !== undefined) {
              coord = slotCoords[sIdx];
            }
          }

          if (!coord) {
            nearTrackingActive = false;
            lastNearDistPx = Infinity;
            tgtLiftPitch = 0;
            tgtLiftRoll = 0;
            tgtLiftYaw = 0;
            tgtLiftMagX = 0;
            tgtLiftMagZ = 0;
            return;
          }

          var rect = readCanvasCssRect(false);
          var rw = rect.width > 1 ? rect.width : cssWidth;
          var rh = rect.height > 1 ? rect.height : cssHeight;
          var scaleX = rw / Math.max(1, cssWidth);
          var scaleY = rh / Math.max(1, cssHeight);

          var capMidY = CAP_Y_BASE + coord.rowYBias + effortLiftHeightCur + CAP_HEIGHT * 0.48;
          var pCenter = useAuxProj
            ? projectAuxChassisPointToPx(coord.x, capMidY, coord.z, 1.0)
            : projectChassisPointToPx(coord.x, capMidY, coord.z, 1.0);
          var pRight = useAuxProj
            ? projectAuxChassisPointToPx(coord.x + KEY_PITCH, capMidY, coord.z, 1.0)
            : projectChassisPointToPx(coord.x + KEY_PITCH, capMidY, coord.z, 1.0);
          if (!pCenter) {
            nearTrackingActive = false;
            lastNearDistPx = Infinity;
            tgtLiftPitch = 0;
            tgtLiftRoll = 0;
            tgtLiftYaw = 0;
            tgtLiftMagX = 0;
            tgtLiftMagZ = 0;
            return;
          }

          var capCx = rect.left + pCenter[0] * scaleX;
          var capCy = rect.top + pCenter[1] * scaleY;
          var keyW = pRight
            ? Math.hypot((pRight[0] - pCenter[0]) * scaleX, (pRight[1] - pCenter[1]) * scaleY)
            : (rw * 0.94) / 22.6;
          var radiusPx = clamp(keyW * 3.45, 150, 172);
          var dx = lastClientX - capCx;
          var dy = lastClientY - capCy;
          var distPx = Math.hypot(dx, dy);
          lastCapCx = capCx;
          lastCapCy = capCy;
          lastNearRadiusPx = radiusPx;
          lastNearDistPx = distPx;

          if (!(distPx <= radiusPx)) {
            nearTrackingActive = false;
            tgtLiftPitch = 0;
            tgtLiftRoll = 0;
            tgtLiftYaw = 0;
            tgtLiftMagX = 0;
            tgtLiftMagZ = 0;
            return;
          }

          nearTrackingActive = true;
          var w = smootherstepScalar(1.0, 0.12, distPx / radiusPx);
          var dirX = (dx / radiusPx) * w * NEAR_PEAK_NORM_GAIN;
          var dirY = (dy / radiusPx) * w * NEAR_PEAK_NORM_GAIN;
          var dirLen = Math.hypot(dirX, dirY);
          if (dirLen > 1.0) {
            dirX /= dirLen;
            dirY /= dirLen;
          }

          /* Map screen-plane direction onto the orbited chassis local tangent plane for natural pull at any yaw */
          var cyOrb = Math.cos(curOrbYaw);
          var syOrb = Math.sin(curOrbYaw);
          var localDirX = dirX * cyOrb - dirY * syOrb;
          var localDirZ = dirX * syOrb + dirY * cyOrb;

          tgtLiftPitch = localDirZ * CAP_TILT_MAX_RAD;
          tgtLiftRoll = -localDirX * CAP_TILT_MAX_RAD;
          tgtLiftYaw = localDirX * CAP_YAW_MAX_RAD;
          tgtLiftMagX = localDirX * CAP_MAGNETIC_DRIFT;
          tgtLiftMagZ = localDirZ * CAP_MAGNETIC_DRIFT;
          return;
        }

        if (pointerMode === 'norm') {
          var normX = clamp(pointerTargetX, -1.0, 1.0);
          var normY = clamp(pointerTargetY, -1.0, 1.0);
          nearTrackingActive = Math.hypot(normX, normY) > 1e-4;
          tgtLiftPitch = normY * CAP_TILT_MAX_RAD;
          tgtLiftRoll = -normX * CAP_TILT_MAX_RAD;
          tgtLiftYaw = normX * CAP_YAW_MAX_RAD;
          tgtLiftMagX = normX * CAP_NORM_DRIFT_COMPAT;
          tgtLiftMagZ = normY * CAP_NORM_DRIFT_COMPAT;
          return;
        }

        nearTrackingActive = false;
        tgtLiftPitch = 0;
        tgtLiftRoll = 0;
        tgtLiftYaw = 0;
        tgtLiftMagX = 0;
        tgtLiftMagZ = 0;
      }

      function buildOrbitMatrixAroundPivot(outMat, outInvMat, pitchRad, yawRad, liftY, pivot) {
        if (Math.abs(pitchRad) < 1e-7 && Math.abs(yawRad) < 1e-7 && Math.abs(liftY) < 1e-7) {
          mat4Identity(outMat);
          mat4Identity(outInvMat);
          return;
        }
        var cpx = Math.cos(pitchRad), spx = Math.sin(pitchRad);
        var cyy = Math.cos(yawRad), syy = Math.sin(yawRad);
        outMat[0] = cyy;            outMat[1] = spx * syy;   outMat[2] = -cpx * syy;  outMat[3] = 0;
        outMat[4] = 0;              outMat[5] = cpx;         outMat[6] = spx;         outMat[7] = 0;
        outMat[8] = syy;            outMat[9] = -spx * cyy;  outMat[10] = cpx * cyy;  outMat[11] = 0;
        outMat[12] = pivot[0] - (outMat[0] * pivot[0] + outMat[4] * pivot[1] + outMat[8] * pivot[2]);
        outMat[13] = (pivot[1] + liftY) - (outMat[1] * pivot[0] + outMat[5] * pivot[1] + outMat[9] * pivot[2]);
        outMat[14] = pivot[2] - (outMat[2] * pivot[0] + outMat[6] * pivot[1] + outMat[10] * pivot[2]);
        outMat[15] = 1;
        if (!mat4Invert(outInvMat, outMat)) {
          mat4Identity(outInvMat);
        }
      }

      /**
       * V11 dual-peripheral full-angle frustum safety zoom solver (computeOrbitSafetyZoom):
       * Encloses main left edge -9.68 to aux right edge +12.90 (plus 1.06U Extra levitated crown),
       * guaranteeing zero clipping at any aspect ratio or 3D orbit angle
       */
      function computeOrbitSafetyZoom(baseDist, aspect, tanHalfFov, camTarget, sinCam, cosCam, isDrawerMode, rotNorm) {
        var safeNdcX = isDrawerMode ? 0.968 : (rotNorm > 1e-4 ? 0.892 : 0.960);
        var safeNdcY = isDrawerMode ? 0.952 : (rotNorm > 1e-4 ? 0.876 : 0.945);
        var frustumReq = baseDist;

        function accumBoxCorners(modelM, x0, x1, y0, y1, z0, z1) {
          /* Zero-GC 8-corner projection reusing _tmpVec4A to eliminate 16-48 temp array allocations/frame */
          for (var xi = 0; xi < 2; xi++) {
            var vx = xi === 0 ? x0 : x1;
            for (var yi = 0; yi < 2; yi++) {
              var vy = yi === 0 ? y0 : y1;
              for (var zi = 0; zi < 2; zi++) {
                var vz = zi === 0 ? z0 : z1;
                var wpB = transformPoint4(modelM, vx, vy, vz, 1.0, _tmpVec4A);
                var dxT = wpB[0] - camTarget[0];
                var dyT = wpB[1] - camTarget[1];
                var dzT = wpB[2] - camTarget[2];
                var camUpProj = dyT * cosCam - dzT * sinCam;
                var camDepthProj = dyT * sinCam + dzT * cosCam;
                var reqW = camDepthProj + Math.abs(dxT) / (safeNdcX * tanHalfFov * aspect);
                var reqH = camDepthProj + Math.abs(camUpProj) / (safeNdcY * tanHalfFov);
                if (reqW > frustumReq) frustumReq = reqW;
                if (reqH > frustumReq) frustumReq = reqH;
              }
            }
          }
        }

        var maxCapCrownY = CASE_Y_TOP + 1.18;
        if (isDrawerMode && rotNorm <= 1e-4) {
          /* V12 compact dock segmented wedge hull: eliminates wasted vertical margins while guaranteeing zero edge clipping */
          accumBoxCorners(
            chassisMat,
            -CASE_HALF_W - 0.04, CASE_HALF_W + 0.04,
            -0.36, CASE_Y_TOP + 0.04,
            CASE_Z_MIN - 0.04, CASE_Z_MAX + 0.04
          );
          accumBoxCorners(
            chassisMat,
            -CASE_HALF_W + 0.44, CASE_HALF_W - 0.44,
            CASE_Y_BOT - 0.04, -0.32,
            CASE_Z_MIN + 0.38, CASE_Z_MAX - 0.48
          );
          accumBoxCorners(
            chassisMat,
            WELL_X_MIN, WELL_X_MAX,
            0.0, CASE_Y_TOP + 1.14,
            -2.04, WELL_Z_MAX
          );
          accumBoxCorners(
            chassisMat,
            WELL_X_MIN, WELL_X_MAX,
            0.0, 0.72,
            ROW1_Z - 0.48, -2.04
          );
          if (enableAuxPad) {
            accumBoxCorners(
              auxChassisMat,
              AUX_CASE_X_MIN - 0.04, AUX_CASE_X_MAX + 0.04,
              -0.36, CASE_Y_TOP + 1.14,
              AUX_CASE_Z_MIN - 0.04, AUX_CASE_Z_MAX + 0.04
            );
            accumBoxCorners(
              auxChassisMat,
              AUX_CASE_X_MIN + 0.20, AUX_CASE_X_MAX - 0.20,
              CASE_Y_BOT - 0.04, -0.32,
              AUX_CASE_Z_MIN + 0.24, AUX_CASE_Z_MAX - 0.32
            );
          }
          return Math.max(baseDist, frustumReq);
        }

        accumBoxCorners(
          chassisMat,
          -CASE_HALF_W - 0.10, CASE_HALF_W + 0.10,
          CASE_Y_BOT - 0.10, maxCapCrownY,
          CASE_Z_MIN - 0.10, CASE_Z_MAX + 0.10
        );
        if (enableAuxPad) {
          accumBoxCorners(
            auxChassisMat,
            AUX_CASE_X_MIN - 0.08, AUX_CASE_X_MAX + 0.10,
            CASE_Y_BOT - 0.10, maxCapCrownY,
            AUX_CASE_Z_MIN - 0.08, AUX_CASE_Z_MAX + 0.10
          );
        }

        if (rotNorm <= 1e-4) {
          return Math.max(baseDist, frustumReq);
        }
        var smoothOrbit = smootherstepScalar(0.0, 0.055, rotNorm);
        var absYaw = Math.abs(orbitYawCur);
        var absPitch = Math.abs(orbitPitchCur);
        var analyticZoom = 1.0 + (0.64 * Math.abs(Math.sin(absYaw)) + 0.25 * Math.abs(Math.sin(absPitch))) * smoothOrbit;
        var blendedFrustumDist = baseDist + Math.max(0.0, frustumReq - baseDist) * smoothOrbit;
        return Math.max(baseDist * analyticZoom, blendedFrustumDist);
      }

      function updateTransforms() {
        var aspect = Math.max(0.45, cssWidth / Math.max(1, cssHeight));
        var tanHalfFov = Math.tan(CAM_FOV_Y * 0.5);
        var isDrawerMode = state.stageMode === 'drawer';
        var activeTarget = enableAuxPad
          ? (isDrawerMode ? CAM_TARGET_SUITE_DRAWER : CAM_TARGET_SUITE)
          : CAM_TARGET_SINGLE;
        var activePivot = enableAuxPad ? ORBIT_PIVOT_SUITE : ORBIT_PIVOT_SINGLE;
        var suiteHalfSpanX = enableAuxPad
          ? Math.max(activeTarget[0] - (-CASE_HALF_W), AUX_CASE_X_MAX - activeTarget[0])
          : CASE_HALF_W;
        var widthFillTarget = isDrawerMode ? 0.968 : (enableAuxPad ? 0.938 : 0.950);
        var heightHalfSpan = isDrawerMode ? 3.92 : 4.86;
        var frontDepthShift = Math.sin(CAM_PITCH) * 0.30 + Math.cos(CAM_PITCH) * (CASE_Z_MAX - activeTarget[2]);
        var distForWidth = frontDepthShift + (suiteHalfSpanX / widthFillTarget) / (tanHalfFov * aspect);
        var distForHeight = heightHalfSpan / tanHalfFov;
        var baseDist = Math.max(distForWidth, distForHeight);

        /* 1. Build main chassisMat and co-orbiting auxChassisMat (~3.2% inertial lag around shared activePivot) */
        var introLiftY = 0.0;
        var introPitchAdd = 0.0;
        if (introActive && introElapsed < INTRO_WAKE_DURATION) {
          var ip = clamp(introElapsed / INTRO_WAKE_DURATION, 0, 1);
          var iEase = 1.0 - Math.pow(1.0 - ip, 3.6);
          introLiftY = INTRO_SINK_Y * (1.0 - iEase);
          introPitchAdd = INTRO_PITCH_RAD * (1.0 - iEase);
        }

        var effPitch = orbitPitchCur + introPitchAdd;
        var effYaw = orbitYawCur;
        buildOrbitMatrixAroundPivot(chassisMat, invChassisMat, effPitch, effYaw, introLiftY, activePivot);

        var auxEffPitch = auxOrbitPitchCur + introPitchAdd * (1.0 + AUX_COORBIT_LAG_RATIO);
        var auxEffYaw = auxOrbitYawCur;
        var auxEffLiftY = introLiftY * (1.0 + AUX_COORBIT_LAG_RATIO) + auxPhaseLiftY;
        buildOrbitMatrixAroundPivot(auxChassisMat, invAuxChassisMat, auxEffPitch, auxEffYaw, auxEffLiftY, activePivot);

        /* 2. Compute frustum zero-clipping safe camera distance */
        var rotNorm = Math.hypot(Math.abs(orbitPitchCur), Math.abs(orbitYawCur));
        var sinCam = Math.sin(CAM_PITCH);
        var cosCam = Math.cos(CAM_PITCH);
        var dist = computeOrbitSafetyZoom(baseDist, aspect, tanHalfFov, activeTarget, sinCam, cosCam, isDrawerMode, rotNorm);
        camDistCur = dist;

        camEye[0] = activeTarget[0];
        camEye[1] = activeTarget[1] + sinCam * dist;
        camEye[2] = activeTarget[2] + cosCam * dist;

        var nearClip = Math.max(3.0, dist - 26.0);
        var farClip = dist + 28.0;
        mat4Perspective(projMat, CAM_FOV_Y, aspect, nearClip, farClip);
        mat4LookAt(viewMat, camEye, activeTarget, [0, 1, 0]);
        camRightVec[0] = viewMat[0]; camRightVec[1] = viewMat[4]; camRightVec[2] = viewMat[8];
        camUpVec[0] = viewMat[1]; camUpVec[1] = viewMat[5]; camUpVec[2] = viewMat[9];
        mat4Multiply(viewProjMat, projMat, viewMat);
        mat4Invert(invViewProjMat, viewProjMat);

        updatePrismFocusPosition();

        /* 3. Precompute 3D mechanical wave ripple across 90 main + 6 aux keys */
        keyWaveDip.fill(0);
        keyWaveGlow.fill(0);
        keyWavePitch.fill(0);
        keyWaveRoll.fill(0);
        auxKeyWaveDip.fill(0);
        auxKeyWaveGlow.fill(0);
        auxKeyWavePitch.fill(0);
        auxKeyWaveRoll.fill(0);
        auxPageKeyDip.fill(0);
        auxPageKeyPitch.fill(0);
        artisanWaveDipCur = 0;
        var reducedNow = isMotionReduced();
        if (waveRipples.length > 0 && !reducedNow) {
          for (var wi = 0; wi < waveRipples.length; wi++) {
            var wv = waveRipples[wi];
            var frontR = wv.elapsed * WAVE_RIPPLE_SPEED;
            var timeFade = 1.0 - smootherstepScalar(0.16, WAVE_RIPPLE_DURATION, wv.elapsed);
            if (timeFade <= 0.001) continue;
            var dArtU = Math.hypot(ARTISAN_WAVE_X - wv.ox, ROW1_Z - wv.oz);
            var deltaArtR = dArtU - frontR;
            if (Math.abs(deltaArtR) <= 3.2) {
              var ampArt = Math.exp(-(deltaArtR * deltaArtR) / 1.75) * timeFade * (1.0 / (1.0 + dArtU * 0.045)) * wv.strength;
              artisanWaveDipCur += -WAVE_RIPPLE_PEAK * ampArt * Math.cos(deltaArtR * 1.18);
            }
            for (var ki = 0; ki < slotCount; ki++) {
              var kc = slotCoords[ki];
              var wx = kc.x - wv.ox;
              var wz = kc.z - wv.oz;
              var distU = Math.hypot(wx, wz);
              var deltaR = distU - frontR;
              if (Math.abs(deltaR) > 3.2) continue;
              var gauss = Math.exp(-(deltaR * deltaR) / 1.75);
              var distFade = 1.0 / (1.0 + distU * 0.045);
              var amp = gauss * timeFade * distFade * wv.strength;
              var osc = Math.cos(deltaR * 1.18);
              keyWaveDip[ki] += -WAVE_RIPPLE_PEAK * amp * osc;
              keyWaveGlow[ki] = Math.min(1.0, keyWaveGlow[ki] + amp * 0.92);
              if (distU > 0.05) {
                var tiltAmp = amp * Math.sin(deltaR * 1.18) * (1.25 * DEG2RAD);
                keyWavePitch[ki] += (wz / distU) * tiltAmp;
                keyWaveRoll[ki] += -(wx / distU) * tiltAmp;
              }
            }
            if (enableAuxPad) {
              for (var aki = 0; aki < AUX_SLOT_COUNT; aki++) {
                var akc = auxSlotCoords[aki];
                var awx = akc.x - wv.ox;
                var awz = akc.z - wv.oz;
                var adistU = Math.hypot(awx, awz);
                var adeltaR = adistU - frontR;
                if (Math.abs(adeltaR) > 3.2) continue;
                var agauss = Math.exp(-(adeltaR * adeltaR) / 1.75);
                var adistFade = 1.0 / (1.0 + adistU * 0.042);
                var aamp = agauss * timeFade * adistFade * wv.strength;
                var aosc = Math.cos(adeltaR * 1.18);
                auxKeyWaveDip[aki] += -WAVE_RIPPLE_PEAK * aamp * aosc;
                auxKeyWaveGlow[aki] = Math.min(1.0, auxKeyWaveGlow[aki] + aamp * 0.92);
                if (adistU > 0.05) {
                  var atiltAmp = aamp * Math.sin(adeltaR * 1.18) * (1.25 * DEG2RAD);
                  auxKeyWavePitch[aki] += (awz / adistU) * atiltAmp;
                  auxKeyWaveRoll[aki] += -(awx / adistU) * atiltAmp;
                }
              }
            }
          }
        }

        /* 3b. Aux pad 2x3 page-switch light elastic bounce wave (preserves 2x3 physical keycap proportions) */
        if (auxPageWaveActive && enableAuxPad && !reducedNow) {
          var staggerStep = 0.026;
          var keyDur = Math.max(0.14, AUX_PAGE_WAVE_DURATION - staggerStep * 3.5);
          for (var pai = 0; pai < AUX_SLOT_COUNT; pai++) {
            var pRow = auxSlotCoords[pai].row; /* 0..2 */
            var pCol = auxSlotCoords[pai].col; /* 0..1 */
            var orderIdx = auxPageWaveDir >= 0 ? (pRow + pCol * 0.45) : ((AUX_ROWS - 1 - pRow) + (1 - pCol) * 0.45);
            var localT = (auxPageWaveElapsed - orderIdx * staggerStep) / keyDur;
            if (localT > 0 && localT < 1) {
              var pulse = Math.sin(localT * Math.PI) * (1.0 - localT * 0.16);
              auxPageKeyDip[pai] = -0.092 * pulse;
              auxPageKeyPitch[pai] = (auxPageWaveDir >= 0 ? 1 : -1) * Math.sin(localT * Math.PI * 2.0) * (2.2 * DEG2RAD) * (1.0 - localT * 0.35);
            }
          }
        }

        /* 4. Compute levitated key zero-G float, 4-tier effortLiftHeightCur & High/Extra neighbor sympathy */
        var springBusy = Math.hypot(liftMagXCur, liftRollCur) + Math.hypot(liftMagXVel, liftRollVel) * 0.08;
        var quietGate = smootherstepScalar(0.16, 0.008, springBusy);
        var effZeroG = zeroGEnvCur * quietGate;
        zeroGBobCur = Math.sin(zeroGPhase * 3.5) * ZERO_G_BOB_AMP * effZeroG;
        var zeroGPitchAdd = Math.sin(zeroGPhase * 2.6 + 0.85) * ZERO_G_TILT_AMP * effZeroG;
        var zeroGYawAdd = Math.cos(zeroGPhase * 2.1) * (0.65 * DEG2RAD) * effZeroG;
        var gyroClearanceY = clamp(rotNorm, 0, 1) * 0.064;

        var activeMainHeroIdx = (state.selectedZ !== null && state.selectedZ !== undefined)
          ? slotIndexByZ.get(state.selectedZ)
          : undefined;
        var mainHeroCoord = (activeMainHeroIdx !== undefined && keyLiftCur[activeMainHeroIdx] > 0.02)
          ? slotCoords[activeMainHeroIdx]
          : null;
        var mainHeroLiftScale = mainHeroCoord ? clamp(keyLiftCur[activeMainHeroIdx], 0, 1) : 0.0;

        var shake = state.lockedShakeZ;
        for (var i = 0; i < slotCount; i++) {
          var sl = slots[i];
          var zVal = sl.slotZ !== undefined ? sl.slotZ : sl.z;
          var isAvail = isSlotAvailable(zVal) || isSlotAvailable(sl.z);
          var coord = slotCoords[i];
          var lift = keyLiftCur[i];
          var liftClamped = clamp(lift, 0, 1);
          var unliftedFactor = 1.0 - liftClamped * 0.88;
          var press = keyPressCur[i];
          var hover = keyHoverCur[i];

          var shakeX = 0;
          if (shake && (shake.z === zVal || shake.z === sl.z)) {
            var p = clamp(Number(shake.progress) || 0, 0, 1);
            shakeX = Math.sin(p * Math.PI * 5.0) * (1.0 - p) * 0.082;
          }

          /* High / Extra neighbor sympathy: non-selected same-pad keys within <= 1.65U gently float & tilt inward */
          var symLiftY = 0.0;
          var symPitch = 0.0;
          var symRoll = 0.0;
          if (mainHeroCoord && i !== activeMainHeroIdx && neighborSympathyCur > 0.0004 && liftClamped < 0.15) {
            var dxHero = mainHeroCoord.x - coord.x;
            var dzHero = mainHeroCoord.z - coord.z;
            var dHero = Math.hypot(dxHero, dzHero);
            if (dHero > 0.05 && dHero <= NEIGHBOR_SYMPATHY_RADIUS) {
              var symW = smootherstepScalar(NEIGHBOR_SYMPATHY_RADIUS, 0.92, dHero) * mainHeroLiftScale * (1.0 - liftClamped);
              var symBreath = 1.0 + 0.12 * Math.sin(zeroGPhase * 3.1 - dHero * 1.4) * effZeroG;
              symLiftY = neighborSympathyCur * symW * symBreath;
              var tiltRatio = clamp((neighborSympathyCur - 0.030) / 0.046, 0.0, 1.0);
              var inwardRad = NEIGHBOR_SYMPATHY_TILT_MAX * tiltRatio * symW;
              symPitch = -(dzHero / dHero) * inwardRad;
              symRoll = -(dxHero / dHero) * inwardRad;
            }
          }

          var magX = liftMagXCur * liftClamped;
          var magZ = liftMagZCur * liftClamped;
          var hoverLiftAmt = isAvail ? CAP_HOVER_LIFT : CAP_HOVER_LIFT * 0.16;
          var waveY = keyWaveDip[i] * unliftedFactor;

          var tx = coord.x + shakeX + magX;
          var ty =
            CAP_Y_BASE +
            coord.rowYBias +
            lift * effortLiftHeightCur +
            symLiftY +
            (zeroGBobCur + gyroClearanceY) * liftClamped +
            waveY -
            press * CAP_PRESS_TRAVEL +
            hover * hoverLiftAmt * (1.0 - liftClamped * 0.7);
          var tz = coord.z + magZ;

          var basePitch = coord.rowPitch * (1.0 - liftClamped * 0.92) + keyWavePitch[i] * unliftedFactor + symPitch;
          var baseRoll = keyWaveRoll[i] * unliftedFactor + symRoll;
          var sUniform = mixScalar(1.0, CAP_SELECT_SCALE, liftClamped);
          var sy = mixScalar(coord.rowScaleY, CAP_SELECT_SCALE, liftClamped);

          var trsRx = basePitch;
          var trsRy = 0;
          var trsRz = baseRoll;
          var trsSx = 1;
          var trsPivot = 0;
          if (lift > 0.005) {
            trsPivot = CAP_HEIGHT * 0.20;
            trsRx = clamp(
              basePitch + (liftPitchCur + gyroPitchCur + zeroGPitchAdd) * liftClamped,
              -26.0 * DEG2RAD,
              26.0 * DEG2RAD
            );
            trsRy = (liftYawCur + gyroYawCur + zeroGYawAdd) * liftClamped;
            trsRz = clamp(
              baseRoll + (liftRollCur + gyroRollCur) * liftClamped,
              -26.0 * DEG2RAD,
              26.0 * DEG2RAD
            );
            trsSx = sUniform;
          }
          var tBase = i * 8;
          var trsChanged =
            keyTrsCache[tBase] !== tx ||
            keyTrsCache[tBase + 1] !== ty ||
            keyTrsCache[tBase + 2] !== tz ||
            keyTrsCache[tBase + 3] !== trsRx ||
            keyTrsCache[tBase + 4] !== trsRy ||
            keyTrsCache[tBase + 5] !== trsRz ||
            keyTrsCache[tBase + 6] !== trsSx ||
            keyTrsCache[tBase + 7] !== sy;
          if (trsChanged) {
            keyTrsCache[tBase] = tx;
            keyTrsCache[tBase + 1] = ty;
            keyTrsCache[tBase + 2] = tz;
            keyTrsCache[tBase + 3] = trsRx;
            keyTrsCache[tBase + 4] = trsRy;
            keyTrsCache[tBase + 5] = trsRz;
            keyTrsCache[tBase + 6] = trsSx;
            keyTrsCache[tBase + 7] = sy;
            if (trsPivot > 0) {
              var rotM = mat4FromTRS(keyLocalMats[i], tx, ty + trsPivot * sy, tz, trsRx, trsRy, trsRz, trsSx, sy, trsSx);
              rotM[12] -= rotM[4] * trsPivot;
              rotM[13] -= rotM[5] * trsPivot;
              rotM[14] -= rotM[6] * trsPivot;
            } else {
              mat4FromTRS(keyLocalMats[i], tx, ty, tz, trsRx, trsRy, trsRz, trsSx, sy, trsSx);
            }
            keyLocalInvValid[i] = 0;
          }
          if (lift > 0.005 && (state.selectedZ === zVal || state.selectedZ === sl.z)) {
            if (!keyLocalInvValid[i]) {
              if (mat4Invert(keyLocalInvMats[i], keyLocalMats[i])) {
                keyLocalInvValid[i] = 1;
              }
            }
            if (keyLocalInvValid[i]) {
              invLiftCapMat.set(keyLocalInvMats[i]);
            }
          }
        }

        /* 5. Compute right 2x3 aux pad 6 keycap local matrices (sharing effort levitation, gyro, magnetic drift & sympathy) */
        if (enableAuxPad) {
          var activeAuxHeroIdx = (state.selectedAuxIndex !== null && state.selectedAuxIndex !== undefined)
            ? clamp(Math.round(Number(state.selectedAuxIndex)), 0, AUX_SLOT_COUNT - 1)
            : -1;
          var auxHeroCoord = (activeAuxHeroIdx >= 0 && auxKeyLiftCur[activeAuxHeroIdx] > 0.02)
            ? auxSlotCoords[activeAuxHeroIdx]
            : null;
          var auxHeroLiftScale = auxHeroCoord ? clamp(auxKeyLiftCur[activeAuxHeroIdx], 0, 1) : 0.0;

          for (var ai = 0; ai < AUX_SLOT_COUNT; ai++) {
            var aSlot = state.auxModels[ai] || DEFAULT_AUX_MODELS[ai];
            var aAvail = Boolean(aSlot && aSlot.available);
            var aCoord = auxSlotCoords[ai];
            var aLift = auxKeyLiftCur[ai];
            var aLiftClamped = clamp(aLift, 0, 1);
            var aLatchAmt = ai === 0 ? clamp(orchLatchCur, 0, 1) : 0.0;
            var aUnlifted = (1.0 - aLiftClamped * 0.88) * (1.0 - aLatchAmt * 0.72);
            var aPress = auxKeyPressCur[ai];
            var aHover = auxKeyHoverCur[ai];

            var aShakeX = 0;
            if (
              state.lockedShakeAuxIndex &&
              typeof state.lockedShakeAuxIndex === 'object' &&
              (state.lockedShakeAuxIndex.auxIndex === ai || state.lockedShakeAuxIndex.index === ai)
            ) {
              var apObj = clamp(Number(state.lockedShakeAuxIndex.progress) || 0, 0, 1);
              aShakeX = Math.sin(apObj * Math.PI * 5.0) * (1.0 - apObj) * 0.082;
            } else if (auxShakeActiveIdx === ai && auxShakeProgress > 0 && auxShakeProgress < 1) {
              aShakeX = Math.sin(auxShakeProgress * Math.PI * 5.0) * (1.0 - auxShakeProgress) * 0.082;
            }

            var aSymLiftY = 0.0;
            var aSymPitch = 0.0;
            var aSymRoll = 0.0;
            if (auxHeroCoord && ai !== activeAuxHeroIdx && neighborSympathyCur > 0.0004 && aLiftClamped < 0.15 && aLatchAmt < 0.05) {
              var adxH = auxHeroCoord.x - aCoord.x;
              var adzH = auxHeroCoord.z - aCoord.z;
              var adH = Math.hypot(adxH, adzH);
              if (adH > 0.05 && adH <= NEIGHBOR_SYMPATHY_RADIUS) {
                var aSymW = smootherstepScalar(NEIGHBOR_SYMPATHY_RADIUS, 0.92, adH) * auxHeroLiftScale * (1.0 - aLiftClamped);
                var aSymBreath = 1.0 + 0.12 * Math.sin(zeroGPhase * 3.1 - adH * 1.4) * effZeroG;
                aSymLiftY = neighborSympathyCur * aSymW * aSymBreath;
                var aTiltRatio = clamp((neighborSympathyCur - 0.030) / 0.046, 0.0, 1.0);
                var aInwardRad = NEIGHBOR_SYMPATHY_TILT_MAX * aTiltRatio * aSymW;
                aSymPitch = -(adzH / adH) * aInwardRad;
                aSymRoll = -(adxH / adH) * aInwardRad;
              }
            }

            var aMagX = liftMagXCur * aLiftClamped;
            var aMagZ = liftMagZCur * aLiftClamped;
            var aHoverAmt = (aAvail ? CAP_HOVER_LIFT : CAP_HOVER_LIFT * 0.16) * (1.0 - aLatchAmt * 0.92);
            var aPressTravel = CAP_PRESS_TRAVEL * (1.0 - aLatchAmt * 0.80);
            var aLatchSinkY = -aLatchAmt * ORCH_LATCH_TRAVEL;
            var aWaveY = (auxKeyWaveDip[ai] + auxPageKeyDip[ai]) * aUnlifted;

            var atx = aCoord.x + aShakeX + aMagX;
            var aty =
              CAP_Y_BASE +
              aCoord.rowYBias +
              aLift * effortLiftHeightCur +
              aLatchSinkY +
              aSymLiftY +
              (zeroGBobCur + gyroClearanceY) * aLiftClamped +
              aWaveY -
              aPress * aPressTravel +
              aHover * aHoverAmt * (1.0 - aLiftClamped * 0.7);
            var atz = aCoord.z + aMagZ;

            var aBasePitch = aCoord.rowPitch * (1.0 - aLiftClamped * 0.92) + (auxKeyWavePitch[ai] + auxPageKeyPitch[ai]) * aUnlifted + aSymPitch;
            var aBaseRoll = auxKeyWaveRoll[ai] * aUnlifted + aSymRoll;
            var asUni = mixScalar(1.0, CAP_SELECT_SCALE, aLiftClamped);
            var asy = mixScalar(aCoord.rowScaleY, CAP_SELECT_SCALE, aLiftClamped);

            var aTrsRx = aBasePitch;
            var aTrsRy = 0;
            var aTrsRz = aBaseRoll;
            var aTrsSx = 1;
            var aTrsPivot = 0;
            if (aLift > 0.005) {
              aTrsPivot = CAP_HEIGHT * 0.20;
              aTrsRx = clamp(
                aBasePitch + (liftPitchCur + gyroPitchCur + zeroGPitchAdd) * aLiftClamped,
                -26.0 * DEG2RAD,
                26.0 * DEG2RAD
              );
              aTrsRy = (liftYawCur + gyroYawCur + zeroGYawAdd) * aLiftClamped;
              aTrsRz = clamp(
                aBaseRoll + (liftRollCur + gyroRollCur) * aLiftClamped,
                -26.0 * DEG2RAD,
                26.0 * DEG2RAD
              );
              aTrsSx = asUni;
            }
            var atBase = ai * 8;
            var aTrsChanged =
              auxKeyTrsCache[atBase] !== atx ||
              auxKeyTrsCache[atBase + 1] !== aty ||
              auxKeyTrsCache[atBase + 2] !== atz ||
              auxKeyTrsCache[atBase + 3] !== aTrsRx ||
              auxKeyTrsCache[atBase + 4] !== aTrsRy ||
              auxKeyTrsCache[atBase + 5] !== aTrsRz ||
              auxKeyTrsCache[atBase + 6] !== aTrsSx ||
              auxKeyTrsCache[atBase + 7] !== asy;
            if (aTrsChanged) {
              auxKeyTrsCache[atBase] = atx;
              auxKeyTrsCache[atBase + 1] = aty;
              auxKeyTrsCache[atBase + 2] = atz;
              auxKeyTrsCache[atBase + 3] = aTrsRx;
              auxKeyTrsCache[atBase + 4] = aTrsRy;
              auxKeyTrsCache[atBase + 5] = aTrsRz;
              auxKeyTrsCache[atBase + 6] = aTrsSx;
              auxKeyTrsCache[atBase + 7] = asy;
              if (aTrsPivot > 0) {
                var aRotM = mat4FromTRS(auxKeyLocalMats[ai], atx, aty + aTrsPivot * asy, atz, aTrsRx, aTrsRy, aTrsRz, aTrsSx, asy, aTrsSx);
                aRotM[12] -= aRotM[4] * aTrsPivot;
                aRotM[13] -= aRotM[5] * aTrsPivot;
                aRotM[14] -= aRotM[6] * aTrsPivot;
              } else {
                mat4FromTRS(auxKeyLocalMats[ai], atx, aty, atz, aTrsRx, aTrsRy, aTrsRz, aTrsSx, asy, aTrsSx);
              }
              auxKeyLocalInvValid[ai] = 0;
            }
            if (aLift > 0.005 && state.selectedAuxIndex === ai) {
              if (!auxKeyLocalInvValid[ai]) {
                if (mat4Invert(auxKeyLocalInvMats[ai], auxKeyLocalMats[ai])) {
                  auxKeyLocalInvValid[ai] = 1;
                }
              }
              if (auxKeyLocalInvValid[ai]) {
                invLiftCapMat.set(auxKeyLocalInvMats[ai]);
              }
            }
          }
        }
      }

      function stepExactSecondOrderSpring(cur, vel, target, wn, zeta, dt) {
        var e0 = cur - target;
        var alpha = zeta * wn;
        var wd = wn * Math.sqrt(Math.max(1e-6, 1.0 - zeta * zeta));
        var expTerm = Math.exp(-alpha * dt);
        var wdDt = wd * dt;
        var cosTerm = Math.cos(wdDt);
        var sinTerm = Math.sin(wdDt);
        var c2 = (vel + alpha * e0) / wd;

        var nextErr = expTerm * (e0 * cosTerm + c2 * sinTerm);
        var nextVel = expTerm * (vel * cosTerm - ((alpha * vel + wn * wn * e0) / wd) * sinTerm);
        var nextCur = target + nextErr;
        var energyErr = Math.abs(nextErr) + Math.abs(nextVel) * 0.085;
        return [nextCur, nextVel, energyErr];
      }

      function stepDampedSpring(cur, vel, target, stiffness, damping, dt) {
        var force = (target - cur) * stiffness;
        var nextVel = (vel + force * dt) * Math.exp(-damping * dt);
        var nextCur = cur + nextVel * dt;
        var err = Math.abs(target - nextCur) + Math.abs(nextVel) * 0.08;
        return [nextCur, nextVel, err];
      }

      function isMagneticSpringAtRest() {
        return (
          Math.abs(liftPitchCur - tgtLiftPitch) < IDLE_EPS &&
          Math.abs(liftRollCur - tgtLiftRoll) < IDLE_EPS &&
          Math.abs(liftYawCur - tgtLiftYaw) < IDLE_EPS &&
          Math.abs(liftMagXCur - tgtLiftMagX) < IDLE_EPS &&
          Math.abs(liftMagZCur - tgtLiftMagZ) < IDLE_EPS &&
          Math.abs(fltLiftPitch - tgtLiftPitch) < IDLE_EPS &&
          Math.abs(fltLiftRoll - tgtLiftRoll) < IDLE_EPS &&
          Math.abs(liftPitchVel) < IDLE_EPS * 8.0 &&
          Math.abs(liftRollVel) < IDLE_EPS * 8.0 &&
          Math.abs(liftYawVel) < IDLE_EPS * 8.0 &&
          Math.abs(liftMagXVel) < IDLE_EPS * 8.0 &&
          Math.abs(liftMagZVel) < IDLE_EPS * 8.0
        );
      }

      function advanceSprings(dtRaw) {
        var dt = clamp(Number(dtRaw) || 0.016, 0.001, 0.05);
        animClockMs += dt * 1000.0;
        var reduced = isMotionReduced();
        var slamGlobal = isConfirmSlamActiveGlobal();

        var prevOrbPitch = orbitPitchCur;
        var prevOrbYaw = orbitYawCur;
        var maxErr = 0;

        /* 1. Step 1:1 tightly coupled orbit servo (wn=38.0, zeta=0.96), momentum coasting (damping=6.0) & dual-pad co-orbit */
        if (reduced) {
          if (orbitMode === 'reset') {
            orbitPitchCur = 0;
            orbitYawCur = 0;
            orbitTargetPitch = 0;
            orbitTargetYaw = 0;
          } else if (orbitServoActive || orbitMode === 'servo') {
            orbitPitchCur = orbitTargetPitch;
            orbitYawCur = orbitTargetYaw;
          }
          orbitServoActive = false;
          orbitPitchVel = 0;
          orbitYawVel = 0;
          orbitMode = 'idle';
          chassisInstVelPitch = 0;
          chassisInstVelYaw = 0;
          auxOrbitPitchCur = orbitPitchCur;
          auxOrbitYawCur = orbitYawCur;
          auxOrbitPitchVel = 0;
          auxOrbitYawVel = 0;
          auxPhaseLiftY = 0;
        } else if (orbitServoActive || orbitMode === 'servo') {
          var svPitch = stepExactSecondOrderSpring(orbitPitchCur, orbitPitchVel, orbitTargetPitch, ORBIT_SERVO_WN, ORBIT_SERVO_ZETA, dt);
          var svYaw = stepExactSecondOrderSpring(orbitYawCur, orbitYawVel, orbitTargetYaw, ORBIT_SERVO_WN, ORBIT_SERVO_ZETA, dt);
          orbitPitchCur = clamp(svPitch[0], ORBIT_PITCH_MIN, ORBIT_PITCH_MAX);
          orbitPitchVel = svPitch[1];
          orbitYawCur = clamp(svYaw[0], -ORBIT_YAW_LIMIT, ORBIT_YAW_LIMIT);
          orbitYawVel = svYaw[1];
          if (svPitch[2] < IDLE_EPS && svYaw[2] < IDLE_EPS) {
            orbitPitchCur = orbitTargetPitch;
            orbitYawCur = orbitTargetYaw;
            orbitPitchVel = 0;
            orbitYawVel = 0;
          } else {
            maxErr = Math.max(maxErr, svPitch[2], svYaw[2]);
          }
        } else if (orbitMode === 'fling') {
          var dampF = Math.exp(-ORBIT_FLING_DAMP * dt);
          orbitPitchCur = clamp(orbitPitchCur + orbitPitchVel * dt, ORBIT_PITCH_MIN, ORBIT_PITCH_MAX);
          orbitYawCur = clamp(orbitYawCur + orbitYawVel * dt, -ORBIT_YAW_LIMIT, ORBIT_YAW_LIMIT);
          if (orbitPitchCur <= ORBIT_PITCH_MIN + 1e-5 || orbitPitchCur >= ORBIT_PITCH_MAX - 1e-5) {
            orbitPitchVel *= 0.22;
          }
          if (Math.abs(orbitYawCur) >= ORBIT_YAW_LIMIT - 1e-5) {
            orbitYawVel *= 0.22;
          }
          orbitPitchVel *= dampF;
          orbitYawVel *= dampF;
          orbitTargetPitch = orbitPitchCur;
          orbitTargetYaw = orbitYawCur;
          var flingSpeed = Math.hypot(orbitPitchVel, orbitYawVel);
          if (flingSpeed < 0.0055) {
            orbitPitchVel = 0;
            orbitYawVel = 0;
            orbitMode = 'idle';
          } else {
            maxErr = Math.max(maxErr, flingSpeed * 0.14);
          }
        } else if (orbitMode === 'reset') {
          var rPitch = stepExactSecondOrderSpring(orbitPitchCur, orbitPitchVel, 0.0, ORBIT_RESET_WN, ORBIT_RESET_ZETA, dt);
          var rYaw = stepExactSecondOrderSpring(orbitYawCur, orbitYawVel, 0.0, ORBIT_RESET_WN, ORBIT_RESET_ZETA, dt);
          orbitPitchCur = rPitch[0];
          orbitPitchVel = rPitch[1];
          orbitYawCur = rYaw[0];
          orbitYawVel = rYaw[1];
          orbitTargetPitch = orbitPitchCur;
          orbitTargetYaw = orbitYawCur;
          if (rPitch[2] < IDLE_EPS && rYaw[2] < IDLE_EPS) {
            orbitPitchCur = 0;
            orbitYawCur = 0;
            orbitTargetPitch = 0;
            orbitTargetYaw = 0;
            orbitPitchVel = 0;
            orbitYawVel = 0;
            orbitMode = 'idle';
          } else {
            maxErr = Math.max(maxErr, rPitch[2], rYaw[2]);
          }
        }

        if (!reduced) {
          chassisInstVelPitch += ((orbitPitchCur - prevOrbPitch) / dt - chassisInstVelPitch) * (1.0 - Math.exp(-24.0 * dt));
          chassisInstVelYaw += ((orbitYawCur - prevOrbYaw) / dt - chassisInstVelYaw) * (1.0 - Math.exp(-24.0 * dt));
          if (Math.abs(chassisInstVelPitch) < 0.002) chassisInstVelPitch = 0;
          if (Math.abs(chassisInstVelYaw) < 0.002) chassisInstVelYaw = 0;

          /* Right 2x3 aux pad co-orbits around shared pivot with ~3.2% zero-G inertial lag, aligning flush at rest */
          var tgtAuxPitch = clamp(
            orbitPitchCur - chassisInstVelPitch * AUX_COORBIT_LAG_RATIO,
            ORBIT_PITCH_MIN,
            ORBIT_PITCH_MAX
          );
          var tgtAuxYaw = clamp(
            orbitYawCur - chassisInstVelYaw * AUX_COORBIT_LAG_RATIO,
            -ORBIT_YAW_LIMIT,
            ORBIT_YAW_LIMIT
          );
          var sAuxP = stepExactSecondOrderSpring(auxOrbitPitchCur, auxOrbitPitchVel, tgtAuxPitch, 28.0, 0.92, dt);
          var sAuxY = stepExactSecondOrderSpring(auxOrbitYawCur, auxOrbitYawVel, tgtAuxYaw, 28.0, 0.92, dt);
          auxOrbitPitchCur = sAuxP[0];
          auxOrbitPitchVel = sAuxP[1];
          auxOrbitYawCur = sAuxY[0];
          auxOrbitYawVel = sAuxY[1];
          auxPhaseLiftY = clamp(-chassisInstVelYaw * 0.015, -0.038, 0.038);
          if (sAuxP[2] < IDLE_EPS && sAuxY[2] < IDLE_EPS && Math.abs(chassisInstVelPitch) < 0.002 && Math.abs(chassisInstVelYaw) < 0.002) {
            auxOrbitPitchCur = orbitPitchCur;
            auxOrbitYawCur = orbitYawCur;
            auxOrbitPitchVel = 0;
            auxOrbitYawVel = 0;
            auxPhaseLiftY = 0;
          } else {
            maxErr = Math.max(maxErr, sAuxP[2], sAuxY[2]);
          }
        }

        /* 1b. Step effort-tier levitation height (0.40U..1.06U) & High/Extra neighbor sympathy (<= 1.65U) */
        effortTierCur = resolveEffortTier(state.deckInfo);
        var effortLiftTarget = EFFORT_TIER_LIFTS[effortTierCur];
        var hasAnyFloating = !slamGlobal && (
          (state.selectedZ !== null && state.selectedZ !== undefined) ||
          (enableAuxPad && state.selectedAuxIndex !== null && state.selectedAuxIndex !== undefined)
        );
        var symTarget = hasAnyFloating ? NEIGHBOR_SYMPATHY_LIFTS[effortTierCur] : 0.0;
        if (reduced) {
          effortLiftHeightCur = effortLiftTarget;
          effortLiftHeightVel = 0;
          neighborSympathyCur = symTarget;
          neighborSympathyVel = 0;
        } else if (slamGlobal) {
          var slamSymAlign = 1.0 - Math.exp(-52.0 * dt);
          effortLiftHeightCur = effortLiftTarget;
          effortLiftHeightVel = 0;
          neighborSympathyCur += (0.0 - neighborSympathyCur) * slamSymAlign;
          neighborSympathyVel = 0;
          if (neighborSympathyCur < IDLE_EPS) neighborSympathyCur = 0.0;
          else maxErr = Math.max(maxErr, neighborSympathyCur);
        } else {
          var sEffH = stepExactSecondOrderSpring(effortLiftHeightCur, effortLiftHeightVel, effortLiftTarget, 20.0, 0.88, dt);
          effortLiftHeightCur = clamp(sEffH[0], 0.24, 1.25);
          effortLiftHeightVel = sEffH[1];

          var sSym = stepExactSecondOrderSpring(neighborSympathyCur, neighborSympathyVel, symTarget, 18.0, 0.88, dt);
          neighborSympathyCur = clamp(sSym[0], 0.0, 0.12);
          neighborSympathyVel = sSym[1];

          maxErr = Math.max(maxErr, sEffH[2], sSym[2]);
        }

        /* 2. Step global animation trio (Intro Wake / 90+6 Key Wave Ripple / Energy Pulse) */
        if (introActive) {
          if (reduced) {
            introActive = false;
            introElapsed = INTRO_WAKE_DURATION;
            sweepWaveWeight = 0.0;
          } else {
            introElapsed += dt;
            if (introElapsed >= INTRO_WAKE_DURATION) {
              introActive = false;
              introElapsed = INTRO_WAKE_DURATION;
              sweepWaveWeight = 0.0;
            } else {
              var wp = clamp(introElapsed / INTRO_WAKE_DURATION, 0, 1);
              sweepWaveX = -12.4 + wp * 27.6;
              sweepWaveWeight = Math.sin(wp * Math.PI);
              maxErr = Math.max(maxErr, 0.05);
            }
          }
        } else {
          sweepWaveWeight = 0.0;
        }

        if (waveRipples.length > 0) {
          if (reduced) {
            waveRipples.length = 0;
          } else {
            for (var rIdx = waveRipples.length - 1; rIdx >= 0; rIdx--) {
              waveRipples[rIdx].elapsed += dt;
              if (waveRipples[rIdx].elapsed >= WAVE_RIPPLE_DURATION) {
                waveRipples.splice(rIdx, 1);
              } else {
                maxErr = Math.max(maxErr, 0.04);
              }
            }
          }
        }

        if (auxPageWaveActive) {
          if (reduced) {
            auxPageWaveActive = false;
            auxPageWaveElapsed = 0;
          } else {
            auxPageWaveElapsed += dt;
            if (auxPageWaveElapsed >= AUX_PAGE_WAVE_DURATION) {
              auxPageWaveActive = false;
              auxPageWaveElapsed = 0;
              shadowDirty = true;
            } else {
              maxErr = Math.max(maxErr, 0.04);
            }
          }
        }

        if (energyPulseActive) {
          if (reduced) {
            energyPulseActive = false;
            energyPulseVal = 0.0;
          } else {
            energyPulseElapsed += dt;
            if (energyPulseElapsed >= ENERGY_PULSE_DURATION) {
              energyPulseActive = false;
              energyPulseElapsed = 0;
              energyPulseVal = 0.0;
            } else {
              var ep = clamp(energyPulseElapsed / ENERGY_PULSE_DURATION, 0, 1);
              energyPulseVal = Math.sin(Math.PI * Math.pow(ep, 0.62)) * (1.0 - ep * 0.24) * energyPulseAmp;
              maxErr = Math.max(maxErr, 0.03);
            }
          }
        } else {
          energyPulseVal = 0.0;
        }

        /* 3. Step levitated keycap antigravity gyro (~40% world-up counter-balance) & zero-G slow float (~2.46s -> 0fps) */
        var tgtGyroPitch = 0;
        var tgtGyroRoll = 0;
        var tgtGyroYaw = 0;
        var refOrbPitch = (enableAuxPad && state.selectedAuxIndex !== null && state.selectedAuxIndex !== undefined)
          ? auxOrbitPitchCur
          : orbitPitchCur;
        var refOrbYaw = (enableAuxPad && state.selectedAuxIndex !== null && state.selectedAuxIndex !== undefined)
          ? auxOrbitYawCur
          : orbitYawCur;
        if (!slamGlobal && Math.hypot(refOrbPitch, refOrbYaw) > 1e-4) {
          var cyO = Math.cos(refOrbYaw), syO = Math.sin(refOrbYaw);
          var cxO = Math.cos(refOrbPitch), sxO = Math.sin(refOrbPitch);
          var upLx = syO * sxO;
          var upLy = cxO;
          var upLz = -cyO * sxO;
          tgtGyroPitch = clamp(
            Math.atan2(upLz, Math.max(0.25, upLy)) * GYRO_COUNTER_RATIO - chassisInstVelPitch * 0.048,
            -GYRO_COUNTER_MAX_RAD,
            GYRO_COUNTER_MAX_RAD
          );
          tgtGyroRoll = clamp(
            -Math.atan2(upLx, Math.max(0.25, upLy)) * GYRO_COUNTER_RATIO + chassisInstVelYaw * 0.044,
            -GYRO_COUNTER_MAX_RAD,
            GYRO_COUNTER_MAX_RAD
          );
          tgtGyroYaw = clamp(-refOrbYaw * 0.16 - chassisInstVelYaw * 0.030, -0.24, 0.24);
        }

        if (reduced || slamGlobal) {
          var gAlign = reduced ? 1.0 : 1.0 - Math.exp(-45.0 * dt);
          gyroPitchCur += (0 - gyroPitchCur) * gAlign;
          gyroRollCur += (0 - gyroRollCur) * gAlign;
          gyroYawCur += (0 - gyroYawCur) * gAlign;
          gyroPitchVel = 0; gyroRollVel = 0; gyroYawVel = 0;
          zeroGRemainSec = 0;
          zeroGEnvCur = 0;
        } else {
          var gP = stepExactSecondOrderSpring(gyroPitchCur, gyroPitchVel, tgtGyroPitch, 16.0, 0.82, dt);
          var gR = stepExactSecondOrderSpring(gyroRollCur, gyroRollVel, tgtGyroRoll, 16.0, 0.82, dt);
          var gY = stepExactSecondOrderSpring(gyroYawCur, gyroYawVel, tgtGyroYaw, 16.0, 0.82, dt);
          gyroPitchCur = gP[0]; gyroPitchVel = gP[1];
          gyroRollCur = gR[0]; gyroRollVel = gR[1];
          gyroYawCur = gY[0]; gyroYawVel = gY[1];
          maxErr = Math.max(maxErr, gP[2], gR[2], gY[2]);

          if (zeroGRemainSec > 0) {
            zeroGRemainSec = Math.max(0, zeroGRemainSec - dt);
            zeroGEnvCur = smootherstepScalar(0.0, 0.68, zeroGRemainSec);
            zeroGPhase += dt * (0.45 + 0.55 * zeroGEnvCur);
            fluxPhase += dt * (0.85 + effortTierCur * 0.16 + energyPulseVal * 1.6);
            if (zeroGRemainSec > 0) {
              maxErr = Math.max(maxErr, 0.005);
            }
          } else {
            zeroGEnvCur = 0;
            if (energyPulseActive || introActive || orbitMode !== 'idle') {
              fluxPhase += dt * (0.95 + effortTierCur * 0.16 + energyPulseVal * 1.6);
            }
          }
        }

        /* 4. Step stage-2 heavy damped near-field magnetic spring (shared by main & aux levitated keys) */
        recomputePointerTargets();

        if (reduced) {
          fltLiftYaw = tgtLiftYaw;
          fltLiftPitch = tgtLiftPitch;
          fltLiftRoll = tgtLiftRoll;
          fltLiftMagX = tgtLiftMagX;
          fltLiftMagZ = tgtLiftMagZ;
          liftYawCur = tgtLiftYaw;
          liftPitchCur = tgtLiftPitch;
          liftRollCur = tgtLiftRoll;
          liftMagXCur = tgtLiftMagX;
          liftMagZCur = tgtLiftMagZ;
          liftYawVel = 0;
          liftPitchVel = 0;
          liftRollVel = 0;
          liftMagXVel = 0;
          liftMagZVel = 0;
        } else if (slamGlobal) {
          var slamAlign = 1.0 - Math.exp(-48.0 * dt);
          fltLiftYaw = 0; fltLiftPitch = 0; fltLiftRoll = 0; fltLiftMagX = 0; fltLiftMagZ = 0;
          liftYawCur += (0 - liftYawCur) * slamAlign;
          liftPitchCur += (0 - liftPitchCur) * slamAlign;
          liftRollCur += (0 - liftRollCur) * slamAlign;
          liftMagXCur += (0 - liftMagXCur) * slamAlign;
          liftMagZCur += (0 - liftMagZCur) * slamAlign;
          liftYawVel = 0; liftPitchVel = 0; liftRollVel = 0; liftMagXVel = 0; liftMagZVel = 0;
          maxErr = Math.max(
            maxErr,
            Math.abs(liftPitchCur),
            Math.abs(liftRollCur),
            Math.abs(liftMagXCur),
            Math.abs(liftMagZCur)
          );
        } else {
          if (nearTrackingActive && pointerMode === 'client') {
            var alphaIn = 1.0 - Math.exp(-dt / INPUT_SMOOTH_TAU);
            fltLiftPitch += (tgtLiftPitch - fltLiftPitch) * alphaIn;
            fltLiftRoll += (tgtLiftRoll - fltLiftRoll) * alphaIn;
            fltLiftYaw += (tgtLiftYaw - fltLiftYaw) * alphaIn;
            fltLiftMagX += (tgtLiftMagX - fltLiftMagX) * alphaIn;
            fltLiftMagZ += (tgtLiftMagZ - fltLiftMagZ) * alphaIn;
          } else {
            fltLiftPitch = tgtLiftPitch;
            fltLiftRoll = tgtLiftRoll;
            fltLiftYaw = tgtLiftYaw;
            fltLiftMagX = tgtLiftMagX;
            fltLiftMagZ = tgtLiftMagZ;
          }

          var sPitch = stepExactSecondOrderSpring(liftPitchCur, liftPitchVel, fltLiftPitch, TILT_SPRING_WN, TILT_SPRING_ZETA, dt);
          liftPitchCur = clamp(sPitch[0], -CAP_TILT_MAX_RAD * 1.15, CAP_TILT_MAX_RAD * 1.15);
          liftPitchVel = sPitch[1];

          var sRoll = stepExactSecondOrderSpring(liftRollCur, liftRollVel, fltLiftRoll, TILT_SPRING_WN, TILT_SPRING_ZETA, dt);
          liftRollCur = clamp(sRoll[0], -CAP_TILT_MAX_RAD * 1.15, CAP_TILT_MAX_RAD * 1.15);
          liftRollVel = sRoll[1];

          var sYaw = stepExactSecondOrderSpring(liftYawCur, liftYawVel, fltLiftYaw, TILT_SPRING_WN, TILT_SPRING_ZETA, dt);
          liftYawCur = clamp(sYaw[0], -CAP_YAW_MAX_RAD * 1.15, CAP_YAW_MAX_RAD * 1.15);
          liftYawVel = sYaw[1];

          var driftLim = pointerMode === 'norm' ? CAP_NORM_DRIFT_COMPAT * 1.15 : CAP_MAGNETIC_DRIFT * 1.15;
          var sMagX = stepExactSecondOrderSpring(liftMagXCur, liftMagXVel, fltLiftMagX, DRIFT_SPRING_WN, DRIFT_SPRING_ZETA, dt);
          liftMagXCur = clamp(sMagX[0], -driftLim, driftLim);
          liftMagXVel = sMagX[1];

          var sMagZ = stepExactSecondOrderSpring(liftMagZCur, liftMagZVel, fltLiftMagZ, DRIFT_SPRING_WN, DRIFT_SPRING_ZETA, dt);
          liftMagZCur = clamp(sMagZ[0], -driftLim, driftLim);
          liftMagZVel = sMagZ[1];

          var fltResidual = Math.max(
            Math.abs(tgtLiftPitch - fltLiftPitch),
            Math.abs(tgtLiftRoll - fltLiftRoll),
            Math.abs(tgtLiftMagX - fltLiftMagX),
            Math.abs(tgtLiftMagZ - fltLiftMagZ)
          );
          maxErr = Math.max(maxErr, sPitch[2], sRoll[2], sYaw[2], sMagX[2], sMagZ[2], fltResidual);
        }

        var expFast = reduced ? 1.0 : 1.0 - Math.exp(-28.0 * dt);
        var expSlamPress = reduced ? 1.0 : 1.0 - Math.exp(-52.0 * dt);
        var expHover = reduced ? 1.0 : 1.0 - Math.exp(-20.0 * dt);
        var expAvailDim = reduced ? 1.0 : 1.0 - Math.exp(-AVAIL_DIM_RATE * dt);

        /* 4.0 V12 #0 Orch mechanical latch-down detent spring step */
        var wantOrchLatch = state.orchLatched ? 1.0 : 0.0;
        if (reduced) {
          orchLatchCur = wantOrchLatch;
          orchLatchVel = 0;
        } else {
          var sLatch = stepExactSecondOrderSpring(orchLatchCur, orchLatchVel, wantOrchLatch, ORCH_LATCH_WN, ORCH_LATCH_ZETA, dt);
          orchLatchCur = clamp(sLatch[0], 0.0, 1.04);
          orchLatchVel = sLatch[1];
          if (sLatch[2] < IDLE_EPS) {
            orchLatchCur = wantOrchLatch;
            orchLatchVel = 0;
          } else {
            maxErr = Math.max(maxErr, sLatch[2]);
          }
        }

        /* 4a. 90 main keycap lift/press/hover springs + ~14/s availability dim transition + tactile blind key press travel */
        var blindTapPulse = 0;
        if (blindTapIdx >= 0 && blindTapRemain > 0) {
          if (reduced) {
            blindTapRemain = 0;
            blindTapIdx = -1;
          } else {
            blindTapRemain = Math.max(0, blindTapRemain - dt);
            var btNorm = 1.0 - blindTapRemain / BLIND_TAP_DURATION;
            blindTapPulse = Math.sin(clamp(btNorm, 0, 1) * Math.PI);
            if (blindTapRemain > 0) {
              maxErr = Math.max(maxErr, 0.03);
            } else {
              blindTapIdx = -1;
            }
          }
        }
        for (var i = 0; i < slotCount; i++) {
          var sl = slots[i];
          var zVal = sl.slotZ !== undefined ? sl.slotZ : sl.z;
          var isAvail = isSlotAvailable(zVal) || isSlotAvailable(sl.z);
          var wantSlotAvail = isAvail ? 1.0 : 0.0;
          var isSlam = isSlotConfirmSlamming(zVal, sl.z);
          var isSelected = state.selectedZ === zVal || state.selectedZ === sl.z;
          var wantLift = (isSelected && !isSlam) ? 1.0 : 0.0;
          var tapAdd = (blindTapIdx === i && !isAvail) ? blindTapPulse * 0.72 : 0.0;
          var wantPress = isSlam
            ? 1.0
            : Math.max(
                (state.pressedZ === zVal || state.pressedZ === sl.z) ? (isAvail ? 1.0 : 0.72) : 0.0,
                tapAdd
              );
          var wantHover = (!isSlam && (state.hoveredZ === zVal || state.hoveredZ === sl.z)) ? 1.0 : 0.0;

          if (reduced) {
            slotAvailCur[i] = wantSlotAvail;
            keyLiftCur[i] = wantLift;
            keyLiftVel[i] = 0;
            keyPressCur[i] = wantPress;
            keyHoverCur[i] = wantHover;
          } else {
            slotAvailCur[i] += (wantSlotAvail - slotAvailCur[i]) * expAvailDim;
            var avDiff = Math.abs(wantSlotAvail - slotAvailCur[i]);
            if (avDiff < 0.0018) {
              slotAvailCur[i] = wantSlotAvail;
            } else {
              maxErr = Math.max(maxErr, avDiff);
            }

            if (isSlam) {
              var slStep = stepExactSecondOrderSpring(keyLiftCur[i], keyLiftVel[i], 0.0, SLAM_SPRING_WN, SLAM_SPRING_ZETA, dt);
              if (slStep[0] <= 0.002) {
                keyLiftCur[i] = 0.0;
                keyLiftVel[i] = 0.0;
              } else {
                keyLiftCur[i] = slStep[0];
                keyLiftVel[i] = slStep[1];
                maxErr = Math.max(maxErr, slStep[2]);
              }
              keyPressCur[i] += (1.0 - keyPressCur[i]) * expSlamPress;
              maxErr = Math.max(maxErr, Math.abs(1.0 - keyPressCur[i]));
              keyHoverCur[i] += (0.0 - keyHoverCur[i]) * expFast;
            } else {
              var kl = stepDampedSpring(keyLiftCur[i], keyLiftVel[i], wantLift, 210, 24, dt);
              keyLiftCur[i] = clamp(kl[0], 0, 1.06);
              keyLiftVel[i] = kl[1];
              maxErr = Math.max(maxErr, kl[2]);

              keyPressCur[i] += (wantPress - keyPressCur[i]) * expFast;
              maxErr = Math.max(maxErr, Math.abs(wantPress - keyPressCur[i]));

              keyHoverCur[i] += (wantHover - keyHoverCur[i]) * expHover;
              maxErr = Math.max(maxErr, Math.abs(wantHover - keyHoverCur[i]));
            }
          }
        }

        /* 4b. Right 2x3 aux pad 6 keycap lift / latch-no-levitate / availability dim springs */
        if (enableAuxPad) {
          for (var ai = 0; ai < AUX_SLOT_COUNT; ai++) {
            var aSlot = state.auxModels[ai] || DEFAULT_AUX_MODELS[ai];
            var aAvail = Boolean(aSlot && aSlot.available);
            var aWantAvail = aAvail ? 1.0 : 0.0;
            var aSlam = isAuxSlotConfirmSlamming(ai);
            var aSel = state.selectedAuxIndex === ai && !(ai === 0 && state.orchLatched);
            var aWantLift = (aSel && !aSlam) ? 1.0 : 0.0;
            var aWantPress = aSlam
              ? 1.0
              : (state.pressedAuxIndex === ai ? (aAvail ? 1.0 : 0.28) : 0.0);
            var aWantHover = (!aSlam && state.hoveredAuxIndex === ai) ? 1.0 : 0.0;

            if (reduced) {
              auxAvailCur[ai] = aWantAvail;
              auxKeyLiftCur[ai] = aWantLift;
              auxKeyLiftVel[ai] = 0;
              auxKeyPressCur[ai] = aWantPress;
              auxKeyHoverCur[ai] = aWantHover;
            } else {
              auxAvailCur[ai] += (aWantAvail - auxAvailCur[ai]) * expAvailDim;
              var aAvDiff = Math.abs(aWantAvail - auxAvailCur[ai]);
              if (aAvDiff < 0.0018) {
                auxAvailCur[ai] = aWantAvail;
              } else {
                maxErr = Math.max(maxErr, aAvDiff);
              }

              if (aSlam) {
                var aSlStep = stepExactSecondOrderSpring(auxKeyLiftCur[ai], auxKeyLiftVel[ai], 0.0, SLAM_SPRING_WN, SLAM_SPRING_ZETA, dt);
                if (aSlStep[0] <= 0.002) {
                  auxKeyLiftCur[ai] = 0.0;
                  auxKeyLiftVel[ai] = 0.0;
                } else {
                  auxKeyLiftCur[ai] = aSlStep[0];
                  auxKeyLiftVel[ai] = aSlStep[1];
                  maxErr = Math.max(maxErr, aSlStep[2]);
                }
                auxKeyPressCur[ai] += (1.0 - auxKeyPressCur[ai]) * expSlamPress;
                maxErr = Math.max(maxErr, Math.abs(1.0 - auxKeyPressCur[ai]));
                auxKeyHoverCur[ai] += (0.0 - auxKeyHoverCur[ai]) * expFast;
              } else {
                var akl = stepDampedSpring(auxKeyLiftCur[ai], auxKeyLiftVel[ai], aWantLift, 210, 24, dt);
                auxKeyLiftCur[ai] = clamp(akl[0], 0, 1.06);
                auxKeyLiftVel[ai] = akl[1];
                maxErr = Math.max(maxErr, akl[2]);

                auxKeyPressCur[ai] += (aWantPress - auxKeyPressCur[ai]) * expFast;
                maxErr = Math.max(maxErr, Math.abs(aWantPress - auxKeyPressCur[ai]));

                auxKeyHoverCur[ai] += (aWantHover - auxKeyHoverCur[ai]) * expHover;
                maxErr = Math.max(maxErr, Math.abs(aWantHover - auxKeyHoverCur[ai]));
              }
            }
          }
        }

        var info = state.deckInfo;
        var levels = info && Array.isArray(info.levels) ? info.levels : [];
        for (var ei = 0; ei < 8; ei++) {
          var lv = levels[ei];
          var wEp = lv && info.pressedEffort === lv.effort ? 1.0 : 0.0;
          var wEh = lv && info.hoveredEffort === lv.effort ? 1.0 : 0.0;
          effortPressCur[ei] += (wEp - effortPressCur[ei]) * expFast;
          effortHoverCur[ei] += (wEh - effortHoverCur[ei]) * expHover;
          maxErr = Math.max(maxErr, Math.abs(wEp - effortPressCur[ei]), Math.abs(wEh - effortHoverCur[ei]));
        }

        /* 5. Step Row 1 4 hardware control press/hover springs & knurled rotary knob angle spring */
        var hwSt = state.hardwareState || {};
        var hovCtrlIdx = resolveControlIndex(hwSt.hoveredControl);
        var prsCtrlIdx = resolveControlIndex(hwSt.pressedControl);
        for (var ci = 0; ci < 4; ci++) {
          var wantCHov = hovCtrlIdx === ci ? 1.0 : 0.0;
          var pulseAdd = 0.0;
          if (ctrlPulseRemain[ci] > 0) {
            if (reduced) {
              ctrlPulseRemain[ci] = 0;
            } else {
              ctrlPulseRemain[ci] = Math.max(0, ctrlPulseRemain[ci] - dt);
              var pNorm = 1.0 - ctrlPulseRemain[ci] / CTRL_PULSE_DURATION;
              pulseAdd = Math.sin(clamp(pNorm, 0, 1) * Math.PI);
              if (ctrlPulseRemain[ci] > 0) {
                maxErr = Math.max(maxErr, 0.03);
              }
            }
          }
          var wantCPrs = Math.max(prsCtrlIdx === ci ? 1.0 : 0.0, pulseAdd);
          if (reduced) {
            ctrlHoverCur[ci] = wantCHov;
            ctrlPressCur[ci] = prsCtrlIdx === ci ? 1.0 : 0.0;
          } else {
            ctrlHoverCur[ci] += (wantCHov - ctrlHoverCur[ci]) * expHover;
            ctrlPressCur[ci] += (wantCPrs - ctrlPressCur[ci]) * expFast;
            maxErr = Math.max(
              maxErr,
              Math.abs(wantCHov - ctrlHoverCur[ci]),
              Math.abs(wantCPrs - ctrlPressCur[ci])
            );
          }
        }

        knobAngleTarget = (hwSt.muted ? 0.48 : -0.38) + knobSpinOffset;
        if (reduced) {
          knobAngleCur = knobAngleTarget;
          knobAngleVel = 0;
        } else {
          var sKnob = stepExactSecondOrderSpring(knobAngleCur, knobAngleVel, knobAngleTarget, 24.0, 0.82, dt);
          knobAngleCur = sKnob[0];
          knobAngleVel = sKnob[1];
          maxErr = Math.max(maxErr, sKnob[2]);
        }

        if (state.lockedShakeZ && state.lockedShakeZ.progress > 0 && state.lockedShakeZ.progress < 1) {
          maxErr = Math.max(maxErr, 0.02);
        }
        if (
          state.lockedShakeAuxIndex &&
          typeof state.lockedShakeAuxIndex === 'object' &&
          state.lockedShakeAuxIndex.progress > 0 &&
          state.lockedShakeAuxIndex.progress < 1
        ) {
          maxErr = Math.max(maxErr, 0.02);
        }
        if (auxShakeActiveIdx >= 0 && auxShakeProgress < 1.0) {
          if (reduced) {
            auxShakeProgress = 1.0;
            auxShakeActiveIdx = -1;
          } else {
            auxShakeProgress += dt * 6.4;
            if (auxShakeProgress >= 1.0) {
              auxShakeProgress = 1.0;
              auxShakeActiveIdx = -1;
            } else {
              maxErr = Math.max(maxErr, 0.02);
            }
          }
        }

        var painter = ensureOledPainter();
        var oledAnimating = Boolean(
          !reduced &&
          painter &&
          typeof painter.isAnimating === 'function' &&
          painter.isAnimating(animClockMs)
        );
        if (oledAnimating || oledPendingFlush) {
          maxErr = Math.max(maxErr, 0.01);
        }

        if (maxErr < IDLE_EPS) {
          fltLiftYaw = tgtLiftYaw;
          fltLiftPitch = tgtLiftPitch;
          fltLiftRoll = tgtLiftRoll;
          fltLiftMagX = tgtLiftMagX;
          fltLiftMagZ = tgtLiftMagZ;
          liftYawCur = tgtLiftYaw;
          liftPitchCur = tgtLiftPitch;
          liftRollCur = tgtLiftRoll;
          liftMagXCur = tgtLiftMagX;
          liftMagZCur = tgtLiftMagZ;
          liftYawVel = 0;
          liftPitchVel = 0;
          liftRollVel = 0;
          liftMagXVel = 0;
          liftMagZVel = 0;

          gyroPitchCur = tgtGyroPitch;
          gyroRollCur = tgtGyroRoll;
          gyroYawCur = tgtGyroYaw;
          gyroPitchVel = 0;
          gyroRollVel = 0;
          gyroYawVel = 0;
          zeroGRemainSec = 0;
          zeroGEnvCur = 0;
          chassisInstVelPitch = 0;
          chassisInstVelYaw = 0;

          auxOrbitPitchCur = orbitPitchCur;
          auxOrbitYawCur = orbitYawCur;
          auxOrbitPitchVel = 0;
          auxOrbitYawVel = 0;
          auxPhaseLiftY = 0;

          effortLiftHeightCur = effortLiftTarget;
          effortLiftHeightVel = 0;
          neighborSympathyCur = symTarget;
          neighborSympathyVel = 0;
          orchLatchCur = wantOrchLatch;
          orchLatchVel = 0;
          auxShakeProgress = 1.0;
          auxShakeActiveIdx = -1;

          for (var k = 0; k < slotCount; k++) {
            var slk = slots[k];
            var zk = slk.slotZ !== undefined ? slk.slotZ : slk.z;
            var avk = isSlotAvailable(zk) || isSlotAvailable(slk.z);
            var slamK = isSlotConfirmSlamming(zk, slk.z);
            var selK = state.selectedZ === zk || state.selectedZ === slk.z;
            slotAvailCur[k] = avk ? 1.0 : 0.0;
            keyLiftCur[k] = (selK && !slamK) ? 1.0 : 0.0;
            keyLiftVel[k] = 0;
            keyPressCur[k] = slamK
              ? 1.0
              : ((state.pressedZ === zk || state.pressedZ === slk.z) ? (avk ? 1.0 : 0.28) : 0.0);
            keyHoverCur[k] = (!slamK && (state.hoveredZ === zk || state.hoveredZ === slk.z)) ? 1.0 : 0.0;
          }
          if (enableAuxPad) {
            for (var ak = 0; ak < AUX_SLOT_COUNT; ak++) {
              var aSlk = state.auxModels[ak] || DEFAULT_AUX_MODELS[ak];
              var aAvk = Boolean(aSlk && aSlk.available);
              var aSlamK = isAuxSlotConfirmSlamming(ak);
              var aSelK = state.selectedAuxIndex === ak && !(ak === 0 && state.orchLatched);
              auxAvailCur[ak] = aAvk ? 1.0 : 0.0;
              auxKeyLiftCur[ak] = (aSelK && !aSlamK) ? 1.0 : 0.0;
              auxKeyLiftVel[ak] = 0;
              auxKeyPressCur[ak] = aSlamK
                ? 1.0
                : (state.pressedAuxIndex === ak ? (aAvk ? 1.0 : 0.28) : 0.0);
              auxKeyHoverCur[ak] = (!aSlamK && state.hoveredAuxIndex === ak) ? 1.0 : 0.0;
            }
          }
          for (var ek = 0; ek < 8; ek++) {
            var lvk = levels[ek];
            effortPressCur[ek] = lvk && info.pressedEffort === lvk.effort ? 1.0 : 0.0;
            effortHoverCur[ek] = lvk && info.hoveredEffort === lvk.effort ? 1.0 : 0.0;
          }
          for (var ck = 0; ck < 4; ck++) {
            ctrlHoverCur[ck] = hovCtrlIdx === ck ? 1.0 : 0.0;
            ctrlPressCur[ck] = prsCtrlIdx === ck ? 1.0 : 0.0;
            ctrlPulseRemain[ck] = 0;
          }
          knobAngleCur = knobAngleTarget;
          knobAngleVel = 0;
          auxPageWaveActive = false;
          auxPageWaveElapsed = 0;
          idle = true;
        } else {
          idle = false;
        }

        updateTransforms();
      }

      /* ============================================================================
       * 10. WebGL2 Multi-Pass Hardware Renderer (Batched Shadows + Main/Aux CNC Chassis + Screen + 90+6 Keys + Micro-Crystals)
       * ============================================================================ */
      function uploadSolidMesh(gpuTarget, mesh, usage) {
        var canSub = usage === gl.DYNAMIC_DRAW && typeof gl.bufferSubData === 'function';
        function uploadAttrBuf(target, buf, data, capKey) {
          gl.bindBuffer(target, buf);
          var bytes = data && typeof data.byteLength === 'number' ? data.byteLength : 0;
          if (canSub && bytes > 0 && gpuTarget[capKey] >= bytes) {
            gl.bufferSubData(target, 0, data);
          } else {
            gl.bufferData(target, data, usage);
            gpuTarget[capKey] = bytes;
          }
        }
        uploadAttrBuf(gl.ARRAY_BUFFER, gpuTarget.bPos, mesh.positions, 'capPos');
        uploadAttrBuf(gl.ARRAY_BUFFER, gpuTarget.bNorm, mesh.normals, 'capNorm');
        uploadAttrBuf(gl.ARRAY_BUFFER, gpuTarget.bCol, mesh.colors, 'capCol');
        uploadAttrBuf(gl.ARRAY_BUFFER, gpuTarget.bParam, mesh.params, 'capParam');
        uploadAttrBuf(gl.ARRAY_BUFFER, gpuTarget.bUv, mesh.uvs, 'capUv');
        uploadAttrBuf(gl.ELEMENT_ARRAY_BUFFER, gpuTarget.bIdx, mesh.indices, 'capIdx');
        gpuTarget.count = mesh.indexCount;
        gpuTarget.mainCount = mesh.mainIndexCount !== undefined ? mesh.mainIndexCount : mesh.indexCount;
        gpuTarget.auxCount = mesh.auxIndexCount || 0;
        gpuTarget.opaqueCount = mesh.opaqueIndexCount !== undefined ? mesh.opaqueIndexCount : mesh.indexCount;
        gpuTarget.mainOpaqueCount = mesh.mainOpaqueCount !== undefined ? mesh.mainOpaqueCount : gpuTarget.opaqueCount;
        gpuTarget.auxOpaqueCount = mesh.auxOpaqueCount || 0;
        gpuTarget.fluxCount = mesh.fluxIndexCount || 0;
        gpuTarget.mainFluxCount = mesh.mainFluxCount !== undefined ? mesh.mainFluxCount : gpuTarget.fluxCount;
        gpuTarget.auxFluxCount = mesh.auxFluxCount || 0;
      }

      function resolveActiveSwitchInfo(palette) {
        var bestIdx = -1;
        var bestIsAux = false;
        var bestLift = 0.02;
        for (var i = 0; i < slotCount; i++) {
          if (keyLiftCur[i] > bestLift) {
            bestLift = keyLiftCur[i];
            bestIdx = i;
            bestIsAux = false;
          }
        }
        if (enableAuxPad) {
          for (var ai = 0; ai < AUX_SLOT_COUNT; ai++) {
            if (auxKeyLiftCur[ai] > bestLift) {
              bestLift = auxKeyLiftCur[ai];
              bestIdx = ai;
              bestIsAux = true;
            }
          }
        }
        if (bestIdx < 0) return null;
        var lc = clamp(bestLift, 0, 1);

        if (bestIsAux) {
          var auxSlot = state.auxModels[bestIdx] || DEFAULT_AUX_MODELS[bestIdx] || DEFAULT_AUX_MODELS[0];
          var aCoord = auxSlotCoords[bestIdx];
          var akc = resolveAuxKeyColors(auxSlot, bestIdx, palette, lc);
          return {
            isAux: true,
            auxIndex: bestIdx,
            slotIndex: slotCount + bestIdx,
            x: aCoord.x,
            z: aCoord.z,
            capX: aCoord.x + liftMagXCur * lc,
            capZ: aCoord.z + liftMagZCur * lc,
            lift: lc,
            capRgb: akc.capRgb || hexToRgb01(akc.cap),
            stemRgb: hexToRgb01(akc.stem),
            stemTopRgb: hexToRgb01(akc.stemTop || akc.led),
            ledRgb: hexToRgb01(akc.led),
            secondaryRgb: akc.secondaryRgb || hexToRgb01(akc.led),
          };
        }

        var sl = slots[bestIdx];
        var coord = slotCoords[bestIdx];
        var zVal = sl.slotZ !== undefined ? sl.slotZ : sl.z;
        var isAvail = isSlotAvailable(zVal) || isSlotAvailable(sl.z);
        var kc = resolveKeyColors(sl, palette, isAvail);
        return {
          isAux: false,
          z: zVal,
          slotIndex: bestIdx,
          x: coord.x,
          z: coord.z,
          capX: coord.x + liftMagXCur * lc,
          capZ: coord.z + liftMagZCur * lc,
          lift: lc,
          capRgb: kc.capRgb || hexToRgb01(kc.cap),
          stemRgb: hexToRgb01(kc.stem),
          stemTopRgb: hexToRgb01(kc.stemTop || kc.led),
          ledRgb: hexToRgb01(kc.led),
        };
      }

      /**
       * When state.auxModels changes, redraws the 6 aux slots into atlas spare row 9
       * and uploads via partial gl.texSubImage2D (zero new texture objects)
       */
      function syncAuxAtlasTexture() {
        if (!enableAuxPad) return;
        var parts = [];
        for (var k = 0; k < AUX_SLOT_COUNT; k++) {
          var s = state.auxModels[k] || DEFAULT_AUX_MODELS[k];
          parts.push(
            s.id + ':' + s.shortLabel + ':' + s.subLabel + ':' + s.badgeCode + ':' + (s.available ? 1 : 0)
          );
        }
        var sig = parts.join('|');
        if (sig === lastAuxAtlasSig) return;
        lastAuxAtlasSig = sig;

        if (atlasSurf && atlasSurf.ctx) {
          renderAuxAtlasCellsToContext(atlasSurf.ctx, state.auxModels, false);
        }
        var useSubTex = Boolean(gl && glObjs && glObjs.atlasTex && typeof gl.texSubImage2D === 'function');
        var stripSurf = useSubTex ? ensureAuxStripSurf() : auxStripSurf;
        if (stripSurf && stripSurf.ctx) {
          renderAuxAtlasCellsToContext(stripSurf.ctx, state.auxModels, true);
        }
        if (gl && glObjs && glObjs.atlasTex) {
          gl.bindTexture(gl.TEXTURE_2D, glObjs.atlasTex);
          gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
          if (useSubTex && stripSurf && stripSurf.canvas) {
            gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, AUX_ATLAS_Y0, gl.RGBA, gl.UNSIGNED_BYTE, stripSurf.canvas);
          } else if (atlasSurf && atlasSurf.canvas) {
            gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, atlasSurf.canvas);
          }
          if (typeof gl.generateMipmap === 'function') {
            gl.generateMipmap(gl.TEXTURE_2D);
          }
        }
      }

      function syncOffscreenTextures(palette, accentHex) {
        var tp = state.themeProfile || {};
        var di = state.deckInfo || {};
        var painter = ensureOledPainter();
        var rimToneKey = resolveRimToneKey(palette);

        var lvSig = '';
        if (Array.isArray(di.levels)) {
          var parts = [];
          for (var i = 0; i < di.levels.length && i < 8; i++) {
            var lv = di.levels[i];
            var qPrs = Math.round((effortPressCur[i] || 0) * 16);
            var qHov = Math.round((effortHoverCur[i] || 0) * 16);
            parts.push(lv.effort + ':' + lv.label + ':' + (lv.active ? 1 : 0) + ':' + qHov + ':' + qPrs);
          }
          lvSig = parts.join(',');
        }

        var reducedNow = isMotionReduced();
        var isPainterAnim = Boolean(
          !reducedNow &&
          painter &&
          typeof painter.isAnimating === 'function' &&
          painter.isAnimating(animClockMs)
        );
        /* V14 static-first art: skip redundant OLED redraws at rest; refresh only on model/theme crossfade, slider motion, or state change */
        var continuousZeroGOled = false;

        var oledSig = [
          painter ? 'cyber' : 'builtin',
          palette.id,
          Boolean(palette.isLight),
          Boolean(tp.isMono),
          rimToneKey,
          accentHex,
          Boolean(di.isAuxModel),
          di.auxId || '',
          di.auxKind || '',
          di.badgeText || '',
          di.z,
          di.numLabel,
          di.symbol,
          di.mass,
          di.groupCode,
          di.title,
          di.subtitle,
          di.chemLabel,
          di.sessionBanner,
          di.blindFlash ? 1 : 0,
          di.blindFlashBanner || '',
          di.isAvailable,
          di.unreleasedText,
          di.effortTitle,
          di.activeEffort || '',
          effortTierCur,
          di.hoveredEffort || '',
          di.pressedEffort || '',
          di.orchLatched ? 1 : 0,
          di.orchUnsupported ? 1 : 0,
          lvSig,
        ].join('|');

        var coreOledSig = [
          painter ? 'cyber' : 'builtin',
          palette.id,
          Boolean(palette.isLight),
          Boolean(tp.isMono),
          rimToneKey,
          state.selectedZ,
          state.selectedAuxIndex,
          di.activeEffort || '',
          effortTierCur,
          di.orchLatched ? 1 : 0,
          di.blindFlash ? 1 : 0,
          di.sessionBanner || '',
        ].join('|');

        var stateSwitched = oledSig !== lastOledDiscreteSig || lastOledSig === '';
        var coreChanged = coreOledSig !== lastOledCoreSig;
        var firstUpload = !oledTexAllocated || lastOledUploadMs < 0;
        var needOledWork = isPainterAnim || continuousZeroGOled || stateSwitched || oledPendingFlush || oledSig !== lastOledSig;

        if (needOledWork) {
          var elapsedSinceUpload = animClockMs >= lastOledUploadMs ? (animClockMs - lastOledUploadMs) : OLED_SWEEP_THROTTLE_MS;
          /* Throttle fast hover sweeps to 36ms (oledPendingFlush guarantees trailing frame flush); active clicks paint first step at >=15.5ms, then 33ms */
          var minOledGap = (!coreChanged && stateSwitched)
            ? OLED_SWEEP_THROTTLE_MS
            : (oledCoreTransitionStep ? 15.5 : OLED_ANIM_THROTTLE_MS);
          if (
            !firstUpload &&
            !coreChanged &&
            !reducedNow &&
            (isPainterAnim || stateSwitched || oledPendingFlush) &&
            elapsedSinceUpload < minOledGap
          ) {
            oledPendingFlush = true;
            idle = false;
            return computeEffortButtonLayouts();
          }

          /* Snap key art during rapid hover sweeps to avoid stacking 200ms crossfade storms */
          var isFastHoverSweep = Boolean(!firstUpload && !coreChanged && stateSwitched && elapsedSinceUpload < 120);

          var uploadCanvas = null;
          if (painter && typeof painter.render === 'function') {
            try {
              var painterTheme = {
                id: palette.id,
                isLight: Boolean(palette.isLight),
                isMono: Boolean(tp.isMono),
                rimTone: rimToneKey,
                ambientMul: tp.ambientMul,
                primaryHex: accentHex,
              };
              var blendState = {
                hoveredEffort: di.hoveredEffort || null,
                pressedEffort: di.pressedEffort || null,
                effortPress: effortPressCur,
                effortHover: effortHoverCur,
                orbitPitch: orbitPitchCur,
                orbitYaw: orbitYawCur,
                energyPulse: energyPulseVal,
                accentHex: accentHex,
                themeProfile: painterTheme,
                now: animClockMs,
                reducedMotion: reducedNow,
                motionLevel: resolveMotionLevel(),
                targetFps: resolveTargetFps(),
                paused: isEffectivelyPaused(),
                gpuSheenHandled: true,
                skipIdenticalStatic: true,
                forceOffscreenBlur: true,
                instantSwitch: isFastHoverSweep,
              };
              uploadCanvas =
                painter.render(di, painterTheme, blendState, animClockMs) ||
                painter.canvas ||
                (typeof painter.getCanvas === 'function' ? painter.getCanvas() : null);
              isPainterAnim = Boolean(
                !reducedNow &&
                typeof painter.isAnimating === 'function' &&
                painter.isAnimating(animClockMs)
              );
              if (isPainterAnim) {
                idle = false;
              }
            } catch (_paintErr) {
              uploadCanvas = null;
            }
          }

          if (!uploadCanvas) {
            var fallbackOledSurf = ensureOledSurf();
            if (fallbackOledSurf) {
              var builtinCaps = computeScreenEffortCapsules(di, effortPressCur, effortHoverCur);
              renderOledDeckCanvas(fallbackOledSurf, di, palette, accentHex, Boolean(tp.isMono), grainAssets, builtinCaps);
              uploadCanvas = fallbackOledSurf.canvas;
            }
          }

          lastOledUploadMs = animClockMs;
          lastOledDiscreteSig = oledSig;
          lastOledCoreSig = coreOledSig;
          oledPendingFlush = false;
          oledCoreTransitionStep = Boolean(coreChanged && isPainterAnim);
          lastOledSig = (isPainterAnim || continuousZeroGOled) ? '__anim__' : oledSig;

          if (uploadCanvas) {
            activeOledCanvas = uploadCanvas;
            if (gl && glObjs) {
              var upW = Number(uploadCanvas.width) || OLED_WIDTH;
              var upH = Number(uploadCanvas.height) || OLED_HEIGHT;
              gl.bindTexture(gl.TEXTURE_2D, glObjs.oledTex);
              gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
              if (oledTexAllocated && oledTexW === upW && oledTexH === upH && typeof gl.texSubImage2D === 'function') {
                gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, gl.RGBA, gl.UNSIGNED_BYTE, uploadCanvas);
              } else {
                gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, uploadCanvas);
                oledTexAllocated = true;
                oledTexW = upW;
                oledTexH = upH;
              }
            }
          }
        }

        return computeEffortButtonLayouts();
      }

      function populateKeycapInstanceBuffer(palette, _ambientMul) {
        if (!glObjs || slotCount <= 0) return;
        var inst = glObjs.instanceFloats;
        var cellUw = 1.0 / ATLAS_COLS;
        var cellVh = 0.90 / ATLAS_ROWS;

        for (var i = 0; i < slotCount; i++) {
          var sl = slots[i];
          var zVal = sl.slotZ !== undefined ? sl.slotZ : sl.z;
          var availMix = clamp(slotAvailCur[i], 0, 1);
          var heroChroma = availMix > 0.001 ? resolveSlotHeroChroma(i, zVal, sl.z) * availMix : 0.0;
          var kc = resolveBlendedKeyColors(i, sl, palette, heroChroma);
          var capRgb = kc.capRgb || hexToRgb01(kc.cap);
          var legRgb = kc.legendRgb || hexToRgb01(kc.legend);

          var hoverBoost = keyHoverCur[i] * mixScalar(0.018, 0.036, availMix);
          var lm = keyLocalMats[i];
          var base = i * 32;
          for (var m = 0; m < 16; m++) inst[base + m] = lm[m];

          inst[base + 16] = clamp(capRgb[0] + hoverBoost, 0, 1);
          inst[base + 17] = clamp(capRgb[1] + hoverBoost, 0, 1);
          inst[base + 18] = clamp(capRgb[2] + hoverBoost, 0, 1);
          inst[base + 19] = availMix;

          inst[base + 20] = legRgb[0];
          inst[base + 21] = legRgb[1];
          inst[base + 22] = legRgb[2];
          inst[base + 23] = clamp(keyLiftCur[i], 0, 1);

          var ac = i % ATLAS_COLS;
          var ar = Math.floor(i / ATLAS_COLS);
          inst[base + 24] = ac * cellUw;
          inst[base + 25] = ar * cellVh;
          inst[base + 26] = cellUw;
          inst[base + 27] = cellVh;

          inst[base + 28] = keyHoverCur[i];
          var tapGleam = (blindTapIdx === i && blindTapRemain > 0)
            ? Math.sin(clamp(1.0 - blindTapRemain / BLIND_TAP_DURATION, 0, 1) * Math.PI) * 0.65
            : 0.0;
          inst[base + 29] = Math.min(1.0, keyWaveGlow[i] + tapGleam);
          inst[base + 30] = heroChroma;
          inst[base + 31] = zVal;
        }

        if (enableAuxPad) {
          var auxV0 = AUX_ATLAS_Y0 / ATLAS_SIZE;
          var auxVh = AUX_ATLAS_H / ATLAS_SIZE;
          for (var ai = 0; ai < AUX_SLOT_COUNT; ai++) {
            var aSlot = state.auxModels[ai] || DEFAULT_AUX_MODELS[ai];
            var aAvailMix = clamp(auxAvailCur[ai], 0, 1);
            var aIsOrch = ai === 0;
            var aLatchT = aIsOrch ? clamp(orchLatchCur, 0, 1) : 0.0;
            var aSel = state.selectedAuxIndex === ai && !(aIsOrch && state.orchLatched);
            var aHeroChroma = aAvailMix > 0.001
              ? clamp(
                  Math.max(
                    auxKeyLiftCur[ai],
                    aLatchT,
                    auxKeyHoverCur[ai] * (aIsOrch ? 0.35 : 0.14),
                    aSel ? 1.0 : 0.0
                  ) * aAvailMix,
                  0,
                  1
                )
              : 0.0;
            var akc = resolveAuxKeyColors(aSlot, ai, palette, aHeroChroma);
            var aCapRgb = akc.capRgb || hexToRgb01(akc.cap);
            var aLegRgb = akc.legendRgb || hexToRgb01(akc.legend);
            var aHovBoost = auxKeyHoverCur[ai] * mixScalar(0.018, 0.040, aAvailMix);
            var alm = auxKeyLocalMats[ai];
            var aBase = (slotCount + ai) * 32;
            for (var am = 0; am < 16; am++) inst[aBase + am] = alm[am];

            inst[aBase + 16] = clamp(aCapRgb[0] + aHovBoost, 0, 1);
            inst[aBase + 17] = clamp(aCapRgb[1] + aHovBoost, 0, 1);
            inst[aBase + 18] = clamp(aCapRgb[2] + aHovBoost, 0, 1);
            inst[aBase + 19] = aAvailMix;

            inst[aBase + 20] = aLegRgb[0];
            inst[aBase + 21] = aLegRgb[1];
            inst[aBase + 22] = aLegRgb[2];
            /* For #0 Orch: encode negative -orchLatchCur in v_legColor.a when latched so KEYCAP_FS lights the legend and violet-gold rim */
            inst[aBase + 23] = (aIsOrch && aLatchT > 0.001 && auxKeyLiftCur[0] <= 0.002)
              ? -aLatchT
              : clamp(auxKeyLiftCur[ai], 0, 1);

            inst[aBase + 24] = ai * cellUw;
            inst[aBase + 25] = auxV0;
            inst[aBase + 26] = cellUw;
            inst[aBase + 27] = auxVh;

            inst[aBase + 28] = auxKeyHoverCur[ai];
            inst[aBase + 29] = auxKeyWaveGlow[ai];
            inst[aBase + 30] = aHeroChroma;
            inst[aBase + 31] = -(100 + ai); /* Negative accent seed -(100+ai) maps to violet-gold dual-core or aux brand accents in KEYCAP_FS */
          }
        }

        /* Swap the single levitated keycap to instance 0 so main pass draws its underside cavity once (strict 4-VAO budget) */
        var bestLiftVal = 0.015;
        var liftedInstIdx = -1;
        for (var li = 0; li < slotCount; li++) {
          if (keyLiftCur[li] > bestLiftVal) {
            bestLiftVal = keyLiftCur[li];
            liftedInstIdx = li;
          }
        }
        if (enableAuxPad) {
          for (var ali = 0; ali < AUX_SLOT_COUNT; ali++) {
            if (auxKeyLiftCur[ali] > bestLiftVal) {
              bestLiftVal = auxKeyLiftCur[ali];
              liftedInstIdx = slotCount + ali;
            }
          }
        }
        hasLiftedKeycapCavity = liftedInstIdx >= 0;
        if (liftedInstIdx > 0) {
          var lOff = liftedInstIdx * 32;
          for (var si = 0; si < 32; si++) {
            _tmpInstSwap32[si] = inst[si];
            inst[si] = inst[lOff + si];
            inst[lOff + si] = _tmpInstSwap32[si];
          }
        }

        gl.bindBuffer(gl.ARRAY_BUFFER, glObjs.instanceBuf);
        gl.bufferSubData(gl.ARRAY_BUFFER, 0, inst);
      }

      function computeShadowGeomSignature(palette, shadowMapSize) {
        var q1000 = function (v) { return Math.round((Number(v) || 0) * 1000); };
        var q500 = function (v) { return Math.round((Number(v) || 0) * 500); };
        /* Quantize minor hover tilt (~0.08 rad) and omit color/camera distance from shadow key so pure hover/theme swaps trigger 0 shadow passes */
        var q12 = function (v) { return Math.round((Number(v) || 0) * 12); };
        var parts = [
          shadowMapSize,
          enableAuxPad ? 1 : 0,
          q1000(orbitPitchCur),
          q1000(orbitYawCur),
          q1000(auxOrbitPitchCur),
          q1000(auxOrbitYawCur),
          q1000(auxPhaseLiftY),
          introActive ? q1000(introElapsed) : 0,
          q1000(effortLiftHeightCur),
          q12(neighborSympathyCur),
          q1000(orchLatchCur),
          q12(liftPitchCur),
          q12(liftRollCur),
          q12(liftYawCur),
          q12(liftMagXCur),
          q12(liftMagZCur),
          q12(gyroPitchCur),
          q12(gyroRollCur),
          q12(gyroYawCur),
          q500(ctrlPressCur[0]),
          q500(ctrlPressCur[1]),
          q500(ctrlPressCur[2]),
          q500(ctrlPressCur[3]),
          q500(knobAngleCur),
          q500(artisanWaveDipCur),
          blindTapIdx,
          q500(blindTapRemain),
          auxPageWaveActive ? (state.auxPage + ':' + q1000(auxPageWaveElapsed)) : '0',
        ];

        if (waveRipples.length > 0) {
          var rParts = [];
          for (var wi = 0; wi < waveRipples.length; wi++) {
            var wv = waveRipples[wi];
            rParts.push(q500(wv.ox) + ',' + q500(wv.oz) + ',' + q1000(wv.elapsed) + ',' + q500(wv.strength));
          }
          parts.push('W:' + rParts.join(';'));
        } else {
          parts.push('W:0');
        }

        if (state.lockedShakeZ && state.lockedShakeZ.progress > 0 && state.lockedShakeZ.progress < 1) {
          parts.push('SZ:' + state.lockedShakeZ.z + ':' + q500(state.lockedShakeZ.progress));
        }
        if (
          state.lockedShakeAuxIndex &&
          typeof state.lockedShakeAuxIndex === 'object' &&
          state.lockedShakeAuxIndex.progress > 0 &&
          state.lockedShakeAuxIndex.progress < 1
        ) {
          parts.push('SAO:' + (state.lockedShakeAuxIndex.auxIndex || 0) + ':' + q500(state.lockedShakeAuxIndex.progress));
        } else if (auxShakeActiveIdx >= 0 && auxShakeProgress < 1) {
          parts.push('SA:' + auxShakeActiveIdx + ':' + q500(auxShakeProgress));
        }

        var mainMov = '';
        for (var i = 0; i < slotCount; i++) {
          var kl = keyLiftCur[i];
          var kp = keyPressCur[i];
          if (kl > 0.0005 || kp > 0.0005) {
            mainMov += i + ':' + q1000(kl) + ':' + q500(kp) + ',';
          }
        }
        parts.push('M:' + mainMov);

        if (enableAuxPad) {
          var auxMov = '';
          for (var ai = 0; ai < AUX_SLOT_COUNT; ai++) {
            var akl = auxKeyLiftCur[ai];
            var akp = auxKeyPressCur[ai];
            if (akl > 0.0005 || akp > 0.0005) {
              auxMov += ai + ':' + q1000(akl) + ':' + q500(akp) + ',';
            }
          }
          parts.push('A:' + auxMov);
        }

        return parts.join('|');
      }

      function computeDynMeshSignature(palette, activeSwitchInfo, ambientMul, hwCtrl, fluxCfg) {
        var q500 = function (v) { return Math.round((Number(v) || 0) * 500); };
        var q100 = function (v) { return Math.round((Number(v) || 0) * 100); };
        var parts = [
          palette.id,
          enableAuxPad ? 1 : 0,
          Math.round(clamp(orchLatchCur, 0, 1) * 20),
          q100(ambientMul),
          hwCtrl.muted ? 1 : 0,
          hwCtrl.effortTier,
          hwCtrl.orbitMag > 0.015 ? Math.round(clamp(hwCtrl.orbitMag, 0, 0.1) * 40) : 0,
          q500(hwCtrl.prismHover),
          q500(hwCtrl.prismPress),
          q500(hwCtrl.prismWaveDip),
          q500(hwCtrl.resetHover),
          q500(hwCtrl.resetPress),
          q500(hwCtrl.muteHover),
          q500(hwCtrl.mutePress),
          q500(hwCtrl.knobAngle),
          q500(hwCtrl.closeHover),
          q500(hwCtrl.closePress),
        ];
        if (activeSwitchInfo) {
          parts.push(
            'S',
            activeSwitchInfo.isAux ? 1 : 0,
            activeSwitchInfo.slotIndex,
            q500(activeSwitchInfo.x),
            q500(activeSwitchInfo.z),
            activeSwitchInfo.stemRgb ? (q500(activeSwitchInfo.stemRgb[0]) + ',' + q500(activeSwitchInfo.stemRgb[1]) + ',' + q500(activeSwitchInfo.stemRgb[2])) : '',
            activeSwitchInfo.ledRgb ? (q500(activeSwitchInfo.ledRgb[0]) + ',' + q500(activeSwitchInfo.ledRgb[1]) + ',' + q500(activeSwitchInfo.ledRgb[2])) : ''
          );
        } else {
          parts.push('S0');
        }
        if (fluxCfg) {
          parts.push(
            'F',
            fluxCfg.isAux ? 1 : 0,
            fluxCfg.effortTier,
            q500(fluxCfg.originX),
            q500(fluxCfg.originY),
            q500(fluxCfg.originZ),
            q500(fluxCfg.gapH),
            q100(fluxCfg.visAlpha),
            Math.round(clamp(fluxCfg.slamCollapse || 0, 0, 1) * 20),
            Math.round(clamp(fluxCfg.orchBlend || 0, 0, 1) * 20),
            q500(fluxCfg.elemRgb[0]), q500(fluxCfg.elemRgb[1]), q500(fluxCfg.elemRgb[2]),
            q500(fluxCfg.secondaryRgb[0]), q500(fluxCfg.secondaryRgb[1]), q500(fluxCfg.secondaryRgb[2])
          );
        } else {
          parts.push('F0');
        }
        return parts.join('|');
      }

      var lastKeycapInstSig = '';
      function computeKeycapInstanceSignature(palette, shadowSig) {
        var q500 = function (v) { return Math.round((Number(v) || 0) * 500); };
        var hovPart = '';
        var avSum = 0;
        for (var i = 0; i < slotCount; i++) {
          avSum += (i + 1) * Math.round(slotAvailCur[i] * 255);
          if (keyHoverCur[i] > 0.0005 || keyWaveGlow[i] > 0.0005) {
            hovPart += i + ':' + q500(keyHoverCur[i]) + ':' + q500(keyWaveGlow[i]) + ',';
          }
        }
        var auxHovPart = '';
        var auxAvSum = 0;
        if (enableAuxPad) {
          for (var ai = 0; ai < AUX_SLOT_COUNT; ai++) {
            auxAvSum += (ai + 1) * Math.round(auxAvailCur[ai] * 255);
            if (auxKeyHoverCur[ai] > 0.0005 || auxKeyWaveGlow[ai] > 0.0005) {
              auxHovPart += ai + ':' + q500(auxKeyHoverCur[ai]) + ':' + q500(auxKeyWaveGlow[ai]) + ',';
            }
          }
        }
        return [
          palette.id,
          lastAuxAtlasSig,
          state.selectedZ,
          state.selectedAuxIndex,
          state.orchLatched ? 1 : 0,
          avSum,
          auxAvSum,
          hovPart,
          auxHovPart,
          shadowSig,
        ].join('|');
      }

      function renderWebGL2Frame(palette, switchInfo) {
        if (!gl || !glObjs || contextLost) return;

        ensureShadowMapSize(resolveTargetShadowMapSize());

        var chassisThemeKey = palette.id + ':' + (enableAuxPad ? 1 : 0);
        if (lastChassisThemeId !== chassisThemeKey) {
          var prevEmptyChassis = lastChassisThemeId === '';
          var auxLayoutChanged = lastChassisAuxFlag !== (enableAuxPad ? 1 : 0);
          lastChassisThemeId = chassisThemeKey;
          lastChassisAuxFlag = enableAuxPad ? 1 : 0;
          var chMesh = buildChassisMesh(palette, enableAuxPad);
          uploadSolidMesh(glObjs.chassisGpu, chMesh, gl.STATIC_DRAW);
          /* Dirty shadows only on initial build or structural aux toggle; pure palette changes preserve depth geometry */
          if (prevEmptyChassis || auxLayoutChanged) {
            shadowDirty = true;
            lastShadowGeomSig = '';
          }
          keycapInstanceDirty = true;
        }
        syncAuxAtlasTexture();

        var tp = state.themeProfile || {};
        var ambientMul = clamp(tp.ambientMul === undefined ? 0.7 : Number(tp.ambientMul), 0, 1);
        var rimToneIdx = resolveRimToneIndex(palette);
        _framePrismCfg4[0] = rimToneIdx;
        _framePrismCfg4[1] = sweepWaveX;
        _framePrismCfg4[2] = sweepWaveWeight;
        _framePrismCfg4[3] = energyPulseVal;
        var prismCfgVec = _framePrismCfg4;

        var fluxCfg = null;
        var activeSwitchForMesh = switchInfo && switchInfo.lift > 0.04 ? switchInfo : null;
        if (activeSwitchForMesh && ambientMul > 0.01) {
          var slamActive = isConfirmSlamActiveGlobal();
          var slamCollapse = slamActive ? clamp(1.0 - activeSwitchForMesh.lift, 0.0, 1.0) : 0.0;
          var airGapBaseY = PLATE_Y + 0.245;
          var tierLiftTarget = EFFORT_TIER_LIFTS[effortTierCur] !== undefined ? EFFORT_TIER_LIFTS[effortTierCur] : effortLiftHeightCur;
          var capUnderY = CAP_Y_BASE + tierLiftTarget;
          var airGapH = Math.max(0.035, capUnderY - airGapBaseY);
          var fluxVis = clamp(ambientMul * 1.24, 0.0, 1.0) * (1.0 - slamCollapse * 0.76);
          var crystalCols = resolveFluxCrystalColors(activeSwitchForMesh);
          fluxCfg = {
            isAux: Boolean(activeSwitchForMesh.isAux),
            effortTier: effortTierCur,
            originX: activeSwitchForMesh.x,
            originY: airGapBaseY,
            originZ: activeSwitchForMesh.z,
            gapH: airGapH,
            phaseT: 0,
            visAlpha: fluxVis,
            energyPulse: 0,
            slamCollapse: slamCollapse,
            gyroPitch: 0,
            gyroRoll: 0,
            elemRgb: crystalCols.primary,
            secondaryRgb: crystalCols.secondary,
            orchBlend: clamp(orchLatchCur, 0.0, 1.0),
          };
        }

        var hwCtrlParams = buildHardwareCtrlParams();
        var dynMeshSig = computeDynMeshSignature(palette, activeSwitchForMesh, ambientMul, hwCtrlParams, fluxCfg);
        if (dynMeshSig !== lastDynMeshSig || glObjs.widgetsGpu.count <= 0) {
          var steadySwitchForMesh = activeSwitchForMesh
            ? Object.assign({}, activeSwitchForMesh, { lift: 1.0 })
            : null;
          var dynMesh = buildDynamicWidgetsMesh({
            palette: palette,
            includeAuxPad: enableAuxPad,
            switchInfo: steadySwitchForMesh,
            orchLatchGlow: clamp(orchLatchCur, 0.0, 1.0),
            ambientMul: ambientMul,
            energyPulse: 0,
            hwCtrl: hwCtrlParams,
            fluxCfg: fluxCfg,
          });
          uploadSolidMesh(glObjs.widgetsGpu, dynMesh, gl.DYNAMIC_DRAW);
          lastDynMeshSig = dynMeshSig;
          perfStats.dynMeshRebuilds++;
        }

        var shPass = glObjs.shadowPass;
        var shMapSize = shPass && shPass.size ? shPass.size : activeShadowMapSize;
        var curShadowSig = computeShadowGeomSignature(palette, shMapSize);
        var curInstSig = computeKeycapInstanceSignature(palette, curShadowSig);
        if (keycapInstanceDirty || curInstSig !== lastKeycapInstSig) {
          populateKeycapInstanceBuffer(palette, ambientMul);
          lastKeycapInstSig = curInstSig;
          keycapInstanceDirty = false;
        }

        var totalKeyInstances = slotCount + activeAuxCount;
        var texUnit1 = gl.TEXTURE0 + 1;
        var texUnit2 = gl.TEXTURE0 + 2;
        var texUnit3 = gl.TEXTURE0 + 3;
        var shadowEnabled = shPass ? 1.0 : 0.0;

        gl.enable(gl.DEPTH_TEST);
        gl.depthFunc(gl.LEQUAL);
        gl.enable(gl.CULL_FACE);
        gl.cullFace(gl.BACK);

        /* ================= Stage A: On-Demand 2048/1024 Shadow Depth Pass (reused on pure hover/OLED frames; capped at 30Hz during continuous motion) ================= */
        if (shPass) {
          var shadowChanged = curShadowSig !== lastShadowGeomSig;
          var shadowThrottleReady =
            lastShadowDrawClockMs < 0 ||
            animClockMs < lastShadowDrawClockMs ||
            (animClockMs - lastShadowDrawClockMs) >= SHADOW_THROTTLE_MS ||
            idle ||
            isConfirmSlamActiveGlobal();
          if (shadowDirty || (shadowChanged && shadowThrottleReady)) {
            gl.activeTexture(texUnit1);
            gl.bindTexture(gl.TEXTURE_2D, null);

            gl.bindFramebuffer(shPass.fbConst, shPass.fbo);
            gl.viewport(0, 0, shMapSize, shMapSize);
            gl.clear(gl.DEPTH_BUFFER_BIT);

            var polyOffsetConst = gl.POLYGON_OFFSET_FILL || 0x8037;
            if (typeof gl.polygonOffset === 'function') {
              gl.enable(polyOffsetConst);
              gl.polygonOffset(1.5, 2.4);
            }

            gl.useProgram(shPass.progSolid);
            gl.uniformMatrix4fv(shPass.uSolid.lightViewProj, false, lightViewProjMat);

            gl.uniformMatrix4fv(shPass.uSolid.model, false, chassisMat);
            gl.bindVertexArray(glObjs.chassisGpu.vao);
            gl.drawElements(gl.TRIANGLES, glObjs.chassisGpu.mainCount, gl.UNSIGNED_SHORT, 0);
            if (glObjs.widgetsGpu.mainOpaqueCount > 0) {
              gl.bindVertexArray(glObjs.widgetsGpu.vao);
              gl.drawElements(gl.TRIANGLES, glObjs.widgetsGpu.mainOpaqueCount, gl.UNSIGNED_SHORT, 0);
            }

            if (enableAuxPad && glObjs.chassisGpu.auxCount > 0) {
              gl.uniformMatrix4fv(shPass.uSolid.model, false, auxChassisMat);
              gl.bindVertexArray(glObjs.chassisGpu.vao);
              gl.drawElements(gl.TRIANGLES, glObjs.chassisGpu.auxCount, gl.UNSIGNED_SHORT, glObjs.chassisGpu.mainCount * 2);
              if (glObjs.widgetsGpu.auxOpaqueCount > 0) {
                gl.bindVertexArray(glObjs.widgetsGpu.vao);
                gl.drawElements(
                  gl.TRIANGLES,
                  glObjs.widgetsGpu.auxOpaqueCount,
                  gl.UNSIGNED_SHORT,
                  glObjs.widgetsGpu.mainOpaqueCount * 2
                );
              }
            }

            if (totalKeyInstances > 0) {
              gl.useProgram(shPass.progKeycap);
              gl.uniformMatrix4fv(shPass.uKeycap.lightViewProj, false, lightViewProjMat);
              gl.uniformMatrix4fv(shPass.uKeycap.chassisMat, false, chassisMat);
              gl.uniformMatrix4fv(shPass.uKeycap.auxChassisMat, false, auxChassisMat);
              gl.bindVertexArray(glObjs.capVao);
              /* Shadow pass draws only the 440-tri outer keycap shell, culling unseen cavities (-71.5% triangles) */
              gl.drawElementsInstanced(gl.TRIANGLES, glObjs.capOuterIndexCount, gl.UNSIGNED_SHORT, 0, totalKeyInstances);
            }

            gl.bindVertexArray(null);
            if (typeof gl.disable === 'function' && typeof gl.polygonOffset === 'function') {
              gl.disable(polyOffsetConst);
            }
            gl.bindFramebuffer(shPass.fbConst, null);

            shadowDirty = false;
            lastShadowGeomSig = curShadowSig;
            lastShadowDrawClockMs = animClockMs;
            perfStats.shadowDraws++;
          } else {
            perfStats.shadowSkips++;
          }
        }

        /* ================= Stage B: Early-Z Front-to-Back Pass (keycaps fill depth -> chassis/plate culls ~2x overdraw -> OLED & translucent crystals) ================= */
        _frameEnvVec4[0] = palette.isLight ? 1.0 : 0.0;
        _frameEnvVec4[1] = shadowEnabled;
        _frameEnvVec4[2] = ambientMul;
        _frameEnvVec4[3] = fluxPhase;
        var envVec = _frameEnvVec4;
        var rimTintVec = palette.rimTint || _fallbackRimTint3;
        var liftShadowVec;
        if (switchInfo && switchInfo.lift > 0.04) {
          _frameLiftShadow4[0] = switchInfo.capX;
          _frameLiftShadow4[1] = CAP_Y_BASE + switchInfo.lift * effortLiftHeightCur;
          _frameLiftShadow4[2] = switchInfo.capZ;
          _frameLiftShadow4[3] = switchInfo.lift;
          liftShadowVec = _frameLiftShadow4;
        } else {
          liftShadowVec = _zeroVec4;
        }

        gl.viewport(0, 0, canvas.width, canvas.height);
        gl.clearColor(0, 0, 0, 0);
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
        /* Passes 1 & 2 are fully opaque: disable blend and rely on Front-to-Back Early-Z to cull plate overdraw behind 96 keycaps */
        if (typeof gl.disable === 'function') {
          gl.disable(gl.BLEND);
        }

        gl.activeTexture(texUnit1);
        gl.bindTexture(gl.TEXTURE_2D, shPass ? shPass.tex : glObjs.atlasTex);
        gl.activeTexture(texUnit2);
        gl.bindTexture(gl.TEXTURE_2D, glObjs.grainTex);
        gl.activeTexture(texUnit3);
        gl.bindTexture(gl.TEXTURE_2D, glObjs.metalEnvTex);

        /* Pass 1 (Early-Z front): 96 opaque keycap shells + single levitated keycap (instance 0) macro cavity */
        if (totalKeyInstances > 0) {
          gl.useProgram(glObjs.progKeycap);
          gl.uniformMatrix4fv(glObjs.uKeycap.viewProj, false, viewProjMat);
          gl.uniformMatrix4fv(glObjs.uKeycap.chassisMat, false, chassisMat);
          gl.uniformMatrix4fv(glObjs.uKeycap.auxChassisMat, false, auxChassisMat);
          gl.uniformMatrix4fv(glObjs.uKeycap.lightViewProj, false, lightViewProjMat);
          gl.uniform3fv(glObjs.uKeycap.camPos, camEye);
          gl.uniform3fv(glObjs.uKeycap.lightDir, MAIN_LIGHT_DIR);
          gl.uniform3fv(glObjs.uKeycap.rimTint, rimTintVec);
          gl.uniform4fv(glObjs.uKeycap.envParams, envVec);
          gl.uniform4fv(glObjs.uKeycap.liftCapShadow, liftShadowVec);
          gl.uniform4fv(glObjs.uKeycap.prismConfig, prismCfgVec);

          if (switchInfo && ambientMul > 0.01 && switchInfo.lift > 0.03) {
            gl.uniform4f(
              glObjs.uKeycap.switchLightPos,
              switchInfo.x,
              PLATE_Y + 0.28,
              switchInfo.z + 0.22,
              ambientMul * switchInfo.lift * 1.05
            );
            gl.uniform3fv(glObjs.uKeycap.switchLightColor, switchInfo.ledRgb);
          } else {
            gl.uniform4f(glObjs.uKeycap.switchLightPos, 0, 0, 0, 0);
            gl.uniform3f(glObjs.uKeycap.switchLightColor, 0, 0, 0);
          }

          gl.activeTexture(gl.TEXTURE0);
          gl.bindTexture(gl.TEXTURE_2D, glObjs.atlasTex);
          gl.uniform1i(glObjs.uKeycap.atlasTex, 0);
          gl.uniform1i(glObjs.uKeycap.shadowTex, 1);
          gl.uniform1i(glObjs.uKeycap.grainTex, 2);
          gl.uniform1i(glObjs.uKeycap.metalEnvTex, 3);

          gl.bindVertexArray(glObjs.capVao);
          gl.drawElementsInstanced(gl.TRIANGLES, glObjs.capOuterIndexCount, gl.UNSIGNED_SHORT, 0, totalKeyInstances);
          if (hasLiftedKeycapCavity && glObjs.capCavityIndexCount > 0) {
            gl.drawElementsInstanced(
              gl.TRIANGLES,
              glObjs.capCavityIndexCount,
              gl.UNSIGNED_SHORT,
              glObjs.capOuterIndexCount * 2,
              1
            );
          }
          gl.bindVertexArray(null);
        }

        /* Pass 2 (Early-Z beneficiary): main & right 2x3 aux CNC aluminum chassis + waistline + static PVD weights + switch housing */
        gl.useProgram(glObjs.progSolid);
        gl.uniformMatrix4fv(glObjs.uSolid.viewProj, false, viewProjMat);
        gl.uniformMatrix4fv(glObjs.uSolid.model, false, chassisMat);
        gl.uniformMatrix4fv(glObjs.uSolid.lightViewProj, false, lightViewProjMat);
        gl.uniform3fv(glObjs.uSolid.camPos, camEye);
        gl.uniform3fv(glObjs.uSolid.lightDir, MAIN_LIGHT_DIR);
        gl.uniform3fv(glObjs.uSolid.rimTint, rimTintVec);
        gl.uniform4fv(glObjs.uSolid.envParams, envVec);
        gl.uniform4fv(glObjs.uSolid.liftCapShadow, switchInfo && !switchInfo.isAux ? liftShadowVec : _zeroVec4);
        gl.uniform4fv(glObjs.uSolid.prismFocusPos, prismFocusVec);
        gl.uniform4fv(glObjs.uSolid.prismConfig, prismCfgVec);

        if (switchInfo && !switchInfo.isAux && ambientMul > 0.01 && switchInfo.lift > 0.03) {
          gl.uniform4f(
            glObjs.uSolid.switchLightPos,
            switchInfo.x,
            PLATE_Y + 0.25,
            switchInfo.z + 0.22,
            ambientMul * switchInfo.lift * (1.0 + energyPulseVal * 0.42)
          );
          gl.uniform3fv(glObjs.uSolid.switchLightColor, switchInfo.ledRgb);
        } else {
          gl.uniform4f(glObjs.uSolid.switchLightPos, 0, 0, 0, 0);
          gl.uniform3f(glObjs.uSolid.switchLightColor, 0, 0, 0);
        }

        gl.uniform1i(glObjs.uSolid.shadowTex, 1);
        gl.uniform1i(glObjs.uSolid.grainTex, 2);
        gl.uniform1i(glObjs.uSolid.metalEnvTex, 3);

        gl.bindVertexArray(glObjs.chassisGpu.vao);
        gl.drawElements(gl.TRIANGLES, glObjs.chassisGpu.mainCount, gl.UNSIGNED_SHORT, 0);

        if (glObjs.widgetsGpu.mainOpaqueCount > 0) {
          gl.bindVertexArray(glObjs.widgetsGpu.vao);
          gl.drawElements(gl.TRIANGLES, glObjs.widgetsGpu.mainOpaqueCount, gl.UNSIGNED_SHORT, 0);
        }

        if (enableAuxPad && glObjs.chassisGpu.auxCount > 0) {
          gl.uniformMatrix4fv(glObjs.uSolid.model, false, auxChassisMat);
          gl.uniform4fv(glObjs.uSolid.liftCapShadow, switchInfo && switchInfo.isAux ? liftShadowVec : _zeroVec4);
          if (switchInfo && switchInfo.isAux && ambientMul > 0.01 && switchInfo.lift > 0.03) {
            gl.uniform4f(
              glObjs.uSolid.switchLightPos,
              switchInfo.x,
              PLATE_Y + 0.25,
              switchInfo.z + 0.22,
              ambientMul * switchInfo.lift * (1.0 + energyPulseVal * 0.42)
            );
            gl.uniform3fv(glObjs.uSolid.switchLightColor, switchInfo.ledRgb);
          } else {
            gl.uniform4f(glObjs.uSolid.switchLightPos, 0, 0, 0, 0);
            gl.uniform3f(glObjs.uSolid.switchLightColor, 0, 0, 0);
          }
          gl.bindVertexArray(glObjs.chassisGpu.vao);
          gl.drawElements(gl.TRIANGLES, glObjs.chassisGpu.auxCount, gl.UNSIGNED_SHORT, glObjs.chassisGpu.mainCount * 2);

          if (glObjs.widgetsGpu.auxOpaqueCount > 0) {
            gl.bindVertexArray(glObjs.widgetsGpu.vao);
            gl.drawElements(
              gl.TRIANGLES,
              glObjs.widgetsGpu.auxOpaqueCount,
              gl.UNSIGNED_SHORT,
              glObjs.widgetsGpu.mainOpaqueCount * 2
            );
          }
        }

        /* Pass 3: Groups 3-12 10Ux3U 2.5D rounded sapphire OLED screen (alpha-blended for smooth 1px rounded SDF edge) */
        gl.enable(gl.BLEND);
        gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA, gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
        var diScreen = state.deckInfo || null;
        var screenZ = Number(
          diScreen && diScreen.z !== undefined && diScreen.z !== null
            ? diScreen.z
            : (state.hoveredZ !== null && state.hoveredZ !== undefined ? state.hoveredZ : (state.selectedZ || 6))
        ) || 6;
        var screenAvailVal = (diScreen && diScreen.isAvailable !== undefined)
          ? (diScreen.isAvailable ? 1.0 : 0.0)
          : (isSlotAvailable(screenZ) ? 1.0 : 0.0);
        var screenEnergy = resolveDeckEffortEnergy(diScreen);
        var screenElemRgb = (diScreen && diScreen.isAuxModel && diScreen.accentHex && !(state.themeProfile && state.themeProfile.isMono))
          ? hexToRgb01(diScreen.accentHex)
          : resolveScreenElementRgb(screenZ, palette);

        gl.useProgram(glObjs.progScreen);
        gl.uniformMatrix4fv(glObjs.uScreen.viewProj, false, viewProjMat);
        gl.uniformMatrix4fv(glObjs.uScreen.model, false, chassisMat);
        gl.uniformMatrix4fv(glObjs.uScreen.lightViewProj, false, lightViewProjMat);
        gl.uniform3fv(glObjs.uScreen.camPos, camEye);
        gl.uniform3fv(glObjs.uScreen.lightDir, MAIN_LIGHT_DIR);
        gl.uniform3fv(glObjs.uScreen.glassTint, palette.deckGlassTint);
        gl.uniform4fv(glObjs.uScreen.envParams, envVec);
        gl.uniform4fv(glObjs.uScreen.prismFocusPos, prismFocusVec);
        gl.uniform4fv(glObjs.uScreen.prismConfig, prismCfgVec);
        gl.uniform4f(glObjs.uScreen.screenOptics, screenZ, screenEnergy, orbitYawCur, orbitPitchCur);
        gl.uniform3fv(glObjs.uScreen.screenElemRgb, screenElemRgb);
        if (typeof gl.uniform1f === 'function') {
          gl.uniform1f(glObjs.uScreen.screenAvail, screenAvailVal);
        }

        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, glObjs.oledTex);
        gl.uniform1i(glObjs.uScreen.oledTex, 0);
        gl.uniform1i(glObjs.uScreen.shadowTex, 1);

        gl.bindVertexArray(glObjs.scrVao);
        gl.drawElements(gl.TRIANGLES, 6, gl.UNSIGNED_SHORT, 0);
        gl.bindVertexArray(null);

        /* Pass 4: Antigravity socket air-gap flux rings + light pillar + 6..28 3D octahedral crystals + bokeh motes (progSolid + widgetsGpu) */
        if (glObjs.widgetsGpu.fluxCount > 0) {
          if (typeof gl.disable === 'function') {
            gl.disable(gl.CULL_FACE);
          }
          if (typeof gl.depthMask === 'function') {
            gl.depthMask(false);
          }
          gl.blendFuncSeparate(
            gl.ONE,
            gl.ONE_MINUS_SRC_ALPHA,
            gl.ONE,
            gl.ONE_MINUS_SRC_ALPHA
          );

          gl.useProgram(glObjs.progSolid);
          gl.uniform4fv(glObjs.uSolid.liftCapShadow, liftShadowVec);
          gl.bindVertexArray(glObjs.widgetsGpu.vao);
          if (glObjs.widgetsGpu.mainFluxCount > 0) {
            gl.uniformMatrix4fv(glObjs.uSolid.model, false, chassisMat);
            gl.drawElements(
              gl.TRIANGLES,
              glObjs.widgetsGpu.mainFluxCount,
              gl.UNSIGNED_SHORT,
              glObjs.widgetsGpu.opaqueCount * 2
            );
          }
          if (enableAuxPad && glObjs.widgetsGpu.auxFluxCount > 0) {
            gl.uniformMatrix4fv(glObjs.uSolid.model, false, auxChassisMat);
            gl.drawElements(
              gl.TRIANGLES,
              glObjs.widgetsGpu.auxFluxCount,
              gl.UNSIGNED_SHORT,
              (glObjs.widgetsGpu.opaqueCount + glObjs.widgetsGpu.mainFluxCount) * 2
            );
          }
          gl.bindVertexArray(null);

          gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA, gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
          if (typeof gl.depthMask === 'function') {
            gl.depthMask(true);
          }
          gl.enable(gl.CULL_FACE);
        }

        if (shPass) {
          gl.activeTexture(texUnit1);
          gl.bindTexture(gl.TEXTURE_2D, null);
        }
        gl.activeTexture(texUnit2);
        gl.bindTexture(gl.TEXTURE_2D, null);
        gl.activeTexture(texUnit3);
        gl.bindTexture(gl.TEXTURE_2D, null);
        gl.activeTexture(gl.TEXTURE0);
      }

      /* ============================================================================
       * 11. Canvas 2D Perspective Software Fallback Renderer (Supports Co-Orbiting Main + Aux Chassis & 90+6 Keys)
       * ============================================================================ */
      function fillProjectedPoly(ctx, pts, fillStyle, strokeStyle, lineW) {
        for (var i = 0; i < pts.length; i++) {
          if (!pts[i]) return;
        }
        ctx.beginPath();
        ctx.moveTo(pts[0][0], pts[0][1]);
        for (var j = 1; j < pts.length; j++) {
          ctx.lineTo(pts[j][0], pts[j][1]);
        }
        ctx.closePath();
        if (fillStyle) {
          ctx.fillStyle = fillStyle;
          ctx.fill();
        }
        if (strokeStyle) {
          ctx.strokeStyle = strokeStyle;
          ctx.lineWidth = lineW || 1;
          ctx.stroke();
        }
      }

      function renderCanvas2DFrame(palette, switchInfo) {
        if (!ctx2d || !canvas) return;
        var ctx = ctx2d;
        ctx.save();
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        var s = dpr;

        var bLoop = sampleG2RectLoop(-CASE_HALF_W, CASE_Z_MIN, CASE_HALF_W, CASE_Z_MAX, CASE_CORNER_R, 6, 2.3);
        var botPoly = [];
        var topPoly = [];
        for (var li = 0; li < bLoop.length; li++) {
          botPoly.push(projectChassisPointToPx(bLoop[li].x, CASE_Y_BOT, bLoop[li].z, s));
          topPoly.push(projectChassisPointToPx(bLoop[li].x, CASE_Y_TOP, bLoop[li].z, s));
        }
        fillProjectedPoly(ctx, botPoly, palette.caseSide);
        fillProjectedPoly(ctx, topPoly, palette.caseBody, palette.caseChamfer, 1.4 * s);

        if (enableAuxPad) {
          var abLoop = sampleG2RectLoop(AUX_CASE_X_MIN, AUX_CASE_Z_MIN, AUX_CASE_X_MAX, AUX_CASE_Z_MAX, AUX_CASE_CORNER_R, 5, 2.3);
          var aBotPoly = [];
          var aTopPoly = [];
          for (var ali = 0; ali < abLoop.length; ali++) {
            aBotPoly.push(projectAuxChassisPointToPx(abLoop[ali].x, CASE_Y_BOT, abLoop[ali].z, s));
            aTopPoly.push(projectAuxChassisPointToPx(abLoop[ali].x, CASE_Y_TOP, abLoop[ali].z, s));
          }
          fillProjectedPoly(ctx, aBotPoly, palette.caseSide);
          fillProjectedPoly(ctx, aTopPoly, palette.caseBody, palette.caseChamfer, 1.3 * s);

          var ap0 = projectAuxChassisPointToPx(AUX_WELL_X_MIN, PLATE_Y, AUX_WELL_Z_MAX, s);
          var ap1 = projectAuxChassisPointToPx(AUX_WELL_X_MAX, PLATE_Y, AUX_WELL_Z_MAX, s);
          var ap2 = projectAuxChassisPointToPx(AUX_WELL_X_MAX, PLATE_Y, AUX_WELL_Z_MIN, s);
          var ap3 = projectAuxChassisPointToPx(AUX_WELL_X_MIN, PLATE_Y, AUX_WELL_Z_MIN, s);
          fillProjectedPoly(ctx, [ap0, ap1, ap2, ap3], palette.plate, palette.caseChamfer, 0.85 * s);
        }

        var p0 = projectChassisPointToPx(WELL_X_MIN, PLATE_Y, WELL_Z_MAX, s);
        var p1 = projectChassisPointToPx(WELL_X_MAX, PLATE_Y, WELL_Z_MAX, s);
        var p2 = projectChassisPointToPx(WELL_X_MAX, PLATE_Y, WELL_Z_MIN, s);
        var p3 = projectChassisPointToPx(WELL_X_MIN, PLATE_Y, WELL_Z_MIN, s);
        fillProjectedPoly(ctx, [p0, p1, p2, p3], palette.plate, palette.caseChamfer, 0.9 * s);

        /* Canvas 2D fallback draw for left 1U metal prism key & right 5U PVD hardware control deck */
        var awY = CAP_Y_BASE + 0.58 - ctrlPressCur[0] * 0.10;
        var aw0 = projectChassisPointToPx(ARTISAN_WAVE_X - 0.36, awY, ROW1_Z + 0.36, s);
        var aw1 = projectChassisPointToPx(ARTISAN_WAVE_X + 0.36, awY, ROW1_Z + 0.36, s);
        var aw2 = projectChassisPointToPx(ARTISAN_WAVE_X + 0.36, awY, ROW1_Z - 0.36, s);
        var aw3 = projectChassisPointToPx(ARTISAN_WAVE_X - 0.36, awY, ROW1_Z - 0.36, s);
        fillProjectedPoly(ctx, [aw0, aw1, aw2, aw3], palette.artisanMetal || palette.caseChamfer, palette.artisanRim || palette.caseChamfer, 1.1 * s);

        var hd0 = projectChassisPointToPx(HW_DECK_X0, HW_DECK_Y_TOP, HW_DECK_Z1, s);
        var hd1 = projectChassisPointToPx(HW_DECK_X1, HW_DECK_Y_TOP, HW_DECK_Z1, s);
        var hd2 = projectChassisPointToPx(HW_DECK_X1, HW_DECK_Y_TOP, HW_DECK_Z0, s);
        var hd3 = projectChassisPointToPx(HW_DECK_X0, HW_DECK_Y_TOP, HW_DECK_Z0, s);
        fillProjectedPoly(ctx, [hd0, hd1, hd2, hd3], palette.hwDeckBody || palette.caseBody, palette.hwDeckRim || palette.caseChamfer, 1.0 * s);

        var ctrlCenters = [CTRL_RESET_X, CTRL_MUTE_X, CTRL_CLOSE_X];
        for (var c2i = 0; c2i < ctrlCenters.length; c2i++) {
          var cp2 = projectChassisPointToPx(ctrlCenters[c2i], HW_DECK_Y_TOP + 0.12, ROW1_Z, s);
          if (cp2) {
            ctx.beginPath();
            ctx.arc(cp2[0], cp2[1], 11 * s, 0, TWO_PI);
            ctx.fillStyle = palette.hwDeckPanel || palette.caseBody;
            ctx.fill();
            ctx.strokeStyle = palette.hwDeckRim || palette.caseChamfer;
            ctx.lineWidth = 1.1 * s;
            ctx.stroke();
          }
        }

        var dTL = projectChassisPointToPx(DECK_X_MIN, DECK_GLASS_Y, DECK_Z_MIN, s);
        var dTR = projectChassisPointToPx(DECK_X_MAX, DECK_GLASS_Y, DECK_Z_MIN, s);
        var dBR = projectChassisPointToPx(DECK_X_MAX, DECK_GLASS_Y, DECK_Z_MAX, s);
        var dBL = projectChassisPointToPx(DECK_X_MIN, DECK_GLASS_Y, DECK_Z_MAX, s);
        fillProjectedPoly(ctx, [dTL, dTR, dBR, dBL], palette.deckGlassBg, palette.deckLip, 1.2 * s);
        if (activeOledCanvas && dTL && dBR) {
          var dx = Math.min(dTL[0], dBL[0], dTR ? dTR[0] : Infinity, dBR[0]);
          var dy = Math.min(dTL[1], dTR ? dTR[1] : Infinity, dBL ? dBL[1] : Infinity, dBR[1]);
          var dw = Math.max(dTL[0], dTR ? dTR[0] : -Infinity, dBL ? dBL[0] : -Infinity, dBR[0]) - dx;
          var dh = Math.max(dTL[1], dTR ? dTR[1] : -Infinity, dBL ? dBL[1] : -Infinity, dBR[1]) - dy;
          if (dw > 4 && dh > 4) {
            ctx.drawImage(activeOledCanvas, dx, dy, dw, dh);
          }
        }

        if (switchInfo && switchInfo.lift > 0.04) {
          var sc = switchInfo.isAux
            ? projectAuxChassisPointToPx(switchInfo.x, PLATE_Y + 0.34, switchInfo.z, s)
            : projectChassisPointToPx(switchInfo.x, PLATE_Y + 0.34, switchInfo.z, s);
          if (sc) {
            ctx.strokeStyle = rgb01ToCss(switchInfo.ledRgb, 0.55);
            ctx.lineWidth = 1.6 * s;
            ctx.beginPath();
            ctx.arc(sc[0], sc[1], (11 + effortTierCur * 2.5) * s * switchInfo.lift, 0, TWO_PI);
            ctx.stroke();

            ctx.strokeStyle = rgb01ToCss(switchInfo.stemRgb);
            ctx.lineWidth = 2.8 * s;
            ctx.beginPath();
            ctx.moveTo(sc[0] - 6 * s, sc[1]); ctx.lineTo(sc[0] + 6 * s, sc[1]);
            ctx.moveTo(sc[0], sc[1] - 6 * s); ctx.lineTo(sc[0], sc[1] + 6 * s);
            ctx.stroke();
          }
        }

        var order = [];
        for (var ki = 0; ki < slotCount; ki++) order.push(ki);
        order.sort(function (a, b) {
          var la = keyLiftCur[a] > 0.1 ? 100 : slots[a].row;
          var lb = keyLiftCur[b] > 0.1 ? 100 : slots[b].row;
          return la - lb;
        });

        for (var oi = 0; oi < order.length; oi++) {
          var idx = order[oi];
          var sl = slots[idx];
          var zVal = sl.slotZ !== undefined ? sl.slotZ : sl.z;
          var availMix2 = clamp(slotAvailCur[idx], 0, 1);
          var isAvail = availMix2 > 0.5;
          var heroChroma = availMix2 > 0.001 ? resolveSlotHeroChroma(idx, zVal, sl.z) * availMix2 : 0.0;
          var kc = resolveBlendedKeyColors(idx, sl, palette, heroChroma);
          var lm = keyLocalMats[idx];

          var projCapPt = function (x, y, z) {
            var lp = transformPoint4(lm, x, y, z, 1.0);
            return projectChassisPointToPx(lp[0], lp[1], lp[2], s);
          };

          var cb0 = projCapPt(-CAP_BASE_HALF, 0, CAP_BASE_HALF);
          var cb1 = projCapPt(CAP_BASE_HALF, 0, CAP_BASE_HALF);
          var cb2 = projCapPt(CAP_BASE_HALF, 0, -CAP_BASE_HALF);
          var cb3 = projCapPt(-CAP_BASE_HALF, 0, -CAP_BASE_HALF);

          var ct0 = projCapPt(-CAP_TOP_HALF, CAP_HEIGHT, CAP_TOP_HALF);
          var ct1 = projCapPt(CAP_TOP_HALF, CAP_HEIGHT, CAP_TOP_HALF);
          var ct2 = projCapPt(CAP_TOP_HALF, CAP_HEIGHT, -CAP_TOP_HALF);
          var ct3 = projCapPt(-CAP_TOP_HALF, CAP_HEIGHT, -CAP_TOP_HALF);

          var sideRgb = shadeRgb(kc.capRgb || hexToRgb01(kc.cap), 0.74);
          fillProjectedPoly(ctx, [cb0, cb1, ct1, ct0], rgb01ToCss(sideRgb));
          fillProjectedPoly(ctx, [cb1, cb2, ct2, ct1], rgb01ToCss(shadeRgb(sideRgb, 0.88)));
          fillProjectedPoly(ctx, [cb3, cb0, ct0, ct3], rgb01ToCss(shadeRgb(sideRgb, 1.12)));
          fillProjectedPoly(ctx, [ct0, ct1, ct2, ct3], kc.cap);

          if (ct3 && ct1 && ct0 && ct2) {
            var centerX = (ct0[0] + ct1[0] + ct2[0] + ct3[0]) * 0.25;
            var centerY = (ct0[1] + ct1[1] + ct2[1] + ct3[1]) * 0.25;
            var capPxH = Math.max(14 * s, Math.hypot(ct0[0] - ct3[0], ct0[1] - ct3[1]));
            ctx.save();
            var baseStealthAlpha = palette.isLight ? 0.78 : 0.68;
            ctx.globalAlpha = mixScalar(Math.min(1.0, baseStealthAlpha + keyHoverCur[idx] * 0.22), 1.0, availMix2);
            ctx.fillStyle = kc.legend;
            ctx.textAlign = 'left';
            ctx.textBaseline = 'top';
            ctx.font = (isAvail ? '600 ' : '500 ') + Math.max(6, Math.round(capPxH * (isAvail ? 0.19 : 0.15))) + 'px system-ui, sans-serif';
            ctx.fillText(String(sl.numLabel || sl.z || ''), ct3[0] + 3 * s, ct3[1] + 2 * s);

            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.font = (isAvail ? '700 ' : '500 ') + Math.max(9, Math.round(capPxH * (isAvail ? 0.44 : 0.35))) + 'px system-ui, sans-serif';
            ctx.fillText(sl.symbol, centerX, centerY + capPxH * 0.08);
            ctx.restore();
          }
        }

        if (enableAuxPad) {
          var aOrder = [0, 1, 2, 3, 4, 5];
          aOrder.sort(function (a, b) {
            var la = auxKeyLiftCur[a] > 0.1 ? 100 : auxSlotCoords[a].row;
            var lb = auxKeyLiftCur[b] > 0.1 ? 100 : auxSlotCoords[b].row;
            return la - lb;
          });
          for (var aoi = 0; aoi < aOrder.length; aoi++) {
            var aIdx = aOrder[aoi];
            var aSlot = state.auxModels[aIdx] || DEFAULT_AUX_MODELS[aIdx];
            var aAvMix2 = clamp(auxAvailCur[aIdx], 0, 1);
            var aAv = aAvMix2 > 0.5;
            var aHeroC = aAvMix2 > 0.001
              ? clamp(
                  Math.max(
                    auxKeyLiftCur[aIdx],
                    aIdx === 0 ? orchLatchCur : 0,
                    (state.selectedAuxIndex === aIdx && !(aIdx === 0 && state.orchLatched)) ? 1.0 : (aIdx === 0 ? 0.0 : 0.28)
                  ) * aAvMix2,
                  0,
                  1
                )
              : 0.0;
            var akc2 = resolveAuxKeyColors(aSlot, aIdx, palette, aHeroC);
            var alm2 = auxKeyLocalMats[aIdx];

            var projAuxCapPt = function (x, y, z) {
              var lp2 = transformPoint4(alm2, x, y, z, 1.0);
              return projectAuxChassisPointToPx(lp2[0], lp2[1], lp2[2], s);
            };

            var acb0 = projAuxCapPt(-CAP_BASE_HALF, 0, CAP_BASE_HALF);
            var acb1 = projAuxCapPt(CAP_BASE_HALF, 0, CAP_BASE_HALF);
            var acb2 = projAuxCapPt(CAP_BASE_HALF, 0, -CAP_BASE_HALF);
            var acb3 = projAuxCapPt(-CAP_BASE_HALF, 0, -CAP_BASE_HALF);

            var act0 = projAuxCapPt(-CAP_TOP_HALF, CAP_HEIGHT, CAP_TOP_HALF);
            var act1 = projAuxCapPt(CAP_TOP_HALF, CAP_HEIGHT, CAP_TOP_HALF);
            var act2 = projAuxCapPt(CAP_TOP_HALF, CAP_HEIGHT, -CAP_TOP_HALF);
            var act3 = projAuxCapPt(-CAP_TOP_HALF, CAP_HEIGHT, -CAP_TOP_HALF);

            var aSideRgb = shadeRgb(akc2.capRgb || hexToRgb01(akc2.cap), 0.74);
            fillProjectedPoly(ctx, [acb0, acb1, act1, act0], rgb01ToCss(aSideRgb));
            fillProjectedPoly(ctx, [acb1, acb2, act2, act1], rgb01ToCss(shadeRgb(aSideRgb, 0.88)));
            fillProjectedPoly(ctx, [acb3, acb0, act0, act3], rgb01ToCss(shadeRgb(aSideRgb, 1.12)));
            fillProjectedPoly(ctx, [act0, act1, act2, act3], akc2.cap);

            if (act3 && act1 && act0 && act2) {
              var acx = (act0[0] + act1[0] + act2[0] + act3[0]) * 0.25;
              var acy = (act0[1] + act1[1] + act2[1] + act3[1]) * 0.25;
              var acapPxH = Math.max(14 * s, Math.hypot(act0[0] - act3[0], act0[1] - act3[1]));
              ctx.save();
              ctx.globalAlpha = aAv ? 1.0 : 0.65;
              ctx.fillStyle = akc2.legend;
              ctx.textAlign = 'center';
              ctx.textBaseline = 'middle';
              ctx.font = (aAv ? '700 ' : '500 ') + Math.max(8, Math.round(acapPxH * 0.34)) + 'px system-ui, sans-serif';
              ctx.fillText(String(aSlot.shortLabel || '—'), acx, acy + acapPxH * 0.06);
              ctx.restore();
            }
          }
        }

        ctx.restore();
      }

      function renderFrame() {
        if (disposed) return;
        if (rendererMode === 'webgl2' && (!gl || !glObjs || contextLost)) return;
        var palette = getPalette();
        var tp = state.themeProfile || {};
        var di = state.deckInfo;
        var accentHex = tp.primaryHex || '#5694BD';
        if (!tp.isMono) {
          if (di && di.isAuxModel && di.accentHex) {
            accentHex = di.accentHex;
          } else if (enableAuxPad && state.selectedAuxIndex !== null && state.selectedAuxIndex !== undefined) {
            var selAux = state.auxModels[state.selectedAuxIndex] || DEFAULT_AUX_MODELS[state.selectedAuxIndex];
            if (selAux && selAux.accentHex) accentHex = selAux.accentHex;
          } else {
            var activeElemZ = (di && di.isAvailable && di.z) ? Number(di.z) : state.selectedZ;
            if (activeElemZ && ARTISAN_BY_Z[activeElemZ]) {
              accentHex = ARTISAN_BY_Z[activeElemZ].cap;
            }
          }
        }
        syncOffscreenTextures(palette, accentHex);

        var switchInfo = resolveActiveSwitchInfo(palette);

        if (rendererMode === 'webgl2') {
          renderWebGL2Frame(palette, switchInfo);
        } else {
          activeShadowMapSize = resolveTargetShadowMapSize();
          renderCanvas2DFrame(palette, switchInfo);
        }
        hasInitialRender = true;
        perfStats.frameDraws++;
      }

      /* ============================================================================
       * 12. Self-Managed rAF Animation Loop (Dynamic 60/120/180/native Cap + True 0fps Sleep + < IDLE_EPS Auto-Settle)
       * ============================================================================ */
      function cancelAnimLoop() {
        if (rafId && root && typeof root.cancelAnimationFrame === 'function') {
          root.cancelAnimationFrame(rafId);
        }
        rafId = 0;
        lastFrameMs = 0;
        lastDrawAt = 0;
      }

      function onAnimFrame(now) {
        rafId = 0;
        if (disposed || contextLost) return;
        if (isEffectivelyPaused()) {
          pendingRenderWhilePaused = Boolean(pendingRenderWhilePaused || !idle);
          lastFrameMs = 0;
          lastDrawAt = 0;
          return;
        }
        var ts = typeof now === 'number' && Number.isFinite(now) ? now : readNowMs(root);
        var minFrameGapMs = resolveMinFrameGapMs(resolveTargetFps());
        if (minFrameGapMs > 0 && lastDrawAt > 0 && ts >= lastDrawAt && (ts - lastDrawAt) < minFrameGapMs) {
          if (!idle || pendingRenderWhilePaused) {
            scheduleAnimLoop(pendingRenderWhilePaused);
          }
          return;
        }

        var dt = lastFrameMs > 0 && ts > lastFrameMs ? clamp((ts - lastFrameMs) / 1000, 0.001, 0.05) : 1 / 60;
        lastFrameMs = ts;
        lastDrawAt = ts;
        pendingRenderWhilePaused = false;

        advanceSprings(dt);
        renderFrame();

        if (!idle && !isEffectivelyPaused()) {
          scheduleAnimLoop(false);
        } else {
          lastFrameMs = 0;
          lastDrawAt = 0;
        }
      }

      function scheduleAnimLoop(allowSinglePendingFrame) {
        if (disposed || contextLost || isEffectivelyPaused()) return;
        if (idle && !allowSinglePendingFrame) return;
        if (!rafId && root && typeof root.requestAnimationFrame === 'function') {
          rafId = root.requestAnimationFrame(onAnimFrame);
        }
        if (onWakeFrame) {
          try {
            onWakeFrame();
          } catch (_e) {
            /* ignore external hook error */
          }
        }
      }

      function syncHostPauseState(wasPausedBefore) {
        if (disposed) return;
        var nowPaused = isEffectivelyPaused();
        if (oledPainter && typeof oledPainter.setPaused === 'function') {
          oledPainter.setPaused(nowPaused);
        }
        if (nowPaused) {
          if (!idle) {
            pendingRenderWhilePaused = true;
          }
          cancelAnimLoop();
          cancelAsyncOledCoalesce();
          return;
        }
        if (wasPausedBefore && (!idle || pendingRenderWhilePaused)) {
          if (isMotionReduced()) {
            pendingRenderWhilePaused = false;
            advanceSprings(0.016);
            renderFrame();
            cancelAnimLoop();
          } else if (root && typeof root.requestAnimationFrame === 'function') {
            scheduleAnimLoop(pendingRenderWhilePaused);
          } else {
            pendingRenderWhilePaused = false;
            advanceSprings(0.016);
            renderFrame();
          }
        }
      }

      function setPaused(paused) {
        if (disposed) return;
        var wasPaused = isEffectivelyPaused();
        explicitPaused = Boolean(paused);
        syncHostPauseState(wasPaused);
      }

      function onVisibilityChange() {
        if (disposed) return;
        syncHostPauseState(!isEffectivelyPaused());
      }

      function onHostRootAttrMutated() {
        if (disposed) return;
        if (oledPainter) {
          if (typeof oledPainter.setTargetFps === 'function' && explicitTargetFps === null) {
            oledPainter.setTargetFps(null);
          }
          if (typeof oledPainter.setMotionLevel === 'function' && explicitMotionLevel === null) {
            oledPainter.setMotionLevel(null);
          }
        }
        var desiredShSize = resolveTargetShadowMapSize();
        var shChanged = desiredShSize !== activeShadowMapSize;
        if (shChanged) {
          ensureShadowMapSize(desiredShSize);
        }
        var nowPaused = isEffectivelyPaused();
        if (oledPainter && typeof oledPainter.setPaused === 'function') {
          oledPainter.setPaused(nowPaused);
        }
        if (nowPaused) {
          if (!idle) pendingRenderWhilePaused = true;
          cancelAnimLoop();
          cancelAsyncOledCoalesce();
          return;
        }
        if (isMotionReduced()) {
          if (!idle || pendingRenderWhilePaused || shChanged) {
            pendingRenderWhilePaused = false;
            advanceSprings(0.016);
            renderFrame();
            cancelAnimLoop();
          }
          return;
        }
        if (!idle || pendingRenderWhilePaused || shChanged) {
          pendingRenderWhilePaused = true;
          if (root && typeof root.requestAnimationFrame === 'function') {
            scheduleAnimLoop(true);
          } else {
            pendingRenderWhilePaused = false;
            renderFrame();
          }
        }
      }

      if (doc && typeof doc.addEventListener === 'function') {
        try {
          doc.addEventListener('visibilitychange', onVisibilityChange, false);
          visibilityListenerBound = true;
        } catch (_visErr) {
          visibilityListenerBound = false;
        }
      }
      var MutObsCtor = (root && typeof root.MutationObserver === 'function')
        ? root.MutationObserver
        : (typeof MutationObserver === 'function' ? MutationObserver : null);
      if (MutObsCtor && doc && doc.documentElement) {
        try {
          attrMutationObserver = new MutObsCtor(onHostRootAttrMutated);
          attrMutationObserver.observe(doc.documentElement, {
            attributes: true,
            attributeFilter: ['data-ag-cs-win-blur', 'data-ag-cs-target-fps', 'data-ag-cs-motion'],
          });
        } catch (_moErr) {
          attrMutationObserver = null;
        }
      }

      function wakeAndRenderSync() {
        if (disposed) return;
        if (isEffectivelyPaused()) {
          pendingRenderWhilePaused = true;
          cancelAnimLoop();
          return;
        }
        if (isMotionReduced()) {
          advanceSprings(0.016);
          renderFrame();
          cancelAnimLoop();
          return;
        }
        idle = false;
        recomputePointerTargets();
        updateTransforms();
        renderFrame();
        scheduleAnimLoop(false);
      }

      /**
       * Async single-rAF wakeup for high-frequency input (pointermove orbit drag / hover tracking):
       * Schedules one VSync-aligned frame instead of synchronous WebGL redraws inside input handlers.
       */
      function requestWake() {
        if (disposed) return;
        if (isEffectivelyPaused()) {
          pendingRenderWhilePaused = true;
          cancelAnimLoop();
          return;
        }
        if (isMotionReduced()) {
          advanceSprings(0.016);
          renderFrame();
          cancelAnimLoop();
          return;
        }
        idle = false;
        scheduleAnimLoop(false);
      }

      /* ============================================================================
       * 13. True 3D Ray Unprojection Picking pick(clientX, clientY) & Dual-Peripheral Projected Rect Export
       * ============================================================================ */
      function pick(clientX, clientY) {
        if (disposed) return null;
        var rect = readCanvasCssRect(false);
        var rw = rect.width > 1 ? rect.width : cssWidth;
        var rh = rect.height > 1 ? rect.height : cssHeight;
        if (rw > 80 && rh > 60 && (Math.abs(rw - cssWidth) > 0.01 || Math.abs(rh - cssHeight) > 0.01)) {
          cssWidth = rw;
          cssHeight = rh;
          updateTransforms();
        }
        var lx = clientX - rect.left;
        var ly = clientY - rect.top;
        if (lx < 0 || ly < 0 || lx > rw || ly > rh) return null;

        var ndcX = (lx / rw) * 2.0 - 1.0;
        var ndcY = 1.0 - (ly / rh) * 2.0;

        var ivp = invViewProjMat;
        var nearX = ivp[0] * ndcX + ivp[4] * ndcY - ivp[8] + ivp[12];
        var nearY = ivp[1] * ndcX + ivp[5] * ndcY - ivp[9] + ivp[13];
        var nearZ = ivp[2] * ndcX + ivp[6] * ndcY - ivp[10] + ivp[14];
        var nearW = ivp[3] * ndcX + ivp[7] * ndcY - ivp[11] + ivp[15];

        var farX = ivp[0] * ndcX + ivp[4] * ndcY + ivp[8] + ivp[12];
        var farY = ivp[1] * ndcX + ivp[5] * ndcY + ivp[9] + ivp[13];
        var farZ = ivp[2] * ndcX + ivp[6] * ndcY + ivp[10] + ivp[14];
        var farW = ivp[3] * ndcX + ivp[7] * ndcY + ivp[11] + ivp[15];

        if (Math.abs(nearW) < 1e-7 || Math.abs(farW) < 1e-7) return null;

        var oxW = nearX / nearW, oyW = nearY / nearW, ozW = nearZ / nearW;
        var dxW = farX / farW - oxW, dyW = farY / farW - oyW, dzW = farZ / farW - ozW;
        var lenW = Math.sqrt(dxW * dxW + dyW * dyW + dzW * dzW) || 1;
        dxW /= lenW; dyW /= lenW; dzW /= lenW;

        var icm = invChassisMat;
        var rox = icm[0] * oxW + icm[4] * oyW + icm[8] * ozW + icm[12];
        var roy = icm[1] * oxW + icm[5] * oyW + icm[9] * ozW + icm[13];
        var roz = icm[2] * oxW + icm[6] * oyW + icm[10] * ozW + icm[14];
        var rdx = icm[0] * dxW + icm[4] * dyW + icm[8] * dzW;
        var rdy = icm[1] * dxW + icm[5] * dyW + icm[9] * dzW;
        var rdz = icm[2] * dxW + icm[6] * dyW + icm[10] * dzW;
        var rLen = Math.sqrt(rdx * rdx + rdy * rdy + rdz * rdz) || 1;
        rdx /= rLen; rdy /= rLen; rdz /= rLen;

        var bestHit = null;
        var bestT = Infinity;
        var bestHitKind = null;
        var bestHitIdx = -1;

        var midH = CAP_HEIGHT * 0.50;
        var topHitHalf = CAP_TOP_HALF + 0.032;
        var botHitHalf = CAP_BASE_HALF * 0.96;
        var capMaxY = CAP_HEIGHT + 0.015;
        var keyZoneTopY = CAP_Y_BASE + EFFORT_TIER_LIFTS[3] + 1.25;
        var chM = chassisMat;
        var invRdx = Math.abs(rdx) >= 1e-8 ? 1.0 / rdx : 0;
        var invRdy = Math.abs(rdy) >= 1e-8 ? 1.0 / rdy : 0;
        var invRdz = Math.abs(rdz) >= 1e-8 ? 1.0 / rdz : 0;

        function checkMainKeySlotFast(i) {
          var lm = keyLocalMats[i];
          var lmx = lm[12], lmy = lm[13], lmz = lm[14];
          var bMinX = lmx - 0.85, bMaxX = lmx + 0.85;
          var bMinY = lmy - 0.36, bMaxY = lmy + 0.98;
          var bMinZ = lmz - 0.85, bMaxZ = lmz + 0.85;
          var tmin = -Infinity, tmax = Infinity;
          if (invRdx === 0) {
            if (rox < bMinX || rox > bMaxX) return;
          } else {
            var tx1 = (bMinX - rox) * invRdx, tx2 = (bMaxX - rox) * invRdx;
            if (tx1 > tx2) { var ttmp = tx1; tx1 = tx2; tx2 = ttmp; }
            if (tx1 > tmin) tmin = tx1;
            if (tx2 < tmax) tmax = tx2;
            if (tmin > tmax) return;
          }
          if (invRdy === 0) {
            if (roy < bMinY || roy > bMaxY) return;
          } else {
            var ty1 = (bMinY - roy) * invRdy, ty2 = (bMaxY - roy) * invRdy;
            if (ty1 > ty2) { var ttmp2 = ty1; ty1 = ty2; ty2 = ttmp2; }
            if (ty1 > tmin) tmin = ty1;
            if (ty2 < tmax) tmax = ty2;
            if (tmin > tmax) return;
          }
          if (invRdz === 0) {
            if (roz < bMinZ || roz > bMaxZ) return;
          } else {
            var tz1 = (bMinZ - roz) * invRdz, tz2 = (bMaxZ - roz) * invRdz;
            if (tz1 > tz2) { var ttmp3 = tz1; tz1 = tz2; tz2 = ttmp3; }
            if (tz1 > tmin) tmin = tz1;
            if (tz2 < tmax) tmax = tz2;
            if (tmin > tmax) return;
          }
          if (tmax < 0) return;
          var tBroad = tmin >= 0 ? tmin : tmax;
          if (tBroad > bestT) return;

          var invCap = keyLocalInvMats[i];
          if (!keyLocalInvValid[i]) {
            if (!mat4Invert(invCap, lm)) return;
            keyLocalInvValid[i] = 1;
          }

          var oCx = invCap[0] * rox + invCap[4] * roy + invCap[8] * roz + invCap[12];
          var oCy = invCap[1] * rox + invCap[5] * roy + invCap[9] * roz + invCap[13];
          var oCz = invCap[2] * rox + invCap[6] * roy + invCap[10] * roz + invCap[14];
          var dCx = invCap[0] * rdx + invCap[4] * rdy + invCap[8] * rdz;
          var dCy = invCap[1] * rdx + invCap[5] * rdy + invCap[9] * rdz;
          var dCz = invCap[2] * rdx + invCap[6] * rdy + invCap[10] * rdz;
          var dCLen = Math.sqrt(dCx * dCx + dCy * dCy + dCz * dCz) || 1;
          dCx /= dCLen; dCy /= dCLen; dCz /= dCLen;

          var tTopL = intersectRayAABB(
            oCx, oCy, oCz, dCx, dCy, dCz,
            -topHitHalf, midH, -topHitHalf - 0.025,
            topHitHalf, capMaxY, topHitHalf
          );
          var tBotL = intersectRayAABB(
            oCx, oCy, oCz, dCx, dCy, dCz,
            -botHitHalf, 0.0, -botHitHalf,
            botHitHalf, midH, botHitHalf
          );
          var tLocal = (tTopL >= 0 && tBotL >= 0) ? Math.min(tTopL, tBotL) : (tTopL >= 0 ? tTopL : tBotL);
          if (tLocal < 0) return;

          var hlx = oCx + dCx * tLocal;
          var hly = oCy + dCy * tLocal;
          var hlz = oCz + dCz * tLocal;
          var hChX = lm[0] * hlx + lm[4] * hly + lm[8] * hlz + lm[12];
          var hChY = lm[1] * hlx + lm[5] * hly + lm[9] * hlz + lm[13];
          var hChZ = lm[2] * hlx + lm[6] * hly + lm[10] * hlz + lm[14];
          var hWX = chM[0] * hChX + chM[4] * hChY + chM[8] * hChZ + chM[12];
          var hWY = chM[1] * hChX + chM[5] * hChY + chM[9] * hChZ + chM[13];
          var hWZ = chM[2] * hChX + chM[6] * hChY + chM[10] * hChZ + chM[14];
          var dwx = hWX - oxW, dwy = hWY - oyW, dwz = hWZ - ozW;
          var tKey = Math.sqrt(dwx * dwx + dwy * dwy + dwz * dwz);

          if (tKey < bestT) {
            var sl = slots[i];
            var zVal = sl.slotZ !== undefined ? sl.slotZ : sl.z;
            bestT = tKey;
            bestHitKind = 'key';
            bestHitIdx = i;
            bestHit = {
              kind: 'key',
              z: sl.z,
              slotZ: zVal,
              available: isSlotAvailable(zVal) || isSlotAvailable(sl.z),
            };
          }
        }

        /* 1. Main chassis broad-phase AABB cull + last-hit fast path + 7-row bucketing + cached inverse matrix test */
        var mainKeysBroadT = intersectRayAABB(
          rox, roy, roz, rdx, rdy, rdz,
          -CASE_HALF_W, PLATE_Y - 0.15, CASE_Z_MIN,
          CASE_HALF_W, keyZoneTopY, CASE_Z_MAX
        );
        if (mainKeysBroadT >= 0) {
          var skipMainIdx = (lastPickKind === 'key' && lastPickIdx >= 0 && lastPickIdx < slotCount) ? lastPickIdx : -1;
          if (skipMainIdx >= 0) {
            checkMainKeySlotFast(skipMainIdx);
          }
          for (var rbi = 0; rbi < mainRowBuckets.length; rbi++) {
            var rb = mainRowBuckets[rbi];
            var tRow = intersectRayAABB(
              rox, roy, roz, rdx, rdy, rdz,
              rb.minX, PLATE_Y - 0.25, rb.minZ,
              rb.maxX, keyZoneTopY, rb.maxZ
            );
            if (tRow < 0 || tRow > bestT) continue;
            var rInds = rb.indices;
            for (var rii = 0; rii < rInds.length; rii++) {
              var slotIdx = rInds[rii];
              if (slotIdx === skipMainIdx) continue;
              checkMainKeySlotFast(slotIdx);
            }
          }
        }

        /* 1b. Right 2x3 aux pad broad-phase AABB cull + cached inverse matrix test */
        var hasAuxRay = false;
        var aox = 0, aoy = 0, aoz = 0, adx = 0, ady = 0, adz = 0;
        if (enableAuxPad) {
          var iacm = invAuxChassisMat;
          aox = iacm[0] * oxW + iacm[4] * oyW + iacm[8] * ozW + iacm[12];
          aoy = iacm[1] * oxW + iacm[5] * oyW + iacm[9] * ozW + iacm[13];
          aoz = iacm[2] * oxW + iacm[6] * oyW + iacm[10] * ozW + iacm[14];
          adx = iacm[0] * dxW + iacm[4] * dyW + iacm[8] * dzW;
          ady = iacm[1] * dxW + iacm[5] * dyW + iacm[9] * dzW;
          adz = iacm[2] * dxW + iacm[6] * dyW + iacm[10] * dzW;
          var aLen = Math.sqrt(adx * adx + ady * ady + adz * adz) || 1;
          adx /= aLen; ady /= aLen; adz /= aLen;
          hasAuxRay = true;

          var auxKeysBroadT = intersectRayAABB(
            aox, aoy, aoz, adx, ady, adz,
            AUX_CASE_X_MIN, PLATE_Y - 0.15, AUX_CASE_Z_MIN,
            AUX_CASE_X_MAX, keyZoneTopY, AUX_CASE_Z_MAX
          );
          if (auxKeysBroadT >= 0) {
            var achM = auxChassisMat;
            var skipAuxIdx = (lastPickKind === 'aux-key' && lastPickIdx >= 0 && lastPickIdx < AUX_SLOT_COUNT) ? lastPickIdx : -1;
            for (var akPass = (skipAuxIdx >= 0 ? -1 : 0); akPass < AUX_SLOT_COUNT; akPass++) {
              var ak = akPass < 0 ? skipAuxIdx : akPass;
              if (akPass >= 0 && ak === skipAuxIdx) continue;
              var alm = auxKeyLocalMats[ak];
              var tABroad = intersectRayAABB(
                aox, aoy, aoz, adx, ady, adz,
                alm[12] - 0.85, alm[13] - 0.36, alm[14] - 0.85,
                alm[12] + 0.85, alm[13] + 0.98, alm[14] + 0.85
              );
              if (tABroad < 0 || tABroad > bestT) continue;

              var invAuxCap = auxKeyLocalInvMats[ak];
              if (!auxKeyLocalInvValid[ak]) {
                if (!mat4Invert(invAuxCap, alm)) continue;
                auxKeyLocalInvValid[ak] = 1;
              }

              var oACx = invAuxCap[0] * aox + invAuxCap[4] * aoy + invAuxCap[8] * aoz + invAuxCap[12];
              var oACy = invAuxCap[1] * aox + invAuxCap[5] * aoy + invAuxCap[9] * aoz + invAuxCap[13];
              var oACz = invAuxCap[2] * aox + invAuxCap[6] * aoy + invAuxCap[10] * aoz + invAuxCap[14];
              var dACx = invAuxCap[0] * adx + invAuxCap[4] * ady + invAuxCap[8] * adz;
              var dACy = invAuxCap[1] * adx + invAuxCap[5] * ady + invAuxCap[9] * adz;
              var dACz = invAuxCap[2] * adx + invAuxCap[6] * ady + invAuxCap[10] * adz;
              var dACLen = Math.hypot(dACx, dACy, dACz) || 1;
              dACx /= dACLen; dACy /= dACLen; dACz /= dACLen;

              var tATop = intersectRayAABB(
                oACx, oACy, oACz, dACx, dACy, dACz,
                -topHitHalf, midH, -topHitHalf - 0.025,
                topHitHalf, capMaxY, topHitHalf
              );
              var tABot = intersectRayAABB(
                oACx, oACy, oACz, dACx, dACy, dACz,
                -botHitHalf, 0.0, -botHitHalf,
                botHitHalf, midH, botHitHalf
              );
              var tALocal = (tATop >= 0 && tABot >= 0) ? Math.min(tATop, tABot) : (tATop >= 0 ? tATop : tABot);
              if (tALocal < 0) continue;

              var ahlx = oACx + dACx * tALocal;
              var ahly = oACy + dACy * tALocal;
              var ahlz = oACz + dACz * tALocal;
              var aChX = alm[0] * ahlx + alm[4] * ahly + alm[8] * ahlz + alm[12];
              var aChY = alm[1] * ahlx + alm[5] * ahly + alm[9] * ahlz + alm[13];
              var aChZ = alm[2] * ahlx + alm[6] * ahly + alm[10] * ahlz + alm[14];
              var aWX = achM[0] * aChX + achM[4] * aChY + achM[8] * aChZ + achM[12];
              var aWY = achM[1] * aChX + achM[5] * aChY + achM[9] * aChZ + achM[13];
              var aWZ = achM[2] * aChX + achM[6] * aChY + achM[10] * aChZ + achM[14];
              var tAuxKey = Math.hypot(aWX - oxW, aWY - oyW, aWZ - ozW);

              if (tAuxKey < bestT) {
                var aSlot = state.auxModels[ak] || DEFAULT_AUX_MODELS[ak];
                bestT = tAuxKey;
                bestHitKind = 'aux-key';
                bestHitIdx = ak;
                bestHit = {
                  kind: 'aux-key',
                  auxIndex: ak,
                  id: aSlot.id,
                  available: Boolean(aSlot.available),
                };
              }
            }
          }
        }

        /* 2. Exact ray test against Row 1 4 physical 3D hardware controls (zero projection overhead) */
        var ctrlBoxes = computeControlPickBounds();
        for (var ci = 0; ci < ctrlBoxes.length; ci++) {
          var cb = ctrlBoxes[ci];
          var tCtrl = intersectRayAABB(
            rox, roy, roz, rdx, rdy, rdz,
            cb.minX, cb.minY, cb.minZ,
            cb.maxX, cb.maxY, cb.maxZ
          );
          if (tCtrl >= 0) {
            var hxC = rox + rdx * tCtrl;
            var hyC = roy + rdy * tCtrl;
            var hzC = roz + rdz * tCtrl;
            var hitValid = true;
            if (cb.shape === 'disc' && cb.radius > 0) {
              hitValid = Math.hypot(hxC - cb.cx3d, hzC - cb.cz3d) <= cb.radius + 0.025;
            }
            if (hitValid) {
              var cWX = chM[0] * hxC + chM[4] * hyC + chM[8] * hzC + chM[12];
              var cWY = chM[1] * hxC + chM[5] * hyC + chM[9] * hzC + chM[13];
              var cWZ = chM[2] * hxC + chM[6] * hyC + chM[10] * hzC + chM[14];
              var tCtrlW = Math.hypot(cWX - oxW, cWY - oyW, cWZ - ozW);
              if (tCtrlW < bestT) {
                bestT = tCtrlW;
                bestHitKind = 'control';
                bestHitIdx = ci;
                bestHit = { kind: 'control', id: cb.id, action: cb.action };
              }
            }
          }
        }

        /* 3. Ray-plane test on OLED glass y = DECK_GLASS_Y for effort capsule hit regions (u, v) */
        if (Math.abs(rdy) > 1e-6) {
          var tOled = (DECK_GLASS_Y - roy) / rdy;
          if (tOled >= 0) {
            var oledHitX = rox + rdx * tOled;
            var oledHitZ = roz + rdz * tOled;
            var oWX = chM[0] * oledHitX + chM[4] * DECK_GLASS_Y + chM[8] * oledHitZ + chM[12];
            var oWY = chM[1] * oledHitX + chM[5] * DECK_GLASS_Y + chM[9] * oledHitZ + chM[13];
            var oWZ = chM[2] * oledHitX + chM[6] * DECK_GLASS_Y + chM[10] * oledHitZ + chM[14];
            var tOledW = Math.hypot(oWX - oxW, oWY - oyW, oWZ - ozW);
            if (tOledW < bestT) {
              var uScreen = (oledHitX - DECK_X_MIN) / (DECK_X_MAX - DECK_X_MIN);
              var vScreen = (oledHitZ - DECK_Z_MIN) / (DECK_Z_MAX - DECK_Z_MIN);
              if (uScreen >= 0 && uScreen <= 1 && vScreen >= 0 && vScreen <= 1) {
                var effortCaps = computeEffortButtonLayouts();
                for (var ei = 0; ei < effortCaps.length; ei++) {
                  var ef = effortCaps[ei];
                  if (uScreen >= ef.u0 && uScreen <= ef.u1 && vScreen >= ef.v0 && vScreen <= ef.v1) {
                    bestT = tOledW;
                    bestHitKind = 'effort';
                    bestHitIdx = ei;
                    bestHit = { kind: 'effort', effort: ef.effort };
                    break;
                  }
                }
              }
            }
          }
        }

        if (bestHit) {
          lastPickKind = bestHitKind;
          lastPickIdx = bestHitIdx;
          return bestHit;
        }
        lastPickKind = null;
        lastPickIdx = -1;

        /* 4. Ray-box test against main & aux Step-Bezel CNC aluminum chassis (including rotated sides & tapered underbody) */
        var tChassis = intersectRayAABB(
          rox, roy, roz, rdx, rdy, rdz,
          -CASE_HALF_W, CASE_Y_BOT - 0.04, CASE_Z_MIN,
          CASE_HALF_W, CASE_Y_TOP + 0.05, CASE_Z_MAX
        );
        if (tChassis >= 0) {
          var chHitX = rox + rdx * tChassis;
          var chHitZ = roz + rdz * tChassis - (CASE_Z_MIN + CASE_Z_MAX) * 0.5;
          var halfD = (CASE_Z_MAX - CASE_Z_MIN) * 0.5;
          if (sdRoundedBox2D(chHitX, chHitZ, CASE_HALF_W, halfD, CASE_CORNER_R) <= 0.10) {
            return { kind: 'chassis' };
          }
        }

        if (enableAuxPad && hasAuxRay) {
          var tAuxChassis = intersectRayAABB(
            aox, aoy, aoz, adx, ady, adz,
            AUX_CASE_X_MIN, CASE_Y_BOT - 0.04, AUX_CASE_Z_MIN,
            AUX_CASE_X_MAX, CASE_Y_TOP + 0.05, AUX_CASE_Z_MAX
          );
          if (tAuxChassis >= 0) {
            var aChX = aox + adx * tAuxChassis - AUX_CENTER_X;
            var aChZ = aoz + adz * tAuxChassis - AUX_CENTER_Z;
            var aHalfW = (AUX_CASE_X_MAX - AUX_CASE_X_MIN) * 0.5;
            var aHalfD = (AUX_CASE_Z_MAX - AUX_CASE_Z_MIN) * 0.5;
            if (sdRoundedBox2D(aChX, aChZ, aHalfW, aHalfD, AUX_CASE_CORNER_R) <= 0.10) {
              return { kind: 'chassis' };
            }
          }
        }

        return null;
      }

      function projectBoxToCssRect(minX, minY, minZ, maxX, maxY, maxZ, localMat) {
        var left = Infinity, top = Infinity, right = -Infinity, bottom = -Infinity;
        for (var ix = 0; ix < 2; ix++) {
          var bx = ix === 0 ? minX : maxX;
          for (var iy = 0; iy < 2; iy++) {
            var by = iy === 0 ? minY : maxY;
            for (var iz = 0; iz < 2; iz++) {
              var cx = bx, cy = by, cz = iz === 0 ? minZ : maxZ;
              if (localMat) {
                var lp = transformPoint4(localMat, cx, cy, cz, 1.0, _tmpVec4C);
                cx = lp[0]; cy = lp[1]; cz = lp[2];
              }
              var pt = projectChassisPointToPx(cx, cy, cz, 1.0);
              if (pt) {
                if (pt[0] < left) left = pt[0];
                if (pt[0] > right) right = pt[0];
                if (pt[1] < top) top = pt[1];
                if (pt[1] > bottom) bottom = pt[1];
              }
            }
          }
        }
        if (!Number.isFinite(left)) {
          return { left: 0, top: 0, width: 0, height: 0 };
        }
        return {
          left: Math.round(left * 100) / 100,
          top: Math.round(top * 100) / 100,
          width: Math.max(1, Math.round((right - left) * 100) / 100),
          height: Math.max(1, Math.round((bottom - top) * 100) / 100),
        };
      }

      function projectAuxBoxToCssRect(minX, minY, minZ, maxX, maxY, maxZ, localMat) {
        var left = Infinity, top = Infinity, right = -Infinity, bottom = -Infinity;
        for (var ix = 0; ix < 2; ix++) {
          var bx = ix === 0 ? minX : maxX;
          for (var iy = 0; iy < 2; iy++) {
            var by = iy === 0 ? minY : maxY;
            for (var iz = 0; iz < 2; iz++) {
              var cx = bx, cy = by, cz = iz === 0 ? minZ : maxZ;
              if (localMat) {
                var lp = transformPoint4(localMat, cx, cy, cz, 1.0, _tmpVec4C);
                cx = lp[0]; cy = lp[1]; cz = lp[2];
              }
              var pt = projectAuxChassisPointToPx(cx, cy, cz, 1.0);
              if (pt) {
                if (pt[0] < left) left = pt[0];
                if (pt[0] > right) right = pt[0];
                if (pt[1] < top) top = pt[1];
                if (pt[1] > bottom) bottom = pt[1];
              }
            }
          }
        }
        if (!Number.isFinite(left)) {
          return { left: 0, top: 0, width: 0, height: 0 };
        }
        return {
          left: Math.round(left * 100) / 100,
          top: Math.round(top * 100) / 100,
          width: Math.max(1, Math.round((right - left) * 100) / 100),
          height: Math.max(1, Math.round((bottom - top) * 100) / 100),
        };
      }

      function projectPlanarQuadToCssRect(x0, z0, x1, z1, yPlane) {
        var corners = [
          projectChassisPointToPx(x0, yPlane, z0, 1.0),
          projectChassisPointToPx(x1, yPlane, z0, 1.0),
          projectChassisPointToPx(x1, yPlane, z1, 1.0),
          projectChassisPointToPx(x0, yPlane, z1, 1.0),
        ];
        var left = Infinity, top = Infinity, right = -Infinity, bottom = -Infinity;
        for (var i = 0; i < 4; i++) {
          var pt = corners[i];
          if (pt) {
            if (pt[0] < left) left = pt[0];
            if (pt[0] > right) right = pt[0];
            if (pt[1] < top) top = pt[1];
            if (pt[1] > bottom) bottom = pt[1];
          }
        }
        if (!Number.isFinite(left)) {
          return { left: 0, top: 0, width: 0, height: 0 };
        }
        return {
          left: Math.round(left * 100) / 100,
          top: Math.round(top * 100) / 100,
          width: Math.max(1, Math.round((right - left) * 100) / 100),
          height: Math.max(1, Math.round((bottom - top) * 100) / 100),
        };
      }

      function getInteractiveProjectedRects() {
        var curRect = readCanvasCssRect(false);
        if (
          curRect &&
          curRect.width > 80 &&
          curRect.height > 60 &&
          (Math.abs(curRect.width - cssWidth) > 0.01 || Math.abs(curRect.height - cssHeight) > 0.01)
        ) {
          cssWidth = curRect.width;
          cssHeight = curRect.height;
          updateTransforms();
        }
        var mainChassisRect = projectBoxToCssRect(-CASE_HALF_W, CASE_Y_BOT, CASE_Z_MIN, CASE_HALF_W, CASE_Y_TOP, CASE_Z_MAX, null);
        var auxChassisRect = enableAuxPad
          ? projectAuxBoxToCssRect(AUX_CASE_X_MIN, CASE_Y_BOT, AUX_CASE_Z_MIN, AUX_CASE_X_MAX, CASE_Y_TOP, AUX_CASE_Z_MAX, null)
          : null;
        var chassisRect = mainChassisRect;
        if (auxChassisRect && auxChassisRect.width > 1 && mainChassisRect.width > 1) {
          var uLeft = Math.min(mainChassisRect.left, auxChassisRect.left);
          var uTop = Math.min(mainChassisRect.top, auxChassisRect.top);
          var uRight = Math.max(mainChassisRect.left + mainChassisRect.width, auxChassisRect.left + auxChassisRect.width);
          var uBottom = Math.max(mainChassisRect.top + mainChassisRect.height, auxChassisRect.top + auxChassisRect.height);
          chassisRect = {
            left: Math.round(uLeft * 100) / 100,
            top: Math.round(uTop * 100) / 100,
            width: Math.max(1, Math.round((uRight - uLeft) * 100) / 100),
            height: Math.max(1, Math.round((uBottom - uTop) * 100) / 100),
          };
        }
        var deckRect = projectPlanarQuadToCssRect(DECK_X_MIN, DECK_Z_MIN, DECK_X_MAX, DECK_Z_MAX, DECK_GLASS_Y);

        var keys = [];
        var availableKeys = [];
        for (var i = 0; i < slotCount; i++) {
          var sl = slots[i];
          var zVal = sl.slotZ !== undefined ? sl.slotZ : sl.z;
          var isAvail = isSlotAvailable(zVal) || isSlotAvailable(sl.z);
          var isLifted = keyLiftCur[i] > 0.05;
          var r = projectBoxToCssRect(
            isLifted ? -0.41 : -CAP_TOP_HALF,
            isLifted ? 0.06 : CAP_HEIGHT * 0.55,
            isLifted ? -0.41 : -CAP_TOP_HALF,
            isLifted ? 0.41 : CAP_TOP_HALF,
            CAP_HEIGHT,
            isLifted ? 0.41 : CAP_TOP_HALF,
            keyLocalMats[i]
          );
          var restBaseY = CAP_Y_BASE + slotCoords[i].rowYBias;
          var curOriginY = keyLocalMats[i][13];
          var entry = {
            z: sl.z,
            slotZ: zVal,
            symbol: sl.symbol,
            name: sl.name,
            ar: sl.ar,
            numLabel: sl.numLabel,
            available: isAvail,
            selected: state.selectedZ === zVal || state.selectedZ === sl.z,
            liftY: (Math.round((curOriginY - restBaseY) * 10000) / 10000) + 0,
            left: r.left,
            top: r.top,
            width: r.width,
            height: r.height,
            cx: Math.round((r.left + r.width * 0.5) * 100) / 100,
            cy: Math.round((r.top + r.height * 0.5) * 100) / 100,
          };
          keys.push(entry);
          if (isAvail) availableKeys.push(entry);
        }

        var auxKeys = [];
        if (enableAuxPad) {
          for (var ak = 0; ak < AUX_SLOT_COUNT; ak++) {
            var aSlot = state.auxModels[ak] || DEFAULT_AUX_MODELS[ak];
            var aAvail = Boolean(aSlot && aSlot.available);
            var aLifted = auxKeyLiftCur[ak] > 0.05;
            var ar = projectAuxBoxToCssRect(
              aLifted ? -0.41 : -CAP_TOP_HALF,
              aLifted ? 0.06 : CAP_HEIGHT * 0.55,
              aLifted ? -0.41 : -CAP_TOP_HALF,
              aLifted ? 0.41 : CAP_TOP_HALF,
              CAP_HEIGHT,
              aLifted ? 0.41 : CAP_TOP_HALF,
              auxKeyLocalMats[ak]
            );
            var aRestBaseY = CAP_Y_BASE + auxSlotCoords[ak].rowYBias;
            var aCurOriginY = auxKeyLocalMats[ak][13];
            auxKeys.push({
              auxIndex: ak,
              id: aSlot.id,
              shortLabel: aSlot.shortLabel,
              available: aAvail,
              selected: state.selectedAuxIndex === ak && !(ak === 0 && state.orchLatched),
              latched: ak === 0 ? Boolean(state.orchLatched) : false,
              liftY: (Math.round((aCurOriginY - aRestBaseY) * 10000) / 10000) + 0,
              left: ar.left,
              top: ar.top,
              width: ar.width,
              height: ar.height,
              cx: Math.round((ar.left + ar.width * 0.5) * 100) / 100,
              cy: Math.round((ar.top + ar.height * 0.5) * 100) / 100,
            });
          }
        }

        var effortLayouts = computeEffortButtonLayouts();
        var efforts = effortLayouts.map(function (ef) {
          var er = projectPlanarQuadToCssRect(ef.x0, ef.z0, ef.x1, ef.z1, DECK_GLASS_Y);
          return {
            effort: ef.effort,
            label: ef.label,
            active: ef.active,
            left: er.left,
            top: er.top,
            width: er.width,
            height: er.height,
            cx: Math.round((er.left + er.width * 0.5) * 100) / 100,
            cy: Math.round((er.top + er.height * 0.5) * 100) / 100,
          };
        });

        var rawControls = computeControlLayouts();
        var controlsMap = {};
        var controlList = [];
        for (var cli = 0; cli < rawControls.length; cli++) {
          var rc = rawControls[cli];
          var pubCtrl = {
            id: rc.id,
            action: rc.action,
            left: rc.left,
            top: rc.top,
            width: rc.width,
            height: rc.height,
            cx: rc.cx,
            cy: rc.cy,
            muted: rc.muted,
            isRotated: rc.isRotated,
          };
          controlsMap[rc.id] = pubCtrl;
          controlList.push(pubCtrl);
        }

        return {
          chassis: chassisRect,
          mainChassis: mainChassisRect,
          auxChassis: auxChassisRect,
          deck: deckRect,
          keys: keys,
          availableKeys: availableKeys,
          auxKeys: auxKeys,
          efforts: efforts,
          controls: controlsMap,
          controlList: controlList,
        };
      }

      /* ============================================================================
       * 14. Public API Implementation (1:1 Async Orbit Tracking + 0.88 Momentum Coast + Zero-Leak Dispose)
       * ============================================================================ */
      function applyRubberBandOrbitStep(cur, delta, minVal, maxVal) {
        if (!Number.isFinite(delta) || Math.abs(delta) < 1e-8) return clamp(cur, minVal, maxVal);
        var softZone = 0.18;
        var atten = 1.0;
        if (delta > 0 && cur > maxVal - softZone) {
          var remHi = clamp((maxVal - cur) / softZone, 0.0, 1.0);
          atten = 0.16 + 0.84 * Math.pow(remHi, 1.35);
        } else if (delta < 0 && cur < minVal + softZone) {
          var remLo = clamp((cur - minVal) / softZone, 0.0, 1.0);
          atten = 0.16 + 0.84 * Math.pow(remLo, 1.35);
        }
        return clamp(cur + delta * atten, minVal, maxVal);
      }

      function setChassisOrbit(pitchRad, yawRad) {
        if (disposed) return;
        var nextP = clamp(Number(pitchRad) || 0, ORBIT_PITCH_MIN, ORBIT_PITCH_MAX);
        var nextY = clamp(Number(yawRad) || 0, -ORBIT_YAW_LIMIT, ORBIT_YAW_LIMIT);
        var reducedNow = isMotionReduced();
        chassisInstVelPitch = reducedNow ? 0 : clamp((nextP - orbitPitchCur) * 28.0, -9.0, 9.0);
        chassisInstVelYaw = reducedNow ? 0 : clamp((nextY - orbitYawCur) * 28.0, -9.0, 9.0);
        orbitPitchCur = nextP;
        orbitYawCur = nextY;
        orbitTargetPitch = nextP;
        orbitTargetYaw = nextY;
        auxOrbitPitchCur = reducedNow
          ? nextP
          : clamp(nextP - chassisInstVelPitch * AUX_COORBIT_LAG_RATIO * 0.5, ORBIT_PITCH_MIN, ORBIT_PITCH_MAX);
        auxOrbitYawCur = reducedNow
          ? nextY
          : clamp(nextY - chassisInstVelYaw * AUX_COORBIT_LAG_RATIO * 0.5, -ORBIT_YAW_LIMIT, ORBIT_YAW_LIMIT);
        orbitServoActive = false;
        orbitPitchVel = 0;
        orbitYawVel = 0;
        orbitMode = reducedNow ? 'idle' : 'direct';
        energizeZeroG(ZERO_G_DURATION);
        wakeAndRenderSync();
      }

      function addChassisOrbitDelta(dPitchRad, dYawRad) {
        if (disposed) return;
        var dp = Number(dPitchRad) || 0;
        var dy = Number(dYawRad) || 0;
        var nextP = applyRubberBandOrbitStep(orbitPitchCur, dp, ORBIT_PITCH_MIN, ORBIT_PITCH_MAX);
        var nextY = applyRubberBandOrbitStep(orbitYawCur, dy, -ORBIT_YAW_LIMIT, ORBIT_YAW_LIMIT);
        var reducedNow = isMotionReduced();
        chassisInstVelPitch = reducedNow ? 0 : clamp((nextP - orbitPitchCur) * 42.0, -10.0, 10.0);
        chassisInstVelYaw = reducedNow ? 0 : clamp((nextY - orbitYawCur) * 42.0, -10.0, 10.0);
        orbitPitchCur = nextP;
        orbitYawCur = nextY;
        orbitTargetPitch = nextP;
        orbitTargetYaw = nextY;
        auxOrbitPitchCur = reducedNow
          ? nextP
          : clamp(nextP - chassisInstVelPitch * AUX_COORBIT_LAG_RATIO * 0.5, ORBIT_PITCH_MIN, ORBIT_PITCH_MAX);
        auxOrbitYawCur = reducedNow
          ? nextY
          : clamp(nextY - chassisInstVelYaw * AUX_COORBIT_LAG_RATIO * 0.5, -ORBIT_YAW_LIMIT, ORBIT_YAW_LIMIT);
        orbitServoActive = false;
        orbitPitchVel = 0;
        orbitYawVel = 0;
        orbitMode = reducedNow ? 'idle' : 'direct';
        energizeZeroG(ZERO_G_DURATION);
        wakeAndRenderSync();
      }

      /**
       * V11 1:1 responsive orbit drag tracking:
       * - ORBIT_HYDRAULIC_COUPLE = 0.94 + wn = 38.0, zeta = 0.96 for crisp, lag-free rotation;
       * - Right aux pad co-orbits with ~3.2% graceful zero-G inertial lag;
       * - Updates state and schedules async requestWake() without synchronous WebGL redraws inside pointermove.
       */
      function dragChassisOrbitDelta(dPitchRad, dYawRad) {
        if (disposed) return;
        var dp = Number(dPitchRad) || 0;
        var dy = Number(dYawRad) || 0;
        if (!orbitServoActive) {
          orbitTargetPitch = orbitPitchCur;
          orbitTargetYaw = orbitYawCur;
        }
        var prevTargetP = orbitTargetPitch;
        var prevTargetY = orbitTargetYaw;
        orbitTargetPitch = applyRubberBandOrbitStep(orbitTargetPitch, dp, ORBIT_PITCH_MIN, ORBIT_PITCH_MAX);
        orbitTargetYaw = applyRubberBandOrbitStep(orbitTargetYaw, dy, -ORBIT_YAW_LIMIT, ORBIT_YAW_LIMIT);

        if (isMotionReduced()) {
          orbitPitchCur = orbitTargetPitch;
          orbitYawCur = orbitTargetYaw;
          auxOrbitPitchCur = orbitTargetPitch;
          auxOrbitYawCur = orbitTargetYaw;
          orbitServoActive = false;
          orbitPitchVel = 0;
          orbitYawVel = 0;
          orbitMode = 'idle';
          requestWake();
          return;
        }

        var effDp = orbitTargetPitch - prevTargetP;
        var effDy = orbitTargetYaw - prevTargetY;
        orbitPitchCur = clamp(orbitPitchCur + effDp * ORBIT_HYDRAULIC_COUPLE, ORBIT_PITCH_MIN, ORBIT_PITCH_MAX);
        orbitYawCur = clamp(orbitYawCur + effDy * ORBIT_HYDRAULIC_COUPLE, -ORBIT_YAW_LIMIT, ORBIT_YAW_LIMIT);

        var auxCouple = ORBIT_HYDRAULIC_COUPLE * (1.0 - AUX_COORBIT_LAG_RATIO * 2.2);
        auxOrbitPitchCur = clamp(auxOrbitPitchCur + effDp * auxCouple, ORBIT_PITCH_MIN, ORBIT_PITCH_MAX);
        auxOrbitYawCur = clamp(auxOrbitYawCur + effDy * auxCouple, -ORBIT_YAW_LIMIT, ORBIT_YAW_LIMIT);

        orbitPitchVel = clamp(orbitPitchVel * 0.42 + (effDp / 0.016) * 0.58, -5.2, 5.2);
        orbitYawVel = clamp(orbitYawVel * 0.42 + (effDy / 0.016) * 0.58, -5.2, 5.2);
        chassisInstVelPitch = clamp(orbitPitchVel, -5.5, 5.5);
        chassisInstVelYaw = clamp(orbitYawVel, -5.5, 5.5);
        auxPhaseLiftY = clamp(-chassisInstVelYaw * 0.015, -0.038, 0.038);

        orbitServoActive = true;
        orbitMode = 'servo';
        energizeZeroG(ZERO_G_DURATION);
        recomputePointerTargets();
        updateTransforms();
        requestWake();
      }

      /**
       * V11 high-momentum release coasting (damping ~6.0):
       * Smooth exponential deceleration guaranteed to settle to isIdle() === true in < 160 frames.
       */
      function endChassisOrbitDrag(optVelPitch, optVelYaw) {
        if (disposed) return;
        var hadServo = orbitServoActive;
        orbitServoActive = false;

        if (isMotionReduced()) {
          orbitPitchVel = 0;
          orbitYawVel = 0;
          orbitTargetPitch = orbitPitchCur;
          orbitTargetYaw = orbitYawCur;
          auxOrbitPitchCur = orbitPitchCur;
          auxOrbitYawCur = orbitYawCur;
          orbitMode = 'idle';
          requestWake();
          return;
        }

        var remLagP = hadServo ? (orbitTargetPitch - orbitPitchCur) : 0;
        var remLagY = hadServo ? (orbitTargetYaw - orbitYawCur) : 0;
        var internalVelP = orbitPitchVel * 0.90 + remLagP * 6.0;
        var internalVelY = orbitYawVel * 0.90 + remLagY * 6.0;

        var carryVelP = (optVelPitch !== undefined && Number.isFinite(Number(optVelPitch)))
          ? (Number(optVelPitch) * 0.88 + internalVelP * 0.12)
          : internalVelP;
        var carryVelY = (optVelYaw !== undefined && Number.isFinite(Number(optVelYaw)))
          ? (Number(optVelYaw) * 0.88 + internalVelY * 0.12)
          : internalVelY;
        carryVelP = clamp(carryVelP, -4.8, 4.8);
        carryVelY = clamp(carryVelY, -4.8, 4.8);

        orbitTargetPitch = orbitPitchCur;
        orbitTargetYaw = orbitYawCur;

        /* Cap residual float window <= ZERO_G_FLING_CAP (2.02s ~126 frames) guaranteeing < 160-frame settle to isIdle() === true */
        if (zeroGRemainSec > ZERO_G_FLING_CAP) {
          zeroGRemainSec = ZERO_G_FLING_CAP;
        }

        if (Math.hypot(carryVelP, carryVelY) < 0.008) {
          orbitPitchVel = 0;
          orbitYawVel = 0;
          orbitMode = 'idle';
          energizeZeroG(Math.min(1.45, ZERO_G_FLING_CAP));
          if (zeroGRemainSec > ZERO_G_FLING_CAP) zeroGRemainSec = ZERO_G_FLING_CAP;
          requestWake();
          return;
        }

        orbitPitchVel = carryVelP;
        orbitYawVel = carryVelY;
        orbitMode = 'fling';
        energizeZeroG(ZERO_G_FLING_CAP);
        if (zeroGRemainSec > ZERO_G_FLING_CAP) zeroGRemainSec = ZERO_G_FLING_CAP;
        requestWake();
      }

      function flingChassisOrbit(velPitch, velYaw) {
        if (disposed) return;
        orbitServoActive = false;
        var vp = clamp(Number(velPitch) || 0, -4.8, 4.8);
        var vy = clamp(Number(velYaw) || 0, -4.8, 4.8);
        orbitTargetPitch = orbitPitchCur;
        orbitTargetYaw = orbitYawCur;
        if (isMotionReduced() || Math.hypot(vp, vy) < 0.010) {
          orbitPitchVel = 0;
          orbitYawVel = 0;
          orbitMode = 'idle';
          wakeAndRenderSync();
          return;
        }
        orbitPitchVel = vp;
        orbitYawVel = vy;
        orbitMode = 'fling';
        energizeZeroG(ZERO_G_FLING_CAP);
        if (zeroGRemainSec > ZERO_G_FLING_CAP) zeroGRemainSec = ZERO_G_FLING_CAP;
        wakeAndRenderSync();
      }

      function resetChassisOrbit() {
        if (disposed) return;
        orbitServoActive = false;
        orbitTargetPitch = 0;
        orbitTargetYaw = 0;
        if (
          isMotionReduced() ||
          (Math.hypot(orbitPitchCur, orbitYawCur) < 1e-5 && Math.hypot(auxOrbitPitchCur, auxOrbitYawCur) < 1e-5)
        ) {
          orbitPitchCur = 0;
          orbitYawCur = 0;
          orbitPitchVel = 0;
          orbitYawVel = 0;
          auxOrbitPitchCur = 0;
          auxOrbitYawCur = 0;
          auxOrbitPitchVel = 0;
          auxOrbitYawVel = 0;
          auxPhaseLiftY = 0;
          orbitMode = 'idle';
          updateTransforms();
          recomputePointerTargets();
          if (isEffectivelyPaused()) {
            pendingRenderWhilePaused = true;
          } else {
            renderFrame();
          }
          return;
        }
        orbitMode = 'reset';
        energizeZeroG(ZERO_G_FLING_CAP);
        wakeAndRenderSync();
      }

      function getChassisOrbit() {
        return {
          pitch: orbitPitchCur,
          yaw: orbitYawCur,
          auxPitch: auxOrbitPitchCur,
          auxYaw: auxOrbitYawCur,
          isRotated: Math.hypot(orbitPitchCur, orbitYawCur) > 0.008,
        };
      }

      function triggerIntroWake() {
        if (disposed) return;
        if (isMotionReduced()) {
          introActive = false;
          sweepWaveWeight = 0.0;
          if (isEffectivelyPaused()) {
            pendingRenderWhilePaused = true;
          } else {
            renderFrame();
          }
          return;
        }
        introActive = true;
        introElapsed = 0.0;
        sweepWaveX = -12.4;
        sweepWaveWeight = 0.05;
        shadowDirty = true;
        energizeZeroG(ZERO_G_DURATION);
        /* Coalesce intro wake onto next VSync frame to avoid redundant synchronous redraws during open() + setState() */
        requestWake();
      }

      function triggerWaveRipple(originZ, strength) {
        if (disposed || isMotionReduced()) return;
        var ox = 0.0;
        var oz = 0.38;
        var resolved = false;
        if (originZ === 'prism-wave') {
          ox = ARTISAN_WAVE_X;
          oz = ROW1_Z;
          resolved = true;
        } else if (originZ && typeof originZ === 'object') {
          if (Number.isFinite(Number(originZ.x)) && Number.isFinite(Number(originZ.z))) {
            ox = Number(originZ.x);
            oz = Number(originZ.z);
            resolved = true;
          } else if (originZ.auxIndex !== undefined && originZ.auxIndex !== null) {
            var objAuxIdx = clamp(Math.round(Number(originZ.auxIndex)), 0, AUX_SLOT_COUNT - 1);
            if (Number.isFinite(objAuxIdx) && auxSlotCoords[objAuxIdx]) {
              ox = auxSlotCoords[objAuxIdx].x;
              oz = auxSlotCoords[objAuxIdx].z;
              resolved = true;
            }
          } else if (originZ.z !== undefined && originZ.z !== null) {
            var objZIdx = slotIndexByZ.get(Number(originZ.z));
            if (objZIdx !== undefined) {
              ox = slotCoords[objZIdx].x;
              oz = slotCoords[objZIdx].z;
              resolved = true;
            }
          }
        } else if (typeof originZ === 'string' && /^aux[-:]?\d+$/i.test(originZ)) {
          var mAux = parseInt(originZ.replace(/\D+/g, ''), 10);
          if (mAux >= 0 && mAux < AUX_SLOT_COUNT) {
            ox = auxSlotCoords[mAux].x;
            oz = auxSlotCoords[mAux].z;
            resolved = true;
          }
        } else if (typeof originZ === 'string' && originZ.trim()) {
          var lowOrigin = originZ.trim().toLowerCase();
          for (var amIdx = 0; amIdx < AUX_SLOT_COUNT; amIdx++) {
            var amSlot = state.auxModels[amIdx] || DEFAULT_AUX_MODELS[amIdx];
            if (amSlot && String(amSlot.id || '').toLowerCase() === lowOrigin) {
              ox = auxSlotCoords[amIdx].x;
              oz = auxSlotCoords[amIdx].z;
              resolved = true;
              break;
            }
          }
        }

        if (!resolved) {
          var targetZ = originZ !== undefined && originZ !== null ? originZ : state.selectedZ;
          var oIdx = slotIndexByZ.get(targetZ);
          if (oIdx === undefined && targetZ !== null && targetZ !== undefined) {
            oIdx = slotIndexByZ.get(Number(targetZ));
          }
          if (oIdx !== undefined) {
            ox = slotCoords[oIdx].x;
            oz = slotCoords[oIdx].z;
          } else if (enableAuxPad && state.selectedAuxIndex !== null && state.selectedAuxIndex !== undefined) {
            var selA = clamp(Math.round(Number(state.selectedAuxIndex)), 0, AUX_SLOT_COUNT - 1);
            ox = auxSlotCoords[selA].x;
            oz = auxSlotCoords[selA].z;
          }
        }

        var amp = clamp(strength === undefined ? 1.0 : Number(strength) || 1.0, 0.15, 1.6);
        if (waveRipples.length >= 2) {
          waveRipples.shift();
        }
        waveRipples.push({ ox: ox, oz: oz, elapsed: 0.0, strength: amp });
        shadowDirty = true;
        keycapInstanceDirty = true;
        energizeZeroG(ZERO_G_DURATION);
        wakeAndRenderSync();
      }

      function applyHardwareStatePatch(patch) {
        if (!patch || typeof patch !== 'object') return false;
        var cur = state.hardwareState;
        var changed = false;
        if (patch.muted !== undefined) {
          var nextMuted = Boolean(patch.muted);
          if (cur.muted !== nextMuted) {
            cur.muted = nextMuted;
            state.topControls.muted = nextMuted;
            knobAngleTarget = (nextMuted ? 0.48 : -0.38) + knobSpinOffset;
            changed = true;
          }
        }
        var rawHov = patch.hoveredControl !== undefined ? patch.hoveredControl : patch.hoveredBtn;
        if (rawHov !== undefined) {
          var nextHov = rawHov ? String(rawHov) : null;
          if (cur.hoveredControl !== nextHov) {
            cur.hoveredControl = nextHov;
            state.topControls.hoveredBtn = nextHov;
            changed = true;
          }
        }
        var rawPrs = patch.pressedControl !== undefined ? patch.pressedControl : patch.pressedBtn;
        if (rawPrs !== undefined) {
          var nextPrs = rawPrs ? String(rawPrs) : null;
          if (cur.pressedControl !== nextPrs) {
            cur.pressedControl = nextPrs;
            state.topControls.pressedBtn = nextPrs;
            changed = true;
          }
        }
        return changed;
      }

      function setHardwareState(patch) {
        if (disposed) return;
        if (!applyHardwareStatePatch(patch)) return;
        wakeAndRenderSync();
      }

      function triggerControlPress(action) {
        if (disposed) return;
        var cIdx = resolveControlIndex(action);
        if (cIdx < 0) return;
        if (isMotionReduced()) {
          if (isEffectivelyPaused()) pendingRenderWhilePaused = true;
          else renderFrame();
          return;
        }
        ctrlPulseRemain[cIdx] = CTRL_PULSE_DURATION;
        if (cIdx === 2) {
          knobAngleVel += state.hardwareState.muted ? 2.4 : -2.4;
        }
        shadowDirty = true;
        wakeAndRenderSync();
      }

      function rotateKnobStep(deltaSteps) {
        if (disposed) return;
        var stepNum = Number(deltaSteps);
        if (!Number.isFinite(stepNum) || stepNum === 0) return;
        knobSpinOffset += stepNum * (Math.PI / 6);
        knobAngleTarget = (state.hardwareState && state.hardwareState.muted ? 0.48 : -0.38) + knobSpinOffset;
        shadowDirty = true;
        if (isMotionReduced()) {
          knobAngleCur = knobAngleTarget;
          knobAngleVel = 0;
          if (isEffectivelyPaused()) pendingRenderWhilePaused = true;
          else renderFrame();
          return;
        }
        knobAngleVel += stepNum * 4.2;
        wakeAndRenderSync();
      }

      function triggerBlindKeyPress(slotZ) {
        if (disposed) return;
        var idx = slotIndexByZ.get(Number(slotZ));
        if (idx === undefined) return;
        if (isMotionReduced()) {
          if (isEffectivelyPaused()) pendingRenderWhilePaused = true;
          else renderFrame();
          return;
        }
        blindTapIdx = idx;
        blindTapRemain = BLIND_TAP_DURATION;
        shadowDirty = true;
        wakeAndRenderSync();
      }

      function triggerEnergyPulse(levelNorm) {
        if (disposed || isMotionReduced()) return;
        var lv = levelNorm === undefined ? 0.78 : clamp(Number(levelNorm) || 0.5, 0.0, 1.0);
        energyPulseActive = true;
        energyPulseElapsed = 0.0;
        energyPulseAmp = 0.58 + 0.42 * lv;
        energyPulseVal = 0.18 * energyPulseAmp;
        energizeZeroG(ZERO_G_DURATION);
        wakeAndRenderSync();
      }

      function resize(nextCssW, nextCssH, nextDpr, optBoundsRect) {
        if (disposed) return;
        var prevCssW = cssWidth;
        var prevCssH = cssHeight;
        var prevDpr = dpr;
        cssWidth = Math.max(64, Number(nextCssW) || cssWidth || 1040);
        cssHeight = Math.max(48, Number(nextCssH) || cssHeight || 552);
        /* Cap DPR at 1.5 (preserves native 1.0 at DPR=1 while slashing fill-rate & MSAA bandwidth on 2K/4K displays) */
        dpr = Math.min(1.5, Math.max(1, Number(nextDpr) || 1));
        if (optBoundsRect && typeof optBoundsRect === 'object') {
          cachedCanvasRect = {
            left: Number(optBoundsRect.left) || 0,
            top: Number(optBoundsRect.top) || 0,
            width: cssWidth,
            height: cssHeight,
          };
          if (canvas) lastCanvasRectFn = canvas.getBoundingClientRect;
        } else if (cachedCanvasRect) {
          cachedCanvasRect.width = cssWidth;
          cachedCanvasRect.height = cssHeight;
          if (canvas && typeof canvas.getBoundingClientRect === 'function') {
            try {
              var freshR = canvas.getBoundingClientRect();
              lastCanvasRectFn = canvas.getBoundingClientRect;
              if (freshR && Number.isFinite(Number(freshR.left))) {
                cachedCanvasRect.left = Number(freshR.left) || 0;
                cachedCanvasRect.top = Number(freshR.top) || 0;
              }
            } catch (_reErr) {}
          }
        } else {
          readCanvasCssRect(true);
          if (cachedCanvasRect) {
            cachedCanvasRect.width = cssWidth;
            cachedCanvasRect.height = cssHeight;
          }
        }
        var targetW = Math.max(1, Math.round(cssWidth * dpr));
        var targetH = Math.max(1, Math.round(cssHeight * dpr));
        var canvasResized = false;
        if (canvas) {
          if (canvas.width !== targetW) {
            canvas.width = targetW;
            canvasResized = true;
          }
          if (canvas.height !== targetH) {
            canvas.height = targetH;
            canvasResized = true;
          }
        }
        /* Skip redundant full-frame redraw when canvas size and DPR are unchanged after first paint */
        if (hasInitialRender && !canvasResized && prevCssW === cssWidth && prevCssH === cssHeight && prevDpr === dpr) {
          return;
        }
        /* Viewport resize does not affect ortho light shadow depth or local keycap matrices; keep shadowDirty / keycapInstanceDirty clean */
        updateTransforms();
        recomputePointerTargets();
        if (hasInitialRender && isEffectivelyPaused()) {
          pendingRenderWhilePaused = true;
        } else {
          renderFrame();
        }
      }

      function normalizeOptionalIndex(val) {
        if (val === null || val === undefined || val === '') return null;
        var n = Number(val);
        if (!Number.isFinite(n)) return null;
        var idx = Math.round(n);
        return (idx >= 0 && idx < AUX_SLOT_COUNT) ? idx : null;
      }

      function setState(nextState, setOpts) {
        if (disposed || !nextState) return;
        var prevSelectedZ = state.selectedZ;
        var prevHoveredZ = state.hoveredZ;
        var prevSelectedAux = state.selectedAuxIndex;
        var prevHoveredAux = state.hoveredAuxIndex;
        var prevOrchLatched = Boolean(state.orchLatched);
        var prevAuxPage = state.auxPage;
        var prevEffortTier = resolveEffortTier(state.deckInfo);
        var wasSlamGlobal = isConfirmSlamActiveGlobal();

        if (nextState.targetFps !== undefined) {
          if (nextState.targetFps === null || nextState.targetFps === '') {
            explicitTargetFps = null;
          } else {
            explicitTargetFps = normalizeTargetFps(nextState.targetFps);
          }
          if (oledPainter && typeof oledPainter.setTargetFps === 'function') {
            oledPainter.setTargetFps(explicitTargetFps);
          }
        }
        if (nextState.motionLevel !== undefined) {
          if (nextState.motionLevel === null || nextState.motionLevel === '') {
            explicitMotionLevel = null;
          } else {
            explicitMotionLevel = normalizeMotionLevel(nextState.motionLevel);
          }
          if (oledPainter && typeof oledPainter.setMotionLevel === 'function') {
            oledPainter.setMotionLevel(explicitMotionLevel);
          }
          ensureShadowMapSize(resolveTargetShadowMapSize());
        }
        if (nextState.reducedMotion !== undefined) {
          state.reducedMotion = Boolean(nextState.reducedMotion);
          ensureShadowMapSize(resolveTargetShadowMapSize());
        }
        if (nextState.paused !== undefined) {
          setPaused(Boolean(nextState.paused));
        }

        var reducedNow = isMotionReduced();

        if (nextState.themeProfile) {
          state.themeProfile = Object.assign({}, state.themeProfile, nextState.themeProfile);
          keycapInstanceDirty = true;
        }
        if (nextState.orchLatched !== undefined) {
          state.orchLatched = Boolean(nextState.orchLatched);
        }
        if (nextState.availableByZ !== undefined) {
          state.availableByZ = nextState.availableByZ;
          keycapInstanceDirty = true;
          if (!hasSyncedInitialAvail || reducedNow) {
            hasSyncedInitialAvail = true;
            for (var initSi = 0; initSi < slotCount; initSi++) {
              var initSl = slots[initSi];
              var initZVal = initSl.slotZ !== undefined ? initSl.slotZ : initSl.z;
              slotAvailCur[initSi] = (isSlotAvailable(initZVal) || isSlotAvailable(initSl.z)) ? 1.0 : 0.0;
            }
          }
        }
        if (nextState.auxModels !== undefined) {
          state.auxModels = normalizeAuxModels(nextState.auxModels);
          keycapInstanceDirty = true;
          if ((!hasSyncedInitialAuxAvail && !state.orchLatched && !prevOrchLatched) || reducedNow) {
            hasSyncedInitialAuxAvail = true;
            for (var syncAi = 0; syncAi < AUX_SLOT_COUNT; syncAi++) {
              var syncASlot = state.auxModels[syncAi] || DEFAULT_AUX_MODELS[syncAi];
              auxAvailCur[syncAi] = syncASlot && syncASlot.available ? 1.0 : 0.0;
            }
          } else {
            hasSyncedInitialAuxAvail = true;
          }
        }
        if (nextState.auxPageCount !== undefined) {
          state.auxPageCount = Math.max(1, Math.floor(Number(nextState.auxPageCount) || 1));
        }
        if (nextState.auxPage !== undefined) {
          var nextPageNum = Math.max(0, Math.floor(Number(nextState.auxPage) || 0));
          if (nextState.auxPageCount !== undefined) {
            nextPageNum = clamp(nextPageNum, 0, Math.max(0, state.auxPageCount - 1));
          } else if (nextPageNum >= state.auxPageCount) {
            state.auxPageCount = nextPageNum + 1;
          }
          state.auxPage = nextPageNum;
        }
        if (state.auxPage !== prevAuxPage) {
          shadowDirty = true;
          lastAuxAtlasSig = '';
          keycapInstanceDirty = true;
          if (reducedNow) {
            auxPageWaveActive = false;
            auxPageWaveElapsed = 0;
          } else {
            auxPageWaveActive = true;
            auxPageWaveElapsed = 0;
            auxPageWaveDir = state.auxPage > prevAuxPage ? 1 : -1;
          }
        }
        if (nextState.stageMode !== undefined) {
          var nextStageModeVal = nextState.stageMode === 'drawer' ? 'drawer' : 'fullscreen';
          if (nextStageModeVal !== state.stageMode) {
            state.stageMode = nextStageModeVal;
            shadowDirty = true;
          }
        }
        if (nextState.selectedZ !== undefined) {
          state.selectedZ = nextState.selectedZ;
        }
        if (nextState.selectedAuxIndex !== undefined) {
          state.selectedAuxIndex = normalizeOptionalIndex(nextState.selectedAuxIndex);
        }

        /* V12 #0 Orch latch invariant: #0 never levitates when latched so only one primary planner key floats */
        if (state.orchLatched && state.selectedAuxIndex === 0) {
          state.selectedAuxIndex = null;
          auxKeyLiftCur[0] = 0.0;
          auxKeyLiftVel[0] = 0.0;
        }

        /* Global mutual-exclusion contract between main element keys and right 2x3 aux pad keys */
        if (
          nextState.selectedAuxIndex !== undefined &&
          state.selectedAuxIndex !== null &&
          !(nextState.selectedZ !== undefined && nextState.selectedZ !== null)
        ) {
          state.selectedZ = null;
        } else if (
          nextState.selectedZ !== undefined &&
          state.selectedZ !== null &&
          !(nextState.selectedAuxIndex !== undefined && normalizeOptionalIndex(nextState.selectedAuxIndex) !== null && !(state.orchLatched && normalizeOptionalIndex(nextState.selectedAuxIndex) === 0))
        ) {
          state.selectedAuxIndex = null;
        }

        if (nextState.hoveredZ !== undefined) {
          state.hoveredZ = nextState.hoveredZ;
        }
        if (nextState.pressedZ !== undefined) {
          state.pressedZ = nextState.pressedZ;
        }
        if (nextState.confirmSlamZ !== undefined) {
          state.confirmSlamZ = nextState.confirmSlamZ;
        }
        if (nextState.hoveredAuxIndex !== undefined) {
          state.hoveredAuxIndex = normalizeOptionalIndex(nextState.hoveredAuxIndex);
        }
        if (nextState.pressedAuxIndex !== undefined) {
          state.pressedAuxIndex = normalizeOptionalIndex(nextState.pressedAuxIndex);
        }
        if (nextState.confirmSlamAuxIndex !== undefined) {
          state.confirmSlamAuxIndex = normalizeOptionalIndex(nextState.confirmSlamAuxIndex);
        }
        if (nextState.confirmSlamActive !== undefined) {
          state.confirmSlamActive = Boolean(nextState.confirmSlamActive);
        }
        if (nextState.lockedShakeZ !== undefined) {
          state.lockedShakeZ = nextState.lockedShakeZ;
        }
        if (nextState.lockedShakeAuxIndex !== undefined) {
          var rawAuxShake = nextState.lockedShakeAuxIndex;
          if (rawAuxShake === null || rawAuxShake === undefined || rawAuxShake === '') {
            state.lockedShakeAuxIndex = null;
            auxShakeActiveIdx = -1;
            auxShakeProgress = 1.0;
          } else if (typeof rawAuxShake === 'object') {
            var objShakeIdx = normalizeOptionalIndex(
              rawAuxShake.auxIndex !== undefined ? rawAuxShake.auxIndex : rawAuxShake.index
            );
            if (objShakeIdx !== null) {
              state.lockedShakeAuxIndex = rawAuxShake;
              if (rawAuxShake.progress === undefined) {
                auxShakeActiveIdx = objShakeIdx;
                auxShakeProgress = reducedNow ? 1.0 : 0.14;
              }
            } else {
              state.lockedShakeAuxIndex = null;
            }
          } else {
            var numShakeIdx = normalizeOptionalIndex(rawAuxShake);
            state.lockedShakeAuxIndex = numShakeIdx;
            if (numShakeIdx !== null) {
              auxShakeActiveIdx = numShakeIdx;
              auxShakeProgress = reducedNow ? 1.0 : 0.14;
            } else {
              auxShakeActiveIdx = -1;
              auxShakeProgress = 1.0;
            }
          }
        }
        if (nextState.deckInfo !== undefined) {
          state.deckInfo = nextState.deckInfo;
        }
        if (nextState.topControls) {
          state.topControls = Object.assign({}, state.topControls, nextState.topControls);
          applyHardwareStatePatch(nextState.topControls);
        }
        if (nextState.hardwareState) {
          applyHardwareStatePatch(nextState.hardwareState);
        }

        /* V12 #0 Orch tactile latch response: crosses actuation detent (~78% < -0.10U) then locks via spring to -0.135U */
        if (prevOrchLatched !== state.orchLatched) {
          auxKeyLiftCur[0] = 0.0;
          auxKeyLiftVel[0] = 0.0;
          if (reducedNow) {
            orchLatchCur = state.orchLatched ? 1.0 : 0.0;
            orchLatchVel = 0.0;
          } else if (state.orchLatched) {
            if (orchLatchCur < 0.78) orchLatchCur = 0.78;
            orchLatchVel = 1.8;
            if (!isConfirmSlamActiveGlobal()) {
              energizeZeroG(1.80);
            }
          } else {
            if (orchLatchCur > 0.28) orchLatchCur = 0.28;
            orchLatchVel = -2.2;
            if (!isConfirmSlamActiveGlobal()) {
              energizeZeroG(1.65);
            }
          }
        } else if (reducedNow) {
          orchLatchCur = state.orchLatched ? 1.0 : 0.0;
          orchLatchVel = 0.0;
        }

        var nextEffortTier = resolveEffortTier(state.deckInfo);
        effortTierCur = nextEffortTier;
        if (reducedNow) {
          effortLiftHeightCur = EFFORT_TIER_LIFTS[nextEffortTier];
          effortLiftHeightVel = 0;
        }

        var selectionChanged = (prevSelectedZ !== state.selectedZ) || (prevSelectedAux !== state.selectedAuxIndex);
        if (selectionChanged) {
          fltLiftPitch = 0;
          fltLiftRoll = 0;
          fltLiftYaw = 0;
          fltLiftMagX = 0;
          fltLiftMagZ = 0;
          liftPitchCur *= 0.20;
          liftRollCur *= 0.20;
          liftYawCur *= 0.20;
          liftMagXCur *= 0.20;
          liftMagZCur *= 0.20;
          liftPitchVel = 0;
          liftRollVel = 0;
          liftYawVel = 0;
          liftMagXVel = 0;
          liftMagZVel = 0;
          if ((state.selectedZ !== null || state.selectedAuxIndex !== null) && !isConfirmSlamActiveGlobal()) {
            energizeZeroG(ZERO_G_DURATION);
          }
        } else if (prevEffortTier !== nextEffortTier && !isConfirmSlamActiveGlobal()) {
          energizeZeroG(ZERO_G_DURATION);
        } else if (
          ((prevHoveredZ !== state.hoveredZ && state.hoveredZ !== null) ||
           (prevHoveredAux !== state.hoveredAuxIndex && state.hoveredAuxIndex !== null)) &&
          !isConfirmSlamActiveGlobal()
        ) {
          energizeZeroG(1.65);
        }

        var nowSlamGlobal = isConfirmSlamActiveGlobal();
        if (!wasSlamGlobal && nowSlamGlobal) {
          fltLiftPitch = 0;
          fltLiftRoll = 0;
          fltLiftYaw = 0;
          fltLiftMagX = 0;
          fltLiftMagZ = 0;
          liftPitchCur *= 0.12;
          liftRollCur *= 0.12;
          liftYawCur *= 0.12;
          liftMagXCur *= 0.12;
          liftMagZCur *= 0.12;
          liftPitchVel = 0;
          liftRollVel = 0;
          liftYawVel = 0;
          liftMagXVel = 0;
          liftMagZVel = 0;
          zeroGRemainSec = 0;
          zeroGEnvCur = 0;

          var slamTargetZ = state.confirmSlamZ !== null && state.confirmSlamZ !== undefined
            ? state.confirmSlamZ
            : state.selectedZ;
          var slamIdx = slotIndexByZ.get(slamTargetZ);
          if (slamIdx !== undefined && !reducedNow) {
            if (keyLiftCur[slamIdx] > 0.05) {
              keyLiftVel[slamIdx] = -15.5;
            }
          }

          var slamTargetAux = state.confirmSlamAuxIndex !== null && state.confirmSlamAuxIndex !== undefined
            ? state.confirmSlamAuxIndex
            : state.selectedAuxIndex;
          if (slamTargetAux !== null && slamTargetAux !== undefined && slamTargetAux >= 0 && slamTargetAux < AUX_SLOT_COUNT && !reducedNow) {
            if (auxKeyLiftCur[slamTargetAux] > 0.05) {
              auxKeyLiftVel[slamTargetAux] = -15.5;
            }
          }
        }

        if (prevSelectedZ !== state.selectedZ && state.selectedZ !== null && !nowSlamGlobal) {
          var sIdx = slotIndexByZ.get(state.selectedZ);
          if (sIdx !== undefined && keyLiftCur[sIdx] === 0 && !reducedNow) {
            keyLiftCur[sIdx] = 0.32;
          }
        }
        if (enableAuxPad && prevSelectedAux !== state.selectedAuxIndex && state.selectedAuxIndex !== null && !nowSlamGlobal) {
          var saIdx = state.selectedAuxIndex;
          if (saIdx >= 0 && saIdx < AUX_SLOT_COUNT && auxKeyLiftCur[saIdx] === 0 && !reducedNow) {
            auxKeyLiftCur[saIdx] = 0.32;
          }
        }
        if (setOpts && setOpts.deferRender === true) {
          recomputePointerTargets();
          requestWake();
        } else {
          wakeAndRenderSync();
        }
      }

      function setPointerClient(clientX, clientY, inside) {
        if (disposed) return;
        var cx = Number(clientX);
        var cy = Number(clientY);
        var isInside = inside !== false && Number.isFinite(cx) && Number.isFinite(cy);
        var wasIdle = idle;

        pointerMode = 'client';
        lastClientInside = isInside;
        lastClientX = cx;
        lastClientY = cy;
        updatePrismFocusPosition();
        recomputePointerTargets();

        /* When pointer leaves canvas (inside=false) with no active global effect, cap remaining float time for clean 0fps settle */
        if (!isInside && !introActive && !energyPulseActive && waveRipples.length === 0 && !auxPageWaveActive && orbitMode === 'idle' && !orbitServoActive) {
          zeroGRemainSec = 0;
          zeroGEnvCur = 0;
        }

        /* Distant (> radiusPx, e.g. >300px) pointer motion while springs are at rest:
         * Maintain 0 rAF and idle === true sleep (zero synchronous WebGL redraws blocking pointermove) */
        if (!nearTrackingActive && isMagneticSpringAtRest() && idle) {
          return;
        }

        if (isMotionReduced()) {
          if (isEffectivelyPaused()) {
            pendingRenderWhilePaused = true;
            cancelAnimLoop();
            return;
          }
          advanceSprings(0.016);
          renderFrame();
          cancelAnimLoop();
          return;
        }

        if (isInside && nearTrackingActive) {
          energizeZeroG(ZERO_G_DURATION);
        }

        if (wasIdle && nearTrackingActive) {
          fltLiftPitch = tgtLiftPitch * 0.90;
          fltLiftRoll = tgtLiftRoll * 0.90;
          fltLiftYaw = tgtLiftYaw * 0.90;
          fltLiftMagX = tgtLiftMagX * 0.90;
          fltLiftMagZ = tgtLiftMagZ * 0.90;

          liftPitchCur += (tgtLiftPitch - liftPitchCur) * 0.28;
          liftRollCur += (tgtLiftRoll - liftRollCur) * 0.28;
          liftYawCur += (tgtLiftYaw - liftYawCur) * 0.28;
          liftMagXCur += (tgtLiftMagX - liftMagXCur) * 0.28;
          liftMagZCur += (tgtLiftMagZ - liftMagZCur) * 0.28;

          liftPitchVel = (tgtLiftPitch - liftPitchCur) * 9.5;
          liftRollVel = (tgtLiftRoll - liftRollCur) * 9.5;
          liftYawVel = (tgtLiftYaw - liftYawCur) * 9.5;
          liftMagXVel = (tgtLiftMagX - liftMagXCur) * 10.0;
          liftMagZVel = (tgtLiftMagZ - liftMagZCur) * 10.0;
          updateTransforms();
        }

        requestWake();
      }

      function setPointerNorm(nx, ny, inside) {
        if (disposed) return;
        pointerMode = 'norm';
        if (inside === false) {
          pointerTargetX = 0;
          pointerTargetY = 0;
        } else {
          pointerTargetX = clamp(Number(nx) || 0, -1.6, 1.6);
          pointerTargetY = clamp(Number(ny) || 0, -1.6, 1.6);
          energizeZeroG(ZERO_G_DURATION);
        }
        recomputePointerTargets();
        requestWake();
      }

      function showSessionSyncedBadge(label, durationMs) {
        if (disposed) return;
        var painter = ensureOledPainter();
        if (painter && typeof painter.showSessionSyncedBadge === 'function') {
          painter.showSessionSyncedBadge(label, durationMs, animClockMs);
          lastOledSig = '';
          lastOledDiscreteSig = '';
          lastOledCoreSig = '';
          lastOledUploadMs = -1;
          oledPendingFlush = false;
          wakeAndRenderSync();
        }
      }

      function releaseCaches() {
        if (oledPainter && typeof oledPainter.releaseCaches === 'function') {
          try {
            oledPainter.releaseCaches();
          } catch (_rcErr) {}
        }
      }

      function getPerfStats() {
        var curMotion = resolveMotionLevel();
        var curFps = resolveTargetFps();
        var curShadowSize = (glObjs && glObjs.shadowPass && glObjs.shadowPass.size)
          ? glObjs.shadowPass.size
          : activeShadowMapSize;
        return {
          shadowDraws: perfStats.shadowDraws,
          shadowSkips: perfStats.shadowSkips,
          frameDraws: perfStats.frameDraws,
          dynMeshRebuilds: perfStats.dynMeshRebuilds,
          dpr: dpr,
          shadowMapSize: curShadowSize,
          targetFps: curFps,
          motionLevel: curMotion,
          paused: isEffectivelyPaused(),
          idle: Boolean(idle || disposed),
        };
      }

      function step(dtSec) {
        if (disposed) return true;
        advanceSprings(dtSec);
        renderFrame();
        if (idle) {
          cancelAnimLoop();
        }
        return idle;
      }

      function isIdle() {
        return Boolean(idle || disposed);
      }

      function getRendererMode() {
        return rendererMode;
      }

      function dispose() {
        if (disposed) return;
        disposed = true;
        idle = true;
        pendingRenderWhilePaused = false;
        cancelAnimLoop();

        if (visibilityListenerBound && doc && typeof doc.removeEventListener === 'function') {
          try {
            doc.removeEventListener('visibilitychange', onVisibilityChange, false);
          } catch (_visRemErr) {}
          visibilityListenerBound = false;
        }
        if (attrMutationObserver && typeof attrMutationObserver.disconnect === 'function') {
          try {
            attrMutationObserver.disconnect();
          } catch (_moDiscErr) {}
          attrMutationObserver = null;
        }

        fltLiftPitch = 0;
        fltLiftRoll = 0;
        fltLiftYaw = 0;
        fltLiftMagX = 0;
        fltLiftMagZ = 0;
        liftPitchVel = 0;
        liftRollVel = 0;
        liftYawVel = 0;
        liftMagXVel = 0;
        liftMagZVel = 0;
        orbitServoActive = false;
        orbitPitchVel = 0;
        orbitYawVel = 0;
        auxOrbitPitchVel = 0;
        auxOrbitYawVel = 0;
        gyroPitchVel = 0;
        gyroRollVel = 0;
        gyroYawVel = 0;
        effortLiftHeightVel = 0;
        neighborSympathyVel = 0;
        waveRipples.length = 0;
        auxPageWaveActive = false;
        auxPageWaveElapsed = 0;
        shadowDirty = true;
        lastShadowGeomSig = '';
        lastShadowDrawClockMs = -1000;
        lastDynMeshSig = '';
        lastKeycapInstSig = '';

        cancelAsyncOledCoalesce();
        if (oledPainter && typeof oledPainter.dispose === 'function') {
          try {
            oledPainter.dispose();
          } catch (_oledDisposeErr) {
            /* ignore */
          }
        }
        oledPainter = null;

        if (canvas && typeof canvas.removeEventListener === 'function') {
          canvas.removeEventListener('webglcontextlost', onWebglContextLost, false);
          canvas.removeEventListener('webglcontextrestored', onWebglContextRestored, false);
        }

        if (gl) {
          try {
            if (typeof gl.bindFramebuffer === 'function') {
              gl.bindFramebuffer(gl.FRAMEBUFFER || 0x8d40, null);
            }
            gl.bindVertexArray(null);
            gl.bindBuffer(gl.ARRAY_BUFFER, null);
            gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null);
            gl.activeTexture(gl.TEXTURE0 + 3);
            gl.bindTexture(gl.TEXTURE_2D, null);
            gl.activeTexture(gl.TEXTURE0 + 2);
            gl.bindTexture(gl.TEXTURE_2D, null);
            gl.activeTexture(gl.TEXTURE0 + 1);
            gl.bindTexture(gl.TEXTURE_2D, null);
            gl.activeTexture(gl.TEXTURE0);
            gl.bindTexture(gl.TEXTURE_2D, null);
            gl.useProgram(null);

            if (typeof gl.deleteFramebuffer === 'function') {
              for (var fbi = 0; fbi < glRes.framebuffers.length; fbi++) {
                gl.deleteFramebuffer(glRes.framebuffers[fbi]);
              }
            }
            for (var ti = 0; ti < glRes.textures.length; ti++) {
              gl.deleteTexture(glRes.textures[ti]);
            }
            for (var bi = 0; bi < glRes.buffers.length; bi++) {
              gl.deleteBuffer(glRes.buffers[bi]);
            }
            for (var vi = 0; vi < glRes.vaos.length; vi++) {
              gl.deleteVertexArray(glRes.vaos[vi]);
            }
            for (var pi = 0; pi < glRes.programs.length; pi++) {
              gl.deleteProgram(glRes.programs[pi]);
            }
            for (var shi = 0; shi < glRes.shaders.length; shi++) {
              gl.deleteShader(glRes.shaders[shi]);
            }
            var loseExt = gl.getExtension('WEBGL_lose_context');
            if (loseExt && typeof loseExt.loseContext === 'function') {
              loseExt.loseContext();
            }
          } catch (_disposeErr) {
            /* ignore context already lost */
          }
        }

        var offSurfs = [oledSurf, atlasSurf, auxStripSurf];
        for (var osi = 0; osi < offSurfs.length; osi++) {
          if (offSurfs[osi] && offSurfs[osi].canvas && !offSurfs[osi].sharedCached) {
            try {
              offSurfs[osi].canvas.width = 0;
              offSurfs[osi].canvas.height = 0;
            } catch (_surfErr) {}
            offSurfs[osi].ctx = null;
            offSurfs[osi].canvas = null;
          }
        }

        glRes = { programs: [], shaders: [], buffers: [], vaos: [], textures: [], framebuffers: [] };
        glObjs = null;
        gl = null;
        ctx2d = null;
        oledSurf = null;
        atlasSurf = null;
        auxStripSurf = null;
        activeOledCanvas = null;
        lastOledDiscreteSig = '';
        lastOledCoreSig = '';
        lastOledUploadMs = -1;
        oledPendingFlush = false;
        oledCoreTransitionStep = false;
        hasLiftedKeycapCavity = false;
        lastPickKind = null;
        lastPickIdx = -1;
        keyLocalInvValid.fill(0);
        auxKeyLocalInvValid.fill(0);
      }

      /* Synchronous static convergence on first frame (zero residual rAF) */
      effortTierCur = resolveEffortTier(state.deckInfo);
      effortLiftHeightCur = EFFORT_TIER_LIFTS[effortTierCur];
      if (state.selectedAuxIndex !== null && state.selectedAuxIndex !== undefined && enableAuxPad) {
        auxKeyLiftCur[state.selectedAuxIndex] = 1.0;
      } else {
        var initIdx = slotIndexByZ.get(state.selectedZ);
        if (initIdx !== undefined) {
          keyLiftCur[initIdx] = 1.0;
        }
      }
      neighborSympathyCur = (
        (state.selectedZ !== null && state.selectedZ !== undefined) ||
        (enableAuxPad && state.selectedAuxIndex !== null && state.selectedAuxIndex !== undefined)
      ) ? NEIGHBOR_SYMPATHY_LIFTS[effortTierCur] : 0.0;
      resize(cssWidth, cssHeight, (root && root.devicePixelRatio) || 1);
      cancelAnimLoop();
      idle = true;

      return {
        setState: setState,
        setPaused: setPaused,
        setHardwareState: setHardwareState,
        triggerControlPress: triggerControlPress,
        rotateKnobStep: rotateKnobStep,
        triggerBlindKeyPress: triggerBlindKeyPress,
        setPointerClient: setPointerClient,
        setPointerNorm: setPointerNorm,
        setChassisOrbit: setChassisOrbit,
        addChassisOrbitDelta: addChassisOrbitDelta,
        dragChassisOrbitDelta: dragChassisOrbitDelta,
        endChassisOrbitDrag: endChassisOrbitDrag,
        flingChassisOrbit: flingChassisOrbit,
        resetChassisOrbit: resetChassisOrbit,
        getChassisOrbit: getChassisOrbit,
        triggerIntroWake: triggerIntroWake,
        triggerWaveRipple: triggerWaveRipple,
        triggerEnergyPulse: triggerEnergyPulse,
        showSessionSyncedBadge: showSessionSyncedBadge,
        releaseCaches: releaseCaches,
        getPerfStats: getPerfStats,
        pick: pick,
        getInteractiveProjectedRects: getInteractiveProjectedRects,
        syncCanvasBounds: syncCanvasBounds,
        resize: resize,
        step: step,
        isIdle: isIdle,
        getRendererMode: getRendererMode,
        dispose: dispose,
      };
    }

    return {
      createKeyboard3DRenderer: createKeyboard3DRenderer,
      evictLegendAtlasCache: evictLegendAtlasCache,
    };
  }
);
