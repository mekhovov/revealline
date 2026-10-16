# Actor batch 14 — A-first delivery prerequisite

Parent `396ad4cf901b3fb99951ff02beff57f9bad19f52`, draft PR761.
The user selected **A → B → C → rest**: current characters/reliable play,
optional encounter variety, then one finished Ukrainian/FPV art cohort.
Formal C2 human/game-feel assessment stays last.

## Implemented and reviewed

- Updated the active plan, current register and maintainer guidance to that order.
- Added a bounded exact-source admission-manifest reader for motion, effects,
  Team and equipment, supporting independent group subsets. It authenticates a
  code-owned pin, immutable ancestors, ordered individual source bytes, aggregate
  fingerprints, closed slot sets and canonical per-slot payloads.
- A missing pin, draft, unknown group/slot, altered ancestor/source/payload or
  undeclared group cannot pass. Audio is separate. The returned matcher exposes
  no quality stage and has no production caller, current approved manifest or pin.
- Independent review identified a shared-file consistency issue: re-reading the
  same path could admit different versions across groups. One owned byte snapshot
  per path now covers all reads; a conflicting declaration fails even when the
  supplied reader changes bytes. The caller-owned pin is also captured before
  the first asynchronous read.

A separate read-only current-character audit found no additional proven rotor or
movement defect after batches12/13. The apparent Solo/Versus versus Team warning
heading difference is intentional: classic pressure enemies continue patrol travel,
whereas Team hunters use their own commitment pose. No behavior was changed to
make those different simulations look artificially identical.

## Verification

Node22.22.2 author and independent root runs of:

```text
node --test scripts/test-actor-presentation-continuation.mjs
```

**27/27 pass, zero failures/skips/cancellations.** These use synthetic successor
manifests and the actual nine-record immutable predecessor chain. The full
synthetic scope exercises all59 motion/effects/Team/equipment slots; single-group
and combined subsets also pass. Unknown/empty groups, reordered/missing data,
same-aggregate changed file boundaries, shared-file inconsistency, pin mutation
and non-JSON payloads fail closed.

Scoped ESLint with zero warnings, scoped Prettier and diff whitespace checks pass.
Final code SHA256:

- Reader: `3d227e5cbbb5639c21a5367748bb1c3a947d5588faf5856c204a77b6754772d5`
- Tests: `32cae809d38ceee54e9ab1955a4ab9d6fd3e1ee0c03bf89e4699aee7118a8826`

Both new scripts total21,576 bytes. No runtime, generated catalogue, PNG, approved
review, production record, version, tag or release changed in this slice.

## Still open

This is the [A1 prerequisite](../../actor-presentation-adoption.md), not completed
production adoption or new art. The previous 67-slot review map still applies,
including8 audio slots handled separately. Original Team recipe/default/inherited
image and equipment PNG guards remain required. Reconcile and review the exact
integrated source, add an explicitly approved successor, compose the producer,
preserve immutable history, then qualify and publish.

No new build, visual/browser, physical-device, human, offline or public-play
acceptance is claimed. Local capacity fell below the publisher's disk reserve,
so builds and large materialization remained paused; no existing files were
deleted. Prior build/test evidence retains its original source scope. Long suites
remain waived, not passed. Small independent source work continued.
