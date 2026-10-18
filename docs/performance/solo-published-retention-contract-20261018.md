# Saved-flight retention contract

Ordinary online restore gives optional offline retention one second. Expiration must leave a valid saved flight available, paused and unchanged; it does not promise a played-dependency pin. Explicit verified retention has a stronger contract. The former published-entry test assumed the optional operation always completed, conflating these two paths.

The revised test restores the same prepared chapter, checks its authoritative checkpoint and saved bytes, then explicitly retains that exact route and mission before asserting the pin and removing the normal download selection. The existing reopened-page case consumes those retained bytes with the network blocked. No new download is permitted by the explicit-retention case.

A separate control holds the actual local catalogue read across the unchanged optional deadline. Restore still completes paused with the original checkpoint and save. Releasing the late read creates no pin, dialog, error or autoplay. Production deadlines and retention behavior are unchanged. The complete published-entry and optional-access files pass **21/21**, with no skipped tests, in 25.19 seconds.

The complete TAP is retained at `.cache/solo-followup/published-retention-contract/complete.tap`: 4,935 bytes, SHA-256 `1b442e8f84169aa77c82273d0df7ba578ee33198e5ecd52b440ccabdac3dd4b8`. Its accompanying receipt proves the six listed inputs stayed unchanged; it does not claim an inventory of every transitive import. Scoped lint, formatting and an independent review passed.

An earlier diagnostic deliberately delayed the local catalogue beyond the optional deadline and reproduced the former missing-pin assertion while preserving the paused flight. That is evidence of the test's invalid unconditional promise. It does not attribute the precise delay in the historical CI run, change that run's failed result, or establish native-browser performance.
