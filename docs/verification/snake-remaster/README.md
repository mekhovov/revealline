# Tactical Snake remaster — delivery and evidence

This delivery remasters the existing 240-mission catalogue in place. Fourteen accepted gameplay recipes change; 226 retain their established gameplay. All 240 receive explicit construction-family and focal-assembly descriptors. Recipe review, automated solvability, browser inspection and player enjoyment are separate forms of evidence.

## Implemented

- Three playable presentation directions across the same six encounters (18 presentations), sharing one simulation, seeds, controls, sound adapter and production board renderer. Open `game/test/manual/snake-operation-lab.html?review=remaster`. Appearance changes preserve the current attempt. The comparison lab deliberately does not save progress.
- Six worlds, 18 modular structure families and six landmark assemblies. Coordinated edges, corners and fixed-scale details replace stretched repeated motifs. Landmarks occupy existing solid cells; 37 open/thin missions explicitly omit solid landmarks. Open Loop remains obstacle-free.
- Lively FPV, Toybox, Atmospheric Ruins and Night Arcade material treatments, alongside Game Theme and Retro Field. Creator-owned wall artwork remains authoritative, including images arriving while paused under interference.
- Stable enemy silhouettes, compact mobile actors, accepted-heading cues, warning/action/recovery presentation, parcel attachments, matching dock fittings, mechanical switches and load/delivery/erosion reactions. Per-step observations preserve reactions during multi-step frames.
- Successor v6 tactical commitments for runner/refuge/switchback/pair/sprinter/shield/jammer/guard. Authored routes use adjacent cells and bounded current-position decisions. Mobile jammers and guards move only during recovery. The existing shared hazard scheduler remains authoritative; warnings last at least 800 ms.
- Nine tactical operation missions connect interception to cargo, cable-held gates, wrapping, source interception and flanking. See `catalogue-review.md` for each concrete change and `catalogue-review.json` for all 240 briefs.
- Jamming conceals actors and incidental position cues. Movement projection, catches, warnings and relay-opening audio do not reveal hidden enemy direction; required warnings remain audible. Pulse and recovery restore ordinary presentation.
- A fresh official campaign namespace isolates remastered records and unfinished attempts without deleting old bytes, creator content or other modes. Retired official recipes do not silently restore as current attempts. v6 Continue/replay reproduces committed state and hazard seeds.
- Compact delivery/source acknowledgements use existing HUD space. Shared entry, pause, selector, touch controls, results, final-eight replay/retry, 5.2-second victory celebration and cancellable five-second auto-next remain owned by the existing host.
- Follow-up state animation uses explicit anticipation, recovery, blocked and idle clips. Specialist equipment deploys with its accepted phase. Gate reactions remain on side rails, and each world has a victory-only floor/equipment acknowledgement, including open boards. Reduced effects retains static state cues. Equipment is clipped to its occupied cell.

## Verification

- Ten changed missions: 54 tactical and six geometry-editorial winning journals across Solo/Team and three paces, plus 12 additional jammer journals for hazard seeds 73 and 2026.
- The full Snake batch initially passed 325 of 326 tests. Its one creator-art arrival regression was fixed; the complete affected renderer/audio follow-up passed 39 tests.
- The initial local trace pass covered 60 remaster journals: maximum two catches per cell; longest interval without an encounter/objective/state change 21 moves (5,880 ms). Thresholds are review heuristics, not scores for fun.
- Expanded trace audit restores 1,452 exact-recipe journals across all 240 missions and all 1,440 Solo/Team/pace setups, plus 12 alternate jammer-seed runs. The follow-through adds 192 slow/fast foundation journals to the prior 29 foundation supplements. Twelve additional outlier routes remain separate alternative witnesses. All combinations are covered, but a winning journal is not a fair higher-star threshold. See `catalogue-trace-review.md` for limits and grading decisions.
- Existing catalogue proof suites remain in place. Current record-capacity test covers 576 operation records, using 2,270,011 bytes against the 24 MiB logical budget.
- Fresh-session/retired-import host regression suite: 89 passing tests. Tactical engine tests cover committed routes, ignored queued inputs, replay tampering, concurrent outcomes and hazard coordination.
- Renderer/cache tests cover exact occupied cells, eroded geometry, creator artwork, concealed actors, surface bounds and compact identities. Additional retained render surfaces total approximately 15.11 MiB against the 16 MiB budget.
- English/Ukrainian localization, canonical shared-source byte checks, presentation metadata, source lint/formatting and offline dependency closure checked. Generated JSON evidence retains its canonical generator formatting.
- PR #1182's final build succeeded: 3,275 files at source `6a8689d1d9659686c5266849fa78e67de6c97faf`, distribution SHA-256 `0afe38afe00ad738fc4c7231f55ffd36d4896c15296dca4265b98151ee7ef1b8`. Build output is disposable and excluded from Git.
- Follow-up renderer, animation, cache, interference and production-host regression selection: 131 tests passed.
- Capture host fixture alignment: all five host tests and 20 related presentation/progress/rating tests pass. Assertions now unwrap the accepted-presentation save envelope and await the selected campaign rather than an unused default picture. Start/Resume keeps its readiness assertion with the shared 20-second scheduling allowance. Capture gameplay and saved format are unchanged; the entire repository suite is not claimed green.
- Browser inspection: all six comparison encounters; desktop, 320px portrait, short landscape, Team/Versus presentations, shared D-pad input, Ukrainian copy, grayscale, collision overlays, paused state and active-jammer fixture. Screenshots are stored alongside this report.
- After normal production unlock, verified direct Retry and mission activation, shared pause actions, Settings returning to Pause without advancing the attempt, automatic final-eight playback/restart, and cancellation through Pause. At 320×568 and 568×320, Retry/Home remain visible while secondary result details scroll. A normal keyboard playthrough of Open Loop completed eight catches in 93 moves (18.6 seconds), showed celebration with direct Next/Retry actions, then Stay here cancelled progression and opened results with three stars and run/lifetime totals of eight. Next launched Twin Islands in one click and retained the lifetime total. Screenshots named `production-*` document these views. Browser console inspection reported no errors. Exact victory timing remains covered by automated host tests; this wall-clock keyboard route is not a physical-device test.
- `renderer-comparison.json` records same-browser baseline and remaster redraw measurements. The two-board animation comparison measured 120 frames after warm-up: baseline frame-interval p95 9.90 ms and remaster 9.00 ms; draw-cost p95 10.30 ms and 5.20 ms respectively. These are bounded browser measurements on frozen simulation states, not a claim about all phones, active-match FPS or statistically established speedups.

## Latest quality follow-through

Rebased onto `origin/main` at `0e708a45cb5058fdd0e455a873b559bb4ed0a468` (merged PR #1187). This batch closes concrete gaps without treating automated solvability as a whole-catalogue quality sign-off.

- Snake victories reuse existing localized Engineer/Rival route commentary instead of the Capture Guide's picture-reward lines. The shared reaction provider and generated optional runtime remain canonical; no new audio asset is required.
- Loaded Excavation's one-cell demolition now opens its promised passage through a two-cell-thick structure: the far side starts recessed. The actual crossing changes from 13 to three moves after the full warning, with the outer bypass and cargo goal preserved.
- Pressure Elbow keeps its three catches but moves the runner along an explicit committed route beyond the cable-held gate. Both changed missions have all six supported winning journals; predecessor recipes remain archived.
- A source/trace editorial review records keep/revise decisions for 56 missions: six complete world chapters plus eight shortlisted outliers. This is a bounded editorial review, not 56 observed player sessions; see `editorial-pacing-review.md`.
- Eighteen literal cosmetic floor compositions cover the opening eight boards and representative adjacent pairs across the other five worlds. Joined foundry and harbor structures replace repeated tiny machinery. The shared gallery exposes 72 board/look comparisons. No collision cells, simulation randomness, or additional retained rendering surfaces are introduced.
- Browser inspection confirmed opening and world-pair floors at the gallery's 320px-equivalent board size, Toybox material variants, and Night Arcade grayscale/collision views. It found and verified the harbor repetition fix. `quality-authored-mobile-scale.png` and `quality-authored-collision-grayscale.png` retain the evidence. This does not claim a fresh physical-device test or all 72 presentations individually reviewed.
- A 320×568 browser viewport also showed no horizontal overflow; `quality-gallery-320.png` retains its opening-board view. This is responsive desktop inspection, not a physical phone. The commentary change is covered by the localized unit and production-host harness tests; no fresh full keyboard victory is claimed for this batch.
- Final combined Snake/archive/shared-reaction/trace regression selection: **363/363 passed**. Validation, source lint/formatting, localization and canonical generated-runtime checks pass, along with **16 optional-package tests**. The clean production build contains **3,275 files** from `f57aa287db7a80fe27342adc4a1f149d8fe4883c`; distribution SHA-256 `a68979a2e08f1fb0ae035f69bfd2ec8cd4a80cc0560fd379c623bcb26eb7af98`. `quality-validation.json` retains its receipt. Only the marked 1.9 GiB generated build directory was removed after verifying its archive hash.
- The updated 18-board gallery measured 216 synchronous redraw samples per path: uncached median 0.50 ms / p95 0.90 ms, cached median 0.10 ms / p95 0.20 ms. Terrain cache was 3.88 of 4 MiB with three retained boards. This is one desktop run, not sustained gameplay FPS or physical-phone qualification.
- The new proof coverage exposes 379 quiet-interval signals across 98 missions, with no concentrated-catch flags. The increased count comes from testing additional paces; it is not evidence of 121 newly introduced problems. Flags remain review prompts rather than automatic instructions to shorten a mission.

## Catalogue quality completion

This batch starts from `f93cf21b5`, the merged PR #1189, and proceeds independently of the merge queue.

- The remaining 184 missions now have explicit source/trace editorial decisions in `editorial-catalogue-completion.md`. Joined with the earlier 56, all 240 are covered once. Four introductory Field encounters—Border Watch, Contour Orbit, Wake Watch and Ricochet Line—now require three catches instead of six repetitions of one unchanged target policy. Their eight-catch mixed-family successors remain unchanged. The four predecessor recipes remain archived, and each revised mission has six supported winning journals.
- All 240 missions now have literal floor compositions. The remaining 222 add 600 connected material assemblies chosen by actual geometry and chapter construction roles. This completes authored descriptor coverage, not a claim that every arrangement has been separately judged beautiful. `catalogue-composition-review.json/.md` names the exact coverage and limitations.
- The comparison gallery now has chapter filters and six-mission pages, so at most 24 board canvases are mounted. All 240 missions remain reachable in catalogue order; switching chapter resets to its first page. Representative gameplay-state comparisons retain their original fixtures.
- Browser samples covered Cable Foundry, Escape Lines, Signal Smugglers and Living Citadels, including titles hidden, grayscale and collision outlines. An Alpine Toybox contrast problem was found and corrected with darker indigo enamel and distinct fittings. A 320×568 viewport had no horizontal overflow. `catalogue-alpine-toybox.png` and `catalogue-gallery-320.png` retain sampled evidence; these are desktop browser observations, not physical-device qualification or 960 individual screenshot reviews.
- The sampled six-board Toybox redraw comparison measured 72 synchronous redraws per path: uncached median 0.60 ms / p95 1.10 ms; cached median 0.10 ms / p95 0.50 ms. Terrain cache was 3.88 of 4 MiB with three retained boards. This is a bounded same-browser observation, not active-game frame rate or evidence of low-end phone performance.
- Shared rating criteria now explicitly state either exact silver/gold move budgets or the completion-only policy in English/Ukrainian. A normal production browser check confirmed the revised three-catch Border Watch, direct Retry, Pause → Choose → Mission info and the one-star policy; `catalogue-rating-criteria.png` retains that view. No new full victory playthrough is claimed for this batch.
- Calibration regeneration is fenced to already published keys and thresholds. A newly discovered winning route cannot silently create or change a silver/gold target. The current catalogue has 375 compatible fixed-budget setups and 1,065 completion-only setups, including 180 variable-condition setups. All 2,880 incompatible seed/recipe checks reject inherited higher grades. The historical published table remains unchanged.
- `requirements-evidence-matrix.md` maps every plan item to implementation, tests and the evidence boundary. The final combined regression run passes **374/374 tests**, with **16 optional-package tests**, source lint/formatting, localization, canonical generation and game validation passing. The clean production build contains **3,275 files** from `b2f07266da55ad72df3a6da04318828630fa93aa`; distribution SHA-256 `eb200d081887ede62ed018d658dd25bf5d2970fd3c7f493ed4beb5ec41f5f787`. `catalogue-quality-validation.json` retains the receipt. Only the marked 1.9 GiB disposable output was removed after checking the archive hash and integrity; source and all commits remain intact.

## Final acceptance follow-through

This follow-up starts from `460169d79` (merged PR #1191). It proceeds independently of the PR queue. The user explicitly deferred physical testing and waiting for player feedback.

- Completed the bounded desktop composition pass: all 240 Lively FPV starting boards, six Toybox world chapters, alternate-look geometry samples and a 320px layout check. `browser-acceptance-followup.md` records exact coverage and limits.
- Toybox now preserves the 18 construction-family roles. Native dispatch/shelter components use connected facades and receivers use one equipment bank. Cosmetic revision v6 invalidates cached terrain without changing gameplay or creating new retained surfaces. See `visual-acceptance-polish.md`.
- Fixed optional couriers being named as required targets when an older bonus actor survived a required catch. The existing per-board row now identifies optional couriers in English/Ukrainian. Opening instructions are device-neutral. `pacing-acceptance-followup.md` documents accepted-route evidence and the decision to keep the remaining mastery quotas.
- Completed the additional grading assessment. Two independently implemented steering methods produced identical journals for all five simple candidates; they do not justify new thresholds. All 375 existing graded setups and 1,065 completion-only setups remain unchanged. `rating-calibration-followthrough.md` and its reproducible evidence state what would justify future calibration.
- The combined regression selection passed **390/390 tests**, with **16 optional-package tests**. Final review caught and fixed a transient-row CSS interaction that hid the catch quota; all **98 final host tests** passed afterward. Localization, canonical generation, game validation, lint and formatting pass.
- The clean **Main Pages production profile** built **3,193 files** from `e80c772b6263180eede1b563ca3c47a08a07c65a`. Distribution SHA-256: `8cf763329515b6d5e77dd97b875a6a2d7b3ff6b30362fafa7b09bcb08984a8e5`; archive checksum and CRC passed. `acceptance-validation.json` retains the receipt. The archive-inclusive full distribution exceeded disk capacity and is not claimed completed for this source; its staging cleaned itself up. Existing historical replay and optional-package tests passed. Only the verified disposable Main Pages output was removed after validation.
- Disk cleanup removed 1,003,166,747 logical bytes of unchanged, manifest-listed generated copies from an inactive old build. Its source revision was verified in main, hashes were checked before deletion, and manifests, extra files, source checkouts and all Git data were retained. No application profile/cache or working repository was deleted.

## Research and input-parity follow-through

[The refreshed plan](research-plan-refresh.md) records the latest research,
priorities and exact remaining evidence. The acceptance work in PR #1194 is now
merged. A separate follow-up fixes two audit findings: all retry inputs preserve
accepted artwork while renewing jammer schedules, and controller navigation
during celebration cancels automatic continuation. The full host suite passes
106 tests; shared-menu/offline/package checks pass 104; focused visual checks
pass 44. Existing recipe and grading evidence is unchanged. Physical testing
and player feedback remain deferred; no fresh full-distribution build is claimed.

## Full archive verification completed

The final packaging gap is closed on clean merged main
`1a2e87d50670f6c4e2c79faf6dd46d9a52479c93`. PRs #1194 and #1196, including
all their implementation/report commits, are confirmed ancestors. Subsequent
main changes leave Snake and its shared runtime unchanged; the updated optional
worker is canonical, and all 14 focused offline dependency checks pass.

The full default game distribution (including archived recipes) built **3,277
files**, version **0.151.1**. Its ZIP SHA-256 is
`f7de2ab16a59d899cec1986c91253666353cb9e1d9f9e1eb6641a2a65d1002f5`.
Archive CRCs, every archived manifest entry, every expanded-file hash and output
inventory passed. [The receipt](full-archive-validation.json) records exact source,
command, file count and evidence limits. This supersedes the earlier disk-blocked
full-build status; historical receipts remain unchanged.

Only the task-owned, marker-checked generated output was removed after verification
(2,075,953,812 logical bytes). All source, commits and saved data remain intact.
This verifies the game distribution, not deployment or hosted publication.
No additional implementation item remains identified by this final audit;
physical-device and player checks stay deferred and grading extensions optional.

## Interaction review follow-through

[The interaction review](interaction-review.md) adds developer examples from
Rytmos, Lost in Play and Donkey Kong Bananza and translates them into bounded
feedback/input priorities. Its audit found three edge cases: controller Menu
did not stop terminal playback, unchanged reception status was repeatedly
rewritten, and globally enabled voices could override Snake's jammed-catch
silence request. All are corrected, with 109 host, 74 audio and 16 package tests
passing. A fresh full default build at `6cc04df43` verifies all 3,277 files and
archive/expanded hashes; `interaction-validation.json` retains the receipt.
No new simulation or grading rules are introduced. Historical build receipts
retain their exact source attribution.

## Deferred qualification and intentional grading limits

The [release follow-through](release-followthrough.md) confirms PR #1208 is merged
and its Snake/audio modules are published at an observed main revision. It also
records 72 additional alternate-look board comparisons, the Night Arcade roof
contrast correction, and change-only pause/result/saving announcements with
113 passing host tests. That public observation covers #1208; the new corrections
are separately delivered and are not claimed live before their own deployment.

1. **Deferred by request: physical-device qualification.** Responsive desktop emulation cannot establish touchscreen ergonomics, physical controller behavior, thermal throttling or low-end phone frame times. Use the existing lab/gallery on representative phones and controllers before claiming those devices qualified. This does not block the current delivery.
2. **Optional: additional silver/gold calibration.** Completion stars and personal records are the accepted finished policy for uncalibrated and variable-condition setups. Higher grades require compatible independent evidence and a fairness policy; a single solver route is insufficient. This is not an undisclosed unlock task for players.
3. **Deferred by request: player comparison and pacing feedback.** Editorial review, titles-hidden screenshots and winning proofs do not prove recognition or enjoyment. No new player study or approval wait is required for this delivery.

## Latest-main appearance integration

The [appearance integration review](appearance-integration-review.md) checks the
newer shared Battlefield controls on main `07cf04c40`. It consolidates Snake's
duplicated enemy preset into the shared Appearance section and corrects compact
settings overflow found at 320px. Coverage preserves the accepted attempt and
artwork across appearance changes, replay, mission previews and saved cosmetics.
English/Ukrainian browser observations are recorded separately from deferred
physical-device qualification. VoiceOver listening is skipped by explicit user
request and is not an acceptance gate for this delivery. Higher-grade expansion
remains optional; no new gameplay or mission content is needed for this fix.

## Public interaction closure — 15 October 2026

PR #1233 is merged and included in a successful public deployment. The
[public release check](public-release-check-20261015.md) closes the remaining
recommended desktop public-site follow-up: direct entry and mission activation,
shared settings, appearance changes, fixture-assisted victory/results/Next,
cancelled auto-next, an observed 2.93-second ordinary defeat/replay/retry, normal
reload, and English/Ukrainian compact layouts. Exact deployment/module evidence,
screenshots and the visible transition trace are retained alongside the report.
No runtime defect was identified. Physical devices and player feedback remain
deferred; VoiceOver remains skipped; higher-grade expansion remains optional.

## Original artwork and safety

New structure, pose and material artwork is editable original drawing code in the existing presentation system; no third-party game sprites were copied. Existing shared artwork/audio provenance remains authoritative. Cosmetic state does not consume gameplay randomness or enter gameplay recipe identity.

Disk preflight initially blocked work. Connectivity verification passed before cleaning abandoned, inactive Git temporary packs (about 6.1 GB). Normal packs, refs, commits, working files and creator assets were preserved. An external repository relocation subsequently rewrote the checkout link; final Git operations explicitly target the verified tactical-remaster metadata to avoid including unrelated changes.
