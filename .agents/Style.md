# Style Guide

Conventions for code and prose in this repo. Terse rules, each with a real
example. Add rows in the voice of the existing ones.

## Comments

### Cite the primary source for behavioural claims

Any comment that explains *why* a platform, SDK, or tool behaves a certain way
must cite its primary source — the vendor's own reference page, not a blog,
Stack Overflow, or a GitHub issue — on the line immediately after the comment:

```xml
<!-- WinExe builds with /SUBSYSTEM:WINDOWS, which is not attached to the parent
     console when run inside an existing console session. -->
<!-- See https://learn.microsoft.com/windows/console/console-allocation-policy -->
```

- Use the language's own comment syntax: `// See {href}` (C#), `# See {href}`
  (YAML/shell), `<!-- See {href} -->` (XML/HTML/csproj).
- Link the deepest stable URL, with anchor, over a docs landing page.
- Find the source through the docs MCPs before writing the claim.

A behavioural claim with no citation is treated as a guess and will be
challenged. See `.agents/memory/cite-primary-source-in-comments.md`.
