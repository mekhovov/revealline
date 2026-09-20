# Journey P02 shared-music recipe history

## Failure and source stage

Hosted full qualification35503593811 of9fe6276fff0c470480a466669c435b3edc92a9a4
failed during production reproduction, before test shards or freezing. The
shared-music composition changes `game/ui/published-audio.mjs`, one of four
fingerprinted audio recipe inputs. Reproduced locally with the same stale-ledger
error. No retry or readiness bypass was used.

The bounded change adds `cues = true` and conditions cue attachment, UI listeners
and cue cleanup on that option. Team passes `false`, retaining published music
without claiming gameplay cue parity. The other three audio fingerprint inputs
are unchanged. Current fingerprint:
`b07a0865c1ff94faf7d1b45ccd7db1a9c0f4b417e366da9ddb1a5e7849beecba`.

First generated fpv33 as an unreviewed source-stage successor. Its immutable
oracle is `game/test/fixtures/production-journey-p02-source-fpv33.json`:
7,045,489 bytes, SHA256
`ebd4db96c7e0f14921571c538879be84f4e6513737a503654d7c556a25a7ea2b`.
All127 existing payloads remain unchanged (aggregate identity in the oracle).
No image or audio payload generation, deletion or media conversion occurred.
This intermediate source stage must remain in the ledger after scoped review.

## Scoped functional review

Reviewed the exact adapter diff: default callers retain cue behavior; only Team
opts out, and opt-out does not clear another cue owner during cleanup. The seven
published-audio tests pass, including a new late-readiness/rejected-readiness and
idempotent-disposal regression. They also retain lazy music, corrupted-byte refusal,
cancelled downloads, native-action cue selection and muted decode protection.
The other three audio fingerprint inputs and actual cue/composition recipes are
unchanged; this is not a renewed subjective sound review.

The broader154-test music cohort at source-stage fpv33 passed145 and failed9
(eight Team setup failures plus their parent): Team's exact picture authority was
still pinned to fpv32. It correctly refused the new theme revision. The reviewed
fpv34 successor therefore explicitly repins the two starter bindings and historical
import policy only after retaining unchanged picture asset IDs/revisions/hashes.
No wildcard, fallback or historical release modification is introduced.
The source-history regression also failed as intended before review (33 !=34),
and the readiness command correctly rejected all eight source-stage audio slots.
Fresh complete history, Team picture and shared-music tests are required after
generation; neither initial failure is described as a passing release gate.

The first uncommitted fpv34 review draft passed199/200 expanded tests. The existing
whole-collection replacement capacity test exceeded its4MiB manifest limit because
long review paragraphs were repeated across eight audio records. The diagnostic
measured3,048,475 canonical bytes for that draft,3,618,933 after a full review set,
and4,183,339 before the replacement theme's metadata. The8-record repetition,
not payload growth, exhausted the remaining headroom.

Shortened only the new review declaration, retaining its source fingerprint and
scope plus this detailed report. Regeneration starts from the exact committed
fpv33 source stage; the earlier uncommitted generated fpv34 files are superseded,
not historical published revisions. The complete replacement test is unchanged.

The concise draft then passed document validation but its full portable manifest
still measured4,203,650bytes,9,346bytes over4MiB, including its required127-entry
asset table. Even deleting all700 new review characters from all8records would
not restore capacity. Instead, metadata receives an explicit finite5MiB ceiling.
The32MiB transfer,4MiB individual asset,2048-record,512-slot, node/depth and image
decode limits remain unchanged. All shared import/export/runtime readers consume
the same catalog limit. Boundary tests reject oversized metadata before parsing,
oversized transfers and oversized documents; the existing whole-collection
replacement/import/export test still proves useful administrator capacity.

The final11-file cohort passes **202/202**, zero skips/failures,42.1seconds on
Node20.19.5. It includes all production-history and full replacement round trips,
both Team picture authority suites, published-audio, Couch master/context/library/
session, Journey music context and soundtrack panel. An initial boundary fixture
incorrectly edited the frozen default document; cloning that test input fixed the
harness, without production changes. Exact5MiB document admission, one-byte-over
refusal, malformed/deep input refusal and unchanged transfer/file limits pass.
Full source lint, formatting, whitespace and exact fpv34 reproduction pass.
This cohort is not the complete hosted suite or deployed acceptance.

This is not whole-phase, physical-speaker, album-listening or public acceptance.
Final integrated source qualification and deployment verification remain required.

## Full-suite integration failures and bounded fixture repair

Full qualification35504544877 at fd6745a99c432ef9e5c362ab23dc4939cda74ddd
passed preflight, then failed shard1 (three cases) and shard4 (fifteen cases).
Shard3 passed; shard2 was still running when this repair was recorded. This
source is not qualified and must not be promoted. The original complete job logs
are retained locally, with hashes matched against fresh GitHub API streams:

- shard1 job106062250890:10,279 lines, SHA256
  `9808f24d21110ab8bd821468c8e1daa12692a708eddcdfcf05c22aa563162b76`;
- shard4 job106062250858:9,658 lines, SHA256
  `3c5a0ab56e913da9ab7c5215440d05f78d9f556d46a3edcd89eb1aa0c3579652`.

Two Versus tests supplied the same non-DOM audio object for both persistent
playback and the newly integrated library audition. Their fixture now creates
separate finite DOM media elements, retaining the primary transport observations.
No runtime null guard, disabled assertion or timing relaxation was added.

The Team discovery case and fourteen custom-artwork host cases constructed
positive import fixtures with stale fpv32 identity. Runtime correctly refused
them against fpv34 and kept the previous arena. Fresh fixtures now use the exact
current compiled/binding theme revision; picture hashes, authored routes,
historical import refusal and ownership assertions stay unchanged. Discovery now
also asserts successful import before checking its picture, avoiding an unrelated
previous-preview comparison.

The remaining production-panel failure exposed missing delivery-workflow linkage
in the new Couch music authoring skill and a stale thirteen-skill count. Added
the same shared workflow link required of every authoring skill and updated the
exact count to fourteen. The all-skills contract remains enforced.

Verification on Node20.19.5: targeted regression3/3 passed (41 filtered skips),
then the four complete artwork/music files passed83/83 with zero skips in35.104s.
The complete production-panel file passed11/11 with zero skips in178ms. Its first
local run failed two PNG checks because a sparse fixture was absent; restoring
the exact committed orchard-crossing.png resolved setup without changing tests.
Changed JavaScript lint, formatting and whitespace checks pass. A new exact-source
hosted full run is still required; these local checks do not replace it.

The final shard2 also failed:18 local-art resolver cases shared a fpv32 fixture
while exercising current exact binding authority, and one actor provenance test
still expected theme32. The preserved10,577-line original job106062250862 log
matches the GitHub stream SHA256
`3774a0e0fc63c205a10e10afa1d8b2dd3dca69ef33718dffed96b13c1c5d5962`.
Thus fd6745's full run is terminal failure (37 failing tests across three shards),
not a partial qualification; freezing was skipped.

Resolver positive fixtures now select current binding authority. Negative tests
vary only their intended theme/collection field, so collection refusal cannot pass
merely because its theme is stale. A new explicit fpv32 owner/page regression
proves both registered and generic imports still refuse an old edition before
decode. Actor provenance now expects fpv34 while all five original frame IDs,
asset revisions, hashes, sizes and dimensions remain unchanged. The two complete
files pass54/54, zero skips,427ms on Node20.19.5; lint and formatting pass.
The earlier c27801ba six-file repair received independent diff review from the
release owner with no blocker; this later two-file correction still needs review.
