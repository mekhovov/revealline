# Original capacity failure and corrected checks

These 124 originals (6,726,365 bytes) are pinned by `copies.json`. They preserve the source, time and scope recorded by each original. They do not qualify the corrected commit or public v0.57.2.

- `failed-local`: candidate `69195ddd` passed its eight preflight/production/build rows, then finished the complete test suite with 4,217 passes and one failure out of 4,218. Its source identity is unchanged. The owned failed build was retired after checking its loose bodies and ZIP checksum; small metadata remains. This was not a successful release-artifact qualification.
- `failed-hosted`: both complete four-shard source families reproduce the same one-test failure. Their 376-file partitions and 12 raw source identities match. Manual freeze was skipped and produced no source artifact. Publisher preview passed separately.
- `diagnosis`: measurements show that the complete immutable replacement fits the existing 4 MiB limit. The original validator overcounts numbers and array indexes. Isolated boundary tests pass 6/10 before and 10/10 after the proposal.
- `corrected-focused`: the applied correction, including the scalar ASCII optimization, passes 224/224 tests across 13 suites. All 132 runtime/test/input pins match before and after. The unchanged production-history test completes review, replacement, export, import and adoption.
- `runtime-review`: independent static review finds no runtime/test blocker. Its original working draft incorrectly anticipated an interrupted suite and still described application as pending. That draft remains as reviewed; `capacity-note-reconciled.md` and the [current verification document](../production-json-capacity.md) correct those facts. The suite finished naturally before any signal; no process was interrupted.

Logs and intermediate diffs retain their original bytes, including whitespace. The corrected source still needs a new complete committed-source qualification and public release checks. P01 remains unaccepted.
