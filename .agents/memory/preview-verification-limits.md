---
name: preview-verification-limits
description: What the local design/ preview loop can and cannot verify — no GPU, stale asset cache, slow eval, flaky tabs
type: project
---

Verifying `design/` changes through the in-app browser preview
(`deno run -A jsr:@std/http/file-server design --port 8791`, the
`design-preview` launch config) has hard limits — plan around them instead of
fighting them:

- **No WebGPU adapter.** `navigator.gpu` exists but `requestAdapter()` returns
  `null`, so `orrery.js` always takes its `fail()` path and shows
  `.orrery--fallback` (a static CSS core). Anything that needs live orrery
  nodes — the splash's trail-to-node morph — cannot be seen here. Verify that
  on a real GPU browser.
- **Stale assets.** The browser serves cached `launcher.css` / `*.js` across
  edits; a normal reload 304s. Force fresh with `fetch(url, {cache:'reload'})`
  before reload, an injected `<link href="...?bust=">`, or a hard refresh.
- **Slow eval.** `javascript_tool` in the preview can take several seconds to
  start executing, so a ~3–5 s animation (the boot splash) is usually over
  before polling begins. Don't try to real-time-trace it. Instead: fetch and
  inspect the *served* CSS/JS text, reason through the cascade, and check the
  settled end state (classes applied, computed styles, `hidden`).
- **Tabs die often.** Preview tabs close between calls; re-`preview_start` and
  use the returned `tabId`.

Related: [[boot-splash-status]], [[mockup-conventions]].
