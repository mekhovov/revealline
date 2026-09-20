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
