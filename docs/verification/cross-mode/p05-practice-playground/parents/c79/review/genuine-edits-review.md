# Genuine class-edit regression review

Static review completed 2026-09-17T07:55:50+00:00. Reviewed the current runtime proposal against `review/test-before-genuine-edits.mjs`, the preserved first-run test, and the actual Playground handlers. This review did not run tests, format files, use a browser, or change production/test sources.

**Disposition: the initial blocking test mistake is corrected; no remaining blocking mistake was found in the strengthened class-edit assertions.** Runtime results belong to the parent's separately recorded execution lane.

## Corrected finding

The first strengthened version read `JSON.parse(level-json.value).settings.classId`. That textarea contains only `current.level`, so this incorrectly tested a scenario-level setting on a level object. The actual production `sync()` assigns the class selector from `current.settings.classId` and serializes `current.level` separately. The first failed-run test and receipt remain preserved; they are not production-defect evidence.

The current helper no longer makes that assertion. It requires the next class ID to differ from the current selector, assigns the new value, and calls the real `onchange` handler. The real handler remembers the previous complete scenario and then changes `current.settings.classId`. Its immediate selector assertion is not independent proof of internal mutation; the subsequent Undo assertions supply the meaningful proof by reading the selector repopulated by the real `sync()`.

## Final assertion review

- The one-history case makes Scout → `bomber`, then verifies the real Undo restores Scout, disables the exhausted action, and hands its retiring focus to the selected Signal brush. The deliberately unapplied level JSON draft is reset to the original working-map JSON, matching the existing Undo contract. Frame URL, frame writes, session writes and saved scenario remain unchanged until explicit Play.
- The two-history case makes Scout → `bomber` → `fiber`. First Undo restores `bomber`, leaves Undo enabled and retains its focus. Second Undo restores Scout and disables Undo. Both preserve preview identity. This now exercises different real configuration states rather than recording the same value twice.
- The unrelated-editor, newer-focus, hidden-document and unfocused-document cases all make a genuine edit and verify Scout restoration alongside their focus guard and unchanged preview assertions. The newer-focus callback models another owner acquiring focus when the disabled action retires.
- The unavailable-brush case restores Scout and expects the existing Play configuration action to receive focus; it does not activate that action. The coordinate-paint fallback is explicitly modeled unavailable because the minimal DOM does not implement closed-details layout.
- The preserved geometry assertions retain their prior scope. The diff there is formatting only; no new geometry behavior is inferred from this class-history review.

The class IDs are valid. For native instructions, `bomber` is displayed as **Light carrier**, and `fiber` as **Fiber relay**; use those visible labels rather than assuming the UI says Bomber.

## Evidence limits and remaining native checks

This is an actual-app host regression harness: production initialization and event handlers run, while focus retirement, visibility, document focus and layout are modeled explicitly. Direct handler calls and modeled clicks are not real keyboard, touch or controller evidence. The source review establishes the tests' intended contract, not execution success.

Native recheck still needs the genuine Light carrier/Fiber relay edits, first and final Undo, next keyboard action after final Undo, another editor retaining focus, and the unchanged child preview/revision until explicit Play. Background focus guards remain modeled until tested in an admitted native lane. Geometry, public routes, physical devices, BFCache and full-game acceptance are not established by this review.

## Read snapshot pins

Production bytes match the original static successor exactly; only the runtime packet's test assertions were revised by the parent. These hashes identify the source read for this review and do not freeze later formatting or runtime receipts.

| Input | SHA-256 | Bytes |
|---|---|---:|
| preserved test before genuine edits | `da8f589dde7e433c17ace86c78a60cfc5aa6b0a7f0e95db99dc687ae89ff92ed` | 38417 |
| preserved first failed-run test | `0cdb45447c1ee377049bfdb99cc513ae395f31d6f95bc84e5ae61d3d476875de` | 39216 |
| corrected proposed actual-app test | `7da7af6e53b18e72cbb957585806ac2d7350b0547f71d8132b067bc7ca49a008` | 39079 |
| proposed production module | `b6cc429d85eb8de198ce9654be27e3762c824fa8b29b45315e4f54b9472d579e` | 52707 |
| original static successor production | `b6cc429d85eb8de198ce9654be27e3762c824fa8b29b45315e4f54b9472d579e` | 52707 |
