# Actor batch 7 — effective gameplay and combined threat information

Parent: `11f93235066439cbf6aa3a62a90a7796c31bbc16` on draft PR761.
This source checkpoint is not an immutable release or public acceptance.

## Finding and correction

The playable art benchmark resolved the current authored Standard mission but
omitted the ordinary host's fresh-attempt gameplay tuning. Its earlier tick 414
First Return win, pursuit impact at 555 and interception capture at 322 describe
**untuned authored levels**. Preserve the earlier evidence; do not present it as
ordinary Standard play or public balance qualification.

The benchmark now applies `resolveGameplayTuning('standard')` and
`applyGameplayTuning` exactly once, with no preference reads or admin overrides.
Retry uses the owned prepared level, even if the caller's manifest later changes.
The authored mission, original artwork and actor pin remain separate from the
exposed effective runtime revision and level identity. That local level identity
is not a cryptographic pin or full run identity.

Three ordinary source attempts match the benchmark at initial state, 240 fixed
ticks each and Retry. Original image bytes are verified through the ordinary
source preparation path; its browser decode is modeled in the parity test.
The native browser separately loads and plays the prepared scene.

| Effective Standard case | Warning | Committed | Capture/cancel |         Extended-cut loss |
| ----------------------- | ------: | --------: | -------------: | ------------------------: |
| Return in Reserve       |     121 |       211 |  267; 11 cells | 365, carrier trail impact |
| Crossed Bands           |     289 |       379 |   413; 8 cells | 466, carrier trail impact |

Tests drive real fixed-tick controls; they do not set player positions, enemy
phases or outcomes. Both routes retain their locked targets through turns.
Warning lasts 90 actor ticks, commitment is bounded by its route/deadline and
cooldown lasts 300 actor ticks. A travelling impact can remain dangerous during
carrier cooldown. Capture clears its live trail; staying still afterward does
not make other enemies harmless. Pause and alternate frame partitions preserve
the same event/checkpoint sequence. These paired routes show possible counterplay,
not human readability, fairness or six-player pilot results.

## Player-facing correction

Field details previously chose the explicit trail-impact carrier description
before pressure state, hiding pursuit/interception and its phase for actors with
both abilities. It now composes both roles and both explanations. The regression
uses validated v2 imported content with an explicit carrier ID, actual tuning and
real core transitions.

The current benchmark missions use global v1 impacts, whose existing view does
not mark an explicit carrier. Their pressure guidance remains unchanged. Live
impact warnings remain visible during cooldown. Standalone carrier and standalone
pressure output are preserved. English/Ukrainian checks cover existing role and
ability strings; inherited English phase/time text is not newly localized here.
Reconciliation must keep main's newer `flightDetails.pressure*` and
`secondsRemaining` localization.

## Browser observations

- A fresh local origin with `Cache-Control: no-store` shows
  `gameplay-pressure.v4` and effective First Return identity `35d454f8678d8162`.
- Actual keyboard Start/down completes First Return at tick 469, 3.90 seconds,
  816 cells, 8,160 points and three lives. Terminal loading copy is empty and
  Retry has focus.
- The 600 ms Retry cue is observed at tick zero. A promptly entered fresh down
  command completes at tick 472, 3.93 seconds; setup, artwork and actor pin match.
  The small difference is observed command timing, not different tuning.
- A separate retry left idle before steering eventually lost a life and recovered.
  Its retained setup/artwork/actor identities match too; it is not a successful
  fast-Retry route or a fairness conclusion.
- The requested 1280×800 override reports **1280×757 CSS** in this browser.
  Steering targets measure 52×48 CSS pixels and fit. Record actual dimensions;
  this first observation does not establish the requested 1280×800 or physical handheld acceptance. The final fresh-source reload subsequently reports and captures **1280×800**, with the same tick 469 win.

The first attempt on the reused origin exposed mixed cached modules: the new
host omitted `setup` because the old session module had no such field, and it
still won at tick 414. `stale-browser-module-observation.json` preserves that
rejected observation. Accepted native evidence uses the fresh origin. Slow
loading also exposed a misleading long-frame pause status; the host now changes
that message only when actual play or the ready cue was interrupted, with a
regression through its real handlers.

## Gates, limitations and integration

See `evidence.json` and the retained TAP/text files for final counts and hashes.
The initial four benchmark failures are old raw-speed expectations exposed by
applying correct tuning; their corrected tests preserve concrete outcomes and add
ordinary source parity and positive/negative counterplay.

No simulation, authored mission, artwork, release pin or production record changes
in this checkpoint. Existing Team production-adoption requirements remain open.
Full automated suites remain waived, not passed. Integrated build, source/provenance
admission, immutable publication and public bytes/play belong to the canonical
publisher. Hardware, audio listening, human sessions, whole-content performance
and offline qualification remain separate work.

The existing Details controller host fixture initially failed on this older
branch: it tried another Confirm after 90 ms neutral while the existing gate
requires 120 ms, and it reset the sampled clock backwards. Untouched baseline
reproduced the failure. Both exact fixture corrections already exist on main
`7138e7b6`; they are now carried here unchanged. The complete mounted Details
host file plus the new combined-pressure file passes **20/20**, retaining all
navigation, held-Back and no-resume assertions. Baseline failure and temporary
neutral-only diagnostic logs are retained, not counted as passes. The benchmark
cohort passes **65/65** including source parity; the additional **39/39** related
model/source checks overlap the new Details checks and must not be summed as
unique coverage.

The first keyboard screenshot is **1211×757 raster pixels**, separate from its
1280×757 CSS measurement. `final-source-keyboard-win.jpg` and its JSON both
record **1280×800** after the final reload. No physical controller or touch
hardware was used. The initial browser wait exceeded the inspection connection
deadline during decoding; a subsequent fresh accessibility snapshot confirmed
Ready before keyboard activation. This was not treated as a successful wait.
