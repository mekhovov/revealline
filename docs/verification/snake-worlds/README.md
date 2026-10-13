# Snake world foundation — 13 October 2026

This is the first reviewable visual slice of the approved 96-mission expansion, rebased onto `main` at `e5dce34d35b0f7bca81c95f54e27fba9b8e6cacd` (including the FPV library update that merged during verification). It does **not** complete P0 or either gameplay release.

## Delivered

- Lively FPV / Living Circuit is the fresh-profile board default. Saved choices and explicit links win. Game Theme and Retro Field remain available.
- The existing appearance picker adds Toybox, Atmospheric Ruins and Night Arcade. The existing scene picker retains `auto/orchard/workshop/relay` and adds `freight/harbor/quarry`. All player-facing labels have English and Ukrainian copy.
- Every existing chapter (23) has explicit cosmetic scene, mood and floor-zoning metadata. Official chapter assignment no longer falls back to ID hashing. The catalogue remains 144 missions.
- Six initial world material/structure families: greenhouse foundations, freight containers, copper machinery, observatory equipment, harbor pumps and garden masonry. Connected obstacles receive a single clipped structure specimen and continuous external rim. Holes, diagonal passages and removed wall cells remain open. Floor contrast is reduced.
- Toybox adds timber/enamel framing and fittings; Ruins adds masonry, cracks and planting; Night Arcade adds dark panels and luminous inlays. This is a first art pass, not final art approval.
- Live Solo/Team/Versus boards, result recordings and selector previews use the same renderer. Previews honor the selected look and scene instead of forcing Retro. The shared selector still owns scrolling, focus and preview visibility.
- Game Theme previews request their own accepted chapter artwork through the existing presentation provider without replacing the live attempt. Provider-derived preview textures use a bounded 16-entry LRU; creator-owned artwork remains authoritative. Hidden previews release their canvases.
- All new looks retain enemy concealment during jamming, including effects/remains. Cosmetic metadata is outside gameplay recipes and proof identities.

## Review surface

Serve the repository and open `game/test/manual/snake-world-gallery.html`. The gallery compares four looks on six real mission boards: open, dense, wrapping, jammer, shutters and Team. It includes a title-hiding control, narrow-board layout and synchronous redraw measurement.

The jammer example replays a retained verified journal to its active burst using the production engine. The gallery writes no progress, awards or player preferences. Source: `snake-world-gallery.mjs` alongside the HTML.

The original modular structure drawing is authored in `game/snake/classic-scenes.mjs`; material pixels come from the existing shared industrial material generator. No downloaded assets, new artwork registry, texture downloads or generated binary assets were introduced. Perimeter scenery remains an earlier composition and still needs a dedicated polish pass.

## Verification actually performed

- 163 tests (132 world/host regressions plus 31 presentation/audio boundary checks): world/default preference regression, connected-cell geometry, all-theme concealment, selector parity, archived recipes, accepted artwork ownership, host controls and paused appearance changes.
- 34 offline lifecycle / installation / core-tools boundary tests.
- Targeted lint, formatting and localization check; generated shared FPV play-shell check remained byte-identical.
- Browser: 24-board desktop comparison; 320×640 gallery plus Ukrainian Team result replay and mission selector; 640×320 English Versus settings/selector. Observed no horizontal overflow (320/320 and 640/640 page/viewport widths). Retry/Home remained available on the narrow result panel. Changing look/scene returned through settings to Pause.
- Local desktop synchronous redraw sample, 120 paints per group: Game Theme median 0.10 ms, p95 0.20 ms; world treatments median 0.50 ms, p95 0.80 ms. This is renderer CPU time on this desktop/browser, not a mobile frame-rate or GPU benchmark.
- Material cache coverage: all six scenes × four looks × two roles × four variants reuse 192 32×32 surfaces (0.75 MiB). Backdrops have 24 bounded keys; counting even their transient 384×288 canvases gives 10.875 MiB combined pixel area. No full-board terrain image cache was added; the established receiver buffers remain separate.
- Disk preflight: about 2.8 GiB available before edits, about 2.5 GiB at final check. No user files, worktrees, commits or caches were deleted. No full distribution build was attempted.

Not established: physical phone/controller performance, grayscale recognition study, user-rated beauty/fun, a full offline release artifact, or the planned new-mission proof matrix.

## Subsequent progress

The [continuous-operations prototype slice](../snake-operations/README.md) now implements four of the eight P0 prototypes (staged objectives and cargo), with exact recordings and a playable review lab. Switchyards and cable plates remain next. The table below records the original visual-slice boundary; see that report for the current completion detail.

## Remaining plan and recommended order

| Priority       | Work                                                                                                                                                 | Why it matters / risk of deferral                                                                                                                           |
| -------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| P0 next        | Eight playable v5 prototypes: staged objectives, cargo/delivery, junction switches and cable plates, with their state cues and explicit Mission Race | Validate accepted movement, Team outcomes and tail/gate boundaries before multiplying content. Shipping content first risks repetitive or unsound missions. |
| P0 next        | Review and refine this visual standard, including open boards and perimeter treatment                                                                | Connected specimens are a foundation, not bespoke compositions. Without review, 96 additional boards could still feel interchangeable.                      |
| P1             | Complete the 144-mission keep/revise audit; author mission-specific landmarks and route-focused composition                                          | Chapter-level metadata alone does not give every mission a unique tactical decision. Preserve old recipes/proofs whenever gameplay changes.                 |
| P1             | Essential state animation and visual feedback for cargo, delivery, switches, plates/gates, erosion and chapter victory                               | Players need to understand why a route or snake length changes. Decorative motion can wait; state clarity cannot.                                           |
| P1             | Release A: 48 missions in Switchyard Pursuit, Cable Foundry, Loaded Routes, Split Horizons, Crossfire Works and Extraction Circuit                   | Delivers meaningful new decisions after prototypes are validated, rather than inflating quotas or mirroring routes.                                         |
| P1 per release | New and revised mission proofs, multiple hazard seeds, capacity/import compatibility, full offline packaging, physical-device/input testing          | The existing renderer regressions do not qualify new simulation mechanics or guarantee solvability.                                                         |
| P2             | Release B: remaining 48 missions; distinctive art across all world/look combinations; ambient polish                                                 | Completes breadth and progression after Release A supplies playtest evidence. Deferral reduces variety but does not block the first coherent release.       |

No new gameplay recipes, ratings thresholds, enemy statistics semantics, simulation clocks or transition controller were changed in this slice. Existing 5.2-second victory celebration and five-second cancellable continuation remain owned by the shared flow.
