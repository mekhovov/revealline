# Performance and download comparison

The final reviewed candidate fetched 6,543,851 uncompressed bytes in successful title-page HTTP responses, versus 4,034,299 bytes for the committed baseline: +2,509,552 bytes (+62.21%). The merged renderer’s sampled draw submission cost is higher, with mean 0.274–0.398 ms and p95 0.4–0.6 ms. These are bounded desktop source measurements, not a claim of unchanged cost or a complete device qualification.

## Exact source and method

Baseline: committed `fe9961e3eb18a4eb85fcf448fe1573ba1eb0e8cc` (version 0.43.0). Final candidate: `fade9ca59c8ce317df97be1254e1ab373343ed20` plus the P7 working source, Field Kit revision 13, runtime SHA256 `2fc487be53e5c14e51fa63778b8c8a953e58917dcceca430b7698c03fef20c68`. `performance-source-inputs-final.json` records exact selected input hashes. This includes the merged enemy renderer; earlier revision-9 renderer samples remain in `performance-renderer-candidate-before-r13.json` and are superseded for the final comparison.

A local server served bounded copies of each source’s selected core build inputs with `Cache-Control: no-store` and no HTTP compression. The final candidate title used a genuinely fresh isolated Chromium session, with its 1280×800 CSS viewport and DPR 1 set before the first navigation. No player control was activated before capture. All three compiled font faces were loaded when the title and requests were recorded. Baseline and final candidate used separate empty origins/profiles. Their raw server logs, rather than Resource Timing’s potentially cache-coalesced references, determine the HTTP byte totals.

This serves source inputs, not a packaged release. Generated wrappers, worker inventories and optional/external distribution downloads are excluded. Baseline made two favicon404 requests; the candidate made one favicon404 and one expected missing generated `game/build-info.json` request. Both failure bodies were 9 bytes. Every other requested game file returned 200. The source title therefore displays VERSION DEV; public release-version acceptance is recorded separately.

## Download and storage costs

| Measurement                                      |    Baseline | Final candidate |           Difference |
| ------------------------------------------------ | ----------: | --------------: | -------------------: |
| Selected core source files                       |         285 |             566 |                 +281 |
| Selected core source bytes                       | 111,009,301 |     135,779,271 |          +24,769,970 |
| Successful title HTTP requests                   |         167 |             278 |                 +111 |
| Successful title HTTP response bodies            |   4,034,299 |       6,543,851 | +2,509,552 (+62.21%) |
| All observed HTTP bodies, including the two 404s |   4,034,317 |       6,543,869 |           +2,509,552 |

The compiled presentation directory is 7,917,403 bytes including its Studio/history metadata and retained file bodies. The runtime resolves 124 unique files totaling 2,304,880 bytes; the whole compiled directory is not fetched on the title screen. The final title uses the reviewed 25,969-byte landscape image; the old 866,080-byte title fallback is no longer requested.

The title’s largest responses are existing Phaser (1,375,976 bytes), reviewed runtime metadata (974,568), the newly integrated original bouncer image (865,212), and the existing original scout image (753,111). Bouncer and scout load before compiled presentation adoption, so the small reviewed sprite does not remove those startup costs. The same font bytes also arrive under both the static CSS and compiled hash URLs; each actual response counts. No optional chapter JSON, Studio metadata, or original reveal picture was fetched during the final title capture.

Source input totals are not ZIP, offline-cache, or browser-storage totals. Only the final actual builder’s generated offline manifest and 64 MiB guard establish offline eligibility. The final release configuration adds the 11,708,176-byte indexed R5 chapter to the existing explicit optionalOffline list alongside R1–R4. All shipped bytes remain available; offline installation of that chapter is an explicit player action. `performance-release-input-delta.json` records the post-measurement input changes: `game/build-config.json` and two documentation files. No runtime or pixel input changed; these files were not requested by the measured title. The release owner’s actual generated offline inventory/64 MiB build guard and the planned public R5 install/offline journey remain required. This report does not label a source subtraction as a passing offline distribution.

The last-response times and long tasks are retained in `performance-download-final-r13.json`, but are not a comparative speed verdict: shared machine load, filesystem warmup, browser internals and the absence of network latency or hosted compression confound that claim. `performance-http-baseline.json` and `performance-http-candidate-final.json` contain the authoritative response-body logs. Earlier `performance-download-*` snapshots and `performance-review-before-r13.md` are historical observations; their Resource Timing sums are not the final network totals.

## Presentation response and decode bounds

`performance-response-bounds.json` uses the actual exported compiled-host validator, checks every resolved file’s byte count and SHA256 against disk, and applies the host’s startup selection and decoded-pixel accounting. Its recorded host hash binds that calculation to source.

- Runtime JSON: 974,568 bytes, below the 4 MiB metadata limit.
- Runtime-resolved file bodies: 124 files / 2,304,880 bytes, below the 32 MiB bundle limit; largest file 77,493 bytes, below the 4 MiB per-file limit.
- Startup presentation: 80 files / 220,905 bytes, plus runtime JSON = 1,195,473 bytes. This is the presentation loader’s cost, not the entire title download.
- Startup image decoding: 77 unique image files, no extra crop copies, 1,115,776 pixels of the 16,777,216-pixel ceiling. The simple RGBA equivalent is 4,463,104 bytes; this is not measured peak process memory.
- Lazy resolved pictures: 44 files / 2,083,975 bytes. Picture originals and uploaded audio remain governed by their existing on-demand paths; no audio file is bound in this production collection.

## Renderer measurement

`performance-harness.html` imports each source’s real BoardPainter and core. It uses authored Crosswind (48×36) and First Light R4’s first mission (72×36), seed 42, and 120 deterministic Down input ticks. It holds that running state and draws with motion enabled and `dt=FIXED_DT`. All 21 core files (187,102 bytes) are byte-identical across the selected baseline and candidate copies. The candidate adopts the actual compiled revision-13 snapshot. No player progress, saved flight or installed profile is read or written.

Each board is drawn at 384 and 1152 CSS pixels with the normal internal 16px-per-cell canvas. Each case has 120 rAF-paced warmup frames and five batches of 120 measured frames. `performance.now()` brackets BoardPainter.draw only: core stepping, startup/decode, app HUD/DOM updates, canvas readback and GPU completion are outside that interval. Each source uses its own procedural backdrop; exact selected-picture decoding is outside this comparison.

| Case               | Baseline mean / p95 ms | Merged candidate mean / p95 ms |
| ------------------ | ---------------------: | -----------------------------: |
| 48×36, 384 CSS px  |          0.270 / 0.400 |                  0.286 / 0.400 |
| 48×36, 1152 CSS px |          0.198 / 0.300 |                  0.274 / 0.400 |
| 72×36, 384 CSS px  |          0.284 / 0.400 |                  0.398 / 0.600 |
| 72×36, 1152 CSS px |          0.262 / 0.400 |                  0.375 / 0.500 |

The largest measured mean increase is about 0.114 ms. The four cases establish a small absolute draw-submission increase in this sample; they do not support the earlier claim that the merged renderer has unchanged p95 cost. rAF p95 remains 16.7–16.8 ms. Roughly 0.1 ms timer granularity, noncontemporaneous baseline sampling and concurrent qualification work limit attribution and small-effect precision. Raw 600-frame samples per case and batch summaries are retained in `performance-renderer-{baseline,candidate}.json`. Both the final title and final renderer canvas screenshots were visually inspected.

Environment: Apple M4 Pro, 14 logical CPUs, 48 GiB RAM, Chromium 153 headless via the authorized standalone agent-browser fallback, 1280×800 CSS viewport, DPR 1, visible and focused during measurement. This does not establish mobile GPU/energy cost, peak memory, physical 120 Hz performance, Safari behavior, input latency, or worst-case enemy/capture/celebration frames. Public offline functional acceptance is independently recorded under `public-v044`, `public-v045` and `public-v046`.

`performance-temp-cleanup.json` records removal of only the two task-created measurement copies after every file size and candidate SHA256/committed baseline Git blob was verified. Source authorities and all measurement evidence remain intact.

### Actual offline build budget

The initial combined-source build failed the existing 64 MiB guard. Declaring the unchanged Arcade R5 pack optional through the existing indexed-pack policy produced a passing working build: **568 core files / 65,923,013 bytes**, below **67,108,864 bytes**, with **1,185,851 bytes** remaining. All 614 distribution entries (322,899,778 bytes) remain present, including the exact 11,708,176-byte R5 original. The generated note identifies the optional packs and their online installation requirement. `offline-budget-build.json`, the full cache/manifest and before/after logs bind this result. This build had `sourceRevision: null`; the later frozen-source build remains the release authority. Couch startup and Studio preview recovery are separately checked for the newly optional dependency; no gameplay or cache limit was changed.
