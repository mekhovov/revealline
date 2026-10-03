# Matching-mode optional examples

The School and world catalogue offer demonstrations for the flight mode selected
in Settings. Built-in examples remain first choice. The recording library can
now supply an additional example only when its exact pack, normalized course,
mode, runtime and response identities match, its demonstration session has been
verified, and its replay completed. Playback verifies it again before starting.

This increment adds 14 Self-level examples for the primary foundation lessons as
a separate [downloadable archive](../authoring/fpv-worlds/demonstrations/optional/README.md).
The original 178 bundled examples retain their bytes. The optional file is not
added to the core package, offline precache or edition download. It uses the
existing bounded hashed FPVProofArchive transport and recording storage.

## Player flow

1. Download the archive and open Library → Import recordings / examples.
2. Choose the JSON. Progress reports each replay; valid records remain available
   if a later record cannot be stored. Missing or invalid records remain
   exportable, but are not offered as demonstrations.
3. Select Self-level in Settings, then Watch demonstration in a foundation lesson.
   The lab and section practice consume the same exact matching example.
4. Remove examples individually in Library, or pin/export them. Reimporting an
   unchanged verified example preserves its local bytes and pin.

Import pauses any current flight. Disposing the host or starting another import
cancels cooperative verification and prevents stale UI/storage work. Import never
auto-arms or awards completion; demonstrations remain distinct from scored runs.
Missing-example caches are invalidated after import and removal.

Acro teaching text still explains Acro mechanics. Optional Self-level recordings
show its real return toward level and do not pretend tilt remains after release.
The 16 later Acro skill lessons retain unscored Self-level practice; no fake
Self-level trick completions are added. Lesson examples explicitly use the authored course and its recorded appearance,
including after a player changes cosmetics. The lab already uses that authored
lesson. The player’s appearance preferences remain saved for their next flight;
no proof is applied to a presentation-mutated course.

## Functional evidence

- `fpv-foundation-self-level-physics.json`: all 14 finish with zero contacts and
  full health; 14 independent replays and 14 archive-import replays agree.
- `fpv-optional-examples-original-recordings.json`: original 154 v2/24 v1 registry
  bytes retained; regenerated 14 original Acro proofs are identical.
- Actual source/package browser and frozen capacity receipts follow qualification.

New unit coverage remains deferred to H/R7. Physical controllers, novice sessions
and named-device performance remain unverified. Public availability requires
protected merge, deployment marker and actual public launch.

## Delivery and next batch

This is independent of pack recovery PR #977. Current main includes Snake content
#973; integrated package/edition capacity must be measured again. Existing caps
remain intact even if publication needs a separate lossless capacity repair.
Next: convert the 60 Adventure authoring proofs into bounded optional examples,
then Stadium and yard/Garage art and further distinct practice worlds.
