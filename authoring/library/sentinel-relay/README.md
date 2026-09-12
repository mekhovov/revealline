# Sentinel Relay authoring source

This folder owns the editable one-map encounter recipe and finite prompt examples. Its first presentation is Ukrainian-inspired fictional FPV; the same board includes the project's heritage, retro and business themes. No new image or sampled music file is bundled here. Existing original procedural scenery and generated music provide the first playable presentation.

`proposedpack-source.json` is the complete source recipe, including four themes, seven class recipes and one level. The historical “proposed” filename identifies the authored source; it is not an alternative import format. Its runtime counterpart is [sentinel-relay.json](../../../game/content/packs/sentinel-relay.json). Pack v3 requires core v3, level v2 and an explicit empty `masteries` array. Old clients must reject it as unsupported, not strip the encounter.

The source and runtime pack pass complete pack preparation. The [recorded proof](../../../game/replays/sentinel-routes.json) contains fourteen ordinary no-ability/no-boost wins plus both-policy missed-window, isolation and post-contact recovery routes; the [23 focused tests](../../../game/test/sentinel-playthrough.test.mjs) also cover ten saved-prefix restorations. Read the [player and authoring guide](../../../docs/sentinel-relay.md) for measured ticks, controls, equipment limits and evidence scope. No physical-device or new artwork review is implied.

Run `node authoring/library/sentinel-relay/record-proofs.mjs` from the repository root for read-only source/runtime/proof verification. After an intentional current-source revision, `--write` proves all twenty routes before replacing only the runtime pack and current proof. The helper cannot install or index a pack, modify player storage or overwrite any frozen release. Ordinary tests read fixed expectations and do not invoke this authoring generator.

## Editable rules and separate presentation

- Capture `shield-relay` to enter stage 2. Its successful closure cannot also defeat the core.
- While the core is open, close a trail containing at least eight distinct current `FIELD` cells. Existing safe cells, automatic flood-fill area and previous cuts do not count.
- When at most eight field cells remain, isolation provides an alternate finish: be safely outside an active cut during an opening, with no failure/redeployment or recovery in progress. A missed opening repeats. Ordinary short-cut gains are preserved.
- The sentinel is the only field seed. Releasing it deliberately reveals the remaining board. The core and relay remain required even after the 75% quota is reached.
- Warnings, active stripes, opening duration and minimum cut length are finite descriptor values. Body art, soundtrack, color and particles do not alter them.

Only the source recipe owns the initial coordinates, timings and class roster. Update its content revision when changing simulation data, validate the complete prospective pack and re-record reviewed legal input routes deliberately. Do not update old frozen expectations. The minimum release length also determines the isolation threshold; there is no independent contradictory threshold to tune.

Use `prompts.json` as authoring requests, not runtime input or an executable behavior language. None of its examples was executed to generate new art in this increment. Theme IDs `fpv`, `ukraine`, `retro` and `coupa` select existing presentation families; the final two are original game concepts and do not imply official branding or measured business savings. All themes use map ID `sentinel-relay-01`; changing a theme does not create a separately proven layout.

## Review before adding artwork

An optional future background should use original 4:3 pixel art with no baked HUD, live trails, objectives or enemies. Keep source bytes and provenance, validate media headers/budgets and fully browser-decode the image before adoption. A prompt alone is not a generated or visually reviewed asset. Preserve a visible gameplay center and draw warnings/cuts above decorative props in compact, prop and hybrid views.

The finite prompts cover role cues and legal proof requests. They must not add arbitrary JavaScript, new mastery predicates, unregistered classes, altered drone physics or hidden camera/input rules. No weapons specifications or real targeting instructions are part of this fictional encounter.
