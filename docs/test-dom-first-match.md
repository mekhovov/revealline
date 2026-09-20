# First-match lookup in the host-test DOM

Host tests repeatedly find one element by ID or selector. The test DOM previously
built the entire matching array before returning its first element. Its normal
`querySelector` path now stops at the first depth-first match. `querySelectorAll`
and the supported selector parser remain unchanged. This changes test infrastructure,
not the browser renderer, controls, simulation or player data.

## Compatibility contract

Keep descendant document order, duplicate-ID ordering and root exclusion. Resolve
against the current tree after moves, removals, renames and attribute changes;
do not add an identity cache. Fixtures that intentionally override
`querySelectorAll` retain that override, including on nested elements and the
Document. A child override of `querySelector` must not redefine an ancestor's
query engine. The common primitive is called through its prototype for that reason.

## Verification and maintenance prompt

Run `game/test/dom-query-boundary.test.mjs`, then the unchanged gallery-focus,
practice-playground-display, presentation-ui, continuous-input and couch-input
files. Also run the unchanged Journey ten-clear/Next host case against the exact
composed runtime. Preserve assertions and simulation steps; do not simplify a
player journey to obtain a lower elapsed time.

Example prompt: “Optimize one-result host-DOM lookup while retaining custom
querySelectorAll fixture behavior. Prove order, mutation, duplicate IDs, nested
overrides and ancestor lookup semantics. Run the unchanged input, gallery,
Playground and continuous Journey regressions. Report exact source, runtime,
failures and reruns. Keep synthetic lookup timings separate from whole-host test
timings and from actual browser performance.”

The candidate's virtual source loader must handle its own absolute file URLs,
including cache-busting queries. Its Git byte buffer must accommodate the actual
11,708,176-byte FPV pack fixture. Loader failures are setup failures, retained
separately from product failures. Neither a scoped cohort nor a synthetic
benchmark qualifies all release gates, a physical device or the public build.
