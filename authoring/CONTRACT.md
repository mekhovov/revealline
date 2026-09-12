# Content authoring contract — version 0.1.0

This document governs the **legacy draft content-pack format**, preserved as a validated design foundation. Its catalog records specifications and all four example packs remain drafts with planned production assets. Statements below about future simulation, generators or medals describe this draft contract's integration status, not the capabilities of the newer playable game.

The implemented [game](../game/README.md) uses `xonix-level.v1` levels, a `xonix-campaign.v1` campaign, its own theme/class data and `xonix-playground.v1` import/export scenarios. Its capture, medals, seeded candidate generator, editor and static build are described by the [core contract](../game/core/README.md), [assets/configuration guide](../docs/assets-and-configuration.md) and [development guide](../docs/development.md). There is no automatic compiler from this draft schema, media library or motion-lab format. Use [Runtime Maintainer](skills/xonix-runtime-maintainer/SKILL.md) when changing applied game content, while retaining this validator for draft packs.

The [Round 05 gameplay audit](../docs/round-05-gameplay-direction.md) adds design recommendations, not new draft-v0.1 capabilities. Local terrain, changing-contour patrols, claimed-space enemies, erosion, contact pickups, timed statuses and medal evaluation remain [explicit extension requests for this catalog](challenges/round-05-reference-adjustments.md). Similar names in the newer core do not establish identical semantics or draft-pack compatibility. The existing schema and behavior IDs retain their meanings.

Round 06 adds a [separate media authoring format and working import tool](media/README.md). It preserves originals, registers derivatives and binds visual roles, but is not yet compiled into this content-pack format or a runtime. All four draft theme image policies now allow pixel art, illustration, photography and scanned art. [Current design and integration boundaries](../docs/round-06-assets-and-gameplay.md).

## Files and commands

- `schema/content-pack.schema.json`: Draft 2020-12 JSON Schema for the pack shape.
- `schema/primitive-catalog.json`: registered fill, goal, enemy, modifier and effect IDs with parameter schemas and precise intended meaning.
- `examples/fpv-front.pack.json`: main Ukrainian FPV military direction, image discovery and relay objectives.
- `examples/ukraine-atlas.pack.json`: botanical illustration, relaxed timing, and a separately planned licensed photograph with pixel sprites.
- `examples/retro-1994.pack.json`: pixel artwork, timed score pursuit and collectible disks.
- `examples/navi-network.pack.json`: business-city illustration, cost-leak objectives and explicitly fictional savings.
- `scripts/validate_pack.py`: dependency-free contract and semantic validator.
- `scripts/build_contract.py`: maintainer regeneration utility. It overwrites the schema/catalog and four examples; do not run it over authored revisions without updating its source.

Run from the repository root:

```sh
python3 authoring/scripts/validate_pack.py
python3 authoring/scripts/validate_pack.py authoring/examples/fpv-front.pack.json --mode draft --json
python3 authoring/scripts/validate_pack.py --self-test
python3 authoring/scripts/validate_pack.py --help
```

`--mode ready` intentionally fails on current examples. Exit codes are 0 for success, 1 for invalid data/self-test failure, and 2 for file/JSON/contract errors. The script does not access the network or execute pack-provided code.

## Pack shape

```json
{
  "schemaVersion": "0.1.0",
  "contentVersion": "0.1.0",
  "id": "fpv-front",
  "status": "draft",
  "title": "FPV Front: Daybreak",
  "summary": "An authoring brief, not a playable release.",
  "requiresCapabilities": ["fill.enemy-seeded.v1", "content.raster-reveal.v1"],
  "theme": {},
  "assets": [],
  "revealArt": [],
  "rulesets": [],
  "levels": [],
  "campaigns": []
}
```

This abbreviated shape is illustrative and is not a valid pack. Start from a complete example. IDs are lowercase dot/hyphen names. IDs must be unique within their collection; all references are local to the pack. `schemaVersion` changes the contract shape, `contentVersion` changes authored content. A future runtime should use a versioned save migration when levels/collections change, and namespace all cache keys as `packId/contentVersion/assetId`.

| Section | Owns | Does not own |
|---|---|---|
| `theme` | Palette, labels, visual/audio asset roles, animation metadata, atmosphere, image acceptance policy | Enemy AI, collision truth, win conditions |
| `assets` | Planned briefs or ready local file references, sprite dimensions, hashes, provenance | Position on a particular board |
| `revealArt` | Source image reference, raster style, crop/focal metadata, caption, protected regions | Destructive editing of originals or collision geometry |
| `rulesets` | Fill policy, input cut mode, lives/time, score, goals and completion logic | Artwork or geography |
| `levels` | Grid, static blocks, starts, enemies, markers and capture effects, modifiers | New executable behavior |
| `campaigns` | Ordered/open level selection and collection reward vocabulary | Platform stores, purchases or external account state |

This separation permits a Ukrainian scene, scanned artwork, photograph, neon pixel image or Coupa city to use the same simulation. The theme can re-label a marker as a relay, flower, disk or invoice. Its capture effect remains an explicit catalog invocation.

## Core rule contract

The current catalog deliberately stays small: 2 fill policies, 4 goal tests, 2 enemy behaviors, 4 capture effects and 2 modifiers. These IDs are specifications for future code, not working components.

- **`fill.enemy-seeded.v1`:** once a cut closes, claim components without live field enemies. A boundary patrol does not preserve interior territory.
- **`fill.keep-largest.v1`:** retain the largest unclaimed component, with a row-major tie rule. Enemies enclosed by the claim are removed without extra score. This offers a different, explicitly selected arcade rule.
- **Goals:** reach a coverage fraction, capture a tagged marker count, reach a score or survive a duration. `completion.mode` combines named goals using `all` or `any`; unused goals may serve later medal logic but do not automatically gate completion.
- **Capture effects:** grant score, disable enemies by tag, add time, or clear a named modifier. These occur once per marker after filling. They do not silently replace the fill algorithm.
- **Challenges:** field bouncers and boundary patrols; per-level speed multipliers or cut timeouts. Military “interference” and business “pressure” may use the same readable, tested primitive with different visuals and timing.

The future simulation must commit a tick in a documented order: input/movement → collision consequences → completed-cut detection → fill → marker effects → score/goal evaluation. Death and completion ties, simultaneous contacts, invulnerability, cut cancellation, maximum time, bounce directions and numerical integration still require a runtime design decision and playtesting. This document does not pretend to have resolved those implementation details.

## Adding content without changing game code

Within the supported capabilities, an author can change titles, palette, audio, role assets, backgrounds, crops, levels, block rectangles, starts, enemies, marker locations, parameters, goal combinations and campaign order. New family ideas use `theme.family="custom"`, an original `theme.id` and the same registered primitives. A new pack need not belong to one of the four initial families.

An entirely new enemy algorithm, goal, shader behavior, economy or fill rule requires a reviewed code extension with its own parameter schema and test cases. Add its versioned ID to the checked-in catalog, extend the semantic checks and have the future runtime advertise it. A pack's `requiresCapabilities` must name all its used primitives and presentation capabilities. Unknown IDs fail validation. Pack downloads may contain data/media only; JavaScript, plugin URLs and expressions are not accepted by this schema.

The optional `level.generation` field records a recipe ID/version, numeric seed and note **as provenance for a materialized grid**. It does not run a generator. The explicit grid, entities and markers remain mandatory and are what validation checks. An editor or AI can author these today; a real deterministic generator and difficulty evaluator are future work. A seed alone is not proof that a map can be completed.

## Mixed artwork and screens

Gameplay sprites remain crisp and use nearest sampling. Reveal art independently supports `pixel-art`, `illustration`, `photograph`, and `scanned-art`; photographs can use linear sampling while foreground sprites remain pixel art. Menus and captions should use real localized UI text instead of letters baked into generated images.

`sourceAssetId` points to the preserved original. Fit can be `contain`, `cover` or an explicit normalized `crop`. The focal point is in original-image coordinates. Explicit crop rectangles must stay inside the source and fully retain every `protectedRegions` rectangle. `cover` needs visual review because source/viewport ratios determine the actual crop. Pixel art requires nearest sampling. The `cropApproved` flag records a completed art review; never set it to true because a generator happened to emit a plausible image.

v0.1 fixes the playable arena to **4:3** and requires grid dimensions in that ratio, demonstrated at 48×36. This is a deliberate first contract decision; future arena ratios need an explicit contract/version extension and separate balance checks. Device aspect ratio does not change the playable grid or objective locations. Portrait controls sit below the whole arena; landscape controls use side space; desktop, TV and ultrawide add surrounding UI/scenery. Breakpoints, safe-area insets, touch target sizes, reduced-motion overrides and controller focus remain the shared platform shell's job. They must not be authored differently in each theme pack.

## Asset lifecycle

1. **Planned:** an asset has an ID, kind, art brief and planned provenance. A file need not exist. Do not invent a path or label a concept montage as a sprite sheet.
2. **Produced and reviewed:** save the original plus appropriate exported derivatives; inspect style consistency, silhouettes, transparency/frames, crop, rights and historical/brand references. The current schema is a minimal manifest and does not yet describe every production editor source or atlas output.
3. **Ready metadata:** set the asset to `ready`, record a workspace-relative path, SHA-256, byte size, dimensions for images, sprite layout where needed, creator/method and `licenseEvidence`. All ready assets are checked even when the pack is still draft.
4. **Ready pack:** all assets must be ready, referenced files/hashes valid, and crop/cover choices approved. `--mode ready` additionally requires the pack itself to say `ready`.

`ready` means that this authoring gate passes. It does **not** mean a shipping game, licensed legal determination, measured accessibility, decoded/working media or approved visual quality. Those require their own runtime and human reviews. The current examples intentionally contain only planned assets, including the Atlas photograph; no production-ready license or artwork is claimed.

## Validation coverage and limits

The checked-in schema declares JSON Schema Draft 2020-12. The bundled command implements only the keywords used by this schema and primitive parameter schemas; it is **not a general Draft 2020-12 validator**. Unknown schema keywords cause an error. The environment's system and bundled Python had no `jsonschema` package; the standalone checker adds no project dependencies. A separate temporary validation environment independently checked the schema, all 14 primitive parameter schemas, four complete examples and 32 parameter invocations with python-jsonschema's `Draft202012Validator`: all passed. A future build pipeline should use a maintained complete validator such as Ajv or python-jsonschema in addition to these semantic checks.

Implemented checks include structure and ranges, unknown properties/primitive IDs, primitive categories and parameters, capability declarations, duplicate IDs, all asset/art/ruleset/level/goal/effect references, local path containment, file existence/hash/byte size for ready assets, declared sprite frame bounds, crop metadata, grid dimensions, blocked rectangles, entity domains/overlaps, four-neighbor static reachability, marker-count feasibility and a score upper bound.

The self-test validates all four drafts and deliberately invalid mutations, including missing refs, impossible marker goals, wrong parameter types, unknown behaviors, script properties, missing capabilities, bad frames/crops, unreachable grid pockets and ready-file tampering. Temporary byte fixtures test metadata/hash behavior only, not image decoding.

Not implemented: dynamic cut/enemy simulation, guaranteed level solvability, procedural generation, image decoding or raster alpha checks, real texture-memory budgets, controller/touch handling, platform exports, runtime performance, localization, content browsing, editor UI, patch delivery or save migration. These remain planned implementation gates. A valid pack supplies design data; it cannot prove the game is fun or runs on an iPhone.
