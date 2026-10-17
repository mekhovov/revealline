# Native cold readiness outcomes — 17 October 2026

[Run 39024034519](https://github.com/mekhovov/revealline/actions/runs/39024034519) observed both declared engines against the exact [ab45 package](solo-readiness-ab45-release-20261017.md). Both **readiness correctness predicates passed**, including the pending-at-Start branch. Chromium's numerical window passed; WebKit's failed, and its job and the combined run correctly remain failed. This was one candidate observation per engine at CPU factor 1, explicitly excluded from performance qualification. It does not replace the required equivalent three-run comparisons.

The candidate is `ab45bfde5d54d612cbba9b038a46f13d13f417ec`, tree `0d8238992621613883efcf0c73a9f4d88f3fcb10`; observation tooling is `4bf5e9b3b7f2f06fbe24f50ff9457efb70a7b1a7`. Later automatic-Next and controller fixes are absent from this package. The new 112-file Appearance producer, [39024034432](https://github.com/mekhovov/revealline/actions/runs/39024034432), was still running its focused checks at the `10:18:44Z` status receipt and was left undisturbed.

## Readiness and admission

Both jobs completed full hosted outer/inner archive verification, all 3,524 distribution members, manifest validation, 1,636 runtime source comparisons, static-worker/offline closure and CSP admission before the native command. Each archive/source command closed successfully before gameplay. The retained admission proofs bind the exact previously verified producer artifact; no full distribution was downloaded locally.

| Observed boundary                                            | Chromium 151.0.7922.34   | Linux WebKit 26.5                          |
| ------------------------------------------------------------ | ------------------------ | ------------------------------------------ |
| Trusted public Start, preparation samples                    | 0/30, baseline absent    | 1/30, baseline absent                      |
| Start to first running                                       | 1,494.3 ms               | 3,114 ms                                   |
| First running simulation tick                                | 0                        | 0                                          |
| Quiet preparation completed                                  | 30/30, B ≈ 16.7 ms       | 30/30, B = 16 ms; one old sample restarted |
| Prepared/displayed/current-run/submitted-run acknowledgments | All four true            | All four true                              |
| Later paused export                                          | Same accepted B          | Same accepted B                            |
| Complete raw hitch journal                                   | 106 records, 2,544 bytes | 120 records, 2,880 bytes                   |
| Strict source-native replay                                  | Pass; state matches      | Pass; state matches                        |

The public title run was replaced by the accepted run in both cases. The first-running acknowledgment observed that accepted run at tick zero, with the prepared and submitted board identities matching. This proves the application readiness boundary; it does not prove physical display completion. Each recording retained 29 moving direction changes and exceeded the required 3,300 moving ticks (3,633 and 3,668). Both commands closed with empty survivor/ambiguity lists and no forced cleanup. No page errors, dropped readiness records or journal overflow occurred.

The unchanged strict journal and readiness readers were independently rerun on retained bytes. Only filesystem sidecar paths were relocated in memory; original reports, header values, binary records and verdicts were unchanged. Both Node portability reconstructions report mismatches, separately retained from the passing source-native browser replay authority.

## Numerical results remain separate

External B came from the original fixed foreground blank-page `settled120` calibration before navigation. The optional internal five-second startup observation wait was deliberately omitted by this pilot, so these observations are not equivalent to the ordinary cold timing cohort. First-30-second data was retained without trimming. Chromium used the declared 1280×800 viewport at DPR 1 with desktop input capabilities; WebKit used 400×850 at DPR 3 with mobile/touch capabilities, while the recipe still used keyboard controls. This is not a matched same-raster comparison between browsers.

| Measurement                            | Chromium               | Linux WebKit                               |
| -------------------------------------- | ---------------------- | ------------------------------------------ |
| Raw aggregate status                   | `pass-observed-window` | `fail`                                     |
| Exact external measured-work p95       | 6 ms; limit 10 ms      | 5 ms; limit 9.6 ms                         |
| External cadence p95 histogram bracket | (16.67, 20] ms; pass   | (33.34, 40] ms; fail                       |
| External cadence p99 histogram bracket | (16.67, 20] ms; pass   | (40, 50] ms; fail                          |
| External missed opportunities          | 0.1100%; pass          | 48.3755%; fail                             |
| Keyboard application-latency p95       | (16.67, 20] ms; pass   | (25, 33.34] ms against 32 ms; inconclusive |
| Automatic interruptions                | 0                      | 0                                          |

The work values span Phaser PRE_STEP through POST_RENDER, including synchronous render submission, and are exact nearest-rank measurements from complete callback rings; cadence and input values above are histogram intervals, not point estimates. Application latency excludes physical input and display latency. Internal WebKit cadence and missed-opportunity checks also fail. Both quality snapshots were full at briefing and pause; these endpoints do not establish a constant tier throughout play.

Chromium retained two fully active rAF intervals over 33 ms, maximum 33.4 ms, and no active interval at least 50 ms. WebKit retained 80 fully active intervals over 33 ms, including seven over 50 ms and one 171 ms interval from 89 to 260 ms after first-running. A further 155 ms interval crossed the Start boundary; a 378 ms interval crossed the explicit Pause boundary. These boundary intervals remain separate rather than being discarded or called wholly active. Neither engine recorded a measured active application-work window at least 50 ms. WebKit's native long-task API was unobserved, so the 171 ms delay cannot be assigned to browser, raster or application work from these measurements alone. Startup and paused hitches remain in the raw journals. The retained network timing list is empty, and media admission was sampled only at briefing and final pause (one active fetch, then none). Its settlement time and any correlation with the early hitch are unobserved.

Chromium's bounded setup witness reports ANGLE/SwiftShader, software compositing and software rasterization; the request settled and its session detached. WebKit correctly reports that this capability API is unsupported. These are Linux hosted observations, not evidence about iPhone 17 Pro Safari or Steam Deck OLED. Both paused exports report `protocol: "http:"` and `secureContext: true` on loopback; that does not reproduce a plaintext LAN origin or establish an iOS security-mode cause.

Both engines’ two paused exports report `willReadFrequently: false` and `desynchronized: false` for the detached board context. Chromium also reports `alpha: true`, `srgb` and `unorm8`; WebKit omits those fields. Phaser’s pixel-art canvas-pool setup establishes that context before CanvasTexture requests its usual readback hint. These observed attributes do not indicate accidental readback-oriented configuration and do not establish hardware acceleration. They describe the detached board, not the separate displayed renderer.

## Retention and next scope

All 64 artifact members were fully read back with ZIP CRC, exact API digest, member size/hash and path/type checks. Each arm retained 32 members; the original failed statuses remain unchanged.

| Evidence                      | Exact identity                                                                                           |
| ----------------------------- | -------------------------------------------------------------------------------------------------------- |
| Chromium artifact             | `12098440130`, 311,200 bytes; SHA-256 `fc9e7c98beb8b9c2013133831395aa6df5b8a883876bfd674976805e3ffeb3f7` |
| WebKit artifact               | `12097154068`, 297,553 bytes; SHA-256 `0eb36a3eb3ceac93e1cffc4807d21a77f2f605efb9de942c7dde40385093552d` |
| Chromium raw report           | 631,925 bytes; SHA-256 `42042b8652a0d18f7d455bb4ab182edb87d1e65f922015bc40c00e5eb310991e`                |
| WebKit raw report             | 469,779 bytes; SHA-256 `304241326f5c751b838004fd7c5e4ae1dc2a3bcfe3043311fcd1cd9ff58f27bd`                |
| Independent readback analysis | 100,669 bytes; SHA-256 `73b8ea8436a797abdebd8b06af4a00a34734555e6bad49bd8ed8af534e2f3d56`                |

Raw archives, members, API metadata and receipts are under `.cache/solo-followup/ab45-readiness-observations/39024034519/{12098440130,12097154068}/retained`. The analysis is `ab45-readiness-observations/readiness-terminal-analysis.json`. It includes every decoded hitch, exact input hashes, admission command ordering and the independently reproduced predicates.

The next smallest readiness scope is a declared warm/restored Resume observation with the next verified runtime package. Selected-theme readiness, cancellation and renderer recovery need their own bounded public-control observations; the cold pilot does not establish them. Repeating its successful readiness predicate would not resolve WebKit's cadence failure. That failure needs a separately declared attribution experiment, retaining the fixed B, low measured work, backend uncertainty and all early/late hitches. Historical first-eight failures and all previous numerical failures remain unchanged; no broad performance or physical-device qualification is granted here.
