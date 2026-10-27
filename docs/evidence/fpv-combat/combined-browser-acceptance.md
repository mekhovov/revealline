# Combined browser combat acceptance

This report complements the preserved [before run](combined-browser-before.md), the [in-process full sessions](full-session-acceptance.md), and the separate exclusive renderer benchmark. It measures the actual World app, renderer, worker transport, radio normalization, UI recovery and lifecycle together. It does not combine separate timing figures into an FPS claim.

## Scheduler correction

The sustained browser run exposed an application scheduling defect: pending worker requests truncated elapsed-time debt to one 20 ms interval, and an accepted result then waited for another display frame before dispatching. A worker response crossing a frame boundary could therefore reduce accepted simulation throughput even while draw submission stayed stable.

The host now pumps a bounded queue after both display frames and accepted worker completion. At most five waiting intervals are retained for asynchronous work; each dispatch samples fresh controls and allows one pending transaction. Fixed physics intervals and historical simulation/replay state remain unchanged. Paused, replaced, hidden, unfocused, rejected and stale proposals cannot restart the pump. A completion after a focus stall pauses the flight. Ordinary synchronous/replay elapsed-time handling remains intact.

The complete host suite passed **136/136**, without skips, in 52.35 seconds against the final pinned build. The selected scheduler cases passed **10/10**, with 91 unrelated tests intentionally skipped, in 3.02 seconds. They cover bounded dispatch between animation frames, fresh radio sampling, one pending transaction, no extra draws, rejected results, pause ownership, hidden/unfocused/stalled pages, replacement ownership and a synchronous visible 200 ms frame gap. See [host log](world-ui-regressions.txt) and [scheduler log](world-scheduler-regressions.txt).

A short actual-browser follow-up completed native, regional and disposal/remount phases with zero errors, 12 workers created and terminated, and all UI recovery assertions passing. Its regional phase accepted 3,068 ticks in 73.34 seconds including two recovery operations. The short report's initial viewport was 1280×633; its draw timing is not a matched-resolution comparison with the 1920×1080 before run. Its evidence is in [the short report](combined-browser-scheduler-short.json).

## Final late-recording browser case

Passed on the final frozen sources, starting 19 October 2026 at 22:40:14 UTC. The actual app loaded a **5,512,164-byte** recovery through its normal file input and validated/restored accepted tick **36,017** in **5.37 seconds**. This recovery had already exceeded both recording windows. The resumed flight used the production browser worker and real calibrated radio path; the test pilot continued hovering and shooting through accepted tick **39,082**.

| Measurement | Result |
| --- | --- |
| Additional accepted flight | 3,065 ticks / 61.30 simulated seconds |
| Phase wall time, including pauses and final UI recovery | 70.12 seconds |
| First full wall minute | 2,961 worker proposals, approximately 49.35 Hz including arming |
| Worker roundtrip p95, first minute / tail | 6.4 / 6.5 ms |
| Frame interval p95, first minute / tail | 16.8 / 16.8 ms |
| Draw submission CPU p95, first minute / tail | 3.3 / 3.4 ms |
| UI save at tick 39,017 | 6,339,133 bytes, 265 ms |
| UI restore of that save | 6,276 ms |
| Final companion history | ticks 30,000–39,082, explicitly incomplete |

The first full minute approaches the intended 50 Hz accepted rate despite beginning at a mature retained-history state. This verifies the scheduler correction at the late state where the preserved before run had degraded. The nominal rate is not a promise of every interval meeting 20 ms: the report includes a 55.7 ms maximum worker roundtrip and pauses/recovery hitches. The new bounded queue is covered independently by rejection, focus and ownership regression tests.

Final counters were 4,883 shots and 732 defeats (380 shots and 60 defeats added after the imported recovery). Eight worker owners were created and terminated, one proposal was deliberately rejected at pause, and there were zero browser or worker errors. The browser's independent DevTools target list showed one worker during flight and **zero** after disposal. The renderer and audio context were disposed, no further draws occurred, and no encounter controls remained mounted.

The measured viewport was 1920×1080 at DPR 1, with a 1916×1076 active canvas. No other agent ran a heavy workload during this final case. Main-thread heap samples ranged 108–268 MB in the first minute and peaked 371 MB during the recovery tail. These include the app and QA sample/report objects; they do not measure worker WASM or prove zero allocation growth. Registered owned geometry/material/texture counts and shader program counts were zero after disposal; the context was lost while Three's internal texture counter remained 1, so no zero-GPU-memory claim is made.

Exact source/harness hashes, per-window measurements, complete state counters and independent worker-target evidence are preserved in [combined-browser-late.json](combined-browser-late.json).

## Final streamed boundary and return case

Passed on the same final frozen sources, starting 22:43:16 UTC. The Standard regional backend uses no physics worker. The real app, renderer, radio path and streamed verified terrain were active at 1920×1080, DPR 1, with a 1916×1076 canvas.

The pilot left the encounter at flight tick **714**, x=104,006 mm. It selected the real **Return to encounter** action, crossed the 128 m terrain-cell boundary, reached x=150,231 mm and flew back. All companion actors, projectiles, health, score and cooldowns remained identical at encounter tick 714 during outside travel, and Fire produced no outside progress. Returning paused the flight at tick **3,320**, x=103,987 mm, with **three recenters**. There were 26 total fixture terrain requests across initial preparation, flight and recovery.

The real save control exported 21,025 bytes, and the real file input restored the accepted boundary in **350 ms**, preserving the recenter count and companion state. After a fresh Arm/Fire ownership boundary the test advanced 15 more flight/encounter ticks, paused and disposed. Total phase wall time was 68.69 seconds; frame interval p95 was 16.7 ms and draw submission CPU p95 was 0.5 ms. Main-thread sampled heap was 86–113 MB. There were zero browser errors, zero worker targets, closed audio, disposed renderer resources, no remaining encounter controls and no post-disposal draws.

An excluded first attempt used the host's default authored presentation heading rather than the reference pilot's zero heading and therefore headed toward a different terrain edge. The final QA fixture explicitly selects heading 0; no production code changed. The raw successful report and source/harness hashes are in [combined-browser-boundary.json](combined-browser-boundary.json).

## Scope

The automated radio is isolated to the QA origin and passes raw axes, Arm and Fire through production calibration and ownership rules. The user's USB radio and profile are not opened or changed. Human Fire operation before and after pause was separately confirmed by the user.

The long flight and late recovery use a verified six-cell regional endurance fixture with a controlled six-target moving lane and Current art. It is not Railway Valley and is not a maximum-hostile-difficulty balance test. Actual Railway geometry admission and the realistic-art rendering stress remain separate evidence. Browser heap observations refer only to the main thread, including QA reports; worker WASM memory and whole-browser RSS are not measured. No mobile or every-level extended-duration qualification is implied.

## Interpretation and remaining gates

The original prolonged combined run, the short corrected native/regional/remount run, and the final late-state/boundary cases together cover full-browser transport, real UI recovery, mature recording state, accepted input ownership, streamed cell transitions and observed cleanup. The final scheduler was requalified with the short and mature-state cases; a new uninterrupted twelve-minute run after that correction was not repeated. The preserved before timings remain separate and include concurrent Blender work.

The final cases ran Current art with a controlled six-target workload. They do not establish worst-case full-game 60 FPS desktop or 30 FPS mobile behavior. The exclusive realistic-art renderer benchmark and full roster visual checks remain separate evidence. Extended physical USB-radio usability, total browser/process/worker memory, all-map long sessions and mobile remain limits of these automated checks. Password-form acceptance is excluded by the documented isolated QA bootstrap; the user's ordinary local app and credentials were untouched.
