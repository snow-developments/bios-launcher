---
name: writing-commit-messages
description: Use when writing or drafting a git commit message, stash message, or PR title for one of Chance's own repositories, before running git commit
---

# Writing Commit Messages

House style for Chance's repos (`github.com/chances/*`). Forked repos
(`deno-dwm`, `d-to-glsl`) follow their upstream instead — match the existing log.

**Chance runs `git commit` himself.** This skill is for drafting the message text.

## Subject line

- **Imperative mood, sentence case, no trailing period:** `Add`, `Fix`,
  `Refactor`, `Remove`, `Update`, `Simplify`, `Improve`, `Use`, `Bump`,
  `Rename`, `Extract`, `Integrate`, `Scaffold`, `Ensure`, `Prevent`, `Stub out`.
- **Length:** aim for ~50 chars, never exceed 72.
- **No Conventional Commits prefixes.** Never `feat:`, `fix:`, `chore:`, etc.
  Use a plain verb.
- **Backtick code identifiers, filenames, and types:**
  ``Add `GridSpace` agent space subclass``, ``Fix API for wgpu-native 0.19``.
- **`macOS`** is written without a space. `Linux` and `Windows` stay plain.
- **First commit of a repo** is exactly `Initial commit`.

### Compound subjects

Join two independent changes with `, `; capitalize each clause and keep it
imperative: `Simplify layout constraints, Remove dead code`.

- Hard cap: **three** clauses.
- **Two or more is usually a smell** — prefer splitting into separate commits.
  Use a compound subject only when the changes are genuinely one logical unit.

### Optional leading emoji

Only when the *entire* commit is that one category. Always optional; a plain
verb is always acceptable. Glyph goes first: `💅 Lint sources`.

| Emoji | Use for |
| ----- | ------- |
| 💅 | lint / format / style-only changes |
| 🚧 | works in progress (stash messages, checkpoint commits) |
| 📚 | documentation — Markdown/HTML/human-readable docs, and agentic rules, skills, memories |
| 🎉 | finally resolving a long-running problem, or completing a major milestone |

## Body

**Always include a body.** Blank line after the subject, then one of:

- **Wrapped prose** (~72 cols) explaining the why/how.
- **A `- ` bullet list** of imperative, capitalized clauses — good for a change
  that touches several files or has distinct parts.
- **A bare reference URL** (or a few) when the change points to an issue,
  spec, or upstream discussion and needs nothing else.

Emoji may appear in body text where natural (`ships with static libraries 🎉`).

## Trailers

When an agent drafted or co-wrote the commit, add an agent-agnostic
co-author trailer (plain agent name, no model/version):

```
Co-Authored-By: Claude <noreply@anthropic.com>
Co-Authored-By: OpenCode <noreply@opencode.org>
Co-Authored-By: Gemini <noreply@gemini.google>
```

## Quick reference

```
💅 Format sources

Apply `deno fmt` across the repo. No logic changes.
```

```
Add orrery GPU error handling, Complete its teardown path

- Add an `uncapturederror` handler so GPU validation failures surface
- Replace the bare `stop()` with `teardown()`: disconnect the
  `ResizeObserver`, drop the reduced-motion listener, `unconfigure()`
  the context
- Remove a dead line from the `ring_vs` WGSL shader
- TODO.md: tick the review item

Co-Authored-By: Claude <noreply@anthropic.com>
```

## Common mistakes

| Mistake | Fix |
| ------- | --- |
| `Harden lifecycle and clean up` — editorializing verb, `and` filler | Precise imperative; split parts with `, ` or bullets |
| `Run formatter across the repo` for a pure format commit | `💅 Format sources` |
| `stop()`, `ring_vs`, `TODO.md` unquoted | Backtick every identifier and filename |
| `feat: add room model` | `Add a room model` |
| `Fix shapes example on mac OS` | `Fix shapes example on macOS` |
| Subject only, no body | Every commit gets a body |
| `Co-Authored-By: Claude Sonnet 5 <...>` | Plain agent name: `Claude <noreply@anthropic.com>` |
