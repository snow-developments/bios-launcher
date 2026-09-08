// The orrery: the PS2-BIOS main-menu motif rendered with WebGPU.
//
// Nodes orbit a bright core on a tilted plane, two faint wireframe rings cross
// through it, and the node for the current 3-hour arc burns brighter. Purely
// decorative — the canvas is aria-hidden. If WebGPU is unavailable or the
// device is lost, we drop a `.orrery--fallback` class and let CSS show a
// static core so the layout never collapses.

const canvas = document.querySelector("canvas.orrery");

const NODE_COUNT = 8;
const RING_SEGMENTS = 160;
const TILT = 1.06; // ~61deg, matching the old CSS rotateX
const RADIUS = 0.62; // orbit radius in NDC; also the `radius` uniform
const SPIN_RATE = 0.16; // radians/sec the orbit turns
const REDUCED_SPIN = 0.6; // fixed orbit angle under prefers-reduced-motion

const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)");

// Tell the boot splash it can leave: fired once, after the first painted frame
// or when we fall back so a no-GPU machine still advances.
let signaledReady = false;
function signalReady() {
  if (signaledReady) return;
  signaledReady = true;
  document.dispatchEvent(new Event("orrery:ready"));
}

function fail(reason) {
  if (reason) console.warn(`[orrery] ${reason}; using CSS fallback`);
  canvas?.classList.add("orrery--fallback");
  signalReady();
}

function hexToRgb(hex) {
  const h = hex.trim().replace("#", "");
  const s = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  return [0, 2, 4].map((i) => parseInt(s.slice(i, i + 2), 16) / 255);
}

function readColor(name, fallbackHex) {
  const v = getComputedStyle(document.documentElement).getPropertyValue(name);
  return hexToRgb(v || fallbackHex);
}

// litIndex for the current hour: 8 nodes -> 3-hour arcs, same rule as before.
const litIndex = () => Math.floor(new Date().getHours() / 3) % NODE_COUNT;

const spinNow = () =>
  reduceMotion.matches ? REDUCED_SPIN : (performance.now() / 1000) * SPIN_RATE;

// Screen positions (viewport px) of the orbiting node centres, computed from
// the same projection the vertex shader uses, at call time -- so they track the
// live orbit. Returns null when the orrery isn't drawing nodes (CSS fallback,
// no canvas), which is the caller's cue to fall back to the core centre.
// Consumed by splash.js via `window.orrery`.
function nodePositions() {
  if (!canvas || canvas.classList.contains("orrery--fallback")) return null;
  const rect = canvas.getBoundingClientRect();
  if (!rect.width) return null;
  const spin = spinNow();
  const out = [];
  for (let n = 0; n < NODE_COUNT; n++) {
    const a = (n / NODE_COUNT) * Math.PI * 2 + spin;
    const px = Math.cos(a) * RADIUS; // project(): plane point tilted about X
    const pz = Math.sin(a) * RADIUS;
    const ndcY = -pz * Math.sin(TILT); // shader sets centerNDC = p.xy (no aspect)
    out.push({
      n,
      x: rect.left + (px * 0.5 + 0.5) * rect.width,
      y: rect.top + (0.5 - ndcY * 0.5) * rect.height,
    });
  }
  return out;
}
globalThis.orrery = { nodePositions };

const WGSL = /* wgsl */ `
struct U {
  time: f32, litIndex: f32, spin: f32, radius: f32,
  coreColor: vec3f, _p0: f32,
  glowColor: vec3f, _p1: f32,
  arcColor: vec3f, _p2: f32,
  tilt: f32, nodeCount: f32, aspect: f32, _p3: f32,
};
@group(0) @binding(0) var<uniform> u: U;

const TAU = 6.2831853;
var<private> QUAD = array<vec2f, 4>(
  vec2f(-1.0, -1.0), vec2f(1.0, -1.0), vec2f(-1.0, 1.0), vec2f(1.0, 1.0),
);

fn project(planeAngle: f32, r: f32) -> vec3f {
  // Point (cos, 0, sin)*r on the orbital plane, tilted about X.
  let px = cos(planeAngle) * r;
  let pz = sin(planeAngle) * r;
  return vec3f(px, -pz * sin(u.tilt), pz * cos(u.tilt));
}

// ---- Sprites: core (instance 0) + orbiting nodes ------------------------------
struct SpriteOut {
  @builtin(position) pos: vec4f,
  @location(0) uv: vec2f,
  @location(1) tint: vec3f,
  @location(2) glow: f32,
};

@vertex
fn sprite_vs(@builtin(vertex_index) vi: u32,
             @builtin(instance_index) inst: u32) -> SpriteOut {
  let corner = QUAD[vi];
  var centerNDC: vec2f;
  var size: f32;
  var glow: f32;
  var tint: vec3f;

  if (inst == 0u) {
    centerNDC = vec2f(0.0, 0.0);
    size = 0.13;
    glow = 1.6;
    tint = u.coreColor;
  } else {
    let n = f32(inst - 1u);
    let a = n / u.nodeCount * TAU + u.spin;
    let p = project(a, u.radius);
    let near = (p.z / u.radius) * 0.5 + 0.5; // 0 far .. 1 near
    centerNDC = p.xy;
    size = mix(0.045, 0.08, near);
    glow = mix(0.5, 1.0, near);
    tint = u.glowColor;
    if (abs(u.litIndex - n) < 0.5) {
      size = size * 1.9;
      glow = 2.4;
      tint = mix(u.glowColor, vec3f(1.0), 0.6);
    }
  }

  var o: SpriteOut;
  let offset = vec2f(corner.x * size / max(u.aspect, 0.0001), corner.y * size);
  o.pos = vec4f(centerNDC + offset, 0.0, 1.0);
  o.uv = corner;
  o.tint = tint;
  o.glow = glow;
  return o;
}

@fragment
fn sprite_fs(i: SpriteOut) -> @location(0) vec4f {
  let d = length(i.uv);
  let a = smoothstep(1.0, 0.0, d);
  let hot = pow(clamp(1.0 - d, 0.0, 1.0), 2.0);
  let col = mix(i.tint, vec3f(1.0), hot * 0.7) * i.glow * a;
  return vec4f(col, a); // additive blend on a dark page
}

// ---- Wireframe rings (line-strip, 2 instances) -------------------------------
struct RingOut {
  @builtin(position) pos: vec4f,
  @location(0) fade: f32,
};

@vertex
fn ring_vs(@builtin(vertex_index) vi: u32,
           @builtin(instance_index) inst: u32) -> RingOut {
  let a = f32(vi) / ${RING_SEGMENTS}.0 * TAU;
  let r = u.radius * 0.66;
  var p: vec3f;
  if (inst == 0u) {
    // Ring lying in the orbital plane.
    p = project(a, r);
  } else {
    // A more upright ring, yawed so it visibly crosses the first.
    let x = cos(a) * r * 0.62;
    let y = sin(a) * r;
    p = vec3f(x, y * cos(u.tilt) + 0.0, 0.0);
    p.y = y * 0.9 - cos(a) * r * 0.18;
  }
  var o: RingOut;
  o.pos = vec4f(p.x / max(u.aspect, 0.0001), p.y, 0.0, 1.0);
  o.fade = 0.5 + 0.5 * sin(a + u.spin);
  return o;
}

@fragment
fn ring_fs(i: RingOut) -> @location(0) vec4f {
  return vec4f(u.arcColor * (0.35 + 0.35 * i.fade), 1.0) * 0.5;
}
`;

async function main() {
  if (!canvas) return;
  if (!navigator.gpu) return fail("navigator.gpu missing");

  const adapter = await navigator.gpu.requestAdapter();
  if (!adapter) return fail("no GPU adapter");

  let device;
  try {
    device = await adapter.requestDevice();
  } catch (e) {
    return fail(`requestDevice failed: ${e.message}`);
  }
  device.lost.then((info) => {
    if (info.reason !== "destroyed") fail(`device lost: ${info.message}`);
    stop();
  });

  const ctx = canvas.getContext("webgpu");
  const format = navigator.gpu.getPreferredCanvasFormat();
  ctx.configure({ device, format, alphaMode: "premultiplied" });

  device.pushErrorScope("validation");
  const module = device.createShaderModule({ label: "orrery", code: WGSL });
  const info = await module.getCompilationInfo();
  for (const m of info.messages) {
    const at = ` (line ${m.lineNum})`;
    if (m.type === "error") console.error(`[orrery] WGSL${at}: ${m.message}`);
    else console.warn(`[orrery] WGSL ${m.type}${at}: ${m.message}`);
  }

  const additive = {
    color: { srcFactor: "one", dstFactor: "one" },
    alpha: { srcFactor: "one", dstFactor: "one" },
  };
  const target = { format, blend: additive };

  const spritePipeline = device.createRenderPipeline({
    label: "orrery-sprites",
    layout: "auto",
    vertex: { module, entryPoint: "sprite_vs" },
    fragment: { module, entryPoint: "sprite_fs", targets: [target] },
    primitive: { topology: "triangle-strip" },
  });
  const ringPipeline = device.createRenderPipeline({
    label: "orrery-rings",
    layout: "auto",
    vertex: { module, entryPoint: "ring_vs" },
    fragment: { module, entryPoint: "ring_fs", targets: [target] },
    primitive: { topology: "line-strip" },
  });

  const uniformData = new Float32Array(24);
  const uniformBuffer = device.createBuffer({
    label: "orrery-uniforms",
    size: uniformData.byteLength,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });
  const bind = (pipeline) =>
    device.createBindGroup({
      layout: pipeline.getBindGroupLayout(0),
      entries: [{ binding: 0, resource: { buffer: uniformBuffer } }],
    });
  const spriteBind = bind(spritePipeline);
  const ringBind = bind(ringPipeline);

  const scopeError = await device.popErrorScope();
  if (scopeError) return fail(`pipeline validation: ${scopeError.message}`);

  const core = readColor("--bios-ring-core", "#eaf4ff");
  const glow = readColor("--bios-ring-glow", "#7cc6ff");
  const arc = readColor("--bios-arc", "#2c4c7a");

  const maxDim = device.limits.maxTextureDimension2D;
  function resize() {
    const dpr = Math.min(devicePixelRatio || 1, 2);
    const rect = canvas.getBoundingClientRect();
    const w = Math.max(1, Math.min(maxDim, Math.round(rect.width * dpr)));
    const h = Math.max(1, Math.min(maxDim, Math.round(rect.height * dpr)));
    if (canvas.width !== w) canvas.width = w;
    if (canvas.height !== h) canvas.height = h;
  }
  new ResizeObserver(resize).observe(canvas);
  resize();

  function frame(now) {
    const t = now / 1000;
    const spin = spinNow();
    uniformData.set([t, litIndex(), spin, RADIUS], 0); // time, litIndex, spin, radius
    uniformData.set(core, 4);
    uniformData.set(glow, 8);
    uniformData.set(arc, 12);
    uniformData.set(
      [TILT, NODE_COUNT, canvas.width / canvas.height, 0],
      16,
    ); // tilt, nodeCount, aspect
    device.queue.writeBuffer(uniformBuffer, 0, uniformData);

    const encoder = device.createCommandEncoder();
    const pass = encoder.beginRenderPass({
      colorAttachments: [{
        view: ctx.getCurrentTexture().createView(),
        clearValue: { r: 0, g: 0, b: 0, a: 0 },
        loadOp: "clear",
        storeOp: "store",
      }],
    });
    pass.setPipeline(ringPipeline);
    pass.setBindGroup(0, ringBind);
    pass.draw(RING_SEGMENTS + 1, 2);

    pass.setPipeline(spritePipeline);
    pass.setBindGroup(0, spriteBind);
    pass.draw(4, NODE_COUNT + 1);
    pass.end();
    device.queue.submit([encoder.finish()]);
    signalReady();

    if (!reduceMotion.matches) raf = requestAnimationFrame(frame);
  }

  let raf = 0;
  function stop() {
    cancelAnimationFrame(raf);
    raf = 0;
  }
  function start() {
    if (!raf) raf = requestAnimationFrame(frame);
  }

  document.addEventListener("visibilitychange", () => {
    if (document.hidden || reduceMotion.matches) stop();
    else start();
  });
  addEventListener("pagehide", stop);
  reduceMotion.addEventListener?.("change", () => {
    stop();
    requestAnimationFrame(frame);
  });

  requestAnimationFrame(frame); // always paint at least one frame
}

main().catch((e) => fail(`init error: ${e.message}`));
