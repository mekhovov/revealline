# P01 — direct candidate mission tuning

Studio now exposes earned-coverage target, optional countdown and all seven
difficulty ratings in one optional disclosure. `tuneContentMission` validates
edits through the shared ContentProject compiler, including every parent campaign
band. No per-mission override of lives, movement or actor speed is accepted.
Ratings are design metadata, not hidden gameplay multipliers or playtest evidence.

20 September 2026 local verification:

- Five focused tuning/empty-Studio tests passed, including three tuning tests.
  They cover all presets, Gentle's non-failing timer, immutable shared geometry,
  rating-only simulation identity, invalid-input atomicity and exact Undo/Redo.
- The broader content/foundation/Horizon cohort passed 92/92, zero failed,
  cancelled, skipped or todo. It includes the pending five-background working
  candidate, not an exact-source release qualification.
- Native owned `studio-empty-check` fixture: apply 72%/90 seconds/band 2/planning 2;
  Gentle shows 5 lives and unchanged 10 cells/s. Expert shows 2 lives and 10 cells/s.
  Apply a second 75% target, Undo back to 72%, Redo, save checkpoint 7, and reload
  restores 75%. Existing player projects were not changed.
- Initial testing found overlay toggling replaced an unapplied 75% field with
  the accepted 72%. The field synchronization now keys the mission revision;
  overlay and difficulty inspection leave the unapplied 75% intact. Native AX
  observations verified the correction. Two read-only browser selector evaluations
  timed out; the native accessibility state supplied the actual values. These are
  driver observations, not game failures or performance measurements.

Unapplied form values are not autosaved. The disclosure explicitly says to Apply
before switching missions or changing other draft structure. Applied edits use
the existing atomic checkpoint, conflict, backup and Undo/Redo flow. Physical
devices, full responsive tuning layout, human difficulty and public deployment
remain unverified.
