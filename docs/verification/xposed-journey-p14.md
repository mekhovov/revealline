# P14 Team Journey — local technical preparation

Status: in progress, not published or human-qualified. Work is isolated after P13
`aef61bec`, not an accepted release baseline. Publication remains with the release
coordinator; no version, release, public registry, assets or Pages writes here.

## Cooperative decisions before a content count

The review source currently contains eight purpose-built Team missions: existing
Twin landings and Shared detour plus three foundation-practice and three material-
practice greyboxes, in two explicit four-mission learning arcs.
This does not satisfy the twelve-mission program or broader Team qualification.
Existing definitions, runtime editions, manifests and execution keys are preserved
at every preset; the terrain successor stays in its own campaign. No Solo map is
automatically converted. Qualified actors remain field keepers, with explicit
Team foundations and TeamV2 material semantics. Advanced Solo roles, relays,
directional zones, shield encounters and bonuses remain unsupported in this
adapter and fail closed, not silently dropped.

Primary-source research checked during this increment:

- [Sparpweed's developer account of ibb & obb](https://blog.playstation.com/2013/08/06/ibb-obb-tag-team-psn-today/)
  describes building around interaction between two players from the start.
- [Nintendo's Snipperclips description](https://www.nintendo.com/en-gb/Games/Nintendo-Switch-download-software/Snipperclips-Cut-it-out-together--1173331.html)
  emphasizes communication, cooperation and coordinated movement.

Our design inference is to give each partner a spatially useful contribution and
let their captures change the other's options. These sources do not demonstrate
that our levels are enjoyable or guarantee engagement; Xposed remains the area-
capture reference, and neither game's mechanics or artwork is copied.

| New candidate | Shared decision | Optional goal |
| --- | --- | --- |
| Stepping exchange | Separate offset stepping stones or a central connection first | Both intermediate islands connected to the perimeter; both craft close without knockdowns |
| Divided workshop | Work two retained chambers in parallel or travel around the outside to help | Each craft closes in its starting chamber and connects its island without knockdowns |
| Switchback partners | Bank outer pockets or approach one middle platform around opposite wall tips | Both craft visit the connected middle platform and contribute a closure without knockdowns |

Bands2–3, constant measured actor tier, shared10-cell/s handling, no countdowns,
no bonuses and no new mandatory rule. These are authored ratings, not measured
difficulty. The three-mission practice campaign follows Twin landings; Shared
detour introduces Team materials afterwards. Remaining material-practice and
advanced-cooperation candidates must earn their place through distinct route
decisions, not mirrored maps or quota filling.

### Material-practice continuation

| Candidate | Complementary decision | Optional goal |
| --- | --- | --- |
| Crossed gardens | A slow bridge toward the middle or opposite outer garden enclosures | Neutralize both slow approaches and both lethal gardens |
| Split orchards | Different jobs in two retained chambers: enclose lethal field versus cross or bypass slow field | Both orchards neutralized, with each craft closing in its starting chamber |
| Weaver crossing | Opposite wall tips or one shared material approach to the middle platform | All four material patches neutralized and the middle connected to the perimeter |

Each goal also requires both contributors and no knockdowns. Bands4,4,5 follow
Shared detour's band3 without changing movement policy or measured enemy tier.
These use the existing TeamV2 terrain edition; enemies ignore player-only slow
terrain, and capture neutralizes hazardous material under the existing rules.

All nine material mission/preset routes clear and satisfy their optional goals
with joint cuts on/off and swapped seats:18 rule-setting cases plus18 swapped
cases. Each begins with simultaneous exposed cuts. Ninety additional seed cases
(five seeds × nine mission/presets × two cut settings) also clear without losses
and retain the optional goals. Fifteen Standard alternatives after0.5,1,2,3,5-second
delays qualify with both cut settings and seat orders. Some delayed clears leave
material behind; their optional goals are explicitly false, not awarded merely
because coverage reaches the clear threshold.

Initial greedy paths reached the ordinary quota before all material was reclaimed.
Those were rejected as mastery evidence. Different capture orders satisfy the
goals without raising quotas or adding mandatory cleanup. Delayed routes were
searched independently: blindly shifting an earlier command sequence could miss
a closure and attempt an illegal neutral brake. Such traces remain rejected by
the continuous-steering evidence guard.

The53-test eight-candidate/foundation/material/export cohort and four delayed-route
tests pass on Node20.19.5 and22.22.2. The real Team host keyboard suite additionally
clears all three material missions through two Next transitions at each preset
on both versions. That complements, rather than replaces, the earlier foundation
host suite. No native Team gameplay, human coordination or timing claim follows.
Material mastery routes take approximately19.2–46.4seconds in these rehearsed
fixtures; authored60–150second player-duration targets remain unvalidated.

## Current evidence and a rejected route

All nine mission/preset ordinary routes clear with both contributors and no
knockdowns. All nine optional-goal routes start with simultaneous exposed cuts
and satisfy a read-only goal observer. Each is repeated with joint cuts enabled
and disabled and with seats swapped:18 ordinary plus18 mastery rule-setting cases,
and the corresponding36 swapped-seat checks. Recorded commands reproduce exact
local state/event hashes. These are simulation fixtures, not an official replay
format, remote telemetry or a human skill measurement.

An initial Switchback mastery route used a neutral stop after visiting the middle
platform. The public core accepts neutral commands, but continuous host steering
does not let a player brake there. That route was rejected. Replacements visit
the platform through continuous steering and finish with real closures. The route
runner now rejects artificial neutral brakes between closures. Optional goals
require actual visits after perimeter connection, each contributor, correct
starting-chamber credit even after seat swaps, and zero knockdowns. Ordinary
clears do not automatically imply optional mastery.

All18 simultaneous first-return combinations stop both craft on reclaimed ground
without loss or an automatic empty-board win. All new spawns tolerate five idle
seconds at every preset. Divided workshop has two field components, each with
its own retaining enemy; neither chamber alone supplies its72% quota. Studio
geometry, selected-mission export and runtime cells match exactly. Foundations
remain outside earned coverage.

The real Team host also earns all three campaign clears at Gentle, Standard and
Expert using keyboard events, one deliberate Next and no lobby between missions.
Hidden setup changes cannot replace the accepted preset; final completion has
no automatic successor. This host test models DOM/Canvas and frame callbacks;
it is not native/controller/touch or timing evidence.

The31-test candidate/route/export cohort passes on Node20.19.5 and22.22.2,
including the explicit neutral-brake rejection. The83-test existing Team,
materials, input-policy and Studio/preview regression cohort also passes both
versions (114 combined on Node22). The real-host three-clear suite passes3/3 on
both. Scoped lint, formatting and diff checks pass.

Optimized ordinary routes currently take approximately20.6–37.5seconds. The
continuous-steering mastery replacements take33.2–43.8seconds on Switchback.
These rehearsed routes use visible-state knowledge; they neither validate the
50–140second player-duration target nor prove useful human collaboration.

## Authoring and sequence export

Studio provides Inspect Team Journey greyboxes → explicit Apply, and an explicit
Team campaign selector for test export. Export uses the same compiler, preserves
authored order, omits archived/non-Team members and pins the selected preset.
Mixed runtime editions, impossible topology, empty/unknown/archived campaigns
and invalid presets are rejected. No edition is upgraded, image substituted or
official award granted. Existing single-mission export identities are unchanged.

The resulting pack exercises the existing real Team import and Next flow.
It contains geometry/rules only and retains the host's truthful preview-scenery
label. This is not yet a complete cross-campaign Team Journey host or publication.

## Remaining gates

Native Studio inspection on the read-only `7f35c678` server (port8803) confirmed
that Inspect leaves the old draft applied, explicit Apply creates the five-
mission review, an empty campaign choice rejects export, and selecting Shared
returns requests a three-mission download with the geometry-only warning.
The selection survives a mission change. Divided workshop exposes two retained
components with two identified keepers; Switchback exposes three keepers and its
shared platform count. Reload restores the saved five-mission checkpoint1.
This verifies the native controls and accessibility text, not the downloaded
file's presence on disk or native Team gameplay. A screenshot attempt failed
because the hidden browser reported zero width; no global viewport override or
change to the user's port8778 was made. Visual/device inspection remains open.

Four further purpose-built candidates; reclaimed-roamer Team qualification before
the final learning arc, with explicit new runtime editions and historical guards;
delayed alternatives and broader seed/recovery qualification; native Studio/export
and real-device checks; original assets; uninterrupted cross-campaign Team Journey
navigation and persistence; two-human coordination/pacing/accessibility validation;
exact combined-tree review, versioned PR/release and Pages deployment.

No previously open art, human, native or publication gate is waived. Do not mark
P14 complete merely because the first five candidate definitions compile.
