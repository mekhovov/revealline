# Prepared v0.55 public-byte auditor

**Preparation only. No HTTP audit, production binding, deployment claim, or public pass has been created.**

Fixed target:

- Version: `v0.55.0`
- Game source: `acc9f265b651017fd268ffd8bbe6989bec614c41`
- Qualified source tree: `824581317c87a9097097c255f57c11bed153fad0`
- Only public prefix: `https://mekhovov.github.io/revealline/`

The reviewed `publishing/pages-controller/delivery/evidence/final-main-public-audit/http-engine.mjs` was copied byte-for-byte. `audit-main.mjs` is a small adaptation of that directory's existing v0.51 auditor. `preparation-provenance.json` pins both originals, prepared copies, and the 58-version historical catalogue lower bound. `self-check.mjs` exercises the helper with in-memory responses and empty temporary directories only; it creates no synthetic publication binding or public report.

## Authority must arrive after successful hosted publication

Create an ordinary non-symlink directory `inputs/ACTUAL_CONTROLLER_COMMIT/` beneath this helper. Preserve the bytes of exactly nine independently verified evidence files:

1. **receipt**: the successful hosted `artifact-receipt.json`, extracted from the actual publication run's receipt artifact. Independently verify the downloaded artifact/run transport identity; a local prediction or PR preview is not acceptable.
2. **deployment**: the exact GitHub Pages deployment API snapshot.
3. **statuses**: that deployment's status array, newest first, with its latest status successful.
4. **run**: the successful `main` publication workflow API snapshot linked to that deployment.
5. **manifest**: the immutable v0.55 build manifest.
6. **record**: the immutable v0.55 release record.
7. **qualification**: the exact-source successful six-gate checkout qualification.
8. **catalog**: the actual publishing controller's full frozen catalogue.
9. **configuration**: that controller's `publication.json` selector.

Only then create and independently review `binding.json`. It uses the existing `revealline-final-main-public-binding.v1` shape: `base`, `currentVersion`, `gameSourceRevision`, `qualifiedSourceTree`, actual `controllerCommit`/`controllerTree`, integer `deploymentId`/`runId`, `inventorySha256`, and `pins` with exactly the nine names above. Each pin has its ordinary lowercase JSON basename, exact bytes, and SHA-256. Distinct roles must use distinct files; symlink authority roots/components and path traversal fail.

`inventorySha256` hashes UTF-8 `JSON.stringify(receipt.files, null, 2) + '\n'` in the original receipt order. It covers the **whole hosted inventory**: root aliases/graph, workers, current canonical site, historical release bridges, metadata, and hidden files. Do not supply only the current manifest or omit hidden files.

Record the independently reviewed binding SHA-256. The helper refuses a different binding, mismatched game/source/tree, an unsuccessful/unlinked deployment, a non-main publication run, a preview receipt, missing gates, an incomplete canonical current tree, duplicate catalogue/manifest/receipt paths, or rewritten retained release authority.

## Parent review assumptions before first use

- The publishing controller continues to use `.github/workflows/publish-frozen-pages.yml`, the existing nine authority models, `main`, `github-pages`, and the canonical main public prefix.
- Publication retains all semantic releases (`retainedReleasesPerMajor: 100`) with **empty `testingRoutes`** and historical bridge count equal to catalogue length minus one. A comparison-only or alternative publication policy requires explicit helper review; it is not silently admitted.
- `retained-catalog.json` pins the 58 versions known in the reviewed source through v0.52. It is a minimum immutable-history safeguard, not a prediction of the future catalogue length. Parent must independently confirm all later releases, including any v0.53/v0.54 additions, are in the exact hosted catalogue before reviewing its binding.
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
