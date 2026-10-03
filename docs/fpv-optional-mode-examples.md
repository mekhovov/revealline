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
- `fpv-optional-examples-source-browser.json` and
  `fpv-optional-examples-packaged-browser.json`: **117/117** checks each against
  the actual HTTP/WebGL host. Includes all 14 full rendered replays, whole-lesson
  lab playback, selected-mode catalogue, section replay, rejection of wrong
  dependencies, retained-record reload, partial transaction failure, duplicate
  import, a real second-connection pin race and disposal. No uncaught errors.
- `fpv-optional-examples-package.json`: frozen candidate
  `9ca502490094d7c9db8b5d66fae6c90d7895eea3`, all three admissions, exact committed
  inputs/ZIP membership and two byte-identical builds. World: 102 runtime files /
  14,513,098 bytes; source archive uses 104 files under unchanged limits.

The source and packaged host SHA-256 is
`52cbfac9012bf2a7127ec1cfd85142ead184166aadb8a97818d886623c7db8f2`.
Retained reload was verified with live HTTP; this receipt does not claim an
offline-network simulation. Browser fixtures use private databases and never
clear player storage.

New unit coverage remains deferred to H/R7. Physical controllers, novice sessions
and named-device performance remain unverified. Public availability requires
protected merge, deployment marker and actual public launch.

## Delivery and next batch

This feature is published as PR #979. Main includes Snake content #973 and pack
recovery #977; both are preserved in the current integrated candidate. Existing caps
remain intact even if publication needs a separate lossless capacity repair.
Next: convert the 60 Adventure authoring proofs into bounded optional examples,
then Stadium and yard/Garage art and further distinct practice worlds.

The integrated World file-count issue is repaired by excluding three unreachable
Academy-only modules from its package; all features/assets/licenses remain. The
separate company engine contains zero FPV runtime files and still exceeds64MiB
by292,326 bytes after main's #978 Snake content integration. Whole-edition
qualification still requires a reviewed capacity repair; no guard was increased or bypassed.

## Recovery integration

Main #977 merged after initial publication. The combined host preserves exact pack
restore and optional-example selection. Source and immutable packaged builds
each repeat the90-check recovery workflow; the final examples flow now passes
117 checks with eight additional native session-read failure assertions.
Retained completed proofs and interrupted prefixes replay independently.
Receipts: `fpv-optional-examples-recovery-source.json`,
`fpv-optional-examples-recovery-packaged.json`, and
`fpv-optional-examples-recovery-replay.json`.

If the interrupted-session read fails after recordings refresh, fresh examples
and deletions now still invalidate the lookup cache and appear in the Library.
The session failure remains visible; previously known recovery data is retained.
Disposal suppresses stale rendering. The merge was a normal forward update;
no native stack, force-push or protection bypass was needed.

The follow-up explicitly aborts one native readonly `session` transaction in a
private fixture database. Both source and packaged runs show the deleted example
disappearing from the Library, School and catalogue, the session read error
remaining visible, and the saved interrupted flight/notebook/bookmark unchanged.
This is actual browser storage failure injection, not an additional unit suite.
