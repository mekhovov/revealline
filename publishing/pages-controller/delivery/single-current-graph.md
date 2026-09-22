# Single canonical current graph

September 22, 2026. Infrastructure candidate based on accepted `e8bacfe0`.
No game source, version, immutable release, selector, archive admission or
production deployment is changed by this branch.

## Capacity finding

Journey PR #225 source `40ff91b68ab864411758c334b7d742fe95622cf8`
contains 1,000 directly included files totaling 402,593,755 bytes. Its 32 external
body pins add 130,442,755 bytes and five optional chapter pins add 56,425,044.
None of those external bodies is already in the raw include set. The old
publisher copied the entire current graph at root and at its canonical versioned
path. Even subtracting all 538,663 raw HTML/worker bytes that root aliases replace,
that yields a lower bound of **1,178,384,445 bytes** before soundtracks and generated
metadata. The 950,000,000-byte Pages limit must remain unchanged.

## Correction

Every authenticated original remains at `releases/V/site/`, with identical bytes,
manifest, relative URLs, original service worker and downloadable release ZIP.
Root HTML aliases already contain all their own styling/script and preserve query
parameters and fragments. They do not need another copy of the runtime assets.

Root retains only six exact compatibility paths when present: frozen manifest
evidence, the webmanifest, three PNG icons (180/192/512) and the SVG icon. Each has
a finite independent byte limit. The routing record already identifies the root
frozen manifest as evidence applying to the canonical path. The independently
owned catalog presentation, generated release catalog and historical bridges stay
unchanged. No current-version asset proxy, HTML response for a missing binary,
cache deletion, forced service-worker activation or save migration is introduced.

Old root-installed PWAs retain their metadata/icon paths and the same start URL;
navigation follows the existing canonical entry redirect. This does not establish
physical-device PWA behavior. An old root runtime can still encounter a missing
uncached body. Silently replacing such a body with current bytes would mix
editions; the new layout does not make that promise. Existing stored caches and
data remain untouched. Canonical current and historical graphs are preserved.

## Verification and release gates

Tests inspect every fixture's canonical body against its original hash, prove
heavy root/runtime/offline-cache bodies are absent, compare all compatibility
bytes, independently reread the artifact inventory and retain exact Pages-budget
boundaries. Existing tests cover all alias query/fragment routes, retirement
ownership without cache/storage mutation, source/ZIP integrity, catalog assets
and authenticated historical routing.

The first 20-test local run passed 19 checks and failed because the new sparse
worktree omitted a required authoring HTML fixture. Adding the exact tracked HTML
files resolved that fixture issue; the five current-entry tests then passed.
No production source or test expectation was weakened to hide that failure.

The final full publisher/current-entry cohort passes **54/54** on Node 20.19.5
and independently on Node 22.22.2, with no failures, skips or cancellations.
The four Python bounded-extraction tests also pass. Formatting and whitespace
checks pass. Independent source review found no blocker in this bounded change;
it did not claim real artifact capacity or physical installed-app acceptance.

Hosted PR artifact assembly/reread, native canonical play/Studio/catalog routes, scoped offline and
legacy-root behavior, release-owner sequencing and public verification are required
before promotion. A layout fixture is not proof that the final Journey artifact
fits. The final frozen manifest and full publisher receipt must establish that.
