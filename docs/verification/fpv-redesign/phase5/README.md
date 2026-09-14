# Phase 5 bounded visual review

This is source-preview evidence, not approval of all 194 required assets. [review-ledger.json](review-ledger.json) records all 293 registered slots, separating native specimens, real interface evidence, library-only components and unverified work. No asset was promoted to “reviewed” by this pass. The source and compiled collection changed during review; qualify the frozen release again. Settings and supporting-page screenshots include the concurrently developed phase-6 surface changes; they do not certify those screens in the earlier phase-5-only staged source.

## Browser and measurements

The subagent could not obtain an in-app browser binding; the parent authorized the agent-browser fallback. Two separate owned Chrome sessions used `http://127.0.0.1:9042/`. Actual CSS viewports were 1440×900, 768×1024, 390×844 and 844×390, all DPR 1. Screenshot PNG dimensions/hashes are in [screenshots.json](screenshots.json); accompanying `.txt` files contain actual DOM measurements. These are standalone browser emulations, not physical devices or an in-app capture.

Control+Equal and Meta+Equal did not change the native browser zoom. The separately labeled `settings-large-css-zoom-200.png` used temporary `body.style.zoom=2`, then removed it. That stress case clips horizontally because media-query dimensions stay unchanged. It is **not** native 200% browser-zoom qualification.

## What was inspected

- All 30 original sprite cards: 20, 24 and 32 CSS pixel samples, enlarged clusters and light-background samples. Compact drone silhouettes remain clearer at 20 pixels; detailed variants lose some small markings. Enemy vehicles, wall/slow/lethal terrain and six pickup shapes are distinguishable in specimens. This does not verify every actor in gameplay.
- All 45 semantic icons: their registered 16/24/32 pixel size and 3× on dark/light backgrounds. Medal ranks retain one/two/three cut marks. Labels remain necessary, particularly for upload/load, undo/retry and status symbols.
- Actual FPV Pressure Lines install, mission locks, deployment, keyboard movement, live exposed trail and line failure. A normal closed rectangle reached **5.1% revealed / 1200 score / three lives**, shown in `flight-partial-reveal-desktop.png`. No engine state, achievements or save records were injected.
- Pause, normal Continue verification/restoration, restart confirmation and empty Collection after an unfinished mission. Collection correctly kept the picture concealed. Natural victory, earned medals and the full earned-picture viewer were not reached in this pass.
- Standard and Large settings at all four sizes; native keyboard focus and pointer-held pressed state on the title; selected tabs and disabled mission/pagination controls. Studio focus/pressed/disabled/error samples are explicitly **state specimens**, not evidence of every native interaction.
- Selected title v2 in the actual title menu at desktop and portrait. Text remains in the quiet composition area and all five actions fit. `title-installing-v1.png` and `title-continue-desktop.png` are earlier title evidence; use `title-v2-*` for the currently selected illustration.

## Confirmed fixes and limits

Uploaded checkbox/radio/toggle frames now use their authored asymmetric nine-slice geometry while preserving an independent checked indication. Main title/pause buttons use semantic icons instead of legacy pseudo-decoration; fullscreen has one glyph. The controller icon targets real practice links.

Portrait telemetry uses two columns and keeps each glyph/value on one line. Short landscape reserves a header strip above the board so the starting border and actors remain visible, with four pixels for the focus outline below the canvas. Earlier `flight-standard-portrait.png` and `flight-standard-short-landscape.png` show the defects; `*-fixed.png` and Large flight captures show the corrected arrangement. The first captures immediately after CSS reload briefly showed an empty Pause glyph; the settled fresh-page capture `flight-after-observer-fix.png` shows it correctly. Final settled captures and DOM bounds supersede transitional frames.

The initial browser restart stayed in picture preparation for minutes, then recovered without application changes. A fresh three-byte Blob read/fetch also hit a three-second timeout in that browser, so a general resource stall was observed; the cause is not proven. The exact source-host install/play/save/restore/restart regression passed with an injected image codec. A separate real issue was found and fixed: newly added HUD `<small>` nodes previously triggered a full-document icon scan every frame. The observer now visits only added subtrees. This is a performance fix, not proof of the Blob-stall cause. Repeat actual frozen-release restoration/retry qualification.

Studio component previews now create real checkbox, radio, switch, slider, select and text controls. They preserve native disabled/checked/invalid states and authored frame slices. Chip, tooltip, signal/connection and confirm/cancel symbols have clearly labeled library specimens. No telemetry, rewards or live actions were invented to consume unused slots. The main Studio workspace remains isolated from the release host and player storage.

## Checks

- 15 targeted host/UI/specimen tests passed after the geometry and native specimen changes.
- Six Studio build/fixture/specimen tests passed.
- Runtime owner separately reported 19 host/UI/font/page tests passing after the subtree observer change.
- ESLint, Prettier and whitespace checks passed for the bounded source changes.
- Earlier audio/native replacement work has separate validation in `docs/presentation-audio-and-ui.md`; visual review does not establish production sound quality.

Still required: remaining scene/native picture reviews, full victory/earned Collection journey, live coverage of other classes/enemies/pickups/effects, physical touch/controller testing, native 200% browser zoom, other browser engines and frozen-release regression. Individual unverified slots remain explicit in the ledger.

## Native Studio transfer acceptance

The actual file inputs and download buttons passed upload → stage → Save local revision → export → reload → namespaced import → save → re-export → reload. The QA upload reused the existing 24×24 play icon, supplied origin/license/prompt fields, and stayed in the separate owned Studio browser profile. [studio-transfer-proof.json](studio-transfer-proof.json) records hashes, counts and steps. All **127 source/derivative files** in the 5.48 MiB export are byte-for-byte identical in the 5.51 MiB round trip. The saved imported collection is `import-6`, document r6, local generation 2.

Exact-size preparation re-encoded the bound PNG from 134 to 243 bytes; its original source was retained unchanged. This is preserved-source proof, not a claim that the prepared derivative has identical compressed bytes. A one-byte corrupted bundle was rejected with “Asset bytes/hash do not match the manifest.” before any workspace change. The first valid import exposed an asset-count capacity failure; immutable-record reuse fixed it, and the native sequence then passed. Both failure screenshots remain as evidence. Binary QA bundles stay in `.cache/fpv-redesign/studio-transfer-proof/`; no QA asset was adopted into production.

Opaque button centers were also checked against actual selected Settings tabs. The before image loses the selected label beneath the dark uploaded center. The fixed selected/hover state keeps the authored 6/5/7/4 frame and exposes the cyan native background with readable ink text; temporary browser-only QA artwork was removed. Studio state specimens mirror this rule. Four focused UI/specimen tests passed.

## Exact-source readiness correction

Candidate `01208844e04b6e44f9c71276e9c1ecec5a403bf7` completed the hosted suite with 3,578 of 3,583 TAP results passing. Its five failures were three full-original featured-picture readiness waits and the Sentinel new-app inventory wait plus its parent suite. The complete failed receipt is retained in the release qualification archive.

The corrected candidate changes only two host fixtures and qualification infrastructure. The three featured-picture predicates use the existing bounded 180-second bulk-original allowance and report the pending pack, picture state, visible messages and errors on failure. Sentinel passes its already-declared inventory allowance to initial app readiness. Exact original-image header checks, real input/capture, replay and save assertions, three-theme download/ownership checks and restart authentication remain intact. Shared waits and application timeouts are unchanged.

All six source gates remain required. Five non-test gates and production reproduction run first; the test gate uses the reviewed deterministic sharder in four isolated jobs, with 79 files each and a complete disjoint union of all 316 existing test files. Every job records the exact commit/tree, Node version and sharder hash. The P7 reviewed-ledger gate is explicitly not applicable to this earlier phase. Do not report a monolithic `npm test` command or a P7 review pass for this candidate.

`source-qualification-scope.json` records the discovery/identity preflight, not a passing source qualification. Package, lockfile and build versions remain the unfrozen v0.49.0; all runtime files, compiled presentation data, original assets and production history are unchanged. Publication still requires the final committed source to pass all six hosted gates and public release checks.
