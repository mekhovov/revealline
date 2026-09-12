# Round 18 — data-only mastery definitions in expansion packs

**Plan only; no runtime or file format changes are implemented by this document.** The smallest useful extension is an explicit `xonix-pack.v2` carrying bounded mastery definitions outside its maps, followed by a practice-scenario v2 that can preview one authored definition. Keep original v1 packs, normalized levels, campaign keys, scoreboards, replay v3 and the Steady Signal record identity unchanged. Supply Line and Safe Return require their separately reviewed observer extension before packs can use them.

Scheduling is explicit: the next intended bounded v0.8 increment first implements the measured [Supply Line / Safe Return observer plan](round-18-equipment-mastery-plan.md) through pinned built-in sidecars. Pack v2 is a **separate later implementation**, not a prerequisite or extra requirement for that release. Its registration layer should consume the finite definition versions that have actually been implemented by then.

This plan follows the current [`packs.mjs`](../game/packs.mjs), [`content.mjs`](../game/content.mjs), [`imports.mjs`](../game/imports.mjs), [`playground/model.mjs`](../game/playground/model.mjs), [`playground.mjs`](../game/playground/playground.mjs) and [pinned mastery lookup](../game/ui/mastery-view.mjs). It is a design for review, not release evidence or a promise of physical-device behavior.

## Compatibility decisions

| Contract                | Proposed treatment                                                                                                                                                                     |
| ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `xonix-pack.v1`         | Preserve its exact allowed fields, validation and output version. A new mastery field still rejects. Do not auto-upgrade or add `masteries: []`.                                       |
| `xonix-pack.v2`         | Same existing fields plus required `masteries`, an array of definition documents. Continue to require `engine: 'xonix-core.v2'`. No script, URL loader or new simulation type.         |
| `xonix-pack-library.v1` | Keep the wrapper; dispatch each member's explicit supported pack version. Old clients reject unsupported v2 members rather than silently stripping definitions.                        |
| Levels and campaigns    | Keep `xonix-level.v1` and `xonix-campaign.v1` unchanged. No mastery fields or default arrays inside their normalized data.                                                             |
| Definition v1           | Preserve exact Steady Signal canonicalization and `mastery-v1-2e6aae3f42f3d3c2`. Support its existing two-predicate recipe.                                                            |
| Proposed definition v2  | Add only the approved finite Supply Line and Safe Return recipes. The serialized definition version participates in the existing `mastery-v1-` content digest. No expression language. |
| Records/library         | Keep `xonix-mastery-record.v1` and `xonix-library.v2`. Existing complete setup and definition identities distinguish new seals; no new migration is needed.                            |
| Replay/session/backup   | Keep replay v3, state-v2 checkpoints, session v1 and backup v1. Observe new supported facts outside simulation state; rebuild preview from recorded input.                             |
| Practice scenario       | Keep v1 exact. Optionally add explicit `xonix-playground.v2` for an authored preview definition; never reinterpret v1 files or make practice eligible for awards.                      |

Do not globally replace the existing `PACK_VERSION` constant with v2 and accidentally relabel old exports. Add explicit supported-version dispatch and an opt-in v2 authoring path. Preserve a prepared pack's original format when exporting its library. Preparation already returns owned, frozen data through a WeakSet boundary; registration must use those validated values, not an unprepared object with the right strings.

## Smallest pack-v2 shape and limits

Add one top-level `masteries` field containing **definitions**, not earned record metadata. A v2 pack must provide it; `[]` explicitly means no pack-authored goals. Each definition keeps its existing `campaignId` and `levelId`. Maps gain no back-reference, so the same definition is not duplicated across a list and a map field.

Proposed bounds, subject to implementation review:

- At most one definition per `(campaignId, levelId)` in a pack, matching the current one-goal HUD and award job. At most 128 definitions per pack, within the existing 128-map limit.
- Definition IDs unique within the pack; IDs, text, supported versions and predicate composition use the shared definition resolver.
- At most 8 KiB per definition, matching the observer boundary, and 256 KiB across all definitions. These limits are **inside**, not added to, the existing 24 MiB pack and 48 MiB installed-library budgets.
- Keep current limits of 12 installed packs, eight campaigns/pack, 40 recipes/pack and existing decoded-image budgets. Keep structural limits enforced across the complete pack; do not enlarge them automatically to accommodate an invalid candidate.
- All references remain local to the definition's owning campaign and map. Exact-version dependencies still express installation requirements; they do not authorize a definition to read another pack's pads, actors, maps or code.

The delta below is illustrative, not a complete importable pack:

```js
{
  format: 'xonix-pack.v2',
  // Existing required pack fields remain present and unchanged.
  masteries: [STEADY_SIGNAL] // A full data document in a real JSON file.
}
```

Preserve v1 definition documents as v1 even inside a v2 pack. Wrapping the unchanged Steady Signal definition in a different pack format must not change its definition hash or existing mastery records. The pack ID/version and asset hashes do not become part of the mastery record's setup identity.

Retain the existing **`mastery-v1-` plus 16 lowercase hexadecimal digits** encoding for definition hashes. That prefix names the current content-digest algorithm; it does not assert that the embedded definition schema is v1. Canonical `definition.version` participates in the digest, so v2 documents receive distinct hashes without changing record v1 or library v2. Do not introduce a `mastery-v2-` prefix merely for the new definition version. Test that a v0.7 library reader can preserve a new compatible record as archived metadata while still rejecting a new unsupported definition document; imported metadata is not award authority.

## Definition and reference validation before image decoding

Use one pure context resolver shared by pack preflight, scenario validation and verified gameplay setup. It should consume a resolved definition plus the existing normalized map and the campaign's **filtered** class roster. Do not duplicate predicate parsing in `packs.mjs` and the UI. The core validator remains responsible for valid map geometry and unique actor IDs.

The planned finite recipes, coordinated with the observer design, are:

| Recipe                    | Definition fields within `all`                                                                                             | Exact reference checks                                                                                                                                                                                                                          |
| ------------------------- | -------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Existing Steady Signal v1 | `clean-win`; `resistant-cut-cells {zoneId, minCells}`                                                                      | `zoneId` exists in this map's `signalZones`; the campaign roster contains actual signal-resistant equipment.                                                                                                                                    |
| Proposed Supply Line v2   | `supply-pickups {padIds}`; `suppressed-region-crossings {regions:[{zoneId,minCells}]}`; `hangar-switch {hangarId,classId}` | Pads resolve to `supplies`, regions to `signalZones`, hangar to normalized `hangars`, and target class to the filtered campaign roster. At least one usable supply-consuming field recipe and a distinct switchable starting recipe must exist. |
| Proposed Safe Return v2   | `clean-win`; `live-cut-impact {actorId,minTrailCells}`                                                                     | Actor resolves to a supported non-`patrol` enemy on this map; the campaign roster contains an actual `impact-pulse` recipe. A border patrol, objective or decoration is not an interchangeable target.                                          |

Every recipe still requires a final winning attempt. Supply Line's `padIds` and `regions` are proposed as 1…4 unique references, canonicalized by stable ID. Its regions each require their threshold within **one successfully closed live cut**; different regions may use different successful cuts. The existing measured routes provide west four/south three cells, so two-cell region thresholds have positive proof candidates. Failed or redeployed cuts discard their pending crossings. These are proposed v2 semantics, not currently accepted v1 fields.

Initial named Homeward references are `west-supply`, `south-supply`, `west-emitter`, `south-emitter`, `south-hangar`, target class `carrier`, and Safe Return actor `cable-cutter`. Read and resolve the actual owning map; matching an ID found somewhere else in the pack is insufficient. Definition `campaignId` must resolve exactly once, `levelId` must belong to that campaign, and every referenced object must have the appropriate domain/type. Reject unknown, duplicate, wrong-map and wrong-type references before calling the first image decoder.

Use `normalizedLevel` to resolve an omitted default hangar. Its ID is derived collision-safely by existing code; do not hardcode `home-hangar` or materialize it back into the source map. If an edit changes that derived ID, a stale reference must fail validation. Prefer explicitly authored hangars for new named goals. Geometry overlap, available supplies and the existence of a capable recipe are necessary checks, not a solvability proof; positive/control routes remain required.

The definition-v2 resolver's proposed nested `regions` shape needs depth five and array bound four; the enclosing replay observation request needs depth six and array bound four. Audit the pack, scenario and observer copies for the same shape. Do not leave a deeper supported document valid in one importer but rejected by a shallower replay boundary. Preserve the 8 KiB definition budget and reject getters, unknown properties, prototypes, sparse arrays and nonfinite values before any await or allocation.

## Registration, duplicate campaigns and fallback

`resolvePackCampaign` should return the selected campaign's resolved definitions **alongside** `campaign`, not attach them to `campaign` or `level`. Build an owned registration index from the prospective prepared installed library. Each registration derives the existing `campaignKey(campaign)`, normalized level identity/revision, roster hash, ruleset and canonical definition identity. Never trust authored hashes as proof of those values.

The current app deduplicates catalog entries by campaign key, and gallery lookup uses that key rather than choosing a pack source. Keep that model for this increment. Before adoption, reject a prospective pack set if two entries with the **same campaign key** disagree about their effective per-map definition, including a definition versus no definition. Identical canonical registrations can share that board. Do not silently pick the first/last pack or merge predicates. Supporting competing goal catalogs for the same board through a new source selector is a larger later UI change.

Resolve effective definitions as follows:

1. **V1 entry:** use only explicitly shipped, exact-content built-in fallback registrations. V0.7 contains Steady Signal at `homeward-skies/1/0d01f5687b3c38ff` plus `homeward-01`; the earlier scheduled v0.8 observer increment may add its separately reviewed pinned registrations without changing the v1 pack. No v1 pack supplies an authored definition field. Same textual IDs with changed content do not inherit a built-in goal.
2. **V2 entry:** use its explicit per-map declaration, or none if omitted from `masteries`. Do not inject the v1 fallback into v2. This makes explicit removal possible and prevents a supposedly disabled goal from reappearing.
3. **Same-ID replacement:** remove the old pack from the prospective set first, then validate dependencies, budgets and registration consistency for the replacement set. This permits an intentional revised goal on an unchanged campaign without two temporary definitions competing. Installation remains an all-or-nothing adoption.
4. **Ambiguous co-installation:** fail with the pack/campaign/map and conflicting definition IDs. The author can replace the old pack explicitly or create a distinct campaign revision. Do not change existing campaign identity automatically to make the import succeed.

A v2 replacement of Homeward can carry the exact existing v1 Steady Signal plus the separately implemented definitions for the other two maps. That preserves the first seal's identity and all old board keys. If a definition name, description, version or predicates change, its hash changes and older records remain historical. Reinstalling the original v1 Homeward pack restores only the exact built-in fallbacks shipped by that runtime, not declarations from a removed v2 pack.

Keep a pure explicit lookup against the current prepared registration index, with the pinned fallback encapsulated in one place. All app preparation, restore, result, practice and gallery callers must use the same resolution policy. The verifier still receives one installed campaign and one resolved definition; it must not fetch registries from the network or trust a replay-supplied declaration of eligibility.

## What an asset-only change means

Changing `visualOverrides` image bytes, per-map visual overrides, theme palettes/body bindings or a music descriptor outside the level/recipe documents does not change the existing campaign/setup identity. It should retain current seals when the definition is unchanged. Decode images completely before installing any of those replacements.

Be precise about current hashing: `normalizedLevel` preserves existing level fields, and campaign identity includes the full filtered class recipes. Editing a level's name, metadata, `themeId`/`musicId`, geometry or rules, or editing a recipe label/description, can change campaign identity even if the author considers the change cosmetic. This increment must not redefine the old hash to exclude those fields. Use the dedicated presentation fields for substitutions that must preserve identity; otherwise declare the new campaign identity and retain old records as history.

Pack version or provenance metadata changes alone must not manufacture a new mastery setup. Preserve definition hashes independently from pack/asset revisions. No imported image, glyph, costume or theme grants resistance, field supply, impact or a new predicate.

## Optional practice-scenario v2

Pack parsing can land first with v1 definitions. For a complete authoring preview, add `xonix-playground.v2` as an explicit second step: all current fields plus required `masteryDefinition`, either null or one supported definition. V1 stays strict and exports as v1; it must still reject that added field. A v2 scenario with null means no authored preview goal. Do not silently downgrade a goal-bearing scenario and lose its definition.

Validate references against the scenario's actual map and class recipes before decoding assets. For preview observation, derive a clearly practice-only one-map campaign context using the definition's campaign ID, a fixed application-owned preview revision and the actual map/roster. This context is not the original production campaign key of a multi-map pack, is not saved as a production record and never enables awards. The existing v1 preview path can retain its exact-content built-in lookup. A changed v2 scenario can preview an authored definition without pretending it is still the pinned Homeward registration.

`scenarioFromPack` / `entryScenario` should emit v2 when carrying a goal, and preserve an explicitly authored v2/null choice. Keep the definition across theme, presentation, music and image edits. A map/roster edit must revalidate its references; an invalid edit leaves the prior playable scenario intact with an actionable error. A raw-map replacement or interaction preset must not silently keep a definition for another map or silently delete it. Provide an explicit remove-goal edit within the same Undo model.

The model's `prepareDocument` must dispatch v1/v2 packs, the pack-library wrapper and v1/v2 scenarios through their shared validators. Keep stale-job checks, owned snapshots and atomic Undo across current scenario, catalog, active entry and pack library. Existing editor history limits of 20 entries/32 MiB still apply to the larger scenario data. No goal import gets permission to install into the main player's collection from practice.

The existing `expansionFromScenario` creates a new one-map campaign whose ID is currently the level ID. It cannot copy an original multi-map definition unchanged without resolving that campaign reference. Make export target identity explicit: construct the new campaign first, then either retain a matching declaration or produce a visibly retargeted definition with its new identity. Reject mismatches; never silently emit an invalid reference or describe a retargeted hash as the old earned seal. Original catalog export must preserve original v1/v2 packs; export of edited scenarios is a distinct artifact.

## Profile, backup, Undo and replacement lifetime

Library v2 keeps imported mastery records even if their pack or definition is unavailable. Missing, changed or inapplicable definitions produce an archived label; they never turn metadata into a fresh award or delete ordinary pictures. A current label requires a matching current registration's definition ID/revision/hash, campaign/map key, normalized level identity/revision, roster and ruleset. If the picture itself cannot resolve, keep its stored metadata and existing reinstall guidance. Restoring the exact matching content may restore the current label.

Complete backup preparation must validate all contained v1/v2 packs and definitions before using them as the saved-flight campaign catalog. Include valid mixed pack libraries; reject malformed references before image decoding or target writes. Player-profile imports remain metadata-only. A backup containing new definitions may be rejected by old clients while a separate v2 player library can preserve a new definition's compatible record as archived metadata; do not promise old clients can execute that goal.

Pack install/remove/replace, full backup, profile replacement, Undo and page exit invalidate pending mastery jobs before the old Undo snapshot or new content adoption. Keep the queue's profile-generation guard and cancellation epoch, the existing writer lock and journaled storage path. A definition-only replacement can leave campaign key unchanged, so profile generation alone cannot detect it: explicit pack-change cancellation and registry rebuilding are required. Do not let a delayed check against the old declaration commit into the replacement's current-goal display.

An unfinished session stores no mastery counters or declaration. Restore using the currently applicable installed definition and reconstruct its whole prefix. If no current definition applies, restore ordinary gameplay without a goal; if a new current definition applies to the same unchanged map, it evaluates the entire recorded attempt under its own new hash. Expose the currently active requirement on resume. Never combine a previous definition's partial progress with the new one or award retroactively from an old clear.

## Ownership-sized implementation and acceptance

1. **Prerequisite, separate v0.8 scope:** implement and verify the measured Supply Line/Safe Return observers and pinned sidecars from the [equipment plan](round-18-equipment-mastery-plan.md), keeping pack v1 untouched. Their definition versions become available to a later pack layer only after those validators, facts, previews, replay reconstruction and UI exist. Pack work must not delay or silently expand this bounded increment.
2. **Schema/context preflight:** add pack-v2 dispatch with only already-implemented definition versions, bounded context resolution and prospective-registration consistency. Keep existing v1 fixtures and exports unchanged. Test malformed fields, same-ID altered references, unknown versions, array/depth/byte boundaries, local-only references and zero decoder calls on structural failure.
3. **Prepared registration and UI:** derive registrations from validated content, add explicit fallback/opt-out/conflict behavior, wire app/restore/gallery through one policy, and preserve ordinary identity. Test same-ID replacement, duplicate campaign-key conflicts, definition removal/reinstallation, exact current labels and archived imports. Do not add more predicates merely because pack v2 can carry a definition version field.
4. **Practice v2/editor:** carry one preview definition through prepare/export/Undo, validate after map/roster edits, retain presentation changes, and explicitly retarget a new-campaign export. Test v1 rejection, v2 null, original catalog export, stale decode cancellation and lifetime non-writing practice. Exercise actual preview UI separately from schema tests.
5. **Integrated gameplay comparisons:** reuse the implemented Homeward positive/control traces in both policies with definitions sourced from prepared packs, then compare them with the pinned-sidecar results. Include failed-cut/redeploy boundaries, successful pickup versus rejected/full-pad input, accepted versus rejected switches, named actor/domain checks and exact saved-prefix reconstruction. Keep Steady Signal v1 immutable, along with the v0.8 observer expectations once separately frozen.
6. **Persistence and release gates:** verify mixed old/new full backups, source-locked transfer, import/Undo cancellation, failed-write rollback, capacity behavior, gallery focus/live decoration and missing packs. Re-run the old compatibility fixtures without regeneration, then check actual browser workflows, controls, reduced effects and target-host behavior. Freeze a new candidate only after the reviewed implementation and its separate evidence are complete.

The reviewed boundary is authored optional goals using existing fictional arcade mechanics. New simulation physics, arbitrary behavior graphs, remote code/assets, network awards, new currencies, a staged boss and new core/replay versions remain out of scope. See [current mastery](round-17-mastery-increment.md), [verification](mastery-verification-contract.md), [records/migration](mastery-records-contract.md), [sessions](mastery-session-contract.md) and the broader [future mastery/boss plan](round-15-mastery-plan.md).
