# Current authoring input qualification

These cases extend the historical authoring controller runner. Their presence is
not a passing receipt. Retain the actual run date, source revision, browser,
language, viewport, JSON result, and downloaded artifact separately. A virtual
standard pad proves the browser input path; physical controller and operating
system file dialogs remain separate gates.

The runner uses controller button pulses to navigate and activate real controls.
Selectors describe expected destinations; they never focus or click a tool control.
The initial iframe focus only establishes the test host. Export observation wraps
`URL.createObjectURL` without changing its result or the download behavior. Actual
export bytes pass the production validator and receive a SHA-256 receipt. No
domain handler is invoked by the browser fixture.

Keyboard mode also exposes `#focus-evidence`, a bounded read-only trace of the
tool and child documents' actual focus/visibility and native window focus/key
events. It retains at most 80 capture/post-dispatch observations, does not focus
or activate anything, and replaces its listeners when Run is used again. This
distinguishes late child-window boot focus from queued keys delivered after the
parent has already reclaimed focus.

## Enemy Workshop

Open `/game/test/manual/authoring-controller.html?tool=enemyCurrent` and run.
The production router receives ordinary virtual standard-pad pulses, including
the workshop's initial join edge. The case selects the registered eroder role,
changes its skin/detail style/availability, cancels a select draft, and tests the
multiline Catalog choices JSON editor. Cancel retains the original text;
invalid JSON is rejected without changing the catalog or local storage. Show
current choices restores authoritative JSON. Validate and import changes only
the draft; Apply authoring choices is the separate persistent Save action.

The case saves exact edited choices, reloads them after a further change,
closes/reopens the dialog, explicitly prepares and enters the real practice
game, and selects its authenticated Return to workshop action. The final real
JSON export passes `validateEnemyCatalogDraft` and must match the saved choices.
The receipt includes byte length and SHA-256. At the end, explicit **fixture
cleanup** restores the exact pre-run Enemy localStorage and Playground
sessionStorage bytes, including key absence. Cleanup is not controller input
or evidence of an editor command; no player save or other draft key is touched.

Enemy Workshop authors registered role availability and visual presentation.
It does not author new behavior or geometry; the role descriptions are fixed.
Content Studio and Mission Playground remain the tools for those edits.

For native keyboard add `&keyboard=1` and Run. No virtual pad is installed.
Open workshop if startup leaves it closed. Export original choices before a
manual Save if an existing catalog matters. Use Tab/Shift+Tab with native
select keys to choose a role, Presentation, and Detail treatment. Disable and
reenable the role and verify Try selected role follows availability. Open
Catalog choices JSON, Show current choices, and append an invalid character in
the native textarea. Validate and import must reject it; Show current choices
must restore the unchanged catalog. Apply valid JSON, separately Apply authoring
choices, change a select and Reload saved choices. Close/reopen, Try selected
role, Enter preview, then select Return to workshop in the child briefing or
pause menu. Verify the same choices and parent focus. Export and retain the
actual downloaded `.json`; validate its bytes with `validateEnemyCatalogDraft`.
Native text editing uses the browser's textarea rather than the controller
on-screen keyboard. OS file-picker import, physical-controller input, and
device gameplay remain separate qualification boundaries.

## Asset Studio

Open `/game/test/manual/authoring-controller.html?tool=assetCurrent`, activate
**Run controller workflow**, and keep the real tool iframe in the foreground.

The case creates a sprite for the selected slot, cancels an unfinished line,
draws a new line, checks Undo/Redo, rejects missing provenance, cancels an edited
text draft, stages valid provenance, saves the local workspace, reloads the
saved revision, and requests a theme export. The final receipt validates the
actual bundle, hashes, decoded images, and retained asset provenance.

This test intentionally saves a new local Studio revision. It does not clear an
existing Studio workspace or player saves. Use a browser profile dedicated to
qualification when preserving unrelated local authoring work matters.

For the separate native-keyboard journey, add `&keyboard=1`, then activate Run.
No virtual pad is installed. Use Tab/Shift+Tab and native Enter to reach the same
controls. In the pixel canvas, arrows move, Space sets/commits a line point,
Escape cancels an unfinished point, and Ctrl/Cmd+Z undoes. Verify that a canceled
line leaves no Undo entry. Enter provenance using native text editing, first
attempt staging with missing provenance and confirm the draft is preserved,
then complete the fields. Save, Reload saved, and Export. Record the visible
revision and actual `.rltheme` download; do not count a download request alone as
an operating-system download receipt.

## Mission Playground

Open `/game/test/manual/authoring-controller.html?tool=playgroundCurrent` and run.

The case paints and undoes a map cell, repeats the edit, exports, cancels a JSON
draft, rejects malformed complete JSON without replacing the model or preview,
restores the authoritative complete source, and reopens it through the normal
validator. It explicitly launches practice, enters the preview, returns via the
child's real Return action, and exports again. The final receipt validates the
actual JSON download bytes and checks their equality to the displayed complete
pack. The tool has no independent persistent workspace Save; its supported
reopen path is complete JSON/import.

For native keyboard use `&keyboard=1`. Tab to the map, use arrows and Space to
paint, Escape to leave, then Undo. Repeat the edit and Export. In Complete pack
JSON, append an extra character and Apply content JSON; verify the rejection
preserves the map and preview. Show current pack restores the valid source;
Apply content JSON reopens it. Activate Play configuration, Enter preview, open
the child menu if needed, and activate Return to editor. Verify focus returns
to Enter preview, then export again. Retain the JSON download and validate it
with `validateScenario`; OS file-picker reimport is a separate platform check.

## Automated boundary coverage

`asset-studio-sprite-input.test.mjs` runs the actual Sprite panel with its shared
controller adapter and native keyboard handlers. It asserts cancellation,
history, focus, and exact RGBA bytes submitted to the encoder; it does not claim
browser PNG decoding.

The current map-edit test in `playground-import-host.test.mjs` runs the real
Playground module and domain commands, checks invalid/valid complete JSON,
and proves that storage and preview change only on explicit launch. Shared
authoring tests cover a single input poller and native/virtual Confirm ownership.
