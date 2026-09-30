# C0: current-entry actor baseline

Source inspected: `bb9b3640270dc26633d37cfdf4a306aecda277b6` on 28 September 2026. This is a source audit for the approved character/game-feel programme. It is not a new release, whole-game visual acceptance or a performance measurement.

## Reproduce the live inventory

```sh
node scripts/actor-coverage.mjs --summary
node scripts/actor-coverage.mjs --write
node scripts/actor-coverage.mjs --check
node --test scripts/test-actor-coverage.mjs
```

The [generated report](verification/actor-motion/current-coverage.json) starts from `resolveJourneyRequest(new URLSearchParams(), {mode})`. It compiles the actual source editions, retaining source SHA-256, campaign revision, mission revision, simulation identity, authored actor role, resolved runtime type, artwork identity and presentation material. It reads metadata only and never decodes or rewrites original images, player storage, simulation data or production history.

| Current ordinary entry | Route                                  | Missions | Resolved campaign groups |
| ---------------------- | -------------------------------------- | -------: | -----------------------: |
| Solo                   | `whole-spatial-v25`                    |       91 |                       27 |
| Versus                 | `whole-spatial-v25`                    |       91 |                       27 |
| Team                   | `team-cultural-specialist-originals-2` |       12 |                        9 |

This represents 194 mission/mode owners, not 194 different mission designs. Campaign-group counts come from the exact runtime resolver, including separately resolved optional groups; they are not the older editorial campaign count. Nine authored enemy roles appear in these defaults: field keeper, perimeter patrol, frontier patrol, reclaimed roamer, territory eroder, lane emitter, relay sentinel, trail pursuer and heading interceptor. The twelve-role authoring catalogue is larger; optional scout, optional sentry and separately named impact-carrier definitions are not thereby current-route actor placements. Existing shared line-impact rules remain part of the actual compiled policy.

Seven FPV class presentations and 61 actor-related compiled slots are catalogued. The report records exact asset IDs/revisions, files, geometry, recipe IDs and source-review stages. All requested ordinary enemy/player FPV slots are present. **Presence is not proof of visible animation or approved production quality.**

The FPV entries describe the available actor appearance override. Campaign-style Journey enemies use their registered material renderer; explicit uploads and retained appearances preserve precedence. A source `field-keeper` becomes `drifter` in Team and `bouncer` in Solo/Versus; the report keeps both identities instead of merging their simulation rules. Team state recipes may inherit a body rather than supply another raster.

## Stale inventory corrected at the generator boundary

The retained `docs/content-offline/inventory.json` still calls `whole-spatial-v11` and `team-trail-impact-originals-1` current. Its equal mission counts do not make those editions equivalent to current defaults. The new report exposes all three mismatches explicitly.

The full inventory generator also omitted both cultural Team factories from its closed route table. `loadInventoryTeamRoute` now serves both reports, covers every route in the current lifecycle table, and rejects unknown successors. The large historical inventory is deliberately not rewritten by this bounded actor batch. Complete historical/imported/installed coverage and original-byte validation remain C7 work.

## Keep / Repair / Replace decisions

These are conservative source dispositions. Keep means preserve the exact current source pending motion and visual review; it does not approve every pose. The generator validates asset records before reporting them and cannot certify animation from a declared clock or geometry alone.

| Disposition                   | Asset or family                                               | Required follow-through                                                                                                                                                             |
| ----------------------------- | ------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Keep body; repair motion path | Fourteen compact/detailed FPV player slots                    | Preserve approved raster identities and their declared hubs. C1 must paint real attached rotors without bringing back detached corner marks.                                        |
| Repair rig                    | Prepared `enemy.border-patrol`                                | The prepared quad has zero registered anchors. Supply a reviewed rig and actual frames; historical illustrated patrols with baked blades must not receive a duplicate moving layer. |
| Keep                          | Remaining prepared enemy bodies and Team state recipes/images | Review role silhouette, facing, state transitions, player distinction and scale against the actual painter. No automatic replacement based on filenames.                            |
| Keep originals                | Historical player/enemy concepts and pinned reveal pictures   | Preserve original bytes and exact ownership. New derivatives/rigs require their own source identities and review.                                                                   |
| Replace                       | None automatically selected                                   | A replacement needs visual evidence, a newly reviewed revision and compatibility handling. Bulk replacement is not justified by this metadata audit.                                |

The source-level player repair is distinct from the report's raster-level Keep. If a runtime correction supplies a rig through an adapter, record its exact evidence separately; an empty metadata anchor list must not be silently counted as a registered rig.

## Remaining acceptance and next phases

The accompanying C1-A candidate restores declared player rotors; its separate rendered evidence does not change the baseline observation or silently supply patrol metadata. The unrigged patrol remains C1-B work.

1. **C0 remaining:** record actual motion frames, baseline frame time, decoded-image memory and download cost. Review the wider current non-actor assets, explicitly addressed content and manual overrides. The metadata inventory does not close C0 by itself.
2. **C1 priority:** shared fitted, alias-aware rotor motion in Solo, both Versus boards and Team; actual frame comparisons at 30/60/120 FPS and degraded frame rates, pause/background return, stun/downed/reduced-effects, four headings and 20/24/32 CSS pixels. Preserve simulation checkpoints and image precedence.
3. **C2 priority:** three existing mission benchmarks for clear losses, short Retry and coordinated capture payoff. Community workshop, Poltava courtyard and Synevyr-inspired artwork remain candidates, not additional mandatory missions.
4. **C3–C7:** complete roster/native flow, optional encounter variants, edition cohorts, authoring knowledge and whole-content qualification. Authoring/reference work may proceed in parallel with serialized release publication.

Focused C0 checks cover current entry, source identity, Team role adaptation, campaign/FPV distinction, stale equal-count inventory, all lifecycle Team factory coverage, unknown-route rejection and invalid rig rejection. Actual-scale visual review, physical input, offline recovery, human sessions and public play remain separate evidence. Apply the active release policy honestly: waived long suites must not be reported as passed.

## Maintainer prompt

For final actor/contact overlays, also follow the [batch 6 review](verification/actor-batch-6/README.md).
Command identity alone missed a later filled Team marker over the body. Inspect
actual final pixels, exact contact coordinates, fallback preservation and
foreground order; distinguish static size/overlap fixtures from real play.

> Refresh `scripts/actor-coverage.mjs` against the current entry resolver before changing actor art or motion. Preserve every source, campaign, mission, simulation and artwork identity. Report campaign-material painting separately from the optional FPV snapshot and uploaded overrides. For each changed body/rig, compare actual painted frames at 20/24/32 CSS pixels over bright and dark artwork, paused/downed/reduced effects and 30/60/120 FPS. Record Keep/Repair/Replace as an evidence-backed disposition; do not equate present bindings or a running animation clock with visible correct propellers. Keep original sources and production history immutable, use a reviewed successor for replacements, and submit the bounded feature to the single publisher.
