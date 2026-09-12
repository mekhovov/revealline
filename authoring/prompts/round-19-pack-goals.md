# Round 19 — eight pack-goal authoring and QA prompts

These are prose tasks for the explicit pack/scenario-v2 implementation after released v0.8.0. They add **no CLI prompt IDs or new predicate types**. Read the [pack plan](../../docs/round-18-pack-mastery-plan.md), [new creator-tool research](../../docs/research/round-19-pack-goal-authoring.md), [equipment guide](../../docs/equipment-seals.md), and actual validators before use. The definition documents below are valid existing v0.8 recipes; a definition document alone is not an importable pack or scenario.

At the released v0.8 baseline, packs and scenarios remain strict v1 and goals use pinned sidecars. Pack-v2/scenario-v2 integration is separate work in progress. For each task, inspect which APIs are actually implemented; report a missing integration as unfinished rather than silently changing formats, dropping declarations or claiming a successful preview. Keep frozen releases and old test expectations immutable.

## 1. Carry the three existing goals through an explicit new container

> Start from an owned copy of the actual Homeward Skies pack. Prepare an explicit `xonix-pack.v2` candidate using all existing required fields plus `masteries` containing the three complete definitions below. Preserve the original maps, campaign revision, filtered recipes, images and music. Route preparation through the shared validators and registration policy once implemented; do not attach definitions to normalized levels. Confirm each resulting goal has the same canonical hash as its v0.8 sidecar, while the container retains its explicit v2 format on export. Round-trip the untouched original v1 pack separately and verify that adding `masteries` to v1 rejects. A correct declaration does not bypass full pack validation or prove a playable route.

## 2. Make “no goal” an explicit, reversible choice

> Prepare a v2 candidate with `masteries: []` and a v2 practice scenario with `masteryDefinition: null`, keeping all other required fields. Confirm neither receives an implicit built-in fallback. Contrast the unchanged exact-content v1 Homeward entry, which retains its shipped fallback policy. Test a missing required field separately from an explicit empty/null choice. Remove and restore a declaration through the existing Undo model; show the effective goal in the preview and preserve the authored format when exported. If a raw-map replacement invalidates a goal reference, retain the prior playable candidate and explain which reference must be repaired or explicitly removed.

## 3. Give preflight failures useful names without decoding media

> For each example, resolve references against its owning map and filtered campaign roster. Test a missing pad, a region from another map, an objective ID supplied as an enemy, a border-patrol target for Safe Return, a missing hangar, and an unavailable target class. Test duplicated definition IDs, repeated map assignments, non-JSON structures, excessive depth and definition byte/array limits. Verify structural failures cause zero image-decoder calls, zero installed-state writes and no mutation of the supplied candidate. Report the pack, map, field/reference and supported domain in plain text. A structurally compatible actor or recipe does not establish solvability; show that distinction in any preflight summary.

## 4. Test real practice goals with positive and ordinary routes

> Use prepared declarations to preview the existing Homeward route proofs in `immediate` and `grid-center`. Confirm Steady Signal's resistant closed cut; Supply Line's genuine refills, per-region closed credit and accepted carrier switch; and Safe Return's new qualifying pulse plus its associated return and clean finish. Compare the ordinary and action-omission routes already recorded in `game/replays/homeward-routes.json`. Keep every existing core summary/checkpoint unchanged. Inspect the actual ready, flight, pause, returning, result and picture UI. An ordinary win must mark its finish step complete while identifying missing equipment conditions. Keep Start/Resume reachable, native keyboard scrolling in Mission details, readable configured action labels and muted/reduced-effects feedback. Label controller-lab inputs as simulated. A practice qualification must never create a player award or write the solo profile, even after changing maps or campaigns.

## 5. Preview supported threshold variations without changing the primitive

> Clone the complete definitions below and make three separate candidate revisions: Steady Signal's `minCells` from 8 to 12; both Supply Line region thresholds from 2 to 3; Safe Return's `minTrailCells` from 3 to 6. Update each candidate's revision and description to match its rule, then resolve it using the same finite schema. Keep the owning map and roster unchanged. These variants are schema-valid; the existing proof data reports 22 Steady cells, west four/south three Supply cells and six pre-impact cells, so they are candidates for positive replay checks, not substitutes for actually running them. As a control, try Safe Return threshold 7 against the unchanged six-cell route: it should remain an ordinary win without that goal qualifying. Display each changed definition as a new identity; retain previous earned records as history. Add no new counters, currencies or arbitrary formulas.

## 6. Review replacement, conflicts and in-flight work together

> Install the unchanged-goal v2 candidate through the reviewed replacement path, then prepare a same-pack-ID replacement containing one revised definition. Evaluate dependencies and registrations on the prospective set after removing the old member. Contrast a co-installed pack with the same campaign key but a conflicting declaration, including declaration versus none: reject the ambiguous set without choosing the first or last pack. Show what changed before adoption and keep old records/pictures. Delay a qualifying check across replacement, removal, backup import and Undo; no obsolete job may commit after the content lifetime changes. Save a live cut or pending impact return, replace only its definition, and restore: reconstruct the full input prefix using the currently applicable goal, never combine counters from two declarations. Removing the goal restores ordinary gameplay; it does not delete the recorded flight.

## 7. Export a preview honestly and reskin it independently

> Carry the selected definition through theme, image, music and presentation edits in the practice model. Prepare one Ukrainian FPV presentation, one Ukrainian embroidery/history presentation, one original 80–90s arcade presentation and one Coupa-inspired business presentation using original or authorized assets. Keep physical geometry, stable reference IDs and equipment rules intact; an image swap grants no capability. Explain when a requested text edit changes definition or campaign identity under existing hashing. For an edited scenario exported as a new one-map campaign, construct the actual export context first and visibly retarget any mismatched definition campaign ID; recompute its identity and call it a new declaration. Exporting the original catalog pack must preserve its original identity and format instead. Never silently drop the goal or export an invalid cross-campaign reference.

## 8. Produce a reviewable candidate and an honest test receipt

> Deliver the prepared candidate, its effective per-map declarations and a concise report separating schema/context validation, media decoding, actual practice observations, qualifying/control replay checks, save/restore and replacement/Undo results. Include mixed v1/v2 pack libraries and backups, cancellation during decode, failed-write rollback, unavailable historical packs and exact current-versus-archived labels. Run the relevant current tests and both frozen v0.6/v0.7 compatibility fixtures without regenerating expectations; inspect newly added test names rather than assuming a total. Keep record v1, library v2, replay v3, session v1 and core v2 unchanged. No local import is a platform achievement or a newly verified award. Do not publish, claim physical-device tests or claim a release passed until that evidence exists.

## Complete existing definition examples

These JSON documents were copied from the frozen v0.8.0 public exports. They intentionally retain the original names, descriptions and revisions so their canonical identities remain:

| Definition    | Existing identity             |
| ------------- | ----------------------------- |
| Steady Signal | `mastery-v1-2e6aae3f42f3d3c2` |
| Supply Line   | `mastery-v1-a3ffbfe068645ff0` |
| Safe Return   | `mastery-v1-197b5a9a9370f0f2` |

The `mastery-v1-` prefix identifies the digest algorithm for both definition schema versions. It is not permission to rewrite a v2 definition as v1. The Homeward references below must exist in the actual chosen map and roster; changing only a textual campaign/map ID does not supply those objects.

### Steady Signal

```json
{
  "version": "xonix-mastery-definition.v1",
  "id": "steady-signal",
  "revision": "1",
  "campaignId": "homeward-skies",
  "levelId": "homeward-01",
  "name": "Steady Signal",
  "description": "Close one cut through eight distinct interference cells with signal resistance, then win without losing a life.",
  "all": [
    {
      "type": "clean-win"
    },
    {
      "type": "resistant-cut-cells",
      "zoneId": "broad-band",
      "minCells": 8
    }
  ]
}
```

### Supply Line

```json
{
  "version": "xonix-mastery-definition.v2",
  "id": "supply-line",
  "revision": "1",
  "campaignId": "homeward-skies",
  "levelId": "homeward-02",
  "name": "Supply Line",
  "description": "Refill at both supply pads, close a cut through two suppressed cells in each emitter region, switch to Heavy carrier at the southern hangar, then win.",
  "all": [
    {
      "type": "supply-pickups",
      "padIds": ["west-supply", "south-supply"]
    },
    {
      "type": "suppressed-region-crossings",
      "regions": [
        {
          "zoneId": "west-emitter",
          "minCells": 2
        },
        {
          "zoneId": "south-emitter",
          "minCells": 2
        }
      ]
    },
    {
      "type": "hangar-switch",
      "hangarId": "south-hangar",
      "classId": "carrier"
    }
  ]
}
```

### Safe Return

```json
{
  "version": "xonix-mastery-definition.v2",
  "id": "safe-return",
  "revision": "1",
  "campaignId": "homeward-skies",
  "levelId": "homeward-03",
  "name": "Safe Return",
  "description": "Use an impact pulse from a live cut of at least three cells to stun the cable-cutter, return home, then win without losing a life.",
  "all": [
    {
      "type": "clean-win"
    },
    {
      "type": "live-cut-impact",
      "actorId": "cable-cutter",
      "minTrailCells": 3
    }
  ]
}
```

For implementation and content changes, follow the existing [Runtime Maintainer](../skills/xonix-runtime-maintainer/SKILL.md) and [Level Designer](../skills/xonix-level-designer/SKILL.md) skills together with the current source contract. These prompts do not change those skills, the machine-readable prompt catalog or any frozen artifact.
