---
name: cite-check-skill
description: .agents/skills/cite-check lints comments for uncited behavioral claims; a Stop hook runs it every turn and blocks on findings
type: project
---

`.agents/skills/cite-check/` is a local Deno skill (no repo dependency) that
flags code comments asserting how an external tool/SDK/platform behaves without
a primary-source `See <href>` citation on an adjacent line. The claim decision
is real NLP — the `compromise` library (sentence split, POS, negation,
modality) plus two closed word lists (named products, behavior verbs) — not a
prose regex.

- Run: `deno task check` (git-changed files) / `check:all` / `self-test`, from
  the skill dir. From repo root pass `--config .agents/skills/cite-check/deno.json`.
- Suppress a false positive (prose that names a tool but describes our own
  code) with a `cite-check: ignore` pragma in the comment.
- A `Stop` hook (`.claude/hooks/cite-check-stop.ts`, wired in
  `.claude/settings.json`) runs it on changed/staged/untracked files at every
  turn end and returns `decision: "block"` with the findings if any are
  uncited — so a turn will not end until claims are cited or ignored. The hook
  is silent when clean and never blocks if cite-check itself fails to launch.
- New-file detection in the default mode uses
  `git ls-files --others --exclude-standard`.

Root-causing the behavior being cited is out of scope — that is the global
`systematic-debugging` skill. Enforces [[cite-primary-source-in-comments]];
part of [[repo-style-guide]].

`--all` currently also flags `Taskfile.yml:7` (a genuine uncited MSBuild
Terminal Logger claim) plus a few `design/*.js` mockup comments that name
WebGPU while describing our fallback — disposition those with the ignore
pragma.
