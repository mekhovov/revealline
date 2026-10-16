# Three-app installation and restart observation — 15 October 2026

The diagnostic retry passed all nine observer checkpoints on Chrome
155.0.8059.40, using the unchanged runtime artifacts from the
[frozen candidate](flight-practice-candidate-2026-10-15.md). The first attempt
failed and is retained. This is bounded technical evidence, **not full Phase 1
acceptance or publication approval**.

## Final-guide candidate confirmation

After committing the guide changes, all three packages were rebuilt reproducibly
from `ff8bfbca35aa5aabf4a89c1961493102bb50126a`, tree
`b61d3de220c1ac5eb46bf143bcd4bf0020744ce5`. The final envelope is
`4959a8a012a6268b3a724d7524a613e1e24ff1a2cdb95735558458fecd6121f2`.
The [final receipt](flight-practice-qualification-20261015/practice-real-restart-final-ff8bfbca35-20261015.json),
created at `2026-10-15T04:30:18.004Z`, passed the same nine checkpoints using the
unchanged observer/helper hashes below, with no page or cleanup errors. All three
test installations and the temporary profile were removed successfully.

The [final candidate comparison](flight-practice-final-candidate-2026-10-15.md)
confirms only guide bytes and generated manifest/worker arguments changed.
This rerun covers their actual new package revisions rather than transferring the
baseline pass by assumption. It retains the same keyboard, synthetic proof,
same-payload update and network-emulation limits. Two later successful runs do not
identify or fix the earlier hidden-link timeout's cause.

Full repository `npm run lint` also exited successfully after the implementation
commit. The 323-test practice run and focused 15-test observer/guide rerun passed.

## Baseline retry identity

- Source: `da0b0108206a0270b4b870e747f2d1bc0e6695cb`.
- Tree: `69fac419ea9c23984d998b6da10ae5c9f1459e42`.
- Envelope: `4f4f0c78af851dfe5297097d87169b322f55704d85f6754b9ae12acb85b68926`.
- Observer: `acbbb9daae150ec0936b74f3f504297488c2833135bbb6660effef16281da8e6`.
- Helper: `5b6f8c611472f218cf3d7171dadc3289fad4191593b8fec29b8cb26aad1f4ce3`.
- Passing receipt created at `2026-10-15T04:19:32.819Z`; original bytes and hashes
  are in the [evidence inventory](flight-practice-qualification-20261015/README.md).

The authorized credential was supplied privately to the isolated observer and
entered through each ordinary form. No access metadata or package runtime was
edited to unlock it. Subsequent guide edits are not in this candidate.

## What passed

1. Gym, Flight Studio and World Studio prepared through their existing UI, each
   with distinct package pointers, owning workers and prepared dependencies.
2. All three installed Chrome apps opened in standalone windows.
3. All four open pages/windows closed; stable launchers and installed windows
   reopened offline and reached each mounted start screen. Uncached probes failed.
4. The owned persistent browser closed with its close event observed; a fresh
   browser launched on the same profile with offline enabled before app navigation.
   All three launchers and installed windows reopened again. This is stronger than
   leaving a tab alive, but is not an OS reboot or physical network disconnection.
5. Scripted FPV proof and unverified radio/response profile exports remained
   byte-identical through offline reopening, restart and the following recovery cases.
6. A same-payload alternate-path installation updated to the candidate path.
   A deliberately truncated transfer was rejected without advancing pointers.
   Removing the candidate restored the retained path and its offline operation.
7. Removing/uninstalling Gym preserved FPV records/registration and the World
   Studio installation pointer. Final cleanup removed only the three test apps
   and temporary profile; no page or cleanup errors were recorded.

## Failure retained, not explained away

The earlier attempt prepared and installed all three apps, then hit the unchanged
30-second click deadline because the offline launcher's Open link stayed hidden.
It did not reach browser restart. That receipt lacks the later step/status
diagnostics, so the exact package and cause are not established.

The retry added bounded read-only failure diagnostics and a pre-acquisition
deadline guard, not a launcher change, forced click, increased deadline or altered
package. It passed. A transient verification/startup/load issue remains possible
but unproven; repeat under controlled load before closing reliability concerns.

## Limits and remaining work

- FPV initially uses the candidate's same payload under local `v0.0.0`; the
  candidate is `v0.151.1`. This tests path isolation/rollback, **not an upgrade
  between different released payloads or model schemas**.
- Browser-context network denial is not machine-wide airplane mode or proof that
  every service-worker/background origin was unreachable. Physical-device offline
  checks remain separate.
- Imported scripted demonstration frames test persistence, not a human flight or
  beginner-exercise completion. The radio profile remains deliberately unverified.
- The recorded keyboard route does not qualify the known first-pointer disclosure
  and export issue. Physical controllers, touch, spoken screen-reader behavior,
  native zoom, performance budgets and first-time-player testing remain unrun here.
- No quota exhaustion, eviction, distinct-release migration, public deployment or
  regional-world offline coverage is inferred from this run.

The current source-bound [directory component retry](flight-practice-qualification-20261015/practice-directory-browser-da0b010820-retry-20261015.json)
also passed seven checkpoints: localized cards, focus, narrow/reflow layout,
lightweight loading, empty/error fallbacks, dated cached data and retry/dialog
navigation. It uses unpublished metadata fixtures rather than the full game shell.
Its first attempt failed cleanup and remains in the same evidence inventory.
