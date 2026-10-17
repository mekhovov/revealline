# Recurring controller UI work — 17 October 2026

The Solo visibility helper now assigns `hidden` only when the actual current node needs a change. It still looks up the current node on every call and returns the same boolean. This removes the controller hint's repeated visibility assignment during ordinary callbacks without changing input polling, navigation or presentation transitions.

The shared Toggle Boost cue now caches its caption per element, using locale, visible mode, latch, mapped button label and availability. Locale notifications update the caption even while its owner is paused; later frames reuse that translation. Changes and externally replaced text/visibility are still repaired immediately. A weak element key avoids retaining retired controls. No simulation, input edges or controller sampling changes.

Actual source operation counts with modeled DOM boundaries:

| Repeated operation                                   | Before | After |
| ---------------------------------------------------- | -----: | ----: |
| 1,000 unchanged hidden-hint assignments              |  1,000 |     0 |
| Next visible transition                              |      1 |     1 |
| Translations for 120 unchanged Toggle Boost captions |    240 |     2 |
| Caption text writes in those 120 calls               |      1 |     1 |

These counts demonstrate removed work, not measured browser layout, energy use or a device frame-rate improvement. The earlier 115-file package does not contain this later source.

The four complete Boost files pass 78/78, the complete pause/navigation host file passes 5/5, and the package-policy file passes 10/10. Scoped lint and formatting pass; all 597 app and nine Boost translation references remain unchanged. The package gate now includes 117 files, adding the two complete affected UI regression files.

The original pause-host run failed one of five assertions because it read the previous rendered state immediately after a public click. The exact pre-change app source fails the same assertion. Both failures are retained. The corrected test first requires the public paused state, then submits a zero-elapsed modeled callback before checking the rendered state. Run identity, checkpoint, focus, navigation and all original deadlines remain checked. This corrects an observation boundary; it does not waive a runtime failure.

Raw counts, exact before/after source hashes, full test output and checks are retained under `.cache/solo-followup/recurring-ui-visibility/receipt.json`. Native confirmation and the next complete production package remain required.
