# Snake support-summary visit ownership

This phase adds shared lifecycle hooks and applies them to Snake’s existing Settings Data report. Leaving Data for another category, compact navigation, a modal, a breakpoint change, or an inactive page retires the previous observation. Returning to Data requires a fresh Prepare action. An export already requested retains its single owner; its eventual result cannot label a newer report.

The host reuses the existing Settings, dialog, focus and page lifecycle owners. Nested Recovery, tool and music dialogs notify only a newly committed native open. Rejected or already-open attempts do not notify; a successful open still retires the report if initial focus immediately closes the child. No new controller polling, readiness claim, save permission, collector field, locale text or persistent state is introduced.

The shared API and panel behavior reuse the earlier reviewed lifecycle work. Current tool-return focus handling and the separately reviewed controller-presence wording remain compatible. This phase integrates Snake only; other host integrations are separate work.

## Qualification

The proposal was independently source-reviewed against captured main `498a221f312c68f095cfcd282f8a4f7089383b4c`. Sixteen authored files were formatted in a private text workspace; normalized Acorn syntax trees and ordered comments matched their reviewed predecessors. A subsequent test-only correction awaits the public music-library handler before Back, preserving the assertions and existing denied/already-open gestures.

The registered `refresh-fpv-play-shell.mjs` generator authored the canonical JavaScript and passed its unchanged `--check` command from an isolated, exact 49-file text closure. Bytes outside the generated markers and the entire CSS output stayed unchanged. This is source projection evidence, not a package or gameplay test.

**Native tests remain UNRUN. No executed RED/green result is claimed.** Added regression source covers delayed category away/back, actual Recovery open/Back, compact Back, breakpoint changes with outside focus, old export completion, rejected/no-op opens, and transient native opens. Existing assertions are retained. Snake’s native fixture stubs its music host; the music-owner regression uses the actual public library action separately.

This draft is incomplete. Before merge, obtain hosted complete-file tests and applicable source checks, inspect actual Snake Data/modal/navigation behavior in a browser, and complete the relevant full-source/package gates. Physical controllers, device behavior and PWA offline mode are not qualified by this work. Local resource limits were preserved; the text-authoring checks do not lower the native/build reserve.
