# Team presentation ownership in the live host

Team setup, active attempts, Retry, ordered Next, and arena discovery now use an owned picture/presentation selection. A fresh arena borrows the prepared page snapshot. An authenticated historical artwork envelope can acquire its exact retained manifest and assets without rewriting current production defaults.

## Adoption and return behavior

- Prepare the prospective picture and its compatible presentation before replacing an existing attempt or result. Keep failure and cancellation recovery attached to that previous owner.
- Retry confirms the accepted selection and uses its exact picture and presentation. It does not ask the current defaults to reselect artwork.
- Next and catalogue replacement first paint against the candidate's own snapshot, then restore the accepted painter until adoption commits.
- Preview has an independent lease. Previewing, returning from preview, or closing the catalogue never applies that lease to the live DOM or awards a picture.
- The display owner coordinates the accepted painter, DOM asset variables, and menu Auto-theme reference. Failed or superseded updates roll back all three, and a later refresh repairs a rejected update rather than treating it as already applied.
- Page preparation and picture Retry reconcile the accepted display instead of unconditionally applying the current page theme over a retained attempt.
- Terminal host disposal retires display ownership before cancelling pending imports or other operations. The page lifecycle may already have released its borrowed snapshot; cancellation callbacks must not reacquire or repaint it. BFCache suspension remains separate from terminal disposal.

## Imported pack progress and recovery

For maps with multiple required strongholds, `Relays 0 / 2` counts only required cores secured, while `Anchors 0 / 2` describes the current relay's shield. `Relay 2` uses its number on the board, including any optional relays earlier in the map. Optional strongholds never increase the required total. Single-required-core guidance keeps its existing wording.

A plain historical JSON pack can use the explicit approved generic-picture policy. A required-art envelope must pass all of its image checks; invalid artwork leaves the previously accepted pack and picture selected and reports the import failure. It does not install the embedded gameplay pack with generic artwork. The pack status uses singular `level` for one-level imports.

## Terminal status guidance

The final simulation step still records event feedback and releases input. Once that step ends in won or lost, the board's polite status region announces the terminal result instead of a Joint Cut, rescue, anchor or fresh-direction instruction. This also clears the status icon associated with the earlier active event. The Results panel retains its statistics, failure advice and continuation actions; the status correction does not change core events or simulation state.

On resize or rotation, the current focused Results action uses the same scroll-only visibility guard as lobby and Pause actions. Foreground, attempt, Settings visit, dialog, focus and final-layout checks must still agree. This preserves the current focus and frozen result; it never resumes or activates an action. Reading regions retain their independent owner.

Joint Cut and rescue feedback remain available during active play. A deliberate Retry starts with the original arena guidance. Terminal guidance is emitted at the transition rather than forced on every render, so a later picture or navigation recovery error can still explain its own action.

## Compatibility and publication

The historical Team envelope and level/pack identity contracts remain unchanged. Retained manifests are selected only through code-owned revision associations and verified content hashes. Imported input does not become a runtime URL authority. Current bindings, production output, release version, simulation rules, Solo saves, and progress are not changed by this integration.

This code depends on the owned Team presentation wrapper, retained manifest reader/publisher contracts, and Team display owner. Advancing the production collection additionally requires approved image bindings, preservation of the old runtime and assets, generation reproduction, offline dependency qualification, full source/build gates, and public verification. A provisional fixture containing two revisions is test evidence, not a production adoption.

## Validation boundaries

The host regression cohort exercises preparation, rollback, stale completion, import cancellation, exact Retry/Next, preview ownership and terminal cleanup. It uses a finite DOM and inert Canvas; modeled wins do not prove human fairness or physical-device play. Native local checks must separately record real decoded artwork, exact served hashes, focus, visible loading, pause/Retry, catalogue preview and return. The immutable release must then repeat applicable public/offline checks.

See [owned selection](team-owned-presentation.md), [display ownership](team-presentation-display.md), and [retained manifests](retained-presentation-manifests.md).
