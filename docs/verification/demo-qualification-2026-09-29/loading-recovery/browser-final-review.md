# Final browser observation review — qualification held

The saved report completes **7,204.141 seconds of monotonic wall-clock observation** (7,204.392 calendar seconds), but it is **not an uninterrupted-playback or release pass**. It contains an unresolved **158.0978-second apparent stall after a visible return** and an observer persistence I/O failure. Preserve both alongside the successful hidden-execution and rotation evidence.

[Raw final report](browser-observation-final.json): 3,193,397 bytes; SHA-256 `2c943ad9352dcb1022f0c9cc93bf9c1d07fcdad5d8119214a719201452a4cc1e`. [Machine-readable review](browser-final-summary.json) records the derived counts and limitations. Review source is frozen runtime `55c5ec57cc1ed478b44e065951073c0bdd3c3ead`, retained at PR checkout `279d6b67f66a7add88df66ab09e4995e7bdc775a`. The report itself binds served bytes, not a Git identifier. This review used only the saved JSON and light inspection of its matching clock source; no browser interaction, new observation, tests or runtime changes occurred.

## Unresolved visible-return anomaly

Recorded First Signal was adopted at **4386.4842 s**. Preparation at **4421.0326 s** led to live Orchard Crossing at **4422.1717 s**, while both documents were hidden. After the visibility event at **4440.9921 s**, **33 consecutive samples from 4440.9922 through 4599.0900 s** report both documents visible, neither focused, demo unpaused, and exactly the same **0% / three lives / 0s** label and scaled canvas checksum **`25e26bc5`**. This is a **158.0978-second stale span**, not an explicit Pause or missing observer callbacks.

The next visibility event makes both documents hidden at **4600.1276 s**. Progress becomes observable again: **4614.3441 s** shows Orchard Crossing at **85% / three lives / 31s**, then recorded First Signal is adopted at **4617.4492 s**, followed by live Courtyard Exits at **4654.3390 s**. All other unpaused identical-visible-checksum runs in this report span at most about 5.129 seconds.

A focused scheduling hypothesis is available, **not a proven root cause**: [`attachDemoClock.schedule()`](../../../../game/ui/demo-clock.mjs) at lines 51–68 chooses only `requestAnimationFrame` for ordinary visible wakes when that API exists. It keeps one scheduled ticket and has no pending-frame timer watchdog. If RAF delivery is starved while the document remains visible/unfocused, the ticket can wait until a visibility reset switches scheduling to a timer. The report records neither RAF delivery nor authoritative core ticks. Investigate that boundary and distinguish simulation, paint and DOM delivery before claiming a fix. The matching clock file's hash/size agrees with the final inventory.

## Duration and rotation

The observation ran from **2026-09-29 03:30:56.950 UTC** to **05:31:01.342 UTC**, finishing automatically for `requested-duration`. It retained **1,430 samples and 345 events**, below the 1,500/1,024 bounds, with no dropped records or report truncation. Wall time includes intentional Pause and the stale span above. There is **no aggregate actual simulation-tick count**; resetting, coarsely sampled per-level timer labels must not be summed into simulated duration.

DOM phase events show **163 scene visits including the initial already-running scene**: **84 recorded and 79 live**, or 162 new adoptions after observation began. No immediately repeated level occurs in that sequence. The 162 observed preparation-label intervals range from 0.4061 to 1.1984 seconds.

| Source        | Level            | Scene visits | Samples |
| ------------- | ---------------- | -----------: | ------: |
| Live autoplay | Courtyard Exits  |           41 |     319 |
| Live autoplay | Orchard Crossing |           38 |     306 |
| Recorded play | Crosswind        |           14 |     142 |
| Recorded play | First Signal     |           28 |     202 |
| Recorded play | Night Patrol     |           14 |     156 |
| Recorded play | Relay Orchard    |           28 |     288 |

Another 17 samples catch the preparation label. All 1,430 samples show an available/open spectator demo; none enters practice. All 1,413 real-level status samples show three lives. Scene visits are not proofs that each clip completed, that every seed/variant was visited, or that every transition was automatic: the observer records displayed phases, not input causality or authoritative final checkpoints.

## Actual hidden execution

Seven visibility-event intervals total **3,386.9778 seconds (56.4496 minutes)** with both documents hidden. They contain **670 hidden samples** and **80 new scene adoptions**; the other 760 samples report both documents visible.

| Hidden interval, elapsed time |   Duration | Hidden samples | New scene adoptions |
| ----------------------------- | ---------: | -------------: | ------------------: |
| 1759.2854–2045.5994 s         | 286.3140 s |             58 |                   6 |
| 2067.0066–2117.7242 s         |  50.7176 s |             11 |                   1 |
| 3560.1434–4164.3734 s         | 604.2300 s |            120 |                  15 |
| 4193.1983–4440.9921 s         | 247.7938 s |             49 |                   6 |
| 4600.1276–5069.6895 s         | 469.5619 s |             93 |                  10 |
| 5107.5928–5963.0127 s         | 855.4199 s |            168 |                  21 |
| 5995.5112–6868.4518 s         | 872.9406 s |            171 |                  21 |

Both live maps and the recorded levels progress and rotate during hidden intervals. For example, the first hidden interval shows Courtyard Exits advancing **37% / 16s → 74% / 48s**, then Orchard Crossing **0% / 0s → 51% / 29s**; recorded Relay Orchard, Crosswind, First Signal and Night Patrol subsequently reach displayed 45s, 46s, 30s and 46s before visibility returns. This establishes actual hidden execution in the observed Chromium session. It does not establish execution through an OS freeze, screen lock, process suspension or native-device lifecycle.

The observer intentionally skips all 670 hidden canvas reads (`hidden-page`). Their absent checksums do not independently prove the game performed zero painting. Most visible returns show refreshed state in subsequent samples; the fourth return has the explicit unresolved stale span above. The 760 visible checksum reads produce 604 distinct values. These are 12×8 downsampled FNV-1a32 witnesses, not video, exact screenshots, FPS or latency measurements.

## Independent pause and music intent

Music is paused in four samples between **25.3995 and 40.6005 s**, while demo playback stays unpaused, rotates from First Signal to Night Patrol, and Night Patrol advances from displayed 4s to 14s. Demo Pause then lasts between DOM events at **43.9428 and 89.5030 s**. Its nine samples keep Night Patrol at **13% / three lives / 17s**, checksum `d0e5afb7`, while music reports `playing`.

Across the full run, music reports `playing` in **1,421 samples**, `paused` in four and `loading` in five. Its title stays **Carol of the Bells (Metal Version)** throughout. None of the hidden samples shows demo Pause; hidden music states are 669 playing and one loading. These are intent/transport observations. They do not establish audible continuity, physical volume, real song boundaries or whether the same track repeated/restarted. The full report contains no practice takeover or physical-controller/native-device qualification.

## Timing, memory and observer failure

There are **zero long observer callback gaps**, zero recorded calendar discontinuities, zero child navigations and zero attachment failures. Maximum callback gap is **5.4123 s**. Regular observer callbacks do not prove regular game frames; the visible-return anomaly demonstrates that distinction.

Browser-reported used JavaScript heap starts at **138.500 MiB**, ranges from **100.509 to 538.198 MiB**, and finishes at **432.041 MiB** against a reported 4,192 MiB limit. Ten-minute medians fluctuate with visibility/allocation; the final visible tail stays around 414–444 MiB after a higher spike. This does **not** establish a stable retained-heap bound or leak freedom. There is no forced-GC baseline, attribution between game/observer allocations, total-process/Worker/GPU accounting, post-close recovery measurement, frame-pacing, battery or thermal evidence.

The report contains exactly **one captured diagnostic**: observer scope `checkpoint-storage-unavailable`, **DataError: `Failed to write blobs (IOError)`**, at **6720.5555 s / 05:22:57.506 UTC**. No game-window JS diagnostic is captured; that is not exhaustive error coverage. The observer continues for another **483.5855 seconds / 95 samples** and completes final comparisons/export. Automatic checkpoint persistence is disabled after this error. The independently retained final JSON proves export capture, **not** that the final observer IndexedDB slot committed or survives reload. The raw report does not identify the I/O error's cause; contemporaneous disk-full observations belong to separate operational evidence.

## Source/storage checks and completion flags

The initial and final inventories contain exactly the same **204 unique file records / 17,222,640 bytes**, with no changed, added or removed source hashes. These are the served roots and bounded literal dependency inventory; computed imports/media are not exhaustive, nor does fetching a file prove it executed. The page is served locally with no service-worker controller and a development placeholder build label `__REVEALLINE_VERSION__`, rather than a stamped native/distribution build.

Initial/final game-frame **localStorage** snapshots are also exactly equal: three hashed entries representing 870 value bytes, with no added/removed/changed hashes. They retain no raw keys or values. This does not inspect game IndexedDB contents, prove observer persistence, or exclude writes that restored the same final values.

The raw report correctly records `requestedDurationReached:true`, `sourceInventoryStable:true`, `observerComplete:true`, `observationValidForPinnedSources:true`, `observationComplete:true`, and terminal source/storage checks `complete`. Their code predicates are narrow: attachment failures, source equality, navigation count, elapsed duration and availability of localStorage snapshots. **They do not reject diagnostics, failed persistence, stale frames, memory growth, long gaps or truncation.** Preserve the true raw flags and interpret them alongside the anomaly and diagnostic; do not relabel the report as an error-free or uninterrupted pass. `releaseQualified` remains **false**.

## Cleanup and remaining qualification

Normal observer finalization releases its sample timer, mutation observer and scratch canvas; that is the source contract, not a measured resource inventory. It deliberately leaves the real embedded game alone, and the final sample still shows an active live demo. Subsequent closure of the owned tab and verified server is recorded in the separate [retention/cleanup receipt](browser-final-retention-cleanup.json). This browser report contains no post-close Worker/audio/resource counts or heap recovery check; the closure receipt does not turn those limits into measured results.

The two-hour **wall-duration observation is completed**. Qualification remains held for the visible-return anomaly and the separate physical audio/input/native/device, resource stability and unfamiliar-viewer gates. Any runtime correction requires evidence tied to that new source; it cannot retroactively repair this frozen run.
