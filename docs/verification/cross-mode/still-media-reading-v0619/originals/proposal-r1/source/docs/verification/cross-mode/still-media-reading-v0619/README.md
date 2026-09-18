# P05 — Shared reading preferences in Still Media, v0.61.9 candidate

The standalone Pictures & stories workshop adopts the game's saved text size, font and reduced-effects preferences. A one-line HTML module entry reuses the existing tool-display owner; it adds no new settings store, media operation or editor lifecycle.

This candidate is based on committed v0.61.8 source `0ae4330b8a87d332051db112f5e09b7c3cbef9fa`, tree `bea7eebf35befcae0362b19f7ecfbb75a3942b00`. It preserves that release's picker correction and every prior guide/skill line. The seven feature/version paths include the shared entry, four actual-host tests, guide/prompt additions and three synchronized version files. No commit, source qualification or public acceptance is implied by this proposal.

## Behavior and evidence

- Saved reading preferences apply before **Open local media** without opening the media database or writing a preference.
- Updates preserve the selected original, unsaved metadata, preview ownership, focus and stored generation. Tests use the real media host, store and module entry selected by the actual HTML.
- A cached-page return refreshes missed preferences without reopening the media panel. Terminal departure retires subscriptions and deferred repair; retained callbacks remain inert.
- The missing-entry regression fails on the unchanged HTML. The final donor cohort passes 54 tests on both Node 20.19.5 and 22.22.2. The integrated reading and v0.61.8 picker cohort passes 101 tests on each version, with no failures, skips, cancellations or TODOs. Scoped lint, formatting and diff checks pass.
- The first test harness depended on an experimental VM flag. Its ordinary-Node failure is retained. The final harness imports the real entry without special flags; the final RED and GREEN receipts pin its current bytes. Earlier outcomes are historical and are not substituted for final checks.
- Initial integrated input pinning stopped before tests because one newly inherited picker dependency was absent from the sparse checkout. Its exact 2,645-byte Git object was hydrated, then the integrated cohort ran successfully. This was a preparation refusal, not a runtime failure.

`originals-manifest.json` pins the retained unmodified donor, integration and preview-preparation records. The historical picker R3 record establishes the original Standard-only observation and missing Large preference. It does not establish native behavior of this candidate.

## Native and release boundaries

The bounded loopback preview uses exact committed v0.61.8 plus only the pinned Still Media HTML entry. Local GET checks prove byte identity, not interaction or layout. Its server binding and helper are retained; the live request log remains with the running preview. Browser review must choose Large/Plain in the same-origin game, enter **Workshop → Pictures & stories**, and measure the actual control font and label/focus clearance in portrait and short landscape. It must separately verify updates with an owned preview, lifecycle behavior and the native picker fix.

No new native browser acceptance is claimed here. Modeled lifecycle/geometry tests do not certify actual BFCache, assistive technology, zoom or physical controllers/touch. Full source gates, packaging, public deployment and affected public journeys remain required. The separate local-connections Close focus issue and the broader P03/P05 phases remain open.
