# Current-character presentation adoption

This is the A1 prerequisite in the approved [A → B → C plan](character-game-feel-plan.md).
It supports delivery of the already implemented character fixes. It does not add
another actor, change a mission or approve candidate artwork.

Changing a shared painter can invalidate the source review of several selected
assets even when their PNGs stay identical. The [batch 13 audit](verification/actor-batch-13/production-adoption-audit.md)
identifies 67 affected slots on the worker branch: motion7, effects10, Team37,
equipment5 and independently reviewed audio8. Recalculate on the final integrated
source; the audit is a review map, not production authority.

## Admission manifest reader

`scripts/actor-presentation-continuation.mjs` validates a future explicitly pinned
manifest. **No production caller, successor pin or reviewed manifest is added by
this preparatory change.** It cannot change an asset's quality stage on its own.

The caller supplies a code-owned `{path, sha256}` after the actual scoped review.
Never take that authority from an imported bundle, a candidate or the manifest
itself. The reader rejects missing authority, draft records, changed record or
ancestor bytes, altered slot membership, wrong groups, inconsistent ordered source
inputs and changed payloads. It authenticates the existing immutable predecessor
chain. The supported groups are motion, effects, Team and equipment; audio needs
its separate review path. A manifest may cover a nonempty subset so an independently
reviewed motion correction need not wait for another group's unfinished work.

The manifest identifies exact source inputs and per-slot canonical payload
digests. Its returned `matches({group, slotId, source, payload})` only verifies that
the supplied value matches that scoped declaration. It is not a human visual
review, a production stage, a release certificate or permission to bypass the
original Team recipe/default/inherited-image and equipment PNG guards.

## Remaining integration

1. Reconcile the worker changes onto the publisher's accepted source. Preserve
   newer production history and the independently approved actor lease.
2. Recalculate the source closures and inspect actual output for the affected
   roster, both Team arenas, relevant states, normal/reduced effects, contact,
   freeze, recovery and subsequent movement. Bind observations and retained test
   evidence to that exact source. Review audio separately.
3. Record the scoped decision and evidence, then add a new explicit code-owned
   pin. The admission manifest complements that evidence; it does not replace it.
   Never rewrite old records, old hashes, old assets or original ownership.
4. Compose the reader with the existing producer and semantic guards. Unknown,
   malformed, missing or stale data must keep the asset unreviewed. Use the
   immutable writer to allocate new revisions after validation; do not infer
   approval for newly drawn bodies from a renderer continuation.
5. Run integrated production/readiness, source/build and public-release checks.
   Existing focused and native evidence retains its original scope. Until these
   steps finish, the known production-adoption failures remain open.

Maintainer prompt: “Authenticate a newly reviewed current-character continuation
against its code-owned pin and every immutable predecessor. Change each input,
slot, group and payload independently and require rejection. Prove a draft or
missing pin cannot confer authority. Preserve original Team/image checks and the
independent audio route. Separate synthetic reader tests from final-source visual,
production, physical-device and public acceptance.”
