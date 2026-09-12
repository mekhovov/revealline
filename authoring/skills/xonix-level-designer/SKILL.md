---
name: xonix-level-designer
description: 'Design, revise, or generate Xonix levels, challenge packs, optional mastery goals, objectives, difficulty curves, campaign routes, and seeded layouts. Use to compose supported capture mechanics across any theme, create variants for touch or controllers, or identify a new mechanic that needs an engine extension.'
---

# Xonix Level Designer

Create levels as data against a declared primitive catalog. Keep challenge identity independent of art and device layout.

For actual playable levels, use [Runtime Maintainer](../xonix-runtime-maintainer/SKILL.md), the [core contract](../../../game/core/README.md) and the [configuration guide](../../../docs/assets-and-configuration.md). Author `xonix-level.v1` data or a `xonix-playground.v1` scenario; `game/generator.mjs` already generates explicit candidates and `scripts/verify-campaign.mjs` replays reviewed campaign completions. Keep both steering modes and actual class recipes explicit; the legacy draft-pack steps below remain a separate design route and are not a game importer.

For player classes, equipment, supply/drop, scan, dash or net abilities, use [Ability Designer](../xonix-ability-designer/SKILL.md). Bind actual supported primitives and target domains; a military reference catalog or lab toy is not a production actor. Record class/equipment/turn policy with comparisons and define action ordering relative to cut failure and fill before adding a real level rule.

For gameplay roles, progression, gameplay imagery or event feedback, consult [the reference lessons](../../REFERENCE-LESSONS.md). They distinguish observed reference behavior from proposed extensions; check the current primitive catalog before emitting pack data.

When evaluating moving cues or a challenge's visual timing, consult [Animation Director](../xonix-animation-director/SKILL.md). Compare the same geometry and state trace across compact, detailed and hybrid skins. Do not infer new movement, collider changes, invulnerability, timer failure or territory loss from a presentation effect; these require declared rules and separate runtime evidence.

When a level or case selects or rewards a character, use [Character Collection](../xonix-character-collection/SKILL.md) for supported context selectors and progression fixtures. Keep cosmetic reward conditions separate from capture rules. Simulated clear events do not establish that the level is playable or that a real game save has advanced.

Preserve the authored movement setup, including the user's configurable immediate and grid-center buffered turning choices. Read actual preview/runtime documentation before describing turn queues, release, reversal or alignment semantics. Record the selected mode with route/playtest evidence; inspect each mode against its own baseline instead of normalizing both to immediate movement. Appearance and character swaps must leave that setup unchanged. If the content-pack format cannot express the setting, keep it in supported preview configuration or the design brief rather than inventing a pack field.

For optional mastery, read [the current one-seal increment and authoring workflow](../../../docs/round-17-mastery-increment.md), [observation semantics](../../../docs/mastery-observer-contract.md), [verification boundary](../../../docs/mastery-verification-contract.md) and [the eight authoring prompts](../../prompts/round-17-optional-mastery.md). Steady Signal on Homeward/Copper Orchard is implemented; the broader three-seal/staged-sentinel plan is not completed. Current `xonix-mastery-definition.v1` requires exactly `clean-win` plus `resistant-cut-cells` with a named existing zone and integer `minCells` in 1…1,564. The observer supports fresh 48 × 36 core-v2 runs. Validate the definition, referenced map/zone and actual active resistance separately; a cosmetic drone or theme label supplies no ability.

Keep definitions in sidecar registration outside normalized levels, campaign data and `xonix-pack.v1`. Use `masteryFor(campaignKey(installedCampaign), levelId)`; the current built-in goal is pinned to `homeward-skies/1/0d01f5687b3c38ff` and `homeward-01`. An edited map or roster with the same textual IDs does not inherit that goal. An approved custom definition requires an explicit registry change for its exact campaign/setup identity; editing IDs alone does not register it. Adding optional replay motivation must not mutate the original map, alter its campaign/leaderboard identity or gate ordinary picture/mission completion. There is no generic definition-upload or pack-based mastery editor in this increment. A changed definition name, description or predicate changes its content identity; retain old earned records as historical rather than silently satisfying the replacement. Gallery current-seal names also require the registered definition ID/revision/hash and map identity/revision, roster and ruleset; a copied hash alone is insufficient.

Evaluate one attempt's best **successfully closed** resistant cut and clean final win. Pending cells on an open line are not banked; repeated cells, safe-ground visits, failed/redeployed cuts and fragments from different runs cannot satisfy the goal. Design positive and ordinary/control routes in both turning modes, then check saved live-cut reconstruction and completed-replay verification. A valid JSON definition, synthetic observer preview or existing clear is not an earned-seal certificate. Use the runtime's verified completion path and strict library-v2 metadata contract when integration is authorized.

New supply, scan, impact, net, route-pattern or staged-boss goals require a finite predicate/behavior extension and tests before content can use them. For requests beyond the existing pair, deliver an explicit proposal with missing facts, action order, positive/control traces, save boundaries and readable cues. Do not insert guessed fields into a v1 map/pack or describe fictional military-themed arcade actions as real equipment operations. Theme and asset experiments can proceed independently while those mechanical extensions remain planned.

## Read the contract first

Locate the target project's `authoring/CONTRACT.md`, resolving this installed skill's physical path to its kit if necessary. Read `schema/primitive-catalog.json`, the closest `examples/*.pack.json`, and the selected theme/ruleset. Use `prompts/catalog.json` for level and review templates. Without the contract, deliver a clearly labeled design brief rather than inventing accepted fields or capability IDs.

## Compose a challenge

1. State the player decision the level teaches: safe short cuts, route timing, balancing exposure against capture size, choosing objectives, or surviving pressure. Keep exact quantitative values provisional until playtested.
2. Choose an existing fill policy explicitly. A closed trail first determines captured cells; captured markers then apply configured effects; the reveal mask finally reflects the resulting claimed cells. Background colors and painted objects never determine physics. Do not replace fill semantics merely because a theme suggests a different fiction.
3. Select declared enemy, goal, and effect IDs with valid parameters. Catalog entries marked specified-not-implemented describe future contracts, not available gameplay. Compose only what the data format expresses. For an unsupported goal, write an extension brief using [the template](references/level-brief.md); do not insert a made-up ID, arbitrary expression, remote script, or executable code into a pack.
4. Define board dimensions, starts, enemy spawns, objective markers, blocked cells, and limits in board coordinates. Keep spawn roles, boundary/field domains, marker counts, and coverage denominator coherent. Preserve all identifiers and links when reusing a ruleset.
5. Keep the complete arena visible across portrait phone, landscape phone, tablet, browser, and handheld/desktop. Reflow controls around it. A different topology or aspect ratio changes the challenge ID; screen scaling must not alter cell speed or collision. Do not claim an exact match from an AI device mockup.
6. Build a progression with named learning beats and a small number of parameters changed per step. Reward skill, discoveries, and voluntary replay. Describe retention as a hypothesis, with observable measures such as first-loop completion, retry rate, and voluntary next-level starts.
7. For procedural proposals, specify seed, generator revision, parameter bounds, reachability and spawn constraints, and reproducibility tests. Until a real generator exists, label generated layouts authored drafts rather than verified procedural output.
8. Write a draft pack or edit the requested pack, then run `python3 authoring/scripts/validate_pack.py PATH --mode draft`. Report errors and resolve those within scope. Validation cannot prove a level winnable, fair, fun, or playable without the runtime; list those as specific later checks.

## Adapt templates to the request

Prompt-library wording is a starting point, not an instruction that overrides the user's chapter, medium, quantity, or approved design. Adapt those choices explicitly and record the effective prompt. Use the current schema's actual enum values: watercolor/gouache are `illustration` with their medium described in the art brief. Within the legacy draft-pack contract, keep unsupported medals, generation behavior and other primitives as proposals instead of inventing accepted fields; use the actual runtime contract for applied game work.

## Deliver

Include the pack path, learning/progression brief, reused primitive IDs, and any bounded extension request. Do not silently add unrelated game code. If the task requests only design, stop at reviewable design artifacts.
