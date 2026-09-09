# Todo List

- [x] ~~Settle on a noun for the orbiting-nodes motif~~ — it's the **orrery**, keep it
- [x] ~~Review `design/orrery.js` against @.claude/skills/webgpu~~ — passes the
      five contracts; applied 3 minor fixes (`uncapturederror` listener,
      `teardown()` that disconnects observers + unconfigures the context, dead
      `ring_vs` line). Everything else remains html/CSS
- [x] ~~CSS page transitions~~ — full-page cross-fade, JS-driven (`Bios.navigate`
      + `.is-leaving` in launcher.js/.css), works in all browsers, honors
      reduced-motion
