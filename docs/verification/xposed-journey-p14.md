# P14 Team Journey — local technical preparation

Status: in progress, not published or human-qualified. Work is isolated after P13
`aef61bec`, not an accepted release baseline. Publication remains with the release
coordinator; no version, release, public registry, assets or Pages writes here.

## Cooperative decisions before a content count

The review source currently contains twelve purpose-built Team candidates: existing
Twin landings and Shared detour, three foundation-practice and three material-
practice greyboxes, and four changing-ground greyboxes, in three explicit
four-mission learning arcs. A candidate count is not shipped or human-qualified content.
Existing definitions, runtime editions, manifests and execution keys are preserved
at every preset; the terrain successor stays in its own campaign. No Solo map is
automatically converted. Qualified actors are field keepers and explicitly versioned
TeamV3 reclaimed roamers, with shared foundations/material semantics. Other Solo roles, relays,
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

## Explicit Team reclaimed-roamer qualification

`TeamMissionV3` compiles to Team level v4 / rules v6 / pack v4. Earlier
editions remain unchanged and reject this role; campaign export still rejects
mixed runtime editions. The existing catalog v2 role is reused, not a new
pursuit mechanic: dormant roamers do not retain field, full-footprint reclamation
starts a 120-active-tick warning, and activation reflects the actor within
reclaimed ground and world bounds. The swept domain query is shared with Solo.
Active bodies can hit either craft on reclaimed ground or an unfinished trail.
Pause freezes the warning; per-craft recovery grace and bounded Support slowdown
remain effective. Studio capture diagnostics use the same nonretaining contract.

Nine contract tests include legal closure, full-footprint cancellation/rearming,
harmless warning versus active body/trail contact, pause/grace, domain/world
reflection, Support expiry, version rejection and exact export/import at all
presets. The 117-test engine/presentation cohort and 51 existing route/export/
composition tests pass on Node20.19.5; the combined 168 pass on Node22.22.2.
Existing foundation/material route hashes remain unchanged.

The Team painter reuses the existing tracked body, with DORMANT / WAKING /
ROAMER labels that remain through pause and reduced effects. Captioned warning
and failure advice explicitly distinguish reclaimed ground from protection.
Painter tests observe commands and object identity, not physical readability.
The pre-existing source-frame test incorrectly pinned theme revision34 although
the baseline is revision37. Its metadata assertion is corrected; all five old
PNG hashes remain exact and the existing roamer PNG gets a sixth exact hash check.
No artwork was generated or changed. Native roamer inspection remains open.

## Changing-ground continuation

Four original cooperative decisions use only two threat roles and one introduced
mandatory rule across the arc:

| Candidate | Shared decision | Optional goal |
| --- | --- | --- |
| Shared lookout | Build outer returns before waking the central roamer, or share an island connection | Activate the roamer, both craft close, no knockdowns |
| Twin depots | Coordinate or stagger wake-ups in separately retained chambers | Activate both roamers; each craft closes in its starting chamber; no knockdowns |
| Changing courtyard | Neutralize the upper hazard or develop the lower slow approach before joining the middle | Activate both roamers and connect the courtyard; both craft close; no knockdowns |
| Last rendezvous | Approach opposite stepping islands or reopen the other flank together | Activate both roamers and connect both intermediate islands; both craft close; no knockdowns |

Bands5,5,6,6 are authored, not measured. Geometry-only candidates use shared
10-cell/s controls, measured catalog tiers, no countdowns and no new mandatory
rule after the first mission. All initial chambers have keeper anchors; roamers
are excluded from retention. All48 preset/joint-cut/seat-swap combinations allow
five seconds of idle spawn inspection and simultaneous no-loss first returns.

Twelve clear/mastery public-command recordings (four missions × three presets)
pass with joint cuts enabled/disabled and swapped seats, with exact repeated
state/event hashes:48 initial route cases. Another120 seed cases preserve
no-loss mastery, and20 independently searched Standard alternatives cover
0.5,1,2,3,5-second delayed departures with both joint-cut settings and swapped
seats. Continuous steering is enforced by the route fixture guard; no simulation
state is arranged in these route runs. Optional activation does not gate a normal
clear and a warning is not credited as an activated roamer.

The37-test candidate/route/composition/export cohort and5 delayed-route tests
pass on Node20.19.5 and22.22.2. Existing eight-mission manifests and execution
keys stay exact when composed under the additive actor catalog v2. The real
Team host clears this four-mission campaign at all three presets with one Next
per transition and no intervening lobby on both Node versions. Node22 additionally
checks the new truthful “On reclaimed ground” HUD and warning help. These are
modeled-DOM keyboard tests, not native/controller/touch or latency qualification.

Optimized clear/mastery routes take21.8–40.4seconds; these rehearsed feasibility
routes do not validate the60–150second target or a monotonic human challenge
curve. Faster optimized Expert clears reflect route/actor timing differences,
not a claim that Expert is appropriately balanced. Human pacing may require
redesign or cuts; the count is not a reason to retain weak content.

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

Broader recovery qualification; native Studio/export
and real-device checks; original assets; uninterrupted cross-campaign Team Journey
navigation and persistence; two-human coordination/pacing/accessibility validation;
exact combined-tree review, versioned PR/release and Pages deployment.

No previously open art, human, native or publication gate is waived. Do not mark
P14 complete merely because candidate definitions compile.

### Native authoring finding and repair

Read-only source `f4a9f161` on port8804 showed Inspect preserving the one-mission
draft until explicit Apply, then saved checkpoint2 with12missions/5campaigns.
Twin depots showed both craft, both roamers, and only the two keepers as field
anchors in its two retained regions. Selecting Changing common ground requested
a four-mission geometry-only export without changing the draft. Downloaded-file
presence is not claimed.

Native inspection also exposed an actor-picker gap: existing Team roamers were
listed but the role choices still filtered all Team editions to field keepers.
The picker and Team resolver now share `teamRoleQualified`; V3 permits keepers
and reclaimed roamers, while V1/V2 retain their exact restricted role sets.
An admin can select and replace the roamer using catalog speed tiers without
editing raw JSON or changing shared maps. Unsupported/stale edits still fail
before adoption. The28-test editor/contract/composition cohort passes on both
Node versions. On the exact repaired `624511c5` source (port8805), native Studio
exposes precisely the keeper and roamer roles for Twin depots. Selecting roamer-1
shows measured1.6cell/s, nonretaining behavior, 120actor-tick warning and its
authored position. Changing x23.5→24.5 through Validate & replace creates
checkpoint3 with unchanged foundation/eligible counts and both keeper anchors.
Undo restores x23.5 and enables Redo. This checks the native form/transaction,
not new layout playability or canvas contrast. No pixel screenshot or native
Team gameplay claim is made.

### Cross-campaign navigation contract

The new Team candidate adapter uses the existing compiler/execution catalog,
stable Journey mission IDs and shared explicit-core sequencing. It resolves all
12 missions at each preset across four campaign boundaries, retaining each
homogeneous pack and its original level version instead of flattening or
upgrading content. Destinations preserve the current preset, reject unowned or
cloned rows, and stop deliberately after Last rendezvous. Archived/reordered
membership is compiled, not duplicated in a second map list. Skip/profile tests
preserve stable IDs without manufacturing clears.

Shared mission cards now use the actual Team engine for Team manifests, showing
both numbered seats, exact foundations/materials and actual actor roles. Solo
card shape and route behavior remain unchanged. The42 navigation/card/prior
route/material/catalog tests pass on both Node versions;31 additional role-
rejection catalog tests also pass after updating their expected diagnostic text.
The explicit local `game/couch/relay-rescue.html?journey=team-greybox` entry now
connects this adapter to the real Team host. This is a labelled geometry review
route, not default/public Journey enrollment. It reads the shared Journey
difficulty without rewriting legacy arena preferences; denied preference reads
are visibly session-only. An arena selector claimed during loading retains its
native options/choice. Unknown or duplicate entry parameters retain legacy Team.

Twelve consecutive Standard clears, including all four campaign boundaries,
pass on Node20 and22 using keyboard events and ordinary frame callbacks: one
Next per successor, no lobby/discard/mode navigation, no lost reserves, and
accepted difficulty/cooperation settings retained despite hidden setup edits.
Last rendezvous offers replay/chooser/exit rather than automatically restarting.
Two new opening command recordings also pass continuous-steering validation,
both joint settings, swapped seats, seeds1/17 and exact repeated state/event
hashes. They establish legal ordinary clears, not Shared detour mastery.

The optional chooser exposes all twelve missions, and a direct Expert selection
into Changing common ground clears and advances with its preset intact. Loading,
first-paint and post-adoption setup failures restore the earned result, picture,
old pack/options and exact mission; a fresh Next succeeds. Cancellation rejects
a late decoder completion. An imported pack with identical mission IDs remains
independent and cannot acquire cross-campaign authority. These12 host cases and
two opening-route cases pass on both Node versions (scoped cohorts). Existing
legacy Next/reentry checks also pass27/27 on Node20.

The exact `fc6bad8d` source on local port8806 was also inspected natively:
labelled twelve-mission geometry route, all twelve chooser cards, direct Play
Shared lookout into the running arena with both reclaimed-ground HUD labels,
0% and two reserves, then Pause at six seconds. No native clear, gameplay timing,
human coordination, enjoyment or visual-contrast claim follows. The optional
chooser's generic fallback-scene "Artwork teaser" wording still needs a more
explicit candidate label.54 legacy Next/import/discovery/recovery tests pass on
both Node versions.

### Release-independent Team progress

The explicit Team entry now reads the existing `revealline-journey-v1` profile,
with separate Team cursors, skips and exact completion receipts. Successful
host admission records selection; a command-earned win records the owned
manifest's simulation identity and accepted preset exactly once per run. No
official award is created. Imported same-ID packs remain excluded. Failed Next
does not advance the cursor. Returning after a clear selects the authored next
mission, including a different campaign; a last-mission receipt never wraps to
the beginning. Unknown historical IDs/receipts and other modes remain intact.

Storage denial does not prevent playing or Next. An explicit session-only notice
offers Retry saving progress and Export progress. Export uses the shared portable
backup format and truthfully reports a download request, not a confirmed file.
Retry merges pending events with other saved modes without replacing the paused
run. Native-selector intent during loading still takes priority over restoration.
The profile adapter owns no per-release keys or runtime simulation changes.

Five progress-contract tests plus16 real-host cases pass on Node20 and22, including
the full12-mission flow, profile recreation, command-earned receipt, failed-Next
cursor, denied-save export and recovery.69 legacy/shared-profile regression cases
pass on Node22. This is modeled storage/DOM evidence, not browser disk/quota or
native-progress approval. Keyboard saving recovery restores the available Next
action when its focused warning disappears, without resuming the attempt.

### Two-activation Skip without a menu detour

The explicit Team route offers Skip during play and on a paused/lost attempt.
First activation pauses and names the successor with a no-clear explanation;
the second prepares and starts that exact successor. It does not open the generic
discard dialog or visit setup. The final mission never wraps. Changing focus or
losing foreground revokes unconfirmed intent. Choosing Skip from a command-lost
Expert attempt cancels pending automatic retry but still requires confirmation.

The existing Next transaction retains the unfinished attempt and its picture
until successor preparation, first paint and setup adoption pass. Failures/cancel
restore that attempt and award neither a skip nor a clear. Late decoder completion
cannot replace it. Held directions do not carry into the successor; no blanket
input delay is added. Previously skipped missions remain selectable, and a later
legal clear removes the skip marker.

Shared profile `recordMany` validates an entire bounded event batch before
publishing it, so Skip and its successor cursor appear together even to synchronous
observers. The same events persist through the existing IndexedDB transaction;
the schema/database/version is unchanged. Invalid batches change nothing.

The13 focused skip/atomicity cases pass on both Node versions. They include all
eleven successive skips across five campaigns with zero clears, cancellation
during exposed cuts, three failure stages, loss recovery and later earned replay.
Modeled controller navigation and touch activation add two passing cases on both
Node versions, not physical-device evidence. The full101-case host/progress/
legacy regression cohort also passes on both, including twelve consecutive
command-earned clears after the Skip integration. Local TAPs retain these results.
Candidate difficulty controls, clearer chooser presentation, original backgrounds,
broader real-device qualification and deployment remain open.

Native exact `57f359bb` on local port8807 verifies Start Twin landings → Skip
mission → named Confirm skip → running Stepping exchange in the next campaign,
0%/two reserves and no setup/discard dialog. After pausing and reloading that
same origin, Stepping exchange is selected with Standard and a ready Start
button. This verifies browser control flow and persistent mission restoration,
not preservation of an unfinished attempt, a native clear, input latency,
small-screen layout, physical controllers or human enjoyment.

### Explicit Team difficulty selection

Owned candidate missions now allow Gentle, Standard and Expert selection before
Start. Each choice selects the exact compiled edition and retires the previous
picture lease before exposing new setup. Starting, Next and Skip pin that edition;
active attempts and immutable imported editions cannot be silently reconfigured.
Later decode completion cannot replace a newer choice. Failed preparation keeps
the requested preset and offers picture retry rather than changing difficulty.

The shared release-independent difficulty preference persists explicit choices.
Denied storage leaves the selected edition playable with a truthful session-only
notice, retry and portable export. Browser-restored form values and changes from
another tab cannot replace this visit's prepared or accepted edition. Returning
to setup permits a deliberate new choice. Successful saving restores the visible
primary action without starting or resuming play.

Nine focused preset cases pass on Node20. The broader host/import/legacy cohort
passes67/67 on Node22; the corresponding host/import subset passes40/40 on
Node20. Shared preference/restoration checks pass18/18 on both versions. Scoped
Prettier, ESLint and diff checks pass. These are modeled DOM/storage/input tests;
native preset qualification, chooser clarity, original art, human/device evidence
and publication remain separate gates.

Native exact `c07b9162` on local port8808 now verifies keyboard selection of
Expert in the pre-game Challenge menu, Start with one reserve, two-activation
Skip into Stepping exchange with one reserve, and same-origin reload restoring
Stepping exchange plus Expert with a ready Start. This is native control and
persistence evidence, not a human difficulty/pacing or physical-device verdict.

### Exact Team mission cards, without substitute artwork claims

The explicit review entry injects candidate card presentation into the existing
flat Team chooser. All twelve cards use the shared engine-derived starting map,
with numbered craft1/2, actual terrain/foundations and initial threat positions.
Cards state the challenge band, selected preset, route decision and an optional
goal explicitly marked not tracked. They never describe the diagram as a live
capture prediction or an authored reward picture. Original artwork remains pending.

The shared profile distinguishes an exact selected-edition clear, another preset's
clear, an earlier edition's receipt, skipped and not-cleared missions. None gates
Play. Same-ID imports cannot acquire owned candidate diagrams or progress labels.
Legacy/imported cards retain their existing asynchronous picture preview pipeline;
candidate cards have one direct Play action. Missing/lost Canvas retains route
text and Play, not a misleading fallback artwork preview. Legacy entry does not
gain a static dependency on the content compiler or Solo engine for this feature.

All50 scoped card/discovery/picture/host/input cases pass on Node20 and22. They
cover36 exact preset cards, both numbered craft, progress distinctions, same-ID
imports, later-campaign direct launch, real Skip labels, legacy gallery lifecycle
and failure recovery. Native diagram inspection and flat search/filter are still
pending; this does not qualify artwork, visual accessibility or human enjoyment.

Native exact `90dd8e43` on local port8809 exposes all twelve candidate diagrams
with distinct topology, numbered craft, band/preset, no-clear state, route and
optional-goal copy. The normal-viewport screenshot shows the first four maps;
no candidate has an artwork-preview button, while both legacy cards still do.
This verifies native rendering at that viewport, not small-screen/contrast or
physical-input qualification. Long optional-goal copy remains a density concern.

### Flat Team search and campaign filters

Search and campaign/pack filtering now live in the same optional chooser. Search
matches normalized multiword titles, IDs and card route text across the complete
available library; a campaign selector narrows that result without opening another
page. Grouping uses actual source-pack identity, not potentially colliding import
IDs. All matches retain direct Play. No result or hidden stale Play can launch an
arena. Search Enter is not Play. Back preserves the current setup/attempt.

Filters retain focus, report result counts and explain how to recover from an
empty result. They stay fixed during staged Play; cancellation returns to the
filtered mission and rejects a late decoder. Reopening starts with the full library.
Legacy picture detail hides filter chrome and keeps its existing Back behavior.
The combined89-case discovery/preview/input/difficulty/full-Journey cohort passes
on both Node20 and22, including12 consecutive legal clears and reversible Skip.
Scoped formatting/lint/diff checks pass. Native search remains a separate next check.

Native exact `21d6f467` on local port8810 verifies Search lookout → one result,
Enter staying in Search, one Play launching Shared lookout at0%/two reserves,
Pause → Browse → Changing common ground filter showing4 of14 cards → Back to
the unchanged four-second paused attempt. Focus returns to Browse Team arenas.

### Journey terminology and optional card detail

All explicit Journey Team editions now use reclaimed ground in the HUD, closure,
independent-cut instructions, Support/rescue help and self-trail failure advice.
The wording is edition-based, not dependent on whether a roamer happens to be
present. Historical Team editions keep their established wording. No simulation,
level, replay, coverage or receipt bytes change. The normal-viewport card review
also led to an optional-goal disclosure: the route question and Play remain visible,
while optional untracked mastery detail is available without crowding every card.

The46-case terminology/card/briefing/recovery/material/roamer/search/host cohort
passes on both Node20 and22. It covers all36 candidate presets, representative
foundation/material/roamer host setups and untouched historical guidance. The
full27-case Team Journey flow passes on Node22; the changed held-direction case
also passes on Node20. Scoped format/lint/diff checks pass. Native compact-card
and early-Journey wording inspection remain next, not human qualification.

Native exact `746ba0bc` on local port8811 confirms Twin landings' reclaimed-ground
closure/rescue/return-route instructions. All twelve optional goals start collapsed;
opening and closing Twin landings' goal leaves Play separate and the chooser open.
The normal-viewport screenshot confirms distinct diagrams and visible route/Play
with compact goal disclosures. No small-screen or physical-controller claim follows.

Departure and chooser-replacement warnings now distinguish unsaved territory in
the current attempt from previously recorded mission clears. They no longer claim
that all Team progress exists only on the current page. Eighteen exit/discovery/
input cases pass on both Node versions, including candidate and legacy Stay paths.

### Explain occupied regions at early Team closures

The first authored four-mission Team learning arc now gets a short in-play capture
caption. After an actual cells-claimed/closure event, the shared frozen capture
inspector counts retained regions and identifies their field-enemy anchors. The
caption explains that empty regions fill while occupied regions remain unclaimed,
and reminds both players to choose a fresh direction. Joint-cut feedback preserves
the explanation. It never pauses, opens a tutorial dialog or predicts a future cut.

The explicit candidate entry supplies arc membership from the shared learning-arc
registry. Same-ID imports, unowned rows, mismatched presets/editions, later arcs and
legacy stronghold encounters do not acquire this teaching behavior. No simulation,
event, manifest or progression bytes change. Existing danger/rescue messages can
still take precedence in the event stream.

Fifty capture/ground/roamer/chooser/search/full-Journey tests pass on both Node20
and22. Public-input first-arc closures include line-only returns; before/after
state serialization proves the inspector does not mutate them. An actual-host
joint bridge earns under5% while both field keepers remain represented in the
caption, with no menu/pause interruption. Twenty-two additional legacy briefing/
discovery/exit checks pass on Node20. Native caption readability and genuine player
understanding remain separate evidence, not inferred from these scripted tests.

Native exact `ac6f8868` on local port8812: Start Twin landings, steer both craft
toward each other with D/Left, then observe a joint bridge earning1.1%, two
reserves and both craft stopped on reclaimed ground. The caption identifies one
retained region containing north keeper and south keeper; the screenshot shows
the bridge, remaining field and the explanation without an intervening dialog.
The attempt was then paused at16seconds. This is a native partial-capture/control
check, not a full native clear or evidence of human comprehension/enjoyment.

### Original Team artwork source bindings

Eleven new original compositions (30,437,143bytes,1774×887PNG) join the existing
Shared detour original. The twelve-mission factory accepts explicit `artwork:true`;
Studio Inspect uses it but still requires Apply. Greybox defaults, mission editions,
geometry-only exports, simulation identities and official-progress eligibility
remain unchanged. Full prompts and immutable pins are in
`docs/research/team-original-art-prompts.json`.

The15-case artwork/candidate/export/registry cohort passes on Node20 and22.
It verifies all twelve original hashes and decoded-header dimensions,36 preset
manifest pairs and64 two-seat route replays (joint cuts on/off), retaining historical
checkpoints, clears, zero downs and contributions from both seats. Clear routes
are not automatically mastery routes; each retains its previous mastery result.

At the source-binding checkpoint, the Team host and geometry exports
do not yet deliver these candidate originals. A verified candidate-picture adapter,
native picture checks, human/device qualification and release integration remain.

### Explicit Team original-picture host candidate

The separate `?journey=team-originals` entry opts into the authored background
registry. `team-greybox`, ordinary Team entry and geometry exports remain unchanged.
The candidate adapter verifies full pinned bytes and complete decoded dimensions
through the existing authenticated candidate-picture owner. It accepts only a
code-owned immutable Team row, exact pack/level/attempt and prepared FPV snapshot.
It does not mint an official award, import receipt or managed-media assignment.

The painter accepts varied2:1 dimensions only from a live opaque candidate owner;
forged/cloned or disposed bindings fail closed. Historical Team bindings and
uploaded envelopes retain their exact1152×576 contract. Each selection/preview
owns an independent lease so preparing the next original cannot release the
currently playing picture. Coverage, terrain concealment and victory percentage
remain simulation-owned. Candidate cards retain starting-map diagrams and truthful
visual-qualification labels; final picture-card design is not implied by this step.

Integration seam: the UX owner's Team78/owned-presentation host work covers
starter/historical/import paths, not Journey `row.background`. Compose these small
candidate-selection/painter hunks with its newer accepted-display, exact Retry/Next,
snapshot/audio/apply ownership. Do not replace the newer host file wholesale.
No release or device qualification follows from this isolated implementation.

The49-case adapter/painter/legacy-picture-host/art/card/Team-original-host cohort
passes on Node20 and22. It earns all twelve clears with original-byte hashes,
eleven direct Next handovers, one deliberately failed preload preserving the result,
initial image failure and explicit Retry, and one-action chooser launch. The final
theme-identity hardening and painter checks were re-run separately:19/19 on both
runtimes. Scoped lint, format and diff checks pass. These use real runtime/host
commands and finite browser/decode models, not native performance or human evidence.

Native exact9a775e3ad4b5ca905754e379ea39086524baed04, localhost8813,
`?journey=team-originals`: Standard, Full teamwork, sound off, normal tall viewport.
Twin landings starts deliberately after verified readiness; D/Left joins a bridge
for1.1%, then W/Down establishes outer returns for2.5%, with2reserves and both
craft stopped. The live caption distinguishes one retained region from two and
names the responsible keepers. The screenshot shows the original through the
foundations/border/cuts without changing the opaque unclaimed field.

Paused Browse→Changing courtyard→Replace & play starts directly with0%,2reserves.
D/Left connects each side to the middle for1.6%, retaining both reserves. Original
courtyard fragments, brick walls, lethal crosses, slow dashes and two DORMANT
roamer labels remain distinct. Skip then Confirm skip starts Last rendezvous
directly at0% with its different dusk original. W/Down earns0.5% through opposite
outer returns, still2reserves. The final mission offers no forward Skip. It was
left paused at41seconds. No clear was awarded by these partial checks.

Scope remains narrow: three native originals/partial-capture states, keyboard,
muted audio and normal viewport. No native whole-board victory, all-twelve native
pass, roamer awakening/active contrast, physical-device/performance qualification
or human understanding/enjoyment is inferred. Candidate cards still use diagrams.
