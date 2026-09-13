---
name: xonix-character-collection
description: 'Author selectable and earned Xonix character collections, cosmetic variants, context eligibility, selection fallbacks and applied-asset review. Use when organizing or swapping a roster across games, themes, cases or levels; theme art direction and individual animation production remain separate workflows.'
---

# Xonix Character Collection

Turn character variants into a coherent, reviewable collection. Preserve stable character identity across asset replacements and keep availability, earned progress, selection and presentation separate. Cosmetic changes never alter movement, collider size, capture, damage or scoring. For requested gameplay differences, use [Ability Designer](../xonix-ability-designer/SKILL.md) and a separate validated class/equipment format. Explicit abilities may alter declared state; equipping a cosmetic may not. Distinguish working ability previews from future game rules.

For characters earned or equipped in the playable `game/`, pair this skill with [Runtime Maintainer](../xonix-runtime-maintainer/SKILL.md) and read `game/progress.mjs`, `game/app.mjs` and the [configuration guide](../../../docs/assets-and-configuration.md). That game has its own campaign results and local save format; a `xonix-playground.v1` practice scenario or a simulated lab fixture cannot grant campaign unlocks. The context-selection and collection workflow below remains valid for the separate lab and must not be presented as an automatic game-save migration.

## Establish the collection scope

Find `authoring/CONTRACT.md` and the requested collection, media records and renderer presets. Resolve an installed skill's symlink to its physical kit if needed. Use the shared prompt CLI to inspect `collection-*` records in `prompts/round-08-character-collections.json`. When `authoring/motion-lab/` is present, read its README and actual collection format before writing data. It is an independent authoring preview, not a content-pack extension, game save or proof of production unlocks. Without that preview, provide a portable collection brief and identify which application checks remain unavailable.

Use [the collection handoff](references/collection-handoff.md) when authoring recipes, context rules or an application review. Read only the relevant modes. Use Theme Designer for a new family bible, Asset Creator/Background Stylist for imagery, and Animation Director for component motion when those workflows are present and needed. This skill owns how characters are organized, earned, selected and exchanged.

## Author and apply within the requested scope

- Assign stable character IDs, labels, family, parent/variant relationships, asset references, component recipe, eligibility and acquisition rule. Replace an image or rotor treatment without renaming the character or silently changing its earned state. Keep original media and record derivative provenance and the actual effective prompt.
- Scope choices using the format's accepted context selectors. Distinguish an unrestricted cosmetic collection from a theme-specific, case-specific or challenge-specific roster. State what happens when a selected character becomes unavailable after a context or progress change; use a documented eligible fallback and explain it in UI. Do not silently select a locked or wrong-family character.
- Treat starter, earned, selected, eligible and asset-loaded as different facts. A locked character can have a preview if intended, but previewing is not equipping or earning it. Progress fixtures must remain explicitly simulated and separate from real saves. Replayed clears must not accumulate unintended unlock credit; use the actual evaluator's level identity and best-result semantics.
- Respect the result trust boundary: preview/game mode flags separate namespaces but do not authenticate a run or stop a locally rewritten save. Never reflag a fixture as a production result. A production-unlock guarantee needs a trusted game-result/save adapter and explicit versioned identities; keep that dependency in the game plan rather than claiming the preview already supplies it.
- Keep four families distinct: Ukrainian FPV equipment, specific Ukrainian cultural characters, broader 80s–90s craft/mascots, and Coupa-inspired business characters. Current FPV assets contain no Z markings and have explicit Ukrainian/hostile-military/neutral identity. Label unverified Navi artwork as an original concept or placeholder; do not introduce military enemies into the business family.
- For a requested asset exchange, inspect the replacement, preserve its source, bind it through the existing preview/media format and verify that the intended ID actually paints the new file. Check framing, alpha, occupied pixels, heading and attachment anchors. A successful file load alone does not establish correct visuals. A missing asset needs an honest fallback/status rather than a false readiness claim.
- Keep body, propellers/wing/thruster/pulse, trail and UI portrait independently replaceable where supported. Read the current recipe before applying blade count or other fields. Do not invent accepted properties. Changes to rotor count, phase, visual rate or scale remain cosmetic. Cancel old parts and cues when switching characters or resetting.
- Preserve the authored turn-mode choice when inspecting, equipping or exchanging characters. Immediate and grid-center buffered movement are configurable policies, not character cosmetics. Test swaps within both supported modes against their own movement baselines; use the current preview's documentation for exact behavior and do not add a turn-mode field to collection data that does not accept it.

## Review and hand off

Apply and switch the actual supplied assets in the available preview, then inspect normal size, small viewport, bright/dark artwork, pause/resume and relevant earned/context fixtures. Compare identical geometry and motion across compact/microtile, detailed-object and hybrid terrain. Test the declared fallback and distinguish reviewed scenarios from missing ones. Browser viewport inspection is not native iPhone or controller verification.

Report collection-data validity, media provenance, applied visual review, motion playback, simulated unlock behavior and runtime evidence separately. A template, generated contact sheet, planned reward or working selection preview does not establish a finished character set or implemented game progression. Keep deeper game-plan questions and unsupported stat changes in the design handoff rather than implementing game logic as a side effect.

## Deliver the completed feature

For implemented changes, follow the shared [feature delivery workflow](../../../docs/feature-delivery-workflow.md): related commit, exact-source verification, immutable playable version, reviewed/merged PR, GitHub Release and verified Pages deployment. The current project request authorizes that sequence. Update the roadmap with actual evidence; keep planned assets, modeled input checks and physical-device qualification distinct. Design-only work remains a reviewable design artifact.

## Preserve native launch and input access

For any playable theme, asset, rule, interface or pack change, follow the shared [native launch, entry and device contract](../../../docs/boot-launch.md#authoring-and-device-contract). Preserve dark first paint and safe failure guidance, the native player journey, authored action availability, independent keyboard/touch/controller navigation, historical run identities and truthful device evidence. Do not reintroduce legacy webpage controls or advertise unavailable actions. Source, browser, listening and physical-device checks remain separate. Public entry must use the complete immutable edition graph; follow the [entry and retirement contract](../../../docs/boot-launch.md#immutable-public-entry--p77). Verify fresh and previously cached browsers separately from public-byte hashes. Preserve old caches, profiles and live games during normal worker retirement; never clear site data or force takeover to make an upgrade pass. Keep actual storage limits distinct from planned media budgets.
