# FPV Front · First Light R2

This is a new three-mission campaign edition built from the existing classic registry. It responds to the requested stronger pressure and more varied decisions without claiming adaptive enemy intelligence. The prior First Light pack, its Standard/Gentle proofs and the 18 Classic Lab proofs remain unchanged.

The pack ID is `fpv-arcade-r2`, campaign ID `fpv-first-light-r2`, campaign revision `2`. The three map IDs are retained with map revision `2`; the normalized campaign key is `fpv-first-light-r2/2/33e59e00d45542d4`. This edition uses `xonix-pack.v5`, `xonix-level.v4`, `xonix-core.v5`, scenario v5 and replay v6, with no mastery definitions. It is not automatically installed or indexed by this source folder.

Every map enables `rules.stopOnCapture: true`. Closing a live cut stops the craft at secured ground. Release held controls, then give a fresh direction to continue; releasing a direction during an unfinished cut does not stop it. Arcade uses Pause rather than a separate Stop action. The engine flag and the host's fresh-gesture gate have separate responsibilities.

## Revision recipes

| Mission         | Standard goal | Pressure and routing choice                                                                                                                                                                                                                                                        |
| --------------- | ------------: | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Orchard Window  |           65% | Two field movers are roughly 45–50% faster than their original counterparts. A contour patrol follows the changing reveal boundary. Central slow terrain penalizes the direct crossing; a visible, optional speed pickup offers an exposed detour.                                 |
| Split Courtyard |           75% | Three field movers gain 35% velocity. Broad staggered wall gaps remain passable. An eroder warns before removing eligible secured cells; a rover activates after its ground is revealed and its warning completes. Slow and freeze pickups compete with safer routes.              |
| Night Signal    |           85% | Three field movers gain 35% velocity. Two orthogonal lane hazards use visible warnings and different deterministic periods. A contour patrol and an awakening rover pressure secured routes. Small slow/lethal terrain regions and optional freeze/life pickups add route choices. |

Normal player speed rises from 10 to 12 cells/second, while boosted speed remains 15. Faster player movement therefore does not offset the higher enemy pressure. Enemy radii and player collision radius remain visible established values; no invisible collision-margin expansion or sub-cell passage was introduced. Lane escalation is between missions, not adaptive behavior or a hidden stage trigger. Existing music assignments are retained.

The engine retains its fixed current pickup effects: speed ×1.25 for 600 ticks, enemy slow ×0.5 for 720 ticks, freeze for 360 ticks, and one life up to the existing cap. Effects begin on the next simulation tick. Pickups require contact, not enclosure. The terrain and pickups are visible; lethal terrain only applies while its cell is FIELD. These are existing registered rules, not newly configurable effect code.

## Actual input proofs

[The strict verifier](../../../scripts/verify-fpv-r2.mjs) replays the [separate twelve-route proof](../../../game/replays/fpv-arcade-r2-routes.json) using real Scout inputs and complete replay-v6 verification. It binds pack, campaign, level and class identities. Each nonterminal capture ends its direction segment, followed by exactly one released tick and a new deliberate command. No route patches position, cells, health, score, status or awards; no route uses a class ability. All use Boost. The [bounded authoring search](search.mjs) simulates those release ticks while evaluating candidate paths.

Immediate and Grid + buffer independently produce the following results. Times and cut counts describe these solver routes, not expected human completion times or proof of enjoyment.

| Mission         | Standard: time / captures / coverage | Gentle: time / captures / coverage | Maximum live trail cells, Standard |
| --------------- | ------------------------------------ | ---------------------------------- | ---------------------------------: |
| Orchard Window  | 9.24 s / 2 / 74.29%                  | 15.78 s / 3 / 84.87%               |                                 34 |
| Split Courtyard | 36.23 s / 9 / 81.36%                 | 21.13 s / 5 / 75.09%               |                                 48 |
| Night Signal    | 36.18 s / 10 / 85.31%                | 39.05 s / 11 / 90.59%              |                                 41 |

Every route loses zero lives. Orchard is deliberately still a short two-cut introduction when its solution is known. Gentle's altered enemy timing can produce a longer route even though its hazards are slower; these timings are not a difficulty ranking.

Both-policy Standard control probes preserve the original timed First Light routes and first verify that they still produce their exact original winning summaries/checkpoints. Replaying those same controls against R2, with the required release tick at any new capture stop, fails before completion: self-contact in Orchard, enemy-trail contact in Courtyard, and a boss lane in Night. A direct boosted launch crossing also fails in Orchard/Courtyard; Night's direct crossing closes only 34 cells (1.46%), far below its goal. This demonstrates changed outcomes, not that every possible straight-cut strategy is ineffective.

The winning Courtyard routes exercise actual pickup collection, rover activation and erosion: Standard records two pickups and six erosion transactions; Gentle records one pickup and two erosion transactions. Night records 14 Standard/seven Gentle lane warnings, rover activation and contour route changes. Orchard's proof exercises contour re-routing but does not collect its optional speed pickup; Night's Standard proof avoids its optional pickups and lethal patch. Optional content presence is not evidence of every effect being exercised.

## Sources and verification

- [Editable pack source](pack-source.json) contains bounded JSON mechanics and no embedded image data.
- [Built pack](../../../game/content/packs/fpv-arcade-r2.json) includes the exact three original First Light image bindings.
- [Art provenance](art-provenance.json) pins each copied PNG and links the original provenance. These are the same three revision rewards: **zero new unique images**. No artwork was regenerated or edited.
- [Focused tests](../../../game/test/fpv-r2-playthrough.test.mjs) exercise proof authority, fresh-command boundaries, pack/library/scenario round trips and exact original image bytes. Node transport uses an explicitly limited exact-source/header adapter, not a browser pixel decoder.

From the repository root:

```sh
mise exec node@22.22.2 -- node authoring/library/fpv-arcade-r2/build.mjs
mise exec node@22.22.2 -- node scripts/verify-fpv-r2.mjs
mise exec node@22.22.2 -- node --test game/test/fpv-r2-playthrough.test.mjs
```

Both `build.mjs --write` and `verify-fpv-r2.mjs --write` refuse to overwrite an existing output. A later gameplay revision needs separate identities and evidence. Browser artwork decoding, current UI integration, human enjoyment and physical controller/touch comfort remain separate acceptance work; this source does not claim them.
