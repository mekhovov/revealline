# Round 18 — eight equipment-goal authoring and QA prompts

These are prose tasks for the bounded Supply Line / Safe Return source increment after frozen v0.7.0. They add **no CLI catalog IDs, pack fields or automatic registrations**. Read the [equipment plan](../../docs/round-18-equipment-mastery-plan.md), [UX research](../../docs/research/round-18-equipment-goal-ux.md), [verification contract](../../docs/mastery-verification-contract.md) and actual modules before applying an example. Use [Runtime Maintainer](../skills/xonix-runtime-maintainer/SKILL.md) for implementation and [Level Designer](../skills/xonix-level-designer/SKILL.md) for content and route design.

Preserve frozen releases and historical v1 behavior. `xonix-mastery-definition.v2` is a finite observer extension, not `xonix-pack.v2`. The current registrations are sidecars bound to the exact Homeward campaign, normalized maps and roster. [Pack-authored mastery](../../docs/round-18-pack-mastery-plan.md) remains a separate future implementation. New definition versions still use the `mastery-v1-` content-digest algorithm, `xonix-mastery-record.v1`, library v2, core v2 and replay v3. A changed definition receives a different hash; no old core/board identity or earned record is reinterpreted.

## 1. Validate both versions without widening v1

> Read the exported `STEADY_SIGNAL`, `SUPPLY_LINE` and `SAFE_RETURN` and resolve owned copies through the public definition resolver. Preserve the exact v1 Steady Signal pair, canonical order, preview shape and hash `mastery-v1-2e6aae3f42f3d3c2`. For v2, accept only the Supply composition (`supply-pickups`, `suppressed-region-crossings`, `hangar-switch`) or the Safe Return composition (`clean-win`, `live-cut-impact`). Permute the Supply pad/region sets and predicate order: canonical output and identity should remain equal. Reject duplicates, mixed compositions, missing fields, unknown versions and executable/non-JSON structures without modifying the caller. All goals still require a final win. Do not solve validation failures by adding a new field to a map, pack, replay or record.

For comparison, these are the two **predicate compositions**, not complete importable definition documents:

```json
[
  { "type": "supply-pickups", "padIds": ["west-supply", "south-supply"] },
  {
    "type": "suppressed-region-crossings",
    "regions": [
      { "zoneId": "west-emitter", "minCells": 2 },
      { "zoneId": "south-emitter", "minCells": 2 }
    ]
  },
  { "type": "hangar-switch", "hangarId": "south-hangar", "classId": "carrier" }
]
```

```json
[
  { "type": "clean-win" },
  { "type": "live-cut-impact", "actorId": "cable-cutter", "minTrailCells": 3 }
]
```

## 2. Prove meaningful Supply Line actions in both steering modes

> Replay the unchanged Homeward 02 equipment route with Light carrier and its accepted Heavy carrier switch in both `immediate` and `grid-center` modes. Confirm actual refills at `west-supply` and `south-supply`; at least two distinct cells in each named suppressed emitter region within a successfully closed live cut; an accepted `carrier` switch at `south-hangar`; and a final win. The known reference route supplies west four/south three cells, but do not hard-code those ticks or coordinates into the rule. Different regions may use different successful cuts. Contrast full-pad presses, safe-ground walks, failed open cuts, rejected switches and the existing ordinary/action-omission routes. Supply Line has no clean-life requirement: earlier completed actions remain within this attempt after a later life loss, while failed/redeployed pending cuts are discarded.

## 3. Prove Safe Return's same-pulse recovery sequence

> Replay the existing Homeward 03 Impact route in both steering modes. Capture the pre-use live trail, require at least three cells, identify the newly created impact pulse, and verify that this pulse overlaps and actually stuns `cable-cutter`. Keep the phase awaiting return until the associated redeployment completes its later respawn; then require a win with no lost life. Compare the ordinary Interceptor route and action-omission trace, plus an empty pulse, a short trail, an unrelated field stun and an unrelated later respawn. The known route starts from six trail cells; that is proof data, not the authored threshold. Report a clean recovery, never a claim that the pulse was the only possible survival action. Preserve original summaries and checkpoints.

## 4. Restore previews from the complete recorded prefix

> Suspend Supply Line once with unbanked region cells and once after a closed crossing but before the class switch. Suspend Safe Return between impact use and the associated return, then again after returning. Use the existing recorder/session APIs and their release boundaries. Restore with the exact installed campaign key and currently registered definition, reconstruct the full prefix and continue from the next fixed tick. Pass `definition` to the public setup/fact helpers so v2 dispatch is explicit. Compare typed preview rows, pending cells, class history and final verification with uninterrupted attempts in both policies. Reject injected counters, mismatched content, discontinuous facts and cancellation before/at final progress; keep the old saved JSON format unchanged.

## 5. Make the checklist readable without burying flight controls

> Inspect ready, flight, pause, returning, won and gallery views through public controls. Supply Line needs named pad, region, hangar and finish rows; show pending open-line cells separately from closed credit. Safe Return needs not-started, awaiting-return and returned phases, plus the clean finish. Keep the live summary compact and put detailed rows in pause/brief. At 390×844, 844×390 and 1280×720 CSS viewports, verify Start, Resume and Continue remain reachable. Repeat muted, reduced-effects and configured keyboard/controller navigation. Use actual configured action labels rather than fixed key letters. Distinguish simulated inputs, browser observations and physical-device tests. A normal victory still grants its picture independently of the optional checklist.

## 6. Keep current labels, historical metadata and late awards distinct

> Confirm all three goals register only for `homeward-skies/1/0d01f5687b3c38ff`: `homeward-01` / `level-v1-5983ec4eaf745012`, `homeward-02` / `level-v1-f1c1d86b070b5419`, and `homeward-03` / `level-v1-03b703a6160004fc`. All use map revision `1`, roster `roster-v1-e159e435` and core v2. Change a map or roster while retaining its textual IDs: no built-in goal should register. Import structurally valid records with different definition ID/revision/hash or map/roster identity: preserve them as archived. Verify that a frozen v0.7 library reader can preserve opaque compatible v2-definition records while its definition resolver rejects v2 documents. Delay a live check across next-mission selection, import/Undo and pack replacement; retain same-profile results, cancel stale generations, avoid duplicate writes and preserve pictures on capacity/storage failures. Imported JSON is not a new award capability.

## 7. Reskin the same equipment goals across four worlds

> Prepare four presentation briefs for the same supported Supply Line or Safe Return rule: fictional Ukrainian FPV equipment, Ukrainian embroidery/history, an original 80–90s arcade cabinet aesthetic, and a Coupa-inspired spend-management scene with original or approved branding. Keep core actors, pad/region/hangar references, geometry, class recipes and goal facts identical. A character or image swap grants no resistance, ammunition or stun. Use an original small seal motif that stays legible with static/reduced effects and text labels. Separate ordinary display captions from definition metadata: changing a definition's name or description changes its hash and needs reviewed exact-content registration. Preserve provenance and existing records; do not claim real combat effectiveness or measured client savings.

## 8. Propose pack authoring or another goal without pretending support exists

> Produce a reviewable design for a future data-only pack-masteries editor, using the existing pack plan as the starting point. Identify the new explicit pack/scenario versions, reference validation before media decoding, registration precedence, definition-only replacement cancellation and ordinary-v1 round-trip behavior that still need implementation. Keep the finite v1/v2 definition recipes intact. If proposing a scan, net, path-pattern or staged-boss goal, separately specify missing authoritative facts, action order, positive/control routes and suspend boundaries. Do not add a `masteries` field to a supposedly valid `xonix-pack.v1`, claim that a v2 definition implies a pack-v2 importer, or silently mutate an old campaign to make a future example run. Theme/mockup work may proceed as labeled design artifacts while the new contract remains proposed.

Run the actual relevant `game/test/mastery*.test.mjs`, session, replay, library/backup and pinned compatibility tests for implemented changes; inspect newly added test files rather than assuming a fixed count. Keep ordinary route proofs and old expectations unchanged. Browser/visual checks, frozen-release reproducibility and physical-device evidence are separate claims. These prose prompts do not change the machine-readable prompt catalog or authorize publication.
