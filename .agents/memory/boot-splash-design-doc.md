---
name: boot-splash-design-doc
description: Published Claude artifact holding the boot-splash design note
type: reference
---

The boot-splash design note lives at `design/plans/boot.html` and is also
published as a Claude artifact:

https://claude.ai/code/artifact/aa1297e4-b482-466c-8470-bb6e7dc5cd9b

It covers the constraint (splash must not depend on shader compilation), the
locked decisions, the numbered splash sequence, components, files touched, and
verification. It is the source of truth for the splash's intended behaviour —
amend it in place when decisions change, and republish to the same URL (this
requires a session that has published or read that artifact; otherwise it
creates a separate one).

Related: [[boot-splash-status]], [[designs-as-artifacts]].
