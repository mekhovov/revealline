# Explicit repair of a saved regional revision

When verified local scenery is missing or corrupt, Library now offers **Repair download** for that exact saved version only when its immutable pin is still in the shipped catalogue. English and Ukrainian explain that other versions and saved places remain. Unoffered versions get an honest unavailable message, not an invented URL. Network, abort, device-store and renderer failures do not expose repair.

Repair downloads and validates the same immutable descriptor, paired manifests and every declared asset before one generation-guarded transaction. It refreshes that retained copy without changing the previous active revision, other revisions, original install metadata or saved places. If the repaired copy is active, its active assets are refreshed in the same transaction. Ordinary installation still activates its incoming version. No automatic flight or deletion is added.

The normal install inactivity/hard deadlines, cancellation and post-commit refresh rules apply. Cancellation before commit retains existing state; an already-started atomic commit reports its saved outcome. Late completion after navigation cannot launch or reclaim focus. Successful repair returns focus to Fly, requiring a deliberate action.

## Evidence and boundaries

The preceding package at `60ed19d3` reproduces the missing Repair button; the failing baseline is preserved externally as `library-repair-baseline-60ed.txt`.

- `verify-explicit-repair.mjs`: real immutable 38-file Urban source through production delivery/store APIs and isolated in-memory IndexedDB. Models retained-file loss, corrupt incoming data, active/inactive repair, cancellation, missing identity, transaction abort, concurrent generation changes, saved places and captured flight bytes. Connection reopen remains distinct from browser-process restart.
- `verify-library-repair.mjs`: five production UI groups with isolated memory store, controlled timers, EN/UK and focus. Covers exact offered pins, no fallback for unknown retained versions, no repair for unrelated failures, deadlines/cancellation and late commit ownership.
- Existing retained-copy repair six groups, content 12, removal four, editions five, committed refresh four, quota guidance three and deadline eight pass. Scoped lint, formatting and diff checks pass.

Parent independently reviewed the production diff and both focused verifiers without actionable findings. No native browser, actual eviction/quota exhaustion, process restart, hardware performance or broad release claim is made by this source receipt. Exact package and native UI results are appended separately when obtained. Existing source/package budgets and runtime module count are unchanged.
