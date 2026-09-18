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

`originals-manifest.json` pins the retained unmodified donor, integration and preview records. The historical picker R3 record establishes the original Standard-only observation and missing Large preference. It remains separate from the later combined preview below. The earlier proposal and its manifest are preserved before this native-evidence update.

## Native and release boundaries

The bounded loopback preview uses exact committed v0.61.8 plus only the pinned Still Media HTML entry. Local GET checks establish byte identity separately from the root's actual browser observations. Its server binding, helper, original observation and a dated request-log snapshot are retained; the running log may grow after that snapshot. Screenshots were inspected inline only, so no exported image hashes are claimed.

The root used keyboard navigation to choose Plain, Large and reduced effects in game Settings, then opened **Workshop → Pictures & stories**. Before opening local media, the host had the shared attributes and a 22 px system-font body. A real file chooser selected an owned 46,655-byte, 768×576 PNG; metadata entry and **Preview chosen file** were followed by five reverse Tab steps to the picker.

At 390×844, the file control measured 20 px, occupied y=425.265625–492.265625, and its label began at y=365.265625 below the rail ending at y=292. After resizing to 844×390, the control occupied y=227.765625–294.765625 and its label began at y=194.765625 below the rail ending at y=187. The complete focus outline stayed visible, and the selected image, draft, focus and preferences were preserved.

This is a scoped native pass for exact v0.61.8 plus the pinned HTML entry, not a final v0.61.9 or public-build pass. The initial Tab starting position was not established, so no complete dialog navigation journey is claimed. The game had already initialized one authored picture record/revision at generation 1 before preview; no Save assignment, Restore, Delete or earned award was performed. Settings changes are saved preferences, so this journey does not imply zero storage writes overall.

Modeled lifecycle/geometry tests do not certify actual background return, BFCache, assistive technology, zoom or physical controllers/touch. Full source gates, packaging, public deployment and affected public journeys remain required. The separate local-connections Close focus issue and the broader P03/P05 phases remain open.
