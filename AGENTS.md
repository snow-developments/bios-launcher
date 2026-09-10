# Agent Rules

- At session start, read `.agents/memory/README.md` and the files it indexes —
  durable, cross-agent facts about this repo. Treat `.agents/memory/` as the
  reference store: consult it whenever you need project context, conventions, or
  working-style guidance, and keep it current as decisions change.
- Use artifact tools and relevant skills when they are available for the task.
- Keep replies concise and information-dense; never dump walls of text.
- Prefer artifacts, canvases, or files for substantial content instead of
  pasting it into chat.
- Any comment or doc line that explains *why* a platform, SDK, or tool behaves
  a certain way must cite a primary vendor source on the next line —
  `// See {href}` (or the language's comment syntax), deepest stable URL, found
  via the docs MCPs. An uncited behavioural claim is treated as a guess. See
  `.agents/Style.md`.
- A theory is not a root cause — including one already written down in
  `.agents/memory/`. Before applying a fix, confirm the mechanism against
  primary docs and reproduce the symptom in the environment that actually shows
  it; then correct or delete the memory paragraph that carried the wrong theory.
