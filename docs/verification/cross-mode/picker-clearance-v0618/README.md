# P05 — Image picker label and focus clearance, v0.61.8 candidate

After previewing an image and returning to the original file picker, the field's label and focus outline stay clear of the sticky status and Cancel controls. The same focused field remains visible after a portrait-to-short-landscape resize. This is one correction within the open P03/P05 player-interface phases.

The six-file donor correction was reviewed on source `4fd8e2dac4fdc851d0d2bf0b21e77162d9d405c9`, then applied as hunks to v0.61.7 source `b3262eb02a998c50354758ba922324d023138875`. The Motion Lab correction and its skill guidance remain intact. The integrated source has three synchronized v0.61.8 version files; it has not yet passed full source qualification or public deployment.

The shared clearance helper adds an opt-in containing-label target. Still Media enables it; other dialogs keep control-only behavior. If the entire label/control wrapper cannot fit between the rails, the control takes priority and ordinary reading scroll remains available. Layout does not change focus, preview media, save assignments or replace operation ownership. Closing and disposal retire queued work.

## Evidence

- The original six-file donor cohort passed 104 tests on both Node 20.19.5 and 22.22.2. The integrated two affected test files passed 47 tests on each version. Scoped lint, formatting and diff checks passed.
- All three candidate revisions, their preserved failed regressions, and the root's r1/r3 native observations are retained byte-for-byte. There is no invented r2 native observation. `originals-manifest.json` records 124 originals and their hashes.
- The root's native r3 Standard-text journey used an actual file chooser, entered metadata, previewed the owned picture, reverse-traversed to the picker, and resized from 390×844 to 844×390. Its label and complete painted outline cleared the status rail; focus and the selected image remained intact.
- The native r3 observation ran against the frozen donor candidate, not a public v0.61.8 deployment. Integrated runtime and test files are byte-identical to that donor. The integrated guide adds the observed limitations.
- The read-only production trace found no changed recipe fingerprint input. No generated art or production approval was altered.

## Remaining limits

Large text did not propagate from the game setting into the standalone Still Media host: the computed font remained 16px. This is an open host-preference issue, not a passed Large-text check. Oversized labels are covered by source regressions; no native oversized-label fixture is claimed.

The complete settings round trip first exposed one authored record/revision on entering `/game`, without a manual assignment action. The isolated preview/resize behavior must not be generalized into a claim of unchanged storage for that whole journey. The separate Close local connections focus-return issue remains open.

Physical touch/controller, assistive technology, full zoom and host coverage remain unqualified. Full source gates, final package qualification, release publication and public browser checks are still required. Parent phases remain open; the approved delivery order is unchanged.
