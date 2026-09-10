---
name: repo-style-guide
description: .agents/Style.md is the repo's code + prose style guide — read it before writing either
type: project
---

`.agents/Style.md` holds the repo's style conventions, each with a worked
example. Read it before writing code, comments, docs, or commit messages;
add new rules there in the voice of the existing ones rather than scattering
them across memories.

Sections as of 2026-09-10:

- **US English only** — no British spellings anywhere (comments, docs,
  identifiers, commit messages): `color` not `colour`, `behavior` not
  `behaviour`, `judgment` not `judgement`, `-ize`/`-ization` not
  `-ise`/`-isation`, `catalog` not `catalogue`, single-`l` inflections
  (`modeling`, `labeled`).
- **K&R braces in C#, TypeScript, JavaScript** — opening brace on the
  statement's line, never Allman. For C# this overrides the .NET/Roslyn
  default; `.editorconfig` enforces it (`csharp_new_line_before_open_brace =
  none`, plus 4-space `[*.cs]` indent).
- **Cite the primary source for behavioral claims** — see
  [[cite-primary-source-in-comments]] and [[cite-check-skill]].

**Why:** These were all repeat corrections in one session (British spellings,
Allman braces, uncited claims). A single discoverable guide stops each one
recurring for any agent.

**How to apply:** New convention or a correction about form → put it in
`.agents/Style.md`, not a fresh memory. Related: [[minimal-over-clever]].
