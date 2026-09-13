# Round 35 — readable menus and First Light R3

Evidence snapshot: 2026-09-13. **v0.26.0 is frozen, audited and published as a GitHub Release; v0.27 is frozen and independently reproduced; its public delivery record is linked below.** v0.26 Pages deployment and public byte/browser checks have passed. A source-browser success is not evidence that those new changes have reached the public site.

This record follows the user's menu, readability, enemy, pickup and defeat feedback. The three-level human quality checkpoint remains open. Nothing here certifies physical devices, sustained performance, enjoyment, retention, P5 video authoring or the complete public product.

## v0.26.0: verified edition and publication state

Source commit: `dfde7383440aafc292b5c83f4e471367075f71e4`. Annotated tag object: `1427b8c737a4541be23f086de7f48bfc70ee6309`. The [release record](../../../releases/v0.26.0/release.json) names the exact source, manifest and distribution hashes.

The edition replaces Tiny5 interface text with bundled Pixelify Sans, scopes keyboard/controller focus to briefing/pause/results/picture actions, adds an in-panel Main menu, omits unnecessary short-text reading controls and hides unused desktop flight buttons. Ordinary soundtrack access keeps the qualified v1 adapter; the prepared P5 manager is explicit opt-in.

| Gate                     | Result and retained evidence                                                                                                                                                                                                                                                                                               |
| ------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Exact committed source   | Six gates passed: tests, lint, format, native format, content validation and motion-lab syntax. **2,188/2,188 tests**, no skips, failures, cancellations or todo cases. Source unchanged. `.cache/releases/verification-dfde7383440a/source-gates.json`.                                                                   |
| Independent reproduction | Fresh Git archive, tested archive and frozen archive match. All 1,269 source files match the tested tree. Archived CLI independently rebuilt **191 loose files**, all byte-identical; **187 manifest assets** and **188 ZIP members** match. `.cache/round35/revision-audit-dfde7383440a/integrity.json`.                  |
| Offline artifact         | 184 files / 56,284,432 bytes, below the unchanged 64 MiB cap. Worker, build ID and hashes agree. This checks the artifact, not installation in a browser.                                                                                                                                                                  |
| History preservation     | All 30 older release trees and 31 older tags retain their identities; the reference tag remains outside the numeric playable-version list.                                                                                                                                                                                 |
| Frozen local delivery    | Eight bounded HTTP checks against the existing frozen server returned exact audited bytes. `.cache/round35/revision-audit-dfde7383440a/http-check.json`.                                                                                                                                                                   |
| Cloud PR verification    | [Run 34727768714](https://github.com/mekhovov/revealline/actions/runs/34727768714) succeeded on Node 20.19.6 with all 2,188 tests passing. The independent local rebuild used Node 22.22.2. `.cache/round35/ci-investigation/summary.json`.                                                                                |
| PR and assets            | [PR #1](https://github.com/mekhovov/revealline/pull/1) merged, as confirmed by the release owner. [v0.26.0 GitHub Release](https://github.com/mekhovov/revealline/releases/tag/v0.26.0) contains the distribution and release metadata; historical assets were published separately. `.cache/round-35/public-assets.json`. |
| Public Pages             | [Run 34728245896](https://github.com/mekhovov/revealline/actions/runs/34728245896) **passed**. Root/versioned files match the frozen release and actual public keyboard chapter launch, flight and Pause were verified; see the public-delivery section below.                                                             |

ZIP SHA-256: `1380ab99dbf8a710013fe314ca0d3df2c6eb6bd9170536356c53468fc988cf52`. The projected Pages payload was 811,291,313 bytes for 31 playable versions; that projection is separate from deployment success. ZIPs are GitHub Release assets, preserving the playable history without duplicating each archive in Pages.

## v0.27 source: implemented behavior and presentation

**P4.5 — travelling line impacts.** First Light R3 explicitly enables the new optional Classic line-impact rule. A hostile contact with a live line seeds two authoritative fronts: one travels toward departure and expires there; the other pursues the growing player endpoint. Closing the cut before arrival clears the fronts. Arrival causes the ordinary line-hit failure. Direct body contact remains distinct. Pause stops simulation; reduced effects cannot hide the hazard. Old editions without this rule and their replay proofs retain their behavior. P4.4 remains the reference-routing workstream; it is not reassigned to this mechanic.

R3 is a separate authored three-map edition with Standard/Gentle variants and both turning policies. Its twelve ordinary-input wins preserve exact replay/checkpoint authority, with four separate impact demonstrations covering escape and loss. A real R3 unfinished cut with queued grid turn survives session save/restore and forty resumed ticks. The existing three R2 pictures are reused for comparison; they are not new illustrations and no reference-game art is copied.

**P2.9 — distinguishable enemies, pickups and defeat.** Seven enemy roles have distinct silhouettes, fixed role badges and risk descriptions across FPV, Ukraine, retro and business themes. Custom image overrides still replace the body independently; badges and contact cores remain. Cosmetic size/facing does not change collision. Four pickups use dark plates and separate heart, speed, hourglass and snowflake glyphs. Collected-powerup labels and timers read authoritative state.

Terminal loss now holds gameplay, score and replay state while showing the local defeat effect for 0.65 rendered seconds, then opens Retry/Main menu. A fresh keyboard/controller command or pointer activation can choose **Show defeat menu** immediately. Held Confirm cannot flow into Retry. Focus loss or Pause holds the presentation; returning focus cannot resume gameplay. Reduced effects preserve the explanation. Labels are **CRAFT LOST** for FPV, **LIFE LOST** for Ukraine/retro and **LINK LOST** for business, each annotated **−1 LIFE**. Nonterminal recovery continues to use actual simulation time.

**Enemy workshop.** `/authoring/enemy-catalog/` exposes the seven roles, four presentation families and three detail treatments. Local choices can be saved, reloaded and transferred as bounded JSON. Enable/disable is for future generation; it never removes an actor from an existing rated run. Try selected role opens a newly validated practice scenario. All 28 role/theme studies execute ordinary input in tests; that is not a claim of 28 campaign wins. The dedicated Return to workshop action restores the same unsaved draft through a validated parent/child boundary; actual keyboard return and modeled controller neutrality passed.

The first First Light edition remains in distribution and as an optional download; it is excluded from automatic core offline preparation to preserve the cap. R2/R3 stay distinct. Nine installed pack envelopes total 57,606,330 bytes and exceed the 48 MiB installed-library limit; the app must explain that limit and require explicit removal after backup. It does not raise the limit or silently evict packs. Read-only aggregate proof inspection has a separate 64 MiB bound.

## Source-browser observations

The release owner performed these journeys in the actual in-app browser. They are source-build observations, separate from the modeled tests and pending exact v0.27 freeze.

| Journey                            | Observed result                                                                                                                                                                                                 |
| ---------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Impact demonstration, no Boost     | Ordinary Down produced travelling-front loss. The visible **CRAFT LOST · −1 LIFE** cue and **Show defeat menu** appeared before Retry.                                                                          |
| Retry after that loss              | Fresh attempt retained the imported demonstration's **45% target and one life**. An earlier apparent scenario replacement did not reproduce on a fresh browser journey; no production Retry fix was justified.  |
| Impact demonstration, Boost Toggle | Settings selected Boost Toggle; ordinary Down with Boost won at **50% revealed, 11,900 score and a displayed two seconds**. That display is rounded; it is not a newly measured exact completion time.          |
| Workshop                           | Four theme previews were inspected. A real rover practice run collected a life pickup, earned a fourth life and showed the enemy-slow effect chip.                                                              |
| Results layout                     | 320×568, 390×640, 844×390 and 1280×720 CSS viewports had no document overflow. Actions used 16 px text in the narrow portrait layouts and 18 px in the wider layouts; nominal action height was at least 44 px. |

The raw result-layout readings are in `.cache/round-35/browser/results-layout.json`. Phone-layout measurements report 43.997 CSS pixels after browser rounding for a nominal 44 px target; larger layouts were approximately 48 px. These are desktop browser viewport checks, not measurements on physical phones or proof of touch comfort.

## Focused verification and corrections

These passing runs overlap. **Do not add their counts together or substitute them for a final exact-source gate.**

| Scope                                  | Passing evidence                                                                                                                                                                                                                                                                               |
| -------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| v0.26 navigation                       | 164 affected tests, including 10 actual-host journeys. Initial terminal failures and corrected expectations retained in `.cache/round-35/terminal-navigation/`.                                                                                                                                |
| Optional impact core and compatibility | 218 affected tests, including 22 new core/replay/session cases. Nineteen protected old pack/proof records retained their bytes. `.cache/round-35/line-impact/core-check/verification.json`.                                                                                                    |
| R3 routes, transport and integration   | 161 affected tests, separate 47 offline/CLI checks and 13 final landing checks. Six R3 route/transport/session tests include the added exact queued-turn session case. `.cache/round-35/r3-integration/verification.json`.                                                                     |
| Catalog and presentation               | 78 affected checks: strict choice documents, role/theme studies, custom-art precedence, pickup glyphs, event coordinates, authoritative impact positions and menu input ownership. `.cache/round-35/enemy-presentation/verification.json`.                                                     |
| Terminal defeat                        | 85 affected checks, including eight new real app/core/renderer cases for four themes, focus/reduced effects, held-input barriers, explicit Pause/skip and nonterminal recovery. Scoped lint/format and animation-skill validation passed. `.cache/round-35/terminal-defeat/verification.json`. |
| Imported practice Retry                | Two policy-specific actual-host checks execute native pointerdown/up/click on Retry, preserve the full level, one life, 45% target and storage, and export a replay that verifies. `.cache/round-35/practice-retry/verification.json`.                                                         |

Independent read reviews found and closed the stale R2 subtitle in R3, missing R3-specific session coverage, native-input/held-pad arbitration in the workshop and parent/iframe polling isolation. Review also identified and closed the workshop-return gap. The original R3 files before the subtitle correction remain in `.cache/round-35/line-impact/r3-before-subtitle-fix/`. The first defeat test failures were invalid authored fixture envelopes; corrected fixtures use the genuine Classic practice route, without patching live state.

## Remaining gates and next priorities

1. Run all six gates against the corrected exact v0.27 candidate; workshop return and independent source review have passed.
2. Freeze v0.27, independently reproduce it, preserve every old release/tag, and inspect the frozen player and workshop journeys. Append source/artifact hashes and browser evidence here.
3. Follow the completed v0.26 PR, release and public-identity workflow for v0.27. A merged PR or uploaded ZIP alone is insufficient.
4. Reassess the chapter with human play feedback before expanding artwork volume. Automated wins establish reachability and correctness, not challenge quality or enjoyment.
5. Resume the remaining P3 binary-download/reimport check and P4 Tactical work; then P5 image/video authoring, P6 content production and P7 device/performance qualification. P5 shared storage has model evidence but real-browser migration and full media journeys remain open. Native stores and network multiplayer remain P8/P9.

Physical controllers, actual phones/Steam Deck, OS file-picker behavior, sustained 60 fps, complete MP3 backup restoration in the browser, reference audio listening, full asset targets and optional video victories are not accepted by this report. No new full-release, public v0.27, hardware or human-fun claim is made.

## Final source integration before freeze

The scoped workshop return is complete: 112 affected tests pass, including three new boundary/controller cases. Independent review passed. Root then used actual browser keyboard Start → Escape → Down through Main menu → Return to workshop; the original unsaved Territory eroder / Ukraine choice was preserved. Origin/source/token validation rejects unrelated and stale messages. First Flight retains its existing scrollable page layout.

All 13 AI skills validate, 146 prompt IDs are unique, and the four new enemy/impact/feedback templates render with supplied values. Templates are instructions, not newly generated art. The title launches First Light R3 through the real pack picker; a live Orchard Window flight and loss were inspected. An earlier apparent practice Retry mismatch was not reproduced: two additional host regressions and a fresh browser retry retain the exact 45%/one-life impact scenario. No speculative production change was made.

## v0.26 public delivery confirmed

[Main deployment 34728245896](https://github.com/mekhovov/revealline/actions/runs/34728245896) completed successfully. Root fetched the public release manifest, build identity, app, typography CSS and versioned HTML/manifest; all six HTTP200 bodies match the frozen files byte for byte. A second reviewer independently checked six root/versioned HTML, CSS and controller-module bodies. Root then launched Orchard Window and used keyboard flight → Escape → focused Resume on [the public game](https://mekhovov.github.io/revealline/game/). Raw checks: `.cache/round-35/public-v026.json` and `.cache/round36/public-v026/asset-check.json`.

## Superseded v0.27 candidate

Commit `f5788375efbd4c4535a3198d398213a0a87bf606` passed five gates and 2,256 of 2,257 tests. The remaining regression expected the old R2 featured chapter while the native title correctly selected R3. This candidate was neither frozen nor tagged. Its complete immutable gate log remains `.cache/releases/verification-f5788375efbd/source-gates.json`; a corrective commit must pass all gates before publication.

## Final v0.27 source and artifact gate

Source `562fc867c7aa64ffe727f55a561a6531371f0f47`; annotated tag object `7c03c06a0f4d15af31b0bbd2a6fa4e3a44c5ab18`. All six gates passed with **2,257/2,257 tests**, no skipped/cancelled/todo cases. Gate record `.cache/releases/verification-562fc867c7aa/source-gates.json` SHA256 `cf34e2c1f4af685d1bf5ceb649a00cce7ae8b0be1d963f222c765224e6b1a5e2`.

Independent rebuild matched all1,295 source files,200 manifest assets,201 ZIP members and204 loose files. All31 prior release trees and32 prior tags were unchanged. Offline core:196 files /56,440,182 bytes; onlyR1 is optional, with its original bytes still covered by the full manifest/ZIP. Eight frozen-server HTTP responses matched, including R1, R3 and the workshop. Audit `.cache/round36/revision-audit-562fc867c7aa/integrity.json` SHA256 `bcb99639ad4afaa5b9e4da2a6ad8f85d78e2ea3bb9ab1fedccfdd27ac6d29777`.

Source TAR: `cb20dfdb50f8d55d32133b6d4712b5629c43c31bc6cb50fa53c490f86e6ce02e`. ZIP: `7a53bc4677c7cbf4f0266ec78990464bf3300583d1d131931677af7e94b77878`. Manifest: `054ee636a6d98723f813bbcc81fae70bc03a0f7bed1b6d38ef0f8dde64e4d6c4`. The first archived-CLI invocation used its cache directory as root and failed before freezing; exported `releaseSnapshot` with the explicit workspace root produced the successful artifact. The failed candidate and invocation are retained separately; no historical artifact was replaced.

Root opened the frozen v0.27 title, launched R3 Orchard Window with its65% target and impact briefing, and loaded the packaged enemy workshop. The source training check at320×640 also confirmed expanded lesson instructions remain scrollable and Return to the game works.

Live delivery evidence belongs to [PR#2](https://github.com/mekhovov/revealline/pull/2) and the [v0.27 GitHub Release](https://github.com/mekhovov/revealline/releases/tag/v0.27.0); completion requires successful Pages deployment and public byte/browser checks, as withv0.26. This source/artifact report does not substitute for that external gate.
