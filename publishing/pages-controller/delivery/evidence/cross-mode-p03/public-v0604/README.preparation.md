# v0.60.4 public-audit preparation

This bounded cache-only adapter targets source `d77ea4f5c2aeccf2ba3bdf483a3f25531f8095b6`, tree `f3a02f9d9e38650f2f9f61ddacd358dfc1f64333`, version `v0.60.4`. Source/tree and the two version files were read from exact Git objects. No release, publisher, Pages run, deployment or public result is assumed. The request templates remain `reviewed: false` with all actual publication fields null. No operational API request, download, public audit or source/index mutation occurred during preparation.

`originals/` preserves the preceding accepted v0.60.3 helpers. `adaptation.diff` contains only four files with source/tree/version/catalog literal substitutions; the count assertion advances from 73 to 74 retained records. Intake, authority refresh, hosted observer, row reconciler and HTTP transport remain byte-identical. The orchestration template is also identical and retains explicit UNBOUND sentinels. `prepare.py` reproduces the small packet into an empty location; its exclusive writes deliberately refuse an in-place rerun.

The nine complete mocked wrapper tests and the core self-check pass, with original output and commands in `checks/`. These are helper checks, not game qualification or public acceptance. The older `current-v0602` label inside the unchanged mock authority fixture is an arbitrary test path; real intake reads the qualification path from the exact future committed selector.

## Retained inputs

`current-before/` contains exact controller configuration, allocation and catalog from main `65a6efcb3bfabf8458702cca452c8120fa756471`. The 74 catalog rows have SHA `17dfb89beca61d09a882fa58cde50810a0617cb1cc59db7388be3254c516a7cc`; a single new v0.60.4 entry should produce 75 rows while retaining every earlier row.

`retention-expected/` contains the accepted Archive19 root decision and the cache-only admission proposal. That proposal preserves 18 existing admissions / 517 pins and adds 13 Archive19 pins. Its allocation SHA is `c07962b9d5b12971026ae1961050a657cf16cc0b0c2aea077892064dd8eea5ff`. These are comparison inputs, not evidence that a publisher has adopted them. Root must compare the actual final publisher configuration with the reviewed packet and preserve unrelated later changes. The actual Archive19 site retains v0.60.3 through commit `397a6069022ce1333ca332b07df86e05b239a2fd` / deployment `6505031581`.

## Observer and audit procedure — blocked on actual identities

Every `ACTUAL_*` value below comes from retained original API/receipt bodies and root review. Do not reuse any predecessor run, release, artifact or deployment ID. Use fresh labels and retain stdout, stderr and exit status, including failures. Observe only the actual automatic main-push Pages run; do not dispatch another workflow.

1. Once root supplies the final publisher commit/tree and actual Pages run, take a bounded read-only snapshot from this directory:

   ```sh
   python3 -B observe-hosted.failure-retention.py before-1 ACTUAL_PUBLISHER_COMMIT ACTUAL_PUBLISHER_TREE ACTUAL_PAGES_RUN_ID
   ```

   The successful terminal observation must identify the actual main head/tree, successful jobs and deployment/status, and small `frozen-pages-receipts` artifact. Before terminal completion, use a new label for any later observation; do not treat missing receipt/deployment fields as accepted. Keep polling at least 60 seconds apart.

2. Retain the actual published v0.60.4 release API body. Fill a separate intake proposal from `intake-request.pending.json`, pinning that body and the observation's `record.json` with exact `{path, bytes, sha256}` descriptors. Set actual controller/run/deployment/status and receipt artifact ID/size/SHA from those originals. Root reviews and writes a separate `reviewed: true` request, then runs:

   ```sh
   python3 -B intake-live.py ACTUAL_ABSOLUTE_REVIEWED_REQUEST ACTUAL_REQUEST_SHA256
   ```

   Intake downloads only the bounded original receipt ZIP and small Git API bodies; it produces an **unreviewed** nine-authority binding. It never approves its own binding.

3. Root checks the exact source/tree/qualification, published nine-asset identity, full hosted inventory, preserved 74 catalog rows and single new entry. Separately verify the actual allocation and every admission against the reviewed Archive19 candidate. The core HTTP auditor does not requalify every archive-admission body. Only after review create `tools/inputs/ACTUAL_PUBLISHER_COMMIT/binding.json` and record its SHA in the root review.

4. Read the complete inventory count/bytes from the actual receipt. Run the unchanged Node 20.19.5 pipeline; there is no predecessor file-count default:

   ```sh
   NODE tools/audit-main.mjs --binding ACTUAL_ABSOLUTE_BINDING --binding-sha ACTUAL_BINDING_SHA --check
   NODE tools/audit-main.mjs --binding ACTUAL_ABSOLUTE_BINDING --binding-sha ACTUAL_BINDING_SHA --out complete-1
   python3 -B review-public.py ACTUAL_PUBLISHER_COMMIT complete-1
   python3 -B observe-hosted.failure-retention.py after-1 ACTUAL_PUBLISHER_COMMIT ACTUAL_PUBLISHER_TREE ACTUAL_PAGES_RUN_ID
   ```

   `run-reviewed-public.py.template` is an optional orchestration template, not executable authority. Its publisher, binding SHA, expected count and expected bytes all remain UNBOUND. Do not execute it as prepared.

5. The after-observation must be later than full HTTP completion. Create a separate refresh proposal from `refresh-request.pending.json`, pinning the actual reviewed binding, full report, independent row review, after-observation and release original. After root review:

   ```sh
   python3 -B refresh-after-http.py ACTUAL_ABSOLUTE_REFRESH_REQUEST ACTUAL_REQUEST_SHA256
   ```

   This checks live source/release/tag/deployment authorities after HTTP. A successful HTTP audit alone cannot prove that those live authorities remained current.

## Unchanged bounds and acceptance limits

All inventory rows, including hidden metadata, aliases, workers and retained-version bridges, remain required. Limits stay at 20,000 rows / 950,000,000 bytes; eight streaming workers; 300-second per-request timeout; up to three attempts for transient failures only. Wrong hashes, sizes, MIME or redirects are terminal. Payload files are never saved. The receipt ZIP remains below 10 MiB compressed, exactly two allowed members and at most 64 MB expanded. Its subprocess timeout and accepted-size check are unchanged; they are not a streaming download cutoff. API calls retain partial failures with a 35-second timeout and accepted replies below 2 MB.

Native Recovery checks remain separate: actual ready/error/loading Back, Find/Review/Export focus and ordinary history return on the public route. Modeled `pageshow.persisted` tests do not establish that a native browser used BFCache. Existing same-origin profiles, mixed keyboard/semantic clicks, physical controllers/touch, zoom, offline recovery and P03/P05 completion must retain their own evidence boundaries. Preparation creates neither a new Recovery entry route nor public tool buttons.
