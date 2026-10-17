# Final-package native qualification: retained progress

This is a partial result, not completion of the performance plan. The observed
game package is exactly `a6eacee2f09f06f9ffa76fe8cd5d674aff0475a4`; the hosted
tooling is `c41a02216c0811952232a387fd1743e09452c269`. Each required archive and its
source/CSP checks are admitted before the native scenarios. Historical failures
remain failures. The snapshot below was reviewed on 17 October 2026 while
sibling jobs were still running or queued.

## Latest review and remaining implementation

The earlier snapshot below is preserved. The four timing cohorts are now complete:
48 declared arms produced 46 native reports; two stopped at external CPU
calibration. All 23 observed candidate timing rows fail their unchanged gates.
Twenty-one match their native replay checkpoints, but five Sentry recordings
lack the required projectile mechanics. Eight starts retain incomplete internal
cadence calibration. Thirteen candidate foreground intervals of at least 100 ms
are retained, all in the first 30 seconds, including interruptions well after the
first frame. The complete analysis and binary journals remain in
`.cache/solo-followup/final-wave-v2/timing-results/`; the summary identity is
3,903 bytes, SHA-256 `b41644b0a4f4b3148a574816bfd7c8d0efd7718539b53c2d9fc09d8af173b359`.

The separate [Long Rail CPU diagnostic](https://github.com/mekhovov/revealline/actions/runs/39017369089)
completed the route and strict native replay but did not reproduce the 384 ms
pause. Its profile records 799 samples in feedback-panel geometry reads and
8,180 samples in Phaser's final sprite `drawImage`, versus 136 under the board
painter's layer compositing. These sample counts identify investigation targets;
they are not per-frame durations. The profile and navigation clocks lack an
exact bridge, and one negative sampling delta is retained. This diagnostic
contributes no timing-pass credit.

The feedback-panel change in `e0da148d6` uses ResizeObserver's delivered border
box instead of remeasuring on every text/style mutation. It coalesces writes,
keeps a legacy fallback and releases observers when the panel closes. Six
focused controls and scoped lint pass. Native layout/performance qualification
of this new source remains pending. The selected-theme owner also now exposes
bounded readiness; public Start/Resume integration is being checked alongside
the cadence fix. A reproduced delayed-font case previously accepted a new theme
while the run was already active. It does not establish the cause of the 384 ms
pause. Optional page presentation loading is under a separate resource-owner audit.

The [offline successor](https://github.com/mekhovov/revealline/actions/runs/39017369019)
passes installed-game capture and Next, strict native replays, exact 47-key
worker snapshots and owner closure with the origin stopped. Independent local
readback covers 48 selected evidence members (663,741 transported bytes), not
the complete archive or saved browser profile. This is scoped offline correctness.
The [native lifecycle successor](https://github.com/mekhovov/revealline/actions/runs/39017369090)
reaches trusted hidden/paused tick 25, then its observer loses a cleared paint
reference. The partial native replay matches the initial hidden checkpoint;
return and Resume are unobserved. An observer correction must preserve strict
run identity and later visible-submission/replay binding before any new credit.

All three Chromium recovery repetitions and the first WebKit repetition pass
29 actions and strict native replay. The WebKit artifact is `12094978498`,
313,820 bytes, SHA-256
`8e34de95e453817577027ab0e63e26f98be2a0eca7e58b16015831031219465e`;
all 32 members were read back. Context loss/blur remain injected, viewport
resizing is native, and these are not real GPU-loss or physical-background tests.

The completed six-row recovery cohort is **five passes and one failure**.
WebKit repetition 3 also passes. Repetition 2 completes all 29 actions and
matches strict native replay, but retains one uncaught page error with an empty
message during the earlier public `follow` action into `/game/playground/`.
It remains failed; neither the responsible function nor a recovery defect is
established. The final two archives (`12096071327`, 322,806 bytes and
`12096136278`, 313,955 bytes) and all their members were read back. The complete
WebKit analysis is 5,269 bytes, SHA-256
`5dc38e344ea9dda9021c7818ec48031bfde1bfb8575278da40a792ff14dfaeaa`.
Future error investigation should retain bounded error name/stack and navigation
context without filtering empty errors or changing the unchanged no-error gate.

A further touch-path audit found a geometry read on every stick/swipe activation,
although those modes derive their anchor from the contact coordinates. Commit
`366e1aa37` removes that unused read, preserving D-pad centre measurement and
all gesture/cancellation rules. The complete steering file passes 26/26; scoped
lint and formatting pass. Earlier native touch latency failures are unchanged.

The journal-overhead comparison is also complete in both engines. WebKit's
20 original reports and ten binary journals were independently rehashed, with
every analyzer field matching the hosted result. Nineteen public scenarios and
native replays pass; the first enabled arm pauses after only 562 ms, with a
243 ms application-work p95 from two samples. This is a retained failed partial
arm, not an overhead estimate. No pair meets the unchanged admission criteria,
and normal-precision timer uncertainty leaves the 5% overhead gate unresolved.
The WebKit artifact is `12096156782`, 1,314,499 bytes, SHA-256
`af096780fa5d039d4ee2f4f1ff61e6f6c3151198bdfad17fb75ab959bbc4f686`;
all 121 members were read back. Independent analysis: 10,363 bytes, SHA-256
`ac329a6771ddc3ec5b26a767e919299cff06a060eb104401da6c817560c69bcd`.

Research supports the narrow layout fix: the [Resize Observer specification](https://www.w3.org/TR/resize-observer/)
delivers border-box dimensions after layout, including padding/borders; Google's
[layout-thrashing example](https://web.dev/articles/avoid-large-complex-layouts-and-layout-thrashing)
shows why geometry reads after style changes can force additional layout.
The rail uses horizontal writing, so its block size is its reserved height.
Selected font readiness should use the existing owner's selective requests, as
specified by [CSS Font Loading](https://www.w3.org/TR/css-font-loading/), rather
than wait for unrelated fonts in the entire document.

The renderer audit checks the installed Phaser 4.2.1 source as well as its
[current CanvasRenderer documentation](https://docs.phaser.io/api-documentation/class/renderer-canvas-canvasrenderer).
The displayed canvas already requests an opaque context with
`willReadFrequently: false`, and pixel-art smoothing is disabled. The large
profile sample population in the final `drawImage` therefore does not justify
blindly toggling those settings. Keep final canvas submission in measured
application work, compare its native cost after the preparation/layout fixes,
and preserve artwork dimensions, camera fades and input callback cadence.

## What the current results establish

| Area               | Retained observation                                                                                                                                                                                                                                                 | Remaining limit                                                                                                                                                                                              |
| ------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Earned raster      | [Run 39015298715](https://github.com/mekhovov/revealline/actions/runs/39015298715): all 21 strict cases pass in each of Chromium and WebKit. All 84 PNG hashes were read back, with representative concealment, capture, erosion and warning images inspected.       | Source-core rendering with probe artwork; repair/recapture remains unobserved on this route. This does not resolve the historical macOS first-draw discrepancy or qualify physical artwork/display behavior. |
| Audio              | [Run 39015298553](https://github.com/mekhovov/revealline/actions/runs/39015298553): both baseline and candidate pass the Chromium music and recorded-speech arms, including encoded identity, natural soundtrack transition, strict native replay and owner closure. | WebKit results remain pending. These correctness observations do not establish listening quality, timing or iPhone behavior.                                                                                 |
| Recovery           | [Run 39015298634](https://github.com/mekhovov/revealline/actions/runs/39015298634): the first Chromium observation passes all 29 actions, explicit Resume and strict native replay.                                                                                  | Five planned repetitions remain pending at this snapshot. Context loss and blur are injected; resize is native. Real GPU failure and operating-system suspension remain separate.                            |
| Worker attribution | [Run 39015298633](https://github.com/mekhovov/revealline/actions/runs/39015298633): all six fixed worker/idle windows stay running and close their owners.                                                                                                           | A retained 202 ms gap starts 199 ms before the first worker request. No cause is assigned. The earlier first-eight worker pause remains unresolved.                                                          |
| Touch              | [Run 39015298647](https://github.com/mekhovov/revealline/actions/runs/39015298647): both D-pad jobs pass package verification, then fail on missing `xdpyinfo` before any native observation. Remaining jobs were cancelled before starting.                         | All twelve planned observations are unobserved. A separate setup-only successor explicitly installs and verifies `x11-utils` before archive acquisition.                                                     |
| Native background  | [Run 39015298892](https://github.com/mekhovov/revealline/actions/runs/39015298892): package/source checks pass, then the same display utility is missing.                                                                                                            | No native lifecycle observation. A separate setup-only successor preserves the real hidden-window, unchanged-checkpoint and explicit Resume requirements.                                                    |
| Offline            | [Run 39015298590](https://github.com/mekhovov/revealline/actions/runs/39015298590): evidence retention encounters a duplicate exclusive-copy destination before acquisition or browser launch.                                                                       | No installed-game observation. The successor retains both exact tool identities through the existing fixed-evidence copies and verifies them before launch.                                                  |
| macOS inventory    | [Run 39015298580](https://github.com/mekhovov/revealline/actions/runs/39015298580): the read-only diagnostic reproduces permission denial for full process information.                                                                                              | No media observation. A same-user-only process list cannot prove absence of unowned descendants, so production ownership checks stay strict.                                                                 |

The current timing jobs demonstrate a large reduction in measured game work,
but the numerical gates still fail. These are individual observations, not a
three-run aggregate or a device prediction:

| Fixed scenario                                           | Candidate work p95 | Baseline work p95 | Candidate missed opportunities |
| -------------------------------------------------------- | -----------------: | ----------------: | -----------------------------: |
| Cold Chromium, repetition 1, calibrated factor 3.13      |             8.8 ms |           28.1 ms |                         1.096% |
| Warm WebKit, repetition 2                                |               4 ms |             12 ms |                         15.06% |
| Long Rail Chromium, repetition 2, calibrated factor 2.26 |            12.7 ms |           33.6 ms |                          2.11% |

The p95 values are nearest-rank points from the complete independent work
sample rings, rather than histogram upper bounds. The six native rows above
complete their scenarios and strict same-engine replays. Their independently verified binary hitch journals retain every
observed record. Candidate cold, warm and Long Rail observations retain 3, 1
and 2 foreground running-to-running intervals of at least 50 ms, respectively;
none reaches 100 ms in those three observations. Cold also records a 54.3 ms
application-work window. Raw failed verdicts are unchanged.

A different Long Rail Chromium observation, repetition 1 at calibrated factor
4.19, pauses automatically about 2.55 seconds into active play. It retains a
416.7 ms running-to-running callback interval and an overlapping 384 ms native
long task during the recipe's initial eight-second neutral wait. No retained
application-work window reaches 50 ms before the pause, so those measurements
do not explain the long task. A task can contain both callback and other work;
the responsible stack is still unknown. Long Rail WebKit repetition 2 also
pauses on an initial 577 ms active interval. Preserve the partial scenarios,
timeouts and checkpoints rather than treating successful partial replay as
completion.

The first three-pair compact analysis is retained at
`.cache/solo-followup/final-wave-v2/timing-results/analysis-080535.json`,
76,174 bytes, SHA-256
`a580eb4dfc4f3b47541b781b7751ffe8da1aead15a86b7a610306f100e12e75c`.
Later completed jobs and analyses extend that evidence without overwriting it.
The first recovery analysis is retained at
`.cache/solo-followup/final-wave-v2/root-retention/recovery-chromium-r1-analysis.json`,
3,288 bytes, SHA-256
`45a4a773dfd18c07c744dd574b354c6588cd834b1d74a7d07e69ca9c39d174c4`.

### Completed Long Rail cohort

[Run 39015298582](https://github.com/mekhovov/revealline/actions/runs/39015298582)
has now finished all six jobs and twelve baseline/candidate observations.
All six artifacts have complete ZIP/member readback; all command owners close
without forced cleanup, ambiguous identities or survivors. All numerical
performance verdicts remain failed.

Chromium candidate repetitions 2 and 3 complete with work p95 12.7 and 12.9 ms,
against baseline 33.6 and 36.1 ms, at calibrated factors 2.26 and 2.30. Repetition
1 retains the partial overload pause described above. WebKit candidate
repetitions 1 and 3 complete with work p95 6 and 3 ms but miss 53.96% and 47.59%
of callback opportunities; repetition 2 retains the initial 577 ms pause.
The baseline WebKit repetition 1 replay matches its recording, but the required
closure is absent, so the mechanic gate fails. Repetition 2 retains a blank
page-error entry. Neither failure is erased by a candidate improvement or by
the completed-cohort status.

The terminal compact receipt is
`.cache/solo-followup/final-wave-v2/timing-results/longrail-terminal-compact.json`,
60,848 bytes, SHA-256
`bb56a3449f756a1d79df07dd91e8ff108da086eedf5740d6ab8085aa30cde131`.

### Three completed Chromium recovery repetitions

All three declared Chromium repetitions now pass all 29 actions and strict
same-engine replay, with no page errors, failed responses or unclosed owners.
The scope remains synthetic Canvas loss/blur handlers, native resize and explicit
Resume; real GPU loss and operating-system backgrounding are separate checks.
All three small archives and replay exports were independently read back. The
combined receipt is
`.cache/solo-followup/final-wave-v2/root-retention/recovery-chromium-complete-analysis.json`,
127,042 bytes, SHA-256
`1b537709c1f32c21857ffaf5ccff9409d4ce6dac43ac7a35694ff83bf809f2ab`.
The three WebKit observations remain outstanding at this checkpoint.

## Application diagnostics overhead

The Chromium arm of [run 39015298491](https://github.com/mekhovov/revealline/actions/runs/39015298491)
retains all twenty observations and all owners close normally. Nine of ten
matched pairs meet the comparison prerequisites; the last enabled arm renders
at reduced quality while its partner stays full. The complete comparison is
therefore unresolved, and the invalid pair remains in the original inventory.
The nine admissible pairs have a geometric mean difference of +1.26%; the
conservative interval accounting for the observed 0.1 ms timer step spans
−7.51% to +10.87%. This does not establish the unchanged 5% overhead gate, even
without the workload mismatch.

The complete 92-member archive was independently read back: artifact
`12094697863`, 867,024 bytes, SHA-256
`ff585a3df75db03cdfecf29a9c74778b65a600c8155d84f1ba8479691218b731`.
A local reanalysis verifies all twenty raw report identities and reproduces
every computed field of the hosted result exactly. The compact analysis is
`.cache/solo-followup/final-wave-v2/root-retention/app-diagnostics-chromium-analysis.json`,
26,377 bytes, SHA-256
`c114b91540cfc488b265076cd65f62d0a8288c7adf81078daa194a23401dc7a1`.
The separate journal-hook comparison has a narrower scope and cannot be used
to pass this application-diagnostics gate. Neither comparison qualifies the
complete external observer's overhead.

### Completed WebKit application-diagnostics arm

All twenty WebKit arms of the same run are retained, with clean command closure.
The comparison remains unresolved with zero admissible matched pairs. The first
enabled arm automatically pauses after 912 ms of observed active play; the other
nineteen complete their requested active workloads. Those nineteen already
show reduced decoration at the first active quality sample, including disabled
arms. This does not establish that diagnostics caused the reduction. The
observed timer step is 1 ms, and neither the quality prerequisites nor the
unchanged 5% overhead gate is established.

Artifact `12094923018` is 698,682 bytes, SHA-256
`d64bb1181fdcf2e4d384f95dd605658b486a8e4eb565ce83e1966c67d0664eef`;
all 92 members pass complete readback. The independent twenty-report reanalysis
matches every hosted computed field. Its receipt is
`.cache/solo-followup/final-wave-v2/root-retention/app-diagnostics-webkit-reanalysis.json`,
10,931 bytes, SHA-256
`4c5dc656e9f9b5058b88461e07de829f623382a2759016b640e4fb405082d2a5`.

### Separate journal-hook cost

The Chromium arm of [run 39015298574](https://github.com/mekhovov/revealline/actions/runs/39015298574)
completes all twenty scenarios and same-engine native replays, with all owners
closed normally. All ten binary journals are complete and independently read
back. Its overhead verdict remains unresolved: none of the ten pairs meets
all unchanged raw-performance comparison prerequisites, and the conservative
endpoint uncertainty cannot resolve a 5% difference. Observed work p95 is
approximately 2.9–3.3 ms; the observed 0.1 ms timer step and counted endpoints
produce uncertainty up to 1.2 ms. This cannot establish the overhead of either
the application diagnostics or the complete external observer.

Artifact `12095192232` is 1,749,576 bytes, SHA-256
`d03b93206a2bc63d8db46dd8a73d25d46d56f0913b1a6df5f79de0cac00420d8`.
All 122 members have complete readback. Local reanalysis of all twenty verified
reports and ten journals reproduces every hosted computed field; the receipt is
`.cache/solo-followup/final-wave-v2/root-retention/journal-cost-chromium-reanalysis.json`,
10,016 bytes, SHA-256
`cbcdd5bf744f689b08aca85fcdb33ab67f8221cbaa1478cc20ddb395b7be525c`.

## Updated order of work and research conclusions

1. Finish the already declared repetitions, sustained play, repeated Next/Retry,
   large-profile and overhead observations. Retain complete, failed and partial
   results separately. No automatic retry and no acceptance-threshold change.
2. Correct the demonstrated setup failures in separate declarations, preserving
   the original failed reports. Keep the existing process, memory, time and
   output limits and strict replay requirements.
3. Profile the exact Long Rail Start/neutral-wait workload in one separate,
   excluded CPU-sampling observation. Use the observed stress factor as a fixed
   diagnostic input, explicitly not a calibration of the new host. Keep the
   original timing failure. Only change runtime behavior after attributable
   evidence and a meaningful regression are available.
4. Inspect preparation cadence readiness separately. Fast Start can leave the
   internal 30-sample calibration incomplete; the application then uses its
   existing 60 Hz decorative-policy fallback. The simulation still uses actual
   scene timestamps. Do not recalibrate using loaded gameplay or claim this
   explains the observed pauses.
5. Keep physical iPhone 17 Pro Safari and Steam Deck OLED qualification open,
   including sustained heat, power-saving state, selected refresh rate, Safari
   tab/PWA and real background/foreground transitions.

Chrome's [Performance reference](https://developer.chrome.com/docs/devtools/performance/reference)
separates JavaScript samples, frame presentation, raster and GPU activity. Its
CPU throttling is relative to the host and cannot reproduce a phone's processor
architecture. Thus a short game callback does not prove a frame met its display
deadline, and hosted CPU stress is not a device pass.

Chrome's [Long Animation Frames explanation](https://developer.chrome.com/docs/web-platform/long-animation-frames)
shows why several tasks can collectively delay a rendering update. Its 50 ms
threshold cannot replace ordinary missed-frame measurement. The retained
interval journal remains necessary even where native long-task attribution is
unavailable.

WebKit's [Timelines documentation](https://webkit.org/web-inspector/timelines-tab/)
warns that recording additional timelines affects the inspected page. Keep
CPU, layout, canvas and screenshot investigations separate from low-overhead
qualification. A trace helps identify the responsible work; it does not itself
demonstrate that an optimization meets the timing gate.

## Additional device-context and scheduling review

The [WebKit iOS 27 report](https://bugs.webkit.org/show_bug.cgi?id=324968)
provides a concrete new qualification condition. Its reporter compares local
HTTP and HTTPS on the same phone; maintainers confirm that Enhanced Security
intentionally hardens plaintext HTTP navigation. Record the scheme and
`isSecureContext` with every physical observation. Prefer a published HTTPS
origin or a locally trusted HTTPS development origin. This is not evidence that
this game encountered that policy, and no browser security setting is changed.

WebKit's [animation-rate explainer](https://webkit.github.io/explainers/animation-frame-rate/)
also explains why high-refresh hardware does not establish the cadence made
available to web content. It is a proposal, not a shipped API guarantee. Keep
the measured quiet-preparation cadence, native callbacks and power-state
recording; do not infer 120 Hz solely from the iPhone model or 90 Hz solely from
the Deck OLED display.

Google's [long-task guide](https://web.dev/articles/optimize-long-tasks)
shows that splitting functions alone does not create separate browser tasks.
If the targeted profile identifies a remaining preparation loop, use bounded
chunks or the existing worker owner. Feature-detect any task-yield API and keep
a compatible fallback; do not introduce yielding into the authoritative
simulation or assume a microtask creates a render opportunity. Any such change
still needs measured attribution and unchanged replay outcomes.
