# Final route and continuation regressions

20 October 2026. Final serial run after the route-repair, recording-limit and recovery-cleanup fixes.

## Result

**232 passed; 0 failed, cancelled, skipped or todo.** Node 20.19.5; TAP duration 103.323 seconds. All five recorded production source hashes and eight test-file hashes were unchanged between the start and end of the run.

- [Exact invocation, timestamps, totals and source hashes](final-route-continuation-regressions-repaired.json)
- [Complete TAP log](final-route-continuation-regressions-repaired.tap)
- [Earlier 227-test baseline](final-route-continuation-regressions.json), retained as history before the edge-case fixes

The eight files cover mounted Worlds UI, route guides, Studio appearance, native runtime, live actors, recording archives, recording storage and catalogue actor ownership. The JSON records their exact paths.

## Repaired edge cases

| Case | Verified behavior |
| --- | --- |
| Multiple guides became stale after reimport | Studio can repair or remove each independently. Export still rejects the complete bundle until all remaining guides pass admission. |
| An unscored continuation fills its 36,000-frame suffix | Further accepted flight remains playable. Export and saved Continue retain the exact last recorded boundary, with a visible recording-full notice. Later cosmetic state is not attached to that older recovery boundary. |
| Historical Continue cannot preserve the original proof in storage | The detached recovered physics world is disposed, the failed attempt is not activated, and the original proof remains unchanged. |

The run also covers exact-boundary continuation Watch, immutable original proof/export, Acro archive metadata, actual aircraft clearance for authored routes, imported actor IDs and the effective authored encounter minimum.

## Scope and limits

These are automated mounted-DOM/fixture-renderer, native physics, storage/archive and route-validation checks. Expected unavailable-WebGL messages in the log exercise the fixture fallback; this is not browser visual, physical-radio, human-playtest or performance qualification.

No further actionable correctness gap was found in the repaired route/continuation paths during the bounded source review. Route admission checks static clearance; moving actors may still cross a guide. A full continuation retains a bounded recorded interval rather than rolling over into a new recording, and the UI explicitly describes that limit.
