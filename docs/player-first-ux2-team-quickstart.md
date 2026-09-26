# UX2 Team quick start — v0.134.0 candidate

## Scope

- Prepared donor base: `77b28377f8b30db12483407be61930f717b6af1c`, the
  local v0.133.0 compact-gallery candidate used to create commit `84d8dbe8c`.
- Contract-correction branch: `codex/team-quickstart-v134-contract`.
- The package, root lock record, and build configuration identify this local
  candidate as v0.134.0.
- This source does not claim a merge, tag, release, Pages deployment,
  physical-controller check, browser-touch check, or public acceptance.
- The slice changes the Team lobby only. It preserves the stacked gallery's
  one-action launch and the Couch controller-to-touch handoff without taking
  ownership of the secondary navigation shell.

## Player problem and resulting behavior

The Team lobby placed its legacy arena selector in the quick-start path even
though the current Team Journey already provides a valid default arena. During
passive picture preparation, modeled-controller focus also landed on that
selector. This made Team feel like a setup form and placed a secondary control
between the player and Start.

The candidate moves Arena into the existing collapsed **Arena & team options**
disclosure with play style, difficulty, actor style, and imported packs. The
ready lobby keeps its one-action Start. Players who want a different legacy
arena can open the disclosure and select it without losing the existing route,
preview, or preparation behavior.

During passive initial picture preparation, default controller focus now stays
on the disclosure summary rather than a hidden form control or Cancel. Cancel
preparation remains available for a genuinely stalled or unwanted operation,
but it is not placed in the default Confirm path.

## Focused evidence

The donor's original full-Team-host evidence was misreported. Five import cases
still supplied plain file doubles after production required a genuine `Blob`,
and three foreground-loss cases asked an unauthorized synthetic click to bypass
the controller Confirm echo window. This correction uses genuine `Blob`
fixtures and actual controller navigation without relaxing production Blob
validation or input guards.

The corrected local candidate passes these sequential focused files:

- 77/77 complete Team host tests;
- 9/9 Couch quick-start parity tests;
- 18/18 Team picture recovery-focus tests; and
- 5/5 presentation bootstrap-retry tests.

The recovery tests now preserve the intended distinction: passive initial
preparation leaves Cancel secondary and focus unclaimed; an explicit Retry may
focus and reveal Cancel, and a deliberate Cancel returns focus to Retry.

The passing tests model keyboard, touch/pointer, controller assignment, Steam
Deck native Confirm echoes, passive picture preparation, and exact gallery
handoff. The base supplies the exact presentation revision-88 Team picture
bindings.

## Dependencies and evidence limits

1. The local v0.133.0 donor base is not an accepted release. Replay the Team
   quick-start and this bounded contract correction onto the accepted v0.133.0
   source, then rerun the complete focused boundary and release gates.
2. A later secondary-navigation change may also touch `relay-rescue.mjs`; retain
   this slice's passive-preparation focus and collapsed Team setup while taking
   the navigation owner only once.

Physical Steam Deck/controller behavior and browser touch remain separate
acceptance work. The automated-suite waiver does not turn skipped or inherited
failures into passes.
