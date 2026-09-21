# Exact retained presentation manifests

The read-only presentation host accepts an optional code-owned `retainedManifestSha256` constructor setting. Its release path becomes `runtime.<sha256>.json` beside `runtime.json`; images, fonts and audio retain the existing `assets/<sha256>.<extension>` paths. Only lowercase SHA-256 values are accepted. Uploaded filenames and URLs never select a host path.

A retained host also requires the same `expectedManifestSha256` on every `load`. It authenticates the original manifest bytes before opening assets. A missing or modified historical manifest reports failure; it never falls back to current artwork. Existing default hosts still use `runtime.json` and keep their current optional pin contract.

`inspectPresentationDependencies` and `verifyPresentationDependencies` accept the same `retainedManifestSha256` option. Inspection authenticates those bytes and returns the hash-named manifest path plus all selected files, including lazy reveal originals and audio. The verification result proves file bytes only, not decoded images, offline installation, visual quality or compatibility approval.

## Controlled publication

`retainPresentationManifests(nextFiles, previousFiles)` validates both compiler-owned file maps and their selected runtime dependencies. When the default changes, it retains the previous original runtime bytes under their exact hash-derived name, plus every already retained manifest and its selected assets. It preserves the new source identity and current runtime/Studio bytes. Inputs remain unchanged; repeated assembly is byte-idempotent. This step does not rebuild historical manifests or infer artwork approval.

`writePresentation` validates archived manifest names, actual hashes and every selected dependency before staging output. Once an archive exists in its owned output, a later replacement cannot omit or change it. Unknown files, manual edits and missing dependencies remain visible failures before replacement. Existing current-only builds retain their prior behavior.

This is explicit producer infrastructure. Production generation has not been switched to use it; release storage/download budgets, code-owned catalogue coverage and actual offline adoption remain release gates. Retention accumulates history deliberately; a future pruning policy must account for every supported retained pin and cannot silently drop originals.

## Required adoption work

These are retention, transport and inventory primitives. They do not switch the live Team page, publish historical files, relax receipt identity, or accept a new collection. Before a newer default collection ships:

1. Retain the exact previous runtime manifest bytes, not a recompilation carrying a new source identity. Use `retainPresentationManifests(nextFiles, previousFiles)` before the controlled writer. The producer still must adopt this explicitly; it is not automatic.
2. Include every selected historical dependency in the release and campaign offline inventory. Preserve original bytes and exact picture bindings.
3. Build code-owned catalogue entries that match source, theme, collection and manifest pin. Create a fresh retained host for the exact catalogue entry and prepare its lease alongside the picture lease.
4. Stage both resources without replacing the accepted attempt. Cancel or retire them together, and release the previous owner only after successful adoption. Retry retains the accepted owner.
5. Qualify historical imports, missing archives, cancellation, restore, offline and native lifecycle behavior. An inventory pass is not public-release acceptance.

## Maintainer and agent prompt

“Adopt an approved Team collection while preserving exact historical presentations. Use `retainedManifestSha256` with a code-owned catalogue pin and an identical `expectedManifestSha256`; preserve original runtime bytes under their hash-derived name and all referenced assets. Do not weaken pack/theme/collection receipt equality or silently select current artwork. Stage presentation and picture ownership together. Verify failure, cancellation, Retry, historical imports and offline restoration before changing the production default.”
