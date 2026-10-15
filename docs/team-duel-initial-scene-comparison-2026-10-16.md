# Team and Duel initial-scene comparison — 16 October 2026

This continues R10 in the [acceptance register](team-duel-qualification-2026-10-15.md).
It adds a bounded native browser comparison using the same source delivery and
observer on this Mac. It does not qualify sustained play under pressure,
worst-case performance, memory ownership or an immutable release.

## Source and protocol

The development-only [pinned review helper](verification/PINNED-GAME-REVIEW.md)
serves main `b11745223861c3973ad4bf440cc536198b8e0371` and candidate
`743a43b774bf6605235833e7354414de658b22af` on separate loopback origins.
The [source binding](verification/team-duel-public/initial-scene-source-binding-2026-10-16.json)
pins both trees, the helper and the identical two candidate observer files used
on both origins. Game/asset responses are exact regular Git blobs from their
respective tree. No working-tree, generated-build, clock, state or input fallback
was used. This is unbuilt source review, with its normal development version
placeholder; it is not a packaged edition or public deployment.

The browser override is 1280 × 720 CSS pixels. Every completed embedded-game
sample reports 1280 × 561, DPR 2. Sound remains off. Each mission was selected
through the ordinary library, restarted and paused at a fresh attempt. The
observer was armed for **Next foreground play / 30 seconds**, then ordinary
keyboard navigation focused explicit Resume. The game received no movement or
ability keys during the window. Both seats stayed on reclaimed ground.

Team used **Expedition Homecoming**; Duel used **Crown Photo Finish**, exact key
`candidate/versus-expedition-sentinel-pack/versus-expedition-sentinel/versus-crown-photo-finish/standard`.
The preset URL alone was not treated as adoption. Team ran main then candidate;
Duel ran candidate then main. Other development processes were active on this
Mac. This is one pair per mode, without machine isolation or statistical repeats.

Cold source loading exceeded the observer's 30-second menu deadline. The raw
logs retain those failed load observations. An early Team arm also expired
without foreground play, and setup focus/retry observations were discarded.
They are not passing startup timings or frame samples. The accepted frame
windows begin only after native preparation and explicit Resume. No timeout,
foreground or pause guard was relaxed.

## Completed observations

| Mode | Source    |      Window | Frames |     p95 |     p99 |  Maximum |
| ---- | --------- | ----------: | -----: | ------: | ------: | -------: |
| Team | main      | 30,002.2 ms |  3,570 | 10.7 ms | 14.3 ms | 115.0 ms |
| Team | candidate | 30,002.4 ms |  3,588 | 10.2 ms | 12.1 ms | 107.8 ms |
| Duel | candidate | 30,001.5 ms |  3,562 | 11.5 ms | 13.4 ms | 161.7 ms |
| Duel | main      | 30,007.4 ms |  3,419 | 17.4 ms | 19.2 ms | 148.7 ms |

The Team pair has identical mission, requested mission, active scope, duration,
viewport, gameplay-key counters and before/after HUD values. Each starts at 0:00
and ends at 0:30, with 0.0% territory, two reserves and both abilities ready.
Neither window adds resource entries. Sampled JS heap peaks are 65,355,251 and
63,463,044 bytes, respectively. These nonstandard counters are not complete
memory measurements and do not establish a difference in retained memory.

The Team/Duel gameplay hosts and mission definitions are unchanged between these
source commits. Offline/audio runtime areas and result markup differ, but this
zero-input, sound-off protocol does not exercise their important transitions.
The small percentile differences do not establish an improvement or regression.
Enemy positions, random outcomes and Duel warning-phase timing are not fully
captured or synchronized by the observer's HUD snapshots. The immediate
post-Resume DOM observations actually differ: candidate shows **LANE WARNING ·
1.6s**, while main shows **LANE ACTIVE · 0.5s**. Thus the Duel pair is explicitly
**not warning-phase matched**. Its reported mission, viewport, key counters and
before/after HUDs match, and neither window adds resources, but equal reported
HUDs cannot establish identical engine state. Duel's sampled JS heap peaks are
124,709,326 and 131,608,475 bytes for candidate/main, with the same memory limits
of interpretation as Team.

Raw logs and paused screenshots are retained separately under
`docs/verification/team-duel-public/`, named `team-main-initial-scene-2026-10-16`,
`team-candidate-initial-scene-2026-10-16`,
`duel-candidate-initial-scene-2026-10-16` and
`duel-main-initial-scene-2026-10-16`. JSON is read directly from the
observer's log element. A later mode's raw log may retain earlier mode/setup
records; select the completed Frame sample for the exact mode and mission.
Screenshots were taken after saving the completed log and pausing, so their
visible clock is later than the measured endpoint. The paused Team screenshots
have identical bytes and are supporting UI views, not independent source proof.

The [comparison receipt](verification/team-duel-public/initial-scene-comparison-2026-10-16.json)
pins every raw log/screenshot and records the equality checks without a budget
verdict. It also pins two losslessly gzipped request logs, **1,616 response-prepared
records per origin**. Their hashes and source/tree bindings describe offered
bytes; they do not prove that the browser consumed every response. The helper
and temporary tabs were stopped, and the temporary viewport override was reset.

## Verification and remaining scope

The helper's Node wrapper passes and executes **16 real-Git Python/HTTP tests**,
with zero skips. They cover exact pins/bytes, a dirty worktree, identical observer
overlay, binary ranges, unsafe paths/hosts/service-worker requests, bounded
resources and owned-server shutdown. The unchanged observer and focused routing
cohort passes **78/78**, with zero skips. Lint, formatting and whitespace checks
pass for their scoped files. These are tool checks, not native frame results.

R10 remains partial. Sustained pressured play in both modes, a corresponding
matched activity baseline, repeated/isolation-aware comparisons, complete
decoded/GPU memory and genuine storage-pressure recovery remain unqualified.
The earlier two-minute native observations retain their own source/activity
scope. Human balance testing remains waived, and native Duel controller hardware
remains deferred for this run.
