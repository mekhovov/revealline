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
and campaign presentation, actual Journey entry/continuation, Team qualification,
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
