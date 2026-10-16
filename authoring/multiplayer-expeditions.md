# Authoring Team and Duel expeditions

The expansion contains 96 Team missions and 72 Duel missions in twelve thematic families. Team has twelve portable campaigns. Duel has eighteen campaigns because Fracture and Aurora split at native rules-version boundaries; these are still twelve families, not eighteen new themes.

Open **Content Studio → Browse bundled candidates → Multiplayer expeditions**. Select Team or Duel, then **Inspect expedition source**. Inspection does not replace the draft. Apply the inspected source to edit it, and use Undo/Redo, local checkpoints or Export backup for recovery. Bundled source definitions are in `game/content-design/multiplayer-expansion.mjs`; the three wave files contain authored layouts and design decisions.

## Team environments

Select an environmental Team mission and open **Edit Team environment**. The focused recipe editor covers relays, directional currents, warning emitters, perimeter patrols, local erosion and numbered stages. **Validate & apply environment** compiles the complete candidate before creating a new draft revision. An error leaves the current source unchanged. A mission or map changed elsewhere invalidates the pending edit.

- Keep `version: "team-environment.v1"` and all six arrays: `relays`, `currents`, `emitters`, `patrols`, `erosion`, `stages`. Empty arrays are allowed.
- IDs are unique within the complete environment. Point coordinates are cell centres; rectangles use integer cell coordinates and positive dimensions.
- Relay objectives open their corresponding permanent safe connector. Gate rectangles must occupy authored wall cells and cannot overlap. Move the wall geometry before moving a gate, or inspect a complete source edit containing both changes.
- Currents affect exposed cuts only. They increase speed with the arrows and reduce speed against them. Capturing the region neutralizes the current.
- Emitters warn before attacking a specific pilot's existing cut. Closing that cut cancels its vulnerability; a later cut does not inherit the warning. Capturing the source disables it.
- Patrols follow the outer perimeter. They are distinct from Solo's moving-frontier patrols.
- Erosion warns before removing one eligible earned edge cell. Authored foundations, gates, targets, recovery anchors and the remaining safe network are protected. Capturing a source disables it.
- Numbered targets unlock in order and require separate closures. Future targets retain their region until unlocked. They are distinct from Duel's native Sentinel shield/core encounter.

The map preview uses the actual Team initial state and shows the same functional markers as play. Its frozen capture overlay preserves future-stage and stationary-source regions. It remains an explanation of a proposed closure, not proof that a moving player can legally complete it.

These recipes require `TeamMissionV10`, `revealline-coop-level.v15`, `revealline-coop-pack.v15` and `revealline-coop.v17`. Do not relabel them as old editions. Match recordings use the successor terminal observation contract only for this native edition; historical recordings keep their own contract.

## Pictures, sounds and portable chapters

The expansion reuses 77 existing picture assets. Their IDs, revisions, dimensions, hashes, source and rights metadata remain intact. This is new level design using existing media, not a claim of 168 new paintings or recordings. See `docs/research/multiplayer-expansion-media-audit.json` for dependency evidence.

Team markers reuse the existing anchor and emitter-warning presentation slots; fixed shapes, vector numbers and patterns preserve mechanic meaning with different themes or fonts. Existing warning, erosion, support, rescue and result event bindings remain available to Sound Studio. Changes to sound or pictures never alter collision geometry or warning timing.

Use `multiplayerChapterSource(source, campaignId, mode)` to extract an editable chapter with only its referenced maps and assets. Team chapters use the existing Creator Team editable-source portable v2 export/import and media companion. A source backup does not embed all image/audio bytes; include the companion media when transporting a chapter to another installation. Duel chapters retain their native mission edition and the existing two-board untimed first-clear protocol. Both seats receive the same level and options, including difficulty and steering policy.

## Reproducible verification

`scripts/qualify-multiplayer-expansion.mjs` searches legal Team input routes. `scripts/qualify-duel-expansion.mjs` searches real two-board Duel input routes and writes each result incrementally. Store intermediate output under `.cache/multiplayer-expansion`, not a temporary system directory. `scripts/replay-duel-expansion.mjs` replays routes through each actual difficulty/steering projection; it never transfers a win result between projections.

Repository fixtures under `game/test/fixtures/multiplayer-expansion/` contain ordinary input segments, source/tuned identities and native-state hashes. The route tests verify Team contribution, Team role reversal, Duel equal-input draws and wins from either seat. These are deterministic regression evidence. Paired human feedback, physical controller/touch testing, audio listening and publisher acceptance must be recorded separately in the delivery register.

Run the native gameplay and authoring regressions from the repository root:

```sh
node --test game/test/multiplayer-expansion-routes.test.mjs game/test/duel-expansion-routes.test.mjs game/test/coop-expedition-environment.test.mjs game/test/multiplayer-expansion.test.mjs game/test/studio-draft-snapshot.test.mjs game/test/multiplayer-expansion-media.test.mjs
node scripts/localization.mjs check
node scripts/game-cli.mjs build --out dist/multiplayer-expansion
```

The build needs enough free space for the complete distribution, not just the new source files. Consult the delivery register for the latest build and external acceptance status before publishing.

The chapter-finale fixtures now retain two spatially different routes per chapter, mixed-route Duel races with seat reversal, and bounded mistake traces. Run `game/test/multiplayer-finale-strategies.test.mjs` and `game/test/multiplayer-finale-mistakes.test.mjs` to preserve those outcomes after a Studio edit. Their documented fast clears and unfinished recovery probes are not human pacing or balance guarantees.

For an exact committed package, run `node scripts/verify-multiplayer-delivery.mjs --root PATH_TO_PACKAGE --report .cache/multiplayer-delivery.json`. For the public site, replace `--root` with `--base https://mekhovov.github.io/revealline/`. This verifies the expansion and curated Hunt mission inventory, original media, complete offline ownership and every required URL's bytes. A stable matching manifest is required; install/update, actual offline play, Studio recovery and listening are separate checks. See the [15 October qualification report](../docs/team-duel-qualification-2026-10-15.md) for source and native-browser evidence and its limits.
