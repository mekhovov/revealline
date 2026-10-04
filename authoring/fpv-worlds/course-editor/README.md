# Project course selection qualification

This manual fixture exercises the actual Workshop with one original eight-course
project, sixteen mode routes, source bindings and reordered shared actor IDs.
The host and generated reaction module are the only source overlays. All other
members are verified against and hardlinked from the accepted 102-file route-mode
player at `d41a251519ccb97dbac3b27bb9eed1718041d70e`.

```sh
node authoring/fpv-worlds/course-editor/prepare-browser.mjs \
  --player /path/to/immutable/accepted/player \
  --out /path/to/new/fixture
```

Serve the new directory over localhost and open `index.html`. Click the Run
button once. The complete receipt is retained in the read-only textarea. A failed
receipt remains a failure; preserve it before changing a fixture. For later
admitted-package qualification pass `--admitted-source FULL_COMMIT`; that path
accepts only the stated descriptor revision and applies no source overlays.

The checks cover every initial course, refusal to discard unapplied JSON,
coordinates and actor fields, harmless tool/preferences changes, per-course mode
memory, fresh Undo history on switching, whole-project exports, retained pack
revisions, native database reopening, source reimport, selected-course Test
flight and world preview, localization, narrow viewport and owned UI disposal.
Preview checks stay disarmed. This fixture does not establish edited route
completion, device performance or offline reopening.

## Source checkpoint

The implementation retains applied course edits in their original project order
and preserves the project title. Switching deliberately starts a new Undo/Redo
history because historical snapshots contain shared project overrides. The
active route scope is remembered per course while that draft is open. Unapplied
form values block switching; the explicit reset action discards only those form
values. The project selector is removed on application disposal.

Independent review corrected two draft defects before browser qualification:
actor selection now resets against the target course, and pending-field detection
excludes persisted cast preferences and tool choices. No unit coverage was added.
Existing content/editor checks pass 13/13, generator `--check` is byte-identical
(25 modules, 24 recordings), scoped production lint and syntax checks pass.
The first content-check invocation could not find the existing `fake-indexeddb`
dependency; the passing rerun used its existing sibling-checkout installation
through `NODE_PATH`, without a new installation or changed test assertions.

Actual browser and package admission remain pending at this source checkpoint.
