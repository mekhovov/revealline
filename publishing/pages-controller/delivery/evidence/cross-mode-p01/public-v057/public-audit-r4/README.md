# Prepared P01 R4 / v0.57 public-byte auditor

**Preparation only. No HTTP audit, production binding, deployment claim, or public pass has been created.**

Fixed target:

- Version: `v0.57.0`
- Game source: `b7db0134d4ede3452dc90b5d3f7ffb1491a0579b`
- Qualified source tree: `7cd40e4ef8bf975e7eb2795cdd2669aa18811a57`
- Only public prefix: `https://mekhovov.github.io/revealline/`

The retained `.cache/cross-mode/p01/public-audit-r3` preparation is preserved. This R4 copy changes only the auditor’s fixed source and tree pins; version v0.57.0 and the 61-entry retained catalogue remain unchanged. The HTTP engine is byte-for-byte identical. `preparation-provenance.json` pins all six prior preparation files and this copy; no real publication inputs or bindings have been created. `self-check.mjs` exercises the helper with in-memory responses and empty temporary directories only; it creates no synthetic publication binding or public report.

## Authority must arrive after successful hosted publication

Create an ordinary non-symlink directory `inputs/ACTUAL_CONTROLLER_COMMIT/` beneath this helper. Preserve the bytes of exactly nine independently verified evidence files:

1. **receipt**: the successful hosted `artifact-receipt.json`, extracted from the actual publication run's receipt artifact. Independently verify the downloaded artifact/run transport identity; a local prediction or PR preview is not acceptable.
2. **deployment**: the exact GitHub Pages deployment API snapshot.
3. **statuses**: that deployment's status array, newest first, with its latest status successful.
4. **run**: the successful `main` publication workflow API snapshot linked to that deployment.
5. **manifest**: the immutable v0.57 build manifest.
6. **record**: the immutable v0.57 release record.
7. **qualification**: the real exact-source successful six-gate checkout qualification. It must carry `actualCheckoutCommit`/`actualCheckoutTree` matching this source and each of `validate`, `lint`, `test`, `format`, `native-format`, `motion-syntax` with `step.conclusion: "success"`. Do not synthesize these facts from an anticipated outcome.
8. **catalog**: the actual publishing controller's full frozen catalogue.
9. **configuration**: that controller's `publication.json` selector.

Only then create and independently review `binding.json`. It uses the existing `revealline-final-main-public-binding.v1` shape: `base`, `currentVersion`, `gameSourceRevision`, `qualifiedSourceTree`, actual `controllerCommit`/`controllerTree`, integer `deploymentId`/`runId`, `inventorySha256`, and `pins` with exactly the nine names above. Each pin has its ordinary lowercase JSON basename, exact bytes, and SHA-256. Distinct roles must use distinct files; symlink authority roots/components and path traversal fail.

`inventorySha256` hashes UTF-8 `JSON.stringify(receipt.files, null, 2) + '\n'` in the original receipt order. It covers the **whole hosted inventory**: root aliases/graph, workers, current canonical site, historical release bridges, metadata, and hidden files. Do not supply only the current manifest or omit hidden files.

Record the independently reviewed binding SHA-256. The helper refuses a different binding, mismatched game/source/tree, an unsuccessful/unlinked deployment, a non-main publication run, a preview receipt, missing gates, an incomplete canonical current tree, duplicate catalogue/manifest/receipt paths, or rewritten retained release authority.

## Parent review assumptions before first use

- The publishing controller continues to use `.github/workflows/publish-frozen-pages.yml`, the existing nine authority models, `main`, `github-pages`, and the canonical main public prefix.
- Publication retains all semantic releases (`retainedReleasesPerMajor: 100`) with **empty `testingRoutes`** and historical bridge count equal to catalogue length minus one. A comparison-only or alternative publication policy requires explicit helper review; it is not silently admitted.
- `retained-catalog.json` preserves the exact 61-entry catalogue in source `b7db0134d4ede3452dc90b5d3f7ffb1491a0579b`, through v0.56.0. It is a minimum immutable-history safeguard, not a prediction of the future catalogue length. Parent must independently confirm every later addition and the actual v0.57.0 controller catalogue before reviewing its binding.
- Frozen packaging still has ordinary `manifest.files` plus `manifest.json`, `.xonix-build.json`, and `distribution.zip.sha256` in the current canonical site. Version/source/tree and exact metadata hashes are checked. Unknown MIME extensions fail closed until individually reviewed.
- GitHub API evidence is a pinned successful snapshot, not continuous polling. Parent must coordinate intervening deployments and recheck the current deployment separately; a full body pass is not a claim that the latest API state remained unchanged throughout.
- End-to-end authority acceptance remains untested until real inputs exist. Preparation self-check success must not be represented as `--check`, public HTTP acceptance, browser play, or offline verification.

## Commands only after actual binding review

Run from this helper directory, replacing the path and SHA labels with actual reviewed values:

```sh
node audit-main.mjs --binding inputs/ACTUAL_CONTROLLER_COMMIT/binding.json --binding-sha REVIEWED_BINDING_SHA --check
node audit-main.mjs --binding inputs/ACTUAL_CONTROLLER_COMMIT/binding.json --binding-sha REVIEWED_BINDING_SHA --critical --out critical-1
node audit-main.mjs --binding inputs/ACTUAL_CONTROLLER_COMMIT/binding.json --binding-sha REVIEWED_BINDING_SHA --out complete-1
```

`--check` validates authority with zero network requests and no result writes. `--critical` examines eight root/current identity files and reports **PARTIAL_CRITICAL_PASS**, with uninspected count and `allArtifactBodiesVerified: false`. Full mode inspects every receipt member. Even full `PASS` proves decoded HTTP bytes and required MIME only, not public browser execution, offline cold start, saves, artwork readability, or physical-device behavior.

The unmodified engine streams decoded response bodies, refuses redirects/non-200 bodies, requires exact length/hash and approved Content-Type, and cancels oversized responses. Eight workers use 300-second request deadlines. There are at most three attempts per body; only transport/timeouts/429/5xx retry with bounded delay. Hash/MIME/oversize/404 failures do not retry. Every attempt and final result remains in a new exclusive `runs/NAME/` directory; prior evidence is never overwritten or spliced into a new pass. Authority/helper hashes are rechecked after the run.

Preparation checks (no real HTTP):

```sh
node --check audit-main.mjs
node --check http-engine.mjs
node self-check.mjs
```
