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
- **Real 3D CSS for orbital motifs.** `perspective` on the parent;
  `transform-style: preserve-3d` + a base `rotateX(...)` tilt on the orbit
  wrapper; keyframes must carry the tilt through the spin
  (`rotateX(Ndeg) rotateZ(0 → 360deg)`, not a bare `rotateZ`); child nodes
  placed with `rotateZ(var(--n)*Ndeg) translateY(-r)` inside the tilted plane.
  Used on the index node ring and the settings 12-pillar assembly.
- **Every page** handles `prefers-reduced-motion` (kill spin, keep static state)
  and has a mobile `@media (max-width: 720px)` breakpoint (stack columns,
  static-position absolute panels).
- **State** persists to `localStorage` with try/catch guards; cross-component
  sync via custom DOM events (e.g. `bios:clockchange` broadcast by the Time
  Format setting).
