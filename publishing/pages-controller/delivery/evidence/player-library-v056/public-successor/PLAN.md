# v0.56 public audit after Archive12 admission

Prepared only. No new production controller, run, deployment or hosted inventory is bound; no network requests or browser actions have started. Root will provide the actual production run after the reviewed Archive12 admission merges. The earlier `../v056-public-audit/` remains unchanged.

The existing v0.56 auditor and HTTP engine can be reused byte-for-byte. This directory contains their exact copies, the original self-check, retained catalogue baseline and qualification reference. `preparation.json` verifies each against the prior sealed public completion. No new network protocol, game build, archive extraction or source checkout is needed.

## Fixed identity and prior comparison

- Game version/source remain `v0.56.0` / `20f017963e6f3875ce6388a198a6fb601e0aea40`, tree `b48ab534db3a202ee070802957944fa898d864ef`.
- Canonical qualification remains 6,380 bytes / SHA-256 `9f02b6c92499a9f88e1b874366d3719c6dfb878ff460e50b2800259b4af68cfc`.
- Exact original manifest remains 120,574 bytes / `e64c601809366ad5122ecc09d02dc597af410f934e81f75da86b0c75876b0de5`; original release record 465 bytes / `a3d3f7c09a1c464629c7bc40349fecd0a7536b90e017ba6256e1902657f434b3`. These prior independently verified bodies can be copied unchanged into the future binding, after rechecking their pins. They are not regenerated from a summary.
- Prior verified deployment: controller `02364d4ad8832a4693e184f6d36c46dfabd58ef6`, run `34950891496`, deployment `6455476355`.
- Prior full public result: **2,337 rows / 635,636,681 decoded bytes**, zero failures/retries/skips. Its expected inventory SHA-256 is `45c0d50ceb298ea1b91fbf9fea916bb16c2d55cd116a299397a702552f42f707`. The successor may be identical, but that is a hypothesis until its actual hosted receipt is authenticated and compared.

## Admission sequence

1. Root supplies the actual merged controller SHA and successful main `.github/workflows/publish-frozen-pages.yml` run. Retain authenticated run/jobs, exact Pages deployment and latest successful statuses with their linkage. Verify `head_sha`, `main`, source tree and environment URL; neither a PR preview nor an old successful deployment substitutes for this run. If the merge object is not local, retain authenticated commit/tree metadata and prove the locally read controller texts have that exact tree authority.
2. Read the new controller's exact `publication.json` and catalogue from Git. Independently verify the intended delta only updates Archive12 infrastructure/evidence, preserving selector056, current source qualification, every catalogue record, archive allocation and runtime-generating inputs. Compare all 61 entries present in the prior deployed catalogue, not just the helper's older 60-entry lower bound. Changes in evidence/configuration hash can be legitimate while public output stays unchanged; list them explicitly.
3. Obtain the actual run's small authenticated receipt artifact. Retain `artifact-receipt.json` and any source-declared companion such as `zip-receipt.json`; use the current workflow's declared names/allowlist. The prior intake refusal omitted that legitimate companion, so do not blindly reuse its incomplete first allowlist. Verify receipt artifact identity/digest and bounded ZIP members before retaining small JSON. Never fetch or extract the bulk Pages artifact for this audit.
4. Reconcile the **entire** successful publishable hosted receipt: controller/tree, game source/tree, catalogue/configuration hashes, current record/manifest/qualification, count, bytes and all file paths including hidden files. Compute inventory SHA from exactly `JSON.stringify(receipt.files, null, 2) + '\n'` in original receipt order. Compare both exact list and a path→size/hash map with the old receipt; distinguish a harmless ordering change from a byte/namespace change. Do not replace the received list with the old expected inventory.
5. If equal, retain an explicit zero-delta comparison to the prior 2,337-row graph. If unequal, retain every added/removed/changed row and its controller-source explanation, then obtain independent review before proceeding. In particular check generated root aliases/worker retirement, the original versioned graph, release explorer, historical bridges, archive metadata routes and all runtime resources. Preserve old originals and their bytes.
6. Write a fresh `inputs/ACTUAL_CONTROLLER_SHA/` containing exactly the nine authorities expected by the unchanged helper: receipt, deployment, statuses, run, manifest, record, qualification, catalogue and configuration. Create the actual `revealline-final-main-public-binding.v1` with unique basename/size/SHA pins and the new inventory hash. No placeholders or guessed deployment values belong in that binding. Run the local `--check`, retain its output, and have a peer read the actual binding SHA plus namespace comparison before full network execution.
7. Sample current main and latest successful Pages deployment immediately before the critical stream; require the same admitted target. Run eight critical identity paths in a fresh output directory. This can report only `PARTIAL_CRITICAL_PASS`. Retain any failure; do not start a full stream from a failed or stale critical binding.
8. After the reviewed binding, critical result and fresh capacity check, stream every hosted inventory row once through the existing bounded retry policy. The new deployment justifies this successor audit; it is not a duplicate audit of unchanged old deployment evidence. Preserve stdout/stderr, all attempts, final results, complete inventory and report under this directory.
9. Reconcile every result against its expected path/bytes/SHA/MIME and actual attempt history, with no missing/duplicate results. Record real failures and retries, not an assumed zero. Recheck helper/input pins and main/deployment after the stream. A deployment change prevents claiming a stable successor window; retain the observations and ask the owner for the current target before any new full run.
10. Seal a new completion with actual controller/run/deployment and comparison to02364. Keep the old completion unchanged. A full equality result preserves the relevance of root's earlier runtime browser observations; it does not relabel them as a new native run. Root may do a fresh title check. If runtime bytes differ, identify that scope before deciding whether additional browser review is needed.

## Commands after actual binding and peer review

Run from this new directory, substituting real values; these are instructions, not executed commands:

```sh
node audit-main.mjs --binding inputs/ACTUAL_CONTROLLER_SHA/binding.json --binding-sha ACTUAL_BINDING_SHA --check
node audit-main.mjs --binding inputs/ACTUAL_CONTROLLER_SHA/binding.json --binding-sha ACTUAL_BINDING_SHA --critical --out critical-ACTUALSHORTSHA-1
node audit-main.mjs --binding inputs/ACTUAL_CONTROLLER_SHA/binding.json --binding-sha ACTUAL_BINDING_SHA --out complete-ACTUALSHORTSHA-1
```

The command uses its own `HOME` for imports, input containment and fresh exclusive `runs/` directories. Copying the few pinned helpers here avoids writing into the old evidence directory. `--check` is read-only/no-network; no new self-check or tests were run during this preparation because the reused code is byte-identical to the qualified helper.

## Resource limits and scope

Preparation uses less than1MiB of new metadata. Before receipt intake or live execution, keep at least256MiB free and admit a maximum16MiB retained metadata/log budget, recalculated against the actual row count. The prior complete audit retained roughly5.44MiB overall. Public bodies are hashed as they stream and are not saved. No game assets, source/distribution archives or full Pages ZIP are materialized; the separate3GiB bulk-work floor is unchanged.

The unchanged engine allows eight workers, 300 seconds per request and at most three attempts for transport failures,429 or5xx. Redirects,404, size/hash mismatch and unapproved MIME do not become accepted successes. Body traffic is about635.6MB if the old inventory remains exact, and retries can increase it. No full rerun is automatic.

This audit checks the main site's complete hosted namespace, including its archive-forwarding payloads. It does not repeat the remote Archive12 body audit, original GitHub release archive verification, audible media tests, offline/disconnected behavior, profile migration or physical-device acceptance. The newly admitted Archive12 evidence remains separately attributable to its own exact deployment.

Current state: **waiting for root's actual production run and binding inputs**. No network started; independent binding/namespace peer required before the full stream.
