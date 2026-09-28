# Typed practice discoveries

Practice completion uses the shared Discovery model and store. It does not create
an arcade win, a Journey clear or another reward balance. The simulator's verifier
must replay a normal practice attempt against its exact course, flight model and
validated response profile before supplying accepted evidence. Demonstrations,
authoring previews, replay views, cancelled attempts and claimed completion flags
are not accepted completion evidence.

A `revealline-completion-reward.v2` definition declares `requirements.practice`
explicitly. Each row pins `model`, `course` and `courseIdentity`, lists its permitted
`modes`, and sets `responseIdentities` to either a nonempty list of exact identities
or **explicit `null`**. Null allows any response profile accepted by that simulator's
verifier; it never skips profile validation. An omitted field is invalid.

The verifier's typed projection contains `model`, `course`, `courseIdentity`,
`mode`, `responseIdentity` and `attemptId`. The shared validator checks its shape
and matching requirement. It does not replace replay verification or turn an
unverified input record into a trusted completion.

A practice-scoped reward requires exactly its named course and no arcade missions.
Campaign and edition rewards may name several distinct courses. Each course
contributes one requirement regardless of repeated attempts. A twelve-course
finale can allow Self-level or Acro for every course; a separate optional distinction
can require Acro for all twelve. The receipt retains one qualifying exact attempt
per course, including its response identity. Response comparison remains meaningful
only between compatible recorded profiles.

Existing `v1` definitions, promise identities, receipt bytes and old-only state
exports remain unchanged. A practice definition creates a `v2` receipt; any state
containing a `v2` promise uses `revealline-reward-state.v2`. Mixed collections retain
both versions. A v1 container cannot conceal v2 content. Explicit imports still
reject conflicting promised or earned revisions without silently dropping items.
An older reader cannot import the new v2 collection: keep the original backup and
use a compatible reader rather than rewriting its version or fabricating arcade
clears. Exact unavailable payloads keep the existing missing-media recovery path.

Flight course Studio preserves its imported knowledge reward through export.
Changing a course binding requires an explicit new reward revision; its authored
payload and bilingual copy remain intact. The lightweight course packet rejects
media and cosmetic dependencies because it does not admit an asset catalogue.
Language changes preserve the draft and unapplied control values.

The generic model supports these records; the practice package supplies its
course admission and verified evidence adapter. Existing arcade edition export
must not admit an unsupported practice dependency. The general Company/Level Studio
arcade reward controls do not yet author a simulator course or a practice proof.
This format support alone does not establish that authoring workflow, successful
physical-radio operation or real flight competence.
