# Project Memory

Durable, cross-agent facts about this repo. Read these at session start.

## Project

- [Design is mockups](design-is-mockups.md) — design/*.html are interactive
  PS2-BIOS mockups, not "feasibility scaffolds"
- [Mockup conventions](mockup-conventions.md) — shared launcher.css/js shell,
  --bios-* tokens, inline-SVG glyphs, WebGPU orrery + CSS 3D pillars, Deno-only
- [Boot splash status](boot-splash-status.md) — WebGPU orrery + Coldstart boot
  splash on index.html; where the in-progress work stands
- [Coldstart brand](coldstart-brand.md) — splash maker mark "Coldstart Computer
  Entertainment", subsidiary of Snow Developments, LLC
- [Preview verification limits](preview-verification-limits.md) — the local
  design/ preview: no GPU, stale asset cache, slow eval, flaky tabs
- [.NET launcher status](dotnet-launcher-status.md) — the Bios.* solution
  layout and the 2026-09-10 RID / logging / console-output (WinExe subsystem,
  Taskfile `env:`) fixes

## Reference

- [Boot splash design doc](boot-splash-design-doc.md) — the design note
  (design/plans/boot.html) and its published artifact URL

## Working style

- [Minimal over clever](minimal-over-clever.md) — smallest pragmatic solution;
  act, don't narrate-and-wait
- [Verify in the user's environment](verify-in-users-environment.md) — a green
  run in a non-equivalent setup (pipe vs TTY, no GPU) isn't verification; name
  the gap, don't claim done
- [Cite primary source in comments](cite-primary-source-in-comments.md) — a
  comment explaining external behaviour needs a `<!-- See {href} -->` vendor
  link; codified in `.agents/Style.md`
- [Docs MCP before diagnosing](docs-mcp-before-diagnosing.md) — named-tool /
  error-code failures: read Microsoft Learn MCP / Context7 / web fully before
  proposing a fix or theory
- [Designs as artifacts](designs-as-artifacts.md) — designs/plans go in
  artifacts with real formatting, never a chat wall of text
- [Move files literally](move-files-literally.md) — git mv / mv, never
  rewrite-to-move
- [Commit conventions](commit-conventions.md) — commit/stash/PR wording lives in
  the writing-commit-messages skill; invoke it before drafting a message
- [Authoring for Chance](authoring-for-chance.md) — encoding his conventions:
  mine chances repos, grill with AskUserQuestion, mirror skill to .agents/skills
