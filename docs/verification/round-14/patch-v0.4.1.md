# Repeat file selection correction — v0.4.1

The frozen v0.4.0 release imported a complete backup successfully, and Undo restored the previous collection. Selecting that exact file again did not start another import: the file input retained its previous selection, so the browser did not dispatch a new change event. v0.4.0 remains preserved; this correction receives a separate version.

Save and pack import handlers now capture the selected File, clear the input immediately, and then perform their existing asynchronous validation and adoption. The authoring playground's content, artwork and replay pickers and the motion lab's background picker follow the same sequence. Cancellation is a no-op. Import limits, validation, transaction recovery and Undo remain in force. Replay Theater already used this sequence.

## Real browser regression

The isolated v0.4.1 candidate at port 8796 imported the 11,398,487-byte complete backup exported during Round 14. It restored eight pictures, three campaign histories and four expansion packs. Undo returned the initially empty profile to zero pictures; choosing exactly the same file again started validation and restored all eight pictures. The file input was empty after both selections. These actions used the browser's actual native file chooser, not a programmatic change event or direct storage mutation.

The backup SHA-256 is `e4dc9786a842930975d48060dad8550d6a4c0090d8a98114e85b80e253b5da57`. Its Homeward Skies pack matches the shipped pack, including the original three embedded PNGs.

The Homeward Skies pack was also removed, installed through its native file picker, removed again and installed from the exact same file. Both installations completed with the input cleared and the chapter available. The preserved earned collection was not removed with the pack.

After rebuilding the candidate, normal solo play was checked with the saved-flight action visible at browser viewports of 320 × 640 and 844 × 390. Both Load saved flight and Start mission remain fully visible at 44 pixels high. The document widths match the viewports without horizontal overflow. Explicitly choosing Copper Orchard brings launch controls into view. The viewport override was reset afterward. These are browser viewport tests, not physical iPhone or controller results.

| Viewport | Saved-flight bounds (x, y, width, height) | Start bounds |
| --- | --- | --- |
| 320 × 640 | 27, 317.95, 130, 44 | 163, 317.95, 130, 44 |
| 844 × 390 | 247.67, 268.57, 148.66, 44 | 406.34, 268.57, 148.66, 44 |

Screenshots: [phone launch](screenshots/patch-phone-ready.jpg), [landscape launch](screenshots/patch-landscape-ready.jpg). The broader six-size workshop checks and illustrated chapter observations remain in the [Round 14 report](../round-14.md).

The [patch source gates](patch-v0.4.1-source-gates.md) passed: 605 game tests, 70 Motion Lab tests, lint, formatting, syntax and validation. The preserved [v0.4.0 integrity results](integrity-notes.md) establish the earlier snapshot's identity and reproducibility. Patch source and frozen-artifact verification are recorded separately, without overwriting earlier evidence. Native wrapper version metadata is updated; this does not reclassify earlier native artifacts as v0.4.1 builds.
