# Native diagnostic outcomes at tooling 8161953

Observed 17 October 2026 UTC; read back 18 October local time. All archives remain ZIP-only under `.cache/solo-followup/native-8161953/`. No rerun, input bound, gameplay rule, numerical gate or historical verdict changed.

Tooling is `8161953a10b9c37e603d78f236e277da380e57ad` (tree `3cc69ce4de5367590e9bd11e4eeed38ddd510d9a`). Next and first-eight use actual package `39774cce8697d412d138ef4da11ac547a5f8e535` (tree `cac2369a26cac5282e4260c638b934540d17ced6`); font uses exact e1cc package. These observations do not qualify the later Restart, Demo, controller or renderer-recovery changes in tooling's runtime tree.

## First-eight correctness

[Run 39073210270](https://github.com/mekhovov/revealline/actions/runs/39073210270) succeeded. Independent execution of the exact `functionalResult` predicate passes all eight raw rows. Worker valid/malformed/truncated cases, paused pixel retention/resize/resume, and four same-engine replay checks passed. All 14 command owners closed without forced cleanup, ambiguity or survivors. Original worker reports also retain expected blocked external catalogue requests under generated CSP.

Artifact `12116475613`: 810,031 bytes, SHA256 `5e900f10991d40565dc6125c0910b205195b14e0161f87ff80396dfec8cbf4a7`; all 79 member CRC/size/hash checks pass. Candidate Chromium raw numerical result is `pass-observed-window`; candidate WebKit and both baseline rows retain `fail`. Candidate WebKit's external missed-opportunity rate is 0.038242894 versus 0.01 limit, and cadence quantile bins are inconclusive. One CPU1 pair per engine is not repeated timing qualification, physical-device or GPU/thermal evidence.

## Six Next observations

[Run 39073210040](https://github.com/mekhovov/revealline/actions/runs/39073210040) failed. No row completes all eleven missions and ten manual Next transitions. The original 100 ms input/read envelope, 60 s mission and 20 minute scenario bounds remain unchanged. All 26 command owners closed cleanly. All five partial native replays match their own recorded checkpoint, but correctly fail the required final `second-landing` definition. Chromium r2 never entered the route because fresh calibration was unstable/off-target (median 952.5, spread 0.206824147).

| Row         | Manual Next clicks completed | Artifact    | ZIP SHA256                                                         |
| ----------- | ---------------------------: | ----------- | ------------------------------------------------------------------ |
| chromium-r1 |                            7 | 12116047966 | `5c4e6ffbbb266cfca7bdb823c6f0f28dc97200aa202c9f7566792b657b905d65` |
| chromium-r2 |                            0 | 12116002474 | `abac7b5ab2cbd7ea55300e032f94a91f6ab0291a671895aa3161b1c6b1303e16` |
| chromium-r3 |                            6 | 12115941913 | `35a5a27a9d07d884172e7a8f5be3cabe119c20236b70f94ccaac8703e3636976` |
| webkit-r1   |                            0 | 12116057443 | `b4e07a5a0fb10324189b0ec9ef06c1dcc00763b9b755b13ab39c3370397fe87d` |
| webkit-r2   |                            9 | 12115729622 | `cea8b25ba85b3c00089caa52bba1da9dacb6df221a2300ff9ca91afe967c48c9` |
| webkit-r3   |                            1 | 12115957668 | `468a9af24605681d6f0cfa1eddfe3c9c6043cc3e546f4a82541cc2cf0d0daf43` |

- Chromium r1: seven successful missions, then Courtyard Return pauses after a 350 ms rAF interval. The preceding retained frame measured update 1 ms/draw 1.2 ms; the subsequent pause callback measured update 84.2 ms and simulation 0. The pause work cannot explain the already elapsed gap. This is an application safety pause with an unresolved preceding host/browser/application-outside-frame cause.
- Chromium r3: six successful missions, then a rendered-state read exceeds 100 ms during Two Bays. Nearby measured updates are 1–2.2 ms, draw 1.2–1.8 ms; a separate native long-task entry spans 88 ms. The failure cleanup subsequently induces Pause. No stack attribution is available for that task.
- WebKit r1: first-victory ArrowDown release exceeds 100 ms. Terminal bookkeeping is 21 ms; same callback update is 106 ms, including HUD 74 ms and simulation 5 ms (draw 0). Journal independently retains a 106 ms work window and subsequent 190 ms rAF interval.
- WebKit r3: opening succeeds; second-victory state read exceeds 100 ms. Terminal bookkeeping is 16 ms, update 105 ms including HUD 84 ms/simulation 2 ms, draw 1 ms. Journal work is 106 ms with a 190 ms interval. HUD is a measured region, not an internal function profile or proof of the entire native-operation delay.
- WebKit r2: nine completed manual Next transitions; tenth mission wins but ArrowDown release exceeds 100 ms. The release is invoked approximately 391 ms after its 53 ms terminal callback ended, during a 733 ms picture-phase interval with measured update 1–2 ms. This timeout must not be attributed to the earlier terminal prefix.

No page error or failed response was observed in these five gameplay reports. WebKit successful terminal HUD windows are also substantial (36–49 ms in r2). The separate source audit traces that unchanged HUD region; it is not a sampled native stack.

The earlier CPU239 profile retained a 90.9 ms terminal span and distinct sampled campaignKey, exportReplay and capture inspection subtrees. Exact397 first-victory terminal spans are 20.8/21.7 ms in Chromium (separately calibrated CPU2.41/2.14) and 21/13/16 ms in WebKit CPU1. These are descriptive observations from different hosts/instrumentation, not a controlled speedup estimate. Source397 reuses the accepted campaign execution key and admits optional replay/checksum work; its terminal source region is byte-identical to current816 (SHA256 `94163102d461a82c99d2d5cf4154037d090d8af2ce8ab4cd69c00fc197a78d61`). Later changes do not establish a fix for the remaining native gaps.

The journal/application clocks share document performance origin. Input alignment uses Node ISO start plus monotonic route offsets and is approximate: exact DOM event delivery and late Promise settlement timestamps were not retained. rAF timestamps are not callback execution starts; HUD/simulation are included in update. Rolling application frames omit older records in longer routes; complete bounded journals and captured terminal snapshots remain available.

## Selected-font settlement

[Run 39073210265](https://github.com/mekhovov/revealline/actions/runs/39073210265) failed its aggregate because the raw numerical row is `review-required`/`inconclusive`, while independently recomputed readiness correctness is **pass**. All 21 public actions and native replay pass (160 moving ticks); four command owners and persistent browser/profile/transport owners close cleanly. The 43 active frames do not qualify performance.

Artifact `12116022498`: 311,369 bytes, SHA256 `fa325a9b3a971dff1e4522293ec66aab1903ec4d30629ee6042efcd4f3af305e`; all 32 members verified. Exact e1cc source CSS and direct target rule are bound. Before selection, stable face1 was unloaded and face2 had status error, but both observed original loaded promises were unsettled. Three existing load calls returned face2; all stayed pending through trusted Cancel and fulfilled only after original response release. Later explicit Start begins at tick zero and native replay reaches 160 ticks. This demonstrates why “all matching faces loading” and status error alone were insufficient cross-browser pending/rejection witnesses. FontFace-to-rule identity is not exposed; no runtime font workaround or new font request is implied.

## Cocoa ownership prerequisite

[Run 39073210308](https://github.com/mekhovov/revealline/actions/runs/39073210308) failed before fixture/media preparation. Artifact `12116355923`: 13,792 bytes, SHA256 `fbc0aff61da82dc0d5a3d1195401df9a22326e2ca89d937fa41997d9e194d900`; all 11 members verified. Fresh native browser preflight reports `unattributed-new-browser`, forced owned cleanup, no survivors, and a retained ambiguous PID15107. Exact kernel path is `/System/Library/Frameworks/Metal.framework/Versions/A/XPCServices/MTLCompilerService.xpc/Contents/MacOS/MTLCompilerService`; root UID0, PPID1, PGID=self, complete path provenance, but RSS/owner-tag inspection unavailable. The browser profile cleanup is reported `failed-profile-retained` and remains a failure. No media/codec, resource-zero or expanded signal-authority claim follows.

Apple identifies MTLCompilerService as its Metal compilation/cache service ([WWDC20](https://developer.apple.com/videos/play/wwdc2020/10615/)). A prospective exact-path neutral-system classification may use the existing thermald identity/lineage/provenance conditions; the old result cannot be promoted without its missing complete before/all inventory. No successor was dispatched during this readback.

## Local readback receipts

- `.cache/solo-followup/native-8161953/next-terminal-analysis.json`: 364,486 bytes, SHA256 `276e8c8ca9f33c421c40eababa6f725f92415c52f5aa08e619b0365ee072131a`.
- `.cache/solo-followup/native-8161953/independent-adapter-readback.json`: 20,330 bytes, SHA256 `7cade0081138544b21f91b7207b276ee075ea7bce483271d6f3a93da696f9783`.
- `.cache/solo-followup/native-8161953/final-source-outcome-readback.json`: 238,921 bytes, SHA256 `612e6fbe1d0cc562ef529b4836fbe02e1707d55adc015176d398c96190f0b485`.
- `.cache/solo-followup/native-8161953/cocoa/39073210308/12116355923/independent-readback.json`: 4,602 bytes, SHA256 `7e8b4bcd31dd15c78584842cd9d66be9cf7f5a1567226844cec7ef969db2a3b4`.

Source/archive readback checks exact remote payload proofs against API artifact identities, Git revisions/trees and frozen tooling refs. The full game archives remain remote. Initial analysis-script baseline-reuse shape and syntax errors were local reader failures; raw evidence was unchanged, and the corrected full readback passed.
