# Follow-up: recorded FPV appearance in Replay Theater

Prepared design, not an implemented feature. This is a separately playable
successor to the actor default/menu work in PR338. It closes the remaining
standalone replay boundary in increment 1; it does not authorize a new capture
policy or change raw historical simulation recordings.

## Current gap

Solo exports the raw result of `exportReplay`. Theater verifies its rules,
inputs and checkpoint, then uses an independently selected preview world and no
recorded actor lease. A v6 saved attempt retains actors, but a standalone raw
replay does not. Do not describe raw export as retaining the new FPV appearance.

## Proposed bounded contract

Add `revealline-replay-presentation.v1`, containing only:

- `execution`: exact campaign key and optional source pack ID.
- `actorAppearancePin`: the existing strict 8 KiB actor pin.
- `replay`: the unchanged raw simulation recording.

Keep the inner 32 MiB and 216,000-tick limits. Permit at most 4 KiB additional
wrapper metadata, checked separately; no embedded images, audio, CSS or fonts.
Historical raw versions remain supported exactly as before. Expose raw export
alongside recorded-actor export, and label which one the player is downloading.

For the initial successor, scope to accepted Solo FPV recordings. Versus/Team
have no equivalent standalone recorder/export path. Do not imply they do.

## Authority and staging

1. Resolve the exact Journey edition or trusted Classic owner from the
   application's accepted registries, not uploaded `pin.content`.
2. Reconstruct recorded gameplay tuning, level and class recipes and compare
   them with the recording. Reuse existing pure reconstruction logic without
   copying a second rules implementation. Do not directly call `restoreSession`:
   that API rejects finished attempts, which are valid replay inputs.
3. Derive the actual presentation context, compare the uploaded pin, and acquire
   its exact approved actor source/hash. A missing old owner or asset does not
   authorize substitution with today's preference.
4. Stage the verified simulation player, painter and actor lease atomically.
   Failure/cancellation keeps previous playback. Dispose staging on supersession
   and the accepted lease only when replaced or closed.

Playback controls and world-preview changes retain the accepted actor lease.
Never read the global actor preference or write player progress. This wrapper
records actors only—not reveal-picture/media ownership, music, chrome or proof
of an authentic player performance.

## Focused acceptance

- Real Journey and Classic export → Theater with identical final checkpoints.
- Exact actors survive pause, stepping, seeking/restart and playback speed.
- Reject changed map/class/source/actor hashes, including same-ID substitutions.
- Preserve previous playback through failed decoding and superseded imports;
  close each staged/accepted resource once.
- Reject oversized inner replay even when the outer envelope is within its
  aggregate limit; keep raw-example/navigation coverage.
- Verify retained revision-62 fetch and rendering on the frozen public build.

Likely implementation boundaries are a new envelope parser, a read-only replay
actor-context adapter, Solo export wiring and Theater's transactional load/draw
paths. Keep this out of PR338's initial default-actor delivery unless explicitly
recombined by the release coordinator after review.
