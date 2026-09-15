# P01 still/poster build fixture repair

2026-09-15. Changed only `game/test/still-workshop-build.test.mjs` (two inventory entries).

The isolated fixture copied JavaScript literal imports transitively, but did not copy the new `operation-status.css` referenced by both real workshop HTML entries. The focused reproduction passed the source allowlist test and failed the four fixture builds with exactly those missing CSS references (`still-workshop-build-before.log`). The production build includes the whole game subtree; no production build/config/runtime change was necessary.

Added both `game/ui/operation-status.css` and `game/ui/operation-status.mjs` to the existing `fieldKitFiles` list. This includes them in fixture construction and strengthens the existing assertions for the real release allowlist, byte-identical loose/ZIP output, manifest/offline hashes and byte counts, plus service-worker cache-only requests under immutable release, preview and local URL prefixes. Existing route, query/fragment, teaching/original-byte, offline-budget and no-network assertions remain unchanged.

Validation: `node --test game/test/still-workshop-build.test.mjs` →5/5pass,0fail,0skip (`still-workshop-build-after.log`); Prettier check passes. No full suite, production build, Git index/branch/version or publication mutation. Temporary fixture outputs cleaned by the existing test teardown.

Final test source SHA256: `1dd24c4c30df2bc234c39c29f788d529fd4c768755e18b8cf90eef020fb26c3a`.
