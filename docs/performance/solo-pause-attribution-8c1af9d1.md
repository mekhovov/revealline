# Pause attribution and qualification hold — 8c1af9d1

The excluded Chromium profile captured synchronous Pause/save work, but the run **did not qualify**. Observation finished; browser shutdown did not. The unchanged outer deadline ended with an owned Chrome process surviving bounded cleanup, so final native replay verification never ran. No save optimization follows from this evidence alone.

The served artifact was `8c1af9d191224893bad9012f7638940a869d6096`, Chromium `155.0.8059.85`, with the existing first-30-seconds public recipe, fixed CPU throttle `3.48`, and 1,000 µs CPU sampling. This is main-thread diagnostic evidence, not a performance gate, WebKit attribution, or a physical-device, GPU, or power result. Known pending metadata I/O and profiler overhead also exclude timing qualification.

The observation report completed at **20:20:09.688 UTC** on 2026-10-16 with `scenarioStatus=pass`, no recorded page error, and a public 9,024-byte replay export. The report is saved before browser closure and strict replay processing. Its partial success therefore does not establish a final replay or overall scenario qualification. The outer runner exited 1 at **20:27:38.920796 UTC**, reporting `Owned browser descendants survived bounded cleanup`.

The profile contains 30,429 samples over 37.970 seconds. Five late sampled `pause` call-tree paths have these inclusive weights:

| Sampled ancestor        | Relative sample range (seconds) | Samples | Inclusive weight (ms) |
| ----------------------- | ------------------------------: | ------: | --------------------: |
| Direct public click     |             36.907899–36.959184 |      48 |                51.257 |
| `openHome`              |             37.106605–37.131632 |      22 |                26.413 |
| Forwarded public clicks |             37.275431–37.305329 |      23 |                31.579 |
| `openWorkshop`          |             37.668591–37.695732 |      22 |                27.401 |
| Public click            |             37.853603–37.884864 |      25 |                32.604 |

There is also one earlier 1.692 ms sampled `pause` path at relative 3.813234 seconds. These are call-tree sampling weights, not exact invocation counts or measured function durations. Each CDP time delta is assigned to its sampled node; inclusive weights include descendant samples and overlap.

Within the first late path, `persistAttempt` carries **30.774 ms**, including **27.699 ms** under `snapshotAttempt`; these values must not be added. `controller-reading.refresh` has 15.244 ms of sampled leaf weight in that path. Snapshot construction, replay canonicalization, durable save/readback, and UI work are represented. Later Pause paths include the Home/Workshop navigation used by the public replay-export flow. They must not all be attributed to the first Pause click.

The public Pause action ran from 20:20:08.512 to 20:20:08.634 UTC; export ran from 20:20:08.691 to 20:20:09.617 UTC. No exact shared ISO/CDP/performance-clock anchor was installed. The sample ranges cannot establish the cause or duration of a particular WebKit frame gap. An already-paused flag alone is insufficient to skip persistence because settings, pins, and ownership can change.

Stable partial outputs, the failed outer receipt, plans, and used inputs were copied to a separate local SSD directory with complete hash/readback and source-unchanged checks: **57 files, 3,147,443 bytes**, completed at 20:29:24.343629 UTC. Scratch and original outputs were retained. This is failed-run preservation, not successful cleanup or current external durability.

At the process-only snapshot at **20:36:33.232348 UTC**, Chrome PID 91198 remained present after the original bounded signals. Fresh crashpad PID 91200 had ambiguous ownership and was not killed. Earlier owned metadata helpers 79719 and 80510 remained in OS I/O wait. No further share calls or browser launches are admitted by this report.

The immutable v16 matrix contains 57 commands / 76 observations. Its first four stages closed **39 original commands**, retaining all failures; one separately approved first30 contamination replacement also closed. Remaining work is:

| Work                                          | Original commands still unexecuted |
| --------------------------------------------- | ---------------------------------: |
| Real 30-minute soak                           |                                  1 |
| Eleven earned wins / ten Next activations     |                                  6 |
| Audio identity, twenty-Retry memory, recovery |                                  8 |
| Diagnostics overhead (20 paired observations) |                                  1 |
| Optional WebKit audio                         |                                  2 |
| **Original remaining**                        |   **18 (16 required, 2 optional)** |

Two prospectively approved Demo contamination replacements are also unexecuted: **20 remaining online commands / 39 observations** including those replacements. The separately prepared eight local-authority stage07 correctness copies have not run and provide no original-row credit. All native work is held on unresolved ownership; clean online timing additionally remains held on pending I/O and unavailable live archive authority. The original matrix, numerical gates, failures, and earlier source labels remain unchanged. Offline correctness remains failed/unresolved, and there is no full-plan pass.

Exact input, analysis, preservation, process-snapshot, matrix, and remaining-job hashes are recorded in [the companion receipt](solo-pause-attribution-8c1af9d1.json). The complete analysis is retained at `.cache/solo-followup/pause-attribution-8c1-local-prospective-01/pause-attribution-analysis-01.json`; stable raw copies are under `.cache/solo-followup/local-ssd-diagnostic-evidence-8c1-01/pause-attempt01-failed-closure/`.
