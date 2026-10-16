# Pacing acceptance follow-up: route choice and objective clarity

This follows the completed 240-mission source review. It revisits Three-way
Escape, Final Airfield and the optional-courier outliers using actual accepted
recipes, restored winning journals and the real host handlers. Physical-device
observation and player feedback are deferred by request. This report makes no
claim that the remaining missions are universally enjoyable or optimally paced.

## Concrete correction: optional courier promoted as the mission target

The host selected its target label with `!actor.bonus`. Accepted Snake actors use
`role: 'bonus'`, not a `bonus` boolean. When a required target was caught while an
older courier survived, the courier could become the first entry in the target
array. The HUD then named the optional courier as the target even though catching
it did not advance the required-catch quota.

The HUD now selects a non-bonus actor using its authoritative role. Each board's
existing status row identifies an active courier as an optional bonus that does
not count as a required catch. This is a short English/Ukrainian line in the
existing wrapping row, not a new panel. It retires with the actor and cannot show
on a Versus opponent's board merely because the first board has a courier. This
also enables the existing full-width wrapping layout when a transient status is
present on a mission without operation stages. A separate `data-status` flag
controls wrapping; `data-operation` continues to describe actual staged
objectives, so a courier cannot hide the required-catch counter. A CSS contract
check and host counter assertions cover that distinction.

Six host regressions follow actual accepted Courier Overpass journals until a
required catch leaves an older bonus first: Solo, Team and separate Versus boards
in both languages. They check the required target's identity, optional cue,
per-board isolation, unchanged recording after refresh and cue retirement. The
Solo journal also reaches completion without catching any courier. Team's route
may take an optional catch; that is not falsely described as a zero-bonus route.

## Beginner instruction clarity

Open Loop's initial in-play instruction always began with “Arrows / WASD”, even
on touch or controller devices. Its brief cue now says to turn before the edge,
that the drone keeps moving, and to catch enemies. The shared controls and help
continue to explain the selected input method. English/Ukrainian host checks
verify the opening cue without advancing simulation. No control, recipe or
onboarding timing changes.

## Three-way Escape and Final Airfield: retain the recipes

| Mission / normal mode   | Winning witness moves | Distinct capture cells | Longest interval between catches | Target moves within that interval |
| ----------------------- | --------------------: | ---------------------: | -------------------------------: | --------------------------------: |
| Three-way Escape / Solo |                   118 |                      8 |                               38 |                                 3 |
| Three-way Escape / Team |                    88 |                      8 |                               26 |                                 3 |
| Final Airfield / Solo   |                   237 |                     12 |                               38 |                                 2 |
| Final Airfield / Team   |                   165 |                     12 |                               35 |                                 3 |

These measurements deliberately use **intervals between catches**, not the trace
report's broader encounter-change definition. Final Airfield Team's catch gap
is 35 moves while its encounter-change gap is 27: warnings or supply events can
occur between catches. Neither number is a direct measure of meaningful choice.

The accepted traces move at least one living head on every step. Moving targets
remain active in the longest measured gaps, and every witnessed catch occurs at
a different cell. This refutes repeated collection at one fixed point for these
particular traces; it does not demonstrate that every possible route is varied.

A separate cardinal-connectivity check closes **every shutter simultaneously**
and confirms that all remaining open terrain is connected to the spawn, including
the second Team spawn and every supply pad. Three-way Escape has no timed
shutter. Final Airfield's two gates therefore offer cuts rather than compulsory
waiting to access another region. This terrain check ignores cable occupancy:
a player's body can still close its own route, which is part of the intended
long-cable challenge. It does not claim universal freedom from self-created traps.

Keep their eight/twelve catches, current geometry and enemy policies. There is
no demonstrated mandatory idle gate or repeated fixed catch to justify another
quota reduction. Final Airfield also retains Pulse at two and Reel at six, which
remain reachable before the quota ends. Its longer return is an explicit mastery
trade-off, not a new teaching introduction.

## Optional-courier outliers: preserve the optional choice

The existing retained and alternative journals remain authoritative:

| Route                   | Retained moves | Alternative moves |
| ----------------------- | -------------: | ----------------: |
| Courier Overpass / Solo |          1,226 |               119 |
| Courier Overpass / Team |            804 |                95 |
| Supply Circuit / Team   |            284 |               127 |

All three paces of the accepted Courier Overpass Solo alternative finish with
**zero bonus catches** and exactly the required quota. This directly establishes
that the courier is not required for completion. The much longer old witness
chased the optional actor while ordinary progress remained available. The clearer
HUD fixes the misleading implication without deleting an optional gamble or
changing its points, growth, movement or spawn timing.

The Team and Supply Circuit alternatives include optional catches; their shorter
routes show avoidable detours, not proof that they ignored every bonus. Historical
long journals and flags remain visible rather than being replaced by the shorter
ones. No new gameplay identity, archived recipe or proof regeneration is needed
for these presentation-only corrections.

## Reproduction and remaining limits

- `node --test game/test/classic-snake-pacing-acceptance.test.mjs`
- `node --test game/test/classic-snake-ui.test.mjs`
- `node scripts/qualify-snake-trace-outliers.mjs --check`

The focused acceptance suite checks connected permanent routes, actual movement
and distinct capture locations in the four specified witnesses, and all three
zero-bonus Solo completions. The host suite exercises real menu/refresh/input
handlers with simulated DOM/canvas boundaries; it is not a browser layout or
physical-touch claim. No mission quota, simulation rule, seed, rating or progress
namespace changes in this follow-up. Remaining subjective pacing and physical
input feedback are explicitly deferred, not represented as completed studies.
