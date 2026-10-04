# Immutable industrial chapter environments

**Status:** cache draft implementation, not committed-source or public delivery. The corrected overhead artwork was already approved; this batch still requires final source/package checks and chapter/device qualification. See [the P2 review and qualification plan](industrial-environments-qualification.md).

This batch binds the approved `industrial-roster-v3` materials to the existing 14 Living Routes chapters. It adds no missions, actors, damage rules, geometry, difficulty changes or new texture revision. The four wear variations remain restrained; chapters differ through their material combinations.

## Scope

- Four Capture chapters, six Team chapters, two Classic Snake chapters and two native SIM chapters: 84 existing layouts.
- Six current native pursuit courses reuse the two SIM chapter kits. Historical Refuge/Meeting r1 courses are not relabeled as their current r2 successors.
- All six existing material families are used: concrete, earth, metal, masonry, timber and damaged surfaces.
- Existing role meanings remain authoritative. A timber wall still blocks; masonry is a finish, not a new SIM physics role. Full opaque terrain pixels preserve Capture concealment; functional hazard markers remain a renderer responsibility above this art.

## Admission and ownership

`game/presentation/industrial-environments.mjs` prepares an opaque candidate only after hashing the complete native source against the registered engine, mode, catalogue identity and source form. Capture forms explicitly distinguish compiler policy and difficulty. Snake sources precede pace/remix preparation. SIM uses validated native courses and exact retained pack identities.

`acceptIndustrialEnvironment` synchronously admits a candidate only with the exact Military Field r1 collection and roster-v3 art revision. `validateIndustrialEnvironmentPin` returns structural data, not permission to draw. Only a newly accepted or restored branded pin can be passed to `resolveIndustrialEnvironment` and the terrain adapter.

Old missing/null pins remain absent. A non-null unknown, malformed or mismatched saved pin is rejected. Restoring never silently selects the latest kit. The producer rejects removed sources, changed hashes at an existing source/form identity, definition changes and reinterpreted room preparation rows. Future revisions must retain previous exact rows and source resolution.

Private room admission hashes the entire locally known native prepared level against registered catalogue/mode forms. Network labels alone cannot authorize an environment. The current table covers 276 distinct accepted room source forms and 756 native pace/target preparations.

The Capture/Snake Arcade adapter still requires the original registered builtin asset ID **and** approved hash. Uploaded or Company artwork is retained. Native SIM bindings apply only to native procedural environment roles; imported mesh material ownership and required opaque coating are separate contracts.

## Studio packages and budgets

The review inventory is `authoring/industrial-art-review/environments-v1/inventory.json`. All links and package paths in it are repository-relative. Capture links open the relevant collection so the player selects a mission; Snake links select the actual level; SIM uses the existing `snake-course` entry. Native SIM flight mode remains an explicit cockpit/menu selection, not an invented URL parameter.

Fourteen separately downloadable native `.rltheme` packages use existing full-theme import semantics. Each package contains a complete baseline theme limited to the actual published Studio's 335-slot contract, with three new terrain raster bindings; importing it is an explicit full-theme selection, not an automatic partial patch over personal artwork. Runtime chapter adoption does not install these packages or change custom/Company assets.

The corrected batch totals 13,837,091 package bytes, at most 3,072 decoded raster bytes per chapter, and a 330,026-byte runtime admission data module. The shared admission logic is 9,240 bytes. The 3,072-byte figure measures the three new raster payloads, not full page/GPU memory. Review package metadata is not part of the optional native runtime payload. Existing file/transfer limits remain in force; no budget is raised by this batch.

## Evidence boundary

The producer verifies native export/import/re-export byte identity and adoption into the actual compiled Studio workspace for every package. Regression coverage also loads its published original assets and verifies the complete merged asset table, while confirming unsupported source-only Retro picture slots remain rejected. The earlier self-roundtrip against the broader 389-slot source registry missed this incompatibility and is not evidence of browser import compatibility. Regressions cover all 600 registered source rows, complete-source mutations, custom ownership, asynchronous cancellation, branded authority, historical absence, mismatch rejection, all six materials at real play sizes and adapter cache retirement.

These checks prove software admission and deterministic pixels. They do not substitute for the remaining actual-device, chapter play/readability, simultaneous-board or human visual qualification. Host/Studio integration and complete committed-source/package checks must run after this draft is applied; cache-loader test results are not delivered-source evidence.

Accepted collection, art revision and environment remain pinned through Retry/Continue and supported session restoration. Settings apply to a new attempt. Modern Snake uses chapter terrain textures; Retro Field deliberately keeps its green board and wall treatment. No new material choices are injected into creator-owned assets or physics roles.
