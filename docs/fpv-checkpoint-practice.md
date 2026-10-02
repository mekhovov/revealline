# Reliable FPV section practice

The results screen restores the selected objective from the original recording.
Previously it copied the previous objective centre into a new course spawn. This
lost velocity, orientation, actor state and objective history, and four school
checkpoints started inside collision geometry.

## Player behavior

- **Practise longest section / biggest time loss** verifies the recording and
  reconstructs its command prefix against the unchanged course. It starts paused
  at the exact objective boundary, with original attitude, momentum, world tick,
  actors, response settings and course identity.
- Only the selected objective is active in the practice UI. It ends with an
  explicitly unscored result. Retry returns to the same recorded entry; **Fly full
  challenge** starts an ordinary attempt at the original launch point.
- Keyboard, touch and standard controller retain the frozen throttle only after
  deliberate Arm. USB radios must match the displayed recorded controls and
  satisfy the existing arm-switch gate. Changes of input owner, pauses and
  reconnects release actions; no recorded fire action is restored.
- Missing, invalid, incompatible or unreached evidence offers labelled full-route
  unscored practice at the original spawn. It never guesses a checkpoint pose.
- Section practice creates no recorder, medals, completion evidence, playlist
  progress or interrupted-session replacement. The full lesson guide stays
  closed; changing radio response settings retains the recorded section settings.

## Implementation

`prepareCheckpointPractice(course, mode, index, { proof, response, signal })`
validates a bounded private proof copy, verifies the full recording and then
reconstructs the selected prefix cooperatively. Cancellation disposes late
flights. `createWorldFlight` accepts `practiceEndStep` only for explicitly
unscored flights; original scored completion and endless controls-lab behavior
are unchanged. Every recorder session rejects the unscored runtime.

The legacy `checkpointPractice` export now returns the validated original course
for safe compatibility. It no longer manufactures a derivative course or spawn.

## Qualification

Run `node scripts/qualify-fpv-checkpoint-practice.mjs --output receipt.json`.
It exercises all 1,331 supported v2 objective positions: 716 exact recorded entry
restorations and 615 original-route fallbacks, using all 138 installed v2 proofs.
It independently compares moving and actor-bearing entry/end states, verifies
the four old blocked spawns, partial and tampered evidence, cancellation, caller
mutation and recorder rejection. This is functional qualification; additional
unit coverage remains in R7.

Generate the actual-host browser fixture with
`node scripts/prepare-fpv-checkpoint-verification.mjs [unique-suffix]`, serve the
repository and open its generated `index.html`. The fixture uses production HTML
and modules with isolated native IndexedDB and controlled devices. Browser
results and frozen package evidence are recorded alongside this document.

Physical TX15/iPhone/Steam Deck acceptance, novice observations and sustained
hardware measurements remain pending. A local build or PR is not public live
availability.
