# Approved offline capacity increment — 3 October 2026

The owner explicitly approved a 72 MiB shared-core budget after reviewing
mobile download, storage and update risks. Company editions use the separately enforced 80 MiB package budget. The 2,000-file limit and separate SIM
package policies remain unchanged. Media, archive and source-file limits are not
raised.

## Implemented

- Match the core builder and generated worker at 72 MiB. Company builders, receipts and qualification use the separately enforced 80 MiB package budget.
- Losslessly encode the generated content translation registry with the already
  pinned lz-string decoder. Preserve all 6,297 identities, exact fields/strings,
  ordering and shared records. Keep the smaller plain encoding for small inputs.
- Registry size: 554,428 → 246,299 bytes (308,129 bytes saved).
- Updated existing budget assertions. Repaired two stale packaging fixtures:
  the reaction-audio export stub and the newly required update-context import.
  No additional unit coverage was introduced.

## Verification

- Existing localization/offline/edition checks: 100 passed.
- Existing game CLI checks: 32 passed after fixture dependency repairs.
- Exact original registry equality in Node and actual browser; canonical value
  SHA-256 `c0193c283bce452517b4d309ee6459404efb8b80cc1a6bfe7968bb939c11a5a8`.
- All 18 editions compile with normal guards; unchanged working-tree source
  capture. Largest: droneaid-nl-community, 67,464,716 bytes / 924 files.
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
fallback. It does not establish iPhone/Steam Deck memory, quota or performance.
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
`8162e7d4d62999a630b4daf43721f613b3b3ef8f`: 1,328 files / 67,073,221 bytes,
8,424,251 bytes headroom at 72 MiB. Available committed source bytes were checked
before and after preparation. The receipt is for in-memory preparation, not a
published distribution or public deployment.

Latest main4074b12f7 was preserved by rebase; the regenerated registry and all132
focused checks were reverified afterwards. Core and18-edition receipts above
reflect that refreshed candidate. Earlier observations in the delivery log are
historical, not exact-head publication claims.

After #986 merged, this branch was rebased onto1aef4d70. The capacity compiler,
worker, receipt validator and generated registry are byte-identical to the
recorded candidate. All132focused checks pass again. Current-head full artifact
qualification is left to protected CI; the saved receipts retain their original
source identities.
