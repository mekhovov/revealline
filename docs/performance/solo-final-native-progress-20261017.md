# Final-package native qualification: retained progress

This is a partial result, not completion of the performance plan. The observed
game package is exactly `a6eacee2f09f06f9ffa76fe8cd5d674aff0475a4`; the hosted
tooling is `c41a02216c0811952232a387fd1743e09452c269`. Each required archive and its
source/CSP checks are admitted before the native scenarios. Historical failures
remain failures. The snapshot below was reviewed on 17 October 2026 while
sibling jobs were still running or queued.

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
