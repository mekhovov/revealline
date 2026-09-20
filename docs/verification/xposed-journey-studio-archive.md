# Studio archive and restore

20 September 2026. Candidate-only follow-up to guarded removal, preparing part of
P02 without claiming either P01 or P02 complete or published.

Mission, campaign and pack designs accept an optional boolean archive flag. The
shared compiler still validates every archived definition and dependency. Archive
and Restore renew only that item's candidate revision and the project revision;
maps, assets, children and membership arrays remain intact. Duplicating an archived
mission deliberately creates an active copy with its original immutable map pin.

The shared candidate Journey resolver omits archived packs, campaigns and missions
for Solo/Versus and Gentle/Standard/Expert. Archiving one pack does not archive a
shared campaign used by another pack. Explicitly selecting an all-archived pack
reports no available missions; it never silently selects unrelated content.

Studio keeps archived items visible and editable, with an Archived label. Explicit
single-mission authoring previews remain available; these are Practice, not released
Journey selection or official awards. Archive does not bypass dependency-aware
deletion. No published runtime, historical replay or player save is reinterpreted.

## Evidence

- Focused archive/execution/Journey/structure/removal cohort: **18/18 passed**,
  zero failures/skips/cancellations/todos. Checks cover every preset/mode, shared
  pack membership, unchanged simulation identity, invalid archive flags, validation
  of archived content, active duplication, exact Undo/Redo and JSON round-trip.
- Expanded content/foundation/Horizon cohort: **100/100 passed**, zero failures,
  skips, cancellations or todos. Full formatting and changed-file lint passed.
  These local tests include pending artwork; hosted exact-source qualification
  remains separate.
- Native owned `studio-empty-check` fixture: archive `tuning-fixture`, save
  checkpoint 10, reload and observe Archived; restore, Undo back to Archived, Redo
  to active, save checkpoint 11, and reload the active mission. Parent `membership-check` and its mission
  membership remain in the draft. No delete action was submitted through the UI.

Map/asset pruning, manual image upload/crop/trace, full responsive/accessibility
qualification, cross-tab archive conflicts, actual main-game Journey adoption and
phase release acceptance remain. These controls follow the existing workbench
layout under the frontend-design skill; they do not add player-facing menus.
