# Catalogue storage reliability — 14 October 2026

This is an exact-pack, source-bound qualification of all 20 published catalogue
worlds. It uses fresh in-memory `fake-indexeddb` storage. It does not establish
browser quota/eviction behavior, rendered-world quality, offline package admission,
or hardware acceptance. No player storage, running server or published pack changed.

## Inputs and results

Runtime baseline: main `280ff4d2a35b5854a85d98a8973a47a832af66e6` (merged #1225).
The retained catalogue is `authoring/fpv-worlds/published/free-worlds-v2/index.json`
from that commit. Each of its 20 immutable first-party HTTPS pack URLs was read and
verified against its declared size and SHA-256 before qualification. Together the
packs contain **15,605,575 bytes**. The page has no continuation.

[The bounded receipt](fpv-catalogue-storage-20261014.json) records every source
commit/path, pack digest, revision, size, course count and direct implementation
source hash. All 20 packs passed every row below on Node 20.19.5:

| Boundary                        | Observed result                                                                                                                                       |
| ------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| Published bytes                 | Declared size/SHA, project ID and course count matched.                                                                                               |
| Import and playable compilation | Every pack passed the current importer and compiled its declared courses.                                                                             |
| Export                          | Re-exported original project/assets reproduced the exact original pack SHA.                                                                           |
| Install                         | Verified project and original asset bytes became the active revision.                                                                                 |
| Stale writer                    | An older expected generation was rejected; generation, active project/assets and revision list stayed exact.                                          |
| Injected quota failure          | A named `QuotaExceededError` at the project write, after asset writes had been queued, aborted the transaction and retained the complete prior state. |
| Corrupted download              | Flipping the last asset byte failed import hash verification without changing storage.                                                                |
| Update                          | A clearly synthetic title-only revision became active while the original exact revision/assets remained available.                                    |
| Rollback                        | Activating the original digest restored its exact project/assets; the synthetic revision remained separately retained.                                |
| Offload                         | Removing only the inactive synthetic revision retained the active original.                                                                           |
| Reopen                          | After all 20 journeys, a new database connection retained every original active project and asset digest.                                             |

No runtime defect was found in these boundaries. The quota error is deliberately
injected into the modeled database; it is not real disk pressure, browser quota
exhaustion or eviction. Synthetic updates are qualification inputs, not newly
published world revisions. This tool never opens a flight, generates controls,
awards progress or verifies recordings.

The 43 existing world-content, offline-control and offline-lifecycle checks also
passed. The offline tests cover cancellation, late completion, registration/removal
ownership and readiness refusal with missing dependencies. The earlier native
browser [cached-launch receipt](fpv-offline-candidate-20261014.md) remains separate:
its frozen package predates this runtime and covered one installed world with its
own origin unavailable. It is not relabelled as an all-world offline pass.

## Reproduce

Use the existing authoring development dependency `fake-indexeddb` 6.2.5. Prepare
an external input directory containing the retained `index.json` and
`packs/<world-id>.rlpack` for every row, fetched from that row's pinned commit/path.
The script itself performs no network requests or Git writes, verifies every byte,
and refuses a catalogue with an unqualified continuation. It writes only a new
receipt path and refuses to overwrite an existing receipt:

```sh
node scripts/qualify-fpv-catalogue-storage.mjs INPUT_DIRECTORY NEW_RECEIPT.json
node --test game/test/fpv-world-content.test.mjs game/test/fpv-offline-controls.test.mjs game/test/optional-offline-lifecycle.test.mjs
```

The unchanged downloads, root index, HTTPS retrieval receipt, exploratory import
receipt and final output are retained on the external volume in
`CodexMigrationStaging/fpv-catalogue-reliability-20261014/`. Direct source hashes,
including the qualifier itself, bind the committed receipt to the evaluated code.
This is a manual corpus qualification tool, not the deferred D6 unit-coverage sweep.
No heavy package build ran below the stable 3 GiB local free-space floor.

## Remaining P4 priorities

1. **Exact current package journey:** installation, update, rollback, interrupted
   preparation and installed-world launch using an admitted current candidate in
   the native browser. Shared source/storage checks do not replace worker/cache
   and browser lifecycle evidence.
2. **Actual quota, eviction and network-wide offline:** use isolated origins and
   controlled device/browser storage. The player must retain data or clearly
   report unavailable dependencies; modeled exceptions and stopping one local
   server do not qualify these behaviors.
3. **Catalogue-wide visual/play acceptance:** render and deliberately fly all
   20 worlds, including collision/visibility and repeated loading/unloading.
   Import/compile success does not prove scenery quality or performance.
4. **Device/controller and sustained performance:** named iPhone/handheld/radio
   runs, input ownership and memory/frame-time budgets remain unverified here.
5. **Protected publication:** this receipt does not change any admission or
   public-eligibility flag. PR #1225's candidate and optional-practice jobs passed;
   its separate preview job reported one regional authoring appearance-bootstrap
   failure, handled independently from this storage lane.
