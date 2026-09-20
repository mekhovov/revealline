---
name: xonix-level-designer
description: 'Design, revise, or generate Xonix levels, challenge packs, optional mastery goals, objectives, difficulty curves, campaign routes, and seeded layouts. Use to compose supported capture mechanics across any theme, create variants for touch or controllers, or identify a new mechanic that needs an engine extension.'
---

# Xonix Level Designer

Read [Delivery priorities](../../../docs/delivery-priorities.md) first for the current scope, source/delivery status and remaining acceptance gates. Versioned milestones and older evidence below retain their original contracts; they are not current release certificates. Check the selected source before applying a historical instruction, and keep source assets, runtime adoption and native/device qualification distinct.

Create levels as data against a declared primitive catalog. Keep challenge identity independent of art and device layout.

### Shared-screen cooperative levels

When the request is for two partners against enemies, use the [Relay Rescue authoring contract](../../coop/README.md),
`game/coop/recipes.mjs` and `scripts/build-coop-pack.mjs`. Choose `coverage` or `stronghold` for each level;
mixed packs may alternate these challenges. These are explicit co-op recipes and packs, not solo-map conversions.
Use one connected hostile playground, comparable pressure on both approaches, announced committed attacks,
and a recovery window that lets partners act. Avoid a presecured divider that gives one player an enemy-free half.
For strongholds, keep the exposed core contested after the anchors fall: test retention geography and actual
routes, not only enemy count or speed. A shield drop must still require a later core capture.

Compile and validate the pack, open it through **Play a created co-op pack** in the Relay Rescue lobby,
and compare an exposed rush with a viable route using banking, positioning and Support. Check both seats,
all authored difficulties, rescue access and repeated attempts. Preserve successful public-command traces
and failed shortcut probes alongside browser observations; schema validity alone does not prove challenge,
and automated play does not establish two-human enjoyment. Keep gameplay revisions and co-op rules identity explicit.

For actual playable levels, use [Runtime Maintainer](../xonix-runtime-maintainer/SKILL.md), the [core contract](../../../game/core/README.md) and the [configuration guide](../../../docs/assets-and-configuration.md). Retained ordinary levels use `xonix-level.v1` and playground v1/v2; the finite 48×36 staged encounter uses level v2 and playground v3. Wide 72×36 levels use level v3/core v4/pack v4/playground v4/replay v5. The implemented classic source family uses level v4/core v5/pack v5/playground v5/replay v6; read its reference below before authoring new actors or terrain. `game/generator.mjs` generates ordinary candidates and `scripts/verify-campaign.mjs` replays reviewed campaign completions; neither is a general new-mechanics generator. Keep both steering modes and actual class recipes explicit; the legacy draft-pack steps below remain a separate design route and are not a game importer.

For staged capture, use [Sentinel Relay's source and guide](../../../docs/sentinel-relay.md) and its [ten reusable prompts](../../library/sentinel-relay/prompts.json). The current finite recipe has one centered stationary `relay-sentinel` as the sole field seed, two distinct visible required objectives and two bounded schedules. Capture the relay, then close a sufficient current FIELD trail during an opening, or reduce the remaining field to the derived isolation threshold and finish safely during an opening. Short cuts retain ordinary gains; failed cuts and old safe cells do not accumulate toward the live threshold. Do not invent health, movement, extra stages or boss mastery predicates.

Use explicit level-v2/core-v3/replay-v4 and pack-v3 with `masteries: []`; scenario-v3 has `masteryDefinition: null`. Changing layout/timing needs a new reviewed content identity and both-policy legal-input proofs. Preserve the existing fourteen all-class ordinary clears and additional missed-window/isolation/recovery traces when revising this source; add proof for a new topology rather than assuming schema validity means it is solvable. Editing art cannot change this authority. Keep legacy level-v1/core-v2 identities and archived routes exact.

For player classes, equipment, supply/drop, scan, dash or net abilities, use [Ability Designer](../xonix-ability-designer/SKILL.md). Bind actual supported primitives and target domains; a military reference catalog or lab toy is not a production actor. Record class/equipment/turn policy with comparisons and define action ordering relative to cut failure and fill before adding a real level rule.

For gameplay roles, progression, gameplay imagery or event feedback, consult [the reference lessons](../../REFERENCE-LESSONS.md). They distinguish observed reference behavior from proposed extensions; check the current primitive catalog before emitting pack data.

When evaluating moving cues or a challenge's visual timing, consult [Animation Director](../xonix-animation-director/SKILL.md). Compare the same geometry and state trace across compact, detailed and hybrid skins. Do not infer new movement, collider changes, invulnerability, timer failure or territory loss from a presentation effect; these require declared rules and separate runtime evidence.

When a level or case selects or rewards a character, use [Character Collection](../xonix-character-collection/SKILL.md) for supported context selectors and progression fixtures. Keep cosmetic reward conditions separate from capture rules. Simulated clear events do not establish that the level is playable or that a real game save has advanced.

Preserve the authored movement setup, including the user's configurable immediate and grid-center buffered turning choices. Read actual preview/runtime documentation before describing turn queues, release, reversal or alignment semantics. Record the selected mode with route/playtest evidence; inspect each mode against its own baseline instead of normalizing both to immediate movement. Appearance and character swaps must leave that setup unchanged. If the content-pack format cannot express the setting, keep it in supported preview configuration or the design brief rather than inventing a pack field.

For optional mastery, read [the released Steady Signal baseline](../../../docs/round-17-mastery-increment.md), [the Supply Line / Safe Return extension](../../../docs/round-18-equipment-mastery-plan.md), [verification boundary](../../../docs/mastery-verification-contract.md) and [eight equipment-goal prompts](../../prompts/round-18-equipment-goals.md). Preserve the original v1 pair `clean-win` + `resistant-cut-cells` and digest `mastery-v1-2e6aae3f42f3d3c2`. The current v2 definition extension supports exactly two additional compositions, not arbitrary combinations:

- Supply Line: `supply-pickups {padIds}` + `suppressed-region-crossings {regions:[{zoneId,minCells}]}` + `hangar-switch {hangarId,classId}`, then a final win. Each region needs its threshold within one successfully closed live cut while suppressed; different regions may use different cuts. Full-pad attempts, safe-ground visits and rejected switches add no credit. Failed/redeployed cuts discard pending crossings while earlier completed actions remain within that attempt. Do not invent a clean-life requirement for Supply Line.
- Safe Return: `clean-win` + `live-cut-impact {actorId,minTrailCells}`. A successful new impact pulse must begin with the required pre-use live trail, actually stun the referenced actor, and complete its own redeployment/return before the clean final win. An unrelated stun or later recovery is insufficient; do not claim the action was necessary to survive.

Read the finite resolver in `game/mastery-equipment.mjs`: v2 pad/region sets contain 1–4 unique references, thresholds are integers in 1…1,564, and canonical sorting makes set input order irrelevant. Resolve every pad, zone, hangar, target class and actor against the actual map and roster. V1 retains its own stricter shape and budgets. Both versions observe fresh 48 × 36 core-v2 runs; appearance supplies no resistance, ammo, pulse or other ability.

Keep definitions outside normalized levels and campaign data. V1 packs remain unchanged and use only the exact three shipped Homeward sidecars; same-ID edits do not inherit them. The current [pack mastery contract](../../../docs/pack-mastery-contract.md) supports explicit `xonix-pack.v2` declarations and `xonix-playground.v2` previews; use [Expansion Author](../xonix-expansion-author/SKILL.md) for import, copy/edit/clear, export and replacement. Required empty/null declarations intentionally disable fallback. Use the shared prepared catalog in `game/mastery-catalog.mjs`, including actual map/roster identities and explicit absence. The [earlier pack design](../../../docs/round-18-pack-mastery-plan.md) is design history, not the current acceptance boundary.

New definitions retain the existing `mastery-v1-` digest algorithm but hash their complete canonical version/content. Records stay `xonix-mastery-record.v1` and library v2; core-v2, replay-v3, old maps, campaign/board keys and Steady Signal remain unchanged. Changed names, descriptions or predicates create a different definition identity. A frozen v0.7 reader can preserve structurally compatible new records as archived metadata while rejecting the new definition document. Preserve older earned metadata as archived unless the exact current registration, map/revision, roster and ruleset match. Optional goals never gate ordinary picture or mission completion.

Design positive, ordinary and action-omission routes in both turning modes, plus saved-prefix boundaries during an open crossing and between impact use and return. Use the public capture helpers with the resolved definition; reconstruct from the whole replay instead of importing counters. A JSON definition, synthetic preview or existing clear is not an award certificate. Keep a compact flight summary, named complete/pending rows in pause and an honest saved/session-only result. [UX guidance](../../../docs/research/round-18-equipment-goal-ux.md) supplies concrete examples. The [Round 17 prompt guide](../../prompts/round-17-optional-mastery.md) remains a historical v0.7 reference.

Scan, net, route-pattern and staged-boss goals still need separately scoped finite predicates and tests. Deliver a proposal naming missing facts, ordering, positive/control traces and save boundaries before claiming support. Never insert guessed fields into a v1 map/pack or describe fictional military-themed arcade actions as real equipment operations. Theme and asset experiments can proceed independently.

## Wide Arcade chapter

For current wide maps start with [First Light](../../../docs/first-light.md) and its validated `authoring/library/fpv-arcade/pack-source.json`. Continuous steering, Immediate/Grid + buffer and 72×36 geometry are independent choices. Tune route options, moving threats and obstacles; artificial waiting does not establish challenge. Use original map artwork and opaque hidden regions. Re-run legal routes in both turning modes plus careless/failure paths; human comprehension and enjoyment remain separate evidence. The first three levels gate bulk content production. Reference-layout studies preserve observed geometry and label unknown behavior instead of inventing reference facts.

## Classic roles, material and contact pickups

Read [the classic runtime reference](references/classic-runtime.md) for the exact new version pair, registered actors, bounded descriptors, fixed pickup effects and verification commands. Start from the original [Classic Lab generator](../../../scripts/build-classic-lab.mjs) or its prepared pack, keeping legacy and wide-v4 identities intact. These source capabilities do not imply that a frozen edition, legacy draft catalog or arbitrary JSON primitive supports them.

Use [six classic workflows](../../prompts/classic-workflows.json) for a role demonstration, terrain/pickup lesson, theme variation, reference study, proof or bounded tuning pass. Direction release does not stop an active cut. The implemented level.v4 `stopOnCapture` contract stops a successful closure at secured picture ground until a fresh direction gesture; preserve legacy levels and their recorded controls. Arcade still has Pause rather than a separate Stop action. Check the current edition's implemented pause/resume and gesture gates, and record Immediate and Grid + buffer independently. Preserve the existing 18 Classic Lab routes as pre-return-stop evidence; do not rewrite them or old null-input replays to imitate revised controls.

Classic JSON selects registered behaviors and supported parameters. A different routing algorithm, effect strength/duration, stacking rule or capture policy requires a separately reviewed engine/version change. Keep still artwork, actor role imagery and fictional military labels outside simulation authority. A solvability proof may avoid a demonstration's featured mechanic; record actual pickup, warning, erosion or rejoin events separately before claiming that the lesson was exercised.

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

## Deliver the completed feature

For implemented changes, follow the shared [feature delivery workflow](../../../docs/feature-delivery-workflow.md): related commit, exact-source verification, immutable playable version, reviewed/merged PR, GitHub Release and verified Pages deployment. Follow the active task’s existing scope and authorization throughout that sequence. Update [Delivery priorities](../../../docs/delivery-priorities.md) with actual evidence; keep planned assets, modeled input checks and physical-device qualification distinct. Design-only work remains a reviewable design artifact.

For registered enemy roles, optional travelling line impacts and theme-specific pickup/defeat feedback, read [enemy catalog](../../../docs/enemy-catalog.md) and [the R3 edition](../../library/fpv-arcade-r3/README.md). The [enemy workflow prompts](../../prompts/enemy-workflows.json) use actual interfaces. Preserve old identities, explicit authoring activation, local artwork provenance and measured input/visual evidence.

## Teach a player before expanding a challenge

Use [the player field guide](../../../docs/enemy-guide.md) and `game/enemy-guide.mjs` for concise Spot / Risk / Try entries and actual reward-free practice. Reuse the registered seven roles/four appearances; keep authoring switches out of the player guide. The impact lesson reuses the original `line-impact-demo` geometry and proves unboosted loss and Boost escape through ordinary inputs in both turning modes. Explanatory preview motion is not physics or proof of timing. Role lessons create separate `guide-*` identities and opt into capture stopping; never rewrite a released map or old proof to add teaching text.

Keep tutorial state separate from progress, scores, unlocks and saved flights. Retry must retain the lesson's exact rules; Return must restore the same guide topic and leave the campaign paused. Compare profile/suspended-slot bytes and the original run checkpoint, not only UI labels. Preserve parent/iframe input ownership, fresh-neutral return, finite source/origin/token validation, bounded preparation cancellation, prior preview handoff restoration and one audible music owner. Require actual browser and human comprehension observations separately from modeled tests. Two player-teaching examples are registered in the existing enemy workflow prompt supplement.

## Preserve native launch and input access

For any playable theme, asset, rule, interface or pack change, follow the shared [native launch, entry and device contract](../../../docs/boot-launch.md#authoring-and-device-contract). Preserve dark first paint and safe failure guidance, the native player journey, authored action availability, independent keyboard/touch/controller navigation, historical run identities and truthful device evidence. Do not reintroduce legacy webpage controls or advertise unavailable actions. Source, browser, listening and physical-device checks remain separate. Public entry must use the complete immutable edition graph; follow the [entry and retirement contract](../../../docs/boot-launch.md#immutable-public-entry--p77). Verify fresh and previously cached browsers separately from public-byte hashes. Preserve old caches, profiles and live games during normal worker retirement; never clear site data or force takeover to make an upgrade pass. Keep actual storage limits distinct from planned media budgets. Verify an ordinary first capture and continued flight in the frozen browser online and with its server stopped; clean startup, restored saves and complete file inventories do not prove the gameplay journey. Preserve simulation exceptions as release blockers even when source tests pass.

## Author finite pressure and preserve reference evidence

Use the validated [enemy-pressure.v1 contract](../../../docs/enemy-pressure.md) only for moving bouncers in Classic levels. Warning locks one locally sensed target; commitment follows a finite collision-safe path at the authored speed, then cooldown. Do not invent global awareness, instantaneous aim changes or pressure fields for unsupported actor roles. The R5 [chapter builder](../../library/fpv-arcade-r5/build.mjs) exports two three-map packs to preserve existing image/storage budgets, with six distinct existing owned pictures. New geometry and reused art are counted separately.

Keep direction-only Arcade policy, capture stopping, opaque concealment, live impact fronts and old campaign/replay identities. Verify each chapter in Standard/Gentle and both turn modes through real legal command traces, exact checkpoints and saved-prefix reconstruction. Include the simple inward cut plus a long idle interval, multi-cut closures, and finite pressure-on/off comparisons using the same inputs. Preserve failed search traces and fix actual core exceptions; never alter a map or old oracle to conceal one. A bounded solver failure is not proof that a level is impossible. Measure real warning/commit events and human-readable counterplay before claiming a map is smarter or more enjoyable.

Example brief: “Create an original 72×36 Arcade map with two safe exit choices, one warned trail hunter and one contour patrol. Use the pressure descriptor's existing bounds. Provide the authored lesson, legal wins in both turn modes, a greedy-route comparison, occupied-size screenshots and exact content identity. Keep the source artwork and prior editions unchanged.”

## Keep live pictures and earned originals stable

When a task touches reveal artwork, a saved flight, Collection or media export, follow the shared [live-picture and paired-recovery contract](../../../docs/feature-delivery-workflow.md#live-pictures-earned-originals-and-paired-recovery) and [concrete prompts](../../prompts/media-presentation.md). Preserve saved A after assignment B, first-earned A and exact owner identity. Keep JSON game data, `.rlmedia` originals and `.rlsound` audio distinct; missing saved originals remain paused without a replacement. Shared-v3 source adoption does not certify old readers, browser recovery or a public release. Unrelated art/behavior work need not open or migrate media storage.

## Separate lessons, challenge candidates and production maps

Read the [current teaching/counts review](../../../docs/research/round-43-next-milestone-review.md) before expanding Tactical content. The three Scout/Carrier/Fiber teaching variants reuse one clearing and have 20 traces (10 wins/10 failures); the three separately reviewed route-choice candidates have different walls and 24 traces (14 wins/10 failures). Every trace includes an exact saved continuation. These are not 44 wins, six finished production maps or newly awarded practice content. Keep authored required targets visible when the recommended class has no Scan, informational Scan optional, Carrier supply/field counterplay real, and Fiber signal resistance distinct from cable limits. Preserve ordinary alternatives and matched omission failures.

Put concise actual rules/counterplay in the existing authored description and verify the native focused Mission brief at Ready and Pause. Read the last line with keyboard/controller, restore the same paused run on Back, then Resume explicitly. A proof establishes a legal route; actual browser display, human comprehension, challenge tuning and finished art remain separate gates. Use the review's bounded prose requests without inventing schema fields or registered prompt IDs.

## Read Playground signal zones and hangars

Use the [Playground reading guide](../../../docs/practice-playground-readability.md) when authoring these existing features. Dashed signal zones and diamond-framed hangars correlate with text beside the map; cosmetic marker size never changes collision or activation geometry. Coordinates are zero-based from the top left. Read each optional signal restriction independently; speed is shown as a rounded whole percentage, while exact data remains in Level JSON. Omitted hangars use the spawn default, an empty list disables switching and an omitted individual radius defaults to two cells. Existing switching requires proximity, safe player ground, no active cut and the actual cooldown; do not assume that ground beneath the hangar centre must be captured.

Use the coordinate/editor controls for real changes, then Undo and compare the restored configuration with its diagnostic rows. Reading preferences do not make an edit. Last Undo may move its own retiring focus to the selected brush; it must not launch or update the running child. Use explicit Play configuration to test the new map. An empty control-measurement set or readable diagnostic list is not proof of touch usability, fairness or a full accessibility pass. Keep current live measurements distinct from an explicitly captured historical snapshot.

## Journey action policy and historical route checks

New Solo/Versus Journey projects pin `journey-arcade-v2`. The shared compiler emits
`classic.arcadeActions` so the fixed-tick simulation, imported replay commands and
visible controls agree: bonuses activate on contact, while manual ability, Supply
and Boost commands are unavailable. Do not fix this by hiding buttons alone.
Imported `journey-v1` projects keep their exact previous levels and identities.
Team uses its separate registered rules; do not infer Solo capabilities from a label.

Prompt: “Create a Journey Arcade map through the shared compiler. Check both turning
modes and all existing classes against attempted manual commands; collect the four
authored bonuses through movement and verify the replay. Preserve v1 route fixtures,
then run `node scripts/qualify-journey-arcade-routes.mjs` to compare all sixty historical
opening outcomes. Changing policy requires new simulation/campaign identities, never
rewriting old checkpoints. Restore a saved candidate after changing the next-attempt
preset; resolve it through candidate ownership, not an installed Legacy pack lookup.”
