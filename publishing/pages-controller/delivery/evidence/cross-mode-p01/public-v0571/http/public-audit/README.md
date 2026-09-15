# Prepared v0.57.1 complete public-byte auditor

Preparation only. No current publication binding, HTTP audit, deployment or passing source qualification has been created.

Fixed candidate source: `4c85277ac7393eeeabab035387d4d4ae8734aba1`, tree `d3549d0efd15529f71f4cff9a940bdda5e84f3a6`, version `v0.57.1`. Only public prefix: `https://mekhovov.github.io/revealline/`. These candidate identities do not imply successful qualification; if source changes, preserve this preparation and review a newly rebound helper.

The retained catalogue is the exact 62-entry catalogue from published main `74f289510617603c28768bb3f6bfd8e9f7a72cdd` through v0.57.0, byte-equal in the candidate source. Every retained row must remain unchanged in the eventual catalogue. The streaming engine is byte-identical to the completed R4 helper. Only source/tree/version, retained catalogue/hash/count and this documentation are rebound. No old inputs, bindings, runs, completion or pass reports were copied.

## Required authority before execution

After actual successful publication, create `inputs/ACTUAL_CONTROLLER_COMMIT/` using nine distinct, byte-preserved, verified original JSON files:

1. `receipt`: original successful hosted artifact receipt, with authenticated receipt artifact transport verified separately. Preview/local prediction is invalid.
2. `deployment`: actual GitHub Pages deployment API response.
3. `statuses`: its latest successful status array.
4. `run`: the linked successful main publisher run.
5. `manifest`: actual immutable v0.57.1 frozen manifest.
6. `record`: its immutable release record.
7. `qualification`: actual successful exact-checkout six-gate source qualification, including actualCheckoutCommit/tree, genuine gate success steps and source/tree identity.
8. `catalog`: exact full catalogue from the actual committed publishing controller.
9. `configuration`: exact publication.json from that controller, selecting v0.57.1.

Independently review an actual `revealline-final-main-public-binding.v1` binding with base/version/source/tree, controller commit/tree, actual run/deployment IDs, complete receipt inventory hash and all nine exact size/SHA pins. Use the immutable raw role bytes; never replace these with generated expected authority or prior release evidence. The inventory hash is SHA-256 of UTF-8 `JSON.stringify(receipt.files, null, 2) + '\n'` in original order. It includes every root alias, current canonical file, historical bridge and record, worker, hidden marker and metadata file in the actual hosted receipt.

The unmodified guards require publishable main authority, linked successful deployment/run, exact source and six gates, full retained history, canonical original current bytes, unique bounded paths, all manifest rows, correct metadata and unknown-MIME refusal. The policy remains 950MB main / 800MB individual body, 100 retained versions per major, no testingRoutes. Changed schema/policy needs explicit helper review. Root separately validates all archive admission/allocation evidence; this helper does not fabricate the still-unknown final controller or release.

## After independent binding approval only

From this directory, using real paths/hashes:

```sh
node audit-main.mjs --binding inputs/ACTUAL_CONTROLLER_COMMIT/binding.json --binding-sha REVIEWED_SHA --check
node audit-main.mjs --binding inputs/ACTUAL_CONTROLLER_COMMIT/binding.json --binding-sha REVIEWED_SHA --out complete-1
```

`--check` performs zero network requests and no result writes. Optional `--critical --out critical-1` is strictly a partial identity probe and cannot replace the complete pass. No requests may begin before root approves actual authority.

Full mode streams every receipt body; no expanded site or payload files persist. Eight workers, 300-second request deadlines, at most three bounded retries for transport/timeout/429/5xx only. Redirect, 404, hash, MIME and oversized failures do not retry. Attempts/final rows go into a new exclusive run directory, never overwritten/spliced. Both helper and authority pins are rechecked at finish. Main/deployment API should be rechecked after audit separately.

HTTP passes prove body/MIME/inventory only. Browser, offline, physical input, storage and UX evidence remain separate. The known v0.57.0 portrait defect and earlier failed attempts remain historical evidence; no prior acceptance transfers to this patch.

## Local preparation checks only

```sh
node --check audit-main.mjs
node --check http-engine.mjs
node --check self-check.mjs
node self-check.mjs
```

These use in-memory fetch responses and empty temporary directories. They create no production binding and make no real network request. End-to-end authority validation intentionally remains unavailable until genuine final authorities exist.
