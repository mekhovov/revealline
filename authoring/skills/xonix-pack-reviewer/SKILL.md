---
name: xonix-pack-reviewer
description: "Review Xonix theme and content packs for schema validity, asset readiness, reference integrity, supported mechanics, art consistency, device readability, and production handoff. Use before sharing, importing, or promoting a draft pack, and when checking AI-created themes, sprites, backgrounds, audio, or levels."
---

# Xonix Pack Reviewer

Review against the actual contract and available evidence. Clearly separate a valid authoring document from a working, enjoyable game.

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
