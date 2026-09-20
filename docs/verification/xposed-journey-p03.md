# Journey P03 — Signal Gardens greybox preparation

20 September 2026. Provisional **0.71.0**, isolated from P02 source `8631ee2c`.
This is candidate preparation while earlier release gates run, not an accepted
baseline, released campaign or completed phase. Merge the accepted P02 composition
and requalify exact source before promotion. Original/user worktrees are untouched.

Automatic merge `0234e8ba` subsequently incorporates P02 `9fe6276f`, including the
release owner's `014449ed` Journey/Couch music composition. The42-test focused
cohort passes again after this merge. Source composition is not phase acceptance.

Later mergef33f1969 includes repaired P02fd6745a9, its retained fpv33/fpv34 history,
bounded Studio metadata capacity and release-owner evidence/cutoff. The expanded
Signal candidates/terrain/routes/timing cohort passes44/44 in24.5seconds after this
merge. A separate two-test crosswalk cohort pins four reference originals and all
119 clear/delay fixtures, while keeping artwork/mastery/final dispositions pending.

## Scope and design

Seven original 72×36 maps form two three-mission learning arcs and one optional
Remix. Bands3–4 continue Border's final core band. The first arc introduces only
slow field, the second only lethal field; both provide introduction and focused
practice before combination. Familiar keeper/perimeter/frontier roles retain their
catalog speeds. No countdown, custom player handling, required pickup, extra menu
gate or new foundational engine mechanic is introduced. “Interference” means the
existing visible slow material here, not an unexplained input/ability penalty.

| Candidate | Route decision |
|---|---|
| Soft crossing | Short slow crossing versus a longer clear approach to the island. |
| Dry spine | Enclose one slow bed from an interior spine, or route around both. |
| Wide approach | Bridge a slow center or link two landings around it while shaping a frontier. |
| Cool the crossing | Neutralize a central lethal bed before crossing, or keep a broad outside route. |
| Garden refuges | Enclose the nearer lethal row, or loop around both ends to another refuge. |
| Neutral ground | Open the slow west or lethal east approach while preserving a central cross. |
| Winding channels | Choose the connection order among three refuges and two material types. |

Studio offers Inspect Signal Gardens greyboxes through its existing explicit
Inspect → Apply contract. Inspection does not replace the current draft or publish
anything. Every mission retains original design metadata, one optional practice
challenge and an explicit null background. Temporary Horizon styling is disclosed
as greybox presentation, not completed campaign art or new characters.

## Reference review

Four supplied stills were directly re-viewed at2048×853 (original6144×2560) and
independently matched to the inherited ledger's original byte length/SHA-256:

| File | SHA-256 |
|---|---|
| pack-1_level-5.png | d13314917e1961950221a182597551dbbd6241d6f9bd15818597c80865ad67e9 |
| pack-1_level-7.png | 4b31b6e97b6fca6d8dd869d47771f13937162214953d220dcf53a7dc9d4b3c0a |
| pack-2_level-1.png | a66bc59d10e8a3310aabf1d8f74ba5b1fd281241f14fce6112137c16a2673302 |
| pack-3_level-1.png | 5b55e34edb9d9e0a4d5c59c02717250defd7a9fdb6b8f0273cfd068bdff67be8 |

The retained ideas are marked central beds, gaps between terrain rows, broad bypasses
and separated refuges. Coordinates, literal lettering, actor counts and artwork are
not copied. The stills do not prove exact terrain behavior, enemy domains/speeds,
collision tolerances or fill rules. We explicitly define our slow/lethal behavior.
The three-bay reference is simplified into separated refuges; no new relay gates
are implied. A final per-reference disposition remains pending greybox comparison,
alternative-route evidence and human testing; these are not four completed imports.
`docs/research/signal-reference-crosswalk.json` machine-pins the four source hashes,
byte lengths, each current Standard runtime identity and the intentional departures.

## Verification

The focused candidates/terrain/routes cohort passes **42/42** in19.1seconds. This
includes42 first closures across all presets and steering policies, repeated with
every bonus removed. First returns preserve lives, stop-on-capture and10cells/s
base handling. The first slow lesson adds exactly60fixed ticks over its clear-field
counterpart; the lethal introduction has a safe-material-free opening route.
Every initial field component has a retaining keeper; no topology error is reported.

`game/test/fixtures/signal-clear-routes.json` pins **84 complete Solo routes**:
seven missions × three presets × two steering policies × authored/omitted bonuses.
Each route is replayed from a fresh seed-1 run with legal inputs, zero lost lives,
exact runtime identity/checkpoint and verified exported replay. Replaying all84
on both independent untimed race boards yields equal terminal checkpoints and
simultaneous-clear draws. Optional bonuses are unnecessary for these full clears.
No run is fabricated by mutating gameplay state. Exploration cloned states only
to evaluate route choices, then replayed the selected inputs from a fresh run.

The separate Signal timing cohort replays all84 routes at seeds0,1,42,2026 and
0xffffffff: **420/420** no-loss clears,24.3seconds. This verifies seed robustness
for these authored starts/headings, not random layouts or broader human skill.
The separate delayed-start fixture supplies35 fresh legal no-loss clears: all7
greyboxes after0.25,0.5,1,2or5seconds of initial idle, Standard/immediate/seed1.
The two-test timing cohort passes in26.1seconds and verifies every delayed route's
exact checkpoint and exported replay. Idle time itself must preserve lives; routes
are recomputed for each sampled threat phase, not asserted identical to instant
starts. These five samples do not establish arbitrary-delay safety, other delayed
preset/steering combinations, human reaction tolerance or optional mastery.
Genuinely different strategic route choices remain a separate acceptance gate.

`signal-mastery-routes.json` additionally pins seven Standard/immediate/seed1
optional-goal routes, each from legal input with no life loss and a verified replay.
Independent predicates observe all material cells, entry order, foundation visits
and four-connected reclaimed paths. Soft crossing's mastery route actually uses
the252-tick slow opening and neutralizes its entire bed; Neutral ground neutralizes
both beds. Wide approach links both landings; Remix links all three without freeze.
Dry spine captures one bed before entering the other; Cool the crossing neutralizes
its bed while the far landing remains unvisited. Garden's wording is clarified to
require both row neutralization and connection, without an ambiguous strict order
inside one atomic capture. These wording edits do not change execution identities.

The first greedy Soft crossing mastery search stalled at67.998% with110 marked
cells left, not a proof of impossibility. A legal search constrained to the taught
opening found a complete27.85-second route; Neutral ground's is31.55seconds.
The mastery/crosswalk cohort passes3/3 in1.9seconds. This establishes feasibility
for the sampled preset, not automatic awards, all-preset mastery or human enjoyment.

Omniscient active-play durations are18.65–21.95s(Soft crossing),20.45–28.95s(Dry
spine),27.85–28.05s(Wide approach),18.85–30.25s(Cool the crossing),45.05–57.65s
(Garden refuges),26.65–27.95s(Neutral ground),33.75–63.45s(Remix). These are not
human duration estimates. Short candidates need pacing/distinctiveness review;
do not inflate quotas or force waits merely to meet the45–150second target.

Native Studio on the isolated8780server: Inspect retained Nearby shore until
explicit Apply; all7greyboxes then appeared in2campaigns/2packs. Expert Soft
crossing showed2lives,10cells/s,68%target and no countdown. Actual Practice
Start → Down closed on the foundation at0.6%/150points/two lives, then paused.
Elapsed0:19includes idle inspection and is not a speed benchmark. Closing preview
returned to the intact draft; Cool the crossing showed its lethal20×10bed at(25,10).
Two initial boot refusals were caused by omitted local catalog/archive-catalog
files in the sparse worktree. Restoring their exact tracked copies allowed normal
boot; their error logs remain, with no new errors after successful launch.
This is an agent opening observation, not a complete native route or human test.

## Local tracing benchmark

[The six-fixture color-tracing benchmark](signal-tracing-benchmark.md) records a
bounded local proposal prototype and five passing tests. Flat/noisy cell-aligned
diagrams match exactly, while a similar-colored background has2330false positives
and only0.021intersection-over-union. Fragmented output is explicitly refused.
The prototype does not decode, save, apply or publish and is not exposed in Studio.
Retain manual geometry as the supported UI path until real-image/crop/native and
human-correction evidence justifies an assisted UI. This is measured feasibility
and a documented limitation, not completed general image-to-map recognition.

## Remaining gates

### Reactive terrain captions

The Solo host now appends accepted slow/lethal cell counts to its existing capture
caption, retaining occupied-region teaching and the fresh-direction instruction.
Erosion captions identify reactivated material and its effect. The read-only helper
counts only event-listed cells in their current reclaimed/unclaimed state; it does
not predict moving captures, promise enemy-free ground, mutate the simulation, add
a dialog or change controls. Historical simulation/replay identities stay intact.
The four-file host/source/terrain cohort passes **34/34**, zero skips, in39.7seconds
onNode20.19.5; changed-source lint, formatting and whitespace checks pass.
An actual-host legal line-only closure confirms two slow cells neutralized while
the occupied lethal region is not described as captured. Existing warning ownership,
save/resume, terminal-message priority and BFCache tests also pass. This is modeled
host evidence, not native-device or Team/Versus terrain-caption qualification.
The first wider run failed to load two omitted sparse fixtures (classic-lab and
sentinel-relay); restoring their exact tracked copies allowed the complete rerun.

Native check on source3b284853 / localhost8780: reloaded the saved Signal draft,
launched Standard Soft crossing Practice, and made two keyboard Down closures.
The first earned0.6%/150points with all three lives and reported **5 slow-field cells
neutralized by this capture**, preserving the fresh-direction instruction. The
second earned1.3%/310points and stopped again. Paused Field details retained both
first-capture captions in Recent messages. Back to Pause → Close preview returned
to the unchanged checkpoint1 draft. The elapsed0:16 includes inspection/idle and
is not a timing benchmark. Only the two previously documented sparse-catalog errors
remain in the tab log; no new error appeared. No full clear or human test is implied.

### Explicit Team terrain edition

TeamMissionV2 opts into level.v3/pack.v3/ruleset.v5; historical TeamMissionV1,
foundation level.v2 and historical level.v1 keep their prior runtime identities
and reject terrain fields rather than reinterpreting old content. Shared map
compilation supplies foundations, walls and underlying slow/lethal materials.
Only active craft in unclaimed slow field receive the0.5speed factor; enemies,
their partner and downed recovery movement retain their rules. Lethal contact
uses Solo's swept expanded-box contract, including corner contact, before capture
resolution. Support and enemy grace do not neutralize a material hazard.

Capture removes both effects for both craft while preserving underlying material
definitions and the fixed earned-coverage denominator. Painter marks only active
unclaimed material using Studio's same paired dashes/framed cross, including
reduced effects. Briefing and knockdown text explain the material. Accepted
neutralization events use the read-only shared caption helper; no prediction or
new blocking screen is introduced. One shared Team compiler/export/registry path
pins each preset; mixed runtime editions within one Team campaign are refused.

Studio adds an explicit **Team · material-ready islands (greybox)** creation
template. Existing templates/drafts are not upgraded, published or certified.
Authors can edit terrain through existing copy-on-write geometry controls and
export the exact selected edition. Team actors still qualify only field keepers;
bonuses, objectives and timers remain rejected by this candidate adapter.

The complete13-file affected cohort passes **108/108**, zero skips/failures,
10.717seconds onNode20.19.5, including existing historical/foundation routes,
recovery, actual import/Retry, renderer observations and structure CRUD. A legal
enclosure neutralizes lethal ground and lets the other craft traverse it; duplicate
legal command sequences reproduce complete state. Three presets compile/export/
import exactly. Changed-source lint, formatting and whitespace checks pass.
Earlier sparse setup lacked starter-pack.recipe.json; exact restoration resolved
it. The first new host Retry test omitted the existing in-progress discard
confirmation; performing that actual UI confirmation fixed the test, with no
runtime bypass. This is finite-DOM and deterministic evidence, not a native
complete route, physical-controller test, human balance or a shipped Team mission.

Native Studio created an isolated `team-material-native` draft through the new
template, then authored5×5 slow/lethal rectangles at(24,15)/(43,15) using ordinary
geometry controls. This exposed a real accessibility/effective-rules omission:
those text surfaces read only Solo's classic terrain field. The shared preview now
returns the exact authored terrain for either adapter; Studio consumes that one
projection. All27 Studio/terrain/material regressions pass, zero skips,3.055seconds.
The old127.0.0.1development origin retained older module responses during reload;
fresh localhost8780 loaded current modules and showed both exact materials in the
summary. The same saved draft was inspected and explicitly applied there, not
silently migrated. Screenshot inspection confirms paired dashes and framed crosses
without the capture overlay. Expert export retains pack.v3/ruleset.v5/level.v3,
two foundations, both materials and its exact preset; geometry-only/placeholder-art
labels remain explicit. This is not a qualified campaign map or contrast benchmark.

The native Expert export `material-native-expert-team-test.json` (SHA256
`3afe388924ea909c9a8be14ce7fb166d30df78a6350aa6b2e7b536a2a333bfd1`)
was selected through Team's actual file chooser at localhost8780. The lobby showed
the imported arena, disabled Expert selector, both material explanations and an
explicit separate Start. Starting retained one reserve. Two deliberate second-seat
Left approaches hit the lethal bed: the first consumed the reserve on recovery,
the next left Skyline down with free rescue available; Sunflower stayed active
on its foundation and coverage stayed0%. The observed caption named unclaimed
lethal field, not an enemy collision. Both material symbols were visible over the
concealed field in active play. Resume required fresh directions; the attempt is
left paused at0:19, including inspection/idle time, with no browser errors.
No complete native clear, human timing, physical controller or artwork approval
is implied. This draft is separate from the preserved Signal greybox checkpoint.

### Purpose-built Team Signal candidate: Shared detour

`createTeamSignalCandidates()` authors an asymmetric west spine/east refuge,
135 permanent foundation cells, a135-cell slow approach and an80-cell lethal
crossing. The shared denominator is2245 cells. Both seats have distinct outer
bypasses and can neutralize material for their partner. This is explicit
TeamMissionV2, not an automatic Solo conversion or a published mission.

Eighteen full legal-input mastery routes cover three presets, joint cuts on/off,
and starting delays0/0.25/0.5seconds. Each replays identically, clears without a
knockdown, gives both seats a closure, neutralizes both material beds and leaves
source unchanged. Six additional5-second departures clear without a knockdown;
Standard/Expert retain some material and do **not** satisfy optional mastery.
Two delayed Expert blind scripts remain running below quota after a knockdown,
and the regression explicitly confirms no false clear. Enemy behavior was not
changed to rescue those routes. Fixed authored headings mean repeating random
seeds alone does not demonstrate a different encounter here.

An exploratory36-case universal-mastery assertion failed10cases: Gentle2-second
departures took a knockdown, Expert1/2-second departures did not clear, and
Standard/Expert5-second departures cleared without full terrain mastery. These
are retained evidence limits, not silently relabelled successful mastery. Reversing
all vertical directions also failed several presets; meaningful alternative-route
quality and human timing remain open. The65–145second design duration is a
hypothesis; the initial Standard scripted clear at28.36seconds is feasibility,
not pacing validation. No coverage target or actor speed was relaxed.

Studio's **Inspect Team Signal greybox** uses the existing Inspect → explicit
Apply boundary. Native localhost8780 confirmed the prior saved material draft
remained active during inspection, then Apply opened a separate
`journey-team-signal` draft. Checkpoint1 saved successfully. The board and accessible
summary show both spawns, foundations and slow/lethal areas; Solo preview stays
disabled and exact Team export remains explicit. No native complete clear or
original artwork is implied. The earlier `team-material-native` checkpoint remains
available under its original ID.

The complete five-file candidate/Studio/structure/material cohort passes49/49,
zero skips/failures,4.853seconds onNode20.19.5. Changed-source lint, formatting and
whitespace checks pass. This is not the full hosted P03 gate or human acceptance.

### Responsive action visibility

The release-owner native check found retained focus outside the viewport after
resizing More worlds and the unfinished-flight replacement dialog. Both consumers
now attach the existing measured focus-clearance helper. More worlds supplies its
sticky heading; replacement has no sticky region. Resize/focus adjusts only the
current dialog scroll, never selection, attempt state or focus ownership. Both
attachments are disposed with their owning UI. No new animation or timing lock.

This applies the visibility intent of [W3C Focus Not Obscured](https://www.w3.org/WAI/WCAG22/Understanding/focus-not-obscured-minimum.html)
and preserves the existing [modal dialog interaction](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/).
It is not a claim of complete WCAG conformance.

The three-file focus/world-browser/actual-replacement cohort passes **48/48**,
zero skips, 37.730 seconds on Node 20.19.5. Three additional optional-world
launch/choice/copy lifecycle files pass **51/51**, zero skips, 1.048 seconds.
Changed-source lint, formatting and whitespace checks pass. Initial runs had six
missing Night Shift/Living Threads fixture failures and one missing published
original fixture; exact tracked sparse restoration resolved those, without
changing assertions or runtime handling.

Native localhost8780 tab19 started and paused First Signal at 0:08, 0% coverage,
three lives and zero score. Selecting Night Shift opened the actual replacement
dialog. At 390×844 → 844×390, Stay retained focus and remained fully visible;
Tab revealed Replace without activating it. At 844×256, Stay remained focused
at y179.797–229.797 inside the dialog y16–240, with scrollTop118.5. Stay cancelled
back to the original Base game selection; no replacement was accepted.

More worlds keyboard navigation focused Download & play without activation.
At 390×844, the retained action occupied y279.688–323.688 below its sticky heading
(bottom101); at 844×256 it occupied y203.945–247.945 below the heading
(bottom108.758), with its outline visible. No download or launch occurred.
Escape returned to the existing Continue menu and the viewport override was
reset. This is native mouse/keyboard reflow evidence, not physical-device,
screen-reader, large-text or whole-library accessibility acceptance. Sparse
development artwork fallbacks were visible and are unrelated to this layout fix.

### Reproducible pacing review, not automatic balancing

`node scripts/audit-signal-pacing.mjs` emits a read-only report for all fourteen
existing Standard/immediate/seed-1 clear and mastery fixtures. It checks each
simulation identity, final checkpoint, no-loss result and input length, and pins
the input files by SHA-256. It reports closure counts, exposed ticks, sampled trail
length and the point at which all material becomes reclaimed. It neither changes
levels nor labels a material-free tail low-risk: enemies and frontier pressure
can remain meaningful. A regression verifies the report and those evidence limits.

| Candidate | Ordinary scripted clear | Mastery scripted clear | Mastery closures | Time after all material is reclaimed |
|---|---:|---:|---:|---:|
| Soft crossing | 21.35 s | 27.85 s | 5 | 8.60 s / one further closure |
| Dry spine | 20.45 s | 20.45 s | 4 | 0 s |
| Wide approach | 27.85 s | 27.85 s | 3 | Not all material reclaimed |
| Cool the crossing | 29.85 s | 29.85 s | 5 | 0 s |
| Garden refuges | 57.65 s | 47.60 s | 7 | 0 s |
| Neutral ground | 26.65 s | 31.55 s | 7 | 0 s |
| Winding channels | 63.45 s | 63.45 s | 14 | 0 s |

The next pacing review should specifically inspect Soft crossing's final closure,
Garden refuges → Neutral ground's change in tension, and the Remix's fourteen
closures. All these omniscient routes beat the authored duration hypotheses;
lengthening them automatically would add friction without evidence of fun. No
speed/quota change is justified solely by this table. Ordinary clears and optional
mastery intentionally differ; remaining material does not invalidate a clear.

### Signal palette, separately versioned

The new `signal-gardens` palette uses slate-blue field/grid and pale ceramic
surfaces, preserving the established accent/reclaimed/danger colors, craft and
enemy silhouettes, role labels and terrain markers. The frontend-design skill
informed this restrained campaign identity; it adds no decorative motion or
mandatory UI. This is not original reveal artwork or complete visual acceptance.

Studio's explicit Signal inspections now select `campaignTheme: true`, creating
project/mission `greybox-2`. Default builders retain the exact `greybox-1` Horizon
presentation for existing replay fixtures. An initial 25-test run exposed one
historical checkpoint mismatch when the original revision was replaced; preserving
the old edition and selecting the new one explicitly fixed it without rewriting
any route/checkpoint fixture. New tests compare every resolved simulation identity
and level field except the deliberate revision for all presets and supported
Solo/Versus/Team modes. Team test export remains geometry-only, not a themed
runtime promise. Shared maps are unchanged.

The four-file presentation/candidate/mastery/Team-route cohort passes27/27,
zero skips/failures,3.453seconds on Node20.19.5. Changed-source lint and formatting
pass. Native tab20 uses separate local draft `signal-palette-native`, checkpoint2;
existing saved greyboxes were not replaced. Exact Solo Practice loaded the new
theme and closed Soft crossing's first cut with0.6% earned,150points,three lives.
The caption correctly identified five neutralized slow cells. A live screenshot
shows distinct craft, field keepers, slow dashes and the reclaimed island/link.
The attempt is paused at0:13. No complete native clear, full-picture, whole-set
contrast, physical-device or human enjoyment claim follows from this observation.

The separate full-route/delay/reference/pacing cohort passes30/30, zero skips,
41.127seconds. All84 historical routes, paired-board equality,420 sampled-seed
runs,35 delayed clears and their exact pins remain unchanged.

Native Neutral ground additionally showed the paired slow dashes and framed
lethal crosses alongside both patrol domains at0% coverage. They remained visible
with Reduced effects enabled and at a390×844 viewport. The original unchecked
Reduced effects preference and default viewport were restored. At the narrow
width the individual marks are necessarily small; this observation is not
physical-device contrast or touch qualification. The separate draft remains saved;
its latest preview is paused on Neutral ground, not the earlier Soft crossing cut.

### A second Team approach

Shared detour now has a second deterministic ordinary-clear route: each partner
takes the opposite outer bypass, closes a central return, then encloses an outer
region after observing the field-keeper window. Gentle needs no extra wait in this
fixture; Standard uses8seconds and Expert6seconds after both cuts have closed.
The test asserts both craft remain on reclaimed ground throughout that wait,
both contribute closures, no knockdown occurs, the2245-cell denominator is
unchanged, and repeated outcomes/events match with joint cuts both enabled and
disabled. All six routes clear72.7394%, while leaving some material unclaimed;
none is mislabelled as optional all-material mastery. No native two-human claim.

Blindly mirroring the original route and sweeping initial delays0–5seconds found
no no-loss Standard/Expert clear. Merely widening its horizontal approach also
failed. Inspecting the actual failure identified the keepers crossing the second
exposed cuts; waiting after a completed closure resolves that sampled window.
Removing that wait still produces a knockdown on Standard/Expert. No speed,
quota, collision or map parameter was relaxed. The long wait is a human pacing
review item, not a recommendation that every player should follow this script;
the original no-wait route remains available.

### Broad hosted gate: observer-fixture correction

Run35507637304 targets cb7a14b58e9f3b4a19fc64e3cd045f04df6632e1,
not later commits; freeze is disabled. Shard4 job106070262224 failed one of1686
tests: the actual Versus board-disposal test selected the last-created resize
observer, which now belongs to the optional-worlds focus heading. Original log
response703118bytes/SHA-256
`cc4d795840bd8105f76b15ac7a114b597108bc81fd7688754450c9e81a2de95b` was
read and hashed; its complete bytes remain on GitHub, not retained locally.
The run remains failed evidence regardless of later focused success.

Its final result is FAILURE:7263tests,7262pass,1fail,0cancel/skip. Shards1/2/3
pass1738/1871/1968 respectively; shard4 passes1685 with the single observer
fixture failure. Freeze was skipped. New runtime-source run35509283083 pins
48e20aae52dfac2beb008f515387cc9df9f20be6, freeze disabled; it started after the
older run completed and is not yet accepted. Subsequent audit/fixture commits
are not included in that exact-source gate.

The test now identifies exactly one live observer by ownership of both board
arenas before pagehide clears targets, checks a different replacement after
pageshow, and retains its stale-callback, unchanged-attempt and zero-frame checks.
It additionally requires terminal departure to disconnect every observer,
including modal focus ownership. The world-browser test also queues focus reflow
while hidden, verifies no scroll/focus/action change, then verifies foreground
resize behavior. Existing runtime disposal/hidden guards are correct; no runtime
change was made to satisfy the test.

All four complete affected files pass38/38, zero skips/failures,8.990seconds on
Node20.19.5; lint/format pass. The first local full-file run had two separate wide
fixture failures from omitted sparse `fpv-arcade-r5.json`; restoring the exact
11,708,176-byte tracked blob37108db6fc98f1c4e3eeed4381b1b5d19e24ef16 resolved
those without assertion changes. Release owner notified for independent review.

### Planned-library capacity, not added playable content

The former256-mission/32-campaign/32-pack project limits could not hold the
approved242 Solo candidates plus12 Remixes and12 separate Team missions in one
project. Bounded item capacities now allow384 missions and64 campaigns/packs.
Compiler and draft storage share the unchanged4MiB/100000-node/depth20/512-array
JSON envelope; map/asset limits remain512. This is not an unbounded import or a
minimum shipped count.

A synthetic266-mission/36-campaign/36-pack registry compiles with254 Solo/Versus
entries and12 explicitly authored Team entries. It exercises the last campaign
in all presets, copy-on-write shared maps, undo/redo/export, immutable checkpoint1
and latest-checkpoint recovery, source immutability and refusal above each item
limit. Repeated synthetic templates are test data only and never enter the game
library. The three complete compiler/draft/capacity files pass11/11, zero skips,
4.359seconds on Node20.19.5; lint/format pass. The capacity test itself takes4.230s,
including compilation and storage/history operations. This is not a browser
interaction-latency guarantee; large-library responsiveness still needs measurement.

### Compile once across execution presets

`createContentExecutionCatalog` previously compiled/validated the same source
three times through its three preset projections. It now compiles once and passes
the compiler-owned frozen registry to the shared resolver. `compileContentProject`
recognizes only objects minted by its private WeakSet; copied/serialized/imported
lookalikes still fail ordinary source validation. No global source cache, stored
authorization, simulation tuning or skipped preset validation was added.

A separate five-run Node20.19.5 measurement times only execution-catalog creation
for the actual17-mission Horizon+Border source, asserting17 navigation entries.
Before:840.411/728.044/750.543/715.220/714.555ms (median728.044).
After:402.879/336.172/329.233/319.831/314.786ms (median329.233).
These local observations are not CI thresholds or warm browser Next-to-control
acceptance. They do not measure asset decoding, rendering or controller readiness.

The release owner independently measured the exact e9140599 synthetic capacity
source (266missions, only2maps,290802JSONbytes) on Node20.19.5/darwinarm64:
compilation alone3072.216/2775.567/2660.154ms;18 subsequent resolutions total
27.551/24.536/23.315ms. Larger-project cold compilation remains a responsiveness
concern even after duplicate preset compilation is removed. Full unique-map/media
capacity and browser responsiveness are not established by these fixtures.

The five complete project/execution/route/music-context/attempt files pass24/24,
zero skips/failures,7.045seconds. Tests compare all preset executions from raw and
owned source in Solo, Versus and explicit Team, reject forged/copied registries,
preserve caller-source immutability, and verify sixty existing replay routes and
preparation cancellation/authority boundaries. One initial local ENOENT was the
sparse first-return original; exact2,366,738-byte tracked blob
94d94509e0bd3fca988e15fc000bc53af091a543 was restored without changing any media
assertion. Changed-source lint/format/whitespace checks pass.

### Cross-preset optional-goal coverage

The read-only `scripts/audit-signal-mastery.mjs` checks the existing mastery,
clear and delayed route inputs against each mission's stated optional goal across
three presets and both steering policies. It authenticates the three input files
by SHA-256, retains failed/no-clear/ordinary-clear-only counts, and emits the exact
successful input prefix ending at the first terminal tick. All authored bonuses
remain present. It changes no geometry, actor, quota, fixture or player award.

The finite search establishes25 of42 combinations, including the original seven
Standard/immediate routes. The other17 remain unproven by these inputs, not
impossible. Soft crossing and Neutral ground need additional routes outside the
original Standard/immediate setting; Garden refuges needs Grid + Buffer routes;
Cool the crossing needs Expert routes; the Remix needs Gentle/Standard Grid +
Buffer routes. Ordinary-clear feasibility does not satisfy these optional goals.

The complete original-mastery/pacing/new-audit cohort passes3/3, zero skips,
13.532seconds on Node20.19.5. Every emitted successful prefix is independently
replayed from fresh state with no lost lives, exact simulation/checkpoint identity,
and exported replay verification. Original seven mastery checkpoints stay exact.
These are omniscient sampled-route predicates, not automatic awards, arbitrary
timing tolerance, native-controller evidence or human enjoyment validation.

Seventeen supplemental routes in `signal-mastery-extension-routes.json` then
close those sampled gaps. The combined read-only audit now establishes42/42
mission/preset/steering combinations. Each emitted route is freshly replayed,
checked for no lost lives, and export-verified; the17 new exact fixture routes
also undergo the independent original mastery predicates. The original seven
Standard/immediate checkpoints and all ordinary-clear inputs remain unchanged.

Exploratory searches that only rewarded material neutralization produced Garden
refuges clears without linking both refuges; the strict fixture test rejected
them. The development search was corrected to require the actual connection
goal, not by weakening the predicate. Its successful replacements take the
opposite early approach toward the far refuge. Several Gentle Neutral ground
searches stalled just below quota with material remaining; sampled one-second
initial observation and a downward departure supplied legal no-loss mastery
routes for both steering settings. These are chosen routes, not mandatory waits.
The Remix routes connect all three foundations without collecting their bonus;
they need not neutralize every material cell, which is not their stated goal.

The full three-file mastery/pacing/audit cohort passes3/3 in16.426seconds with
zero skips/failures on Node20.19.5. This broader feasibility still does not prove
reaction tolerance, meaningful human choice, pacing, mastery awards or enjoyment.
No runtime, geometry, enemy, speed, coverage or difficulty value was changed.

### Shared advisory campaign pacing inspection

`inspectContentPacing` uses the existing compiler and gameplay Journey projection,
including pack/campaign order, archive state and explicit Solo/Versus/Team filtering.
Repeated memberships remain identified occurrences, not silently deduplicated.
It reports authored challenge-band regressions/jumps, facet increases of three or
more, and countdown frequency at or above15% of the selected sequence. Optional
campaigns are excluded only by explicit IDs, never guessed from their names.
Warnings are review prompts: they neither reject a deliberate respite nor retune
any level, grant an award or qualify a release. Gentle countdowns remain non-failing.

Studio now has an optional Review campaign progression panel. Inspection is
explicit and read-only, avoiding a new whole-project compile on every keystroke.
Draft/selection changes clear stale reports; unsupported modes leave an honest
empty result. The frontend-design skill kept the existing restrained workbench
identity and a collapsed ordered-ratings view; no new player navigation or effects.
CLI uses exactly the same inspector:

```sh
node scripts/compile-content-project.mjs project.json --pacing --mode solo --exclude-campaigns signal-remixes
```

The four complete pacing/inspector/Studio/empty-project files pass13/13, zero
skips/failures,3.910seconds on Node20.19.5; changed-source lint/format pass.
Tests cover CLI/UI/direct parity, source immutability, mode/archive/reorder behavior,
strictly-below15% countdown guidance, advisory band changes and stale/error cleanup.
An initial assertion expected a different rejection-message spelling; it was
corrected to the existing exact `not supported` contract, with no runtime change.

Native tab21 uses separate saved `pacing-native-signal`, checkpoint1. It showed
seven missions, then six after explicitly excluding Signal Remix; switching to
Team cleared all rows and explained the missing qualified missions. Returning to
Solo and reinspection restored the correct six. Saved draft recovery after reload
was verified. At390×844, mode/exclusion controls, inspection button and summary
fit visibly with a readable focused button. No console errors observed. The
viewport is restored after inspection. Existing saved drafts and paused attempts
were not reloaded or replaced. Large-library browser latency, assistive technology
and physical touch/controller qualification remain open.

A wider Journey/execution/structure/tuning run initially passed24/25: the old
container-duplication test expected overflow at256 missions, below the newly
shared384-mission capacity. It now fills the exact shared limit, verifies that
full project compiles, then requires the precise mission-budget rejection and
unchanged source when duplication would exceed it. No runtime budget was raised
again. The complete five-file cohort including capacity now passes27/27, zero
skips/failures,10.893seconds. Run35509283083 predates this test-only correction;
retain any resulting original failure and requalify the corrected final source.

Meaningful alternative-route quality, anti-cleanup/
pacing review; broader delayed decisions; whole-Journey host continuation; purpose-built
Team terrain qualification; original campaign art/actors/music and reactive
presentation; real-image assisted-trace qualification if exposed; native/device/accessibility and
human comprehension/enjoyment; reviewed final-source PR, immutable release,
Pages acceptance and rollback. No phase is complete merely because greyboxes pass.

Local checkout is deliberately sparse to preserve a256MiB source reserve; media/
full builds need512MiB. Changed-source lint/format checks are scoped. Full hosted
qualification must run against a complete exact-source checkout; do not describe
local greybox tests as a full release gate.
