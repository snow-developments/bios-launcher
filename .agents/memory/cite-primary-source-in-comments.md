---
name: cite-primary-source-in-comments
description: A code comment that explains non-obvious platform/tool behaviour must cite its primary source with a `<!-- See {href} -->` (or language-equivalent) line
type: feedback
---

When a comment asserts why a platform, SDK, or tool behaves a certain way
(e.g. "the WinExe GUI subsystem detaches from the parent console"), the very
next line must link the **primary** source that establishes it — the vendor's
own reference page, not a blog, Stack Overflow answer, or GitHub issue.

Format, one line, immediately after the explanatory comment:

```xml
<!-- See https://learn.microsoft.com/windows/console/console-allocation-policy -->
```

Use the language's own comment syntax (`// See {href}` in C#, `# See {href}` in
YAML, etc.). Prefer the deepest stable URL (with anchor) over a docs landing
page. Find the source via the docs MCPs first — see
[[docs-mcp-before-diagnosing]].

**Why:** The owner audits behavioural claims in comments and asks "cite your
source"; an uncited claim is treated as a guess. A primary-source link lets the
next reader verify the claim still holds without re-deriving it.

**How to apply:** Writing a comment that explains external behaviour →
add `<!-- See {href} -->` on the next line, pointing at the vendor reference.
No citation, no behavioural claim. Codified as an `AGENTS.md` rule and in
`.agents/Style.md`. Related: [[minimal-over-clever]],
[[verify-in-users-environment]], [[docs-mcp-before-diagnosing]].
