# UX2 Team quick start — v0.141.2 successor candidate

## Scope

- Prepared branch parent: final compact-gallery PR head
  `547e063cb88ec11a1f4a2a8b34d30542789b4eb4` (v0.141.1, parent
  `b4ef4b3024675bd8e12b13af28215553707d1bff`, presentation revision 91),
  including its campaign-rail focus correction.
- Prepared branch: `codex/team-quickstart-v1412-prepared`.
- The package, root lock record, and build configuration identify this successor
  as v0.141.2. Its v0.141.1 parent is still a candidate and is not claimed as
  merged, released, deployed or publicly accepted here.
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

The prepared v0.141.2 candidate passes these sequential focused files:

- 77/77 complete Team host tests;
- 9/9 Couch quick-start parity tests;
- 18/18 Team picture recovery-focus tests; and
- 5/5 presentation bootstrap-retry tests;
- 3/3 compact-menu localization tests; and
- 2/2 Team-control localization tests.

The recovery tests now preserve the intended distinction: passive initial
preparation leaves Cancel secondary and focus unclaimed; an explicit Retry may
focus and reveal Cancel, and a deliberate Cancel returns focus to Retry.

The passing tests model keyboard, touch/pointer, controller assignment, Steam
Deck native Confirm echoes, passive picture preparation, and exact gallery
handoff. The base supplies the exact presentation revision-91 Team picture
bindings.

## Dependencies and evidence limits

1. Keep this candidate local until v0.141.1 is publicly accepted. Then reconcile
   it onto that exact accepted source and rerun the complete focused boundary and
   release gates before any push, merge or publication.
2. A later secondary-navigation change may also touch `relay-rescue.mjs`; retain
   this slice's passive-preparation focus and collapsed Team setup while taking
   the navigation owner only once.

Physical Steam Deck/controller behavior and browser touch remain separate
acceptance work. The automated-suite waiver does not turn skipped or inherited
failures into passes.
