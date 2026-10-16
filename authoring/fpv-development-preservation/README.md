# FPV development payload preservation

This backup preserves development packages, evidence, failed packages and other inventoried app payloads. It does not promote a package to the player, repair public storage, certify performance or replace the separate source Git/ref/WIP preservation audit. The GitHub release remains a draft backup in the public `mekhovov/revealline` repository.

Each source file is identified by size and SHA-256. Identical file content is stored once while every original relative path, file mode and modification time remains in the final index. Original package archives already preserved by the library qualification lane are referenced directly. Other pre-existing release assets are identified by their server digest and must pass authenticated download verification during restoration.

`pack.py` reads a root-produced JSONL inventory and packs safe objects into a new, exclusive directory. It checks the chosen source against the inventory before reading it, hashes the actual bytes written, then fully rehashes the original and checks size/time again. It refuses changed sources, unsafe relative paths and unreviewed policy flags. Exact reviewed exceptions require matching both path and SHA-256. Private browser/history/system names and Coupa names remain held unless that exact app object was cleared. Failed or partial outputs are retained.

Parts are deterministic regular-file-only TAR streams compressed with Zstandard. Each contains a sealed object manifest and `objects/<sha256>` entries. The default estimated uncompressed part cap is 1,350,000,000 bytes, below 1.5 GiB. A single object above the budget is refused for explicit chunk handling, never silently omitted.

`verify_upload.py` uploads a completed part under its full content digest without overwrite. It requires the GitHub server size/digest to match, downloads the entire asset with authentication into a fresh external directory, then restores and hashes every member. Links, devices, unsafe names, duplicate or unexpected members, changed headers and missing objects are refused. Only the resulting verified receipt can enter `build_index.py`.

For large parts, the normal PR workflow `FPV preservation readback` can execute the same full readback and strict restore on a fresh GitHub runner through `verify_published.py`. Its committed published-part plan contains the sealed size/digest/header and every original source check. A server-only plan is not a verified receipt. Workflow defaults and plan discovery have read permission. The verifier job requires `contents: write` solely for visibility of the draft backup release; it is restricted to this same-repository preservation branch and PR #1552. Its token is exposed only to the readback step, whose API operations are GET-only. It builds or runs no app, makes no repository/release/settings mutation, and deletes no source or original evidence. Successful small cloud receipts must be copied into durable Git/backup records before Actions retention expires.

`verify_upload.py --published-plan-output <fresh-plan.json>` stops after successful server digest verification and emits that pending plan instead of a success receipt. This permits authenticated readback/member restoration to run in cloud. The default `--receipt-output` path still completes full local readback and restoration; choose exactly one output mode. The index accepts only verified receipts, never pending plans.

`build_index.py` joins the primary and supplemental inventories, verified CAS receipts, the verified original-archive manifest and the existing release digest catalogue. It never reads source payloads. Missing objects, unreviewed records, conflicting inventory rows, errors, unstable files or an incomplete root inventory prevent its coverage-complete field. Git checkout and exclusion records remain explicit. An interim index is a progress report, not a completion receipt.

Coverage completion also requires `--inventory-set-final`, which may be supplied only after the root audit confirms that all primary, flat-file, ignored-payload and final-delta manifests are included. A completed primary walk alone does not establish that complete input set. Active-batch reservations avoid duplicate packing and never count as uploaded or verified coverage.

Malformed JSON rows and unsupported row kinds always refuse processing, including an interior corrupt row. Final index inputs must end every row with a newline and remain the same size, modification time and file identity while read and hashed. A writer's partial trailing row must finish before another packing attempt; it is never silently discarded.

## Portable restoration

The restore utility requires Python 3.10+, `zstd`, the GitHub CLI, authenticated read access, the final index, and these Python files in one directory. Choose fresh output and cache directories on any disk; the old volume is not required. Paths below are examples, not fixed locations:

```sh
python3 restore.py \
  --index /chosen/backup/preservation-index.json \
  --cache /chosen/disk/new-restore-cache \
  --restore-root /chosen/disk/new-restored-payload \
  --receipt /chosen/backup/new-restore-receipt.json
```

The cache may reuse an existing asset only after its entire size and hash match. Restoration refuses an existing output directory and symlinks in cache/output ancestors. Every restored logical file is checked while writing and fully rehashed afterward. Original modes and modification times are applied after byte verification.

Within-root absolute symlinks are rewritten to relative links under the selected restore root. Relative links escaping that root and absolute targets outside the historical source root are reported and not recreated. Dangling or looping internal links are also reported. `--defer-external-dependencies` permits a reviewed partial restoration to exit successfully, but never changes a false completion field into a true one. Source Git checkouts must be recovered through the separate source preservation manifest and Git bundles/branches; this tool never claims overall disconnect safety.

A separately reviewed GitHub subtree can close an exact outside-root link without recreating its old absolute target. Supply its matching `--github-link-mapping` and `--github-link-coverage` receipts when creating the index. The importer requires the exact captured link, a fully tracked clean file manifest, matching counts and the reviewed Git tree identity. Restoration confirms the subtree against the pinned commit, downloads every Git blob, checks its Git identity, byte length and SHA-256, then exclusively copies and rehashes it under the reviewed relative dependency destination. The leaf link becomes relative only after all dependency files verify. Unknown links continue to be reported and held open.

Reproducible excluded package-manager dependencies should be installed using the corresponding recovered lockfile and pinned version. The root audit's local dependency repair receipt records the `gltf-validator` dependency and its verified internal replacement. No restored app should depend on the historical external share path; unresolved link/dependency records must be closed by the overall audit before disconnect is declared safe.

## Verification

Use a fresh external temporary parent for the regression suite:

```sh
TMPDIR=/chosen/external/test-stage python3 -m unittest -v test_preservation
```

The tests exercise real TAR/Zstandard pack and restore, changed-source refusal, destination refusal, part-header tampering, traversal/private-name holds, exact exception handling, duplicate-content reuse, cache symlink refusal and incomplete inventory semantics. Test directories and failed outputs are intentionally retained for inspection.

Do not publish any additional source object merely because an archive tool can read it. The root inventory review, exact policy clearances, source provenance, authenticated per-asset readback and final full relative-path restore are independent required receipts.
