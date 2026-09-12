# Authored equipment goals in expansion packs

This source increment adds opt-in `xonix-pack.v2` to [packs.mjs](../game/packs.mjs). It carries supported optional equipment goals beside the existing maps. It does not add simulation behaviors, scripts, new score identities or an award authority. The earlier [pack plan](round-18-pack-mastery-plan.md) remains the design history; this document describes the implemented parser and preparation APIs, not release or device evidence.

## Formats and limits

`PACK_VERSION` remains `xonix-pack.v1`. `MASTERY_PACK_VERSION` is `xonix-pack.v2`. V2 has the same existing fields plus **required `masteries`**, an array of complete definition documents; an empty array explicitly means no authored goals. V1 still rejects this field and is not automatically upgraded. Its prepared data and library export bytes remain unchanged for unchanged inputs.

`xonix-pack-library.v1` can contain either supported pack format. Levels stay `xonix-level.v1`; campaigns stay `xonix-campaign.v1`. Definitions never enter those documents. Existing replay v3, session v1, mastery-record v1 and player-library v2 formats remain unchanged. An older client that lacks pack v2 rejects the new pack; it does not silently discard goals.

| Boundary | Limit |
| --- | --- |
| One pack / installed library | 24 MiB / 48 MiB |
| Installed packs | 12 |
| Campaigns / maps / recipes in a pack | 8 / 128 total maps / 40 |
| Mastery definitions in a pack | 128 |
| One definition | 8 KiB and the definition resolver's structural/text limits |
| All definitions in a pack | 256 KiB, within the existing pack budget |
| Assignment | One definition per campaign/map; definition IDs unique across the pack |

The combined definition limit measures encoded JSON before canonicalization. Per-definition checks reject excessive structure, getters, hidden fields, non-plain prototypes, sparse/custom arrays, cycles, nonfinite numbers and unsupported fields. Neither a permissive media budget nor a dependency authorizes executable content. Existing local image formats, image header checks, decoded pixel limits and procedural music descriptor limits remain in force.

## Finite definitions and local references

Both supported definition versions use the existing resolver in [mastery.mjs](../game/mastery.mjs). The data carries all required identity and display fields: `version`, `id`, `revision`, `campaignId`, `levelId`, `name`, `description` and `all`.

| Definition recipe | Local context required |
| --- | --- |
| V1: `clean-win` + `resistant-cut-cells` | The named signal zone and at least one actually signal-resistant recipe |
| V2 Supply: `supply-pickups` + `suppressed-region-crossings` + `hangar-switch` | Named supply pads, signal zones, hangar and target class; a distinct switchable recipe; supply-consuming field equipment; equipment that can suppress signal regions |
| V2 Safe Return: `clean-win` + `live-cut-impact` | The named supported interior actor and an `impact-pulse` recipe; a border patrol cannot serve as this target |

Supply can use a supply-consuming stun or slow field. Suppression requires a stun field or impact pulse. These capabilities may come from different available recipes. Context checks are necessary structural conditions, not proof that a map or optional route is solvable. All predicates still need their implemented event/sequence conditions and a final win. See [the equipment goal guide](equipment-seals.md) and [observer contract](mastery-observer-contract.md).

References resolve only within the owning campaign and map, using its filtered class roster in original recipe order. Another campaign's similarly named object or an installed dependency cannot satisfy a missing reference. Omitted hangars use the core's collision-safe normalized default; validation never writes that default back into the source map. An author who names a derived hangar must update the reference if another object changes that derived identity.

Pack preflight uses [mastery-catalog.mjs](../game/mastery-catalog.mjs) for shared context checks. It validates a campaign's definitions together so the full campaign is not repeatedly normalized for every goal. The helper creates no gameplay ticks or storage writes and imports neither pack parsing nor UI modules.

## Canonical identities and substitutions

Canonical definition ordering uses the existing resolver. The hash remains `mastery-v1-` plus 16 lowercase hexadecimal digits; the prefix names the digest algorithm, while canonical `definition.version` participates in its input. The unchanged Steady Signal definition retains `mastery-v1-2e6aae3f42f3d3c2` inside a v2 pack.

Pack format, version, provenance and presentation assets are outside the existing campaign identity. Uploading a different image, changing a theme palette or changing an external music descriptor can preserve the board and goal identities. Editing a normalized level field or class recipe can change the existing campaign hash, including seemingly cosmetic names or recipe descriptions. This increment does not redefine those older hashes. Changing a definition's name, description or predicates changes its definition identity independently of the map.

## Effective registrations and conflicts

V1 entries use only the shipped exact-content fallbacks. Current Homeward registrations are pinned to `homeward-skies/1/0d01f5687b3c38ff`; same textual IDs on edited content do not inherit them. V2 entries use only their authored declarations. A missing declaration for a map in a v2 pack means **none**, even if that map otherwise matches a built-in fallback.

The existing collection and catalog identify a board by campaign key and map. Consequently, two installed entries with the same campaign key must agree about each map's effective definition, including none. Identical canonical declarations may coexist; conflicting definitions or a definition versus none reject. The error identifies both pack sources and the map. Installation does not choose first/last, merge predicates or invent a new campaign revision.

For a same-ID replacement, preflight removes the older pack from the prospective set first. Authors can therefore intentionally replace a definition or remove it while retaining the map identity. Dependencies and aggregate budgets are checked against that same proposed replacement set. Other installed copies of the board must still agree. Reinstalling the original v1 pack restores only its shipped fallback behavior.

## Preparation, installation and export

`preparePack(candidate, {decodeImage, library})` snapshots and validates the candidate before its first await. `library` is optional for standalone inspection, but an installation UI must pass its **current prepared library** to check the complete proposed replacement before any image decoding. The result remains `{pack, warnings}`.

```js
const before = installed;
const { pack } = await preparePack(fileData, { library: before });
if (installed !== before) throw new Error('Installed content changed; prepare again.');
const next = installPack(before, pack);
// Adopt/persist next through the application's existing guarded storage path.
```

`installPack(library, pack)` still accepts only prepared objects and synchronously rechecks the final set. A pack prepared in isolation cannot know about future destination conflicts. Supplying `library` during preparation moves these checks ahead of decoding; the final recheck remains necessary if the destination changes.

`importPackLibrary(candidate, {decodeImage})` validates **every** pack, local context, dependency, combined budget and catalog conflict before the first decoder call. It then decodes the already-owned documents. A failed decoder or wrong decoded dimensions produces no adopted library. Caller edits during decoding cannot change the prepared definitions. Prepared packs and libraries remain deeply frozen; their WeakSet markers are process-local preparation capabilities, not proof that a player earned a goal.

`removePack` validates the remaining dependency/catalog set. `exportPackLibrary` preserves the wrapper and each member's explicit format. No operation here mutates browser storage. The existing journaled backup/profile writer handles actual application persistence.

The solo app also includes its permanent base campaign in the prospective catalog. Pack-only preparation cannot see this application context: a standalone valid pack may still conflict with the base campaign's no-goal registration. Startup, pack replacement and complete-backup adoption validate the combined base-plus-installed catalog before any persistent mutation. Failed application preflight keeps the previous stored content and profile. The app caches resolved entries and registrations only after successful adoption.

## Resolved campaign and practice output

`resolvePackCampaign(pack, campaignId)` preserves its old v1 return shape. For v2 it additionally returns:

```js
{
  // Existing campaign, classRecipes, themes, artwork, music and sourcePackId.
  sourcePackFormat: 'xonix-pack.v2',
  masteries: [/* owned canonical definitions for this campaign only */]
}
```

The `campaign` and `level` objects contain no mastery fields. Consumers project `{campaign, sourcePackId, sourcePackFormat, masteries}` into `createMasteryCatalog`; omit the two new fields for v1. The shared catalog returns immutable registrations and a `get(campaignKey, levelId)` lookup. Build it when content is adopted, not every animation frame.

With the explicit scenario-v2 validator in [content.mjs](../game/content.mjs), `scenarioFromPack` emits `xonix-playground.v2` for every v2 pack map. Its required `masteryDefinition` is the matching canonical definition or null. This preserves intentional opt-out. V1 packs still emit the original v1 scenario with no added field. Both turning modes, class selection, seed, theme, music and per-map visual overrides retain their existing behavior.

Practice context uses the actual selected map/roster through `scenarioMasteryCampaign`; it is a synthetic single-map preview context, not the original multi-map production key. A scenario definition is never an award capability. Editing and export must keep this distinction and explicitly retarget a newly authored campaign rather than silently stripping or misbinding its goal.

## Persistence and verification boundaries

Player-library imports preserve compatible earned metadata independently of installed definitions. A missing or changed current registration leaves that metadata historical. Current labels require the complete definition, map, revision, roster and ruleset match; importing a record never grants a fresh award capability. Complete backups reuse pack-library validation before adopting included content or reconstructing a suspended flight.

A definition-only replacement can keep the campaign key unchanged. The app cancels queued goal checks and pending restores before profile replacement/Undo snapshots and content adoption, then uses the new cached registrations. Saved flights contain no goal counters: restoration reconstructs the whole prefix with the currently applicable definition, or resumes ordinary play without a goal. Ordinary picture/score/progression awards remain independent.

`masteryFor(campaignKey, levelId, catalog)` uses the supplied catalog as authoritative, including an absent registration. `pictureMasteries(records, picture, definition, recipes, catalog)` uses the same catalog for current versus archived labels. Omitting the optional catalog preserves the original pinned built-in lookup for older callers. Explicit scenario-v2 practice uses its own definition or null, never an installed fallback; scenario-v1 practice retains the exact installed-map-and-roster match. Practice remains excluded from persistent awards.

[pack-mastery.test.mjs](../game/test/pack-mastery.test.mjs) covers v1 bytes/shape, canonical v2 definitions, explicit opt-out, local domain/capability failures, decoded-image ordering, combined limits, conflicting co-installation and base context, same-ID replacement, immutable asynchronous preparation and v1/v2 practice conversion. [Existing pack tests](../game/test/packs.test.mjs) remain unchanged. [View tests](../game/test/mastery-pack-view.test.mjs) cover authored labels, exact identity matching and archived metadata. [Integration tests](../game/test/pack-mastery-integration.test.mjs) compare all three goal types in both turning modes to frozen v0.8 results and exercise mixed backups, restored prefixes, replacement and Undo. These deterministic checks do not certify authoring UI journeys, public hosting, native devices or the enjoyment of a new authored challenge.
