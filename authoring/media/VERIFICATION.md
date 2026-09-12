# Media authoring verification — 12 September 2026

The local CLI, validator, four templates and documentation are implemented. No game simulation, upload UI, AI generation or runtime integration was added. Tests ran on Python **3.14.4**; the code uses Python 3.9+ standard-library APIs, but a separate Python 3.9 interpreter was not exercised.

## Executed checks

| Check | Result |
|---|---|
| `python3 -m unittest discover -s authoring/media -p 'test_*.py' -v` | **24 tests passed**. |
| Each of the four example manifests through the standalone `validate` command | **4/4 passed**; each has 27 planned assets and 31 bindings. |
| `--ready` on all four templates, inside the test suite | All correctly rejected because their artwork is unproduced. |
| Separate-process CLI workflow from a different working directory, with spaces in paths | Init → original import → derivative registration → two role bindings → explicit fixture-review records → ready validation passed. |
| Original byte equality before/after the workflow | External source and managed original both retained their exact bytes. |
| Effective-prompt string containing newlines and literal backticks/`$()` | Preserved exactly as metadata; never executed. |
| CLI help | Lists all eight implemented commands and their flags. |

The workflow's AI fields tested provenance registration using generated local test images. No model was invoked and no production asset was marked reviewed. Temporary test libraries were removed afterward.

## Integrity coverage

The tests verify original preservation after the external source changes, refusal to replace produced asset IDs, distinct derivative storage and parent hashes, explicit AI prompt/model requirements, rejection of unsupported provenance combinations, missing/planned parents, ancestry cycles, planned-asset fulfilment without breaking bindings, role/variant reference integrity, duplicate bindings, and rejection of physics fields in visual presentation.

File checks cover tampered bytes, false byte counts/dimensions, managed path traversal/absolute paths/Windows separators, directory and file symlinks, manifest symlinks, existing manifests, refusal to overwrite a conflicting content-addressed file, fake images, locks, duplicate JSON keys and unsupported manifest versions. Readiness requires an explicit review record. Subject allegiance is preserved from planned assets into imports; an invalid enum is rejected, and direct import can record an explicit hostile-military label.

Fixtures include valid RGB PNGs generated with standard-library PNG chunks and compression, plus a valid **28-byte lossless WebP**. The WebP fixture was independently decoded to 1×1 PNG using macOS `sips` during a read-only review. That review found an overly restrictive 30-byte minimum; the parser now uses the format's chunk-specific header bounds, and the fixture has a regression test. No other concrete integrity issue was found in that bounded review.

## What this evidence does not establish

The tool reads raster headers and dimensions; it does not fully decode production images, inspect transparency, validate animation/atlas exports, evaluate visual quality or verify rights. The test suite is not a comprehensive JPEG/GIF/WebP compatibility corpus. A ready media manifest passes this metadata and file gate, not the separate v0.1 content-pack validator, a renderer, a platform build or a gameplay test.

No shipped game, automatic style conversion, upload screen, dynamic preview, semantic image classifier or Z-symbol detector is present. `subjectAllegiance` is an author-supplied declaration. All four supplied templates remain honestly planned.
