# Style Guide

Conventions for code and prose in this repo. Terse rules, each with a real
example. Add rows in the voice of the existing ones.

## Prose

### US English only

No British spellings. "color" not "colour", "behavior" not "behaviour",
"judgment" not "judgement", "-ize"/"-ization" not "-ise"/"-isation"
("serialize", "normalization"), "-log" not "-logue" ("catalog"), single-`l`
inflections ("modeling", "labeled"). Applies to comments, docs, identifiers,
and commit messages alike.

## Code

### K&R braces in C#, TypeScript, and JavaScript

Opening brace on the same line as the statement it belongs to — type, method,
`if`/`else`, `for`, lambda body. No Allman (brace on its own line), including
for C#, where the IDE default is otherwise.

```csharp
public static string DefaultLogPath(string dir) {
    if (string.IsNullOrEmpty(dir)) {
        return LogFileName;
    }
    return Path.Combine(dir, LogFileName);
}
```

## Comments

### Cite the primary source for behavioral claims

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

A behavioral claim with no citation is treated as a guess and will be
challenged. See `.agents/memory/cite-primary-source-in-comments.md`.
