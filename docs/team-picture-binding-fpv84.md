# Team picture binding qualification for FPV 84

## Scope

- Base: `e11bf150fa7b6201a17ca6e4e51a0623b4eb88b4`.
- The current compiled presentation is FPV revision 84. The approved Team
  Orchard and Foundry picture records remain byte-identical to their revision 82
  records.
- This correction advances only the exact current starter and historical-import
  associations. Revisions 82 and 83 join the retained 58–81 history.
- The historical-import policy remains finite at 27 exact revisions: current 84
  plus retained 58–83.

## Resulting behavior

Legacy Team First Connection and Relay Yard picture preparation can select the
reviewed FPV 84 assets again. Historical imports can use the same exact approved
wide scene at revision 84, while attempts pinned to revisions 58–83 retain their
existing associations.

The change grants no new artwork, content, release, physical-controller, or
deployment approval. Asset IDs, revisions, hashes, bytes, dimensions, geometry,
and sampling remain unchanged.

## Validation

- Direct starter-binding, historical-import, and reviewed-successor contracts:
  94 passed.
- PR #549 keyboard, touch disclosure, and controller-preparation focused runtime
  checks on a temporary composition of that branch with this correction: 3
  passed.
- Scoped ESLint, Prettier, and `git diff --check` passed.
