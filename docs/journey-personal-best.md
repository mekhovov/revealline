# Verified Solo Journey comparisons

Solo Journey results can compare a newly accepted win with earlier verified wins
for the same mission and setup. The comparison names the previous best score and
previous fastest time separately: they may belong to different real runs. It
does not combine their numbers into a fictional run or award progression, XP,
mastery, cosmetics or completion rewards.

The exact comparison partition includes the owned Journey mission, gameplay
identity, difficulty, seed, turn policy and ordered class/loadout route. The
gameplay identity includes the actual versioned pressure adapter, ruleset,
compiled level and class recipes. Class switch timing is part of the replay, not
a different setup. Presentation-only changes preserve comparison eligibility.
An older gameplay revision must still belong to an explicitly registered
presentation of the same selected edition. Omitted campaigns and arbitrary
historical file URLs cannot be loaded to admit a record.

The first newly verified record starts this optional history. Old clears and
legacy Library summaries do not contain enough exact gameplay evidence to
manufacture a previous best. The default Library, Team and Versus therefore keep
their existing result semantics. A host without the Solo verifier preserves
existing optional data during ordinary saves and export, but cannot display or
import it as verified performance.

## Authority and storage

`JourneyProfileStore.performance` uses the existing Journey IndexedDB database,
`profiles` object store and writer lease. Its optional versioned field lives at
`<profileKey>:performance.v1`, alongside the existing picture field. Ordinary
clear transactions never create or rewrite it. There is no second completion
store and the v1 clear record format remains unchanged.

Creation requires the exact current accepted mission, run ID, gameplay identity
and difficulty before and after asynchronous replay verification. Hydration and
import replay the original bounded input stream and recompute the outcome and
metrics. A winning replay must still match selected current or registered
retained gameplay and have corresponding Journey mission progress. A later win
can replace the latest-clear slot without removing an earlier genuine best.
Run IDs are local record references, not cryptographic identity or an anti-cheat
service.

The envelope retains actual best-score and fastest run bodies per comparable
setup, within 48 records, 2 MiB total, 512 KiB per record and 216,000 aggregate
replay ticks. Old retained groups are evicted when those limits are reached;
their ordinary clears and rewards remain. The verifier caches up to 96 verified
record identities within a 2 MiB serialized cache budget for the current host
lifetime. UI reads use a cached summary
projection rather than copying or replaying evidence per frame.

Metrics write independently after the clear saves. Exact previous-value checks
reject stale cross-tab writes. Optional transactions receive an abort signal,
including their storage deadline, so a cancelled or delayed native transaction
cannot later begin a write. If the browser has already committed or a custom
adapter ignores cancellation, a deadline is honestly reported as **saving not
confirmed**, not as a guaranteed rollback. Quota, timeout, corrupt optional data, a lost
writer lease or a missing historical source leaves the accepted clear and
Next/Retry available. A verified comparison whose write failed is labelled
session-only. A later unrelated win cannot silently persist that earlier
session-only record. Corrupt optional bytes are not overwritten by an ordinary
Journey save.

## Backup and presentation

Without optional evidence, exports retain the existing v1/v2/v3 shape. Backups
containing stars or performance use `revealline-journey-backup.v5`, bound to the existing logical
profile key. The two historical v4 shapes remain readable using their distinct stars or performance sidecar; ambiguous shapes are rejected. Explicit Inspect and Restore use the asynchronous replay verifier;
claimed scores, false outcomes and wrong mission/gameplay bindings are rejected.
Closing the recovery dialog cancels verification and suppresses late UI updates.
Once an explicit Restore has accepted ordinary valid clears, a later optional
metric save failure does not roll those clears back. The existing 16 MiB backup
file limit remains in force.

Results keep Next and Retry enabled immediately. Verification finishes in the
background, never changes focus and can update only the same accepted result.
Retry, Next and disposal cannot receive stale comparison text from an earlier
run. Default pressure, simulation timing, scoring and replay formats are
unchanged. Studio previews use the same existing ephemeral profile context.

Focused coverage includes real keyboard-driven first/repeat wins, immediate
Retry, exact setup partitioning, presentation-only compatibility, registered
history admission, cancelled/hung history requests, tampered imports, cancelled
dialog operations, later worse wins, writer loss, optional quota failure,
non-JSON/cyclic storage and stale compare-and-swap writes. These deterministic
checks do not replace the deferred human/device evidence.
