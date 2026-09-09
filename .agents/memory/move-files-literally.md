---
name: move-files-literally
description: To move or rename a file, actually move it (git mv / mv) — never rewrite its contents to a new path
type: feedback
---

Moving or renaming a file means literally moving it: `git mv` for tracked
files, `mv` / `Move-Item` for untracked ones. Never "move" a file by writing
its contents to the new path (Write, a heredoc, `cat >`) and deleting or
abandoning the original — that loses history, risks silent content drift, and
leaves stale copies. If a move also needs edits, move first, then edit the file
at its new path.

This came up when a design doc was relocated into the repo by rewriting rather
than moving; the owner made it an Absolute Rule in their global config.

**Why:** Rewrite-to-move destroys `git` history and invites divergence between
the old and new copies.

**How to apply:** Reach for `git mv` / `mv` by reflex for any relocation.
Related: [[minimal-over-clever]].
