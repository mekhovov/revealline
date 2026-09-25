# UX1-A2: exact Versus and Team Journey pictures

Status: locally reconciled implementation draft on UX1-A1 head
`91f6e6d04dfedf5cb2d50ae848f241938af891de`. It does not bump a version, merge,
tag, deploy or change an immutable release.

## Implemented slice

A legal authored Versus or Team Journey win can retain the original that the
actual attempt accepted. Both hosts use the mode-aware companion ledger introduced
by UX1-A1. They do not write Solo clears or Solo pictures, change Legacy awards, or
infer an original from a mission name, current catalogue entry or later theme.

Versus admits a picture only when the completed paired-board recipe belongs to the
current authored Journey and its live decoded backdrop authenticates against that
recipe's exact asset descriptor. The companion records the exact route edition,
mission, campaign execution, authored level revision, run, gameplay identity,
difficulty, theme and asset revision. Duplicate terminal delivery remains guarded
by the existing finished-match owner.

Team admission stays inside the existing transient attempt owner. The progress
adapter receives a bounded picture template only after the current Team frame
authenticates against the owned row, accepted live binding and presentation
snapshot. It then fills the exact mode, mission, level, run and gameplay fields.
This adds no persistent co-op session, board state, rescue state or input state.
Imported, procedural, unowned and invalid bindings can still complete their legal
gameplay path, but cannot acquire a Journey original.

Versus and Team now expose a mode-local **Journey pictures** dialog. It reads only
the current mode and exact edition, distinguishes historical clears whose original
is unavailable, verifies bytes before viewing, and restores its opener on Back.
Viewing, retrying a download and closing the dialog cannot award progress, start a
mission, replace either board or infer another mode's reward. The broader shared
Collection information architecture and artwork-first gallery remain UX1-B/UX5.

## Compatibility and failure behavior

- Historical gameplay receipt readers and their stored shapes are unchanged. The
  presentation record remains a separate companion in the same atomic profile
  transaction.
- Team's backend adapter exposes the existing atomic state read/write operations;
  it does not introduce a new database or persistent co-op run format.
- Invalid or conflicting presentation data fails closed. A valid gameplay clear
  remains recordable without claiming an original. Storage failure keeps the
  established session-only recovery/export behavior.
- The dialogs filter by exact `mode` and `editionId`. An earlier clear without an
  exact picture record remains visible as unavailable; current art is never used
  as proof of that earlier reward.
- Artwork repair/download remains reference-based. Backup files do not contain the
  image bytes, and this draft does not claim complete offline availability.

## Focused evidence

- The combined Journey ledger, Solo reward host, Team progress and mode-local
  picture-surface run passes 18/18 with no skips. It covers historical reader
  preservation, atomic storage, cross-mode isolation, exact-mode filtering,
  opener restoration, invalid-presentation fallback and store recreation.
- The complete Team default-entry host file passes 13/13 with no skips. It covers
  the exact current Team reward as well as queryless, explicit Legacy, ambiguous
  entry, return-token and modeled-controller paths.
- The complete Versus host file passes 13/13 with no skips. Both Journey routes
  continue across every campaign with equal authoritative checkpoints, retain an
  exact original for each completed mission and expose only Versus originals. Its
  controller gallery case uses the reconciled 198-card catalogue fixture.
- The exact Team picture authority suite passes 82/82 with no skips across current
  revision 77, retained revisions 58–76, both reviewed starter pictures and
  historical imports. A focused post-format binding rerun passes 27/27.
- Repository lint, game and native formatting checks, validation and the ordinary
  1,142-file production build pass on this local candidate. These checks do not
  replace hosted exact-head gates or public acceptance.
- Inherited Couch quick-start behavior passes 7/7, including Steam Deck Confirm
  echo and passive Cancel focus. Trail/impact readability and Team emitter
  presentation pass 36/36, confirming this stack does not regress those layers.

The historical A2 stack exposed a real compatibility defect after reconciliation:
its compiled FPV presentation was revision 77 while its closed Team picture
authority stopped at revision 74. This candidate advances that authority to 77,
retains exact revisions 58–76 and expands only the matching finite policy bound.
Both approved picture descriptors and bytes remain unchanged.

Focused source evidence is not release acceptance. Visual review, actual reload,
Retry and Next recovery with missing bytes, physical controller/touch checks,
responsive browser checks, complete offline preparation, full PR gates and public
Pages verification remain required before this stack can ship.

## Remaining before acceptance

1. Land and release UX1-A1 first, then rebase this stacked draft on its accepted
   head without changing the immutable picture contract.
2. Independently review the exact final A2 diff and run applicable full PR gates.
   Qualify real browser reload, Retry, Next, storage failure and unavailable-art
   paths for both modes.
3. Verify keyboard, controller/D-pad and touch access to the mode-local dialog at
   desktop, 1280×800, portrait and short-landscape layouts. Hardware evidence stays
   distinct from modeled input.
4. Version, freeze, deploy and publicly verify this feature only after the stacked
   dependency is accepted. This draft performs none of those publisher actions.
5. Continue UX1-B for the complete compact campaign gallery and UX2–UX6 afterward.
