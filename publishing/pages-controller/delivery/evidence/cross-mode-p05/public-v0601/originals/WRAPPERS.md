# Explicitly bound v0.60.0 intake and refresh proposal

Cache-only adaptation from the accepted v0.59.1 helper set. No network or production audit has run. Nine injected-runner wrapper tests and the core mock self-check pass; these are tooling checks, not release acceptance.

Original predecessor bodies are retained under `original-upstream-context/predecessor/`; `original-upstream-context/predecessor-pins.json` and `original-upstream-context/adaptation.diff` identify exact changes. The HTTP engine, observer, row reconciler, intake wrapper and refresh wrapper are byte-identical. The core auditor changes only the reviewed source/version/catalog constants and adds `binding.reviewed === true`; a request/binding SHA remains mandatory. No default binding or deployment IDs exist.

The immediately preceding 02127 proposal is preserved in `prior-proposal-originals/`; `source-constant-adaptation.diff` shows this successor’s only executable differences (SOURCE/TREE constants in three files). `prior-proposal-pins.json` pins the unchanged parent proposal.

All commands below use the audit directory:

```
/Users/oleksandr.mekhovov/work/my_projects/go_test/.cache/p05-supporting-public-audit-170508f1
```

Every uppercase `ACTUAL_*` or `UNIQUE_*` value below is a required reviewed value, not a default. Do not execute template values. Use a fresh output label for each attempt; failures and originals are retained and never overwritten.

## 1. Observe the actual successful Pages deployment

```sh
python3 -B /Users/oleksandr.mekhovov/work/my_projects/go_test/.cache/p05-supporting-public-audit-170508f1/observe-hosted.failure-retention.py UNIQUE_BEFORE_LABEL ACTUAL_PUBLISHER_COMMIT ACTUAL_PUBLISHER_TREE ACTUAL_PAGES_RUN_ID
```

Copy the actual original GitHub release API body for v0.60.0 into this cache, preserving its bytes. The request must reference that original and `hosted-observation-UNIQUE_BEFORE_LABEL/record.json`. Each descriptor has exactly `path`, `bytes`, `sha256`; paths are relative to this cache, ordinary single-link files, without traversal or symlinks. The observer record pins all its original response and attempt files, which are rehashed by intake.

Prepare an actual request JSON file inside this cache with exactly these fields:

```json
{
  "format": "revealline-public-intake-request.v1",
  "reviewed": true,
  "outputLabel": "UNIQUE_INTAKE_LABEL",
  "currentVersion": "v0.60.0",
  "gameSourceRevision": "170508f11dd41204b7e24917a823f21701c15961",
  "qualifiedSourceTree": "287ea0fddf97f594af0ce9eba452a24dc5f507c7",
  "controllerCommit": "ACTUAL_PUBLISHER_COMMIT",
  "controllerTree": "ACTUAL_PUBLISHER_TREE",
  "runId": "ACTUAL_INTEGER_REQUIRED",
  "deploymentId": "ACTUAL_INTEGER_REQUIRED",
  "latestSuccessStatusId": "ACTUAL_INTEGER_REQUIRED",
  "receiptArtifact": {
    "id": "ACTUAL_INTEGER_REQUIRED",
    "bytes": "ACTUAL_INTEGER_REQUIRED",
    "sha256": "ACTUAL_BARE_SHA256"
  },
  "hostedObservation": {
    "path": "hosted-observation-UNIQUE_BEFORE_LABEL/record.json",
    "bytes": "ACTUAL_INTEGER_REQUIRED",
    "sha256": "ACTUAL_BARE_SHA256"
  },
  "publishedRelease": {
    "path": "ACTUAL_ORIGINAL_RELEASE_PATH.json",
    "bytes": "ACTUAL_INTEGER_REQUIRED",
    "sha256": "ACTUAL_BARE_SHA256"
  }
}
```

Replace all integer placeholders with actual JSON integers. Independently review the request, original response bodies, successful main run/deployment linkage and receipt artifact descriptor. Hash the exact reviewed request bytes, then run:

```sh
python3 -B /Users/oleksandr.mekhovov/work/my_projects/go_test/.cache/p05-supporting-public-audit-170508f1/intake-live.py ACTUAL_ABSOLUTE_INTAKE_REQUEST ACTUAL_REVIEWED_REQUEST_SHA256
```

Intake downloads only the small `frozen-pages-receipts` archive using the actual artifact ID. Its compressed size/digest are checked against the reviewed descriptor, with a strict size below 10 MiB and expanded total at most 64,000,000 bytes. Those are accepted-size checks; the subprocess has a 60-second timeout and preserves its output, rather than a streaming byte cutoff. Exact receipt members and bounded original Git API wrappers/bodies are retained. It follows the committed selector's actual qualification path and matches manifest, release and qualification bytes to the published original asset digests.

Output includes:

- `receipt-intake-UNIQUE_INTAKE_LABEL/`: original request/release/ZIP/members/API responses, prepared inputs and result.
- `tools/inputs/ACTUAL_PUBLISHER_COMMIT/`: nine original JSON bodies and `binding.unreviewed.json` with `reviewed: false`.

There is deliberately no automatically approved `binding.json`. Root must review the complete nine originals and linkage, exact qualification/source identity, retained 70 catalog entries, archive15 retention admission and inventory. Only after that independent review should root write the approved `binding.json` with `reviewed: true`, preserve the review record and compute its exact SHA256. No wrapper result performs browser or phase acceptance.

## 2. Run the bounded byte audit and independent reconciliation

`NODE` means the actual reviewed Node binary. Retain stdout/stderr and exit status for each call.

```sh
NODE /Users/oleksandr.mekhovov/work/my_projects/go_test/.cache/p05-supporting-public-audit-170508f1/tools/audit-main.mjs --binding ACTUAL_ABSOLUTE_BINDING --binding-sha ACTUAL_REVIEWED_BINDING_SHA256 --check
NODE /Users/oleksandr.mekhovov/work/my_projects/go_test/.cache/p05-supporting-public-audit-170508f1/tools/audit-main.mjs --binding ACTUAL_ABSOLUTE_BINDING --binding-sha ACTUAL_REVIEWED_BINDING_SHA256 --out complete-1
python3 -B /Users/oleksandr.mekhovov/work/my_projects/go_test/.cache/p05-supporting-public-audit-170508f1/review-public.py ACTUAL_PUBLISHER_COMMIT complete-1
```

A critical subset is not sufficient. The refresh wrapper requires the successful full report, unchanged authorities, complete bytes and independently reconciled rows. The review output is `public-row-review-complete-1.json`.

## 3. Observe again after the complete audit and refresh

```sh
python3 -B /Users/oleksandr.mekhovov/work/my_projects/go_test/.cache/p05-supporting-public-audit-170508f1/observe-hosted.failure-retention.py UNIQUE_AFTER_LABEL ACTUAL_PUBLISHER_COMMIT ACTUAL_PUBLISHER_TREE ACTUAL_PAGES_RUN_ID
```

The fresh observer timestamp must be at or after `report.finishedAt`. Prepare a second actual request inside this cache with exactly these fields. Every `PIN` below is a complete `{path,bytes,sha256}` object with actual values, not a string:

```json
{
  "format": "revealline-public-refresh-request.v1",
  "reviewed": true,
  "outputLabel": "UNIQUE_REFRESH_LABEL",
  "binding": "PIN: tools/inputs/ACTUAL_PUBLISHER_COMMIT/binding.json",
  "report": "PIN: tools/runs/complete-1/report.json",
  "rowReview": "PIN: public-row-review-complete-1.json",
  "hostedObservation": "PIN: hosted-observation-UNIQUE_AFTER_LABEL/record.json",
  "publishedRelease": "PIN: same actual original release JSON used for intake"
}
```

After independent review and hashing of the exact request:

```sh
python3 -B /Users/oleksandr.mekhovov/work/my_projects/go_test/.cache/p05-supporting-public-audit-170508f1/refresh-after-http.py ACTUAL_ABSOLUTE_REFRESH_REQUEST ACTUAL_REVIEWED_REQUEST_SHA256
```

Output is `after-http-authorities-UNIQUE_REFRESH_LABEL/`. It preserves six bounded API originals and checks latest/current release, all nine original asset descriptors, tag/ref, frozen source tree and latest deployment against actual originals. Each API subprocess has a 35-second timeout, strict accepted stdout/stderr sizes below 2,000,000 bytes, at most four concurrent calls and retained failure/partial receipts. The final result only confirms unchanged live authorities after a full audit; browser, offline, controller, touch and phase acceptance remain separate.

## Mock-only reproduction

```sh
python3 -B -m unittest discover -s /Users/oleksandr.mekhovov/work/my_projects/go_test/.cache/p05-supporting-public-audit-170508f1 -p test_wrappers.py -v
```

These tests inject all HTTP/API responses. No network, production source, index or remote writes occur. Invalid/missing review fields, wrong request digest, stale/mismatched evidence, changed ZIP, unsafe archive member, timed-out API, incomplete audit and changed release assets cannot produce an accepted output.
