# P05 display integration onto P03 — scoped candidate

This candidate applies only P05 commits `4700120`, `f047a46`, `6e1040b`,
`0283677` and `5d3560e` to P03 source
`3acce1941116d18f9e86dcfa26dea463433cd3b2` (tree
`d85af7e5d33100575317078aeba8df57d74fe2d5`). It preserves the current Title,
Missions, Library, mode-return and departure owners. The older P05 audio parent
and later P08 presentation work are not imported. This record does not accept
P03 or P05, allocate a version or qualify a public release.

The [display contract](../../../shared-display-preferences.md) describes the
three-field shared preference record, conservative system reduced-motion
behavior and guarded Solo profile mirror. Each host retains one display
lifetime. The Team conflict combines its current `suspend()`/decision cleanup
with display disposal only on nonpersisted pagehide; it preserves the captured
retry recipe and common mode row. Existing P05 native, font and compact-dialog
records remain byte-for-byte under [the historical package](../p05-a/README.md).

Native inspection found one integration omission: the new Text style and Text
size controls precede touch controls, but Options still focused Player 1 touch.
The only successor runtime change sets the existing Couch screen target to
`race-text-face`. Its host assertions check initial ready/paused focus, no write
or step on opening, exact Back opener and no implicit Resume. A separate
fixture correction enumerates the three current Solo Team anchors, preserving
every fixed href; it does not import the later P03 operation-focus correction.

## Focused source checks

[Verification](retained/verification.json) pins the sixteen changed game files,
all commands, input manifests and the distinct execution scopes. Fourteen
complete files cover shared display state, legacy text preferences, Solo
Title/mode/Library navigation, Couch/Team and shared modal/controller navigation.
They are focused checks, not the full build, producer or release gates.

| Runtime and retained run       | Complete-file scope                                 | Result used                                                                                                                                                                      |
| ------------------------------ | --------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Node 22.22.2 initial run       | Fourteen files                                      | Ten unaffected files passed; the full run was 424/425 because the baseline Team assertion still expected two links.                                                              |
| Node 22.22.2 successor run     | Four affected files                                 | Three Couch/Team files passed (110 cases). The added display assertion read the HUD before its next render; this and its dependent subtest produced the retained 116/119 result. |
| Node 22.22.2 final display run | Complete display host file                          | 9/9 after a zero-time frame refreshes the real paused HUD; no runtime or state oracle was relaxed.                                                                               |
| Node 20.19.5 final run         | All fourteen files on the final runtime/test inputs | 425/425, no failure, cancellation or skip.                                                                                                                                       |

The latest whole-file results cover all fourteen files on both supported
runtimes. Node 22 uses the unchanged ten-file evidence and the affected-file
reruns above; there was no additional final fourteen-file Node 22 run. Do not
add overlapping run counts. All captured before/after game inputs match within
each run. Between initial and final inputs, only the one-line Couch target and
two test files changed. Formatting, lint and whitespace checks passed.

The original failed logs, first Team conflict, finite source/test intake,
three holds and exact pre-documentation guidance bytes are retained. The Team
fixture correction also passed its separate two-file 76-case pair on the P03
correction branch; those tests are not added to this package's totals.

## Desktop keyboard observations

Root recorded [17 events](retained/native-composed/events.json) and eight
original PNGs at **1309 × 1348**. The [native manifest](retained/native-verification.json)
and both preview bindings separate the sources:

- **Events 1–11, port 58349:** exact P03 baseline plus twelve held P05 runtime
  overlays. Solo selects Plain/Large/Reduced; Versus inherits and explicitly
  selects Theme/Standard/full effects; Team inherits and edits while paused;
  explicit Resume retains preferences. Team returns to Solo with shared
  preferences. Team discard and Solo Restart/Stay show the compact dialog.
- **Events 12–17, port 59927:** the same baseline plus thirteen overlays, adding
  only the corrected Options initial target. Ready and paused Options focus
  Text style; Back restores the actual Options opener and keeps the round
  paused; explicit Resume shows both boards with the chosen preferences.

The first preview stayed immutable. All twelve and thirteen served runtime
bodies were checked before and after observation. The final test-only HUD
refresh changes neither preview. This agent verified metadata and original
bytes; Root owns the browser observations and screenshot inspection.

## Limits and retained inputs

Large is a preset, not proof of 200% text scaling. This combined inspection does
not certify narrow portrait, short landscape, zoom/reflow, complete EN/UA glyphs,
physical controllers, touch hardware or assistive technology. Real system-motion
changes, cross-tab storage events and denied writes still need their distinct
native journeys; finite source tests cover those state contracts. Menus and
controls require their own reflow checks independently of the two-dimensional
arena. Later P03 mission-card/Library operation-focus work is absent and requires
separate composition. Current P08 artwork and broader feature phases remain
separate.

[The evidence map](evidence.json) records **63 originals**, retained as exact
metadata/PNG bytes or lossless gzip for logs, diffs and guidance: **2,145,009
retained bytes** from **3,072,693 original bytes**. Every original and retained
hash was rechecked, including decompressed equality. No original archive,
compiled assets, public API operation or bulk download was involved. Existing
historical P05 records were preserved separately.
