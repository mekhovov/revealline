# UX2 Team quick start — v0.134.0 candidate

## Scope

- Reconciled base: `ecaadd8d4b01c81d72c93c9989ecf260807804bf`, the rebased local
  v0.133.0 compact-gallery candidate stacked on the v0.132.3 Couch input handoff
  and accepted v0.132.2 presentation revision 88.
- Rebased candidate commit: `3c34b0122060c6850a811a933be41e588f31058f`,
  now contained by `codex/couch-secondary-nav-v135-local`.
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

The reconciled source passes `npm run validate`, including localization with
9,529 messages and 7,714 source references, the 1,239-file game validator, and
presentation revision 88. Its focused automated evidence is:

- 53/53 localization and About-navigation tests;
- 194/194 Couch, composite-menu, content-Team, and controller-navigation tests;
- 103/103 controller binding, confirm-guard, lifecycle, and router tests;
- 12/12 compact-gallery Team controller and inventory host tests; and
- 9/9 Couch quick-start parity tests.

Scoped ESLint, Prettier, version parity, generated-catalog freshness, and diff
checks pass. Rebuilding localization preserves
`game/i18n/content-registry.mjs` byte for byte at SHA-256
`86db5778ee599f337be9cdb0d1e861ff51b738547eb15dce06272384662c2562`.

The original full-Team-host evidence was misreported. The exact v0.134.0
candidate was 69/77: five import cases still supplied plain file doubles after
production required a genuine `Blob`, and three foreground-loss cases asked an
unauthorized synthetic click to bypass the controller Confirm echo window.
The v0.135.0 follow-up corrects those fixtures without relaxing production Blob
validation or input guards; the current stacked Team host passes 77/77.

The passing tests model keyboard, touch/pointer, controller assignment, Steam
Deck native Confirm echoes, passive picture preparation, and exact gallery
handoff. The base supplies the exact presentation revision-88 Team picture
bindings.

## Dependencies and evidence limits

1. The local v0.133.0 base is not an accepted release. If its eventual merge
   SHA differs, replay this single Team quick-start change onto that accepted
   source and rerun the complete focused boundary.
2. A later secondary-navigation change may also touch `relay-rescue.mjs`; retain
   this slice's passive-preparation focus and collapsed Team setup while taking
   the navigation owner only once.

Physical Steam Deck/controller behavior and browser touch remain separate
acceptance work. The automated-suite waiver does not turn skipped or inherited
failures into passes.
