# FPV development payload preservation

This backup preserves development packages, evidence, failed packages and other inventoried app payloads. It does not promote a package to the player, repair public storage, certify performance or replace the separate source Git/ref/WIP preservation audit. The GitHub release remains a draft backup in the public `mekhovov/revealline` repository.

Each source file is identified by size and SHA-256. Identical file content is stored once while every original relative path, file mode and modification time remains in the final index. Original package archives already preserved by the library qualification lane are referenced directly. Other pre-existing release assets are identified by their server digest and must pass authenticated download verification during restoration.

`pack.py` reads a root-produced JSONL inventory and packs safe objects into a new, exclusive directory. It checks the chosen source against the inventory before reading it, hashes the actual bytes written, then fully rehashes the original and checks size/time again. It refuses changed sources, unsafe relative paths and unreviewed policy flags. Exact reviewed exceptions require matching both path and SHA-256. Private browser/history/system names and Coupa names remain held unless that exact app object was cleared. Failed or partial outputs are retained.

Parts are deterministic regular-file-only TAR streams compressed with Zstandard. Each contains a sealed object manifest and `objects/<sha256>` entries. The default estimated uncompressed part cap is 1,350,000,000 bytes, below 1.5 GiB. A single object above the budget is refused for explicit chunk handling, never silently omitted.

`verify_upload.py` uploads a completed part under its full content digest without overwrite. It requires the GitHub server size/digest to match, downloads the entire asset with authentication into a fresh external directory, then restores and hashes every member. Links, devices, unsafe names, duplicate or unexpected members, changed headers and missing objects are refused. Only the resulting verified receipt can enter `build_index.py`.

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

Reproducible excluded package-manager dependencies should be installed using the corresponding recovered lockfile and pinned version. The root audit's local dependency repair receipt records the `gltf-validator` dependency and its verified internal replacement. No restored app should depend on the historical external share path; unresolved link/dependency records must be closed by the overall audit before disconnect is declared safe.

## Verification

Use a fresh external temporary parent for the regression suite:

```sh
TMPDIR=/chosen/external/test-stage python3 -m unittest -v test_preservation
```

The tests exercise real TAR/Zstandard pack and restore, changed-source refusal, destination refusal, part-header tampering, traversal/private-name holds, exact exception handling, duplicate-content reuse, cache symlink refusal and incomplete inventory semantics. Test directories and failed outputs are intentionally retained for inspection.

Do not publish any additional source object merely because an archive tool can read it. The root inventory review, exact policy clearances, source provenance, authenticated per-asset readback and final full relative-path restore are independent required receipts.
