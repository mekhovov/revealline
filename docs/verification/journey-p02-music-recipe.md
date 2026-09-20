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

This is not whole-phase, physical-speaker, album-listening or public acceptance.
Final integrated source qualification and deployment verification remain required.
