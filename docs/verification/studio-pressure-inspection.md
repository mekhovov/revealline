# Studio pressure-edition inspection

Implemented at `2de89964a9e8ce8d437f3a241eeea00426e058e3` after the reviewed
[scoped design](../superpowers/specs/2026-09-21-studio-pressure-inspection-design.md).
This is a local authoring affordance, not automatic Journey enrollment or a release.

The new **Inspect pressure-v2 copy of current draft** action reuses the compiler's
existing whole-project successor projection and ordinary inspection/Apply flow.
Unapplied JSON uses the existing discard guard; pending Apply is invalidated before
projection. Already-v2 drafts disable the action. Maps, assets, player handling and
warning lengths are preserved; old published editions and frozen previews are not
changed. Apply remains explicit and participates in checkpoint/Undo/Redo history.

Focused Studio session, projector, CLI and new wiring/copy-on-write tests:
**21/21 on Node20.19.5 and22.22.2**. ESLint, Prettier and whitespace pass.
The new test proves inspection leaves the active draft unchanged, then checks
explicit replacement, immutable picture/map references and exact Undo/Redo.

## Native exact-source check

Read-only local source server at port8820, commit `2de89964`, in-app browser:

1. Inspected and explicitly applied pictured Crosswind candidates into a fresh
   isolated draft. Standard showed `journey-difficulty-v1`, three lives,10cells/s.
2. Used the new action. Active workbench remainedv1 and Apply became available;
   seven missions/maps compiled. No silent draft replacement occurred.
3. Applied. Standard displayedv2, enemies40% faster, attack rests15% shorter,
   unchanged player handling/warnings. The action became disabled.
4. Undo restoredv1 and enabled the action; Redo restoredv2 and disabled it.
5. Exact Solo preview reached Engine ready, then Read the Arrows practice.
   A real Down tap continuously crossed the arrow lane, closed at the center
   island and stopped at0.6% earned coverage without losing any of three lives.
6. Native screenshot showed the original highland picture through foundations
   and the closed line, distinct arrow fields, the two field keepers and perimeter
   actor. Pause/resume retained the result; final paused state at34seconds.
   No browser warnings/errors were reported.

This is one desktop first-return check, not a native full clear, touch/controller
qualification, human balance/usability signoff or public Pages deployment.
