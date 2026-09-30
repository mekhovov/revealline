# Current edition package closure

All **14 editions passed** the final in-memory package check on 2026-09-29. The
[compact receipt](edition-packaging-2026-09-29.json) records each output count,
byte total and inventory hash. These results qualify captured working-tree
inputs whose runtime and compiler files match committed `7341e3cdf`. They do not
qualify a published release, an installed offline journey, native packaging or
physical-device behavior.

## Source capture and scope

The checker ran from **2026-09-29T02:34:11.485Z** to **2026-09-29T02:34:47.644Z**.
HEAD was `7341e3cdfd7c2fda474b5069a691b7033eb4f782` at both ends. The earlier receipt
used pre-correction HEAD `651d57190a189d5acfab161b2470a9d5e5dcaf9e`; this
rerun follows the commit containing the compiler correction. All 827 captured
input hashes and the six compiler/checker implementation files were independently
compared with the Git blobs at `7341e3cdf` and matched.

The `game/`, `scripts/` and `authoring/` trees were clean in independent
observations at 2026-09-29T02:34:32.040Z (during the run) and
2026-09-29T02:35:22.855Z (after completion). Only documentation was dirty.
The report also verifies the initial captured runtime bytes and final rereads
are identical. This remains a working-tree capture with committed runtime and
compiler inputs, rather than a published release receipt.

The checker captured **827 input paths**, including **566 engine files**,
selected edition inputs and the offline launcher's direct-read module/locale
closure. Every captured path was reread at completion; no changed repeated read,
missing input or final hash difference was observed. The aggregate input hash is
`892dc56f87beef9a736289af9a5f2a290dd0d4f93278da16b8fdf7854ff304af`. The complete path/hash list remains in
`/private/tmp/edition-package-matrix-committed-20260929.json`; the committed receipt retains its digest and summary.

The existing build version **0.142.3** is metadata only. No version file
was changed and no output directory, installation or publication was created.
The check preserves normal public-asset admission and executable dependency
validation. Every edition includes its selected menu scenes, shared native menu
files and Departure Mono font/license. Each excludes multiplayer scene images
and `game/test/` fixtures. Final counts include generated workers, offline
metadata and `edition-build.json`, under the unchanged **2,000-file / 64 MiB
(67,108,864-byte)** limits.

## Failure found and correction

The first completed valid-version matrix passed 13 of 14 editions and refused the
DroneAid Netherlands aggregate at the final byte cap. A separate diagnostic
working-tree compile measured **67,260,781 bytes**, or **151,917 bytes over**;
its cache inventory alone was 66,980,322 bytes. The root worker, offline manifest
and build manifest were added after the earlier cache-inventory budget check.
Those diagnostic bytes used a diagnostic source-revision label; they are not an
exact immutable-candidate receipt.

Company packages also carried a **485,216-byte default FPV wordmark** even though
company HTML and landing titles already use their selected brand. The compiler
now points the shared helper's fallback URL and resource entry at the selected
approved logo and omits the unused default wordmark from that standalone closure.
The default game retains its original artwork. Selected company logo bytes,
gameplay, historical presentation bytes and the independent stable launcher are
preserved; no JavaScript minifier, art recompression or budget increase was used.
A production guard now checks the final Map after all generated files are added.

The final captured DroneAid aggregate passes at **668 files / 66,775,005 bytes**,
leaving **333,859 bytes** under the cap. This final matrix supersedes the
intermediate diagnostic totals.

| Edition                        | Final files | Final bytes |
| ------------------------------ | ----------: | ----------: |
| coupa-all                      |         630 |  61,640,562 |
| coupa-adventure                |         597 |  27,736,366 |
| coupa-culture                  |         598 |  26,187,008 |
| coupa-foundations              |         599 |  28,615,153 |
| coupa-operations               |         599 |  27,760,983 |
| coupa-developers               |         599 |  29,586,311 |
| droneaid-community             |         592 |  26,962,513 |
| droneaid-nl-community          |         668 |  66,775,005 |
| droneaid-nl-workshop-lights    |         600 |  27,800,951 |
| droneaid-nl-parts-in-motion    |         604 |  29,579,795 |
| droneaid-nl-makers-together    |         602 |  29,061,633 |
| droneaid-nl-careful-handoff    |         602 |  29,186,201 |
| droneaid-nl-signals-of-support |         602 |  29,173,011 |
| droneaid-nl-shared-horizon     |         602 |  29,372,620 |

## Reproduction and regressions

Run with the repository-supported Node version; this check used Node 22.22.2:

```sh
node game/test/manual/edition-package-check.mjs > /private/tmp/edition-package-matrix.json
node --test game/test/editions.test.mjs game/test/edition-runtime.test.mjs scripts/test-edition-offline.mjs
```

The focused compiler/runtime/offline suite passed **46/46 tests**, including
all-14 selected-logo projection, original logo/source preservation, the final
2,000-file boundary, rejection at 2,001 files, and refusal when generated files
push a previously acceptable cache inventory beyond 64 MiB. Scoped ESLint,
Prettier and diff checks passed. The regression log is
`/private/tmp/edition-brand-budget-regressions-20260929.log`.

The output is in-memory static evidence. It does not start the generated
launcher or service worker in a browser, write a retained-release directory,
exercise native signing/staging, or establish hardware/controller acceptance.
