# P17 — portable theme CLI review

Status: independently exercised CLI authoring handoff; native transfer, community production and public acceptance remain open.

Exact source: `8cffb36b29a38013eb9213845efd675c4864c9d8`.

Root independently repeated the fresh-source CLI, output-byte and failure-path
checks on both runtimes. See the [independent trial](independent/README.md), which
retains its own source/output inventories and execution receipts.

The [guide](../../../authoring/examples/theme-review.md) supplies the normal export, isolated compilation, recovery and production-adoption sequence. This trial directly qualifies its CLI portion.

## Evidence

- Fresh source closure: 79 exact committed module files, 825,111 bytes; [input hashes](source-inputs.json). A separate local `package.json` selects module syntax. This is not a full repository checkout/build.
- Input bundle: 7,399,336 bytes, SHA-256 `dd8d17b2227fef4d2e6b63a3f73253be1dbf4f870a4f74325fff24f7ce2371e3`, created from the exact compiled collection through the public bundle API. It is not claimed to be a browser download from this trial.
- Both Node 20.19.5 and 22.22.2 run the actual compiler CLI using ordinary imports. Each emits 137 files / 8,293,501 bytes, including all 133 asset payloads. Every emitted manifest size/hash and payload byte is verified; runtime and Studio documents equal the parsed committed records.
- Compiler output is identical across runtimes. The output manifest SHA-256 is `521599d8bb1af87a3061cb9b8fa9176c4097f016b89f3cf326bea2208a88b393`.
- A second invocation against each existing destination fails with `EEXIST`; before/after output file sets and hashes are identical. [Execution receipts](execution-receipts.json) retain runtime, argv and output.
- Validate-only commands report `output: null`. A malformed-header fixture is rejected on each runtime before creating any output directory. [Additional receipts](additional-receipts.json).

The first comparison incorrectly required compact compiler metadata to match formatted Git JSON/CSS byte-for-byte. The retained [oracle correction](initial-oracle-correction.json) separates exact original payload bytes from parsed document identity and cross-runtime generated-byte identity. That first failed output remains in the local test directory. The product was not changed to satisfy the mistaken comparison.

## Limits and continuation

CLI verification uses the documented header/hash checks, not browser image/font/audio decoders. Native input tooling did not activate controls in the separate attempted Studio run; no upload, pixel edit, save, actual download or fresh-origin import is claimed for that run. Its source-revision fix has independent modeled-host tests. Complete the real import/edit/save/export/recovery and cross-mode visual/audio review before treating the community workflow as fully accepted.

No production source, ledger, saved flight, earned picture or frozen release was modified. The generated review trees and binary input remain local QA artifacts, not approved community content. Adoption still requires related changes, a synchronized unused version, exact-source release gates, immutable publication and public play verification.
