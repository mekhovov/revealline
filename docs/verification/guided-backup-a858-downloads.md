# Guided backup: scoped native download evidence

Recorded 15 September 2026 against the immutable source preview `a85817ce127d2d9e4e594e671c5f1f573b18265e`, served at its isolated local origin. This is source-preview evidence, not a frozen/public release check. The actual coverage report identifies the development channel and has `sourceRevision: null`; the preview's pinned Git server supplies source identity separately.

The browser operator activated all five visible Download links through explicit keyboard actions. The actual destination files were observed and each component's byte length and SHA-256 matched the downloaded coverage report. Existing Downloads were left untouched; only the proven new files were copied into an owned check directory under the exact report-declared names.

| Report-declared file              | Actual bytes |
| --------------------------------- | -----------: |
| `RevealLine-game-data.json`       |          799 |
| `RevealLine-originals.rlmedia`    |       56,378 |
| `RevealLine-stories.rlstory`      |       15,554 |
| `RevealLine-soundtrack.rlsound`   |          192 |
| `RevealLine-backup-coverage.json` |        2,400 |

The downloaded coverage report SHA-256 is `4fb353ad1b0de64f2e2126a44abbf17129c8545d51f34aef9a2fc08328f32211`. The read-only checker from `f20edf8bb76dee4dd6316f781ba0583424cf1871` returned `verified` on these actual files on Node 20 and Node 22. This was an empty player profile and current saved default metadata, with no custom uploads or recovered detached story originals.

The browser added suffixes to existing names: game data ` (1)`, originals ` (4)` and soundtrack ` (12)`. The checker did not guess or automatically select these files. Keep each set in its own folder with the report-declared names, following [the check command](../full-backup.md#check-files-actually-downloaded).

Raw evidence remains in the owned `guided-backup-a858-preview` record: `actual-component-hash-check.json`, the before/after download inventories and `actual-set-cli-node20.json`, with the Node 22 result recorded by the operator. A stale automation binding produced an earlier 409; restored browser access resolved it, so it is not recorded as an application failure.

This does not qualify custom-image/video/MP3 chooser import, custom-original backup/readback, restore into another origin, earned ownership, audible playback, offline use, other devices or every close/cancel journey. Source tests cover their modeled boundaries separately; see [the current priority register](../delivery-priorities.md).
