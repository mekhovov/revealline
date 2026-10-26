# Team mission-library inventory fixture

This test-reliability dependency follows PR1714 at
`9e9073f3429983cd0357da2bab937ac483db0b97`. It changes only the native Team
mission-library test and this record; it adds no player feature or runtime change
to the 113-deliverable plan.

The original complete 17-case file passed 13 cases and failed four obsolete card
counts: built-ins 116 versus 14, Journey 114 versus 12, the one-level local import
117 versus 15, and Legacy browsing 116 versus 14. The retained Journey still has
twelve missions. Expeditions added 96 and Hunt added six, contributing another
102 Journey identities alongside the two Classic arenas.

The expected built-in opaque identities now come from the independent remote
Team metadata adapter and mission registry, without chooser DOM, gameplay,
artwork reads or launch. All built-ins must appear exactly once, with no duplicate
or unexpected identities. The Classic and complete Journey collections must
match their own metadata sets. The retained edition is then selected by its
independent model identities, preserving the original ordered mission IDs and
player-facing edition checks.

The import case validates its exact authored pack, edition, level and revision
tuples and a distinct visit-local opaque owner. It retains the same-title
separation, Expert launch and original Next behavior. Every existing behavioral,
selection, artwork-laziness, preview lease, cancellation, focus, URL handoff and
runtime assertion is preserved; only the four obsolete count assertions are
replaced. No tests are filtered, skipped or given changed timeouts. This file's
finite DOM and image boundaries do not qualify browser layout, real-device input
or physical rendering.

The corrected complete file passes all 17 cases, with zero skips or cancellations.
Token-based assertion comparison confirms that all 60 other original assertions
remain unchanged; only the four obsolete count assertions were replaced. Changed
test lint, both-file formatting and the whitespace check pass. Separate receipts
retain the unchanged complete-file failure and corrected complete-file result.
Full repository lint and source validation remain pending gates until explicitly
run on the final head.
