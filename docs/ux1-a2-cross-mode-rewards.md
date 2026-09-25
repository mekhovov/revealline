# UX1-A2: exact Versus and Team Journey pictures

Status: reconciled with UX1-A1 against main
`fb703070ea4d4a48fa73ba23a8819bb2053aea6f`. It remains unversioned and does not
merge, tag, deploy or change an immutable release.

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

- Journey ledger and Team progress files: 16/16 tests passed, with no skips. This
  covers historical reader preservation, atomic storage, cross-mode isolation,
  invalid presentation fallback and store recreation.
- The shared mode-local picture surface passed its focused exact-mode/edition,
  historical-unavailable and opener-restoration test (1/1, no skips).
- Real Team host: a current spatial-edition attempt prepared its decoded original,
  won through legal Team input, retained exactly one Team record, exposed it in the
  Team picture dialog and restored the exact opener. Solo and Versus clears and
  pictures remained absent. One selected case passed; twelve unrelated cases were
  unselected by the test-name filter.
- Real Versus host: all nine opening-sequence missions complete across every campaign on both boards,
  compares equal authoritative checkpoints, retains an exact original for every
  completed mission, exposes only Versus originals in the mode dialog and restores
  its opener. One selected case passed; twelve unrelated cases were unselected by
  the test-name filter.

Current main already carries the later closed Team picture authority at theme
revision 77 with exact retained revisions 58–76 and a bounded twenty-policy host.
The reconciliation preserves that accepted authority; it does not replay the stale
revision-69-to-73 repair from the old stack. The combined reward, storage,
current-authority, Legacy Team and real Solo/Team host run passes 117/117 with no
skips. Both changed all-campaign Versus journeys pass; eleven unrelated cases are
unselected by the focused name filter.

A complete Versus file retains one inherited current-main fixture failure: its
unchanged controller chooser case expects 120 cards while the current catalogue
renders 198. It does not exercise the added reward assertions. Catalogue fixture
repair belongs with the compact-gallery/content inventory work, not this reward
contract.

Focused source evidence is not release acceptance. Visual review, actual reload,
Retry and Next recovery with missing bytes, physical controller/touch checks,
responsive browser checks, complete offline preparation, full PR gates and public
Pages verification remain required before this stack can ship.

## Remaining before acceptance

1. Independently review the exact combined A1/A2 diff and run applicable PR gates
   without changing the immutable picture contract.
2. Qualify the final reconciled head against any newer accepted main before release.
   Qualify real browser reload, Retry, Next, storage failure and unavailable-art
   paths for both modes.
3. Verify keyboard, controller/D-pad and touch access to the mode-local dialog at
   desktop, 1280×800, portrait and short-landscape layouts. Hardware evidence stays
   distinct from modeled input.
4. Version, freeze, deploy and publicly verify this feature only after the current
   serialized publisher lane is accepted. This draft performs none of those actions.
5. Continue UX1-B for the complete compact campaign gallery and UX2–UX6 afterward.
