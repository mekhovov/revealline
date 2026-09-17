# P05 — Production and Viewport reading controls

**v0.60.3 source candidate; not a released phase.** Current public baseline remains [v0.60.2](https://mekhovov.github.io/revealline/releases/v0.60.2/site/game/). P03/P05 remain open.

Production and Viewport adopt the shared read-only reading policy without replacing a selected original or child game. Viewport now provides recoverable startup feedback and returns a retiring Reload action’s focus to Game only while that action owns foreground focus. All five preview sizes retain the loaded frame; changing game choice waits for explicit Load. These are local/source authoring tools, excluded from the public runtime include list.

## Verification before final source qualification

- Both complete tool files passed **24/24 on Node 20.19.5 and Node 22.22.2**, using exact ECE runtime dependencies plus the nine-path candidate. See [composition](composition/handoff.json). The version metadata was subsequently bumped to 0.60.3; these are precursor checks, not final committed-source qualification.
- Two P03 regression files contribute **40 passing cases per runtime**: actual finite-host earned Team victory/Retry/return and saved Continue cancellation with late decode rejection. No runtime navigation change was needed. A reviewed successor removes the full successful-route diagnostic while retaining all assertions and compact HUD evidence; its [Node20](p03-team-terminal/quiet-successor/20.19.5/receipt.json) and [Node22](p03-team-terminal/quiet-successor/22.22.2/receipt.json) complete three-case reruns pass. Earlier full-route receipts retain their own prior test hash. Their modeled input evidence is separate from native play. The older cancellation handoff records Node22 as not run at its original cutoff; the additive [Node22 receipt](p03-cancel/runs/candidate-node22/receipt.json) completes that file.
- [Local browser observations](native/native-observations.json) cover actual failed/slow startup, Reload → Game → Load focus, explicit game replacement, all five preset sizes, shared preferences, actual browser Back, original image preview and exact filtered-row return. All 2,761 successful logged responses across 337 paths were rechecked against pinned Git/candidate bytes. Declared fault responses and preliminary observation misses remain identified.
- A separate [public P03 supplement](p03-native/observations.json) verifies genuinely saved Continue → Cancel → Team → Solo with matching earned HUD/progress. It does not establish the modeled delayed-rejection race in a native browser.
- [Integration review](composition/integration-contract-review/review.md) establishes that these seven runtime tool paths do not require new Field Kit derivatives, production-register entries or source-history records. Existing compiler/history bytes remain unchanged.

## Limits and next gate

Native screenshots were inspected inline, not retained as image artifacts. Actual Back recreated the tool and reset its frame coherently; this is not BFCache acceptance. Full 200% zoom, EN/UA and style/input matrices, inactive-window initialization, physical controllers/touch, Safari, offline recovery and human playtests remain open. No complete P03/P05 or public-tool route is claimed.

Run the normal hosted six source gates, full test families, production reproduction/readiness and ordinary build on the final intended commit. Then follow immutable release and Pages acceptance. The separately prepared Team full-picture fix is not included in this correction.

`retained-files.json` pins 47 original copies; originals retain their historical paths and statuses. The server script/binding are observation records tied to the named local cache, not a standalone distribution. The first curation attempt stopped at a .log/.txt filename mismatch; verified existing copies were preserved and the original filenames were used here.
