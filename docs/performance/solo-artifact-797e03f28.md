# Optional Missions chooser delivery — 18 October 2026

[PR #1584](https://github.com/mekhovov/revealline/pull/1584) merged as `c8b607dba8b55ee752bcfd4de2cef80074ae4bee` at 07:08:54 UTC. Its checked head is `797e03f28743921842df6aa57520a72016ba3dfc`, tree `bd53120f0cdfa462b8d63c2de5aa61e9c6658ac5`.

The two-file change moves the Missions chooser import into the existing guarded async Missions owner. A fresh-process refusal test verifies that direct Start, Pause and Resume still work with the chooser unavailable; explicitly opening Missions shows retry guidance while preserving the paused run. Both complete affected source-host files pass 7/7, with the regression failing against the old eager import. Seven modules (80,317 served decoded bytes) leave the eager module graph. These are dependency and correctness results, not a measured startup speedup or an explanation of the earlier public module-fetch failure.

All applicable head checks passed: the four source shards and release gate, all six Industrial features, Company candidate and optional practice, and all Appearance prerequisites. [Appearance run 39104551453](https://github.com/mekhovov/revealline/actions/runs/39104551453) passed its complete 118-file gate **1,756/1,756**, with no failures, cancellation or skips, and built the production package. The retained raw preview log is 819,011 bytes, SHA-256 `5b70aa447862a2210da0608011b9e4cd0e12537741ecfa755896f3632624798a`; its lossless gzip and readback receipt are under `.cache/solo-followup/797-package/`.

The compact metadata archive `12128970750` is 37,136 bytes, SHA-256 `035cab60bfa3eed7f56a6d9988405c81e14acf9ff5599f0353e980f23fde4263`. Its five members, ZIP CRCs, metadata hash list, source/tree, build identity and full-artifact API identity were independently verified. The first local inspection incorrectly treated its checksum text member as JSON; that parser attempt stopped after archive verification. Corrected member-aware inspection passed. No full package was downloaded locally.

Exact candidate pins:

```json
{
  "revision": "797e03f28743921842df6aa57520a72016ba3dfc",
  "tree": "bd53120f0cdfa462b8d63c2de5aa61e9c6658ac5",
  "run": 39104551453,
  "artifact": 12128990483,
  "outer": {
    "bytes": 1094639112,
    "sha256": "76a01b2d29119f1bc4d8aaa8da77846160133067d0eb3036f5791c3198b5b897"
  },
  "inner": {
    "bytes": 1075807530,
    "sha256": "5eb1c3e70d8fc460ddeba3762137306cf2e6902c315172c633702621883b7e9c"
  },
  "manifestSHA256": "497efcff7f399c12030bfa5297f8e67faaa97ef26626ac88a1b924fcb23db6a0",
  "producer": "Successful Appearance39104551453; compact metadata independently verified. Full payload/source/worker/CSP validation remains mandatory in hosted consumer."
}
```

[Pages run 39106581010](https://github.com/mekhovov/revealline/actions/runs/39106581010) passed on exact merge c8b607dba8b55ee752bcfd4de2cef80074ae4bee: build completed at 07:21:43 UTC, deployment at 07:22:15 and public verification at 07:23:08. Independent public metadata and browser observation are tracked separately. The repaired source73 browser results remain identified as source73; they are not silently relabeled as this later build. Final native qualification must bind this package and retain all prior failed numerical and portability observations.

## Independent public readback and smoke

The main deployment metadata returned exact c8b607dba8b55ee752bcfd4de2cef80074ae4bee with HTTP200. The public game/build-info.json and game/app.mjs independently match the deployed inventory:143 bytes/SHA256 8d3aea446e9b0a93d9b46bd1764d43389805c8f577a1053717459f6a0b2ea85b and482579 bytes/SHA256 a64aee0215a01d0dc95aa6ecae2b57cb6c11e9ada5e03547e27acdb70ad589c0 respectively.

The three compact Pages receipts were acquired and independently checked against live API sizes/digests and all ZIP member CRCs/hashes. The complete inventory has3469 files,962565808 staged bytes within the980000000-byte limit, and SHA256656212fdff79321b9f907f7bc9ce9305f68ad18b2d2080d3e910eb9c283210d5. No full Pages archive was downloaded locally. Receipts and readbacks are retained under .cache/solo-followup/797-package/pages-c8/.

A fresh task-owned in-app browser tab reached the main menu without a reload, opened the existing saved Solo flight and paused successfully. Choose mission showed its preparation state and loaded240 Solo missions; searching Two bays returned the correct single mission. Back to game retained the paused flight at7:06 with3 lives,0%coverage and score0. Resume then Pause advanced to7:09. Sound stayed off and no progress reset or mission replacement occurred. Captured warn/error messages were empty. The tab was closed after saving published-c8-paused.png (1422×800).

This is visible functional evidence under the verified public deployment. Browser-loaded module identities were not independently instrumented; this is not a measured cold Start, replay verification, audio test or performance qualification. The earlier bbd first-launch module-fetch failure remains unexplained and retained.

## Current native successor

The separately reviewed five-path797 first-eight declaration and existing manual selector preserve all eight workloads, baseline and bounds. Four complete affected control files pass22/22 with227 stable sparse inputs; lint/format and source-identity checks pass. The patch is43895 bytes/SHA25682f15f8b46d0639ec26bf888d66ed36a981bef874e4f1b42ad9e4624b1b204db. No797 native outcome is claimed until its actual hosted run and complete artifact review.
