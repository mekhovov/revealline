# v0.94 Team/presentation integration

This successor integrates the exact historical range
`80a47a3b25167d9dcd0bdf98b1bde6a95d112269..20370a67892e5d48d65b0be9277c715d297b9f47`
without replaying PR #233. The machine ledger records all 154 paths, each PR head and
stable patch identity, the three current-main conflict resolutions, PR #239's exact
coverage through PR #245, and PR #241's intentionally separate scope.

## 2026-09-23 historical wording correction

Earlier immutable evidence described fpv55–58 as an unpublished alternate lineage.
That statement remains historical evidence and is not rewritten. Following v0.93 public
acceptance, exact fpv58 is a published runtime: 979,746 raw bytes with SHA-256
`ae9949a7c8c8a24775e68317e5825e9b4b2e5ae1dfb9bcffdd749a5adc4cce54` from source
`6842203fbf24db198da21759e23d5c5c64d499dd`. Only the alternate fpv55–57 lineage
remains unpublished. v0.94 retains fpv58 byte-for-byte in hash-addressed authoring and
compiled paths and admits only that exact identity; it never upgrades a saved fpv58
visual pin to the integrated current revision62.

The guarded producer appended revision62 to preserve current-main and Team-stack
semantics together. Historical theme records 54 and 58–61 remain present. Exact runtime
outputs 54, 58 and 60 retain their complete lazy dependency closures. Missing or corrupt
fpv58 bytes fail before adoption, leaving an already accepted attempt/save owner usable.

Automated broad suites and extended browser/device/gameplay/offline journeys are
waived/deferred under the temporary reviewed policy, never passed. Exact source identity,
successful build/validate, deterministic retention checks and hosted release evidence
remain mandatory before merge or publication.

Run `node scripts/verify-team-presentation-v0940.mjs` to revalidate the ledger.

The local exact-source validate and focused retention/determinism checks pass. A bounded
local build reached artifact writing but the shared volume had only about 1.3 GiB free and
ended with `ENOSPC`; its exact temporary output was removed afterward. This capacity failure
is retained as a failure, not a passed build. The draft PR's hosted exact-head build remains
mandatory before readiness or merge.
