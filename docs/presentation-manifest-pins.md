# Exact compiled-presentation pins

`createPresentationHost().load({expectedManifestSha256, signal, onStatus})` now accepts an optional lowercase 64-hex SHA-256 of the exact `runtime.json` bytes. Null/omitted preserves historical callers. Invalid pins fail before cancelling an existing pending load. A well-formed mismatch fails before asset fetching, decoding, font registration or adoption; the previous accepted snapshot remains usable.

Every accepted snapshot exposes its measured `manifestSha256`, including loads without an expected pin. This hashes the received bytes, not normalized JSON: whitespace changes also change identity. Existing schema, file hashes, resource budgets and decode checks still apply. No authentication claim follows merely from matching a caller-provided hash; the expected value must originate in the reviewed exact collection/presentation reference.

For a complete theme, the staged-attempt owner must create a separate presentation host, pass the catalogue's exact expected hash, then verify the accepted snapshot's source/theme/collection and required slots through the catalogue boundary. Only after pictures and all other attempt dependencies are ready may the host adopt the replacement. Do not reload the page's existing shared host to preview or stage a theme: successful load intentionally retires that host's prior resources. Dispose rejected/stale staging hosts without affecting the active attempt.

This slice closes the loader's manifest-byte verification gap. It does not add selection UI, a theme catalogue loader, complete attempt pins, backup/offline support or automatic mode coverage. Runtime and historical save readers remain unchanged.

Tests use real compiler output, exact local Git sprite/font fixtures and the existing 12 host regressions. Eight new cases cover matching/unpinned loads, wrong and malformed pins, equivalent-JSON byte changes, resource survival after failure, cancellation/supersession and independent-host staging. Mock decoders prove ownership; they do not establish actual browser decode, visual quality, physical controls, offline readiness or a published release.
