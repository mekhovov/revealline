# Mission Library native test file isolation

This is a test-only prerequisite prepared from main `e660eaef0aea3e93aa4ea3da4cc6fe984519a828` (tree `6b619f2c5da94716c6b5e451dc6ef47a208ef936`). The production app, native host fixture, localization, build, service, persistence and input owners are unchanged.

The original 22 cases are organized into four complete native files:

| Complete file | Cases | Behavior |
| --- | ---: | --- |
| mission-library-solo-custom-host.test.mjs | 2 | Installed authored identities and truthful authored Next/end/progress |
| mission-library-solo-host.test.mjs | 7 | Inventory, native setup/focus, Classic download/retry and empty-profile launch |
| mission-library-solo-incoming-host.test.mjs | 6 | Incoming Classic identity/picture ownership, all three preparation races and unknown identity |
| mission-library-solo-handoff-host.test.mjs | 7 | Journey/Classic routing, Versus/Team identity filters, incoming Journey and Stay/checkpoint |

Every original case name, callback body, assertion, loop value, fixture declaration and logical wait is preserved. The adjacent mission-library-solo-fixture.mjs keeps the same relative fixture URLs. Its existing modeled host still emits pagehide, closes the database, detaches its document and restores globals/painter methods. Neither the actual app disposal nor the fixture lifecycle is changed.

The one-time refactor proof records the captured original source hash and verifies verbatim registration blocks and helper declarations across the four files. It is review evidence, not a permanent test that prevents future assertion changes. Focused verification registers four distinct complete-file commands, each with --test --test-concurrency=1 FILE and its own timeoutMs=300000 (five-minute ceiling). No combined twenty-minute command can extend an individual file’s accepted wall budget. Permanent regressions instead exercise actual focused-command selection and the real CLI discovery boundary: a fixture-only edit or any of the four native edits selects exactly those four IDs/arguments/individual timeouts without duplicate or deferred changed-test commands; unrelated edits do not select or defer this cohort; ordinary test discovery registers all four files once and excludes the shared fixture. The discovery regression intercepts only child_process.spawnSync, calls the real CLI main test action, and restores the built-in binding in finally. It does not execute the discovered test files.

Run the complete new native cohort with `npm run test:mission-library-solo`. It uses one test file at a time and ordinary Node process isolation. Do not combine these files under isolation=none in a single process: doing so would join their application-module lifetimes again. Running one complete file per fresh guarded process also preserves the intended boundary.

## Why this is a separate prerequisite

The original 30,462-byte monolith has Git blob `63c1ecb45f2070d1626021981a06b2b54eaa5291` and SHA-256 `affad71754dd885d0425230e7ca8ef8871ac3fa60d902b5a6a8abe94f29c163b`. It is byte-identical on original Capture 51b5, captured main ba73, Capture integration 2d5 and this e660 base. Root separately verified the same blob on observed main 5b465.

Both the feature attempt and captured-main baseline completed the same first 18 cases before fatal V8 heap OOM under the same 1,536MiB heap / 2,048MiB owned RSS / 300s whole-file budget. The feature attempt persisted SIGABRT/exit -6 with source postflight exact. The baseline's raw output confirms OOM, but its final receipt failed a disk-floor source-audit guard and did not persist the process exit code. Independent recovery-only verification subsequently established exact baseline source, then restored all nine original Capture scratch inodes and all 29,267 source paths. Both original attempts remain FAILED/INCOMPLETE. Nine other complete Capture files / 113 cases remain historically scoped to their tested source.

The helper deliberately imports a distinct app.mjs?difficultyHost=N for each host. Node resolves and caches ESM by URL; different query values load separate module instances. This supports a bounded file-lifetime design, but does not prove which application or fixture object caused retention. The actual app already disposes its locale/UI/input/library owners on pagehide; no missing-cleanup or production leak fix is claimed.

Primary references:

- [Node22 ESM URL semantics](https://nodejs.org/download/release/v22.15.0/docs/api/esm.html#urls)
- [Node22 test execution model](https://nodejs.org/download/release/v22.17.0/docs/api/test.html#test-runner-execution-model)

## Qualification at review-artifact stage

- Exact original registration/helper byte comparisons and syntax checks are recorded in the external review bundle.
- New registry/discovery regression cases: NOT RUN.
- Four complete native files / 22 cases: NOT RUN.
- No filters, skips, assertion changes, forced garbage collection, heap increase or logical timeout changes were introduced.
- The original Team filter count assertions remain exact, even if a new complete file now reaches a previously masked semantic failure. Any such failure requires its own diagnosis.
- No original checkout/index/refs, game source or shared validation scratch was modified by preparing this bundle.
- Browser, whole-project test, full-source validation, package/build and physical-device gates are not qualified by this test-only refactor.

After independent review, freeze the committed candidate and run the complete registry/discovery files followed by the four complete native files serially under the existing resource guards. Preserve every terminal summary, exact emitted case names, full raw output and source identity before/after. Stop on a semantic/resource failure; do not infer the failed original monolith passed. Qualification of this new architecture must name its exact source and four complete files.
