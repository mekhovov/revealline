# Snake support-summary visit ownership

This phase adds shared lifecycle hooks and applies them to Snake’s existing Settings Data report. Leaving Data for another category, compact navigation, a modal, a breakpoint change, or an inactive page retires the previous observation. Returning to Data requires a fresh Prepare action. An export already requested retains its single owner; its eventual result cannot label a newer report.

The host reuses the existing Settings, dialog, focus and page lifecycle owners. Nested Recovery, tool and music dialogs notify only a newly committed native open. Rejected or already-open attempts do not notify; a successful open still retires the report if initial focus immediately closes the child. No new controller polling, readiness claim, save permission, collector field, locale text or persistent state is introduced.

The shared API and panel behavior reuse the earlier reviewed lifecycle work. Current tool-return focus handling and the separately reviewed controller-presence wording remain compatible. This phase integrates Snake only; other host integrations are separate work.

## Qualification

The proposal was independently source-reviewed against captured main `498a221f312c68f095cfcd282f8a4f7089383b4c`. Sixteen authored files were formatted in a private text workspace; normalized Acorn syntax trees and ordered comments matched their reviewed predecessors. A subsequent test-only correction awaits the public music-library handler before Back, preserving the assertions and existing denied/already-open gestures.

The registered `refresh-fpv-play-shell.mjs` generator authored the canonical JavaScript and passed its unchanged `--check` command from an isolated, exact 49-file text closure. Bytes outside the generated markers and the entire CSS output stayed unchanged. This is source projection evidence, not a package or gameplay test.

Hosted exact-head checks of the first draft (`41d0b3a97748d90708b1dcdea0cf9c9884fccac4`) ran the complete Snake file: 155 cases passed and one failed. The new retention regression correctly exposed an unnecessary report reset during a desktop resize. This successor keeps desktop layout bookkeeping while notifying view changes only where compact presentation actually changes; breakpoint notifications remain intact. The original failing assertion is retained, and a focused desktop-panel notification regression is added. Terminal old-head whole-file results also passed for global Settings tools (19/19), Settings panels (15/15), mode Settings view (7/7), and couch menu music (23/23). Their full TAP and before/after source audits are retained separately; they do not qualify this successor.

A second new old-head case failed in the complete Recovery file (14/15 passed): it closed only the raw dialog, bypassing Recovery’s public close owner. The successor invokes actual Back during the committed native open and awaits its close promise; all three original assertions remain.

**Local native tests remain unrun, and the corrected successor has no hosted green result yet.** Added regression source covers delayed category away/back, actual Recovery open/Back, compact Back, breakpoint changes with outside focus, old export completion, rejected/no-op opens, and transient native opens. Existing assertions are retained. Snake’s native fixture stubs its music host; the music-owner regression uses the actual public library action separately.

This draft is incomplete. Before merge, obtain hosted complete-file tests and applicable source checks, inspect actual Snake Data/modal/navigation behavior in a browser, and complete the relevant full-source/package gates. Physical controllers, device behavior and PWA offline mode are not qualified by this work. Other old-head hosted results are recorded separately and do not qualify this corrected successor. Local resource limits were preserved; the text-authoring checks do not lower the native/build reserve.
