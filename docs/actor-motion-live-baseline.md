# C0: current-entry actor baseline

Current source refresh: `e39b4197a75441d74c35299c8545d8bdfd0a7c61` on 30 September 2026. The original 28 September observation used `bb9b3640270dc26633d37cfdf4a306aecda277b6`; its historical motion evidence remains unchanged. This is a source audit for the approved character/game-feel programme, not a new release, whole-game visual acceptance or a performance measurement.

## Reproduce the live inventory

```sh
node scripts/actor-coverage.mjs --summary
node scripts/actor-coverage.mjs --write
node scripts/actor-coverage.mjs --check
node scripts/art-motion-disposition.mjs --write
node scripts/art-motion-disposition.mjs --check
```

These commands regenerate or validate metadata. Automated test-only commands,
including `scripts/test-actor-coverage.mjs`, remain
**WAIVED_SKIPPED_NOT_PASSED** under the [temporary policy](focused-test-waiver-20260930.md).

The [generated report](verification/actor-motion/current-coverage.json) starts from `resolveJourneyRequest(new URLSearchParams(), {mode})`. It compiles the actual source editions, retaining source SHA-256, campaign revision, mission revision, simulation identity, authored actor role, resolved runtime type, artwork identity and presentation material. It reads metadata only and never decodes or rewrites original images, player storage, simulation data or production history.

| Current ordinary entry | Route                                  | Missions | Resolved campaign groups |
| ---------------------- | -------------------------------------- | -------: | -----------------------: |
| Solo                   | `whole-spatial-v25`                    |       91 |                       27 |
| Versus                 | `whole-spatial-v25`                    |       91 |                       27 |
| Team                   | `team-cultural-specialist-originals-2` |       12 |                        9 |

This represents 194 mission/mode owners, not 194 different mission designs. Campaign-group counts come from the exact runtime resolver, including separately resolved optional groups; they are not the older editorial campaign count. Nine authored enemy roles appear in these defaults: field keeper, perimeter patrol, frontier patrol, reclaimed roamer, territory eroder, lane emitter, relay sentinel, trail pursuer and heading interceptor. The twelve-role authoring catalogue is larger; optional scout, optional sentry and separately named impact-carrier definitions are not thereby current-route actor placements. Existing shared line-impact rules remain part of the actual compiled policy.

Seven FPV class presentations and 61 actor-related compiled slots are catalogued. The report records exact asset IDs/revisions, files, geometry, recipe IDs and source-review stages. All requested ordinary enemy/player FPV slots are present. **Presence is not proof of visible animation or approved production quality.**

The FPV entries describe the available actor appearance override. Campaign-style Journey enemies use their registered material renderer; explicit uploads and retained appearances preserve precedence. A source `field-keeper` becomes `drifter` in Team and `bouncer` in Solo/Versus; the report keeps both identities instead of merging their simulation rules. Team state recipes may inherit a body rather than supply another raster.

## Current inventory and historical drift

The 28 September offline inventory called `whole-spatial-v11` and
`team-trail-impact-originals-1` current. That mismatch has since been corrected;
the 30 September regeneration reports `staleSavedInventory: []`. The checked-in
actor report itself was still stale: it named FPV presentation revision 93 instead
of current 104 and retained those three old mismatch rows. Refreshing it changes
the presentation identity and mismatch status, not any mission, role or artwork.

`loadInventoryTeamRoute` serves both reports, includes both cultural Team factories,
and rejects unknown successors. The bounded actor refresh does not rewrite the
larger content inventory. Complete historical/imported/installed coverage and
original-byte validation remain C7 work.

The regenerated disposition report retains 631 placements, 125 distinct actor
bindings, 103 mission artworks and 335 compiled bindings, with Keep 228 / Repair 15 /
Review 332 / Replace 0. It updates exact current source/revision fingerprints;
it grants no new artwork approval. Five explicitly unknown scopes remain.

## Keep / Repair / Replace decisions

These are conservative source dispositions. Keep means preserve the exact current source pending motion and visual review; it does not approve every pose. The generator validates asset records before reporting them and cannot certify animation from a declared clock or geometry alone.

| Disposition                   | Asset or family                                               | Required follow-through                                                                                                                                                             |
| ----------------------------- | ------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Keep body; review proportions | Fourteen compact/detailed FPV player slots                    | Shared attached rotor motion is implemented. Preserve exact originals; candidate proportions still require separately reviewed adoption.                                            |
| Repair rig                    | Prepared `enemy.border-patrol`                                | The prepared quad has zero registered anchors. Supply a reviewed rig and actual frames; historical illustrated patrols with baked blades must not receive a duplicate moving layer. |
| Keep                          | Remaining prepared enemy bodies and Team state recipes/images | Review role silhouette, facing, state transitions, player distinction and scale against the actual painter. No automatic replacement based on filenames.                            |
| Keep originals                | Historical player/enemy concepts and pinned reveal pictures   | Preserve original bytes and exact ownership. New derivatives/rigs require their own source identities and review.                                                                   |
| Replace                       | None automatically selected                                   | A replacement needs visual evidence, a newly reviewed revision and compatibility handling. Bulk replacement is not justified by this metadata audit.                                |

The source-level player repair is distinct from the report's raster-level Keep. If a runtime correction supplies a rig through an adapter, record its exact evidence separately; an empty metadata anchor list must not be silently counted as a registered rig.

## Remaining acceptance and next phases

Shared rotor motion, direction handling, paused/reduced clocks and Team state
adaptation are integrated source. Their recorded frame evidence does not approve
every current production body, candidate proportions or patrol rig. The unrigged
registered patrol remains explicit; a runtime fallback is not a registered rig.

1. **C0 remaining:** record actual motion frames, baseline frame time, decoded-image memory and download cost. Review the wider current non-actor assets, explicitly addressed content and manual overrides. The metadata inventory does not close C0 by itself.
2. **A / C3, with required C1/C6:** correct proven current actor/native-flow defects and preserve simulation checkpoints, exact appearances and image precedence. Broader actual-size/frame/state/contrast and hardware qualification remains distinct from source inspection.
3. **B / C4:** qualify optional counterplay and recovery. The current Sentry recovery correction uses its actual projectile cause, preserving existing events, replay identity and life-loss rules.
4. **C / C5 and necessary C6:** continue the first Ukrainian/FPV cohort and authoring support. Production/cultural review is deferred by the user; workshop, Poltava and Synevyr artwork remain candidates, not new mandatory missions.
5. **C7 / UX6, then C2 last:** finish whole-content qualification before the formal comparison/player sessions. Independent preparation proceeds alongside the serialized publisher.

Focused C0 checks cover current entry, source identity, Team role adaptation, campaign/FPV distinction, stale equal-count inventory, all lifecycle Team factory coverage, unknown-route rejection and invalid rig rejection. Actual-scale visual review, physical input, offline recovery, human sessions and public play remain separate evidence. Apply the active release policy honestly: waived long suites must not be reported as passed.

## Maintainer prompt

For final actor/contact overlays, also follow the [batch 6 review](verification/actor-batch-6/README.md).
Command identity alone missed a later filled Team marker over the body. Inspect
actual final pixels, exact contact coordinates, fallback preservation and
foreground order; distinguish static size/overlap fixtures from real play.

> Refresh `scripts/actor-coverage.mjs` against the current entry resolver before changing actor art or motion. Preserve every source, campaign, mission, simulation and artwork identity. Report campaign-material painting separately from the optional FPV snapshot and uploaded overrides. For each changed body/rig, compare actual painted frames at 20/24/32 CSS pixels over bright and dark artwork, paused/downed/reduced effects and 30/60/120 FPS. Record Keep/Repair/Replace as an evidence-backed disposition; do not equate present bindings or a running animation clock with visible correct propellers. Keep original sources and production history immutable, use a reviewed successor for replacements, and submit the bounded feature to the single publisher.
