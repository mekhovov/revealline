# Round 35 — readable menus and First Light R3

Evidence snapshot: 2026-09-13. **v0.26.0 is frozen, audited and published as a GitHub Release; v0.27 changes are undergoing qualification in source.** The v0.26 Pages run was still running at this snapshot. A source-browser success is not evidence that those new changes have reached the public site.

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
| Public Pages             | [Run 34728245896](https://github.com/mekhovov/revealline/actions/runs/34728245896) was **still running** when this snapshot was prepared. Successful deployment, root/versioned identity comparison and public browser play must be appended before P7.4 is complete.                                                      |

ZIP SHA-256: `1380ab99dbf8a710013fe314ca0d3df2c6eb6bd9170536356c53468fc988cf52`. The projected Pages payload was 811,291,313 bytes for 31 playable versions; that projection is separate from deployment success. ZIPs are GitHub Release assets, preserving the playable history without duplicating each archive in Pages.

## v0.27 source: implemented behavior and presentation

**P4.5 — travelling line impacts.** First Light R3 explicitly enables the new optional Classic line-impact rule. A hostile contact with a live line seeds two authoritative fronts: one travels toward departure and expires there; the other pursues the growing player endpoint. Closing the cut before arrival clears the fronts. Arrival causes the ordinary line-hit failure. Direct body contact remains distinct. Pause stops simulation; reduced effects cannot hide the hazard. Old editions without this rule and their replay proofs retain their behavior. P4.4 remains the reference-routing workstream; it is not reassigned to this mechanic.

R3 is a separate authored three-map edition with Standard/Gentle variants and both turning policies. Its twelve ordinary-input wins preserve exact replay/checkpoint authority, with four separate impact demonstrations covering escape and loss. A real R3 unfinished cut with queued grid turn survives session save/restore and forty resumed ticks. The existing three R2 pictures are reused for comparison; they are not new illustrations and no reference-game art is copied.

**P2.9 — distinguishable enemies, pickups and defeat.** Seven enemy roles have distinct silhouettes, fixed role badges and risk descriptions across FPV, Ukraine, retro and business themes. Custom image overrides still replace the body independently; badges and contact cores remain. Cosmetic size/facing does not change collision. Four pickups use dark plates and separate heart, speed, hourglass and snowflake glyphs. Collected-powerup labels and timers read authoritative state.

Terminal loss now holds gameplay, score and replay state while showing the local defeat effect for 0.65 rendered seconds, then opens Retry/Main menu. A fresh keyboard/controller command or pointer activation can choose **Show defeat menu** immediately. Held Confirm cannot flow into Retry. Focus loss or Pause holds the presentation; returning focus cannot resume gameplay. Reduced effects preserve the explanation. Labels are **CRAFT LOST** for FPV, **LIFE LOST** for Ukraine/retro and **LINK LOST** for business, each annotated **−1 LIFE**. Nonterminal recovery continues to use actual simulation time.

**Enemy workshop.** `/authoring/enemy-catalog/` exposes the seven roles, four presentation families and three detail treatments. Local choices can be saved, reloaded and transferred as bounded JSON. Enable/disable is for future generation; it never removes an actor from an existing rated run. Try selected role opens a newly validated practice scenario. All 28 role/theme studies execute ordinary input in tests; that is not a claim of 28 campaign wins. A dedicated controller return from the child practice to the original workshop draft is still being integrated at this snapshot.

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

Independent read reviews found and closed the stale R2 subtitle in R3, missing R3-specific session coverage, native-input/held-pad arbitration in the workshop and parent/iframe polling isolation. Review also identified the workshop-return gap now being addressed. The original R3 files before the subtitle correction remain in `.cache/round-35/line-impact/r3-before-subtitle-fix/`. The first defeat test failures were invalid authored fixture envelopes; corrected fixtures use the genuine Classic practice route, without patching live state.

## Remaining gates and next priorities

1. Complete and verify the workshop return flow, finish the bounded v0.27 integration review and run the six gates against one exact committed candidate.
2. Freeze v0.27, independently reproduce it, preserve every old release/tag, and inspect the frozen player and workshop journeys. Append source/artifact hashes and browser evidence here.
3. Close v0.26 public Pages verification, then follow the same reviewed PR, release and public-identity workflow for v0.27. A merged PR or uploaded ZIP alone is insufficient.
4. Reassess the chapter with human play feedback before expanding artwork volume. Automated wins establish reachability and correctness, not challenge quality or enjoyment.
5. Resume the remaining P3 binary-download/reimport check and P4 Tactical work; then P5 image/video authoring, P6 content production and P7 device/performance qualification. P5 shared storage has model evidence but real-browser migration and full media journeys remain open. Native stores and network multiplayer remain P8/P9.

Physical controllers, actual phones/Steam Deck, OS file-picker behavior, sustained 60 fps, complete MP3 backup restoration in the browser, reference audio listening, full asset targets and optional video victories are not accepted by this report. No new full-release, public v0.27, hardware or human-fun claim is made.

## Final source integration before freeze

The scoped workshop return is complete: 112 affected tests pass, including three new boundary/controller cases. Independent review passed. Root then used actual browser keyboard Start → Escape → Down through Main menu → Return to workshop; the original unsaved Territory eroder / Ukraine choice was preserved. Origin/source/token validation rejects unrelated and stale messages. First Flight retains its existing scrollable page layout.

All 13 AI skills validate, 146 prompt IDs are unique, and the four new enemy/impact/feedback templates render with supplied values. Templates are instructions, not newly generated art. The title launches First Light R3 through the real pack picker; a live Orchard Window flight and loss were inspected. An earlier apparent practice Retry mismatch was not reproduced: two additional host regressions and a fresh browser retry retain the exact 45%/one-life impact scenario. No speculative production change was made.
