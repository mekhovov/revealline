# Historical Team Hunter verification retention

This recovery adds the original September 29 verification document unchanged,
from donor commit `b25b29edf4a9ec8628b9d52333d8c683155ae0ec`
(`codex/team-import-hunter-tuning`), Git blob
`c8d72efe89973e80474016fbc80e3b2da7d34f17`.

The retained document describes its own historical baseline, test runs, failures,
and intended PR #757 adoption. Its references to "current" apply to that historical
baseline, not today's main, and its test claims are not new execution evidence.

The runtime Hunter compatibility guard and both original regression sources are
already on main. The later `team-hunter-import-recovery-2026-09-30.md` remains
unchanged and explains that separate recovery. This PR restores only the omitted
original report, including its alternatives, failure history and scope limits;
it does not replay old runtime code or supersede the later recovery report.

No source code, assets, production ledger, schemas, saved data, build admission,
publication budgets or branch protection are modified. Tests remain
`WAIVED_SKIPPED_NOT_PASSED`; no new tests or public-player acceptance are claimed.
