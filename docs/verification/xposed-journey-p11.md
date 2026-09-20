# P11 Sentinel Crown — isolated implementation evidence

Status: local technical increment, not a released or human-qualified campaign.
Publication remains with the release coordinator. No public Journey enrollment,
version bump, PR, tag, release or Pages promotion is implied by this record.

## Versioned multi-shield encounter

The legacy encounter supports one shield relay. The successor pins
`xonix-level.v8` / `xonix-core.v9` / `xonix-replay.v10` /
`fnv1a64-state-v9`, with `xonix-encounter.v2`. Earlier level editions retain
their v1 descriptor and reject v2; the successor rejects v1. No historical replay
is reinterpreted. Geometry remains the shared foundation/relay/directional
contract, not a fourth new map mechanic.

One to four distinct, visible, required shield objectives must occupy distinct
earned-field cells outside the core. All must be captured before the single
shield-opening transition. A capture of several relays is one atomic transition;
list order is not a prescribed objective order. The release cut remains fresh
live trail closed during the advertised opening, or the existing isolated-core
fallback. A field-retaining Sentinel is not removed by ordinary enclosure.
New release-cut bounds exclude permanent foundations and gate connectors.

The runtime descriptor describes exact timings for deterministic transport.
Journey authoring selects the frozen `shield-relays-v1` recipe from actor catalog
`journey-actors-v6`, not per-level timing or speed overrides. Existing roles
retain their exact recipes. MissionDesignV4 / ResolvedMissionV4 use MapDesignV3
geometry, with an explicit nullable encounter. The new stationary role retains
its field until the explicit release; presets never shorten its warning.

Scenario/pack v9 transport preserves that runtime edition through Studio preview,
import, editor model, expansion export and installed-pack resolution. Old formats
reject the new descriptor. Foundations, gates, marked fields and flight
information recognize the successor. The legacy one-relay timing form is disabled
for the multi-relay edition; it cannot silently downgrade the encounter.

Studio adds an atomic encounter form: select a core and one to four visible
required shields; place the Sentinel on the core cell, optionally replacing the
explicitly selected field keeper. Other field anchors are not silently removed.
The shared compiler validates every supported preset/mode before adoption.
Older geometry is copied on write; unrelated missions keep their exact manifests.
Replacement preserves geometry. Two-action removal deletes the boss and encounter
links, but retains objectives and map geometry, warns about newly empty-region
fill, and remains undoable. Stale fields and cancelled adoption do not apply.

The functional visual language gains a static three-point crown silhouette,
shield counts and remaining-link cues, plus reclaimed-ground wording. These are
read-only projections. The Studio legend also names the crown explicitly.

## Verification

Node 20.19.5 and 22.22.2 each pass **63/63** tests across:

- `game/test/sentinel-core.test.mjs` (eight new tests).
- `game/test/encounter-core.test.mjs` (historical encounter semantics).
- `game/test/directional-core.test.mjs` and `directional-lifecycle.test.mjs`.

New cases cover edition mismatch, owned/accessor-safe bounded shield lists,
distinct eligible placements, one-to-four relay counts, either transaction
order, one transition, freeze/pause clock behavior, and actual legal-input
two-relay clears in Immediate and Grid + Buffer. Public replay reproduces the
clears. Save/restore preserves first-shield and transition states and rejects
changed encounter definitions. An independent legal-input life-loss branch
preserves the first relay; a fresh attempt resets it.

The first route probe incorrectly started its second long cut late in a rest
window and lost a life in both steering modes. The accepted route waits for the
advertised full rest window. Collision, warning and movement rules were not
weakened. These are engine fixtures, not campaign balance or enjoyment evidence.

Local outputs: `.cache/p11-core-node20-r1.tap` and
`.cache/p11-core-node22-r1.tap`.

The combined core/compiler/transport/Studio regression cohort now passes
**122/122 on each Node version**. This includes seven atomic-authoring/control
tests, four compiler/catalog tests and three transport/cue tests, alongside the
eight new core tests and earlier encounter/directional/editor regressions.
Outputs: `.cache/p11-core-authoring-node20-r1.tap` and
`.cache/p11-core-authoring-node22-r1.tap`.
The transport probe found a separate mastery-catalog source-format allowlist;
it now recognizes the new pack only with its matching core and an empty optional
equipment-mastery array. A canvas test initially passed a context instead of the
documented canvas argument; its fixture was corrected without changing rendering.

The shell/import/briefing/preview-readiness cohort passes **94/94** on both Node
versions. The P09/P10 route cohort passes **26/26** on both, retaining all42
ordinary Solo/replay and equal paired races for each campaign. A fresh exact-source
audit at `0582b6d5e71ad9366b3db36734705acf01169366` also reproduces all59 original
P01–P08 candidate manifest identities and checkpoints on both versions.

## Native scoped check

A read-only exact-`0582b6d5` server on localhost8798 was tested in owned tab38.
In a new local `sentinel-native-check` draft, native controls created three
required objectives, then atomically replaced the selected keeper with a
two-shield Sentinel. A duplicate shield was rejected without changing the draft.
Undo restored the prior keeper and one map revision; Redo restored the Sentinel
and two map revisions. Save/reload retained checkpoint7 and both shield links.

The exact Solo preview reached its ready state and explained both shield relays
and the release cut. Actual Start → Down input connected the starting island:
0.6% earned,140 points,three lives,craft stopped. The live shield counter stayed
0/2, while the visible locked horizontal lane cycled warning/active over reclaimed
ground without harming the stopped craft. Closing the preview returned focus to
Play. This checks a real closure and presentation, not a native full clear,
two-player/controller run, phone layout or human comprehension/enjoyment.

## Candidate increment

Four original core greyboxes form one shield-relay learning arc, with a separate
optional Remix. Three reference adaptations retain observed spatial motifs,
not copied coordinates, artwork or unverified rules. The explicit Studio
"Inspect Sentinel greyboxes" action imports candidates into a local draft; it
does not enroll them in the public Journey. See the Sentinel reference crosswalk.

All five maps start with one genuinely retained field component. Shared validation
rejects auto-fill, shield/gate overlap and wall/foundation overlap. All thirty
preset/steering first-return cases survive, retain the coverage denominator and
reproduce through public replay. The candidate/readiness cohort passes **17/17 on
Node 20.19.5 and 22.22.2**, including exact CLI/Studio manifests for all presets.
Outputs: `.cache/p11-candidates-node20-r3.tap` and
`.cache/p11-candidates-node22-r3.tap`.

The initial three very short straight-cut layouts were revised. A bounded legal
turning-cut search now clears First relay in 25.35 seconds with five closures and
no life loss, verified from fresh input. However, Twin receivers and Relay
perimeter still admit efficient 9.96/12.15-second solutions. In Twin receivers,
one tight enclosure captures both shields and isolates the core; the documented
release opening then completes the encounter. This is legal capture behavior,
not a reason to change the fill contract or impose mandatory delay. These
observations are **feasibility evidence, not accepted pacing or difficulty**.
The two candidates remain under review for distinct alternate/mastery routes,
human route comprehension and possible redesign or removal. Their proposed
60–150-second durations are not measured player results.

## Full-route and seed evidence

All **30 candidate/preset/steering combinations** now have no-loss Solo clears
through the shared attempt preparer, exact pinned identities/checkpoints and
public replay. All 30 independently allocated equal paired-board Versus races
finish tied. Tests require every shield exactly once, one atomic transition,
the full advertised transition interval, explicit core release, and constant
coverage denominator. Gate connectors open before victory and remain permanent,
non-scoring ground. These are technical feasibility tests, not Team or human
qualification. Boss coverage can exceed the quota before the required core is
released; the test explicitly rejects premature victory instead of incorrectly
treating this advertised encounter stage as ordinary objective cleanup.

Five additional deterministic seeds per combination pass: **150 sampled routes**
and public replays. They are finite samples, not a claim about every seed. One
Gentle/Grid + Buffer search stopped after capturing the shield with a narrow
22-cell region remaining. A legal continuation used two short cuts to isolate
the core, then the existing opening completed the mission. Neither the engine
nor that candidate was changed to make the route pass.

The combined route/seed/cue/goal-observer cohort passes **42/42 on each Node
version**. Outputs: `.cache/p11-routes-cues-node20-r2.tap` and
`.cache/p11-routes-cues-node22-r2.tap`. Read-only mastery observers reject joint
captures for separate-cut goals, late/closed/unclaimed connector visits, duplicate
or stale opening events, undersized release cuts, unfinished attempts and life
loss. Complete optional-goal route qualification is still in progress.

## Native candidate inspection

The read-only exact-`d4f596d5` server on localhost8799 was inspected in owned
tab38. "Inspect Sentinel Crown greyboxes" left the draft unchanged until the
explicit Apply action. The resulting local checkpoint contains four core
missions and one separately labelled optional Remix. First relay shows the
wall chamber, slow approaches, three starting islands and one retaining Sentinel
in the frozen overlay; no remote region would auto-fill.

The exact Solo preview loaded and actual Start → Down input closed the first
return: **0.6% earned, 130 points, three lives, stopped on reclaimed ground**.
After 35 seconds without further movement the same safe position still had
three lives. Closing returned focus to Play. This does not prove a full native
clear, controller/touch support or human enjoyment. The candidate remains a
greybox with inherited temporary artwork.

The briefing exposed a wording problem: one shield plus the core appeared as
"two required relays" followed by "all 1 shield relays." The successor briefing
now distinguishes **shield relay(s) + core**, separately counts any other
required objectives, and uses consistent singular/plural actor and live cues.
Legacy encounter wording is unchanged. These fixes have automated regression
coverage; the exact-d4 native check predates them.

## Remaining gates

Candidate balance decisions; complete mastery, delayed-start and lifecycle coverage; final original artwork;
Team qualification; native/accessibility checks; human capture comprehension,
failure explanation and voluntary retry; phase PR/review/version/release/Pages.
No completed phase or whole-plan claim is warranted yet.
