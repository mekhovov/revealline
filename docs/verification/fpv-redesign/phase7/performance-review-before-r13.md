# Performance and download comparison

> Interim revision-9 record. Final quality-adopted source bytes are pending. The initial Resource Timing totals below include cache-coalesced references and must not be treated as final network totals; the final comparison uses actual HTTP response-body logging. Renderer samples remain bound to the explicitly identified snapshot.

The measured redesign adds 2,257,124 uncompressed response-body bytes to a fresh source title visit (+55.95%). The four sampled BoardPainter cases have unchanged p95 CPU draw submission times (0.3–0.4 ms). This is a bounded source comparison, not a complete device-performance or hosted-download qualification.

## Exact scope

Baseline: committed `fe9961e3eb18a4eb85fcf448fe1573ba1eb0e8cc`, version 0.43.0. Candidate: P6 HEAD `3d39907498cabd7491cdf643a5a7de64318f990f` plus the P7 working changes captured in `performance-source-inputs.json`. Its compiled collection is Field Kit revision 9; runtime SHA256 `56db0a7a9a1763dbe3459fe016d53b40c1abbb6fdf56eb093e90c3d0afa62b55`. A later quality-successor compile or source change requires a refreshed final byte inventory. These copies do not relabel an immutable release.

The measurement server serves bounded copies of each source's selected core build inputs on two separate localhost origins, with `Cache-Control: no-store` and no compression. It does not serve optional external pack bodies, generated service workers, generated wrappers, or a built release. Both game title visits used one new isolated agent-browser session with empty storage for each origin; no visible controls were activated before collection. Resource Timing's buffer was raised to 3,000 entries before navigation. Missing `favicon.ico` is the single 404 on each source origin; all game requests succeeded. Full raw request evidence is retained in the two `performance-download-*.json` files.

## Bytes

| Measurement                                                        |    Baseline | Candidate snapshot |            Difference |
| ------------------------------------------------------------------ | ----------: | -----------------: | --------------------: |
| Core build input files                                             |         285 |                546 |                  +261 |
| Core build input bytes                                             | 111,009,301 |        122,166,325 | +11,157,024 (+10.05%) |
| Those inputs excluding configured optionalOffline packs            |  52,810,500 |         63,967,524 |           +11,157,024 |
| Fresh title HTTP response-body bytes                               |   4,034,308 |          6,291,432 |  +2,257,124 (+55.95%) |
| Fresh title HTTP requests, including favicon404                    |         168 |                272 |                  +104 |
| Resource Timing transfer bytes including estimated header overhead |   4,084,708 |          6,373,032 |            +2,288,324 |

Source input totals are exact selected file sizes, not an archive size or the final offline inventory: generated files and external/optional distribution bodies are outside this calculation. Candidate selected inputs excluding configured optionalOffline packs are 61.00 MiB, leaving about 3.00 MiB before the builder's 64 MiB offline ceiling; the final built inventory remains the authoritative budget check.

The compiled presentation directory accounts for 6,764,643 bytes of the source snapshot. The largest new title requests are the CSS fallback title image (866,080 bytes) and runtime metadata (799,160 bytes). The existing original scout image (753,111 bytes) is requested by both versions before compiled overrides become available. The existing Phaser file remains 1,375,976 bytes. These are identified costs, not assumed defects or claims that the whole collection is fetched by the title screen. No optional chapter JSON, Studio metadata, or picture original was requested during the fresh title observation.

The localhost last-response timings and long-task observations are retained in raw evidence but are not a comparative loading-speed verdict: execution order, machine load, filesystem warmup, browser internals, and the absence of hosted compression/network latency confound that interpretation.

## Renderer method and results

The supplied `performance-harness.html` imports the real BoardPainter and core from the selected origin. It uses two authored levels (Crosswind 48×36 and First Light R4's first 72×36 board), seed42, and 120 deterministic Down input ticks. It then holds the same running state and draws with motion enabled and `dt=FIXED_DT`. Core modules are byte-identical between the two sources. The candidate loads and adopts its actual compiled snapshot; the baseline uses its existing art. No player profile, progress, saved flight, unlock, or installation is read or written.

Each geometry is drawn at 384 and 1152 CSS pixels, with the normal internal 16px-per-cell canvas. Each case has 120 rAF-paced warmup frames followed by five batches of120 measured frames. `performance.now()` brackets only `BoardPainter.draw`. Canvas readback, core stepping, asset decoding, startup, and the application's HUD/DOM update are outside the timed interval. rAF scheduling intervals are recorded separately; no GPU completion assertion is made. Each source uses its own procedural scene and player presentation; exact selected reveal-file decode is excluded from this like-for-like measurement.

| Case               | Baseline mean / p95 ms | Candidate mean / p95 ms |
| ------------------ | ---------------------: | ----------------------: |
| 48×36, 384 CSS px  |          0.270 / 0.400 |           0.243 / 0.400 |
| 48×36, 1152 CSS px |          0.198 / 0.300 |           0.209 / 0.300 |
| 72×36, 384 CSS px  |          0.284 / 0.400 |           0.295 / 0.400 |
| 72×36, 1152 CSS px |          0.262 / 0.400 |           0.261 / 0.400 |

The mean differences are −0.027 to +0.011ms; no meaningful draw CPU regression is established by this sample at the browser's roughly0.1ms timer granularity. rAF p95 was16.7–16.8ms in every case. Raw samples and per-batch summaries are retained in `performance-renderer-{baseline,candidate}.json`; the candidate harness canvas was visually inspected in `performance-candidate.png`.

Environment: Apple M4 Pro,14 logical CPUs,48GiB RAM, Chromium153 headless through the authorized standalone agent-browser fallback;1280×800 CSS viewport, DPR1, document visible and focused during measurement. Other repository qualification work shared the machine. This does not establish mobile GPU cost, energy use, memory pressure, physical120Hz behavior, Safari performance, or worst-case enemy/capture/celebration frames. The unchanged p95 does not cancel the measured startup-byte increase.
