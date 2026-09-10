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

### Notifications are events, not passed-around delegates

A type that notifies observers of something it did exposes a C# `event`, not a
settable `Action`/`Func` property or a constructor `Action` parameter threaded
through from the composition root. Passing delegates around by hand hides the
subscriber graph, lets one caller silently clobber another's handler, and makes
the wiring order load-bearing.

```csharp
// no: caller assigns, only one handler, order matters
public Action<Command>? OnCommand { get; set; }
public RendererHost(Action? renderFrame = null, Action? wake = null) { ... }

// yes: many subscribers, no clobbering, self-contained wiring
public event Action<Command>? CommandReceived;
public event Action? RenderFrame;
```

A callback that is genuinely single-owner and internal (e.g. a queue's wake
signal) stays inside the class that owns both ends — wire it in the method that
creates the collaborator, not by taking it as a parameter.

### A type never subscribes to its own event

If a class needs to do bookkeeping when it raises an event, it does that work
at the raise site — inline, before or after the `Invoke` — not by subscribing a
handler to its own event. Self-subscription adds an indirection with no
observer benefit, reorders side effects unpredictably, and risks re-entrancy.

```csharp
// no: host subscribes to its own RenderFrame to bump a counter
RenderFrame += () => _counters.Frames++;

// yes: bump where it is raised
private void SubmitFrame() {
    _counters.Frames++;
    RenderFrame?.Invoke();
}
```

Counters incremented this way stay read-only to the outside; drop any external
`MarkX()` mutators — the incrementing is the raiser's own bookkeeping.

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
