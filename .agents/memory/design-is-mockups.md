---
name: design-is-mockups
description: bios-launcher/design/*.html are interactive PS2-BIOS mockups, not "feasibility scaffolds"
type: project
---

`design/*.html` are interactive HTML/CSS/vanilla-JS mockups that visually and
interactively mimic the PlayStation 2 BIOS UI, for a future .NET 10 game
launcher (spec in `design/scaffold.md`). They are **mockups**, not "feasibility
scaffolds" — that framing was corrected twice and the owner dislikes it.

The fidelity target is the real PS2 BIOS: match the reference screenshots in
`design/references/` (`main_menu`, `browser`, `settings`, `memory_card_saves`,
etc.). Do not over-design past what the references show — an early indigo-nebula
concept was rejected as an overshoot. `index.html` (renamed from `launcher.html`
so `/` serves it) is the entry page.

Related: [[mockup-conventions]].
