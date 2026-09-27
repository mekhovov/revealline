# Bulk policy reconciliation — 27 September 2026

## PR #395: restoration proposal retained, not activated

The original proposal at `b978d71b6bbf0aea5ed14a71030b91fbf4a7dd2b` is retained
in merge ancestry. Its older restoration instructions do not override the current user policy.
The checked-in automated-suite waiver and its authorization remain unchanged; no repository
Actions variable was changed. Required-mode behavior is preserved through an exact synthetic
regression alongside the checked-in waived decision. Waiver-era skips remain skips, never passes.

All open inputs are being reconciled into one candidate before cumulative tests and repairs.
No intermediate release or historical deployment is required. Exact-source identity, required
focused/static/provenance checks, production review and final publication-byte checks remain.
This document is integration accounting, not successful test or release qualification evidence.
