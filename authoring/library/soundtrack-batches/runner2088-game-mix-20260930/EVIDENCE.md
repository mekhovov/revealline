# runner2088 Game mix — pending trusted admission

The review-only recording was published through archive PR #65:
https://github.com/mekhovov/revealline-soundtracks/pull/65

This batch remains `pending`. It does not change the generated game catalogue,
default playback, albums or Recording mode. The archive variant stays review-only.

The original `wekont.runner2088` recording was owner-approved in archive PR #63.
That decision binds original SHA-256 `9924c6163116b0db94cc0c1878542d2576aac02051dd25f6ebb3b9767869cef9`.
The derivative has a separate ID and SHA-256
`528e7ebe15c91bc686ab9cdfadb4085ebd64b907f795282f7f9c817a46c672ba`.
The current owner-review contract cannot express inheritance from composition
approval. `review-dependency.json` deliberately records a dependency, rather than
an owner-review document claiming an unobserved exact-derivative decision.

To activate this batch, record an explicit decision covering the exact derivative
or separately review an explicit derivation contract. Either route must retain
the source approval, source/derivative identities, permitted gain/transcode recipe,
all deferred listening/device checks, and exact public delivery evidence. Publication
alone does not supply the missing approval basis.

Local full decoding independently established -16.94 LUFS / -1.14 dBTP and the
same 4,283,136 decoded stereo frames as the original. The copied measurement and
recipe files retain those exact results. Game `inspectMP3` counts 3,720 encoded
frames, yielding 97.175510204 seconds structurally; this includes MP3 framing and
differs from the gapless decoded duration of 97.123265306 seconds. The metadata
uses the game's structural inspector, consistently with existing admissions.

`source-evidence.json` preserves both archive records and the historical original
source observation. The source's CC BY 4.0 grant permits attributed, disclosed
modification; no Content ID or gameplay-video clearance is claimed. The gain-only
technical transformation was independently reproduced byte-for-byte. It does not
establish listening, warning audibility, transitions, mono, small-speaker or device
acceptance.

## Public delivery receipt — 30 September 2026

Archive PR #65 merged as `4c3bda6a8f796373f4840aa84a84e78ae65c8882`.
[Pages run 36745624857](https://github.com/mekhovov/revealline-soundtracks/actions/runs/36745624857)
passed publish-volumes, verification and deployment. Direct public checks at
`2026-09-30T16:43:41.336Z` established:

- The catalogue contains 261 recordings: 196 public and 65 review-only. The Game
  mix remains review-only, `listeningApproval: not-reviewed`, with no game
  admission, default or Recording mode eligibility.
- [The one-object inventory](https://mekhovov.github.io/revealline-soundtracks/admissions/runner2088-game-mix-20260930.json)
  returns HTTP 200, 322 bytes and SHA-256
  `16e36e2316a0b9685bcae326f03c30191823a86064f3e94d9b3aab08129ee6e8`.
- The complete Game mix MP3 returns HTTP 200, 3,887,378 bytes and SHA-256
  `528e7ebe15c91bc686ab9cdfadb4085ebd64b907f795282f7f9c817a46c672ba`.
- A separate `Range: bytes=0-15` request returns HTTP 206 with exactly 16 bytes,
  `Content-Range: bytes 0-15/3887378`, `Content-Type: audio/mp3`, and
  `Access-Control-Allow-Origin: *`.
- The complete original MP3 still returns HTTP 200, 3,884,999 bytes and unchanged
  SHA-256 `9924c6163116b0db94cc0c1878542d2576aac02051dd25f6ebb3b9767869cef9`.

The earlier PR staging attempt failed before publication because its draft audio
volume was unavailable to that workflow. The exact independently verified volume
was published, and the second attempt passed on the same source head. Both
attempts remain retained; the failed attempt is not counted as a pass.

The public bytes were checked entirely in memory. These checks establish delivery
and identity; they do not establish audible playback, listening approval,
transitions, offline restoration or physical-device acceptance. `delivery.json`
now records verified public delivery and its manifest pin has been refreshed.
The batch remains `pending`; no runtime output consumes a pending entry.
