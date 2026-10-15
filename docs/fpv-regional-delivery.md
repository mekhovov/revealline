# Verified regional delivery

`regional-delivery.mjs` installs unscored regional content independently of WorldPack.v2, World.v1 courses and recorded proofs. The separate `revealline-fpv-regions-v1` database reuses the existing atomic revision store. A failed download, integrity check, stale generation or transaction leaves prior installed revisions available.

## Immutable descriptor

The trusted catalogue provides `{url, bytes, sha256}` for the descriptor. HTTP is accepted only on the page origin; remote sources require HTTPS. Credentials, query strings, fragments and redirects are rejected. Every downloaded byte must match its pinned size and SHA-256.

`FPVRegionalDelivery.v1` has exactly `format`, `id`, `revision`, `title`, `terrain`, `scenery`, `files`, `totalBytes`. IDs and revisions are lowercase slug strings up to 64 characters. Titles contain EN/UK strings up to 120 characters. Terrain and scenery references each contain `{path, bytes, sha256}`. `files` includes both manifest references and the exact union of their relative asset closures; extras, missing files and conflicting pins reject. Both validated manifests must have matching IDs, revisions, grids, chunk IDs with corresponding coordinates, and spawn sets. This is the same pairing contract required by the mixed flight runtime. The delivery descriptor may have its own independent ID/revision. Pairing is checked before downloading large dependent assets or committing an installation.

Paths are relative, case-insensitively unique, at most 240 characters, and restricted to safe segments and GLB/JSON/PNG/JPEG extensions. The internal descriptor storage key is reserved. Initial download limits are 1 MiB descriptor, 8 MiB per manifest, 8,194 files and 64 MiB total content. The separate retained store keeps its existing 256 MiB/256-revision bound. These are delivery limits, not a claim that every admitted source meets rendering or gameplay requirements.

## APIs

- `inspectRegionalDownload(pin, options)` verifies the descriptor only, returning its metadata and exact pin.
- `prepareRegionalDownload(pin, options)` verifies both paired manifests and every declared file without writing storage.
- `openRegionalLibrary()` returns `inspect`, `install`, `list`, `load`, `activate`, `removalSnapshot`, `remove`, `generation`, `close`.
- `install(pin, {pageURL, fetchImpl, signal, onProgress})` captures the generation before download, verifies everything, then commits metadata and blobs atomically. Progress reports `download`, `verify`, `commit` and content byte totals. Cancellation is honored through verification; once atomic commit begins, its actual result is reported.
- `list({includeRevisions:true})` exposes active/retained exact SHA, generation, descriptor and logical content bytes. `load(id,{sha256})` re-verifies stored bytes and returns a regional session configuration using only retained assets through a bounded fetch adapter. There is no network fallback.
- `activate(id,sha256,{expectedGeneration})` explicitly restores a retained revision. `removalSnapshot` reports all retained revisions and their logical source size; `remove(id,{expectedGeneration})` rejects stale review and affects this separate region database only.

The UI must preserve explicit arming, select an exact revision when flying, acknowledge commit completion honestly, and review removal before calling it. Installed bytes do not by themselves establish scene readiness: the existing regional geometry/flight admission still runs before arming.

## Verification and packaging

Run `node scripts/check-fpv-regional-delivery.mjs` for bounded invalid descriptor, integrity, closure and stalled-stream cancellation checks. Pass an authored directory containing `delivery.json` to repeat against its exact source bytes. Native transactional installation and integrated player/package journeys are separate acceptance steps.

One focused delivery module is explicitly included in the main and Worlds runtime closures, increasing the Worlds file cap from 156 to 157. Its 20 MiB byte ceiling is unchanged. A subsequent separate Library UI module requires an explicit additional file-count change; no scene files are embedded in the runtime package.

### Native isolated API review, 2026-10-15

The parent agent used native CUA at the external development fixture on port 9041 with real IndexedDB and the authored urban bundle (38 files, 1,455,090 content bytes). Database UUID `4a42156e-cb55-4680-8be6-0d871c03523f` was unique to the fixture. Descriptor SHA `1ba27d2242d61d61c0552564d75baa5f3e313e63a78c2ef434f63cdc7dbab94c` installed at generation 1. An intentionally corrupted GLB update was rejected before commit; valid revision B then committed at generation 2 and retained A. Exact A loaded through the cache-only adapter and its returned asset matched its hash. Rollback restored A at generation 3, stale removal was rejected, and both connection reopen and page reload/reopen retained A and both revisions. No player database or browser cache was modified.

The reviewed development module subsequently received a pre-aborted-signal guard and formatting; the final source passes 20 bounded checks against both synthetic closure and the authored bundle. This native API evidence is not yet integrated Library UI, packaged admission, real quota exhaustion, browser-process restart or flight/render acceptance. The external fixture and screenshot `fpv-temp/native-regional-delivery-recovery.png` are preserved; no default catalogue availability is claimed here.
