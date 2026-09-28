# Verified optional Journey mastery

The versioned `journey-no-loss-win@1` recipe means: **the accepted winning attempt
lost no lives**. It uses the modern shared engine's cumulative `classic.livesLost`
counter, including a life lost and later replaced by a pickup. This optional local
achievement is not a skill assessment or certification. Simulation, medals,
scoring, input timing and mission progression are unchanged.

The shared player, Company Studio and Level/Campaign Studio support this exact
registered optional predicate. Authors explicitly select required mission wins
and then choose which of those missions also need a no-life-lost attempt. Adding
or removing a requirement creates a new immutable reward revision and rebinds
only the affected presentation references; it leaves gameplay identities intact.
Preview uses synthetic evidence in memory and cannot earn progress. There is no
automatic requirement on existing campaigns, and no public reward is silently
changed by enabling this adapter.

`verifyJourneyMasteryRun` snapshots the original replay, requires its exact
selected mission/gameplay/difficulty identity and an accepted run ID, then uses
the normal bounded asynchronous replay verifier. Only a real winning replay with
zero lost lives returns in-memory verified evidence. The host remains the
accepted-clear authority: imported flags or legacy library seal metadata cannot
supply it. The legacy equipment mastery definitions, observers, records and
replays retain their previous semantics.

The generic `createReplayProofStore` now owns the existing learning proof
lifecycle. Its learning adapter preserves every historical storage key, format,
serialized field order, proof identity and recovery journal. The Journey mastery
adapter reuses that lifecycle with its own versioned proof envelope and an
edition-scoped key; it stores replay evidence, never a second Journey completion
or XP profile. The host passes its existing guarded storage adapter.

A proof must pass its content hash and replay verification on creation, import
and hydration. The accepted clear is checked again at synchronous adoption.
Cancelled verification cannot adopt evidence. Session and durable projections
remain separate after writer loss, denied reads or exhausted storage. Unsupported
historical gameplay stays in recovery and can be checked again when its exact
retained presentation is selected. Existing replay, collection and storage byte
limits remain in force.

The ordinary Solo host supplies its current run ID and accepted Journey profile.
After an accepted win, the optional check runs asynchronously and does not gate
Next or Retry. A losing-life win is still a normal arcade success; the extra
discovery remains available for a later attempt. A practice run cannot borrow
an earlier accepted run. The reward projection updates only when proof evidence
changes, and persists optional rewards only after both Journey and proof storage
succeed. Failed proof saves cannot become durable through an unrelated later win.

Settings offers exact proof export, verified import and save retry. Imports are
bounded, cancellable and checked against selected current or retained gameplay.
Closing a host aborts outstanding verification and releases its owned UI. These
checks establish local replay consistency, not a secure entitlement or remote
identity. Human comprehension, installed-device and performance qualification
remain separate release evidence.
