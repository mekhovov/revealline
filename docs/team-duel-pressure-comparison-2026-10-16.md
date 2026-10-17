# Team and Duel pressure observations — 16 October 2026

Eight native 30-second observations complete the bounded repeated comparison
in C2 of the [reviewed plan](team-duel-plan-continuation-2026-10-16.md).
Both seats receive ordinary movement controls and bank territory. Workloads are
comparable, not identical: candidate Team enters rescue/recovery, and Duel's
warning rows vary. These results establish no improvement, regression, all-mission
budget, worst-case performance or complete memory/storage acceptance.

## Source and normal preparation

The baseline is exact main `2169552a0571b9d62bce116054f1e21aabd10fa1`;
the candidate is `85b2fd4f4b11e828947317400528d1e9bbd48f45`.
Both use the same two development observer files from `85b2`. The selected
regular Git files were materialized on separate loopback origins, 63765 and
63766, without compiled-runtime, Studio, audio-observer or approval overlays.
These are normal unbuilt source defaults with the development version placeholder,
not an installed release or public deployment.

The [source comparison](verification/team-duel-pressure-2026-10-16/source-comparison.json)
finds no differences in the Team simulation, shared core or authoring trees.
Independent review also finds identical host, input, mission, enemy, encounter,
preference and tuning implementations. The changed production paths concern
offline delivery, audio and the Duel result control placement. This excludes a
direct gameplay source change as an explanation for recovery; it does not exclude
indirect scheduling effects or establish an identical runtime trajectory.

Initial source inventories contain 2,183 files: 240,006,969 baseline bytes and
240,011,384 candidate bytes. Before Duel measurement, ordinary setup exposed two
missing files in the baseline's selected preview: `retro-craft.png` and
`horizon-r1/first-return.png`. Their exact respective Git originals were added to
both previews. The [extension receipt](verification/team-duel-pressure-2026-10-16/duel-extension.json.gz)
retains all original Team pins unchanged. Final inventories contain 2,185 files:
242,851,071 baseline bytes and 242,855,486 candidate bytes. The
[postflight](verification/team-duel-pressure-2026-10-16/postflight.json) verifies
the complete selected file sets, original lengths, SHA-256 and Git blob IDs after
all measurements and owned-server shutdown. This is offered-byte verification,
not proof that the browser consumed every offered member or full-site admission.

On this Mac, every embedded sample reports 1280 × 561 CSS pixels, DPR 2,
Chrome 155 and fourteen logical hardware threads. Other processes were active;
the machine was not isolated. Team uses **Expedition Homecoming**, Gentle/full,
four reserves and a 72% goal. Duel uses **Crown Photo Finish**, Gentle, single
untimed match, Immediate turns, five lives and a 70% goal. Its logical request
resolves to the exact `/gentle` mission; normal advanced setup stages the
`/gentle/encounter-authored` selection. All samples stay in their initial
mission/encounter stage; no complete finale or relay-clear claim follows.

Sound was set off, FPV actors selected and running-enemy art left off through
normal settings. The retained [settings snapshots](verification/team-duel-pressure-2026-10-16/pressure-native-settings.json.gz)
independently record the repeated Team pair and all four Duel selections. They
do not exhaustively fingerprint sound, enemy preferences or the first Team pair.
Screenshots support the visible presentation; that limitation remains explicit.

The correct `duel-expedition-v1` URL alone initially opened Harbor Gambit.
Selecting Crown through normal settings requires waiting for its asynchronous
picture/theme adoption before leaving setup. An early exit cancelled staging and
preserved Harbor; this was caught before arming a frame sample. Retry and normal
selection completed preparation after the missing preview originals were supplied.
Intermittent UI-tool inspection timeouts also occurred during setup; a subsequent
fresh visible-state read established adoption before measuring. No readiness,
foreground, pause or mission guard was widened.

## Actual input protocol

Both sources receive the same target direction sequence through native keyboard
holds. Within a 10,050 ms block, fresh gestures start at target offsets
0, 1,450, 2,400, 4,000, 4,950, 6,550, 7,500 and 9,100 ms. Three blocks run;
the final hold ends at 31,500 ms. P1 uses down, left, up, right, up, right, down,
left. Team P2 uses up, left, down, right, down, right, up, left; Duel P2 uses
the same directions as P1. Normal key release does not stop continuous heading;
banking and recovery clear it, requiring another gesture.

The [native input receipt](verification/team-duel-pressure-2026-10-16/pressure-native-inputs.json.gz)
retains actual gesture times and holds, not just requested offsets. Every
completed frame window records **48 trusted keydowns, 24 per seat, zero
untrusted keys**, sixty activity snapshots and seven heap snapshots. No engine
state, clock, event or game input API was injected. Actual gesture-start lateness
reaches 52 ms in Team and 150 ms in Duel; runners finish in 31.509–31.540 seconds.
The observer windows last 30.001–30.011 seconds. There is no common per-key
observer timestamp, so exact input-to-sample alignment is not inferred.

Execution order is baseline Team 1, candidate Team 1, baseline Team 2, candidate
Team 2, then the same order for Duel. This is two pairs per mode, without
randomized order or statistical population coverage. Cold unlock/settings loads
time out and remain in the raw records and two separate discarded-load receipts;
they are not passing startup timings. Accepted frame windows start only after
ordinary ready-state preparation and explicit foreground play.

## Results and workload differences

The [comparison receipt](verification/team-duel-pressure-2026-10-16/comparison.json)
retains exact endpoint HUDs, phases, counters, input timing and sampled memory.

| Sample           | Frames |     p95 |     p99 |     Maximum | >33 ms / >50 ms |
| ---------------- | -----: | ------: | ------: | ----------: | --------------: |
| Baseline Team 1  |  3,601 | 10.5 ms | 11.9 ms |     14.8 ms |           0 / 0 |
| Candidate Team 1 |  3,600 | 10.5 ms | 10.9 ms |     18.6 ms |           0 / 0 |
| Baseline Team 2  |  3,600 | 10.3 ms | 10.8 ms |     16.7 ms |           0 / 0 |
| Candidate Team 2 |  3,594 | 10.6 ms | 11.3 ms | **69.2 ms** |       **1 / 1** |
| Baseline Duel 1  |  3,558 | 12.3 ms | 18.6 ms |     50.0 ms |           1 / 0 |
| Candidate Duel 1 |  3,545 | 13.1 ms | 19.4 ms |     44.8 ms |           2 / 0 |
| Baseline Duel 2  |  3,547 | 12.4 ms | 19.0 ms | **51.0 ms** |       **2 / 1** |
| Candidate Duel 2 |  3,565 | 11.3 ms | 19.0 ms |     46.3 ms |           1 / 0 |

Team starts at 0.0% and ends at 35.1%, 35.7%, 36.0% and 36.6%, respectively,
at 0:30 with four reserves. Both candidate runs include P1 **Rescue · 1s**
around 9.6 seconds and four **Recovery shield** snapshots around 10.1–11.6
seconds. Baselines contain neither label. Unchanged reserves do not mean no
knockdown. This difference is retained as observed variation without assigning
its cause. Counts of **Line exposed** snapshots, out of sixty, are:

| Team sample |  P1 |  P2 |
| ----------- | --: | --: |
| Baseline 1  |  31 |  27 |
| Candidate 1 |  37 |  27 |
| Baseline 2  |  31 |  28 |
| Candidate 2 |  37 |  23 |

These counts distinguish exposed/reclaimed/recovery work; they are not exact
durations. No result or ability use occurs in these windows, so those loads
remain outside the sample.

Every Duel seat has the same phase snapshot counts: **delay 9, warning 19,
active 4, rest 28**. Cards remain shown, available and untruncated. All start at
Shield relays / 2.0s, 0/2 relays, and end at Lane warning / 0.6–0.7s, still 0/2.
Warning row instructions differ during the samples; matching phase counts do
not establish identical hazard geometry. Both seats remain running with five
lives and bank 9.7–9.9%, except baseline repeat P2, which banks 12.2%.
The running label does not itself identify exposed-line time. Actual trusted
controls, banked territory and visible scenes establish activity, not continuous
maximum-pressure cutting or equivalent trajectories.

All windows report zero new resource entries, zero observed long tasks and zero
omitted long-task entries. This does not negate the recorded frame gaps. Frame
intervals include browser scheduling and observer work; they are not CPU render
times. Sampled heap counters can include shared heaps, miss peaks and reflect
garbage collection. Neither them nor visible image/canvas pixel estimates
establish decoded/GPU memory, allocation ownership, a leak or storage recovery.

## Retention and completion boundary

Raw observer logs, native input/settings and discarded loads are retained as
lossless `.json.gz`; JSON was not reformatted. Eight JPEGs retain native pixels
without editing. They were taken after the input runner and completed sample,
so visible coverage/phase may be later than the JSON endpoint; the first
baseline Team screenshot was later still. They are supporting scene views.
Four exact source inventories and both full HTTP logs are also losslessly
compressed. [Original-byte pins](verification/team-duel-pressure-2026-10-16/original-byte-pins.json)
verify decompression against pre-compression lengths/hashes;
[artifact pins](verification/team-duel-pressure-2026-10-16/artifact-pins.json)
cover every retained directory member except that manifest itself.

The baseline HTTP log retains 2,409 responses: 859 with status 200, 1,546
not-modified responses and four 404s (favicon plus the three preview-art
preparation requests). Candidate retains 2,320: 860 with status 200, 1,459 not-modified
and its favicon 404. No failed preparation is removed. Postflight confirms the
final selected sources and closed owned ports; owned tabs are closed and the
temporary browser visibility restored.

C2's bounded observation and repeated comparison work is complete. A strictly
identical-workload benchmark, all-family/worst-case budgets, decoded/GPU memory,
genuine storage pressure, corrected public journeys and acoustic/other-device
acceptance remain separate open acceptance work. The measured candidate is
`85b2`, not a later documentation head, frozen artifact or approved production
candidate. Human balance playtesting remains waived and Duel hardware deferred.
