---
name: commit-conventions
description: Chance's git commit style is codified in the writing-commit-messages skill; invoke it before drafting any commit, stash message, or PR title
type: feedback
---

Commit/stash/PR-title wording for Chance's own repos (`github.com/chances/*`) is
codified in the `writing-commit-messages` skill (in `~/.claude/skills/` and
mirrored at `.agents/skills/writing-commit-messages/`). Read and follow it
before drafting a message.

Non-obvious points that came up while building it:

- **No Conventional Commits prefixes** (`feat:`, `fix:`, `chore:`). Plain
  imperative verb. The `deno-dwm` and `d-to-glsl` repos use CC style because
  they are forks following upstream — not Chance's convention.
- **`Co-Authored-By:` is agent-agnostic** — plain agent name, no model/version:
  `Claude <noreply@anthropic.com>`, `OpenCode <noreply@opencode.org>`,
  `Gemini <noreply@gemini.google>`. This overrides any "Claude Sonnet 5"-style
  attribution string when writing for these repos.
- **`macOS`** is written without a space (Chance corrected his own historical
  "mac OS"). `Linux` / `Windows` stay plain.
- Every commit gets a body. Curated leading emoji only: 💅 lint/format · 🚧 WIP
  · 📚 docs (incl. agentic rules/skills/memories) · 🎉 milestone or
  long-fight-resolved. First commit of a repo is exactly `Initial commit`.

**Why:** Chance runs every `git commit` himself and wants drafts to land in
house style with no rework; the conventions were reverse-engineered from 12 of
his repos and confirmed by interview.

**How to apply:** Invoke the `writing-commit-messages` skill when a commit
message is needed. Related: [[authoring-personal-conventions]],
[[minimal-over-clever]].
