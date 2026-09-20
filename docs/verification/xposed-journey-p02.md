# Journey P02 — Border Bloom greybox preparation

20 September 2026. Provisional **0.70.0**, stacked on P01 `e7aa131f`.
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
| Turn the corner | Extend the short foundation arm or reach around the long one; two patrol domains respond differently. |
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

Full legal clear routes and replay verification for every preset/control/mode,
bonus-free completion, meaningful alternative routes, mastery feasibility,
capture/contour transitions, real timing/comprehension/enjoyment, original art and
campaign presentation, actual Journey entry/continuation, Team qualification,
remaining Studio image workflow, final exact-source qualification, reviewed phase
PR, immutable release, Pages/native public acceptance and rollback proof.

Greybox presentation uses the existing preview theme, not final Border artwork.
The optional Remix remains in a separate candidate pack. No official progress,
copied reference artwork or screenshot-inferred actor behavior is introduced.
Human validation is pending. P01's pending original artwork remains uncommitted
and is not part of this phase's committed source.
