---
name: cite-check
description: Lint code comments for uncited behavioral claims about external tools. Use when asked to "check citations", before committing or opening review, or to audit the tree for comments that explain how a platform/SDK behaves without linking a primary source.
---

# cite-check

Enforces the AGENTS.md rule and `.agents/Style.md` convention: a comment that
explains _why_ a named external tool, SDK, or platform behaves a certain way
must cite a primary vendor source on the same or an adjacent comment line.

```xml
<!-- WinExe builds /SUBSYSTEM:WINDOWS, so it is not attached to the parent console in a TTY. -->
<!-- See https://learn.microsoft.com/windows/console/console-allocation-policy -->
```

Root-causing the behavior is **not** this skill's job — that is the global
`systematic-debugging` skill. This is a mechanical lint.

## Run

From this directory:

```bash
deno task check        # comments in git-changed files (default use)
deno task check:all    # every tracked source file (audit; expect some noise)
deno task self-test    # run the labeled classifier fixtures
```

From the repo root, pass the config so the `compromise` import resolves:

```bash
deno run --allow-read --allow-env --allow-run=git \
  --config .agents/skills/cite-check/deno.json \
  .agents/skills/cite-check/cite-check.ts [paths...] [--all] [--json]
```

Exit `0` clean · `1` findings · `2` IO error · `3` self-test failed.

## How it decides

The claim judgment is NLP, not a prose regex. Per comment, using
[`compromise`](https://github.com/spencermountain/compromise):

1. Split into sentences; keep declaratives (`.isStatement()`).
2. **Subject** — the sentence names a product from the `PRODUCTS` lexicon
   (WinExe, MSBuild, NLog, Deno, EF Core, …) or a source identifier
   (`PascalCase.Member`, `camelCase`, `SCREAMING_SNAKE`).
3. **Assertion** — a narrow behavior verb (`detach`, `inherit`, `swallow`,
   `override`, `take effect`, …), a modal, a negated verb (`#Negative #Verb`),
   or a causal marker (`because`, `which means`, …).
4. Not a bare imperative (`Use exe to …`, `See the docs`).
5. **Citation** — a finding only if the comment run has no `http(s)://` URL.

Lines that look like commented-out code, license headers, and bare `TODO:`
markers are skipped.

## Escape hatch

Prose that names a tool but describes _our own code's_ reaction can trip the
subject+assertion test. Mark such a comment and it is skipped:

```js
// If WebGPU is unavailable we drop a fallback class so the layout never
// collapses.  cite-check: ignore
```

## Known limitations

- Needs a _named_ product or identifier as subject: a true claim phrased only
  with generic nouns ("a redirected stdout handle is inherited by the child") is
  not caught.
- `--all` on the current tree reports `Taskfile.yml:7` (a real uncited claim
  about the MSBuild Terminal Logger) plus a few descriptive mockup comments in
  `design/*.js` that name WebGPU — disposition those with `cite-check: ignore`.
- First run downloads `compromise` from npm; subsequent runs are offline
  (`deno cache`d).
