# Combined browser session: before scheduler correction

Measured 19 October 2026, beginning 21:47:56 UTC. This is the preserved **before** run that exposed a scheduling defect while completing every functional assertion. It is not the final performance acceptance. The complete raw report, source hashes, shared-machine activity and browser worker targets are in [combined-browser-before.json](combined-browser-before.json).

## Outcomes

| Phase | Accepted ticks / simulated duration | Wall duration | Shots / defeats |
| --- | --- | --- | --- |
| Native aircraft, save/restore | 319 /6.38 s | 8.95 s |37 /6 |
| Regional aircraft, sustained continuous combat |36,121 /722.42 s |1,093.92 s |4,511 /678 |
| Real app remount, native aircraft |106 /2.12 s |2.81 s |12 /6 |

All functional assertions passed with zero browser or worker errors. Fifteen workers were created and terminated; the browser’s own DevTools target list contained one worker during flight and **zero** after disposal. Both renderers reported disposed state, zero registered owned geometries/materials/textures and zero shader programs; no draws continued after disposal. Both audio contexts closed, and the isolated radio profile remained unchanged. The ordinary renderer’s one internal texture counter remained while its context was lost; this is not a measurement of total GPU memory.

Four real UI saves/restores passed:

| Boundary | Export bytes | Save / restore |
| --- | --- | --- |
| Native tick 252 |328,855 |68 ms /950 ms |
| Regional tick 2,001 |3,091,937 |174 ms /4,410 ms |
| Regional tick 6,001 |5,649,305 |278 ms /7,043 ms |
| Regional tick 36,054 |5,911,435 |258 ms /6,053 ms |

Two pending proposals were deliberately rejected at pause boundaries. All other 36,546 proposals committed across the scenarios. Final regional history retained tick 27,000 through 36,121 and explicitly reported incomplete bounded history. Recovery preserved accepted actors, clocks, score, projectiles and state; restored one-shot event arrays were empty. Fire required a fresh release after each radio OFF→ON boundary.

## Defect found and correction target

The regional run produced 722.42 seconds of simulated flight over 1,093.92 wall seconds, including recovery pauses: real-time factor 0.660. Worker proposals decreased from 2,718 in minute 1 to 1,389 in minute 17. Per-minute worker roundtrip p 95 increased from 14.3 ms to 18.4 ms; frame interval p 95 was 16.7 ms early and 33.4 ms in minute 17, while draw-submission CPU p 95 stayed near 5 ms.

Static analysis found that the host discarded accumulated time beyond 20 ms while a worker was pending, then waited until the next animation frame to dispatch after completion. Crossing a display-frame boundary therefore reduced accepted physics throughput. The subsequent correction keeps five waiting intervals at most, dispatches fresh input after accepted completions, and preserves pause/flight/lifecycle ownership. It does not alter the physics time step or historical replay state. See the short follow-up report, [combined-browser-scheduler-short.json](combined-browser-scheduler-short.json); late-recording requalification is separate.

Main-thread heap per-minute low water was approximately 101–108 MB after early setup/recovery, with normal peaks around 147–200 MB. The final recovery temporarily reached 438 MB in the sampled main heap. After final disposal a separate lightweight observation was 94 MB. These are browser-main-thread observations only, including the QA report’s retained samples; worker WASM and total browser memory were not measured.
## Method

A dedicated QA origin and isolated Chromium session mounted the production World app, production World renderer, audio, real browser physics worker, calibrated radio input path and companion encounter runtime. The worker advanced the ordinary Holybro X 650 V 2 aircraft solver at 500 Hz and committed combat at 50 Hz. No physics, mission, renderer or radio-runtime stubs advanced the flight.

Only `navigator.getGamepads()` was replaced in the QA page. A synthetic transmitter supplied raw axes plus Arm and Fire through the actual profile normalization and ownership rules. The user’s browser, USB radio and saved profile were not opened or modified. The harness asserted its own saved profile remained identical.

The native phase used the shipped `snake-hunt-loops-01` geometry. The long regional phase used the verified six-cell endurance fixture and an authored clear start, not Railway Valley. Both had a geometry-admitted lane of six moving humanoid targets with 25 health and no return fire, allowing repeatable sustained hits without an automated evasive pilot. Current art, Blood/Brutal enabled, ordinary audio and a 1920×1080 viewport were used. This is a representative full application lifecycle check, not a maximum-population or hostile-balance workload.

Pauses used the app’s real pause path. Save used the actual “Save combat session” control and exported Blob; recovery used the actual file input, parser, validation, reconstruction and worker restore path. Assertions checked unchanged accepted state and clocks, no progress while paused, fresh Fire release after radio OFF→ON, and no replay of restored one-shot effects. The final recovery occurred beyond the companion and aircraft recording retention windows.

After the final flight, the harness disposed the app, checked disposed renderer resources and absence of further draws, remounted the real DOM/application, flew another native session, and disposed again. Browser DevTools targets independently checked that no QA worker target remained after disposal; owner counters alone were not treated as browser proof.

## Measurement limits

The report measures real browser animation-frame callback CPU, renderer draw submission CPU, frame/draw intervals, physics-worker round trips, per-minute main-thread JavaScript heap samples, renderer resource counters and paused save/restore latency. It does not measure total browser/process RSS, worker WASM heap, GPU execution time or physical USB scheduling. Samples and assertions add QA overhead.

This was not an exclusive performance run: short Blender art-preview work shared the machine, with its reported interval recorded in the evidence. No artificial GC was requested. Main-thread heap samples are interpreted as bounded-window observations, not proof that every subsystem is leak-free. The separate exclusive rendering benchmark remains the GPU/performance evidence. No desktop 60 FPS or mobile 30 FPS claim follows from this representative lifecycle check.
