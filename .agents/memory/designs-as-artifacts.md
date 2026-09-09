---
name: designs-as-artifacts
description: Every design/plan/proposal/spec goes in an artifact with real formatting, never a chat wall of text
type: feedback
---

Never present a design, plan, proposal, or spec as a wall of text in chat.
Write it as an artifact — Markdown, interactive HTML, or a real Claude artifact
(with `db` where collaboration or state helps) — and give chat only a
one-or-two-line pointer plus the approval ask. This includes "short"
bounded-task designs. A brainstorming step that says "present a short design in
chat" does NOT override this.

The owner values craft here: the first boot-splash design note, published as a
styled HTML artifact grounded in the launcher's own palette, got "Good job. I
appreciate the rich formatting." `AGENTS.md` already says to prefer artifacts
over pasting substantial content into chat; this is the stronger form.

**Why:** Stated hard rule (also an Absolute Rule in the owner's global config);
chat walls of text bypass review and read as low-effort.

**How to apply:** Load the `artifact-design` skill first, invest in palette,
type, and layout grounded in the subject, publish, hand over the link. Keep the
doc updated in place as decisions change. Related: [[minimal-over-clever]],
[[boot-splash-design-doc]].
