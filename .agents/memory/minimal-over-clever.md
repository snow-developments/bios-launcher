---
name: minimal-over-clever
description: Reach for the smallest pragmatic solution and act on it; don't rabbit-hole into framework capabilities or narrate-and-wait
type: feedback
---

When a task can be solved by a small, boring, local tool, build that — do not
detour into deep framework or capability research first. In one session a whole
turn went into the Artifact `db`/`artifact` runtime-capability contract and a
self-republishing-page scheme to persist plan-doc checkboxes; the owner cut it
off ("you're spinning on bullshit") and asked for a minimal Deno server, which
was ~one file and quick (it became the `plan-checkboxes` skill).

Also: act rather than post passive status. "Still awaiting your approval" /
restating that code lags the plan drew "I don't appreciate the passive tone."
State what's done, then take the next step or ask a concrete question — no
holding-pattern narration.

**Why:** The owner runs a fast, hands-on loop and treats over-engineering and
passive hedging as wasted turns.

**How to apply:** Default to the simplest thing that works (a script, a static
server, one vanilla module). Escalate only after the simple thing is shown to
fail. When genuinely blocked on a choice, use AskUserQuestion; otherwise
proceed. Related: [[designs-as-artifacts]], [[move-files-literally]].
