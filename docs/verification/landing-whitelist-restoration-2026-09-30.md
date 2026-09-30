# Landing whitelist restoration — September 30, 2026

## Source and corrected behavior

Runtime commit: `f260e87f06ee4ae848483b8ef40e949a7947b66d`, based on accepted main `908bc6b08d1999edafa79d1581d2bab9395285b7`.

Fresh public default and DroneAid observations earlier on September 30 found six extra landing actions: Play music, Next song, Collection, How to play, FPV flight simulator and Flight practice. The earlier public report remains a historical failing observation until the correction is integrated, published and checked at the actual public routes. This report supplies local source/browser evidence only; it does not retroactively qualify that public deployment.

The ordinary Solo landing now contains the supported mode controls, one truthful Start/Continue action, Select Mission, Settings, Fullscreen where available and Sound, with passive title, song and version information. Default retains Solo, Versus and Team; DroneAid retains Solo only. The unchanged mode actions still own their existing route and unfinished-session protections. Neither moving focus nor inspecting Settings activates a game mode.

The correction moves the original controls rather than cloning or removing their features:

| Existing action                     | Destination                      |
| ----------------------------------- | -------------------------------- |
| Previous, Play/Pause and Next track | Settings → Audio                 |
| Collection                          | Settings → Progress & Collection |
| How to play                         | Settings → Help & Extras         |
| FPV flight simulator                | Settings → Help & Extras         |
| Flight practice                     | Settings → Help & Extras         |

Solo no longer passes a landing anchor to the lazy music transport owner. The shared transport additionally rejects prepared `.native-landing` anchors when an Audio settings root exists, preventing a late owner from appending a second transport row. Its existing Audio transport and nonlanding anchors retain their behavior. No shortcut preference, playback, queue, published-track or provenance contract changes.

The same Collection, Help and practice elements keep their IDs, handlers and reachable input scopes in Settings. Matching icons are added for Help, FPV and practice. Collection opened from a Settings control now says **Back to Settings**, retaining the existing exact modal return ownership. Existing lesson-specific exceptions, runtime routes, saves and the accepted shared Confirm/router lifecycle remain intact. Fullscreen remains a requested landing action.

The three runtime files are `game/app.mjs`, `game/ui/native-menus.mjs` and `game/ui/quick-music-controls.mjs`. The browser journeys below ran immediately before the runtime commit was created, against the identical bytes subsequently frozen in `f260e87f0`. They are not described as a fresh rerun after that commit.

## Automated checks and baseline failure

The final owned cohort passes **91/91**, with zero failures, cancellations or skips. It includes default/edition landing and Settings scope checks, the full 18-edition adapter matrix, Versus/Team whitelist checks, input/return behavior and soundtrack-host preservation. A separately invoked isolated-course case passes **1/1**; it is not part of one 92-test run. A separate **14/14** quick-music component suite remains a distinct result. Do not sum overlapping repeats or substitute these scoped checks for the broader failing cohort below.

`/tmp/landing-owned-final-20260930.txt` at the captured 91-case cutoff is **20,382 bytes**, SHA-256 `c41ebfd8ecf119a3ff1c74fdd4e3f8d549cb30dd6562a4d6c8929947661e2dca`. The isolated-course result remains in its own receipt; the 91-case log is unchanged.

Localization passes **11,992 messages / 8,858 references**. `/tmp/landing-whitelist-localization-20260930.txt` is **121 bytes**, SHA-256 `7b9537a81d02b5d9c9ebdf45004dea5c1afe7848efc7b9677b71536522ea7345`.

The wider four-file modal run initially reported **63/74**, with ten stale modal fixtures still activating hidden former landing controls or expecting Back to menu, plus a Creator-scope process killed while formatting a recursive DOM identity failure. The modal fixtures now enter real Settings categories and verify nested return, retained appearance setup and explicit Replay closing Settings. Its complete repeat passes **57/57**; a final added appearance-retention assertion receives a separate overlapping **2/2** repeat. Direct paused-flight Collection behavior remains covered. No runtime change was needed.

The unchanged-main Creator fixture also expected six-category navigation after Settings had gained eight categories. A bounded immutable-main overlay reproduces **0/3**, specifically End reaching Extras instead of the obsolete Data expectation. The corrected fixture uses real directional category movement, starts from visible controls and retains exact node identity, hidden/forced-click restrictions and authoritative checkpoint checks. It passes **3/3** both on current source and on the selected-main overlay. Bounded boolean identity assertions avoid recursive DOM failure output. That overlay is not full-main acceptance. Initial failures remain recorded separately; neither fixture alignment waives a production guard.

The following receipts remain individually attributed; counts overlap and are not summed:

| Receipt                                                 |  Bytes | SHA-256                                                            |
| ------------------------------------------------------- | -----: | ------------------------------------------------------------------ |
| `/tmp/landing-isolated-course-20260930.txt`             |    319 | `43e798198fc60d1dcc0457554db7e2ba6201666fb964dd9be8dbee47d557b6e7` |
| `/tmp/landing-quick-music-final-20260930.txt`           |  3,369 | `ed496631f8682c91b5fc51187f7a4988fdefb38e74f0fa5794bc65f5e353bb34` |
| `/tmp/landing-modal-navigation-second-20260930.txt`     | 13,955 | `10e73d50a31e7c92fe778b895c1ff6207a82d12c02cb18822365c2d7eaf09900` |
| `/tmp/landing-modal-appearance-final-20260930.txt`      |    568 | `866273a59b41b6b444bc6d139c594af76719a61e7beed7c7bbfdf4d9ac9d1bf9` |
| `/tmp/landing-creator-scope-final-20260930.txt`         |    922 | `af4e047f0a7aee9c79aa5897d13f41dacfc0666c0f2b52fff698cf297cd4a659` |
| `/tmp/landing-creator-scope-main-baseline-20260930.txt` |  3,236 | `3405900a4a792a15d292a94caad49b7bb2bf003ee09f13f0ca704735d514c0b0` |
| `/tmp/landing-creator-scope-main-aligned-20260930.txt`  |  1,307 | `27c2c2a8d7fed43b3df177e0bc5017529a9bd11b7205ebd755cdfb3bd6ed1bc5` |
| `/tmp/landing-whitelist-modal-regression-20260930.txt`  | 26,793 | `531679498f41b4da57c5ce707dde5e753b5fe96c1779879ac791993329018a23` |
| `/tmp/landing-whitelist-inventory-20260930.txt`         |    567 | `c5274e95d887f3290bcd775f6b6208a84d05ebd17077af2708ddaf4c6615cfb5` |

Scoped ESLint, Prettier and `git diff --check` pass. No full-suite/build acceptance is inferred from these focused checks.

A separate broader cohort currently reports **71/72**, with the failing case `edition pause keeps canonical Skip confirmation and Watch first cut actions reachable`. The bounded diagnostic overlays accepted-main versions of the three changed runtime files and reproduces the failure with the existing Demo host/test inputs unchanged. It first fails because the test Canvas2D boundary lacks `clearRect`. Temporarily supplying that native boundary then reaches a second stale expectation: the case waits for ordinary `flightState=running`, while current Watch Demo uses the isolated Demo host and deliberately pauses the ordinary run on entry. The temporary helper edit was fully reverted. No product ownership guard or assertion was weakened, and this failure is not waived or counted as a pass. This bounded overlay is not a full-main-checkout qualification.

Diagnostic `/tmp/landing-demo-baseline-diagnostic-20260930.json` is **3,070 bytes**, SHA-256 `40a44552f99384cfc1e76a4f30a2418744cb1b082338a4b9e9379c7560355d41`. It preserves the selected baseline pins, outcomes and limited scope separately from the successful menu journeys.

## Virtual-controller browser evidence

The browser-only fixture `game/test/manual/native-landing-whitelist-workflow.mjs` is registered as `nativeLandingDefaultCurrent` and `nativeLandingDroneAidCurrent` in the existing authoring controller harness. It boots the actual default and edition routes on isolated local origin **9006**. The harness installs its standard virtual gamepad; the workflow operates through real controller pulses. DOM, geometry and storage access are observations only. It does not focus or click application elements directly, invoke game handlers, seed preferences or manufacture a soundtrack queue.

The first complete current default journey passes **4/4 stages**, and the first complete current DroneAid journey separately passes **4/4**. Both child viewports are **1248 × 547**. The four stages are:

1. Wait for actual game boot and the lazy Audio transport, then observe another 1.8 seconds. Assert the exact normal landing controls, the correct supported modes, exactly one primary action, passive song/version metadata, unique moved controls and no landing `.quick-music-controls`. Every normal action and mode receives controller focus without activation.
2. Open Settings → Audio. Previous, Play music and Next song are enabled and controller reachable. They are focused only; no playback or queue mutation is performed. Back restores `shell-options` and the landing whitelist remains exact.
3. Open Settings → Progress & Collection → Collection. Controller Back closes the real collection and restores `shell-gallery`; Settings Back restores `shell-options`.
4. Open Settings → Help & Extras → How to play and Flight practice. Back closes each real nested dialog and restores its exact opener (`shell-help` and `shell-home-practice`). FPV flight simulator receives focus without activation. Final Settings Back restores `shell-options` and the exact original landing controls.

The default visible controls are `solo-current-mode`, `shell-title-versus`, `shell-title-team`, `shell-featured`, `shell-play`, `shell-options`, `shell-fullscreen` and `shell-sound`. DroneAid has the same five action controls plus `solo-current-mode`; no unsupported mode is shown. Both sampled starts show Start (`shell-featured`); these observations do not establish restored-save Continue behavior.

Both completed virtual journeys observe empty added/changed/removed local-storage and session-storage key deltas between their sampled beginning and end. This does not inspect IndexedDB, prove persistence, qualify a reload or cover every asynchronous write. No player progress or save action was requested.

Two root-tool locator attempts failed after the completed default workflow, while retrieving its result and selecting the next fixture: a nonexistent `#result` locator and a Tool label lookup that did not exactly match the rendered label. Inspecting the actual `#status` and `#tool` elements resolved those tool calls. Neither was a failed application workflow or a virtual-pad stage failure; the first complete execution of each case passes as reported.

| Visible result receipt                                     | Bytes | SHA-256                                                            |
| ---------------------------------------------------------- | ----: | ------------------------------------------------------------------ |
| `/tmp/landing-whitelist-controller-default-20260930.json`  | 3,755 | `f25e7e2ee46b826c43cede1ede55752e4415a2c976718150ad59bee9f4edcef7` |
| `/tmp/landing-whitelist-controller-droneaid-20260930.json` | 3,594 | `a4a5e1b33397d9e06612ba5ffc597c76d90e0014ebfd96eb08704a6dbe47e00e` |

These are results emitted by the visible browser fixture, not physical-pad or published-build acceptance. No mission, simulator, media playback, sound toggle, Fullscreen activation or preference-edit flow is qualified by these focus checks.

## Native keyboard and responsive observations

The root browser session uses unindexed native keys without a pointer focus reset. At observed **1280 × 720**, default Settings → Progress & Collection opens the actual Collection with **Back to Settings** wording, and Back restores `shell-gallery`. Settings → Help & Extras opens How to play and Flight practice; nested Back restores the exact action each time. The FPV simulator and Audio Previous/Play/Next receive native keyboard focus without activation. Settings Back returns to `shell-options` on the unchanged landing.

At **390 × 844**, DroneAid completes the same native paths. Its compact Settings layout drills from categories into a panel and returns through the category list before closing. The landing contains six visible controls: the Solo mode and five actions. The five action rows are each **350 CSS pixels wide and 56 pixels high**; the Solo mode is approximately **160 × 72.40 pixels**; the largest observed lower edge is approximately **718.59 pixels**, within the viewport. No horizontal page overflow is observed. Live English/Ukrainian labels are exercised through the native language selector, and English is restored afterward. This is selected live-label and layout coverage, not a complete Ukrainian gameplay or authoring journey.

A separate default **844 × 390** observation records the five normal landing actions at **44 CSS pixels high**, with their bottommost edge at **303 pixels**. The mode controls are approximately **104.98 × 70.40 pixels**. The document width is **844**, and the home region has equal scroll/client height of **390**, so this measured layout has neither horizontal page overflow nor a vertically overflowing home region. The dimensions are observed browser CSS pixels, not a physical mobile-device test. Short-landscape mode navigation is not independently exercised by the geometry receipt.

No native Start/Continue, mission, simulator, audio-playback, Sound or Fullscreen activation, player save, or nonlocale preference change occurs in this bounded session. Only the isolated test-origin locale is changed and restored. This does not qualify physical controllers, OS fullscreen transitions, save recovery, actual music output or simulator return.

Compact native receipt `/tmp/landing-whitelist-native-20260930.json` is **5,319 bytes**, SHA-256 `e7ad3d44d146f2b6ab33e6ad0c0a3652ad1da058973863cbcaf01cbf345257af`. It records the observed unindexed-key session, layout and three runtime byte/hash pins attributed to `f260e87f0`. It is a transcription, not a raw interaction trace. Screenshots and the short-landscape geometry receipt are separate observations. Native store-wide byte identity was not captured; only the explicit test-origin locale change/restoration is claimed.

| Native observation / screenshot                            |   Bytes | SHA-256                                                            |
| ---------------------------------------------------------- | ------: | ------------------------------------------------------------------ |
| `/tmp/landing-whitelist-default-20260930.png`              | 105,734 | `a49e9f5b58102fcbd562fc98d963b164ba3493f22b1c0f8250b8a092c46c2301` |
| `/tmp/landing-whitelist-droneaid-uk-portrait-20260930.png` |  39,229 | `906b4574afd58200722e3298a2d4ef615be9ec14ae2785be6c47f5210d2be552` |
| `/tmp/landing-whitelist-short-landscape-20260930.json`     |   1,719 | `48ce89c799cc47b9aedc6a011fcf5c283803af46956fa6d4417fbd80010c383c` |
| `/tmp/landing-whitelist-short-landscape-20260930.png`      |  48,679 | `c2c514153e279e5de19ee7ff80b7b293545c998dd6bdb70bf151ad617c6e5ba0` |

## Source/package attribution and delivery

Fresh **18/18 sequential in-memory production edition compiles pass** at actual runtime `f260e87f06ee4ae848483b8ef40e949a7947b66d`. The largest DroneAid result contains **809 files / 66,984,359 bytes**, leaving **124,505 bytes** below the unchanged 64 MiB cap. The compiler capture covers **1,259 unique paths** (714 engine and 523 selected paths, with overlapping categories), a **132-module / 466-edge** compiler closure, and zero final disk drift. Generated `sourceRevision` values retain actual `f260e87f0`.

The final combined attribution contains **1,261 Git/disk-exact paths**. Dependencies are represented by package manifests and lockfile, not hashes of every installed dependency internal. The collector is a path inventory, not a whole default-package byte hash. No original artwork or source-only gallery is newly admitted.

- `/tmp/landing-whitelist-edition-package-20260930-full.json`: **460,220 bytes**, SHA-256 `4077475286ed508464b6efeb8638d347ad36a81d8e05abaa287b1a7d0de17d07`.
- `/tmp/landing-whitelist-final-attribution-20260930.json`: **352,096 bytes**, SHA-256 `2ee9722f742f02f6b46fc391d1b4a6162ea809909beeca5dd5ce42470bc06a1d`.

The default collector records **2,503 paths**, with zero test fixtures; build configuration is unchanged from the accepted base. `/tmp/landing-whitelist-default-collector-20260930.json` is **147,601 bytes**, SHA-256 `8d526bd156e3177bd1cdffd2b39e403a9f79a7520d0b9b6f6bdcf85c37aea9e4`. This is a collector/path-boundary observation, not a complete default-package byte hash or materialized build.

The changed runtime moves existing controls and prevents late landing transport injection; it introduces no original artwork, new media payload or implicit admission of source-only galleries. Browser fixtures remain test-only and excluded from player packages. Preserve real generated compiler metadata and independently attributed prior receipts. These single in-memory compiles do not establish double-build reproducibility, provider parity, materialized-release identity, installed offline, native-device or published acceptance.

At this report's creation the runtime exists only as a local source commit; the corrective PR and release allocation are not yet recorded here. Releases retains sole integration and publication ownership. The original public landing regression remains unqualified until the corrected actual default and DroneAid routes are checked after canonical publication. Do not clear browser saves, caches or service workers to force that check to pass.

**Pending delivery finalization:** record the eventual PR/head, clean/exact-remote checkpoint and scheduling status. Owned tabs 28/29 are closed, the viewport override is reset, English is restored, and the owned port 9006 server (PID 28495) is stopped. Other saved origins, caches and workers were not cleared. Other owners' local changes and historical worktrees are outside an owned-worktree cleanliness statement.

Full current/legacy/custom route and edition matrices, restored-save Continue, multiplayer readiness, clean native embedded previews, physical controllers, native builds, installed offline, true 200% zoom, active forced colors and representative mobile performance/comfort remain separate gates. This correction does not complete the broader native-menu plan.
