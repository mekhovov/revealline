---
name: xonix-pack-reviewer
description: 'Review Xonix theme and content packs for schema validity, asset readiness, reference integrity, supported mechanics, art consistency, device readability, and production handoff. Use before sharing, importing, or promoting a draft pack, and when checking AI-created themes, sprites, backgrounds, audio, or levels.'
---

# Xonix Pack Reviewer

Review against the actual contract and available evidence. Clearly separate a valid authoring document from a working, enjoyable game.

First identify the target format. Review playable `xonix-level.v1`, supported scenario v1/v2 and class/theme data using [Runtime Maintainer](../xonix-runtime-maintainer/SKILL.md), the [core contract](../../../game/core/README.md) and [runtime import guide](../../../docs/assets-and-configuration.md); await validated image decoding before adoption. The Python draft-pack checks below remain valid for legacy packs, but cannot certify a playable scenario, campaign reward or working imported asset.

For gameplay classes and equipment, use [Ability Designer](../xonix-ability-designer/SKILL.md). Check the actual ability registry and its separate format. Explicit class abilities can change declared state; cosmetic swaps cannot. Distinguish sourced reference entries, planned actor roles, working lab targets and integrated territory mechanics. Compare cosmetics within the same class/equipment/turn-policy baseline, and require result identity to retain gameplay-affecting choices.

For gameplay roles, progression, gameplay imagery or event feedback, consult [the reference lessons](../../REFERENCE-LESSONS.md). They distinguish observed reference behavior from proposed extensions; check the current primitive catalog before emitting pack data.

For supplied-image imports, optional styling and replaceable object skins, use [the Background Stylist workflow](../xonix-background-stylist/SKILL.md). Current FPV concepts use no Z markings; distinguish Ukrainian, hostile military and neutral subjects explicitly. The player direction is a practical FPV frame with propellers, battery and camera, with restrained blue/yellow accents.

For animation claims, use [Animation Director](../xonix-animation-director/SKILL.md) and its playback handoff. Inspect actual clips, interruption/loop/pause behavior, separate body/rotor/trail components, and cue timing. Compare compact, detailed and hybrid appearances on the same trace and geometry. A played authoring preview establishes only its documented presentation scope; a contact sheet establishes no working animation, and neither proves game collision or input response.

For selectable or earned rosters, consult [Character Collection](../xonix-character-collection/SKILL.md). Review eligibility, fallback, stable identity, actual applied art and simulated reward evidence separately. The lab collection has its own format and isolated progress; do not validate it as a content pack or call its fixtures real game progression.

For turning-mode reviews, preserve the configured immediate or grid-center buffered policy and use its current documented semantics. Check cosmetic independence in both supported modes: character, recipe, body response and terrain changes must leave each mode's authoritative movement unchanged. Compare within-mode baselines and record the mode with the evidence; differing paths between movement policies are expected, not automatically a defect. Do not claim queue/release/input behavior from a still or silently repair it by forcing immediate turning.

## Locate and inspect

Find the target project's `authoring/CONTRACT.md`, `schema/content-pack.schema.json`, and `schema/primitive-catalog.json`. Resolve this skill's physical path to the versioned kit if needed. Read the pack and requested review scope. Do not assume that a catalog primitive is implemented; inspect its status. Use [the review record](references/review-record.md).

## Run the review

1. Run `python3 authoring/scripts/validate_pack.py PATH --mode draft` for drafts. Use `--mode ready` only to assess actual readiness, never silently promote status. The dependency-free validator supports the checked-in schema subset; it is not a general JSON Schema implementation. Inspect the validator's documented checks before extrapolating its guarantees.
2. Check IDs, capabilities, cross-references, parameter constraints, goal counts, spawn locations, file paths, asset state, and source/provenance fields. Unknown behavior IDs require an extension, not a validation bypass. Planned files are expected in a draft and cannot pass ready review.
3. Inspect supplied/generated imagery with available image tools. Check sprite silhouettes, frame geometry/pivots, alpha, UI readability, trail contrast, reveal crops and focal subjects, and separation of painted subjects from active threats. Distinguish original references, generated concepts, exports, and production assets.
4. Check independent texture filtering for pixel atlases and smooth artwork, decoded media budgets, loading scope, and fallback quality. File existence or a media header cannot prove visual quality, correct licensing, an accurate brand character, or successful rendering.
5. Review consistent board coordinates across device layouts, reachable controls, non-color-only cues, input remapping, text sizes, reduced effects, and music/SFX controls. If no running build exists, mark these untested with a concrete future check. Never certify touch, controller, collision, frame rate, fairness, or retention from a concept sheet.
6. Review theme fidelity against the user's brief and the sources used. Preserve the requested FPV military reveal, regional specificity in Ukrainian traditions, wider retro nostalgia, and honest fictional business outcomes. Verify unfamiliar claims using primary references when necessary.
7. For actual audio, inspect and audition it before claiming loop quality or cue clarity. For planned audio, review only the brief.
8. Fix reversible issues within the requested review scope when authorized, then repeat only the affected checks. Return findings by practical impact with file locations and concrete remedies. Do not add speculative permission gates.

## Report four separate outcomes

- **Data contract:** validation passed/failed, exact command and scope.
- **Asset review:** inspected / partially inspected / planned; list evidence.
- **Runtime behavior:** tested with build and device details, or not tested.
- **Design hypotheses:** which playtest questions remain.

A clean data check never warrants saying the game or asset pack is production ready by itself.

## Review optional goal containers

Use [the pack contract](../../../docs/pack-mastery-contract.md) and [context resolver](../../../docs/mastery-catalog-contract.md) for explicit pack v2 and scenario v2. Check local references and actual filtered capabilities, one supported finite goal per map, required explicit none, bounded nested data and all prospective conflicts before adoption. Preserve v1 fields/output and frozen definition identities. Artwork decoding must follow structural/reference checks; an installed or decoded pack is not a solved challenge.

Review the actual playground copy/edit/clear/Undo and one-map retargeted export. Test positive, ordinary and omitted-action traces in both policies, current versus archived gallery labels, save-prefix reconstruction after goal replacement, and no reward writes from practice. Confirm base-campaign conflicts reject before storage changes, and old-format clients reject unsupported packs honestly. Use [Round 19 prompts](../../prompts/round-19-pack-goals.md) for examples; their schema-valid variants still require playtesting.

## Deliver the completed feature

For the isolated [still-picture identity foundation](../../../docs/media-presentation.md), use [the bounded review prompts](../../prompts/media-presentation.md). Check actual execution-to-base ownership including Gentle's derived map revision, explicit per-theme assignment, retained immutable history and old-art fallback on missing context or media. Revisions must not modify campaign/level/roster, score, replay or existing strict gallery fields. Header/metadata validation cannot certify bytes or decoded pixels; require real decoding at an eventual import boundary. These sidecar documents are not pack fields and do not yet integrate storage, host rendering, optional downloads or complete backups. Keep source-art and browser/device acceptance separate.

For implemented changes, follow the shared [feature delivery workflow](../../../docs/feature-delivery-workflow.md): related commit, exact-source verification, immutable playable version, reviewed/merged PR, GitHub Release and verified Pages deployment. The current project request authorizes that sequence. Update the roadmap with actual evidence; keep planned assets, modeled input checks and physical-device qualification distinct. Design-only work remains a reviewable design artifact.

For registered enemy roles, optional travelling line impacts and theme-specific pickup/defeat feedback, read [enemy catalog](../../../docs/enemy-catalog.md) and [the R3 edition](../../library/fpv-arcade-r3/README.md). The [enemy workflow prompts](../../prompts/enemy-workflows.json) use actual interfaces. Preserve old identities, explicit authoring activation, local artwork provenance and measured input/visual evidence.

## Preserve native launch and input access

For any playable theme, asset, rule, interface or pack change, follow the shared [native launch, entry and device contract](../../../docs/boot-launch.md#authoring-and-device-contract). Preserve dark first paint and safe failure guidance, the native player journey, authored action availability, independent keyboard/touch/controller navigation, historical run identities and truthful device evidence. Do not reintroduce legacy webpage controls or advertise unavailable actions. Source, browser, listening and physical-device checks remain separate. Public entry must use the complete immutable edition graph; follow the [entry and retirement contract](../../../docs/boot-launch.md#immutable-public-entry--p77). Verify fresh and previously cached browsers separately from public-byte hashes. Preserve old caches, profiles and live games during normal worker retirement; never clear site data or force takeover to make an upgrade pass. Keep actual storage limits distinct from planned media budgets. Verify an ordinary first capture and continued flight in the frozen browser online and with its server stopped; clean startup, restored saves and complete file inventories do not prove the gameplay journey. Preserve simulation exceptions as release blockers even when source tests pass.

For retained original stills, apply the [media storage contract](../../../docs/media-storage.md): verify exact stored owner snapshots and immutable history inside the final generation-checked transaction. A retained owner authorizes historical identity validation, not pack installation, new rules, scores or arbitrary new assignments. Models of v3 migration are distinct from browser upgrade and recovery evidence.
