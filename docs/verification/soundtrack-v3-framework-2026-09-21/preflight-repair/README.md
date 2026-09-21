# PR #209 preflight repair

This repair keeps PR #209 unversioned and in draft. The retained failed run
`35549279481` checked source `ed039c08b68c7b2a59824a9e78f38ee5734308ef` and failed
on nine Prettier files. Build and the four test shards did not run. Its original
metadata and failed log remain in [failed-run](failed-run/README.md).

Commit `283685e050219af03ed221d8cce3c8e2c46a8077` formats those files and makes the
asynchronous catalogue writer use pinned Prettier with the repository's resolved
configuration. The synchronous generator interface and catalogue values remain
unchanged. The new nonempty-catalogue regression failed before the writer fix,
then the complete six-test distribution file passed. Regenerating the current
three publication files also preserved every byte: zero approved recordings,
albums, archives or public audio files.

## Review corrections

The audio review found a Recording mode bypass through published-theme fallback,
which carries no verified gameplay-video or Content ID authority. The correction
excludes that fallback in Recording mode. New tests cover initial selection,
retirement of an already playing published track and intentional paused state.
The independent review also reproduced an obsolete DB4 expectation in the
practice host fixture. Its five current-host cases now expect DB5 while retaining
their original byte and metadata preservation assertions.

The [audio review](../audio-review/README.md),
[independent audio review](../audio-independent-review/README.md) and
[UI/screen review](../ui-screen-review/README.md) state their exact source pins,
tests, authorship and limits. They approve only their bounded functional source
changes. No soundtrack recording, full native journey or release receives
approval from a recipe fingerprint.

## Production history

The original production ledger was revision 38. Refreshing the formatted source
first appended unreviewed revision 39; the Recording mode correction then
appended unreviewed revision 40. Their receipts and original command outputs are
retained under [ledger](ledger/). The first revision-39 observation sampled live
recipe inputs after a concurrent player correction; it is retained explicitly
as an observation. The corrected receipt derives its recipe sources from the
actual revision-39 ledger, without relabelling it as the later source.

Scoped reviewed revision 41 preserves all baseline and revision-40 metadata
prefixes and all 127 exact original payloads. Team picture bindings advance to
that exact revision after verification of both unchanged picture tuples,
geometry and bytes. Intermediate host failures caused by the stale revision-38
binding remain retained. The corrected complete audio-host cohort passes
127/127; the complete Team binding/presentation cohort passes 235/235. Its first
234/235 run exposed one remaining stale actor-fixture revision expectation;
only that expected revision changed, retaining all five actor identities and
original-byte assertions. See the [Team evidence](team-bindings/) and separate
[audio-host retest](../audio-review/host-after-README.md).

Two local immutable-production runs failed because sparse checkout omitted
`docs/verification/round-44/v034-delivery.md` and
`docs/verification/round-45/v035-delivery.md`. Restoring their exact tracked
3,136-byte and 4,101-byte contents made the full 70-test cohort pass. No production
validator or success predicate was weakened.

The [local check receipt](local-checks.json) retains validation, lint, both
formatting checks, catalogue regression (6/6), production reproducibility,
complete production history (12/12) and immutable production sources (70/70).
These checks passed before the repair commit. Their original logs and exact
working-source pins accompany the receipt; hosted checks bind the actual commit.

## Release boundary

Fresh hosted preflight, four complete test shards and build must pass on the
repaired commit. Earlier focused checks do not replace those gates. Large builds
and frozen artifacts stay hosted to preserve the local 1 GiB disk reserve.

The release owner still controls sequencing and version allocation. Latest
accepted UI integration, renewed exact-source qualification, frozen-build and
offline verification remain prerequisites to merge and Pages deployment.
There are still **zero approved new recordings**; the separate 36-composition
milestone remains unfinished.
