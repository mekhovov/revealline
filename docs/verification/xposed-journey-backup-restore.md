# Journey progress backup restoration — P01 follow-up

20 September 2026. Unpublished candidate on P01; not part of frozen v0.67.0.

## Recovery contract

Missions → Progress backup is an optional recovery surface. Ordinary Continue,
Next and Skip do not pass through it. Export uses the existing portable
`revealline-journey-backup.v1` envelope. A local JSON file is inspected and its
per-mode additions/conflicts described before a separate Restore activation.
Selecting a file alone never changes progress or gameplay.

Restore merges only missing records. Existing local completion receipts and
Continue cursors win; an empty cursor may be restored. Skipped records are united
but never override clears. Unknown mission IDs remain available for other editions.
An imported generation number is ignored. Identical restores are idempotent.

The persisted v1 profile shape/database stay unchanged, so older editions can
still read the result. The merge runs inside the same IndexedDB read/modify/write
transaction as normal progress events. Concurrent live clears and selections win
over imported records regardless of transaction order. No replay identity is
rewritten, score or unlock awarded, imported mission installed, or current attempt
replaced. Backup records are user-controlled local progress, not cryptographic
completion/anti-cheat evidence.

File/envelope input is capped at 8 MiB to permit formatted exports of the existing
4 MiB normalized profile budget. Exact schemas, structural/string limits and
receipt validation remain in force. Invalid imports cannot change pending or saved
state. Corrupt durable data is never overwritten. Failed storage retains the merged
session state, truthful warning, export and retry path. Late reads from closed
dialogs or older selections cannot enable Restore for the wrong file.

## Recorded verification

- Seven focused restore tests cover all modes, receipt/cursor conflicts,
  malformed/oversized/hostile data, idempotence, concurrent tabs in both orders,
  failed storage and retry/recreation, corrupt-storage preservation, explicit
  inspection/Apply, export and stale file reads.
- Actual app-host fixture restores a missing clear while retaining the exact
  paused run object, level, tick, position, score and lives. The active Continue
  cursor stays on Cut 1; Cut 2 gains only its restored chooser completion record.
  Back to missions retains the chooser and restores focus to Progress backup.
- The final complete Journey cohort passed **29/29**, including ten legal
  Next transitions, two-action Skip, edited-pack authority refusal, load failure
  and cancellation cases, after the responsive DOM correction. No failures,
  skips, cancellations or todos. Full lint, formatting, whitespace and source
  validation pass (0.69.0, 699 files, the same four navigation warnings).
- A read-only compatibility check loaded the exact frozen v0.67 profile module
  from source `6a42facaa321b3851745d752fceeb140a967e6e7` (module SHA-256
  `49e445959d6476d0cf87a41053437c0889fd5cee73ebc6de5d22351998d6fcbd`).
  Its two imports are byte-unchanged relative to that source. The frozen validator
  accepted a newly merged record, and its normal select event remained valid under
  the new reader. This is profile compatibility, not a deployed rollback test.
- Native mutable P01 app: title Missions → Progress backup opens a labelled
  native dialog with Restore disabled until inspection. Escape closes only the
  recovery dialog, retains Missions and returns focus to Progress backup.
- Initial short-landscape layout put actions below the fold. A three-row dialog
  with a separately scrolling body fixes it. At 844×390, dialog bottom is358px
  and both actions span294–338px. Keyboard Tab brings the file control into view
  at151–215px. At390×844, both actions remain visible (bottoms464/524px).
  The chooser's Back and Progress backup buttons remain in their own footer;
  portrait bottom826px, landscape bottom382px. Viewport overrides were reset.
- Native file-chooser import/restore is not claimed; its content workflow is
  covered by the real app-host fixture and storage tests. No human enjoyment,
  hardware-controller, offline or public-release acceptance is implied.

Full exact-source CI, accepted-baseline integration, reviewed PR and release gates
remain required. This addition does not change the frozen P00 release or qualify
the new authored curriculum.
