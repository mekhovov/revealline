# Flight practice: launcher recovery continuation — 15 October 2026

## Baseline and scope

Rebased the clean practice worktree onto main
`859d5cfc927daff2a350318b2325486a58959648` (merged PR #1482), including the
previous Practice PR #1345. Continued on `codex/flight-practice-recovery-20261015`.
The primary checkout and SIM agent's ongoing work are untouched. Hosting, size
guards, retained versions, public selection and release allocation remain unchanged.

The earlier all-three browser-restart receipts retain their original source
bindings. They are not automatically qualification of this newer SIM/package code.

## Reproduced and corrected

### Verified apps waited for unrelated readiness checks

The launcher checked active, previous, then launcher-shell readiness sequentially
and published links only after all checks. A deterministic regression with an
immediately verified active copy and a held previous-copy check reproduced a hidden
Open link. Each check has a 30-second bound, so unrelated inspection could outlast
the observer's 30-second ordinary-action deadline.

Checks now run independently. Each validated, hash-verified package action appears
when its own check completes; the overall status remains Checking until all checks
settle. A healthy previous copy is likewise accessible while the active check is
unfinished. Unknown initial checks never certify a saved pointer. Already verified
actions remain available on inconclusive rechecks; confirmed missing files hide
only their own action. Malformed retained metadata cannot blank a valid active app.
Locale changes update both verified actions. Leaving the page invalidates pending
publication and the abandoned automatic-play intent, including a later pageshow.

This reproduces a concrete cause of the same visible symptom, **not proof of the
cause of the earlier uninstrumented browser failure**. No deadline was increased.

### Inspection exceptions were misreported as confirmed damage

Both package-worker variants previously converted cache-listing, cache-read,
response-body and hash exceptions into `ready: false`, which detailed callers
interpreted as confirmed unavailable content. That could recommend removal without
having established a missing or damaged file.

Workers now add `status: unknown` for inspection exceptions. Actual absent caches,
missing files and byte/hash mismatches still report `unavailable`. Existing
boolean-only replies remain accepted, and old boolean consumers still receive
false for inconclusive checks. Detailed callers validate scope, boolean/status
consistency and allowed status values before accepting readiness. Inspection
does not fetch, remove caches or rewrite installation pointers. Old installed
workers retain their old protocol behavior until updated normally.

The shared worker was changed through its maintained source and regenerated using
the existing projection tool; no competing worker or publishing mechanism was added.

## SIM reconciliation

Accepted regional Library recovery improvements now include exact retained-revision
repair and preserving active revisions/saved places. These are regional-content
operations, not proof of app-package upgrade or physical quota/eviction behavior.
SIM's regional transfer limits are now 120-second inactivity/10-minute overall;
Practice app-package preparation remains 30 seconds/five minutes. Do not conflate
those separate operations in instructions or tests.

No targeted fix for the historical first-pointer Academy disclosure/profile/proof
export problem was found in the accepted changes. Current pointer acceptance still
needs observation; neither a fix nor continued reproducibility is inferred merely
from source inspection. Latest Lunar evidence covers its stated download, locale,
retention and cached preparation cases, not all-three app restart qualification.

## Verification and remaining acceptance

The new delayed-readiness regression failed against the original launcher and
passes after the change. Focused launcher tests cover independent progress,
retained locale, invalid metadata, unknown/confirmed-missing behavior and abandoned
play. Worker tests inject inspection failures and genuine missing/corrupt files in
both worker variants, preserve legacy response support, and reject inconsistent or
foreign responses. These are deterministic fault tests, not real disk exhaustion.

Full-suite, frozen-package and browser results are recorded below when complete.
The [release checklist](flight-practice-release-checklist-2026-10-15.md) remains
authoritative for unrun first-flight, distinct-release update, physical-device,
performance, human-learning and review gates. No gate is automatically approved
by this repair.
