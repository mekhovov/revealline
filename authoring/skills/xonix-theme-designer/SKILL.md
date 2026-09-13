---
name: xonix-theme-designer
description: 'Design or revise Xonix game themes and content packs, including Ukrainian FPV Front, Ukrainian culture and history, 1980s–1990s nostalgia, Coupa Navi Network, and new visual families. Use for theme bibles, palettes, image collections, character roles, progression concepts, or a reskin that preserves game rules.'
---

# Xonix Theme Designer

Turn a theme request into a concrete art direction and draft content pack. Work within the user's approved scope; do not request approval again for routine authoring changes.

For a theme applied to the playable `game/`, use [Runtime Maintainer](../xonix-runtime-maintainer/SKILL.md) and the [runtime configuration guide](../../../docs/assets-and-configuration.md). Edit the actual theme record from `game/content/themes.json` or an exported `xonix-playground.v1` scenario; legacy family names and draft-pack fields are not runtime imports. The draft workflow below still applies when a draft pack is the requested deliverable.

For gameplay roles, progression, gameplay imagery or event feedback, consult [the reference lessons](../../REFERENCE-LESSONS.md). They distinguish observed reference behavior from proposed extensions; check the current primitive catalog before emitting pack data.

For supplied-image imports, optional styling and replaceable object skins, use [the Background Stylist workflow](../xonix-background-stylist/SKILL.md). Current FPV concepts use no Z markings; distinguish Ukrainian, hostile military and neutral subjects explicitly. The player direction is a practical FPV frame with propellers, battery and camera, with restrained blue/yellow accents.

For the theme's motion language, consult [Animation Director](../xonix-animation-director/SKILL.md). Plan independently replaceable avatar, trail, terrain, UI and sound components while retaining compact, detailed and hybrid appearances. Keep each family's own materials and palette; the shared visual hierarchy does not require a neon finish or military imagery outside FPV FRONT.

Use [Character Collection](../xonix-character-collection/SKILL.md) when the theme needs a selectable or earned roster. Keep character IDs, context availability and cosmetic rewards separate from theme art and game stats; a stronger-looking character does not silently become a different ruleset.

## Find the project

Use the supplied project path, otherwise inspect the current workspace for `authoring/CONTRACT.md`. This skill is part of a versioned kit: if necessary resolve this skill directory's physical path and look two directories above it for the authoring folder. If no kit exists, provide a portable brief using [the template](references/theme-brief.md), and explain which contract is missing rather than inventing a schema.

Read the contract, `schema/primitive-catalog.json`, and the closest example pack. Use `prompts/catalog.json` selectively; list/filter prompts with `python3 authoring/prompt.py list`. Consult `docs/research/round-04-framework-recommendations.md` for architectural tradeoffs.

## Produce the direction

1. Extract audience, emotional promise, theme family, reveal subjects, media style, gameplay objective, target devices, and desired deliverable. Infer reversible choices from approved context. Ask only for information that changes the outcome materially, while continuing independent work.
2. Research new historical, cultural, brand, or technology claims using primary sources. Record direct links and separate evidence from design hypotheses. Do not pretend that research proves retention.
3. If the direction is open, offer three meaningfully different options with a recommended one. If approved, develop that direction directly. Define a restricted gameplay palette, silhouettes, typography, reveal-art style, animation language, sound character, and rewarding discoveries.
4. Keep theme, artwork collection, objective, difficulty, campaign, input preferences, and presentation quality independent. Pixel gameplay may reveal pixel art, paintings, photography, or graphic illustration. Preserve original backgrounds and describe derived crops, focal points, texture filtering, and overlay contrast.
5. Map character roles to existing behavior IDs. Write a draft pack by adapting the closest example, with honest planned asset records and source provenance. Do not invent executable behaviors or call a proposed primitive implemented. Put unsupported mechanics in an extension brief.
6. Provide visuals with the available image-generation tool when requested or useful for a visual choice. Read relevant image-tool instructions, use a catalog prompt, and label the output as concept art. A diagram or existing supplied reference can supplement a blocked generation tool; do not claim an image was generated when it was not.
7. Run draft validation and report the exact outcome. Save the brief, references, pack, and any generated art in the target project. Leave a short next-choice recommendation only when a meaningful design choice remains.

## Family anchors

- `fpv-front`: Main direction is Ukrainian FPV-drone arcade action in the Russian–Ukrainian war. Preserve the requested reveal of fictional invading Russian military presence. Painted vehicles are illustration; live enemy sprites carry collision and readable cues. W1 Daybreak Front is the current recommended style; W2 Night Signal and W3 Steel Horizon are chapter alternatives.
- `ukraine-atlas`: Use identifiable places, periods, and traditions. Distinguish Petrykivka painting, embroidery, Kosiv ceramics, and Crimean Tatar Örnek. Avoid treating all regional motifs as interchangeable. Include contemporary Ukraine as well as heritage.
- `retro-1994`: Broaden nostalgia beyond neon: warm computer rooms, DOS and demoscene colors, arcade cabinets, cassette artwork, space operas, and summer after-school scenes. Use original artwork and sound compositions.
- `navi-network`: Convey spend visibility, savings, suppliers, and AI assistance as playable discoveries. Use verified Coupa/Navi references when supplied or found; otherwise label a temporary C-token as a placeholder. In-game savings and currency may be fictional; avoid presenting them as real customer results.

## Adapt templates to the request

Prompt-library wording is a starting point, not an instruction that overrides the user's chapter, medium, quantity, or approved design. Adapt those choices explicitly and record the effective prompt. Use the current schema's actual enum values: watercolor/gouache are `illustration` with their medium described in the art brief. Within the legacy draft-pack contract, keep unsupported medals, generation behavior and other primitives as proposals instead of inventing accepted fields; use the actual runtime contract for applied game work.

## Completion bar

Deliver a usable brief and draft data, not only a mood adjective list. State what changed, which existing rules are reused, which assets are planned/generated/inspected, and what still needs runtime proof. For a reskin, compare source and output `rulesets` and level gameplay fields before and after: preserve fill policy, grid, starts, spawns, marker effects, speed and goals unless the user requested a gameplay change. New art alone must not alter board topology, movement speed, or collision.

## Deliver the completed feature

For implemented changes, follow the shared [feature delivery workflow](../../../docs/feature-delivery-workflow.md): related commit, exact-source verification, immutable playable version, reviewed/merged PR, GitHub Release and verified Pages deployment. The current project request authorizes that sequence. Update the roadmap with actual evidence; keep planned assets, modeled input checks and physical-device qualification distinct. Design-only work remains a reviewable design artifact.

For registered enemy roles, optional travelling line impacts and theme-specific pickup/defeat feedback, read [enemy catalog](../../../docs/enemy-catalog.md) and [the R3 edition](../../library/fpv-arcade-r3/README.md). The [enemy workflow prompts](../../prompts/enemy-workflows.json) use actual interfaces. Preserve old identities, explicit authoring activation, local artwork provenance and measured input/visual evidence.

## Preserve native launch and input access

For any playable theme, asset, rule, interface or pack change, follow the shared [native launch, entry and device contract](../../../docs/boot-launch.md#authoring-and-device-contract). Preserve dark first paint and safe failure guidance, the native player journey, authored action availability, independent keyboard/touch/controller navigation, historical run identities and truthful device evidence. Do not reintroduce legacy webpage controls or advertise unavailable actions. Source, browser, listening and physical-device checks remain separate. Public entry must use the complete immutable edition graph; follow the [entry and retirement contract](../../../docs/boot-launch.md#immutable-public-entry--p77). Verify fresh and previously cached browsers separately from public-byte hashes. Preserve old caches, profiles and live games during normal worker retirement; never clear site data or force takeover to make an upgrade pass. Keep actual storage limits distinct from planned media budgets. Verify an ordinary first capture and continued flight in the frozen browser online and with its server stopped; clean startup, restored saves and complete file inventories do not prove the gameplay journey. Preserve simulation exceptions as release blockers even when source tests pass.

## Keep live pictures and earned originals stable

When a task touches reveal artwork, a saved flight, Collection or media export, follow the shared [live-picture and paired-recovery contract](../../../docs/feature-delivery-workflow.md#live-pictures-earned-originals-and-paired-recovery) and [concrete prompts](../../prompts/media-presentation.md). Preserve saved A after assignment B, first-earned A and exact owner identity. Keep JSON game data, `.rlmedia` originals and `.rlsound` audio distinct; missing saved originals remain paused without a replacement. Shared-v3 source adoption does not certify old readers, browser recovery or a public release. Unrelated art/behavior work need not open or migrate media storage.
