# Final main every-byte HTTP audit

This cache-only helper is prepared for the final **v0.51.0** main publication. It has not fetched a public URL. Its source/body authority is the exact frozen `5d4bd98718955fa471fe71d798715864af166d18` / tree `37331db1a89526aedffd25ae979b7378a1a707fc`; the publishing controller commit is supplied separately only when the final hosted publication succeeds.

The HTTP inspector is extracted from the reviewed Archive09 auditor; its source SHA and changes are in `engine-provenance.json`. It streams decoded bodies, checks exact size/SHA256 and required MIME, requests no redirects, and never writes bodies or modifies remote state. Eight workers use a 300-second body deadline. Each body gets at most three attempts, retrying only network/timeouts/429/5xx. Hash, MIME, oversize and 404 failures do not retry. Every attempt and final row remains in exclusive run directories.

## Prepare exact authority after final publication

1. Create a new ordinary directory at `inputs/FINAL_CONTROLLER_COMMIT/`. Do not use symlinks.
2. Copy the nine small original evidence files below into it. Preserve bytes. The hosted `artifact-receipt.json` must be taken from the successful final `frozen-pages-receipts` artifact after its outer artifact SHA/identity is independently checked. Do not substitute a PR preview or locally predicted receipt. Separately capture the successful publication run and exact deployment/status API snapshots; this helper performs no GitHub API calls.
3. Create `binding.json` using the following shape, filling actual controller/deployment/run identities and exact file byte counts/SHA256. The field `inventorySha256` is SHA256 of `JSON.stringify(receipt.files, null, 2) + '\n'`, in the receipt's original row order. It binds the **whole** artifact inventory, including generated root aliases and retirement workers, current canonical originals, all57-version historical bridges, catalog assets and hidden files.
4. Independently review and record the binding file SHA256. Run `--check` before any HTTP. Do not create a binding with dummy identities or pass an incomplete publication as accepted.

```json
{
  "format": "revealline-final-main-public-binding.v1",
  "base": "https://mekhovov.github.io/revealline/",
  "currentVersion": "v0.51.0",
  "gameSourceRevision": "5d4bd98718955fa471fe71d798715864af166d18",
  "qualifiedSourceTree": "37331db1a89526aedffd25ae979b7378a1a707fc",
  "controllerCommit": "ACTUAL_FINAL_40_HEX_COMMIT",
  "controllerTree": "ACTUAL_FINAL_40_HEX_TREE",
  "deploymentId": "REPLACE_WITH_INTEGER",
  "runId": "REPLACE_WITH_INTEGER",
  "inventorySha256": "ACTUAL_64_HEX_SHA",
  "pins": {
    "receipt": { "path": "artifact-receipt.json", "bytes": "INTEGER", "sha256": "SHA256" },
    "deployment": { "path": "deployment.json", "bytes": "INTEGER", "sha256": "SHA256" },
    "statuses": { "path": "deployment-statuses.json", "bytes": "INTEGER", "sha256": "SHA256" },
    "run": { "path": "run.json", "bytes": "INTEGER", "sha256": "SHA256" },
    "manifest": { "path": "manifest.json", "bytes": 113770, "sha256": "69bf17d6a635eb69f65b8e765832091c9c0525f7191e950f5053126b894a0dc3" },
    "record": { "path": "release.json", "bytes": 465, "sha256": "c7cbd9192b9326cdd3541a24736ed91dadcb42a2666c372ab4475da02a93c541" },
    "qualification": { "path": "source-qualification.json", "bytes": 21221, "sha256": "73338bc1960f17f4e97daec43c1227470653ad92d392482e4afa98898bc3e2d0" },
    "catalog": { "path": "catalog.json", "bytes": "INTEGER", "sha256": "ea9d39ac3271d41354bd17ab12c75f4aef8910b3c45e5c21f7bb79386060cea5" },
    "configuration": { "path": "publication.json", "bytes": "INTEGER", "sha256": "EXACT_CONTROLLER_SELECTOR_SHA256" }
  }
}
```

The API snapshots must identify `mekhovov/revealline`, main, the exact publishing controller, a successful `.github/workflows/publish-frozen-pages.yml` run and a successful `github-pages` deployment linked to that run. A latest status from another deployment or run fails. The current canonical inventory is separately cross-checked against all 614 original manifest files plus its manifest, checksum and ownership marker; the canonical original release record is also exact. The main version set must match all57 exact catalog pins, including v0.42, with56historical bridges. The pinned selector must use retention100. Its exact testingRoutes and the receipt testingVersions count distinguish main5f905’s comparison-only49/50 routes (2) from a later fully admitted controller (0); this HTTP tool never turns the former into native admission. No arbitrary base URL is accepted.

The three frozen source files, exact57catalog and reviewed main5f905 selector are also retained under `fixtures/` for small deterministic tests. They are original metadata only; synthetic test controller/deployment declarations never enter production input directories or real audit reports.

## Commands after binding review

Run from the primary workspace, replacing `FINAL` and `REVIEWED_BINDING_SHA` with the reviewed actual values:

```sh
node .cache/fpv-redesign/final-main-public-audit/audit-main.mjs --binding .cache/fpv-redesign/final-main-public-audit/inputs/FINAL/binding.json --binding-sha REVIEWED_BINDING_SHA --check
node .cache/fpv-redesign/final-main-public-audit/audit-main.mjs --binding .cache/fpv-redesign/final-main-public-audit/inputs/FINAL/binding.json --binding-sha REVIEWED_BINDING_SHA --critical --out critical-1
node .cache/fpv-redesign/final-main-public-audit/audit-main.mjs --binding .cache/fpv-redesign/final-main-public-audit/inputs/FINAL/binding.json --binding-sha REVIEWED_BINDING_SHA --out complete-1
```

`--check` performs zero network requests and writes no output files. `--critical` inspects eight pinned files: root and canonical v0.51 `release.json`, `game/build-info.json`, `game/index.html` and `manifest.json`. Its success is always `PARTIAL_CRITICAL_PASS`, with an explicit count of uninspected files. That may allow independent provisional browser journeys to begin; it is **not** an every-byte pass or public admission.

Full mode inspects every hosted receipt member with no hidden-file omissions. A failure returns a nonzero exit code and retains failed attempts/results. A new complete retry uses a new run name; this helper does not splice prior successes into an artificial pass. Source inputs and helper hashes are reread after inspection. Prior run names fail rather than overwrite evidence.

API snapshots identify the accepted deployment at capture time. They do not claim a live API poll throughout the audit. The caller must retain the independently verified hosted artifact transport/capture proof, review final source/deployment identity, and coordinate any subsequent controller deployment. Even full HTTP `PASS` establishes only decoded public bytes and MIME. Browser execution, offline preparation/reload, save/old-entry migration and physical-device behavior require separate evidence. The newer main5f905 policy restores every currently cataloged semantic release path. Main and direct canonical archive journeys remain separate, and preserved browser installations are not substitutes for cold HTTP checks.

## Tiny checks

```sh
node --test .cache/fpv-redesign/final-main-public-audit/test-audit-main.mjs
```

Tests use in-memory HTTP responses and temporary metadata only. They cover pinned source/controller/deployment refusals, complete canonical inventory, traversal/duplicate/symlink authority, streamed hash/MIME/size/redirect rejection, retry bounds and preserved failure rows, eight-worker limit, zero-network `--check`, partial/full distinction, exclusive output, hidden coverage and changed authorities. Tests do not fetch public URLs or rebuild payloads.

## Main37 policy update

The initial five-release policy helper and receipts are preserved under `history/policy-five-v1/`. The current helper follows reviewed main `5f905b1b4ac60206c1fa15ddfedd9b2add5ac04d`: all57 frozen semantic versions,56historical bridges, retention100, exact source5d4. `catalog` and `configuration` are additional required authority pins. The actual hosted receipt and controller selector must agree on comparison-only versions, so the same code can honestly audit the existing comparison policy and its fully admitted successor. No public requests were made during this adaptation.
