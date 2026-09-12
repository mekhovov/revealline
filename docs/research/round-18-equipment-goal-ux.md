# Round 18 — understandable equipment goals and a useful collection

Research accessed **12 September 2026**. Keep the v0.8 increment focused on **Supply Line** and **Safe Return**, with one compact optional goal per existing Homeward map. The useful addition is a readable explanation of which actions counted, followed by a lasting seal beside the picture. These sources do not establish a retention effect or justify an “addictive” claim.

Reviewed first: the [mastery plan](../round-15-mastery-plan.md), [Round 17 guidance](round-17-mastery-recommendations.md), current `mastery-view`, award/verification flow, Homeward map metadata and the v0.8 implementer's settled observation contract. Frozen v0.7.0 provides Steady Signal; the other goals are concurrent implementation work. The sketches below are design recommendations, not a report that their final interface was played. This pass retrieved primary documentation text only: **no new screenshots were visually inspected, videos watched or audio auditioned**. No reference art was copied.

## Five fresh primary references

| Source and date                                                                                                                                                                    | Observed fact from the published text                                                                                                                                        | Narrow design implication                                                                                                                                                                                                                                                   |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Playground Games, [First Drive: A Forza Horizon 5 Starting Guide](https://forza.net/news/forza-horizon-5-first-drive), 24 April 2025                                               | Players can inspect available Accolades from the world map and pin a next Accolade to track progress. The guide also explains rewards being added to the vehicle collection. | Keep the current mission's one optional goal easy to find. Our three-goal scope needs no new global pinning system: a persistent named mission checklist is sufficient.                                                                                                     |
| Bungie Help, [Navigating the Menu Screen](https://help.bungie.net/hc/en-us/articles/45753961638292--6-Navigating-The-Menu-Screen), undated current guide                           | Collections includes recent discoveries, categorized records and badges. Journey includes Triumphs earned by completing specific criteria.                                   | A seal should be both a brief result and an inspectable record. Reuse the picture gallery with the name, qualifying equipment route and steering mode; avoid a separate reward currency or collection screen.                                                               |
| Nintendo, [Splatoon 3 version 10.0.0 update](https://www.nintendo.com/en-gb/News/2025/June/Everything-included-in-the-Splatoon-3-Version-10-0-0-update-2848193.html), 12 June 2025 | The update raises weapon Freshness limits and adds badges at the new levels, carrying forward previously accumulated excess Freshness.                                       | Equipment-associated badges can communicate familiarity with a chosen tool. Our seal represents a specific verified attempt, so do not copy the XP accumulation or infer new seals from old ordinary clears. Preserve already earned local records when definitions evolve. |
| W3C WAI, [Make Each Step Clear](https://www.w3.org/WAI/WCAG2/supplemental/patterns/o1p04-clear-steps/), content first published 29 April 2021                                      | For a multi-step task, the guidance calls for visible completed, current and pending steps, plus important choices, to help people resume after interruption.                | After pause or verified restore, show what has counted and what remains. A generic “4 / 6” alone cannot explain which pad, region or equipment change is missing.                                                                                                           |
| W3C WAI, [Separate Each Instruction](https://www.w3.org/WAI/WCAG2/supplemental/patterns/o3p09-separated-instructions/), content first published 29 April 2021                      | It recommends separating instructions, including apparently obvious steps, and using concise lists or conditional tables for complex tasks.                                  | Supply Line needs short named rows. Safe Return needs a clear precondition and completion sequence. Put the complete explanation in the existing brief/pause details rather than a long paragraph over the flight.                                                          |

The two W3C pages are supplemental cognitive-accessibility guidance, not additional mandatory WCAG criteria or evidence of conformance. Game documentation describes those games' features; the applications here are our design inferences.

## Supply Line: show the actual six requirements

The settled rule for River Switchyard is: genuinely refill at both named pads; visit at least two distinct cells in each named emitter region while it is suppressed, during a successfully closed live cut; successfully switch to Heavy carrier at the south hangar; then win. Different regions may be credited by different closed cuts. **There is no clean-life requirement for this seal.** Actions already completed in this attempt remain credited after a later failure; a failed or redeployed open cut loses its pending region cells.

Recommended brief: **“Refill at both pads, complete a suppressed crossing of each region, switch to Heavy carrier at the south hangar, then finish the mission.”** Expand the crossing rule below it, including the two-cell threshold and return-to-safety requirement. Starting with Light carrier is a helpful route recommendation, not an extra hidden predicate.

Example pause checklist, using friendly labels tied to the existing stable map IDs:

| Requirement                   | Example state                               |
| ----------------------------- | ------------------------------------------- |
| West pad refill               | Complete                                    |
| South pad refill              | Still needed                                |
| West suppressed crossing      | Complete — 4 cells on a closed cut          |
| South suppressed crossing     | 2 cells on the open line — return to safety |
| Heavy carrier at south hangar | Still needed                                |
| Mission finished              | Still needed                                |

This is a requirement checklist, not an enforced order. Distinguish a recommended route from rules that genuinely require sequencing. Do not label an emitter's temporary suppression alone as a completed crossing. A full-pad button press, safe-ground visit or rejected class switch must leave its row incomplete, with a concise reason when appropriate. Repeated button presses are not progress.

During flight, keep a short summary and the next useful unresolved condition. Detailed rows belong in pause/brief, so a six-item checklist does not obscure the line. Show completed text or a labeled check alongside color; muted or reduced-effects play must retain the information. These recommendations extend the existing status and accessibility contracts rather than changing the simulation.

## Safe Return: make the recovery sequence visible

The settled Home Beacon rule requires a successful impact pulse started with at least three live trail cells; that new pulse must overlap and actually stun the named cable-cutter actor; its associated redeployment must finish returning the craft; the same attempt must then win without losing a life. A different field's stun, an empty pulse or an unrelated later return cannot substitute. These are fictional arcade conditions, not real-world military claims.

Recommended detail copy: **“Use an impact pulse from a live line of at least three cells, stun the cable cutter with that pulse, complete the return, then win without losing a life.”** Avoid “prove you saved your life”: the recorded events do not establish that the action was necessary to survive.

Give the recovery portion three distinct states: **Not started → Returning → Return complete**. The first pulse effect is too early to mark the return complete. After a successful return, keep that row checked while “Finish without losing a life” remains pending. If a life is lost, explain that the optional clean finish is no longer possible in this attempt; keep the ordinary picture mission playable. The current implementation contract must remain the source of truth if a boundary is clarified during testing.

## A reward worth inspecting, with an easy exit

Keep the completed picture as the primary result. Show the named seal after verification and retain its equipment route and steering mode in gallery details. Use the registered current definition for current labels; preserve mismatched imported metadata as archived rather than silently promoting it to a newly earned goal. A session-only seal must retain its truthful save warning and export path.

For an unearned goal, offer one specific remaining condition in details and a secondary retry action. Do not turn a normal victory into another failure screen or automatically launch a retry. The earned picture remains a comfortable stopping point. Avoid completion percentages that combine historical definitions, different map variants or separate unfinished attempts.

## Small acceptance set for this increment

| Situation                                     | Expected observation                                                                                                                                                                  |
| --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Full pad; rejected switch                     | No completed row appears. The player can distinguish an accepted refill/switch from an ineffective press.                                                                             |
| Two suppressed cells, then failed cut         | Open credit disappears. Earlier closed-region credit and completed refills remain visible within the same attempt.                                                                    |
| Pause and restore partway through Supply Line | Reconstructed rows agree with the whole recorded prefix in both steering modes. The player can identify the missing named requirement without replaying a tutorial.                   |
| Pulse begins; craft has not returned yet      | Safe Return shows “Returning,” not a completed recovery. An unrelated stun/return cannot fill the row.                                                                                |
| Life loss on the two missions                 | Safe Return's clean finish becomes unavailable; Supply Line does not acquire an invented clean-life requirement. Ordinary mission progression remains intact.                         |
| Win, leave and reopen the collection          | The picture is available independently of mastery. The correct seal/setup and actual persistence status are inspectable; no repeated claim or compulsory extra celebration is needed. |
| Phone, controller and muted/reduced effects   | Start, Resume and Continue remain reachable. The optional explanation does not bury them, and named states remain understandable without sound or color alone.                        |

First playtest question: ask the player to explain **why one attempted action did not count**, then what they would try next. This can expose unclear prerequisites or feedback. Deterministic traces prove rule behavior; they do not prove that new players understand it or will voluntarily replay. Add further mastery goals only after these two can be explained and completed without outside narration.
