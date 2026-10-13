# World composition and state reactions

## Implemented

- All 240 official missions have literal cosmetic briefs: floor composition, focal coordinate, structure family, ambient equipment and landmark identity. The 35 chapter moods remain outside gameplay recipes and random streams. Open Loop remains obstacle-free.
- Floor inlays include orchards, dispatch forks, passing bays, oval courses, stepped terraces, seams, islands and courtyards. Existing blocked cells carry planters, irrigation assemblies, cranes, containers, coolant islands, boiler housings, antenna foundations, observatory shelters, pumps, floodgates and masonry terraces.
- Lively FPV, Toybox, Atmospheric Ruins and Night Arcade share exact occupied footprints with different materials, fittings, damage and illuminated details. Explicit scene choices use their selected world's equipment. Game Theme supports connected structures when its provider exposes the built-in wall asset; creator-owned walls remain authoritative. Retro Field keeps its minimal solid and state patterns.
- Catch/erosion fragments, loading emphasis, dock transfer and switch-link pulses observe accepted state only. Gate panels reflect collision state immediately. One sparse installation per board supplies fan/water, foliage, windsock or equipment-light motion and a victory acknowledgement. Existing actor facing/gait and jammer-source phases remain in the shared renderer.
- Enemy catches and erosion particles do not reveal positions during interference. Reduced effects removes cosmetic motion/particles; cargo, docks, links, gates and source/danger information remain immediate. Live, preview and compact replay use the same renderer; replay supplies its own frozen simulation-time projection.
- Static terrain uses a 4 MiB shared LRU. Eviction explicitly releases backing stores. Appearance, material revision, terrain removal, creator asset identity and loaded image size invalidate it. Gates, enemies, cargo, sources and live interference are drawn outside the cache. The 192 material tiles remain bounded, the 24 perimeter encodings use 256×192 pixels and release their temporary canvases, and only three receiver buffers are retained. The conservative combined pixel maximum is 15.11 MiB.

All new structure details and reactions are original procedural pixel artwork. They reuse the existing shared industrial material provider and actors; no external image downloads or competing artwork registry were introduced. Art-only changes do not revise recipes or invalidate proofs.

## Verification

- 306 complete Snake regressions pass, including the 576 expansion proof/storage matrix, true profile-capacity boundaries and aggregate render-cache checks.
- Browsing all 240 missions releases old terrain within 4 MiB. Paused appearance changes, erosion and asynchronously loaded creator artwork refresh the cache. Rendering does not mutate a recipe or run.
- Real-browser comparison includes open, dense, wrapping, jammer, shutter and Team boards across all four looks. Collision outlines and grayscale controls are available in `game/test/manual/snake-world-gallery.html`.
- Final before/after comparison uses committed previous main and the final renderer through the same six-board harness. Desktop median was 0.40 ms before and about 0.10 ms after; 320px median was 0.30–0.40 ms before and 0.10 ms after. Every paired sample, including baseline p95 spikes and timer-resolution limits, is retained in `renderer-baseline.json`. These are synchronous CPU redraw measurements, not display frame rate or physical-phone performance.
- Mobile comparison has no horizontal document overflow at 320px; each card contains a 278×208.5 board. Production boards retain their larger existing responsive footprint.
- 42 optional installation/offline/distribution tests pass. An earlier full distribution build completed with 3,259 files; its receipt is retained in `build.json`, with its working-tree limitation stated. Only this task's generated output was removed afterward to recover space.

- A subsequent clean committed-source distribution at `d55b9b83f8f3ec014b9d777a66984b0a23e6433f` completed with 3,262 files. See `committed-build.json` for hashes and the explicit distinction between independently recorded source identity and the null embedded development-build revision.

## Acceptance boundaries

The code, content and automated evidence do not establish player-rated fun, unaided recognition by new players, or physical phone/controller performance. Those require observing people and hardware that this environment cannot substitute. The gallery, operation lab and per-mission tactical audit are provided for that review. No universal jammer grading or subjective visual acceptance is claimed.

The user skipped the final player review on 14 October 2026. It is not a remaining implementation gate. Physical-device measurements remain unperformed and are not represented as passes.

The final independent audit added pause-aware terminal effect lifetimes, static authored floor lighting, real records-capacity fallback and aggregate memory accounting. The final 3,262-file distribution embeds source commit `c636724b368cc60063482b5b4c8da0e62af3df3a`; see `audited-build.json`. Earlier build receipts remain historical evidence.
