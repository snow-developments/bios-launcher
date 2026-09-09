---
name: mockup-conventions
description: How the bios-launcher design mockups are built — shared shell, tokens, 3D CSS, glyph pattern
type: project
---

Conventions for the `design/` mockups ([[design-is-mockups]]):

- **No build step.** Static HTML + one shared `launcher.css` + one shared
  `launcher.js`. Preview with
  `deno run -A jsr:@std/http/file-server design --port 8791` (wired in
  `.claude/launch.json` as `design-preview`). No Python — this project is
  Deno/npx only.
- **Shared shell.** `launcher.js` is an IIFE exposing `window.Bios` (`clock`,
  `wakeCorners`, `notify`, `onPad`, `listNav`); every page includes it instead
  of duplicating clock / corner-HUD / toast / gamepad / list-nav / back-nav
  logic. Back navigation is declared via `<body data-back="index.html">`.
- **Design tokens.** CSS custom properties on `:root`, all prefixed `--bios-*`
  (palette, type, spacing). Palette is black-void PS2 BIOS: indigo/cyan node
  ring, right-aligned menu (active bright blue, idle grey).
- **Button-glyph hints** (`✕ Enter`, `△ Version`, `□ Display`, `○ Back`) are
  **inline SVG** centered in a bordered circular span via
  `display: inline-grid; place-items: center` — NOT a font glyph char inside a
  circle (that produced an "awful padding" bug). `.glyph` circle ~`1.55em`,
  inner `svg` ~`.6em`, stroked with `currentColor`.
- **Orbital motifs.** The `index.html` node ring is now a **WebGPU canvas**
  (`design/orrery.js`, the "orrery" — name is settled, do not reopen), not CSS
  — 8 nodes + 2 wireframe rings on
  a tilted plane in WGSL, with a `.orrery--fallback` static CSS core when
  `requestAdapter()` fails. It fires an `orrery:ready` DOM event and exposes
  `globalThis.orrery.nodePositions()` (viewport-px node centres, or `null` in
  fallback) for other scripts. The **settings 12-pillar assembly is still real
  3D CSS**: `perspective` on the parent; `transform-style: preserve-3d` + a
  base `rotateX(...)` tilt on the wrapper; keyframes carry the tilt through the
  spin (`rotateX(Ndeg) rotateZ(0 → 360deg)`, not a bare `rotateZ`); children
  placed with `rotateZ(var(--i)*30deg) translateY(-r)` inside the tilted plane.
- **`design/plans/`** holds design-note docs (HTML/Markdown). The
  `plan-checkboxes` skill (`.claude/skills/plan-checkboxes/server.ts`) serves
  them with live checkboxes that persist to the file — run with
  `deno run --allow-read --allow-write --allow-net`.
- **Page transitions.** All internal navigation goes through `Bios.navigate(url)`
  in `launcher.js`: it adds `.is-leaving` to `<html>`, waits `PAGE_FADE_MS`
  (240, kept in sync with `html.is-leaving .shell` in `launcher.css`), then
  swaps `location.href`. A document-level click interceptor routes same-origin
  `<a>` clicks through it; `.shell` also runs a `shell-in` fade on every load.
  Pure JS/CSS cross-fade (no `@view-transition`), all browsers, reduced-motion
  does an instant swap.
- **Every page** handles `prefers-reduced-motion` (kill spin, keep static state)
  and has a mobile `@media (max-width: 720px)` breakpoint (stack columns,
  static-position absolute panels).
- **State** persists to `localStorage` with try/catch guards; cross-component
  sync via custom DOM events (e.g. `bios:clockchange` broadcast by the Time
  Format setting).
