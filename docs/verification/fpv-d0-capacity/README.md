# Approved offline capacity increment — 3 October 2026

The owner explicitly approved a 72 MiB shared core/company budget after reviewing
mobile download, storage and update risks. The 2,000-file limit and separate SIM
package policies remain unchanged. Media, archive and source-file limits are not
raised.

## Implemented

- Match the core builder, generated worker, company builder/final-output guard,
  company receipt validator and capacity qualification tools at 72 MiB.
- Losslessly encode the generated content translation registry with the already
  pinned lz-string decoder. Preserve all 6,295 identities, exact fields/strings,
  ordering and shared records. Keep the smaller plain encoding for small inputs.
- Registry size: 554,343 → 246,439 bytes (307,904 bytes saved).
- Updated existing budget assertions. Repaired two stale packaging fixtures:
  the reaction-audio export stub and the newly required update-context import.
  No additional unit coverage was introduced.

## Verification

- Existing localization/offline/edition checks: 100 passed.
- Existing game CLI checks: 32 passed after fixture dependency repairs.
- Exact original registry equality in Node and actual browser; canonical value
  SHA-256 `92af529692ad02d255ba35842a4f41b57753251f5b781cc18a80b385798ba66e`.
- All 18 editions compile with normal guards; unchanged working-tree source
  capture. Largest: droneaid-nl-community, 67,460,880 bytes / 923 files.
  See `editions.json`. These are in-memory compilations, not published archives.
- Coupa-all compiled twice with identical outputs.
- Actual Codex in-app browser and production worker installed exactly 75,497,472
  bytes, then staged a second verified version while preserving the active first
  version. A corrupt third version was rejected; the original still verified
  ready with no missing/corrupt files. The isolated verification caches were
  removed afterwards. See `browser-boundary.png`.
- A broader external-distribution loose/ZIP workflow was stopped before writing
  its large output because the machine had under 0.5 GiB free disk. It is not a
  passed check. In-memory checks avoid weakening any admission guard.

The browser exercise establishes boundary installation, staged update and failure
fallback. It does not establish iPhone/Steam Deck memory, quota or performance,
Existing offline regressions cover
scope isolation, failed installs, quota recovery and update behavior. Public
availability requires protected checks, merge and deployment/launch verification.

## Completed activation/rollback and source-bound build

The browser then activated version C normally after the old client closed,
verified all 75,497,472 bytes, staged original version B, closed the client again,
and verified B active with no missing/corrupt files. No forced activation was
used. See `browser-rollback.png`. Reproduce with
`node scripts/verify-offline-capacity-browser.mjs`; use its isolated URL and
remove the verification cache afterwards. This verifies a synthetic boundary
payload with the production worker, not physical-device acceptance.

`core.json` binds preparation to committed candidate
`649887eed17b1a704715cae2205f57b82875584b`: 1,327 files / 67,094,501 bytes,
8,402,971 bytes headroom at 72 MiB. Available committed source bytes were checked
before and after preparation. The receipt is for in-memory preparation, not a
published distribution or public deployment.
