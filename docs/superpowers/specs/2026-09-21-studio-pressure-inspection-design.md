# Studio pressure-edition inspection

Scope: expose the existing copy-on-write pressure projection to administrators
without new physics, schemas, defaults, publication, enrollment or live-run changes.
The user has approved the shared difficulty/admin framework and automatic progress;
no routine confirmation pause is needed. Existing source inspection remains explicit.

## Choice and behavior

Recommended: an **Inspect pressure-v2 copy of current draft** action beside Studio's
other Inspect actions. Reuse `withPressureDifficulty(session.current())`; put its
serialized validated result into Project JSON, mark source changed and invoke
the existing inspection. The current project/maps/selected mission stay active
until **Apply inspected source**. Existing Undo/checkpoint/export mechanisms then
cover adoption. Map/asset references and player handling remain unchanged; mission,
campaign, pack and project revisions follow the existing deterministic projector.

Alternatives considered: a directly applying catalogue dropdown is shorter but
adds a second adoption path and makes whole-project identity changes less explicit;
JSON/CLI-only retains current behavior but is unnecessarily difficult for admins.
No independent per-level physics sliders or duplicate runtime are introduced.

The label and adjacent note must say this affects all missions in the current
draft, not only the selected mission, and does not publish. Unapplied Project JSON
edits use the existing discard guard; do not silently use or overwrite unvalidated
source. When the active draft already pins pressure-v2, disable the action; loading
or undoing to an earlier catalogue re-enables it. Old editions are not deleted.

Use the existing guarded error path: failed projection/validation must leave the
active draft untouched and never enable Apply for a failed candidate. Existing
inspection invalidation remains authoritative. Running previews keep their frozen
source; merely inspecting must not launch or replace a flight.

## Verification and handoff

- Existing projection tests prove immutable sources, identity revisions,
  all-mode/preset compilation, player/warning invariants and old v1 preservation.
- Focused Studio wiring checks cover the explicit label, all-mission scope,
  discard guard, compiler-backed inspection, no immediate replace/launch,
  and the already-v2 disabled state.
- Native exact-source: inspect a pictured Crosswind chapter, Apply it, inspect
  pressure-v2 while the active rules still show v1, then Apply; verify exact
  current preview rules, preset-resolved actor tiers, retained picture/geometry.
  Undo returns the older edition and enables the action. Repeat Apply and launch
  a stronger-pressure preview without claiming human/full-clear acceptance.
- Node20/22 focused tests, lint/format, a scoped commit and release-owner handoff.
  No version/publisher/frozen-tree changes in this lane.

Implementation sequence: reviewed spec; import/action/label/disabled state;
regression tests; exact-source native verification; evidence and handoff.
