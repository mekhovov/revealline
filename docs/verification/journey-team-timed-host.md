# Team timed studies: live-seed keyboard qualification

This P02/P14 follow-up qualifies the three existing timed-bonus greyboxes in the
actual imported Team host. It does not add missions, retune enemies, change the
host seed, produce final artwork, enroll a public campaign or complete either
phase. Human balance and coordinated publication remain open.

## The gap and correction

The live host starts new attempts at seed 17. Earlier recorded collection routes
primarily use seed 1 or seed 2. Those engine routes were not proof that the same
button sequence would collect the same anchor in the live host.

`game/test/fixtures/team-timed-host-routes.json` now references the nine existing
`alternate-taking` logs in `team-timed-qualification.json`, using seed 17 and an
explicit 30-tick (0.25-second) idle start. All nine direct-core routes clear with
no knockdowns in four seat/joint-cut configurations: 36 cases. Each collector
touches the actual item while the partner is cutting; both pilots return at
least twice. Engine checkpoints are pinned exactly. These are not no-wait or
arbitrary-start guarantees.

Nine unadapted seed 1-taking logs are retained at seed 17/delay 0 as negative
controls: six first-knockdowns, one exhausted Coolant/Standard route, and two
Depot Standard/Expert attempts rejected for artificial neutral braking. None
collects the intended bonus. These are route failures, not proof that the maps
are impossible. No historical log, checkpoint or failure has been rewritten.

## Actual host observations

Tests import each exact compiled preset pack, activate Start with the keyboard,
and use WASD/arrows through the production input, command batching, engine,
presentation and HUD. The finite DOM/Canvas controls frame delivery; there is no
runtime-state injection, seed override, grant or artificial stop.

Repeated direction values in a recorded segment are held intent. The keyboard
driver sends a new gesture only when that intent changes. Re-tapping after a
capture would deliberately rearm the production controller and is a different
transcript. The first RAF establishes the timestamp; 30 following frames supply
the explicitly recorded idle start.

Host measurements are separate from direct-core hashes. The production host
owns a release tick after closure. Window/Expert therefore finishes at 75.2%,
not the raw engine route's 75.6%; no exact host-replay identity is claimed.
An effect's first visible tick is not its contact event's tick: Depot's speed
appears in the HUD on 515. Tests pin the actual effect onset and simultaneously
check the named collector's caption and the other pilot's `Line exposed` status,
plus announcement, availability,
unchanged reserves, final coverage, victory and no navigation away.

Table ticks are driven 120 Hz fixed-frame counts, not read-back engine ticks or
native wall-clock latency measurements.

| Mission          | Gentle: finish ticks / coverage | Standard    | Expert      | First effect tick  |
| ---------------- | ------------------------------- | ----------- | ----------- | ------------------ |
| Window exchange  | 2634 /74.7%                     | 3126 /76.1% | 2286 /75.2% | 418, shared slow   |
| Coolant crossing | 5721 /77.4%                     | 3996 /76.6% | 3918 /76.6% | 562, shared freeze |
| Depot dash       | 3549 /80.5%                     | 3479 /82.0% | 2325 /86.0% | 515, Pilot 2 speed |

Depot/Standard needs one explicit keyboard-only adjustment: the seventh segment
continues down for 6 frames instead of 5, allowing arrival on the permanent return
platform before turning. The original keyboard transcript remains a tenth host
regression case: it collects speed but is still running at 25.6% after 3478 ticks.
The adjusted transcript clears at 3479. This changes a test recording, not player
physics or the map. The original direct-core 36-case evidence remains unchanged.

Unchanged reserves and a victory HUD alone do not prove zero knockdown events:
Team can rescue through capture. The no-knockdown claim belongs to the direct-core
event evidence; host claims are the listed observable collection/clear results.

## Verification and remaining gates

The new file has 56 checks: one inventory/metadata guard, 36 exact engine cases,
nine negative controls, nine keyboard clears and one retained keyboard exhaustion.
The combined nine-file cohort passes 331/331 on both Node 20.19.5 and Node 22.22.2,
with zero failures, skips or cancellations; both processes exit 0. Durations are
87,102.684 ms and 65,708.511 ms respectively. These are test-run durations, not game
performance metrics. After review added a collector-caption assertion, the
56-check file passes again on both runtimes: 56 passed, zero failures/skips/
cancellations and exit 0 each, in 76,028.346 ms and 60,223.446 ms respectively.

The cohort comprises `team-timed-host`, `team-timed-candidates`,
`team-timed-qualification`, `team-timed-integration`, `team-reserve-routes`,
`team-relocation-routes`, `coop-timed-bonuses`, `coop-input-policy` and
`content-team-export`, all under `game/test/` with `.test.mjs` suffixes. Run with
`node --import ./.cache/read-source-git.mjs --test` and those nine explicit paths.
The read-only sparse-worktree shim supplies only missing historical tracked
resources; it does not replace present production modules or runtime state.

Independent review covers input translation, singular reserve text, exact
seat/joint inventory, the explicit return-frame adjustment and evidence
boundaries. The reviewer independently passes all 46 non-host checks on both
runtimes and reviews the completed full-host logs. Formatting, ESLint and
`git diff --check` also pass.

This closes the authored-map/live-host collection gap, not full P02/P14 acceptance.
The optimized two-pilot routes range from 19.05 to 47.675 seconds; the faster paths,
different preset route choices and single-frame Depot timing are reasons for
human pacing and tolerance review, not evidence of the right difficulty curve.
Remaining work includes bonus-optional live-host clears, missed-window relocation
across presets, mastery usefulness, two-human cooperation, physical controllers,
touch/compact screens, original art, final enrollment, release and public checks.
The prior seed/timing failures and all earlier qualification limitations remain.
