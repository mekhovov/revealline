# Studio membership removal and guarded deletion

20 September 2026. Early independent preparation for P02 on the P01 candidate
branch; this is not phase completion, published content, or full Studio CRUD.

The shared structure editor now supports removing a mission from one campaign or
a campaign from one pack. Other memberships and the underlying definitions remain
intact. Membership and order edits renew the changed parent's candidate revision.

`inspectContentRemoval` lists every incoming parent and every contained member.
Deletion requires the exact stable ID, rechecks dependencies at Apply, and refuses
referenced or nonempty items. There is no automatic cascade. Maps, asset revisions,
other items and saved checkpoints are retained. Undo restores the exact previous
project. These operations modify local candidates only, never published editions
or player progress. Map/asset pruning and archive/restore remain unimplemented.

The existing workbench uses explicit Remove from parent and Delete unreferenced
item actions. Deletion shows the dependency list, disables Apply while blocked,
and requires a typed item ID. Changing target/type/action clears the confirmation.
The existing autosave, history and compiler remain the only application path.

## Verification

- Ten focused removal/structure/empty-project tests passed. Coverage includes two
  parents sharing a mission, detaching one without losing the other, nonempty
  containers, no implicit child/map/asset removal, exact confirmation, a dependency
  added after inspection, atomic refusal, parent revisions, and exact Undo/Redo.
- Expanded content/foundation/Horizon cohort: **97/97 passed**, zero failed,
  skipped, cancelled or todo; complete Solo/paired feasibility routes remain valid.
- Full source validation passed: 0.69.0, 698 files, the same four existing navigation
  warnings. Full formatting and changed-file lint passed. These checks include local
  uncommitted art bindings; they are not an exact-source hosted qualification.
- Native in-app browser reloaded the owned `studio-empty-check` fixture, created
  `membership-check`, and added `tuning-fixture` to it. Mission deletion named the
  parent campaign and disabled Apply. Selecting the campaign named its contained
  mission, kept Apply disabled, and cleared the previously typed confirmation.
  Checkpoint 9 saved. No mission, campaign, map or asset was deleted through the UI.
- Native end-to-end deletion and deletion Undo, small-screen management controls,
  assistive technology and cross-tab deletion interactions remain to verify.

An exact-label browser selector did not match the nested select label; the observed
`item-kind` control ID resolved normally. This was a selector failure, not a product
failure. The final parent-revision correction was covered by automated tests after
the native dependency checks; no later native source acceptance is implied.

The frontend-design skill kept this addition within the existing Field Kit
workbench, with visible impact text and native controls instead of another modal
navigation layer. The executing-plans workflow kept this slice explicitly separate
from completed P02 acceptance.
