# Explicit route mode qualification

The Workshop route selector offers Self-level, Acro, and Both matching modes. Both is available only while the two ordered criterion arrays match. A new divergent project opens on Self-level; the author can explicitly select Acro. Selection affects numeric and spatial movement, criterion order, duplicate/delete, actor-objective focus and the two authoring flight previews. Undo and Redo restore the mode and selection captured with the course snapshot. Switching modes alone does not add history or alter course data.

Single-mode changes remain in that course's mode array. They do not move a shared source anchor. Both can update one shared source override only when the two routes match and the corresponding bindings identify the same source anchor before and after the edit. Equal coordinates with different source IDs do not establish shared ownership. External source reimport keeps the existing per-mode three-way merge and preserves the selected editor mode.

The selector is editor UI state, not a new project field or persisted preference. Reopening a divergent project chooses Self-level again and retains both route arrays exactly. Multi-course selection remains a separate limitation: these checks use standalone projects with one editable course. Preview world continues to preview the project's first course. No identity, revision, physics, reward or pack-limit change is made.

## Manual source fixture

```sh
node authoring/fpv-worlds/mode-editor/prepare-browser.mjs \
  --player /absolute/path/to/fpv-world-disposal-admitted-player-d9ad2561e \
  --starter /absolute/path/to/creator-industrial-split-level.zip \
  --out /absolute/path/to/new-fixture
python3 -m http.server 8886 --bind 127.0.0.1 --directory /absolute/path/to/new-fixture
```

Use the accepted r5 Industrial Split Level ZIP (SHA256 `dbf62085ac11aca531d70fd445fa00f8beb597aa7728a01f436b2dd495a05091`). The preparer checks all 102 baseline package members and makes immutable hardlinks for 101. It writes the current `world-app.mjs` as a separate overlay, retaining the original manifest only as baseline evidence. The result is **not an admitted package**. `fixture.json` records the exact source commit, host hash, input hashes, and harness hashes; the browser verifies each served member before interaction. An existing output directory is never replaced.

The public fixture inputs include the original starter, two tiny original semantic GLB projects, and a changed external GLB. The source projects have either a shared gate binding or different gate binding IDs at identical coordinates. Every functional change enters through a normal file input, selector or button. Storage instrumentation prefixes the host iframe's own native IndexedDB factory; the parent only reads persisted records using its own factory. The fixture collects real exported blobs without triggering downloads. It does not assign private editor or flight state.

Click **Run explicit mode and ownership checks**. Stage one verifies:

- Exact imports and independently ordered, unequal-length Acro/Self-level routes.
- Acro-only numeric movement, order, duplicate/delete and history, including switching the visible mode before Undo/Redo.
- Matching Both changes, one shared override delta, and unchanged global overrides for different binding IDs or single-mode edits.
- Reviewed external GLB reimport retaining local Acro edits while updating untouched Self-level source data.
- Both preview buttons selecting explicit Acro, remaining disarmed, supporting the shell Home pause/cancel path and normal flight close and retaining editor mode.
- English/Ukrainian labels, the selector at 390px width, Library/Workshop navigation and native-IDB reopening.

Stage one stops with an Acro upper gate selected. Use the real pointer to drag a translation arrow by a small distance, then click **Check spatial edit and Undo/Redo**. The second stage requires trusted pointer events, checks that only the selected Acro criterion moved, verifies Undo/Redo, editable ZIP round trip, exact pack installation with retained original revision, and native-IDB reopening. Final disposal must remove the captured owned route-mode label and select.

This fixture does not claim ordinary-control completion of edited courses, offline acceptance, physical-device input, performance, public-launcher availability, or package-size admission. Those require separate evidence. Preserve failed fixtures and their receipts. No additional unit coverage is introduced here.
