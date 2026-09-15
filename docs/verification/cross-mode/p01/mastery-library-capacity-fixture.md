# Mastery Library capacity fixture correction

Source `00d960aa68c48d01cd6ef1d43ba842ae51641c0c` failed the combined-Library capacity assertion in [manual run 34986511485, shard 4](https://github.com/mekhovov/revealline/actions/runs/34986511485/job/104441106564). The test expected `LibraryCapacityError` at `game/test/mastery-library.test.mjs:376`. This failed source cannot qualify v0.57.2.

An isolated reconstruction used the original completed run, 4,096 gallery entries and 4,096 unique mastery records. Independent UTF-8 serialization measured:

| Fixture                                          |     Bytes |
| ------------------------------------------------ | --------: |
| Gallery library alone                            | 1,405,181 |
| Original mastery library alone                   | 2,546,099 |
| Original combined library                        | 3,950,672 |
| Mastery library with valid 159-character run IDs | 3,137,033 |
| Combined library with those run IDs              | 4,541,606 |
| Unchanged quota                                  | 4,194,304 |

The original union fits, so import, mastery addition, merge and save correctly accept it. The test-only correction extends existing run IDs within their validated limit; seed/setup uniqueness, class histories and counts remain unchanged. It asserts actual standalone and combined encoded sizes before the existing typed rejection and unchanged-byte/no-write checks. Runtime behavior, quotas and immutable records are unchanged by this fixture correction.

The isolated diagnostic confirmed that the larger union is rejected and a failed save writes nothing, preserving exact prior bytes and input objects. It also accepted exactly 4,194,304 bytes and rejected 4,194,305. The first diagnostic's overly narrow object-import error-class expectation is retained as a harness failure; the corrected diagnostic distinguishes the existing wrapper error from the typed Library error. No runtime error translation change is proposed.

Original evidence remains under `.cache/cross-mode/p01/v0572-capacity/mastery-library-fixture-diagnosis/`. Its `receipt.json` is 3,018 bytes, SHA-256 `d4bae82014961588bd0321512cf9ea62e3434f4078b1bc9d20ade91f2ed11ed5`. The original hosted log is `.cache/cross-mode/p01/v0572-capacity/hosted/manual/job-104441106564.log`, 392,861 bytes, SHA-256 `7de65577e3d6a0367dfee4b0b85fe02969aac71ebbf5cb45a43305786526982c`. Preserve these originals in the later release evidence attachment; this compact note does not duplicate the raw logs.

The same assertion was the sole failure in the natural full local run of `00d960aa`: 4,228 tests, 4,227 passed, one failed, with zero cancelled, skipped or todo. Raw source identity matched before and after; no process was interrupted. Its original log is retained at `.cache/cross-mode/p01/v0572-capacity/exact-source/npm-test.log`, 987,931 bytes, SHA-256 `be08406a04c9b6ba90595383e528493f73079b2377fb37c68dc62d416ea37219`.

After applying the reviewed fixture correction, the actual JSON, Library and mastery source suites passed all 60 focused tests in 6.33 seconds. The eight selected test/runtime pins matched before and after; this is not a complete dependency inventory. The focused log is `.cache/cross-mode/p01/v0572-library-boundary/focused/test.log`, 14,146 bytes, SHA-256 `4cfc41d3cba48ab360bc6a15182c2581069c9a331e55c9ecafd0e74477f719c8`. The earlier [224 checks](production-json-capacity.md) and isolated diagnostics retain their distinct scopes.

The next committed source still needs complete exact-source qualification, then immutable release and public verification. v0.57.2 remains unused and unreleased. P01 remains unaccepted; P02 is queued.
