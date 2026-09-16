# P17 community workflow preparation audit

Reviewed 16 September 2026 against accepted source `0684ddbfe978e95f2b6ddcd02b4f9e0f70a4190d`. Read-only source/document inspection with an independent peer. No commands below were executed in this slice, no browser journey ran, and no runtime/source release changed. P17 remains queued; this is preparation for the approved phase and its dependencies.

## Five actionable guide corrections

| Priority | Finding and source | Correction and phase owner |
| --- | --- | --- |
| High | `docs/library-and-packs.md:198` and `authoring/skills/xonix-expansion-author/SKILL.md:22` recommend `verify-packs.mjs --discover`. In the current code, `scripts/verify-packs.mjs:602–606` first inspects the Arcade index; `55–69` selects R3/R4, while `590–600` refuses nonlegacy engines. It therefore refuses before generating routes for the current inventory. The CLI at `639–641` also has no arbitrary `--pack` selector. | P17: replace the current creator instruction with supported structural inspection and deliberate authored-route verification; keep historical discovery evidence labelled. Do not weaken the engine guard or imply an arbitrary map search exists. |
| Medium | `docs/library-and-packs.md:95` lists runtime pack v1/v2; `authoring/README.md:114–116` and Expansion Author stop at v3. `game/packs.mjs:26–30,105–162` accepts v1–v5 with exact pairs from `game/core/versions.mjs:3–26`. | P17/P06: publish the current compatibility table below and distinguish reader support from eligibility in a particular mode/catalogue. Preserve historical templates. |
| Medium | `docs/presentation-system.md:77` says historical/unselected originals are omitted from compiler output. `scripts/compile-presentation.mjs:51–56` writes all retained file records, and line84 emits complete `studio.json`; only runtime URL bindings remain selected. `scripts/release-catalog.mjs:69–79` copies the complete compiled inventory. | P04/P17: document selected runtime bindings separately from retained compiler/Studio bytes; measure complete bundle, compiled inventory and offline dependencies. Do not budget only the active palette/body set. |
| Medium | `docs/authored-art.md:74` describes previously earned pictures resolving the currently installed image. Current `docs/presentation-runtime.md:17,23` describes saved pins and first-earned receipts retaining exact originals. | P06/P17: explicitly label the old Workshop 1.1.0 procedure as legacy/receipt-free. Teach fresh-attempt replacement separately from saved/earned preservation and test both. Do not rewrite the old observation or migrate pins implicitly. |
| Medium | `docs/presentation-pins.md:11–13` still describes ordinary gameplay/Collection adoption as a future milestone, despite the accepted runtime integration documented in `docs/presentation-runtime.md:9–27`. | P17: add a current integration pointer and mark the original API checkpoint/evidence as historical; avoid instructing community creators to implement an already adopted milestone. |

The authoring entry point correctly labels its v0.21 inventory as historical. That explicit historical section is not itself a defect. A new current end-to-end community guide should route creators around the five stale instructions above rather than remove old examples or change their provenance.

## Supported transport boundaries at the inspected source

| Transport | Exact runtime relationship | Creator implication |
| --- | --- | --- |
| `xonix-pack.v1` / `.v2` | `xonix-core.v2`, `xonix-level.v1`, `xonix-replay.v3`; v2 adds masteries | Existing legacy-compatible Solo content; validate actual mode eligibility. |
| `xonix-pack.v3` | `xonix-core.v3`, `xonix-level.v2`, `xonix-replay.v4` | Encounter format, required empty `masteries`. |
| `xonix-pack.v4` | `xonix-core.v4`, `xonix-level.v3`, `xonix-replay.v5` | Wide format, required empty `masteries`. |
| `xonix-pack.v5` | `xonix-core.v5`, `xonix-level.v4`, `xonix-replay.v6` | Classic format, required empty `masteries`. |
| `revealline-coop-pack.v1` | `revealline-coop.v3`; strict `revealline-coop-level.v1`; 72×36, 2 players | Separate Team pack, at most24 unique levels/1MiB JSON; no imported media or arbitrary extra fields. |
| `.rltheme` / `revealline-theme-bundle.v1` | Presentation slots, exact revisions/history and registered recipes | Separate from campaigns/simulation; Studio upload/export alone does not publish or install a gameplay pack. |
| Historical authoring draft schema | Python draft-pack validator | Not an automatic runtime compiler. |

`game/coop/recipes.mjs:300–306` rejects unknown fields. The planned versioned Team presentation envelope must be implemented and qualified under P04/P06/P08-A before a guide can advertise custom Team art imports. Keep current co-op objects strict. Presentation bundles retain a4MiB metadata/32MiB transfer ceiling; full multi-edition artwork must be measured, not assumed to fit. Do not create four copies of every retained revision merely to apply four names.

## Existing small-example path to qualify in P17

1. Start a fresh supported source workspace at its pinned release; use a fresh browser profile and a separate source/output directory. Record the community identity, mission framing, supported modes, exact format/engine pair, artwork owners, palette/font decisions and source/rights metadata.
2. For a small Solo example, serve with `node scripts/game-cli.mjs serve --port 8768`, edit a scenario in Playground and use **Export map as expansion**. Inspect the output with `node scripts/game-cli.mjs inspect-goals --pack candidate.json`. This is structural validation, not full image decoding, a winning route or balance proof. Install through **Expansion packs → Install a pack file** for the ordinary preparation/decoding path. Later P03/P06 may change those labels; update the final guide to the released UI.
3. For a separate Team example, `node scripts/build-coop-pack.mjs --template coverage --id community-orchard --name "Community Orchard" --out .cache/community-orchard.pack.json`, then `node scripts/build-coop-pack.mjs --validate .cache/community-orchard.pack.json`. Open **Play a created co-op pack**. Keep source recipe and compiled pack; current imports are memory-only. Reimport restores content, not a persistent co-op saved flight.
4. For branding, use the actual Studio upload/edit/stage/save/export path. Compile with `node scripts/compile-presentation.mjs --bundle candidate.rltheme --out .cache/community-presentation`; the output directory must be new. Review all affected modes/states after the required cross-mode framework ships. Registered recipes cannot be replaced with executable bundle payloads.
5. Preserve the gameplay pack, `.rltheme`, authoring sources, effective prompts and original assets separately. Game-data JSON includes embedded pack art, but managed originals and uploaded music have separate `.rlmedia`/`.rlsound` recovery paths. Restore required originals before a saved pinned flight; include import failure, Undo and old/new earned-picture checks. Do not call a partial JSON export a complete asset backup.
6. P17 acceptance must perform this independently in a fresh workspace through real install, first capture, retry, completion, exported-byte reread and fresh-profile recovery. No private maintainer fixture or state injection should substitute for the documented creator/player path. Attach the eventual exact source, version, frozen assets and public/offline evidence; modeled input, browser actions and hardware remain distinct.

These steps are inspected viable entry points, not a claim that the complete cross-mode example already passes. P04/P06/P08-A remain dependencies for the final unified experience.

## Refreshed community research and implications

Official pages read on16September2026:

- [DroneAid Germany](https://drone-aid.de/) describes electronics/soldering workshops and donations to humanitarian organisations for delivery, demining and evacuation.
- [DroneAid Netherlands](https://drone-aid.nl/en) emphasises technical skills for veterans/civilians and describes reconnaissance/intelligence support as well as broader humanitarian missions.
- [DroneAid Portugal](https://drone-aid.pt/en) describes community participation, assembly education, flight testing and reconnaissance support.
- The direct France URL was unavailable to the research tool; no content or brand claim is inferred from that failure.

Design inference: the community template should hold a specific mission brief and explicit Support/Combat framing, rather than flatten every regional chapter into one combat story. Workshop equipment, collaboration and return-to-community scenes are suitable original-art subjects for a Support example. Gameplay labels must still describe implemented rules; thematic text cannot manufacture mechanics. This text research does not establish exact brand colours, typography, logo animation rights or Canva/Drive asset fidelity. The supplied brandbook and logo originals remain separate production inputs to inspect and bind before P12 publication.

## Suggested guide prompt

> Create a small community example against the named accepted Reveal Line source. Select an existing supported gameplay format and explicit mode eligibility, and keep its campaign identity separate from the presentation collection. Use only implemented rules, with clearly labelled Support or Combat framing. Produce one original reveal image and the required branded UI/actor variants through Asset Studio; preserve original files, exact revisions, full prompts and provenance. Document every actual UI/CLI step. Validate, install, play, export, reread and restore through ordinary controls in a fresh workspace. Preserve old saved/earned pins, show recoverable failures, and report byte, gameplay, browser and physical-device evidence separately. Do not advertise a Team art envelope, arbitrary route generator or automatic public deployment before those capabilities are implemented and qualified.
