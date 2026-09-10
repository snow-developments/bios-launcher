---
name: design-idioms
description: During design work the user rejects specific OO smells by name — pre-empt them; and design docs are provisional in pre-alpha
type: feedback
---

When designing or grilling on a design in this repo, the user has a consistent,
strongly-held set of anti-patterns. Propose the clean form up front rather than
the imperative form and getting grilled into it. Smells named and rejected in
one `/grill-me` session on `RendererHost.Run()`:

- **Imperative state-transition / bookkeeping methods** — `MarkRunning()`,
  external `MarkX()` counter mutators. Prefer state **derived** from a fact
  (`IsRunning` = "`Run()` is on the stack"); if a counter must exist, the type
  that raises the event increments it **at the raise site**, and the mutator is
  not part of the public API.
- **Dirty flags / `HasPending` / `IsDirty` polled by the consumer.** Prefer a
  producer that accumulates and hands back an **immutable, coalesced result** —
  "command queues are Builder objects that produce an immutable result."
- **Passed-around `Action`/`Func`** (ctor params, settable delegate properties).
  Prefer C# `event`s. A single-owner internal callback (a queue wake) stays
  inside the class that owns both ends, wired at the creation site.
- **A type subscribing to its own event.** Do the side effect inline at the
  raise site.
- **`GetHashCode` / other contract-bound overrides repurposed as signals.**

Two of these were codified into `.agents/Style.md` this session (events over
delegates; no self-subscription) — see [[repo-style-guide]].

Design docs are treated as provisional: `design/scaffold.md` and even a
just-approved design doc are "not gospel … this is pre-alpha software," and get
overridden mid-grill when a better shape emerges. Don't cite scaffold.md as a
binding constraint against a cleaner design.

**Why:** These OO instincts are settled and unwritten; proposing the imperative
version wastes grilling rounds. Overriding a design doc is expected, not a
process violation.

**How to apply:** Before presenting a design, scan it for the smells above and
pre-empt them. Treat `scaffold.md` as context, not contract. Related:
[[minimal-over-clever]], [[repo-style-guide]], [[grilling-with-askuserquestion]].
