# Erosion pressure pair

Status: candidate only; human balance and public integration pending.

This stacked successor applies already taught readable-pressure roles to two later erosion missions.
It preserves every previous candidate in the stack and does not register a route, change a default,
bump a version or alter a historical edition.

| Mission         | Replacement                        | Two intended approaches                                                                                                                                                                 |
| --------------- | ---------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Cooling loop    | Field keeper → heading interceptor | Wait on a permanent landing for lane/intercept recovery before enclosing a cooled bank; or feint toward the bank, turn after lock and use the longer permanent loop around erosion.     |
| Crosswind remix | Field keeper → trail pursuer       | Take the faster marked crossing before pursuit arrives and reuse its captured edge; or draw pursuit toward an inner spoke, close through an outer foundation and skip low-value repair. |

Both replacements retain field and reuse the `journey-actors-v9` 90-tick warning, 144-tick finite
commitment and preset-specific recovery. A committed target never follows a later turn. Actor IDs,
counts, tiers, positions and headings remain exact. Maps, foundations, terrain, arrows, erosion,
lane emitters, objectives, coverage, pictures, campaign order, defaults and history are unchanged.

## Focused evidence

The focused checks compare this source directly with PR 459's preceding candidate, resolve each
replacement through all three presets in Solo and Versus, and verify one-for-one retained-field
semantics and a target that stays fixed after a course change. Four existing legal-input routes
replay through the new simulation:

- Cooling loop Expert/immediate: 39.05-second no-loss clear, nine cuts, three erosion events and
  three pressure warnings.
- Cooling loop Expert/Grid + Buffer: 34.85-second no-loss clear, eight cuts, two erosion events and
  three pressure warnings.
- Crosswind remix Gentle/Grid + Buffer: 21.22-second no-loss clear, five cuts, four erosion events
  and three pressure warnings.
- Crosswind remix Standard/immediate: 39.42-second no-loss clear, seven cuts, five erosion events
  and three pressure warnings.

No route collects a bonus. Each checkpoint reproduces and each exact input finishes an equal
independent paired-board race. This is deterministic feasibility across both steering policies and
all three presets—not proof that every preset/control combination or both written approaches are
human-viable. Native/device readability, broad seeds, erosion repair quality, mastery, difficulty
ranking, fairness and fun remain **balance review pending**.
