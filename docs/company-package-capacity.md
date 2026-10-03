# Company package capacity

Company runtime packages now have a fixed **80 MiB (83,886,080 bytes), 2,000-file**
product limit. The previous 64 MiB limit was an application safeguard, not a
browser-enforced maximum. The reported 942-file / 67,659,546-byte build exceeded
the former limit by 550,682 bytes. The new allowance leaves 16,226,534 bytes
(about 15.5 MiB) before subsequent source or optional-content changes.

This is a bounded 25% increase, chosen to accommodate the shared player and
Company functionality with useful maintenance headroom. It does not remove the
limit or expose a caller-configurable override. Browser quota still depends on
the origin, device, browser and available storage; preparation may fail for lack
of space even when the package fits this policy. See the
[browser storage quota explanation](https://developer.mozilla.org/en-US/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria).

The dependency-free `game/editions/package-budget.mjs` policy governs the Company
compiler's complete generated output, mandatory offline inventory, generated
worker admission, browser verification receipts and release runtime admission.
The complete-output check includes generated workers, offline metadata and
`edition-build.json`; release manifests independently validate that compiled
inventory. Source archives keep their separate bounded source-policy rules.

The ordinary game's 64 MiB core budget, optional package budgets and the
Company presentation-artwork-only 64 MiB ceiling remain unchanged. Company
artwork can also be an optional pack in the ordinary game, so that narrower
media ceiling is intentionally separate from the complete Company application.
Adding optional media still counts toward the complete compiled output even
when it is excluded from mandatory offline preparation.

Existing edition formats, edition/build identities, scoped caches and rollback
references are unchanged. Earlier valid editions remain admissible. Every
inventoried file retains exact length and SHA-256 verification; streaming
downloads still reject and cancel overlong bodies. New workers reject invalid,
duplicate or over-budget inventories before downloading or allocating bodies.
No previous artifact is rewritten and no cache is forcibly deleted.

Regression coverage is authored for acceptance above the former limit,
complete generated-output overflow, runtime receipt boundaries, worker inventory
rejection and independent release admission. Automated suites remain waived and
are not run; build, source-identity, lint, formatting and validation checks remain
mandatory. New builds need fresh device/offline qualification; historical
64 MiB receipts describe their original artifacts only.
