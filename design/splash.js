// Coldstart boot splash.
//
// Covers index.html from the first paint while the orrery's WebGPU shaders
// compile, then sweeps into the fog and resolves into the orrery. CSS + a 2D
// <canvas> only -- no shader, so it never needs a splash of its own. Shown
// once per browser session.
//
// Exit gate: begin the choreography once BOTH window `load` has fired AND the
// orrery has painted once (`orrery:ready`), but never before a 3 s floor. A 7 s
// failsafe forces it even if `orrery:ready` never arrives. The orrery renders
// live behind the splash the whole time, so the reveal shows it already
// spinning.
//
// The wordmark is a self-contained mid-sequence beat: fades in on the first
// frame, holds WORD_HOLD_MS, then fades out (CSS, ~1.5 s) -- gone before the
// exit, which it takes no part in. The exit choreography starts together: the
// layer fades over EXIT_MS (the splash hides when this ends), the fog scales
// past the camera (CSS, ~0.75 s), and the canvas eases cubes outward + trails
// onto the orrery nodes over MORPH_MS.

const splash = document.querySelector(".splash");

const SEEN_KEY = "bios.splash.seen";
const WORD_HOLD_MS = 1000; // wordmark visible before it starts fading out
const MIN_MS = 3000;
const EXIT_MS = 1500;
const MORPH_MS = 750;
const FAILSAFE_MS = 7000;

const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)");

const session = {
  get(k) {
    try {
      return sessionStorage.getItem(k);
    } catch {
      return null;
    }
  },
  set(k, v) {
    try {
      sessionStorage.setItem(k, v);
    } catch { /* private mode */ }
  },
};

if (splash) {
  if (session.get(SEEN_KEY)) {
    splash.hidden = true;
  } else {
    session.set(SEEN_KEY, "1");
    run();
  }
}

function run() {
  const startedAt = performance.now();

  // Wordmark: fade in on the next frame, then fade out mid-sequence.
  requestAnimationFrame(() => splash.classList.add("splash--lit"));
  const dimTimer = setTimeout(
    () => splash.classList.add("splash--dim"),
    WORD_HOLD_MS,
  );

  const scene = reduceMotion.matches
    ? null
    : createScene(splash.querySelector(".splash-cubes"));

  let raf = 0;
  if (scene) {
    const loop = (now) => {
      scene.frame(now);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
  }

  let finished = false;
  function finish() {
    if (finished) return;
    finished = true;

    const wait = Math.max(0, MIN_MS - (performance.now() - startedAt));
    setTimeout(() => {
      scene?.exit(orreryCore(), orreryNodes());
      splash.classList.add("splash--out");

      const done = (e) => {
        if (e && e.target !== splash) return; // ignore bubbled child transitions
        splash.hidden = true;
        splash.removeEventListener("transitionend", done);
        clearTimeout(dimTimer);
        cancelAnimationFrame(raf);
        scene?.dispose();
      };
      splash.addEventListener("transitionend", done);
      setTimeout(done, EXIT_MS + 150); // in case transitionend is missed
    }, wait);
  }

  Promise.all([once(window, "load"), orreryReady()]).then(finish);
  setTimeout(finish, FAILSAFE_MS);
}

// Viewport-space centre of the orrery canvas -- the fallback target when the
// orrery isn't drawing nodes (CSS fallback, or not ready yet).
function orreryCore() {
  const el = document.querySelector(".orrery");
  const r = el && el.getBoundingClientRect();
  if (!r || !r.width) return { x: innerWidth / 2, y: innerHeight / 2 };
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
}

// Live node centres (viewport px) from orrery.js, or null when it has no nodes
// to hand out -- see orrery.js `nodePositions`.
function orreryNodes() {
  const fn = globalThis.orrery?.nodePositions;
  return typeof fn === "function" ? fn() : null;
}

function once(target, type) {
  return new Promise((resolve) => {
    if (type === "load" && document.readyState === "complete") return resolve();
    target.addEventListener(type, () => resolve(), { once: true });
  });
}

function orreryReady() {
  // orrery.js runs before this module and only fires the event from a later
  // rAF tick, so this listener is always attached in time.
  return once(document, "orrery:ready");
}

// --- 2D scene: drifting cubes + colored light trails ------------------------

function createScene(canvas) {
  const ctx = canvas && canvas.getContext("2d");
  if (!ctx) return null;

  let dpr = 1;
  let cssW = 1;
  let cssH = 1;
  function resize() {
    dpr = Math.min(devicePixelRatio || 1, 2);
    const r = canvas.getBoundingClientRect();
    cssW = Math.max(1, r.width);
    cssH = Math.max(1, r.height);
    canvas.width = Math.round(cssW * dpr);
    canvas.height = Math.round(cssH * dpr);
  }
  const ro = new ResizeObserver(resize);
  ro.observe(canvas);
  resize();

  const rand = (a, b) => a + Math.random() * (b - a);
  const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);

  // Cubes -- canonically the "memories" read off save data; here a fixed count.
  // Position in normalized [0..1] space; velocity in units/second, scaled by
  // depth z (near cubes move and read brighter).
  const cubes = Array.from({ length: 7 }, makeCube);
  function makeCube() {
    const z = rand(0.18, 1);
    return {
      x: rand(-0.1, 1.1),
      y: rand(-0.1, 1.1),
      z,
      s: rand(16, 42) * z,
      rot: rand(0, Math.PI * 2),
      vr: rand(-0.22, 0.22),
      vx: rand(-0.018, 0.018) * z,
      vy: rand(-0.012, 0.016) * z,
    };
  }

  // Light trails: red / green / violet, matched to the reference frame.
  const trails = ["#ff5a4d", "#7dff8a", "#b06cff"].map((color, i) =>
    spawnTrail(color, -i * 0.8 - 0.4)
  );
  function spawnTrail(color, at) {
    return {
      color,
      start: at,
      dur: rand(0.55, 0.8),
      gap: rand(1.4, 3.6),
      x0: rand(0.12, 0.5),
      y0: rand(0.15, 0.85),
      ang: rand(-0.42, 0.42),
      reach: rand(0.55, 0.9),
      hx: 0,
      hy: 0,
    };
  }

  let last = 0;
  let elapsed = 0;
  let exiting = false;
  let exitAt = 0;
  let hasNodes = false;
  let core = { x: 0, y: 0 };

  // centerPoint: fallback target (orrery core centre). nodes: live node centres
  // from orrery.js, or null. With nodes, each trail reels into a distinct node;
  // without, all three reel into the core and it flashes.
  function exit(centerPoint, nodes) {
    if (exiting) return;
    exiting = true;
    exitAt = elapsed;
    core = centerPoint;
    hasNodes = Array.isArray(nodes) && nodes.length >= trails.length;
    const pick = hasNodes
      ? [0, 3, 5].map((i) => nodes[i % nodes.length])
      : null;
    trails.forEach((t, i) => {
      // Anchor each trail at wherever it currently reads, then reel it in.
      if (!t.hx && !t.hy) {
        t.hx = (t.x0 + Math.cos(t.ang) * t.reach * 0.3) * cssW;
        t.hy = (t.y0 + Math.sin(t.ang) * t.reach * 0.3) * cssH;
      }
      t.ox = t.hx;
      t.oy = t.hy;
      t.target = pick ? pick[i] : centerPoint;
    });
  }

  function frame(now) {
    const dt = last ? Math.min(0.05, (now - last) / 1000) : 0.016;
    last = now;
    elapsed += dt;

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, cssW, cssH);

    if (exiting) return drawExit(dt);

    for (const c of cubes) {
      c.x += c.vx * dt;
      c.y += c.vy * dt;
      c.rot += c.vr * dt;
      if (c.x < -0.15) c.x = 1.15;
      else if (c.x > 1.15) c.x = -0.15;
      if (c.y < -0.15) c.y = 1.15;
      else if (c.y > 1.15) c.y = -0.15;
      drawCube(c, 1);
    }

    for (let i = 0; i < trails.length; i++) {
      const t = trails[i];
      const life = elapsed - t.start;
      if (life < 0) continue;
      if (life > t.dur + t.gap) {
        trails[i] = spawnTrail(t.color, elapsed);
        continue;
      }
      if (life <= t.dur) drawTrail(t, life / t.dur);
    }
  }

  // Exit: cubes fly past the camera, trails reel into the core, then it flashes.
  function drawExit(dt) {
    const k = clamp01((elapsed - exitAt) / (MORPH_MS / 1000));

    for (const c of cubes) {
      c.x += (c.x - 0.5) * 3.4 * dt;
      c.y += (c.y - 0.5) * 3.4 * dt;
      c.rot += c.vr * 2 * dt;
      drawCube(c, 1 - k);
    }

    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    for (const t of trails) {
      const tg = t.target;
      t.hx += (tg.x - t.hx) * Math.min(1, 7 * dt);
      t.hy += (tg.y - t.hy) * Math.min(1, 7 * dt);
      const tailX = t.ox + (tg.x - t.ox) * Math.min(1, k * 1.15);
      const tailY = t.oy + (tg.y - t.oy) * Math.min(1, k * 1.15);
      const g = ctx.createLinearGradient(tailX, tailY, t.hx, t.hy);
      g.addColorStop(0, "rgba(0,0,0,0)");
      g.addColorStop(0.7, t.color);
      g.addColorStop(1, "#ffffff");
      ctx.strokeStyle = g;
      ctx.lineWidth = 2 + k * 2;
      ctx.lineCap = "round";
      ctx.shadowColor = t.color;
      ctx.shadowBlur = 16;
      ctx.beginPath();
      ctx.moveTo(tailX, tailY);
      ctx.lineTo(t.hx, t.hy);
      ctx.stroke();
    }

    if (!hasNodes && k > 0.45) {
      const f = (k - 0.45) / 0.55;
      const rad = 6 + f * Math.max(cssW, cssH) * 0.22;
      const fg = ctx.createRadialGradient(
        core.x,
        core.y,
        0,
        core.x,
        core.y,
        rad,
      );
      fg.addColorStop(0, `rgba(255,255,255,${0.9 * (1 - f)})`);
      fg.addColorStop(0.4, `rgba(180,210,255,${0.5 * (1 - f)})`);
      fg.addColorStop(1, "rgba(120,170,255,0)");
      ctx.fillStyle = fg;
      ctx.beginPath();
      ctx.arc(core.x, core.y, rad, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  function drawCube(c, alphaMul) {
    if (alphaMul <= 0) return;
    const x = c.x * cssW;
    const y = c.y * cssH;
    const a = (0.32 + 0.68 * c.z) * alphaMul;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(c.rot);

    ctx.beginPath();
    for (let k = 0; k < 6; k++) {
      const ang = (k / 6) * Math.PI * 2;
      const px = Math.cos(ang) * c.s;
      const py = Math.sin(ang) * c.s;
      k ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
    }
    ctx.closePath();
    ctx.fillStyle = `rgba(28, 42, 66, ${0.3 * a})`;
    ctx.fill();
    ctx.lineWidth = 1;
    ctx.strokeStyle = `rgba(150, 180, 220, ${0.55 * a})`;
    ctx.stroke();

    // three spokes to alternating vertices -> reads as a cube corner-on
    ctx.beginPath();
    for (let k = 0; k < 6; k += 2) {
      const ang = (k / 6) * Math.PI * 2;
      ctx.moveTo(0, 0);
      ctx.lineTo(Math.cos(ang) * c.s, Math.sin(ang) * c.s);
    }
    ctx.strokeStyle = `rgba(120, 150, 190, ${0.42 * a})`;
    ctx.stroke();
    ctx.restore();
  }

  function drawTrail(t, p) {
    // Head races along the chord; tail shrinks toward the end for a shooting feel.
    t.hx = (t.x0 + Math.cos(t.ang) * t.reach * p) * cssW;
    t.hy = (t.y0 + Math.sin(t.ang) * t.reach * p) * cssH;
    const tailLen = t.reach * 0.22 * (1 - p * 0.7);
    const tx = (t.x0 + Math.cos(t.ang) * (t.reach * p - tailLen)) * cssW;
    const ty = (t.y0 + Math.sin(t.ang) * (t.reach * p - tailLen)) * cssH;

    const g = ctx.createLinearGradient(tx, ty, t.hx, t.hy);
    g.addColorStop(0, "rgba(0,0,0,0)");
    g.addColorStop(0.75, t.color);
    g.addColorStop(1, "#ffffff");

    ctx.save();
    ctx.strokeStyle = g;
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.shadowColor = t.color;
    ctx.shadowBlur = 12;
    ctx.globalAlpha = Math.min(1, p * 4, (1 - p) * 4 + 0.2);
    ctx.beginPath();
    ctx.moveTo(tx, ty);
    ctx.lineTo(t.hx, t.hy);
    ctx.stroke();
    ctx.restore();
  }

  return { frame, exit, dispose: () => ro.disconnect() };
}
