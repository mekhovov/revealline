# Collection readiness fixture evidence — 17 October 2026

The hosted failure remains a failure. Appearance run `38998342861`, source
`c9e637ad81fadf49caec884155d1bd0c2496c59c`, passed 1,215 of 1,216 focused tests.
The Collection touch disclosure case failed while waiting for its initial picture
at the existing 15,000 ms deadline. Its picture state was `pending`, with no
reported application errors. No candidate package was produced. The earlier
`1cc` run failed in the same case; passing local cases do not explain either
remote failure conclusively.

Root retained and read back artifact `12088857082` completely:

| Retained item       |   Bytes | SHA-256                                                            |
| ------------------- | ------: | ------------------------------------------------------------------ |
| Failed-run archive  |  57,236 | `2db7bded1b6dba6e5607c8c05fbc15023875b6b6d12d33364f879feb65dc4368` |
| `focused-tests.tap` | 286,438 | `b91ab31922ed473bc2743b301dcbc79243c72acab31344adad8838a2dff6ee6b` |

The receipt and unchanged failure are under
`.cache/solo-followup/remote-appearance-38998342861/preview-retained/`.

## Local boundary observation

Before this correction, the unchanged two Collection cases passed locally, with
the second taking approximately 9.18 seconds on one run and 1.34 seconds during
a separate intrusive CPU-profile run. This variability is retained, not averaged
into a performance result. The helper and modal test bytes before the correction
were identical between `c9e637ad8` and the local base `72e6822cd`.

A separate cache-only observer forwarded the fixture fetch, modeled image and
timer operations without changing readiness or supplying frames. It retained
355 records for the first page and 359 for the second, with zero dropped records.
On the second page, two awaited fixture fetches spent the following time before
returning source bytes:

| Hash-named source PNG                                                  | Bytes | Awaited fixture read boundary |
| ---------------------------------------------------------------------- | ----: | ----------------------------: |
| `77a93635bc7d39976bbf571f056a68f75ef43e1b655b6512fd293b2b568306e3.png` |   567 |                  3,703.498 ms |
| `150ebf2c0817461fda33425c885488da7f4566b16a83947e94799d8da2df05e5.png` |   191 |                  2,520.303 ms |

Both file contents match their SHA-256 names. This elapsed time includes the Node
fixture's asynchronous filesystem boundary and can include worker-pool queues
and scheduling; it does not establish physical disk latency. Subsequent modeled
image completions took about 2 ms. Those are modeled image-boundary observations,
not native browser decoding measurements. The remote cause remains unproven.

The complete observed TAP is 63,116 bytes, SHA-256
`1038dd03b86de62e101130cb71357df703f0f965dd8da7c0cff1f7a20321a590`, at
`.cache/solo-followup/modal-picture-startup/collection-observed-full-current.tap`.
The original passing TAP and intrusive profile run remain beside it. None earns
browser timing or correctness credit for the failed hosted candidate.

## Scoped correction

Only the two Collection disclosure cases opt into the new immutable fixture
reader. An exact hash-named image beneath the source presentation asset directory
is read once, within a file-size bound, and admitted only after its SHA-256
matches. Retained bytes are private and each caller receives an independent copy.
Concurrent requests for the same image share one owned source read. Failed, corrupt
and rejected reads never enter the cache. Mutable manifests and unrelated paths
continue through the original transport.

The limits are 8 MiB retained, 256 entries, eight distinct pending reads and 1 MiB
per source image. Provenance retains at most 256 first-read records and eight
worst reads; omitted provenance is counted explicitly. The file reader bounds
its allocation before reading and rejects size changes. These limits describe
fixture-owned resources; response copies belong to their callers.

Custom fetch and fault-injection hooks still execute before cache admission.
Every page still runs the real manifest, header, hash and image-readiness paths.
The 15,000 ms readiness deadline, input actions, checkpoint assertions and paused
simulation assertions are unchanged. No production runtime, native browser,
stylesheet, simulation clock or performance gate changed.

Successful cases emit one small provenance diagnostic each. The complete-file
run observed 81 first reads for the keyboard page, then 81 cache hits and zero
new image-file reads for the touch page. Retained content was 58,593 bytes across
81 entries, with no pending reads. This proves transport reuse in that test run,
not that the remote startup failure or device performance has been resolved.

Readiness failures now include their actual elapsed wait and optional bounded
fixture provenance. These Node-only diagnostic fields use `process.hrtime`,
matching the existing wait deadline, so gameplay tests that freeze
`performance.now()` cannot conceal elapsed waiting.

## Validation and limits

The complete new fixture suite exercises corrupt and oversized sources, missing
files, rejected reads, independent copies, concurrent deduplication, pending and
retained-resource bounds, mutable-file rereads, and a custom fetch gate that
still blocks real picture readiness despite cached source bytes. A deliberately
held required read still fails at the original 15-second deadline and preserves
pending-read provenance. A frozen gameplay-clock control checks monotonic
diagnostics. The full new file is included in the Appearance focused gate, and
its test and both helper paths trigger that workflow.

The complete modal-navigation, flight-preparation-status, new fixture and
Appearance-policy files passed **90/90** tests in 202.390 seconds. That run began
before the diagnostic-only monotonic-clock correction; its functional scenarios
and transport assertions were unchanged. After that correction, the complete
fixture and Appearance-policy files passed **16/16** tests in 17.516 seconds,
including both frozen-clock controls. Scoped lint, formatting and diff checks
passed on the final seven changed paths (lint applies to their JavaScript files).

| Local retained TAP                   |  Bytes | SHA-256                                                            |
| ------------------------------------ | -----: | ------------------------------------------------------------------ |
| `collection-fixture-complete-v1.tap` | 22,419 | `392ef2cd410adf22f0dce24f2b79652ffd9944aff1b4220cd5e6ae02f08f3bff` |
| `immutable-fixture-clock-v2.tap`     |  3,993 | `93e61ad833246ec2e33d4b6f8a2858b29b03c57c72db56232605e58c2de4db62` |

Both are retained under `.cache/solo-followup/modal-picture-startup/`. These are
Node regression results, not native browser qualification. The next hosted
candidate must still pass its complete gate and produce its own verified
package; historical failures and the unqualified performance status remain
unchanged.
