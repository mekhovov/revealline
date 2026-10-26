Independent root source review is accepted at exact `81c0d6587cdb582835a64e3d69c4c130460fb11a` after the asynchronous-refresh focus correction.

The initial review found that an active-version refresh could leave the old primary focused node disconnected. That regression was reproduced before fixing it. The child commit preserves full world ID/hash/action intent, reveals the exact previous action when it still exists, and safely focuses Versions/Refresh when it does not. Confirmation cannot silently switch to another Fly or Download. Explicit navigation cancels stale restoration.

Root independently ran the family and existing label suites: **23 passed / 0 failed / 0 skipped**. All 24 offers, unknown retained IDs, active saved defaults, destructive confirmation scope, EN/UK and actual menu-navigation adapter behavior are covered in the isolated software fixture. No material source finding remains.

**Still open:** exact-head CI/original package qualification, native DOM disabled-focus and responsive/theme/input observations, normal-player integration and actual public rollout. Software controller/radio samples are not physical-device acceptance. The original public storage failures remain unrelated and unexplained. Keep Draft until the applicable remaining gates are accepted.

Root review receipt SHA-256: `af49fc1fc2c05432b0aa78c232690eee332429f2274489e07408f7cb8b1751b0`.

```json
{
  "reviewedAt": "2026-10-16T02:01:09.005462+00:00",
  "pr": 1540,
  "head": "81c0d6587cdb582835a64e3d69c4c130460fb11a",
  "sourceReviewAccepted": true,
  "files": {
    "optional-practice/civilian-fpv/regional-library.mjs": {
      "bytes": 74142,
      "sha256": "25dc7de4cfe5f9f08095b2934a36d508a1d2291307ab8880ca353b3c994d80b5"
    },
    "optional-practice/civilian-fpv/world-style.css": {
      "bytes": 119168,
      "sha256": "e75fe38f7a339e844376c9ca2eb35ef6d7f84202b395e0c8d2c491ba915e1529"
    },
    "game/test/fpv-regional-library-families.test.mjs": {
      "bytes": 28369,
      "sha256": "750c242925a776a345b9920469f7df5d7fce334bc9b58f3bc6b4c67e45b51169"
    },
    "docs/fpv-regional-family-library-20261016.md": {
      "bytes": 4831,
      "sha256": "1e6158a64907b882df4cc988addd5407269b4ef768b8890372d63a4836871259"
    }
  },
  "finding": "Original asynchronous-refresh primary focus loss reproduced and corrected in the child commit.",
  "verifiedCorrection": "Exact world ID, pin hash and action intent survives primary-display changes; missing action does not become Download or another Fly. Explicit navigation cancels stale intent.",
  "command": "node --test game/test/fpv-regional-library-families.test.mjs game/test/fpv-regional-library-labels.test.mjs",
  "rootSoftwareResult": {
    "tests": 23,
    "pass": 23,
    "fail": 0,
    "skipped": 0
  },
  "preserved": [
    "All24 exact offers and unknown retained IDs",
    "Active saved default without render-time writes",
    "Explicit repair/removal confirmations scoped to exact world ID",
    "EN/UK and controller/radio adapter focus behavior in isolated DOM fixture"
  ],
  "remaining": [
    "Current exact-head CI and original package qualification",
    "Native DOM disabled-focus and responsive/theme/controller/touch behavior",
    "Normal-player download/Fly and actual public deployment/launch"
  ],
  "notClaimed": [
    "Physical-device support from simulated input",
    "Real browser focus/layout from mock DOM",
    "Original public persistence repair",
    "Native all-24 retention"
  ]
}
```
