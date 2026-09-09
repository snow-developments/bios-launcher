---
name: boot-splash-status
description: State of the WebGPU orrery + Coldstart boot-splash work on design/index.html, for resuming in a fresh session
type: project
---

Work in progress on the `index.html` mockup. Session held mid-stream; some
`design/` files have uncommitted working-tree changes.

**Orrery** (`design/orrery.js`) — replaced the old CSS `.ring` node-ring motif
on `index.html` with a WebGPU canvas: 8 nodes orbiting a bright core on a
tilted plane + 2 wireframe rings, WGSL shaders. Falls back to a `.orrery--fallback`
CSS core if `requestAdapter()` fails. Fires `orrery:ready` (once) after the
first frame and on the fallback path. Exports `globalThis.orrery.nodePositions()`
→ the 8 node centres in viewport px, or `null` in fallback. Geometry constants
(`RADIUS`, `SPIN_RATE`, `spinNow()`) are single-sourced and shared by the frame
loop and the export.

**Splash** (`design/splash.js` + `.splash*` in `launcher.css`, markup + fog
SVG filter in `index.html`) — the Coldstart boot screen. Once per session
(`sessionStorage` key `bios.splash.seen`; Settings ▸ "Debug · Reset Splash"
clears it). 2D-canvas cubes + 3 light trails over a CSS `feTurbulence` nebula.
Timeline: wordmark is a self-contained mid beat — `.splash--lit` fades it in on
frame 1, `.splash--dim` (added after `WORD_HOLD_MS` 1000) fades it out over
~1.5 s, gone by ~2.5 s. Exit gate: `orrery:ready` AND a `MIN_MS` 3000 floor,
then `.splash--out` runs the camera fly-in (fog scales, CSS) + trails easing to
`orrery.nodePositions()` (or converge-to-core + flash when `null`) over
`MORPH_MS` 750, while the layer fades over `EXIT_MS` 1500. `FAILSAFE_MS` 7000.

**Open:** the trail-to-node morph is only observable on a real GPU browser
([[preview-verification-limits]]). Wordmark timing was iterated several times;
current "self-contained mid beat" version was accepted ("much better"). Keep
`design/plans/boot.html` (the design note, [[boot-splash-design-doc]]) and the
code in sync — timing constants were reconciled this session.

Related: [[coldstart-brand]], [[mockup-conventions]].
