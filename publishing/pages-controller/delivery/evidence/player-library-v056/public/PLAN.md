# v0.56 public HTTP audit — prepared, not executed

Target: `https://mekhovov.github.io/revealline/`, version `v0.56.0`, game
source `20f017963e6f3875ce6388a198a6fb601e0aea40`, tree
`b48ab534db3a202ee070802957944fa898d864ef`.
No deployed controller/run is pinned yet. `inputs/` is empty. No binding, public
observation, source build, archive copy or publication has been created.

This reuses P00's public-v055 auditor and byte-identical HTTP engine. The two P00
copies named in `preparation-provenance.json` matched before intake. Changes are
limited to the fixed v056 identity, the actual canonical source-qualification
shape, and the immutable-history baseline. The latter is all 60 entries from
committed controller `da4459b706555007468d053a578caa215d08eca3`; every original
field must survive in the actual deployed catalogue. Future catalogue additions
must be independently accounted for rather than omitted from this lower bound.

## Required authority after deployment

Wait for the reviewed v056 selector to be on main and its exact
`publish-frozen-pages.yml` run/deployment to complete successfully. The release
and tag alone do not establish public deployment. Root must coordinate other
publishers and check current deployment identity immediately before and after
the body audit; retained API snapshots do not provide a continuous lock.

Under `inputs/ACTUAL_CONTROLLER_COMMIT/`, preserve exactly these nine original
small files without formatting:

| Role | Required source |
| --- | --- |
| receipt | Actual successful hosted `artifact-receipt.json`, from the publication run's authenticated receipt artifact; complete `files` inventory, publishable true. |
| deployment | Exact Pages deployment API response for that controller commit and `github-pages`. |
| statuses | That deployment's statuses, newest first; latest state success and main environment URL. |
| run | Completed successful main publisher run linked to that deployment. |
| manifest | Exact original v056 frozen manifest, independently authenticated against original release metadata/verification. |
| record | Exact original v056 `release.json`. |
| qualification | Canonical `source-qualification.json`, unchanged 6,380 bytes, SHA256 `9f02b6c92499a9f88e1b874366d3719c6dfb878ff460e50b2800259b4af68cfc`. |
| catalog | `catalog.json` from the actual controller commit. |
| configuration | `publication.json` from that same controller commit. |

The successful freeze handoff is supplemental evidence; it must not replace the
six-gate source qualification. Its reported manifest SHA is
`e64c601809366ad5122ecc09d02dc597af410f934e81f75da86b0c75876b0de5`
and original distribution SHA is
`e4a8997bf9203e038e6b43ee29393dec1413a482e048206ffe861f0945c20f30`.
These are frozen CLI observations until the separate original-byte verifier
finishes. Do not manufacture original metadata from the CLI's printed object.

Create the existing `revealline-final-main-public-binding.v1` only after all nine
actual inputs exist and are independently reviewed. Its fields are base,
currentVersion, gameSourceRevision, qualifiedSourceTree, actual controllerCommit,
controllerTree, deploymentId, runId, inventorySha256, and exactly nine distinct
basename/size/SHA pins. `inventorySha256` is SHA256 of UTF-8
`JSON.stringify(receipt.files, null, 2) + '\n'` in the original receipt order.
Record and review the binding's own SHA. No placeholder can pass as authority.

## Full expected-byte reconciliation

Use **every row of the actual hosted receipt**, including hidden files. Before
approving the binding, reconcile its provenance and namespace as follows:

- The current canonical prefix `releases/v0.56.0/site/` must equal the original
  manifest rows plus unchanged `manifest.json`, generated ownership marker and
  exact original ZIP-checksum line. No extra canonical file is accepted. Its
  sibling `release.json` must equal the original record bytes.
- All 60 retained catalogue identities, plus v056 and any separately reviewed new
  releases, must be preserved. Every visible `releases/V/` version must match the
  actual catalogue, and every historical release-record hash must match it.
- Root graph copies, generated current-entry aliases, root retirement worker,
  original current worker, release explorer, historical HTML bridges, routing
  metadata, original record/manifest bridges and hidden files are expected from
  the **complete hosted controller inventory**, not only the game manifest.
  Reconcile the authenticated controller's generated namespace/bridge count with
  its pinned catalogue and original manifest authority; record any unexplained
  path/omission before approving the binding. No locally predicted inventory or
  PR preview can replace the successful hosted `verify-artifact` output.
- The helper verifies each expected row's direct HTTP200 decoded byte count,
  SHA256 and approved MIME. Generated aliases are hashed against their generated
  hosted-receipt bytes; they must not be compared to the original HTML they wrap.
  Historical bridge payloads are checked at main; this is not a repeated body
  audit of the full remote archive targets.

The helper cross-checks current original bytes, all record hashes, catalogue
retention, source qualification, deployment/run linkage, full receipt total/hash,
version namespace and required aliases/workers. The independent binding review
supplies the authenticated hosted receipt and controller-generated namespace
reconciliation; the HTTP checker does not rebuild the controller or historical
games. Every receipt row is then streamed, with no sampling or namespace exclusion.

The existing policy expects `retainedReleasesPerMajor: 100`, enabled deployment,
empty testingRoutes, and historicalBridges equal to catalogue count minus one.
A different reviewed policy or new MIME type requires a narrow explicit adapter
review; it is not silently accepted.

## Commands after actual binding review

From this directory, use actual values in place of the uppercase placeholders:

```sh
node audit-main.mjs --binding inputs/CONTROLLER_COMMIT/binding.json --binding-sha BINDING_SHA --check
node audit-main.mjs --binding inputs/CONTROLLER_COMMIT/binding.json --binding-sha BINDING_SHA --critical --out critical-1
node audit-main.mjs --binding inputs/CONTROLLER_COMMIT/binding.json --binding-sha BINDING_SHA --out complete-1
```

`--check` has no network/write effects. Critical mode checks only eight identity
files and must remain `PARTIAL_CRITICAL_PASS`, never a full audit. The complete
run uses all receipt rows and retains each attempt/result, inventory and report
in a fresh exclusive `runs/NAME/`; old failures are never overwritten or spliced
into a later pass. Root can start native smoke after the critical pass, while the
full streamed audit continues independently.

The unchanged engine uses eight workers and 300-second per-request deadlines.
Up to three attempts occur only for transport failures/timeouts/429/5xx, with
bounded delays; SHA, MIME, oversized-body and404 failures do not retry. The owner
must review any failure rather than launch another complete run automatically.
No response body or original ZIP is retained. Byte traffic can approach the whole
950,000,000-byte main artifact and retries can increase it; this is not a small
network request. Authority and helper hashes are checked again at completion.

Preparation uses at most2MiB new small text with a fresh256MiB free-space reserve.
For live audit, first estimate retained JSON from the actual row count (inventory,
up to3attempts and final results); reserve16MiB metadata and keep256MiB free. This
is an operational admission, not an added hidden engine limit. The unchanged
engine has a20,000-row/950MB expected-artifact cap and fails unknown MIME extensions.
No full artifact download or build is needed. The separate3GiB bulk-operation
floor is unchanged.

## Completed preparation checks and limits

Node22.22.2 syntax checks and the reused mock-only self-check passed. Four negative
mutations of the actual canonical qualification also refuse. No real network
request, production binding, public receipt, game runtime execution or build occurred.
`preparation-checks.json` retains commands and raw outputs. A full public HTTP PASS
would prove decoded bytes/MIME only; browser play, loading, save/restore, offline,
readability and physical-device acceptance remain separate root-owned checks.
