# Default Versus Journey: explain the existing Start selection

This bounded F10 slice adds one EN/UK paragraph beside the existing Versus Start
action. It explains the first mission, a deliberately selected exact mission, or
the host-selected successor to a recorded completion. A recorded completion is
not a claim about either player's present skill or the result of a match.

The existing boot owner still selects `initialJourneyMission`. Its cursor and
clear predicate are captured as read-only explanation facts, bound to the initial
accepted `roundRecipe`. The pure presentation helper verifies exact catalogue
membership and explains the supplied destination; it never invokes Next, sorts
missions, selects a different row, loads artwork, or writes progress.

Later accepted manual recipes use neutral selected wording. Live/paused matches,
pending or failed preparation, incoming exact-library handoffs/continuations,
stale cursors, unknown owners, and completed final-mission fallbacks receive no
initial recommendation. Historical/Classic/other Journey routes retain their
existing landing. Named result Next, Rematch, first-to-two, Skip, controller
input, focus, launch guards and persistence stay with their existing owners.

The paragraph shares the native landing command column with Start, adds only
its own `aria-describedby` ID, and preserves existing descriptions. Shell
teardown restores its authored location and removes only that association.
Locale refresh changes text without activating either board. The Versus host
does not own a generic saved-flight Resume; validated incoming continuation
settings and mode-return remain separate existing protocols.

Publication base: the independent Duel host-fixture prerequisite [PR #1735](https://github.com/mekhovov/revealline/pull/1735),
at `d5a346ebbb541787f27a2ccb625551ea196f5501`. Its underlying runtime is captured
main `e7465da3e4b1146b492f401fbb165a5e5a4a6202`. The feature was originally
developed above the unrelated Solo fixture prerequisite, then transposed as its
exact 11-path change onto this appropriate Duel prerequisite. Whole-tree review
at `fafc345f650733866f824713b5fb3aa8beb0ff02`, before this receipt update, confirms
the only differences from tested integration `b452f46d3651bc2855b46781640d24cf3d8640da`
are the two excluded Solo prerequisite files. All runtime, helpers and eleven
cohort files are identical. The transposition is not a new test execution.

F10 remains partial overall; Team is a separate host slice and lesson
recommendations still depend on F25/shared demos.

## Verification status

All eleven complete targeted files ran across the preserved source scopes below:
**135 passes and one pre-existing Team failure**, not an all-green cohort. No case
was skipped, filtered or given a longer case timeout. The retained Team producer
failure was also reproduced by the complete original four-case localization file
on fixture-only `d5a346ebbb541787f27a2ccb625551ea196f5501` and captured newer main
`cdbda99ac881eb9cac62d536543d9078b92ac081`.

The separate [Team repair PR #1740](https://github.com/mekhovov/revealline/pull/1740)
passed that complete file plus its new conflicting-document regression, 5/5.
That repair is not included here and does not change this feature's historical
135-pass/one-failure evidence.

| Complete file                               | Actual preserved source scope     | Result                  |
| ------------------------------------------- | --------------------------------- | ----------------------- |
| `versus-home-recommendation.test.mjs`       | 39ac frozen feature               | 5/5                     |
| `versus-home-recommendation-host.test.mjs`  | 39ac frozen feature               | 10/10                   |
| `couch-shell.test.mjs`                      | 39ac frozen feature               | 27/27                   |
| `candidate-versus-host.test.mjs`            | de336 initial fixture integration | 14/14                   |
| `versus-default-entry.test.mjs`             | b452 final fixture integration    | 10/10                   |
| `mission-library-versus-host.test.mjs`      | b452 final fixture integration    | 19/19                   |
| `versus-continuous-next-host.test.mjs`      | b452 final fixture integration    | 9/9                     |
| `mode-return-versus-host.test.mjs`          | b452 final fixture integration    | 18/18                   |
| `mode-return-versus-recovery-host.test.mjs` | b452 final fixture integration    | 17/17                   |
| `localization-couch-host.test.mjs`          | b452 final fixture integration    | 3 pass / 1 Team failure |
| `couch-start-cue-host.test.mjs`             | b452 final fixture integration    | 3/3                     |

39ac is source manifest `39acaa9deccf42c6b1700e255936700a0cd37412a38d67edf97ec36baa74707d`,
preserved by feature commit `27bfa1374531627fa0dad099fc824f84e19abc54`.
The other actual run heads are `de336294392af5fec7602a19e676ece1a7afcb3e` and
`b452f46d3651bc2855b46781640d24cf3d8640da`. These are individual complete-file
receipts, not a claim that all files were rerun at one publication commit.

The final seven files used fresh serialized Node 22 processes, 1,536 MiB V8
old-space, a 2,048 MiB process-group RSS guard and a 2 GiB free-disk floor.
The wall guard was 180 seconds per file, except the complete Mission Library
file's approved 300 seconds. That file passed in 153.119 seconds wall time at
1,892.5 MiB sampled peak RSS. No final-seven guard triggered; before/after
20-path source audits remained identical. Their raw result was 79 passes and
one Team failure. Changed source lint, formatting and whitespace checks pass.

### Preserved failed attempts and fixture corrections

The first frozen candidate's pure file passed **5/5**. Its complete new host file
ended with a file-level **0/1**, signal `SIGKILL`, after 120,495.591 ms, without an
individual case result. The cause is unknown; this is not an OOM or assertion
diagnosis. The historical host fixture is preserved as Git blob
`a65c3589ea7c4e918111a3c9d8e5a6b24fce412a` at
`refs/codex/evidence/f10-versus-host-da78-failed`.

Static review found an unnecessary second full default Journey construction in
the fixture, retained only to obtain its profile key. The corrected fixture pins
the exact independently reviewed v25 edition/profile metadata and checks actual
host profile writes. The real game still constructs and compiles the original
complete default Journey. No runtime, assertions, timeouts or catalogue are
replaced; bounded per-case phase/RSS diagnostics aid further diagnosis.

That corrected host attempt was also **incomplete**: an approved protective
`SIGTERM` stopped its validated worker at roughly 12.5 GiB RSS after 120,922.488
ms. Its 64d0 source manifest stayed unchanged, and no individual case result was
available. This protective stop does not establish the earlier kill's cause.
The corrected historical host and component fixtures remain preserved at
`refs/codex/evidence/f10-versus-64d0-host` and `...-shell`.

Read-only DOM review found no ancestor/self insertion in the new paragraph's
placement or restoration. Fixture identity checks now compare the same exact
references as Boolean predicates, preventing an assertion diagnostic from
serializing a complete DOM graph. The actual visible lobby Missions action is
`race-chapters`; its returned owner promise and exact Back focus are observed.
Neither change establishes that diagnostic formatting caused either old run.

The complete `couch-shell` file then passed **27/27**, with no guard trigger,
at 1,599.9 MiB peak process-group RSS. The complete actual default-host file
produced **9/10 passing cases** at 1,388.0 MiB peak RSS, with no guard trigger.
Its one assertion incorrectly expected a ready landing after a real mission
card's Play action. The published Versus owner explicitly starts that exact
mission and returns success only while its accepted match is running.

The corrected fixture asserts both accepted boards are running the exact
`first-return` mission, the explanation is absent, and the original Start
handler remains. It then exercises actual Pause and Resume with the same
checkpoint. It no longer issues an extra Start while already running. Neutral
ready-selection copy remains covered by real first-to-two setup preparation.
The obsolete visible-after-Play assertions were replaced, not retained verbatim.
Production, helpers, timeouts and the complete catalogue are unchanged.

The original adjacent candidate file produced 9/14 because five strict captions
still expected retired Versus wording. The next default-entry attempt produced
7/10 because it targeted obsolete copy, a hidden library action and a retired
header child. The independent PR #1735 preserves those failures and repairs
the exact native actions, metadata-only inventories and finite image-header
contracts. Its first Mission Library extension attempt was 14/19, before the
reviewed decoder/caption corrections. These failed scopes remain historical;
the later complete-file results above do not erase them. Node image-header
fixtures verify ownership and dimensions, not actual browser pixel decoding.

New native cases cover real initial/manual selection, visible description and
unchanged Start/Resume handlers, EN/UK focus/checkpoints, a legally earned clear
followed by re-entry, stale progress, exact incoming continuation, cancelled
original-picture preparation, first-to-two continuation and historical routes.
Adjacent files retain their ownership, stale-operation, checkpoint and focus
assertions; the independent fixture PR documents each changed obsolete expectation.

Root browser review of the actual 39ac feature covered desktop EN/UK landing
explanations, Settings Back focus, a real First return card's direct launch
with no Home explanation, and Pause/Resume priority with retained visible board
values (0% / 3 lives / 0 points). Exact checkpoint preservation is automated.
This browser review does not qualify a compact layout or physical device.

Layout/focus review at 320 portrait and 568/844 landscape, both text faces and
keyboard/controller/pads, full repository validation and newer-main admission
remain pending. No physical iPhone/PWA offline or Steam Deck hardware was
available. Modeled host tests cannot qualify those environments. Keep the PR draft.
