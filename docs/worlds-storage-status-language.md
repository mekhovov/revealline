# Worlds storage message language

Worlds' storage message now follows the player's current English or Ukrainian selection. A browser review had shown the message staying Ukrainian after selecting English, while neighboring controls refreshed. Previously, the message rendered only when initial storage opened or a persistence request completed.

The correction retains four semantic outcomes and paints their exact existing English/Ukrainian copy from the current locale. Language refresh adds no storage read, permission request, capability recheck or catalogue reload. The existing storage and permission owners still establish the result. Initial availability cannot replace an accepted explicit permission result. Pending or rejected requests retain the last completed message; older overlapping requests cannot publish a result or error over a newer request. Synchronous disposal blocks new prompts and late permission completion. Missing persistence APIs and current-request errors keep their existing behavior and copy. This change establishes neither offline installation nor a current save-writer lease.

## Native verification

The valid red run used the unchanged Worlds production source from `9c6eae58224a0088690ba4345250a7eca9348c02`. All 19 selected new actual-host cases failed: 17 exposed stale locale text and two exposed an additional permission prompt after synchronous disposal. No cases were skipped. The bounded run exited with test failure in 3.33 seconds; no memory or wall guard triggered.

The corrected selected feature cases passed **19/19**, without skips, in 4.67 seconds at a 768 MiB V8 heap limit. They exercise both-store and partial/unavailable initialization; language changes before and after initialization; granted, denied, pending and rejected permission requests; older initialization and overlapping request completions; missing and throwing APIs; disposal; zero extra database operations or permission prompts on language change; and real paused state, checkpoint, records and native focus preservation.

Two attempts to run the entire native file in one process remain **failed/incomplete**. At 768 MiB heap, 43 cases passed before a worker SIGABRT; the cause was not retained because that attempt filtered nonfailure standard output. At 1536 MiB heap, 111 cases passed before a worker SIGABRT with a fully captured V8 heap-exhaustion diagnostic. Neither attempt reached the new feature cases or qualifies the complete file. No assertion or logical timeout was weakened, and no higher memory budget was used afterward.

The complete source inventory was then covered by disjoint fresh-worker partitions at the same frozen candidate:

| Partition | Top-level registration range           | Cases including nested cases | Result    | Elapsed | Peak runner/worker RSS |
| --------- | -------------------------------------- | ---------------------------- | --------- | ------- | ---------------------- |
| P1        | 1–30                                   | 30                           | 30 passed | 8.34 s  | 1,296,640 KiB          |
| P2        | 31–57                                  | 42                           | 42 passed | 36.20 s | 1,341,424 KiB          |
| P3        | 58–90                                  | 48                           | 48 passed | 68.43 s | 1,247,056 KiB          |
| P4        | 91–109, the selected feature run above | 19                           | 19 passed | 4.67 s  | 667,696 KiB            |

This establishes **partitioned complete coverage of 139/139 cases**, comprising 109 top-level and 30 nested registrations. It is not an uninterrupted full-file pass. The AST inventory and each emitted case-name sequence were checked: every registration belonged to exactly one partition, with no missing, duplicate, extra or skipped cases. P4 reuses the exact selected feature run rather than adding its count again. P1–P3 used 1536 MiB heap, 2048 MiB own-process-group RSS and a 180-second wall guard; none triggered a guard. Existing export-revocation timers completed naturally. All standard output and error were captured without truncation.

The three-path candidate manifest stayed `494c6dc6d7a4b1558270aa50cd0d3bfafe05f430d1d8b6eb1f4cd05c76c5eb4d` before and after every successful run. The test source SHA-256 was `8c20a8037ab0513293d7696c7d0e38a03a6d15ab6414f707e601c747e72a9dd1`; the independently verified ordered registration inventory SHA-256 was `91b3ade46163565c1d57b24c7981565a8cbe3ca87c4eb3958e23240f0a90fa63`. This final qualification update changes only the new document; production and test bytes remain the passing candidate's bytes.

## Actual browser review

At the frozen candidate, localhost Worlds in idle native Settings → Data showed the English storage-ready message. Display → Ukrainian → Data showed the exact Ukrainian message; Display → English → Data restored English. The Data tab retained focus, and Back returned Home with the exact Settings opener focused. The review captured `worlds-storage-494c-uk-after-en.png` and `worlds-storage-494c-en-after-uk.png` in the task's dated evidence directory.

These browser observations do not establish real permission-prompt behavior, database write counts, a paused-flight browser scenario or physical-device behavior. Those modeled behaviors have their native-case evidence above.

## Remaining gates

The changed authored files pass ESLint, the test and this document pass full formatting checks, and the new app ranges are formatted and idempotent while preserving its existing unrelated whole-file formatting debt. Existing support-summary documentation is byte-identical to the parent. Catalogs, package admission, capacity limits and exports are unchanged. Full-source validation, actual built-package qualification and physical-device/offline checks remain separate pending gates.
