# Journey P02 — Border Bloom greybox preparation

20 September 2026. Provisional **0.70.0**, now integrated with candidate P01
`3556e257` via merge `fe137d77` (original preparation began at `e7aa131f`).
This is an independent draft preparation slice, not an accepted baseline, phase
completion, released campaign or permission to bypass P01 integration and gates.

Seven original candidates exercise two three-mission learning arcs and one
optional Remix. The outer-timing arc introduces fixed-perimeter patrols; the
changing-returns arc introduces moving-frontier patrols. Field keepers and
foundations are already established. The Remix introduces no mandatory rule.
All four existing contact bonuses appear as optional detours, not objectives.
No countdown or arbitrary per-level movement/enemy-speed override is authored.

| Candidate | Intended route decision |
|---|---|
| Behind the patrol | Depart before a perimeter pass or return behind it, using an interior landing. |
| Second landing | Wait on a long landing or bridge to the far, shorter one; optional life detour. |
| Long rail | Direct central return or optional acceleration along a broad straight rail. |
| New frontier | Close ahead of an island patrol or reshape its approach on the opposite edge. |
| Turn the corner | Practice frontier shaping from the short or long arm before adding the outer patrol. |
| Return pocket | Close the mouth first or reach outward around a changing contour; optional freeze detour. |
| Living border | Link the nearby spine or approach the far island before its frontier patrol arrives. |

These are hypotheses, not proven distinct enjoyable decisions. Compare Second
landing against Horizon's platform missions and Return pocket against Courtyard
return before retaining them. Cut or redesign if patrol timing does not materially
change the choice; geometry and a higher quota alone are insufficient.

## Implemented and checked

- Shared compiler/catalogs, 72×36 authored maps, two retaining keepers per mission,
  two or three established enemy roles, band 2→3 without a campaign band reset.
- Studio adds Inspect Border Bloom candidates through the existing explicit
  Inspect → Apply workflow. It does not replace the active draft merely on inspection.
- Three focused tests pass: learning arcs/catalog topology, all **42** combinations
  of seven missions × three presets × two control policies reaching a legal first
  closure without losing a life or collecting a bonus, and identical Standard
  first closures when every optional bonus is removed. Changed-file lint passes.
- Every starting field component has a retaining keeper; diagnostics report no
  known topology errors. These static checks do not prove full-clear feasibility.
- Initial compilation correctly rejected Return pocket's frontier patrol as too
  close to spawn. Its start moved farther along the same valid edge. The optional
  freeze pickup also moved off the direct opening route before the 42-case check.
- Native Studio: inspecting Border Bloom left the owned Tuning fixture active.
  Explicit Apply opened all seven candidates as their own project. New frontier
  in Expert showed two lives, 10 cells/s, 96 non-scoring foundation cells and the
  resolved contour patrol. The actual game host loaded Practice; Start → Down
  closed on the island, showing 0.5% earned coverage and two lives when paused.
  Close preview returned to the intact Expert draft, saved as checkpoint 1. This
  is one native opening check, not a full clear or visual/human acceptance.
- Expanded content/foundation/Horizon/Border cohort: **103/103 passed**, no
  failures/skips/cancellations/todos. Full lint and formatting pass. Source
  validation reports version 0.70.0, 699 files and the four existing navigation
  warnings. Local tests include pending P01 artwork; final committed-source CI is
  a separate gate. The preceding P01 `e7aa131f` CI run 35485582972 passed, but does
  not qualify this P02 source.

## Still required

Meaningful alternative routes, mastery feasibility,
capture/contour transitions, real timing/comprehension/enjoyment, final art acceptance
and campaign presentation, broader Journey lifecycle/device acceptance, Team qualification,
full image-workflow device qualification, final exact-source qualification, reviewed phase
PR, immutable release, Pages/native public acceptance and rollback proof.

Border presentation now has seven original raster candidates and its own botanical
palette, retaining the shared functional actor silhouettes. These are not final
human-accepted artwork or newly qualified character/audio designs.
The optional Remix remains in a separate candidate pack. No official progress,
copied reference artwork or screenshot-inferred actor behavior is introduced.
Human validation is pending. P01's committed original Horizon artwork is
inherited through the candidate integration.

The manual image-reference / crop / queued-geometry / inspect / exact Practice /
explicit Apply implementation is tracked separately in
`xposed-journey-studio-images.md`. It does not automatically trace pixels, embed
reference pictures into runtime assets or publish candidate maps. The durable
tracing follow-up adds separate local autosave/recovery and portable backups,
with exact map binding and explicit restoration before fresh Inspect/Apply.

## Complete-route feasibility continuation

`game/test/fixtures/border-clear-routes.json` pins **84 complete Solo routes**:
seven candidates × three presets × two steering policies × authored bonuses /
every bonus removed. Each begins from a fresh seed-1 run, uses only legal input,
loses no lives, reaches the coverage goal and matches an authoritative checkpoint.
All exported replays verify. Repeating all 84 routes on both paired boards produces
equal, isolated state and simultaneous-clear draws. The route cohort passes
**28/28 tests**, including the existing candidate/opening checks.
The expanded content/foundation/Horizon/Border cohort passes **135/135**, with
zero failures, skips, cancellations or todos. Full lint, format, whitespace and
source validation pass; version 0.70.0 still reports the same four navigation
warnings. These local checks include preserved pending P01 art. Hosted
qualification 35488065655 checks preceding image-workflow commit `773511d9`, not
this later route/teaching correction; a successor exact-source gate is required.

The exploratory solver uses omniscient branch selection; it is not a player model,
human pacing evidence, multi-seed robustness, native full-playthrough or Team
qualification. Selected inputs are replayed from scratch without manipulating
the run. No optional bonus is necessary for completion in these fixtures.

Review found the frontier arc combined patrol domains after only one exposure.
Greybox revision 2 removes the outer patrol from Turn the corner, giving an
introduction and focused practice before Return pocket combines both domains.
Lesson/practice metadata and a regression assertion enforce that sequence. All
twelve affected route variants were searched again and all 84 fixtures were
replayed against the revised project before pinning.

The solver's active-play time ranges are deliberately recorded as a pacing risk,
not the authored human-duration estimate:

| Candidate | Omniscient route seconds, all twelve variants |
|---|---|
| Behind the patrol | 19.3–25.4 |
| Second landing | 14.9–15.7 |
| Long rail | 13.2–20.4 |
| New frontier | 20.1–33.0 |
| Turn the corner | 21.1–28.8 |
| Return pocket | 20.8–29.4 |
| Living border | 29.1–52.3 |

Most are below the ordinary 45–150 second human target. Human route planning and
failure/retry time are absent here; do not inflate quotas or add waiting solely
to reach that target. Prioritize Second landing and Long rail for comparison,
redesign or removal if their decisions prove trivial during playtesting.

## Integrated Team presentation correction

Independent native review of candidate P01 identified that an imported Team
attempt still announced "Start remains a separate action" after Start and Pause.
P02 retires that lobby-only copy when the exact picture is accepted for an attempt,
without changing picture identity, preparation, controls or simulation. All three
pinned presets assert the pre-Start and paused status boundaries. The combined
Team-import/automatic-retry/Next/picture/recovery-copy host cohort passes 57/57
(35.1 seconds). This is modeled-host regression evidence; native recheck and full
hosted qualification remain separate gates.

## Original Border artwork continuation

Seven original 1774×887 PNG compositions are stored unchanged in
`game/content-design/assets/border-r1/`. `PROMPTS.md` records every generation
prompt and original output filename. The immutable candidate registry pins each
file's SHA-256, byte length, dimensions and description; every mission has exactly
one distinct composition. No supplied Xposed screenshot or third-party artwork
was an image-generation input. Candidate status remains explicit in diagnostics.

The originals total **19,420,210 bytes**. Shared optional-artwork packaging now
contains Horizon plus Border: **17 originals / 45,282,783 bytes**. Full distributions
retain original bytes; these images are excluded only from mandatory core offline
preparation. The existing core-size guard is unchanged. Local registry and tiny
build-fixture checks do not replace complete hosted distribution qualification.

All 84 complete Border routes retain exact physics identities and checkpoints
with the images attached. The combined artwork, candidates, Studio, image-authoring,
tracing-recovery and optional-packaging cohort passes **50/50** (7.7 seconds), with
full lint, formatting and whitespace checks passing. Native Standard Practice for Behind the patrol loaded
the botanical theme and exact original; Down to the island followed by Left to
the perimeter produced **12.2% / 2,850 points / three lives**. The paused screenshot
showed the image through the earned left region, starting island and border, with
visible craft brackets and separate field/perimeter enemies. The preview was then
closed back to the preserved Studio draft. The elapsed clock included idle review
time and is not a pacing measurement. This is one partial native reveal, not a
full clear, whole-set contrast/accessibility acceptance or human enjoyment evidence.

## Shared cross-pack Journey continuation

The explicit `game/?journey=authored` and `game/couch/?journey=authored` test routes
compose Prologue, Horizon School and Border Bloom through the same compiler and
navigation policy: **15 core missions**, then **two optional Remixes** in one flat
17-card chooser. The real Solo and paired-board Versus hosts use this sequence;
neither forces a Remix after a campaign. Studio links identify the bundled test
routes separately from unpublished draft previews.

Existing `?journey=opening` content/order and its suspended-flight key stay intact.
The combined route has a separate suspended-flight slot, but stable mission IDs
and version-independent completion receipts are shared. Tests verify unchanged
execution identities and manifests for every prior mission, mode and preset.
No Legacy collection award or edited/imported-content authority is added.

The route/real-host regression cohort passes **24/24** (125.6 seconds), including
**15 consecutive complete missions in each actual host implementation**, a deliberate
Next after each clear, exact Solo route checkpoints, equal separate Versus boards,
durable mode-separated receipts and voluntary final chooser/Rematch. Existing
nine-mission opening flows also pass. An additional focused failure test passes:
refusing the first Border picture retains the exact paused Horizon flight and
picture, retry succeeds, Skip records no clear, and the chooser returns to Horizon.
Full lint, formatting and whitespace checks pass. These tests use a modeled DOM,
real engine/host and deterministic inputs; they are not native timing or human evidence.

Native browser checks in both modes showed 17 cards/five campaign filters, selected
Long way home, confirmed the explicit Skip to Behind the patrol, and entered the
Border board(s) directly without menus. Both modes retained three lives; both
Versus boards started at zero coverage/score. Flights were paused afterward and
both browser error logs were empty. Native Next-after-clear, full consecutive
playthrough, physical controllers, phone layout and target timing remain separate
acceptance work. Inter-mode departure still uses the existing guarded boundary;
no automatic Solo-flight-to-Team conversion is implied.

## Whole-library duplication and native presentation follow-up

Studio now duplicates missions, campaigns and whole packs. A copied container gets
independent child IDs, preserving child order and shared membership only inside
the copied subtree. Maps and assets stay immutable shared pins; later geometry
edits use the existing copy-on-write path. Archived descendants remain archived,
while the explicitly duplicated root becomes active. Generated IDs are bounded
and deterministic; collisions and content-budget overflow reject the whole edit.
Undo/redo and existing checkpoints retain both versions. Duplicate mission names
are disambiguated with stable IDs in the Studio selector.

The structure/Studio/image-authoring/tracing cohort passes **44/44** (7.2 seconds),
including independent child edits, internal shared membership, byte-pin preservation,
archive semantics, atomic collision/budget rejection and undo/redo. Full lint,
formatting and whitespace checks pass. Native Studio duplicated Border's six-core
pack: **2 packs / 2 campaigns / 7 missions → 3 / 3 / 13**. Adding a 3×3 foundation
to its copied first mission changed **35→44** cells while the original stayed at
35. Undo twice returned to 2/2/7; Redo restored 3/3/13. Checkpoint 5 survived reload,
with original/copy stable IDs visibly distinguished. No published source changed.

Native original-picture inspection now covers all seven Border boards, through
normal keyboard input and the real host, with no simulated state mutation:

| Mission | Observed earned territory / points / remaining lives |
|---|---|
| Behind the patrol | 12.2% / 2,850 / 3 after Down then Left |
| Second landing | 0.5% / 110 / 3 after Down |
| Long rail | 0.4% / 90 / 3 after Down |
| New frontier | 1.1% / 260 / 3 after two separate Down returns |
| Turn the corner | 0.8% / 170 / 3 after Left |
| Return pocket | 0% / 0 / 2: delayed Right attempt was caught; failure caption shown |
| Living border | 0.4% / 90 / 3 after Up |

Each original rendered through its foundations and border; successful cuts added
earned reveal. Return pocket's observation is a failed route, not a successful
opening check. Field diamonds, fixed-perimeter vehicles, cyan contour vehicles,
craft brackets and framed contact bonuses remained distinguishable in these
1280×720 observations. New frontier visibly moved its contour patrol onto a newly
connected return. No browser console errors were reported during this route check.
The final Remix was left paused. Review delays changed enemy timing; these are not
benchmarks, multi-seed/human playtests, exhaustive contrast or whole-level validation.

## Sampled timing feasibility and native continuation

The expanded route/art cohort passes **29/29** (24.1 seconds). All 84 original
routes also clear without life loss at each explicit seed 0, 1, 42, 2026 and
4294967295: **420 runs** across presets, steering policies and authored/no bonuses.
This samples deterministic seed handling; it does not establish all-seed robustness
or randomized authored enemy headings.

`game/test/fixtures/border-timing-routes.json` adds **35 exact complete routes**:
every Border mission after 0.25, 0.5, 1, 2 and 5 seconds of idle time. These use
Standard, immediate steering, seed 1 and authored bonuses. Every input is replayed
from a fresh run, including the initial wait, without life loss; final authoritative
checkpoints and exported replays match. The search replans after each delay using
omniscient branch selection. A fixed script can fail after a delay because enemies
move; these alternative routes demonstrate sampled feasibility, not human-readable
timing windows, universal spawn safety or mastery completion. No physics or enemy
speed was changed to obtain this result.

Native Solo on the combined route completed First return with normal Down input:
34.3% earned coverage, 8,160 points, three lives. One deliberate Next opened Choose
your share directly at zero coverage with three lives and canvas focus. A fresh
Down started its live trail and subsequently closed for 34.3% / 8,160 / three lives.
The flight was paused. One local browser observation measured **548 ms** from
immediately before the Next click through the running accessibility-tree response;
that includes automation/observation overhead. It is not a physical input latency
measurement, a Next-button appearance measurement, or whole-device performance
acceptance. Idle review time in the displayed mission clocks is not pacing evidence.

## Catalog-based actor authoring

Studio's map workbench now adds, replaces and removes individual enemies without
JSON editing. Controls expose registered roles, explicit headings/patrol direction,
frontier edge placement and catalog speed tiers with the selected preset's resolved
cells/second. Domain, damage target, region-retention behavior and counterplay stay
visible. Team offers field keepers only, preserving its current qualification boundary.
Unknown roles, custom speeds, duplicate/mismatched IDs and invalid movement-domain
placements fail through the shared compiler before any draft mutation. Every
supported mode/preset compiles; maps, asset pins, policy and published editions remain
unchanged. Existing Undo and immutable checkpoints own recovery. Removal requires
two activations, and editing or switching context cancels the armed action.

The actor/tuning/Studio/structure/image cohort passes **39/39** (4.0 seconds).
Native checks added a keeper at (40.5,6.5) only to the copied Behind the patrol
mission, rejected an attempted move into its foundation at (18.5,18.5), showed
Gentle's measured tier at 2.04 cells/second, applied a Left heading and used Undo
to restore Down-right. Reload of checkpoint 8 retained the added keeper and its
restored direction; the original mission still had its original three enemies.
The final two-column panel was visually inspected in the wider map workbench at
1280×720. Console errors were absent during the interaction check. Native removal,
phone/controller navigation and physical-device acceptance are not claimed;
confirmed removal and cancellation have modeled-controller coverage.

The frontend-design skill guided reuse of the existing field-kit typography,
colors and explicit controls, and relocation out of the cramped sidebar. This is
candidate authoring, not approval of newly edited levels or a publication action.

## Existing-map reshaping

The map workbench can now replace or remove individual authored foundation, wall
and terrain rectangles without editing JSON. Terrain replacement keeps its stable
ID and can change slow/lethal material. The permanent outer border is not an
editable rectangle. Every command binds to the exact current map identity before
resolving its index, forks only the selected mission and compiles all supported
modes/presets. Invalidated spawns, enemy-domain conflicts, stale pins and malformed
rectangles leave the draft unchanged. Removal needs two activations; edits/context
changes cancel confirmation. Undo, Redo and checkpoints preserve recovery.

The expanded authoring cohort passes **45/45** (4.2 seconds), including map sharing,
terrain-ID preservation, Team spawn protection, stale source rejection, two-action
removal and empty projects. Actor controls also reject stale project or same-revision
source replacements before adoption. Full lint passes.

Native current-source check resized only the copied Behind the patrol foundation
from 7×5 to 9×5, changing 35→45 non-scoring foundation cells. Moving it over the east
keeper was rejected with a movement-domain explanation. The original mission
remained at35 cells. Undo restored the copy to35; Redo restored45. Checkpoint11 and
reload retained the 9×5 copy and its separate added keeper. No browser console
errors were reported. Native removal and a full device matrix are not claimed;
they remain separate from the automated deletion/confirmation checks.

## Optional bonus authoring and visible placement

Studio now adds, replaces and removes the four existing contact pickup types with
stable IDs and explicit cell-centre positions. Effect strengths, expiry and life
caps remain engine-owned; the editor exposes no overrides or random drops. Each
candidate compiles across all supported modes and presets. Team controls remain
disabled until those effects have their own qualification. Duplicate/blocked
positions, identity conflicts, unsupported effects and stale source contexts fail
without changing the draft. Two-action removal and Undo/checkpoints are retained.

The map painter previously omitted pickups; it now draws distinct framed + / > /
v / * glyphs for life / speed / slow / freeze, even when capture overlays are hidden.
The legend and geometry text identify effects and positions without relying on
color. These are placement markers, not a guarantee of contact collection or route
quality. The UI reminds authors not to force speed before precision turns and to
keep required completion independent of bonuses.

The final authoring/overlay/Team cohort passes, with full lint and changed-file
format checks. Focused bonus/overlay/Team checks pass16/16, including all four
effects across Solo/Versus and three presets, malformed/duplicate positions,
stale adoption, confirmation cancellation and the unchanged Team boundary.

Native Studio added `native-detour` extra life at(22.5,17.5) on the copied landing,
replaced its effect with freeze, and used Undo to restore extra life. The actual
map showed its framed + marker, and its text listed the exact position. Checkpoint14
retained the bonus. Exact Practice loaded the edited map and normal Down closed
onto the enlarged landing for0.6% /150points /three lives; the flight was paused and
closed back to the intact draft. This was not a native pickup collection, full
clear or human validation. No gameplay policy/compiler changes are included here;
the release owner separately owns the new Journey action-policy correction.

Campaign management also exposes an explicit Change campaign band command. It
does not retune missions or move memberships: the existing compiler rejects any
member outside the new band/window. Valid edits preserve mission/map identities
and remain undoable. The structure cohort passes12/12; full lint/format checks pass.
Native Studio rejected Border Bloom band1 (existing band3 members), accepted the
optional Remix campaign's compatible3→2 band change, and Undo restored3 with no
console errors. These were local draft operations, not curriculum changes or
release approval.

## Accepted-baseline composition and explicit Arcade policy

Integrated release-owner source `f009474a2f9769b8d5e04fb53eb7dd501d7039e9`
(PR184, parents accepted `aadd855e` and P01 `3556e257`) into the P02 candidate.
The two conflicts preserve the combined Horizon/Border route label, installed
chapter channel authority, current Team threat help, and separate Start guard.
The shared compiler now defaults new candidates to registered `journey-arcade-v2`:
contact bonuses remain available; manual ability, pickup and boost are disabled
by the simulation and reflected in host controls. Imported `journey-v1` projects
retain their old rules. This is an explicit identity change, not replay reinterpretation.

Preserved the original 84 clear-route and 35 delayed-route fixtures under
`legacy-border-*.json`. `scripts/qualify-border-arcade-routes.mjs` verifies every
old simulation identity and checkpoint, executes identical legal inputs under both
policies with no life loss, verifies both exported replay generations, and compares
every authoritative section. The full classic projection must also be identical
after removing only the new `definition.arcadeActions` field. All119 passed before
the script renewed any candidate identity/checkpoint. A regression test repeats
this comparison without rewriting fixtures. Routes, difficulty and enemy speeds
were not changed to make the comparison pass.

The integrated Border routes/timing/art/candidates and legacy-policy suite passes
34/34. The actual Solo/Versus/Team host, policy, authoring and Team discovery cohort
passes; full source lint and changed-source formatting pass. These remain scoped
local checks; full exact-source hosted qualification is still required.

Native paired-board Behind the patrol now identifies itself as Arcade, starts two
equal0% /three-life boards with movement-only control prompts, and pauses both
boards without console errors. This is not a complete native clear. It also exposes
a remaining plan gap: the paired-board host still imposes its historical90-second
race limit. Untimed authored races require explicit protocol/export compatibility
work, not merely hiding the clock. Keep that acceptance item open.

Native Continue on a pre-policy authored save correctly rejects the unavailable
edition but initially gave misleading install-pack advice. Candidate-specific
guidance now explains the original test edition requirement and recommends saved
attempt export before choosing another mission. A real-host regression constructs
an actual v1 replay/save and verifies the exact bytes remain unchanged, Continue
remains usable, and no installed-pack advice is shown. It passes1/1. The initial
test lacked the candidate image boundary; adding the same modeled image/load
boundary as other host tests fixed the harness, not production behavior. Native
retest shows the corrected message. Old attempts are never silently migrated.

Earlier checkpoint `9e376a1c6b30aaa4772d963776ae9b443d848d51` completed hosted
qualification/freeze run35499363901 successfully: artifact10602770700,
1,645,636,814bytes, digest
`sha256:dabf9886bb4dcc0087edd1111ce0152cf5e2d6f2b118819939b5e773110b9e25`.
This does not qualify the later Studio additions or this integrated source and is
not a Pages deployment. P02, human acceptance and whole-plan completion remain open.
