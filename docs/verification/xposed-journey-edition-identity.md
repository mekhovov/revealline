# Candidate edition identity includes original artwork

P01 source continuation, 20 September 2026. No published edition is changed.

The shared candidate Journey resolver previously derived a campaign execution
revision from campaign design, difficulty and simulation identities alone. Its
original picture could change without changing that execution key. That would
make the key insufficient for exact saved-attempt restoration once the authored
curriculum enters the main host.

Execution revisions now additionally include each resolved level ID, revision
and name, authored presentation, and exact background asset revision. A changed
SHA-256, asset revision, removed background, changed theme, level revision or
mission name produces a different execution identity. The old key cannot resolve
silently against the new catalog. Only the affected campaign changes. Unchanged
simulation identities, stable mission/progress IDs and preset behavior remain
the same; artwork does not become gameplay geometry or earned coverage.

Focused execution/Journey/attempt/picture/asset cohort: 40/40 passed, including
all sixty complete preset/steering routes through the preparer and exact replay
checks. Full lint, formatting, content validation and whitespace checks passed.
Logs: `.cache/candidate-edition-{tests,lint,format,validate}.log`.

This is a resolver identity gate, not a claim that candidate saved flights already
work in the player host. That integration must use these exact keys, retain old
save bytes on a mismatch, preserve the current run through failed loading and
provide the appropriate recovery message. Legacy keys and frozen releases are
unchanged. Candidate navigation remains separately stable across edition changes.
