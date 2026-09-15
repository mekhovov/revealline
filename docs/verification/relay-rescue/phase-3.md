# Relay Rescue — cooperation loop and feedback revision

Delivery version: **0.46.0**. The user supplied play feedback: both arena types are good; the second is more fun and challenging; the horizontal divider permits an easy, uneven route; both players need stronger comparable opposition. The user explicitly requested our own emulated and browser retests. The [balance revision](balance-revision.md) records those changes, research, shortcut failures, successful counterplay, review fixes and evidence limits. Its exact committed-source qualification and browser receipt determine technical closure. Campaign expansion and the later human/device milestones remain separate work.

The revised arenas have no interior safe divider, mirrored enemy pairs and a contested core region. New attacks distribute pressure across exposed players, respect reachable paths, and preserve warning/commit/recovery boundaries. Both boosted and walking public-command routes remain viable; timed Support changes outcomes on harder routes. Co-op rules advance to **revealline-coop.v3**, and both shipped level revisions advance to **2**. A validated [level and pack builder](../../../authoring/coop/README.md) makes territory and stronghold designs reusable and playable through explicit in-memory pack import.

The sections below retain the original candidate's implementation and research history. Its central-divider geometry, v2 rules and 6.27-second route are superseded by the linked revision evidence; they are not claims about the final balance.

## Implemented behavior

The shared simulation now includes one-charge Support, an eight-second active-play refill, cumulative new-territory recharge acceleration, travelling impact interception, committed Hunters, free contact/capture/objective rescues, and survivor-preserving reserve recovery. Pause freezes simulation clocks. Death preserves charge state. Support holds and fresh steering gestures are explicit co-op input capabilities; existing Race callers retain their default action semantics.

Relay Yard is a complete stronghold experiment on the same fully visible 72 × 36 board. A central safe route connects both players; its staggered anchors occupy different approaches. Capturing both anchors exposes the core after the capture transaction. A later capture must secure the core cell. The shielded core blocks movement, and its emitter remains dangerous until the core itself falls. A Hunter's marked attack commits to its original target, followed by a harmless recovery window. Securing the actual cell occupied by a non-attacking Hunter defeats it; merely enclosing its hostile region does not.

The co-op rules identity advances from `revealline-coop.v1` to `revealline-coop.v2`; level data retains its compatible `revealline-coop-level.v1` identity. Co-op does not write progress, solo awards, or mid-mission state in this candidate. Separate versioned progress and campaign content belong to Phase 4.

Three selectable configurations preserve the same authored arena, seed and difficulty: individual cuts plus ordinary cover, Joint Cuts plus ordinary cover, and the full cooperation loop. All retain timed Support and contact rescue; the full loop additionally accelerates recharge and permits capture/objective rescue. Retry keeps the setup unchanged.

## Research and review decisions

[Valve's cooperative pacing presentation](https://cdn.akamai.steamstatic.com/apps/valve/2009/GDC2009_ReplayableCooperativeGameDesign_Left4Dead.pdf) informed explicit warning, commitment and recovery phases. This prototype has one Hunter and one stronghold emitter with bounded attack durations; the campaign's authored encounter combinations remain Phase 4 work. There is no hidden success-based difficulty adjustment.

[Moving Out 2's designer account](https://blog.playstation.com/2023/08/14/designing-moving-out-2-to-be-more-fun-diverse-and-inclusive/) supports testing the interaction before content expansion and avoiding passive helper roles. Both seats have identical tools; covering and cutting can remain voluntary specializations. Neither equal capture percentages nor forced role rotation is a success criterion.

Independent review and executable cases exposed and fixed:

- Held Support needed a real input capability rather than Race's one-shot keyboard/touch action. Quick presses survive the mandatory neutral handoff tick; fresh same-direction steering cancels rescue as intended.
- Adding a touch hold while keyboard Support was already held briefly inserted a false release and cancelled rescue. Real overlapping held inputs now remain continuous, with a full rescue regression case. In-play settings return keyboard focus to the arena, and a visible ring/status identifies temporary recovery protection.
- Rescue release, movement, loss of proximity and completion needed distinct input-reset behavior. A successful rescue stops both involved craft; reserve recovery changes only the downed craft.
- A recovering Hunter was still damaging a crossing cut. Hunter damage now exists only during commitment; a hit exactly at the recovery boundary is harmless, while an earlier hit still applies.
- Capturing a harmless Hunter's cell needed to remove it from future targeting, movement, damage and territory retention. Defeated actors also stop drawing warning markers.
- Newly secured land could overlap a Hunter's radius and let it enter safe ground. The wall solver now reflects motion into an already-overlapping solid boundary without teleporting the actor.
- Shield removal needed a frozen retention set across the entire capture cascade. Anchor capture cannot defeat the core in that transaction. Emitter removal occurs only on core defeat.
- Effects needed actual attribution: an idle enemy does not earn slow credit; simultaneous pulses use spatial ordering and cannot multiply the slowdown. Interception credit requires removing a real travelling impact.

## Executable evidence and its limits

The independent mechanics suite passes 66 cases: 40 cooperation, 22 core, and four comparative-route tests. The co-op input handoff suite adds 15 cases; the existing couch-input suite's 17 cases cover legacy behavior. Exact committed qualification records are authoritative for final counts and build provenance.

The authored Relay Yard can be cleared through public commands with its real enemies: anchors expose the shield at approximately **3.57 seconds**, and a later Joint Cut captures the core at **6.27 seconds**, with zero knockdowns, 50% coverage and all reserves intact. A repeated attempt and a spawn/command/seat-swapped attempt produce equivalent simulation state. This is a rehearsed feasibility route, not a normal-player completion-time target or a balance claim.

A broader earlier mechanics stress check compared 20 command logs across swapped seats for **48,000 simulation ticks**. The final Yard route supplies a bounded repeat/symmetry check after the final Hunter corrections. Additional difficulty stress covered three 120-second simulation runs.

Relay Yard's starting connected safe graph contains 352 cells and has a longest shortest route of **106 cells**. Including a one-second rescue, ideal route times are 14.25 seconds for walking at eight cells/second, 10.64 seconds when an eight-cell/second rescuer and three-cell/second downed partner move toward each other, and 8.07 seconds when the rescuer boosts at twelve cells/second. Those fit the respective Gentle/Standard/Expert windows of 16/12/10 seconds under these assumptions. Combat, human reaction time and later captured topology still need paired evaluation.

Browser checks use the real page and controls: arena/configuration selection, both keyboard seats, shared capture, Support use, pause and retry. These checks do not establish physical gamepad coverage, simultaneous physical touch coverage, accessibility qualification or human enjoyment. Those remain explicitly unverified.

An independent packaging audit found all ten co-op files and 40 transitive modules in the build inventory, with no optional/excluded dependency. The worker's precache and relative navigation paths cover the new page. This source audit does not replace an actual offline run of the qualified artifact. The existing solo entry still says “Couch race”; final navigation and offline-preparation presentation remain player-experience work.

## Required paired gate and artifact ledger

Use [the first paired playtest worksheet](paired-playtest-1.md). Introduce each mechanic before comparing the three configurations; keep the arena and difficulty fixed and vary comparison order where practical. Record whether a partner changes routes and outcomes, whether covering offers interesting choices, whether failures invite a shared new plan, and whether both players voluntarily want another attempt.

The requested feedback has been supplied and its material findings are addressed in the linked balance revision. The user's authorized emulated/browser retests are recorded separately from that feedback. Broader newcomer/expert and later paired qualification require their actual participants and cannot be inferred from our automated routes.

Implementation lives on `codex/relay-rescue` in the isolated `.cache/relay-rescue-worktree`. The original checkout's unrelated changes remain untouched. Phase 1 is committed as `7690139d25511a2b6187a16e9c83d6cd8be0cef1` (0.44.3); Phase 2's corrected checkpoint is committed as `761f2afdea4224c29a1cc493b5e4bd1c30991a76` (0.45.1). Exact-source test/build qualification and immutable playable artifacts are retained in the original checkout's `.cache/relay-rescue-artifacts/<version>/`; each `qualification.json` records its actual status, source commit, verified files, commands and distribution checksum. A source commit alone is not a passing build gate.

The initial 0.45.0 and 0.46.0-rc.1 qualifications exposed the same stale shell-test expectation: the intentional new co-op entry is now first in lobby tab order. Their runs passed 105/106 and 153/154 tests respectively, with this sole failure. The correction verifies the co-op link and destination, then Race, and preserves the existing child/Back-focus checks. The retained cutting comparison also now explicitly disables the advanced cooperation loop; its routes never used Support or knockdowns, and its measurements remain unchanged. All 16 affected shell/comparison checks pass before freezing the correction. Neither correction changes gameplay; paired observations from rc.1 remain applicable. Failed records are preserved, and fresh exact-commit qualification is required for the corrected versions.
