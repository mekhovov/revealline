# Optional combat — held BoardPainter adapter evidence

Date:2026-09-21. Local reviewed intake artifact only. The actual shared renderer,
app, Versus/Team hosts, preferences, audio and Studio preview guard are unchanged.
This does not complete D2c/C2 or qualify combat gameplay for public release.

## Deliverable and exact source

`docs/patches/combat-board-e9434d03.patch` is a strictly additive renderer patch:

- Pinned release-candidate source: `e9434d03`.
- Original renderer Git blob: `f93317fa0d48d862ecffa29d4cd3b854d04a35b9`.
- Patched renderer Git blob: `f731b54cf167c91adeea1df3203f3a56294524b5`.
- Patch SHA-256: `c4fde0cb043e472517a7c0b22330bce42e3d34181d324ec15b1a0628abd846c9`.
- This lane's unmodified newer renderer blob remains
  `2c3faaaf2953da0ee882186f6c057ffcb1f272e7`.

The patch also applies and reverses on that newer renderer without changing its
relay, directional-field or newer player-locator adapters. It is not a proposal
to replace the current file with the older release candidate. Future Team/art
intake must still be reconciled against its final accepted source.

The checked-in `.txt` fixture is byte-exact historical renderer source, verified
with canonical Git blob hashing. It is not a runtime module or alternate host.
This avoids a test dependency on an unrelated Git object in fresh/shallow CI.
Patch application tests use isolated generated temporary trees, then execute the
resulting real BoardPainter modules with this lane's current dependencies.
Consequently this is a composed adapter check, not proof of a full accepted
`e9434d03` combat-enabled application.

## Behavior

- One validated combat projection per draw; malformed active data throws before
  canvas commands, painter animation, image acquisition or celebration changes.
  The future host must stop the attempt and display that diagnostic.
- One bounded sprite cache per painter, reset by setLook/setLevel.
- Scrap below current hazards; robot bodies and locked warnings below the live
  trail; projectiles above ordinary enemy bodies and below the craft.
- Existing scale/reduced settings apply. Cosmetic `showCombatScrap:false` cannot
  remove warnings, bodies or projectiles, or change simulation identity.
- Terminal picture rendering keeps inert scrap without resurrecting live threats
  or a forever-young spark. Earned coverage and source artwork remain unchanged.

## Verification

**389/389 tests pass on Node20.19.5 and22.22.2**, one final combined invocation
per version. Ten new adapter tests execute the patched renderer;315 existing
D2/compiler/Studio/presentation tests and64 foundation/Team-presentation/backdrop/
player-location regressions run against their unchanged source.

Adapter tests cover byte/reverse-application integrity; absent/disabled command
stream and painter-state equivalence; failure before any active-state getter
execution/drawing; real public-step warning, fired shot, ram and capture frames;
layer order; terminal surviving actors; pause; actual freeze collection;294px and
1152px CSS widths; reduced effects; finite coordinates; scrap toggle; bounded
cache reuse/reset. Run checkpoints remain unchanged by rendering. Static C1
native evidence remains in the [component report](journey-optional-combat-presentation.md).

Independent spec and code review approved the held adapter. Main review caught
the initial Git-history dependency and replaced it with the verified fixture;
all389 tests above were rerun after that correction. Scoped JavaScript lint,
formatting and whitespace checks pass.

## Remaining

Accepted-source host integration, visible invalid-state recovery, captions/audio,
pending-next-attempt player choice, persistence/restart/Continue/receipt semantics,
real-host/native/device/human play, D2d Team and exact-source public deployment.
The enabled-combat Studio preview guard must stay until those required host
presentation paths exist. No release, version bump or Pages promotion occurred
in this held artifact increment. Original soundtrack generation remains paused.
