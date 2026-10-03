# Optional flight examples

[Download the Self-level foundation examples](foundation-self-level-v1.json)
(use **Download raw file** in GitHub). This file contains 14 demonstrations for
the primary foundation lessons: 15, 16, 13, 17, 14, and 18–26. It does not add
levels or change their objectives.

In World Studio, open **Library → Import recordings / examples** and choose
the downloaded JSON. The simulator independently replays each recording against
its exact installed course before offering it. Select **Self-level** in Settings,
then use **Watch demonstration · Self-level** in the school, or open its lesson
and watch/practise a section. Examples never earn completion, medals or rewards.

The existing Acro demonstrations remain bundled. These optional Self-level
examples follow the same authored objectives; Acro explanations about retained
tilt still describe Acro. Self-level returns toward the horizon. Sixteen later
Acro-skill lessons keep unscored Self-level practice and have no fabricated
Self-level completion recordings.

The JSON is separate from the core player download. Imported examples stay in
the device's recording library and can be exported or removed there. Pin an
example to protect it from removal; importing it again preserves existing pins.
Records are bounded by the existing 512-record/64 MiB library budget. Keep a
portable copy because browser storage is not guaranteed permanent.

## Reproduce

```sh
node scripts/qualify-fpv-acro-school.mjs --mode self-level --proof-archive --output /tmp/NEW-FPV-EXAMPLES
```

This supplies ordinary commands to the unchanged fixed-step runtime, independently
replays all 14 results, exports bounded hashed `FPVProofArchive.v2` parts, imports
them and replays again. It never appends to the core packed registry.

The committed archive is 260,391 bytes. SHA-256:
`715a45515c572ab559ca95362585f5665f6297f7fcd410b3c4d7474cf8ac36aa`.
The 60 Adventure authoring proofs are a later optional-data increment.
