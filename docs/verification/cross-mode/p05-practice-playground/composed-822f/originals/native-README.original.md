# Playground c79: bounded actual-browser correction review

17 September 2026. **Scoped browser evidence; not phase or release acceptance.** This additive receipt preserves the original failed browser packet and the final runtime packet unchanged.

Source `170508f11dd41204b7e24917a823f21701c15961`, qualified parent patch `e674b1ba1234f98a1d957345a7d52bf3caf5930c9df8bf7b6488b3842e00f021`, successor patch `c79fd47750a57a7b3aa27dd211ddb5ec9f4f34c8408169a277d7157877cc5d87`. [Admission](admission.json), [served bindings](binding.json), [body reconciliation](body-reconciliation.json). Playground production: 52,707 bytes, SHA-256 `b6cc429d85eb8de198ce9654be27e3762c824fa8b29b45315e4f54b9472d579e`.

The Codex in-app browser used actual pointer, keyboard and select controls on the isolated origin `http://127.0.0.1:63101`. Exact browser engine/version was not surfaced. DOM reads were read-only; no synthetic events, hidden application state, localStorage inspection/writes or injected application calls were used. Practice gameplay and a standalone preferences writer were local only. No physical-touch/controller qualification, build, new runtime cohort, public mutation, source/index edit or release was performed.

## Nine-row result

| Row | Result | Actual observation and limit |
| --- | --- | --- |
| U1 | PASS bounded journey | Fiber relay preset → unapplied Level JSON name draft → final Undo restores First Signal and disables Undo. Active element is selected Wall, next actual Tab moves to Enemy. Child stays revision 2 until explicit Play. Actual initial host viewport 1422×800, DPR 0.9, not the requested 1280×720. |
| U2 | PASS bounded journey | Genuine Scout → Light carrier → Fiber relay changes; selected Enemy brush. First Undo restores bomber and remains enabled/focused; actual Return invokes last Undo, restores Scout and hands focus to pressed Enemy. Brush change paints no cell or history. Child remains revision 2. |
| U3 | NATIVE LIMIT | Ordinary pointer activation acquires Undo focus; a non-owner or hidden/background invocation was not naturally reproduced. Newer-owner/hidden guards remain modeled-test evidence only. No synthetic invocation substituted for native evidence. |
| U4 | PARTIAL | Theme/Standard measured at 390×844 and 844×390; Plain/Large measured at 390×844 and 844×390. Last Undo focuses selected Wall inside viewport; short-landscape screenshots show the ring below feedback. Theme/Large was additionally observed at 351×760, not 390×844. Plain/Standard, full Theme/Large target matrix, meaningful desktop 200% zoom and physical touch/controller remain unqualified. |
| G1 | PASS bounded journey | Startup reports no measurable action boxes, without Infinity/NaN or a false all-visible statement. Actual Start mission yields one measured 44×44 box (Pause), then explicit Pause yields an empty set. Pointer is fine; this does not exercise visible touch direction/action buttons. |
| G2 | PASS bounded journey | Actual paused child captured at 08:32:06.326Z. 12-second server delay on revision 3: all four current viewport/control/launch/arena readouts immediately switch to waiting; prior snapshot is explicitly historical and its 14,903-character DOM string remains identical. At 08:32:43.622Z live values recover without recapture. |
| G3 | PASS bounded journey | Actual server HTTP 503 for revision 4 displays error document. All current measurements become unavailable; no previous success is retained as current. Explicit Play with cleared fault loads revision 5 and recovers live values. Historical snapshot remains identical. Child readiness status initially says waiting; no generic recovery/timeout acceptance is inferred. |
| G4 | PARTIAL | Actual Compact 320×640 and Landscape 844×390 child sizes recover current geometry without changing revision 5. Real playing child reports finite 44×44 Pause box; pause/menu state reports empty action set and correctly labels covered launch actions. Capture remains unchanged. An offscreen nonempty action-box set was not observed; that discriminator remains modeled evidence. |
| R1 | PARTIAL / RELEASE OPEN | Ordinary preset/draft/Undo and explicit Play paths exercised. Existing final runtime packet records 127 leaf cases plus one parent on each allocated runtime and five old-code discriminators; no redundant rerun here. File import was not repeated. Integrated exact-source six gates, build/artifact, deploy and public source/byte/play checks remain the owner's release gate. |

## Responsive observations

| Actual host | Actual style | Focused Wall border box (CSS px) |
| --- | --- | --- |
| 390×844, DPR 0.9 | Theme / Standard | x15.9983 y519.7917, 68.9323×43.9931 |
| 351×760, DPR 1 | Theme / Large | x16 y491.4844, 78×47 |
| 844×390, DPR 1 | Theme / Standard | x132 y269.2344, 69.6016×44 |
| 844×390, DPR 1 | Plain / Large | x132 y288.4297, 73.7656×47 |
| 390×844, DPR 1 | Plain / Large | x16 y545.2969, 73.7656×47 |

Requested viewport override can target the selected browser tab rather than another controlled tab. Every claimed viewport above was read back from that exact DOM. A requested portrait change while the preferences tab remained selected left Playground at 844×390; it is not counted as portrait. Closing the owned preferences tab and applying the override produced the measured 390×844 result. An early Command-0 attempt did not establish a reliable 200% workflow. Browser resizing is not touch emulation.

Practice display settings correctly announce that changes are session-only and do not update the parent. Plain/Large parent tests therefore used the actual standalone game's shared preferences writer on the same fresh localhost origin. The host's body attributes were read back before accepting the observation.

## Geometry detail

Revision 2 Phone startup: launch controls approximately 158×63, 158×63, 158×44; arena 366×274.5, top206/bottom481. Paused capture had 11 registered targets, zero visible targets, null minima, fine pointer media and no page overflow. These are real layout measurements, not comprehensive accessibility assertions.

Revision 5 Compact: 320×640; arena296×222, top206/bottom428; launch boxes123×85,123×85,123×63. Landscape startup:844×390; arena246.7×185, top130/bottom315; three209×44 launch boxes. Playing landscape: arena360×270, top112/bottom382; one44×44 measured control. Opening Game menu pauses the child and labels underlying launch controls as needing scroll or covered. Scaling and snapshots are independent of current child measurements.

## Cleanup and provenance

- Own tabs 7,8,9,10 closed; final own browser tab list `[]`. User/public tabs and other tasks' tabs untouched.
- Shared local preferences and child practice read back Theme (`pixel`), Standard, full effects. Other display/input settings were not edited.
- Final working map First Signal, class Scout, Undo disabled; no unapplied JSON draft. Selected Wall; child revision5. Standalone game remained at Start/briefing and was never played. No claim of zero storage writes is made from browser evidence.
- Final snapshot string equals the original capture. The explicit snapshot content is in the tool transcript; it was not exported to a separate JSON artifact.
- Viewport reset completed. Faults reset to empty. Owned server PID7855/session84605 stopped with exit130; `ps -p 7855` returned absent. Browser lane returned to release owner before public qualification.
- Reconciliation: 2,466 logged records, 2,464 successful body records, 328 distinct bodies, **all matched** exact committed Git bytes or ten admitted overlay pins. One bounded delay and one explicit503. Unknown-path404 responses are not in this harness log; this is not a complete HTTP-error census.

## Remaining advancement gate

The two original regressions (last Undo losing focus and empty measurements yielding invalid minima) are closed for the reproduced actual-browser paths. Complete the explicitly open matrix portions at integration; do not convert partial rows to PASS, accept all P05, or alter frozen v0.60 bytes using this receipt. Original failures, fixture failures and modeled/runtime records remain intact in their original packets.
