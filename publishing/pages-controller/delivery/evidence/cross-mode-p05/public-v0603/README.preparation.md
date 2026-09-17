# v0.60.3 publication and public-audit preparation

Known source: `a13ab970222498d7c5fa7f62f9fc04fe436979d5`, tree `cf744b1ced9680b2fb4e0c304ddfc4b9f44b3e86`. Nine mocked wrapper tests and the core self-check pass. No operational requests, approved bindings, source/index writes or release acceptance were made.

Five helpers are byte-identical to accepted v0.60.2: intake, refresh, hosted observer, row reconciler and HTTP transport. Four change only version/source/tree/catalog literals. `originals/`, `adaptation.diff` and `adaptation-pins.json` preserve that comparison. The optional orchestration template retains explicit UNBOUND publisher, reviewed-binding SHA and inventory-count/byte sentinels; it must not run until actual values are reviewed.

`current-before/` pins the exact c7c4 controller inputs and original published v0.60.2 record. All 73 catalog entries remain immutable; the new catalog should have 74 after v0.60.3 is published. `source-originals/` pins the candidate package/build identity. `retention-expected/` preserves root's reviewed Archive03 configuration/allocation/native binding and review record. These are expected inputs, not an already-adopted publisher.

## Minimal publisher steps after the actual nine release assets exist

1. Root completes the existing qualified-release workflow and source PR87 normal merge. Verify the actual merged tree equals the exact qualified source tree. Keep the frozen tag/source and publisher identities separate. No new workflow or adoption framework is needed.
2. Advance the isolated publisher worktree from the actual source merge, preserving unrelated work. Copy only the 12 reviewed Archive03 files from `../p05-v0603-archive03-admission/root-reviewed/` after rehashing `root-retention-review.json`. Preserve all six prior pins and their original bodies, with old active roles becoming references; 16 Archive03 pins and 17 other admissions remain. Its expected allocation SHA is `26c1006fe8aa4a07259d38dd12ac67b546ae972b6ed9e78fbb0d83cdb2a89414`.
3. Run the existing checked-in helper from that worktree after the release is published:

   ```sh
   node publishing/pages-controller/sync-release-metadata.mjs --versions v0.60.3 --qualification v0.60.3
   ```

   It retains the three original metadata bodies, published qualification at `evidence/current-v0603/source-qualification.json`, and updated catalog. Match all four body hashes/sizes against the actual nine-asset release descriptors. Preserve every previous catalog row. Then update only currentVersion, catalogSha256 and currentSourceQualification in the already-composed publication configuration. The allocation hash comes from the reviewed retention packet, not an invented value.
4. Apply the separate two-document guide patch at `../p05-v0603-retention-plan/explorer-correction/publisher-guidance/publisher-guidance.patch` if root selects it. Stage related hunks/whole binary evidence only. Inspect `git check-ignore -v` for new evidence; a Git ignore rule is not permission to omit an original. Use targeted force-add only where needed and rehash the staged ZIP/JSON blobs against the reviewed originals. Do not stage cache directories or use a broad add-all.
5. Run focused controller checks; commit the reviewed publisher, then verify its clean exact checkout:

   ```sh
   node --test publishing/pages-controller/*.test.mjs
   python3 -B -m unittest discover -s publishing/pages-controller -p 'test_*.py' -v
   node publishing/pages-controller/publish.mjs verify --preview
   ```

   The last command requires committed configuration and a clean checkout. Use the existing source PR/normal exact-head merge process; require hosted preview success and its exact inventory/capacity. A main push supplies the sole automatic Pages deployment. Do not add a duplicate dispatch. Full local payload assembly is unnecessary and would consume constrained disk.

## Actual public-audit sequence

Work from this cache directory. Every `ACTUAL_*` value below must come from retained originals; no previous run/release/deployment ID is a default. Each attempt uses a fresh label and retains stdout, stderr and exit status.

```sh
python3 -B observe-hosted.failure-retention.py before-1 ACTUAL_PUBLISHER_COMMIT ACTUAL_PUBLISHER_TREE ACTUAL_PAGES_RUN_ID
```

After the one Pages run succeeds, copy the actual original published v0.60.3 API body to this cache. Populate a new request from `intake-request.pending.json` with the actual publisher/run/deployment/status, small `frozen-pages-receipts` descriptor, observation and original release pins. Each pin is exactly `{path,bytes,sha256}` relative to this cache. Root reviews the complete request and its hash before setting reviewed:true in a separate file.

```sh
python3 -B intake-live.py ACTUAL_ABSOLUTE_REVIEWED_REQUEST ACTUAL_REQUEST_SHA256
```

Intake returns `tools/inputs/ACTUAL_PUBLISHER_COMMIT/binding.unreviewed.json` and nine exact originals. Review source/tree/qualification and all nine release descriptors; preserve all 73 earlier catalog rows, verify the new 74th row, and compare the actual configuration's Archive03 admission exactly to `retention-expected/publication.json`. Verify the allocation SHA and all other 17 admissions against retained expectations. Only root then creates binding.json and records its exact reviewed SHA. This review is required separately; the unchanged core auditor does not requalify every archive admission body.

Use the actual reviewed Node20 binary. Its full-inventory count and bytes come from the actual hosted artifact receipt and check output, never the predecessor's 2,705-file count.

```sh
NODE tools/audit-main.mjs --binding ACTUAL_ABSOLUTE_BINDING --binding-sha ACTUAL_BINDING_SHA --check
NODE tools/audit-main.mjs --binding ACTUAL_ABSOLUTE_BINDING --binding-sha ACTUAL_BINDING_SHA --out complete-1
python3 -B review-public.py ACTUAL_PUBLISHER_COMMIT complete-1
python3 -B observe-hosted.failure-retention.py after-1 ACTUAL_PUBLISHER_COMMIT ACTUAL_PUBLISHER_TREE ACTUAL_PAGES_RUN_ID
```

Prepare `refresh-request.pending.json` as a separate reviewed request, binding actual binding/report/rowReview/after-observation/published-release descriptors. After-observation must be later than the completed full audit. Root reviews its actual SHA before:

```sh
python3 -B refresh-after-http.py ACTUAL_ABSOLUTE_REFRESH_REQUEST ACTUAL_REQUEST_SHA256
```

Public native checks are separate. Production and Viewport are local supporting tools: do not claim their local browser observations happened on GitHub Pages. Verify the actual current release title/player entry and advertised public routes, retained v0.60.2 archive play/explorer/Back scope, and any applicable changed public components. Keep offline, physical devices, zoom, listening and full P03/P05 acceptance open unless independently established.

## Preserved bounds

The complete inventory has at most 20,000 rows and the unchanged 950 MB cap. HTTP uses eight workers, streamed bodies, a 300-second per-request timeout and at most three attempts for transient failures only. Size/hash/MIME errors are terminal; redirects are refused; payloads are never saved. Small receipt intake requires a reviewed artifact below 10 MiB, exact two-member ZIP and at most 64 MB expanded. Its subprocess timeout and accepted-size checks are preserved; they are not a streaming download cutoff. API calls retain partial failures with a 35-second timeout and strict accepted replies below 2 MB. Authority refresh still requires the complete full audit, independent row reconciliation and unchanged source pins.
