# Foundation-use audit correction and Nearby shore route

2026-09-21. This is a test-only diagnostic correction, not a gameplay revision,
new mission, mastery award, release or P01 acceptance. Historical V1 observers,
fixtures, route inputs and simulation checkpoints remain unchanged.

## Defect and correction

A stopped craft can be exactly on a foundation edge. The old observer checked
the raw previous point when a cut began and the raw current point when it closed.
Those half-open coordinate checks can disagree with the engine's directional
ownership at a boundary. Nearby shore's Down174 → Right departure was labelled
as not leaving its island, even though the engine recorded a foundation cell.

The explicitly versioned `OpeningFoundationObservationsV2` helper reads the
engine's accepted `classic.departure` cell and the direction-biased return cell,
using the same epsilon rule as capture tracing. It requires classic
stop-on-capture behavior. A valid return contact counts as visiting its foundation;
ordinary bounds are not expanded and a tangent departure is not automatically
credited to a foundation. Unsupported missing departure ownership fails explicitly.
This code is test-only; it neither changes the engine nor grants player awards.

Replaying all 30 existing opening refinement routes preserves every checkpoint
and every V1 observation. V2 corrects labels at 33 closures across 17 routes and
changes four visited-foundation sets:

| Route                                | Old V1 visited indices | Corrected V2 indices |
| ------------------------------------ | ---------------------- | -------------------- |
| Courtyard / Expert / Grid            | 2, 3, 1                | 2, 3, 1, 0           |
| Courtyard / Expert / Immediate       | 2, 3                   | 2, 3, 1              |
| Courtyard / Standard / Immediate     | 2, 3                   | 2, 3, 1              |
| Return pocket / Standard / Immediate | 2, 0                   | 2, 0, 1              |

The earlier statement that Return pocket's recorded route uses only two
foundation pieces is superseded: it contacts three under accepted-return
semantics. The four recorded Nearby shore routes and four Second landing routes
still visit no foundation; Horizon Remix still visits only its starting piece.
These specific bypass findings survive the correction.

## Nearby shore has a useful island route

No layout or difficulty is changed. Across all three presets and both steering
policies, Down lands on the island at tick174 with a line-only capture. A fresh
Right departure earns 24.7% total coverage by tick636 Immediate /642 Grid,
without loss. This demonstrates a usable foundation return, not final balance.

One further Standard/Immediate/seed1 route takes that island, leaves from it,
and clears in 2,178 ticks (18.15 seconds), with three lives, four closures and no
inserted waits. Its exact input fixture is `shore-foundation-route.json`.
The short optimized result is not a human duration estimate, optimality proof,
or evidence that difficulty/pacing is finished. Other starts/presets, human
discoverability and the broader campaign arc still require qualification.

## Native observation and next action

The local real Solo host at `whole-spatial-v4` was launched through its flat
chooser. An ordinary Down input reached the island with 0.6% reveal, three lives
and 140 points. The craft stopped and displayed “Line secured. 0.6% revealed.
Tap a direction to fly again.” This is a first-return observation, not a native
full clear; wall-clock time includes inspection and is not pacing evidence.

The follow-up [foundation-return teaching unit](journey-foundation-return-feedback.md)
now implements a short, non-modal foundation-return explanation
using accepted ownership, with no forced briefing or new rule. The existing card
advertises the island choice, but the capture feedback does not explain why a
small reveal nevertheless established a useful permanent return. Keep this
separate from still-needed later-level geometry and threat-pressure changes.

## Verification

All 17 focused checks pass on Node 20.19.5 and 22.22.2. The suite covers six real Nearby shore preset/control departures,
eight authored side-approach cases, a negative immediate tangent, unsupported
movement rejection, the complete 30-row historical audit, and the new full-clear
replay/equal-race fixture. Independent review verifies the ownership correction
and the historical audit. This diagnostic alone does not close native/device, human or
release gates.
