# Verified optional Journey mastery

The versioned `journey-no-loss-win@1` recipe means: **the accepted winning attempt
lost no lives**. It uses the modern shared engine's cumulative `classic.livesLost`
counter, including a life lost and later replaced by a pickup. This optional local
achievement is not a skill assessment or certification. Simulation, medals,
scoring, input timing and mission progression are unchanged.

The first framework checkpoint adds the verifier and replay evidence lifecycle.
The compiler's mastery capability gate remains closed until the shared player,
Studio selection and exact dependency admission are wired and tested. These
modules alone do not enable or author a player reward.

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
