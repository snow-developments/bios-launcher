---
name: verify-in-users-environment
description: A green run in a non-equivalent environment is not verification — name the reproduction gap and don't claim the fix is done
type: feedback
---

When the owner reports a symptom seen in their environment — an interactive
terminal, their editor, a real GPU browser, a specific shell — a passing run in
a *different* environment does not verify the fix. Piping a command through the
Bash tool makes stdout a non-TTY, which both silently disables TTY-only
behavior and hands the child an inherited pipe handle — so the actual root
cause here (a `WinExe` process not being attached to the parent console in a
TTY) could never show up in a piped run. Every "fixed and verified" claim was
checked against a setup that could not exhibit the problem.

The same `task run` "no output" report was restated several times across
sessions; each round produced a new confident fix (`RuntimeIdentifiers`,
`--tl:off`, `MSBUILDTERMINALLOGGER=off`, then the Taskfile `env:` placement),
none reproduced first, and a clean local run was treated as a rebuttal. The
memory note itself had recorded "MSBuild Terminal Logger VT100" as the cause —
a written-down theory is still a theory until the mechanism is confirmed
against primary docs.

**Why:** Presenting unverified fixes as complete wastes the owner's turns and
erodes trust faster than saying "I can't reproduce this here."

**How to apply:** Before claiming a fix works, ask whether your test path
matches where the symptom lives (TTY vs pipe, GPU vs none, their terminal vs
yours). If it doesn't, say so plainly, give the fix as a hypothesis, and ask
the owner to run the exact command in the failing environment — or get the
diagnostic commands run there first. A restated symptom means stop and
investigate that, not re-defend the current path. Related:
[[preview-verification-limits]], [[docs-mcp-before-diagnosing]],
[[cite-primary-source-in-comments]], [[minimal-over-clever]].
