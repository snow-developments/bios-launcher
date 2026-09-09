---
name: distill-session
description: Condense the current session's history into durable memory files and CLAUDE.md rules.
disable-model-invocation: true
---

# Distill Session

Turn what happened in **this session** into persistent knowledge, so the same
redirection never has to be given twice. Run when the user types
`/distill-session` (optionally with a focus hint as arguments, e.g.
`/distill-session just the deno/tooling stuff`).

This skill writes to the **file-based memory protocol** described in the user's
active instructions — the per-project `memory/` directory and its `MEMORY.md`
index — and to the rules file itself. Those files are not Claude-specific: the
user runs other coding agents against the same repos and machine, and the
`memory/`, `MEMORY.md`, `AGENTS.md`, and `CLAUDE.md` files may be read or
written by any of them. Keep everything you write agent-agnostic in tone — record
facts and rules, don't frame them as "Claude's". This skill does not write to
`.claude/topics/`, which is a different memory mechanism.

## Procedure

### 1. Scan the session

Review the conversation from the start (if it was compacted, read the summary
plus the tail; if a transcript path was given in a system reminder, read that).
Extract only **durable, reusable** items — things that will still matter in an
unrelated future session:

- **Corrections & redirections** the user gave you ("no Python, use Deno",
  "12 pillars always", "these are mockups not scaffolds"). These are the
  highest-value catches — each one is a rule you should not have needed.
- **Confirmed-good approaches** the user explicitly praised or accepted.
- **Non-obvious project facts** not derivable from the code, git history, or
  existing CLAUDE.md (architecture decisions, constraints, why something is the
  way it is).
- **External references** worth keeping (URLs, dashboards, tickets).
- **Recurring friction**: if you were redirected toward the same skill or
  workflow more than once, that pattern itself is worth recording.

Explicitly **discard**: anything the repo already records, one-off details
specific to the current task, transient state, and anything already covered by
an existing memory or CLAUDE.md rule.

### 2. Classify each item

| Destination | When |
|---|---|
| `memory/<slug>.md` (`type: feedback`) | Guidance on *how you should work* — corrections, confirmed approaches. Include **Why:** and **How to apply:** lines. |
| `memory/<slug>.md` (`type: project`) | Ongoing work, goals, constraints. Convert relative dates to absolute. |
| `memory/<slug>.md` (`type: user`) | Who the user is — role, expertise, standing preferences. |
| `memory/<slug>.md` (`type: reference`) | Pointers to external resources. |
| **`CLAUDE.md` Absolute Rule** | A hard, non-negotiable constraint the user framed as a rule ("save this as a hard rule"). Also drop a matching `type: feedback` memory that cross-links it. |

### 3. Check for duplicates

Read `MEMORY.md` and the existing files in `memory/`. If an item is already
covered, **update that file** instead of adding a new one. If a prior memory is
now wrong, delete it (and its `MEMORY.md` line).

### 4. Propose, then write

Present the planned changes as a short list — one line per file, showing
create / update / delete and a one-phrase summary. Use **AskUserQuestion** to
confirm scope when there is any ambiguity about what belongs in a hard rule vs.
a memory, or when you found more than ~4 candidates. Otherwise state the list
and proceed.

Then for each confirmed item:

- Write `memory/<slug>.md` with the frontmatter the global `CLAUDE.md` specifies
  (`name`, `description`, `metadata.type`), body first-person-neutral, related
  memories linked as `[[other-slug]]`.
- Add or update the one-line pointer in `MEMORY.md`:
  `- [Title](slug.md) — hook`.
- For an Absolute Rule: read `CLAUDE.md`, add the bullet under
  `## Absolute Rules` in the user's existing voice and formatting, merge — never
  replace.

### 5. Report

List what was written/updated/deleted, with paths. Do not commit anything.

## Notes

- The memory directory is the one named in the **Memory** section of your system
  prompt. Write there directly — it already exists.
- Keep each memory file to **one fact**. Split multi-part findings into separate
  files that link each other.
- Never put memory *content* in `MEMORY.md` — it is only an index.
