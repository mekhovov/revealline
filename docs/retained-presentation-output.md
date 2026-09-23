# Retained presentation output

Saved attempts need their exact approved presentation after a newer collection ships. Keeping old PNGs alone is insufficient: the original runtime manifest binds the exact tokens, roles, asset revisions, geometry, fonts and lazy picture/audio dependencies.

## Explicit compilation contract

`compilePresentation(document, assets, { previousOutput })` accepts a verified compiler-output Map as an explicit input. Omit it for the historical current-only behavior. It never follows an uploaded path or silently reads the working directory. `retainPresentationOutput(candidateFiles, previousFiles)` provides the same composition for an already compiled candidate.

The output keeps the new `runtime.json`, `studio.json` and `theme.css`. When current runtime bytes change, the previous original runtime is stored byte-for-byte as `runtime.<sha256>.json`; existing retained manifests and all their selected dependencies remain. Hash-addressed assets are shared once. A retained manifest never means “latest.” Its original bytes are authenticated before dependencies are inspected, including lazy pictures and audio. Unselected authoring assets are not copied solely because they existed in a prior output.

The regenerated ownership manifest lists every retained file. An unknown, altered, misnamed, incomplete or unsafe input fails. Copies own their bytes, so asynchronous composition cannot mutate the caller's accepted buffers. Repeating compilation with the same explicit inputs produces the same files and bytes. Rebuilding the unchanged current collection also preserves its existing history without adding a redundant current-manifest copy.

## Controlled publication

`writePresentation` understands only code-owned `runtime.<64 lowercase hexadecimal digits>.json` names and the existing asset paths. Before staging, it verifies each retained runtime's filename hash, schema and complete dependency bytes. A current directory containing retained manifests cannot be replaced by a candidate that drops or changes them. Failure leaves the old directory intact. Existing unmanaged-file and symbolic-link protections remain.

Retention is bounded to 128 manifests and 32 MiB of unique retained manifests plus their dependencies, using the existing presentation collection/transfer limits. Exceeding capacity fails explicitly; it never prunes history. Budget planning or a separately designed archive/migration is required before admitting more history.

## Adoption sequence

1. Qualify the exact current compiled output and select the retained collection scope.
2. Compile the next approved collection with that output explicitly supplied as `previousOutput`.
3. Inspect its current and retained dependency inventories and immutable original hashes.
4. Run controlled writer check/adoption, production reproduction and release artifact inventory. Ensure offline installation includes the retained manifests and dependencies actually referenced by attempts.
5. Use the exact-manifest host/lease path when restoring a presentation pin. Missing or corrupt retained bytes must offer recovery, never current-theme substitution.
6. Test retained Retry/Continue, export/restore and offline cold start across the release boundary before exposing complete visual-theme selection.

This compiler/writer support does not itself switch game themes or migrate player saves. Host restoration, attempt callers, visual-theme catalogue coverage, offline/storage recovery and public acceptance remain separate requirements. Do not publish a collection merely because its output inventory verifies.
