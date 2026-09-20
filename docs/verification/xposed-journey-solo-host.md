# Authored opening: actual Solo host integration

Source candidate on PR172, v0.69.0. Not a deployed or human-validated phase.

## Scope

`game/?journey=opening` explicitly selects the authored ten-mission opening
catalog: three Prologue missions, six Horizon School missions, one optional
Remix. It uses the existing Solo host, renderer, engine, controls and recorder.
Ordinary entry, `journey=1`, old replay schemas and frozen releases are unchanged.

The adapter owns exact catalog entry identities. Imported flags or same IDs do
not enter this path. Candidate entries never enter Legacy's two-preset access
projection. Fresh attempts use canonical Scout, authored Horizon presentation,
the selected Gentle/Standard/Expert preset, and the global steering policy.
Resume and restore preserve the current attempt rather than apply new intent.

Next/Skip/chooser preparation verifies bytes, complete image decode and exact
dimensions, then checks retained run, recorder, picture owner, focus, storage,
library generation and difficulty revision before taking the prepared attempt.
Failed/cancelled/stale preparation retains the old flight. Candidate retry does
not manufacture managed-media pins or substitute Legacy pictures.

Core continuation stops after Long way home. The chooser exposes the Remix as
an optional choice. Completion receipts use existing candidate-source Journey IDs;
they grant no Legacy gallery, medal collection, appearance or mastery awards.
Full-picture results preserve earned coverage. Suspended attempts use
`revealline.suspended.journey-opening.v1`, independent of release-number saves.
Their campaign revision pins presentation and artwork as well as simulation.
Candidate attempts/progress have individual exports; Legacy bulk backup/import
and couch handoff are explicitly unavailable on this opt-in route for now.

## Automated verification

- Actual Solo host: 8/8 tests passed (`candidate-solo-host.test.mjs`, 57.3 s).
  All nine core missions match frozen authoritative checkpoints and produce nine
  durable Journey receipts. Tests also cover every preset, failed/stale decode,
  two-action Skip, exact suspended-attempt restoration, and Expert result Retry.
  Optional Remix remains outside automatic core continuation.
- Existing Journey host, content picture and content execution regressions:
  32/32 passed. Existing managed-picture Solo host regressions: 22/22 passed.
- Lint, formatting, content validation and whitespace checks passed. Read-only
  distribution inventory includes the adapter and all ten original pictures.

The route driver batches display frames while the actual host executes every
fixed simulation tick, sending a fresh keyboard gesture after closure. These are
deterministic host-model checks, not native performance or human-play evidence.
No capacity-intensive local full build was run; hosted packaging remains blocked
as described below.

## Native browser observations

Local mutable source at port 8778, owned tab 7; keyboard only, desktop viewport.

- Continue entered First return with three lives and a 30% goal without a menu.
- A real downwards enclosure completed at 34.3%, score 8160, three lives, 0:07;
  the result displayed the pinned coastal observatory original and truthful
  candidate-progress copy. The full picture did not change earned coverage.
- Next entered Choose your share directly at 0:00 / 0% / three lives / 65% goal.
- First Skip paused and asked to confirm; second entered Two keepers. Chooser
  showed First return Cleared and Choose your share Skipped, not cleared.
- Chooser directly entered Nearby shore. The initial island did not earn coverage;
  an actual closure onto it produced 0.6% / 140 points and the fresh-direction cue.
  The craft stopped on the island. Left paused at 0:40 / three lives.
- Another existing tab owned the Legacy writer; the visible session-only warning
  was preserved. This is not native durable-save verification.

## Acceptance still open

Whole-set native artwork/contrast, all-input play, browser/hardware performance,
all-preset native clears, player comprehension/enjoyment, cross-release public
restore/rollback, native preference-recovery validation, and paired-board/Team
host adoption remain unverified or unfinished. Core opening contains nine
missions, so ten consecutive core missions requires later campaign integration.
No human evidence is inferred from automated or agent-operated clears.

## Hosted packaging failure requiring repair

Earlier P01 source `577ebc0e` failed hosted run `35490113818`: build job
`106023729971` and shard4 job `106023729905` both hit the existing 2000-file /
64 MiB core-offline guard. The test failure is the real-source distribution
fixture in `scripts/test-external-distribution.mjs`, not a failed gameplay test.
The ten pinned opening PNGs total 25,862,573 bytes and currently enter the default
offline inventory. Required follow-up: explicitly bounded optional-artwork
delivery with tests and truthful offline capability, preserving original bytes,
full-distribution availability, and the 64 MiB guard. Do not increase the limit
or claim this local host work passed a hosted build or Pages deployment.

The source repair is implemented in the optional-artwork follow-up; see
`xposed-journey-optional-artwork.md`. Full-source hosted verification remains due.

## Difficulty recovery follow-up

Failed next-attempt preference writes now expose Retry difficulty save and Export
difficulty choice in the existing difficulty controls. Export reports a requested
download, never claims durable saving, and leaves the recovery warning present.
Failed export preserves session intent; successful Retry hides the warning.
Cross-tab updates refresh the selected next preset and cancel stale preparation,
without replacing the current run or its picture. No Legacy storage schema changes.

Actual authored-host plus preference-store cohort: 19/19 passed, including all
nine core route/checkpoint/receipt checks, failure/export/retry and cross-tab
control refresh. Native failure/recovery and downloaded-file observations remain
pending; simulated browser tests are not those observations.
