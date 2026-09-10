---
name: docs-mcp-before-diagnosing
description: On any failure naming a tool, SDK, or error code, read the docs MCPs fully before proposing a fix or a theory
type: feedback
---

When an error names a specific tool, framework, SDK, or carries a documented
error code (`NETSDK1047`, MSBuild switches, Taskfile behaviour, a library API),
go to the documentation sources *first* and read the relevant pages in full
before proposing anything:

- Microsoft Learn MCP (`microsoft_docs_search` / `microsoft_docs_fetch`) for
  .NET / MSBuild / SDK.
- Context7 (`resolve-library-id` / `query-docs`) for library and CLI docs
  (e.g. go-task).
- Web search for the exact error string + symptom when the MCPs are thin.

In the session that prompted this, the owner had to say "use MCP" four times;
each stretch of guessing produced a wrong fix. The global rule to prefer MCP
lookups over recollection already exists — this is the concrete trigger: a
named-tool error or a redirect that mentions docs/MCP means look it up now, and
finish reading before theorising.

**Why:** The owner treats "I'm puzzled" / "theorizing" as a tell that the docs
weren't read. Guessing at tool behaviour burns turns and misdiagnoses.

**How to apply:** Named-tool error or doc-referencing redirect → docs MCP /
web first, read the whole relevant section, then act. No hedged theories in
place of a lookup. Related: [[verify-in-users-environment]],
[[minimal-over-clever]].
