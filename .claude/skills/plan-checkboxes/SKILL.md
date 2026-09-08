---
name: plan-checkboxes
description: Use when working through a checklist in design/plans/*.html or *.md and you want ticking a box to persist to the file on disk, or when asked to "run the plan server" / "make the plan checkboxes clickable".
---

# plan-checkboxes

## Overview

A single-file Deno server (`server.ts`, no dependencies) that serves each doc in
`design/plans/` with its checkboxes made clickable. Toggling a box POSTs back
and the server rewrites that one checkbox in the source file, then the page
reloads. The file is the only store — no database, no client framework, no build
step.

## Run

```bash
deno run --allow-read --allow-write --allow-net .claude/skills/plan-checkboxes/server.ts
```

Then open `http://localhost:8788/` for the file list, or
`http://localhost:8788/<name>` for one doc. Flags: `--port <n>`, `--dir <path>`
(default `design/plans`). Run from the repo root.

## Checkbox formats

| File    | Token it toggles                                           |
| ------- | ---------------------------------------------------------- |
| `.md`   | GFM task list item — `- [ ] todo` ⇄ `- [x] done`           |
| `.html` | literal `<input type="checkbox">` — adds/removes `checked` |

The Nth checkbox in the rendered page maps to the Nth checkbox token in the
file, so every checkbox must be a literal token in the source (no
script-generated inputs, no `::before` fake boxes). Tokens inside HTML comments,
`<script>`, `<style>` and fenced code blocks are skipped so the mapping holds.

## Notes

- `.md` uses a deliberately tiny built-in renderer (headings, code fences, task
  lists, bullets, paragraphs, inline code/bold/links) — not full CommonMark.
  Enough for a plan; extend `mdToHtml` if a doc needs more.
- `.html` is served as-is with a `<script>` appended before `</body>`.
- Path traversal is blocked; only `design/plans/*.{html,md}` are reachable.
- Persistence is local only — a published copy of the doc shows static boxes.
- Not a long-running service. Start it for a review session, Ctrl-C when done.
