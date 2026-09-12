# Mastery context and catalog

Working source after frozen v0.8.0 adds [game/mastery-catalog.mjs](../game/mastery-catalog.mjs), a pure registration boundary shared by pack preflight, authoring and UI integration. It imports core validation and the existing mastery observers; it does not import packs, image decoders, imports, UI or player persistence. Creating a fresh core run validates references without advancing any simulation tick.

This helper validates supported goals and derives display/identity metadata. It is **not award authority or a solvability proof**. Real awards still require the existing installed-content replay verifier and eligible completion context. Images, earned records and whole pack objects are not catalog inputs.

## API

| Export                                             | Behavior                                                                                                                                        |
| -------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `resolveMasteryContext({campaign, definition})`    | Return a new deeply frozen registration, or throw `TypeError` before returning a result.                                                        |
| `createMasteryCatalog(entries)`                    | Own and validate all entries and effective per-map declarations; return frozen `{registrations, get}`. Conflicts reject the complete candidate. |
| `catalog.registrations`                            | Frozen array of effective non-null registrations, deduplicated by campaign key/map.                                                             |
| `catalog.get(campaignKey, levelId)`                | Return that catalog's frozen registration or null. It does not fall back to a global goal after an explicit removal.                            |
| `BUILTIN_MASTERY_REGISTRATIONS`                    | Deeply frozen definitions and exact Homeward identity metadata shipped in v0.8.                                                                 |
| `builtinMasteryRegistration(campaignKey, levelId)` | Exact pinned fallback lookup. Original frozen `STEADY_SIGNAL`, `SUPPLY_LINE` and `SAFE_RETURN` definition references are retained.              |

A registration contains exactly:

```text
campaignKey, levelId, levelIdentity, levelRevision, rosterHash, ruleset,
definition, definitionIdentity
```

Dynamic definitions are canonical owned copies. The three built-in constants remain immutable shared constants; consumers cannot mutate them or their nested predicates. No authored hash, registration metadata or earned record can substitute for the source campaign/definition.

Catalog entry shape:

```js
{
  campaign,                 // Maps and the available classRecipes; no image fields.
  sourcePackId: 'my-pack',  // null for the base campaign.
  sourcePackFormat: 'xonix-pack.v2',
  masteries: [definition]   // Required for v2; [] means explicitly no authored goals.
}
```

V1 entries omit `masteries`. An omitted `sourcePackFormat` is the existing v1/base-entry convention; an explicit null, unknown format or v1 entry containing `masteries` rejects. Callers project only these entry fields from a resolved pack or base entry. The outer pack layer remains responsible for prepared-pack provenance, unique pack IDs, exact dependencies, installation budgets and removing an older same-ID pack before building a replacement's prospective catalog.

## Campaign and reference validation

Campaigns require the existing `xonix-campaign.v1` identity, title, revision and maps. Allowed optional fields are `classRecipes`, `classIds`, `themeId`, `musicId`, and the existing base campaign's `briefs`. Briefs are at most one per map, each a nonblank string of at most 4,096 characters. Campaign title/revision limits remain 160/60. Normal map revision limits remain 80. Practice code should construct its own valid synthetic campaign context rather than copy an 80-character map revision or longer map name into these narrower fields.

Recipes default to existing `CLASSES` only when omitted. If `classIds` is present, validate every ID then filter in **original recipe-array order**, exactly as `resolvePackCampaign` does. The same result is obtained from an already filtered roster. Unknown/duplicate IDs or malformed recipes reject. Excluded pack equipment cannot satisfy a goal's capability check.

Every map is copied and passed through `normalizedLevel`; duplicate map IDs reject. The helper reuses the corresponding observer's fresh setup validation to resolve the definition's campaign, map, zone/pad/hangar/actor references. Normalized collision-safe default hangars are supported without adding them to source JSON. An actor is a real supported field enemy, not a relay or decoration; border patrols cannot satisfy an impact goal.

Necessary roster checks are:

- Steady: at least one actual signal-resistant recipe.
- Safe Return: at least one actual `impact-pulse` recipe.
- Supply: the named target recipe and a distinct possible starting recipe; at least one supply-consuming `stun-field` or `slow-field` recipe; at least one actual signal suppressor (`stun-field` or `impact-pulse`). These can be separate recipes. A slow-field recipe alone cannot suppress interference.

The finite v1/v2 predicate schemas and event meanings remain in the [observer contract](mastery-observer-contract.md). Presence and capability checks do not prove that a pad is reachable, that a particular time limit is fair, or that all thresholds can be met. Authors still need legal positive/control routes.

## Exact identity and fallback policy

The helper repeats the existing `library.campaignKey` projection without importing persistence:

```js
`${id}/${encodeURIComponent(revision)}/${dataIdentity({
  ruleset: RULESET,
  levels: levels.map(normalizedLevel),
  classRecipes: filteredRecipes,
})}`;
```

Tests compare this result directly to `library.campaignKey` for full, filtered and default rosters. Preserve level/recipe order and all fields already included in that hash. Campaign title/briefs remain outside it. Normalized level identity is `level-v1-` plus the existing `dataIdentity`; roster identity uses the unchanged core `rosterHash`; definition identity retains the `mastery-v1-` algorithm, including the canonical definition's version/content. There is no new score or replay identity.

All three fallbacks bind campaign key `homeward-skies/1/0d01f5687b3c38ff`, roster `roster-v1-e159e435`, ruleset `xonix-core.v2` and level revision `1`:

| Map           | Level identity              | Definition identity           |
| ------------- | --------------------------- | ----------------------------- |
| `homeward-01` | `level-v1-5983ec4eaf745012` | `mastery-v1-2e6aae3f42f3d3c2` |
| `homeward-02` | `level-v1-f1c1d86b070b5419` | `mastery-v1-a3ffbfe068645ff0` |
| `homeward-03` | `level-v1-03b703a6160004fc` | `mastery-v1-197b5a9a9370f0f2` |

V1 entries receive only these exact-content fallbacks. A changed map or roster with the same textual IDs does not inherit them. V2 entries use only their explicit definitions; an omitted map in `masteries` has no goal, even on the original Homeward board.

Every map participates in conflict detection, including maps with no goal. Two entries with the same campaign key/map may coexist only when their complete canonical registration metadata agree. This permits an unchanged explicit v2 goal alongside its v1 fallback, regardless of predicate/reference ordering. A different definition or definition-versus-none rejects with both source IDs and the map. The helper never chooses first/last silently, merges predicates or rewrites campaign identity.

Build a replacement against the prospective set after removing the previous same-ID pack. Already created catalogs remain immutable. Reinstalling v1 restores only the current runtime's pinned fallback; removed authored declarations are not remembered. Current gallery labels should consult the active catalog; metadata for an unavailable/changed goal can remain archived independently.

## Bounds and verification

Descriptor-based copying precedes property reads, core validation and normalization. Getters, hidden fields, symbols, arbitrary prototypes, sparse arrays, cycles and nonfinite numbers reject; ordinary null-prototype JSON is accepted. Catalog processing allows 104 campaign entries and 1,664 maps, covering the existing 96 pack campaigns/1,536 maps plus bounded base entries. Individual campaigns remain at most 128 maps/definitions and 40 recipes.

The context-only copy ceiling is 64 MiB/400,000 nodes/depth 20/array 1,664, with strings at most 65,536 characters. It accommodates repeated per-campaign rosters without narrowing the existing 48 MiB/160,000-node installed-pack boundary. It **does not increase pack/import/image budgets**; those are checked by the outer prepared-pack layer. Definitions still pass their own much smaller 8 KiB resolver. For batches, use `createMasteryCatalog` so each campaign is normalized once, rather than calling the single-definition resolver repeatedly.

Run the focused tests:

```sh
mise exec node@22.22.2 -- node --test game/test/mastery-catalog.test.mjs
```

They cover the three frozen identities, exact existing hash projections, roster filtering/defaults, base briefs, local reference/capability validation, normalized default-hangar collisions, explicit opt-out, canonical co-installation, conflicts/replacement, ownership, adversarial data and the full old installed-library campaign count. No test decodes an image, writes player progress, changes a core tick or mutates an archived artifact.
