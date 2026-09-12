# Character collection handoff

Use only sections needed for the requested collection edit or review. This is a design/review record, not a new accepted JSON schema. Read the target preview's current format before serializing anything.

## Roster and component recipe

Record character ID, displayed name, family, base identity, cosmetic variant, body/portrait/attachment/trail references, source and derivative parents, measured image dimensions, alpha review and current readiness. Distinguish a character from a material variant of that same character. Replacing an asset reference should preserve collection/progress identity unless the user intentionally creates a new character.

For every independently replaceable component record the anchor coordinate system, base heading, transform ownership, draw order, active states, clock and cleanup. A three-blade rotor is three evenly spaced blades around one hub; it is not a request for three rotor hubs. Record blade count separately from hub count, spin sign, phase offset and visual rate. Use Animation Director's component recipe for rotor aliasing and non-rotor wing/thruster/pulse behavior.

Do not infer gameplay characteristics from art: a heavier chassis, faster blur or larger wing is cosmetic unless a separate supported ruleset explicitly changes those values. A misleading gap between visible silhouette and actual footprint is a review finding, not permission to resize a collider.

## Context and selection

When using the current motion-lab collection format, inspect `collection-presets.json` and `collection.mjs`. The accepted context selectors are `gameId`, `themeId`, `caseId`, `challengeId`, `levelId` and `mapId`; an omitted selector is unrestricted within that scope. Use actual documented matching/composition rules. Do not invent selectors such as device, difficulty or nation and assume the evaluator accepts them.

Review at least the contexts affected by the edit: starter with no progress, newly earned eligible character, selected character no longer eligible, locked selection request, missing image and switching family. Record requested selection, effective selection, eligibility, unlocked state, loaded visual and fallback reason separately. Reset and context changes must clear stale component effects and avoid leaving the prior character visible under a new label.

Current example IDs are fixture conveniences, not required naming for future collections. Use the current JSON as authority for their actual rules and asset availability. Do not rename accepted IDs while writing prose examples.

## Earned progression and fixtures

Define the intended reward, understandable condition, eligible scope and how duplicate/replayed results behave. Starter access is separate from earned access. A rule based on cleared levels counts distinct accepted level identities; stars use the evaluator's best result per level rather than summing every replay. Conditions such as duration, lives lost or required objectives must use supported fields and units.

The lab's progress events are explicitly simulated fixtures. Keep them in a local preview profile, label them as simulation in UI/review and do not promote them into a real save, leaderboard, analytics event or assertion that the game awarded a character. Test a failing fixture as well as the fixture that meets the condition. Replaying a fixture should leave unlock state stable. Do not fabricate successful event emission from a game that has no implemented capture loop.

Mode segregation is not authentication. The evaluator trusts structurally valid event data; rewriting a local profile's mode and event flags can create game-shaped ownership. A production adapter must receive authoritative completed-run facts and account for content/ruleset/version identities. Do not promise tamper resistance from schema checks, event IDs or `simulated` flags alone. Do not invent that adapter during a collection-authoring task; identify the required game-plan work.

Document proposed game progression separately: completion unlocks, optional mastery cosmetics, replay interest, fairness and late-game roster breadth. If rewards change speed, damage, abilities or capture policy, describe a distinct balance mode/rules extension and its test plan. Cosmetic rewards should not quietly acquire stats because their fiction sounds powerful.

## Applied-asset evidence

Record the requested ID and file, parent asset/provenance, actual binding/preset change, effective selection/context and successful load. Then inspect the rendered result: correct subject and allegiance, genuine alpha, proportional fit, heading, occupied size, attachments, live-trail contrast and source fidelity. A loaded filename proves little if the image paints behind a placeholder or the wrong variant remains cached.

For a switch, inspect both before and after, including a paused scene. Check that old rotors, wings, trails, sound loops and selection labels do not persist. Exercise only supported motion/fixture controls, and distinguish scripted preview motion from game behavior. Record tested viewport sizes and actual playback; do not call them native device or production performance tests.

Record the authored immediate or grid-center buffered turn mode with the scenario. Equipping a character or changing its attachments must preserve that setting. Compare each cosmetic against a baseline within each supported mode; the same input can intentionally produce different travel between modes. Read current queue/release/reversal/alignment semantics before testing them, and do not infer buffered direction from decorative facing. The movement setting belongs to its supported configuration, not an invented character stat or collection selector.

Keep the handoff short: changed files/IDs, effective prompt, observed result, data checks, playback/switch checks, simulated reward checks and concrete remaining gaps. Link deeper game-plan decisions without implementing them through unrecognized collection fields.
